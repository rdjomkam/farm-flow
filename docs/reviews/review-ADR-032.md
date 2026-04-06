# Review ADR-032 — Calibrage-aware nombreVivants + suppression GOMPERTZ_BAC

**Date :** 2026-04-05
**Reviewer :** @code-reviewer
**Statut :** APPROUVÉ

## Synthèse

L'implémentation de l'ADR-032 est correcte et complète. Les deux phases (Phase A : suppression de GOMPERTZ_BAC, Phase B : calibrage-aware nombreVivants) sont implémentées conformément aux spécifications de l'ADR. Aucun problème bloquant identifié.

## Checklist R1-R9

| Règle | Statut |
|-------|--------|
| R1 — Enums MAJUSCULES | PASS |
| R2 — Import des enums | PASS |
| R3 — Prisma = TypeScript | PASS |
| R4 — Opérations atomiques | PASS |
| R5 — DialogTrigger asChild | PASS |
| R6 — CSS variables | PASS |
| R7 — Nullabilité explicite | PASS |
| R8 — siteId PARTOUT | PASS |
| R9 — Tests avant review | PASS (79/79, build OK) |

## Phase A — Suppression GOMPERTZ_BAC

- Schema: enum StrategieInterpolation réduit à LINEAIRE + GOMPERTZ_VAGUE, modèle GompertzBac supprimé
- Migration: approche RECREATE conforme, mapping GOMPERTZ_BAC → GOMPERTZ_VAGUE
- Types: GompertzBac interface + GOMPERTZ_BAC supprimés de models.ts, calculs.ts, index.ts
- Code: branche GOMPERTZ_BAC supprimée de feed-periods.ts, analytics.ts, gompertz route
- UI: option supprimée de config-elevage form, badge supprimé de fcr-transparency-dialog
- i18n: clés GOMPERTZ_BAC supprimées des 3 fichiers JSON
- Grep: aucune référence active à GOMPERTZ_BAC dans le code exécutable

## Phase B — Calibrage-aware nombreVivants

- CalibragePoint interface conforme à ADR section 4
- VagueContext mis à jour avec calibrages optionnel
- estimerNombreVivantsADate implémente fidèlement l'algorithme ADR section 5
- Tous les cas limites ADR section 10 gérés
- Prisma queries incluent calibrages avec orderBy date asc
- mortalitesParBac construit correctement
- 9 cas de test ADR-032 couvrent tous les scénarios

## Remarques mineures corrigées

1. Header du fichier de test mis à jour (0-4 → 0-3)
2. Label describe block mis à jour (ADR-030 → ADR-032)

## Verdict

**APPROUVÉ.** Implémentation conforme, propre, testée.
