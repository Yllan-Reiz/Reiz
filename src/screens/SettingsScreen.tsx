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
import { ObjectiveDoneModal } from '../components/ObjectiveDoneModal';
import { contactsAvailable } from '../lib/contacts';
import { APP_VERSION, WELCOME_FLOW } from '../constants';
import { F } from '../styles';
import { LANGS, lang, chosenLang, deviceLang, setLanguage, type Lang, t, dirIcon, isRTL } from '../i18n';
import { CachedImage } from '../components/CachedImage';

type View_ = 'root' | 'password' | 'blocked' | 'legal' | 'presence' | 'language';

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
  // Aperçu de l'écran « Objectif atteint », dans les builds de développement seulement.
  const [donePreview, setDonePreview] = useState(false);
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState<string>('email');
  // Encouragements perso (users.notif_encouragement). null = pas chargé, ou colonne absente : la ligne est cachée.
  const [encourage, setEncourage] = useState<boolean | null>(null);
  // Les lignes Email, « Me proposer à mes contacts » et Encouragements arrivent après des requêtes : la liste reste
  // invisible jusque-là, sinon elle sautait sous le doigt une seconde après l'ouverture (25/10/2026).
  const [loaded, setLoaded] = useState({ user: false, enc: false, disc: false });
  const ready = loaded.user && loaded.enc && loaded.disc;
  useEffect(() => {
    if (!visible) return;
    setLoaded({ user: false, enc: false, disc: !contactsAvailable() });
    // Réseau lent ou requête en échec : la liste s'affiche quand même au bout d'une seconde et demie.
    const timer = setTimeout(() => setLoaded({ user: true, enc: true, disc: true }), 1500);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data, error } = await supabase.from('users').select('notif_encouragement').eq('id', user.id).single();
        setEncourage(!error && data ? (data as any).notif_encouragement !== false : null);
      }
      setLoaded(l => ({ ...l, enc: true }));
    }, () => setLoaded(l => ({ ...l, enc: true })));
  }, [visible]);

  // « Me proposer à mes contacts » (users.discoverable) : quelqu'un qui a ton e-mail dans son carnet peut te trouver
  // avec « Retrouver mes contacts ». Visible seulement dans une version qui a la fonction. null = pas chargé ou colonne absente.
  const [discoverable, setDiscoverable] = useState<boolean | null>(null);
  useEffect(() => {
    if (!visible || !contactsAvailable()) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data, error } = await supabase.from('users').select('discoverable').eq('id', user.id).single();
        setDiscoverable(!error && data ? (data as any).discoverable !== false : null);
      }
      setLoaded(l => ({ ...l, disc: true }));
    }, () => setLoaded(l => ({ ...l, disc: true })));
  }, [visible]);
  const toggleDiscoverable = async (value: boolean) => {
    setDiscoverable(value);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('users').update({ discoverable: value }).eq('id', user.id);
    if (error) { setDiscoverable(!value); Alert.alert(t('common.error'), frError(error)); }
  };

  const toggleEncourage = async (value: boolean) => {
    setEncourage(value);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('users').update({ notif_encouragement: value }).eq('id', user.id);
    if (error) { setEncourage(!value); Alert.alert(t('common.error'), frError(error)); }
  };

  useEffect(() => {
    if (!visible) return;
    setView('root');
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email || '');
      const providers: string[] = (user?.app_metadata as any)?.providers || [(user?.app_metadata as any)?.provider || 'email'];
      setProvider(providers.includes('email') ? 'email' : providers[0] || 'email');
      setLoaded(l => ({ ...l, user: true }));
    }, () => setLoaded(l => ({ ...l, user: true })));
  }, [visible]);

  const back = () => { if (view === 'root') onClose(); else setView('root'); };
  const titles: Record<View_, string> = { root: t('settings.title'), password: t('settings.password'), blocked: t('settings.blocked'), legal: doc?.title || t('settings.legal'), presence: t('settings.presence'), language: t('settings.language') };

  const exportData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [profile, objectives, updates] = await Promise.all([
      supabase.from('users').select('full_name, username, bio, created_at').eq('id', user.id).single(),
      supabase.from('objectives').select('emoji, title, current_value, target_value, unit, visibility, created_at').eq('user_id', user.id),
      supabase.from('updates').select('caption, progress_value, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    const payload = { email: user.email, profil: profile.data, objectifs: objectives.data, publications: updates.data };
    Share.share({ message: JSON.stringify(payload, null, 2), title: t('settings.myData') }).catch(() => {});
  };

  const openDoc = (d: LegalDoc) => { setDoc(d); setView('legal'); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={back}>
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: insets.top }}>
        <View style={st.header}>
          <TouchableOpacity onPress={back} style={st.backBtn} accessibilityLabel={t('common.back')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={view === 'root' ? 'close' : dirIcon('chevron-back')} size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={st.headerTitle} numberOfLines={1}>{titles[view]}</Text>
          <View style={st.backBtn} />
        </View>

        {view === 'root' && (
          <ScrollView style={{ opacity: ready ? 1 : 0 }} pointerEvents={ready ? 'auto' : 'none'} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
            <Section title={t('settings.secAccount')}>
              <Row icon="person-outline" label={t('settings.editName')} onPress={() => { onClose(); setTimeout(onEditName, 350); }} />
              <Row icon="create-outline" label={t('settings.editBio')} onPress={() => { onClose(); setTimeout(onEditBio, 350); }} />
              {!!email && <Row icon="mail-outline" label={t('settings.email')} value={email} />}
              {provider === 'email'
                ? <Row icon="key-outline" label={t('settings.changePassword')} onPress={() => setView('password')} last />
                : <Row icon="shield-checkmark-outline" label={t('settings.signIn')} value={provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : provider} last />}
            </Section>

            <Section title={t('settings.secLanguage')}>
              <Row icon="language-outline" label={t('settings.language')} value={LANGS.find(l => l.code === lang())?.name} onPress={() => setView('language')} last />
            </Section>

            <Section title={t('settings.secPrivacy')}>
              <Row icon="star-outline" label={t('settings.closeCircle')} onPress={() => { onClose(); setTimeout(onCloseFriends, 350); }} />
              {discoverable !== null && <ToggleRow icon="people-outline" label={t('settings.discoverable')} value={discoverable} onChange={toggleDiscoverable} />}
              <Row icon="ban-outline" label={t('settings.blocked')} onPress={() => setView('blocked')} />
              <Row icon="download-outline" label={t('settings.export')} onPress={exportData} last />
            </Section>
            <Text style={st.hint}>{discoverable !== null ? t('settings.discoverableHint') + ' ' : ''}{t('settings.visibilityHint')}</Text>

            <Section title={t('settings.secTraining')}>
              <Row icon="location-outline" label={t('presencePanel.title')} onPress={() => setView('presence')} last />
            </Section>

            <Section title={t('settings.secNotifs')}>
              {encourage !== null && <ToggleRow icon="flame-outline" label={t('settings.encouragements')} value={encourage} onChange={toggleEncourage} />}
              <Row icon="notifications-outline" label={t('settings.manageNotifs')} value={t('settings.iphoneSettings')} onPress={() => Linking.openSettings().catch(() => {})} last />
            </Section>
            {encourage !== null && <Text style={st.hint}>{t('settings.encouragementsHint')}</Text>}

            <Section title={t('settings.secLegal')}>
              {LEGAL_DOCS.map((d, i) => (
                <Row key={d.id} icon={d.id === 'rules' ? 'people-outline' : d.id === 'privacy' ? 'lock-closed-outline' : 'document-text-outline'} label={d.title} onPress={() => openDoc(d)} last={i === LEGAL_DOCS.length - 1} />
              ))}
            </Section>

            <Section title={t('settings.secHelp')}>
              {WELCOME_FLOW && <Row icon="sparkles-outline" label={t('settings.replayWelcome')} value={t('settings.preview')} onPress={() => setWelcome(true)} />}
              {__DEV__ && <Row icon="trophy-outline" label={t('done.eyebrow')} value={t('settings.preview')} onPress={() => setDonePreview(true)} />}
              <Row icon="chatbubble-ellipses-outline" label={t('settings.support')} value={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Reiz`).catch(() => {})} last />
            </Section>

            <Section title={t('settings.secSession')}>
              <Row icon="log-out-outline" label={t('settings.signOut')} onPress={onSignOut} />
              <Row icon="trash-outline" label={t('settings.deleteAccount')} danger onPress={onDeleteAccount} last />
            </Section>

            <Text style={st.version}>Reiz {APP_VERSION}</Text>
          </ScrollView>
        )}

        {view === 'password' && <PasswordForm onDone={() => setView('root')} />}
        {view === 'presence' && <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}><PresencePanel /></ScrollView>}
        {view === 'blocked' && <BlockedList />}
        {view === 'language' && <LanguagePicker />}
        {view === 'legal' && doc && <LegalReader doc={doc} bottom={insets.bottom} />}
        {/* Aperçu de l'accueil des nouveaux comptes : rien n'est enregistré. */}
        <WelcomeModal visible={welcome} preview onClose={() => setWelcome(false)} />
        {__DEV__ && (
          <ObjectiveDoneModal preview objective={donePreview ? { id: 'apercu', emoji: '🏃', title: 'Courir 10 km', unit: 'séances', target_value: 4 } : null}
            onShareStory={() => setDonePreview(false)} onNewObjective={() => setDonePreview(false)} onClose={() => setDonePreview(false)} />
        )}
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
      {!!onPress && !danger && <Ionicons name={dirIcon('chevron-forward')} size={16} color="#555" />}
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
    if (error) { Alert.alert(t('common.error'), /same|different/i.test(error.message) ? t('settings.pwdSame') : frError(error)); return; }
    Alert.alert(t('settings.pwdChanged'), t('settings.pwdChangedText'));
    onDone();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={st.inputLabel}>{t('settings.newPwd')}</Text>
      <TextInput style={st.input} value={pwd} onChangeText={setPwd} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" placeholder={t('settings.pwdMin')} placeholderTextColor="#666" />
      {tooShort && <Text style={st.error}>{t('settings.pwdMinDot')}</Text>}
      <Text style={[st.inputLabel, { marginTop: 18 }]}>{t('settings.confirm')}</Text>
      <TextInput style={st.input} value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" placeholder={t('settings.retype')} placeholderTextColor="#666" />
      {mismatch && <Text style={st.error}>{t('settings.mismatch')}</Text>}
      <TouchableOpacity style={[st.primaryBtn, !ok && { backgroundColor: '#1e1e1e' }]} onPress={saving ? undefined : save} activeOpacity={ok ? 0.8 : 1}>
        {saving ? <ActivityIndicator color="#000" /> : <Text style={[st.primaryBtnText, !ok && { color: '#666' }]}>{t('common.save')}</Text>}
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
    Alert.alert(t('settings.unblockTitle', { name: p.full_name }), t('settings.unblockText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.unblock'), onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { error } = await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', p.id);
          if (error) { Alert.alert(t('common.error'), frError(error)); return; }
          setList(prev => (prev || []).filter(x => x.id !== p.id));
        },
      },
    ]);
  };

  if (list === null) return <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />;
  if (list.length === 0) return <Text style={[st.hint, { textAlign: 'center', marginTop: 40, paddingHorizontal: 24 }]}>{t('settings.noBlocked')}</Text>;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={st.card}>
        {list.map((p, i) => (
          <View key={p.id} style={[st.row, i < list.length - 1 && st.rowBorder]}>
            {p.avatar_url
              ? <CachedImage uri={p.avatar_url} style={st.avatar} />
              : <View style={[st.avatar, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: '#fff', fontFamily: F.bold }}>{p.full_name?.charAt(0).toUpperCase()}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={st.rowLabel} numberOfLines={1}>{p.full_name}</Text>
              <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular }}>@{p.username}</Text>
            </View>
            <TouchableOpacity onPress={() => unblock(p)} style={st.smallBtn}><Text style={st.smallBtnText}>{t('settings.unblock')}</Text></TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// Choix de la langue. « Langue du téléphone » suit le réglage de l'iPhone. Changer relance l'app.
function LanguagePicker() {
  const picked = chosenLang();
  const options: { code: Lang | null; label: string; sub?: string }[] = [
    { code: null, label: t('settings.phoneLanguage'), sub: LANGS.find(l => l.code === deviceLang())?.name },
    ...LANGS.map(l => ({ code: l.code as Lang | null, label: l.name })),
  ];
  const choose = (code: Lang | null) => {
    if (code === picked) return;
    // Vers ou depuis l'hébreu : iOS ne bascule l'alignement naturel du texte qu'à une vraie relance de l'app
    // (le redémarrage de Reiz garde le même processus). On demande donc de fermer puis rouvrir.
    const flips = ((code ?? deviceLang()) === 'he') !== isRTL();
    Alert.alert(t('settings.restartTitle'), t(flips ? 'settings.restartTextDir' : 'settings.restartText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.restart'), onPress: () => { setLanguage(code); } },
    ]);
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={st.card}>
        {options.map((o, i) => (
          <TouchableOpacity key={o.code ?? 'device'} style={[st.row, i < options.length - 1 && st.rowBorder]} onPress={() => choose(o.code)} activeOpacity={0.7} accessibilityState={{ selected: o.code === picked }}>
            <View style={{ flex: 1 }}>
              <Text style={st.rowLabel} numberOfLines={1}>{o.label}</Text>
              {!!o.sub && <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular, marginTop: 2 }}>{o.sub}</Text>}
            </View>
            {o.code === picked && <Ionicons name="checkmark" size={20} color="#fff" />}
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[st.hint, { marginTop: 12 }]}>{t('settings.languageHint')}</Text>
    </ScrollView>
  );
}

function LegalReader({ doc, bottom }: { doc: LegalDoc; bottom: number }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottom + 40 }} showsVerticalScrollIndicator={false}>
      <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular, marginBottom: 14 }}>{t('settings.lastUpdate', { date: doc.updated })}</Text>
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
  sectionTitle: { fontSize: 11, color: '#777', fontFamily: F.bold, letterSpacing: 1.5, marginBottom: 8 },
  card: { backgroundColor: '#111', borderRadius: 18, borderWidth: 1, borderColor: '#1c1c1c', overflow: 'hidden' },
  // Même hauteur pour toutes les lignes, avec ou sans interrupteur.
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 52 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#1c1c1c' },
  rowLabel: { color: '#fff', fontSize: 15, fontFamily: F.semibold, flexShrink: 1 },
  rowValue: { color: '#777', fontSize: 13, fontFamily: F.regular, flex: 1, textAlign: 'right' },
  hint: { color: '#666', fontSize: 12, fontFamily: F.regular, lineHeight: 18, marginTop: 8 },
  version: { color: '#555', fontSize: 12, fontFamily: F.regular, textAlign: 'center', marginTop: 28 },
  inputLabel: { fontSize: 10, color: '#888', letterSpacing: 1.5, fontFamily: F.bold, marginBottom: 6 },
  input: { backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a', borderRadius: 14, padding: 14, fontSize: 14, color: '#fff', fontFamily: F.regular },
  error: { color: '#ff453a', fontSize: 12, fontFamily: F.regular, marginTop: 6 },
  primaryBtn: { backgroundColor: '#fff', borderRadius: 16, minHeight: 50, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', marginTop: 26 },
  primaryBtnText: { color: '#000', fontSize: 15, fontFamily: F.extrabold },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222' },
  smallBtn: { backgroundColor: '#1e1e1e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  smallBtnText: { color: '#fff', fontSize: 13, fontFamily: F.semibold },
  legalIntro: { color: '#ccc', fontSize: 15, fontFamily: F.regular, lineHeight: 24, marginBottom: 22 },
  legalH: { color: '#fff', fontSize: 16, fontFamily: F.bold, marginBottom: 8 },
  legalP: { color: '#aaa', fontSize: 14, fontFamily: F.regular, lineHeight: 22 },
});
