import { useEffect, useState } from 'react';
import { Image as RNImage, ImageStyle, StyleProp, ImageResizeMode } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { originalFor } from '../lib/storage';

// Image avec un vrai cache disque (expo-image), comme sur les réseaux sociaux : la photo est rangée sous le
// chemin du FICHIER (l'adresse sans son jeton), pas sous l'adresse signée. Quand le jeton change (tous les
// quelques jours), la photo vient quand même du téléphone, sans rien retélécharger.
// expo-image est un module natif arrivé avec la 1.0.1 : sans lui, on garde l'Image de React Native.

let ExpoImage: any | null | undefined;
function expoImage(): any | null {
  if (ExpoImage !== undefined) return ExpoImage;
  try { ExpoImage = requireOptionalNativeModule('ExpoImage') ? require('expo-image').Image : null; } catch { ExpoImage = null; }
  return ExpoImage;
}

/**
 * La partie stable d'une adresse signée Supabase : le chemin du fichier et, pour une photo réduite, sa taille.
 * PIÈGE (bug des photos floues, corrigé le 30/10/2026) : la taille n'est pas écrite dans l'adresse, elle est DANS le
 * jeton. Sans la lire, la vignette de 200 px de l'Activité et la photo du fil avaient la même clé : la première
 * téléchargée servait pour les deux, et le fil affichait la vignette étirée.
 */
export const stableKey = (uri: string) => {
  const [base, query = ''] = uri.split('?');
  const size = transformOf(query);
  return size ? `${base}#${size}` : base;
};

function transformOf(query: string): string | null {
  const payload = /(?:^|&)token=[^.&]+\.([^.&]+)\./.exec(query)?.[1];
  if (!payload) return null;
  try {
    return /"transformations?":"([^"]+)"/.exec(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Ce qu'on sait d'une image à la fin du chargement. `cached` : venue du téléphone, sans passer par le réseau. */
export type ImageLoadInfo = { width?: number; height?: number; cached: boolean };

export function CachedImage({ uri, style, resizeMode = 'cover', onLoad, blurRadius }: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  onLoad?: (info: ImageLoadInfo) => void;
  blurRadius?: number;
}) {
  // Photo réduite refusée (quota Supabase, lien expiré) : on retente une fois avec la photo d'origine.
  const [src, setSrc] = useState(uri);
  const [retried, setRetried] = useState(false);
  useEffect(() => { setSrc(uri); setRetried(false); }, [uri]);
  const onError = () => {
    if (retried) return;
    setRetried(true);
    originalFor(src).then(u => { if (u) setSrc(u); }).catch(() => {});
  };

  const Img = expoImage();
  if (!Img) return <RNImage source={{ uri: src }} style={style} resizeMode={resizeMode} onLoad={e => { const src = e.nativeEvent.source; onLoad?.({ width: src?.width, height: src?.height, cached: false }); }} onError={onError} blurRadius={blurRadius} />;
  return (
    <Img
      source={{ uri: src, cacheKey: stableKey(src) }}
      style={style}
      contentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
      cachePolicy="memory-disk"
      recyclingKey={stableKey(src)}
      onError={onError}
      transition={0}
      blurRadius={blurRadius}
      onLoad={(e: any) => onLoad?.({ width: e?.source?.width, height: e?.source?.height, cached: !!e?.cacheType && e.cacheType !== 'none' })}
    />
  );
}
