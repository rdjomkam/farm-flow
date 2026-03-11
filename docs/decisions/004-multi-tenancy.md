# ADR 004 — Multi-tenancy (Architecture multi-site)

**Date :** 2026-03-09
**Statut :** Acceptee
**Auteur :** @architect
**Sprint :** 7

## Contexte

L'application Suivi Silures doit supporter plusieurs fermes (sites) avec isolation des donnees. Un pisciculteur peut travailler sur plusieurs fermes, potentiellement avec des roles et permissions differents sur chacune. Les donnees d'une ferme ne doivent jamais etre visibles depuis une autre.

Contraintes :
- **Base unique** : pas de base par tenant (trop complexe pour le contexte)
- **Modeles existants** : Bac, Vague, Releve (Phase 1) n'ont pas de `siteId` — migration necessaire
- **Regle R8** : chaque nouveau modele DOIT avoir un `siteId`
- **Permissions granulaires** : 25 permissions definies dans l'enum `Permission`
- **Mobile first** : switcher de site doit etre rapide et simple

## Decision

### 1. Strategie de scoping : siteId sur chaque modele

**Option A — Schema-based isolation (rejete)**

| Pour | Contre |
|------|--------|
| Isolation totale | Complexite extreme (schemas dynamiques) |
| | Impossible avec Prisma |
| | Migrations par tenant |

**Option B — Row-level avec siteId (retenu)**

| Pour | Contre |
|------|--------|
| Simple, une seule DB/schema | Risque d'oubli de filtre (mitige par pattern) |
| Compatible Prisma | Index supplementaires |
| Migration incrementale | |
| Pattern uniforme pour toutes les queries | |

**Justification :** L'approche row-level est la seule viable avec Prisma. Le risque d'oubli de filtre est mitige par un pattern de query centralise et la regle R8.

### 2. Modeles Prisma

#### Site — une ferme piscicole

```prisma
model Site {
  id          String       @id @default(cuid())
  name        String
  address     String?
  isActive    Boolean      @default(true)
  members     SiteMember[]
  bacs        Bac[]
  vagues      Vague[]
  releves     Releve[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}
```

#### SiteMember — appartenance utilisateur ↔ site

```prisma
model SiteMember {
  id          String       @id @default(cuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  siteId      String
  site        Site         @relation(fields: [siteId], references: [id], onDelete: Cascade)
  role        Role         @default(PISCICULTEUR)
  permissions Permission[]
  isActive    Boolean      @default(true)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@unique([userId, siteId])
  @@index([userId])
  @@index([siteId])
}
```

Points cles :
- `permissions` est un **tableau PostgreSQL natif** (`Permission[]`) — pas de table de jointure
- `role` sur SiteMember (pas sur User) : un user peut etre ADMIN sur un site et PISCICULTEUR sur un autre
- `@@unique([userId, siteId])` : un user ne peut etre membre qu'une fois par site
- Le champ `role` sur User est conserve comme role **global** (ADMIN = super-admin multi-site)

#### Modifications aux modeles existants

Ajout de `siteId` (FK obligatoire) sur :

```prisma
model Bac {
  // ... champs existants ...
  siteId    String
  site      Site    @relation(fields: [siteId], references: [id])
  @@index([siteId])
}

model Vague {
  // ... champs existants ...
  siteId    String
  site      Site    @relation(fields: [siteId], references: [id])
  @@index([siteId])
}

model Releve {
  // ... champs existants ...
  siteId    String
  site      Site    @relation(fields: [siteId], references: [id])
  @@index([siteId])
}
```

### 3. Migration des donnees existantes

La migration doit etre **non-destructive** et se fait en 3 etapes :

```
Etape 1 : Creer la table Site + SiteMember
Etape 2 : Ajouter siteId (nullable) sur Bac, Vague, Releve
Etape 3 : Creer le site par defaut "Ferme principale", peupler siteId, rendre NOT NULL
```

#### Detail de la migration

