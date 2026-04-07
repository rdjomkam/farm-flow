-- Fix drift: drop index that no longer exists in schema
-- ERR-038: pre-existing drift detected during R1-S3 migrate diff
DROP INDEX IF EXISTS "AssignationBac_bacId_active_unique";
