import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';

const UPDATES = [
  {
    id: '1',
    name: 'Karim',
    initial: 'K',
    time: 'Il y a 23 min',
    goal: '🏃 Courir 10 km',
    progress: 64,
    progressLabel: '6,4 km',
    caption: 'Entraînement matinal 🌅',
    likes: 13, fire: 5, muscle: 3, comments: 2,
    isPrivate: false,
  },
  {
    id: '2',
    name: 'Sofia',
    initial: 'S',
    time: 'Il y a 1h',
    goal: '💪 Perdre 10 kg',
    progress: 40,
    progressLabel: '4 kg',
    caption: 'Meal prep de la semaine 🥗',
    likes: 8, fire: 12, muscle: 7, comments: 4,
    isPrivate: false,
  },
  {
    id: '3',
    name: 'Lucas',
    initial: 'L',
    time: 'Il y a 3h',
    goal: '💰 Gagner 10 000€',
    progress: 28,
    progressLabel: '2 800€',
    caption: '',
    likes: 6, fire: 9, muscle: 0, comments: 1,
    isPrivate: true,
  },
];

export default function Feed({ onPost }: { onPost: () => void }) {
  const [reactions, setReactions] = useState<{[key: string]: {likes: boolean, fire: boolean, muscle: boolean}}>({});

  const toggleReaction = (id: string, type: 'likes' | 'fire' | 'muscle') => {
    setReactions(prev => ({
      ...prev,
      [id]: { ...prev[id], [type]: !prev[id]?.[type] }
    }));
  };

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <Image
          source={require('./assets/ecriture-reiz-blanc.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerRight}>
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 8j</Text>
          </View>
          <View style={styles.iconBtn}>
            <Text style={styles.iconText}>🔔</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.friendsBar}>
        {[
          { initial: 'Toi', posted: true },
          { initial: 'K', posted: true },
          { initial: 'S', posted: true },
          { initial: 'L', posted: false },
          { initial: 'M', posted: false },
        ].map((f, i) => (
          <View key={i} style={styles.friendItem}>
            <View style={[styles.friendAv, f.posted ? styles.friendAvActive : styles.friendAvInactive]}>
              <Text style={styles.friendAvText}>{f.initial}</Text>
            </View>
            <Text style={[styles.friendName, f.posted && styles.friendNameActive]}>
              {f.initial}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.tabs}>
        <Text style={[styles.tab, styles.tabActive]}>Feed</Text>
        <Text style={styles.tab}>Mes objectifs</Text>
        <Text style={styles.tab}>Amis</Text>
      </View>

      <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>

        <View style={styles.myUpdate}>
          <View style={styles.myAv}>
            <Text style={styles.myAvText}>Y</Text>
          </View>
          <View style={styles.myUpdateInfo}>
            <Text style={styles.myUpdateTitle}>Ta mise à jour du jour ✓</Text>
            <Text style={styles.myUpdateSub}>🏃 7,2 km · Il y a 2 min · <Text style={styles.streakInline}>8j 🔥</Text></Text>
          </View>
          <View style={styles.postedBadge}>
            <Text style={styles.postedBadgeText}>Publié</Text>
          </View>
        </View>

        {UPDATES.map((u) => (
          <View key={u.id} style={[styles.card, u.isPrivate && styles.cardPrivate]}>
            {u.isPrivate && (
              <View style={styles.privBadge}>
                <Text style={styles.privBadgeText}>PRIVÉ</Text>
              </View>
            )}
            <View style={styles.cardHeader}>
              <View style={styles.av}>
                <Text style={styles.avText}>{u.initial}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.cardName}>{u.name}</Text>
                <Text style={styles.cardTime}>{u.time}</Text>
              </View>
            </View>
            <View style={styles.goalRow}>
              <View style={styles.goalPill}>
                <Text style={styles.goalPillText}>{u.goal}</Text>
              </View>
            </View>
            <View style={styles.progressRow}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${u.progress}%` as any }]} />
              </View>
              <Text style={styles.progressLabel}>{u.progressLabel}</Text>
            </View>
            {u.caption ? (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoCaption}>{u.caption}</Text>
              </View>
            ) : null}
            <View style={styles.reactionsRow}>
              <TouchableOpacity
                style={[styles.rxn, reactions[u.id]?.likes && styles.rxnActive]}
                onPress={() => toggleReaction(u.id, 'likes')}
              >
                <Text style={styles.rxnEmoji}>❤️</Text>
                <Text style={styles.rxnCount}>{u.likes + (reactions[u.id]?.likes ? 1 : 0)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rxn, reactions[u.id]?.fire && styles.rxnActive]}
                onPress={() => toggleReaction(u.id, 'fire')}
              >
                <Text style={styles.rxnEmoji}>🔥</Text>
                <Text style={styles.rxnCount}>{u.fire + (reactions[u.id]?.fire ? 1 : 0)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rxn, reactions[u.id]?.muscle && styles.rxnActive]}
                onPress={() => toggleReaction(u.id, 'muscle')}
              >
                <Text style={styles.rxnEmoji}>💪</Text>
                <Text style={styles.rxnCount}>{u.muscle + (reactions[u.id]?.muscle ? 1 : 0)}</Text>
              </TouchableOpacity>
              <Text style={styles.commentsLink}>{u.comments} commentaires</Text>
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={onPost}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>⊞</Text>
          <View style={styles.navDot} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>◎</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>👥</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  headerLogo: { width: 80, height: 28 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakBadge: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  streakText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 14 },
  friendsBar: { paddingHorizontal: 16, paddingVertical: 8, flexGrow: 0 },
  friendItem: { alignItems: 'center', marginRight: 14 },
  friendAv: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  friendAvActive: { backgroundColor: '#2a2a2a', borderWidth: 2, borderColor: '#fff' },
  friendAvInactive: { backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#2a2a2a' },
  friendAvText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  friendName: { fontSize: 10, color: '#555', fontWeight: '600' },
  friendNameActive: { color: '#888' },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tab: { flex: 1, textAlign: 'center', paddingVertical: 10, fontSize: 12, fontWeight: '700', color: '#555' },
  tabActive: { color: '#fff', borderBottomWidth: 2, borderBottomColor: '#fff' },
  feed: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  myUpdate: { backgroundColor: '#141414', borderWidth: 1.5, borderColor: '#fff', borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  myAv: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  myAvText: { fontSize: 14, fontWeight: '800', color: '#000' },
  myUpdateInfo: { flex: 1 },
  myUpdateTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },
  myUpdateSub: { fontSize: 11, color: '#888', marginTop: 2 },
  streakInline: { color: '#fff', fontWeight: '700' },
  postedBadge: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  postedBadgeText: { fontSize: 10, fontWeight: '800', color: '#000' },
  card: { backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 20, marginBottom: 12, overflow: 'hidden' },
  cardPrivate: { borderColor: '#333' },
  privBadge: { position: 'absolute', top: 0, left: 16, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, zIndex: 1 },
  privBadgeText: { fontSize: 9, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 0 },
  av: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  cardMeta: { flex: 1 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cardTime: { fontSize: 11, color: '#555', marginTop: 1 },
  goalRow: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  goalPill: { backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#2a2a2a' },
  goalPillText: { fontSize: 11, color: '#888', fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  progressBg: { flex: 1, height: 3, backgroundColor: '#222', borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: '#666' },
  photoPlaceholder: { marginHorizontal: 14, marginBottom: 10, backgroundColor: '#1a1a1a', borderRadius: 14, height: 90, alignItems: 'center', justifyContent: 'center' },
  photoCaption: { fontSize: 11, color: '#555', fontWeight: '500' },
  reactionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  rxn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#252525' },
  rxnActive: { backgroundColor: '#252525', borderColor: '#333' },
  rxnEmoji: { fontSize: 12 },
  rxnCount: { fontSize: 12, color: '#666', fontWeight: '700' },
  commentsLink: { fontSize: 12, color: '#444', marginLeft: 'auto' },
  fab: { position: 'absolute', bottom: 80, right: 16, width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  fabText: { fontSize: 28, color: '#000', fontWeight: '300', lineHeight: 34 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 64, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#141414', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  navItem: { alignItems: 'center', padding: 8 },
  navIcon: { fontSize: 20, color: '#444' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff', marginTop: 3 },
});