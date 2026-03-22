-- ADR-022: Backoffice Separation
-- Replace Site.isPlatform with User.isSuperAdmin

-- Add isSuperAdmin to User
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Mark the platform admin as super admin
UPDATE "User" SET "isSuperAdmin" = true WHERE id = 'user_admin';

-- Remove isPlatform from Site
ALTER TABLE "Site" DROP COLUMN "isPlatform";

-- Drop unique index if it exists (defensive — was never created but safe to run)
DROP INDEX IF EXISTS "Site_isPlatform_unique";
