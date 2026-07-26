-- Backfill: add permissions that were introduced without a matching backfill
-- migration, and are therefore missing from existing "SiteRole" rows even
-- though SYSTEM_ROLE_DEFINITIONS (src/lib/permissions-constants.ts) grants
-- them to Administrateur/Gerant for any NEW site created today.
--
-- "SiteRole.permissions" is a stored array snapshot taken at role-creation
-- time — it is NOT recomputed dynamically. Every time a new value is added
-- to the "Permission" enum via `ALTER TYPE ... ADD VALUE` without a backfill
-- in the same migration (or a jumelle migration), existing system roles
-- silently lose access to whatever that permission gates. This is the exact
-- same root cause already fixed once in
-- 20260401000000_backfill_subscription_permissions (Sprint 30).
--
-- Story SU.10: VENTES_MODIFIER was confirmed orphaned on every "SiteRole"
-- created before this migration — no non-ADMIN-global user could create or
-- sign a normal bon de livraison, nor edit a vente. The exhaustive scan of
-- the "Permission" enum against the seeded system roles also turned up two
-- other omissions of the same family (each missing its own backfill at the
-- time its enum value was added):
--   - PAIEMENTS_SUPPRIMER   (never had a backfill migration)
--   - DEPENSES_VENTE_RETRO  (added by 20260527170352_add_permission_depenses_vente_retro, no backfill)
--   - BESOINS_MODIFIER_RETRO (added by 20260530100417_add_permission_besoins_modifier_retro, no backfill)
--
-- NOT included here (intentionally):
--   - BONS_LIVRAISON_RECTIFIER : pending user arbitrage (should Gerant be able
--     to rectify a signed bon de livraison?) — story SU.8. Do not add until
--     that decision is made.
--   - SITE_GERER / MEMBRES_GERER : excluded from Gerant by design (role
--     definition, not an omission).
--   - SITES_VOIR / SITES_GERER / ANALYTICS_PLATEFORME (ADR-021, admin
--     plateforme) : reserved for the global Role.ADMIN bypass in
--     getServerPermissions(), never meant to be granted through a SiteRole.
--
-- Scope: only "isSystem" = true roles named 'Administrateur' or 'Gerant',
-- exactly like the Sprint 30 precedent. Custom roles and 'Pisciculteur' are
-- untouched (Pisciculteur never had ventes/paiements/depenses-retro perms by
-- design — read-only field role).
--
-- Safe to run multiple times: array_cat + DISTINCT/unnest avoids duplicates.

-- 1. Administrateur system roles
UPDATE "SiteRole"
SET permissions = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      permissions || ARRAY[
        'VENTES_MODIFIER',
        'PAIEMENTS_SUPPRIMER',
        'DEPENSES_VENTE_RETRO',
        'BESOINS_MODIFIER_RETRO'
      ]::"Permission"[]
    )
  )
)
WHERE "isSystem" = true
  AND name = 'Administrateur';

-- 2. Gerant system roles (same set — Gerant gets everything except
--    SITE_GERER/MEMBRES_GERER, same policy as the Sprint 30 precedent)
UPDATE "SiteRole"
SET permissions = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      permissions || ARRAY[
        'VENTES_MODIFIER',
        'PAIEMENTS_SUPPRIMER',
        'DEPENSES_VENTE_RETRO',
        'BESOINS_MODIFIER_RETRO'
      ]::"Permission"[]
    )
  )
)
WHERE "isSystem" = true
  AND name = 'Gerant';
