-- Migration: Convert all enum values to UPPERCASE + add CANNIBALISME, AUTRE to CauseMortalite

-- ──────────────────────────────────────────
-- StatutVague: en_cours → EN_COURS, terminee → TERMINEE, annulee → ANNULEE
-- ──────────────────────────────────────────
ALTER TYPE "StatutVague" ADD VALUE IF NOT EXISTS 'EN_COURS';
ALTER TYPE "StatutVague" ADD VALUE IF NOT EXISTS 'TERMINEE';
ALTER TYPE "StatutVague" ADD VALUE IF NOT EXISTS 'ANNULEE';

UPDATE "Vague" SET statut = 'EN_COURS' WHERE statut = 'en_cours';
UPDATE "Vague" SET statut = 'TERMINEE' WHERE statut = 'terminee';
UPDATE "Vague" SET statut = 'ANNULEE' WHERE statut = 'annulee';

-- ──────────────────────────────────────────
-- TypeReleve: all values to UPPERCASE
-- ──────────────────────────────────────────
ALTER TYPE "TypeReleve" ADD VALUE IF NOT EXISTS 'BIOMETRIE';
ALTER TYPE "TypeReleve" ADD VALUE IF NOT EXISTS 'MORTALITE';
ALTER TYPE "TypeReleve" ADD VALUE IF NOT EXISTS 'ALIMENTATION';
ALTER TYPE "TypeReleve" ADD VALUE IF NOT EXISTS 'QUALITE_EAU';
ALTER TYPE "TypeReleve" ADD VALUE IF NOT EXISTS 'COMPTAGE';
ALTER TYPE "TypeReleve" ADD VALUE IF NOT EXISTS 'OBSERVATION';

UPDATE "Releve" SET "typeReleve" = 'BIOMETRIE' WHERE "typeReleve" = 'biometrie';
UPDATE "Releve" SET "typeReleve" = 'MORTALITE' WHERE "typeReleve" = 'mortalite';
UPDATE "Releve" SET "typeReleve" = 'ALIMENTATION' WHERE "typeReleve" = 'alimentation';
UPDATE "Releve" SET "typeReleve" = 'QUALITE_EAU' WHERE "typeReleve" = 'qualite_eau';
UPDATE "Releve" SET "typeReleve" = 'COMPTAGE' WHERE "typeReleve" = 'comptage';
UPDATE "Releve" SET "typeReleve" = 'OBSERVATION' WHERE "typeReleve" = 'observation';

-- ──────────────────────────────────────────
-- TypeAliment: artisanal → ARTISANAL, commercial → COMMERCIAL, mixte → MIXTE
-- ──────────────────────────────────────────
ALTER TYPE "TypeAliment" ADD VALUE IF NOT EXISTS 'ARTISANAL';
ALTER TYPE "TypeAliment" ADD VALUE IF NOT EXISTS 'COMMERCIAL';
ALTER TYPE "TypeAliment" ADD VALUE IF NOT EXISTS 'MIXTE';

UPDATE "Releve" SET "typeAliment" = 'ARTISANAL' WHERE "typeAliment" = 'artisanal';
UPDATE "Releve" SET "typeAliment" = 'COMMERCIAL' WHERE "typeAliment" = 'commercial';
UPDATE "Releve" SET "typeAliment" = 'MIXTE' WHERE "typeAliment" = 'mixte';

-- ──────────────────────────────────────────
-- CauseMortalite: uppercase + add CANNIBALISME, AUTRE
-- ──────────────────────────────────────────
ALTER TYPE "CauseMortalite" ADD VALUE IF NOT EXISTS 'MALADIE';
ALTER TYPE "CauseMortalite" ADD VALUE IF NOT EXISTS 'QUALITE_EAU';
ALTER TYPE "CauseMortalite" ADD VALUE IF NOT EXISTS 'STRESS';
ALTER TYPE "CauseMortalite" ADD VALUE IF NOT EXISTS 'PREDATION';
ALTER TYPE "CauseMortalite" ADD VALUE IF NOT EXISTS 'CANNIBALISME';
ALTER TYPE "CauseMortalite" ADD VALUE IF NOT EXISTS 'INCONNUE';
ALTER TYPE "CauseMortalite" ADD VALUE IF NOT EXISTS 'AUTRE';

