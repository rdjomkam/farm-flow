# Sprints & Stories — Site & Module Management (ADR-021)

**Auteur :** @architect
**Date :** 2026-03-22
**ADR référence :** ADR-021
**Statut :** Prêt pour planification

---

## Vue d'ensemble des dépendances

```
Sprint A (Fondations DB)
  └─→ Sprint B (API Admin Sites)
        ├─→ Sprint C (UI Admin Sites)
        └─→ Sprint D (Analytics API)
              └─→ Sprint E (Analytics UI + Modules Registry)
```

Estimation totale : 4-5 sprints, dépend de la vélocité de l'équipe.

---

## Sprint A — Fondations DB & Permissions

**Objectif :** Poser les bases de données et les nouvelles permissions sans rien casser.

**Dépendances :** Aucune. Peut commencer immédiatement.

---

### Story A.1 — Schéma Prisma : ModuleDefinition + SiteAuditLog + champs Site
**Assigné à :** @db-specialist
**Priorité :** Critique

**Description :**
Ajouter les nouveaux modèles et champs au schéma Prisma, créer la migration, et seeder les données initiales.

**Tâches :**

1. Ajouter dans `prisma/schema.prisma` :
   - Modèle `ModuleDefinition` avec les champs : `id`, `key` (unique), `label`, `description`, `iconName`, `sortOrder`, `level`, `dependsOn`, `isVisible`, `isActive`, `category`, `createdAt`, `updatedAt`
   - Modèle `SiteAuditLog` avec les champs : `id`, `siteId` (FK Site), `actorId` (FK User), `action`, `details` (Json?), `createdAt`
   - Sur le modèle `Site` : ajouter `suspendedAt DateTime?`, `suspendedReason String?`, `deletedAt DateTime?`, relation `auditLogs SiteAuditLog[]`
   - Sur le modèle `User` : ajouter relation `auditLogsActed SiteAuditLog[] @relation("AuditLogActor")`
   - Index sur `SiteAuditLog` : `[siteId]`, `[actorId]`, `[createdAt]`
   - Index sur `Site` : `[deletedAt]`, `[suspendedAt]`

2. Ajouter dans l'enum `Permission` (prisma + src/types/models.ts) :
   ```
   SITES_VOIR
   SITES_GERER
   ANALYTICS_PLATEFORME
   ```

3. Générer la migration via le workflow non-interactif établi (prisma migrate diff + deploy)

4. Mettre à jour `prisma/seed.sql` avec les 12 `ModuleDefinition` :
   ```sql
   INSERT INTO "ModuleDefinition" (id, key, label, description, "iconName", "sortOrder", level, "dependsOn", "isVisible", "isActive", category, "createdAt", "updatedAt") VALUES
   (gen_random_uuid(), 'REPRODUCTION',       'Reproduction',        'Gestion des reproducteurs, pontes et lots alevins', 'FlaskConical', 1,  'site',     '{}', true, true, 'elevage',    now(), now()),
   (gen_random_uuid(), 'GROSSISSEMENT',      'Grossissement',       'Vagues, bacs, relevés et biométrie',                 'Fish',         2,  'site',     '{}', true, true, 'elevage',    now(), now()),
   (gen_random_uuid(), 'INTRANTS',           'Intrants',            'Stock, fournisseurs et approvisionnement',           'Package',      3,  'site',     '{}', true, true, 'stock',      now(), now()),
   (gen_random_uuid(), 'VENTES',             'Ventes',              'Clients, ventes, factures et paiements',             'ShoppingCart', 4,  'site',     '{}', true, true, 'commercial', now(), now()),
   (gen_random_uuid(), 'ANALYSE_PILOTAGE',   'Analyse & Pilotage',  'Analytics, planning et indicateurs KPI',             'BarChart2',    5,  'site',     '{}', true, true, 'analyse',    now(), now()),
   (gen_random_uuid(), 'PACKS_PROVISIONING', 'Packs & Provisioning','Création et activation des packs client',            'Boxes',        6,  'site',     '{}', true, true, 'plateforme', now(), now()),
   (gen_random_uuid(), 'CONFIGURATION',      'Configuration',       'Paramètres, profils d''élevage et règles',           'Settings',     7,  'site',     '{}', true, true, 'admin',      now(), now()),
   (gen_random_uuid(), 'INGENIEUR',          'Ingénieur',           'Dashboard multi-clients et monitoring',              'HardHat',      8,  'site',     '{}', true, true, 'plateforme', now(), now()),
   (gen_random_uuid(), 'NOTES',              'Notes',               'Notes et observations partagées',                    'StickyNote',   9,  'site',     '{}', true, true, 'communication', now(), now()),
   (gen_random_uuid(), 'ABONNEMENTS',        'Abonnements',         'Gestion des abonnements et plans tarifaires',        'CreditCard',   10, 'platform', '{}', true, true, 'plateforme', now(), now()),
   (gen_random_uuid(), 'COMMISSIONS',        'Commissions',         'Commissions ingénieurs et portefeuilles',            'TrendingUp',   11, 'platform', '{}', true, true, 'plateforme', now(), now()),
   (gen_random_uuid(), 'REMISES',            'Remises',             'Codes promotionnels et remises',                     'Tag',          12, 'platform', '{}', true, true, 'plateforme', now(), now());
   ```

