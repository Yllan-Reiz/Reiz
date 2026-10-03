import { useState, useEffect, useMemo, useRef, Children, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, Platform, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Update, Objective } from '../lib/types';
import { isVideo } from '../lib/storage';
import { GUTTER, dayKeysFor } from '../constants';
import { BADGE_IMAGES } from '../lib/badgeImages';
import { GlassSurface } from './GlassSurface';
import { DuoStats } from '../lib/duo';
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
export function BadgesStrip({ badges, own, grid, noTitle }: { badges: Badge[]; own: boolean; grid?: boolean; noTitle?: boolean }) {
  const [open, setOpen] = useState<Badge | null>(null);
  const earned = badges.filter(b => b.earned);
  const shown = own ? [...earned, ...badges.filter(b => !b.earned)] : earned;
  return (
    <View>
      {!noTitle && <Text style={s.sectionTitle}>BADGES ({earned.length}/{badges.length})</Text>}
      {shown.length === 0 ? (
        <Text style={{ color: '#777', fontSize: 13, marginBottom: 8 }}>Pas encore de badge.</Text>
      ) : grid ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
          {shown.map(b => (
            <TouchableOpacity key={b.id} activeOpacity={0.7} style={{ width: '33.33%', alignItems: 'center' }} onPress={() => setOpen(b)}
              accessibilityLabel={`${b.title}, ${b.earned ? 'débloqué' : 'à débloquer'}`}>
              <Image source={BADGE_IMAGES[b.id]} style={{ width: 92, height: 92, opacity: b.earned ? 1 : 0.22 }} resizeMode="contain" />
              <Text numberOfLines={2} style={{ color: b.earned ? '#ddd' : '#666', fontSize: 11, fontFamily: F.bold, textAlign: 'center', marginTop: 2 }}>{b.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: GUTTER }}>
          {shown.map(b => (
            <TouchableOpacity
              key={b.id}
              activeOpacity={0.7}
              style={{ width: 76, alignItems: 'center' }}
              onPress={() => setOpen(b)}
              accessibilityLabel={`${b.title}, ${b.earned ? 'débloqué' : 'à débloquer'}`}
            >
              <Image source={BADGE_IMAGES[b.id]} style={{ width: 72, height: 72, opacity: b.earned ? 1 : 0.22 }} resizeMode="contain" />
              <Text numberOfLines={2} style={{ color: b.earned ? '#ddd' : '#666', fontSize: 10, fontFamily: F.bold, textAlign: 'center', marginTop: 2 }}>{b.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <BadgeDetail badge={open} onClose={() => setOpen(null)} />
    </View>
  );
}

/** Fiche d'un badge : grand visuel, ce qu'il faut faire, et où tu en es. */
function BadgeDetail({ badge, onClose }: { badge: Badge | null; onClose: () => void }) {
  if (!badge) return null;
  const m = badge.progress?.match(/^(\d+(?:[.,]\d+)?)\/(\d+)/);
  const ratio = badge.earned ? 1 : m ? Math.min(1, Number(m[1].replace(',', '.')) / Number(m[2])) : 0;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 340, backgroundColor: '#111', borderRadius: 28, borderWidth: 1, borderColor: '#1f1f1f', alignItems: 'center', padding: 24 }}>
          <Image source={BADGE_IMAGES[badge.id]} style={{ width: 170, height: 170, opacity: badge.earned ? 1 : 0.3 }} resizeMode="contain" />
          <Text style={{ color: '#fff', fontSize: 22, fontFamily: F.black, letterSpacing: -0.5, marginTop: 6 }}>{badge.title}</Text>
          <Text style={{ color: '#aaa', fontSize: 14, fontFamily: F.regular, textAlign: 'center', lineHeight: 21, marginTop: 8 }}>{badge.desc}</Text>
          <View style={{ width: '100%', height: 8, borderRadius: 4, backgroundColor: '#222', marginTop: 20, overflow: 'hidden' }}>
            <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: '#fff', borderRadius: 4 }} />
          </View>
          <Text style={{ color: badge.earned ? '#fff' : '#888', fontSize: 13, fontFamily: F.semibold, marginTop: 10 }}>
            {badge.earned ? 'Débloqué' : badge.progress ? `Où tu en es : ${badge.progress}` : 'À débloquer'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ============================================================
// Briques communes à ton profil et à celui de tes amis : tout le monde a le même.
// DA : iOS 26 Liquid Glass. Photo plein écran, bulles de verre, cartes qui se chevauchent.
// ============================================================

/** Photo de profil en plein écran, légèrement floutée, fondue vers le noir en bas. */
export function ProfileHeroPhoto({ avatarUrl, height, children }: { avatarUrl: string | null; height: number; children?: React.ReactNode }) {
  return (
    <View style={{ height, justifyContent: 'flex-end', alignItems: 'center' }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {avatarUrl
          ? <Image source={{ uri: avatarUrl }} blurRadius={Platform.OS === 'ios' ? 9 : 5} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <LinearGradient colors={['#3a3a3a', '#141414']} style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={['rgba(10,10,10,0.7)', 'rgba(10,10,10,0)']} locations={[0, 0.28]} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(10,10,10,0)', 'rgba(10,10,10,0.55)', '#0a0a0a']} locations={[0.38, 0.72, 1]} style={StyleSheet.absoluteFill} />
      </View>
      {children}
    </View>
  );
}

/** Rond de verre avec une icône (réglages, retour, menu, appareil photo). */
export function GlassIconButton({ icon, onPress, label, style }: { icon: any; onPress: () => void; label: string; style?: any }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityLabel={label} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={style}>
      <GlassSurface radius={20} variant="clear" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color="#fff" />
      </GlassSurface>
    </TouchableOpacity>
  );
}

/** Une seule bulle de verre à trois zones (comme « Going / Not Going / Maybe ») : série, posts, amis. */
export function StatBubble({ items }: { items: { value: string; label: string; onPress?: () => void }[] }) {
  return (
    <GlassSurface radius={26} style={{ alignSelf: 'stretch', marginHorizontal: GUTTER, marginTop: 22 }}>
      <View style={{ flexDirection: 'row', paddingVertical: 14 }}>
        {items.map((x, i) => (
          <TouchableOpacity key={x.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: 'rgba(255,255,255,0.16)' }} activeOpacity={x.onPress ? 0.7 : 1} onPress={x.onPress} disabled={!x.onPress}>
            <Text style={{ fontSize: 22, fontFamily: F.black, color: '#fff' }}>{x.value}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontFamily: F.bold, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>{x.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </GlassSurface>
  );
}

export function CountPill({ n }: { n: number }) {
  return (
    <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 11, minWidth: 24, height: 22, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 12, fontFamily: F.bold }}>{n}</Text>
    </View>
  );
}

/** Titre de section avec sa pastille de compteur (« Badges 8 »). */
export function SectionHeader({ title, count, style }: { title: string; count?: number; style?: any }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }, style]}>
      <Text style={{ color: '#fff', fontSize: 18, fontFamily: F.bold }}>{title}</Text>
      {count !== undefined && <CountPill n={count} />}
    </View>
  );
}

/** Bulle « À propos » : texte centré dans une carte de verre. */
export function AboutBubble({ children }: { children: React.ReactNode }) {
  return (
    <GlassSurface radius={28} style={{ marginHorizontal: GUTTER, marginTop: 14 }}>
      <View style={{ padding: 18, alignItems: 'center' }}>{children}</View>
    </GlassSurface>
  );
}

/**
 * « Vous deux » : le binôme d'entraînement avec cet ami. Duos validés, série de semaines
 * d'affilée, dernier duo, et un bouton pour en lancer un tout de suite.
 */
export function DuoBubble({ name, stats, onInvite }: { name: string; stats: DuoStats | null; onInvite: () => void }) {
  if (!stats) return null;
  const none = stats.validated === 0;
  const last = stats.last ? new Date(stats.last).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
  return (
    <GlassSurface radius={28} style={{ marginHorizontal: GUTTER, marginTop: 14 }}>
      <View style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: F.bold, letterSpacing: 1.5 }}>🤝  VOUS DEUX</Text>
          {stats.weeks > 0 && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, paddingHorizontal: 10, height: 26, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 12, fontFamily: F.bold }}>🔥 {stats.weeks} {stats.weeks > 1 ? 'semaines' : 'semaine'} d'affilée</Text>
            </View>
          )}
        </View>
        {none ? (
          <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22, fontFamily: F.regular, marginTop: 10 }}>
            Pas encore de duo avec {name}. Lancez le premier : entraînez-vous ensemble et postez chacun votre séance à moins d'une heure d'écart pour le valider.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: '#fff', fontSize: 40, fontFamily: F.black, letterSpacing: -1.2 }}>
              {stats.validated}<Text style={{ fontSize: 16, fontFamily: F.semibold, color: 'rgba(255,255,255,0.65)', letterSpacing: 0 }}>{stats.validated > 1 ? '  duos validés' : '  duo validé'}</Text>
            </Text>
            {!!last && <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: F.semibold, marginBottom: 7 }}>Dernier le {last}</Text>}
          </View>
        )}
        <TouchableOpacity onPress={onInvite} activeOpacity={0.85} style={{ backgroundColor: '#fff', borderRadius: 16, paddingVertical: 13, alignItems: 'center', marginTop: 14 }}>
          <Text style={{ color: '#000', fontSize: 14, fontFamily: F.extrabold }}>{none ? `Proposer un duo à ${name}` : `Un nouveau duo avec ${name}`}</Text>
        </TouchableOpacity>
      </View>
    </GlassSurface>
  );
}

