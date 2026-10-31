-- Phase 31 b (31/10/2026) : les objectifs « N séances » avec N <= 7 étaient des rythmes hebdo pris pour des totaux :
-- l'app disait « bravo » au bout de N posts (7 d'entre eux ont plus de posts que leur cible). On les convertit :
-- N par semaine, période de 12 semaines à partir d'aujourd'hui, cible = N x 12, séances faites = posts déjà publiés,
-- et on les rouvre. Chacun pourra changer l'échéance dans « Modifier l'objectif ».
-- À appliquer EN MÊME TEMPS que la mise à jour à distance qui affiche les rythmes.

update public.objectives o
set per_week = target_value::int,
    starts_at = current_date,
    deadline = current_date + 84,
    target_value = target_value * 12,
    current_value = (select count(*) from public.updates u where u.objective_id = o.id),
    is_completed = false,
    completed_at = null
where unit = 'séances' and target_value between 1 and 7 and per_week is null;
