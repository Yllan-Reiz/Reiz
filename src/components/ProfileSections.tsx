import { View, Text, TouchableOpacity, ScrollView, Image, Alert, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Update, Objective } from '../lib/types';
import { isVideo } from '../lib/storage';
import { GUTTER } from '../constants';
import { s, F } from '../styles';

// ============================================================
// Badges : calculés à partir des posts et objectifs, rien en base.
// Le même calcul tourne sur ton profil et sur celui de tes amis, donc
// ton cercle voit exactement les mêmes badges que toi.
// ============================================================

export type Badge = { id: string; emoji: string; title: string; desc: string; earned: boolean; progress?: string };

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Plus longue série de jours consécutifs avec au moins un post. */
export function bestStreak(posts: Update[]): number {
  const days = [...new Set(posts.map(p => dayKey(p.created_at)))].sort();
  let best = 0, run = 0, prev: Date | null = null;
  days.forEach(k => {
    const d = new Date(`${k}T12:00:00`);
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  });
  return best;
}

export const isCompleted = (o: Objective & { is_completed?: boolean | null }) =>
  !!o.is_completed || (o.target_value > 0 && o.current_value >= o.target_value);

export function computeBadges(posts: Update[], objectives: Objective[]): Badge[] {
  const n = posts.length;
  const streak = bestStreak(posts);
  const hour = (p: Update) => new Date(p.created_at).getHours();
  const early = posts.filter(p => hour(p) < 8).length;
  const night = posts.filter(p => hour(p) >= 22).length;
  const videos = posts.filter(p => isVideo(p.photo_url)).length;
  const done = objectives.filter(isCompleted).length;
  const duos = posts.filter(p => (p.with_user_ids || []).length > 0).length;
  const of = (v: number, goal: number, unit = '') => `${Math.min(v, goal)}/${goal}${unit}`;
  return [
    { id: 'first', emoji: '🌱', title: 'Premier pas', desc: 'Publier ta première progression.', earned: n >= 1 },
    { id: 's3', emoji: '🔥', title: 'En feu', desc: 'Poster 3 jours d\'affilée.', earned: streak >= 3, progress: of(streak, 3, ' j') },
    { id: 's7', emoji: '⚡', title: 'Semaine parfaite', desc: 'Poster 7 jours d\'affilée.', earned: streak >= 7, progress: of(streak, 7, ' j') },
    { id: 'goal', emoji: '🏆', title: 'Objectif atteint', desc: 'Atteindre la cible d\'un objectif.', earned: done >= 1 },
    { id: 'p10', emoji: '📸', title: 'Régulier', desc: '10 publications.', earned: n >= 10, progress: of(n, 10) },
    { id: 'video', emoji: '🎬', title: 'En action', desc: 'Publier une vidéo de ta séance.', earned: videos >= 1 },
    { id: 'duo', emoji: '🤝', title: 'En duo', desc: 'Publier une séance avec un ami identifié.', earned: duos >= 1 },
    { id: 'duo5', emoji: '👯', title: 'Binôme', desc: '5 séances en duo.', earned: duos >= 5, progress: of(duos, 5) },
    { id: 'early', emoji: '🌅', title: 'Lève-tôt', desc: '5 posts avant 8 h du matin.', earned: early >= 5, progress: of(early, 5) },
    { id: 'night', emoji: '🌙', title: 'Couche-tard', desc: '5 posts après 22 h.', earned: night >= 5, progress: of(night, 5) },
    { id: 's30', emoji: '👑', title: 'Inarrêtable', desc: 'Poster 30 jours d\'affilée.', earned: streak >= 30, progress: of(streak, 30, ' j') },
    { id: 'p50', emoji: '💯', title: 'Acharné', desc: '50 publications.', earned: n >= 50, progress: of(n, 50) },
  ];
}

