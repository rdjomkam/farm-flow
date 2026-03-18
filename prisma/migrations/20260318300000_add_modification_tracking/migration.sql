-- Migration: add_modification_tracking
-- Sprint 26 — Traçabilité des modifications de relevés et de calibrages (ADR-014 + ADR-015)
--
-- Cette migration regroupe :
--   1. Flag modifie sur Releve (ADR-014)
--   2. Nouveau modèle ReleveModification (ADR-014)
--   3. Flag modifie sur Calibrage (ADR-015)
--   4. Nouveau modèle CalibrageModification (ADR-015)
--   5. Ajout de CALIBRAGES_MODIFIER à l'enum Permission (ADR-015)
--      → Stratégie RECREATE (impossible d'ADD VALUE dans la même migration avec shadow DB)

-- =========================================================
-- Étape 1 : Flag modifie sur Releve (ADR-014)
-- =========================================================
ALTER TABLE "Releve" ADD COLUMN "modifie" BOOLEAN NOT NULL DEFAULT false;

-- =========================================================
-- Étape 2 : Nouveau modèle ReleveModification (ADR-014)
-- =========================================================
CREATE TABLE "ReleveModification" (
  "id"             TEXT NOT NULL,
  "releveId"       TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "raison"         TEXT NOT NULL,
  "champModifie"   TEXT NOT NULL,
  "ancienneValeur" TEXT,
  "nouvelleValeur" TEXT,
  "siteId"         TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReleveModification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReleveModification"
  ADD CONSTRAINT "ReleveModification_releveId_fkey"
    FOREIGN KEY ("releveId") REFERENCES "Releve"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ReleveModification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ReleveModification_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ReleveModification_releveId_idx" ON "ReleveModification"("releveId");
CREATE INDEX "ReleveModification_userId_idx"   ON "ReleveModification"("userId");
CREATE INDEX "ReleveModification_siteId_idx"   ON "ReleveModification"("siteId");

-- =========================================================
-- Étape 3 : Flag modifie sur Calibrage (ADR-015)
-- =========================================================
ALTER TABLE "Calibrage" ADD COLUMN "modifie" BOOLEAN NOT NULL DEFAULT false;

-- =========================================================
-- Étape 4 : Nouveau modèle CalibrageModification (ADR-015)
-- =========================================================
CREATE TABLE "CalibrageModification" (
  "id"             TEXT NOT NULL,
  "calibrageId"    TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "raison"         TEXT NOT NULL,
  "champModifie"   TEXT NOT NULL,
  "ancienneValeur" TEXT,
  "nouvelleValeur" TEXT,
  "siteId"         TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalibrageModification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CalibrageModification"
  ADD CONSTRAINT "CalibrageModification_calibrageId_fkey"
    FOREIGN KEY ("calibrageId") REFERENCES "Calibrage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CalibrageModification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CalibrageModification_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CalibrageModification_calibrageId_idx" ON "CalibrageModification"("calibrageId");
CREATE INDEX "CalibrageModification_userId_idx"      ON "CalibrageModification"("userId");
CREATE INDEX "CalibrageModification_siteId_idx"      ON "CalibrageModification"("siteId");

-- =========================================================
-- Étape 5 : Ajout de CALIBRAGES_MODIFIER à l'enum Permission
-- Stratégie RECREATE (R1 — MAJUSCULES, stratégie documentée dans MEMORY.md)
-- =========================================================

-- 5a. Renommer l'ancien type
ALTER TYPE "Permission" RENAME TO "Permission_old";

-- 5b. Créer le nouveau type avec toutes les valeurs + CALIBRAGES_MODIFIER
CREATE TYPE "Permission" AS ENUM (
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
  'CLIENTS_VOIR',
  'CLIENTS_GERER',
  'VENTES_VOIR',
  'VENTES_CREER',
  'FACTURES_VOIR',
  'FACTURES_GERER',
  'PAIEMENTS_CREER',
  'ALEVINS_VOIR',
  'ALEVINS_GERER',
  'ALEVINS_CREER',
  'ALEVINS_MODIFIER',
  'ALEVINS_SUPPRIMER',
  'PLANNING_VOIR',
  'PLANNING_GERER',
  'FINANCES_VOIR',
  'FINANCES_GERER',
  'DASHBOARD_VOIR',
  'ALERTES_VOIR',
  'EXPORT_DONNEES',
  'ALERTES_CONFIGURER',
  'DEPENSES_VOIR',
  'DEPENSES_CREER',
  'DEPENSES_PAYER',
  'BESOINS_SOUMETTRE',
  'BESOINS_APPROUVER',
  'BESOINS_TRAITER',
  'GERER_PACKS',
  'ACTIVER_PACKS',
  'GERER_CONFIG_ELEVAGE',
  'REGLES_ACTIVITES_VOIR',
  'GERER_REGLES_ACTIVITES',
  'MONITORING_CLIENTS',
  'ENVOYER_NOTES',
  'CALIBRAGES_VOIR',
  'CALIBRAGES_CREER',
  'CALIBRAGES_MODIFIER',
  'GERER_REGLES_GLOBALES'
);

-- 5c. Caster les colonnes qui utilisent Permission_old vers le nouveau type
ALTER TABLE "SiteRole"
  ALTER COLUMN "permissions" TYPE "Permission"[]
  USING "permissions"::text::"Permission"[];

-- SiteMember n'a plus de colonne permissions directe (depuis Sprint 7) —
-- les permissions transitent via SiteRole. Pas de cast nécessaire.

-- 5d. Supprimer l'ancien type
DROP TYPE "Permission_old";
