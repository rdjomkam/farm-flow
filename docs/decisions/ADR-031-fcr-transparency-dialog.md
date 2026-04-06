# ADR-031 — FCR Transparency Dialog

**Status:** ACCEPTED
**Date:** 2026-04-05
**Auteur:** @architect
**Sprint:** Feed Analytics v2

---

## Contexte

La page `analytics/aliments` affiche un `fcrMoyen` par produit aliment. Ce chiffre est
calculé à partir d'un pipeline multi-étapes non trivial (ADR-028 / ADR-029 / ADR-030) :
segmentation en périodes, interpolation du poids aux frontières, gain de biomasse par
période, puis agrégation pondérée. Un pisciculteur ou un agronome qui voit FCR = 1.43
n'a aucun moyen de vérifier ce chiffre ni de le contester.

Cette ADR décrit un **dialog de transparence FCR** : une fenêtre modale qui expose la
trace d'audit complète du calcul, step by step, depuis les données brutes jusqu'à la
valeur finale affichée.

---

## Décision

### 1. Point d'entrée

Un bouton **"Comment est calculé ce FCR ?"** (icône `Info`, texte visible) est ajouté
dans chaque carte `FeedComparisonCards` en-dessous du badge `BenchmarkBadge`. Il ouvre
un `Dialog` Radix UI (ADR-R5 : `DialogTrigger asChild`).

Le trigger est conditionnel : il n'apparaît que si `fcrMoyen !== null`.

### 2. Calcul à la demande (on-demand)

Les données de transparence ne sont **pas** pré-calculées dans `computeAlimentMetrics`.
Elles sont calculées au moment où le dialog s'ouvre, via un appel à une nouvelle route
API :

```
GET /api/analytics/aliments/[produitId]/fcr-trace?siteId=...
```

Justification :
- Les données de trace sont volumineuses (une entrée par période × vague × bac).
- Seule une minorité de clics aboutiront à l'ouverture du dialog.
- La page principale garde sa vitesse de chargement actuelle.
- `computeAlimentMetrics` reste pure et ne grossit pas.

### 3. Nouveau type de données : `FCRTrace`

