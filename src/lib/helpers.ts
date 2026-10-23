import { supabase } from './supabase';
import { t, formatNumber, type TKey } from '../i18n';

// Traduit les erreurs techniques (Supabase, réseau) en messages lisibles, dans la langue de l'app.
export function frError(error: { message?: string } | null | undefined): string {
  const m = error?.message || '';
  if (/invalid login credentials/i.test(m)) return t('errors.badLogin');
  if (/email not confirmed/i.test(m)) return t('errors.emailNotConfirmed');
  if (/already registered|already been registered/i.test(m)) return t('errors.alreadyRegistered');
  if (/password should be at least/i.test(m)) return t('errors.passwordTooShort6');
  if (/network request failed|failed to fetch|fetch failed/i.test(m)) return t('errors.network');
  if (/for security purposes/i.test(m)) return t('errors.tooManyAttempts');
  if (/row-level security/i.test(m)) return t('errors.notAllowed');
  if (/duplicate key/i.test(m)) return t('errors.duplicate');
  return t('errors.generic');
}

// lower : « il y a 3 min » au milieu d'une phrase.
export function timeAgo(dateStr: string, lower = false) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  const s = diff < 60 ? t('time.justNow')
    : diff < 3600 ? t('time.minutesAgo', { n: Math.floor(diff / 60) })
    : diff < 86400 ? t('time.hoursAgo', { n: Math.floor(diff / 3600) })
    : t('time.daysAgo', { n: Math.floor(diff / 86400) });
  return lower ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

// Nombre à virgule dans la langue de l'app (251,5 en français, 251.5 en anglais).
export const num = (n: number) => formatNumber(n, { maximumFractionDigits: 1 });

// Raisons de suggestion écrites en français par le serveur (discover_people) : « Sport : Hyrox »,
// « Tag : 🥊 Boxe », « Objectif : Courir 10 km ». On les réécrit dans la langue de l'app.
const SPORT_IDS: Record<string, string> = {
  Musculation: 'musculation', 'Street Workout': 'street-workout', Hyrox: 'hyrox', Running: 'running',
  Cyclisme: 'cyclisme', 'Sports de combat': 'combat', Natation: 'natation', Autre: 'autre',
};
export function sportName(frName: string): string {
  const id = SPORT_IDS[frName];
  return id ? t(`sports.${id}.name` as TKey) : frName;
}
export function localizeReason(reason?: string | null): string {
  if (!reason) return '';
  const m = reason.match(/^(Sport|Tag|Objectif) : (.*)$/);
  if (!m) return reason;
  if (m[1] === 'Sport') return t('friends.reasonSport', { sport: sportName(m[2]) });
  if (m[1] === 'Tag') return t('friends.reasonTag', { tag: m[2] });
  return t('friends.reasonObjective', { title: m[2] });
}

// Résultat d'un défi écrit en français par le serveur (« Victoire 5 à 3 ») : réécrit dans la langue de l'app.
export function localizeDuelResult(preview?: string | null): string {
  const m = (preview || '').match(/^(Victoire|Défaite|Égalité) (\d+) à (\d+)$/);
  if (!m) return preview || '';
  const leader = m[1] === 'Victoire' ? t('duelCard.win') : m[1] === 'Défaite' ? t('duelCard.lose') : t('duelCard.draw');
  return t('duelCard.score', { leader, a: m[2], b: m[3] });
}

// Lieu par défaut écrit dans la langue de celui qui prévient (« la salle », « the gym »...) : on affiche le nôtre.
const DEFAULT_PLACES = ['la salle', 'the gym', 'el gimnasio', 'חדר הכושר'];
export const placeLabel = (p?: string | null) =>
  !p || DEFAULT_PLACES.includes(p.trim().toLowerCase()) ? t('presence.defaultPlace') : p;

// « Eden », « Eden et Logan », « Eden, Logan et Théo » dans la langue de l'app.
export function andList(names: string[]): string {
  if (names.length <= 1) return names[0] || '';
  return t('common.andJoin', { list: names.slice(0, -1).join(', '), last: names[names.length - 1] });
}

export async function calculateStreak(userId: string): Promise<number> {
  // 120 derniers jours seulement : relire tout l'historique à chaque ouverture ralentissait l'app pour rien.
  const since = new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase.from('updates').select('created_at').eq('user_id', userId).gte('created_at', since).order('created_at', { ascending: false }).limit(400);
  if (error || !data || data.length === 0) return 0;
  const days = [...new Set(data.map(u => new Date(u.created_at).toDateString()))];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  // Le streak survit jusqu'à minuit : posté aujourd'hui → on compte depuis aujourd'hui,
  // posté hier → le streak tient encore (il reste la journée pour le prolonger),
  // sinon il est cassé.
  let start: Date;
  if (days[0] === today.toDateString()) start = today;
  else if (days[0] === yesterday.toDateString()) start = yesterday;
  else return 0;
  let streak = 0;
  for (let i = 0; i < days.length; i++) {
    const expected = new Date(start);
    expected.setDate(start.getDate() - i);
    if (days[i] === expected.toDateString()) streak++;
    else break;
  }
  return streak;
}

// Lit le chiffre et l'unité dans le nom d'un objectif : « 170kg au bench » donne
// 170 kg, « Aller à la salle 4 fois » donne 4 fois. Sert à proposer l'unité toute
// seule à la création, et à sortir du pourcentage les objectifs créés sans chiffre.
const GOAL_UNITS: [RegExp, string][] = [
  [/^(kg|kilos?|kilogrammes?)$/, 'kg'],
  [/^(km|kilom[eè]tres?)$/, 'km'],
  [/^s[ée]ances?$/, 'séances'],
  [/^(fois|x)$/, 'fois'],
  [/^(min|mins|minutes?)$/, 'min'],
  [/^(reps?|r[ée]p[ée]titions?|pompes|tractions|squats|abdos)$/, 'reps'],
  [/^pas$/, 'pas'],
  [/^(h|heures?)$/, 'h'],
  [/^(lbs?|livres)$/, 'lbs'],
  [/^(cal|kcal|calories?)$/, 'cal'],
];
export function parseGoal(title: string): { target: number; unit: string } | null {
  const re = /(\d+(?:[.,]\d+)?)\s*([a-zA-ZÀ-ÿ]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title))) {
    const word = m[2].toLowerCase();
    const hit = GOAL_UNITS.find(([r]) => r.test(word));
    const target = Number(m[1].replace(',', '.'));
    if (hit && target > 0) return { target, unit: hit[1] };
  }
  return null;
}

// Ancien objectif suivi en % dont le nom contient le chiffre : on l'affiche dans
// sa vraie unité, la progression acquise est convertie. Rien n'est écrit en base
// ici ; la publication suivante enregistre l'unité pour de bon.
export function inUnit<T extends { title?: string; unit?: string; target_value?: number; current_value?: number }>(o: T): T {
  const g = o.unit === '%' && o.title ? parseGoal(o.title) : null;
  if (!g) return o;
  const done = o.target_value && o.target_value > 0 ? Math.min((o.current_value || 0) / o.target_value, 1) : 0;
  return { ...o, unit: g.unit, target_value: g.target, current_value: Math.round(done * g.target * 10) / 10 };
}
