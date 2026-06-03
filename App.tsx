import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, StatusBar, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Animated, Easing, Pressable } from 'react-native';
import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) return;
  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing === 'granted' ? { status: existing } : await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: '69071c24-329f-4426-b10b-8b5fbe280564' })).data;
    await supabase.from('users').update({ push_token: token }).eq('id', userId);
  } catch (_) {}
}

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const notifListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const registeredUserId = useRef<string | null>(null);

  const maybeRegisterPush = (uid: string) => {
    if (registeredUserId.current === uid) return;
    registeredUserId.current = uid;
    registerForPushNotifications(uid);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setScreen('main');
        maybeRegisterPush(session.user.id);
      }
      setCheckingAuth(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setScreen('main');
        maybeRegisterPush(session.user.id);
      } else {
        registeredUserId.current = null;
        setScreen('splash');
      }
    });

    notifListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      authListener.subscription.unsubscribe();
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (checkingAuth) return null;
  if (screen === 'splash') return <Splash onNext={() => setScreen('onboarding')} />;
  if (screen === 'onboarding') return <Onboarding onNext={() => setScreen('main')} />;
  if (screen === 'main') return <Main onPost={() => setScreen('post')} />;
  if (screen === 'post') return <Post onBack={() => setScreen('main')} onPublish={() => setScreen('main')} />;
  return null;
}

// ============ FLAME STREAK ============
function FlameStreak({ streak }: { streak: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (streak === 0) return;
    // Plus le streak est élevé, plus l'animation est intense et rapide
    const duration = streak >= 15 ? 500 : streak >= 8 ? 700 : streak >= 4 ? 1000 : 1400;
    const maxScale = streak >= 15 ? 1.35 : streak >= 8 ? 1.25 : streak >= 4 ? 1.18 : 1.1;
    const minOpacity = streak >= 15 ? 0.55 : streak >= 8 ? 0.65 : streak >= 4 ? 0.75 : 0.85;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: maxScale, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: minOpacity, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [streak]);

  const fontSize = streak >= 15 ? 18 : streak >= 8 ? 16 : streak >= 4 ? 15 : 13;

  return (
    <View style={s.streakBadge}>
      <Animated.Text style={[s.streakFlame, { fontSize, transform: [{ scale }], opacity }]}>🔥</Animated.Text>
      <Text style={s.streakText}>{streak}j</Text>
    </View>
  );
}

// ============ SPLASH ============
function Splash({ onNext }: { onNext: () => void }) {
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Erreur', 'Remplis tous les champs !'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Erreur', error.message);
  };

  if (showLogin) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView style={s.splashContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <StatusBar barStyle="light-content" />
          <Image source={require('./assets/ecriture-reiz-blanc.png')} style={s.splashLogo} resizeMode="contain" />
          <Text style={s.splashTagline}>RISE TO YOUR GOALS</Text>
          <View style={s.splashBottom}>
            <View style={s.inputBlock}>
              <Text style={s.inputLabel}>EMAIL</Text>
              <TextInput style={s.inputField} placeholder="yllan@reiz.app" placeholderTextColor="#444" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={s.inputBlock}>
              <Text style={s.inputLabel}>MOT DE PASSE</Text>
              <TextInput style={s.inputField} placeholder="••••••••" placeholderTextColor="#444" value={password} onChangeText={setPassword} secureTextEntry />
            </View>
            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={loading ? undefined : handleLogin}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Se connecter →</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 14, alignItems: 'center' }} onPress={() => setShowLogin(false)}>
              <Text style={s.splashLogin}>← Retour</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <View style={s.splashContainer}>
      <StatusBar barStyle="light-content" />
      <Image source={require('./assets/ecriture-reiz-blanc.png')} style={s.splashLogo} resizeMode="contain" />
      <Text style={s.splashTagline}>RISE TO YOUR GOALS</Text>
      <View style={s.splashBottom}>
        <TouchableOpacity style={s.btn} onPress={onNext}>
          <Text style={s.btnText}>Commencer →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 14, alignItems: 'center' }} onPress={() => setShowLogin(true)}>
          <Text style={s.splashLogin}>Déjà un compte ? <Text style={s.splashLoginLink}>Se connecter</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============ ONBOARDING ============
const GOALS = [
  { emoji: '💪', label: 'Perdre du poids' },
  { emoji: '💰', label: "Gagner de l'argent" },
  { emoji: '🏃', label: 'Courir' },
  { emoji: '📚', label: 'Lire' },
  { emoji: '🧘', label: 'Méditer' },
  { emoji: '🚀', label: 'Startup' },
  { emoji: '🏋️', label: 'Sport' },
  { emoji: '🏦', label: 'Épargne' },
];

function Onboarding({ onNext }: { onNext: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const next = () => setStep(st => st + 1);

  const handleSignUp = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !password) { Alert.alert('Erreur', 'Remplis tous les champs !'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { Alert.alert('Erreur', 'Email invalide.'); return; }
    if (password.length < 6) { Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères.'); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail, password,
      options: { data: { full_name: trimmedName } },
    });
    if (error) { setLoading(false); Alert.alert('Erreur', error.message); return; }
    if (!data.user) { setLoading(false); Alert.alert('Erreur', 'Compte non créé, réessaie.'); return; }

    // Username unique : base + suffixe random si collision
    const base = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    let username = base;
    let attempt = 0;
    let inserted = false;
    while (attempt < 4 && !inserted) {
      const { error: insErr } = await supabase.from('users').insert({
        id: data.user.id, username, full_name: trimmedName,
      });
      if (!insErr) { inserted = true; break; }
      if (insErr.code === '23505') {
        username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
        attempt++;
      } else {
        setLoading(false);
        Alert.alert('Erreur profil', insErr.message);
        return;
      }
    }
    if (!inserted) {
      setLoading(false);
      Alert.alert('Erreur', "Impossible de créer ton profil. Réessaie.");
      return;
    }

    setLoading(false);

    // Si confirmation email requise, pas de session → on ne navigue pas vers Main
    if (!data.session) {
      Alert.alert(
        'Vérifie ta boîte mail 📬',
        `Un email a été envoyé à ${trimmedEmail}. Clique sur le lien pour confirmer ton compte, puis reviens te connecter.`,
        [{ text: 'OK', onPress: () => setShowLogin(true) }]
      );
      return;
    }

    // Session active : onAuthStateChange va navigateur vers Main, l'alert reste informatif
    Alert.alert('Bienvenue sur Reiz ! 🎉', '', [{ text: 'C\'est parti' }]);
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { Alert.alert('Erreur', 'Remplis tous les champs !'); return; }
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (error) Alert.alert('Erreur', error.message);
  };

  if (showLogin) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView style={s.obContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={s.headline}>Bon retour 👋</Text>
        <Text style={s.subtext}>Connecte-toi pour reprendre ta progression.</Text>
        <View style={s.inputBlock}>
          <Text style={s.inputLabel}>EMAIL</Text>
          <TextInput style={s.inputField} placeholder="yllan@reiz.app" placeholderTextColor="#444" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>
        <View style={s.inputBlock}>
          <Text style={s.inputLabel}>MOT DE PASSE</Text>
          <TextInput style={s.inputField} placeholder="••••••••" placeholderTextColor="#444" value={loginPassword} onChangeText={setLoginPassword} secureTextEntry />
        </View>
        <TouchableOpacity style={[s.btn, { marginTop: 8 }, loginLoading && s.btnDisabled]} onPress={loginLoading ? undefined : handleLogin}>
          {loginLoading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Se connecter →</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.obBackBtn} onPress={() => setShowLogin(false)}>
          <Text style={s.obBackText}>← Retour</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  // Écrans 0-3 (4 écrans), écran 4 = formulaire compte
  const TOTAL_STEPS = 4;

  const canGoNext = step < TOTAL_STEPS;

  return (
    <KeyboardAvoidingView style={s.obContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Zones de tap gauche/droite */}
      {step !== 4 && (
        <View style={s.obTapZones} pointerEvents="box-none">
          <TouchableOpacity style={s.obTapLeft} onPress={() => step > 0 && setStep(st => st - 1)} activeOpacity={1} />
          <TouchableOpacity style={s.obTapRight} onPress={() => canGoNext && setStep(st => st + 1)} activeOpacity={1} />
        </View>
      )}

      <View style={s.obTopRow}>
        {step < TOTAL_STEPS && (
          <View style={s.obProgress}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[s.obProgressBar, step >= i && s.obProgressBarActive]} />
            ))}
          </View>
        )}
      </View>

      {step === 0 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>Tes proches savent quand tu lâches ton entraînement.</Text>
            <Text style={s.obBody}>Reiz transforme ton entourage en raison de ne pas lâcher.</Text>
          </View>
        </View>
      )}

      {step === 1 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>Un cercle. Un objectif. Zéro excuse.</Text>
            <Text style={s.obBody}>Tu choisis ton objectif sportif. Tu invites les personnes qui comptent. Ils voient ta progression chaque jour et toi la leur.</Text>
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>La discipline seul, ça ne tient pas.</Text>
            <Text style={s.obBody}>Les applications de sport te demandent d'être motivé tout seul. Reiz, non. Quand quelqu'un que tu respectes regarde, tu te lèves.</Text>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={s.obScreen}>
          <View>
            <Text style={s.obBigTitle}>Crée ton compte et invite ton cercle.</Text>
            <Text style={s.obBody}>Gratuit. 2 minutes. Et quelqu'un dans ton entourage va le voir dès ce soir.</Text>
          </View>
          <View style={s.obBottom}>
            <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>Créer mon compte →</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {step < 3 && (
        <TouchableOpacity style={s.obLoginLink} onPress={() => setShowLogin(true)}>
          <Text style={s.splashLogin}>Déjà un compte ? <Text style={s.splashLoginLink}>Se connecter</Text></Text>
        </TouchableOpacity>
      )}

      {step === 4 && (
        <ScrollView style={s.screen} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={s.headline}>Dernière étape.</Text>
          <Text style={s.subtext}>Ton parcours commence maintenant.</Text>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>PRÉNOM</Text>
            <TextInput style={s.inputField} placeholder="Yllan" placeholderTextColor="#444" value={name} onChangeText={setName} autoCapitalize="words" />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>EMAIL</Text>
            <TextInput style={s.inputField} placeholder="yllan@reiz.app" placeholderTextColor="#444" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>MOT DE PASSE</Text>
            <TextInput style={s.inputField} placeholder="••••••••" placeholderTextColor="#444" value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <TouchableOpacity style={[s.btn, { marginTop: 8 }, loading && s.btnDisabled]} onPress={loading ? undefined : handleSignUp}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Créer mon compte</Text>}
          </TouchableOpacity>
          <Text style={s.legal}>En créant un compte tu acceptes nos <Text style={s.legalLink}>CGU</Text></Text>
        </ScrollView>
      )}

    </KeyboardAvoidingView>
  );
}


