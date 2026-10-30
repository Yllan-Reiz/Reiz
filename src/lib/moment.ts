import { supabase, currentUser } from './supabase';
import { t } from '../i18n';

// Le moment Reiz du jour (phase 29, 30/10/2026), tiré par le serveur (notify-moment) : séance un jour
// d'entraînement, récup un jour de repos. Posté dans les 10 minutes : « ⚡ À l'heure ». Après : « en retard de 2 h ».
// Sans la table (base d'avant la phase 29) ou sans moment aujourd'hui : null, l'écran de publication reste normal.

export type MomentKind = 'session' | 'recovery';
/** `at` : l'heure où la notification est partie (sent_at), à défaut l'heure prévue. La tâche passe toutes les
 *  5 minutes : le push peut partir jusqu'à 5 minutes après l'heure prévue, les 10 minutes se comptent depuis le push. */
export type TodayMoment = { kind: MomentKind; at: string; posted: boolean };

export const ON_TIME_MIN = 10;

const todayLocal = () => new Date().toLocaleDateString('en-CA');

export async function loadTodayMoment(): Promise<TodayMoment | null> {
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await supabase.from('moments').select('kind, at, sent_at').eq('user_id', user.id).eq('day', todayLocal()).maybeSingle();
  if (error || !data) return null;
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const { count } = await supabase.from('updates').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).not('moment', 'is', null).gte('created_at', midnight.toISOString());
  return { kind: data.kind as MomentKind, at: (data as any).sent_at ?? data.at, posted: (count || 0) > 0 };
}

/** Minutes écoulées depuis le moment (0 avant). */
export const lateMinutes = (at: string) => Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60000));

/** « ⚡ À l'heure », « En retard de 25 min », « En retard de 2 h ». */
export function lateLabel(min: number) {
  if (min < ON_TIME_MIN) return t('moment.onTime');
  if (min < 60) return t('moment.lateMin', { n: min });
  return t('moment.lateH', { n: Math.floor(min / 60) });
}
