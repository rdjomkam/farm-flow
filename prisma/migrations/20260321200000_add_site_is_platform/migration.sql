-- Migration: add_site_is_platform
-- Adds isPlatform flag to Site model.
-- A partial unique index ensures only ONE site can be marked as platform.

ALTER TABLE "Site" ADD COLUMN "isPlatform" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Site" SET "isPlatform" = true WHERE id = 'site_01';

CREATE UNIQUE INDEX "Site_isPlatform_unique" ON "Site" ("isPlatform") WHERE "isPlatform" = true;
