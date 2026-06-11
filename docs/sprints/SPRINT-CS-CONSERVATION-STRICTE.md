# Sprint CS — Conservation Stricte

**Statut** : ✅ SIGNÉ — APPROVED_WITH_FOLLOWUPS
**Lancé le** : 2026-06-11
**Clôturé le** : 2026-06-11

## Objectif

Empêcher l'incohérence détectée sur Vague-26-03 (Bac 01/04 affichaient 0 vivants alors que `nombrePoissons` était correctement incrémenté mais `nombrePoissonsInitial` resté à 0).

## Stories — toutes livrées

| Story | Sujet | Commit | Verdict |
|-------|-------|--------|---------|
| CS.1 | Populer init AssignationBac dest | `f6f66f8` | APPROVED |
| CS.2 | computeVivantsByBac symétrique + relevé miroir | `cbd2a3a` | APPROVED |
| CS.3 | Post-write invariant guard | `3a70e3c` | APPROVED (R1/R2 fix follow) |
| CS.4 | Audit prod : 7/8 corrigés + 4 miroirs créés | (data-fix prod) | OK |
| CS.5 | Review finale | (ce commit) | APPROVED_WITH_FOLLOWUPS |

## Validation prod post-sprint

- Vague-26-03 : **5500** vivants ≡ nombreInitial ✓
- Vague-26-03-Prep : **936** vivants ✓
- 0 ligne pathologique (init=0 / actuel>0) restante sur AssignationBac actives
- 0 TransfertGroupe sans relevé miroir

## Followups (non bloquants)

| Priorité | Action |
|----------|--------|
| Haute | Anomalie Bac 02 / 26-03-Prep : init=0 sans source traçable (saisir COMPTAGE manuel) |
| Haute | Anomalie Bac 03 / 26-02 : surplus +223 inexpliqué (régulariser avant prochaine op sur ce bac) |
| Moyenne | CS.5 Partie 1 : compléter les assertions E2E dans `conservation-flow.spec.ts` |
| Basse | Harmoniser R8 : ajouter filtre `siteId` sur `transfertGroupe.findMany` dans le guard |

## Garde-fous Conservation actifs en prod

1. 🛡 Calibrage refuse perte de poissons (CG.1, ±0.5%)
2. 🛡 `bacDestId` obligatoire (CG.2 + migration NOT NULL)
3. 🛡 DELETE refusé sur relevé lié à un parent (CG.3)
4. 🛡 `AssignationBac.dateAssignation` = date opération (CG.4)
5. 🛡 `nombreInitial`/`poidsMoyenInitial` populés à la création dest (CS.1)
6. 🛡 `computeVivantsByBac` symétrique entrants/sortants (CS.2)
7. 🛡 Post-write invariant guard (CS.3) — rollback automatique si écart
