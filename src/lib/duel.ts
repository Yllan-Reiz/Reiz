import { supabase } from './supabase';
import { signAvatars } from './storage';
import { frError } from './helpers';

// Défi duo : un duel d'une semaine entre deux amis. Celui qui a posté sur le plus de jours
// différents gagne. Tout est calculé côté serveur (supabase/phase12-defi-encouragements.sql),
// l'app ne fait que lire `duel_list` et appeler quatre fonctions.

const DAY = 24 * 60 * 60 * 1000;

export type DuelStatus = 'pending' | 'active' | 'finished';

export type Duel = {
  id: string;
  status: DuelStatus;
  /** true si c'est moi qui ai lancé le défi (donc j'attends sa réponse) */
  sentByMe: boolean;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  myScore: number;
  theirScore: number;
  /** Jours restants, aujourd'hui compris (0 hors défi en cours). */
  daysLeft: number;
  /** Résultat, seulement quand le défi est terminé. */
  outcome: 'win' | 'lose' | 'draw' | null;
};

type Row = {
  id: string; challenger_id: string; opponent_id: string; status: DuelStatus;
  ends_at: string | null; challenger_score: number | null; opponent_score: number | null;
  other_id: string; other_name: string | null; other_avatar: string | null;
};

/** Mes défis ouverts ou terminés depuis moins d'une semaine. null = fonction absente côté serveur. */
export async function loadDuels(): Promise<Duel[] | null> {
  const { data, error } = await supabase.rpc('duel_list');
  if (error || !Array.isArray(data)) return null;
  const rows = data as Row[];
  const avatars = await signAvatars(rows.map(r => r.other_avatar));
  return rows.map(r => {
    const sentByMe = r.other_id !== r.challenger_id;
    const my = (sentByMe ? r.challenger_score : r.opponent_score) ?? 0;
    const their = (sentByMe ? r.opponent_score : r.challenger_score) ?? 0;
    const ends = r.ends_at ? new Date(r.ends_at).getTime() : 0;
    return {
      id: r.id,
      status: r.status,
      sentByMe,
      otherId: r.other_id,
      otherName: r.other_name || 'Ton ami',
      otherAvatar: r.other_avatar ? avatars[r.other_avatar] ?? null : null,
      myScore: my,
      theirScore: their,
      daysLeft: r.status === 'active' ? Math.max(0, Math.min(7, Math.ceil((ends - Date.now()) / DAY))) : 0,
      outcome: r.status === 'finished' ? (my > their ? 'win' : my < their ? 'lose' : 'draw') : null,
    };
  });
}

// Messages d'erreur écrits par le serveur, déjà en français : on les montre tels quels.
const OWN_ERRORS = ['Vous devez être amis pour vous défier', 'Défi impossible', 'Un défi est déjà en cours avec cet ami', 'Défi introuvable', 'Adversaire invalide'];
const message = (error: { message?: string }) => OWN_ERRORS.find(m => error.message?.includes(m)) ?? frError(error);

/** Chaque action renvoie null si tout s'est bien passé, sinon le message à afficher. */
async function call(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.rpc(fn, args);
  return error ? message(error) : null;
}

export const proposeDuel = (opponentId: string) => call('duel_create', { p_opponent: opponentId });
export const answerDuel = (id: string, accept: boolean) => call('duel_respond', { p_id: id, p_accept: accept });
export const withdrawDuel = (id: string) => call('duel_cancel', { p_id: id });

/** Phrase d'état d'un défi en cours : « Tu mènes », « Eden mène », « Égalité ». */
export function leaderLabel(d: Duel): string {
  const first = d.otherName.split(' ')[0];
  if (d.myScore > d.theirScore) return 'Tu mènes';
  if (d.myScore < d.theirScore) return `${first} mène`;
  return 'Égalité';
}
