-- ADR-021 — Site & Module Management
-- Ajout de ModuleDefinition, SiteAuditLog, et champs Site (suspendedAt, suspendedReason, deletedAt)
-- Ajout de 3 nouvelles permissions dans l'enum Permission (SITES_VOIR, SITES_GERER, ANALYTICS_PLATEFORME)

-- ──────────────────────────────────────────
-- 1. Enum Permission — Ajout de 3 nouvelles valeurs (platform admin)
-- ──────────────────────────────────────────

ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'SITES_VOIR';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'SITES_GERER';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'ANALYTICS_PLATEFORME';

-- ──────────────────────────────────────────
-- 2. Site — Ajout des champs cycle de vie + index
-- ──────────────────────────────────────────

ALTER TABLE "Site"
  ADD COLUMN IF NOT EXISTS "suspendedAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "deletedAt"       TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Site_deletedAt_idx"   ON "Site"("deletedAt");
CREATE INDEX IF NOT EXISTS "Site_suspendedAt_idx" ON "Site"("suspendedAt");

-- ──────────────────────────────────────────
-- 3. ModuleDefinition — Registre global des modules
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ModuleDefinition" (
    "id"          TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "description" TEXT,
    "iconName"    TEXT NOT NULL DEFAULT 'Package',
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "level"       TEXT NOT NULL DEFAULT 'site',
    "dependsOn"   TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isVisible"   BOOLEAN NOT NULL DEFAULT true,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "category"    TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ModuleDefinition_key_key" ON "ModuleDefinition"("key");

-- ──────────────────────────────────────────
-- 4. SiteAuditLog — Journal d'audit admin
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "SiteAuditLog" (
    "id"        TEXT NOT NULL,
    "siteId"    TEXT NOT NULL,
    "actorId"   TEXT NOT NULL,
    "action"    TEXT NOT NULL,
    "details"   JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteAuditLog_siteId_idx"    ON "SiteAuditLog"("siteId");
CREATE INDEX IF NOT EXISTS "SiteAuditLog_actorId_idx"   ON "SiteAuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "SiteAuditLog_createdAt_idx" ON "SiteAuditLog"("createdAt");

ALTER TABLE "SiteAuditLog"
  ADD CONSTRAINT "SiteAuditLog_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SiteAuditLog"
  ADD CONSTRAINT "SiteAuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
