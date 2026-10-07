import { supabase } from './supabase';

// Traduit les erreurs techniques (Supabase, réseau) en messages français lisibles.
export function frError(error: { message?: string } | null | undefined): string {
  const m = error?.message || '';
  if (/invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
  if (/email not confirmed/i.test(m)) return 'Confirme ton email avant de te connecter (vérifie ta boîte mail).';
  if (/already registered|already been registered/i.test(m)) return 'Un compte existe déjà avec cet email.';
  if (/password should be at least/i.test(m)) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (/network request failed|failed to fetch|fetch failed/i.test(m)) return 'Pas de connexion. Vérifie ton réseau et réessaie.';
  if (/for security purposes/i.test(m)) return 'Trop de tentatives. Attends quelques secondes et réessaie.';
  if (/row-level security/i.test(m)) return "Action non autorisée.";
  if (/duplicate key/i.test(m)) return 'Cet élément existe déjà.';
  return 'Une erreur est survenue. Réessaie.';
}

export function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return `Il y a ${Math.floor(diff / 86400)}j`;
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
