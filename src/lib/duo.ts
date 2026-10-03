import { supabase } from './supabase';
import { signOne, isVideo } from './storage';

// Un duo « validé » = deux séances, une de chacun, où chacun identifie l'autre, postées à
// moins de 24 h d'écart. Tout se calcule à partir des posts existants (with_user_ids) :
// aucune table en plus. La base ne renvoie que les posts que tu as le droit de voir.

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

export type DuoStats = {
  validated: number;       // nombre de duos validés avec cet ami
  weeks: number;           // semaines d'affilée avec au moins un duo (la série)
  last: string | null;     // date du dernier duo validé
  partnerPhoto: string | null; // photo signée de la dernière séance de l'ami, si récente (pour la story duo)
};

type Row = { id: string; created_at: string; photo_url: string | null };

/** Numéro de semaine (lundi = début), comparable entre elles pour compter les séries. */
const weekIndex = (iso: string) => {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Math.round(d.getTime() / WEEK);
};

export async function loadDuoStats(me: string, friend: string): Promise<DuoStats> {
  const [a, b] = await Promise.all([
    supabase.from('updates').select('id, created_at, photo_url').eq('user_id', me).contains('with_user_ids', [friend]).order('created_at', { ascending: false }).limit(200),
    supabase.from('updates').select('id, created_at, photo_url').eq('user_id', friend).contains('with_user_ids', [me]).order('created_at', { ascending: false }).limit(200),
  ]);
  const mine = (a.data || []) as Row[];
  const theirs = (b.data || []) as Row[];

  // Appariement : chaque séance de l'un ne compte qu'avec une séance de l'autre.
  const used = new Set<string>();
  const dates: string[] = [];
  mine.forEach(m => {
    const t = new Date(m.created_at).getTime();
    const mate = theirs.find(x => !used.has(x.id) && Math.abs(new Date(x.created_at).getTime() - t) <= DAY);
    if (!mate) return;
    used.add(mate.id);
    dates.push(new Date(m.created_at) > new Date(mate.created_at) ? m.created_at : mate.created_at);
  });
  dates.sort().reverse();

  // Série : semaines consécutives avec un duo, encore « vivante » si la dernière est cette semaine ou la précédente.
  const weeks = [...new Set(dates.map(weekIndex))].sort((x, y) => y - x);
  const now = weekIndex(new Date().toISOString());
  let streak = 0;
  if (weeks.length && weeks[0] >= now - 1) {
    streak = 1;
    for (let i = 1; i < weeks.length && weeks[i] === weeks[i - 1] - 1; i++) streak++;
  }

  // Photo de sa dernière séance si elle date de moins de 24 h (pour la story duo).
  const recent = theirs.find(x => Date.now() - new Date(x.created_at).getTime() <= DAY && x.photo_url && !isVideo(x.photo_url));
  const partnerPhoto = recent?.photo_url ? await signOne(recent.photo_url) : null;

  return { validated: dates.length, weeks: streak, last: dates[0] || null, partnerPhoto };
}

/** « 3e duo », « 1er duo » : pour la célébration. */
export const ordinalDuo = (n: number) => (n === 1 ? '1er duo' : `${n}e duo`);

/** Paires de posts d'un fil qui forment un duo validé (les deux ids sont renvoyés). */
export function validatedDuoIds(posts: { id: string; user_id?: string; created_at: string; with_user_ids?: string[] }[]): Set<string> {
  const out = new Set<string>();
  posts.forEach(p => {
    if (!p.user_id || !(p.with_user_ids || []).length) return;
    const t = new Date(p.created_at).getTime();
    const mate = posts.find(q => q.id !== p.id && !!q.user_id && (p.with_user_ids || []).includes(q.user_id!) && (q.with_user_ids || []).includes(p.user_id!) && Math.abs(new Date(q.created_at).getTime() - t) <= DAY);
    if (mate) { out.add(p.id); out.add(mate.id); }
  });
  return out;
}