**Critères d'acceptation :**
- `npx prisma migrate deploy` passe sans erreur
- `npm run db:seed` insère les 12 `ModuleDefinition` sans erreur
- Les 3 nouvelles permissions existent dans l'enum `Permission` TS et Prisma
- Les champs `suspendedAt`, `suspendedReason`, `deletedAt` existent sur `Site` (nullable)
- Les modèles `ModuleDefinition` et `SiteAuditLog` ont leurs index
- Règle R1 : toutes les nouvelles valeurs d'enum en UPPERCASE

---

### Story A.2 — TypeScript : interfaces et DTOs
**Assigné à :** @architect
**Priorité :** Critique
**Dépend de :** A.1 (schéma Prisma doit être validé avant de définir les types)

**Description :**
Étendre `src/types/models.ts` et `src/types/api.ts` avec toutes les nouvelles interfaces.

**Tâches :**

1. Dans `src/types/models.ts` :
   - Ajouter `SITES_VOIR = "SITES_VOIR"`, `SITES_GERER = "SITES_GERER"`, `ANALYTICS_PLATEFORME = "ANALYTICS_PLATEFORME"` dans l'enum `Permission`
   - Ajouter enum TypeScript `SiteStatus { ACTIVE = "ACTIVE", SUSPENDED = "SUSPENDED", BLOCKED = "BLOCKED", ARCHIVED = "ARCHIVED" }`
   - Ajouter interface `ModuleDefinition` (miroir du modèle Prisma)
   - Ajouter interface `SiteAuditLog` (miroir du modèle Prisma)
   - Étendre l'interface `Site` avec `suspendedAt: Date | null`, `suspendedReason: string | null`, `deletedAt: Date | null`

2. Dans `src/types/api.ts` :
   - Ajouter `AdminSiteSummary` (voir ADR-021 section 3.1)
   - Ajouter `AdminSitesListResponse`
   - Ajouter `AdminSiteDetailResponse` (voir ADR-021 section 3.2)
   - Ajouter `SiteStatusUpdateDTO` et `SiteStatusUpdateResponse`
   - Ajouter `AdminSiteModulesUpdateDTO` et `AdminSiteModulesUpdateResponse`
   - Ajouter `AdminAnalyticsResponse` (voir ADR-021 section 3.5)
   - Ajouter `AdminAnalyticsSitesResponse`
   - Ajouter `ModuleDefinitionResponse` et `AdminModulesListResponse`

3. Dans `src/lib/permissions-constants.ts` :
   - Ajouter `SITES_VOIR`, `SITES_GERER`, `ANALYTICS_PLATEFORME` dans `PLATFORM_PERMISSIONS`
   - Ajouter dans `PERMISSION_GROUPS` un groupe `adminPlateforme`
   - Ajouter dans `ITEM_VIEW_PERMISSIONS` : `/admin/sites` → `SITES_VOIR`, `/admin/analytics` → `ANALYTICS_PLATEFORME`, `/admin/modules` → `SITES_GERER`

4. Dans `src/lib/site-modules-config.ts` :
   - Ajouter la fonction utilitaire `computeSiteStatus(site: Pick<Site, 'isActive' | 'suspendedAt' | 'deletedAt'>): SiteStatus`

**Critères d'acceptation :**
- Aucun `any` dans les types
- `npm run build` passe (pas de régression TypeScript)
- `computeSiteStatus()` est pur et testé (voir Story A.3)
- Tous les DTOs ont les champs obligatoires et optionnels bien marqués
- Règle R2 : toutes les valeurs d'enum utilisées via l'enum importé, jamais comme string litéral

---

### Story A.3 — Tests unitaires pour computeSiteStatus et permissions
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** A.2

**Description :**
Écrire les tests unitaires pour les nouvelles fonctions utilitaires.

**Tâches :**

1. Créer `src/__tests__/lib/site-status.test.ts` :
   - `computeSiteStatus({ isActive: true, suspendedAt: null, deletedAt: null })` → `ACTIVE`
   - `computeSiteStatus({ isActive: true, suspendedAt: new Date(), deletedAt: null })` → `SUSPENDED`
   - `computeSiteStatus({ isActive: false, suspendedAt: null, deletedAt: null })` → `BLOCKED`
   - `computeSiteStatus({ isActive: false, suspendedAt: null, deletedAt: new Date() })` → `ARCHIVED`

2. Créer `src/__tests__/lib/platform-permissions.test.ts` :
   - Vérifier que `SITES_VOIR`, `SITES_GERER`, `ANALYTICS_PLATEFORME` sont dans `PLATFORM_PERMISSIONS`
   - Vérifier que ces permissions ne sont PAS dans les groupes de permissions assignables sur sites non-plateforme

3. `npx vitest run` — tous les tests passent

**Critères d'acceptation :**
- 100% de couverture sur `computeSiteStatus()`
- Les tests de permissions passent
- Aucune régression sur les tests existants

---

### Story A.4 — Review Sprint A
**Assigné à :** @code-reviewer
**Dépend de :** A.1, A.2, A.3

**Tâches :**
- Vérifier cohérence schéma Prisma ↔ interfaces TypeScript (R3)
- Vérifier R1 (UPPERCASE), R2 (imports enums), R7 (nullabilité explicite), R8 (siteId absent intentionnel sur ModuleDefinition — exception documentée)
- Vérifier que `npx prisma migrate deploy` + `npm run build` + `npx vitest run` passent tous
- Écrire `docs/reviews/review-sprint-A-site-module.md`

---

## Sprint B — API Admin Sites

**Objectif :** Implémenter toutes les API routes pour la gestion admin des sites.

**Dépendances :** Sprint A entièrement validé.

