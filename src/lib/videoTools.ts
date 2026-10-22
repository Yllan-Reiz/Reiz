import { NativeModules, TurboModuleRegistry } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

// Outils vidéo du 1.0.1 : l'éditeur de rognage (react-native-video-trim) et l'image extraite d'une vidéo
// (expo-video-thumbnails). Deux modules natifs absents des builds 1.0.0 : même règle que contacts.ts, on
// vérifie que la partie native existe AVANT le `require`, sinon Metro lève une erreur fatale.

let trimCached: any | null | undefined;
function trimNative(): any | null {
  if (trimCached !== undefined) return trimCached;
  try {
    const present = !!TurboModuleRegistry.get('VideoTrim') || !!NativeModules.VideoTrim;
    trimCached = present ? require('react-native-video-trim') : null;
  } catch {
    trimCached = null;
  }
  return trimCached;
}

let thumbCached: any | null | undefined;
function thumbNative(): any | null {
  if (thumbCached !== undefined) return thumbCached;
  try {
    thumbCached = requireOptionalNativeModule('ExpoVideoThumbnails') ? require('expo-video-thumbnails') : null;
  } catch {
    thumbCached = null;
  }
  return thumbCached;
}

export const trimAvailable = () => !!trimNative();

/**
 * Ouvre l'éditeur plein écran pour garder au plus `maxSec` secondes d'une vidéo.
 * Renvoie l'URI du morceau gardé, ou null si la personne annule (ou si le rognage échoue).
 */
export function trimVideo(uri: string, maxSec: number): Promise<string | null> {
  const m = trimNative();
  if (!m) return Promise.resolve(null);
  const VideoTrim = m.default;
  return new Promise(resolve => {
    let done = false;
    const subs: { remove: () => void }[] = [];
    const finish = (out: string | null) => {
      if (done) return;
      done = true;
      subs.forEach(s => s.remove());
      resolve(out);
    };
    subs.push(VideoTrim.onFinishTrimming(({ outputPath }: { outputPath: string }) =>
      finish(outputPath.startsWith('file://') ? outputPath : `file://${outputPath}`)));
    subs.push(VideoTrim.onCancel(() => finish(null)));
    subs.push(VideoTrim.onError(() => finish(null)));
    // Fermé sans résultat (geste de fermeture) : onHide arrive après onFinishTrimming quand il y en a un.
    subs.push(VideoTrim.onHide(() => setTimeout(() => finish(null), 300)));
    m.showEditor(uri, {
      maxDuration: maxSec * 1000,
      minDuration: 1000,
      theme: 'dark',
      trimmerColor: '#ffffff',
      handleIconColor: '#000000',
      headerText: `Glisse les bords · ${maxSec} s max`,
      headerTextSize: 15,
      headerTextColor: '#ffffff',
      cancelButtonText: 'Annuler',
      saveButtonText: 'Valider',
      trimmingText: 'Découpage…',
      enableCancelDialog: false,
      enableSaveDialog: false,
      // Outils au-dessus de la vidéo : recadrer, pivoter, retourner, couper le son, vitesse, annuler.
      enableEditTools: true,
      // En gardant le doigt immobile sur une poignée, la frise zoome sur 3 s : couper à la seconde près.
      zoomOnWaitingDuration: 3000,
      enableHapticFeedback: true,
      enableCancelTrimming: true,
      cancelTrimmingButtonText: 'Arrêter',
      enableCancelTrimmingDialog: false,
      autoplay: true,
      closeWhenFinish: true,
      saveToPhoto: false,
      openShareSheetOnFinish: false,
      openDocumentsOnFinish: false,
      fullScreenModalIOS: true,
      durationFormat: 'mm:ss',
      alertOnFailToLoad: true,
      alertOnFailTitle: 'Vidéo illisible',
      alertOnFailMessage: "Impossible d'ouvrir cette vidéo. Essaie-en une autre.",
      alertOnFailCloseText: 'OK',
    });
  });
}

/** Supprime les morceaux rognés gardés par l'éditeur (dans Documents) une fois la vidéo envoyée. */
export function cleanTrimmed() {
  const m = trimNative();
  if (m) m.cleanFiles().catch(() => {});
}

/** Image JPEG tirée du début d'une vidéo (fichier local ou URL signée). Null si le module manque ou échoue. */
export async function videoStill(uri: string): Promise<string | null> {
  const m = thumbNative();
  if (!m) return null;
  try {
    const { uri: still } = await m.getThumbnailAsync(uri, { time: 300, quality: 0.85 });
    return still;
  } catch {
    return null;
  }
}
