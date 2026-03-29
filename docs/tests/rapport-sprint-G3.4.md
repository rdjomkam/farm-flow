# Rapport de tests — Sprint G3.4 — Agrégation K Gompertz par aliment

**Agent :** @tester
**Sprint :** G3 — Comparaison aliments via K Gompertz
**Story :** G3.4 — Tests agrégation K et UI
**Date :** 2026-03-29

---

## Résumé

| Catégorie | Fichier de test | Tests | Résultat |
|-----------|----------------|-------|---------|
| Lib query | `src/__tests__/lib/gompertz-analytics.test.ts` | 23 | PASS |
| UI components | `src/__tests__/ui/gompertz-feed-comparison.test.tsx` | 23 | PASS |
| **Total nouveaux** | | **46** | **PASS** |
| Suite complète | tous les fichiers | 3776 pass, 2 fail | Échecs pré-existants (route-boundaries) |
| Build production | `npm run build` | — | OK |

---

## Fichiers créés

- `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/lib/gompertz-analytics.test.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/ui/gompertz-feed-comparison.test.tsx`

---

## Tests unitaires — `gompertz-analytics.test.ts`

Teste la fonction `getKParAliment(siteId)` de `src/lib/queries/gompertz-analytics.ts`.

Prisma est mocké via `vi.mock("@/lib/db", ...)` sur `prisma.gompertzVague.findMany`.

### Cas couverts

#### 1. Tableau vide (2 tests)
- Retourne `[]` quand Prisma ne renvoie aucune entrée
- Retourne `[]` quand les relevés n'ont aucune consommation

#### 2. Filtre minimum 2 vagues par produit (3 tests)
- Exclut un produit présent dans 1 seule vague
- Inclut un produit présent dans exactement 2 vagues
- Inclut un produit présent dans 3 vagues et expose `nombreVagues=3`

#### 3. Filtre niveau de confiance (2 tests)
- Vérifie que Prisma est appelé avec `confidenceLevel: { in: ["HIGH", "MEDIUM"] }`
- Vérifie que `siteId` est inclus dans le filtre (règle R8)

#### 4. Calcul K pondéré (3 tests)
- Calcule le K pondéré correct : `(0.025×100 + 0.015×300) / 400 = 0.01750`
- Cumule les quantités de plusieurs consommations dans la même vague
- Protège contre la division par zéro (`kMoyen = 0` si toutes les quantités sont 0)

#### 5. Attribution kNiveau (3 tests)
- `kMoyen >= 0.020` → `EXCELLENT`
- `0.015 <= kMoyen < 0.020` → `BON`
- `kMoyen < 0.015` → `FAIBLE`

#### 6. Isolation siteId — R8 (2 tests)
- Passe le bon `siteId` à la query Prisma

#### 7. Tri décroissant (2 tests)
- Trie les produits par `kMoyen` décroissant (meilleur en premier)
- Vérifie la monotonie stricte de l'ordre

#### 8. Details par vague (4 tests)
- Inclut un detail par vague avec `vagueId`, `vagueCode`, `k` et `quantiteAliment`
- Expose `fournisseur` du produit ou `null`
- Cumule les quantités de plusieurs relevés d'une même vague dans `details[].quantiteAliment`

#### 9. Plusieurs produits indépendants (1 test)
- Gère deux produits différents présents chacun dans 2 vagues

#### 10. Filtre TypeReleve.ALIMENTATION (1 test)
- Vérifie que la query filtre les relevés sur `typeReleve: TypeReleve.ALIMENTATION`

---

## Tests UI — `gompertz-feed-comparison.test.tsx`

Teste `FeedComparisonCards` et `FeedKComparisonChart`.

Mocks appliqués : `next/link`, `next-intl`, `recharts`, `next/dynamic`, `@/components/analytics/benchmark-badge`, `@/lib/benchmarks`.

### FeedComparisonCards — cas couverts

#### 1. Sans données K (4 tests)
- N'affiche pas "Vitesse Gompertz" quand `kMoyenGompertz` est `undefined`
- N'affiche pas "Vitesse Gompertz" quand `kMoyenGompertz` est `null`
- Affiche quand même le nom du produit
- Affiche le message vide quand `aliments=[]`

#### 2. Avec K badge (2 tests)
- Affiche "Vitesse Gompertz" quand `kMoyenGompertz` est présent
- Affiche la valeur K formatée (`K=0.0250`)

#### 3. Badge K par niveau (3 tests)
- `EXCELLENT` → affiche "Rapide"
- `BON` → affiche "Normal"
- `FAIBLE` → affiche "Lent"

#### 4. Badge "Meilleure croissance K" (4 tests)
- Affiche le badge pour le produit correspondant à `meilleurK`
- N'affiche pas le badge si `meilleurK` est `null`
- N'affiche pas le badge si `meilleurK` est `undefined`
- Le badge n'apparaît qu'une seule fois (uniquement pour le produit gagnant)

#### 5. Mixte aliments avec et sans K (2 tests)
- La section "Vitesse Gompertz" n'apparaît que pour les aliments qui ont K
- Les deux cartes (avec et sans K) sont quand même rendues

### FeedKComparisonChart — cas couverts

#### 6. Seuil de visibilité < 2 (3 tests)
- `null` quand aucun aliment n'a de données K
- `null` quand seulement 1 aliment a des données K
- `null` quand la liste est vide

#### 7. Rendu avec données suffisantes (3 tests)
- Rend le composant quand 2 aliments ont des données K
- Affiche le titre du graphique
- Rend le composant quand 3 aliments ont des données K

#### 8. Nombre de barres (2 tests)
- Ignore les aliments sans K dans le décompte (2 avec K + 1 sans K → graphique affiché)
- 1 aliment avec K + 2 sans K → graphique masqué

---

## Non-régression

Suite complète exécutée : `npx vitest run`

- 3776 tests passent (dont les 46 nouveaux)
- 2 échecs **pré-existants** dans `src/__tests__/route-boundaries.test.ts` :
  - Ces échecs concernent la route `(farm)/settings/config-elevage` ajoutée dans le commit `c0ebf93 fix(routing): allow farm admins to access config-elevage pages`
  - Le test `route-boundaries.test.ts` n'a pas encore été mis à jour pour refléter ce changement
  - Ces échecs ne sont **pas liés à la story G3.4**

---

## Build production

```
npm run build → OK
```

Seul avertissement : `Next.js inferred your workspace root` (pré-existant, non bloquant).

---

## Conclusion

Tous les critères d'acceptation sont satisfaits :

- 46 nouveaux tests passent
- Build production OK
- Non-régression confirmée (les 2 échecs sont pré-existants)
- Couverture complète des cas listés dans la story G3.4
