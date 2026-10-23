import { useEffect, useRef } from 'react';
import { Text, Animated, Easing, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { s } from '../styles';
import { t, tp } from '../i18n';

const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

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

  const iconSize = streak >= 15 ? 18 : streak >= 8 ? 16 : streak >= 4 ? 15 : 13;

  // Toucher la flamme explique la série : ce qu'elle compte et comment ne pas la perdre.
  const explain = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(
      streak > 0 ? tp('story.streak', streak) : t('streak.title'),
      streak > 0
        ? tp('streak.running', streak)
        : t('streak.none'),
    );
  };

  return (
    <TouchableOpacity style={s.streakBadge} onPress={explain} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={tp('streak.a11y', streak)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
      <AnimatedIcon
        name="flame"
        size={iconSize}
        color="#fff"
        style={{ transform: [{ scale }], opacity }}
      />
      <Text style={s.streakText}>{streak}j</Text>
    </TouchableOpacity>
  );
}
