import { useState, useEffect, useRef, memo, ReactNode } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Animated, Easing, Pressable, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { timeAgo, frError, inUnit, num } from '../lib/helpers';
import { Update, FeedMeta, Reactor } from '../lib/types';
import { ALL_REACTION_EMOJIS } from '../constants';
import { s, F } from '../styles';
import { useQuickReactions } from '../lib/quickReactions';
import { QuickReactionsEditor } from './QuickReactionsEditor';
import { EmojiKeyboardInput, emojiKeyboardAvailable } from '../../modules/reiz-emoji-keyboard';
import { CommentsModal } from './CommentsModal';
import { FadeInImage } from './FadeInImage';
import { FeedVideo } from './FeedVideo';
import { isVideo } from '../lib/storage';
import { isRhythm, weekLabel } from '../lib/goal';
import { track } from '../lib/track';
import { togglePin } from '../lib/posts';
import { DUO_WINDOW_MS } from '../lib/duo';
import { ShareStoryModal, StoryData } from './ShareStoryModal';
import { JourneyModal } from './JourneyModal';
import { lateLabel, ON_TIME_MIN } from '../lib/moment';
import { FloatingEmoji, nextFloatId } from './FloatingEmoji';
import { t, tp, unitLabel, dirIcon } from '../i18n';
import { CachedImage } from './CachedImage';

// Ouverture/fermeture en fondu-montée. Le contenu reste monté le temps de la
// sortie, sinon le panneau disparaît d'un coup sec.
function Reveal({ visible, children }: { visible: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 200 : 130,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished && !visible) setMounted(false); });
  }, [visible]);
  if (!mounted) return null;
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// Jauge de progression sous chaque post : elle se remplit à l'affichage.
// Sur le pilote natif (glissement d'une barre pleine largeur) : animer la largeur passait par JavaScript, et chaque
// carte qui arrivait à l'écran prenait 700 ms de calcul au fil pendant le défilement (corrigé le 31/10/2026).
function Gauge({ pct, label }: { pct: number; label: string }) {
  const fill = useRef(new Animated.Value(0)).current;
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    Animated.timing(fill, { toValue: pct / 100, duration: 700, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [pct, fill]);
  return (
    <View style={s.gaugeRow}>
      <View style={s.gaugeTrack} onLayout={e => setTrackW(e.nativeEvent.layout.width)}>
        {trackW > 0 && (
          <Animated.View style={[s.gaugeFill, { width: trackW, transform: [{ translateX: fill.interpolate({ inputRange: [0, 1], outputRange: [-trackW, 0] }) }] }]} />
        )}
      </View>
      <Text style={s.gaugeLabel}>{label}</Text>
    </View>
  );
}

// Emoji qui flotte doucement (monte et redescend de 3 px), décalé d'un visage à
// l'autre pour que la pile ne bouge pas d'un bloc.
function Floaty({ children, index = 0, style }: { children: ReactNode; index?: number; style?: any }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -3, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const t = setTimeout(() => loop.start(), index * 280);
    return () => { clearTimeout(t); loop.stop(); };
  }, []);
  return <Animated.Text style={[style, { transform: [{ translateY: y }] }]}>{children}</Animated.Text>;
}

// Réactions en un tap, comme sur BeReal : la barre s'ouvre sur la photo.
const STACK_MAX = 4;

// Les réactions et le compteur de commentaires arrivent pré-chargés via `meta`
// (chargés en lot par le feed) : zéro requête au montage de la carte.
const EDIT_CAPTION_MS = 5 * 60 * 1000;

