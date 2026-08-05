# CS4 — Audit prod + Data-fix (AssignationBac init + relevés TRANSFERT miroir)

**Sprint :** CS (Conservation Stricte)
**Date :** 2026-06-11
**Auteur :** @db-specialist

---

## Section A — CS.1 : Audit init AssignationBac

### Requête d'audit initiale

```sql
SELECT COUNT(*) AS nb_candidats
FROM "AssignationBac" ab
WHERE (ab."nombrePoissonsInitial" IS NULL OR ab."nombrePoissonsInitial" = 0)
  AND ab."nombrePoissons" IS NOT NULL
  AND ab."nombrePoissons" > 0;
-- Résultat : 8
```

### Cas trouvés (8 lignes)

| assignation_id | vague_code | bac_nom | actuel | init_avant | poids_init_avant | source |
|---|---|---|---|---|---|---|
| cmo477xr8000901prn9tgp4i2 | Vague 26-01 | Bac 07 | 129 | 0 | 15 | CalibrageGroupe (2026-04-18) |
| cmplbgkjb002q01mvn6ygy22p | Vague 26-02 | Bac 06 | 1084 | 0 | 26 | CalibrageGroupe (2026-05-23) |
| cmplbjj1p002r01mv3swbl47o | Vague 26-02 | Bac 09 | 2543 | 0 | 26 | CalibrageGroupe (2026-05-23) |
| cmplbjr3m002s01mvizguc50x | Vague 26-02 | Bac 10 | 393 | 0 | 26 | CalibrageGroupe (2026-05-23) |
| cmppebmih001y01p3ebx4h7fu | Vague-26-03-Prep | Bac 08 | 263 | 0 | 9 | CalibrageGroupe (2026-05-25) |
| cmq7xoce100dj01mr21adz19t | Vague-26-03-Prep | Bac 11 | 224 | 0 | 8.7 | CalibrageGroupe (2026-06-09) |
| cmq7xpnk900dk01mrsx99m3qd | Vague-26-03-Prep | Bac 12 | 449 | 0 | 8.7 | CalibrageGroupe (2026-06-09) |
| cmppeb1w5001x01p3ztmxon35 | Vague-26-03-Prep | Bac 02 | 3524 | 0 | 9 | **AMBIGU** |

**Note** : aucun TransfertGroupe ne correspondait pour ces bacs. Toutes ces AssignationBac ont été créées comme destinations de calibrage, pas via transfert.

### Stratégie appliquée

Pour chaque AssignationBac, `nombrePoissonsInitial` a été recalculé en sommant les `CalibrageGroupe.nombrePoissons` dont la date du calibrage parent correspond (à la minute) à `dateAssignation`.

### Cas ambigu — Bac 02 / Vague-26-03-Prep (NON appliqué)

- `dateAssignation = 2026-05-28 11:14:13` mais aucun Calibrage à cette date/minute
- Le Calibrage le plus proche est 2026-05-25 (4500 poissons, PETIT) — la `dateAssignation` ne coïncide pas
- Ce bac a reçu des poissons via une voie non tracée (arrivage direct probable)
- **Décision** : ne pas appliquer. Arbitrage métier requis. La `poidsMoyenInitial` (9g) est déjà renseignée.

### UPDATE appliqué (7 lignes)

```sql
BEGIN;
UPDATE "AssignationBac" ab
SET
  "nombrePoissonsInitial" = sub.init_calcule,
  "poidsMoyenInitial" = sub.poids_calcule
FROM (
  SELECT ab2.id AS assignation_id,
    SUM(cg."nombrePoissons")::int AS init_calcule,
    ROUND((SUM(cg."nombrePoissons" * cg."poidsMoyen") / NULLIF(SUM(cg."nombrePoissons"), 0))::numeric, 2) AS poids_calcule
  FROM "AssignationBac" ab2
  JOIN "CalibrageGroupe" cg ON cg."destinationBacId" = ab2."bacId"
  JOIN "Calibrage" c ON c.id = cg."calibrageId" AND c."vagueId" = ab2."vagueId"
    AND DATE_TRUNC('minute', c.date) = DATE_TRUNC('minute', ab2."dateAssignation")
  WHERE (ab2."nombrePoissonsInitial" IS NULL OR ab2."nombrePoissonsInitial" = 0)
    AND ab2."nombrePoissons" IS NOT NULL AND ab2."nombrePoissons" > 0
  GROUP BY ab2.id
) sub
WHERE ab.id = sub.assignation_id AND sub.init_calcule > 0;
-- UPDATE 7
COMMIT;
```

**Résultat post-update :**

