# ADR-021 — Site & Module Management (Gestion dynamique des sites et modules)

**Date :** 2026-03-22
**Statut :** Accepté
**Auteur :** @architect
**Sprint :** Phase 5 (nouveau)
**Remplace :** Parties de ADR-011 (supervised-sites-modules) et ADR-020 (subscriptions)

---

## 1. Contexte et problème

### 1.1 État actuel

Le système de modules est partiellement dynamique mais comporte des incohérences structurelles importantes :

**Ce qui existe (partiellement dynamique) :**
- `Site.enabledModules SiteModule[]` — tableau d'enums stocké en DB, modifiable via `PUT /api/sites/[id]`
- `PlanAbonnement.modulesInclus SiteModule[]` — les modules sont copiés vers `Site.enabledModules` à l'activation d'un abonnement via `applyPlanModules()`
- `src/lib/site-modules-config.ts` — configuration statique des modules avec leurs labels, icônes et niveaux (`site` vs `platform`)
- `src/lib/auth/permissions-server.ts` — `getServerSiteModules()` lit `enabledModules` depuis la DB

**Ce qui est entièrement codé en dur :**
- La liste des modules (`SiteModule` enum dans `schema.prisma`) — tout ajout de module nécessite une migration
- La distinction `level: "site" | "platform"` dans `SITE_MODULES_CONFIG` — hardcodée dans `site-modules-config.ts`
- Les modules platform-only (`ABONNEMENTS`, `COMMISSIONS`, `REMISES`) — gérés par logique `if (isPlatform)` dans `getServerSiteModules()`
- L'UI d'administration des sites — inexistante au niveau plateforme (il n'existe que `/settings/sites/[id]` pour l'admin de chaque site individuel)
- La gestion du cycle de vie des sites (création, suspension, blocage, archivage) — inexistante côté plateforme
- Les analytics de la plateforme — aucun dashboard montrant le total de sites, abonnements actifs, revenus

**Ce qui manque :**
1. Un dashboard admin plateforme (`/admin/sites`) avec KPIs (sites actifs, abonnements, revenus)
2. Une page de détail de site côté admin plateforme (`/admin/sites/[id]`) avec gestion du cycle de vie
3. La capacité de bloquer/débloquer/suspendre un site depuis la plateforme
4. Des analytics plateforme consolidées (croissance des sites, modules les plus utilisés, revenus par plan)
5. Un registre de modules DB-driven pour éviter les migrations à chaque nouveau module
6. Un audit log des actions admin sur les sites

### 1.2 Problèmes identifiés

**Problème P1 — Cycle de vie des sites incomplet**

`Site.isActive` existe mais il n'y a aucune interface pour le modifier depuis la plateforme. Un admin ne peut pas suspendre, bloquer ou archiver un site sans accès direct à la DB.

**Problème P2 — Modules rigides**

L'ajout d'un module requiert :
1. Modifier l'enum `SiteModule` dans `schema.prisma` (migration SQL)
2. Ajouter l'entrée dans `SITE_MODULES_CONFIG` (code)
3. Mettre à jour `MODULE_LABEL_TO_SITE_MODULE` (code)
4. Ajouter l'item de navigation dans `sidebar.tsx` et `bottom-nav.tsx` (code)

Étapes 1 et 2 pourraient être remplacées par une entrée en DB.

**Problème P3 — Pas de vision plateforme consolidée**

DKFarm (le site plateforme) n'a pas de dashboard pour voir :
- Combien de sites clients sont actifs
- Quels plans sont les plus souscrits
- Le revenu mensuel récurrent (MRR)
- Les sites en période de grâce ou expirés
- Les modules les plus/moins utilisés

**Problème P4 — Assignation manuelle des modules post-abonnement**

Quand un abonnement expire ou est résilié, les modules du site ne sont pas automatiquement restreints. La logique `applyPlanModules()` n'est appelée qu'à l'activation.

---

## 2. Décisions architecturales

