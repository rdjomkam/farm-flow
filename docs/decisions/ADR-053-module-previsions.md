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

> **Renvoi — ce modèle est amendé par la section 13 (sprint PR2-septies).** Le champ `seuilSacs`
> ci-dessus ne reproduit pas la règle du §4.3 des exigences fonctionnelles : la remise se décide
> **une fois par vague prévue, sur son tonnage visé**, jamais sur un nombre de sacs d'une
> granulométrie. Le texte ci-dessus est conservé tel quel (ADR append-only, il documente la
> décision d'origine et son défaut) — la règle en vigueur est celle de la section 13.

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

> **Renvoi — la recette de la remise fournisseur est amendée par la section 13 (sprint
> PR2-septies).** L'orchestration de recette `buildCoutAlimentsParVague`
> (`src/lib/previsions/__tests__/recette/orchestration.ts`) fabrique aujourd'hui des seuils de
> palier mis à l'échelle par granulométrie pour compenser un défaut du modèle (§3.4). Ce
> contournement doit **disparaître** avec le correctif de la section 13 — la recette passera
> `seuilTonnes` directement, sans mise à l'échelle. Tant qu'il subsiste, le correctif est
> incomplet (critère de fin, §13.4).

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

## 11. Amendement (Sprint PR2, 2026-08-03) — gap de modèle `sacsParTonneStandard`

**Origine.** Bug de sévérité Haute détecté par le @tester en story PR2.2
(`docs/tests/rapport-story-PR2.2.md` §4.1) : la route de calcul
(`src/lib/previsions/route-orchestration.ts`, GAP 1) produit un besoin en aliment faux d'un facteur
de plusieurs ordres de grandeur (4 000 000 kg calculés là où ~480 kg étaient attendus, sur le cas de
test démontré). Investigation d'arbitrage menée par @architect à la demande du PM, sans écriture de
code de production — seul ce document et `src/types/models.ts` ont été modifiés.

### 11.1 Diagnostic confirmé

Le diagnostic du @tester est **confirmé, et un second défaut composé a été mis au jour au passage**
(non isolé dans le rapport de test, noyé dans le même GAP 1) :

1. **Homonymie `sacsParTonne`.** Le schéma actuel (section 3.5) ne porte qu'**une seule** grandeur
   sous ce nom, décrite comme « dérivable de `poidsSacKg`, mais stockée et gelée ». En production
   (`copierAlimentsPrevisionDepuisProduits`, `src/lib/queries/previsions-scenarios.ts`), elle est
   effectivement calculée comme `1000 / poidsSacKg` — un **pur ratio d'unité de poids** (« combien
   de sacs de ce produit, de ce poids, font une tonne de ce produit »), rigoureusement conforme à ce
   que dit la section 3.5. Mais la recette (`src/lib/previsions/__tests__/recette/orchestration.ts`,
   `helpers.ts`) utilise, sous le **même nom de champ dans le vocabulaire du moteur**, une valeur
   `sacsParTonneStandard` lue **littéralement depuis le classeur Excel** (`prisma/fixtures/previsions/
   plan-v12-corrige.json`, `$source: "Aliments!A4:J4"` / `A5:J5` / `A6:J6`) : 8 pour le 2mm, 18 pour
   le 3mm, 50 pour le 4mm — alors que les trois granulométries ont **le même** `poidsSacKg` (15 kg)
   dans ces mêmes fixtures. Une grandeur qui varie fortement entre trois lignes à `poidsSacKg`
   identique ne peut pas être un ratio de poids : c'est un **coefficient de conversion
   alimentaire biologique** (nombre de sacs de cette granulométrie nécessaires par tonne de
   **poisson** produit, pas par tonne du **produit aliment lui-même**). Les deux grandeurs sont
   réelles, légitimes, et nécessaires au moteur — elles portent seulement, par accident, le même
   nom.
2. **Second défaut, composé avec le premier, non isolé par le rapport de test.** Même en corrigeant
   l'homonymie, la formule de `route-orchestration.ts` resterait fausse d'un facteur 1000
   supplémentaire : `tonnageCibleKg()` (fonction interne du fichier) retourne la biomasse cible en
   **kilogrammes** (`effectifAlevinsPrevu * poidsObjectifG / 1000`), alors que la formule de la
   recette qu'elle transpose (`objectifTonnes.times(sacsParTonneStandard).times(poidsSacKg)`,
   `__tests__/recette/orchestration.ts:80`) attend un tonnage en **tonnes** (`GoldenVague.objectifTonnes`,
   une entrée littérale du classeur). La démonstration chiffrée du @tester (5000 alevins, 800 g
   cible → écart ×~8300 entre 4 000 000 kg et 480 kg attendus) est le produit exact des **deux**
   erreurs combinées : `(sacsParTonneUnitaire / sacsParTonneStandard) × (kg utilisés à la place de
   tonnes) = (66,667 / 8) × 1000 ≈ 8333`. Un correctif qui ne traiterait que l'homonymie de nommage
   laisserait un résidu d'erreur ×1000 non détecté sans ce second constat.

### 11.2 Arbitrage de modèle

1. **`AlimentPrevision.sacsParTonne` est renommé `sacsParTonneUnitaire`.** Conservé (pas supprimé)
   malgré sa redondance mathématique avec `poidsSacKg` : la décision 1 de cet ADR (paramètres gelés
   à la création) vaut pour toute donnée utile à l'affichage ou à un futur usage du module, pas
   seulement pour les données non dérivables — un champ déjà câblé dans 8+ fichiers (queries,
   validation, loader, types) pour un coût de migration nul (renommage de colonne) ne justifie pas
   une suppression. Le renommage seul lève l'ambiguïté qui a causé le bug : ce champ ne doit
   **jamais** entrer dans un calcul de besoin en aliment par tonne de poisson.
2. **Nouveau champ `AlimentPrevision.sacsParTonneStandard`, `Decimal?` (nullable).** C'est un **gap
   de modèle réel**, pas une erreur d'implémentation d'un champ existant : cette grandeur n'a jamais
   eu de colonne dans le schéma de la section 3.5 d'origine, alors que la recette du moteur en
   dépend structurellement (`AlimentPrevisionCalcInput.besoinTotalCycleKg`, l'entrée que le moteur
   pur exige en argument, ne peut être construite sans elle). Nullabilité tranchée
   explicitement (R7) : **nullable**, pas `NOT NULL` avec une valeur par défaut inventée. Raison :
   contrairement à `poidsSacKg`/`prixSacFCFA` (copiables depuis `Produit`) et contrairement à
   `ParametresPrevision.prixVenteKgFCFA` (qui a une source de repli légitime : le dernier scénario
   `ACTIF` du site), **aucune source de dérivation automatique n'existe** dans le catalogue `Produit`
   actuel pour un coefficient de conversion alimentaire biologique par granulométrie — inventer une
   valeur par défaut (0, 1, ou une copie de `sacsParTonneUnitaire`) serait exactement le type de
   « calcul silencieusement basé sur une donnée absente » que cet ADR proscrit déjà ailleurs (section
   3.3, note sur `prixVenteKgFCFA`). `null` signifie explicitement « non configuré » ; toute route
   de calcul qui rencontre `sacsParTonneStandard = null` sur une granulométrie utilisée par au moins
   une `VaguePrevue` active **doit rejeter explicitement** (422, message nommant la granulométrie en
   cause), jamais produire un chiffre en silence.
3. **`copierAlimentsPrevisionDepuisProduits` initialise `sacsParTonneStandard` à `null`** à la
   création du scénario (rien à copier depuis `Produit`) — l'utilisateur doit le saisir avant que le
   calcul de ce scénario soit fiable. Best-effort optionnel, laissé à la discrétion de @developer/@db-specialist
   s'il ne complique pas la story : proposer une valeur par défaut **suggérée** (pas assignée) en
   copiant celle d'un `AlimentPrevision` de même `tailleGranule` du dernier scénario `ACTIF` du même
   site, à l'identique du mécanisme déjà décrit pour `prixVenteKgFCFA` — mais jamais en écriture
   silencieuse : l'utilisateur doit voir et valider la valeur avant qu'elle serve à un calcul.
4. **Aucune autre confusion trouvée ailleurs dans le code après recherche exhaustive** de
   `sacsParTonne` sur `src/` et `prisma/` : les seuls sites qui consomment la grandeur « coefficient
   de besoin » sont la recette (`__tests__/recette/`, qui lit `sacsParTonneStandard` directement
   depuis les fixtures, jamais depuis la base) et `route-orchestration.ts` (le seul point de
   production concerné, hors moteur). Le moteur pur (`src/lib/previsions/aliments.ts`, `types.ts`)
   ne référence `sacsParTonne` dans aucune de ses fonctions — il consomme uniquement
   `besoinTotalCycleKg`, déjà composé par l'appelant. C'est précisément ce découplage qui permet de
   corriger ce gap **sans toucher au moteur** (section 11.4).

### 11.3 Amendement formel de la section 3.5

Le modèle `AlimentPrevision` de la section 3.5 est amendé comme suit (remplace le champ
`sacsParTonne` par les deux champs ci-dessous, reste du modèle inchangé) :

```prisma
model AlimentPrevision {
  // ... champs inchangés (id, scenarioId, produitId, libelle, tailleGranule, poidsSacKg, prixSacFCFA) ...

  /** Pur ratio d'unite de poids (1000 / poidsSacKg) — RENOMME depuis sacsParTonne (amendement PR2).
   *  Ne doit JAMAIS entrer dans un calcul de besoin en aliment par tonne de poisson. */
  sacsParTonneUnitaire Decimal

  /** Coefficient de besoin en aliment : sacs de cette granulometrie par tonne de POISSON produit.
   *  AJOUTE par l'amendement PR2 — gap de modele, aucune derivation automatique possible depuis
   *  Produit. Nullable : null = non configure, tout calcul qui en depend doit rejeter explicitement. */
  sacsParTonneStandard Decimal?

  // ... reste inchange (ordre, siteId, repartitions, createdAt, updatedAt) ...
}
```

### 11.4 Le moteur reste intouchable — confirmation

Cet amendement ne touche **aucune** fonction de `src/lib/previsions/aliments.ts`, `types.ts`, ni
aucun fichier couvert par la recette (`__tests__/recette/`) : `AlimentPrevisionCalcInput` prend déjà
`besoinTotalCycleKg` en argument, agnostique de la façon dont l'appelant l'a composé. Seul
`route-orchestration.ts` (non couvert par la recette, cf. `SPRINT-PR2-PREVISIONS.md`) doit être
corrigé pour :
1. lire `aliment.sacsParTonneStandard` (et rejeter explicitement si `null`) au lieu de
   `aliment.sacsParTonneUnitaire` ;
2. diviser la biomasse cible par 1000 (kg → tonnes) avant de la multiplier par
   `sacsParTonneStandard` (section 11.1, point 2).
La recette reste donc à 842 tests / 0 écart sans aucune revérification nécessaire côté moteur — seul
un nouveau test dédié à `route-orchestration.ts` (déjà commencé par le @tester en story PR2.2) doit
être mis à jour pour refléter la formule corrigée.

## 12. Amendement (Sprint PR2-quater, 2026-08-03) — modèle à deux niveaux calibre → articles

**Origine.** Défaut de conception signalé au démarrage de PR2-quater, distinct des amendements de la
section 11 : ceux-ci corrigeaient un nom de champ ambigu à l'intérieur d'un modèle par ailleurs
correct ; celui-ci porte sur le modèle lui-même, qui confond deux natures dans une seule ligne.
Investigation menée par @architect à partir de la pré-analyse `docs/analysis/pre-analysis-sprint-
PR2-quater.md` (état de départ vérifié sain : 277 fichiers / 7588 tests / 0 échec, recette 1270/0
écart, schéma valide). Aucune ligne de code de production modifiée par cette section — seul ce
document est écrit.

### 12.1 Origine et diagnostic

Le modèle `AlimentPrevision` de la section 3.5 (déjà amendé section 11 pour l'homonymie
`sacsParTonne`) reste **structurellement faux** après cet amendement, pour une raison différente :
il porte une seule ligne là où il devrait en porter deux, parce qu'il confond deux natures qui ne
varient pas ensemble :

| Nature | Caractérisée par | Pilote |
|---|---|---|
| **Calibre** (ex. « 2 mm ») | une taille de granulé (`tailleGranule`) | `sacsParTonneStandard` (coefficient de besoin biologique, sacs par tonne de **poisson**) et la répartition sur le cycle (`RepartitionMoisAliment`) |
| **Article** (ex. « Marque A en 2 mm ») | une marque, un poids de sac, un prix | le coût d'achat (`poidsSacKg`, `prixSacFCFA`, `sacsParTonneUnitaire`) |

