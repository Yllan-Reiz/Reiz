-- ============================================================
-- REIZ — 27/09/2026 : vrai nombre d'amis sur le profil d'un ami
-- ============================================================
-- La RLS de friendships ne laisse voir que ses propres amitiés : sur le profil
-- d'un ami, l'app ne comptait que la vôtre (« 1 ami » partout). Cette fonction
-- renvoie seulement un nombre, jamais la liste des amis.
create or replace function public.friend_count(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from friendships
  where status = 'accepted' and (requester_id = p_user or receiver_id = p_user);
$$;
revoke all on function public.friend_count(uuid) from public, anon;
grant execute on function public.friend_count(uuid) to authenticated;