### 2.1 Stratégie de migration — Hybride DB + Code

Après analyse des alternatives (voir section 5), la stratégie retenue est **hybride** :

- Les modules métier **restent des enums** (`SiteModule` PostgreSQL) — les supprimer serait une régression sur les performances des index et la type-safety
- Un modèle `ModuleDefinition` en DB complète l'enum avec les métadonnées (label, description, icône, ordre, niveau, disponibilité)
- L'`SiteModule` enum devient la **clé primaire naturelle** de `ModuleDefinition`
- Les nouvelles entrées en DB permettent de contrôler la visibilité des modules sans migration SQL

**Avantage clé :** pas de breaking change sur l'existant. `Site.enabledModules SiteModule[]` continue de fonctionner. `ModuleDefinition` est une extension optionnelle.

### 2.2 Nouveau modèle Prisma — ModuleDefinition

```prisma
model ModuleDefinition {
  id          String     @id @default(cuid())
  /** Clé unique — valeur de l'enum SiteModule. Source de vérité. */
  key         String     @unique
  /** Label affiché dans l'UI (multilangue via i18n key ou texte direct) */
  label       String
  /** Description de ce que le module offre */
  description String?
  /** Nom de l'icône Lucide (ex: "Fish", "Package") */
  iconName    String     @default("Package")
  /** Ordre d'affichage dans les interfaces d'administration */
  sortOrder   Int        @default(0)
  /** platform = réservé au site DKFarm, site = activable par sites clients */
  level       String     @default("site")
  /** Modules requis pour activer celui-ci (dépendances) */
  dependsOn   String[]   @default([])
  /** Si false : masqué dans les interfaces sans le supprimer */
  isVisible   Boolean    @default(true)
  /** Si false : ne peut plus être assigné à de nouveaux plans ou sites */
  isActive    Boolean    @default(true)
  /** Catégorie fonctionnelle pour regroupement UI */
  category    String?

  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}
```

**Note R8 :** `ModuleDefinition` est un registre global (comme `PlanAbonnement`) — pas de `siteId`. Exception documentée ici.

### 2.3 Nouveau modèle Prisma — SiteAuditLog

Traçabilité des actions admin sur les sites.

```prisma
model SiteAuditLog {
  id         String   @id @default(cuid())
  siteId     String
  site       Site     @relation(fields: [siteId], references: [id])
  actorId    String
  actor      User     @relation("AuditLogActor", fields: [actorId], references: [id])
  action     String   /** ex: SITE_SUSPENDED, MODULE_ADDED, ABONNEMENT_FORCED */
  details    Json?    /** Payload before/after pour l'action */
  createdAt  DateTime @default(now())

  @@index([siteId])
  @@index([actorId])
  @@index([createdAt])
}
```

### 2.4 Extension du modèle Site

Ajouter un champ `suspendedReason` pour documenter les suspensions et un `deletedAt` pour le soft delete :

```prisma
model Site {
  // ... champs existants ...
  suspendedAt     DateTime?  /** Null si non suspendu */
  suspendedReason String?    /** Raison de la suspension */
  deletedAt       DateTime?  /** Soft delete — null = actif */
  auditLogs       SiteAuditLog[]
}
```

### 2.5 Nouveaux enums — SiteLifecycleAction et SiteStatus

```prisma
enum SiteStatus {
  ACTIVE
  SUSPENDED
  BLOCKED
  ARCHIVED
}
```

`SiteStatus` est calculé à partir des champs existants :
- `isActive = true` ET `suspendedAt = null` ET `deletedAt = null` → `ACTIVE`
- `isActive = true` ET `suspendedAt != null` → `SUSPENDED`
- `isActive = false` ET `deletedAt = null` → `BLOCKED`
- `deletedAt != null` → `ARCHIVED`

Cette approche préserve la compatibilité : `isActive` continue de fonctionner dans toutes les requêtes existantes.

### 2.6 Nouvelles permissions plateforme

