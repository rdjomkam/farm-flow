# Pré-analyse ADR-033 Discrepancies — 2026-04-06

## Statut : GO AVEC RÉSERVES

## Résumé

L'implémentation des 25 DISC d'ADR-033 est **partiellement déjà réalisée**. Environ 12 DISC sur 25 ont été implémentés lors de sprints précédents (ADR-034, ADR-033 fix partiel). Les 13 DISC restants correspondent à des incohérences réelles dans le code actuel qui doivent encore être corrigées. Le build est propre (0 erreur TypeScript). Les tests feed-periods passent tous (92/92). Les 30 tests en échec sont sans rapport avec les DISC.

---

## Vérifications effectuées

### Schema ↔ Types : OK

Pas de changement de schéma DB requis pour les 25 DISC. Aucune migration nécessaire.

### Build : OK

`npm run build` compile sans erreur TypeScript. Output : "✓ Compiled successfully in 14.4s".

### Tests feed-periods : OK (92/92 passent)

`npx vitest run src/__tests__/lib/feed-periods.test.ts` : 92 tests passent, 0 échec.
Les tests couvrent déjà `interpolerPoidsVague`, `interpolerPoidsBac`, `estimerNombreVivantsADate`, les calibrages ADR-032, et plusieurs cas ADR-033 vague-level.

### Tests globaux : 30 échecs — non liés aux DISC

Les 9 fichiers en échec (30 tests) sont :
- `abonnements-statut-middleware.test.ts` — fonctionnalité abonnements
- `bacs.test.ts` — quota DECOUVERTE
- `vagues.test.ts` et `vagues-distribution.test.ts` — structure de mock
- `permissions.test.ts` — count permissions
- `quota-enforcement.test.ts` — plan DECOUVERTE
- `proxy-redirect.test.ts` — rôle INGENIEUR
- `check-subscription.test.ts` — null handling
- `feed-analytics-fournisseurs.test.ts` — `vague.calibrages` undefined dans les mocks

Ces échecs **préexistent** à l'implémentation des DISC et ne constituent pas un bloqueur.

---

## Analyse DISC par DISC — État actuel

### DISC déjà implémentés (ne nécessitent PAS de modification)

| DISC | Fichier | État réel observé |
|------|---------|-------------------|
| DISC-07 | `feed-periods.ts` | `interpolerPoidsVague` existe (ligne 273) et évalue Gompertz en étape 2 avant l'extrapolation plate. L'ordre BIOMETRIE_EXACTE → GOMPERTZ_VAGUE → INTERPOLATION_LINEAIRE → VALEUR_INITIALE est correct. |
| DISC-10 | `analytics.ts` | `gompertzContext` est construit si `vague.gompertz` existe, sans condition sur `interpolStrategy`. ADR-034 a supprimé la condition `interpolStrategy === GOMPERTZ_VAGUE`. |
| DISC-13 | `analytics.ts` | `getFCRTrace` appelle `interpolerPoidsVague` (ligne 2692) avec toutes les biométries, sans filtre bacId. |
| DISC-15 | `analytics.ts` | Même correction que DISC-10 — déjà appliquée dans `getFCRTrace` (ligne 2626). |
| DISC-16 | `analytics.ts` | Agrégation FCR via périodes valides uniquement — déjà implémenté aux lignes 742-765 et 2779-2793. |
| DISC-19 | `calculs.ts` | `FCRTraceVague.modeLegacy` : **non présent dans l'interface** (vérifié lignes 954-982). Déjà supprimé. |
| DISC-21 | `dialog.tsx` | Titre sans `bacNom` — déjà corrigé (ligne 168 : `periodeN` sans référence bac). |
| DISC-22 | `dialog.tsx` | Label `periodes` (pas `periodesDuBac`) — déjà corrigé (ligne 325). |
| DISC-23 | `dialog.tsx` | Bloc `modeLegacy` absent du code du dialog — déjà supprimé. |
| DISC-24 | `dialog.tsx` | `GompertzParamsBlock` existe (lignes 272-303) et est utilisé (ligne 354). |
| DISC-25 | `dialog.tsx` | Clé React utilise `${periode.dateDebut}-${idx}` sans `bacId` (ligne 365). |

### DISC encore ouverts (nécessitent implémentation)

#### Groupe A — `feed-periods.ts` : fonctions per-bac toujours présentes et utilisées

**DISC-01, DISC-02** : `interpolerPoidsBac` existe toujours (lignes 119-246) et filtre par `bacId`. Elle est encore importée et appelée dans les tests (`feed-periods.test.ts` ligne 28). `segmenterPeriodesAlimentaires` appelle toujours `estimerNombreVivantsADate(bacId, ...)` (ligne 635) — l'algorithme interne de segmentation reste per-bac même si le résultat utilise `interpolerPoidsVague` pour les poids.

