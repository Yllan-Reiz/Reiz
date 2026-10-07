import { supabase, currentUser } from './supabase';
import { signAvatars } from './storage';
import { currentWeekKeys } from '../constants';

// La régularité de ton cercle : qui s'est entraîné cette semaine, et qui décroche.
// Calculé sur le téléphone à partir de ce que tu as le droit de voir (les posts de tes amis, hors objectifs privés).
// Un ami qui a prévu des jours de repos (jours d'entraînement de ses objectifs) n'est pas « en retard » ces jours-là.

export type FriendRhythm = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  /** Posté ce jour-là cette semaine : lundi (0) à dimanche (6). */
  posted: boolean[];
  /** Jour prévu (planning de ses objectifs, tous les jours sans planning). */
  scheduled: boolean[];
  /** Jours depuis le dernier post (0 = aujourd'hui), null = rien depuis 30 jours. */
  daysAgo: number | null;
  /** Jours PRÉVUS manqués depuis lundi (hors aujourd'hui, qui n'est pas fini). */
  missed: number;
  activeThisWeek: boolean;
};

export type CircleRhythm = {
  friends: FriendRhythm[];
  active: number;
  total: number;
  /** Les plus à relancer d'abord : au moins un jour prévu manqué et plus de séance depuis 2 jours. */
  toNudge: FriendRhythm[];
};

let memo: { uid: string; at: number; data: CircleRhythm } | null = null;
export const resetCircleRhythm = () => { memo = null; };

const DAY = 24 * 60 * 60 * 1000;

export async function loadCircleRhythm(force = false): Promise<CircleRhythm | null> {
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
    // Avant la phase 12 la colonne n'existe pas : l'erreur est ignorée, tous les jours comptent.
    supabase.from('objectives').select('user_id, training_days').in('user_id', ids),
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
  // Planning de chacun : « tous les jours » dès qu'un objectif n'a pas de planning.
  const plan = new Map<string, { every: boolean; days: Set<number> }>();
  (plans.error ? [] : ((plans.data || []) as any[])).forEach(o => {
    const s = plan.get(o.user_id) || { every: false, days: new Set<number>() };
    if (!o.training_days || o.training_days.length === 0 || o.training_days.length >= 7) s.every = true;
    else o.training_days.forEach((d: number) => s.days.add(d));
    plan.set(o.user_id, s);
  });

  const friends: FriendRhythm[] = [...people.values()].map(p => {
    const dates = postsOf.get(p.id) || [];
    const keys = new Set(dates.map(d => d.toDateString()));
    const posted = week.map(k => keys.has(k));
    const pl = plan.get(p.id);
    const scheduled = week.map((_, i) => !pl || pl.every || pl.days.has(i + 1));
    const last = dates.reduce<Date | null>((a, d) => (!a || d > a ? d : a), null);
    let daysAgo: number | null = null;
    if (last) { const l0 = new Date(last); l0.setHours(0, 0, 0, 0); daysAgo = Math.round((today0.getTime() - l0.getTime()) / DAY); }
    let missed = 0;
    for (let i = 0; i < todayIdx; i++) if (scheduled[i] && !posted[i]) missed++;
    return {
      id: p.id, full_name: p.full_name, avatar_url: p.avatar_url ? signed[p.avatar_url] ?? null : null,
      posted, scheduled, daysAgo, missed, activeThisWeek: posted.some(Boolean),
    };
  });

  // Actifs d'abord, puis par nom.
  friends.sort((a, b) => Number(b.activeThisWeek) - Number(a.activeThisWeek) || a.full_name.localeCompare(b.full_name, 'fr'));
  const toNudge = friends
    .filter(f => f.missed >= 1 && !f.posted[todayIdx] && (f.daysAgo === null || f.daysAgo >= 2))
    .sort((a, b) => (b.daysAgo ?? 99) - (a.daysAgo ?? 99));
  const data: CircleRhythm = { friends, active: friends.filter(f => f.activeThisWeek).length, total: friends.length, toNudge };
  memo = { uid: user.id, at: Date.now(), data };
  return data;
}