/**
 * Rangée de badges (comme « Collections 8 ») : les badges gagnés d'abord, puis un rond
 * de verre « > » qui ouvre la collection complète.
 */
export function BadgesSection({ badges, own }: { badges: Badge[]; own: boolean }) {
  const [all, setAll] = useState(false);
  const insets = useSafeAreaInsets();
  const earned = badges.filter(b => b.earned);
  const row = own ? [...earned, ...badges.filter(b => !b.earned)] : earned;
  return (
    <View style={{ marginTop: 26 }}>
      <SectionHeader title="Badges" count={earned.length} style={{ paddingHorizontal: GUTTER }} />
      {row.length === 0 ? (
        <Text style={{ color: '#777', fontSize: 13, paddingHorizontal: GUTTER }}>Pas encore de badge.</Text>
      ) : (
        <BadgesStripRow badges={row} onAll={() => setAll(true)} />
      )}
      <Modal visible={all} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setAll(false)}>
        <View style={{ flex: 1, backgroundColor: '#0a0a0a', paddingTop: insets.top }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, justifyContent: 'space-between' }}>
            <Text style={{ color: '#fff', fontSize: 22, fontFamily: F.black }}>Badges {earned.length}/{badges.length}</Text>
            <GlassIconButton icon="close" label="Fermer" onPress={() => setAll(false)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: GUTTER, paddingBottom: insets.bottom + 40 }}>
            <BadgesStrip badges={badges} own={own} grid noTitle />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function BadgesStripRow({ badges, onAll }: { badges: Badge[]; onAll: () => void }) {
  const [open, setOpen] = useState<Badge | null>(null);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: GUTTER, alignItems: 'center' }}>
        {badges.map(b => (
          <TouchableOpacity key={b.id} activeOpacity={0.75} onPress={() => setOpen(b)} accessibilityLabel={`${b.title}, ${b.earned ? 'débloqué' : 'à débloquer'}`}>
            <Image source={BADGE_IMAGES[b.id]} style={{ width: 72, height: 72, opacity: b.earned ? 1 : 0.22 }} resizeMode="contain" />
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={onAll} activeOpacity={0.8} accessibilityLabel="Voir tous les badges">
          <GlassSurface radius={32} style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </GlassSurface>
        </TouchableOpacity>
      </ScrollView>
      <BadgeDetail badge={open} onClose={() => setOpen(null)} />
    </>
  );
}

/**
 * Carrousel « apesanteur » : les cartes se chevauchent et réagissent au défilement.
 *  1. Profondeur : la carte au bord est droite, celles qui arrivent sont inclinées et plus
 *     basses, celles qui partent se redressent, avec un léger zoom.
 *  2. Inertie : en balayant vite, les cartes se balancent dans le sens du mouvement puis
 *     reviennent doucement, comme suspendues.
 *  3. Flottement : au repos, chaque carte monte et descend très légèrement, en décalé.
 * Tout passe par le pilote natif : aucune saccade, même sur un profil chargé.
 */
function FloatyCarousel({ cardW, overlap, paddingTop, paddingBottom, children }: {
  cardW: number; overlap: number; paddingTop: number; paddingBottom: number; children: ReactNode;
}) {
  const step = cardW - overlap;
  const x = useRef(new Animated.Value(0)).current;
  const swing = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const last = useRef({ x: 0, t: Date.now() });

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
    useNativeDriver: true,
    listener: (e: any) => {
      const off = e.nativeEvent.contentOffset.x;
      const now = Date.now();
      const v = (off - last.current.x) / Math.max(now - last.current.t, 1); // px par ms
      last.current = { x: off, t: now };
      // La vitesse donne l'amplitude du balancement, puis un ressort le ramène à zéro.
      swing.setValue(Math.max(-1, Math.min(1, v / 1.6)));
      Animated.spring(swing, { toValue: 0, stiffness: 55, damping: 6, mass: 1, useNativeDriver: true }).start();
    },
  }), [x, swing]);

  const swingRot = swing.interpolate({ inputRange: [-1, 1], outputRange: ['7deg', '-7deg'] });
  const cards = Children.toArray(children);

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      decelerationRate="fast"
      snapToInterval={step}
      snapToAlignment="start"
      contentContainerStyle={{ paddingLeft: GUTTER, paddingRight: GUTTER + 40, paddingTop, paddingBottom }}
      style={{ overflow: 'visible' }}
    >
      {cards.map((card, i) => {
        const range = [(i - 2) * step, (i - 1) * step, i * step, (i + 1) * step];
        const rotate = x.interpolate({ inputRange: range, outputRange: ['-6deg', '-4deg', '0deg', '5deg'], extrapolate: 'clamp' });
        const lift = x.interpolate({ inputRange: range, outputRange: [30, 26, 0, 14], extrapolate: 'clamp' });
        const scale = x.interpolate({ inputRange: range, outputRange: [0.96, 0.98, 1, 0.95], extrapolate: 'clamp' });
        const float = bob.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [3, -3] : [-3, 3] });
        return (
          <Animated.View
            key={i}
            style={{ width: cardW, marginLeft: i ? -overlap : 0, zIndex: i, transform: [{ translateY: lift }, { translateY: float }, { scale }, { rotate }, { rotate: swingRot }] }}
          >
            {card}
          </Animated.View>
        );
      })}
    </Animated.ScrollView>
  );
}

