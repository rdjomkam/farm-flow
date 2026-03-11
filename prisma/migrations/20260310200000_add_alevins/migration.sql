-- Migration: add_alevins
-- Sprint 10 — Production Alevins
--
-- 1. ADD new Permission enum values (ALEVINS_CREER, ALEVINS_MODIFIER, ALEVINS_SUPPRIMER)
-- 2. CREATE enums SexeReproducteur, StatutReproducteur, StatutPonte, StatutLotAlevins
-- 3. CREATE TABLE Reproducteur
-- 4. CREATE TABLE Ponte
-- 5. CREATE TABLE LotAlevins
-- 6. ADD COLUMN lotsAlevins FK on Bac
-- 7. ADD COLUMN lotsAlevinsTransferes FK on Vague (via vagueDestinationId on LotAlevins)
-- 8. CREATE indexes

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Add new Permission enum values
-- Note: ALEVINS_VOIR et ALEVINS_GERER existent déjà dans la DB.
--       On ajoute les 3 valeurs granulaires supplémentaires.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TYPE "Permission" ADD VALUE 'ALEVINS_CREER';
ALTER TYPE "Permission" ADD VALUE 'ALEVINS_MODIFIER';
ALTER TYPE "Permission" ADD VALUE 'ALEVINS_SUPPRIMER';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. CREATE enums
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TYPE "SexeReproducteur" AS ENUM ('MALE', 'FEMELLE');

CREATE TYPE "StatutReproducteur" AS ENUM ('ACTIF', 'REFORME', 'MORT');

CREATE TYPE "StatutPonte" AS ENUM ('EN_COURS', 'TERMINEE', 'ECHOUEE');

CREATE TYPE "StatutLotAlevins" AS ENUM ('EN_INCUBATION', 'EN_ELEVAGE', 'TRANSFERE', 'PERDU');

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. CREATE TABLE "Reproducteur"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Reproducteur" (
    "id"              TEXT NOT NULL,
    "code"            TEXT NOT NULL,
    "sexe"            "SexeReproducteur" NOT NULL,
    "poids"           DOUBLE PRECISION NOT NULL,
    "age"             INTEGER,
    "origine"         TEXT,
    "statut"          "StatutReproducteur" NOT NULL DEFAULT 'ACTIF',
    "dateAcquisition" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes"           TEXT,
    "siteId"          TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reproducteur_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Reproducteur_code_key" ON "Reproducteur"("code");
CREATE INDEX "Reproducteur_siteId_idx" ON "Reproducteur"("siteId");
CREATE INDEX "Reproducteur_siteId_statut_idx" ON "Reproducteur"("siteId", "statut");

ALTER TABLE "Reproducteur" ADD CONSTRAINT "Reproducteur_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. CREATE TABLE "Ponte"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Ponte" (
    "id"              TEXT NOT NULL,
    "code"            TEXT NOT NULL,
    "femelleId"       TEXT NOT NULL,
    "maleId"          TEXT,
    "datePonte"       TIMESTAMP(3) NOT NULL,
    "nombreOeufs"     INTEGER,
    "tauxFecondation" DOUBLE PRECISION,
    "statut"          "StatutPonte" NOT NULL DEFAULT 'EN_COURS',
    "notes"           TEXT,
    "siteId"          TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ponte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Ponte_code_key" ON "Ponte"("code");
CREATE INDEX "Ponte_siteId_idx" ON "Ponte"("siteId");
CREATE INDEX "Ponte_femelleId_idx" ON "Ponte"("femelleId");
CREATE INDEX "Ponte_siteId_statut_idx" ON "Ponte"("siteId", "statut");

ALTER TABLE "Ponte" ADD CONSTRAINT "Ponte_femelleId_fkey"
    FOREIGN KEY ("femelleId") REFERENCES "Reproducteur"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Ponte" ADD CONSTRAINT "Ponte_maleId_fkey"
    FOREIGN KEY ("maleId") REFERENCES "Reproducteur"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "Ponte" ADD CONSTRAINT "Ponte_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. CREATE TABLE "LotAlevins"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "LotAlevins" (
    "id"                 TEXT NOT NULL,
    "code"               TEXT NOT NULL,
    "ponteId"            TEXT NOT NULL,
    "nombreInitial"      INTEGER NOT NULL,
    "nombreActuel"       INTEGER NOT NULL,
    "ageJours"           INTEGER NOT NULL DEFAULT 0,
    "poidsMoyen"         DOUBLE PRECISION,
    "statut"             "StatutLotAlevins" NOT NULL DEFAULT 'EN_INCUBATION',
    "bacId"              TEXT,
    "vagueDestinationId" TEXT,
    "dateTransfert"      TIMESTAMP(3),
    "notes"              TEXT,
    "siteId"             TEXT NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotAlevins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LotAlevins_code_key" ON "LotAlevins"("code");
CREATE INDEX "LotAlevins_siteId_idx" ON "LotAlevins"("siteId");
CREATE INDEX "LotAlevins_ponteId_idx" ON "LotAlevins"("ponteId");
CREATE INDEX "LotAlevins_siteId_statut_idx" ON "LotAlevins"("siteId", "statut");

ALTER TABLE "LotAlevins" ADD CONSTRAINT "LotAlevins_ponteId_fkey"
    FOREIGN KEY ("ponteId") REFERENCES "Ponte"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "LotAlevins" ADD CONSTRAINT "LotAlevins_bacId_fkey"
    FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "LotAlevins" ADD CONSTRAINT "LotAlevins_vagueDestinationId_fkey"
    FOREIGN KEY ("vagueDestinationId") REFERENCES "Vague"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "LotAlevins" ADD CONSTRAINT "LotAlevins_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
