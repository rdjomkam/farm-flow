# ADR-053 — Module Prévisions (plan d'empoissonnement, aliments, budget, trésorerie prévisionnelle)

**Statut :** Acceptée
**Date :** 2026-08-03
**Sprint :** à planifier (Phase 2, post-Sprint 12)
**Auteur :** @architect
**Réfs :** exigences fonctionnelles « Module Prévisions » (12 sections + annexes A/B, fournies par
l'utilisateur), `Previsions_Elevage_Silure_v12.xlsx` (jeu d'or), ADR-043 (modèle associatif
Bac-Vague), ADR-026 (horizon de prédiction Gompertz), ADR-049 (correctifs de données =
migrations), ADR-052 (CI, tests DB-gated), `CLAUDE.md` R1-R11.

---

## 1. Contexte

Farm-flow trace aujourd'hui exclusivement le **réel** : une vague existe à partir du moment où elle
est créée, ses relevés (biométrie, alimentation, mortalité...) sont saisis au fil de l'eau, ses
dépenses et ventes sont enregistrées après le fait. Il n'existe **aucune couche prédictive** — le
seul embryon de prévision est le calcul Gompertz de projection de poids sur une vague déjà en
cours (ADR-026), qui ne couvre ni l'empoissonnement futur, ni les besoins en aliments, ni le
budget, ni la trésorerie.

Le fichier `Previsions_Elevage_Silure_v12.xlsx`, utilisé manuellement en dehors de l'application,
répond à ce besoin pour un cas d'usage réel : planifier 19 vagues sur 21 mois (août 2026 → avril
2028), calculer le besoin en aliments granulométrie par granulométrie, budgétiser les charges
d'exploitation et suivre le point bas de trésorerie. Ce fichier a été **entièrement décodé** :
le moteur du §5 des exigences a été réimplémenté et rejoué sur les 21 mois, avec un écart nul sur
toutes les lignes sauf les points documentés en section 7 (Recette) de cet ADR.

L'objectif de ce module est de porter cette couche prédictive dans farm-flow, comme une couche
**indépendante et strictement séparée** du réel — jamais l'inverse : le réel ne doit jamais être
recalculé ni corrigé par le module Prévisions, et une prévision figée ne doit jamais être modifiée
rétroactivement par un import de configuration ultérieur.

Cet ADR acte les décisions déjà prises par l'utilisateur (section 2), documente le modèle de
données (section 3), le moteur de calcul (section 4), le mécanisme de rapprochement prévu/réel
(section 5), les permissions (section 6), le protocole de recette (section 7), les conséquences sur
l'existant (section 8), les points explicitement reportés (section 9) et les alternatives écartées
(section 10). Il ne recopie pas les exigences fonctionnelles fournies (12 sections + annexes),
disponibles séparément — il documente les décisions et les écarts par rapport à elles.

## 2. Décision

Le module Prévisions est un **moteur autonome à paramètres gelés**, découplé du domaine
opérationnel existant (`ConfigElevage`, `Produit`) au moment du calcul, relié à lui uniquement par
des FK optionnelles de rapprochement en lecture. Les dix décisions suivantes sont actées, non
renégociables dans le cadre de cet ADR :

1. **Paramètres gelés à la création.** `ScenarioPrevision` porte ses propres lignes d'aliment
   (`AlimentPrevision`), pré-remplies par **copie** depuis `Produit` à la création, puis
   **totalement découplées**. Le moteur de calcul ne lit **jamais** `ConfigElevage` ni `Produit` au
   moment du calcul — seulement les tables du module. Raison : la recette exige de rejouer le jeu
   d'or à 1 FCFA près (section 7), et l'exigence §4.1 interdit explicitement de modifier
   rétroactivement une prévision déjà figée si le catalogue produit change ensuite. Une FK
   `produitId?` optionnelle sur `AlimentPrevision` sert uniquement au rapprochement prévu/réel
   (section 5), jamais à la lecture du prix ou de la composition au moment du calcul.

2. **Relation 1↔1 optionnelle entre `Vague` et `VaguePrevue`.** `Vague.vaguePrevueId String?
   @unique` — une vague réelle sans prévision reste autorisée (`null`), c'est **obligatoire** :
   les vagues déjà en production n'ont et n'auront jamais de prévision à référencer, et aucune
   migration ne peut leur en inventer une rétroactivement. Symétriquement, une `VaguePrevue` sans
   vague réelle associée signifie « non réalisée » (planifiée puis abandonnée ou pas encore
   démarrée). **Conséquence UI obligatoire, pas seulement une note de bas de page :** si le terrain
   éclate une prévision en deux vagues réelles (un lot d'alevins livré en deux temps, deux bacs
   stockés à des dates différentes), la création de la deuxième `Vague` liée à la même
   `VaguePrevue` est **rejetée par la contrainte d'unicité**. L'UI doit alors proposer, au moment
   de ce rejet, un flux explicite de **scission** de la `VaguePrevue` dans le plan (ex. `V7` →
   `V7a` + `V7b`, matérialisé par `VaguePrevue.vaguePrevueParentId` en auto-relation) — sans ce flux,
   l'utilisateur est bloqué sans issue lisible, ce qui est inacceptable. La suppression d'une
   `VaguePrevue` rattachée à une vague réelle (`vagueId` non nul côté `Vague`) est **interdite** ;
   le statut passe à `ANNULEE` à la place.

3. **Durée de cycle paramétrable au niveau du scénario, uniforme pour toutes ses vagues**, défaut 3
   mois (`ScenarioPrevision.dureeCycleMois`). Le moteur boucle sur `k = 1..dureeCycleMois` dès le
   départ — jamais 3 colonnes en dur comme dans le classeur Excel. La répartition mensuelle de
   chaque granulométrie est une **table** (`RepartitionMoisAliment`, une ligne par mois du cycle),
   pas des colonnes fixes. La somme des pourcentages sur les `dureeCycleMois` lignes d'un
   `AlimentPrevision` donné doit valoir 100 % — validation **bloquante à l'enregistrement**, portée
   par l'application (une contrainte `CHECK` SQL portant sur un agrégat multi-lignes n'est pas
   exprimable proprement en Postgres sans trigger ; le choix est documenté en section 3.5).

4. **Pas de taux de survie explicite au MVP.** La mortalité reste absorbée par la marge de sécurité
   sur les alevins (`ParametresPrevision.margeSecuriteAlevinsPct`), exactement comme le modèle
   Excel. Un taux de survie explicite par mois de cycle est reporté en Phase 3 (section 9).

