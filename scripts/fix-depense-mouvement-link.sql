-- =============================================================================
-- Script: Liaison Depense <-> MouvementStock + création dépenses manquantes
-- Date: 2026-05-18
-- =============================================================================
-- Problème: 328 500 F d'écart entre coûts production et dépenses
--   1. CMD-2026-005 (LIVREE, 103 500F): mouvements ENTREE sans dépense
--   2. Aliments Perla (225 000F): mouvement ENTREE ancien sans dépense
-- + Liaison de tous les mouvements ENTREE existants à leur dépense respective
-- =============================================================================

BEGIN;

-- =============================================
-- PARTIE 1: Créer la dépense pour CMD-2026-005
-- =============================================
INSERT INTO "Depense" (
  id, numero, description, "categorieDepense", "montantTotal", "montantPaye", "montantFraisSupp",
  statut, date, "commandeId", "userId", "siteId", "createdAt", "updatedAt"
) VALUES (
  'fix_dep_cmd005',
  'DEP-2026-043',
  'Réception CMD-2026-005 — MAVECAM (Aliment DIBAC 3mm + 4,5mm)',
  'ALIMENT',
  103500,
  0,
  0,
  'NON_PAYEE',
  '2026-04-03 00:00:00',
  'cmndqq3vn000004l4px3vmmkj',
  'cmmn1ncrr000004lhbavr0jxs',
  'cmmmxjqll000004l2vd7crswl',
  NOW(),
  NOW()
);

-- Lignes de détail pour CMD-2026-005
INSERT INTO "LigneDepense" (id, "depenseId", designation, "categorieDepense", quantite, "prixUnitaire", "montantTotal", "produitId", "siteId", "createdAt", "updatedAt")
VALUES
  ('fix_ld_cmd005_1', 'fix_dep_cmd005', 'Aliment DIBAC 3mm', 'ALIMENT', 2, 21000, 42000, 'cmmtndf9k000704ierkf9m79h', 'cmmmxjqll000004l2vd7crswl', NOW(), NOW()),
  ('fix_ld_cmd005_2', 'fix_dep_cmd005', 'Aliment DIBAC 4,5mm', 'ALIMENT', 3, 20500, 61500, 'cmmtnefm3000804ieuy7r5ssx', 'cmmmxjqll000004l2vd7crswl', NOW(), NOW());

-- =============================================
-- PARTIE 2: Créer la dépense pour Aliments Perla (225 000F)
-- =============================================
INSERT INTO "Depense" (
  id, numero, description, "categorieDepense", "montantTotal", "montantPaye", "montantFraisSupp",
  statut, date, "userId", "siteId", "createdAt", "updatedAt"
) VALUES (
  'fix_dep_perla',
  'DEP-2026-044',
  'Achat direct Aliments 1.1-1.3 Perla (75 sacs)',
  'ALIMENT',
  225000,
  0,
  0,
  'NON_PAYEE',
  '2026-03-16 00:00:00',
  'cmmnkbxot000004jog91w1bdo',
  'cmmmxjqll000004l2vd7crswl',
  NOW(),
  NOW()
);

-- Ligne de détail
INSERT INTO "LigneDepense" (id, "depenseId", designation, "categorieDepense", quantite, "prixUnitaire", "montantTotal", "produitId", "siteId", "createdAt", "updatedAt")
VALUES (
  'fix_ld_perla_1', 'fix_dep_perla', 'Aliments 1.1-1.3 Perla', 'ALIMENT', 75, 3000, 225000, 'cmmq59bu6000404jrw4xhj31m', 'cmmmxjqll000004l2vd7crswl', NOW(), NOW()
);

-- =============================================
-- PARTIE 3: Lier mouvements ENTREE commande → dépense commande
-- =============================================

-- CMD-2026-001 → DEP-2026-001
UPDATE "MouvementStock" SET "depenseId" = 'cmmtsqrm4000204jvzj2eh6ck'
WHERE id IN ('cmmtsqq9w000004jvta4g4bsc', 'cmmtsqqep000104jvw78zlav4');

