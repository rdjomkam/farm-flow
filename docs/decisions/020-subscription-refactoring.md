# ADR-020 — Refactoring Abonnements : User-level, Exonération, Essais, Upgrade/Downgrade

**Date :** 2026-04-04
**Statut :** ACCEPTÉ
**Auteur :** @architect + @ronald (brainstorming + revue adversariale)

---

## Contexte

Le système d'abonnement actuel présente plusieurs problèmes :
1. L'abonnement est lié au **site** alors qu'il devrait être lié au **user** (le plan détermine combien de sites un user peut créer)
2. Pas de plan EXONERATION pour les sites exemptés
3. Pas de période d'essai (trial)
4. Pas de flux d'upgrade/downgrade avec prorata
5. La barre de quotas s'affiche sur la page vagues (inapproprié pour les employés)
6. Un site peut fonctionner sans abonnement (fallback DECOUVERTE silencieux)
7. Les messages d'erreur quota ne sont pas adaptés au rôle de l'utilisateur
8. Pas de concept de "propriétaire de site" dans le modèle de données
9. Pas d'audit trail sur les transitions d'abonnement

---

## Décisions

### D1 — Propriétaire de site (ownerId)

**Problème :** Le schema n'a aucun champ identifiant le propriétaire d'un site. `SiteMember` avec rôle Administrateur n'est pas suffisant (plusieurs admins possibles).

**Solution :** Ajouter `ownerId String` (FK → User) sur le modèle `Site`.

- Un site a exactement **un** owner (le créateur initial)
- Le owner ne peut pas être changé (sauf transfert explicite par super admin — feature future)
- Migration prod : `ownerId` = userId du premier SiteMember Administrateur de chaque site
- `getProprietaireAbonnement(siteId)` = `site.ownerId` → `getAbonnementActif(site.ownerId)`

### D2 — Abonnement au niveau User (pas Site)

**Avant :** `Abonnement.siteId` obligatoire, `getAbonnementActif(siteId)`
**Après :** `Abonnement.siteId` supprimé, `getAbonnementActif(userId)`

- Un user = un seul abonnement actif à la fois
- `limitesSites` du plan contrôle combien de sites le user peut créer
- `limitesBacs` / `limitesVagues` sont des limites **par site**
- Les employés d'un site bénéficient de l'abonnement du propriétaire
- Les ingénieurs ont leur propre abonnement (INGENIEUR_*)

**Résolution des quotas par site :**
| Action | Abonnement vérifié |
|--------|-------------------|
| Créer un bac sur le site X | Owner du site X → son abonnement |
| Créer une vague sur le site X | Owner du site X → son abonnement |
| Superviser un nouveau site (ingénieur) | Abonnement ingénieur (limitesIngFermes) |
| Créer un site (promoteur) | Abonnement du user (limitesSites) |

**Impact :**
- `getAbonnementActif(siteId)` → `getAbonnementActif(userId)`
- Quota bacs/vagues : charger via `site.ownerId` → abonnement du owner
- Quota sites : compter les sites du user vs `limitesSites` du plan
- `PaiementAbonnement.siteId` → supprimé (lié au user via abonnement)
- `CommissionIngenieur` : **aucun changement** — garde son propre `siteClientId` indépendant de l'abonnement

**Cache par site (éviter N+1) :**
```typescript
// Cache composé : siteId → owner → abonnement
export const getAbonnementActifPourSite = unstable_cache(
  async (siteId) => {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { ownerId: true } });
    if (!site) return null;
    return getAbonnementActif(site.ownerId);
  },
  [`site-subscription-${siteId}`],
  { revalidate: 3600, tags: [`subscription-site-${siteId}`] }
);

// Invalidation : user + tous ses sites
async function invalidateSubscriptionCaches(userId: string) {
  revalidateTag(`subscription-${userId}`);
  const sites = await prisma.site.findMany({ where: { ownerId: userId }, select: { id: true } });
  sites.forEach(s => revalidateTag(`subscription-site-${s.id}`));
}
```