5. **`Decimal` pour toutes les nouvelles tables du module Prévisions**, alors que le domaine
   opérationnel existant (`Vente.montantTotal`, `Depense.montantTotal`, `Produit.prixUnitaire`...)
   est en `Float`. C'est une **exception assumée**, pas un changement de convention pour le domaine
   existant : le domaine ferme n'est **pas migré**. Justification : la recette (section 7) exige
   une tolérance ≤ 1 FCFA sur des cascades de calculs à plusieurs étages (sacs → kg → coût → base
   de répartition → quote-part → trésorerie cumulée sur 21 mois) où l'accumulation d'erreurs
   d'arrondi en virgule flottante binaire (`Float`/IEEE 754) romprait cette tolérance sur les
   derniers mois de la projection. Un précédent existe déjà dans le dépôt : la couche
   abonnements/commissions/portefeuille (`Plan.prixMensuel`, `Portefeuille.solde`,
   `CommissionIngenieur.montant`...) est déjà en `Decimal` pour une raison analogue (argent réel,
   cascade de calculs). Le module Prévisions suit ce précédent, pas une nouveauté.

6. **Correction du §5.7 des exigences fonctionnelles — actée ici, pas rediscutée.** La quote-part
   de charges par vague doit se calculer sur `base_repartition` (logistique + charges d'exploitation
   + journal opérationnel **GÉNÉRAL**, c'est-à-dire non affecté nominativement à une vague), et
   **non** sur `charges_operationnelles` (= base + journal opérationnel **AFFECTÉ**) comme l'écrivent
   les exigences fonctionnelles au §5.7. Réintégrer dans la clé de répartition un montant déjà
   affecté nominativement à une vague spécifique (`JournalDepensePrevue.vaguePrevueId` non nul)
   compterait ce montant deux fois : une fois en charge directe de cette vague, une fois de plus
   dilué dans la quote-part de toutes les vagues actives. C'est d'ailleurs le comportement du
   classeur Excel lui-même : `Aliment par vague!T4:V4` pointe vers `Dépenses!ligne 31` (base, sans
   le journal affecté), pas vers la ligne 32 (base + journal affecté) — le fichier de référence
   applique déjà la version correcte, seul le texte des exigences la retranscrit à l'envers. Le
   moteur (section 4) implémente la version du fichier, pas celle du texte.

## 3. Modèle de données

Tous les nouveaux modèles respectent R1 (enums UPPERCASE), R7 (nullabilité explicite — chaque
champ ci-dessous est commenté quant à sa nullabilité), R8 (`siteId` sur chaque modèle). Le pattern
d'unicité composite des entités numérotées (`@@unique([siteId, code])`, cf. `Depense`, `Vente`,
`Facture`, `Commande`) est repris pour `ScenarioPrevision` et `VaguePrevue` — **délibérément pas**
le `@unique` global de `Vague.code`, signalé en section 8.2 comme une incohérence existante non
corrigée par cet ADR.

### 3.1 Nouveaux enums

```prisma
enum StatutScenarioPrevision {
  BROUILLON   // en cours de paramétrage, éditable sans restriction
  ACTIF       // publié, sert de référence pour le rapprochement — édition restreinte (4.3)
  ARCHIVE     // remplacé par un scénario plus récent, conservé en lecture seule
}

enum StatutVaguePrevue {
  PLANIFIEE     // pas encore de vague réelle liée
  EN_COURS      // vagueId renseigné, vague réelle non clôturée
  REALISEE      // vagueId renseigné, vague réelle clôturée
  NON_REALISEE  // le plan est passé, aucune vague réelle n'a jamais été liée
  ANNULEE       // scission ou abandon explicite — jamais une suppression physique
}

enum TypePostePrevision {
  LOGISTIQUE           // ex. transport des alevins, transport aliments — entre dans base_repartition
  CHARGE_EXPLOITATION  // ex. électricité, salaires — entre dans base_repartition
}

enum CategorieJournalPrevu {
  OPERATIONNEL     // dépense récurrente/ponctuelle d'exploitation — entre dans base_repartition SI non affectée
  INVESTISSEMENT   // hors base_repartition, jamais quote-partée (cf. décision 6)
}

enum TypeApportCapital {
  CAPITAL   // apport propre
  CREDIT    // emprunt encaissé — un crédit reçu est un apport de trésorerie, son remboursement
            // futur est une sortie (cf. point ouvert 9.3), jamais un investissement
}

enum SourceRapprochement {
  DEPENSE_CATEGORIE     // CategorieDepense réelle
  PRODUIT_CATEGORIE     // CategorieProduit réelle
  VENTE                 // Vente réelle (agrégat mensuel)
  MOUVEMENT_STOCK       // MouvementStock réel (agrégat mensuel)
}

enum CibleRapprochement {
  POSTE_PREVISION       // vers PostePrevision
  ALIMENT_PREVISION     // vers AlimentPrevision
  VENTE_PREVUE          // vers le revenu prévu (ParametresPrevision.prixVenteKgFCFA)
  NON_RAPPROCHE         // bac explicite — jamais un silence (section 5)
}
```

### 3.2 `ScenarioPrevision`

```prisma
model ScenarioPrevision {
  id                String                  @id @default(cuid())
  code              String                  // ex. "PLAN-2026-08" — numéroté, PAS unique global
  nom               String
  description       String?                 // nullable : libre
  dureeCycleMois    Int                     @default(3)
  dateDebutPlan     DateTime                // premier mois du plan (mois 0 de tous les calculs relatifs)
  statut            StatutScenarioPrevision @default(BROUILLON)
  userId            String                  // créateur — NOT NULL, jamais anonyme
  user              User                    @relation(fields: [userId], references: [id])
  siteId            String
  site              Site                    @relation(fields: [siteId], references: [id])

  parametres        ParametresPrevision?
  paliersRemise     PalierRemise[]
  aliments          AlimentPrevision[]
  vaguesPrevues     VaguePrevue[]
  postes            PostePrevision[]
  chargesMensuelles ChargeMensuellePrevue[]
  journal           JournalDepensePrevue[]
  apports           ApportCapital[]
  clotures          ClotureMois[]

  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt

  @@unique([siteId, code])
  @@index([siteId])
  @@index([siteId, statut])
}
```

### 3.3 `ParametresPrevision` (1-1 avec le scénario)

```prisma
model ParametresPrevision {
  id                          String            @id @default(cuid())
  scenarioId                  String            @unique
  scenario                    ScenarioPrevision @relation(fields: [scenarioId], references: [id], onDelete: Cascade)

  effectifAlevinsParVague     Int               // nombre d'alevins stockés par vague planifiée
  margeSecuriteAlevinsPct     Decimal           // absorbe la mortalité — décision 4
  poidsMoyenInitialG          Decimal
  poidsObjectifG              Decimal
  prixAlevinUnitaireFCFA      Decimal
  /**
   * Prix de vente au kg prévisionnel — comble le gap dashboard.ts:218
   * (voir section 8.1). Nullable au niveau applicatif tant que le
   * scénario est BROUILLON serait envisageable, mais R7 impose une
   * décision explicite ici : NOT NULL, avec une valeur par défaut
   * proposée à la création (copiée depuis le dernier scénario ACTIF
   * du site s'il existe, sinon saisie obligatoire) — jamais de calcul
   * de revenu prévisionnel silencieusement basé sur un null.
   */
  prixVenteKgFCFA             Decimal
  nombreBacsSimultanesCible   Int               // capacité de rotation ciblée, purement paramétrique —
                                                 // ne référence AUCUN Bac réel (cf. section 4, note découplage)
  frequenceStockageMois       Decimal           // espacement entre deux stockages successifs (peut être < 1 mois)

  createdAt                   DateTime          @default(now())
  updatedAt                   DateTime          @updatedAt
}
```

