# ERR-070 à ERR-073 — Leçons de l'intégration ADR-036 (FCR-by-feed)

**Sprint :** ADR-036 intégration UI+API | **Date :** 2026-04-06
**Référence ADR :** `docs/decisions/ADR-036-fcr-by-feed-algorithm.md`

---

## Contexte

L'intégration de l'algorithme ADR-036 (FCR par aliment) dans le reste de l'application a consisté à :

1. Remplacer le corps de `computeAlimentMetrics` dans `src/lib/queries/analytics.ts` par un wrapper qui délègue à `getFCRByFeed`.
2. Supprimer `getFCRTrace` et sa route API `fcr-trace`.
3. Réécrire `FCRTransparencyDialog` pour afficher le détail bac × période (ADR-036) au lieu de la trace ADR-031.
4. Ajouter `saisonFilter` à `FCRByFeedParams` et l'implémenter dans `getFCRByFeed`.
5. Nettoyer les types `FCRTrace*` devenus code mort.
6. Réécrire les mocks des tests `feed-analytics-fournisseurs.test.ts`.

Ces entrées documentent les quatre leçons structurelles de cette intégration.

---

## ERR-070 — Wrapper sur grande fonction : les champs secondaires (SGR, ADG, PER, tauxSurvie, scoreQualite) peuvent être oubliés

**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/analytics.ts` (`computeAlimentMetrics`)

### Symptôme

Quand on remplace le corps d'une grande fonction par un appel à une fonction déléguée (`getFCRByFeed`), on se concentre naturellement sur le champ principal — ici le FCR. Les champs secondaires (SGR, ADG, PER, taux de survie, score qualité) sont calculés séparément dans le wrapper et ne viennent pas de `getFCRByFeed`. Si la pré-analyse n'a pas établi un mapping exhaustif, ces champs peuvent être retournés `null` sans erreur apparente, ou pire, calculés sur une base incohérente avec le FCR.

### Cause racine

`getFCRByFeed` ne retourne que les métriques liées à l'alimentation (FCR, consommation kg, gain biomasse). Les métriques de croissance et de survie (SGR, ADG, PER, tauxSurvie) sont calculées par d'autres fonctions (`calculerSGR`, `calculerADG`, `calculerPER`, `calculerTauxSurvie`) qui ont besoin des relevés biométriques et de mortalité — données que `getFCRByFeed` n'expose pas dans son résultat.

Lors du remplacement, si l'auteur ne consulte pas la liste complète des champs du type retourné (`AnalytiqueAliment`), il peut omettre de câbler SGR, ADG, PER et tauxSurvie dans le wrapper. Ces champs ont du être recalculés dans `computeAlimentMetrics` via une seconde query (biométries + mortalités par vague IDs).

### Fix appliqué

La pré-analyse (voir `docs/reviews/pre-analysis-ADR-036-integration.md`) a produit un mapping exhaustif de tous les champs avant d'écrire une seule ligne :

| Champ `computeAlimentMetrics` | Source dans `getFCRByFeed` | Transformation |
|-------------------------------|----------------------------|----------------|
| `fcrMoyen` | `FCRByFeedResult.fcrGlobal` | Direct |
| `quantiteTotale` | `FCRByFeedResult.totalAlimentKg` | Direct |
| `coutTotal` | `totalAlimentKg × prixUnitaire` | Calcul identique |
| `nombreVagues` | `nombreVaguesIncluses + nombreVaguesIgnorees` | Somme des deux |
| `sgrMoyen` | Calculé via `calculerSGR()` sur les biométries vague | Wrapper recalcule |
| `tauxSurvieAssocie` | Calculé via mortalités vague | Wrapper recalcule |
| `adgMoyen` | Calculé via `calculerADG()` | Wrapper recalcule |
| `perMoyen` | Calculé via `calculerPER()` | Wrapper recalcule |
| `scoreQualite` | `calculerScoreAliment(fcrMoyen, sgrMoyen, ...)` | Wrapper recalcule |

Le wrapper fait une query séparée pour les relevés biométriques/mortalités des vagues identifiées par `getFCRByFeed`, puis calcule SGR/ADG/PER/tauxSurvie sur cette base.

### Leçon / Règle

Avant de remplacer une grande fonction par un wrapper délégant à une sous-fonction, lister TOUS les champs du type retourné et tracer explicitement l'origine de chacun dans la nouvelle implémentation. Ne pas supposer que la sous-fonction couvre tout. La pré-analyse doit produire ce mapping complet — toute case "Wrapper recalcule" dans le mapping indique du code supplémentaire à écrire dans le wrapper.

---

## ERR-071 — `saisonFilter` avec mapping de mois : dépendance géographique non documentée

**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/queries/fcr-by-feed.ts` (`dateMatchesSaison`), `src/types/fcr-by-feed.ts`

