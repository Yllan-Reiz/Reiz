import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_KEY')!
);

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

Deno.serve(async (req) => {
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('x-cron-secret') !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sinceISO = parisMidnightISO();

  const [usersRes, postedRes, objRes, friendsRes] = await Promise.all([
    supabase.from('users').select('id, full_name, push_token'),
    supabase.from('updates').select('user_id').gte('created_at', sinceISO),
    supabase.from('objectives').select('user_id'),
    supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted'),
  ]);

  const users = usersRes.data || [];
  const nameOf = new Map(users.map(u => [u.id, u.full_name as string]));
  const postedIds = new Set((postedRes.data || []).map(u => u.user_id));
  const withObjectives = new Set((objRes.data || []).map(o => o.user_id));

  const friendsOf = new Map<string, string[]>();
  (friendsRes.data || []).forEach(f => {
    friendsOf.set(f.requester_id, [...(friendsOf.get(f.requester_id) || []), f.receiver_id]);
    friendsOf.set(f.receiver_id, [...(friendsOf.get(f.receiver_id) || []), f.requester_id]);
  });

  // Seulement ceux qui ont un objectif ET n'ont rien posté depuis minuit.
  const messages = users
    .filter(u => u.push_token && withObjectives.has(u.id) && !postedIds.has(u.id))
    .map(u => {
      const posted = (friendsOf.get(u.id) || [])
        .filter(id => postedIds.has(id))
        .map(id => nameOf.get(id))
        .filter(Boolean) as string[];
      const body = posted.length > 0
        ? `${namesLabel(posted)} ${posted.length > 1 ? 'ont' : 'a'} déjà posté aujourd'hui. Et toi ?`
        : "Personne n'a encore posté dans ton cercle. Montre l'exemple.";
      return {
        to: u.push_token,
        title: "⏰ Pas encore posté aujourd'hui",
        body,
        sound: 'default',
        data: { type: 'reminder' },
      };
    });

  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }

  return new Response(`Notified ${messages.length} users`);
});