export function FeedCard({ u, meta, currentUserId, onDeleted, onBlocked, openCommentsOnMount, isActive = false, preloadVideo = false, onPinChanged, onDuoReply, onOpenProfile, duoDone, duoValidated, closeAuthor, duelBusyIds, onChallenge }: {
  // L'auteur est dans ton cercle proche : une étoile à côté de son prénom.
  closeAuthor?: boolean;
  u: Update;
  meta?: FeedMeta;
  currentUserId: string | null;
  onDeleted?: () => void;
  onBlocked?: () => void;
  // Depuis le fil d'activité : un commentaire reçu ouvre directement la discussion.
  openCommentsOnMount?: boolean;
  // Un bout de la carte est à l'écran : sa vidéo joue.
  isActive?: boolean;
  // Carte voisine d'une carte visible : sa vidéo se tient prête, pour démarrer sans écran noir.
  preloadVideo?: boolean;
  // Appelé après épinglage / désépinglage, pour que le profil se mette à jour.
  onPinChanged?: () => void;
  // Séance en duo : l'ami identifié publie la sienne, avec l'auteur identifié en retour.
  onDuoReply?: (authorId: string) => void;
  // Toucher une photo de profil ou un prénom (auteur, ami en duo, commentaire) ouvre le profil.
  onOpenProfile?: (id: string) => void;
  // Déjà répondu à ce duo : le bouton devient une confirmation.
  duoDone?: boolean;
  duoValidated?: boolean;
  /** Amis avec qui un défi est déjà ouvert ; sans cette liste (hors du fil), pas de bouton « Lancer un défi ». */
  duelBusyIds?: Set<string>;
  onChallenge?: (id: string, name: string) => void;
}) {
  // Le fil parle la même langue que le reste de l'app : un objectif chiffré
  // s'affiche en séances (ou en km, en reps...), le pourcentage ne reste que
  // pour les objectifs suivis en %.
  const pctValue = Math.min(u.progress_value || 0, 100);
  const objIn = u.objectives ? inUnit(u.objectives) : null;
  const objUnit = objIn?.unit;
  const objTarget = objIn?.target_value;
  const progressLabel = objUnit && objUnit !== '%' && objTarget
    // Valeur reconstituée depuis le % : pas de faux chiffre après la virgule (251,1 kg).
    // Depuis la 1.2 le % est exact (215 kg reste 215) : on garde alors le chiffre après la virgule.
    ? `${num(objTarget >= 10 && Number.isInteger(pctValue) ? Math.round((pctValue / 100) * objTarget) : Math.round((pctValue / 100) * objTarget * 10) / 10)} / ${num(objTarget)} ${unitLabel(objUnit)}`
    : `${pctValue}%`;
  // Rythme hebdo (phase 31) : « 12 / 48 séances, semaine 3 sur 12 ».
  const rhythmInfo = objIn && isRhythm(objIn as any) ? weekLabel(objIn as any) : null;

  const [reactions, setReactions] = useState<{ [emoji: string]: number }>(meta?.reactions || {});
  const [myReactions, setMyReactions] = useState<string[]>(meta?.mine || []);
  const [commentCount, setCommentCount] = useState(meta?.commentCount || 0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(!!openCommentsOnMount);
  const [commentsFocus, setCommentsFocus] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);
  const [reactors, setReactors] = useState<Reactor[]>(meta?.reactors || []);
  const [showQuick, setShowQuick] = useState(false);
  const quickReactions = useQuickReactions();
  const [editingQuick, setEditingQuick] = useState(false);
  const [showReactors, setShowReactors] = useState(false);

  // Resynchronise quand le feed est rafraîchi (pull-to-refresh)
  useEffect(() => {
    if (!meta) return;
    setReactions(meta.reactions);
    setMyReactions(meta.mine);
    setCommentCount(meta.commentCount);
    setReactors(meta.reactors || []);
  }, [meta]);

  const toggleReaction = async (emoji: string) => {
    if (!currentUserId) return;
    const isActive = myReactions.includes(emoji);
    // Snapshot pour rollback si la requête échoue
    const prevMy = myReactions;
    const prevCounts = reactions;
    const prevReactors = reactors;
    setShowEmojiPicker(false);
    setShowQuick(false);

    if (isActive) {
      // update optimiste
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      setMyReactions(prev => prev.filter(e => e !== emoji));
      setReactions(prev => ({ ...prev, [emoji]: Math.max((prev[emoji] || 1) - 1, 0) }));
      setReactors(prev => prev.filter(r => !(r.user_id === currentUserId && r.emoji === emoji)));
      const { error } = await supabase.from('reactions').delete().eq('update_id', u.id).eq('user_id', currentUserId).eq('type', emoji);
      if (error) { setMyReactions(prevMy); setReactions(prevCounts); setReactors(prevReactors); }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setMyReactions(prev => [...prev, emoji]);
      setReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
      setReactors(prev => [{ user_id: currentUserId, emoji, name: t('common.you'), avatar_url: prev.find(r => r.user_id === currentUserId)?.avatar_url ?? null }, ...prev]);
      const id = nextFloatId();
      setFloatingEmojis(prev => [...prev, { id, emoji }]);
      const { error } = await supabase.from('reactions').insert({ update_id: u.id, user_id: currentUserId, type: emoji });
      if (error) { setMyReactions(prevMy); setReactions(prevCounts); setReactors(prevReactors); }
    }
  };

  const uname = u.users?.full_name || t('common.user');
  const duoNames = (u.with_users || []).map(w => w.full_name);
  const duoLabel = duoNames.length === 0 ? null
    : duoNames.length === 1 ? duoNames[0]
    : t('common.andJoin', { list: duoNames.slice(0, -1).join(', '), last: duoNames[duoNames.length - 1] });
  const canDuoReply = !!onDuoReply && !!currentUserId && !!u.user_id && u.user_id !== currentUserId
    && (u.with_user_ids || []).includes(currentUserId);
  const isMine = !!currentUserId && u.user_id === currentUserId;

  const deletePost = () => {
    Alert.alert(t('feed.deleteTitle'), t('feed.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          await supabase.from('reactions').delete().eq('update_id', u.id);
          await supabase.from('comments').delete().eq('update_id', u.id);
          const { error } = await supabase.from('updates').delete().eq('id', u.id);
          if (error) { Alert.alert(t('common.error'), frError(error)); return; }
          onDeleted?.();
        },
      },
    ]);
  };

  const reportPost = () => {
    const send = async (reason: string) => {
      if (!currentUserId) return;
      const { error } = await supabase.from('reports').insert({
        reporter_id: currentUserId, update_id: u.id, reported_user_id: u.user_id, reason,
      });
      if (error) Alert.alert(t('common.error'), frError(error));
      else Alert.alert(t('feed.reportSentTitle'), t('feed.reportSentText'));
    };
    Alert.alert(t('feed.reportTitle'), t('feed.reportWhy'), [
      { text: t('common.spam'), onPress: () => send('spam') },
      { text: t('feed.inappropriate'), onPress: () => send('inapproprié') },
      { text: t('common.other'), onPress: () => send('autre') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const blockUser = () => {
    Alert.alert(t('feed.blockTitle', { name: uname }), t('feed.blockText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.block'), style: 'destructive',
        onPress: async () => {
          if (!currentUserId || !u.user_id) return;
          const { error } = await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: u.user_id });
          if (error && !/duplicate key/i.test(error.message || '')) { Alert.alert(t('common.error'), frError(error)); return; }
          onBlocked?.();
        },
      },
    ]);
  };

  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [journeyOpen, setJourneyOpen] = useState(false);
  // Légende modifiable 5 minutes après l'envoi.
  const [caption, setCaption] = useState(u.caption);
  useEffect(() => { setCaption(u.caption); }, [u.caption]);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const saveCaption = async () => {
    const next = (editingCaption ?? '').trim() || u.objectives?.title || '';
    const { error } = await supabase.from('updates').update({ caption: next }).eq('id', u.id);
    if (error) { Alert.alert(t('common.error'), frError(error)); return; }
    setCaption(next);
    setEditingCaption(null);
    track('caption_edit', {}, 'feed');
  };
  // Post en duo qui me concerne : l'autre personne de la séance, si nous n'avons pas déjà un défi ouvert.
  const duoPartner = !duelBusyIds || !onChallenge || !currentUserId || !u.with_users?.length ? null
    : u.user_id === currentUserId ? u.with_users.find(w => !duelBusyIds.has(w.id)) ?? null
    : u.with_users.some(w => w.id === currentUserId) && u.user_id && !duelBusyIds.has(u.user_id) ? { id: u.user_id, full_name: u.users?.full_name || '' }
    : null;
  // Le post de la victoire : celui qui a fait gagner l'objectif (la base date la victoire juste après lui).
  // Si l'auteur monte la barre ensuite, la date est effacée et le badge part avec elle.
  const winAt = u.objectives?.completed_at ? new Date(u.objectives.completed_at).getTime() : 0;
  const isWin = !!u.objective_id && winAt > 0 && Math.abs(new Date(u.created_at).getTime() - winAt) < 10 * 60 * 1000;
  // Ouvert depuis l'Activité, personne ne dit si j'ai déjà répondu : la carte le vérifie (mon post à moins d'1 h).
  const [duoAnswered, setDuoAnswered] = useState(false);
  useEffect(() => {
    if (!canDuoReply || duoDone !== undefined || !currentUserId || !u.user_id) return;
    const at = new Date(u.created_at).getTime();
    supabase.from('updates').select('id', { count: 'exact', head: true }).eq('user_id', currentUserId).contains('with_user_ids', [u.user_id])
      .gte('created_at', new Date(at - DUO_WINDOW_MS).toISOString()).lte('created_at', new Date(at + DUO_WINDOW_MS).toISOString())
      .then(({ count }) => setDuoAnswered((count || 0) > 0), () => {});
  }, [canDuoReply, duoDone, currentUserId, u.user_id, u.created_at]);
  const answered = duoDone ?? duoAnswered;
  // Compte à rebours du duo : il se valide si vous postez à moins d'1 h d'écart.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!canDuoReply || answered) return;
    const id = setInterval(() => tick(n => n + 1), 30000);
    return () => clearInterval(id);
  }, [canDuoReply, answered]);
  const duoLeftMin = Math.ceil((DUO_WINDOW_MS - (Date.now() - new Date(u.created_at).getTime())) / 60000);
  const [pinned, setPinned] = useState(!!u.pinned_at);
  useEffect(() => { setPinned(!!u.pinned_at); }, [u.pinned_at]);

  const pinPost = async () => {
    if (!currentUserId) return;
    const err = await togglePin({ ...u, pinned_at: pinned ? 'x' : null }, currentUserId);
    if (err) { Alert.alert(t('feed.pinned'), err); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPinned(p => !p);
    onPinChanged?.();
  };

  // Partager son post en story (aussi accessible par l'icône visible à côté du menu).
  const shareStory = () => setStoryData({
            photoUri: u.photo_url || null,
            emoji: u.objectives?.emoji,
            title: u.objectives?.title || u.caption,
            progressLabel: progressLabel,
            pct: pctValue,
            caption,
            username: u.users?.username,
          });

  const openMenu = () => {
    if (isMine) {
      Alert.alert(t('feed.yourPost'), undefined, [
        ...(Date.now() - new Date(u.created_at).getTime() < EDIT_CAPTION_MS ? [{ text: t('feed.editCaption'), onPress: () => setEditingCaption(caption || '') }] : []),
        { text: t('feed.shareStory'), onPress: shareStory },
        { text: pinned ? t('feed.unpin') : t('feed.pin'), onPress: pinPost },
        { text: t('feed.deletePost'), style: 'destructive', onPress: deletePost },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    } else {
      Alert.alert(uname, undefined, [
        { text: t('feed.reportPost'), onPress: reportPost },
        { text: t('feed.blockTitle', { name: uname }), style: 'destructive', onPress: blockUser },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  };

  const initial = uname.charAt(0).toUpperCase();
  const avatarUrl: string | undefined = u.users?.avatar_url;
  const openAuthor = onOpenProfile && u.user_id ? () => onOpenProfile(u.user_id!) : undefined;
  // Ces morceaux sont des éléments, pas des composants : définis comme composants dans le rendu, React les démontait
  // et les remontait à chaque rendu de la carte (visages rechargés, emojis qui sautaient, toucher perdu).
  const avatar = (
    <TouchableOpacity onPress={openAuthor} disabled={!openAuthor} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityLabel={t('feed.profileOf', { name: uname })}>
      {avatarUrl
        ? <CachedImage uri={avatarUrl} style={s.avImg} />
        : <View style={s.av}><Text style={s.avText}>{initial}</Text></View>}
    </TouchableOpacity>
  );
  // Séance en duo : une vraie ligne cliquable (petits visages + « avec Eden et
  // Logan »). Avant, seuls les prénoms en tout petit réagissaient au doigt.
  const openDuo = () => {
    const withUsers = u.with_users || [];
    if (!onOpenProfile || withUsers.length === 0) return;
    if (withUsers.length === 1) { onOpenProfile(withUsers[0].id); return; }
    Alert.alert(t('feed.duoSession'), undefined, [
      ...withUsers.map(w => ({ text: w.full_name, onPress: () => onOpenProfile(w.id) })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };
  const duoUsers = u.with_users || [];
  const duo = !duoLabel ? null : (
      <TouchableOpacity style={[s.duoRow, duoValidated && { backgroundColor: '#242424', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]} onPress={openDuo} disabled={!onOpenProfile} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6 }} accessibilityLabel={t('feed.sessionWith', { names: duoLabel })}>
        <View style={{ flexDirection: 'row' }}>
          {duoUsers.slice(0, 3).map((w, i) => (
            w.avatar_url
              ? <CachedImage key={w.id} uri={w.avatar_url} style={[s.duoAv, i > 0 && { marginLeft: -7 }]} />
              : <View key={w.id} style={[s.duoAv, s.duoAvEmpty, i > 0 && { marginLeft: -7 }]}><Text style={s.duoAvText}>{w.full_name.charAt(0).toUpperCase()}</Text></View>
          ))}
        </View>
        {duoValidated
          ? <Text style={s.duoText} numberOfLines={1}><Text style={s.duoNames}>{t('feed.duoValidated')}</Text> {t('feed.with')} <Text style={s.duoNames}>{duoLabel}</Text></Text>
          : <Text style={s.duoText} numberOfLines={1}>{t('feed.with')} <Text style={s.duoNames}>{duoLabel}</Text></Text>}
      </TouchableOpacity>
  );
  const menuBtn = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <TouchableOpacity style={s.cardMenuBtn} onPress={openMenu} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }} accessibilityLabel={t('feed.moreOptions')}>
        <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </View>
  );
  // Mon emoji le plus récent : le bouton de réaction l'affiche à la place du smiley.
  const myLast = reactors.find(r => r.user_id === currentUserId)?.emoji;
  const isVid = !!u.photo_url && isVideo(u.photo_url);

  // Pile de visages en bas à gauche de la photo : chaque personne qui a réagi,
  // avec son emoji en pastille. Un tap ouvre la liste complète.
  // Un visage par personne (son emoji le plus récent), comme sur BeReal.
  const faces = reactors.filter((r, i) => reactors.findIndex(x => x.user_id === r.user_id) === i);
  const stack = faces.length === 0 ? null : (
    <TouchableOpacity style={s.brStack} onPress={() => setShowReactors(true)} activeOpacity={0.8} accessibilityLabel={t('feed.seeReactions')}>
      {faces.slice(0, STACK_MAX).map((r, i) => (
        <View key={r.user_id} style={[s.brStackItem, i > 0 && { marginLeft: -12 }, { zIndex: STACK_MAX - i }]}>
          {r.avatar_url
            ? <CachedImage uri={r.avatar_url} style={s.brStackAv} />
            : <View style={[s.brStackAv, s.brStackAvEmpty]}><Text style={s.brStackInitial}>{r.name.charAt(0).toUpperCase()}</Text></View>}
          <Floaty index={i} style={s.brStackEmoji}>{r.emoji}</Floaty>
        </View>
      ))}
      {faces.length > STACK_MAX && (
        <View style={[s.brStackItem, { marginLeft: -12 }]}>
          <View style={[s.brStackAv, s.brStackMore]}><Text style={s.brStackMoreText}>+{faces.length - STACK_MAX}</Text></View>
        </View>
      )}
    </TouchableOpacity>
  );

  // Ce qui se pose sur le média (photo, vidéo ou cadre texte) : progression en
  // liseré tout en bas, pile de visages à gauche, bouton de réaction à droite,
  // et la barre d'emojis quand on appuie dessus.
  const overlay = (
    <>
      {/* Sur tes posts : le partage (Instagram...) bien visible, en haut à droite de la photo. */}
      {isMine && (
        <TouchableOpacity onPress={shareStory} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityRole="button" accessibilityLabel={t('feed.shareStory')}
          style={{ position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-redo-outline" size={20} color="#fff" />
        </TouchableOpacity>
      )}
      {showQuick ? (
        <View style={s.brQuickBar}>
          {quickReactions.map(e => (
            <TouchableOpacity key={e} onPress={() => toggleReaction(e)} style={[s.brQuickItem, myReactions.includes(e) && s.brQuickItemOn]} accessibilityLabel={t('feed.reactWith', { emoji: e })}>
              <Text style={s.brQuickEmoji}>{e}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { setShowQuick(false); setShowEmojiPicker(true); }} style={s.brQuickItem} accessibilityLabel={t('feed.moreEmojis')}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.brBottomRow} pointerEvents="box-none">
          {stack}
          <View style={{ flex: 1 }} pointerEvents="none" />
          {/* Commenter, à côté de réagir : la fonction se voit sans chercher sous la photo. */}
          <TouchableOpacity style={[s.brReactBtn, { marginRight: 8 }]} onPress={() => setShowComments(true)} activeOpacity={0.8} accessibilityLabel={t('feed.comment')}>
            <Ionicons name="chatbubble-outline" size={22} color="#fff" />
            {commentCount > 0 && (
              <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#000', fontSize: 11, fontFamily: F.extrabold }}>{commentCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[s.brReactBtn, !!myLast && s.brReactBtnMine]} onPress={() => { Haptics.selectionAsync().catch(() => {}); setShowEmojiPicker(false); setShowQuick(true); }} activeOpacity={0.8} accessibilityLabel={t('feed.react')}>
            {myLast
              ? <Floaty index={2} style={{ fontSize: 22 }}>{myLast}</Floaty>
              : <Ionicons name="happy-outline" size={24} color="#fff" />}
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <View style={[s.feedCard, { overflow: 'visible' }]}>
      <CommentsModal
        visible={showComments}
        updateId={u.id}
        postOwnerId={u.user_id}
        currentUserId={currentUserId}
        focusInput={commentsFocus}
        onClose={() => { setShowComments(false); setCommentsFocus(false); }}
        onCountChange={setCommentCount}
        onOpenProfile={onOpenProfile}
      />

      {/* Emojis flottants */}
      {floatingEmojis.map(fe => (
        <FloatingEmoji
          key={fe.id}
          emoji={fe.emoji}
          onDone={() => setFloatingEmojis(prev => prev.filter(x => x.id !== fe.id))}
        />
      ))}

      {/* En-tête au-dessus du média, sur le noir : photo, prénom, progression et heure */}
      <View style={s.brHeader}>
        {avatar}
        <View style={s.cardMeta}>
          <Text style={s.cardName} onPress={openAuthor} suppressHighlighting numberOfLines={1}>{uname}{closeAuthor ? ' ★' : ''}</Text>
          <Text style={s.brSub} numberOfLines={1}>
            {u.objectives?.title && caption?.trim().toLowerCase() !== u.objectives.title.trim().toLowerCase() ? `${u.objectives.emoji || ''} ${u.objectives.title}`.trim() + ' · ' : ''}{timeAgo(u.created_at, true)}
            {u.objectives?.visibility === 'close' ? `  ★ ${t('vis.close')}` : ''}
          </Text>
          {duo}
          {/* Moment Reiz (phase 29) : récup ou séance, à l'heure ou en retard. */}
          {u.moment && (
            <Text style={{ color: (u.moment_late_min ?? 99) < ON_TIME_MIN ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: 12.5, fontFamily: F.bold, marginTop: 3 }} numberOfLines={1}>
              {[u.moment === 'recovery' ? t('moment.recoveryBadge') : null, lateLabel(u.moment_late_min ?? 0)].filter(Boolean).join('  ')}
            </Text>
          )}
        </View>
        {menuBtn}
      </View>

      {/* Le média. Toucher ailleurs que sur un bouton referme la barre d'emojis. */}
      {u.photo_url ? (
        <Pressable style={s.feedPhotoWrap} onPress={() => showQuick && setShowQuick(false)} disabled={!showQuick}>
          {isVid
            ? <FeedVideo uri={u.photo_url} active={isActive} preload={preloadVideo} style={s.feedPhoto} />
            // Même cadre 2:3 pour toutes les photos, comme les vidéos : avec leurs proportions d'origine (30/10/2026), les
            // photos horizontales sortaient toutes petites entre deux grandes. Le fichier entier reste visible dans le parcours.
            : <FadeInImage uri={u.photo_url} style={s.feedPhoto} resizeMode="cover" />}
          {overlay}
        </Pressable>
      ) : (
        <Pressable style={s.feedNoPhoto} onPress={() => showQuick && setShowQuick(false)} disabled={!showQuick}>
          <Text style={s.feedNoPhotoCaption}>{caption || u.objectives?.title || ''}</Text>
          {overlay}
        </Pressable>
      )}

      {/* Sous le média : la légende, puis les commentaires, comme sur BeReal */}
      <View style={s.brBelow}>
        <Gauge pct={pctValue} label={rhythmInfo ? `${progressLabel}, ${rhythmInfo.toLowerCase()}` : progressLabel} />
        {isWin && (
          <TouchableOpacity onPress={() => setJourneyOpen(true)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('journey.seeJourney')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 10, paddingLeft: 10, paddingRight: 12, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
            <Text style={{ fontSize: 15 }}>🏆</Text>
            <Text style={{ color: '#fff', fontSize: 13.5, fontFamily: F.bold }}>{t('journey.feedWin')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5, fontFamily: F.semibold }}>{t('journey.seeJourney')}</Text>
            <Ionicons name={dirIcon('chevron-forward')} size={14} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}
        {duoPartner && (
          <TouchableOpacity onPress={() => onChallenge!(duoPartner.id, duoPartner.full_name)} activeOpacity={0.85} accessibilityRole="button"
            style={{ alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
            <Text style={{ color: '#fff', fontSize: 13.5, fontFamily: F.bold }}>{t('duelCard.challengeWith', { name: duoPartner.full_name.split(' ')[0] })}</Text>
          </TouchableOpacity>
        )}
        {u.photo_url && caption ? <Text style={s.feedCaption}>{caption}</Text> : null}
        {commentCount > 0 && (
          <TouchableOpacity onPress={() => setShowComments(true)} hitSlop={{ top: 6, bottom: 3 }} accessibilityLabel={t('feed.comment')}>
            <Text style={s.brCommentsLink}>
              {tp('feed.seeComments', commentCount)}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => { setCommentsFocus(true); setShowComments(true); }} hitSlop={{ top: 3, bottom: 6 }} accessibilityLabel={t('feed.addComment')}>
          <Text style={s.brAddComment}>{t('feed.addComment')}</Text>
        </TouchableOpacity>
        {canDuoReply && (answered ? (
          <View style={[s.duoReplyBtn, s.duoReplyDone]}>
            <Text style={s.duoReplyDoneText}>{t('feed.duoPosted')}</Text>
          </View>
        ) : (
          <TouchableOpacity style={s.duoReplyBtn} onPress={() => onDuoReply!(u.user_id!)} activeOpacity={0.85}>
            <Text style={s.actionTextDuo}>
              {duoLeftMin > 0
                ? t('feed.duoValidateLeft', { name: uname.split(' ')[0], n: duoLeftMin })
                : t('feed.duoLate')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tous les emojis (bouton + de la barre) */}
      {showEmojiPicker && emojiKeyboardAvailable() && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowEmojiPicker(false)} accessibilityRole="button" accessibilityLabel={t('common.close')} />
          <EmojiKeyboardInput active onEmoji={toggleReaction} />
          <TouchableOpacity onPress={() => { setShowEmojiPicker(false); setTimeout(() => setEditingQuick(true), 350); }} activeOpacity={0.7} accessibilityRole="button"
            style={{ position: 'absolute', top: 72, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 44, borderRadius: 22, backgroundColor: '#1c1c1c' }}>
            <Ionicons name="pencil" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontFamily: F.semibold }}>{t('quickReactions.title')}</Text>
          </TouchableOpacity>
        </Modal>
      )}
      <Reveal visible={showEmojiPicker && !emojiKeyboardAvailable()}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.emojiPickerRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 2, paddingVertical: 10 }}>
          {/* Choisir ses 6 réactions : le crayon est là où l'on cherche un autre emoji. */}
          <TouchableOpacity style={s.emojiPickerItem} onPress={() => setEditingQuick(true)} accessibilityRole="button" accessibilityLabel={t('quickReactions.title')}>
            <Ionicons name="pencil" size={18} color="#fff" />
          </TouchableOpacity>
          {ALL_REACTION_EMOJIS.map(emoji => (
            <TouchableOpacity key={emoji} style={[s.emojiPickerItem, myReactions.includes(emoji) && s.emojiPickerItemActive]} onPress={() => toggleReaction(emoji)}>
              <Text style={s.emojiPickerItemText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Reveal>

      <ShareStoryModal visible={!!storyData} data={storyData} onClose={() => setStoryData(null)} />
      <Modal visible={editingQuick} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingQuick(false)}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setEditingQuick(false)}><Text style={s.modalCancel}>{t('common.close')}</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{t('quickReactions.title')}</Text>
            <View style={{ width: 50 }} />
          </View>
          <QuickReactionsEditor />
        </View>
      </Modal>
      <Modal visible={editingCaption !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingCaption(null)}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setEditingCaption(null)}><Text style={s.modalCancel}>{t('common.cancel')}</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{t('feed.editCaption')}</Text>
            <TouchableOpacity onPress={saveCaption}><Text style={[s.modalCancel, { color: '#fff', fontFamily: F.bold }]}>{t('common.save')}</Text></TouchableOpacity>
          </View>
          <TextInput value={editingCaption ?? ''} onChangeText={setEditingCaption} autoFocus multiline maxLength={300} placeholderTextColor="rgba(255,255,255,0.3)"
            style={{ color: '#fff', fontSize: 17, fontFamily: F.regular, padding: 20, minHeight: 140, textAlignVertical: 'top' }} />
        </View>
      </Modal>
      {journeyOpen && u.objective_id && (
        <JourneyModal objectiveId={u.objective_id} own={u.user_id === currentUserId} ownerName={uname} from="feed" onClose={() => setJourneyOpen(false)} />
      )}
      {/* Qui a réagi */}
      <Modal visible={showReactors} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowReactors(false)}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowReactors(false)}><Text style={s.modalCancel}>{t('common.close')}</Text></TouchableOpacity>
            <Text style={s.modalTitle}>{t('feed.reactions')}</Text>
            <View style={{ width: 50 }} />
          </View>
          <FlatList
            data={reactors}
            keyExtractor={r => `${r.user_id}-${r.emoji}`}
            contentContainerStyle={{ padding: 16, gap: 14 }}
            renderItem={({ item: r }) => (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                disabled={!onOpenProfile || r.user_id === currentUserId}
                onPress={() => { setShowReactors(false); onOpenProfile?.(r.user_id); }}
              >
                {r.avatar_url
                  ? <CachedImage uri={r.avatar_url} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  : <View style={[s.av, { width: 44, height: 44, borderRadius: 22 }]}><Text style={s.avText}>{r.name.charAt(0).toUpperCase()}</Text></View>}
                <Text style={{ flex: 1, color: '#fff', fontSize: 15, fontFamily: F.semibold }}>{r.name}</Text>
                <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

// Version du fil : une carte ne se redessine que si ce qu'elle affiche a changé. Sans ça, chaque carte du fil se
// redessinait dès qu'une autre passait à l'écran, et le défilement accrochait. Les fonctions (on...) sont volontairement
// ignorées : celles du fil ne dépendent que de l'utilisateur connecté et de fonctions stables.
export const FeedCardInFeed = memo(FeedCard, (a, b) =>
  a.u === b.u && a.meta === b.meta && a.currentUserId === b.currentUserId
  && a.isActive === b.isActive && a.preloadVideo === b.preloadVideo && a.duelBusyIds === b.duelBusyIds
  && a.duoDone === b.duoDone && a.duoValidated === b.duoValidated && a.closeAuthor === b.closeAuthor);
