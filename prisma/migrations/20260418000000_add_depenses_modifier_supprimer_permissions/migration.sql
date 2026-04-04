-- AlterEnum: add DEPENSES_SUPPRIMER to Permission enum
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'DEPENSES_SUPPRIMER';

-- Grant DEPENSES_MODIFIER and DEPENSES_SUPPRIMER to all site roles that already have DEPENSES_CREER
INSERT INTO "_SiteRolePermissions" ("A", "B")
SELECT 'DEPENSES_MODIFIER', sr.id
FROM "SiteRole" sr
JOIN "_SiteRolePermissions" srp ON srp."B" = sr.id AND srp."A" = 'DEPENSES_CREER'
ON CONFLICT DO NOTHING;

INSERT INTO "_SiteRolePermissions" ("A", "B")
SELECT 'DEPENSES_SUPPRIMER', sr.id
FROM "SiteRole" sr
JOIN "_SiteRolePermissions" srp ON srp."B" = sr.id AND srp."A" = 'DEPENSES_CREER'
ON CONFLICT DO NOTHING;
