# ADR — Recherche Approfondie : Analytiques Aliments pour Clarias gariepinus

**Date :** 2026-03-28
**Statut :** RECHERCHE / REFERENCE
**Auteur :** @architect
**Contexte :** Caméroun, élevage intensif de silures africains (Clarias gariepinus)

---

## Résumé exécutif

Ce document rassemble les connaissances zootechniques sur l'alimentation du silure africain
(Clarias gariepinus) en contexte d'élevage intensif au Cameroun et en Afrique subsaharienne,
et traduit ces connaissances en recommandations concrètes pour enrichir le modèle `Produit`,
les relevés d'alimentation et les fonctionnalités analytiques de FarmFlow.

---

## 1. Granulométrie et classification des aliments pour Clarias

### 1.1 Tailles de granulés standardisées

La taille des granulés (ou "granulométrie") est le critère de sélection primaire car elle
doit correspondre à la taille de la gueule du poisson. Pour Clarias gariepinus, les tailles
commerciales standard sont :

| Code taille | Diamètre (mm) | Poissons ciblés (poids moyen) | Phase d'élevage |
|-------------|---------------|-------------------------------|-----------------|
| P0 / Poudre | < 0.5 mm     | Larves 0–0.5 g                | Pré-alevinage   |
| P1 / Poudre | 0.5 mm        | Alevins 0.5–2 g               | Alevinage débutant |
| C1 / Crumble | 1 mm         | Alevins 2–5 g                 | Alevinage       |
| C2 / Crumble | 1.5 mm       | Alevins 5–10 g                | Alevinage fin   |
| G1 / Granulé | 2 mm         | Fingerlings 10–30 g           | Pré-grossissement |
| G2 / Granulé | 3 mm         | Juvéniles 30–100 g            | Grossissement début |
| G3 / Granulé | 4 mm         | Juvéniles 100–300 g           | Grossissement milieu |
| G4 / Granulé | 6 mm         | Sub-adultes 300–600 g         | Grossissement avancé |
| G5 / Granulé | 8 mm         | Adultes > 600 g               | Finition        |

**Implication pour FarmFlow :** Le champ `taille` sur `Produit` doit être un enum structuré
(P0, P1, C1, C2, G1, G2, G3, G4, G5) ou une valeur numérique en mm. L'enum structuré est
préférable pour le filtrage et la comparaison dans les analytics.

### 1.2 Forme physique de l'aliment

Au-delà de la taille, la forme conditionne la flottabilité et la durée de disponibilité
dans l'eau :

- **Aliment coulant (sinker)** : aliment classique, efficace en bac beton/plastique avec
  fond visible, moins de gaspillage mesuré.
- **Aliment flottant (floating/extrudé)** : permet d'observer le comportement alimentaire
  et de contrôler visuellement la quantité consommée. Idéal pour RASmeme si plus cher.
- **Aliment semi-flottant** : compromis courant au Cameroun.

Clarias gariepinus est un nourrisseur de fond naturellement, mais s'adapte aux deux formes
en élevage intensif. Les études montrent que la forme flottante favorise une meilleure
observation et réduit la pollution de l'eau.

### 1.3 Classification par type nutritionnel

| Catégorie | Protéines | Usage principal |
|-----------|-----------|-----------------|
| Starter/Démarrage | 45–50 % | Alevins, croissance rapide |
| Croissance (grower) | 35–45 % | Phase grossissement principale |
| Finition (finisher) | 28–35 % | Dernières semaines avant récolte |
| Reproducteurs | 40–45 % | Breeders, condition corporelle |

---

## 2. Composition nutritionnelle — Propriétés de comparaison

### 2.1 Paramètres nutritionnels clés

Pour comparer deux aliments de même granulométrie et evaluer leur efficacité, les
indicateurs nutritionnels suivants sont relevants :

