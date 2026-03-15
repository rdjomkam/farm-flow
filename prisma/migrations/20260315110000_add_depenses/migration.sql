-- Sprint 16 — Dépenses base
-- Adds CategorieDepense, StatutDepense, FrequenceRecurrence enums
-- Adds 6 new Permission values (requires RECREATE approach for PostgreSQL)
-- Adds Depense and PaiementDepense models

-- ──────────────────────────────────────────
-- Step 1: Add new enum types
-- ──────────────────────────────────────────

CREATE TYPE "CategorieDepense" AS ENUM (
  'ALIMENT',
  'INTRANT',
  'EQUIPEMENT',
  'ELECTRICITE',
  'EAU',
  'LOYER',
  'SALAIRE',
  'TRANSPORT',
  'VETERINAIRE',
  'REPARATION',
  'INVESTISSEMENT',
  'AUTRE'
);

CREATE TYPE "StatutDepense" AS ENUM (
  'NON_PAYEE',
  'PAYEE_PARTIELLEMENT',
  'PAYEE'
);

CREATE TYPE "FrequenceRecurrence" AS ENUM (
  'MENSUEL',
  'TRIMESTRIEL',
  'ANNUEL'
);

-- ──────────────────────────────────────────
-- Step 2: Extend Permission enum (RECREATE approach — PostgreSQL cannot ADD VALUE in same tx)
-- ──────────────────────────────────────────

-- Rename old enum
ALTER TYPE "Permission" RENAME TO "Permission_old";

-- Create new enum with all values
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
  'BESOINS_TRAITER'
);

-- Cast columns using the new enum (SiteRole.permissions is Permission[])
-- Must drop default first (it references the old type), then cast, then restore default
ALTER TABLE "SiteRole" ALTER COLUMN "permissions" DROP DEFAULT;
ALTER TABLE "SiteRole"
  ALTER COLUMN "permissions" TYPE "Permission"[]
  USING "permissions"::text::"Permission"[];
ALTER TABLE "SiteRole" ALTER COLUMN "permissions" SET DEFAULT ARRAY[]::"Permission"[];

-- Drop old enum
DROP TYPE "Permission_old";

-- ──────────────────────────────────────────
-- Step 3: Create Depense table
-- ──────────────────────────────────────────

CREATE TABLE "Depense" (
  "id"               TEXT NOT NULL,
  "numero"           TEXT NOT NULL,
  "description"      TEXT NOT NULL,
  "categorieDepense" "CategorieDepense" NOT NULL,
  "montantTotal"     DOUBLE PRECISION NOT NULL,
  "montantPaye"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "statut"           "StatutDepense" NOT NULL DEFAULT 'NON_PAYEE',
  "date"             TIMESTAMP(3) NOT NULL,
  "dateEcheance"     TIMESTAMP(3),
  "factureUrl"       TEXT,
  "notes"            TEXT,
  "commandeId"       TEXT,
  "vagueId"          TEXT,
  "userId"           TEXT NOT NULL,
  "siteId"           TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Depense_pkey" PRIMARY KEY ("id")
);

-- Indexes on Depense
CREATE UNIQUE INDEX "Depense_numero_key" ON "Depense"("numero");
CREATE INDEX "Depense_siteId_idx" ON "Depense"("siteId");
CREATE INDEX "Depense_siteId_categorieDepense_idx" ON "Depense"("siteId", "categorieDepense");
CREATE INDEX "Depense_siteId_statut_idx" ON "Depense"("siteId", "statut");
CREATE INDEX "Depense_commandeId_idx" ON "Depense"("commandeId");
CREATE INDEX "Depense_vagueId_idx" ON "Depense"("vagueId");
CREATE INDEX "Depense_date_idx" ON "Depense"("date");

-- Foreign keys on Depense
ALTER TABLE "Depense"
  ADD CONSTRAINT "Depense_commandeId_fkey"
  FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Depense"
  ADD CONSTRAINT "Depense_vagueId_fkey"
  FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Depense"
  ADD CONSTRAINT "Depense_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Depense"
  ADD CONSTRAINT "Depense_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────────────────────────────────
-- Step 4: Create PaiementDepense table
-- ──────────────────────────────────────────

CREATE TABLE "PaiementDepense" (
  "id"        TEXT NOT NULL,
  "depenseId" TEXT NOT NULL,
  "montant"   DOUBLE PRECISION NOT NULL,
  "mode"      "ModePaiement" NOT NULL,
  "reference" TEXT,
  "date"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"    TEXT NOT NULL,
  "siteId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaiementDepense_pkey" PRIMARY KEY ("id")
);

-- Indexes on PaiementDepense
CREATE INDEX "PaiementDepense_depenseId_idx" ON "PaiementDepense"("depenseId");
CREATE INDEX "PaiementDepense_siteId_idx" ON "PaiementDepense"("siteId");

-- Foreign keys on PaiementDepense
ALTER TABLE "PaiementDepense"
  ADD CONSTRAINT "PaiementDepense_depenseId_fkey"
  FOREIGN KEY ("depenseId") REFERENCES "Depense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaiementDepense"
  ADD CONSTRAINT "PaiementDepense_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaiementDepense"
  ADD CONSTRAINT "PaiementDepense_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
