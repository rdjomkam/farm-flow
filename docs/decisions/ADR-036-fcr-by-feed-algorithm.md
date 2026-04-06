# ADR-036 — FCR par aliment : remplacement complet de `computeAlimentMetrics`

**Statut :** Accepté
**Date :** 2026-04-06 (révisé après analyse complète du 2026-04-06)
**Auteur :** @architect
**Dépend de :** ADR-033 (FCR vague-level), ADR-034 (Gompertz VAGUE toujours actif)
**Référence algorithme :** `docs/analysis/fcr-by-feed-algorithm.md`

---

## 1. Contexte

### 1.1 Le système actuel

Le calcul FCR par aliment est entièrement encapsulé dans la fonction **`computeAlimentMetrics`** (interne à `src/lib/queries/analytics.ts`, ~400 lignes). Elle est appelée par quatre fonctions publiques :

| Appelant | Rôle |
|----------|------|
| `getComparaisonAliments` | Page liste aliments (`/analytics/aliments`) |
| `getDetailAliment` | Page détail aliment (`/analytics/aliments/[produitId]`) |
| `getSimulationChangementAliment` | Simulateur de changement d'aliment |
| `getAnalyticsDashboard` | Dashboard analytique global |
| `getScoresFournisseurs` | Score agrégé par fournisseur |

La fonction `getFCRTrace` (publique) reproduit **le même pipeline** que `computeAlimentMetrics` mais collecte des détails intermédiaires pour le dialog de transparence FCR.

Le **problème structural** est que `computeAlimentMetrics` part des `bacs` de la vague (`Bac.vagueId`) pour construire le contexte de population. Or après un calibrage, un bac peut être désassigné — ses données de consommation avant le calibrage sont ignorées. L'algorithme documenté dans `docs/analysis/fcr-by-feed-algorithm.md` corrige ce défaut en partant de `ReleveConsommation` pour découvrir tous les bacs ayant réellement consommé l'aliment.

### 1.2 Pourquoi un remplacement complet et non une route parallèle

La version initiale de cet ADR proposait d'ajouter une route distincte `fcr-by-feed` en conservant `computeAlimentMetrics` inchangée. Cette approche est **rejetée** pour les raisons suivantes :

