import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, Image, Keyboard, LayoutAnimation, Platform, Alert, Pressable, KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { timeAgo, frError } from '../lib/helpers';
import { signMany } from '../lib/storage';
import { Comment } from '../lib/types';
import { s, F } from '../styles';

type Likes = Record<string, { count: number; mine: boolean }>;

function CommentAvatar({ name, url, small }: { name?: string; url?: string | null; small?: boolean }) {
  const size = small ? 26 : 34;
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (url) return <Image source={{ uri: url }} style={[box, { backgroundColor: '#2a2a2a' }]} />;
  return (
    <View style={[s.commentAv, box]}>
      <Text style={[s.commentAvText, small && { fontSize: 11 }]}>{(name || 'U').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function CommentsModal({ visible, updateId, postOwnerId, currentUserId, onClose, onCountChange }: {
  visible: boolean;
  updateId: string;
  postOwnerId?: string;
  currentUserId: string | null;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<Likes>({});
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
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
      const signed = await signMany(list.map(c => c.users?.avatar_url));
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

  const handleSend = async () => {
    if (!newComment.trim() || !currentUserId) return;
    setSending(true);
    const { error } = await supabase.from('comments').insert({
      update_id: updateId,
      user_id: currentUserId,
      content: newComment.trim(),
      parent_id: replyTo?.id ?? null,
    });
    setSending(false);
    if (!error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const wasReply = !!replyTo;
      setNewComment('');
      setReplyTo(null);
      await fetchComments(true);
      // Un nouveau commentaire racine arrive en bas : on y descend.
      if (!wasReply) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Erreur', frError(error));
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
    setReplyTo({ id: c.parent_id || c.id, name: c.users?.full_name || 'Utilisateur' });
    Haptics.selectionAsync().catch(() => {});
    inputRef.current?.focus();
  };

  // Appui long : supprimer son commentaire, ou n'importe lequel sur son propre post.
  const onLongPress = (c: Comment) => {
    const canDelete = c.user_id === currentUserId || postOwnerId === currentUserId;
    if (!canDelete) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert('Supprimer ce commentaire ?', c.parent_id ? undefined : 'Les réponses seront aussi supprimées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('comments').delete().eq('id', c.id);
          if (error) { Alert.alert('Erreur', frError(error)); return; }
          fetchComments(true);
        },
      },
    ]);
  };

  const roots = comments.filter(c => !c.parent_id);
  const repliesOf = (id: string) => comments.filter(c => c.parent_id === id);

  const renderComment = (c: Comment, isReply = false) => {
    const lk = likes[c.id] || { count: 0, mine: false };
    return (
      <Pressable key={c.id} onLongPress={() => onLongPress(c)} delayLongPress={350} style={[s.commentRow, isReply && { marginLeft: 44, marginBottom: 12 }]}>
        <CommentAvatar name={c.users?.full_name} url={c.users?.avatar_url} small={isReply} />
        <View style={{ flex: 1 }}>
          <View style={s.commentContent}>
            <Text style={s.commentName}>{c.users?.full_name || 'Utilisateur'}</Text>
            <Text style={s.commentText}>{c.content}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 5, paddingLeft: 4 }}>
            <Text style={[s.commentTime, { marginTop: 0 }]}>{timeAgo(c.created_at)}</Text>
            <TouchableOpacity onPress={() => startReply(c)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
              <Text style={{ color: '#aaa', fontSize: 11, fontFamily: F.bold }}>Répondre</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => toggleLike(c.id)}
          style={{ alignItems: 'center', paddingTop: 8, width: 28 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={lk.mine ? "Retirer j'aime" : "J'aime"}
        >
          <Ionicons name={lk.mine ? 'heart' : 'heart-outline'} size={15} color={lk.mine ? '#ff3b5c' : '#777'} />
          {lk.count > 0 && <Text style={{ color: '#888', fontSize: 10, marginTop: 2 }}>{lk.count}</Text>}
        </TouchableOpacity>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View ref={rootRef} style={[s.modalContainer, { paddingBottom: keyboardPad }]}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.modalCancel}>Fermer</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>Commentaires</Text>
          <View style={{ width: 46 }} />
        </View>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
        ) : (
          <ScrollView ref={scrollRef} style={s.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {roots.length === 0 ? (
              <View style={{ paddingTop: 40, alignItems: 'center' }}>
                <Text style={{ color: '#888', fontSize: 14, fontFamily: F.bold }}>Pas encore de commentaires</Text>
                <Text style={{ color: '#777', marginTop: 4, fontSize: 12 }}>Sois le premier à commenter.</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#1a1a1a' }}>
            <Text style={{ color: '#aaa', fontSize: 12, flex: 1 }}>
              Réponse à <Text style={{ color: '#fff', fontFamily: F.bold }}>{replyTo.name}</Text>
            </Text>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Annuler la réponse">
              <Ionicons name="close" size={16} color="#888" />
            </TouchableOpacity>
          </View>
        )}
        <View style={[s.commentInputRow, { paddingBottom: keyboardPad > 0 ? 12 : Math.max(12, insets.bottom) }]}>
          <TextInput
            ref={inputRef}
            style={s.commentInput}
            placeholder={replyTo ? `Répondre à ${replyTo.name}...` : 'Écris un commentaire...'}
            placeholderTextColor="#666"
            value={newComment}
            onChangeText={setNewComment}
            onBlur={() => { if (!Keyboard.isVisible()) setKeyboardPad(0); }}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!newComment.trim() || sending) && s.sendBtnDisabled]}
            onPress={sending || !newComment.trim() ? undefined : handleSend}
            accessibilityLabel="Envoyer"
          >
            {sending
              ? <ActivityIndicator color="#000" size="small" />
              : <Ionicons name="arrow-up" size={18} color={!newComment.trim() ? '#666' : '#000'} />}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
