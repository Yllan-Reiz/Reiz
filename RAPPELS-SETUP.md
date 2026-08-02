# Allumer les rappels push quotidiens (Supabase)

Objectif : faire partir automatiquement le rappel « tu n'as pas encore posté aujourd'hui »
chaque soir. Les fonctions existent déjà, il faut juste les **déclencher** via un cron.

Ton secret cron (déjà généré) : `reiz_55fae710cabf945ff4745619`
Ta clé service_role : Dashboard → **Project Settings → API Keys** → copie la clé `service_role` (secret).

---

## Étape 1 — Activer les 2 extensions
Dashboard → **Database → Extensions**, cherche et active **`pg_cron`** et **`pg_net`**.
(ou colle ceci dans le SQL Editor)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

## Étape 2 — Enregistrer le secret cron
Dashboard → **Edge Functions → Secrets** → ajoute :
- Nom : `CRON_SECRET`
- Valeur : `reiz_55fae710cabf945ff4745619`

## Étape 3 — Planifier le rappel quotidien (SQL Editor)
Remplace `<TA_CLÉ_SERVICE_ROLE>` par ta clé de l'étape du haut, puis exécute :

```sql
select cron.schedule(
  'reiz-rappel-quotidien',
  '0 17 * * *',  -- 17h00 UTC = 19h00 à Paris (heure d'été)
  $$
  select net.http_post(
    url     := 'https://vpaizbtetwsnvbpmeuab.supabase.co/functions/v1/notify-daily-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <TA_CLÉ_SERVICE_ROLE>',
      'x-cron-secret', 'reiz_55fae710cabf945ff4745619'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

## Étape 4 (optionnel) — Le message de motivation, 3x/semaine
À tout le monde — donc à utiliser doucement pour ne pas saouler tes testeurs.

```sql
select cron.schedule(
  'reiz-rappel-motivation',
  '30 10 * * 1,3,5',  -- Lun/Mer/Ven 10h30 UTC = 12h30 Paris
  $$
  select net.http_post(
    url     := 'https://vpaizbtetwsnvbpmeuab.supabase.co/functions/v1/notify-random-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <TA_CLÉ_SERVICE_ROLE>',
      'x-cron-secret', 'reiz_55fae710cabf945ff4745619'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

---

## Tester tout de suite (sans attendre 19h)
Exécute ce bloc : il envoie le rappel maintenant. Pour recevoir la notif sur TON téléphone,
il faut que tu aies : l'app installée + notifs autorisées + au moins 1 objectif + ne PAS avoir
posté aujourd'hui.

```sql
select net.http_post(
  url     := 'https://vpaizbtetwsnvbpmeuab.supabase.co/functions/v1/notify-daily-reminder',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer <TA_CLÉ_SERVICE_ROLE>',
    'x-cron-secret', 'reiz_55fae710cabf945ff4745619'
  ),
  body    := '{}'::jsonb
);
```

## Gérer / annuler
```sql
select jobname, schedule from cron.job;            -- voir ce qui est planifié
select cron.unschedule('reiz-rappel-quotidien');   -- annuler le rappel quotidien
select cron.unschedule('reiz-rappel-motivation');  -- annuler le message de motivation
```

⚠️ Ce fichier et ces blocs contiennent (une fois remplis) ta clé service_role + ton secret :
ne les colle jamais dans un endroit public (GitHub, Discord, etc.).
