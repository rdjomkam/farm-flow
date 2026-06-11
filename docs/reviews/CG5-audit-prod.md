# CG5 — Audit prod data + migration
**Date** : 2026-06-11
**Sprint** : CG (Conservation Garantie)
**Agent** : @db-specialist

---

## Section A — Audit `bacDestId IS NULL` (CG.2)

### Orphelins trouvés

```sql
SELECT COUNT(*) AS orphelins FROM "TransfertGroupe" WHERE "bacDestId" IS NULL;
-- orphelins = 0
```

**Résultat : 0 orphelin.**

Le `repair_vague_26_03.sql` avait déjà couvert les 2 orphelins identifiés lors du sprint CG.2. Aucun UPDATE nécessaire dans cette story.

### Décision

Aucune action requise. La base prod est propre sur ce point.

---

## Section B — Audit `dateAssignation` désaligné (CG.4)

### Résumé global (avant correction)

| Source | Nb écarts |
|--------|-----------|
| calibrage | 7 |
| transfert | 0 |
| arrivage | 0 |

### Détail des 7 écarts calibrage

| assignation_id | Bac | Vague | Date avant (erronée) | Date calibrage (correcte) | Écart (h) |
|----------------|-----|-------|----------------------|---------------------------|-----------|
| cmplbgkjb002q01mvn6ygy22p | Bac 06 | Vague 26-02 | 2026-05-25 14:43:27 | 2026-05-23 15:01:00 | 47.71 |
| cmo477xr8000901prn9tgp4i2 | Bac 07 | Vague 26-01 | 2026-04-18 10:32:58 | 2026-04-18 09:30:00 | 1.05 |
| cmppebmih001y01p3ebx4h7fu | Bac 08 | Vague-26-03-Prep | 2026-05-28 11:14:39 | 2026-05-25 21:15:00 | 61.99 |
| cmplbjj1p002r01mv3swbl47o | Bac 09 | Vague 26-02 | 2026-05-25 14:45:45 | 2026-05-23 15:01:00 | 47.75 |
| cmplbjr3m002s01mvizguc50x | Bac 10 | Vague 26-02 | 2026-05-25 14:45:55 | 2026-05-23 15:01:00 | 47.75 |
| cmq7xoce100dj01mr21adz19t | Bac 11 | Vague-26-03-Prep | 2026-06-10 10:36:17 | 2026-06-09 11:39:00 | 22.95 |
| cmq7xpnk900dk01mrsx99m3qd | Bac 12 | Vague-26-03-Prep | 2026-06-10 10:37:18 | 2026-06-09 11:39:00 | 22.97 |

### Vérification ambiguïté

Chaque assignation correspond à exactement **1 calibrage** — aucune ambiguïté. Correction appliquée sans risque.

### Hashes MD5 avant correction (audit trail)

| id | Bac | dateAssignation avant | hash_avant |
|----|-----|----------------------|------------|
| cmplbgkjb002q01mvn6ygy22p | Bac 06 | 2026-05-25 14:43:27.094 | d1028d8b0a7cdea8e1374d48e14c32d9 |
| cmo477xr8000901prn9tgp4i2 | Bac 07 | 2026-04-18 10:32:58.531 | e26d97446c15a06f4c291dc2e4871d5b |
| cmppebmih001y01p3ebx4h7fu | Bac 08 | 2026-05-28 11:14:39.929 | eef17e880b6978f013a087a031502471 |
| cmplbjj1p002r01mv3swbl47o | Bac 09 | 2026-05-25 14:45:45.132 | 38d442bb7e5ff9149ffa744a461328bc |
| cmplbjr3m002s01mvizguc50x | Bac 10 | 2026-05-25 14:45:55.57 | 753128fcf4e6587f652f0cea73d0a254 |
| cmq7xoce100dj01mr21adz19t | Bac 11 | 2026-06-10 10:36:17.208 | f0cdadec548287f7a79bc008d1806269 |
| cmq7xpnk900dk01mrsx99m3qd | Bac 12 | 2026-06-10 10:37:18.345 | 42be2a827b5d607b75967bf3d750a532 |

### UPDATE appliqué (transaction)

```sql
BEGIN;

UPDATE "AssignationBac" ab
SET "dateAssignation" = c.date
FROM "CalibrageGroupe" cg
JOIN "Calibrage" c ON c.id = cg."calibrageId"
WHERE cg."destinationBacId" = ab."bacId"
  AND c."vagueId" = ab."vagueId"
  AND c."siteId" = ab."siteId"
  AND ab."dateAssignation" > c.date + INTERVAL '1 hour'
  AND ab."dateFin" IS NULL;

-- UPDATE 7

COMMIT;
```

### Hashes MD5 après correction

| id | Bac | dateAssignation apres | hash_apres |
|----|-----|----------------------|------------|
| cmplbgkjb002q01mvn6ygy22p | Bac 06 | 2026-05-23 15:01:00 | e2f9e769c7fc272f8d011e02131364f0 |
| cmo477xr8000901prn9tgp4i2 | Bac 07 | 2026-04-18 09:30:00 | 24fb635eec1ebc2ac380f3011f8c1abd |
| cmppebmih001y01p3ebx4h7fu | Bac 08 | 2026-05-25 21:15:00 | 6deddd4b4fa155a4a32c94d7f23103c7 |
| cmplbjj1p002r01mv3swbl47o | Bac 09 | 2026-05-23 15:01:00 | 72ee57e7d5c18011ced6adec1b4c9369 |
| cmplbjr3m002s01mvizguc50x | Bac 10 | 2026-05-23 15:01:00 | 40d99562f7e9136d8b6c188ecb1b6a1d |
| cmq7xoce100dj01mr21adz19t | Bac 11 | 2026-06-09 11:39:00 | 127365adb6527ac79cf76f06c4421c64 |
| cmq7xpnk900dk01mrsx99m3qd | Bac 12 | 2026-06-09 11:39:00 | 808fa7cf8e05ea7dc35a5b8d372cb713 |