```typescript
// src/types/calculs.ts

/**
 * Trace d'audit complète du calcul FCR pour un produit aliment.
 *
 * Produit par GET /api/analytics/aliments/[produitId]/fcr-trace.
 * Structurée en 3 niveaux : produit → vagues → périodes.
 */
export interface FCRTrace {
  produitId: string;
  produitNom: string;
  fournisseurNom: string | null;
  /** Prix en CFA/kg (base) */
  prixUnitaire: number;

  /**
   * Stratégie d'interpolation configurée pour ce site.
   * Affichée en en-tête du dialog pour contextualiser les méthodes.
   */
  strategieInterpolation: StrategieInterpolation;

  /** Paramètre gompertzMinPoints (nombre minimal de biométries pour activer Gompertz) */
  gompertzMinPoints: number | null;

  /** FCR final agrégé (identique à AnalytiqueAliment.fcrMoyen) */
  fcrMoyenFinal: number | null;

  /** Quantité totale aliment sur toutes les vagues, en kg */
  quantiteTotaleFinal: number;

  /** Gain de biomasse total agrégé, en kg */
  gainBiomasseTotalFinal: number | null;

  /** Ventilation par vague */
  parVague: FCRTraceVague[];
}

/**
 * Contribution d'une vague au FCR final.
 */
export interface FCRTraceVague {
  vagueId: string;
  vagueCode: string;
  dateDebut: Date;
  dateFin: Date | null;
  nombreInitial: number;
  poidsMoyenInitial: number;

  /** Nombre de poissons vivants estimé à la fin de la vague */
  nombreVivantsEstime: number | null;

  /** Quantité totale aliment (ce produit) dans cette vague, en kg */
  quantiteKg: number;

  /** Gain de biomasse agrégé des périodes de cette vague, en kg (null si aucune période valide) */
  gainBiomasseKg: number | null;

  /** FCR calculé pour cette vague (null si gainBiomasseKg est null) */
  fcrVague: number | null;

  /**
   * Contexte Gompertz vague si applicable.
   * Null si stratégie = LINEAIRE ou données insuffisantes.
   */
  gompertzVague: FCRTraceGompertzParams | null;

  /** Périodes alimentaires pour CE produit dans cette vague */
  periodes: FCRTracePeriode[];

  /**
   * true si la vague contient des relevés alimentation sans bacId
   * (données legacy, mode "vague entière").
   */
  modeLegacy: boolean;
}

/**
 * Paramètres d'un modèle Gompertz calibré (vague ou bac).
 * Affichés pour montrer la formule avec les valeurs réelles.
 */
export interface FCRTraceGompertzParams {
  /** W∞ en grammes */
  wInfinity: number;
  /** k en 1/jour */
  k: number;
  /** ti en jours depuis début de vague */
  ti: number;
  /** R² du calibrage */
  r2: number;
  /** Nombre de biométries utilisées pour calibrer */
  biometrieCount: number;
  /** Niveau de confiance */
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
}

/**
 * Une période alimentaire annotée pour l'audit.
 *
 * Étend PeriodeAlimentaire avec les détails de calcul intermédiaires.
 */
export interface FCRTracePeriode {
  bacId: string;
  /** Nom du bac (pour l'affichage — "inconnu" si bacId = "unknown") */
  bacNom: string;

  dateDebut: Date;
  dateFin: Date;

  /** Nombre de jours de la période (dateFin - dateDebut en jours) */
  dureeJours: number;

  /** Quantité aliment distribuée pendant cette période, en kg */
  quantiteKg: number;

  // --- Poids au début ---
  /** Poids moyen estimé au début de la période, en grammes */
  poidsMoyenDebut: number | null;
  /** Méthode utilisée pour estimer poidsMoyenDebut */
  methodeDebut: PeriodeAlimentaire["methodeEstimation"];
  /** Détail de l'estimation au début (biométrie exacte, interpolation, Gompertz) */
  detailEstimationDebut: FCRTraceEstimationDetail | null;

  // --- Poids à la fin ---
  /** Poids moyen estimé à la fin de la période, en grammes */
  poidsMoyenFin: number | null;
  /** Méthode utilisée pour estimer poidsMoyenFin */
  methodeFin: PeriodeAlimentaire["methodeEstimation"];
  /** Détail de l'estimation à la fin (biométrie exacte, interpolation, Gompertz) */
  detailEstimationFin: FCRTraceEstimationDetail | null;

  /** Méthode retenue pour la période (la moins précise des deux bornes) */
  methodeRetenue: PeriodeAlimentaire["methodeEstimation"];

  // --- Biomasse ---
  /** Nombre de poissons vivants utilisé pour le calcul de biomasse */
  nombreVivants: number | null;

  /** Biomasse au début = poidsMoyenDebut × nombreVivants / 1000, en kg */
  biomasseDebutKg: number | null;

  /** Biomasse à la fin = poidsMoyenFin × nombreVivants / 1000, en kg */
  biomasseFinKg: number | null;

  /** Gain de biomasse = fin - début, en kg (null si négatif ou données manquantes) */
  gainBiomasseKg: number | null;

  /**
   * true si le gain brut était négatif (exclu de l'agrégation FCR).
   * Permet d'expliquer pourquoi la période ne contribue pas au FCR.
   */
  gainNegatifExclu: boolean;

  /** FCR de cette période = quantiteKg / gainBiomasseKg (null si gain null) */
  fcrPeriode: number | null;

  /**
   * Contexte Gompertz du bac si la méthode est GOMPERTZ_BAC.
   * Null pour toute autre méthode.
   */
  gompertzBac: FCRTraceGompertzParams | null;
}

/**
 * Détail de l'estimation du poids à une borne de période.
 *
 * Varie selon la méthode utilisée.
 */
export type FCRTraceEstimationDetail =
  | FCRTraceEstimationBiometrieExacte
  | FCRTraceEstimationInterpolationLineaire
  | FCRTraceEstimationGompertz
  | FCRTraceEstimationValeurInitiale;

export interface FCRTraceEstimationBiometrieExacte {
  methode: "BIOMETRIE_EXACTE";
  /** Date de la biométrie utilisée */
  dateBiometrie: Date;
  /** Valeur mesurée */
  poidsMesureG: number;
}

export interface FCRTraceEstimationInterpolationLineaire {
  methode: "INTERPOLATION_LINEAIRE";
  /** Biométrie avant la borne */
  pointAvant: { date: Date; poidsMoyenG: number } | null;
  /** Biométrie après la borne */
  pointApres: { date: Date; poidsMoyenG: number } | null;
  /** Ratio d'interpolation (0–1) */
  ratio: number | null;
}

export interface FCRTraceEstimationGompertz {
  methode: "GOMPERTZ_BAC" | "GOMPERTZ_VAGUE";
  /** t = jours depuis début de vague à la date cible */
  tJours: number;
  /** Paramètres utilisés */
  params: FCRTraceGompertzParams;
  /** Résultat = W∞ × exp(−exp(−k × (t − ti))) */
  resultatG: number;
}

export interface FCRTraceEstimationValeurInitiale {
  methode: "VALEUR_INITIALE";
  /** Poids moyen initial de la vague */
  poidsMoyenInitialG: number;
}
```

