# Rapport de tests — ADR-033 : FCR vague-level calculation

**Date :** 2026-04-05
**Agent :** @tester
**Fichier testé :** `src/lib/feed-periods.ts`
**Fichier de tests :** `src/__tests__/lib/feed-periods.test.ts`

---

## Résumé

| Étape | Résultat |
|-------|----------|
| Tests existants (79) | PASS — aucune régression |
| Nouveaux tests `interpolerPoidsVague` (12) | PASS |
| Nouveaux tests FCR vague-level `segmenterPeriodesAlimentaires` (5) | PASS |
| **Total tests** | **96 tests — 96 PASS** |
| Build `npm run build` | PASS — aucune erreur TypeScript |

---

## Task 1 — Tests existants

Exécution initiale : `npx vitest run src/__tests__/lib/feed-periods.test.ts`

**Résultat : 79/79 PASS.**

Aucune régression détectée sur les suites existantes :
- `interpolerPoidsBac` (ADR-028, ADR-029, ADR-031, ADR-032)
- `segmenterPeriodesAlimentaires` (ADR-028, ADR-029, ADR-032)
- `estimerNombreVivantsADate` (ADR-032)
- `methodeRank` (ADR-029, ADR-032)

---

## Task 2 — Tests `interpolerPoidsVague` (ADR-033)

12 nouveaux tests ajoutés dans le describe `interpolerPoidsVague — vague-level weight estimation (ADR-033)`.

### Tests ajoutés

| # | Description | Résultat |
|---|-------------|----------|
| 1 | BIOMETRIE_EXACTE quand correspondance exacte de date | PASS |
| 2 | BIOMETRIE_EXACTE indépendant du bacId (utilise TOUTES les biométries) | PASS |
| 3 | GOMPERTZ_VAGUE même quand zéro biométries (fonction de temps pur) | PASS |
| 4 | GOMPERTZ_VAGUE quand biométries existent mais pas de correspondance exacte | PASS |
| 5 | GOMPERTZ_VAGUE pour extrapolation au-delà de la dernière biométrie | PASS |
| 6 | INTERPOLATION_LINEAIRE entre deux biométries quand pas de Gompertz | PASS |
| 7 | VALEUR_INITIALE quand pas de biométries et pas de Gompertz | PASS |
| 8 | VALEUR_INITIALE quand seule biométrie est après la date cible (pas de Gompertz) | PASS |
| 9 | Utilise TOUTES les biométries sans filtre bacId (test clé ADR-033) | PASS |
| 10 | BIOMETRIE_EXACTE prime sur Gompertz lors d'une correspondance exacte | PASS |
| 11 | Fallback INTERPOLATION_LINEAIRE quand confidence Gompertz = LOW | PASS |
| 12 | Fallback VALEUR_INITIALE quand confidence LOW et pas de biométries | PASS |

### Points clés validés

- **DISC-01/DISC-02 (Critiques)** : `interpolerPoidsVague` ne filtre pas par `bacId` et évalue Gompertz même si `biometries.length === 0`.
- **DISC-07 (Haute)** : L'extrapolation après la dernière biométrie utilise Gompertz (méthode `GOMPERTZ_VAGUE`), pas la valeur plate.
- **Priorité correcte** : BIOMETRIE_EXACTE > GOMPERTZ_VAGUE > INTERPOLATION_LINEAIRE > VALEUR_INITIALE.

### Contexte Gompertz utilisé

```typescript
const GOMPERTZ_CTX_ADR033: GompertzVagueContext = {
  wInfinity: 1500,
  k: 0.0488,
  ti: 45.68,
  r2: 0.9909,
  biometrieCount: 12,
  confidenceLevel: "HIGH",
  vagueDebut: makeDate(0),
};
```

---

## Task 3 — Tests FCR vague-level intégration (ADR-033)

5 nouveaux tests dans le describe `segmenterPeriodesAlimentaires — vague-level Gompertz (ADR-033)`.

### Tests ajoutés

| # | Description | Résultat |
|---|-------------|----------|
| 1 | Bacs sans biométries per-bac utilisent Gompertz VAGUE (methodeEstimation = GOMPERTZ_VAGUE) | PASS |
| 2 | FCR biologiquement plausible (0.8-2.5) avec scenario calibrage | PASS |
| 3 | Les périodes à gain négatif sont exclues du calcul FCR | PASS |
| 4 | bac-03 et bac-04 (post-calibrage) ont un gain non-null avec Gompertz (test de régression DISC-01/02) | PASS |
| 5 | Le total aliment de toutes les périodes correspond à la somme attendue (145kg) | PASS |

### Scenario calibrage réaliste (test de régression DISC-01/02)

```
Vague: 1300 poissons, 4 bacs, Gompertz W∞=1500, K=0.0488, ti=45.68
Calibrage J25: bac-01→130, bac-03→520, bac-04→650 (+20 morts)
Alimentation Skretting 3mm sur tous les bacs après calibrage
Total feed = 145kg
```

**Avant ADR-033** : bac-03 et bac-04 (sans biométrie per-bac) → VALEUR_INITIALE → gain = 0 → FCR artificiel.
**Après ADR-033** : `interpolerPoidsVague` évalue Gompertz → gain > 0 → FCR plausible.

### Scenario FCR avec données calibrées

Utilise des paramètres Gompertz (W∞=1000, K=0.03, ti=50) et des populations modestes pour produire un FCR ≈ 1.82 :
- bac-s1 (40 poissons post-calibrage) : gain = 3.52kg, food = 6kg → FCR = 1.70
- bac-s2 (160 poissons, nouveau bac) : gain = 14.08kg, food = 26kg → FCR = 1.85
- FCR vague = 32 / 17.60 ≈ 1.82 (dans la plage 0.8–2.5)

---

## Task 4 — Vérification finale

```
npx vitest run src/__tests__/lib/feed-periods.test.ts
  96 tests — 96 PASS

npm run build
  Build: PASS (aucune erreur TypeScript, aucune erreur de compilation)
```

---

## Analyse des discrepancies ADR-033 couvertes par les tests

| DISC | Sévérité | Description | Couvert par |
|------|----------|-------------|-------------|
| DISC-01 | Critique | `interpolerPoidsBac` filtre par `bacId` | Tests 2, 9 de `interpolerPoidsVague` |
| DISC-02 | Critique | Gompertz non évalué si aucune biométrie per-bac | Tests 3, 4, "bac-03/04 gain non-null" |
| DISC-07 | Haute | Extrapolation plate après dernière biométrie | Test 5 (GOMPERTZ_VAGUE pour extrapolation) |

---

## Fichiers modifiés

- `src/__tests__/lib/feed-periods.test.ts` — +17 tests (de 79 à 96)
