# Sprint CF — Conservation Followup

**Statut** : ✅ SIGNÉ — APPROVED — Périmètre Conservation FULLY_GREEN
**Lancé le** : 2026-06-11
**Clôturé le** : 2026-06-11
**Review finale** : `docs/reviews/review-sprint-CF.md`
**Source** : `/goal` (Sprint CF) — follow-up de Sprint CG (commit `2b35b9b`)

## Objectif

Clore les follow-ups identifiés par la review finale du Sprint CG (`docs/reviews/review-sprint-CG.md`). Passer de « APPROVED_WITH_FOLLOWUPS » à « FULLY_GREEN » avant la prochaine grosse opération métier.

## Stories

| Story | Sujet | Statut | Owner | Dépendances |
|-------|-------|--------|-------|-------------|
| CF.1 | Audit + correctif edge case CG.1 (AssignationBac source fermée) | ✅ FAIT (`4ce9eb2`) — 6 tests + audit prod 0 résultat | @developer | — |
| CF.2 | Vérifier build production | ✅ FAIT (`286ddb3`) — build OK + migration idempotente | @developer | — |
| CF.3 | Supprimer `_patchReleve_deprecated` (173 lignes) | ✅ FAIT (`9e4eae0`) | @developer | — |
| CF.4 | Tests E2E browser flux complet | ✅ FAIT (`61b7d91`) — 11/11 verts | @tester | — |
| CF.5 | Documenter asymétrie CG.3 (protection delete) | ✅ FAIT (`24a6dc4`) | @developer | CF.3 |
| Review | Review finale R1-R9 | ✅ FAIT — APPROVED | @code-reviewer | CF.1-CF.5 |

## Processus par story

`docs/PROCESSES.md` : pre-analyst → implementer → tester → code-reviewer → status-updater

## Définition de fait sprint

- [ ] CF.1 : 0 vague EN_COURS avec calibrage à venir bloqué par edge case
- [ ] CF.2 : `npm run build` vert
- [ ] CF.3 : code mort supprimé, tests + build verts
- [ ] CF.4 : `conservation-flow.spec.ts` vert
- [ ] CF.5 : commentaire ajouté
- [ ] Review finale signée
- [ ] Un commit + push par story

## Hors-scope

- Vente Vague-26-03 (~424 alevins) — saisie métier
- Refactor `computeVivantsByBac` — déjà robuste
- Refactor wizard calibrage avec endpoint preview-sources
