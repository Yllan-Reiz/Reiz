import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, Alert, Linking, ActivityIndicator, AppState, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassSurface } from './GlassSurface';
import {
  Place, PermState, loadPlaces, isAutoEnabled, permissionState, setAutoEnabled, addPlaceHere, removePlace,
  announcePresence, ANNOUNCE_MESSAGES, AUTO_CONSENT, MAX_PLACES, COOLDOWN_HOURS, AUTO_SUPPORTED,
} from '../lib/presence';
import { F } from '../styles';
import { t } from '../i18n';

// Réglages > « Prévenir mon cercle proche ». Rien ne démarre sans un « Continuer » explicite
// de l'utilisateur : l'écran d'explication passe AVANT la demande d'autorisation du système.
export function PresencePanel() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [auto, setAuto] = useState(false);
  const [perm, setPerm] = useState<PermState | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!AUTO_SUPPORTED) return; // Android : pas de lieux ni de détection, seulement le bouton manuel
    setPlaces(await loadPlaces());
    setAuto(await isAutoEnabled());
    setPerm(await permissionState());
  }, []);
  useEffect(() => {
    reload();
    // Retour depuis les réglages iPhone : on relit l'autorisation.
    const sub = AppState.addEventListener('change', st => { if (st === 'active') reload(); });
    return () => sub.remove();
  }, [reload]);

  const openSettings = () => Linking.openSettings().catch(() => {});

  const toggleAuto = (next: boolean) => {
    if (!next) { setAutoEnabled(false).then(reload); return; }
    // Consentement : on explique d'abord, le système demande ensuite.
    Alert.alert(
      ...AUTO_CONSENT,
      [
        { text: t('common.notNow'), style: 'cancel' },
        {
          text: t('common.continue'),
          onPress: async () => {
            const r = await setAutoEnabled(true);
            await reload();
            if (r === 'denied') {
              Alert.alert(t('presenceCard.permRefusedTitle'), t('presenceCard.permRefusedText'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.openSettings'), onPress: openSettings },
              ]);
            }
          },
        },
      ],
    );
  };

  const addHere = async () => {
    setBusy(true);
    try {
      await addPlaceHere(label);
      setLabel('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Un lieu enregistré mais une détection coupée ne prévient personne : on propose de l'activer.
      if (!auto) toggleAuto(true);
    } catch (e: any) {
      if (e?.message === 'denied') {
        Alert.alert(t('presenceCard.locRefusedTitle'), t('presenceCard.locRefusedText'), [
          { text: t('common.cancel'), style: 'cancel' }, { text: t('common.openSettings'), onPress: openSettings },
        ]);
      } else if (e?.message === 'max') {
        Alert.alert(t('presenceCard.placesTitle'), t('presencePanel.placesMax', { n: MAX_PLACES }));
      } else {
        Alert.alert(t('common.error'), t('presenceCard.noPosition'));
      }
    }
    setBusy(false);
    reload();
  };

  const delPlace = (p: Place) =>
    Alert.alert(t('presencePanel.deleteTitle', { label: p.label }), t('presencePanel.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await removePlace(p.id); reload(); } },
    ]);

  const notifyNow = async () => {
    const r = await announcePresence(t('presence.defaultPlace'), 'manual');
    Alert.alert(...ANNOUNCE_MESSAGES[r]);
  };

  const needsAlways = auto && perm && perm.bg !== 'granted';

  return (
    <View style={{ padding: 16, paddingBottom: 40 }}>
      <GlassSurface radius={24}>
        <View style={{ padding: 18 }}>
          <Text style={{ color: '#fff', fontSize: 19, fontFamily: F.black, letterSpacing: -0.4 }}>{t('presencePanel.title')}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 21, fontFamily: F.regular, marginTop: 8 }}>
            {t('presencePanel.intro')}
          </Text>
          {(AUTO_SUPPORTED ? [
            t('presencePanel.optional'),
            t('presenceCard.promise1'),
            t('presenceCard.promise2', { n: COOLDOWN_HOURS }),
            t('presencePanel.canDisable'),
          ] : [
            t('presencePanel.simpleButton'),
            t('presenceCard.promise2', { n: COOLDOWN_HOURS }),
          ]).map(line => (
            <View key={line} style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: '#ddd', fontSize: 13, lineHeight: 19, fontFamily: F.regular }}>{line}</Text>
            </View>
          ))}
        </View>
      </GlassSurface>

      {AUTO_SUPPORTED && (<>
      <View style={{ marginTop: 20, backgroundColor: '#111', borderRadius: 18, borderWidth: 1, borderColor: '#1c1c1c', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
          <Ionicons name="location-outline" size={20} color="#bbb" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.semibold }}>{t('presencePanel.autoDetection')}</Text>
            <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular, marginTop: 2 }}>{auto ? t('presencePanel.on') : t('presencePanel.off')}</Text>
          </View>
          <Switch value={auto} onValueChange={toggleAuto} trackColor={{ true: '#fff', false: '#333' }} thumbColor={auto ? '#000' : '#999'} ios_backgroundColor="#333" />
        </View>
        {needsAlways && (
          <TouchableOpacity onPress={openSettings} style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={{ color: '#ff9f43', fontSize: 13, lineHeight: 19, fontFamily: F.semibold }}>
              {t('presencePanel.needAlways')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={{ fontSize: 11, color: '#777', fontFamily: F.bold, letterSpacing: 1.5, marginTop: 24, marginBottom: 8, marginLeft: 4 }}>{t('presencePanel.myPlaces')}</Text>
      <View style={{ backgroundColor: '#111', borderRadius: 18, borderWidth: 1, borderColor: '#1c1c1c', overflow: 'hidden' }}>
        {places.length === 0 && (
          <Text style={{ color: '#777', fontSize: 13, lineHeight: 19, padding: 16, fontFamily: F.regular }}>
            {t('presencePanel.noPlaces')}
          </Text>
        )}
        {places.map((p, i) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: i ? 1 : 0, borderTopColor: '#1c1c1c' }}>
            <Ionicons name="location" size={18} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.semibold }}>{p.label}</Text>
              <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular }}>{t('presencePanel.radius', { n: p.radius })}</Text>
            </View>
            <TouchableOpacity onPress={() => delPlace(p)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('presencePanel.deleteA11y', { label: p.label })}>
              <Ionicons name="trash-outline" size={18} color="#ff453a" />
            </TouchableOpacity>
          </View>
        ))}
        <View style={{ padding: 16, borderTopWidth: places.length ? 1 : 0, borderTopColor: '#1c1c1c', gap: 10 }}>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={t('presencePanel.placeholder')}
            placeholderTextColor="#666"
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={{ backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 13, fontSize: 14, color: '#fff', fontFamily: F.regular }}
          />
          <TouchableOpacity onPress={busy ? undefined : addHere} activeOpacity={0.85} style={{ backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>{t('presencePanel.addHere')}</Text>}
          </TouchableOpacity>
        </View>
      </View>
      </>)}

      <TouchableOpacity onPress={notifyNow} activeOpacity={0.85} style={{ marginTop: 20 }}>
        <GlassSurface radius={18}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
            <Text style={{ fontSize: 20 }}>💪</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>{t('presencePanel.notifyNow')}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F.regular, marginTop: 2 }}>{t('presencePanel.notifyNowSub')}</Text>
            </View>
          </View>
        </GlassSurface>
      </TouchableOpacity>
    </View>
  );
}
