-- ============================================================
-- REIZ — Vérification : aucune table sans RLS
-- ============================================================
-- À lancer avant la mise en production. Ne modifie rien.
-- Toute table listée avec rls_active = false est lisible et
-- modifiable par n'importe quel compte connecté.
-- ============================================================

select
  c.relname                                   as table_name,
  c.relrowsecurity                            as rls_active,
  (select count(*) from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = c.relname)            as nb_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity asc, c.relname;