```typescript
// À ajouter à l'enum Permission
SITES_VOIR         // Voir la liste et les détails des sites (admin plateforme)
SITES_GERER        // Suspendre, bloquer, modifier les modules d'un site
ANALYTICS_PLATEFORME // Accéder aux analytics consolidées plateforme
```

Ces permissions sont ajoutées à `PLATFORM_PERMISSIONS` dans `permissions-constants.ts`.

### 2.7 Architecture du dashboard admin plateforme

Le dashboard plateforme s'articule en trois sections :

**Section A — KPIs en temps réel (cartes)**
- Nombre total de sites actifs / suspendus / bloqués
- Abonnements actifs / en période de grâce / expirés
- MRR (revenu mensuel récurrent) calculé des abonnements actifs
- Ingénieurs actifs avec clients supervisés

**Section B — Modules analytics**
- Distribution des modules activés par sites (quels modules sont le plus utilisés)
- Sites par plan d'abonnement
- Évolution du nombre de sites (chart 30 derniers jours)

**Section C — Actions rapides**
- Table des sites récents avec statut et actions (voir / suspendre / bloquer)
- Abonnements en période de grâce (urgents)
- Retraits portefeuille en attente

### 2.8 Cycle de vie des sites — Transitions autorisées

```
ACTIVE ──suspend──→ SUSPENDED ──restore──→ ACTIVE
ACTIVE ──block───→ BLOCKED  ──restore──→ ACTIVE
ACTIVE ──archive──→ ARCHIVED  (irréversible sans intervention DB)
SUSPENDED ──block──→ BLOCKED
BLOCKED ──(restore)──→ ACTIVE
```

Règles :
- Seul le site plateforme (`isPlatform = true`) peut effectuer ces actions
- Nécessite la permission `SITES_GERER`
- Toute action est loguée dans `SiteAuditLog`
- La suspension d'un site ne supprime pas les données
- Un site archivé ne peut pas être restitué via l'UI (protection contre les suppressions accidentelles)

### 2.9 Propagation des modules lors des changements d'état

Lors d'une suspension (`SUSPENDED`) :
- `Site.isActive` reste `true` (les données restent accessibles en lecture pour les admins)
- `Site.suspendedAt` est renseigné
- Les utilisateurs du site voient un écran "Site suspendu" à la connexion
- Les modules ne sont pas modifiés (restauration simple)

Lors d'un blocage (`BLOCKED`) :
- `Site.isActive = false`
- Les sessions actives de ce site sont invalidées
- Les modules ne sont pas modifiés

Lors de la restauration (`ACTIVE`) :
- `Site.isActive = true`, `Site.suspendedAt = null`
- Les modules sont restaurés si l'abonnement est toujours actif

### 2.10 API routes nouvelles

| Méthode | Route | Permission | Description |
|---------|-------|------------|-------------|
| GET | `/api/admin/sites` | `SITES_VOIR` | Liste paginée des sites avec stats |
| GET | `/api/admin/sites/[id]` | `SITES_VOIR` | Détail d'un site (membres, modules, abonnement actif) |
| PATCH | `/api/admin/sites/[id]/status` | `SITES_GERER` | Changer le statut (suspend/block/restore/archive) |
| PATCH | `/api/admin/sites/[id]/modules` | `SITES_GERER` | Modifier les modules d'un site depuis la plateforme |
| GET | `/api/admin/analytics` | `ANALYTICS_PLATEFORME` | KPIs et métriques consolidées plateforme |
| GET | `/api/admin/analytics/sites` | `ANALYTICS_PLATEFORME` | Évolution des sites dans le temps |
| GET | `/api/admin/analytics/revenus` | `ANALYTICS_PLATEFORME` | MRR, revenus par plan, tendances |
| GET | `/api/admin/analytics/modules` | `ANALYTICS_PLATEFORME` | Distribution des modules actifs |
| GET | `/api/admin/modules` | `SITES_VOIR` | Registre des modules (ModuleDefinition) |
| POST | `/api/admin/modules` | `SITES_GERER` | Créer une définition de module |
| PUT | `/api/admin/modules/[key]` | `SITES_GERER` | Modifier une définition de module |
| GET | `/api/admin/audit/[siteId]` | `SITES_VOIR` | Journal d'audit d'un site |

