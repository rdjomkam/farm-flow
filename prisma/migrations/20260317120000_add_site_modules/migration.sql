-- CreateEnum
CREATE TYPE "SiteModule" AS ENUM ('REPRODUCTION', 'GROSSISSEMENT', 'INTRANTS', 'VENTES', 'ANALYSE_PILOTAGE', 'PACKS_PROVISIONING', 'CONFIGURATION', 'INGENIEUR', 'NOTES');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "supervised" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enabledModules" "SiteModule"[] DEFAULT ARRAY[]::"SiteModule"[];

-- AlterTable
ALTER TABLE "Pack" ADD COLUMN     "enabledModules" "SiteModule"[] DEFAULT ARRAY[]::"SiteModule"[];
