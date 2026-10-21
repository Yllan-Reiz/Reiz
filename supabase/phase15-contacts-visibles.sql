-- ============================================================
-- REIZ — Phase 15 (21/10/2026) : « Me proposer à mes contacts »
-- ============================================================
-- Un compte peut refuser d'être trouvé par ceux qui ont son e-mail dans leur carnet d'adresses (Réglages,
-- Confidentialité). Par défaut tout le monde est visible, comme avant. Déjà exécuté en production le 21/10/2026.
alter table public.users add column if not exists discoverable boolean not null default true;

create or replace function public.match_contacts(p_hashes text[])
returns table (id uuid, full_name text, username text, avatar_url text, email_hash text)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.full_name, u.username, u.avatar_url,
         encode(sha256(convert_to(lower(a.email), 'UTF8')), 'hex') as email_hash
  from auth.users a
  join public.users u on u.id = a.id
  where auth.uid() is not null
    and coalesce(cardinality(p_hashes), 0) between 1 and 1000
    and a.email is not null
    and u.discoverable
    and encode(sha256(convert_to(lower(a.email), 'UTF8')), 'hex') = any (p_hashes)
    and u.id <> auth.uid()
    and not public.is_blocked(auth.uid(), u.id)
  limit 300;
$$;
revoke execute on function public.match_contacts(text[]) from public, anon;
grant  execute on function public.match_contacts(text[]) to authenticated;
notify pgrst, 'reload schema';
