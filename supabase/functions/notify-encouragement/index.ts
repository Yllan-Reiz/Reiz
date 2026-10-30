import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { T, asLang, fill, names } from './texts.ts';

// Les messages du matin (10 h 30 à Paris), une seule notification par personne et par passage :
//   friend : une demande d'ami attend depuis plus de 2 jours (une relance par demande)
//   cheer  : un ami est à l'arrêt (3, 7 ou 14 jours sans post, un jour prévu manqué) : jusqu'à 2 amis actifs sont
//            prévenus, ceux qui l'ont en cercle proche d'abord. Le tap ouvre l'Activité et son bouton « Relancer ».
// Les encouragements « presque au but », « premier post » et « retour » sont partis dans le moment Reiz
// (notify-moment, chantier 5 du 30/10/2026) : envoyés à 10 h 30, ils ne déclenchaient aucun post dans les 2 h.
// Garde-fous : au plus un de ces messages tous les 2 jours, l'option Réglages respectée (users.notif_encouragement),
// des deux côtés pour « cheer » ; jamais entre comptes bloqués, jamais pour un ami sans objectif visible.
//
// Test sans rien envoyer : ajouter ?dry=1 à l'URL. Pour cibler une seule personne : ?only=pseudo.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_KEY')!
);

const DAY = 24 * 60 * 60 * 1000;
const parisDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / DAY);

// Jour de la semaine d'un jour Paris « AAAA-MM-JJ » : 1 = lundi ... 7 = dimanche.
const isoDowOf = (day: string) => { const w = new Date(`${day}T12:00:00Z`).getUTCDay(); return w === 0 ? 7 : w; };
const first = (name?: string | null) => (name || '').split(' ')[0] || '';

