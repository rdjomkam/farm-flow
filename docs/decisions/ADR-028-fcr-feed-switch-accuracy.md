# ADR-028 — Calcul FCR précis lors des changements d'aliment (feed switching)

**Statut :** Accepté
**Date :** 2026-04-05
**Auteur :** @architect

---

## Contexte

### Le problème

La fonction `computeAlimentMetrics` (dans `src/lib/queries/analytics.ts`) calcule le FCR
d'un aliment donné pour une vague entière selon la formule :

```
FCR = totalAlimentProduitKg / (biomasseFinale - biomasseInitiale)
```

Où `biomasseFinale = poidsMoyenDerniereBio × nombreVivantsEstimé` et
`biomasseInitiale = poidsMoyenInitial × nombreInitial`.

**Ce calcul est correct si un seul aliment est utilisé sur toute la vague.** Il devient
trompeur dès qu'un changement d'aliment survient. Exemple :

- Vague V1, 2 bacs (Bac A et Bac B), J0-J21 : les deux bacs reçoivent Skretting 2mm
- J21+ : Bac A passe à Skretting 3mm, Bac B reste sur 2mm

FCR attribué à "Skretting 2mm" dans le système actuel :
- Numérateur : total Skretting 2mm consommé = toute la consommation J0-J21 + consommation Bac B J21+
- Dénominateur : `biomasseFinale - biomasseInitiale` = gain TOTAL de la vague (incluant le gain dû à Skretting 3mm sur Bac A)

Résultat : le FCR du Skretting 2mm est sous-estimé (bon gain attribué au mauvais aliment),
et celui du Skretting 3mm est surestimé.

### Données disponibles

1. **`Releve.bacId`** — chaque relevé biométrique, d'alimentation et de mortalité est rattaché à un bac précis.
2. **`ReleveConsommation`** — enregistre `produitId`, `quantite`, lié à un `releveId` qui a lui-même un `bacId` et une `date`.
3. **`Releve.poidsMoyen`** — la biométrie est par bac, donnant une série temporelle par bac.
4. **`GompertzVague`** — paramètres Gompertz calibrés au niveau vague (pas au niveau bac).
5. **`getChangementsGranule`** — détecte déjà les transitions de taille entre produits successifs.

La structure de données suffit donc pour un FCR par bac et par période d'alimentation.
Aucun champ de schéma supplémentaire n'est requis pour la correction de base.

---

## Décision

### Principe : FCR par période d'alimentation per-bac, agrégé en FCR pondéré per-produit

Le FCR d'un produit aliment est calculé en agrégeant des **périodes d'alimentation cohérentes** :
une période est un segment continu `[t_start, t_end]` sur un bac donné où un unique produit
est distribué. La biomasse gagnée mesurée n'est prise que sur ce même bac, sur ce même segment.

```
FCR_produit = Σ(périodes_produit) aliment_kg / Σ(périodes_produit) gain_biomasse_kg
```

L'agrégation pondérée sur les périodes respecte la cohérence physique : chaque kg d'aliment
est associé uniquement au gain de biomasse produit pendant sa distribution, sur le bac où
il a été distribué.

### Architecture en 3 couches

#### Couche 1 — Segmentation des périodes d'alimentation par bac (`src/lib/feed-periods.ts`)

Fonction pure, sans dépendance DB.

**Entrée :**
```typescript
interface ReleveAlimPoint {
  releveId: string;
  date: Date;
  bacId: string;
  consommations: { produitId: string; quantiteKg: number }[];
}

interface BiometriePoint {
  date: Date;
  bacId: string;
  poidsMoyen: number;        // grammes
}

interface VagueContext {
  dateDebut: Date;
  nombreInitial: number;
  poidsMoyenInitial: number; // grammes
  bacs: { id: string; nombreInitial: number | null }[];
}
```

