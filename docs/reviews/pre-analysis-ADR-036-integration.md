# Pré-analyse ADR-036 — Intégration FCR-by-feed dans UI et API routes

**Date :** 2026-04-06
**Statut : GO AVEC RÉSERVES**

---

## Résumé

L'algorithme FCR-by-feed (Step 1) est entièrement implémenté dans `src/lib/queries/fcr-by-feed.ts` avec 25 tests passants. L'intégration (Step 2) consiste à remplacer `computeAlimentMetrics` et `getFCRTrace` dans `analytics.ts`, modifier `FCRTransparencyDialog` pour supprimer l'appel API séparé, et supprimer la route `fcr-trace`. Un test existant (`feed-analytics-fournisseurs.test.ts`) est déjà cassé indépendamment de cet ADR — il constitue la seule réserve bloquante.

---

## Vérifications effectuées

### Schema ↔ Types : OK

- `src/types/fcr-by-feed.ts` : types `FCRByFeedParams`, `PeriodeBacFCR`, `EstimationPopulationBac`, `FCRBacPeriode`, `FCRByFeedVague`, `FCRByFeedResult` — présents et cohérents avec l'implémentation.
- `src/types/calculs.ts` : `DetailAlimentVague` contient déjà les champs ADR-036 (`periodesBac?: FCRBacPeriode[]`, `flagLowConfidence?: boolean`). Le champ `avecInterpolation` a déjà été retiré. **Le type cible est déjà en place.**
- `src/types/index.ts` : barrel export des types `fcr-by-feed` déjà présent (lignes 554-563). Barrel export des types `FCRTrace*` toujours présent (lignes 542-551) — à retirer après la migration.

### API ↔ Queries : PROBLEMES IDENTIFIÉS

**Route à supprimer :**
- `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` : route active, importe `getFCRTrace` depuis `analytics.ts`. Doit être supprimée.

**Route à créer :**
- `src/app/api/analytics/aliments/[produitId]/fcr-by-feed/route.ts` : route optionnelle pour accès externe (ADR-036 §10). Non encore créée.

**Callers de `computeAlimentMetrics` dans `analytics.ts` :**
1. Ligne 956 — `getComparaisonAliments` : appel avec `saisonFilter`
2. Ligne 1054 — `getDetailAliment` : appel sans filtre saison
3. Lignes 1104-1105 — `getSimulationChangementAliment` : deux appels parallèles
4. Ligne 1302 — `getAnalyticsDashboard` : appel dans la boucle "meilleur aliment"
5. Ligne 2328 — `getScoresFournisseurs` : appel dans la boucle par fournisseur

**Caller de `getFCRTrace` :**
- `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` — unique caller externe.
- `getFCRTrace` est exportée depuis `analytics.ts` (ligne 2416).

**Contrats API inchangés (vérifiés) :**
- `src/app/api/analytics/aliments/route.ts` — retourne `ComparaisonAliments`, contrat inchangé.
- `src/app/api/analytics/aliments/[produitId]/route.ts` — retourne `DetailAliment`, contrat inchangé.
- `src/app/api/analytics/aliments/simulation/route.ts` — retourne `SimulationResult`, contrat inchangé.

### Navigation ↔ Permissions : OK

La page `src/app/analytics/aliments/[produitId]/page.tsx` importe `getDetailAliment` depuis `analytics.ts` — le contrat reste `DetailAliment`. La page ne charge PAS `getFCRTrace` directement. Le `FCRTransparencyDialog` est invoqué depuis `feed-comparison-cards.tsx` avec `produitId` et `fcrMoyen`.

### Build : NON TESTÉ (build long, non bloquant pour l'analyse)

### Tests : 87 ECHECS / 4403 — DONT 6 PRÉEXISTANTS LIÉS À L'ADR-036

**Tests ADR-036 :** 25/25 passent (`src/__tests__/lib/fcr-by-feed.test.ts`).

**Tests API analytics-aliments :** 14/14 passent (`src/__tests__/api/analytics-aliments.test.ts`). Les contrats API sont stables.

**Tests feed-analytics-fournisseurs : 6/11 ÉCHOUENT — PROBLÈME PRÉEXISTANT.**
Les tests mockent `prisma.releveConsommation.findMany` sans le champ `bacId` dans `releve` :
```typescript
// Mock actuel dans les tests (ligne ~147)
{ quantite: 50, releve: { id: "rel-1", vagueId: "vague-1", date: new Date("2026-01-15") } }
```
Or `computeAlimentMetrics` (ligne 452-462 de `analytics.ts`) attend `bacId` dans le select de `releve`. Ce bug est **préexistant à l'ADR-036** — le mock est incomplet depuis au moins la correction ADR-028. La migration vers `getFCRByFeed` aggraveraient ces échecs si le nouveau wrapper passe par un chemin DB différent.