Le coefficient de besoin biologique et la répartition mensuelle dépendent de la **granulométrie** —
un poisson a besoin d'un certain volume de granulé de 2 mm par tonne produite, quelle que soit la
marque qui le fabrique. Le coût, lui, dépend de l'**article** acheté — deux marques du même calibre
2 mm peuvent avoir des sacs de poids différents et des prix différents. Tant qu'il n'existe qu'un
seul article par calibre, les deux natures coïncident numériquement une-pour-une et la ligne unique
« fonctionne » — c'est exactement la situation du classeur Excel de référence (une seule marque par
granulométrie dans `Aliments!A4:J6`, confirmé par les fixtures `plan-v12-corrige.json`). Dès qu'un
second article apparaît pour le même calibre, la ligne unique n'a plus de sens : il faudrait choisir
*lequel* des deux `poidsSacKg`/`prixSacFCFA` sert de référence au calcul de besoin, ou répartir la
répartition-sur-cycle (portée par calibre) entre des lignes d'article qui n'ont individuellement
aucune raison de se voir attribuer une part du cycle — la répartition mensuelle est une propriété du
*besoin biologique en 2 mm*, pas une propriété de *l'article Marque A*.

**Ce défaut n'est pas une erreur d'implémentation, c'est une insuffisance du modèle qu'aucun jeu
d'or à une seule marque par calibre ne pouvait révéler.** C'est la même leçon que ERR-138 (deux
grandeurs différentes portant le même nom ne s'affichent jamais comme un bug tant qu'elles ne
divergent pas numériquement), mais élevée d'un champ à une ligne entière : la recette (1270 tests,
section 7) ne peut par construction jamais exercer N > 1 article par calibre, parce qu'aucune des
fixtures qui la nourrissent n'en contient. Un jeu de test qui rejoue fidèlement une référence
dégénérée ne peut pas, par définition, détecter le défaut qui n'apparaît qu'en dehors de cette
dégénérescence.

**Second défaut, lié mais distinct : le formulaire de création n'expose ni `tailleGranule` ni
`produitId`.** Une ligne de granulométrie saisie à la main a donc les deux à `null` — sans lien avec
l'enum de référence (donc invisible dans tout regroupement/rapprochement par calibre), ni avec le
catalogue produit réel (donc invisible dans tout rapprochement par article). Ce n'est pas un défaut
cosmétique : le rapprochement prévu/réel prévu pour PR3 (section 5) doit joindre
`MouvementStock.produitId` d'une part et grouper par `tailleGranule` d'autre part ; une ligne à
`tailleGranule = null` et `produitId = null` n'est raccordable à **aucun** des deux axes de
comparaison, ce qui rend PR3 impossible à construire sur ces lignes, pas seulement dégradé.

### 12.2 Les cinq arbitrages

#### 1. Calcul du coût quand un calibre a N articles — **RÉVISÉ (2026-08-03) : somme article par article, jamais une moyenne**

**Traçabilité de la révision.** L'arbitrage précédent, acté ci-dessous jusqu'à cette date, retenait
une **moyenne pondérée** de `poidsSacKg`/`prixSacFCFA` injectée telle quelle dans le moteur inchangé,
avec une démonstration algébrique de non-régression du cas dégénéré. **Cet arbitrage est invalidé
par une décision explicite de l'utilisateur**, qui a tranché après coup : « Chaque article d'un
calibre a son propre prix, et les différents prix doivent être pris en compte selon la quantité. »
Ce n'est pas une nuance de formulation : une moyenne des prix, même pondérée par les parts
déclarées, n'est **pas** la même grandeur qu'une somme de (quantité réellement achetée de cet
article × son prix), dès que la répartition entière des sacs entre articles diverge des parts
déclarées à cause d'un arrondi — ce qui est structurellement le cas dès que N > 1 (voir ci-dessous).
La démonstration algébrique de l'arbitrage précédent n'est pas fausse en elle-même (elle prouvait
correctement l'égalité dans le cas dégénéré), mais elle prouvait l'équivalence du **mauvais
candidat** : le fond du problème n'est pas résolu par la moyenne pondérée en général, seulement
masqué par le fait qu'un seul article ne peut jamais faire apparaître de divergence. Cette section
est réécrite, pas complétée : ce qui suit remplace intégralement la règle de coût actée
précédemment. Aucune ligne de code de production n'a été touchée entre les deux versions de cette
section — seul ce document est modifié, comme pour l'amendement initial.

**Règle retenue : le coût d'un calibre est la somme, article par article, de (nombre de sacs de cet
article × son prix de sac), jamais une moyenne appliquée à un total de sacs.** La quantité par
article pondère naturellement dans la somme — c'est elle qui porte l'information de « combien de
cet article a réellement été acheté », une information qu'une moyenne de prix ne peut pas
reconstituer une fois appliquée à un total déjà agrégé.

```
coutCalibreFCFA = (1 − remisePct / 100) × Σᵢ (sacsᵢ × articleᵢ.prixSacFCFA)
```

où `sacsᵢ` est le nombre entier de sacs de l'article *i* effectivement affecté (voir la répartition
ci-dessous) et `remisePct` est la remise décidée **une fois pour tout le calibre**, jamais par
article (inchangé, voir plus bas).

**Le vrai point difficile : le besoin en sacs se calcule par calibre, avec un `ceil` unique
(§5.1 des exigences, vérifié par la recette), puis doit être réparti en nombres entiers entre les
articles selon `partApprovisionnementPct`, sans jamais dépasser ce total.**

Deux façons naïves de répartir un total entier `N` de sacs entre `n` articles selon leurs parts
`pᵢ` (`Decimal`, Σpᵢ = 100 exactement, validé à l'écriture — arbitrage 3) sont écartées :

- **Arrondir chaque part au sac supérieur** (`sacsᵢ = ceil(N × pᵢ / 100)`) **gonfle le total** : avec
  `N = 101` sacs répartis 50 % / 50 %, `ceil(101 × 0.5) = 51` pour chaque article, soit
  `51 + 51 = 102` — un sac de plus acheté que le besoin calculé, à chaque calibre et chaque mois.
  Rejetée : on achète des sacs entiers, mais le total réellement acheté ne doit **jamais** dépasser,
  sans raison métier, le besoin déjà arrondi une fois au niveau calibre — un second arrondi à la
  hausse par article serait un double arrondi, pas une répartition.
- **Une répartition libre, sans règle documentée** — rejetée : deux exécutions du même scénario
  pourraient produire des répartitions différentes si l'ordre d'itération ou l'implémentation
  varie, ce qui romprait la reproductibilité exigée partout ailleurs dans cet ADR (section 7,
  recette figée ; décision 1, paramètres gelés).

**Règle retenue : méthode du plus fort reste (Hare-Niemeyer), déterministe, sans dépassement du
total.**

1. Pour chaque article *i* : `partᵢExacte = N × pᵢ / 100` (`Decimal` exact — `pᵢ` et `N` sont
   connus exactement, aucune approximation binaire).
2. `planchᵢ = floor(partᵢExacte)` (entier).
3. `restantᵢ = partᵢExacte − planchᵢ` (`Decimal` dans `[0, 1[`).
4. `restantATteribuer = N − Σᵢ planchᵢ` — nécessairement un entier positif ou nul, et
   nécessairement `< n` : puisque `Σᵢ pᵢ = 100` exactement, `Σᵢ partᵢExacte = N` exactement, donc
   `Σᵢ restantᵢ = N − Σᵢ planchᵢ = restantATteribuer`, et une somme de `n` termes chacun `< 1` est
   elle-même `< n`. `restantATteribuer` est donc un entier de `[0, n − 1]`, jamais négatif, jamais
   supérieur au nombre d'articles.
5. Trier les articles par `restantᵢ` décroissant ; **départage des ex æquo, déterministe et
   documenté ici** : `ordre` de l'article croissant, puis `id` croissant (ordre lexicographique
   `cuid`) — les deux champs existent déjà sur `AlimentArticlePrevision` (section 12.3), aucun champ
   supplémentaire n'est nécessaire pour ce départage.
6. Attribuer `+1` à `planchᵢ` pour les `restantATteribuer` premiers articles de ce tri ; les autres
   gardent `planchᵢ`. Le résultat final `sacsᵢ` est cette valeur.

**Preuve que `Σᵢ sacsᵢ = N` exactement, jamais plus, jamais moins** : `Σᵢ sacsᵢ = Σᵢ planchᵢ +
restantATteribuer = (N − restantATteribuer) + restantATteribuer = N`. L'égalité est stricte, pas
approchée — aucun terme de cette somme n'est arrondi une seconde fois après l'attribution des `+1`.
C'est la propriété qui manque aux deux candidats rejetés ci-dessus (le premier dépasse `N`, le
second n'offre aucune garantie faute de règle).

**Où vit cette répartition.** C'est une **nouvelle fonction pure du moteur**
(`src/lib/previsions/aliments.ts`, ex. `repartirSacsEntreArticles(totalSacs, articles)` où
`articles` porte `{ id, ordre, partApprovisionnementPct }`), **ajoutée**, pas une modification d'une
fonction existante — cohérent avec 12.4 : `appliquerPalierRemise`, `apportionnerCoutAlimentMensuel`,
`calculerBesoinAlimentMensuel`, `calculerCoutAlimentVague` et
`calculerCoutAlimentGranulometrieParMois` restent tous **inchangés, ligne pour ligne**. Cette
fonction ne peut, par construction, jamais être exercée par la recette existante (1270 tests, tous
construits sur des fixtures à un seul article par calibre — 12.1, 12.5) : elle exige des **tests
unitaires dédiés, non issus du jeu d'or**, avec répartitions calculées à la main pour au moins
`N = 2` et `N = 3` articles, y compris un cas d'ex æquo sur `restantᵢ` qui exerce explicitement le
départage par `ordre` puis `id`.

**Où s'applique `appliquerPalierRemise` : au total de sacs du calibre, avant répartition — inchangé
depuis l'arbitrage précédent, toujours cohérent avec ERR-143.** La remise de volume est un seuil
négocié sur le **volume total acheté de ce calibre**, quelle que soit sa répartition ultérieure
entre marques — appliquer le palier par article après le split évaluerait chaque remise sur un
volume plus petit, produisant mécaniquement une remise plus faible dès que `N > 1`, un artefact de
calcul, pas un choix métier. Concrètement, `appliquerPalierRemise(totalSacsCalibre, <prix
arbitraire non nul>, paliers)` est appelée pour lire **uniquement** son champ
`pourcentageRemiseApplique` — jamais son champ `coutFCFA`, qui a été calculé sur un prix qui n'est
pas la moyenne réelle par sac et n'a donc plus de sens une fois le coût recalculé par somme
d'articles. Ceci est possible sans aucune ambiguïté parce que `pourcentageRemiseApplique` ne dépend,
dans le code actuel de `appliquerPalierRemise` (`aliments.ts`), **que** de `sacs` et `paliers` — le
paramètre `prixSacFCFA` n'intervient que dans le calcul de `coutFCFA`, jamais dans la boucle qui
détermine le palier. Le montant total remisé du cycle,
`coutCycleTotalRemiseFCFA = coutCalibreFCFA` (formule ci-dessus), est ensuite ventilé par mois via
`apportionnerCoutAlimentMensuel` (moteur inchangé, section 4) exactement comme aujourd'hui — cette
fonction ne voit jamais la différence entre un montant obtenu par moyenne pondérée ou par somme
d'articles, elle ne consomme qu'un total déjà remisé.

**Preuve chiffrée du cas dégénéré (1 article à 100 %) — identité au FCFA près avec le modèle
actuel, recette 1270 tests / 0 écart préservée.** Avec `N = 1`, `p₁ = 100` :
`part₁Exacte = totalSacsCalibre`, `planch₁ = totalSacsCalibre`, `restant₁ = 0`,
`restantATteribuer = 0`, donc `sacs₁ = totalSacsCalibre` exactement — aucun arrondi, aucune
attribution de reste. `coutCalibreFCFA = (1 − remisePct/100) × (totalSacsCalibre × article₁.prixSacFCFA)`,
qui est **littéralement** l'expression que calcule aujourd'hui
`appliquerPalierRemise(totalSacsCalibre, article₁.prixSacFCFA, paliers).coutFCFA` — même opérandes,
même ordre d'opérations `Decimal`, aucune division introduite par cette réécriture qui n'existait
pas déjà dans le calcul actuel. Le résultat est donc identique **byte pour byte**, pas seulement
« à 1 FCFA près » : la recette (1270 tests, y compris les 390 de
`route-orchestration.recette.test.ts`) reste valide **sans aucune modification** des fixtures ni du
moteur, exactement comme le garantissait — pour de mauvaises raisons mais avec la bonne conclusion —
l'arbitrage précédent.