### Symptôme

La feature FD.3 (filtrage des consommations par saison sèche/pluies) utilise un mapping mois → saison défini dans `fcr-by-feed.ts` :

```typescript
/** Mois (1-12) de la saison seche au Cameroun : novembre, decembre, janvier, fevrier, mars */
const MOIS_SECHE = new Set([11, 12, 1, 2, 3]);

function dateMatchesSaison(date: Date, saisonFilter?: "SECHE" | "PLUIES"): boolean {
  if (!saisonFilter) return true;
  const mois = date.getUTCMonth() + 1; // 1-12
  if (saisonFilter === "SECHE") return MOIS_SECHE.has(mois);
  return !MOIS_SECHE.has(mois); // PLUIES
}
```

Ce mapping (SECHE = nov, déc, jan, fév, mar) est correct pour le Cameroun mais incorrect pour d'autres pays. Un futur développeur qui adapte l'application à un autre pays de la zone tropicale (ex. Sénégal : saison sèche = nov à mai) trouvera une constante silencieusement fausse.

### Cause racine

La pré-analyse (incohérence 5 de `pre-analysis-ADR-036-integration.md`) a identifié que `saisonFilter` n'existait pas dans `FCRByFeedParams` avant l'intégration. L'ajout a été fait directement dans `fcr-by-feed.ts` sans créer une couche de configuration géographique. Le mapping de mois est une constante hardcodée.

### Fix appliqué

Le commentaire explicite le contexte géographique :
```typescript
/** Mois (1-12) de la saison seche au Cameroun : novembre, decembre, janvier, fevrier, mars */
const MOIS_SECHE = new Set([11, 12, 1, 2, 3]);
```

L'enum `saisonFilter` reste dans `FCRByFeedParams` comme paramètre optionnel, documenté comme "applicable aux climatologies tropicales à deux saisons".

### Leçon / Règle

Tout mapping de dates vers des catégories climatiques ou calendaires (saisons, périodes fiscales, cycles agricoles) doit être :
1. Documenté explicitement avec le pays/région d'origine dans le commentaire.
2. Isolé dans une constante nommée (jamais inline dans la condition).
3. Marqué comme "site-specific" si l'application est multi-pays.

Pour ce projet : `MOIS_SECHE` est Cameroun-spécifique. Si DKFarm s'étend à d'autres pays, cette constante devra être externalisée dans la configuration `Site` ou `ConfigElevage`.

---

## ERR-072 — Types code mort dans le barrel export après remplacement d'un algorithme

**Sévérité :** Basse (compilation OK, maintenance dégradée)
**Fichier(s) :** `src/types/calculs.ts`, `src/types/index.ts`

### Symptôme

Après la migration vers ADR-036, les types `FCRTrace`, `FCRTraceVague`, `FCRTracePeriode`, `FCRTraceGompertzParams`, `FCRTraceEstimationBiomasse`, `FCRTraceEstimationPopulation`, `FCRTraceEstimationPoids` (définis dans `src/types/calculs.ts`) sont devenus code mort :
- `getFCRTrace` dans `analytics.ts` a été supprimé.
- La route `fcr-trace/route.ts` a été supprimée.
- `FCRTransparencyDialog` a été réécrit sans importer ces types.

