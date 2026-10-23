import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, Alert, Linking, AppState, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSurface } from './GlassSurface';
import { GlassIconButton } from './ProfileSections';
import { PresencePanel } from './PresencePanel';
import { supabase } from '../lib/supabase';
import {
  Place, PermState, loadPlaces, isAutoEnabled, permissionState, setAutoEnabled, addPlaceHere,
  announcePresence, ANNOUNCE_MESSAGES, AUTO_CONSENT, MAX_PLACES, COOLDOWN_HOURS, AUTO_SUPPORTED,
} from '../lib/presence';
import { F } from '../styles';
import { t, tl } from '../i18n';

// ============================================================
// « À la salle » : la carte du fil qui met en avant l'alerte au cercle proche.
// Même DA que le profil (verre, petit titre en capitales, gros titre, boutons blancs).
// Elle change selon l'état de la détection automatique :
//   setup      aucun lieu enregistré : « Ajouter ma salle » (parcours guidé en une fois)
//   enable     un lieu est enregistré mais la détection est coupée
//   permission la détection est activée mais iOS n'a pas accordé « Toujours »
//   active     tout est en place : le cercle est prévenu à l'arrivée
//   manual     Android : seulement le bouton « Je suis à la salle »
// ============================================================

const label = { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 } as const;
const title = { color: '#fff', fontSize: 24, fontFamily: F.black, letterSpacing: -0.6, marginTop: 10 } as const;
const body = { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 21, fontFamily: F.regular, marginTop: 8 } as const;
const warning = { color: '#ff9f43', fontSize: 13, lineHeight: 19, fontFamily: F.semibold, marginTop: 12 } as const;