### 4. Architecture des composants

```
FeedComparisonCards                          (existing, "use client")
  └── FeedFCRTransparencyTrigger             (new, inline in card, "use client")
        └── Dialog (Radix)
              ├── DialogTrigger asChild
              │     └── Button variant="ghost" size="sm"
              │           └── <Info /> "Comment est calculé ce FCR ?"
              └── DialogContent
                    └── FCRTransparencyDialog  (new, "use client")
                          ├── FCRTraceHeader           (produit, stratégie, résultat final)
                          ├── FCRTraceAggregation      (formule agrégation pondérée)
                          └── [for each vague]
                                FCRTraceVagueSection   (collapsible Accordion.Item)
                                  ├── VagueSummaryRow  (code, dates, FCR vague, quantité)
                                  └── [for each période]
                                        FCRTracePeriodeRow  (collapsible)
                                          ├── PeriodeBoundaryBlock  (début / fin)
                                          │     └── EstimationDetailBlock (par méthode)
                                          ├── BiomassCalculBlock
                                          └── PeriodeFCRBlock
```

**Règle "use client" :** seul le composant `FCRTransparencyDialog` (et ses enfants) est
client. Le trigger `FeedFCRTransparencyTrigger` est client parce qu'il gère l'état
ouvert/fermé du Dialog. Tout le reste reste Server Component.

### 5. Comportement de chargement

Quand l'utilisateur ouvre le dialog :

1. Un état local `traceData: FCRTrace | null` est initialisé à null.
2. Un `useEffect` (ou `onOpenChange`) déclenche `fetch("/api/analytics/aliments/[produitId]/fcr-trace?siteId=...")`.
3. Pendant le chargement, le DialogContent affiche un skeleton (3 lignes).
4. Si erreur réseau, un message d'erreur avec bouton "Réessayer".
5. Quand les données arrivent, le contenu complet est rendu.

Le siteId est passé au composant via prop depuis le Server Component parent.

### 6. Route API

```
GET /api/analytics/aliments/[produitId]/fcr-trace
Query params: siteId (string, requis)
Auth: session cookie (même pattern que les autres routes)
Permission: STOCK_VOIR
Response: FCRTrace (JSON)
```

La route appelle une nouvelle fonction `getFCRTrace(siteId, produitId): Promise<FCRTrace | null>` dans `src/lib/queries/analytics.ts`. Cette fonction réutilise **le même pipeline** que `computeAlimentMetrics` (même requêtes DB, même appel à `segmenterPeriodesAlimentaires`) mais collecte les détails intermédiaires que `computeAlimentMetrics` ne retourne pas aujourd'hui.

