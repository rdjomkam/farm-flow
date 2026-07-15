# Sprint GV — computeVivantsByBac discrimination TRANSFERT par relevé

**Statut** : ✅ CLÔTURÉ
**Lancé le** : 2026-07-15
**Clôturé le** : 2026-07-15
**Follow-up de** : Sprint GD (BUG-049 / ERR-101)
**Review** : [review-story-GV.1.md](../reviews/review-story-GV.1.md) — APPROVED après fix analytics.ts

## Résultat

- 22 fichiers de prod refactorés + 11 fichiers de tests migrés
- Nouveau helper `getTransfertGroupesByVagues` batché (`src/lib/queries/transferts.ts`)
- Test régression `GV.3 — discrimination PAR RELEVÉ` dans `src/__tests__/calculs-transfert-entrant.test.ts`
- Bonus : 5 tests pré-existants (post-GD.1) fixés
- Suite complète : **119 échecs → 66 échecs** (-53 net, +54 tests passants)
- Build OK

## Objectif

Éliminer le bug jumeau du guard (BUG-049) dans `src/lib/calculs.ts:330-345` (`computeVivantsByBac`) — même anti-pattern per-bac via `transfertDestBacIds`. Cette fonction est consommée par 16 fichiers (dashboards, indicateurs, finances, pages, API). Un bac source d'un TG et destination d'un autre voit tous ses TRANSFERT relevés signés identiquement → nombre de vivants affiché incorrect (silencieusement, pas d'erreur).

## Différence avec GD

- GD (guard) : erreur bloquante `ConservationError`
- GV (calcul vivants) : affichage silencieusement faux dans dashboards/indicateurs

## Stories

| Story | Type | Sujet | Agent |
|-------|------|-------|-------|
| GV.1 | REFACTOR | Refactor `computeVivantsByBac` : discrimination par-relevé via `Releve.transfertGroupeId` | @developer |
| GV.2 | REFACTOR | Adapter les callers si besoin (signature / helpers) | @developer |
| GV.3 | TEST | Tests unitaires (bac source+dest même vague, régression) | @tester |
| GV.4 | REVIEW | Review + build + knowledge-keeper | @code-reviewer + @knowledge-keeper |

## Contraintes

- Pattern miroir de GD.1 (déjà validé) : Map `<transfertGroupeId, {bacSourceId, bacDestId}>` + `transfertSigne(r)` par relevé
- Signature publique de `computeVivantsByBac` peut évoluer si nécessaire mais préférer garder identique pour éviter cascade sur 16 fichiers
- Node 22 obligatoire pour tests/build (`nvm use 22`)

## Validation

- [ ] Tests unitaires nouveaux ciblés
- [ ] `npx vitest run` (suite complète) — pas de nouvelle régression
- [ ] `npm run build` OK
- [ ] Review R1-R9
- [ ] ERR-102 dans ERRORS-AND-FIXES.md
