# Sprint SV — SurVie

**Statut** : ✅ SIGNÉ — APPROVED
**Lancé le** : 2026-06-16
**Clôturé le** : 2026-06-16
**Source** : `/goal` — bug taux de survie observé sur Vague-26-03-Prep (13% au lieu de 92%)

## Objectif

Corriger la formule du taux de survie : utiliser `(nombreInitial − totalMortalites) / nombreInitial` au lieu de `nombreVivants / nombreInitial`. La formule précédente assimilait les sorties (ventes, transferts, calibrages sortants) à des morts.

## Stories — toutes livrées dans un seul commit

| Story | Sujet | Commit |
|-------|-------|--------|
| SV.1 | Signature `calculerTauxSurvie(nombreInitial, totalMortalites)` | `a35d772` |
| SV.2 | MAJ tous les callers (10 fichiers) | `a35d772` |
| SV.3 | 8 nouveaux tests + régression Vague-26-03-Prep | `a35d772` |
| SV.5 | Sprint close (ce commit) | (ce commit) |

## Fichiers modifiés

- `src/lib/calculs.ts` — signature + formule corrigée
- `src/lib/bac-performance.ts` — inline formula refait via `totalMortsBac`
- `src/lib/queries/indicateurs.ts` — caller MAJ + dead code supprimé
- `src/lib/queries/analytics.ts` — 2 callers MAJ
- `src/lib/queries/dashboard.ts` — 2 callers MAJ + dead code supprimé
- `src/lib/queries/ingenieur.ts` — caller MAJ
- `src/lib/activity-engine/context.ts` — caller MAJ
- `src/lib/activity-engine/engineer-alerts.ts` — caller MAJ
- `src/lib/__tests__/taux-survie.test.ts` — nouveau, 8 tests

## Validation

- **Vague-26-03-Prep** : `calculerTauxSurvie(7000, 565)` → **91.93%** (avant : 13%)
- Tests Sprint SV : 8/8 verts
- Suite complète `src/lib/__tests__` : 87/87 verts
- `npx tsc --noEmit` : 0 erreur

## Garde-fous Survie actifs

1. 🛡 Formule définition métier : `(initial - morts) / initial` (pas `vivants / initial`)
2. 🛡 Clamp `Math.max(0, ...)` pour cas pathologique morts > initial
3. 🛡 Test régression bug Vague-26-03-Prep dans la suite

## Hors-scope (à voir séparément si besoin)

- `src/lib/alertes/reproduction.ts:205` (lots de reproduction) — la formule actuelle reste basée sur `nombreActuel`. À aligner si le métier confirme que les lots peuvent transférer des poissons sans qu'ils meurent.
