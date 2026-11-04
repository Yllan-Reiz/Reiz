import { Objective } from './types';
import { formatDate, t, tp } from '../i18n';

// Un objectif = un rythme et une échéance (phase 31, 31/10/2026, retour des testeurs).
//   Rythme : « 4 séances par semaine » (per_week) jusqu'à une date (deadline). target_value = total de séances sur la
//            période, current_value = séances faites. Atteint seulement à l'échéance, par un bilan.
//   Record : « 240 kg au squat » (per_week null), échéance facultative. Atteint dès que la valeur est passée.
// Les semaines se comptent depuis starts_at. Sans la colonne (base d'avant la phase 31) : tout est un record, comme avant.

const DAY = 24 * 3600 * 1000;

export const isRhythm = (o?: Pick<Objective, 'per_week'> | null) => !!o && o.per_week != null && o.per_week > 0;

/** « 2026-11-03 » dans le fuseau du téléphone. */
export const localDay = (d: Date = new Date()) => d.toLocaleDateString('en-CA');
const atNoon = (day: string) => new Date(`${day}T12:00:00`);

export function addWeeks(day: string, weeks: number): string {
  const d = atNoon(day); d.setDate(d.getDate() + weeks * 7);
  return localDay(d);
}

/** Semaines entre deux jours, au moins 1 (une période de 84 jours = 12 semaines). */
export function weeksBetween(start: string, end: string): number {
  return Math.max(1, Math.ceil((atNoon(end).getTime() - atNoon(start).getTime()) / (7 * DAY)));
}

/** Nombre de semaines de la période d'un rythme. */
export function weeksTotal(o: Objective): number {
  if (o.deadline && o.starts_at) return weeksBetween(o.starts_at, o.deadline);
  return Math.max(1, Math.round(o.target_value / (o.per_week || 1)));
}

/** Semaine en cours, de 1 à weeksTotal. */
export function weekIndex(o: Objective): number {
  const total = weeksTotal(o);
  const start = o.starts_at ? atNoon(o.starts_at).getTime() : Date.now();
  const days = Math.floor((atNoon(localDay()).getTime() - start) / DAY);
  return Math.max(1, Math.min(total, Math.floor(days / 7) + 1));
}

/** Cible totale d'un rythme : séances par semaine sur toute la période. */
export const rhythmTarget = (perWeek: number, start: string, deadline: string) => perWeek * weeksBetween(start, deadline);

export const deadlinePassed = (o: Pick<Objective, 'deadline'>) => !!o.deadline && atNoon(o.deadline).getTime() + 12 * 3600 * 1000 < Date.now();

/** « 17 janv. » ou « 17 janv. 2027 » si ce n'est pas cette année. */
export function deadlineLabel(day: string): string {
  const d = atNoon(day);
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return formatDate(d, thisYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

/** « Semaine 3 sur 12 ». */
export const weekLabel = (o: Objective) => t('goal.week', { n: weekIndex(o), total: weeksTotal(o) });

/** Sous-ligne d'un rythme : « Semaine 3 sur 12, 2 sur 4 cette semaine ». `doneThisWeek` vient des jours postés. */
export function rhythmLine(o: Objective, doneThisWeek?: number): string {
  const week = weekLabel(o);
  return doneThisWeek == null ? week : `${week}, ${t('goal.thisWeek', { done: doneThisWeek, per: o.per_week })}`;
}

/** Choix d'échéance proposés à la création et à la modification, en semaines. */
// Des objectifs courts aussi (1 ou 2 semaines) : une victoire chaque semaine, pour qui va à la salle sans grand plan.
export const WEEK_CHOICES = [1, 2, 4, 8, 12, 16];
export const weeksLabel = (n: number) => (n === 1 ? t('goal.oneWeek') : tp('goal.weeks', n));
