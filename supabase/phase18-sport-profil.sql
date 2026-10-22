-- Phase 18 (22/10/2026, version 1.0.1) : la discipline choisie à l'accueil est enregistrée dans le profil,
-- pour la recherche par sport de l'onglet Amis et l'affichage sur le profil.
-- Ajout seulement : une colonne vide (les comptes existants n'ont pas de sport tant qu'ils ne l'ont pas choisi).

alter table public.users add column if not exists sport text;
alter table public.users drop constraint if exists users_sport_valid;
alter table public.users add constraint users_sport_valid
  check (sport is null or sport in ('musculation', 'street-workout', 'hyrox', 'running', 'cyclisme', 'boxe', 'natation', 'autre'));

-- Les droits de la table users sont donnés colonne par colonne : lecture et modification de sport.
grant select (sport) on public.users to authenticated;
grant update (sport) on public.users to authenticated;

-- La recherche de l'onglet Amis trouve aussi le sport du profil (en premier, avant les tags et les objectifs).
create or replace function public.discover_people(p_terms text[], p_limit int default 20)
returns table (id uuid, full_name text, username text, avatar_url text, mutual int, reason text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as uid),
  terms as (
    select distinct lower(trim(t)) as t from unnest(coalesce(p_terms, '{}')) t
    where length(trim(t)) >= 2
    limit 12
  ),
  my_friends as (
    select case when f.requester_id = me.uid then f.receiver_id else f.requester_id end as fid
    from friendships f, me
    where f.status = 'accepted' and (f.requester_id = me.uid or f.receiver_id = me.uid)
  ),
  hits as (
    select u.id, 0 as rank, 'Sport : ' || case u.sport
        when 'musculation' then 'Musculation' when 'street-workout' then 'Street Workout' when 'hyrox' then 'HYROX'
        when 'running' then 'Running' when 'cyclisme' then 'Cyclisme' when 'boxe' then 'Boxe'
        when 'natation' then 'Natation' else 'Autre' end as reason
    from users u, terms
    where u.sport is not null and u.sport <> 'autre' and u.sport = terms.t
    union all
    select u.id, 1, null::text
    from users u, terms
    where u.full_name ilike '%' || terms.t || '%' or u.username ilike '%' || terms.t || '%'
    union all
    select pt.user_id, 2, 'Tag : ' || coalesce(pt.emoji || ' ', '') || pt.label
    from profile_tags pt, terms
    where pt.label ilike '%' || terms.t || '%'
    union all
    select o.user_id, 3, 'Objectif : ' || o.title
    from objectives o, terms
    where o.visibility = 'public' and o.title ilike '%' || terms.t || '%'
  ),
  best as (
    select distinct on (h.id) h.id, h.rank, h.reason from hits h order by h.id, h.rank
  )
  select u.id, u.full_name, u.username, u.avatar_url,
    (select count(*)::int from my_friends mf
      where public.is_friend(mf.fid, u.id)) as mutual,
    b.reason
  from best b
  join users u on u.id = b.id
  cross join me
  where me.uid is not null
    and u.id <> me.uid
    and u.id not in (select fid from my_friends)
    and coalesce(u.discoverable, true)
    and not exists (
      select 1 from friendships x
      where (x.requester_id = me.uid and x.receiver_id = u.id) or (x.receiver_id = me.uid and x.requester_id = u.id)
    )
    and not public.is_blocked(me.uid, u.id)
  order by b.rank, mutual desc, u.full_name
  limit least(greatest(p_limit, 1), 40);
$$;
