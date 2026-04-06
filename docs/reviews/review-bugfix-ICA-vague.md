# Review — Bugfix ICA Vague-level (analytics.ts)
**Date :** 2026-04-06
**Reviewer :** @code-reviewer
**Verdict :** APPROUVÉ

## Fichiers audités
- `src/lib/queries/analytics.ts` — 3 bug fixes
- `src/__tests__/lib/analytics-ica.test.ts` — 32 tests de non-régression

## Checklist R1-R9 : PASS (R4-R6 N/A)

## Observations mineures
- M1: `!== undefined` redondant dans le réducteur hybride — simplifier à la prochaine touche
- M2: Réducteur hybride dupliqué (lignes ~1196 et ~1350) — extraire `sumAlimentReleve(r)` lors d'un polish
- M3: `nombreInitial` utilisé comme estimateur de vivants dans BUG 3 — acceptable pour indicateur de tendance

## Bugs satellites hors scope (à traiter séparément)
5 autres occurrences du pattern `quantiteAliment ?? 0` identifiées par la pré-analyse :
- `computeIndicateursBac` (analytics.ts:88) — Haute
- `getIndicateursVague` (indicateurs.ts:54) — Haute (prioritaire)
- `getDashboardProjections` (dashboard.ts:179) — Moyenne
- `getDashboardIndicateurs` (dashboard.ts:409) — Haute
- `detectFCRAlerte` (engineer-alerts.ts:227) — Moyenne