/**
 * Objectifs en cours : des cartes de verre qui se chevauchent, la suivante inclinée,
 * comme les cartes de la référence. Valeur en haut à gauche, emoji dans un rond de verre
 * en haut à droite, titre en grand en bas.
 */
export function GoalCards({ items, activity, onPress }: {
  items: Objective[]; activity: Record<string, Set<string>>; onPress?: (o: Objective) => void;
}) {
  if (items.length === 0) return null;
  const week = dayKeysFor(7);
  return (
    <FloatyCarousel cardW={236} overlap={30} paddingTop={10} paddingBottom={44}>
      {items.map((o, i) => {
        const pct = o.target_value > 0 ? Math.min(Math.round((o.current_value / o.target_value) * 100), 100) : 0;
        const inPct = o.unit === '%';
        const set = activity[o.id] || new Set<string>();
        const doneWeek = week.filter(d => set.has(d)).length;
        const vis = VIS_ICON[o.visibility] || VIS_ICON.friends;
        return (
          <TouchableOpacity
            key={o.id}
            activeOpacity={onPress ? 0.9 : 1}
            onPress={onPress ? () => onPress(o) : undefined}
            style={{ width: 236, height: 258 }}
          >
            <GlassSurface radius={32} style={{ flex: 1 }}>
              <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: '#fff', fontSize: 24, fontFamily: F.black, letterSpacing: -0.5 }}>{inPct ? `${pct}%` : fmtNum(o.current_value)}{!inPct && <Text style={{ fontSize: 14, fontFamily: F.semibold, color: 'rgba(255,255,255,0.65)' }}>{` / ${fmtNum(o.target_value)}`}</Text>}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: F.semibold, marginTop: 1 }}>{inPct ? 'de l\'objectif' : o.unit}</Text>
                  </View>
                  <GlassSurface radius={26} variant="clear" style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24 }}>{o.emoji}</Text>
                  </GlassSurface>
                </View>
                <View>
                  <Text style={{ color: '#fff', fontSize: 25, fontFamily: F.black, letterSpacing: -0.6, lineHeight: 29 }} numberOfLines={2}>{o.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <Ionicons name={vis.icon} size={12} color="rgba(255,255,255,0.6)" />
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F.semibold }} numberOfLines={1}>{doneWeek} {doneWeek > 1 ? 'jours' : 'jour'} cette semaine</Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 10, overflow: 'hidden' }}>
                    <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#fff', borderRadius: 3 }} />
                  </View>
                </View>
              </View>
            </GlassSurface>
          </TouchableOpacity>
        );
      })}
    </FloatyCarousel>
  );
}

