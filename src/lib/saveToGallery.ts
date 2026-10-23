import { requireOptionalNativeModule } from 'expo';

// Enregistrer dans la galerie de l'iPhone la photo ou la vidéo prise dans Reiz.
// expo-media-library est un module natif arrivé avec le build 13 de la 1.0.1 : sans lui, le bouton n'apparaît pas.
let lib: any | null | undefined;
function mediaLibrary(): any | null {
  if (lib !== undefined) return lib;
  try { lib = requireOptionalNativeModule('ExpoMediaLibrary') ? require('expo-media-library') : null; } catch { lib = null; }
  return lib;
}

export const galleryAvailable = () => !!mediaLibrary();

/** 'saved', 'denied' (autorisation refusée) ou 'error'. Ne demande que l'ajout, pas la lecture de la galerie. */
export async function saveToGallery(uri: string): Promise<'saved' | 'denied' | 'error'> {
  const ML = mediaLibrary();
  if (!ML) return 'error';
  try {
    const { status } = await ML.requestPermissionsAsync(true);
    if (status !== 'granted') return 'denied';
    await ML.saveToLibraryAsync(uri);
    return 'saved';
  } catch {
    return 'error';
  }
}
