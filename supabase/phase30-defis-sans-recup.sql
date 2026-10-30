-- Phase 30 (30/10/2026) : un post « Récup » du moment Reiz ne rapporte pas de point dans un défi duo.
-- Les défis se gagnent au nombre de jours où l'on poste : sans ça, on gagnerait depuis son canapé.
-- Demande phase29 (colonne updates.moment). Sans effet sur les défis passés (score déjà figé) ni sur les
-- posts existants (aucun n'est marqué récup avant la 1.2).

create or replace function public.duel_days(p_user uuid, p_from timestamptz, p_to timestamptz)
returns integer language sql stable security definer set search_path to 'public' as $function$
  select count(distinct (u.created_at at time zone 'Europe/Paris')::date)::int
  from updates u
  join objectives o on o.id = u.objective_id
  where u.user_id = p_user
    and u.created_at >= p_from and u.created_at < p_to
    and o.visibility <> 'private'
    and u.moment is distinct from 'recovery';
$function$;

-- Annulation : recréer la fonction sans la dernière condition.