/**
 * Historique des posts : défilement horizontal de cartes photo qui se chevauchent
 * (comme les cartes NFT de la référence). Les épinglés passent en premier.
 */
export function HistoryCarousel({ posts, onOpen, emptyText }: { posts: Update[]; onOpen: (p: Update) => void; emptyText: string }) {
  if (posts.length === 0) return <Text style={{ color: '#777', fontSize: 13, paddingHorizontal: GUTTER }}>{emptyText}</Text>;
  const sorted = [...posts].sort((a, b) => (b.pinned_at ? 1 : 0) - (a.pinned_at ? 1 : 0));
  return (
    <FloatyCarousel cardW={200} overlap={26} paddingTop={8} paddingBottom={36}>
      {sorted.map((p, i) => {
        const video = isVideo(p.photo_url);
        return (
          <TouchableOpacity
            key={p.id}
            activeOpacity={0.9}
            onPress={() => onOpen(p)}
            style={{ width: 200, height: 270 }}
          >
            <GlassSurface radius={30} style={{ flex: 1 }}>
              {p.photo_url && !video
                ? <Image source={{ uri: p.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                : <LinearGradient colors={['#2c2c2c', '#141414']} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    {video ? <Ionicons name="play-circle" size={54} color="rgba(255,255,255,0.8)" /> : <Text style={{ fontSize: 46 }}>{p.objectives?.emoji || '🎯'}</Text>}
                  </LinearGradient>}
              <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <GlassSurface radius={14} variant="clear" style={{ paddingHorizontal: 10, height: 28, justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontFamily: F.bold }}>{shortDate(p.created_at)}</Text>
                </GlassSurface>
                {!!p.pinned_at && (
                  <GlassSurface radius={14} variant="clear" style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="pin" size={13} color="#fff" />
                  </GlassSurface>
                )}
              </View>
              <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontFamily: F.black, letterSpacing: -0.4, lineHeight: 21 }} numberOfLines={2}>{p.caption || p.objectives?.title}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: F.semibold, marginTop: 2 }} numberOfLines={1}>{p.objectives?.emoji} {p.objectives?.title}</Text>
              </View>
            </GlassSurface>
          </TouchableOpacity>
        );
      })}
    </FloatyCarousel>
  );
}

