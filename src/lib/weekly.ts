// La fréquence d'abord (1.4, 12/11/2026) : un objectif se joue sur la semaine (« 3 fois par semaine »), n'importe
// quels jours. Les jours choisis (training_days) ne servent plus qu'aux rappels : ils ne cassent plus rien.
//
// La série se compte donc en SEMAINES réussies d'affilée (du lundi au dimanche, à l'heure du téléphone) :
//   une semaine est réussie quand le nombre de jours avec une séance atteint le quota de la semaine ;
//   la semaine en cours ne casse jamais la série : elle s'ajoute dès que son quota est atteint.
// Quota d'une semaine : le plus petit « par semaine » des rythmes en cours cette semaine-là (un seul objectif tenu
// suffit), 1 séance s'il n'y a aucun rythme. La semaine où un rythme commence ou finit est comptée au prorata.
//
// Fonctions pures, sans réseau : la même règle sert à ta série, à celle d'un ami et aux cartes du cercle.

export type WeeklyGoal = {
  per_week?: number | null;
  starts_at?: string | null;
  deadline?: string | null;
  is_completed?: boolean | null;
  completed_at?: string | null;
};

export type WeekState = {
  /** Semaines réussies d'affilée, semaine en cours comprise si son quota est atteint. */
  weeks: number;
  /** Jours avec une séance cette semaine. */
  done: number;
  /** Séances attendues cette semaine. */
  quota: number;
  weekDone: boolean;
  /** Séances qu'il reste à faire cette semaine. */
  left: number;
  /** Jours qu'il reste cette semaine, aujourd'hui compris. */
  daysLeft: number;
};

const atNoon = (day: string) => new Date(`${day.slice(0, 10)}T12:00:00`);

/** Lundi 00:00 de la semaine de `d`, à l'heure du téléphone. */
export function mondayOf(d: Date = new Date()): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

/** Quota de la semaine qui commence à `weekStart`. */
export function quotaFor(goals: WeeklyGoal[], weekStart: Date): number {
  const weekEnd = addDays(weekStart, 7);
  let quota = Infinity;
  for (const g of goals) {
    if (!g.per_week || g.per_week <= 0) continue;
    const start = g.starts_at ? atNoon(g.starts_at) : null;
    const end = g.deadline ? atNoon(g.deadline) : null;
    if (start && start >= weekEnd) continue; // pas encore commencé
    if (end && end < weekStart) continue; // échéance déjà passée
    if (g.completed_at ? new Date(g.completed_at) < weekStart : !!g.is_completed) continue; // déjà terminé
    let need = Math.min(g.per_week, 7);
    // Semaine entamée ou écourtée : au prorata des jours où l'objectif existe, jamais moins d'une séance.
    const from = start && start > weekStart ? start : weekStart;
    const to = end && end < weekEnd ? end : addDays(weekEnd, -1);
    const days = Math.max(1, Math.min(7, Math.round((new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0)) / 86400000) + 1));
    if (days < 7) need = Math.max(1, Math.min(need, Math.round((need * days) / 7)));
    quota = Math.min(quota, need);
  }
  return quota === Infinity ? 1 : quota;
}

/** Jours avec une séance dans la semaine qui commence à `weekStart`. `days` : clés `toDateString()`. */
function sessionsIn(days: Set<string>, weekStart: Date): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (days.has(addDays(weekStart, i).toDateString())) n++;
  return n;
}

/** La semaine en cours et la série, à partir des dates des séances et des objectifs. */
export function weekState(posts: (Date | string)[], goals: WeeklyGoal[], now: Date = new Date()): WeekState {
  const days = new Set(posts.map(p => new Date(p).toDateString()));
  const current = mondayOf(now);
  const quota = quotaFor(goals, current);
  const done = sessionsIn(days, current);
  const weekDone = done >= quota;
  let weeks = weekDone ? 1 : 0;
  for (let i = 1; i <= 104; i++) {
    const start = addDays(current, -7 * i);
    if (sessionsIn(days, start) < quotaFor(goals, start)) break;
    weeks++;
  }
  const todayIdx = (now.getDay() + 6) % 7;
  return { weeks, done, quota, weekDone, left: Math.max(0, quota - done), daysLeft: 7 - todayIdx };
}

/** Colonnes d'un objectif dont la règle a besoin. */
export const WEEKLY_COLUMNS = 'per_week, starts_at, deadline, is_completed, completed_at';
