import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, TextInput, Alert, ActivityIndicator, RefreshControl, Modal, useWindowDimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase, currentUser, storedUserId } from '../lib/supabase';
import { cacheGet, cacheSet } from '../lib/cache';
import { frError, inUnit } from '../lib/helpers';
import * as Haptics from 'expo-haptics';
import { uploadImage, signOne, resetSignedCache } from '../lib/storage';
import { Objective, Update, FeedMeta } from '../lib/types';
import { HEATMAP_MAX_DAYS, GUTTER, navClearance } from '../constants';
import { s, F } from '../styles';
import { ProfileSkeleton } from '../components/Skeleton';
import { JourneyModal } from '../components/JourneyModal';
import { ProfileHero, ProfileBackdrop, GlassIconButton, StatBubble, AboutBubble, BadgesSection, GoalCards, HistoryCarousel, AchievedList, SectionHeader, computeBadges, isCompleted } from '../components/ProfileSections';
import { PostViewer } from '../components/PostViewer';
import { ProfileTags } from '../components/ProfileTags';
import { PeopleListModal } from '../components/PeopleListModal';
import { MyFriendsBubble } from '../components/MyFriendsBubble';
import { SportBadge } from '../components/SportBadge';
import { SettingsScreen } from './SettingsScreen';
import { loadProfilePosts, loadPost } from '../lib/posts';
import { selectObjectives } from '../lib/objectives';
import { ObjectiveEditSheet } from '../components/ObjectiveEditSheet';
import { CloseCircleBubble } from '../components/CloseCircleBubble';
import { resetCloseCircle } from '../lib/closeCircle';
import { forgetLiveActivityToken } from '../lib/liveActivity';
import { t, tp, formatDate } from '../i18n';
import { mark } from '../lib/perf';

type ProfileSnapshot = {
  profile: any;
  avatarUrl: string | null;
  objectives: Objective[];
  activity: Record<string, string[]>;
  friendCount: number;
  posts: Update[];
};