-- CMD-2026-002 → DEP-2026-002
UPDATE "MouvementStock" SET "depenseId" = 'cmmtsyjt4000504ibcg6fxhla'
WHERE id IN ('cmmtsyj3x000304ibmvtx40av', 'cmmtsyj8m000404ibfki2raxw');

-- CMD-2026-003 → DEP-2026-009
UPDATE "MouvementStock" SET "depenseId" = 'cmnhuhgk7000301rzozoprlz4'
WHERE id IN ('cmnhuhgje000001rzk96zlgop', 'cmnhuhgjq000101rzpsezh727', 'cmnhuhgjs000201rz011j0rdk');

-- CMD-2026-005 → DEP-2026-043 (nouvelle dépense)
UPDATE "MouvementStock" SET "depenseId" = 'fix_dep_cmd005'
WHERE id IN ('cmnj0uhkm000801qmlmjs0ob9', 'cmnj0uhks000901qmah9vhmn7');

-- CMD-2026-008 → DEP-2026-015
UPDATE "MouvementStock" SET "depenseId" = 'cmnoojvyu000101o9cjac4oky'
WHERE id = 'cmnoojvy2000001o94t09mahs';

-- CMD-2026-006 → DEP-2026-016
UPDATE "MouvementStock" SET "depenseId" = 'cmnoxjfy0000201qr8zuld6ps'
WHERE id IN ('cmnoxjfxe000001qrtxgrwhi6', 'cmnoxjfxp000101qrrstv8twa');

-- CMD-2026-010 → DEP-2026-017
UPDATE "MouvementStock" SET "depenseId" = 'cmnoxyomx000501qr9lvlwekh'
WHERE id IN ('cmnoxyomj000301qrswwrs4hj', 'cmnoxyomp000401qrrdow64x1');

-- CMD-2026-012 → DEP-2026-018
UPDATE "MouvementStock" SET "depenseId" = 'cmnpzdcwo000101mmbqcd5lp9'
WHERE id = 'cmnpzdcvz000001mm6e5bnwgx';

-- CMD-2026-011 → DEP-2026-020
UPDATE "MouvementStock" SET "depenseId" = 'cmnrpz9x4002e01nds18urk07'
WHERE id = 'cmnrpz9wp002d01ndvy8fm5ut';

-- CMD-2026-009 → DEP-2026-021
UPDATE "MouvementStock" SET "depenseId" = 'cmnrpzyul002g01nd8hmv9gwr'
WHERE id = 'cmnrpzyub002f01nd9wfuslne';

-- CMD-2026-013 → DEP-2026-026
UPDATE "MouvementStock" SET "depenseId" = 'cmoacvg1t000a01ph20xwwd10'
WHERE id = 'cmoacvg16000901phvzkdo096';

-- CMD-2026-014 → DEP-2026-030
UPDATE "MouvementStock" SET "depenseId" = 'cmoeshnxu002w01qwyy3ozzf8'
WHERE id = 'cmoeshnx8002v01qww4lducry';

-- CMD-2026-015 → DEP-2026-032
UPDATE "MouvementStock" SET "depenseId" = 'cmom2rf0q009t01qwe10pbu5t'
WHERE id = 'cmom2rf09009s01qwjcxutnhf';

-- CMD-2026-016 → DEP-2026-036
UPDATE "MouvementStock" SET "depenseId" = 'cmosa6zmw001001ufkik862ij'
WHERE id = 'cmow73m5n000201p61l3dh7c5';

-- CMD-2026-017 → DEP-2026-037
UPDATE "MouvementStock" SET "depenseId" = 'cmow7bc1d000b01p6mrr2bywo'
WHERE id = 'cmow7bc0v000a01p6f89tavge';

