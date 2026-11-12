-- Phase 37 (12/11/2026) : une invitation ne passe pas par-dessus un refus.
--
-- Trouvé en essayant à blanc la phase 33 (audit de sécurité) avec la phase 35 (invitations) : quand un compte tout
-- neuf ouvrait le lien de quelqu'un avec qui une demande d'ami avait été REFUSÉE, accept_invite repassait la ligne de
-- « rejected » à « accepted ». C'est déjà discutable (un refus doit rester un refus), et le garde-fou de la phase 33
-- (friendships_guard_update : seul pending -> accepted ou rejected est permis) le fait échouer avec une erreur.
-- Ici : amitié refusée = le lien ne fait rien (status « none »). Tout le reste de la fonction est identique à la phase 35.
--
-- À appliquer AVANT ou AVEC la phase 33. Essai à blanc fait le 12/11/2026 : erreur avant, « none » après.

create or replace function public.accept_invite(p_code text, p_via text default 'link')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_inviter uuid;
  v_name text;
  v_f record;
  v_fresh boolean;
  v_id uuid;
  v_via text := case when p_via in ('link', 'deferred') then p_via else 'link' end;
begin
  if v_uid is null or p_code is null then return jsonb_build_object('status', 'none'); end if;
  select user_id into v_inviter from invite_codes where code = lower(trim(p_code));
  if v_inviter is null then return jsonb_build_object('status', 'unknown'); end if;
  if v_inviter = v_uid then return jsonb_build_object('status', 'self'); end if;
  select created_at > now() - interval '48 hours' into v_fresh from users where id = v_uid;
  if v_fresh is null then return jsonb_build_object('status', 'no_profile'); end if; -- profil pas encore créé : l'app réessaie
  if exists (select 1 from blocks
             where (blocker_id = v_inviter and blocked_id = v_uid) or (blocker_id = v_uid and blocked_id = v_inviter)) then
    return jsonb_build_object('status', 'none');
  end if;
  select split_part(full_name, ' ', 1) into v_name from users where id = v_inviter;

  select id, status, requester_id into v_f from friendships
  where least(requester_id, receiver_id) = least(v_uid, v_inviter)
    and greatest(requester_id, receiver_id) = greatest(v_uid, v_inviter)
  limit 1;
  if v_f.status = 'accepted' then return jsonb_build_object('status', 'already', 'name', v_name); end if;
  -- Une demande refusée reste refusée : un lien ne passe pas par-dessus (et le garde-fou des amitiés l'interdit).
  if v_f.status = 'rejected' then return jsonb_build_object('status', 'none'); end if;

  -- Compte déjà installé depuis plus de 48 h : le lien vaut une demande d'ami, pas une amitié d'office.
  if not v_fresh then
    if v_f.id is null then
      insert into friendships (requester_id, receiver_id, status) values (v_uid, v_inviter, 'pending');
    elsif v_f.status = 'pending' and v_f.requester_id = v_inviter then
      update friendships set status = 'accepted' where id = v_f.id; -- il m'avait déjà demandé : j'accepte
      return jsonb_build_object('status', 'friends', 'name', v_name);
    end if;
    return jsonb_build_object('status', 'requested', 'name', v_name);
  end if;

  if v_f.id is not null then
    update friendships set status = 'accepted' where id = v_f.id;
    v_id := v_f.id;
  else
    -- Celui qui a partagé son lien est le demandeur, le nouvel inscrit a accepté en s'inscrivant avec.
    insert into friendships (requester_id, receiver_id, status) values (v_inviter, v_uid, 'accepted') returning id into v_id;
  end if;
  if v_id is null then return jsonb_build_object('status', 'none'); end if;

  -- « Léa a rejoint Reiz avec ton lien » : dans l'Activité de celui qui a invité, et en notification.
  insert into notifications (recipient_id, actor_id, type, dedupe_key)
  values (v_inviter, v_uid, 'invite_joined', 'ij:' || v_id)
  on conflict (dedupe_key) do nothing;

  -- Mesure (étape 6) : une ligne pour chacun, écrite ici pour ne dépendre d'aucun téléphone.
  insert into events (user_id, name, screen, props) values
    (v_uid, 'invite_accepted', 'onboarding', jsonb_build_object('role', 'invitee', 'via', v_via)),
    (v_inviter, 'invite_accepted', 'onboarding', jsonb_build_object('role', 'inviter', 'via', v_via));

  return jsonb_build_object('status', 'friends', 'name', v_name);
end $$;

-- Annulation : réexécuter la fonction accept_invite de phase35-invitations.sql.
