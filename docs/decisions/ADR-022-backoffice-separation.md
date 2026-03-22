# ADR-022 — Backoffice Separation (Séparation du backoffice DKFarm)

**Date :** 2026-03-22
**Statut :** Proposé
**Auteur :** @architect
**Remplace (partiellement) :** ADR-021 (Site & Module Management), project_platform_site_architecture.md

---

## 1. Contexte et problème

### 1.1 État actuel

Le site DKFarm est implémenté comme un **site ordinaire avec un flag spécial** (`isPlatform: true` sur le modèle `Site`). Cette approche crée une double personnalité :

- DKFarm est une **ferme piscicole** (elle peut avoir des `bacs`, `vagues`, `relevés`)
- DKFarm est aussi l'**opérateur de la plateforme** (elle gère les sites clients, abonnements, commissions, remises, analytics)

Le flag `isPlatform` est le mécanisme de garde pour distinguer ces deux contextes. Il est référencé dans **87 emplacements** recensés dans le code (API routes, pages, queries, composants, tests).

### 1.2 Inventaire complet des usages de `isPlatform`

#### Schema / DB
- `prisma/schema.prisma` : `Site.isPlatform Boolean @default(false)` avec index partiel unique
- `prisma/migrations/20260321200000_add_site_is_platform/migration.sql` : migration `ADD COLUMN isPlatform`
- `prisma/seed.sql` : `UPDATE "Site" SET "isPlatform" = true WHERE id = 'site_01'`

#### Types
- `src/types/models.ts:287` : `Site.isPlatform: boolean`
- `src/types/api.ts:2121, 2178` : `isPlatform: boolean` dans `AdminSiteSummary` et `AdminSiteDetailResponse`

#### Queries / Lib
- `src/lib/queries/sites.ts` : `getPlatformSite()` (findFirst where isPlatform=true) + `isPlatformSite()` (cache + lookup)
- `src/lib/queries/admin-sites.ts` : guard `if (site.isPlatform) throw Error(...)` dans `updateSiteStatus()` et `updateSiteModulesAdmin()` ; `isPlatform` retourné dans les DTOs
- `src/lib/queries/admin-analytics.ts` : commentaire "réservées au site plateforme"
- `src/lib/auth/permissions-server.ts` : `isPlatformSite()` appelé pour décider de la liste de permissions
- `src/lib/site-modules-config.ts` : `isModuleActive()` — `if config.level === "platform" return isPlatform === true`
- `src/lib/permissions-constants.ts` : `PLATFORM_PERMISSIONS[]` liste les permissions réservées

#### API Routes
| Route | Usage |
|-------|-------|
| `GET /api/admin/sites` | guard `isPlatformSite(session.activeSiteId)` |
| `GET /api/admin/sites/[id]` | guard `isPlatformSite(auth.activeSiteId)` |
| `PATCH /api/admin/sites/[id]/status` | guard `isPlatformSite(ctx.activeSiteId)` |
| `PUT /api/admin/sites/[id]/modules` | guard `isPlatformSite(ctx.activeSiteId)` |
| `GET /api/admin/analytics` | guard `isPlatformSite(session.activeSiteId)` |
| `GET /api/admin/analytics/sites` | guard `isPlatformSite(session.activeSiteId)` |
| `GET /api/admin/analytics/revenus` | guard `isPlatformSite(session.activeSiteId)` |
| `GET /api/admin/analytics/modules` | guard `isPlatformSite(session.activeSiteId)` |
| `GET/POST /api/admin/modules` | guard `isPlatformSite(session.activeSiteId)` |
| `GET/PATCH /api/admin/modules/[key]` | guard `isPlatformSite(session.activeSiteId)` |
| `POST /api/remises` | guard `isPlatformSite(auth.activeSiteId)` + `getPlatformSite()` |
| `POST /api/portefeuille/retrait` | guard `isPlatformSite(auth.activeSiteId)` + `getPlatformSite()` |
| `POST /api/sites/[id]/roles` | `isPlatformSite(siteId)` pour refuser `PLATFORM_PERMISSIONS` |
| `PATCH /api/sites/[id]/roles/[roleId]` | même logique |

#### Pages (`/admin/*`)
| Page | Guard |
|------|-------|
| `/admin/sites` | `isPlatformSite(session.activeSiteId)` |
| `/admin/sites/[id]` | `isPlatformSite(session.activeSiteId)` |
| `/admin/analytics` | `isPlatformSite(session.activeSiteId)` |
| `/admin/modules` | `isPlatformSite(session.activeSiteId)` |
| `/admin/abonnements` | Permission seule (pas de guard isPlatform) |
| `/admin/commissions` | Permission seule (pas de guard isPlatform) |
| `/admin/remises` | Permission seule (pas de guard isPlatform) |
| `/admin/plans` | Permission seule (pas de guard isPlatform) |

