# Rapport de tests — ADR-029 : Stratégie d'interpolation configurable

**Date :** 2026-04-05
**Tester :** @tester
**ADR de référence :** `docs/decisions/ADR-029-config-interpolation-strategy.md`
**Fichier de test :** `src/__tests__/lib/feed-periods.test.ts`

---

## Résumé

| Metric | Valeur |
|--------|--------|
| Tests ADR-029 ajoutés | 25 |
| Tests ADR-028 existants (non-régression) | 31 |
| Total tests feed-periods.test.ts | 56 |
| Résultat feed-periods.test.ts | 56/56 VERT |
| Build `npm run build` | OK — aucune erreur TypeScript |
| Suite complète `npx vitest run` | 4146/4170 (24 échecs PRÉ-EXISTANTS, non liés à ADR-029) |

---

## Découverte importante : comportement de la garde "bacBios.length === 0"

L'implémentation de `interpolerPoidsBac` dans `src/lib/feed-periods.ts` contient une
garde précoce (lignes 106-109) :

```typescript
if (bacBios.length === 0) {
  // No biometry for this tank at all — use initial weight
  return { poids: poidsInitial, methode: "VALEUR_INITIALE" };
}
```

Cette garde s'exécute **avant** la logique Gompertz (étape 2a). En conséquence :

- Si un bac n'a **aucune biométrie** dans la série `biometries[]`, le système retourne
  `VALEUR_INITIALE` sans jamais tenter Gompertz — même si la stratégie `GOMPERTZ_VAGUE`
  est configurée et que le contexte Gompertz est valide.

- Ce comportement est **cohérent** avec la conception ADR-028/ADR-029 : Gompertz est
  conçu pour interpoler **entre** des biométries connues, pas pour remplacer une absence
  totale de données. Quand aucune biométrie n'existe pour un bac, `VALEUR_INITIALE` est
  le fallback correct.

- Impact sur les tests : tous les cas de test Gompertz nécessitent **au moins une biométrie
  (non exacte) pour le bac cible** afin de dépasser la garde précoce. Les tests ont été
  écrits en conséquence, avec des biométries non exactes positionnées avant la date cible.

---

## Tests ajoutés — `interpolerPoidsBac` (ADR-029)

### Cas nominaux

| # | Description | Résultat |
|---|-------------|----------|
| 1 | Stratégie GOMPERTZ_VAGUE + contexte HIGH valide (r2=0.97, biometrieCount=10) → retourne le poids `gompertzWeight(t, params)` | VERT |
| 2 | Stratégie GOMPERTZ_VAGUE + contexte MEDIUM valide (r2=0.87, biometrieCount=7) → `methode = "GOMPERTZ_VAGUE"` | VERT |
| 3 | Biométrie exacte le même jour prime sur Gompertz (étape 1 inchangée) → `methode = "BIOMETRIE_EXACTE"` | VERT |

### Fallbacks — confidence insuffisante

| # | Description | Résultat |
|---|-------------|----------|
| 4 | `confidenceLevel = "LOW"` → fallback `INTERPOLATION_LINEAIRE` | VERT |
| 5 | `confidenceLevel = "INSUFFICIENT_DATA"` → fallback `INTERPOLATION_LINEAIRE` | VERT |

### Fallbacks — R² insuffisant

| # | Description | Résultat |
|---|-------------|----------|
| 6 | `r2 = 0.80 < 0.85` → fallback `INTERPOLATION_LINEAIRE` | VERT |
| 7 | `r2 = 0.85` (exactement au seuil) → Gompertz accepté (seuil inclusif `>=`) | VERT |

### Fallbacks — biometrieCount insuffisant

| # | Description | Résultat |
|---|-------------|----------|
| 8 | `biometrieCount = 3 < gompertzMinPoints = 5` → fallback `INTERPOLATION_LINEAIRE` | VERT |
| 9 | `biometrieCount = gompertzMinPoints = 5` (exactement) → Gompertz accepté | VERT |
| 10 | `gompertzMinPoints` absent dans options → défaut = 5 ; `biometrieCount = 4` → refus | VERT |

### Fallbacks — contexte absent

| # | Description | Résultat |
|---|-------------|----------|
| 11 | `gompertzContext = undefined` → fallback `INTERPOLATION_LINEAIRE` | VERT |

### Fallback — t négatif (targetDate avant vagueDebut)

| # | Description | Résultat |
|---|-------------|----------|
| 12 | `targetDate` avant `vagueDebut` → `tDays < 0` → fallback `INTERPOLATION_LINEAIRE` | VERT |

### Stratégie LINEAIRE (non-régression)

