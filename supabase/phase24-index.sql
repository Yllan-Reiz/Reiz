-- Phase 24 (23/10/2026) : index recommandés par le conseiller de performance Supabase (clés étrangères sans index).
-- Uniquement des AJOUTS : accélèrent les suppressions en cascade (compte supprimé) et les recherches par ces colonnes.
create index if not exists comment_likes_user_idx on public.comment_likes (user_id);
create index if not exists duo_challenges_winner_idx on public.duo_challenges (winner_id);
create index if not exists notifications_challenge_idx on public.notifications (challenge_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists tag_endorsements_user_idx on public.tag_endorsements (user_id);
