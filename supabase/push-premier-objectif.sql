-- Notification unique (04/11/2026) aux comptes SANS objectif qui ont un jeton push : « fixe ton premier objectif ».
-- Envoi direct à Expo depuis la base (pg_net), les jetons ne sortent pas de la base. Texte dans la langue du compte.
-- Le tap ouvre l'onglet Objectifs : sans objectif, l'app lance le parcours sport, profils, premier post.
-- ENVOYÉE le 04/11/2026 à 5 comptes (Expo : 5 × status ok). Ne pas relancer. Vérifier la cible avant tout nouvel envoi :
--   select count(*) from users u where push_token is not null and not exists (select 1 from objectives where user_id = u.id);
select net.http_post(
  url := 'https://exp.host/--/api/v2/push/send',
  headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
  body := jsonb_build_object(
    'to', u.push_token,
    'sound', 'default',
    'title', case coalesce(u.language, 'fr')
      when 'en' then 'Your circle is waiting 👋'
      when 'es' then 'Tu círculo te espera 👋'
      when 'he' then 'המעגל שלך מחכה 👋'
      else 'Ton cercle t''attend 👋' end,
    'body', case coalesce(u.language, 'fr')
      when 'en' then 'Set your first goal, it takes ten seconds. Showing up is already a goal.'
      when 'es' then 'Fija tu primer objetivo, son diez segundos. Ir ya es un objetivo.'
      when 'he' then 'קבעו את היעד הראשון, זה לוקח עשר שניות. להגיע זה כבר יעד.'
      else 'Fixe ton premier objectif, ça prend dix secondes. Y aller, c''est déjà un objectif.' end,
    'data', jsonb_build_object('type', 'new_objective')
  )
)
from users u
where u.push_token is not null
  and not exists (select 1 from objectives o where o.user_id = u.id);