### 3.4 `PalierRemise`

```prisma
model PalierRemise {
  id               String            @id @default(cuid())
  scenarioId       String
  scenario         ScenarioPrevision @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  seuilSacs        Decimal           // quantité de sacs à partir de laquelle le palier s'applique
  pourcentageRemise Decimal
  ordre            Int               // ordre d'évaluation explicite — jamais déduit d'un tri implicite sur seuilSacs
  siteId           String
  site             Site              @relation(fields: [siteId], references: [id])

  @@index([scenarioId])
  @@index([siteId])
}
```

### 3.5 `AlimentPrevision` et `RepartitionMoisAliment`

```prisma
model AlimentPrevision {
  id             String                  @id @default(cuid())
  scenarioId     String
  scenario       ScenarioPrevision       @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  /**
   * Rapprochement uniquement — jamais lu par le moteur de calcul (décision 1).
   * Nullable : un aliment prévisionnel peut ne correspondre à aucun produit
   * réel du catalogue (ex. produit pas encore créé, ou scénario prospectif).
   */
  produitId      String?
  produit        Produit?                @relation(fields: [produitId], references: [id], onDelete: SetNull)
  libelle        String                  // copié depuis Produit.nom à la création, puis libre
  tailleGranule  TailleGranule?          // copié depuis Produit.tailleGranule à la création
  poidsSacKg     Decimal                 // copié depuis Produit.contenance à la création
  prixSacFCFA    Decimal                 // copié depuis Produit.prixUnitaire à la création
  sacsParTonne   Decimal                 // dérivable de poidsSacKg, mais stocké et gelé (décision 1 :
                                          // aucun recalcul depuis une formule qui lirait le catalogue)
  ordre          Int                     // ordre d'affichage / d'application dans le cycle
  siteId         String
  site           Site                    @relation(fields: [siteId], references: [id])

  repartitions   RepartitionMoisAliment[]

  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt

  @@index([scenarioId])
  @@index([siteId])
  @@index([produitId])
}

model RepartitionMoisAliment {
  id                 String           @id @default(cuid())
  alimentPrevisionId String
  alimentPrevision   AlimentPrevision @relation(fields: [alimentPrevisionId], references: [id], onDelete: Cascade)
  moisCycle          Int              // 1..scenario.dureeCycleMois — jamais un index 0-based, pour lisibilité UI
  pourcentage        Decimal          // somme des pourcentages sur toutes les lignes d'un AlimentPrevision = 100,
                                       // vérifiée par l'application à l'enregistrement (voir note ci-dessous)
  siteId             String
  site               Site             @relation(fields: [siteId], references: [id])

  @@unique([alimentPrevisionId, moisCycle])
  @@index([siteId])
}
```

