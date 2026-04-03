# ADR-020 — Refactoring Abonnements : User-level, Exonération, Essais, Upgrade/Downgrade

**Date :** 2026-04-04
**Statut :** ACCEPTÉ
**Auteur :** @architect + @ronald (brainstorming + revue adversariale + edge case hunter)

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

**Solution :** Ajouter `ownerId String` (FK → User, **onDelete: Restrict**) sur le modèle `Site`.

- Un site a exactement **un** owner (le créateur initial)
- Le owner ne peut pas être changé (sauf transfert explicite par super admin — feature future)
- **onDelete: Restrict** — impossible de supprimer un user qui est owner de sites actifs
- Migration prod : `ownerId` = userId du premier SiteMember Administrateur de chaque site
- **Edge case migration :** Si un site n'a aucun SiteMember Administrateur → assigner au premier SiteMember existant, ou flag pour review manuelle
- `getProprietaireAbonnement(siteId)` = `site.ownerId` → `getAbonnementActif(site.ownerId)`

### D2 — Abonnement au niveau User (pas Site)

**Avant :** `Abonnement.siteId` obligatoire, `getAbonnementActif(siteId)`
**Après :** `Abonnement.siteId` supprimé, `getAbonnementActif(userId)`

- Un user = un seul abonnement actif à la fois
- `limitesSites` du plan contrôle combien de sites le user peut créer
- `limitesBacs` / `limitesVagues` sont des limites **par site** (chaque site du user a son propre quota indépendant)
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
- Quota sites : compter les sites **non-bloqués** du user vs `limitesSites` du plan
- `PaiementAbonnement.siteId` → supprimé (lié au user via abonnement)
- `CommissionIngenieur` : **aucun changement** — garde son propre `siteClientId` indépendant de l'abonnement

**Garde-fou multi-abonnement :** `getAbonnementActif` retourne le premier ACTIF (prioritaire) ou EN_GRACE, trié par statut ASC puis createdAt DESC. Une application-level guard empêche la création d'un second abonnement ACTIF pour le même user.

