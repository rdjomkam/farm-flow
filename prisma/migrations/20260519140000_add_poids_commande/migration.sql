-- Add poidsCommandeKg and quantiteCommandee to Vente
ALTER TABLE "Vente" ADD COLUMN "poidsCommandeKg" DOUBLE PRECISION;
ALTER TABLE "Vente" ADD COLUMN "quantiteCommandee" INTEGER;

-- For already-delivered ventes, backfill poidsCommandeKg from poidsTotalKg
-- and overwrite poidsTotalKg/quantitePoissons with delivered values
UPDATE "Vente"
SET "poidsCommandeKg" = "poidsTotalKg",
    "quantiteCommandee" = "quantitePoissons",
    "poidsTotalKg" = "poidsLivreKg",
    "quantitePoissons" = "quantiteLivree"
WHERE "statut" IN ('LIVREE', 'CLOTUREE')
  AND "poidsLivreKg" IS NOT NULL;
