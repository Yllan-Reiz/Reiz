-- Phase 11 : « je suis à la salle » (présence), prévenir le cercle proche.
--
-- Principe de confidentialité : la base ne reçoit JAMAIS de coordonnées. Les lieux
-- d'entraînement restent sur le téléphone ; seul l'événement « arrivé à <nom du lieu> »
-- est envoyé, et uniquement visible par le cercle proche de la personne.

create table if not exists public.presence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  place_label text,
  source text not null default 'manual' check (source in ('manual', 'auto')),
  created_at timestamptz not null default now()
);
create index if not exists presence_user_idx on public.presence(user_id, created_at desc);

alter table public.presence enable row level security;
drop policy if exists presence_insert on public.presence;
drop policy if exists presence_select on public.presence;
drop policy if exists presence_delete on public.presence;
create policy presence_insert on public.presence for insert to authenticated
  with check (user_id = auth.uid());
-- Visible par soi-même et par les amis que la personne a mis dans son cercle proche.
create policy presence_select on public.presence for select to authenticated
  using (user_id = auth.uid() or public.is_close(user_id, auth.uid()));
create policy presence_delete on public.presence for delete to authenticated
  using (user_id = auth.uid());

-- Anti-spam : une seule alerte toutes les 3 heures par personne (ignorée sans erreur).
create or replace function public.presence_throttle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from presence p where p.user_id = new.user_id and p.created_at > now() - interval '3 hours') then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists presence_throttle_trg on public.presence;
create trigger presence_throttle_trg before insert on public.presence
  for each row execute function public.presence_throttle();

-- Chaque arrivée prévient le cercle proche (jamais les autres amis), sauf les personnes bloquées.
create or replace function public.notif_on_presence()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (recipient_id, actor_id, type, preview)
  select c.friend_id, new.user_id, 'at_gym', left(new.place_label, 60)
  from close_friends c
  where c.owner_id = new.user_id
    and public.is_friend(c.owner_id, c.friend_id)
    and not public.is_blocked(c.owner_id, c.friend_id);
  return new;
end $$;
drop trigger if exists notif_on_presence_trg on public.presence;
create trigger notif_on_presence_trg after insert on public.presence
  for each row execute function public.notif_on_presence();

-- Fonctions de déclencheur : personne ne les appelle à la main (même règle que la phase 10).
revoke execute on function public.presence_throttle() from public, anon, authenticated;
revoke execute on function public.notif_on_presence() from public, anon, authenticated;

notify pgrst, 'reload schema';
