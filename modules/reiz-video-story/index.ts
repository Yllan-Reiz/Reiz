import { requireOptionalNativeModule } from 'expo';

// Module natif local (modules/reiz-video-story), arrivé avec le build 13 de la 1.0.1.
// Absent d'un build plus ancien : la story vidéo n'est pas proposée, l'image reste utilisée.
const Native = requireOptionalNativeModule<{ compose(videoUri: string, overlayUri: string): Promise<string> }>('ReizVideoStory');

export const videoStoryAvailable = () => !!Native;

/** Assemble la vidéo et l'habillage PNG (1080 x 1920, transparent) en un MP4 9:16. Renvoie l'URI du fichier. */
export function composeVideoStory(videoUri: string, overlayUri: string): Promise<string> {
  if (!Native) return Promise.reject(new Error('Story vidéo indisponible'));
  return Native.compose(videoUri, overlayUri);
}
