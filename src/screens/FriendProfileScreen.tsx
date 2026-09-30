import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { calculateStreak, timeAgo, frError, inUnit } from '../lib/helpers';
import { signOne } from '../lib/storage';
import { Update, Objective, FeedMeta } from '../lib/types';
import { BadgesStrip, PinnedRow, PostsGrid, computeBadges, isCompleted } from '../components/ProfileSections';
import { PostViewer } from '../components/PostViewer';
import { ProfileTags } from '../components/ProfileTags';
import { PeopleListModal } from '../components/PeopleListModal';
import { loadProfilePosts, loadPost } from '../lib/posts';
import { s, F } from '../styles';

export function FriendProfileScreen({ userId, onClose, onOpenProfile }: { userId: string; onClose: () => void; onOpenProfile?: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<Update[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ u: Update; meta: FeedMeta } | null>(null);
  const [showFriends, setShowFriends] = useState(false);
  // Lien avec ce profil : on peut arriver ici depuis la liste d'amis d'un ami,
  // donc sur quelqu'un qui n'est pas (encore) dans ton cercle.
  const [relation, setRelation] = useState<{ kind: 'friends' | 'sent' | 'received' | 'none'; id?: string }>({ kind: 'friends' });
  const [relBusy, setRelBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: rel } = await supabase
          .from('friendships')
          .select('id, status, requester_id')
          .or(`and(requester_id.eq.${user.id},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${user.id})`)
          .maybeSingle();
        if (!rel) setRelation({ kind: 'none' });
        else if (rel.status === 'accepted') setRelation({ kind: 'friends', id: rel.id });
        else setRelation({ kind: rel.requester_id === user.id ? 'sent' : 'received', id: rel.id });
      }
      const [profileRes, objRes, updatesRes, friendsRes] = await Promise.all([
        supabase.from('users').select('full_name, username, created_at, avatar_url, bio').eq('id', userId).single(),
        supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility, is_completed').eq('user_id', userId).neq('visibility', 'private').order('created_at', { ascending: false }),
        // La base ne renvoie que les posts que tu as le droit de voir (RLS).
        loadProfilePosts(userId),
        supabase.from('friendships').select('id').or(`requester_id.eq.${userId},receiver_id.eq.${userId}`).eq('status', 'accepted'),
      ]);
      if (profileRes.data) {
        setProfile(profileRes.data);
        setAvatarUrl(await signOne(profileRes.data.avatar_url));
      }
      if (objRes.data) setObjectives((objRes.data as Objective[]).map(inUnit));
      setRecentUpdates(updatesRes.filter(u => u.objectives?.visibility !== 'private'));
      // friend_count (fonction serveur) donne le vrai total ; sans elle, la base
      // ne laisse compter que ta propre amitié avec cette personne.
      const { data: fc, error: fcErr } = await supabase.rpc('friend_count', { p_user: userId });
      if (!fcErr && typeof fc === 'number') setFriendCount(fc);
      else if (friendsRes.data) setFriendCount(friendsRes.data.length);
      const streakVal = await calculateStreak(userId);
      setStreak(streakVal);
      setLoading(false);
    };
    load();
  }, [userId, reloadKey]);

  const addFriend = async () => {
    if (!currentUserId) return;
    setRelBusy(true);
    const { error } = await supabase.from('friendships').insert({ requester_id: currentUserId, receiver_id: userId, status: 'pending' });
    setRelBusy(false);
    if (error && !/duplicate key/i.test(error.message || '')) { Alert.alert('Erreur', frError(error)); return; }
    // Rechargement plutôt que « envoyée » d'office : si cette personne t'avait
    // déjà demandé, le serveur accepte directement et vous êtes amis.
    setReloadKey(k => k + 1);
  };

  const acceptFriend = async () => {
    if (!relation.id) return;
    setRelBusy(true);
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', relation.id);
    setRelBusy(false);
    if (error) { Alert.alert('Erreur', frError(error)); return; }
    setReloadKey(k => k + 1);
  };

  const reportProfile = () => {
    const send = async (reason: string) => {
      if (!currentUserId) return;
      const { error } = await supabase.from('reports').insert({ reporter_id: currentUserId, reported_user_id: userId, reason });
      if (error) Alert.alert('Erreur', frError(error));
      else Alert.alert('Signalement envoyé', 'Ton signalement a bien été envoyé.');
    };
    Alert.alert('Signaler ce profil', 'Pourquoi signales-tu ce profil ?', [
      { text: 'Spam', onPress: () => send('spam') },
      { text: 'Comportement inapproprié', onPress: () => send('inapproprié') },
      { text: 'Autre', onPress: () => send('autre') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const blockProfile = () => {
    Alert.alert(`Bloquer ${profile?.full_name || 'cet utilisateur'}`, 'Vous ne verrez plus les contenus l\'un de l\'autre.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Bloquer', style: 'destructive',
        onPress: async () => {
          if (!currentUserId) return;
          const { error } = await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: userId });
          if (error && !/duplicate key/i.test(error.message || '')) { Alert.alert('Erreur', frError(error)); return; }
          // On supprime aussi le lien d'amitié éventuel
          await supabase.from('friendships').delete().or(`and(requester_id.eq.${currentUserId},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${currentUserId})`);
          onClose();
        },
      },
    ]);
  };

  const openMenu = () => {
    Alert.alert(profile?.full_name || 'Profil', undefined, [
      { text: 'Signaler le profil', onPress: reportProfile },
      { text: 'Bloquer', style: 'destructive', onPress: blockProfile },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const openPost = async (p: Update) => {
    const res = await loadPost(p.id, currentUserId);
    if (res) setViewing(res);
  };

  const progressPct = (o: Objective) => o.target_value > 0 ? Math.min(Math.round((o.current_value / o.target_value) * 100), 100) : 0;
  const initial = profile?.full_name?.charAt(0).toUpperCase() || '?';
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={s.backBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={20} color="#888" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{profile?.full_name || 'Profil'}</Text>
        <TouchableOpacity style={s.backBtn} onPress={openMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={18} color="#888" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
      ) : (
        <ScrollView style={s.feed} showsVerticalScrollIndicator={false}>
          <View style={s.profileHero}>
            <View style={s.profileAvatarWrap}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={s.profileAvatarImg} />
                : <View style={s.profileAvatar}><Text style={s.profileAvatarText}>{initial}</Text></View>
              }
            </View>
            <Text style={s.profileName}>{profile?.full_name || 'Utilisateur'}</Text>
            <Text style={s.profileUsername}>@{profile?.username}</Text>
            {profile?.bio ? <Text style={[s.profileBio, { marginTop: 8, paddingHorizontal: 24 }]}>{profile.bio}</Text> : null}
            <Text style={s.profileMember}>Membre depuis {memberSince}</Text>
            {relation.kind !== 'friends' && (
              <TouchableOpacity
                disabled={relBusy || relation.kind === 'sent'}
                onPress={relation.kind === 'received' ? acceptFriend : addFriend}
                style={{ marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: relation.kind === 'sent' ? '#1e1e1e' : '#fff' }}
              >
                {relBusy
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={{ color: relation.kind === 'sent' ? '#888' : '#000', fontSize: 14, fontFamily: F.bold }}>
                      {relation.kind === 'sent' ? 'Demande envoyée' : relation.kind === 'received' ? 'Accepter sa demande' : 'Ajouter à mon cercle'}
                    </Text>}
              </TouchableOpacity>
            )}
          </View>

          <View style={s.statsRow}>
            <View style={s.statPill}><Text style={s.statVal}>{streak}j</Text><Text style={s.statLbl}>Streak</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>{recentUpdates.length}</Text><Text style={s.statLbl}>Posts</Text></View>
            <TouchableOpacity
              style={s.statPill}
              activeOpacity={0.75}
              // La liste des amis n'est montrée qu'aux amis (règle du serveur, friends_of).
              disabled={relation.kind !== 'friends'}
              onPress={() => setShowFriends(true)}
              accessibilityLabel="Voir ses amis"
            >
              <Text style={s.statVal}>{friendCount}</Text><Text style={s.statLbl}>{friendCount > 1 ? 'Amis' : 'Ami'}</Text>
            </TouchableOpacity>
          </View>

          {relation.kind !== 'friends' && (
            <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', marginVertical: 12, paddingHorizontal: 24 }}>
              Ses progrès sont réservés à son cercle. Ajoute {profile?.full_name || 'cette personne'} pour les suivre.
            </Text>
          )}
          <ProfileTags userId={userId} currentUserId={currentUserId} own={false} />
          <BadgesStrip badges={computeBadges(recentUpdates, objectives)} own={false} />
          <PinnedRow posts={recentUpdates} onOpen={openPost} />

          <Text style={s.sectionTitle}>EN COURS</Text>
          {objectives.filter(o => !isCompleted(o)).length === 0 ? (
            <View style={{ paddingVertical: 12 }}><Text style={{ color: '#888', fontSize: 13 }}>Pas d'objectif en cours visible</Text></View>
          ) : objectives.filter(o => !isCompleted(o)).map((o) => (
            <View key={o.id} style={s.profileObjRow}>
              <Text style={s.profileObjEmoji}>{o.emoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.profileObjName}>{o.title}</Text>
                <View style={s.progressBg}><View style={[s.progressFill, { width: `${progressPct(o)}%` as any }]} /></View>
                {o.unit !== '%' && <Text style={{ color: '#888', fontSize: 11 }}>{o.current_value} / {o.target_value} {o.unit}</Text>}
              </View>
              {o.unit === '%' && <Text style={s.profileObjPct}>{progressPct(o)}%</Text>}
            </View>
          ))}

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

          <PostsGrid posts={recentUpdates} onOpen={openPost} emptyText="Pas encore de publication visible." />
          <View style={{ height: 40 + insets.bottom }} />
        </ScrollView>
      )}
      <PeopleListModal
        visible={showFriends}
        mode="friends"
        userId={userId}
        currentUserId={currentUserId}
        onClose={() => setShowFriends(false)}
        onOpenProfile={(id) => { setShowFriends(false); onOpenProfile?.(id); }}
      />
      <Modal visible={!!viewing} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setViewing(null)}>
        {viewing && <PostViewer post={viewing} currentUserId={currentUserId} onClose={() => setViewing(null)} onOpenProfile={(id) => { if (id === userId) return; setViewing(null); onOpenProfile?.(id); }} />}
      </Modal>
    </View>
  );
}
