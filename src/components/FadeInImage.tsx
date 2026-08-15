import { useRef } from 'react';
import { Animated, StyleProp, ImageStyle, ImageResizeMode } from 'react-native';

// Les photos du feed arrivent d'URLs signées : elles se décodent après le rendu
// de la carte. Sans fondu, elles apparaissent d'un coup et le feed clignote.
export function FadeInImage({ uri, style, resizeMode = 'cover' }: {
  uri: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  return (
    <Animated.Image
      source={{ uri }}
      style={[style, { opacity }]}
      resizeMode={resizeMode}
      onLoad={() => {
        Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      }}
    />
  );
}
