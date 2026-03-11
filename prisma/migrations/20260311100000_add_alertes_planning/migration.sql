-- Migration: add_alertes_planning
-- Sprint 11 — Alertes & Planning
--
-- 1. ADD new Permission enum value (ALERTES_CONFIGURER)
-- 2. CREATE enums TypeAlerte, StatutAlerte, TypeActivite, StatutActivite, Recurrence
-- 3. CREATE TABLE ConfigAlerte
-- 4. CREATE TABLE Notification
-- 5. CREATE TABLE Activite
-- 6. CREATE indexes + FK constraints

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Add new Permission enum value
-- Note: ADD VALUE is safe here (no RECREATE needed for a simple addition)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TYPE "Permission" ADD VALUE 'ALERTES_CONFIGURER';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. CREATE enums
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TYPE "TypeAlerte" AS ENUM (
  'MORTALITE_ELEVEE',
  'QUALITE_EAU',
  'STOCK_BAS',
  'RAPPEL_ALIMENTATION',
  'RAPPEL_BIOMETRIE',
  'PERSONNALISEE'
);

CREATE TYPE "StatutAlerte" AS ENUM (
  'ACTIVE',
  'LUE',
  'TRAITEE'
);

CREATE TYPE "TypeActivite" AS ENUM (
  'ALIMENTATION',
  'BIOMETRIE',
  'QUALITE_EAU',
  'COMPTAGE',
  'NETTOYAGE',
  'TRAITEMENT',
  'RECOLTE',
  'AUTRE'
);

CREATE TYPE "StatutActivite" AS ENUM (
  'PLANIFIEE',
  'TERMINEE',
  'ANNULEE',
  'EN_RETARD'
);

CREATE TYPE "Recurrence" AS ENUM (
  'QUOTIDIEN',
  'HEBDOMADAIRE',
  'BIMENSUEL',
  'MENSUEL',
  'PERSONNALISE'
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. CREATE TABLE "ConfigAlerte"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "ConfigAlerte" (
    "id"               TEXT NOT NULL,
    "typeAlerte"       "TypeAlerte" NOT NULL,
    "seuilValeur"      DOUBLE PRECISION,
    "seuilPourcentage" DOUBLE PRECISION,
    "enabled"          BOOLEAN NOT NULL DEFAULT true,
    "userId"           TEXT NOT NULL,
    "siteId"           TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigAlerte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfigAlerte_userId_siteId_typeAlerte_key"
    ON "ConfigAlerte"("userId", "siteId", "typeAlerte");

CREATE INDEX "ConfigAlerte_siteId_idx" ON "ConfigAlerte"("siteId");

ALTER TABLE "ConfigAlerte" ADD CONSTRAINT "ConfigAlerte_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "ConfigAlerte" ADD CONSTRAINT "ConfigAlerte_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. CREATE TABLE "Notification"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Notification" (
    "id"         TEXT NOT NULL,
    "typeAlerte" "TypeAlerte" NOT NULL,
    "titre"      TEXT NOT NULL,
    "message"    TEXT NOT NULL,
    "statut"     "StatutAlerte" NOT NULL DEFAULT 'ACTIVE',
    "lien"       TEXT,
    "userId"     TEXT NOT NULL,
    "siteId"     TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_siteId_statut_idx"
    ON "Notification"("userId", "siteId", "statut");

CREATE INDEX "Notification_siteId_idx" ON "Notification"("siteId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. CREATE TABLE "Activite"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Activite" (
    "id"           TEXT NOT NULL,
    "titre"        TEXT NOT NULL,
    "description"  TEXT,
    "typeActivite" "TypeActivite" NOT NULL,
    "statut"       "StatutActivite" NOT NULL DEFAULT 'PLANIFIEE',
    "dateDebut"    TIMESTAMP(3) NOT NULL,
    "dateFin"      TIMESTAMP(3),
    "recurrence"   "Recurrence",
    "vagueId"      TEXT,
    "bacId"        TEXT,
    "assigneAId"   TEXT,
    "userId"       TEXT NOT NULL,
    "siteId"       TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Activite_siteId_dateDebut_idx" ON "Activite"("siteId", "dateDebut");
CREATE INDEX "Activite_siteId_statut_idx"    ON "Activite"("siteId", "statut");
CREATE INDEX "Activite_assigneAId_idx"       ON "Activite"("assigneAId");

ALTER TABLE "Activite" ADD CONSTRAINT "Activite_vagueId_fkey"
    FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "Activite" ADD CONSTRAINT "Activite_bacId_fkey"
    FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "Activite" ADD CONSTRAINT "Activite_assigneAId_fkey"
    FOREIGN KEY ("assigneAId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "Activite" ADD CONSTRAINT "Activite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Activite" ADD CONSTRAINT "Activite_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE CASCADE;
