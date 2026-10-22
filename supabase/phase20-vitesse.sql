-- Phase 20 (22/10/2026) : vitesse. Aucune règle d'accès ne change, seulement la façon de la calculer.
-- 1. Les règles RLS appellent (select auth.uid()) au lieu de auth.uid() : Postgres le calcule UNE fois par requête
--    au lieu d'une fois par ligne (conseil « auth_rls_initplan » de Supabase, 38 règles).
-- 2. Index manquants : ordre du fil (updates.created_at) et clés des notifications (suppressions en cascade).
alter policy blocks_delete on public.blocks using ((blocker_id = (select auth.uid())));
alter policy blocks_insert on public.blocks with check (((blocker_id = (select auth.uid())) AND (blocker_id <> blocked_id)));
alter policy blocks_select on public.blocks using ((blocker_id = (select auth.uid())));
alter policy close_friends_delete on public.close_friends using ((owner_id = (select auth.uid())));
alter policy close_friends_insert on public.close_friends with check (((owner_id = (select auth.uid())) AND is_friend(owner_id, friend_id)));
alter policy close_friends_select on public.close_friends using ((owner_id = (select auth.uid())));
alter policy comment_likes_delete on public.comment_likes using ((user_id = (select auth.uid())));
alter policy comment_likes_insert on public.comment_likes with check (((user_id = (select auth.uid())) AND can_see_comment(comment_id)));
alter policy comments_delete on public.comments using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM updates u WHERE ((u.id = comments.update_id) AND (u.user_id = (select auth.uid())))))));
alter policy comments_insert on public.comments with check (((user_id = (select auth.uid())) AND can_see_update(update_id)));
alter policy duo_challenges_select on public.duo_challenges using ((((select auth.uid()) = challenger_id) OR ((select auth.uid()) = opponent_id)));
alter policy friendships_delete on public.friendships using (((requester_id = (select auth.uid())) OR (receiver_id = (select auth.uid()))));
alter policy friendships_insert on public.friendships with check (((requester_id = (select auth.uid())) AND (requester_id <> receiver_id) AND (status = 'pending'::text)));
alter policy friendships_select on public.friendships using (((requester_id = (select auth.uid())) OR (receiver_id = (select auth.uid()))));
alter policy friendships_update on public.friendships using ((receiver_id = (select auth.uid()))) with check ((receiver_id = (select auth.uid())));
alter policy notifications_delete on public.notifications using ((recipient_id = (select auth.uid())));
alter policy notifications_select on public.notifications using ((recipient_id = (select auth.uid())));
alter policy notifications_update on public.notifications using ((recipient_id = (select auth.uid()))) with check ((recipient_id = (select auth.uid())));
alter policy objectives_delete on public.objectives using ((user_id = (select auth.uid())));
alter policy objectives_insert on public.objectives with check ((user_id = (select auth.uid())));
alter policy objectives_select on public.objectives using (((user_id = (select auth.uid())) OR (visibility = 'public'::text) OR ((visibility = 'friends'::text) AND is_friend((select auth.uid()), user_id)) OR ((visibility = 'close'::text) AND is_close(user_id, (select auth.uid())))));
alter policy objectives_update on public.objectives using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy presence_delete on public.presence using ((user_id = (select auth.uid())));
alter policy presence_insert on public.presence with check ((user_id = (select auth.uid())));
alter policy presence_select on public.presence using (((user_id = (select auth.uid())) OR is_close(user_id, (select auth.uid()))));
alter policy profile_tags_delete on public.profile_tags using ((user_id = (select auth.uid())));
alter policy profile_tags_insert on public.profile_tags with check ((user_id = (select auth.uid())));
alter policy profile_tags_update on public.profile_tags using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy reactions_delete on public.reactions using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1 FROM updates u WHERE ((u.id = reactions.update_id) AND (u.user_id = (select auth.uid())))))));
alter policy reactions_insert on public.reactions with check (((user_id = (select auth.uid())) AND can_see_update(update_id)));
alter policy reports_insert on public.reports with check ((reporter_id = (select auth.uid())));
alter policy tag_endorsements_delete on public.tag_endorsements using ((user_id = (select auth.uid())));
alter policy tag_endorsements_insert on public.tag_endorsements with check (((user_id = (select auth.uid())) AND can_see_tag(tag_id) AND (NOT (EXISTS ( SELECT 1 FROM profile_tags t WHERE ((t.id = tag_endorsements.tag_id) AND (t.user_id = (select auth.uid()))))))));
alter policy updates_delete on public.updates using ((user_id = (select auth.uid())));
alter policy updates_insert on public.updates with check ((user_id = (select auth.uid())));
alter policy updates_update on public.updates using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy users_insert on public.users with check ((id = (select auth.uid())));
alter policy users_update on public.users using ((id = (select auth.uid()))) with check ((id = (select auth.uid())));

create index if not exists updates_created_idx on public.updates (created_at desc);
create index if not exists notifications_update_idx on public.notifications (update_id);
create index if not exists notifications_comment_idx on public.notifications (comment_id);
create index if not exists notifications_objective_idx on public.notifications (objective_id);
