import { Text, TouchableOpacity, Alert, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SPORTS } from './SportCarousel';
import { F } from '../styles';

// Le sport du profil (choisi à l'accueil) : une pastille sous le nom. Sur TON profil, la toucher permet de le changer.

export const sportName = (id?: string | null) => SPORTS.find(s => s.id === id)?.name ?? null;

export function SportBadge({ sport, editable, onChange }: { sport?: string | null; editable?: boolean; onChange?: (id: string | null) => void }) {
  const sp = SPORTS.find(s => s.id === sport);
  if (!sp && !editable) return null;

  const choose = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert('Ton sport', 'Il apparaît sur ton profil et aide les gens qui font le même sport à te trouver.', [
      ...SPORTS.filter(s => s.id !== 'autre').map(s => ({ text: s.id === sport ? `${s.name} ✓` : s.name, onPress: () => onChange?.(s.id) })),
      ...(sp ? [{ text: 'Retirer', style: 'destructive' as const, onPress: () => onChange?.(null) }] : []),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  return (
    <TouchableOpacity onPress={editable ? choose : undefined} disabled={!editable} activeOpacity={0.8} accessibilityRole={editable ? 'button' : undefined} accessibilityLabel={sp ? `Sport : ${sp.name}${editable ? ', changer' : ''}` : 'Ajouter ton sport'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, height: 32, borderRadius: 16, paddingLeft: sp ? 4 : 14, paddingRight: 14, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
      {sp && <Image source={sp.photo} style={{ width: 24, height: 24, borderRadius: 12 }} />}
      <Text style={{ color: '#fff', fontSize: 13, fontFamily: F.bold }}>{sp && sp.id !== 'autre' ? sp.name : sp ? 'Autre sport' : '+ Ton sport'}</Text>
    </TouchableOpacity>
  );
}
