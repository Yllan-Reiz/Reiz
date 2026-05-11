import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const payload = await req.json();
  const friendship = payload.record;

  // Seulement pour les nouvelles demandes (status = pending)
  if (friendship.status !== 'pending') return new Response('ok');

  // Récupérer le nom de celui qui envoie la demande
  const { data: requester } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', friendship.requester_id)
    .single();

  // Récupérer le token du destinataire
  const { data: receiver } = await supabase
    .from('users')
    .select('push_token')
    .eq('id', friendship.receiver_id)
    .single();

  if (!requester || !receiver?.push_token) return new Response('ok');

  await sendPush(
    receiver.push_token,
    '👋 Nouvelle demande d\'ami',
    `${requester.full_name} t'a ajouté sur Reiz`
  );

  return new Response('ok');
});

async function sendPush(token: string, title: string, body: string) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: 'default' }),
  });
}
