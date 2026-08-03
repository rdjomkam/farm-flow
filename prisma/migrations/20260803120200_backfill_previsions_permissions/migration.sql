-- Backfill: add the 4 Sprint PR1 "Previsions" permissions
-- (PREVISIONS_VOIR, PREVISIONS_GERER, PREVISIONS_PARAMETRER,
-- PREVISIONS_CLOTURER) to existing "SiteRole" rows.
--
-- "SiteRole.permissions" is a stored array snapshot taken at role-creation
-- time — it is NOT recomputed dynamically. The enum values were added by
-- 20260803120000_add_permission_sitemodule_previsions (`ALTER TYPE
-- "Permission" ADD VALUE ...`), which only changes the behaviour of
-- SiteRole rows created AFTER that migration ran. Every "SiteRole" already
-- persisted in prod before this migration is otherwise orphaned of these 4
-- permissions — same root cause as
-- 20260401000000_backfill_subscription_permissions (Sprint 30) and
-- 20260726160000_backfill_ventes_modifier_permissions (Sprint SU), see
-- ERR-105.
--
-- ERR-001 note: the ADD VALUE for these 4 permissions already happened in
-- an earlier, separate migration (20260803120000_...), so referencing the
-- new enum values here (in a later migration, not the same transaction as
-- the ADD VALUE) is safe.
--
-- Target roles, following ADR-053 §6 profile table and the exact same
-- targeting criterion as the two precedent backfill migrations above
-- (isSystem = true AND name = '<role name>', scoped to the seeded system
-- roles, never custom roles):
--   - "Administrateur" (profil ADR "Administrateur")  -> all 4 permissions
--   - "Gerant"          (profil ADR "Gestionnaire")    -> PREVISIONS_VOIR, PREVISIONS_GERER
--   - "Pisciculteur" is NOT touched: it does not correspond to the ADR's
--     "Lecteur" profile (no FINANCES_VOIR/DEPENSES_VOIR either — a
--     field-only role, Previsions exposes budget/tresorerie data it should
--     not see). Consistent with prisma/seed.sql.
--
-- Safe to run multiple times: array_cat + DISTINCT/unnest avoids
-- duplicates. No-op silently on any database with no matching SiteRole rows
-- (fresh/empty environments, sites without an "Administrateur"/"Gerant"
-- named system role).

-- 1. Administrateur system roles — all 4 Previsions permissions
UPDATE "SiteRole"
SET permissions = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      permissions || ARRAY[
        'PREVISIONS_VOIR',
        'PREVISIONS_GERER',
        'PREVISIONS_PARAMETRER',
        'PREVISIONS_CLOTURER'
      ]::"Permission"[]
    )
  )
)
WHERE "isSystem" = true
  AND name = 'Administrateur';

-- 2. Gerant system roles — PREVISIONS_VOIR + PREVISIONS_GERER only
--    (ADR-053 §6 "Gestionnaire" profile: no PREVISIONS_PARAMETRER,
--    no PREVISIONS_CLOTURER — reserved to Administrateur)
UPDATE "SiteRole"
SET permissions = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      permissions || ARRAY[
        'PREVISIONS_VOIR',
        'PREVISIONS_GERER'
      ]::"Permission"[]
    )
  )
)
WHERE "isSystem" = true
  AND name = 'Gerant';
