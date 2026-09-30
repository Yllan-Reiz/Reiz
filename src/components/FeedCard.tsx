import { useState, useEffect, useRef, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, Animated, Easing, Pressable, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { timeAgo, frError, inUnit } from '../lib/helpers';
import { Update, FeedMeta, Reactor } from '../lib/types';
import { ALL_REACTION_EMOJIS } from '../constants';
import { s, F } from '../styles';
import { CommentsModal } from './CommentsModal';
import { FadeInImage } from './FadeInImage';
import { FeedVideo } from './FeedVideo';
import { isVideo } from '../lib/storage';
import { togglePin } from '../lib/posts';
import { FloatingEmoji, nextFloatId } from './FloatingEmoji';

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
function Gauge({ pct, label }: { pct: number; label: string }) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: pct, duration: 700, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={s.gaugeRow}>
      <View style={s.gaugeTrack}>
        <Animated.View style={[s.gaugeFill, { width: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
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
const QUICK_REACTIONS = ['🔥', '💪', '👏', '😮', '😂', '❤️'];
const STACK_MAX = 4;

// Les réactions et le compteur de commentaires arrivent pré-chargés via `meta`
// (chargés en lot par le feed) : zéro requête au montage de la carte.
export function FeedCard({ u, meta, currentUserId, onDeleted, onBlocked, openCommentsOnMount, isActive = false, onPinChanged, onDuoReply, onOpenProfile, duoDone }: {
  u: Update;
  meta?: FeedMeta;
  currentUserId: string | null;
  onDeleted?: () => void;
  onBlocked?: () => void;
  // Depuis le fil d'activité : un commentaire reçu ouvre directement la discussion.
  openCommentsOnMount?: boolean;
  // Carte la plus visible à l'écran : seule sa vidéo joue.
  isActive?: boolean;
  // Appelé après épinglage / désépinglage, pour que le profil se mette à jour.
  onPinChanged?: () => void;
  // Séance en duo : l'ami identifié publie la sienne, avec l'auteur identifié en retour.
  onDuoReply?: (authorId: string) => void;
  // Toucher une photo de profil ou un prénom (auteur, ami en duo, commentaire) ouvre le profil.
  onOpenProfile?: (id: string) => void;
  // Déjà répondu à ce duo : le bouton devient une confirmation.
  duoDone?: boolean;
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
    ? `${String(objTarget >= 10 ? Math.round((pctValue / 100) * objTarget) : Math.round((pctValue / 100) * objTarget * 10) / 10).replace('.', ',')} / ${String(objTarget).replace('.', ',')} ${objUnit}`
    : `${pctValue}%`;

  const [reactions, setReactions] = useState<{ [emoji: string]: number }>(meta?.reactions || {});
  const [myReactions, setMyReactions] = useState<string[]>(meta?.mine || []);
  const [commentCount, setCommentCount] = useState(meta?.commentCount || 0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(!!openCommentsOnMount);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);
  const [reactors, setReactors] = useState<Reactor[]>(meta?.reactors || []);
  const [showQuick, setShowQuick] = useState(false);
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
      setReactors(prev => [{ user_id: currentUserId, emoji, name: 'Toi', avatar_url: prev.find(r => r.user_id === currentUserId)?.avatar_url ?? null }, ...prev]);
      const id = nextFloatId();
      setFloatingEmojis(prev => [...prev, { id, emoji }]);
      const { error } = await supabase.from('reactions').insert({ update_id: u.id, user_id: currentUserId, type: emoji });
      if (error) { setMyReactions(prevMy); setReactions(prevCounts); setReactors(prevReactors); }
    }
  };

  const uname = u.users?.full_name || 'Utilisateur';
  const duoNames = (u.with_users || []).map(w => w.full_name);
  const duoLabel = duoNames.length === 0 ? null
    : duoNames.length === 1 ? duoNames[0]
    : `${duoNames.slice(0, -1).join(', ')} et ${duoNames[duoNames.length - 1]}`;
  const canDuoReply = !!onDuoReply && !!currentUserId && !!u.user_id && u.user_id !== currentUserId
    && (u.with_user_ids || []).includes(currentUserId);
  const isMine = !!currentUserId && u.user_id === currentUserId;

  const deletePost = () => {
    Alert.alert('Supprimer ce post', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await supabase.from('reactions').delete().eq('update_id', u.id);
          await supabase.from('comments').delete().eq('update_id', u.id);
          const { error } = await supabase.from('updates').delete().eq('id', u.id);
          if (error) { Alert.alert('Erreur', frError(error)); return; }
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
      if (error) Alert.alert('Erreur', frError(error));
      else Alert.alert('Signalement envoyé', 'Ton signalement a bien été envoyé. Nous allons l\'examiner.');
    };
    Alert.alert('Signaler ce post', 'Pourquoi signales-tu ce contenu ?', [
      { text: 'Spam', onPress: () => send('spam') },
      { text: 'Contenu inapproprié', onPress: () => send('inapproprié') },
      { text: 'Autre', onPress: () => send('autre') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const blockUser = () => {
    Alert.alert(`Bloquer ${uname}`, 'Vous ne verrez plus les contenus l\'un de l\'autre.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Bloquer', style: 'destructive',
        onPress: async () => {
          if (!currentUserId || !u.user_id) return;
          const { error } = await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: u.user_id });
          if (error && !/duplicate key/i.test(error.message || '')) { Alert.alert('Erreur', frError(error)); return; }
          onBlocked?.();
        },
      },
    ]);
  };

  const [pinned, setPinned] = useState(!!u.pinned_at);
  useEffect(() => { setPinned(!!u.pinned_at); }, [u.pinned_at]);

  const pinPost = async () => {
    if (!currentUserId) return;
    const err = await togglePin({ ...u, pinned_at: pinned ? 'x' : null }, currentUserId);
    if (err) { Alert.alert('Épinglés', err); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPinned(p => !p);
    onPinChanged?.();
  };

  const openMenu = () => {
    if (isMine) {
      Alert.alert('Ton post', undefined, [
        { text: pinned ? 'Retirer des épinglés' : 'Épingler sur mon profil', onPress: pinPost },
        { text: 'Supprimer le post', style: 'destructive', onPress: deletePost },
        { text: 'Annuler', style: 'cancel' },
      ]);
    } else {
      Alert.alert(uname, undefined, [
        { text: 'Signaler le post', onPress: reportPost },
        { text: `Bloquer ${uname}`, style: 'destructive', onPress: blockUser },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  const initial = uname.charAt(0).toUpperCase();
  const avatarUrl: string | undefined = u.users?.avatar_url;
  const openAuthor = onOpenProfile && u.user_id ? () => onOpenProfile(u.user_id!) : undefined;
  const Avatar = () => (
    <TouchableOpacity onPress={openAuthor} disabled={!openAuthor} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} accessibilityLabel={`Profil de ${uname}`}>
      {avatarUrl
        ? <Image source={{ uri: avatarUrl }} style={s.avImg} />
        : <View style={s.av}><Text style={s.avText}>{initial}</Text></View>}
    </TouchableOpacity>
  );
  // Séance en duo : une vraie ligne cliquable (petits visages + « avec Eden et
  // Logan »). Avant, seuls les prénoms en tout petit réagissaient au doigt.
  const openDuo = () => {
    const withUsers = u.with_users || [];
    if (!onOpenProfile || withUsers.length === 0) return;
    if (withUsers.length === 1) { onOpenProfile(withUsers[0].id); return; }
    Alert.alert('Séance en duo', undefined, [
      ...withUsers.map(w => ({ text: w.full_name, onPress: () => onOpenProfile(w.id) })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  };
  const Duo = () => {
    const withUsers = u.with_users || [];
    if (!duoLabel) return null;
    return (
      <TouchableOpacity style={s.duoRow} onPress={openDuo} disabled={!onOpenProfile} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6 }} accessibilityLabel={`Séance avec ${duoLabel}`}>
        <View style={{ flexDirection: 'row' }}>
          {withUsers.slice(0, 3).map((w, i) => (
            w.avatar_url
              ? <Image key={w.id} source={{ uri: w.avatar_url }} style={[s.duoAv, i > 0 && { marginLeft: -7 }]} />
              : <View key={w.id} style={[s.duoAv, s.duoAvEmpty, i > 0 && { marginLeft: -7 }]}><Text style={s.duoAvText}>{w.full_name.charAt(0).toUpperCase()}</Text></View>
          ))}
        </View>
        <Text style={s.duoText} numberOfLines={1}>avec <Text style={s.duoNames}>{duoLabel}</Text></Text>
      </TouchableOpacity>
    );
  };
  const MenuBtn = () => (
    <TouchableOpacity style={s.cardMenuBtn} onPress={openMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.7)" />
    </TouchableOpacity>
  );
  // Mon emoji le plus récent : le bouton de réaction l'affiche à la place du smiley.
  const myLast = reactors.find(r => r.user_id === currentUserId)?.emoji;
  const isVid = !!u.photo_url && isVideo(u.photo_url);

  // Pile de visages en bas à gauche de la photo : chaque personne qui a réagi,
  // avec son emoji en pastille. Un tap ouvre la liste complète.
  // Un visage par personne (son emoji le plus récent), comme sur BeReal.
  const faces = reactors.filter((r, i) => reactors.findIndex(x => x.user_id === r.user_id) === i);
  const Stack = () => faces.length === 0 ? null : (
    <TouchableOpacity style={s.brStack} onPress={() => setShowReactors(true)} activeOpacity={0.8} accessibilityLabel="Voir les réactions">
      {faces.slice(0, STACK_MAX).map((r, i) => (
        <View key={r.user_id} style={[s.brStackItem, i > 0 && { marginLeft: -12 }, { zIndex: STACK_MAX - i }]}>
          {r.avatar_url
            ? <Image source={{ uri: r.avatar_url }} style={s.brStackAv} />
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
  const Overlay = () => (
    <>
      {showQuick ? (
        <View style={s.brQuickBar}>
          {QUICK_REACTIONS.map(e => (
            <TouchableOpacity key={e} onPress={() => toggleReaction(e)} style={[s.brQuickItem, myReactions.includes(e) && s.brQuickItemOn]} accessibilityLabel={`Réagir ${e}`}>
              <Text style={s.brQuickEmoji}>{e}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { setShowQuick(false); setShowEmojiPicker(true); }} style={s.brQuickItem} accessibilityLabel="Plus d'emojis">
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.brBottomRow} pointerEvents="box-none">
          <Stack />
          <View style={{ flex: 1 }} pointerEvents="none" />
          <TouchableOpacity style={[s.brReactBtn, !!myLast && s.brReactBtnMine]} onPress={() => { Haptics.selectionAsync().catch(() => {}); setShowEmojiPicker(false); setShowQuick(true); }} activeOpacity={0.8} accessibilityLabel="Réagir">
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
        onClose={() => setShowComments(false)}
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
        <Avatar />
        <View style={s.cardMeta}>
          <Text style={s.cardName} onPress={openAuthor} suppressHighlighting numberOfLines={1}>{uname}</Text>
          <Text style={s.brSub} numberOfLines={1}>
            {u.objectives?.title && u.caption?.trim().toLowerCase() !== u.objectives.title.trim().toLowerCase() ? `${u.objectives.emoji || ''} ${u.objectives.title}`.trim() + ' · ' : ''}{timeAgo(u.created_at).replace('Il y a', 'il y a')}
            {u.objectives?.visibility === 'close' ? '  ★ Proche' : ''}
          </Text>
          <Duo />
        </View>
        <MenuBtn />
      </View>

      {/* Le média. Toucher ailleurs que sur un bouton referme la barre d'emojis. */}
      {u.photo_url ? (
        <Pressable style={s.feedPhotoWrap} onPress={() => showQuick && setShowQuick(false)} disabled={!showQuick}>
          {isVid
            ? <FeedVideo uri={u.photo_url} active={isActive} style={s.feedPhoto} />
            : <FadeInImage uri={u.photo_url} style={s.feedPhoto} />}
          <Overlay />
        </Pressable>
      ) : (
        <Pressable style={s.feedNoPhoto} onPress={() => showQuick && setShowQuick(false)} disabled={!showQuick}>
          <Text style={s.feedNoPhotoCaption}>{u.caption || u.objectives?.title || ''}</Text>
          <Overlay />
        </Pressable>
      )}

      {/* Sous le média : la légende, puis les commentaires, comme sur BeReal */}
      <View style={s.brBelow}>
        <Gauge pct={pctValue} label={progressLabel} />
        {u.photo_url && u.caption ? <Text style={s.feedCaption}>{u.caption}</Text> : null}
        <TouchableOpacity onPress={() => setShowComments(true)} hitSlop={{ top: 6, bottom: 6 }} accessibilityLabel="Commenter">
          {commentCount > 0 && (
            <Text style={s.brCommentsLink}>
              {commentCount === 1 ? 'Voir le commentaire' : `Voir les ${commentCount} commentaires`}
            </Text>
          )}
          <Text style={s.brAddComment}>Ajouter un commentaire…</Text>
        </TouchableOpacity>
        {canDuoReply && (duoDone ? (
          <View style={[s.duoReplyBtn, s.duoReplyDone]}>
            <Text style={s.duoReplyDoneText}>✓ Ta séance en duo est postée</Text>
          </View>
        ) : (
          <TouchableOpacity style={s.duoReplyBtn} onPress={() => onDuoReply!(u.user_id!)} activeOpacity={0.85}>
            <Text style={s.actionTextDuo}>🤝 {uname.split(' ')[0]} t'a identifié · Poster ta séance</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tous les emojis (bouton + de la barre) */}
      <Reveal visible={showEmojiPicker}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.emojiPickerRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 2, paddingVertical: 10 }}>
          {ALL_REACTION_EMOJIS.map(emoji => (
            <TouchableOpacity key={emoji} style={[s.emojiPickerItem, myReactions.includes(emoji) && s.emojiPickerItemActive]} onPress={() => toggleReaction(emoji)}>
              <Text style={s.emojiPickerItemText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Reveal>

      {/* Qui a réagi */}
      <Modal visible={showReactors} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowReactors(false)}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowReactors(false)}><Text style={s.modalCancel}>Fermer</Text></TouchableOpacity>
            <Text style={s.modalTitle}>Réactions</Text>
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
                  ? <Image source={{ uri: r.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
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
