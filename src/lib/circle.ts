import { supabase } from './supabase';

// Les identifiants de mes amis (amitiés acceptées). Audit du 20/11/2026 : au lancement, le fil et la carte des
// objectifs terminés envoyaient chacun exactement la même requête. Une lecture sert aux deux ; elle est gardée
// 3 secondes, et `force` la relance (après avoir accepté ou retiré un ami).

let last: { uid: string; at: number; p: Promise<string[] | null> } | null = null;

/** Mes amis, sans doublon. `null` : la lecture a échoué (on ne sait pas, ce n'est pas « aucun ami »). */
export function loadFriendIds(uid: string, force = false): Promise<string[] | null> {
  if (!force && last && last.uid === uid && Date.now() - last.at < 3000) return last.p;
  const p = (async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select('requester_id, receiver_id')
      .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`)
      .eq('status', 'accepted');
    if (error || !data) return null;
    return [...new Set((data as { requester_id: string; receiver_id: string }[]).map(f => (f.requester_id === uid ? f.receiver_id : f.requester_id)))];
  })();
  last = { uid, at: Date.now(), p };
  return p;
}