UPDATE "Releve" SET "causeMortalite" = 'MALADIE' WHERE "causeMortalite" = 'maladie';
UPDATE "Releve" SET "causeMortalite" = 'QUALITE_EAU' WHERE "causeMortalite" = 'qualite_eau';
UPDATE "Releve" SET "causeMortalite" = 'STRESS' WHERE "causeMortalite" = 'stress';
UPDATE "Releve" SET "causeMortalite" = 'PREDATION' WHERE "causeMortalite" = 'predation';
UPDATE "Releve" SET "causeMortalite" = 'INCONNUE' WHERE "causeMortalite" = 'inconnue';

-- ──────────────────────────────────────────
-- MethodeComptage: direct → DIRECT, estimation → ESTIMATION, echantillonnage → ECHANTILLONNAGE
-- ──────────────────────────────────────────
ALTER TYPE "MethodeComptage" ADD VALUE IF NOT EXISTS 'DIRECT';
ALTER TYPE "MethodeComptage" ADD VALUE IF NOT EXISTS 'ESTIMATION';
ALTER TYPE "MethodeComptage" ADD VALUE IF NOT EXISTS 'ECHANTILLONNAGE';

UPDATE "Releve" SET "methodeComptage" = 'DIRECT' WHERE "methodeComptage" = 'direct';
UPDATE "Releve" SET "methodeComptage" = 'ESTIMATION' WHERE "methodeComptage" = 'estimation';
UPDATE "Releve" SET "methodeComptage" = 'ECHANTILLONNAGE' WHERE "methodeComptage" = 'echantillonnage';

-- ──────────────────────────────────────────
-- Remove old lowercase values by recreating enums
-- PostgreSQL does not support DROP VALUE from enums, so we recreate them
-- ──────────────────────────────────────────

-- StatutVague
ALTER TYPE "StatutVague" RENAME TO "StatutVague_old";
CREATE TYPE "StatutVague" AS ENUM ('EN_COURS', 'TERMINEE', 'ANNULEE');
ALTER TABLE "Vague" ALTER COLUMN statut DROP DEFAULT;
ALTER TABLE "Vague" ALTER COLUMN statut TYPE "StatutVague" USING statut::text::"StatutVague";
ALTER TABLE "Vague" ALTER COLUMN statut SET DEFAULT 'EN_COURS';
DROP TYPE "StatutVague_old";

-- TypeReleve
ALTER TYPE "TypeReleve" RENAME TO "TypeReleve_old";
CREATE TYPE "TypeReleve" AS ENUM ('BIOMETRIE', 'MORTALITE', 'ALIMENTATION', 'QUALITE_EAU', 'COMPTAGE', 'OBSERVATION');
ALTER TABLE "Releve" ALTER COLUMN "typeReleve" TYPE "TypeReleve" USING "typeReleve"::text::"TypeReleve";
DROP TYPE "TypeReleve_old";

-- TypeAliment
ALTER TYPE "TypeAliment" RENAME TO "TypeAliment_old";
CREATE TYPE "TypeAliment" AS ENUM ('ARTISANAL', 'COMMERCIAL', 'MIXTE');
ALTER TABLE "Releve" ALTER COLUMN "typeAliment" TYPE "TypeAliment" USING "typeAliment"::text::"TypeAliment";
DROP TYPE "TypeAliment_old";

-- CauseMortalite
ALTER TYPE "CauseMortalite" RENAME TO "CauseMortalite_old";
CREATE TYPE "CauseMortalite" AS ENUM ('MALADIE', 'QUALITE_EAU', 'STRESS', 'PREDATION', 'CANNIBALISME', 'INCONNUE', 'AUTRE');
ALTER TABLE "Releve" ALTER COLUMN "causeMortalite" TYPE "CauseMortalite" USING "causeMortalite"::text::"CauseMortalite";
DROP TYPE "CauseMortalite_old";

-- MethodeComptage
ALTER TYPE "MethodeComptage" RENAME TO "MethodeComptage_old";
CREATE TYPE "MethodeComptage" AS ENUM ('DIRECT', 'ESTIMATION', 'ECHANTILLONNAGE');
ALTER TABLE "Releve" ALTER COLUMN "methodeComptage" TYPE "MethodeComptage" USING "methodeComptage"::text::"MethodeComptage";
DROP TYPE "MethodeComptage_old";
