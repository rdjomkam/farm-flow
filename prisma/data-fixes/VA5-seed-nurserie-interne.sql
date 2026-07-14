-- VA5 — Client système "Nurserie interne" par site
-- Sprint : VA (Vente d'Alevins depuis vague PG)
-- Date   : 2026-07-15
--
-- Contexte :
--   Sprint VA permet de vendre les reliquats d'une vague PRE_GROSSISSEMENT
--   comme alevins. Un client destinataire est requis. Pour les cas de
--   "retour à la nurserie interne" (poissons non vendus à un client externe
--   mais retournés au stock interne), il faut un client système par défaut.
--
-- Stratégie :
--   Pour CHAQUE site existant, créer (si absent) un client "Nurserie interne"
--   avec isSysteme=true, id déterministe "nurserie-interne-{siteId}".
--   Idempotent via ON CONFLICT (id) DO NOTHING.
--
-- IMPORTANT : à exécuter APRÈS la migration Prisma qui ajoute Client.isSysteme.

-- ===========================================================================
-- SECTION 1 — Audit (avant) : sites sans client système
-- ===========================================================================

SELECT s.id, s.name
FROM "Site" s
WHERE NOT EXISTS (
  SELECT 1 FROM "Client" c WHERE c."siteId" = s.id AND c."isSysteme" = true
)
ORDER BY s.name;

-- ===========================================================================
-- SECTION 2 — Seed idempotent
-- ===========================================================================

BEGIN;

INSERT INTO "Client" (id, nom, telephone, email, adresse, "isActive", "isSysteme", "siteId", "createdAt", "updatedAt")
SELECT
  'nurserie-interne-' || s.id,
  'Nurserie interne',
  NULL,
  NULL,
  NULL,
  true,
  true,
  s.id,
  NOW(),
  NOW()
FROM "Site" s
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ===========================================================================
-- SECTION 3 — Vérification (après)
-- ===========================================================================

SELECT s.name, c.nom, c."isSysteme"
FROM "Site" s
LEFT JOIN "Client" c ON c."siteId" = s.id AND c."isSysteme" = true
ORDER BY s.name;
