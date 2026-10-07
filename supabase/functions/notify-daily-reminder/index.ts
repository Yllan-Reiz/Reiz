import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_KEY')!
);

const DAY = 24 * 60 * 60 * 1000;
const parisDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
const first = (name?: string | null) => (name || '').split(' ')[0] || "Quelqu'un";

// Jour de la semaine à Paris, 1 = lundi ... 7 = dimanche (même numérotation que objectives.training_days).
const isoDow = (d: Date) => {
  const w = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' })).getDay();
  return w === 0 ? 7 : w;
};

// Minuit heure de Paris, exprimé en UTC. Le serveur tourne en UTC : sans ça,
// « aujourd'hui » commençait à 2 h du matin l'été, 1 h l'hiver.
function parisMidnightISO() {
  const now = new Date();
  const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const offset = paris.getTime() - now.getTime();
  paris.setHours(0, 0, 0, 0);
  return new Date(paris.getTime() - offset).toISOString();
}

// « Enzo », « Enzo et Axel », « Enzo, Axel et 2 autres »
function namesLabel(names: string[]) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names[0]}, ${names[1]} et ${names.length - 2} autre${names.length > 3 ? 's' : ''}`;
}

// Rappel de 19 h pour ceux qui n'ont pas posté, UNIQUEMENT les jours où ils s'entraînent (planning de
// leurs objectifs, `training_days` ; sans planning = tous les jours). Le message le plus parlant gagne :
//   1. un duel en cours (« Il mène 3 à 2 »)
//   2. une série en jeu, à partir de 3 jours d'affilée
//   3. sinon, qui a déjà posté dans le cercle
// Test sans rien envoyer : ?dry=1.
Deno.serve(async (req) => {
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('x-cron-secret') !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }
  const dry = new URL(req.url).searchParams.get('dry') === '1';

  const sinceISO = parisMidnightISO();
  const since40 = new Date(Date.now() - 40 * DAY).toISOString();

  const [usersRes, postedRes, objRes, friendsRes, updRes, duelRes, unreadRes] = await Promise.all([
    supabase.from('users').select('id, full_name, push_token'),
    supabase.from('updates').select('user_id').gte('created_at', sinceISO),
    supabase.from('objectives').select('user_id, training_days'),
    supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted'),
    supabase.from('updates').select('user_id, created_at, objectives(visibility)').gte('created_at', since40),
    // Avant la phase 12 la table n'existe pas : l'erreur est ignorée, le rappel marche comme avant.
    supabase.from('duo_challenges').select('challenger_id, opponent_id, starts_at, ends_at').eq('status', 'active'),
    // Pour la pastille de l'icône : les notifications non lues de chacun.
    supabase.from('notifications').select('recipient_id').is('read_at', null),
  ]);
  const unread = new Map<string, number>();
  (unreadRes.data || []).forEach((r: any) => unread.set(r.recipient_id, (unread.get(r.recipient_id) || 0) + 1));

  // Avant la phase 12 la colonne `training_days` n'existe pas : on relit sans elle, tous les jours comptent.
  let objRows: { user_id: string; training_days?: number[] | null }[] = objRes.data || [];
  if (objRes.error) objRows = (await supabase.from('objectives').select('user_id')).data || [];

  const users = usersRes.data || [];
  const nameOf = new Map(users.map(u => [u.id, u.full_name as string]));
  const postedIds = new Set((postedRes.data || []).map(u => u.user_id));
  const withObjectives = new Set(objRows.map(o => o.user_id));
  // Planning de chacun : « tous les jours » dès qu'un objectif n'a pas de planning, sinon l'ensemble des jours prévus.
  const schedule = new Map<string, { every: boolean; days: Set<number> }>();
  objRows.forEach(o => {
    const s = schedule.get(o.user_id) || { every: false, days: new Set<number>() };
    if (!o.training_days || o.training_days.length === 0 || o.training_days.length >= 7) s.every = true;
    else o.training_days.forEach(d => s.days.add(d));
    schedule.set(o.user_id, s);
  });
  const trainsOn = (uid: string, dow: number) => { const s = schedule.get(uid); return !s || s.every || s.days.has(dow); };
  const todayDow = isoDow(new Date());

  const friendsOf = new Map<string, string[]>();
  (friendsRes.data || []).forEach(f => {
    friendsOf.set(f.requester_id, [...(friendsOf.get(f.requester_id) || []), f.receiver_id]);
    friendsOf.set(f.receiver_id, [...(friendsOf.get(f.receiver_id) || []), f.requester_id]);
  });

  // Posts des 40 derniers jours : jours Paris (série) et posts visibles (score des duels).
  const rowsOf = new Map<string, { t: number; day: string; priv: boolean }[]>();
  (updRes.data || []).forEach((r: any) => {
    const t = new Date(r.created_at).getTime();
    rowsOf.set(r.user_id, [...(rowsOf.get(r.user_id) || []), { t, day: parisDay(new Date(t)), priv: r.objectives?.visibility === 'private' }]);
  });
  // Série en cours jusqu'à hier. Un jour de repos ne la casse pas : on le saute. Seul un jour PRÉVU
  // sans séance l'arrête.
  const streakEndingYesterday = (uid: string) => {
    const days = new Set((rowsOf.get(uid) || []).map(r => r.day));
    let n = 0;
    let d = new Date(Date.now() - DAY);
    for (let i = 0; i < 60; i++) {
      if (days.has(parisDay(d))) n++;
      else if (trainsOn(uid, isoDow(d))) break;
      d = new Date(d.getTime() - DAY);
    }
    return n;
  };
  const duelScore = (uid: string, from: number, to: number) =>
    new Set((rowsOf.get(uid) || []).filter(r => !r.priv && r.t >= from && r.t < to).map(r => r.day)).size;

  const activeDuels = (duelRes.data || []) as { challenger_id: string; opponent_id: string; starts_at: string; ends_at: string }[];

  // Seulement ceux qui ont un objectif ET n'ont rien posté depuis minuit.
  const messages = users
    .filter(u => u.push_token && withObjectives.has(u.id) && !postedIds.has(u.id) && trainsOn(u.id, todayDow))
    .map(u => {
      const posted = (friendsOf.get(u.id) || [])
        .filter(id => postedIds.has(id))
        .map(id => nameOf.get(id))
        .filter(Boolean) as string[];

      let title = "⏰ Pas encore posté aujourd'hui";
      let body = posted.length > 0
        ? `${namesLabel(posted)} ${posted.length > 1 ? 'ont' : 'a'} déjà posté aujourd'hui. Et toi ?`
        : "Personne n'a encore posté dans ton cercle. Montre l'exemple.";

      const streak = streakEndingYesterday(u.id);
      if (streak >= 3) {
        title = `🔥 Ta série de ${streak} jours est en jeu`;
        body = posted.length > 0 ? `Une séance et elle continue. ${namesLabel(posted)} ${posted.length > 1 ? 'ont' : 'a'} déjà posté.` : 'Une séance aujourd\'hui et elle continue.';
      }

      const duel = activeDuels.find(d => d.challenger_id === u.id || d.opponent_id === u.id);
      if (duel) {
        const other = duel.challenger_id === u.id ? duel.opponent_id : duel.challenger_id;
        const from = new Date(duel.starts_at).getTime();
        const to = new Date(duel.ends_at).getTime();
        const mine = duelScore(u.id, from, to);
        const theirs = duelScore(other, from, to);
        title = `⚔️ Ton duel contre ${first(nameOf.get(other))}`;
        body = mine < theirs ? `Il mène ${theirs} à ${mine}. Poste aujourd'hui pour revenir.`
          : mine > theirs ? `Tu mènes ${mine} à ${theirs}. Poste aujourd'hui pour creuser l'écart.`
          : `Égalité ${mine} à ${theirs}. Ta séance du jour fait la différence.`;
      }

      // Le rappel n'est pas enregistré en base : on l'ajoute au nombre de non lus pour la pastille de l'icône.
      return { to: u.push_token, title, body, sound: 'default', badge: (unread.get(u.id) || 0) + 1, data: { type: 'reminder' }, who: u.full_name };
    });

  if (dry) {
    // Jamais de jeton dans la réponse : seulement qui recevrait quoi.
    return new Response(JSON.stringify(messages.map(m => ({ user: m.who, title: m.title, body: m.body })), null, 2), { headers: { 'Content-Type': 'application/json' } });
  }

  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100).map(({ who, ...m }) => m)),
    });
  }

  return new Response(`Notified ${messages.length} users`);
});
