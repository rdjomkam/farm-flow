# Sprint CG — Conservation Garantie

**Statut** : ✅ SIGNÉ — APPROVED_WITH_FOLLOWUPS
**Lancé le** : 2026-06-11
**Clôturé le** : 2026-06-11
**Review finale** : `docs/reviews/review-sprint-CG.md`
**Source** : `/goal` (Sprint CG) — déclenché après incident production Vague-26-03-Prep / Vague-26-03 le 10 juin 2026

## Objectif

Empêcher systémiquement les dérives de conservation des poissons détectées en production :
- 3524 alevins « perdus » dans un calibrage incomplet (catégorie GROS oubliée)
- 2 TransfertGroupe avec `bacDestId` NULL → 1976 poissons « en l'air »
- 3 relevés TRANSFERT supprimés manuellement → orphelins
- Bacs « ressuscités » sans AssignationBac active (créées le lendemain)

## Stories

| Story | Sujet | Statut | Owner | Dépendances |
|-------|-------|--------|-------|-------------|
| CG.1 | Garde-fou calibrage : conservation stricte | ✅ FAIT (commit `af91245`, review APPROVED_WITH_NITS) | @developer + @code-reviewer | — |
| CG.2 | `bacDestId` obligatoire sur TransfertGroupe | ✅ FAIT (commit `9749145`, review APPROVED_WITH_NITS) — migration NOT NULL différée jusqu'à CG.5 | @developer + @code-reviewer | — |
| CG.3 | Protection relevés TRANSFERT/ARRIVAGE/VENTE/CALIBRAGE | ✅ FAIT (commit `f6d7214`, review APPROVED_WITH_NITS) | @developer + @code-reviewer | — |
| CG.4 | AssignationBac.dateAssignation = date opération | ✅ FAIT (commit `8a8923a`, review APPROVED_WITH_NITS) | @developer + @code-reviewer | CG.1, CG.2 |
| CG.5 | Audit prod data + migration | ✅ FAIT — 7 AssignationBac corrigées, Vague-26-03-Prep = 936 ✓, Vague-26-03 = 5500 ✓ | @db-specialist | CG.4 |
| CG.6 | Tests E2E + review R1-R9 | ✅ FAIT — review sprint APPROVED_WITH_FOLLOWUPS (E2E browser reportée) | @code-reviewer | CG.1-CG.5 |

## Processus par story

Chaque story suit le pipeline `docs/PROCESSES.md` :
1. @pre-analyst — valide que le terrain est prêt
2. @db-specialist / @developer — implémente
3. @tester — vérifie tests + build
4. @code-reviewer — review R1-R9
5. @knowledge-keeper — extrait les leçons
6. @status-updater — met à jour ce fichier

## Définition de fait sprint

- [ ] Toutes les stories CG.1-CG.6 marquées FAIT
- [ ] `npx vitest run` + `npm run build` OK
- [ ] Review R1-R9 signée (`docs/reviews/review-sprint-CG.md`)
- [ ] Migration data appliquée sur prod
- [ ] Vague-26-03-Prep audit final : 936 vivants confirmés
- [ ] Commit + push par story

## Hors-scope

- Vente Vague-26-03 (~424 alevins) — saisie utilisateur
- Refactor `computeVivantsByBac` — déjà robuste post-fix `a5671d5` + `5712d88`