**Cache par site (éviter N+1) :**
```typescript
// Cache composé : siteId → owner → abonnement
export const getAbonnementActifPourSite = unstable_cache(
  async (siteId) => {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { ownerId: true } });
    if (!site) return null; // site inexistant → pas d'abonnement
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
- À expiration temporaire : bascule en EN_GRACE comme tout abonnement (CRON vérifie `dateFin` avant `dateFinGrace`, définit `dateFinGrace` = dateFin + 7 jours si non défini)

Ajout d'un champ `motifExoneration: String?` sur `Abonnement` :
- Obligatoire quand le plan est EXONERATION (validation API)
- Ignoré silencieusement sur les autres plans (pas de rejet)
- Documente pourquoi l'exonération a été accordée

### D4 — Période d'essai (Trial)

Nouveaux champs sur `Abonnement` :
- `isEssai: Boolean @default(false)` — indique un abonnement d'essai
- `dureeEssaiJours: Int?` — durée de l'essai en jours (configurable par plan)

Nouveau champ sur `PlanAbonnement` :
- `dureeEssaiJours: Int? @default(null)` — durée d'essai proposée (null = pas d'essai)
- **Validation :** `dureeEssaiJours` doit être `> 0` ou `null`. La valeur `0` est rejetée.

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
- Un user ne peut faire qu'un seul essai par type de plan (même s'il a quitté l'essai en cours de route)
- L'essai crée un abonnement normal avec `isEssai: true` et `prixPaye: 0`

**Conversion essai → payant :**
- Pendant l'essai (ACTIF) ou en EN_GRACE : l'utilisateur souscrit au même plan en payant
- **Crucial :** Ne PAS annuler l'essai tant que le paiement n'est pas CONFIRME. L'essai reste ACTIF pendant le processus de paiement. Seule la confirmation du paiement déclenche : essai → ANNULE + nouveau → ACTIF.
- Les jours d'essai restants ne sont pas reportés
- Souscrire au même plan que l'essai en payant est un flow normal (pas un second essai)
- Upgrade depuis un essai : même logique que upgrade normal, mais `prixPaye = 0` donc `creditRestant = 0`, user paie le prix complet du nouveau plan

### D5 — Upgrade / Downgrade de plan

#### Upgrade (plan supérieur ou changement avec delta positif)
1. User va sur `/mon-abonnement` → "Changer de plan"
2. Voit tous les plans (supérieurs ET inférieurs)
3. Choisit le nouveau plan + période
4. **Calcul prorata :**
   - Crédit restant = (jours restants / jours totaux période) × prix payé ancien plan
   - **Guard division par zéro :** Si `joursTotaux === 0` (upgrade le jour même) → `creditRestant = prixPaye` (crédit total)
   - **Guard prixPaye = 0 :** (essai ou DECOUVERTE) → `creditRestant = 0` (fast-path, pas de calcul flottant)
   - Déduire le `soldeCredit` du user (si existant) du montant à payer
   - Prix nouveau plan (pour la période choisie)
   - Delta = prix nouveau - crédit restant - soldeCredit
   - Si delta > 0 : paiement Mobile Money du delta (+ possibilité d'appliquer un code promo sur le delta)
   - Si delta ≤ 0 : exécution immédiate sans paiement, surplus stocké dans `User.soldeCredit`
5. Ancien abonnement → ANNULE (uniquement après confirmation paiement si delta > 0)
6. Nouveau abonnement → ACTIF (immédiat)
7. Nouvelles limites appliquées immédiatement

**Note prorata et remises :** Le crédit est calculé sur `prixPaye` (montant réellement payé, potentiellement remisé). C'est intentionnel : la remise était valable pour l'ancien plan. L'utilisateur peut appliquer un nouveau code promo sur le delta d'upgrade.

**Solde créditeur :** Quand delta ≤ 0, le surplus (|delta|) est stocké dans `User.soldeCredit`. Ce solde est automatiquement déduit lors du prochain renouvellement ou du prochain changement de plan.

#### Downgrade (plan inférieur)
1. Même parcours UI pour choisir le plan
2. **Les limites de l'ancien plan restent en vigueur** jusqu'à la fin de la période — l'utilisateur peut continuer à utiliser toutes ses ressources normalement
3. **Vérification des dépassements à 3 niveaux :** Le système compare les ressources actuelles (non-bloquées uniquement, `isBlocked = false`) avec les limites du nouveau plan dans cet ordre :
   - **Niveau 1 — Sites :** Si le user a plus de sites non-bloqués que le nouveau `limitesSites`
   - **Niveau 2 — Bacs par site :** Pour chaque site retenu, si le nombre de bacs non-bloqués dépasse `limitesBacs`
   - **Niveau 3 — Vagues par site :** Pour chaque site retenu, si le nombre de vagues EN_COURS non-bloquées dépasse `limitesVagues`

4. **Flow de sélection en 3 étapes (si dépassements) :**

   **Étape 1 — Sélection des sites** (si dépassement limitesSites) :
   - L'utilisateur voit tous ses sites non-bloqués avec un résumé (nombre de bacs, vagues, dernière activité)
   - Il sélectionne ceux qu'il veut garder (max = `limitesSites` du nouveau plan)
   - Les sites non sélectionnés seront **bloqués** (pas supprimés)

   **Étape 2 — Sélection des bacs** (pour chaque site retenu, si dépassement limitesBacs) :
   - L'utilisateur voit les bacs non-bloqués du site avec leur statut et occupation
   - Il sélectionne ceux à conserver (max = `limitesBacs` du nouveau plan)
   - Les bacs non sélectionnés seront **bloqués**

   **Étape 3 — Sélection des vagues** (pour chaque site retenu, si dépassement limitesVagues) :
   - L'utilisateur voit les vagues EN_COURS non-bloquées du site
   - Il sélectionne celles à conserver (max = `limitesVagues` du nouveau plan)
   - Les vagues non sélectionnées seront **bloquées**

5. **Comportement des ressources bloquées :**
   - **Visibles** dans les listes (avec badge "Bloqué" / icône cadenas)
   - **Non accessibles** : cliquer dessus affiche un message "Cette ressource est bloquée par votre plan actuel" avec un bouton "Mettre à niveau" → `/mon-abonnement/changer-plan`
   - **Pas supprimées** : données intactes, réactivables après upgrade
   - Les vagues bloquées ne comptent plus dans les quotas actifs
   - Les bacs bloqués ne peuvent recevoir aucune opération

6. **Effet différé :** le downgrade prend effet à la fin de la période en cours

7. Champs sur `Abonnement` :
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

8. À la fin de la période, le CRON :
   - **Re-valide les sélections** : filtre les IDs supprimés entre-temps (ignorés silencieusement), vérifie que les ressources sélectionnées existent toujours
   - **Vérifie les ressources créées après la sélection** : si de nouvelles ressources ont été créées, les bloquer en priorité (plus récentes d'abord) pour respecter les quotas
   - Bloque les sites non retenus (`isBlocked = true`)
   - Bloque les bacs non retenus (`isBlocked = true`)
   - Bloque les vagues non retenues (`isBlocked = true`)
   - Crée le nouvel abonnement avec le nouveau plan
   - Annule l'ancien abonnement
   - Log audit avec metadata des ressources bloquées

9. Si l'utilisateur annule le downgrade avant la fin de période : reset des 3 champs downgrade

10. **Réactivation après upgrade :** Quand un user upgrade, les ressources bloquées ne sont PAS automatiquement débloquées. L'utilisateur choisit manuellement quelles ressources débloquer via une page de gestion dédiée (`/mon-abonnement/gerer-ressources`), dans la limite du nouveau quota.

#### Changement de période seul (même plan)
- Prend effet au prochain renouvellement
- Champ `prochainePeriode: PeriodeFacturation?` sur `Abonnement`
- **Validation :** Vérifier que `PLAN_TARIFS[plan.typePlan][nouvellePeriode] !== null` avant d'enregistrer
- Le CRON de renouvellement lit ce champ : si set → nouvelle période + nouveau prix, sinon → même période

#### Garde-fou : pas de changement concurrent
- Si un `Abonnement` en `EN_ATTENTE_PAIEMENT` existe déjà pour ce user → rejeter toute nouvelle demande (HTTP 409)
- **Annulation manuelle :** L'utilisateur peut annuler un upgrade pending (passe en ANNULE) pour en initier un nouveau, sans attendre le CRON
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
- Vérifie le quota `limitesSites` vs nombre de sites **non-bloqués** du user
- Suppression du fallback DECOUVERTE silencieux dans `resolvePlanLimites()` (mais **après** que tous les sites existants aient un abonnement — voir plan de migration)
- **Edge case retour post-paiement :** Après paiement réussi, stocker `returnUrl = /sites/nouveau` dans la session ou metadata de l'abonnement. Au prochain chargement, détecter "a un abonnement mais pas de site" et proposer la création.

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
 * onDelete sur Abonnement : Restrict (jamais hard-delete un abonnement).
 */
model AbonnementAudit {
  id             String   @id @default(cuid())
  abonnementId   String
  abonnement     Abonnement @relation(fields: [abonnementId], references: [id], onDelete: Restrict)
  action         String   // CREATION, ACTIVATION, UPGRADE, DOWNGRADE, DOWNGRADE_ANNULE,
                          // ANNULATION, EXONERATION, ESSAI_DEBUT, ESSAI_CONVERSION,
                          // RENOUVELLEMENT, SUSPENSION, EXPIRATION, CHANGEMENT_PERIODE
  ancienStatut   String?
  nouveauStatut  String
  ancienPlanId   String?
  nouveauPlanId  String?
  montant        Decimal?
  metadata       Json?    // détails libres (motif exonération, delta prorata, ressources bloquées, soldeCredit, etc.)
  userId         String   // qui a effectué l'action
  createdAt      DateTime @default(now())

  @@index([abonnementId])
  @@index([userId])
  @@index([createdAt])
}
```