**Contrats détaillés ci-dessous (section 3).**

### 2.11 Pages UI nouvelles

| Route | Composant racine | Guard | Description |
|-------|-----------------|-------|-------------|
| `/admin/sites` | `AdminSitesPage` | `SITES_VOIR` | Liste de tous les sites avec filtres |
| `/admin/sites/[id]` | `AdminSiteDetailPage` | `SITES_VOIR` | Détail admin d'un site |
| `/admin/analytics` | `AdminAnalyticsPage` | `ANALYTICS_PLATEFORME` | Dashboard KPIs plateforme |
| `/admin/modules` | `AdminModulesPage` | `SITES_GERER` | Registre des modules |

Ces pages complètent les pages admin déjà existantes :
- `/admin/abonnements` (Sprint 33) — déjà implémentée
- `/admin/plans` (Sprint 38) — déjà implémentée
- `/admin/commissions` (Sprint 34) — déjà implémentée
- `/admin/remises` (Sprint 35) — déjà implémentée

### 2.12 Navigation — Intégration dans le menu Admin Abonnements existant

Les nouvelles pages admin sont ajoutées sous le module `Admin Abonnements` existant dans la sidebar :

```typescript
// Dans modulesAdminGerant, item "Admin Abonnements" devient :
{
  label: "Admin Plateforme",
  moduleKey: "adminPlateforme",
  primaryHref: "/admin/sites",
  icon: Building2,
  items: [
    { href: "/admin/sites",          itemKey: "sites",           icon: Building2 },
    { href: "/admin/abonnements",    itemKey: "tousAbonnements", icon: ShieldCheck },
    { href: "/admin/plans",          itemKey: "gestionPlans",    icon: LayoutList },
    { href: "/admin/analytics",      itemKey: "analytics",       icon: BarChart3 },
    { href: "/admin/modules",        itemKey: "modules",         icon: Boxes },
    { href: "/admin/commissions",    itemKey: "commissions",     icon: TrendingUp },
    { href: "/admin/remises",        itemKey: "remises",         icon: Tag },
  ],
}
```

La permission gate reste `ABONNEMENTS_GERER` (la plus haute déjà existante) pour l'accès au module. Les items individuels sont filtrés par leur permission propre.

---

## 3. Contrats API détaillés

### 3.1 GET /api/admin/sites

**Query params :** `page`, `limit`, `search`, `status` (ACTIVE|SUSPENDED|BLOCKED|ARCHIVED), `planId`, `hasModule`

**Response 200 :**
```typescript
interface AdminSitesListResponse {
  sites: AdminSiteSummary[];
  total: number;
  page: number;
  totalPages: number;
  stats: {
    totalActive: number;
    totalSuspended: number;
    totalBlocked: number;
    totalArchived: number;
  };
}

interface AdminSiteSummary {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  isPlatform: boolean;
  supervised: boolean;
  suspendedAt: string | null;    // ISO date
  suspendedReason: string | null;
  deletedAt: string | null;
  status: "ACTIVE" | "SUSPENDED" | "BLOCKED" | "ARCHIVED";
  enabledModules: SiteModule[];
  memberCount: number;
  bacCount: number;
  vagueCount: number;
  abonnement: {
    id: string;
    planNom: string;
    typePlan: TypePlan;
    statut: StatutAbonnement;
    dateFin: string;
  } | null;
  createdAt: string;
}
```

### 3.2 GET /api/admin/sites/[id]