**Note sur la validation « somme = 100 % ».** Une contrainte SQL native portant sur l'agrégat de
plusieurs lignes (`SUM(pourcentage) OVER (PARTITION BY alimentPrevisionId) = 100`) n'est pas
exprimable par un `CHECK` de colonne en Postgres (un `CHECK` ne voit qu'une ligne à la fois) et
nécessiterait soit un trigger `AFTER INSERT OR UPDATE OR DELETE`, soit une contrainte différée en
fin de transaction. Le coût de maintenance d'un trigger pour une règle qui n'a de sens qu'au moment
de l'écriture applicative (formulaire multi-lignes, un seul appel API qui remplace l'ensemble des
`RepartitionMoisAliment` d'un `AlimentPrevision` en une transaction) est jugé disproportionné :
la validation vit dans la couche API (`src/lib/previsions/validation.ts`), bloquante avant tout
`prisma.repartitionMoisAliment.createMany`/`updateMany`, dans la même transaction que l'écriture.
Ce choix est cohérent avec R4 (opérations atomiques) : la validation et l'écriture sont dans la
même transaction Prisma, pas une vérification préalable suivie d'une écriture non protégée.

### 3.6 `VaguePrevue` et `AlimentParVaguePrevue`

```prisma
model VaguePrevue {
  id                    String            @id @default(cuid())
  scenarioId            String
  scenario              ScenarioPrevision @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  code                  String            // ex. "V7", "V7a" — numéroté au sein du scénario
  dateStockagePrevue    DateTime
  effectifAlevinsPrevu  Int               // copié depuis ParametresPrevision à la création, éditable ensuite
                                           // (une VaguePrevue individuelle peut diverger du paramètre par défaut)
  poidsMoyenInitialG    Decimal
  dureeCycleMoisFigee   Int               // copie gelée de scenario.dureeCycleMois au moment de la création —
                                           // un changement ultérieur de la durée de cycle du scénario n'affecte
                                           // JAMAIS une VaguePrevue déjà créée (décision 1, §4.1 des exigences)
  statut                StatutVaguePrevue @default(PLANIFIEE)
  /**
   * Auto-relation — matérialise une scission (décision 2). Null pour une
   * VaguePrevue d'origine, renseigné pour V7a/V7b issues d'une scission de V7.
   */
  vaguePrevueParentId   String?
  vaguePrevueParent     VaguePrevue?      @relation("ScissionVaguePrevue", fields: [vaguePrevueParentId], references: [id], onDelete: SetNull)
  enfantsScission        VaguePrevue[]     @relation("ScissionVaguePrevue")
  siteId                String
  site                  Site              @relation(fields: [siteId], references: [id])

  vague                 Vague?            // relation inverse du champ Vague.vaguePrevueId (3.7)
  alimentsParMois        AlimentParVaguePrevue[]

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@unique([scenarioId, code])
  @@index([siteId])
  @@index([scenarioId, statut])
}

model AlimentParVaguePrevue {
  id                 String           @id @default(cuid())
  vaguePrevueId      String
  vaguePrevue        VaguePrevue      @relation(fields: [vaguePrevueId], references: [id], onDelete: Cascade)
  alimentPrevisionId String
  alimentPrevision   AlimentPrevision @relation(fields: [alimentPrevisionId], references: [id], onDelete: Restrict)
  moisCycle          Int              // 1..dureeCycleMoisFigee de la VaguePrevue parente
  sacsCalcules       Decimal          // sortie pure du moteur (section 4) — jamais éditée directement
  /**
   * Surcharge manuelle. Null = utiliser sacsCalcules. Non-null = l'utilisateur
   * a ajusté le besoin réel constaté sur le terrain sans passer par un
   * recalcul complet du scénario. Tous les calculs downstream (coût, budget,
   * trésorerie) utilisent COALESCE(sacsSaisis, sacsCalcules) — jamais
   * sacsCalcules seul une fois qu'une surcharge existe.
   */
  sacsSaisis         Decimal?
  quantiteKgCalculee Decimal
  coutCalculeFCFA    Decimal          // après application des PalierRemise
  siteId             String
  site               Site             @relation(fields: [siteId], references: [id])

  @@unique([vaguePrevueId, alimentPrevisionId, moisCycle])
  @@index([siteId])
  @@index([vaguePrevueId])
}
```

### 3.7 Modification de `Vague`

```prisma
model Vague {
  // ... champs existants inchangés ...
  vaguePrevueId String?      @unique
  vaguePrevue   VaguePrevue? @relation(fields: [vaguePrevueId], references: [id], onDelete: SetNull)
}
```

`onDelete: SetNull` plutôt que `Restrict` : si une `VaguePrevue` est un jour supprimée (cas
théorique — en pratique interdit par la décision 2 tant qu'une `Vague` y est rattachée, donc ce
`onDelete` ne devrait jamais se déclencher en pratique ; il protège contre un chemin de suppression
non prévu plutôt que de bloquer la base sur une contrainte qui contredirait la règle applicative).

### 3.8 `PostePrevision`, `ChargeMensuellePrevue`, `JournalDepensePrevue`, `ApportCapital`

```prisma
model PostePrevision {
  id                     String              @id @default(cuid())
  scenarioId             String
  scenario               ScenarioPrevision   @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  libelle                String              // référentiel paramétrable — PAS un enum codé en dur
                                              // (le classeur Excel a fait évoluer ses lignes de dépenses
                                              // d'une version à l'autre ; coder les postes en enum aurait
                                              // exigé une migration de schéma à chaque ligne ajoutée)
  type                   TypePostePrevision  // LOGISTIQUE | CHARGE_EXPLOITATION
  /**
   * Inclus dans base_repartition (décision 6) — vrai pour la quasi-totalité
   * des postes de logistique/exploitation. Un poste peut être exclu
   * explicitement (ex. un poste exceptionnel qu'on veut suivre sans qu'il
   * dilue la quote-part de toutes les vagues).
   */
  inclusBaseRepartition  Boolean             @default(true)
  ordre                  Int
  siteId                 String
  site                   Site                @relation(fields: [siteId], references: [id])

  chargesMensuelles      ChargeMensuellePrevue[]

  @@unique([scenarioId, libelle])
  @@index([siteId])
}

model ChargeMensuellePrevue {
  id           String            @id @default(cuid())
  scenarioId   String
  scenario     ScenarioPrevision @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  posteId      String
  poste        PostePrevision    @relation(fields: [posteId], references: [id], onDelete: Cascade)
  moisAbsolu   Int               // 0-based depuis scenario.dateDebutPlan (mois 0 = dateDebutPlan)
  montantFCFA  Decimal
  siteId       String
  site         Site              @relation(fields: [siteId], references: [id])

  @@unique([posteId, moisAbsolu])
  @@index([siteId])
  @@index([scenarioId, moisAbsolu])
}

model JournalDepensePrevue {
  id             String                @id @default(cuid())
  scenarioId     String
  scenario       ScenarioPrevision     @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  date           DateTime
  libelle        String
  categorie      CategorieJournalPrevu // OPERATIONNEL | INVESTISSEMENT
  montantFCFA    Decimal
  /**
   * Affectation nominative à une vague planifiée précise. Null = dépense
   * générale du plan (entre dans base_repartition si categorie=OPERATIONNEL
   * et poste associé inclusBaseRepartition=true — décision 6). Non-null =
   * déjà affectée à cette vague, EXCLUE de base_repartition pour éviter le
   * double comptage (décision 6).
   */
  vaguePrevueId  String?
  vaguePrevue    VaguePrevue?          @relation(fields: [vaguePrevueId], references: [id], onDelete: SetNull)
  siteId         String
  site           Site                  @relation(fields: [siteId], references: [id])

  @@index([siteId])
  @@index([scenarioId, date])
  @@index([vaguePrevueId])
}

model ApportCapital {
  id           String            @id @default(cuid())
  scenarioId   String
  scenario     ScenarioPrevision @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  date         DateTime
  libelle      String
  montantFCFA  Decimal
  type         TypeApportCapital // CAPITAL | CREDIT — un crédit encaissé est un apport de
                                  // trésorerie, jamais un investissement (cf. bug classeur, §7)
  siteId       String
  site         Site              @relation(fields: [siteId], references: [id])

  @@index([siteId])
  @@index([scenarioId, date])
}
```

### 3.9 `MappingRapprochement` (versionné)

```prisma
model MappingRapprochement {
  id            String              @id @default(cuid())
  siteId        String              // rapprochement scopé au site, PAS au scénario — un mapping
                                     // sert potentiellement plusieurs scénarios successifs du même site
  site          Site                @relation(fields: [siteId], references: [id])
  version       Int                 // incrémenté à chaque changement de mapping — jamais un UPDATE
                                     // en place d'une ligne active, pour préserver l'auditabilité d'un
                                     // rapprochement passé même si le mapping change ensuite
  sourceType    SourceRapprochement
  sourceCle     String              // valeur littérale de l'enum réel (ex. "ALIMENT" pour CategorieDepense)
  cibleType     CibleRapprochement
  cibleId       String?             // nullable : NON_RAPPROCHE n'a pas de cible (section 5)
  actif         Boolean             @default(true)
  createdAt     DateTime            @default(now())

  @@unique([siteId, version, sourceType, sourceCle])
  @@index([siteId, actif])
}
```

### 3.10 `ClotureMois`

```prisma
model ClotureMois {
  id            String            @id @default(cuid())
  scenarioId    String
  scenario      ScenarioPrevision @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  moisAbsolu    Int               // même référentiel que ChargeMensuellePrevue.moisAbsolu
  clotureeParId String
  clotureePar   User              @relation(fields: [clotureeParId], references: [id])
  dateCloture   DateTime          @default(now())
  siteId        String
  site          Site              @relation(fields: [siteId], references: [id])

  @@unique([scenarioId, moisAbsolu])
  @@index([siteId])
}
```

Un mois clôturé verrouille, côté API, toute écriture de rapprochement (section 5) portant sur ce
mois pour ce scénario — la clôture est une décision humaine explicite (« ce mois est arrêté, le
rapprochement ne bougera plus »), jamais déduite implicitement d'une date passée.

## 4. Moteur de calcul

Le moteur vit exclusivement dans `src/lib/previsions/`, en fonctions **pures, sans I/O** (pas de
`prisma.*` à l'intérieur — les données sont chargées en amont par la couche API/queries et passées
en argument, résultat retourné en valeur, jamais écrit directement). Ce découplage est ce qui rend
le moteur testable par simple comparaison de sorties contre le jeu d'or (section 7), sans base de
données dans la boucle de test unitaire.

Une fonction par règle du §5 des exigences fonctionnelles, à titre indicatif (noms définitifs à
la discrétion de @developer, signatures et comportement figés par cet ADR) :

| Fonction | Rôle |
|---|---|
| `genererPlanEmpoissonnement(parametres, dureeCycleMois, frequenceStockageMois, horizonMois)` | Produit la liste théorique des `VaguePrevue` (dates de stockage) sur l'horizon du plan |
| `calculerBesoinAlimentMensuel(vaguePrevue, aliments, moisCycle)` | kg puis sacs nécessaires pour une granulométrie donnée, un mois de cycle donné |
| `appliquerPalierRemise(sacs, paliers)` | Coût réel après remise de volume — paliers évalués dans l'ordre explicite (`PalierRemise.ordre`) |
| `calculerCoutAlimentVague(vaguePrevue, alimentsParVague)` | Somme des coûts aliment d'une vague sur tout son cycle, en respectant `COALESCE(sacsSaisis, sacsCalcules)` |
| `calculerChargesMensuelles(postes, chargesMensuelles, moisAbsolu)` | Total des charges d'un mois, par poste |
| `calculerBaseRepartition(chargesLogistiqueEtExploitation, journalOperationnelGeneral)` | **Implémente la décision 6** — exclut explicitement le journal affecté nominativement |
| `calculerQuotePartVague(baseRepartitionMois, vaguesActivesCeMois)` | Répartition de la base sur les vagues actives d'un mois donné |
| `calculerCoutProductionVague(coutAliment, coutAlevins, quotePartCharges)` | Coût de production complet d'une vague prévue |
| `calculerRevenuPrevu(effectifFinal, poidsObjectif, prixVenteKgFCFA)` | Revenu prévisionnel — consomme `ParametresPrevision.prixVenteKgFCFA` (section 8.1) |
| `calculerTresorerieMensuelle(revenusMois, depensesMois, apportsMois, soldeMoisPrecedent)` | Trésorerie cumulée mois par mois |
| `calculerPointBasTresorerie(serieTresorerieMensuelle)` | Minimum de la série et le mois où il survient — condition d'exercice du besoin de financement (§7.2) |
| `calculerBudgetTotalPlan(scenario)` | Agrégat toutes vagues, tous postes, tout l'horizon |

**Ce que le moteur ne fait jamais :**
- Lire `ConfigElevage` ou `Produit` (décision 1).
- Écrire dans une table réelle (`Vague`, `Depense`, `Vente`, `MouvementStock`...) — le moteur ne
  produit que des lignes de tables `*Prevision`/`*Prevue`/`*Prevu`.
- Recalculer un scénario `ACTIF` en place suite à un changement de `ParametresPrevision` ou
  `ScenarioPrevision.dureeCycleMois` : ces changements ne s'appliquent qu'aux `VaguePrevue`
  **futures**, jamais aux `VaguePrevue` déjà créées, dont `dureeCycleMoisFigee` et les valeurs
  copiées à la création restent figées (décision 1, §4.1 des exigences). Un recalcul global
  volontaire est une action explicite et distincte (« dupliquer le scénario », pas « éditer en
  place »), hors périmètre du MVP.

**Typage numérique :** toutes les fonctions du moteur opèrent sur `Decimal` (`decimal.js` — voir
section 7 pour le statut exact de cette dépendance, à déclarer explicitement) — jamais `number` pour un
montant, un poids en kg ou un nombre de sacs fractionnaire. Un entier strict (nombre de poissons,
nombre de sacs arrondi pour achat, nombre de voyages) reste un `number`/`Int` — la conversion
`Decimal → Int` (arrondi) n'intervient qu'au point de sortie destiné à l'achat réel (ex. nombre de
sacs à commander), jamais en cours de cascade de calcul.

