# Plan de Sprints — Refactoring Abonnements (ADR-020)

**Version :** 1.0
**Date :** 2026-04-04
**Auteur :** @project-manager
**ADR :** docs/decisions/020-subscription-refactoring.md

> Ce plan couvre les Sprints 45 à 53. Il implémente le refactoring complet du système d'abonnements :
> passage au user-level, plan EXONERATION, essais gratuits, upgrade/downgrade avec prorata,
> solde créditeur, ressources bloquées et audit trail.
> Mettre à jour `docs/TASKS.md` quand chaque sprint commence.

---

## Résumé des Sprints

| Sprint | Titre | Stories | Focus | Dépend de | Parallélisable |
|--------|-------|---------|-------|-----------|----------------|
| **45** | Migration additive (Schema + Data + Types + Constants) | 5 | DB + interfaces + constantes | Sprint 44 FAIT | Non |
| **46** | Queries et check functions (user-level) | 4 | Couche data + cache | Sprint 45 | Non |
| **47** | API routes adaptation | 4 | Routes + billing + webhooks | Sprint 46 | Non |
| **48** | UI cleanup + messages + flow création site + UI bloqué | 5 | Frontend + UX | Sprint 47 | Oui (avec 49, 50, 51) |
| **49** | Essais (Trial) | 4 | API essai + UI + CRON | Sprint 47 | Oui (avec 48, 50, 51) |
| **50** | Upgrade / Downgrade | 7 | Prorata + sélection ressources | Sprint 47 | Oui (avec 48, 49, 51) |
| **51** | Backoffice Exonération | 3 | Admin CRUD + UI | Sprint 47 | Oui (avec 48, 49, 50) |
| **52** | Cleanup migration + retrait fallback | 3 | Suppression siteId + nettoyage | Sprints 48-51 | Non |
| **53** | Tests intégration + Review finale | 4 | Tests + review R1-R9 | Sprint 52 | Non |
| **Total** | | **39** | | | |

---

## Sprint 45 — Migration additive (Schema + Data + Types + Constants)

**Objectif :** Ajouter tous les nouveaux champs, modèles et enums sans rien supprimer. Les anciennes queries continuent de fonctionner. Zéro downtime.

**Dépend de :** Sprint 44 FAIT

---

### Story 45.1 — Schema Prisma : EXONERATION + ownerId + isBlocked + nouveaux champs Abonnement
**Assigné à :** @db-specialist
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Migration additive du schéma Prisma. Ajouter tous les champs et modèles nécessaires au refactoring sans rien supprimer de l'existant.

