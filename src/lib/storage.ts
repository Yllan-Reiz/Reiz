import { supabase, SUPABASE_ANON_KEY } from './supabase';

// Le bucket "updates" est privé : les fichiers ne sont accessibles que via une
// URL signée, valable un temps limité. On stocke donc en base le CHEMIN du
// fichier (ex: "a1b2.../1712345678.jpg"), jamais une URL, et on signe à la lecture.

const BUCKET = 'updates';
const EXPIRES_IN = 60 * 60; // 1 h : largement au-delà d'une session de consultation

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
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType, upsert });
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

/** Signe un chemin unique. Renvoie null si le fichier est absent ou l'accès refusé. */
export async function signOne(stored?: string | null): Promise<string | null> {
  if (!stored) return null;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(toPath(stored), EXPIRES_IN);
  return data?.signedUrl ?? null;
}

/**
 * Signe plusieurs chemins en une seule requête réseau.
 * Renvoie une table chemin d'origine → URL signée, pour un accès direct au rendu.
 */
export async function signMany(stored: (string | null | undefined)[]): Promise<Record<string, string>> {
  const uniques = [...new Set(stored.filter((v): v is string => !!v))];
  if (uniques.length === 0) return {};

  // chemin normalisé → valeur d'origine, pour réassocier sans dépendre de
  // l'ordre de retour de l'API ni de l'absence des entrées en échec.
  const backToStored = new Map<string, string>();
  uniques.forEach(v => backToStored.set(toPath(v), v));

  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls([...backToStored.keys()], EXPIRES_IN);
  if (!data) return {};

  const map: Record<string, string> = {};
  data.forEach(entry => {
    const original = entry.path ? backToStored.get(entry.path) : undefined;
    if (original && entry.signedUrl) map[original] = entry.signedUrl;
  });
  return map;
}
