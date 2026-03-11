-- Migration: add_dynamic_roles
-- Task #54 — CR-009 : Modele SiteRole + migration donnees existantes SiteMember
--
-- Ordre :
-- 1. CREATE TABLE "SiteRole"
-- 2. CREATE UNIQUE INDEX + INDEX
-- 3. INSERT roles systeme pour chaque Site existant
-- 4. ADD COLUMN "siteRoleId" TEXT nullable sur SiteMember
-- 5. UPDATE SiteMember : mapper role -> siteRoleId
-- 6. ALTER siteRoleId SET NOT NULL
-- 7. ADD FK constraint
-- 8. DROP COLUMN role de SiteMember
-- 9. DROP COLUMN permissions de SiteMember
-- 10. CREATE INDEX siteRoleId

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. CREATE TABLE "SiteRole"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "SiteRole" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "permissions" "Permission"[] NOT NULL DEFAULT ARRAY[]::"Permission"[],
    "isSystem"    BOOLEAN NOT NULL DEFAULT false,
    "siteId"      TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteRole_pkey" PRIMARY KEY ("id")
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. INDEX
-- ──────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "SiteRole_siteId_name_key" ON "SiteRole"("siteId", "name");
CREATE INDEX "SiteRole_siteId_idx" ON "SiteRole"("siteId");

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. INSERT roles systeme pour chaque Site existant
--
-- Pour chaque site on insere 3 roles systeme :
--   - Administrateur : toutes les 27 permissions (BACS_MODIFIER et RELEVES_MODIFIER inclus)
--   - Gerant         : toutes sauf SITE_GERER et MEMBRES_GERER (25 permissions)
--   - Pisciculteur   : 6 permissions de base
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO "SiteRole" ("id", "name", "description", "permissions", "isSystem", "siteId", "createdAt", "updatedAt")
SELECT
    -- Administrateur
    'sr_admin_' || s.id,
    'Administrateur',
    'Acces complet au site — non supprimable',
    ARRAY[
        'SITE_GERER',
        'MEMBRES_GERER',
        'VAGUES_VOIR',
        'VAGUES_CREER',
        'VAGUES_MODIFIER',
        'BACS_GERER',
        'BACS_MODIFIER',
        'RELEVES_VOIR',
        'RELEVES_CREER',
        'RELEVES_MODIFIER',
        'STOCK_VOIR',
        'STOCK_GERER',
        'APPROVISIONNEMENT_VOIR',
        'APPROVISIONNEMENT_GERER',
        'VENTES_VOIR',
        'VENTES_CREER',
        'FACTURES_VOIR',
        'FACTURES_GERER',
        'ALEVINS_VOIR',
        'ALEVINS_GERER',
        'PLANNING_VOIR',
        'PLANNING_GERER',
        'FINANCES_VOIR',
        'FINANCES_GERER',
        'DASHBOARD_VOIR',
        'ALERTES_VOIR',
        'EXPORT_DONNEES'
    ]::"Permission"[],
    true,
    s.id,
    NOW(),
    NOW()
FROM "Site" s
UNION ALL
SELECT
    -- Gerant
    'sr_gerant_' || s.id,
    'Gerant',
    'Acces operationnel — sans gestion site ni membres — non supprimable',
    ARRAY[
        'VAGUES_VOIR',
        'VAGUES_CREER',
        'VAGUES_MODIFIER',
        'BACS_GERER',
        'BACS_MODIFIER',
        'RELEVES_VOIR',
        'RELEVES_CREER',
        'RELEVES_MODIFIER',
        'STOCK_VOIR',
        'STOCK_GERER',
        'APPROVISIONNEMENT_VOIR',
        'APPROVISIONNEMENT_GERER',
        'VENTES_VOIR',
        'VENTES_CREER',
        'FACTURES_VOIR',
        'FACTURES_GERER',
        'ALEVINS_VOIR',
        'ALEVINS_GERER',
        'PLANNING_VOIR',
        'PLANNING_GERER',
        'FINANCES_VOIR',
        'FINANCES_GERER',
        'DASHBOARD_VOIR',
        'ALERTES_VOIR',
        'EXPORT_DONNEES'
    ]::"Permission"[],
    true,
    s.id,
    NOW(),
    NOW()
FROM "Site" s
UNION ALL
SELECT
    -- Pisciculteur
    'sr_pisci_' || s.id,
    'Pisciculteur',
    'Acces terrain — lecture vagues, saisie releves — non supprimable',
    ARRAY[
        'VAGUES_VOIR',
        'RELEVES_VOIR',
        'RELEVES_CREER',
        'BACS_GERER',
        'DASHBOARD_VOIR',
        'ALERTES_VOIR'
    ]::"Permission"[],
    true,
    s.id,
    NOW(),
    NOW()
FROM "Site" s;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. ADD COLUMN siteRoleId nullable sur SiteMember
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "SiteMember" ADD COLUMN "siteRoleId" TEXT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. UPDATE SiteMember : mapper l'ancien role vers le nouveau siteRoleId
-- ──────────────────────────────────────────────────────────────────────────────

UPDATE "SiteMember" sm
SET "siteRoleId" = 'sr_admin_' || sm."siteId"
WHERE sm.role = 'ADMIN';

UPDATE "SiteMember" sm
SET "siteRoleId" = 'sr_gerant_' || sm."siteId"
WHERE sm.role = 'GERANT';

UPDATE "SiteMember" sm
SET "siteRoleId" = 'sr_pisci_' || sm."siteId"
WHERE sm.role = 'PISCICULTEUR';

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. ALTER siteRoleId SET NOT NULL (apres mise a jour des donnees)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "SiteMember" ALTER COLUMN "siteRoleId" SET NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. ADD FK constraint vers SiteRole
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "SiteRole" ADD CONSTRAINT "SiteRole_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "SiteMember" ADD CONSTRAINT "SiteMember_siteRoleId_fkey"
    FOREIGN KEY ("siteRoleId") REFERENCES "SiteRole"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. DROP COLUMN role de SiteMember
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "SiteMember" DROP COLUMN "role";

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. DROP COLUMN permissions de SiteMember
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE "SiteMember" DROP COLUMN "permissions";

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. CREATE INDEX siteRoleId sur SiteMember
-- ──────────────────────────────────────────────────────────────────────────────

CREATE INDEX "SiteMember_siteRoleId_idx" ON "SiteMember"("siteRoleId");
