-- Migration: add modulesInclus to PlanAbonnement
-- Story 43.1 — Sprint 43
-- Adds the modulesInclus SiteModule[] field with default empty array.
-- Platform modules (ABONNEMENTS, COMMISSIONS, REMISES) must never appear here.

-- Tolérant à l'ordre : sur une base vierge, "PlanAbonnement" n'existe pas
-- encore à ce stade (elle est créée par 20260327000000_add_subscriptions,
-- postérieure dans la chaîne réelle mais lexicographiquement après
-- celle-ci). No-op silencieux dans ce cas — la colonne "modulesInclus" est
-- alors définie directement dans la CREATE TABLE "PlanAbonnement" de
-- 20260327000000_add_subscriptions. Voir docs/bugs/BUG-CI-migration-order.md.
ALTER TABLE IF EXISTS "PlanAbonnement" ADD COLUMN IF NOT EXISTS "modulesInclus" "SiteModule"[] NOT NULL DEFAULT ARRAY[]::"SiteModule"[];
