-- Phase 33 : correctifs de l'audit de sécurité du 07/11/2026
--
-- À exécuter d'un bloc dans le SQL Editor de Supabase, après phase32.
-- Tout est dans une transaction : si une ligne échoue, rien n'est appliqué.
-- Les numéros renvoient au rapport ~/security-audit-skill/Reiz-langues/run-1/VERIFICATION-PRODUCTION.md.
--
-- Règle commune : les contrôles ne s'appliquent qu'aux requêtes de l'app (auth.uid() renseigné).
-- Les fonctions serveur (clé service) et les scripts lancés à la main ne sont pas gênés.
--
-- Hors de ce script (code de l'app ou des fonctions, pas du SQL) :
--   piste 2 (gardes strictes dans les fonctions), piste 6 (confirmation des liens d'invitation),
--   piste 8 (is_friend, is_close et is_blocked à déplacer dans un schéma non exposé : elles sont
--   appelées avec deux identifiants tiers par discover_people, une simple garde casserait les
--   amis en commun), piste 10 (pagination de delete-account).

begin;

-- ---------------------------------------------------------------------------
-- Piste 3 : on ne peut plus fabriquer une amitié en réécrivant requester_id.
-- Seul changement permis depuis l'app : le statut, de 'pending' vers 'accepted' ou 'rejected'.
-- (friendships_no_duplicate passe toujours : il ne fait que pending -> accepted.)
-- ---------------------------------------------------------------------------
create or replace function public.friendships_guard_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.id <> old.id
     or new.requester_id <> old.requester_id
     or new.receiver_id <> old.receiver_id
     or new.created_at is distinct from old.created_at then
    raise exception 'friendships : seul le statut peut changer';
  end if;
  if new.status is distinct from old.status
     and not (old.status = 'pending' and new.status in ('accepted', 'rejected')) then
    raise exception 'friendships : changement de statut non permis';
  end if;
  return new;
end $$;

drop trigger if exists friendships_guard_update on public.friendships;
create trigger friendships_guard_update
  before update on public.friendships
  for each row execute function public.friendships_guard_update();

revoke all on function public.friendships_guard_update() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Piste 5 : un fichier n'est lisible via un post que s'il est dans le dossier de l'auteur du post.
-- (Aujourd'hui, 100 % des photo_url sont déjà dans le dossier de leur auteur.)
-- ---------------------------------------------------------------------------
alter policy updates_objects_select on storage.objects
  using (
    bucket_id = 'updates'
    and (
      name like 'avatars/%'
      or (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1 from public.updates u
        where (u.photo_url = objects.name or u.photo_url like ('%/' || objects.name))
          and (storage.foldername(objects.name))[1] = u.user_id::text
          and public.can_see_update(u.id)
      )
    )
  );


-- ---------------------------------------------------------------------------
-- Piste 12 : un post ne peut viser qu'un objectif de son auteur.
-- (Aujourd'hui, 0 post vise l'objectif d'un autre.)
-- ---------------------------------------------------------------------------
alter policy updates_insert on public.updates
  with check (
    user_id = (select auth.uid())
    and (updates.objective_id is null or exists (
      select 1 from public.objectives o
      where o.id = updates.objective_id and o.user_id = (select auth.uid())
    ))
  );

alter policy updates_update on public.updates
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (updates.objective_id is null or exists (
      select 1 from public.objectives o
      where o.id = updates.objective_id and o.user_id = (select auth.uid())
    ))
  );


-- ---------------------------------------------------------------------------
-- Piste 13 : la date d'un post est fixée par le serveur et ne bouge plus.
-- (L'app n'envoie jamais created_at : rien ne change pour elle.)
-- ---------------------------------------------------------------------------
create or replace function public.updates_pin_created_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists updates_pin_created_at on public.updates;
create trigger updates_pin_created_at
  before insert or update on public.updates
  for each row execute function public.updates_pin_created_at();

revoke all on function public.updates_pin_created_at() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Piste 7 : bloquer coupe vraiment le lien, quel que soit l'écran d'où l'on bloque.
-- (Aujourd'hui, 0 paire bloquée n'est encore amie : rien à nettoyer.)
-- ---------------------------------------------------------------------------
create or replace function public.blocks_cut_ties()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from friendships
   where (requester_id = new.blocker_id and receiver_id = new.blocked_id)
      or (requester_id = new.blocked_id and receiver_id = new.blocker_id);
  delete from close_friends
   where (owner_id = new.blocker_id and friend_id = new.blocked_id)
      or (owner_id = new.blocked_id and friend_id = new.blocker_id);
  return new;
end $$;

drop trigger if exists blocks_cut_ties on public.blocks;
create trigger blocks_cut_ties
  after insert on public.blocks
  for each row execute function public.blocks_cut_ties();

revoke all on function public.blocks_cut_ties() from public, anon, authenticated;

-- Et les objectifs ou la présence ne sont plus visibles entre comptes bloqués, même publics.
alter policy objectives_select on public.objectives
  using (
    user_id = (select auth.uid())
    or (
      (
        visibility = 'public'
        or (visibility = 'friends' and public.is_friend((select auth.uid()), user_id))
        or (visibility = 'close' and public.is_close(user_id, (select auth.uid())))
      )
      and not public.is_blocked((select auth.uid()), user_id)
    )
  );

alter policy presence_select on public.presence
  using (
    user_id = (select auth.uid())
    or (public.is_close(user_id, (select auth.uid()))
        and not public.is_blocked((select auth.uid()), user_id))
  );


-- ---------------------------------------------------------------------------
-- Piste 9 : un jeton de notification n'appartient qu'à un seul compte.
-- Quand un compte enregistre un jeton, il est retiré des autres comptes.
-- Le jeton aujourd'hui partagé se corrigera tout seul à la prochaine ouverture de l'app.
-- ---------------------------------------------------------------------------
create or replace function public.users_unique_push_token()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.push_token is not null then
    update users set push_token = null
     where push_token = new.push_token and id <> new.id;
  end if;
  return null;
end $$;

drop trigger if exists users_unique_push_token on public.users;
create trigger users_unique_push_token
  after update of push_token on public.users
  for each row execute function public.users_unique_push_token();

revoke all on function public.users_unique_push_token() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Piste 11 : la recherche ne montre plus les étiquettes de profil (réservées aux amis),
-- et les caractères % et _ tapés dans la recherche ne servent plus de jokers.
-- Le reste de la fonction est identique à la version en service.
-- ---------------------------------------------------------------------------
create or replace function public.discover_people(p_terms text[], p_limit integer default 20)
returns table(id uuid, full_name text, username text, avatar_url text, mutual integer, reason text)
language sql stable security definer set search_path to 'public' as $function$
  with me as (select auth.uid() as uid),
  terms as (
    select distinct lower(trim(t)) as t,
      replace(replace(replace(lower(trim(t)), '\', '\\'), '%', '\%'), '_', '\_') as q
    from unnest(coalesce(p_terms, '{}')) t
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
        when 'musculation' then 'Musculation' when 'street-workout' then 'Street Workout' when 'hyrox' then 'Hyrox'
        when 'running' then 'Running' when 'cyclisme' then 'Cyclisme' when 'combat' then 'Sports de combat'
        when 'natation' then 'Natation' else 'Autre' end as reason
    from users u, terms
    where u.sport is not null and u.sport <> 'autre' and u.sport = terms.t
    union all
    select u.id, 1, null::text
    from users u, terms
    where u.full_name ilike '%' || terms.q || '%' or u.username ilike '%' || terms.q || '%'
    union all
    select o.user_id, 3, 'Objectif : ' || o.title
    from objectives o, terms
    where o.visibility = 'public' and o.title ilike '%' || terms.q || '%'
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
$function$;

commit;


-- ---------------------------------------------------------------------------
-- Contrôle après coup (lecture seule) : chaque ligne doit afficher true.
-- ---------------------------------------------------------------------------
select 'piste 3' as piste, exists (select 1 from pg_trigger where tgname = 'friendships_guard_update') as ok
union all select 'piste 5', (select qual like '%u.user_id%' from pg_policies where schemaname = 'storage' and policyname = 'updates_objects_select')
union all select 'piste 7 (déclencheur)', exists (select 1 from pg_trigger where tgname = 'blocks_cut_ties')
union all select 'piste 7 (règles)', (select bool_and(qual like '%is_blocked%') from pg_policies where policyname in ('objectives_select', 'presence_select'))
union all select 'piste 9', exists (select 1 from pg_trigger where tgname = 'users_unique_push_token')
union all select 'piste 11', (select pg_get_functiondef('public.discover_people(text[],int)'::regprocedure) not like '%profile_tags%')
union all select 'piste 12', (select with_check like '%objectives%' from pg_policies where policyname = 'updates_insert')
union all select 'piste 13', exists (select 1 from pg_trigger where tgname = 'updates_pin_created_at');
