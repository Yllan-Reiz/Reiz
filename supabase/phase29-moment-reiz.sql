-- Phase 29 (30/10/2026) : le « moment Reiz », une notification par jour qui s'adapte à chacun.
--   jour d'entraînement (jours de ses objectifs) : vers son heure habituelle de post, « ta séance du jour »
--   jour de repos : une heure au hasard entre 9 h et 21 h, « ta récup du jour »
-- Posté dans les 10 minutes : « ⚡ À l'heure ». Après : « en retard de 2 h ». La récup compte dans la série.
-- La fonction notify-moment (toutes les 5 min) tire le moment de chacun et l'envoie ; l'app lit le sien.
-- Sans effet sur les versions installées : les colonnes sont facultatives, un moment reste un post normal pour elles.

-- 1. Un post peut être un moment : séance ou récup, et de combien de minutes il a suivi la notification.
alter table public.updates add column if not exists moment text check (moment in ('session', 'recovery'));
alter table public.updates add column if not exists moment_late_min integer check (moment_late_min >= 0);

-- 2. Le moment du jour de chacun (écrit par le serveur, lu par l'app pour le compte à rebours et le retard).
create table if not exists public.moments (
  user_id uuid not null references public.users(id) on delete cascade,
  day date not null,                                   -- jour local de la personne
  kind text not null check (kind in ('session', 'recovery')),
  at timestamptz not null,                             -- heure prévue
  sent_at timestamptz,                                 -- envoyé (ou écarté, voir skipped)
  skipped text,                                        -- 'posted' : avait déjà posté ; 'no_push' : pas de jeton
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
comment on table public.moments is 'Moment Reiz du jour de chaque membre (notify-moment). Chacun ne lit que le sien.';
create index if not exists moments_due_idx on public.moments (at) where sent_at is null;
alter table public.moments enable row level security;
drop policy if exists moments_select_own on public.moments;
create policy moments_select_own on public.moments for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.moments from anon;
revoke insert, update, delete on public.moments from authenticated;
grant select on public.moments to authenticated;

-- Annulation :
--   drop table if exists public.moments;
--   alter table public.updates drop column if exists moment_late_min, drop column if exists moment;
