import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Encouragements personnels, une fois par matin (10 h 30 à Paris).
// Deux situations, une seule notification par personne et par passage :
//   almost   : un objectif est à 75 % ou 90 % (« Plus que 2 séances »)
//   comeback : aucun post depuis 3, 7 ou 14 jours
// Garde-fous : au plus un message tous les 2 jours par personne, jamais deux fois le
// même palier (table encouragement_log), rien si la personne a déjà posté aujourd'hui,
// rien si elle a coupé l'option dans Réglages (users.notif_encouragement).
//
// Test sans rien envoyer : ajouter ?dry=1 à l'URL. Pour cibler une seule personne : ?only=pseudo.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_KEY')!
);

const DAY = 24 * 60 * 60 * 1000;
const parisDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / DAY);

const num = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
// « 1 séances » → « 1 séance »
const unitLabel = (unit: string, n: number) => (n === 1 && unit === 'séances' ? 'séance' : unit);
// Jour de la semaine d'un jour Paris « AAAA-MM-JJ » : 1 = lundi ... 7 = dimanche.
const isoDowOf = (day: string) => { const w = new Date(`${day}T12:00:00Z`).getUTCDay(); return w === 0 ? 7 : w; };
const first = (name?: string | null) => (name || '').split(' ')[0] || "Quelqu'un";

type Msg = { userId: string; kind: 'almost' | 'comeback'; ref: string; title: string; body: string; to: string };

