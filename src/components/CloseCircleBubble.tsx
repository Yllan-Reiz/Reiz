import { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { Faces } from './CloseCircleCard';
import { useCloseCircle } from '../lib/closeCircle';
import { GUTTER } from '../constants';
import { F } from '../styles';
import { t } from '../i18n';

// Sur TON profil : qui est dans ton cercle proche, et le bouton pour le gérer. Même DA que les autres
// bulles de verre du profil. Quand le cercle est vide, elle explique à quoi il sert.
export function CloseCircleBubble({ onManage, reloadKey }: { onManage: () => void; reloadKey?: unknown }) {
  const { list, reload } = useCloseCircle();
  // La feuille de gestion vient de se fermer : on relit.
  useEffect(() => { reload(true); }, [reloadKey, reload]);
  if (list === null) return null;
  const empty = list.length === 0;
  return (
    <GlassSurface radius={28} style={{ marginHorizontal: GUTTER, marginTop: 14 }}>
      <View style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="star" size={13} color="rgba(255,255,255,0.55)" />
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('closeCard.myCircle')}</Text>
        </View>
        {empty ? (
          <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22, fontFamily: F.regular, marginTop: 10 }}>
            {t('closeCard.bubbleEmpty')}
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <Faces people={list} size={40} />
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: F.semibold }}>{list.length} {list.length > 1 ? 'proches' : 'proche'}</Text>
          </View>
        )}
        <TouchableOpacity onPress={onManage} activeOpacity={0.85} style={{ backgroundColor: empty ? '#fff' : 'rgba(255,255,255,0.14)', borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginTop: 14 }}>
          <Text style={{ color: empty ? '#000' : '#fff', fontSize: 14, fontFamily: F.extrabold }}>{empty ? t('closeCard.choose') : t('closeCard.manage')}</Text>
        </TouchableOpacity>
      </View>
    </GlassSurface>
  );
}