```sql
-- Etape 1 : Nouvelles tables
CREATE TABLE "Site" (...);
CREATE TABLE "SiteMember" (...);

-- Etape 2 : Ajouter colonne nullable
ALTER TABLE "Bac" ADD COLUMN "siteId" TEXT;
ALTER TABLE "Vague" ADD COLUMN "siteId" TEXT;
ALTER TABLE "Releve" ADD COLUMN "siteId" TEXT;

-- Etape 3 : Site par defaut + migration des donnees
INSERT INTO "Site" (id, name) VALUES ('default-site', 'Ferme principale');

-- Inscrire tous les users existants comme membres ADMIN du site par defaut
INSERT INTO "SiteMember" (id, "userId", "siteId", role, permissions)
  SELECT gen_random_uuid(), id, 'default-site', 'ADMIN', ARRAY['SITE_GERER', ...]::\"Permission\"[]
  FROM "User";

-- Migrer les donnees existantes vers le site par defaut
UPDATE "Bac" SET "siteId" = 'default-site' WHERE "siteId" IS NULL;
UPDATE "Vague" SET "siteId" = 'default-site' WHERE "siteId" IS NULL;
UPDATE "Releve" SET "siteId" = 'default-site' WHERE "siteId" IS NULL;

-- Rendre NOT NULL
ALTER TABLE "Bac" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "Vague" ALTER COLUMN "siteId" SET NOT NULL;
ALTER TABLE "Releve" ALTER COLUMN "siteId" SET NOT NULL;

-- FK et index
ALTER TABLE "Bac" ADD CONSTRAINT ... FOREIGN KEY ("siteId") REFERENCES "Site"(id);
-- etc.
CREATE INDEX ... ON "Bac"("siteId");
-- etc.
```

### 4. Gestion du site actif

#### Stockage : activeSiteId dans Session

Le site actif est stocke dans la table `Session` :

```prisma
model Session {
  // ... champs existants ...
  activeSiteId  String?
  activeSite    Site?    @relation(fields: [activeSiteId], references: [id])

  @@index([activeSiteId])
}
```

**Pourquoi dans Session (et pas un cookie separe) :**

| Approche | Pour | Contre |
|----------|------|--------|
| Cookie `active_site_id` | Simple | Manipulable cote client, desync possible |
| Header custom | Explicite | Pas persiste, chaque requete doit l'envoyer |
| **Session DB** (retenu) | Securise, persiste, source de verite unique | Requete DB (deja faite par requireAuth) |

Le site actif est mis a jour en DB via `PUT /api/auth/site` et lu par `requireAuth()` en meme temps que la session. Pas de requete supplementaire.

#### Selection du site actif

Au login, si l'utilisateur est membre d'un seul site, celui-ci est automatiquement selectionne. Si membre de plusieurs sites :

1. **Premier login** : afficher un ecran de selection de site (plein ecran mobile)
2. **Logins suivants** : utiliser le dernier site actif de la session precedente (stocke en Session)
3. **Switch** : menu dans le header (dropdown) pour changer de site a tout moment

#### API de changement de site

```
PUT /api/auth/site
Body: { siteId: "clx..." }
```

Validation :
- L'utilisateur doit etre membre actif du site
- Met a jour `activeSiteId` dans la session courante
- Retourne le SiteMember (role + permissions) du nouveau site

### 5. Extension de requireAuth()

La fonction `requireAuth()` est etendue pour retourner le contexte multi-site :

```typescript
interface AuthContext {
  userId: string;
  email: string | null;
  phone: string | null;
  name: string;
  // Contexte global
  globalRole: Role;
  // Contexte site actif
  activeSiteId: string;
  siteRole: Role;
  permissions: Permission[];
}
```

Flow :

```
1. Lire le cookie session_token
2. Chercher en DB : session + user + activeSite
3. Verifier expiration, user actif
4. Si activeSiteId null → retourner erreur "Selectionnez un site"
5. Charger SiteMember pour (userId, activeSiteId)
6. Verifier que le membre est actif
7. Retourner AuthContext avec role et permissions du site
```

### 6. Pattern de query avec siteId

**Regle absolue : chaque query DOIT filtrer par siteId.**

#### Pattern centralise

Chaque fonction dans `src/lib/queries/` prend `siteId` en premier parametre :

```typescript
// Avant (Phase 1)
export async function getVagues(filters?: { statut?: string }) {
  return prisma.vague.findMany({ where: { ...filters } });
}

// Apres (Phase 2)
export async function getVagues(siteId: string, filters?: { statut?: string }) {
  return prisma.vague.findMany({
    where: { siteId, ...filters },
  });
}
```

#### Checklist pour chaque query

- [ ] `findMany` : `where: { siteId, ... }`
- [ ] `findUnique` / `findFirst` : verifier que le resultat a le bon `siteId`
- [ ] `create` : inclure `siteId` dans `data`
- [ ] `update` / `delete` : verifier `siteId` dans le `where` compound
- [ ] Relations : les includes ne fuient pas vers d'autres sites (les FK garantissent cela)

