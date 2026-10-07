import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

// Le bucket "updates" est privé : les fichiers ne sont accessibles que via une
// URL signée, valable un temps limité. On stocke donc en base le CHEMIN du
// fichier (ex: "a1b2.../1712345678.jpg"), jamais une URL, et on signe à la lecture.

const BUCKET = 'updates';
// Une URL signée est valable 24 h côté serveur et RÉUTILISÉE pendant 18 h côté téléphone. Pourquoi : une
// URL signée contient un jeton ; en re-signant à chaque ouverture, l'adresse de chaque photo changeait et
// l'iPhone ne pouvait jamais réutiliser une photo déjà téléchargée (tout se retéléchargeait à chaque
// lancement). Une adresse stable = la photo vient du cache de l'appareil, instantanément.
const EXPIRES_IN = 24 * 60 * 60;
const REUSE_MS = 18 * 60 * 60 * 1000;

/**
 * Les anciens enregistrements contiennent une URL publique complète.
 * On en réextrait le chemin pour pouvoir les signer comme les autres.
 */
function toPath(stored: string): string {
  if (!stored.startsWith('http')) return stored;
  // .../storage/v1/object/public/updates/<chemin>?t=123
  const marker = `/object/public/${BUCKET}/`;
  const i = stored.indexOf(marker);
  if (i === -1) return stored;
  return stored.slice(i + marker.length).split('?')[0];
}

/**
 * Une publication peut porter une photo ou une vidéo, dans la même colonne
 * `photo_url` : c'est l'extension du fichier qui dit laquelle. Pas de colonne
 * en plus, donc aucun changement de base pour les vidéos.
 * Marche aussi sur une URL signée (l'extension est avant le « ? »).
 */
export function isVideo(stored?: string | null): boolean {
  return !!stored && /\.(mp4|mov|m4v)(\?|$)/i.test(stored);
}

/**
 * Envoi par formulaire multipart, à la main : React Native lit le fichier sur
 * le disque et l'envoie lui-même, sans jamais le charger dans la mémoire
 * JavaScript.
 *
 * C'est le seul chemin fiable sur Android. Diagnostic du 29/09/2026 : les deux
 * autres méthodes (fetch(uri).arrayBuffer() pour les photos, fetch(uri).blob()
 * pour les vidéos) échouent là-bas en « Network request failed » dès que le
 * fichier dépasse quelques mégas, ce que l'app traduisait par « Pas de
 * connexion » alors que le réseau était bon. Preuve côté serveur : aucun .mp4
 * (donc aucune vidéo Android) n'était jamais arrivé dans le bucket, uniquement
 * des .mov et des .jpg venant d'iPhone.
 */
async function uploadViaFormData(
  path: string,
  uri: string,
  contentType: string,
  upsert: boolean
): Promise<{ path: string | null; error: { message?: string } | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { path: null, error: { message: 'Session expirée. Reconnecte-toi et réessaie.' } };

  const form = new FormData();
  form.append('file', { uri, name: path.split('/').pop() || 'fichier', type: contentType } as any);

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    // Pas de Content-Type imposé : fetch doit poser lui-même la frontière multipart.
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'x-upsert': upsert ? 'true' : 'false',
    },
    body: form,
  });
  if (res.ok) return { path, error: null };
  const body = await res.text().catch(() => '');
  return { path: null, error: { message: `HTTP ${res.status} ${body.slice(0, 160)}` } };
}

/**
 * Deuxième chemin Android : le module natif de fichiers lit et envoie le
 * fichier lui-même, vers une adresse d'envoi à usage unique. Il ne dépend ni
 * de FormData ni de la couche réseau JavaScript, donc il passe là où le premier
 * chemin échoue (fichier que fetch n'arrive pas à ouvrir, par exemple).
 */
async function uploadViaFileSystem(
  path: string,
  uri: string,
  contentType: string,
  upsert: boolean
): Promise<{ path: string | null; error: { message?: string } | null }> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { path: null, error: error || { message: "(B) pas d'adresse d'envoi" } };
  const res = await FileSystem.uploadAsync(data.signedUrl, uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': contentType,
      'x-upsert': upsert ? 'true' : 'false',
      apikey: SUPABASE_ANON_KEY,
    },
  });
  if (res.status >= 200 && res.status < 300) return { path, error: null };
  return { path: null, error: { message: `(B) HTTP ${res.status} ${(res.body || '').slice(0, 140)}` } };
}

/**
 * Chemin d'envoi Android : on tente le formulaire multipart, puis le module
 * natif de fichiers si le premier échoue. Chaque message d'erreur est préfixé
 * par (A) ou (B) pour savoir, sur une simple capture d'écran, lequel des deux
 * a parlé.
 */
