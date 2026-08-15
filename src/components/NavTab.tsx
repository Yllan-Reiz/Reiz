import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { s } from '../styles';

export function NavTab({ icon, active, onPress, badge }: { icon: any; label?: string; active: boolean; onPress: () => void; badge?: number }) {
  return (
    <TouchableOpacity style={s.navItem} onPress={onPress} activeOpacity={0.7}>
      {/* L'icône occupe l'espace mais devient transparente quand actif : le bubble flottant la remplace */}
      {/* Sur du verre, un gris plat se noie : on prend le gris "label secondaire" d'iOS. */}
      <Ionicons name={icon} size={22} color={active ? 'transparent' : 'rgba(235,235,245,0.62)'} />
      {!!badge && badge > 0 && (
        <View style={s.navBadge}><Text style={s.navBadgeText}>{badge > 9 ? '9+' : badge}</Text></View>
      )}
    </TouchableOpacity>
  );
}
