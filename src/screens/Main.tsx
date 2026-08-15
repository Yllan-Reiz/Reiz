import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, Image, Alert, ActivityIndicator, Animated, Easing, Pressable, RefreshControl, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { NAV_BOTTOM_MIN, navClearance } from '../constants';
import { supabase } from '../lib/supabase';
import { calculateStreak, frError } from '../lib/helpers';
import { signMany } from '../lib/storage';
import { Update, Objective, FeedMeta } from '../lib/types';
import { s, F } from '../styles';
import { FlameStreak } from '../components/FlameStreak';
import { FeedCard } from '../components/FeedCard';
import { NavTab } from '../components/NavTab';
import { GlassSurface, LIQUID_GLASS } from '../components/GlassSurface';
import { CreateObjectiveModal } from '../components/CreateObjectiveModal';
import { FeedSkeleton } from '../components/Skeleton';
import { FriendsTab } from './FriendsTab';
import { ProfileScreen } from './ProfileScreen';
import { FriendProfileScreen } from './FriendProfileScreen';

const PAGE_SIZE = 20;

// Puce d'étape de la carte d'activation : coché une fois l'étape faite, numérotée sinon.
function StepMarker({ done, step }: { done: boolean; step: number }) {
  if (done) {
    return (
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name="checkmark" size={15} color="#000" />
      </View>
    );
  }
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#444', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
      <Text style={{ color: '#888', fontSize: 12, fontFamily: F.bold }}>{step}</Text>
    </View>
  );
}

// Pastille de verre de l'onglet actif. Elle glisse d'un onglet à l'autre en
// s'étirant puis en reprenant sa forme : c'est ce qui donne l'impression de liquide.
function GlassBubble({ visible, pillWidth, anim, icon }: {
  visible: boolean;
  pillWidth: number;
  anim: Animated.Value;
  icon: any;
}) {
  if (!visible) return null;
  const slot = (pillWidth - 12) / 2;
  const bubbleSize = 48;
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [6 + slot / 2 - bubbleSize / 2, 6 + slot + slot / 2 - bubbleSize / 2],
  });
  // Mi-parcours : la pastille s'allonge un peu et s'aplatit — volume conservé.
  const scaleX = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.3, 1], extrapolate: 'clamp' });
  const scaleY = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.9, 1], extrapolate: 'clamp' });
  // Seul le verre se déforme : l'icône reste nette, sinon elle a l'air étirée.
  return (
    <Animated.View pointerEvents="none" style={[s.navActiveBubble, { transform: [{ translateX }] }]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ scaleX }, { scaleY }] }]}>
        {LIQUID_GLASS ? (
          <GlassSurface radius={24} variant="clear" tintColor="rgba(255,255,255,0.18)" style={StyleSheet.absoluteFillObject} />
        ) : (
          <View style={s.navActiveBubbleGlass} />
        )}
      </Animated.View>
      <Ionicons name={icon} size={22} color="#fff" />
    </Animated.View>
  );
}

// Bouton "+" : il s'enfonce et rebondit, comme les contrôles en verre d'iOS 26.
function PostButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, friction: 5, tension: 220 }).start();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { spring(0.88); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
      onPressOut={() => spring(1)}
    >
      <Animated.View style={[s.navPostStandalone, { transform: [{ scale }] }]}>
        <Ionicons name="add" size={30} color="#000" />
      </Animated.View>
    </Pressable>
  );
}