**Autres échecs (87 total) :** Liés à des sprints non-ADR-036 (`abonnements-statut-middleware`, `vagues-distribution`, `permissions`, `plan-form-dialog`) — hors périmètre de cette analyse.

---

## Incohérences trouvées

### 1. `feed-analytics-fournisseurs.test.ts` — mock incomplet de `releveConsommation`
**Fichiers :** `src/__tests__/lib/feed-analytics-fournisseurs.test.ts`
**Problème :** Les 6 tests qui fournissent des données de consommation omettent `bacId` dans le sous-objet `releve` du mock. Quand `computeAlimentMetrics` est remplacé par un wrapper appelant `getFCRByFeed`, cette fonction fera ses propres requêtes DB (via `prisma.releveConsommation.findMany` avec un select différent, incluant `bac`). Les mocks actuels ne couvriront pas ces appels.
**Suggestion de fix :** Avant d'implémenter le wrapper, mettre à jour ces mocks pour inclure `bacId` dans `releve`. Après remplacement, les mocks devront refléter le nouveau chemin DB de `getFCRByFeed` (qui fait ses propres queries, pas via `computeAlimentMetrics`).

### 2. `FCRTransparencyDialog` — props à modifier (breaking change de l'interface)
**Fichier :** `src/components/analytics/fcr-transparency-dialog.tsx`
**Problème :** L'interface actuelle est :
```typescript
interface FCRTransparencyDialogProps {
  produitId: string;
  produitNom: string;
  fcrMoyen: number | null;
}
```
Après l'ADR-036, elle devient (ADR-036 §11) :
```typescript
interface FCRTransparencyDialogProps {
  produitNom: string;
  fcrMoyen: number | null;
  parVague: DetailAlimentVague[];  // contient periodesBac[]
}
```
Le caller dans `feed-comparison-cards.tsx` (ligne 231-235) passe `produitId` — ce prop disparaît. Le caller devra recevoir `parVague` depuis le composant parent, ce qui implique que `feed-comparison-cards.tsx` reçoive les données détaillées du `DetailAliment`, pas seulement `AnalytiqueAliment`.
**Suggestion de fix :** Vérifier si `feed-comparison-cards.tsx` peut recevoir `parVague` depuis la page `/analytics/aliments`. Si la page liste (`/analytics/aliments`) ne charge que `ComparaisonAliments` (sans `parVague`), il faudra soit un lazy-load par produit, soit conserver `produitId` pour un fetch à la demande.

### 3. `calibrage.sourceBacIds` — champ Prisma utilisé dans `getFCRByFeed` sans vérification
**Fichier :** `src/lib/queries/fcr-by-feed.ts` (ligne 943)
**Problème :** La fonction `getFCRByFeed` accède à `cal.sourceBacIds` (ligne 943) en supposant que ce champ existe sur le modèle `Calibrage`. Le schéma confirme que `sourceBacIds String[]` est bien présent (ligne 2279 du schema). OK.

### 4. Types `FCRTrace*` encore dans le barrel export après la migration
**Fichier :** `src/types/index.ts` (lignes 542-551)
**Problème :** Après suppression de `getFCRTrace` et du dialog ancienne version, les types `FCRTrace`, `FCRTraceVague`, `FCRTracePeriode`, `FCRTraceGompertzParams`, etc. doivent être retirés du barrel export. Actuellement encore présents dans `src/types/calculs.ts` et réexportés.
**Suggestion de fix :** Retrait en dernière étape de la migration, après validation que aucun import extérieur ne les utilise encore.

### 5. `getComparaisonAliments` — filtre saison non transmis à `getFCRByFeed`
**Fichier :** `src/lib/queries/analytics.ts` (ligne 956)
**Problème :** `computeAlimentMetrics` accepte un `saisonFilter?: "SECHE" | "PLUIES"` et filtre les `ReleveConsommation` par mois avant traitement. La signature actuelle de `getFCRByFeed` ne prend pas de `saisonFilter` — elle prend `FCRByFeedParams` (`minPoints`, `wInfinity`). Le filtre saison doit être implémenté dans le wrapper ou ajouté à `FCRByFeedParams`.
**Suggestion de fix :** Ajouter `saisonFilter?: "SECHE" | "PLUIES"` à `FCRByFeedParams` dans `src/types/fcr-by-feed.ts` et l'implémenter dans `getFCRByFeed` avant la query `releveConsommation`. Alternative : filtrer dans le wrapper `computeAlimentMetrics` après l'appel à `getFCRByFeed`, mais cela cassé le calcul du `fcrGlobal` (qui serait calculé sur toutes les saisons).

---

## Risques identifiés