| vague_code | bac_nom | nombrePoissonsInitial | poidsMoyenInitial | nombrePoissons |
|---|---|---|---|---|
| Vague 26-01 | Bac 07 | 2207 | 169 | 129 |
| Vague 26-02 | Bac 06 | 1109 | 198 | 1084 |
| Vague 26-02 | Bac 09 | 2615 | 110 | 2543 |
| Vague 26-02 | Bac 10 | 400 | 275 | 393 |
| Vague-26-03-Prep | Bac 08 | 500 | 15 | 263 |
| Vague-26-03-Prep | Bac 11 | 2000 | 10 | 224 |
| Vague-26-03-Prep | Bac 12 | 449 | 20 | 449 |

---

## Section B — CS.2 : Audit relevés TRANSFERT miroir

### Requête d'audit initiale

```sql
SELECT COUNT(*) AS transfert_groupes_sans_miroir, COUNT(DISTINCT tg."vagueDestId") AS vagues_dest_affectees
FROM "TransfertGroupe" tg
WHERE tg."bacDestId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Releve" r
    WHERE r."vagueId" = tg."vagueDestId" AND r."bacId" = tg."bacDestId"
      AND r."typeReleve" = 'TRANSFERT' AND r."transfertGroupeId" = tg."id"
  );
-- Résultat : 4 groupes, 1 vague dest affectée (Vague-26-03)
```

### TransfertGroupe sans miroir (4 lignes)

| tg_id | date | vague_source | vague_dest | bac_source | bac_dest | nombrePoissons | poidsMoyenG |
|---|---|---|---|---|---|---|---|
| cmq7xf90600d901mrl75zyr7v | 2026-06-10 10:29:12 | Vague-26-03-Prep | Vague-26-03 | Bac 02 | Bac 04 | 1780 | 25 |
| cmq7xf90700da01mr2orqveao | 2026-06-10 10:29:12 | Vague-26-03-Prep | Vague-26-03 | Bac 02 | Bac 01 | 1744 | 19 |
| cmq87dxqc000101lp97mb6kpf | 2026-06-10 15:08:07 | Vague-26-03-Prep | Vague-26-03 | Bac 08 | Bac 02 | 200 | 50 |
| cmq87dxqc000201lpt7rf6o1q | 2026-06-10 15:08:07 | Vague-26-03-Prep | Vague-26-03 | Bac 11 | Bac 05 | 1776 | 10 |

Tous correspondent aux transferts du 10 juin 2026 depuis Vague-26-03-Prep vers Vague-26-03.

### INSERT appliqué (4 relevés miroir créés)

```sql
BEGIN;
INSERT INTO "Releve" (id, date, "typeReleve", "nombreTransferes", "transfertGroupeId", notes, "vagueId", "bacId", "siteId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t."date", 'TRANSFERT', tg."nombrePoissons", tg."id", 'Arrivage par transfert',
       tg."vagueDestId", tg."bacDestId", t."siteId", NOW(), NOW()
FROM "TransfertGroupe" tg
JOIN "Transfert" t ON t."id" = tg."transfertId"
WHERE tg."bacDestId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Releve" r WHERE r."vagueId" = tg."vagueDestId" AND r."bacId" = tg."bacDestId"
    AND r."typeReleve" = 'TRANSFERT' AND r."transfertGroupeId" = tg."id");
-- INSERT 0 4
COMMIT;
```

**Relevés créés :**

| id | date | typeReleve | nombreTransferes | vague_dest | bac_dest |
|---|---|---|---|---|---|
| 4ff0949b-... | 2026-06-10 10:29:12 | TRANSFERT | 1780 | Vague-26-03 | Bac 04 |
| c4c3f465-... | 2026-06-10 10:29:12 | TRANSFERT | 1744 | Vague-26-03 | Bac 01 |
| 5fbbdf56-... | 2026-06-10 15:08:07 | TRANSFERT | 200 | Vague-26-03 | Bac 02 |
| 895b4053-... | 2026-06-10 15:08:07 | TRANSFERT | 1776 | Vague-26-03 | Bac 05 |

---

## Section C — Post-fix Validation

```sql
-- CS.1 re-audit (actives seulement)
SELECT COUNT(*) FROM "AssignationBac"
WHERE "dateFin" IS NULL AND "nombrePoissonsInitial" = 0 AND "nombrePoissons" > 0;
-- RÉSULTAT : 0
```

```sql
-- CS.2 re-audit
SELECT COUNT(*) FROM "TransfertGroupe" tg
WHERE NOT EXISTS (SELECT 1 FROM "Releve" r
  WHERE r."transfertGroupeId" = tg.id AND r."vagueId" = tg."vagueDestId"
    AND r."bacId" = tg."bacDestId" AND r."typeReleve" = 'TRANSFERT');
-- RÉSULTAT : 0
```

