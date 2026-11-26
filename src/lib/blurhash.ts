import { requireOptionalNativeModule } from 'expo';
import { compressImage, signMany, isVideo } from './storage';
import { supabase } from './supabase';
import { videoStill } from './videoTools';

// Empreinte floue d'une séance (phase 39, 26/11/2026). Calculée sur le téléphone de l'auteur à la publication, puis
// rangée avec le post (updates.blurhash). C'est TOUT ce qu'un inconnu reçoit dans le fil de découverte : quelques taches
// de couleur, jamais la photo ni la vidéo. 4 x 3 composantes : on devine une ambiance, pas une silhouette.
const COMPONENTS: [number, number] = [4, 3];
const TIMEOUT_MS = 5000;

function expoImage(): any | null {
  try { return requireOptionalNativeModule('ExpoImage') ? require('expo-image').Image : null; } catch { return null; }
}

/** L'empreinte floue d'une photo ou d'une vidéo locale (ou signée). Null si quelque chose manque : le post part quand même. */
export async function makeBlurhash(uri: string, video: boolean): Promise<string | null> {
  const Img = expoImage();
  if (!Img?.generateBlurhashAsync) return null;
  const work = (async () => {
    const src = video ? await videoStill(uri) : uri;
    if (!src) return null;
    // Réduite d'abord à 64 px : l'empreinte d'une photo de 12 Mpx prendrait plusieurs secondes, pour le même résultat.
    const small = await compressImage(src, 64);
    const h = await Img.generateBlurhashAsync(small, COMPONENTS);
    return typeof h === 'string' && h.length >= 6 && h.length <= 120 ? h : null;
  })().catch(() => null);
  return Promise.race([work, new Promise<null>(r => setTimeout(() => r(null), TIMEOUT_MS))]);
}

// Rattrapage (phase 39) : les séances postées avant cette version, ou depuis une app pas encore à jour, n'ont pas
// d'empreinte et n'apparaissent donc pas dans le fil de découverte. L'app de l'auteur (la seule à pouvoir lire ses
// fichiers) complète ses 3 dernières séances du mois, une fois par lancement. Modifier un post ne prévient personne
// (la notification part seulement à sa création).
const healed = new Set<string>();
export async function healMyBlurhashes(uid: string): Promise<void> {
  if (healed.has(uid)) return;
  healed.add(uid);
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase.from('updates').select('id, photo_url')
    .eq('user_id', uid).is('blurhash', null).not('photo_url', 'is', null).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(3);
  if (error || !data?.length) return;
  const signed = await signMany(data.map(d => d.photo_url));
  for (const d of data) {
    const url = d.photo_url ? signed[d.photo_url] : null;
    if (!url) continue;
    const h = await makeBlurhash(url, isVideo(d.photo_url));
    if (h) await supabase.from('updates').update({ blurhash: h }).eq('id', d.id);
  }
}