### R1 — Changement de structure de données dans `FCRTransparencyDialog` (MOYEN)
La page liste `/analytics/aliments` charge `ComparaisonAliments` (type `AnalytiqueAliment[]`), qui ne contient pas `parVague: DetailAlimentVague[]`. Si le dialog doit recevoir `parVague`, la page liste devra soit faire N calls `getDetailAliment` (coûteux), soit conserver un appel API lazy (call à la demande au clic). L'ADR-036 §11 suppose que `parVague` vient du `DetailAliment` déjà chargé — ce qui est vrai pour la page DETAIL, pas pour la page LISTE.
**Mitigation :** Sur la page liste, conserver un appel API lazy (`/api/analytics/aliments/[produitId]/fcr-by-feed`) plutôt que de passer `parVague` en prop. Le dialog peut être adapté pour accepter soit `parVague` (mode inline), soit `produitId` (mode lazy-fetch).

### R2 — Régression des tests `getScoresFournisseurs` (HAUTE)
Les 6 tests échoués dans `feed-analytics-fournisseurs.test.ts` signifient que `getScoresFournisseurs` est actuellement non testée correctement. Après le remplacement de `computeAlimentMetrics`, le comportement pourrait changer (notamment : `getFCRByFeed` ignore les vagues avec `insufficientData: true` de l'agrégation globale, alors que l'ancien algo les incluait potentiellement). Un test de non-régression explicite pour `getScoresFournisseurs` doit être écrit.
**Mitigation :** Corriger les mocks avant d'implémenter le wrapper.

### R3 — `saisonFilter` non pris en charge par `getFCRByFeed` (HAUTE)
Si le filtre saison n'est pas intégré dans `getFCRByFeed`, la feature FD.3 (filtrage par saison sèche/pluies sur la page comparaison aliments) sera silencieusement cassée.
**Mitigation :** Ajouter `saisonFilter` à `FCRByFeedParams` avant de migrer `getComparaisonAliments`.

### R4 — Volume des requêtes DB dans `getFCRByFeed` (FAIBLE)
La fonction fait plusieurs queries séquentielles par vague (biométries, consommations, comptages, mortalités, calibrages). Sur un site avec 10 vagues × 5 aliments, `getComparaisonAliments` fera `5 × 10 × 5 = 250` queries au lieu des ~50 actuelles. Les pages de liste peuvent devenir lentes.
**Mitigation :** Acceptable en phase d'intégration. Un batch optionnel (charger toutes les vagues d'un coup) peut être ajouté plus tard.

---

## Liste exhaustive des fichiers à modifier

### Fichiers à MODIFIER

