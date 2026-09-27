import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/helpers';
import { uploadImage, signOne } from '../lib/storage';
import { Objective } from '../lib/types';
import { HEATMAP_MAX_DAYS, daysFor, dayKeysFor, navClearance } from '../constants';
import { s } from '../styles';
import { ProfileSkeleton } from '../components/Skeleton';
import { BadgesStrip, PinnedRow, PostsGrid, computeBadges, isCompleted } from '../components/ProfileSections';
import { PostViewer } from '../components/PostViewer';
import { ProfileTags } from '../components/ProfileTags';
import { PeopleListModal } from '../components/PeopleListModal';
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
    if (objRes.data) setObjectives(objRes.data as Objective[]);
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

  const openSettings = () => {
    Alert.alert('Paramètres', undefined, [
      { text: 'Modifier mon nom', onPress: () => setEditingName(true) },
      { text: 'Modifier ma bio', onPress: () => setEditingBio(true) },
      { text: 'Mon cercle proche', onPress: () => setPeopleMode('close') },
      { text: 'Se déconnecter', onPress: handleSignOut },
      { text: 'Supprimer mon compte', style: 'destructive', onPress: handleDeleteAccount },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

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

  const progressPct = (o: Objective) => o.target_value > 0 ? Math.min(Math.round((o.current_value / o.target_value) * 100), 100) : 0;
  const initial = profile?.full_name?.charAt(0).toUpperCase() || '?';
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';

  return (
    <View style={s.container}>
      {loading ? (
        <ProfileSkeleton />
      ) : (
        <ScrollView
          style={s.feed}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshingProfile}
              onRefresh={async () => { setRefreshingProfile(true); await loadProfile(true); setRefreshingProfile(false); }}
              tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a"
            />
          }
        >
          <View style={s.profileTopBar}>
            <TouchableOpacity
              style={s.profileSettingsBtn}
              onPress={openSettings}
              accessibilityLabel="Paramètres"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="settings-outline" size={20} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={s.profileHero}>
            <TouchableOpacity style={s.profileAvatarWrap} onPress={handlePickAvatar} activeOpacity={0.8}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={s.profileAvatarImg} />
                : <View style={s.profileAvatar}><Text style={s.profileAvatarText}>{initial}</Text></View>
              }
              {uploadingAvatar
                ? <View style={s.profileAvatarOverlay}><ActivityIndicator color="#fff" /></View>
                : <View style={s.profileAvatarOverlay}><Ionicons name="camera" size={13} color="#fff" /></View>
              }
            </TouchableOpacity>
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
              <TouchableOpacity onPress={() => setEditingName(true)}>
                <Text style={s.profileName}>{profile?.full_name || 'Utilisateur'}</Text>
                <Text style={s.profileEditHint}>Appuie pour modifier</Text>
              </TouchableOpacity>
            )}
            <Text style={s.profileUsername}>@{profile?.username}</Text>
            {editingBio ? (
              <View style={[s.profileNameEdit, { marginTop: 10 }]}>
                <TextInput
                  style={[s.profileNameInput, { fontSize: 14, minHeight: 60, textAlignVertical: 'top' }]}
                  value={newBio}
                  onChangeText={setNewBio}
                  autoFocus
                  multiline
                  maxLength={150}
                  placeholder="Ce que tu vises, ce qui te motive..."
                  placeholderTextColor="#666"
                />
                <Text style={{ color: '#666', fontSize: 11, alignSelf: 'flex-end' }}>{newBio.length}/150</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={s.profileSaveBtn} onPress={saving ? undefined : handleSaveBio}>
                    {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.profileSaveBtnText}>Sauvegarder</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.profileCancelBtn} onPress={() => { setEditingBio(false); setNewBio(profile?.bio || ''); }}>
                    <Text style={s.profileCancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setEditingBio(true)} style={{ marginTop: 8, paddingHorizontal: 24 }}>
                {profile?.bio
                  ? <Text style={s.profileBio}>{profile.bio}</Text>
                  : <Text style={[s.profileBio, { color: '#666' }]}>+ Ajoute une bio</Text>}
              </TouchableOpacity>
            )}
            <Text style={s.profileMember}>Membre depuis {memberSince}</Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.statPill}><Text style={s.statVal}>{streak}j</Text><Text style={s.statLbl}>Streak</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>{posts.length}</Text><Text style={s.statLbl}>Posts</Text></View>
            <TouchableOpacity style={s.statPill} onPress={() => setPeopleMode('friends')} activeOpacity={0.75} accessibilityLabel="Voir mes amis">
              <Text style={s.statVal}>{friendCount}</Text><Text style={s.statLbl}>{friendCount > 1 ? 'Amis' : 'Ami'}</Text>
            </TouchableOpacity>
          </View>

          {userId && <ProfileTags userId={userId} currentUserId={userId} own />}
          <BadgesStrip badges={computeBadges(posts, objectives)} own />
          <PinnedRow posts={posts} onOpen={openPost} />

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
              {objectives.some(o => !isCompleted(o)) && <Text style={s.sectionTitle}>EN COURS</Text>}
              {objectives.filter(o => !isCompleted(o)).map((o) => {
                const set = activityByObj[o.id] || new Set<string>();
                const nbDays = daysFor(o);
                const dayKeys = dayKeysFor(nbDays);
                const doneCount = dayKeys.filter(d => set.has(d)).length;
                const pct = progressPct(o);
                const isInfinite = o.duration_days == null;
                return (
                  <View key={o.id} style={s.objCardProfile}>
                    <View style={s.objCardProfileHead}>
                      <Text style={s.objCardProfileTitle} numberOfLines={1}>{o.emoji} {o.title}</Text>
                      <Text style={s.objCardProfilePct}>{pct}%</Text>
                      <TouchableOpacity
                        onPress={() => openObjectiveMenu(o)}
                        accessibilityLabel={`Options de l'objectif ${o.title}`}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={18} color="#777" />
                      </TouchableOpacity>
                    </View>
                    <View style={s.progressBg}><View style={[s.progressFill, { width: `${pct}%` as any }]} /></View>
                    <View style={s.heatGrid}>
                      {dayKeys.map((d, i) => (
                        <View key={i} style={[s.heatCell, set.has(d) && s.heatCellActive]} />
                      ))}
                    </View>
                    <Text style={s.objCardProfileFoot}>
                      {doneCount} jours {isInfinite ? `sur les ${nbDays} derniers` : `sur ${nbDays}`}
                    </Text>
                  </View>
                );
              })}
            </>
          )}

          {objectives.some(isCompleted) && (
            <>
              <Text style={s.sectionTitle}>RÉUSSIS</Text>
              {objectives.filter(isCompleted).map(o => (
                <View key={o.id} style={s.profileObjRow}>
                  <Text style={s.profileObjEmoji}>{o.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.profileObjName}>{o.title}</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>{o.target_value} {o.unit} atteints</Text>
                  </View>
                  <Text style={{ fontSize: 20 }}>🏆</Text>
                </View>
              ))}
            </>
          )}

          <PostsGrid posts={posts} onOpen={openPost} emptyText="Tes publications apparaîtront ici." />

          {/* Déconnexion et suppression de compte vivent désormais dans le menu
              de la roue dentée, en haut à droite. */}
          {deleting && <ActivityIndicator color="#ff3b30" size="small" style={{ marginTop: 16 }} />}
          {/* Sans cette réserve, "Supprimer mon compte" finit sous la barre de nav. */}
          <View style={{ height: navClearance(insets.bottom) }} />
        </ScrollView>
      )}
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
          />
        )}
      </Modal>
    </View>
  );
}