async function uploadAndroid(
  path: string,
  uri: string,
  contentType: string,
  upsert: boolean
): Promise<{ path: string | null; error: { message?: string } | null }> {
  let first = '';
  try {
    const r = await uploadViaFormData(path, uri, contentType, upsert);
    if (!r.error) return r;
    first = r.error.message || 'échec';
  } catch (e: any) {
    first = e?.message || 'échec';
  }
  try {
    const r = await uploadViaFileSystem(path, uri, contentType, upsert);
    if (!r.error) return r;
    return { path: null, error: { message: `(A) ${first} | ${r.error.message}` } };
  } catch (e: any) {
    return { path: null, error: { message: `(A) ${first} | (B) ${e?.message || 'échec'}` } };
  }
}

/**
 * Recompresse une vidéo en 720p à ~2,5 Mb/s avant l'envoi : une vidéo de 15 s
 * passe de ~25 Mo à ~5 Mo. C'est ce poids que chaque spectateur retélécharge, donc
 * c'est le levier principal sur la bande passante Supabase (le préréglage du
 * sélecteur d'images ne s'appliquait pas : les vidéos arrivaient à 22-37 Mo).
 * Si la compression échoue, on envoie l'original plutôt que de bloquer la publication.
 */
export async function compressVideo(uri: string): Promise<string> {
  try {
    // Chargé à la demande : le module natif n'existe pas dans Expo Go (tests au simulateur),
    // et un import en tête de fichier ferait planter toute l'app là-bas.
    const { Video: VideoCompressor } = require('react-native-compressor');
    return await VideoCompressor.compress(uri, {
      compressionMethod: 'manual',
      maxSize: 1280,
      bitrate: 2_500_000,
    });
  } catch {
    return uri;
  }
}

/** Envoie une image et renvoie son chemin de stockage (à enregistrer en base). */
export async function uploadImage(
  path: string,
  uri: string,
  upsert = false
): Promise<{ path: string | null; error: { message?: string } | null }> {
  return uploadFile(path, uri, 'image/jpeg', upsert);
}

/** Envoie un fichier quelconque (photo ou vidéo) et renvoie son chemin de stockage. */
export async function uploadFile(
  path: string,
  uri: string,
  contentType: string,
  upsert = false
): Promise<{ path: string | null; error: { message?: string } | null }> {
  // Android : envoi natif obligatoire (voir uploadViaFormData). iOS garde le
  // chemin qui fonctionne déjà, on ne touche pas à ce qui marche.
  if (Platform.OS === 'android') return uploadAndroid(path, uri, contentType, upsert);
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType, upsert, cacheControl: '31536000' });
    if (error) return { path: null, error };
    return { path, error: null };
  } catch (e: any) {
    return { path: null, error: e };
  }
}

/**
 * Envoi d'une vidéo. On ne passe PAS par fetch(uri).arrayBuffer() comme pour
 * les photos : ça recopie tout le fichier dans la mémoire JavaScript, et sur
 * Android une vidéo de 20 à 60 Mo plantait avant même de partir (27/09/2026).
 * Ici, le serveur fournit une adresse d'envoi à usage unique et on lui envoie
 * un Blob : React Native le garde côté natif et l'envoie depuis le disque.
 * (Une première version passait par expo-file-system : sa version native,
 * plus récente que celle d'Expo, faisait planter Android au lancement.)
 */
export async function uploadVideo(
  path: string,
  uri: string,
  contentType: string
): Promise<{ path: string | null; error: { message?: string } | null }> {
  if (Platform.OS === 'android') return uploadAndroid(path, uri, contentType, false);
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { path: null, error: error || { message: "Pas d'adresse d'envoi" } };
    const file = await (await fetch(uri)).blob();
    const res = await fetch(data.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'x-upsert': 'false', apikey: SUPABASE_ANON_KEY },
      body: file,
    });
    if (res.ok) return { path, error: null };
    const body = await res.text().catch(() => '');
    return { path: null, error: { message: `HTTP ${res.status} ${body.slice(0, 160)}` } };
  } catch (e: any) {
    return { path: null, error: e };
  }
}

// ---------- URLs signées, avec mémoire ----------

type Signed = { url: string; at: number };
const SIGNED_KEY = 'reiz.signed.v1';
const memory = new Map<string, Signed>();
let hydrated: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
// La transformation d'images (réduction à la volée) dépend de l'offre Supabase : si elle échoue,
// on s'en passe pour le reste de la session au lieu de réessayer à chaque photo.
let transformOk = true;

