import { supabase } from './supabase';
import { isVideo, signMany } from './storage';
import { videoStill } from './videoTools';
import { num } from './helpers';
import { unitLabel } from '../i18n';

// Le parcours d'un objectif (1.2, 30/10/2026) : ses posts dans l'ordre, du premier jusqu'à celui qui l'a fait
// gagner. Sert à l'écran « Ton parcours » (image récap, vidéo, partage) depuis la victoire, le fil et le profil.
// Les droits de lecture sont ceux de la base : un ami ne voit que ce que la visibilité de l'objectif lui ouvre.

export type JourneyStep = {
  id: string;
  createdAt: string;
  day: number;           // jour du parcours, 1 = jour de création de l'objectif
  progress: string;      // « 3 / 4 séances » ou « 60 % »
  pct: number;
  caption: string;
  media: string | null;  // adresse signée de l'original (photo ou vidéo)
  video: boolean;
  thumb: string | null;  // vignette : photo réduite, ou image tirée de la vidéo
};

export type Journey = {
  objective: { id: string; userId: string; emoji: string; title: string; unit: string; target: number; won: boolean };
  steps: JourneyStep[];
  days: number;          // durée du parcours en jours
};

const DAY = 24 * 3600 * 1000;
const dayOf = (iso: string) => new Date(new Date(iso).toDateString()).getTime();

export async function loadJourney(objectiveId: string): Promise<Journey | null> {
  const { data: o } = await supabase.from('objectives')
    .select('id, user_id, emoji, title, unit, target_value, created_at, completed_at, is_completed')
    .eq('id', objectiveId).maybeSingle();
  if (!o) return null;
  const { data: ups } = await supabase.from('updates')
    .select('id, created_at, progress_value, caption, photo_url')
    .eq('objective_id', objectiveId).order('created_at', { ascending: true });
  // Gagné : le parcours s'arrête au post de la victoire (quelques minutes de marge, la base la date juste après).
  const end = o.completed_at ? new Date(o.completed_at).getTime() + 10 * 60 * 1000 : Infinity;
  const rows = (ups || []).filter((u: any) => new Date(u.created_at).getTime() <= end);

  const paths = rows.map((u: any) => u.photo_url).filter(Boolean) as string[];
  // Vignettes = originaux : la version réduite par Supabase est refusée quand son quota de transformations
  // est épuisé (case vide constatée le 30/10/2026, comme pour l'avatar de l'accueil).
  const full = await signMany(paths);
  const start = dayOf(o.created_at);
  const target = Number(o.target_value) || 0;
  const steps: JourneyStep[] = await Promise.all(rows.map(async (u: any) => {
    const media = u.photo_url ? full[u.photo_url] ?? null : null;
    const video = !!u.photo_url && isVideo(u.photo_url);
    const thumb = !u.photo_url ? null : video ? (media ? await videoStill(media) : null) : media;
    const pct = Math.max(0, Math.min(100, Number(u.progress_value) || 0));
    const progress = o.unit && o.unit !== '%' && target > 0
      ? `${num((pct / 100) * target)} / ${num(target)} ${unitLabel(o.unit)}`
      : `${pct} %`;
    return {
      id: u.id, createdAt: u.created_at, day: Math.max(1, Math.round((dayOf(u.created_at) - start) / DAY) + 1),
      progress, pct, caption: u.caption || '', media, video, thumb,
    };
  }));
  const last = steps[steps.length - 1];
  return {
    objective: { id: o.id, userId: o.user_id, emoji: o.emoji || '', title: o.title, unit: o.unit, target, won: !!o.is_completed },
    steps,
    days: last ? last.day : 1,
  };
}

/** Les étapes du film : au plus `max`, toujours la première et la dernière, le reste réparti régulièrement. */
export function pickSteps(steps: JourneyStep[], max = 12): JourneyStep[] {
  const withMedia = steps.filter(s => s.media);
  if (withMedia.length <= max) return withMedia;
  const out: JourneyStep[] = [];
  for (let i = 0; i < max; i++) out.push(withMedia[Math.round((i * (withMedia.length - 1)) / (max - 1))]);
  return out;
}
