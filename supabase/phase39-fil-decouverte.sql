-- Phase 39 : fil de découverte flouté (26/11/2026, idée de Yllan).
-- Un nouveau venu, qui n'a pas encore (ou peu) d'amis, voit au bas de son fil la dernière séance de chaque membre,
-- floutée. Pour la voir, il ajoute la personne en ami.
--
-- Règle de confidentialité : la photo ou la vidéo d'un post n'est JAMAIS envoyée à un inconnu. Le serveur ne renvoie
-- qu'une empreinte floue (blurhash, une trentaine de caractères calculés par l'auteur à la publication) : le téléphone
-- en tire une image de quelques taches de couleur. Les fichiers restent protégés par can_see_update (phase 33).
-- Exclus : objectifs du cercle proche et privés, membres qui ont coupé « Me proposer aux autres membres »
-- (discoverable) ou « Apparaître aux nouveaux » (in_discover), amis, personnes bloquées dans un sens ou l'autre.
--
-- Retour arrière : drop function public.discover_feed(int); alter table public.updates drop column blurhash;
--                  alter table public.users drop column in_discover;

alter table public.updates add column if not exists blurhash text;
alter table public.updates drop constraint if exists updates_blurhash_len;
alter table public.updates add constraint updates_blurhash_len check (blurhash is null or length(blurhash) between 6 and 120);

alter table public.users add column if not exists in_discover boolean not null default true;
-- La table users n'ouvre la lecture que colonne par colonne (push_token et timezone restent cachés) : sans ce droit,
-- Réglages ne pouvait pas lire l'interrupteur (« permission denied for table users »).
grant select (in_discover) on public.users to authenticated;
comment on column public.users.in_discover is
  'Phase 39 : sa dernière séance apparaît floutée (empreinte seulement) dans le fil des nouveaux. Réglage « Apparaître aux nouveaux ».';

-- La dernière séance de chaque membre sur 30 jours, la plus récente d'abord. Une carte par personne.
create or replace function public.discover_feed(p_limit int default 20)
returns table (
  id uuid, user_id uuid, full_name text, username text, avatar_url text,
  created_at timestamptz, blurhash text, is_video boolean, request_sent boolean
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  last_post as (
    select distinct on (u.user_id) u.id, u.user_id, u.created_at, u.blurhash, u.photo_url
    from public.updates u
    join public.objectives o on o.id = u.objective_id
    where u.blurhash is not null
      and u.created_at > now() - interval '30 days'
      and o.visibility in ('friends', 'public')
    order by u.user_id, u.created_at desc
  )
  select lp.id, lp.user_id, us.full_name, us.username, us.avatar_url, lp.created_at, lp.blurhash,
         coalesce(lp.photo_url ~* '\.(mp4|mov|m4v|webm)(\?|$)', false) as is_video,
         exists (select 1 from public.friendships f
                 where f.requester_id = (select id from me) and f.receiver_id = lp.user_id and f.status = 'pending') as request_sent
  from last_post lp
  join public.users us on us.id = lp.user_id
  where (select id from me) is not null
    and lp.user_id <> (select id from me)
    and us.discoverable is not false
    and us.in_discover
    and not exists (select 1 from public.friendships f
                    where f.status = 'accepted'
                      and ((f.requester_id = (select id from me) and f.receiver_id = lp.user_id)
                        or (f.receiver_id = (select id from me) and f.requester_id = lp.user_id)))
    -- Il m'a déjà demandé en ami : sa demande est dans l'onglet Amis, pas besoin de la carte.
    and not exists (select 1 from public.friendships f
                    where f.status = 'pending' and f.requester_id = lp.user_id and f.receiver_id = (select id from me))
    and not exists (select 1 from public.blocks b
                    where (b.blocker_id = (select id from me) and b.blocked_id = lp.user_id)
                       or (b.blocker_id = lp.user_id and b.blocked_id = (select id from me)))
  order by lp.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 30);
$$;

revoke all on function public.discover_feed(int) from public, anon;
grant execute on function public.discover_feed(int) to authenticated;
