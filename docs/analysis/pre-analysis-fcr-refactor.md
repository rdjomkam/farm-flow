# Pré-analyse — Refactor FCR Feed Switching (ADR-028)
**Date :** 2026-04-05
**Type :** REFACTOR

---

## Statut : GO AVEC RÉSERVES

## Résumé

Le refactor est faisable sans changement de schéma Prisma ni de contrat API.
Il introduit un nouveau fichier de fonctions pures (`src/lib/feed-periods.ts`) et modifie
la logique interne de `computeAlimentMetrics` dans `analytics.ts`.
La couche UI et les tests d'API existants ne sont PAS impactés (structure de données inchangée).
Les tests de calcul existants (`calculs.test.ts`, `feed-analytics-calculs.test.ts`) restent valides.
La seule réserve est l'absence du fichier de tests unitaires requis par l'ADR (`src/tests/feed-periods.test.ts`),
qui doit être créé par le @tester avant la review.

---

## Inventaire complet des fichiers

### Fichiers à CRÉER

| Fichier | Raison |
|---------|--------|
| `src/lib/feed-periods.ts` | Fonctions pures `segmenterPeriodesAlimentaires` et `interpolerPoidsBac` (Couche 1 et 2 de l'ADR) |
| `src/tests/feed-periods.test.ts` | Tests unitaires des 5 cas définis dans l'ADR (section "Plan d'implémentation") |

### Fichiers à MODIFIER

| Fichier | Modification |
|---------|-------------|
| `src/types/calculs.ts` | Ajouter l'interface `PeriodeAlimentaire` + étendre `DetailAlimentVague` avec `nombrePeriodes?`, `avecChangementAliment?`, `avecInterpolation?` |
| `src/types/index.ts` | Ajouter `PeriodeAlimentaire` au barrel export (section "from ./calculs") |
| `src/lib/queries/analytics.ts` | Remplacer la logique FCR dans `computeAlimentMetrics` (lignes 560-638) — appeler `segmenterPeriodesAlimentaires`, agréger par période |

### Fichiers à LAISSER EN L'ÉTAT

| Fichier | Raison |
|---------|--------|
| `src/lib/calculs.ts` | `calculerFCR`, `calculerFCRParAliment`, `calculerScoreAliment` — signatures inchangées. La nouvelle logique appelle ces fonctions avec des valeurs différentes (per-période), pas de changement de signature |
| `src/components/analytics/feed-comparison-cards.tsx` | Consomme `AnalytiqueAliment` — structure inchangée |
| `src/components/analytics/feed-detail-charts.tsx` | Consomme `DetailAliment`, `DetailAlimentVague` — champs existants inchangés ; les 3 nouveaux champs sont optionnels |
| `src/components/pages/analytics-aliments-page.tsx` | Appelle `getComparaisonAliments` — signature inchangée |
| `src/app/api/analytics/aliments/route.ts` | Appelle `getComparaisonAliments` — structure de réponse inchangée |
| `src/app/api/analytics/aliments/[produitId]/route.ts` | Appelle `getDetailAliment` — structure de réponse inchangée |
| `src/app/api/analytics/aliments/simulation/route.ts` | Appelle `getSimulationChangementAliment` — non impacté |
| `src/__tests__/api/analytics-aliments.test.ts` | Mocke `getComparaisonAliments` / `getDetailAliment` — réponse mockée compatible avec les anciens et nouveaux champs |
| `src/__tests__/ui/analytics-aliments.test.tsx` | Utilise les fixtures `AnalytiqueAliment` sans les nouveaux champs optionnels — compatible |
| `src/__tests__/lib/feed-analytics-calculs.test.ts` | Teste `calculerScoreAliment` directement — pas impacté |
| `src/__tests__/calculs.test.ts` | Teste `calculerFCR`, `calculerFCRParAliment` directement — pas impacté |
| `prisma/schema.prisma` | Aucune migration requise (`Releve.bacId` et `ReleveConsommation` déjà présents) |

---

## Vérification des prérequis

### Données disponibles en base

| Donnée requise par l'ADR | Champ Prisma | Statut |
|--------------------------|-------------|--------|
| `bacId` sur les relevés alimentation | `Releve.bacId` | Présent et indexé (`@@index([bacId])`) |
| `produitId` par consommation | `ReleveConsommation.produitId` | Présent |
| `quantite` par consommation | `ReleveConsommation.quantite` | Présent |
| `poidsMoyen` par relevé biométrie | `Releve.poidsMoyen` | Présent |
| `poidsMoyenInitial` de la vague | `Vague.poidsMoyenInitial` | Présent |
| `nombreInitial` par bac | `Bac.nombreInitial` | Présent (nullable) |

Tous les champs requis par `segmenterPeriodesAlimentaires` existent déjà.
Aucune migration Prisma n'est nécessaire.

### Données déjà chargées dans `computeAlimentMetrics`

La requête DB actuelle (lignes 438-534 de `analytics.ts`) charge :
- `ReleveConsommation` avec `releve.id`, `releve.vagueId`, `releve.date`
- `Vague` avec `bacs.id`, `bacs.nombreInitial`
- Relevés BIOMETRIE, MORTALITE, COMPTAGE avec `bacId`, `poidsMoyen`

**Ce qui manque dans la requête actuelle pour l'ADR :**
1. Les relevés ALIMENTATION ne sont pas chargés séparément (seules les consommations le sont)
2. La requête `ReleveConsommation` ne ramène pas `bacId` via `releve.bacId`
3. La requête relevés ne charge pas les relevés ALIMENTATION avec leurs consommations groupées par bac

La requête devra être étendue pour charger :
- `releve.bacId` dans la sélection des `ReleveConsommation`
- Les relevés ALIMENTATION avec `bacId` et leurs consommations (`produitId`, `quantite`)

---

## Risques identifiés

### Risque 1 — Régression sur la suite `feed-analytics-calculs.test.ts`
**Description :** Ce fichier teste `calculerScoreAliment` qui est appelé à la fin de `computeAlimentMetrics`.
Après le refactor, les valeurs de `fcrMoyen` et `gainBiomasse` changeront pour les vagues avec switch d'aliment.
Si des tests de cette suite vérifient des valeurs numériques spécifiques issues d'une fixture avec switch d'aliment,
ils pourraient rompre.
**Impact :** Moyen — les tests actuels utilisent des valeurs directes en arguments, pas de fixtures DB. Pas de régression attendue.
**Mitigation :** Relancer `npx vitest run src/__tests__/lib/feed-analytics-calculs.test.ts` après le refactor (ERR-017).

### Risque 2 — `getSimulationChangementAliment` appelle `computeAlimentMetrics` deux fois (lignes 925-926)
**Description :** La simulation appelle `computeAlimentMetrics` pour les deux produits (ancien et nouveau).
Le changement de logique interne affectera les valeurs de FCR de la simulation.
Ce n'est pas un bug — c'est le comportement attendu — mais les tests de la simulation (`analytics-aliments.test.ts`)
utilisent des valeurs mockées et ne seront pas impactés.
**Impact :** Faible — comportement corrigé.

### Risque 3 — `getScoresFournisseurs` (ligne 1123) appelle aussi `computeAlimentMetrics`
**Description :** La fonction `getScoresFournisseurs` appelle `computeAlimentMetrics` en interne.
Le score fournisseur sera donc lui aussi corrigé automatiquement. Pas de régression attendue.
**Impact :** Faible — correction transparente.

### Risque 4 — Dégradation gracieuse pour les relevés sans `bacId`
**Description :** L'ADR spécifie un comportement de fallback si `bacId` est absent : "traiter comme une période vague-entière".
Dans le schéma actuel, `Releve.bacId` est nullable. Des relevés anciens pourraient ne pas avoir de `bacId`.
Le code de `segmenterPeriodesAlimentaires` devra gérer ce cas explicitement.
**Impact :** Moyen — si non géré, les périodes sans `bacId` seraient ignorées, faussant le calcul.
**Mitigation :** Implémenter le fallback comme documenté dans l'ADR (section "Règles de dégradation gracieuse").

### Risque 5 — Performance : charge supplémentaire sur la requête `computeAlimentMetrics`
**Description :** La fonction est appelée en boucle pour chaque produit ALIMENT (`for produit of produits`).
L'ajout d'une requête pour les relevés ALIMENTATION avec consommations par vague est O(n × m) DB.
Pour un site avec 20+ produits et 50+ vagues, cela pourrait allonger le temps de réponse.
**Impact :** Faible à moyen selon la taille du site.
**Mitigation :** L'ADR note que l'index `@@index([bacId])` sur `Releve` est déjà en place. La requête ALIMENTATION
peut être jointe à la requête existante des relevés (une seule requête avec `typeReleve: { in: [..., ALIMENTATION] }`)
plutôt qu'une requête séparée.

### Risque 6 — `getFCRHebdomadaire` (ligne 1687) non couvert par l'ADR
**Description :** `getFCRHebdomadaire` calcule le FCR sur une base hebdomadaire pour le graphique de tendance.
Il utilise `biosByVague` (biométries par vague sans distinction de bac) et calcule un FCR vague-entière.
Ce calcul n'est PAS corrigé par ce refactor (l'ADR ne le mentionne pas).
Si l'utilisateur consulte le graphique FCR hebdomadaire d'un aliment sur une vague avec switch, il verra
toujours l'ancien calcul approximatif.
**Impact :** Moyen — incohérence entre le FCR affiché dans la comparaison (corrigé) et dans le graphique
hebdomadaire (non corrigé).
**Mitigation :** Documenter explicitement cette incohérence résiduelle dans un commentaire dans `getFCRHebdomadaire`.
Hors scope de ce refactor selon l'ADR.

