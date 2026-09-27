-- ============================================================
-- REIZ — Phase 7 (27/09/2026) : posts épinglés sur le profil
-- ============================================================
-- Ajoute une date d'épinglage aux publications (vide = pas épinglé).
-- Sans risque pour l'app actuelle : elle ne lit pas cette colonne.
-- La modification reste réservée à l'auteur du post (policy updates_update
-- déjà en place : user_id = auth.uid()).
-- ============================================================
alter table public.updates add column if not exists pinned_at timestamptz;
create index if not exists updates_pinned_idx on public.updates(user_id) where pinned_at is not null;

-- Plafond de 3 épinglés par personne, vérifié aussi côté serveur.
create or replace function public.updates_max_pinned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pinned_at is not null and (old.pinned_at is null) and
     (select count(*) from updates where user_id = new.user_id and pinned_at is not null and id <> new.id) >= 3 then
    raise exception '3 posts épinglés maximum';
  end if;
  return new;
end $$;
drop trigger if exists updates_max_pinned on public.updates;
create trigger updates_max_pinned before update of pinned_at on public.updates
  for each row execute function public.updates_max_pinned();

notify pgrst, 'reload schema';
