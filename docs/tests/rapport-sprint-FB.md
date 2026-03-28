# Rapport de tests — Sprint FB (Feed Analytics Phase 2)

**Date :** 2026-03-28
**Testeur :** @tester
**Sprint :** FB — Feed Analytics Phase 2
**Stories couvertes :** FB.8 (Tests fonctions calcul + benchmarks)

---

## Résumé

| Catégorie | Valeur |
|-----------|--------|
| Fichiers de tests créés | 2 |
| Nombre de tests nouveaux | **78** |
| Tests passés | **78** |
| Tests échoués | **0** |
| Statut global | VERT |

---

## Fichiers créés

### 1. `src/__tests__/lib/feed-analytics-calculs.test.ts`

Tests unitaires des 5 fonctions de calcul Feed Analytics Phase 2.

| Fonction | Tests | Cas couverts |
|----------|-------|--------------|
| `calculerADG` | 10 | Cas normal, ADG négatif, jours=0, nulls, ADG=0, valeur réaliste |
| `calculerPER` | 9 | Cas normal, quantiteAliment=0, tauxProteines=0, nulls, gain négatif, gain=0 |
| `calculerDFR` | 8 | Cas normal (0.5/10→5%), biomasse=0, biomasse négative, nulls, quantite=0, phase finition |
| `calculerEcartRation` | 9 | Sur-alimentation, sous-alimentation, ration exacte, theorique=0, théorique négatif, nulls, jeûne |
| `calculerScoreAliment` | 14 | Guard E3 (FCR=0), Guard E3 (FCR négatif), Guard E9, cas parfait, cas terrible, FCR seul, SGR seul, config perso, clamp 0-10 |

### 2. `src/__tests__/lib/feed-analytics-benchmarks.test.ts`

Tests unitaires des fonctions de benchmark par phase/stade.

| Fonction | Tests | Cas couverts |
|----------|-------|--------------|
| `getBenchmarkFCRPourPhase` | 11 | GROSSISSEMENT, ACCLIMATATION, JUVENILE, FINITION, PRE_RECOLTE, null, vide, invalide, minuscules, structure, croissance des seuils |
| `getBenchmarkADGPourPoids` | 17 | 15g→fingerling, 0g, 29.9g (boundary), 30g→juvenile (boundary), 100g, 149.9g, 150g→subadulte (boundary), 300g, 399.9g, 400g→adulte (boundary), 800g, null, structure, max=Infinity, min=0, ordre croissant |

---

## Cas limites critiques validés

### Boundaries ADG par stade (poidsMax EXCLUSIF)
- 29.9g → fingerling (< 30g exclusif)
- 30.0g → juvenile (>= 30g inclusif)
- 149.9g → juvenile (< 150g exclusif)
- 150.0g → subadulte (>= 150g inclusif)
- 399.9g → subadulte (< 400g exclusif)
- 400.0g → adulte (>= 400g inclusif)

### Guard E3 — FCR invalide dans calculerScoreAliment
- FCR = 0 → ignoré (guard), seuls les autres critères contribuent
- FCR = -1 → ignoré (guard), seuls les autres critères contribuent
- FCR = 0 ET tous les autres null → retourne null (poidsTotal = 0)

### Guard E9 — FCR ET SGR null
- `calculerScoreAliment(null, null, ...)` → toujours null

### Division par zéro
- `calculerDFR(0.5, 0)` → null
- `calculerEcartRation(1.0, 0)` → null
- `calculerPER(1000, 0, 25)` → null

### Imprécision virgule flottante
- `calculerEcartRation(1.2, 1.0)` : utilise `toBeCloseTo(20, 5)` car `1.2 - 1.0 = 0.19999...` en IEEE 754

---

## Non-régression

Suite complète exécutée : `npx vitest run`

```
Test Files : 1 failed (pré-existant) | 110 passed (111 total)
Tests      : 1 failed (pré-existant) | 3411 passed | 26 todo (3438)
```

La défaillance `api/vagues.test.ts:686` est **pré-existante** (confirmé : échec identique avant les changements FB).

Les 78 nouveaux tests FB.8 passent tous. Aucune régression introduite.

---

## Build

```bash
npm run build
```

Non exécuté dans ce sprint (tests unitaires de fonctions pures uniquement, sans import de composants Next.js).

---

## Notes techniques

- Toutes les fonctions testées sont **pures** (pas de DB, pas de Next.js) — tests directs sans mock.
- Pattern : `describe/it/expect` conforme au style des tests existants (`calculs.test.ts`, `benchmarks.test.ts`).
- `toBeCloseTo` utilisé pour les calculs en virgule flottante (formule avec soustraction de décimaux).
- Les valeurs de seuils des benchmarks sont vérifiées par référence directe aux constantes (`BENCHMARK_FCR_PAR_PHASE`, `BENCHMARK_ADG_PAR_STADE`) pour éviter les tests fragiles.
