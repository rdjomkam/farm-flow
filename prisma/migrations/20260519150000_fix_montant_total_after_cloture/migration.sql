-- Fix montantTotal on delivered ventes where poidsTotalKg was overwritten
-- but montantTotal was not recalculated
UPDATE "Vente"
SET "montantTotal" = "poidsTotalKg" * "prixUnitaireKg"
WHERE "statut" IN ('LIVREE', 'CLOTUREE')
  AND "poidsLivreKg" IS NOT NULL
  AND "montantTotal" != "poidsTotalKg" * "prixUnitaireKg";

-- Also fix matching factures
UPDATE "Facture" f
SET "montantTotal" = v."poidsTotalKg" * v."prixUnitaireKg"
FROM "Vente" v
WHERE f."venteId" = v.id
  AND v."statut" IN ('LIVREE', 'CLOTUREE')
  AND v."poidsLivreKg" IS NOT NULL
  AND f."montantTotal" != v."poidsTotalKg" * v."prixUnitaireKg";
