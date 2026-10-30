import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { T, asLang, fill, names } from './texts.ts';

// Le moment Reiz (phase 29, 30/10/2026) : une notification par jour, qui s'adapte à chacun. Remplace le rappel de 19 h.
//   jour d'entraînement (jours de ses objectifs) : vers son heure habituelle de post (médiane des 30 derniers jours,
//     18 h sans historique), à 30 minutes près au hasard : « ⚡ Ta séance du jour »
//   jour de repos : une heure au hasard entre 10 h et 20 h : « 🛌 Ta récup du jour »
//   toujours entre 9 h et 21 h à l'heure de la personne (users.timezone), jamais pendant les heures calmes
// Posté dans les 10 minutes : « ⚡ À l'heure » dans le fil (l'app compare à moments.at). Rien si la personne a déjà
// posté dans la journée. Toutes les 5 minutes (tâche reiz-moment) : tire les moments du jour qui manquent, envoie
// ceux dont l'heure est passée. Test sans rien envoyer ni écrire : ?dry=1 (montre aussi les moments à venir).

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SERVICE_KEY')!);

const DAY = 24 * 60 * 60 * 1000;
const WINDOW_FROM = 9 * 60;
const WINDOW_TO = 21 * 60;
const DEFAULT_SESSION = 18 * 60;
const JITTER = 30;
const first = (name?: string | null) => (name || '').split(' ')[0] || '';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Le jour, l'heure et minuit (en UTC) à l'heure de `tz`, Paris si le fuseau est absent ou inconnu. */
function local(tz: string | null | undefined, at = new Date()) {
  for (const zone of [tz || 'Europe/Paris', 'Europe/Paris']) {
    try {
      const day = at.toLocaleDateString('en-CA', { timeZone: zone });
      const wall = new Date(at.toLocaleString('en-US', { timeZone: zone }));
      const offset = wall.getTime() - at.getTime();
      const midnight = new Date(wall); midnight.setHours(0, 0, 0, 0);
      const w = wall.getDay();
      return { zone, day, minutes: wall.getHours() * 60 + wall.getMinutes(), dow: w === 0 ? 7 : w, midnight: midnight.getTime() - offset };
    } catch { /* fuseau inconnu */ }
  }
  throw new Error('fuseau');
}

// Un texte différent chaque jour, mais stable pour une personne dans la journée.
const pick = <X>(list: X[], seed: string) => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
};