-- CMD-2026-019 → DEP-2026-038
UPDATE "MouvementStock" SET "depenseId" = 'cmow7bls3000e01p6236uxkeh'
WHERE id IN ('cmow7blru000c01p6vrz5soml', 'cmow7blrw000d01p6zeq3z0zc');

-- CMD-2026-020 → DEP-2026-039
UPDATE "MouvementStock" SET "depenseId" = 'cmoy1t23x000x01p6cokj2e99'
WHERE id = 'cmoy1t22z000w01p67grd0nxc';

-- CMD-2026-022 → DEP-2026-040
UPDATE "MouvementStock" SET "depenseId" = 'cmp44ghrz000c01o1tus51ihk'
WHERE id = 'cmp45gc7l000k01o1bi7l7skv';

-- CMD-2026-023 → DEP-2026-042
UPDATE "MouvementStock" SET "depenseId" = 'cmp57819p000x01o1kzcli6m6'
WHERE id = 'cmp57818v000w01o15tqidczs';

-- =============================================
-- PARTIE 4: Lier mouvements LIBRE → dépense listeBesoins
-- =============================================

-- BES-2026-001 → DEP-2026-003
UPDATE "MouvementStock" SET "depenseId" = 'cmn7cg16q000004jyff858p5w'
WHERE id IN ('cf92b54c-cb4f-4a57-be77-606540f4ef94', '58ed2a60-aa3f-4884-99ab-cab86b149e49', 'db9199fe-2764-4ff3-9ad6-d79d9941efde');

-- BES-2026-002 → DEP-2026-005
UPDATE "MouvementStock" SET "depenseId" = 'cmnfwrbpr000e04jprsat2nyd'
WHERE id = '9761dee7-f357-4083-a4f5-3d8de548676b';

-- BES-2026-007 → DEP-2026-006
UPDATE "MouvementStock" SET "depenseId" = 'cmnfx1idy000004kyii4dfx2f'
WHERE id = 'd06d22b2-36d6-469c-916e-a2afe10aa84d';

-- BES-2026-008 → DEP-2026-007
UPDATE "MouvementStock" SET "depenseId" = 'cmng5kk8b000204kw0up55qr9'
WHERE id = '6da63c13-0699-4022-85b0-c0d7a1934baa';

-- BES-2026-010 → DEP-2026-010
UPDATE "MouvementStock" SET "depenseId" = 'cmnitwd0d000j01u8z8j19q0k'
WHERE id IN ('b2e7664f-c5c1-40f9-bb97-f94d632f0da0', 'a13987f2-1415-4f1d-80aa-8636e8e6c9b2');

-- BES-2026-011 → DEP-2026-011
UPDATE "MouvementStock" SET "depenseId" = 'cmniu2vo9000201qma8ee6ofb'
WHERE id = 'e138b6ef-e083-4e66-b65e-8ca3452231aa';

-- BES-2026-012 → DEP-2026-014
UPDATE "MouvementStock" SET "depenseId" = 'cmnly0fk7001h01tjkjynf9h4'
WHERE id = '659af533-a62f-4037-ace2-26eb726c4fb5';

-- BES-2026-018 → DEP-2026-019
UPDATE "MouvementStock" SET "depenseId" = 'cmnraas4s000t01ndcq9qupmv'
WHERE id = '43a092f9-f3e0-4b0a-8b9f-33ca41e81bb0';

-- BES-2026-019 → DEP-2026-022
UPDATE "MouvementStock" SET "depenseId" = 'cmnsxnssg003c01ndoun6yase'
WHERE id IN ('f47c6911-437f-4215-9084-113ed339d152', '790d5986-f976-4400-926e-53049f0f4eb2', '7da29b53-2e63-4549-b37c-d7f6dc7c53cb');

-- BES-2026-016 → DEP-2026-023
UPDATE "MouvementStock" SET "depenseId" = 'cmnsxu1v9003i01nd67znahay'
WHERE id = 'b85883ff-e1f4-46cd-8cf7-0d700e3f66f7';