**Tâches :**
- [ ] `TODO` Ajouter `EXONERATION` à l'enum `TypePlan`
- [ ] `TODO` Ajouter `ownerId String?` sur `Site` (nullable d'abord, FK → User, **onDelete: Restrict**)
- [ ] `TODO` Ajouter `isBlocked Boolean @default(false)` sur `Site`, `Bac`, `Vague`
- [ ] `TODO` Ajouter `soldeCredit Decimal @default(0)` sur `User`
- [ ] `TODO` Ajouter `dureeEssaiJours Int?` sur `PlanAbonnement`
- [ ] `TODO` Ajouter sur `Abonnement` : `motifExoneration String?`, `isEssai Boolean @default(false)`, `dureeEssaiJours Int?`, `downgradeVersId String?` (FK → PlanAbonnement), `downgradePeriode PeriodeFacturation?`, `downgradeRessourcesAGarder Json?`, `prochainePeriode PeriodeFacturation?`
- [ ] `TODO` Créer modèle `EssaiUtilise` (exception R8 documentée : pas de siteId)
- [ ] `TODO` Créer modèle `AbonnementAudit` (exception R8, **onDelete: Restrict** sur FK abonnement)
- [ ] `TODO` Générer et appliquer la migration SQL additive

**Fichiers impactés :**
- `prisma/schema.prisma`

**Critères d'acceptation :**
- `npx prisma migrate dev` passe sans erreur
- Les anciennes queries (getAbonnementActif par siteId) fonctionnent toujours
- Les enums sont en MAJUSCULES (R1)
- Les FK ont les bons onDelete (Restrict sur ownerId et AbonnementAudit)
- `npm run build` passe

---

### Story 45.2 — Data migration SQL : ownerId, PlanAbonnement EXONERATION, abonnements manquants
**Assigné à :** @db-specialist
**Dépend de :** Story 45.1
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Script SQL qui peuple les nouveaux champs sur les données existantes et crée les enregistrements nécessaires.

**Tâches :**
- [ ] `TODO` Script SQL : peupler `Site.ownerId` = userId du premier SiteMember Administrateur par site
- [ ] `TODO` Fallback : si pas d'Administrateur → premier SiteMember ; si aucun member → flag pour review manuelle
- [ ] `TODO` Seconde migration : rendre `Site.ownerId` NOT NULL (après vérification aucun site orphelin)
- [ ] `TODO` INSERT `PlanAbonnement` EXONERATION (`isPublic: false`, limites 999/999/999, prix 0 toutes périodes, `dureeEssaiJours: null`)
- [ ] `TODO` INSERT abonnement EXONERATION pour le site prod de Ronald (motif : "Site fondateur DKFarm")
- [ ] `TODO` INSERT abonnement DECOUVERTE pour tout site existant sans abonnement actif

**Fichiers impactés :**
- `prisma/schema.prisma` (NOT NULL sur ownerId)
- `prisma/seed.sql` (mise à jour seed dev)

**Critères d'acceptation :**
- Aucun site avec `ownerId = NULL` après migration
- Le PlanAbonnement EXONERATION existe avec `isPublic = false`
- Chaque site en prod a au moins un abonnement (EXONERATION ou DECOUVERTE)
- `npm run db:seed` fonctionne sur base vide

---

### Story 45.3 — Types TypeScript : interfaces mises à jour + nouveaux types
**Assigné à :** @developer
**Dépend de :** Story 45.1
**Priorité :** Haute
**Complexité :** Moyenne
**Statut :** `TODO`

**Description :** Mettre à jour les interfaces TypeScript pour refléter les nouveaux champs du schéma.

**Tâches :**
- [ ] `TODO` Ajouter `ownerId: string` et `isBlocked: boolean` sur l'interface `Site`
- [ ] `TODO` Ajouter `isBlocked: boolean` sur les interfaces `Bac` et `Vague`
- [ ] `TODO` Ajouter `soldeCredit: number` sur l'interface `User`
- [ ] `TODO` Ajouter les nouveaux champs sur l'interface `Abonnement` (motifExoneration, isEssai, dureeEssaiJours, downgradeVersId, downgradePeriode, downgradeRessourcesAGarder, prochainePeriode)
- [ ] `TODO` Ajouter `dureeEssaiJours: number | null` sur l'interface `PlanAbonnement`
- [ ] `TODO` Créer interfaces `EssaiUtilise` et `AbonnementAudit`
- [ ] `TODO` Créer type `DowngradeRessourcesAGarder = { sites: string[]; bacs: Record<string, string[]>; vagues: Record<string, string[]> }`
- [ ] `TODO` Mettre à jour DTOs dans `api.ts` (CreateAbonnementDTO avec isEssai, UpgradeDTO, DowngradeDTO, ChangerPeriodeDTO)
- [ ] `TODO` Exporter les nouveaux types dans `index.ts`

**Fichiers impactés :**
- `src/types/models.ts`
- `src/types/api.ts`
- `src/types/index.ts`

**Critères d'acceptation :**
- `npm run build` passe sans erreur de type
- Les enums sont importés depuis `@/types` (R2)
- Les nouveaux types sont bien exportés

---

### Story 45.4 — Constants : EXONERATION dans PLAN_TARIFS, PLAN_LIMITES, PLAN_LABELS
**Assigné à :** @developer
**Dépend de :** Story 45.3
**Priorité :** Haute
**Complexité :** Simple
**Statut :** `TODO`

**Description :** Ajouter les entrées EXONERATION dans toutes les constantes de plans.

**Tâches :**
- [ ] `TODO` Ajouter `[TypePlan.EXONERATION]` dans `PLAN_TARIFS` : `{ MENSUEL: 0, TRIMESTRIEL: 0, ANNUEL: 0 }`
- [ ] `TODO` Ajouter `[TypePlan.EXONERATION]` dans `PLAN_LIMITES` : `{ limitesSites: 999, limitesBacs: 999, limitesVagues: 999, limitesIngFermes: null }`
- [ ] `TODO` Ajouter `[TypePlan.EXONERATION]` dans `PLAN_LABELS` : clé i18n `"plans.EXONERATION"`
- [ ] `TODO` Ajouter les traductions i18n pour EXONERATION (fr + en)

**Fichiers impactés :**
- `src/lib/abonnements-constants.ts`
- `src/messages/fr.json` et `src/messages/en.json`

**Critères d'acceptation :**
- `TypePlan.EXONERATION` est reconnu dans toutes les lookup tables
- `npm run build` passe

---

### Story 45.5 — Test + Review Sprint 45
**Assigné à :** @tester + @code-reviewer
**Dépend de :** Stories 45.1-45.4
**Priorité :** Haute
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` `npx prisma migrate dev` sans erreur
- [ ] `TODO` `npm run db:seed` sans erreur
- [ ] `TODO` `npm run build` sans erreur
- [ ] `TODO` Vérifier que les anciennes fonctionnalités ne sont pas cassées (getAbonnementActif par siteId fonctionne toujours)
- [ ] `TODO` Review R1-R9

---

## Sprint 46 — Queries et check functions (user-level)

**Objectif :** Adapter toute la couche data pour fonctionner par userId. Le fallback DECOUVERTE reste en place comme filet de sécurité.

**Dépend de :** Sprint 45

---

### Story 46.1 — Queries abonnements : getAbonnementActif(userId) + getAbonnementActifPourSite(siteId)
**Assigné à :** @db-specialist
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Adapter les queries d'abonnement pour le user-level. Créer le wrapper qui résout site → owner → abonnement avec cache.

**Tâches :**
- [ ] `TODO` Modifier `getAbonnementActif(userId)` : chercher par userId, ORDER BY statut ASC (ACTIF prioritaire sur EN_GRACE), createdAt DESC, LIMIT 1
- [ ] `TODO` Créer `getAbonnementActifPourSite(siteId)` : site.ownerId → getAbonnementActif(ownerId), avec `unstable_cache` taggé `subscription-site-${siteId}`, TTL 3600s
- [ ] `TODO` Adapter `getAbonnements(userId, filters)` : filtrer par userId au lieu de siteId
- [ ] `TODO` Adapter `getAbonnementsExpirantAvant(date)` : ne plus inclure la relation `site`, inclure `user`
- [ ] `TODO` Adapter `getAbonnementsEnGraceExpires()` : idem, ne plus sélectionner `siteId`
- [ ] `TODO` Créer `logAbonnementAudit()` helper

**Fichiers impactés :**
- `src/lib/queries/abonnements.ts`

**Critères d'acceptation :**
- `getAbonnementActif(userId)` retourne le bon abonnement (ACTIF prioritaire)
- `getAbonnementActifPourSite(siteId)` résout via owner avec cache
- `logAbonnementAudit()` crée des entrées correctes dans AbonnementAudit
- Les anciennes fonctions qui utilisaient siteId ont un wrapper de compatibilité temporaire

---

### Story 46.2 — check-quotas : résolution via owner + exclusion isBlocked + getQuotaSites
**Assigné à :** @db-specialist
**Dépend de :** Story 46.1
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Adapter la vérification des quotas pour résoudre l'abonnement via le propriétaire du site et exclure les ressources bloquées des comptages.

**Tâches :**
- [ ] `TODO` `getQuotasUsage(siteId)` : utiliser `getAbonnementActifPourSite(siteId)` au lieu de `getAbonnementActif(siteId)`
- [ ] `TODO` Les comptages de bacs excluent `isBlocked = true` : `prisma.bac.count({ where: { siteId, isBlocked: false } })`
- [ ] `TODO` Les comptages de vagues excluent `isBlocked = true` : `prisma.vague.count({ where: { siteId, statut: EN_COURS, isBlocked: false } })`
- [ ] `TODO` Créer `getQuotaSites(userId)` : compte les sites non-bloqués du user vs `limitesSites`
- [ ] `TODO` Garder le fallback DECOUVERTE dans `resolvePlanLimites()` (sera retiré en Sprint 52)

**Fichiers impactés :**
- `src/lib/abonnements/check-quotas.ts`

**Critères d'acceptation :**
- Les bacs/vagues bloqués ne sont pas comptés dans les quotas
- `getQuotaSites(userId)` fonctionne correctement
- Le fallback DECOUVERTE reste opérationnel

---

### Story 46.3 — check-subscription + invalidate-caches
**Assigné à :** @developer
**Dépend de :** Story 46.1
**Priorité :** Haute
**Complexité :** Moyenne
**Statut :** `TODO`

**Description :** Adapter les fonctions de vérification de statut et créer le système d'invalidation de cache centralisé.

**Tâches :**
- [ ] `TODO` `getSubscriptionStatus(userId)` au lieu de siteId, cache taggé `subscription-${userId}`
- [ ] `TODO` Créer `getSubscriptionStatusForSite(siteId)` : wrapper via owner
- [ ] `TODO` Créer `src/lib/abonnements/invalidate-caches.ts` :
  - `invalidateSubscriptionCaches(userId)` → invalide `subscription-${userId}` + `subscription-site-${siteId}` pour chaque site du user
- [ ] `TODO` Adapter `SubscriptionBanner` pour utiliser le nouveau `getSubscriptionStatusForSite`

**Fichiers impactés :**
- `src/lib/abonnements/check-subscription.ts`
- `src/lib/abonnements/invalidate-caches.ts` (nouveau)
- `src/components/subscription/subscription-banner.tsx`

**Critères d'acceptation :**
- `invalidateSubscriptionCaches(userId)` invalide correctement user + tous ses sites
- Le banner de subscription fonctionne toujours

---

### Story 46.4 — Test + Review Sprint 46
**Assigné à :** @tester + @code-reviewer
**Dépend de :** Stories 46.1-46.3
**Priorité :** Haute
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Tests unitaires : getAbonnementActif par userId, résolution owner, exclusion isBlocked
- [ ] `TODO` `npx vitest run` — tous les tests passent
- [ ] `TODO` `npm run build` sans erreur
- [ ] `TODO` Review R1-R9

---

## Sprint 47 — API routes adaptation

**Objectif :** Adapter toutes les API routes pour le user-level : quota checks, création d'abonnement, billing, webhooks.

**Dépend de :** Sprint 46

---

### Story 47.1 — API quota checks : bacs/vagues/sites + messages adaptés au rôle
**Assigné à :** @developer
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Adapter les routes de création bacs/vagues/sites pour utiliser le nouveau système de quota via owner, et différencier les messages d'erreur selon le rôle.

**Tâches :**
- [ ] `TODO` Créer helper `isOwner(userId, siteId)` → `site.ownerId === userId`
- [ ] `TODO` `POST /api/bacs` : quota via `getAbonnementActifPourSite(siteId)` + vérifier `site.isBlocked` + message adapté (owner vs employé)
- [ ] `TODO` `POST /api/vagues` : idem
- [ ] `TODO` `POST /api/sites` : vérifier abonnement actif du user + `getQuotaSites(userId)` + message adapté
- [ ] `TODO` Rejeter les opérations sur les ressources bloquées (`isBlocked = true`) avec message "Ressource bloquée"

**Fichiers impactés :**
- `src/app/api/bacs/route.ts`
- `src/app/api/vagues/route.ts`
- `src/app/api/sites/route.ts`
- `src/lib/queries/sites.ts` (helper isOwner)

**Critères d'acceptation :**
- Un employé reçoit "Contactez le propriétaire" quand le quota est atteint
- Un owner reçoit "Mettez à niveau votre plan"
- Impossible de créer sur un site/bac/vague bloqué (HTTP 403)
- Création de site bloquée sans abonnement actif (HTTP 402)

---

### Story 47.2 — API abonnements : POST sans siteId + garde-fou 409 + soldeCredit renouvellement
**Assigné à :** @developer
**Dépend de :** Story 47.1
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Adapter la route POST /api/abonnements pour le user-level. Ajouter le garde-fou contre les changements concurrents.

**Tâches :**
- [ ] `TODO` `POST /api/abonnements` : lié au userId de la session, plus de siteId
- [ ] `TODO` Garde-fou : si `Abonnement` en `EN_ATTENTE_PAIEMENT` existe pour ce user → HTTP 409 "Un changement de plan est déjà en cours"
- [ ] `TODO` `POST /api/abonnements/[id]/renouveler` : déduire `User.soldeCredit` du prix avant paiement
- [ ] `TODO` Appeler `invalidateSubscriptionCaches(userId)` + `logAbonnementAudit()` dans chaque mutation
- [ ] `TODO` Adapter `createAbonnement()` : supprimer le paramètre siteId

**Fichiers impactés :**
- `src/app/api/abonnements/route.ts`
- `src/app/api/abonnements/[id]/renouveler/route.ts`
- `src/lib/queries/abonnements.ts` (createAbonnement sans siteId)

**Critères d'acceptation :**
- Un abonnement est créé sans siteId, lié au userId
- HTTP 409 si un pending existe déjà
- Le soldeCredit est déduit au renouvellement
- Chaque mutation crée un entry AbonnementAudit

---

### Story 47.3 — Webhooks + billing + rappels adaptés user-level
**Assigné à :** @developer
**Dépend de :** Story 47.2
**Priorité :** Haute
**Complexité :** Moyenne
**Statut :** `TODO`

**Description :** Adapter les services de billing, webhooks et rappels pour le user-level.

**Tâches :**
- [ ] `TODO` `src/app/api/webhooks/manuel/route.ts` : utiliser `invalidateSubscriptionCaches(userId)` au lieu de `revalidateTag(subscription-${siteId})`
- [ ] `TODO` `src/lib/services/billing.ts` : adapter vérification ownership (via userId au lieu de siteId)
- [ ] `TODO` `src/lib/services/rappels-abonnement.ts` : adapter pour user-level (ne plus référencer siteId)

**Fichiers impactés :**
- `src/app/api/webhooks/manuel/route.ts`
- `src/lib/services/billing.ts`
- `src/lib/services/rappels-abonnement.ts`

**Critères d'acceptation :**
- Les webhooks invalident les caches correctement (user + sites)
- Les rappels fonctionnent avec le user-level
- `npm run build` passe

---

### Story 47.4 — Test + Review Sprint 47
**Assigné à :** @tester + @code-reviewer
**Dépend de :** Stories 47.1-47.3
**Priorité :** Haute
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Tests API : création bacs/vagues bloquée quand quota atteint (via owner)
- [ ] `TODO` Tests API : création site bloquée sans abonnement
- [ ] `TODO` Tests API : garde-fou 409
- [ ] `TODO` `npx vitest run` + `npm run build`
- [ ] `TODO` Review R1-R9

---

## Sprint 48 — UI cleanup + messages + flow création site + UI bloqué

**Objectif :** Adapter le frontend : déplacer QuotasUsageBar, implémenter les messages par rôle, le flow de création de site et l'affichage des ressources bloquées.

**Dépend de :** Sprint 47
**Parallélisable avec :** Sprints 49, 50, 51

---

### Story 48.1 — Déplacer QuotasUsageBar + afficher soldeCredit
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Simple
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Retirer `QuotasUsageBar` de `src/components/pages/vagues-page.tsx`
- [ ] `TODO` Ajouter `QuotasUsageBar` sur `src/app/(farm)/mon-abonnement/page.tsx`
- [ ] `TODO` Afficher `soldeCredit` si > 0 sur la page mon-abonnement

**Fichiers impactés :**
- `src/components/pages/vagues-page.tsx`
- `src/app/(farm)/mon-abonnement/page.tsx`

**Critères d'acceptation :**
- La page vagues n'affiche plus les quotas
- La page mon-abonnement affiche quotas + solde créditeur

---

### Story 48.2 — Messages d'erreur adaptés au rôle (owner vs employé)
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Moyenne
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Messages i18n pour owner : "Vous avez atteint la limite de X. Mettez à niveau votre plan."
- [ ] `TODO` Messages i18n pour employé : "La limite de X a été atteinte. Contactez le propriétaire du site."
- [ ] `TODO` Adapter les composants qui affichent les erreurs 402 pour différencier le message

**Fichiers impactés :**
- `src/messages/fr.json`, `src/messages/en.json`
- Composants qui gèrent les erreurs 402

**Critères d'acceptation :**
- Un employé ne voit pas "Mettez à niveau" mais "Contactez le propriétaire"

---

### Story 48.3 — Flow création de site avec vérification abonnement
**Assigné à :** @developer
**Priorité :** Critique
**Complexité :** Moyenne
**Statut :** `TODO`

**Description :** Bloquer la création de site si l'utilisateur n'a pas d'abonnement actif. Rediriger vers /tarifs avec returnUrl.

**Tâches :**
- [ ] `TODO` Page création de site : vérifier abonnement du user avant d'afficher le formulaire
- [ ] `TODO` Si pas d'abonnement : redirection vers `/tarifs?returnUrl=/sites/nouveau`
- [ ] `TODO` Si quota sites atteint : message "Mettez à niveau votre plan"
- [ ] `TODO` Après paiement réussi : détecter returnUrl et rediriger vers la création de site

**Fichiers impactés :**
- `src/app/(farm)/sites/nouveau/page.tsx` (ou équivalent)
- `src/components/abonnements/checkout-form.tsx` (returnUrl)

**Critères d'acceptation :**
- Impossible de créer un site sans abonnement actif
- Le returnUrl ramène l'utilisateur à la création de site après paiement

---

### Story 48.4 — UI ressources bloquées (badge cadenas, grisé, dialog upgrade)
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Afficher les ressources bloquées dans les listes avec badge cadenas, grisé. Clic → dialog avec message + bouton "Mettre à niveau".

**Tâches :**
- [ ] `TODO` Créer composant `BlockedResourceOverlay` : message + bouton "Mettre à niveau" → `/mon-abonnement/changer-plan`
- [ ] `TODO` Liste des sites : afficher sites bloqués grisés avec cadenas, clic → BlockedResourceOverlay
- [ ] `TODO` Liste des bacs : idem pour bacs bloqués
- [ ] `TODO` Liste des vagues : idem pour vagues bloquées
- [ ] `TODO` Vérifier `isBlocked` dans les routes API de mutation (rejeter opérations sur ressources bloquées)

**Fichiers impactés :**
- `src/components/ui/blocked-resource-overlay.tsx` (nouveau)
- `src/components/sites/sites-list-client.tsx`
- `src/components/bacs/bacs-list-client.tsx`
- `src/components/vagues/vagues-list-client.tsx`

**Critères d'acceptation :**
- Ressources bloquées visibles mais inaccessibles
- Clic → message clair + bouton upgrade
- Mobile-first (360px)

---

### Story 48.5 — Test + Review Sprint 48
**Assigné à :** @tester + @code-reviewer
**Dépend de :** Stories 48.1-48.4
**Priorité :** Haute
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Test manuel mobile (360px) : QuotasUsageBar sur mon-abonnement, ressources bloquées
- [ ] `TODO` `npx vitest run` + `npm run build`
- [ ] `TODO` Review R1-R9

---

## Sprint 49 — Essais (Trial)

**Objectif :** Implémenter le système d'essai gratuit : souscription, conversion essai → payant, CRON fin d'essai.

**Dépend de :** Sprint 47
**Parallélisable avec :** Sprints 48, 50, 51

---

### Story 49.1 — API création essai + vérification EssaiUtilise
**Assigné à :** @developer
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Permettre la souscription d'un essai gratuit. Vérifier que l'utilisateur n'a pas déjà utilisé un essai pour ce plan.

**Tâches :**
- [ ] `TODO` `POST /api/abonnements` avec `isEssai: true` :
  - Vérifier `plan.dureeEssaiJours > 0` (pas null, pas 0)
  - Vérifier `EssaiUtilise` pour ce user + typePlan (unique constraint)
  - Créer abonnement `isEssai: true`, durée = `plan.dureeEssaiJours`, `prixPaye: 0`
  - Enregistrer dans `EssaiUtilise`
  - Log audit : `ESSAI_DEBUT`
- [ ] `TODO` Retourner erreur si essai déjà utilisé pour ce plan

**Fichiers impactés :**
- `src/app/api/abonnements/route.ts`

**Critères d'acceptation :**
- Un essai est créé avec `isEssai: true` et `prixPaye: 0`
- Impossible de créer un second essai pour le même plan (même user)
- `dureeEssaiJours = 0` rejeté, `dureeEssaiJours = null` rejeté

---

### Story 49.2 — API conversion essai → payant (essai-to-paid)
**Assigné à :** @developer
**Dépend de :** Story 49.1
**Priorité :** Haute
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Permettre la conversion d'un essai actif en abonnement payant. L'essai ne doit PAS être annulé tant que le paiement n'est pas confirmé.

**Tâches :**
- [ ] `TODO` Créer `POST /api/abonnements/[id]/essai-to-paid` :
  - Vérifier que l'abonnement est un essai actif (`isEssai: true`, statut ACTIF ou EN_GRACE)
  - Créer un nouvel abonnement payant en EN_ATTENTE_PAIEMENT
  - L'essai reste ACTIF pendant le paiement
  - À confirmation paiement : essai → ANNULE, payant → ACTIF
  - Si paiement échoue : essai reste ACTIF, payant → EXPIRE
  - Log audit : `ESSAI_CONVERSION`

**Fichiers impactés :**
- `src/app/api/abonnements/[id]/essai-to-paid/route.ts` (nouveau)

**Critères d'acceptation :**
- L'essai n'est jamais annulé avant confirmation de paiement
- Le nouveau cycle payant démarre immédiatement à la confirmation
- Audit trail correct

---

### Story 49.3 — UI essai : bouton checkout + affichage tarifs + carte abonnement + CRON
**Assigné à :** @developer
**Dépend de :** Story 49.1
**Priorité :** Haute
**Complexité :** Moyenne
**Statut :** `TODO`

**Description :** Ajouter le bouton "Essayer gratuitement" dans le checkout, afficher la durée d'essai sur /tarifs, et adapter la carte abonnement.

**Tâches :**
- [ ] `TODO` `checkout-form.tsx` : bouton "Essayer X jours gratuitement" si essai disponible pour ce plan et user
- [ ] `TODO` `/tarifs` : afficher la durée d'essai sur chaque plan (si configurée). Filtrer EXONERATION (non visible).
- [ ] `TODO` `abonnement-actuel-card.tsx` : afficher "Période d'essai — X jours restants" si `isEssai: true`
- [ ] `TODO` Adapter le CRON de rappels pour gérer la fin d'essai → EN_GRACE (même logique que fin d'abonnement)

**Fichiers impactés :**
- `src/components/abonnements/checkout-form.tsx`
- `src/app/tarifs/page.tsx`
- `src/components/abonnements/abonnement-actuel-card.tsx`
- `src/lib/services/rappels-abonnement.ts` (CRON)

**Critères d'acceptation :**
- Le bouton essai n'apparaît pas si l'essai a déjà été utilisé
- EXONERATION n'apparaît pas sur /tarifs
- La carte abonnement indique clairement "Essai gratuit"

---

### Story 49.4 — Test + Review Sprint 49
**Assigné à :** @tester + @code-reviewer
**Dépend de :** Stories 49.1-49.3
**Priorité :** Haute
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Tests : création essai, conversion essai → payant (succès + échec paiement), essai déjà utilisé
- [ ] `TODO` `npx vitest run` + `npm run build`
- [ ] `TODO` Review R1-R9

---

## Sprint 50 — Upgrade / Downgrade

**Objectif :** Implémenter le flux complet d'upgrade (immédiat avec prorata) et downgrade (différé avec sélection de ressources 3 niveaux).

**Dépend de :** Sprint 47
**Parallélisable avec :** Sprints 48, 49, 51

---

### Story 50.1 — Logique prorata : calculerCreditRestant, calculerDeltaUpgrade, detecterDepassements
**Assigné à :** @developer
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Créer les fonctions pures de calcul du prorata et de détection des dépassements.

**Tâches :**
- [ ] `TODO` Créer `src/lib/abonnements/prorata.ts` :
  - `calculerCreditRestant(abonnement)` : guard div/0 (`joursTotaux === 0` → `creditRestant = prixPaye`), guard prixPaye=0 → `creditRestant = 0`, sinon `(joursRestants / joursTotaux) × prixPaye`
  - `calculerDeltaUpgrade(abonnementActuel, nouveauPlan, nouvellePeriode, soldeCredit)` : `prixNouveau - creditRestant - soldeCredit`
  - `calculerDateFinNouveau(nouvellePeriode)` : date de fin selon la période
  - `detecterDepassements(userId, nouveauPlan)` : compare ressources non-bloquées vs nouvelles limites → retourne dépassements par niveau (sites, bacs par site, vagues par site)

**Fichiers impactés :**
- `src/lib/abonnements/prorata.ts` (nouveau)

**Critères d'acceptation :**
- Division par zéro gérée (upgrade le jour même)
- prixPaye = 0 gérée (essai, DECOUVERTE)
- Delta négatif retourne un surplus à stocker dans soldeCredit
- detecterDepassements ne compte que les ressources non-bloquées

---

### Story 50.2 — API upgrade : POST + cancel + soldeCredit
**Assigné à :** @developer
**Dépend de :** Story 50.1
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Créer les endpoints d'upgrade avec prorata et gestion du solde créditeur.

**Tâches :**
- [ ] `TODO` Créer `POST /api/abonnements/[id]/upgrade` :
  - Body : `{ nouveauPlanId, periode, codePromo? }`
  - Garde-fou : HTTP 409 si EN_ATTENTE_PAIEMENT existant
  - Calcul prorata + soldeCredit → delta
  - Si delta > 0 : initier paiement, à confirmation → ancien ANNULE, nouveau ACTIF
  - Si delta ≤ 0 : exécution immédiate, surplus → `User.soldeCredit`
  - Log audit : `UPGRADE` avec metadata { creditRestant, soldeCredit, delta }
- [ ] `TODO` Créer `POST /api/abonnements/[id]/upgrade/cancel` : annuler un upgrade pending → ANNULE
- [ ] `TODO` Appeler `invalidateSubscriptionCaches(userId)` à chaque mutation

**Fichiers impactés :**
- `src/app/api/abonnements/[id]/upgrade/route.ts` (nouveau)
- `src/app/api/abonnements/[id]/upgrade/cancel/route.ts` (nouveau)

**Critères d'acceptation :**
- Upgrade immédiat si delta ≤ 0
- Surplus stocké dans User.soldeCredit
- HTTP 409 si pending existe
- Annulation de pending fonctionne
- Audit trail correct avec metadata

---

### Story 50.3 — API downgrade : POST + DELETE + changer-periode
**Assigné à :** @developer
**Dépend de :** Story 50.1
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Créer les endpoints de downgrade (programmé fin de période) et de changement de période.

**Tâches :**
- [ ] `TODO` Créer `POST /api/abonnements/[id]/downgrade` :
  - Body : `{ nouveauPlanId, periode, ressourcesAGarder: { sites: string[], bacs: Record<string, string[]>, vagues: Record<string, string[]> } }`
  - Validation : ressources sélectionnées respectent les limites du nouveau plan
  - Enregistrer `downgradeVersId` + `downgradePeriode` + `downgradeRessourcesAGarder`
  - Log audit : `DOWNGRADE`
- [ ] `TODO` Créer `DELETE /api/abonnements/[id]/downgrade` : annuler le downgrade programmé, reset des 3 champs
  - Log audit : `DOWNGRADE_ANNULE`
- [ ] `TODO` Créer `POST /api/abonnements/[id]/changer-periode` :
  - Body : `{ nouvellePeriode }`
  - Validation : `PLAN_TARIFS[plan.typePlan][nouvellePeriode] !== null`
  - Enregistrer `prochainePeriode`
  - Log audit : `CHANGEMENT_PERIODE`

**Fichiers impactés :**
- `src/app/api/abonnements/[id]/downgrade/route.ts` (nouveau)
- `src/app/api/abonnements/[id]/changer-periode/route.ts` (nouveau)

**Critères d'acceptation :**
- Les ressources sélectionnées respectent les limites du plan cible
- Annulation du downgrade reset les 3 champs
- Validation de la période vs PLAN_TARIFS
- Audit trail correct

---

### Story 50.4 — UI page changer-plan + upgrade-checkout-form
**Assigné à :** @developer
**Dépend de :** Story 50.2
**Priorité :** Haute
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Page de comparaison des plans avec calcul prorata en temps réel et checkout d'upgrade.

**Tâches :**
- [ ] `TODO` Créer `src/app/(farm)/mon-abonnement/changer-plan/page.tsx` :
  - Afficher tous les plans (sauf EXONERATION) avec comparaison
  - Indiquer upgrade (immédiat) vs downgrade (fin de période)
  - Calcul prorata en temps réel + affichage soldeCredit
  - Bouton action → checkout ou sélection ressources
- [ ] `TODO` Créer `src/components/abonnements/upgrade-checkout-form.tsx` :
  - Affichage crédit restant / delta / soldeCredit
  - Code promo applicable sur le delta
  - Paiement uniquement du delta
- [ ] `TODO` Modifier `abonnement-actuel-card.tsx` : bouton "Changer de plan" → `/mon-abonnement/changer-plan`

**Fichiers impactés :**
- `src/app/(farm)/mon-abonnement/changer-plan/page.tsx` (nouveau)
- `src/components/abonnements/upgrade-checkout-form.tsx` (nouveau)
- `src/components/abonnements/abonnement-actuel-card.tsx`

**Critères d'acceptation :**
- Prorata calculé et affiché en temps réel
- EXONERATION non visible
- Mobile-first (360px)

---

### Story 50.5 — UI downgrade-resource-selector (3 étapes) + gérer-ressources
**Assigné à :** @developer
**Dépend de :** Story 50.3
**Priorité :** Haute
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Composant de sélection des ressources en 3 étapes (sites → bacs → vagues) et page de gestion des ressources bloquées après upgrade.

**Tâches :**
- [ ] `TODO` Créer `src/components/abonnements/downgrade-resource-selector.tsx` :
  - Étape 1 : sélection sites (si dépassement limitesSites)
  - Étape 2 : sélection bacs par site retenu (si dépassement limitesBacs)
  - Étape 3 : sélection vagues par site retenu (si dépassement limitesVagues)
  - Compteur "X/Y sélectionnés" à chaque étape
  - Ressources non sélectionnées marquées en rouge + cadenas
  - Sauter les étapes sans dépassement
- [ ] `TODO` Créer `src/app/(farm)/mon-abonnement/gerer-ressources/page.tsx` :
  - Débloquer/bloquer manuellement des ressources dans les limites du quota
  - Accessible après upgrade quand des ressources restent bloquées
- [ ] `TODO` Afficher le downgrade programmé dans `abonnement-actuel-card.tsx` avec option annuler

**Fichiers impactés :**
- `src/components/abonnements/downgrade-resource-selector.tsx` (nouveau)
- `src/app/(farm)/mon-abonnement/gerer-ressources/page.tsx` (nouveau)
- `src/components/abonnements/abonnement-actuel-card.tsx`

**Critères d'acceptation :**
- Flow 3 étapes conditionnel (saute si pas de dépassement)
- Impossible de valider si trop de ressources sélectionnées
- Mobile-first (360px)

---

### Story 50.6 — CRON renouvellement : downgrade + période + soldeCredit + nettoyage
**Assigné à :** @developer
**Dépend de :** Stories 50.2, 50.3
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Description :** Adapter le CRON de renouvellement pour gérer les downgrades programmés, les changements de période et le solde créditeur.

**Tâches :**
- [ ] `TODO` CRON renouvellement :
  1. Lire `downgradeVersId` → si set : bloquer les ressources non retenues (re-valider sélections, bloquer nouvelles ressources créées après sélection en priorité), créer nouvel abonnement avec le nouveau plan
  2. Lire `prochainePeriode` → si set : utiliser nouvelle période + nouveau prix
  3. Déduire `User.soldeCredit` du prix avant paiement
  4. Si `soldeCredit >= prix` → renouvellement gratuit
  5. Créer nouvel abonnement, annuler l'ancien
  6. Log audit : `RENOUVELLEMENT`
- [ ] `TODO` Nettoyage : passer les EN_ATTENTE_PAIEMENT > 30 min en EXPIRE

**Fichiers impactés :**
- `src/lib/services/rappels-abonnement.ts` (ou service CRON dédié)
- `src/app/api/cron/*/route.ts`

**Critères d'acceptation :**
- Le CRON re-valide les sélections de downgrade (IDs supprimés ignorés, nouvelles ressources bloquées)
- SoldeCredit déduit avant paiement
- Pending > 30 min nettoyés
- Audit trail correct

---

### Story 50.7 — Test + Review Sprint 50
**Assigné à :** @tester + @code-reviewer
**Dépend de :** Stories 50.1-50.6
**Priorité :** Haute
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Tests prorata : div/0, prixPaye=0, delta négatif, soldeCredit
- [ ] `TODO` Tests upgrade : immédiat, avec paiement, avec code promo, annulation pending
- [ ] `TODO` Tests downgrade : sélection 3 niveaux, annulation, CRON exécution
- [ ] `TODO` `npx vitest run` + `npm run build`
- [ ] `TODO` Review R1-R9

---

## Sprint 51 — Backoffice Exonération

**Objectif :** Permettre aux super admins DKFarm de créer/gérer les exonérations.

**Dépend de :** Sprint 47
**Parallélisable avec :** Sprints 48, 49, 50

---

### Story 51.1 — API admin exonérations CRUD
**Assigné à :** @developer
**Priorité :** Haute
**Complexité :** Moyenne
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Créer `GET /api/admin/exonerations` : liste des exonérations actives (avec user + plan)
- [ ] `TODO` Créer `POST /api/admin/exonerations` : `{ userId, motif, dateFin? }`
  - Vérifie super admin (`isSuperAdmin`)
  - Crée un abonnement EXONERATION avec motif obligatoire
  - Si `dateFin` non fourni → permanent (2099-12-31)
  - Log audit : `EXONERATION`
- [ ] `TODO` Créer `DELETE /api/admin/exonerations/[id]` : annule l'exonération (ANNULE)
  - Log audit : `ANNULATION`

**Fichiers impactés :**
- `src/app/api/admin/exonerations/route.ts` (nouveau)
- `src/app/api/admin/exonerations/[id]/route.ts` (nouveau)

**Critères d'acceptation :**
- Seuls les super admins peuvent créer/supprimer des exonérations
- Le motif est obligatoire
- L'exonération temporaire a une vraie date de fin
- Audit trail correct

---

### Story 51.2 — UI page backoffice exonérations
**Assigné à :** @developer
**Dépend de :** Story 51.1
**Priorité :** Haute
**Complexité :** Moyenne
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Page backoffice : liste des exonérations (user, motif, date début, date fin, statut)
- [ ] `TODO` Formulaire création : sélection user (recherche), motif (obligatoire), durée (temporaire avec date picker ou permanente)
- [ ] `TODO` Bouton annulation avec confirmation dialog

**Fichiers impactés :**
- `src/app/(ingenieur)/admin/exonerations/page.tsx` (nouveau, ou path backoffice approprié)
- `src/components/admin/exoneration-form-dialog.tsx` (nouveau)
- `src/components/admin/exonerations-list.tsx` (nouveau)

**Critères d'acceptation :**
- Super admin uniquement (vérification permission)
- Formulaire mobile-first
- Confirmation avant annulation

---

### Story 51.3 — Test + Review Sprint 51
**Assigné à :** @tester + @code-reviewer
**Dépend de :** Stories 51.1-51.2
**Priorité :** Haute
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Tests : création exonération, annulation, vérification permissions
- [ ] `TODO` `npx vitest run` + `npm run build`
- [ ] `TODO` Review R1-R9

---

## Sprint 52 — Cleanup migration + retrait fallback

**Objectif :** Retirer les béquilles : supprimer siteId des abonnements, retirer le fallback DECOUVERTE.

**Dépend de :** Sprints 48, 49, 50, 51 (tous complétés)

---

### Story 52.1 — Schema : supprimer siteId de Abonnement + PaiementAbonnement
**Assigné à :** @db-specialist
**Priorité :** Critique
**Complexité :** Complex
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Rendre `Abonnement.siteId` nullable (si pas déjà fait)
- [ ] `TODO` Rendre `PaiementAbonnement.siteId` nullable (si pas déjà fait)
- [ ] `TODO` Migration SQL : supprimer les colonnes siteId de Abonnement et PaiementAbonnement
- [ ] `TODO` Supprimer les index obsolètes sur siteId
- [ ] `TODO` Mettre à jour les relations Prisma (supprimer la relation Site ↔ Abonnement et Site ↔ PaiementAbonnement)

**Fichiers impactés :**
- `prisma/schema.prisma`

**Critères d'acceptation :**
- `npx prisma migrate dev` passe
- Plus de référence à siteId dans Abonnement/PaiementAbonnement
- `npm run build` passe

---

### Story 52.2 — Retirer fallback DECOUVERTE + nettoyer queries
**Assigné à :** @developer
**Dépend de :** Story 52.1
**Priorité :** Haute
**Complexité :** Moyenne
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` `resolvePlanLimites()` : retirer le fallback DECOUVERTE → erreur si pas d'abonnement
- [ ] `TODO` Nettoyer toutes les queries qui référençaient `Abonnement.siteId`
- [ ] `TODO` Nettoyer les types TypeScript (supprimer siteId de l'interface Abonnement)
- [ ] `TODO` Vérifier que toutes les fonctionnalités marchent sans le fallback

**Fichiers impactés :**
- `src/lib/abonnements/check-quotas.ts`
- `src/lib/queries/abonnements.ts`
- `src/types/models.ts`

**Critères d'acceptation :**
- Plus de référence à siteId dans le code abonnement
- Un user sans abonnement reçoit une erreur claire (pas un fallback silencieux)
- `npm run build` passe

---

### Story 52.3 — Test + Review Sprint 52
**Assigné à :** @tester + @code-reviewer
**Dépend de :** Stories 52.1-52.2
**Priorité :** Haute
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Vérifier qu'aucun site ne fonctionne sans abonnement
- [ ] `TODO` `npx vitest run` + `npm run build`
- [ ] `TODO` Review R1-R9

---

## Sprint 53 — Tests intégration + Review finale

**Objectif :** Couverture de test complète et review finale du refactoring.

**Dépend de :** Sprint 52

---

### Story 53.1 — Tests unitaires : prorata, quota résolution, dépassements, audit
**Assigné à :** @tester
**Priorité :** Haute
**Complexité :** Complex
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Tests `calculerCreditRestant` : div/0, prixPaye=0, cas normaux
- [ ] `TODO` Tests `calculerDeltaUpgrade` : delta positif, négatif, zéro, avec soldeCredit
- [ ] `TODO` Tests `detecterDepassements` : sites, bacs, vagues, ressources déjà bloquées
- [ ] `TODO` Tests `logAbonnementAudit` : toutes les actions
- [ ] `TODO` Tests `getAbonnementActifPourSite` : résolution owner, site inexistant, owner sans abonnement

**Fichiers impactés :**
- `src/__tests__/lib/prorata.test.ts` (nouveau)
- `src/__tests__/lib/check-quotas-owner.test.ts` (nouveau)

---

### Story 53.2 — Tests intégration : upgrade, downgrade 3 niveaux, essai, exonération
**Assigné à :** @tester
**Priorité :** Haute
**Complexité :** Complex
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Test intégration upgrade : DECOUVERTE → ELEVEUR (delta positif), ELEVEUR annuel → PROFESSIONNEL mensuel (delta négatif → soldeCredit)
- [ ] `TODO` Test intégration downgrade : PROFESSIONNEL (3 sites, 15 bacs) → ELEVEUR (1 site, 10 bacs) — sélection 3 niveaux, CRON exécution
- [ ] `TODO` Test intégration essai : création, conversion (succès + échec paiement), essai déjà utilisé
- [ ] `TODO` Test intégration exonération : création temporaire, expiration → EN_GRACE, création permanente

**Fichiers impactés :**
- `src/__tests__/integration/subscription-upgrade.test.ts` (nouveau)
- `src/__tests__/integration/subscription-downgrade.test.ts` (nouveau)
- `src/__tests__/integration/subscription-trial.test.ts` (nouveau)
- `src/__tests__/integration/subscription-exoneration.test.ts` (nouveau)

---

### Story 53.3 — Tests non-régression + tests isBlocked
**Assigné à :** @tester
**Priorité :** Haute
**Complexité :** Moyenne
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Tests non-régression : créer bac, vague, relevé, site — tout fonctionne avec le nouveau système
- [ ] `TODO` Tests isBlocked : impossible de créer sur site/bac/vague bloqué, comptages excluent les bloqués
- [ ] `TODO` `npx vitest run` — tous les tests passent
- [ ] `TODO` `npm run build` — production OK

---

### Story 53.4 — Review finale R1-R9
**Assigné à :** @code-reviewer
**Dépend de :** Stories 53.1-53.3
**Priorité :** Critique
**Statut :** `TODO`

**Tâches :**
- [ ] `TODO` Review complète du refactoring selon checklist R1-R9
- [ ] `TODO` Vérification : aucun hard-delete d'abonnement possible
- [ ] `TODO` Vérification : onDelete: Restrict partout où nécessaire
- [ ] `TODO` Vérification : audit trail complet pour chaque transition
- [ ] `TODO` Vérification mobile-first (360px) sur toutes les nouvelles pages
- [ ] `TODO` Rapport dans `docs/reviews/review-sprint-53.md`
