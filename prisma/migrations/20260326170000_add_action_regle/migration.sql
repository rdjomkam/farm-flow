-- Migration: 20260326170000_add_action_regle
-- Adds ActionRegle enum and new fields on RegleActivite for notification support.
-- Existing rows default to ACTIVITE (backward compatible).

-- Create new enum ActionRegle
CREATE TYPE "ActionRegle" AS ENUM ('ACTIVITE', 'NOTIFICATION', 'LES_DEUX');

-- Add new fields to RegleActivite
ALTER TABLE "RegleActivite"
  ADD COLUMN "actionType"                        "ActionRegle"    NOT NULL DEFAULT 'ACTIVITE',
  ADD COLUMN "severite"                          "SeveriteAlerte",
  ADD COLUMN "titreNotificationTemplate"         TEXT,
  ADD COLUMN "descriptionNotificationTemplate"   TEXT,
  ADD COLUMN "actionPayloadType"                 TEXT;
