import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const MESSAGES = [
  'Ton cercle attend ta progression 👀',
  'Les meilleurs ne s\'arrêtent jamais. Et toi ? 🔥',
  'Montre à ton cercle ce dont tu es capable 🚀',
  'Ta streak t\'attend. Lance-toi ! ⚡',
  'Un petit update aujourd\'hui ? Tes amis regardent 💪',
  'Ça fait un moment... où en es-tu ? 🎯',
  'Chaque jour compte. Poste ta progression ✅',
  'Ton cercle progresse. Tu ne veux pas rester en arrière ? 🏆',
];

Deno.serve(async (req) => {
  // Protection conditionnelle : si CRON_SECRET est défini côté Supabase, on l'exige dans le header.
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('x-cron-secret') !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: users } = await supabase
    .from('users')
    .select('push_token')
    .not('push_token', 'is', null);

  if (!users) return new Response('ok');

  const randomBody = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  const messages = users
    .filter(u => u.push_token)
    .map(u => ({
      to: u.push_token,
      title: '💥 Reiz',
      body: randomBody,
      sound: 'default',
    }));

  if (messages.length > 0) {
    for (let i = 0; i < messages.length; i += 100) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }
  }

  return new Response(`Random reminder sent to ${messages.length} users`);
});
