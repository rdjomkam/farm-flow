-- ADR-053 §12 (amendement PR2-quater) — AlimentPrevision devient le niveau CALIBRE, un nouveau
-- modele AlimentArticlePrevision porte le niveau ARTICLE (marque/poids de sac/prix).
--
-- ATTENTION (R10, ERR-140) : le SQL brut genere par `prisma migrate diff` pour ce changement
-- produit un simple DROP COLUMN sur "AlimentPrevision" (libelle, poidsSacKg, prixSacFCFA,
-- produitId, sacsParTonneUnitaire) sans jamais generer l'INSERT INTO "AlimentArticlePrevision"
-- necessaire pour preserver la donnee : Prisma ne detecte pas les deplacements de colonnes entre
-- deux tables. Ce fichier a ete integralement reecrit a la main : la table fille est creee et
-- peuplee AVANT toute suppression de colonne, et deux garde-fous de precondition (ADR-053 §12.2
-- arbitrage 5) s'executent avant tout ALTER TABLE.
--
-- Idempotence : sur une table "AlimentPrevision" vide (etat reel du depot au moment de cette
-- migration — prisma/seed.sql ne contient aucun INSERT sur ce module), les deux garde-fous
-- passent trivialement (COUNT(*) = 0) et l'INSERT ... SELECT ne produit aucune ligne : la
-- migration est un no-op silencieux sur les donnees, seul le schema change.

-- ============================================================================
-- Garde-fou 1/2 — rejet bruyant si au moins une ligne a tailleGranule IS NULL.
-- Jamais de valeur de repli inventee (R7, ADR-053 §12.2 arbitrage 5) ; le message nomme les
-- lignes fautives (id, scenarioId), pas seulement leur nombre.
-- ============================================================================
DO $$
DECLARE
  lignes_fautives TEXT;
BEGIN
  SELECT string_agg('(id=' || id || ', scenarioId=' || "scenarioId" || ')', ', ')
    INTO lignes_fautives
    FROM "AlimentPrevision"
    WHERE "tailleGranule" IS NULL;

  IF lignes_fautives IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 20260803160000_aliment_prevision_calibre_article : impossible de rendre "AlimentPrevision"."tailleGranule" obligatoire, des lignes ont tailleGranule = NULL : %. Corriger manuellement ces lignes (assigner une TailleGranule reelle) avant de rejouer cette migration.', lignes_fautives;
  END IF;
END $$;

-- ============================================================================
-- Garde-fou 2/2 — rejet bruyant si collision (scenarioId, tailleGranule) : deux AlimentPrevision
-- du meme scenario partageant le meme calibre. Pas de fusion arbitraire (aucune part
-- d'approvisionnement inventee) — le message nomme les lignes en collision.
-- ============================================================================
DO $$
DECLARE
  collisions TEXT;
BEGIN
  SELECT string_agg(
           'scenarioId=' || "scenarioId" || ', tailleGranule=' || "tailleGranule"
             || ' -> ids: ' || ids,
           ' | '
         )
    INTO collisions
    FROM (
      SELECT "scenarioId", "tailleGranule", string_agg(id, ', ') AS ids
      FROM "AlimentPrevision"
      GROUP BY "scenarioId", "tailleGranule"
      HAVING count(*) > 1
    ) sub;

  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 20260803160000_aliment_prevision_calibre_article : collision (scenarioId, tailleGranule) detectee, impossible d''appliquer la contrainte @@unique([scenarioId, tailleGranule]) : %. Fusionner ou re-affecter manuellement ces lignes (aucune fusion automatique ne peut deviner la part d''approvisionnement reelle de chaque marque) avant de rejouer cette migration.', collisions;
  END IF;
END $$;

-- ============================================================================
-- 1) Creation de la table fille AlimentArticlePrevision (niveau ARTICLE), AVANT toute suppression
--    de colonne sur AlimentPrevision — les colonnes source doivent encore exister pour l'INSERT
--    ... SELECT qui suit.
-- ============================================================================
CREATE TABLE "AlimentArticlePrevision" (
    "id" TEXT NOT NULL,
    "alimentCalibrePrevisionId" TEXT NOT NULL,
    "produitId" TEXT,
    "libelle" TEXT NOT NULL,
    "poidsSacKg" DECIMAL(65,30) NOT NULL,
    "prixSacFCFA" DECIMAL(65,30) NOT NULL,
    "sacsParTonneUnitaire" DECIMAL(65,30) NOT NULL,
    "partApprovisionnementPct" DECIMAL(65,30) NOT NULL,
    "ordre" INTEGER NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlimentArticlePrevision_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- 2) Migration des donnees (R10) — chaque AlimentPrevision existante devient un calibre + un
