-- ============================================================
-- REIZ — Phase 6 (retours bêta, 27/09/2026)
-- Fil d'activité, notifications anti-spam, réponses et likes sur
-- les commentaires, bio, visibilité « Amis » par défaut.
-- Appliquée via le MCP Supabase le 27/09/2026. Idempotente.
-- ============================================================

-- ---------- 1. Bio ----------
alter table public.users add column if not exists bio text;
do $$ begin
  alter table public.users add constraint users_bio_len check (bio is null or char_length(bio) <= 150);
exception when duplicate_object then null; end $$;

-- ---------- 2. Réponses aux commentaires (un seul niveau, comme Insta) ----------
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments(parent_id);

-- Une réponse à une réponse est rattachée au commentaire racine, et doit
-- appartenir au même post.
create or replace function public.comments_normalize_parent()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if new.parent_id is null then return new; end if;
  select id, update_id, parent_id into p from comments where id = new.parent_id;
  if p.id is null or p.update_id <> new.update_id then
    raise exception 'Commentaire parent invalide';
  end if;
  if p.parent_id is not null then new.parent_id := p.parent_id; end if;
  return new;
end $$;
drop trigger if exists comments_normalize_parent on public.comments;
create trigger comments_normalize_parent before insert on public.comments
  for each row execute function public.comments_normalize_parent();

-- ---------- 3. Likes sur les commentaires ----------
-- Clé technique (id) et non (comment_id, user_id) : sinon l'API y voit une
-- table de liaison comments <-> users et casse l'embed users(...) des
-- commentaires (voir phase6-fix-commentaires.sql).
create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (comment_id, user_id)
);
alter table public.comment_likes enable row level security;

create or replace function public.can_see_comment(p_comment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from comments c where c.id = p_comment_id and public.can_see_update(c.update_id));
$$;

drop policy if exists comment_likes_select on public.comment_likes;
drop policy if exists comment_likes_insert on public.comment_likes;
drop policy if exists comment_likes_delete on public.comment_likes;
create policy comment_likes_select on public.comment_likes
  for select to authenticated using (public.can_see_comment(comment_id));
create policy comment_likes_insert on public.comment_likes
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_comment(comment_id));
create policy comment_likes_delete on public.comment_likes
  for delete to authenticated using (user_id = auth.uid());

