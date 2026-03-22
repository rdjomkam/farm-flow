# ADR-022 — Stories de migration : Backoffice Separation

**ADR :** ADR-022-backoffice-separation.md
**Date :** 2026-03-22
**Auteur :** @architect
**Statut :** Prêt pour planification

---

## Principes d'ordonnancement

Les stories sont ordonnées par dépendances strictes :
1. Schéma + Types d'abord (tout dépend de ça)
2. Guards et lib avant les routes et pages
3. Routes avant les composants qui les consomment
4. Pages et composants en parallèle possible
5. Tests en dernier par feature (ou en TDD immédiatement après la spec)
6. Suppression du code obsolète uniquement après validation

---

## Sprint A — Fondations (Schema + Types + Guards)

### Story A.1 — Migration schéma DB `isSuperAdmin` + suppression `isPlatform`
**Assigné à :** @db-specialist
**Dépendances :** aucune
**Effort :** S

**Tâches :**
- Générer le SQL de migration :
  ```sql
  ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
  UPDATE "User" SET "isSuperAdmin" = true WHERE id = '<admin_id>';
  ALTER TABLE "Site" DROP COLUMN "isPlatform";
  DROP INDEX IF EXISTS "Site_isPlatform_unique";
  ```
- Créer le dossier migration `prisma/migrations/YYYYMMDD_add_super_admin/`
- Mettre à jour `prisma/schema.prisma` : ajouter `isSuperAdmin Boolean @default(false)` sur `User`, supprimer `isPlatform` et son index
- Mettre à jour `prisma/seed.sql` : supprimer la colonne `isPlatform` de l'INSERT Site, ajouter `isSuperAdmin = true` sur l'utilisateur admin

**Critères d'acceptation :**
- `npx prisma migrate deploy` sans erreur
- `npm run db:seed` sans erreur
- `npx prisma validate` sans erreur

---

### Story A.2 — Mise à jour des types TypeScript
**Assigné à :** @architect
**Dépendances :** Story A.1 (schéma)
**Effort :** S

**Fichiers à modifier :**

`src/types/models.ts` :
- Ajouter `isSuperAdmin: boolean` à l'interface `User`
- Supprimer `isPlatform: boolean` de l'interface `Site`

`src/types/api.ts` :
- Supprimer `isPlatform: boolean` de `AdminSiteSummary`
- Supprimer `isPlatform: boolean` de `AdminSiteDetailResponse`
- Ajouter `BackofficeSession` interface :
  ```typescript
  export interface BackofficeSession {
    userId: string;
    email: string | null;
    phone: string | null;
    name: string;
    isSuperAdmin: true;
  }
  ```