/** Objectifs réussis, en cartes de verre. */
export function AchievedList({ items }: { items: Objective[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <SectionHeader title="Réussis" count={items.length} style={{ marginTop: 4 }} />
      {items.map(o => (
        <GlassSurface key={o.id} radius={22} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <Text style={{ fontSize: 24 }}>{o.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontFamily: F.bold }}>{o.title}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: F.regular }}>{o.target_value} {o.unit} atteints</Text>
            </View>
            <Text style={{ fontSize: 22 }}>🏆</Text>
          </View>
        </GlassSurface>
      ))}
    </View>
  );
}

// ============================================================
// Carte « En cours » du profil : l'objectif d'un coup d'œil
// ============================================================

const VIS_ICON: Record<string, { icon: any; label: string }> = {
  friends: { icon: 'people-outline', label: 'Mon cercle' },
  close: { icon: 'star-outline', label: 'Cercle proche' },
  private: { icon: 'lock-closed-outline', label: 'Moi seul' },
  public: { icon: 'globe-outline', label: 'Public' },
};
const fmtNum = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/**
 * Valeur en grand, jauge épaisse comme dans le fil, et les 7 derniers jours en pastilles
 * (L M M J V S D) : lisible tout de suite, contrairement à l'ancienne grille de 30 carrés.
 */
