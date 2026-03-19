# ADR 018 — Module de Gestion des Utilisateurs

**Date :** 2026-03-19
**Mis à jour :** 2026-03-19 (ajout impersonation + permissions granulaires)
**Statut :** Proposee
**Auteur :** @architect
**Sprint :** A planifier (post-sprint 26)

---

## Contexte

Le module d'administration des utilisateurs est actuellement fragmenté. La gestion des membres existe sous `/settings/sites/[id]` mais elle est limitée au scope d'un site actif. Il n'existe aucun endroit dans l'application pour :

- Voir la liste de tous les utilisateurs de la plateforme
- Créer un utilisateur sans qu'il s'inscrive lui-même
- Modifier le profil, le mot de passe ou le rôle global d'un utilisateur existant
- Désactiver un compte utilisateur
- Voir sur quels sites un utilisateur est membre et avec quel rôle

Ce module complète le système existant d'authentification (Sprint 6) et de multi-tenancy (Sprint 7) sans en modifier les contrats. Il est destiné aux utilisateurs globaux `Role.ADMIN` et, partiellement, aux membres ayant `Permission.MEMBRES_GERER` sur leur site actif.

---

## Contraintes et hypothèses

1. **Deux niveaux de gestion** : global (platform-wide, `Role.ADMIN` uniquement) et site-scoped (`MEMBRES_GERER`).
2. **Séparation nette des responsabilités** : `/users` = gestion des comptes utilisateurs ; `/settings/sites/[id]` = gestion des memberships et rôles de site (existant, inchangé).
3. **Anti-escalation** : respectée en réutilisant `canAssignRole` et en interdisant à un non-ADMIN d'élever le `globalRole` d'un utilisateur.
4. **Mobile-first** : cartes empilées sur 360px, pas de tableaux.
5. **Règle R8** : aucun nouveau modèle Prisma n'est nécessaire pour ce module (les modèles `User`, `SiteMember`, `SiteRole` suffisent).
6. **Utilisateur système** : `isSystem = true` → exclu de toutes les listes.

---

## Décision

### Scope du module

Le module `/users` est un espace d'administration des **comptes** (identifiants, mot de passe, rôle global), distinct de la gestion des **memberships** (quel rôle sur quel site) qui reste dans `/settings/sites/[id]`.

| Fonctionnalité | Où | Permission requise |
|---|---|---|
| Lister tous les utilisateurs | `/users` | `UTILISATEURS_VOIR` ou `UTILISATEURS_GERER` |
| Créer un utilisateur | `/users/nouveau` | `UTILISATEURS_CREER` ou `UTILISATEURS_GERER` |
| Voir le profil d'un utilisateur | `/users/[id]` | `UTILISATEURS_VOIR` ou `UTILISATEURS_GERER` |
| Modifier nom/email/téléphone | `/users/[id]` | `UTILISATEURS_MODIFIER` ou `UTILISATEURS_GERER` |
| Changer le `globalRole` | `/users/[id]` | `UTILISATEURS_MODIFIER` ou `UTILISATEURS_GERER` |
| Changer le mot de passe | `/users/[id]` | `UTILISATEURS_GERER` |
| Forcer la déconnexion | `/users/[id]` | `UTILISATEURS_GERER` |
| Désactiver / réactiver un compte | `/users/[id]` | `UTILISATEURS_SUPPRIMER` ou `UTILISATEURS_GERER` |
| Voir les sites membres | `/users/[id]` (onglet Sites) | `UTILISATEURS_VOIR` ou `UTILISATEURS_GERER` |
| Se connecter en tant que l'utilisateur | `/users/[id]` (onglet Sécurité) | `UTILISATEURS_IMPERSONNER` |
| Arrêter l'impersonation | Bandeau global | Session authentifiée (impersonation active) |
| Ajouter/supprimer d'un site | `/settings/sites/[id]` | `MEMBRES_GERER` (inchangé) |

---

## Pages et routes UI

### Arbre des pages

```
src/app/users/
├── page.tsx                  — liste des utilisateurs (Server Component)
├── nouveau/
│   └── page.tsx              — formulaire création (Server Component + Client Form)
└── [id]/
    └── page.tsx              — détail / édition (Server Component + Client Tabs)
```

### Page `/users` — Liste

**Layout mobile (360px)**
- En-tête : titre "Utilisateurs" + bouton "Ajouter" (si ADMIN)
- Barre de recherche (filtre client sur nom/email/téléphone)
- Filtre par `globalRole` (Radix Select ou chips) : Tous | Admin | Gérant | Pisciculteur | Ingénieur
- Cartes empilées, une par utilisateur :
  ```
  ┌─────────────────────────────────────────────┐
  │  [Avatar initiales]  Nom Prénom             │
  │                      admin@example.com       │
  │                      +237 6XX XX XX XX       │
  │  Badge: ADMIN        2 sites • Actif         │
  │  [Voir le profil →]                          │
  └─────────────────────────────────────────────┘
  ```
- Pagination ou scroll infini (25 par page)

**Layout desktop** : même structure, 2 colonnes max en grille

### Page `/users/nouveau` — Création