**DISC-03, DISC-04** : `segmenterPeriodesAlimentaires` (lignes 525-666) groupe encore par `bacId` (lignes 536-540, `const key = r.bacId`). La segmentation est per-bac. `interpolerPoidsVague` est appelé pour les poids (correction partielle d'ADR-033), mais la structure reste : une période par bac par produit, pas une période par produit pour toute la vague.

**DISC-05, DISC-06** : `estimerNombreVivantsADate` existe toujours (lignes 423-478) avec `bacId` comme premier paramètre. Elle est appelée dans `segmenterPeriodesAlimentaires` (ligne 635) avec `bacId` — le `nombreVivants` dans chaque période est toujours per-bac, pas le total vague.

`estimerNombreVivantsVague` n'existe pas encore dans `feed-periods.ts`.
`segmenterPeriodesAlimentairesVague` n'existe pas encore dans `feed-periods.ts`.

#### Groupe B — `types/calculs.ts` : types hybrides incohérents

**DISC-17** : `PeriodeAlimentaire` (ligne 642) conserve `bacId: string`. Elle est toujours produite par `segmenterPeriodesAlimentaires` (ligne 651 : `bacId: bacId ?? "unknown"`).

**DISC-17 bis** : `PeriodeAlimentaireVague` existe (ligne 676) mais contient aussi `bacId: string` (ligne 678). C'est une incohérence avec ADR-033 §3.1 qui spécifie que `PeriodeAlimentaireVague` ne doit PAS avoir de `bacId`. Ce champ a été ajouté par erreur.

**DISC-18** : `FCRTracePeriode` (ligne 888) contient toujours `bacId: string` (ligne 890) et `bacNom: string` (ligne 892). Ces champs doivent être supprimés selon ADR-033 §3.5.

#### Groupe C — `analytics.ts` : consommation de l'ancienne API

**DISC-08** : `computeAlimentMetrics` appelle `segmenterPeriodesAlimentaires` (ligne 731), pas `segmenterPeriodesAlimentairesVague` (qui n'existe pas encore).

**DISC-09** : `mortalitesParBac` (Map) est encore construit (lignes 707-716) et transmis à `segmenterPeriodesAlimentaires`. Le commentaire dit "ADR-033 DISC-09" mais le code n'a pas été mis à jour : il utilise encore la Map.

**DISC-11** : Même problème dans `getFCRTrace` (lignes 2640-2647) — `mortalitesParBac` Map construite.

**DISC-12** : `getFCRTrace` appelle `segmenterPeriodesAlimentaires` (ligne 2676), pas la version vague.

**DISC-14** : `tracePeriodes.push({...})` (ligne 2755) remplit encore `bacId` (ligne 2756) et `bacNom` (ligne 2757) depuis `bacNomMap`, ce qui alimente les champs `FCRTracePeriode.bacId/bacNom` encore présents dans le type.

---

## Incohérences trouvées au-delà des DISC

### Incohérence 1 — `PeriodeAlimentaireVague` contient `bacId` (contradiction avec ADR-033 §3.1)

`src/types/calculs.ts` ligne 678 : `bacId: string` est présent dans `PeriodeAlimentaireVague`. ADR-033 §3.1 spécifie explicitement que ce champ doit être absent. Cela indique que cette interface a été créée mais pas alignée sur la spec finale.

**Fichiers concernés :** `src/types/calculs.ts` (ligne 678)
**Suggestion :** Supprimer `bacId` de `PeriodeAlimentaireVague` lors de l'implémentation de DISC-17.

### Incohérence 2 — `segmenterPeriodesAlimentaires` contient un commentaire ADR-033 trompeur

`src/lib/feed-periods.ts` lignes 508-511 : le commentaire dit "Weight estimation uses the VAGUE-LEVEL Gompertz curve via interpolerPoidsVague (ALL biometries, NOT filtered by bacId)" — ce qui est vrai pour l'estimation des poids — mais la segmentation elle-même reste per-bac (groupe par bacId). Ce commentaire crée une confusion sur ce qui a été corrigé vs ce qui ne l'a pas été.

### Incohérence 3 — Commentaires "DISC-09 fix" dans analytics.ts sans correction effective

`src/lib/queries/analytics.ts` ligne 705 : le commentaire "ADR-033 DISC-09: build mortalitesParBac (flat Map)" est incorrect. DISC-09 demande de passer à un **tableau plat** `mortalitesTotales`, pas une Map. Le commentaire induit en erreur sur l'état du fix.

### Incohérence 4 — `feed-analytics-fournisseurs.test.ts` : mocks sans `calibrages`

Le test `getScoresFournisseurs` échoue avec `TypeError: Cannot read properties of undefined (reading 'map')` à `analytics.ts:721` — `vague.calibrages` est undefined dans les mocks de ce test. Ce bug de test pré-existant sera aggravé si `segmenterPeriodesAlimentairesVague` accède aussi aux calibrages.

**Fichiers concernés :** `src/__tests__/lib/feed-analytics-fournisseurs.test.ts`
**Suggestion :** Ajouter `calibrages: []` dans les mocks vague de ce fichier de test, indépendamment des DISC.

---

## Risques identifiés

### Risque 1 — Suppression de `bacId/bacNom` de `FCRTracePeriode` : breaking change potentiel

Si d'autres composants ou API routes lisent `periode.bacId` ou `periode.bacNom` (au-delà du dialog), les supprimer cassera TypeScript au build.

**Impact :** Build failure si des consommateurs existent.
**Mitigation :** La recherche Grep confirme que `bacId/bacNom` sur `FCRTracePeriode` n'est utilisé qu'en 2 endroits : `analytics.ts` (ligne 2756-2757, côté émetteur) et `fcr-transparency-dialog.tsx` (côté consommateur, déjà corrigé). Il n'y a pas d'autres consommateurs. Le risque est donc faible mais doit être vérifié lors de l'implémentation.

### Risque 2 — Double emploi `PeriodeAlimentaire` / `PeriodeAlimentaireVague` dans les tests

Les tests `feed-periods.test.ts` couvrent `segmenterPeriodesAlimentaires` (per-bac) et vérifient des comportements qui deviendront obsolètes. Les tests ADR-033 pour `interpolerPoidsVague` sont présents (lignes 1017+) mais il n'existe pas encore de tests pour `segmenterPeriodesAlimentairesVague` (la fonction n'existe pas). Les tests pour `estimerNombreVivantsVague` sont aussi absents.

**Impact :** Après implémentation, les tests per-bac de `segmenterPeriodesAlimentaires` devront être mis à jour ou supprimés selon que la fonction est gardée ou non.
**Mitigation :** Confirmer si `segmenterPeriodesAlimentaires` est conservée (pour compatibilité) ou supprimée.

### Risque 3 — `vague.calibrages` undefined dans les mocks de tests existants

6+ tests dans `feed-analytics-fournisseurs.test.ts` échouent déjà car `vague.calibrages` est undefined dans les fixtures. L'ajout de `segmenterPeriodesAlimentairesVague` qui accèdera aussi aux calibrages risque d'aggraver ces échecs si les mocks ne sont pas corrigés.

---

## Prérequis manquants

1. `segmenterPeriodesAlimentairesVague` n'existe pas encore dans `src/lib/feed-periods.ts` — c'est la fonction centrale des DISC-03/04/06/08/12.
2. `estimerNombreVivantsVague` n'existe pas encore dans `src/lib/feed-periods.ts` — requis par DISC-05/06.
3. `PeriodeAlimentaireVague.bacId` doit être supprimé du type (présent à tort) avant de créer la nouvelle fonction qui produit ce type.
4. `FCRTracePeriode.bacId` et `FCRTracePeriode.bacNom` doivent être supprimés des types avant de modifier `getFCRTrace`.

---

## Récapitulatif des DISC par statut

| Statut | DISC |
|--------|------|
| Déjà implémentés (11) | DISC-07, 10, 13, 15, 16, 19, 21, 22, 23, 24, 25 |
| Encore ouverts (14) | DISC-01, 02, 03, 04, 05, 06, 08, 09, 11, 12, 14, 17, 18 + `PeriodeAlimentaireVague.bacId` |

---

## Recommandation

GO — mais l'ordre d'implémentation recommandé par ADR-033-discrepancies.md §6 doit être suivi strictement :

1. **Types d'abord** (`src/types/calculs.ts`) :
   - Supprimer `bacId` de `PeriodeAlimentaireVague` (incohérence hors DISC)
   - Supprimer `bacId` et `bacNom` de `FCRTracePeriode` (DISC-18)
   - `PeriodeAlimentaire` peut rester pour les tests legacy, ou être supprimée si `segmenterPeriodesAlimentaires` est supprimée

2. **Nouvelles fonctions** (`src/lib/feed-periods.ts`) :
   - Ajouter `estimerNombreVivantsVague` (DISC-05/06)
   - Ajouter `segmenterPeriodesAlimentairesVague` (DISC-03/04/06)
   - Supprimer `segmenterPeriodesAlimentaires` et `estimerNombreVivantsADate` (ou les garder pour les tests existants ADR-032 pendant une phase de transition)

3. **Mise à jour des appelants** (`src/lib/queries/analytics.ts`) :
   - `computeAlimentMetrics` : utiliser `segmenterPeriodesAlimentairesVague` + `mortalitesTotales` (DISC-08/09)
   - `getFCRTrace` : même mise à jour + supprimer la construction `bacNomMap` et les champs `bacId/bacNom` (DISC-11/12/14)

4. **Correction des mocks** (`src/__tests__/lib/feed-analytics-fournisseurs.test.ts`) :
   - Ajouter `calibrages: []` dans les fixtures vague (pré-requis indépendant)

5. **Nouveaux tests** :
   - Tests pour `estimerNombreVivantsVague`
   - Tests pour `segmenterPeriodesAlimentairesVague` selon ADR-033 §12

Le build est propre, les tests FCR existants passent tous — le terrain est stable pour commencer l'implémentation.
