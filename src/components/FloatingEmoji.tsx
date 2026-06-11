import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export let floatId = 0;
export function nextFloatId() { return ++floatId; }

export function FloatingEmoji({ emoji, onDone }: { emoji: string; onDone: () => void }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const drift = useRef((Math.random() - 0.5) * 50).current;
  const startX = useRef(Math.random() * 80 - 40).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -220, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(translateX, { toValue: drift * 0.4, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: drift, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: drift * 0.7, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 250, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 200, useNativeDriver: true }),
        Animated.delay(1100),
        Animated.timing(scale, { toValue: 0.7, duration: 650, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        bottom: 50,
        left: '50%' as any,
        marginLeft: startX - 14,
        fontSize: 28,
        transform: [{ translateY }, { translateX }, { scale }],
        opacity,
        zIndex: 50,
        pointerEvents: 'none' as any,
      }}>
      {emoji}
    </Animated.Text>
  );
}