**Formulaire Server-rendered + Client submit**
- Champ Nom (obligatoire)
- Champ Email (optionnel si téléphone renseigné)
- Champ Téléphone (optionnel si email renseigné)
- Champ Mot de passe (min 6 caractères)
- Select Rôle global (Radix Select) : ADMIN | GERANT | PISCICULTEUR | INGENIEUR
- Bouton "Créer l'utilisateur"
- Validation inline : mêmes règles que `/api/auth/register`
- Après création : redirect vers `/users/[id]`

### Page `/users/[id]` — Détail et édition

**Radix Tabs** : "Profil" | "Sécurité" | "Sites"

**Onglet Profil**
- Affiche et permet d'éditer : nom, email, téléphone
- Badge rôle global avec Select pour le changer (ADMIN only)
- Badge statut actif/désactivé + bouton bascule "Désactiver / Réactiver"
- Utilisateur système : affichage lecture seule, aucun bouton d'édition

**Onglet Sécurité**
- Formulaire "Changer le mot de passe" (nouveau mot de passe + confirmation)
- Bouton "Forcer la déconnexion" (supprime toutes les sessions de l'utilisateur)

**Onglet Sites**
- Liste des memberships de l'utilisateur (lecture seule dans ce contexte)
- Pour chaque site : nom du site, nom du rôle de site, statut actif/inactif
- Lien "Gérer dans les paramètres du site" → `/settings/sites/[siteId]`
- Permet de voir l'empreinte multi-site sans créer de duplication de la gestion des roles

---

## API Routes

### Conventions

Les routes `/api/users/*` ne requièrent plus un `requireGlobalAdmin` monolithique. Chaque route vérifie la permission granulaire la plus fine applicable (voir tableau dans la section Permissions). Un helper `requireHasPermission(request, ...permissions)` est ajouté dans `src/lib/auth/index.ts` : il accepte plusieurs permissions et passe si l'utilisateur en possède au moins une.

```
GET    /api/users                       — lister les utilisateurs
POST   /api/users                       — créer un utilisateur
GET    /api/users/[id]                  — obtenir le profil complet
PATCH  /api/users/[id]                  — modifier profil ou statut
POST   /api/users/[id]/password         — changer le mot de passe
POST   /api/users/[id]/sessions         — forcer la déconnexion (supprime toutes les sessions)
GET    /api/users/[id]/memberships      — lister les sites membres
POST   /api/users/[id]/impersonate      — démarrer une impersonation
DELETE /api/users/impersonate           — arrêter l'impersonation en cours
```

### Contrats détaillés

#### `GET /api/users`

Query params :
- `search?: string` — filtre nom/email/téléphone (ILIKE)
- `role?: Role` — filtre par globalRole
- `isActive?: boolean` — filtre statut (défaut : inclut tous)
- `page?: number` (défaut : 1), `limit?: number` (défaut : 25)

Response `200` :
```typescript
interface UsersListResponse {
  users: UserSummary[];
  total: number;
  page: number;
  limit: number;
}

interface UserSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: Role;
  isActive: boolean;
  isSystem: boolean;
  siteCount: number;         // nombre de memberships actifs
  createdAt: string;
}
```

#### `POST /api/users`

Request body :
```typescript
interface CreateUserAdminDTO {
  name: string;
  email?: string;             // au moins email ou phone
  phone?: string;
  password: string;           // min 6 caractères
  globalRole?: Role;          // défaut : PISCICULTEUR
}
```

Response `201` : `UserSummary`

Erreurs : `400` validation, `409` email/téléphone déjà utilisé

#### `GET /api/users/[id]`

Response `200` :
```typescript
interface UserDetailResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: Role;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}
```

#### `PATCH /api/users/[id]`

Request body (tous les champs optionnels) :
```typescript
interface UpdateUserAdminDTO {
  name?: string;
  email?: string;
  phone?: string;
  globalRole?: Role;
  isActive?: boolean;
}
```

Response `200` : `UserDetailResponse`

Garde-fous :
- Interdit de modifier un utilisateur système (`isSystem = true`) → `403`
- Interdit de désactiver le seul ADMIN de la plateforme → `409`

#### `POST /api/users/[id]/password`

Request body :
```typescript
interface ResetPasswordAdminDTO {
  newPassword: string;   // min 6 caractères
}
```

Response `200` : `{ success: true }`

#### `POST /api/users/[id]/sessions` (force logout)

Request body : vide

Response `200` : `{ deletedCount: number }`

Implémentation : `prisma.session.deleteMany({ where: { userId: id } })`

#### `GET /api/users/[id]/memberships`

Response `200` :
```typescript
interface UserMembershipsResponse {
  memberships: UserMembership[];
  total: number;
}

interface UserMembership {
  id: string;            // SiteMember.id
  siteId: string;
  siteName: string;
  siteRoleId: string;
  siteRoleName: string;
  isActive: boolean;
  joinedAt: string;
}
```

---

## Composants UI à créer

### Arbre des composants

```
src/components/users/
├── users-list-client.tsx         — liste filtrée ("use client", Radix Tabs pour filtres)
├── user-card.tsx                 — carte individuelle (Server Component)
├── user-create-form.tsx          — formulaire création ("use client")
├── user-profile-tab.tsx          — onglet Profil ("use client")
├── user-security-tab.tsx         — onglet Sécurité + bouton impersonation ("use client")
├── user-memberships-tab.tsx      — onglet Sites (Server Component)
├── user-role-badge.tsx           — badge rôle coloré (Server Component)
└── impersonation-banner.tsx      — bandeau global d'impersonation ("use client")
```

### Détails de chaque composant

**`users-list-client.tsx`**
- Props : `users: UserSummary[], currentUserId: string`
- State client : `search`, `roleFilter`
- Filtrage côté client (données pré-chargées par le Server Component parent)
- Radix `Select` pour le filtre de rôle
- Pas de tableau : liste de `UserCard`

**`user-card.tsx`**
- Props : `user: UserSummary`
- Avatar : initiales dans un cercle coloré (couleur dérivée du rôle)
- Badge `globalRole` : couleur distincte par rôle (ADMIN = rouge, GERANT = orange, PISCICULTEUR = vert, INGENIEUR = bleu)
- Statut actif/inactif : point coloré
- Lien vers `/users/[id]`

**`user-create-form.tsx`**
- "use client"
- Utilise Radix `Select` pour le rôle
- Validation inline avant submit
- Toast (Radix `Toast`) pour succès/erreur
- Après succès : `router.push("/users/" + newId)`

**`user-profile-tab.tsx`**
- "use client"
- Formulaire inline éditable (champs en mode lecture jusqu'au clic "Modifier")
- Radix `AlertDialog` pour confirmer désactivation de compte
- Radix `Select` pour changer le globalRole

**`user-security-tab.tsx`**
- "use client"
- Formulaire mot de passe avec champ "Nouveau mot de passe" + "Confirmer" (requiert `UTILISATEURS_GERER`)
- Radix `AlertDialog` pour confirmer la déconnexion forcée (requiert `UTILISATEURS_GERER`)
- Section "Impersonation" visible uniquement si le caller a `Permission.UTILISATEURS_IMPERSONNER`
  - Bouton "Se connecter en tant que cet utilisateur" désactivé si la cible est ADMIN, isSystem ou inactive
  - Radix `AlertDialog` pour confirmer avant de démarrer
  - Après confirmation : `POST /api/users/[id]/impersonate` puis `router.push("/")`

**`user-memberships-tab.tsx`**
- Server Component (données fraîches à chaque affichage)
- Liste de cartes de membership : nom du site, badge rôle de site, statut
- Lien vers `/settings/sites/[siteId]`

**`user-role-badge.tsx`**
- Map `Role → { label: string, colorClass: string }`
- `ADMIN` → "Administrateur global" / rouge
- `GERANT` → "Gérant" / orange
- `PISCICULTEUR` → "Pisciculteur" / vert
- `INGENIEUR` → "Ingénieur" / bleu

---

## Intégration dans la navigation

### Principe de visibilité

Le module `/users` est réservé aux `Role.ADMIN`. Il ne doit pas apparaître dans la navigation des autres rôles. La vérification se fait via le `role` déjà passé aux composants `Sidebar` et `BottomNav`.

### Sidebar (`src/components/layout/sidebar.tsx`)

Ajouter un item conditionnel dans le module `Configuration` uniquement si `role === Role.ADMIN` :

```
Configuration
├── Sites                          (existant)
├── Profils d'élevage              (existant)
├── Config. alertes                (existant)
├── Règles d'activités             (existant)
└── Utilisateurs          [ADMIN]  (nouveau)
```

Concrètement dans `modulesAdminGerant`, l'item `/users` est ajouté dans le module `Configuration`. La gate de navigation utilise `Permission.UTILISATEURS_VOIR` (définie dans la section Permissions granulaires), ce qui permet à terme de déléguer un accès lecture seule sans accorder `SITE_GERER`.

### BottomNav (`src/components/layout/bottom-nav.tsx`)

Le menu "Plus" (bouton `LayoutGrid` → `openMenu`) ouvre le `MobileMenu`. Ce panneau contient les modules secondaires. Ajouter `/users` dans la liste des modules visibles du `MobileMenu` uniquement quand `role === Role.ADMIN`.

Les 4 slots fixes du BottomNav (`adminGerantItems`) ne changent pas — l'accès à la gestion des utilisateurs passe par le menu "Plus", ce qui est cohérent avec son caractère d'administration peu fréquente.

### Module nav contextuel (`src/lib/module-nav-items.ts`)

Ajouter une entrée dans `MODULE_NAV` pour que, quand on est dans `/users`, le BottomNav affiche les sous-pages du module Utilisateurs :

```typescript
{
  label: "Utilisateurs",
  matchPaths: ["/users"],
  items: [
    { href: "/users", label: "Liste", icon: Users },
    { href: "/users/nouveau", label: "Nouveau", icon: UserPlus },
  ],
}
```

Cela donne un BottomNav contextuel à 2 items quand on navigue dans `/users/*`.

### Bandeau d'impersonation dans le layout global

Le bandeau `ImpersonationBanner` est rendu dans `src/app/layout.tsx` au-dessus de tout le contenu quand `session.isImpersonating === true`. Il est positionné en `fixed top-0` avec un `z-50` supérieur à la sidebar et à la bottom-nav. Le layout doit ajouter un `padding-top` compensatoire sur le conteneur principal quand le bandeau est actif pour éviter que le contenu soit masqué.

Le bandeau ne fait pas partie du système de navigation de module (il n'apparaît pas dans `MODULE_NAV` ni dans la `Sidebar`) — c'est une surcouche transversale indépendante de la page courante.

---

## Queries à ajouter

### Nouveau fichier `src/lib/queries/users-admin.ts`

Séparer des requêtes d'admin des requêtes auth (qui sont dans `users.ts`) pour respecter le principe de responsabilité unique.

```typescript
// Fonctions à définir (signatures, sans implémentation)

/** Lister les utilisateurs avec filtres et pagination (exclut isSystem) */
export async function listUsers(filters: {
  search?: string;
  role?: Role;
  isActive?: boolean;
  page: number;
  limit: number;
}): Promise<{ users: UserWithSiteCount[]; total: number }>;

/** Profil complet d'un utilisateur */
export async function getUserAdminDetail(id: string): Promise<UserAdminDetail | null>;

/** Mettre à jour le profil d'un utilisateur */
export async function updateUserAdmin(
  id: string,
  data: { name?: string; email?: string; phone?: string; globalRole?: Role; isActive?: boolean }
): Promise<UserAdminDetail>;

/** Compter les ADMIN actifs (pour empêcher la désactivation du dernier) */
export async function countActiveAdmins(): Promise<number>;

/** Lister les memberships d'un utilisateur */
export async function getUserMemberships(userId: string): Promise<UserMembershipItem[]>;
```

### Types locaux pour les queries

```typescript
// Dans src/lib/queries/users-admin.ts ou src/types/models.ts

interface UserWithSiteCount {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: Role;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  _count: { members: number };
}

interface UserAdminDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: Role;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserMembershipItem {
  id: string;
  siteId: string;
  siteName: string;
  siteRoleId: string;
  siteRoleName: string;
  isActive: boolean;
  createdAt: Date;
}
```

---

## Types TypeScript à ajouter

### Dans `src/types/auth.ts`

```typescript
/** Corps de la requête POST /api/users — création par un admin */
export interface CreateUserAdminDTO {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  globalRole?: Role;
}

/** Corps de la requête PATCH /api/users/[id] */
export interface UpdateUserAdminDTO {
  name?: string;
  email?: string;
  phone?: string;
  globalRole?: Role;
  isActive?: boolean;
}

/** Corps de la requête POST /api/users/[id]/password */
export interface ResetPasswordAdminDTO {
  newPassword: string;
}
```

### Dans `src/types/api.ts`

```typescript
/** Réponse GET /api/users */
export interface UsersListResponse {
  users: UserSummaryResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface UserSummaryResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: Role;
  isActive: boolean;
  isSystem: boolean;
  siteCount: number;
  createdAt: string;
}

/** Réponse GET /api/users/[id] */
export interface UserDetailResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: Role;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Réponse GET /api/users/[id]/memberships */
export interface UserMembershipsResponse {
  memberships: UserMembershipResponse[];
  total: number;
}

export interface UserMembershipResponse {
  id: string;
  siteId: string;
  siteName: string;
  siteRoleId: string;
  siteRoleName: string;
  isActive: boolean;
  joinedAt: string;
}
```

---

## Permissions granulaires

Le module introduit six permissions dédiées qui remplacent la seule valeur `UTILISATEURS_GERER` mentionnée dans le plan initial. Chaque permission correspond à une capacité distincte et peut être attribuée indépendamment sur un `SiteRole`.

### Les six permissions

| Permission | Valeur enum | Capacité |
|---|---|---|
| `UTILISATEURS_VOIR` | `"UTILISATEURS_VOIR"` | Lire la liste des utilisateurs et leur profil |
| `UTILISATEURS_CREER` | `"UTILISATEURS_CREER"` | Créer un nouveau compte utilisateur |
| `UTILISATEURS_MODIFIER` | `"UTILISATEURS_MODIFIER"` | Modifier le profil (nom, email, téléphone, rôle global) |
| `UTILISATEURS_SUPPRIMER` | `"UTILISATEURS_SUPPRIMER"` | Désactiver ou réactiver un compte |
| `UTILISATEURS_GERER` | `"UTILISATEURS_GERER"` | Gestion complète : inclut toutes les capacités ci-dessus + reset de mot de passe + déconnexion forcée |
| `UTILISATEURS_IMPERSONNER` | `"UTILISATEURS_IMPERSONNER"` | Démarrer une session d'impersonation — privilège le plus élevé, séparé volontairement |

### Hiérarchie implicite

`UTILISATEURS_GERER` est un "macro-droit" qui englobe les quatre permissions granulaires. En pratique, le rôle système "Administrateur" reçoit `UTILISATEURS_GERER` + `UTILISATEURS_IMPERSONNER`. Un rôle "Support lecture seule" hypothétique ne recevrait que `UTILISATEURS_VOIR`.

Les routes API vérifient la permission la plus fine applicable :

| Route | Permission requise |
|---|---|
| `GET /api/users` | `UTILISATEURS_VOIR` ou `UTILISATEURS_GERER` |
| `GET /api/users/[id]` | `UTILISATEURS_VOIR` ou `UTILISATEURS_GERER` |
| `POST /api/users` | `UTILISATEURS_CREER` ou `UTILISATEURS_GERER` |
| `PATCH /api/users/[id]` (profil) | `UTILISATEURS_MODIFIER` ou `UTILISATEURS_GERER` |
| `PATCH /api/users/[id]` (isActive) | `UTILISATEURS_SUPPRIMER` ou `UTILISATEURS_GERER` |
| `POST /api/users/[id]/password` | `UTILISATEURS_GERER` |
| `POST /api/users/[id]/sessions` | `UTILISATEURS_GERER` |
| `GET /api/users/[id]/memberships` | `UTILISATEURS_VOIR` ou `UTILISATEURS_GERER` |
| `POST /api/users/[id]/impersonate` | `UTILISATEURS_IMPERSONNER` |
| `DELETE /api/users/impersonate` | Toute session active (l'impersonateur met fin lui-même) |

### Ajouts dans les fichiers de permissions

```typescript
// src/types/models.ts — dans enum Permission (groupe utilisateurs)
UTILISATEURS_VOIR        = "UTILISATEURS_VOIR",
UTILISATEURS_CREER       = "UTILISATEURS_CREER",
UTILISATEURS_MODIFIER    = "UTILISATEURS_MODIFIER",
UTILISATEURS_SUPPRIMER   = "UTILISATEURS_SUPPRIMER",
UTILISATEURS_GERER       = "UTILISATEURS_GERER",
UTILISATEURS_IMPERSONNER = "UTILISATEURS_IMPERSONNER",
```

```typescript
// src/lib/permissions-constants.ts — nouveau groupe
utilisateurs: [
  Permission.UTILISATEURS_VOIR,
  Permission.UTILISATEURS_CREER,
  Permission.UTILISATEURS_MODIFIER,
  Permission.UTILISATEURS_SUPPRIMER,
  Permission.UTILISATEURS_GERER,
  Permission.UTILISATEURS_IMPERSONNER,
],
```

```typescript
// src/lib/permissions-constants.ts — group administration (mis à jour)
administration: [
  Permission.SITE_GERER,
  Permission.MEMBRES_GERER,
  Permission.UTILISATEURS_VOIR,
  Permission.UTILISATEURS_CREER,
  Permission.UTILISATEURS_MODIFIER,
  Permission.UTILISATEURS_SUPPRIMER,
  Permission.UTILISATEURS_GERER,
  Permission.UTILISATEURS_IMPERSONNER,
],
```

```typescript
// src/lib/permissions-constants.ts — gates de navigation
ITEM_VIEW_PERMISSIONS["/users"] = Permission.UTILISATEURS_VOIR;
// L'item "Nouveau" dans le module contextuel :
ITEM_VIEW_PERMISSIONS["/users/nouveau"] = Permission.UTILISATEURS_CREER;
```

### Attribution aux rôles système

| Rôle système | Permissions utilisateurs reçues |
|---|---|
| Administrateur | Toutes les 6 (`UTILISATEURS_GERER` + `UTILISATEURS_IMPERSONNER` impliquent les autres) |
| Gérant | Aucune (gestion des membres de site uniquement via `MEMBRES_GERER`) |
| Pisciculteur | Aucune |

La migration Prisma doit ajouter les six valeurs à l'enum `Permission` dans PostgreSQL. Utiliser la stratégie RECREATE déjà documentée (renommer, recréer, caster, supprimer l'ancien type).

---

## Impersonation

### Objectif

L'impersonation permet à un administrateur de se connecter en tant qu'un autre utilisateur — il voit l'application exactement comme cet utilisateur la voit, avec ses permissions de site, son site actif et son rôle global. C'est un outil de débogage et de support, pas une fonctionnalité métier régulière.

### Principe de fonctionnement : session augmentée

L'approche choisie est de **stocker `originalUserId` dans la ligne `Session` existante** plutôt que de créer un second cookie ou un token séparé. Cela préserve le mécanisme de session unique et simplifie la détection de l'état d'impersonation.

#### Pourquoi cette approche et pas une autre

| Approche | Verdict | Raison |
|---|---|---|
| Nouveau cookie `impersonate_token` | Rejete | Double cookie, complexité CORS/sameSite, risque de désynchronisation |
| JWT signé côté client | Rejete | Pas de JWT dans le projet, rupture de cohérence |
| Nouvelle table `ImpersonationSession` | Surdimensionne | Complique le middleware pour peu de bénéfice |
| `originalUserId` sur `Session` (retenu) | Retenu | Un seul cookie inchangé, middleware minimal, réversible atomiquement |

#### Changement Prisma requis

Ajouter un champ nullable sur le modèle `Session` :

```prisma
model Session {
  id             String   @id @default(cuid())
  sessionToken   String   @unique
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  activeSiteId   String?
  activeSite     Site?    @relation(fields: [activeSiteId], references: [id])
  expires        DateTime
  createdAt      DateTime @default(now())
  // Impersonation — non null uniquement lors d'une session d'impersonation
  originalUserId String?
  originalUser   User?    @relation("OriginalUser", fields: [originalUserId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([activeSiteId])
  @@index([originalUserId])
}
```

La relation `originalUser` nécessite un nom de relation distinct (`"OriginalUser"`) car `User` a déjà une relation `sessions` vers `Session`. Une entrée `originalSessions Session[] @relation("OriginalUser")` est ajoutée côté `User`.

#### Comportement du middleware / `getSession`

La fonction `getSession` dans `src/lib/auth/session.ts` est modifiée pour exposer l'état d'impersonation dans `UserSession` :

```typescript
// Ajout dans UserSession (src/types/auth.ts)
export interface UserSession {
  userId: string;          // ID de l'utilisateur actif (la cible lors d'impersonation)
  email: string | null;
  phone: string | null;
  name: string;
  role: Role;
  activeSiteId: string | null;
  // Impersonation
  isImpersonating: boolean;
  originalUserId: string | null;   // ID du vrai admin connecté
  originalUserName: string | null; // Nom du vrai admin (pour le bandeau)
}
```

Dans `getSession` et `getServerSession`, lire `session.originalUserId` depuis la DB. Quand non null, la session est une impersonation :
- `userId` = `session.userId` (la cible) — toutes les requêtes Prisma fonctionnent sans changement
- `isImpersonating` = `true`
- `originalUserId` = `session.originalUserId`
- `originalUserName` = nom de l'utilisateur original (chargé via `include`)

Quand `isImpersonating` est `false`, `originalUserId` et `originalUserName` sont `null`.

### API Routes d'impersonation

#### `POST /api/users/[id]/impersonate` — Démarrer l'impersonation

Protection : `requireHasPermission(request, Permission.UTILISATEURS_IMPERSONNER)`.

Ce helper vérifie à la fois que l'utilisateur est `Role.ADMIN` global **et** que `isImpersonating === false` dans la session courante (interdit d'imbriquer des impersonations).

```typescript
// Request body : vide
// Response 200 :
interface StartImpersonationResponse {
  success: true;
  targetUser: {
    id: string;
    name: string;
    email: string | null;
  };
}
```

Logique :
1. Valider que le caller a `Permission.UTILISATEURS_IMPERSONNER`
2. Vérifier que le caller n'est pas déjà en train d'impersonner (`originalUserId IS NULL`) → `409`
3. Charger l'utilisateur cible : vérifier qu'il existe, est actif, n'est pas `isSystem` → `404` / `403`
4. Interdire d'impersonner un `Role.ADMIN` → `403` avec message explicite
5. Mettre à jour la session courante dans Prisma :
   ```typescript
   await prisma.session.update({
     where: { sessionToken: currentToken },
     data: {
       userId: targetUser.id,
       originalUserId: adminUserId,
       // activeSiteId → choisir le premier site actif de la cible, ou null
       activeSiteId: firstActiveSiteOfTarget ?? null,
     },
   });
   ```
6. Retourner `200` (pas de `Set-Cookie` : le token de session ne change pas)

#### `DELETE /api/users/impersonate` — Arrêter l'impersonation

Protection : n'importe quelle session authentifiée (la cible peut théoriquement appuyer sur "Arrêter", mais en pratique seul le bandeau admin y accède).

```typescript
// Request body : vide
// Response 200 :
interface StopImpersonationResponse {
  success: true;
}
```

Logique :
1. `requireAuth(request)` — obtenir la session
2. Vérifier que `session.originalUserId` est non null → si null, `409` ("Vous n'êtes pas en mode impersonation")
3. Mettre à jour la session dans Prisma :
   ```typescript
   await prisma.session.update({
     where: { sessionToken: currentToken },
     data: {
       userId: session.originalUserId,   // restaurer l'admin
       originalUserId: null,
       activeSiteId: null,               // l'admin rechoisira son site
     },
   });
   ```
4. Retourner `200` — le client redirige vers `/`

### Composants UI d'impersonation

#### `impersonation-banner.tsx`

C'est le composant le plus visible du module d'impersonation. Il doit être monté dans le layout racine (`src/app/layout.tsx`) et s'afficher uniquement quand `isImpersonating === true`.

```
src/components/users/
└── impersonation-banner.tsx   — bandeau global ("use client")
```

**Apparence (mobile-first)**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Vous consultez l'application en tant que Jean Dupont (Pisciculteur) │
│                                             [Reprendre ma session]   │
└──────────────────────────────────────────────────────────────────────┘
```

- Fond : `bg-amber-500 text-white` (couleur d'avertissement, pas le thème primary)
- Position : bannière fixe en haut, `z-50`, au-dessus de la sidebar et de la bottom-nav
- Sur 360px : texte tronqué + bouton pleine largeur en dessous
- Sur desktop : texte + bouton sur une même ligne

**Props**

```typescript
interface ImpersonationBannerProps {
  targetUserName: string;
  targetUserRole: Role;
  originalUserName: string;
}
```

**Comportement**

- Bouton "Reprendre ma session" → `DELETE /api/users/impersonate` → `router.push("/")`
- Pendant le chargement du DELETE : spinner sur le bouton, désactivé
- Radix `Toast` en cas d'erreur réseau

**Intégration dans `src/app/layout.tsx`**

Le layout reçoit la session via `getServerSession()`. Si `isImpersonating === true`, rendre `<ImpersonationBanner>` avant le reste du contenu :

```tsx
// src/app/layout.tsx (extrait Server Component)
const session = await getServerSession();

return (
  <html>
    <body>
      {session?.isImpersonating && (
        <ImpersonationBannerWrapper
          targetUserName={session.name}
          targetUserRole={session.role}
          originalUserName={session.originalUserName!}
        />
      )}
      {/* ... reste du layout ... */}
    </body>
  </html>
);
```

`ImpersonationBannerWrapper` est un Server Component léger qui passe les données au Client Component `ImpersonationBanner`.

#### Bouton "Impersonner" dans `user-security-tab.tsx`

Le bouton d'impersonation est placé dans l'onglet "Sécurité" de la page `/users/[id]` :

- Visible uniquement si le caller a `Permission.UTILISATEURS_IMPERSONNER`
- Désactivé si la cible est `Role.ADMIN`, `isSystem`, ou inactif
- Radix `AlertDialog` pour confirmation : "Vous allez vous connecter en tant que [Nom]. Continuer ?"
- Après confirmation : `POST /api/users/[id]/impersonate` → `router.push("/")`
- Wording du bouton : "Se connecter en tant que cet utilisateur"

### Invariants de sécurité de l'impersonation

| Invariant | Enforcement |
|---|---|
| Seul un admin avec `UTILISATEURS_IMPERSONNER` peut démarrer | `requireHasPermission` côté API |
| Impossible d'impersonner un `Role.ADMIN` | Vérification sur `targetUser.role` avant update |
| Impossible d'imbriquer deux impersonations | Vérification `originalUserId IS NULL` avant update |
| Impossible d'impersonner un compte inactif ou système | Vérification `isActive && !isSystem` |
| L'impersonation ne crée pas de nouveau token | La session existante est modifiée in-place |
| Le bandeau ne peut pas être contourné côté client | `isImpersonating` lu côté serveur à chaque Server Component render |
| Arrêter l'impersonation réinitialise `activeSiteId` à null | L'admin doit rechoisir son site → workflow naturel |

---

## Flux de données

### Chargement de la liste `/users`

```
Page (Server Component)
  └── getServerSession()           → vérifie role === ADMIN, sinon redirect
  └── listUsers(filters)           → Prisma query avec _count.members
  └── <UsersListClient users={...} />
        └── filtre/recherche côté client (état local React)
        └── <UserCard /> × N
```

### Création d'un utilisateur

```
POST /api/users
  └── requireHasPermission(request, UTILISATEURS_CREER, UTILISATEURS_GERER)
  └── Validation (nom, email/phone, password)
  └── Unicité email + phone (getUserByEmail, getUserByPhone)
  └── hashPassword()
  └── createUser()
  └── 201 { ...UserSummaryResponse }
```

### Modification de profil

```
PATCH /api/users/[id]
  └── requireHasPermission(request, UTILISATEURS_MODIFIER, UTILISATEURS_GERER)
        // Si body contient isActive → exiger aussi UTILISATEURS_SUPPRIMER ou UTILISATEURS_GERER
  └── Charger utilisateur cible (vérifier !isSystem)
  └── Si isActive: false → countActiveAdmins() → si 1, rejeter
  └── updateUserAdmin(id, data)
  └── 200 { ...UserDetailResponse }
```

### Forcer la déconnexion

```
POST /api/users/[id]/sessions
  └── requireHasPermission(request, UTILISATEURS_GERER)
  └── prisma.session.deleteMany({ where: { userId: id } })
  └── 200 { deletedCount }
```

### Démarrer une impersonation

```
POST /api/users/[id]/impersonate
  └── requireHasPermission(request, UTILISATEURS_IMPERSONNER)
  └── Vérifier session.originalUserId === null (pas déjà en impersonation) → 409
  └── Charger utilisateur cible
        ├── notFound → 404
        ├── isSystem → 403
        ├── !isActive → 403
        └── role === ADMIN → 403 "Impossible d'impersonner un administrateur"
  └── Trouver le premier SiteMember actif de la cible → firstActiveSiteId
  └── prisma.session.update({
        where: { sessionToken: currentToken },
        data: {
          userId: targetId,
          originalUserId: adminId,
          activeSiteId: firstActiveSiteId ?? null,
        },
      })
  └── 200 { success: true, targetUser: { id, name, email } }
  // Le client reçoit 200 et redirige vers "/"
  // Aucun nouveau Set-Cookie — le token ne change pas
```

### Arrêter une impersonation

```
DELETE /api/users/impersonate
  └── requireAuth(request)
  └── Vérifier session.originalUserId !== null → sinon 409
  └── prisma.session.update({
        where: { sessionToken: currentToken },
        data: {
          userId: session.originalUserId,
          originalUserId: null,
          activeSiteId: null,
        },
      })
  └── 200 { success: true }
  // Le client reçoit 200 et redirige vers "/"
  // L'admin se retrouve sans site actif → workflow normal de sélection de site
```

---

## Considérations de sécurité

| Risque | Mitigation |
|--------|-----------|
| Escalade de privilèges | Permissions granulaires vérifiées route par route via `requireHasPermission` |
| Désactivation du dernier admin | Guard `countActiveAdmins()` avant isActive=false sur un ADMIN |
| Modification de l'utilisateur système | Vérification `isSystem === true` → 403 |
| Exposition du passwordHash | Jamais inclus dans les réponses API |
| Session zombie après désactivation | `getSession` vérifie `user.isActive` à chaque appel |
| Impersonation d'un ADMIN | Rejetée avec 403 avant toute écriture en base |
| Impersonation imbriquée | Rejetée avec 409 si `originalUserId IS NOT NULL` dans la session |
| Impersonation d'un compte inactif ou système | Rejetée avec 403 / 404 avant toute écriture |
| Contournement du bandeau côté client | `isImpersonating` lu côté serveur à chaque render du Server Component |
| Vol de la session pendant l'impersonation | Token inchangé, cookie httpOnly, mêmes garanties que la session ordinaire |
| Action admin non intentionnelle pendant l'impersonation | Le caller n'a que les permissions de la cible — aucun accès à `/api/users/*` pendant l'impersonation |

---

## Décisions différées

1. **Invitation par email** : un admin pourrait inviter un utilisateur par email (lien d'inscription pré-rempli). Différé car nécessite un service d'envoi d'emails.
2. **Historique des actions** : journalisation de qui a créé/modifié/désactivé quel utilisateur, et de qui a impersonné qui. Différé — un log applicatif console suffit pour l'instant, avec les champs `userId` + `originalUserId` déjà tracés dans la session.
3. **Recherche server-side** : la recherche est actuellement côté client (données pré-chargées). Basculer vers `?search=` server-side si la liste dépasse 500 utilisateurs.
4. **Timeout d'impersonation** : une impersonation pourrait expirer automatiquement après N minutes. Différé — la session expire normalement à 30 jours, le bandeau reste visible jusqu'à ce que l'admin clique "Reprendre".
5. **Journal d'impersonation** : enregistrer chaque démarrage/arrêt d'impersonation dans une table d'audit. Différé au même sprint que l'historique des actions (point 2).

---

## Types TypeScript à ajouter pour l'impersonation

### Dans `src/types/auth.ts`

```typescript
// Mise à jour de UserSession — ajouter les champs impersonation
export interface UserSession {
  userId: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: Role;
  activeSiteId: string | null;
  // Impersonation
  isImpersonating: boolean;
  originalUserId: string | null;
  originalUserName: string | null;
}

// Réponse POST /api/users/[id]/impersonate
export interface StartImpersonationResponse {
  success: true;
  targetUser: {
    id: string;
    name: string;
    email: string | null;
  };
}

// Réponse DELETE /api/users/impersonate
export interface StopImpersonationResponse {
  success: true;
}
```

---

## Fichiers à créer ou modifier

### Pages et API Routes

| Fichier | Action | Notes |
|---------|--------|-------|
| `src/app/users/page.tsx` | Créer | Liste Server Component |
| `src/app/users/nouveau/page.tsx` | Créer | Formulaire création |
| `src/app/users/[id]/page.tsx` | Créer | Détail avec Tabs |
| `src/app/api/users/route.ts` | Créer | GET + POST |
| `src/app/api/users/[id]/route.ts` | Créer | GET + PATCH |
| `src/app/api/users/[id]/password/route.ts` | Créer | POST |
| `src/app/api/users/[id]/sessions/route.ts` | Créer | POST (force logout) |
| `src/app/api/users/[id]/memberships/route.ts` | Créer | GET |
| `src/app/api/users/[id]/impersonate/route.ts` | Créer | POST (démarrer) |
| `src/app/api/users/impersonate/route.ts` | Créer | DELETE (arrêter) |

### Composants

| Fichier | Action | Notes |
|---------|--------|-------|
| `src/components/users/users-list-client.tsx` | Créer | "use client" |
| `src/components/users/user-card.tsx` | Créer | Server Component |
| `src/components/users/user-create-form.tsx` | Créer | "use client" |
| `src/components/users/user-profile-tab.tsx` | Créer | "use client" |
| `src/components/users/user-security-tab.tsx` | Créer | "use client", inclut impersonation |
| `src/components/users/user-memberships-tab.tsx` | Créer | Server Component |
| `src/components/users/user-role-badge.tsx` | Créer | Server Component |
| `src/components/users/impersonation-banner.tsx` | Créer | "use client", bandeau global |
| `src/app/layout.tsx` | Modifier | Ajouter `ImpersonationBanner` conditionnel |

### Couche de données et types

| Fichier | Action | Notes |
|---------|--------|-------|
| `src/lib/queries/users-admin.ts` | Créer | Requêtes admin séparées de `users.ts` |
| `src/lib/auth/session.ts` | Modifier | `getSession` / `getServerSession` exposent `isImpersonating`, `originalUserId`, `originalUserName` |
| `src/lib/auth/index.ts` | Modifier | Ajouter `requireHasPermission` (remplace `requireGlobalAdmin`) |
| `src/types/auth.ts` | Modifier | `UserSession` + DTOs admin + DTOs impersonation |
| `src/types/api.ts` | Modifier | Response types utilisateurs + impersonation |
| `src/types/index.ts` | Modifier | Barrel exports des nouveaux types |

### Permissions et navigation

| Fichier | Action | Notes |
|---------|--------|-------|
| `src/types/models.ts` | Modifier | 6 nouvelles valeurs dans enum `Permission` |
| `src/lib/permissions-constants.ts` | Modifier | Nouveau groupe `utilisateurs`, gates nav `/users` et `/users/nouveau` |
| `src/lib/module-nav-items.ts` | Modifier | Nouveau module `Utilisateurs` avec matchPaths `["/users"]` |
| `src/components/layout/sidebar.tsx` | Modifier | Item "Utilisateurs" dans module Configuration |

### Prisma et migration

| Fichier | Action | Notes |
|---------|--------|-------|
| `prisma/schema.prisma` | Modifier | 6 valeurs enum + champ `originalUserId` + relation `originalUser` sur `Session` + `originalSessions` sur `User` |
| Migration Prisma | Créer | Stratégie RECREATE pour les 6 nouvelles valeurs d'enum + `ALTER TABLE session ADD COLUMN original_user_id TEXT` |
