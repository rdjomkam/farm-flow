-- Fusion AlimentArticlePrevision -> AlimentPrevision (relation 1:1 calibre/article) — annule et
-- remplace le passage a deux niveaux introduit par la migration 20260803160000. Le cas N > 1
-- articles par calibre (repartition d'approvisionnement) n'a jamais ete utilise en pratique : on
-- revient a un seul jeu de champs article porte directement par le calibre.
--
-- ATTENTION (R10) : le SQL brut genere par `prisma migrate diff` pour ce changement produit un
-- simple ADD COLUMN ... NOT NULL sur "AlimentPrevision" (libelle, poidsSacKg, prixSacFCFA,
-- sacsParTonneUnitaire) suivi d'un DROP TABLE "AlimentArticlePrevision", sans jamais copier la
-- donnee existante. Ce fichier est integralement reecrit a la main : les colonnes sont ajoutees
-- NULLABLE, peuplees depuis "AlimentArticlePrevision" (premier article par ordre ASC), un
-- garde-fou de precondition rejette toute perte de donnee non couverte, puis les colonnes sont
-- durcies en NOT NULL avant de supprimer la table fille.
--
-- Idempotence :
--   - Etape 1 (ADD COLUMN) utilise IF NOT EXISTS : no-op si deja jouee.
--   - Etape 2 (copie) ne touche que les lignes ou "libelle" est encore NULL : no-op si deja jouee,
--     et no-op silencieux si "AlimentArticlePrevision" a deja ete supprimee (garde par
--     to_regclass).
--   - Etape 3 (garde-fou) ne peut plus rejeter une fois la table fille supprimee.
--   - Etape 4 (NOT NULL) et etape 5 (DROP TABLE) sont naturellement idempotentes
--     (ALTER ... SET NOT NULL sur une colonne deja NOT NULL, DROP TABLE IF EXISTS).

-- ============================================================================
-- 1) Nouvelles colonnes sur "AlimentPrevision", NULLABLE dans un premier temps — elles ne
--    deviennent NOT NULL qu'a l'etape 4, une fois la copie des donnees confirmee.
-- ============================================================================
ALTER TABLE "AlimentPrevision"
  ADD COLUMN IF NOT EXISTS "produitId" TEXT,
  ADD COLUMN IF NOT EXISTS "libelle" TEXT,
  ADD COLUMN IF NOT EXISTS "poidsSacKg" DECIMAL(65,30),
  ADD COLUMN IF NOT EXISTS "prixSacFCFA" DECIMAL(65,30),
  ADD COLUMN IF NOT EXISTS "sacsParTonneUnitaire" DECIMAL(65,30);

-- ============================================================================
-- 2) Copie des donnees depuis le PREMIER article de chaque calibre (ORDER BY ordre ASC), pour
--    toute ligne de "AlimentPrevision" pas encore peuplee ("libelle" IS NULL). Guard
--    to_regclass(...) IS NOT NULL : no-op silencieux si "AlimentArticlePrevision" a deja ete
--    supprimee par une execution precedente de cette migration.
-- ============================================================================
DO $$
BEGIN
  IF to_regclass('"AlimentArticlePrevision"') IS NOT NULL THEN
    UPDATE "AlimentPrevision" ap
    SET
      "produitId"            = premier."produitId",
      "libelle"              = premier."libelle",
      "poidsSacKg"           = premier."poidsSacKg",
      "prixSacFCFA"          = premier."prixSacFCFA",
      "sacsParTonneUnitaire" = premier."sacsParTonneUnitaire"
    FROM (
      SELECT DISTINCT ON (a."alimentCalibrePrevisionId")
        a."alimentCalibrePrevisionId",
        a."produitId",
        a."libelle",
        a."poidsSacKg",
        a."prixSacFCFA",
        a."sacsParTonneUnitaire"
      FROM "AlimentArticlePrevision" a
      ORDER BY a."alimentCalibrePrevisionId", a."ordre" ASC
    ) premier
    WHERE ap.id = premier."alimentCalibrePrevisionId"
      AND ap."libelle" IS NULL;
  END IF;
END $$;

-- ============================================================================
-- 3) Garde-fou de precondition — rejet bruyant si au moins un calibre reste sans article associe
--    (aucune ligne "AlimentArticlePrevision" correspondante) : impossible de renseigner les
--    colonnes NOT NULL sans inventer une valeur (R7). Le message nomme les calibres fautifs.
--    No-op si "AlimentArticlePrevision" a deja ete supprimee (les colonnes sont alors deja
--    peuplees ou la migration a deja echoue avant ce point lors d'une execution precedente).
-- ============================================================================
DO $$
DECLARE
  calibres_fautifs TEXT;
BEGIN
  IF to_regclass('"AlimentArticlePrevision"') IS NOT NULL THEN
    SELECT string_agg('(id=' || ap.id || ', scenarioId=' || ap."scenarioId" || ')', ', ')
      INTO calibres_fautifs
      FROM "AlimentPrevision" ap
      WHERE ap."libelle" IS NULL;

    IF calibres_fautifs IS NOT NULL THEN
      RAISE EXCEPTION 'Migration 20260807120000_merge_article_into_calibre : impossible de fusionner l''article dans le calibre, des lignes "AlimentPrevision" n''ont aucun "AlimentArticlePrevision" associe : %. Corriger manuellement (creer l''article manquant) avant de rejouer cette migration.', calibres_fautifs;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 4) Durcissement en NOT NULL — atteignable uniquement parce que le garde-fou 3) a deja garanti
--    l'absence de calibre non peuple.
-- ============================================================================
ALTER TABLE "AlimentPrevision"
  ALTER COLUMN "libelle" SET NOT NULL,
  ALTER COLUMN "poidsSacKg" SET NOT NULL,
  ALTER COLUMN "prixSacFCFA" SET NOT NULL,
  ALTER COLUMN "sacsParTonneUnitaire" SET NOT NULL;

-- ============================================================================
-- 5) Index et FK de la nouvelle colonne produitId (R8, meme convention que l'ancienne table fille).
-- ============================================================================
CREATE INDEX IF NOT EXISTS "AlimentPrevision_produitId_idx" ON "AlimentPrevision"("produitId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AlimentPrevision_produitId_fkey'
  ) THEN
    ALTER TABLE "AlimentPrevision"
      ADD CONSTRAINT "AlimentPrevision_produitId_fkey"
      FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 6) Suppression de la table fille, desormais fusionnee dans "AlimentPrevision".
-- ============================================================================
DROP TABLE IF EXISTS "AlimentArticlePrevision";