### Vérification post-fix

```sql
SELECT COUNT(*) AS ecarts_restants
FROM "AssignationBac" ab
JOIN "CalibrageGroupe" cg ON ...
WHERE ab."dateAssignation" > c.date + INTERVAL '1 hour'
  AND ab."dateFin" IS NULL;
-- ecarts_restants = 0
```

**Résultat : 0 écart restant. Correction complète.**

---

## Section C — Validation Vague-26-03-Prep et Vague-26-03

### Vague-26-03-Prep (id: cmplrrba6000101qwazzjca26)

| Bac | nombrePoissons | dateAssignation |
|-----|---------------|-----------------|
| Bac 08 | 263 | 2026-05-25 21:15:00 |
| Bac 11 | 224 | 2026-06-09 11:39:00 |
| Bac 12 | 449 | 2026-06-09 11:39:00 |
| **Total** | **936** | |

**Attendu : 936 vivants. CONFORME.**

### Vague-26-03 (id: cmq7xf8yv00d501mrpwk94ler)

| Bac | nombrePoissons |
|-----|---------------|
| Bac 01 | 3520 |
| Bac 04 | 1980 |
| **Total** | **5500** |

**Attendu : 5500 vivants (= nombreInitial). CONFORME. Pas de régression.**

### Occupation globale des bacs (snapshot 2026-06-11)

| Bac | Vague | Vivants | dateAssignation |
|-----|-------|---------|-----------------|
| Bac 01 | Vague-26-03 | 3520 | 2026-06-10 10:29:12 |
| Bac 03 | Vague 26-02 | 1100 | 2026-04-23 |
| Bac 04 | Vague-26-03 | 1980 | 2026-06-10 10:29:12 |
| Bac 06 | Vague 26-02 | 1084 | 2026-05-23 15:01:00 |
| Bac 07 | Vague 26-01 | 129 | 2026-04-18 09:30:00 |
| Bac 08 | Vague-26-03-Prep | 263 | 2026-05-25 21:15:00 |
| Bac 09 | Vague 26-02 | 2543 | 2026-05-23 15:01:00 |
| Bac 10 | Vague 26-02 | 393 | 2026-05-23 15:01:00 |
| Bac 11 | Vague-26-03-Prep | 224 | 2026-06-09 11:39:00 |
| Bac 12 | Vague-26-03-Prep | 449 | 2026-06-09 11:39:00 |

---

## Section D — Préconisations

### Migration `bacDestId NOT NULL` — GO

**Prérequis validé :** 0 orphelin `bacDestId IS NULL` en prod.

La migration peut être lancée lors du prochain sprint dédié au schema. Commande à exécuter dans un commit isolé :

```bash
npx prisma migrate dev --name CG2_bacdest_not_null
```

Cela génèrera une migration SQL du type :
```sql
ALTER TABLE "TransfertGroupe" ALTER COLUMN "bacDestId" SET NOT NULL;
```

**Recommandation :** isoler dans un commit après la clôture du sprint CG, ne pas l'inclure dans les stories CG.1-CG.4.

### Bac 11 — Historique "résurrection" normal

L'historique Bac 11 montre :
1. AssignationBac `cmplrrbac000201qw3lq7khdr` : 5000 poissons, du 25 mai au 28 mai 2026 (fermeture lors du calibrage vers Bac 08)
2. AssignationBac `cmq7xoce100dj01mr21adz19t` : 224 poissons, depuis le 9 juin (réaffectation après calibrage)

Le Bac 11 a été libéré puis réaffecté — c'est un comportement métier normal. Pas d'incohérence.

**Après le fix CG.4, la dateAssignation du 9 juin est maintenant 2026-06-09 11:39:00 (date du calibrage) au lieu de 2026-06-10 10:36:17 (new Date()). La fenêtre d'alimentation du 9 juin est maintenant correctement couverte.**

### Bac 05 — Toujours libre

Deux assignations historiques (Vague-26-02-Dibac et Vague-26-03-Prep), toutes deux fermées. `dateFin IS NOT NULL` dans les deux cas. Bac 05 actuellement vide — normal.

### Autres incohérences détectées

Aucune autre incohérence détectée lors de l'audit.

---

## Résumé exécutif

| Point | Résultat |
|-------|---------|
| Orphelins `bacDestId IS NULL` (CG.2) | **0** — déjà couverts par repair_vague_26_03.sql |
| Écarts `dateAssignation` calibrage corrigés (CG.4) | **7** lignes mises à jour |
| Écarts `dateAssignation` transfert | 0 |
| Écarts `dateAssignation` arrivage | 0 |
| Vague-26-03-Prep vivants | **936** (attendu 936) — CONFORME |
| Vague-26-03 vivants | **5500** (attendu 5500) — CONFORME |
| Migration `bacDestId NOT NULL` | **GO** — prête à lancer |