**Sortie — un tableau de `PeriodeAlimentaire` :**
```typescript
interface PeriodeAlimentaire {
  bacId: string;
  produitId: string;
  /** Premier relevé alimentation de la période (inclusive) */
  dateDebut: Date;
  /** Dernier relevé alimentation de la période (inclusive) */
  dateFin: Date;
  /** Quantité totale aliment distribué en kg sur cette période */
  quantiteKg: number;
  /** Poids moyen (g) au début de la période — biométrie ou interpolation */
  poidsMoyenDebut: number | null;
  /** Poids moyen (g) à la fin de la période — biométrie ou interpolation */
  poidsMoyenFin: number | null;
  /** Nombre de poissons vivants estimé sur cette période (début) */
  nombreVivants: number | null;
  /** Gain de biomasse (kg) sur la période — null si poids manquants */
  gainBiomasseKg: number | null;
  /** Méthode d'estimation des poids aux bornes */
  methodeEstimation: "BIOMETRIE_EXACTE" | "INTERPOLATION_LINEAIRE" | "VALEUR_INITIALE";
}
```

**Algorithme de segmentation :**

1. Pour chaque bac, trier les relevés ALIMENTATION par date.
2. Regrouper les relevés consécutifs utilisant le même `produitId` principal
   (le produit dont la `quantiteKg` est la plus haute si plusieurs co-existent dans un relevé).
3. Chaque changement de produit crée une nouvelle période.
4. Pour chaque période, estimer `poidsMoyenDebut` et `poidsMoyenFin` (voir Couche 2).
5. Calculer `gainBiomasseKg` = `(poidsMoyenFin × nombreVivants) / 1000 - (poidsMoyenDebut × nombreVivants) / 1000`.

**Note sur le produit "principal" d'un relevé :**
Un relevé ALIMENTATION peut avoir plusieurs `ReleveConsommation` (ex. un complément minéral
+ un aliment de base). Le produit principal est celui dont la `quantiteKg` est maximale.
Les autres produits dans le même relevé restent enregistrés dans leurs propres périodes.

#### Couche 2 — Estimation des poids aux bornes de période (`src/lib/feed-periods.ts`)

Pour calculer le `gainBiomasseKg` d'une période, il faut estimer le poids moyen du bac
aux dates exactes de début et de fin de la période. Trois sources possibles :

**2a. Biométrie exacte :** Si un relevé BIOMETRIE existe à la date de début ou de fin de
la période (même jour calendaire), utiliser son `poidsMoyen` directement.
`methodeEstimation = "BIOMETRIE_EXACTE"`.

**2b. Interpolation linéaire :** Si deux biométries encadrent la date cible (`t_avant < t_cible < t_apres`),
interpoler linéairement :
```
poidsMoyen(t_cible) = poidsMoyenAvant + (poidsMoyenApres - poidsMoyenAvant) × (t_cible - t_avant) / (t_apres - t_avant)
```
`methodeEstimation = "INTERPOLATION_LINEAIRE"`.

**2c. Valeur initiale de la vague :** Si aucune biométrie n'existe avant la date cible
(typique pour le début de la première période), utiliser `vague.poidsMoyenInitial`.
`methodeEstimation = "VALEUR_INITIALE"`.

**Rejet du modèle Gompertz pour l'interpolation :** Le modèle Gompertz est calibré au niveau
vague (une courbe pour tous les bacs). L'interpolation linéaire entre deux biométries réelles
du même bac est plus précise car elle est spécifique au bac, ne nécessite pas de recalibration,
et reste robuste même avec peu de points. Le Gompertz sera envisagé dans une évolution
ultérieure si les tests de validation montrent un écart systématique (voir section
"Alternatives rejetées").

#### Couche 3 — Agrégation FCR per-produit (`src/lib/queries/analytics.ts`)

Remplacement de la logique actuelle dans `computeAlimentMetrics` (lignes 560-638).

**Nouvelle logique :**