**Découplage des bacs réels.** `ParametresPrevision.nombreBacsSimultanesCible` est un entier
purement paramétrique (« combien de bacs je compte faire tourner en parallèle »). Le module
Prévisions ne référence **aucun** `Bac.id` ni `AssignationBac` réel (ADR-043) — une `VaguePrevue`
ne réserve pas de bac physique. C'est un choix délibéré de simplicité pour le MVP : le
rapprochement entre capacité prévue et bacs physiquement disponibles reste un calcul manuel de
l'utilisateur, pas une contrainte vérifiée par le système. Un futur sprint pourrait vouloir lier
`VaguePrevue` à des `Bac` candidats à titre indicatif — hors périmètre de cet ADR.

## 5. Rapprochement prévu-réel

Le rapprochement est **strictement en sens unique** : le module Prévisions **lit** les données
réelles (`Depense`, `Vente`, `MouvementStock`, agrégées par catégorie et par mois) pour les
comparer aux lignes prévues — il n'écrit **jamais** dans ces tables ni dans aucune table du domaine
réel. Aucune fonction de rapprochement n'appelle `prisma.depense.update`, `prisma.vente.create`, ou
équivalent.

`MappingRapprochement` (section 3.9) porte la correspondance administrable entre une clé réelle
(`CategorieDepense`, `CategorieProduit`, agrégat de `Vente`, agrégat de `MouvementStock`) et une
cible du module Prévisions (`PostePrevision`, `AlimentPrevision`, ou le revenu prévu). Le mapping
est **versionné** (`version Int`, jamais un `UPDATE` en place d'une ligne active) pour qu'un
rapprochement déjà affiché pour un mois passé reste explicable même si le mapping évolue ensuite —
cohérent avec l'esprit de traçabilité de R10/ADR-049, bien que ce ne soit pas un correctif de
données au sens de cette règle (aucune ligne réelle n'est jamais modifiée).

**Toute catégorie réelle non mappée** (`CategorieDepense`/`CategorieProduit` rencontrée dans les
données réelles du site sans entrée `MappingRapprochement` active correspondante) est affichée dans
un bac explicite **« Non rapproché »** (`CibleRapprochement.NON_RAPPROCHE`) — jamais ignorée
silencieusement. C'est la garantie centrale de cette section : un écart entre prévu et réel qui
provient d'un mapping incomplet doit être **visible comme un problème de mapping**, jamais confondu
avec un écart budgétaire réel.

### 5.1 Le §10 des exigences (« Intégration avec l'outil de ferme existant ») devient sans objet

Le §10 des exigences fonctionnelles part d'une hypothèse de déploiement différente de celle
retenue ici : il suppose que le module de prévision vit **à côté** de l'outil de ferme, comme un
système distinct. Il prescrit en conséquence tout un appareillage d'intégration : lecture du réel
via API ou base partagée, synchronisation au moins quotidienne, rafraîchissement manuel,
identifiant stable par transaction pour garantir l'idempotence des resynchronisations, table de
correspondance manuelle des lots.

**Ce n'est pas l'architecture retenue.** Le module Prévisions vit **dans** farm-flow, sur la même
base Postgres, dans le même schéma Prisma, dans le même processus applicatif que le réel. Le réel
est à une jointure Prisma de distance, pas à une synchronisation entre deux systèmes. **Conséquence
directe : la quasi-totalité du §10 devient sans objet**, pas seulement simplifiée :

- **Pas de job de synchronisation** — le rapprochement (ci-dessus) est une requête exécutée à la
  demande, pas un import périodique.
- **Pas de fenêtre de fraîcheur** — il n'existe pas de délai entre « une dépense est enregistrée
  dans farm-flow » et « elle est visible dans le rapprochement » : c'est la même base, lue en
  temps réel.
- **Pas de risque de doublon d'import**, donc **pas de clé d'idempotence à concevoir** — il n'y a
  jamais d'écriture issue d'une resynchronisation (section 5, sens unique strict) : rien n'est
  jamais importé, donc rien ne peut être importé deux fois.
- **Pas de table de correspondance manuelle des lots** — la relation 1↔1 `Vague.vaguePrevueId`
  (décision 2) la remplace nativement : la correspondance entre une vague prévue et sa réalisation
  est une FK typée et contrainte par la base, pas un rapprochement manuel a posteriori entre deux
  identifiants d'origines différentes.

**Ce qui subsiste malgré tout du §10 — pas rien :**

- **(a) Le sens unique reste une règle stricte**, mais elle change de nature : ce n'est plus une
  question d'architecture de synchronisation (empêcher un système externe d'écrire dans farm-flow),
  c'est une **discipline de code interne à faire respecter par revue** — le module Prévisions ne
  doit jamais appeler une écriture (`create`/`update`/`delete`) sur `Depense`, `Vente`,
  `MouvementStock`, ni aucune autre table du domaine réel. C'est la même garantie que le §10
  visait, portée par un mécanisme différent (revue de code + séparation des modules dans
  `src/lib/previsions/`, pas un pare-feu réseau entre deux systèmes).
- **(b) La fraîcheur devient un non-sujet technique, mais reste un sujet d'affichage.** Puisque le
  rapprochement lit toujours l'état courant de la base, l'UI ne doit **jamais laisser croire à une
  photo figée d'un import passé** — un utilisateur habitué à d'autres outils qui synchronisent
  périodiquement pourrait supposer, à tort, que les chiffres affichés datent d'un rafraîchissement
  antérieur. La page de rapprochement (section 6, `/previsions/rapprochement`) doit indiquer
  explicitement que les chiffres réels affichés sont ceux de l'instant de la requête.

C'est un allègement significatif du périmètre d'implémentation : aucun des livrables attendus par
le §10 (job planifié, endpoint de synchronisation, mécanisme d'idempotence par identifiant de
transaction, écran de correspondance manuelle des lots) n'a de raison d'être construit.

## 6. Sécurité et permissions

Nouvelles valeurs `Permission` (ajoutées à l'enum existant, respectant R1) :

```prisma
enum Permission {
  // ... valeurs existantes inchangées ...
  PREVISIONS_VOIR
  PREVISIONS_GERER
  PREVISIONS_PARAMETRER
  PREVISIONS_CLOTURER
}
```

Nouvelle valeur `SiteModule` :

```prisma
enum SiteModule {
  // ... valeurs existantes inchangées ...
  PREVISIONS
}
```

Rôles (repris des exigences §9, actés ici) :

| Rôle | Permissions |
|---|---|
| Lecteur | `PREVISIONS_VOIR` |
| Gestionnaire | `PREVISIONS_VOIR`, `PREVISIONS_GERER` (créer/éditer scénarios, vagues prévues, saisir surcharges `sacsSaisis`, saisir le journal) |
| Administrateur | + `PREVISIONS_PARAMETRER` (éditer `ParametresPrevision`, `PostePrevision`, `MappingRapprochement`), + `PREVISIONS_CLOTURER` (`ClotureMois`) |

Entrée `MODULE_NAV` (`src/lib/module-nav-items.ts`), suivant le patron des modules existants :

```typescript
{
  label: "Prévisions",
  matchPaths: ["/previsions"],
  items: [
    { href: "/previsions", label: "Dashboard", itemKey: "dashboard", icon: LayoutDashboard },
    { href: "/previsions/scenarios", label: "Scénarios", itemKey: "scenarios", icon: FileText },
    { href: "/previsions/plan", label: "Plan empoissonnement", itemKey: "plan", icon: Waves },
    { href: "/previsions/aliments", label: "Aliments", itemKey: "aliments", icon: Package },
    { href: "/previsions/charges", label: "Charges", itemKey: "charges", icon: Wallet },
    { href: "/previsions/tresorerie", label: "Trésorerie", itemKey: "tresorerie", icon: Banknote },
    { href: "/previsions/rapprochement", label: "Rapprochement", itemKey: "rapprochement", icon: ArrowUpDown },
  ],
},
```

Chaque route API du module vérifie la permission correspondante avant toute lecture/écriture,
suivant le pattern déjà en place dans `src/app/api/vagues/route.ts` (R8 : filtre `siteId` sur
chaque requête, en plus du filtre de permission).

## 7. Recette

**Jeu d'or : le fichier `Previsions_Elevage_Silure_v12.xlsx`, bug `Dépenses!B10` corrigé.**
`B10` (Transport des alevins, août 2026) contient un `0` en dur qui écrase la formule
`=B9*Paramètres!$B$30`, alors que le nombre de voyages (`B9`) est correct. Le montant attendu est
30 000 FCFA, qui se propage jusqu'à la trésorerie finale. **Décision : le moteur applique la
formule partout** (aucune exception pour ce mois) ; les fixtures de recette sont patchées sur cette
seule cellule, avec un commentaire explicite renvoyant à cet ADR.

Fixtures JSON versionnées dans le dépôt, à côté du classeur source (ex.
`prisma/fixtures/previsions/plan-v12-corrige.json`, `prisma/fixtures/previsions/annexe-b-corrigee.json`,
avec `Previsions_Elevage_Silure_v12.xlsx` conservé en référence dans le même dossier).

**Tolérance :**
- **0** sur tout entier (sacs, voyages, poissons, alevins).
- **≤ 1 FCFA** sur tout montant.

**Deux scénarios de recette obligatoires, pas un :**

1. **Le plan v12 complet** (avec apports en capital et investissements) — trajectoire de
   trésorerie qui ne descend jamais sous zéro.
2. **La variante « annexe B corrigée »**, sans apports ni investissements — c'est le **seul** jeu
   de données qui fait passer la trésorerie sous zéro et qui exerce donc réellement la logique
   « point bas / besoin de financement » du §7.2. Sans ce second scénario, `calculerPointBasTresorerie`
   ne serait jamais testé sur son cas nominal (un point bas négatif).

**Écart annexe B / fichier v12 — republication de l'annexe corrigée.** L'annexe B des exigences ne
décrit pas le fichier v12 : celui-ci a gagné après coup 30 000 000 FCFA d'apports en capital et
34 400 000 FCFA d'investissements, absents de l'annexe. Chiffres :

| Indicateur | Annexe B (exigences) | Fichier v12 | Annexe B **corrigée** (ce qu'exécute la recette) |
|---|---|---|---|
| Dépenses totales (FCFA) | 308 129 600 | 342 529 600 | **308 159 600** |
| Résultat cumulé (FCFA) | 149 770 400 | 145 370 400 | **149 740 400** |
| Point bas de trésorerie (FCFA) | −6 304 704 | +2 306 600 | **−6 334 704**, en **novembre 2026** |
| Besoin max en aliments (kg) | 17 100 | 17 100 | **17 100** (inchangé au kg près) |

Les écarts de 30 000 FCFA entre l'annexe B originale et l'annexe B corrigée correspondent
exactement au bug `B10` (décision de correction ci-dessus, appliqué de façon cohérente aux deux
scénarios de recette). L'annexe B originale est conservée en note dans les fixtures avec cette
explication — elle n'est **plus** un jeu de données de recette valide, elle documente uniquement
l'écart et sa cause.

**Cinq montants exclus du jeu d'or automatique — re-saisie nécessaire, pas un bug de portage.** Le
lien Journal → Dépenses est cassé dans le classeur lui-même : le journal ne contient que 2 lignes
d'exemple à 0, pourtant `Dépenses!ligne 28` porte 5 000 000 / 5 000 000 / 4 000 000 / 4 000 000 FCFA
en dur (écrasant les `SUMIFS` qui devraient les calculer), et la ligne 33 porte 4 000 000 puis
16 400 000 FCFA en dur — ce dernier montant n'est adossé à aucune ligne de journal nulle part dans
le classeur. En base, cette incohérence est **structurellement impossible** : toute dépense
ponctuelle est nécessairement une ligne de `JournalDepensePrevue`, il ne peut pas exister de
montant agrégé sans lignes source. **Conséquence actée :** ces 5 montants devront être **re-saisis
manuellement** comme lignes de `JournalDepensePrevue` par l'utilisateur qui reprendra ce plan dans
farm-flow — ils ne font **pas** partie du jeu d'or automatique rejouable par les tests, puisqu'ils
n'ont aucune ligne de journal source à partir de laquelle les dériver.

**Ligne 28 « Crédits ».** Le classeur regroupe cette ligne sous un en-tête « Investissement /
exceptionnel », mais un crédit encaissé est un apport (`ApportCapital.type = CREDIT`, décision 6.1
mise en cohérence avec le modèle de section 3.8), son remboursement futur une sortie — ni l'un ni
l'autre n'est un investissement au sens de `CategorieJournalPrevu.INVESTISSEMENT`. Rattaché au
point ouvert 9.3 (échéancier de remboursement des prêts), reporté en Phase 3.

**Défaut bénin confirmé — pas un bug de calcul.** Le §8 des exigences signale un défaut « deux
vagues le même mois » : seules les étiquettes d'affichage (`INDEX`/`MATCH`, feuille `Prévisions`,
lignes 12/16/20) n'affichent qu'une seule vague par mois quand deux coïncident. Les quantités
(lignes 13-23) utilisent `SUMIFS` et cumulent correctement les deux vagues. Le moteur farm-flow
n'a pas cette limitation d'affichage — `calculerBesoinAlimentMensuel` et les fonctions dérivées
agrègent nativement toutes les `VaguePrevue` actives d'un mois donné, sans passer par un lookup à
résultat unique.

**Portage :** `decimal.js` pour tout montant, tout poids en kg, tout nombre de sacs fractionnaire —
jamais `number` — conformément à la section 4.

**Statut de la dépendance — à corriger avant tout code de calcul.** `decimal.js@10.6.0` est
aujourd'hui présent dans `node_modules/` mais **absent de `package.json`** : c'est une dépendance
purement transitive de Prisma, qui peut disparaître silencieusement à n'importe quelle montée de
version de Prisma, sans avertissement ni échec de build tant qu'aucun import direct n'existe dans
le code applicatif. Faire reposer le moteur de calcul monétaire du module sur une dépendance non
déclarée est un risque réel, pas une économie. **Décision :** au moment du sprint
d'implémentation, `decimal.js` doit être ajouté explicitement à `dependencies` dans `package.json`,
avec une version épinglée (voir section 8.3).

## 8. Conséquences

### 8.1 Le gap `dashboard.ts:218` — comblé pour de nouveaux usages, pas corrigé rétroactivement

`src/lib/queries/dashboard.ts:218` contient `const prixVenteKg: number | null = null;` en dur —
aucun prix de vente n'existe nulle part dans le schéma actuel, ce qui rend `revenuAttendu`
(dashboard temps réel, calculé ligne 347) **mort depuis toujours** : toujours `null`, jamais
calculé. `ParametresPrevision.prixVenteKgFCFA` (section 3.3) fournit enfin cette valeur — côté
module Prévisions.

**Ce que cet ADR ne fait pas :** brancher `ParametresPrevision.prixVenteKgFCFA` dans
`dashboard.ts` pour réparer `revenuAttendu` en temps réel. Le rapprochement (section 5) est
strictement en lecture depuis le réel vers le prévisionnel — l'inverse (le dashboard temps réel du
domaine opérationnel qui irait lire une table du module Prévisions) créerait un couplage à
rebours non prévu par la décision 1 et introduirait une dépendance implicite entre deux modules
qui doivent rester architecturalement indépendants. C'est un gap **exposé et documenté**, pas
corrigé : une story dédiée, hors du périmètre de ce sprint, devra décider explicitement comment
(et si) un prix de vente prévisionnel doit alimenter le dashboard temps réel — par exemple via un
champ dédié sur `ConfigElevage` alimenté manuellement, indépendant du module Prévisions.

### 8.2 `Vague.code` — incohérence signalée, non corrigée ici

`Vague.code String @unique` est une unicité **globale**, contrairement à `Commande.numero`,
`Vente.numero`, `Facture.numero` et `Depense.numero`, qui portent tous `@@unique([siteId, numero])`
(pattern repris fidèlement par `ScenarioPrevision.code` et `VaguePrevue.code` en section 3). Cette
incohérence pré-existe ce module — elle contraint en théorie deux sites différents à ne jamais
choisir le même code de vague, ce qui n'est cohérent avec aucune autre entité numérotée du projet.
Elle n'est **pas corrigée par cet ADR** (changer l'unicité d'un champ existant est une migration de
données à part entière, hors du périmètre « nouveau module » de ce document) — elle est signalée
ici pour qu'une story dédiée puisse la traiter séparément, avec la même rigueur R10 que tout
correctif touchant des données existantes.

