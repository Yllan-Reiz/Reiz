import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Image, ImageSourcePropType, ScrollView, Animated, Easing, ActivityIndicator, Alert, Share, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, currentUser } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { uploadImage, signOne, resetSignedCache } from '../lib/storage';
import { registerForPushNotifications } from '../lib/notifications';
import { AUTO_SUPPORTED, isAutoEnabled, setAutoEnabled, addPlaceHere } from '../lib/presence';
import { contactsAvailable, inviteText } from '../lib/contacts';
import { APP_STORE_URL, daysLabel, ALL_DAYS, WELCOME_FLOW } from '../constants';
import { ContactsScreen } from './ContactsScreen';
import { SportCarousel, SPORTS, Sport } from './SportCarousel';
import { LocationScene } from './LocationScene';
import { TrainingDaysPicker } from './TrainingDays';
import { GlassCard, GlassSurface } from './GlassSurface';
import { F } from '../styles';

// L'accueil d'un compte tout neuf : quelques écrans plein cadre, un seul geste par écran, comme les
// applis sociales qu'on garde. Le but est d'arriver dans le fil avec un profil, un objectif et au moins
// une raison de revenir (notifications, amis), pas avec une application vide.
//   1. Profil     photo + nom (+ une phrase), enregistrés tout de suite
//   2. Objectif   la discipline (carrousel plein écran), puis le premier objectif prérempli, avec ses jours
//   3. Lieu       la détection automatique du lieu d'entraînement (iPhone, build 1.0.1 et plus)
//   4. Notifs     l'explication AVANT la demande du système (sinon la demande tombe sans contexte)
//   5. Amis       retrouver ses contacts (1.1.0) et partager son lien
// Il s'ouvre UNE SEULE FOIS PAR COMPTE, pour tout compte de moins de 2 jours (e-mail, Apple ou Google).
// Passer un écran ne crée rien.
// Pour revenir à l'ancien accueil (une simple fenêtre « Retrouve tes amis »), mettre WELCOME_FLOW à false.

// « Déjà vu » est retenu PAR COMPTE : un 2e compte créé sur le même téléphone a lui aussi son accueil.
const KEY = 'reiz.welcome.done';
const seenKey = (userId: string) => `${KEY}.${userId}`;
const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const DAY_MS = 24 * 3600 * 1000;

type StepId = 'profile' | 'objective' | 'place' | 'notifs' | 'friends';

// Photos de sportifs (Unsplash, licence libre, voir assets/onboarding/CREDITS.md) pour les écrans d'exemple.
const PHOTOS = {
  lea: require('../../assets/onboarding/lea.jpg'),
  tom: require('../../assets/onboarding/tom.jpg'),
  sam: require('../../assets/onboarding/sam.jpg'),
  groupe: require('../../assets/onboarding/groupe.jpg'),
  cercle: [
    require('../../assets/onboarding/cercle-1.jpg'),
    require('../../assets/onboarding/cercle-2.jpg'),
    require('../../assets/onboarding/cercle-3.jpg'),
    require('../../assets/onboarding/cercle-4.jpg'),
  ],
};

// Discipline choisie, retenue par compte : elle préremplit l'objectif si l'accueil est rouvert.
const sportKey = (userId: string) => `reiz.sport.${userId}`;

/** Compte créé il y a moins de 2 jours, accueil pas encore vu. App.tsx s'en sert aussi pour retarder la demande de notifications. */
export async function welcomePending(user?: { id?: string; created_at?: string } | null): Promise<boolean> {
  if (!WELCOME_FLOW || !user?.id || !user.created_at) return false;
  if (Date.now() - new Date(user.created_at).getTime() > 2 * DAY_MS) return false;
  try { return !(await AsyncStorage.getItem(seenKey(user.id))); } catch { return false; }
}

/** Version automatique, montée une fois dans App.tsx. `onChanged` : quelque chose a été écrit, l'app doit se recharger. */
export function WelcomeFlow({ onChanged }: { onChanged?: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const user = await currentUser();
      if (!(await welcomePending(user))) return;
      setTimeout(() => { if (alive) setShow(true); }, 500);
    })().catch(() => {});
    return () => { alive = false; };
  }, []);

  return <WelcomeModal visible={show} onClose={(changed) => { setShow(false); if (changed) onChanged?.(); }} />;
}