```typescript
// Pour chaque vague utilisant ce produit :
const periodes = segmenterPeriodesAlimentaires(
  relevsAlimBac,   // relevés alimentation groupés par bac
  biometriesBac,   // relevés biométrie groupés par bac
  vagueContext
);

// Filtrer uniquement les périodes du produit analysé
const periodesProduitt = periodes.filter(p => p.produitId === produit.id);

// FCR pondéré = total aliment / total gain
const totalAliment = periodesProduitt.reduce((s, p) => s + p.quantiteKg, 0);
const totalGain = periodesProduitt
  .filter(p => p.gainBiomasseKg != null && p.gainBiomasseKg > 0)
  .reduce((s, p) => s + p.gainBiomasseKg!, 0);

const fcr = totalGain > 0 ? totalAliment / totalGain : null;
```

**Compatibilité :** Le type de retour de `computeAlimentMetrics` et l'interface `AnalytiqueAliment`
ne changent pas. Seule la logique interne de calcul du `fcr`, `gainBiomasse` et `coutParKgGain`
est remplacée. Aucun changement de schéma de réponse API.

---

### Nouveau type TypeScript — `PeriodeAlimentaire`

À ajouter dans `src/types/calculs.ts` (section "Analytiques par aliment") :

```typescript
/**
 * Période d'alimentation cohérente — un segment continu sur un bac
 * avec un unique produit principal distribué.
 *
 * Produit par segmenterPeriodesAlimentaires() dans src/lib/feed-periods.ts.
 * Utilisé pour le calcul FCR précis lors des changements d'aliment.
 */
export interface PeriodeAlimentaire {
  bacId: string;
  produitId: string;
  dateDebut: Date;
  dateFin: Date;
  quantiteKg: number;
  poidsMoyenDebut: number | null;
  poidsMoyenFin: number | null;
  nombreVivants: number | null;
  gainBiomasseKg: number | null;
  methodeEstimation: "BIOMETRIE_EXACTE" | "INTERPOLATION_LINEAIRE" | "VALEUR_INITIALE";
}
```

---

### Nouveau fichier — `src/lib/feed-periods.ts`

Fonctions pures exposées :

```typescript
/**
 * Segmente les relevés d'alimentation d'une vague en périodes cohérentes
 * (un produit par bac, du premier relevé au changement suivant).
 *
 * Remplace la logique de calcul FCR global par bac dans computeAlimentMetrics.
 *
 * @param relevsAlim   - relevés ALIMENTATION avec consommations, triés par date
 * @param biometries   - relevés BIOMETRIE avec poidsMoyen, triés par date
 * @param vagueContext - données de la vague (dateDebut, poidsMoyenInitial, bacs)
 * @returns tableau de PeriodeAlimentaire — une entrée par (bac × produit × période)
 */
export function segmenterPeriodesAlimentaires(
  relevsAlim: ReleveAlimPoint[],
  biometries: BiometriePoint[],
  vagueContext: VagueContext
): PeriodeAlimentaire[];

/**
 * Interpole ou récupère le poids moyen d'un bac à une date donnée.
 *
 * Stratégie : biométrie exacte > interpolation linéaire > poids initial vague.
 *
 * @param targetDate   - date pour laquelle estimer le poids
 * @param bacId        - identifiant du bac
 * @param biometries   - série temporelle de biométries du bac (triées par date)
 * @param poidsInitial - poids moyen initial de la vague (fallback)
 * @returns { poids, methode } — null si aucune donnée disponible
 */
export function interpolerPoidsBac(
  targetDate: Date,
  bacId: string,
  biometries: BiometriePoint[],
  poidsInitial: number
): { poids: number; methode: PeriodeAlimentaire["methodeEstimation"] } | null;
```

---

### Nouveau champ dans `DetailAlimentVague`

Pour informer l'utilisateur de la méthode de calcul :

```typescript
// Extension de DetailAlimentVague dans src/types/calculs.ts
export interface DetailAlimentVague {
  // ... champs existants inchangés ...
  /** Nombre de périodes d'alimentation distinctes détectées pour ce produit */
  nombrePeriodes?: number;
  /** true si des changements d'aliment ont été détectés dans cette vague */
  avecChangementAliment?: boolean;
  /** true si au moins une période a dû utiliser l'interpolation (pas de biométrie exacte) */
  avecInterpolation?: boolean;
}
```

