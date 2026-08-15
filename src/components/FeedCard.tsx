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
export function FeedCard({ u, meta, currentUserId, onDeleted, onBlocked }: {
  u: Update;
  meta?: FeedMeta;
  currentUserId: string | null;
  onDeleted?: () => void;
  onBlocked?: () => void;
}) {
  const [reactions, setReactions] = useState<{ [emoji: string]: number }>(meta?.reactions || {});
  const [myReactions, setMyReactions] = useState<string[]>(meta?.mine || []);
  const [commentCount, setCommentCount] = useState(meta?.commentCount || 0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
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

  const openMenu = () => {
    if (isMine) {
      Alert.alert('Ton post', undefined, [
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
          <FadeInImage uri={u.photo_url} style={s.feedPhoto} />

          {/* Header superposé en haut */}
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={s.feedOverlayTop}>
            <View style={s.feedOverlayHeader}>
              <Avatar />
              <View style={s.cardMeta}>
                <Text style={s.cardName}>{uname}</Text>
                <Text style={s.cardTime}>{timeAgo(u.created_at)}</Text>
              </View>
              <MenuBtn />
            </View>
          </LinearGradient>

          {/* Fondu + réactions + actions en bas */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={s.feedOverlayBottom}>
            {/* Barre de progression */}
            <View style={s.feedOverlayProgress}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${Math.min(u.progress_value || 0, 100)}%` as any }]} />
              </View>
              <Text style={s.progressLabelOverlay}>{u.progress_value || 0}%</Text>
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
            </View>
          </LinearGradient>
        </View>
      ) : (
        <View style={s.feedNoPhoto}>
          <View style={s.cardHeader}>
            <Avatar />
            <View style={s.cardMeta}>
              <Text style={s.cardName}>{uname}</Text>
              <Text style={s.cardTime}>{timeAgo(u.created_at)}</Text>
            </View>
            <MenuBtn />
          </View>
          {u.caption ? <Text style={s.feedNoPhotoCaption}>{u.caption}</Text> : null}
          <View style={s.progressRow}>
            <View style={s.progressBg}><View style={[s.progressFill, { width: `${Math.min(u.progress_value || 0, 100)}%` as any }]} /></View>
            <Text style={s.progressLabel}>{u.progress_value || 0}%</Text>
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
