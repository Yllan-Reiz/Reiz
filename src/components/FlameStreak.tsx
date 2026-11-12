import { useEffect, useRef } from 'react';
import { Text, Animated, Easing, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { s } from '../styles';
import { t, tp } from '../i18n';
import type { WeekState } from '../lib/weekly';

const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

// `streak` : semaines réussies d'affilée (1.4). `week` : la semaine en cours, pour l'explication au toucher.
export function FlameStreak({ streak, week }: { streak: number; week?: WeekState | null }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (streak === 0) return;
    // Plus le streak est élevé, plus l'animation est intense et rapide
    const duration = streak >= 12 ? 500 : streak >= 6 ? 700 : streak >= 3 ? 1000 : 1400;
    const maxScale = streak >= 12 ? 1.35 : streak >= 6 ? 1.25 : streak >= 3 ? 1.18 : 1.1;
    const minOpacity = streak >= 12 ? 0.55 : streak >= 6 ? 0.65 : streak >= 3 ? 0.75 : 0.85;

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

  const iconSize = streak >= 12 ? 18 : streak >= 6 ? 16 : streak >= 3 ? 15 : 13;

  // Toucher la flamme explique la série : ce qu'elle compte et comment ne pas la perdre.
  const explain = () => {
    Haptics.selectionAsync().catch(() => {});
    // D'abord où en est la semaine (« 2 sur 3, encore 1 séance »), puis la règle.
    const status = !week ? '' : week.weekDone
      ? t('streak.weekDone', { done: week.done, quota: week.quota })
      : tp('streak.weekLeft', week.left, { done: week.done, quota: week.quota });
    Alert.alert(
      streak > 0 ? tp('story.streak', streak) : t('streak.title'),
      [status, streak > 0 ? t('streak.rule') : t('streak.none')].filter(Boolean).join('\n\n'),
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
      <Text style={s.streakText}>{t('days.streakWeeks', { n: streak })}</Text>
    </TouchableOpacity>
  );
}
