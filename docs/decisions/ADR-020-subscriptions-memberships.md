# ADR-020 — Subscriptions & Memberships (Abonnements & Commissions Ingénieurs)

**Date :** 2026-03-20
**Statut :** Acceptée
**Auteur :** @architect
**Sprint :** Phase 4

---

## 1. Contexte et problème

FarmFlow (DKFarm) monétise la plateforme selon deux audiences distinctes :

1. **Promoteurs (Gérants de fermes)** — Ils créent et exploitent des sites piscicoles. Ils paient un abonnement mensuel, trimestriel ou annuel pour accéder aux fonctionnalités selon un palier de capacité (nombre de bacs, de vagues, d'utilisateurs, de sites).
2. **Ingénieurs piscicoles** — Ils supervisent plusieurs fermes clientes et reçoivent une commission sur les abonnements des promoteurs qu'ils ont référés ou suivis. Ils paient eux-mêmes un abonnement professionnel qui détermine le nombre de fermes qu'ils peuvent superviser simultanément.

### Ce qui existe déjà

- Modèles `Pack`, `PackBac`, `PackProduit`, `PackActivation` (Sprint 20) : représentent les kits de démarrage vendus une fois (provisioning physique : alevins + intrants + bacs).
- `StatutActivation` : `ACTIVE`, `EXPIREE`, `SUSPENDUE`.
- `SiteModule.PACKS_PROVISIONING` : module activable par site.
- Les `Pack` sont des produits physiques, pas des abonnements récurrents. Les deux systèmes coexistent mais sont distincts.

### Problème

Il n'existe pas de système gérant :
- Les plans d'abonnement et leur tarification multi-période
- Le cycle de vie d'un abonnement (actif → période de grâce → restreint → suspendu → résilié)
- Les paiements récurrents via Mobile Money (MTN/Orange) au Cameroun
- Les remises (early adopter, saisonnières, referral, coopératives)
- La rémunération des ingénieurs par commission sur abonnements
- Le portefeuille ingénieur et les demandes de virement

---

## 2. Decision Drivers

| Driver | Détail |
|--------|--------|
| Marché camerounais | Paiement principal = Mobile Money (MTN MoMo, Orange Money). Pas de carte bancaire courante. |
| USSD push-based | Mobile Money est une technologie PUSH : l'utilisateur doit approuver chaque transaction via USSD. Il est impossible de débiter automatiquement sans action de l'utilisateur. |
| Connectivité instable | Les webhooks peuvent arriver hors-ordre ou en double. L'idempotence est obligatoire. |
| Simplicité opérationnelle | Phase 1 : un seul agrégateur (Maviance/Smobilpay). Phase 2 : APIs directes MTN + Orange. |
| Isolation multi-tenant | R8 : siteId sur chaque modèle. Les abonnements sont liés au site du promoteur. |
| UPPERCASE enums | R1 : toutes les valeurs d'enum en MAJUSCULES. |
| Réutilisation des patterns | Suivre le pattern API existant : `requirePermission()` → query function → `NextResponse.json()`. |

---

## 3. Tables de tarification

### Packs Promoteurs (FCFA)

| Code plan | Nom affiché | Mensuel | Trimestriel | Annuel | Max Sites | Max Bacs | Max Vagues | Max Utilisateurs |
|-----------|-------------|---------|-------------|--------|-----------|----------|------------|-----------------|
| DECOUVERTE | Découverte (Gratuit) | 0 | — | — | 1 | 3 | 1 | 1 |
| ELEVEUR | Éleveur | 3 000 | 7 500 | 25 000 | 1 | 10 | 3 | 3 |
| PROFESSIONNEL | Professionnel | 8 000 | 20 000 | 70 000 | 3 | 30 | 10 | 10 |
| ENTREPRISE | Entreprise | 25 000+ | Sur devis | Sur devis | Illimité | Illimité | Illimité | Illimité |

### Packs Ingénieurs (FCFA)

| Code plan | Nom affiché | Mensuel | Annuel | Max Fermes supervisées |
|-----------|-------------|---------|--------|------------------------|
| INGENIEUR_STARTER | Ingénieur Starter | 5 000 | 45 000 | 5 |
| INGENIEUR_PRO | Ingénieur Pro | 15 000 | 135 000 | 20 |
| INGENIEUR_EXPERT | Ingénieur Expert | 30 000 | 270 000 | Illimité |

### Remises disponibles

| Code | Description | Valeur | Éligibilité |
|------|-------------|--------|-------------|
| EARLY_ADOPTER_PROMOTEUR | Early adopter promoteur | 50% 1ère année | 100 premiers promoteurs |
| EARLY_ADOPTER_INGENIEUR | Early adopter ingénieur | 50% 1ère année | 20 premiers ingénieurs |
| SAISONNIERE | Promo saisonnière | 20–25% | Périodes définies |
| REFERRAL | Parrainage | 1–2 mois offerts | Code referral valide |
| COOPERATIVE | Groupe coopératif | 30% annuel | 10+ fermes dans le groupe |
| VOLUME_INGENIEUR | Volume ingénieur | 10–20% | Selon nb fermes supervisées |

---

## 4. Nouveaux enums Prisma

```prisma
// Catégorie de plan : promoteur ou ingénieur
enum TypePlan {
  PROMOTEUR
  INGENIEUR
}

// Période de facturation d'un abonnement
enum PeriodeFacturation {
  MENSUEL
  TRIMESTRIEL
  ANNUEL
  GRATUIT
}

// Cycle de vie d'un abonnement
enum StatutAbonnement {
  ACTIF
  PERIODE_GRACE     // J+1 à J+7 après expiry : accès complet
  RESTREINT         // J+8 à J+30 : lecture seule
  SUSPENDU          // J+31 à J+90 : aucun accès, données conservées
  RESILIÉ           // J+91+ : données à risque
  ANNULÉ            // Annulation volontaire avant expiry
}

// Statut d'un paiement d'abonnement
enum StatutPaiementAbo {
  EN_ATTENTE        // Demande USSD envoyée, attente approbation
  EN_COURS          // USSD approuvé, transaction en traitement
  REUSSI
  ECHOUE
  EXPIRE            // USSD non approuvé dans le délai
  REMBOURSE
}

// Type de remise
enum TypeRemise {
  POURCENTAGE
  MONTANT_FIXE
  MOIS_OFFERTS
}

// Statut d'une commission ingénieur
enum StatutCommissionIng {
  EN_ATTENTE         // Abonnement payé, commission calculée
  DISPONIBLE         // Seuil minimum atteint, payout possible
  EN_PAIEMENT        // Virement initié
  PAYEE
  ANNULEE            // Si abonnement remboursé
}

// Fournisseur de paiement Mobile Money
enum FournisseurPaiement {
  MTN_MOMO
  ORANGE_MONEY
  MAVIANCE            // Agrégateur Phase 1
  MANUEL              // Paiement enregistré manuellement par ADMIN
}

// Origine d'un ingénieur sur une ferme (détermine le taux de commission)
enum OrigineSupervision {
  REFERRAL_INGENIEUR  // Ingénieur a référé le promoteur → 20%
  MATCH_PLATEFORME    // Plateforme a mis en relation → 15%
  AJOUT_PROMOTEUR     // Promoteur existant a ajouté l'ingénieur → 10%
}
```

---

## 5. Nouveaux modèles Prisma

> Tous les modèles respectent R8 (siteId présent), R1 (enums UPPERCASE), R7 (nullabilité explicite).

### 5.1 PlanAbonnement — Définition d'un palier tarifaire

```prisma
/**
 * PlanAbonnement — Définition immuable d'un palier tarifaire.
 *
 * Créé uniquement par ADMIN DKFarm. Partagé entre tous les sites.
 * siteId = site DKFarm propriétaire de la définition (R8).
 * Les limites NULL = illimité (cas ENTREPRISE).
 */
model PlanAbonnement {
  id                  String             @id @default(cuid())
  /** Code interne : DECOUVERTE, ELEVEUR, PROFESSIONNEL, ENTREPRISE, INGENIEUR_STARTER … */
  code                String             @unique
  nom                 String
  description         String?
  typePlan            TypePlan
  /** Prix mensuel en FCFA (0 pour plan gratuit) */
  prixMensuel         Float              @default(0)
  /** Prix trimestriel en FCFA (NULL = non disponible) */
  prixTrimestriel     Float?
  /** Prix annuel en FCFA (NULL = non disponible) */
  prixAnnuel          Float?
  /** Max sites gérés (NULL = illimité) */
  maxSites            Int?
  /** Max bacs par site (NULL = illimité) */
  maxBacs             Int?
  /** Max vagues actives par site (NULL = illimité) */
  maxVagues           Int?
  /** Max membres par site (NULL = illimité) */
  maxUtilisateurs     Int?
  /** Max fermes supervisées (plan ingénieur, NULL = illimité) */
  maxFermesSupervises Int?
  /** Modules SiteModule activés pour ce plan */
  modulesInclus       SiteModule[]       @default([])
  isActive            Boolean            @default(true)
  isPublic            Boolean            @default(true)
  /** Position d'affichage sur la page tarifs */
  position            Int                @default(0)
  /** Site DKFarm propriétaire de la définition — R8 */
  siteId              String
  site                Site               @relation(fields: [siteId], references: [id])

  abonnements         Abonnement[]
  remises             Remise[]

  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@index([siteId])
  @@index([typePlan])
  @@index([code])
}
```

### 5.2 Abonnement — Instance active d'un abonnement

```prisma
/**
 * Abonnement — Instance d'un abonnement liant un site promoteur (ou user ingénieur)
 * à un PlanAbonnement.
 *
 * Pour les promoteurs  : abonnedSiteId est renseigné.
 * Pour les ingénieurs  : abonnedUserId est renseigné.
 * siteId = site DKFarm qui émet/gère l'abonnement (R8).
 */
model Abonnement {
  id                  String             @id @default(cuid())
  /** Site promoteur abonné (NULL si abonnement ingénieur) */
  abonnedSiteId       String?
  abonnedSite         Site?              @relation("AbonnementsSite", fields: [abonnedSiteId], references: [id])
  /** Utilisateur ingénieur abonné (NULL si abonnement promoteur) */
  abonnedUserId       String?
  abonnedUser         User?              @relation("AbonnementsUser", fields: [abonnedUserId], references: [id])
  planId              String
  plan                PlanAbonnement     @relation(fields: [planId], references: [id])
  periode             PeriodeFacturation
  statut              StatutAbonnement   @default(ACTIF)
  /** Date de début de la période en cours */
  dateDebut           DateTime
  /** Date d'expiration de la période en cours */
  dateFin             DateTime
  /** Date de la prochaine tentative de facturation */
  dateProchainePeriode DateTime?
  /** Montant facturé pour la période en cours (après remises) */
  montantPeriode      Float
  /** Ingénieur supervisant ce site (NULL si pas de supervision) */
  ingenieurId         String?
  ingenieur           User?              @relation("AbonnementsIngenieur", fields: [ingenieurId], references: [id])
  /** Origine de la supervision (détermine le taux de commission) */
  origineSupervision  OrigineSupervision?
  /** Renouvellement automatique activé (rappel + push USSD) */
  autoRenew           Boolean            @default(true)
  /** Numéro de téléphone Mobile Money pour le paiement automatique */
  phoneMMobile        String?
  /** Fournisseur Mobile Money préféré */
  fournisseurPaiement FournisseurPaiement?
  notes               String?
  /** Site DKFarm gestionnaire — R8 */
  siteId              String
  site                Site               @relation("AbonnementsDKFarm", fields: [siteId], references: [id])

  paiements           PaiementAbonnement[]
  remisesAppliquees   RemiseApplication[]
  commissions         CommissionIngenieur[]

  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@index([siteId])
  @@index([abonnedSiteId])
  @@index([abonnedUserId])
  @@index([planId])
  @@index([statut])
  @@index([dateFin])
  @@index([ingenieurId])
}
```

### 5.3 PaiementAbonnement — Enregistrement d'un paiement

```prisma
/**
 * PaiementAbonnement — Transaction de paiement pour un abonnement.
 *
 * Chaque tentative de paiement (réussie ou non) crée un enregistrement.
 * Idempotence garantie par le champ `reference` (unique).
 * siteId = site DKFarm émetteur (R8).
 */
model PaiementAbonnement {
  id              String              @id @default(cuid())
  abonnementId    String
  abonnement      Abonnement          @relation(fields: [abonnementId], references: [id])
  montant         Float
  /** Référence déterministe : SUB-{abonnementId}-{YYYYMM} */
  reference       String              @unique
  statut          StatutPaiementAbo   @default(EN_ATTENTE)
  fournisseur     FournisseurPaiement
  /** Numéro de téléphone Mobile Money du payeur */
  phonePayeur     String?
  /** ID de transaction retourné par la gateway */
  transactionId   String?
  /** Réponse brute de la gateway (JSON) */
  gatewayResponse Json?
  /** Numéro de tentative pour la période (1 = première tentative) */
  tentative       Int                 @default(1)
  /** Période couverte : date de début */
  periodeDebut    DateTime
  /** Période couverte : date de fin */
  periodeFin      DateTime
  /** Date à laquelle le paiement a été confirmé */
  dateConfirmation DateTime?
  /** Enregistré manuellement par un ADMIN */
  estManuel       Boolean             @default(false)
  userId          String?
  user            User?               @relation(fields: [userId], references: [id])
  /** Site DKFarm — R8 */
  siteId          String
  site            Site                @relation(fields: [siteId], references: [id])

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([abonnementId])
  @@index([siteId])
  @@index([statut])
  @@index([reference])
  @@index([transactionId])
}
```

### 5.4 Remise — Définition d'une remise ou promotion

```prisma
/**
 * Remise — Définition d'une remise applicable à un abonnement.
 *
 * Peut être globale (planId NULL) ou limitée à un plan spécifique.
 * siteId = site DKFarm propriétaire de la remise (R8).
 */
model Remise {
  id                String      @id @default(cuid())
  code              String      @unique
  nom               String
  description       String?
  type              TypeRemise
  /** Valeur : pourcentage (0-100), montant FCFA, ou nombre de mois */
  valeur            Float
  /** Plan auquel cette remise s'applique (NULL = tous les plans) */
  planId            String?
  plan              PlanAbonnement? @relation(fields: [planId], references: [id])
  /** Nombre maximum d'utilisations totales (NULL = illimité) */
  maxUtilisations   Int?
  utilisationsCount Int         @default(0)
  /** Nombre maximum d'utilisations par utilisateur */
  maxParUtilisateur Int         @default(1)
  /** Valable uniquement sur la première période */
  premierePeriodeOnly Boolean   @default(false)
  dateDebut         DateTime?
  dateFin           DateTime?
  isActive          Boolean     @default(true)
  /** Site DKFarm — R8 */
  siteId            String
  site              Site        @relation(fields: [siteId], references: [id])

  applications      RemiseApplication[]

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([siteId])
  @@index([code])
  @@index([planId])
}
```

### 5.5 RemiseApplication — Remise appliquée à un abonnement

```prisma
/**
 * RemiseApplication — Enregistrement d'une remise appliquée à un abonnement.
 *
 * Permet de tracer quelles remises ont été utilisées et par qui.
 */
model RemiseApplication {
  id              String     @id @default(cuid())
  remiseId        String
  remise          Remise     @relation(fields: [remiseId], references: [id])
  abonnementId    String
  abonnement      Abonnement @relation(fields: [abonnementId], references: [id])
  /** Montant effectivement déduit en FCFA */
  montantDeduit   Float
  /** Mois offerts (cas TypeRemise.MOIS_OFFERTS) */
  moisOfferts     Int?
  appliquePar     String?
  user            User?      @relation(fields: [appliquePar], references: [id])

  createdAt       DateTime   @default(now())

  @@unique([remiseId, abonnementId])
  @@index([remiseId])
  @@index([abonnementId])
}
```

### 5.6 CommissionIngenieur — Commission due à un ingénieur

```prisma
/**
 * CommissionIngenieur — Commission calculée pour un ingénieur
 * suite au paiement d'un abonnement d'un site supervisé.
 *
 * Créée automatiquement lors de la confirmation d'un PaiementAbonnement
 * si l'abonnement a un ingenieurId renseigné.
 * siteId = site DKFarm (R8).
 */
model CommissionIngenieur {
  id                  String              @id @default(cuid())
  ingenieurId         String
  ingenieur           User                @relation("CommissionsIngenieur", fields: [ingenieurId], references: [id])
  abonnementId        String
  abonnement          Abonnement          @relation(fields: [abonnementId], references: [id])
  paiementAbonnementId String
  paiementAbonnement  PaiementAbonnement  @relation(fields: [paiementAbonnementId], references: [id])
  /** Taux appliqué selon OrigineSupervision (10%, 15% ou 20%) */
  taux                Float
  /** Base de calcul = montant du paiement hors remises */
  montantBase         Float
  /** Montant de la commission = montantBase * taux */
  montant             Float
  statut              StatutCommissionIng @default(EN_ATTENTE)
  dateCalcul          DateTime            @default(now())
  datePaiement        DateTime?
  portefeuilleId      String?
  portefeuille        PortefeuilleIngenieur? @relation(fields: [portefeuilleId], references: [id])
  notes               String?
  /** Site DKFarm — R8 */
  siteId              String
  site                Site                @relation(fields: [siteId], references: [id])

  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  @@index([ingenieurId])
  @@index([abonnementId])
  @@index([siteId])
  @@index([statut])
  @@index([paiementAbonnementId])
}
```

### 5.7 PortefeuilleIngenieur — Solde et transactions du portefeuille

```prisma
/**
 * PortefeuilleIngenieur — Portefeuille de l'ingénieur.
 *
 * Un ingénieur a exactement un portefeuille.
 * Le solde est la somme des commissions DISPONIBLE + PAYEE (calculé ou maintenu).
 * siteId = site DKFarm (R8).
 */
model PortefeuilleIngenieur {
  id              String               @id @default(cuid())
  ingenieurId     String               @unique
  ingenieur       User                 @relation(fields: [ingenieurId], references: [id])
  /** Solde disponible en FCFA (commissions non encore versées) */
  soldeDisponible Float                @default(0)
  /** Total cumulé versé depuis la création */
  totalVerse      Float                @default(0)
  /** Numéro de téléphone Mobile Money pour les virements */
  phonePaiement   String?
  fournisseurPreference FournisseurPaiement?
  /** Site DKFarm — R8 */
  siteId          String
  site            Site                 @relation(fields: [siteId], references: [id])

  commissions     CommissionIngenieur[]
  demandes        DemandeVirementIngenieur[]

  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  @@index([siteId])
  @@index([ingenieurId])
}
```

### 5.8 DemandeVirementIngenieur — Demande de virement du portefeuille

```prisma
/**
 * DemandeVirementIngenieur — Demande de virement du solde vers Mobile Money.
 *
 * Déclenchée manuellement par l'ingénieur quand solde >= 5 000 FCFA.
 * Traitée par ADMIN DKFarm.
 * siteId = site DKFarm — R8.
 */
model DemandeVirementIngenieur {
  id              String                @id @default(cuid())
  portefeuilleId  String
  portefeuille    PortefeuilleIngenieur @relation(fields: [portefeuilleId], references: [id])
  ingenieurId     String
  ingenieur       User                  @relation(fields: [ingenieurId], references: [id])
  montant         Float
  phoneDest       String
  fournisseur     FournisseurPaiement
  statut          StatutPaiementAbo     @default(EN_ATTENTE)
  /** Référence de la transaction Mobile Money si envoyée */
  referenceVirement String?
  traitePar       String?
  traiteur        User?                 @relation("VirementTraiteur", fields: [traitePar], references: [id])
  dateTraitement  DateTime?
  notes           String?
  /** Site DKFarm — R8 */
  siteId          String
  site            Site                  @relation(fields: [siteId], references: [id])

  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt

  @@index([portefeuilleId])
  @@index([ingenieurId])
  @@index([siteId])
  @@index([statut])
}
```

---

## 6. Nouvelles permissions

Les permissions suivantes sont ajoutées à l'enum `Permission` dans `prisma/schema.prisma` et `src/types/models.ts` :

```prisma
// Abonnements (6)
ABONNEMENTS_VOIR           // Voir son propre abonnement et son historique
ABONNEMENTS_GERER          // Souscrire, changer de plan, activer auto-renew
PLANS_GERER                // ADMIN : créer/modifier les PlanAbonnement
PAIEMENTS_ABO_VOIR         // Voir les paiements d'abonnement
COMMISSIONS_VOIR           // Ingénieur : voir ses commissions et son portefeuille
REMISES_GERER              // ADMIN : créer/modifier les Remise et RemiseApplication
```

### Attribution par rôle (défaut)

| Permission | ADMIN | GERANT | PISCICULTEUR | INGENIEUR |
|------------|-------|--------|--------------|-----------|
| ABONNEMENTS_VOIR | oui | oui | non | oui |
| ABONNEMENTS_GERER | oui | oui | non | oui |
| PLANS_GERER | oui | non | non | non |
| PAIEMENTS_ABO_VOIR | oui | oui | non | oui |
| COMMISSIONS_VOIR | oui | non | non | oui |
| REMISES_GERER | oui | non | non | non |

---

## 7. Routes API

Toutes les routes suivent le pattern existant : `requirePermission()` → query function → `NextResponse.json()`.

### Plans d'abonnement

| Méthode | Route | Permission | Description |
|---------|-------|-----------|-------------|
| GET | `/api/plans` | — (public) | Lister les plans actifs (page tarifs) |
| GET | `/api/plans/[id]` | — (public) | Détail d'un plan |
| POST | `/api/plans` | PLANS_GERER | Créer un plan (ADMIN) |
| PUT | `/api/plans/[id]` | PLANS_GERER | Modifier un plan |
| DELETE | `/api/plans/[id]` | PLANS_GERER | Désactiver un plan |

### Abonnements

| Méthode | Route | Permission | Description |
|---------|-------|-----------|-------------|
| GET | `/api/abonnements` | ABONNEMENTS_VOIR | Abonnement actif du site courant |
| POST | `/api/abonnements` | ABONNEMENTS_GERER | Souscrire à un plan |
| PUT | `/api/abonnements/[id]` | ABONNEMENTS_GERER | Changer de plan / de période |
| POST | `/api/abonnements/[id]/renew` | ABONNEMENTS_GERER | Renouveler manuellement |
| POST | `/api/abonnements/[id]/cancel` | ABONNEMENTS_GERER | Annuler l'abonnement |
| GET | `/api/abonnements/[id]/paiements` | PAIEMENTS_ABO_VOIR | Historique des paiements |
| POST | `/api/admin/abonnements` | PLANS_GERER | ADMIN : lister tous les abonnements |
| PUT | `/api/admin/abonnements/[id]/suspend` | PLANS_GERER | ADMIN : suspendre manuellement |

### Paiements d'abonnement

| Méthode | Route | Permission | Description |
|---------|-------|-----------|-------------|
| POST | `/api/paiements-abo` | ABONNEMENTS_GERER | Initier un paiement Mobile Money |
| GET | `/api/paiements-abo/[id]/status` | PAIEMENTS_ABO_VOIR | Vérifier le statut d'un paiement |
| POST | `/api/paiements-abo/[id]/retry` | ABONNEMENTS_GERER | Relancer une tentative |
| POST | `/api/webhooks/payment` | — (webhook secret) | Réception des callbacks payment gateway |
| POST | `/api/admin/paiements-abo/manuel` | PLANS_GERER | ADMIN : enregistrer un paiement manuel |

### Remises

| Méthode | Route | Permission | Description |
|---------|-------|-----------|-------------|
| GET | `/api/remises` | REMISES_GERER | Lister les remises |
| POST | `/api/remises` | REMISES_GERER | Créer une remise |
| PUT | `/api/remises/[id]` | REMISES_GERER | Modifier une remise |
| POST | `/api/remises/validate` | ABONNEMENTS_GERER | Valider un code remise |
| POST | `/api/remises/apply` | ABONNEMENTS_GERER | Appliquer une remise à un abonnement |

### Commissions ingénieur

| Méthode | Route | Permission | Description |
|---------|-------|-----------|-------------|
| GET | `/api/commissions` | COMMISSIONS_VOIR | Mes commissions (ingénieur courant) |
| GET | `/api/portefeuille` | COMMISSIONS_VOIR | Solde de mon portefeuille |
| POST | `/api/portefeuille/demande-virement` | COMMISSIONS_VOIR | Demander un virement (min 5 000 FCFA) |
| GET | `/api/admin/commissions` | PLANS_GERER | ADMIN : toutes les commissions |
| PUT | `/api/admin/virements/[id]/traiter` | PLANS_GERER | ADMIN : traiter un virement |

---

## 8. Architecture d'intégration paiement

### 8.1 Principe d'abstraction (couche gateway)

L'abstraction isole le code métier de la gateway concrète. Toutes les interactions paiement passent par l'interface `PaymentGateway`.

```typescript
// src/lib/payments/types.ts

export enum PaymentProvider {
  MTN_MOMO = "MTN_MOMO",
  ORANGE_MONEY = "ORANGE_MONEY",
  MAVIANCE = "MAVIANCE",
  MANUEL = "MANUEL",
}

export interface PaymentRequest {
  /** Référence déterministe : SUB-{abonnementId}-{YYYYMM}-{tentative} */
  reference: string;
  phoneNumber: string;
  amount: number;
  currency: "XAF";
  description: string;
  /** URL de callback webhook (optionnel selon provider) */
  callbackUrl?: string;
}

export interface PaymentResult {
  reference: string;
  transactionId?: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED";
  gatewayResponse?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export interface PaymentGateway {
  provider: PaymentProvider;
  requestPayment(request: PaymentRequest): Promise<PaymentResult>;
  checkStatus(transactionId: string): Promise<PaymentResult>;
  validateWebhook(headers: Record<string, string>, body: unknown): boolean;
  parseWebhook(body: unknown): PaymentResult;
}
```

### 8.2 Sélection du provider

La sélection est automatique en Phase 1 (uniquement Maviance). En Phase 2, le préfixe téléphonique détermine le fournisseur.

```typescript
// src/lib/payments/provider-selector.ts

export function detectProvider(phone: string): PaymentProvider {
  // Cameroun : +237 suivi de 9 chiffres
  // MTN: 650–659, 670–679, 680–689
  // Orange: 690–699
  if (/^\+?237(65[0-9]|67[0-9]|68[0-9])/.test(phone)) {
    return PaymentProvider.MTN_MOMO;
  }
  if (/^\+?237(69[0-9])/.test(phone)) {
    return PaymentProvider.ORANGE_MONEY;
  }
  // Fallback agrégateur Maviance (Phase 1)
  return PaymentProvider.MAVIANCE;
}
```

### 8.3 Cycle de facturation récurrente

```
J-14  → Notification in-app + SMS : "Votre abonnement expire dans 14 jours"
J-7   → Notification in-app + SMS : "Votre abonnement expire dans 7 jours"
J-3   → SMS de rappel
J-1   → Initiation paiement USSD (tentative 1)
        - Webhook attendu sous 4h
J-1 +4h → Si EN_ATTENTE : tentative 2
J+0   → Si EN_ATTENTE/ECHOUE : tentative 3
J+1   → Si toujours ECHOUE : notification "Paiement échoué"
        - Statut abonnement → PERIODE_GRACE
J+7   → Si non payé : statut → RESTREINT (lecture seule)
J+30  → Si non payé : statut → SUSPENDU (aucun accès)
J+90  → Si non payé : statut → RESILIÉ
```

### 8.4 Webhook handler

```
POST /api/webhooks/payment
  ↓
validateWebhook() — vérification signature HMAC
  ↓
parseWebhook() → PaymentResult
  ↓
Trouver PaiementAbonnement par reference (idempotence)
  ↓
Si déjà REUSSI → ignorer (idempotence)
  ↓
Mettre à jour PaiementAbonnement.statut
  ↓
Si REUSSI :
  - Mettre à jour Abonnement.statut → ACTIF
  - Mettre à jour Abonnement.dateDebut / dateFin
  - Créer CommissionIngenieur si ingenieurId présent
  - Mettre à jour PortefeuilleIngenieur.soldeDisponible
Si ECHOUE/EXPIRE :
  - Planifier retry si tentative < 3
  - Sinon → déclencher logique cycle de grâce
```

### 8.5 Idempotence des paiements

La référence est déterministe et construite comme suit :

```
SUB-{abonnementId}-{YYYYMM}-{tentative}
```

Exemple : `SUB-clx1234abc-202604-1`

Un `@@unique` sur `PaiementAbonnement.reference` garantit qu'un doublon de webhook ne crée pas deux enregistrements.

---

## 9. Flux de rémunération des ingénieurs

### 9.1 Taux de commission

| Origine | Taux |
|---------|------|
| `REFERRAL_INGENIEUR` | 20% |
| `MATCH_PLATEFORME` | 15% |
| `AJOUT_PROMOTEUR` | 10% |

### 9.2 Déclenchement automatique

```
PaiementAbonnement confirmé (statut → REUSSI)
  ↓
Lire Abonnement.ingenieurId
  ↓
Si ingenieurId présent :
  1. Calculer commission = montantPaiement * taux(origineSupervision)
  2. Créer CommissionIngenieur (statut = EN_ATTENTE)
  3. Chercher ou créer PortefeuilleIngenieur pour cet ingénieur
  4. Mettre à jour PortefeuilleIngenieur.soldeDisponible += commission
  5. Si soldeDisponible >= 5 000 FCFA → statut commission → DISPONIBLE
     + Notification in-app : "Vous avez un solde disponible pour virement"
```

### 9.3 Demande de virement

```
Ingénieur → POST /api/portefeuille/demande-virement
  - Validation : soldeDisponible >= 5 000 FCFA
  - Validation : phoneDest valide (format +237XXXXXXXXX)
  - Créer DemandeVirementIngenieur (statut = EN_ATTENTE)
  - Notification ADMIN : "Nouvelle demande de virement ingénieur"
  ↓
ADMIN → PUT /api/admin/virements/[id]/traiter
  - Effectuer virement Mobile Money manuellement (Phase 1)
    ou via API (Phase 2)
  - Mettre à jour statut → PAYEE
  - Décrémenter PortefeuilleIngenieur.soldeDisponible
  - Incrémenter PortefeuilleIngenieur.totalVerse
  - Mettre à jour CommissionIngenieur.statut → PAYEE
```

### 9.4 Annulation et reversements

Si un abonnement est remboursé (rare) :
- Les `CommissionIngenieur` liées passent à `ANNULEE`
- Le `PortefeuilleIngenieur.soldeDisponible` est décrémenté
- Si le virement a déjà été effectué : note manuelle ADMIN (pas de débit automatique)

---

## 10. Machine d'états — Cycle de vie d'un abonnement

```
                    ┌──────────────────────────────────────────────────┐
                    │                  ABONNEMENT                      │
                    │                                                  │
  [Souscription]    │                                                  │
       ↓            │                                                  │
    ACTIF ◄─────────┤← Paiement confirmé (renouvellement)              │
      │             │                                                  │
      │ [Expiry J0] │                                                  │
      ↓             │                                                  │
  PERIODE_GRACE     │  (J+1 à J+7, accès complet, rappels quotidiens)  │
      │             │                                                  │
      │ [J+8]       │                                                  │
      ↓             │                                                  │
  RESTREINT         │  (J+8 à J+30, lecture seule uniquement)          │
      │             │                                                  │
      │ [J+31]      │                                                  │
      ↓             │                                                  │
  SUSPENDU          │  (J+31 à J+90, aucun accès, données conservées)  │
      │             │                                                  │
      │ [J+91]      │                                                  │
      ↓             │                                                  │
  RÉSILIÉ           │  (données à risque de suppression)               │
      │             │                                                  │
      └─────────────┘                                                  │
                                                                       │
  Depuis ACTIF → ANNULÉ  (annulation volontaire, accès jusqu'à dateFin)│
  Depuis tout état → ACTIF  (paiement reçu)                            │
                    └──────────────────────────────────────────────────┘
```

### Transitions et accès

| Statut | Accès écriture | Accès lecture | Modules actifs |
|--------|----------------|---------------|----------------|
| ACTIF | Oui | Oui | Tous selon plan |
| PERIODE_GRACE | Oui | Oui | Tous selon plan |
| RESTREINT | Non | Oui | Lecture seule |
| SUSPENDU | Non | Non | Aucun |
| RÉSILIÉ | Non | Non | Aucun |
| ANNULÉ | Non (après dateFin) | Oui (jusqu'à dateFin) | Selon plan |

La vérification du statut se fait dans un middleware `checkSubscription()` appelé avant `requirePermission()` pour les routes protégées.

---

## 11. Pages UI nécessaires

Toutes les pages sont MOBILE FIRST (360px). Pas de tableaux sur mobile : cartes empilées.

### Pages publiques / non authentifiées

| Page | Route | Composants principaux |
|------|-------|----------------------|
| Tarifs | `/tarifs` | `PricingTable`, `PricingCard`, `PeriodToggle` (Tabs Radix) |
| Comparaison plans | `/tarifs/comparer` | `PlanComparisonGrid` |

### Pages promoteur (authentifié)

| Page | Route | Composants principaux |
|------|-------|----------------------|
| Mon abonnement | `/settings/abonnement` | `AbonnementStatusCard`, `PlanBadge`, `DateExpirBanner` |
| Changer de plan | `/settings/abonnement/changer` | `PlanSelector`, `PricingCard`, `PeriodToggle` |
| Historique paiements | `/settings/abonnement/paiements` | `PaiementAboList`, `PaiementAboCard` |
| Initier paiement | `/settings/abonnement/payer` | `MobileMoneyForm`, `PhoneInput`, `PaymentStatusPoll` |
| Appliquer une remise | `/settings/abonnement/remise` | `RemiseCodeInput`, `RemiseConfirmDialog` |

### Pages ingénieur (authentifié)

| Page | Route | Composants principaux |
|------|-------|----------------------|
| Mon portefeuille | `/ingenieur/portefeuille` | `WalletBalanceCard`, `CommissionList`, `CommissionCard` |
| Demande de virement | `/ingenieur/portefeuille/virement` | `VirementForm`, `PhoneInput`, `VirementConfirmDialog` |
| Mon abonnement pro | `/settings/abonnement` | (même page, plan type INGENIEUR affiché) |

### Pages admin DKFarm

| Page | Route | Composants principaux |
|------|-------|----------------------|
| Gestion plans | `/admin/plans` | `PlanList`, `PlanFormDialog`, `PlanCard` |
| Tous abonnements | `/admin/abonnements` | `AbonnementListAdmin`, `AbonnementFilters`, `AbonnementCard` |
| Gestion remises | `/admin/remises` | `RemiseList`, `RemiseFormDialog` |
| Commissions ingénieurs | `/admin/commissions` | `CommissionListAdmin`, `PortefeuilleCard` |
| Virements à traiter | `/admin/virements` | `VirementList`, `VirementTraiterDialog` |

### Composants partagés

| Composant | Usage |
|-----------|-------|
| `AbonnementStatusBanner` | Bannière sticky sur toutes les pages si abonnement en grâce/restreint |
| `PlanLimitToast` | Toast Radix affiché si l'action dépasse les limites du plan |
| `PaymentStatusPoll` | Polling du statut paiement Mobile Money (SSE ou polling 5s) |
| `PeriodToggle` | Sélecteur MENSUEL/TRIMESTRIEL/ANNUEL (Tabs Radix) |
| `PhoneInput` | Input +237 avec détection auto provider (MTN/Orange) |

---

## 12. Stratégie de migration

### Étape 1 — Nouveaux enums (migration SQL)

Utiliser l'approche non-interactive existante (migrate diff + deploy) :

```sql
-- Nouveaux enums (CREATE TYPE, pas de modification d'existants)
CREATE TYPE "TypePlan" AS ENUM ('PROMOTEUR', 'INGENIEUR');
CREATE TYPE "PeriodeFacturation" AS ENUM ('MENSUEL', 'TRIMESTRIEL', 'ANNUEL', 'GRATUIT');
CREATE TYPE "StatutAbonnement" AS ENUM (
  'ACTIF', 'PERIODE_GRACE', 'RESTREINT', 'SUSPENDU', 'RESILIÉ', 'ANNULÉ'
);
CREATE TYPE "StatutPaiementAbo" AS ENUM (
  'EN_ATTENTE', 'EN_COURS', 'REUSSI', 'ECHOUE', 'EXPIRE', 'REMBOURSE'
);
CREATE TYPE "TypeRemise" AS ENUM ('POURCENTAGE', 'MONTANT_FIXE', 'MOIS_OFFERTS');
CREATE TYPE "StatutCommissionIng" AS ENUM (
  'EN_ATTENTE', 'DISPONIBLE', 'EN_PAIEMENT', 'PAYEE', 'ANNULEE'
);
CREATE TYPE "FournisseurPaiement" AS ENUM (
  'MTN_MOMO', 'ORANGE_MONEY', 'MAVIANCE', 'MANUEL'
);
CREATE TYPE "OrigineSupervision" AS ENUM (
  'REFERRAL_INGENIEUR', 'MATCH_PLATEFORME', 'AJOUT_PROMOTEUR'
);
```

### Étape 2 — Nouvelles tables

Créer les 7 nouvelles tables dans l'ordre de dépendance :

1. `PlanAbonnement` (dépend de Site, SiteModule)
2. `Abonnement` (dépend de PlanAbonnement, Site, User)
3. `PaiementAbonnement` (dépend de Abonnement, Site, User)
4. `Remise` (dépend de PlanAbonnement, Site)
5. `RemiseApplication` (dépend de Remise, Abonnement, User)
6. `PortefeuilleIngenieur` (dépend de User, Site)
7. `CommissionIngenieur` (dépend de User, Abonnement, PaiementAbonnement, PortefeuilleIngenieur, Site)
8. `DemandeVirementIngenieur` (dépend de PortefeuilleIngenieur, User, Site)

### Étape 3 — Ajout des nouvelles permissions

Modifier l'enum `Permission` existant via la stratégie RECREATE (renommer l'ancien type, créer le nouveau avec toutes les valeurs, caster les colonnes).

### Étape 4 — Nouveau SiteModule

Ajouter `ABONNEMENTS` à l'enum `SiteModule` si un gating par module est souhaité (optionnel en Phase 1 si toujours activé).

### Étape 5 — Ajout des relations User et Site

Ajouter les back-relations sur les modèles User et Site existants :
- `User.abonnements`, `User.commissions`, `User.portefeuille`
- `Site.abonnements`, `Site.plans`, `Site.paiementsAbo`

### Étape 6 — Données de seed

```sql
-- Plan DECOUVERTE (gratuit, toujours disponible)
INSERT INTO "PlanAbonnement" (id, code, nom, "typePlan", "prixMensuel", ...)
VALUES (cuid(), 'DECOUVERTE', 'Découverte', 'PROMOTEUR', 0, ...);

-- Plans promoteurs payants
INSERT INTO "PlanAbonnement" ... VALUES ('ELEVEUR', 'Éleveur', 'PROMOTEUR', 3000, 7500, 25000, ...);
INSERT INTO "PlanAbonnement" ... VALUES ('PROFESSIONNEL', 'Professionnel', 'PROMOTEUR', 8000, 20000, 70000, ...);
INSERT INTO "PlanAbonnement" ... VALUES ('ENTREPRISE', 'Entreprise', 'PROMOTEUR', 25000, NULL, NULL, ...);

-- Plans ingénieurs
INSERT INTO "PlanAbonnement" ... VALUES ('INGENIEUR_STARTER', 'Ingénieur Starter', 'INGENIEUR', 5000, NULL, 45000, ...);
INSERT INTO "PlanAbonnement" ... VALUES ('INGENIEUR_PRO', 'Ingénieur Pro', 'INGENIEUR', 15000, NULL, 135000, ...);
INSERT INTO "PlanAbonnement" ... VALUES ('INGENIEUR_EXPERT', 'Ingénieur Expert', 'INGENIEUR', 30000, NULL, 270000, ...);

-- Remises early adopter
INSERT INTO "Remise" ... VALUES ('EARLY_ADOPTER_PROMOTEUR', 'POURCENTAGE', 50, ...);
INSERT INTO "Remise" ... VALUES ('EARLY_ADOPTER_INGENIEUR', 'POURCENTAGE', 50, ...);
```

---

## 13. Sécurité

### 13.1 Vérification des webhooks

Chaque webhook entrant sur `/api/webhooks/payment` doit être vérifié avant tout traitement :

- **Maviance/Smobilpay** : vérifier la signature HMAC-SHA256 sur le corps de la requête avec la clé secrète configurée dans les variables d'environnement.
- **MTN MoMo** (Phase 2) : vérifier le header `X-Callback-HttpMethod` et la signature.
- Un webhook avec signature invalide retourne immédiatement HTTP 401 sans aucun traitement.

### 13.2 Données de paiement

- Aucun numéro de carte bancaire n'est stocké (Mobile Money uniquement).
- Les numéros de téléphone Mobile Money sont stockés en clair (usage opérationnel nécessaire).
- `PaiementAbonnement.gatewayResponse` est de type `Json?` — ne pas exposer ce champ dans les réponses API publiques.
- Les clés API des gateways sont dans les variables d'environnement uniquement (jamais dans le code ni en base).

### 13.3 Idempotence et anti-replay

- La contrainte `@@unique` sur `PaiementAbonnement.reference` empêche les doubles enregistrements.
- Le webhook handler vérifie `if (paiement.statut === 'REUSSI') return` avant tout traitement.
- Les références déterministes (`SUB-{id}-{YYYYMM}-{tentative}`) permettent de rejouer un webhook sans effet de bord.

### 13.4 Limites de plan (enforcement)

Un middleware `checkPlanLimits()` est appelé avant les actions suivantes :
- Création d'un nouveau `Bac` → vérifier `maxBacs`
- Création d'une nouvelle `Vague` → vérifier `maxVagues`
- Ajout d'un membre `SiteMember` → vérifier `maxUtilisateurs`
- Création d'un nouveau `Site` → vérifier `maxSites`

En mode `RESTREINT` ou `SUSPENDU`, toutes les routes de mutation retournent HTTP 403 avec un message explicatif indiquant le statut de l'abonnement.

### 13.5 Isolation multi-tenant

- Les abonnements d'un site ne sont jamais visibles depuis un autre site.
- Les commissions d'un ingénieur ne sont visibles que par cet ingénieur et par ADMIN.
- Tous les filtres de query incluent `siteId` (R8).

---

## 14. Relation avec les modèles Pack existants

| Dimension | Pack (Sprint 20) | Abonnement (ADR-020) |
|-----------|-----------------|---------------------|
| Nature | Produit physique vendu une fois | Service récurrent facturé par période |
| Durée | Déterminée par `PackActivation.dateExpiration` | Renouvelée chaque période (mensuel/trim/annuel) |
| Contenu | Alevins + intrants + bacs | Accès aux fonctionnalités selon plan |
| Paiement | Paiement unique lors de l'activation | Paiement récurrent via Mobile Money |
| Lien | `PackActivation` peut déclencher la création d'un `Abonnement` | L'abonnement contrôle l'accès aux modules |

**Règle de coexistence :** Un promoteur peut avoir un `Pack` actif ET un `Abonnement` actif simultanément. La capacité effective est le minimum entre les deux :
- Si le pack accorde 10 bacs et le plan 3 bacs → maximum 3 bacs opérationnels.
- Si le promoteur n'a pas d'abonnement actif mais a un pack, les limites du plan DECOUVERTE s'appliquent.

---

## 15. Variables d'environnement requises

```env
# Maviance/Smobilpay (Phase 1)
MAVIANCE_API_URL=https://api.smobilpay.com/v3
MAVIANCE_API_KEY=...
MAVIANCE_WEBHOOK_SECRET=...

# MTN Mobile Money (Phase 2)
MTN_MOMO_BASE_URL=https://sandbox.momodeveloper.mtn.com
MTN_MOMO_API_KEY=...
MTN_MOMO_API_SECRET=...
MTN_MOMO_SUBSCRIPTION_KEY=...

# Orange Money (Phase 2)
ORANGE_MONEY_BASE_URL=https://api.orange.com/orange-money-webpay/cm/v1
ORANGE_MONEY_CLIENT_ID=...
ORANGE_MONEY_CLIENT_SECRET=...

# Seuil de commission disponible (FCFA)
COMMISSION_PAYOUT_THRESHOLD=5000
```

---

## 16. Fichiers à créer / modifier

| Fichier | Action | Contenu |
|---------|--------|---------|
| `prisma/schema.prisma` | Modifier | Nouveaux enums + 7 modèles + back-relations |
| `src/types/models.ts` | Modifier | Miroirs TypeScript des nouveaux modèles/enums |
| `src/types/api.ts` | Modifier | DTOs pour les nouvelles routes |
| `src/types/index.ts` | Modifier | Barrel export des nouveaux types |
| `src/lib/payments/types.ts` | Créer | Interface PaymentGateway + types |
| `src/lib/payments/provider-selector.ts` | Créer | Détection provider par préfixe téléphonique |
| `src/lib/payments/maviance.ts` | Créer | Implémentation Maviance |
| `src/lib/payments/index.ts` | Créer | Factory gateway |
| `src/lib/queries/abonnements.ts` | Créer | CRUD abonnements |
| `src/lib/queries/plans.ts` | Créer | CRUD plans |
| `src/lib/queries/commissions.ts` | Créer | CRUD commissions + portefeuille |
| `src/lib/subscription-guard.ts` | Créer | Middleware checkSubscription + checkPlanLimits |
| `src/app/api/plans/route.ts` | Créer | Routes plans |
| `src/app/api/abonnements/route.ts` | Créer | Routes abonnements |
| `src/app/api/paiements-abo/route.ts` | Créer | Routes paiements |
| `src/app/api/webhooks/payment/route.ts` | Créer | Webhook handler |
| `src/app/api/commissions/route.ts` | Créer | Routes commissions |
| `src/app/api/portefeuille/route.ts` | Créer | Routes portefeuille |
| `src/app/(app)/tarifs/page.tsx` | Créer | Page publique tarifs |
| `src/app/(app)/settings/abonnement/page.tsx` | Créer | Page abonnement |
| `src/app/(app)/ingenieur/portefeuille/page.tsx` | Créer | Portefeuille ingénieur |
| `src/app/(app)/admin/plans/page.tsx` | Créer | Admin : gestion plans |
| `src/components/abonnements/` | Créer | Composants UI abonnements |
| `prisma/migrations/YYYYMMDD_add_subscriptions/` | Créer | Migration SQL |
