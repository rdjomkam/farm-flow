-- AlterTable: add completion tracking columns to Activite
ALTER TABLE "Activite" ADD COLUMN "dateTerminee" TIMESTAMP(3);
ALTER TABLE "Activite" ADD COLUMN "noteCompletion" TEXT;
