# Pré-analyse BUG-040 — Bac manquant dans la liste des relevés après calibrage

**Date :** 2026-04-19
**Statut : GO AVEC RESERVES**

---

## 1. Validation du diagnostic

### Point 1 — `GET /api/bacs?vagueId` : fallback tout-ou-rien
**VALIDE.** `src/app/api/bacs/route.ts:32-72` retourne uniquement les bacs via `AssignationBac` si `assignations.length > 0`, sinon bascule sur `Bac.vagueId`. Un bac avec `Bac.vagueId = X` mais sans `AssignationBac` active pour X, dans une vague où d'autres bacs ont des assignations actives, est silencieusement masqué.

### Point 2 — `getVagueById` : primaire `Bac.vagueId`
**VALIDE.** `src/lib/queries/vagues.ts:64-66` : `const finalBacs = vague.bacs.length > 0 ? vague.bacs : bacsFromAssignations;`. Symétrique inverse du point 1.

### Point 3 — `createCalibrage` : écriture silencieusement ignorée sur `AssignationBac`
**VALIDE.** `src/lib/queries/calibrages.ts:223-242` — pour les bacs destination non-sources, si `findFirst` AssignationBac renvoie null, aucun `create` n'est effectué.

**Risque additionnel non couvert par le plan initial :** lignes 78 et 99 — les vérifications d'appartenance à la vague passent uniquement par `Bac.vagueId`. Un bac cohérent via `AssignationBac` mais incohérent sur `Bac.vagueId` sera rejeté avec "n'appartient pas à cette vague".

### Point 4 — `cloturerVague` ne nullifie pas `Bac.vagueId`
**INFIRMÉ — DÉJÀ CORRIGÉ.** `src/lib/queries/vagues.ts:231-244` fait bien les deux opérations (nullification + fermeture assignation). Le `bac_04` observé en DB provient d'une version antérieure.

---

## 2. Fichiers à modifier (lignes précises)

| Fichier | Lignes | Modification |
|---------|--------|--------------|
| `src/app/api/bacs/route.ts` | 32-93 | UNION des deux sources, déduplication par `id` |
| `src/lib/queries/vagues.ts` | 59-71 | `getVagueById` : UNION |
| `src/lib/queries/vagues.ts` | 118-121 | `getVagueByIdWithReleves` : UNION |
| `src/lib/queries/calibrages.ts` | 77-105 | Vérification d'appartenance via `Bac.vagueId` OR `AssignationBac` |
| `src/lib/queries/calibrages.ts` | 223-242 | `create` défensif si `assignationDest === null` |

## 3. Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `prisma/migrations/<timestamp>_backfill_assignation_bac/migration.sql` | Backfill AssignationBac manquantes |
| `src/__tests__/api/bacs-vague-union.test.ts` | Test non-régression UNION |

## 4. Risques de régression

**Callers `getVagueById`** (verront plus de bacs retournés) :
- `src/app/api/vagues/[id]/route.ts:18`
- `src/app/api/export/vague/[id]/route.ts:33`
- `src/app/vagues/[id]/calibrage/nouveau/page.tsx:30`
- `src/app/vagues/[id]/calibrages/page.tsx:30`
- `src/components/pages/vague-detail-page.tsx:52`

**Callers `/api/bacs?vagueId`** :
- `src/services/bac.service.ts:36`
- `src/services/vague.service.ts:95`

**Non-impactés :**
- `/api/bacs/by-vague-releves` et `getBacsAvecRelevesPourVague` (logique indépendante)

## 5. Tests à adapter
- Aucun test existant couvre `GET /api/bacs?vagueId=X` → création d'un nouveau test nécessaire.
- Tests mockant `prisma.assignationBac` (vagues-remove-bac.test.ts, api/vagues.test.ts, api/vagues-distribution.test.ts) ne devraient pas régresser.

## 6. État actuel
- Build Next.js : OK
- Tests : 4917/4918 passent — 1 échec préexistant dans `sites.test.ts` (hors scope BUG-040)

## 7. Décision : GO AVEC RÉSERVES BLOQUANTES

**Réserve 1 (bloquante) :** le fix doit couvrir la vérification d'appartenance dans `createCalibrage` (lignes 78 et 99), sinon le bug réapparaît sous forme d'erreur "bac n'appartient pas à cette vague".

**Réserve 2 (bloquante) :** la migration SQL de backfill est nécessaire pour résoudre les données déjà incohérentes.

**Réserve 3 (recommandée, non bloquante) :** `removeBacs` (`src/lib/queries/vagues.ts:374`) lit `bac.nombrePoissons` sans fallback AssignationBac → potentiellement stale. À corriger dans un patch séparé.