**Response 200 :**
```typescript
interface AdminSiteDetailResponse {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  isPlatform: boolean;
  supervised: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  deletedAt: string | null;
  status: "ACTIVE" | "SUSPENDED" | "BLOCKED" | "ARCHIVED";
  enabledModules: SiteModule[];
  // Membres
  members: {
    id: string;
    userId: string;
    name: string;
    email: string | null;
    phone: string | null;
    siteRoleName: string;
    isActive: boolean;
    createdAt: string;
  }[];
  // Abonnement actif (null si aucun)
  abonnementActif: {
    id: string;
    planId: string;
    planNom: string;
    typePlan: TypePlan;
    statut: StatutAbonnement;
    periode: PeriodeFacturation;
    dateDebut: string;
    dateFin: string;
    dateProchainRenouvellement: string;
    dateFinGrace: string | null;
    prixPaye: number;
  } | null;
  // Counts
  bacCount: number;
  vagueCount: number;
  memberCount: number;
  releveCount: number;
  // Audit
  recentAuditLogs: {
    id: string;
    actorName: string;
    action: string;
    details: Record<string, unknown> | null;
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}
```

### 3.3 PATCH /api/admin/sites/[id]/status

**Request body :**
```typescript
interface SiteStatusUpdateDTO {
  action: "SUSPEND" | "BLOCK" | "RESTORE" | "ARCHIVE";
  reason?: string;   // Obligatoire pour SUSPEND et BLOCK
}
```

**Response 200 :**
```typescript
interface SiteStatusUpdateResponse {
  id: string;
  status: "ACTIVE" | "SUSPENDED" | "BLOCKED" | "ARCHIVED";
  isActive: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  deletedAt: string | null;
  updatedAt: string;
}
```

**Règles de validation :**
- Impossible de suspendre/bloquer le site plateforme (`isPlatform = true`)
- `reason` est obligatoire pour `SUSPEND` et `BLOCK`
- `ARCHIVE` nécessite confirmation explicite (champ `confirmArchive: true` dans le body)
- Loggé dans `SiteAuditLog` avec `details: { before: {...}, after: {...} }`

### 3.4 PATCH /api/admin/sites/[id]/modules

**Request body :**
```typescript
interface AdminSiteModulesUpdateDTO {
  enabledModules: SiteModule[];
  reason?: string;   // Optionnel — pour l'audit log
}
```

**Response 200 :**
```typescript
interface AdminSiteModulesUpdateResponse {
  id: string;
  enabledModules: SiteModule[];
  updatedAt: string;
}
```

### 3.5 GET /api/admin/analytics

**Response 200 :**
```typescript
interface AdminAnalyticsResponse {
  // Sites
  sitesActifs: number;
  sitesSuspendus: number;
  sitesBlockes: number;
  sitesCrees30j: number;
  // Abonnements
  abonnementsActifs: number;
  abonnementsGrace: number;
  abonnementsExpires: number;
  abonnementsParPlan: { typePlan: TypePlan; count: number }[];
  // Revenus
  mrrEstime: number;              // XAF — somme des abonnements actifs ramenée au mois
  revenusTotal30j: number;        // XAF — paiements confirmés sur 30 jours
  revenusTotal12m: number;        // XAF — paiements confirmés sur 12 mois
  // Ingénieurs
  ingenieursActifs: number;
  ingenieursAvecClients: number;
  commissionsEnAttente: number;   // Nombre de retraits en attente
  // Modules
  modulesDistribution: {
    module: SiteModule;
    siteCount: number;
    pourcentage: number;
  }[];
}
```

### 3.6 GET /api/admin/analytics/sites

**Query params :** `periode` (7d|30d|90d|12m)

**Response 200 :**
```typescript
interface AdminAnalyticsSitesResponse {
  points: {
    date: string;       // ISO date (YYYY-MM-DD)
    cumul: number;      // Total cumulatif de sites actifs à cette date
    nouveaux: number;   // Sites créés ce jour/semaine/mois
  }[];
  periode: "7d" | "30d" | "90d" | "12m";
}
```

### 3.7 GET /api/admin/modules

