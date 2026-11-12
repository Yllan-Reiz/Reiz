import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFlame } from '../lib/flames';

// La flamme rouge de ceux qui ont validé leur semaine (lib/flames.ts).
export const FLAME_RED = '#ff3b30';

/**
 * En pastille sur le coin d'une photo de profil. À poser dans le même conteneur que la photo, juste après elle :
 *   <View><Photo /><FlameBadge userId={id} size={40} /></View>
 * `size` : le diamètre de la photo. Rien ne s'affiche sans flamme.
 */
export function FlameBadge({ userId, size, ring = '#0a0a0a', corner = 'bottom' }: {
  userId?: string | null;
  size: number;
  ring?: string;
  /** 'top' : en haut à droite, quand le bas de la photo porte déjà une pastille (écran Activité). */
  corner?: 'bottom' | 'top';
}) {
  const on = useFlame(userId);
  if (!on) return null;
  const d = Math.max(16, Math.round(size * 0.46));
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no"
      style={{ position: 'absolute', right: -Math.round(d * 0.22), [corner]: -Math.round(d * 0.22), width: d, height: d, borderRadius: d / 2, backgroundColor: ring, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="flame" size={Math.round(d * 0.74)} color={FLAME_RED} />
    </View>
  );
}

/** À côté d'un prénom (grands profils, où la photo occupe tout le haut de l'écran). */
export function FlameInline({ userId, size }: { userId?: string | null; size: number }) {
  const on = useFlame(userId);
  if (!on) return null;
  return <Ionicons name="flame" size={size} color={FLAME_RED} />;
}
