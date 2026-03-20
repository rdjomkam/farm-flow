# ADR — Density Calculation and Alert System

**Statut :** ACCEPTE
**Auteur :** @architect
**Date :** 2026-03-19
**Mis a jour :** 2026-03-20 — [REVISION MAJEURE] Abandon du density-alert-service independant. Extension du moteur RegleActivite existant avec des conditions composees (ConditionRegle). Suppression des interfaces DensityAlertInput/QualiteEauSnapshot/RenouvellementSnapshot en tant que types separes. Les valeurs renouvellementMinimum/renouvellementCritique/delaiSansQualiteEauJours migrent vers les conditions des regles seedees (plus dans ConfigElevage). fenetreRenouvellementJours conserve dans ConfigElevage pour le context builder.

**Mis a jour :** 2026-03-20 — [CORRECTIF] Section 4.1 : spec complete de `calculerDensiteBac()` avec usage explicite de `computeVivantsByBac()` et filtrage de la biometrie par bacId. Ajout section 4.1b : `calculerDensiteVague()` (somme des biomasses / somme des volumes) pour affichage dashboard uniquement. Section 6.3 : correction du calcul de `densiteKgM3` — NE PAS utiliser `indicateurs.biomasse` (vague-level ou approximatif) mais recalculer la biomasse per-bac avec `computeVivantsByBac()` + biometrie filtree par bacId. Note sur le probleme pre-existant de `context.ts`. Section 12 Phase A : taches mises a jour pour expliciter la correction du context builder (parametre `bacs`, calcul rigoureux `densiteKgM3`, note sur calcul legacy `nombreVivants`).
**Sprint cible :** Sprint 27-28

---

## Table des matieres