#### Composants
- `src/components/admin/sites/admin-sites-list.tsx` : `!site.isPlatform` pour masquer actions
- `src/components/admin/sites/admin-site-detail-client.tsx` : affiche "Site plateforme : Oui/Non"
- `src/components/admin/sites/admin-site-modules-editor.tsx` : prop `isPlatform` pour désactiver/fixer modules
- `src/components/subscription/subscription-banner.tsx` : `isPlatformSite()` pour masquer bannière
- `src/components/subscription/quotas-usage-bar.tsx` : `isPlatformSite()` pour masquer quotas

#### Tests
- `src/__tests__/api/sites.test.ts`
- `src/__tests__/api/admin-sites.test.ts`
- `src/__tests__/api/admin-analytics.test.ts`
- `src/__tests__/api/remises.test.ts`
- `src/__tests__/api/portefeuille.test.ts`
- `src/__tests__/lib/site-modules-config.test.ts`
- `src/__tests__/lib/commissions.test.ts`
- `src/__tests__/integration/abonnement-checkout-flow.test.ts`

### 1.3 Problèmes identifiés

**P1 — Confusion de rôles**
DKFarm-en-tant-que-site peut théoriquement avoir des bacs, des vagues, des alevins, des clients, des factures. C'est une surface d'incohérence : les features d'élevage et de backoffice partagent le même layout, la même navigation, les mêmes composants. Un admin DKFarm qui gère des abonnements voit aussi "Grossissement" dans sa sidebar.

**P2 — Guard fragilité**
Le guard `isPlatformSite(session.activeSiteId)` suppose que l'utilisateur a switché son site actif vers DKFarm avant d'accéder aux pages admin. Il suffit qu'un ADMIN ait activeSiteId pointant vers un site client pour que `/admin/sites` lui réponde 403, même s'il a SITES_VOIR dans ses permissions.

**P3 — Couplage fort : permissions platform = membership platform site**
`PLATFORM_PERMISSIONS` est une liste de permissions qui ne sont "actives" que si `activeSiteId === platformSiteId`. C'est implicite et non documenté au niveau du schéma. Un futur développeur peut créer un SiteRole avec ABONNEMENTS_GERER sur un site client sans comprendre que ces permissions seront silencieusement strippées.

**P4 — Scalabilité**
Si DKFarm doit gérer plusieurs régions ou plusieurs opérateurs, l'approche `isPlatform` (un seul site marqué) ne passe pas à l'échelle. Elle suppose une unicité absolue.

**P5 — UX mixte**
Les routes `/admin/*` (backoffice) et `/vagues`, `/stock`, etc. (site ops) partagent le même layout App Router avec le même `Header`, `Sidebar`, `BottomNav`. Le contexte mental est différent : administrer une plateforme vs gérer une ferme.

---

## 2. Options considérées

### Option A — Statu quo amélioré (garder `isPlatform`, renforcer les guards)

**Description :** Conserver le flag `isPlatform` mais l'exposer plus clairement : le contexte "Platform Mode" serait signalé dans l'UI (badge dans le header, sidebar différente). Les guards restent `isPlatformSite()`.

**Avantages :**
- Zéro migration de schéma
- Zéro refactoring des routes existantes
- DKFarm peut continuer à être un site "normal" avec des opérations d'élevage si nécessaire

**Inconvénients :**
- Ne résout pas P1 (confusion de rôles)
- Ne résout pas P2 (fragilité du guard par activeSiteId)
- Ne résout pas P3 (couplage implicite permissions/site)
- Accumulation de dette technique à chaque nouveau feature admin

**Verdict : Rejeté.** Résout les symptômes sans traiter les causes.

---

### Option B — Application Next.js séparée pour le backoffice

**Description :** Créer une application Next.js distincte (`apps/backoffice/`) dans un monorepo (Turborepo ou NX). Le backoffice a son propre `app/layout.tsx`, ses propres composants, ses propres API routes. DKFarm reste un site ordinaire dans l'application principale.

**Avantages :**
- Séparation maximale des responsabilités
- Déploiements indépendants
- Pas de risque de pollution entre contextes
- Équipe dédiée backoffice possible

