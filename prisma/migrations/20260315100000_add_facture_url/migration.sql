-- Add factureUrl to Commande for Sprint 15 (Upload Facture sur Commande)
-- This column is nullable: existing commandes without factureUrl continue to work

ALTER TABLE "Commande" ADD COLUMN "factureUrl" TEXT;
