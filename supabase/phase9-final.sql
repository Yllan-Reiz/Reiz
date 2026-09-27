-- ============================================================
-- REIZ — Phase 9 (27/09/2026) : tags du profil, liste d'amis d'un
-- profil, cercle proche, nettoyage de la sécurité du stockage.
-- Idempotent. Sans risque pour les builds déjà installés : rien de
-- ce qu'ils lisent ne disparaît.
-- Règle suivie pour chaque nouvelle table : clé primaire technique
-- (id), jamais un couple de clés étrangères, sinon l'API croit voir
-- une table de liaison et casse des lectures existantes.
-- ============================================================

-- ============================================================
-- 1. CERCLE PROCHE
-- ============================================================
create table if not exists public.close_friends (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  friend_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (owner_id, friend_id)
);
alter table public.close_friends enable row level security;
drop policy if exists close_friends_select on public.close_friends;
drop policy if exists close_friends_insert on public.close_friends;
drop policy if exists close_friends_delete on public.close_friends;
-- Comme sur Instagram : seul le propriétaire voit sa liste.
create policy close_friends_select on public.close_friends
  for select to authenticated using (owner_id = auth.uid());
create policy close_friends_insert on public.close_friends
  for insert to authenticated with check (owner_id = auth.uid() and public.is_friend(owner_id, friend_id));
create policy close_friends_delete on public.close_friends
  for delete to authenticated using (owner_id = auth.uid());

-- viewer fait-il partie du cercle proche de owner ? (et est toujours son ami)
create or replace function public.is_close(owner uuid, viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from close_friends c where c.owner_id = owner and c.friend_id = viewer)
     and public.is_friend(owner, viewer);
$$;

-- Visibilité v3 : nouveau niveau « close » (cercle proche).
create or replace function public.can_see_update(p_update_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from updates u
    left join objectives o on o.id = u.objective_id
    where u.id = p_update_id
      and (
        u.user_id = auth.uid()
        or (
          (
            (o.id is not null and o.visibility = 'public')
            or (o.id is not null and o.visibility = 'friends' and public.is_friend(auth.uid(), u.user_id))
            or (o.id is not null and o.visibility = 'close' and public.is_close(u.user_id, auth.uid()))
            or (o.id is null and public.is_friend(auth.uid(), u.user_id))
          )
          and not exists (
            select 1 from blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = u.user_id)
               or (b.blocker_id = u.user_id and b.blocked_id = auth.uid())
          )
        )
      )
  );
$$;

drop policy if exists objectives_select on public.objectives;
create policy objectives_select on public.objectives
  for select to authenticated using (
    user_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'friends' and public.is_friend(auth.uid(), user_id))
    or (visibility = 'close' and public.is_close(user_id, auth.uid()))
  );

-- Notifications : un post ou un objectif « cercle proche » ne prévient que le cercle proche.
create or replace function public.notif_on_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare vis text;
begin
  select visibility into vis from objectives where id = new.objective_id;
  if vis = 'private' then return new; end if;
  insert into notifications (recipient_id, actor_id, type, update_id, objective_id, preview)
  select c.friend_id, new.user_id,
         case when c.friend_id = any(new.with_user_ids) then 'duo_tag' else 'friend_post' end,
         new.id, new.objective_id, left(new.caption, 140)
  from (
    select case when f.requester_id = new.user_id then f.receiver_id else f.requester_id end as friend_id
    from friendships f
    where f.status = 'accepted'
      and (f.requester_id = new.user_id or f.receiver_id = new.user_id)
      and not public.is_blocked(f.requester_id, f.receiver_id)
  ) c
  where vis is distinct from 'close' or public.is_close(new.user_id, c.friend_id);
  return new;
end $$;

create or replace function public.notif_on_objective()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visibility = 'private' then return new; end if;
  insert into notifications (recipient_id, actor_id, type, objective_id, preview)
  select c.friend_id, new.user_id, 'new_objective', new.id, trim(coalesce(new.emoji, '') || ' ' || new.title)
  from (
    select case when f.requester_id = new.user_id then f.receiver_id else f.requester_id end as friend_id
    from friendships f
    where f.status = 'accepted'
      and (f.requester_id = new.user_id or f.receiver_id = new.user_id)
      and not public.is_blocked(f.requester_id, f.receiver_id)
  ) c
  where new.visibility is distinct from 'close' or public.is_close(new.user_id, c.friend_id);
  return new;
end $$;

-- ============================================================
-- 2. TAGS DU PROFIL (« Push day », « Objectif 100 kg »...) que le
--    cercle peut valider d'un tap
-- ============================================================
create table if not exists public.profile_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  emoji text,
  label text not null check (char_length(label) between 1 and 24),
  created_at timestamptz default now()
);
create index if not exists profile_tags_user_idx on public.profile_tags(user_id);
alter table public.profile_tags enable row level security;

