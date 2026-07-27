-- Fix schema drift: sync DB with Prisma schema

-- Add missing column on Releve (fixes P2022 on /vagues/[id])
ALTER TABLE "Releve" ADD COLUMN IF NOT EXISTS "nombreRenouvellements" INTEGER DEFAULT 1;

-- Sync ModuleDefinition.updatedAt
-- Tolérant à l'ordre : sur une base vierge, "ModuleDefinition" n'existe pas
-- encore à ce stade (elle est créée par
-- 20260402000000_add_module_definition_audit_log, postérieure dans la
-- chaîne réelle mais lexicographiquement après celle-ci). No-op silencieux
-- dans ce cas — la colonne "updatedAt" est alors définie sans DEFAULT dès
-- la CREATE TABLE de 20260402000000_add_module_definition_audit_log.
-- Voir docs/bugs/BUG-CI-migration-order.md.
ALTER TABLE IF EXISTS "ModuleDefinition" ALTER COLUMN "updatedAt" DROP DEFAULT;
