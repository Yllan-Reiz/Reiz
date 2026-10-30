import { useRef } from 'react';
import { Animated, StyleProp, ImageStyle, ImageResizeMode } from 'react-native';
import { CachedImage, ImageLoadInfo } from './CachedImage';

// Les photos du feed arrivent d'URLs signées : elles se décodent après le rendu
// de la carte. Sans fondu, elles apparaissent d'un coup et le feed clignote.
export function FadeInImage({ uri, style, resizeMode = 'cover', onLoaded }: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  onLoaded?: (info: ImageLoadInfo) => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  // Cache disque (CachedImage) : une photo déjà vue s'affiche tout de suite, même si son adresse signée a changé.
  return (
    <Animated.View style={[style, { opacity, overflow: 'hidden' }]}>
      <CachedImage
        uri={uri}
        style={{ width: '100%', height: '100%' }}
        resizeMode={resizeMode}
        onLoad={info => {
          onLoaded?.(info);
          // Déjà sur le téléphone : tout de suite, sans fondu (sinon la photo clignote quand on remonte dans le fil).
          if (info.cached) opacity.setValue(1);
          else Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }}
      />
    </Animated.View>
  );
}