| # | Description | Résultat |
|---|-------------|----------|
| 13 | Stratégie `LINEAIRE` ignore `gompertzContext`, utilise l'interpolation linéaire | VERT |
| 14 | Sans `options` du tout → comportement ADR-028 inchangé (`LINEAIRE` par défaut) | VERT |

### Cas limites ADR-029

| # | Description | Résultat |
|---|-------------|----------|
| 15 | `gompertzMinPoints = 3` avec `r2 = 0.999` → Gompertz utilisé (trade-off n=3 accepté) | VERT |

---

## Tests ajoutés — `segmenterPeriodesAlimentaires` avec options Gompertz

| # | Description | Résultat |
|---|-------------|----------|
| 16 | Options transmises : périodes utilisent `GOMPERTZ_VAGUE` quand Gompertz valide | VERT |
| 17 | Sans options → comportement ADR-028 préservé (`VALEUR_INITIALE` sans biométries) | VERT |
| 18 | Options Gompertz LOW → fallback → `VALEUR_INITIALE` (pas de biométries) | VERT |
| 19 | Biométrie exacte sur une borne + Gompertz sur l'autre → `methodeEstimation = GOMPERTZ_VAGUE` (conservateur) | VERT |
| 20 | Deux biométries exactes sur les deux bornes avec Gompertz configuré → `BIOMETRIE_EXACTE` | VERT |
| 21 | `gainBiomasseKg` calculé avec poids Gompertz aux bornes (valeur exacte vérifiée) | VERT |

---

## Tests ajoutés — `methodeRank` (ordre de priorité 0-3)

| # | Description | Résultat |
|---|-------------|----------|
| 22 | `BIOMETRIE_EXACTE` (rang 3) > `GOMPERTZ_VAGUE` (rang 2) → `GOMPERTZ_VAGUE` conservateur | VERT |
| 23 | `GOMPERTZ_VAGUE` (rang 2) > `INTERPOLATION_LINEAIRE` (rang 1) → `INTERPOLATION_LINEAIRE` conservateur | VERT |
| 24 | `INTERPOLATION_LINEAIRE` (rang 1) > `VALEUR_INITIALE` (rang 0) → `VALEUR_INITIALE` conservateur | VERT |
| 25 | `BIOMETRIE_EXACTE` (rang 3) sur les deux bornes → `BIOMETRIE_EXACTE` | VERT |

---

## Tests de non-régression ADR-028 (31 tests préexistants)

Tous les tests ADR-028 existants passent sans modification. Les fonctions `interpolerPoidsBac`
et `segmenterPeriodesAlimentaires` conservent leur comportement antérieur quand `options`
n'est pas fourni.

---

## Cas de test non couverts (hors périmètre ADR-029)

Les cas suivants ont été délibérément exclus du périmètre de ce sprint :

- **Gompertz avec `gompertzWeight` retournant `NaN`** : le modèle `W(t) = W∞ × exp(−exp(−k×(t−ti)))`
  ne produit pas de NaN pour des paramètres bien formés (wInfinity > 0, k > 0, ti réel, t ≥ 0).
  Le cas NaN est gardé dans le code mais est théoriquement inaccessible avec des données DB valides.
  Le code le gère avec `!isNaN(poids)` → fallback linéaire.

- **Tests d'intégration `computeAlimentMetrics`** : la couche `analytics.ts` passe les options
  Gompertz depuis la DB. Des tests d'intégration complets nécessiteraient un mock Prisma, hors
  périmètre ADR-029.

---

## État de la suite de tests complète

```
Test Files : 8 failed (PRÉ-EXISTANTS) | 126 passed (134)
Tests      : 24 failed (PRÉ-EXISTANTS) | 4146 passed (4196 total, 26 todo)
```

Les 24 échecs sont tous **antérieurs à ADR-029** et concernent :

| Fichier de test | Domaine |
|-----------------|---------|
| `permissions.test.ts` | Décompte de permissions (Sprint 30+) |
| `abonnements-statut-middleware.test.ts` | Middleware abonnement |
| `bacs.test.ts` | Quota enforcement — plan DECOUVERTE |
| `vagues-distribution.test.ts` | Distribution BUG-033 |
| `vagues.test.ts` | API vagues |
| `proxy-redirect.test.ts` | Middleware redirections INGENIEUR |
| `quota-enforcement.test.ts` | Plan DECOUVERTE NO_SUBSCRIPTION |
| `check-subscription.test.ts` | `isBlocked(null)` |

Aucun de ces échecs n'est introduit par ADR-029.

---

## Build

```
npm run build → OK
```

Aucune erreur TypeScript. Le nouveau type `StrategieInterpolation.GOMPERTZ_VAGUE` dans
`methodeEstimation` est correctement reconnu par le compilateur.

---

## Verdict

**VERT — Tests ADR-029 : 25/25 passants. Non-régression ADR-028 : 31/31 passants.**
