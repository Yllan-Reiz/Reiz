import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { F } from '../styles';

export let floatId = 0;
export function nextFloatId() { return ++floatId; }

// La réaction qui s'envole quand on réagit : la photo de profil de celui qui réagit, avec son émoji posé dessus
// (12/11/2026 : avant, l'émoji montait seul).
const SIZE = 44;

export function FloatingEmoji({ emoji, avatar, initial, onDone }: { emoji: string; avatar?: string | null; initial?: string; onDone: () => void }) {
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
        Animated.timing(scale, { toValue: 1.15, duration: 250, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 200, useNativeDriver: true }),
        Animated.delay(1100),
        Animated.timing(scale, { toValue: 0.7, duration: 650, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 50,
        left: '50%',
        marginLeft: startX - SIZE / 2,
        width: SIZE,
        height: SIZE,
        transform: [{ translateY }, { translateX }, { scale }],
        opacity,
        zIndex: 50,
      }}>
      {avatar
        ? <Image source={{ uri: avatar }} style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, borderColor: '#0a0a0a', backgroundColor: '#2a2a2a' }} />
        : (
          <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, borderColor: '#0a0a0a', backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 16, fontFamily: F.bold }}>{initial || ''}</Text>
          </View>
        )}
      <Text style={{ position: 'absolute', right: -6, bottom: -6, fontSize: 20 }}>{emoji}</Text>
    </Animated.View>
  );
}
