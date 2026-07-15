-- Migration : seed du client système "Nurserie interne" pour chaque site
-- Sprint VA (VA.5 followup — le seed doit être une migration Coolify)
--
-- Dépend de : 20260715120000_add_client_is_systeme (Client.isSysteme)
--
-- Idempotent : ON CONFLICT (id) DO NOTHING. L'id est déterministe
-- ("nurserie-interne-{siteId}") pour garantir un seul enregistrement par site
-- même si la migration est rejouée.
--
-- Les nouveaux sites créés après cette migration reçoivent leur client via
-- createSite() (src/lib/queries/sites.ts) — ce seed sert uniquement à
-- backfiller les sites existants au moment du déploiement.

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