| Paramètre | Unité | Plage optimale Clarias | Impact |
|-----------|-------|------------------------|--------|
| Protéines brutes | % MS | 35–45 % (grossissement) | Croissance musculaire |
| Lipides bruts | % MS | 5–10 % | Énergie, réduction FCR |
| Fibres brutes | % MS | < 8 % | Digestibilité |
| Humidité | % | < 12 % | Conservation, densité nutritive |
| Cendres | % MS | < 12 % | Qualité matières premières |
| Énergie brute | MJ/kg | 16–20 MJ/kg | Énergie disponible |
| Énergie digestible | MJ/kg | 12–16 MJ/kg | Croissance réelle |
| Phosphore | % MS | 0.8–1.2 % | Squelette, pollution eau |
| Méthionine | % protéines | > 2 % | Acides aminés essentiels |
| Lysine | % protéines | > 4.5 % | Acides aminés essentiels |

**Remarque :** Dans le contexte camerounais, peu d'éleveurs ont accès à la composition
détaillée de l'aliment. Le champ doit rester optionnel. La priorité est de capturer
au minimum les protéines brutes quand disponibles.

### 2.2 Marques commerciales disponibles au Cameroun

Les aliments les plus présents en Afrique centrale / Cameroun :

- **SKRETTING** (Norvège) — aliments extrudés haute qualité, flottants, 28–45 % protéines
- **BIOMAR** — présence croissante, aliments extrudés
- **ALLER AQUA** (Danemark) — bonne disponibilité Afrique de l'Ouest/Centrale
- **RAANAN** — aliments israéliens, bonne réputation Afrique
- **AQUAFEED Cameroun / PRODAC** — marques locales/régionales, coût plus bas, qualité variable
- **FEEDING Cameroun** — aliments artisanaux formulés localement
- **Aliments artisanaux** — mélange farine poisson, son de blé, tourteau soja, produit en ferme

L'aliment artisanal représente une part importante de la consommation camerounaise en raison
du coût. Sa composition varie selon la recette de chaque éleveur.

---

## 3. Indicateurs de performance d'aliment (KPIs)

### 3.1 FCR — Feed Conversion Ratio (Indice de consommation)

```
FCR = Quantité aliment distribué (kg) / Gain de biomasse (kg)
```

- **Benchmarks Clarias gariepinus** :
  - Excellent : FCR < 1.2
  - Bon : FCR 1.2–1.5
  - Acceptable : FCR 1.5–2.0
  - Médiocre : FCR > 2.0
  - Artisanal : FCR souvent 2.5–3.5

**FarmFlow actuel :** FCR est déjà calculé via `calculerFCR()`. Manque : les benchmarks
par phase et par type d'aliment ne sont pas contextualisés.

### 3.2 SGR — Specific Growth Rate (Taux de croissance spécifique)

```
SGR (%/jour) = ((ln(PoidsFinal) - ln(PoidsInitial)) / Jours) × 100
```

- **Benchmarks Clarias** :
  - Excellent : SGR > 3.5 %/jour (alevins)
  - Bon : SGR 2.5–3.5 %/jour (grossissement)
  - Acceptable : SGR 1.5–2.5 %/jour (finition)
  - Critique : SGR < 1.5 %/jour

**FarmFlow actuel :** SGR calculé. Manque : benchmarks différenciés par phase.

### 3.3 PER — Protein Efficiency Ratio

```
PER = Gain de poids (g) / Protéines consommées (g)
```

- Calculable uniquement si on connaît le taux de protéines de l'aliment.
- Benchmark : PER > 2.0 pour Clarias en grossissement.
- **FarmFlow :** Actuellement non calculé. Nécessite l'ajout du champ `tauxProteines` sur Produit.

### 3.4 Coût par kg de poisson produit

```
Coût/kg = (Quantité aliment × Prix unitaire) / Gain biomasse
```

**FarmFlow actuel :** Calculé via `calculerCoutParKgGain()`. C'est le KPI économique principal.

### 3.5 Coût alimentaire par cycle (total)

```
Coût cycle = Σ (ReleveConsommation.quantite × Produit.prixUnitaire)
```

**FarmFlow actuel :** Calculé dans `getComparaisonVagues()`.

### 3.6 ADG — Average Daily Gain (Gain journalier moyen)

