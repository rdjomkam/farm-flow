-- Migration: add_feature_flags
-- ADR-maintenance-mode: FeatureFlag + PlatformAuditLog

-- CreateTable FeatureFlag
CREATE TABLE "FeatureFlag" (
  "key"       TEXT NOT NULL,
  "enabled"   BOOLEAN NOT NULL DEFAULT false,
  "value"     JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "FeatureFlag_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable PlatformAuditLog
CREATE TABLE "PlatformAuditLog" (
  "id"        TEXT NOT NULL,
  "actorId"   TEXT NOT NULL,
  "action"    TEXT NOT NULL,
  "details"   JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformAuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlatformAuditLog_actorId_idx" ON "PlatformAuditLog"("actorId");
CREATE INDEX "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt");

-- Seed: MAINTENANCE_MODE flag (disabled by default)
INSERT INTO "FeatureFlag" ("key", "enabled", "updatedAt")
VALUES ('MAINTENANCE_MODE', false, NOW())
ON CONFLICT ("key") DO NOTHING;