1. **Incohérence des métriques** : deux algorithmes différents produisant des FCR différents pour le même aliment créent de la confusion pour l'utilisateur.
2. **Code mort** : `computeAlimentMetrics` et `getFCRTrace` seraient progressivement abandonnés au profit du nouvel algorithme, laissant ~700 lignes de code actif mais obsolète.
3. **Duplication de logique** : `segmenterPeriodesAlimentairesVague`, `estimerNombreVivantsVague`, la construction du contexte Gompertz — tout serait dupliqué.
4. **Surface de maintenance** : deux pipelines à maintenir quand les modèles DB évoluent (ex. ajout d'un champ sur `Calibrage` ou `ReleveConsommation`).

**Décision : le nouvel algorithme FCR-by-feed REMPLACE intégralement `computeAlimentMetrics` et `getFCRTrace`.** Toutes les métriques actuellement produites par ces fonctions doivent être produites par le nouvel algorithme.

---

## 2. Cartographie complète des métriques à préserver

Le tableau suivant mappe chaque métrique produite par `computeAlimentMetrics` vers son équivalent dans le nouvel algorithme. Aucune métrique existante ne doit être perdue.

### 2.1 Métriques de `AnalytiqueAliment` (sortie de `getComparaisonAliments`)

| Métrique | Source actuelle (`computeAlimentMetrics`) | Source dans le nouvel algo |
|----------|-------------------------------------------|----------------------------|
| `fcrMoyen` | Agrégé depuis `segmenterPeriodesAlimentairesVague` | Agrégé depuis `aggregerFCRVague` |
| `sgrMoyen` | `calculerSGR(poidsMoyenInitial, poidsMoyenFin, jours)` | **Préservé** : même calcul SGR vague, inchangé |
| `coutParKgGain` | `coutTotal / totalGain` | **Préservé** : `coutTotal / totalGainBiomasseKg` |
| `tauxSurvieAssocie` | `calculerTauxSurvie(nombreVivants, nombreInitial)` | **Préservé** : inchangé, basé sur mortalités |
| `adgMoyen` | `calculerADG(poidsMoyenInitial, poidsMoyenFin, jours)` | **Préservé** : inchangé |
| `perMoyen` | `calculerPER(gainPoidsG, quantite, tauxProteines)` | **Préservé** : inchangé |
| `scoreQualite` | `calculerScoreAliment(fcrMoyen, sgrMoyen, ...)` | **Préservé** : même score composite |
| `quantiteTotale` | Somme des `ReleveConsommation.quantite` | **Préservé** : même source DB |
| `coutTotal` | `quantiteTotale × prixParUniteBase` | **Préservé** : identique |
| `nombreVagues` | Nombre de vagues avec données | **Préservé** : `parVague.length` |
| `tailleGranule`, `formeAliment`, etc. | Champs produit DB | **Préservé** : inchangés |
| `kMoyenGompertz`, `kNiveauGompertz` | Injectés depuis `getKParAliment` par la page UI | **Préservé** : source externe non modifiée |

### 2.2 Métriques de `DetailAlimentVague` (sortie de `getDetailAliment`)

| Métrique | Source actuelle | Source dans le nouvel algo |
|----------|-----------------|----------------------------|
| `fcr` | FCR vague (ADR-033) | `FCRByFeedVague.fcrVague` |
| `sgr` | SGR vague simple | **Préservé** |
| `coutParKgGain` | Coût/kg vague | **Préservé** |
| `adg`, `per` | Calculs vague | **Préservé** |
| `tauxMortaliteAssocie` | Taux mortalité vague | **Préservé** |
| `nombrePeriodes` | Nombre de périodes dans le run de l'aliment | `FCRByFeedVague.periodesBac.length` |
| `avecChangementAliment` | Produits multiples détectés | **Adapté** : `joursMixtes > 0` dans au moins une période |
| `avecInterpolation` | Au moins une période avec interpolation linéaire | Supprimé — non applicable au nouvel algo (voir §3.3) |

### 2.3 Métriques de `FCRTrace` (sortie de `getFCRTrace`)

La trace de transparence FCR est reconstruite **entièrement** à partir des données du nouvel algorithme. Le type `FCRTrace` est remplacé par un type étendu qui inclut les nouvelles informations (bac × période).

---

## 3. Décisions architecturales

### 3.1 Le FCR vague dans le nouvel algorithme est la même formule

L'agrégation du nouvel algorithme (étape 8) produit :

```
FCR_vague = Σ(qtyAlimentKg) / Σ(gainBiomasseKg) pour toutes les périodes valides
```

C'est **la même formule** que l'ADR-033 (`totalAlimentValide / totalGainValide`). La différence est dans ce qui est inclus dans `Σ` : le nouvel algorithme inclut les bacs désassignés post-calibrage, l'ancien non. Le FCR produit par le nouvel algorithme est **plus précis et remplace** l'ancien.

### 3.2 SGR, ADG, PER, taux de survie restent calculés au niveau vague

Ces métriques n'ont pas de sens au niveau bac × période car elles utilisent des données globales (poids initial de la vague, durée totale). Elles continuent d'être calculées au niveau vague par les fonctions de `src/lib/calculs.ts`, inchangées.

### 3.3 `avecInterpolation` devient obsolète

Dans l'ancien algorithme, `avecInterpolation` signalait quand la méthode `INTERPOLATION_LINEAIRE` était utilisée pour estimer le poids (au lieu de `BIOMETRIE_EXACTE` ou `GOMPERTZ_VAGUE`). Le nouvel algorithme n'estime pas le poids en deux points d'une période — il utilise directement le gain journalier Gompertz (`dailyGain(t) = weight(t) - weight(t-1)`). Ce champ n'a plus de sens et est **retiré** de `DetailAlimentVague`. Le flag remplaçant est `flagLowConfidence` (R² < 0.85) qui donne une information plus utile sur la qualité du modèle.

### 3.4 `getFCRTrace` est remplacé par les données intégrées dans le résultat principal

Dans l'ancienne architecture, `getFCRTrace` était un second call API depuis `FCRTransparencyDialog` (`GET /api/analytics/aliments/[produitId]/fcr-trace`). Le nouvel algorithme produit directement le détail bac × période dans la réponse principale de `getDetailAliment`. Le dialog de transparence lira ces données depuis le `DetailAliment` déjà chargé sur la page, sans call API supplémentaire.

---

## 4. Plan de migration — fichiers affectés

### 4.1 Fichiers à CRÉER

| Fichier | Rôle | Lignes estimées |
|---------|------|----------------|
| `src/types/fcr-by-feed.ts` | Types TypeScript de l'algorithme | ~180 |
| `src/lib/queries/fcr-by-feed.ts` | Logique pure + orchestration (8 étapes) | ~400 |
| `src/__tests__/lib/fcr-by-feed.test.ts` | Tests unitaires (fonctions pures) | ~250 |

### 4.2 Fichiers à MODIFIER

| Fichier | Modification | Impact |
|---------|-------------|--------|
| `src/types/calculs.ts` | Modifier `DetailAlimentVague` : retirer `avecInterpolation`, ajouter `periodesBac: FCRBacPeriode[]` et `flagLowConfidence: boolean` | Types partagés |
| `src/types/index.ts` | Ajouter exports depuis `fcr-by-feed.ts` | Barrel export |
| `src/lib/queries/analytics.ts` | Remplacer `computeAlimentMetrics` et `getFCRTrace` par des wrappers appelant `getFCRByFeed` et `getFCRByFeedTrace` | Core analytics |
| `src/lib/queries/index.ts` | Mettre à jour exports si nécessaire | Barrel export queries |
| `src/components/analytics/fcr-transparency-dialog.tsx` | Lire `periodesBac` depuis `DetailAlimentVague` (plus de call API) | UI dialog |
| `src/components/analytics/feed-detail-charts.tsx` | Afficher les nouvelles métriques bac × période | UI charts |

### 4.3 Fichiers à SUPPRIMER

| Fichier | Raison |
|---------|--------|
| `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` | Remplacé : les données de trace sont dans `getDetailAliment` |

### 4.4 Fichiers inchangés

| Fichier | Raison |
|---------|--------|
| `src/lib/gompertz.ts` | Réutilisé tel quel (`calibrerGompertz`, `gompertzWeight`, `isCachedGompertzValid`) |
| `src/lib/feed-periods.ts` | Conservé pour les fonctions non remplacées (`interpolerPoidsVague`, `estimerNombreVivantsVague`, `CalibragePoint`). Les fonctions `@deprecated` (`segmenterPeriodesAlimentaires`, `estimerNombreVivantsADate`, `interpolerPoidsBac`) restent en place mais ne sont plus appelées par le chemin principal |
| `src/lib/calculs.ts` | Toutes les fonctions de calcul utilitaires réutilisées telles quelles |
| `src/lib/queries/gompertz-analytics.ts` | `getKParAliment` indépendant — non affecté |
| `src/app/api/analytics/aliments/route.ts` | Contrat inchangé — même réponse `ComparaisonAliments` |
| `src/app/api/analytics/aliments/[produitId]/route.ts` | Contrat inchangé — même réponse `DetailAliment` |
| `src/app/api/analytics/aliments/simulation/route.ts` | Contrat inchangé — même réponse `SimulationResult` |
| `prisma/schema.prisma` | Aucune migration nécessaire |
| `src/__tests__/lib/feed-periods.test.ts` | Tests des fonctions `feed-periods.ts` préservées |
| `src/__tests__/api/analytics-aliments.test.ts` | Tests API conservés (contrats inchangés) |

---

## 5. Nouveaux types TypeScript (`src/types/fcr-by-feed.ts`)

```typescript
// ─── Inputs ────────────────────────────────────────────────────────────────

export interface FCRByFeedParams {
  /** Nombre minimum de points biométriques pour Gompertz. Défaut : 5 */
  minPoints?: number;
  /** Poids asymptotique W∞ (g). Null = utiliser ConfigElevage ou CLARIAS_DEFAULTS. */
  wInfinity?: number | null;
}

// ─── Types intermédiaires internes ────────────────────────────────────────

/**
 * Classification d'un jour de consommation dans un bac.
 */
export type JourConsommationType = "EXCLUSIVE" | "MIXED";

/**
 * Période de consommation d'un aliment dans un bac (Step 5).
 */
export interface PeriodeBacFCR {
  bacId: string;
  bacNom: string;
  dateDebut: Date;
  dateFin: Date;
  /** Nombre de jours calendaires (dateFin - dateDebut + 1) */
  dureeJours: number;
  /** Quantité totale aliment cible en kg (jours exclusifs + jours mixtes rattachés) */
  qtyTargetKg: number;
  /** Nombre de jours exclusifs */
  joursExclusifs: number;
  /** Nombre de jours mixtes rattachés */
  joursMixtes: number;
}

/**
 * Estimation de la population d'un bac sur une période (Step 6).
 */
export interface EstimationPopulationBac {
  bacId: string;
  countDebut: number;
  countFin: number;
  avgCount: number;
  methode: "COMPTAGE_ANCRAGE" | "PROPORTIONNEL_INITIAL";
}

// ─── Types de sortie ──────────────────────────────────────────────────────

/**
 * FCR calculé pour une période dans un bac (Step 7).
 * Utilisé dans DetailAlimentVague.periodesBac et FCRByFeedVague.periodesBac.
 */
export interface FCRBacPeriode {
  bacId: string;
  bacNom: string;
  dateDebut: Date;
  dateFin: Date;
  dureeJours: number;
  qtyAlimentKg: number;
  /** Gain de poids par poisson (g) = Σ dailyGain(t) pour t in [debut, fin] */
  gainParPoissonG: number;
  avgFishCount: number;
  /** gainParPoissonG × avgFishCount / 1000 (kg) */
  gainBiomasseKg: number;
  /** null si gainBiomasseKg <= 0 */
  fcr: number | null;
  /** FCR > 3.0 — possible erreur ou très peu de poissons */
  flagHighFCR: boolean | null;
}

/**
 * FCR agrégé pour une vague, avec détail par bac × période.
 */
export interface FCRByFeedVague {
  vagueId: string;
  vagueCode: string;
  dateDebut: Date;
  dateFin: Date | null;

  /** Paramètres Gompertz calibrés (null si données insuffisantes) */
  gompertz: {
    wInfinity: number;
    k: number;
    ti: number;
    r2: number;
    biometrieCount: number;
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  } | null;

  /** R² < 0.85 → FCR peu fiable */
  flagLowConfidence: boolean;
  /** < minPoints biométries → vague ignorée de l'agrégation globale */
  insufficientData: boolean;

  totalAlimentKg: number;
  totalGainBiomasseKg: number;
  /** null si aucune période valide */
  fcrVague: number | null;

  periodesBac: FCRBacPeriode[];
}

/**
 * Résultat complet de l'algorithme FCR par aliment.
 * Intégré dans DetailAliment.fcr-by-feed et retourné en standalone par getFCRByFeed.
 */
export interface FCRByFeedResult {
  produitId: string;
  produitNom: string;
  fournisseurNom: string | null;
  prixUnitaire: number;
  params: { minPoints: number; wInfinity: number | null };
  fcrGlobal: number | null;
  totalAlimentKg: number;
  totalGainBiomasseKg: number;
  nombreVaguesIncluses: number;
  nombreVaguesIgnorees: number;
  parVague: FCRByFeedVague[];
}
```

---

## 6. Modifications des types existants (`src/types/calculs.ts`)

### `DetailAlimentVague` — champs ajoutés/retirés

```typescript
export interface DetailAlimentVague {
  vagueId: string;
  vagueCode: string;
  quantite: number;
  fcr: number | null;
  sgr: number | null;
  coutParKgGain: number | null;
  periode: { debut: Date; fin: Date | null };
  adg: number | null;
  per: number | null;
  tauxMortaliteAssocie: number | null;
  kGompertz?: number | null;
  nombrePeriodes?: number;
  avecChangementAliment?: boolean;
  // RETIRÉ : avecInterpolation (obsolète, remplacé par flagLowConfidence)
  // AJOUTÉ :
  /** Détail bac × période (nouvel algorithme ADR-036) */
  periodesBac?: FCRBacPeriode[];
  /** true si R² Gompertz < 0.85 pour cette vague */
  flagLowConfidence?: boolean;
}
```

---

## 7. Couche queries (`src/lib/queries/fcr-by-feed.ts`)

### 7.1 Signature de la fonction principale

```typescript
/**
 * Calcule le FCR pour un produit aliment en utilisant l'algorithme ADR-036.
 *
 * Contrairement à computeAlimentMetrics (ADR-033) :
 * - Démarre des ReleveConsommation (pas de Bac.vagueId) → inclut bacs désassignés
 * - Calcule gain/poisson via table journalière Gompertz (pas gain biomasse endpoints)
 * - Produit le détail bac × période pour l'audit de transparence
 *
 * @param siteId    - ID du site (multi-tenancy)
 * @param produitId - ID du produit aliment
 * @param params    - minPoints (défaut: 5), wInfinity optionnel
 * @returns FCRByFeedResult ou null si produit introuvable
 */
export async function getFCRByFeed(
  siteId: string,
  produitId: string,
  params?: FCRByFeedParams
): Promise<FCRByFeedResult | null>
```

### 7.2 Fonctions pures internes (toutes exportées pour tests)

```typescript
/**
 * Step 4 — Table journalière (poids, gain) entre deux jours relatifs à la vague.
 * gain(t) = weight(t) - weight(t-1)
 */
export function buildDailyGainTable(
  params: GompertzParams,
  dayFrom: number,
  dayTo: number
): Map<number, { poids: number; gain: number }>

/**
 * Step 5 — Segmente les jours de consommation d'un bac en périodes.
 * Règles : jours exclusifs consécutifs = une période ; jours mixtes rattachés
 * à la période adjacente la plus proche ; gaps >= 1 jour = rupture.
 * Invariant : sum(qtyTargetKg) over périodes = total conso bac.
 */
export function segmenterPeriodesParBac(
  consoByDay: Map<string, {
    qtyTargetKg: number;
    autresProduits: { produitId: string; quantiteKg: number }[];
  }>,
  bacId: string,
  bacNom: string
): PeriodeBacFCR[]

/**
 * Step 6 — Estime {countDebut, countFin, avgCount} pour un bac sur une période.
 * Ancrage = dernier COMPTAGE avant dateFin ± mortalités.
 * Fallback = répartition proportionnelle de vague.nombreInitial / nbBacs.
 */
export function estimerPopulationBac(
  bacId: string,
  dateDebut: Date,
  dateFin: Date,
  comptages: Array<{ date: Date; nombreCompte: number }>,
  mortalitesBac: Array<{ date: Date; nombreMorts: number }>,
  calibrages: CalibragePoint[],
  vagueNombreInit: number,
  nbBacsVague: number
): EstimationPopulationBac

/**
 * Step 7 — FCR pour une période dans un bac.
 * gainParPoissonG = Σ dailyGain(t) pour t in [debut, fin]
 * gainBiomasseKg = gainParPoissonG × avgFishCount / 1000
 * fcr = qtyAlimentKg / gainBiomasseKg (null si gain <= 0)
 */
export function calculerFCRPeriodeBac(
  periode: PeriodeBacFCR,
  dailyGain: Map<number, { poids: number; gain: number }>,
  population: EstimationPopulationBac,
  vagueDebut: Date
): FCRBacPeriode

/**
 * Step 8 — Agrège les FCR de toutes les périodes d'une vague.
 * FCR_vague = sum(qtyAlimentKg valide) / sum(gainBiomasseKg valide)
 */
export function aggregerFCRVague(
  periodes: FCRBacPeriode[]
): { totalAlimentKg: number; totalGainBiomasseKg: number; fcrVague: number | null }
```

### 7.3 Réutilisation du code existant

| Étape | Fonction réutilisée | Source |
|-------|---------------------|--------|
| Step 3 — Calibrage Gompertz | `calibrerGompertz`, `isCachedGompertzValid` | `src/lib/gompertz.ts` |
| Step 3 — Poids journalier | `gompertzWeight(t, params)` | `src/lib/gompertz.ts` |
| Step 6 — Type calibrage | `CalibragePoint` | `src/lib/feed-periods.ts` |
| Step 6 — Population secours | `estimerNombreVivantsVague` (fallback) | `src/lib/feed-periods.ts` |
| Métriques SGR/ADG/PER | `calculerSGR`, `calculerADG`, `calculerPER` | `src/lib/calculs.ts` |
| Prix normalisé | `getPrixParUniteBase` | `src/lib/calculs.ts` |

---

## 8. Remplacement de `computeAlimentMetrics` dans `analytics.ts`

La fonction `computeAlimentMetrics` est remplacée par un wrapper `computeAlimentMetricsFromFCRByFeed` qui :

1. Appelle `getFCRByFeed(siteId, produit.id, { minPoints })`
2. Extrait les métriques agrégées (`fcrMoyen`, `quantiteTotale`, `parVague`, etc.)
3. Calcule SGR, ADG, PER, scoreQualite à partir des données vague (calculs non FCR inchangés)
4. Retourne le même type `{ analytique: AnalytiqueAliment; parVague: DetailAlimentVague[]; evolutionFCR: ... }`

Les quatre callers (`getComparaisonAliments`, `getDetailAliment`, `getSimulationChangementAliment`, `getAnalyticsDashboard`, `getScoresFournisseurs`) **ne changent pas de signature**. Leurs contrats de retour sont préservés.

```typescript
// Remplacement interne dans analytics.ts
async function computeAlimentMetrics(
  siteId: string,
  produit: ProduitInput,
  saisonFilter?: "SECHE" | "PLUIES" | null
): Promise<{
  analytique: AnalytiqueAliment;
  parVague: DetailAlimentVague[];
  evolutionFCR: { date: string; fcr: number }[];
}> {
  // Délègue au nouvel algorithme
  const result = await getFCRByFeed(siteId, produit.id);
  if (!result) return emptyMetrics(produit);

  // Filtre saison si nécessaire (logique saison préservée)
  // ...

  // Construit AnalytiqueAliment depuis FCRByFeedResult
  // Calcule SGR, ADG, PER, scoreQualite par vague (logique préservée)
  // Retourne même forme que l'ancienne fonction
}
```

---

## 9. Remplacement de `getFCRTrace`

`getFCRTrace` est remplacé par une fonction `getFCRByFeedTrace` qui extrait le détail bac × période depuis `getFCRByFeed` et le formate pour l'UI de transparence.

La route `GET /api/analytics/aliments/[produitId]/fcr-trace/route.ts` est **supprimée**. Le composant `FCRTransparencyDialog` lira désormais `periodesBac` depuis `detail.parVague[i].periodesBac` (données déjà chargées sur la page). Plus de call API supplémentaire.

Nouveau type de trace (remplace `FCRTrace`) :

```typescript
// Dans src/types/fcr-by-feed.ts (extension de FCRByFeedResult)
export interface FCRTrace2 extends FCRByFeedResult {
  // FCRByFeedResult contient déjà parVague[].periodesBac[].
  // Pas besoin d'un type séparé — FCRByFeedResult IS the trace.
}
```

Les types `FCRTrace`, `FCRTraceVague`, `FCRTracePeriode`, `FCRTraceGompertzParams` dans `src/types/calculs.ts` sont **dépréciés** et retirés du barrel export une fois que `FCRTransparencyDialog` est mis à jour.

---

## 10. Route API `fcr-by-feed` (optionnelle pour accès externe)

Bien que le détail bac × période soit désormais intégré dans `getDetailAliment`, une route dédiée est maintenue pour les besoins d'audit programmatique et de test :

```
GET /api/analytics/aliments/[produitId]/fcr-by-feed
  ?minPoints=5        (optionnel, clampé [3, 20], défaut: 5)
  ?wInfinity=1500     (optionnel, clampé [800, 1800], défaut: null)

Permission : Permission.STOCK_VOIR
Response 200 : FCRByFeedResult
Response 404 : { error: "Produit aliment introuvable." }
```

---

## 11. Mise à jour de `FCRTransparencyDialog`

Le dialog passe de "charge ses propres données via API" à "reçoit les données depuis la page parente" :

```tsx
// Avant (appel API interne)
<FCRTransparencyDialog produitId={aliment.produitId} produitNom={...} fcrMoyen={...} />

// Après (données injectées depuis DetailAlimentVague)
<FCRTransparencyDialog
  produitNom={aliment.produitNom}
  fcrMoyen={aliment.fcrMoyen}
  parVague={detail.parVague}  // contient periodesBac[]
/>
```

Structure UI du dialog mise à jour (mobile-first, Radix Accordion par vague) :

```
Dialog
├── Header : nom aliment, FCR global, badge confiance
└── Body (scrollable)
    └── Accordion par vague
        ├── Header vague : code, FCR vague, flagLowConfidence badge
        ├── Gompertz block : W∞, K, ti, R², biometrieCount
        └── Cartes périodes (mobile) / Table (desktop ≥768px)
            Colonnes : Bac | Période | Jours | Aliment (kg) |
                       Gain/poisson (g) | Poissons moy. | Gain biomasse (kg) | FCR
```

---

## 12. Checklist nettoyage code mort

Après implémentation et validation des tests, les éléments suivants sont retirés :

### Supprimer
- [ ] `async function getFCRTrace(...)` dans `src/lib/queries/analytics.ts`
- [ ] `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts`
- [ ] Types `FCRTrace`, `FCRTraceVague`, `FCRTracePeriode`, `FCRTraceGompertzParams` dans `src/types/calculs.ts`
- [ ] Exports de ces types dans `src/types/index.ts`
- [ ] Imports `FCRTrace*` dans `src/components/analytics/fcr-transparency-dialog.tsx`
- [ ] Imports `FCRTrace*` dans `src/lib/queries/analytics.ts`

### Retirer de `DetailAlimentVague`
- [ ] Champ `avecInterpolation?: boolean`

### Marquer `@deprecated` (pas supprimer car encore testés)
- [ ] `segmenterPeriodesAlimentaires` dans `src/lib/feed-periods.ts` — déjà `@deprecated`, laisser tel quel
- [ ] `estimerNombreVivantsADate` dans `src/lib/feed-periods.ts` — déjà `@deprecated`, laisser tel quel
- [ ] `interpolerPoidsBac` dans `src/lib/feed-periods.ts` — déjà `@deprecated`, laisser tel quel

### Conserver les tests existants
- [ ] `src/__tests__/lib/feed-periods.test.ts` — les fonctions testées restent en place
- [ ] `src/__tests__/api/analytics-aliments.test.ts` — contrats API inchangés

---

## 13. Règles de dégradation gracieuse

| Situation | Traitement |
|-----------|-----------|
| < `minPoints` biométries dans une vague | `insufficientData: true`, vague exclue de l'agrégation globale |
| Gompertz R² < 0.85 | `flagLowConfidence: true`, badge ambre dans l'UI |
| FCR période > 3.0 | `flagHighFCR: true`, badge rouge |
| Pas de COMPTAGE pour un bac | `methode: "PROPORTIONNEL_INITIAL"` |
| Gain biomasse <= 0 pour une période | Période exclue du FCR (cohérent avec ADR-033) |
| Bac vidé (comptage = 0) | Reconstitution depuis calibrage destination + mortalité |
| Aucune vague avec données suffisantes | `fcrGlobal: null`, message UI explicatif |
| Jours mixtes sans période adjacente | Micro-période autonome |
| Produit sans `ReleveConsommation` | Retourne métriques vides (quantiteTotale=0) — comportement identique à l'ancien |
| Filtre saison appliqué | Les `ReleveConsommation` sont filtrés par mois avant traitement |

---

## 14. Tests requis (`src/__tests__/lib/fcr-by-feed.test.ts`)

```typescript
describe("buildDailyGainTable", () => {
  it("retourne le gain correct pour des paramètres Gompertz synthétiques")
  it("gain(t) = weight(t) - weight(t-1)")
  it("gère dayFrom == dayTo (une seule entrée)")
})

describe("segmenterPeriodesParBac", () => {
  it("crée une seule période pour des jours exclusifs consécutifs")
  it("crée deux périodes si gap >= 1 jour sans consommation")
  it("rattache un jour mixte à la période exclusive adjacente")
  it("jour mixte isolé → micro-période autonome")
  it("conservation : sum(qtyTargetKg) == total consommation bac")
})

describe("estimerPopulationBac", () => {
  it("ancrage sur COMPTAGE récent + soustraction mortalité post-comptage")
  it("ajout mortalité avant COMPTAGE si dateDebut < dateComptage")
  it("bac vidé (comptage = 0) → reconstitution depuis calibrage")
  it("fallback proportionnel si aucun COMPTAGE")
  it("avgCount = (countDebut + countFin) / 2")
})

describe("calculerFCRPeriodeBac", () => {
  it("FCR = qtyAlimentKg / gainBiomasseKg")
  it("FCR null si gainBiomasseKg <= 0")
  it("flagHighFCR = true si FCR > 3.0")
  it("gainBiomasseKg = gainParPoissonG * avgFishCount / 1000")
})

describe("aggregerFCRVague", () => {
  it("exclut les périodes avec gainBiomasseKg null ou <= 0")
  it("FCR_vague = sum(aliment valide) / sum(gain valide)")
  it("fcrVague null si aucune période valide")
})

describe("getFCRByFeed — intégration", () => {
  it("inclut les bacs désassignés post-calibrage")
  it("exclut les bacs non découverts via ReleveConsommation")
  it("vague avec < minPoints biométries → insufficientData: true")
  it("flagLowConfidence quand R² < 0.85")
  it("FCR global agrégé sur toutes les vagues valides")
  it("filtre saison SECHE exclut les mois hors [0,1,10,11]")
  it("produit sans consommation → fcrGlobal null, quantiteTotale 0")
})

describe("non-régression — computeAlimentMetrics via wrapper", () => {
  it("getComparaisonAliments retourne le même type ComparaisonAliments")
  it("getDetailAliment retourne le même type DetailAliment avec periodesBac")
  it("getSimulationChangementAliment retourne le même type SimulationResult")
})
```

---

## 15. Plan d'implémentation

| Étape | Agent | Fichier(s) | Dépendance |
|-------|-------|-----------|------------|
| 1 | @architect | Ce document ADR-036 révisé | — |
| 2 | @developer | `src/types/fcr-by-feed.ts` — toutes les interfaces | — |
| 3 | @developer | `src/types/calculs.ts` — modifier `DetailAlimentVague` | Étape 2 |
| 4 | @developer | `src/types/index.ts` — barrel exports | Étape 2 |
| 5 | @developer | `src/lib/queries/fcr-by-feed.ts` — fonctions pures + `getFCRByFeed` | Étape 2 |
| 6 | @developer | `src/lib/queries/analytics.ts` — remplacer `computeAlimentMetrics` + supprimer `getFCRTrace` | Étape 5 |
| 7 | @developer | `src/components/analytics/fcr-transparency-dialog.tsx` — lire `periodesBac` | Étape 3 |
| 8 | @developer | `src/components/analytics/feed-detail-charts.tsx` — afficher `periodesBac` | Étape 3 |
| 9 | @developer | Supprimer `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` | Étape 6 |
| 10 | @developer | Créer `src/app/api/analytics/aliments/[produitId]/fcr-by-feed/route.ts` | Étape 5 |
| 11 | @tester | `src/__tests__/lib/fcr-by-feed.test.ts` | Étape 5 |
| 12 | @tester | `npx vitest run` + `npm run build` + vérification non-régression API | Étape 11 |
| 13 | @code-reviewer | Review R1-R9, suppression code mort, mobile-first | Étape 12 |

---

## 16. Résumé des invariants préservés

1. Les contrats des routes API existantes (`/api/analytics/aliments`, `/api/analytics/aliments/[produitId]`, `/api/analytics/aliments/simulation`) sont **inchangés**.
2. Les types `AnalytiqueAliment`, `ComparaisonAliments`, `DetailAliment`, `SimulationResult` sont **inchangés** (sauf ajouts dans `DetailAlimentVague`).
3. Les tests existants des API (`src/__tests__/api/analytics-aliments.test.ts`) passent **sans modification**.
4. `getKParAliment` (K Gompertz par aliment) est **indépendant** et non affecté.
5. `getFCRHebdomadaire` et `getChangementsGranule` sont **indépendants** et non affectés.
6. La règle ADR-033 DISC-16 (exclure les périodes à gain négatif du FCR) est **préservée** dans le nouvel algorithme (Step 7 : `fcr: null si gainBiomasseKg <= 0`).
7. La règle ADR-034 (Gompertz VAGUE toujours actif quand calibré) est **préservée** via `buildDailyGainTable` qui utilise le même `gompertzWeight`.