**Response 200 :**
```typescript
interface AdminModulesListResponse {
  modules: ModuleDefinitionResponse[];
}

interface ModuleDefinitionResponse {
  id: string;
  key: string;              // Valeur de l'enum SiteModule (ex: "GROSSISSEMENT")
  label: string;
  description: string | null;
  iconName: string;
  sortOrder: number;
  level: "site" | "platform";
  dependsOn: string[];
  isVisible: boolean;
  isActive: boolean;
  category: string | null;
  // Stats calculées
  siteCount: number;        // Nombre de sites ayant ce module activé
  planCount: number;        // Nombre de plans incluant ce module
}
```

---

## 4. Architecture des composants UI

### 4.1 Arborescence des composants

```
src/
├── app/
│   └── admin/
│       ├── sites/
│       │   ├── page.tsx                    # AdminSitesPage (Server Component)
│       │   ├── loading.tsx
│       │   └── [id]/
│       │       ├── page.tsx                # AdminSiteDetailPage (Server Component)
│       │       └── loading.tsx
│       ├── analytics/
│       │   ├── page.tsx                    # AdminAnalyticsPage (Server Component)
│       │   └── loading.tsx
│       └── modules/
│           ├── page.tsx                    # AdminModulesPage (Server Component)
│           └── loading.tsx
│
├── components/
│   └── admin/
│       ├── sites/
│       │   ├── admin-sites-list.tsx        # "use client" — table/cartes + filtres
│       │   ├── admin-site-status-badge.tsx # Badge statut (ACTIVE/SUSPENDED/BLOCKED)
│       │   ├── admin-site-detail-client.tsx # "use client" — onglets détail
│       │   ├── admin-site-status-dialog.tsx # "use client" — Dialog Radix suspension/blocage
│       │   ├── admin-site-modules-editor.tsx # "use client" — éditeur de modules
│       │   └── admin-site-audit-log.tsx    # Liste du journal d'audit
│       ├── analytics/
│       │   ├── admin-kpi-cards.tsx         # Cartes KPI (MRR, sites, abonnements)
│       │   ├── admin-sites-growth-chart.tsx # Recharts — évolution sites
│       │   ├── admin-modules-distribution.tsx # Recharts — bar chart modules
│       │   └── admin-revenue-chart.tsx     # Recharts — revenus par période
│       └── modules/
│           ├── admin-modules-list.tsx      # "use client" — table des ModuleDefinitions
│           └── admin-module-form-dialog.tsx # "use client" — Dialog créer/éditer module
│
└── lib/
    └── queries/
        ├── admin-sites.ts      # Queries admin pour les sites
        └── admin-analytics.ts  # Queries analytics plateforme
```

### 4.2 Composants clés — détail

**`AdminSitesPage`** (Server Component)
- Lit les query params (page, search, status, planId)
- Appelle `getAdminSites()` depuis `lib/queries/admin-sites.ts`
- Passe les données à `AdminSitesList` (client)
- Guard : `checkPagePermission(session, Permission.SITES_VOIR)`

**`AdminSitesList`** ("use client")
- Affichage mobile first : cartes empilées sur 360px, tableau sur md+
- Filtres : Tabs Radix pour les statuts (Tous / Actifs / Suspendus / Bloqués)
- Search input pour recherche par nom
- Filter par plan via Select Radix
- Chaque carte/ligne a un bouton "Gérer" → `href: /admin/sites/[id]`
- Actions rapides : bouton "Suspendre" / "Bloquer" ouvre `AdminSiteStatusDialog`

**`AdminSiteStatusDialog`** ("use client")
- Dialog Radix (R5 : DialogTrigger asChild)
- Formulaire : sélection de l'action (Suspendre / Bloquer / Restaurer / Archiver)
- Champ "Raison" obligatoire pour Suspendre et Bloquer
- Confirmation double pour Archiver (checkbox "Je confirme l'archivage")
- Submit : PATCH `/api/admin/sites/[id]/status`
- Toast (Radix) en feedback de succès/erreur

