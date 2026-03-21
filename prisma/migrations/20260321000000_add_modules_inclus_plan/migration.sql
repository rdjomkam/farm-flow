-- Migration: add modulesInclus to PlanAbonnement
-- Story 43.1 — Sprint 43
-- Adds the modulesInclus SiteModule[] field with default empty array.
-- Platform modules (ABONNEMENTS, COMMISSIONS, REMISES) must never appear here.

ALTER TABLE "PlanAbonnement" ADD COLUMN "modulesInclus" "SiteModule"[] NOT NULL DEFAULT ARRAY[]::"SiteModule"[];