### 8.3 Autres conséquences

- Le module ajoute 13 nouveaux modèles Prisma, 7 nouveaux enums, 1 champ sur `Vague`, 4 nouvelles
  valeurs `Permission`, 1 nouvelle valeur `SiteModule` — aucune modification de type ou de
  contrainte sur un modèle existant en dehors de l'ajout `Vague.vaguePrevueId`.
- Le moteur pur (`src/lib/previsions/*.ts`) est testable sans base de données pour sa logique de
  calcul (comparaison directe aux fixtures de recette, section 7) — seuls les tests d'intégration
  de queries/API nécessitent Postgres, suivant le même patron `requireDatabaseUrl()` qu'ADR-052
  s'ils touchent une vraie transaction multi-tables.
- Le rapprochement (section 5) introduit la première utilisation de `Site` comme point d'ancrage
  d'un mapping versionné indépendant d'un scénario — un précédent réutilisable pour un futur besoin
  de mapping administrable ailleurs dans le projet.
- **Modification requise hors schéma Prisma :** `decimal.js` doit être ajouté explicitement à
  `dependencies` dans `package.json`, avec une version épinglée, au moment du sprint
  d'implémentation — aujourd'hui présent uniquement comme dépendance transitive de Prisma dans
  `node_modules/`, jamais déclaré (section 7, « Statut de la dépendance »). Sans cet ajout, le
  moteur de calcul monétaire du module reposerait sur une dépendance non garantie par
  `package.json`.
