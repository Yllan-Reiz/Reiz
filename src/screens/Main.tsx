import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, Image, Alert, ActivityIndicator, Animated, Easing, Pressable, RefreshControl, StyleSheet, Platform, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase, currentUser, storedUserId } from '../lib/supabase';
import { calculateStreak, frError, inUnit } from '../lib/helpers';
import { signMany, signAvatars, signOne } from '../lib/storage';
import { cacheGet, cacheSet } from '../lib/cache';
import { mark } from '../lib/perf';
import { setAppBadge } from '../lib/badge';
import { selectObjectives } from '../lib/objectives';
import { NAV_BOTTOM_MIN, navClearance, hasSchedule, daysLabel, GLASS_OBJECTIVES, GLASS_FRIENDS } from '../constants';
import { Update, Objective, FeedMeta } from '../lib/types';
import { s, F } from '../styles';
import { FlameStreak } from '../components/FlameStreak';
import { FeedCardInFeed } from '../components/FeedCard';
import { NavTab } from '../components/NavTab';
import { GlassSurface, LIQUID_GLASS } from '../components/GlassSurface';
import { CreateObjectiveModal } from '../components/CreateObjectiveModal';
import { ObjectiveDoneModal, DoneObjective } from '../components/ObjectiveDoneModal';
import { JourneyModal } from '../components/JourneyModal';
import { isRhythm, deadlinePassed, addWeeks, localDay, rhythmTarget, deadlineLabel } from '../lib/goal';
import { SetupCard } from '../components/SetupCard';
import { PendingRequestsCard } from '../components/PendingRequestsCard';
import { CircleTodayCard } from '../components/CircleTodayCard';
import { DuelBanner } from '../components/DuelCard';
import { loadDuels, proposeDuel } from '../lib/duel';
import { track } from '../lib/track';
import { FeedSkeleton } from '../components/Skeleton';
import { FriendsTab } from './FriendsTab';
import { ProfileScreen } from './ProfileScreen';
import { FriendProfileScreen } from './FriendProfileScreen';
import { ActivityScreen } from './ActivityScreen';
import { attachDuoNames, attachReactors } from '../lib/posts';
import { validatedDuoIds, answeredDuoIds } from '../lib/duo';
import { ObjectiveEditSheet } from '../components/ObjectiveEditSheet';
import { ObjectivesTab } from '../components/ObjectivesTab';
import { useCloseCircle } from '../lib/closeCircle';
import { t, unitLabel, dirIcon, isRTL } from '../i18n';