**Aucun changement de schéma requis par cette révision.** La règle de coût ci-dessus est un
changement d'algorithme dans la couche orchestration/queries (qui compose les entrées avant
d'appeler le moteur), pas dans le modèle de données : `poidsSacKgReference`/`prixSacFCFAReference`
n'ont jamais été des colonnes persistées (c'étaient des valeurs composées à la volée dans
l'arbitrage précédent) et ne le deviennent pas davantage sous la forme `sacsᵢ` — ces derniers sont
calculés à la demande à chaque projection, jamais stockés. Le modèle de la section 12.3 reste
valide tel quel.

**Conséquence sur le calcul du nombre total de sacs du calibre (`ceil`), maintenant que
`poidsSacKg` n'existe plus au niveau calibre.** L'ancienne formule de `route-orchestration.ts`
(`besoinTotalCycleKg = tonnage × sacsParTonneStandard × poidsSacKg`, puis
`ceil(besoinTotalCycleKg / poidsSacKg)`) faisait déjà s'annuler algébriquement `poidsSacKg` — la
pré-analyse le démontre numériquement (division exacte en `Decimal`, précision 20). Le nombre total
de sacs du calibre ne dépend donc, **et n'a jamais dépendu**, que de `tonnage` et
`sacsParTonneStandard` : `totalSacsCalibre = ceil(tonnageCibleTonnes × sacsParTonneStandard)`,
indépendamment de tout `poidsSacKg`. C'est une simplification bienvenue, pas une complication : elle
supprime le besoin d'inventer une quelconque référence `poidsSacKg` de calibre pour cette étape.
Le `poidsSacKg` de chaque article reste nécessaire ailleurs — affichage du besoin en kg par calibre
(à titre informatif, calculé après répartition comme `Σᵢ(sacsᵢ × articleᵢ.poidsSacKg)`, jamais avant)
et calcul du coût (formule ci-dessus). Le détail d'implémentation exact de cet enchaînement (appeler
`calculerBesoinAlimentMensuel` avec un `poidsSacKg` de calibre arbitraire, puisque son choix ne peut
plus influencer le nombre de sacs, ou recomposer directement le `ceil` en amont) est laissé à
@developer, sans ambiguïté sur le résultat attendu qu'il doit produire.

**Je valide cette révision sans réserve** : c'est la seule règle qui reflète fidèlement la citation
de l'utilisateur (une somme pondérée par la quantité réellement achetée, jamais une moyenne
appliquée après coup), qui répartit les sacs sans jamais dépasser le total calculé au niveau
calibre, dont le départage des ex æquo est entièrement déterministe et documenté, et qui préserve
au FCFA près — en réalité au byte près — le cas dégénéré déjà recetté.

#### 2. Le sort de `AlimentParVaguePrevue` et de `sacsSaisis` — **validé, FK reste sur le calibre**

`AlimentParVaguePrevue.alimentPrevisionId` reste pointé sur le **calibre**, sans aucun changement de
schéma sur cette table. Conséquence directe de l'arbitrage 1 (révisé) : `sacsCalcules`,
`quantiteKgCalculee` et `coutCalculeFCFA` restent des grandeurs **agrégées au niveau calibre** —
`coutCalculeFCFA` y est désormais la somme des coûts par article (arbitrage 1 révisé), pas une
moyenne, mais reste malgré tout un total unique par calibre, pas une ligne par article — il n'existe
donc aucune raison de faire pointer la FK vers l'article — un « sac de 2 mm consommé » est une
grandeur de calibre, quelle que soit la marque effectivement achetée ce mois-là. La surcharge manuelle `sacsSaisis` (§3.6, `COALESCE(sacsSaisis, sacsCalcules)`)
reste elle aussi au niveau calibre, sans changement de sémantique : un exploitant qui ajuste « j'ai
utilisé plus/moins de 2 mm que prévu » raisonne en calibre, jamais en marque précise.