Deno.serve(async (req) => {
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('x-cron-secret') !== expected) return new Response('Unauthorized', { status: 401 });
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY).toISOString();

  const [usersRes, objRes, updRes, momRes, friendsRes, unreadRes] = await Promise.all([
    supabase.from('users').select('id, full_name, push_token, language, timezone'),
    supabase.from('objectives').select('user_id, training_days'),
    supabase.from('updates').select('user_id, created_at').gte('created_at', since30),
    supabase.from('moments').select('user_id, day, kind, at, sent_at').gte('day', new Date(now.getTime() - 2 * DAY).toISOString().slice(0, 10)),
    supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted'),
    supabase.from('notifications').select('recipient_id').is('read_at', null),
  ]);
  if (momRes.error) return new Response(`moments: ${momRes.error.message}`, { status: 500 });

  const users = usersRes.data || [];
  const nameOf = new Map<string, string>(users.map((u: any) => [u.id, u.full_name]));
  const tzOf = new Map<string, string | null>(users.map((u: any) => [u.id, u.timezone]));
  const plans = new Map<string, { every: boolean; days: Set<number> }>();
  (objRes.data || []).forEach((o: any) => {
    const p = plans.get(o.user_id) || { every: false, days: new Set<number>() };
    if (!o.training_days || o.training_days.length === 0 || o.training_days.length >= 7) p.every = true;
    else o.training_days.forEach((d: number) => p.days.add(d));
    plans.set(o.user_id, p);
  });
  const postsOf = new Map<string, Date[]>();
  (updRes.data || []).forEach((u: any) => postsOf.set(u.user_id, [...(postsOf.get(u.user_id) || []), new Date(u.created_at)]));
  const moments = new Map<string, any>();
  (momRes.data || []).forEach((m: any) => moments.set(`${m.user_id}|${m.day}`, m));
  const friendsOf = new Map<string, string[]>();
  (friendsRes.data || []).forEach((f: any) => {
    friendsOf.set(f.requester_id, [...(friendsOf.get(f.requester_id) || []), f.receiver_id]);
    friendsOf.set(f.receiver_id, [...(friendsOf.get(f.receiver_id) || []), f.requester_id]);
  });
  const unread = new Map<string, number>();
  (unreadRes.data || []).forEach((r: any) => unread.set(r.recipient_id, (unread.get(r.recipient_id) || 0) + 1));
  const postedToday = (uid: string, day: string) => (postsOf.get(uid) || []).some(d => local(tzOf.get(uid), d).day === day);

  const created: any[] = [];
  const due: { m: any; u: any; L: ReturnType<typeof local> }[] = [];
  for (const u of users) {
    const plan = plans.get(u.id);
    if (!plan) continue;                                  // pas d'objectif : rien à poster
    const L = local(u.timezone);
    let m = moments.get(`${u.id}|${L.day}`);
    if (!m) {
      const kind = plan.every || plan.days.has(L.dow) ? 'session' : 'recovery';
      let minutes: number;
      if (kind === 'session') {
        const mins = (postsOf.get(u.id) || []).map(d => local(u.timezone, d).minutes).sort((a, b) => a - b);
        const habit = mins.length >= 3 ? mins[Math.floor(mins.length / 2)] : DEFAULT_SESSION;
        minutes = clamp(habit + Math.round((Math.random() * 2 - 1) * JITTER), WINDOW_FROM, WINDOW_TO - 10);
      } else {
        minutes = 10 * 60 + Math.floor(Math.random() * 10 * 60);
      }
      // Objectif créé dans la journée, heure déjà passée : dans 5 minutes si on est encore dans la fenêtre.
      if (minutes <= L.minutes) minutes = L.minutes + 5 <= WINDOW_TO ? L.minutes + 5 : -1;
      if (minutes < 0) continue;
      m = { user_id: u.id, day: L.day, kind, at: new Date(L.midnight + minutes * 60 * 1000).toISOString(), sent_at: null };
      created.push(m);
    }
    if (!m.sent_at && new Date(m.at).getTime() <= now.getTime()) due.push({ m, u, L });
  }

  const pushes: any[] = [];
  const done: { user_id: string; day: string; skipped: string | null }[] = [];
  for (const { m, u, L } of due) {
    if (postedToday(u.id, L.day)) { done.push({ user_id: u.id, day: m.day, skipped: 'posted' }); continue; }
    if (!u.push_token) { done.push({ user_id: u.id, day: m.day, skipped: 'no_push' }); continue; }
    const lang = asLang(u.language);
    const t = T[lang];
    const session = m.kind === 'session';
    const posted = (friendsOf.get(u.id) || []).filter(id => postedToday(id, L.day)).map(id => first(nameOf.get(id))).filter(Boolean);
    const social = posted.length === 0 ? '' : fill(posted.length > 1 ? t.momentFriends : t.momentFriendsOne, { names: names(lang, posted.slice(0, 2)) });
    const line = pick(session ? t.momentSession : t.momentRecovery, `${u.id}${m.day}`);
    pushes.push({
      to: u.push_token,
      title: session ? t.momentSessionTitle : t.momentRecoveryTitle,
      body: [line, social].filter(Boolean).join(' '),
      sound: 'default',
      badge: (unread.get(u.id) || 0) + 1,
      // Taper la notification ouvre directement la publication, en mode moment.
      data: { type: 'moment', kind: m.kind },
      _who: u.full_name,
    });
    done.push({ user_id: u.id, day: m.day, skipped: null });
  }

  if (dry) {
    const soon = created.concat((momRes.data || []).filter((x: any) => !x.sent_at))
      .map((x: any) => ({ user: nameOf.get(x.user_id), kind: x.kind, at: new Date(x.at).toLocaleString('fr-FR', { timeZone: local(tzOf.get(x.user_id)).zone }) }));
    return new Response(JSON.stringify({ created: created.length, due: due.length, pushes: pushes.map(p => ({ user: p._who, title: p.title, body: p.body })), moments: soon }, null, 2), { headers: { 'Content-Type': 'application/json' } });
  }

  if (created.length > 0) await supabase.from('moments').upsert(created, { onConflict: 'user_id,day', ignoreDuplicates: true });
  for (let i = 0; i < pushes.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushes.slice(i, i + 100).map(({ _who, ...p }) => p)),
    });
  }
  const sentAt = new Date().toISOString();
  for (const d of done) {
    await supabase.from('moments').update({ sent_at: sentAt, skipped: d.skipped }).eq('user_id', d.user_id).eq('day', d.day);
  }
  return new Response(`Moments: ${created.length} tirés, ${pushes.length} envoyés, ${done.length - pushes.length} écartés`);
});