`getFCRTrace` n'est **pas** appelée depuis `computeAlimentMetrics` (pas de couplage
inverse). Les deux fonctions partagent les helpers internes (requêtes Prisma factorisables
si besoin).

### 7. Layout mobile-first (360px)

Le `DialogContent` utilise `max-h-[90dvh] overflow-y-auto` pour scroller.
La largeur est `w-full sm:max-w-lg`.

Hiérarchie visuelle sur mobile :

```
[Header : produit, stratégie, FCR final en grand]
[Encadré agrégation : formule pondérée]
[Accordion]
  ┌─ Vague V-001 ─────────────── FCR: 1.32 ─ ▼
  │  2 périodes | 180 kg | +137 kg gain
  │  ┌─ Bac BAC-01  01/02 → 15/02 (14j) ─────▼
  │  │  Début : 145 g  [INTERPOLATION LINÉAIRE]
  │  │    ↑ 12/01 : 120 g   ↓ 20/02 : 165 g   ratio 0.52
  │  │  Fin   : 165 g  [BIOMÉTRIE EXACTE  15/02]
  │  │  Poissons : 850  Biomasse début: 123 kg  fin: 140 kg
  │  │  Gain : 17 kg  FCR période : 2.06
  │  └──────────────────────────────────────────
  └───────────────────────────────────────────
```

Les formules mathématiques sont rendues en blocs `code` monospace sur fond `muted` :

```
W(t) = 980 × exp(−exp(−0.0142 × (t − 45)))
W(62.3) = 980 × exp(−exp(−0.0142 × (62.3 − 45))) = 487 g
```

### 8. Internationalisation

Toutes les chaînes du dialog passent par `useTranslations("analytics.fcrTrace")`.
Clés à ajouter :

```json
{
  "fcrTrace": {
    "title": "Détail du calcul FCR",
    "strategie": "Stratégie d'interpolation",
    "fcrFinal": "FCR final agrégé",
    "totalAliment": "Total aliment",
    "totalGain": "Gain de biomasse total",
    "aggregationTitle": "Agrégation pondérée",
    "aggregationFormule": "FCR = Σ(aliment_i) / Σ(gain_i > 0)",
    "vague": "Vague",
    "periode": "Période",
    "bac": "Bac",
    "duree": "Durée",
    "debut": "Début de période",
    "fin": "Fin de période",
    "poidsDebut": "Poids moyen début",
    "poidsFin": "Poids moyen fin",
    "methode": "Méthode estimation",
    "biometrieExacte": "Biométrie exacte",
    "interpolationLineaire": "Interpolation linéaire",
    "gompertzVague": "Gompertz vague",
    "gompertzBac": "Gompertz bac",
    "valeurInitiale": "Valeur initiale vague",
    "nombreVivants": "Poissons vivants",
    "biomasseDebut": "Biomasse début",
    "biomasseFin": "Biomasse fin",
    "gainBiomasse": "Gain de biomasse",
    "gainNegatifExclu": "Gain négatif — exclu du FCR",
    "fcrPeriode": "FCR période",
    "gompertzParams": "Paramètres Gompertz",
    "gompertzFormule": "W(t) = W∞ × exp(−exp(−k × (t − ti)))",
    "interpolPoints": "Points d'interpolation",
    "loading": "Chargement de la trace...",
    "error": "Impossible de charger la trace. Réessayer.",
    "retry": "Réessayer",
    "noData": "Pas de données suffisantes pour tracer le calcul.",
    "modeLegacy": "Données sans identifiant de bac (mode legacy)",
    "joursUnit": "j",
    "r2Label": "R²"
  }
}
```

### 9. Ce qui n'est PAS dans ce dialog