/** Apparition douce : le contenu monte de quelques points en fondu. Une seule fois, à l'affichage. */
function Rise({ delay = 0, y = 16, duration = 380, style, children }: { delay?: number; y?: number; duration?: number; style?: any; children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration, delay, easing: EASE, useNativeDriver: true }).start();
  }, [v, delay, duration]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <Text style={{ color: '#fff', fontSize: 34, lineHeight: 38, fontFamily: F.black, letterSpacing: -1.1, textAlign: 'center' }}>{children}</Text>;
}
function Sub({ children }: { children: ReactNode }) {
  return <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, lineHeight: 24, fontFamily: F.regular, textAlign: 'center', marginTop: 12, paddingHorizontal: 6 }}>{children}</Text>;
}
function Label({ children }: { children: ReactNode }) {
  return <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5, marginBottom: 8 }}>{children}</Text>;
}

const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  paddingHorizontal: 16, paddingVertical: 15, color: '#fff', fontSize: 17, fontFamily: F.semibold,
} as const;

function Primary({ label, icon, iconRight, onPress, disabled, busy }: { label: string; icon?: any; iconRight?: boolean; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  const fg = disabled ? 'rgba(255,255,255,0.35)' : '#000';
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || busy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label}
      style={{ backgroundColor: disabled ? 'rgba(255,255,255,0.14)' : '#fff', borderRadius: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      {busy ? <ActivityIndicator color="#000" /> : (
        <>
          {!!icon && !iconRight && <Ionicons name={icon} size={20} color={fg} />}
          <Text style={{ color: fg, fontSize: 17, fontFamily: F.extrabold }}>{label}</Text>
          {!!icon && iconRight && <Ionicons name={icon} size={20} color={fg} />}
        </>
      )}
    </TouchableOpacity>
  );
}

function Secondary({ label, icon, onPress, quiet }: { label: string; icon?: any; onPress: () => void; quiet?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={label}
      style={quiet
        ? { paddingVertical: 14, alignItems: 'center' }
        : { borderRadius: 16, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginTop: 10 }}>
      {!!icon && <Ionicons name={icon} size={19} color="#fff" />}
      <Text style={{ color: quiet ? 'rgba(255,255,255,0.6)' : '#fff', fontSize: quiet ? 15 : 16, fontFamily: quiet ? F.semibold : F.bold }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Foot({ children }: { children: ReactNode }) {
  return (
    // Le cadenas est DANS le texte : sur deux lignes, il reste collé au début de la phrase.
    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, lineHeight: 18, fontFamily: F.regular, textAlign: 'center', marginTop: 6, paddingHorizontal: 8 }}>
      <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.4)" />{'  '}{children}
    </Text>
  );
}

function MockNotif({ photo, title, body, when }: { photo: ImageSourcePropType; title: string; body: string; when: string }) {
  return (
    <GlassCard radius={22}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <Image source={photo} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text numberOfLines={1} style={{ color: '#fff', fontSize: 14.5, fontFamily: F.bold, flexShrink: 1 }}>{title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: F.regular }}>{when}</Text>
          </View>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, fontFamily: F.regular, marginTop: 2 }}>{body}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

/**
 * Le parcours lui-même. `preview` = aperçu : tous les écrans, rien n'est enregistré, aucune autorisation demandée.
 */
