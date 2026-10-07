import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, RefreshControl, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { signMany, signAvatars, isVideo } from '../lib/storage';
import { ActivityItem, Update, FeedMeta } from '../lib/types';
import { s, F } from '../styles';
import { GUTTER, hasSchedule, daysLabel } from '../constants';
import { FeedCard } from '../components/FeedCard';
import { GlassCard } from '../components/GlassSurface';
import { GlassBackdrop, GlassIconButton } from '../components/ProfileSections';
import { Faces } from '../components/CloseCircleCard';
import { CircleRhythmCard } from '../components/CircleRhythmCard';
import { loadPost } from '../lib/posts';
import { loadDuels, Duel } from '../lib/duel';
import { setAppBadge } from '../lib/badge';

type Row = ActivityItem & {
  updates?: { photo_url?: string | null; objectives?: { emoji?: string; title?: string } | null } | null;
  objectives?: { emoji?: string; title?: string; training_days?: number[] | null } | null;
};

// Une entrée du centre d'activité : une notification, ou plusieurs réactions au même post regroupées
// (« Eden, Axel et 3 autres ont réagi »). `rows[0]` est la plus récente.
type Entry = { key: string; group: boolean; rows: Row[] };

function groupRows(rows: Row[]): Entry[] {
  const out: Entry[] = [];
  const index = new Map<string, Entry>();
  rows.forEach(r => {
    const gk = r.type === 'reaction' && r.update_id ? `r:${r.update_id}` : r.type === 'comment_like' && r.comment_id ? `l:${r.comment_id}` : null;
    if (gk && index.has(gk)) { index.get(gk)!.rows.push(r); return; }
    const e: Entry = { key: gk ?? r.id, group: !!gk, rows: [r] };
    if (gk) index.set(gk, e);
    out.push(e);
  });
  return out;
}

const clip = (txt: string, n = 70) => (txt.length > n ? txt.slice(0, n - 1) + '…' : txt);

/** « Eden », « Eden et Axel », « Eden, Axel et 3 autres ». */
function whoLabel(rows: Row[]): { text: string; many: boolean } {
  const names = [...new Set(rows.map(r => r.actor?.full_name || "Quelqu'un"))];
  if (names.length === 1) return { text: names[0], many: false };
  if (names.length === 2) return { text: `${names[0]} et ${names[1]}`, many: true };
  return { text: `${names[0]}, ${names[1]} et ${names.length - 2} autre${names.length > 3 ? 's' : ''}`, many: true };
}

/** Une phrase courte (l'action) et une ligne de contexte, pour que chaque ligne se lise en une seconde. */
function copyOf(e: Entry): { who: string; action: string; context?: string } {
  const n = e.rows[0];
  const { text: who, many } = whoLabel(e.rows);
  const post = n.updates?.objectives;
  const postLabel = post?.title ? `${post.emoji || ''} ${post.title}`.trim() : undefined;
  const quote = n.preview ? `« ${clip(n.preview)} »` : undefined;
  const verb = (one: string, plural: string) => (many ? plural : one);
  switch (n.type) {
    case 'reaction': {
      const emojis = [...new Set(e.rows.map(r => r.emoji).filter(Boolean))].slice(0, 4).join('');
      return { who, action: `${verb('a réagi', 'ont réagi')} ${emojis} à ton post`.replace(/\s+/g, ' '), context: postLabel };
    }
    case 'comment_like': return { who, action: `${verb('a aimé', 'ont aimé')} ton commentaire`, context: quote };
    case 'comment': return { who, action: 'a commenté ton post', context: quote };
    case 'reply': return { who, action: "t'a répondu", context: quote };
    case 'friend_post': {
      // La légende n'est ajoutée que si elle apporte quelque chose (souvent elle reprend le nom de l'objectif).
      const caption = n.preview && n.preview.trim().toLowerCase() !== (post?.title || '').trim().toLowerCase() ? clip(n.preview, 50) : '';
      return { who, action: 'a posté', context: [postLabel, caption].filter(Boolean).join('  ') || undefined };
    }
    case 'tag_endorse': return { who, action: 'a validé ton tag', context: n.preview || undefined };
    case 'at_gym': return { who, action: `est à ${n.preview || 'la salle'}`, context: 'Viens le rejoindre 💪' };
    case 'duo_tag': return { who, action: "t'a identifié dans sa séance 🤝", context: postLabel };
    case 'friend_accept': return { who, action: 'a accepté ta demande', context: 'Vous êtes dans le même cercle.' };
    case 'challenge_accept': return { who, action: 'relève ton défi ⚔️', context: "C'est parti pour 7 jours" };
    case 'challenge_result': return { who, action: 'a terminé votre duel', context: n.preview || undefined };
    case 'new_objective': {
      const days = hasSchedule(n.objectives?.training_days) ? `Il s'entraîne ${daysLabel(n.objectives?.training_days, true)}` : undefined;
      return { who, action: "s'est lancé un objectif", context: [n.objectives?.title ? `${n.objectives.emoji || ''} ${n.objectives.title}`.trim() : '', days].filter(Boolean).join('  ') || undefined };
    }
    default: return { who, action: '' };
  }
}

