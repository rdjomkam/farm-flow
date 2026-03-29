# Rapport de tests — Story G2.5 — UI Projections Gompertz

**Date :** 2026-03-29
**Auteur :** @tester
**Sprint :** Gompertz — Story G2.5
**Fichier de tests :** `src/__tests__/ui/gompertz-projections.test.tsx`

---

## Résumé

| Metrique | Valeur |
|----------|--------|
| Tests écrits | 47 |
| Tests réussis | 47 |
| Tests échoués | 0 |
| Build | OK |
| Régressions introduites | 0 |

---

## Fichier créé

`src/__tests__/ui/gompertz-projections.test.tsx`

---

## Scénarios couverts

### Scénario 1 — Aucune donnée Gompertz (5 tests)

Quand `gompertzParams` est `undefined` ou absent :

- Aucun badge Gompertz (ni HIGH, ni MEDIUM, ni LOW, ni INSUFFICIENT_DATA)
- Pas de label "Recolte Gompertz" / "Recolte SGR"
- Pas de section "Modele de croissance"
- Pas de section "Details techniques" (meme pour ADMIN)
- Les données SGR de base (code vague, date recolte estimee) restent affichées

### Scénario 2 — INSUFFICIENT_DATA (6 tests)

Quand `gompertzConfidence === "INSUFFICIENT_DATA"` et `gompertzParams === null` :

- Texte italique "Donnees insuffisantes (min. 5 biometries)" présent
- Aucun badge coloré (pas de variante terminee/warning/default)
- Pas de date de récolte Gompertz
- Pas de paramètres métier affichés
- Pas de section détails techniques (même pour ADMIN)
- Les données SGR de base restent fonctionnelles

### Scénario 3 — Confiance LOW (3 tests)

- Badge "Estimation preliminaire" (variant `default`) affiché
- Section paramètres Gompertz métier affichée
- Date de récolte Gompertz présente (avec `~90 j`)

### Scénario 4 — Confiance MEDIUM (4 tests)

- Badge "En construction" (variant `warning`) affiché
- Section paramètres Gompertz métier affichée
- Date de récolte Gompertz présente (avec `~80 j`)
- Badges LOW et HIGH absents

### Scénario 5 — Confiance HIGH (7 tests)

- Badge "Modele fiable" (variant `terminee`) affiché
- Labels "Recolte SGR" et "Recolte Gompertz" tous deux présents
- Valeur `~72 j` affiché pour la date de récolte Gompertz
- Poids plafond arrondi : `1200 g`
- Vitesse "Rapide" pour k=0.025 (>= 0.020 selon `evaluerKGompertz`)
- Pic de croissance : "jour 70"

### Scénario 6 — Visibilité détails techniques par rôle (9 tests)

- ADMIN : bouton "Details techniques" visible et déployable
- INGENIEUR : bouton "Details techniques" visible et déployable
- GERANT : bouton absent
- PISCICULTEUR : bouton absent
- `userRole === undefined` : bouton absent
- Après déploiement ADMIN : W∞, K, ti, R² affichés avec valeurs brutes précises
  - `1200.0 g`, `0.0250 j⁻¹`, `70.0 j`, `0.982`
- INGENIEUR : valeurs brutes absentes avant interaction
- ADMIN avec `gompertzParams === null` : pas de section technique

### Scénario 7 — Non-régression SGR classique (13 tests)

Toutes les fonctionnalités existantes conservées :

- Titre section "Projections de performance"
- Code vague affiché
- TCS actuel et TCS requis
- Statut "En avance" / "En retard" selon `enAvance`
- "Pas assez de donnees biometriques" quand sgrActuel est null
- Poids actuel et objectif
- Aliment restant en kg
- "Donnees insuffisantes" quand alimentRestantEstime est null
- Section vide si projections = []
- Plusieurs cartes pour plusieurs vagues
- Revenu attendu en CFA (regex tolérant le séparateur milliers locale-dépendant)
- Bloc revenu absent si `revenuAttendu === null`
- Bouton "Graphique" cliquable affiche "Courbe de croissance"

---

## Stratégie de mock

### next/dynamic + recharts
Recharts est chargé via `next/dynamic` avec `{ ssr: false }`. Les composants retournent `null`
en environnement jsdom. Le test du graphique vérifie uniquement le déclencheur UI (bouton, titre),
pas le rendu SVG recharts.

### next-intl
`useTranslations` mocké avec la map complète des clés du namespace `analytics`,
y compris les clés avec paramètres (`inDays`, `harvestInDays`, `dayUnit`).

---

## Résultats d'exécution

```
npx vitest run src/__tests__/ui/gompertz-projections.test.tsx

 ✓ src/__tests__/ui/gompertz-projections.test.tsx (47 tests) 673ms

Test Files  1 passed (1)
      Tests  47 passed (47)
```

```
npx vitest run (suite complète)

Test Files  1 failed | 117 passed (118)
      Tests  2 failed | 3730 passed (3758)
```

Les 2 tests échouants (`route-boundaries.test.ts` — config-elevage routing) sont des régressions
pré-existantes non liées à cette story (identifiées dans le sprint NC, hors périmètre G2.5).

```
npm run build → OK (aucune erreur TypeScript ou de compilation)
```

---

## Couverture des règles Phase 2

| Règle | Statut |
|-------|--------|
| R2 — Enums importés | OK (`Role.ADMIN`, `Role.INGENIEUR`, etc.) |
| R9 — Tests avant review | OK (47 tests passent, build OK) |
