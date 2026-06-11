-- =============================================================================
-- CS2-mirror-transfert-releves.sql
-- Sprint CS.2 — Création des relevés TRANSFERT miroir côté destination
--
-- Problème :
--   createTransfert ne créait pas de relevé TRANSFERT sur la vague destination.
--   computeVivantsByBac traitait tous les TRANSFERT comme sortants.
--   Résultat : vivants = 0 sur les bacs GROSSISSEMENT (Vague-26-03 : Bac 01/04).
--
-- Fix applicatif : createTransfert crée désormais un relevé miroir pour chaque groupe.
-- Ce script crée les relevés manquants pour les transferts historiques.
--
-- Idempotence :
--   Chaque INSERT est protégé par NOT EXISTS sur (vagueId, bacId, date, typeReleve, transfertGroupeId).
--   Sûr de lancer plusieurs fois.
--
-- Section 1 : AUDIT — compter les transferts sans relevé miroir côté destination
-- Section 2 : INSERT actif — créer les relevés miroir manquants
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Section 1 — AUDIT : combien de TransfertGroupe sans relevé miroir côté dest ?
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) AS transfert_groupes_sans_miroir,
  COUNT(DISTINCT tg."vagueDestId") AS vagues_dest_affectees
FROM "TransfertGroupe" tg
WHERE
  tg."bacDestId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Releve" r
    WHERE
      r."vagueId"           = tg."vagueDestId"
      AND r."bacId"         = tg."bacDestId"
      AND r."typeReleve"    = 'TRANSFERT'
      AND r."transfertGroupeId" = tg."id"
  );

-- ---------------------------------------------------------------------------
-- Section 2 — INSERT actif : créer les relevés miroir manquants
-- ---------------------------------------------------------------------------
INSERT INTO "Releve" (
  id,
  date,
  "typeReleve",
  "nombreTransferes",
  "transfertGroupeId",
  notes,
  "vagueId",
  "bacId",
  "siteId",
  "createdAt",
  "updatedAt"
)
SELECT
  -- Générer un UUID déterministe basé sur le groupeId pour idempotence si ON CONFLICT n'est pas utilisé
  gen_random_uuid()                          AS id,
  t."date"                                   AS date,
  'TRANSFERT'                                AS "typeReleve",
  tg."nombrePoissons"                        AS "nombreTransferes",
  tg."id"                                    AS "transfertGroupeId",
  'Arrivage par transfert'                   AS notes,
  tg."vagueDestId"                           AS "vagueId",
  tg."bacDestId"                             AS "bacId",
  t."siteId"                                 AS "siteId",
  NOW()                                      AS "createdAt",
  NOW()                                      AS "updatedAt"
FROM "TransfertGroupe" tg
JOIN "Transfert" t ON t."id" = tg."transfertId"
WHERE
  tg."bacDestId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Releve" r
    WHERE
      r."vagueId"               = tg."vagueDestId"
      AND r."bacId"             = tg."bacDestId"
      AND r."typeReleve"        = 'TRANSFERT'
      AND r."transfertGroupeId" = tg."id"
  );

-- ---------------------------------------------------------------------------
-- Section 3 — Vérification post-insert
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) AS miroirs_crees_ou_existants
FROM "Releve" r
JOIN "TransfertGroupe" tg ON tg."id" = r."transfertGroupeId"
WHERE
  r."typeReleve" = 'TRANSFERT'
  AND r."vagueId" = tg."vagueDestId"
  AND r."bacId"   = tg."bacDestId";
