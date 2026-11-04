import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface } from './GlassSurface';
import { AUTO_SUPPORTED, isAutoEnabled, loadPlaces } from '../lib/presence';
import { GUTTER } from '../constants';
import { F } from '../styles';
import { t, tp } from '../i18n';

// Sur TON profil : la détection de ta salle, visible sans fouiller les Réglages (un pote de Yllan ne la trouvait pas,
// 04/11/2026). Même bulle de verre que le cercle proche. Un tap ouvre directement « Salle et lieux ».
export function PresenceBubble({ onOpen, reloadKey }: { onOpen: () => void; reloadKey?: unknown }) {
  const [state, setState] = useState<{ auto: boolean; places: number } | null>(null);
  const reload = useCallback(async () => {
    if (!AUTO_SUPPORTED) { setState({ auto: false, places: 0 }); return; }
    const [auto, places] = await Promise.all([isAutoEnabled(), loadPlaces()]);
    setState({ auto, places: places.length });
  }, []);
  useEffect(() => { reload().catch(() => {}); }, [reload, reloadKey]);
  // Retour des Réglages iPhone (autorisation changée) : on relit.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') reload().catch(() => {}); });
    return () => sub.remove();
  }, [reload]);
  if (!state || !AUTO_SUPPORTED) return null;
  const ready = state.auto && state.places > 0;
  return (
    <GlassSurface radius={28} style={{ marginHorizontal: GUTTER, marginTop: 14 }}>
      <TouchableOpacity onPress={onOpen} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('profile.locationLabel')} style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="location" size={13} color="rgba(255,255,255,0.55)" />
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>{t('profile.locationLabel')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ready ? '#fff' : 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={ready ? 'location' : 'location-outline'} size={22} color={ready ? '#000' : '#fff'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>{ready ? t('profile.locationOn') : t('profile.locationOff')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, marginTop: 2 }}>
              {ready ? tp('profile.locationPlaces', state.places) : t('profile.locationOffSub')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
        </View>
        {!ready && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginTop: 14 }}>
            <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>{t('profile.locationSetup')}</Text>
          </View>
        )}
      </TouchableOpacity>
    </GlassSurface>
  );
}
