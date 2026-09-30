import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Update, FeedMeta } from '../lib/types';
import { s } from '../styles';
import { FeedCard } from './FeedCard';

// Un post ouvert en grand (depuis la grille du profil ou les épinglés),
// avec ses réactions, ses commentaires et le menu « … » habituels.
export function PostViewer({ post, currentUserId, onClose, onChanged, onOpenProfile }: {
  post: { u: Update; meta: FeedMeta };
  currentUserId: string | null;
  onClose: () => void;
  onChanged?: () => void;
  onOpenProfile?: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={s.backBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={20} color="#888" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Publication</Text>
        <View style={{ width: 34 }} />
      </View>
      <ScrollView style={s.feed} contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <FeedCard
          u={post.u}
          meta={post.meta}
          currentUserId={currentUserId}
          isActive
          onPinChanged={onChanged}
          onOpenProfile={onOpenProfile}
          onDeleted={() => { onChanged?.(); onClose(); }}
          onBlocked={() => { onChanged?.(); onClose(); }}
        />
      </ScrollView>
    </View>
  );
}