**`AdminSiteDetailClient`** ("use client")
- Tabs Radix : Résumé | Modules | Membres | Abonnement | Audit
- Onglet **Résumé** : infos du site, statut avec badge coloré, actions (suspend/block/restore)
- Onglet **Modules** : composant `AdminSiteModulesEditor` — toggles pour activer/désactiver modules
- Onglet **Membres** : liste des membres avec leur rôle
- Onglet **Abonnement** : détail de l'abonnement actif avec statut et dates
- Onglet **Audit** : timeline du journal d'audit `SiteAuditLog`

**`AdminSiteModulesEditor`** ("use client")
- Affiche tous les modules disponibles (depuis `ModuleDefinition` + `SITE_MODULES_CONFIG`)
- Toggle Switch (Radix) par module — modules platform-level désactivés/grisés pour non-plateforme
- Bouton "Appliquer les modules du plan" — recharge les modules depuis l'abonnement actif
- Submit : PATCH `/api/admin/sites/[id]/modules`
- Badge sur chaque module indiquant combien de sites l'utilisent

**`AdminAnalyticsPage`** (Server Component)
- Données chargées en parallèle via `Promise.all`
- Passe aux composants client sous-jacents
- Refresh automatique : `export const revalidate = 3600` (1h)

**`AdminKpiCards`** (Server Component ou client si rechargement nécessaire)
- 6 cartes : Sites actifs, Abonnements actifs, MRR estimé, Ingénieurs actifs, Commissions en attente, Sites créés (30j)
- Mobile first : 2 colonnes sur 360px, 3 colonnes sur sm, 6 sur xl

**`AdminSitesGrowthChart`** ("use client", Recharts)
- LineChart : évolution du nombre de sites dans le temps
- Sélecteur de période : 7d / 30d / 90d / 12m (rechargement via fetch)

**`AdminModulesDistribution`** ("use client", Recharts)
- BarChart horizontal : modules par ordre de popularité
- Affiche le % de sites ayant chaque module activé

---

## 5. Alternatives considérées

### Alternative A — Modules 100% DB-driven (sans enum)

Remplacer l'enum `SiteModule` par un système purement DB où tout est une `String` clé.

| Pour | Contre |
|------|--------|
| Ajout de module sans migration | Perte de type-safety TypeScript complète |
| UI admin pour créer des modules | `getServerSiteModules()` retourne `string[]` — erreurs silencieuses |
| | `PlanAbonnement.modulesInclus` devient `String[]` — pas typé |
| | Toute la navigation doit être refactorisée |
| | Risque de typo en DB non détecté à la compilation |

**Rejetée.** La perte de type-safety est un coût trop élevé pour le bénéfice.

### Alternative B — Feature flags génériques (LaunchDarkly-style)

Un système de feature flags clé/valeur par site, indépendant des modules.

| Pour | Contre |
|------|--------|
| Très flexible | Surcharge architecturale pour le contexte |
| Granularité fine | Ne s'intègre pas avec le système de plans existant |
| | Redondant avec `enabledModules` existant |
| | Nécessite une librairie ou un infra supplémentaire |

**Rejetée.** Le système existant (`enabledModules` + `PlanAbonnement.modulesInclus`) couvre déjà le besoin.

### Alternative C — Approche retenue (hybride enum + ModuleDefinition)

Conserver l'enum `SiteModule` comme clé forte, ajouter `ModuleDefinition` pour les métadonnées et la visibilité dynamique.

| Pour | Contre |
|------|--------|
| Type-safety préservée | Nouvel ajout de module requiert toujours une migration d'enum |
| Rétrocompatibilité totale | `ModuleDefinition` doit être synchronisé avec l'enum |
| Métadonnées extensibles sans migration | |
| Contrôle de visibilité sans déploiement | |
| Statistiques d'utilisation des modules | |

**Retenue.** Le compromis entre flexibilité et sécurité de type est optimal pour le contexte.

### Alternative D — Soft delete via champ `status` sur Site

