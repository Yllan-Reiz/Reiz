import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/helpers';
import { Comment } from '../lib/types';
import { s, F } from '../styles';

export function CommentsModal({ visible, updateId, currentUserId, onClose, onCountChange }: {
  visible: boolean;
  updateId: string;
  currentUserId: string | null;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('comments').select('id, content, created_at, users(full_name)').eq('update_id', updateId).order('created_at', { ascending: true });
    if (!error && data) {
      setComments(data as unknown as Comment[]);
      onCountChange?.(data.length);
    }
    setLoading(false);
  };

  useEffect(() => { if (visible && updateId) fetchComments(); }, [visible, updateId]);

  const handleSend = async () => {
    if (!newComment.trim() || !currentUserId) return;
    setSending(true);
    const { error } = await supabase.from('comments').insert({ update_id: updateId, user_id: currentUserId, content: newComment.trim() });
    setSending(false);
    if (!error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setNewComment(''); fetchComments();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>← Fermer</Text></TouchableOpacity>
            <Text style={s.modalTitle}>Commentaires</Text>
            <View style={{ width: 60 }} />
          </View>
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
          ) : (
            <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
              {comments.length === 0 ? (
                <View style={{ paddingTop: 40, alignItems: 'center' }}>
                  <Text style={{ color: '#888', fontSize: 14, fontFamily: F.bold }}>Pas encore de commentaires</Text>
                  <Text style={{ color: '#777', marginTop: 4, fontSize: 12 }}>Sois le premier à commenter.</Text>
                </View>
              ) : comments.map((c) => (
                <View key={c.id} style={s.commentRow}>
                  <View style={s.commentAv}><Text style={s.commentAvText}>{(c.users?.full_name || 'U').charAt(0).toUpperCase()}</Text></View>
                  <View style={s.commentContent}>
                    <Text style={s.commentName}>{c.users?.full_name || 'Utilisateur'}</Text>
                    <Text style={s.commentText}>{c.content}</Text>
                    <Text style={s.commentTime}>{timeAgo(c.created_at)}</Text>
                  </View>
                </View>
              ))}
              <View style={{ height: 80 }} />
            </ScrollView>
          )}
          <View style={s.commentInputRow}>
            <TextInput style={s.commentInput} placeholder="Écris un commentaire..." placeholderTextColor="#666" value={newComment} onChangeText={setNewComment} multiline maxLength={500} />
            <TouchableOpacity style={[s.sendBtn, (!newComment.trim() || sending) && s.sendBtnDisabled]} onPress={sending ? undefined : handleSend}>
              {sending ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.sendBtnText}>→</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
