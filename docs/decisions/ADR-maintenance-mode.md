# ADR — Maintenance Mode (Mode Maintenance Global via FeatureFlag)

**Date :** 2026-04-01
**Statut :** Accepté (remplace la version rejetée basée sur Site.maintenanceMode)
**Auteur :** @architect
**Sprint :** Hors-sprint (fonctionnalité transverse)

---

## 1. Contexte et problème

### 1.1 Besoin

Les super-administrateurs de la plateforme DKFarm doivent pouvoir mettre toute l'application en
mode maintenance pour bloquer temporairement l'accès à tous les sites et tous les utilisateurs.
Les cas d'usage sont : déploiement d'une migration critique, mise à jour de schéma avec
downtime, correction d'une corruption de données affectant plusieurs sites, maintenance
d'infrastructure planifiée.

### 1.2 Pourquoi PAS per-site

La version précédente de cet ADR proposait un flag `maintenanceMode` sur le modèle `Site`.
**Elle a été rejetée.** Le besoin réel est un verrou global sur toute la plateforme, pas un
verrou par site géré par chaque admin de site. Ce sont deux fonctionnalités distinctes :

| Aspect | Version rejetée | Cette version |
|--------|----------------|---------------|
| Scope | Par site | Toute la plateforme |
| Qui active | ADMIN du site (SITE_GERER) | Super-administrateur (isSuperAdmin) |
| Impact | Un site sur N | Tous les sites simultanément |
| Cas d'usage | Recomptage des bacs d'un élevage | Migration DB, downtime infrastructure |

### 1.3 Contraintes

- **Globalité** : quand MAINTENANCE_MODE est actif, TOUS les sites, TOUS les utilisateurs sont
  bloqués sans exception côté UI (sauf les super-admins qui ont le bypass).
- **Extensibilité** : la solution doit pouvoir accueillir d'autres feature flags à l'avenir
  (REGISTRATION_ENABLED, NEW_UI_BETA, etc.) sans nouvelle migration.
- **Performance** : le flag est consulté sur chaque requête — la lecture doit être rapide.
- **Atomicité** : un toggle doit logger l'action dans `SiteAuditLog` (ou équivalent global).
- **Pas de siteId** : c'est une config globale de plateforme, pas de config par site.

---

## 2. Décisions architecturales

### 2.1 Table `FeatureFlag` — stockage global des flags

**Décision** : créer une nouvelle table Prisma `FeatureFlag` avec structure générique clé/valeur :

```prisma
model FeatureFlag {
  /// Clé unique identifiant le flag (ex: "MAINTENANCE_MODE", "REGISTRATION_ENABLED")
  key       String    @id
  /// Flag activé ou non
  enabled   Boolean   @default(false)
  /// Métadonnées optionnelles : raison, message d'affichage, etc.
  value     Json?
  updatedAt DateTime  @updatedAt
  /// ID du super-admin qui a modifié en dernier (null si jamais modifié)
  updatedBy String?
  updatedByUser User? @relation(fields: [updatedBy], references: [id])
}
```

**Pourquoi cette structure ?**

- `key String @id` : pas d'autoincrement, la clé est la valeur (ex: `"MAINTENANCE_MODE"`).
  Lecture directe par clé, pas de `WHERE key = ?` sur un index secondaire.
- `enabled Boolean` : le cas d'usage dominant est un toggle binaire.
- `value Json?` : champ optionnel pour des métadonnées riches (message de maintenance,
  date de fin prévue, URL de status page, etc.) sans multiplier les colonnes.
- `updatedBy` : traçabilité qui a changé le flag en dernier — FK vers `User` nullable
  car le seed initial n'a pas d'acteur.
- Pas de `siteId` — c'est intentionnel et documenté. Les flags globaux n'appartiennent
  à aucun site.

**Flags prédéfinis seedés** :

