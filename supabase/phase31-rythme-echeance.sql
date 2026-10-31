-- Phase 31 (31/10/2026) : un objectif = un rythme et une échéance (retour des testeurs via Yllan).
--   Rythme  : « 4 séances par semaine » (per_week), jusqu'à une date (deadline). La cible (target_value) est le total de
--             séances sur la période, current_value le nombre de séances faites. Atteint seulement à l'échéance (bilan).
--   Record  : « 240 kg au squat » (per_week null), échéance facultative. Atteint dès que la valeur est passée, comme avant.
-- starts_at : début de la période (les semaines se comptent depuis cette date).
-- Les anciens builds lisent toujours current_value / target_value : « 12 / 48 séances », rien ne casse.

alter table public.objectives add column if not exists per_week integer check (per_week between 1 and 14);
alter table public.objectives add column if not exists starts_at date not null default current_date;

-- Un rythme ne se termine jamais tout seul en passant la cible : c'est l'échéance qui le clôt (l'app fait le bilan).
create or replace function public.objective_completion()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.per_week is null and new.target_value > 0 and new.current_value >= new.target_value then
    if not coalesce(new.is_completed, false) or new.completed_at is null then
      new.is_completed := true;
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  elsif tg_op = 'UPDATE' then
    if coalesce(new.is_completed, false) and new.per_week is null and new.target_value is distinct from old.target_value then
      new.is_completed := false;
      new.completed_at := null;
    end if;
  end if;
  return new;
end $$;

-- Annulation :
--   alter table public.objectives drop column if exists per_week, drop column if exists starts_at;
--   (et remettre l'ancienne fonction objective_completion, sans la condition per_week)
