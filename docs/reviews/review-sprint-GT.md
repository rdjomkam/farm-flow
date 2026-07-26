# Review Sprint GT — Guard de conservation tolérant aux écarts préexistants

**Verdict : CHANGES_REQUESTED → APPROVED après correctifs**

## Axes critiques — réponses explicites

**1. Aucune capacité de détection perdue — CONFIRMÉ.**
`src/__tests__/assignation-invariant-guard.test.ts` : **16 tests, `git diff` vide**, tous verts. Ils appellent le guard sans `ecartsRef` → `ecartAvant = 0` partout → le prédicat se réduit strictement à `e.ecart === 0`, comportement historique identique. La logique de replay extraite dans `calculerEcartsParBac` (filtre CX.2 `>=`, COMPTAGE comme base, discrimination TRANSFERT **par relevé** via `transfertGroupeId`) est identique ligne à ligne à la version d'avant extraction. Aucune divergence.

**2. Prédicat de tolérance — exhaustif, aucun trou.**
```ts
e.ecart === ecartAvant ||
(ecartAvant >= 0 ? e.ecart >= 0 && e.ecart < ecartAvant
                 : e.ecart <= 0 && e.ecart > ecartAvant)
```
Identique → accepté · aggravé même signe → rejeté · réduit même signe → accepté · **inversion de signe** (+2→−2, +5→−3, −2→+1) → **rejeté** · `ecartAvant = 0` → seul 0 accepté.

⚠️ La première implémentation comparait les **valeurs absolues** (`Math.abs(apres) > Math.abs(avant)`), ce qui laissait passer une inversion de signe : +2 → −2 accepté malgré 4 poissons de dérive, +5 → −3 accepté malgré 8. Corrigé avant review, avec 5 tests dédiés.

**3. Intégrité de la capture — CONFIRMÉE sur les 9 sites.**
Tous utilisent `tx` (jamais le client global, ce qui perdrait l'isolation), tous capturent **avant la première écriture**, tous passent la superset source+destination. Les sites créant une `AssignationBac` dans la transaction (arrivage bac libre, transfert bac vierge, calibrage) sont absents de la map de capture → écart de référence 0 → **guard strict**, comme voulu.

**4. Mocks des tests existants — aucune perte de détection.**
Contrôle par échantillonnage (`calibrages-conservation.test.ts`, `transferts-bacdest.test.ts`) : le `findMany` de capture est absorbé par un mock explicite et documenté, à la bonne position ; les assertions portent toujours sur les vraies valeurs de conservation. Pas de séquence décalée qui viderait le guard.

## Findings corrigés

| Sévérité | Finding | Correctif |
|---|---|---|
| Haute | `vagues/[id]/vente-alevins/route.ts` restée en **422** avec le format calibrage, alors que sa seule source d'erreur possible est le guard (aucun `ConservationError` métier en amont dans `createVenteAlevinsDepuisVague`) → le problème d'origine subsistait sur ce parcours | Alignée sur les 6 autres routes : **409** + `details`. Aucun test n'assertait le 422 (vérifié) |
| Moyenne | `bacId` absent des `details` : un outil de support devait parser le message pour retrouver l'assignation | `bacId?` ajouté en dernière position de `ConservationError` (non-breaking), propagé depuis le guard et exposé dans les 7 routes |

## R1-R9

R1 ✓ · R2 ✓ · R3 ✓ · R4 ✓ (capture et vérification dans `tx`, `updateMany` conditionnel préservé) · R5/R6 N/A · R7 ✓ (`ecartsRef?` et `?? 0` explicites) · R8 ✓ · R9 ✓ (5443 tests, build OK)

## Suivi non bloquant

Les écarts préexistants tolérés ne sont journalisés qu'en `console.warn` — éphémère. Les persister (`SiteAuditLog` ou table dédiée) permettrait un tableau de bord des bacs qui dérivent, ce qui aurait fait remonter le Bac 11 avant qu'il ne bloque une opération. À envisager en sprint de suivi.

## Validation E2E

Scénario reproduisant l'impasse d'origine — livraison avec 3 morts en transport sur un bac portant un écart hérité de +2 :

| | Avant GT | Après GT |
|---|---|---|
| Réponse | **500** opaque | **200** |
| Vente | bloquée en préparation | LIVREE, 10 500 FCFA, 4,2 kg, 87 poissons |
| Écart du bac | — | **inchangé (+2)**, journalisé |

L'opération est neutre pour la conservation : le relevé VENTE est décrémenté de 90 à 87 et une MORTALITE AVARIE de 3 est créée, les deux s'annulent dans le replay. Le guard cesse de punir l'historique sans rien laisser passer de nouveau.
