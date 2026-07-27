-- CreateEnum
CREATE TYPE "SiteModule" AS ENUM ('REPRODUCTION', 'GROSSISSEMENT', 'INTRANTS', 'VENTES', 'ANALYSE_PILOTAGE', 'PACKS_PROVISIONING', 'CONFIGURATION', 'INGENIEUR', 'NOTES');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "supervised" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enabledModules" "SiteModule"[] DEFAULT ARRAY[]::"SiteModule"[];

-- AlterTable
-- Tolérant à l'ordre : sur une base vierge, "Pack" n'existe pas encore à ce
-- stade (elle est créée par 20260320110000_add_packs, postérieure dans la
-- chaîne réelle mais lexicographiquement après celle-ci). No-op silencieux
-- dans ce cas — la colonne "enabledModules" est alors définie directement
-- dans la CREATE TABLE "Pack" de 20260320110000_add_packs.
-- Voir docs/bugs/BUG-CI-migration-order.md.
ALTER TABLE IF EXISTS "Pack" ADD COLUMN IF NOT EXISTS "enabledModules" "SiteModule"[] DEFAULT ARRAY[]::"SiteModule"[];
