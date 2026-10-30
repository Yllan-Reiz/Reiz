import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, Image, Keyboard, LayoutAnimation, Platform, Alert, Pressable, KeyboardEvent, Animated, PanResponder, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { timeAgo, frError } from '../lib/helpers';
import { signAvatars } from '../lib/storage';
import { Comment } from '../lib/types';
import { gifsAvailable, gifContent, gifIdOf, gifUrl, Gif } from '../lib/giphy';
import { GifPicker } from './GifPicker';
import { s, F } from '../styles';
import { t } from '../i18n';
import { CachedImage } from './CachedImage';
import { GlassSurface } from './GlassSurface';

type Likes = Record<string, { count: number; mine: boolean }>;

// Couleurs posées sur le verre : le fil reste visible, flouté, derrière les commentaires.
const GLASS_LINE = 'rgba(255,255,255,0.12)';
const GLASS_FILL = 'rgba(255,255,255,0.09)';

/** Un GIF de commentaire : il garde ses proportions (lues au chargement), 180 de large au plus. */
function CommentGif({ id }: { id: string }) {
  const [ratio, setRatio] = useState(1);
  return (
    <Image
      source={{ uri: gifUrl(id) }}
      onLoad={e => { const { width, height } = e.nativeEvent.source; if (width && height) setRatio(width / height); }}
      style={{ width: 180, height: Math.round(180 / ratio), borderRadius: 12, marginTop: 4, backgroundColor: '#1a1a1a' }}
      resizeMode="cover"
      accessibilityLabel="GIF"
    />
  );
}