/** Relit les adresses déjà signées au premier usage (elles survivent entre deux lancements). */
function hydrate(): Promise<void> {
  if (!hydrated) {
    hydrated = (async () => {
      try {
        const raw = await AsyncStorage.getItem(SIGNED_KEY);
        if (!raw) return;
        const now = Date.now();
        Object.entries(JSON.parse(raw) as Record<string, Signed>).forEach(([k, e]) => { if (now - e.at < REUSE_MS) memory.set(k, e); });
      } catch {}
    })();
  }
  return hydrated;
}

function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const entries = [...memory.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, 500);
    AsyncStorage.setItem(SIGNED_KEY, JSON.stringify(Object.fromEntries(entries))).catch(() => {});
  }, 1500);
}

/** À la déconnexion : on oublie toutes les adresses (elles sont aussi effacées du disque par cacheClearAll). */
export function resetSignedCache() {
  memory.clear();
  hydrated = null;
}

export type SignOpts = {
  /**
   * Largeur voulue en pixels pour une photo : le serveur renvoie une version réduite (un avatar de
   * 40 pt n'a pas besoin des 300 Ko de l'original). Sans effet sur les vidéos.
   */
  width?: number;
};

const isImagePath = (p: string) => /\.(jpe?g|png|webp)$/i.test(p);
const keyOf = (path: string, width?: number) => (width ? `${width}|${path}` : path);

/** Un seul chemin, avec réduction demandée au serveur quand c'est possible. */
async function signOneRaw(path: string, width?: number): Promise<string | null> {
  if (width && transformOk && isImagePath(path)) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRES_IN, { transform: { width, quality: 75 } });
    if (!error && data?.signedUrl) return data.signedUrl;
    // La réduction a échoué : si l'original, lui, se signe, c'est la fonction qui est indisponible.
    const plain = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRES_IN);
    if (plain.data?.signedUrl) transformOk = false;
    return plain.data?.signedUrl ?? null;
  }
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRES_IN);
  return data?.signedUrl ?? null;
}

/** Exécute `fn` sur chaque élément, au plus `n` à la fois. */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const x = items[i++]; await fn(x); }
  }));
}

/**
 * Signe plusieurs chemins. Une adresse déjà signée il y a moins de 18 h est réutilisée telle quelle
 * (voir plus haut) : le plus souvent aucune requête réseau n'est nécessaire.
 * Renvoie une table chemin d'origine → URL signée, pour un accès direct au rendu.
 */
export async function signMany(stored: (string | null | undefined)[], opts?: SignOpts): Promise<Record<string, string>> {
  const uniques = [...new Set(stored.filter((v): v is string => !!v))];
  if (uniques.length === 0) return {};
  await hydrate();

  const out: Record<string, string> = {};
  const missing: { original: string; path: string; width?: number }[] = [];
  uniques.forEach(original => {
    const path = toPath(original);
    const width = opts?.width && transformOk && isImagePath(path) ? opts.width : undefined;
    const hit = memory.get(keyOf(path, width));
    if (hit && Date.now() - hit.at < REUSE_MS) out[original] = hit.url;
    else missing.push({ original, path, width });
  });
  if (missing.length === 0) return out;

  const remember = (m: { original: string; path: string; width?: number }, url: string) => {
    out[m.original] = url;
    memory.set(keyOf(m.path, m.width), { url, at: Date.now() });
  };

  const plain = missing.filter(m => !m.width);
  const resized = missing.filter(m => m.width);

  // Sans réduction : une seule requête pour tout le lot.
  if (plain.length > 0) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(plain.map(m => m.path), EXPIRES_IN);
    const byPath = new Map(plain.map(m => [m.path, m]));
    (data || []).forEach(entry => {
      const m = entry.path ? byPath.get(entry.path) : undefined;
      if (m && entry.signedUrl) remember(m, entry.signedUrl);
    });
  }
  // Avec réduction : le serveur ne signe qu'un chemin à la fois, on en lance quelques-uns en parallèle.
  if (resized.length > 0) {
    await pool(resized, 6, async m => {
      const url = await signOneRaw(m.path, m.width);
      if (url) remember(m, url);
    });
  }
  persistSoon();
  return out;
}

/** Signe un chemin unique. Renvoie null si le fichier est absent ou l'accès refusé. */
export async function signOne(stored?: string | null, opts?: SignOpts): Promise<string | null> {
  if (!stored) return null;
  return (await signMany([stored], opts))[stored] ?? null;
}

/** Petite photo de profil (rond de liste, pastille) : version réduite à 200 px de large. */
export const signAvatars = (stored: (string | null | undefined)[]) => signMany(stored, { width: 200 });
