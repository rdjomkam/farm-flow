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

-- Make NOT NULL
ALTER TABLE "Site" ALTER COLUMN "ownerId" SET NOT NULL;
