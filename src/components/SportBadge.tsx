import { Text, TouchableOpacity, Alert, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SPORTS } from './SportCarousel';
import { F } from '../styles';
import { t } from '../i18n';

// Le sport du profil (choisi à l'accueil) : une pastille sous le nom. Sur TON profil, la toucher permet de le changer.

export const sportName = (id?: string | null) => SPORTS.find(s => s.id === id)?.name ?? null;

export function SportBadge({ sport, editable, onChange }: { sport?: string | null; editable?: boolean; onChange?: (id: string | null) => void }) {
  const sp = SPORTS.find(s => s.id === sport);
  if (!sp && !editable) return null;

  const choose = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(t('sportBadge.title'), t('sportBadge.text'), [
      ...SPORTS.filter(s => s.id !== 'autre').map(s => ({ text: s.id === sport ? `${s.name} ✓` : s.name, onPress: () => onChange?.(s.id) })),
      ...(sp ? [{ text: t('common.remove'), style: 'destructive' as const, onPress: () => onChange?.(null) }] : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  return (
    <TouchableOpacity onPress={editable ? choose : undefined} disabled={!editable} activeOpacity={0.8} accessibilityRole={editable ? 'button' : undefined} accessibilityLabel={sp ? t(editable ? 'sportBadge.a11yEdit' : 'sportBadge.a11y', { name: sp.name }) : t('sportBadge.add')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, height: 32, borderRadius: 16, paddingLeft: sp ? 4 : 14, paddingRight: 14, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
      {sp && <Image source={sp.photo} style={{ width: 24, height: 24, borderRadius: 12 }} />}
      <Text style={{ color: '#fff', fontSize: 13, fontFamily: F.bold }}>{sp && sp.id !== 'autre' ? sp.name : sp ? t('sportBadge.other') : t('sportBadge.yourSport')}</Text>
    </TouchableOpacity>
  );
}