```
ADG (g/jour) = (PoidsFinal - PoidsInitial) / Jours
```

- Benchmark Clarias adultes (300–600 g) : ADG 3–6 g/jour en conditions optimales.
- **FarmFlow :** Non calculé actuellement. Simple à ajouter.

### 3.7 DFR — Daily Feeding Rate (Taux d'alimentation quotidien)

```
DFR (% poids corporel/jour) = (Aliment jour / Biomasse estimée) × 100
```

- Benchmark Clarias : 3–5 % de la biomasse/jour (varie selon T° et taille)
- **FarmFlow :** Non calculé. Utile pour alerter sur sous/sur-alimentation.

### 3.8 Taux de refus / Perte aliment

- Estimé visuellement par l'éleveur : 0 % (tout mangé), 10 %, 25 %, > 50 %
- Permet d'ajuster la ration et d'identifier les problèmes de santé.
- **FarmFlow :** Non capturé. Un champ `tauxRefus` sur le relevé ALIMENTATION serait utile.

---

## 4. Protocoles d'alimentation et données à capturer par cycle

### 4.1 Cycle de vie et phases d'élevage Clarias gariepinus

```
Ponte → Larves (J0–J7) → Alevins pré-grossissement (J7–J30) →
Fingerlings (J30–J60) → Juvéniles (J60–J120) → Sub-adultes (J120–J180) →
Adultes / Récolte (J180–J240)
```

- **Durée typique d'un cycle de grossissement :** 5–7 mois au Cameroun (à 25–30°C)
- **Poids de mise en charge typique :** 2–5 g (alevins fingerling)
- **Poids de récolte typique :** 400–800 g (selon marché, souvent 500 g minimum)
- **Densité optimale en bac béton :** 80–120 kg/m³ en fin de cycle

### 4.2 Fréquence et ration recommandées par phase

| Phase | Poids moyen | Fréquence | Ration (% poids/jour) | Taille granulé |
|-------|-------------|-----------|------------------------|----------------|
| Larve | < 1 g | 6–8 fois/jour | 10–15 % | Poudre 0.5 mm |
| Alevin | 1–5 g | 4–6 fois/jour | 8–10 % | Crumble 1 mm |
| Fingerling | 5–30 g | 3–4 fois/jour | 5–8 % | Granulé 2–3 mm |
| Juvénile | 30–150 g | 2–3 fois/jour | 4–5 % | Granulé 3–4 mm |
| Sub-adulte | 150–400 g | 2 fois/jour | 3–4 % | Granulé 4–6 mm |
| Adulte/Finition | > 400 g | 1–2 fois/jour | 2–3 % | Granulé 6–8 mm |

**Note :** Ces rations sont ajustées selon la température de l'eau. En dessous de 20°C,
réduire la ration de 30–50 %. Au-dessus de 32°C, risque de stress et réduction d'appétit.

### 4.3 Impact de la qualité de l'eau sur l'alimentation

| Paramètre | Plage optimale | Impact alimentation |
|-----------|---------------|---------------------|
| Température | 25–30°C | FCR optimal à 28°C |
| pH | 6.5–8.0 | En dehors → stress |
| Oxygène dissous | > 4 mg/L | < 3 mg/L : refus aliment |
| Ammoniaque NH₃ | < 0.05 mg/L | Intoxication → anorexie |
| Turbidité | 30–60 NTU | Trop clair → stress |

**FarmFlow actuel :** Ces paramètres sont déjà capturés dans `Releve` (typeReleve: QUALITE_EAU).
Il manque la corrélation automatique dans les analytics (ex. : FCR dégradé lors des semaines
où T° < 22°C).

---

## 5. Analytics et comparaisons à valeur ajoutée

### 5.1 Comparaisons actuellement disponibles dans FarmFlow

- Aliment A vs Aliment B : FCR moyen, SGR moyen, coût/kg gain
- Meilleur aliment par site (dashboard)
- Simulation de changement d'aliment
- Évolution FCR dans le temps par aliment

### 5.2 Comparaisons manquantes à haute valeur

#### 5.2.1 Comparaison par taille de granulé

