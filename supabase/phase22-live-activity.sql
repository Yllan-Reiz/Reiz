-- Phase 22 (23/10/2026, version 1.0.1, build 13) : Activité en direct du duo.
-- Le serveur lance la carte « Hugo t'attend 🤝 » (compte à rebours d'une heure) sur l'iPhone de l'ami identifié.
-- Il lui faut le jeton « push-to-start » de cet iPhone (iOS 17.2 et plus) : un par compte.
-- L'app ne lit jamais cette table : elle passe par les deux fonctions ci-dessous. Seul le serveur (service role) lit les jetons.

create table if not exists public.live_activity_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);
alter table public.live_activity_tokens enable row level security;
revoke all on public.live_activity_tokens from anon, authenticated;

-- Range le jeton de cet iPhone pour le compte connecté. Un même iPhone ne sert qu'un compte à la fois :
-- si un autre compte avait ce jeton (changement de compte sur le téléphone), il le perd.
create or replace function public.save_live_activity_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce(length(p_token), 0) < 16 or length(p_token) > 512 then return; end if;
  delete from live_activity_tokens where token = p_token and user_id <> auth.uid();
  insert into live_activity_tokens (user_id, token, updated_at) values (auth.uid(), p_token, now())
  on conflict (user_id) do update set token = excluded.token, updated_at = now();
end;
$$;

-- Déconnexion : plus de carte pour ce compte sur ce téléphone.
create or replace function public.forget_live_activity_token()
returns void
language sql
security definer
set search_path = public
as $$
  delete from live_activity_tokens where user_id = auth.uid();
$$;

revoke all on function public.save_live_activity_token(text) from public, anon;
revoke all on function public.forget_live_activity_token() from public, anon;
grant execute on function public.save_live_activity_token(text) to authenticated;
grant execute on function public.forget_live_activity_token() to authenticated;