---

### Story B.1 — Queries admin sites
**Assigné à :** @db-specialist
**Priorité :** Critique

**Description :**
Créer `src/lib/queries/admin-sites.ts` avec toutes les queries nécessaires aux pages admin.

**Tâches :**

1. Créer `src/lib/queries/admin-sites.ts` :

   ```typescript
   // getAdminSites — liste paginée avec filtres
   export async function getAdminSites(params: {
     page: number;
     limit: number;
     search?: string;
     status?: SiteStatus;
     planId?: string;
     hasModule?: SiteModule;
   }): Promise<{ sites: AdminSiteRow[]; total: number }>

   // getAdminSiteById — détail complet d'un site pour l'admin
   export async function getAdminSiteById(siteId: string): Promise<AdminSiteDetail | null>

   // updateSiteStatus — suspend/block/restore/archive
   // R4 : opération atomique dans une transaction
   export async function updateSiteStatus(
     siteId: string,
     actorId: string,
     action: "SUSPEND" | "BLOCK" | "RESTORE" | "ARCHIVE",
     reason?: string
   ): Promise<Site>

   // updateSiteModulesAdmin — modification des modules par la plateforme
   export async function updateSiteModulesAdmin(
     siteId: string,
     actorId: string,
     enabledModules: SiteModule[],
     reason?: string
   ): Promise<Site>

   // getSiteAuditLog — journal d'audit d'un site
   export async function getSiteAuditLog(siteId: string, limit?: number): Promise<SiteAuditLogRow[]>
   ```

2. `updateSiteStatus` doit :
   - Vérifier que le site n'est pas `isPlatform` (ne peut pas suspendre/bloquer la plateforme)
   - Effectuer les updates dans une `$transaction` (mise à jour Site + insertion SiteAuditLog)
   - Pour ARCHIVE : vérifier `confirmArchive` dans les params
   - Pour RESTORE : remettre `isActive = true`, `suspendedAt = null`, `suspendedReason = null`

3. Les queries doivent inclure `computeSiteStatus()` dans la sélection pour calculer le statut calculé

**Critères d'acceptation :**
- Toutes les fonctions retournent les types TypeScript définis en Story A.2
- R4 : `updateSiteStatus` utilise `$transaction`
- Un site `isPlatform = true` ne peut pas être suspendu/bloqué/archivé (erreur levée)
- `getSiteAuditLog` retourne les entrées ordonnées par `createdAt DESC`

---

### Story B.2 — API route GET /api/admin/sites
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** B.1

**Description :**
Implémenter la route de liste des sites pour les admins plateforme.

**Tâches :**

1. Créer `src/app/api/admin/sites/route.ts` :
   - `GET /api/admin/sites` avec query params : `page`, `limit`, `search`, `status`, `planId`, `hasModule`
   - Guard : `requireAuth` + vérifier permission `SITES_VOIR` (depuis `getServerPermissions`)
   - Guard : vérifier que `session.activeSiteId` est un site `isPlatform = true` (sinon 403)
   - Appelle `getAdminSites()` depuis `lib/queries/admin-sites.ts`
   - Réponse conforme à `AdminSitesListResponse`
   - En-têtes `Cache-Control: private, max-age=60` (données sensibles, cache court)

2. Validation des query params :
   - `page` : entier >= 1, défaut 1
   - `limit` : entier entre 1 et 100, défaut 20
   - `status` : valeur de `SiteStatus` ou undefined
   - `hasModule` : valeur de `SiteModule` ou undefined

**Critères d'acceptation :**
- 403 si l'utilisateur n'a pas `SITES_VOIR`
- 403 si le site actif n'est pas la plateforme
- Réponse paginée correcte
- Les stats (totalActive, totalSuspended...) sont toujours renvoyées même avec filtres actifs

---

### Story B.3 — API route GET /api/admin/sites/[id]
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** B.1

**Description :**
Route de détail d'un site pour les admins plateforme.

**Tâches :**

1. Créer `src/app/api/admin/sites/[id]/route.ts` :
   - `GET /api/admin/sites/[id]`
   - Guards identiques à B.2 (`SITES_VOIR` + `isPlatform`)
   - 404 si site introuvable
   - Appelle `getAdminSiteById()` depuis `lib/queries/admin-sites.ts`
   - Réponse conforme à `AdminSiteDetailResponse`

**Critères d'acceptation :**
- 404 si site inexistant
- 403 si non autorisé
- Les `recentAuditLogs` (10 derniers) sont inclus
- Les membres avec leur rôle sont inclus
- L'abonnement actif (si existant) est inclus avec sérialisation des `Decimal`

---

### Story B.4 — API route PATCH /api/admin/sites/[id]/status
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** B.1

**Description :**
Route de changement de statut d'un site (suspend/block/restore/archive).

**Tâches :**

1. Créer `src/app/api/admin/sites/[id]/status/route.ts` :
   - `PATCH /api/admin/sites/[id]/status`
   - Guard : `SITES_GERER` + `isPlatform`
   - Valider le body : `action` obligatoire dans `["SUSPEND", "BLOCK", "RESTORE", "ARCHIVE"]`
   - `reason` obligatoire pour `SUSPEND` et `BLOCK`
   - `confirmArchive: true` obligatoire pour `ARCHIVE`
   - Appelle `updateSiteStatus()` dans une transaction
   - Réponse conforme à `SiteStatusUpdateResponse`

