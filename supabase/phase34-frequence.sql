-- Phase 34 (12/11/2026) : la fréquence d'abord (1.4).
-- Un objectif se joue sur la semaine (« 3 fois par semaine »), n'importe quels jours. Les jours choisis
-- (training_days) restent en base, inchangés : ils ne servent plus qu'à choisir les jours de rappel.
-- La série se compte en semaines réussies (calcul fait par l'app et par notify-moment, rien à stocker).
--
-- Ce script ne supprime rien. Il fait trois choses :
--   1. une copie de sauvegarde des objectifs qu'il touche (pour revenir en arrière à l'identique) ;
--   2. la colonne `category` (catégorie tirée de la phrase de création, étape 2 : musculation, course...) ;
--   3. la conversion des derniers compteurs « N séances / N fois » encore ouverts et sans rythme (9 au 12/11/2026,
--      créés depuis d'anciennes versions de l'app) :
--        a. cible de 1 à 7  = c'était un rythme pris pour un total (même règle que la phase 31 b) :
--           N par semaine, 12 semaines à partir d'aujourd'hui, séances faites = posts déjà publiés ;
--        b. cible au-delà de 7 avec des jours choisis = un total à atteindre : le rythme devient le nombre de jours
--           choisis, le total et la progression ne bougent pas, la période repart d'aujourd'hui et l'échéance est le
--           temps qu'il faut à ce rythme pour finir ce qui reste (personne ne se retrouve en retard d'office).
--      Les records (kg, km, min, reps, %), les objectifs terminés et les totaux sans jours choisis ne sont pas touchés.
-- Les anciennes versions de l'app lisent toujours current_value / target_value : rien ne casse pour elles.

begin;

create table if not exists public.objectives_backup_phase34 as
select o.*, now() as saved_at
from public.objectives o
where o.unit in ('séances', 'fois') and o.per_week is null and not coalesce(o.is_completed, false)
  and (o.target_value between 1 and 7 or coalesce(array_length(o.training_days, 1), 0) between 1 and 6);

-- La sauvegarde n'est lisible par personne depuis l'app.
alter table public.objectives_backup_phase34 enable row level security;

alter table public.objectives add column if not exists category text;
comment on column public.objectives.category is
  'Catégorie tirée de la phrase de création (1.4) : musculation, course, velo, natation, combat, hyrox, street, autre... Null pour les objectifs d''avant.';

-- a. Petite cible : un rythme hebdo pris pour un total.
update public.objectives o
set per_week = o.target_value::int,
    starts_at = current_date,
    deadline = current_date + 84,
    target_value = o.target_value * 12,
    current_value = (select count(*) from public.updates u where u.objective_id = o.id)
where o.unit in ('séances', 'fois') and o.per_week is null and not coalesce(o.is_completed, false)
  and o.target_value between 1 and 7 and o.target_value = floor(o.target_value);

-- b. Total à atteindre avec des jours choisis : le nombre de jours devient le rythme.
update public.objectives o
set per_week = array_length(o.training_days, 1),
    starts_at = current_date,
    deadline = current_date + 7 * greatest(1, ceil((o.target_value - coalesce(o.current_value, 0)) / array_length(o.training_days, 1))::int)
where o.unit in ('séances', 'fois') and o.per_week is null and not coalesce(o.is_completed, false)
  and o.target_value > 7 and coalesce(array_length(o.training_days, 1), 0) between 1 and 6;

commit;

-- Vérification (doit renvoyer 0) :
--   select count(*) from public.objectives
--   where unit in ('séances','fois') and per_week is null and not coalesce(is_completed,false)
--     and (target_value between 1 and 7 or coalesce(array_length(training_days,1),0) between 1 and 6);
--
-- Annulation à l'identique :
--   update public.objectives o
--   set per_week = b.per_week, starts_at = b.starts_at, deadline = b.deadline,
--       target_value = b.target_value, current_value = b.current_value
--   from public.objectives_backup_phase34 b where b.id = o.id;
--   drop table public.objectives_backup_phase34;
--   alter table public.objectives drop column if exists category;