**Conséquence favorable, non anodine, pour la migration (arbitrage 5) :** puisque le PK
d'`AlimentPrevision` ne change pas de nature (il identifie toujours un calibre après migration),
**ni `AlimentParVaguePrevue.alimentPrevisionId` ni `RepartitionMoisAliment.alimentPrevisionId`
n'ont besoin d'être remappés.** Seule la table `AlimentPrevision` elle-même est restructurée
(colonnes d'article extraites vers une table enfant) — la migration ne touche à aucune ligne des
deux tables filles existantes.

**Je valide cet arbitrage sans réserve.**

#### 3. Somme des parts d'approvisionnement — **validé, contrainte à 100 %, bloquante à l'écriture, même patron que la répartition mensuelle**

La somme des `partApprovisionnementPct` de tous les articles d'un calibre doit valoir exactement
100, vérifiée par une fonction de validation applicative appelée avant l'écriture, dans la **même
transaction Prisma** que le `createMany`/`updateMany` qui remplace l'ensemble des articles d'un
calibre — exactement le patron déjà en place pour `RepartitionMoisAliment` (`validerSomme
RepartitionMoisAliment`, §3.5 de cet ADR, note sur la validation) et cohérent avec R4 (opérations
atomiques : pas de vérification préalable suivie d'une écriture non protégée). Aucune contrainte SQL
native n'est retenue, pour la même raison qu'en section 3.5 : un `CHECK` Postgres ne voit qu'une
ligne à la fois, un agrégat multi-lignes exigerait un trigger, dont le coût de maintenance est
disproportionné face à une règle qui n'a de sens qu'au moment d'un appel API unique en
« remplace-tout ». La nouvelle fonction (`validerSommeApprovisionnementArticles`) vit au même
endroit que sa cousine, `src/lib/previsions/validation.ts`.

Une somme libre (non contrainte) a été écartée : elle rendrait `poidsSacKgReference`/
`prixSacFCFAReference` (arbitrage 1) mathématiquement indéfinis en cas de somme ≠ 100 — soit
sous-pondérés (somme < 100, une partie du besoin non couverte par aucun article), soit
sur-pondérés (somme > 100, un coût artificiellement gonflé) — sans qu'aucune de ces deux dérives ne
corresponde à une réalité d'achat. **Je valide cet arbitrage sans réserve.**

#### 4. Vocabulaire — codes `TailleGranule` vs millimètres du terrain — **validé, réutilisation stricte de l'existant, aucun second référentiel**

L'UI affiche le calibre via les libellés i18n déjà traduits et déjà alignés sur les granulométries du
jeu d'or (`src/messages/{fr,en}/stock.json` et `analytics.json`, clé `tailleGranule.G1` = « G1 —
Granulé 2mm », `G2` = « G2 — Granulé 3mm », `G3` = « G3 — Granulé 4mm », etc.) — jamais un second
mapping réinventé dans `previsions.json` avec un texte reformulé indépendamment. Si une clé
`previsions.tailleGranule.*` est créée pour des raisons de convention de namespace propre au module,
son contenu doit rester **identique caractère pour caractère** à la clé `stock`/`analytics`
correspondante — une divergence de reformulation entre deux namespaces qui décrivent la même
grandeur serait un nouveau risque de confusion du même ordre que celui documenté en 12.1.

**`ConfigElevage.alimentTailleConfig` est un référentiel distinct, non touché par ce sprint.** Il
associe des tranches de poids de poisson à une description libre d'aliment (chaînes non contraintes
comme `"1.2mm"`, `"2-3mm"`), consommé par `activity-engine/feeding.ts` pour des suggestions
d'activité — un usage sémantiquement indépendant du calibre planifié dans le module Prévisions
(composition du plan d'achat par cycle). Les deux référentiels se ressemblent superficiellement
(tous deux parlent de « taille de granulé »), ce qui constitue un risque réel de confusion pour un
agent qui n'aurait pas lu cette section — d'où l'importance de le documenter ici explicitement, pas
seulement dans la pré-analyse. **Je valide cet arbitrage sans réserve, et je souligne qu'il doit
être rappelé à tout agent qui touchera `alimentTailleConfig` à l'avenir**, précisément parce que la
ressemblance de surface invite à la confusion.

#### 5. Migration des données existantes — **validé sur le principe des garde-fous, précisé sur deux points**

L'état réel du dépôt ne contient aujourd'hui aucune ligne `AlimentPrevision` en seed — le scénario de
collision et le scénario `tailleGranule = null` ne sont pas démontrables ici, mais
`Produit.tailleGranule` étant nullable et `copierAlimentsPrevisionDepuisProduits` copiant cette
valeur telle quelle (y compris `null`), un environnement réel non visible depuis ce dépôt pourrait
déjà contenir l'un ou l'autre cas. **Une migration ne devine jamais** ; les deux garde-fous suivants
sont actés comme faisant partie de la migration elle-même (R10), jamais d'un script préalable qu'un
humain devrait penser à lancer :

- **`tailleGranule = null`** : bloc `DO $$ ... RAISE EXCEPTION` en tête de `migration.sql`, avant tout
  `ALTER TABLE`, qui échoue si `SELECT count(*) FROM "AlimentPrevision" WHERE "tailleGranule" IS
  NULL` est non nul. Jamais de valeur de repli inventée (`P0`, copie d'un autre champ) — la même
  discipline que celle déjà appliquée à `sacsParTonneStandard` en section 11.2. **Je précise ici un
  point que la pré-analyse laisse implicite : ce garde-fou doit nommer, dans son message d'erreur,
  les `id`/`scenarioId` des lignes fautives** (pas un simple comptage), pour que l'opérateur qui lit
  l'échec de la migration sache immédiatement quoi corriger manuellement avant de relancer — un
  échec muet qui ne dit que « il y a un problème » sans dire où reproduirait, à l'échelle d'une
  migration, exactement le défaut d'affichage silencieux que cet ADR proscrit ailleurs (section 5,
  « Non rapproché » explicite plutôt qu'un silence).
- **Collision `(scenarioId, tailleGranule)`** : second garde-fou, `GROUP BY "scenarioId",
  "tailleGranule" HAVING count(*) > 1`, qui échoue plutôt que de fusionner deux lignes en devinant
  une part d'approvisionnement 50/50 arbitraire — une fusion automatique inventerait une donnée
  métier (la part réelle de chaque marque) qui n'existe nulle part dans les lignes sources. Même
  exigence de message nommant les lignes en collision.
- **Cas nominal (aucun `null`, aucune collision) : le PK d'`AlimentPrevision` est conservé**
  (conséquence de l'arbitrage 2) — la migration ne remape donc aucune FK sur
  `AlimentParVaguePrevue` ni `RepartitionMoisAliment`. Elle : (a) crée `AlimentArticlePrevision`
  (FK `alimentCalibrePrevisionId` → `AlimentPrevision.id`) ; (b) copie, pour chaque
  `AlimentPrevision` existante, `poidsSacKg`, `prixSacFCFA`, `produitId`, `libelle`,
  `sacsParTonneUnitaire` vers une unique ligne `AlimentArticlePrevision` fille avec
  `partApprovisionnementPct = 100` — via un `INSERT ... SELECT` explicite, **jamais** un
  `DROP`/`ADD` qui perdrait les valeurs (piège déjà rencontré, ERR-140, aggravé ici puisqu'il s'agit
  d'un déplacement de colonnes **entre deux tables**, pas d'un simple renommage — `prisma migrate
  diff` ne détecte structurellement pas ce cas et génère un `DROP COLUMN` pur : le SQL généré doit
  être relu et réécrit à la main, jamais appliqué tel quel) ; (c) `DROP COLUMN` ces mêmes colonnes
  sur `AlimentPrevision` une fois la copie confirmée ; (d) rend `tailleGranule NOT NULL` sur
  `AlimentPrevision` — cette dernière étape n'est atteignable que si le garde-fou (a) ci-dessus est
  passé.
- **Idempotence** : chaque étape est un no-op silencieux sur une table source vide (`INSERT ...
  SELECT` sur un ensemble vide ne produit aucune ligne, `DROP COLUMN` sur une colonne déjà absente
  échouerait — la migration doit donc être structurée pour n'être rejouée qu'une fois, comme toute
  migration Prisma versionnée ; ce n'est pas un correctif de données au sens strict de R10 puisqu'il
  s'accompagne d'un changement de schéma, mais la même discipline de non-invention de valeur
  s'applique).

**Je valide l'approche des garde-fous sans réserve. J'ajoute une exigence non explicitée par la
pré-analyse** : le message d'erreur de chaque garde-fou doit être actionnable (nommer les lignes en
cause), pas un simple constat d'échec — cohérent avec le principe déjà établi ailleurs dans cet ADR
qu'un problème de données doit être visible et qualifié, jamais un échec muet.

### 12.3 Amendement formel du modèle

`AlimentPrevision` devient le **calibre** ; un nouveau modèle, `AlimentArticlePrevision`, porte
l'**article**. Le nom retenu suit la convention déjà en place dans ce module (`AlimentPrevision`,
`AlimentParVaguePrevue`, `RepartitionMoisAliment` — le suffixe `Prevision` marque une donnée
paramétrique gelée du scénario, jamais une donnée réelle) et nomme explicitement le grain qu'il
ajoute (« article ») sans réutiliser un terme déjà pris par une autre entité du domaine
(`Produit` existe déjà et désigne le catalogue réel, `produitId` reste la FK de rapprochement vers
lui — `AlimentArticlePrevision` n'est pas un `Produit`, c'est une ligne d'achat prévisionnelle qui
*référence* optionnellement un `Produit`).

```prisma
model AlimentPrevision {
  id                   String                  @id @default(cuid())
  scenarioId           String
  scenario             ScenarioPrevision       @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  /**
   * Taille de granulé — porte désormais l'identité du calibre. NOT NULL (amendement PR2-quater) :
   * une granulométrie non identifiée ne peut plus être créée ni persister — R7, décision explicite,
   * pas une nullabilité par défaut. Cf. 12.2.5 pour le garde-fou de migration.
   */
  tailleGranule        TailleGranule
  /**
   * Coefficient de besoin en aliment : sacs de cette granulométrie par tonne de POISSON produit.
   * Inchangé depuis l'amendement section 11 — reste au niveau calibre, jamais à l'article : ce
   * coefficient dépend de la granulométrie, pas de la marque qui la fabrique (12.1). Nullable :
   * null = non configuré, tout calcul qui en dépend rejette explicitement (section 11.2).
   */
  sacsParTonneStandard Decimal?
  ordre                Int                     // ordre d'affichage des calibres dans le scénario
  siteId               String
  site                 Site                    @relation(fields: [siteId], references: [id])

  articles             AlimentArticlePrevision[]
  repartitions         RepartitionMoisAliment[]  // grain calibre, inchangé (12.2.2)

  createdAt            DateTime                @default(now())
  updatedAt            DateTime                @updatedAt

  @@unique([scenarioId, tailleGranule])          // AJOUTE (amendement PR2-quater) — un calibre par scénario
  @@index([scenarioId])
  @@index([siteId])
}

model AlimentArticlePrevision {
  id                          String            @id @default(cuid())
  alimentCalibrePrevisionId   String
  alimentCalibrePrevision     AlimentPrevision  @relation(fields: [alimentCalibrePrevisionId], references: [id], onDelete: Cascade)
  /**
   * Rapprochement uniquement — jamais lu par le moteur de calcul (décision 1, inchangée).
   * Nullable : un article prévisionnel peut ne correspondre à aucun produit réel du catalogue.
   */
  produitId                   String?
  produit                     Produit?          @relation(fields: [produitId], references: [id], onDelete: SetNull)
  libelle                     String            // copié depuis Produit.nom à la création, puis libre
                                                 // (ex. "Marque A — sac 15kg") — descend depuis le calibre (12.1)
  poidsSacKg                  Decimal           // copié depuis Produit.contenance à la création
  prixSacFCFA                 Decimal           // copié depuis Produit.prixUnitaire à la création
  /**
   * Pur ratio d'unité de poids (1000 / poidsSacKg) — descend depuis le calibre avec poidsSacKg,
   * dont il est dérivé (ERR-138 : ne doit jamais entrer dans un calcul de besoin par tonne de
   * poisson, cf. sacsParTonneStandard ci-dessus, qui lui reste au calibre).
   */
  sacsParTonneUnitaire        Decimal
  /**
   * Part de ce article dans l'approvisionnement du calibre, en pourcentage (0..100). La somme des
   * partApprovisionnementPct de tous les articles d'un même calibre doit valoir exactement 100 —
   * validée à l'écriture (12.2.3), jamais par contrainte SQL (même raison qu'en 3.5).
   */
  partApprovisionnementPct    Decimal
  ordre                       Int               // ordre d'affichage des articles au sein du calibre
  siteId                      String
  site                        Site              @relation(fields: [siteId], references: [id])

  createdAt                   DateTime          @default(now())
  updatedAt                   DateTime          @updatedAt

  @@index([alimentCalibrePrevisionId])
  @@index([siteId])
  @@index([produitId])
}
```

**Tableau champ par champ — ce que devient chaque champ de l'ancien `AlimentPrevision` :**

| Champ (ancien `AlimentPrevision`) | Destination | Raison |
|---|---|---|
| `id` | Calibre (conservé) | PK inchangée — conséquence de l'arbitrage 2, aucune FK fille à remapper |
| `scenarioId`/`scenario` | Calibre | inchangé, propriété du scénario |
| `produitId`/`produit` | Article | le rapprochement se fait par article acheté, pas par calibre abstrait |
| `libelle` | Article | distingue les articles d'un même calibre (marque, conditionnement) ; le calibre n'a plus besoin de libellé propre, son affichage vient de `tailleGranule` (12.2.4) |
| `tailleGranule` | Calibre (rendu `NOT NULL`) | devient l'identité du calibre (12.1) |
| `poidsSacKg` | Article | varie par marque/conditionnement, pilote le coût |
| `prixSacFCFA` | Article | varie par marque, pilote le coût |
| `sacsParTonneUnitaire` | Article | dérivé de `poidsSacKg`, qui est désormais un attribut d'article (12.1) |
| `sacsParTonneStandard` | Calibre (inchangé depuis la section 11) | coefficient biologique, dépend de la granulométrie, pas de la marque |
| `ordre` | Les deux (un `ordre` par niveau) | affichage des calibres entre eux, et des articles au sein d'un calibre — deux besoins distincts |
| `siteId` | Les deux (R8) | chaque modèle porte son propre `siteId` |
| — (nouveau) | Article : `partApprovisionnementPct` | n'existait pas dans le modèle à une ligne — nécessaire dès que N > 1 (12.2.3) |

### 12.4 Ce que le moteur pur ne doit pas subir

Aucune fonction **existante** de `src/lib/previsions/aliments.ts` ni `types.ts` ne change de
signature ni de comportement. C'est exactement le même découplage que celui déjà établi et confirmé
par la section 11.4 : `calculerBesoinAlimentMensuel`, `appliquerPalierRemise`,
`apportionnerCoutAlimentMensuel`, `calculerCoutAlimentVague` et
`calculerCoutAlimentGranulometrieParMois` consomment déjà des valeurs composées par l'appelant
(`besoinTotalCycleKg`, `poidsSacKg`, `prixSacFCFA`, `sacsParTonneStandard`) — elles n'ont jamais lu
directement un modèle Prisma ni connu l'existence d'un article. Le passage à deux niveaux, **même
après la révision de l'arbitrage 1** (somme article par article plutôt que moyenne pondérée), ne
change **rien** à la forme de ces arguments : c'est la composition en amont qui change (répartition
des sacs entre articles puis somme des coûts, arbitrage 1 révisé), pas les fonctions elles-mêmes.
La seule addition est une **nouvelle** fonction pure (`repartirSacsEntreArticles`, arbitrage 1),
ajoutée à côté des fonctions existantes, jamais à la place de l'une d'elles. Le moteur reste donc
protégé par la recette (1270 tests) et n'a besoin d'aucune revérification — seule la nouvelle
fonction de répartition exige des tests dédiés, non issus du jeu d'or (arbitrage 1).

**Les seuls fichiers qui portent le changement** :
- `prisma/schema.prisma` (section 12.3) et sa migration versionnée (12.2.5).
- `src/lib/queries/previsions-aliments.ts`, `previsions-scenarios.ts` (notamment
  `copierAlimentsPrevisionDepuisProduits`, à regrouper par `tailleGranule` plutôt que par `Produit`),
  `previsions-scenario-loader.ts` (le chargeur, qui doit désormais composer les valeurs de référence
  pondérées avant d'appeler l'orchestration).
- `src/lib/previsions/route-orchestration.ts` (et son `types.ts` propre à la couche orchestration,
  pas celui du moteur) : c'est le seul point qui reçoit les valeurs de référence composées et les
  transmet, inchangées dans leur forme, au moteur.
- `src/lib/previsions/validation.ts` : nouvelle fonction `validerSommeApprovisionnementArticles`.
- `src/types/models.ts`, `src/types/index.ts`, `src/types/api.ts` : nouveau type
  `AlimentArticlePrevision`, DTO `AlimentPrevisionDTO` restructuré.
- Couche API (`src/app/api/previsions/scenarios/[id]/aliments/**`, nouvelle route
  `.../aliments/[id]/articles`) et couche UI (`src/components/previsions/aliments-tab.tsx`,
  `aliment-form-dialog.tsx` — qui doit désormais exposer `tailleGranule`/`produitId`, corrigeant le
  second défaut de 12.1).

### 12.5 Pourquoi le modèle initial était faux — et ce que ça enseigne

Le modèle de la section 3.5, même après l'amendement de la section 11, restait construit sur une
hypothèse implicite jamais énoncée : « un calibre a exactement un fournisseur ». Cette hypothèse
n'était fausse dans aucun des deux jeux de données utilisés jusqu'ici pour recetter le module — ni
le classeur Excel de référence, ni les fixtures qui en dérivent — parce qu'aucun des deux n'a jamais
eu besoin de représenter deux marques pour la même granulométrie. Un jeu de test qui ne rejoue
qu'un cas dégénéré (ici, N = 1 article par calibre) ne peut structurellement pas révéler une
confusion de deux natures qui, dans ce cas dégénéré précis, coïncident parfaitement en valeur.
C'est la même mécanique que ERR-138 (un nom partagé entre deux grandeurs ne se voit que quand elles
divergent), élevée d'un champ à un modèle entier : ici, c'est une **ligne** entière qui joue
simultanément le rôle de calibre et le rôle d'article, et rien dans les données de recette
disponibles ne pouvait forcer ces deux rôles à diverger et donc à révéler la confusion.

La leçon, concrète et actionnable pour la suite du projet : quand un modèle est validé exclusivement
contre un jeu d'or externe (ici, un classeur Excel préexistant), la couverture de la recette est
bornée par la richesse structurelle de ce jeu d'or, pas seulement par le nombre de ses lignes. 1270
tests à 0 écart ne garantissaient rien sur un axe (multiplicité article-par-calibre) que le classeur
source ne représentait jamais — un grand nombre de tests contre une seule structure de données reste
aveugle à toute variation de structure absente de cette donnée. Avant de figer un modèle de données
sur la seule base d'un jeu d'or existant, il faut se demander explicitement : « quelles variantes
structurelles ce jeu de référence ne contient-il jamais, et qui pourraient pourtant survenir en
production ? » — c'est cette question, posée trop tard ici (après la mise en production réelle du
module, pas avant), qui aurait dû faire émerger le modèle à deux niveaux dès l'ADR d'origine.

**Note de traçabilité (2026-08-03).** Le même mécanisme s'est reproduit une deuxième fois, un cran
plus loin : l'arbitrage 1 (12.2), lui-même conçu pour corriger cette leçon, a d'abord retenu une
moyenne pondérée — validée par une démonstration algébrique correcte, mais correcte uniquement pour
le cas dégénéré `N = 1`, le seul que la recette pouvait exercer. L'utilisateur a tranché après coup
que la règle de coût devait être une somme article par article, pas une moyenne (12.2, arbitrage 1,
version révisée). La leçon ci-dessus s'applique donc récursivement à ses propres corrections : une
preuve de non-régression sur le seul cas dégénéré valide l'absence de régression, jamais le bien-fondé
de la règle en général — les deux questions sont indépendantes, et seule la seconde a changé ici.

### 12.6 Ergonomie : le cas nominal est un article unique