// Petite pastille d'icône posée sur la photo : on repère le type d'un coup d'œil.
const ICON: Record<string, any> = {
  reaction: 'heart', comment_like: 'heart', comment: 'chatbubble', reply: 'chatbubble', friend_post: 'camera', tag_endorse: 'ribbon',
  at_gym: 'location', duo_tag: 'people', friend_accept: 'checkmark', challenge_accept: 'flash', challenge_result: 'trophy', new_objective: 'flag',
};

/** « à l'instant », « 12 min », « 3 h », « 2 j » : court, pour ne pas encombrer la ligne. */
function shortAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "à l'instant";
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h`;
  return `${Math.floor(sec / 86400)} j`;
}

function sectionOf(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d >= today) return "Aujourd'hui";
  if (Date.now() - d.getTime() < 7 * 24 * 3600 * 1000) return 'Cette semaine';
  return 'Plus tôt';
}

function Avatar({ url, name, size }: { url?: string | null; name: string; size: number }) {
  return url
    ? <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#222' }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: size * 0.4, fontFamily: F.bold }}>{name.charAt(0).toUpperCase()}</Text></View>;
}

function ActivityRow({ e, onPress, onAvatar }: { e: Entry; onPress: () => void; onAvatar: () => void }) {
  const n = e.rows[0];
  const c = copyOf(e);
  const unread = e.rows.some(r => !r.read_at);
  const thumb = n.updates?.photo_url;
  const faces = e.rows.slice(0, 3);
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={{ marginBottom: 12 }}>
      <GlassCard radius={26}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
          {faces.length > 1 ? (
            // Plusieurs personnes : leurs visages se chevauchent.
            <View style={{ width: 56, flexDirection: 'row', alignItems: 'center' }}>
              {faces.map((r, i) => (
                <View key={r.id} style={{ marginLeft: i === 0 ? 0 : -18, borderRadius: 20, borderWidth: 2, borderColor: '#151515' }}>
                  <Avatar url={r.actor?.avatar_url} name={r.actor?.full_name || '?'} size={36} />
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity onPress={onAvatar} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <View>
                <Avatar url={n.actor?.avatar_url} name={n.actor?.full_name || '?'} size={52} />
                {!!ICON[n.type] && (
                  <View style={{ position: 'absolute', right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 2, borderColor: '#151515', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={ICON[n.type]} size={11} color="#000" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 15, lineHeight: 21, fontFamily: F.regular }} numberOfLines={3}>
              <Text style={{ fontFamily: F.bold }}>{c.who}</Text> {c.action}
            </Text>
            {!!c.context && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, fontFamily: F.regular, marginTop: 3 }} numberOfLines={2}>{c.context}</Text>}
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: F.semibold, marginTop: 6 }}>{shortAgo(n.created_at)}</Text>
          </View>

          {thumb && isVideo(thumb) ? (
            <View style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={18} color="#ddd" />
            </View>
          ) : thumb ? (
            <Image source={{ uri: thumb }} style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: '#1a1a1a' }} />
          ) : null}

          {unread && <View style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

/** Ce qui attend une réponse (demandes d'ami, défis reçus) : en tête, bien visible. */
function ActionCard({ icon, title, sub, button, faces, onPress }: { icon: any; title: string; sub?: string; button: string; faces?: { id: string; full_name: string; avatar_url: string | null }[]; onPress: () => void }) {
  return (
    <GlassCard radius={28} style={{ marginBottom: 12 }}>
      <View style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={icon} size={13} color="rgba(255,255,255,0.55)" />
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>À TRAITER</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 20, fontFamily: F.black, letterSpacing: -0.4, marginTop: 8 }}>{title}</Text>
        {!!sub && <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 20, fontFamily: F.regular, marginTop: 3 }}>{sub}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          {faces && faces.length > 0 ? <Faces people={faces} size={34} /> : <View />}
          <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ height: 42, borderRadius: 21, paddingHorizontal: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>{button}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GlassCard>
  );
}

export function ActivityScreen({ currentUserId, backdropUrl, onClose, onViewProfile, onOpenFriends, onDuoReply }: {
  currentUserId: string | null;
  /** Ta photo de profil, pour le fond de verre. */
  backdropUrl?: string | null;
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
  // Ce qui attend une réponse : demandes d'ami reçues et défis reçus.
  const [requests, setRequests] = useState<{ id: string; full_name: string; avatar_url: string | null }[]>([]);
  const [duelInvites, setDuelInvites] = useState<Duel[]>([]);
  // Change à chaque tirage vers le bas : la régularité du cercle se recalcule.
  const [rhythmKey, setRhythmKey] = useState(0);

  const load = async (silent = false) => {
    if (!currentUserId) return;
    if (silent) setRhythmKey(k => k + 1);
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, created_at, read_at, actor_id, update_id, comment_id, objective_id, emoji, preview, actor:users!notifications_actor_id_fkey(full_name, avatar_url), updates(photo_url, objectives(emoji, title)), objectives(emoji, title)')
      .eq('recipient_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(60);
    if (!error && data) {
      const rows = data as unknown as Row[];
      // Visages et vignettes de 44 pt : versions réduites, mises en mémoire.
      const [avatars, thumbs] = await Promise.all([
        signAvatars(rows.map(r => r.actor?.avatar_url)),
        signMany(rows.map(r => r.updates?.photo_url), { width: 200 }),
      ]);
      rows.forEach(r => {
        if (r.actor?.avatar_url) r.actor.avatar_url = avatars[r.actor.avatar_url] ?? null;
        if (r.updates?.photo_url) r.updates.photo_url = thumbs[r.updates.photo_url] ?? null;
      });
      // Jours d'entraînement des nouveaux objectifs : requête à part, ignorée tant que la base ne les connaît pas.
      const objIds = [...new Set(rows.filter(r => r.type === 'new_objective' && r.objective_id).map(r => r.objective_id as string))];
      if (objIds.length > 0) {
        const { data: days } = await supabase.from('objectives').select('id, training_days').in('id', objIds);
        const byId = new Map((days || []).map((d: any) => [d.id, d.training_days as number[] | null]));
        rows.forEach(r => { if (r.type === 'new_objective' && r.objectives && r.objective_id) r.objectives.training_days = byId.get(r.objective_id) ?? null; });
      }
      // Les demandes d'ami et les invitations de défi vivent en tête de page (« À traiter »), tant qu'elles
      // attendent une réponse : on ne les répète pas dans la liste.
      setItems(rows.filter(r => r.type !== 'friend_request' && r.type !== 'challenge_invite'));
      const [pend, duels] = await Promise.all([
        supabase.from('friendships')
          .select('requester:users!friendships_requester_id_fkey(id, full_name, avatar_url)')
          .eq('receiver_id', currentUserId).eq('status', 'pending'),
        loadDuels(),
      ]);
      const reqs = ((pend.data || []) as any[]).map(f => f.requester).filter(Boolean);
      const signed = await signAvatars(reqs.map((r: any) => r.avatar_url));
      setRequests(reqs.map((r: any) => ({ id: r.id, full_name: r.full_name, avatar_url: r.avatar_url ? signed[r.avatar_url] ?? null : null })));
      setDuelInvites((duels || []).filter(d => d.status === 'pending' && !d.sentByMe));
      // Ouvrir le fil vaut lecture : la pastille rouge du cœur disparaît.
      if (rows.some(r => !r.read_at)) {
        supabase.from('notifications').update({ read_at: new Date().toISOString() })
          .eq('recipient_id', currentUserId).is('read_at', null).then(() => {});
        setAppBadge(0);
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

  // Regroupe les réactions d'un même post, puis aplatit la liste avec des intertitres « Aujourd'hui / Cette semaine / Plus tôt ».
  const entries = groupRows(items);
  const rows: ({ kind: 'section'; title: string } | { kind: 'entry'; e: Entry })[] = [];
  let current = '';
  entries.forEach(e => {
    const sec = sectionOf(e.rows[0].created_at);
    if (sec !== current) { rows.push({ kind: 'section', title: sec }); current = sec; }
    rows.push({ kind: 'entry', e });
  });
  const fresh = items.filter(n => !n.read_at).length;
  const nothing = entries.length === 0 && requests.length === 0 && duelInvites.length === 0;

  const top = (
    <View>
      <View style={{ paddingTop: 4, paddingBottom: 18 }}>
        <Text style={{ color: '#fff', fontSize: 36, fontFamily: F.black, letterSpacing: -1.2 }}>Activité</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, fontFamily: F.regular, marginTop: 4 }}>
          {requests.length + duelInvites.length > 0 ? `${requests.length + duelInvites.length} à traiter` : fresh > 0 ? `${fresh} nouveauté${fresh > 1 ? 's' : ''}` : 'Tout est à jour'}
        </Text>
      </View>
      {requests.length > 0 && (
        <ActionCard
          icon="person-add"
          title={requests.length === 1 ? `${requests[0].full_name} veut te rejoindre` : `${requests.length} demandes d'ami`}
          sub={requests.length === 1 ? 'Accepte pour suivre ses progrès, et lui les tiens.' : whoLabel(requests.map(r => ({ actor: { full_name: r.full_name } } as Row))).text}
          button="Voir"
          faces={requests}
          onPress={onOpenFriends}
        />
      )}
      {duelInvites.map(d => (
        <ActionCard
          key={d.id}
          icon="flash"
          title={`${d.otherName.split(' ')[0]} te défie ⚔️`}
          sub="Un duel d'une semaine : qui s'entraîne sur le plus de jours ?"
          button="Répondre"
          faces={[{ id: d.otherId, full_name: d.otherName, avatar_url: d.otherAvatar }]}
          onPress={() => onViewProfile(d.otherId)}
        />
      ))}
      <CircleRhythmCard onOpenProfile={onViewProfile} reloadKey={rhythmKey} />
    </View>
  );

  return (
    <View style={s.container}>
      <GlassBackdrop avatarUrl={backdropUrl ?? null} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingTop: insets.top + 8, paddingBottom: 8 }}>
        <GlassIconButton icon="chevron-back" label="Retour" onPress={onClose} />
        {openingPost && <ActivityIndicator color="#fff" size="small" />}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => (r.kind === 'section' ? `s-${r.title}` : r.e.key) + i}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 48 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(true); setRefreshing(false); }} tintColor="#fff" colors={['#fff']} progressBackgroundColor="#1a1a1a" />}
          ListHeaderComponent={top}
          ListEmptyComponent={nothing ? (
            <GlassCard radius={28} style={{ marginTop: 6 }}>
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 20, fontFamily: F.black }}>Rien pour l'instant</Text>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' }}>
                  Les réactions, commentaires et posts de ton cercle s'afficheront ici.
                </Text>
              </View>
            </GlassCard>
          ) : null}
          renderItem={({ item: r }) => {
            if (r.kind === 'section') {
              return <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: F.bold, letterSpacing: 1.5, marginTop: 22, marginBottom: 12 }}>{r.title.toUpperCase()}</Text>;
            }
            const n = r.e.rows[0];
            return <ActivityRow e={r.e} onPress={() => onPressItem(n)} onAvatar={() => n.actor_id && onViewProfile(n.actor_id)} />;
          }}
        />
      )}
    </View>
  );
}