**Inconvénients :**
- Refactoring majeur : migrer toutes les routes `/admin/*`, `/api/admin/*`, queries admin-sites, admin-analytics vers la nouvelle app
- Configuration Turborepo/NX supplémentaire
- Two domains or subdomains to manage (admin.dkfarm.cm vs app.dkfarm.cm)
- Le code partagé (types, queries, Prisma client) doit devenir un package local `@dkfarm/shared`
- Les tests doivent être dupliqués/séparés
- Overhead opérationnel : deux processus, deux déploiements, deux configurations d'env

**Verdict : Rejeté pour cette phase.** La valeur architecturale est réelle mais le coût de migration est disproportionné par rapport aux bénéfices immédiats. Peut être reconsidéré en Phase 6 si l'équipe grandit.

---

### Option C — Séparation par route prefix + SuperAdmin role (DÉCISION RETENUE)

**Description :** Dans la même application Next.js, toutes les routes backoffice sont regroupées sous `/backoffice/*`. L'accès n'est plus conditionné par `activeSiteId === platformSiteId` mais par un **flag SuperAdmin au niveau User** (`User.isSuperAdmin: Boolean`). DKFarm reste un site ordinaire dans la table `Site` — le flag `isPlatform` est retiré.

**Architecture :**

```
/backoffice/
  dashboard/           → Analytics KPIs plateforme
  sites/               → Liste et gestion des sites clients
  sites/[id]/          → Détail site client
  abonnements/         → Tous les abonnements
  plans/               → Gestion des plans
  commissions/         → Commissions et portefeuilles
  remises/             → Remises et codes promo
  modules/             → Registre des modules
  users/               → Gestion des utilisateurs plateforme

/api/backoffice/
  dashboard/           → KPIs
  sites/               → CRUD sites
  sites/[id]/status/   → Transitions cycle de vie
  sites/[id]/modules/  → Modules
  analytics/           → Agrégations
  plans/               → CRUD plans
  abonnements/         → CRUD abonnements
  commissions/         → CRUD commissions
  remises/             → CRUD remises
  modules/             → Registre
```

**Guard backoffice :** `requireSuperAdmin(request)` — vérifie `User.isSuperAdmin === true`, indépendamment de `activeSiteId`.

**Avantages :**
- Même application, même déploiement, même base de code partagée
- Guard simple et explicite : `User.isSuperAdmin` n'est pas lié à un site
- DKFarm peut être une ferme normale (elle a des vagues, des bacs, un abonnement, etc.)
- La nav backoffice est séparée (pas de contamination sidebar)
- Pas de confusion `activeSiteId` / permissions platform
- `isPlatform` peut être entièrement retiré
- Migration progressive possible : anciens `/admin/*` → nouveau `/backoffice/*`

**Inconvénients :**
- Migration de toutes les routes `/admin/*` → `/backoffice/*`
- Nouveau middleware de guard à écrire
- Les tests doivent être mis à jour
- Les `PLATFORM_PERMISSIONS` doivent être remappées vers des permissions SuperAdmin ou supprimées

**Verdict : RETENU.**

---

## 3. Décision

**Option C est adoptée.**

Le backoffice DKFarm devient une zone séparée dans la même application Next.js, accessible via le préfixe de route `/backoffice/*`. L'accès est contrôlé par un flag `User.isSuperAdmin` (ajout au modèle `User`) indépendant de tout `activeSiteId`.

### Principes directeurs

1. **DKFarm est un site ordinaire.** Il peut avoir des modules, des membres, des abonnements comme n'importe quel site client.
2. **Le backoffice est une zone d'application distincte.** Il a son propre layout, sa propre navigation, ses propres guards.
3. **`isPlatform` est supprimé.** Le flag n'a plus de raison d'exister sur le modèle `Site`.
4. **`User.isSuperAdmin` remplace le concept de "user sur la platform site".** C'est un attribut de l'utilisateur, pas de son site actif.
5. **Les PLATFORM_PERMISSIONS sont réorganisées.** Certaines deviennent des permissions backoffice (gérées par `isSuperAdmin`), d'autres deviennent des permissions normales de site.

---

## 4. Nouveau modèle de données

### 4.1 Changements au modèle `User`

```prisma
model User {
  // ... champs existants ...

  /** Flag SuperAdmin — accès au backoffice DKFarm.
   * Indépendant du site actif. Ne peut être défini que par un autre SuperAdmin.
   * Null-safe : false par défaut.
   */
  isSuperAdmin   Boolean  @default(false)

  // ... reste inchangé ...
}
```