---

## Règles de dégradation gracieuse

Quand les données sont insuffisantes, le système doit dégrader vers le comportement actuel :

| Situation | Comportement |
|-----------|-------------|
| Aucune biométrie par bac dans la période | `gainBiomasseKg = null`, période exclue de l'agrégation FCR |
| Un seul aliment sur toute la vague, tous bacs confondus | Le résultat est identique à l'algorithme actuel (une seule période par bac) |
| Relevés d'alimentation sans `bacId` cohérent | Traiter comme une période vague-entière (comportement actuel) |
| Vague avec un seul bac | Résultat identique à l'algorithme actuel (aucune segmentation inter-bacs) |
| Gain de biomasse négatif sur une période | Période exclue du numérateur FCR (ne pas compter un "anti-gain") |

---

## Impact sur les API routes et l'UI

### Routes affectées

| Route | Impact |
|-------|--------|
| `GET /api/analytics/aliments` | Interne uniquement — même réponse JSON, FCR corrigé |
| `GET /api/analytics/aliments/[id]` | Idem — `DetailAlimentVague.fcr` est maintenant per-période |
| `GET /api/analytics/aliments/compare` | Idem |
| `GET /api/analytics/aliments/simulation` | Idem |

Aucun changement de contrat API. Les valeurs numériques changent (correction), pas la structure.

### UI

Aucun changement de composant requis. La correction est transparente pour l'utilisateur.

Option UX complémentaire (non bloquante, peut être ajoutée ultérieurement) :
ajouter un badge "basé sur N périodes" sur la carte aliment dans la comparaison,
avec un tooltip expliquant que le FCR tient compte des changements d'aliment.

---

## Fichiers à créer ou modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/lib/feed-periods.ts` | Créer | Fonctions pures `segmenterPeriodesAlimentaires` et `interpolerPoidsBac` |
| `src/types/calculs.ts` | Modifier | Ajouter `PeriodeAlimentaire`, étendre `DetailAlimentVague` |
| `src/lib/queries/analytics.ts` | Modifier | Remplacer la logique FCR dans `computeAlimentMetrics` |
| `src/__tests__/lib/feed-periods.test.ts` | Créer | Tests unitaires pour la segmentation et l'interpolation |

Aucune migration Prisma. Aucun changement de schéma.

---

## Alternatives rejetées

### Alternative A — Gompertz per-bac pour l'estimation du poids aux bornes

**Description :** Calibrer un modèle Gompertz séparé pour chaque bac (au lieu du modèle
actuel unique par vague), puis utiliser `gompertzWeight(t, params_bac)` pour estimer le
poids à n'importe quelle date.

**Raisons du rejet :**
1. **Données insuffisantes par bac.** Le modèle Gompertz requiert au minimum 5 biométries
   (voir `GompertzConfidenceLevel.INSUFFICIENT_DATA`). En pratique, si une vague a 3 bacs
   et que les biométries ne sont pas systématiques par bac, plusieurs bacs n'auront pas
   assez de points.
2. **Complexité disproportionnée.** Calibrer, stocker et invalider N modèles par vague
   (un par bac) est une charge architecturale importante pour un gain marginal par rapport
   à l'interpolation linéaire.
3. **Le Gompertz vague-entière n'est pas biaisé par bac.** Les bacs d'une même vague ont
   les mêmes conditions initiales et le même régime alimentaire (majorité du temps). La
   courbe vague est une approximation valable de la croissance par bac.
4. **L'interpolation linéaire est suffisante.** Entre deux biométries réelles du même bac
   espacées de 7 à 21 jours (fréquence typique), l'erreur d'interpolation linéaire est
   inférieure à 5 % sur le poids moyen. L'erreur sur le FCR résultant est du même ordre,
   ce qui est acceptable en contexte aquacole.

**Évolution possible :** Si des tests de validation sur données réelles montrent un biais
systématique de l'interpolation linéaire (ex. croissance fortement exponentielle en phase
alevinage), revisiter pour une interpolation exponentielle ou Gompertz par bac dans un
ADR ultérieur.

