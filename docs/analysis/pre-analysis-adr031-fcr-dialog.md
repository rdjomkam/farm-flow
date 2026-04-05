# Pré-analyse ADR-031 — FCR Transparency Dialog

**Date :** 2026-04-05
**Analysé par :** @pre-analyst

---

## Statut : GO AVEC RÉSERVES

---

## Résumé

Les types ADR-031 sont entièrement implémentés dans `src/types/calculs.ts` et exportés dans `src/types/index.ts`. Le Dialog Radix est disponible. Deux réserves bloquantes à corriger avant de commencer l'implémentation : (1) `@radix-ui/react-accordion` et `@radix-ui/react-collapsible` ne sont PAS installés dans `package.json`, mais l'ADR les utilise pour la structure interne du dialog ; (2) `interpolerPoidsBac` retourne `{ poids, methode }` sans les points d'encadrement (`pointAvant`, `pointApres`, `ratio`) nécessaires pour produire `FCRTraceEstimationInterpolationLineaire`.

---

## Vérifications effectuées

### 1. Schema ↔ Types : OK

Les types ADR-031 sont tous présents dans `src/types/calculs.ts` (lignes 737–992) :
- `MethodeEstimationPoids`
- `FCRTraceGompertzParams`
- `FCRTraceEstimationBiometrieExacte`
- `FCRTraceEstimationInterpolationLineaire`
- `FCRTraceEstimationGompertz`
- `FCRTraceEstimationValeurInitiale`
- `FCRTraceEstimationDetail`
- `FCRTracePeriode`
- `FCRTraceVague`
- `FCRTrace`

Les exports sont tous présents dans `src/types/index.ts` (lignes 541–551).

**Note mineure :** Dans `FCRTrace.strategieInterpolation`, le type défini en `calculs.ts` est `string` alors que l'ADR spécifie `StrategieInterpolation` (l'enum). C'est un affaiblissement délibéré possible (JSON-serializable), mais à confirmer avec l'implémenteur. L'ADR écrit `StrategieInterpolation` (enum importé).

### 2. API ↔ Queries : OK (routes existantes)

Pattern d'API route existant confirmé :
- `src/app/api/analytics/aliments/route.ts` — GET, `requirePermission(request, Permission.STOCK_VOIR)`, `auth.activeSiteId`
- `src/app/api/analytics/aliments/[produitId]/route.ts` — GET, même pattern, `params: Promise<{ produitId: string }>`

La nouvelle route `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` devra respecter exactement ce même pattern.

`getFCRTrace` n'existe pas encore dans `src/lib/queries/analytics.ts` — attendu.

`computeAlimentMetrics` est une fonction interne (non exportée), localisée à la ligne 419. Elle n'appelle pas `interpolerPoidsBac` directement — elle passe par `segmenterPeriodesAlimentaires`. L'implémenteur de `getFCRTrace` devra appeler `interpolerPoidsBac` individuellement pour collecter les détails d'estimation, conformément à la section 8 de l'ADR.

### 3. Navigation ↔ Permissions : OK

Pas de nouveau item de navigation requis. Le dialog s'ouvre depuis `FeedComparisonCards` qui est déjà intégré dans `src/components/pages/analytics-aliments-page.tsx`. La page est accessible via la navigation existante.

### 4. Build : NON EXÉCUTÉ

Build non exécuté (pré-analyse uniquement). Le build existant est supposé clean d'après les commits récents.

### 5. Tests : NON EXÉCUTÉS

---

## Incohérences trouvées

### INC-1 — Packages Accordion et Collapsible absents (BLOQUANT)

L'ADR spécifie l'utilisation de `Accordion` et potentiellement `Collapsible` Radix UI pour les sections vague et période. Ni `@radix-ui/react-accordion` ni `@radix-ui/react-collapsible` ne figurent dans `package.json`.

**Fichiers concernés :** `package.json`

**Fix :** Installer l'un des deux avant de démarrer :
- Option A (Accordion) : `npm install @radix-ui/react-accordion` + créer `src/components/ui/accordion.tsx`
- Option B (alternative légère sans nouveau package) : implémenter la section vague comme un `<details>/<summary>` HTML natif stylé en Tailwind — pas de dépendance Radix supplémentaire