| Fichier | Changement requis | Priorité |
|---------|-------------------|----------|
| `src/types/fcr-by-feed.ts` | Ajouter `saisonFilter?: "SECHE" \| "PLUIES"` à `FCRByFeedParams` | Avant tout |
| `src/lib/queries/fcr-by-feed.ts` | Implémenter le filtre `saisonFilter` sur les `ReleveConsommation` | Avant tout |
| `src/lib/queries/analytics.ts` | Remplacer le corps de `computeAlimentMetrics` par un wrapper appelant `getFCRByFeed`; supprimer `getFCRTrace`; retirer les imports `FCRTrace*` | Core |
| `src/types/calculs.ts` | Retirer les types `FCRTrace`, `FCRTraceVague`, `FCRTracePeriode`, `FCRTraceGompertzParams` (et les 4 sous-types d'estimation) après validation | Fin |
| `src/types/index.ts` | Retirer les re-exports des types `FCRTrace*` | Fin |
| `src/components/analytics/fcr-transparency-dialog.tsx` | Remplacer le fetch API interne par des props `parVague: DetailAlimentVague[]` (ou adapter pour le cas page-liste — voir R1) | UI |
| `src/components/analytics/feed-detail-charts.tsx` | Ajouter affichage `periodesBac[]` dans `FeedVagueBreakdown` | UI |
| `src/__tests__/lib/feed-analytics-fournisseurs.test.ts` | Corriger les mocks (`bacId` manquant dans `releve`) et adapter après remplacement | Tests |

### Fichiers à SUPPRIMER

| Fichier | Raison |
|---------|--------|
| `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` | Route remplacée, données désormais dans `getDetailAliment` |

### Fichiers à CRÉER

| Fichier | Raison |
|---------|--------|
| `src/app/api/analytics/aliments/[produitId]/fcr-by-feed/route.ts` | Route optionnelle pour accès externe (ADR-036 §10, `Permission.STOCK_VOIR`) |

### Fichiers inchangés (confirmés)

- `src/lib/gompertz.ts` — réutilisé tel quel
- `src/lib/feed-periods.ts` — fonctions deprecated conservées
- `src/lib/calculs.ts` — toutes les fonctions utilitaires intactes
- `src/lib/queries/gompertz-analytics.ts` — indépendant
- `src/app/api/analytics/aliments/route.ts` — contrat inchangé
- `src/app/api/analytics/aliments/[produitId]/route.ts` — contrat inchangé
- `src/app/api/analytics/aliments/simulation/route.ts` — contrat inchangé
- `src/__tests__/lib/feed-periods.test.ts` — fonctions testées conservées
- `src/__tests__/api/analytics-aliments.test.ts` — 14/14 passent, contrats stables

---

## Mapping des anciens champs vers les nouveaux

| Champ `computeAlimentMetrics` | Source dans `getFCRByFeed` | Transformation |
|-------------------------------|----------------------------|----------------|
| `fcrMoyen` | `FCRByFeedResult.fcrGlobal` | Direct |
| `quantiteTotale` | `FCRByFeedResult.totalAlimentKg` | Direct |
| `coutTotal` | `totalAlimentKg × prixUnitaire` | Calcul identique |
| `nombreVagues` | `FCRByFeedResult.nombreVaguesIncluses + nombreVaguesIgnorees` | Somme des deux |
| `sgrMoyen` | Calculé par vague via `calculerSGR()` | Wrapper recalcule |
| `coutParKgGain` | `totalAlimentKg × prixUnitaire / totalGainBiomasseKg` | Calcul identique |
| `tauxSurvieAssocie` | Calculé via mortalités vague | Wrapper recalcule |
| `adgMoyen` | Calculé par vague via `calculerADG()` | Wrapper recalcule |
| `perMoyen` | Calculé par vague via `calculerPER()` | Wrapper recalcule |
| `scoreQualite` | `calculerScoreAliment(fcrMoyen, sgrMoyen, ...)` | Wrapper recalcule |
| `DetailAlimentVague.fcr` | `FCRByFeedVague.fcrVague` | Direct |
| `DetailAlimentVague.nombrePeriodes` | `FCRByFeedVague.periodesBac.length` | Direct |
| `DetailAlimentVague.avecChangementAliment` | `joursMixtes > 0` dans au moins une période | Logique à adapter |
| `DetailAlimentVague.avecInterpolation` | **SUPPRIMÉ** — remplacé par `flagLowConfidence` | Retiré du type |
| `DetailAlimentVague.periodesBac` | `FCRByFeedVague.periodesBac` (nouveau) | Déjà dans le type |
| `DetailAlimentVague.flagLowConfidence` | `FCRByFeedVague.flagLowConfidence` (nouveau) | Déjà dans le type |

**Point d'attention :** `computeAlimentMetrics` inclut les vagues avec `flagLowConfidence: true` dans le FCR global. `getFCRByFeed` les exclut (lignes 1022-1026 de `fcr-by-feed.ts`). Le wrapper doit décider : utiliser `fcrGlobal` de `getFCRByFeed` (exclut low-confidence) ou recalculer en incluant toutes les vagues. L'ADR-036 §3.1 dit que `fcrGlobal` est plus précis — utiliser `FCRByFeedResult.fcrGlobal` directement.

---

## Prérequis manquants

1. **`saisonFilter` dans `FCRByFeedParams`** — non implémenté dans `getFCRByFeed`. Doit être ajouté avant de migrer `getComparaisonAliments`. Sans cela, FD.3 (filtre saison) sera silencieusement cassé.

2. **Correction des mocks `feed-analytics-fournisseurs.test.ts`** — 6 tests échouent. Doivent être corrigés avant ou pendant la migration du wrapper `computeAlimentMetrics`, pour ne pas masquer des régressions réelles.

3. **Décision architecture pour `FCRTransparencyDialog` sur page liste** — la page `/analytics/aliments` charge `ComparaisonAliments` (sans `parVague`). Le dialog a besoin de `parVague` selon l'ADR-036 §11. Deux options : (a) lazy-fetch via la nouvelle route `fcr-by-feed`, ou (b) enrichir la page liste avec un appel `getDetailAliment` par produit (coûteux). La décision architecturale doit être prise avant de modifier le dialog.

---

## Recommandation

**GO AVEC RÉSERVES** — l'implémentation peut démarrer, sous réserve de traiter les 3 prérequis dans cet ordre :

1. Ajouter `saisonFilter` à `FCRByFeedParams` et `getFCRByFeed` (modification mineure des fichiers Step 1).
2. Corriger les mocks de `feed-analytics-fournisseurs.test.ts` (`bacId` manquant).
3. Trancher sur l'architecture du `FCRTransparencyDialog` pour la page liste avant de modifier le composant.

Les contrats API externes sont stables. Les 25 tests ADR-036 passent. Les 14 tests API analytics-aliments passent. L'intégration est techniquement faisable sans risque majeur si les réserves ci-dessus sont adressées.
