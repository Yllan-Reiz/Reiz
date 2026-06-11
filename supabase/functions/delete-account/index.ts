import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Suppression de compte (exigée par l'App Store, guideline 5.1.1).
// L'utilisateur authentifié supprime SON compte : on vérifie son JWT,
// puis on efface ses données avec la clé service role, et enfin le compte auth.
Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !user) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const uid = user.id;

  // 1. Données applicatives (ordre : enfants avant parents)
  await admin.from('reactions').delete().eq('user_id', uid);
  await admin.from('comments').delete().eq('user_id', uid);
  await admin.from('updates').delete().eq('user_id', uid);
  await admin.from('objectives').delete().eq('user_id', uid);
  await admin.from('friendships').delete().or(`requester_id.eq.${uid},receiver_id.eq.${uid}`);
  await admin.from('blocks').delete().or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
  await admin.from('users').delete().eq('id', uid);

  // 2. Fichiers (photos de posts + avatar)
  try {
    const { data: files } = await admin.storage.from('updates').list(uid);
    if (files && files.length > 0) {
      await admin.storage.from('updates').remove(files.map((f) => `${uid}/${f.name}`));
    }
    await admin.storage.from('updates').remove([`avatars/${uid}.jpg`]);
  } catch (_) { /* les fichiers orphelins ne bloquent pas la suppression du compte */ }

  // 3. Compte d'authentification
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
