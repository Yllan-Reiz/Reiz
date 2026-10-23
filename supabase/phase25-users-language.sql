-- Langue de l'app de chaque personne (fr, en, es, he) : le serveur écrit les notifications dans cette langue.
-- Vide = français (tous les comptes créés avant la version 1.1). Appliquée le 24/10/2026.
alter table public.users add column if not exists language text check (language in ('fr','en','es','he'));

-- Fuseau horaire de l'iPhone (« Asia/Jerusalem ») : l'heure affichée sur la carte du duo est celle de celui qui la reçoit.
alter table public.users add column if not exists timezone text;
-- Langue de la carte du duo en cours, pour que ses alertes orange et rouge restent dans la même langue.
alter table public.live_activity_runs add column if not exists lang text;
