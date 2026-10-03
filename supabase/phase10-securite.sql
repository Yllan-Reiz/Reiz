-- Phase 10 : durcissement des fonctions SECURITY DEFINER (audit du 03/10/2026).
-- Constat : n'importe qui avec la clé publique de l'app (sans compte) pouvait appeler
-- ces fonctions via /rest/v1/rpc/... et, par exemple, demander is_friend(a, b) pour
-- sonder qui est ami avec qui. Les fonctions de déclencheur n'ont aucune raison d'être
-- appelables du tout (elles tournent toutes seules).

-- 1) Fonctions de déclencheur : personne ne les appelle à la main.
revoke execute on function public.comments_normalize_parent()  from public, anon, authenticated;
revoke execute on function public.friendships_no_duplicate()   from public, anon, authenticated;
revoke execute on function public.notif_on_comment()           from public, anon, authenticated;
revoke execute on function public.notif_on_comment_like()      from public, anon, authenticated;
revoke execute on function public.notif_on_friendship()        from public, anon, authenticated;
revoke execute on function public.notif_on_objective()         from public, anon, authenticated;
revoke execute on function public.notif_on_reaction()          from public, anon, authenticated;
revoke execute on function public.notif_on_tag_endorse()       from public, anon, authenticated;
revoke execute on function public.notif_on_update()            from public, anon, authenticated;
revoke execute on function public.profile_tags_max()           from public, anon, authenticated;
revoke execute on function public.updates_max_pinned()         from public, anon, authenticated;
revoke execute on function public.updates_validate_duo()       from public, anon, authenticated;

-- 2) Aides utilisées par les règles d'accès (RLS) : réservées aux comptes connectés.
revoke execute on function public.can_see_comment(uuid) from public, anon;
revoke execute on function public.can_see_tag(uuid)     from public, anon;
revoke execute on function public.can_see_update(uuid)  from public, anon;
revoke execute on function public.is_blocked(uuid, uuid) from public, anon;
revoke execute on function public.is_close(uuid, uuid)   from public, anon;
revoke execute on function public.is_friend(uuid, uuid)  from public, anon;
grant  execute on function public.can_see_comment(uuid) to authenticated;
grant  execute on function public.can_see_tag(uuid)     to authenticated;
grant  execute on function public.can_see_update(uuid)  to authenticated;
grant  execute on function public.is_blocked(uuid, uuid) to authenticated;
grant  execute on function public.is_close(uuid, uuid)   to authenticated;
grant  execute on function public.is_friend(uuid, uuid)  to authenticated;

-- 3) Déjà réservées aux amis par leur code : on ferme juste la porte aux visiteurs.
revoke execute on function public.friend_count(uuid) from public, anon;
revoke execute on function public.friends_of(uuid)   from public, anon;
grant  execute on function public.friend_count(uuid) to authenticated;
grant  execute on function public.friends_of(uuid)   to authenticated;
