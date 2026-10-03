import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, RefreshControl, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/helpers';
import { signMany, isVideo } from '../lib/storage';
import { ActivityItem, Update, FeedMeta } from '../lib/types';
import { s, F } from '../styles';
import { FeedCard } from '../components/FeedCard';
import { loadPost } from '../lib/posts';
import { CHANGELOG, changelogUnseen, markChangelogSeen } from '../lib/changelog';


type Row = ActivityItem & {
  updates?: { photo_url?: string | null; objectives?: { emoji?: string; title?: string } | null } | null;
  objectives?: { emoji?: string; title?: string } | null;
};

// Phrase affichée pour chaque type d'activité (le nom est rendu à part, en gras).
function describe(n: Row): string {
  const post = n.updates?.objectives;
  const postLabel = post?.title ? ` ${post.emoji || ''} ${post.title}`.replace(/\s+/g, ' ') : '';
  const quote = n.preview ? ` : « ${n.preview.length > 70 ? n.preview.slice(0, 69) + '…' : n.preview} »` : '';
  switch (n.type) {
    case 'reaction': return `a réagi ${n.emoji || ''} à ton post${postLabel}`;
    case 'comment': return `a commenté${quote}`;
    case 'reply': return `t'a répondu${quote}`;
    case 'comment_like': return `a aimé ton commentaire${quote}`;
    case 'friend_post': return `a posté${postLabel}`;
    case 'tag_endorse': return `a validé ton tag ${n.preview || ''}`.trim();
    case 'at_gym': return `est à ${n.preview || 'la salle'} 💪 Viens le rejoindre`;
    case 'duo_tag': return `t'a identifié dans sa séance${postLabel} 🤝`;
    case 'friend_request': return 'veut rejoindre ton cercle';
    case 'friend_accept': return 'a accepté ta demande. Vous êtes dans le même cercle.';
    case 'new_objective': return `s'est lancé un nouvel objectif${n.objectives?.title ? ` : ${n.objectives.emoji || ''} ${n.objectives.title}` : ''}`;
    default: return '';
  }
}

function sectionOf(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d >= today) return "Aujourd'hui";
  if (Date.now() - d.getTime() < 7 * 24 * 3600 * 1000) return 'Cette semaine';
  return 'Plus tôt';
}

