-- ============================================================
-- REIZ — Correctif urgent du 27/09/2026 (après phase6-activite.sql)
-- ============================================================
-- comment_likes avait une clé primaire (comment_id, user_id) : l'API la
-- prenait pour une table de liaison entre comments et users, et la lecture
-- « commentaires + auteur » devenait ambiguë (erreur PGRST201).
-- Conséquence : plus aucun commentaire ne s'affichait, même sur le build
-- TestFlight actuel. On passe à une clé technique, l'unicité reste garantie.
-- ============================================================
alter table public.comment_likes drop constraint if exists comment_likes_pkey;
alter table public.comment_likes add column if not exists id uuid not null default gen_random_uuid();
alter table public.comment_likes add constraint comment_likes_pkey primary key (id);
do $$ begin
  alter table public.comment_likes add constraint comment_likes_unique unique (comment_id, user_id);
exception when duplicate_object or duplicate_table then null; end $$;
-- Force l'API à relire la structure tout de suite.
notify pgrst, 'reload schema';
