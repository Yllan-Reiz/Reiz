import { supabase } from './supabase';

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

/** Envoie une image et renvoie son chemin de stockage (à enregistrer en base). */
export async function uploadImage(
  path: string,
  uri: string,
  upsert = false
): Promise<{ path: string | null; error: { message?: string } | null }> {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert });
    if (error) return { path: null, error };
    return { path, error: null };
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
