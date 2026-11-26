import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, AppState, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassSurface } from './GlassSurface';
import { PresencePanel } from './PresencePanel';
import { supabase } from '../lib/supabase';
import { loadPlaces, AUTO_SUPPORTED } from '../lib/presence';
import { registerForPushNotifications } from '../lib/notifications';
import { track } from '../lib/track';
import { s, F } from '../styles';
import { t, tp, dirIcon } from '../i18n';

// En haut du fil, visible par toi seul : ce qui manque encore à ton profil depuis l'inscription (photo, premier
// objectif, amis, salle, notifications). Chaque ligne mène à l'endroit où le faire. La carte disparaît quand tout
// est fait, et la croix la repousse de 3 jours. Remplace l'ancienne carte « Bienvenue » à 2 étapes (25/10/2026).
// 1.2 : « Publie ton premier post » en tête dès qu'un objectif existe. 20 inscrits sur 30 n'avaient jamais posté
// au 30/10/2026, alors que la carte ne le demandait pas.

type StepId = 'post' | 'photo' | 'objective' | 'friends' | 'place' | 'notifs';
const LATER_MS = 3 * 24 * 3600 * 1000;
const laterKey = (uid: string) => `reiz.setup.later.${uid}`;
// Audit du 20/11/2026 : une fois le profil complet, la carte n'affiche plus rien mais relisait quand même la photo et
// le nombre de posts à chaque ouverture (2 requêtes). On retient « complet » 7 jours sur le téléphone.
const DONE_MS = 7 * 24 * 3600 * 1000;
const doneKey = (uid: string) => `reiz.setup.done.${uid}`;
const ICONS: Record<StepId, keyof typeof Ionicons.glyphMap> = {
  post: 'add-circle-outline', photo: 'camera-outline', objective: 'flag-outline', friends: 'people-outline', place: 'location-outline', notifs: 'notifications-outline',
};

// Carte en blanc (26/11/2026, demande de Yllan : « tu échanges les couleurs et tu changes rien ») : sur le fil noir, elle
// ressort et pousse à compléter son profil. À `false`, l'ancienne carte en verre sombre revient telle quelle.
const SETUP_WHITE = true;
const FG = SETUP_WHITE ? '#000' : '#fff';
const ink = (a: number) => (SETUP_WHITE ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);
function SetupShell({ children }: { children: React.ReactNode }) {
  return SETUP_WHITE
    ? <View style={{ marginBottom: 14, borderRadius: 28, backgroundColor: '#fff', overflow: 'hidden' }}>{children}</View>
    : <GlassSurface radius={28} style={{ marginBottom: 14 }}>{children}</GlassSurface>;
}

