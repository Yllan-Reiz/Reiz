import { Image, Platform, StyleProp, ImageStyle, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { decode } from 'blurhash';

// Empreinte floue affichée (fil de découverte, 26/11/2026).
// iPhone : expo-image la décode lui-même, vérifié au simulateur.
// Android : essai sur émulateur du 26/11, expo-image (Glide) rendait des empreintes à moitié noires ou rayées quand
// plusieurs s'affichaient en même temps, et pas toujours les mêmes d'un lancement à l'autre. On décode donc ici en
// JavaScript (8 x 12 couleurs), on en fait une minuscule image BMP, et l'Image de React Native l'agrandit en dégradé
// doux (plus un léger flou). Aucune dépendance native : la mise à jour à distance suffit.

const W = 8;
const H = 12;
const cache = new Map<string, string>();

function bmpUri(hash: string): string | null {
  const known = cache.get(hash);
  if (known) return known;
  try {
    const px = decode(hash, W, H);
    const row = Math.ceil((W * 3) / 4) * 4;
    const size = 54 + row * H;
    const buf = new Uint8Array(size);
    const dv = new DataView(buf.buffer);
    buf[0] = 0x42; buf[1] = 0x4d;
    dv.setUint32(2, size, true);
    dv.setUint32(10, 54, true);
    dv.setUint32(14, 40, true);
    dv.setInt32(18, W, true);
    dv.setInt32(22, H, true);
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 24, true);
    dv.setUint32(34, row * H, true);
    for (let y = 0; y < H; y++) {
      const line = 54 + (H - 1 - y) * row; // le BMP se lit de bas en haut
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const o = line + x * 3;
        buf[o] = px[i + 2]; buf[o + 1] = px[i + 1]; buf[o + 2] = px[i];
      }
    }
    let bin = '';
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const uri = `data:image/bmp;base64,${btoa(bin)}`;
    cache.set(hash, uri);
    return uri;
  } catch {
    return null;
  }
}

let ExpoImage: any | null | undefined;
function expoImage(): any | null {
  if (ExpoImage !== undefined) return ExpoImage;
  try { ExpoImage = requireOptionalNativeModule('ExpoImage') ? require('expo-image').Image : null; } catch { ExpoImage = null; }
  return ExpoImage;
}

export function BlurhashImage({ hash, style }: { hash: string; style: StyleProp<ImageStyle> }) {
  const Img = expoImage();
  if (Platform.OS !== 'android' && Img) {
    return <Img source={{ blurhash: hash, width: 24, height: 36 }} contentFit="cover" transition={0} style={style} accessible={false} />;
  }
  const uri = bmpUri(hash);
  if (!uri) return <View style={[style as any, { backgroundColor: '#1c1c1c' }]} />;
  return <Image source={{ uri }} style={style} resizeMode="stretch" blurRadius={6} fadeDuration={0} accessible={false} />;
}