Deno.serve(async (req) => {
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('x-cron-secret') !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  const only = url.searchParams.get('only');

  const now = new Date();
  const today = parisDay(now);
  const since60 = new Date(now.getTime() - 60 * DAY).toISOString();
  const since14 = new Date(now.getTime() - 14 * DAY).toISOString();

  const [usersRes, objRes, updRes, logRes, friendsRes, unreadRes] = await Promise.all([
    supabase.from('users').select('id, full_name, username, push_token, notif_encouragement').not('push_token', 'is', null),
    supabase.from('objectives').select('id, user_id, emoji, title, current_value, target_value, unit, is_completed, training_days'),
    supabase.from('updates').select('user_id, created_at').gte('created_at', since60),
    supabase.from('encouragement_log').select('user_id, kind, ref, sent_at').gte('sent_at', since14),
    supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted'),
    // Pour la pastille de l'icône : les notifications non lues de chacun.
    supabase.from('notifications').select('recipient_id').is('read_at', null),
  ]);
  const unread = new Map<string, number>();
  (unreadRes.data || []).forEach((r: any) => unread.set(r.recipient_id, (unread.get(r.recipient_id) || 0) + 1));

  // Avant la phase 12 la colonne `training_days` n'existe pas : on relit sans elle, tous les jours comptent.
  let objRows: any[] = objRes.data || [];
  if (objRes.error) objRows = (await supabase.from('objectives').select('id, user_id, emoji, title, current_value, target_value, unit, is_completed')).data || [];

  const users = (usersRes.data || []).filter(u => u.notif_encouragement !== false && (!only || u.username === only));
  const nameOf = new Map((usersRes.data || []).map(u => [u.id, u.full_name as string]));

  // Jours Paris où chacun a posté (60 derniers jours).
  const postDays = new Map<string, Set<string>>();
  (updRes.data || []).forEach(r => {
    const set = postDays.get(r.user_id) || new Set<string>();
    set.add(parisDay(new Date(r.created_at)));
    postDays.set(r.user_id, set);
  });
  const objectivesOf = new Map<string, any[]>();
  objRows.forEach(o => objectivesOf.set(o.user_id, [...(objectivesOf.get(o.user_id) || []), o]));
  const logsOf = new Map<string, { kind: string; ref: string | null; sent_at: string }[]>();
  (logRes.data || []).forEach(l => logsOf.set(l.user_id, [...(logsOf.get(l.user_id) || []), l]));
  const friendsOf = new Map<string, string[]>();
  (friendsRes.data || []).forEach(f => {
    friendsOf.set(f.requester_id, [...(friendsOf.get(f.requester_id) || []), f.receiver_id]);
    friendsOf.set(f.receiver_id, [...(friendsOf.get(f.receiver_id) || []), f.requester_id]);
  });

  const msgs: Msg[] = [];
  for (const u of users) {
    const days = postDays.get(u.id) || new Set<string>();
    const objectives = objectivesOf.get(u.id) || [];
    if (objectives.length === 0) continue;               // pas encore lancé
    if (days.has(today)) continue;                       // a déjà posté, on ne l'embête pas
    // Planning : jamais un jour de repos. Sans planning (training_days vide) l'objectif compte tous les jours.
    const dow = isoDowOf(today);
    const scheduledOn = (o: any, d: number) => !o.training_days || o.training_days.length === 0 || o.training_days.length >= 7 || o.training_days.includes(d);
    if (!objectives.some((o: any) => scheduledOn(o, dow))) continue;
    const logs = logsOf.get(u.id) || [];
    if (logs.some(l => now.getTime() - new Date(l.sent_at).getTime() < 2 * DAY)) continue;

    // 1) Un objectif à 75 % ou 90 % : le palier n'est annoncé qu'une fois.
    let best: { o: any; ratio: number; ref: string } | null = null;
    for (const o of objectives) {
      if (o.is_completed || !(o.target_value > 0) || !scheduledOn(o, dow)) continue;
      const ratio = (o.current_value || 0) / o.target_value;
      if (ratio < 0.75 || ratio >= 1) continue;
      const ref = `${o.id}:${ratio >= 0.9 ? 90 : 75}`;
      if (logs.some(l => l.ref === ref)) continue;
      if (!best || ratio > best.ratio) best = { o, ratio, ref };
    }
    if (best) {
      const { o } = best;
      const left = o.target_value - (o.current_value || 0);
      const pct = o.unit === '%';
      msgs.push({
        userId: u.id, kind: 'almost', ref: best.ref, to: u.push_token,
        title: pct ? `Plus que ${num(left)} % 🔥` : `Plus que ${num(left)} ${unitLabel(o.unit, left)} 🔥`,
        body: `« ${`${o.emoji || ''} ${o.title}`.trim()} » : ${num(o.current_value || 0)} / ${num(o.target_value)}${pct ? ' %' : ''}. Tu y es presque.`,
      });
      continue;
    }

    // 2) Retour : 3, 7 ou 14 jours sans poster (le dernier post doit exister dans les 60 derniers jours).
    if (days.size === 0) continue;
    const lastDay = [...days].sort().pop()!;
    const gap = daysBetween(lastDay, today);
    if (![3, 7, 14].includes(gap)) continue;
    // Il faut avoir RATÉ au moins un jour prévu depuis le dernier post (vendredi puis lundi, avec le week-end de repos, n'est pas un oubli).
    let missed = 0;
    for (let k = 1; k < gap; k++) {
      const d = new Date(`${lastDay}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + k);
      const dd = isoDowOf(d.toISOString().slice(0, 10));
      if (objectives.some((o: any) => scheduledOn(o, dd))) missed++;
    }
    if (missed === 0) continue;
    const ref = `gap:${gap}:${lastDay}`;
    if (logs.some(l => l.ref === ref)) continue;
    // Preuve sociale : des amis qui ont posté ces 3 derniers jours.
    const recentFriends = (friendsOf.get(u.id) || []).filter(fid => {
      const fd = postDays.get(fid);
      return fd && [...fd].some(d => daysBetween(d, today) <= 3);
    }).map(fid => first(nameOf.get(fid)));
    const friendLine = recentFriends.length === 1
      ? `${recentFriends[0]} a posté ces derniers jours.`
      : recentFriends.length > 1 ? `${recentFriends[0]} et ${recentFriends[1]} ont posté ces derniers jours.` : '';
    const copy = gap === 3
      ? { title: 'Ça fait 3 jours 👀', body: 'Une petite séance suffit pour relancer la machine.' }
      : gap === 7
        ? { title: 'Une semaine sans poster', body: 'Reviens avec une séance, même courte.' }
        : { title: 'Ton cercle pense à toi', body: 'Pose-toi un petit objectif et reprends en douceur.' };
    msgs.push({ userId: u.id, kind: 'comeback', ref, to: u.push_token, title: copy.title, body: [copy.body, friendLine].filter(Boolean).join(' ') });
  }

  if (dry) {
    // Jamais de jeton dans la réponse : seulement qui recevrait quoi.
    return new Response(JSON.stringify(msgs.map(m => ({ user: nameOf.get(m.userId), kind: m.kind, ref: m.ref, title: m.title, body: m.body })), null, 2), { headers: { 'Content-Type': 'application/json' } });
  }

  for (let i = 0; i < msgs.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgs.slice(i, i + 100).map(m => ({ to: m.to, title: m.title, body: m.body, sound: 'default', badge: (unread.get(m.userId) || 0) + 1, data: { type: 'reminder' } }))),
    });
  }
  if (msgs.length > 0) {
    await supabase.from('encouragement_log').insert(msgs.map(m => ({ user_id: m.userId, kind: m.kind, ref: m.ref })));
  }
  return new Response(`Encouraged ${msgs.length} users`);
});
