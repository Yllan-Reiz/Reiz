import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, StatusBar, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setScreen('main');
      setCheckingAuth(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setScreen('main');
      else setScreen('splash');
    });
  }, []);

  if (checkingAuth) return null;
  if (screen === 'splash') return <Splash onNext={() => setScreen('onboarding')} />;
  if (screen === 'onboarding') return <Onboarding onNext={() => setScreen('main')} />;
  if (screen === 'main') return <Main onPost={() => setScreen('post')} />;
  if (screen === 'post') return <Post onBack={() => setScreen('main')} onPublish={() => setScreen('main')} />;
  return null;
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
      <View style={s.splashContainer}>
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
      </View>
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
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const toggleGoal = (label: string) => setSelected(prev => prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]);
  const next = () => step < 2 ? setStep(st => st + 1) : undefined;

  const handleSignUp = async () => {
    if (!name || !email || !password) { Alert.alert('Erreur', 'Remplis tous les champs !'); return; }
    if (password.length < 6) { Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères.'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) { setLoading(false); Alert.alert('Erreur', error.message); return; }
    if (data.user) {
      await supabase.from('users').insert({ id: data.user.id, username: name.toLowerCase().replace(/\s/g, ''), full_name: name });
      const objectivesToInsert = selected.map(goal => ({
        user_id: data.user!.id, title: goal,
        emoji: GOALS.find(g => g.label === goal)?.emoji || '🎯',
        target_value: 100, current_value: 0, unit: '%', visibility: 'public',
      }));
      if (objectivesToInsert.length > 0) await supabase.from('objectives').insert(objectivesToInsert);
    }
    setLoading(false);
    Alert.alert('Compte créé ! 🎉', 'Bienvenue sur Reiz !', [{ text: 'OK', onPress: onNext }]);
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
      <View style={s.obContainer}>
        <View style={s.dots}>{[0, 1, 2].map(i => <View key={i} style={s.dot} />)}</View>
        <Text style={s.eyebrow}>Déjà membre</Text>
        <Text style={s.headline}>Bon retour ! 👋</Text>
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
      </View>
    );
  }

  return (
    <View style={s.obContainer}>
      <View style={s.dots}>{[0, 1, 2].map(i => <View key={i} style={[s.dot, step === i && s.dotActive]} />)}</View>
      {step === 0 && (
        <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
          <Text style={s.eyebrow}>Bienvenue</Text>
          <Text style={s.headline}>Tes objectifs méritent une communauté.</Text>
          <Text style={s.subtext}>Les influenceurs réussissent car leur communauté les pousse. Reiz te donne ça, avec tes proches.</Text>
          <View style={s.cards}>
            {[
              { emoji: '🤝', title: 'Cercle de confiance', desc: "Tes amis proches voient ta progression et t'encouragent." },
              { emoji: '📈', title: 'Progression visible', desc: 'Photo, texte, pourcentage — montre où tu en es.' },
              { emoji: '🔥', title: 'Motivation réelle', desc: "La streak quotidienne t'empêche d'abandonner." },
            ].map((card, i) => (
              <View key={i} style={s.card}>
                <Text style={s.cardEmoji}>{card.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{card.title}</Text>
                  <Text style={s.cardDesc}>{card.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.btn} onPress={next}><Text style={s.btnText}>C'est parti →</Text></TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 14, alignItems: 'center' }} onPress={() => setShowLogin(true)}>
            <Text style={s.splashLogin}>Déjà un compte ? <Text style={s.splashLoginLink}>Se connecter</Text></Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      {step === 1 && (
        <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
          <Text style={s.eyebrow}>Étape 1</Text>
          <Text style={s.headline}>Choisis tes objectifs.</Text>
          <Text style={s.subtext}>Sur quoi veux-tu être accompagné ?</Text>
          <View style={s.pillsGrid}>
            {GOALS.map((g) => (
              <TouchableOpacity key={g.label} style={[s.pill, selected.includes(g.label) && s.pillActive]} onPress={() => toggleGoal(g.label)}>
                <Text style={s.pillEmoji}>{g.emoji}</Text>
                <Text style={[s.pillText, selected.includes(g.label) && s.pillTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[s.btn, selected.length === 0 && s.btnDisabled]} onPress={selected.length > 0 ? next : undefined}>
            <Text style={[s.btnText, selected.length === 0 && s.btnTextDisabled]}>Continuer →</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      {step === 2 && (
        <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
          <Text style={s.eyebrow}>Étape 2</Text>
          <Text style={s.headline}>Crée ton compte.</Text>
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
          <View style={s.divider}><View style={s.dividerLine} /><Text style={s.dividerText}>ou</Text><View style={s.dividerLine} /></View>
          <TouchableOpacity style={s.appleBtn}><Text style={s.appleBtnText}>🍎  Continuer avec Apple</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn, { marginTop: 16 }, loading && s.btnDisabled]} onPress={loading ? undefined : handleSignUp}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={s.btnText}>Créer mon compte 🚀</Text>}
          </TouchableOpacity>
          <Text style={s.legal}>En créant un compte tu acceptes nos <Text style={s.legalLink}>CGU</Text></Text>
          <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setShowLogin(true)}>
            <Text style={s.splashLogin}>Déjà un compte ? <Text style={s.splashLoginLink}>Se connecter</Text></Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      {step > 0 && (
        <TouchableOpacity style={s.obBackBtn} onPress={() => setStep(st => st - 1)}>
          <Text style={s.obBackText}>← Retour</Text>
        </TouchableOpacity>
      )}
    </View>
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

// ✅ STREAK RÉEL
async function calculateStreak(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('updates')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
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

// ============ MODAL COMMENTAIRES ============
function CommentsModal({ visible, updateId, onClose }: { visible: boolean; updateId: string; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select('id, content, created_at, users(full_name)')
      .eq('update_id', updateId)
      .order('created_at', { ascending: true });
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
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={s.commentRow}>
                    <View style={s.commentAv}><Text style={s.commentAvText}>{(c.users?.full_name || 'U').charAt(0).toUpperCase()}</Text></View>
                    <View style={s.commentContent}>
                      <Text style={s.commentName}>{c.users?.full_name || 'Utilisateur'}</Text>
                      <Text style={s.commentText}>{c.content}</Text>
                      <Text style={s.commentTime}>{timeAgo(c.created_at)}</Text>
                    </View>
                  </View>
                ))
              )}
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

  const fetchReactions = async () => {
    const { data } = await supabase.from('reactions').select('emoji, user_id').eq('update_id', u.id);
    if (!data) return;
    const counts: {[emoji: string]: number} = {};
    data.forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
    setReactions(counts);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) { setCurrentUserId(user.id); setMyReactions(data.filter(r => r.user_id === user.id).map(r => r.emoji)); }
  };

  const fetchCommentCount = async () => {
    const { count } = await supabase.from('comments').select('id', { count: 'exact', head: true }).eq('update_id', u.id);
    setCommentCount(count || 0);
  };

  useEffect(() => { fetchReactions(); fetchCommentCount(); }, [u.id]);

  const toggleReaction = async (emoji: string) => {
    if (!currentUserId) return;
    const isActive = myReactions.includes(emoji);
    if (isActive) {
      await supabase.from('reactions').delete().eq('update_id', u.id).eq('user_id', currentUserId).eq('emoji', emoji);
      setMyReactions(prev => prev.filter(e => e !== emoji));
      setReactions(prev => ({ ...prev, [emoji]: Math.max((prev[emoji] || 1) - 1, 0) }));
    } else {
      await supabase.from('reactions').insert({ update_id: u.id, user_id: currentUserId, emoji });
      setMyReactions(prev => [...prev, emoji]);
      setReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
    }
    setShowEmojiPicker(false);
  };

  const uname = u.users?.full_name || 'Utilisateur';
  const initial = uname.charAt(0).toUpperCase();
  const activeReactions = Object.entries(reactions).filter(([_, count]) => count > 0);

  return (
    <View style={s.feedCard}>
      <CommentsModal visible={showComments} updateId={u.id} onClose={() => { setShowComments(false); fetchCommentCount(); }} />
      <View style={s.cardHeader}>
        <View style={s.av}><Text style={s.avText}>{initial}</Text></View>
        <View style={s.cardMeta}>
          <Text style={s.cardName}>{uname}</Text>
          <Text style={s.cardTime}>{timeAgo(u.created_at)}</Text>
        </View>
      </View>
      <View style={s.progressRow}>
        <View style={s.progressBg}><View style={[s.progressFill, { width: `${Math.min(u.progress_value || 0, 100)}%` as any }]} /></View>
        <Text style={s.progressLabel}>{u.progress_value || 0}</Text>
      </View>
      {u.photo_url ? (
        <Image source={{ uri: u.photo_url }} style={s.feedPhoto} resizeMode="cover" />
      ) : u.caption ? (
        <View style={s.photoPlaceholder}><Text style={s.photoCaption}>{u.caption}</Text></View>
      ) : null}
      {u.caption && u.photo_url ? <Text style={s.feedCaption}>{u.caption}</Text> : null}
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
          <Text style={s.actionEmoji}>😊</Text><Text style={s.actionText}>Réagir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => setShowComments(true)}>
          <Text style={s.actionEmoji}>💬</Text><Text style={s.actionText}>{commentCount > 0 ? `${commentCount} comm.` : 'Commenter'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.refreshBtn} onPress={onRefresh}><Text style={s.refreshText}>↻</Text></TouchableOpacity>
      </View>
      {showEmojiPicker && (
        <View style={s.emojiPickerRow}>
          {REACTION_EMOJIS.map(emoji => (
            <TouchableOpacity key={emoji} style={[s.emojiPickerItem, myReactions.includes(emoji) && s.emojiPickerItemActive]} onPress={() => toggleReaction(emoji)}>
              <Text style={s.emojiPickerItemText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ============ MODAL CRÉATION OBJECTIF ============
function CreateObjectiveModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [emoji, setEmoji] = useState('🎯');
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const reset = () => { setEmoji('🎯'); setTitle(''); setUnit(''); setTargetValue(''); setVisibility('public'); setShowEmojiPicker(false); };

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Erreur', 'Donne un nom à ton objectif !'); return; }
    if (!targetValue || isNaN(Number(targetValue))) { Alert.alert('Erreur', 'Entre une valeur cible valide.'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); Alert.alert('Erreur', 'Tu dois être connecté.'); return; }
    const { error } = await supabase.from('objectives').insert({
      user_id: user.id, title: title.trim(), emoji,
      target_value: Number(targetValue), current_value: 0,
      unit: unit.trim() || '%', visibility,
    });
    setSaving(false);
    if (error) { Alert.alert('Erreur', error.message); return; }
    Alert.alert('Objectif créé ! 🎯', `"${title}" est ajouté à tes objectifs.`);
    reset(); onCreated();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalContainer}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={s.modalCancel}>Annuler</Text></TouchableOpacity>
          <Text style={s.modalTitle}>Nouvel objectif</Text>
          <TouchableOpacity onPress={saving ? undefined : handleCreate}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSave}>Créer</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
          <Text style={s.inputLabel}>EMOJI</Text>
          <TouchableOpacity style={s.emojiPickerBtn} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
            <Text style={s.emojiPickerSelected}>{emoji}</Text>
            <Text style={s.emojiPickerHint}>Appuie pour changer</Text>
          </TouchableOpacity>
          {showEmojiPicker && (
            <View style={s.emojiGrid}>
              {EMOJI_LIST.map((e) => (
                <TouchableOpacity key={e} style={[s.emojiOption, emoji === e && s.emojiOptionActive]} onPress={() => { setEmoji(e); setShowEmojiPicker(false); }}>
                  <Text style={s.emojiOptionText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>NOM DE L'OBJECTIF</Text>
            <TextInput style={s.inputField} placeholder="Ex: Courir 10 km, Lire 12 livres..." placeholderTextColor="#444" value={title} onChangeText={setTitle} autoCapitalize="sentences" />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>VALEUR CIBLE</Text>
            <TextInput style={s.inputField} placeholder="Ex: 10, 100, 12..." placeholderTextColor="#444" value={targetValue} onChangeText={setTargetValue} keyboardType="numeric" />
          </View>
          <View style={s.inputBlock}>
            <Text style={s.inputLabel}>UNITÉ</Text>
            <TextInput style={s.inputField} placeholder="Ex: km, livres, kg, %..." placeholderTextColor="#444" value={unit} onChangeText={setUnit} autoCapitalize="none" />
          </View>
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
      </View>
    </Modal>
  );
}

// ============ ONGLET AMIS RÉEL ============
function FriendsTab() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
        if (f.status === 'accepted') {
          accepted.push({ id: other.id, full_name: other.full_name, username: other.username, friendship_id: f.id, status: f.status, is_requester: isRequester });
        } else if (f.status === 'pending' && !isRequester) {
          pendingReqs.push({ id: other.id, full_name: other.full_name, username: other.username, friendship_id: f.id });
        }
      });
      setFriends(accepted);
      setPending(pendingReqs);
    }
    setLoading(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, username')
      .ilike('full_name', `%${query}%`)
      .neq('id', currentUserId || '')
      .limit(8);
    if (!error && data) setSearchResults(data);
    setSearching(false);
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('friendships').insert({ requester_id: currentUserId, receiver_id: receiverId, status: 'pending' });
    if (error) {
      if (error.code === '23505') Alert.alert('Déjà envoyé', 'Une demande est déjà en cours avec cette personne.');
      else Alert.alert('Erreur', error.message);
      return;
    }
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

  const getFriendshipStatus = (userId: string) => {
    const f = friends.find(f => f.id === userId);
    if (f) return 'ami';
    return null;
  };

  return (
    <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
      <View style={s.searchBarActive}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput style={s.searchInput} placeholder="Chercher par prénom..." placeholderTextColor="#444" value={searchQuery} onChangeText={handleSearch} autoCapitalize="none" />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
            <Text style={{ color: '#555', fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      {searchResults.length > 0 && (
        <View style={s.searchResultsBox}>
          <Text style={s.sectionTitle}>RÉSULTATS</Text>
          {searching ? <ActivityIndicator color="#fff" style={{ marginBottom: 10 }} /> : null}
          {searchResults.map((u) => {
            const status = getFriendshipStatus(u.id);
            return (
              <View key={u.id} style={s.friendRow}>
                <View style={s.friendRowAv}><Text style={s.friendRowAvText}>{u.full_name.charAt(0).toUpperCase()}</Text></View>
                <View style={s.friendRowInfo}>
                  <Text style={s.friendRowName}>{u.full_name}</Text>
                  <Text style={s.friendRowSub}>@{u.username}</Text>
                </View>
                {status === 'ami' ? (
                  <View style={s.friendBadge}><Text style={s.friendBadgeText}>✓ Ami</Text></View>
                ) : (
                  <TouchableOpacity style={s.addFriendBtn} onPress={() => sendFriendRequest(u.id)}>
                    <Text style={s.addFriendBtnText}>+ Ajouter</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
      {pending.length > 0 && (
        <>
          <Text style={s.sectionTitle}>DEMANDES REÇUES ({pending.length})</Text>
          {pending.map((p) => (
            <View key={p.friendship_id} style={[s.friendRow, s.pendingRow]}>
              <View style={[s.friendRowAv, { borderColor: '#fff' }]}><Text style={s.friendRowAvText}>{p.full_name.charAt(0).toUpperCase()}</Text></View>
              <View style={s.friendRowInfo}>
                <Text style={s.friendRowName}>{p.full_name}</Text>
                <Text style={s.friendRowSub}>@{p.username}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity style={s.acceptBtn} onPress={() => acceptRequest(p.friendship_id)}><Text style={s.acceptBtnText}>✓</Text></TouchableOpacity>
                <TouchableOpacity style={s.declineBtn} onPress={() => declineRequest(p.friendship_id)}><Text style={s.declineBtnText}>✕</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}
      <Text style={s.sectionTitle}>{friends.length > 0 ? `${friends.length} AMI${friends.length > 1 ? 'S' : ''}` : 'MES AMIS'}</Text>
      {loading ? (
        <View style={{ paddingTop: 20, alignItems: 'center' }}><ActivityIndicator color="#fff" /></View>
      ) : friends.length === 0 ? (
        <View style={{ paddingTop: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 32 }}>👥</Text>
          <Text style={{ color: '#555', marginTop: 10, fontSize: 14, fontWeight: '700' }}>Pas encore d'amis</Text>
          <Text style={{ color: '#444', marginTop: 4, fontSize: 12 }}>Cherche des amis par leur prénom !</Text>
        </View>
      ) : (
        friends.map((f) => (
          <TouchableOpacity key={f.friendship_id} style={s.friendRow} onLongPress={() => removeFriend(f.friendship_id, f.full_name)}>
            <View style={[s.friendRowAv, s.friendRowAvActive]}><Text style={s.friendRowAvText}>{f.full_name.charAt(0).toUpperCase()}</Text></View>
            <View style={s.friendRowInfo}>
              <Text style={s.friendRowName}>{f.full_name}</Text>
              <Text style={s.friendRowSub}>@{f.username}</Text>
            </View>
            <View style={s.friendBadge}><Text style={s.friendBadgeText}>✓ Ami</Text></View>
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
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
  const [streak, setStreak] = useState(0); // ✅ STREAK RÉEL

  const fetchUpdates = async () => {
    setLoadingFeed(true);
    const { data, error } = await supabase
      .from('updates')
      .select('id, caption, progress_value, created_at, photo_url, users(full_name, username)')
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error && data) setUpdates(data as unknown as Update[]);
    setLoadingFeed(false);
  };

  const fetchObjectives = async () => {
    setLoadingObj(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingObj(false); return; }
    const { data, error } = await supabase
      .from('objectives')
      .select('id, emoji, title, current_value, target_value, unit, visibility')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setObjectives(data as Objective[]);
    setLoadingObj(false);
  };

  // ✅ useEffect avec streak réel
  useEffect(() => {
    fetchUpdates();
    fetchObjectives();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) calculateStreak(user.id).then(setStreak);
    });
  }, []);

  const handleSignOut = async () => { await supabase.auth.signOut(); };
  const progressPct = (obj: Objective) => obj.target_value > 0 ? Math.min(Math.round((obj.current_value / obj.target_value) * 100), 100) : 0;

  return (
    <View style={s.container}>
      <CreateObjectiveModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchObjectives(); }} />

      <View style={s.header}>
        <Image source={require('./assets/ecriture-reiz-blanc.png')} style={s.headerLogo} resizeMode="contain" />
        <View style={s.headerRight}>
          {/* ✅ Streak réel */}
          <View style={s.streakBadge}><Text style={s.streakText}>🔥 {streak}j</Text></View>
          <View style={s.iconBtn}><Text style={s.iconText}>🔔</Text></View>
          <TouchableOpacity style={s.iconBtn} onPress={handleSignOut}><Text style={s.iconText}>👤</Text></TouchableOpacity>
        </View>
      </View>

      <View style={s.tabs}>
        {(['feed', 'objectives', 'friends'] as const).map((t, i) => (
          <TouchableOpacity key={t} style={s.tabBtn} onPress={() => setTab(t)}>
            <Text style={[s.tab, tab === t && s.tabActive]}>{['Feed', 'Mes objectifs', 'Amis'][i]}</Text>
            {tab === t && <View style={s.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'feed' && (
        <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
          <View style={s.myUpdate}>
            <View style={s.myAv}><Text style={s.myAvText}>Y</Text></View>
            <View style={s.myUpdateInfo}>
              <Text style={s.myUpdateTitle}>Ta mise à jour du jour</Text>
              <Text style={s.myUpdateSub}>Appuie sur + pour publier 🚀</Text>
            </View>
            <TouchableOpacity style={s.postedBadge} onPress={onPost}>
              <Text style={s.postedBadgeText}>+ Publier</Text>
            </TouchableOpacity>
          </View>
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
          ) : (
            updates.map((u) => <FeedCard key={u.id} u={u} onRefresh={fetchUpdates} />)
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {tab === 'objectives' && (
        <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
          <View style={s.statsRow}>
            <View style={s.statPill}><Text style={s.statVal}>{objectives.length}</Text><Text style={s.statLbl}>Actifs</Text></View>
            {/* ✅ Streak réel dans les stats aussi */}
            <View style={s.statPill}><Text style={s.statVal}>🔥 {streak}j</Text><Text style={s.statLbl}>Streak</Text></View>
            <View style={s.statPill}>
              <Text style={s.statVal}>{objectives.length > 0 ? Math.round(objectives.reduce((acc, o) => acc + progressPct(o), 0) / objectives.length) : 0}%</Text>
              <Text style={s.statLbl}>Moy.</Text>
            </View>
          </View>
          {loadingObj ? (
            <View style={{ paddingTop: 30, alignItems: 'center' }}><ActivityIndicator color="#fff" /></View>
          ) : objectives.length === 0 ? (
            <View style={{ paddingTop: 30, alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>🎯</Text>
              <Text style={{ color: '#555', marginTop: 10, fontSize: 14, fontWeight: '700' }}>Aucun objectif pour l'instant</Text>
              <Text style={{ color: '#444', marginTop: 4, fontSize: 12 }}>Crée ton premier objectif !</Text>
            </View>
          ) : (
            objectives.map((o) => {
              const pct = progressPct(o);
              return (
                <View key={o.id} style={s.objCard}>
                  <View style={s.objCardHeader}>
                    <View style={s.objIconBox}><Text style={s.objEmoji}>{o.emoji}</Text></View>
                    <View style={s.objCardInfo}>
                      <Text style={s.objCardName}>{o.title}</Text>
                      <Text style={s.objCardSub}>{o.current_value} {o.unit} sur {o.target_value}</Text>
                    </View>
                    <View style={[s.visBadge, o.visibility === 'public' && s.visBadgePublic]}>
                      <Text style={[s.visText, o.visibility === 'public' && s.visTextPublic]}>
                        {o.visibility === 'public' ? 'Public' : o.visibility === 'friends' ? 'Amis' : 'Privé'}
                      </Text>
                    </View>
                  </View>
                  <View style={s.objProgressRow}>
                    <View style={s.progressBg}><View style={[s.progressFill, { width: `${pct}%` as any }]} /></View>
                    <Text style={s.progressLabel}>{pct}%</Text>
                  </View>
                  <TouchableOpacity style={s.updateBtn} onPress={onPost}>
                    <Text style={s.updateBtnText}>+ Mise à jour</Text>
                  </TouchableOpacity>
                </View>
              );
            })
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
          <View style={[s.navIconBox, tab === 'feed' && s.navIconBoxActive]}>
            <Text style={s.navIconSymbol}>⊡</Text>
          </View>
          {tab === 'feed' && <View style={s.navDot} />}
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={onPost}>
          <View style={s.navPostBtn}><Text style={s.navPostBtnText}>+</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setTab('friends')}>
          <View style={[s.navIconBox, tab === 'friends' && s.navIconBoxActive]}>
            <Text style={s.navIconSymbol}>◎</Text>
          </View>
          {tab === 'friends' && <View style={s.navDot} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============ POST ============
function Post({ onBack, onPublish }: { onBack: () => void, onPublish: () => void }) {
  const [step, setStep] = useState(0);
  const [selectedObj, setSelectedObj] = useState(0);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loadingObj, setLoadingObj] = useState(true);
  const [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [publishing, setPublishing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingObj(false); return; }
      const { data, error } = await supabase
        .from('objectives')
        .select('id, emoji, title, current_value, target_value, unit, visibility')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
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
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [4, 3] });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        }
      },
      {
        text: '🖼️ Importer depuis la galerie',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la galerie dans les réglages.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [4, 3] });
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
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => step > 0 ? setStep(st => st - 1) : onBack()}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{step === 0 ? 'Quel objectif ?' : step === 1 ? 'Ta mise à jour' : 'Qui peut voir ?'}</Text>
        <Text style={s.stepIndicator}>{step + 1}/3</Text>
      </View>
      <View style={s.dots}>
        {[0, 1, 2].map(i => <View key={i} style={[s.dot, step === i && s.dotActive]} />)}
      </View>
      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <View>
            <Text style={s.sectionLabel}>MES OBJECTIFS ACTIFS</Text>
            {loadingObj ? (
              <View style={{ paddingTop: 30, alignItems: 'center' }}><ActivityIndicator color="#fff" /></View>
            ) : objectives.length === 0 ? (
              <View style={{ paddingTop: 30, alignItems: 'center' }}>
                <Text style={{ fontSize: 32 }}>🎯</Text>
                <Text style={{ color: '#555', marginTop: 10, fontSize: 14, fontWeight: '700' }}>Aucun objectif actif</Text>
                <Text style={{ color: '#444', marginTop: 4, fontSize: 12 }}>Crée d'abord un objectif dans "Mes objectifs"</Text>
              </View>
            ) : (
              objectives.map((o, i) => {
                const pct = o.target_value > 0 ? Math.min(Math.round((o.current_value / o.target_value) * 100), 100) : 0;
                return (
                  <TouchableOpacity key={o.id} style={[s.objRow, selectedObj === i && s.objRowActive]} onPress={() => setSelectedObj(i)}>
                    <View style={[s.objIcon, selectedObj === i && s.objIconActive]}><Text style={s.objEmojiPost}>{o.emoji}</Text></View>
                    <View style={s.objInfoPost}>
                      <Text style={s.objNamePost}>{o.title}</Text>
                      <Text style={s.objProgressPost}>{o.current_value} {o.unit} sur {o.target_value}</Text>
                      <View style={s.miniBar}><View style={[s.miniBarFill, { width: `${pct}%` as any }]} /></View>
                    </View>
                    <View style={[s.checkCircle, selectedObj === i && s.checkCircleActive]}>
                      {selectedObj === i && <Text style={s.checkText}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}
        {step === 1 && obj && (
          <View>
            <Text style={s.sectionLabel}>PHOTO DE PROGRESSION</Text>
            <TouchableOpacity style={s.photoZone} onPress={handlePickPhoto}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={s.photoPreview} resizeMode="cover" />
              ) : (
                <><Text style={s.photoIcon}>📷</Text><Text style={s.photoText}>Prends une photo ou importe</Text></>
              )}
            </TouchableOpacity>
            {photoUri && (
              <TouchableOpacity style={s.removePhotoBtn} onPress={() => setPhotoUri(null)}>
                <Text style={s.removePhotoText}>✕ Supprimer la photo</Text>
              </TouchableOpacity>
            )}
            <Text style={s.sectionLabel}>PROGRESSION AUJOURD'HUI</Text>
            <View style={s.progressBlock}>
              <View style={s.progressHeader}>
                <Text style={s.progressObjName}>{obj.title}</Text>
                <Text style={s.progressValue}>{Math.round((progress / 100) * obj.target_value * 10) / 10} {obj.unit}</Text>
              </View>
              <View style={s.sliderTrack}><View style={[s.sliderFill, { width: `${progress}%` as any }]} /></View>
              <View style={s.sliderLabels}><Text style={s.sliderLabel}>0</Text><Text style={s.sliderLabel}>{obj.target_value} {obj.unit}</Text></View>
              <View style={s.sliderBtns}>
                <TouchableOpacity style={s.sliderBtn} onPress={() => setProgress(p => Math.max(0, p - 5))}><Text style={s.sliderBtnText}>−</Text></TouchableOpacity>
                <Text style={s.sliderPct}>{progress}%</Text>
                <TouchableOpacity style={s.sliderBtn} onPress={() => setProgress(p => Math.min(100, p + 5))}><Text style={s.sliderBtnText}>+</Text></TouchableOpacity>
              </View>
            </View>
            <Text style={s.sectionLabel}>CAPTION</Text>
            <TextInput style={s.captionInput} placeholder="Décris ta progression..." placeholderTextColor="#3a3a3a" value={caption} onChangeText={setCaption} multiline />
          </View>
        )}
        {step === 2 && obj && (
          <View>
            <Text style={s.sectionLabel}>VISIBILITÉ</Text>
            <View style={s.visToggle}>
              {[{ key: 'public', label: '🌍 Public' }, { key: 'friends', label: '👥 Amis' }, { key: 'private', label: '🔒 Privé' }].map(v => (
                <TouchableOpacity key={v.key} style={[s.visOpt, visibility === v.key && s.visOptActive]} onPress={() => setVisibility(v.key)}>
                  <Text style={[s.visOptText, visibility === v.key && s.visOptTextActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.sectionLabel}>RÉCAPITULATIF</Text>
            <View style={s.recap}>
              <View style={s.recapRow}><Text style={s.recapKey}>Objectif</Text><Text style={s.recapVal}>{obj.emoji} {obj.title}</Text></View>
              <View style={s.recapDivider} />
              <View style={s.recapRow}><Text style={s.recapKey}>Progression</Text><Text style={s.recapVal}>{Math.round((progress / 100) * obj.target_value * 10) / 10} {obj.unit} ({progress}%)</Text></View>
              <View style={s.recapDivider} />
              <View style={s.recapRow}><Text style={s.recapKey}>Photo</Text><Text style={s.recapVal}>{photoUri ? '✅ Ajoutée' : '— Aucune'}</Text></View>
              <View style={s.recapDivider} />
              <View style={s.recapRow}><Text style={s.recapKey}>Visibilité</Text><Text style={s.recapVal}>{visibility === 'public' ? '🌍 Public' : visibility === 'friends' ? '👥 Amis' : '🔒 Privé'}</Text></View>
            </View>
          </View>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
      <View style={s.ctaContainer}>
        <TouchableOpacity
          style={[s.cta, (publishing || uploadingPhoto || (step === 0 && objectives.length === 0)) && s.btnDisabled]}
          onPress={() => {
            if (step === 0 && objectives.length === 0) return;
            if (step < 2) setStep(st => st + 1);
            else if (!publishing && !uploadingPhoto) handlePublish();
          }}>
          {(publishing || uploadingPhoto) && step === 2
            ? <ActivityIndicator color="#000" />
            : <Text style={s.ctaText}>{step === 2 ? 'Publier ma mise à jour 🚀' : 'Continuer →'}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============ STYLES ============
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  btn: { width: '100%', backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#1e1e1e' },
  btnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  btnTextDisabled: { color: '#444' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  dotActive: { width: 20, backgroundColor: '#fff' },
  splashContainer: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  splashLogo: { width: 260, height: 90, marginBottom: 12 },
  splashTagline: { fontSize: 10, color: '#555', letterSpacing: 3 },
  splashBottom: { position: 'absolute', bottom: 48, left: 28, right: 28 },
  splashLogin: { fontSize: 12, color: '#555', textAlign: 'center', marginTop: 14 },
  splashLoginLink: { color: '#fff', fontWeight: '700' },
  obContainer: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 24 },
  screen: { flex: 1 },
  eyebrow: { fontSize: 11, color: '#555', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  headline: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 8, lineHeight: 28 },
  subtext: { fontSize: 13, color: '#888', lineHeight: 20, marginBottom: 20 },
  cards: { gap: 8, marginBottom: 24 },
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e1e', padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardEmoji: { fontSize: 20, marginTop: 2 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 3 },
  cardDesc: { fontSize: 12, color: '#666', lineHeight: 17 },
  pillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 100, backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#222' },
  pillActive: { backgroundColor: '#fff', borderColor: '#fff' },
  pillEmoji: { fontSize: 13 },
  pillText: { fontSize: 12, fontWeight: '700', color: '#888' },
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  headerLogo: { width: 80, height: 28 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakBadge: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  streakText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 14 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tab: { fontSize: 12, fontWeight: '700', color: '#555' },
  tabActive: { color: '#fff' },
  tabUnderline: { position: 'absolute', bottom: 0, height: 2, width: '80%', backgroundColor: '#fff', borderRadius: 1 },
  feed: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  myUpdate: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#fff', borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  myAv: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  myAvText: { fontSize: 14, fontWeight: '800', color: '#000' },
  myUpdateInfo: { flex: 1 },
  myUpdateTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  myUpdateSub: { fontSize: 11, color: '#888', marginTop: 2 },
  postedBadge: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  postedBadgeText: { fontSize: 10, fontWeight: '800', color: '#000' },
  feedCard: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 20, marginBottom: 12, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 0 },
  av: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  cardMeta: { flex: 1 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cardTime: { fontSize: 11, color: '#555', marginTop: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10, paddingTop: 10 },
  progressBg: { flex: 1, height: 3, backgroundColor: '#222', borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: '#666' },
  feedPhoto: { width: '100%', height: 200 },
  feedCaption: { fontSize: 13, color: '#888', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  photoPlaceholder: { marginHorizontal: 14, marginBottom: 10, backgroundColor: '#1a1a1a', borderRadius: 14, height: 90, alignItems: 'center', justifyContent: 'center' },
  photoCaption: { fontSize: 11, color: '#555', fontWeight: '500' },
  activeReactionsRow: { paddingHorizontal: 14, paddingTop: 8, flexGrow: 0 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1e1e1e', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#252525' },
  actionEmoji: { fontSize: 14 },
  actionText: { fontSize: 12, color: '#666', fontWeight: '600' },
  rxn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#252525', marginRight: 6, marginBottom: 8 },
  rxnActive: { backgroundColor: '#252525', borderColor: '#555' },
  rxnEmoji: { fontSize: 14 },
  rxnCount: { fontSize: 12, color: '#888', fontWeight: '700' },
  refreshBtn: { marginLeft: 'auto', width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  refreshText: { fontSize: 18, color: '#555' },
  emojiPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 },
  emojiPickerItem: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#222', alignItems: 'center', justifyContent: 'center' },
  emojiPickerItemActive: { borderColor: '#fff', backgroundColor: '#2a2a2a' },
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
  searchBarActive: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 12, marginBottom: 12 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#fff' },
  searchResultsBox: { backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e1e', padding: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 11, color: '#555', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  friendRow: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  pendingRow: { borderColor: '#333' },
  friendRowAv: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1e1e1e', borderWidth: 2, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  friendRowAvActive: { borderColor: '#fff' },
  friendRowAvText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  friendRowInfo: { flex: 1 },
  friendRowName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  friendRowSub: { fontSize: 12, color: '#555', marginTop: 2 },
  friendBadge: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  friendBadgeText: { fontSize: 11, color: '#888', fontWeight: '700' },
  addFriendBtn: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  addFriendBtnText: { fontSize: 12, fontWeight: '800', color: '#000' },
  acceptBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { fontSize: 16, color: '#000', fontWeight: '800' },
  declineBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  declineBtnText: { fontSize: 14, color: '#555', fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statPill: { flex: 1, backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 14, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900', color: '#fff' },
  statLbl: { fontSize: 10, color: '#555', fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  objCard: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 20, padding: 14, marginBottom: 12 },
  objCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  objIconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  objEmoji: { fontSize: 20 },
  objCardInfo: { flex: 1 },
  objCardName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  objCardSub: { fontSize: 11, color: '#555', marginTop: 2 },
  visBadge: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#2a2a2a' },
  visBadgePublic: { backgroundColor: '#fff', borderColor: '#fff' },
  visText: { fontSize: 10, fontWeight: '700', color: '#555' },
  visTextPublic: { color: '#000' },
  objProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  updateBtn: { backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 10, alignItems: 'center' },
  updateBtnText: { fontSize: 13, fontWeight: '700', color: '#888' },
  addObjBtn: { borderWidth: 1.5, borderColor: '#222', borderRadius: 20, padding: 16, alignItems: 'center', marginBottom: 12 },
  addObjBtnText: { fontSize: 14, fontWeight: '700', color: '#555' },
  nudgeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  nudgeBtnText: { fontSize: 18 },
  inviteBtn: { borderWidth: 1.5, borderColor: '#222', borderRadius: 18, padding: 14, alignItems: 'center', marginTop: 4 },
  inviteBtnText: { fontSize: 14, fontWeight: '700', color: '#555' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 64, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#141414', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  navItem: { alignItems: 'center', padding: 8 },
  navIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  navIconBoxActive: { backgroundColor: '#1a1a1a' },
  navIconSymbol: { fontSize: 20, color: '#fff' },
  navIcon: { fontSize: 22, color: '#444' },
  navIconActive: { color: '#fff' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff', marginTop: 3 },
  navPostBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  navPostBtnText: { fontSize: 24, color: '#000', fontWeight: '300', lineHeight: 30 },
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
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right:
    0, padding: 20, paddingBottom: 36, backgroundColor: '#0a0a0a' },
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
  emojiPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, marginBottom: 12 },
  emojiPickerSelected: { fontSize: 32 },
  emojiPickerHint: { fontSize: 13, color: '#555', fontWeight: '600' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  emojiOption: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#222', alignItems: 'center', justifyContent: 'center' },
  emojiOptionActive: { borderColor: '#fff', backgroundColor: '#2a2a2a' },
  emojiOptionText: { fontSize: 24 },
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
});