2. Invalidation des sessions actives lors d'un BLOCK :
   - Supprimer (ou invalider via `expires`) toutes les `Session` où `activeSiteId = siteId`
   - Utiliser `prisma.session.updateMany({ where: { activeSiteId: siteId }, data: { expires: new Date() } })`
   - Inclure cette opération dans la même transaction

**Critères d'acceptation :**
- Impossible de modifier le statut du site plateforme (`isPlatform = true`) → 403 avec message explicite
- `reason` manquant pour SUSPEND/BLOCK → 400
- `confirmArchive` manquant pour ARCHIVE → 400
- Transaction atomique : si l'audit log échoue, le statut n'est pas changé (R4)
- Les sessions actives du site bloqué sont invalidées
- Le journal d'audit contient `before` et `after` dans `details`

---

### Story B.5 — API route PATCH /api/admin/sites/[id]/modules
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** B.1

**Description :**
Route de modification des modules d'un site par l'admin plateforme.

**Tâches :**

1. Créer `src/app/api/admin/sites/[id]/modules/route.ts` :
   - `PATCH /api/admin/sites/[id]/modules`
   - Guard : `SITES_GERER` + `isPlatform`
   - Valider `enabledModules` : tableau de valeurs `SiteModule` valides
   - Rejeter les modules `platform-level` dans `enabledModules` (ABONNEMENTS, COMMISSIONS, REMISES) → 400
   - Appelle `updateSiteModulesAdmin()` avec audit log
   - Réponse conforme à `AdminSiteModulesUpdateResponse`

**Critères d'acceptation :**
- Les modules platform-level sont refusés (ne peuvent pas être dans `enabledModules`)
- L'audit log enregistre les modules avant et après
- 400 si `enabledModules` contient des valeurs invalides

---

### Story B.6 — Tests API admin sites
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** B.2, B.3, B.4, B.5

**Description :**
Tests d'intégration pour toutes les nouvelles routes API admin.

**Tâches :**

1. Créer `src/__tests__/api/admin-sites.test.ts` :
   - GET `/api/admin/sites` : 401 sans auth, 403 si non plateforme, 200 avec pagination
   - GET `/api/admin/sites/[id]` : 404 si inexistant, 200 avec structure complète
   - PATCH `/api/admin/sites/[id]/status` : SUSPEND OK, BLOCK OK avec invalidation sessions, protection isPlatform
   - PATCH `/api/admin/sites/[id]/modules` : refus platform modules, audit log créé
   - Mock Prisma (pattern existant dans les tests actuels)

2. `npx vitest run src/__tests__/api/admin-sites.test.ts` — tous passent

**Critères d'acceptation :**
- Couverture des cas de succès et d'erreur pour chaque route
- Vérification que l'audit log est créé pour chaque mutation
- Vérification de la protection du site plateforme

---

### Story B.7 — Review Sprint B
**Assigné à :** @code-reviewer
**Dépend de :** B.1 — B.6

**Tâches :**
- Vérifier toutes les routes contre la checklist R1-R9
- Vérifier protection SITES_VOIR / SITES_GERER sur chaque route
- Vérifier protection du site plateforme (isPlatform)
- Vérifier R4 (transactions atomiques) sur les mutations
- `npm run build` + `npx vitest run` passent
- Écrire `docs/reviews/review-sprint-B-admin-sites-api.md`

---

## Sprint C — UI Admin Sites

**Objectif :** Pages admin pour voir et gérer les sites côté plateforme DKFarm.

**Dépendances :** Sprint B validé.

---

### Story C.1 — Navigation : module "Admin Plateforme"
**Assigné à :** @developer
**Priorité :** Haute

**Description :**
Mettre à jour la sidebar et le hamburger menu pour inclure les nouvelles routes admin.

**Tâches :**