Remplacer les 3 champs (`isActive`, `suspendedAt`, `deletedAt`) par un seul enum `SiteStatus`.

| Pour | Contre |
|------|--------|
| Modèle plus propre | Breaking change — `isActive` est utilisé dans ~15 queries existantes |
| Un seul champ à vérifier | Migration de données nécessaire |
| | Toutes les queries existantes doivent être mises à jour |

**Rejetée.** Le coût de migration est trop élevé. L'approche multi-champs avec un `SiteStatus` calculé côté TypeScript est plus prudente.

---

## 6. Conséquences

### 6.1 Positives
- DKFarm peut gérer le cycle de vie complet de tous ses sites client depuis une UI
- Les analytics donnent une vision business en temps réel (MRR, croissance, modules)
- Toute action admin est auditée et traçable
- Les modules peuvent être contrôlés finement par site indépendamment du plan
- `ModuleDefinition` permet d'enrichir les métadonnées des modules sans migration

### 6.2 Négatives
- `SiteAuditLog` ajoute un INSERT à chaque action admin → léger impact sur les mutations
- Le calcul de `SiteStatus` (ACTIVE/SUSPENDED/BLOCKED/ARCHIVED) doit être cohérent partout — centraliser dans `lib/queries/admin-sites.ts`
- `ModuleDefinition` doit être seedé avec les 12 modules existants dès le départ pour éviter les inconsistances

### 6.3 Fichiers impactés

| Fichier | Type de changement |
|---------|-------------------|
| `prisma/schema.prisma` | Nouveau modèle `ModuleDefinition`, nouveau modèle `SiteAuditLog`, champs `suspendedAt/suspendedReason/deletedAt` sur `Site` |
| `prisma/seed.sql` | Données pour `ModuleDefinition` (12 modules) |
| `src/types/models.ts` | Interfaces `ModuleDefinition`, `SiteAuditLog`, `SiteStatus` enum TS |
| `src/types/api.ts` | DTOs admin (voir section 3) |
| `src/lib/queries/admin-sites.ts` | Nouveau fichier |
| `src/lib/queries/admin-analytics.ts` | Nouveau fichier |
| `src/lib/permissions-constants.ts` | Ajout de `SITES_VOIR`, `SITES_GERER`, `ANALYTICS_PLATEFORME` |
| `src/types/models.ts` | Ajout des 3 nouveaux `Permission` values |
| `prisma/schema.prisma` | Ajout `SITES_VOIR`, `SITES_GERER`, `ANALYTICS_PLATEFORME` dans l'enum `Permission` |
| `src/components/layout/sidebar.tsx` | Module "Admin Plateforme" unifié, ajout des 4 nouvelles routes |
| `src/lib/permissions-constants.ts` | `PLATFORM_PERMISSIONS` étendu avec les 3 nouvelles permissions |
| `src/lib/permissions-constants.ts` | `ITEM_VIEW_PERMISSIONS` étendu avec les 4 nouvelles routes |

---

## 7. Décisions déléguées (hors scope de cet ADR)

- **Notifications automatiques** lors d'un changement de statut de site (email/SMS) — reporté à Phase 6
- **Auto-suspension** des sites avec abonnement expiré depuis > 30j — à implémenter dans le cron job existant (ADR-019)
- **Multi-langue des labels** de `ModuleDefinition` — le champ `label` est pour l'instant une string simple ; l'internationalisation sera traitée dans ADR-020 i18n si nécessaire

---

## 8. Références

- ADR-004 — Multi-tenancy (row-level siteId)
- ADR-011 — Sites supervisés et contrôle d'accès par module
- ADR-020 — Subscriptions & Memberships
- `src/lib/site-modules-config.ts` — configuration actuelle des modules
- `src/lib/auth/permissions-server.ts` — `getServerSiteModules()` et `getServerPermissions()`
- `src/lib/abonnements/apply-plan-modules.ts` — propagation des modules lors de l'activation d'un abonnement
