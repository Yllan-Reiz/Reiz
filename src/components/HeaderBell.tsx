import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// La cloche de l'en-tête (17/11/2026). Rien à lire : un simple contour blanc, immobile. Des notifications :
// elle se remplit en blanc et se balance comme une vraie cloche, accrochée par le haut, à leur arrivée puis
// de temps en temps tant qu'il en reste. Une fois l'Activité ouverte et tout lu, elle redevient un contour.
// « Réduire les animations » la laisse immobile.

const SWING = [16, -13, 9, -6, 3, 0];   // degrés, de plus en plus petits
const EVERY_MS = 7000;                  // rappel discret tant qu'il reste du non lu

export function HeaderBell({ count, size = 30 }: { count: number; size?: number }) {
  const angle = useRef(new Animated.Value(0)).current;
  const still = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(v => { still.current = v; }, () => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => { still.current = v; });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (count <= 0) return;
    const ring = () => {
      if (still.current) return;
      angle.stopAnimation();
      Animated.sequence(SWING.map((to, i) => Animated.timing(angle, {
        toValue: to, duration: i === 0 ? 110 : 150, easing: Easing.inOut(Easing.sin), useNativeDriver: true,
      }))).start();
    };
    const first = setTimeout(ring, 350);
    const loop = setInterval(ring, EVERY_MS);
    return () => { clearTimeout(first); clearInterval(loop); angle.stopAnimation(); angle.setValue(0); };
  }, [count, angle]);

  const rotate = angle.interpolate({ inputRange: [-20, 20], outputRange: ['-20deg', '20deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }], transformOrigin: 'top' }}>
      <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={size} color="#fff" />
    </Animated.View>
  );
}