L'option B est compatible avec les contraintes du projet (pas de package lourd non justifié). L'implémenteur doit trancher et documenter le choix.

### INC-2 — `interpolerPoidsBac` retourne `{ poids, methode }` mais pas les détails d'interpolation (BLOQUANT pour la trace)

`getFCRTrace` doit produire `FCRTraceEstimationDetail` pour chaque borne. Pour `INTERPOLATION_LINEAIRE`, il faut `pointAvant`, `pointApres` et `ratio`. Ces données sont calculées en interne dans `interpolerPoidsBac` (`src/lib/feed-periods.ts`, lignes 216–225) mais ne sont PAS retournées dans le type de retour actuel `{ poids, methode }`.

**Fichiers concernés :** `src/lib/feed-periods.ts`

**Fix recommandé (ADR-031 section 8) :** Modifier le type de retour de `interpolerPoidsBac` pour inclure un champ optionnel `detail: FCRTraceEstimationDetail | null`. Les appelants existants (`segmenterPeriodesAlimentaires`) peuvent ignorer le champ `detail` — pas de breaking change sur leur usage.

**Variante sans modifier `interpolerPoidsBac` :** Dupliquer la logique d'interpolation dans `getFCRTrace` localement. Moins propre, mais évite de toucher `feed-periods.ts` et donc les tests existants.

### INC-3 — `FCRTrace.strategieInterpolation` est typé `string` au lieu de `StrategieInterpolation`

Dans `src/types/calculs.ts` ligne 970, le champ est `strategieInterpolation: string` alors que l'ADR-031 le déclare comme `StrategieInterpolation` (l'enum importé depuis `models.ts`).

**Fichiers concernés :** `src/types/calculs.ts`

**Impact :** Faible — les deux types sont compatibles à l'usage (l'enum est une string au runtime). Cependant, utiliser `string` perd la validation TypeScript côté consommateur. Cohérence avec R2 (toujours importer les enums).

**Fix :** Importer `StrategieInterpolation` en haut de `calculs.ts` et typer `strategieInterpolation: StrategieInterpolation`.

### INC-4 — Page détail aliment `src/app/analytics/aliments/[produitId]/page.tsx` existe mais pas dans un dossier serveur App Router

Le fichier existe à `src/app/analytics/aliments/[produitId]/page.tsx`. La nouvelle route `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` doit être créée dans `src/app/api/...` (route API), pas dans `src/app/analytics/...` (page). Cette distinction est correcte dans l'ADR — juste confirmation que les deux chemins sont différents et ne se confondent pas.

---

## Inventaire complet des fichiers

### Fichiers à CRÉER

| Chemin | Type | Statut |
|--------|------|--------|
| `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` | API route GET | A créer |
| `src/components/analytics/fcr-transparency-dialog.tsx` | Client component | A créer |
| `src/components/ui/accordion.tsx` | UI component (si option A choisie) | A créer si Accordion retenu |

### Fichiers à MODIFIER

| Chemin | Modification | Complexité |
|--------|-------------|------------|
| `src/lib/queries/analytics.ts` | Ajouter `getFCRTrace(siteId, produitId)` | Haute — réplique le pipeline complet de `computeAlimentMetrics` avec collecte des détails |
| `src/lib/feed-periods.ts` | Enrichir le type de retour de `interpolerPoidsBac` avec `detail` (si option recommandée) | Moyenne — modifier type de retour + remplir les détails selon chaque branche |
| `src/components/analytics/feed-comparison-cards.tsx` | Ajouter `FeedFCRTransparencyTrigger` après `BenchmarkBadge` | Faible |
| `src/messages/fr/analytics.json` | Ajouter clés `analytics.fcrTrace.*` (36 clés) | Faible |
| `src/messages/en/analytics.json` | Idem pour EN | Faible |
| `src/types/calculs.ts` | Corriger `strategieInterpolation: StrategieInterpolation` (INC-3) | Trivial |
| `package.json` | Ajouter `@radix-ui/react-accordion` (si option A) | Trivial |

### Fichiers à LAISSER TELS QUELS

