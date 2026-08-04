-- PR2-septies, story PR2sept.2 — la remise fournisseur se décide au tonnage de la vague.
--
-- ADR-053 §13.3 / ERR-143 : `PalierRemise.seuilSacs` comparait un seuil unique par
-- scénario au nombre de sacs d'UNE SEULE granulométrie, alors que le §4.3 des exigences
-- définit la remise comme « le palier dont le seuil est le plus grand ≤ objectif_tonnage_t ».
-- La colonne devient `seuilTonnes`, exprimée en TONNES.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ÉDITION MANUELLE DU SQL GÉNÉRÉ — ERR-140, troisième occurrence sur ce module.
-- `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
-- --script` a généré, comme les deux fois précédentes :
--
--     ALTER TABLE "PalierRemise" DROP COLUMN "seuilSacs",
--     ADD COLUMN     "seuilTonnes" DECIMAL(65,30) NOT NULL;
--
-- Cette paire DROP/ADD est structurellement correcte mais détruit les données : Prisma
-- ne détecte pas les renommages. Elle a été remplacée à la main par un vrai RENAME COLUMN.
-- La table est vide au moment de l'écriture (0 ligne, vérifié), ce qui rendrait l'erreur
-- indolore — c'est exactement la circonstance dans laquelle le réflexe se perd, donc il
-- est appliqué AVANT de le vérifier, pas après.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- AUCUNE CONVERSION DE VALEUR N'EST FAITE, et c'est délibéré : une conversion
-- sacs → tonnes n'est pas déterministe. `AlimentPrevision.sacsParTonneStandard` vaut
-- 8 / 18 / 50 selon la granulométrie ; un `seuilSacs` unique par scénario n'appartient à
-- aucune granulométrie en particulier, donc aucun facteur unique ne permet de le convertir.
-- Une migration qui « devinerait » une conversion inventerait une donnée métier.
-- D'où le garde-fou ci-dessous : sur données existantes, elle ÉCHOUE BRUYAMMENT plutôt
-- que de réinterpréter des sacs comme des tonnes (facteur 8 à 50 sur la remise décidée).
--
-- Les 4 paliers du classeur de référence (0/5/10/15 t → 0/2/4/6 %) ne sont volontairement
-- PAS insérés ici : ce sont les données métier d'un client particulier, elles n'ont rien à
-- faire dans une migration partagée par tous les sites (ADR-053 §13.3).
--
-- Idempotente (R10) : chaque bloc est un no-op silencieux si son effet est déjà en place.

-- 1) Garde-fou de précondition — dans la migration elle-même (R10), jamais dans un script
--    préalable qu'un humain devrait penser à lancer. Bloque si des paliers en sacs existent.
DO $$
DECLARE
  nb_paliers BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PalierRemise' AND column_name = 'seuilSacs'
  ) THEN
    SELECT count(*) INTO nb_paliers FROM "PalierRemise";
    IF nb_paliers > 0 THEN
      RAISE EXCEPTION
        'Migration bloquee : % ligne(s) dans "PalierRemise" portent un seuil exprime en SACS. Aucune conversion sacs->tonnes n''est deterministe (sacsParTonneStandard vaut 8, 18 ou 50 selon la granulometrie, et un seuil de scenario n''appartient a aucune granulometrie). Marche a suivre : noter les paliers existants, les supprimer (DELETE FROM "PalierRemise"), rejouer cette migration, puis re-saisir les seuils EN TONNES depuis l''onglet Parametres du scenario (ADR-053 section 13.3, ERR-143).',
        nb_paliers;
    END IF;
  END IF;
END $$;

-- 2) Renommage pur de la colonne (JAMAIS DROP + ADD — voir l'en-tête, ERR-140).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PalierRemise' AND column_name = 'seuilSacs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PalierRemise' AND column_name = 'seuilTonnes'
  ) THEN
    ALTER TABLE "PalierRemise" RENAME COLUMN "seuilSacs" TO "seuilTonnes";
  END IF;
END $$;

-- 3) ADR-053 §13.8 point 3 — unicite de (scenarioId, ordre).
--    Deux paliers de meme `ordre` rendraient `orderBy: { ordre: "asc" }` non deterministe :
--    la remise appliquee dependrait de l'ordre d'insertion, defaut silencieux. La table est
--    vide, le cout est nul et ne le sera plus jamais autant ; le chemin d'ecriture
--    (`deleteMany` + `createMany` transactionnel) est deja compatible.
--    NON ajoutee : une contrainte de croissance des seuils — elle porte sur la relation
--    ENTRE lignes et demanderait un trigger, soit de la logique metier deportee en base.
--    Elle reste dans `validerPaliersRemiseCroissants` (src/lib/previsions/validation.ts).
CREATE UNIQUE INDEX IF NOT EXISTS "PalierRemise_scenarioId_ordre_key"
  ON "PalierRemise"("scenarioId", "ordre");