export function ActivityScreen({ currentUserId, onClose, onViewProfile, onOpenFriends, onDuoReply }: {
  currentUserId: string | null;
  onClose: () => void;
  onViewProfile: (id: string) => void;
  onOpenFriends: () => void;
  onDuoReply?: (authorId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openPost, setOpenPost] = useState<{ u: Update; meta: FeedMeta; comments: boolean } | null>(null);
  const [openingPost, setOpeningPost] = useState(false);
  // Carte « Nouveautés » : dépliée tant qu'elle n'a pas été lue, repliée ensuite.
  const [newsOpen, setNewsOpen] = useState(false);
  const [newsUnseen, setNewsUnseen] = useState(false);
  useEffect(() => { changelogUnseen().then(u => { setNewsUnseen(u); setNewsOpen(u); if (u) markChangelogSeen(); }); }, []);

  const load = async (silent = false) => {
    if (!currentUserId) return;
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, created_at, read_at, actor_id, update_id, comment_id, objective_id, emoji, preview, actor:users!notifications_actor_id_fkey(full_name, avatar_url), updates(photo_url, objectives(emoji, title)), objectives(emoji, title)')
      .eq('recipient_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(60);
    if (!error && data) {
      const rows = data as unknown as Row[];
      const signed = await signMany([
        ...rows.map(r => r.actor?.avatar_url),
        ...rows.map(r => r.updates?.photo_url),
      ]);
      rows.forEach(r => {
        if (r.actor?.avatar_url) r.actor.avatar_url = signed[r.actor.avatar_url] ?? null;
        if (r.updates?.photo_url) r.updates.photo_url = signed[r.updates.photo_url] ?? null;
      });
      setItems(rows);
      // Ouvrir le fil vaut lecture : la pastille rouge du cœur disparaît.
      if (rows.some(r => !r.read_at)) {
        supabase.from('notifications').update({ read_at: new Date().toISOString() })
          .eq('recipient_id', currentUserId).is('read_at', null).then(() => {});
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentUserId]);

  // Rouvre le post concerné, avec ses réactions et son compteur de commentaires.
  const showPost = async (updateId: string, comments: boolean) => {
    setOpeningPost(true);
    const res = await loadPost(updateId, currentUserId);
    setOpeningPost(false);
    if (!res) { Alert.alert('Post introuvable', 'Il a peut-être été supprimé.'); return; }
    setOpenPost({ ...res, comments });
  };

  const onPressItem = (n: Row) => {
    if (n.type === 'friend_request') return onOpenFriends();
    if (n.update_id) return showPost(n.update_id, ['comment', 'reply', 'comment_like'].includes(n.type));
    if (n.actor_id) return onViewProfile(n.actor_id);
  };

  if (openPost) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => setOpenPost(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Retour">
            <Ionicons name="chevron-back" size={20} color="#888" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Publication</Text>
          <View style={{ width: 34 }} />
        </View>
        <ScrollView style={s.feed} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
          <FeedCard
            u={openPost.u}
            meta={openPost.meta}
            currentUserId={currentUserId}
            openCommentsOnMount={openPost.comments}
            isActive
            onDuoReply={onDuoReply}
            onOpenProfile={onViewProfile}
            onDeleted={() => { setOpenPost(null); load(true); }}
            onBlocked={() => { setOpenPost(null); load(true); }}
          />
        </ScrollView>
      </View>
    );
  }

  // Aplatit la liste avec des intertitres « Aujourd'hui / Cette semaine / Plus tôt ».
  const rows: ({ kind: 'section'; title: string } | { kind: 'item'; n: Row })[] = [];
  let current = '';
  items.forEach(n => {
    const sec = sectionOf(n.created_at);
    if (sec !== current) { rows.push({ kind: 'section', title: sec }); current = sec; }
    rows.push({ kind: 'item', n });
  });

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={s.backBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={20} color="#888" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Activité</Text>
        <View style={{ width: 34, alignItems: 'flex-end' }}>
          {openingPost && <ActivityIndicator color="#fff" size="small" />}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => (r.kind === 'section' ? `s-${r.title}` : r.n.id) + i}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(true); setRefreshing(false); }} tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" />}
          ListHeaderComponent={
            <TouchableOpacity activeOpacity={0.85} onPress={() => setNewsOpen(o => !o)} style={s.newsCard} accessibilityLabel="Nouveautés">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={s.newsIcon}><Text style={{ fontSize: 18 }}>✨</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.newsTitle}>{CHANGELOG.title}</Text>
                  <Text style={s.newsSub}>{newsUnseen ? 'Nouvelle mise à jour' : `${CHANGELOG.items.length} changements`}</Text>
                </View>
                {newsUnseen && <View style={s.newsDot} />}
                <Ionicons name={newsOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#777" />
              </View>
              {newsOpen && (
                <View style={{ marginTop: 14, gap: 12 }}>
                  {CHANGELOG.items.map((it, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                      <Text style={{ fontSize: 16, width: 24 }}>{it.emoji}</Text>
                      <Text style={s.newsItem}>{it.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={{ paddingTop: 80, alignItems: 'center', paddingHorizontal: 32 }}>
              <Text style={{ color: '#aaa', fontSize: 15, fontFamily: F.bold }}>Rien pour l'instant</Text>
              <Text style={{ color: '#777', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                Les réactions, commentaires et posts de ton cercle s'afficheront ici.
              </Text>
            </View>
          }
          renderItem={({ item: r }) => {
            if (r.kind === 'section') {
              return <Text style={[s.sectionTitle, { marginTop: 18, marginBottom: 8 }]}>{r.title.toUpperCase()}</Text>;
            }
            const n = r.n;
            const name = n.actor?.full_name || "Quelqu'un";
            const thumb = n.updates?.photo_url;
            return (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => onPressItem(n)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10,
                  borderRadius: 14, marginBottom: 2, backgroundColor: n.read_at ? 'transparent' : '#121212',
                }}
              >
                <TouchableOpacity onPress={() => n.actor_id && onViewProfile(n.actor_id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  {n.actor?.avatar_url
                    ? <Image source={{ uri: n.actor.avatar_url }} style={s.avImg} />
                    : <View style={s.av}><Text style={s.avText}>{name.charAt(0).toUpperCase()}</Text></View>}
                </TouchableOpacity>
                <Text style={{ flex: 1, color: '#ccc', fontSize: 13, lineHeight: 18 }}>
                  <Text style={{ color: '#fff', fontFamily: F.bold }}>{name}</Text> {describe(n)}
                  <Text style={{ color: '#777' }}>  {timeAgo(n.created_at).replace('Il y a ', '')}</Text>
                </Text>
                {n.type === 'friend_request' ? (
                  <View style={{ backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: '#000', fontSize: 12, fontFamily: F.bold }}>Voir</Text>
                  </View>
                ) : thumb && isVideo(thumb) ? (
                  <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="play" size={16} color="#aaa" />
                  </View>
                ) : thumb ? (
                  <Image source={{ uri: thumb }} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#1a1a1a' }} />
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