export function WelcomeModal({ visible, preview, onClose }: { visible: boolean; preview?: boolean; onClose: (changed: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  // Écran profil : la photo occupe le haut de l'écran, bord à bord, comme l'onglet Profil.
  const heroH = Math.round(Math.min(winH * 0.56, 500));
  const [steps, setSteps] = useState<StepId[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [contacts, setContacts] = useState(false);
  const wrote = useRef(false);
  const initial = useRef({ name: '', bio: '' });

  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Étape objectif en deux temps : la discipline (carrousel), puis le réglage de l'objectif.
  const [phase, setPhase] = useState<'pick' | 'details'>('pick');
  const [sportIdx, setSportIdx] = useState<number | null>(null);
  const [startIdx, setStartIdx] = useState(0);
  const [objTitle, setObjTitle] = useState('');
  const [target, setTarget] = useState(0);
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [editDays, setEditDays] = useState(false);

  // À l'ouverture : qui je suis, ce qui est déjà fait, ce que le téléphone a déjà accepté. On ne montre
  // que les écrans utiles (pas de 2e objectif si un existe déjà, pas de demande de notifications refusée).
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setSteps(null); setIdx(0); setSportIdx(null); setPhase('pick'); wrote.current = false;
    (async () => {
      const user = await currentUser();
      if (!user) return;
      const [row, objs, perm, autoOn] = await Promise.all([
        supabase.from('users').select('full_name, username, bio, avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('objectives').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        Notifications.getPermissionsAsync().catch(() => null),
        AUTO_SUPPORTED ? isAutoEnabled().catch(() => false) : Promise.resolve(true),
      ]);
      if (!alive) return;
      const p: any = row.data || {};
      initial.current = { name: p.full_name || '', bio: p.bio || '' };
      // « Athlète » = nom de secours d'un compte Apple ou Google sans prénom (voir ensureProfile) : on laisse le champ vide.
      const placeholder = !p.full_name || p.full_name === 'Athlète';
      const savedSport = await AsyncStorage.getItem(sportKey(user.id)).catch(() => null);
      setStartIdx(Math.max(0, SPORTS.findIndex(x => x.id === savedSport)));
      setUserId(user.id); setUsername(p.username ?? null); setName(placeholder ? '' : p.full_name); setBio(p.bio || '');
      setAvatar(p.avatar_url ? await signOne(p.avatar_url, { width: 1080 }).catch(() => null) : null);
      const list: StepId[] = ['profile'];
      if (preview || !objs.count) list.push('objective');
      // Pas d'écran « lieu » si la détection est déjà active ou impossible sur ce téléphone (Android, build 1.0.0).
      if (preview || (AUTO_SUPPORTED && !autoOn)) list.push('place');
      if (preview || perm?.status === 'undetermined') list.push('notifs');
      list.push('friends');
      if (alive) setSteps(list);
    })().catch(() => { if (alive) setSteps(['profile', 'friends']); });
    return () => { alive = false; };
  }, [visible, preview]);

  const step: StepId | null = steps ? steps[idx] : null;

  const finish = useCallback(async () => {
    if (!preview && userId) await AsyncStorage.setItem(seenKey(userId), '1').catch(() => {});
    onClose(wrote.current);
  }, [preview, onClose, userId]);

  const go = (to: number) => {
    if (!steps) return;
    Keyboard.dismiss();
    if (to >= steps.length) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); finish(); return; }
    Haptics.selectionAsync().catch(() => {});
    setPhase('pick');
    setIdx(Math.max(0, to));
  };

  // Retour : depuis le réglage de l'objectif, on revient d'abord au carrousel.
  const back = () => (step === 'objective' && phase === 'details' ? setPhase('pick') : go(idx - 1));

  // ---- Profil ----
  const pickAvatar = () => {
    const done = (uri: string) => { setAvatar(uri); if (!preview) uploadAvatar(uri); };
    Alert.alert('Photo de profil', 'Choisis une option', [
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la caméra dans les réglages.'); return; }
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!r.canceled) done(r.assets[0].uri);
        },
      },
      {
        text: 'Importer depuis la galerie',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la galerie dans les réglages.'); return; }
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!r.canceled) done(r.assets[0].uri);
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const uploadAvatar = async (uri: string) => {
    if (!userId) return;
    setUploading(true);
    // Comme dans le profil : on enregistre le chemin (le bucket est privé), pas une URL.
    const { path, error } = await uploadImage(`avatars/${userId}.jpg`, uri, true);
    if (error || !path) { setUploading(false); Alert.alert('Erreur', 'La photo n\'a pas pu être envoyée. Réessaie.'); return; }
    await supabase.from('users').update({ avatar_url: path }).eq('id', userId);
    resetSignedCache();
    wrote.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setUploading(false);
  };

  const saveProfile = async (): Promise<boolean> => {
    if (preview) return true;
    const patch: Record<string, string> = {};
    const n = name.trim(); if (n && n !== initial.current.name) patch.full_name = n;
    const b = bio.trim(); if (b && b !== initial.current.bio) patch.bio = b;
    if (!Object.keys(patch).length || !userId) return true;
    const { error } = await supabase.from('users').update(patch).eq('id', userId);
    if (error) { Alert.alert('Erreur', frError(error)); return false; }
    wrote.current = true;
    // Pseudo de secours (« athlete », « user1234 »...) : on le refait d'après le prénom, il sert au lien d'invitation.
    if (patch.full_name && username && /^(athlete|user)\d*$/.test(username)) {
      const first = patch.full_name.split(' ')[0];
      const base = first.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      if (base) {
        let candidate = base;
        for (let attempt = 0; attempt < 5; attempt++) {
          const r = await supabase.from('users').update({ username: candidate }).eq('id', userId);
          if (!r.error) { setUsername(candidate); break; }
          if (r.error.code !== '23505') break;
          candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
        }
      }
    }
    initial.current = { name: patch.full_name ?? initial.current.name, bio: patch.bio ?? initial.current.bio };
    return true;
  };

  // ---- Objectif ----
  const pickSport = (sp: Sport, i: number) => {
    setSportIdx(i); setStartIdx(i);
    setTarget(sp.target); setDays(sp.days); setObjTitle(sp.title); setEditDays(false);
    setPhase('details');
    if (!preview && userId) AsyncStorage.setItem(sportKey(userId), sp.id).catch(() => {});
  };

  const createObjective = async (): Promise<boolean> => {
    if (sportIdx == null) return true;
    const title = objTitle.trim();
    if (!title) { Alert.alert('Nom de l\'objectif', 'Donne un nom à ton objectif.'); return false; }
    if (days.length === 0) { Alert.alert('Jours d\'entraînement', 'Choisis au moins un jour où tu t\'entraînes.'); return false; }
    if (preview) return true;
    if (!userId) return false;
    const sp = SPORTS[sportIdx];
    const row = { user_id: userId, title, emoji: sp.emoji, target_value: target, current_value: 0, unit: sp.unit, visibility: 'friends', duration_days: null };
    const trainingDays = days.length === 7 ? null : days;
    let { error } = await supabase.from('objectives').insert(trainingDays ? { ...row, training_days: trainingDays } : row);
    // Avant la phase 12, la colonne des jours n'existe pas : on crée l'objectif sans.
    if (error && trainingDays && /training_days/i.test(error.message || '')) ({ error } = await supabase.from('objectives').insert(row));
    if (error) { Alert.alert('Erreur', frError(error)); return false; }
    wrote.current = true;
    return true;
  };

  const onContinue = async () => {
    if (busy || !step) return;
    if (step === 'profile') {
      if (!name.trim()) { Alert.alert('Ton nom', 'Dis à ton cercle comment t\'appeler.'); return; }
      setBusy(true); const ok = await saveProfile(); setBusy(false); if (!ok) return;
    } else if (step === 'objective') {
      setBusy(true); const ok = await createObjective(); setBusy(false); if (!ok) return;
    }
    go(idx + 1);
  };

  // ---- Lieu d'entraînement ----
  // « Activer » donne les autorisations maintenant (l'écran explique pourquoi) : la salle s'ajoutera depuis le fil,
  // une fois sur place. « J'y suis » enregistre en plus l'endroit où l'on se trouve.
  const enablePlace = async (here: boolean) => {
    if (preview) { go(idx + 1); return; }
    const finishPlace = async (label?: string) => {
      setBusy(true);
      try {
        if (label !== undefined) await addPlaceHere(label);
        const r = await setAutoEnabled(true);
        setBusy(false);
        if (r !== 'ok') {
          Alert.alert('Localisation non autorisée', "Pas de souci : tu pourras l'activer plus tard depuis la carte « À la salle » du fil.");
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      } catch (e: any) {
        setBusy(false);
        Alert.alert(
          e?.message === 'denied' ? 'Localisation non autorisée' : 'Position introuvable',
          e?.message === 'denied'
            ? "Pas de souci : tu pourras l'activer plus tard depuis la carte « À la salle » du fil."
            : "Impossible de lire ta position. Tu pourras ajouter ta salle depuis le fil, une fois sur place.",
        );
      }
      go(idx + 1);
    };
    if (!here) { finishPlace(); return; }
    Alert.prompt('Nom de ta salle', 'Ton cercle proche verra « Je suis à … ».', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Enregistrer', onPress: (v?: string) => finishPlace((v || '').trim() || 'Ma salle') },
    ], 'plain-text', 'Ma salle');
  };

  const enablePush = async () => {
    setBusy(true);
    if (!preview && userId) await registerForPushNotifications(userId).catch(() => {});
    setBusy(false);
    go(idx + 1);
  };

  const share = async () => {
    Haptics.selectionAsync().catch(() => {});
    try { await Share.share({ message: inviteText(username) }); } catch {}
  };

  // ---- Rendu ----
  const total = steps?.length ?? 4;
  const sp = sportIdx != null ? SPORTS[sportIdx] : null;
  // Écrans bord à bord (photo jusqu'en haut, barre de progression par-dessus) : profil et carrousel des disciplines.
  const bleed = step === 'profile' || step === 'place' || (step === 'objective' && phase === 'pick');
  const showContacts = contactsAvailable();

  let primary: ReactNode = null;
  let below: ReactNode = null;
  let foot = '';
  if (step === 'profile') {
    primary = <Primary label="Continuer" icon="arrow-forward" iconRight onPress={onContinue} busy={busy} disabled={uploading || !name.trim()} />;
    foot = 'Tu pourras tout modifier depuis ton profil.';
  } else if (step === 'objective') {
    primary = <Primary label="Créer mon objectif" icon="flag" onPress={onContinue} busy={busy} disabled={!sp || !objTitle.trim()} />;
    below = <Secondary quiet label="Je choisirai plus tard" onPress={() => go(idx + 1)} />;
    foot = 'Tu choisis qui voit chaque objectif.';
  } else if (step === 'place') {
    primary = <Primary label="Activer la détection" icon="location" onPress={() => enablePlace(false)} busy={busy} />;
    below = (
      <>
        <Secondary label="Je suis à ma salle, l'enregistrer" icon="locate-outline" onPress={() => enablePlace(true)} />
        <Secondary quiet label="Plus tard" onPress={() => go(idx + 1)} />
      </>
    );
    foot = 'Ta position reste sur ton téléphone. Seul « je suis arrivé » est envoyé.';
  } else if (step === 'notifs') {
    primary = <Primary label="Activer les notifications" icon="notifications" onPress={enablePush} busy={busy} />;
    below = <Secondary quiet label="Plus tard" onPress={() => go(idx + 1)} />;
    foot = 'Tu peux les couper à tout moment dans les réglages.';
  } else if (step === 'friends') {
    primary = showContacts
      ? <Primary label="Trouver mes amis" icon="people" onPress={() => setContacts(true)} />
      : <Primary label="Inviter mes amis" icon="share-outline" onPress={share} />;
    below = (
      <>
        {showContacts && <Secondary label="Partager mon lien" icon="share-outline" onPress={share} />}
        <Secondary quiet label="Entrer dans Reiz" onPress={() => go(idx + 1)} />
      </>
    );
    foot = showContacts ? 'Tes contacts restent sur ton téléphone : Reiz ne les enregistre jamais.' : 'Rien n\'est envoyé sans ton tap sur « Envoyer ».';
  }

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => (idx > 0 || phase === 'details' ? back() : undefined)}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0a0a0a' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* « Ton premier objectif » se règle par-dessus la photo de la discipline choisie, en transparence. */}
        {step === 'objective' && phase === 'details' && sp && <SportBackdrop key={sp.id} photo={sp.photo} />}
        <View style={{ flex: 1, paddingTop: bleed ? 0 : insets.top + 8 }}>
          {/* Barre du haut : retour, progression, passer. Sur l'écran profil, elle flotte par-dessus la photo. */}
          <View style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, height: 40 }, bleed && { position: 'absolute', top: insets.top + 8, left: 0, right: 0, zIndex: 5 }]}>
            <TouchableOpacity onPress={back} disabled={idx === 0 && phase !== 'details'} hitSlop={10} accessibilityLabel="Retour" style={{ width: 28, opacity: idx === 0 && phase !== 'details' ? 0 : 1 }}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
              {Array.from({ length: total }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= idx ? '#fff' : 'rgba(255,255,255,0.18)' }} />
              ))}
            </View>
            <TouchableOpacity onPress={finish} hitSlop={10} accessibilityLabel="Passer l'accueil" style={{ minWidth: 28, alignItems: 'flex-end' }}>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontFamily: F.semibold }}>Passer</Text>
            </TouchableOpacity>
          </View>

          {!step ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
          ) : step === 'objective' && phase === 'pick' ? (
            <SportCarousel initialIndex={startIdx} bottomInset={insets.bottom} onContinue={pickSport} onSkip={() => go(idx + 1)} />
          ) : (
            <>
              <ScrollView key={step} style={{ flex: 1 }} contentContainerStyle={step === 'profile' || step === 'place' ? { flexGrow: 1, paddingBottom: 24 } : { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, justifyContent: 'center' }}
                keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
                {step === 'profile' && (
                  <>
                    {/* La photo prend tout le haut de l'écran, comme l'onglet Profil. Toucher la photo la change. */}
                    <TouchableOpacity onPress={pickAvatar} activeOpacity={0.9} style={{ height: heroH }} accessibilityRole="button" accessibilityLabel="Choisir une photo de profil">
                      {avatar
                        ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        : <LinearGradient colors={['#3a3a3a', '#141414']} style={StyleSheet.absoluteFill} />}
                      <LinearGradient pointerEvents="none" colors={['rgba(10,10,10,0.7)', 'rgba(10,10,10,0)']} locations={[0, 0.28]} style={StyleSheet.absoluteFill} />
                      <LinearGradient pointerEvents="none" colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.55)', '#0a0a0a']} locations={[0.38, 0.72, 1]} style={StyleSheet.absoluteFill} />
                      {!avatar && (
                        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: heroH * 0.26, alignItems: 'center' }}>
                          <Ionicons name="person" size={76} color="rgba(255,255,255,0.28)" />
                          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: F.semibold, marginTop: 10 }}>Touche pour ajouter ta photo</Text>
                        </View>
                      )}
                      {uploading && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color="#fff" /></View>}
                      <View pointerEvents="none" style={{ position: 'absolute', right: 16, top: insets.top + 8 + 40 + 12 }}>
                        <GlassSurface radius={22} variant="clear" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="camera-outline" size={21} color="#fff" />
                        </GlassSurface>
                      </View>
                      <Rise style={{ position: 'absolute', left: 24, right: 24, bottom: 0 }}>
                        <Title>Crée ton profil</Title>
                        <Sub>Ton cercle te reconnaît à ta photo et à ton nom. Ça prend dix secondes.</Sub>
                      </Rise>
                    </TouchableOpacity>
                    <Rise delay={120} style={{ marginTop: 24, paddingHorizontal: 24 }}>
                      <Label>TON NOM</Label>
                      <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Prénom Nom" placeholderTextColor="rgba(255,255,255,0.3)" autoCapitalize="words" maxLength={40} returnKeyType="next" />
                      <View style={{ height: 16 }} />
                      <Label>UNE PHRASE SUR TOI (FACULTATIF)</Label>
                      <TextInput style={inputStyle} value={bio} onChangeText={setBio} placeholder="Ex : je prépare mon premier semi" placeholderTextColor="rgba(255,255,255,0.3)" maxLength={150} returnKeyType="done" />
                    </Rise>
                  </>
                )}

                {step === 'objective' && sp && (
                  <>
                    <Rise style={{ alignItems: 'center' }}>
                      {/* La discipline choisie, en pastille de verre : la toucher ramène au carrousel. */}
                      <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); setPhase('pick'); }} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Discipline : ${sp.name}. Changer`}>
                        <GlassSurface radius={22} variant="clear" tintColor="rgba(255,255,255,0.08)" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 6, paddingRight: 14, height: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                          <Image source={sp.photo} style={{ width: 32, height: 32, borderRadius: 16 }} />
                          <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>{sp.name}</Text>
                          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: F.semibold }}>Changer</Text>
                        </GlassSurface>
                      </TouchableOpacity>
                    </Rise>
                    <Rise delay={60} style={{ marginTop: 20 }}>
                      <Title>Ton premier objectif</Title>
                      <Sub>Fixe ton but. Ton cercle suivra ta progression, séance après séance.</Sub>
                    </Rise>
                    <Rise delay={120} style={{ marginTop: 24 }}>
                      <Label>NOM DE L'OBJECTIF</Label>
                      <TextInput style={inputStyle} value={objTitle} onChangeText={setObjTitle} placeholder={sp.id === 'autre' ? 'Ex : escalade, padel, yoga' : sp.title} placeholderTextColor="rgba(255,255,255,0.3)" autoCapitalize="sentences" maxLength={80} returnKeyType="done" />
                      <View style={{ height: 16 }} />
                      <Label>TON BUT</Label>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...inputStyle, paddingVertical: 8 }}>
                        <Stepper icon="remove" label="Moins" disabled={target <= sp.step} onPress={() => { Haptics.selectionAsync().catch(() => {}); setTarget(t => Math.max(sp.step, t - sp.step)); }} />
                        <Text style={{ color: '#fff', fontSize: 20, fontFamily: F.extrabold }}>{target} {sp.unit}</Text>
                        <Stepper icon="add" label="Plus" onPress={() => { Haptics.selectionAsync().catch(() => {}); setTarget(t => t + sp.step); }} />
                      </View>
                      {/* Ce nombre est le BUT de l'objectif : la barre de progression va de 0 à ce nombre. */}
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 19, fontFamily: F.regular, textAlign: 'center', marginTop: 8, paddingHorizontal: 8 }}>
                        {sp.unit === 'séances'
                          ? `${target} séances au total. Chaque séance que tu postes fait avancer ta barre, et ton cercle la voit.`
                          : `${target} ${sp.unit} au total. Tu ajoutes tes ${sp.unit} à chaque post, ta barre avance et ton cercle la voit.`}
                      </Text>
                      <View style={{ height: 16 }} />
                      <Label>TES JOURS D'ENTRAÎNEMENT</Label>
                      <TouchableOpacity onPress={() => { Haptics.selectionAsync().catch(() => {}); setEditDays(v => !v); }} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Choisir les jours d'entraînement"
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...inputStyle, paddingVertical: 15 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
                          <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.7)" />
                          <Text numberOfLines={1} style={{ color: '#fff', fontSize: 16, fontFamily: F.semibold, flexShrink: 1 }}>{days.length === 0 ? 'Choisis des jours' : daysLabel(days).replace(/^./, c => c.toUpperCase())}</Text>
                        </View>
                        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontFamily: F.semibold }}>{editDays ? 'OK' : 'Modifier'}</Text>
                      </TouchableOpacity>
                      {editDays && <View style={{ marginTop: 14 }}><TrainingDaysPicker value={days} onChange={setDays} /></View>}
                    </Rise>
                  </>
                )}

                {step === 'place' && (
                  <>
                    {/* Le plan prend tout le haut de l'écran, bord à bord, comme la photo de l'écran profil. */}
                    <View style={{ height: heroH }}>
                      <LocationScene width={winW} height={heroH} fullBleed cardTop={insets.top + 8 + 40 + 12} avatar={avatar} circle={[PHOTOS.lea, PHOTOS.tom, PHOTOS.sam]} />
                      <LinearGradient pointerEvents="none" colors={['rgba(10,10,10,0.75)', 'rgba(10,10,10,0)']} locations={[0, 0.3]} style={StyleSheet.absoluteFill} />
                      <LinearGradient pointerEvents="none" colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.6)', '#0a0a0a']} locations={[0.62, 0.82, 1]} style={StyleSheet.absoluteFill} />
                      <Rise delay={200} style={{ position: 'absolute', left: 24, right: 24, bottom: 0 }}>
                        <Title>Ton lieu d'entraînement</Title>
                      </Rise>
                    </View>
                    <Rise delay={260} style={{ paddingHorizontal: 24 }}>
                      <Sub>Enregistre ta salle une fois. Quand tu y arrives, ton cercle proche est prévenu tout seul, même appli fermée.</Sub>
                    </Rise>
                  </>
                )}

                {step === 'notifs' && (
                  <>
                    <View style={{ gap: 10, marginBottom: 30 }}>
                      <Rise delay={0}><MockNotif photo={PHOTOS.lea} title="Léa a posté : Salle" body="3 / 12 séances. Viens voir sa progression." when="maintenant" /></Rise>
                      <Rise delay={140} style={{ marginHorizontal: 10 }}><MockNotif photo={PHOTOS.tom} title="Tom a réagi à ton post" body="Sur ton post Courir" when="2 min" /></Rise>
                      <Rise delay={280} style={{ marginHorizontal: 20 }}><MockNotif photo={PHOTOS.sam} title="Sam te défie" body="Un duel d'une semaine. Tu relèves ?" when="1 h" /></Rise>
                    </View>
                    <Rise delay={360}>
                      <Title>Ton cercle t'attend</Title>
                      <Sub>Sois prévenu quand un ami poste, réagit ou te lance un défi. Juste ce qui compte, rien de plus.</Sub>
                    </Rise>
                  </>
                )}

                {step === 'friends' && (
                  <>
                    <Rise style={{ alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        {[56, 68, 94, 68, 56].map((size, i) => (
                          <View key={i} style={{ width: size, height: size, borderRadius: size / 2, marginHorizontal: -7, zIndex: 3 - Math.abs(i - 2), backgroundColor: ['#1d1d1d', '#262626', '#1d1d1d', '#262626', '#1d1d1d'][i], borderWidth: 3, borderColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {/* Au centre : toi (ou un groupe si tu n'as pas encore de photo), autour : ton futur cercle. */}
                            <Image source={i === 2 ? (avatar ? { uri: avatar } : PHOTOS.groupe) : PHOTOS.cercle[i < 2 ? i : i - 1]} style={{ width: size, height: size }} />
                          </View>
                        ))}
                      </View>
                    </Rise>
                    <Rise delay={80} style={{ marginTop: 28 }}>
                      <Title>Mieux à plusieurs</Title>
                      <Sub>Reiz, c'est ton cercle qui te motive. Invite un ami pour que ça démarre dès aujourd'hui.</Sub>
                    </Rise>
                    <Rise delay={160} style={{ marginTop: 24 }}>
                      <GlassCard radius={16}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 }}>
                          <Ionicons name="link" size={18} color="rgba(255,255,255,0.7)" />
                          <Text numberOfLines={1} ellipsizeMode="middle" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontFamily: F.semibold, flex: 1 }}>
                            {APP_STORE_URL.replace('https://', '')}
                          </Text>
                        </View>
                      </GlassCard>
                    </Rise>
                  </>
                )}
              </ScrollView>

              <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: insets.bottom + 14 }}>
                {primary}
                {below}
                {!!foot && <Foot>{foot}</Foot>}
              </View>
            </>
          )}
        </View>
        <ContactsScreen visible={contacts} onClose={() => setContacts(false)} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Stepper({ icon, label, onPress, disabled }: { icon: any; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Ionicons name={icon} size={22} color="#fff" />
    </TouchableOpacity>
  );
}

/** La photo de la discipline, floutée et assombrie, derrière le réglage de l'objectif. Apparaît en fondu. */
function SportBackdrop({ photo }: { photo: ImageSourcePropType }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, easing: EASE, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: v }]}>
      <Image source={photo} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,5,5,0.5)' }]} />
      <LinearGradient colors={['rgba(5,5,5,0.7)', 'rgba(5,5,5,0)', 'rgba(5,5,5,0)', 'rgba(5,5,5,0.85)']} locations={[0, 0.22, 0.62, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}
