-- Fix orphan Depenses: set commandeId from matching Commande via ListeBesoins
--
-- Problem: Depenses created from besoins have listeBesoinsId but commandeId=NULL
-- due to a bug during creation.
--
-- Match criteria: same listeBesoinsId + montantTotal within 5% tolerance.
-- Picks the commande with closest amount if multiple candidates.
-- Skips commandes already linked to another depense.

WITH matches AS (
  SELECT DISTINCT ON (d.id)
    d.id AS depense_id,
    c.id AS commande_id
  FROM "Depense" d
  JOIN "Commande" c ON c."listeBesoinsId" = d."listeBesoinsId"
  WHERE d."listeBesoinsId" IS NOT NULL
    AND d."commandeId" IS NULL
    AND ABS(d."montantTotal" - c."montantTotal") <= GREATEST(c."montantTotal" * 0.05, 100)
    AND NOT EXISTS (
      SELECT 1 FROM "Depense" d2
      WHERE d2."commandeId" = c.id
    )
  ORDER BY d.id, ABS(d."montantTotal" - c."montantTotal") ASC
)
UPDATE "Depense" d
SET "commandeId" = m.commande_id,
    "updatedAt" = NOW()
FROM matches m
WHERE d.id = m.depense_id;
