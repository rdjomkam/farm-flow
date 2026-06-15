# Sprint CX — Conservation Extended

**Statut** : ✅ SIGNÉ — APPROVED
**Lancé le** : 2026-06-15
**Clôturé le** : 2026-06-15

## Objectif

Corriger les 2 failles découvertes en prod le 2026-06-15 (Bac 08 / Vague-26-02 calibrage rejeté à tort par guard CS.3) :
- **F1** : Pass 2 calibrage ne populait pas `nombreInitial` (CS.1 a oublié `calibrages.ts`)
- **F2** : Filtre date guard trop strict `>` exclut les relevés au même instant que `dateAssignation`

## Stories

| Story | Sujet | Statut | Commit |
|-------|-------|--------|--------|
| CX.1 | Pass 2 calibrage populer `nombreInitial` (createCalibrage + patchCalibrage) | ✅ FAIT | `6542c58` |
| CX.2 | Guard `releveDate >= dateAssignation` | ✅ FAIT | `2a4506c` |
| CX.3 | Audit prod : 2 cas (Bac 07/08 Vague-26-02), 0 bloquant | ✅ FAIT | `0b25ce0` |
| CX.4 | Retry calibrage Vague-26-02 (action user) | ⏳ EN ATTENTE | (action utilisateur) |
| CX.5 | E2E + review finale | ✅ FAIT — APPROVED | (ce commit) |

## Cohérence inter-stories

Les 2 fixes CX.1 + CX.2 sont **nécessaires ET suffisants** :
- Sans CX.1 : `nombreInitial=0` → `expected` du guard part de 0 sur les futurs calibrages
- Sans CX.2 : COMPTAGE simultané au `dateAssignation` exclu → `expected = init`, faux-positif
- Avec CX.1 + CX.2 : `init = total` ET COMPTAGE inclus → invariant tient

## Tests

| Suite | Statut |
|-------|--------|
| `calibrages-init-fields.test.ts` (CX.1) | 6/6 verts |
| `assignation-invariant-guard.test.ts` (CX.2) | 12/12 verts |
| `calibrages-conservation.test.ts` (régression) | 8/8 verts |
| `calibrages-edge-cases.test.ts` (régression) | 6/6 verts |
| Total Sprint CX | **32/32 verts** |

## Followups (non bloquants)

| Priorité | Action |
|----------|--------|
| Basse | E2E `conservation-flow.spec.ts` : ajouter step "bac vide rattaché + calibrage → accepté" (régression CX.1+CX.2) |
| Basse | Dette technique `patchCalibrage` Étape 6c : restauration sur `sourceBacIds[0]` uniquement (pré-existant, approche v1) |

## Garde-fous Conservation actifs en prod (post-CX)

1. 🛡 Calibrage conservation strict ±0.5% (CG.1)
2. 🛡 `bacDestId` obligatoire (CG.2)
3. 🛡 DELETE protégé sur relevé lié (CG.3)
4. 🛡 `AssignationBac.dateAssignation` = date opération (CG.4)
5. 🛡 `nombreInitial`/`poidsMoyenInitial` populés à la création dest (CS.1 + **CX.1** calibrage)
6. 🛡 `computeVivantsByBac` symétrique entrants/sortants (CS.2)
7. 🛡 Post-write invariant guard avec filtre date `>=` (CS.3 + **CX.2**) — rollback auto si écart