**Contrainte de conception actée par l'utilisateur, pas une remarque en passant.** « Généralement,
pour les prévisions, on ne rentrera pas deux articles d'un même calibre, même si la réalité peut
être autre. » Le modèle à deux niveaux (12.3) doit rester **correct** pour le cas multi-article — la
réalité l'exige, un pisciculteur peut réellement s'approvisionner en deux marques du même calibre —
mais il ne doit **jamais alourdir** le chemin normal, qui reste et restera très majoritairement à un
seul article par calibre. **Si un compromis d'ergonomie doit être fait, c'est le cas nominal qui
gagne**, jamais le cas multi-article.

**Créer un calibre crée son article dans le même geste.** Pas deux formulaires enchaînés, pas de
calibre orphelin qu'il faudrait ensuite penser à peupler avant qu'un calcul ne rejette (12.2,
arbitrage 1) faute d'article. Le formulaire de création d'un calibre demande, en une seule fois :
`tailleGranule`, `sacsParTonneStandard` (coefficient de besoin, niveau calibre), et les
caractéristiques de son article unique — `libelle`/marque, `poidsSacKg`, `prixSacFCFA`, `produitId`
optionnel. **Côté API, c'est une seule route transactionnelle** (`POST
/api/previsions/scenarios/[id]/aliments`) qui crée l'`AlimentPrevision` (calibre) et son unique
`AlimentArticlePrevision` enfant dans la **même transaction Prisma** — jamais deux appels distincts
côté client (un pour le calibre, un pour l'article), qui exposeraient une fenêtre où un calibre
existe sans article et échouerait aux calculs en aval sans qu'aucune action utilisateur explicite ne
l'ait demandé.

**La part d'approvisionnement n'apparaît pas tant qu'il n'y a qu'un article.** Elle vaut 100 %
implicitement — demander « 100 % » sur un article unique n'apporte aucune information et n'est
qu'un champ de plus où l'utilisateur peut se tromper (par exemple saisir 90 % par réflexe et
laisser un calibre en somme non conforme, arbitrage 3). Le modèle porte cette valeur sans que l'UI
ne la demande : `partApprovisionnementPct = 100` est écrit par le serveur, dans la même transaction
que la création décrite ci-dessus, sans champ correspondant dans le formulaire tant qu'un seul
article existe pour ce calibre. La colonne reste `Decimal` non nullable (aucune sémantique
`null` = 100 % à inventer) — c'est une valeur réelle, simplement non demandée à l'utilisateur pour
ce cas.

**Ajouter un second article est une action secondaire délibérée**, sur un calibre déjà existant, via
une action explicite (« Ajouter un article » sur la carte du calibre), jamais une option visible par
défaut au même niveau que la création du calibre. C'est seulement à ce moment que la part
d'approvisionnement devient visible et saisissable pour **tous** les articles du calibre (y compris
celui déjà existant, dont la part passe de 100 % implicite à une valeur explicite que l'utilisateur
doit désormais répartir avec le nouvel article) — et que la contrainte de somme à 100 % (arbitrage
3) s'active comme validation bloquante visible dans le formulaire, alors qu'elle était vérifiée
silencieusement (et toujours vraie par construction) tant qu'un seul article existait.

**Conséquence sur la forme de l'UI.** Ce n'est pas « une liste de calibres, chacune contenant une
liste d'articles » affichée à plat dès le départ — c'est « une liste de calibres, chacun affichant
directement les caractéristiques de son article (poids, prix, marque) comme s'il s'agissait d'une
seule entité, avec la possibilité d'en révéler/ajouter d'autres ». **La hiérarchie à deux niveaux
reste invisible tant qu'elle est inutile** : un utilisateur qui ne gère jamais qu'une marque par
calibre ne voit jamais l'existence d'un niveau « article » distinct du calibre — il voit un
formulaire de calibre qui contient, comme avant l'amendement 12, un poids de sac et un prix.

## 13. Amendement (Sprint PR2-septies, 2026-08-04) — la remise fournisseur se décide au tonnage de la vague

**Origine.** ERR-143, ouverte depuis le sprint PR2-bis (story PR2bis.4, découverte par le @tester en
recettant `calculerProjectionScenario`), toujours non traitée deux sprints plus tard. Cette section
la tranche. Aucune ligne de code de production n'est modifiée par cette section — seul ce document
est écrit ; le schéma, le moteur, la recette et l'UI sont corrigés par les stories suivantes du
sprint.

**Ce qui est acté ici, en une phrase :** la remise fournisseur est décidée **une seule fois par
`VaguePrevue`, à partir du tonnage visé de cette vague**, et s'applique au coût d'aliment agrégé de
la vague, toutes granulométries et tous articles confondus. `PalierRemise.seuilSacs` est renommé
**`seuilTonnes`** et devient un seuil exprimé en **tonnes** (§13.3).

### 13.1 Pourquoi `seuilSacs` était faux — une déviation de la spécification depuis l'origine

Il faut le dire sans détour, parce que la formulation compte pour la suite du projet : **ce n'est
pas un besoin qui a évolué, c'est la section 3.4 de cet ADR qui n'a jamais reproduit la règle
écrite dans les exigences fonctionnelles.** L'erreur est d'origine.

Le §4.3 des exigences définit sans ambiguïté :

> `remise_fournisseur` = palier dont le seuil est le plus grand **≤ objectif_tonnage_t**

Trois propriétés y sont énoncées, et les trois ont été perdues en chemin :

1. la grandeur comparée au seuil est un **tonnage**, pas un nombre de sacs ;
2. ce tonnage est l'**objectif de la vague** — la remise se décide donc **par vague**, une fois ;
3. la remise ainsi décidée s'applique à **l'ensemble** du coût d'aliment de cette vague, pas
   granulométrie par granulométrie.

La section 3.4 de cet ADR a modélisé `PalierRemise.seuilSacs` comme « quantité de sacs à partir de
laquelle le palier s'applique », et `appliquerPalierRemise` (`src/lib/previsions/aliments.ts`)
compare, conformément à ce modèle, ce seuil au nombre de sacs **d'une seule granulométrie**. Le
modèle et le code sont cohérents entre eux ; ils sont cohérents avec la mauvaise règle. Aucune étape
du processus n'a comparé la section 3.4 au §4.3 avant de figer le schéma : le défaut n'a pas été
introduit, il n'a jamais été absent.

C'est la raison pour laquelle la caractérisation d'ERR-143 (« deux options : (a) assumer une remise
globale par scénario comme un écart produit assumé, (b) scoper `PalierRemise` par
`AlimentPrevision` ») doit être écartée telle quelle : **aucune des deux options ouvertes n'est la
bonne**, parce que les deux raisonnent encore en sacs et en granulométrie. La bonne réponse — une
troisième, jamais listée — est de revenir à la règle écrite : un seuil en tonnes, évalué une fois
par vague. Un arbitrage entre deux options qui manquent toutes les deux la spécification est un
arbitrage à refuser, pas à trancher.

### 13.2 La démonstration de l'inexprimabilité — chiffrée, sur le plan de référence

Le modèle actuel ne rend pas la règle du §4.3 seulement « moins pratique » : il la rend
**inexprimable depuis l'interface**. Démonstration sur le plan de référence
(`prisma/fixtures/previsions/plan-v12-corrige.json`), vague à 15 tonnes visées, coefficients de
besoin `sacsParTonneStandard` de 8 / 18 / 50 sacs par tonne de poisson pour le 2 mm / 3 mm / 4 mm :

| Granulométrie | `sacsParTonneStandard` | Sacs sur le cycle pour 15 t |
|---|---|---|
| 2 mm | 8 | **120** |
| 3 mm | 18 | **270** |
| 4 mm | 50 | **750** |

Les paliers du classeur sont un jeu **unique** par scénario (`Paramètres!B16:C19`) : 0 t → 0 %,
5 t → 2 %, 10 t → 4 %, 15 t → 6 %. La règle du §4.3 attribue à cette vague **6 %, une fois, pour
tout son aliment**. Avec un seuil en sacs, il faudrait qu'un même jeu de quatre seuils place
simultanément 120, 270 et 750 dans le palier « 6 % » et, pour une vague de 5 t, place simultanément
40, 90 et 250 dans le palier « 2 % ». C'est arithmétiquement impossible avec un jeu de seuils
unique : il faudrait **trois jeux de seuils distincts, un par calibre, chacun mis à l'échelle par
le coefficient de besoin de ce calibre** — or `PalierRemise` est attaché au **scénario** (section
3.4), pas au calibre, et la mise à l'échelle par `sacsParTonneStandard` n'est exposée nulle part
dans un formulaire.

**Conséquence : un utilisateur ne peut pas saisir, dans l'onglet Paramètres, un jeu de paliers qui
reproduise le plan de référence.** Ce n'est pas une gêne d'ergonomie, c'est une fonctionnalité
absente : la reproduction du plan de référence (277 369 600 FCFA de coût aliments) est hors
d'atteinte depuis l'interface, quelle que soit la saisie.

### 13.3 Ce qui remplace `seuilSacs`

**Règle en vigueur.** Pour chaque `VaguePrevue` :

```
remisePct(vague) = pourcentageRemise du palier dont le seuil (en tonnes) est le plus grand
                   parmi ceux ≤ tonnageCibleTonnes(vague)
                 = 0 si aucun palier n'est atteint