--    article a 100 %. INSERT ... SELECT explicite depuis les colonnes qui descendent au niveau
--    article, AVANT de les supprimer du calibre (jamais un DROP/ADD qui perdrait les valeurs).
--    Le PK d'AlimentPrevision est conserve (il devient celui du calibre) : aucun remap de FK
--    downstream (RepartitionMoisAliment, AlimentParVaguePrevue) n'est necessaire.
--    No-op silencieux si "AlimentPrevision" est vide (etat reel de ce depot).
-- ============================================================================
INSERT INTO "AlimentArticlePrevision" (
  "id", "alimentCalibrePrevisionId", "produitId", "libelle", "poidsSacKg", "prixSacFCFA",
  "sacsParTonneUnitaire", "partApprovisionnementPct", "ordre", "siteId", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  ap."id",
  ap."produitId",
  ap."libelle",
  ap."poidsSacKg",
  ap."prixSacFCFA",
  ap."sacsParTonneUnitaire",
  100,
  1,
  ap."siteId",
  now(),
  now()
FROM "AlimentPrevision" ap;

-- ============================================================================
-- 3) Suppression des colonnes desormais portees par AlimentArticlePrevision, une fois la copie
--    confirmee ci-dessus.
-- ============================================================================
ALTER TABLE "AlimentPrevision" DROP CONSTRAINT "AlimentPrevision_produitId_fkey";

DROP INDEX "AlimentPrevision_produitId_idx";

ALTER TABLE "AlimentPrevision"
  DROP COLUMN "libelle",
  DROP COLUMN "poidsSacKg",
  DROP COLUMN "prixSacFCFA",
  DROP COLUMN "produitId",
  DROP COLUMN "sacsParTonneUnitaire";

-- ============================================================================
-- 4) tailleGranule devient obligatoire — atteignable uniquement parce que le garde-fou 1/2 a
--    deja garanti l'absence de NULL.
-- ============================================================================
ALTER TABLE "AlimentPrevision" ALTER COLUMN "tailleGranule" SET NOT NULL;

-- ============================================================================
-- 5) Unicite d'un calibre par scenario — atteignable uniquement parce que le garde-fou 2/2 a deja
--    garanti l'absence de collision.
-- ============================================================================
CREATE UNIQUE INDEX "AlimentPrevision_scenarioId_tailleGranule_key" ON "AlimentPrevision"("scenarioId", "tailleGranule");

-- ============================================================================
-- 6) Index de la nouvelle table (R8, ADR-053 §12.3)
-- ============================================================================
CREATE INDEX "AlimentArticlePrevision_alimentCalibrePrevisionId_idx" ON "AlimentArticlePrevision"("alimentCalibrePrevisionId");

CREATE INDEX "AlimentArticlePrevision_siteId_idx" ON "AlimentArticlePrevision"("siteId");

CREATE INDEX "AlimentArticlePrevision_produitId_idx" ON "AlimentArticlePrevision"("produitId");

-- ============================================================================
-- 7) Contraintes FK de la nouvelle table
-- ============================================================================
ALTER TABLE "AlimentArticlePrevision" ADD CONSTRAINT "AlimentArticlePrevision_alimentCalibrePrevisionId_fkey" FOREIGN KEY ("alimentCalibrePrevisionId") REFERENCES "AlimentPrevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlimentArticlePrevision" ADD CONSTRAINT "AlimentArticlePrevision_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlimentArticlePrevision" ADD CONSTRAINT "AlimentArticlePrevision_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
