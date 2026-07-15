-- Sprint AV.1 — Ajoute LigneVente.poidsLivreKg pour granularite par ligne
-- lors de la livraison d'une vente. Nullable (null = pas encore livree).
-- Purement comptable : ne sert jamais a calculer des morts (voir AV.2).

-- AlterTable
ALTER TABLE "LigneVente" ADD COLUMN     "poidsLivreKg" DOUBLE PRECISION;
