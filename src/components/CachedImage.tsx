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

/** La partie stable d'une adresse signée Supabase : le chemin du fichier (et la taille demandée). */
export const stableKey = (uri: string) => {
  const [base, query = ''] = uri.split('?');
  const width = /(?:^|&)width=(\d+)/.exec(query)?.[1];
  return width ? `${base}#w${width}` : base;
};

export function CachedImage({ uri, style, resizeMode = 'cover', onLoad, blurRadius }: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  onLoad?: () => void;
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
  if (!Img) return <RNImage source={{ uri: src }} style={style} resizeMode={resizeMode} onLoad={onLoad} onError={onError} blurRadius={blurRadius} />;
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
      onLoad={onLoad}
    />
  );
}