1. [Contexte et probleme](#1-contexte-et-probleme)
2. [Ce qui existe deja](#2-ce-qui-existe-deja)
3. [Seuils issus de la recherche](#3-seuils-issus-de-la-recherche)
4. [Moteur de calcul de densite](#4-moteur-de-calcul-de-densite)
5. [Modele de donnees — Changements Prisma](#5-modele-de-donnees--changements-prisma)
6. [Extension du moteur RegleActivite — Conditions composees](#6-extension-du-moteur-regleactivite--conditions-composees)
7. [Systeme d'actions recommandees](#7-systeme-dactions-recommandees)
8. [API routes necessaires](#8-api-routes-necessaires)
9. [Composants UI](#9-composants-ui)
10. [Integration avec les systemes existants](#10-integration-avec-les-systemes-existants)
11. [Strategie de migration](#11-strategie-de-migration)
12. [Phases d'implementation](#12-phases-dimplementation)
13. [Decisions rejetees](#13-decisions-rejetees)

---

## 1. Contexte et probleme

Les pisciculteurs camerounais gerent des Clarias gariepinus dans des conditions tres variables : bacs en beton, plastique, etangs, parfois des systemes avec renouvellement d'eau actif. La densite de peuplement est le facteur le plus critique pour la sante des poissons et la rentabilite du cycle.

**Le probleme actuel :** Farm-Flow calcule une densite globale par vague (biomasse / volume de tous les bacs) et n'a aucun systeme d'alerte parametrique base sur les seuils scientifiques. Il n'y a pas de notion de type de systeme sur un bac, ce qui rend impossible l'application de seuils differencies (bac beton vs RAS vs etang).

**Ce qu'il faut construire :**
- Un calcul de densite correct par bac (pas par vague), tenant compte du type de systeme
- Un moteur d'alerte configurable qui etend le systeme RegleActivite deja existant (Sprint 21) avec des **conditions composees** (ET / OU)
- Des recommandations d'actions directement actionnables depuis mobile
- Un suivi reel du renouvellement d'eau via des releves RENOUVELLEMENT, pas un champ statique
- Une evaluation croisee de la densite avec la qualite d'eau pour des alertes plus precises et urgentes, exprimee directement comme regles seedees

**Contrainte cle :** Ce systeme est destine a de petits pisciculteurs camerounais sur telephone mobile. Les alertes mal calibrees ou trop frequentes seront ignorees, puis desactivees. Le principe de conception est : **une alerte = une action concrete possible maintenant.**

---

## 2. Ce qui existe deja

### Ce qui peut etre reutilise directement

| Composant | Fichier | Utilite pour ce systeme |
|-----------|---------|------------------------|
| `calculerDensite()` | `src/lib/calculs.ts` | Calcule biomasse/volume, adapte a l'usage par bac |
| `ConfigElevage` | `prisma/schema.prisma`, `src/types/models.ts` | Contient deja `densiteMaxPoissonsM3`, `eauChangementPct`, seuils qualite eau — a etendre pour le type systeme |
| `RegleActivite` + moteur | Sprint 21 | Moteur de declenchement + generation d'activites — base de notre systeme d'alerte etendu |
| `TypeDeclencheur` | `src/types/models.ts` | Contient deja `SEUIL_QUALITE`, `SEUIL_MORTALITE`, `FCR_ELEVE` |
| `ConfigAlerte` + `Notification` | `prisma/schema.prisma` | Structure de notification existante, a conserver |
| `TypeAlerte` enum | `src/types/models.ts` | Contient `MORTALITE_ELEVEE`, `QUALITE_EAU`, `STOCK_BAS`, `RAPPEL_ALIMENTATION`, `RAPPEL_BIOMETRIE` |
| `computeVivantsByBac()` | `src/lib/calculs.ts` | Calcul des vivants par bac deja disponible |
| `getIndicateursVague()` | `src/lib/queries/indicateurs.ts` | Calculs per-bac deja en place |
| `Releve` model | `prisma/schema.prisma` | Modele a champs optionnels par type — pattern a etendre pour RENOUVELLEMENT |
| `evaluateRules()` | `src/lib/activity-engine/evaluator.ts` | Evaluateur de regles — a etendre pour les conditions composees |
| `buildEvaluationContext()` | `src/lib/activity-engine/context.ts` | Context builder — a etendre avec densite, renouvellement, absence releve |

### Ce qui manque

1. **Type de systeme sur Bac** — impossible de differencier bac beton/RAS/etang
2. **~~Taux de renouvellement d'eau sur Bac~~** — [SUPPRIME] Remplace par des releves RENOUVELLEMENT
3. **Seuils de densite differencies par systeme** dans ConfigElevage (pour le UI badge uniquement)
4. **Nouveaux TypeReleve** : `RENOUVELLEMENT` — evenement de renouvellement d'eau reel
5. **Quatre nouveaux TypeAlerte** : `DENSITE_ELEVEE`, `RENOUVELLEMENT_EAU_INSUFFISANT`, `AUCUN_RELEVE_QUALITE_EAU`, `DENSITE_CRITIQUE_QUALITE_EAU`
6. **Trois nouveaux TypeDeclencheur** : `SEUIL_DENSITE`, `SEUIL_RENOUVELLEMENT`, `ABSENCE_RELEVE`
7. **Conditions composees sur RegleActivite** — un modele `ConditionRegle` enfant avec logique ET/OU
8. **Nouvelles donnees dans RuleEvaluationContext** — densite, taux de renouvellement, jours depuis dernier releve qualite eau
9. **Action tracking** — la Notification actuelle n'a pas de lien vers l'action recommandee (le champ `lien` existe mais n'est pas structure)

---

## 3. Seuils issus de la recherche

Source : `docs/research/clarias-gariepinus-density-parameters.md`

### 3.1 Seuils de densite de biomasse par type de systeme

Ces valeurs sont les defaults a stocker dans ConfigElevage, differencies par `TypeSystemeBac`. Elles servent au UI badge ; les seuils d'alerte reels sont encodes dans les regles seedees.

| Type systeme | Densite optimale max | Seuil alerte orange | Seuil alerte rouge | Source |
|-------------|---------------------|---------------------|-------------------|--------|
| Etang en terre | 4 kg/m2 (soit ~4-8 kg/m3 sur 0.5-1m eau) | 30 kg/m3 | 40 kg/m3 | FAO, etangs intensifs 40 t/ha |
| Bac beton/plastique | 100 kg/m3 | 150 kg/m3 | 200 kg/m3 | Nigeria backyard, bacs 4x3x1.3m |
| RAS | 200 kg/m3 | 350 kg/m3 | 500 kg/m3 | Commercial RAS Europe/Afrique |

**Justification des seuils bac beton :** La litterature nigerienne (systeme dominant au Cameroun) cite ~150 kg/m3 comme densite finale commerciale dans un bac 4x3x1.3m avec 400 poissons. Au-dela, les risques de qualite d'eau augmentent fortement sans RAS. Le seuil orange a 150 kg/m3 est donc la limite de confort ; le seuil rouge a 200 kg/m3 indique un risque serieux.

**Justification des seuils RAS :** Les systemes RAS commerciaux (Pays-Bas, reference FAO) operent de 200-350 kg/m3. 500 kg/m3 est le maximum teste experimentalement. Le seuil rouge a 500 kg/m3 est donc conservateur pour un contexte RAS.

### 3.2 Renouvellement d'eau requis en fonction de la densite

| Densite biomasse | Renouvellement minimum recommande |
|-----------------|----------------------------------|
| < 50 kg/m3 | 25% du volume/jour |
| 50-100 kg/m3 | 50% du volume/jour |
| > 100 kg/m3 | 50-100% du volume/jour |
| RAS (systeme ferme) | 20-25% eau neuve/jour + recirculation 1x/heure |

**Regle pratique Cameroun (source etude Mont Cameroun) :** 86%/jour de renouvellement produit la meilleure croissance. Le minimum recommande est 50%/jour. En dessous de 25%/jour a densite > 50 kg/m3, il y a risque d'accumulation d'ammoniac.

**Calcul du taux reel depuis les releves RENOUVELLEMENT :**
Au lieu d'un champ statique, le taux de renouvellement effectif est calcule sur une fenetre glissante de N jours (defaut : 7 jours, configurable dans ConfigElevage via `fenetreRenouvellementJours`) en sommant les `pourcentageRenouvellement` des releves RENOUVELLEMENT de ce bac dans la periode. Cela donne un taux moyen %/jour base sur des donnees reelles. Ce calcul est effectue dans le context builder.

### 3.3 Parametres qualite eau (deja dans ConfigElevage, a verifier)

| Parametre | Seuil vert | Seuil orange | Seuil rouge |
|-----------|-----------|-------------|-------------|
| Temperature | 26-32 C | 22-25 C ou 33-34 C | < 22 C ou > 34 C |
| Oxygene dissous | > 6 mg/L | 4-6 mg/L | < 4 mg/L |
| pH | 7.0-8.0 | 6.5-7.0 ou 8.0-8.5 | < 6.5 ou > 8.5 |
| Ammoniac (NH3) | < 0.05 mg/L | 0.05-1.0 mg/L | > 1.0 mg/L |
| Nitrites (NO2) | < 0.1 mg/L | 0.1-0.5 mg/L | > 0.5 mg/L |

Ces valeurs sont deja presentes dans ConfigElevage. L'ADR ne modifie pas ces seuils.

### 3.4 Matrice de croisement densite x qualite eau

Le systeme d'alerte croise le niveau de densite (OK / ALERTE / CRITIQUE) avec le niveau de qualite eau du dernier releve QUALITE_EAU du bac (BON / DEGRADE / CRITIQUE) ou l'absence de releve recent (INCONNU).

| Densite \ Qualite eau | BON | DEGRADE | CRITIQUE | INCONNU (> 3 jours) |
|-----------------------|-----|---------|----------|---------------------|
| **OK** (< seuil alerte) | Aucune alerte | AVERTISSEMENT qualite eau seule | CRITIQUE qualite eau seule | INFO : faire releve qualite eau |
| **ALERTE** (> seuil alerte) | AVERTISSEMENT densite | CRITIQUE combine (densite + eau) | CRITIQUE maximale — action urgente | AVERTISSEMENT densite + AVERTISSEMENT absence releve |
| **CRITIQUE** (> seuil critique) | CRITIQUE densite | CRITIQUE maximale | CRITIQUE maximale — urgence absolue | CRITIQUE densite + AVERTISSEMENT absence releve |

**Regles de la matrice :**
- "CRITIQUE combine" signifie que l'alerte DENSITE_ELEVEE passe de AVERTISSEMENT a CRITIQUE si la qualite eau est DEGRADE ou CRITIQUE en meme temps
- "CRITIQUE maximale" declenche les deux TypeAlerte : `DENSITE_ELEVEE` (CRITIQUE) et `QUALITE_EAU` (CRITIQUE) avec action prioritaire : renouvellement d'eau immediat
- INCONNU (aucun releve QUALITE_EAU depuis > 3 jours) avec densite > seuil alerte declenche `AUCUN_RELEVE_QUALITE_EAU` en plus de l'alerte de densite

**Evaluation de la qualite eau :**
La qualite eau d'un releve QUALITE_EAU est classee comme suit (priorite max sur les parametres) :
- CRITIQUE si : oxygene < 4 mg/L OU ammoniac > 1.0 mg/L OU pH < 6.5 OU pH > 8.5 OU nitrites > 0.5 mg/L
- DEGRADE si : oxygene 4-6 mg/L OU ammoniac 0.05-1.0 mg/L OU pH 6.5-7.0 OU pH 8.0-8.5 OU nitrites 0.1-0.5 mg/L
- BON : tous les parametres dans la plage optimale

Cette matrice documente le raisonnement derriere les regles composees seedees (section 6.5). Chaque cellule de la matrice correspond a une ou plusieurs regles avec logique ET.

### 3.5 Indicateurs de performance (FCR, survie, croissance)

| Indicateur | Bon | Satisfaisant | Mauvais/Alerte |
|-----------|-----|-------------|----------------|
| FCR | < 1.5 | 1.5-2.5 | > 2.5 (deja dans ConfigElevage.fcrAlerteMax) |
| Taux de survie grossissement | > 80% | 50-80% | < 50% |
| Croissance journaliere | >= 3 g/j | 1.5-3 g/j | < 1.5 g/j |
| Mortalite quotidienne | < 1%/jour | 1-3%/jour | > 3%/jour (deja dans ConfigElevage) |

---

## 4. Moteur de calcul de densite

### 4.1 Calcul de densite par bac (correct et complet)

La fonction `calculerDensite()` existante est correcte pour le calcul de base. Le probleme est qu'elle prend la biomasse d'une vague entiere, pas d'un bac specifique.

**Algorithme `calculerDensiteBac()` — signature attendue :**

```typescript
function calculerDensiteBac(
  bac: { id: string; volume: number | null; nombreInitial: number | null },
  bacs: { id: string; nombreInitial: number | null }[],  // tous les bacs de la vague
  releves: ReleveCtx[],                                   // tous les releves de la vague (trie par date asc)
  nombreInitialVague: number
): number | null
```

**Algorithme interne :**

```
calculerDensiteBac(bac, bacs, releves, nombreInitialVague) =

  // Etape 1 : Vivants pour CE bac via computeVivantsByBac()
  vivantsByBac = computeVivantsByBac(bacs, releves, nombreInitialVague)
  vivantsBac   = vivantsByBac.get(bac.id) ?? 0

  // Etape 2 : Poids moyen — prendre la derniere biometrie POUR CE BAC
  relevesBac       = filtrer releves par bacId == bac.id
  biometriesBac    = filtrer relevesBac par typeReleve == BIOMETRIE
  poidsMoyenBac    = biometriesBac.at(-1)?.poidsMoyen ?? null

  // Fallback : si aucune biometrie par bac, utiliser la derniere biometrie globale
  // (coherent avec getIndicateursVague(), path "no bacId on releves")
  si poidsMoyenBac == null :
    biometriesGlobales = filtrer releves (tous) par typeReleve == BIOMETRIE
    poidsMoyenBac      = biometriesGlobales.at(-1)?.poidsMoyen ?? null

  // Etape 3 : Biomasse per-bac
  biomasseBac = poidsMoyenBac * vivantsBac / 1000  (en kg)
  // null si poidsMoyenBac == null

  // Etape 4 : Densite
  si bac.volume == null ou bac.volume <= 0 ou biomasseBac == null :
    retourner null   // ne pas bloquer le systeme, juste pas d'alerte de densite
  volumeM3 = bac.volume / 1000
  retourner biomasseBac / volumeM3
```

**Regles importantes :**
- `computeVivantsByBac()` (deja dans `src/lib/calculs.ts`) est la source unique de verite pour les vivants par bac. Ne pas dupliquer la logique.
- La biometrie est filtree par `bacId == bac.id` avant de tomber en fallback global. Cela garantit que si le formulaire de releve associe le releve a un bac, la densite de CE bac utilise son propre poids moyen.
- Si `bac.volume` est null : retourner null (pas d'alerte de densite pour ce bac).

Cette logique est a encapsuler dans une nouvelle fonction `calculerDensiteBac()` dans `src/lib/calculs.ts`.

### 4.1b Calcul de densite vague-level (pour le dashboard)

Pour afficher une densite globale de la vague sur le dashboard (pas pour les alertes — les alertes evaluent toujours par bac), utiliser :

```
calculerDensiteVague(bacs, releves, nombreInitialVague) =

  densiteVague = sum(biomasseBac pour chaque bac avec volume non null)
               / sum(bac.volume / 1000 pour chaque bac avec volume non null)

  ou biomasseBac est calcule comme dans calculerDensiteBac() ci-dessus

  // Retourne null si aucun bac n'a de volume renseigne
  // Retourne null si aucune biometrie disponible
```

**Raison de la ponderation par volume :** Additionner les biomasses et diviser par la somme des volumes (plutot que faire la moyenne des densites par bac) est mathematiquement correct — c'est la densite moyenne ponderee par capacite, coherente avec la notion de charge globale du systeme.

**Usage :** Composant `vague-densites-summary.tsx`, page detail vague, widget dashboard. Les regles d'alerte n'utilisent JAMAIS `calculerDensiteVague()` — elles evaluent `densiteKgM3` par bac dans le `RuleEvaluationContext`.

### 4.2 Calcul du taux de renouvellement effectif depuis les releves

Au lieu d'utiliser un champ statique `tauxRenouvellement`, on calcule le taux reel depuis les releves RENOUVELLEMENT. Ce calcul alimente `tauxRenouvellementPctJour` dans le `RuleEvaluationContext`.

**Signature de la fonction :**

```typescript
function computeTauxRenouvellement(
  relevesRenouvellement: ReleveRenouvellement[],
  bacVolumeLitres: number,
  periodeDays: number = 7
): number | null
// Retourne null si aucun releve dans la periode
// Retourne le % moyen/jour = somme(pourcentages) / periodeDays
// Si pourcentageRenouvellement est null mais volumeRenouvele est renseigne :
//   pourcentage = (volumeRenouvele / bacVolumeLitres) * 100
```

**Logique :**
```
dateDebut = maintenant - periodeDays jours
releves = filtrer par bacId, typeReleve = RENOUVELLEMENT, date >= dateDebut

POUR chaque releve :
  SI pourcentageRenouvellement != null :
    utiliser pourcentageRenouvellement
  SINON SI volumeRenouvele != null ET bacVolumeLitres > 0 :
    convertir = (volumeRenouvele / bacVolumeLitres) * 100
  SINON :
    ignorer ce releve (donnees insuffisantes)

tauxMoyen = somme(pourcentages) / periodeDays
```

**Cas limites :**
- Si la fenetre contient 0 releves : retourner null (renouvellement inconnu — pas d'alerte de renouvellement insuffisant, mais alerte AUCUN_RELEVE_QUALITE_EAU si densite elevee)
- Si la fenetre contient des releves mais seulement avec volumeRenouvele et bac.volume est null : ignorer ces releves, retourner null

### 4.3 Densite effective vs densite nominale

Pour les bacs avec renouvellement d'eau eleve, la densite effective tolerable est plus haute. On n'implemente PAS de "densite effective" complexe dans la V1 — c'est une approximation rarement utilisee sur le terrain camerounais. Les seuils configures par type de systeme absorbent cette variabilite.

### 4.4 Facteur type de systeme

Chaque bac aura un `typeSysteme: TypeSystemeBac` (enum a creer). Les seuils d'alerte de densite sont selectionnes en fonction de ce type. Si `typeSysteme` est null (bacs existants), on applique les seuils bac beton par defaut (prudence).

---

## 5. Modele de donnees — Changements Prisma

### 5.1 Nouveau enum `TypeSystemeBac`

```prisma
enum TypeSystemeBac {
  BAC_BETON
  BAC_PLASTIQUE
  ETANG_TERRE
  RAS
}
```

**Regroupement BAC_BETON / BAC_PLASTIQUE :** Les seuils de densite sont identiques (150/200 kg/m3). La distinction existe uniquement pour les rapports et la durabilite, pas pour les alertes. On garde les deux valeurs pour la richesse des donnees, mais le moteur d'alerte les traite pareillement.

### 5.2 Champs a ajouter sur le modele `Bac`

```prisma
model Bac {
  // ... champs existants ...

  // Type de systeme d'elevage — determine les seuils de densite applicables
  // Null = BAC_BETON par defaut dans le moteur d'alertes
  typeSysteme       TypeSystemeBac?

  // NOTE : tauxRenouvellement N'EST PAS stocke ici.
  // Le taux reel est calcule depuis les releves de type RENOUVELLEMENT
  // via la fonction computeTauxRenouvellement().
}
```

**Suppression de `tauxRenouvellement` sur Bac :** Le champ statique prevu dans la version initiale de cet ADR est remplace par des releves RENOUVELLEMENT. Cela donne acces aux donnees reelles (quand, combien, par qui), permet le calcul de tendances, et evite la desynchronisation entre la valeur declaree et la pratique reelle.

### 5.3 Champs a ajouter sur le modele `Releve` pour le type RENOUVELLEMENT

Le pattern existant de Releve (champs optionnels par type) est etendu avec deux champs pour RENOUVELLEMENT.

```prisma
model Releve {
  // ... champs existants (biometrie, mortalite, alimentation, qualite_eau, comptage, observation) ...

  // Champs renouvellement eau — remplis uniquement quand typeReleve = RENOUVELLEMENT
  // L'un ou l'autre est renseigne (ou les deux si le formulaire calcule automatiquement)
  pourcentageRenouvellement Float?  // % du volume du bac renouvelee (ex: 50 = 50%)
  volumeRenouvele           Float?  // Volume reel en litres (alternative a pourcentageRenouvellement)
}
```

**Logique de saisie UI :** Le formulaire de releve de type RENOUVELLEMENT affiche deux champs lies. Si l'utilisateur saisit le pourcentage et que bac.volume est connu, le volume en litres est calcule automatiquement (et inversement). Les deux valeurs sont sauvegardees si les deux sont disponibles. Si bac.volume est null, seul le champ de volume libre est disponible (pas de conversion possible).

**Regle de validation :**
- Au moins un des deux champs doit etre renseigne pour un releve RENOUVELLEMENT
- `pourcentageRenouvellement` doit etre entre 0 et 100 (inclus)
- `volumeRenouvele` doit etre > 0 et <= bac.volume si connu

### 5.4 TypeReleve : ajout de RENOUVELLEMENT

```prisma
enum TypeReleve {
  BIOMETRIE
  MORTALITE
  ALIMENTATION
  QUALITE_EAU
  COMPTAGE
  OBSERVATION
  RENOUVELLEMENT  // Evenement de renouvellement d'eau du bac
}
```

**Justification :** Tracker les renouvellements comme des releves (plutot qu'un champ statique sur Bac) permet :
1. De voir l'historique reel des renouvellements avec horodatage
2. De calculer le taux moyen sur n'importe quelle fenetre temporelle
3. D'identifier les ecarts entre la pratique declaree et la pratique reelle
4. D'alerter quand aucun renouvellement n'est enregistre depuis trop longtemps
5. De corroler les renouvellements avec les mesures de qualite eau

### 5.5 Nouveau modele `ConditionRegle` et enums associes

C'est la piece centrale de la revision. Au lieu d'un seul `typeDeclencheur` + `conditionValeur` par regle, une regle peut maintenant avoir plusieurs `ConditionRegle` enfants evaluated collectivement.

```prisma
model ConditionRegle {
  id               String             @id @default(cuid())
  regleId          String
  regle            RegleActivite      @relation(fields: [regleId], references: [id], onDelete: Cascade)
  typeDeclencheur  TypeDeclencheur
  operateur        OperateurCondition @default(SUPERIEUR)
  conditionValeur  Float?
  conditionValeur2 Float?             // Utilise uniquement par ENTRE
  ordre            Int                @default(0)

  @@index([regleId])
}

enum OperateurCondition {
  SUPERIEUR    // valeur > conditionValeur
  INFERIEUR    // valeur < conditionValeur
  ENTRE        // conditionValeur <= valeur <= conditionValeur2
  EGAL         // valeur == conditionValeur
}

enum LogiqueCondition {
  ET    // TOUTES les conditions doivent matcher
  OU    // AU MOINS UNE condition doit matcher
}
```

**Changements sur RegleActivite :**

```prisma
model RegleActivite {
  // ... tous les champs existants restent (backward compatible) ...
  conditions    ConditionRegle[]
  logique       LogiqueCondition @default(ET)
}
```

**Backward compatibility garantie :** Si `rule.conditions.length == 0`, le moteur utilise le legacy `typeDeclencheur` + `conditionValeur` existant. Aucune regle existante n'est cassee. Les nouvelles regles pour la densite utilisent exclusivement `conditions`.

### 5.6 Nouveaux `TypeDeclencheur` a ajouter a l'enum existant

```prisma
enum TypeDeclencheur {
  // ... valeurs existantes (CALENDRIER, RECURRENT, SEUIL_POIDS, SEUIL_QUALITE, SEUIL_MORTALITE, STOCK_BAS, FCR_ELEVE, JALON) ...
  SEUIL_DENSITE        // Biomasse kg/m3 du bac depasse conditionValeur
  SEUIL_RENOUVELLEMENT // Taux de renouvellement %/jour du bac sur la fenetre configuree
  ABSENCE_RELEVE       // Jours depuis le dernier releve d'un type donne (conditionValeur = jours)
}
```

**Semantique de ABSENCE_RELEVE :** Le type de releve vise est encode via une convention : la `ConditionRegle.conditionValeur2` encode le TypeReleve comme un entier (index de l'enum). Alternativement, on ajoute un champ `typeReleveVise TypeReleve?` a `ConditionRegle` — decision a confirmer lors de l'implementation.

### 5.7 Champs a ajouter sur `ConfigElevage`

Les seuils actuels dans ConfigElevage (`densiteMaxPoissonsM3`, `densiteOptimalePoissonsM3`) sont generiques. Il faut des seuils differencies par type de systeme pour le composant UI `bac-densite-badge.tsx`.

```prisma
model ConfigElevage {
  // ... champs existants ...

  // Seuils de densite par type de systeme (kg/m3) — utilises par le UI badge
  // Bac beton / plastique
  densiteBacBetonAlerte   Float @default(150)
  densiteBacBetonCritique Float @default(200)

  // Etang en terre
  densiteEtangAlerte      Float @default(30)
  densiteEtangCritique    Float @default(40)

  // RAS
  densiteRasAlerte        Float @default(350)
  densiteRasCritique      Float @default(500)

  // Fenetre temporelle pour le calcul du taux de renouvellement effectif (jours)
  // Utilise par le context builder — configurable par site
  fenetreRenouvellementJours Int @default(7)
}
```

**Ce qui n'est PLUS dans ConfigElevage (par rapport a la version precedente de cet ADR) :**
- `renouvellementMinimum` — cette valeur vit maintenant dans les `conditionValeur` des regles seedees
- `renouvellementCritique` — idem
- `delaiSansQualiteEauJours` — encode dans la conditionValeur de la regle ABSENCE_RELEVE

**Pourquoi `fenetreRenouvellementJours` reste dans ConfigElevage ?** Le context builder a besoin de savoir sur combien de jours calculer le taux moyen de renouvellement avant d'appeler l'evaluateur. C'est un parametre metier configurable par site. Une ferme avec des bacs tres actifs peut vouloir evaluer sur 3 jours ; une ferme extensive peut evaluer sur 14 jours. Le defaut de 7 jours couvre la plupart des cas.

**Pourquoi les seuils de densite par type restent dans ConfigElevage ?** Ils sont utiles pour le composant `bac-densite-badge.tsx` qui colore le badge vert/orange/rouge selon le type de systeme. Sans ces seuils dans ConfigElevage, le composant ne saurait pas a partir de quelle valeur afficher orange vs rouge pour un bac en RAS vs bac beton. Les regles seedees encodent les memes seuils dans leurs conditions, mais le UI badge ne lit pas les regles.

### 5.8 Nouveaux `TypeAlerte` a ajouter a l'enum existant

```prisma
enum TypeAlerte {
  // ... valeurs existantes ...
  DENSITE_ELEVEE                  // Biomasse kg/m3 depasse le seuil pour ce type de systeme
  RENOUVELLEMENT_EAU_INSUFFISANT  // Taux de renouvellement effectif insuffisant pour la densite actuelle
  AUCUN_RELEVE_QUALITE_EAU        // Aucun releve qualite eau depuis N jours a densite elevee
  DENSITE_CRITIQUE_QUALITE_EAU    // Combinaison : densite elevee + qualite eau degradee simultanement
}
```

### 5.9 Nouveau champ sur `Notification` pour le lien d'action

Le champ `lien` existe mais est une URL libre. On ajoute un champ structure pour l'action recommandee :

```prisma
model Notification {
  // ... champs existants ...

  // Action directe recommandee (null si notification informative seulement)
  // Format : JSON { type: "CREER_RELEVE", typeReleve?: TypeReleve, bacId?: string, vagueId?: string }
  //          ou { type: "MODIFIER_BAC", bacId: string }
  //          ou { type: "VOIR_VAGUE", vagueId: string }
  actionPayload  Json?

  // Severite de l'alerte pour le tri visuel
  severite  SeveriteAlerte @default(INFO)
}

enum SeveriteAlerte {
  INFO
  AVERTISSEMENT
  CRITIQUE
}
```

**Justification :** Stocker l'action comme JSON structure (plutot que URL libre) permet au composant mobile d'afficher un bouton CTA avec texte traduit et de construire l'URL dynamiquement. Si le schema evolue, le payload evolue sans changer la table.

### 5.10 Resume des migrations requises

| Migration | Contenu | Impact |
|-----------|---------|--------|
| `add_type_systeme_bac` | Enum `TypeSystemeBac` + champ `typeSysteme` sur Bac | Non-breaking, nouveaux champs nullable |
| `add_renouvellement_releve` | Enum TypeReleve recreer avec RENOUVELLEMENT + champs `pourcentageRenouvellement` et `volumeRenouvele` sur Releve | Recreate pattern pour TypeReleve |
| `add_density_thresholds_config_elevage` | 6 champs Float + `fenetreRenouvellementJours` sur ConfigElevage + 2 champs sur Notification (actionPayload, severite) | Non-breaking, valeurs par defaut fournies |
| `add_alert_enums` | 4 nouvelles valeurs dans TypeAlerte + 3 dans TypeDeclencheur + SeveriteAlerte + OperateurCondition + LogiqueCondition | Recreate pattern (voir MEMORY.md) |
| `add_condition_regle` | Nouveau modele ConditionRegle + champs logique sur RegleActivite | Non-breaking, relation optionnelle |

**Ordre d'execution :** `add_type_systeme_bac` → `add_renouvellement_releve` → `add_density_thresholds_config_elevage` → `add_alert_enums` → `add_condition_regle`

---

## 6. Extension du moteur RegleActivite — Conditions composees

### 6.1 Decision architecturale : un seul moteur, pas deux systemes

La revision centrale de cet ADR est d'abandonner le `density-alert-service.ts` independant (systeme parallele) au profit d'une extension minimale du moteur `RegleActivite` existant.

**Avantages de cette approche :**
- Un seul moteur a maintenir, tester, et comprendre
- Les regles de densite sont configurables et desactivables comme n'importe quelle regle
- Les admins peuvent ajuster les seuils via l'UI de gestion des regles existante
- Pas de code supplementaire pour l'idempotence, le cooldown, le deduplication — le moteur les gere deja
- Pas de confusion pour l'equipe sur "quelle alerte vient de quel systeme"

### 6.2 Logique d'evaluation etendue dans `evaluator.ts`

L'evaluateur actuel utilise un `switch` sur `typeDeclencheur`. L'extension est minimale :

```typescript
// Dans evaluateRules() — apres le switch existant :

if (rule.conditions.length > 0) {
  // Evaluation par conditions composees
  const results = rule.conditions
    .sort((a, b) => a.ordre - b.ordre)
    .map(c => evalCondition(c, ctx));

  triggered = rule.logique === "ET"
    ? results.every(Boolean)
    : results.some(Boolean);
} else {
  // Evaluation legacy (backward compatible)
  switch (regle.typeDeclencheur as TypeDeclencheur) {
    // ... switch existant inchange ...
  }
}
```

**La fonction `evalCondition(c, ctx)`** evalue une `ConditionRegle` contre le contexte :

```typescript
function evalCondition(
  cond: ConditionRegle,
  ctx: RuleEvaluationContext
): boolean {
  const val = getContextValue(cond.typeDeclencheur, ctx);
  if (val === null) return false; // donnee indisponible → ne pas matcher

  switch (cond.operateur) {
    case "SUPERIEUR":  return val > (cond.conditionValeur ?? 0);
    case "INFERIEUR":  return val < (cond.conditionValeur ?? 0);
    case "ENTRE":      return val >= (cond.conditionValeur ?? 0)
                           && val <= (cond.conditionValeur2 ?? Infinity);
    case "EGAL":       return val === cond.conditionValeur;
  }
}

function getContextValue(
  type: TypeDeclencheur,
  ctx: RuleEvaluationContext
): number | null {
  switch (type) {
    case TypeDeclencheur.SEUIL_DENSITE:
      return ctx.densiteKgM3 ?? null;
    case TypeDeclencheur.SEUIL_RENOUVELLEMENT:
      return ctx.tauxRenouvellementPctJour ?? null;
    case TypeDeclencheur.ABSENCE_RELEVE:
      return ctx.joursDepuisDernierReleveQualiteEau ?? null;
    case TypeDeclencheur.SEUIL_QUALITE:
      // Reutilise la logique evalSeuilQualite existante
      return evalSeuilQualiteAsNumber(ctx);
    // ... autres types existants ...
  }
}
```

### 6.3 Nouveaux champs dans `RuleEvaluationContext`

Le context builder `src/lib/activity-engine/context.ts` doit fournir trois nouvelles donnees au niveau `bac` :

```typescript
export interface RuleEvaluationContext {
  // ... tous les champs existants ...

  // Nouveaux champs pour les conditions composees de densite
  /** Biomasse / volume du bac en kg/m3. null si bac.volume non renseigne. */
  densiteKgM3: number | null;
  /** Taux de renouvellement moyen %/jour sur la fenetre configuree (fenetreRenouvellementJours).
   *  null si aucun releve RENOUVELLEMENT dans la fenetre ou si bac.volume inconnu. */
  tauxRenouvellementPctJour: number | null;
  /** Jours depuis le dernier releve QUALITE_EAU pour ce bac.
   *  null si aucun releve QUALITE_EAU existe pour ce bac. */
  joursDepuisDernierReleveQualiteEau: number | null;
}
```

**Calcul de `densiteKgM3` dans `buildEvaluationContext()` :**

IMPORTANT : `indicateurs.biomasse` dans le contexte est calcule depuis `relevesForCalc` (filtre par `bac.id` si `bac != null`). Cela couvre les mortalites et comptages per-bac correctement. Cependant, quand `bac != null`, la biomasse effective pour CE bac doit imperativement utiliser :
1. `computeVivantsByBac()` applique sur TOUS les releves de la vague (pas juste ceux du bac) — pour que le calcul des vivants prenne en compte la repartition initiale correcte
2. La derniere biometrie de CE bac (`bacId == bac.id`), avec fallback sur la derniere biometrie globale si aucune biometrie per-bac n'existe

Le calcul existant de `indicateurs.biomasse` dans `context.ts` (ligne ~148) utilise `nombreVivants` et `poidsMoyen` calcules depuis `relevesForCalc` (filtre par bac). Ce calcul des vivants est approximatif : il soustrait les mortalites du bac de `bac.nombreInitial`, ce qui ignore la repartition des vivants inter-bacs donnee par `computeVivantsByBac()`. Ce probleme pre-existant dans `context.ts` sera corrige par la meme tache Phase A (point 5 ci-dessous).

**Algorithme correct pour `densiteKgM3` :**
```
si bac != null et bac.volume != null et bac.volume > 0 :
  // Utiliser computeVivantsByBac() avec TOUS les releves de la vague
  vivantsByBac = computeVivantsByBac(tousLesBacs, tousLesReleves, vague.nombreInitial)
  vivantsBac   = vivantsByBac.get(bac.id) ?? 0

  // Biometrie de CE bac (filtree par bacId)
  biometriesBac = tousLesReleves filtre par bacId == bac.id ET typeReleve == BIOMETRIE
  poidsMoyenBac = biometriesBac.at(-1)?.poidsMoyen ?? null
  // Fallback global si aucune biometrie per-bac
  si poidsMoyenBac == null :
    biometriesGlobales = tousLesReleves filtre par typeReleve == BIOMETRIE
    poidsMoyenBac = biometriesGlobales.at(-1)?.poidsMoyen ?? null

  si poidsMoyenBac != null :
    biomasseBac = poidsMoyenBac * vivantsBac / 1000
    densiteKgM3 = biomasseBac / (bac.volume / 1000)
  sinon :
    densiteKgM3 = null
sinon :
  densiteKgM3 = null
```

**Consequence sur la signature de `buildEvaluationContext()` :** Pour utiliser `computeVivantsByBac()` correctement, le context builder doit recevoir tous les bacs de la vague en plus des releves. Cela implique d'ajouter un parametre `bacs: BacCtx[]` a la fonction `buildEvaluationContext()`. Voir la tache Phase A point 5.

**Note sur `indicateurs.biomasse` existant dans le contexte :** La valeur `indicateurs.biomasse` calculee plus haut dans le context builder (qui utilise `nombreVivants` local) reste utilisee pour les regles legacy (FCR, survie). Seul `densiteKgM3` utilise le calcul per-bac rigoureux via `computeVivantsByBac()`.

**Calcul de `tauxRenouvellementPctJour` :**
```
si bac != null :
  relevesRenouv = filtrer releves par bacId et typeReleve = RENOUVELLEMENT
                  sur les fenetreRenouvellementJours derniers jours
  tauxRenouvellementPctJour = computeTauxRenouvellement(relevesRenouv, bac.volume, fenetreJours)
sinon :
  tauxRenouvellementPctJour = null
```

**Calcul de `joursDepuisDernierReleveQualiteEau` :**
```
si bac != null :
  dernierQE = dernier releve avec typeReleve = QUALITE_EAU pour ce bacId
  si dernierQE != null :
    joursDepuisDernierReleveQualiteEau = joursSince(dernierQE.date)
  sinon :
    joursDepuisDernierReleveQualiteEau = null  (aucun releve QE historique)
sinon :
  joursDepuisDernierReleveQualiteEau = null
```

### 6.4 Regles seedees globales — firedOnce et conditions SEUIL_*

Pour les regles basees sur SEUIL_DENSITE, le flag `firedOnce` du moteur existant (EC-3.2) ne s'applique pas — la densite fluctue et on veut re-evaluer a chaque releve. Ces regles doivent donc avoir `firedOnce = false`. Les regles avec `conditions.length > 0` sont des regles a conditions composees ; le moteur applique le cooldown par defaut (deduplication meme jour, EC-3.1) pour eviter le spam.

### 6.5 Regles seedees globales pour la gestion de la densite

Ces regles sont inserees en seed SQL avec `siteId = null` (regles globales DKFarm). Tous les sites les recoivent automatiquement. Les admins peuvent les desactiver ou creer des overrides site-specifiques.

**Notation des regles :**
- C1, C2... = ConditionRegle dans l'ordre d'evaluation
- `>` = operateur SUPERIEUR, `<` = operateur INFERIEUR, `ENTRE(a,b)` = operateur ENTRE

---

**Regle R1 : "Densite elevee + renouvellement insuffisant (50-100 kg/m3)"**
```
logique: ET
C1: SEUIL_DENSITE, SUPERIEUR, 50
C2: SEUIL_RENOUVELLEMENT, INFERIEUR, 50
→ priorite: 5, typeActivite: QUALITE_EAU
→ titreTemplate: "Renouvellement insuffisant — Bac {{bac}}"
→ Correspond a la case ALERTE/BON de la matrice : densite elevee mais eau non mesuree
```

**Regle R2 : "Densite haute + renouvellement insuffisant (100-200 kg/m3)"**
```
logique: ET
C1: SEUIL_DENSITE, SUPERIEUR, 100
C2: SEUIL_RENOUVELLEMENT, INFERIEUR, 75
→ priorite: 3, typeActivite: QUALITE_EAU
→ titreTemplate: "Renouvellement critique — Bac {{bac}} (densite {{valeur}} kg/m3)"
```

**Regle R3 : "Densite critique + renouvellement insuffisant (>200 kg/m3)"**
```
logique: ET
C1: SEUIL_DENSITE, SUPERIEUR, 200
C2: SEUIL_RENOUVELLEMENT, INFERIEUR, 100
→ priorite: 1, typeActivite: QUALITE_EAU
→ titreTemplate: "URGENT — Eau stagnante — Bac {{bac}}"
```

**Regle R4 : "Densite elevee + absence releve qualite eau (> 3 jours)"**
```
logique: ET
C1: SEUIL_DENSITE, SUPERIEUR, 100
C2: ABSENCE_RELEVE (qualite eau), SUPERIEUR, 3
→ priorite: 2, typeActivite: QUALITE_EAU
→ titreTemplate: "Qualite eau non verifiee — Bac {{bac}}"
→ Correspond a la case ALERTE/INCONNU de la matrice
```

**Regle R5 : "Probleme qualite eau (n'importe quel parametre critique)"**
```
logique: OU
C1: SEUIL_QUALITE (ammoniac), SUPERIEUR, 1.0
C2: SEUIL_QUALITE (oxygene), INFERIEUR, 4.0
→ priorite: 1, typeActivite: QUALITE_EAU
→ titreTemplate: "Parametre critique — Bac {{bac}}"
→ Correspond aux cases */CRITIQUE de la matrice
```

**Regle R6 : "Densite critique + qualite eau degradee (ammoniac)"**
```
logique: ET
C1: SEUIL_DENSITE, SUPERIEUR, 200
C2: SEUIL_QUALITE (ammoniac), SUPERIEUR, 0.05
→ priorite: 1, typeActivite: RENOUVELLEMENT
→ titreTemplate: "URGENT — Densite + NH3 — Bac {{bac}}"
→ Correspond a la case CRITIQUE/DEGRADE ou CRITIQUE/CRITIQUE de la matrice
```

**Regles legacy conservees :**
- "Survie basse" (SEUIL_MORTALITE > 20%) → COMPTAGE, priorite 4
- "FCR eleve" (FCR_ELEVE > 2.5) → OBSERVATION, priorite 6

**Note sur ABSENCE_RELEVE et le type de releve vise :** Pour R4, la condition C2 a besoin de savoir qu'il s'agit du type QUALITE_EAU. Cela sera encode soit via `ConditionRegle.conditionValeur2` (index enum), soit via un champ supplementaire `typeReleveVise TypeReleve?` sur `ConditionRegle`. La decision finale appartient a @db-specialist lors de l'implementation.

### 6.6 Idempotence et anti-spam

Le moteur existant gere deja la deduplication meme-jour (EC-3.1) et le cooldown via `getLastFired`. Les regles de densite ayant `firedOnce = false`, elles utilisent uniquement EC-3.1. En pratique : si un releve est cree deux fois le meme jour, l'alerte n'est pas dupliquee.

### 6.7 Qui recoit les alertes

Les Activites generees par le moteur de regles etendu sont visibles dans le planning du site. Les Notifications de densite (DENSITE_ELEVEE etc.) sont creees pour tous les membres ayant la permission `ALERTES_VOIR`. En pratique : ADMIN et GERANT. Le PISCICULTEUR recoit uniquement les rappels de releves (via le planning existant).

---

## 7. Systeme d'actions recommandees

### 7.1 Structure de l'ActionPayload

```typescript
// src/types/notifications.ts (nouveau fichier)

export type NotificationActionPayload =
  | CreateReleveAction
  | ModifyBacAction
  | ViewVagueAction
  | ViewStockAction;

export interface CreateReleveAction {
  type: "CREER_RELEVE";
  typeReleve: TypeReleve;   // pre-selectionne dans le formulaire
  bacId: string;
  vagueId: string;
  // URL construite par le composant : /vagues/[vagueId]/releves/new?bacId=...&type=...
}

export interface ModifyBacAction {
  type: "MODIFIER_BAC";
  bacId: string;
  champsAModifier: ("typeSysteme" | "volume")[];
  // NOTE : "tauxRenouvellement" supprime de cette liste
  // URL construite : /bacs/[bacId]/edit
}

export interface ViewVagueAction {
  type: "VOIR_VAGUE";
  vagueId: string;
  // URL construite : /vagues/[vagueId]
}

export interface ViewStockAction {
  type: "VOIR_STOCK";
  produitId?: string;
  // URL construite : /stock ou /stock?produit=[produitId]
}
```

### 7.2 Textes des actions par type d'alerte

| TypeAlerte | Severite | Titre | Message | Action CTA |
|-----------|---------|-------|---------|-----------|
| DENSITE_ELEVEE | AVERTISSEMENT | "Densite elevee — Bac [nom]" | "La biomasse atteint [X] kg/m3 (seuil: [Y] kg/m3). Surveiller la qualite de l'eau." | "Faire un releve qualite eau" → CREER_RELEVE(QUALITE_EAU) |
| DENSITE_ELEVEE | CRITIQUE | "Densite critique — Bac [nom]" | "La biomasse depasse [X] kg/m3. Risque serieux de qualite d'eau. Agir maintenant." | "Faire un releve qualite eau" → CREER_RELEVE(QUALITE_EAU) |
| DENSITE_CRITIQUE_QUALITE_EAU | CRITIQUE | "URGENT — Densite + Eau — Bac [nom]" | "Biomasse a [X] kg/m3 ET qualite eau degradee ([parametre]: [valeur]). Renouveler l'eau immediatement." | "Enregistrer un renouvellement" → CREER_RELEVE(RENOUVELLEMENT) |
| RENOUVELLEMENT_EAU_INSUFFISANT | AVERTISSEMENT | "Renouvellement insuffisant — Bac [nom]" | "Seulement [X]%/jour de renouvellement en moyenne (7 jours) pour une densite de [Y] kg/m3. Augmenter a au moins [Z]%." | "Enregistrer un renouvellement" → CREER_RELEVE(RENOUVELLEMENT) |
| RENOUVELLEMENT_EAU_INSUFFISANT | CRITIQUE | "Eau stagnante — Bac [nom] — URGENT" | "Renouvellement de [X]%/jour insuffisant. Risque d'accumulation d'ammoniac a cette densite." | "Enregistrer un renouvellement" → CREER_RELEVE(RENOUVELLEMENT) |
| AUCUN_RELEVE_QUALITE_EAU | AVERTISSEMENT | "Qualite eau non verifiee — Bac [nom]" | "Aucune mesure qualite eau depuis [X] jours avec une densite elevee. Faire un releve maintenant." | "Faire un releve qualite eau" → CREER_RELEVE(QUALITE_EAU) |
| QUALITE_EAU | CRITIQUE | "Parametre critique — Bac [nom]" | "Oxygene dissous a [X] mg/L (seuil: 4 mg/L). Action immediate requise." | "Nouveau releve eau" → CREER_RELEVE(QUALITE_EAU) |
| MORTALITE_ELEVEE | CRITIQUE | "Mortalite elevee — [vague]" | "Taux de mortalite quotidien : [X]%. Investigation requise." | "Enregistrer une mortalite" → CREER_RELEVE(MORTALITE) |
| RAPPEL_ALIMENTATION | INFO | "Pas d'alimentation enregistree aujourd'hui" | "Aucun releve d'alimentation pour [vague] aujourd'hui." | "Enregistrer l'alimentation" → CREER_RELEVE(ALIMENTATION) |
| RAPPEL_BIOMETRIE | INFO | "Biometrie due — [vague]" | "Derniere biometrie il y a [X] jours. Echeance selon config : [Y] jours." | "Faire une biometrie" → CREER_RELEVE(BIOMETRIE) |

**Note sur RENOUVELLEMENT_EAU_INSUFFISANT :** L'action CTA pointe vers la creation d'un releve RENOUVELLEMENT (et non vers "Modifier le bac"). La solution a un renouvellement insuffisant est de faire un renouvellement et de l'enregistrer, pas de modifier les parametres du bac.

### 7.3 Pas d'escalade en V1

Un systeme d'escalade (si non traite dans X heures, notifier le manager) n'est pas implemente en V1. Les raisons :
- Pas d'infrastructure de notification push (SMS, WhatsApp) en place
- Les pisciculteurs consultent l'app de facon discontinue
- L'escalade necessiterait une gestion de garde/responsables non prevue dans le schema

L'escalade peut etre ajoutee en V2 avec un champ `escaladeApresHeures` sur Notification et un cron job.

---

## 8. API routes necessaires

### 8.1 Modification des routes existantes

| Route | Modification |
|-------|-------------|
| `PATCH /api/bacs/[id]` | Accepter `typeSysteme` dans le body (supprimer `tauxRenouvellement` — ce n'est plus un champ Bac) |
| `POST /api/releves` | Accepter `pourcentageRenouvellement` et `volumeRenouvele` si typeReleve = RENOUVELLEMENT ; apres creation d'un releve BIOMETRIE, MORTALITE ou QUALITE_EAU, appeler le moteur de regles etendu |
| `GET /api/notifications` | Ajouter filtre `severite` et retourner `actionPayload` |

### 8.2 Nouvelles routes

```
GET  /api/bacs/[id]/densite
  Calcule et retourne la densite actuelle du bac + statut + snapshot renouvellement + snapshot qualite eau
  Response: {
    densiteKgM3: number | null,
    statut: "OK" | "ALERTE" | "CRITIQUE",
    typeSysteme: TypeSystemeBac | null,
    tauxRenouvellementPctJour: number | null,
    joursDepuisDernierReleveQualiteEau: number | null
  }

GET  /api/vagues/[id]/densites
  Retourne la densite de tous les bacs de la vague
  Response: DensiteParBac[]
  Utilisee par le dashboard vague et les alertes

GET  /api/bacs/[id]/renouvellements
  Retourne l'historique des releves RENOUVELLEMENT d'un bac
  Query params: ?jours=30 (default)
  Response: { releves: ReleveRenouvellement[], tauxMoyenPctJour: number | null }

POST /api/alertes/detecter
  Declenche manuellement une evaluation des regles pour une vague (utile pour les tests et le futur cron)
  Body: { vagueId: string }
  Response: { activitesCreees: number }
  Permission: ALERTES_CONFIGURER

PATCH /api/notifications/[id]/traiter
  Marque une notification comme TRAITEE + enregistre optionnellement l'action prise
  Body: { actionPrise?: string }
  (distinct de PATCH statut=LUE qui existe deja)
```

### 8.3 Extension de la route ConfigElevage

```
PATCH /api/config-elevage/[id]
  Deja existante, doit accepter les 6 nouveaux champs de seuils de densite
  et fenetreRenouvellementJours
  Pas de nouvelle route necessaire
```

### 8.4 API de gestion des ConditionRegle

```
POST /api/regles-activite/[id]/conditions
  Creer une ConditionRegle pour une regle existante
  Body: { typeDeclencheur, operateur, conditionValeur?, conditionValeur2?, ordre? }
  Permission: GERER_REGLES_ACTIVITES

DELETE /api/regles-activite/[id]/conditions/[conditionId]
  Supprimer une ConditionRegle
  Permission: GERER_REGLES_ACTIVITES

PATCH /api/regles-activite/[id]
  Deja existante — ajouter le champ logique (ET | OU) au body accepte
```

---

## 9. Composants UI

### 9.1 Arbre des composants (mobile first, 360px)

```
src/components/
├── alertes/
│   ├── notification-bell.tsx          (existant, a mettre a jour)
│   ├── notification-list.tsx          (existant, a mettre a jour avec actionPayload)
│   ├── notification-card.tsx          (NOUVEAU — carte mobile pour 1 notification)
│   │   ├── SeveriteIcon              (icone coloree selon severite)
│   │   ├── Titre + Message           (texte)
│   │   └── ActionButton              (bouton CTA → navigue vers l'action)
│   └── mark-all-read-button.tsx       (existant)
│
├── bacs/
│   ├── bac-form.tsx                   (existant, a etendre)
│   │   └── SelectTypeSysteme         (Radix Select — NOUVEAU)
│   │   // NOTE : InputTauxRenouvellement SUPPRIME
│   ├── bac-densite-badge.tsx          (NOUVEAU — badge vert/orange/rouge)
│   └── bac-densite-detail.tsx         (NOUVEAU — detail calcul densite pour un bac)
│
├── releves/
│   └── releve-form-client.tsx         (existant, a etendre)
│       └── RenouvellementFields       (NOUVEAU — champs specifiques type RENOUVELLEMENT)
│           ├── InputPourcentageRenouvellement   (0-100%, avec calcul auto du volume)
│           ├── InputVolumeRenouvele             (litres, avec calcul auto du %)
│           └── RenouvellementHelperText         (texte contextuel selon bac.volume)
│
├── vagues/
│   └── vague-densites-summary.tsx     (NOUVEAU — resume densites tous bacs de la vague)
│       └── BacDensiteRow[]            (ligne par bac : nom + densite + badge statut)
│
└── dashboard/
    └── alertes-widget.tsx             (NOUVEAU — widget dashboard top 3 alertes actives)
        └── NotificationCard (reutilise)
```

### 9.2 Composant `notification-card.tsx`

Mobile first. La carte occupe toute la largeur de l'ecran (pas de tableau). Structure :

```
┌─────────────────────────────────────────┐
│ [icone rouge]  DENSITE CRITIQUE          │
│                                          │
│  Bac 3 — Vague 2024-001                 │
│  Biomasse a 185 kg/m3                   │
│  (seuil bac beton : 150 kg/m3)          │
│                                          │
│  [FAIRE UN RELEVE QUALITE EAU]  [Ignorer]│
└─────────────────────────────────────────┘
```

Pour une alerte DENSITE_CRITIQUE_QUALITE_EAU :
```
┌─────────────────────────────────────────┐
│ [icone rouge]  URGENT — DENSITE + EAU   │
│                                          │
│  Bac 3 — Vague 2024-001                 │
│  Biomasse a 185 kg/m3 + NH3: 1.2 mg/L  │
│  Renouveler l'eau immediatement         │
│                                          │
│  [ENREGISTRER UN RENOUVELLEMENT] [Ignorer]│
└─────────────────────────────────────────┘
```

- `SeveriteAlerte.CRITIQUE` → fond rouge pale, icone AlertTriangle
- `SeveriteAlerte.AVERTISSEMENT` → fond orange pale, icone AlertCircle
- `SeveriteAlerte.INFO` → fond bleu pale, icone Info
- Bouton CTA : pleine largeur sur mobile (min-h: 44px), couleur primaire
- "Ignorer" : texte button discret, marque la notification LUE

### 9.3 Composant `bac-densite-badge.tsx`

Badge compact pour afficher dans les listes de bacs. Utilise les seuils de ConfigElevage (selon typeSysteme du bac) :

```
[● 142 kg/m3]  — orange si > densiteBacBetonAlerte
[● 85 kg/m3]   — vert si < densiteBacBetonAlerte
[● ---]        — gris si volume non renseigne
```

Utilise `var(--primary)`, `var(--destructive)`, et classes Tailwind avec `text-amber-600`.

### 9.4 Composant `bac-form.tsx` — extensions

Un nouveau champ dans le formulaire de bac :

**TypeSysteme :** Radix Select avec 4 options, icone descriptive pour chaque type, texte d'aide sous le select expliquant les seuils de densite applicables.

**Suppression de InputTauxRenouvellement :** Le champ taux de renouvellement est supprime du formulaire de bac. Le renouvellement se saisit desormais via des releves de type RENOUVELLEMENT. Un lien informatif peut etre affiche : "Pour suivre le renouvellement d'eau, creez des releves de type Renouvellement."

### 9.5 Champs du formulaire de releve pour RENOUVELLEMENT

Dans `releve-form-client.tsx`, quand `typeReleve == RENOUVELLEMENT`, afficher :

```
┌─────────────────────────────────────────┐
│  Renouvellement d'eau                   │
│                                          │
│  Pourcentage du volume renouvelee        │
│  [    50    ] %                          │
│                                          │
│  OU volume en litres                     │
│  [   600    ] L   (= 50% de 1 200 L)   │
│                                          │
│  (Les deux valeurs se calculent auto)   │
│                                          │
│  Notes (optionnel)                       │
│  [ Ex: eau boueuse, changement urgent ] │
└─────────────────────────────────────────┘
```

**Comportement des champs lies :**
- Si bac.volume est connu : les deux champs sont affiches et lies
  - Modifier le % → calcule et remplit les litres
  - Modifier les litres → calcule et remplit le %
- Si bac.volume est null : seul le champ litres est affiche (pas de conversion possible)
- Les deux valeurs sont sauvegardees si disponibles

**Validation :**
- Au moins un des deux champs est requis
- Pourcentage : 0 < valeur <= 100
- Volume : valeur > 0, valeur <= bac.volume si connu (avertissement si depassement, pas un blocage)

### 9.6 Historique des renouvellements dans la page bac/vague

Un accordeon ou onglet "Renouvellements" dans la page detail bac/vague affiche :
- Le taux moyen sur les 7 derniers jours (barre coloree vert/orange/rouge)
- La liste des derniers releves RENOUVELLEMENT (date, %, litres)
- Un bouton "Enregistrer un renouvellement" → formulaire releve pre-rempli avec typeReleve=RENOUVELLEMENT

### 9.7 Composant `alertes-widget.tsx` dans le dashboard

Widget compact (sous les indicateurs principaux) :
- Titre : "Alertes actives" + badge compteur rouge
- Liste des 3 alertes les plus recentes et non traitees, triees par severite
- Les alertes DENSITE_CRITIQUE_QUALITE_EAU apparaissent en premier (deux indicateurs critiques simultanes)
- Lien "Voir toutes les alertes" → page `/alertes`
- Si aucune alerte : message "Aucune alerte active" + icone verte

---

## 10. Integration avec les systemes existants

### 10.1 Avec le systeme de releves

Apres chaque `POST /api/releves` :
- Type BIOMETRIE ou MORTALITE :
  1. Reconstruire le `RuleEvaluationContext` pour le bac concerne (avec les nouvelles donnees densite, renouvellement, absence QE)
  2. Appeler `evaluateRules()` avec les regles actives du site + regles globales
  3. Pour chaque RuleMatch produit, creer une Activite ou Notification selon le typeAlerte
  4. Respecter la deduplication meme-jour (EC-3.1)
- Type QUALITE_EAU :
  1. Meme flux — le nouveau releve met a jour `joursDepuisDernierReleveQualiteEau` a 0
  2. Le moteur peut ainsi lever ou re-evaluer les alertes d'absence de releve qualite eau
- Type RENOUVELLEMENT :
  1. Reconstruire le contexte — `tauxRenouvellementPctJour` est mis a jour
  2. Le moteur re-evalue les regles R1-R3 — si le taux est maintenant suffisant, la regle ne se declenche plus

Ce flow est synchrone dans la meme transaction pour la V1. Acceptable car le calcul est leger.

### 10.2 Avec ConfigElevage

Le context builder lit `fenetreRenouvellementJours` depuis ConfigElevage pour determiner la fenetre de calcul du taux de renouvellement. Si aucun ConfigElevage n'existe pour le site, la valeur par defaut de 7 jours est utilisee (hardcodee dans le context builder).

### 10.3 Avec le moteur RegleActivite (Sprint 21)

L'extension est backward compatible :
- Toutes les regles existantes continuent de fonctionner sans aucune modification (`conditions.length == 0` → evaluation legacy)
- Les nouvelles regles de densite utilisent `conditions` et les nouveaux TypeDeclencheur
- Le moteur `evaluateRules()` est etendu, non remplace
- L'UI de gestion des regles (Sprint 21) peut afficher et editer les ConditionRegle avec un builder visuel (hors scope de cet ADR, ajoutable en Phase C)

### 10.4 Avec le dashboard

Le dashboard principal recoit un nouveau widget `AlertesWidget` place en haut de page (avant les indicateurs de vague) quand il y a des alertes CRITIQUE ou AVERTISSEMENT actives. Sur mobile, ce widget apparait en premier car c'est l'information la plus urgente.

### 10.5 Avec le module ANALYSE_PILOTAGE

La page d'analyse (graphiques) peut afficher :
- Les densites historiques par bac comme nouvelle serie dans les graphiques Recharts existants
- Les evenements de renouvellement comme marqueurs verticaux sur le graphique qualite eau (pour corroborer l'effet du renouvellement sur les parametres)

Ceci est hors scope de ce ADR mais le modele de donnees le permet desormais.

---

## 11. Strategie de migration

### 11.1 Backward compatibility

- `typeSysteme` est nullable sur Bac → pas de breaking change pour les bacs existants
- Les nouveaux seuils dans ConfigElevage ont des valeurs `@default` appropriees → pas de breaking change pour les configs existantes
- Les nouvelles valeurs d'enum utilisent le pattern RECREATE (voir MEMORY.md) car PostgreSQL ne permet pas de DROP VALUES d'enum
- Les champs `pourcentageRenouvellement` et `volumeRenouvele` sont nullable sur Releve → pas de breaking change pour les releves existants
- `TypeReleve.RENOUVELLEMENT` est une nouvelle valeur → les releves existants ne sont pas affectes
- `ConditionRegle` est une relation optionnelle sur `RegleActivite` → toutes les regles existantes fonctionnent sans modification
- Les champs `conditions` et `logique` sur `RegleActivite` n'impactent l'evaluation que si `conditions.length > 0`

### 11.2 Seed des regles globales par defaut

Ajouter dans `prisma/seed.sql` les 6 regles globales DKFarm (`siteId = null`) avec leurs `ConditionRegle` :

```sql
-- Regle R1 : Densite elevee + renouvellement insuffisant (50-100 kg/m3)
INSERT INTO "RegleActivite" (id, nom, typeActivite, typeDeclencheur, logique, priorite, ...)
VALUES ('rule-densite-renouv-50', 'Densite elevee + renouv insuffisant', 'QUALITE_EAU', 'SEUIL_DENSITE', 'ET', 5, ...);

INSERT INTO "ConditionRegle" (id, regleId, typeDeclencheur, operateur, conditionValeur, ordre)
VALUES ('cond-r1-c1', 'rule-densite-renouv-50', 'SEUIL_DENSITE', 'SUPERIEUR', 50, 0),
       ('cond-r1-c2', 'rule-densite-renouv-50', 'SEUIL_RENOUVELLEMENT', 'INFERIEUR', 50, 1);

-- Regle R4 : Densite elevee + absence releve qualite eau
INSERT INTO "RegleActivite" (id, nom, typeActivite, typeDeclencheur, logique, priorite, ...)
VALUES ('rule-densite-abs-qe', 'Densite elevee + absence QE', 'QUALITE_EAU', 'SEUIL_DENSITE', 'ET', 2, ...);

INSERT INTO "ConditionRegle" (id, regleId, typeDeclencheur, operateur, conditionValeur, ordre)
VALUES ('cond-r4-c1', 'rule-densite-abs-qe', 'SEUIL_DENSITE', 'SUPERIEUR', 100, 0),
       ('cond-r4-c2', 'rule-densite-abs-qe', 'ABSENCE_RELEVE', 'SUPERIEUR', 3, 1);

-- ... (regles R2, R3, R5, R6 similaires)
```

### 11.3 Migration des bacs existants

Pas de migration automatique du `typeSysteme` — l'utilisateur renseigne le type lors de la prochaine modification du bac. Un bandeau d'information peut etre affiche sur la page des bacs : "Renseignez le type de systeme de vos bacs pour activer les alertes de densite."

Les bacs sans releve RENOUVELLEMENT auront `tauxRenouvellementPctJour = null` dans le contexte — le moteur ne declenche pas les regles R1-R3 dans ce cas (condition non remplie car valeur null = non matchee). Un rappel informatif peut inviter l'utilisateur a commencer a enregistrer les renouvellements.

### 11.4 Ordre des migrations

```
Migration 1 : add_type_systeme_bac
  - CREATE TYPE "TypeSystemeBac" AS ENUM (...)
  - ALTER TABLE "Bac" ADD COLUMN "typeSysteme" "TypeSystemeBac"
  NOTE : pas de colonne tauxRenouvellement sur Bac

Migration 2 : add_renouvellement_releve
  - Recreer TypeReleve avec RENOUVELLEMENT (pattern RECREATE)
  - ALTER TABLE "Releve" ADD COLUMN "pourcentageRenouvellement" FLOAT
  - ALTER TABLE "Releve" ADD COLUMN "volumeRenouvele" FLOAT

Migration 3 : add_density_thresholds_config_elevage
  - ALTER TABLE "ConfigElevage" ADD COLUMN "densiteBacBetonAlerte" FLOAT DEFAULT 150
  - ALTER TABLE "ConfigElevage" ADD COLUMN "densiteBacBetonCritique" FLOAT DEFAULT 200
  - ALTER TABLE "ConfigElevage" ADD COLUMN "densiteEtangAlerte" FLOAT DEFAULT 30
  - ALTER TABLE "ConfigElevage" ADD COLUMN "densiteEtangCritique" FLOAT DEFAULT 40
  - ALTER TABLE "ConfigElevage" ADD COLUMN "densiteRasAlerte" FLOAT DEFAULT 350
  - ALTER TABLE "ConfigElevage" ADD COLUMN "densiteRasCritique" FLOAT DEFAULT 500
  - ALTER TABLE "ConfigElevage" ADD COLUMN "fenetreRenouvellementJours" INT DEFAULT 7
  - ALTER TABLE "Notification" ADD COLUMN "actionPayload" JSONB
  - CREATE TYPE "SeveriteAlerte" AS ENUM ('INFO', 'AVERTISSEMENT', 'CRITIQUE')
  - ALTER TABLE "Notification" ADD COLUMN "severite" "SeveriteAlerte" DEFAULT 'INFO'

Migration 4 : add_alert_enums_recreate
  - Recreer TypeAlerte avec 4 nouvelles valeurs (pattern RECREATE)
  - Recreer TypeDeclencheur avec 3 nouvelles valeurs : SEUIL_DENSITE, SEUIL_RENOUVELLEMENT, ABSENCE_RELEVE (pattern RECREATE)
  - CREATE TYPE "OperateurCondition" AS ENUM (...)
  - CREATE TYPE "LogiqueCondition" AS ENUM ('ET', 'OU')

Migration 5 : add_condition_regle
  - ALTER TABLE "RegleActivite" ADD COLUMN "logique" "LogiqueCondition" DEFAULT 'ET'
  - CREATE TABLE "ConditionRegle" (id, regleId, typeDeclencheur, operateur, conditionValeur, conditionValeur2, ordre)
  - CREATE INDEX ON "ConditionRegle" (regleId)
```

---

## 12. Phases d'implementation

### Phase A — Fondations (prerequis, sprint 27)

**Objectif :** Modele de donnees et calculs sans UI.

Taches :
1. @db-specialist : 5 migrations Prisma (TypeSystemeBac, TypeReleve+RENOUVELLEMENT, seuils ConfigElevage, enums alertes, ConditionRegle)
2. @architect : Mise a jour `src/types/models.ts` (TypeSystemeBac, SeveriteAlerte, nouveaux TypeAlerte/TypeDeclencheur, OperateurCondition, LogiqueCondition, TypeReleve.RENOUVELLEMENT) + mise a jour `src/types/activity-engine.ts` (RuleEvaluationContext avec densiteKgM3, tauxRenouvellementPctJour, joursDepuisDernierReleveQualiteEau)
3. @developer : Nouvelle fonction `calculerDensiteBac()` dans `calculs.ts` — utilise `computeVivantsByBac()` + biometrie filtree par bacId (voir section 4.1)
4. @developer : Nouvelle fonction `calculerDensiteVague()` dans `calculs.ts` — somme des biomasses / somme des volumes (voir section 4.1b)
5. @developer : Nouvelle fonction `computeTauxRenouvellement()` dans `calculs.ts`
6. @developer : Extension `buildEvaluationContext()` dans `context.ts` :
   - Ajouter parametre `bacs: BacCtx[]` (tous les bacs de la vague) pour pouvoir appeler `computeVivantsByBac()` correctement
   - Calculer `densiteKgM3` via l'algorithme per-bac rigoureux (section 6.3) — NE PAS utiliser `indicateurs.biomasse` pour ce calcul
   - Calculer `tauxRenouvellementPctJour` via `computeTauxRenouvellement()`
   - Calculer `joursDepuisDernierReleveQualiteEau` depuis les releves du bac
   - NOTE PRE-EXISTANT : le calcul de `nombreVivants` dans le bloc local (ligne ~142 de context.ts actuel) utilise `bac.nombreInitial - totalMortalites` sans tenir compte de la repartition inter-bacs. Ce calcul approximatif reste pour les indicateurs legacy (FCR, SGR, tauxSurvie). Seul `densiteKgM3` utilise le calcul rigoureux via `computeVivantsByBac()`.
7. @developer : Extension `evaluateRules()` dans `evaluator.ts` (bloc compound conditions + evalCondition + getContextValue)
8. @developer : Evaluateurs `evalSeuilDensite()`, `evalSeuilRenouvellement()`, `evalAbsenceReleve()` dans `evaluator.ts`
9. @developer : Extension `PATCH /api/bacs/[id]` pour typeSysteme (sans tauxRenouvellement)
10. @developer : Extension `POST /api/releves` pour accepter pourcentageRenouvellement et volumeRenouvele
11. @developer : Nouvelle route `GET /api/bacs/[id]/densite`
12. @tester : Tests unitaires de `calculerDensiteBac()` (cas : biometrie per-bac, fallback global, volume null), `calculerDensiteVague()`, `computeTauxRenouvellement()`, `evalCondition()` (toutes les combinaisons ET/OU), backward compat evaluateur
    - Test specifique : verifier que `densiteKgM3` dans le contexte utilise `computeVivantsByBac()` et non le calcul local de `nombreVivants`

### Phase B — Integration et alertes (sprint 28)

**Objectif :** Alertes en production, UI mobile.

Taches :
1. @developer : Integration `evaluateRules()` dans `POST /api/releves` (BIOMETRIE, MORTALITE, QUALITE_EAU, RENOUVELLEMENT)
2. @developer : Route `GET /api/vagues/[id]/densites`
3. @developer : Route `GET /api/bacs/[id]/renouvellements`
4. @developer : Routes `POST /api/regles-activite/[id]/conditions` et `DELETE`
5. @developer : Champs RENOUVELLEMENT dans `releve-form-client.tsx` (champs lies pourcentage/volume)
6. @developer : Composants `bac-densite-badge.tsx`, `notification-card.tsx` (avec ActionPayload)
7. @developer : Extension `bac-form.tsx` avec TypeSysteme (sans InputTauxRenouvellement)
8. @developer : Widget `alertes-widget.tsx` dans le dashboard
9. @db-specialist : Seed des 6 regles globales DKFarm avec leurs ConditionRegle
10. @tester : Tests integration API alertes + tests UI mobile (360px) + tests regles composees

### Phase C — Polissage (sprint 29+, optionnel)

- Page `/alertes` avec filtres par severite et statut
- Historique des alertes par bac/vague
- Composant `vague-densites-summary.tsx` dans la page vague avec historique renouvellements
- Builder visuel pour les ConditionRegle dans l'UI de gestion des regles (si admins non techniques)
- Graphiques : marqueurs renouvellement sur graphique qualite eau
- Cron job journalier de detection (si infrastructure disponible)
- Escalade (V2)

---

## 13. Decisions rejetees

### "density-alert-service.ts — Service independant pour les alertes de densite"

**Rejete.** La version precedente de cet ADR (avant 2026-03-20) proposait un service separe `src/lib/services/density-alert-service.ts` qui detectait les violations de seuils de densite et creait directement des `Notification`. Ce service etait invoke apres chaque releve BIOMETRIE/MORTALITE/QUALITE_EAU.

Ce service est abandonne pour les raisons suivantes :
1. **Duplication de la logique de detection** — le moteur `RegleActivite` gere deja les declenchements, le cooldown, la deduplication, et les priorites. Un second systeme parallele cree deux sources de verite pour les alertes.
2. **Configurabilite zero** — les seuils etaient hardcodes dans le service. Avec `ConditionRegle`, les admins peuvent modifier les seuils et la logique via l'UI de gestion des regles.
3. **Maintenance double** — deux moteurs d'alerte a tester, deboguer, et faire evoluer.
4. **Confusion UX** — certaines alertes auraient ete des `Activite` (moteur existant) et d'autres des `Notification` (density-alert-service), sans distinction claire pour l'utilisateur.

La solution retenue etend le moteur existant de facon minimale (un modele enfant `ConditionRegle`, deux nouveaux `TypeDeclencheur`, trois nouveaux champs dans le contexte) et elimine le besoin d'un service parallele.

### "Stocker la densite historique dans une table dedicee"

**Rejete.** La densite est un indicateur derive (biomasse / volume), calculable a la demande depuis les releves. Stocker une valeur calculee cree une source de verite multiple et des risques de desynchronisation. Les releves BIOMETRIE existants contiennent toutes les donnees necessaires.

### "Systeme de regles generiques JSON (DSL)"

**Rejete.** Un DSL de regles (type `{ param: "densite", op: ">", valeur: 150 }`) serait tres flexible mais complexe a debugger et maintenir. Les cas d'usage sont bien connus et finis (densite, renouvellement, qualite eau, FCR, survie, absence de releve). Des fonctions specialisees sont plus lisibles et testables. Le modele `ConditionRegle` donne la flexibilite necessaire sans la complexite d'un DSL arbitraire.

### "Regles configurees par les pisciculteurs eux-memes"

**Rejete pour la V1.** Les pisciculteurs camerounais n'ont pas la formation pour ajuster des seuils numeriques scientifiques. De mauvaises configurations rendraient le systeme dangereusement permissif ou irritablement bruyant. En V1, seul l'ADMIN (gerant de la ferme ou ingenieur DKFarm) peut modifier les seuils via l'UI de gestion des regles. Une UI simplifiee "activer/desactiver" par type d'alerte peut etre ajoutee en V2.

### "Calcul de densite effective avec facteur de renouvellement"

**Rejete.** La "densite effective" ajustee par le taux de renouvellement d'eau est un concept scientifique pertinent (une densite de 300 kg/m3 avec 100%/jour de renouvellement est plus sure que 150 kg/m3 avec 0%/jour). Cependant, ce calcul n'est pas standard dans les outils de terrain et serait difficile a expliquer. Le systeme qui separe la densite (indicateur) et le renouvellement (alerte independante via regle composee) est plus pedagogique.

### "Notification push (SMS, WhatsApp)"

**Rejete pour ce ADR.** Infrastructure non prevue. Les notifications restent dans l'application. Un bell icon avec compteur badge sur le header mobile est suffisant pour la V1.

### "Champ statique tauxRenouvellement sur Bac"

**Rejete.** La version initiale de cet ADR prevoyait un champ `tauxRenouvellement Float?` sur le modele Bac. Ce champ a ete remplace par des releves de type RENOUVELLEMENT pour les raisons suivantes :
1. Un champ statique represente une intention ("je renouvelle 50%/jour") pas une realite
2. Les releves donnent un historique horodate exploitable pour les graphiques et les tendances
3. Un champ statique se desynchonise facilement (declare une fois, jamais mis a jour) ce qui fausserait les alertes
4. La convergence avec le pattern existant de releves simplifie le schema (pas de nouveau champ sur Bac)
5. Le calcul du taux moyen sur une fenetre glissante est plus representatif et plus robuste qu'une valeur declaree

### "Interfaces DensityAlertInput / QualiteEauSnapshot / RenouvellementSnapshot comme types separes"

**Rejete (annule avec la suppression du density-alert-service).** Ces interfaces etaient le contrat d'entree du density-alert-service. Maintenant que les donnees de densite et de renouvellement sont exposees directement dans `RuleEvaluationContext` (via `densiteKgM3`, `tauxRenouvellementPctJour`, `joursDepuisDernierReleveQualiteEau`), ces types intermediaires ne sont plus necessaires.

### "renouvellementMinimum / renouvellementCritique / delaiSansQualiteEauJours dans ConfigElevage"

**Rejete (retire de ConfigElevage).** La version precedente de cet ADR stockait ces trois seuils dans ConfigElevage. Avec les regles composees seedees, ces valeurs sont encodees directement dans les `conditionValeur` des `ConditionRegle`. Cela signifie que les seuils peuvent etre ajustes regle par regle, et qu'un site peut avoir plusieurs regles avec des seuils differents (par exemple une regle legere a 25%/jour et une critique a 10%/jour). Garder ces valeurs dans ConfigElevage en plus des conditions serait une duplication avec risque de desynchronisation.

---

## Fichiers a creer ou modifier

| Fichier | Action | Phase |
|---------|--------|-------|
| `prisma/schema.prisma` | Modifier : TypeSystemeBac enum, champ typeSysteme sur Bac, TypeReleve+RENOUVELLEMENT, champs Releve, champs ConfigElevage (6 seuils + fenetreRenouvellementJours), champs Notification, enums etendus, ConditionRegle modele, logique sur RegleActivite | A |
| `prisma/seed.sql` | Modifier : seed 6 regles globales DKFarm avec ConditionRegle | B |
| `src/types/models.ts` | Modifier : TypeSystemeBac, SeveriteAlerte, nouveaux TypeAlerte/TypeDeclencheur, OperateurCondition, LogiqueCondition, TypeReleve.RENOUVELLEMENT | A |
| `src/types/activity-engine.ts` | Modifier : RuleEvaluationContext (ajouter densiteKgM3, tauxRenouvellementPctJour, joursDepuisDernierReleveQualiteEau) | A |
| `src/types/notifications.ts` | Creer : types ActionPayload structures (ModifyBacAction sans tauxRenouvellement) | A |
| `src/lib/calculs.ts` | Modifier : ajouter `calculerDensiteBac()`, `computeTauxRenouvellement()` | A |
| `src/lib/activity-engine/context.ts` | Modifier : buildEvaluationContext() — ajouter calcul densite, taux renouvellement, jours QE | A |
| `src/lib/activity-engine/evaluator.ts` | Modifier : evaluateRules() — bloc compound conditions, evalCondition(), getContextValue(), evalSeuilDensite/Renouvellement/AbsenceReleve | A |
| `src/app/api/bacs/[id]/route.ts` | Modifier : PATCH accepte typeSysteme (pas tauxRenouvellement) | A |
| `src/app/api/bacs/[id]/densite/route.ts` | Creer : GET densite bac | A |
| `src/app/api/bacs/[id]/renouvellements/route.ts` | Creer : GET historique renouvellements | B |
| `src/app/api/vagues/[id]/densites/route.ts` | Creer : GET densites tous bacs | B |
| `src/app/api/releves/route.ts` | Modifier : accepter RENOUVELLEMENT + champs lies + appel evaluateur etendu | B |
| `src/app/api/regles-activite/[id]/conditions/route.ts` | Creer : POST + DELETE ConditionRegle | B |
| `src/components/alertes/notification-card.tsx` | Creer | B |
| `src/components/bacs/bac-densite-badge.tsx` | Creer | B |
| `src/components/bacs/bac-form.tsx` | Modifier : TypeSysteme seulement (supprimer InputTauxRenouvellement) | B |
| `src/components/releves/releve-form-client.tsx` | Modifier : champs RENOUVELLEMENT lies (pourcentage <-> litres) | B |
| `src/components/dashboard/alertes-widget.tsx` | Creer | B |