create table if not exists public.tag_endorsements (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.profile_tags(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (tag_id, user_id)
);
alter table public.tag_endorsements enable row level security;

-- Un tag se voit par son auteur et par son cercle (hors blocages).
create or replace function public.can_see_tag(p_tag_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profile_tags t
    where t.id = p_tag_id
      and (t.user_id = auth.uid()
           or (public.is_friend(auth.uid(), t.user_id) and not public.is_blocked(auth.uid(), t.user_id)))
  );
$$;

drop policy if exists profile_tags_select on public.profile_tags;
drop policy if exists profile_tags_insert on public.profile_tags;
drop policy if exists profile_tags_update on public.profile_tags;
drop policy if exists profile_tags_delete on public.profile_tags;
create policy profile_tags_select on public.profile_tags
  for select to authenticated using (public.can_see_tag(id));
create policy profile_tags_insert on public.profile_tags
  for insert to authenticated with check (user_id = auth.uid());
create policy profile_tags_update on public.profile_tags
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profile_tags_delete on public.profile_tags
  for delete to authenticated using (user_id = auth.uid());

-- 6 tags maximum par profil.
create or replace function public.profile_tags_max()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from profile_tags where user_id = new.user_id) >= 6 then
    raise exception '6 tags maximum sur ton profil';
  end if;
  return new;
end $$;
drop trigger if exists profile_tags_max on public.profile_tags;
create trigger profile_tags_max before insert on public.profile_tags
  for each row execute function public.profile_tags_max();

drop policy if exists tag_endorsements_select on public.tag_endorsements;
drop policy if exists tag_endorsements_insert on public.tag_endorsements;
drop policy if exists tag_endorsements_delete on public.tag_endorsements;
create policy tag_endorsements_select on public.tag_endorsements
  for select to authenticated using (public.can_see_tag(tag_id));
-- On valide les tags des autres, pas les siens.
create policy tag_endorsements_insert on public.tag_endorsements
  for insert to authenticated with check (
    user_id = auth.uid() and public.can_see_tag(tag_id)
    and not exists (select 1 from profile_tags t where t.id = tag_id and t.user_id = auth.uid())
  );
create policy tag_endorsements_delete on public.tag_endorsements
  for delete to authenticated using (user_id = auth.uid());

-- Fil d'activité + push : « Enzo a validé ton tag 💪 Push day ».
create or replace function public.notif_on_tag_endorse()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select user_id, emoji, label into t from profile_tags where id = new.tag_id;
  if t.user_id is null or t.user_id = new.user_id then return new; end if;
  insert into notifications (recipient_id, actor_id, type, preview, dedupe_key)
  values (t.user_id, new.user_id, 'tag_endorse', trim(coalesce(t.emoji, '') || ' ' || t.label),
          'tg:' || new.tag_id || ':' || new.user_id)
  on conflict (dedupe_key) do nothing;
  return new;
end $$;
drop trigger if exists notif_on_tag_endorse on public.tag_endorsements;
create trigger notif_on_tag_endorse after insert on public.tag_endorsements
  for each row execute function public.notif_on_tag_endorse();

-- ============================================================
-- 3. LISTE D'AMIS D'UN PROFIL (taper sur « Amis »)
-- ============================================================
-- La RLS de friendships ne montre que ses propres amitiés. Cette fonction
-- renvoie la liste d'amis d'une personne, mais seulement à elle-même et à
-- ses amis, et sans les personnes bloquées par celui qui regarde.
create or replace function public.friends_of(p_user uuid)
returns table (id uuid, full_name text, username text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select u.id, u.full_name, u.username, u.avatar_url
  from friendships f
  join users u on u.id = case when f.requester_id = p_user then f.receiver_id else f.requester_id end
  where f.status = 'accepted'
    and (f.requester_id = p_user or f.receiver_id = p_user)
    and (p_user = auth.uid() or public.is_friend(auth.uid(), p_user))
    and not public.is_blocked(auth.uid(), u.id)
  order by u.full_name;
$$;
revoke all on function public.friends_of(uuid) from public, anon;
grant execute on function public.friends_of(uuid) to authenticated;

-- ============================================================
-- 4. SÉCURITÉ DU STOCKAGE (photos et vidéos)
-- ============================================================
-- Anciennes règles créées à la main au début du projet :
--   « Allow public read »         : n'importe qui, même sans compte, pouvait
--                                   lister et ouvrir tous les fichiers ;
--   « Allow authenticated uploads » : envoi dans n'importe quel dossier ;
--   « Insert photo 1v5jefe_0/1 »  : envoi et lecture anonymes dans public/.
drop policy if exists "Allow public read" on storage.objects;
drop policy if exists "Allow authenticated uploads" on storage.objects;
drop policy if exists "Insert photo 1v5jefe_0" on storage.objects;
drop policy if exists "Insert photo 1v5jefe_1" on storage.objects;

-- Lecture : ses propres fichiers, les photos de profil, et le média d'un
-- post qu'on a le droit de voir. Plus de lecture de tout le bucket.
drop policy if exists updates_objects_select on storage.objects;
create policy updates_objects_select on storage.objects
  for select to authenticated using (
    bucket_id = 'updates'
    and (
      name like 'avatars/%'
      or (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.updates u
        where (u.photo_url = name or u.photo_url like '%/' || name)
          and public.can_see_update(u.id)
      )
    )
  );

notify pgrst, 'reload schema';
