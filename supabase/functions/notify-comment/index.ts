import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const payload = await req.json();
  const comment = payload.record;

  const { data: update } = await supabase
    .from('updates')
    .select('user_id, users(full_name, push_token)')
    .eq('id', comment.update_id)
    .single();

  if (!update) return new Response('ok');

  const owner = update.users as any;
  if (comment.user_id === update.user_id) return new Response('ok');
  if (!owner?.push_token) return new Response('ok');

  const { data: commenter } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', comment.user_id)
    .single();

  const preview = comment.content.length > 40
    ? comment.content.substring(0, 40) + '...'
    : comment.content;

  await sendPush(owner.push_token, `💬 ${commenter?.full_name} a commenté`, preview, 'comment');

  return new Response('ok');
});

async function sendPush(token: string, title: string, body: string, type: string) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: 'default', data: { type } }),
  });
}