// ============ TYPES ============
type Update = { id: string; caption: string; progress_value: number; created_at: string; photo_url?: string; users: any; };
type Objective = { id: string; emoji: string; title: string; current_value: number; target_value: number; unit: string; visibility: string; };
type Comment = { id: string; content: string; created_at: string; users: any; };
type Friend = { id: string; full_name: string; username: string; friendship_id: string; status: string; is_requester: boolean; };
type PendingRequest = { id: string; full_name: string; username: string; friendship_id: string; };

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return `Il y a ${Math.floor(diff / 86400)}j`;
}

async function calculateStreak(userId: string): Promise<number> {
  const { data, error } = await supabase.from('updates').select('created_at').eq('user_id', userId).order('created_at', { ascending: false });
  if (error || !data || data.length === 0) return 0;
  const days = [...new Set(data.map(u => new Date(u.created_at).toDateString()))];
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < days.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    if (days[i] === expected.toDateString()) streak++;
    else break;
  }
  return streak;
}

const EMOJI_LIST = ['🎯','💪','🏃','📚','🧘','🚀','🏋️','🏦','💰','❤️','🎵','🎨','✍️','🧠','🌍','🏊','🚴','⚽','🎾','🍎','😴','💼','📈','🔥'];
const REACTION_EMOJIS = ['❤️','🔥','💪','👏','😮','🎯','⚡','🙌'];

// ============ FLOATING EMOJI ============
let floatId = 0;
function FloatingEmoji({ emoji, onDone }: { emoji: string; onDone: () => void }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const drift = useRef((Math.random() - 0.5) * 50).current;
  const startX = useRef(Math.random() * 80 - 40).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -220, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(translateX, { toValue: drift * 0.4, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: drift, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(translateX, { toValue: drift * 0.7, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 250, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 200, useNativeDriver: true }),
        Animated.delay(1100),
        Animated.timing(scale, { toValue: 0.7, duration: 650, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        bottom: 50,
        left: '50%' as any,
        marginLeft: startX - 14,
        fontSize: 28,
        transform: [{ translateY }, { translateX }, { scale }],
        opacity,
        zIndex: 50,
        pointerEvents: 'none' as any,
      }}>
      {emoji}
    </Animated.Text>
  );
}

const ALL_REACTION_EMOJIS = ['❤️','🔥','💪','👏','😮','🎯','⚡','🙌','💯','🏆','✨','🚀','😂','🥹','😍','🤩','😎','💀','😭','😅','🤯','🥳','👍','🫶','❤️‍🔥','💥','🧠','👀','🏃','🚴','🏊','🧘','🏋️','🥊','🏅','🥇','💧','🍎','🥑','🍌','🎉','🌟','💫'];

// ============ MODAL COMMENTAIRES ============
function CommentsModal({ visible, updateId, onClose }: { visible: boolean; updateId: string; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('comments').select('id, content, created_at, users(full_name)').eq('update_id', updateId).order('created_at', { ascending: true });
    if (!error && data) setComments(data as unknown as Comment[]);
    setLoading(false);
  };

  useEffect(() => { if (visible && updateId) fetchComments(); }, [visible, updateId]);

  const handleSend = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }
    const { error } = await supabase.from('comments').insert({ update_id: updateId, user_id: user.id, content: newComment.trim() });
    setSending(false);
    if (!error) { setNewComment(''); fetchComments(); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>← Fermer</Text></TouchableOpacity>
            <Text style={s.modalTitle}>Commentaires</Text>
            <View style={{ width: 60 }} />
          </View>
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
          ) : (
            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              {comments.length === 0 ? (
                <View style={{ paddingTop: 40, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32 }}>💬</Text>
                  <Text style={{ color: '#555', marginTop: 10, fontSize: 14, fontWeight: '700' }}>Pas encore de commentaires</Text>
                  <Text style={{ color: '#444', marginTop: 4, fontSize: 12 }}>Sois le premier à commenter !</Text>
                </View>
              ) : comments.map((c) => (
                <View key={c.id} style={s.commentRow}>
                  <View style={s.commentAv}><Text style={s.commentAvText}>{(c.users?.full_name || 'U').charAt(0).toUpperCase()}</Text></View>
                  <View style={s.commentContent}>
                    <Text style={s.commentName}>{c.users?.full_name || 'Utilisateur'}</Text>
                    <Text style={s.commentText}>{c.content}</Text>
                    <Text style={s.commentTime}>{timeAgo(c.created_at)}</Text>
                  </View>
                </View>
              ))}
              <View style={{ height: 80 }} />
            </ScrollView>
          )}
          <View style={s.commentInputRow}>
            <TextInput style={s.commentInput} placeholder="Écris un commentaire..." placeholderTextColor="#444" value={newComment} onChangeText={setNewComment} multiline />
            <TouchableOpacity style={[s.sendBtn, (!newComment.trim() || sending) && s.sendBtnDisabled]} onPress={sending ? undefined : handleSend}>
              {sending ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.sendBtnText}>→</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============ FEED CARD ============
