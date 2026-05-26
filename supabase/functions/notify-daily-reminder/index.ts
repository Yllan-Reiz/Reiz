import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  // Protection conditionnelle : si CRON_SECRET est défini côté Supabase, on l'exige dans le header.
  // Configure côté cron: header `x-cron-secret: <ta-valeur>`
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('x-cron-secret') !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Récupérer tous les users avec un push_token
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, full_name, push_token')
    .not('push_token', 'is', null);

  if (!allUsers) return new Response('ok');

  // Récupérer les users qui ont posté aujourd'hui
  const { data: postedToday } = await supabase
    .from('updates')
    .select('user_id')
    .gte('created_at', todayISO);

  const postedIds = new Set((postedToday || []).map(u => u.user_id));

  // Garder uniquement ceux qui ont des objectifs ET n'ont pas posté aujourd'hui
  const { data: usersWithObjectives } = await supabase
    .from('objectives')
    .select('user_id');

  const withObjectivesIds = new Set((usersWithObjectives || []).map(o => o.user_id));

  const toNotify = allUsers.filter(
    u => !postedIds.has(u.id) && withObjectivesIds.has(u.id) && u.push_token
  );

  const messages = toNotify.map(u => ({
    to: u.push_token,
    title: '⏰ Rappel du jour',
    body: 'Tu n\'as pas encore posté aujourd\'hui. Tes objectifs t\'attendent 💪',
    sound: 'default',
  }));

  if (messages.length > 0) {
    // Envoyer par batch de 100 (limite Expo)
    for (let i = 0; i < messages.length; i += 100) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }
  }

  return new Response(`Notified ${messages.length} users`);
});
