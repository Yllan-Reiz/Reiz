import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Image, ScrollView, Animated, Easing, ActivityIndicator, Alert, Share, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
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
import { contactsAvailable, inviteText } from '../lib/contacts';
import { inviteUrl, daysLabel, ALL_DAYS, WELCOME_FLOW } from '../constants';
import { ContactsScreen } from './ContactsScreen';
import { TrainingDaysPicker } from './TrainingDays';
import { GlassCard } from './GlassSurface';
import { F } from '../styles';

// L'accueil d'un compte tout neuf : quelques écrans plein cadre, un seul geste par écran, comme les
// applis sociales qu'on garde. Le but est d'arriver dans le fil avec un profil, un objectif et au moins
// une raison de revenir (notifications, amis), pas avec une application vide.
//   1. Profil     photo + nom (+ une phrase), enregistrés tout de suite
//   2. Objectif   un premier objectif en deux taps, avec ses jours d'entraînement
//   3. Notifs     l'explication AVANT la demande du système (sinon la demande tombe sans contexte)
//   4. Amis       retrouver ses contacts (1.1.0) et partager son lien
// Il s'ouvre UNE SEULE FOIS, pour un compte de moins de 2 jours. Passer un écran ne crée rien.
// Pour revenir à l'ancien accueil (une simple fenêtre « Retrouve tes amis »), mettre WELCOME_FLOW à false.

const KEY = 'reiz.welcome.done';
const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const DAY_MS = 24 * 3600 * 1000;

type StepId = 'profile' | 'objective' | 'notifs' | 'friends';

const PRESETS: { emoji: string; title: string; unit: string; target: number; step: number; days: number[] }[] = [
  { emoji: '🏋️', title: 'Aller à la salle', unit: 'séances', target: 12, step: 1, days: [1, 3, 5] },
  { emoji: '🏃', title: 'Courir', unit: 'km', target: 50, step: 5, days: [2, 4, 6] },
  { emoji: '🚴', title: 'Faire du vélo', unit: 'km', target: 100, step: 10, days: [6, 7] },
  { emoji: '🏊', title: 'Nager', unit: 'séances', target: 8, step: 1, days: [2, 5] },
  { emoji: '🥊', title: 'Boxer', unit: 'séances', target: 10, step: 1, days: [1, 3, 5] },
  { emoji: '🧘', title: 'Méditer', unit: 'séances', target: 20, step: 1, days: ALL_DAYS },
];

/** Compte créé il y a moins de 2 jours, accueil pas encore vu. App.tsx s'en sert aussi pour retarder la demande de notifications. */
export async function welcomePending(user?: { created_at?: string } | null): Promise<boolean> {
  if (!WELCOME_FLOW || !user?.created_at) return false;
  if (Date.now() - new Date(user.created_at).getTime() > 2 * DAY_MS) return false;
  try { return !(await AsyncStorage.getItem(KEY)); } catch { return false; }
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
      style={{ backgroundColor: disabled ? 'rgba(255,255,255,0.14)' : '#fff', borderRadius: 18, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
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
        : { borderRadius: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginTop: 10 }}>
      {!!icon && <Ionicons name={icon} size={19} color="#fff" />}
      <Text style={{ color: quiet ? 'rgba(255,255,255,0.6)' : '#fff', fontSize: quiet ? 15 : 16, fontFamily: quiet ? F.semibold : F.bold }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Foot({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6, paddingHorizontal: 8 }}>
      <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.4)" />
      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, lineHeight: 18, fontFamily: F.regular, textAlign: 'center', flexShrink: 1 }}>{children}</Text>
    </View>
  );
}

