-- Migration: Add 9 granular Reproduction permissions to Permission enum
-- ADR-045: Reproduction Permissions Granulaires et Navigation
--
-- NOTE: ADD VALUE cannot run inside a transaction in PostgreSQL.
-- This migration must be applied WITHOUT transaction wrapping.
-- Use: npx prisma migrate deploy (not migrate dev)

ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'GENITEURS_VOIR';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'GENITEURS_GERER';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'PONTES_VOIR';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'PONTES_GERER';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'LOTS_ALEVINS_VOIR';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'LOTS_ALEVINS_GERER';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'INCUBATIONS_VOIR';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'INCUBATIONS_GERER';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'PLANNING_REPRODUCTION_VOIR';
