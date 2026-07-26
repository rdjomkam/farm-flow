# Sprint GT — Guard de conservation tolérant aux écarts préexistants

**Statut** : ✅ CLÔTURÉ — APPROVED (après correctifs)
**Lancé le** : 2026-07-26
**Clôturé le** : 2026-07-26
**Review** : [review-sprint-GT.md](../reviews/review-sprint-GT.md)
**Origine** : finding du sprint BF (voir `docs/reviews/review-sprint-BF.md`), et rejoue l'impasse vécue en prod sur le Bac 11 de Vague-26-03-Prep

## Problème

`verifyAssignationInvariant` compare l'invariant en **absolu** : il rejoue l'historique des relevés et exige que le résultat soit exactement égal à `AssignationBac.nombrePoissons`. Il ne distingue donc pas :

- « **cette** opération casse la conservation » ← ce qu'on veut vraiment attraper
- « ce bac était **déjà** décalé avant qu'on y touche » ← ce qui bloque à tort

Conséquence terrain, constatée en E2E pendant le sprint BF : une livraison avec des poissons morts en transport, sur un bac portant un écart historique de 2 poissons, est **refusée** — alors que l'opération est parfaitement légitime. Le livreur est devant le client et obtient une **erreur serveur 500** incompréhensible.

C'est exactement l'impasse du Bac 11 (« Invariant cassé… que faire ? ») : un écart historique gèle toute opération future sur le bac, sans chemin de sortie.

## Décision

Le guard devient **différentiel** : on mesure l'écart **avant** l'opération, on le mesure **après**, et on n'échoue que si l'opération l'a **aggravé**. Un écart préexistant est toléré et journalisé, pas bloquant.

```
ecartAvant  = nombrePoissons − replay(relevés)   [au début de la transaction]
ecartApres  = nombrePoissons − replay(relevés)   [après les écritures]
→ échec seulement si ecartApres ≠ ecartAvant
```

Cas particulier : une `AssignationBac` créée dans la même transaction n'a pas d'état antérieur → `ecartAvant = 0` par définition (le guard reste strict pour elle, ce qui est correct : on ne veut pas naître décalé).

## Stories

| Story | Type | Sujet | Agent |
|-------|------|-------|-------|
| GT.1 | REFACTOR | `captureEcartsAssignation(tx, siteId, vagueId, bacIds)` → `Map<bacId, ecart>` ; `verifyAssignationInvariant` accepte les écarts de référence et compare en delta ; journalisation des écarts préexistants | @developer |
| GT.2 | REFACTOR | Migrer les ~11 sites d'appel (capture en début de transaction) : `calibrages.ts`, `ventes.ts`, `bons-livraison.ts`, `arrivages.ts`, `transferts.ts` | @developer |
| GT.3 | API | `ConservationError` → **409** avec message actionnable (nom du bac, pas le cuid ; écart chiffré ; action suggérée) au lieu d'une 500 opaque | @developer |
| GT.4 | TEST+REVIEW | Tests delta (écart préexistant toléré / aggravé rejeté / assignation neuve stricte) + review R1-R9 | @tester + @code-reviewer |

## Garanties à ne pas perdre

- Le guard doit **toujours** attraper une opération qui casse la conservation (c'est sa raison d'être depuis le sprint CS.3). Tolérer le préexistant ne doit pas ouvrir de porte.
- Reste **dans la transaction** (appelé avec `tx`) pour garantir le rollback.
- La discrimination TRANSFERT entrant/sortant **par relevé** (sprints GD/GV, ERR-101/102) est conservée telle quelle.
- Le filtre CX.2 (`date >= dateAssignation`) et le COMPTAGE comme base de replay restent inchangés.

## Validation

- [ ] Écart préexistant → opération acceptée + écart journalisé
- [ ] Opération qui aggrave l'écart → rejetée avec message clair (409)
- [ ] Assignation créée dans la transaction → guard strict (écart de référence = 0)
- [ ] Suite complète sans régression (les tests du guard des sprints CS/CX/GD/GV restent verts)
- [ ] Test E2E : livraison avec avarie sur un bac volontairement décalé → passe
- [ ] Review R1-R9
