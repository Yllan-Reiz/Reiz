import { supabase } from './supabase';
import { signMany } from './storage';
import { Update, FeedMeta, Reactor } from './types';

// Même sélection que le fil, pour réafficher un post à l'identique partout
// (fil d'activité, grille du profil, posts épinglés).
export const POST_SELECT = 'id, caption, progress_value, created_at, photo_url, user_id, pinned_at, with_user_ids, objectives(visibility, unit, target_value, emoji, title), users(full_name, username, avatar_url)';

/**
 * Séances en duo : ajoute le prénom des amis identifiés (`with_users`) aux posts,
 * en une seule requête pour toute la liste.
 */
export async function attachDuoNames(posts: Update[]): Promise<void> {
  const ids = [...new Set(posts.flatMap(p => p.with_user_ids || []))];
  if (ids.length === 0) return;
  const { data } = await supabase.from('users').select('id, full_name, avatar_url').in('id', ids);
  const users = (data || []) as { id: string; full_name: string; avatar_url?: string | null }[];
  const signed = await signMany(users.map(u => u.avatar_url));
  const byId = new Map(users.map(u => [u.id, { full_name: u.full_name, avatar_url: u.avatar_url ? signed[u.avatar_url] ?? null : null }]));
  posts.forEach(p => {
    p.with_users = (p.with_user_ids || [])
      .filter(id => byId.has(id))
      .map(id => ({ id, ...byId.get(id)! }));
  });
}

/**
 * Pile de visages sous chaque post : ajoute à `meta[update_id].reactors` le nom
 * et la photo (signée) de chaque personne qui a réagi, les plus récents d'abord.
 */
export async function attachReactors(rows: { update_id: string; type: string; user_id: string; created_at?: string }[], meta: Record<string, FeedMeta>): Promise<void> {
  if (rows.length === 0) return;
  const ids = [...new Set(rows.map(r => r.user_id))];
  const { data } = await supabase.from('users').select('id, full_name, avatar_url').in('id', ids);
  const users = (data || []) as { id: string; full_name: string; avatar_url?: string | null }[];
  const signed = await signMany(users.map(x => x.avatar_url));
  const byId = new Map(users.map(x => [x.id, { name: x.full_name, avatar_url: x.avatar_url ? signed[x.avatar_url] ?? null : null }]));
  [...rows]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .forEach(r => {
      const m = meta[r.update_id]; const who = byId.get(r.user_id);
      if (!m || !who) return;
      (m.reactors ||= []).push({ user_id: r.user_id, emoji: r.type, name: who.name, avatar_url: who.avatar_url } as Reactor);
    });
}

/** Recharge un post et ses réactions / commentaires pour l'afficher en grand. */
export async function loadPost(updateId: string, currentUserId: string | null): Promise<{ u: Update; meta: FeedMeta } | null> {
  const { data } = await supabase.from('updates').select(POST_SELECT).eq('id', updateId).maybeSingle();
  if (!data) return null;
  const u = data as unknown as Update;
  const signed = await signMany([u.photo_url, u.users?.avatar_url]);
  if (u.photo_url) u.photo_url = signed[u.photo_url] ?? undefined;
  if (u.users?.avatar_url) u.users.avatar_url = signed[u.users.avatar_url] ?? undefined;
  await attachDuoNames([u]);
  const [rRes, cRes] = await Promise.all([
    supabase.from('reactions').select('update_id, type, user_id, created_at').eq('update_id', updateId),
    supabase.from('comments').select('id', { count: 'exact', head: true }).eq('update_id', updateId),
  ]);
  const meta: FeedMeta = { reactions: {}, mine: [], commentCount: cRes.count || 0 };
  (rRes.data || []).forEach((r: any) => {
    meta.reactions[r.type] = (meta.reactions[r.type] || 0) + 1;
    if (r.user_id === currentUserId) meta.mine.push(r.type);
  });
  await attachReactors(rRes.data || [], { [updateId]: meta });
  return { u, meta };
}

/** Tous les posts d'un profil (les plus récents d'abord), photos déjà signées. */
export async function loadProfilePosts(userId: string, limit = 90): Promise<Update[]> {
  const { data } = await supabase
    .from('updates')
    .select(POST_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  const posts = (data || []) as unknown as Update[];
  const signed = await signMany(posts.map(p => p.photo_url));
  posts.forEach(p => { if (p.photo_url) p.photo_url = signed[p.photo_url] ?? undefined; });
  await attachDuoNames(posts);
  return posts;
}

// Au-delà de 3, un profil devient une vitrine figée : on garde l'épinglé rare.
export const MAX_PINNED = 3;

/** Épingle ou désépingle un post sur son profil. Renvoie un message d'erreur, ou null. */
export async function togglePin(u: Update, userId: string): Promise<string | null> {
  if (u.pinned_at) {
    const { error } = await supabase.from('updates').update({ pinned_at: null }).eq('id', u.id);
    return error ? 'Impossible de désépingler ce post.' : null;
  }
  const { count } = await supabase
    .from('updates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('pinned_at', 'is', null);
  if ((count || 0) >= MAX_PINNED) return `${MAX_PINNED} posts épinglés maximum. Désépingle-en un d'abord.`;
  const { error } = await supabase.from('updates').update({ pinned_at: new Date().toISOString() }).eq('id', u.id);
  return error ? "Impossible d'épingler ce post." : null;
}