### Alternative B — Segmentation uniquement au niveau vague (pas par bac)

**Description :** Détecter les changements d'aliment au niveau vague (date où TOUS les bacs
basculent vers un nouveau produit), et découper la vague en tranches temporelles globales.

**Raisons du rejet :**
1. **Ne résout pas le cas du switch partiel.** Le scénario décrit dans ce contexte (Bac A
   change, Bac B reste) est précisément le cas où la segmentation par bac est nécessaire.
   Une segmentation vague-entière ne peut pas gérer ce cas.
2. **La granularité per-bac est déjà dans les données.** `Releve.bacId` et
   `ReleveConsommation.releveId → Releve.bacId` donnent la ventilation par bac sans
   effort supplémentaire de capture.

### Alternative C — Nouveau champ `changementsAliment` sur `Releve`

**Description :** Ajouter un type de relevé `CHANGEMENT_ALIMENT` (évoqué dans
`ADR-feed-analytics-research.md`, section 6.4) pour capturer explicitement les dates de
switch.

**Raisons du rejet :**
1. **Redondant avec `ReleveConsommation`.** Le changement de produit est déjà observable
   en comparant les `produitId` des `ReleveConsommation` successives par bac. Créer un
   événement dédié double la saisie pour l'éleveur.
2. **Coût de migration.** Ajouter un nouveau `TypeReleve` implique une migration Prisma,
   une mise à jour du formulaire de relevé, et de la formation utilisateur.
3. **Fragilité.** L'éleveur peut oublier de saisir l'événement. La détection automatique
   depuis `ReleveConsommation` est plus fiable.

### Alternative D — Conserver le calcul vague-entier mais marquer les vagues avec switch

**Description :** Garder la formule actuelle mais afficher un avertissement UI ("FCR
approximatif — changement d'aliment détecté") quand `getChangementsGranule` retourne
des résultats.

**Raisons du rejet :**
1. **Ne corrige pas l'erreur, l'amplifie.** Signaler un FCR incorrect sans le corriger
   nuit à la confiance dans l'outil.
2. **Insuffisant pour les éleveurs avancés.** Les éleveurs qui font des tests comparatifs
   d'aliments (le cas d'usage cible des analytics) ont besoin d'une valeur fiable, pas
   d'un avertissement.

---

## Précautions de performance

La requête dans `computeAlimentMetrics` doit maintenant récupérer `bacId` sur les relevés
ALIMENTATION et les `consommations` avec leur `produitId`. Ce champ est déjà dans le schéma
(`Releve.bacId`) et déjà indexé (`@@index([bacId])` sur `Releve`). L'overhead est négligeable.

La segmentation (`segmenterPeriodesAlimentaires`) est O(n × m) où n = nombre de relevés
alimentation et m = nombre de biométries. Pour une vague typique (200 relevés max, 30
biométries max), cela représente 6000 comparaisons, négligeable.

---

## Plan d'implémentation

1. **@architect** : ce document (ADR-028) — FAIT
2. **@developer** : créer `src/lib/feed-periods.ts` avec `segmenterPeriodesAlimentaires`
   et `interpolerPoidsBac` (fonctions pures)
3. **@developer** : mettre à jour `src/types/calculs.ts` — ajouter `PeriodeAlimentaire`,
   étendre `DetailAlimentVague`
4. **@developer** : remplacer la logique FCR dans `computeAlimentMetrics`
5. **@tester** : créer `src/__tests__/lib/feed-periods.test.ts` avec les cas de test suivants :
   - Vague mono-aliment → résultat identique à l'ancien algorithme
   - Vague avec switch complet (tous bacs basculent) → FCR correct par produit
   - Vague avec switch partiel (seul Bac A change) → FCR correct par produit
   - Biométries absentes sur une période → dégradation gracieuse (gainBiomasseKg = null)
   - Interpolation linéaire : vérifier la précision sur données synthétiques
6. **@tester** : vérifier que `npm run build` et `npx vitest run` passent