-- ---------- 4. Table des notifications (fil d'activité) ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid references public.users(id) on delete cascade,
  -- reaction | comment | reply | comment_like | friend_post | friend_request | friend_accept | new_objective
  type text not null,
  update_id uuid references public.updates(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete cascade,
  emoji text,
  preview text,
  -- Anti-doublon : même personne + même post + même emoji = une seule ligne,
  -- même si la réaction est retirée puis remise.
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications(recipient_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_delete on public.notifications;
-- Chacun ne lit que SES notifications. Aucune insertion depuis l'app :
-- seuls les triggers ci-dessous écrivent dans la table.
create policy notifications_select on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
create policy notifications_update on public.notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_delete on public.notifications
  for delete to authenticated using (recipient_id = auth.uid());

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- Réaction (emoji) sur un post
create or replace function public.notif_on_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from updates where id = new.update_id;
  if owner is null or owner = new.user_id or public.is_blocked(owner, new.user_id) then return new; end if;
  insert into notifications (recipient_id, actor_id, type, update_id, emoji, dedupe_key)
  values (owner, new.user_id, 'reaction', new.update_id, new.type,
          'rx:' || new.update_id || ':' || new.user_id || ':' || new.type)
  on conflict (dedupe_key) do nothing;
  return new;
end $$;
drop trigger if exists notif_on_reaction on public.reactions;
create trigger notif_on_reaction after insert on public.reactions
  for each row execute function public.notif_on_reaction();

-- Commentaire ou réponse
create or replace function public.notif_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; parent_author uuid;
begin
  select user_id into owner from updates where id = new.update_id;
  if new.parent_id is not null then
    select user_id into parent_author from comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.user_id and not public.is_blocked(parent_author, new.user_id) then
      insert into notifications (recipient_id, actor_id, type, update_id, comment_id, preview)
      values (parent_author, new.user_id, 'reply', new.update_id, new.id, left(new.content, 140));
    end if;
  end if;
  if owner is not null and owner <> new.user_id and owner is distinct from parent_author
     and not public.is_blocked(owner, new.user_id) then
    insert into notifications (recipient_id, actor_id, type, update_id, comment_id, preview)
    values (owner, new.user_id, 'comment', new.update_id, new.id, left(new.content, 140));
  end if;
  return new;
end $$;
drop trigger if exists notif_on_comment on public.comments;
create trigger notif_on_comment after insert on public.comments
  for each row execute function public.notif_on_comment();

-- Like sur un commentaire
create or replace function public.notif_on_comment_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select user_id, update_id, content into c from comments where id = new.comment_id;
  if c.user_id is null or c.user_id = new.user_id or public.is_blocked(c.user_id, new.user_id) then return new; end if;
  insert into notifications (recipient_id, actor_id, type, update_id, comment_id, preview, dedupe_key)
  values (c.user_id, new.user_id, 'comment_like', c.update_id, new.comment_id, left(c.content, 140),
          'cl:' || new.comment_id || ':' || new.user_id)
  on conflict (dedupe_key) do nothing;
  return new;
end $$;
drop trigger if exists notif_on_comment_like on public.comment_likes;
create trigger notif_on_comment_like after insert on public.comment_likes
  for each row execute function public.notif_on_comment_like();

-- Ami qui publie : une ligne par ami (sauf objectif privé)
create or replace function public.notif_on_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare vis text;
begin
  select visibility into vis from objectives where id = new.objective_id;
  if vis = 'private' then return new; end if;
  insert into notifications (recipient_id, actor_id, type, update_id, objective_id, preview)
  select case when f.requester_id = new.user_id then f.receiver_id else f.requester_id end,
         new.user_id, 'friend_post', new.id, new.objective_id, left(new.caption, 140)
  from friendships f
  where f.status = 'accepted'
    and (f.requester_id = new.user_id or f.receiver_id = new.user_id)
    and not public.is_blocked(f.requester_id, f.receiver_id);
  return new;
end $$;
drop trigger if exists notif_on_update on public.updates;
create trigger notif_on_update after insert on public.updates
  for each row execute function public.notif_on_update();

-- Nouvel objectif d'un ami (fil d'activité seulement, pas de push)
create or replace function public.notif_on_objective()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.visibility = 'private' then return new; end if;
  insert into notifications (recipient_id, actor_id, type, objective_id, preview)
  select case when f.requester_id = new.user_id then f.receiver_id else f.requester_id end,
         new.user_id, 'new_objective', new.id, trim(coalesce(new.emoji, '') || ' ' || new.title)
  from friendships f
  where f.status = 'accepted'
    and (f.requester_id = new.user_id or f.receiver_id = new.user_id)
    and not public.is_blocked(f.requester_id, f.receiver_id);
  return new;
end $$;
drop trigger if exists notif_on_objective on public.objectives;
create trigger notif_on_objective after insert on public.objectives
  for each row execute function public.notif_on_objective();

-- Demande d'ami envoyée, puis acceptée (ce dernier cas n'existait pas avant)
create or replace function public.notif_on_friendship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into notifications (recipient_id, actor_id, type, dedupe_key)
    values (new.receiver_id, new.requester_id, 'friend_request', 'fr:' || new.id)
    on conflict (dedupe_key) do nothing;
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into notifications (recipient_id, actor_id, type, dedupe_key)
    values (new.requester_id, new.receiver_id, 'friend_accept', 'fa:' || new.id)
    on conflict (dedupe_key) do nothing;
    -- La demande est traitée : on la retire du fil de celui qui l'a acceptée.
    update notifications set read_at = coalesce(read_at, now()) where dedupe_key = 'fr:' || new.id;
  end if;
  return new;
end $$;
drop trigger if exists notif_on_friendship on public.friendships;
create trigger notif_on_friendship after insert or update on public.friendships
  for each row execute function public.notif_on_friendship();

-- ---------- 5. Un seul webhook : notifications → edge function send-push ----------
-- On recopie la définition du webhook existant "on-like" (URL du projet, clé,
-- secret) en changeant seulement la table et la fonction appelée, pour ne
-- jamais écrire le secret en clair dans ce fichier.
do $$
declare def text;
begin
  if not exists (select 1 from pg_trigger where tgname = 'on-notification') then
    select pg_get_triggerdef(t.oid) into def
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where c.relname = 'reactions' and t.tgname = 'on-like';
    if def is null then raise exception 'Webhook on-like introuvable, rien n''a été modifié'; end if;
    def := replace(def, '"on-like"', '"on-notification"');
    def := replace(def, 'ON public.reactions', 'ON public.notifications');
    def := replace(def, '/functions/v1/notify-like', '/functions/v1/send-push');
    execute def;
  end if;
end $$;

-- Les 4 anciens webhooks envoyaient leurs propres push sans anti-doublon :
-- on les retire pour ne pas notifier deux fois.
drop trigger if exists "on-like" on public.reactions;
drop trigger if exists "on-comment" on public.comments;
drop trigger if exists "on-friend-post" on public.updates;
drop trigger if exists "on-friend-request" on public.friendships;

-- ---------- 6. Visibilité : « ton cercle » par défaut ----------
-- Tous les objectifs étaient en « public » (valeur par défaut de l'app) :
-- n'importe quel inscrit pouvait ouvrir un profil et voir les posts sans être
-- ami. On les passe en « friends », ce que promet le produit.
update public.objectives set visibility = 'friends' where visibility = 'public';
alter table public.objectives alter column visibility set default 'friends';