---

## Incohérences trouvées

### Incohérence 1 — La requête `computeAlimentMetrics` ne charge pas `bacId` des consommations

La requête actuelle des `ReleveConsommation` (lignes 438-451) sélectionne :
```typescript
releve: { select: { id: true, vagueId: true, date: true } }
```
Elle ne sélectionne pas `releve.bacId`. La nouvelle logique en a besoin pour associer
chaque consommation à son bac. L'implémenteur devra ajouter `bacId: true` dans ce select.

**Fichier :** `src/lib/queries/analytics.ts` ligne 443

### Incohérence 2 — La requête relevés ne charge pas ALIMENTATION

La requête `vagueReleves` (ligne 519) filtre :
```typescript
typeReleve: { in: [TypeReleve.BIOMETRIE, TypeReleve.MORTALITE, TypeReleve.COMPTAGE] }
```
Pour la segmentation des périodes, il faudra soit étendre cette requête pour inclure
`TypeReleve.ALIMENTATION` avec les consommations, soit créer une requête séparée.
Attention : si `ALIMENTATION` est ajouté ici, la structure du type de retour change
(besoin de `consommations` sur le relevé ALIMENTATION).
Recommandation : créer une requête séparée dédiée aux relevés ALIMENTATION avec leurs consommations.

**Fichier :** `src/lib/queries/analytics.ts` ligne 519-535