**Note :** Le champ `role: Role` existant (ADMIN, GERANT, PISCICULTEUR, INGENIEUR) est conservé tel quel. `isSuperAdmin` est orthogonal : un ADMIN d'un site peut ne pas être SuperAdmin de la plateforme.

### 4.2 Suppression de `Site.isPlatform`

```prisma
model Site {
  // SUPPRIMER :
  // isPlatform     Boolean          @default(false)

  // Garder tout le reste inchangé
}
```

La contrainte unique partielle `Site_isPlatform_unique` est également supprimée.

### 4.3 Suppression de `PLATFORM_PERMISSIONS` (réorganisation)

Les permissions actuellement dans `PLATFORM_PERMISSIONS` sont remappées :

| Permission actuelle | Nouveau comportement |
|---------------------|----------------------|
| `PLANS_GERER` | Supprimée de PLATFORM_PERMISSIONS — accès via `isSuperAdmin` dans le backoffice uniquement |
| `ABONNEMENTS_VOIR` | Reste permission de site (les ADMIN de site voient leur propre abonnement via `/mon-abonnement`) |
| `ABONNEMENTS_GERER` | Supprimée de PLATFORM_PERMISSIONS — backoffice only (`isSuperAdmin`) |
| `REMISES_GERER` | Supprimée de PLATFORM_PERMISSIONS — backoffice only |
| `COMMISSIONS_VOIR` | Reste permission de site (les ingénieurs voient leurs propres commissions) |
| `COMMISSIONS_GERER` | Supprimée de PLATFORM_PERMISSIONS — backoffice only |
| `COMMISSION_PREMIUM` | Reste permission de site (pour les ingénieurs) |
| `PORTEFEUILLE_VOIR` | Reste permission de site (les ingénieurs voient leur portefeuille) |
| `PORTEFEUILLE_GERER` | Supprimée de PLATFORM_PERMISSIONS — backoffice only |
| `SITES_VOIR` | Supprimée — backoffice only |
| `SITES_GERER` | Supprimée — backoffice only |
| `ANALYTICS_PLATEFORME` | Supprimée — backoffice only |

### 4.4 Nouveau type `BackofficeSession`

```typescript
/** Contexte pour les handlers backoffice — ne dépend pas d'un activeSiteId */
export interface BackofficeSession {
  userId: string;
  email: string | null;
  phone: string | null;
  name: string;
  isSuperAdmin: true; // toujours true si on est dans ce contexte
}
```

---

## 5. Nouveau layout backoffice

