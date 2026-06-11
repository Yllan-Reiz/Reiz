import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { s } from '../styles';

export function FlameStreak({ streak }: { streak: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (streak === 0) return;
    // Plus le streak est élevé, plus l'animation est intense et rapide
    const duration = streak >= 15 ? 500 : streak >= 8 ? 700 : streak >= 4 ? 1000 : 1400;
    const maxScale = streak >= 15 ? 1.35 : streak >= 8 ? 1.25 : streak >= 4 ? 1.18 : 1.1;
    const minOpacity = streak >= 15 ? 0.55 : streak >= 8 ? 0.65 : streak >= 4 ? 0.75 : 0.85;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: maxScale, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: minOpacity, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [streak]);

  const fontSize = streak >= 15 ? 18 : streak >= 8 ? 16 : streak >= 4 ? 15 : 13;

  return (
    <View style={s.streakBadge}>
      <Animated.Text style={[s.streakFlame, { fontSize, transform: [{ scale }], opacity }]}>🔥</Animated.Text>
      <Text style={s.streakText}>{streak}j</Text>
    </View>
  );
}
