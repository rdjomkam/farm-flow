-- Migration: add_unite_production
-- Adds TypeUniteProduction enum, UniteProduction model, TransfertInterne model
-- and nullable FK columns on Vague, Depense, DepenseRecurrente.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. New enum
-- ────────────────────────────────────────────────────────────────────────────

CREATE TYPE "TypeUniteProduction" AS ENUM ('REPRODUCTION', 'GROSSISSEMENT');

-- ────────────────────────────────────────────────────────────────────────────
-- 2. UniteProduction table
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE "UniteProduction" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "nom"         TEXT NOT NULL,
    "type"        "TypeUniteProduction" NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "siteId"      TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniteProduction_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one code per site
ALTER TABLE "UniteProduction"
    ADD CONSTRAINT "UniteProduction_siteId_code_key" UNIQUE ("siteId", "code");

-- Indexes
CREATE INDEX "UniteProduction_siteId_idx" ON "UniteProduction"("siteId");
CREATE INDEX "UniteProduction_siteId_type_idx" ON "UniteProduction"("siteId", "type");

-- FK to Site
ALTER TABLE "UniteProduction"
    ADD CONSTRAINT "UniteProduction_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. TransfertInterne table
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE "TransfertInterne" (
    "id"                 TEXT NOT NULL,
    "code"               TEXT NOT NULL,
    "date"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uniteSourceId"      TEXT NOT NULL,
    "uniteDestinationId" TEXT NOT NULL,
    "lotAlevinsId"       TEXT,
    "vagueDestinationId" TEXT,
    "nombrePoissons"     INTEGER NOT NULL,
    "poidsMoyenG"        DOUBLE PRECISION,
    "prixUnitaire"       DOUBLE PRECISION NOT NULL,
    "prixBase"           TEXT NOT NULL DEFAULT 'PAR_POISSON',
    "montantTotal"       DOUBLE PRECISION NOT NULL,
    "description"        TEXT,
    "siteId"             TEXT NOT NULL,
    "userId"             TEXT NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransfertInterne_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on code
ALTER TABLE "TransfertInterne"
    ADD CONSTRAINT "TransfertInterne_code_key" UNIQUE ("code");

-- Indexes
CREATE INDEX "TransfertInterne_siteId_idx" ON "TransfertInterne"("siteId");
CREATE INDEX "TransfertInterne_uniteSourceId_idx" ON "TransfertInterne"("uniteSourceId");
CREATE INDEX "TransfertInterne_uniteDestinationId_idx" ON "TransfertInterne"("uniteDestinationId");
CREATE INDEX "TransfertInterne_lotAlevinsId_idx" ON "TransfertInterne"("lotAlevinsId");

-- FKs
ALTER TABLE "TransfertInterne"
    ADD CONSTRAINT "TransfertInterne_uniteSourceId_fkey"
    FOREIGN KEY ("uniteSourceId") REFERENCES "UniteProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransfertInterne"
    ADD CONSTRAINT "TransfertInterne_uniteDestinationId_fkey"
    FOREIGN KEY ("uniteDestinationId") REFERENCES "UniteProduction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransfertInterne"
    ADD CONSTRAINT "TransfertInterne_lotAlevinsId_fkey"
    FOREIGN KEY ("lotAlevinsId") REFERENCES "LotAlevins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransfertInterne"
    ADD CONSTRAINT "TransfertInterne_vagueDestinationId_fkey"
    FOREIGN KEY ("vagueDestinationId") REFERENCES "Vague"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransfertInterne"
    ADD CONSTRAINT "TransfertInterne_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransfertInterne"
    ADD CONSTRAINT "TransfertInterne_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ALTER Vague — add uniteProductionId
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Vague" ADD COLUMN "uniteProductionId" TEXT;

CREATE INDEX "Vague_uniteProductionId_idx" ON "Vague"("uniteProductionId");

ALTER TABLE "Vague"
    ADD CONSTRAINT "Vague_uniteProductionId_fkey"
    FOREIGN KEY ("uniteProductionId") REFERENCES "UniteProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. ALTER Depense — add uniteProductionId
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Depense" ADD COLUMN "uniteProductionId" TEXT;

CREATE INDEX "Depense_uniteProductionId_idx" ON "Depense"("uniteProductionId");

ALTER TABLE "Depense"
    ADD CONSTRAINT "Depense_uniteProductionId_fkey"
    FOREIGN KEY ("uniteProductionId") REFERENCES "UniteProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. ALTER DepenseRecurrente — add uniteProductionId
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE "DepenseRecurrente" ADD COLUMN "uniteProductionId" TEXT;

CREATE INDEX "DepenseRecurrente_uniteProductionId_idx" ON "DepenseRecurrente"("uniteProductionId");

ALTER TABLE "DepenseRecurrente"
    ADD CONSTRAINT "DepenseRecurrente_uniteProductionId_fkey"
    FOREIGN KEY ("uniteProductionId") REFERENCES "UniteProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Backfill — auto-create production units for existing sites
-- ────────────────────────────────────────────────────────────────────────────

-- Create a GROSSISSEMENT unit for every site that has at least one vague
INSERT INTO "UniteProduction" ("id", "code", "nom", "type", "siteId", "createdAt", "updatedAt")
SELECT
  'up_gross_' || s."id",
  'GROSS-01',
  'Grossissement',
  'GROSSISSEMENT'::"TypeUniteProduction",
  s."id",
  NOW(),
  NOW()
FROM "Site" s
WHERE EXISTS (SELECT 1 FROM "Vague" v WHERE v."siteId" = s."id");

-- Create a REPRODUCTION unit for every site that has the REPRODUCTION module enabled
INSERT INTO "UniteProduction" ("id", "code", "nom", "type", "siteId", "createdAt", "updatedAt")
SELECT
  'up_repro_' || s."id",
  'REPRO-01',
  'Reproduction',
  'REPRODUCTION'::"TypeUniteProduction",
  s."id",
  NOW(),
  NOW()
FROM "Site" s
WHERE 'REPRODUCTION' = ANY(s."enabledModules"::"SiteModule"[]);

-- Assign all existing vagues to the GROSSISSEMENT unit of their site
UPDATE "Vague" v
SET "uniteProductionId" = up."id"
FROM "UniteProduction" up
WHERE up."siteId" = v."siteId"
  AND up."type" = 'GROSSISSEMENT';

-- Assign depenses that are linked to a vague to the same unit as their vague
UPDATE "Depense" d
SET "uniteProductionId" = v."uniteProductionId"
FROM "Vague" v
WHERE d."vagueId" = v."id"
  AND v."uniteProductionId" IS NOT NULL;
