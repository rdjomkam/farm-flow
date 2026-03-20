-- Migration 6: add_notification_severity_index
-- Adds composite index on Notification(siteId, severite, statut) for efficient alert queries

CREATE INDEX "Notification_siteId_severite_statut_idx" ON "Notification"("siteId", "severite", "statut");
