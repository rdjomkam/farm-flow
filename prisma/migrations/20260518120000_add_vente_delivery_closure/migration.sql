-- CreateEnum
CREATE TYPE "StatutVente" AS ENUM ('EN_PREPARATION', 'LIVREE');

-- AlterTable: add nullable columns first
ALTER TABLE "Vente" ADD COLUMN "dateCommande" TIMESTAMP(3),
                     ADD COLUMN "statut" "StatutVente" NOT NULL DEFAULT 'EN_PREPARATION',
                     ADD COLUMN "dateLivraison" TIMESTAMP(3),
                     ADD COLUMN "poidsLivreKg" DOUBLE PRECISION,
                     ADD COLUMN "quantiteLivree" INTEGER;

-- Backfill dateCommande from createdAt for existing rows
UPDATE "Vente" SET "dateCommande" = "createdAt" WHERE "dateCommande" IS NULL;

-- Make dateCommande non-nullable with default
ALTER TABLE "Vente" ALTER COLUMN "dateCommande" SET NOT NULL,
                     ALTER COLUMN "dateCommande" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Vente_statut_idx" ON "Vente"("statut");