| key | enabled (défaut) | description |
|-----|-----------------|-------------|
| `MAINTENANCE_MODE` | `false` | Verrouille toute la plateforme |

D'autres flags pourront être ajoutés via migration seed sans toucher au schéma.

### 2.2 Qui peut toggler les FeatureFlags

**Décision** : exclusivement les utilisateurs avec `isSuperAdmin = true`.

Justification : les feature flags sont de la responsabilité de la plateforme DKFarm, pas des
admins de site. `isSuperAdmin` est déjà le mécanisme d'autorisation platform-level existant,
géré via `requireSuperAdmin()` dans `src/lib/auth/backoffice.ts`. Aucune nouvelle permission
n'est créée.

Seules les routes backoffice (`/backoffice/*` + `/api/backoffice/*`) peuvent appeler ces
endpoints. Le guard `requireSuperAdmin()` est déjà en place pour ces routes.

### 2.3 Enforcement — deux couches

L'enforcement repose sur **deux couches complémentaires** :

#### Couche 1 — Middleware Edge (redirection de pages)

Le fichier `src/proxy.ts` (Edge Runtime) ne peut pas interroger Prisma. Il lit un cookie
non-httpOnly pour connaître l'état de maintenance.

**Nouveau cookie** : `platform_maintenance` (non-httpOnly, lisible par Edge)
- Valeur : `"1"` quand MAINTENANCE_MODE est actif, absent ou `""` sinon.
- Écrit par la route de toggle au moment du changement d'état.
- Lu par le middleware pour rediriger toutes les pages vers `/maintenance`.

**Logique dans `src/proxy.ts`** :

```typescript
// Vérification maintenance — avant tout autre check sauf les routes publiques
const isMaintenance =
  request.cookies.get("platform_maintenance")?.value === "1";

if (isMaintenance && !isMaintenanceWhitelisted(pathname)) {
  // Super-admins bypass — cookie is_super_admin=true
  const isSuperAdmin =
    request.cookies.get(IS_SUPER_ADMIN_COOKIE)?.value === "true";
  if (!isSuperAdmin) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { status: 503, message: "Plateforme en maintenance.", code: "MAINTENANCE_MODE" },
        { status: 503 }
      );
    }
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }
}
```

**Whitelist maintenance** (jamais bloquée même si maintenance active) :

```
/login
/register
/maintenance
/backoffice/*           — accès backoffice super-admin
/api/auth/*             — authentification
/api/backoffice/*       — API backoffice (toggle maintenance inclus)
/api/health             — healthcheck infra
/_next/*                — assets Next.js
```

#### Couche 2 — Guard API (rejet 503 des mutations)

Pour les routes API qui ne passent pas par le middleware (ex: appels directs), un helper
`checkPlatformMaintenance()` vérifie le flag en DB :

```typescript
// src/lib/api-utils.ts — nouveau helper
/**
 * Vérifie si la plateforme est en mode maintenance via DB.
 * À appeler dans les routes POST/PUT/PATCH/DELETE exposées aux utilisateurs normaux,
 * avant toute mutation.
 * Les super-admins ne sont PAS bloqués par ce guard.
 */
export async function checkPlatformMaintenance(
  session: UserSession | null
): Promise<NextResponse | null>
// retourne null si tout va bien
// retourne apiError(503, ..., { code: "MAINTENANCE_MODE" }) si en maintenance
```

Ce guard n'est PAS requis sur les routes backoffice (super-admins uniquement).

**Pourquoi deux couches ?**

- Middleware = UX immédiate (redirection sans round-trip serveur, page explicative)
- Guard API = sécurité réelle (le cookie pourrait être absent, expiré, ou altéré)

### 2.4 Bypass super-admin

Les super-admins ne sont JAMAIS bloqués par la maintenance :
- Dans le middleware : `is_super_admin` cookie `=== "true"` → bypass
- Dans le guard API : le caller passe la session ; si `session.isSuperAdmin === true` → skip

