-- Phase 16 (22/10/2026, version 1.0.1) : amis recommandés et relance d'un ami.
-- Uniquement des AJOUTS : deux fonctions, aucune table ni colonne modifiée.

-- ---------- 1. Amis recommandés : les amis de mes amis ----------
-- Renvoie les comptes qui sont amis avec au moins un de mes amis, avec le nombre d'amis en commun.
-- Jamais : moi, mes amis, quelqu'un avec qui une demande existe déjà (dans un sens ou l'autre), un blocage,
-- ni un compte qui a coupé « Me proposer à mes contacts » (users.discoverable = false).
create or replace function public.suggest_friends(p_limit int default 12)
returns table (id uuid, full_name text, username text, avatar_url text, mutual int)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as uid),
  my_friends as (
    select case when f.requester_id = me.uid then f.receiver_id else f.requester_id end as fid
    from friendships f, me
    where f.status = 'accepted' and (f.requester_id = me.uid or f.receiver_id = me.uid)
  ),
  candidates as (
    select case when f.requester_id = mf.fid then f.receiver_id else f.requester_id end as cid, mf.fid
    from friendships f
    join my_friends mf on (f.requester_id = mf.fid or f.receiver_id = mf.fid)
    where f.status = 'accepted'
  )
  select u.id, u.full_name, u.username, u.avatar_url, count(distinct c.fid)::int as mutual
  from candidates c
  join users u on u.id = c.cid
  cross join me
  where me.uid is not null
    and c.cid <> me.uid
    and c.cid not in (select fid from my_friends)
    and coalesce(u.discoverable, true)
    and not exists (
      select 1 from friendships x
      where (x.requester_id = me.uid and x.receiver_id = c.cid)
         or (x.receiver_id = me.uid and x.requester_id = c.cid)
    )
    and not public.is_blocked(me.uid, c.cid)
  group by u.id, u.full_name, u.username, u.avatar_url
  order by mutual desc, u.full_name
  limit least(greatest(p_limit, 1), 30);
$$;

revoke all on function public.suggest_friends(int) from public, anon;
grant execute on function public.suggest_friends(int) to authenticated;

-- ---------- 2. Relancer un ami ----------
-- Envoie à un ami la notification « X te relance » (type 'nudge', poussée par le webhook send-push).
-- Une seule relance par jour et par ami (dedupe_key unique). Réponses : 'sent', 'already', 'not_friend', 'auth'.
create or replace function public.nudge_friend(p_friend uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return 'auth'; end if;
  if p_friend is null or p_friend = me or not public.is_friend(me, p_friend) or public.is_blocked(me, p_friend) then
    return 'not_friend';
  end if;
  insert into notifications (recipient_id, actor_id, type, dedupe_key)
  values (p_friend, me, 'nudge', 'nudge:' || me || ':' || p_friend || ':' || to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD'))
  on conflict (dedupe_key) do nothing;
  if not found then return 'already'; end if;
  return 'sent';
end $$;

revoke all on function public.nudge_friend(uuid) from public, anon;
grant execute on function public.nudge_friend(uuid) to authenticated;