Pourtant ces types restaient dans `src/types/index.ts` (lignes 542-551) et exportés publiquement. Un agent qui consulte le barrel export croit que ces types sont en usage actif.

### Cause racine

Quand un algorithme est remplacé par un autre, on supprime le code (fonctions, routes, composants) mais on oublie de supprimer les types associés du barrel export. TypeScript ne signale pas d'erreur si un type exporté n'est pas utilisé — contrairement à une variable ou une fonction. Les types morts dans un barrel sont invisibles au compilateur.

### Fix appliqué

La pré-analyse (incohérence 4 de `pre-analysis-ADR-036-integration.md`) avait identifié ce problème comme "à traiter en dernière étape, après validation qu'aucun import extérieur ne les utilise". Après suppression de `getFCRTrace` et de la route, les types `FCRTrace*` ont été retirés de `src/types/calculs.ts` et de `src/types/index.ts`.

### Leçon / Règle

Quand un algorithme ou une feature est supprimé, procéder dans l'ordre inverse de la dépendance :
1. Supprimer les consommateurs (composants, routes, pages).
2. Supprimer les fonctions (queries, helpers).
3. Supprimer les types du fichier de définition.
4. Retirer les re-exports du barrel `index.ts`.

Ne jamais oublier l'étape 4. Faire une recherche `grep -r "FCRTrace"` pour confirmer qu'aucun import résiduel n'existe avant de supprimer les définitions. Les types non utilisés dans un barrel sont une forme de dette documentaire qui induit en erreur les futurs développeurs.

---

## ERR-073 — Dialog avec deux modes (lazy vs pre-loaded) : le mode par défaut doit être le plus sûr

**Sévérité :** Basse (UX)
**Fichier(s) :** `src/components/analytics/fcr-transparency-dialog.tsx`

### Symptôme

La pré-analyse avait identifié un risque architectural (R1) : `FCRTransparencyDialog` avait besoin de `parVague: DetailAlimentVague[]` pour afficher le détail bac × période (ADR-036), mais la page liste `/analytics/aliments` ne charge que `ComparaisonAliments` — sans `parVague`. Deux options existaient :
- (a) Enrichir la page liste pour charger `getDetailAliment` par produit (N appels, coûteux).
- (b) Conserver un fetch lazy via la route `fcr-by-feed`.

### Cause racine

Le dialog était initialement conçu pour recevoir `produitId` seul et faire son propre fetch API. Après ADR-036, il avait besoin des données enrichies (`parVague`) pour la page détail, mais la page liste ne les avait pas.

### Fix appliqué

Le dialog a été réécrit pour supporter les deux modes via une interface à prop optionnelle :

```typescript
interface FCRTransparencyDialogProps {
  produitId: string;
  produitNom: string;
  fcrMoyen: number | null;
  /** Pre-loaded per-vague data (from detail page). If absent, lazy-fetched from API. */
  parVague?: DetailAlimentVague[];
}
```

- Si `parVague` est fourni (page détail) : `FCRByFeedContentFromParVague` est rendu directement, sans fetch réseau.
- Si `parVague` est absent (page liste) : `FCRByFeedContentLazy` est rendu, avec fetch vers `/api/analytics/aliments/[produitId]/fcr-by-feed` au montage du dialog.

La route `fcr-by-feed` a été créée pour le mode lazy. Le mode lazy est le "mode par défaut" : si la page ne fournit pas `parVague`, le dialog se débrouille seul.

### Leçon / Règle

Quand un composant dialog peut être invoqué depuis des contextes avec des disponibilités de données différentes (page détail avec données pré-chargées vs page liste avec données partielles), concevoir une interface à mode optionnel :
- Le mode pré-chargé (`parVague?: Type`) est la voie rapide (zéro fetch réseau, idéal pour le détail).
- Le mode lazy (`produitId` seul) est le fallback universel (toujours disponible, avec indicateur de chargement).

Cette approche évite de créer deux composants distincts ou d'enrichir inutilement la page liste. Le mode lazy nécessite une route API dédiée — prévoir de la créer en même temps que le composant, pas après.