Cela permet aux super-admins de naviguer normalement, voir l'état de la plateforme, et
désactiver la maintenance depuis le backoffice, sans jamais être redirigés.

### 2.5 Gestion du cookie `platform_maintenance`

Le cookie est écrit/effacé exclusivement par la route de toggle :

**Scénarios d'écriture** :
1. `POST /api/backoffice/feature-flags/MAINTENANCE_MODE` (activation) → pose `platform_maintenance=1`
2. `DELETE /api/backoffice/feature-flags/MAINTENANCE_MODE` (désactivation) → efface le cookie

**Propriétés du cookie** :

```
name:     platform_maintenance
httpOnly: false   // lisible par proxy.ts (Edge Runtime)
secure:   true en production
sameSite: lax
path:     /
maxAge:   7 jours (durée max raisonnable pour une maintenance)
```

Note : le cookie n'est **pas** posé lors du login. Si le cookie est absent, le middleware
considère qu'il n'y a pas de maintenance (fail-open). La couche API guard (DB) reste le
verrou de sécurité fiable. Cela évite une requête DB supplémentaire sur chaque login.

### 2.6 Page `/maintenance`

Server Component (`src/app/maintenance/page.tsx`) affichant :

- Titre "Plateforme en maintenance"
- Message de maintenance issu de `FeatureFlag.value.message` si présent, sinon message
  générique
- Date de début si disponible (`FeatureFlag.value.startedAt`)
- Date de fin prévue si disponible (`FeatureFlag.value.estimatedEnd`)
- "Revenez plus tard ou contactez votre administrateur."
- Si l'utilisateur est super-admin : lien vers `/backoffice/feature-flags` pour désactiver

Cette page est dans la whitelist du middleware — elle est toujours accessible.

### 2.7 Interface UI backoffice

Dans le backoffice super-admin existant, une nouvelle section "Feature Flags" expose :

**Page** : `/backoffice/feature-flags`
**Composants** :
```
src/components/backoffice/
  feature-flags-list.tsx     Server Component — liste tous les FeatureFlags
  feature-flag-toggle.tsx    "use client" — Switch Radix + confirmation Dialog
```

`FeatureFlagToggle` props :
```typescript
interface FeatureFlagToggleProps {
  flagKey: string;
  enabled: boolean;
  label: string;
  description: string;
  value: Record<string, unknown> | null;
  updatedAt: string | null;
  updatedByName: string | null;
}
```