coutAlimentVagueFCFA = (1 − remisePct / 100) × Σ_calibres Σ_articles (sacs_article × prixSac_article)
```

Trois points, chacun opposé à un piège déjà rencontré dans ce module :

- **Le palier est décidé une fois pour la vague**, à partir de son tonnage visé — jamais par
  calibre, jamais par article, jamais sur un total mensuel toutes vagues confondues (le README des
  fixtures, « Vérifications numériques effectuées », point 2, le démontre : un mois donné agrège des
  vagues à des taux de remise différents, ce qu'un calcul mensuel agrégé ne peut pas reproduire).
- **Elle s'applique au coût agrégé de la vague**, calculé lui-même par la somme article par article
  actée en §12.2 arbitrage 1 — cette règle de coût est **inchangée**. Ce que la présente section
  amende dans §12.2 arbitrage 1 est uniquement le **niveau auquel le palier est décidé** : ce
  paragraphe disait « la remise est décidée une fois pour tout le calibre, jamais par article » ;
  il faut désormais lire « une fois pour toute la vague, jamais par calibre ni par article ». C'est
  un renforcement de la même intention (ne jamais évaluer un seuil sur un sous-volume, ce qui
  produirait mécaniquement une remise plus faible), remonté d'un cran.
- **La ventilation mensuelle reste postérieure à la remise** : le montant déjà remisé est réparti
  par les pourcentages de `RepartitionMoisAliment` (`apportionnerCoutAlimentMensuel`), jamais une
  remise recalculée mois par mois. Cette sémantique, déjà vérifiée numériquement par la recette
  PR1.4, est confirmée sans changement.

**Conséquence sur le contrat du moteur.** La grandeur d'entrée qui décide du palier n'est plus un
nombre de sacs mais un **tonnage** (`Decimal`, en tonnes) ; le point d'application de la remise
n'est plus un coût de calibre mais le **coût agrégé de la vague**. La forme exacte que prend cette
correction dans `src/lib/previsions/aliments.ts` (signature de `appliquerPalierRemise`, éventuelle
fonction dédiée à la décision de palier séparée du calcul de coût) est laissée à la pré-analyse et
à l'implémentation — cet ADR fige le **résultat attendu**, pas le découpage des fonctions. Une seule
contrainte est non négociable : la décision de palier ne doit plus, nulle part dans la chaîne,
prendre un nombre de sacs comme grandeur de comparaison.

**Les deux points laissés ouverts sont désormais tranchés — clôture après pré-analyse.** La version
initiale de cette section renvoyait le nom du champ et la stratégie de conversion à la pré-analyse
puis au @db-specialist. La pré-analyse (`docs/analysis/pre-analysis-sprint-PR2-septies.md`) a rendu
les deux éléments factuels qui manquaient ; les deux points sont clos ici, et **plus rien de §13.3
n'est ouvert**.

1. **Le nom retenu est `seuilTonnes`, de type `Decimal` nu, sans annotation `@db.Decimal(p,s)`.**
   Trois raisons : (a) les fixtures du jeu d'or nomment déjà ce champ `seuilTonnes`
   (`prisma/fixtures/previsions/plan-v12-corrige.json`, `annexe-b-corrigee.json`, `$source:
   "Paramètres!B16:C19"`) — garder un autre nom créerait un troisième vocabulaire entre le
   classeur, la fixture et le schéma ; (b) **l'unité reste dans le nom**, parce que c'est la
   confusion d'unité qui a produit ERR-138/ERR-139 (facteur ~8300) — un `seuil` nu serait une
   régression méthodologique, pas une simplification ; (c) **aucun** champ du module Prévisions ne
   porte d'annotation `@db.Decimal` (tous en `DECIMAL(65,30)`, défaut Prisma, cf.
   `prisma/migrations/20260803120100_add_previsions_module/migration.sql`), et introduire ici une
   précision arbitraire ferait de ce champ la seule exception d'un modèle homogène, sans gain (un
   tonnage au kilogramme près est très largement dans la portée du défaut).
2. **La migration est un renommage pur, sans conversion — parce qu'il n'y a rien à convertir.**
   Fait vérifié en base par la pré-analyse : `SELECT count(*) FROM "PalierRemise"` = **0 ligne**,
   tous scénarios et tous sites confondus, `EXCEL-V12` compris ; `prisma/seed.sql` ne contient
   qu'un `DELETE FROM "PalierRemise";` et aucun `INSERT`. L'utilisateur n'a **jamais** saisi de
   paliers. La question de la conversion sacs→tonnes est donc sans objet en pratique — mais la
   raison de la refuser reste vraie dans l'absolu et doit être écrite : `sacsParTonneStandard` vaut
   8 / 18 / 50 selon la granulométrie, un `seuilSacs` unique par scénario n'appartient à aucune
   granulométrie en particulier, **aucun facteur unique ne permet donc de le convertir** ; toute
   migration qui « devinerait » une conversion inventerait une donnée métier, ce que §12.2
   arbitrage 5 proscrit déjà pour la migration des calibres.

   Ce qui est acté, sous R10 (migration versionnée, idempotente, jamais un script à la main) :
   - `ALTER TABLE "PalierRemise" RENAME COLUMN "seuilSacs" TO "seuilTonnes";` — **jamais** la paire
     `DROP COLUMN` / `ADD COLUMN` que `prisma migrate diff` va générer. C'est le piège d'ERR-140,
     déjà rencontré deux fois sur ce module : le SQL généré se relit et s'édite à la main, avec un
     commentaire d'en-tête expliquant l'édition. Le fait que la table soit vide **ne dispense pas**
     de cette relecture — elle rend seulement l'erreur indolore cette fois-ci, ce qui est
     exactement la circonstance dans laquelle un réflexe se perd.
   - Un **garde-fou de précondition dans la migration elle-même** (jamais dans un script préalable
     qu'un humain devrait penser à lancer, R10) : un bloc qui lève `RAISE EXCEPTION` si
     `count(*) > 0` au moment de l'application, avec un message disant quoi faire (re-saisir les
     seuils en tonnes depuis l'onglet Paramètres). Sur base vide : no-op silencieux. Ce garde-fou
     n'est pas une précaution théorique : il couvre la base de production future et toute base de
     développement où quelqu'un aurait saisi des paliers entre l'écriture de la migration et son
     application — sans lui, des seuils en sacs seraient réinterprétés comme des tonnes, soit un
     facteur 8 à 50 sur la décision de remise.
   - **Écarté : insérer les quatre paliers du classeur** (0 t → 0 %, 5 t → 2 %, 10 t → 4 %,
     15 t → 6 %). Ils sont pourtant documentés et vérifiables (`Paramètres!B16:C19`). Raison du
     rejet : ce sont les **données métier d'un client particulier**, et un `INSERT` conditionné au
     nom de scénario `EXCEL-V12` ferait entrer ces valeurs dans une migration partagée par tous les
     sites. Il n'y a de surcroît **rien à sauver** (0 ligne). L'utilisateur les saisit dans l'UI —
     quatre champs — ce qui a le mérite d'exercer le chemin réel corrigé plutôt que de le
     court-circuiter.

### 13.4 Le sort des contournements de recette — ils doivent disparaître, c'est le critère de fin

**Il y en a trois, pas un.** La version initiale de cette section n'en citait qu'un ; la pré-analyse
en a trouvé deux autres, dont le plus grave. Les trois se retirent dans le même sprint : n'en retirer
que deux reproduirait très exactement le mécanisme qui a rendu ERR-143 invisible pendant deux
sprints — une recette verte qui ne prouve rien sur le chemin de l'utilisateur.

| # | Fichier | Ce qu'il fait | Gravité |
|---|---|---|---|
| 1 | `src/lib/previsions/__tests__/recette/orchestration.ts:159` (`buildCoutAlimentsParVague`) | met à l'échelle `seuilTonnes × sacsParTonneStandard` pour fabriquer un `seuilSacs` | déclaré, commenté |
| 2 | `src/lib/previsions/__tests__/recette/orchestration.ts:358` (`buildCoutAlimentsParVagueEtMois`) | **jumeau du n°1**, même mise à l'échelle, sur la ventilation mensuelle | déclaré, jamais cité |
| 3 | `src/lib/previsions/__tests__/recette/route-orchestration-builder.ts:24-51` | force `paliersRemise: []` — **désactive entièrement la remise** dans la recette de la couche d'orchestration | **le plus grave** |

Le n°3 mérite d'être nommé pour ce qu'il est : **une recette qui neutralise la règle qu'elle prétend
valider.** Sa JSDoc assume la neutralisation et la justifie par l'impossibilité, vraie au moment où
elle a été écrite, de reproduire `planVagues[].coutAlimentsFCFA` via `calculerProjectionScenario`
sans fabriquer un jeu de seuils par granulométrie que le modèle ne supporte pas. C'est la couche
d'orchestration — celle-là même qui a produit les trois bugs de sévérité **Haute** du sprint PR2
(ERR-142) — qui se trouve ainsi recettée sans jamais exercer une seule remise. **Après le correctif,
la justification tombe** : les quatre vrais paliers du classeur deviennent passables tels quels, et
la recette d'orchestration doit comparer des coûts d'aliment **remisés**. C'est le vrai critère de
fin du sprint : sans lui, on aura corrigé le modèle sans jamais prouver que le chemin applicatif
(`route-orchestration.ts`) reproduit le classeur avec remise.

Le jeu d'or le permet — vérification faite : les quatre paliers sont tous atteints par les 19 vagues
(4 t → palier 0 % ; 8 t → 2 % ; 10 t et 12 t → 4 % ; 15 t → 6 %), et deux d'entre eux le sont **au
seuil exact** (10 t et 15 t), ce qui exerce réellement la sémantique `≥`. La fixture porte de plus
`planVagues[].remisePct` (0 / 0,02 / 0,04 / 0,06), donc la recette peut vérifier **le pourcentage
retenu lui-même**, pas seulement le montant qui en découle. Aucun prétexte de couverture ne subsiste.

Le n°1, décrit ci-dessous, reste le cas pédagogique — c'est celui dont l'honnêteté déclarée montre le
mieux pourquoi un contournement déclaré reste un défaut.

`buildCoutAlimentsParVague` (`src/lib/previsions/__tests__/recette/orchestration.ts`, l. 133-175)
fabrique aujourd'hui, pour chaque granulométrie, des paliers à la volée :

```
sacsCalcules = objectifTonnes × sacsParTonneStandard
seuilSacs    = seuilTonnes   × sacsParTonneStandard   (même granulométrie)
```

Le rapport `sacs / seuil` est alors strictement égal au rapport `tonnage / seuilTonnes`, donc la
décision de palier obtenue est identique à celle du classeur, pour les trois granulométries. C'est
arithmétiquement juste, et **ce contournement était honnête** : il est commenté comme tel dans le
fichier, il ne se cache pas, il annonce l'adaptation d'unité qu'il opère et pourquoi.

**Mais il rendait la recette plus faible, pas plus forte.** La recette est verte (2300 tests, 0
écart) sur une **arithmétique équivalente à la règle**, jamais sur **la règle telle qu'un
utilisateur peut l'exprimer**. Elle prouvait que le moteur sait multiplier ; elle ne prouvait rien
sur la question qui comptait : « un utilisateur qui saisit les quatre paliers du classeur dans
l'onglet Paramètres obtient-il 277 369 600 FCFA ? » La réponse était non, et la recette ne pouvait
pas le dire, parce que le chemin qu'elle exerçait n'était pas le chemin de l'utilisateur. C'est la
même leçon que §12.5 et ERR-127, sous une forme nouvelle : ici ce n'est pas le jeu d'or qui est
dégénéré, c'est **le harnais de recette qui compose lui-même une entrée qu'aucune interface ne peut
produire**. Un test qui doit transformer ses entrées pour passer signale que le modèle est faux, il
ne le compense pas.

**Critère de fin du sprint, à vérifier explicitement par le @tester puis le @code-reviewer :**

- **n°1 — `buildCoutAlimentsParVague` ne fabrique plus aucun seuil** : elle passe
  `paliersRemise[].seuilTonnes` du fixture **directement** au moteur, sans multiplication par
  `sacsParTonneStandard` ni par quoi que ce soit d'autre ; elle ne construit plus non plus de
  `sacsCalcules` fractionnaire comme proxy d'échelle.
- **n°2 — `buildCoutAlimentsParVagueEtMois` subit exactement le même traitement**, dans le même
  geste. Sa mise à l'échelle est le jumeau de la précédente : la laisser en place laisserait la
  recette de `depenses.aliments[mois]` continuer de masquer le défaut sur la ventilation mensuelle,
  alors même que la recette annuelle serait devenue honnête.
- **n°3 — `route-orchestration-builder.ts` ne met plus `paliersRemise: []`** : il passe les quatre
  paliers réels de la fixture, et la recette d'orchestration compare des coûts **remisés** au jeu
  d'or, y compris le `remisePct` par vague. La JSDoc qui justifiait la neutralisation est
  **supprimée**, pas reformulée : elle décrit une impossibilité qui n'existe plus.
- Les commentaires de contournement qui justifiaient ces trois adaptations sont **supprimés**, pas
  reformulés.
- Vérification mécanique proposée au @tester et au @code-reviewer : `sacsParTonneStandard` ne doit
  plus apparaître dans `src/lib/previsions/__tests__/recette/` en contexte de palier, et
  `paliersRemise: []` doit avoir disparu du builder d'orchestration.
- **Si l'une de ces trois adaptations doit subsister après le correctif, le correctif est
  incomplet** — pas « acceptable en l'état », pas « à revoir plus tard ». La persistance d'un
  contournement est le signe que le moteur n'accepte toujours pas l'entrée que l'utilisateur peut
  produire.
- **Et si l'activation de la remise dans la recette d'orchestration révèle de nouveaux écarts, ce
  sont des découvertes, pas des régressions** : c'est le but même du sprint de les faire
  apparaître. Il est explicitement **interdit** de re-neutraliser la remise pour faire repasser la
  recette — ce serait recréer le n°3 sous un autre nom.
- Corollaire : le commentaire d'homonymie `sacsCalcules` de `aliments.ts` (l. 123-164) perd sa
  branche « RECETTE SEULE », qui ne décrit plus que ce contournement disparu — il doit être mis à
  jour dans le même mouvement, jamais laissé décrire un état révolu.

### 13.5 Conséquence sur l'UI — le champ dit « tonnes », et il l'explique

L'onglet Paramètres (`src/components/previsions/parametres-tab.tsx`, bloc « Paliers de remise »)
affiche aujourd'hui le libellé `previsions.parametresTab.paliers.seuilLabel` = **« Seuil (sacs) »**.
Ce libellé devient **« Seuil (tonnes) »**, dans `fr` et `en` (R1/R2 ne s'appliquent pas ici, mais la
règle de complétude i18n du projet si : aucune clé ajoutée d'un côté sans l'autre).

La description du bloc (`paliers.description`, aujourd'hui « Remise appliquée au volume d'aliment
acheté... ») doit dire ce que la règle fait réellement, conformément au §7.4 des exigences (aide
contextuelle) : **la remise est déterminée par le tonnage visé de chaque vague, et s'applique à
tout l'aliment de cette vague**. Un utilisateur qui lit « volume d'aliment acheté » continue de
penser en sacs — c'est précisément la lecture qui a produit ce défaut, il ne faut pas la laisser
survivre au correctif.

**Vérification (ERR-157).** Le texte du libellé et de la description est prouvable en jsdom (c'est
du contenu de DOM, pas de la mise en page). En revanche, si l'aide contextuelle du §7.4 est rendue
par un `Popover` (composant déjà concerné par ERR-157), **son positionnement et son absence de
débordement à 375 px ne sont prouvables qu'en navigateur réel** — un test jsdom vert sur ce point
ne vaut rien. Toute vérification navigateur du scénario `EXCEL-V12` reste en lecture seule stricte
(`ScenarioPrevision.updatedAt` inchangé avant/après), comme établi lors de PR2-quinquies.

### 13.6 Traçabilité et statut d'ERR-143

Cette section **ferme** ERR-143 sur le plan de la décision (le fix de code et de schéma relève des
stories suivantes du sprint). Deux points de la fiche ERR-143 sont amendés par le présent
amendement, et devront l'être dans `docs/knowledge/ERRORS-AND-FIXES.md` par le @knowledge-keeper :

- **Sa sévérité, « Moyenne », est sous-évaluée.** Le symptôme réel n'est pas un écart de calcul
  dans un cas limite : c'est une règle des exigences fonctionnelles **impossible à saisir depuis
  l'application**, qui interdit la reproduction du plan de référence. C'est une fonctionnalité
  manquante, pas une imprécision.
- **Ses deux options (a)/(b) sont l'une et l'autre écartées** — voir §13.1 : elles raisonnent toutes
  deux en sacs et en granulométrie, quand la spécification raisonne en tonnes et par vague.

La leçon à retenir, distincte de celles déjà consignées : **quand un harnais de recette doit
transformer ses propres entrées pour que le moteur les accepte, il faut lire cette transformation
comme un défaut de modèle, jamais comme une adaptation d'unité anodine.** La question à se poser
devant toute ligne de ce type est : « un utilisateur peut-il produire cette entrée depuis un
formulaire ? » Si la réponse est non, la recette ne teste pas le produit.

### 13.7 `sacsSaisis` et la décision de palier — l'arbitrage, tranché

La pré-analyse a relevé une contradiction littérale entre le correctif et le §3.6 de cet ADR, et a
eu raison d'exiger qu'elle soit tranchée ici plutôt que subie silencieusement par l'implémentation.
Elle est tranchée ci-dessous, et elle l'est **avant** que la story du moteur ne commence.

**Le fait.** `src/lib/previsions/__tests__/aliments.test.ts:373` fige aujourd'hui le comportement
suivant : une surcharge manuelle `sacsSaisisCycle = 50` sur un cycle qui en calculait 26 fait
**franchir un seuil de remise** (seuil à 40 sacs) et change donc le taux appliqué. Après le
correctif, le palier se décide sur le tonnage de la vague : une surcharge de sacs n'a plus aucun
effet sur le taux retenu.

**La distinction qui tranche — ce ne sont pas deux règles concurrentes, ce sont deux grandeurs
différentes.** Il faut refuser la formulation « faut-il faire une exception au COALESCE ? », parce
qu'elle présuppose que les deux calculs prennent la même entrée. Ils ne la prennent pas :

- **Le montant** (le coût d'aliment) se calcule sur un **nombre de sacs**. Le COALESCE du §3.6
  s'y applique **pleinement et sans exception** : `sacsSaisis ?? sacsCalcules`, exactement comme
  avant, sur le coût brut comme sur le coût remisé, sur le cycle comme sur la ventilation
  mensuelle. **Rien ne change ici.** Un utilisateur qui saisit 50 sacs paie 50 sacs.
- **La décision de palier** ne prend plus de nombre de sacs **du tout**. Son entrée est le
  **tonnage visé de la vague** (`effectifAlevinsPrevu × poidsObjectifG / 1 000 000`), grandeur qui
  n'a jamais eu de surcharge manuelle et n'en a pas acquis. Il n'y a donc aucune exception à
  formuler : le §3.6 régit ce qu'on fait d'un nombre de sacs, et ce calcul-ci n'en manipule aucun.

En clair : le §3.6 est **inchangé et intégralement en vigueur**. Ce qui a changé, c'est la liste des
calculs dont l'entrée est un nombre de sacs — la décision de palier en est sortie.

**La conséquence métier, assumée, écrite noir sur blanc :**

> **Un utilisateur qui surcharge manuellement les sacs d'une vague en change le coût, mais pas le
> taux de remise.** 50 sacs au lieu de 26 coûtent 50 sacs ; le palier reste celui du tonnage visé
> de la vague.

**Est-elle désirable ? Oui, et pour deux raisons, pas une seule.**

1. **C'est la règle écrite** (§4.3 des exigences : « palier dont le seuil est le plus grand
   ≤ `objectif_tonnage_t` »). La remise est une condition commerciale négociée sur l'engagement de
   volume de la vague, pas sur les ajustements de terrain constatés en cours de cycle. Un
   pisciculteur qui corrige à la hausse son besoin réel de 3 mm au mois 2 ne renégocie pas son
   barème fournisseur ce jour-là.
2. **L'alternative n'est pas seulement moins fidèle, elle est impossible.** Pour que `sacsSaisis`
   repilote le palier, il faudrait reconvertir des sacs en tonnes — donc diviser par un
   `sacsParTonneStandard` valant 8, 18 ou 50 selon la granulométrie, alors que `sacsSaisis` existe
   par calibre **et** par mois et que le palier se décide une fois pour la vague entière. C'est
   littéralement l'inexprimabilité démontrée en §13.2, réintroduite par l'autre bout. Une
   « exception au COALESCE » ici ne serait pas un choix produit : ce serait le retour du bug.

**Aucune alternative n'est donc proposée, et le point est clos.** Si un besoin réel de « remise
pilotée par le volume réellement commandé » apparaissait un jour, il ne se traiterait pas en
tordant `sacsSaisis` : il se traiterait par une grandeur de tonnage réel révisable au niveau de la
`VaguePrevue` — un autre sujet, un autre ADR.

**Instruction opératoire pour @developer et @tester — ce que devient
`aliments.test.ts:373-390`.** Le test n'est pas supprimé (il couvre une garantie qui reste vraie),
il est **réécrit et renommé** pour figer les deux moitiés de l'arbitrage au lieu d'une seule :

- **Titre actuel** : « COALESCE(sacsSaisisCycle, sacsCalculesCycle) : la surcharge manuelle prime
  pour la décision de remise du cycle » → **à remplacer** par : « COALESCE(sacsSaisisCycle,
  sacsCalculesCycle) : la surcharge manuelle pilote le MONTANT, jamais le palier de remise
  (ADR-053 §13.7) ».
- **Assertion actuelle** (`montantFCFA.equals(675000)`, soit 50 × 15 000 × 0,9, la remise de 10 %
  ayant été déclenchée par les 50 sacs surchargés) → **à remplacer** par deux assertions
  complémentaires, sur des paliers désormais exprimés en tonnes :
  1. **surcharge à la hausse, tonnage sous le seuil** → le montant suit la surcharge et **aucune**
     remise ne s'applique : `50 × 15 000 × 1 = 750 000`, et `pourcentageRemiseApplique = 0`. C'est
     la moitié « la surcharge ne franchit plus de seuil ».
  2. **surcharge quelconque, tonnage au-dessus du seuil** → la remise s'applique **quand même**,
     sur le montant issu de la surcharge. C'est la moitié « le palier ne dépend que de la vague »,
     et elle interdit la lecture paresseuse « surcharger désactive la remise », qui serait tout
     aussi fausse.
- Un commentaire de justification renvoyant à la présente §13.7 accompagne la réécriture : un test
  dont l'assertion s'inverse sans trace écrite est, dans six mois, indiscernable d'une régression
  entérinée.
- La JSDoc de `src/lib/previsions/route-orchestration.ts` (bloc d'en-tête, l. 90-125) décrit encore
  l'ancienne sémantique : elle est mise à jour dans le même mouvement.

### 13.8 Nettoyages de contrat corollaires — trois points tranchés, pas laissés à l'appréciation

Trois éléments périphériques deviennent faux ou insuffisants du fait du correctif. Aucun n'est un
détail d'implémentation : chacun est un contrat visible (par le code appelant, par l'utilisateur, ou
par la base), et chacun est tranché ici.

**1. `RemiseAppliqueeResult.sacs` est supprimé, pas conservé.** Une fois le palier décidé au
tonnage, la fonction ne reçoit plus de nombre de sacs : un champ `sacs` dans son résultat n'aurait
plus de référent. Le conserver « au cas où » ajouterait une **troisième** homonymie à un module qui
en documente déjà deux (`sacsCalcules` / `sacsCalculesCycle`) — et c'est précisément l'accumulation
d'homonymies qui a rendu ERR-138 possible. Vérifié par la pré-analyse : le seul appelant applicatif
(`route-orchestration.ts`) ne lit que `pourcentageRemiseApplique`. La suppression ne coûte rien et
elle ferme une porte. **Un champ qui n'a plus de signification se supprime le jour où il la perd**,
jamais « au prochain nettoyage ».

**2. Le message d'erreur de `validerPaliersRemiseCroissants` est renommé.**
`src/lib/previsions/validation.ts:66-68` porte la chaîne `seuilSacs` dans un message **destiné à
l'utilisateur final**, pas dans un commentaire. Sans ce renommage, un utilisateur saisit un « Seuil
(tonnes) » dans un formulaire et reçoit en retour une erreur parlant de « seuilSacs » — soit
exactement le vocabulaire faux qu'on vient de retirer de l'UI, ressurgi par le chemin le moins
surveillé. Le renommage d'un champ n'est terminé que quand il a atteint **les messages d'erreur**,
pas seulement les types et les libellés.

**3. `@@unique([scenarioId, ordre])` est ajoutée MAINTENANT, dans la migration de ce sprint.**
`PalierRemise` n'a aujourd'hui ni cette contrainte ni aucune garantie de croissance des seuils au
niveau base. Décision : **on l'ajoute maintenant**, et voici pourquoi le report serait le mauvais
choix :

- **Le coût est nul et il ne le sera plus jamais autant.** La table est **vide** (0 ligne, §13.3) :
  aucun risque de migration qui échoue sur des doublons préexistants, aucun arbitrage sur les
  données à corriger. Reporter, c'est choisir d'ajouter la contrainte plus tard sur une table
  peuplée, donc avec un backfill et un risque d'échec — un report qui **augmente** le coût futur.
- **Le chemin d'écriture est déjà compatible.** `mettreAJourPaliersRemise`
  (`src/lib/queries/previsions-scenarios.ts`) applique un `deleteMany` puis un `createMany` dans
  une transaction : la contrainte ne peut créer aucun conflit transitoire.
- **Le défaut qu'elle ferme est réel.** Deux paliers de même `ordre` rendraient le `orderBy: { ordre:
  "asc" }` non déterministe, donc la remise appliquée dépendrait de l'ordre d'insertion — un défaut
  silencieux, du type exact de ceux que ce module a payé cher.
- **La règle de conduite qu'on applique** : quand un sprint ouvre déjà une table pour la modifier,
  les contraintes manquantes de cette table se posent dans la même migration. Y revenir plus tard
  coûte une migration de plus et suppose que quelqu'un s'en souvienne.

**Ce qui n'est en revanche PAS ajouté : une contrainte de croissance des seuils au niveau base.**
Elle porte sur la **relation entre lignes** d'un même scénario (chaque `seuilTonnes` strictement
supérieur au précédent dans l'ordre des `ordre`), ce qu'une contrainte SQL déclarative n'exprime
pas — il faudrait un trigger, c'est-à-dire de la logique métier déportée en base, invisible depuis
le code et non testée par la suite Vitest. Cette validation reste où elle est :
`validerPaliersRemiseCroissants`, appelée avant écriture. **Cette frontière est assumée et doit être
documentée par le test**, pas déplacée : le moteur pur ne revalide pas la cohérence des paliers
qu'on lui passe, et un test de cas limite doit figer ce fait plutôt que faire croire à une garantie
qui n'existe pas.

## 14. Amendement (Sprint PR2-octies, 2026-08-04) — les alevins ne sont pas toujours achetés

### 14.1 Le manque, et pourquoi il est passé inaperçu jusqu'ici

Le §4.3 des exigences fonctionnelles définit, sur chaque vague, un booléen `alevins_achetes`, avec
la règle explicite « `false` = production interne → coût 0 ». Le §5.3 en tire la formule
`cout_alevins(vague) = alevins_achetes ? nb_alevins × prix_alevin × (1 − remise) : 0`. Ce drapeau
n'existe **nulle part** — ni dans `prisma/schema.prisma`, ni dans `src/lib/previsions/types.ts`, ni
dans aucune des tables ou DTO du module tels que décrits en section 3 de cet ADR. En son absence, le
moteur ne connaît qu'une seule branche de la formule : il facture systématiquement l'achat des
alevins, quelle que soit l'origine réelle du lot.

Ce manque n'est pas une négligence de relecture ordinaire : il a traversé la conception initiale du
module (section 3), l'amendement §11 (gap de modèle `sacsParTonneStandard`), l'amendement §12
(modèle à deux niveaux) et l'amendement §13 (remise au tonnage) sans qu'aucun de ces passages ne le
révèle, parce que le jeu d'or lui-même ne peut pas le révéler. Le fichier
`prisma/fixtures/previsions/plan-v12-corrige.json` porte `alevinsAchetes: "NON"` sur ses **19**
vagues, sans exception, et `depenses.alevins` y vaut **0 sur les 21 mois** de la série. Une recette
qui ne connaît qu'un jeu de données où la variable ne varie jamais ne peut, par construction, pas
distinguer « le coût est nul parce que le drapeau vaut faux et que la formule le traite
correctement » de « le coût est nul parce que le champ qui devrait le porter n'existe pas et que
personne ne l'a jamais branché ». C'est exactement le motif d'**ERR-160** (« un jeu d'or peut être
structurellement incapable de discriminer deux formules candidates ») transposé d'un ordre
d'opération à un champ de modèle entier : ce n'est plus une divergence d'arrondi qui se noie faute de
cas discriminant dans les données, c'est un champ absent qui se noie faute de valeur qui varie.
Le constat n'a été fait qu'en relisant le §4.3 des exigences fonctionnelles contre le schéma en
vigueur, à l'ouverture de ce sprint — pas par un test qui aurait échoué.

### 14.2 Ce qui est ajouté, et pourquoi ce couple précis

Deux champs, pas un seul :

```prisma
model VaguePrevue {
  // ... champs existants (section 3.6) inchangés ...
  alevinsAchetes Boolean @default(false)
}

