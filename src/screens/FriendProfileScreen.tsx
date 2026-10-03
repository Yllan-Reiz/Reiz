import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { calculateStreak, timeAgo, frError, inUnit } from '../lib/helpers';
import { signOne } from '../lib/storage';
import { GUTTER, HEATMAP_MAX_DAYS } from '../constants';
import { Update, Objective, FeedMeta } from '../lib/types';
import { ProfileHeroPhoto, GlassIconButton, StatBubble, AboutBubble, BadgesSection, GoalCards, HistoryCarousel, AchievedList, SectionHeader, DuoBubble, computeBadges, isCompleted } from '../components/ProfileSections';
import { PostViewer } from '../components/PostViewer';
import { ProfileTags } from '../components/ProfileTags';
import { PeopleListModal } from '../components/PeopleListModal';
import { loadProfilePosts, loadPost } from '../lib/posts';
import { loadDuoStats, DuoStats } from '../lib/duo';
import { s, F } from '../styles';

export function FriendProfileScreen({ userId, onClose, onOpenProfile, onDuo }: { userId: string; onClose: () => void; onOpenProfile?: (id: string) => void; onDuo?: (friendId: string) => void }) {
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
  const [duo, setDuo] = useState<DuoStats | null>(null);
  const [activityByObj, setActivityByObj] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      let isFriend = false;
      if (user) {
        setCurrentUserId(user.id);
        const { data: rel } = await supabase
          .from('friendships')
          .select('id, status, requester_id')
          .or(`and(requester_id.eq.${user.id},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${user.id})`)
          .maybeSingle();
        if (!rel) setRelation({ kind: 'none' });
        else if (rel.status === 'accepted') { setRelation({ kind: 'friends', id: rel.id }); }
        else setRelation({ kind: rel.requester_id === user.id ? 'sent' : 'received', id: rel.id });
      }
      const [profileRes, objRes, updatesRes, friendsRes] = await Promise.all([
        supabase.from('users').select('full_name, username, created_at, avatar_url, bio').eq('id', userId).single(),
        supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility, duration_days, is_completed').eq('user_id', userId).neq('visibility', 'private').order('created_at', { ascending: false }),
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
      // Binôme d'entraînement : duos validés avec cet ami (réservé aux amis).
      if (isFriend && user) loadDuoStats(user.id, userId).then(setDuo).catch(() => setDuo(null)); else setDuo(null);
      const streakVal = await calculateStreak(userId);
      setStreak(streakVal);
      // Jours postés par objectif (les 7 pastilles de chaque carte). Même règle d'accès
      // que le reste : la base ne renvoie que ce que tu as le droit de voir.
      const sinceISO = new Date(Date.now() - HEATMAP_MAX_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: act } = await supabase.from('updates').select('objective_id, created_at').eq('user_id', userId).gte('created_at', sinceISO);
      const map: Record<string, Set<string>> = {};
      ((act || []) as { objective_id: string; created_at: string }[]).forEach(u => {
        if (!u.objective_id) return;
        (map[u.objective_id] ||= new Set<string>()).add(new Date(u.created_at).toDateString());
      });
      setActivityByObj(map);
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

  const { height: winH } = useWindowDimensions();
  const heroH = Math.round(Math.min(winH * 0.72, 620));
  const ongoing = objectives.filter(o => !isCompleted(o));
  const achieved = objectives.filter(isCompleted);
  const badges = computeBadges(recentUpdates, objectives);
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';
  const firstName = profile?.full_name?.split(' ')[0] || 'Cette personne';
  const topBtn = insets.top + 12;

  return (
    <View style={s.container}>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* === Même page que ton profil : photo plein écran, nom, bulle de verre à 3 zones === */}
          <ProfileHeroPhoto avatarUrl={avatarUrl} height={heroH}>
            <GlassIconButton icon="chevron-back" label="Retour" onPress={onClose} style={{ position: 'absolute', top: topBtn, left: GUTTER }} />
            <GlassIconButton icon="ellipsis-horizontal" label="Options" onPress={openMenu} style={{ position: 'absolute', top: topBtn, right: GUTTER }} />

            <Text style={{ fontSize: 40, fontFamily: F.black, color: '#fff', textAlign: 'center', letterSpacing: -1.5, paddingHorizontal: GUTTER }} numberOfLines={2}>{profile?.full_name || 'Utilisateur'}</Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', fontFamily: F.semibold, marginTop: 4 }}>@{profile?.username}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: F.regular, marginTop: 2 }}>Membre depuis {memberSince}</Text>

            {relation.kind !== 'friends' && (
              <TouchableOpacity
                disabled={relBusy || relation.kind === 'sent'}
                onPress={relation.kind === 'received' ? acceptFriend : addFriend}
                style={{ marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: relation.kind === 'sent' ? 'rgba(255,255,255,0.14)' : '#fff' }}
              >
                {relBusy
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={{ color: relation.kind === 'sent' ? '#ccc' : '#000', fontSize: 14, fontFamily: F.bold }}>
                      {relation.kind === 'sent' ? 'Demande envoyée' : relation.kind === 'received' ? 'Accepter sa demande' : 'Ajouter à mon cercle'}
                    </Text>}
              </TouchableOpacity>
            )}

            <StatBubble items={[
              { value: `${streak}j`, label: 'Streak' },
              { value: String(recentUpdates.length), label: 'Posts' },
              // La liste des amis n'est montrée qu'aux amis (règle du serveur, friends_of).
              { value: String(friendCount), label: friendCount > 1 ? 'Amis' : 'Ami', onPress: relation.kind === 'friends' ? () => setShowFriends(true) : undefined },
            ]} />
          </ProfileHeroPhoto>

          {relation.kind !== 'friends' && (
            <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', marginTop: 14, paddingHorizontal: 28 }}>
              Ses progrès sont réservés à son cercle. Ajoute {firstName} pour les suivre.
            </Text>
          )}

          {/* === À propos : bio + tags (tu peux valider ses tags d'un tap) === */}
          <AboutBubble>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5, marginBottom: 6 }}>À PROPOS</Text>
            <Text style={{ fontSize: 15, color: profile?.bio ? '#fff' : 'rgba(255,255,255,0.45)', lineHeight: 22, fontFamily: F.regular, textAlign: 'center' }}>
              {profile?.bio || `${firstName} n'a pas encore écrit de bio.`}
            </Text>
            <View style={{ alignSelf: 'stretch' }}><ProfileTags userId={userId} currentUserId={currentUserId} own={false} /></View>
          </AboutBubble>

          {relation.kind === 'friends' && onDuo && <DuoBubble name={firstName} stats={duo} onInvite={() => onDuo(userId)} />}

          <BadgesSection badges={badges} own={false} />

          <View style={{ marginTop: 14 }}>
            {ongoing.length === 0 && achieved.length === 0 ? (
              <Text style={{ color: '#888', fontSize: 13, paddingHorizontal: GUTTER }}>Pas d'objectif visible pour le moment.</Text>
            ) : (
              <>
                {ongoing.length > 0 && <SectionHeader title="En cours" count={ongoing.length} style={{ paddingHorizontal: GUTTER }} />}
                <GoalCards items={ongoing} activity={activityByObj} />
                <AchievedList items={achieved} />
              </>
            )}
          </View>

          <SectionHeader title="Historique" count={recentUpdates.length} style={{ paddingHorizontal: GUTTER, marginTop: 6 }} />
          <HistoryCarousel posts={recentUpdates} onOpen={openPost} emptyText="Pas encore de publication visible." />

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
