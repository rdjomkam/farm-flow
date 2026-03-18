-- Migration: add_calibrage
-- Sprint 24 — Calibrage feature
-- Adds CategorieCalibrage enum, Calibrage and CalibrageGroupe models,
-- new fields on Bac, and two Permission values.

-- 1. New enum
CREATE TYPE "CategorieCalibrage" AS ENUM ('PETIT', 'MOYEN', 'GROS', 'TRES_GROS');

-- 2. New columns on Bac
ALTER TABLE "Bac"
  ADD COLUMN "nombreInitial"     INTEGER,
  ADD COLUMN "poidsMoyenInitial" DOUBLE PRECISION;

-- 3. Calibrage table
CREATE TABLE "Calibrage" (
  "id"           TEXT        NOT NULL,
  "date"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vagueId"      TEXT        NOT NULL,
  "sourceBacIds" TEXT[]      NOT NULL DEFAULT '{}',
  "nombreMorts"  INTEGER     NOT NULL DEFAULT 0,
  "notes"        TEXT,
  "siteId"       TEXT        NOT NULL,
  "userId"       TEXT        NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Calibrage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Calibrage_vagueId_fkey"  FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Calibrage_siteId_fkey"   FOREIGN KEY ("siteId")  REFERENCES "Site"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Calibrage_userId_fkey"   FOREIGN KEY ("userId")  REFERENCES "User"("id")  ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Calibrage_vagueId_idx" ON "Calibrage"("vagueId");
CREATE INDEX "Calibrage_siteId_idx"  ON "Calibrage"("siteId");

-- 4. CalibrageGroupe table
CREATE TABLE "CalibrageGroupe" (
  "id"               TEXT        NOT NULL,
  "calibrageId"      TEXT        NOT NULL,
  "categorie"        "CategorieCalibrage" NOT NULL,
  "destinationBacId" TEXT        NOT NULL,
  "nombrePoissons"   INTEGER     NOT NULL,
  "poidsMoyen"       DOUBLE PRECISION NOT NULL,
  "tailleMoyenne"    DOUBLE PRECISION,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalibrageGroupe_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalibrageGroupe_calibrageId_fkey"      FOREIGN KEY ("calibrageId")      REFERENCES "Calibrage"("id") ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT "CalibrageGroupe_destinationBacId_fkey" FOREIGN KEY ("destinationBacId") REFERENCES "Bac"("id")       ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CalibrageGroupe_calibrageId_idx" ON "CalibrageGroupe"("calibrageId");

-- 5. New Permission values
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL < 12.
-- Prisma migrate deploy runs each migration outside a transaction when it detects ADD VALUE.
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'CALIBRAGES_VOIR';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'CALIBRAGES_CREER';