function Btn({ text, onPress, secondary, busy }: { text: string; onPress: () => void; secondary?: boolean; busy?: boolean }) {
  return (
    <TouchableOpacity
      onPress={busy ? undefined : onPress}
      activeOpacity={0.85}
      style={{ flex: 1, backgroundColor: secondary ? 'rgba(255,255,255,0.14)' : '#fff', borderRadius: 16, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' }}
    >
      {busy
        ? <ActivityIndicator color={secondary ? '#fff' : '#000'} size="small" />
        : <Text style={{ color: secondary ? '#fff' : '#000', fontSize: 14, fontFamily: F.extrabold }}>{text}</Text>}
    </TouchableOpacity>
  );
}

function PlaceChips({ places }: { places: Place[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {places.map(p => (
        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 15, paddingHorizontal: 12, height: 30 }}>
          <Ionicons name="location" size={13} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 13, fontFamily: F.semibold }}>{p.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function PresenceCard({ compact }: { compact?: boolean } = {}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [auto, setAuto] = useState(false);
  const [perm, setPerm] = useState<PermState | null>(null);
  const [circle, setCircle] = useState<number | null>(null); // nombre d'amis dans le cercle proche
  const [sheet, setSheet] = useState<'none' | 'add' | 'manage'>('none');

  const reload = useCallback(async () => {
    if (AUTO_SUPPORTED) {
      setPlaces(await loadPlaces());
      setAuto(await isAutoEnabled());
      setPerm(await permissionState());
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { count } = await supabase.from('close_friends').select('id', { count: 'exact', head: true }).eq('owner_id', session.user.id);
      setCircle(count || 0);
    }
  }, []);

  useEffect(() => {
    reload();
    // Retour depuis les réglages iPhone ou depuis une autre page : on relit l'état.
    const sub = AppState.addEventListener('change', st => { if (st === 'active') reload(); });
    return () => sub.remove();
  }, [reload]);

  const openSettings = () => Linking.openSettings().catch(() => {});
  const closeSheet = () => { setSheet('none'); reload(); };

  // Bouton manuel : un tap prévient le cercle proche, avec le choix du lieu si plusieurs sont enregistrés.
  const send = async (where: string) => Alert.alert(...ANNOUNCE_MESSAGES[await announcePresence(where, 'manual')]);
  const manual = async () => {
    const saved = await loadPlaces();
    if (saved.length === 0) {
      Alert.alert(t('presenceCard.askTitle'), t('presenceCard.askText'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('presenceCard.imAtGym'), onPress: () => send(t('presence.defaultPlace')) },
      ]);
      return;
    }
    Alert.alert(t('presenceCard.whereTitle'), t('presenceCard.whereText'), [
      ...saved.map(p => ({ text: p.label, onPress: () => send(p.label) })),
      { text: t('presenceCard.elsewhere'), onPress: () => send(t('presence.defaultPlace')) },
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  // Activer la détection quand un lieu existe déjà : consentement d'abord, autorisations du système ensuite.
  const enable = () => {
    Alert.alert(...AUTO_CONSENT, [
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
    ]);
  };

  const detecting = AUTO_SUPPORTED && auto && places.length > 0;
  const kind: 'setup' | 'enable' | 'permission' | 'active' | 'manual' =
    !AUTO_SUPPORTED ? 'manual'
      : detecting ? (perm && perm.bg !== 'granted' ? 'permission' : 'active')
        : places.length > 0 ? 'enable' : 'setup';
  const names = places.map(p => p.label).join(t('presenceCard.orSep'));

  // Version courte (onglet Activité) : une ligne et un seul bouton, selon l'état.
  if (compact) {
    const c = {
      setup: { title: t('presenceCard.cSetupT'), sub: t('presenceCard.cSetupSub'), btn: t('presenceCard.cSetupBtn'), go: () => setSheet('add') },
      enable: { title: t('presenceCard.cEnableT'), sub: t('presenceCard.cEnableSub', { names }), btn: t('presenceCard.cEnableBtn'), go: enable },
      permission: { title: t('presenceCard.cPermT'), sub: t('presenceCard.cPermSub'), btn: t('presenceCard.cPermBtn'), go: openSettings },
      active: { title: t('presenceCard.detectionOn'), sub: names, btn: t('presenceCard.cActiveBtn'), go: manual },
      manual: { title: t('presenceCard.cManualT'), sub: t('presenceCard.cManualSub'), btn: t('presenceCard.cManualBtn'), go: manual },
    }[kind];
    return (
      <>
        <TouchableOpacity activeOpacity={0.85} disabled={kind !== 'active'} onPress={() => setSheet('manage')} accessibilityLabel={kind === 'active' ? t('presenceCard.manageA11y') : undefined}>
          <GlassSurface radius={22} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: kind === 'active' ? '#fff' : 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="location" size={18} color={kind === 'active' ? '#000' : '#fff'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }} numberOfLines={1}>{c.title}</Text>
                <Text style={{ color: circle === 0 ? '#ff9f43' : 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F.regular, marginTop: 1 }} numberOfLines={1}>
                  {circle === 0 ? t('presence.noCircleTitle') : c.sub}
                </Text>
              </View>
              <TouchableOpacity onPress={c.go} activeOpacity={0.85} style={{ height: 34, borderRadius: 17, paddingHorizontal: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#000', fontSize: 13, fontFamily: F.extrabold }}>{c.btn}</Text>
              </TouchableOpacity>
            </View>
          </GlassSurface>
        </TouchableOpacity>
        <PlaceSheet visible={sheet === 'add'} circle={circle} onClose={closeSheet} />
        <ManageSheet visible={sheet === 'manage'} onClose={closeSheet} />
      </>
    );
  }

  return (
    <>
      <GlassSurface radius={28} style={{ marginBottom: 14 }}>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location" size={13} color="rgba(255,255,255,0.55)" />
              <Text style={label}>{t('presenceCard.label')}</Text>
            </View>
            {kind === 'active' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, paddingHorizontal: 10, height: 26 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                <Text style={{ color: '#fff', fontSize: 12, fontFamily: F.bold }}>{t('presenceCard.detectionOn')}</Text>
              </View>
            )}
          </View>

          {kind === 'setup' && (
            <>
              <Text style={title}>{t('presenceCard.setupTitle')}</Text>
              <Text style={body}>{t('presenceCard.setupBody')}</Text>
            </>
          )}
          {kind === 'enable' && (
            <>
              <Text style={title}>{t('presenceCard.enableTitle')}</Text>
              <Text style={body}>{t('presenceCard.enableBody', { names })}</Text>
              <PlaceChips places={places} />
            </>
          )}
          {kind === 'permission' && (
            <>
              <Text style={title}>{t('presenceCard.permTitle')}</Text>
              <Text style={body}>{t('presenceCard.permBody')}</Text>
              <PlaceChips places={places} />
            </>
          )}
          {kind === 'active' && (
            <>
              <Text style={title}>{t('presenceCard.activeTitle')}</Text>
              <Text style={body}>{t('presenceCard.activeBody', { names, n: COOLDOWN_HOURS })}</Text>
              <PlaceChips places={places} />
            </>
          )}
          {kind === 'manual' && (
            <>
              <Text style={title}>{t('presenceCard.manualTitle')}</Text>
              <Text style={body}>{t('presenceCard.manualBody')}</Text>
            </>
          )}

          {circle === 0 && (
            <Text style={warning}>{t('presenceCard.emptyCircleWarning')}</Text>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            {kind === 'setup' && <><Btn text={t('presenceCard.addGym')} onPress={() => setSheet('add')} /><Btn text={t('presenceCard.imAtGym')} secondary onPress={manual} /></>}
            {kind === 'enable' && <><Btn text={t('welcome.enableDetection')} onPress={enable} /><Btn text={t('presenceCard.imAtGym')} secondary onPress={manual} /></>}
            {kind === 'permission' && <><Btn text={t('common.openSettings')} onPress={openSettings} /><Btn text={t('presenceCard.imAtGym')} secondary onPress={manual} /></>}
            {kind === 'active' && <><Btn text={t('presenceCard.imAtGym')} onPress={manual} /><Btn text={t('presenceCard.manage')} secondary onPress={() => setSheet('manage')} /></>}
            {kind === 'manual' && <Btn text={t('presenceCard.imAtGym')} onPress={manual} />}
          </View>
        </View>
      </GlassSurface>

      <PlaceSheet visible={sheet === 'add'} circle={circle} onClose={closeSheet} />
      <ManageSheet visible={sheet === 'manage'} onClose={closeSheet} />
    </>
  );
}

const SUGGESTIONS = ['Basic-Fit', 'Fitness Park', t('welcome.myGym'), t('presenceCard.stadium')];

/** Parcours guidé : se placer dans la salle, la nommer, tout activer en une fois. */
function PlaceSheet({ visible, circle, onClose }: { visible: boolean; circle: number | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'ok' | 'permission' | null>(null);

  useEffect(() => { if (visible) { setName(''); setDone(null); setBusy(false); } }, [visible]);

  const save = async () => {
    setBusy(true);
    try {
      await addPlaceHere(name);
    } catch (e: any) {
      setBusy(false);
      if (e?.message === 'denied') {
        Alert.alert(t('presenceCard.locRefusedTitle'), t('presenceCard.locRefusedText'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.openSettings'), onPress: () => Linking.openSettings().catch(() => {}) },
        ]);
      } else if (e?.message === 'max') {
        Alert.alert(t('presenceCard.placesTitle'), t('presenceCard.placesMax', { n: MAX_PLACES }));
      } else {
        Alert.alert(t('common.error'), t('presenceCard.noPosition'));
      }
      return;
    }
    // Le lieu est enregistré : on active la détection, qui demande « Toujours » au système.
    const r = await setAutoEnabled(true);
    setBusy(false);
    Haptics.notificationAsync(r === 'ok' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setDone(r === 'ok' ? 'ok' : 'permission');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16, paddingBottom: 0 }}>
          <GlassIconButton icon="close" label={t('common.close')} onPress={onClose} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {done === null ? (
            <>
              <Text style={{ color: '#fff', fontSize: 30, fontFamily: F.black, letterSpacing: -0.9 }}>{t('presenceCard.addGym')}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 23, fontFamily: F.regular, marginTop: 10 }}>
                {t('presenceCard.addGymBody')}
              </Text>

              <View style={{ marginTop: 22, gap: 14 }}>
                {tl('presenceCard.addGymSteps').map((step, i) => (
                  <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontFamily: F.black }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, color: '#ddd', fontSize: 14, lineHeight: 20, fontFamily: F.regular }}>{step}</Text>
                  </View>
                ))}
              </View>

              <Text style={{ fontSize: 11, color: '#777', fontFamily: F.bold, letterSpacing: 1.5, marginTop: 26, marginBottom: 8 }}>{t('presenceCard.placeNameLabel')}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('presenceCard.placeNamePlaceholder')}
                placeholderTextColor="#666"
                maxLength={40}
                returnKeyType="done"
                style={{ backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, fontSize: 15, color: '#fff', fontFamily: F.regular }}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {SUGGESTIONS.map(s => (
                  <TouchableOpacity key={s} onPress={() => setName(s)} activeOpacity={0.8} style={{ backgroundColor: name === s ? '#fff' : 'rgba(255,255,255,0.14)', borderRadius: 15, paddingHorizontal: 14, height: 30, justifyContent: 'center' }}>
                    <Text style={{ color: name === s ? '#000' : '#fff', fontSize: 13, fontFamily: F.semibold }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <GlassSurface radius={22} style={{ marginTop: 24 }}>
                <View style={{ padding: 16, gap: 10 }}>
                  {[t('presenceCard.promise1'), t('presenceCard.promise2', { n: COOLDOWN_HOURS }), t('presenceCard.promise3')].map(line => (
                    <View key={line} style={{ flexDirection: 'row', gap: 10 }}>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginTop: 1 }} />
                      <Text style={{ flex: 1, color: '#ddd', fontSize: 13, lineHeight: 19, fontFamily: F.regular }}>{line}</Text>
                    </View>
                  ))}
                </View>
              </GlassSurface>

              {circle === 0 && (
                <Text style={{ color: '#ff9f43', fontSize: 13, lineHeight: 19, fontFamily: F.semibold, marginTop: 16 }}>
                  {t('presenceCard.emptyCircleWarning')}
                </Text>
              )}

              <TouchableOpacity onPress={busy ? undefined : save} activeOpacity={0.85} style={{ backgroundColor: '#fff', borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 24 }}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 15, fontFamily: F.extrabold }}>{t('presenceCard.allowAndSave')}</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: 50 }}>
              <GlassSurface radius={45} style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={done === 'ok' ? 'checkmark' : 'location'} size={40} color="#fff" />
              </GlassSurface>
              <Text style={{ color: '#fff', fontSize: 28, fontFamily: F.black, letterSpacing: -0.8, marginTop: 22, textAlign: 'center' }}>
                {t('presenceCard.savedTitle')}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 23, fontFamily: F.regular, marginTop: 12, textAlign: 'center', paddingHorizontal: 12 }}>
                {done === 'ok'
                  ? t('presenceCard.savedOk')
                  : t('presenceCard.savedNoAlways')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 28, alignSelf: 'stretch' }}>
                {done === 'permission' && <Btn text={t('common.openSettings')} onPress={() => Linking.openSettings().catch(() => {})} />}
                <Btn text={done === 'ok' ? t('common.done') : t('common.later')} secondary={done === 'permission'} onPress={onClose} />
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** « Gérer » : le panneau complet des Réglages (lieux, interrupteur, bouton manuel), sans quitter le fil. */
function ManageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16, paddingBottom: 0 }}>
          <GlassIconButton icon="close" label={t('common.close')} onPress={onClose} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingBottom: insets.bottom }} showsVerticalScrollIndicator={false}>
          <PresencePanel />
        </ScrollView>
      </View>
    </Modal>
  );
}
