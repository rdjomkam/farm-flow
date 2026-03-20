-- Migration 4: add_alert_enums
-- Recreates TypeAlerte with 4 new density-related values (RECREATE pattern)
-- Recreates TypeDeclencheur with 3 new values: SEUIL_DENSITE, SEUIL_RENOUVELLEMENT, ABSENCE_RELEVE (RECREATE pattern)
-- Creates OperateurCondition and LogiqueCondition enums

-- ── TypeAlerte RECREATE ──────────────────────────────────────────────────────
ALTER TYPE "TypeAlerte" RENAME TO "TypeAlerte_old";

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
  'DENSITE_CRITIQUE_QUALITE_EAU'
);

ALTER TABLE "ConfigAlerte"
  ALTER COLUMN "typeAlerte" TYPE "TypeAlerte"
  USING "typeAlerte"::text::"TypeAlerte";

ALTER TABLE "Notification"
  ALTER COLUMN "typeAlerte" TYPE "TypeAlerte"
  USING "typeAlerte"::text::"TypeAlerte";

DROP TYPE "TypeAlerte_old";

-- ── TypeDeclencheur RECREATE ─────────────────────────────────────────────────
ALTER TYPE "TypeDeclencheur" RENAME TO "TypeDeclencheur_old";

CREATE TYPE "TypeDeclencheur" AS ENUM (
  'CALENDRIER',
  'RECURRENT',
  'SEUIL_POIDS',
  'SEUIL_QUALITE',
  'SEUIL_MORTALITE',
  'STOCK_BAS',
  'FCR_ELEVE',
  'JALON',
  'SEUIL_DENSITE',
  'SEUIL_RENOUVELLEMENT',
  'ABSENCE_RELEVE'
);

ALTER TABLE "RegleActivite"
  ALTER COLUMN "typeDeclencheur" TYPE "TypeDeclencheur"
  USING "typeDeclencheur"::text::"TypeDeclencheur";

DROP TYPE "TypeDeclencheur_old";

-- ── OperateurCondition enum ──────────────────────────────────────────────────
CREATE TYPE "OperateurCondition" AS ENUM (
  'SUPERIEUR',
  'INFERIEUR',
  'ENTRE',
  'EGAL'
);

-- ── LogiqueCondition enum ────────────────────────────────────────────────────
CREATE TYPE "LogiqueCondition" AS ENUM (
  'ET',
  'OU'
);