Le backoffice a son propre `src/app/backoffice/layout.tsx` qui :
- Charge la session et vérifie `isSuperAdmin`
- Rend une `BackofficeSidebar` distincte (pas la même que l'app ferme)
- N'affiche PAS la navigation par modules (`Sidebar`, `BottomNav`)
- A son propre `Header` avec titre "DKFarm Backoffice"

```
src/app/backoffice/
  layout.tsx                   ← BackofficeLayout (guard isSuperAdmin)
  page.tsx                     ← redirect("/backoffice/dashboard")
  dashboard/
    page.tsx                   ← Analytics KPIs
    loading.tsx
  sites/
    page.tsx                   ← Liste sites
    loading.tsx
    [id]/
      page.tsx                 ← Détail site
      loading.tsx
  abonnements/
    page.tsx
    loading.tsx
  plans/
    page.tsx
    loading.tsx
  commissions/
    page.tsx
    loading.tsx
  remises/
    page.tsx
    loading.tsx
  modules/
    page.tsx
    loading.tsx
  users/
    page.tsx
    loading.tsx

src/components/backoffice/
  backoffice-sidebar.tsx       ← Sidebar spécifique backoffice
  backoffice-header.tsx        ← Header avec badge "Backoffice"
```

---

## 6. Nouveau guard backoffice

### 6.1 `requireSuperAdmin()` — API routes

```typescript
// src/lib/auth/backoffice.ts
export async function requireSuperAdmin(request: NextRequest): Promise<BackofficeSession> {
  const session = await getSessionFromRequest(request);
  if (!session) throw new AuthError("Non authentifié");

  // Lookup isSuperAdmin depuis DB (pas depuis le cookie — sécurité)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isSuperAdmin: true },
  });
  if (!user?.isSuperAdmin) {
    throw new ForbiddenError("Accès réservé aux super-administrateurs");
  }
  return { ...session, isSuperAdmin: true };
}
```

### 6.2 `checkBackofficeAccess()` — Server Components (pages)

```typescript
// src/lib/auth/backoffice-page.ts
export async function checkBackofficeAccess(): Promise<BackofficeSession | null> {
  const session = await getServerSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isSuperAdmin: true },
  });
  if (!user?.isSuperAdmin) return null;
  return { ...session, isSuperAdmin: true };
}
```

Usage dans les pages :

```typescript
export default async function BackofficeSitesPage() {
  const bo = await checkBackofficeAccess();
  if (!bo) redirect("/login"); // ou redirect("/")

  // ...
}
```

---

## 7. Impact sur les features existantes

### 7.1 Ingénieurs (Role.INGENIEUR)

Les ingénieurs accèdent aux **sites clients** qu'ils supervisent via l'application normale (non le backoffice). Leur contexte est `activeSiteId` pointant vers leur propre site d'ingénieur ou vers les sites clients via le module `INGENIEUR`.

Les ingénieurs ne sont PAS SuperAdmin. Ils n'ont pas accès au backoffice.

### 7.2 Portefeuille ingénieur (`/mon-portefeuille`)

La route `/api/portefeuille/retrait` supprimer le guard `isPlatformSite`. Elle vérifie simplement que l'utilisateur a `PORTEFEUILLE_VOIR`. Le `siteId` du `RetraitPortefeuille` utilise le `activeSiteId` de l'ingénieur (son propre site), pas le site DKFarm.

**Impact data :** Les `RetraitPortefeuille` et `CommissionIngenieur` existants ont leur `siteId` pointant vers le site DKFarm (`site_01`). Après migration, ils garderont ce siteId tel quel (DKFarm est maintenant un site ordinaire — les données restent cohérentes).

### 7.3 Remises (`/admin/remises`)

La route `POST /api/remises` supprime le guard `isPlatformSite`. La création de remises est permise à tout utilisateur avec `REMISES_GERER`. Toutefois, la page de gestion des remises **globales** (siteId=null) est déplacée vers `/backoffice/remises`. Les remises site-spécifiques restent dans `/admin/remises` de chaque site.

**Clarification :** Il y a deux types de remises :
- **Remises globales** (siteId=null) — gérées dans le backoffice
- **Remises site** (siteId = site client) — gérées dans le contexte du site

### 7.4 Subscription banner et quotas

`src/components/subscription/subscription-banner.tsx` et `quotas-usage-bar.tsx` appellent `isPlatformSite()` pour se masquer sur DKFarm. Après migration :
- Ces composants utilisent un check `User.isSuperAdmin` OU
- DKFarm a simplement un abonnement de type ENTERPRISE (plan sans quotas) et la bannière ne s'affiche pas naturellement

**Recommandation :** Utiliser l'approche plan ENTERPRISE pour DKFarm. Supprimer le check `isPlatformSite()` dans ces composants.

### 7.5 Création de rôles de site (anti-escalation PLATFORM_PERMISSIONS)

`POST /api/sites/[id]/roles` refuse actuellement les `PLATFORM_PERMISSIONS` si le site n'est pas `isPlatform`. Après suppression de `PLATFORM_PERMISSIONS` :
- Les permissions comme `ABONNEMENTS_GERER`, `COMMISSIONS_GERER`, etc. restent dans l'enum mais ne sont **pas assignables** via la création de rôles de site (retrait de `SYSTEM_ROLE_DEFINITIONS`)
- Un utilisateur `isSuperAdmin` peut les avoir via `User.isSuperAdmin`, pas via `SiteRole`

### 7.6 `SiteModule.PACKS_PROVISIONING`, `ABONNEMENTS`, `COMMISSIONS`, `REMISES`

Ces modules avaient `level: "platform"` dans `SITE_MODULES_CONFIG`. Après migration :
- `PACKS_PROVISIONING` : reste comme module site normal (tout site peut activer les Packs si leur plan le permet)
- `ABONNEMENTS`, `COMMISSIONS`, `REMISES` : ces valeurs d'enum `SiteModule` peuvent être **supprimées** car elles n'ont jamais été de vrais modules de site. Elles étaient des artefacts du fait que DKFarm était un "site". Si leur suppression casse des seeds ou des données, les garder dans l'enum mais ne plus les exposer dans `SITE_MODULES_CONFIG`.

### 7.7 Navigation (Sidebar / BottomNav)

Le module "Admin Plateforme" dans `sidebar.tsx` (items `/admin/sites`, `/admin/abonnements`, etc.) est supprimé. Les super-admins voient un lien "Backoffice" dans leur user menu → `/backoffice/dashboard`.

Le BottomNav reste inchangé pour les utilisateurs normaux.

---

## 8. Plan de migration

### Phase 8.1 — Schéma DB

**Migration SQL :**
```sql
-- Ajout isSuperAdmin sur User
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Marquer le premier admin comme SuperAdmin
-- (à adapter selon l'environnement)
UPDATE "User" SET "isSuperAdmin" = true WHERE role = 'ADMIN' AND id = 'user_admin';

-- Supprimer isPlatform de Site
ALTER TABLE "Site" DROP COLUMN "isPlatform";
DROP INDEX IF EXISTS "Site_isPlatform_unique";
```

### Phase 8.2 — Types TypeScript

1. `src/types/models.ts` : Ajouter `isSuperAdmin: boolean` à l'interface `User`. Supprimer `isPlatform` de `Site`.
2. `src/types/api.ts` : Supprimer `isPlatform` de `AdminSiteSummary` et `AdminSiteDetailResponse`. Ajouter `BackofficeSession`.
3. `src/types/auth.ts` : Ajouter `BackofficeSession` interface.

### Phase 8.3 — Queries & Lib

1. `src/lib/queries/sites.ts` : Supprimer `getPlatformSite()` et `isPlatformSite()`.
2. `src/lib/queries/admin-sites.ts` : Supprimer toutes les vérifications `isPlatform` dans `updateSiteStatus()` et `updateSiteModulesAdmin()`. Le "site plateforme" DKFarm n'est plus protégé différemment — il peut être suspendu comme tout autre site (ou on ajoute une protection via `isSuperAdmin` sur l'acteur).
3. `src/lib/auth/permissions-server.ts` : Supprimer l'usage de `isPlatformSite`. La liste de permissions vient uniquement du `SiteRole` de l'utilisateur sur le site actif.
4. `src/lib/site-modules-config.ts` : Supprimer la logique `if (config.level === "platform") return isPlatform === true`. Les modules ABONNEMENTS, COMMISSIONS, REMISES disparaissent de `SITE_MODULES_CONFIG`.
5. `src/lib/permissions-constants.ts` : Supprimer `PLATFORM_PERMISSIONS`. Supprimer `"Admin Plateforme"` de `modulesAdminGerant` et items `/admin/*` de `ITEM_VIEW_PERMISSIONS`.
6. Créer `src/lib/auth/backoffice.ts` : `requireSuperAdmin()` + `checkBackofficeAccess()`.

