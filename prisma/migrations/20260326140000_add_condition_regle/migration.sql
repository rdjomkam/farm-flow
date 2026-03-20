-- Migration 5: add_condition_regle
-- Adds logique column to RegleActivite
-- Creates ConditionRegle table with composite conditions support

-- ── RegleActivite: add logique column ────────────────────────────────────────
ALTER TABLE "RegleActivite" ADD COLUMN "logique" "LogiqueCondition" NOT NULL DEFAULT 'ET';

-- ── ConditionRegle table ─────────────────────────────────────────────────────
CREATE TABLE "ConditionRegle" (
  "id"               TEXT NOT NULL,
  "regleId"          TEXT NOT NULL,
  "typeDeclencheur"  "TypeDeclencheur" NOT NULL,
  "operateur"        "OperateurCondition" NOT NULL DEFAULT 'SUPERIEUR',
  "conditionValeur"  DOUBLE PRECISION,
  "conditionValeur2" DOUBLE PRECISION,
  "ordre"            INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "ConditionRegle_pkey" PRIMARY KEY ("id")
);

-- ── Foreign key: ConditionRegle.regleId → RegleActivite.id (CASCADE) ─────────
ALTER TABLE "ConditionRegle" ADD CONSTRAINT "ConditionRegle_regleId_fkey"
  FOREIGN KEY ("regleId") REFERENCES "RegleActivite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Index for efficient lookup by regleId ────────────────────────────────────
CREATE INDEX "ConditionRegle_regleId_idx" ON "ConditionRegle"("regleId");
