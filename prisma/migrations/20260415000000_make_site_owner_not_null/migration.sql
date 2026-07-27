-- Story 45.2 — Make Site.ownerId NOT NULL
-- First, backfill any NULLs from the Administrateur SiteRole
UPDATE "Site" SET "ownerId" = (
  SELECT sm."userId"
  FROM "SiteMember" sm
  JOIN "SiteRole" sr ON sm."siteRoleId" = sr.id
  WHERE sm."siteId" = "Site".id
    AND sr.name = 'Administrateur'
  ORDER BY sm."createdAt"
  LIMIT 1
) WHERE "ownerId" IS NULL;

-- Fallback: any remaining NULLs get the first SiteMember
UPDATE "Site" SET "ownerId" = (
  SELECT sm."userId"
  FROM "SiteMember" sm
  WHERE sm."siteId" = "Site".id
  ORDER BY sm."createdAt"
  LIMIT 1
) WHERE "ownerId" IS NULL;

-- Nettoyage : sur une base neuve, le site "default-site" (créé par le seed
-- de 20260309092300_add_multi_tenancy) peut n'avoir strictement aucun
-- membre, faute de "User" existant au moment de ce bootstrap sur une base
-- vierge. Un Site sans aucun membre est de toute façon inaccessible depuis
-- l'application (aucune autorisation possible) — il est supprimé plutôt que
-- de bloquer la contrainte NOT NULL. Idempotent et sans effet sur tout
-- environnement où au moins un membre existe déjà pour chaque site (le cas
-- de tout environnement réel). Voir docs/bugs/BUG-CI-migration-order.md.
DELETE FROM "Site"
WHERE "ownerId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "SiteMember" sm WHERE sm."siteId" = "Site".id);

-- Make NOT NULL
ALTER TABLE "Site" ALTER COLUMN "ownerId" SET NOT NULL;
