# Rapport de test — Bugfix ICA Vague-level (analytics.ts)

**Date :** 2026-04-06
**Agent :** @tester
**Fichier testé :** `src/lib/queries/analytics.ts`
**Fichier de tests :** `src/__tests__/lib/analytics-ica.test.ts`
**Référence :** `docs/analysis/pre-analysis-bugfix-ICA-vague.md`

---

## Périmètre

Vérification des trois corrections apportées dans `analytics.ts` :

| Bug | Fonction | Description du fix |
|-----|----------|--------------------|
| BUG 1 | `getComparaisonVagues` | Réducteur hybride `totalAliment` : priorité à `quantiteAliment`, fallback sur `SUM(consommations)` |
| BUG 2 | `getAnalyticsDashboard.tendanceFCR` | Même réducteur hybride + ajout de `consommations` dans le select de la query |
| BUG 3 | `getAnalyticsDashboard.tendanceFCR` | Gain biomasse mensuel basé sur les biométries intra-mois (première et dernière), guard ≥2 biométries |

---

## Résultats des tests

### Suite ciblée

```
npx vitest run src/__tests__/lib/analytics-ica.test.ts

Test Files  1 passed (1)
      Tests  32 passed (32)
   Duration  472ms
```

Tous les 32 tests passent.

### Suite complète

```
npx vitest run

Test Files  11 failed | 127 passed (138)
      Tests  81 failed | 4328 passed | 26 todo (4435)
   Duration  25.69s
```

**81 échecs — identiques à la baseline pré-bugfix** documentée dans le rapport pré-analyse.
Aucun nouvel échec introduit par le bugfix ou les nouveaux tests.

### Build production

```
npm run build

✓ Compiled successfully in 14.6s
✓ Generating static pages using 11 workers (146/146) in 872.3ms
```

Build propre — aucune erreur TypeScript, aucune erreur Next.js.

---

## Cas de test couverts

### BUG 1 + BUG 2 — Réducteur hybride totalAliment (13 tests)

| # | Scénario | Résultat attendu |
|---|----------|-----------------|
| 1 | Saisie directe uniquement | `quantiteAliment` utilisé, consommations vides ignorées |
| 2 | `quantiteAliment` non-null + consommations présentes | `quantiteAliment` a priorité — pas de cumul |
| 3 | Stock-linked uniquement (`quantiteAliment` null) | Somme des `consommations[].quantite` |
| 4 | Mix direct + stock-linked | Addition correcte, pas de double-comptage |
| 5 | Aucun aliment et aucune consommation | Retourne 0 |
| 6 | Liste vide | Retourne 0 |
| 7 | `quantiteAliment = 0` | Traité comme valeur valide (0), pas de fallback stock |
| 8 | Plusieurs stock-linked avec plusieurs consommations | Somme complète et correcte |
| 9 | Double-saisie explicite (non-régression) | Résultat = `quantiteAliment`, pas `quantiteAliment + SUM(conso)` |

### BUG 3 — Gain intra-mois (9 tests)

| # | Scénario | Résultat attendu |
|---|----------|-----------------|
| 1 | 0 biométrie dans le mois | `null` — pas de point FCR |
| 2 | 1 biométrie dans le mois | `null` — guard actif |
| 3 | 2 biométries — poids croissant | Gain = `biomasse(derniere) - biomasse(premiere)` |
| 4 | 3 biométries — utilise première et dernière | Gain correct (pas somme des gains intermédiaires) |
| 5 | Poids décroissant | `null` — FCR non émis |
| 6 | Même poids début et fin | `null` — gain = 0, FCR non émis |
| 7 | `poidsMoyen = null` sur première bio | `null` |
| 8 | `poidsMoyen = null` sur dernière bio | `null` |
| 9 | Cohérence avec `calculerBiomasse` | Gain = `calculerBiomasse(fin) - calculerBiomasse(debut)` |

### Intégration FCR mensuel (7 tests)

| # | Scénario | Résultat attendu |
|---|----------|-----------------|
| 1 | Stock-linked + ≥2 biométries | FCR calculé correctement |
| 2 | Direct + ≥2 biométries | FCR inchangé vs avant bugfix (régression OK) |
| 3 | Stock-linked + 1 biométrie seulement | FCR null (BUG 3 guard) |
| 4 | Stock-linked + 0 biométries | FCR null |
| 5 | Aucun aliment + gain positif | FCR = 0 |
| 6 | Double-saisie + biométries | FCR basé sur `quantiteAliment` uniquement |
| 7 | Poids décroissant + aliment | FCR null |

### Régression avant/après bugfix (3 tests BUG 1, 3 tests BUG 3)

- Confirmation que le code original retournait `totalAliment = 0` pour les relevés stock-linked
- Confirmation que le fix retourne la valeur correcte depuis les consommations
- Confirmation que le code original calculait le gain depuis J0 (constant pour tous les mois)
- Confirmation que le fix calcule le gain intra-mois correct par mois

---

## Invariants vérifiés

1. **Pas de double-comptage** : un relevé avec `quantiteAliment` non-null + consommations → seul `quantiteAliment` est utilisé.
2. **Guard ≥2 biométries** : si un mois n'a pas au moins 2 biométries, aucun point FCR n'est émis (comportement voulu, documenté).
3. **Formule biomasse** : le gain intra-mois est strictement cohérent avec `calculerBiomasse(poids, n) = (poids * n) / 1000`.
4. **Nullabilité** : tous les cas de nullabilité sur `poidsMoyen`, `quantiteAliment`, listes vides → retourne `null` de manière prévisible.
5. **Priorité clair** : `quantiteAliment = 0` est reconnu comme valeur valide (zéro) et ne déclenche pas le fallback stock.

---

## Hors périmètre (bugs satellites non couverts)

Conformément au rapport pré-analyse, les occurrences suivantes du même pattern `quantiteAliment ?? 0` ne sont pas couvertes par ce bugfix et ce rapport :

- `computeIndicateursBac` (analytics.ts ligne 88)
- `getIndicateursVague` (indicateurs.ts ligne 54)
- `getDashboardProjections` (dashboard.ts ligne 179)
- `getDashboardIndicateurs` (dashboard.ts ligne 409)
- `detectFCRAlerte` (engineer-alerts.ts ligne 227)

Ces occurrences constituent des bugs satellites à traiter dans un sprint dédié.

---

## Conclusion

**BUGFIX VALIDÉ.**

- 32 nouveaux tests, tous verts.
- 81 échecs préexistants, inchangés — aucune régression introduite.
- Build production propre.
- Les trois invariants métier des bugs 1, 2 et 3 sont couverts par des tests de non-régression.