Le toggle MAINTENANCE_MODE affiche un Dialog de confirmation avant activation (action
irréversible jusqu'à désactivation explicite) avec un champ optionnel "Message de maintenance"
et "Date de fin prévue".

### 2.8 Audit et traçabilité

Chaque toggle de flag crée une entrée dans `PlatformAuditLog` (ou `SiteAuditLog` avec
`siteId = null` si la table est modifiée pour accepter les audits platform-level).

Recommandation : créer un `PlatformAuditLog` distinct pour les actions platform-level,
sans `siteId` requis :

```prisma
model PlatformAuditLog {
  id        String   @id @default(cuid())
  actorId   String
  actor     User     @relation(fields: [actorId], references: [id])
  action    String   // ex: "FEATURE_FLAG_ENABLED", "FEATURE_FLAG_DISABLED"
  details   Json?    // { flagKey, previousValue, newValue, reason? }
  createdAt DateTime @default(now())
}
```

Si `PlatformAuditLog` n'est pas encore implémenté, un log serveur (`console.warn`) est
acceptable en attendant.

---

## 3. Schéma Prisma

### 3.1 Nouveau modèle `FeatureFlag`

```prisma
model FeatureFlag {
  /// Identifiant unique du flag — valeurs connues: "MAINTENANCE_MODE"
  key           String    @id
  /// Flag activé ou non
  enabled       Boolean   @default(false)
  /// Métadonnées optionnelles (message, estimatedEnd, startedAt, etc.)
  value         Json?
  updatedAt     DateTime  @updatedAt
  /// Super-admin qui a modifié en dernier (nullable pour le seed)
  updatedBy     String?
  updatedByUser User?     @relation(fields: [updatedBy], references: [id])
}
```

Migration SQL :

```sql
CREATE TABLE "FeatureFlag" (
  "key"       TEXT NOT NULL,
  "enabled"   BOOLEAN NOT NULL DEFAULT false,
  "value"     JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "FeatureFlag_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
```

Seed :

```sql
INSERT INTO "FeatureFlag" ("key", "enabled", "updatedAt")
VALUES ('MAINTENANCE_MODE', false, NOW())
ON CONFLICT ("key") DO NOTHING;
```

### 3.2 Nouveau modèle optionnel `PlatformAuditLog`

```prisma
model PlatformAuditLog {
  id        String   @id @default(cuid())
  actorId   String
  actor     User     @relation(fields: [actorId], references: [id])
  /// Ex: "FEATURE_FLAG_ENABLED", "FEATURE_FLAG_DISABLED"
  action    String
  details   Json?
  createdAt DateTime @default(now())

  @@index([actorId])
  @@index([createdAt])
}
```

---

## 4. Interfaces TypeScript

### 4.1 Modèle `FeatureFlag`

```typescript
// src/types/models.ts
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  /** Métadonnées libres — chaque flag définit sa propre structure dans value */
  value: Record<string, unknown> | null;
  updatedAt: Date;
  updatedBy: string | null;
}

/** Structure du champ value pour le flag MAINTENANCE_MODE */
export interface MaintenanceFlagValue {
  /** Message affiché aux utilisateurs sur la page /maintenance */
  message?: string;
  /** Date de début de la maintenance (ISO 8601) */
  startedAt?: string;
  /** Date de fin prévue (ISO 8601) */
  estimatedEnd?: string;
  /** Raison interne (non affichée aux utilisateurs) */
  internalReason?: string;
}
```

### 4.2 DTOs API

```typescript
// Lecture d'un flag
export interface FeatureFlagResponse {
  key: string;
  enabled: boolean;
  value: Record<string, unknown> | null;
  updatedAt: string;    // ISO 8601
  updatedByName: string | null;
}

// Toggle maintenance
export interface ToggleMaintenanceModeRequest {
  enabled: boolean;
  message?: string;           // Message affiché aux utilisateurs
  estimatedEnd?: string;      // ISO 8601 — date de fin prévue
  internalReason?: string;    // Raison interne (logs)
}

// Réponse toggle
export interface ToggleMaintenanceModeResponse {
  key: "MAINTENANCE_MODE";
  enabled: boolean;
  value: MaintenanceFlagValue | null;
  updatedAt: string;
}
```

---

## 5. Routes API

### 5.1 CRUD FeatureFlags (backoffice)

```
GET    /api/backoffice/feature-flags              — liste tous les flags
GET    /api/backoffice/feature-flags/[key]        — lire un flag
PATCH  /api/backoffice/feature-flags/[key]        — toggler/mettre à jour un flag
```

Toutes ces routes sont protégées par `requireSuperAdmin()`. Aucune route POST/DELETE
(les flags sont créés via seed, pas via UI).

**Request PATCH** :
```typescript
{
  enabled: boolean;
  value?: Record<string, unknown> | null;
}
```

**Response PATCH** : `FeatureFlagResponse`

**Codes d'erreur** :
- `401` : non authentifié
- `403` : pas super-admin
- `404` : flag introuvable (key inconnue)

### 5.2 Lecture publique de l'état de maintenance (pour Server Components)

```
GET  /api/feature-flags/maintenance-status    — état de maintenance sans auth requise
```

Cette route est publique (pas d'auth). Elle retourne uniquement le flag MAINTENANCE_MODE
pour permettre aux Server Components d'hydrater correctement la page `/maintenance`.

**Response** :
```typescript
{
  maintenanceMode: boolean;
  message: string | null;
  estimatedEnd: string | null;
}
```

---

## 6. Flux complets

### 6.1 Activation par un super-admin

```
Super-admin → PATCH /api/backoffice/feature-flags/MAINTENANCE_MODE
  body: { enabled: true, value: { message: "Mise à jour 2.0", estimatedEnd: "..." } }
  → requireSuperAdmin() — vérifie isSuperAdmin en DB
  → prisma.featureFlag.update({ key: "MAINTENANCE_MODE", enabled: true, value, updatedBy })
  → PlatformAuditLog.create({ action: "FEATURE_FLAG_ENABLED", details: { flagKey, ... } })
  → pose cookie platform_maintenance=1 sur la réponse
  → retourne 200 + FeatureFlagResponse
```

### 6.2 Accès d'un utilisateur normal pendant la maintenance

```
Utilisateur → GET /dashboard (page)
  → proxy.ts lit cookie platform_maintenance === "1"
  → is_super_admin cookie absent ou !== "true"
  → /dashboard n'est pas dans la whitelist
  → redirect("/maintenance")
  → page /maintenance lit /api/feature-flags/maintenance-status pour le message
```

### 6.3 Accès d'un super-admin pendant la maintenance

```
Super-admin → GET /backoffice/feature-flags (page)
  → proxy.ts lit cookie platform_maintenance === "1"
  → is_super_admin cookie === "true" → BYPASS
  → accès normal au backoffice
  → banner "Maintenance active" visible dans l'UI backoffice
```

### 6.4 Appel API mutationnelle pendant la maintenance

```
Utilisateur → POST /api/vagues
  → proxy.ts : platform_maintenance === "1", pas super-admin, route /api/*
  → retourne 503 { status: 503, message: "Plateforme en maintenance.", code: "MAINTENANCE_MODE" }
```

Note : le middleware gère les routes API directement. Le guard `checkPlatformMaintenance()`
dans les route handlers est une deuxième ligne de défense si le cookie est absent.

### 6.5 Désactivation

```
Super-admin → PATCH /api/backoffice/feature-flags/MAINTENANCE_MODE
  body: { enabled: false }
  → requireSuperAdmin()
  → prisma.featureFlag.update({ enabled: false, value: null })
  → PlatformAuditLog.create({ action: "FEATURE_FLAG_DISABLED", ... })
  → efface cookie platform_maintenance sur la réponse
  → retourne 200 + FeatureFlagResponse
```

---

## 7. Performance et caching

### 7.1 Lecture du flag en DB

La table `FeatureFlag` utilise `key` comme `@id` (clé primaire). PostgreSQL résout
`SELECT * FROM "FeatureFlag" WHERE key = 'MAINTENANCE_MODE'` en microsecondes via l'index
primaire (B-tree).

### 7.2 Cache applicatif — `React.cache()`

Pour les Server Components qui lisent le flag pendant le rendu, `React.cache()` garantit
qu'une seule requête DB est faite par requête HTTP :

```typescript
// src/lib/feature-flags.ts
import { cache } from "react";

export const getFeatureFlag = cache(async (key: string): Promise<FeatureFlag | null> => {
  return prisma.featureFlag.findUnique({ where: { key } });
});

export const isMaintenanceModeEnabled = cache(async (): Promise<boolean> => {
  const flag = await getFeatureFlag("MAINTENANCE_MODE");
  return flag?.enabled ?? false;
});
```

### 7.3 Pas de cache sur le guard API

Le guard `checkPlatformMaintenance()` dans les route handlers fait toujours une requête
DB directe. C'est acceptable : la requête est minuscule, et le guard n'est appelé qu'une
fois par route handler.

---

## 8. Alternatives rejetées

### A — Flag sur le modèle `Site` (version précédente, REJETÉE)

Proposait `maintenanceMode: Boolean` et `maintenanceSince: DateTime?` sur chaque Site.
**Rejeté** : le besoin est un verrou global de plateforme, pas un verrou par site. L'admin
de site ne devrait pas avoir le pouvoir de déclencher une "maintenance" qui bloque son site
(ce serait confondu avec la suspension ou le soft delete).

### B — Variable d'environnement `MAINTENANCE_MODE=true`

Simple, sans DB. **Rejeté** : nécessite un redéploiement pour toggler, pas d'interface UI,
pas d'audit, pas extensible pour d'autres flags.

### C — Table `AppConfig` avec `siteId nullable`

Une table `AppConfig` avec `siteId String?` pour combiner config globale et config par site.
**Rejeté** : schéma ambigu, requêtes complexes (`WHERE siteId IS NULL`), confusion entre
scope global et scope site. Le modèle `FeatureFlag` (sans siteId) est plus clair.

### D — Redis / cache externe

Stocker le flag dans Redis pour la lecture Edge. **Rejeté** : introduit une dépendance
d'infrastructure supplémentaire non justifiée pour un use-case simple. La lecture DB via
le guard API est suffisante. Le cookie suffit pour le middleware Edge.

### E — Middleware avec fetch vers API interne

Fetch vers `/api/feature-flags/maintenance-status` dans `proxy.ts` à chaque requête.
**Rejeté** : latence supplémentaire sur toutes les requêtes, risque de boucle si l'API
elle-même est en maintenance. Le cookie est le bon mécanisme pour le middleware Edge.

---

## 9. Impact sur les agents

| Agent | Travail requis |
|-------|----------------|
| @db-specialist | Nouveau modèle `FeatureFlag` dans schema.prisma. Optionnel : `PlatformAuditLog`. Migration SQL. Seed `MAINTENANCE_MODE` (enabled: false). |
| @developer | Route `PATCH /api/backoffice/feature-flags/[key]` + `GET /api/backoffice/feature-flags`. Route publique `GET /api/feature-flags/maintenance-status`. Helper `isMaintenanceModeEnabled()` + `checkPlatformMaintenance()` dans `src/lib/feature-flags.ts`. Intégration dans `src/proxy.ts` (lecture cookie `platform_maintenance`, bypass super-admin). Cookie helpers `setPlatformMaintenanceCookie` / `clearPlatformMaintenanceCookie`. Page `/maintenance`. Composants `FeatureFlagToggle` + `FeatureFlagsList` dans `/backoffice/feature-flags`. Banner dans le layout backoffice. |
| @tester | Tests unitaires `isMaintenanceModeEnabled()`. Tests d'intégration : activation → vérification 503 → désactivation. Test bypass super-admin. Test cookie posé/effacé. Test page /maintenance avec et sans message custom. |
| @architect | Ce document. |

---

## 10. Checklist de conformité Rules Phase 2

| Règle | Vérification |
|-------|-------------|
| R1 — Enums MAJUSCULES | Aucun nouvel enum — N/A |
| R2 — Importer les enums | Aucun enum utilisé — N/A |
| R3 — Prisma = TypeScript | `FeatureFlag.enabled Boolean` ↔ `FeatureFlag.enabled: boolean` |
| R4 — Opérations atomiques | Toggle dans une transaction (update + auditLog.create) |
| R5 — DialogTrigger asChild | Dialog de confirmation dans `FeatureFlagToggle` — `<DialogTrigger asChild>` requis |
| R6 — CSS variables | Page maintenance utilisera `var(--warning)` / `var(--muted-foreground)` |
| R7 — Nullabilité explicite | `value Json?` nullable, `enabled Boolean @default(false)` NOT NULL, `updatedBy String?` nullable |
| R8 — siteId PARTOUT | `FeatureFlag` est intentionnellement sans siteId — flag global, documenté ici |
| R9 — Tests avant review | Tests requis avant livraison |