/** Bandeau de badges. Sur ton profil, les badges à débloquer sont grisés ; chez un ami, seuls les gagnés s'affichent. */
export function BadgesStrip({ badges, own }: { badges: Badge[]; own: boolean }) {
  const earned = badges.filter(b => b.earned);
  const shown = own ? [...earned, ...badges.filter(b => !b.earned)] : earned;
  return (
    <View>
      <Text style={s.sectionTitle}>BADGES ({earned.length}/{badges.length})</Text>
      {shown.length === 0 ? (
        <Text style={{ color: '#777', fontSize: 13, marginBottom: 8 }}>Pas encore de badge.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: GUTTER }}>
          {shown.map(b => (
            <TouchableOpacity
              key={b.id}
              activeOpacity={0.7}
              style={{ width: 68, alignItems: 'center', opacity: b.earned ? 1 : 0.35 }}
              onPress={() => Alert.alert(`${b.emoji} ${b.title}`, b.earned ? `${b.desc}\nDébloqué !` : `${b.desc}${b.progress ? `\nOù tu en es : ${b.progress}` : ''}`)}
              accessibilityLabel={`${b.title}, ${b.earned ? 'débloqué' : 'à débloquer'}`}
            >
              <View style={{
                width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
                backgroundColor: b.earned ? '#1c1c1c' : '#111', borderWidth: 1.5, borderColor: b.earned ? '#3a3a3a' : '#1c1c1c',
              }}>
                <Text style={{ fontSize: 26 }}>{b.emoji}</Text>
              </View>
              <Text numberOfLines={2} style={{ color: b.earned ? '#ddd' : '#777', fontSize: 10, fontFamily: F.bold, textAlign: 'center', marginTop: 6 }}>{b.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================
// Vignettes de posts (épinglés + historique)
// ============================================================

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function PostTile({ p, width, height, onPress, showPin }: { p: Update; width: number; height: number; onPress: () => void; showPin?: boolean }) {
  const video = isVideo(p.photo_url);
  const emoji = p.objectives?.emoji || '🎯';
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={{ width, height, borderRadius: 10, overflow: 'hidden', backgroundColor: '#141414' }}>
      {p.photo_url && !video ? (
        <Image source={{ uri: p.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        // Vidéo ou post sans média : tuile sombre avec l'emoji de l'objectif.
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6 }}>
          <Text style={{ fontSize: 26 }}>{emoji}</Text>
          {!video && (
            <Text numberOfLines={2} style={{ color: '#999', fontSize: 10, textAlign: 'center', marginTop: 4 }}>{p.caption}</Text>
          )}
        </View>
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, justifyContent: 'flex-end', padding: 5 }} pointerEvents="none">
        <Text style={{ color: '#fff', fontSize: 9, fontFamily: F.bold }}>{shortDate(p.created_at)}</Text>
      </LinearGradient>
      {video && (
        <View style={{ position: 'absolute', top: 6, right: 6 }} pointerEvents="none">
          <Ionicons name="play" size={14} color="#fff" />
        </View>
      )}
      {showPin && (
        <View style={{ position: 'absolute', top: 6, left: 6 }} pointerEvents="none">
          <Ionicons name="pin" size={13} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Jusqu'à 3 posts mis en avant par leur auteur. */
export function PinnedRow({ posts, onOpen }: { posts: Update[]; onOpen: (p: Update) => void }) {
  const { width } = useWindowDimensions();
  const pinned = posts.filter(p => p.pinned_at).sort((a, b) => (b.pinned_at! > a.pinned_at! ? 1 : -1));
  if (pinned.length === 0) return null;
  const tileW = (width - GUTTER * 2 - 16) / 3;
  return (
    <View>
      <Text style={s.sectionTitle}>ÉPINGLÉS</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {pinned.map(p => <PostTile key={p.id} p={p} width={tileW} height={tileW * 1.33} onPress={() => onOpen(p)} showPin />)}
      </View>
    </View>
  );
}

/** Historique complet en grille de 3, du plus récent au plus ancien. */
export function PostsGrid({ posts, onOpen, emptyText }: { posts: Update[]; onOpen: (p: Update) => void; emptyText: string }) {
  const { width } = useWindowDimensions();
  const gap = 3;
  const tile = (width - GUTTER * 2 - gap * 2) / 3;
  return (
    <View>
      <Text style={s.sectionTitle}>HISTORIQUE ({posts.length})</Text>
      {posts.length === 0 ? (
        <Text style={{ color: '#777', fontSize: 13, paddingVertical: 12 }}>{emptyText}</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
          {posts.map(p => <PostTile key={p.id} p={p} width={tile} height={tile} onPress={() => onOpen(p)} />)}
        </View>
      )}
    </View>
  );
}
