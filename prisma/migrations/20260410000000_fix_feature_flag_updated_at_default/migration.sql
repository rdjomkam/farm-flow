-- Migration: fix_feature_flag_updated_at_default
-- H2: FeatureFlag.updatedAt was created NOT NULL without a DEFAULT.
-- Add DEFAULT CURRENT_TIMESTAMP so Prisma's @updatedAt behaviour is consistent
-- and INSERT statements that omit the column don't fail.

ALTER TABLE "FeatureFlag" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
