# Review Sprint 2 — API Routes et Logique Metier

**Date :** 2026-03-08
**Reviewer :** @code-reviewer
**Stories couvertes :** 2.1 (Calculs), 2.2 (Tests calculs), 2.3 (Queries Prisma), 2.4 (API Routes), 2.5 (Tests API)
**108 tests : tous passent**

---

## Fichiers revus

### Logique metier
- `src/lib/calculs.ts` — 5 fonctions de calcul pures
- `src/lib/queries/bacs.ts` — CRUD bacs + assignation/liberation
- `src/lib/queries/vagues.ts` — CRUD vagues + cloture transactionnelle
- `src/lib/queries/releves.ts` — CRUD releves avec filtres
- `src/lib/queries/indicateurs.ts` — Agregation des indicateurs d'une vague

### API Routes
- `src/app/api/bacs/route.ts` — GET/POST bacs
- `src/app/api/vagues/route.ts` — GET/POST vagues
- `src/app/api/vagues/[id]/route.ts` — GET/PUT vague detail
- `src/app/api/releves/route.ts` — GET/POST releves

### Tests
- `src/__tests__/calculs.test.ts` — 42 tests unitaires
- `src/__tests__/api/bacs.test.ts` — 12 tests API
- `src/__tests__/api/vagues.test.ts` — 23 tests API
- `src/__tests__/api/releves.test.ts` — 31 tests API

---

## Verdict : VALIDE

Apres corrections, toutes les issues critiques et importantes sont resolues. Le Sprint 2 est approuve pour passage au Sprint 3.

---

## Historique des reviews

### Review initiale (2026-03-08)
**Verdict : CONDITIONNEL** — 1 bug critique, 5 issues importants, 3 mineurs, 2 suggestions.

### Re-review (2026-03-08)
**Verdict : VALIDE** — 7/7 corrections confirmees. Details ci-dessous.

---

## Corrections verifiees

### C1 — Bug dateFin dans cloturerVague : CORRIGE
- `vagues.ts:81` : Signature `cloturerVague(id: string, dateFin?: string)` — accepte dateFin
- `vagues.ts:107` : `dateFin: dateFin ? new Date(dateFin) : new Date()` — utilise la valeur user avec fallback
- `vagues.ts:117-118` : `cloturerVague(id, data.dateFin)` — passe dateFin depuis le DTO

### I1 — Enums importes au lieu de string literals : CORRIGE
- `vagues.ts:2` : `import { StatutVague } from "@/types"`
- `vagues.ts:92` : `StatutVague.EN_COURS` (etait `"EN_COURS"`)
- `vagues.ts:106` : `StatutVague.TERMINEE` (etait `"TERMINEE"`)
- `vagues.ts:117` : `StatutVague.TERMINEE` (etait `"TERMINEE"`)
- `releves.ts:2` : `import { StatutVague } from "@/types"`
- `releves.ts:52` : `StatutVague.EN_COURS` (etait `"EN_COURS"`)
- `indicateurs.ts:2` : `import { TypeReleve } from "@/types"`
- `indicateurs.ts:42-47` : `TypeReleve.BIOMETRIE`, `.MORTALITE`, `.ALIMENTATION`, `.COMPTAGE` (etaient des strings)

### I2 — assignerBac atomique : CORRIGE
- `bacs.ts:52-54` : `updateMany` avec `where: { id: bacId, vagueId: null }` — operation atomique
- `bacs.ts:57-61` : Verification `result.count === 0` puis distinction "introuvable" vs "deja assigne"

### I3 — getVagues filtre cote DB : CORRIGE
- `vagues.ts:6` : `getVagues(filters?: { statut?: string })` — accepte des filtres
- `vagues.ts:7-8` : Construction du `where` depuis les filtres
- `api/vagues/route.ts:11` : `getVagues(statut ? { statut } : undefined)` — passe le filtre a la query

### I4 — POST /api/releves construit un DTO type : CORRIGE
- `releves/route.ts:207-213` : Construction d'un objet `base` avec les champs communs
- `releves/route.ts:215-269` : Switch exhaustif sur `TypeReleve` construisant un `dto: CreateReleveDTO` type
- `releves/route.ts:271` : `createReleve(dto)` au lieu de `createReleve(body)`

### I5 — PUT response inclut nombreBacs : CORRIGE
- `api/vagues/[id]/route.ts:139` : `nombreBacs: vague._count.bacs`
- `vagues.ts:109` : `cloturerVague` retourne avec `include: { _count: { select: { bacs: true } } }`
- `vagues.ts:161` : `updateVague` (path non-cloture) inclut aussi `_count`

### S2 — indicateurs.ts reutilise calculs.ts : CORRIGE
- `indicateurs.ts:4-10` : Import des 5 fonctions de `@/lib/calculs`
- `indicateurs.ts:78-86` : Appels de `calculerTauxSurvie`, `calculerGainPoids`, `calculerBiomasse`, `calculerSGR`, `calculerFCR`
- Bonus : `calculerBiomasse` aussi utilise pour la biomasse initiale (L82), eliminant toute duplication

---

## Issues mineures (reportees au Sprint 5)

### M1 — Type where clause dans getReleves
**Fichier :** `src/lib/queries/releves.ts:7`
`Record<string, unknown>` au lieu de `Prisma.ReleveWhereInput`.

### M2 — GET /api/vagues ne valide pas le param statut
**Fichier :** `src/app/api/vagues/route.ts:9`
Un statut invalide retourne silencieusement une liste vide au lieu d'une erreur 400.

### M3 — QUALITE_EAU sans aucune mesure
**Fichier :** `src/app/api/releves/route.ts:244-252`
Un releve QUALITE_EAU peut etre cree sans temperature, ph, oxygene ni ammoniac.

---

## Points positifs

1. **Calculs (calculs.ts)** : Fonctions pures exemplaires, JSDoc avec formules, cas limites bien geres.
2. **Transactions** : `createVague` et `cloturerVague` utilisent `$transaction` pour l'atomicite.
3. **Validation API** : Chaque route valide les entrees avec messages en francais, codes HTTP corrects (400, 404, 409, 500).
4. **Tests** : 108 tests couvrant toutes les fonctions, tous les types de releves (6), toutes les regles metier.
5. **Pas de `any`** : TypeScript strict respecte partout.
6. **Server Components** : Les API routes sont des Server Components, pas de "use client" inutile.
7. **Noms anglais / UI francais** : Convention CLAUDE.md respectee.
8. **Architecture queries/** : Bonne separation validation (routes) / logique metier (queries).
9. **N+1 evites** : `include`, `_count`, et `select` bien utilises.
10. **DTO type pour releves** : Le switch exhaustif construit un DTO propre par type de releve — securise et maintenable.
11. **assignerBac atomique** : L'approche `updateMany` conditionnel est plus robuste que le check-then-update.
12. **Reutilisation calculs.ts** : Les indicateurs utilisent les memes fonctions pures que les tests unitaires — source unique de verite.

---

## Resume final

| ID | Severite | Statut |
|----|----------|--------|
| C1 | critique | CORRIGE |
| I1 | important | CORRIGE |
| I2 | important | CORRIGE |
| I3 | important | CORRIGE |
| I4 | important | CORRIGE |
| I5 | important | CORRIGE |
| S2 | suggestion | CORRIGE |
| M1 | mineur | Reporte Sprint 5 |
| M2 | mineur | Reporte Sprint 5 |
| M3 | mineur | Reporte Sprint 5 |
| S1 | suggestion | Reporte Sprint 5 |

**Sprint 2 VALIDE. Pret pour le Sprint 3.**