model ParametresPrevision {
  // ... champs existants (section 3.3) inchangés ...
  alevinsAchetesParDefaut Boolean @default(false)
}
```

Le drapeau qui compte pour le calcul est celui de `VaguePrevue` : c'est lui que lit le §5.3, et
c'est à ce niveau qu'il est indexé par les exigences (« alevins_achetes » qualifie une vague, pas un
scénario). Mais l'exposer *uniquement* à ce niveau obligerait l'utilisateur à répondre à la même
question 19 fois — une fois par vague d'un plan — pour une réponse qui, dans l'usage réel observé
sur le jeu d'or, est identique sur toutes les vagues d'un même scénario. `ParametresPrevision`
porte donc un second champ, de nature différente : pas une entrée du moteur, une **valeur
d'amorçage** copiée sur chaque `VaguePrevue` au moment de sa création, éditable ensuite vague par
vague sans que cela ne modifie le paramètre du scénario.

Ce couple n'est pas une invention de ce sprint : c'est la reproduction exacte d'un patron déjà en
place et déjà éprouvé dans le même module, entre `ParametresPrevision.effectifAlevinsParVague` et
`VaguePrevue.effectifAlevinsPrevu` (section 3.3 et 3.6) — un nombre d'alevins qui se décide par
défaut au niveau du scénario, se copie à la création de chaque vague planifiée, puis reste
librement éditable vague par vague sans jamais réagir à un changement ultérieur du défaut. Un
exploitant achète ou produit ses alevins *en général*, exactement comme il vise en général un
effectif d'alevins standard par vague — mais l'un comme l'autre admettent l'exception ponctuelle
(une vague dont le lot d'alevins est exceptionnellement acheté chez un tiers, une vague dont
l'effectif visé diffère). Traiter les deux informations par le même mécanisme, plutôt que
d'inventer un mécanisme différent pour celle-ci, évite d'ajouter au module une deuxième façon de
répondre à la même catégorie de besoin.

Aucun des deux champs n'est nullable (R7) : un `Boolean?` introduirait une troisième branche
implicite — « on ne sait pas » — que ni le §4.3 des exigences ni le moteur (§4 de cet ADR) n'ont de
raison de gérer. `DEFAULT false` sur les deux colonnes, jamais un `Boolean?` corrigé après coup par
une validation applicative.

### 14.3 Pourquoi le défaut est `false`, pas `true`

Deux raisons convergentes, pas une seule :

- **Le jeu d'or.** Les 19 vagues connues du dépôt sont **toutes** en production interne
  (`alevinsAchetes: "NON"`). Un défaut à `false` reproduit ce que le seul cas d'usage réel
  documenté dans farm-flow attend d'un scénario nouvellement créé sans saisie explicite.
- **La non-régression.** Un défaut à `true` changerait silencieusement le résultat de **tout plan
  déjà existant** — y compris `EXCEL-V12`, dont le coût total avoisine 46 millions FCFA sur
  l'ensemble du plan (chiffre déjà consigné dans les rapports de recette de ce module). Poser
  `true` par défaut reviendrait à faire porter, à des scénarios déjà figés et validés, une
  hypothèse d'achat qu'ils n'ont jamais eue — exactement le type de recalcul rétroactif que la
  décision 1 de cet ADR (section 2) interdit par principe pour les paramètres gelés. `false` est la
  seule valeur qui laisse les plans existants inchangés au moment où le champ apparaît.

### 14.4 Le sort de `prixAlevinUnitaireFCFA` — il ne se met jamais à zéro

`ParametresPrevision.prixAlevinUnitaireFCFA` (section 3.3) reste saisi, stocké et affiché
**indépendamment de la valeur du drapeau**, y compris quand celui-ci vaut `false`. Ce n'est pas un
oubli de portée : c'est une décision, et elle mérite d'être écrite en toutes lettres parce que le
contournement inverse est tentant et qu'il a déjà été appliqué une fois dans ce dépôt.

Le prix d'un alevin est une **donnée de paramétrage** — au même titre que
`ParametresPrevision.poidsObjectifG` ou `prixVenteKgFCFA` — pas un résultat dérivé du coût d'achat.
Le mettre à `0` pour « faire correspondre visuellement » un scénario en production interne revient à
effacer une information réelle (combien coûterait un alevin si on en achetait) au seul motif qu'elle
ne sert pas au calcul du moment. C'est nocif pour une raison précise : le jour où l'exploitant
scinde une vague ou en planifie une nouvelle avec `alevinsAchetes = true`, le moteur relit ce même
champ pour calculer un coût d'achat réel — s'il a été mis à zéro entre-temps, le nouveau scénario
hérite d'un prix faux sans qu'aucune erreur ne se déclenche, puisque `0` est une valeur `Decimal`
parfaitement valide du point de vue du type.

**Fait établi, pas une hypothèse d'école : ce contournement a déjà eu lieu dans ce dépôt.** Sur le
scénario `EXCEL-V12` en base, `prixAlevinUnitaireFCFA` vaut aujourd'hui **0**, alors que le classeur
de référence (`entreesModele.parametresScenario.prixAlevinUnitaireFCFA`) porte **70**. L'information
réelle est déjà perdue sur ce scénario précis, par exactement le mécanisme dénoncé ci-dessus. Le
sprint ne se contente donc pas de poser le drapeau à `false` sur les 19 vagues d'`EXCEL-V12` — il
restaure `70` sur ce même scénario, par une migration idempotente ciblée (`UPDATE` conditionné sur
`code = 'EXCEL-V12'` ET valeur actuelle `= 0`, jamais un `UPDATE` global qui écraserait un `0`
légitimement saisi par un autre site). Sans cette restauration, la correction du drapeau ne changerait
strictement rien au résultat visible du scénario existant (`0 alevin acheté × 70` et `602 500 alevins
× 0` valent tous deux zéro) — mais laisserait le champ continuer de mentir sur le prix réel, ce
qu'une correction censée réparer ce défaut précis ne peut pas se permettre de laisser en l'état.

### 14.5 La logistique alevins ne dépend PAS du drapeau — mise en garde pour tout futur développeur

Deux notions distinctes portent le mot « alevins » dans deux endroits différents du moteur, et les
confondre romprait une vérité opérationnelle simple : **une ferme qui produit ses propres alevins
les transporte quand même**, de l'écloserie interne jusqu'aux bacs de grossissement. Le déplacement
physique d'un lot d'alevins ne dépend pas de la question « qui l'a payé ? ».

Concrètement, dans le code : `LogistiqueMensuelleResult.coutAlevinsFCFA`
(`src/lib/previsions/logistique.ts`) est un coût de **transport** (`voyages ×
coûtUnitaireFCFA`), qui entre dans `base_repartition` (décision 6, section 2) — il ne doit **jamais**
être gaté par `alevinsAchetes`. Seule la variable homonyme de `route-orchestration.ts`, qui calcule
le coût d'**achat** (`alevinsACommanderNb × prixAlevinUnitaireFCFA`, celui visé par le §5.3 des
exigences et par cette section), doit devenir conditionnelle au drapeau.

Ce n'est pas une déduction théorique : c'est **vérifié contre les fixtures**, pas supposé. Sur les 19
vagues du jeu d'or, toutes en production interne, `logistique.voyagesAlevins` et
`logistique.transportAlevins` sont non nuls sur **19 des 21 mois** de la série — la logistique tourne
malgré une production entièrement interne, exactement comme attendu d'une ferme qui doit quand même
déplacer ses propres alevins. Tout futur développeur qui verrait le nom `coutAlevinsFCFA` répété
dans deux fichiers du module et en déduirait qu'un seul gate suffit aux deux romprait cette réalité
opérationnelle en silence. Cette section est la mise en garde explicite destinée à prévenir cette
erreur : le gate sur `alevinsAchetes` s'applique au coût d'achat uniquement, jamais au coût de
transport.

### 14.6 Conséquence de recette — le cas `alevinsAchetes = true` exige une couverture synthétique

Aucune fixture réelle du dépôt ne couvre le cas `alevinsAchetes = true` : les 19 vagues connues sont
toutes en production interne. Une recette qui ne rejouerait que le jeu d'or laisserait donc,
structurellement, la moitié de la formule du §5.3 — la branche `alevins_achetes = true` — sans
aucune exécution. Ce n'est pas acceptable pour une formule qui, une fois le drapeau branché, devient
la seule voie par laquelle un coût d'achat non nul peut apparaître dans un plan. La couverture de
cette branche doit donc être **synthétique**, construite délibérément (un scénario ou une vague de
test où `alevinsAchetes = true` et `prixAlevinUnitaireFCFA` non nul), pas dérivée d'un jeu de données
existant qui ne l'exerce jamais.

### 14.7 Réserve honnête à consigner — un défaut de conception de la recette, révélé par ce sprint

Ce sprint ne se contente pas de révéler un champ manquant : il révèle aussi que la recette actuelle
est **structurellement aveugle** au coût d'achat des alevins, indépendamment même de la question du
drapeau. Le helper `src/lib/previsions/__tests__/recette/orchestration.ts`
(`buildChaineFinanciereCalendrier`) lit `coutAlevinsFCFA` **directement depuis la fixture**
(`entreesModele.planVagues[].coutAlevinsFCFA`, toujours `0` dans le jeu d'or) plutôt que de le
recalculer en appelant le moteur de production. Et dans
`route-orchestration.recette.test.ts`, qui appelle bien le vrai code
(`calculerProjectionScenario`), aucune assertion ne compare directement
`coutAlevinsFCFA`/`resultatFCFA`/`epargneFCFA`/`depensesFCFA` à la série `fixture.depenses.alevins` —
seules des identités algébriques internes sont vérifiées (`resultatFCFA == revenusFCFA + apportsFCFA
- depensesFCFA`, `soldeFCFA[m] - soldeFCFA[m-1] == resultatFCFA[m]`), qui restent vraies **quelle que
soit** la valeur portée par ce terme : un bug dans le coût d'achat des alevins s'y propagerait de
façon parfaitement cohérente, sans jamais casser une seule de ces identités relatives.

Ce point a été vérifié, pas seulement supposé : la suite de recette complète passe intégralement
(480/480 tests) sur l'état du moteur constaté à l'ouverture de ce sprint — un moteur qui facture déjà
un coût d'achat d'alevins non nul sur chaque mois de stockage, un écart de l'ordre de 42 175 000 FCFA
sur l'ensemble du plan, totalement invisible à la recette actuelle. Ce n'est donc pas seulement
l'absence d'un cas discriminant dans les données (§14.1, ERR-160), c'est l'absence d'une assertion
qui aurait exploité une donnée pourtant présente et disponible dans la fixture depuis le début. Ce
défaut de conception de la recette est consigné ici comme tel — il ne se corrige pas en aval du
schéma (cette story), mais il ne doit en aucun cas être considéré comme couvert par le simple fait
que la suite reste verte après le fix : la story qui branchera le moteur sur ce drapeau doit ajouter
l'assertion manquante dans le même mouvement, faute de quoi une régression future sur ce terme
resterait, comme aujourd'hui, invisible.