export function ObjectiveCard({ o, postedDays, daysCount, onMenu }: {
  o: Objective; postedDays: Set<string>; daysCount: number; onMenu?: () => void;
}) {
  const pct = o.target_value > 0 ? Math.min(Math.round((o.current_value / o.target_value) * 100), 100) : 0;
  const inPct = o.unit === '%';
  const week = dayKeysFor(7);
  const todayKey = week[week.length - 1];
  const vis = VIS_ICON[o.visibility] || VIS_ICON.friends;
  const doneThisWeek = week.filter(d => postedDays.has(d)).length;
  const infinite = o.duration_days == null;
  return (
    <GlassSurface radius={26} style={{ marginBottom: 12 }}>
    <View style={{ padding: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>{o.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontFamily: F.bold }} numberOfLines={1}>{o.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <Ionicons name={vis.icon} size={12} color="#777" />
            <Text style={{ color: '#777', fontSize: 12, fontFamily: F.regular }}>{vis.label}{infinite ? '' : `, ${o.duration_days} jours`}</Text>
          </View>
        </View>
        {onMenu && (
          <TouchableOpacity onPress={onMenu} accessibilityLabel={`Options de l'objectif ${o.title}`} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#777" />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 }}>
        <Text style={{ color: '#fff', fontSize: 34, fontFamily: F.black, letterSpacing: -1 }} numberOfLines={1}>
          {inPct ? `${pct}%` : fmtNum(o.current_value)}
          {!inPct && <Text style={{ color: '#777', fontSize: 16, fontFamily: F.semibold, letterSpacing: 0 }}>{` / ${fmtNum(o.target_value)} ${o.unit}`}</Text>}
        </Text>
        {!inPct && <Text style={{ color: '#aaa', fontSize: 14, fontFamily: F.bold, marginBottom: 5 }}>{pct}%</Text>}
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 10, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#fff', borderRadius: 4 }} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
        {week.map((d, i) => {
          const done = postedDays.has(d);
          const today = d === todayKey;
          const day = new Date(); day.setDate(day.getDate() - (6 - i));
          const letter = ['D', 'L', 'M', 'M', 'J', 'V', 'S'][day.getDay()];
          return (
            <View key={d} style={{ alignItems: 'center', gap: 6 }}>
              <View style={{
                width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                backgroundColor: done ? '#fff' : 'rgba(255,255,255,0.05)',
                borderWidth: done ? 0 : 1.5, borderColor: today ? '#888' : '#262626',
              }}>
                {done && <Ionicons name="checkmark" size={18} color="#000" />}
              </View>
              <Text style={{ color: today ? '#fff' : '#666', fontSize: 10, fontFamily: F.bold }}>{letter}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ color: '#888', fontSize: 12, fontFamily: F.semibold, marginTop: 14 }}>
        {doneThisWeek} {doneThisWeek > 1 ? 'jours' : 'jour'} cette semaine, {postedDays.size} {postedDays.size > 1 ? 'jours' : 'jour'} {infinite ? `sur les ${daysCount} derniers` : `sur ${daysCount}`}
      </Text>
    </View>
    </GlassSurface>
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
