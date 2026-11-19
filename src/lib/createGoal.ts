import { supabase, currentUser } from './supabase';
import { t, tp, unitLabel, type TKey } from '../i18n';
import { num } from './helpers';
import { addWeeks, localDay, rhythmTarget } from './goal';
import { knowsGoalColumns } from './objectives';
import { track } from './track';
import { PROFILE_SPORTS, type ParsedGoal } from './sentence';

// De la phrase à la ligne `objectives` (1.4). Sert à « Nouvel objectif » et à l'accueil : une seule façon de créer.

/** Durée proposée d'office à un rythme : 4 semaines, assez court pour un premier bilan. */
export const DEFAULT_WEEKS = 4;

/** « Séance musculation », « Course à pied 10 km », « 100 kg au bench », ou la phrase nettoyée. */
export function goalTitle(g: ParsedGoal): string {
  if (g.titleKey) return t(g.titleKey as TKey);
  if (g.kind === 'record') return g.text || (g.activity ? t(`sentence.act.${g.activity}` as TKey) : '');
  if (!g.activity) return g.text;
  // Les mots de la personne quand la phrase se lit comme un titre (« Pilates le mardi et le jeudi », « Courir un semi »).
  if (g.ownWords && g.text) return g.text;
  const base = t(`sentence.act.${g.activity}` as TKey);
  return g.amount && g.unit ? `${base} ${num(g.amount)} ${unitLabel(g.unit)}` : base;
}

/** « 3 fois par semaine », « Tous les jours », « Objectif : 100 kg ». */
export function goalSummary(g: ParsedGoal): string {
  if (g.kind === 'record') return t('sentence.record', { target: num(g.amount || 0), unit: unitLabel(g.unit || '') });
  return (g.perWeek || 0) >= 7 ? t('sentence.everyDay') : tp('sentence.perWeek', g.perWeek || 1);
}

export type GoalOptions = {
  /** Titre corrigé à la main (sinon celui tiré de la phrase). */
  title?: string;
  /** Échéance en semaines. Rythme : DEFAULT_WEEKS si absent. Record : sans date si absent. */
  weeks?: number | null;
  /** Jours de rappel (1 = lundi). Absent ou les 7 : rappels possibles tous les jours. */
  days?: number[];
  visibility?: string;
  /** D'où vient la création, pour le back-office : 'welcome' ou 'modal'. */
  from: string;
  /** Comment l'objectif a été trouvé : phrase comprise, objectif tout prêt, ou phrase corrigée à la main. */
  via: 'sentence' | 'ready';
  edited?: boolean;
};

export async function createGoal(g: ParsedGoal, o: GoalOptions): Promise<{ id: string | null; title: string; error: { message?: string } | null }> {
  const title = (o.title ?? goalTitle(g)).trim().slice(0, 80);
  const user = await currentUser();
  if (!user) return { id: null, title, error: { message: t('post.mustBeSignedIn') } };

  const rhythm = g.kind === 'rhythm';
  const today = localDay();
  const weeks = rhythm ? (o.weeks ?? g.weeks ?? DEFAULT_WEEKS) : (o.weeks ?? null);
  const deadline = weeks ? addWeeks(today, weeks) : null;
  const perWeek = Math.max(1, Math.min(7, g.perWeek || 3));
  const row: Record<string, unknown> = {
    user_id: user.id, title, emoji: g.emoji,
    // Rythme : la cible est le total de séances sur la période. Record : le chiffre de la phrase.
    target_value: rhythm ? (deadline ? rhythmTarget(perWeek, today, deadline) : perWeek * DEFAULT_WEEKS) : (g.amount || 1),
    current_value: 0,
    unit: rhythm ? 'séances' : (g.unit || 'fois'),
    visibility: o.visibility || 'friends',
    duration_days: null,
  };
  if (knowsGoalColumns()) {
    row.starts_at = today;
    row.deadline = deadline;
    if (rhythm) row.per_week = perWeek;
  }
  // Jours choisis dans la feuille, sinon ceux dits dans la phrase (« le mardi et le jeudi »).
  const picked = o.days ?? g.days;
  const days = picked && picked.length > 0 && picked.length < 7 ? picked : null;
  if (days) row.training_days = days;
  row.category = g.category;

  // Une base en retard d'une migration (category : phase 34, training_days : phase 12) ne bloque pas la création :
  // on retire la colonne refusée et on réessaie.
  let res = await supabase.from('objectives').insert(row).select('id').single();
  for (const col of ['category', 'training_days']) {
    if (res.error && col in row && new RegExp(col, 'i').test(res.error.message || '')) {
      delete row[col];
      res = await supabase.from('objectives').insert(row).select('id').single();
    }
  }
  if (res.error) return { id: null, title, error: res.error };

  track('objective_created', {
    from: o.from, via: o.via, kind: g.kind, category: g.category,
    per_week: rhythm ? perWeek : null, guessed: !!g.guessed, edited: !!o.edited,
  });
  // Le sport du profil (pastille sous le nom, recherche par sport) : rempli une fois, s'il est encore vide.
  if (PROFILE_SPORTS.includes(g.category)) {
    supabase.from('users').update({ sport: g.category }).eq('id', user.id).is('sport', null).then(() => {}, () => {});
  }
  return { id: (res.data as { id: string } | null)?.id ?? null, title, error: null };
}