- Le §10 des exigences (intégration avec un outil de ferme externe) devient **sans objet** du fait
  du choix d'architecture « module intégré, même base, même schéma » — voir section 5.1. C'est un
  allègement de périmètre, pas une omission : aucun job de synchronisation, mécanisme
  d'idempotence, ni écran de correspondance manuelle des lots n'est à construire.

## 9. Points reportés (Phase 3)

Explicitement écartés du MVP, avec la raison qui justifie le report — pas un oubli :

- **§11.3 — Taux de survie explicite.** Reporté avec la décision 4 : la mortalité reste absorbée
  par la marge de sécurité sur les alevins pour rester fidèle au modèle Excel de référence, dont la
  recette (section 7) prouve l'exactitude sans taux de survie explicite. Introduire un taux de
  survie par mois de cycle est une extension du moteur, pas une correction — elle mérite son propre
  cycle de conception et de recette contre un nouveau jeu de données de référence.
- **§11.4 — Prix par calibre.** `ParametresPrevision.prixVenteKgFCFA` est **unique par scénario**,
  pas segmenté par calibre de poisson à la vente. Le modèle Excel de référence ne segmente pas non
  plus — introduire cette granularité sans jeu de données de recette pour la valider serait une
  extension non vérifiable.
- **§11.5 — Délais de paiement.** La trésorerie prévisionnelle (section 4,
  `calculerTresorerieMensuelle`) traite un revenu ou une dépense comme encaissé/décaissé à la date
  du mois concerné, sans décalage de délai de paiement (crédit client, délai fournisseur). Le
  classeur de référence ne modélise pas non plus ce décalage.
