-- Migration: Rename fields (C5, C6) + make Bac.volume required (I1)

-- ──────────────────────────────────────────
-- C5: Vague field renames + add dateFin
-- ──────────────────────────────────────────
ALTER TABLE "Vague" RENAME COLUMN "dateDebutCharge" TO "dateDebut";
ALTER TABLE "Vague" RENAME COLUMN "poidsMoyenInit" TO "poidsMoyenInitial";
ALTER TABLE "Vague" ADD COLUMN "dateFin" TIMESTAMP(3);

-- ──────────────────────────────────────────
-- C6: Releve field renames
-- ──────────────────────────────────────────
ALTER TABLE "Releve" RENAME COLUMN "echantillon" TO "echantillonCount";
ALTER TABLE "Releve" RENAME COLUMN "quantiteKg" TO "quantiteAliment";
ALTER TABLE "Releve" RENAME COLUMN "frequence" TO "frequenceAliment";
ALTER TABLE "Releve" RENAME COLUMN "observation" TO "description";

-- ──────────────────────────────────────────
-- I1: Bac.volume → obligatoire
-- ──────────────────────────────────────────
-- Set default for any NULL volumes before making it NOT NULL
UPDATE "Bac" SET volume = 0 WHERE volume IS NULL;
ALTER TABLE "Bac" ALTER COLUMN "volume" SET NOT NULL;
