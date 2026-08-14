import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SERVICE_KEY')!
);

Deno.serve(async (req) => {
  // Seuls les webhooks de la base peuvent déclencher cette fonction.
  // Configure l'en-tête x-webhook-secret dans Database > Webhooks.
  const expected = Deno.env.get('WEBHOOK_SECRET');
  if (expected && req.headers.get('x-webhook-secret') !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await req.json();
  const reaction = payload.record;

  // Récupérer le post pour trouver son propriétaire
  const { data: update } = await supabase
    .from('updates')
    .select('user_id, users(full_name, push_token)')
    .eq('id', reaction.update_id)
    .single();
  // reaction.type contient l'emoji

  if (!update) return new Response('ok');

  const owner = update.users as any;
  // Ne pas notifier si c'est soi-même qui like
  if (reaction.user_id === update.user_id) return new Response('ok');
  if (!owner?.push_token) return new Response('ok');

  // Récupérer le nom de celui qui like
  const { data: liker } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', reaction.user_id)
    .single();

  await sendPush(owner.push_token, 'Nouveau like', `${liker?.full_name} a liké ton post`, 'like');

  return new Response('ok');
});

async function sendPush(token: string, title: string, body: string, type: string) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: 'default', data: { type } }),
  });
}
