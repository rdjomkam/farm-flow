-- PR2-octies, story PR2oct.2 — alevins achetés ou produits en interne.
--
-- Ajoute VaguePrevue.alevinsAchetes (§4.3 des exigences, décision par
-- vague) et ParametresPrevision.alevinsAchetesParDefaut (valeur
-- d'amorçage scénario). Les deux colonnes sont NOT NULL avec
-- DEFAULT false (R7) : le jeu d'or EXCEL-V12 porte "NON" sur ses 19
-- vagues, sans exception, donc le DEFAULT false backfille implicitement
-- toutes les lignes existantes avec la valeur exacte attendue — aucun
-- UPDATE de masse n'est nécessaire pour le drapeau lui-même.
--
-- Idempotent : no-op si les colonnes existent déjà (R10).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ParametresPrevision'
      AND column_name = 'alevinsAchetesParDefaut'
  ) THEN
    ALTER TABLE "ParametresPrevision"
      ADD COLUMN "alevinsAchetesParDefaut" BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'VaguePrevue'
      AND column_name = 'alevinsAchetes'
  ) THEN
    ALTER TABLE "VaguePrevue"
      ADD COLUMN "alevinsAchetes" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Correctif de données (R10) : restaure ParametresPrevision.prixAlevinUnitaireFCFA
-- = 70 sur le seul scénario de code 'EXCEL-V12'. Cette valeur (jeu d'or
-- entreesModele.parametresScenario.prixAlevinUnitaireFCFA = 70) a été
-- écrasée à 0 par un sprint antérieur comme contournement — le drapeau
-- alevinsAchetes (posé à false ci-dessus sur les 19 vagues du même
-- scénario, conforme au jeu d'or) rend ce contournement obsolète : avec
-- alevinsAchetes = false, le coût d'alevins calculé reste 0 que le prix
-- vaille 0 ou 70, donc cette restauration ne change AUCUN montant
-- calculé — elle corrige uniquement une valeur affichée/saisie mensongère.
--
-- Cible la VALEUR (70), jamais un delta relatif. Ne réécrit que si la
-- valeur actuelle est bien 0 (n'écrase jamais une valeur différente
-- saisie légitimement par un utilisateur). No-op silencieux si le
-- scénario EXCEL-V12 est absent de l'environnement (dev d'un autre
-- agent, CI, prod) — même patron que les migrations
-- 202607270900xx_data_fix_*.
UPDATE "ParametresPrevision" AS pp
SET "prixAlevinUnitaireFCFA" = 70
FROM "ScenarioPrevision" AS sp
WHERE pp."scenarioId" = sp."id"
  AND sp."code" = 'EXCEL-V12'
  AND pp."prixAlevinUnitaireFCFA" = 0;