### Phase 8.4 — API Routes

| Route actuelle | Action | Route nouvelle |
|----------------|--------|----------------|
| `GET /api/admin/sites` | Déplacer + remplacer guard | `GET /api/backoffice/sites` |
| `GET /api/admin/sites/[id]` | Déplacer + remplacer guard | `GET /api/backoffice/sites/[id]` |
| `PATCH /api/admin/sites/[id]/status` | Déplacer + remplacer guard | `PATCH /api/backoffice/sites/[id]/status` |
| `PUT /api/admin/sites/[id]/modules` | Déplacer + remplacer guard | `PUT /api/backoffice/sites/[id]/modules` |
| `GET /api/admin/analytics` | Déplacer + remplacer guard | `GET /api/backoffice/analytics` |
| `GET /api/admin/analytics/sites` | Déplacer + remplacer guard | `GET /api/backoffice/analytics/sites` |
| `GET /api/admin/analytics/revenus` | Déplacer + remplacer guard | `GET /api/backoffice/analytics/revenus` |
| `GET /api/admin/analytics/modules` | Déplacer + remplacer guard | `GET /api/backoffice/analytics/modules` |
| `GET/POST /api/admin/modules` | Déplacer + remplacer guard | `GET/POST /api/backoffice/modules` |
| `GET/PATCH /api/admin/modules/[key]` | Déplacer + remplacer guard | `GET/PATCH /api/backoffice/modules/[key]` |
| `POST /api/remises` | Supprimer guard isPlatform | Garder `/api/remises` mais simplifier |
| `POST /api/portefeuille/retrait` | Supprimer guard isPlatform | Garder `/api/portefeuille/retrait` mais simplifier |
| `POST /api/sites/[id]/roles` | Supprimer guard isPlatform | Simplifier logique anti-escalation |

**Compatibilité ascendante :** Les anciennes routes `/api/admin/*` retournent 410 Gone avec message de migration, ou sont des redirects vers `/api/backoffice/*`. Recommandé : garder pendant 1 sprint pour compatibilité des clients, puis supprimer.

