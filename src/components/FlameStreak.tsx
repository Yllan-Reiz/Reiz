import { useEffect, useRef } from 'react';
import { Text, Animated, Easing, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { s } from '../styles';

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
      streak > 0 ? `🔥 ${streak} jour${streak > 1 ? 's' : ''} d'affilée` : 'Ta série',
      streak > 0
        ? `Tu as posté une séance ${streak} jour${streak > 1 ? 's' : ''} de suite. Poste aujourd'hui pour la garder : un jour sans post et elle repart à zéro.`
        : "Poste une séance aujourd'hui pour lancer ta série. Chaque jour où tu postes la fait monter, ton cercle la voit sur ton profil.",
    );
  };

  return (
    <TouchableOpacity style={s.streakBadge} onPress={explain} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Série de ${streak} jours, en savoir plus`} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
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
