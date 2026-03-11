-- Sprint 7 — Multi-tenancy : Site, SiteMember, siteId sur Bac/Vague/Releve
-- Migration multi-étapes pour préserver les données existantes

-- ══════════════════════════════════════════
-- Étape 1 : Créer les nouvelles tables
-- ══════════════════════════════════════════

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PISCICULTEUR',
    "permissions" "Permission"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteMember_pkey" PRIMARY KEY ("id")
);

-- ══════════════════════════════════════════
-- Étape 2 : Site par défaut + membres existants
-- ══════════════════════════════════════════

-- Insérer le site par défaut
INSERT INTO "Site" (id, name, "createdAt", "updatedAt")
VALUES ('default-site', 'Ferme principale', NOW(), NOW());

-- Inscrire tous les users existants comme membres ADMIN du site par défaut
-- avec toutes les 25 permissions
INSERT INTO "SiteMember" (id, "userId", "siteId", role, permissions, "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    id,
    'default-site',
    'ADMIN',
    ARRAY['SITE_GERER', 'MEMBRES_GERER', 'VAGUES_VOIR', 'VAGUES_CREER', 'VAGUES_MODIFIER', 'BACS_GERER', 'RELEVES_VOIR', 'RELEVES_CREER', 'STOCK_VOIR', 'STOCK_GERER', 'APPROVISIONNEMENT_VOIR', 'APPROVISIONNEMENT_GERER', 'VENTES_VOIR', 'VENTES_CREER', 'FACTURES_VOIR', 'FACTURES_GERER', 'ALEVINS_VOIR', 'ALEVINS_GERER', 'PLANNING_VOIR', 'PLANNING_GERER', 'FINANCES_VOIR', 'FINANCES_GERER', 'DASHBOARD_VOIR', 'ALERTES_VOIR', 'EXPORT_DONNEES']::"Permission"[],
    NOW(),
    NOW()
FROM "User";

-- ══════════════════════════════════════════
-- Étape 3 : Ajouter siteId (nullable) sur les modèles existants
-- ══════════════════════════════════════════

ALTER TABLE "Bac" ADD COLUMN "siteId" TEXT;
ALTER TABLE "Vague" ADD COLUMN "siteId" TEXT;
ALTER TABLE "Releve" ADD COLUMN "siteId" TEXT;

-- ══════════════════════════════════════════
-- Étape 4 : Migrer les données existantes vers le site par défaut
-- ══════════════════════════════════════════

UPDATE "Bac" SET "siteId" = 'default-site' WHERE "siteId" IS NULL;
UPDATE "Vague" SET "siteId" = 'default-site' WHERE "siteId" IS NULL;
UPDATE "Releve" SET "siteId" = 'default-site' WHERE "siteId" IS NULL;

-- ══════════════════════════════════════════
-- Étape 5 : Rendre siteId NOT NULL
-- ══════════════════════════════════════════

ALTER TABLE "Bac" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "Vague" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "Releve" ALTER COLUMN "siteId" SET NOT NULL;

-- ══════════════════════════════════════════
-- Étape 6 : Ajouter activeSiteId sur Session
-- ══════════════════════════════════════════

ALTER TABLE "Session" ADD COLUMN "activeSiteId" TEXT;

-- ══════════════════════════════════════════
-- Étape 7 : Index et contraintes
-- ══════════════════════════════════════════

-- SiteMember indexes
CREATE INDEX "SiteMember_userId_idx" ON "SiteMember"("userId");
CREATE INDEX "SiteMember_siteId_idx" ON "SiteMember"("siteId");
CREATE UNIQUE INDEX "SiteMember_userId_siteId_key" ON "SiteMember"("userId", "siteId");

-- siteId indexes (R8 performance)
CREATE INDEX "Bac_siteId_idx" ON "Bac"("siteId");
CREATE INDEX "Vague_siteId_idx" ON "Vague"("siteId");
CREATE INDEX "Releve_siteId_idx" ON "Releve"("siteId");
CREATE INDEX "Session_activeSiteId_idx" ON "Session"("activeSiteId");

-- Foreign keys
ALTER TABLE "SiteMember" ADD CONSTRAINT "SiteMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteMember" ADD CONSTRAINT "SiteMember_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeSiteId_fkey" FOREIGN KEY ("activeSiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bac" ADD CONSTRAINT "Bac_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vague" ADD CONSTRAINT "Vague_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
