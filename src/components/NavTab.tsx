import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEATURES } from '../lib/features';
import { s, F } from '../styles';

// Le mot sous l'icône (essai du 19/11/2026, FEATURES.navLabels). Même style dans l'onglet et dans la pastille active.
export const navLabelStyle = { fontSize: 10, lineHeight: 12, fontFamily: F.bold, letterSpacing: 0.1 } as const;

export function NavTab({ icon, label, active, onPress, badge }: { icon: any; label?: string; active: boolean; onPress: () => void; badge?: number }) {
  // Sur du verre, un gris plat se noie : on prend le gris "label secondaire" d'iOS.
  const color = active ? 'transparent' : 'rgba(235,235,245,0.62)';
  return (
    // Le libellé sert aussi à VoiceOver et TalkBack, qui ne lisaient que « bouton » (les icônes n'ont pas de nom).
    <TouchableOpacity style={[s.navItem, !!badge && badge > 0 && { zIndex: 3 }]} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}>
      {/* L'icône occupe l'espace mais devient transparente quand actif : le bubble flottant la remplace */}
      <Ionicons name={icon} size={22} color={color} />
      {FEATURES.navLabels && !!label && <Text style={[navLabelStyle, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.15}>{label}</Text>}
      {!!badge && badge > 0 && (
        <View style={s.navBadge}><Text style={s.navBadgeText}>{badge > 9 ? '9+' : badge}</Text></View>
      )}
    </TouchableOpacity>
  );
}
