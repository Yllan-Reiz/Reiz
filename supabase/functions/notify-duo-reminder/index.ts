import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Rappels d'un duo, façon BeReal : quand un ami t'a identifié dans sa séance, tu as 1 heure pour poster la tienne.
// Deux rappels, si tu n'as pas encore posté :
//   - vers 30 min de la fin (entre 28 et 38 min après son post)
//   - vers 10 min de la fin (entre 48 et 58 min après son post)
// Appelée toutes les 5 minutes par pg_cron. Chaque rappel n'est envoyé qu'une fois (table duo_reminders).
// Un rappel n'existe que s'il y avait un « duo_tag » : donc jamais pour un objectif privé, jamais pour un ami bloqué.
//
// Test sans rien envoyer : ?dry=1. Pour rejouer un instant passé : ?at=2026-10-21T10:30:00Z (avec dry=1).

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SERVICE_KEY')!);

const MIN = 60 * 1000;
const WINDOW_MIN = 60;
const STAGES = [
  { stage: 1, from: 28, to: 38, left: 'environ 30 minutes' },
  { stage: 2, from: 48, to: 58, left: 'environ 10 minutes' },
];
const first = (n?: string | null) => (n || '').split(' ')[0] || "Ton ami";

Deno.serve(async (req) => {
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('x-cron-secret') !== expected) return new Response('Unauthorized', { status: 401 });
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  const now = url.searchParams.get('at') ? new Date(url.searchParams.get('at')!) : new Date();

  // Posts avec des amis identifiés, publiés dans la dernière heure.
  const since = new Date(now.getTime() - WINDOW_MIN * MIN).toISOString();
  const { data: posts } = await supabase
    .from('updates')
    .select('id, user_id, created_at, with_user_ids')
    .gte('created_at', since).lte('created_at', now.toISOString())
    .not('with_user_ids', 'eq', '{}');
  if (!posts || posts.length === 0) return new Response(dry ? '[]' : 'Aucun duo en cours');

  // Seulement ceux qui ont reçu la notification « duo_tag » (objectif non privé, pas de blocage).
  const ids = posts.map(p => p.id);
  const { data: tags } = await supabase.from('notifications').select('recipient_id, update_id').eq('type', 'duo_tag').in('update_id', ids);
  const tagged = new Set((tags || []).map(t => `${t.update_id}:${t.recipient_id}`));

  const { data: logs } = await supabase.from('duo_reminders').select('update_id, user_id, stage').in('update_id', ids);
  const done = new Set((logs || []).map(l => `${l.update_id}:${l.user_id}:${l.stage}`));
  // Carte du duo en cours sur son iPhone (Activité en direct avec jeton) : c'est elle qui rappelle, en changeant de couleur.
  const { data: cards } = await supabase.from('live_activity_runs').select('update_id, user_id').in('update_id', ids).not('update_token', 'is', null);
  const withCard = new Set((cards || []).map(c => `${c.update_id}:${c.user_id}`));

  type Todo = { postId: string; authorId: string; userId: string; stage: number; left: string };
  const todo: Todo[] = [];
  for (const p of posts) {
    const elapsed = (now.getTime() - new Date(p.created_at).getTime()) / MIN;
    const st = STAGES.find(s => elapsed >= s.from && elapsed < s.to);
    if (!st) continue;
    for (const uid of (p.with_user_ids || []) as string[]) {
      if (!tagged.has(`${p.id}:${uid}`) || done.has(`${p.id}:${uid}:${st.stage}`) || withCard.has(`${p.id}:${uid}`)) continue;
      // Déjà validé ? Il a posté, en identifiant l'auteur, à moins d'une heure de ce post.
      const lo = new Date(new Date(p.created_at).getTime() - WINDOW_MIN * MIN).toISOString();
      const hi = new Date(new Date(p.created_at).getTime() + WINDOW_MIN * MIN).toISOString();
      const { count } = await supabase.from('updates').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).contains('with_user_ids', [p.user_id]).gte('created_at', lo).lte('created_at', hi);
      if ((count || 0) > 0) continue;
      todo.push({ postId: p.id, authorId: p.user_id, userId: uid, stage: st.stage, left: st.left });
    }
  }
  if (todo.length === 0) return new Response(dry ? '[]' : 'Rien à rappeler');

  const people = [...new Set(todo.flatMap(t => [t.authorId, t.userId]))];
  const { data: users } = await supabase.from('users').select('id, full_name, push_token').in('id', people);
  const byId = new Map((users || []).map(u => [u.id, u]));
  const { data: unreadRows } = await supabase.from('notifications').select('recipient_id').is('read_at', null).in('recipient_id', todo.map(t => t.userId));
  const unread = new Map<string, number>();
  (unreadRows || []).forEach((r: any) => unread.set(r.recipient_id, (unread.get(r.recipient_id) || 0) + 1));

  const msgs = todo.map(t => {
    const who = first(byId.get(t.authorId)?.full_name);
    return {
      t, to: byId.get(t.userId)?.push_token as string | undefined,
      title: t.stage === 1 ? `⏳ Ton duo avec ${who} expire bientôt` : `⏳ Dernière ligne droite pour ton duo avec ${who}`,
      body: t.stage === 1 ? `Il te reste ${t.left} pour poster ta séance.` : `Il reste ${t.left} : poste ta séance maintenant pour valider le duo.`,
    };
  });

  if (dry) {
    // Jamais de jeton dans la réponse.
    return new Response(JSON.stringify(msgs.map(m => ({ post: m.t.postId, stage: m.t.stage, title: m.title, body: m.body, hasToken: !!m.to })), null, 2), { headers: { 'Content-Type': 'application/json' } });
  }

  const sendable = msgs.filter(m => !!m.to);
  for (let i = 0; i < sendable.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sendable.slice(i, i + 100).map(m => ({ to: m.to, title: m.title, body: m.body, sound: 'default', badge: (unread.get(m.t.userId) || 0) + 1, data: { type: 'activity' } }))),
    });
  }
  // On note aussi ceux sans jeton : inutile de les réessayer toutes les 5 minutes.
  if (msgs.length > 0) await supabase.from('duo_reminders').upsert(msgs.map(m => ({ update_id: m.t.postId, user_id: m.t.userId, stage: m.t.stage })), { onConflict: 'update_id,user_id,stage', ignoreDuplicates: true });
  return new Response(`Rappels envoyés : ${sendable.length}`);
});