export function Main({ onPost, navIntent, onNavIntentHandled }: {
  onPost: () => void;
  navIntent?: string | null;
  onNavIntentHandled?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = navClearance(insets.bottom);
  const [tab, setTab] = useState('feed');
  const [userId, setUserId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [feedMeta, setFeedMeta] = useState<Record<string, FeedMeta>>({});
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingObj, setLoadingObj] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [streak, setStreak] = useState(0);
  const [viewingFriendId, setViewingFriendId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  // Nb d'amis acceptés — sert à savoir si le nouvel utilisateur a déjà lancé son cercle.
  // null = pas encore chargé (évite d'afficher la carte d'activation par erreur).
  const [friendCount, setFriendCount] = useState<number | null>(null);
  // Offset réel en base (avant filtrage des posts privés) pour une pagination exacte
  const dbOffset = useRef(0);

  const fetchPendingCount = async (uid?: string | null) => {
    const id = uid ?? userId;
    if (!id) return;
    const { count } = await supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('receiver_id', id).eq('status', 'pending');
    setPendingCount(count || 0);
  };

  const fetchFriendCount = async (uid?: string | null) => {
    const id = uid ?? userId;
    if (!id) return;
    const { count } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .or(`requester_id.eq.${id},receiver_id.eq.${id}`)
      .eq('status', 'accepted');
    setFriendCount(count || 0);
  };

  // Charge une page du feed + ses métadonnées (réactions, commentaires) en 3 requêtes
  // au total — au lieu d'une requête par carte (N+1).
  const loadFeedPage = async (offset: number, uid: string, silent = false) => {
    if (offset === 0 && !silent) setLoadingFeed(true);
    if (offset > 0) setLoadingMore(true);
    // Le feed = ton cercle : toi + tes amis acceptés.
    const { data: fr } = await supabase
      .from('friendships')
      .select('requester_id, receiver_id')
      .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`)
      .eq('status', 'accepted');
    const circleIds = [uid, ...(fr || []).map(f => (f.requester_id === uid ? f.receiver_id : f.requester_id))];
    const { data, error } = await supabase
      .from('updates')
      .select('id, caption, progress_value, created_at, photo_url, user_id, objectives(visibility), users(full_name, username, avatar_url)')
      .in('user_id', circleIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (!error && data) {
      setHasMore(data.length === PAGE_SIZE);
      dbOffset.current = offset + data.length;
      // Les posts liés à un objectif privé ne sont visibles que par leur auteur.
      const visible = (data as unknown as Update[]).filter(u => u.user_id === uid || u.objectives?.visibility !== 'private');

      // Le bucket est privé : on convertit les chemins stockés en URLs signées,
      // en une seule requête pour toute la page (photos de posts + avatars).
      const signed = await signMany([
        ...visible.map(u => u.photo_url),
        ...visible.map(u => u.users?.avatar_url),
      ]);
      visible.forEach(u => {
        if (u.photo_url) u.photo_url = signed[u.photo_url] ?? undefined;
        if (u.users?.avatar_url) u.users.avatar_url = signed[u.users.avatar_url] ?? undefined;
      });

      const ids = visible.map(u => u.id);
      const meta: Record<string, FeedMeta> = {};
      ids.forEach(id => { meta[id] = { reactions: {}, mine: [], commentCount: 0 }; });
      if (ids.length > 0) {
        const [rRes, cRes] = await Promise.all([
          supabase.from('reactions').select('update_id, type, user_id').in('update_id', ids),
          supabase.from('comments').select('update_id').in('update_id', ids),
        ]);
        (rRes.data || []).forEach((r: any) => {
          const m = meta[r.update_id]; if (!m) return;
          m.reactions[r.type] = (m.reactions[r.type] || 0) + 1;
          if (r.user_id === uid) m.mine.push(r.type);
        });
        (cRes.data || []).forEach((c: any) => { const m = meta[c.update_id]; if (m) m.commentCount++; });
      }
      if (offset === 0) { setUpdates(visible); setFeedMeta(meta); }
      else { setUpdates(prev => [...prev, ...visible]); setFeedMeta(prev => ({ ...prev, ...meta })); }
    }
    setLoadingFeed(false);
    setLoadingMore(false);
  };

  const fetchMore = () => {
    if (!userId || !hasMore || loadingMore || loadingFeed) return;
    loadFeedPage(dbOffset.current, userId);
  };

  const fetchObjectives = async (silent = false) => {
    if (!silent) setLoadingObj(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingObj(false); return; }
    const { data, error } = await supabase.from('objectives').select('id, emoji, title, current_value, target_value, unit, visibility').eq('user_id', user.id).order('created_at', { ascending: false });
    if (!error && data) setObjectives(data as Objective[]);
    setLoadingObj(false);
  };

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    calculateStreak(userId).then(setStreak);
    fetchPendingCount();
    fetchFriendCount();
    await Promise.all([loadFeedPage(0, userId, true), fetchObjectives(true)]);
    setRefreshing(false);
  };

  // Suppression d'objectif — supprime aussi les updates liées (au cas où la BDD n'a pas ON DELETE CASCADE)
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
            if (error) { Alert.alert('Erreur', frError(error)); return; }
            fetchObjectives(true);
            if (userId) loadFeedPage(0, userId, true);
          }
        }
      ]
    );
  };

  // === Animations des 2 pilules de la nav ===
  const leftPillAnim = useRef(new Animated.Value(0)).current;   // 0=feed, 1=objectives
  const rightPillAnim = useRef(new Animated.Value(0)).current;  // 0=friends, 1=profile
  const [leftPillWidth, setLeftPillWidth] = useState(0);
  const [rightPillWidth, setRightPillWidth] = useState(0);
  const isLeftActive = tab === 'feed' || tab === 'objectives';
  const isRightActive = tab === 'friends' || tab === 'profile';

  // Fondu-montée du contenu à chaque changement d'onglet : sans ça, l'écran
  // change d'un coup et la navigation paraît saccadée.
  const tabFade = useRef(new Animated.Value(1)).current;
  const firstRender = useRef(true);

  useEffect(() => {
    const target = tab === 'feed' || tab === 'friends' ? 0 : 1;
    const anim = isLeftActive ? leftPillAnim : isRightActive ? rightPillAnim : null;
    if (anim) {
      Animated.spring(anim, { toValue: target, useNativeDriver: true, friction: 7, tension: 70 }).start();
    }
    // Pas de vibration ni d'animation au tout premier rendu : l'utilisateur
    // n'a rien touché, il vient juste d'ouvrir l'app.
    if (firstRender.current) {
      firstRender.current = false;
    } else {
      Haptics.selectionAsync().catch(() => {});
      tabFade.setValue(0);
      Animated.timing(tabFade, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    fetchPendingCount();
    fetchFriendCount();
  }, [tab]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoadingFeed(false); setLoadingObj(false); return; }
      setUserId(user.id);
      loadFeedPage(0, user.id);
      calculateStreak(user.id).then(setStreak);
      fetchPendingCount(user.id);
      fetchFriendCount(user.id);
    });
    fetchObjectives();
  }, []);

  // Deep link des notifications : taper une notif ouvre le bon onglet
  useEffect(() => {
    if (!navIntent) return;
    setViewingFriendId(null);
    setTab(navIntent === 'friend_request' ? 'friends' : 'feed');
    onNavIntentHandled?.();
  }, [navIntent]);

  const progressPct = (obj: Objective) => obj.target_value > 0 ? Math.min(Math.round((obj.current_value / obj.target_value) * 100), 100) : 0;

  const hasObjective = objectives.length > 0;
  const hasFriend = (friendCount ?? 0) > 0;
  // !loadingObj évite que la carte clignote pendant le chargement chez un user existant.
  const needsActivation = !loadingObj && (!hasObjective || !hasFriend);

  const activationHeader = (
    <View style={{ backgroundColor: '#111', borderRadius: 20, padding: 18, marginBottom: 14 }}>
      <Text style={{ color: '#fff', fontSize: 17, fontFamily: F.bold, marginBottom: 2 }}>Bienvenue sur Reiz</Text>
      <Text style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Lance ton cercle en 2 étapes. Sans ça, ton feed reste vide.</Text>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setShowCreateModal(true)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#222' }}
      >
        <StepMarker done={hasObjective} step={1} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: hasObjective ? '#666' : '#fff', fontSize: 15, fontFamily: F.bold, textDecorationLine: hasObjective ? 'line-through' : 'none' }}>
            Crée ton premier objectif
          </Text>
          <Text style={{ color: '#777', fontSize: 12, marginTop: 1 }}>Ce que ton cercle va suivre chaque jour</Text>
        </View>
        {!hasObjective && <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setTab('friends')}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#222' }}
      >
        <StepMarker done={hasFriend} step={2} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: hasFriend ? '#666' : '#fff', fontSize: 15, fontFamily: F.bold, textDecorationLine: hasFriend ? 'line-through' : 'none' }}>
            {hasFriend ? `Ton cercle est lancé (${friendCount})` : 'Invite ton cercle (3 proches min.)'}
          </Text>
          <Text style={{ color: '#777', fontSize: 12, marginTop: 1 }}>Reiz ne marche que si tes proches te regardent</Text>
        </View>
        {!hasFriend && <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />}
      </TouchableOpacity>
    </View>
  );

  const postCTA = (
    <TouchableOpacity style={s.myUpdate} onPress={onPost} activeOpacity={0.85}>
      <View style={s.myUpdateInfo}>
        <Text style={s.myUpdateTitle}>Poste ta progression</Text>
        <Text style={s.myUpdateSub}>Ton cercle t'attend aujourd'hui</Text>
      </View>
      <View style={s.postedBadge}><Text style={s.postedBadgeText}>Publier →</Text></View>
    </TouchableOpacity>
  );

  if (viewingFriendId) return <FriendProfileScreen userId={viewingFriendId} onClose={() => setViewingFriendId(null)} />;

  return (
    <View style={s.container}>
      <CreateObjectiveModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchObjectives(true); }} />

      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Image source={require('../../assets/ecriture-reiz-blanc.png')} style={s.headerLogo} resizeMode="contain" />
        <FlameStreak streak={streak} />
      </View>

      <Animated.View
        style={{
          flex: 1,
          opacity: tabFade,
          transform: [{ translateY: tabFade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
      {tab === 'feed' && (
        <View style={{ flex: 1 }}>
          <FlatList
            style={s.feed}
            data={updates}
            keyExtractor={(u) => u.id}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" />}
            onEndReached={fetchMore}
            onEndReachedThreshold={0.6}
            // Cartes photo lourdes : on limite ce qui est monté et gardé vivant,
            // sinon le scroll accroche au bout de quelques dizaines de posts.
            initialNumToRender={4}
            maxToRenderPerBatch={5}
            windowSize={7}
            // Android seulement : sur iOS, le détachement des vues hors écran fait
            // parfois apparaître des cartes vides quand elles ont des calques absolus.
            removeClippedSubviews={Platform.OS === 'android'}
            ListHeaderComponent={needsActivation ? activationHeader : postCTA}
            ListEmptyComponent={
              loadingFeed ? (
                <FeedSkeleton />
              ) : (
                <View style={{ paddingTop: 40, alignItems: 'center' }}>
                  <Text style={{ color: '#888', fontSize: 14, fontFamily: F.bold }}>Aucune mise à jour pour l'instant</Text>
                  <Text style={{ color: '#777', marginTop: 4, fontSize: 12 }}>Sois le premier à publier.</Text>
                </View>
              )
            }
            ListFooterComponent={
              <View style={{ height: bottomPad, alignItems: 'center', paddingTop: 10 }}>
                {loadingMore ? <ActivityIndicator color="#fff" /> : null}
              </View>
            }
            renderItem={({ item }) => (
              <FeedCard
                u={item}
                meta={feedMeta[item.id]}
                currentUserId={userId}
                onDeleted={() => { setUpdates(prev => prev.filter(x => x.id !== item.id)); fetchObjectives(true); }}
                onBlocked={() => userId && loadFeedPage(0, userId, true)}
              />
            )}
          />
          <LinearGradient
            colors={['#0a0a0a', 'transparent']}
            style={s.feedTopFade}
            pointerEvents="none"
          />
        </View>
      )}

      {tab === 'objectives' && (
        loadingObj ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : objectives.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: bottomPad }}>
            <Text style={{ color: '#888', fontSize: 14, fontFamily: F.bold, marginBottom: 20 }}>Aucun objectif pour l'instant</Text>
            <TouchableOpacity style={s.emptyStateBtn} onPress={() => setShowCreateModal(true)}>
              <Text style={s.emptyStateBtnText}>+ Ajouter un objectif</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <ScrollView
          style={s.feed}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" />}
        >
          <View style={s.statsRow}>
            <View style={s.statPill}><Text style={s.statVal}>{objectives.length}</Text><Text style={s.statLbl}>Actifs</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>{streak}j</Text><Text style={s.statLbl}>Streak</Text></View>
            <View style={s.statPill}>
              <Text style={s.statVal}>{Math.round(objectives.reduce((acc, o) => acc + progressPct(o), 0) / objectives.length)}%</Text>
              <Text style={s.statLbl}>Moy.</Text>
            </View>
          </View>
          {objectives.map((o) => {
              const pct = progressPct(o);
              return (
                // Long press pour supprimer — Pressable évite les conflits de tap avec le bouton enfant
                <Pressable
                  key={o.id}
                  style={s.objCard}
                  onLongPress={() => handleDeleteObjective(o.id, o.title)}
                >
                  <View style={s.objCardTop}>
                    <Text style={s.objCardName} numberOfLines={1}>{o.emoji} {o.title}</Text>
                    <View style={[s.visBadge, o.visibility === 'public' && s.visBadgePublic]}>
                      <Text style={[s.visText, o.visibility === 'public' && s.visTextPublic]}>
                        {o.visibility === 'public' ? 'Public' : o.visibility === 'friends' ? 'Amis' : 'Privé'}
                      </Text>
                    </View>
                  </View>
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
          <Text style={{ color: '#666', fontSize: 11, textAlign: 'center', marginBottom: 8 }}>
            Appui long sur un objectif pour le supprimer
          </Text>
          <TouchableOpacity style={s.addObjBtn} onPress={() => setShowCreateModal(true)}>
            <Text style={s.addObjBtnText}>+ Ajouter un objectif</Text>
          </TouchableOpacity>
          <View style={{ height: bottomPad }} />
        </ScrollView>
        )
      )}

      {tab === 'friends' && <FriendsTab onViewProfile={(id) => setViewingFriendId(id)} onPendingCount={setPendingCount} />}

      {tab === 'profile' && (
        <ProfileScreen
          onClose={() => setTab('feed')}
          streak={streak}
          onCreateObjective={() => setTab('objectives')}
        />
      )}
      </Animated.View>

      <View style={[s.bottomNavSplit, { bottom: Math.max(insets.bottom, NAV_BOTTOM_MIN) }]}>
        {/* === Pilule gauche : Feed + Objectifs === */}
        <View style={s.navPill} onLayout={e => setLeftPillWidth(e.nativeEvent.layout.width)}>
          <GlassSurface radius={36} style={s.bottomNavGlass} pointerEvents="none" />
          <GlassBubble
            visible={isLeftActive && leftPillWidth > 0}
            pillWidth={leftPillWidth}
            anim={leftPillAnim}
            icon={tab === 'feed' ? 'home' : 'apps'}
          />
          <NavTab icon="home" active={tab === 'feed'} onPress={() => setTab('feed')} />
          <NavTab icon="apps" active={tab === 'objectives'} onPress={() => setTab('objectives')} />
        </View>

        {/* === Bouton + central, isolé === */}
        <PostButton onPress={onPost} />

        {/* === Pilule droite : Amis + Profil === */}
        <View style={s.navPill} onLayout={e => setRightPillWidth(e.nativeEvent.layout.width)}>
          <GlassSurface radius={36} style={s.bottomNavGlass} pointerEvents="none" />
          <GlassBubble
            visible={isRightActive && rightPillWidth > 0}
            pillWidth={rightPillWidth}
            anim={rightPillAnim}
            icon={tab === 'friends' ? 'person-add' : 'person'}
          />
          <NavTab icon="person-add" active={tab === 'friends'} onPress={() => setTab('friends')} badge={pendingCount} />
          <NavTab icon="person" active={tab === 'profile'} onPress={() => setTab('profile')} />
        </View>
      </View>
    </View>
  );
}
