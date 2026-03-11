-- Migration: Convert all enum values to UPPERCASE + add CANNIBALISME, AUTRE to CauseMortalite
-- Uses enum recreation strategy (rename old → create new → cast → drop old)
-- This approach works inside a transaction (unlike ADD VALUE + UPDATE)

-- ──────────────────────────────────────────
-- StatutVague: en_cours → EN_COURS, terminee → TERMINEE, annulee → ANNULEE
-- ──────────────────────────────────────────
ALTER TYPE "StatutVague" RENAME TO "StatutVague_old";
CREATE TYPE "StatutVague" AS ENUM ('EN_COURS', 'TERMINEE', 'ANNULEE');
ALTER TABLE "Vague" ALTER COLUMN statut DROP DEFAULT;
ALTER TABLE "Vague" ALTER COLUMN statut TYPE "StatutVague" USING statut::text::"StatutVague";
ALTER TABLE "Vague" ALTER COLUMN statut SET DEFAULT 'EN_COURS';
DROP TYPE "StatutVague_old";

-- ──────────────────────────────────────────
-- TypeReleve: all values to UPPERCASE
-- ──────────────────────────────────────────
ALTER TYPE "TypeReleve" RENAME TO "TypeReleve_old";
CREATE TYPE "TypeReleve" AS ENUM ('BIOMETRIE', 'MORTALITE', 'ALIMENTATION', 'QUALITE_EAU', 'COMPTAGE', 'OBSERVATION');
ALTER TABLE "Releve" ALTER COLUMN "typeReleve" TYPE "TypeReleve" USING "typeReleve"::text::"TypeReleve";
DROP TYPE "TypeReleve_old";

-- ──────────────────────────────────────────
-- TypeAliment: artisanal → ARTISANAL, commercial → COMMERCIAL, mixte → MIXTE
-- ──────────────────────────────────────────
ALTER TYPE "TypeAliment" RENAME TO "TypeAliment_old";
CREATE TYPE "TypeAliment" AS ENUM ('ARTISANAL', 'COMMERCIAL', 'MIXTE');
ALTER TABLE "Releve" ALTER COLUMN "typeAliment" TYPE "TypeAliment" USING "typeAliment"::text::"TypeAliment";
DROP TYPE "TypeAliment_old";

-- ──────────────────────────────────────────
-- CauseMortalite: uppercase + add CANNIBALISME, AUTRE
-- ──────────────────────────────────────────
ALTER TYPE "CauseMortalite" RENAME TO "CauseMortalite_old";
CREATE TYPE "CauseMortalite" AS ENUM ('MALADIE', 'QUALITE_EAU', 'STRESS', 'PREDATION', 'CANNIBALISME', 'INCONNUE', 'AUTRE');
ALTER TABLE "Releve" ALTER COLUMN "causeMortalite" TYPE "CauseMortalite" USING "causeMortalite"::text::"CauseMortalite";
DROP TYPE "CauseMortalite_old";

-- ──────────────────────────────────────────
-- MethodeComptage: direct → DIRECT, estimation → ESTIMATION, echantillonnage → ECHANTILLONNAGE
-- ──────────────────────────────────────────
ALTER TYPE "MethodeComptage" RENAME TO "MethodeComptage_old";
CREATE TYPE "MethodeComptage" AS ENUM ('DIRECT', 'ESTIMATION', 'ECHANTILLONNAGE');
ALTER TABLE "Releve" ALTER COLUMN "methodeComptage" TYPE "MethodeComptage" USING "methodeComptage"::text::"MethodeComptage";
DROP TYPE "MethodeComptage_old";