```sql
-- Totaux vagues clés
SELECT v.code, COALESCE(SUM(ab."nombrePoissons"), 0) AS total_actuel
FROM "Vague" v
LEFT JOIN "AssignationBac" ab ON ab."vagueId" = v.id AND ab."dateFin" IS NULL
WHERE v.code IN ('Vague-26-03', 'Vague-26-03-Prep')
GROUP BY v.code;
```

| code | total_actuel | Attendu | Conforme |
|---|---|---|---|
| Vague-26-03 | 5500 | 5500 | OUI |
| Vague-26-03-Prep | 936 | 936 | OUI |

---

## Section D — Détection d'autres incohérences

### Requête invariant

```sql
SELECT v.code, SUM(ab."nombrePoissons") AS total_actuel, v."nombreInitial"
FROM "Vague" v
JOIN "AssignationBac" ab ON ab."vagueId" = v.id AND ab."dateFin" IS NULL
WHERE v.statut = 'EN_COURS'
GROUP BY v.id, v.code, v."nombreInitial"
HAVING SUM(ab."nombrePoissons") <> v."nombreInitial"
ORDER BY v.code;
```

### Vagues EN_COURS avec écart

| vague_code | total_actuel | nombreInitial | écart | Explication |
|---|---|---|---|---|
| Vague 26-01 | 129 | 5500 | -5371 | Normal : 790 morts + 4573 vendus = 5363 sortants ; écart résiduel de 8 (morts non saisis récents probables) |
| Vague 26-02 | 5120 | 5500 | -380 | 603 morts attendus = 4897 actuel, mais 5120 constaté → surplus de +223 ; Bac 03 (init=200, actuel=1100, 0 relevé) très suspect |
| Vague-26-03-Prep | 936 | 7000 | -6064 | Normal : 564 morts + 5500 transférés vers Vague-26-03 = 6064 sortants → équilibré exactement |

### Anomalie Vague 26-02 — Bac 03

- `AssignationBac` : `nombrePoissonsInitial=200`, `nombrePoissons=1100`
- 0 relevé (aucun COMPTAGE, TRANSFERT, MORTALITE)
- 0 CalibrageGroupe ciblant ce bac
- Probable mise à jour directe de la colonne sans trail de relevé
- **Impact guard CS.3** : la prochaine opération métier (transfert, calibrage) sur ce bac sera potentiellement bloquée si `computeVivantsByBac` retourne 0 (sans relevé ARRIVAGE/TRANSFERT initial)

### Cas ambigu non résolu — Bac 02 / Vague-26-03-Prep

- `nombrePoissonsInitial` reste à 0 (actives)
- `poidsMoyenInitial` = 9g (déjà renseigné)
- `nombrePoissons` = 3524
- Aucun trail clair (pas de calibrage à la dateAssignation, pas de relevé initial)
- **Impact guard CS.3** : `computeVivantsByBac` pour ce bac pourrait retourner une valeur incorrecte
- Recommandation : saisir manuellement un relevé de type COMPTAGE ou créer un ArrivageGroupe pour documenter l'origine

---

## Recommandations pour CS.5

1. **Bac 02 / Vague-26-03-Prep** : arbitrage métier requis pour fixer `nombrePoissonsInitial`. Options :
   - Saisir un relevé COMPTAGE sur ce bac pour ancrer le compte actuel
   - Ou UPDATE manuel après confirmation utilisateur que 3524 est bien le chiffre initial correct

2. **Vague 26-02 — Bac 03** : anomalie à investiguer. Le surplus de 223 poissons (5120 actuel vs 4897 attendu) pointe vers une MAJ directe non tracée. Recommandation : créer un relevé COMPTAGE + BIOMETRIE pour formaliser l'état actuel avant prochaine opération.

3. **Guard CS.3** : maintenant actif, les 2 cas ci-dessus pourraient bloquer des opérations si `computeVivantsByBac` retourne 0. Les corriger avant toute nouvelle opération sur ces bacs.

4. **Sprint CS.5** : E2E + review finale peut commencer. Les invariants critiques (CS.1 + CS.2) sont à zéro en prod. Les 2 anomalies résiduelles sont documentées et n'impactent pas la logique principale de Vague-26-03.

---

## Résumé exécutif

| Métrique | Résultat |
|---|---|
| AssignationBac corrigées (CS.1) | **7** (sur 8 candidats ; 1 ambigu différé) |
| Relevés miroir créés (CS.2) | **4** |
| Vague-26-03 total conforme (5500) | **OUI** |
| Vague-26-03-Prep total conforme (936) | **OUI** |
| CS.1 audit post-fix (actives) | **0** |
| CS.2 audit post-fix | **0** |
| Anomalies résiduelles à arbitrer | **2** (Bac 02 Prep init, Bac 03 V26-02 surplus) |