### Phase 8.5 — Pages

| Page actuelle | Action | Page nouvelle |
|---------------|--------|---------------|
| `/admin/sites` | Déplacer | `/backoffice/sites` |
| `/admin/sites/[id]` | Déplacer | `/backoffice/sites/[id]` |
| `/admin/analytics` | Déplacer | `/backoffice/dashboard` |
| `/admin/modules` | Déplacer | `/backoffice/modules` |
| `/admin/abonnements` | Déplacer | `/backoffice/abonnements` |
| `/admin/commissions` | Déplacer | `/backoffice/commissions` |
| `/admin/remises` | Déplacer | `/backoffice/remises` |
| `/admin/plans` | Déplacer | `/backoffice/plans` |

### Phase 8.6 — Composants

| Composant | Action |
|-----------|--------|
| `src/components/admin/sites/admin-sites-list.tsx` | Supprimer prop + logique `isPlatform` |
| `src/components/admin/sites/admin-site-detail-client.tsx` | Supprimer affichage `isPlatform` |
| `src/components/admin/sites/admin-site-modules-editor.tsx` | Supprimer prop `isPlatform` |
| `src/components/subscription/subscription-banner.tsx` | Remplacer `isPlatformSite()` par check plan ENTERPRISE ou prop `isSuperAdmin` |
| `src/components/subscription/quotas-usage-bar.tsx` | Idem |
| `src/components/layout/sidebar.tsx` | Supprimer module "Admin Plateforme" ; ajouter lien "Backoffice" conditionnel `isSuperAdmin` |
| `src/components/backoffice/backoffice-sidebar.tsx` | Créer |
| `src/components/backoffice/backoffice-header.tsx` | Créer |

### Phase 8.7 — Tests

Chaque fichier de test référençant `isPlatform`, `isPlatformSite`, `getPlatformSite`, `mockIsPlatformSite` doit être mis à jour :

- `src/__tests__/api/sites.test.ts`
- `src/__tests__/api/admin-sites.test.ts` → renommer en `backoffice-sites.test.ts`
- `src/__tests__/api/admin-analytics.test.ts` → renommer en `backoffice-analytics.test.ts`
- `src/__tests__/api/remises.test.ts`
- `src/__tests__/api/portefeuille.test.ts`
- `src/__tests__/lib/site-modules-config.test.ts`
- `src/__tests__/lib/commissions.test.ts`
- `src/__tests__/integration/abonnement-checkout-flow.test.ts`

Nouveaux tests à créer :
- `src/__tests__/lib/backoffice.test.ts` : test `requireSuperAdmin()` + `checkBackofficeAccess()`
- `src/__tests__/api/backoffice-sites.test.ts`
- `src/__tests__/api/backoffice-analytics.test.ts`

### Phase 8.8 — Seed SQL

`prisma/seed.sql` : Remplacer `isPlatform = true` par `isSuperAdmin = true` sur l'utilisateur admin DKFarm. Supprimer la colonne `isPlatform` de l'INSERT `Site`.

---

## 9. Modèle de sécurité backoffice

### 9.1 Qui peut accéder au backoffice ?

Seuls les utilisateurs avec `User.isSuperAdmin = true` peuvent accéder à `/backoffice/*` et aux API `/api/backoffice/*`.

### 9.2 Comment devient-on SuperAdmin ?

- Seed initial : le premier utilisateur `admin@dkfarm.cm` a `isSuperAdmin = true`
- Promotion : un SuperAdmin existant peut promouvoir un autre utilisateur via `PATCH /api/backoffice/users/[id]/superadmin`
- Il ne peut pas y avoir zéro SuperAdmin (contrainte applicative, pas DB)

### 9.3 SuperAdmin et site actif

Un SuperAdmin peut avoir un `activeSiteId` normal (son site DKFarm ou un site client). Les routes backoffice ignorent `activeSiteId` — elles n'en ont pas besoin.

### 9.4 Impersonation

Un SuperAdmin peut toujours s'impersoner via `POST /api/users/[id]/impersonate`. Ce mécanisme reste inchangé.

### 9.5 Logs d'audit

Toutes les mutations backoffice créent un `SiteAuditLog` avec `actorId = session.userId` et `siteId` du site ciblé. Les actions sur des entités globales (plans, modules) créent un log sans siteId (nullable).

---

## 10. Questions ouvertes

### Q1 — DKFarm doit-il avoir un abonnement ?