### Incohérence 3 — `PeriodeAlimentaire` absent du barrel export `src/types/index.ts`

Le type `PeriodeAlimentaire` sera ajouté dans `src/types/calculs.ts` mais devra aussi
être exporté depuis `src/types/index.ts` pour que les consommateurs puissent l'importer
via `@/types`. La section d'export "Sprint FB" (ligne ~531-536) devra inclure `PeriodeAlimentaire`.

**Fichier :** `src/types/index.ts` — à mettre à jour en même temps que `calculs.ts`.

---

## Prérequis manquants

Aucun prérequis bloquant. Les données nécessaires sont en base, le schéma est compatible.

---

## Recommandation

**GO** — commencer l'implémentation.

Ordre recommandé (conforme au plan de l'ADR) :

1. `@developer` — créer `src/lib/feed-periods.ts` (fonctions pures, sans dépendance DB)
2. `@developer` — mettre à jour `src/types/calculs.ts` (ajouter `PeriodeAlimentaire`, étendre `DetailAlimentVague`)
3. `@developer` — mettre à jour `src/types/index.ts` (barrel export `PeriodeAlimentaire`)
4. `@developer` — modifier `computeAlimentMetrics` dans `src/lib/queries/analytics.ts` en ajoutant le chargement de `bacId` et des relevés ALIMENTATION (Incohérences 1 et 2)
5. `@tester` — créer `src/tests/feed-periods.test.ts` avec les 5 cas définis dans l'ADR
6. Valider : `npm run build` + `npx vitest run`

Points d'attention pour l'implémenteur :
- Gérer le fallback `bacId = null` selon la règle de dégradation gracieuse (Risque 4)
- Documenter l'incohérence résiduelle de `getFCRHebdomadaire` (Risque 6)
- Vérifier ERR-017 : relancer les tests existants après le refactor