function MockNotif({ emoji, title, body, when }: { emoji: string; title: string; body: string; when: string }) {
  return (
    <GlassCard radius={22}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 21 }}>{emoji}</Text>
        </View>
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
  const [preset, setPreset] = useState<number | null>(null);
  const [target, setTarget] = useState(0);
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [editDays, setEditDays] = useState(false);

  // À l'ouverture : qui je suis, ce qui est déjà fait, ce que le téléphone a déjà accepté. On ne montre
  // que les écrans utiles (pas de 2e objectif si un existe déjà, pas de demande de notifications refusée).
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setSteps(null); setIdx(0); setPreset(null); wrote.current = false;
    (async () => {
      const user = await currentUser();
      if (!user) return;
      const [row, objs, perm] = await Promise.all([
        supabase.from('users').select('full_name, username, bio, avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('objectives').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        Notifications.getPermissionsAsync().catch(() => null),
      ]);
      if (!alive) return;
      const p: any = row.data || {};
      initial.current = { name: p.full_name || '', bio: p.bio || '' };
      setUserId(user.id); setUsername(p.username ?? null); setName(p.full_name || ''); setBio(p.bio || '');
      setAvatar(p.avatar_url ? await signOne(p.avatar_url, { width: 300 }).catch(() => null) : null);
      const list: StepId[] = ['profile'];
      if (preview || !objs.count) list.push('objective');
      if (preview || perm?.status === 'undetermined') list.push('notifs');
      list.push('friends');
      if (alive) setSteps(list);
    })().catch(() => { if (alive) setSteps(['profile', 'friends']); });
    return () => { alive = false; };
  }, [visible, preview]);

  const step: StepId | null = steps ? steps[idx] : null;

  const finish = useCallback(async () => {
    if (!preview) await AsyncStorage.setItem(KEY, '1').catch(() => {});
    onClose(wrote.current);
  }, [preview, onClose]);

  const go = (to: number) => {
    if (!steps) return;
    Keyboard.dismiss();
    if (to >= steps.length) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); finish(); return; }
    Haptics.selectionAsync().catch(() => {});
    setIdx(Math.max(0, to));
  };

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
    initial.current = { name: patch.full_name ?? initial.current.name, bio: patch.bio ?? initial.current.bio };
    return true;
  };

  // ---- Objectif ----
  const choose = (i: number) => {
    Haptics.selectionAsync().catch(() => {});
    setPreset(i); setTarget(PRESETS[i].target); setDays(PRESETS[i].days); setEditDays(false);
  };

  const createObjective = async (): Promise<boolean> => {
    if (preset == null) return true;
    if (preview) return true;
    if (days.length === 0) { Alert.alert('Jours d\'entraînement', 'Choisis au moins un jour où tu t\'entraînes.'); return false; }
    if (!userId) return false;
    const p = PRESETS[preset];
    const row = { user_id: userId, title: p.title, emoji: p.emoji, target_value: target, current_value: 0, unit: p.unit, visibility: 'friends', duration_days: null };
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
  const p = preset != null ? PRESETS[preset] : null;
  const showContacts = contactsAvailable();

  let primary: ReactNode = null;
  let below: ReactNode = null;
  let foot = '';
  if (step === 'profile') {
    primary = <Primary label="Continuer" icon="arrow-forward" iconRight onPress={onContinue} busy={busy} disabled={uploading || !name.trim()} />;
    foot = 'Tu pourras tout modifier depuis ton profil.';
  } else if (step === 'objective') {
    primary = <Primary label={p ? 'Créer mon objectif' : 'Choisis un objectif'} icon={p ? 'flag' : undefined} onPress={onContinue} busy={busy} disabled={!p} />;
    below = <Secondary quiet label="Je choisirai plus tard" onPress={() => go(idx + 1)} />;
    foot = 'Tu choisis qui voit chaque objectif.';
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
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => (idx > 0 ? go(idx - 1) : undefined)}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0a0a0a' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
          {/* Barre du haut : retour, progression, passer */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, height: 40 }}>
            <TouchableOpacity onPress={() => go(idx - 1)} disabled={idx === 0} hitSlop={10} accessibilityLabel="Retour" style={{ width: 28, opacity: idx === 0 ? 0 : 1 }}>
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
          ) : (
            <>
              <ScrollView key={step} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, justifyContent: 'center' }}
                keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
                {step === 'profile' && (
                  <>
                    <Rise style={{ alignItems: 'center' }}>
                      <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Choisir une photo de profil">
                        <View style={{ width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', borderWidth: avatar ? 0 : 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          {avatar
                            ? <Image source={{ uri: avatar }} style={{ width: 132, height: 132, borderRadius: 66 }} />
                            : <Ionicons name="person" size={58} color="rgba(255,255,255,0.35)" />}
                          {uploading && (
                            <View style={{ position: 'absolute', width: 132, height: 132, borderRadius: 66, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                              <ActivityIndicator color="#fff" />
                            </View>
                          )}
                        </View>
                        <View style={{ position: 'absolute', right: 2, bottom: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', borderWidth: 3, borderColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={avatar ? 'checkmark' : 'camera'} size={20} color="#000" />
                        </View>
                      </TouchableOpacity>
                    </Rise>
                    <Rise delay={70} style={{ marginTop: 26 }}>
                      <Title>Crée ton profil</Title>
                      <Sub>Ton cercle te reconnaît à ta photo et à ton nom. Ça prend dix secondes.</Sub>
                    </Rise>
                    <Rise delay={140} style={{ marginTop: 26 }}>
                      <Label>TON NOM</Label>
                      <TextInput style={inputStyle} value={name} onChangeText={setName} placeholder="Prénom Nom" placeholderTextColor="rgba(255,255,255,0.3)" autoCapitalize="words" maxLength={40} returnKeyType="next" />
                      <View style={{ height: 16 }} />
                      <Label>UNE PHRASE SUR TOI (FACULTATIF)</Label>
                      <TextInput style={inputStyle} value={bio} onChangeText={setBio} placeholder="Ex : je prépare mon premier semi" placeholderTextColor="rgba(255,255,255,0.3)" maxLength={150} returnKeyType="done" />
                    </Rise>
                  </>
                )}

                {step === 'objective' && (
                  <>
                    <Rise>
                      <Title>Quel est ton premier objectif ?</Title>
                      <Sub>Un seul suffit pour démarrer. Ton cercle suivra ta progression.</Sub>
                    </Rise>
                    <Rise delay={80} style={{ marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                      {PRESETS.map((pr, i) => {
                        const on = preset === i;
                        return (
                          <TouchableOpacity key={pr.title} onPress={() => choose(i)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
                            style={{ width: '48.5%', borderRadius: 18, borderWidth: 2, borderColor: on ? '#fff' : 'transparent' }}>
                            <GlassCard radius={16}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 15, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                                <Text style={{ fontSize: 24 }}>{pr.emoji}</Text>
                                <Text numberOfLines={1} style={{ color: '#fff', fontSize: 15, fontFamily: F.bold, flexShrink: 1 }}>{pr.title}</Text>
                              </View>
                            </GlassCard>
                          </TouchableOpacity>
                        );
                      })}
                    </Rise>
                    {p && (
                      <Rise key={preset} y={10} duration={300} style={{ marginTop: 22 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...inputStyle, paddingVertical: 8 }}>
                          <Stepper icon="remove" label="Moins" disabled={target <= p.step} onPress={() => { Haptics.selectionAsync().catch(() => {}); setTarget(t => Math.max(p.step, t - p.step)); }} />
                          <Text style={{ color: '#fff', fontSize: 20, fontFamily: F.extrabold }}>{target} {p.unit}</Text>
                          <Stepper icon="add" label="Plus" onPress={() => { Haptics.selectionAsync().catch(() => {}); setTarget(t => t + p.step); }} />
                        </View>
                        <View style={{ height: 14 }} />
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
                    )}
                  </>
                )}

                {step === 'notifs' && (
                  <>
                    <View style={{ gap: 10, marginBottom: 30 }}>
                      <Rise delay={0}><MockNotif emoji="🏋️" title="Léa a posté : Salle" body="3 / 12 séances. Viens voir sa progression." when="maintenant" /></Rise>
                      <Rise delay={140} style={{ marginHorizontal: 10 }}><MockNotif emoji="🔥" title="Tom a réagi à ton post" body="Sur ton post 🏃 Courir" when="2 min" /></Rise>
                      <Rise delay={280} style={{ marginHorizontal: 20 }}><MockNotif emoji="⚔️" title="Sam te défie" body="Un duel d'une semaine. Tu relèves ?" when="1 h" /></Rise>
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
                            {i === 2 && avatar
                              ? <Image source={{ uri: avatar }} style={{ width: size, height: size }} />
                              : <Ionicons name="person" size={size * 0.46} color={i === 2 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)'} />}
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
                            {(username ? inviteUrl(username) : 'Ton lien d\'invitation').replace('https://', '')}
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