### 7. Verification des permissions

#### Helper requirePermission()

```typescript
export async function requirePermission(
  request: NextRequest,
  ...required: Permission[]
): Promise<AuthContext> {
  const auth = await requireAuth(request);

  // ADMIN global a toutes les permissions
  if (auth.globalRole === Role.ADMIN) return auth;

  // Verifier que le membre a toutes les permissions requises
  const missing = required.filter(p => !auth.permissions.includes(p));
  if (missing.length > 0) {
    throw new ForbiddenError("Permission insuffisante");
  }

  return auth;
}
```

#### Mapping role → permissions par defaut

Lors de la creation d'un SiteMember, les permissions sont initialisees selon le role :

| Role | Permissions par defaut |
|------|----------------------|
| ADMIN | Toutes (25 permissions) |
| GERANT | Toutes sauf SITE_GERER et MEMBRES_GERER (23 permissions) |
| PISCICULTEUR | VAGUES_VOIR, RELEVES_VOIR, RELEVES_CREER, BACS_GERER, DASHBOARD_VOIR, ALERTES_VOIR (6 permissions) |

Les permissions peuvent etre customisees par la suite (un GERANT peut avoir des permissions retirees, un PISCICULTEUR peut en recevoir des supplementaires).

#### Constantes dans src/lib/permissions.ts

Ce fichier centralise la logique de permissions :

```typescript
/** Groupes de permissions pour l'affichage UI */
export const PERMISSION_GROUPS = {
  administration: [Permission.SITE_GERER, Permission.MEMBRES_GERER],
  elevage: [Permission.VAGUES_VOIR, Permission.VAGUES_CREER, Permission.VAGUES_MODIFIER,
            Permission.BACS_GERER, Permission.RELEVES_VOIR, Permission.RELEVES_CREER],
  stock: [Permission.STOCK_VOIR, Permission.STOCK_GERER,
          Permission.APPROVISIONNEMENT_VOIR, Permission.APPROVISIONNEMENT_GERER],
  ventes: [Permission.VENTES_VOIR, Permission.VENTES_CREER,
           Permission.FACTURES_VOIR, Permission.FACTURES_GERER],
  alevins: [Permission.ALEVINS_VOIR, Permission.ALEVINS_GERER],
  planning: [Permission.PLANNING_VOIR, Permission.PLANNING_GERER],
  finances: [Permission.FINANCES_VOIR, Permission.FINANCES_GERER],
  general: [Permission.DASHBOARD_VOIR, Permission.ALERTES_VOIR, Permission.EXPORT_DONNEES],
} as const;

/** Permissions attribuees par defaut selon le role */
export const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),  // 25 permissions
  [Role.GERANT]: Object.values(Permission).filter(
    p => p !== Permission.SITE_GERER && p !== Permission.MEMBRES_GERER
  ),  // 23 permissions
  [Role.PISCICULTEUR]: [
    Permission.VAGUES_VOIR, Permission.RELEVES_VOIR, Permission.RELEVES_CREER,
    Permission.BACS_GERER, Permission.DASHBOARD_VOIR, Permission.ALERTES_VOIR,
  ],  // 6 permissions
};

/** Permissions qu'un role peut accorder a d'autres (anti-escalade) */
export const CAN_GRANT_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),  // peut tout accorder
  [Role.GERANT]: DEFAULT_PERMISSIONS[Role.PISCICULTEUR],  // ne peut donner que les perms PISCICULTEUR
  [Role.PISCICULTEUR]: [],  // ne peut rien accorder
};
```

#### Anti-escalade : canGrantPermissions

Quand un membre modifie les permissions d'un autre membre :

```
1. Charger le SiteMember de l'auteur de la modification
2. Verifier que l'auteur a MEMBRES_GERER dans ses permissions
3. Verifier que chaque permission accordee est dans CAN_GRANT_PERMISSIONS[auteur.role]
4. Un GERANT ne peut PAS accorder SITE_GERER ou MEMBRES_GERER
5. Un GERANT ne peut PAS promouvoir un membre au role ADMIN
6. Seul un ADMIN peut modifier un autre ADMIN
```

Cela empeche l'escalade de privileges : un GERANT ne peut pas se donner (ou donner a un autre) des permissions qu'il n'a pas le droit d'accorder.

### 8. Impact sur les API routes

Toutes les API routes existantes doivent etre modifiees :

