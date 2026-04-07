-- Migration R1-S2 (3/3) — TypeAlerte : ajout 5 valeurs reproduction
-- Strategie : RECREATE (ERR-001) — rename old → create new → cast → drop old
-- Aucune ligne ne porte les 5 nouvelles valeurs (inexistantes), CAST safe.
-- Tables impactees : ConfigAlerte (typeAlerte), Notification (typeAlerte)

-- 1. Renommer l'ancien type
ALTER TYPE "TypeAlerte" RENAME TO "TypeAlerte_old";

-- 2. Creer le nouveau type avec toutes les valeurs (MAJUSCULES R1)
CREATE TYPE "TypeAlerte" AS ENUM (
  'MORTALITE_ELEVEE',
  'QUALITE_EAU',
  'STOCK_BAS',
  'RAPPEL_ALIMENTATION',
  'RAPPEL_BIOMETRIE',
  'PERSONNALISEE',
  'BESOIN_EN_RETARD',
  'DENSITE_ELEVEE',
  'RENOUVELLEMENT_EAU_INSUFFISANT',
  'AUCUN_RELEVE_QUALITE_EAU',
  'DENSITE_CRITIQUE_QUALITE_EAU',
  'ABONNEMENT_RAPPEL_RENOUVELLEMENT',
  'ABONNEMENT_ESSAI_EXPIRE',
  'MALES_STOCK_BAS',
  'FEMELLE_SUREXPLOITEE',
  'CONSANGUINITE_RISQUE',
  'INCUBATION_ECLOSION',
  'TAUX_SURVIE_CRITIQUE_LOT'
);

-- 3. Caster les colonnes vers le nouveau type
ALTER TABLE "ConfigAlerte"
  ALTER COLUMN "typeAlerte" TYPE "TypeAlerte"
  USING "typeAlerte"::text::"TypeAlerte";

ALTER TABLE "Notification"
  ALTER COLUMN "typeAlerte" TYPE "TypeAlerte"
  USING "typeAlerte"::text::"TypeAlerte";

-- 4. Supprimer l'ancien type
DROP TYPE "TypeAlerte_old";