1. Dans `src/components/layout/sidebar.tsx` :
   - Renommer le module `"Admin Abonnements"` en `"Admin Plateforme"` (moduleKey: `"adminPlateforme"`)
   - Ajouter les items : `/admin/sites` (icône `Building2`), `/admin/analytics` (icône `BarChart3`), `/admin/modules` (icône `Boxes`)
   - Conserver les items existants : `/admin/abonnements`, `/admin/plans`, `/admin/commissions`, `/admin/remises`
   - Gate permission : `ABONNEMENTS_GERER` (inchangé pour l'accès au module)
   - Items `/admin/sites` et `/admin/analytics` gatés par `SITES_VOIR` via `ITEM_VIEW_PERMISSIONS`
   - Item `/admin/modules` gaté par `SITES_GERER`

2. Mettre à jour `src/components/layout/hamburger-menu.tsx` avec les mêmes changements

3. Mettre à jour `src/components/layout/bottom-nav.tsx` si applicable

4. Mettre à jour les fichiers de traductions i18n pour les nouvelles clés :
   - `navigation.modules.adminPlateforme`
   - `navigation.items.sites`, `navigation.items.analytics`, `navigation.items.modules`

**Critères d'acceptation :**
- Les nouvelles routes apparaissent dans la nav uniquement pour les utilisateurs avec les bonnes permissions
- Mobile first : vérification sur 360px (hamburger menu)
- Aucune régression sur les tests de navigation existants (responsive.test.tsx)

---

### Story C.2 — Page /admin/sites (liste)
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** B.2, C.1

**Description :**
Page liste des sites avec filtres et stats.

**Tâches :**

1. Créer `src/app/admin/sites/page.tsx` (Server Component) :
   - Guard : `checkPagePermission(session, Permission.SITES_VOIR)` + `isPlatformSite(session.activeSiteId)`
   - Si non plateforme → redirect(`/`)
   - Charger données via `getAdminSites()` (page 1, limit 20)
   - Passer à `AdminSitesList`

2. Créer `src/app/admin/sites/loading.tsx`

3. Créer `src/components/admin/sites/admin-sites-list.tsx` ("use client") :
   - **Mobile (360px)** : cartes empilées avec badge statut coloré
     - Vert : ACTIVE, Orange : SUSPENDED, Rouge : BLOCKED, Gris : ARCHIVED
   - **Desktop (md+)** : tableau avec colonnes : Nom | Statut | Plan | Modules | Membres | Actions
   - Filtres :
     - Tabs Radix : Tous / Actifs / Suspendus / Bloqués / Archivés
     - Input de recherche (debounce 300ms)
     - Select Radix pour filtrer par plan
   - Cards KPI au-dessus de la liste : Sites actifs | Suspendus | Bloqués | Nouveaux (30j)
   - Pagination : boutons Précédent/Suivant + numéro de page
   - Bouton "Gérer" → `/admin/sites/[id]`
   - Bouton "Suspendre" rapide → ouvre `AdminSiteStatusDialog`

4. Créer `src/components/admin/sites/admin-site-status-badge.tsx` :
   - Badge coloré pour chaque statut
   - Utilise `computeSiteStatus()` si le statut n'est pas pré-calculé

5. Créer `src/components/admin/sites/admin-site-status-dialog.tsx` ("use client", Radix Dialog) :
   - Formulaire : sélection action, champ raison, checkbox confirmation pour ARCHIVE
   - Submit : PATCH `/api/admin/sites/[id]/status`
   - Toast Radix en succès/erreur
   - R5 : `<DialogTrigger asChild>`

**Critères d'acceptation :**
- Mobile first : liste en cartes sur 360px (pas de tableau)
- Les stats sont affichées en cartes au-dessus de la liste
- Filtres par statut fonctionnels
- Le bouton "Suspendre" ne s'affiche pas pour le site plateforme
- Après action, la liste se rafraîchit (router.refresh() ou invalidation TanStack Query)

---

### Story C.3 — Page /admin/sites/[id] (détail)
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** B.3, B.4, B.5, C.2

**Description :**
Page de détail d'un site côté admin plateforme.

**Tâches :**

1. Créer `src/app/admin/sites/[id]/page.tsx` (Server Component) :
   - Guard : `checkPagePermission(session, Permission.SITES_VOIR)` + `isPlatformSite`
   - Charger `getAdminSiteById(id)` — 404 si null
   - Passer à `AdminSiteDetailClient`

2. Créer `src/app/admin/sites/[id]/loading.tsx`

3. Créer `src/components/admin/sites/admin-site-detail-client.tsx` ("use client") :
   - Tabs Radix (R5 : TabsTrigger) : Résumé | Modules | Membres | Abonnement | Audit
   - **Onglet Résumé :**
     - Infos : nom, adresse, type (Plateforme / Client supervisé / Standard), dates création
     - Badge statut large et coloré
     - Boutons d'action : Suspendre / Bloquer / Restaurer / Archiver (selon statut actuel)
     - Compteurs : bacs, vagues, membres, relevés
   - **Onglet Modules :**
     - `AdminSiteModulesEditor`
   - **Onglet Membres :**
     - Liste des membres avec rôle et statut
     - Lien vers `/settings/sites/[id]` pour gestion fine
   - **Onglet Abonnement :**
     - Détail de l'abonnement actif (plan, période, dates, statut)
     - Lien vers `/admin/abonnements` filtré par ce site
     - Badge statut abonnement (en grâce, expiré, etc.)
   - **Onglet Audit :**
     - Timeline des dernières actions (50 entrées)
     - Filtre par type d'action

4. Créer `src/components/admin/sites/admin-site-modules-editor.tsx` ("use client") :
   - Affiche tous les modules disponibles (via `/api/admin/modules`)
   - Switch Radix par module
   - Modules platform-level grisés et non-modifiables (avec tooltip explicatif)
   - Bouton "Appliquer les modules du plan" si abonnement actif
   - Bouton "Sauvegarder" → PATCH `/api/admin/sites/[id]/modules`
   - Champ raison optionnel pour l'audit

5. Créer `src/components/admin/sites/admin-site-audit-log.tsx` :
   - Timeline verticale des entrées `SiteAuditLog`
   - Chaque entrée : date, acteur, action (badge coloré), détails expandables (before/after)
   - Actions colorées : SITE_SUSPENDED (orange), SITE_BLOCKED (rouge), SITE_RESTORED (vert), MODULE_UPDATED (bleu)

**Critères d'acceptation :**
- Navigation par onglets fonctionnelle sur mobile
- L'éditeur de modules ne permet pas de modifier le site plateforme (affichage en lecture seule)
- Le journal d'audit affiche les infos before/after de façon lisible
- Toast de confirmation après chaque action

---

### Story C.4 — Tests UI admin sites
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** C.2, C.3

**Tâches :**
1. Tests Vitest pour `AdminSiteStatusDialog` : validation formulaire (raison requise pour SUSPEND/BLOCK)
2. Tests pour `computeSiteStatus()` dans les composants badge
3. Tests responsive : cartes 360px vs tableau md+ (`responsive.test.tsx` pattern existant)
4. `npx vitest run` + `npm run build` passent

---

### Story C.5 — Review Sprint C
**Assigné à :** @code-reviewer
**Dépend de :** C.1 — C.4

**Tâches :**
- Vérification mobile first (360px)
- R5 : tous les DialogTrigger sont asChild
- R6 : CSS variables uniquement pour les couleurs des badges statut
- Accessibilité : aria-label sur les boutons d'action
- `npm run build` + `npx vitest run` passent
- Écrire `docs/reviews/review-sprint-C-admin-sites-ui.md`

---

## Sprint D — Analytics API & Queries

**Objectif :** Implémenter les endpoints d'analytics plateforme.

**Dépendances :** Sprint A validé. Peut commencer en parallèle de Sprint C.

---

### Story D.1 — Queries analytics plateforme
**Assigné à :** @db-specialist
**Priorité :** Haute

**Description :**
Créer `src/lib/queries/admin-analytics.ts` avec toutes les agrégations nécessaires.

**Tâches :**

1. Créer `src/lib/queries/admin-analytics.ts` :

   ```typescript
   // getPlatformKPIs — calcul de tous les KPIs plateforme
   export async function getPlatformKPIs(): Promise<AdminAnalyticsResponse>

   // getSitesGrowth — évolution du nombre de sites dans le temps
   export async function getSitesGrowth(
     periode: "7d" | "30d" | "90d" | "12m"
   ): Promise<AdminAnalyticsSitesResponse>

   // getRevenueAnalytics — revenus par période et par plan
   export async function getRevenueAnalytics(
     periode: "30d" | "90d" | "12m"
   ): Promise<RevenueAnalyticsResponse>

   // getModulesDistribution — combien de sites ont chaque module
   export async function getModulesDistribution(): Promise<ModulesDistributionResponse>
   ```

2. `getPlatformKPIs()` doit calculer en une seule passe (parallélisme `Promise.all`) :
   - Sites actifs / suspendus / bloqués (`groupBy + count`)
   - Sites créés dans les 30 derniers jours
   - Abonnements par statut (`groupBy statut`)
   - MRR estimé : pour chaque abonnement `ACTIF`, ramener le prix à un équivalent mensuel selon la période
   - Ingénieurs avec membres supervisés actifs
   - Retraits portefeuille en statut `EN_ATTENTE`

3. `getModulesDistribution()` utilise un agrégat sur `Site.enabledModules` :
   - PostgreSQL `unnest()` pour exploser le tableau et compter par valeur
   - Utiliser `prisma.$queryRaw` pour cette requête spécifique (pas de support Prisma ORM pour unnest)

**Critères d'acceptation :**
- Toutes les fonctions retournent les types définis en A.2
- `getModulesDistribution()` utilise `$queryRaw` correctement avec paramétrage sûr
- MRR = `prixMensuel * count(mensuel)` + `prixTrimestriel/3 * count(trimestriel)` + `prixAnnuel/12 * count(annuel)`
- Performance : toutes les queries doivent s'exécuter en < 2s sur les données de test

---

### Story D.2 — API routes analytics
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** D.1

**Description :**
Implémenter les 4 endpoints analytics.

**Tâches :**

1. Créer `src/app/api/admin/analytics/route.ts` :
   - `GET /api/admin/analytics`
   - Guard : `ANALYTICS_PLATEFORME` + `isPlatform`
   - Appelle `getPlatformKPIs()`
   - `Cache-Control: private, max-age=300` (5 minutes — acceptable pour KPIs)

2. Créer `src/app/api/admin/analytics/sites/route.ts` :
   - `GET /api/admin/analytics/sites?periode=30d`
   - Guard : `ANALYTICS_PLATEFORME` + `isPlatform`
   - Appelle `getSitesGrowth(periode)`
   - `Cache-Control: private, max-age=3600`

3. Créer `src/app/api/admin/analytics/revenus/route.ts` :
   - `GET /api/admin/analytics/revenus?periode=12m`
   - Guard : `ANALYTICS_PLATEFORME` + `isPlatform`
   - Appelle `getRevenueAnalytics(periode)`
   - `Cache-Control: private, max-age=3600`

4. Créer `src/app/api/admin/analytics/modules/route.ts` :
   - `GET /api/admin/analytics/modules`
   - Guard : `ANALYTICS_PLATEFORME` + `isPlatform`
   - Appelle `getModulesDistribution()`
   - `Cache-Control: private, max-age=3600`

**Critères d'acceptation :**
- 403 si non-plateforme ou permission manquante
- Sérialisation des `Decimal` → `number` (R3)
- En-têtes `Cache-Control` présents sur toutes les routes

---

### Story D.3 — API routes registre modules
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** Sprint A

**Description :**
CRUD pour le registre `ModuleDefinition`.

**Tâches :**

1. Créer `src/app/api/admin/modules/route.ts` :
   - `GET /api/admin/modules` : Guard `SITES_VOIR`, liste tous les `ModuleDefinition` avec stats calculées (siteCount, planCount)
   - `POST /api/admin/modules` : Guard `SITES_GERER`, créer une définition (key unique)

2. Créer `src/app/api/admin/modules/[key]/route.ts` :
   - `GET /api/admin/modules/[key]` : Guard `SITES_VOIR`, détail d'un module
   - `PUT /api/admin/modules/[key]` : Guard `SITES_GERER`, modifier label/description/iconName/sortOrder/isVisible/isActive/category

3. Note : la clé `key` correspond à une valeur de l'enum `SiteModule`. Validation : la valeur doit exister dans `Object.values(SiteModule)`.

**Critères d'acceptation :**
- Impossible de modifier le champ `key` (immuable)
- Impossible de changer `level` (site↔platform) via API — c'est une contrainte architecturale
- `siteCount` et `planCount` sont calculés dynamiquement

---

### Story D.4 — Tests API analytics
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** D.2, D.3

**Tâches :**
1. Créer `src/__tests__/api/admin-analytics.test.ts`
2. Mock Prisma pour `getPlatformKPIs` — vérifier structure de réponse
3. Test de la protection `isPlatform` sur toutes les routes
4. Test du calcul MRR avec données mockées
5. `npx vitest run` passe

---

### Story D.5 — Review Sprint D
**Assigné à :** @code-reviewer
**Dépend de :** D.1 — D.4

**Tâches :**
- Vérifier la protection `isPlatform` sur chaque route analytics
- Vérifier le calcul MRR (formule correcte, sérialisation Decimal)
- `npm run build` + `npx vitest run` passent
- Écrire `docs/reviews/review-sprint-D-analytics-api.md`

---

## Sprint E — Analytics UI & Registre Modules

**Objectif :** Dashboard analytics plateforme et page de gestion des modules.

**Dépendances :** Sprint D validé.

---

### Story E.1 — Page /admin/analytics (dashboard KPIs)
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** D.2

**Description :**
Dashboard analytics plateforme avec KPIs et graphiques.

**Tâches :**

1. Créer `src/app/admin/analytics/page.tsx` (Server Component) :
   - Guard : `checkPagePermission(session, Permission.ANALYTICS_PLATEFORME)` + `isPlatformSite`
   - Charger les KPIs en parallèle : `getPlatformKPIs()` + `getSitesGrowth("30d")` + `getModulesDistribution()`
   - `export const revalidate = 300` (ISR 5 minutes)

2. Créer `src/app/admin/analytics/loading.tsx`

3. Créer `src/components/admin/analytics/admin-kpi-cards.tsx` :
   - 6 cartes mobile first : 2 cols → 3 cols → 6 cols
   - Cartes : Sites actifs, Abonnements actifs, MRR estimé (XAF), Ingénieurs actifs, Commissions en attente, Sites créés 30j
   - Formatage XAF via `Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF" })`
   - Badge de tendance si données disponibles (ex: "+3 ce mois")

4. Créer `src/components/admin/analytics/admin-sites-growth-chart.tsx` ("use client", Recharts) :
   - LineChart : axe X dates, axe Y nombre de sites
   - Sélecteur de période (7d/30d/90d/12m) qui refetch via TanStack Query
   - Responsive via `ResponsiveContainer`

5. Créer `src/components/admin/analytics/admin-modules-distribution.tsx` ("use client", Recharts) :
   - BarChart horizontal : modules triés par popularité
   - Affiche le % de sites et le nombre absolu
   - Couleur par `level` (site vs platform)

6. Créer `src/components/admin/analytics/admin-revenue-chart.tsx` ("use client", Recharts) :
   - BarChart : revenus par mois sur la période sélectionnée
   - Ligne superposée pour le MRR estimé
   - Sélecteur 30d / 90d / 12m

**Critères d'acceptation :**
- Mobile first : 2 colonnes de KPI cards sur 360px
- Les graphiques Recharts sont responsifs (ResponsiveContainer)
- Le dashboard se charge en < 3s sur les données de test
- Sélecteurs de période fonctionnels avec rechargement des données

---

### Story E.2 — Page /admin/modules (registre)
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** D.3

**Description :**
Page de gestion du registre des modules.

**Tâches :**

1. Créer `src/app/admin/modules/page.tsx` (Server Component) :
   - Guard : `checkPagePermission(session, Permission.SITES_GERER)` + `isPlatformSite`
   - Charger les modules depuis `/api/admin/modules`

2. Créer `src/app/admin/modules/loading.tsx`

3. Créer `src/components/admin/modules/admin-modules-list.tsx` ("use client") :
   - Tableau/cartes des modules avec : clé (badge), label, level badge (site/platform), siteCount, isVisible, isActive
   - Bouton d'édition par ligne → `AdminModuleFormDialog`
   - Filtres : Tous / Visibles / Masqués | Tous / Site / Platform

4. Créer `src/components/admin/modules/admin-module-form-dialog.tsx` ("use client", Radix Dialog) :
   - Formulaire d'édition (pas de création via UI — les modules sont définis par migration)
   - Champs modifiables : label, description, iconName, sortOrder, isVisible, isActive, category
   - Champs non-modifiables : key, level (affichés en lecture seule)
   - R5 : `<DialogTrigger asChild>`
   - Submit : PUT `/api/admin/modules/[key]`

**Note :** La création de nouveaux modules est intentionnellement absente de l'UI initiale. Les modules sont créés par migration de schéma (ajout à l'enum `SiteModule`) + entrée en seed. Le registre `ModuleDefinition` sert à gérer les métadonnées et la visibilité.

