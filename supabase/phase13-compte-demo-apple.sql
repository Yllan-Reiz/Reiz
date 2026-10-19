-- phase13 : compte de démonstration pré-rempli pour la revue Apple (guideline 2.1(a))
--
-- Pourquoi : le relecteur d'Apple arrive avec un compte vide. Il doit pouvoir voir un cercle,
-- des objectifs, des publications et signaler / bloquer un contenu.
--
-- Ce que ça fait (idempotent, relançable sans doublon) :
--   1. compte « demo.apple@reiz.test » (déjà créé, pseudo « applereview ») : 2 objectifs, 2 publications
--   2. 3 amis FICTIFS (théo, sarah, inès) : comptes sans mot de passe, impossibles à connecter
--   3. amitiés acceptées avec le compte de démo, théo dans le cercle proche
--   4. 1 publication par ami, pour pouvoir tester signalement et blocage
--
-- À exécuter par Yllan dans le SQL Editor de Supabase. Aucun vrai utilisateur n'est touché.
-- Pour tout retirer : supprimer les 3 comptes dont l'e-mail finit par @demo.reiz.test
-- (Authentication, Users), le reste part en cascade.

do $$
declare
  demo_id uuid;
  theo uuid;
  sarah uuid;
  ines uuid;
  obj_seances uuid;
  obj_course uuid;
begin
  select id into demo_id from auth.users where email = 'demo.apple@reiz.test';
  if demo_id is null then
    raise exception 'Compte demo.apple@reiz.test introuvable : le créer d''abord dans Authentication, Users';
  end if;

  -- 1. amis fictifs : on réutilise les comptes s'ils existent déjà (relance sans doublon)
  select id into theo  from auth.users where email = 'theo@demo.reiz.test';
  select id into sarah from auth.users where email = 'sarah@demo.reiz.test';
  select id into ines  from auth.users where email = 'ines@demo.reiz.test';

  if theo is null then
    theo := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', theo, 'authenticated', 'authenticated', 'theo@demo.reiz.test', '',
            now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
  end if;
  if sarah is null then
    sarah := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', sarah, 'authenticated', 'authenticated', 'sarah@demo.reiz.test', '',
            now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
  end if;
  if ines is null then
    ines := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', ines, 'authenticated', 'authenticated', 'ines@demo.reiz.test', '',
            now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
  end if;

  -- profils publics des amis fictifs
  insert into public.users (id, username, full_name, bio) values
    (theo,  'theo_demo',  'Théo',  'Salle 4 fois par semaine.'),
    (sarah, 'sarah_demo', 'Sarah', 'Je cours le dimanche.'),
    (ines,  'ines_demo',  'Inès',  'Objectif : tenir jusqu''en décembre.')
  on conflict (id) do nothing;

  -- 2. amitiés acceptées avec le compte de démo (une seule ligne par paire)
  insert into public.friendships (requester_id, receiver_id, status)
  select v.a, v.b, 'accepted'
  from (values (theo, demo_id), (sarah, demo_id), (ines, demo_id)) as v(a, b)
  where not exists (
    select 1 from public.friendships f
    where (f.requester_id = v.a and f.receiver_id = v.b) or (f.requester_id = v.b and f.receiver_id = v.a)
  );
  update public.friendships set status = 'accepted'
  where (requester_id in (theo, sarah, ines) and receiver_id = demo_id)
     or (receiver_id in (theo, sarah, ines) and requester_id = demo_id);

  -- cercle proche : théo
  insert into public.close_friends (owner_id, friend_id)
  select demo_id, theo
  where not exists (select 1 from public.close_friends where owner_id = demo_id and friend_id = theo);

  -- 3. objectifs du compte de démo (une seule fois)
  if not exists (select 1 from public.objectives where user_id = demo_id and title = '4 séances par semaine') then
    insert into public.objectives (user_id, title, emoji, target_value, current_value, unit, visibility)
    values (demo_id, '4 séances par semaine', '💪', 4, 3, 'séances', 'friends')
    returning id into obj_seances;
  else
    select id into obj_seances from public.objectives where user_id = demo_id and title = '4 séances par semaine';
  end if;

  if not exists (select 1 from public.objectives where user_id = demo_id and title = 'Courir 20 km') then
    insert into public.objectives (user_id, title, emoji, target_value, current_value, unit, visibility)
    values (demo_id, 'Courir 20 km', '🏃', 20, 8, 'km', 'friends')
    returning id into obj_course;
  else
    select id into obj_course from public.objectives where user_id = demo_id and title = 'Courir 20 km';
  end if;

  -- 4. publications : 2 du compte de démo, 1 par ami fictif (texte seul, sans photo)
  insert into public.updates (user_id, objective_id, caption, progress_value, created_at)
  select demo_id, obj_seances, 'Séance jambes terminée. Troisième de la semaine.', 75, now() - interval '2 hours'
  where not exists (select 1 from public.updates where user_id = demo_id and caption like 'Séance jambes terminée%');

  insert into public.updates (user_id, objective_id, caption, progress_value, created_at)
  select demo_id, obj_course, '8 km ce matin, premier tiers fait.', 40, now() - interval '5 hours'
  where not exists (select 1 from public.updates where user_id = demo_id and caption like '8 km ce matin%');

  insert into public.updates (user_id, caption, progress_value, created_at)
  select theo, 'Dos et biceps, ça pique encore.', null, now() - interval '1 hour'
  where not exists (select 1 from public.updates where user_id = theo);

  insert into public.updates (user_id, caption, progress_value, created_at)
  select sarah, 'Sortie longue sous la pluie, mission accomplie.', null, now() - interval '3 hours'
  where not exists (select 1 from public.updates where user_id = sarah);

  insert into public.updates (user_id, caption, progress_value, created_at)
  select ines, 'Je n''avais pas envie, j''y suis allée quand même.', null, now() - interval '4 hours'
  where not exists (select 1 from public.updates where user_id = ines);
end $$;

-- Vérification : doit afficher 3 amis, 2 objectifs, 2 publications pour le compte de démo.
select
  (select count(*) from public.friendships f join auth.users u on u.email = 'demo.apple@reiz.test'
     where f.status = 'accepted' and (f.requester_id = u.id or f.receiver_id = u.id)) as amis,
  (select count(*) from public.objectives o join auth.users u on u.id = o.user_id
     where u.email = 'demo.apple@reiz.test') as objectifs,
  (select count(*) from public.updates p join auth.users u on u.id = p.user_id
     where u.email = 'demo.apple@reiz.test') as publications;
