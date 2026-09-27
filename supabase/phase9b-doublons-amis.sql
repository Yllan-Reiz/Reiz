-- ============================================================
-- REIZ — 27/09/2026 : amitiés en double
-- ============================================================
-- Quand deux personnes s'envoient une demande en même temps et acceptent
-- chacune celle de l'autre, il reste 2 lignes pour la même amitié : l'ami
-- apparaît deux fois dans la liste et le compteur d'amis est faux.
-- 2 paires concernées au 27/09/2026.
-- ============================================================

-- 1. On garde la plus ancienne ligne de chaque paire, on supprime les autres.
delete from public.friendships f
using public.friendships g
where least(f.requester_id, f.receiver_id) = least(g.requester_id, g.receiver_id)
  and greatest(f.requester_id, f.receiver_id) = greatest(g.requester_id, g.receiver_id)
  and (f.created_at, f.id) > (g.created_at, g.id);

-- 2. Demander en ami quelqu'un qui t'a déjà demandé = accepter sa demande,
--    au lieu de créer une deuxième ligne.
create or replace function public.friendships_no_duplicate()
returns trigger language plpgsql security definer set search_path = public as $$
declare existing record;
begin
  select id, status, requester_id into existing from friendships
  where least(requester_id, receiver_id) = least(new.requester_id, new.receiver_id)
    and greatest(requester_id, receiver_id) = greatest(new.requester_id, new.receiver_id)
  limit 1;
  if existing.id is null then return new; end if;
  if existing.status = 'pending' and existing.requester_id = new.receiver_id then
    update friendships set status = 'accepted' where id = existing.id;
  end if;
  return null; -- rien à insérer : l'amitié (ou la demande) existe déjà
end $$;
drop trigger if exists friendships_no_duplicate on public.friendships;
create trigger friendships_no_duplicate before insert on public.friendships
  for each row execute function public.friendships_no_duplicate();

-- 3. Filet de sécurité : une seule ligne par paire, quoi qu'il arrive.
create unique index if not exists friendships_one_per_pair
  on public.friendships (least(requester_id, receiver_id), greatest(requester_id, receiver_id));

-- 4. Compteur et liste d'amis sans doublon, même par accident.
create or replace function public.friend_count(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct case when requester_id = p_user then receiver_id else requester_id end)::int
  from friendships
  where status = 'accepted' and (requester_id = p_user or receiver_id = p_user);
$$;

create or replace function public.friends_of(p_user uuid)
returns table (id uuid, full_name text, username text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select distinct u.id, u.full_name, u.username, u.avatar_url
  from friendships f
  join users u on u.id = case when f.requester_id = p_user then f.receiver_id else f.requester_id end
  where f.status = 'accepted'
    and (f.requester_id = p_user or f.receiver_id = p_user)
    and (p_user = auth.uid() or public.is_friend(auth.uid(), p_user))
    and not public.is_blocked(auth.uid(), u.id)
  order by u.full_name;
$$;