function FeedCard({ u, onRefresh }: { u: Update; onRefresh: () => void }) {
  const [reactions, setReactions] = useState<{[emoji: string]: number}>({});
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);

  const fetchReactions = async () => {
    const { data } = await supabase.from('reactions').select('type, user_id').eq('update_id', u.id);
    if (!data) return;
    const counts: {[emoji: string]: number} = {};
    data.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
    setReactions(counts);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) { setCurrentUserId(user.id); setMyReactions(data.filter(r => r.user_id === user.id).map(r => r.type)); }
  };

  const fetchCommentCount = async () => {
    const { count } = await supabase.from('comments').select('id', { count: 'exact', head: true }).eq('update_id', u.id);
    setCommentCount(count || 0);
  };

  useEffect(() => { fetchReactions(); fetchCommentCount(); }, [u.id]);

  const toggleReaction = async (emoji: string) => {
    if (!currentUserId) return;
    const isActive = myReactions.includes(emoji);
    // Snapshot pour rollback si la requête échoue
    const prevMy = myReactions;
    const prevCounts = reactions;
    setShowEmojiPicker(false);

    if (isActive) {
      // update optimiste
      setMyReactions(prev => prev.filter(e => e !== emoji));
      setReactions(prev => ({ ...prev, [emoji]: Math.max((prev[emoji] || 1) - 1, 0) }));
      const { error } = await supabase.from('reactions').delete().eq('update_id', u.id).eq('user_id', currentUserId).eq('type', emoji);
      if (error) { setMyReactions(prevMy); setReactions(prevCounts); }
    } else {
      setMyReactions(prev => [...prev, emoji]);
      setReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
      const id = ++floatId;
      setFloatingEmojis(prev => [...prev, { id, emoji }]);
      const { error } = await supabase.from('reactions').insert({ update_id: u.id, user_id: currentUserId, type: emoji });
      if (error) { setMyReactions(prevMy); setReactions(prevCounts); }
    }
  };

  const uname = u.users?.full_name || 'Utilisateur';
  const initial = uname.charAt(0).toUpperCase();
  const activeReactions = Object.entries(reactions).filter(([_, count]) => count > 0);

  return (
    <View style={[s.feedCard, { overflow: 'visible' }]}>
      <CommentsModal visible={showComments} updateId={u.id} onClose={() => { setShowComments(false); fetchCommentCount(); }} />

      {/* Emojis flottants */}
      {floatingEmojis.map(fe => (
        <FloatingEmoji
          key={fe.id}
          emoji={fe.emoji}
          onDone={() => setFloatingEmojis(prev => prev.filter(x => x.id !== fe.id))}
        />
      ))}

      {/* Photo hero */}
      {u.photo_url ? (
        <View style={s.feedPhotoWrap}>
          <Image source={{ uri: u.photo_url }} style={s.feedPhoto} resizeMode="cover" />

          {/* Header superposé en haut */}
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={s.feedOverlayTop}>
            <View style={s.feedOverlayHeader}>
              <View style={s.av}><Text style={s.avText}>{initial}</Text></View>
              <View style={s.cardMeta}>
                <Text style={s.cardName}>{uname}</Text>
                <Text style={s.cardTime}>{timeAgo(u.created_at)}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Fondu + réactions + actions en bas */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={s.feedOverlayBottom}>
            {/* Barre de progression */}
            <View style={s.feedOverlayProgress}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${Math.min(u.progress_value || 0, 100)}%` as any }]} />
              </View>
              <Text style={s.progressLabelOverlay}>{u.progress_value || 0}%</Text>
            </View>

            {/* Caption */}
            {u.caption ? <Text style={s.feedCaptionOverlay}>{u.caption}</Text> : null}

            {/* Réactions actives */}
            {activeReactions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.activeReactionsRow}>
                {activeReactions.map(([emoji, count]) => (
                  <TouchableOpacity key={emoji} style={[s.rxn, myReactions.includes(emoji) && s.rxnActive]} onPress={() => toggleReaction(emoji)}>
                    <Text style={s.rxnEmoji}>{emoji}</Text><Text style={s.rxnCount}>{count}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Actions */}
            <View style={s.actionsRow}>
              <TouchableOpacity style={s.actionBtn} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
                <Text style={s.actionEmoji}>😊</Text>
                <Text style={s.actionText}>Réagir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => setShowComments(true)}>
                <Text style={s.actionEmoji}>💬</Text>
                <Text style={s.actionText}>{commentCount > 0 ? `${commentCount}` : 'Commenter'}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      ) : (
        <View style={s.feedNoPhoto}>
          <View style={s.cardHeader}>
            <View style={s.av}><Text style={s.avText}>{initial}</Text></View>
            <View style={s.cardMeta}>
              <Text style={s.cardName}>{uname}</Text>
              <Text style={s.cardTime}>{timeAgo(u.created_at)}</Text>
            </View>
          </View>
          {u.caption ? <Text style={s.feedNoPhotoCaption}>{u.caption}</Text> : null}
          <View style={s.progressRow}>
            <View style={s.progressBg}><View style={[s.progressFill, { width: `${Math.min(u.progress_value || 0, 100)}%` as any }]} /></View>
            <Text style={s.progressLabel}>{u.progress_value || 0}%</Text>
          </View>
          {/* Réactions + actions pour post sans photo */}
          {activeReactions.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.activeReactionsRow}>
              {activeReactions.map(([emoji, count]) => (
                <TouchableOpacity key={emoji} style={[s.rxn, myReactions.includes(emoji) && s.rxnActive]} onPress={() => toggleReaction(emoji)}>
                  <Text style={s.rxnEmoji}>{emoji}</Text><Text style={s.rxnCount}>{count}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
              <Text style={s.actionEmoji}>😊</Text>
              <Text style={s.actionText}>Réagir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => setShowComments(true)}>
              <Text style={s.actionEmoji}>💬</Text>
              <Text style={s.actionText}>{commentCount > 0 ? `${commentCount}` : 'Commenter'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.emojiPickerRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
          {ALL_REACTION_EMOJIS.map(emoji => (
            <TouchableOpacity key={emoji} style={[s.emojiPickerItem, myReactions.includes(emoji) && s.emojiPickerItemActive]} onPress={() => toggleReaction(emoji)}>
              <Text style={s.emojiPickerItemText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const UNITS = ['%', 'km', 'm', 'kg', 'lbs', 'min', 'h', 'x', '€', 'L', 'ml', 'pages', 'j', 'séances', 'fois'];
const ITEM_H = 44;

function WheelPicker({ selected, onSelect }: { selected: string; onSelect: (u: string) => void }) {
  const ref = useRef<ScrollView>(null);
  const idx = UNITS.indexOf(selected) === -1 ? 0 : UNITS.indexOf(selected);

  useEffect(() => {
    setTimeout(() => ref.current?.scrollTo({ y: idx * ITEM_H, animated: false }), 50);
  }, []);

  return (
    <View style={s.wheelWrap}>
      <View style={s.wheelSelector} pointerEvents="none" />
      <ScrollView
        ref={ref}
        style={s.wheelScroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        onMomentumScrollEnd={e => {
          const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          onSelect(UNITS[Math.max(0, Math.min(i, UNITS.length - 1))]);
        }}
      >
        {UNITS.map((u, i) => (
          <View key={u} style={s.wheelItem}>
            <Text style={[s.wheelItemText, selected === u && s.wheelItemTextActive]}>{u}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ============ MODAL CRÉATION OBJECTIF ============
function CreateObjectiveModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('%');
  const [targetValue, setTargetValue] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setUnit('%'); setTargetValue(''); setVisibility('public'); };

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Erreur', 'Donne un nom à ton objectif !'); return; }
    if (!targetValue || isNaN(Number(targetValue))) { Alert.alert('Erreur', 'Entre une valeur cible valide.'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); Alert.alert('Erreur', 'Tu dois être connecté.'); return; }
    const { error } = await supabase.from('objectives').insert({
      user_id: user.id, title: title.trim(), emoji: '🎯',
      target_value: Number(targetValue), current_value: 0,
      unit: unit, visibility,
    });
    setSaving(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    Alert.alert('Objectif créé ! 🎯', `"${title}" est ajouté à tes objectifs.`);
    reset(); onCreated();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView style={s.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={s.modalCancel}>Annuler</Text></TouchableOpacity>
          <Text style={s.modalTitle}>Nouvel objectif</Text>
          <TouchableOpacity onPress={saving ? undefined : handleCreate}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSave}>Créer</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>NOM DE L'OBJECTIF</Text>
            <TextInput style={s.inputField} placeholder="Ex: Courir 10 km, Lire 12 livres..." placeholderTextColor="#444" value={title} onChangeText={setTitle} autoCapitalize="sentences" />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>VALEUR CIBLE</Text>
            <TextInput style={s.inputField} placeholder="Ex: 10, 100, 12..." placeholderTextColor="#444" value={targetValue} onChangeText={setTargetValue} keyboardType="numeric" />
          </View>

          <Text style={s.inputLabel}>UNITÉ</Text>
          <WheelPicker selected={unit} onSelect={setUnit} />
          <Text style={s.inputLabel}>VISIBILITÉ</Text>
          <View style={s.visToggle}>
            {[{ key: 'public', label: '🌍 Public' }, { key: 'friends', label: '👥 Amis' }, { key: 'private', label: '🔒 Privé' }].map(v => (
              <TouchableOpacity key={v.key} style={[s.visOpt, visibility === v.key && s.visOptActive]} onPress={() => setVisibility(v.key)}>
                <Text style={[s.visOptText, visibility === v.key && s.visOptTextActive]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ============ ONGLET AMIS ============
function FriendsTab() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { setCurrentUserId(user.id); fetchFriends(user.id); }
    };
    init();
  }, []);

  const fetchFriends = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('friendships')
      .select('id, status, requester_id, receiver_id, requester:users!friendships_requester_id_fkey(id, full_name, username), receiver:users!friendships_receiver_id_fkey(id, full_name, username)')
      .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`);
    if (!error && data) {
      const accepted: Friend[] = [];
      const pendingReqs: PendingRequest[] = [];
      data.forEach((f: any) => {
        const isRequester = f.requester_id === uid;
        const other = isRequester ? f.receiver : f.requester;
        if (!other) return;
        if (f.status === 'accepted') accepted.push({ id: other.id, full_name: other.full_name, username: other.username, friendship_id: f.id, status: f.status, is_requester: isRequester });
        else if (f.status === 'pending' && !isRequester) pendingReqs.push({ id: other.id, full_name: other.full_name, username: other.username, friendship_id: f.id });
      });
      setFriends(accepted); setPending(pendingReqs);
      loadSuggestions(uid, accepted.map(f => f.id));
    }
    setLoading(false);
  };

  const loadSuggestions = async (uid: string, friendIds: string[]) => {
    const { data: myObjs } = await supabase.from('objectives').select('title').eq('user_id', uid);
    if (!myObjs || myObjs.length === 0) return;
    const myKeywords = myObjs.flatMap((o: any) => o.title.toLowerCase().split(/\s+/)).filter((w: string) => w.length > 3);
    const { data } = await supabase.from('objectives').select('user_id, title, users!inner(id, full_name, username)').neq('user_id', uid).limit(40);
    if (!data) return;
    const excluded = new Set([uid, ...friendIds]);
    const seen = new Set<string>();
    const result: any[] = [];
    for (const o of data as any[]) {
      if (excluded.has(o.user_id) || seen.has(o.user_id)) continue;
      seen.add(o.user_id);
      const objWords = o.title.toLowerCase().split(/\s+/);
      const match = myKeywords.some((k: string) => objWords.some((w: string) => w.includes(k) || k.includes(w)));
      result.push({ ...o.users, objectiveTitle: o.title, match });
    }
    result.sort((a, b) => Number(b.match) - Number(a.match));
    setSuggestions(result.slice(0, 6));
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data, error } = await supabase.from('users').select('id, full_name, username').ilike('full_name', `%${query}%`).neq('id', currentUserId || '').limit(8);
    if (!error && data) setSearchResults(data);
    setSearching(false);
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('friendships').insert({ requester_id: currentUserId, receiver_id: receiverId, status: 'pending' });
    if (error) { if (error.code === '23505') Alert.alert('Déjà envoyé', 'Une demande est déjà en cours.'); else Alert.alert('Erreur', error.message); return; }
    Alert.alert('Demande envoyée ! 🤝', 'En attente de confirmation.');
    setSearchResults([]); setSearchQuery('');
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    if (currentUserId) fetchFriends(currentUserId);
  };

  const declineRequest = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    if (currentUserId) fetchFriends(currentUserId);
  };

  const removeFriend = async (friendshipId: string, friendName: string) => {
    Alert.alert('Supprimer', `Retirer ${friendName} de tes amis ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('friendships').delete().eq('id', friendshipId);
        if (currentUserId) fetchFriends(currentUserId);
      }}
    ]);
  };

  const getFriendshipStatus = (userId: string) => friends.find(f => f.id === userId) ? 'ami' : null;

  return (
    <ScrollView style={s.feed} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

      {/* Barre de recherche */}
      <View style={s.searchBarActive}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput style={s.searchInput} placeholder="Chercher par prénom..." placeholderTextColor="#333" value={searchQuery} onChangeText={handleSearch} autoCapitalize="none" />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
            <Text style={{ color: '#444', fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Résultats de recherche */}
      {searchResults.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={s.sectionTitle}>RÉSULTATS</Text>
          {searching && <ActivityIndicator color="#fff" style={{ marginBottom: 10 }} />}
          {searchResults.map((u) => (
            <View key={u.id} style={s.friendRow}>
              <View style={s.friendRowAv}><Text style={s.friendRowAvText}>{u.full_name.charAt(0).toUpperCase()}</Text></View>
              <View style={s.friendRowInfo}>
                <Text style={s.friendRowName}>{u.full_name}</Text>
                <Text style={s.friendRowSub}>@{u.username}</Text>
              </View>
              {getFriendshipStatus(u.id) === 'ami' ? (
                <View style={s.friendBadge}><Text style={s.friendBadgeText}>✓ Ami</Text></View>
              ) : (
                <TouchableOpacity style={s.addFriendBtn} onPress={() => sendFriendRequest(u.id)}>
                  <Text style={s.addFriendBtnText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Demandes reçues */}
      {pending.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={s.sectionTitle}>DEMANDES REÇUES · {pending.length}</Text>
          {pending.map((p) => (
            <View key={p.friendship_id} style={s.friendRow}>
              <View style={[s.friendRowAv, { borderWidth: 1.5, borderColor: '#fff' }]}>
                <Text style={s.friendRowAvText}>{p.full_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={s.friendRowInfo}>
                <Text style={s.friendRowName}>{p.full_name}</Text>
                <Text style={s.friendRowSub}>@{p.username}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={s.acceptBtn} onPress={() => acceptRequest(p.friendship_id)}>
                  <Text style={s.acceptBtnText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.declineBtn} onPress={() => declineRequest(p.friendship_id)}>
                  <Text style={s.declineBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Découverte par objectif commun */}
      {suggestions.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text style={s.sectionTitle}>MÊME OBJECTIF</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestScroll} contentContainerStyle={{ gap: 12 }}>
            {suggestions.map((u) => (
              <View key={u.id} style={s.suggestCard}>
                <View style={s.suggestAv}><Text style={s.suggestAvText}>{u.full_name.charAt(0).toUpperCase()}</Text></View>
                <Text style={s.suggestName} numberOfLines={1}>{u.full_name}</Text>
                <Text style={s.suggestObj} numberOfLines={2}>{u.objectiveTitle}</Text>
                <TouchableOpacity style={s.suggestAddBtn} onPress={() => sendFriendRequest(u.id)}>
                  <Text style={s.suggestAddText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Liste d'amis */}
      <Text style={s.sectionTitle}>{friends.length > 0 ? `${friends.length} AMI${friends.length > 1 ? 'S' : ''}` : 'MES AMIS'}</Text>
      {loading ? (
        <View style={{ paddingTop: 20, alignItems: 'center' }}><ActivityIndicator color="#fff" /></View>
      ) : friends.length === 0 ? (
        <View style={{ paddingTop: 30, alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 36 }}>👥</Text>
          <Text style={{ color: '#555', fontSize: 15, fontWeight: '700' }}>Pas encore d'amis</Text>
          <Text style={{ color: '#333', fontSize: 13 }}>Cherche des amis par leur prénom</Text>
        </View>
      ) : friends.map((f) => (
        <TouchableOpacity key={f.friendship_id} style={s.friendRow} onLongPress={() => removeFriend(f.friendship_id, f.full_name)} activeOpacity={0.8}>
          <View style={[s.friendRowAv, s.friendRowAvActive]}>
            <Text style={s.friendRowAvText}>{f.full_name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={s.friendRowInfo}>
            <Text style={s.friendRowName}>{f.full_name}</Text>
            <Text style={s.friendRowSub}>@{f.username}</Text>
          </View>
          <View style={s.friendBadge}><Text style={s.friendBadgeText}>✓</Text></View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ============ PROFIL ============
function ProfileScreen({ onClose, streak }: { onClose: () => void; streak: number }) {
  const [profile, setProfile] = useState<any>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<Update[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [profileRes, objRes, updatesRes, friendsRes] = await Promise.all([
      supabase.from('users').select('full_name, username, created_at, avatar_url').eq('id', user.id).single(),
      supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('updates').select('id, caption, progress_value, created_at, photo_url, users(full_name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('friendships').select('id').or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`).eq('status', 'accepted'),
    ]);
    if (profileRes.data) { setProfile(profileRes.data); setNewName(profileRes.data.full_name); }
    if (objRes.data) setObjectives(objRes.data as Objective[]);
    if (updatesRes.data) setRecentUpdates(updatesRes.data as unknown as Update[]);
    if (friendsRes.data) setFriendCount(friendsRes.data.length);
    setLoading(false);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from('users').update({ full_name: newName.trim() }).eq('id', user.id);
    setSaving(false); setEditingName(false); loadProfile();
  };

  const handlePickAvatar = async () => {
    Alert.alert('Photo de profil', 'Choisis une option', [
      {
        text: '📷 Prendre une photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la caméra dans les réglages.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled) uploadAvatar(result.assets[0].uri);
        }
      },
      {
        text: '🖼️ Importer depuis la galerie',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la galerie dans les réglages.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled) uploadAvatar(result.assets[0].uri);
        }
      },
      { text: 'Annuler', style: 'cancel' }
    ]);
  };

  const uploadAvatar = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const fileName = `avatars/${user.id}.jpg`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      await supabase.storage.from('updates').upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      const { data } = supabase.storage.from('updates').getPublicUrl(fileName);
      await supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', user.id);
      loadProfile();
    } catch (_) {}
    setUploadingAvatar(false);
  };

  const handleSignOut = async () => {
    Alert.alert('Déconnexion', 'Tu veux vraiment te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => supabase.auth.signOut() }
    ]);
  };

  const handleDeleteUpdate = (id: string) => {
    Alert.alert(
      'Supprimer la publication',
      'Cette publication ainsi que ses réactions et commentaires seront supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('reactions').delete().eq('update_id', id);
            await supabase.from('comments').delete().eq('update_id', id);
            const { error } = await supabase.from('updates').delete().eq('id', id);
            if (error) { Alert.alert('Erreur', error.message); return; }
            loadProfile();
          }
        }
      ]
    );
  };

  const progressPct = (o: Objective) => o.target_value > 0 ? Math.min(Math.round((o.current_value / o.target_value) * 100), 100) : 0;
  const initial = profile?.full_name?.charAt(0).toUpperCase() || '?';
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onClose}><Text style={s.backText}>←</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Mon profil</Text>
        <View style={{ width: 34 }} />
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
      ) : (
        <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
          <View style={s.profileHero}>
            <TouchableOpacity style={s.profileAvatarWrap} onPress={handlePickAvatar} activeOpacity={0.8}>
              {profile?.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={s.profileAvatarImg} />
                : <View style={s.profileAvatar}><Text style={s.profileAvatarText}>{initial}</Text></View>
              }
              {uploadingAvatar
                ? <View style={s.profileAvatarOverlay}><ActivityIndicator color="#fff" /></View>
                : <View style={s.profileAvatarOverlay}><Text style={s.profileAvatarEditIcon}>📷</Text></View>
              }
            </TouchableOpacity>
            {editingName ? (
              <View style={s.profileNameEdit}>
                <TextInput style={s.profileNameInput} value={newName} onChangeText={setNewName} autoFocus autoCapitalize="words" placeholderTextColor="#444" />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={s.profileSaveBtn} onPress={saving ? undefined : handleSaveName}>
                    {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.profileSaveBtnText}>Sauvegarder</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.profileCancelBtn} onPress={() => { setEditingName(false); setNewName(profile?.full_name || ''); }}>
                    <Text style={s.profileCancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingName(true)}>
                <Text style={s.profileName}>{profile?.full_name || 'Utilisateur'}</Text>
                <Text style={s.profileEditHint}>Appuie pour modifier ✏️</Text>
              </TouchableOpacity>
            )}
            <Text style={s.profileUsername}>@{profile?.username}</Text>
            <Text style={s.profileMember}>Membre depuis {memberSince}</Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.statPill}><Text style={s.statVal}>🔥 {streak}j</Text><Text style={s.statLbl}>Streak</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>{objectives.length}</Text><Text style={s.statLbl}>Objectifs</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>{friendCount}</Text><Text style={s.statLbl}>Amis</Text></View>
          </View>

          <Text style={s.sectionTitle}>MES OBJECTIFS</Text>
          {objectives.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}><Text style={{ color: '#555', fontSize: 13 }}>Aucun objectif pour l'instant</Text></View>
          ) : objectives.map((o) => (
            <View key={o.id} style={s.profileObjRow}>
              <Text style={s.profileObjEmoji}>{o.emoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.profileObjName}>{o.title}</Text>
                <View style={s.progressBg}><View style={[s.progressFill, { width: `${progressPct(o)}%` as any }]} /></View>
              </View>
              <Text style={s.profileObjPct}>{progressPct(o)}%</Text>
            </View>
          ))}

          <Text style={s.sectionTitle}>PUBLICATIONS RÉCENTES</Text>
          {recentUpdates.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}><Text style={{ color: '#555', fontSize: 13 }}>Aucune publication pour l'instant</Text></View>
          ) : recentUpdates.map((u) => (
            <Pressable key={u.id} style={s.profileUpdateRow} onLongPress={() => handleDeleteUpdate(u.id)}>
              {u.photo_url && <Image source={{ uri: u.photo_url }} style={s.profileUpdatePhoto} resizeMode="cover" />}
              <View style={{ flex: 1 }}>
                <Text style={s.profileUpdateCaption} numberOfLines={2}>{u.caption}</Text>
                <Text style={s.profileUpdateTime}>{timeAgo(u.created_at)}</Text>
              </View>
              <View style={s.profileProgressBadge}><Text style={s.profileProgressBadgeText}>{u.progress_value || 0}</Text></View>
            </Pressable>
          ))}
          {recentUpdates.length > 0 && (
            <Text style={{ color: '#333', fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 8 }}>
              Appui long sur une publication pour la supprimer
            </Text>
          )}

          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
            <Text style={s.signOutBtnText}>Se déconnecter</Text>
          </TouchableOpacity>
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ============ MAIN ============
function Main({ onPost }: { onPost: () => void }) {
  const [tab, setTab] = useState('feed');
  const [updates, setUpdates] = useState<Update[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingObj, setLoadingObj] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showProfile, setShowProfile] = useState(false);

  const fetchUpdates = async () => {
    setLoadingFeed(true);
    const { data, error } = await supabase.from('updates').select('id, caption, progress_value, created_at, photo_url, users(full_name, username)').order('created_at', { ascending: false }).limit(20);
    if (!error && data) setUpdates(data as unknown as Update[]);
    setLoadingFeed(false);
  };

  const fetchObjectives = async () => {
    setLoadingObj(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingObj(false); return; }
    const { data, error } = await supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility').eq('user_id', user.id).order('created_at', { ascending: false });
    if (!error && data) setObjectives(data as Objective[]);
    setLoadingObj(false);
  };

  // ✅ Suppression d'objectif — supprime aussi les updates liées (au cas où la BDD n'a pas ON DELETE CASCADE)
  const handleDeleteObjective = (id: string, title: string) => {
    Alert.alert(
      "Supprimer l'objectif",
      `Supprimer "${title}" ? Toutes ses mises à jour seront aussi supprimées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('updates').delete().eq('objective_id', id);
            const { error } = await supabase.from('objectives').delete().eq('id', id);
            if (error) { Alert.alert('Erreur', error.message); return; }
            fetchObjectives();
            fetchUpdates();
          }
        }
      ]
    );
  };

  useEffect(() => {
    fetchUpdates();
    fetchObjectives();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) calculateStreak(user.id).then(setStreak);
    });
  }, []);

  const progressPct = (obj: Objective) => obj.target_value > 0 ? Math.min(Math.round((obj.current_value / obj.target_value) * 100), 100) : 0;

  if (showProfile) return <ProfileScreen onClose={() => setShowProfile(false)} streak={streak} />;

  return (
    <View style={s.container}>
      <CreateObjectiveModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchObjectives(); }} />

      <View style={s.header}>
        <Image source={require('./assets/ecriture-reiz-blanc.png')} style={s.headerLogo} resizeMode="contain" />
        <FlameStreak streak={streak} />
      </View>

      {tab === 'feed' && (
        <View style={{ flex: 1 }}>
        <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={s.myUpdate} onPress={onPost} activeOpacity={0.85}>
            <View style={s.myUpdateInfo}>
              <Text style={s.myUpdateTitle}>Poste ta progression</Text>
              <Text style={s.myUpdateSub}>Ton cercle t'attend aujourd'hui 👀</Text>
            </View>
            <View style={s.postedBadge}><Text style={s.postedBadgeText}>Publier →</Text></View>
          </TouchableOpacity>
          {loadingFeed ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}>
              <ActivityIndicator color="#fff" />
              <Text style={{ color: '#555', marginTop: 10, fontSize: 13 }}>Chargement du feed...</Text>
            </View>
          ) : updates.length === 0 ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>🌱</Text>
              <Text style={{ color: '#555', marginTop: 10, fontSize: 14, fontWeight: '700' }}>Aucune mise à jour pour l'instant</Text>
              <Text style={{ color: '#444', marginTop: 4, fontSize: 12 }}>Sois le premier à publier !</Text>
            </View>
          ) : updates.map((u) => <FeedCard key={u.id} u={u} onRefresh={fetchUpdates} />)}
          <View style={{ height: 100 }} />
        </ScrollView>
        <LinearGradient
          colors={['#0a0a0a', 'transparent']}
          style={s.feedTopFade}
          pointerEvents="none"
        />
        </View>
      )}

      {tab === 'objectives' && (
        <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
          <View style={s.statsRow}>
            <View style={s.statPill}><Text style={s.statVal}>{objectives.length}</Text><Text style={s.statLbl}>Actifs</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>🔥 {streak}j</Text><Text style={s.statLbl}>Streak</Text></View>
            <View style={s.statPill}>
              <Text style={s.statVal}>{objectives.length > 0 ? Math.round(objectives.reduce((acc, o) => acc + progressPct(o), 0) / objectives.length) : 0}%</Text>
              <Text style={s.statLbl}>Moy.</Text>
            </View>
          </View>
          {loadingObj ? <View style={{ paddingTop: 30, alignItems: 'center' }}><ActivityIndicator color="#fff" /></View>
            : objectives.length === 0 ? (
              <View style={{ paddingTop: 30, alignItems: 'center' }}>
                <Text style={{ fontSize: 32 }}>🎯</Text>
                <Text style={{ color: '#555', marginTop: 10, fontSize: 14, fontWeight: '700' }}>Aucun objectif pour l'instant</Text>
                <Text style={{ color: '#444', marginTop: 4, fontSize: 12 }}>Crée ton premier objectif !</Text>
              </View>
            ) : objectives.map((o) => {
              const pct = progressPct(o);
              return (
                // ✅ Long press pour supprimer — Pressable évite les conflits de tap avec le bouton enfant
                <Pressable
                  key={o.id}
                  style={s.objCard}
                  onLongPress={() => handleDeleteObjective(o.id, o.title)}
                >
                  <View style={s.objCardTop}>
                    <Text style={s.objEmoji}>{o.emoji}</Text>
                    <View style={[s.visBadge, o.visibility === 'public' && s.visBadgePublic]}>
                      <Text style={[s.visText, o.visibility === 'public' && s.visTextPublic]}>
                        {o.visibility === 'public' ? 'Public' : o.visibility === 'friends' ? 'Amis' : 'Privé'}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.objCardName}>{o.title}</Text>
                  <Text style={s.objCardSub}>{o.current_value} {o.unit} sur {o.target_value}</Text>
                  <View style={s.objProgressRow}>
                    <View style={s.objProgressBg}>
                      <View style={[s.objProgressFill, { width: `${pct}%` as any }]} />
                    </View>
                    <Text style={s.objPct}>{pct}%</Text>
                  </View>
                  <TouchableOpacity style={s.updateBtn} onPress={onPost}>
                    <Text style={s.updateBtnText}>+ Mise à jour</Text>
                  </TouchableOpacity>
                </Pressable>
              );
            })
          }
          {/* Hint suppression */}
          {objectives.length > 0 && (
            <Text style={{ color: '#333', fontSize: 11, textAlign: 'center', marginBottom: 8 }}>
              Appui long sur un objectif pour le supprimer
            </Text>
          )}
          <TouchableOpacity style={s.addObjBtn} onPress={() => setShowCreateModal(true)}>
            <Text style={s.addObjBtnText}>+ Ajouter un objectif</Text>
          </TouchableOpacity>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {tab === 'friends' && <FriendsTab />}

      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navItem} onPress={() => setTab('feed')}>
          <Text style={[s.navIcon, tab === 'feed' && s.navIconActive]}>⊞</Text>
          <Text style={[s.navLabel, tab === 'feed' && s.navLabelActive]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setTab('objectives')}>
          <Text style={[s.navIcon, tab === 'objectives' && s.navIconActive]}>◎</Text>
          <Text style={[s.navLabel, tab === 'objectives' && s.navLabelActive]}>Objectifs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={onPost}>
          <View style={s.navPostBtn}><Text style={s.navPostBtnText}>+</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setTab('friends')}>
          <Ionicons name="people" size={22} color={tab === 'friends' ? '#fff' : '#444'} />
          <Text style={[s.navLabel, tab === 'friends' && s.navLabelActive]}>Amis</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setShowProfile(true)}>
          <Text style={s.navIcon}>◉</Text>
          <Text style={s.navLabel}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============ POST ============
function Post({ onBack, onPublish }: { onBack: () => void, onPublish: () => void }) {
  const [selectedObj, setSelectedObj] = useState(0);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loadingObj, setLoadingObj] = useState(true);
  const [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingObj(false); return; }
      const { data, error } = await supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!error && data) setObjectives(data as Objective[]);
      setLoadingObj(false);
    };
    load();
  }, []);

  const obj = objectives[selectedObj];

  const handlePickPhoto = async () => {
    Alert.alert('Ajouter une photo', 'Choisis une option', [
      {
        text: '📷 Prendre une photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la caméra dans les réglages.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        }
      },
      {
        text: '🖼️ Importer depuis la galerie',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la galerie dans les réglages.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        }
      },
      { text: 'Annuler', style: 'cancel' }
    ]);
  };

  const uploadPhoto = async (uri: string, userId: string): Promise<string | null> => {
    try {
      setUploadingPhoto(true);
      const fileName = `${userId}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error } = await supabase.storage.from('updates').upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
      if (error) { Alert.alert('Erreur upload', error.message); setUploadingPhoto(false); return null; }
      const { data } = supabase.storage.from('updates').getPublicUrl(fileName);
      setUploadingPhoto(false);
      return data.publicUrl;
    } catch (e: any) { setUploadingPhoto(false); return null; }
  };

  const handlePublish = async () => {
    if (!obj) { Alert.alert('Erreur', 'Sélectionne un objectif.'); return; }
    setPublishing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPublishing(false); Alert.alert('Erreur', 'Tu dois être connecté.'); return; }
    let photoUrl: string | null = null;
    if (photoUri) photoUrl = await uploadPhoto(photoUri, user.id);
    const progressValue = Math.round((progress / 100) * obj.target_value * 10) / 10;
    const { error } = await supabase.from('updates').insert({
      user_id: user.id, objective_id: obj.id,
      caption: caption || obj.title,
      progress_value: progressValue,
      photo_url: photoUrl,
    });
    setPublishing(false);
    if (error) { Alert.alert('Erreur', error.message); }
    else { Alert.alert('Publié ! 🚀', 'Ta mise à jour est en ligne.'); onPublish(); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack}><Text style={s.backText}>←</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Poste ta progression</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Photo */}
        <TouchableOpacity style={s.postPhotoZone} onPress={handlePickPhoto} activeOpacity={0.85}>
          {photoUri
            ? <>
                <Image source={{ uri: photoUri }} style={s.postPhotoImg} resizeMode="cover" />
                <View style={s.postPhotoChangeBadge}>
                  <Text style={s.postPhotoChangeText}>Changer</Text>
                </View>
              </>
            : <View style={s.postPhotoEmpty}>
                <Text style={s.postPhotoEmptyIcon}>📷</Text>
                <Text style={s.postPhotoEmptyText}>Ajoute une photo</Text>
                <Text style={s.postPhotoEmptyHint}>Optionnel — mais fortement recommandé</Text>
              </View>
          }
        </TouchableOpacity>

        <View style={s.postBody}>
          {/* Objectif */}
          <Text style={s.postLabel}>OBJECTIF</Text>
          {loadingObj
            ? <ActivityIndicator color="#fff" style={{ marginBottom: 20 }} />
            : objectives.length === 0
              ? <View style={s.postEmptyObj}>
                  <Text style={{ color: '#555', fontSize: 13 }}>Aucun objectif — crée-en un dans "Mes objectifs"</Text>
                </View>
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.postObjScroll} contentContainerStyle={{ gap: 10 }}>
                  {objectives.map((o, i) => (
                    <TouchableOpacity key={o.id} style={[s.postObjCard, selectedObj === i && s.postObjCardActive]} onPress={() => setSelectedObj(i)}>
                      <Text style={s.postObjEmoji}>{o.emoji}</Text>
                      <Text style={[s.postObjTitle, selectedObj === i && s.postObjTitleActive]} numberOfLines={2}>{o.title}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
          }

          {/* Progression */}
          {obj && <>
            <Text style={[s.postLabel, { marginTop: 28 }]}>PROGRESSION</Text>
            <View style={s.postProgressWrap}>
              <TouchableOpacity style={s.postProgressBtn} onPress={() => setProgress(p => Math.max(0, p - 5))}>
                <Text style={s.postProgressBtnText}>−</Text>
              </TouchableOpacity>
              <View style={s.postProgressCenter}>
                <Text style={s.postProgressPct}>{progress}%</Text>
                <Text style={s.postProgressVal}>{Math.round((progress / 100) * obj.target_value * 10) / 10} {obj.unit} / {obj.target_value}</Text>
                <View style={s.postProgressBar}>
                  <View style={[s.postProgressFill, { width: `${progress}%` as any }]} />
                </View>
              </View>
              <TouchableOpacity style={s.postProgressBtn} onPress={() => setProgress(p => Math.min(100, p + 5))}>
                <Text style={s.postProgressBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </>}

          {/* Caption */}
          <Text style={[s.postLabel, { marginTop: 28 }]}>CAPTION</Text>
          <TextInput
            style={s.postCaptionInput}
            placeholder="Décris ta séance, ton ressenti..."
            placeholderTextColor="#333"
            value={caption}
            onChangeText={setCaption}
            multiline
          />
        </View>
      </ScrollView>

      <View style={s.ctaContainer}>
        <TouchableOpacity
          style={[s.cta, (!obj || publishing || uploadingPhoto) && s.btnDisabled]}
          onPress={!obj || publishing || uploadingPhoto ? undefined : handlePublish}>
          {publishing || uploadingPhoto
            ? <ActivityIndicator color="#000" />
            : <Text style={s.ctaText}>Publier</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ============ STYLES ============
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  btn: { width: '100%', backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#1e1e1e' },
  btnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  btnTextDisabled: { color: '#444' },
  obTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  obBackArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  obBackArrowText: { fontSize: 22, color: '#fff' },
  obProgress: { flex: 1, flexDirection: 'row', gap: 6 },
  obProgressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#222' },
  obProgressBarActive: { backgroundColor: '#fff' },
  splashContainer: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  splashLogo: { width: 340, height: 118, marginBottom: -16, alignSelf: 'center' },
  splashTagline: { fontSize: 10, color: '#555', letterSpacing: 3 },
  splashBottom: { position: 'absolute', bottom: 48, left: 28, right: 28 },
  splashLogin: { fontSize: 12, color: '#555', textAlign: 'center', marginTop: 14 },
  splashLoginLink: { color: '#fff', fontWeight: '700' },
  obContainer: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60, paddingHorizontal: 24 },
  obTapZones: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', zIndex: 1 },
  obTapLeft: { flex: 1 },
  obTapRight: { flex: 1 },
  obLoginLink: { position: 'absolute', bottom: 44, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  obScreen: { flex: 1, justifyContent: 'space-between', paddingBottom: 40 },
  obBigTitle: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -1, lineHeight: 42, marginBottom: 20 },
  obBody: { fontSize: 16, color: '#666', lineHeight: 26 },
  obBottom: { marginTop: 'auto' as any, paddingTop: 40 },
  obGoalInput: { backgroundColor: '#111', borderRadius: 18, padding: 18, fontSize: 16, color: '#fff', lineHeight: 24, marginTop: 24, minHeight: 100, textAlignVertical: 'top' },
  screen: { flex: 1 },
  eyebrow: { fontSize: 11, color: '#555', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  headline: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.8, marginBottom: 10, lineHeight: 34 },
  subtext: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 28 },
  cards: { gap: 10, marginBottom: 28 },
  card: { backgroundColor: '#111', borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  cardEmoji: { fontSize: 28 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#555', lineHeight: 18 },
  pillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, backgroundColor: '#111' },
  pillActive: { backgroundColor: '#fff' },
  pillEmoji: { fontSize: 14 },
  pillText: { fontSize: 13, fontWeight: '700', color: '#666' },
  pillTextActive: { color: '#000' },
  inputBlock: { marginBottom: 12 },
  inputLabel: { fontSize: 10, color: '#555', letterSpacing: 1.5, fontWeight: '700', marginBottom: 6 },
  inputField: { backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, fontSize: 14, color: '#fff' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#222' },
  dividerText: { fontSize: 12, color: '#555' },
  appleBtn: { backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, alignItems: 'center' },
  appleBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  obBackBtn: { paddingVertical: 14, alignItems: 'center' },
  obBackText: { fontSize: 13, color: '#555' },
  legal: { fontSize: 11, color: '#444', textAlign: 'center', marginTop: 12 },
  legalLink: { color: '#888', fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 58, paddingBottom: 12 },
  headerLogo: { width: 72, height: 26 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  streakBadge: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#2a2a2a', flexDirection: 'row', alignItems: 'center', gap: 3 },
  streakFlame: { fontWeight: '700' },
  streakText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 14 },
  feed: { flex: 1, paddingHorizontal: 12, paddingTop: 8 },
  feedTopFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 60 },
  myUpdate: { backgroundColor: '#161616', borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  myUpdateLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  myAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  myAvText: { fontSize: 20, fontWeight: '300', color: '#000', lineHeight: 26 },
  myUpdateInfo: { flex: 1 },
  myUpdateTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  myUpdateSub: { fontSize: 12, color: '#555', marginTop: 2 },
  postedBadge: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  postedBadgeText: { fontSize: 12, fontWeight: '800', color: '#000' },
  feedCard: { backgroundColor: '#111', borderRadius: 24, marginBottom: 16, overflow: 'hidden' },
  feedPhotoWrap: { position: 'relative' },
  feedPhoto: { width: '100%', height: 360 },
  feedOverlayTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 40 },
  feedOverlayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  feedOverlayBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 60 },
  feedOverlayProgress: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 8 },
  feedCaptionOverlay: { fontSize: 13, color: 'rgba(255,255,255,0.85)', paddingHorizontal: 14, paddingBottom: 6, lineHeight: 18 },
  feedNoPhoto: { padding: 16, paddingBottom: 8 },
  feedNoPhotoCaption: { fontSize: 16, color: '#fff', fontWeight: '600', marginTop: 10, marginBottom: 14, lineHeight: 22 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  av: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#333' },
  avText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  cardMeta: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cardTime: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  progressBg: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
  progressFill: { height: 2, backgroundColor: '#fff', borderRadius: 2 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: '#666' },
  progressLabelOverlay: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  feedCaption: { fontSize: 14, color: '#aaa', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2, lineHeight: 20 },
  activeReactionsRow: { paddingHorizontal: 14, paddingBottom: 6, flexGrow: 0 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1c1c1c', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8 },
  actionEmoji: { fontSize: 15 },
  actionText: { fontSize: 13, color: '#888', fontWeight: '600' },
  rxn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1c1c1c', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, marginBottom: 8 },
  rxnActive: { backgroundColor: '#2a2a2a' },
  rxnEmoji: { fontSize: 14 },
  rxnCount: { fontSize: 12, color: '#888', fontWeight: '700' },
  emojiPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 },
  emojiPickerItem: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1c1c1c', alignItems: 'center', justifyContent: 'center' },
  emojiPickerItemActive: { backgroundColor: '#2a2a2a', borderWidth: 1.5, borderColor: '#fff' },
  emojiPickerItemText: { fontSize: 20 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentAv: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  commentContent: { flex: 1, backgroundColor: '#141414', borderRadius: 14, padding: 10 },
  commentName: { fontSize: 12, fontWeight: '700', color: '#fff', marginBottom: 3 },
  commentText: { fontSize: 13, color: '#ccc', lineHeight: 18 },
  commentTime: { fontSize: 10, color: '#555', marginTop: 4 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1a1a1a', backgroundColor: '#0a0a0a' },
  commentInput: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#fff', maxHeight: 80 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#222' },
  sendBtnText: { fontSize: 18, color: '#000', fontWeight: '800' },
  searchBarActive: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111', borderRadius: 16, padding: 14, marginBottom: 16 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 15, color: '#fff' },
  searchResultsBox: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, color: '#444', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  friendRow: { backgroundColor: '#111', borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  pendingRow: {},
  friendRowAv: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center' },
  friendRowAvActive: { borderWidth: 2, borderColor: '#fff' },
  friendRowAvText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  friendRowInfo: { flex: 1 },
  friendRowName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  friendRowSub: { fontSize: 12, color: '#444', marginTop: 2 },
  friendBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center' },
  friendBadgeText: { fontSize: 13, color: '#555', fontWeight: '800' },
  addFriendBtn: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addFriendBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { fontSize: 16, color: '#000', fontWeight: '800' },
  declineBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center' },
  declineBtnText: { fontSize: 14, color: '#555', fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statPill: { flex: 1, backgroundColor: '#111', borderRadius: 18, padding: 14, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900', color: '#fff' },
  statLbl: { fontSize: 10, color: '#555', fontWeight: '700', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.8 },
  objCard: { backgroundColor: '#111', borderRadius: 24, padding: 18, marginBottom: 12 },
  objCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  objEmoji: { fontSize: 32 },
  objCardName: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  objCardSub: { fontSize: 12, color: '#555', marginBottom: 14 },
  visBadge: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  visBadgePublic: { backgroundColor: '#fff' },
  visText: { fontSize: 10, fontWeight: '700', color: '#555' },
  visTextPublic: { color: '#000' },
  objProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  objProgressBg: { flex: 1, height: 4, backgroundColor: '#222', borderRadius: 4 },
  objProgressFill: { height: 4, backgroundColor: '#fff', borderRadius: 4 },
  objPct: { fontSize: 13, fontWeight: '800', color: '#fff' },
  updateBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center' },
  updateBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  addObjBtn: { borderWidth: 1.5, borderColor: '#1e1e1e', borderRadius: 20, padding: 16, alignItems: 'center', marginBottom: 12 },
  addObjBtnText: { fontSize: 14, fontWeight: '700', color: '#444' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 82, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#1a1a1a', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 16 },
  navItem: { alignItems: 'center', gap: 3, minWidth: 48 },
  navIcon: { fontSize: 22, color: '#444' },
  navIconActive: { color: '#fff' },
  navLabel: { fontSize: 10, fontWeight: '600', color: '#444' },
  navLabelActive: { color: '#fff' },
  navPostBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  navPostBtnText: { fontSize: 28, color: '#000', fontWeight: '300', lineHeight: 34 },
  content: { flex: 1, paddingHorizontal: 20 },
  stepIndicator: { fontSize: 12, color: '#555' },
  sectionLabel: { fontSize: 10, color: '#555', letterSpacing: 1.5, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
  objRow: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#222', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  objRowActive: { borderColor: '#fff', backgroundColor: '#1a1a1a' },
  objIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  objIconActive: { backgroundColor: '#fff', borderColor: '#fff' },
  objEmojiPost: { fontSize: 20 },
  objInfoPost: { flex: 1 },
  objNamePost: { fontSize: 14, fontWeight: '700', color: '#fff' },
  objProgressPost: { fontSize: 12, color: '#555', marginTop: 2 },
  miniBar: { height: 3, backgroundColor: '#222', borderRadius: 2, marginTop: 6 },
  miniBarFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#333' },
  checkCircleActive: { backgroundColor: '#fff', borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkText: { fontSize: 12, color: '#000', fontWeight: '800' },
  photoZone: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 18, height: 200, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%', borderRadius: 18 },
  photoIcon: { fontSize: 32 },
  photoText: { fontSize: 13, color: '#555', fontWeight: '600' },
  removePhotoBtn: { alignItems: 'center', paddingVertical: 8, marginBottom: 4 },
  removePhotoText: { fontSize: 12, color: '#555', fontWeight: '600' },
  progressBlock: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 18, padding: 16, marginBottom: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  progressObjName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  progressValue: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sliderTrack: { height: 4, backgroundColor: '#222', borderRadius: 2, marginBottom: 6 },
  sliderFill: { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontSize: 10, color: '#444' },
  sliderBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 14 },
  sliderBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  sliderBtnText: { fontSize: 22, color: '#fff', fontWeight: '300' },
  sliderPct: { fontSize: 18, fontWeight: '900', color: '#fff', minWidth: 60, textAlign: 'center' },
  captionInput: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#222', borderRadius: 16, padding: 14, fontSize: 14, color: '#fff', minHeight: 80, textAlignVertical: 'top' },
  visToggle: { flexDirection: 'row', backgroundColor: '#141414', borderWidth: 1, borderColor: '#222', borderRadius: 18, overflow: 'hidden', marginBottom: 4 },
  visOpt: { flex: 1, paddingVertical: 12, alignItems: 'center', margin: 4, borderRadius: 14 },
  visOptActive: { backgroundColor: '#fff' },
  visOptText: { fontSize: 12, fontWeight: '700', color: '#555' },
  visOptTextActive: { color: '#000' },
  recap: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 18, padding: 16 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  recapKey: { fontSize: 13, color: '#555', fontWeight: '600' },
  recapVal: { fontSize: 13, color: '#fff', fontWeight: '700' },
  recapDivider: { height: 1, backgroundColor: '#1e1e1e', marginVertical: 8 },
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 36, backgroundColor: '#0a0a0a' },
  cta: { width: '100%', backgroundColor: '#fff', padding: 16, borderRadius: 18, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#000' },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: '#888' },
  modalContainer: { flex: 1, backgroundColor: '#0a0a0a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  modalCancel: { fontSize: 14, color: '#555', fontWeight: '600' },
  modalSave: { fontSize: 14, color: '#fff', fontWeight: '800' },
  modalBody: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  wheelWrap: { height: ITEM_H * 5, backgroundColor: '#111', borderRadius: 18, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  wheelScroll: { flex: 1 },
  wheelSelector: { position: 'absolute', top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#333', zIndex: 1 },
  wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  wheelItemText: { fontSize: 16, color: '#444', fontWeight: '600' },
  wheelItemTextActive: { color: '#fff', fontSize: 18, fontWeight: '800' },
  friendsBar: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 0 },
  friendItem: { alignItems: 'center', marginRight: 14 },
  friendAv: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  friendAvActive: { backgroundColor: '#2a2a2a', borderWidth: 2, borderColor: '#fff' },
  friendAvInactive: { backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#2a2a2a' },
  friendAvText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  friendName: { fontSize: 10, color: '#555', fontWeight: '600' },
  friendNameActive: { color: '#888' },
  friendStreakBadge: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  friendStreakText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  searchBar: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  searchPlaceholder: { fontSize: 14, color: '#444' },
  profileHero: { alignItems: 'center', paddingVertical: 24, marginBottom: 8 },
  profileAvatarWrap: { width: 88, height: 88, borderRadius: 44, marginBottom: 12, position: 'relative' },
  profileAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  profileAvatarImg: { width: 88, height: 88, borderRadius: 44 },
  profileAvatarOverlay: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  profileAvatarEditIcon: { fontSize: 12 },
  profileAvatarText: { fontSize: 32, fontWeight: '900', color: '#000' },
  profileName: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
  profileEditHint: { fontSize: 11, color: '#555', textAlign: 'center', marginTop: 4 },
  profileUsername: { fontSize: 13, color: '#555', marginTop: 4 },
  profileMember: { fontSize: 11, color: '#333', marginTop: 4 },
  profileNameEdit: { alignItems: 'center', gap: 10, width: '100%', paddingHorizontal: 20 },
  profileNameInput: { backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#fff', borderRadius: 14, padding: 12, fontSize: 18, color: '#fff', fontWeight: '800', textAlign: 'center', width: '100%' },
  profileSaveBtn: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  profileSaveBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  profileCancelBtn: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  profileCancelBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  profileObjRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 16, padding: 12, marginBottom: 8 },
  profileObjEmoji: { fontSize: 22 },
  profileObjName: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 4 },
  profileObjPct: { fontSize: 13, fontWeight: '800', color: '#fff' },
  profileUpdateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 16, padding: 12, marginBottom: 8 },
  profileUpdatePhoto: { width: 48, height: 48, borderRadius: 10 },
  profileUpdateCaption: { fontSize: 13, color: '#ccc', fontWeight: '600' },
  profileUpdateTime: { fontSize: 11, color: '#555', marginTop: 3 },
  profileProgressBadge: { backgroundColor: '#1e1e1e', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  profileProgressBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  signOutBtn: { borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  signOutBtnText: { fontSize: 14, fontWeight: '700', color: '#555' },
  // Post screen
  postPhotoZone: { width: '100%', height: 280, backgroundColor: '#111', overflow: 'hidden', position: 'relative' },
  postPhotoImg: { width: '100%', height: '100%' },
  postPhotoChangeBadge: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  postPhotoChangeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  postPhotoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  postPhotoEmptyIcon: { fontSize: 36 },
  postPhotoEmptyText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  postPhotoEmptyHint: { fontSize: 12, color: '#444' },
  postBody: { paddingHorizontal: 20, paddingTop: 24 },
  postLabel: { fontSize: 10, color: '#555', letterSpacing: 1.5, fontWeight: '700', marginBottom: 12 },
  postEmptyObj: { backgroundColor: '#111', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 8 },
  postObjScroll: { marginHorizontal: -20 },
  postObjCard: { width: 120, backgroundColor: '#111', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#1e1e1e' },
  postObjCardActive: { borderColor: '#fff', backgroundColor: '#1a1a1a' },
  postObjEmoji: { fontSize: 22, marginBottom: 8 },
  postObjTitle: { fontSize: 12, color: '#666', fontWeight: '600', lineHeight: 16 },
  postObjTitleActive: { color: '#fff' },
  postProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#111', borderRadius: 18, padding: 16 },
  postProgressBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center' },
  postProgressBtnText: { fontSize: 22, color: '#fff', fontWeight: '300' },
  postProgressCenter: { flex: 1, alignItems: 'center', gap: 4 },
  postProgressPct: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  postProgressVal: { fontSize: 12, color: '#555' },
  postProgressBar: { width: '100%', height: 4, backgroundColor: '#222', borderRadius: 2, marginTop: 8 },
  postProgressFill: { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  postCaptionInput: { backgroundColor: '#111', borderRadius: 16, padding: 14, color: '#fff', fontSize: 14, minHeight: 80, textAlignVertical: 'top', lineHeight: 20 },
  // Suggestions découverte
  suggestScroll: { marginHorizontal: -16 },
  suggestCard: { width: 130, backgroundColor: '#111', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#1e1e1e', alignItems: 'center' },
  suggestAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  suggestAvText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  suggestName: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 4, textAlign: 'center' },
  suggestObj: { fontSize: 11, color: '#555', textAlign: 'center', lineHeight: 15, marginBottom: 12 },
  suggestAddBtn: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  suggestAddText: { fontSize: 12, fontWeight: '800', color: '#000' },
});