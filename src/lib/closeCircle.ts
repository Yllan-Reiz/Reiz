import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { supabase, currentUser } from './supabase';
import { signAvatars } from './storage';

// Ton cercle proche : les amis que tu as marqués d'une étoile. Ils sont prévenus quand tu arrives à ta
// salle, voient les objectifs « Cercle proche » et peuvent être identifiés dans tes duos.
// Une seule lecture partagée par la carte du fil, la liste d'amis et le profil (gardée une minute).

export type CloseFriend = { id: string; full_name: string; avatar_url: string | null };

let memo: { uid: string; at: number; list: CloseFriend[] } | null = null;

/** À appeler après avoir ajouté ou retiré quelqu'un, et à la déconnexion. */
export function resetCloseCircle() { memo = null; }

export async function loadCloseCircle(force = false): Promise<CloseFriend[]> {
  const user = await currentUser();
  if (!user) return [];
  if (!force && memo && memo.uid === user.id && Date.now() - memo.at < 60_000) return memo.list;
  const { data: cf } = await supabase.from('close_friends').select('friend_id').eq('owner_id', user.id);
  const ids = (cf || []).map((c: any) => c.friend_id as string);
  let list: CloseFriend[] = [];
  if (ids.length > 0) {
    const { data } = await supabase.from('users').select('id, full_name, avatar_url').in('id', ids);
    const rows = (data || []) as { id: string; full_name: string; avatar_url?: string | null }[];
    const signed = await signAvatars(rows.map(r => r.avatar_url));
    list = rows.map(r => ({ id: r.id, full_name: r.full_name, avatar_url: r.avatar_url ? signed[r.avatar_url] ?? null : null }));
  }
  memo = { uid: user.id, at: Date.now(), list };
  return list;
}

/** `list` vaut null tant que ce n'est pas chargé (pour ne rien afficher de faux pendant le chargement). */
export function useCloseCircle() {
  const [list, setList] = useState<CloseFriend[] | null>(null);
  const reload = useCallback((force = true) => { loadCloseCircle(force).then(setList).catch(() => setList([])); }, []);
  useEffect(() => {
    reload(false);
    const sub = AppState.addEventListener('change', st => { if (st === 'active') reload(false); });
    return () => sub.remove();
  }, [reload]);
  return { list, reload };
}

/** Ajoute ou retire un ami du cercle proche. Renvoie false si la base a refusé. */
export async function setClose(friendId: string, on: boolean): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const { error } = on
    ? await supabase.from('close_friends').insert({ owner_id: user.id, friend_id: friendId })
    : await supabase.from('close_friends').delete().eq('owner_id', user.id).eq('friend_id', friendId);
  resetCloseCircle();
  return !error || /duplicate key/i.test(error.message || '');
}
