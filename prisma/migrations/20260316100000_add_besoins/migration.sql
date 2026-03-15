-- Migration Sprint 17 — Besoins + Workflow
-- Adds: StatutBesoins enum, ListeBesoins model, LigneBesoin model
-- Modifies: Depense (listeBesoinsId FK), SiteRole (permissions DROP DEFAULT)

-- CreateEnum
CREATE TYPE "StatutBesoins" AS ENUM ('SOUMISE', 'APPROUVEE', 'TRAITEE', 'CLOTUREE', 'REJETEE');

-- AlterTable: add listeBesoinsId nullable on Depense
ALTER TABLE "Depense" ADD COLUMN "listeBesoinsId" TEXT;

-- AlterTable: SiteRole permissions (drop default to be consistent with schema)
ALTER TABLE "SiteRole" ALTER COLUMN "permissions" DROP DEFAULT;

-- CreateTable: ListeBesoins
CREATE TABLE "ListeBesoins" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "valideurId" TEXT,
    "vagueId" TEXT,
    "statut" "StatutBesoins" NOT NULL DEFAULT 'SOUMISE',
    "montantEstime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantReel" DOUBLE PRECISION,
    "motifRejet" TEXT,
    "notes" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeBesoins_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LigneBesoin
CREATE TABLE "LigneBesoin" (
    "id" TEXT NOT NULL,
    "listeBesoinsId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "produitId" TEXT,
    "quantite" DOUBLE PRECISION NOT NULL,
    "unite" TEXT,
    "prixEstime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prixReel" DOUBLE PRECISION,
    "commandeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LigneBesoin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListeBesoins_numero_key" ON "ListeBesoins"("numero");

CREATE INDEX "ListeBesoins_siteId_idx" ON "ListeBesoins"("siteId");
CREATE INDEX "ListeBesoins_siteId_statut_idx" ON "ListeBesoins"("siteId", "statut");
CREATE INDEX "ListeBesoins_demandeurId_idx" ON "ListeBesoins"("demandeurId");
CREATE INDEX "ListeBesoins_vagueId_idx" ON "ListeBesoins"("vagueId");

CREATE INDEX "LigneBesoin_listeBesoinsId_idx" ON "LigneBesoin"("listeBesoinsId");
CREATE INDEX "LigneBesoin_produitId_idx" ON "LigneBesoin"("produitId");
CREATE INDEX "LigneBesoin_commandeId_idx" ON "LigneBesoin"("commandeId");

CREATE INDEX "Depense_listeBesoinsId_idx" ON "Depense"("listeBesoinsId");

-- AddForeignKey: Depense → ListeBesoins (SET NULL)
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_listeBesoinsId_fkey"
    FOREIGN KEY ("listeBesoinsId") REFERENCES "ListeBesoins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ListeBesoins relations
ALTER TABLE "ListeBesoins" ADD CONSTRAINT "ListeBesoins_demandeurId_fkey"
    FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ListeBesoins" ADD CONSTRAINT "ListeBesoins_valideurId_fkey"
    FOREIGN KEY ("valideurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ListeBesoins" ADD CONSTRAINT "ListeBesoins_vagueId_fkey"
    FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ListeBesoins" ADD CONSTRAINT "ListeBesoins_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: LigneBesoin relations
ALTER TABLE "LigneBesoin" ADD CONSTRAINT "LigneBesoin_listeBesoinsId_fkey"
    FOREIGN KEY ("listeBesoinsId") REFERENCES "ListeBesoins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LigneBesoin" ADD CONSTRAINT "LigneBesoin_produitId_fkey"
    FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LigneBesoin" ADD CONSTRAINT "LigneBesoin_commandeId_fkey"
    FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE SET NULL ON UPDATE CASCADE;