function CommentAvatar({ name, url, small }: { name?: string; url?: string | null; small?: boolean }) {
  const size = small ? 26 : 34;
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (url) return <CachedImage uri={url} style={[box, { backgroundColor: '#2a2a2a' }]} />;
  return (
    <View style={[s.commentAv, box]}>
      <Text style={[s.commentAvText, small && { fontSize: 11 }]}>{(name || 'U').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function CommentsModal({ visible, updateId, postOwnerId, currentUserId, onClose, onCountChange, onOpenProfile }: {
  visible: boolean;
  updateId: string;
  postOwnerId?: string;
  currentUserId: string | null;
  onClose: () => void;
  onCountChange?: (n: number) => void;
  // Photo ou prénom d'un commentaire : ferme la discussion et ouvre le profil.
  onOpenProfile?: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<Likes>({});
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [keyboardPad, setKeyboardPad] = useState(0);
  const rootRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Clavier : KeyboardAvoidingView calcule mal sa hauteur dans une feuille
  // modale (pageSheet), qui ne démarre pas en haut de l'écran. Résultat : le
  // champ restait caché sous le clavier. On décale donc le contenu nous-mêmes.
  // iOS : le bas de la feuille est collé au bas de l'écran, le chevauchement
  // vaut exactement la hauteur du clavier (measureInWindow, lui, ignore le
  // décalage de la feuille et sous-estimait de ~60 points).
  // Android : la modale est plein écran, la mesure y est fiable.
  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const animate = (e?: KeyboardEvent) => {
      if (Platform.OS === 'ios') {
        LayoutAnimation.configureNext({
          duration: e?.duration || 250,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
    };
    const onShow = (e: KeyboardEvent) => {
      if (Platform.OS === 'ios') {
        animate(e);
        setKeyboardPad(e.endCoordinates.height);
        return;
      }
      rootRef.current?.measureInWindow((_x, y, _w, h) => {
        animate(e);
        setKeyboardPad(Math.max(0, y + h - e.endCoordinates.screenY));
      });
    };
    const onHide = (e: KeyboardEvent) => { animate(e); setKeyboardPad(0); };
    const a = Keyboard.addListener(showEvt, onShow);
    const b = Keyboard.addListener(hideEvt, onHide);
    // Filet de sécurité : si « will hide » est manqué, « did hide » remet à zéro.
    const c = Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidHide', () => setKeyboardPad(0)) : null;
    return () => { a.remove(); b.remove(); c?.remove(); setKeyboardPad(0); };
  }, [visible]);

  const fetchComments = async (silent = false) => {
    if (!silent) setLoading(true);
    // Relation nommée explicitement : la table comment_likes crée un second
    // chemin comments -> users, et l'API refuse un embed ambigu.
    const { data, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, parent_id, users!comments_user_id_fkey(full_name, avatar_url)')
      .eq('update_id', updateId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      const list = data as unknown as Comment[];
      // Bucket privé : les avatars passent par des URLs signées, en un seul appel.
      const signed = await signAvatars(list.map(c => c.users?.avatar_url));
      list.forEach(c => { if (c.users?.avatar_url) c.users.avatar_url = signed[c.users.avatar_url] ?? null; });
      setComments(list);
      onCountChange?.(list.length);

      const ids = list.map(c => c.id);
      const map: Likes = {};
      ids.forEach(id => { map[id] = { count: 0, mine: false }; });
      if (ids.length > 0) {
        const { data: lk } = await supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', ids);
        (lk || []).forEach((l: any) => {
          const m = map[l.comment_id]; if (!m) return;
          m.count++;
          if (l.user_id === currentUserId) m.mine = true;
        });
      }
      setLikes(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (visible && updateId) fetchComments();
    if (!visible) { setReplyTo(null); setNewComment(''); }
  }, [visible, updateId]);

  // Un GIF part tout de suite, comme dans une messagerie (le texte en cours d'écriture reste dans le champ).
  const sendGif = (gif: Gif) => { setGifOpen(false); handleSend(gifContent(gif.id)); };

  const handleSend = async (gif?: string) => {
    const content = gif ?? newComment.trim();
    if (!content || !currentUserId) return;
    setSending(true);
    const { error } = await supabase.from('comments').insert({
      update_id: updateId,
      user_id: currentUserId,
      content,
      parent_id: replyTo?.id ?? null,
    });
    setSending(false);
    if (!error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const wasReply = !!replyTo;
      if (!gif) setNewComment('');
      setReplyTo(null);
      await fetchComments(true);
      // Un nouveau commentaire racine arrive en bas : on y descend.
      if (!wasReply) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(t('common.error'), frError(error));
    }
  };

  const toggleLike = async (commentId: string) => {
    if (!currentUserId) return;
    const prev = likes[commentId] || { count: 0, mine: false };
    const next = { count: prev.count + (prev.mine ? -1 : 1), mine: !prev.mine };
    Haptics.impactAsync(prev.mine ? Haptics.ImpactFeedbackStyle.Soft : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLikes(l => ({ ...l, [commentId]: next }));
    const { error } = prev.mine
      ? await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
      : await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: currentUserId });
    if (error && !/duplicate key/i.test(error.message || '')) setLikes(l => ({ ...l, [commentId]: prev }));
  };

  const startReply = (c: Comment) => {
    // Une réponse à une réponse reste dans le même fil (celui du commentaire racine).
    setReplyTo({ id: c.parent_id || c.id, name: c.users?.full_name || t('common.user') });
    Haptics.selectionAsync().catch(() => {});
    inputRef.current?.focus();
  };

  // La table reports n'a pas de colonne commentaire : l'id part dans le motif.
  const reportComment = async (c: Comment) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('reports').insert({
      reporter_id: currentUserId, reported_user_id: c.user_id, reason: `commentaire ${c.id}`,
    });
    if (error) Alert.alert(t('common.error'), frError(error));
    else Alert.alert(t('feed.reportSentTitle'), t('feed.reportSentText'));
  };

  // Appui long : supprimer son commentaire (ou n'importe lequel sur son propre post),
  // signaler celui de quelqu'un d'autre.
  const onLongPress = (c: Comment) => {
    const isMine = c.user_id === currentUserId;
    const canDelete = isMine || postOwnerId === currentUserId;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const remove = {
      text: t('common.delete'), style: 'destructive' as const,
      onPress: async () => {
        const { error } = await supabase.from('comments').delete().eq('id', c.id);
        if (error) { Alert.alert(t('common.error'), frError(error)); return; }
        fetchComments(true);
      },
    };
    if (isMine) {
      Alert.alert(t('comments.deleteTitle'), c.parent_id ? undefined : t('comments.deleteText'), [
        { text: t('common.cancel'), style: 'cancel' },
        remove,
      ]);
      return;
    }
    Alert.alert(t('comments.comment'), undefined, [
      { text: t('common.report'), onPress: () => reportComment(c) },
      ...(canDelete ? [remove] : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  // Fermer en tirant vers le bas : le geste que donnait la feuille d'iOS, à refaire sur une feuille transparente.
  const dragY = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (visible) dragY.setValue(0); }, [visible, dragY]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dragToClose = useRef(PanResponder.create({
    // Dès le toucher : la poignée et le titre ne servent qu'à ça (« Fermer » garde son propre toucher).
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { dragY.setValue(Math.max(0, g.dy)); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 0.9) closeRef.current();
      else Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => { Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(); },
  })).current;

  const roots = comments.filter(c => !c.parent_id);
  const repliesOf = (id: string) => comments.filter(c => c.parent_id === id);

  const goProfile = (id?: string) => {
    if (!id || !onOpenProfile) return;
    Keyboard.dismiss();
    onClose();
    onOpenProfile(id);
  };

  const renderComment = (c: Comment, isReply = false) => {
    const lk = likes[c.id] || { count: 0, mine: false };
    return (
      <Pressable key={c.id} onLongPress={() => onLongPress(c)} delayLongPress={350} style={[s.commentRow, isReply && { marginLeft: 44, marginBottom: 12 }]}>
        <TouchableOpacity onPress={() => goProfile(c.user_id)} disabled={!onOpenProfile} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <CommentAvatar name={c.users?.full_name} url={c.users?.avatar_url} small={isReply} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={[s.commentContent, { backgroundColor: GLASS_FILL }]}>
            <Text style={s.commentName} onPress={onOpenProfile ? () => goProfile(c.user_id) : undefined} suppressHighlighting>{c.users?.full_name || t('common.user')}</Text>
            {gifIdOf(c.content) ? <CommentGif id={gifIdOf(c.content)!} /> : <Text style={s.commentText}>{c.content}</Text>}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 5, paddingLeft: 4 }}>
            <Text style={[s.commentTime, { marginTop: 0 }]}>{timeAgo(c.created_at)}</Text>
            <TouchableOpacity onPress={() => startReply(c)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Text style={{ color: '#aaa', fontSize: 11, fontFamily: F.bold }}>{t('comments.reply')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => toggleLike(c.id)}
          style={{ alignItems: 'center', paddingTop: 8, width: 28 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={lk.mine ? t('comments.unlike') : t('comments.like')}
        >
          <Ionicons name={lk.mine ? 'heart' : 'heart-outline'} size={15} color={lk.mine ? '#ff3b5c' : '#777'} />
          {lk.count > 0 && <Text style={{ color: '#888', fontSize: 10, marginTop: 2 }}>{lk.count}</Text>}
        </TouchableOpacity>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View ref={rootRef} style={{ flex: 1 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} />
        <Animated.View style={{ flex: 1, marginTop: insets.top + 44, paddingBottom: keyboardPad, transform: [{ translateY: dragY }] }}>
        {/* Déborde en bas : seuls les coins du haut sont arrondis. */}
        <GlassSurface radius={30} intensity={60} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -60 }}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,10,0.2)' }]} />
        </GlassSurface>
        {/* On tire la poignée ou le titre vers le bas pour fermer, comme une feuille iOS. */}
        <View {...dragToClose.panHandlers}>
        <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 8 }} />
        <View style={[s.modalHeader, { paddingTop: 12, borderBottomColor: GLASS_LINE }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.modalCancel}>{t('common.close')}</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>{t('comments.title')}</Text>
          <View style={{ width: 46 }} />
        </View>
        </View>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
        ) : (
          <ScrollView ref={scrollRef} style={s.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {roots.length === 0 ? (
              <View style={{ paddingTop: 40, alignItems: 'center' }}>
                <Text style={{ color: '#888', fontSize: 14, fontFamily: F.bold }}>{t('comments.empty')}</Text>
                <Text style={{ color: '#777', marginTop: 4, fontSize: 12 }}>{t('comments.emptySub')}</Text>
              </View>
            ) : roots.map(c => (
              <View key={c.id}>
                {renderComment(c)}
                {repliesOf(c.id).map(r => renderComment(r, true))}
              </View>
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
        {replyTo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, backgroundColor: GLASS_FILL, borderTopWidth: 1, borderTopColor: GLASS_LINE }}>
            <Text style={{ color: '#aaa', fontSize: 12, flex: 1 }}>
              {t('comments.replyingTo')} <Text style={{ color: '#fff', fontFamily: F.bold }}>{replyTo.name}</Text>
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t('comments.cancelReply')}>
              <Ionicons name="close" size={16} color="#888" />
            </TouchableOpacity>
          </View>
        )}
        <View style={[s.commentInputRow, { backgroundColor: 'transparent', borderTopColor: GLASS_LINE, paddingBottom: keyboardPad > 0 ? 12 : Math.max(12, insets.bottom) }]}>
          {gifsAvailable() && (
            <TouchableOpacity
              onPress={() => { Keyboard.dismiss(); setGifOpen(true); }}
              disabled={sending}
              accessibilityLabel={t('comments.addGif')}
              style={{ height: 36, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1, borderColor: GLASS_LINE, backgroundColor: GLASS_FILL, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontFamily: F.black, letterSpacing: 0.5 }}>GIF</Text>
            </TouchableOpacity>
          )}
          <TextInput
            ref={inputRef}
            style={[s.commentInput, { backgroundColor: GLASS_FILL, borderWidth: 1, borderColor: GLASS_LINE }]}
            placeholder={replyTo ? t('comments.replyTo', { name: replyTo.name }) : t('comments.placeholder')}
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={newComment}
            onChangeText={setNewComment}
            onBlur={() => { if (!Keyboard.isVisible()) setKeyboardPad(0); }}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!newComment.trim() || sending) && { backgroundColor: GLASS_FILL }]}
            onPress={sending || !newComment.trim() ? undefined : () => handleSend()}
            accessibilityLabel={t('common.send')}
          >
            {sending
              ? <ActivityIndicator color="#000" size="small" />
              : <Ionicons name="arrow-up" size={18} color={!newComment.trim() ? 'rgba(255,255,255,0.5)' : '#000'} />}
          </TouchableOpacity>
        </View>
        </Animated.View>
      </View>
      <GifPicker visible={gifOpen} onClose={() => setGifOpen(false)} onPick={sendGif} />
    </Modal>
  );
}