- **§11.6 — Échéancier de remboursement des prêts.** `ApportCapital.type = CREDIT` capture
  l'encaissement d'un crédit (section 3.8, cohérent avec la correction du bug « Crédits » du
  classeur, section 7), mais aucun modèle ne porte l'échéancier de remboursement (mensualités,
  taux d'intérêt, durée). Le classeur ne le modélise pas non plus — aucune donnée de recette
  disponible pour concevoir et valider ce sous-modèle dans ce sprint.
- **§11.7 — Granularité hebdomadaire.** `RepartitionMoisAliment.moisCycle` et
  `ChargeMensuellePrevue.moisAbsolu` sont exprimés en mois entiers — aucun modèle ne permet une
  granularité hebdomadaire. Le classeur de référence raisonne exclusivement en mois ; descendre à
  la semaine multiplierait par ~4 le volume de lignes de chaque table `*Mensuelle*`/`*MoisAliment`
  sans jeu de données pour vérifier qu'un tel modèle reste correct.

## 10. Alternatives écartées

**Lire `ConfigElevage`/`Produit` en direct au moment du calcul, plutôt que copier dans
`AlimentPrevision`.** Rejetée : violerait directement §4.1 des exigences (une modification du
catalogue produit après coup changerait rétroactivement une prévision déjà calculée et communiquée)
et casserait la recette (section 7), qui exige un résultat figé, reproductible indépendamment de
l'état futur du catalogue.

**Répartition mensuelle de l'aliment en colonnes fixes (mois 1 / mois 2 / mois 3), comme le
classeur Excel.** Rejetée : ne généralise pas à `ScenarioPrevision.dureeCycleMois` paramétrable
(décision 3) — un cycle à 4 ou 6 mois exigerait une migration de schéma à chaque nouvelle durée. La
table `RepartitionMoisAliment` généralise sans limite de durée de cycle.

**Relation many-to-many entre `Vague` et `VaguePrevue` plutôt que 1-1 nullable.** Rejetée par
l'utilisateur (décision déjà prise, actée en section 2.2) : une relation many-to-many masquerait la
détection du cas « une prévision éclatée en plusieurs vagues réelles » derrière une jointure
silencieuse au lieu de la faire échouer explicitement sur la contrainte d'unicité — c'est
précisément cet échec explicite qui déclenche le flux UI de scission requis par les exigences.

**`Float` pour les nouvelles tables, cohérent avec le reste du domaine opérationnel.** Rejetée :
la tolérance de recette ≤ 1 FCFA (section 7) sur une cascade de calculs à plusieurs étages sur 21
mois ne survivrait pas à l'accumulation d'erreurs d'arrondi binaire de `Float`/IEEE 754. `Decimal`
est déjà un précédent établi dans le dépôt pour des raisons analogues (abonnements, commissions,
portefeuille) — ce n'est pas une nouveauté architecturale, seulement une extension cohérente de ce
précédent à un nouveau module qui a la même exigence de précision monétaire.

**Postes de charges codés en enum plutôt que `PostePrevision` paramétrable.** Rejetée : le classeur
de référence a fait évoluer ses lignes de dépenses (postes ajoutés/retirés) d'une version à l'autre
du fichier. Coder les postes en enum figerait la liste au niveau du schéma Prisma, exigeant une
migration à chaque évolution du plan de charges d'un site — alors qu'un référentiel paramétrable
par scénario (`PostePrevision`) absorbe cette variabilité sans toucher au schéma.

**Corriger silencieusement §5.7 sans le documenter comme un écart assumé.** Rejetée : le texte des
exigences fonctionnelles fait foi tant qu'il n'est pas explicitement corrigé par une décision
actée. Implémenter la version du fichier Excel sans le signaler créerait un désaccord silencieux
entre le texte de référence et le comportement du moteur, invisible à quiconque relit les exigences
sans relire aussi le code. La décision 6 rend cet écart explicite, justifié et traçable.
