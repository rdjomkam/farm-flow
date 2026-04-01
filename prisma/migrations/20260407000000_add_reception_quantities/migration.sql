-- Ajouter quantiteRecue sur LigneCommande
ALTER TABLE "LigneCommande" ADD COLUMN "quantiteRecue" DOUBLE PRECISION;

-- Ajouter montantRecu sur Commande
ALTER TABLE "Commande" ADD COLUMN "montantRecu" DOUBLE PRECISION;
