import { useState, useEffect, useRef, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { timeAgo, frError } from '../lib/helpers';
import { Update, FeedMeta } from '../lib/types';
import { ALL_REACTION_EMOJIS } from '../constants';
import { s } from '../styles';
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

// Les réactions et le compteur de commentaires arrivent pré-chargés via `meta`
// (chargés en lot par le feed) : zéro requête au montage de la carte.
export function FeedCard({ u, meta, currentUserId, onDeleted, onBlocked, openCommentsOnMount, isActive = false, onPinChanged, onDuoReply }: {
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
}) {
  // Le fil parle la même langue que le reste de l'app : un objectif chiffré
  // s'affiche en séances (ou en km, en reps...), le pourcentage ne reste que
  // pour les objectifs suivis en %.
  const pctValue = Math.min(u.progress_value || 0, 100);
  const objUnit = u.objectives?.unit;
  const objTarget = u.objectives?.target_value;
  const progressLabel = objUnit && objUnit !== '%' && objTarget
    ? `${Math.round((pctValue / 100) * objTarget * 10) / 10} / ${objTarget} ${objUnit}`
    : `${pctValue}%`;

  const [reactions, setReactions] = useState<{ [emoji: string]: number }>(meta?.reactions || {});
  const [myReactions, setMyReactions] = useState<string[]>(meta?.mine || []);
  const [commentCount, setCommentCount] = useState(meta?.commentCount || 0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(!!openCommentsOnMount);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([]);

  // Resynchronise quand le feed est rafraîchi (pull-to-refresh)
  useEffect(() => {
    if (!meta) return;
    setReactions(meta.reactions);
    setMyReactions(meta.mine);
    setCommentCount(meta.commentCount);
  }, [meta]);

  const toggleReaction = async (emoji: string) => {
    if (!currentUserId) return;
    const isActive = myReactions.includes(emoji);
    // Snapshot pour rollback si la requête échoue
    const prevMy = myReactions;
    const prevCounts = reactions;
    setShowEmojiPicker(false);

    if (isActive) {
      // update optimiste
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      setMyReactions(prev => prev.filter(e => e !== emoji));
      setReactions(prev => ({ ...prev, [emoji]: Math.max((prev[emoji] || 1) - 1, 0) }));
      const { error } = await supabase.from('reactions').delete().eq('update_id', u.id).eq('user_id', currentUserId).eq('type', emoji);
      if (error) { setMyReactions(prevMy); setReactions(prevCounts); }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setMyReactions(prev => [...prev, emoji]);
      setReactions(prev => ({ ...prev, [emoji]: (prev[emoji] || 0) + 1 }));
      const id = nextFloatId();
      setFloatingEmojis(prev => [...prev, { id, emoji }]);
      const { error } = await supabase.from('reactions').insert({ update_id: u.id, user_id: currentUserId, type: emoji });
      if (error) { setMyReactions(prevMy); setReactions(prevCounts); }
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
  const Avatar = () => avatarUrl
    ? <Image source={{ uri: avatarUrl }} style={s.avImg} />
    : <View style={s.av}><Text style={s.avText}>{initial}</Text></View>;
  const MenuBtn = () => (
    <TouchableOpacity style={s.cardMenuBtn} onPress={openMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.7)" />
    </TouchableOpacity>
  );
  const activeReactions = Object.entries(reactions).filter(([_, count]) => count > 0);

  return (
    <View style={[s.feedCard, { overflow: 'visible' }]}>
      <CommentsModal
        visible={showComments}
        updateId={u.id}
        postOwnerId={u.user_id}
        currentUserId={currentUserId}
        onClose={() => setShowComments(false)}
        onCountChange={setCommentCount}
      />

      {/* Emojis flottants */}
      {floatingEmojis.map(fe => (
        <FloatingEmoji
          key={fe.id}
          emoji={fe.emoji}
          onDone={() => setFloatingEmojis(prev => prev.filter(x => x.id !== fe.id))}
        />
      ))}

      {/* Photo hero */}
      {u.photo_url ? (
        <View style={s.feedPhotoWrap}>
          {isVideo(u.photo_url)
            ? <FeedVideo uri={u.photo_url} active={isActive} style={s.feedPhoto} />
            : <FadeInImage uri={u.photo_url} style={s.feedPhoto} />}

          {/* Header superposé en haut */}
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={s.feedOverlayTop} pointerEvents="box-none">
            <View style={s.feedOverlayHeader}>
              <Avatar />
              <View style={s.cardMeta}>
                <Text style={s.cardName}>{uname}</Text>
                {duoLabel ? <Text style={s.cardDuo} numberOfLines={1}>🤝 avec {duoLabel}</Text> : null}
                {u.objectives?.visibility === 'close' ? <Text style={s.cardClose}>★ Cercle proche</Text> : null}
                <Text style={s.cardTime}>{timeAgo(u.created_at)}</Text>
              </View>
              <MenuBtn />
            </View>
          </LinearGradient>

          {/* Fondu + réactions + actions en bas */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={s.feedOverlayBottom} pointerEvents="box-none">
            {/* Barre de progression */}
            <View style={s.feedOverlayProgress}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${pctValue}%` as any }]} />
              </View>
              <Text style={s.progressLabelOverlay}>{progressLabel}</Text>
            </View>

            {/* Caption */}
            {u.caption ? <Text style={s.feedCaptionOverlay}>{u.caption}</Text> : null}

            {/* Réactions actives */}
            {activeReactions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.activeReactionsRow}>
                {activeReactions.map(([emoji, count]) => (
                  <TouchableOpacity key={emoji} style={[s.rxn, myReactions.includes(emoji) && s.rxnActive]} onPress={() => toggleReaction(emoji)}>
                    <Text style={s.rxnEmoji}>{emoji}</Text><Text style={s.rxnCount}>{count}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Actions */}
            <View style={s.actionsRow}>
              <TouchableOpacity style={s.actionBtn} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
                <Ionicons name="happy-outline" size={17} color="#888" />
                <Text style={s.actionText}>Réagir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={() => setShowComments(true)}>
                <Ionicons name="chatbubble-outline" size={16} color="#888" />
                <Text style={s.actionText}>{commentCount > 0 ? `${commentCount}` : 'Commenter'}</Text>
              </TouchableOpacity>
              {canDuoReply && (
                <TouchableOpacity style={[s.actionBtn, s.actionBtnDuo]} onPress={() => onDuoReply!(u.user_id!)}>
                  <Text style={s.actionTextDuo}>🤝 Poster la mienne</Text>
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </View>
      ) : (
        <View style={s.feedNoPhoto}>
          <View style={s.cardHeader}>
            <Avatar />
            <View style={s.cardMeta}>
              <Text style={s.cardName}>{uname}</Text>
              {duoLabel ? <Text style={s.cardDuo} numberOfLines={1}>🤝 avec {duoLabel}</Text> : null}
                {u.objectives?.visibility === 'close' ? <Text style={s.cardClose}>★ Cercle proche</Text> : null}
                <Text style={s.cardTime}>{timeAgo(u.created_at)}</Text>
            </View>
            <MenuBtn />
          </View>
          {u.caption ? <Text style={s.feedNoPhotoCaption}>{u.caption}</Text> : null}
          <View style={s.progressRow}>
            <View style={s.progressBg}><View style={[s.progressFill, { width: `${pctValue}%` as any }]} /></View>
            <Text style={s.progressLabel}>{progressLabel}</Text>
          </View>
          {/* Réactions + actions pour post sans photo */}
          {activeReactions.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.activeReactionsRow}>
              {activeReactions.map(([emoji, count]) => (
                <TouchableOpacity key={emoji} style={[s.rxn, myReactions.includes(emoji) && s.rxnActive]} onPress={() => toggleReaction(emoji)}>
                  <Text style={s.rxnEmoji}>{emoji}</Text><Text style={s.rxnCount}>{count}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.actionBtn} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
              <Ionicons name="happy-outline" size={17} color="#888" />
              <Text style={s.actionText}>Réagir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => setShowComments(true)}>
              <Ionicons name="chatbubble-outline" size={16} color="#888" />
              <Text style={s.actionText}>{commentCount > 0 ? `${commentCount}` : 'Commenter'}</Text>
            </TouchableOpacity>
            {canDuoReply && (
              <TouchableOpacity style={[s.actionBtn, s.actionBtnDuo]} onPress={() => onDuoReply!(u.user_id!)}>
                <Text style={s.actionTextDuo}>🤝 Poster la mienne</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Emoji picker */}
      <Reveal visible={showEmojiPicker}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.emojiPickerRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
          {ALL_REACTION_EMOJIS.map(emoji => (
            <TouchableOpacity key={emoji} style={[s.emojiPickerItem, myReactions.includes(emoji) && s.emojiPickerItemActive]} onPress={() => toggleReaction(emoji)}>
              <Text style={s.emojiPickerItemText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Reveal>
    </View>
  );
}
