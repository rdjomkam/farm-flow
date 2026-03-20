# Plan de Sprints — Abonnements & Paiements

**Version :** 1.0
**Date :** 2026-03-20
**Auteur :** @project-manager

> Ce plan couvre les Sprints 30 à 37. Il introduit le système d'abonnements, les passerelles de paiement
> locales (Smobilpay/Maviance, MTN MoMo, Orange Money), le calcul des commissions ingénieur,
> le système de remises/promotions et le cycle de vie des abonnements (rappels, grâce, suspension).
> Mettre à jour `docs/TASKS.md` quand chaque sprint commence.

---

## Résumé des Sprints

| Sprint | Titre | Stories | Focus | Dépend de |
|--------|-------|---------|-------|-----------|
| **Sprint 30** | Fondations Abonnements (Schema + Types + ADR) | 5 | DB + interfaces + architecture | Sprint 26 FAIT |
| **Sprint 31** | Couche Paiement Abstraite + Webhooks | 5 | PaymentGateway + Smobilpay + Webhooks | Sprint 30 |
| **Sprint 32** | API Abonnements + Plans | 5 | CRUD Plans, souscription, facturation | Sprint 31 |
| **Sprint 33** | UI Checkout + Mon Abonnement | 5 | Parcours d'achat mobile-first | Sprint 32 |
| **Sprint 34** | Commissions Ingénieur + Portefeuille | 5 | Calcul commissions, wallet, virements | Sprint 32 |
| **Sprint 35** | Système de Remises & Promotions | 4 | Remises CRUD + application automatique | Sprint 32 |
| **Sprint 36** | Cycle de Vie Abonnements | 5 | Rappels, grâce, suspension, réactivation | Sprints 31, 34, 35 |
| **Sprint 37** | Tests, Polish & Review Finale | 4 | Tests intégration, UX, review R1-R9 | Sprint 36 |
| **Total** | | **38** | | |

---

## Nouvelles valeurs d'enum par sprint

| Sprint | Enums ajoutés |
|--------|--------------|
| Sprint 30 | `TypePlan`, `PeriodeFacturation`, `StatutAbonnement`, `StatutPaiementAbo`, `TypeRemise`, `StatutCommissionIng`, `FournisseurPaiement` |
| Sprint 36 | (réutilise les enums Sprint 30) |

---

## Sprint 30 — Fondations Abonnements (Schema + Types + ADR)

**Objectif :** Avoir le schéma Prisma complet pour les abonnements, les interfaces TypeScript miroirs,
les constantes tarifaires et les décisions architecturales documentées. Aucune logique métier dans ce sprint.

**Contexte métier :**
- Les promoteurs souscrivent à des plans (`PlanAbonnement`) selon leur taille : DECOUVERTE (gratuit),
  ELEVEUR, PROFESSIONNEL, ENTREPRISE
- Les ingénieurs ont leurs propres packs : INGENIEUR_STARTER, INGENIEUR_PRO, INGENIEUR_EXPERT
- Chaque souscription (`Abonnement`) a un statut qui évolue dans le temps
- Les paiements d'abonnement (`PaiementAbonnement`) tracent chaque transaction avec le fournisseur de paiement

**Dépend de :** Sprint 26 FAIT

---

### Story 30.1 — Schéma Prisma : 7 enums + 7 modèles abonnements
**Assigné à :** @db-specialist
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `FAIT`

**Description :** Ajouter les 7 enums et 7 modèles du système d'abonnements dans `prisma/schema.prisma`.
Chaque modèle respecte la règle R8 (siteId PARTOUT, sauf PlanAbonnement qui est global).

