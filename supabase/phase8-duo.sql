-- ============================================================
-- REIZ — Phase 8 (27/09/2026) : séances en duo
-- ============================================================
-- On peut identifier jusqu'à 3 amis dans une publication (« avec Enzo »).
-- Stocké en liste d'identifiants sur le post, et non dans une table de
-- liaison : une table updates <-> users rendrait ambiguë la lecture
-- « post + auteur » de l'API (même bug que comment_likes le 27/09).
-- Sans risque pour les builds actuels : la colonne a une valeur par défaut
-- et aucun ancien écran ne la lit.
-- ============================================================

alter table public.updates add column if not exists with_user_ids uuid[] not null default '{}';
create index if not exists updates_with_users_idx on public.updates using gin (with_user_ids);

-- Seulement des amis, jamais soi-même, 3 maximum.
create or replace function public.updates_validate_duo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if cardinality(new.with_user_ids) = 0 then return new; end if;
  if cardinality(new.with_user_ids) > 3 then
    raise exception 'Trois amis maximum dans une séance en duo';
  end if;
  if exists (
    select 1 from unnest(new.with_user_ids) as x(id)
    where x.id = new.user_id or not public.is_friend(new.user_id, x.id)
  ) then
    raise exception 'Tu ne peux identifier que des amis de ton cercle';
  end if;
  return new;
end $$;
drop trigger if exists updates_validate_duo on public.updates;
create trigger updates_validate_duo before insert or update of with_user_ids on public.updates
  for each row execute function public.updates_validate_duo();

-- Notifications d'un nouveau post : les amis identifiés reçoivent « duo_tag »
-- (« t'a identifié dans sa séance ») à la place du « a posté » habituel.
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
  ) c;
  return new;
end $$;

notify pgrst, 'reload schema';