export function ProfileScreen({ onClose, streak, onCreateObjective, onViewProfile }: { onClose: () => void; streak: number; onCreateObjective: () => void; onViewProfile?: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  // Objectif atteint dont le parcours est ouvert (1.2).
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [activityByObj, setActivityByObj] = useState<Record<string, Set<string>>>({});
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const localAvatar = useRef(false);
  const [refreshingProfile, setRefreshingProfile] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  // Tous tes posts : badges, épinglés et grille d'historique.
  const [posts, setPosts] = useState<Update[]>([]);
  const [viewing, setViewing] = useState<{ u: Update; meta: FeedMeta } | null>(null);
  // Fenêtre « Amis » (liste cliquable) ou « Cercle proche » (étoiles).
  const [peopleMode, setPeopleMode] = useState<'friends' | 'close' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // Objectif en cours de modification (feuille).
  const [daysFor, setDaysFor] = useState<Objective | null>(null);

  // Profil déjà vu : affiché tout de suite depuis la mémoire du téléphone, puis mis à jour sans écran de chargement.
  // Avant le 25/10/2026, chaque ouverture de l'onglet repartait de zéro (0,6 s de roue mesurées dans le simulateur).
  useEffect(() => {
    (async () => {
      const uid = await storedUserId();
      const snap = uid ? await cacheGet<ProfileSnapshot>(`profile.${uid}`, 5 * 24 * 3600 * 1000) : null;
      if (snap) {
        setUserId(uid);
        setProfile(snap.profile);
        setNewName(snap.profile?.full_name || '');
        setNewBio(snap.profile?.bio || '');
        setAvatarUrl(snap.avatarUrl);
        setObjectives(snap.objectives.map(inUnit));
        setActivityByObj(Object.fromEntries(Object.entries(snap.activity || {}).map(([k, v]) => [k, new Set(v)])));
        setFriendCount(snap.friendCount);
        setPosts(snap.posts);
        setLoading(false);
        mark('profil:memoire', false);
      }
      loadProfile(!!snap);
    })();
  }, []);

  const loadProfile = async (silent = false) => {
    mark('profil:debut', false);
    if (!silent) setLoading(true);
    const user = await currentUser();
    if (!user) { setLoading(false); return; }
    const sinceISO = new Date(Date.now() - HEATMAP_MAX_DAYS * 24 * 60 * 60 * 1000).toISOString();
    setUserId(user.id);
    // Tes posts (badges, épinglés, historique) arrivent à part : le haut du profil ne les attend pas.
    const postsP = loadProfilePosts(user.id).catch(() => null);
    postsP.then(p => { if (p) setPosts(p); });
    const [profileRes, objRes, updatesRes, friendsRes] = await Promise.all([
      supabase.from('users').select('full_name, username, created_at, avatar_url, bio, sport').eq('id', user.id).single(),
      selectObjectives('id, emoji, title, current_value, target_value, unit, visibility, duration_days, is_completed', cols => supabase.from('objectives').select(cols).eq('user_id', user.id).order('created_at', { ascending: false })),
      supabase.from('updates').select('objective_id, created_at').eq('user_id', user.id).gte('created_at', sinceISO),
      supabase.from('friendships').select('requester_id, receiver_id').or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`).eq('status', 'accepted'),
    ]);
    let avatarP: Promise<string | null> = Promise.resolve(null);
    if (profileRes.data) {
      setProfile(profileRes.data);
      setNewName(profileRes.data.full_name);
      setNewBio(profileRes.data.bio || '');
      // La grande version (1200) met parfois 20 s à être préparée par le serveur : on montre tout de suite une
      // petite version (souvent déjà en mémoire), puis on la remplace par la nette dès qu'elle est téléchargée.
      // Ta photo d'origine (720 px depuis la 1.0.1), signée en une requête : les versions réduites 300 et 1200 px
      // demandées avant au serveur pouvaient mettre plusieurs secondes à être préparées.
      // Elle arrive à part : le reste du profil s'affiche sans l'attendre.
      const path = profileRes.data.avatar_url;
      avatarP = path ? signOne(path).catch(() => null) : Promise.resolve(null);
      // Photo tout juste changée : on garde celle du téléphone à l'écran, pas de saut vers l'adresse signée.
      avatarP.then(u => { if (!localAvatar.current) setAvatarUrl(u); });
    }
    if (objRes.data) setObjectives((objRes.data as Objective[]).map(inUnit));
    if (updatesRes.data) {
      const map: Record<string, Set<string>> = {};
      (updatesRes.data as { objective_id: string; created_at: string }[]).forEach(u => {
        if (!u.objective_id) return;
        const key = new Date(u.created_at).toDateString();
        if (!map[u.objective_id]) map[u.objective_id] = new Set<string>();
        map[u.objective_id].add(key);
      });
      setActivityByObj(map);
    }
    // Personnes distinctes, pas lignes : une amitié en double ne compte qu'une fois.
    const friends = friendsRes.data ? new Set(friendsRes.data.map(f => (f.requester_id === user.id ? f.receiver_id : f.requester_id))).size : null;
    if (friends != null) setFriendCount(friends);
    setLoading(false);
    // Mémoire pour la prochaine ouverture de l'onglet (liens de photos valables 7 jours).
    if (profileRes.data && objRes.data && updatesRes.data && friends != null) {
      const activity: Record<string, string[]> = {};
      (updatesRes.data as { objective_id: string; created_at: string }[]).forEach(u => {
        if (!u.objective_id) return;
        const key = new Date(u.created_at).toDateString();
        (activity[u.objective_id] ||= []).includes(key) || activity[u.objective_id].push(key);
      });
      Promise.all([avatarP, postsP]).then(([avatar, allPosts]) => {
        if (allPosts) cacheSet(`profile.${user.id}`, { profile: profileRes.data, avatarUrl: avatar, objectives: objRes.data, activity, friendCount: friends, posts: allPosts } as ProfileSnapshot);
      });
    }
    mark('profil:affiche', false);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const user = await currentUser();
    if (!user) { setSaving(false); return; }
    await supabase.from('users').update({ full_name: newName.trim() }).eq('id', user.id);
    setSaving(false); setEditingName(false); loadProfile();
  };

  const openPost = async (p: Update) => {
    const res = await loadPost(p.id, userId);
    if (res) setViewing(res);
  };

  // Changer son sport depuis la pastille sous le nom.
  const changeSport = async (id: string | null) => {
    if (!userId) return;
    const before = profile?.sport ?? null;
    setProfile((p: any) => ({ ...p, sport: id }));
    const { error } = await supabase.from('users').update({ sport: id }).eq('id', userId);
    if (error) { setProfile((p: any) => ({ ...p, sport: before })); Alert.alert(t('common.error'), t('profile.sportFailed')); }
  };

  const handleSaveBio = async () => {
    setSaving(true);
    const user = await currentUser();
    if (!user) { setSaving(false); return; }
    const bio = newBio.trim();
    const { error } = await supabase.from('users').update({ bio: bio || null }).eq('id', user.id);
    setSaving(false);
    if (error) { Alert.alert(t('common.error'), frError(error)); return; }
    setEditingBio(false);
    setProfile((p: any) => ({ ...p, bio: bio || null }));
  };

  const handlePickAvatar = async () => {
    Alert.alert(t('welcome.avatarTitle'), t('welcome.chooseOption'), [
      {
        text: t('common.takePhoto'),
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert(t('post.permDenied'), t('post.permCamera')); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled) uploadAvatar(result.assets[0].uri);
        }
      },
      {
        text: t('common.pickFromLibrary'),
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert(t('post.permDenied'), t('post.permLibrary')); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled) uploadAvatar(result.assets[0].uri);
        }
      },
      { text: t('common.cancel'), style: 'cancel' }
    ]);
  };

  // Fluide : la nouvelle photo s'affiche tout de suite, l'envoi se fait derrière. En cas d'échec, l'ancienne revient.
  const uploadAvatar = async (uri: string) => {
    const previous = avatarUrl;
    localAvatar.current = true;
    setAvatarUrl(uri);
    Haptics.selectionAsync().catch(() => {});
    const user = await currentUser();
    if (!user) { localAvatar.current = false; setAvatarUrl(previous); return; }
    // On enregistre le chemin, pas une URL : le bucket est privé et chaque
    // affichage génère une URL signée (qui change à chaque fois, ce qui règle
    // aussi le cache d'images sans avoir besoin d'un paramètre anti-cache).
    const { path, error } = await uploadImage(`avatars/${user.id}.jpg`, uri, true);
    if (error || !path) {
      localAvatar.current = false;
      setAvatarUrl(previous);
      Alert.alert(t('common.error'), frError(error));
      return;
    }
    await supabase.from('users').update({ avatar_url: path }).eq('id', user.id);
    resetSignedCache();
    loadProfile(true);
  };

  // Suppression d'un objectif : la base efface en cascade les publications
  // rattachées, d'où l'avertissement explicite dans la confirmation.
  // Toucher « … » sur un objectif : la feuille pour modifier sa visibilité, ses jours d'entraînement, ou le supprimer.
  const openObjectiveMenu = (o: Objective) => setDaysFor(o);

  const handleDeleteObjective = (o: Objective) => {
    Alert.alert(
      t('profile.deleteObjTitle', { title: o.title }),
      t('profile.deleteObjText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('objectives').delete().eq('id', o.id);
            if (error) { Alert.alert(t('common.error'), frError(error)); return; }
            setObjectives(prev => prev.filter(x => x.id !== o.id));
          },
        },
      ]
    );
  };

  const openSettings = () => setShowSettings(true);

  const handleSignOut = async () => {
    Alert.alert(t('profile.signOutTitle'), t('profile.signOutText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.signOut'), style: 'destructive', onPress: async () => { await forgetLiveActivityToken(); supabase.auth.signOut(); } }
    ]);
  };

  // Obligatoire pour l'App Store : l'utilisateur doit pouvoir supprimer son compte.
  // La suppression réelle est faite côté serveur (edge function "delete-account").
  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccount'),
      t('profile.deleteAccountText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteForever'), style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await supabase.functions.invoke('delete-account');
            setDeleting(false);
            if (error) { Alert.alert(t('common.error'), t('profile.deleteFailed')); return; }
            supabase.auth.signOut().catch(() => {});
          },
        },
      ]
    );
  };

  const { height: winH } = useWindowDimensions();
  const heroH = Math.round(Math.min(winH * 0.72, 620));
  const ongoing = objectives.filter(o => !isCompleted(o));
  const achieved = objectives.filter(isCompleted);
  const badges = computeBadges(posts, objectives);
  const memberSince = profile?.created_at ? formatDate(profile.created_at, { month: 'long', year: 'numeric' }) : '';
  const topBtn = insets.top + 58;
  // Position de défilement : pilote le fondu photo nette -> photo floutée derrière la page.
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <View style={s.container}>
      {!loading && <ProfileBackdrop avatarUrl={avatarUrl} scrollY={scrollY} height={heroH} />}
      {loading ? (
        <View style={{ flex: 1, paddingTop: insets.top + 54 }}><ProfileSkeleton /></View>
      ) : (
        <Animated.ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          refreshControl={
            <RefreshControl
              refreshing={refreshingProfile}
              onRefresh={async () => { setRefreshingProfile(true); await loadProfile(true); setRefreshingProfile(false); }}
              tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" progressViewOffset={topBtn}
            />
          }
        >
          {/* === Photo de profil en plein écran, nom au-dessus, bulle de verre à 3 zones === */}
          <ProfileHero height={heroH}>
            <GlassIconButton icon="camera-outline" label={t('profile.changePhoto')} onPress={handlePickAvatar} style={{ position: 'absolute', top: topBtn, left: GUTTER }} />
            <GlassIconButton icon="settings-outline" label={t('settings.title')} onPress={openSettings} style={{ position: 'absolute', top: topBtn, right: GUTTER }} />

            {editingName ? (
              <View style={s.profileNameEdit}>
                <TextInput style={s.profileNameInput} value={newName} onChangeText={setNewName} autoFocus autoCapitalize="words" placeholderTextColor="#666" maxLength={40} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={s.profileSaveBtn} onPress={saving ? undefined : handleSaveName}>
                    {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.profileSaveBtnText}>{t('profile.save')}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.profileCancelBtn} onPress={() => { setEditingName(false); setNewName(profile?.full_name || ''); }}>
                    <Text style={s.profileCancelBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingName(true)} activeOpacity={0.8}>
                <Text style={{ fontSize: 40, fontFamily: F.black, color: '#fff', textAlign: 'center', letterSpacing: -1.5, paddingHorizontal: GUTTER }} numberOfLines={2}>{profile?.full_name || t('common.user')}</Text>
              </TouchableOpacity>
            )}
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', fontFamily: F.semibold, marginTop: 4 }}>@{profile?.username}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: F.regular, marginTop: 2 }}>{t('profile.memberSince', { date: memberSince })}</Text>
            <SportBadge sport={profile?.sport} editable onChange={changeSport} />

            <StatBubble items={[
              { value: t('days.durationDays', { n: streak }), label: t('main.statStreak') },
              { value: String(posts.length), label: t('profile.posts') },
              { value: String(friendCount), label: tp('profile.friends', friendCount), onPress: () => setPeopleMode('friends') },
            ]} />
          </ProfileHero>

          {/* === À propos : bulle de verre (bio + tags) === */}
          <AboutBubble>
            {editingBio ? (
              <View style={{ gap: 10, alignSelf: 'stretch' }}>
                <TextInput
                  style={[s.profileNameInput, { fontSize: 14, minHeight: 60, textAlignVertical: 'top', textAlign: 'left' }]}
                  value={newBio}
                  onChangeText={setNewBio}
                  autoFocus
                  multiline
                  maxLength={150}
                  placeholder={t('profile.bioPlaceholder')}
                  placeholderTextColor="#666"
                />
                <Text style={{ color: '#666', fontSize: 11, alignSelf: 'flex-end' }}>{newBio.length}/150</Text>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                  <TouchableOpacity style={s.profileSaveBtn} onPress={saving ? undefined : handleSaveBio}>
                    {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.profileSaveBtnText}>{t('profile.save')}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.profileCancelBtn} onPress={() => { setEditingBio(false); setNewBio(profile?.bio || ''); }}>
                    <Text style={s.profileCancelBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingBio(true)} activeOpacity={0.8}>
                <Text style={[s.sectionTitle, { marginTop: 0 }]}>{t('profile.about')}</Text>
                {profile?.bio
                  ? <Text style={{ fontSize: 15, color: '#fff', lineHeight: 22, fontFamily: F.regular }}>{profile.bio}</Text>
                  : <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', fontFamily: F.regular }}>{t('profile.addBio')}</Text>}
              </TouchableOpacity>
            )}
            {userId && <View style={{ alignSelf: 'stretch' }}><ProfileTags userId={userId} currentUserId={userId} own /></View>}
          </AboutBubble>

          {/* Tes amis et ton cercle proche vivent ici (l'onglet Amis sert à en découvrir de nouveaux). */}
          {userId && <MyFriendsBubble userId={userId} onOpen={() => setPeopleMode('friends')} reloadKey={peopleMode} />}
          <CloseCircleBubble onManage={() => setPeopleMode('close')} reloadKey={peopleMode} />

          {/* === Badges, puis objectifs en cours, puis historique des posts === */}
          <BadgesSection badges={badges} own />

          {/* Même écart (26) au-dessus de chaque section : Badges, En cours, Historique. */}
          <View style={{ marginTop: 26 }}>
            {objectives.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyStateTitle}>{t('profile.firstObjTitle')}</Text>
                <Text style={s.emptyStateText}>{t('profile.firstObjText')}</Text>
                <TouchableOpacity style={s.emptyStateBtn} onPress={onCreateObjective}>
                  <Text style={s.emptyStateBtnText}>{t('profile.goToObjectives')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {ongoing.length > 0 && <SectionHeader title={t('profile.ongoing')} count={ongoing.length} style={{ paddingHorizontal: GUTTER }} />}
                <GoalCards items={ongoing} activity={activityByObj} onPress={openObjectiveMenu} />
                <AchievedList items={achieved} onOpen={o => setJourneyId(o.id)} />
                {journeyId && <JourneyModal objectiveId={journeyId} own={true} ownerName={undefined} from="profile" onClose={() => setJourneyId(null)} />}
              </>
            )}
          </View>

          <SectionHeader title={t('profile.history')} count={posts.length} style={{ paddingHorizontal: GUTTER, marginTop: 26 }} />
          <HistoryCarousel posts={posts} onOpen={openPost} emptyText={t('profile.historyEmpty')} />

          {deleting && <ActivityIndicator color="#ff3b30" size="small" style={{ marginTop: 16 }} />}
          {/* Sans cette réserve, le bas de la page finit sous la barre de nav. */}
          <View style={{ height: navClearance(insets.bottom) }} />
        </Animated.ScrollView>
      )}
      <ObjectiveEditSheet
        objective={daysFor}
        onClose={() => setDaysFor(null)}
        onChanged={patch => daysFor && setObjectives(prev => prev.map(x => (x.id === daysFor.id ? { ...x, ...patch } : x)))}
        onDelete={handleDeleteObjective}
      />
      <SettingsScreen
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onEditName={() => setEditingName(true)}
        onEditBio={() => setEditingBio(true)}
        onCloseFriends={() => setPeopleMode('close')}
        onSignOut={handleSignOut}
        onDeleteAccount={handleDeleteAccount}
      />
      {userId && (
        <PeopleListModal
          visible={!!peopleMode}
          mode={peopleMode || 'friends'}
          userId={userId}
          currentUserId={userId}
          onClose={() => { setPeopleMode(null); resetCloseCircle(); }}
          onOpenProfile={(id) => { setPeopleMode(null); onViewProfile?.(id); }}
        />
      )}
      <Modal visible={!!viewing} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setViewing(null)}>
        {viewing && (
          <PostViewer
            post={viewing}
            currentUserId={userId}
            onClose={() => setViewing(null)}
            onChanged={() => loadProfile(true)}
            onOpenProfile={(id) => { if (id === userId) return; setViewing(null); onViewProfile?.(id); }}
          />
        )}
      </Modal>
    </View>
  );
}
