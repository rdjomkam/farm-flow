-- Migration: add userId to FraisPaiementDepense (nullable for backward compat)
ALTER TABLE "FraisPaiementDepense" ADD COLUMN "userId" TEXT;

-- Backfill: set userId from the parent PaiementDepense for existing rows
UPDATE "FraisPaiementDepense"
SET "userId" = (
  SELECT "userId"
  FROM "PaiementDepense"
  WHERE "PaiementDepense"."id" = "FraisPaiementDepense"."paiementId"
);

-- Add foreign key constraint
ALTER TABLE "FraisPaiementDepense"
  ADD CONSTRAINT "FraisPaiementDepense_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
