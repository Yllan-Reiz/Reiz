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

export function PresenceCard() {
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
      Alert.alert('Prévenir ton cercle proche ?', 'Ils recevront une alerte : tu es à la salle, ils peuvent venir te rejoindre.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Je suis à la salle', onPress: () => send('la salle') },
      ]);
      return;
    }
    Alert.alert('Où es-tu ?', 'Ton cercle proche sera prévenu.', [
      ...saved.map(p => ({ text: p.label, onPress: () => send(p.label) })),
      { text: 'Un autre endroit', onPress: () => send('la salle') },
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };

  // Activer la détection quand un lieu existe déjà : consentement d'abord, autorisations du système ensuite.
  const enable = () => {
    Alert.alert(...AUTO_CONSENT, [
      { text: 'Pas maintenant', style: 'cancel' },
      {
        text: 'Continuer',
        onPress: async () => {
          const r = await setAutoEnabled(true);
          await reload();
          if (r === 'denied') {
            Alert.alert('Autorisation refusée', 'Pour activer la détection, choisis « Toujours » dans les réglages de localisation de Reiz.', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Ouvrir les réglages', onPress: openSettings },
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
  const names = places.map(p => p.label).join(' ou ');

  return (
    <>
      <GlassSurface radius={28} style={{ marginBottom: 14 }}>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location" size={13} color="rgba(255,255,255,0.55)" />
              <Text style={label}>À LA SALLE</Text>
            </View>
            {kind === 'active' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, paddingHorizontal: 10, height: 26 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                <Text style={{ color: '#fff', fontSize: 12, fontFamily: F.bold }}>Détection activée</Text>
              </View>
            )}
          </View>

          {kind === 'setup' && (
            <>
              <Text style={title}>Préviens ton cercle quand tu arrives</Text>
              <Text style={body}>Enregistre ta salle une fois. Quand tu y retournes, ton cercle proche reçoit une notification, sans rien toucher.</Text>
            </>
          )}
          {kind === 'enable' && (
            <>
              <Text style={title}>Plus qu'une étape</Text>
              <Text style={body}>{names} est enregistrée. Active la détection pour que ton cercle soit prévenu à ton arrivée.</Text>
              <PlaceChips places={places} />
            </>
          )}
          {kind === 'permission' && (
            <>
              <Text style={title}>Une autorisation manque</Text>
              <Text style={body}>Choisis « Toujours » dans les réglages de localisation de Reiz, sinon la détection ne marche pas quand l'appli est fermée.</Text>
              <PlaceChips places={places} />
            </>
          )}
          {kind === 'active' && (
            <>
              <Text style={title}>Ton cercle te voit arriver</Text>
              <Text style={body}>Quand tu arrives à {names}, ton cercle proche est prévenu. Une alerte toutes les {COOLDOWN_HOURS} heures au maximum.</Text>
              <PlaceChips places={places} />
            </>
          )}
          {kind === 'manual' && (
            <>
              <Text style={title}>Préviens ton cercle proche</Text>
              <Text style={body}>Un tap et ils savent que tu t'entraînes. Ils peuvent venir te rejoindre.</Text>
            </>
          )}

          {circle === 0 && (
            <Text style={warning}>Ton cercle proche est vide : personne ne recevra l'alerte. Ajoute des amis dans Réglages, Mon cercle proche.</Text>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            {kind === 'setup' && <><Btn text="Ajouter ma salle" onPress={() => setSheet('add')} /><Btn text="Je suis à la salle" secondary onPress={manual} /></>}
            {kind === 'enable' && <><Btn text="Activer la détection" onPress={enable} /><Btn text="Je suis à la salle" secondary onPress={manual} /></>}
            {kind === 'permission' && <><Btn text="Ouvrir les réglages" onPress={openSettings} /><Btn text="Je suis à la salle" secondary onPress={manual} /></>}
            {kind === 'active' && <><Btn text="Je suis à la salle" onPress={manual} /><Btn text="Gérer" secondary onPress={() => setSheet('manage')} /></>}
            {kind === 'manual' && <Btn text="Je suis à la salle" onPress={manual} />}
          </View>
        </View>
      </GlassSurface>

      <PlaceSheet visible={sheet === 'add'} circle={circle} onClose={closeSheet} />
      <ManageSheet visible={sheet === 'manage'} onClose={closeSheet} />
    </>
  );
}

const SUGGESTIONS = ['Basic-Fit', 'Fitness Park', 'Ma salle', 'Stade'];

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
        Alert.alert('Localisation refusée', 'Autorise la localisation de Reiz dans les réglages pour enregistrer ce lieu.', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Ouvrir les réglages', onPress: () => Linking.openSettings().catch(() => {}) },
        ]);
      } else if (e?.message === 'max') {
        Alert.alert('Lieux', `${MAX_PLACES} lieux maximum. Supprime-en un d'abord dans « Gérer ».`);
      } else {
        Alert.alert('Erreur', "Impossible de lire ta position. Réessaie dehors ou près d'une fenêtre.");
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
          <GlassIconButton icon="close" label="Fermer" onPress={onClose} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          {done === null ? (
            <>
              <Text style={{ color: '#fff', fontSize: 30, fontFamily: F.black, letterSpacing: -0.9 }}>Ajouter ma salle</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 23, fontFamily: F.regular, marginTop: 10 }}>
                Enregistre l'endroit où tu es. Quand tu y reviendras, ton cercle proche sera prévenu tout seul, même si l'appli est fermée.
              </Text>

              <View style={{ marginTop: 22, gap: 14 }}>
                {[
                  "Mets-toi à l'intérieur de ta salle ou sur ton terrain.",
                  'Donne-lui un nom.',
                  "Autorise la localisation « Toujours » quand l'iPhone te le demande.",
                ].map((t, i) => (
                  <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontFamily: F.black }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, color: '#ddd', fontSize: 14, lineHeight: 20, fontFamily: F.regular }}>{t}</Text>
                  </View>
                ))}
              </View>

              <Text style={{ fontSize: 11, color: '#777', fontFamily: F.bold, letterSpacing: 1.5, marginTop: 26, marginBottom: 8 }}>NOM DU LIEU</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Basic-Fit, Stade..."
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
                  {[
                    'Tes coordonnées restent sur ton téléphone. Elles ne sont jamais envoyées.',
                    `Seul ton cercle proche est prévenu, une fois toutes les ${COOLDOWN_HOURS} heures au maximum.`,
                    'Tu peux tout couper à tout moment.',
                  ].map(t => (
                    <View key={t} style={{ flexDirection: 'row', gap: 10 }}>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginTop: 1 }} />
                      <Text style={{ flex: 1, color: '#ddd', fontSize: 13, lineHeight: 19, fontFamily: F.regular }}>{t}</Text>
                    </View>
                  ))}
                </View>
              </GlassSurface>

              {circle === 0 && (
                <Text style={{ color: '#ff9f43', fontSize: 13, lineHeight: 19, fontFamily: F.semibold, marginTop: 16 }}>
                  Ton cercle proche est vide : personne ne recevra l'alerte. Ajoute des amis dans Réglages, Mon cercle proche.
                </Text>
              )}

              <TouchableOpacity onPress={busy ? undefined : save} activeOpacity={0.85} style={{ backgroundColor: '#fff', borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginTop: 24 }}>
                {busy ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontSize: 15, fontFamily: F.extrabold }}>Autoriser et enregistrer ma salle</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: 50 }}>
              <GlassSurface radius={45} style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={done === 'ok' ? 'checkmark' : 'location'} size={40} color="#fff" />
              </GlassSurface>
              <Text style={{ color: '#fff', fontSize: 28, fontFamily: F.black, letterSpacing: -0.8, marginTop: 22, textAlign: 'center' }}>
                Ta salle est enregistrée
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, lineHeight: 23, fontFamily: F.regular, marginTop: 12, textAlign: 'center', paddingHorizontal: 12 }}>
                {done === 'ok'
                  ? 'La prochaine fois que tu y arrives, ton cercle proche est prévenu automatiquement.'
                  : "Mais iPhone n'a pas accordé « Toujours » : sans lui, la détection ne marche pas quand l'appli est fermée. Choisis « Toujours » dans les réglages de localisation de Reiz."}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 28, alignSelf: 'stretch' }}>
                {done === 'permission' && <Btn text="Ouvrir les réglages" onPress={() => Linking.openSettings().catch(() => {})} />}
                <Btn text={done === 'ok' ? 'Terminé' : 'Plus tard'} secondary={done === 'permission'} onPress={onClose} />
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
          <GlassIconButton icon="close" label="Fermer" onPress={onClose} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingBottom: insets.bottom }} showsVerticalScrollIndicator={false}>
          <PresencePanel />
        </ScrollView>
      </View>
    </Modal>
  );
}
