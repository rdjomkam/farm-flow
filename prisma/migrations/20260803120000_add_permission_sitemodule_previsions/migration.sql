-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'PREVISIONS_VOIR';
ALTER TYPE "Permission" ADD VALUE 'PREVISIONS_GERER';
ALTER TYPE "Permission" ADD VALUE 'PREVISIONS_PARAMETRER';
ALTER TYPE "Permission" ADD VALUE 'PREVISIONS_CLOTURER';

-- AlterEnum
ALTER TYPE "SiteModule" ADD VALUE 'PREVISIONS';