Actuellement, si un éleveur utilise "Skretting G2 3mm" et "Skretting G3 4mm", ils sont
comparés ensemble sans tenir compte qu'ils ciblent des phases différentes. Il faut :
- Filtrer/grouper les analytics par `taille` (granulométrie)
- Permettre de comparer uniquement des aliments de même taille (même stade de poisson)
- Afficher un avertissement si on compare des aliments de tailles différentes

#### 5.2.2 FCR par semaine/phase du cycle

L'évolution du FCR au cours d'un cycle révèle des problèmes précis :
- FCR élevé en semaine 3 → problème d'adaptation après changement de granulé
- FCR qui dégrade progressivement → problème qualité eau ou maladie
- **Recommandation :** Graphique FCR hebdomadaire corrélé aux changements de taille
  de granulé et aux anomalies qualité eau.

#### 5.2.3 Coût aliment / kg produit par phase

Décomposer le coût alimentaire par phase permet d'identifier la phase la plus coûteuse :
- Phase alevinage : aliment plus cher par kg mais utilisé en faible quantité
- Phase grossissement : gros volume → FCR devient critique

#### 5.2.4 Comparaison fournisseur même taille

"Aller Aqua G2 3mm" vs "PRODAC G2 3mm" sur la même phase → comparaison valide et utile.

#### 5.2.5 Corrélation mortalité / type aliment

Des maladies (ex. : entérite) peuvent être liées à un aliment de mauvaise qualité.
Un graphique mortalité vs aliment utilisé pendant la même période permettrait de détecter
des alertes précoces.

#### 5.2.6 Consommation réelle vs ration théorique

Si le `ConfigElevage` définit une ration théorique (% poids/jour), comparer la consommation
réelle relevée à cette ration permet de détecter :
- Sous-alimentation (consommation < 80 % ration théorique)
- Sur-alimentation et gaspillage
- Problèmes d'appétit (indicateur de stress ou maladie précoce)

---

## 6. Nouvelles captures de données recommandées

### 6.1 Champs à ajouter sur le modèle `Produit` (aliments)

| Champ | Type | Description | Priorité |
|-------|------|-------------|----------|
| `tailleGranule` | Enum (`TailleGranule`) | P0, P1, C1, C2, G1–G5 | MUST-HAVE |
| `formeAliment` | Enum (`FormeAliment`) | FLOTTANT, COULANT, SEMI_FLOTTANT | SHOULD |
| `tauxProteines` | Float? (%) | Protéines brutes selon fiche technique | SHOULD |
| `tauxLipides` | Float? (%) | Lipides bruts | COULD |
| `tauxFibres` | Float? (%) | Fibres brutes | COULD |
| `energieBrute` | Float? (MJ/kg) | Énergie brute | COULD |
| `phasesCibles` | Enum[] (`PhaseElevage`) | Phases d'élevage recommandées | SHOULD |
| `marqueCommerciale` | String? | Nom de marque si différent du produit | NICE |
| `referenceMarque` | String? | Code SKU du fabricant | NICE |
| `datePeremption` | DateTime? | DLC du lot en stock | SHOULD |
| `lotFabrication` | String? | Numéro de lot (traçabilité) | COULD |

### 6.2 Champs à ajouter sur `Releve` (type ALIMENTATION)

| Champ | Type | Description | Priorité |
|-------|------|-------------|----------|
| `tauxRefus` | Float? (%) | Estimation visuelle : 0, 10, 25, 50 % | SHOULD |
| `comportementAlim` | Enum? | NORMAL, LENT, REFUS_PARTIEL, REFUS_TOTAL | SHOULD |
| `rationTheorique` | Float? (g/kg biomasse/jour) | Calculée depuis ConfigElevage | COMPUTED |
| `ecartRation` | Float? (%) | (réel - théorique) / théorique × 100 | COMPUTED |

### 6.3 Nouvelle table `HistoriqueNutritionnel` (optionnel, long terme)