**Critères d'acceptation :**
- Les champs `key` et `level` ne sont pas modifiables
- Toggle `isVisible` fonctionne immédiatement (optimistic update)
- Mobile first : cartes sur 360px

---

### Story E.3 — Tests UI analytics et modules
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** E.1, E.2

**Tâches :**
1. Tests Vitest pour `AdminKpiCards` : vérification du formatage XAF
2. Tests pour `AdminModuleFormDialog` : validation que key/level ne sont pas modifiables
3. Tests responsive pour les pages analytics et modules
4. `npm run build` + `npx vitest run` passent

---

### Story E.4 — Review Sprint E (Review finale)
**Assigné à :** @code-reviewer
**Dépend de :** E.1, E.2, E.3

**Tâches :**
- Review complète des 4 sprints (A, B, C, D, E) — vérification de cohérence globale
- Vérifier que les queries admin ne filtrent PAS par `activeSiteId` (l'admin voit tout)
- Vérifier la protection `isPlatform` est uniforme sur TOUTES les routes admin nouvelles
- Vérifier mobile first sur toutes les nouvelles pages
- Vérifier R1-R9 pour tous les fichiers créés/modifiés
- Test manuel sur les données de seed
- `npm run build` + `npx vitest run` passent sans erreur ni warning
- Écrire `docs/reviews/review-sprint-E-site-module-mgmt-final.md`

---

## Résumé des livrables

### Fichiers créés

**DB & Types :**
- `prisma/schema.prisma` — modèles `ModuleDefinition`, `SiteAuditLog`, champs sur `Site`, permissions
- `prisma/seed.sql` — 12 entrées `ModuleDefinition`
- `src/types/models.ts` — `SiteStatus`, `ModuleDefinition`, `SiteAuditLog`, extensions `Site` et `Permission`
- `src/types/api.ts` — tous les nouveaux DTOs admin

**Lib / Queries :**
- `src/lib/queries/admin-sites.ts`
- `src/lib/queries/admin-analytics.ts`
- `src/lib/site-modules-config.ts` — ajout `computeSiteStatus()`
- `src/lib/permissions-constants.ts` — nouvelles permissions et routes

**API routes :**
- `src/app/api/admin/sites/route.ts`
- `src/app/api/admin/sites/[id]/route.ts`
- `src/app/api/admin/sites/[id]/status/route.ts`
- `src/app/api/admin/sites/[id]/modules/route.ts`
- `src/app/api/admin/analytics/route.ts`
- `src/app/api/admin/analytics/sites/route.ts`
- `src/app/api/admin/analytics/revenus/route.ts`
- `src/app/api/admin/analytics/modules/route.ts`
- `src/app/api/admin/modules/route.ts`
- `src/app/api/admin/modules/[key]/route.ts`

**Pages :**
- `src/app/admin/sites/page.tsx` + `loading.tsx`
- `src/app/admin/sites/[id]/page.tsx` + `loading.tsx`
- `src/app/admin/analytics/page.tsx` + `loading.tsx`
- `src/app/admin/modules/page.tsx` + `loading.tsx`

**Composants :**
- `src/components/admin/sites/admin-sites-list.tsx`
- `src/components/admin/sites/admin-site-status-badge.tsx`
- `src/components/admin/sites/admin-site-detail-client.tsx`
- `src/components/admin/sites/admin-site-status-dialog.tsx`
- `src/components/admin/sites/admin-site-modules-editor.tsx`
- `src/components/admin/sites/admin-site-audit-log.tsx`
- `src/components/admin/analytics/admin-kpi-cards.tsx`
- `src/components/admin/analytics/admin-sites-growth-chart.tsx`
- `src/components/admin/analytics/admin-modules-distribution.tsx`
- `src/components/admin/analytics/admin-revenue-chart.tsx`
- `src/components/admin/modules/admin-modules-list.tsx`
- `src/components/admin/modules/admin-module-form-dialog.tsx`

**Tests :**
- `src/__tests__/lib/site-status.test.ts`
- `src/__tests__/lib/platform-permissions.test.ts`
- `src/__tests__/api/admin-sites.test.ts`
- `src/__tests__/api/admin-analytics.test.ts`

**Fichiers modifiés :**
- `src/components/layout/sidebar.tsx`
- `src/components/layout/hamburger-menu.tsx`

### Nouvelles permissions plateforme

| Permission | Qui | Quoi |
|-----------|-----|------|
| `SITES_VOIR` | Admin plateforme | Lire la liste et le détail de tous les sites |
| `SITES_GERER` | Admin plateforme | Suspendre, bloquer, archiver, modifier les modules |
| `ANALYTICS_PLATEFORME` | Admin plateforme | Accéder aux KPIs et analytics consolidés |

Ces 3 permissions sont dans `PLATFORM_PERMISSIONS` et ne peuvent pas être assignées sur des sites non-plateforme.

### Contraintes cross-cutting (à respecter dans toutes les stories)

1. **Protection isPlatform :** Toutes les routes `/api/admin/*` (nouveaux endpoints) vérifient que `session.activeSiteId` est un `isPlatform = true`. Sans cette vérification, un admin d'un site client pourrait accéder aux données de tous les autres sites.

2. **Aucun filtre siteId sur les queries admin :** Les admins plateforme voient tous les sites. Les queries dans `admin-sites.ts` et `admin-analytics.ts` ne doivent PAS filtrer par `activeSiteId`.

3. **SiteAuditLog systématique :** Toute mutation sur un site depuis les routes admin (changement de statut, modification de modules) DOIT créer une entrée dans `SiteAuditLog` dans la même transaction.

4. **Protection du site plateforme :** Le site avec `isPlatform = true` ne peut pas être suspendu, bloqué ou archivé. Cette protection est vérifiée dans la query (`updateSiteStatus`) ET dans la route API.

5. **Modules platform-level immuables :** `ABONNEMENTS`, `COMMISSIONS`, `REMISES` ne peuvent pas être dans `Site.enabledModules` des sites non-plateforme. La route PATCH `/api/admin/sites/[id]/modules` filtre ces valeurs.