**Recommandation :** Oui. DKFarm reçoit le plan ENTREPRISE gratuitement (via seed) afin que tous les modules soient accessibles et que les composants d'abonnement fonctionnent normalement. Pas d'exception codée en dur.

### Q2 — Les permissions ABONNEMENTS_VOIR, COMMISSIONS_VOIR, PORTEFEUILLE_VOIR restent-elles dans PLATFORM_PERMISSIONS ?

**Recommandation :** Non. Ces permissions deviennent des permissions de site ordinaires, assignables à n'importe quel SiteRole. La liste `PLATFORM_PERMISSIONS` est supprimée entièrement. Les features sensibles (CRUD plans, CRUD remises globales) sont uniquement dans le backoffice, protégées par `isSuperAdmin`.

### Q3 — Que faire des tests qui mockent `isPlatformSite` ?

**Recommandation :** Remplacer les mocks `isPlatformSite` par des mocks `prisma.user.findUnique` retournant `{ isSuperAdmin: true }`. Utiliser un helper `mockSuperAdmin()` dans les factories de test.

### Q4 — Middleware Next.js pour le backoffice ?

**Recommandation :** Ajouter un matcher dans `src/middleware.ts` pour `/backoffice(.*)` qui vérifie l'existence d'une session valide (redirection vers `/login` si absent). La vérification `isSuperAdmin` est faite dans le layout Server Component (plus sûr que dans le middleware Edge, qui n'a pas accès Prisma).

---

## 11. Récapitulatif des fichiers impactés

### À supprimer
- `prisma/migrations/20260321200000_add_site_is_platform/` (conservé pour l'historique mais la nouvelle migration annule `isPlatform`)
- `src/app/admin/` (tous les fichiers → migrés vers `src/app/backoffice/`)
- `src/app/api/admin/` (tous les fichiers → migrés vers `src/app/api/backoffice/`)
- Fonction `getPlatformSite()` dans `src/lib/queries/sites.ts`
- Fonction `isPlatformSite()` dans `src/lib/queries/sites.ts`
- Constante `PLATFORM_PERMISSIONS` dans `src/lib/permissions-constants.ts`

### À créer
- `src/app/backoffice/layout.tsx`
- `src/app/backoffice/dashboard/page.tsx`
- `src/app/backoffice/sites/page.tsx`
- `src/app/backoffice/sites/[id]/page.tsx`
- `src/app/backoffice/abonnements/page.tsx`
- `src/app/backoffice/plans/page.tsx`
- `src/app/backoffice/commissions/page.tsx`
- `src/app/backoffice/remises/page.tsx`
- `src/app/backoffice/modules/page.tsx`
- `src/app/backoffice/users/page.tsx`
- `src/app/api/backoffice/` (toutes les routes)
- `src/lib/auth/backoffice.ts`
- `src/components/backoffice/backoffice-sidebar.tsx`
- `src/components/backoffice/backoffice-header.tsx`

### À modifier (majeurs)
- `prisma/schema.prisma` : `User.isSuperAdmin`, supprimer `Site.isPlatform`
- `prisma/seed.sql` : supprimer `isPlatform`, ajouter `isSuperAdmin`
- `src/types/models.ts` : `User.isSuperAdmin`, supprimer `Site.isPlatform`
- `src/types/api.ts` : supprimer `isPlatform` des DTOs, ajouter `BackofficeSession`
- `src/types/auth.ts` : ajouter `BackofficeSession`
- `src/lib/queries/sites.ts` : supprimer `getPlatformSite()` et `isPlatformSite()`
- `src/lib/queries/admin-sites.ts` : supprimer guards `isPlatform`
- `src/lib/auth/permissions-server.ts` : supprimer logique `isPlatform`
- `src/lib/site-modules-config.ts` : supprimer logique `level === "platform"` / `isPlatform`
- `src/lib/permissions-constants.ts` : supprimer `PLATFORM_PERMISSIONS`, items `/admin/*`
- `src/components/layout/sidebar.tsx` : supprimer module "Admin Plateforme"
- 8 fichiers de test référençant `isPlatform`

### À modifier (mineurs)
- `src/app/api/remises/route.ts` : supprimer guard `isPlatformSite`
- `src/app/api/portefeuille/retrait/route.ts` : supprimer guard `isPlatformSite`
- `src/app/api/sites/[id]/roles/route.ts` : simplifier anti-escalation
- `src/app/api/sites/[id]/roles/[roleId]/route.ts` : simplifier anti-escalation
- `src/components/subscription/subscription-banner.tsx`
- `src/components/subscription/quotas-usage-bar.tsx`