**Tâches :**
- [ ] `TODO` Ajouter enum `TypePlan` dans schema.prisma : `DECOUVERTE`, `ELEVEUR`, `PROFESSIONNEL`, `ENTREPRISE`, `INGENIEUR_STARTER`, `INGENIEUR_PRO`, `INGENIEUR_EXPERT`
- [ ] `TODO` Ajouter enum `PeriodeFacturation` : `MENSUEL`, `TRIMESTRIEL`, `ANNUEL`
- [ ] `TODO` Ajouter enum `StatutAbonnement` : `ACTIF`, `EN_GRACE`, `SUSPENDU`, `EXPIRE`, `ANNULE`, `EN_ATTENTE_PAIEMENT`
- [ ] `TODO` Ajouter enum `StatutPaiementAbo` : `EN_ATTENTE`, `INITIE`, `CONFIRME`, `ECHEC`, `REMBOURSE`, `EXPIRE`
- [ ] `TODO` Ajouter enum `TypeRemise` : `EARLY_ADOPTER`, `SAISONNIERE`, `PARRAINAGE`, `COOPERATIVE`, `VOLUME`, `MANUELLE`
- [ ] `TODO` Ajouter enum `StatutCommissionIng` : `EN_ATTENTE`, `DISPONIBLE`, `DEMANDEE`, `PAYEE`, `ANNULEE`
- [ ] `TODO` Ajouter enum `FournisseurPaiement` : `SMOBILPAY`, `MTN_MOMO`, `ORANGE_MONEY`, `MANUEL`
- [ ] `TODO` Ajouter modèle `PlanAbonnement` : `id`, `nom`, `typePlan TypePlan @unique`, `description?`, `prixMensuel Decimal?`, `prixTrimestriel Decimal?`, `prixAnnuel Decimal?`, `limitesSites Int @default(1)`, `limitesBacs Int @default(3)`, `limitesVagues Int @default(1)`, `limitesIngFermes Int?` (pour packs ingénieur), `isActif Boolean @default(true)`, `isPublic Boolean @default(true)`, `createdAt`, `updatedAt`
- [ ] `TODO` Ajouter modèle `Abonnement` : `id`, `siteId String` (FK Site, R8), `planId String` (FK PlanAbonnement), `periode PeriodeFacturation`, `statut StatutAbonnement @default(EN_ATTENTE_PAIEMENT)`, `dateDebut DateTime`, `dateFin DateTime`, `dateProchainRenouvellement DateTime`, `dateFinGrace DateTime?`, `prixPaye Decimal`, `userId String` (souscripteur), `remiseId String?` (FK Remise), `createdAt`, `updatedAt`. Relations : site, plan, user, paiements, remise
- [ ] `TODO` Ajouter modèle `PaiementAbonnement` : `id`, `abonnementId String` (FK Abonnement CASCADE), `montant Decimal`, `fournisseur FournisseurPaiement`, `statut StatutPaiementAbo @default(EN_ATTENTE)`, `referenceExterne String?` (ID transaction fournisseur), `phoneNumber String?`, `metadata Json?` (réponse brute gateway), `initiePar String` (FK User), `dateInitiation DateTime`, `dateConfirmation DateTime?`, `siteId String` (R8), `createdAt`, `updatedAt`
- [ ] `TODO` Ajouter modèle `Remise` : `id`, `nom`, `code String @unique`, `type TypeRemise`, `valeur Decimal` (montant XAF ou pourcentage), `estPourcentage Boolean @default(false)`, `dateDebut DateTime`, `dateFin DateTime?`, `limiteUtilisations Int?`, `nombreUtilisations Int @default(0)`, `isActif Boolean @default(true)`, `siteId String?` (null = globale), `userId String` (créateur), `createdAt`, `updatedAt`. Relation : applications
- [ ] `TODO` Ajouter modèle `RemiseApplication` : `id`, `remiseId String` (FK Remise), `abonnementId String` (FK Abonnement), `montantReduit Decimal`, `appliqueLe DateTime @default(now())`, `userId String`. @@unique([remiseId, abonnementId])
- [ ] `TODO` Ajouter modèle `CommissionIngenieur` : `id`, `ingenieurId String` (FK User — l'ingénieur), `siteClientId String` (FK Site — la ferme cliente), `abonnementId String` (FK Abonnement), `montant Decimal`, `taux Decimal` (0.10 à 0.20), `statut StatutCommissionIng @default(EN_ATTENTE)`, `periodeDebut DateTime`, `periodeFin DateTime`, `siteId String` (R8 — site DKFarm), `createdAt`, `updatedAt`
- [ ] `TODO` Ajouter modèle `PortefeuilleIngenieur` : `id`, `ingenieurId String @unique` (FK User), `solde Decimal @default(0)`, `soldePending Decimal @default(0)`, `totalGagne Decimal @default(0)`, `totalPaye Decimal @default(0)`, `siteId String` (R8), `updatedAt`. Relation : retraits
- [ ] `TODO` Ajouter modèle `RetraitPortefeuille` : `id`, `portefeuilleId String` (FK PortefeuilleIngenieur), `montant Decimal`, `fournisseur FournisseurPaiement`, `phoneNumber String`, `statut StatutPaiementAbo`, `referenceExterne String?`, `demandeLeBy String` (FK User), `traitePar String?` (FK User admin), `datedemande DateTime @default(now())`, `dateTraitement DateTime?`, `siteId String` (R8), `createdAt`
- [ ] `TODO` Ajouter index pertinents : `@@index([siteId])` sur Abonnement, PaiementAbonnement, CommissionIngenieur ; `@@index([statut])` sur Abonnement ; `@@index([ingenieurId])` sur CommissionIngenieur
- [ ] `TODO` Créer la migration SQL (méthode manuelle : `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, mkdir, `npx prisma migrate deploy`)
- [ ] `TODO` Mettre à jour `prisma/seed.sql` : 4 plans actifs (DECOUVERTE, ELEVEUR, PROFESSIONNEL, INGENIEUR_PRO), 1 abonnement ACTIF pour le site de test, 1 paiement CONFIRME, 2 remises (dont 1 EARLY_ADOPTER active)

**Critères d'acceptation :**
- R1 : toutes les valeurs d'enum en MAJUSCULES
- R3 : noms de champs et types strictement alignés entre Prisma et les interfaces TS (Story 30.2)
- R7 : nullabilité explicite dès le schéma (prixMensuel nullable pour DECOUVERTE, etc.)
- R8 : chaque modèle a un `siteId` (PlanAbonnement = global, pas de siteId)
- Migration s'applique sans erreur sur la base de test
- Seed fonctionne et insère des données cohérentes

---

### Story 30.2 — Interfaces TypeScript & DTOs Abonnements
**Assigné à :** @architect
**Priorité :** Critique
**Complexité :** Complex
**Dépend de :** Story 30.1
**Statut :** `FAIT`

**Description :** Créer toutes les interfaces TypeScript miroirs des nouveaux modèles Prisma,
les DTOs d'API (request/response) et les constantes tarifaires.

**Tâches :**
- [ ] `TODO` Ajouter les 7 enums dans `src/types/models.ts` : `TypePlan`, `PeriodeFacturation`, `StatutAbonnement`, `StatutPaiementAbo`, `TypeRemise`, `StatutCommissionIng`, `FournisseurPaiement` — R1 : valeurs MAJUSCULES
- [ ] `TODO` Ajouter interfaces dans `src/types/models.ts` : `PlanAbonnement`, `Abonnement`, `AbonnementWithPlan`, `PaiementAbonnement`, `Remise`, `RemiseApplication`, `CommissionIngenieur`, `PortefeuilleIngenieur`, `RetraitPortefeuille` — R3 : miroir exact du schéma Prisma
- [ ] `TODO` Ajouter dans `src/types/api.ts` :
  - `CreateAbonnementDTO` : `planId`, `periode`, `phoneNumber?`, `fournisseur`, `remiseCode?`
  - `CreatePlanAbonnementDTO` : tous les champs de PlanAbonnement sauf id/createdAt/updatedAt
  - `UpdatePlanAbonnementDTO` : même champs optionnels
  - `InitierPaiementDTO` : `abonnementId`, `phoneNumber`, `fournisseur FournisseurPaiement`
  - `CreateRemiseDTO` : `nom`, `code`, `type`, `valeur`, `estPourcentage`, `dateDebut`, `dateFin?`, `limiteUtilisations?`
  - `CreateCommissionDTO` : `ingenieurId`, `siteClientId`, `abonnementId`, `taux`
  - `DemandeRetraitDTO` : `montant`, `phoneNumber`, `fournisseur`
  - `AbonnementFilters` : `statut?`, `planId?`, `siteId?`, `dateDebutAfter?`, `dateFinBefore?`
- [ ] `TODO` Créer `src/lib/abonnements-constants.ts` :
  - `PLAN_TARIFS` : Record des prix par `TypePlan` et `PeriodeFacturation` (en XAF)
  - `PLAN_LIMITES` : Record des limites par `TypePlan` (sites, bacs, vagues, fermes ingénieur)
  - `PLAN_LABELS` : Record<TypePlan, string> — labels FR pour l'UI
  - `PERIODE_LABELS` : Record<PeriodeFacturation, string>
  - `STATUT_ABONNEMENT_LABELS` : Record<StatutAbonnement, string>
  - `GRACE_PERIOD_JOURS` = 7
  - `SUSPENSION_JOURS` = 30 (jours après fin de grâce avant suppression définitive)
  - `COMMISSION_TAUX_DEFAULT` = 0.10 (10%)
  - `COMMISSION_TAUX_PREMIUM` = 0.20 (20%, si l'ingénieur a formé le client)
  - `calculerMontantRemise(prix: Decimal, remise: Remise): Decimal` — fonction pure
  - `calculerProchaineDate(base: Date, periode: PeriodeFacturation): Date` — fonction pure
- [ ] `TODO` Exporter tous les nouveaux types et enums depuis `src/types/index.ts`
- [ ] `TODO` Ajouter permissions dans `src/types/models.ts` enum `Permission` : `ABONNEMENTS_VOIR`, `ABONNEMENTS_GERER`, `PLANS_GERER`, `REMISES_GERER`, `COMMISSIONS_VOIR`, `COMMISSIONS_GERER`, `PORTEFEUILLE_VOIR`, `PORTEFEUILLE_GERER`

**Critères d'acceptation :**
- R1 : enums MAJUSCULES sans exception
- R2 : utiliser `StatutAbonnement.ACTIF`, jamais `"ACTIF"` (documenté dans les exemples JSDoc)
- R3 : chaque champ Prisma a son équivalent TypeScript exact
- Aucun `any`
- `calculerMontantRemise` et `calculerProchaineDate` testables unitairement

---

### Story 30.3 — ADR : Architecture du système d'abonnements
**Assigné à :** @architect
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Story 30.1
**Statut :** `FAIT`

**Description :** Documenter les décisions architecturales clés pour le système d'abonnements.
Deux ADR sont nécessaires : l'un sur l'abstraction des passerelles de paiement, l'autre sur
le cycle de vie des abonnements.

**Tâches :**
- [ ] `TODO` Créer `docs/decisions/016-payment-gateway-abstraction.md` :
  - Contexte : plusieurs fournisseurs de paiement mobile au Cameroun (Smobilpay/Maviance, MTN MoMo direct, Orange Money direct)
  - Interface `PaymentGateway` : `initiatePayment(params)`, `checkStatus(referenceExterne)`, `processWebhook(payload, signature)`
  - Décision : abstraction via interface + factory pattern (`getPaymentGateway(fournisseur)`)
  - Phase 1 : Smobilpay/Maviance uniquement (agrégateur qui couvre MTN + OM)
  - Phase 2 : gateways directs MTN MoMo et Orange Money
  - Stockage de `metadata Json` sur `PaiementAbonnement` pour la réponse brute (pas de mapping partiel)
  - Vérification de signature sur les webhooks (clé secrète par fournisseur en `.env`)
  - Idempotence : toujours vérifier `referenceExterne` avant de confirmer un paiement
- [ ] `TODO` Créer `docs/decisions/017-subscription-lifecycle.md` :
  - Contexte : abonnements récurrents avec gestion des impayés en Afrique
  - Cycle : `ACTIF` → (date expiry) → `EN_GRACE` (7j) → `SUSPENDU` (30j, lecture seule) → `EXPIRE` (90j) → archivage
  - Réactivation : paiement depuis `EN_GRACE`, `SUSPENDU` ou `EXPIRE` (sous conditions)
  - CRON job quotidien : identifier expirations et transitions de statut
  - Rappels email/notification : J-14, J-7, J-3, J-1 avant expiration
  - Conséquences sur les permissions : mode lecture seule en `SUSPENDU`, accès bloqué en `EXPIRE`
  - Décision : middleware `checkSubscriptionStatus` dans les Server Components critiques
- [ ] `TODO` Créer `docs/decisions/018-engineer-commissions.md` :
  - Contexte : les ingénieurs agronomes supervisent des fermes et perçoivent une commission sur leurs abonnements
  - Taux : 10% par défaut, 20% si formation documentée (`COMMISSION_TAUX_PREMIUM`)
  - Calcul : lors de chaque `PaiementAbonnement` CONFIRME, créer une `CommissionIngenieur` EN_ATTENTE
  - Disponibilité : la commission passe DISPONIBLE après 30 jours (protection contre les remboursements)
  - Portefeuille : `PortefeuilleIngenieur` agrège le solde disponible et le total en attente
  - Paiement : l'ingénieur demande un retrait, un admin DKFarm valide et déclenche le virement
- [ ] `TODO` Mettre à jour `docs/decisions/index.md` (si existant) avec les 3 nouveaux ADR

**Critères d'acceptation :**
- Chaque ADR a : contexte, options considérées, décision retenue, conséquences
- L'interface `PaymentGateway` est définie avec les types exacts (pas de `any`)
- Le cycle de vie est schématisé (diagramme ASCII ou liste d'états)

---

### Story 30.4 — Queries Prisma : lecture/écriture abonnements
**Assigné à :** @db-specialist
**Priorité :** Haute
**Complexité :** Complex
**Dépend de :** Stories 30.1, 30.2
**Statut :** `FAIT`

**Description :** Créer les fonctions de query réutilisables pour tous les nouveaux modèles.
Suivre le pattern de `src/lib/queries/vagues.ts`.

**Tâches :**
- [ ] `TODO` Créer `src/lib/queries/plans-abonnements.ts` :
  - `getPlansAbonnements(includeInactif?)` — liste publique ou complète (admin)
  - `getPlanAbonnementById(id)` — détail avec calcul du nombre d'abonnés actifs (`_count`)
  - `createPlanAbonnement(data)` — création réservée admin
  - `updatePlanAbonnement(id, data)` — mise à jour partielle
  - `togglePlanAbonnement(id)` — atomique R4 via `updateMany`
- [ ] `TODO` Créer `src/lib/queries/abonnements.ts` :
  - `getAbonnements(siteId, filters?)` — liste filtrée par siteId + statut
  - `getAbonnementActif(siteId)` — retourne l'abonnement ACTIF ou EN_GRACE (unique)
  - `getAbonnementById(id, siteId?)` — détail avec plan + paiements
  - `createAbonnement(siteId, userId, data)` — crée un abonnement EN_ATTENTE_PAIEMENT
  - `activerAbonnement(id)` — R4 : `updateMany` où statut IN [EN_ATTENTE_PAIEMENT, EN_GRACE, SUSPENDU] → ACTIF
  - `suspendreAbonnement(id)` — R4 : `updateMany` où statut = EN_GRACE → SUSPENDU
  - `expirerAbonnement(id)` — R4 : `updateMany` où statut IN [SUSPENDU] → EXPIRE
  - `getAbonnementsExpirantAvant(date)` — pour le CRON job de rappels
  - `getAbonnementsEnGraceExpires()` — pour le CRON job de suspension
- [ ] `TODO` Créer `src/lib/queries/paiements-abonnements.ts` :
  - `createPaiementAbonnement(data)` — crée un paiement EN_ATTENTE
  - `confirmerPaiement(referenceExterne)` — R4 : `updateMany` idempotent sur referenceExterne
  - `getPaiementsByAbonnement(abonnementId)` — historique
  - `getPaiementByReference(referenceExterne)` — pour les webhooks (idempotence)
- [ ] `TODO` Créer `src/lib/queries/remises.ts` :
  - `getRemises(siteId?, includeGlobales?)` — liste avec filtre actif/expiré
  - `getRemiseByCode(code)` — validation d'un code promo
  - `createRemise(siteId, userId, data)` — création
  - `appliquerRemise(remiseId, abonnementId, userId)` — transaction : incrémenter `nombreUtilisations` + créer `RemiseApplication`
  - `verifierRemiseApplicable(code, siteId)` — vérifie : code existe, isActif, non expirée, limite non atteinte
- [ ] `TODO` Créer `src/lib/queries/commissions.ts` :
  - `getCommissionsIngenieur(ingenieurId, filters?)` — liste avec filtre statut/période
  - `createCommission(data)` — crée EN_ATTENTE
  - `rendrCommissionsDisponibles(dateAvant)` — R4 : `updateMany` EN_ATTENTE créées avant dateAvant → DISPONIBLE
  - `getPortefeuille(ingenieurId)` — détail avec solde + commissions récentes
  - `demanderRetrait(ingenieurId, data)` — vérifie solde >= montant, crée `RetraitPortefeuille`
  - `traiterRetrait(retraitId, adminId, referenceExterne)` — met à jour le solde et le statut
- [ ] `TODO` Exporter toutes les fonctions depuis `src/lib/queries/index.ts`

**Critères d'acceptation :**
- R4 : toutes les transitions de statut via `updateMany` avec condition (jamais check-then-update)
- R8 : toutes les queries filtrent par `siteId` quand applicable
- Aucun `any` dans les types de retour
- Pattern référence : `src/lib/queries/vagues.ts` et `src/lib/queries/activites.ts`

---

### Story 30.5 — Tests unitaires fondations + Review Sprint 30
**Assigné à :** @tester + @code-reviewer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Stories 30.1 à 30.4
**Statut :** `FAIT`

**Description :** Tester les fonctions pures des constantes, vérifier la cohérence schema/types,
puis valider le sprint avant de passer au Sprint 31.

**Tâches @tester :**
- [ ] `TODO` Créer `src/__tests__/lib/abonnements-constants.test.ts` :
  - `calculerMontantRemise()` — remise fixe (ex. 2000 XAF sur 8000 = 6000)
  - `calculerMontantRemise()` — remise pourcentage (ex. 10% sur 25000 = 22500)
  - `calculerMontantRemise()` — remise > prix → retourne 0 (pas de prix négatif)
  - `calculerProchaineDate()` — MENSUEL ajoute 1 mois exact
  - `calculerProchaineDate()` — TRIMESTRIEL ajoute 3 mois
  - `calculerProchaineDate()` — ANNUEL ajoute 12 mois
  - Vérifier que `PLAN_TARIFS[TypePlan.DECOUVERTE][PeriodeFacturation.MENSUEL]` = 0
  - Vérifier que `PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs` = 3
- [ ] `TODO` `npx vitest run` — tous les tests passent
- [ ] `TODO` `npm run build` — build production OK
- [ ] `TODO` Écrire `docs/tests/rapport-sprint-30.md`

**Tâches @code-reviewer :**
- [ ] `TODO` Vérifier R1 — enums MAJUSCULES (7 nouveaux enums)
- [ ] `TODO` Vérifier R3 — interfaces TS alignées avec schema.prisma (champ par champ)
- [ ] `TODO` Vérifier R4 — queries de transition de statut atomiques
- [ ] `TODO` Vérifier R7 — nullabilité correcte (prixMensuel nullable pour DECOUVERTE)
- [ ] `TODO` Vérifier R8 — siteId présent sur tous les modèles concernés
- [ ] `TODO` Vérifier cohérence ADR 016/017/018 avec l'implémentation des queries
- [ ] `TODO` Écrire `docs/reviews/review-sprint-30.md`

**Critères d'acceptation :**
- Tous les tests passent + build OK (R9)
- Aucune incohérence schema ↔ types détectée
- 3 ADR validés par le code-reviewer
- Rapport de review produit

---

## Sprint 31 — Couche Paiement Abstraite + Webhooks

**Objectif :** Implémenter l'interface `PaymentGateway`, le gateway Smobilpay/Maviance (Phase 1),
les routes webhook pour les callbacks de paiement, et les variables d'environnement nécessaires.

**Contexte métier :**
- Smobilpay/Maviance est un agrégateur camerounais qui unifie MTN MoMo et Orange Money
- Les paiements mobile money sont asynchrones : on initie, le client valide sur son téléphone,
  puis on reçoit un callback webhook
- La clé secrète webhook doit être vérifiée pour éviter les fraudes
- Les gateways directs MTN MoMo et Orange Money seront ajoutés en Phase 2 (Sprint 31 uniquement Smobilpay)

**Dépend de :** Sprint 30 FAIT

---

### Story 31.1 — Interface PaymentGateway + types paiement
**Assigné à :** @architect
**Priorité :** Critique
**Complexité :** Medium
**Statut :** `FAIT`

**Description :** Définir l'interface TypeScript `PaymentGateway` et les types associés pour
l'abstraction des passerelles de paiement. Ces types sont la source de vérité pour les implémentations.

**Tâches :**
- [ ] `TODO` Créer `src/lib/payment/types.ts` :
  - `PaymentInitiateParams` : `abonnementId`, `phoneNumber`, `montant Decimal`, `description`, `referenceInterne` (ID unique généré côté app), `metadata?: Record<string, string>`
  - `PaymentInitiateResult` : `referenceExterne`, `statut: "INITIE" | "ECHEC"`, `message?`, `redirectUrl?`
  - `PaymentStatusResult` : `referenceExterne`, `statut: StatutPaiementAbo`, `montant?`, `confirmedAt?`
  - `WebhookPayload` : `referenceExterne`, `statut`, `signature`, `rawBody: string`, `headers: Record<string, string>`
  - `WebhookResult` : `success: boolean`, `referenceExterne?`, `statut?: StatutPaiementAbo`
  - `PaymentGateway` interface : `fournisseur: FournisseurPaiement`, `initiatePayment(params: PaymentInitiateParams): Promise<PaymentInitiateResult>`, `checkStatus(referenceExterne: string): Promise<PaymentStatusResult>`, `processWebhook(payload: WebhookPayload): Promise<WebhookResult>`, `verifySignature(rawBody: string, signature: string): boolean`
- [ ] `TODO` Créer `src/lib/payment/factory.ts` :
  - `getPaymentGateway(fournisseur: FournisseurPaiement): PaymentGateway` — factory pattern
  - Phase 1 : retourne `SmobilpayGateway` pour SMOBILPAY, `ManualGateway` pour MANUEL
  - Phase 2 (placeholder commenté) : MTN_MOMO → `MtnMomoGateway`, ORANGE_MONEY → `OrangeMoneyGateway`
  - Lance une `Error("Gateway non implémenté")` pour les fournisseurs non supportés en Phase 1
- [ ] `TODO` Créer `src/lib/payment/manual-gateway.ts` — implémentation `ManualGateway` pour les tests et les paiements manuels (DKFarm crée le paiement directement) : `initiatePayment` retourne toujours INITIE, `checkStatus` retourne CONFIRME si dateConfirmation est définie, `processWebhook` retourne `{ success: false }` (pas de webhook manuel)
- [ ] `TODO` Exporter depuis `src/lib/payment/index.ts`

**Critères d'acceptation :**
- Interface `PaymentGateway` sans `any`
- `ManualGateway` testable unitairement
- Factory pattern utilisable depuis les API routes
- Cohérence avec ADR-016 (Story 30.3)

---

### Story 31.2 — Implémentation gateway Smobilpay/Maviance
**Assigné à :** @developer
**Priorité :** Critique
**Complexité :** Complex
**Dépend de :** Story 31.1
**Statut :** `FAIT`

**Description :** Implémenter le gateway Smobilpay/Maviance. En Phase 1, utiliser l'API REST
de Maviance (documentation publique). Prévoir un mode "sandbox" pour les tests.

**Tâches :**
- [ ] `TODO` Créer `src/lib/payment/smobilpay-gateway.ts` — implémentation `SmobilpayGateway` :
  - Constructor : `apiKey`, `apiSecret`, `baseUrl` (depuis `.env` : `SMOBILPAY_API_KEY`, `SMOBILPAY_API_SECRET`, `SMOBILPAY_BASE_URL`)
  - `initiatePayment(params)` : POST vers `/api/v1/cashin` avec `phoneNumber`, `amount`, `externalRef`, `description`. Retourner `{ referenceExterne: response.payToken, statut: "INITIE" }` ou `{ statut: "ECHEC", message }`
  - `checkStatus(referenceExterne)` : GET vers `/api/v1/cashin/{payToken}`. Mapper le statut Smobilpay → `StatutPaiementAbo`
  - `verifySignature(rawBody, signature)` : HMAC-SHA256 avec `SMOBILPAY_WEBHOOK_SECRET`
  - `processWebhook(payload)` : vérifie signature, extrait `referenceExterne` et nouveau statut
  - Gestion des erreurs réseau : retry 1 fois avec délai 2s, puis `{ statut: "ECHEC", message: "Timeout" }`
  - Mode sandbox : `SMOBILPAY_SANDBOX=true` redirige vers `https://sandbox.smobilpay.com`
- [ ] `TODO` Ajouter les variables d'environnement dans `.env.example` : `SMOBILPAY_API_KEY`, `SMOBILPAY_API_SECRET`, `SMOBILPAY_BASE_URL`, `SMOBILPAY_WEBHOOK_SECRET`, `SMOBILPAY_SANDBOX`
- [ ] `TODO` Créer `src/lib/payment/__mocks__/smobilpay-gateway.ts` — mock pour les tests (retourne des réponses prédéfinies sans appels HTTP réels)

**Critères d'acceptation :**
- `SmobilpayGateway` implémente l'interface `PaymentGateway` sans erreurs TypeScript
- Vérification de signature implémentée (sécurité critique)
- Mode sandbox fonctionnel (pas d'appels production en dev)
- Mock disponible pour les tests

---

### Story 31.3 — Routes webhook paiements
**Assigné à :** @developer
**Priorité :** Critique
**Complexité :** Medium
**Dépend de :** Stories 31.1, 31.2, 30.4
**Statut :** `FAIT`

**Description :** Créer les routes API publiques (non authentifiées) pour recevoir les callbacks
webhook des fournisseurs de paiement. Ces routes doivent être idempotentes.

**Tâches :**
- [ ] `TODO` Créer `src/app/api/webhooks/smobilpay/route.ts` :
  - `POST` uniquement — pas d'authentification utilisateur (clé webhook à la place)
  - Lire le body brut (`request.text()`) avant tout parsing JSON (nécessaire pour la vérification de signature)
  - Appeler `getPaymentGateway(SMOBILPAY).verifySignature(rawBody, request.headers.get("x-smobilpay-signature"))` → 401 si invalide
  - Appeler `gateway.processWebhook(payload)` pour extraire `referenceExterne` et `statut`
  - Appeler `getPaiementByReference(referenceExterne)` — 200 (idempotent) si déjà traité
  - Si `statut = CONFIRME` : transaction Prisma → `confirmerPaiement(referenceExterne)` + `activerAbonnement(abonnement.id)` + créer `CommissionIngenieur` si ingénieur superviseur
  - Si `statut = ECHEC` ou `EXPIRE` : `updateMany` sur `PaiementAbonnement` statut → ECHEC
  - Retourner `{ received: true }` en 200 même en cas d'erreur interne (Smobilpay retentera sinon)
  - Logger toutes les erreurs internes sans les exposer
- [ ] `TODO` Créer `src/app/api/webhooks/manuel/route.ts` :
  - `POST` — authentifié, réservé aux admins DKFarm (`Permission.ABONNEMENTS_GERER`)
  - Permet à un admin de confirmer manuellement un paiement (`referenceExterne`, `abonnementId`)
  - Appeler la même transaction que le webhook automatique
- [ ] `TODO` Ajouter les routes webhook dans la liste des routes exclues du middleware d'authentification (si applicable)

**Critères d'acceptation :**
- Idempotence : si le même webhook arrive deux fois, le second est ignoré (200 sans double-traitement)
- Sécurité : signature vérifiée avant tout traitement pour Smobilpay
- Transaction atomique : paiement confirmé + abonnement activé en même opération Prisma
- Logs disponibles sans exposition de données sensibles

---

### Story 31.4 — Service de billing : initiation paiement
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Stories 31.1, 31.2, 30.4
**Statut :** `FAIT`

**Description :** Créer le service d'initiation de paiement utilisé par les API routes de checkout.
Ce service orchestre la création du `PaiementAbonnement` et l'appel au gateway.

**Tâches :**
- [ ] `TODO` Créer `src/lib/services/billing.ts` :
  - `initierPaiement(abonnementId, userId, siteId, params: InitierPaiementDTO): Promise<{ paiementId: string, referenceExterne?: string, statut: StatutPaiementAbo, message?: string }>` :
    1. Vérifier que l'abonnement appartient au siteId (sécurité)
    2. Vérifier qu'aucun paiement EN_ATTENTE ou INITIE n'existe déjà pour cet abonnement (idempotence)
    3. Créer un `PaiementAbonnement` EN_ATTENTE en DB
    4. Appeler `getPaymentGateway(params.fournisseur).initiatePayment(...)`
    5. Mettre à jour le `PaiementAbonnement` avec `referenceExterne` et statut INITIE ou ECHEC
    6. Retourner le résultat
  - `verifierEtActiverPaiement(referenceExterne: string): Promise<boolean>` — polling manuel (pour les cas où le webhook n'arrive pas)
- [ ] `TODO` Créer `src/lib/services/abonnement-lifecycle.ts` :
  - `transitionnerStatuts(): Promise<{ graces: number, suspendus: number, expires: number }>` — utilisé par le CRON job
  - Logique : `getAbonnementsExpirantAvant(now())` → passer EN_GRACE ; `getAbonnementsEnGraceExpires()` → passer SUSPENDU ; etc.

**Critères d'acceptation :**
- `initierPaiement` est atomique : si le gateway échoue, le `PaiementAbonnement` est marqué ECHEC (pas laissé EN_ATTENTE)
- Double paiement impossible pour le même abonnement (vérification idempotence)
- `transitionnerStatuts` testable avec des données mockées

---

### Story 31.5 — Tests + Review Sprint 31
**Assigné à :** @tester + @code-reviewer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Stories 31.1 à 31.4
**Statut :** `FAIT`

**Tâches @tester :**
- [ ] `TODO` Créer `src/__tests__/lib/payment.test.ts` :
  - `ManualGateway.initiatePayment()` — retourne INITIE
  - `ManualGateway.checkStatus()` — retourne CONFIRME si dateConfirmation définie
  - `ManualGateway.verifySignature()` — retourne toujours true
  - `getPaymentGateway(SMOBILPAY)` — retourne instance SmobilpayGateway
  - `getPaymentGateway(MTN_MOMO)` — lance Error "non implémenté"
  - `billingService.initierPaiement()` — crée PaiementAbonnement + appel gateway mock
  - `billingService.initierPaiement()` — idempotence : 2e appel retourne paiement existant
  - `SmobilpayGateway.verifySignature()` — signature HMAC valide → true
  - `SmobilpayGateway.verifySignature()` — signature invalide → false
- [ ] `TODO` Créer `src/__tests__/api/webhooks.test.ts` :
  - POST /api/webhooks/smobilpay — signature invalide → 401
  - POST /api/webhooks/smobilpay — paiement déjà traité → 200 idempotent
  - POST /api/webhooks/smobilpay — CONFIRME → paiement confirmé + abonnement activé
  - POST /api/webhooks/smobilpay — ECHEC → paiement marqué ECHEC
- [ ] `TODO` `npx vitest run` — tous les tests passent
- [ ] `TODO` `npm run build` — build OK
- [ ] `TODO` Écrire `docs/tests/rapport-sprint-31.md`

**Tâches @code-reviewer :**
- [ ] `TODO` Vérifier sécurité webhook (signature obligatoire avant tout traitement)
- [ ] `TODO` Vérifier idempotence des webhooks et des paiements
- [ ] `TODO` Vérifier que les clés API ne sont jamais loggées ni exposées
- [ ] `TODO` Checklist R1-R9
- [ ] `TODO` Écrire `docs/reviews/review-sprint-31.md`

**Critères d'acceptation :**
- Tests gateway + webhooks passent
- Build OK (R9)
- Sécurité webhook validée par le code-reviewer
- Aucune clé API dans les logs

---

## Sprint 32 — API Abonnements + Plans

**Objectif :** Créer toutes les routes API pour la gestion des plans et des abonnements.
Les plans sont gérés par les admins DKFarm. Les abonnements sont créés par les promoteurs.

**Dépend de :** Sprint 31 FAIT

---

### Story 32.1 — API Routes Plans
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Statut :** `FAIT`

**Description :** CRUD complet pour les plans d'abonnement. La liste publique est accessible sans
authentification pour la page marketing.

**Tâches :**
- [x] `FAIT` Créer `src/app/api/plans/route.ts` (GET public + GET auth + POST)
- [x] `FAIT` Créer `src/app/api/plans/[id]/route.ts` (GET + PUT + DELETE avec 409)
- [x] `FAIT` Créer `src/app/api/plans/[id]/toggle/route.ts` (PATCH atomique R4)

**Critères d'acceptation :**
- Liste publique accessible sans token (pour la page marketing)
- R4 : toggle via `updateMany`
- 409 si on supprime un plan avec des abonnés actifs

---

### Story 32.2 — API Routes Abonnements
**Assigné à :** @developer
**Priorité :** Critique
**Complexité :** Complex
**Dépend de :** Story 32.1, Sprint 31
**Statut :** `FAIT`

**Description :** Routes pour créer et gérer les abonnements d'un site. La souscription déclenche
automatiquement l'initiation du paiement.

**Tâches :**
- [x] `FAIT` Créer `src/app/api/abonnements/route.ts` (GET liste + POST souscription)
- [x] `FAIT` Créer `src/app/api/abonnements/[id]/route.ts` (GET détail)
- [x] `FAIT` Créer `src/app/api/abonnements/[id]/renouveler/route.ts` (POST)
- [x] `FAIT` Créer `src/app/api/abonnements/[id]/annuler/route.ts` (POST R4 atomique)
- [x] `FAIT` Créer `src/app/api/abonnements/actif/route.ts` (GET)

**Critères d'acceptation :**
- R2 : enums importés (`StatutAbonnement.ACTIF`, etc.)
- R4 : transitions de statut atomiques
- R8 : toutes les queries filtrées par `siteId` du site actif
- Code remise validé avant création de l'abonnement (verifierRemiseApplicable)

---

### Story 32.3 — API Routes Paiements abonnements
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Story 32.2
**Statut :** `FAIT`

**Description :** Routes pour consulter l'historique des paiements et vérifier manuellement
le statut d'un paiement en attente.

**Tâches :**
- [x] `FAIT` Créer `src/app/api/abonnements/[id]/paiements/route.ts` (GET historique + POST initier)
- [x] `FAIT` Créer `src/app/api/paiements/[id]/verifier/route.ts` (GET vérification idempotente)

**Critères d'acceptation :**
- Polling de statut ne crée pas de doublons
- Idempotence : vérifier = ne déclenche jamais d'actions irréversibles côté DB sans confirmation

---

### Story 32.4 — Middleware restriction abonnement expiré
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Stories 32.2, 30.4
**Statut :** `FAIT`

**Description :** Implémenter la restriction de mode lecture seule pour les sites en `SUSPENDU`
et le blocage pour les sites `EXPIRE`. Ce middleware s'applique dans les Server Components
et éventuellement dans les API routes critiques.

**Tâches :**
- [x] `FAIT` Créer `src/lib/abonnements/check-subscription.ts` (getSubscriptionStatus, isSubscriptionValid, isReadOnlyMode, isBlocked)
- [x] `FAIT` Créer `src/components/subscription/subscription-banner.tsx` (Server Component, mobile-first)
- [x] `FAIT` Intégrer `<SubscriptionBanner>` dans `src/app/layout.tsx`
- [x] `FAIT` Désactiver boutons en mode SUSPENDU (pages vagues, bacs, relevés)

**Critères d'acceptation :**
- Banner visible sur toutes les pages si EN_GRACE ou SUSPENDU
- Boutons de création désactivés en SUSPENDU (pas en ACTIF ou EN_GRACE)
- Plan DECOUVERTE non impacté par les restrictions
- Mobile-first : banner compact sur 360px

---

### Story 32.5 — Tests + Review Sprint 32
**Assigné à :** @tester + @code-reviewer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Stories 32.1 à 32.4
**Statut :** `FAIT`

**Tâches @tester :**
- [x] `FAIT` Créer `src/__tests__/api/plans.test.ts` (15 tests)
- [x] `FAIT` Créer `src/__tests__/api/abonnements.test.ts` (13 tests)
- [x] `FAIT` Créer `src/__tests__/api/paiements-abonnements.test.ts` (13 tests — ajouté 2026-03-21)
- [x] `FAIT` Créer `src/__tests__/lib/check-subscription.test.ts` (20 tests)
- [x] `FAIT` `npx vitest run` — 61/61 PASS + `npm run build` — OK
- [x] `FAIT` `docs/tests/rapport-sprint-32.md` produit

**Tâches @code-reviewer :**
- [x] `FAIT` Checklist R1-R9 — toutes PASS
- [x] `FAIT` Liste publique des plans : pas de fuite de données sensibles
- [x] `FAIT` Plan DECOUVERTE non impacté par les restrictions
- [x] `FAIT` `docs/reviews/review-sprint-32.md` produit

**Critères d'acceptation :**
- Tests API complets + build OK — VALIDE
- Plan DECOUVERTE non impacté par les restrictions — CONFIRMÉ
- Rapport de review produit — VALIDE

---

## Sprint 33 — UI Checkout + Mon Abonnement

**Objectif :** Créer le parcours d'achat complet (sélection du plan → choix du mode de paiement →
confirmation) et la page "Mon Abonnement" pour les promoteurs. Mobile-first obligatoire.

**Dépend de :** Sprint 32 FAIT

---

### Story 33.1 — Page listing des plans (publique)
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Statut :** `FAIT`

**Description :** Page publique présentant les plans disponibles avec leurs tarifs. Accessible
sans authentification. Serveur Component pour le SEO.

**Tâches :**
- [ ] `TODO` Créer `src/app/tarifs/page.tsx` (Server Component) — charge les plans via `GET /api/plans?public=true`
- [ ] `TODO` Créer `src/components/abonnements/plans-grid.tsx` (Server Component) :
  - Grille responsive : 1 colonne mobile (360px), 2 colonnes tablette, 4 colonnes desktop
  - Carte par plan : nom, prix mensuel/trimestriel/annuel (tabs ou toggle), limites (bacs, vagues, sites), badge "Populaire" sur PROFESSIONNEL, badge "Gratuit" sur DECOUVERTE
  - Bouton "Choisir ce plan" → /checkout?planId={id}
  - Plan DECOUVERTE : bouton "Commencer gratuitement" → /inscription
  - Mise en évidence visuelle du plan sélectionné (si l'utilisateur est connecté et a un abonnement actif)
- [ ] `TODO` Créer `src/components/abonnements/plan-comparaison-table.tsx` — tableau de comparaison des fonctionnalités par plan (visible uniquement desktop)
- [ ] `TODO` Mobile-first : cartes empilées, boutons 44px min, prix lisibles en 360px

**Critères d'acceptation :**
- Page accessible sans authentification
- Prix PLAN_TARIFS cohérents avec `src/lib/abonnements-constants.ts`
- R6 : CSS variables du thème (pas de couleurs hardcodées)
- Toggle mensuel/trimestriel/annuel fonctionnel côté client

---

### Story 33.2 — Formulaire checkout multi-étapes
**Assigné à :** @developer
**Priorité :** Critique
**Complexité :** Complex
**Dépend de :** Story 33.1
**Statut :** `FAIT`

**Description :** Formulaire de souscription en 3 étapes. Prérequis : utilisateur authentifié.
Si non connecté, rediriger vers /connexion?redirect=/checkout?planId=...

**Tâches :**
- [ ] `TODO` Créer `src/app/checkout/page.tsx` (Server Component) — vérifie auth, charge plan depuis query param `planId`, redirige si non connecté
- [ ] `TODO` Créer `src/components/abonnements/checkout-form.tsx` (Client Component "use client") :
  - **Étape 1 — Sélection du plan** : confirmer le plan choisi, sélectionner la période (MENSUEL/TRIMESTRIEL/ANNUEL), afficher le prix calculé, champ code promo (appel GET /api/remises/verifier?code=XXX avec debounce 500ms), afficher la remise appliquée si code valide
  - **Étape 2 — Mode de paiement** : sélectionner le fournisseur (Smobilpay en Phase 1, avec logos), saisir le numéro de téléphone mobile money (format +237 6XX XX XX XX), résumé du montant final
  - **Étape 3 — Confirmation et attente** : appeler `POST /api/abonnements` → déclenche l'initiation, afficher l'instruction "Validez le paiement sur votre téléphone", polling toutes les 5s sur `GET /api/paiements/[id]/verifier` (max 10 tentatives = 50s), afficher spinner et statut en temps réel, succès → redirect /mon-abonnement, échec → message d'erreur + bouton "Réessayer"
  - Barre de progression des étapes visible en haut
- [ ] `TODO` Mobile-first : étapes en pleine largeur sur mobile, formulaire compact, boutons 44px

**Critères d'acceptation :**
- R5 : pas de Dialog imbriqué dans les étapes
- R6 : CSS variables du thème
- Validation du numéro de téléphone côté client (+237 6XX)
- Polling de statut s'arrête proprement (pas de fuite mémoire useEffect)
- Accessibilité : focus géré entre les étapes (scroll to top)

---

### Story 33.3 — Page "Mon Abonnement" (promoteur)
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Story 33.2
**Statut :** `FAIT`

**Description :** Page de gestion de l'abonnement actuel du promoteur. Affiche le plan actif,
la date d'expiration, l'historique des paiements et les actions disponibles.

**Tâches :**
- [ ] `TODO` Créer `src/app/mon-abonnement/page.tsx` (Server Component) — charge l'abonnement actif via `GET /api/abonnements/actif`
- [ ] `TODO` Créer `src/components/abonnements/abonnement-actuel-card.tsx` :
  - Nom du plan, statut badge coloré (ACTIF=vert, EN_GRACE=orange, SUSPENDU=rouge), date d'expiration, jours restants
  - Barre de progression de la période (0% au début, 100% à l'expiration)
  - Bouton "Renouveler" si EN_GRACE, SUSPENDU ou < 14 jours avant expiration
  - Bouton "Changer de plan" → /tarifs
  - Bouton "Annuler" (dialog de confirmation) si ACTIF
- [ ] `TODO` Créer `src/components/abonnements/paiements-history-list.tsx` :
  - Liste des paiements : date, montant, fournisseur, statut badge, référence tronquée
  - Mobile : cartes empilées (pas de tableau)
- [ ] `TODO` Créer `src/app/mon-abonnement/renouveler/page.tsx` — redirige vers /checkout?planId={currentPlanId}&renouvellement=true
- [ ] `TODO` Ajouter /mon-abonnement dans la navigation (menu utilisateur ou section paramètres)

**Critères d'acceptation :**
- Statuts visuellement distincts (couleurs via CSS variables)
- R5 : DialogTrigger asChild sur le dialog d'annulation
- Mobile-first : cartes de paiement lisibles à 360px
- Redirections correctes depuis le banner Sprint 32

---

### Story 33.4 — Page gestion abonnements (admin)
**Assigné à :** @developer
**Priorité :** Moyenne
**Complexité :** Medium
**Dépend de :** Story 33.3
**Statut :** `FAIT`

**Description :** Page d'administration listant tous les abonnements des sites supervisés.
Accessible aux admins DKFarm (`Permission.ABONNEMENTS_GERER`).

**Tâches :**
- [ ] `TODO` Créer `src/app/admin/abonnements/page.tsx` (Server Component) — charge tous les abonnements paginés, protégé par `ABONNEMENTS_GERER`
- [ ] `TODO` Créer `src/components/abonnements/abonnements-admin-list.tsx` (Client Component) :
  - Filtres : statut, plan, date expiration (avant/après)
  - Tableau desktop, cartes mobile
  - Colonnes : site, plan, statut, date début, date fin, montant payé, actions
  - Action "Forcer activation" (via webhook manuel) pour les paiements en attente
  - Action "Annuler" avec dialog de confirmation
- [ ] `TODO` Ajouter /admin/abonnements dans la navigation admin (sous "Administration")

**Critères d'acceptation :**
- Accessible uniquement avec `Permission.ABONNEMENTS_GERER`
- R8 : l'admin voit les abonnements de tous les sites (pas filtré par activeSiteId)
- Pagination côté serveur (paramètre `?page=N&limit=20`)

---

### Story 33.5 — Tests + Review Sprint 33
**Assigné à :** @tester + @code-reviewer
**Priorité :** Haute
**Complexité :** Simple
**Dépend de :** Stories 33.1 à 33.4
**Statut :** `FAIT`

**Tâches @tester :**
- [ ] `TODO` Test UI `checkout-form.tsx` : validation étape 1 (plan requis), validation étape 2 (numéro téléphone format), polling étape 3 (mock, arrêt après 10 tentatives)
- [ ] `TODO` Test unitaire `plans-grid.tsx` : rendu correct du prix selon période sélectionnée
- [ ] `TODO` Test intégration checkout complet : sélection plan → paiement → activation abonnement (avec mock gateway)
- [ ] `TODO` `npx vitest run` + `npm run build` — OK
- [ ] `TODO` Test manuel mobile 360px : vérifier que le formulaire multi-étapes est utilisable
- [ ] `TODO` Écrire `docs/tests/rapport-sprint-33.md`

**Tâches @code-reviewer :**
- [ ] `TODO` Checklist R1-R9
- [ ] `TODO` Vérifier accessibilité checkout (focus management, aria-labels sur les étapes)
- [ ] `TODO` Vérifier absence de fuite mémoire dans le polling (cleanup useEffect)
- [ ] `TODO` Écrire `docs/reviews/review-sprint-33.md`

**Critères d'acceptation :**
- Tests UI + intégration passent
- Build OK (R9)
- Accessibilité checkout validée
- Rapport de review produit

---

## Sprint 34 — Commissions Ingénieur + Portefeuille

**Objectif :** Implémenter le calcul automatique des commissions lors de chaque paiement confirmé,
le tableau de bord des commissions pour l'ingénieur et le workflow de retrait.

**Dépend de :** Sprint 32 FAIT (API paiements disponible)

---

### Story 34.1 — Service de calcul des commissions
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Statut :** `TODO`

**Description :** Lors de la confirmation d'un paiement (webhook Sprint 31), calculer et créer
automatiquement la commission de l'ingénieur superviseur si applicable.

**Tâches :**
- [ ] `TODO` Créer `src/lib/services/commissions.ts` :
  - `calculerEtCreerCommission(abonnementId, paiementId, siteId): Promise<CommissionIngenieur | null>` :
    1. Charger le site → vérifier s'il est supervisé (`supervised = true`) et a un `ingenieurId` superviseur
    2. Charger la relation ingénieur-site depuis `SiteMember` (role INGENIEUR)
    3. Calculer le taux : `COMMISSION_TAUX_PREMIUM` (0.20) si l'ingénieur a la permission `COMMISSION_PREMIUM` (à ajouter), sinon `COMMISSION_TAUX_DEFAULT` (0.10)
    4. Calculer `montant = paiement.montant * taux`
    5. Créer `CommissionIngenieur` EN_ATTENTE via `createCommission()`
    6. Retourner la commission créée ou null si pas d'ingénieur superviseur
  - `rendreCommissionsDisponibles(): Promise<number>` — utilisé par le CRON job : `rendrCommissionsDisponibles(subDays(now(), 30))`
- [ ] `TODO` Intégrer `calculerEtCreerCommission` dans la transaction du webhook (Story 31.3) — fire-and-forget (pas de blocage si erreur)
- [ ] `TODO` Ajouter `Permission.COMMISSION_PREMIUM` dans `src/types/models.ts` enum Permission et dans `PERMISSION_GROUPS`

**Critères d'acceptation :**
- Commission créée automatiquement lors de chaque paiement confirmé sur site supervisé
- Pas de commission créée si site non supervisé
- Taux appliqué correctement (10% ou 20% selon permission)
- Idempotence : si webhook rejoué, pas de double commission (vérifier par `paiementId` unique)

---

### Story 34.2 — API Routes commissions + portefeuille
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Story 34.1
**Statut :** `TODO`

**Description :** Exposer les données de commissions et de portefeuille via des routes API
sécurisées. Les ingénieurs voient leurs propres données, les admins DKFarm voient tout.

**Tâches :**
- [ ] `TODO` Créer `src/app/api/commissions/route.ts` :
  - `GET` — liste des commissions de l'ingénieur connecté (filtres : statut, période). Auth + `Permission.COMMISSIONS_VOIR`. Si `Permission.COMMISSIONS_GERER` → peut voir toutes les commissions de tous les ingénieurs avec `?ingenieurId=...`
- [ ] `TODO` Créer `src/app/api/portefeuille/route.ts` :
  - `GET` — solde + historique des commissions récentes + retraits en cours. Auth + `Permission.PORTEFEUILLE_VOIR`
- [ ] `TODO` Créer `src/app/api/portefeuille/retrait/route.ts` :
  - `POST` — demander un retrait (`DemandeRetraitDTO`). Vérifie `solde >= montant`. Auth + `Permission.PORTEFEUILLE_VOIR`
- [ ] `TODO` Créer `src/app/api/portefeuille/retrait/[id]/traiter/route.ts` :
  - `POST` — traiter un retrait (admin DKFarm). Appelle `traiterRetrait()`. Auth + `Permission.PORTEFEUILLE_GERER`
- [ ] `TODO` Créer `src/app/api/portefeuille/retrait/[id]/route.ts` :
  - `GET` — détail d'un retrait. Auth + `Permission.PORTEFEUILLE_VOIR`

**Critères d'acceptation :**
- Un ingénieur ne voit que ses propres commissions
- Un admin DKFarm peut voir les commissions de n'importe quel ingénieur
- Retrait impossible si solde insuffisant (400 avec message clair)
- R8 : siteId DKFarm sur les commissions

---

### Story 34.3 — UI Dashboard commissions ingénieur
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Story 34.2
**Statut :** `TODO`

**Description :** Tableau de bord des commissions pour l'ingénieur. Affiche le solde disponible,
les commissions en attente, et l'historique des retraits.

**Tâches :**
- [ ] `TODO` Créer `src/app/mon-portefeuille/page.tsx` (Server Component) — protégé par `PORTEFEUILLE_VOIR`
- [ ] `TODO` Créer `src/components/commissions/portefeuille-summary.tsx` :
  - Carte "Solde disponible" (en XAF, gros chiffre)
  - Carte "En attente" (commissions qui attendent 30 jours avant d'être disponibles)
  - Carte "Total gagné" depuis le début
  - Bouton "Demander un retrait" (dialog) → visible si solde > 0
- [ ] `TODO` Créer `src/components/commissions/commissions-list.tsx` :
  - Tabs : En attente | Disponibles | Payées | Toutes
  - Carte par commission : nom de la ferme cliente, montant, taux, période, statut badge, date de disponibilité
  - Mobile : cartes empilées
- [ ] `TODO` Créer `src/components/commissions/retrait-dialog.tsx` :
  - Montant (max = solde disponible), numéro de téléphone, fournisseur
  - Récapitulatif avant confirmation
  - R5 : DialogTrigger asChild
- [ ] `TODO` Créer `src/components/commissions/retraits-list.tsx` — historique des retraits avec statuts
- [ ] `TODO` Ajouter /mon-portefeuille dans la navigation (visible pour les ingénieurs uniquement)

**Critères d'acceptation :**
- Solde mis à jour en temps réel après confirmation de retrait
- R5 : DialogTrigger asChild sur le dialog retrait
- Mobile-first : tous les éléments lisibles à 360px
- Visible uniquement si l'utilisateur a `PORTEFEUILLE_VOIR`

---

### Story 34.4 — UI Admin commissions (DKFarm)
**Assigné à :** @developer
**Priorité :** Moyenne
**Complexité :** Simple
**Dépend de :** Story 34.3
**Statut :** `TODO`

**Description :** Vue admin pour les commissions et les demandes de retrait. Accessible aux
admins DKFarm pour traiter les virements.

**Tâches :**
- [ ] `TODO` Créer `src/app/admin/commissions/page.tsx` (Server Component) — protégé par `COMMISSIONS_GERER`
- [ ] `TODO` Créer `src/components/commissions/admin-retraits-list.tsx` :
  - Liste des retraits DEMANDES (en attente de traitement) en haut
  - Bouton "Traiter" par retrait → dialog de confirmation avec saisie de la référence de virement
  - Liste des retraits traités en dessous
- [ ] `TODO` Ajouter /admin/commissions dans la navigation admin

**Critères d'acceptation :**
- Accessible uniquement avec `Permission.COMMISSIONS_GERER`
- Dialog "Traiter" avec saisie de la référence de virement obligatoire
- R5 : DialogTrigger asChild

---

### Story 34.5 — Tests + Review Sprint 34
**Assigné à :** @tester + @code-reviewer
**Priorité :** Haute
**Complexité :** Simple
**Dépend de :** Stories 34.1 à 34.4
**Statut :** `TODO`

**Tâches @tester :**
- [ ] `TODO` Créer `src/__tests__/lib/commissions.test.ts` :
  - `calculerEtCreerCommission()` — site supervisé → commission 10% créée
  - `calculerEtCreerCommission()` — site non supervisé → null (pas de commission)
  - `calculerEtCreerCommission()` — ingénieur COMMISSION_PREMIUM → 20%
  - `calculerEtCreerCommission()` — idempotence (même paiementId = pas de doublon)
  - `rendreCommissionsDisponibles()` — commissions vieilles de > 30j → DISPONIBLE
- [ ] `TODO` Créer `src/__tests__/api/portefeuille.test.ts` :
  - GET /portefeuille — retourne solde + commissions
  - POST /portefeuille/retrait — solde suffisant → retrait créé
  - POST /portefeuille/retrait — solde insuffisant → 400
  - POST /portefeuille/retrait/[id]/traiter — admin → retrait traité + solde débité
- [ ] `TODO` `npx vitest run` + `npm run build` — OK
- [ ] `TODO` Écrire `docs/tests/rapport-sprint-34.md`

**Tâches @code-reviewer :**
- [ ] `TODO` Checklist R1-R9
- [ ] `TODO` Vérifier que les ingénieurs ne peuvent pas voir les commissions des autres
- [ ] `TODO` Vérifier l'idempotence des commissions (pas de doublon sur replay webhook)
- [ ] `TODO` Écrire `docs/reviews/review-sprint-34.md`

**Critères d'acceptation :**
- Tests passent + build OK
- Isolation des données ingénieur confirmée
- Idempotence des commissions validée
- Rapport de review produit

---

## Sprint 35 — Système de Remises & Promotions

**Objectif :** Implémenter le CRUD des remises, la validation des codes promo, l'application
automatique des remises early adopter, et la page admin de gestion des promotions.

**Dépend de :** Sprint 32 FAIT (les remises sont utilisées dans le checkout)

---

### Story 35.1 — API Routes Remises
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Statut :** `TODO`

**Description :** CRUD complet des remises avec validation des codes promo publique.

**Tâches :**
- [ ] `TODO` Créer `src/app/api/remises/route.ts` :
  - `GET` — liste des remises du site actif + globales. Auth + `Permission.REMISES_GERER`
  - `POST` — créer une remise. Valider que `code` est unique. Auth + `Permission.REMISES_GERER`
- [ ] `TODO` Créer `src/app/api/remises/[id]/route.ts` :
  - `GET` — détail. Auth + `Permission.REMISES_GERER`
  - `PUT` — modifier. Auth + `Permission.REMISES_GERER`. Interdit de modifier `code` ou `type`
  - `DELETE` — supprimer si `nombreUtilisations = 0`. Sinon désactiver. Auth + `Permission.REMISES_GERER`
- [ ] `TODO` Créer `src/app/api/remises/verifier/route.ts` :
  - `GET ?code=XXX` — vérifier un code promo. Public (sans auth). Appelle `verifierRemiseApplicable()`. Retourne `{ valide: boolean, remise?: Remise, messageErreur?: string }`. Limiter à 10 appels/min par IP (rate limiting basic)
- [ ] `TODO` Créer `src/app/api/remises/[id]/toggle/route.ts` :
  - `PATCH` — activer/désactiver. R4 : `updateMany`. Auth + `Permission.REMISES_GERER`

**Critères d'acceptation :**
- Code promo unique (400 si doublon lors de la création)
- Route /verifier publique mais rate-limitée
- R4 : toggle atomique
- Suppression : déactiver si utilisée, supprimer si `nombreUtilisations = 0`

---

### Story 35.2 — Remise automatique Early Adopter
**Assigné à :** @developer
**Priorité :** Moyenne
**Complexité :** Simple
**Dépend de :** Story 35.1
**Statut :** `TODO`

**Description :** Appliquer automatiquement une remise "Early Adopter" lors de la première
souscription d'un site (si une remise EARLY_ADOPTER active et globale existe).

**Tâches :**
- [ ] `TODO` Créer `src/lib/services/remises-automatiques.ts` :
  - `verifierEtAppliquerRemiseAutomatique(siteId, abonnementId, userId): Promise<Remise | null>` :
    1. Vérifier que c'est le premier abonnement du site (pas d'historique d'abonnement payant)
    2. Chercher la remise globale EARLY_ADOPTER active et non expirée avec la plus grande valeur
    3. Si trouvée et applicable : appeler `appliquerRemise(remise.id, abonnementId, userId)`
    4. Retourner la remise appliquée ou null
- [ ] `TODO` Intégrer dans `POST /api/abonnements` (Story 32.2) : appeler `verifierEtAppliquerRemiseAutomatique` après création de l'abonnement
- [ ] `TODO` Ajouter dans le seed.sql une remise EARLY_ADOPTER `code="EARLY2026"`, valeur=2000 XAF fixe, active jusqu'au 2026-12-31

**Critères d'acceptation :**
- Remise appliquée automatiquement lors de la première souscription
- Pas de remise appliquée si déjà abonné par le passé
- Seed contient une remise EARLY_ADOPTER de test

---

### Story 35.3 — UI Gestion des remises (admin)
**Assigné à :** @developer
**Priorité :** Moyenne
**Complexité :** Medium
**Dépend de :** Story 35.1
**Statut :** `TODO`

**Description :** Pages admin pour créer et gérer les codes promo et remises.

**Tâches :**
- [ ] `TODO` Créer `src/app/admin/remises/page.tsx` (Server Component) — liste des remises, protégé par `REMISES_GERER`
- [ ] `TODO` Créer `src/components/remises/remises-list-client.tsx` (Client Component) :
  - Tabs : Actives | Expirées | Toutes
  - Carte par remise : code (en gros, copiable), nom, type badge, valeur, utilisations/limite, date fin
  - Toggle actif/inactif sur chaque carte (PATCH /toggle, optimistic update)
  - Bouton "Modifier" et "Supprimer" sur chaque carte
- [ ] `TODO` Créer `src/components/remises/remise-form-dialog.tsx` (Client Component) :
  - Création et modification via dialog
  - Champs : code (auto-suggéré depuis nom), nom, type (select TypeRemise), valeur, estPourcentage (toggle), dateDebut, dateFin (optionnel), limiteUtilisations (optionnel)
  - Validation : code alphanumérique + tirets, valeur > 0, dateFin > dateDebut
  - R5 : DialogTrigger asChild
- [ ] `TODO` Ajouter /admin/remises dans la navigation admin

**Critères d'acceptation :**
- R5 : DialogTrigger asChild
- R6 : CSS variables du thème
- Code promo en majuscules forcé (trim + toUpperCase côté client)
- Accessible uniquement avec `REMISES_GERER`

---

### Story 35.4 — Tests + Review Sprint 35
**Assigné à :** @tester + @code-reviewer
**Priorité :** Haute
**Complexité :** Simple
**Dépend de :** Stories 35.1 à 35.3
**Statut :** `TODO`

**Tâches @tester :**
- [ ] `TODO` Créer `src/__tests__/api/remises.test.ts` :
  - GET /remises/verifier — code valide → `{ valide: true, remise: ... }`
  - GET /remises/verifier — code inexistant → `{ valide: false, messageErreur: "..." }`
  - GET /remises/verifier — code expiré → `{ valide: false }`
  - GET /remises/verifier — limite atteinte → `{ valide: false }`
  - POST /remises — code dupliqué → 400
  - PATCH /remises/[id]/toggle — atomique, retourne nouvel état
- [ ] `TODO` Créer `src/__tests__/lib/remises-automatiques.test.ts` :
  - Premier abonnement + remise EARLY_ADOPTER active → remise appliquée
  - Deuxième abonnement → pas de remise automatique
  - Pas de remise EARLY_ADOPTER active → null
- [ ] `TODO` `npx vitest run` + `npm run build` — OK
- [ ] `TODO` Écrire `docs/tests/rapport-sprint-35.md`

**Tâches @code-reviewer :**
- [ ] `TODO` Checklist R1-R9
- [ ] `TODO` Vérifier que la route /verifier ne fuit pas les détails internes des remises
- [ ] `TODO` Vérifier le rate limiting sur /verifier
- [ ] `TODO` Écrire `docs/reviews/review-sprint-35.md`

**Critères d'acceptation :**
- Tests passent + build OK
- Sécurité /verifier validée
- Rapport de review produit

---

## Sprint 36 — Cycle de Vie des Abonnements

**Objectif :** Implémenter le CRON job de gestion du cycle de vie (transitions de statut, rappels),
les notifications de renouvellement et la gestion de la période de grâce.

**Dépend de :** Sprints 31 FAIT, 34 FAIT, 35 FAIT

---

### Story 36.1 — CRON job : transitions de statut quotidiennes
**Assigné à :** @developer
**Priorité :** Critique
**Complexité :** Medium
**Statut :** `TODO`

**Description :** Implémenter le job quotidien qui fait évoluer les statuts d'abonnements.
Utiliser l'approche des Route Handlers Next.js avec sécurisation par clé secrète CRON.

**Tâches :**
- [ ] `TODO` Créer `src/app/api/cron/subscription-lifecycle/route.ts` :
  - `GET` uniquement — vérifie le header `Authorization: Bearer {CRON_SECRET}` (variable `.env`)
  - Appelle `abonnementLifecycleService.transitionnerStatuts()`
  - Appelle `commissionsService.rendreCommissionsDisponibles()`
  - Retourne `{ processed: { graces, suspendus, expires, commissionsDisponibles } }`
  - Configuré pour être appelé quotidiennement par Vercel Cron ou un service externe
- [ ] `TODO` Ajouter `CRON_SECRET` dans `.env.example`
- [ ] `TODO` Créer `vercel.json` (si pas existant) avec la configuration cron : `"crons": [{ "path": "/api/cron/subscription-lifecycle", "schedule": "0 8 * * *" }]` (tous les jours à 8h UTC)
- [ ] `TODO` Documenter dans `docs/decisions/019-cron-jobs.md` : choix de Vercel Cron vs service externe, sécurisation par CRON_SECRET, idempotence du job

**Critères d'acceptation :**
- Route sécurisée (401 sans CRON_SECRET valide)
- Idempotence : exécuter le job deux fois le même jour ne change rien si déjà exécuté
- Retour du nombre d'abonnements traités dans chaque catégorie
- Configuration Vercel Cron documentée

---

### Story 36.2 — CRON job : rappels de renouvellement
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Story 36.1
**Statut :** `TODO`

**Description :** Envoyer des rappels (notifications in-app) aux promoteurs avant l'expiration
de leur abonnement (J-14, J-7, J-3, J-1).

**Tâches :**
- [ ] `TODO` Créer `src/lib/services/rappels-abonnement.ts` :
  - `envoyerRappelsRenouvellement(): Promise<{ envoyes: number }>` :
    1. `getAbonnementsExpirantAvant(addDays(now(), 14))` qui ont statut ACTIF
    2. Pour chaque abonnement, calculer `daysRemaining` et créer une notification in-app si `daysRemaining` IN [14, 7, 3, 1]
    3. Éviter les doublons : vérifier si une notification de même type existe déjà pour ce jour (via un champ `type` sur les notifications)
    4. Retourner le nombre de notifications envoyées
- [ ] `TODO` Intégrer `envoyerRappelsRenouvellement()` dans la route CRON (Story 36.1)
- [ ] `TODO` Créer le type de notification `ABONNEMENT_RAPPEL_RENOUVELLEMENT` (ajouter à l'enum `TypeNotification` si existant, sinon documenter l'approche)
- [ ] `TODO` Message de notification : "Votre abonnement {plan} expire dans {N} jour(s). Renouvelez maintenant pour éviter l'interruption de service." avec lien /mon-abonnement/renouveler

**Critères d'acceptation :**
- Rappels envoyés exactement à J-14, J-7, J-3, J-1 (pas plusieurs fois le même jour)
- Pas de rappel pour les plans DECOUVERTE (gratuit)
- Pas de rappel si l'abonnement a déjà été renouvelé

---

### Story 36.3 — Page renouvellement depuis état expiré
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Simple
**Dépend de :** Sprints 32, 33
**Statut :** `TODO`

**Description :** Gérer le cas où un promoteur accède à l'app avec un abonnement expiré ou suspendu.
Afficher une page de blocage avec les options de renouvellement.

**Tâches :**
- [ ] `TODO` Créer `src/app/abonnement-expire/page.tsx` (Server Component) :
  - Affiche un message clair selon le statut : EN_GRACE ("Votre abonnement a expiré, vous avez encore {N} jours"), SUSPENDU ("Votre compte est en mode lecture seule"), EXPIRE ("Votre compte est suspendu")
  - Bouton principal "Renouveler mon abonnement" → /checkout?planId={lastPlanId}
  - Bouton secondaire "Voir les plans" → /tarifs
  - Liens de contact support
- [ ] `TODO` Créer `src/middleware.ts` ou modifier le middleware existant :
  - Après vérification auth, charger le statut d'abonnement du site actif
  - Si `EXPIRE` et pas sur les routes exclues (/connexion, /tarifs, /abonnement-expire, /api/webhooks, /api/cron) → redirect `/abonnement-expire`
  - Si `SUSPENDU` → ne pas rediriger, le mode lecture seule est géré côté composant (Sprint 32)
  - Exclure les plans DECOUVERTE de ce check
- [ ] `TODO` Liste blanche des routes accessibles en mode EXPIRE : `/connexion`, `/tarifs`, `/mon-abonnement`, `/abonnement-expire`, `/api/auth/*`

**Critères d'acceptation :**
- Redirect automatique vers /abonnement-expire si statut EXPIRE
- Plans DECOUVERTE non impactés
- Routes whitelistées accessibles en EXPIRE
- Page /abonnement-expire utilisable sans abonnement actif (pas d'appels API qui échouent)

---

### Story 36.4 — Gestion des limites de plan (quotas)
**Assigné à :** @developer
**Priorité :** Moyenne
**Complexité :** Medium
**Dépend de :** Story 32.4
**Statut :** `TODO`

**Description :** Appliquer les limites définies par le plan (nombre de bacs, vagues, sites).
Bloquer la création quand la limite est atteinte, afficher l'utilisation actuelle.

**Tâches :**
- [ ] `TODO` Créer `src/lib/abonnements/check-quotas.ts` :
  - `getQuotasUsage(siteId): Promise<{ bacs: { actuel: number, limite: number }, vagues: { actuel: number, limite: number }, sites: { actuel: number, limite: number } }>`
  - Charge l'abonnement actif → récupère le plan → récupère les limites depuis `PLAN_LIMITES`
  - Compte les bacs actifs, vagues en cours, sites
  - Plan DECOUVERTE : limites strictes (3 bacs, 1 vague, 1 site)
  - Plan ENTREPRISE : pas de limite (`null` = illimité)
- [ ] `TODO` Créer `src/components/subscription/quotas-usage-bar.tsx` :
  - Barre de progression par ressource (bacs, vagues)
  - Affiche "3/3 bacs utilisés" avec barre rouge si plein
  - Bouton "Mettre à niveau" → /tarifs si limite atteinte
- [ ] `TODO` Modifier les API routes de création :
  - `POST /api/bacs` : vérifier `bacs.actuel < bacs.limite` avant création → 402 avec `{ error: "QUOTA_DEPASSE", ressource: "bacs", limite: N }` si dépassé
  - `POST /api/vagues` : même logique pour vagues
- [ ] `TODO` Afficher `<QuotasUsageBar>` dans les pages de liste des bacs et des vagues

**Critères d'acceptation :**
- Plan DECOUVERTE : impossible de créer plus de 3 bacs (402 retourné)
- Plan ELEVEUR : impossible de créer plus de N bacs selon PLAN_LIMITES
- Plan ENTREPRISE : aucune restriction (limite = null = illimité)
- Barre de progression visible sur les pages bacs et vagues

---

### Story 36.5 — Tests + Review Sprint 36
**Assigné à :** @tester + @code-reviewer
**Priorité :** Haute
**Complexité :** Medium
**Dépend de :** Stories 36.1 à 36.4
**Statut :** `TODO`

**Tâches @tester :**
- [ ] `TODO` Créer `src/__tests__/api/cron.test.ts` :
  - GET /api/cron/subscription-lifecycle — sans CRON_SECRET → 401
  - GET /api/cron/subscription-lifecycle — avec secret valide → retourne les counts
  - Idempotence : 2e exécution le même jour → counts = 0
- [ ] `TODO` Créer `src/__tests__/lib/rappels-abonnement.test.ts` :
  - Abonnement expirant dans 7 jours → rappel créé
  - Abonnement expirant dans 8 jours → pas de rappel
  - Rappel déjà envoyé aujourd'hui → pas de doublon
- [ ] `TODO` Créer `src/__tests__/lib/check-quotas.test.ts` :
  - Plan DECOUVERTE, 3 bacs → quota plein
  - Plan ELEVEUR, 2/10 bacs → quota non plein
  - Plan ENTREPRISE → limite null (illimité)
- [ ] `TODO` Test intégration : création bac sur plan DECOUVERTE avec 3 bacs existants → 402
- [ ] `TODO` `npx vitest run` + `npm run build` — OK
- [ ] `TODO` Écrire `docs/tests/rapport-sprint-36.md`

**Tâches @code-reviewer :**
- [ ] `TODO` Checklist R1-R9
- [ ] `TODO` Vérifier sécurisation du CRON (CRON_SECRET obligatoire)
- [ ] `TODO` Vérifier que les quotas ne bloquent pas les plans ENTREPRISE (limite null = illimité)
- [ ] `TODO` Vérifier que les plans DECOUVERTE ne sont jamais redirigés vers /abonnement-expire
- [ ] `TODO` Écrire `docs/reviews/review-sprint-36.md`

**Critères d'acceptation :**
- Tests CRON + quotas + rappels passent
- Build OK (R9)
- Sécurité CRON validée
- Plans DECOUVERTE exclus des restrictions confirmé
- Rapport de review produit

---

## Sprint 37 — Tests, Polish & Review Finale

**Objectif :** Tests d'intégration end-to-end du système d'abonnements, corrections des bugs
détectés, polish UX mobile et review finale de l'ensemble des Sprints 30-37.

**Dépend de :** Sprint 36 FAIT

---

### Story 37.1 — Tests d'intégration end-to-end
**Assigné à :** @tester
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Écrire les tests d'intégration couvrant les parcours critiques complets.

**Tâches :**
- [ ] `TODO` Créer `src/__tests__/integration/abonnement-checkout-flow.test.ts` :
  - Parcours complet : sélection plan ELEVEUR → souscription → paiement CONFIRME (mock) → abonnement ACTIF → commission ingénieur créée (si site supervisé)
  - Parcours avec code promo : code valide → remise appliquée → paiement réduit
  - Parcours échec paiement : paiement ECHEC → abonnement reste EN_ATTENTE_PAIEMENT → retry possible
  - Parcours renouvellement : abonnement EN_GRACE → renouvellement → paiement CONFIRME → abonnement ACTIF + date prorogée
- [ ] `TODO` Créer `src/__tests__/integration/subscription-lifecycle.test.ts` :
  - CRON quotidien : ACTIF expiré → EN_GRACE → (7j) → SUSPENDU → (30j) → EXPIRE
  - Réactivation depuis SUSPENDU : paiement → ACTIF
  - Rappels : J-7 envoyé, pas de doublon le lendemain
- [ ] `TODO` Créer `src/__tests__/integration/quota-enforcement.test.ts` :
  - DECOUVERTE : 3 bacs créés → 4e bloqué (402)
  - Upgrade DECOUVERTE → ELEVEUR → 4e bac possible
- [ ] `TODO` Lancer `npx vitest run --reporter=verbose` — rapport complet
- [ ] `TODO` `npm run build` — build production OK
- [ ] `TODO` Écrire `docs/tests/rapport-sprint-37.md` avec synthèse de tous les tests abonnements

**Critères d'acceptation :**
- Tous les parcours critiques couverts
- Aucun test en échec (hors pré-existants documentés)
- Build production OK
- Rapport complet des tests produit

---

### Story 37.2 — Polish UX abonnements
**Assigné à :** @developer
**Priorité :** Moyenne
**Complexité :** Simple
**Dépend de :** Story 37.1
**Statut :** `TODO`

**Description :** Corrections UX identifiées lors des tests. Focus sur le mobile 360px et
l'accessibilité des formulaires de paiement.

**Tâches :**
- [ ] `TODO` Vérifier et corriger le formulaire checkout sur mobile 360px :
  - Vérifier que les boutons "étape suivante" ne sont pas coupés
  - Vérifier que le champ numéro de téléphone est de type `tel` avec `inputmode="numeric"`
  - Vérifier que la barre de progression des étapes est lisible à 360px
- [ ] `TODO` Ajouter des états de chargement (skeleton) sur les pages `mon-abonnement` et `mon-portefeuille`
- [ ] `TODO` Ajouter des messages d'état vides cohérents (si pas d'abonnement, si pas de commissions)
- [ ] `TODO` Vérifier l'accessibilité : aria-labels sur les badges de statut, rôle des cartes de plan
- [ ] `TODO` Vérifier que les prix sont formatés en XAF avec `Intl.NumberFormat` (pas de symbole € ou $)
- [ ] `TODO` Ajouter `loading.tsx` pour les pages abonnements (Next.js streaming)

**Critères d'acceptation :**
- Checkout fonctionnel à 360px sans scroll horizontal
- Prix affichés en XAF (ex. "8 000 XAF / mois")
- Skeleton loading sur les pages data-intensive
- Aria-labels sur tous les badges de statut

---

### Story 37.3 — Documentation et mise à jour TASKS.md
**Assigné à :** @architect + @db-specialist
**Priorité :** Haute
**Complexité :** Simple
**Dépend de :** Story 37.1
**Statut :** `TODO`

**Description :** Documenter les décisions finales, mettre à jour les fichiers partagés et
compléter le fichier de migration seed.

**Tâches @architect :**
- [ ] `TODO` Mettre à jour `docs/decisions/016-payment-gateway-abstraction.md` avec les décisions finales (si des changements ont eu lieu pendant l'implémentation)
- [ ] `TODO` Créer `docs/decisions/019-cron-jobs.md` (si pas créé en Sprint 36) — documenter la stratégie Vercel Cron
- [ ] `TODO` Mettre à jour `src/types/index.ts` barrel export pour vérifier exhaustivité

**Tâches @db-specialist :**
- [ ] `TODO` Mettre à jour `prisma/seed.sql` avec toutes les données de test abonnements (4 plans, 2 abonnements, 3 remises, 1 commission, 1 portefeuille ingénieur)
- [ ] `TODO` Vérifier que `npm run db:seed` fonctionne sur base vide
- [ ] `TODO` Mettre à jour `MEMORY.md` avec les nouveaux modèles Sprint 30 et les nouvelles enums

**Critères d'acceptation :**
- Seed complet et fonctionnel sur base vide
- ADR finaux cohérents avec l'implémentation réelle
- MEMORY.md à jour

---

### Story 37.4 — Review finale Sprints 30-37
**Assigné à :** @code-reviewer
**Priorité :** Critique
**Complexité :** Complex
**Dépend de :** Stories 37.1, 37.2, 37.3
**Statut :** `TODO`

**Description :** Review complète de l'ensemble du système d'abonnements. Vérification de
toutes les règles R1-R9 sur l'ensemble des nouveaux fichiers.

**Tâches :**
- [ ] `TODO` Audit R1 — tous les enums abonnements en MAJUSCULES sans exception
- [ ] `TODO` Audit R2 — aucune chaîne littérale d'enum dans le code (grep `"ACTIF"`, `"EN_ATTENTE"`, etc.)
- [ ] `TODO` Audit R3 — tous les modèles Prisma ont leur interface TS miroir (champ par champ)
- [ ] `TODO` Audit R4 — toutes les transitions de statut via `updateMany` avec condition
- [ ] `TODO` Audit R5 — DialogTrigger asChild sur tous les dialogs de confirmation (checkout, annulation, retrait, traitement)
- [ ] `TODO` Audit R6 — aucune couleur hardcodée dans les composants abonnements (recherche `#`, `rgb(`)
- [ ] `TODO` Audit R7 — nullabilité correcte sur tous les nouveaux champs
- [ ] `TODO` Audit R8 — `siteId` présent sur tous les nouveaux modèles concernés
- [ ] `TODO` Audit R9 — `npx vitest run` vert + `npm run build` OK avant cette review
- [ ] `TODO` Vérification sécurité :
  - Webhooks paiement : signature vérifiée avant traitement
  - Routes CRON : CRON_SECRET requis
  - Routes admin : permissions vérifiées (`PLANS_GERER`, `REMISES_GERER`, etc.)
  - Un ingénieur ne peut pas voir les commissions d'un autre ingénieur
  - Un promoteur ne peut pas voir les abonnements d'un autre site
- [ ] `TODO` Vérification mobile (360px) : checkout, mon-abonnement, mon-portefeuille
- [ ] `TODO` Écrire `docs/reviews/review-sprints-30-37.md` (review finale)

**Critères d'acceptation :**
- Toutes les règles R1-R9 vérifiées sans exception
- Aucune faille de sécurité identifiée (permissions, isolation des données)
- Rapport de review finale produit dans `docs/reviews/`
- Sprint validé → mise à jour de `docs/TASKS.md` pour marquer les Sprints 30-37 FAIT
