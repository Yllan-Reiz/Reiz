import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const payload = await req.json();
  const update = payload.record;

  // Récupérer le nom du poster
  const { data: poster } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', update.user_id)
    .single();

  if (!poster) return new Response('ok');

  // Récupérer tous les amis acceptés
  const { data: friendships } = await supabase
    .from('friendships')
    .select('requester_id, receiver_id')
    .or(`requester_id.eq.${update.user_id},receiver_id.eq.${update.user_id}`)
    .eq('status', 'accepted');

  if (!friendships || friendships.length === 0) return new Response('ok');

  const friendIds = friendships.map(f =>
    f.requester_id === update.user_id ? f.receiver_id : f.requester_id
  );

  // Récupérer les tokens des amis
  const { data: friends } = await supabase
    .from('users')
    .select('push_token')
    .in('id', friendIds)
    .not('push_token', 'is', null);

  if (!friends) return new Response('ok');

  const messages = friends
    .filter(f => f.push_token)
    .map(f => ({
      to: f.push_token,
      title: `👀 ${poster.full_name} vient de publier`,
      body: 'Voir sa progression →',
      sound: 'default',
    }));

  if (messages.length > 0) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  }

  return new Response('ok');
});
