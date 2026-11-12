import { supabase, currentUser } from './supabase';
import { signAvatars } from './storage';
import { currentWeekKeys } from '../constants';
import { quotaFor, mondayOf, weekState, WEEKLY_COLUMNS, type WeeklyGoal } from './weekly';

// La régularité de ton cercle : qui s'est entraîné cette semaine, et qui décroche.
// Calculé sur le téléphone à partir de ce que tu as le droit de voir (les posts de tes amis, hors objectifs privés).
// 1.4 : tout se joue sur la semaine. Un ami n'est « en retard » que si son quota de la semaine devient difficile à
// tenir (il lui reste autant de séances que de jours), plus parce qu'il a sauté un jour précis.

export type FriendRhythm = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  /** Posté ce jour-là cette semaine : lundi (0) à dimanche (6). */
  posted: boolean[];
  /** Jour où une séance est encore attendue : tous, sauf aujourd'hui une fois le quota de la semaine atteint. */
  scheduled: boolean[];
  /** Séances attendues cette semaine (d'après ses objectifs visibles) et jours déjà faits. */
  quota: number;
  done: number;
  weekDone: boolean;
  /** Sa série en semaines, d'après les 30 derniers jours (donc 5 au plus) : au moins 1 = il a la flamme. */
  weeks: number;
  /** Jours depuis le dernier post (0 = aujourd'hui), null = rien depuis 30 jours. */
  daysAgo: number | null;
  /** Il lui reste au moins autant de séances à faire que de jours dans la semaine. */
  behind: boolean;
  activeThisWeek: boolean;
};

export type CircleRhythm = {
  friends: FriendRhythm[];
  active: number;
  total: number;
  /** Les plus à relancer d'abord : quota de la semaine en danger et plus de séance depuis 2 jours. */
  toNudge: FriendRhythm[];
};

let memo: { uid: string; at: number; data: CircleRhythm } | null = null;
export const resetCircleRhythm = () => { memo = null; };

const DAY = 24 * 60 * 60 * 1000;

// Un calcul en cours sert à tous ceux qui le demandent au même moment (cartes du cercle, duel, flammes) : avant, la
// même lecture de 30 jours de séances partait jusqu'à quatre fois de suite à l'ouverture.
let inflight: Promise<CircleRhythm | null> | null = null;

export function loadCircleRhythm(force = false): Promise<CircleRhythm | null> {
  if (inflight) return inflight;
  inflight = computeCircleRhythm(force).finally(() => { inflight = null; });
  return inflight;
}

async function computeCircleRhythm(force: boolean): Promise<CircleRhythm | null> {
  const user = await currentUser();
  if (!user) return null;
  if (!force && memo && memo.uid === user.id && Date.now() - memo.at < 5 * 60 * 1000) return memo.data;

  const { data: fr, error } = await supabase
    .from('friendships')
    .select('requester_id, receiver_id, requester:users!friendships_requester_id_fkey(id, full_name, avatar_url), receiver:users!friendships_receiver_id_fkey(id, full_name, avatar_url)')
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq('status', 'accepted');
  if (error) return null;

  const people = new Map<string, { id: string; full_name: string; avatar_url: string | null }>();
  ((fr || []) as any[]).forEach(f => {
    const other = f.requester_id === user.id ? f.receiver : f.requester;
    if (other?.id) people.set(other.id, { id: other.id, full_name: other.full_name, avatar_url: other.avatar_url ?? null });
  });
  const ids = [...people.keys()];
  if (ids.length === 0) { const empty = { friends: [], active: 0, total: 0, toNudge: [] }; memo = { uid: user.id, at: Date.now(), data: empty }; return empty; }

  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const [posts, plans, signed] = await Promise.all([
    supabase.from('updates').select('user_id, created_at, objectives(visibility)').in('user_id', ids).gte('created_at', since).limit(3000),
    // Avant la phase 31 les colonnes n'existent pas : l'erreur est ignorée, une séance par semaine suffit.
    supabase.from('objectives').select(`user_id, ${WEEKLY_COLUMNS}`).in('user_id', ids),
    signAvatars([...people.values()].map(p => p.avatar_url)),
  ]);

  const week = currentWeekKeys();
  const todayIdx = (new Date().getDay() + 6) % 7;
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);

  const postsOf = new Map<string, Date[]>();
  ((posts.data || []) as any[]).forEach(p => {
    if (p.objectives?.visibility === 'private') return;
    (postsOf.get(p.user_id) || postsOf.set(p.user_id, []).get(p.user_id)!).push(new Date(p.created_at));
  });
  // Objectifs visibles de chacun : ils donnent son quota de la semaine.
  const goalsOf = new Map<string, WeeklyGoal[]>();
  (plans.error ? [] : ((plans.data || []) as any[])).forEach(o => {
    (goalsOf.get(o.user_id) || goalsOf.set(o.user_id, []).get(o.user_id)!).push(o);
  });
  const monday = mondayOf();
  const daysLeft = 7 - todayIdx;

  const friends: FriendRhythm[] = [...people.values()].map(p => {
    const dates = postsOf.get(p.id) || [];
    const keys = new Set(dates.map(d => d.toDateString()));
    const posted = week.map(k => keys.has(k));
    const quota = quotaFor(goalsOf.get(p.id) || [], monday);
    const done = posted.filter(Boolean).length;
    const weekDone = done >= quota;
    const scheduled = week.map((_, i) => !(i === todayIdx && weekDone && !posted[i]));
    const behind = !weekDone && quota - done >= daysLeft;
    const last = dates.reduce<Date | null>((a, d) => (!a || d > a ? d : a), null);
    let daysAgo: number | null = null;
    if (last) { const l0 = new Date(last); l0.setHours(0, 0, 0, 0); daysAgo = Math.round((today0.getTime() - l0.getTime()) / DAY); }
    return {
      id: p.id, full_name: p.full_name, avatar_url: p.avatar_url ? signed[p.avatar_url] ?? null : null,
      posted, scheduled, quota, done, weekDone, weeks: weekState(dates, goalsOf.get(p.id) || []).weeks, daysAgo, behind, activeThisWeek: posted.some(Boolean),
    };
  });

  // Actifs d'abord, puis par nom.
  friends.sort((a, b) => Number(b.activeThisWeek) - Number(a.activeThisWeek) || a.full_name.localeCompare(b.full_name, 'fr'));
  const toNudge = friends
    .filter(f => f.behind && !f.posted[todayIdx] && (f.daysAgo === null || f.daysAgo >= 2))
    .sort((a, b) => (b.daysAgo ?? 99) - (a.daysAgo ?? 99));
  const data: CircleRhythm = { friends, active: friends.filter(f => f.activeThisWeek).length, total: friends.length, toNudge };
  memo = { uid: user.id, at: Date.now(), data };
  return data;
}
