-- ADR-034: Remove StrategieInterpolation enum and ConfigElevage.interpolationStrategy field.
-- Gompertz is now always used (with ConfigElevage defaults fallback when calibration is NULL).

-- Step 1: Drop the column that references the enum
ALTER TABLE "ConfigElevage" DROP COLUMN IF EXISTS "interpolationStrategy";

-- Step 2: Drop the enum type
DROP TYPE IF EXISTS "StrategieInterpolation";
