import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, RefreshControl, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { frError, inUnit } from '../lib/helpers';
import { uploadImage, signOne } from '../lib/storage';
import { Objective } from '../lib/types';
import { HEATMAP_MAX_DAYS, GUTTER, navClearance } from '../constants';
import { s, F } from '../styles';
import { ProfileSkeleton } from '../components/Skeleton';
import { ProfileHeroPhoto, GlassIconButton, StatBubble, AboutBubble, BadgesSection, GoalCards, HistoryCarousel, AchievedList, SectionHeader, computeBadges, isCompleted } from '../components/ProfileSections';
import { PostViewer } from '../components/PostViewer';
import { ProfileTags } from '../components/ProfileTags';
import { PeopleListModal } from '../components/PeopleListModal';
import { SettingsScreen } from './SettingsScreen';
import { loadProfilePosts, loadPost } from '../lib/posts';
import { Update, FeedMeta } from '../lib/types';

export function ProfileScreen({ onClose, streak, onCreateObjective, onViewProfile }: { onClose: () => void; streak: number; onCreateObjective: () => void; onViewProfile?: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [activityByObj, setActivityByObj] = useState<Record<string, Set<string>>>({});
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const sinceISO = new Date(Date.now() - HEATMAP_MAX_DAYS * 24 * 60 * 60 * 1000).toISOString();
    setUserId(user.id);
    const [profileRes, objRes, updatesRes, friendsRes, allPosts] = await Promise.all([
      supabase.from('users').select('full_name, username, created_at, avatar_url, bio').eq('id', user.id).single(),
      supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility, duration_days, is_completed').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('updates').select('objective_id, created_at').eq('user_id', user.id).gte('created_at', sinceISO),
      supabase.from('friendships').select('requester_id, receiver_id').or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`).eq('status', 'accepted'),
      loadProfilePosts(user.id),
    ]);
    setPosts(allPosts);
    if (profileRes.data) {
      setProfile(profileRes.data);
      setNewName(profileRes.data.full_name);
      setNewBio(profileRes.data.bio || '');
      setAvatarUrl(await signOne(profileRes.data.avatar_url));
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
    if (friendsRes.data) setFriendCount(new Set(friendsRes.data.map(f => (f.requester_id === user.id ? f.receiver_id : f.requester_id))).size);
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

  const openPost = async (p: Update) => {
    const res = await loadPost(p.id, userId);
    if (res) setViewing(res);
  };

  const handleSaveBio = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const bio = newBio.trim();
    const { error } = await supabase.from('users').update({ bio: bio || null }).eq('id', user.id);
    setSaving(false);
    if (error) { Alert.alert('Erreur', frError(error)); return; }
    setEditingBio(false);
    setProfile((p: any) => ({ ...p, bio: bio || null }));
  };

  const handlePickAvatar = async () => {
    Alert.alert('Photo de profil', 'Choisis une option', [
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission refusée', 'Active la caméra dans les réglages.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled) uploadAvatar(result.assets[0].uri);
        }
      },
      {
        text: 'Importer depuis la galerie',
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadingAvatar(false); return; }
    // On enregistre le chemin, pas une URL : le bucket est privé et chaque
    // affichage génère une URL signée (qui change à chaque fois, ce qui règle
    // aussi le cache d'images sans avoir besoin d'un paramètre anti-cache).
    const { path, error } = await uploadImage(`avatars/${user.id}.jpg`, uri, true);
    if (error || !path) {
      setUploadingAvatar(false);
      Alert.alert('Erreur', frError(error));
      return;
    }
    await supabase.from('users').update({ avatar_url: path }).eq('id', user.id);
    await loadProfile(true);
    setUploadingAvatar(false);
  };

  // Suppression d'un objectif : la base efface en cascade les publications
  // rattachées, d'où l'avertissement explicite dans la confirmation.
  const setVisibility = async (o: Objective, visibility: string) => {
    const { error } = await supabase.from('objectives').update({ visibility }).eq('id', o.id);
    if (error) { Alert.alert('Erreur', frError(error)); return; }
    setObjectives(prev => prev.map(x => (x.id === o.id ? { ...x, visibility } : x)));
  };

  const VIS_LABEL: Record<string, string> = { friends: 'Mon cercle', close: 'Cercle proche', private: 'Moi seul', public: 'Public' };
  const openObjectiveMenu = (o: Objective) => {
    const mark = (v: string) => (o.visibility === v ? '✓ ' : '');
    Alert.alert(`${o.emoji} ${o.title}`, `Visible par : ${VIS_LABEL[o.visibility] || o.visibility}`, [
      { text: `${mark('friends')}Visible par mon cercle`, onPress: () => setVisibility(o, 'friends') },
      { text: `${mark('close')}Visible par mon cercle proche`, onPress: () => setVisibility(o, 'close') },
      { text: `${mark('private')}Moi seul`, onPress: () => setVisibility(o, 'private') },
      { text: "Supprimer l'objectif", style: 'destructive', onPress: () => handleDeleteObjective(o) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleDeleteObjective = (o: Objective) => {
    Alert.alert(
      `Supprimer "${o.title}" ?`,
      'Cet objectif et toutes les publications qui y sont rattachées seront effacés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('objectives').delete().eq('id', o.id);
            if (error) { Alert.alert('Erreur', frError(error)); return; }
            setObjectives(prev => prev.filter(x => x.id !== o.id));
          },
        },
      ]
    );
  };

  const openSettings = () => setShowSettings(true);

  const handleSignOut = async () => {
    Alert.alert('Déconnexion', 'Tu veux vraiment te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => supabase.auth.signOut() }
    ]);
  };

  // Obligatoire pour l'App Store : l'utilisateur doit pouvoir supprimer son compte.
  // La suppression réelle est faite côté serveur (edge function "delete-account").
  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Toutes tes données (posts, objectifs, amis, photos) seront définitivement effacées. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement', style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await supabase.functions.invoke('delete-account');
            setDeleting(false);
            if (error) { Alert.alert('Erreur', 'La suppression a échoué. Réessaie ou contacte-nous.'); return; }
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
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';
  const topBtn = insets.top + 58;

  return (
    <View style={s.container}>
      {loading ? (
        <View style={{ flex: 1, paddingTop: insets.top + 54 }}><ProfileSkeleton /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshingProfile}
              onRefresh={async () => { setRefreshingProfile(true); await loadProfile(true); setRefreshingProfile(false); }}
              tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" progressViewOffset={topBtn}
            />
          }
        >
          {/* === Photo de profil en plein écran, nom au-dessus, bulle de verre à 3 zones === */}
          <ProfileHeroPhoto avatarUrl={avatarUrl} height={heroH}>
            <GlassIconButton icon="camera-outline" label="Changer la photo de profil" onPress={handlePickAvatar} style={{ position: 'absolute', top: topBtn, left: GUTTER }} />
            <GlassIconButton icon="settings-outline" label="Réglages" onPress={openSettings} style={{ position: 'absolute', top: topBtn, right: GUTTER }} />
            {uploadingAvatar && <ActivityIndicator color="#fff" style={{ position: 'absolute', top: heroH / 2 }} />}

            {editingName ? (
              <View style={s.profileNameEdit}>
                <TextInput style={s.profileNameInput} value={newName} onChangeText={setNewName} autoFocus autoCapitalize="words" placeholderTextColor="#666" maxLength={40} />
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
              <TouchableOpacity onPress={() => setEditingName(true)} activeOpacity={0.8}>
                <Text style={{ fontSize: 40, fontFamily: F.black, color: '#fff', textAlign: 'center', letterSpacing: -1.5, paddingHorizontal: GUTTER }} numberOfLines={2}>{profile?.full_name || 'Utilisateur'}</Text>
              </TouchableOpacity>
            )}
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', fontFamily: F.semibold, marginTop: 4 }}>@{profile?.username}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: F.regular, marginTop: 2 }}>Membre depuis {memberSince}</Text>

            <StatBubble items={[
              { value: `${streak}j`, label: 'Streak' },
              { value: String(posts.length), label: 'Posts' },
              { value: String(friendCount), label: friendCount > 1 ? 'Amis' : 'Ami', onPress: () => setPeopleMode('friends') },
            ]} />
          </ProfileHeroPhoto>

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
                  placeholder="Ce que tu vises, ce qui te motive..."
                  placeholderTextColor="#666"
                />
                <Text style={{ color: '#666', fontSize: 11, alignSelf: 'flex-end' }}>{newBio.length}/150</Text>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                  <TouchableOpacity style={s.profileSaveBtn} onPress={saving ? undefined : handleSaveBio}>
                    {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.profileSaveBtnText}>Sauvegarder</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.profileCancelBtn} onPress={() => { setEditingBio(false); setNewBio(profile?.bio || ''); }}>
                    <Text style={s.profileCancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingBio(true)} activeOpacity={0.8} style={{ alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5, marginBottom: 6 }}>À PROPOS</Text>
                {profile?.bio
                  ? <Text style={{ fontSize: 15, color: '#fff', lineHeight: 22, fontFamily: F.regular, textAlign: 'center' }}>{profile.bio}</Text>
                  : <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', fontFamily: F.regular }}>+ Ajoute une bio</Text>}
              </TouchableOpacity>
            )}
            {userId && <View style={{ alignSelf: 'stretch' }}><ProfileTags userId={userId} currentUserId={userId} own /></View>}
          </AboutBubble>

          {/* === Badges, puis objectifs en cours, puis historique des posts === */}
          <BadgesSection badges={badges} own />

          <View style={{ marginTop: 14 }}>
            {objectives.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyStateTitle}>Pose ton premier objectif</Text>
                <Text style={s.emptyStateText}>Choisis ce que tu veux dépasser. Ton cercle te suivra chaque jour.</Text>
                <TouchableOpacity style={s.emptyStateBtn} onPress={onCreateObjective}>
                  <Text style={s.emptyStateBtnText}>Aller à mes objectifs →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {ongoing.length > 0 && <SectionHeader title="En cours" count={ongoing.length} style={{ paddingHorizontal: GUTTER }} />}
                <GoalCards items={ongoing} activity={activityByObj} onPress={openObjectiveMenu} />
                <AchievedList items={achieved} />
              </>
            )}
          </View>

          <SectionHeader title="Historique" count={posts.length} style={{ paddingHorizontal: GUTTER, marginTop: 6 }} />
          <HistoryCarousel posts={posts} onOpen={openPost} emptyText="Tes publications apparaîtront ici." />

          {deleting && <ActivityIndicator color="#ff3b30" size="small" style={{ marginTop: 16 }} />}
          {/* Sans cette réserve, le bas de la page finit sous la barre de nav. */}
          <View style={{ height: navClearance(insets.bottom) }} />
        </ScrollView>
      )}
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
          onClose={() => setPeopleMode(null)}
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