const PAGE_SIZE = 20;
const FEED_WINDOW_HOURS = 24;

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
  // En hébreu la pastille part du bord droit (left devient right) : on la décale vers la gauche.
  const dir = isRTL() ? -1 : 1;
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [dir * (6 + slot / 2 - bubbleSize / 2), dir * (6 + slot + slot / 2 - bubbleSize / 2)],
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
  // duoWith : ouvre la publication avec cet ami déjà identifié (réponse à un duo).
  onPost: (opts?: { duoWith?: string; from?: string }) => void;
  navIntent?: string | null;
  onNavIntentHandled?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = navClearance(insets.bottom);
  const [tab, setTab] = useState('feed');
  const [userId, setUserId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  // Duos auxquels j'ai déjà répondu : un de mes posts identifie l'auteur, à moins d'1 h du sien.
  const duoDone = useMemo(() => (userId ? answeredDuoIds(updates, userId) : new Set<string>()), [updates, userId]);
  // Séances dont le duo est validé : les deux posts du binôme sont dans le fil, à moins d'1 h d'écart.
  const duoPairs = useMemo(() => validatedDuoIds(updates), [updates]);
  // Amis de ton cercle proche : une étoile à côté de leur prénom dans le fil.
  const { list: closeList } = useCloseCircle();
  const closeIds = useMemo(() => new Set((closeList || []).map(c => c.id)), [closeList]);
  const [feedMeta, setFeedMeta] = useState<Record<string, FeedMeta>>({});
  const [objectives, setObjectives] = useState<Objective[]>([]);
  // Pour l'onglet objectifs « verre » : ta photo en fond, et les jours postés de chaque objectif cette semaine.
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [activityByObj, setActivityByObj] = useState<Record<string, Set<string>>>({});
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingObj, setLoadingObj] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Objectif en cours de modification (visibilité, jours d'entraînement, suppression).
  const [editing, setEditing] = useState<Objective | null>(null);
  const [streak, setStreak] = useState(0);
  // Pile de profils ouverts : depuis le profil d'un ami, on peut ouvrir celui
  // d'un de ses amis, et « retour » revient au précédent.
  const [profileStack, setProfileStack] = useState<string[]>([]);
  const viewingFriendId = profileStack.length ? profileStack[profileStack.length - 1] : null;
  const openProfile = (id: string) => {
    if (id === userId) { setProfileStack([]); setShowActivity(false); setTab('profile'); return; }
    setProfileStack(st => [...st, id]);
  };
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  // Fil d'activité (cœur en haut à droite) et nombre d'éléments non lus.
  const [showActivity, setShowActivity] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Nb d'amis acceptés — sert à savoir si le nouvel utilisateur a déjà lancé son cercle.
  // null = pas encore chargé (évite d'afficher la carte d'activation par erreur).
  const [friendCount, setFriendCount] = useState<number | null>(null);
  // Chantier 6 : amis avec qui un défi est déjà ouvert (le bouton « Lancer un défi » des posts en duo les évite).
  const [duelBusyIds, setDuelBusyIds] = useState<Set<string> | undefined>(undefined);
  const [duelKey, setDuelKey] = useState(0);
  useEffect(() => {
    loadDuels().then(list => {
      if (list) setDuelBusyIds(new Set(list.filter(d => d.status === 'active' || d.status === 'pending').map(d => d.otherId)));
    }).catch(() => {});
  }, [duelKey]);
  const challengeFromFeed = (id: string, name: string) => {
    const who = name.split(' ')[0];
    Alert.alert(t('duelCard.confirmTitle', { name: who }), t('friendProfile.duelConfirm', { name: who }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('duelCard.challenge'), onPress: async () => {
        const err = await proposeDuel(id);
        if (err) { Alert.alert(t('duelCard.duel'), err); return; }
        track('duel_propose', { from: 'feed' }, 'feed');
        setDuelKey(k => k + 1);
      } },
    ]);
  };
  // Offset réel en base (avant filtrage des posts privés) pour une pagination exacte
  const dbOffset = useRef(0);
  // Cartes dont un bout au moins est à l'écran : leurs vidéos jouent. Avant le 31/10/2026, seule la carte la plus
  // visible jouait (60 % au moins) : dès qu'on faisait défiler, la vidéo s'arrêtait et laissait un cadre gris.
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  // Toucher « Accueil » quand on est déjà sur le fil remonte tout en haut (comme Instagram).
  const feedRef = useRef<FlatList<Update>>(null);
  const viewabilityConfigCallbackPairs = useRef([{
    viewabilityConfig: { itemVisiblePercentThreshold: 1, minimumViewTime: 0 },
    onViewableItemsChanged: ({ viewableItems }: { viewableItems: { item: Update; isViewable: boolean }[] }) => {
      setVisibleIds(new Set(viewableItems.filter(v => v.isViewable).map(v => v.item.id)));
    },
  }]).current;

  const fetchPendingCount = async (uid?: string | null) => {
    const id = uid ?? userId;
    if (!id) return;
    const { count, error } = await supabase.from('friendships').select('id', { count: 'exact', head: true }).eq('receiver_id', id).eq('status', 'pending');
    if (error) return;
    setPendingCount(count || 0);
    countsRef.current = { ...countsRef.current, pending: count || 0 };
    cacheSet(`counts.${id}`, countsRef.current);
  };

  const fetchUnread = async (uid?: string | null) => {
    const id = uid ?? userId;
    if (!id) return;
    const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', id).is('read_at', null);
    if (error) return;
    setUnreadCount(count || 0);
    setAppBadge(count || 0);
    countsRef.current = { ...countsRef.current, unread: count || 0 };
    cacheSet(`counts.${id}`, countsRef.current);
  };

  // Le nombre d'amis vient de la liste du cercle (même requête que le fil) : une requête de moins.
  const fetchFriendCount = async (uid?: string | null) => {
    const id = uid ?? userId;
    if (!id) return;
    await fetchCircle(id);
  };

  // Derniers compteurs connus (demandes, non lus, amis), gardés pour l'ouverture suivante.
  const countsRef = useRef<{ pending?: number; unread?: number; friends?: number }>({});

  // Le fil est déjà à l'écran (mémoire locale ou chargement précédent) : on ne remet pas le squelette.
  const painted = useRef(false);
  // Ton cercle (toi + tes amis), gardé d'un lancement à l'autre : le fil démarre sans l'attendre.
  const circleRef = useRef<string[] | null>(null);

  const fetchCircle = async (uid: string): Promise<string[]> => {
    const { data: fr } = await supabase
      .from('friendships')
      .select('requester_id, receiver_id')
      .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`)
      .eq('status', 'accepted');
    // Personnes distinctes : une amitié en double ne compte qu'une fois.
    const ids = [uid, ...new Set((fr || []).map(f => (f.requester_id === uid ? f.receiver_id : f.requester_id)))];
    cacheSet(`circle.${uid}`, ids);
    if (fr) { setFriendCount(ids.length - 1); cacheSet(`counts.${uid}`, { ...countsRef.current, friends: ids.length - 1 }); }
    return ids;
  };

  const emptyMeta = (): FeedMeta => ({ reactions: {}, mine: [], commentCount: 0 });

  // Charge une page du fil. L'ordre compte pour la vitesse : les posts et leurs photos s'affichent
  // d'abord ; réactions, commentaires et duos arrivent ensuite sans bloquer l'écran.
  const loadFeedPage = async (offset: number, uid: string, silent = false) => {
    if (offset === 0 && !silent && !painted.current) setLoadingFeed(true);
    if (offset > 0) setLoadingMore(true);

    // 1. Le cercle : la liste mémorisée tout de suite, vérifiée en parallèle.
    let circleIds = circleRef.current ?? await cacheGet<string[]>(`circle.${uid}`, 7 * 24 * 3600 * 1000);
    const fresh = offset === 0 ? fetchCircle(uid) : null;
    if (!circleIds && fresh) circleIds = await fresh;
    else if (fresh) {
      const known = circleIds;
      fresh.then(ids => {
        // Un ami a été ajouté ou retiré depuis : on relance une fois avec la bonne liste.
        if (known && [...ids].sort().join() !== [...known].sort().join()) { circleRef.current = ids; loadFeedPage(0, uid, true); }
      });
    }
    if (!circleIds) circleIds = [uid];
    circleRef.current = circleIds;

    // Le fil repart de zéro toutes les 24 h (fenêtre glissante) : on ne voit que
    // ce que le cercle a fait depuis hier à la même heure. L'historique complet
    // reste dans les profils.
    const since = new Date(Date.now() - FEED_WINDOW_HOURS * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('updates')
      .select('id, caption, progress_value, created_at, photo_url, user_id, pinned_at, with_user_ids, objective_id, moment, moment_late_min, objectives(visibility, unit, target_value, title, emoji, completed_at, per_week, deadline, starts_at), users(full_name, username, avatar_url)')
      .in('user_id', circleIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) { setLoadingFeed(false); setLoadingMore(false); return; }

    setHasMore(data.length === PAGE_SIZE);
    dbOffset.current = offset + data.length;
    // Les posts liés à un objectif privé ne sont visibles que par leur auteur.
    const visible = (data as unknown as Update[]).filter(u => u.user_id === uid || u.objectives?.visibility !== 'private');

    // 2. Le bucket est privé : chemins -> URLs signées. Presque toujours déjà en mémoire (voir storage.ts).
    const [signed, avatars] = await Promise.all([
      // La photo stockée, déjà allégée à l'envoi (1440 px, voir compressImage) : une seule requête pour toute la page,
      // la meilleure qualité, et pas de quota Supabase. Avant le 30/10/2026 : une requête par photo pour une version 1080 px.
      signMany(visible.map(u => u.photo_url)),
      signAvatars(visible.map(u => u.users?.avatar_url)),
    ]);
    visible.forEach(u => {
      if (u.photo_url) u.photo_url = signed[u.photo_url] ?? undefined;
      if (u.users?.avatar_url) u.users.avatar_url = avatars[u.users.avatar_url] ?? undefined;
    });

    // 3. Premier affichage, sans attendre le reste. On garde les compteurs déjà connus (fil mémorisé).
    if (offset === 0) {
      setUpdates(visible);
      setFeedMeta(prev => Object.fromEntries(visible.map(u => [u.id, prev[u.id] ?? emptyMeta()])));
    } else {
      setUpdates(prev => [...prev, ...visible]);
      setFeedMeta(prev => ({ ...Object.fromEntries(visible.map(u => [u.id, emptyMeta()])), ...prev }));
    }
    painted.current = true;
    if (offset === 0) mark('fil:reseau');
    setLoadingFeed(false);
    setLoadingMore(false);

    // 4. La suite : réactions, commentaires, noms des duos, visages des réactions.
    const ids = visible.map(u => u.id);
    if (ids.length === 0) { if (offset === 0) cacheSet(`feed.${uid}`, { updates: [], meta: {} }); return; }
    const [rRes, cRes] = await Promise.all([
      supabase.from('reactions').select('update_id, type, user_id, created_at').in('update_id', ids),
      supabase.from('comments').select('update_id').in('update_id', ids),
      attachDuoNames(visible),
    ]);
    const meta: Record<string, FeedMeta> = {};
    ids.forEach(id => { meta[id] = emptyMeta(); });
    (rRes.data || []).forEach((r: any) => {
      const m = meta[r.update_id]; if (!m) return;
      m.reactions[r.type] = (m.reactions[r.type] || 0) + 1;
      if (r.user_id === uid) m.mine.push(r.type);
    });
    (cRes.data || []).forEach((c: any) => { const m = meta[c.update_id]; if (m) m.commentCount++; });
    await attachReactors(rRes.data || [], meta);
    const enriched = new Map(visible.map(u => [u.id, { ...u }]));
    setUpdates(cur => cur.map(u => enriched.get(u.id) ?? u));
    setFeedMeta(prev => ({ ...prev, ...meta }));
    if (offset === 0) cacheSet(`feed.${uid}`, { updates: visible, meta });
  };

  const fetchMore = () => {
    if (!userId || !hasMore || loadingMore || loadingFeed) return;
    loadFeedPage(dbOffset.current, userId);
  };

  // Objectifs déjà affichés (mémoire locale) : pas de roue de chargement, juste une mise à jour discrète.
  const objectivesPainted = useRef(false);

  const fetchObjectives = async (silent = false) => {
    if (!silent && objectivesPainted.current === false) setLoadingObj(true);
    const user = await currentUser();
    if (!user) { setLoadingObj(false); return; }
    const { data, error } = await selectObjectives('id, emoji, title, current_value, target_value, unit, visibility, is_completed, completed_at', cols => supabase.from('objectives').select(cols).eq('user_id', user.id).order('created_at', { ascending: false }));
    if (!error && data) { setObjectives((data as Objective[]).map(inUnit)); mark('objectifs:reseau'); closeEndedRhythms(data as Objective[]); }
    setLoadingObj(false);
    objectivesPainted.current = true;
    // Jours postés par objectif (les pastilles de la semaine). Deux semaines de recul suffisent.
    const sinceWeek = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const { data: act } = await supabase.from('updates').select('objective_id, created_at').eq('user_id', user.id).gte('created_at', sinceWeek);
    const map: Record<string, Set<string>> = {};
    ((act || []) as { objective_id: string; created_at: string }[]).forEach(u => {
      if (u.objective_id) (map[u.objective_id] ||= new Set<string>()).add(new Date(u.created_at).toDateString());
    });
    setActivityByObj(map);
    if (!error && data) cacheSet(`objectives.${user.id}`, { objectives: data, activity: Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v]])) });
  };

  // Rythme arrivé à échéance (phase 31) : clos en base, et le bilan s'ouvre une fois (« 41 séances sur 48, 85 % »).
  const [bilan, setBilan] = useState<(DoneObjective & { per_week: number; starts_at: string | null; deadline: string }) | null>(null);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const bilanShown = useRef(new Set<string>());
  const closeEndedRhythms = async (list: Objective[]) => {
    const ended = list.find(o => isRhythm(o) && !o.is_completed && deadlinePassed(o) && !bilanShown.current.has(o.id));
    if (!ended) return;
    bilanShown.current.add(ended.id);
    const { error } = await supabase.from('objectives').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', ended.id);
    if (error) return;
    setObjectives(prev => prev.map(o => (o.id === ended.id ? { ...o, is_completed: true } : o)));
    setBilan({ id: ended.id, emoji: ended.emoji, title: ended.title, unit: ended.unit, target_value: ended.target_value, per_week: ended.per_week!, starts_at: ended.starts_at ?? null, deadline: ended.deadline!,
      summary: { done: ended.current_value || 0, total: ended.target_value } });
  };
  const extendBilan = async () => {
    if (!bilan) return;
    const deadline = addWeeks(localDay(), 4);
    const target = rhythmTarget(bilan.per_week, bilan.starts_at || localDay(), deadline);
    const { error } = await supabase.from('objectives').update({ deadline, target_value: target, is_completed: false, completed_at: null }).eq('id', bilan.id);
    if (error) { Alert.alert(t('common.error'), frError(error)); return; }
    setBilan(null);
    Alert.alert(bilan.title, t('goal.extended', { date: deadlineLabel(deadline) }));
    fetchObjectives(true);
  };

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    calculateStreak(userId).then(setStreak);
    fetchPendingCount();
    fetchFriendCount();
    fetchUnread();
    await Promise.all([loadFeedPage(0, userId, true), fetchObjectives(true)]);
    setRefreshing(false);
  };

  // Suppression d'objectif — supprime aussi les updates liées (au cas où la BDD n'a pas ON DELETE CASCADE)
  const handleDeleteObjective = (id: string, title: string) => {
    Alert.alert(
      t('main.deleteObjTitle'),
      t('main.deleteObjText', { title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await supabase.from('updates').delete().eq('objective_id', id);
            const { error } = await supabase.from('objectives').delete().eq('id', id);
            if (error) { Alert.alert(t('common.error'), frError(error)); return; }
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
  const lastCounts = useRef(0);
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
    // Les trois compteurs (demandes, amis, non lus) ne sont relus que s'ils ont plus de 15 s :
    // changer d'onglet plusieurs fois de suite ne relance plus trois requêtes à chaque fois.
    if (Date.now() - lastCounts.current > 15000) {
      lastCounts.current = Date.now();
      fetchPendingCount();
      fetchFriendCount();
      fetchUnread();
    }
  }, [tab]);

  // Retour dans l'app (après une notif, par exemple) : on remet la pastille à jour.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') fetchUnread(); });
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    (async () => {
      // Compte enregistré sur le téléphone : lu sans réseau, même si le jeton a expiré. La mémoire locale de ce
      // compte s'affiche tout de suite ; les requêtes au serveur attendent d'elles-mêmes le jeton renouvelé.
      const uid = (await storedUserId()) ?? (await currentUser())?.id;
      if (!uid) { setLoadingFeed(false); setLoadingObj(false); return; }
      setUserId(uid);
      const [cached, cachedObj, cachedStreak, cachedCounts] = await Promise.all([
        cacheGet<{ updates: Update[]; meta: Record<string, FeedMeta> }>(`feed.${uid}`, 12 * 3600 * 1000),
        cacheGet<{ objectives: Objective[]; activity: Record<string, string[]> }>(`objectives.${uid}`, 7 * 24 * 3600 * 1000),
        cacheGet<number>(`streak.${uid}`, 24 * 3600 * 1000),
        cacheGet<{ pending?: number; unread?: number; friends?: number }>(`counts.${uid}`, 7 * 24 * 3600 * 1000),
      ]);
      // Dernier fil connu : affiché tout de suite, avant même la réponse du serveur.
      if (cached && cached.updates.length > 0) {
        mark('fil:memoire');
        setUpdates(cached.updates);
        setFeedMeta(cached.meta || {});
        painted.current = true;
        setLoadingFeed(false);
      }
      if (cachedObj && !objectivesPainted.current) {
        setObjectives(cachedObj.objectives.map(inUnit));
        setActivityByObj(Object.fromEntries(Object.entries(cachedObj.activity || {}).map(([k, v]) => [k, new Set(v)])));
        objectivesPainted.current = true;
        setLoadingObj(false);
      }
      if (cachedStreak != null) setStreak(cachedStreak);
      if (cachedCounts) {
        countsRef.current = cachedCounts;
        if (cachedCounts.pending != null) setPendingCount(cachedCounts.pending);
        if (cachedCounts.unread != null) setUnreadCount(cachedCounts.unread);
        if (cachedCounts.friends != null) setFriendCount(cachedCounts.friends);
      }
      lastCounts.current = Date.now();
      // Ta photo : celle d'origine (déjà allégée à l'envoi), sans attendre une version réduite par le serveur.
      supabase.from('users').select('avatar_url').eq('id', uid).single().then(async ({ data: me }) => {
        if (me?.avatar_url) setMyAvatar(await signOne(me.avatar_url));
      });
      loadFeedPage(0, uid); // remplit aussi le nombre d'amis (liste du cercle)
      calculateStreak(uid).then(n => { setStreak(n); cacheSet(`streak.${uid}`, n); });
      fetchPendingCount(uid);
      fetchUnread(uid);
      fetchObjectives();
    })();
  }, []);

  // Deep link des notifications : taper une notif ouvre le bon onglet
  useEffect(() => {
    if (!navIntent) return;
    setProfileStack([]);
    // Les nouveaux push envoient « activity » : on ouvre directement le fil d'activité.
    setShowActivity(navIntent === 'activity');
    // Objectif atteint puis « Nouvel objectif » : l'onglet des objectifs, création ouverte.
    if (navIntent === 'new_objective') { setTab('objectives'); setShowCreateModal(true); onNavIntentHandled?.(); return; }
    setTab(navIntent === 'friend_request' ? 'friends' : 'feed');
    onNavIntentHandled?.();
  }, [navIntent]);

  const progressPct = (obj: Objective) => obj.target_value > 0 ? Math.min(Math.round((obj.current_value / obj.target_value) * 100), 100) : 0;

  // L'en-tête du fil (demandes, cercle du jour, défis, mise en route) ne se redessine que si ce qu'il montre change :
  // chaque arrêt du défilement redessine Main (carte active), il ne faut pas que ces quatre cartes suivent.
  const feedHeader = useMemo(() => (
              <>
              {/* 1.2 : les demandes d'ami reçues passent avant le reste, une réponse suffit à avoir un cercle. */}
              <PendingRequestsCard userId={userId} from="feed" onChanged={() => { fetchPendingCount(); fetchFriendCount(); }} onSeeAll={() => setTab('friends')} />
              {/* Moment Reiz (phase 29) : qui de ton cercle a posté aujourd'hui. */}
              <CircleTodayCard onOpenProfile={openProfile} />
              {/* Défis en cours et invitations reçues : de retour dans le fil (ils restent aussi dans l'Activité). */}
              <DuelBanner onOpenProfile={openProfile} reloadKey={duelKey} />
              <SetupCard
                userId={userId}
                hasObjective={loadingObj ? null : objectives.length > 0}
                friendCount={friendCount}
                onPost={() => onPost({ from: 'setup_card' })}
                onAddPhoto={() => setTab('profile')}
                onAddObjective={() => setShowCreateModal(true)}
                onFindFriends={() => setTab('friends')}
              />
              </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [userId, duelKey, loadingObj, objectives.length, friendCount, onPost]);

  if (viewingFriendId) return <FriendProfileScreen key={viewingFriendId} userId={viewingFriendId} onClose={() => setProfileStack(st => st.slice(0, -1))} onOpenProfile={openProfile} onDuo={(id) => onPost({ duoWith: id })} />;
  // L'activité s'ouvre PAR-DESSUS la page où tu es (le fil, les objectifs, les amis...) : le verre floute cette
  // page au lieu de la remplacer par un fond à part. Elle reste montée dessous, tu la retrouves intacte en fermant.
  const activityLayer = showActivity ? (
    <ActivityScreen
      overlay
      currentUserId={userId}
      backdropUrl={myAvatar}
      onClose={() => { setShowActivity(false); setUnreadCount(0); setAppBadge(0); }}
      onViewProfile={openProfile}
      onOpenFriends={() => { setShowActivity(false); setUnreadCount(0); setTab('friends'); }}
      onDuoReply={(authorId) => onPost({ duoWith: authorId })}
    />
  ) : null;

  return (
    <View style={s.container}>
      {/* Fond noir uni sur tous les onglets (demande de Yllan, 22/10/2026) : plus de photo floutée derrière, le verre
          reste sur les cartes. Seule l'Activité garde le flou, celui de la page en dessous. */}
      <ObjectiveEditSheet
        objective={editing}
        onClose={() => setEditing(null)}
        onChanged={patch => editing && setObjectives(prev => prev.map(x => (x.id === editing.id ? { ...x, ...patch } : x)))}
        onDelete={o => handleDeleteObjective(o.id, o.title)}
      />
      <CreateObjectiveModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchObjectives(true); }} />
      <ObjectiveDoneModal
        objective={bilan}
        onExtend={extendBilan}
        onJourney={() => { const id = bilan?.id ?? null; setBilan(null); setJourneyId(id); }}
        onNewObjective={() => { setBilan(null); setShowCreateModal(true); }}
        onClose={() => setBilan(null)}
      />
      <JourneyModal objectiveId={journeyId} own from="bilan" onClose={() => setJourneyId(null)} />

      <View style={[s.header, { paddingTop: insets.top + 6 }, tab === 'profile' && { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }]}>
        {/* Sur le profil, l'en-tête flotte par-dessus la photo : un fondu noir derrière
            évite que le logo se superpose au contenu quand on fait défiler. */}
        {tab === 'profile' && (
          <LinearGradient pointerEvents="none" colors={['#0a0a0a', '#0a0a0a', 'rgba(10,10,10,0)']} locations={[0, 0.62, 1]} style={[StyleSheet.absoluteFill, { bottom: -14 }]} />
        )}
        <Image source={require('../../assets/ecriture-reiz-blanc.png')} style={s.headerLogo} resizeMode="contain" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => setShowActivity(true)}
            style={s.headerIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={unreadCount > 0 ? t('main.activityUnread', { n: unreadCount }) : t('main.activity')}
          >
            <Ionicons name={unreadCount > 0 ? 'heart' : 'heart-outline'} size={22} color="#fff" />
            {unreadCount > 0 && (
              <View style={s.headerBadge}><Text style={s.navBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
            )}
          </TouchableOpacity>
          <FlameStreak streak={streak} />
        </View>
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
            ref={feedRef}
            style={s.feed}
            contentContainerStyle={s.feedContent}
            data={updates}
            extraData={closeIds}
            keyExtractor={(u) => u.id}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" />}
            onEndReached={fetchMore}
            viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
            onEndReachedThreshold={0.6}
            // Cartes photo lourdes : on limite ce qui est monté et gardé vivant,
            // sinon le scroll accroche au bout de quelques dizaines de posts.
            initialNumToRender={4}
            maxToRenderPerBatch={5}
            windowSize={7}
            // Android seulement : sur iOS, le détachement des vues hors écran fait
            // parfois apparaître des cartes vides quand elles ont des calques absolus.
            removeClippedSubviews={Platform.OS === 'android'}
            // Le fil commence par les posts, avec au-dessus ce qui manque à ton profil (SetupCard, pour toi seul).
            // La salle, les duels et le cercle proche sont dans l'Activité (le cœur).
            ListHeaderComponent={feedHeader}
            ListEmptyComponent={
              loadingFeed ? (
                <FeedSkeleton />
              ) : (
                <View style={{ paddingTop: 40, alignItems: 'center' }}>
                  <Text style={{ color: '#888', fontSize: 14, fontFamily: F.bold }}>{t('main.feedEmpty')}</Text>
                  <Text style={{ color: '#777', marginTop: 4, fontSize: 12 }}>{t('main.feedEmptySub')}</Text>
                  {/* Le texte invite à publier : le bouton le permet tout de suite (1.2). */}
                  <TouchableOpacity style={[s.emptyStateBtn, { marginTop: 16 }]} onPress={() => onPost({ from: 'feed_empty' })} accessibilityRole="button" accessibilityLabel={t('main.feedEmptyCta')}>
                    <Text style={s.emptyStateBtnText}>{t('main.feedEmptyCta')}</Text>
                  </TouchableOpacity>
                </View>
              )
            }
            ListFooterComponent={
              <View style={{ height: bottomPad, alignItems: 'center', paddingTop: 10 }}>
                {loadingMore ? <ActivityIndicator color="#fff" /> : null}
                {!loadingMore && !hasMore && updates.length > 0 ? (
                  <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', paddingHorizontal: 24 }}>
                    {t('main.feedEnd')}
                  </Text>
                ) : null}
              </View>
            }
            renderItem={({ item, index }) => (
              <FeedCardInFeed
                u={item}
                meta={feedMeta[item.id]}
                currentUserId={userId}
                isActive={visibleIds.has(item.id)}
                // La vidéo d'à côté reste prête dans les deux sens : ni écran noir, ni nouveau téléchargement en remontant.
                preloadVideo={(index > 0 && visibleIds.has(updates[index - 1].id)) || (!!updates[index + 1] && visibleIds.has(updates[index + 1].id))}
                onDuoReply={(authorId) => onPost({ duoWith: authorId })}
                onOpenProfile={openProfile}
                duelBusyIds={duelBusyIds}
                onChallenge={challengeFromFeed}
                duoDone={duoDone.has(item.id)}
                duoValidated={duoPairs.has(item.id)}
                closeAuthor={!!item.user_id && closeIds.has(item.user_id)}
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
            <Text style={{ color: '#888', fontSize: 14, fontFamily: F.bold, marginBottom: 20 }}>{t('main.noObjective')}</Text>
            <TouchableOpacity style={s.emptyStateBtn} onPress={() => setShowCreateModal(true)}>
              <Text style={s.emptyStateBtnText}>{t('main.addObjective')}</Text>
            </TouchableOpacity>
          </View>
        ) : GLASS_OBJECTIVES ? (
          <ObjectivesTab
            objectives={objectives}
            activity={activityByObj}
            streak={streak}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onAdd={() => setShowCreateModal(true)}
            onUpdate={() => onPost()}
            onEdit={o => setEditing(o)}
            onDelete={o => handleDeleteObjective(o.id, o.title)}
            bottomPad={bottomPad}
          />
        ) : (
        <ScrollView
          style={s.feed}
          contentContainerStyle={s.feedPad}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" />}
        >
          <View style={s.statsRow}>
            <View style={s.statPill}><Text style={s.statVal}>{objectives.length}</Text><Text style={s.statLbl}>{t('main.statActive')}</Text></View>
            <View style={s.statPill}><Text style={s.statVal}>{t('days.durationDays', { n: streak })}</Text><Text style={s.statLbl}>{t('main.statStreak')}</Text></View>
            <View style={s.statPill}>
              <Text style={s.statVal}>{Math.round(objectives.reduce((acc, o) => acc + progressPct(o), 0) / objectives.length)}%</Text>
              <Text style={s.statLbl}>{t('main.statAvg')}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.addObjBtn} onPress={() => setShowCreateModal(true)}>
            <Text style={s.addObjBtnText}>{t('main.addObjective')}</Text>
          </TouchableOpacity>
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
                    <TouchableOpacity onPress={() => setEditing(o)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('main.editObj', { title: o.title })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[s.visBadge, o.visibility === 'public' && s.visBadgePublic]}>
                        <Text style={[s.visText, o.visibility === 'public' && s.visTextPublic]}>
                          {o.visibility === 'public' ? t('vis.public') : o.visibility === 'friends' ? t('vis.friends') : o.visibility === 'close' ? t('vis.close') : t('vis.private')}
                        </Text>
                      </View>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="ellipsis-horizontal" size={16} color="#ddd" />
                      </View>
                    </TouchableOpacity>
                  </View>
                  <Text style={s.objCardSub}>{o.unit === '%' ? `${pct} %` : t('main.valueOf', { cur: o.current_value, target: o.target_value, unit: unitLabel(o.unit) })}</Text>
                  {hasSchedule(o.training_days) && <Text style={[s.objCardSub, { marginTop: 2 }]}>📅 {daysLabel(o.training_days, true)}</Text>}
                  <View style={s.objProgressRow}>
                    <View style={s.objProgressBg}>
                      <View style={[s.objProgressFill, { width: `${pct}%` as any }]} />
                    </View>
                    <Text style={s.objPct}>{o.unit === '%' ? `${pct}%` : `${o.current_value}/${o.target_value}`}</Text>
                  </View>
                  <TouchableOpacity style={s.updateBtn} onPress={() => onPost()}>
                    <Text style={s.updateBtnText}>{t('main.addUpdate')}</Text>
                  </TouchableOpacity>
                </Pressable>
              );
            })
          }
          {/* Hint suppression */}
          <Text style={{ color: '#666', fontSize: 11, textAlign: 'center', marginBottom: 8 }}>
            {t('main.objHint')}
          </Text>
          <View style={{ height: bottomPad }} />
        </ScrollView>
        )
      )}

      {tab === 'friends' && <FriendsTab onViewProfile={openProfile} onPendingCount={setPendingCount} />}

      {tab === 'profile' && (
        <ProfileScreen
          onViewProfile={openProfile}
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
          <NavTab icon="home" active={tab === 'feed'} onPress={() => (tab === 'feed' ? feedRef.current?.scrollToOffset({ offset: 0, animated: true }) : setTab('feed'))} />
          <NavTab icon="apps" active={tab === 'objectives'} onPress={() => setTab('objectives')} />
        </View>

        {/* === Bouton + central, isolé === */}
        <PostButton onPress={() => onPost()} />

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
      {activityLayer}
    </View>
  );
}
