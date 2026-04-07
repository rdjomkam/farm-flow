# Pré-analyse R1-S4 — 2026-04-07

## Statut : GO AVEC RÉSERVES

## Résumé

R1-S4 ajoute des champs aux modèles `Reproducteur`, `Ponte`, `LotAlevins` et `Releve`. Tous les enums requis sont déjà présents dans le schéma (créés lors de R1-S1). `StatutReproducteur` a déjà `EN_REPOS` et `SACRIFIE`. Cependant, 3 points exigent une attention avant l'implémentation : (1) une discordance de nom de champ entre le schéma cible ADR-044 et la story, (2) l'obligation d'ajouter une back-relation sur `Bac` pour le nouveau `bacId` de `Reproducteur`, (3) une ambiguïté sur la nullabilité de `nombreDeformesRetires`.

---

## Vérifications effectuées

### Schema — État actuel des 4 modèles cibles

#### `Reproducteur` (lignes 1537-1556)
Champs actuels : `id`, `code`, `sexe`, `poids`, `age`, `origine`, `statut`, `dateAcquisition`, `notes`, `siteId`, `site`, `pontesAsFemelle`, `pontesAsMale`, `createdAt`, `updatedAt`.

Champs à ajouter (AUCUN n'est encore présent) :
- `modeGestion ModeGestionGeniteur @default(INDIVIDUEL)`
- `photo String?`
- `pitTag String?`
- `nombrePontesTotal Int @default(0)`
- `dernierePonte DateTime?`
- `tempsReposJours Int?`
- `generation GenerationGeniteur @default(INCONNUE)`
- `sourcing SourcingGeniteur @default(ACHAT_FERMIER)`
- `bacId String?` + `bac Bac? @relation(...)` (FK vers Bac)

**Attention :** L'ajout de `bacId` sur `Reproducteur` nécessite une back-relation sur le modèle `Bac`. Actuellement `Bac` n'a PAS de champ `reproducteurs Reproducteur[]`. Il faudra l'ajouter en même temps que la FK.

#### `Ponte` (lignes 1558-1588)
Champs déjà présents depuis R1-S3 : `lotGeniteursFemellId`, `lotGeniteursFemelle`, `lotGeniteursMaleId`, `lotGeniteursMale`, `incubations`.

Champs à ajouter (AUCUN des champs ci-dessous n'est présent) :
- `typeHormone TypeHormone?`
- `doseHormone Float?`
- `doseMgKg Float?`
- `coutHormone Float?`
- `heureInjection DateTime?`
- `temperatureEauC Float?`
- `latenceTheorique Int?`
- `heureStripping DateTime?`
- `poidsOeufsPontesG Float?`  — voir RISQUE 1 ci-dessous
- `nombreOeufsEstime Int?`
- `qualiteOeufs QualiteOeufs?`
- `methodeMale MethodeExtractionMale?`
- `motiliteSperme MotiliteSperme?`
- `tauxEclosion Float?`
- `nombreLarvesViables Int?`
- `coutTotal Float?`
- `causeEchec CauseEchecPonte?`

#### `LotAlevins` (lignes 1590-1618)
Champs déjà présents depuis R1-S3 : `incubationId`, `incubation`.

Champs à ajouter (AUCUN des champs ci-dessous n'est présent) :
- `phase PhaseLot @default(INCUBATION)`
- `parentLotId String?` + relations self-référentielles `parentLot` / `sousLots`
- `dateDebutPhase DateTime @default(now())`
- `nombreDeformesRetires Int @default(0)` — voir RISQUE 2 ci-dessous
- `poidsObjectifG Float?`
- `destinationSortie DestinationLot?`

Note : `LotAlevins` a déjà `vagueDestinationId` (mentionné dans ADR-044 comme "existant, conservé") — OK, rien à faire.

Note : `LotAlevins` a actuellement `poidsMoyen Float?`. ADR-044 §3.6 le nomme `poidsMoyenG Float?`. Il s'agit du même champ — aucun renommage n'est prévu par R1-S4, le champ existant est conservé tel quel.

#### `Releve` (lignes 1209-1279)
Champs actuels : aucun champ `lotAlevinsId` ni relation `lotAlevins` n'existe.

Champ à ajouter :
- `lotAlevinsId String?`
- `lotAlevins LotAlevins? @relation(fields: [lotAlevinsId], references: [id])`
- `@@index([lotAlevinsId])` (bonne pratique)

La back-relation `releves Releve[]` devra aussi être ajoutée sur `LotAlevins` (actuellement absent du modèle LotAlevins). ADR-044 §3.6 la liste.

### Enums requis : OK — TOUS déjà présents

| Enum | Statut | Lignes schéma |
|------|--------|---------------|
| `ModeGestionGeniteur` | PRESENT | 510-513 |
| `GenerationGeniteur` | PRESENT | 515-521 |
| `SourcingGeniteur` | PRESENT | 523-528 |
| `TypeHormone` | PRESENT | 530-539 |
| `QualiteOeufs` | PRESENT | 541-547 |
| `MethodeExtractionMale` | PRESENT | 549-552 |
| `MotiliteSperme` | PRESENT | 554-558 |
| `CauseEchecPonte` | PRESENT | 560-570 |
| `PhaseLot` | PRESENT | 590-597 |
| `DestinationLot` | PRESENT | 599-604 |
| `StatutReproducteur.EN_REPOS` | PRESENT | 456 |
| `StatutReproducteur.SACRIFIE` | PRESENT | 459 |
| `TypeReleve.TRI` | PRESENT | 29 |

Tous les 13 enums/valeurs requis sont déjà dans le schéma — aucune migration d'enum n'est nécessaire pour R1-S4.

### Cohérence back-relations : PROBLÈME MINEUR

- `Bac` a déjà `lotGeniteurs LotGeniteurs[]` (ligne 1108) — OK pour R1-S3.
- `Bac` n'a PAS `reproducteurs Reproducteur[]` — doit être ajouté en même temps que `Reproducteur.bacId`.
- `LotAlevins` n'a PAS `releves Releve[]` — doit être ajouté en même temps que `Releve.lotAlevinsId`.

### Build & Tests
Non exécutés (pré-analyse schema uniquement, aucun code modifié).

---

## Incohérences trouvées

### 1. Discordance de nom de champ : `poidsOeufsPontesG` vs `poidOeufsGrammes`
**Fichiers :** Story R1-S4 vs ADR-044 §2.1 vs ADR-044 §3.3

La story R1-S4 mentionne dans la liste des champs Ponte :
> `poidsOeufsPontesG (Float?) — NOTE: ADR says poidOeufsGrammes but schema may differ`

ADR-044 §2.1 (champs à ajouter) utilise `poidOeufsGrammes Float?`.
ADR-044 §3.3 (modèle complet révisé) utilise `poidsOeufsPontesG Float?`.

Le nom canonique est donc `poidsOeufsPontesG` (§3.3 fait autorité sur §2.1 qui est la section résumée). L'implémenteur devra utiliser `poidsOeufsPontesG`.

### 2. Ambiguïté de nullabilité : `nombreDeformesRetires`
**Fichiers :** Story R1-S4 vs ADR-044 §3.6

La story R1-S4 indique : `nombreDeformesRetires (Int @default(0))`
ADR-044 §2.1 indique : `nombreDeformesRetires Int?`
ADR-044 §3.6 (modèle complet) indique : `nombreDeformesRetires Int @default(0)`

Le modèle complet (§3.6) fait autorité : utiliser `Int @default(0)` (non nullable avec valeur par défaut).

### 3. Back-relation manquante sur `Bac` pour `Reproducteur.bacId`
**Fichiers :** `prisma/schema.prisma` — modèle `Bac`

Prisma exige que chaque FK ait une back-relation de l'autre côté. `Bac` a déjà `lotGeniteurs LotGeniteurs[]` pour les FK de `LotGeniteurs.bacId`. Il faudra ajouter `reproducteurs Reproducteur[]` sur `Bac`.

### 4. Back-relation manquante sur `LotAlevins` pour `Releve.lotAlevinsId`
**Fichiers :** `prisma/schema.prisma` — modèle `LotAlevins`

L'ajout de `lotAlevinsId` sur `Releve` nécessite `releves Releve[]` sur `LotAlevins`. ADR-044 §3.6 liste bien cette relation mais elle n'existe pas encore.

---

## Risques identifiés

### RISQUE 1 — Self-relation `LotAlevins.parentLotId` : syntaxe Prisma stricte
**Impact :** Build failure si la syntaxe est incorrecte.

La self-relation requiert deux champs de relation nommés différemment et le nom de relation explicite. La syntaxe correcte est :
```prisma
parentLotId  String?
parentLot    LotAlevins?  @relation("LotSplits", fields: [parentLotId], references: [id])
sousLots     LotAlevins[] @relation("LotSplits")
```
(Confirmé par ADR-044 §3.6)

### RISQUE 2 — Dérive de schéma possible (ERR-038)
**Impact :** Migration SQL générée incluant des changements parasites.

Le schéma a évolué depuis la dernière migration deployée. Avant de générer le SQL de migration avec `migrate diff`, l'implémenteur doit inspecter le diff pour ne retenir que les colonnes de R1-S4 et écarter tout changement parasite. Voir ERR-038 dans ERRORS-AND-FIXES.md.

### RISQUE 3 — `Reproducteur.bacId` et ambiguïté de relation nommée
**Impact :** Conflit de relation si `Bac` a plusieurs relations vers `Reproducteur`.

Il n'y a qu'une seule relation `Reproducteur -> Bac` (`bacId` = bac d'hébergement), donc pas de conflit. Prisma peut nommer la relation implicitement. Pas besoin d'un nom explicite sauf si un second lien `Bac -> Reproducteur` est envisagé.

---

## Prérequis manquants

Aucun prérequis bloquant. R1-S3 est marqué DONE et tous ses modèles (`LotGeniteurs`, `Incubation`, `TraitementIncubation`) et relations back (`Ponte.lotGeniteursFemellId`, `Ponte.lotGeniteursMaleId`, `LotAlevins.incubationId`) sont présents dans le schéma.

---

## Récapitulatif des champs à ajouter par modèle

### `Reproducteur` — 9 champs
```
modeGestion       ModeGestionGeniteur  @default(INDIVIDUEL)
photo             String?
pitTag            String?
nombrePontesTotal Int                  @default(0)
dernierePonte     DateTime?
tempsReposJours   Int?
generation        GenerationGeniteur   @default(INCONNUE)
sourcing          SourcingGeniteur     @default(ACHAT_FERMIER)
bacId             String?
bac               Bac?                 @relation(fields: [bacId], references: [id])
```
+ Ajouter `@@index([bacId])` sur `Reproducteur`
+ Ajouter `reproducteurs Reproducteur[]` sur `Bac`

### `Ponte` — 17 champs
```
typeHormone        TypeHormone?
doseHormone        Float?
doseMgKg           Float?
coutHormone        Float?
heureInjection     DateTime?
temperatureEauC    Float?
latenceTheorique   Int?
heureStripping     DateTime?
poidsOeufsPontesG  Float?
nombreOeufsEstime  Int?
qualiteOeufs       QualiteOeufs?
methodeMale        MethodeExtractionMale?
motiliteSperme     MotiliteSperme?
tauxEclosion       Float?
nombreLarvesViables Int?
coutTotal          Float?
causeEchec         CauseEchecPonte?
```

### `LotAlevins` — 8 champs + 2 relations
```
phase                 PhaseLot         @default(INCUBATION)
parentLotId           String?
parentLot             LotAlevins?      @relation("LotSplits", fields: [parentLotId], references: [id])
sousLots              LotAlevins[]     @relation("LotSplits")
dateDebutPhase        DateTime         @default(now())
nombreDeformesRetires Int              @default(0)
poidsObjectifG        Float?
destinationSortie     DestinationLot?
```
+ Ajouter `@@index([parentLotId])` et `@@index([siteId, phase])` sur `LotAlevins`
+ Ajouter `releves Releve[]` sur `LotAlevins` (back-relation de Releve.lotAlevinsId)

### `Releve` — 2 champs
```
lotAlevinsId  String?
lotAlevins    LotAlevins? @relation(fields: [lotAlevinsId], references: [id])
```
+ Ajouter `@@index([lotAlevinsId])` sur `Releve`

---

## Recommandation

GO — avec les réserves suivantes à respecter lors de l'implémentation :

1. Utiliser `poidsOeufsPontesG` (pas `poidOeufsGrammes`) pour le champ pesée des oeufs de `Ponte`.
2. Utiliser `Int @default(0)` (pas `Int?`) pour `nombreDeformesRetires` sur `LotAlevins`.
3. Ajouter la back-relation `reproducteurs Reproducteur[]` sur `Bac` en même temps que `Reproducteur.bacId`.
4. Ajouter la back-relation `releves Releve[]` sur `LotAlevins` en même temps que `Releve.lotAlevinsId`.
5. Inspecter le SQL généré par `migrate diff` avant de le valider (ERR-038).