`src/types/auth.ts` :
- Ajouter export `BackofficeSession` (ou l'importer depuis api.ts)

`src/types/index.ts` :
- Exporter `BackofficeSession`

**Critères d'acceptation :**
- `npm run build` (types seulement) sans erreur de type
- Aucun `isPlatform` dans les types (grep)

---

### Story A.3 — Créer `src/lib/auth/backoffice.ts`
**Assigné à :** @developer
**Dépendances :** Story A.2 (types)
**Effort :** S

**Contenu à créer :**

```typescript
// src/lib/auth/backoffice.ts
// Guard functions for backoffice routes and pages.
// Authentication is based on User.isSuperAdmin — NOT on activeSiteId.
```

Fonctions à implémenter :
1. `requireSuperAdmin(request: NextRequest): Promise<BackofficeSession>` — pour les API routes. Jette `AuthError` si pas de session, `ForbiddenError` si `!isSuperAdmin`.
2. `checkBackofficeAccess(): Promise<BackofficeSession | null>` — pour les Server Components. Retourne null si non autorisé (pas de throw).

**Important :** La vérification `isSuperAdmin` lit depuis la DB (pas le cookie) pour sécurité.

**Critères d'acceptation :**
- Tests unitaires dans `src/__tests__/lib/backoffice.test.ts` couvrant : non authentifié → 401, authentifié non-superadmin → 403, superadmin → session retournée
- `npx vitest run src/__tests__/lib/backoffice.test.ts` vert

---

## Sprint B — Suppression des dépendances à `isPlatform`

### Story B.1 — Mise à jour `src/lib/queries/sites.ts`
**Assigné à :** @db-specialist
**Dépendances :** Story A.1 (schéma), Story A.2 (types)
**Effort :** XS

**Tâches :**
- Supprimer la fonction `getPlatformSite()` (plus de site plateforme unique)
- Supprimer la fonction `isPlatformSite()` (plus de flag isPlatform)
- Vérifier qu'aucun import externe ne dépend encore de ces fonctions (toutes les dépendances doivent être traitées dans ce sprint avant suppression)

**Note :** Cette story est bloquante pour le reste. Ne pas supprimer avant que tous les imports soient migrés (Stories B.2–B.6 incluses).

**Critères d'acceptation :**
- Aucun import de `getPlatformSite` ou `isPlatformSite` dans le codebase (grep)
- `npm run build` sans erreur

---

### Story B.2 — Nettoyer `src/lib/auth/permissions-server.ts`
**Assigné à :** @developer
**Dépendances :** Story A.2 (types), Story B.1 (sites.ts)
**Effort :** S

**Tâches :**
- Supprimer l'import de `isPlatformSite`
- Supprimer l'import de `PLATFORM_MODULES`
- Dans `getServerPermissions()` : supprimer la logique `isPlat → filter PLATFORM_PERMISSIONS`. Un ADMIN reçoit toutes les permissions sauf celles supprimées dans la nouvelle liste.
- Dans `getServerSiteModules()` : supprimer la logique `isPlatform`. Les modules viennent uniquement de `site.enabledModules`. Si `enabledModules.length === 0` → tous les modules non-platform (mais maintenant il n'y a plus de platform modules).
- Mettre à jour `PLATFORM_PERMISSIONS` → supprimer de `permissions-constants.ts` (Story B.6)

**Critères d'acceptation :**
- `npx vitest run` sur les tests de permissions vert
- `npm run build` sans erreur

---

### Story B.3 — Nettoyer `src/lib/queries/admin-sites.ts`
**Assigné à :** @db-specialist
**Dépendances :** Story A.2 (types), Story B.1 (sites.ts)
**Effort :** S

**Tâches :**
- Dans `updateSiteStatus()` : supprimer la vérification `if (site.isPlatform) throw Error(...)`. Le DKFarm site peut maintenant être géré comme n'importe quel autre site. Si une protection spéciale de DKFarm est souhaitée, la faire via `isSuperAdmin` dans le caller.
- Dans `updateSiteModulesAdmin()` : supprimer la vérification `if (site.isPlatform) throw Error(...)` et la logique `rejectedModules` basée sur `PLATFORM_MODULES`.
- Dans les helpers de mapping (`mapAbonnementSummary`, etc.) : supprimer le champ `isPlatform` des objets retournés.
- Dans `getAdminSites()` : supprimer `isPlatform` du `items` mapping.
- Dans `getAdminSiteById()` : supprimer `isPlatform` du retour.

**Critères d'acceptation :**
- Aucune référence à `isPlatform` dans ce fichier
- `npx vitest run src/__tests__/api/admin-sites.test.ts` vert (après mise à jour du test)

---

### Story B.4 — Nettoyer `src/lib/site-modules-config.ts`
**Assigné à :** @developer
**Dépendances :** Story A.2 (types)
**Effort :** S

**Tâches :**
- Dans `SITE_MODULES_CONFIG` : supprimer les entrées avec `level: "platform"` (PACKS_PROVISIONING, ABONNEMENTS, COMMISSIONS, REMISES). Si `PACKS_PROVISIONING` doit rester un module site, le garder avec `level: "site"`.
- Supprimer l'export `PLATFORM_MODULES`
- Dans `isModuleActive()` : supprimer le paramètre `isPlatform?` et la branche `if (config.level === "platform") return isPlatform === true`
- Mettre à jour la signature : `isModuleActive(module: SiteModule, enabledModules: SiteModule[]): boolean`

**Impact test :** `src/__tests__/lib/site-modules-config.test.ts` — tous les cas de test pour `isPlatform=true` doivent être supprimés ou remplacés.

**Critères d'acceptation :**
- Aucun paramètre `isPlatform` dans `isModuleActive`
- `npx vitest run src/__tests__/lib/site-modules-config.test.ts` vert

---

### Story B.5 — Nettoyer les API routes mineurs
**Assigné à :** @developer
**Dépendances :** Story A.3 (backoffice.ts), Story B.1 (sites.ts)
**Effort :** S

**Fichiers :**

`src/app/api/remises/route.ts` :
- Supprimer les imports `getPlatformSite`, `isPlatformSite`
- Supprimer le guard `if (!isPlat) return 403`
- Supprimer l'appel `getPlatformSite()` (le `siteId` de la remise = `auth.activeSiteId` directement)
- Remarque : les remises globales (siteId=null) seront créées depuis le backoffice uniquement

`src/app/api/portefeuille/retrait/route.ts` :
- Supprimer les imports `getPlatformSite`, `isPlatformSite`
- Supprimer le guard `if (!isPlat) return 403`
- Supprimer l'appel `getPlatformSite()`
- Le `siteId` du `RetraitPortefeuille` = `auth.activeSiteId`

`src/app/api/sites/[id]/roles/route.ts` et `[roleId]/route.ts` :
- Supprimer les imports `isPlatformSite`, `PLATFORM_PERMISSIONS`
- Supprimer le bloc qui refuse les `PLATFORM_PERMISSIONS` sur les sites non-plateforme
- L'anti-escalation reste via `canAssignRole()` (inchangée)

**Critères d'acceptation :**
- `npx vitest run src/__tests__/api/remises.test.ts` vert
- `npx vitest run src/__tests__/api/portefeuille.test.ts` vert
- Aucun import `isPlatformSite` ou `getPlatformSite` dans ces fichiers

---

### Story B.6 — Nettoyer `src/lib/permissions-constants.ts`
**Assigné à :** @developer
**Dépendances :** Story B.2, Story B.5
**Effort :** XS

**Tâches :**
- Supprimer la constante `PLATFORM_PERMISSIONS`
- Supprimer les items `/admin/*` de `ITEM_VIEW_PERMISSIONS`
- Supprimer le groupe `adminPlateforme` de `PERMISSION_GROUPS`
- Dans `MODULE_VIEW_PERMISSIONS` : pas de changement (pas de ref à isPlatform)
- Vérifier qu'aucun fichier n'importe `PLATFORM_PERMISSIONS` (tous doivent avoir été migrés)

**Critères d'acceptation :**
- Aucun export `PLATFORM_PERMISSIONS` dans le codebase
- `npm run build` sans erreur

---

### Story B.7 — Nettoyer les composants subscription
**Assigné à :** @developer
**Dépendances :** Story B.1 (sites.ts)
**Effort :** XS

**Fichiers :**

`src/components/subscription/subscription-banner.tsx` :
- Supprimer l'import `isPlatformSite`
- Supprimer l'appel `isPlatformSite(siteId)` et la condition de masquage
- La bannière s'affiche à tous les sites selon leur plan (DKFarm aura plan ENTERPRISE → aucun quota → bannière naturellement vide ou non rendue)

`src/components/subscription/quotas-usage-bar.tsx` :
- Même traitement

**Critères d'acceptation :**
- Aucun import `isPlatformSite` dans ces fichiers
- Comportement visuel inchangé pour les sites normaux

---

## Sprint C — Création du backoffice

### Story C.1 — Layout et navigation backoffice
**Assigné à :** @developer
**Dépendances :** Story A.3 (backoffice.ts)
**Effort :** M

**Fichiers à créer :**

`src/app/backoffice/layout.tsx` :
- Server Component
- Appelle `checkBackofficeAccess()` — si null → `redirect("/login")`
- Rend `<BackofficeLayout>` avec sidebar et header dédiés

`src/components/backoffice/backoffice-sidebar.tsx` :
- Client Component
- Items de navigation : Dashboard, Sites, Abonnements, Plans, Commissions, Remises, Modules, Utilisateurs
- Lien "Retour à l'application" → `/`
- Mobile : hamburger ou bottom-nav simplifié

`src/components/backoffice/backoffice-header.tsx` :
- Server Component (ou Client)
- Titre "DKFarm Backoffice" avec badge distinctif
- Affiche le nom de l'utilisateur connecté

**Critères d'acceptation :**
- Accès à `/backoffice/` avec `isSuperAdmin=false` → redirect
- Accès à `/backoffice/` avec `isSuperAdmin=true` → layout visible
- Mobile first 360px

---

### Story C.2 — Routes API backoffice : sites
**Assigné à :** @developer
**Dépendances :** Story A.3 (backoffice.ts), Story B.3 (admin-sites.ts nettoyé)
**Effort :** M

**Fichiers à créer sous `src/app/api/backoffice/` :**

`sites/route.ts` :
- `GET /api/backoffice/sites` — ancienne route `/api/admin/sites`
- Guard : `requireSuperAdmin(request)` (remplace `requirePermission + isPlatformSite`)

`sites/[id]/route.ts` :
- `GET /api/backoffice/sites/[id]` — ancienne route `/api/admin/sites/[id]`
- Guard : `requireSuperAdmin(request)`

`sites/[id]/status/route.ts` :
- `PATCH /api/backoffice/sites/[id]/status` — ancienne route `status`
- Guard : `requireSuperAdmin(request)`

`sites/[id]/modules/route.ts` :
- `PUT /api/backoffice/sites/[id]/modules` — ancienne route modules
- Guard : `requireSuperAdmin(request)`

**Note :** Les fonctions de query (`getAdminSites`, `getAdminSiteById`, `updateSiteStatus`, `updateSiteModulesAdmin`) restent dans `src/lib/queries/admin-sites.ts` — seul le guard change.

**Critères d'acceptation :**
- `npx vitest run src/__tests__/api/backoffice-sites.test.ts` vert
- Appel sans session → 401
- Appel avec session non-superadmin → 403
- Appel avec superadmin → 200

---

### Story C.3 — Routes API backoffice : analytics
**Assigné à :** @developer
**Dépendances :** Story A.3 (backoffice.ts)
**Effort :** S

**Fichiers à créer :**
- `src/app/api/backoffice/analytics/route.ts` — ancienne `/api/admin/analytics`
- `src/app/api/backoffice/analytics/sites/route.ts`
- `src/app/api/backoffice/analytics/revenus/route.ts`
- `src/app/api/backoffice/analytics/modules/route.ts`

Chaque fichier : guard `requireSuperAdmin`, appel aux fonctions de `admin-analytics.ts` (inchangées).

**Critères d'acceptation :**
- `npx vitest run src/__tests__/api/backoffice-analytics.test.ts` vert

---

### Story C.4 — Routes API backoffice : modules registry
**Assigné à :** @developer
**Dépendances :** Story A.3 (backoffice.ts)
**Effort :** S

**Fichiers à créer :**
- `src/app/api/backoffice/modules/route.ts` — GET list + POST create
- `src/app/api/backoffice/modules/[key]/route.ts` — GET detail + PATCH update

Reprendre la logique de `/api/admin/modules/`, remplacer guard `isPlatformSite` par `requireSuperAdmin`.

**Critères d'acceptation :**
- Tests GET et POST vert avec mock `isSuperAdmin`

---

### Story C.5 — Pages backoffice : dashboard
**Assigné à :** @developer
**Dépendances :** Story C.1 (layout), Story C.3 (analytics routes)
**Effort :** M

**Fichiers :**
- `src/app/backoffice/dashboard/page.tsx` — reprend `src/app/admin/analytics/page.tsx`
- `src/app/backoffice/dashboard/loading.tsx`

Différences par rapport à l'ancienne page :
- Layout : utilise `BackofficeLayout` (pas `Header` standard)
- Guard : `checkBackofficeAccess()` à la place de `checkPagePermission + isPlatformSite`
- L'URL des données : `GET /api/backoffice/analytics` (nouveau)

**Critères d'acceptation :**
- Page accessible uniquement si `isSuperAdmin=true`
- KPIs affichés correctement

---

### Story C.6 — Pages backoffice : sites
**Assigné à :** @developer
**Dépendances :** Story C.1 (layout), Story C.2 (sites routes)
**Effort :** M

**Fichiers :**
- `src/app/backoffice/sites/page.tsx` — reprend `/admin/sites/page.tsx`
- `src/app/backoffice/sites/loading.tsx`
- `src/app/backoffice/sites/[id]/page.tsx` — reprend `/admin/sites/[id]/page.tsx`
- `src/app/backoffice/sites/[id]/loading.tsx`

Les composants `AdminSitesList`, `AdminSiteDetailClient`, `AdminSiteModulesEditor` sont réutilisés (mais nettoyés en Story C.9).

**Critères d'acceptation :**
- Liste des sites visible pour SuperAdmin
- Actions suspend/block/restore/archive fonctionnelles

---

### Story C.7 — Pages backoffice : abonnements, plans, commissions, remises, modules
**Assigné à :** @developer
**Dépendances :** Story C.1 (layout)
**Effort :** M

**Fichiers à créer :**
- `src/app/backoffice/abonnements/page.tsx` + `loading.tsx` (reprend `/admin/abonnements`)
- `src/app/backoffice/plans/page.tsx` + `loading.tsx` (reprend `/admin/plans`)
- `src/app/backoffice/commissions/page.tsx` + `loading.tsx` (reprend `/admin/commissions`)
- `src/app/backoffice/remises/page.tsx` + `loading.tsx` (reprend `/admin/remises`)
- `src/app/backoffice/modules/page.tsx` + `loading.tsx` (reprend `/admin/modules`)

**Note :** Ces pages remplacent le guard `checkPagePermission(session, Permission.ABONNEMENTS_GERER)` par `checkBackofficeAccess()`.

**Critères d'acceptation :**
- Toutes les pages accessibles uniquement si `isSuperAdmin=true`
- Données affichées identiques aux anciennes pages

---

### Story C.8 — Lien "Backoffice" dans la navigation
**Assigné à :** @developer
**Dépendances :** Story C.1 (backoffice layout), Story B.6 (permissions nettoyées)
**Effort :** S

**Tâches :**
- Dans `src/components/layout/sidebar.tsx` : supprimer le module "Admin Plateforme" (items `/admin/*`)
- Ajouter un lien conditionnel "Backoffice" dans le user menu ou en bas de la sidebar, visible uniquement si `isSuperAdmin=true`
- La prop `isSuperAdmin` doit être passée depuis le layout parent (Server Component lit `User.isSuperAdmin`)

**Critères d'acceptation :**
- Un ADMIN de site sans `isSuperAdmin` ne voit pas de lien Backoffice
- Un SuperAdmin voit le lien et peut naviguer vers `/backoffice/dashboard`

---

### Story C.9 — Nettoyer composants admin (supprimer props isPlatform)
**Assigné à :** @developer
**Dépendances :** Story C.6 (pages backoffice sites)
**Effort :** S

**Fichiers :**

`src/components/admin/sites/admin-sites-list.tsx` :
- Supprimer la condition `!site.isPlatform` sur les boutons d'action
- Supprimer toute référence à `isPlatform` dans la logique d'affichage

`src/components/admin/sites/admin-site-detail-client.tsx` :
- Supprimer l'affichage `isPlatform ? "Oui" : "Non"`
- Supprimer `canChangeStatus = !site.isPlatform && ...` (DKFarm peut être géré comme tout autre site)
- Supprimer la prop `isPlatform` passée à `AdminSiteModulesEditor`

`src/components/admin/sites/admin-site-modules-editor.tsx` :
- Supprimer la prop `isPlatform: boolean`
- Supprimer toute branche `isPlatform && (...)` et `!isPlatform && (...)`
- Le comportement est uniforme pour tous les sites

**Critères d'acceptation :**
- Aucun prop ou référence `isPlatform` dans ces composants
- `npm run build` sans erreur de type

---

## Sprint D — Suppression du code obsolète

### Story D.1 — Supprimer les pages et routes `/admin/*` obsolètes
**Assigné à :** @developer
**Dépendances :** Toutes les stories C.x (backoffice opérationnel)
**Effort :** S

**Tâches :**
- Supprimer `src/app/admin/` en entier
- Supprimer `src/app/api/admin/` en entier (ou retourner 410 Gone pendant 1 sprint)
- Supprimer les `loading.tsx` correspondants dans `src/app/admin/*/`

**Note :** Vérifier qu'aucun client du code (tests, composants) ne référence encore les anciennes routes.

**Critères d'acceptation :**
- Aucun dossier `src/app/admin/` ou `src/app/api/admin/`
- `npm run build` sans erreur

---

### Story D.2 — Finaliser la suppression de `getPlatformSite` et `isPlatformSite`
**Assigné à :** @db-specialist
**Dépendances :** Story B.1 (déjà fait, vérifier qu'il n'y a plus d'imports)
**Effort :** XS

Cette story est la validation finale de B.1. Confirmer par grep que les fonctions ne sont plus importées nulle part, puis les retirer du fichier.

**Critères d'acceptation :**
- `grep -r "isPlatformSite\|getPlatformSite" src/` retourne 0 résultats
- `npm run build` sans erreur

---

### Story D.3 — Mettre à jour tous les tests
**Assigné à :** @tester
**Dépendances :** Toutes les stories B.x et C.x
**Effort :** M

**Tests à mettre à jour :**
- `src/__tests__/api/sites.test.ts` : supprimer mocks `isPlatformSite`
- `src/__tests__/api/admin-sites.test.ts` → renommer/réécrire en `backoffice-sites.test.ts`
- `src/__tests__/api/admin-analytics.test.ts` → renommer/réécrire en `backoffice-analytics.test.ts`
- `src/__tests__/api/remises.test.ts` : supprimer mocks `isPlatformSite`
- `src/__tests__/api/portefeuille.test.ts` : supprimer mocks `isPlatformSite`
- `src/__tests__/lib/site-modules-config.test.ts` : supprimer cas `isPlatform=true`
- `src/__tests__/lib/commissions.test.ts` : supprimer mocks `isPlatformSite`, `getPlatformSite`
- `src/__tests__/integration/abonnement-checkout-flow.test.ts` : supprimer mocks platform site

**Tests à créer :**
- `src/__tests__/lib/backoffice.test.ts` (si pas créé en A.3)
- `src/__tests__/api/backoffice-sites.test.ts` (si pas créé en C.2)
- `src/__tests__/api/backoffice-analytics.test.ts` (si pas créé en C.3)

**Critères d'acceptation :**
- `npx vitest run` : 0 failing, 0 skipped
- Aucun mock `isPlatformSite` ou `getPlatformSite` dans les tests

---

## Sprint E — Validation finale

### Story E.1 — Build + tests complets
**Assigné à :** @tester
**Dépendances :** Toutes les stories D.x
**Effort :** S

**Checklist :**
- [ ] `npx prisma migrate dev` (ou deploy) sans erreur
- [ ] `npm run db:seed` sans erreur
- [ ] `npx vitest run` — 0 failing
- [ ] `npm run build` — build production OK
- [ ] Test manuel mobile 360px : accès `/backoffice/dashboard` avec SuperAdmin
- [ ] Test manuel : accès `/backoffice/sites` avec user non-superadmin → redirect
- [ ] Vérifier que `grep -r "isPlatform" src/` retourne 0 résultats (hors commentaires historiques)

---

### Story E.2 — Review ADR-022
**Assigné à :** @code-reviewer
**Dépendances :** Story E.1
**Effort :** S

**Checklist review :**
- [ ] R1 : enums MAJUSCULES
- [ ] R2 : enums importés depuis @/types
- [ ] R3 : Prisma ↔ TypeScript alignés
- [ ] R4 : opérations atomiques
- [ ] R5 : DialogTrigger asChild
- [ ] R6 : CSS variables
- [ ] R7 : nullabilité explicite
- [ ] R8 : siteId sur tous les nouveaux modèles (BackofficeSession n'a pas de siteId — ok, c'est voulu)
- [ ] R9 : tests passent + build OK
- [ ] Sécurité : vérifier que `requireSuperAdmin` lit depuis DB, pas cookie
- [ ] Mobile first : backoffice accessible et lisible sur 360px

---

## Tableau de dépendances résumé

```
A.1 (schéma) ──────────────────────┐
                                    │
A.2 (types) ← A.1 ─────────────────┤
                                    │
A.3 (backoffice.ts) ← A.2 ─────────┤
                                    │
B.1 (sites.ts clean) ← A.1, A.2 ───┤
                                    │
B.2 (permissions-server) ← A.2, B.1 ─┤
B.3 (admin-sites.ts) ← A.2, B.1 ───┤
B.4 (site-modules-config) ← A.2 ───┤
B.5 (API routes mineurs) ← A.3, B.1 ─┤
B.6 (permissions-constants) ← B.2, B.5 ─┤
B.7 (subscription comps) ← B.1 ────┤
                                    │
C.1 (layout backoffice) ← A.3 ─────┤
C.2 (routes sites) ← A.3, B.3 ─────┤
C.3 (routes analytics) ← A.3 ──────┤
C.4 (routes modules) ← A.3 ────────┤
C.5 (page dashboard) ← C.1, C.3 ───┤
C.6 (pages sites) ← C.1, C.2 ──────┤
C.7 (pages abo/plans/etc) ← C.1 ───┤
C.8 (nav lien backoffice) ← C.1, B.6 ─┤
C.9 (composants admin) ← C.6 ──────┤
                                    │
D.1 (supp admin/) ← toutes C.x ────┤
D.2 (confirm supp platform fns) ← B.1 ─┤
D.3 (tests) ← toutes B.x + C.x ────┤
                                    │
E.1 (validation) ← toutes D.x ─────┤
E.2 (review) ← E.1 ────────────────┘
```

---

## Effort total estimé

| Sprint | Stories | Effort total |
|--------|---------|--------------|
| A | 3 stories | ~3 jours |
| B | 7 stories | ~4 jours |
| C | 9 stories | ~5 jours |
| D | 3 stories | ~2 jours |
| E | 2 stories | ~1 jour |
| **Total** | **24 stories** | **~15 jours** |

---

## Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Tests cassés pendant migration | Haute | Moyen | Migrer story par story, run tests à chaque story |
| Routes `/admin/*` référencées depuis composants oubliés | Moyenne | Bas | Grep systématique avant D.1 |
| Données de prod avec `isPlatform=true` | Haute | Haut | Migration SQL atomique avec rollback possible |
| SuperAdmin accidentellement révoqué | Basse | Critique | Contrainte applicative : au moins 1 SuperAdmin toujours |
| Session cookie avec données `isPlatform` en cache | Basse | Bas | Invalider toutes les sessions lors de la migration |