```typescript
// Avant
export async function GET(request: NextRequest) {
  const session = await requireAuth(request);
  const vagues = await getVagues();
  return NextResponse.json({ vagues });
}

// Apres
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, Permission.VAGUES_VOIR);
  const vagues = await getVagues(auth.activeSiteId);
  return NextResponse.json({ vagues });
}
```

#### Routes impactees (Sprint 6 existant)

| Route | Permission requise |
|-------|--------------------|
| `GET /api/bacs` | BACS_GERER |
| `POST /api/bacs` | BACS_GERER |
| `GET /api/vagues` | VAGUES_VOIR |
| `POST /api/vagues` | VAGUES_CREER |
| `GET /api/vagues/[id]` | VAGUES_VOIR |
| `PUT /api/vagues/[id]` | VAGUES_MODIFIER |
| `GET /api/releves` | RELEVES_VOIR |
| `POST /api/releves` | RELEVES_CREER |

#### Nouvelles routes Sprint 7

| Route | Usage |
|-------|-------|
| `GET /api/sites` | Lister les sites de l'utilisateur |
| `PUT /api/auth/site` | Changer le site actif |
| `GET /api/sites/[id]/members` | Lister les membres d'un site |
| `POST /api/sites/[id]/members` | Inviter un membre |
| `PUT /api/sites/[id]/members/[memberId]` | Modifier role/permissions |
| `DELETE /api/sites/[id]/members/[memberId]` | Retirer un membre |

### 9. UI — Selection et switch de site

#### Mobile (< md)

```
┌──────────────────────────────────┐
│  🏠 Ferme principale     ▼      │  ← header: nom du site actif + dropdown
│  Dashboard                       │
├──────────────────────────────────┤
│                                  │
│         Contenu page             │
│                                  │
├──────────────────────────────────┤
│  Accueil  Vagues  +  Bacs       │
└──────────────────────────────────┘
```

Le switch de site est un `<Select>` dans le header, compact. En tapant dessus, un dropdown affiche les sites disponibles.

#### Desktop (>= md)

Le site actif est affiche dans la sidebar, au-dessus des liens de navigation, avec un selecteur.

### 10. Performance

| Mesure | Detail |
|--------|--------|
| Index `siteId` | Sur chaque table scopee (Bac, Vague, Releve + futurs modeles) |
| Index compose | `@@index([siteId, statut])` sur Vague, `@@index([siteId, vagueId])` sur Releve si necessaire |
| Pas de cache | Le nombre de sites par user est faible (1-5), pas besoin de cache |
| Session lookup | `requireAuth()` fait deja un JOIN session+user, on ajoute activeSite dans le meme JOIN |

### 11. Structure des fichiers Sprint 7

```
src/
├── app/
│   ├── select-site/
│   │   └── page.tsx              # Page selection de site (apres login multi-site)
│   └── api/
│       ├── auth/
│       │   └── site/
│       │       └── route.ts      # PUT — changer le site actif
│       └── sites/
│           ├── route.ts          # GET (mes sites) + POST (creer un site)
│           └── [id]/
│               └── members/
│                   └── route.ts  # GET + POST + PUT + DELETE membres
├── lib/
│   ├── auth/
│   │   └── session.ts            # Etendu : requireAuth retourne AuthContext
│   │   └── permissions.ts        # requirePermission, hasPermission, role defaults
│   └── queries/
│       ├── sites.ts              # CRUD sites
│       └── members.ts            # CRUD membres
├── components/
│   └── layout/
│       └── site-selector.tsx     # "use client" — dropdown selection de site
└── types/
    └── site.ts                   # Site, SiteMember, AuthContext, DTOs
```

## Options considerees

Resumees dans les sections ci-dessus (schema-based vs row-level, cookie vs session DB pour site actif).

## Consequences

- **Sprint 7** : migration + Site/SiteMember + modification de toutes les queries et API routes existantes
- **Sprints 8-12** : chaque nouveau modele inclut `siteId` des le depart (R8)
- **User.role** reste un role global (super-admin) ; le role effectif vient de `SiteMember.role`
- **Toutes les queries** prennent `siteId` en premier parametre — pattern uniforme
- **requireAuth()** retourne un `AuthContext` enrichi avec le site actif, le role et les permissions
- **Seed** : doit creer un site par defaut et des SiteMembers pour les users de test
- **Tests** : chaque test doit creer un site et passer `siteId` — isolation des donnees de test