-- BES-2026-017 → DEP-2026-024
UPDATE "MouvementStock" SET "depenseId" = 'cmnsxy0x5003n01nd76saar2v'
WHERE id = '2ef9b59a-498a-4544-adcc-e0ace3ca633d';

-- BES-2026-021 → DEP-2026-025
UPDATE "MouvementStock" SET "depenseId" = 'cmnw3q9aa004p01ndexav91wh'
WHERE id IN ('bb4e1515-40ff-4a91-bda2-3cbb720a5640', 'ca13c3ca-c569-4396-a091-d732a5b4963d', '91193e6d-5ef6-4275-8ab3-3c01e91b8525', '9677a172-5d73-4912-9fcd-6d84a47872f9');

-- BES-2026-028 → DEP-2026-027
UPDATE "MouvementStock" SET "depenseId" = 'cmoad0f9b000b01ph72gt4w2d'
WHERE id = '006ee6a2-75fb-4e94-97c2-47d2512c113f';

-- BES-2026-023 → DEP-2026-028
UPDATE "MouvementStock" SET "depenseId" = 'cmob7tuxm000k01phocnz7591'
WHERE id IN ('d7f23f1c-4791-4d24-92cf-dcd1ce2542d7', 'd84ba192-8e0c-4f45-bbaf-182fd567fab9', 'e94b286e-d80a-4f30-9ac8-9f78f8883a00', '01293b7a-56bb-4242-a03b-8b06c5a61162', 'ac81acd6-4e47-40e2-920d-61e2d29949e5', '335669a6-7539-43f0-9648-5e5020eafbf4', '1311149a-94f4-4987-b24d-c751a869e333');

-- BES-2026-022 → DEP-2026-029
UPDATE "MouvementStock" SET "depenseId" = 'cmob7xlx9000t01phm1fydmh6'
WHERE id IN ('6f1aac02-cff1-483c-b1b0-eeb8a60f00d5', 'ea09b6fe-52ab-4575-8882-e23729bfb913');

-- BES-2026-033 → DEP-2026-031
UPDATE "MouvementStock" SET "depenseId" = 'cmom2lhi9009l01qwxg0n69bv'
WHERE id = '4c1fbfc5-1c76-4938-b628-7cddca9226ea';

-- BES-2026-030 → DEP-2026-033
UPDATE "MouvementStock" SET "depenseId" = 'cmom2veoi009u01qwyht56tef'
WHERE id = 'a5d1b143-988f-4af7-8a16-6cecdae82623';

-- BES-2026-031 → DEP-2026-034
UPDATE "MouvementStock" SET "depenseId" = 'cmom2zla8009z01qwpvliy4ng'
WHERE id = '574b4355-a07a-4904-84ad-df2b2df69c69';

-- BES-2026-038 → DEP-2026-041
UPDATE "MouvementStock" SET "depenseId" = 'cmp45pgsz000o01o1k436ibh8'
WHERE id = 'cmp45pgt6000q01o129zz6ack';

-- Aliments Perla → DEP-2026-044 (nouvelle dépense)
UPDATE "MouvementStock" SET "depenseId" = 'fix_dep_perla'
WHERE id = 'cmmtu7ps8000004jm4rnhmdmj';

-- =============================================
-- PARTIE 5: Vérification
-- =============================================

-- Mouvements ENTREE sans depenseId (devrait être 0)
SELECT COUNT(*) as mouvements_sans_depense
FROM "MouvementStock"
WHERE type = 'ENTREE' AND "depenseId" IS NULL;

-- Comparaison finale
SELECT 'Mouvements ENTREE' as source, SUM("prixTotal") as total
FROM "MouvementStock" WHERE type = 'ENTREE'
UNION ALL
SELECT 'Depenses totales', SUM("montantTotal")
FROM "Depense"
UNION ALL
SELECT 'Depenses manuelles (hors cmd, hors besoins)', SUM("montantTotal")
FROM "Depense" WHERE "commandeId" IS NULL AND "listeBesoinsId" IS NULL;

COMMIT;
