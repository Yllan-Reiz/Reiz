-- Phase 27a (30/10/2026) : un objectif atteint est enfin enregistré comme terminé.
-- L'app range un objectif dans « Atteints » (🏆) dès que la valeur arrive à la cible, mais n'écrivait jamais
-- is_completed en base : le back-office comptait 0 objectif terminé alors que 5 avaient atteint leur cible.
-- Il n'envoie aucune notification (l'annonce aux amis passe par send-push, sur le post qui atteint 100 %).
-- Seul effet visible dans les versions installées : les objectifs passés une fois par un post à 100 % puis
-- redescendus (3 au 30/10/2026) rejoignent la liste « Atteints » de leur auteur.
--
--   1. colonne completed_at (date de la victoire, pour le back-office)
--   2. rattrapage des objectifs déjà atteints, daté du premier post à 100 % (y compris un record en kg
--      passé une fois puis redescendu : une victoire reste une victoire, comme le fait le trigger)
--   3. trigger : atteint => terminé ; cible relevée au-dessus de la valeur (« Monter la barre », 1.2) => repart

alter table public.objectives add column if not exists completed_at timestamptz;

update public.objectives o
set is_completed = true,
    completed_at = coalesce((select min(u.created_at) from public.updates u where u.objective_id = o.id and u.progress_value >= 100), now())
where not coalesce(o.is_completed, false)
  and ((o.target_value > 0 and o.current_value >= o.target_value)
       or exists (select 1 from public.updates u where u.objective_id = o.id and u.progress_value >= 100));

create or replace function public.objective_completion()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.target_value > 0 and new.current_value >= new.target_value then
    if not coalesce(new.is_completed, false) or new.completed_at is null then
      new.is_completed := true;
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  elsif tg_op = 'UPDATE' then
    -- Une fois gagné, il le reste (un record à 50 kg puis un post à 45 kg ne l'annule pas),
    -- sauf si la cible est relevée : l'objectif repart pour une nouvelle victoire.
    if coalesce(new.is_completed, false) and new.target_value is distinct from old.target_value then
      new.is_completed := false;
      new.completed_at := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists objective_completion on public.objectives;
create trigger objective_completion
  before insert or update on public.objectives
  for each row execute function public.objective_completion();

-- Vérification : les deux nombres doivent être égaux.
select
  (select count(*) from public.objectives o where (o.target_value > 0 and o.current_value >= o.target_value)
     or exists (select 1 from public.updates u where u.objective_id = o.id and u.progress_value >= 100)) as deja_gagnes,
  (select count(*) from public.objectives where is_completed) as termines;

-- Annulation :
--   drop trigger if exists objective_completion on public.objectives;
--   drop function if exists public.objective_completion();
--   alter table public.objectives drop column if exists completed_at;
--   (les is_completed remis à true par le rattrapage restent)