**Règle :** Les abonnements ne sont JAMAIS hard-deleted. Soft-delete uniquement (statut ANNULE/EXPIRE). L'audit trail doit survivre.

Chaque mutation d'abonnement appelle :
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

### D10 — Solde créditeur utilisateur

Nouveau champ sur `User` :
- `soldeCredit: Decimal @default(0)` — solde créditeur en FCFA

**Alimenté par :**
- Upgrade avec delta négatif : surplus = |delta| ajouté au soldeCredit
- (Future) Remboursements partiels

**Consommé par :**
- Upgrade : déduit du montant à payer avant paiement Mobile Money
- Renouvellement automatique (CRON) : déduit du prix avant initiation paiement
- Si `soldeCredit >= prix` → renouvellement gratuit, pas de paiement Mobile Money

**Visibilité :**
- Affiché sur `/mon-abonnement` si > 0
- Affiché dans le checkout d'upgrade comme déduction

---

## Plan d'implémentation

### Phase 1 — Migration additive (schema + data, zéro downtime)

> **Principe :** Ajouter sans rien supprimer. Les anciennes queries continuent de fonctionner.

#### 1.1 Schema Prisma — Ajouts
- `prisma/schema.prisma`
  - Ajouter `EXONERATION` à l'enum `TypePlan`
  - Ajouter `ownerId String?` sur `Site` (nullable d'abord, FK → User, **onDelete: Restrict**)
  - Ajouter `isBlocked Boolean @default(false)` sur `Site`, `Bac`, `Vague`
  - Ajouter `soldeCredit Decimal @default(0)` sur `User`
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
  - Créer modèle `AbonnementAudit` (avec **onDelete: Restrict** sur FK abonnement)
  - Migration SQL additive

#### 1.2 Data migration (script SQL)
- Peupler `Site.ownerId` = userId du premier SiteMember Administrateur par site
- **Fallback :** si pas d'Administrateur → premier SiteMember existant ; si aucun member → flag `_ORPHAN_` pour review manuelle
- Rendre `Site.ownerId` NOT NULL (seconde migration, après vérification qu'aucun site n'est orphelin)
- Créer un `PlanAbonnement` EXONERATION (`isPublic: false`, limites 999/999/999, prix 0)
- Créer un abonnement EXONERATION pour le site prod de Ronald (motif : "Site fondateur DKFarm")
- Créer un abonnement DECOUVERTE pour tout site existant sans abonnement

#### 1.3 Types TypeScript
- `src/types/models.ts` — Ajouter `ownerId` + `isBlocked` sur Site/Bac/Vague, `soldeCredit` sur User, nouveaux champs sur Abonnement, EssaiUtilise, AbonnementAudit
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
  - `getAbonnementActif(userId)` — cherche par userId, ORDER BY statut ASC (ACTIF prioritaire), createdAt DESC, LIMIT 1
  - `getAbonnementActifPourSite(siteId)` — site.ownerId → getAbonnementActif(ownerId), avec cache `subscription-site-${siteId}`
  - Adapter `getAbonnements()`, `getAbonnementsExpirantAvant()`, `getAbonnementsEnGraceExpires()` pour ne plus utiliser les relations site
  - Ajouter `logAbonnementAudit()` helper

#### 2.2 Check functions
- `src/lib/abonnements/check-quotas.ts`
  - `getQuotasUsage(siteId)` : utilise `getAbonnementActifPourSite(siteId)` (via owner)
  - `getQuotaSites(userId)` : compte les sites **non-bloqués** du user vs limitesSites
  - Garder le fallback DECOUVERTE temporairement (sera retiré en Phase 8)
  - Les comptages de bacs/vagues excluent les `isBlocked = true`
- `src/lib/abonnements/check-subscription.ts`
  - `getSubscriptionStatus(userId)` au lieu de siteId
  - `getSubscriptionStatusForSite(siteId)` wrapper via owner
- `src/lib/abonnements/invalidate-caches.ts` (nouveau)
  - `invalidateSubscriptionCaches(userId)` → invalide user + tous ses sites

### Phase 3 — API routes adaptation

#### 3.1 Quota checks adaptés
- `src/app/api/bacs/route.ts` — Quota via `getAbonnementActifPourSite(siteId)` + message adapté au rôle (D8) + vérifier `isBlocked` sur le site
- `src/app/api/vagues/route.ts` — Idem
- `src/app/api/sites/route.ts` — Vérification abonnement actif du user + quota sites (non-bloqués)
- Tous les endpoints de mutation appellent `invalidateSubscriptionCaches(userId)` + `logAbonnementAudit()`

#### 3.2 Abonnement API
- `src/app/api/abonnements/route.ts` — Adapter POST : plus de siteId, lié au userId de la session
- `src/app/api/abonnements/[id]/renouveler/route.ts` — Adapter pour user-level + déduire soldeCredit
- `src/app/api/webhooks/manuel/route.ts` — Adapter invalidation cache
- `src/lib/services/billing.ts` — Adapter vérification ownership
- `src/lib/services/rappels-abonnement.ts` — Adapter pour user-level

### Phase 4 — UI cleanup + messages adaptés + flow création site

#### 4.1 Déplacer QuotasUsageBar
- `src/components/pages/vagues-page.tsx` — Retirer le composant
- `src/app/(farm)/mon-abonnement/page.tsx` — Ajouter le composant + afficher soldeCredit si > 0

#### 4.2 Messages d'erreur par rôle
- Helper `isOwner(userId, siteId)` : `site.ownerId === userId`
- `src/app/api/bacs/route.ts` — Message adapté
- `src/app/api/vagues/route.ts` — Idem
- `src/app/api/sites/route.ts` — Idem

#### 4.3 Flow création de site
- Vérifier abonnement du user avant d'afficher le formulaire de création
- Si pas d'abonnement : redirection vers `/tarifs` avec `returnUrl=/sites/nouveau`
- Si quota sites atteint : message "Mettez à niveau votre plan"
- Après paiement réussi : détecter returnUrl et proposer la création

#### 4.4 UI ressources bloquées
- Composants de liste (bacs, vagues, sites) : afficher les ressources bloquées grisées avec cadenas
- Clic sur ressource bloquée → dialog "Ressource bloquée par votre plan" + bouton "Mettre à niveau"
- Vérifier `isBlocked` dans les API routes de mutation (rejeter les opérations sur ressources bloquées)

### Phase 5 — Essais (Trial)

#### 5.1 API
- `src/app/api/abonnements/route.ts` — Paramètre `isEssai: true`
  - Vérifie `EssaiUtilise` pour ce user + typePlan
  - Vérifie `plan.dureeEssaiJours > 0` (pas null, pas 0)
  - Crée abonnement `isEssai: true`, durée = `plan.dureeEssaiJours`, `prixPaye: 0`
  - Enregistre dans `EssaiUtilise`
  - Log audit : `ESSAI_DEBUT`
- `src/app/api/abonnements/[id]/essai-to-paid/route.ts` — Convertir essai en payant
  - Crée l'abonnement payant en EN_ATTENTE_PAIEMENT
  - L'essai reste ACTIF pendant le paiement
  - À confirmation du paiement : essai → ANNULE, payant → ACTIF
  - Si paiement échoue : essai reste ACTIF, payant → EXPIRE
  - Log audit : `ESSAI_CONVERSION`

#### 5.2 UI
- `src/components/abonnements/checkout-form.tsx` — Bouton "Essayer X jours gratuitement" si essai disponible
- `src/app/tarifs/page.tsx` — Afficher durée d'essai sur chaque plan (filtrer EXONERATION : non visible)
- `src/components/abonnements/abonnement-actuel-card.tsx` — Afficher "Période d'essai — X jours restants"

#### 5.3 CRON
- Adapter rappels pour gérer fin d'essai → EN_GRACE

### Phase 6 — Upgrade / Downgrade

#### 6.1 Logique métier
- `src/lib/abonnements/prorata.ts` (nouveau fichier)
  - `calculerCreditRestant(abonnement)` : guard div/0 + guard prixPaye=0 + (joursRestants / joursTotaux) × prixPaye
  - `calculerDeltaUpgrade(abonnementActuel, nouveauPlan, nouvellePeriode, soldeCredit)` : prix nouveau - crédit restant - soldeCredit
  - `calculerDateFinNouveau(nouvellePeriode)` : date de fin du nouveau plan
  - `detecterDepassements(userId, nouveauPlan)` : compare ressources non-bloquées vs nouvelles limites → retourne les ressources en excès par site

#### 6.2 API
- `src/app/api/abonnements/[id]/upgrade/route.ts` (nouveau)
  - POST : `{ nouveauPlanId, periode, codePromo? }`
  - Garde-fou : vérifier pas de EN_ATTENTE_PAIEMENT existant (HTTP 409)
  - Calcul prorata + soldeCredit → retourne delta
  - Si delta > 0 : initie paiement, à confirmation → ancien ANNULE, nouveau ACTIF
  - Si delta ≤ 0 : exécution immédiate, surplus → User.soldeCredit
  - Log audit : `UPGRADE` avec metadata { creditRestant, soldeCredit, delta }
- `src/app/api/abonnements/[id]/upgrade/cancel/route.ts` (nouveau)
  - POST : annule un upgrade en EN_ATTENTE_PAIEMENT → ANNULE
- `src/app/api/abonnements/[id]/downgrade/route.ts` (nouveau)
  - POST : `{ nouveauPlanId, periode, ressourcesAGarder: { sites: string[], bacs: Record<string, string[]>, vagues: Record<string, string[]> } }`
  - Validation : les ressources sélectionnées respectent les limites du nouveau plan
  - Enregistre `downgradeVersId` + `downgradePeriode` + `downgradeRessourcesAGarder`
  - Log audit : `DOWNGRADE`
  - DELETE : annule le downgrade programmé, log audit `DOWNGRADE_ANNULE`
- `src/app/api/abonnements/[id]/changer-periode/route.ts` (nouveau)
  - POST : `{ nouvellePeriode }`
  - Validation : `PLAN_TARIFS[plan.typePlan][nouvellePeriode] !== null`
  - Enregistre `prochainePeriode`
  - Log audit : `CHANGEMENT_PERIODE`

#### 6.3 UI
- `src/app/(farm)/mon-abonnement/changer-plan/page.tsx` (nouvelle page)
  - Affiche tous les plans avec comparaison
  - Indique upgrade (immédiat) vs downgrade (fin de période)
  - Calcul prorata en temps réel + affichage soldeCredit
- `src/components/abonnements/upgrade-checkout-form.tsx` (nouveau)
  - Affichage crédit/delta + soldeCredit + code promo sur le delta
  - Paiement uniquement du delta
- `src/components/abonnements/downgrade-resource-selector.tsx` (nouveau)
  - Flow en 3 étapes : sites → bacs par site → vagues par site
  - Chaque étape : liste avec checkbox, compteur "X/Y sélectionnés", résumé par ressource
  - Ressources non sélectionnées marquées en rouge avec icône cadenas
  - Avertissement clair : "Les ressources non sélectionnées seront bloquées. Elles resteront visibles mais inaccessibles jusqu'à un upgrade."
  - Étapes conditionnelles : saute l'étape si pas de dépassement à ce niveau
- `src/app/(farm)/mon-abonnement/gerer-ressources/page.tsx` (nouvelle page)
  - Permet de débloquer/bloquer manuellement des ressources dans les limites du quota
  - Accessible après un upgrade quand des ressources restent bloquées
- `src/components/abonnements/abonnement-actuel-card.tsx`
  - Bouton "Changer de plan" → `/mon-abonnement/changer-plan`
  - Afficher le downgrade programmé si `downgradeVersId` présent (avec option annuler)
  - Afficher soldeCredit si > 0

#### 6.4 CRON
- Adapter le CRON de renouvellement :
  1. Lire `downgradeVersId` → si set : nouveau plan, bloquer les ressources non retenues (re-valider sélections, bloquer les nouvelles ressources créées après sélection)
  2. Lire `prochainePeriode` → si set : nouvelle période
  3. Calculer prix et dates selon plan+période résolu
  4. Déduire `User.soldeCredit` du prix avant paiement
  5. Créer nouvel abonnement, annuler l'ancien
  6. Log audit : `RENOUVELLEMENT`
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

- Tests unitaires : prorata (div/0, prixPaye=0, delta négatif, soldeCredit), quota résolution via owner, détection dépassements, audit logging
- Tests intégration : upgrade flow complet, downgrade avec sélection ressources 3 niveaux, essai → payant (succès + échec paiement), exonération temporaire → EN_GRACE
- Tests non-régression : toutes les fonctionnalités existantes (bacs, vagues, etc.)
- Tests isBlocked : vérifier que les ressources bloquées sont inaccessibles mais visibles
- `npx vitest run` + `npm run build`
- Review checklist R1-R9

---

## Ordre d'exécution

| # | Phase | Dépendances | Agents |
|---|-------|-------------|--------|
| 1 | Migration additive (schema + data) | Aucune | @db-specialist |
| 2 | Queries + check functions (user-level) | Phase 1 | @db-specialist + @developer |
| 3 | API routes adaptation | Phase 2 | @developer |
| 4 | UI cleanup + messages + flow création site + UI bloqué | Phase 3 | @developer |
| 5 | Essais (trial) | Phase 3 | @developer |
| 6 | Upgrade/Downgrade (prorata + sélection ressources + soldeCredit) | Phase 3 | @developer |
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
| 6 | **Changement concurrent** — deux upgrades simultanés | Vérification EN_ATTENTE_PAIEMENT existant (HTTP 409), annulation manuelle possible, timeout 30 min |
| 7 | **Downgrade avec dépassement** — blocage de ressources | Sélection explicite 3 niveaux par l'utilisateur, CRON re-valide à l'exécution, ressources bloquées (pas supprimées) |
| 8 | **Audit trail** — disputes billing | AbonnementAudit avec metadata JSON, onDelete: Restrict, jamais de hard-delete |
| 9 | **Prorata edge cases** — div/0, prixPaye=0, delta négatif | Guards explicites dans `calculerCreditRestant()`, soldeCredit pour surplus |
| 10 | **Owner supprimé** — sites orphelins | onDelete: Restrict sur Site.ownerId — impossible de supprimer un user owner |
| 11 | **Essai annulé pendant paiement** — user sans abonnement | Essai reste ACTIF pendant le paiement, annulé uniquement à confirmation |
| 12 | **Sélection downgrade périmée** — nouvelles ressources créées | CRON re-valide et bloque les nouvelles ressources en priorité |

---

## Nouveaux modèles Prisma (résumé)

| Modèle | Exception R8 | Raison |
|--------|-------------|--------|
| `EssaiUtilise` | Oui (pas de siteId) | Lié au user, pas au site — un user ne peut faire qu'un essai par plan quel que soit le site |
| `AbonnementAudit` | Oui (pas de siteId) | Lié au user via abonnement, qui n'a plus de siteId |

## Champs ajoutés sur modèles existants

| Modèle | Champ | Type | Raison |
|--------|-------|------|--------|
| `Site` | `ownerId` | `String` (FK User, NOT NULL, onDelete: Restrict) | Identifier le propriétaire pour résolution abonnement |
| `Site` | `isBlocked` | `Boolean @default(false)` | Site bloqué suite à downgrade (visible mais inaccessible) |
| `Bac` | `isBlocked` | `Boolean @default(false)` | Bac bloqué suite à downgrade (visible mais inaccessible) |
| `Vague` | `isBlocked` | `Boolean @default(false)` | Vague bloquée suite à downgrade (visible mais inaccessible) |
| `User` | `soldeCredit` | `Decimal @default(0)` | Solde créditeur en FCFA (surplus d'upgrade, déduit au prochain paiement) |
| `PlanAbonnement` | `dureeEssaiJours` | `Int?` | Configurer la durée d'essai par plan (doit être > 0 ou null) |
| `Abonnement` | `motifExoneration` | `String?` | Justification exonération (obligatoire si plan EXONERATION) |
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

**Réactivation :** Après un upgrade, l'utilisateur gère manuellement le déblocage via `/mon-abonnement/gerer-ressources` (dans les limites du nouveau quota). Pas de déblocage automatique.
