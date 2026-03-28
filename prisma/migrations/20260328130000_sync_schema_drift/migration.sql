-- Fix schema drift: sync DB with Prisma schema

-- Add missing column on Releve (fixes P2022 on /vagues/[id])
ALTER TABLE "Releve" ADD COLUMN IF NOT EXISTS "nombreRenouvellements" INTEGER DEFAULT 1;

-- Sync ModuleDefinition.updatedAt
ALTER TABLE "ModuleDefinition" ALTER COLUMN "updatedAt" DROP DEFAULT;