### D3 — Plan EXONERATION (caché)

Ajouter `EXONERATION` à l'enum `TypePlan` :
- Prix : 0 FCFA toutes périodes
- Limites : 999/999/999 (illimité)
- `isPublic: false` → invisible sur `/tarifs`
- Seul un super admin DKFarm peut créer un abonnement EXONERATION depuis le backoffice
- Durée temporaire (date fin réelle) ou permanente (date fin 2099-12-31)
- À expiration temporaire : bascule en EN_GRACE comme tout abonnement

Ajout d'un champ `motifExoneration: String?` sur `Abonnement` :
- Obligatoire quand le plan est EXONERATION
- Documente pourquoi l'exonération a été accordée

### D4 — Période d'essai (Trial)

Nouveaux champs sur `Abonnement` :
- `isEssai: Boolean @default(false)` — indique un abonnement d'essai
- `dureeEssaiJours: Int?` — durée de l'essai en jours (configurable par plan)

Nouveau champ sur `PlanAbonnement` :
- `dureeEssaiJours: Int? @default(null)` — durée d'essai proposée (null = pas d'essai)

Tracking des essais déjà utilisés — nouvelle table :
```prisma
/**
 * EssaiUtilise — Tracking des essais consommés par user.
 * Exception R8 documentée : pas de siteId (lié au user, pas au site).
 */
model EssaiUtilise {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  typePlan  TypePlan
  dateEssai DateTime @default(now())

  @@unique([userId, typePlan])  // Un seul essai par plan par user
}
```

**Règles :**
- Tous les plans proposent l'essai (si `dureeEssaiJours` configuré sur le PlanAbonnement)
- Pendant l'essai : pleines fonctionnalités du plan
- Fin de l'essai sans paiement : EN_GRACE → SUSPENDU (cycle normal)
- Un user ne peut faire qu'un seul essai par type de plan
- L'essai crée un abonnement normal avec `isEssai: true` et `prixPaye: 0`

**Conversion essai → payant :**
- Pendant l'essai (ACTIF) ou en EN_GRACE : l'utilisateur souscrit au même plan en payant
- L'essai passe en ANNULE, le nouveau cycle payant démarre immédiatement (nouvelle dateDebut = maintenant)
- Les jours d'essai restants ne sont pas reportés
- Souscrire au même plan que l'essai en payant est un flow normal (pas un second essai)

### D5 — Upgrade / Downgrade de plan