export function SetupCard({ userId, hasObjective, friendCount, onPost, onAddPhoto, onAddObjective, onFindFriends }: {
  userId: string | null;
  /** null tant que ce n'est pas chargé : la carte attend pour ne pas clignoter. */
  hasObjective: boolean | null;
  friendCount: number | null;
  onPost: () => void;
  onAddPhoto: () => void;
  onAddObjective: () => void;
  onFindFriends: () => void;
}) {
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);
  const [hasPosted, setHasPosted] = useState<boolean | null>(null);
  const [hasPlace, setHasPlace] = useState<boolean | null>(AUTO_SUPPORTED ? null : true);
  const [notifs, setNotifs] = useState<boolean | null>(null);
  const [later, setLater] = useState<boolean | null>(null);
  const [placeOpen, setPlaceOpen] = useState(false);

  // Ce que le téléphone sait (salle, notifications) se relit au retour dans l'app : l'utilisateur a pu
  // accepter les notifications dans les Réglages de l'iPhone.
  const checkDevice = useCallback(() => {
    if (AUTO_SUPPORTED) loadPlaces().then(p => setHasPlace(p.length > 0)).catch(() => setHasPlace(true));
    Notifications.getPermissionsAsync().then(p => setNotifs(p.status === 'granted')).catch(() => setNotifs(true));
  }, []);

  // null : pas encore su. true : profil déjà complet, rien à lire ni à afficher.
  const [complete, setComplete] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(doneKey(userId)).then(v => setComplete(!!v && Date.now() - Number(v) < DONE_MS), () => setComplete(false));
  }, [userId]);

  useEffect(() => {
    if (!userId || complete !== false) return;
    supabase.from('users').select('avatar_url').eq('id', userId).maybeSingle()
      .then(({ data }) => setHasPhoto(!!data?.avatar_url), () => setHasPhoto(true));
    // Un seul post suffit : la carte est relue à chaque retour sur le fil (Main est remonté après la publication).
    supabase.from('updates').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      .then(({ count, error }) => setHasPosted(error ? true : (count ?? 0) > 0), () => setHasPosted(true));
    AsyncStorage.getItem(laterKey(userId))
      .then(v => setLater(!!v && Date.now() - Number(v) < LATER_MS), () => setLater(false));
    checkDevice();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') checkDevice(); });
    return () => sub.remove();
  }, [userId, checkDevice, complete]);

  const enableNotifs = async () => {
    const cur = await Notifications.getPermissionsAsync().catch(() => null);
    if (cur && cur.status !== 'granted' && !cur.canAskAgain) { Linking.openSettings(); return; }
    const res = await Notifications.requestPermissionsAsync().catch(() => null);
    if (res?.status === 'granted' && userId) registerForPushNotifications(userId);
    checkDevice();
  };

  if (!userId || later !== false || hasObjective === null || friendCount === null || hasPhoto === null || hasPosted === null || hasPlace === null || notifs === null) return null;

  const steps: { id: StepId; done: boolean; onPress: () => void }[] = [
    // Sans objectif il n'y a rien à poster : la ligne arrive une fois l'objectif créé.
    ...(hasObjective ? [{ id: 'post' as const, done: hasPosted, onPress: onPost }] : []),
    { id: 'photo', done: hasPhoto, onPress: onAddPhoto },
    { id: 'objective', done: hasObjective, onPress: onAddObjective },
    { id: 'friends', done: friendCount > 0, onPress: onFindFriends },
    ...(AUTO_SUPPORTED ? [{ id: 'place' as const, done: hasPlace, onPress: () => setPlaceOpen(true) }] : []),
    { id: 'notifs', done: notifs, onPress: enableNotifs },
  ];
  const left = steps.filter(x => !x.done).length;
  if (left === 0) { AsyncStorage.setItem(doneKey(userId), String(Date.now())).catch(() => {}); return null; }
  const doneCount = steps.length - left;

  return (
    <>
      <SetupShell>
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: ink(0.55), fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>
              {t('setup.label', { done: doneCount, total: steps.length })}
            </Text>
            <TouchableOpacity
              onPress={() => { setLater(true); AsyncStorage.setItem(laterKey(userId), String(Date.now())).catch(() => {}); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={t('setup.hide')}
            >
              <Ionicons name="close" size={18} color={ink(0.5)} />
            </TouchableOpacity>
          </View>

          <Text style={{ color: FG, fontSize: 24, fontFamily: F.black, letterSpacing: -0.6, marginTop: 10 }}>
            {tp('setup.title', left)}
          </Text>
          <Text style={{ color: ink(0.75), fontSize: 14, lineHeight: 21, fontFamily: F.regular, marginTop: 6 }}>
            {t('setup.sub')}
          </Text>

          <View style={{ height: 4, borderRadius: 2, backgroundColor: ink(0.14), marginTop: 14, overflow: 'hidden' }}>
            <View style={{ width: `${(doneCount / steps.length) * 100}%`, height: 4, borderRadius: 2, backgroundColor: FG }} />
          </View>

          <View style={{ marginTop: 6 }}>
            {/* Seulement ce qui reste à faire : le compteur et la barre disent déjà ce qui est fait. */}
            {steps.filter(x => !x.done).map((step, i) => (
              <TouchableOpacity
                key={step.id}
                activeOpacity={0.8}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); track('setup_tap', { step: step.id }, 'feed'); step.onPress(); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: ink(0.08) }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: ink(0.12) }}>
                  <Ionicons name={ICONS[step.id]} size={17} color={FG} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: FG, fontSize: 15, fontFamily: F.bold }}>
                    {t(`setup.${step.id}`)}
                  </Text>
                  <Text style={{ color: ink(0.55), fontSize: 12, fontFamily: F.regular, marginTop: 1 }}>{t(`setup.${step.id}Sub`)}</Text>
                </View>
                <Ionicons name={dirIcon('chevron-forward')} size={18} color={ink(0.6)} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SetupShell>

      <Modal visible={placeOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setPlaceOpen(false); checkDevice(); }}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => { setPlaceOpen(false); checkDevice(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.modalCancel}>{t('common.close')}</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{t('presencePanel.title')}</Text>
            <View style={{ width: 46 }} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
            <PresencePanel />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