Pour les éleveurs avancés voulant suivre l'évolution nutritionnelle de chaque vague :
- Capturer le profil nutritionnel estimé à chaque phase
- Agréger protéines totales consommées / gain de biomasse = PER
- Permet un benchmarking nutritionnel entre cycles

**Priorité :** NICE-TO-HAVE — à envisager dans une version future.

### 6.4 Capture du changement de taille de granulé (événement)

Aujourd'hui il n'y a pas d'événement "changement de granulé". L'éleveur passe de G2 à G3
sans trace. Recommandation : ajouter un type de relevé `CHANGEMENT_ALIMENT` ou capturer
automatiquement via la comparaison des `ReleveConsommation` successives.

**Implémentation légère :** Détecter automatiquement dans les analytics quand le produit
utilisé change entre deux relevés ALIMENTATION successifs et l'annoter sur les graphiques.

---

## 7. Nouveaux écrans et fonctionnalités analytics recommandés

### 7.1 Filtrage par taille de granulé (MUST-HAVE)

Sur la page `/analytics/aliments`, permettre le filtrage :
- Par taille (P0/P1/C1/C2/G1/G2/G3/G4/G5)
- Par phase ciblée
- Par fournisseur (déjà prévu mais non implémenté dans l'UI)

### 7.2 Graphique FCR hebdomadaire avec annotations (SHOULD)

- Courbe FCR semaine par semaine sur un cycle
- Annotations verticales lors des changements d'aliment (produit différent)
- Overlay qualité eau (température, O₂) pour corrélations visuelles
- Composant `FeedFCRWeeklyChart`

### 7.3 Tableau de bord phase (SHOULD)

Vue par phase d'élevage (détectée depuis poidsMoyen) :
- Aliment utilisé pendant cette phase
- FCR de la phase
- Consommation totale et coût de la phase
- Comparaison avec benchmark théorique

### 7.4 Alerte sous/sur-alimentation (SHOULD)

Si `ConfigElevage` définit des rations théoriques :
- Calculer l'écart entre ration réelle et théorique
- Déclencher une alerte si écart > 20 % sur 3 relevés consécutifs

### 7.5 Score de qualité aliment (NICE)

Algorithme multicritères basé sur :
- FCR (40 % poids)
- SGR (25 % poids)
- Coût/kg (25 % poids)
- Taux survie associé (10 % poids)

Afficher un score /10 sur chaque carte aliment dans la comparaison.

### 7.6 Rapport consommation par période (SHOULD)

Export (PDF/Excel) du plan d'alimentation effectif :
- Tableau : semaine, phase, aliment utilisé, quantité totale, coût, FCR hebdomadaire
- Utile pour la comptabilité et le suivi agronomique

### 7.7 Courbe de croissance vs référentiel (SHOULD)

Comparer la courbe poids moyen observée avec une courbe théorique standard
pour Clarias en conditions optimales (25°C, FCR 1.5, aliment 35 % protéines) :
- Permet de visualiser les décrochages de croissance
- Identifie les semaines problématiques
- Référentiel configurable dans ConfigElevage

---

## 8. Données à capturer depuis le premier jour pour analytics complets

### 8.1 À la création de la vague (déjà partiellement implémenté)

- Poids moyen initial des alevins (FAIT)
- Nombre initial d'alevins (FAIT)
- Taille de granulé de départ (NON — à ajouter sur Vague ou ConfigElevage)
- Aliment de départ prévu (NON — à lier à ConfigElevage)
- Protocole d'alimentation (ration théorique, fréquence) (PARTIEL — ConfigElevage)
- Origine des alevins (FAIT — origineAlevins, LotAlevins)

### 8.2 À chaque relevé ALIMENTATION (améliorations)

- Heure de la distribution (PARTIEL — champ heure dans Releve)
- Produit exact utilisé via ReleveConsommation (FAIT)
- Taux de refus estimé (NON — à ajouter)
- Comportement alimentaire général (NON — à ajouter)

### 8.3 À chaque relevé BIOMETRIE (déjà bien capturé)

- Poids moyen (FAIT)
- Taille moyenne (FAIT)
- Taille de l'échantillon (FAIT — echantillonCount)

### 8.4 Changement de taille de granulé

- Date du changement (NON — pas d'événement dédié)
- Ancien produit / nouveau produit (peut être inféré depuis ReleveConsommation)
- Raison (croissance / rupture stock / test nouveau produit) (NON)

---

## 9. Facteurs contextuels Cameroun

### 9.1 Contraintes opérationnelles

- **Chaîne logistique :** Les aliments commerciaux (Skretting, Aller Aqua) ont des délais
  de livraison de 2–4 semaines depuis l'importation. Stock tampon nécessaire.
- **Coût aliment :** Représente 60–75 % du coût opérationnel total. Le FCR et le coût/kg
  sont donc les KPIs les plus critiques.
- **Aliments artisanaux :** Formulation locale à partir de sous-produits (farine de poisson,
  son de blé, tourteau soja, huile de palme). Composition variable = difficulté de suivi.
- **Stockage :** Humid et chaud (25–35°C) → risque d'aflatoxines si stockage > 3 mois.
  Le champ `datePeremption` devient critique.
- **Électricité :** Coupures fréquentes → systèmes d'aération discontinue → stress
  alimentaire. Corrélation à capturer.

### 9.2 Saisonnalité

- **Saison sèche (nov–mars) :** Eau plus froide (parfois < 22°C la nuit), FCR dégradé.
- **Saison des pluies (avr–oct) :** Risques de débordement, eaux turbides si étangs,
  mais températures optimales pour la croissance.
- Recommandation : ajouter un filtre "saison" dans les comparaisons analytics.

### 9.3 Connectivité terrain

- L'ingénieur sur le terrain doit pouvoir saisir les relevés offline (PWA).
- Les champs `tauxRefus` et `comportementAlim` doivent être simples : listes déroulantes,
  pas de saisie numérique complexe.

---

## 10. Recommandations architecturales

### 10.1 Nouveaux enums Prisma à créer

```prisma
enum TailleGranule {
  P0    // Poudre < 0.5 mm
  P1    // Poudre 0.5 mm
  C1    // Crumble 1 mm
  C2    // Crumble 1.5 mm
  G1    // Granulé 2 mm
  G2    // Granulé 3 mm
  G3    // Granulé 4 mm
  G4    // Granulé 6 mm
  G5    // Granulé 8 mm
}

enum FormeAliment {
  FLOTTANT
  COULANT
  SEMI_FLOTTANT
  POUDRE
}

enum ComportementAlimentaire {
  NORMAL
  LENT
  REFUS_PARTIEL
  REFUS_TOTAL
}
```

### 10.2 Modifications du modèle `Produit`

```prisma
// Sur le modèle Produit (champs ALIMENT uniquement — nullable sur autres catégories)
tailleGranule     TailleGranule?           // Granulométrie aliment
formeAliment      FormeAliment?            // Forme physique
tauxProteines     Float?                   // % protéines brutes
tauxLipides       Float?                   // % lipides bruts
tauxFibres        Float?                   // % fibres brutes
phasesCibles      PhaseElevage[]           // Phases recommandées (array)
```

### 10.3 Modifications du modèle `Releve` (type ALIMENTATION)

```prisma
// Sur le modèle Releve (alimentation uniquement)
tauxRefus         Float?                   // % aliment non consommé (0-100)
comportementAlim  ComportementAlimentaire? // Comportement observé
```

### 10.4 Interface TypeScript correspondante

```typescript
export enum TailleGranule {
  P0 = "P0",
  P1 = "P1",
  C1 = "C1",
  C2 = "C2",
  G1 = "G1",
  G2 = "G2",
  G3 = "G3",
  G4 = "G4",
  G5 = "G5",
}

export enum FormeAliment {
  FLOTTANT = "FLOTTANT",
  COULANT = "COULANT",
  SEMI_FLOTTANT = "SEMI_FLOTTANT",
  POUDRE = "POUDRE",
}

export enum ComportementAlimentaire {
  NORMAL = "NORMAL",
  LENT = "LENT",
  REFUS_PARTIEL = "REFUS_PARTIEL",
  REFUS_TOTAL = "REFUS_TOTAL",
}

// Extension de l'interface Produit
export interface ProduitAlimentDetails {
  tailleGranule: TailleGranule | null;
  formeAliment: FormeAliment | null;
  tauxProteines: number | null;    // % MS
  tauxLipides: number | null;      // % MS
  tauxFibres: number | null;       // % MS
  phasesCibles: PhaseElevage[];
}

// Extension de l'interface AnalytiqueAliment
export interface AnalytiqueAlimentEnrichi extends AnalytiqueAliment {
  tailleGranule: TailleGranule | null;
  formeAliment: FormeAliment | null;
  tauxProteines: number | null;
  per: number | null;              // Protein Efficiency Ratio
  adgMoyen: number | null;        // Average Daily Gain (g/jour)
  scoreMoyen: number | null;      // Score /10 multicritères
}
```

### 10.5 Nouvelles fonctions de calcul à ajouter dans `calculs.ts`

```typescript
// ADG - Average Daily Gain
calculerADG(poidsInitial: number, poidsFinal: number, jours: number): number | null

// PER - Protein Efficiency Ratio
calculerPER(gainPoids: number, proteinesConsommees: number): number | null
// Nécessite : quantiteAliment × (tauxProteines/100)

// DFR - Daily Feeding Rate
calculerDFR(quantiteJournaliere: number, biomasse: number): number | null

// Score multicritères aliment (0-10)
calculerScoreAliment(fcr: number|null, sgr: number|null, coutKg: number|null, tauxSurvie: number|null): number | null

// Détection sous/sur-alimentation
detecterEcartRation(consommeKg: number, rationTheoriqueKg: number): number | null
```

### 10.6 Nouveaux benchmarks à ajouter dans `benchmarks.ts`

```typescript
export const BENCHMARK_FCR_CLARIAS = {
  excellent: { max: 1.2 },
  bon: { min: 1.2, max: 1.5 },
  acceptable: { min: 1.5, max: 2.0 },
  mediocre: { min: 2.0 },
} as const;

export const BENCHMARK_SGR_CLARIAS_PAR_PHASE = {
  [PhaseElevage.ALEVINAGE]: { excellent: 4.0, bon: 3.0, acceptable: 2.0 },
  [PhaseElevage.PRE_GROSSISSEMENT]: { excellent: 3.5, bon: 2.5, acceptable: 1.8 },
  [PhaseElevage.GROSSISSEMENT]: { excellent: 3.0, bon: 2.0, acceptable: 1.5 },
  [PhaseElevage.FINITION]: { excellent: 2.0, bon: 1.5, acceptable: 1.0 },
} as const;

export const BENCHMARK_ADG_CLARIAS = {
  fingerling_30g: { excellent: 1.5, bon: 1.0 },       // g/jour
  juvenile_100g: { excellent: 3.0, bon: 2.0 },
  subadulte_300g: { excellent: 5.0, bon: 3.5 },
  adulte_500g: { excellent: 6.0, bon: 4.0 },
} as const;
```

---

## 11. Liste priorisée des améliorations

### Priorité 1 — MUST-HAVE (à implémenter immédiatement)

| ID | Amélioration | Effort | Impact |
|----|--------------|--------|--------|
| F1 | Champ `tailleGranule` (enum) sur Produit | Faible | Très haut |
| F2 | Filtrage analytics par taille de granulé | Moyen | Très haut |
| F3 | Affichage taille granulé sur cartes aliment | Faible | Haut |
| F4 | Avertissement si comparaison tailles différentes | Faible | Haut |

### Priorité 2 — SHOULD-HAVE (sprint suivant)

| ID | Amélioration | Effort | Impact |
|----|--------------|--------|--------|
| F5 | Champ `formeAliment` sur Produit | Faible | Moyen |
| F6 | Champ `tauxProteines` sur Produit (optionnel) | Faible | Haut |
| F7 | Champ `tauxRefus` sur Releve ALIMENTATION | Faible | Haut |
| F8 | Champ `comportementAlim` sur Releve | Faible | Haut |
| F9 | Calcul ADG dans analytics | Faible | Moyen |
| F10 | Benchmarks FCR contextualisés par phase | Moyen | Haut |
| F11 | Score qualité aliment /10 dans comparaison | Moyen | Moyen |

### Priorité 3 — COULD-HAVE (backlog moyen terme)

| ID | Amélioration | Effort | Impact |
|----|--------------|--------|--------|
| F12 | Champs `tauxLipides`, `tauxFibres` sur Produit | Faible | Moyen |
| F13 | Calcul PER (nécessite tauxProteines) | Faible | Moyen |
| F14 | Graphique FCR hebdomadaire avec annotations | Haut | Haut |
| F15 | Corrélation mortalité / aliment utilisé | Haut | Haut |
| F16 | Rapport PDF consommation par période | Haut | Moyen |
| F17 | Détection changement granulé automatique | Moyen | Moyen |
| F18 | Alerte sous/sur-alimentation vs ration théorique | Haut | Haut |

### Priorité 4 — NICE-TO-HAVE (vision long terme)

| ID | Amélioration | Effort | Impact |
|----|--------------|--------|--------|
| F19 | Courbe croissance vs référentiel théorique | Très haut | Haut |
| F20 | Score fournisseur agrégé sur l'ensemble des aliments | Haut | Moyen |
| F21 | Suivi DLC et alertes péremption stock aliment | Moyen | Moyen |
| F22 | Filtrage analytics par saison | Moyen | Faible |
| F23 | Table HistoriqueNutritionnel | Très haut | Bas |
| F24 | Calcul DFR et alerte sur-alimentation | Moyen | Moyen |

---

## 12. Impact minimal immédiat : migration schema pour `tailleGranule`

La modification la plus impactante et la plus simple est l'ajout de `tailleGranule` sur
`Produit`. Cette migration est non destructive (champ nullable) :

```sql
-- Migration Prisma : ADD COLUMN tailleGranule sur Produit
-- Enum TailleGranule : P0, P1, C1, C2, G1, G2, G3, G4, G5

CREATE TYPE "TailleGranule" AS ENUM ('P0', 'P1', 'C1', 'C2', 'G1', 'G2', 'G3', 'G4', 'G5');
ALTER TABLE "Produit" ADD COLUMN "tailleGranule" "TailleGranule";
```

Les données existantes garderont `tailleGranule = NULL`, ce qui est acceptable car l'éleveur
peut mettre à jour ses produits en éditant chaque aliment.

---

## 13. Conclusion et prochaines étapes

1. **Sprint immédiat :** Implémenter F1–F4 (taille granulé sur Produit + filtre analytics)
2. **Sprint suivant :** Implémenter F5–F11 (enrichissement nutritionnel + indicateurs avancés)
3. **Backlog moyen terme :** F12–F18 (corrélations avancées, alertes alimentation)
4. **Vision long terme :** F19–F24 (courbes de croissance, table nutritionnelle)

L'amélioration la plus critique pour les pisciculteurs camerounais est **F1+F2** : sans
la taille de granulé, toute comparaison entre aliments est potentiellement trompeuse car
elle ignore la phase d'élevage. Un FCR de 1.8 pour un aliment 1mm (alevins) est excellent,
tandis que le même FCR pour un aliment 6mm (adultes) est médiocre. Ce contexte est absent
de l'application actuelle.

---

## Références et sources

- FAO Fisheries Technical Paper No. 408 — "Feeds and Feeding of Fish and Shrimp"
- CIRAD / IFREMER — Guides d'aquaculture en Afrique subsaharienne
- Hogendoorn H.C. (1983) — Controlled propagation of the African catfish, Clarias lazera
- Hecht T. et Oellermann L. (1994) — Clarias gariepinus production
- NovAtel Aquaculture — Guide d'alimentation Skretting Clarias
- Aller Aqua Africa — Technical feeding guide for African catfish
- FAO AQUACULTURE STATISTICS — Cameroon
- Benchmarks FCR/SGR : Publications CSIR South Africa sur l'aquaculture Clarias