#### Upgrade (plan supérieur)
1. User va sur `/mon-abonnement` → "Changer de plan"
2. Voit tous les plans (supérieurs ET inférieurs)
3. Choisit le nouveau plan + période
4. **Calcul prorata :**
   - Crédit restant = (jours restants / jours totaux période) × prix payé ancien plan
   - Prix nouveau plan (pour la période choisie)
   - Delta = prix nouveau - crédit restant
   - Si delta > 0 : paiement Mobile Money du delta (+ possibilité d'appliquer un code promo sur le delta)
   - Si delta ≤ 0 : pas de paiement, crédit reporté
5. Ancien abonnement → ANNULE
6. Nouveau abonnement → ACTIF (immédiat)
7. Nouvelles limites appliquées immédiatement

**Note prorata et remises :** Le crédit est calculé sur `prixPaye` (montant réellement payé, potentiellement remisé). C'est intentionnel : la remise était valable pour l'ancien plan. L'utilisateur peut appliquer un nouveau code promo sur le delta d'upgrade.

#### Downgrade (plan inférieur)
1. Même parcours UI pour choisir le plan
2. **Vérification des dépassements à 3 niveaux :** Le système compare les ressources actuelles avec les limites du nouveau plan dans cet ordre :
   - **Niveau 1 — Sites :** Si le user a plus de sites que le nouveau `limitesSites`
   - **Niveau 2 — Bacs par site :** Pour chaque site retenu, si le nombre de bacs dépasse `limitesBacs`
   - **Niveau 3 — Vagues par site :** Pour chaque site retenu, si le nombre de vagues EN_COURS dépasse `limitesVagues`

3. **Flow de sélection en 3 étapes (si dépassements) :**

   **Étape 1 — Sélection des sites** (si dépassement limitesSites) :
   - L'utilisateur voit tous ses sites avec un résumé (nombre de bacs, vagues, dernière activité)
   - Il sélectionne ceux qu'il veut garder (max = `limitesSites` du nouveau plan)
   - Les sites non sélectionnés seront **bloqués** (pas supprimés)

   **Étape 2 — Sélection des bacs** (pour chaque site retenu, si dépassement limitesBacs) :
   - L'utilisateur voit les bacs du site avec leur statut et occupation
   - Il sélectionne ceux à conserver (max = `limitesBacs` du nouveau plan)
   - Les bacs non sélectionnés seront **bloqués**

   **Étape 3 — Sélection des vagues** (pour chaque site retenu, si dépassement limitesVagues) :
   - L'utilisateur voit les vagues EN_COURS du site
   - Il sélectionne celles à conserver (max = `limitesVagues` du nouveau plan)
   - Les vagues non sélectionnées seront **bloquées**

4. **Comportement des ressources bloquées :**
   - **Visibles** dans les listes (avec badge "Bloqué" / icône cadenas)
   - **Non accessibles** : cliquer dessus affiche un message "Cette ressource est bloquée par votre plan actuel" avec un bouton "Mettre à niveau" → `/mon-abonnement/changer-plan`
   - **Pas supprimées** : données intactes, réactivées automatiquement si upgrade ultérieur
   - Les vagues bloquées ne comptent plus dans les quotas actifs
   - Les bacs bloqués ne peuvent recevoir aucune opération

5. **Effet différé :** le downgrade prend effet à la fin de la période en cours

6. Champs sur `Abonnement` :
   - `downgradeVersId: String?` (FK → PlanAbonnement) — plan cible à la fin de période
   - `downgradePeriode: PeriodeFacturation?` — période choisie pour le nouveau plan
   - `downgradeRessourcesAGarder: Json?` — IDs des ressources à conserver :
     ```json
     {
       "sites": ["site-id-1"],
       "bacs": { "site-id-1": ["bac-id-1", "bac-id-2"] },
       "vagues": { "site-id-1": ["vague-id-1"] }
     }
     ```

7. À la fin de la période, le CRON :
   - Bloque les sites non retenus (nouveau champ `isBlocked: Boolean @default(false)` sur Site)
   - Bloque les bacs non retenus (nouveau champ `isBlocked: Boolean @default(false)` sur Bac)
   - Bloque les vagues non retenues (nouveau statut ou champ `isBlocked` sur Vague)
   - Crée le nouvel abonnement avec le nouveau plan
   - Annule l'ancien abonnement
   - Log audit avec metadata des ressources bloquées

8. Si l'utilisateur annule le downgrade avant la fin de période : reset des 3 champs downgrade

9. **Réactivation automatique après upgrade :** Si un user upgrade vers un plan avec des limites suffisantes, les ressources bloquées sont automatiquement débloquées (dans la limite du nouveau quota, les plus récentes en priorité)

#### Changement de période seul (même plan)
- Prend effet au prochain renouvellement
- Champ `prochainePeriode: PeriodeFacturation?` sur `Abonnement`
- Le CRON de renouvellement lit ce champ : si set → nouvelle période + nouveau prix, sinon → même période

#### Garde-fou : pas de changement concurrent
- Si un `Abonnement` en `EN_ATTENTE_PAIEMENT` existe déjà pour ce user → rejeter toute nouvelle demande (HTTP 409)
- Timeout : si paiement non confirmé en 30 min → CRON passe le pending en EXPIRE (nettoyage)

### D6 — Obligation d'abonnement pour créer un site

**Flow :**
```
User connecté sans site → "Créer un site"
  → A un abonnement actif ?
    → OUI + quota sites non atteint : formulaire création site
    → OUI + quota sites atteint : message "Mettez à niveau votre plan"
    → NON : redirection vers /tarifs (sélection plan → paiement/essai → retour création site)
```

- POST /api/sites vérifie que le user a un abonnement actif
- Vérifie le quota `limitesSites` vs nombre de sites existants du user
- Suppression du fallback DECOUVERTE silencieux dans `resolvePlanLimites()` (mais **après** que tous les sites existants aient un abonnement — voir plan de migration)

### D7 — Déplacement QuotasUsageBar

- **Retirer** de `src/components/pages/vagues-page.tsx`
- **Ajouter** sur `src/app/(farm)/mon-abonnement/page.tsx`
- Les employés ne voient plus les quotas sur les pages de travail

### D8 — Messages d'erreur adaptés au rôle

Quand un quota est atteint (402) :
- **Propriétaire (user === site.ownerId) :** "Vous avez atteint la limite de X. Mettez à niveau votre plan."
- **Employé/Ingénieur :** "La limite de X a été atteinte. Contactez le propriétaire du site."

Helper : `isOwner(userId, siteId)` → `site.ownerId === userId`

### D9 — Audit trail des transitions d'abonnement

Nouveau modèle :
```prisma
/**
 * AbonnementAudit — Journal de toutes les transitions d'abonnement.
 * Exception R8 documentée : pas de siteId (lié au user via abonnement).
 * Critique pour traçabilité billing (Mobile Money).
 */
model AbonnementAudit {
  id             String   @id @default(cuid())
  abonnementId   String
  abonnement     Abonnement @relation(fields: [abonnementId], references: [id])
  action         String   // CREATION, ACTIVATION, UPGRADE, DOWNGRADE, DOWNGRADE_ANNULE,
                          // ANNULATION, EXONERATION, ESSAI_DEBUT, ESSAI_CONVERSION,
                          // RENOUVELLEMENT, SUSPENSION, EXPIRATION, CHANGEMENT_PERIODE
  ancienStatut   String?
  nouveauStatut  String
  ancienPlanId   String?
  nouveauPlanId  String?
  montant        Decimal?
  metadata       Json?    // détails libres (motif exonération, delta prorata, ressources archivées, etc.)
  userId         String   // qui a effectué l'action
  createdAt      DateTime @default(now())

  @@index([abonnementId])
  @@index([userId])
  @@index([createdAt])
}
```

Chaque mutation d'abonnement (création, activation, upgrade, downgrade, annulation, exonération, suspension, expiration) appelle :
```typescript
async function logAbonnementAudit(params: {
  abonnementId: string;
  action: string;
  ancienStatut?: string;
  nouveauStatut: string;
  ancienPlanId?: string;
  nouveauPlanId?: string;
  montant?: number;
  metadata?: Record<string, unknown>;
  userId: string;
}) { ... }
```

---

## Plan d'implémentation

### Phase 1 — Migration additive (schema + data, zéro downtime)

> **Principe :** Ajouter sans rien supprimer. Les anciennes queries continuent de fonctionner.

#### 1.1 Schema Prisma — Ajouts
- `prisma/schema.prisma`
  - Ajouter `EXONERATION` à l'enum `TypePlan`
  - Ajouter `ownerId String?` sur `Site` (nullable d'abord, FK → User)
  - Ajouter `isBlocked Boolean @default(false)` sur `Site`, `Bac`, `Vague`
  - Ajouter sur `PlanAbonnement` : `dureeEssaiJours Int?`
  - Ajouter sur `Abonnement` :
    - `motifExoneration String?`
    - `isEssai Boolean @default(false)`
    - `dureeEssaiJours Int?`
    - `downgradeVersId String?` (FK → PlanAbonnement)
    - `downgradePeriode PeriodeFacturation?`
    - `downgradeRessourcesAGarder Json?`
    - `prochainePeriode PeriodeFacturation?`
  - Créer modèle `EssaiUtilise`
  - Créer modèle `AbonnementAudit`
  - Migration SQL additive

#### 1.2 Data migration (script SQL)
- Peupler `Site.ownerId` = userId du premier SiteMember Administrateur par site
- Rendre `Site.ownerId` NOT NULL (seconde migration)
- Créer un `PlanAbonnement` EXONERATION (`isPublic: false`, limites 999/999/999, prix 0)
- Créer un abonnement EXONERATION pour le site prod de Ronald (motif : "Site fondateur DKFarm")
- Créer un abonnement DECOUVERTE pour tout site existant sans abonnement

#### 1.3 Types TypeScript
- `src/types/models.ts` — Ajouter `ownerId` sur Site, nouveaux champs sur Abonnement, EssaiUtilise, AbonnementAudit
- `src/types/api.ts` — Mettre à jour DTOs
- `src/types/index.ts` — Exporter les nouveaux types

#### 1.4 Constants
- `src/lib/abonnements-constants.ts`
  - Ajouter `EXONERATION` dans `PLAN_TARIFS` (0/0/0)
  - Ajouter `EXONERATION` dans `PLAN_LIMITES` (999/999/999)
  - Ajouter `EXONERATION` dans `PLAN_LABELS`

### Phase 2 — Queries et check functions (user-level)

> **Principe :** Adapter la couche data pour fonctionner par userId tout en gardant le fallback DECOUVERTE comme filet de sécurité temporaire.

#### 2.1 Queries
- `src/lib/queries/abonnements.ts`
  - `getAbonnementActif(userId)` — cherche par userId au lieu de siteId
  - `getAbonnementActifPourSite(siteId)` — site.ownerId → getAbonnementActif(ownerId), avec cache `subscription-site-${siteId}`
  - Adapter `getAbonnements()`, `getAbonnementsExpirantAvant()`, `getAbonnementsEnGraceExpires()` pour ne plus utiliser les relations site
  - Ajouter `logAbonnementAudit()` helper

#### 2.2 Check functions
- `src/lib/abonnements/check-quotas.ts`
  - `getQuotasUsage(siteId)` : utilise `getAbonnementActifPourSite(siteId)` (via owner)
  - `getQuotaSites(userId)` : compte les sites du user vs limitesSites
  - Garder le fallback DECOUVERTE temporairement (sera retiré en Phase 6)
- `src/lib/abonnements/check-subscription.ts`
  - `getSubscriptionStatus(userId)` au lieu de siteId
  - `getSubscriptionStatusForSite(siteId)` wrapper via owner
- `src/lib/abonnements/invalidate-caches.ts` (nouveau)
  - `invalidateSubscriptionCaches(userId)` → invalide user + tous ses sites

### Phase 3 — API routes adaptation

#### 3.1 Quota checks adaptés
- `src/app/api/bacs/route.ts` — Quota via `getAbonnementActifPourSite(siteId)` + message adapté au rôle (D8)
- `src/app/api/vagues/route.ts` — Idem
- `src/app/api/sites/route.ts` — Vérification abonnement actif du user + quota sites
- Tous les endpoints de mutation appellent `invalidateSubscriptionCaches(userId)` + `logAbonnementAudit()`

#### 3.2 Abonnement API
- `src/app/api/abonnements/route.ts` — Adapter POST : plus de siteId, lié au userId de la session
- `src/app/api/abonnements/[id]/renouveler/route.ts` — Adapter pour user-level
- `src/app/api/webhooks/manuel/route.ts` — Adapter invalidation cache
- `src/lib/services/billing.ts` — Adapter vérification ownership
- `src/lib/services/rappels-abonnement.ts` — Adapter pour user-level

### Phase 4 — UI cleanup + messages adaptés + flow création site

#### 4.1 Déplacer QuotasUsageBar
- `src/components/pages/vagues-page.tsx` — Retirer le composant
- `src/app/(farm)/mon-abonnement/page.tsx` — Ajouter le composant

#### 4.2 Messages d'erreur par rôle
- Helper `isOwner(userId, siteId)` : `site.ownerId === userId`
- `src/app/api/bacs/route.ts` — Message adapté
- `src/app/api/vagues/route.ts` — Idem
- `src/app/api/sites/route.ts` — Idem

#### 4.3 Flow création de site
- Vérifier abonnement du user avant d'afficher le formulaire de création
- Si pas d'abonnement : redirection vers `/tarifs`
- Si quota sites atteint : message "Mettez à niveau votre plan"

### Phase 5 — Essais (Trial)

#### 5.1 API
- `src/app/api/abonnements/route.ts` — Paramètre `isEssai: true`
  - Vérifie `EssaiUtilise` pour ce user + typePlan
  - Crée abonnement `isEssai: true`, durée = `plan.dureeEssaiJours`, `prixPaye: 0`
  - Enregistre dans `EssaiUtilise`
  - Log audit : `ESSAI_DEBUT`
- `src/app/api/abonnements/[id]/essai-to-paid/route.ts` — Convertir essai en payant
  - Annule l'essai, crée un abonnement payant avec nouveau cycle
  - Log audit : `ESSAI_CONVERSION`

#### 5.2 UI
- `src/components/abonnements/checkout-form.tsx` — Bouton "Essayer X jours gratuitement" si essai disponible
- `src/app/tarifs/page.tsx` — Afficher durée d'essai sur chaque plan
- `src/components/abonnements/abonnement-actuel-card.tsx` — Afficher "Période d'essai — X jours restants"

#### 5.3 CRON
- Adapter rappels pour gérer fin d'essai → EN_GRACE

### Phase 6 — Upgrade / Downgrade

#### 6.1 Logique métier
- `src/lib/abonnements/prorata.ts` (nouveau fichier)
  - `calculerCreditRestant(abonnement)` : (joursRestants / joursTotaux) × prixPaye
  - `calculerDeltaUpgrade(abonnementActuel, nouveauPlan, nouvellePeriode)` : prix nouveau - crédit
  - `calculerDateFinNouveau(nouvellePeriode)` : date de fin du nouveau plan
  - `detecterDepassements(userId, nouveauPlan)` : compare ressources actuelles vs nouvelles limites → retourne les ressources en excès par site

#### 6.2 API
- `src/app/api/abonnements/[id]/upgrade/route.ts` (nouveau)
  - POST : `{ nouveauPlanId, periode, codePromo? }`
  - Garde-fou : vérifier pas de EN_ATTENTE_PAIEMENT existant (HTTP 409)
  - Calcul prorata → retourne delta
  - Si delta > 0 : initie paiement, à confirmation → ancien ANNULE, nouveau ACTIF
  - Si delta ≤ 0 : exécution immédiate
  - Log audit : `UPGRADE`
- `src/app/api/abonnements/[id]/downgrade/route.ts` (nouveau)
  - POST : `{ nouveauPlanId, periode, ressourcesAGarder: { bacs: string[], vagues: string[] } }`
  - Validation : les ressources sélectionnées respectent les limites du nouveau plan
  - Enregistre `downgradeVersId` + `downgradePeriode` + `downgradeRessourcesAGarder`
  - Log audit : `DOWNGRADE`
  - DELETE : annule le downgrade programmé, log audit `DOWNGRADE_ANNULE`
- `src/app/api/abonnements/[id]/changer-periode/route.ts` (nouveau)
  - POST : `{ nouvellePeriode }`
  - Enregistre `prochainePeriode`
  - Log audit : `CHANGEMENT_PERIODE`

#### 6.3 UI
- `src/app/(farm)/mon-abonnement/changer-plan/page.tsx` (nouvelle page)
  - Affiche tous les plans avec comparaison
  - Indique upgrade (immédiat) vs downgrade (fin de période)
  - Calcul prorata en temps réel
- `src/components/abonnements/upgrade-checkout-form.tsx` (nouveau)
  - Affichage crédit/delta + code promo sur le delta
  - Paiement uniquement du delta
- `src/components/abonnements/downgrade-resource-selector.tsx` (nouveau)
  - Flow en 3 étapes : sites → bacs par site → vagues par site
  - Chaque étape : liste avec checkbox, compteur "X/Y sélectionnés", résumé par ressource
  - Ressources non sélectionnées marquées en rouge avec icône cadenas
  - Avertissement clair : "Les ressources non sélectionnées seront bloquées. Elles resteront visibles mais inaccessibles jusqu'à un upgrade."
  - Étapes conditionnelles : saute l'étape si pas de dépassement à ce niveau
- `src/components/abonnements/abonnement-actuel-card.tsx`
  - Bouton "Changer de plan" → `/mon-abonnement/changer-plan`
  - Afficher le downgrade programmé si `downgradeVersId` présent (avec option annuler)

#### 6.4 CRON
- Adapter le CRON de renouvellement :
  1. Lire `downgradeVersId` → si set : nouveau plan, archiver les ressources non retenues
  2. Lire `prochainePeriode` → si set : nouvelle période
  3. Calculer prix et dates selon plan+période résolu
  4. Créer nouvel abonnement, annuler l'ancien
  5. Log audit : `RENOUVELLEMENT`
- Nettoyage : passer les EN_ATTENTE_PAIEMENT > 30 min en EXPIRE

### Phase 7 — Backoffice Exonération

#### 7.1 API Admin
- `src/app/api/admin/exonerations/route.ts` (nouveau)
  - GET : liste des exonérations actives
  - POST : `{ userId, motif, dateFin? }` — crée abonnement EXONERATION
  - Vérifie super admin
  - Log audit : `EXONERATION`
- `src/app/api/admin/exonerations/[id]/route.ts` (nouveau)
  - DELETE : annule l'exonération (ANNULE)
  - Log audit : `ANNULATION`

#### 7.2 UI Admin
- Page backoffice : liste/création/annulation des exonérations
- Formulaire : sélection user, motif (obligatoire), durée (temporaire ou permanente)

### Phase 8 — Cleanup migration + retrait fallback

> **Principe :** Maintenant que tout fonctionne, retirer les béquilles.

- Rendre `Abonnement.siteId` nullable en schema (si pas déjà fait)
- Retirer le fallback DECOUVERTE dans `resolvePlanLimites()` → erreur si pas d'abonnement
- Supprimer `siteId` de `Abonnement` et `PaiementAbonnement` (migration finale)
- Supprimer les index obsolètes
- Nettoyer les anciennes queries qui référençaient siteId

### Phase 9 — Tests + review

- Tests unitaires : prorata, quota résolution via owner, détection dépassements, audit logging
- Tests intégration : upgrade flow complet, downgrade avec sélection ressources, essai → payant, exonération
- Tests non-régression : toutes les fonctionnalités existantes (bacs, vagues, etc.)
- `npx vitest run` + `npm run build`
- Review checklist R1-R9

---

## Ordre d'exécution

| # | Phase | Dépendances | Agents |
|---|-------|-------------|--------|
| 1 | Migration additive (schema + data) | Aucune | @db-specialist |
| 2 | Queries + check functions (user-level) | Phase 1 | @db-specialist + @developer |
| 3 | API routes adaptation | Phase 2 | @developer |
| 4 | UI cleanup + messages + flow création site | Phase 3 | @developer |
| 5 | Essais (trial) | Phase 3 | @developer |
| 6 | Upgrade/Downgrade (prorata + sélection ressources) | Phase 3 | @developer |
| 7 | Backoffice exonération | Phase 3 | @developer |
| 8 | Cleanup migration (retrait fallback + siteId) | Phases 4-7 | @db-specialist |
| 9 | Tests + review | Toutes | @tester + @code-reviewer |

**Parallélisable :** Phases 4, 5, 6, 7 peuvent être développées en parallèle après Phase 3.

---

## Risques et mitigations

| # | Risque | Mitigation |
|---|--------|-----------|
| 1 | **Migration prod** — abonnements liés à des sites | Migration en 3 étapes (additive → data → cleanup) avec rollback possible entre chaque |
| 2 | **Cache invalidation** — user-level impacte tous les sites | Double tagging `subscription-${userId}` + `subscription-site-${siteId}`, fonction `invalidateSubscriptionCaches()` centralisée |
| 3 | **Multi-site** — résolution propriétaire pour quotas | Champ `ownerId` direct sur Site (pas de join SiteMember), cache composé |
| 4 | **CRON** — jobs existants cherchent par site | Adapter progressivement, l'ancienne logique fonctionne tant que siteId est encore présent |
| 5 | **État intermédiaire** — users sans abonnement entre phases | Fallback DECOUVERTE maintenu jusqu'à Phase 8, abonnements DECOUVERTE créés pour les sites existants en Phase 1 |
| 6 | **Changement concurrent** — deux upgrades simultanés | Vérification EN_ATTENTE_PAIEMENT existant (HTTP 409), timeout 30 min |
| 7 | **Downgrade avec dépassement** — perte de données | Sélection explicite par l'utilisateur, archivage (pas suppression), ressources archivées visibles en lecture |
| 8 | **Audit trail** — disputes billing | AbonnementAudit avec metadata JSON pour chaque transition |

---

## Nouveaux modèles Prisma (résumé)

| Modèle | Exception R8 | Raison |
|--------|-------------|--------|
| `EssaiUtilise` | Oui (pas de siteId) | Lié au user, pas au site — un user ne peut faire qu'un essai par plan quel que soit le site |
| `AbonnementAudit` | Oui (pas de siteId) | Lié au user via abonnement, qui n'a plus de siteId |

## Champs ajoutés sur modèles existants

| Modèle | Champ | Type | Raison |
|--------|-------|------|--------|
| `Site` | `ownerId` | `String` (FK User, NOT NULL) | Identifier le propriétaire pour résolution abonnement |
| `Site` | `isBlocked` | `Boolean @default(false)` | Site bloqué suite à downgrade (visible mais inaccessible) |
| `Bac` | `isBlocked` | `Boolean @default(false)` | Bac bloqué suite à downgrade (visible mais inaccessible) |
| `Vague` | `isBlocked` | `Boolean @default(false)` | Vague bloquée suite à downgrade (visible mais inaccessible) |
| `PlanAbonnement` | `dureeEssaiJours` | `Int?` | Configurer la durée d'essai par plan |
| `Abonnement` | `motifExoneration` | `String?` | Justification exonération |
| `Abonnement` | `isEssai` | `Boolean @default(false)` | Distinguer essai vs payant |
| `Abonnement` | `dureeEssaiJours` | `Int?` | Durée de l'essai pour cet abonnement |
| `Abonnement` | `downgradeVersId` | `String?` (FK PlanAbonnement) | Plan cible du downgrade programmé |
| `Abonnement` | `downgradePeriode` | `PeriodeFacturation?` | Période du downgrade programmé |
| `Abonnement` | `downgradeRessourcesAGarder` | `Json?` | IDs des ressources à conserver `{ sites: [], bacs: {siteId: []}, vagues: {siteId: []} }` |
| `Abonnement` | `prochainePeriode` | `PeriodeFacturation?` | Changement de période au renouvellement |

## Comportement des ressources bloquées

| Ressource | Visible | Accessible | Clic dessus | Comptée dans quotas |
|-----------|---------|-----------|-------------|---------------------|
| Site bloqué | Oui (badge "Bloqué" + cadenas) | Non (pas de navigation vers le site) | Message + bouton "Mettre à niveau" | Non |
| Bac bloqué | Oui (dans la liste, grisé + cadenas) | Non (pas d'opérations) | Message + bouton "Mettre à niveau" | Non |
| Vague bloquée | Oui (dans la liste, grisée + cadenas) | Non (pas de relevés, pas de modification) | Message + bouton "Mettre à niveau" | Non |

**Réactivation :** Après un upgrade, les ressources bloquées sont automatiquement débloquées si le nouveau quota le permet (plus récentes en priorité). Si le nouveau quota ne suffit pas à tout débloquer, l'utilisateur peut manuellement débloquer/bloquer via la page de gestion.
