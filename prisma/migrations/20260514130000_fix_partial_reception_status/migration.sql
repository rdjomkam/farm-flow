-- Data fix: downgrade LIVREE -> LIVREE_PARTIELLEMENT for orders with incomplete lines
UPDATE "Commande"
SET "statut" = 'LIVREE_PARTIELLEMENT'
WHERE "statut" = 'LIVREE'
  AND "id" IN (
    SELECT DISTINCT lc."commandeId"
    FROM "LigneCommande" lc
    WHERE COALESCE(lc."quantiteRecue", 0) < lc."quantite"
  );
