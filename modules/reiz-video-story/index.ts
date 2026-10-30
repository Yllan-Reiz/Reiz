import { requireOptionalNativeModule } from 'expo';

// Module natif local (modules/reiz-video-story), arrivé avec le build 13 de la 1.0.1.
// Absent d'un build plus ancien : la story vidéo n'est pas proposée, l'image reste utilisée.
export type JourneySegment = { uri: string; type: 'image' | 'video'; seconds: number; overlay?: string };

const Native = requireOptionalNativeModule<{
  compose(videoUri: string, overlayUri: string): Promise<string>;
  // 1.2 : absent des builds plus anciens, même quand le module y est.
  composeJourney?(segments: JourneySegment[]): Promise<string>;
}>('ReizVideoStory');

export const videoStoryAvailable = () => !!Native;
export const journeyVideoAvailable = () => typeof Native?.composeJourney === 'function';

/** Assemble la vidéo et l'habillage PNG (1080 x 1920, transparent) en un MP4 9:16. Renvoie l'URI du fichier. */
export function composeVideoStory(videoUri: string, overlayUri: string): Promise<string> {
  if (!Native) return Promise.reject(new Error('Story vidéo indisponible'));
  return Native.compose(videoUri, overlayUri);
}

/** Le parcours d'un objectif en MP4 9:16 muet : les étapes à la suite (adresses signées acceptées). Renvoie l'URI. */
export function composeJourneyVideo(segments: JourneySegment[]): Promise<string> {
  if (!Native?.composeJourney) return Promise.reject(new Error('Vidéo du parcours indisponible'));
  return Native.composeJourney(segments);
}
