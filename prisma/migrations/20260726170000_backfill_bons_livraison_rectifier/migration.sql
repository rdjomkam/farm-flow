-- Backfill: BONS_LIVRAISON_RECTIFIER was introduced by
-- 20260726100000_add_bon_livraison_rectificatif (ALTER TYPE ... ADD VALUE)
-- WITHOUT a matching backfill migration. "SiteRole.permissions" is a stored
-- array snapshot taken at role-creation time — it is NOT recomputed
-- dynamically. Every "SiteRole" created before this migration is missing
-- this permission, even though SYSTEM_ROLE_DEFINITIONS
-- (src/lib/permissions-constants.ts) already grants it to any NEW
-- Administrateur site role created today. This is the exact same root cause
-- already fixed twice in this project: 20260401000000_backfill_subscription_permissions
-- (Sprint 30) and 20260726160000_backfill_ventes_modifier_permissions (SU.10).
--
-- Arbitrage utilisateur (story SU.8) : rectifier un bon de livraison signe
-- engage une correction de stock et de montants deja actes. La decision est
-- d'accorder cette permission PAR DEFAUT au role systeme "Administrateur"
-- uniquement, PAS au "Gerant" (contrairement au precedent
-- 20260726160000_backfill_ventes_modifier_permissions qui backfille les deux
-- roles a l'identique). Rien n'empeche un Administrateur de site d'accorder
-- ensuite cette permission a un Gerant via l'UI de gestion des roles
-- (`SiteRole.permissions` reste un tableau modifiable normalement) — seule la
-- valeur PAR DEFAUT a la creation/backfill est restreinte a l'Administrateur.
--
-- Scope: only "isSystem" = true roles named exactly 'Administrateur',
-- matching the naming convention validated by the Sprint 30 precedent.
-- Custom roles, 'Pisciculteur' and 'Gerant' are untouched by design.
--
-- Safe to run multiple times: array_cat + DISTINCT/unnest avoids duplicates.

UPDATE "SiteRole"
SET permissions = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      permissions || ARRAY['BONS_LIVRAISON_RECTIFIER']::"Permission"[]
    )
  )
)
WHERE "isSystem" = true
  AND name = 'Administrateur';
