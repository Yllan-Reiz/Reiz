import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { T, asLang, type Lang } from './texts.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_KEY')!
);

// Messages dans texts.ts (T[langue].random), le même numéro tiré pour tout le monde, chacun dans sa langue.

Deno.serve(async (req) => {
  // Protection conditionnelle : si CRON_SECRET est défini côté Supabase, on l'exige dans le header.
  const expected = Deno.env.get('CRON_SECRET');
  if (expected && req.headers.get('x-cron-secret') !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: users } = await supabase
    .from('users')
    .select('push_token, language')
    .not('push_token', 'is', null);

  if (!users) return new Response('ok');

  const pick = Math.floor(Math.random() * T.fr.random.length);
  const bodyFor = (l: Lang) => T[l].random[pick] ?? T.fr.random[pick];

  const messages = users
    .filter(u => u.push_token)
    .map(u => ({
      to: u.push_token,
      title: 'Reiz',
      body: bodyFor(asLang(u.language)),
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
