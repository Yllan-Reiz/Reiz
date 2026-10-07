import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Modal, Linking, Share, Image, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { signAvatars } from '../lib/storage';
import { LEGAL_DOCS, LegalDoc, SUPPORT_EMAIL } from '../lib/legal';
import { PresencePanel } from '../components/PresencePanel';
import { WelcomeModal } from '../components/WelcomeFlow';
import { APP_VERSION, WELCOME_FLOW } from '../constants';
import { F } from '../styles';

type View_ = 'root' | 'password' | 'blocked' | 'legal' | 'presence';

// Page Réglages, organisée comme sur Instagram : Compte, Confidentialité, Notifications,
// Légal, Aide, puis les actions sensibles tout en bas.
export function SettingsScreen({ visible, onClose, onEditName, onEditBio, onCloseFriends, onSignOut, onDeleteAccount }: {
  visible: boolean;
  onClose: () => void;
  onEditName: () => void;
  onEditBio: () => void;
  onCloseFriends: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>('root');
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState<string>('email');
  // Encouragements perso (users.notif_encouragement). null = pas chargé, ou colonne absente : la ligne est cachée.
  const [encourage, setEncourage] = useState<boolean | null>(null);

  useEffect(() => {
    if (!visible) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data, error } = await supabase.from('users').select('notif_encouragement').eq('id', user.id).single();
      setEncourage(!error && data ? (data as any).notif_encouragement !== false : null);
    });
  }, [visible]);

  const toggleEncourage = async (value: boolean) => {
    setEncourage(value);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('users').update({ notif_encouragement: value }).eq('id', user.id);
    if (error) { setEncourage(!value); Alert.alert('Erreur', frError(error)); }
  };

  useEffect(() => {
    if (!visible) return;
    setView('root');
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email || '');
      const providers: string[] = (user?.app_metadata as any)?.providers || [(user?.app_metadata as any)?.provider || 'email'];
      setProvider(providers.includes('email') ? 'email' : providers[0] || 'email');
    });
  }, [visible]);

  const back = () => { if (view === 'root') onClose(); else setView('root'); };
  const titles: Record<View_, string> = { root: 'Réglages', password: 'Mot de passe', blocked: 'Utilisateurs bloqués', legal: doc?.title || 'Légal', presence: 'Salle et lieux' };

  const exportData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [profile, objectives, updates] = await Promise.all([
      supabase.from('users').select('full_name, username, bio, created_at').eq('id', user.id).single(),
      supabase.from('objectives').select('emoji, title, current_value, target_value, unit, visibility, created_at').eq('user_id', user.id),
      supabase.from('updates').select('caption, progress_value, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    const payload = { email: user.email, profil: profile.data, objectifs: objectives.data, publications: updates.data };
    Share.share({ message: JSON.stringify(payload, null, 2), title: 'Mes données Reiz' }).catch(() => {});
  };

  const openDoc = (d: LegalDoc) => { setDoc(d); setView('legal'); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={back}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: insets.top }}>
        <View style={st.header}>
          <TouchableOpacity onPress={back} style={st.backBtn} accessibilityLabel="Retour" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={view === 'root' ? 'close' : 'chevron-back'} size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={st.headerTitle} numberOfLines={1}>{titles[view]}</Text>
          <View style={st.backBtn} />
        </View>

        {view === 'root' && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
            <Section title="COMPTE">
              <Row icon="person-outline" label="Modifier mon nom" onPress={() => { onClose(); setTimeout(onEditName, 350); }} />
              <Row icon="create-outline" label="Modifier ma bio" onPress={() => { onClose(); setTimeout(onEditBio, 350); }} />
              {!!email && <Row icon="mail-outline" label="Email" value={email} />}
              {provider === 'email'
                ? <Row icon="key-outline" label="Changer le mot de passe" onPress={() => setView('password')} last />
                : <Row icon="shield-checkmark-outline" label="Connexion" value={provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : provider} last />}
            </Section>

            <Section title="CONFIDENTIALITÉ">
              <Row icon="star-outline" label="Mon cercle proche" onPress={() => { onClose(); setTimeout(onCloseFriends, 350); }} />
              <Row icon="ban-outline" label="Utilisateurs bloqués" onPress={() => setView('blocked')} />
              <Row icon="download-outline" label="Exporter mes données" onPress={exportData} last />
            </Section>
            <Text style={st.hint}>La visibilité de chaque objectif se règle depuis le menu « … » de l'objectif.</Text>

            <Section title="ENTRAÎNEMENT">
              <Row icon="location-outline" label="Prévenir mon cercle proche" value="Salle et lieux" onPress={() => setView('presence')} last />
            </Section>

            <Section title="NOTIFICATIONS">
              {encourage !== null && <ToggleRow icon="flame-outline" label="Encouragements" value={encourage} onChange={toggleEncourage} />}
              <Row icon="notifications-outline" label="Gérer les notifications" value="Réglages iPhone" onPress={() => Linking.openSettings().catch(() => {})} last />
            </Section>
            {encourage !== null && <Text style={st.hint}>Un message quand tu approches d'un objectif, ou après quelques jours sans poster. Un tous les 2 jours au maximum.</Text>}

            <Section title="LÉGAL">
              {LEGAL_DOCS.map((d, i) => (
                <Row key={d.id} icon={d.id === 'rules' ? 'people-outline' : d.id === 'privacy' ? 'lock-closed-outline' : 'document-text-outline'} label={d.title} onPress={() => openDoc(d)} last={i === LEGAL_DOCS.length - 1} />
              ))}
            </Section>

            <Section title="AIDE">
              {WELCOME_FLOW && <Row icon="sparkles-outline" label="Revoir l'accueil" value="Aperçu" onPress={() => setWelcome(true)} />}
              <Row icon="chatbubble-ellipses-outline" label="Contacter le support" value={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Reiz`).catch(() => {})} last />
            </Section>

            <Section title="SESSION">
              <Row icon="log-out-outline" label="Se déconnecter" onPress={onSignOut} />
              <Row icon="trash-outline" label="Supprimer mon compte" danger onPress={onDeleteAccount} last />
            </Section>

            <Text style={st.version}>Reiz {APP_VERSION}</Text>
          </ScrollView>
        )}

        {view === 'password' && <PasswordForm onDone={() => setView('root')} />}
        {view === 'presence' && <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}><PresencePanel /></ScrollView>}
        {view === 'blocked' && <BlockedList />}
        {view === 'legal' && doc && <LegalReader doc={doc} bottom={insets.bottom} />}
        {/* Aperçu de l'accueil des nouveaux comptes : rien n'est enregistré. */}
        <WelcomeModal visible={welcome} preview onClose={() => setWelcome(false)} />
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={st.sectionTitle}>{title}</Text>
      <View style={st.card}>{children}</View>
    </View>
  );
}

function Row({ icon, label, value, onPress, danger, last }: { icon: any; label: string; value?: string; onPress?: () => void; danger?: boolean; last?: boolean }) {
  const color = danger ? '#ff453a' : '#fff';
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.6 : 1} onPress={onPress} style={[st.row, !last && st.rowBorder]}>
      <Ionicons name={icon} size={20} color={danger ? '#ff453a' : '#bbb'} />
      <Text style={[st.rowLabel, { color }]} numberOfLines={1}>{label}</Text>
      {!!value ? <Text style={st.rowValue} numberOfLines={1}>{value}</Text> : <View style={{ flex: 1 }} />}
      {!!onPress && !danger && <Ionicons name="chevron-forward" size={16} color="#555" />}
    </TouchableOpacity>
  );
}

function ToggleRow({ icon, label, value, onChange }: { icon: any; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[st.row, st.rowBorder]}>
      <Ionicons name={icon} size={20} color="#bbb" />
      <Text style={st.rowLabel} numberOfLines={1}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#2a2a2a', true: '#fff' }} thumbColor={value ? '#000' : '#888'} ios_backgroundColor="#2a2a2a" accessibilityLabel={label} />
    </View>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const tooShort = pwd.length > 0 && pwd.length < 8;
  const mismatch = confirm.length > 0 && pwd !== confirm;
  const ok = pwd.length >= 8 && pwd === confirm;

  const save = async () => {
    if (!ok) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSaving(false);
    if (error) { Alert.alert('Erreur', /same|different/i.test(error.message) ? "Choisis un mot de passe différent de l'ancien." : frError(error)); return; }
    Alert.alert('Mot de passe modifié', 'Ton nouveau mot de passe est actif.');
    onDone();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={st.inputLabel}>NOUVEAU MOT DE PASSE</Text>
      <TextInput style={st.input} value={pwd} onChangeText={setPwd} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" placeholder="8 caractères minimum" placeholderTextColor="#666" />
      {tooShort && <Text style={st.error}>8 caractères minimum.</Text>}
      <Text style={[st.inputLabel, { marginTop: 18 }]}>CONFIRMER</Text>
      <TextInput style={st.input} value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" placeholder="Retape le mot de passe" placeholderTextColor="#666" />
      {mismatch && <Text style={st.error}>Les deux mots de passe ne sont pas identiques.</Text>}
      <TouchableOpacity style={[st.primaryBtn, !ok && { backgroundColor: '#1e1e1e' }]} onPress={saving ? undefined : save} activeOpacity={ok ? 0.8 : 1}>
        {saving ? <ActivityIndicator color="#000" /> : <Text style={[st.primaryBtnText, !ok && { color: '#666' }]}>Enregistrer</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

type Blocked = { id: string; full_name: string; username: string; avatar_url?: string | null };

function BlockedList() {
  const [list, setList] = useState<Blocked[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: bl } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id);
      const ids = (bl || []).map((b: any) => b.blocked_id);
      if (ids.length === 0) { setList([]); return; }
      const { data: users } = await supabase.from('users').select('id, full_name, username, avatar_url').in('id', ids);
      const people = (users || []) as Blocked[];
      const signed = await signAvatars(people.map(p => p.avatar_url));
      people.forEach(p => { if (p.avatar_url) p.avatar_url = signed[p.avatar_url] ?? null; });
      setList(people);
    })();
  }, []);

  const unblock = (p: Blocked) => {
    Alert.alert(`Débloquer ${p.full_name} ?`, 'Vous pourrez de nouveau vous voir et vous envoyer une demande d\'ami.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Débloquer', onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { error } = await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', p.id);
          if (error) { Alert.alert('Erreur', frError(error)); return; }
          setList(prev => (prev || []).filter(x => x.id !== p.id));
        },
      },
    ]);
  };

  if (list === null) return <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />;
  if (list.length === 0) return <Text style={[st.hint, { textAlign: 'center', marginTop: 40, paddingHorizontal: 24 }]}>Tu n'as bloqué personne.</Text>;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={st.card}>
        {list.map((p, i) => (
          <View key={p.id} style={[st.row, i < list.length - 1 && st.rowBorder]}>
            {p.avatar_url
              ? <Image source={{ uri: p.avatar_url }} style={st.avatar} />
              : <View style={[st.avatar, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: '#fff', fontFamily: F.bold }}>{p.full_name?.charAt(0).toUpperCase()}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={st.rowLabel} numberOfLines={1}>{p.full_name}</Text>
              <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular }}>@{p.username}</Text>
            </View>
            <TouchableOpacity onPress={() => unblock(p)} style={st.smallBtn}><Text style={st.smallBtnText}>Débloquer</Text></TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function LegalReader({ doc, bottom }: { doc: LegalDoc; bottom: number }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottom + 40 }} showsVerticalScrollIndicator={false}>
      <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular, marginBottom: 14 }}>Dernière mise à jour : {doc.updated}</Text>
      {!!doc.intro && <Text style={st.legalIntro}>{doc.intro}</Text>}
      {doc.sections.map(sec => (
        <View key={sec.h} style={{ marginBottom: 22 }}>
          <Text style={st.legalH}>{sec.h}</Text>
          {sec.list?.map((l, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
              <Text style={st.legalP}>•</Text>
              <Text style={[st.legalP, { flex: 1 }]}>{l}</Text>
            </View>
          ))}
          {sec.p?.map((p, i) => <Text key={i} style={[st.legalP, { marginTop: sec.list ? 8 : 0 }]}>{p}</Text>)}
        </View>
      ))}
    </ScrollView>
  );
}

import { StyleSheet } from 'react-native';
const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontFamily: F.bold },
  sectionTitle: { fontSize: 11, color: '#777', fontFamily: F.bold, letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#111', borderRadius: 18, borderWidth: 1, borderColor: '#1c1c1c', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#1c1c1c' },
  rowLabel: { color: '#fff', fontSize: 15, fontFamily: F.semibold, flexShrink: 1 },
  rowValue: { color: '#777', fontSize: 13, fontFamily: F.regular, flex: 1, textAlign: 'right' },
  hint: { color: '#666', fontSize: 12, fontFamily: F.regular, lineHeight: 18, marginTop: 8, marginHorizontal: 4 },
  version: { color: '#555', fontSize: 12, fontFamily: F.regular, textAlign: 'center', marginTop: 28 },
  inputLabel: { fontSize: 10, color: '#888', letterSpacing: 1.5, fontFamily: F.bold, marginBottom: 6 },
  input: { backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, fontSize: 14, color: '#fff', fontFamily: F.regular },
  error: { color: '#ff453a', fontSize: 12, fontFamily: F.regular, marginTop: 6 },
  primaryBtn: { backgroundColor: '#fff', borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 26 },
  primaryBtnText: { color: '#000', fontSize: 15, fontFamily: F.extrabold },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222' },
  smallBtn: { backgroundColor: '#1e1e1e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  smallBtnText: { color: '#fff', fontSize: 13, fontFamily: F.semibold },
  legalIntro: { color: '#ccc', fontSize: 15, fontFamily: F.regular, lineHeight: 24, marginBottom: 22 },
  legalH: { color: '#fff', fontSize: 16, fontFamily: F.bold, marginBottom: 8 },
  legalP: { color: '#aaa', fontSize: 14, fontFamily: F.regular, lineHeight: 22 },
});
