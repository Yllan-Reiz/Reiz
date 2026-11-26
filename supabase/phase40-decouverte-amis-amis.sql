-- Phase 40 : fil de découverte, suite (26/11/2026, demandes de Yllan).
-- 1. Tout le monde y apparaît, même sans empreinte floue (séances postées avant la 1.8, vidéos) : l'app calcule alors
--    l'empreinte de la photo de profil, déjà visible de tous les membres (un simple flou laissait reconnaître le
--    visage). La séance elle-même n'est toujours jamais envoyée.
-- 2. « En commun : Ilan » : les amis de mes amis passent en premier, avec le prénom d'un ami commun et leur nombre.
--    (Le remplissage des empreintes par une fonction serveur a été refusé par le garde-fou : pas de clé de service.)
-- 3. p_only_mutual : au-delà de 5 amis, l'app ne demande plus que les amis d'amis (quelques cartes au bout du fil).
--
-- Retour arrière : relancer la fonction de phase39-fil-decouverte.sql (drop function d'abord, la sortie change).

drop function if exists public.discover_feed(int);
drop function if exists public.discover_feed(int, boolean);

create function public.discover_feed(p_limit int default 20, p_only_mutual boolean default false)
returns table (
  id uuid, user_id uuid, full_name text, username text, avatar_url text,
  created_at timestamptz, blurhash text, is_video boolean, request_sent boolean,
  mutual_count int, mutual_name text
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  my_friends as (
    select case when f.requester_id = (select id from me) then f.receiver_id else f.requester_id end as fid
    from public.friendships f
    where f.status = 'accepted' and (select id from me) in (f.requester_id, f.receiver_id)
  ),
  -- La dernière séance de chaque membre ; à date égale de membre, celle qui a une empreinte passe devant.
  last_post as (
    select distinct on (u.user_id) u.id, u.user_id, u.created_at, u.blurhash, u.photo_url
    from public.updates u
    join public.objectives o on o.id = u.objective_id
    where u.created_at > now() - interval '30 days'
      and o.visibility in ('friends', 'public')
    order by u.user_id, (u.blurhash is not null) desc, u.created_at desc
  ),
  mutual as (
    select lp.user_id,
           count(*)::int as n,
           (array_agg(split_part(coalesce(nullif(mu.full_name, ''), mu.username), ' ', 1) order by mu.full_name))[1] as name
    from last_post lp
    join public.friendships f on f.status = 'accepted' and lp.user_id in (f.requester_id, f.receiver_id)
    join my_friends m on m.fid = case when f.requester_id = lp.user_id then f.receiver_id else f.requester_id end
    join public.users mu on mu.id = m.fid
    group by lp.user_id
  )
  select lp.id, lp.user_id, us.full_name, us.username, us.avatar_url, lp.created_at, lp.blurhash,
         coalesce(lp.photo_url ~* '\.(mp4|mov|m4v|webm)(\?|$)', false) as is_video,
         exists (select 1 from public.friendships f
                 where f.requester_id = (select id from me) and f.receiver_id = lp.user_id and f.status = 'pending') as request_sent,
         coalesce(mu.n, 0) as mutual_count, mu.name as mutual_name
  from last_post lp
  join public.users us on us.id = lp.user_id
  left join mutual mu on mu.user_id = lp.user_id
  where (select id from me) is not null
    and lp.user_id <> (select id from me)
    and us.discoverable is not false
    and us.in_discover
    and not exists (select 1 from my_friends m where m.fid = lp.user_id)
    and not exists (select 1 from public.friendships f
                    where f.status = 'pending' and f.requester_id = lp.user_id and f.receiver_id = (select id from me))
    and not exists (select 1 from public.blocks b
                    where (b.blocker_id = (select id from me) and b.blocked_id = lp.user_id)
                       or (b.blocker_id = lp.user_id and b.blocked_id = (select id from me)))
    and (not p_only_mutual or mu.n > 0)
  order by (coalesce(mu.n, 0) > 0) desc, lp.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 30);
$$;

revoke all on function public.discover_feed(int, boolean) from public, anon;
grant execute on function public.discover_feed(int, boolean) to authenticated;