| Chemin | Raison |
|--------|--------|
| `src/types/calculs.ts` (lignes 737–992) | Types ADR-031 déjà implémentés |
| `src/types/index.ts` (lignes 541–551) | Exports ADR-031 déjà présents |
| `src/components/ui/dialog.tsx` | Dialog Radix disponible, `DialogBody` + `DialogHeader` conformes |
| `src/app/api/analytics/aliments/route.ts` | Non impacté |
| `src/app/api/analytics/aliments/[produitId]/route.ts` | Non impacté |
| `src/components/pages/analytics-aliments-page.tsx` | Non impacté (passe `siteId` via props implicite) |
| `src/lib/feed-periods.ts` (si variante sans modification) | Non impacté |

---

## Risques identifiés

### R1 — Divergence de logique entre `computeAlimentMetrics` et `getFCRTrace`

Les deux fonctions doivent produire des FCR cohérents. Toute future modification du pipeline de calcul (nouvel ADR) devra être répercutée manuellement dans les deux fonctions. Ce risque est documenté dans l'ADR-031 (section Conséquences).

**Impact :** Moyen — silencieux (pas de build failure)
**Mitigation :** Test unitaire `getFCRTrace` qui vérifie que `fcrMoyenFinal` == `fcrMoyen` produit par `computeAlimentMetrics` sur la même fixture.

### R2 — Breaking change potentiel sur `interpolerPoidsBac` si type de retour modifié

Si l'implémenteur choisit d'enrichir le type de retour de `interpolerPoidsBac`, tous les callsites dans `segmenterPeriodesAlimentaires` sont affectés. Actuellement il n'y a que 2 appels (lignes 385 et 392 de `feed-periods.ts`).

**Impact :** Faible — les callsites n'utilisent que `.poids` et `.methode`, un champ `detail` optionnel n'est pas breaking
**Mitigation :** Typer `detail` comme optionnel dans le type de retour.

### R3 — Volume de la trace sur mobile

Une vague avec 5 bacs × 4 périodes alimentaires = 20 `FCRTracePeriode` à rendre. Le `DialogContent` avec `max-h-[90dvh] overflow-y-auto` est défini dans l'ADR, mais le composant `Dialog` existant sur mobile utilise `inset-0 rounded-none` (plein écran). La hauteur mobile n'est pas cappée à 90dvh dans le composant actuel — il utilise `h-full md:max-h-[85dvh]`.

**Impact :** Faible — le dialog plein écran mobile est scrollable, pas de problème fonctionnel
**Mitigation :** L'implémenteur doit utiliser `<DialogBody>` (composant existant avec `flex-1 overflow-y-auto`) pour le contenu scrollable.

### R4 — Clés i18n manquantes dans `analytics.json`

36 clés `analytics.fcrTrace.*` n'existent pas encore. Si le composant est rendu avant l'ajout des clés, next-intl lancera des warnings en dev et affichera les clés brutes.

**Impact :** Moyen — visible en dev et prod
**Mitigation :** Ajouter les clés i18n en premier, avant d'implémenter le composant.

---

## Prérequis manquants

1. Décision sur la stratégie Accordion : installer `@radix-ui/react-accordion` + créer le composant UI, ou utiliser `<details>/<summary>` natif. Cette décision doit être prise et documentée AVANT que l'implémenteur commence `fcr-transparency-dialog.tsx`.

2. Décision sur `interpolerPoidsBac` : modifier son type de retour pour exposer les détails (recommandé), ou dupliquer la logique dans `getFCRTrace`. Si modification choisie, exécuter `npx vitest run` après pour vérifier qu'aucun test existant ne régresse.

---

## Recommandation

**GO AVEC RÉSERVES** — Corriger INC-1 (choix et installation Accordion) et INC-3 (`strategieInterpolation: StrategieInterpolation`) avant de commencer. INC-2 est une décision d'implémentation à trancher (modifier `interpolerPoidsBac` ou dupliquer) — les deux options sont viables mais doivent être actées.

L'architecture est solide : les types sont en place, le Dialog Radix est disponible, le pattern API route est établi, et `computeAlimentMetrics` dans `analytics.ts` fournit un modèle précis de ce que `getFCRTrace` doit reproduire.
