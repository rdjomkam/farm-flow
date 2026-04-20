# Review BUG-040 — Incohérence dual-source AssignationBac / Bac.vagueId

**Date :** 2026-04-19
**Reviewer :** @code-reviewer
**Sévérité :** Haute
**Verdict : APPROUVÉ AVEC RÉSERVES (non bloquantes)**

## Résumé
Les 6 fixes corrigent correctement le bug. R1-R9 respectées. Deux réserves non
bloquantes à tracker dans des tickets séparés.

## Checklist R1-R9

| Règle | Statut | Détail |
|-------|--------|--------|
| R1 Enums MAJUSCULES | OK | `StatutVague.EN_COURS`, `TypeReleve.BIOMETRIE`, etc. |
| R2 Imports enums | OK | `import { StatutVague, … } from "@/types"` utilisé |
| R3 Prisma ↔ TS alignés | OK | Champs `AssignationBac` conformes au schéma (lignes 1197-1222) |
| R4 Atomique | OK | Tout en `prisma.$transaction`, pas de check-then-update |
| R5 DialogTrigger | N/A | Pas d'UI touchée |
| R6 CSS thème | N/A | Pas de style touché |
| R7 Nullabilité | OK | `volume: number \| null`, etc. explicites |
| R8 siteId | OK | Présent dans toutes les requêtes et dans le create défensif |
| R9 Tests avant review | OK | 12/12 + suite 4929/4930 |

## Points conformes
- **Fix 1** : `Promise.all` parallèle, Map déduplication, tri `localeCompare`, `siteId` présent.
- **Fix 4** : `OR: [{ vagueId }, { assignations: { some: { vagueId, dateFin: null } } }]` exhaustif.
- **Fix 5** : `findFirst → null → findUnique → create + update` atomique dans la même transaction.
- **Fix 6** : Migration idempotente via `NOT EXISTS`, gestion correcte de `dateFin` selon statut vague.
- **Tests** : 12 cas couvrant les scénarios essentiels, mocks complets, pas de `any`.
- **Pas de N+1** : O(N) requêtes dans une transaction unique, acceptable pour N petits.

## Réserves (non bloquantes)

### R1 — Incohérence de priorité UNION entre les 3 points
- `/api/bacs?vagueId` : priorité **AssignationBac**
- `getVagueById` / `getVagueByIdWithReleves` : priorité **Bac.vagueId**

Les 3 endpoints retournent le même **ensemble** de bacs (UNION correcte), mais
la valeur retournée peut différer en cas de divergence entre sources. Impact
limité car `getVagueById` ne retourne que `{ id, nom, volume }`.

**Action :** Aligner les commentaires ou uniformiser la priorité dans un patch
dédié.

### R2 — `patchCalibrage` étape 5 non corrigée
`src/lib/queries/calibrages.ts:454` — vérification d'appartenance via
`Bac.vagueId` uniquement, sans clause `OR` AssignationBac. Mêmes symptômes
possibles que le bug initial lors d'une modification de calibrage.

**Action :** Appliquer le Fix 4 symétrique à `patchCalibrage` dans un patch
dédié.

### R3 — Migration SQL : contrainte unique partielle (documentaire)
L'index unique partiel `AssignationBac_bacId_active_unique` sur `bacId WHERE dateFin IS NULL`
pourrait théoriquement être violé si un bac a déjà une assignation active sur
une autre vague. La règle métier exclut ce cas — réserve documentaire.

## Hors scope
- Pré-analyse réserve 3 : `removeBacs` (`vagues.ts:370`) lit `Bac.vagueId` sans
  OR. À traiter si observé en prod.

## Verdict final : **APPROUVÉ**
Le bug BUG-040 est correctement corrigé. Livraison autorisée.

## Actions de suivi (tickets à ouvrir)
1. ~~Aligner/documenter priorité UNION entre `/api/bacs?vagueId` et `getVagueById`.~~ **CLOS** (patch post-review)
2. ~~Appliquer clause `OR` d'appartenance à `patchCalibrage` étape 5.~~ **CLOS** (patch post-review)
3. (Optionnel, non traité) Fallback `AssignationBac.nombrePoissons` dans `removeBacs`.

---

## Patch post-review — Vérification des 2 réserves

**Date :** 2026-04-19
**Verdict : APPROUVÉ**

| Point | Fichier | Statut |
|-------|---------|--------|
| 1. `getVagueById` priorité AssignationBac | `src/lib/queries/vagues.ts:62-68` | CONFORME |
| 2. `getVagueByIdWithReleves` même pattern | `src/lib/queries/vagues.ts:124-128` | CONFORME |
| 3. Commentaires documentant la priorité | ditto | CONFORME |
| 4. `patchCalibrage` clause `OR` symétrique | `src/lib/queries/calibrages.ts:455-461` | CONFORME |
| 5. Les 3 lectures UNION alignées sur AssignationBac | 3 fichiers | CONFORME |

**Couverture tests :** `vagues-union-priority.test.ts` (7 cas) + `calibrages-bug040.test.ts`
section Réserve 2 (1 cas) → 8/8 passent. Suite totale 4937/4938 (échec préexistant
hors scope). Aucune régression.

R1-R9 respectées (pas de `any`, imports d'enums, `siteId` présent, typage strict).

Les 2 actions de suivi sont désormais closes. La 3e (`removeBacs`) reste optionnelle
et n'a pas été traitée — à ouvrir si le comportement est observé en production.

---

## Patch post-review — Action #3 (removeBacs)

**Date :** 2026-04-19
**Verdict : APPROUVÉ**

### Point 1 — Symétrie avec les 3 UNION précédentes
Clause `OR` dans `bacsARetirer` (`vagues.ts:376-379`) et `bacDestination` (`vagues.ts:413-416`) identique au pattern `createCalibrage`/`patchCalibrage`. `include: { assignations: { where: { vagueId, dateFin: null }, take: 1 } }` cohérent avec les corrections antérieures.

### Point 2 — Clause OR syntaxe identique
`OR: [{ vagueId: id }, { assignations: { some: { vagueId: id, dateFin: null } } }]` — `siteId` présent dans les deux `where`.

### Point 3 — Lecture `nombrePoissons` prioritaire AssignationBac
`vagues.ts:398-399` et `:432-433` : `AssignationBac.nombrePoissons ?? Bac.nombrePoissons ?? 0`. Dual-write de transfert et relevés COMPTAGE utilisent les valeurs correctes.

### Point 4 — R1-R9
Toutes respectées : enums depuis `@/types`, `siteId` partout, nullabilité explicite, atomique, pas de `any`.

### Point 5 — Pas d'effet de bord
`updateMany` de fermeture (lignes 477-491) et boucle `activite.updateMany` (lignes 494-498) intacts.

### Couverture tests
2 cas dans `src/__tests__/vagues-remove-bac-bug040.test.ts` : clause OR + fermeture assignation (Cas 1) ; calcul de transfert prioritaire AssignationBac avec dual-write à 230 (Cas 2). Suite totale 4939/4940.

**L'action #3 est close. Les 3 actions de suivi de BUG-040 sont toutes closes.**