type Msg = { userId: string; kind: 'friend' | 'cheer'; ref: string; title: string; body: string; to: string; also?: string[] };

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

  const [usersRes, objRes, updRes, logRes, friendsRes, unreadRes, waitRes, namesRes, closeRes, blocksRes] = await Promise.all([
    supabase.from('users').select('id, full_name, username, push_token, notif_encouragement, language').not('push_token', 'is', null),
    supabase.from('objectives').select('user_id, visibility, training_days'),
    supabase.from('updates').select('user_id, created_at').gte('created_at', since60),
    supabase.from('encouragement_log').select('user_id, kind, ref, sent_at').gte('sent_at', since14),
    supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted'),
    // Pour la pastille de l'icône : les notifications non lues de chacun.
    supabase.from('notifications').select('recipient_id').is('read_at', null),
    // Demandes d'ami sans réponse depuis 2 à 30 jours.
    supabase.from('friendships').select('id, requester_id, receiver_id, created_at').eq('status', 'pending')
      .lt('created_at', new Date(now.getTime() - 2 * DAY).toISOString()).gt('created_at', new Date(now.getTime() - 30 * DAY).toISOString())
      .order('created_at'),
    // Le prénom de celui qui demande, même sans notifications de son côté.
    supabase.from('users').select('id, full_name, notif_encouragement'),
    supabase.from('close_friends').select('owner_id, friend_id'),
    supabase.from('blocks').select('blocker_id, blocked_id'),
  ]);
  const unread = new Map<string, number>();
  (unreadRes.data || []).forEach((r: any) => unread.set(r.recipient_id, (unread.get(r.recipient_id) || 0) + 1));

  const objRows: any[] = objRes.data || [];

  const users = (usersRes.data || []).filter(u => u.notif_encouragement !== false && (!only || u.username === only));
  const nameOf = new Map((usersRes.data || []).map(u => [u.id, u.full_name as string]));
  const anyName = new Map<string, string>((namesRes.data || []).map((u: any) => [u.id, u.full_name]));
  const waitingOf = new Map<string, { id: string; requester_id: string }[]>();
  (waitRes.data || []).forEach((f: any) => waitingOf.set(f.receiver_id, [...(waitingOf.get(f.receiver_id) || []), f]));

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

  // Seuls ces messages comptent pour l'écart de 2 jours : les encouragements du moment Reiz sont dans le même journal.
  const recentMorning = (logs: { kind: string; sent_at: string }[]) =>
    logs.some(l => (l.kind === 'friend' || l.kind === 'cheer') && now.getTime() - new Date(l.sent_at).getTime() < 2 * DAY);

  const msgs: Msg[] = [];
  for (const u of users) {
    const lang = asLang(u.language);
    const t = T[lang];
    const logs = logsOf.get(u.id) || [];
    const recent = recentMorning(logs);

    // Quelqu'un attend sa réponse, même sans objectif (souvent un compte tout neuf).
    // Une relance par demande (encouragement_log, ref friend:<id>), jamais deux messages en 2 jours.
    const waiting = (waitingOf.get(u.id) || []).filter(f => !logs.some(l => l.ref === `friend:${f.id}`));
    if (waiting.length > 0 && !recent) {
      const who = waiting.map(f => first(anyName.get(f.requester_id)) || t.someone);
      msgs.push({
        userId: u.id, kind: 'friend', ref: `friend:${waiting[0].id}`, also: waiting.slice(1).map(f => `friend:${f.id}`), to: u.push_token,
        title: waiting.length === 1 ? fill(t.friendWaitTitle, { name: who[0] }) : fill(t.friendWaitManyTitle, { n: waiting.length }),
        body: waiting.length === 1 ? t.friendWaitBody : fill(t.friendWaitManyBody, { names: names(lang, who) }),
      });
    }
  }

  // Le cercle relance : pour chaque ami à l'arrêt, jusqu'à 2 amis actifs.
  const notified = new Set(msgs.map(m => m.userId));
  const byId = new Map<string, any>(users.map((u: any) => [u.id, u]));
  const scheduledOn = (o: any, d: number) => !o.training_days || o.training_days.length === 0 || o.training_days.length >= 7 || o.training_days.includes(d);
  const closeOf = new Set((closeRes.data || []).map((c: any) => `${c.owner_id}|${c.friend_id}`));
  const blocked = new Set((blocksRes.data || []).flatMap((b: any) => [`${b.blocker_id}|${b.blocked_id}`, `${b.blocked_id}|${b.blocker_id}`]));
  for (const person of namesRes.data || []) {
    if (person.notif_encouragement === false) continue;
    const objectives = objectivesOf.get(person.id) || [];
    if (!objectives.some((o: any) => o.visibility !== 'private')) continue;
    const days = postDays.get(person.id);
    if (!days || days.size === 0 || days.has(today)) continue;
    const lastDay = [...days].sort().pop()!;
    const gap = daysBetween(lastDay, today);
    if (![3, 7, 14].includes(gap)) continue;
    let missed = 0;
    for (let k = 1; k < gap; k++) {
      const d = new Date(`${lastDay}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + k);
      if (objectives.some((o: any) => scheduledOn(o, isoDowOf(d.toISOString().slice(0, 10))))) missed++;
    }
    if (missed === 0) continue;
    const ref = `cheer:${person.id}:${lastDay}`;
    const activeRecently = (id: string) => [...(postDays.get(id) || [])].some(d => daysBetween(d, today) <= 3);
    const candidates = (friendsOf.get(person.id) || [])
      .filter(id => byId.has(id) && !notified.has(id) && !blocked.has(`${id}|${person.id}`) && activeRecently(id))
      .filter(id => { const logs = logsOf.get(id) || []; return !recentMorning(logs) && !logs.some(l => l.ref === ref); })
      .sort((a, b) => Number(closeOf.has(`${b}|${person.id}`)) - Number(closeOf.has(`${a}|${person.id}`)))
      .slice(0, 2);
    for (const id of candidates) {
      const u = byId.get(id)!;
      const t = T[asLang(u.language)];
      msgs.push({ userId: id, kind: 'cheer', ref, to: u.push_token, title: fill(t.cheerTitle, { name: first(person.full_name) || t.someone, n: gap }), body: t.cheerBody });
      notified.add(id);
    }
  }

  if (dry) {
    // Jamais de jeton dans la réponse : seulement qui recevrait quoi.
    return new Response(JSON.stringify(msgs.map(m => ({ user: nameOf.get(m.userId), kind: m.kind, ref: m.ref, title: m.title, body: m.body })), null, 2), { headers: { 'Content-Type': 'application/json' } });
  }

  for (let i = 0; i < msgs.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Une relance de demande d'ami ouvre l'onglet Amis ; un ami à l'arrêt, l'Activité et son bouton « Relancer ».
      body: JSON.stringify(msgs.slice(i, i + 100).map(m => ({ to: m.to, title: m.title, body: m.body, sound: 'default', badge: (unread.get(m.userId) || 0) + 1, data: { type: m.kind === 'friend' ? 'friend_request' : 'activity' } }))),
    });
  }
  if (msgs.length > 0) {
    await supabase.from('encouragement_log').insert(msgs.flatMap(m => [m.ref, ...(m.also || [])].map(ref => ({ user_id: m.userId, kind: m.kind, ref }))));
  }
  return new Response(`Encouraged ${msgs.length} users`);
});
