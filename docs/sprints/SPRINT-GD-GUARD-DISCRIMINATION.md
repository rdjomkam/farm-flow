# Sprint GD — Guard Discrimination TRANSFERT entrant/sortant par relevé

**Statut** : ✅ CLÔTURÉ
**Lancé le** : 2026-07-15
**Clôturé le** : 2026-07-15
**Bug tracker** : [BUG-049](../bugs/BUG-049.md)
**Data-fix rapport** : [GD3-data-fix-report.md](../analysis/GD3-data-fix-report.md)
**Knowledge** : ERR-101 dans [ERRORS-AND-FIXES.md](../knowledge/ERRORS-AND-FIXES.md)

## Objectif

Fixer le bug `verifyAssignationInvariant` où `isEntrant` est calculé par bac au lieu de par relevé, bloquant les transferts intra-vague (source et destination dans la même vague). Puis appliquer un data-fix rétroactif sur Vague-26-03-Prep pour remplacer 3 « COMPTAGES déguisés » par de vrais TransfertGroupes.

## Contexte prod bloquant

Vague `cmplrrba6000101qwazzjca26` (Vague-26-03-Prep) — 3 opérations enregistrées comme COMPTAGE avec notes « Transfert depuis X lors de son retrait » :

| Bac | Relevé anti-pattern | Devrait être |
|-----|--------------------|--------------|
| Bac 08 | COMPTAGE=0 le 15/06 10:21 | TRANSFERT sortant 263 → Bac 12 |
| Bac 12 | COMPTAGE=712 le 15/06 10:21 | TRANSFERT entrant 263 depuis Bac 08 + sortant 712 → Bac 11 |
| Bac 11 | COMPTAGE=936 le 15/06 07:22 | TRANSFERT entrant 712 depuis Bac 12 |

L'utilisateur veut créer une vente de 936 poissons sur Bac 11. Le guard rejette parce que sans traçabilité TRANSFERT, la vente antidatée est filtrée par le lastComptage.

## Stories

| Story | Type | Sujet | Agent |
|-------|------|-------|-------|
| GD.1 | BUGFIX | Refactor guard : `isEntrant` par-relevé via `Releve.transfertGroupeId` + `TransfertGroupe.bacSourceId/bacDestId` | @developer |
| GD.2 | TEST | Tests unitaires : bac source ET destination dans la même vague | @tester |
| GD.3 | BUGFIX | Data-fix SQL rétroactif prod (3 COMPTAGES déguisés → 2 TransfertGroupes) | @db-specialist |
| GD.4 | REVIEW | Review R1-R9 + build + close | @code-reviewer + @knowledge-keeper |

## Contraintes techniques (rappel)

- Guard doit rester dans le pattern `verifyAssignationInvariant(tx, siteId, vagueId, bacIds)` (R4 : appelé dans transaction)
- Assignations avec `dateFin != null` restent skippées (filtre existant ligne 67)
- Pour data-fix SQL : ordre critique — créer TransfertGroupes AVANT delete COMPTAGES pour ne pas casser l'invariant en flight
- Bacs 08 et 12 ont `dateFin` set → guard les skip. Seul Bac 11 est active et doit satisfaire l'invariant post-fix

## Validation

- [ ] `npx vitest run` — Tous les tests verts (existants + nouveaux)
- [ ] `npm run build` — Build production OK
- [ ] SQL data-fix appliqué en prod avec transaction, backup préalable
- [ ] Vague-26-03-Prep : vente de 936 poissons sur Bac 11 possible via UI sans ConservationError
- [ ] `docs/reviews/review-sprint-GD.md` produit
- [ ] `docs/knowledge/ERRORS-AND-FIXES.md` mis à jour avec ERR-GD
