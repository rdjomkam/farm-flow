-- Backfill: add Sprint 30 subscription permissions to existing system roles.
--
-- In prod, SiteRole records created before Sprint 30 are missing these permissions.
-- New sites get them automatically via SYSTEM_ROLE_DEFINITIONS (Object.values(Permission)).
--
-- This migration adds the missing permissions to:
--   1. "Administrateur" system roles → ALL subscription permissions
--   2. "Gerant" system roles → ALL subscription permissions (same as admin minus SITE_GERER/MEMBRES_GERER)
--   3. Does NOT touch custom roles or Pisciculteur roles
--
-- Safe to run multiple times: array_cat + DISTINCT ensures no duplicates.

-- Define the permissions to add
-- (CALIBRAGES_MODIFIER was also missing from the original seed)

-- 1. Administrateur system roles — get all subscription permissions
UPDATE "SiteRole"
SET permissions = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      permissions || ARRAY[
        'CALIBRAGES_MODIFIER',
        'ABONNEMENTS_VOIR',
        'ABONNEMENTS_GERER',
        'PLANS_GERER',
        'REMISES_GERER',
        'COMMISSIONS_VOIR',
        'COMMISSIONS_GERER',
        'COMMISSION_PREMIUM',
        'PORTEFEUILLE_VOIR',
        'PORTEFEUILLE_GERER'
      ]::"Permission"[]
    )
  )
)
WHERE "isSystem" = true
  AND name = 'Administrateur';

-- 2. Gerant system roles — get all subscription permissions
--    (Gerant gets everything except SITE_GERER and MEMBRES_GERER, same policy)
UPDATE "SiteRole"
SET permissions = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      permissions || ARRAY[
        'CALIBRAGES_MODIFIER',
        'ABONNEMENTS_VOIR',
        'ABONNEMENTS_GERER',
        'PLANS_GERER',
        'REMISES_GERER',
        'COMMISSIONS_VOIR',
        'COMMISSIONS_GERER',
        'COMMISSION_PREMIUM',
        'PORTEFEUILLE_VOIR',
        'PORTEFEUILLE_GERER'
      ]::"Permission"[]
    )
  )
)
WHERE "isSystem" = true
  AND name = 'Gerant';
