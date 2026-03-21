-- Migration: add locale column to Session
-- Sprint 39.1 — locale field for internationalisation support

ALTER TABLE "Session" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'fr';