- Pas de graphique (redirection vers la page détail pour les graphiques).
- Pas d'édition des données brutes.
- Pas de comparaison inter-aliments (c'est la responsabilité de la page liste).
- Pas d'export PDF depuis le dialog (Sprint 12 scope).

---

## Fichiers à créer

| Chemin | Type | Description |
|--------|------|-------------|
| `src/types/calculs.ts` | Interfaces | Ajouter `FCRTrace`, `FCRTraceVague`, `FCRTracePeriode`, `FCRTraceGompertzParams`, `FCRTraceEstimationDetail` et sous-types |
| `src/types/index.ts` | Barrel | Exporter les nouveaux types |
| `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` | API route | `GET` handler |
| `src/lib/queries/analytics.ts` | Query | Ajouter `getFCRTrace()` |
| `src/components/analytics/fcr-transparency-dialog.tsx` | Client component | Dialog complet |
| `src/components/analytics/feed-comparison-cards.tsx` | Modification | Ajouter le trigger bouton |

---

## Fichiers à modifier

| Chemin | Modification |
|--------|-------------|
| `src/types/calculs.ts` | Ajouter les 9 nouvelles interfaces |
| `src/types/index.ts` | Re-exporter les nouveaux types |
| `src/lib/queries/analytics.ts` | Ajouter `getFCRTrace` |
| `src/components/analytics/feed-comparison-cards.tsx` | Ajouter le trigger après `BenchmarkBadge` |
| `messages/fr.json` | Ajouter clés `analytics.fcrTrace.*` |

---

## Alternatives considérées

### Alternative A — Pré-calculer la trace dans `computeAlimentMetrics`

Avantage : pas de requête DB supplémentaire à l'ouverture du dialog.
Rejet : alourdissement systématique de la page principale (200+ lignes de données
jamais affichées). Contraire au principe de "charger ce qui est nécessaire".

### Alternative B — Page dédiée `/analytics/aliments/[produitId]/fcr-trace`

Avantage : URL partageable, plein écran.
Rejet : navigation trop lourde pour une consultation rapide. L'utilisateur est sur la
page de comparaison — le dialog lui permet de consulter et de revenir immédiatement.
Une URL de partage n'est pas une priorité ici.

### Alternative C — Intégrer dans la page détail existante

La page `/analytics/aliments/[id]` existe déjà. Ajouter la trace là-dedans.
Rejet : la demande est explicitement un dialog depuis la page de comparaison. De plus,
la page détail a déjà des graphiques — la trace textuelle doit rester séparée.

### Alternative D — Inline collapsible (pas de Dialog)

Un `Collapsible` directement dans la carte, qui s'étend vers le bas.
Rejet : la quantité de données est trop importante pour s'étendre dans une liste de
cartes déjà denses. Le Dialog isole l'information et permet le scroll indépendant.

---

## Conséquences

- La route `GET /api/analytics/aliments/[produitId]/fcr-trace` est nouvelle. Elle suit
  exactement le même pipeline que `computeAlimentMetrics` — toute modification future
  de la logique FCR (nouvel ADR) doit être reflétée dans `getFCRTrace` également.
- `PeriodeAlimentaire` (ADR-028) reste inchangée. `FCRTracePeriode` l'étend avec les
  détails intermédiaires sans modifier l'interface existante.
- L'implémentation de `getFCRTrace` devra annoter les estimations de borne en appelant
  `interpolerPoidsBac` individuellement pour chaque borne (début et fin) et conserver
  les `BiometriePoint` adjacents pour produire `FCRTraceEstimationDetail`.
  Ceci nécessite d'exposer les biométries encadrantes depuis `interpolerPoidsBac`, soit
  en modifiant son type de retour (option recommandée), soit en appelant la logique
  d'interpolation directement dans `getFCRTrace`.
- Aucun impact sur les tests existants (`computeAlimentMetrics`, `segmenterPeriodesAlimentaires`).
- Nouveau test unitaire recommandé : `getFCRTrace` avec fixture de vague multi-périodes
  multi-bacs (au moins un période avec Gompertz, une avec interpolation linéaire, une
  avec gain négatif exclu).
