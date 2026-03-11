-- Migration: add_ventes
-- Sprint 9 — Ventes & Facturation
--
-- 1. ADD new Permission enum values (CLIENTS_VOIR, CLIENTS_GERER, PAIEMENTS_CREER)
-- 2. CREATE enums StatutFacture, ModePaiement
-- 3. CREATE tables Client, Vente, Facture, Paiement
-- 4. CREATE indexes + FK constraints

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Add new Permission enum values
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TYPE "Permission" ADD VALUE 'CLIENTS_VOIR';
ALTER TYPE "Permission" ADD VALUE 'CLIENTS_GERER';
ALTER TYPE "Permission" ADD VALUE 'PAIEMENTS_CREER';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. CREATE enums
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TYPE "StatutFacture" AS ENUM ('BROUILLON', 'ENVOYEE', 'PAYEE_PARTIELLEMENT', 'PAYEE', 'ANNULEE');
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'CHEQUE');

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. CREATE TABLE "Client"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Client" (
    "id"        TEXT NOT NULL,
    "nom"       TEXT NOT NULL,
    "telephone" TEXT,
    "email"     TEXT,
    "adresse"   TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "siteId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Client_siteId_idx" ON "Client"("siteId");

ALTER TABLE "Client" ADD CONSTRAINT "Client_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. CREATE TABLE "Vente"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Vente" (
    "id"               TEXT NOT NULL,
    "numero"           TEXT NOT NULL,
    "clientId"         TEXT NOT NULL,
    "vagueId"          TEXT NOT NULL,
    "quantitePoissons" INTEGER NOT NULL,
    "poidsTotalKg"     DOUBLE PRECISION NOT NULL,
    "prixUnitaireKg"   DOUBLE PRECISION NOT NULL,
    "montantTotal"     DOUBLE PRECISION NOT NULL,
    "notes"            TEXT,
    "siteId"           TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vente_numero_key" ON "Vente"("numero");
CREATE INDEX "Vente_siteId_idx" ON "Vente"("siteId");
CREATE INDEX "Vente_clientId_idx" ON "Vente"("clientId");
CREATE INDEX "Vente_vagueId_idx" ON "Vente"("vagueId");

ALTER TABLE "Vente" ADD CONSTRAINT "Vente_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Vente" ADD CONSTRAINT "Vente_vagueId_fkey"
    FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Vente" ADD CONSTRAINT "Vente_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Vente" ADD CONSTRAINT "Vente_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. CREATE TABLE "Facture"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Facture" (
    "id"           TEXT NOT NULL,
    "numero"       TEXT NOT NULL,
    "venteId"      TEXT NOT NULL,
    "statut"       "StatutFacture" NOT NULL DEFAULT 'BROUILLON',
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3),
    "montantTotal" DOUBLE PRECISION NOT NULL,
    "montantPaye"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes"        TEXT,
    "siteId"       TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Facture_numero_key" ON "Facture"("numero");
CREATE UNIQUE INDEX "Facture_venteId_key" ON "Facture"("venteId");
CREATE INDEX "Facture_siteId_idx" ON "Facture"("siteId");
CREATE INDEX "Facture_statut_idx" ON "Facture"("statut");

ALTER TABLE "Facture" ADD CONSTRAINT "Facture_venteId_fkey"
    FOREIGN KEY ("venteId") REFERENCES "Vente"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Facture" ADD CONSTRAINT "Facture_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Facture" ADD CONSTRAINT "Facture_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. CREATE TABLE "Paiement"
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Paiement" (
    "id"        TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "montant"   DOUBLE PRECISION NOT NULL,
    "mode"      "ModePaiement" NOT NULL,
    "reference" TEXT,
    "date"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteId"    TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Paiement_factureId_idx" ON "Paiement"("factureId");
CREATE INDEX "Paiement_siteId_idx" ON "Paiement"("siteId");

ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_factureId_fkey"
    FOREIGN KEY ("factureId") REFERENCES "Facture"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
