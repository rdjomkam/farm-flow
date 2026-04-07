# ADR-044 — Module Reproduction Complet : Plan d'Implémentation

**Statut :** PROPOSÉ
**Date :** 2026-04-07
**Auteur :** @architect
**Contexte :** Remplacement et expansion du module Alevins (Sprint 10) en un système de suivi de reproduction complet en 8 modules.

---

## Table des matières

1. [Contexte et problématique](#1-contexte-et-problématique)
2. [Phase de Nettoyage — Ce qui change dans l'existant](#2-phase-de-nettoyage--ce-qui-change-dans-lexistant)
3. [Design du Schéma Prisma — Modèles complets](#3-design-du-schéma-prisma--modèles-complets)
4. [Stratégie de migration des données](#4-stratégie-de-migration-des-données)
5. [Intégration avec les systèmes existants](#5-intégration-avec-les-systèmes-existants)
6. [Routes API — Contrats complets](#6-routes-api--contrats-complets)
7. [Pages et Composants UI](#7-pages-et-composants-ui)
8. [Découpage en Sprints](#8-découpage-en-sprints)
9. [Exigences design frontend](#9-exigences-design-frontend)
10. [Checklist de vérification par sprint](#10-checklist-de-vérification-par-sprint)

---

## 1. Contexte et problématique

### État actuel (Sprint 10 — Alevins basique)

Le module Alevins comporte 3 modèles Prisma (`Reproducteur`, `Ponte`, `LotAlevins`), 4 enums, 3 pages UI, 3 fichiers de queries, et 6 composants. Il couvre uniquement le strict minimum : enregistrer un géniteur, créer une ponte, et suivre un lot.

**Lacunes majeures identifiées :**
- Aucun dashboard /alevins (page index manquante)
- Pas de gestion groupe vs individuel des géniteurs
- Pas de workflow multi-étapes pour les pontes (injection hormonale, stripping, résultat)
- Pas de modèle Incubation séparé
- Pas de relevés pour les phases larvaire/nurserie/alevinage
- Pas de splitting de lots après tri
- Pas de KPIs calculés (taux d'éclosion, survie en chaîne, FCR alevins)
- Pas de module de planification
- Males traités comme des reproducteurs identiques aux femelles (réalité terrain : males = consommables)
- Pas de traçabilité origine génétique / alertes consanguinité

### Décisions clés (issues de la recherche terrain)

**D1 — Géniteurs en mode Groupe par défaut**
95% des fermes africaines ne font aucune identification individuelle. Le mode par défaut est la gestion par lot/bac. Le mode individuel est opt-in via les paramètres du module.

**D2 — Males sont des consommables**
Le mâle Clarias ne peut pas être strippé. Il est sacrifié pour prélever les testicules. L'app doit modéliser un compteur de mâles décroissant et des alertes stock bas.

**D3 — Réutiliser le système de relevés existant**
Les phases Nurserie et Alevinage utilisent le modèle `Releve` existant avec un nouveau champ `lotAlevinsId` (nullable). Un nouveau `TypeReleve.TRI` est ajouté. Pas de "mini-vague" : les lots de la nurserie ne créent pas de Vague.

**D4 — Incubation comme modèle séparé**
L'incubation a ses propres données (substrat, traitements antifongiques, compte-à-rebours) distinctes du lot. Un lot naît d'une incubation, pas directement d'une ponte.

**D5 — Splitting de lots modélisé par relation parent-enfant**
Après un tri, un lot peut être divisé en sous-lots. La relation `parentLotId` sur `LotAlevins` permet de tracer l'arbre généalogique des lots.

**D6 — URL structure : /reproduction remplace /alevins**
Le chemin `/alevins` est conservé en redirect vers `/reproduction` pour compatibilité. La navigation est mise à jour.

**D7 — Ponte en mode groupe ou individuel**
En mode groupe, `femelleId` pointe vers un `LotGeniteurs` (nouveau modèle). En mode individuel, `femelleId` pointe vers un `Reproducteur`. Les deux FK existent sur `Ponte` avec une contrainte de check applicative : exactement un des deux doit être non-null.

---

## 2. Phase de Nettoyage — Ce qui change dans l'existant

### 2.1 Modèles Prisma à modifier

#### `Reproducteur` — Modification majeure

Renommage conceptuel : ce modèle représente désormais un **géniteur individuel** (mode B). Le mode groupe est géré par un nouveau modèle `LotGeniteurs`.

**Champs à ajouter :**
```
modeGestion       ModeGestionGeniteur  @default(INDIVIDUEL)
photo             String?              // URL ou base64 thumbnail
pitTag            String?              // code PIT tag si équipé
nombrePontesTotal Int                  @default(0)
dernierePonte     DateTime?
tempsReposJours   Int?                 // calculé : jours depuis dernière ponte
generation        GenerationGeniteur   @default(INCONNUE)
sourcing          SourcingGeniteur     @default(ACHAT_FERMIER)
bacId             String?              // bac d'hébergement actuel
```

**Statuts à étendre (enum `StatutReproducteur`):**
Ajout : `EN_REPOS`, `SACRIFIE`
Conserver : `ACTIF`, `REFORME`, `MORT`

#### `Ponte` — Extension du workflow

**Champs à ajouter :**
```
// Sélection des géniteurs
lotGeniteursFemellId  String?          // FK LotGeniteurs (mode groupe)
lotGeniteursMaleId    String?          // FK LotGeniteurs (mode groupe, mâles)
// Injection hormonale
typeHormone           TypeHormone?
doseHormone           Float?           // mL ou UI/kg
coutHormone           Float?           // FCFA
heureInjection        DateTime?
temperatureEau        Float?           // °C au moment injection
// Stripping
heureStripping        DateTime?        // calculé ou saisi
poidOeufsGrammes      Float?           // pesée des oeufs
nombreOeufsEstime     Int?             // auto: poids × 750
qualiteOeufs          QualiteOeufs?
// Mâle
methodeMale           MethodeExtractionMale?
motiliteSperme        MotiliteSperme?
// Résultat
tauxEclosion          Float?           // calculé depuis Incubation
nombreLarvesViables   Int?
coutTotal             Float?           // auto: hormone + alimentation
causeEchec            CauseEchecPonte?
```

#### `LotAlevins` — Ajouts phase et splitting

**Champs à ajouter :**
```
phase               PhaseLot          @default(INCUBATION)
parentLotId         String?           // FK self — lot parent après tri
dateDebutPhase      DateTime          @default(now())
// Nurserie/Alevinage
nombreDeformesRetires Int?
poidsObjectifG      Float?            // objectif sortie (ex: 7g, 10g, 15g)
destinationSortie   DestinationLot?   // VENTE, TRANSFERT_GROSSISSEMENT, INTERNE
vagueDestinationId  String?           // existant, conservé
```

### 2.2 Fichiers UI à supprimer ou remplacer

| Fichier actuel | Action |
|----------------|--------|
| `src/app/alevins/page.tsx` | REMPLACER — créer vrai dashboard |
| `src/components/alevins/reproducteurs-list-client.tsx` | REMPLACER — support mode groupe/individuel |
| `src/components/alevins/pontes-list-client.tsx` | REMPLACER — nouveau workflow multi-étapes |
| `src/components/alevins/ponte-detail-client.tsx` | REMPLACER — inclure phases incubation |
| `src/components/alevins/lots-list-client.tsx` | REMPLACER — nouvelles phases et splitting |
| `src/components/alevins/lot-detail-client.tsx` | REMPLACER — relevés intégrés |
| `src/components/alevins/reproducteur-detail-client.tsx` | CONSERVER + ÉTENDRE |

### 2.3 Routes API à modifier ou ajouter

| Route actuelle | Action |
|----------------|--------|
| `GET/POST /api/reproducteurs` | MODIFIER — support filtre modeGestion |
| `GET/POST /api/pontes` | MODIFIER — nouveau payload multi-étapes |
| `POST /api/pontes/[id]/etape` | AJOUTER — progression par étape |
| `GET/POST /api/lots-alevins` | MODIFIER — nouvelles phases |
| `POST /api/lots-alevins/[id]/split` | AJOUTER — tri et découpage |

### 2.4 Navigation à mettre à jour

Dans `src/lib/module-nav-items.ts`, le bloc `Reproduction` est étendu :

```typescript
{
  label: "Reproduction",
  matchPaths: ["/reproduction", "/alevins"],  // /alevins = alias redirect
  items: [
    { href: "/reproduction", label: "Dashboard", itemKey: "dashboard", icon: LayoutDashboard },
    { href: "/reproduction/geniteurs", label: "Géniteurs", itemKey: "geniteurs", icon: Fish },
    { href: "/reproduction/pontes", label: "Pontes", itemKey: "pontes", icon: Egg },
    { href: "/reproduction/lots", label: "Lots", itemKey: "lots", icon: Layers },
    { href: "/reproduction/planning", label: "Planning", itemKey: "planning", icon: Calendar },
  ],
}
```

---

## 3. Design du Schéma Prisma — Modèles complets

### 3.1 Nouveaux enums

```prisma
// ── Géniteurs ────────────────────────────────────────────────

enum ModeGestionGeniteur {
  GROUPE      // par lot/bac — défaut — 95% des fermes
  INDIVIDUEL  // avec ID unique, photo, historique
}

enum GenerationGeniteur {
  G0_SAUVAGE
  G1
  G2
  G3_PLUS
  INCONNUE
}

enum SourcingGeniteur {
  PROPRE_PRODUCTION
  ACHAT_FERMIER
  SAUVAGE
  STATION_RECHERCHE
}

// Statuts étendus (remplace l'enum existant)
// MODIFICATION de StatutReproducteur — ajouter EN_REPOS et SACRIFIE
// EN_REPOS : femelle en période de récupération post-ponte (min 6 semaines)
// SACRIFIE : mâle utilisé pour prélèvement testiculaire

// ── Pontes ───────────────────────────────────────────────────

enum TypeHormone {
  OVAPRIM
  OVATIDE
  HCG
  HYPOPHYSE_SILURE
  HYPOPHYSE_CARPE
  HYPOPHYSE_TILAPIA
  LHRH_A
  AUTRE
}

enum QualiteOeufs {
  EXCELLENTE   // aplatis, translucides, uniformes
  BONNE
  MOYENNE      // quelques anomalies
  MAUVAISE     // oeufs pâteux, trop tôt
  NON_EVALUEE
}

enum MethodeExtractionMale {
  SACRIFICE    // méthode standard — mâle tué
  CHIRURGICALE // incision abdominale — mâle réutilisable jusqu'à 4x
}

enum MotiliteSperme {
  OK           // mouvement vigoureux > 30 sec
  KO           // pas de mouvement
  NON_TESTE
}

enum CauseEchecPonte {
  STRIPPING_TROP_PRECOCE
  STRIPPING_TROP_TARDIF
  SPERME_NON_VIABLE
  CONTAMINATION_EAU
  FEMELLE_NON_MATURE
  HORMONE_INSUFFISANTE
  TEMPERATURE_INADAPTEE
  MANIPULATION_EXCESSIVE
  AUTRE
}

// ── Incubation ───────────────────────────────────────────────

enum SubstratIncubation {
  RACINES_PISTIA       // recommandé Afrique — taux 66%
  JACINTHES_EAU
  PLATEAU_PERFORE
  EPONGE_PONTE
  BROSSES_FLOTTANTES
  KAKABAN
  FOND_BETON
  AUTRE
}

enum StatutIncubation {
  EN_COURS
  ECLOSION_EN_COURS
  TERMINEE
  ECHOUEE
}

// ── Lots d'alevins ───────────────────────────────────────────

enum PhaseLot {
  INCUBATION       // 0 à ~30h (dépend température)
  LARVAIRE         // 0 à 3 jours — phase vésicule vitelline
  NURSERIE         // jour 3 à ~6 semaines (~1g)
  ALEVINAGE        // 1g à 7-15g
  SORTI            // lot fermé — vendu ou transféré
  PERDU
}

enum DestinationLot {
  VENTE_ALEVINS          // → module Ventes
  TRANSFERT_GROSSISSEMENT // → module Grossissement (Vague)
  TRANSFERT_INTERNE      // autre lot ou bac
  REFORMAGE
}

// ── TypeReleve : ajout TRI (applicable lot alevins + vague grossissement)
// MODIFICATION de l'enum existant TypeReleve — ajouter :
// TRI  : grading par classe de taille, découpage en sous-lots
```

### 3.2 Nouveau modèle `LotGeniteurs`

Représente un groupe de géniteurs d'un même bac (mode par défaut).

```prisma
model LotGeniteurs {
  id                    String             @id @default(cuid())
  code                  String             @unique  // ex: "LG-2026-F-01"
  nom                   String             // ex: "Bac Femelles A"
  sexe                  SexeReproducteur   // MALE ou FEMELLE
  nombrePoissons        Int                // effectif actuel
  poidsMoyenG           Float?             // poids moyen estimé en grammes
  poidsMinG             Float?
  poidsMaxG             Float?
  origine               String?            // description libre de l'origine
  sourcing              SourcingGeniteur   @default(ACHAT_FERMIER)
  generation            GenerationGeniteur @default(INCONNUE)
  dateAcquisition       DateTime           @default(now())
  // Pour mâles : compteur décrémenté à chaque utilisation
  nombreMalesDisponibles Int?              // null si sexe=FEMELLE
  seuilAlerteMales      Int?               // alerte quand <= seuil
  // Alertes consanguinité
  dateRenouvellementGenétique DateTime?    // date dernier ajout de géniteurs extérieurs
  // Relations
  bacId                 String?
  bac                   Bac?              @relation(fields: [bacId], references: [id])
  pontesAsFemelle       Ponte[]           @relation("PonteGroupeFemelle")
  pontesAsMale          Ponte[]           @relation("PonteGroupeMale")
  statut                StatutReproducteur @default(ACTIF)
  notes                 String?
  siteId                String
  site                  Site              @relation(fields: [siteId], references: [id])
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@index([siteId])
  @@index([siteId, sexe])
  @@index([siteId, statut])
  @@index([bacId])
}
```

### 3.3 Modèle `Ponte` révisé

```prisma
model Ponte {
  id            String   @id @default(cuid())
  code          String   @unique  // ex: "P-2026-042"

  // ── Sélection géniteurs — exactement un mode actif ──
  // Mode individuel (Reproducteur existant)
  femelleId               String?
  femelle                 Reproducteur?  @relation("PonteFemelle", ...)
  maleId                  String?
  male                    Reproducteur?  @relation("PonteMale", ...)
  // Mode groupe (LotGeniteurs)
  lotGeniteursFemellId    String?
  lotGeniteursFemelle     LotGeniteurs?  @relation("PonteGroupeFemelle", ...)
  lotGeniteursMaleId      String?
  lotGeniteursMale        LotGeniteurs?  @relation("PonteGroupeMale", ...)

  // ── Étape 1 : Injection ──
  typeHormone         TypeHormone?
  doseHormone         Float?             // mL ou UI selon type
  doseMgKg            Float?             // mg/kg calculé si hypophyse
  coutHormone         Float?             // FCFA
  heureInjection      DateTime?
  temperatureEauC     Float?             // °C au moment injection
  latenceTheorique    Int?               // heures — calculé depuis table temp

  // ── Étape 2 : Stripping ──
  heureStripping          DateTime?
  poidsOeufsPontesG       Float?         // pesée directe
  nombreOeufsEstime       Int?           // auto: poids × 750
  qualiteOeufs            QualiteOeufs?
  methodeMale             MethodeExtractionMale?
  motiliteSperme          MotiliteSperme?

  // ── Étape 3 : Résultat ──
  tauxFecondation         Float?         // % — mesuré à l'incubation
  tauxEclosion            Float?         // % — calculé depuis Incubation
  nombreLarvesViables     Int?           // après retrait déformés (~10-15%)
  coutTotal               Float?         // total auto-calculé

  // ── Statut et métadonnées ──
  statut                  StatutPonte    @default(EN_COURS)
  causeEchec              CauseEchecPonte?
  datePonte               DateTime
  notes                   String?

  // ── Relations ──
  incubations             Incubation[]
  lotsAlevins             LotAlevins[]   // lots créés de cette ponte

  siteId                  String
  site                    Site           @relation(...)
  createdAt               DateTime       @default(now())
  updatedAt               DateTime       @updatedAt

  @@index([siteId])
  @@index([siteId, statut])
  @@index([femelleId])
  @@index([lotGeniteursFemellId])
}
```

### 3.4 Nouveau modèle `Incubation`

```prisma
model Incubation {
  id                   String            @id @default(cuid())
  code                 String            @unique  // ex: "INC-2026-042"
  ponteId              String
  ponte                Ponte             @relation(fields: [ponteId], references: [id])

  // ── Paramètres incubation ──
  substrat             SubstratIncubation @default(RACINES_PISTIA)
  temperatureEauC      Float?             // °C — détermine durée éclosion
  dureeIncubationH     Int?               // heures théoriques — auto calculé
  dateDebutIncubation  DateTime           @default(now())
  dateEclosionPrevue   DateTime?          // auto calculé
  dateEclosionReelle   DateTime?

  // ── Traitements antifongiques ──
  traitements          TraitementIncubation[]

  // ── Résultats ──
  nombreOeufsPlaces    Int?               // quantité mise en incubation
  nombreLarvesEcloses  Int?               // résultat comptage
  tauxEclosion         Float?             // auto: larvesEcloses / oeufsPlaces
  nombreDeformes       Int?               // ~10-15% des larves
  nombreLarvesViables  Int?               // auto: ecloses - deformes
  notesRetrait         String?            // description retrait oeufs morts

  statut               StatutIncubation   @default(EN_COURS)
  notes                String?

  // ── Relations ──
  lotAlevins           LotAlevins[]       // lots créés depuis cette incubation

  siteId               String
  site                 Site               @relation(...)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  @@index([siteId])
  @@index([ponteId])
}
```

### 3.5 Nouveau modèle `TraitementIncubation`

Enregistre chaque traitement antifongique pendant l'incubation.

```prisma
model TraitementIncubation {
  id             String     @id @default(cuid())
  incubationId   String
  incubation     Incubation @relation(fields: [incubationId], references: [id], onDelete: Cascade)

  produit        String     // ex: "Vert de malachite", "Peroxyde d'hydrogène"
  concentration  String     // ex: "0.1 ppm", "15 ppm"
  dureeMinutes   Int
  heure          DateTime   @default(now())
  notes          String?

  siteId         String
  site           Site       @relation(...)
  createdAt      DateTime   @default(now())

  @@index([incubationId])
  @@index([siteId])
}
```

### 3.6 Modèle `LotAlevins` révisé

```prisma
model LotAlevins {
  id                      String           @id @default(cuid())
  code                    String           @unique  // ex: "LA-2026-042-A"

  // ── Origine ──
  ponteId                 String?          // nullable pour lots importés
  ponte                   Ponte?           @relation(...)
  incubationId            String?          // lien direct vers l'incubation source
  incubation              Incubation?      @relation(...)

  // ── Splitting ──
  parentLotId             String?          // lot parent si issu d'un tri
  parentLot               LotAlevins?      @relation("LotSplits", fields: [parentLotId], references: [id])
  sousLots                LotAlevins[]     @relation("LotSplits")

  // ── Effectifs ──
  nombreInitial           Int
  nombreActuel            Int
  nombreDeformesRetires   Int              @default(0)

  // ── Croissance ──
  ageJours                Int              @default(0)
  poidsMoyenG             Float?           // grammes
  poidsObjectifG          Float?           // objectif sortie (7, 10, 15g)

  // ── Phase et localisation ──
  phase                   PhaseLot         @default(INCUBATION)
  dateDebutPhase          DateTime         @default(now())
  bacId                   String?
  bac                     Bac?             @relation(...)

  // ── Sortie ──
  destinationSortie       DestinationLot?
  vagueDestinationId      String?          // si TRANSFERT_GROSSISSEMENT
  vagueDestination        Vague?           @relation(...)
  dateTransfert           DateTime?

  // ── Statut et métadonnées ──
  statut                  StatutLotAlevins  @default(EN_INCUBATION)
  notes                   String?

  // ── Relations avec le système de relevés ──
  releves                 Releve[]          // relevés liés à ce lot (nurserie/alevinage)

  siteId                  String
  site                    Site              @relation(...)
  createdAt               DateTime          @default(now())
  updatedAt               DateTime          @updatedAt

  @@index([siteId])
  @@index([ponteId])
  @@index([siteId, statut])
  @@index([siteId, phase])
  @@index([parentLotId])
}
```

### 3.7 Extension du modèle `Releve` existant

Ajout d'un champ optionnel pour lier un relevé à un lot d'alevins (nurserie/alevinage) :

```prisma
// Dans model Releve — ajout :
lotAlevinsId  String?
lotAlevins    LotAlevins? @relation(fields: [lotAlevinsId], references: [id])
```

Et dans `TypeReleve` — ajout de la valeur :
```prisma
TRI  // grading par classe de taille
```

**Données TRI stockées en JSON dans le champ `données` existant du relevé :**
```json
{
  "methode": "VISUELLE | GRILLE | ECHANTILLON",
  "classesDistribution": [
    { "classeMin": 1.0, "classeMax": 2.0, "nombre": 1200, "bacDestination": "bac-id-1" },
    { "classeMin": 2.0, "classeMax": 4.0, "nombre": 800, "bacDestination": "bac-id-2" }
  ],
  "nombreTiresRetires": 45,
  "observation": "Bonne homogénéité"
}
```

### 3.8 Extension de l'enum `StatutReproducteur`

```prisma
// Modification de l'enum existant — ajouter :
EN_REPOS   // femelle en récupération post-ponte
SACRIFIE   // mâle sacrifié pour prélèvement testiculaire
```

### 3.9 Extension du modèle `TypeReleve` et `TypeAlerte`

```prisma
// TypeReleve — ajout :
TRI  // grading, classement par taille

// TypeAlerte — ajouts :
MALES_STOCK_BAS          // lot géniteurs mâles sous seuil
FEMELLE_SUREXPLOITEE     // < 6 semaines depuis dernière ponte
CONSANGUINITE_RISQUE     // même origine > 2 ans
INCUBATION_ECLOSION      // notification heure d'éclosion approche
TAUX_SURVIE_CRITIQUE_LOT // survie lot alevins < seuil
```

### 3.10 Récapitulatif — delta schéma

| Type | Nom | Action |
|------|-----|--------|
| Enum | `ModeGestionGeniteur` | NOUVEAU |
| Enum | `GenerationGeniteur` | NOUVEAU |
| Enum | `SourcingGeniteur` | NOUVEAU |
| Enum | `StatutReproducteur` | MODIFIER (+EN_REPOS, +SACRIFIE) |
| Enum | `TypeHormone` | NOUVEAU |
| Enum | `QualiteOeufs` | NOUVEAU |
| Enum | `MethodeExtractionMale` | NOUVEAU |
| Enum | `MotiliteSperme` | NOUVEAU |
| Enum | `CauseEchecPonte` | NOUVEAU |
| Enum | `SubstratIncubation` | NOUVEAU |
| Enum | `StatutIncubation` | NOUVEAU |
| Enum | `PhaseLot` | NOUVEAU |
| Enum | `DestinationLot` | NOUVEAU |
| Enum | `TypeReleve` | MODIFIER (+TRI) |
| Enum | `TypeAlerte` | MODIFIER (+5 valeurs) |
| Modèle | `LotGeniteurs` | NOUVEAU |
| Modèle | `Incubation` | NOUVEAU |
| Modèle | `TraitementIncubation` | NOUVEAU |
| Modèle | `Reproducteur` | MODIFIER (+7 champs) |
| Modèle | `Ponte` | MODIFIER (+16 champs, +2 FK groupe) |
| Modèle | `LotAlevins` | MODIFIER (+6 champs, +parent-enfant) |
| Modèle | `Releve` | MODIFIER (+lotAlevinsId) |

---

## 4. Stratégie de migration des données

### 4.1 Règles de migration non-destructive

**Principe** : toutes les modifications sont additives (ajout de colonnes nullable). Aucun modèle existant n'est supprimé ni renommé.

### 4.2 Plan de migration Prisma

**Migration 1 — Nouveaux enums**
Script SQL : créer les 12 nouveaux enums avec `CREATE TYPE`. Ne touche pas aux données existantes.

**Migration 2 — Modifier enums existants**
Stratégie RECREATE (cf. MEMORY.md) pour `StatutReproducteur`, `TypeReleve`, `TypeAlerte` :
1. Renommer l'ancien type `_old`
2. Créer le nouveau type avec toutes les valeurs
3. Caster les colonnes
4. Supprimer l'ancien type

**Migration 3 — Nouveaux modèles**
Créer tables `LotGeniteurs`, `Incubation`, `TraitementIncubation`.

**Migration 4 — Modifications colonnes**
Ajouter colonnes nullable sur `Reproducteur`, `Ponte`, `LotAlevins`, `Releve`.

### 4.3 Rétrocompatibilité des données existantes

- Les `Reproducteur` existants conservent leurs données ; `modeGestion` sera `INDIVIDUEL` par défaut (ce qui est sémantiquement correct pour un enregistrement individuel)
- Les `Ponte` existantes continuent de fonctionner avec `femelleId`/`maleId` non-null et les nouvelles colonnes à null
- Les `LotAlevins` existants gardent `phase = EN_INCUBATION` par défaut, ce qui correspond à leur état d'origine
- Les `Releve` existants auront `lotAlevinsId = null` — ils restent liés uniquement à des `Vague`

### 4.4 Seed data

Le fichier `prisma/seed.sql` sera étendu avec :
- 2 `LotGeniteurs` (1 femelles, 1 mâles)
- 2 `Ponte` avec données injection complètes
- 1 `Incubation` terminée
- 2 `LotAlevins` en phases NURSERIE et ALEVINAGE
- 2 `TraitementIncubation`
- 3 `Releve` de type TRI liés à un lot alevins

---

## 5. Intégration avec les systèmes existants

### 5.1 Intégration avec les Bacs

Les `LotGeniteurs` et `LotAlevins` peuvent être assignés à un `Bac` via `bacId`. Un bac peut héberger :
- Un seul `LotGeniteurs` actif (vérification applicative)
- Un seul `LotAlevins` actif (vérification applicative)
- Une seule `Vague` active (contrainte existante)

**Règle** : un bac ne peut être assigné qu'à un seul objet à la fois (vague OU lot géniteurs OU lot alevins). Cette vérification est faite en couche API.

### 5.2 Intégration avec le système de Relevés

- Les relevés de types `BIOMETRIE`, `MORTALITE`, `ALIMENTATION`, `QUALITE_EAU`, `COMPTAGE`, `OBSERVATION`, `TRI` s'appliquent aux lots en phase NURSERIE et ALEVINAGE
- Le champ `lotAlevinsId` est renseigné, `vagueId` est null pour ces relevés
- Le formulaire de relevé existant (`/releves/nouveau`) sera étendu pour accepter un `lotAlevinsId` en plus du `vagueId`
- L'API `/api/releves` accepte déjà `vagueId` comme filtre — ajouter `lotAlevinsId` comme filtre optionnel

### 5.3 Intégration avec les Ventes

Quand un `LotAlevins` sort en `VENTE_ALEVINS` :
1. L'utilisateur déclenche la sortie depuis la page détail du lot
2. Un dialog pré-remplit une nouvelle Vente avec : `quantitePoissons = nombreActuel`, `type = ALEVINS`
3. Le lot passe en statut `SORTI`, `destinationSortie = VENTE_ALEVINS`

Le modèle `Vente` existant est réutilisé sans modification.

### 5.4 Intégration avec le Grossissement (Vagues)

Quand un `LotAlevins` sort en `TRANSFERT_GROSSISSEMENT` :
1. L'utilisateur choisit une `Vague` existante en cours (ou crée une nouvelle)
2. `vagueDestinationId` est renseigné sur le lot
3. Le lot passe en statut `SORTI`, `destinationSortie = TRANSFERT_GROSSISSEMENT`
4. La `Vague` reçoit les alevins : son `nombreInitial` et `origineAlevins` peuvent être mis à jour

### 5.5 Intégration avec le module Stock

- La consommation d'hormones est enregistrée comme `MouvementStock` (SORTIE) lors de la création d'une ponte avec hormone
- La consommation d'Artemia est enregistrée comme `MouvementStock` lié au lot et au relevé ALIMENTATION
- Ces liens sont optionnels (pas de blocage si le stock n'est pas géré)

### 5.6 Intégration avec les Alertes

Le moteur d'alertes existant (`src/lib/activity-engine.ts`) sera étendu avec les nouveaux types d'alertes :

| Alerte | Déclencheur | Données |
|--------|------------|---------|
| `MALES_STOCK_BAS` | `LotGeniteurs.nombreMalesDisponibles <= seuilAlerteMales` | lot.code, stock actuel |
| `FEMELLE_SUREXPLOITEE` | dernière ponte < 6 semaines | reproducteur.code ou lot.code |
| `CONSANGUINITE_RISQUE` | `dateRenouvellementGenétique` > 2 ans ou null + origine unique | lot.code |
| `INCUBATION_ECLOSION` | `dateEclosionPrevue` - 2h | incubation.code |
| `TAUX_SURVIE_CRITIQUE_LOT` | survie lot < seuil configurable | lot.code, taux actuel |

### 5.7 Intégration avec Planning

Les événements de reproduction apparaissent dans le calendrier `/planning` existant :
- Pontes planifiées
- Éclosions attendues
- Tris programmés
- Remplacements de géniteurs dus

---

## 6. Routes API — Contrats complets

### Convention générale
Toutes les routes :
- Requièrent `requirePermission(req, Permission.ALEVINS_VOIR)` au minimum
- Sont scopées par `activeSiteId`
- Respectent la pagination standard (`limit`, `offset`)
- Retournent `{ data, total, limit, offset }` pour les listes

### 6.1 Module Géniteurs

```
GET    /api/reproduction/geniteurs
  Query: mode=GROUPE|INDIVIDUEL, sexe=MALE|FEMELLE, statut=ACTIF|..., bacId, limit, offset
  Response: { data: LotGeniteurs[] | Reproducteur[], total, limit, offset }

POST   /api/reproduction/geniteurs
  Body: { mode: "GROUPE" | "INDIVIDUEL", ...fields }
  Response 201: LotGeniteurs | Reproducteur

GET    /api/reproduction/geniteurs/[id]
  Response: LotGeniteurs | Reproducteur avec historique pontes

PATCH  /api/reproduction/geniteurs/[id]
  Body: Partial<LotGeniteurs | Reproducteur>
  Permission: ALEVINS_MODIFIER

DELETE /api/reproduction/geniteurs/[id]
  Règle: interdit si pontes liées non terminées
  Permission: ALEVINS_SUPPRIMER

// Spécifique aux lots mâles — décrémenter le stock
POST   /api/reproduction/geniteurs/[id]/utiliser-male
  Body: { nombreUtilises: number }
  Response: { nombreMalesDisponibles: number }
```

### 6.2 Module Pontes — Workflow multi-étapes

```
GET    /api/reproduction/pontes
  Query: statut, femelleId, lotGeniteursFemellId, dateFrom, dateTo, limit, offset
  Response: { data: PonteSummary[], total }

POST   /api/reproduction/pontes
  Body: CreatePonteDTO — étape 1 (sélection géniteurs + injection)
  Response 201: { id, code, statut: "EN_COURS" }

GET    /api/reproduction/pontes/[id]
  Response: PonteWithRelations

PATCH  /api/reproduction/pontes/[id]/stripping
  Body: SteppingStepDTO — étape 2 (résultats stripping)
  Permission: ALEVINS_MODIFIER

PATCH  /api/reproduction/pontes/[id]/resultat
  Body: ResultatPonteDTO — étape 3 (résultats finaux)
  Permission: ALEVINS_MODIFIER

PATCH  /api/reproduction/pontes/[id]/echec
  Body: { causeEchec: CauseEchecPonte, notes?: string }
  Permission: ALEVINS_MODIFIER

DELETE /api/reproduction/pontes/[id]
  Règle: interdit si incubations ou lots liés
  Permission: ALEVINS_SUPPRIMER
```

**DTOs clés :**

```typescript
interface CreatePonteDTO {
  // Mode groupe OU mode individuel — exactement un des deux
  femelleId?: string;           // mode individuel
  lotGeniteursFemellId?: string; // mode groupe
  maleId?: string;
  lotGeniteursMaleId?: string;
  // Injection
  datePonte: string;            // ISO 8601
  typeHormone?: TypeHormone;
  doseHormone?: number;
  coutHormone?: number;
  heureInjection?: string;
  temperatureEauC?: number;
  notes?: string;
}

interface StrippingStepDTO {
  heureStripping: string;
  poidsOeufsPontesG?: number;
  nombreOeufsEstime?: number;   // null = auto calculé (poids × 750)
  qualiteOeufs?: QualiteOeufs;
  methodeMale?: MethodeExtractionMale;
  motiliteSperme?: MotiliteSperme;
}

interface ResultatPonteDTO {
  tauxFecondation?: number;     // % — peut être renseigné manuellement
  statut: "TERMINEE" | "ECHOUEE";
  causeEchec?: CauseEchecPonte;
  notes?: string;
}
```

### 6.3 Module Incubation

```
GET    /api/reproduction/incubations
  Query: ponteId, statut, limit, offset

POST   /api/reproduction/incubations
  Body: CreateIncubationDTO
  Response 201: Incubation

GET    /api/reproduction/incubations/[id]
  Response: IncubationWithTraitements

PATCH  /api/reproduction/incubations/[id]
  Body: Partial<Incubation>

POST   /api/reproduction/incubations/[id]/traitements
  Body: { produit, concentration, dureeMinutes, heure?, notes? }

PATCH  /api/reproduction/incubations/[id]/eclosion
  Body: { nombreLarvesEcloses, nombreDeformes?, dateEclosionReelle, notes? }
  Effet: crée automatiquement un LotAlevins en phase LARVAIRE

DELETE /api/reproduction/incubations/[id]/traitements/[traitementId]
```

**DTO CreateIncubationDTO :**
```typescript
interface CreateIncubationDTO {
  ponteId: string;
  substrat: SubstratIncubation;
  temperatureEauC?: number;   // si fourni, calcule dureeIncubationH auto
  dateDebutIncubation?: string; // défaut: maintenant
  nombreOeufsPlaces?: number;
  notes?: string;
}
```

**Auto-calcul durée incubation selon température :**
```
20°C → 40h | 22°C → 36h | 25°C → 30h | 27°C → 25h | 30°C → 22h
```

### 6.4 Module Lots d'Alevins

```
GET    /api/reproduction/lots
  Query: phase, statut, ponteId, bacId, limit, offset
  Response: { data: LotSummary[], total }

POST   /api/reproduction/lots
  Body: CreateLotDTO
  Response 201: LotAlevins

GET    /api/reproduction/lots/[id]
  Response: LotWithRelations (inclut releves, sousLots)

PATCH  /api/reproduction/lots/[id]
  Body: UpdateLotDTO
  Permission: ALEVINS_MODIFIER

PATCH  /api/reproduction/lots/[id]/phase
  Body: { phase: PhaseLot, dateDebutPhase?, bacId? }
  Effet: change la phase du lot

POST   /api/reproduction/lots/[id]/split
  Body: SplitLotDTO
  Effet: crée des sous-lots, passe le parent en phase SORTI

PATCH  /api/reproduction/lots/[id]/sortie
  Body: { destinationSortie, vagueDestinationId?, dateTransfert, notes? }
  Effet: lot → SORTI

DELETE /api/reproduction/lots/[id]
  Règle: interdit si sousLots actifs
  Permission: ALEVINS_SUPPRIMER
```

**DTO SplitLotDTO :**
```typescript
interface SplitLotDTO {
  sousLots: Array<{
    code?: string;          // auto-généré si absent: parent-code + "-A", "-B"...
    nombrePoissons: number;
    bacId?: string;
    poidsMinG?: number;
    poidsMaxG?: number;
    notes?: string;
  }>;
  releveTriId?: string;     // relevé TRI source optionnel
}
```

### 6.5 Module Relevés Reproduction

Les relevés pour les lots alevins passent par l'API existante `/api/releves` avec l'ajout du paramètre `lotAlevinsId`. Aucune nouvelle route dédiée.

```
GET    /api/releves?lotAlevinsId=xxx        // relevés d'un lot
POST   /api/releves                          // body inclut lotAlevinsId optionnel
```

### 6.6 Module Dashboard KPIs

```
GET    /api/reproduction/kpis
  Query: dateFrom, dateTo (défaut: 90 derniers jours)
  Response: ReproductionKPIsResponse

GET    /api/reproduction/kpis/funnel
  Query: dateFrom, dateTo
  Response: FunnelDataResponse (données entonnoir de survie)

GET    /api/reproduction/kpis/lots
  Query: phase, limit (défaut: 10 lots actifs)
  Response: LotKPIResponse[]
```

**ReproductionKPIsResponse :**
```typescript
interface ReproductionKPIsResponse {
  // KPIs Pontes
  nombrePontesTotales: number;
  nombrePontesReussies: number;
  tauxReussitePontes: number;          // %
  tauxFecondationMoyen: number;        // %
  tauxEclosionMoyen: number;           // %
  // KPIs Lots actifs
  nombreLotsActifs: number;
  nombreLarvesTotales: number;
  tauxSurvieGlobalMoyen: number;       // % — de ponte à stade actuel
  // Stock géniteurs
  nombreFemelles: number;
  nombreMalesDisponibles: number;
  alertesMalesBasStock: number;        // nombre de lots sous seuil
  alertesFemelleSurexploitees: number;
  // Coûts
  coutMoyenParAlevin: number;          // FCFA
}
```

### 6.7 Module Planning

```
GET    /api/reproduction/planning
  Query: dateFrom, dateTo, type=PONTES|ECLOSIONS|TRIS|GENITEURS
  Response: PlanningEvent[]

POST   /api/reproduction/planning/ponte-planifiee
  Body: { dateEstimee, lotGeniteursFemellId?, femelleId?, notes? }
```

---

## 7. Pages et Composants UI

### 7.1 Arborescence des pages

```
/reproduction
  /page.tsx                        → Dashboard (Server Component)
  /geniteurs
    /page.tsx                      → Liste géniteurs groupes + individuels
    /[id]/page.tsx                 → Détail géniteur / lot géniteurs
  /pontes
    /page.tsx                      → Liste pontes avec statuts
    /nouvelle/page.tsx             → Formulaire multi-étapes (4 étapes)
    /[id]/page.tsx                 → Détail ponte + incubations liées
  /incubations
    /[id]/page.tsx                 → Détail incubation + timer + traitements
  /lots
    /page.tsx                      → Liste lots par phase (tabs)
    /[id]/page.tsx                 → Détail lot + relevés + sous-lots
    /[id]/releve/nouveau/page.tsx  → Nouveau relevé pour ce lot
  /planning
    /page.tsx                      → Vue calendrier + Gantt
```

**Redirects :**
```
/alevins → /reproduction
/alevins/reproducteurs → /reproduction/geniteurs
/alevins/pontes → /reproduction/pontes
/alevins/lots → /reproduction/lots
```

### 7.2 Arbre des composants

```
src/components/reproduction/
  ├── dashboard/
  │   ├── reproduction-dashboard.tsx           (Server)
  │   ├── reproduction-kpi-cards.tsx           (Server)
  │   ├── survival-funnel-chart.tsx            (Client — Recharts)
  │   ├── ponte-timeline-chart.tsx             (Client — Recharts)
  │   └── active-lots-gantt.tsx                (Client — custom CSS)
  ├── geniteurs/
  │   ├── geniteurs-list-client.tsx            (Client — tabs groupe/individuel)
  │   ├── lot-geniteurs-card.tsx               (Client)
  │   ├── lot-geniteurs-form.tsx               (Client — Dialog)
  │   ├── reproducteur-card.tsx                (Client)
  │   ├── reproducteur-form.tsx                (Client — Dialog)
  │   ├── geniteur-detail-client.tsx           (Client)
  │   └── inbreeding-alert-badge.tsx           (Client)
  ├── pontes/
  │   ├── pontes-list-client.tsx               (Client — tabs statuts)
  │   ├── ponte-card.tsx                       (Client)
  │   ├── ponte-form-stepper.tsx               (Client — 4 étapes)
  │   │   ├── step-selection-geniteurs.tsx     (Client)
  │   │   ├── step-injection.tsx               (Client — calcul auto latence)
  │   │   ├── step-stripping.tsx               (Client — calcul auto oeufs)
  │   │   └── step-resultat.tsx                (Client)
  │   ├── ponte-detail-client.tsx              (Client)
  │   └── ponte-fail-dialog.tsx                (Client — Dialog Radix)
  ├── incubations/
  │   ├── incubation-card.tsx                  (Client)
  │   ├── incubation-form.tsx                  (Client — Dialog)
  │   ├── incubation-detail-client.tsx         (Client)
  │   ├── eclosion-countdown-timer.tsx         (Client — useEffect)
  │   ├── traitement-form.tsx                  (Client — Dialog)
  │   └── eclosion-result-form.tsx             (Client — Dialog)
  ├── lots/
  │   ├── lots-list-client.tsx                 (Client — tabs phases)
  │   ├── lot-card.tsx                         (Client)
  │   ├── lot-form.tsx                         (Client — Dialog)
  │   ├── lot-detail-client.tsx                (Client)
  │   ├── lot-phase-stepper.tsx                (Client — progression phases)
  │   ├── lot-split-dialog.tsx                 (Client — Dialog Radix)
  │   ├── lot-sortie-dialog.tsx                (Client — Dialog Radix)
  │   └── lot-releves-tab.tsx                  (Client — réutilise releves existants)
  └── planning/
      ├── reproduction-planning-client.tsx     (Client)
      ├── ponte-planning-calendar.tsx          (Client)
      └── lots-gantt-view.tsx                  (Client)
```

### 7.3 Composants à fort potentiel visuel

Ces composants nécessitent un design soigné et non basique :

**`survival-funnel-chart.tsx`** — Entonnoir de survie
Visualise la chaîne : Oeufs → Larves écloses → Larves viables → Nurserie → Alevinage → Sortie. Utilise Recharts `FunnelChart` ou un composant CSS custom. Affiche les pourcentages de conversion à chaque étape. Couleurs progressives du vert au rouge selon performance.

**`eclosion-countdown-timer.tsx`** — Compte à rebours éclosion
Widget visuel temps réel (mise à jour toutes les secondes). Affiche : "Éclosion dans 3h 22min" avec une barre de progression. Passe en mode alerte (pulsant, orange) quand < 2h. Passe en mode "Vérifier maintenant" (rouge) quand heure dépassée.

**`ponte-form-stepper.tsx`** — Formulaire multi-étapes
Indicateur de progression visuel en haut (4 étapes avec icônes). Transitions fluides entre étapes. Chaque étape affiche les calculs auto en temps réel (ex: "Latence estimée : 10h30" calculé depuis la température saisie).

**`lots-gantt-view.tsx`** — Vue Gantt des lots actifs
Barres horizontales par lot montrant : phase actuelle, durée passée, phase suivante estimée. Code couleur par phase. Clic sur une barre → détail du lot.

**`lot-phase-stepper.tsx`** — Progression de phase
Stepper horizontal : Incubation → Larvaire → Nurserie → Alevinage → Sorti. Phase actuelle surlignée avec données clés (âge jours, effectif, poids moyen).

### 7.4 Spécifications Mobile First (360px)

- **Listes** : Cartes empilées, pas de tableaux. Chaque carte comporte maximum 4 lignes d'info clé + badge statut
- **Formulaires** : Inputs larges (height: 48px), boutons full-width, labels au-dessus des champs
- **Stepper de ponte** : Chaque étape = une "page" scrollable. Navigation bas de page avec boutons Précédent/Suivant full-width
- **Compte-à-rebours** : Widget proéminent en haut de la page détail incubation, grande typographie
- **Graphiques** : Hauteur fixe 250px sur mobile, scrollable horizontalement si Gantt
- **Dashboard** : KPI cards en 2 colonnes sur mobile (2×2), entonnoir en pleine largeur en dessous

---

## 8. Découpage en Sprints

### Sprint R1 — Fondations Schéma & Nettoyage (1 semaine)

**Objectif** : Faire évoluer le schéma Prisma sans casser l'existant. Préparer les types TypeScript.

**Stories :**

| ID | Description | Agent | Dépendance |
|----|-------------|-------|-----------|
| R1-S1 | Nouveaux enums Prisma (12 enums) | @db-specialist | — |
| R1-S2 | Modifier enums existants (StatutReproducteur +2, TypeReleve +TRI, TypeAlerte +5) | @db-specialist | R1-S1 |
| R1-S3 | Nouveaux modèles : LotGeniteurs, Incubation, TraitementIncubation | @db-specialist | R1-S1 |
| R1-S4 | Modifier Reproducteur, Ponte, LotAlevins, Releve (colonnes nullable) | @db-specialist | R1-S3 |
| R1-S5 | Migration Prisma + seed.sql étendu | @db-specialist | R1-S4 |
| R1-S6 | Types TypeScript miroirs dans src/types/models.ts | @architect | R1-S4 |
| R1-S7 | Redirects /alevins → /reproduction | @developer | — |
| R1-S8 | Mise à jour module-nav-items.ts | @developer | — |
| R1-S9 | Tests migration non-régression (build OK, tests existants OK) | @tester | R1-S5 |

**Critères de sortie Sprint R1 :**
- `npx prisma migrate deploy` sans erreur
- `npm run build` OK
- `npx vitest run` OK (tous les tests existants passent)
- Navigation /reproduction fonctionne

---

### Sprint R2 — Module Géniteurs + Pontes (2 semaines)

**Objectif** : Géniteurs en mode groupe (défaut) + workflow ponte multi-étapes.

**Stories :**

| ID | Description | Agent |
|----|-------------|-------|
| R2-S1 | Queries géniteurs (LotGeniteurs CRUD + Reproducteur étendu) | @db-specialist |
| R2-S2 | API /api/reproduction/geniteurs (GET/POST/PATCH/DELETE) | @developer |
| R2-S3 | API /api/reproduction/geniteurs/[id]/utiliser-male | @developer |
| R2-S4 | Page /reproduction/geniteurs — liste + formulaires groupe/individuel | @developer |
| R2-S5 | Page /reproduction/geniteurs/[id] — détail avec historique | @developer |
| R2-S6 | Queries pontes étendues (multi-étapes) | @db-specialist |
| R2-S7 | API /api/reproduction/pontes (GET/POST) | @developer |
| R2-S8 | API /api/reproduction/pontes/[id]/stripping + resultat + echec | @developer |
| R2-S9 | Page /reproduction/pontes — liste avec tabs statuts | @developer |
| R2-S10 | Page /reproduction/pontes/nouvelle — formulaire 4 étapes | @developer |
| R2-S11 | Page /reproduction/pontes/[id] — détail ponte | @developer |
| R2-S12 | Tests API géniteurs + pontes | @tester |
| R2-S13 | Tests UI création ponte (workflow complet) | @tester |

**Calculs automatiques à implémenter :**
- Latence théorique : `T(temp) = table(temperatureEauC)` — lookup table dans `src/lib/reproduction/calculs.ts`
- Nombre d'oeufs estimé : `Math.round(poidsOeufsPontesG * 750)`
- Coût total ponte : `coutHormone + (consommationsStock?.reduce(...))`

---

### Sprint R3 — Incubation + Lots Larvaires (2 semaines)

**Objectif** : Suivi de l'incubation avec timer, puis phases larvaire et nurserie.

**Stories :**

| ID | Description | Agent |
|----|-------------|-------|
| R3-S1 | Queries incubation + TraitementIncubation | @db-specialist |
| R3-S2 | API /api/reproduction/incubations (CRUD + traitements + eclosion) | @developer |
| R3-S3 | Queries lots alevins étendues (phases, splitting) | @db-specialist |
| R3-S4 | API /api/reproduction/lots (CRUD + phase + split + sortie) | @developer |
| R3-S5 | Extension API /api/releves — accepter lotAlevinsId | @developer |
| R3-S6 | Page /reproduction/incubations/[id] — détail + timer + traitements | @developer |
| R3-S7 | Composant EclosionCountdownTimer | @developer |
| R3-S8 | Page /reproduction/lots — liste avec tabs phases | @developer |
| R3-S9 | Page /reproduction/lots/[id] — détail lot + relevés + sous-lots | @developer |
| R3-S10 | Composant LotPhaseStepper | @developer |
| R3-S11 | Dialog LotSplitDialog (tri → sous-lots) | @developer |
| R3-S12 | Intégration TypeReleve.TRI dans le formulaire de relevé existant | @developer |
| R3-S13 | Alertes : INCUBATION_ECLOSION, TAUX_SURVIE_CRITIQUE_LOT | @developer |
| R3-S14 | Tests incubation (timer, calculs) | @tester |
| R3-S15 | Tests splitting lots | @tester |

**Règle : le formulaire de relevé `/releves/nouveau` doit afficher un sélecteur contextuel :**
- Si l'utilisateur vient de `/vagues/[id]` → `vagueId` pré-rempli
- Si l'utilisateur vient de `/reproduction/lots/[id]` → `lotAlevinsId` pré-rempli
- Si ouvert depuis le menu → sélecteur "Pour quelle entité ?" (Vague / Lot alevins)

---

### Sprint R4 — Alevinage + Sorties + Intégrations (2 semaines)

**Objectif** : Phase alevinage, sorties vers ventes/grossissement, alertes géniteurs.

**Stories :**

| ID | Description | Agent |
|----|-------------|-------|
| R4-S1 | Dialog LotSortieDialog (vers Vente ou Vague) | @developer |
| R4-S2 | Intégration sortie → module Ventes (pré-remplir formulaire) | @developer |
| R4-S3 | Intégration sortie → module Grossissement (associer Vague) | @developer |
| R4-S4 | Alertes : MALES_STOCK_BAS, FEMELLE_SUREXPLOITEE, CONSANGUINITE_RISQUE | @developer |
| R4-S5 | Badge InbreedingAlertBadge sur fiche LotGeniteurs | @developer |
| R4-S6 | Calcul taux de survie global (chaîne ponte → sortie) | @db-specialist |
| R4-S7 | Extension API /api/reproduction/geniteurs — filtres avancés | @developer |
| R4-S8 | i18n — nouveau namespace src/messages/fr/reproduction.json | @developer |
| R4-S9 | Migration namespace /alevins → /reproduction dans les messages existants | @developer |
| R4-S10 | Tests intégration sorties (vente + transfert) | @tester |
| R4-S11 | Tests alertes reproduction | @tester |
| R4-S12 | Build complet + non-régression totale | @tester |

---

### Sprint R5 — Dashboard KPIs + Planning (2 semaines)

**Objectif** : Dashboard reproduction avec graphiques, KPIs calculés, et vue planning.

**Stories :**

| ID | Description | Agent |
|----|-------------|-------|
| R5-S1 | Queries KPIs reproduction (agrégations complexes) | @db-specialist |
| R5-S2 | API /api/reproduction/kpis + /kpis/funnel + /kpis/lots | @developer |
| R5-S3 | Page /reproduction — dashboard complet | @developer |
| R5-S4 | Composant SurvivalFunnelChart (Recharts) | @developer |
| R5-S5 | Composant PonteTimelineChart (Recharts) | @developer |
| R5-S6 | Composant ReproductionKpiCards | @developer |
| R5-S7 | API /api/reproduction/planning | @developer |
| R5-S8 | Page /reproduction/planning — calendrier + Gantt | @developer |
| R5-S9 | Composant LotsGanttView | @developer |
| R5-S10 | Calculateur de production (input → femelles/mâles/surface nécessaires) | @developer |
| R5-S11 | Tests KPIs (valeurs attendues) | @tester |
| R5-S12 | Tests planning | @tester |
| R5-S13 | Review code complète module Reproduction | @code-reviewer |
| R5-S14 | Commit sprint + documentation finale | @architect |

---

## 9. Exigences design frontend

### 9.1 Pages à fort effort design

| Page | Pourquoi | Composants visuels clés |
|------|----------|------------------------|
| `/reproduction` (dashboard) | Premier aperçu module — doit impressionner | Funnel chart, KPI cards colorées, timeline pontes |
| `/reproduction/pontes/nouvelle` | Workflow critique — 4 étapes — doit être guidant | Stepper avec état, calculs auto en temps réel, validation progressive |
| `/reproduction/incubations/[id]` | Urgence temporelle — compte-à-rebours visible | Timer proéminent, indicateurs état oeufs |
| `/reproduction/lots/[id]` (phase alevinage) | Dashboard opérationnel quotidien | Stepper phases, mini-graphique croissance, relevés intégrés |
| `/reproduction/planning` | Vue stratégique | Calendrier avec codes couleur, Gantt scrollable |

### 9.2 Palette de couleurs par phase

```
INCUBATION     → violet   (#7c3aed) — mystère, attente
LARVAIRE       → bleu     (#2563eb) — fragilité, eau
NURSERIE       → vert clair (#16a34a) — croissance initiale
ALEVINAGE      → vert     (#15803d) — croissance active
SORTI          → gris     (#6b7280) — terminé
PERDU          → rouge    (#dc2626) — perte
```

### 9.3 Codes couleur KPI

Reprendre le système existant :
- `var(--primary)` pour valeurs dans les normes
- Orange `#f97316` pour avertissement
- Rouge `#dc2626` pour critique

### 9.4 Mobile First — Contraintes spécifiques à ce module

- Le stepper de ponte doit fonctionner en portrait (360px). Chaque étape = une seule question principale + champs secondaires accordéon
- Le compte-à-rebours doit être lisible en plein soleil (contraste élevé, grande taille)
- Les cartes de lot doivent afficher phase + effectif + âge en moins de 3 lignes
- Aucun tableau. Listes de pontes = cartes avec badge statut coloré

---

## 10. Checklist de vérification par sprint

### Pour chaque sprint, l'agent @tester vérifie :

**Vérifications techniques systématiques :**
- [ ] `npx prisma migrate deploy` — sans erreur
- [ ] `npx prisma db seed` — seed complet sans erreur
- [ ] `npx vitest run` — tous les tests existants + nouveaux passent
- [ ] `npm run build` — build production OK (0 erreur TypeScript)
- [ ] Conformité R1-R9 (enums UPPERCASE, imports, siteId partout, DialogTrigger asChild, CSS variables)

**Vérifications spécifiques module Reproduction :**

#### Sprint R1
- [ ] Toutes les tables créées en base avec les bons types
- [ ] Redirects /alevins → /reproduction fonctionnent (301)
- [ ] Navigation module affiche les 5 entrées
- [ ] Données seed chargées correctement (LotGeniteurs, Incubation, etc.)

#### Sprint R2
- [ ] Création LotGeniteurs (mode groupe) fonctionne avec validation siteId
- [ ] Workflow ponte : les 3 étapes PATCH (stripping, résultat, échec) sont mutuellement exclusives
- [ ] Calcul automatique latence affiché correctement pour différentes températures
- [ ] Calcul automatique nombre oeufs = poids × 750 (± 1 arrondi)
- [ ] Décrément `nombreMalesDisponibles` correct après utilisation
- [ ] Filtre par sexe sur liste géniteurs fonctionne

#### Sprint R3
- [ ] Création incubation depuis page ponte fonctionne
- [ ] Calcul `dateEclosionPrevue` correct pour 5 températures (20, 22, 25, 27, 30°C)
- [ ] Timer affiche compte-à-rebours correct (rafraîchi toutes les secondes)
- [ ] Création sous-lots via split : somme des effectifs = effectif parent
- [ ] Relevé de type TRI accepte `lotAlevinsId` et refuse si ni `vagueId` ni `lotAlevinsId`
- [ ] Phase du lot mise à jour lors de la progression

#### Sprint R4
- [ ] Sortie vers Ventes : `venteId` pré-rempli, lot passe à SORTI
- [ ] Sortie vers Grossissement : `vagueDestinationId` renseigné, lot passe à SORTI
- [ ] Alerte `MALES_STOCK_BAS` se déclenche quand `nombreMalesDisponibles <= seuilAlerteMales`
- [ ] Alerte `FEMELLE_SUREXPLOITEE` se déclenche si `dernierePonte` < 42 jours (6 semaines)
- [ ] i18n : aucune chaîne codée en dur en français dans les composants (utiliser `useTranslations`)

#### Sprint R5
- [ ] KPI `tauxEclosionMoyen` correct (moyenne des incubations terminées dans la période)
- [ ] Entonnoir de survie affiche les bons pourcentages
- [ ] Planning affiche les événements futurs (pontes planifiées, éclosions)
- [ ] Test manuel mobile 360px : stepper ponte navigable, cards lisibles, timer visible
- [ ] Test manuel desktop 1440px : dashboard avec graphiques, Gantt visible

### Checklist d'intégration inter-modules (Sprint R4 + R5)

**Intégration Reproduction → Ventes :**
- [ ] Un lot sorti en VENTE_ALEVINS apparaît comme origine dans la vente
- [ ] La suppression d'une vente liée à un lot ne supprime pas le lot

**Intégration Reproduction → Grossissement :**
- [ ] Un lot transféré vers une vague est visible dans la fiche vague
- [ ] La clôture de la vague n'affecte pas le statut du lot source

**Intégration Reproduction → Relevés :**
- [ ] Un relevé `lotAlevinsId` n'est pas retourné dans les queries `vagueId` et vice-versa
- [ ] Le formulaire de relevé refuse la double référence (vagueId + lotAlevinsId simultanés)

**Intégration Reproduction → Alertes :**
- [ ] Les alertes reproduction apparaissent dans le hub d'alertes existant
- [ ] Les permissions `ALEVINS_VOIR` couvrent la lecture des alertes reproduction

---

## Annexe A — Interfaces TypeScript à créer dans src/types/models.ts

```typescript
// Enums reproduction étendus
export enum ModeGestionGeniteur { GROUPE = "GROUPE", INDIVIDUEL = "INDIVIDUEL" }
export enum GenerationGeniteur { G0_SAUVAGE = "G0_SAUVAGE", G1 = "G1", G2 = "G2", G3_PLUS = "G3_PLUS", INCONNUE = "INCONNUE" }
export enum SourcingGeniteur { PROPRE_PRODUCTION = "PROPRE_PRODUCTION", ACHAT_FERMIER = "ACHAT_FERMIER", SAUVAGE = "SAUVAGE", STATION_RECHERCHE = "STATION_RECHERCHE" }
export enum TypeHormone { OVAPRIM = "OVAPRIM", OVATIDE = "OVATIDE", HCG = "HCG", HYPOPHYSE_SILURE = "HYPOPHYSE_SILURE", HYPOPHYSE_CARPE = "HYPOPHYSE_CARPE", HYPOPHYSE_TILAPIA = "HYPOPHYSE_TILAPIA", LHRH_A = "LHRH_A", AUTRE = "AUTRE" }
export enum QualiteOeufs { EXCELLENTE = "EXCELLENTE", BONNE = "BONNE", MOYENNE = "MOYENNE", MAUVAISE = "MAUVAISE", NON_EVALUEE = "NON_EVALUEE" }
export enum MethodeExtractionMale { SACRIFICE = "SACRIFICE", CHIRURGICALE = "CHIRURGICALE" }
export enum MotiliteSperme { OK = "OK", KO = "KO", NON_TESTE = "NON_TESTE" }
export enum CauseEchecPonte { STRIPPING_TROP_PRECOCE = "STRIPPING_TROP_PRECOCE", STRIPPING_TROP_TARDIF = "STRIPPING_TROP_TARDIF", SPERME_NON_VIABLE = "SPERME_NON_VIABLE", CONTAMINATION_EAU = "CONTAMINATION_EAU", FEMELLE_NON_MATURE = "FEMELLE_NON_MATURE", HORMONE_INSUFFISANTE = "HORMONE_INSUFFISANTE", TEMPERATURE_INADAPTEE = "TEMPERATURE_INADAPTEE", MANIPULATION_EXCESSIVE = "MANIPULATION_EXCESSIVE", AUTRE = "AUTRE" }
export enum SubstratIncubation { RACINES_PISTIA = "RACINES_PISTIA", JACINTHES_EAU = "JACINTHES_EAU", PLATEAU_PERFORE = "PLATEAU_PERFORE", EPONGE_PONTE = "EPONGE_PONTE", BROSSES_FLOTTANTES = "BROSSES_FLOTTANTES", KAKABAN = "KAKABAN", FOND_BETON = "FOND_BETON", AUTRE = "AUTRE" }
export enum StatutIncubation { EN_COURS = "EN_COURS", ECLOSION_EN_COURS = "ECLOSION_EN_COURS", TERMINEE = "TERMINEE", ECHOUEE = "ECHOUEE" }
export enum PhaseLot { INCUBATION = "INCUBATION", LARVAIRE = "LARVAIRE", NURSERIE = "NURSERIE", ALEVINAGE = "ALEVINAGE", SORTI = "SORTI", PERDU = "PERDU" }
export enum DestinationLot { VENTE_ALEVINS = "VENTE_ALEVINS", TRANSFERT_GROSSISSEMENT = "TRANSFERT_GROSSISSEMENT", TRANSFERT_INTERNE = "TRANSFERT_INTERNE", REFORMAGE = "REFORMAGE" }

// Interfaces
export interface LotGeniteurs {
  id: string; code: string; nom: string;
  sexe: SexeReproducteur; nombrePoissons: number;
  poidsMoyenG: number | null; poidsMinG: number | null; poidsMaxG: number | null;
  origine: string | null; sourcing: SourcingGeniteur; generation: GenerationGeniteur;
  dateAcquisition: Date; nombreMalesDisponibles: number | null;
  seuilAlerteMales: number | null; dateRenouvellementGenetique: Date | null;
  bacId: string | null; statut: StatutReproducteur; notes: string | null;
  siteId: string; createdAt: Date; updatedAt: Date;
}

export interface Incubation {
  id: string; code: string; ponteId: string;
  substrat: SubstratIncubation; temperatureEauC: number | null;
  dureeIncubationH: number | null; dateDebutIncubation: Date;
  dateEclosionPrevue: Date | null; dateEclosionReelle: Date | null;
  nombreOeufsPlaces: number | null; nombreLarvesEcloses: number | null;
  tauxEclosion: number | null; nombreDeformes: number | null;
  nombreLarvesViables: number | null; notesRetrait: string | null;
  statut: StatutIncubation; notes: string | null;
  siteId: string; createdAt: Date; updatedAt: Date;
}

export interface TraitementIncubation {
  id: string; incubationId: string;
  produit: string; concentration: string;
  dureeMinutes: number; heure: Date; notes: string | null;
  siteId: string; createdAt: Date;
}
```

---

## Annexe B — Table de latence hormonale (src/lib/reproduction/calculs.ts)

```typescript
/** Calcule la durée de latence théorique en heures selon la température de l'eau.
 * Source : données terrain Clarias gariepinus, Afrique de l'Ouest.
 * Interpolation linéaire entre les points de référence.
 */
export function calculerLatenceHeures(temperatureC: number): number {
  const TABLE = [
    { temp: 20, heures: 14.5 },
    { temp: 22, heures: 13.0 },
    { temp: 25, heures: 10.5 },
    { temp: 27, heures: 9.5 },
    { temp: 30, heures: 8.0 },
  ];
  // Interpolation linéaire entre les points les plus proches
  // ...
}

/** Calcule la durée d'incubation jusqu'à éclosion en heures selon la température. */
export function calculerDureeIncubationHeures(temperatureC: number): number {
  const TABLE = [
    { temp: 20, heures: 40 },
    { temp: 22, heures: 36 },
    { temp: 25, heures: 30 },
    { temp: 27, heures: 25 },
    { temp: 30, heures: 22 },
  ];
  // Interpolation linéaire
}

/** Estime le nombre d'oeufs depuis le poids en grammes. */
export function estimerNombreOeufs(poidsG: number): number {
  return Math.round(poidsG * 750);
}

/** Calcule le taux de survie global d'un lot depuis la ponte source. */
export function calculerTauxSurvieGlobal(
  nombreOeufsInitiaux: number,
  nombreActuel: number
): number {
  if (nombreOeufsInitiaux <= 0) return 0;
  return Math.round((nombreActuel / nombreOeufsInitiaux) * 10000) / 100; // 2 décimales
}
```

---

*ADR-044 — Créé le 2026-04-07 par @architect*
*Basé sur : ADR-001 à ADR-043, docs/research/clarias-reproduction-complete-guide.md*
