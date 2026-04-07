# ADR-045 — Reproduction : Permissions Granulaires et Navigation

**Statut :** PROPOSÉ
**Date :** 2026-04-07
**Auteur :** @architect
**Contexte :** Le module Reproduction utilise uniquement des permissions `ALEVINS_*` génériques. La navigation mobile ne présente "Reproduction" qu'avec un seul item (/alevins), ce qui le place incorrectement sous "Analyse & Pilotage". Le sidebar le libelle "Alevins" au lieu de "Reproduction".

---

## Table des matières

1. [Problèmes identifiés](#1-problèmes-identifiés)
2. [Analyse des patterns existants](#2-analyse-des-patterns-existants)
3. [Nouvelles valeurs Permission enum](#3-nouvelles-valeurs-permission-enum)
4. [Structure de navigation](#4-structure-de-navigation)
5. [Mise à jour ITEM_VIEW_PERMISSIONS](#5-mise-à-jour-item_view_permissions)
6. [Permissions par défaut par rôle système](#6-permissions-par-défaut-par-rôle-système)
7. [Plan de migration ALEVINS_* → granulaires](#7-plan-de-migration-alevins---granulaires)
8. [Mise à jour PERMISSION_GROUPS](#8-mise-à-jour-permission_groups)

---

## 1. Problèmes identifiés

### P1 — Permissions trop grossières

Toutes les opérations du module Reproduction (géniteurs, pontes, lots, incubations) sont protégées par les mêmes permissions `ALEVINS_*`. Un pisciculteur ne peut pas avoir le droit de voir les lots alevins sans aussi avoir accès aux géniteurs et aux pontes. Ce n'est pas cohérent avec le modèle de permissions granulaires appliqué aux autres modules (ex : `STOCK_VOIR`/`STOCK_GERER`, `VENTES_VOIR`/`VENTES_CREER`, etc.).

### P2 — Navigation mobile cassée

Dans `farm-bottom-nav.tsx`, le groupe `reproduction` n'a qu'un seul item (`/alevins`). La logique `E5` (masquer le header si 1 seul item visible) fait disparaître le label "Reproduction". Pire, le tri de visibilité des groupes dans la sheet peut le faire apparaître au mauvais endroit dans le rendu final.

### P3 — Label sidebar incorrect

Dans `farm-sidebar.tsx`, le groupe Reproduction a `labelKey: "items.alevins"` au lieu de `labelKey: "items.reproduction"` ou d'un label dédié. Le header n'est affiché que si plus d'un item — avec 4 items actuels, le header s'affiche mais porte le mauvais libellé.

### P4 — Route /alevins vs /reproduction (ADR-044, décision D6)

ADR-044 décide que `/reproduction` remplace `/alevins` (avec redirect). Les permissions et la navigation doivent anticiper cette structure d'URL.

---

## 2. Analyse des patterns existants

### Pattern observé dans les autres modules

| Module | Permission "voir" | Permission "gérer" | Granularité supplémentaire |
|--------|-------------------|--------------------|---------------------------|
| Stock | `STOCK_VOIR` | `STOCK_GERER` | `APPROVISIONNEMENT_VOIR`, `APPROVISIONNEMENT_GERER` |
| Ventes | `VENTES_VOIR` | `VENTES_CREER` | `FACTURES_VOIR`, `FACTURES_GERER`, `PAIEMENTS_CREER` |
| Finances | `FINANCES_VOIR` | `FINANCES_GERER` | — |
| Élevage | `VAGUES_VOIR` | `VAGUES_CREER`, `VAGUES_MODIFIER` | `RELEVES_VOIR`, `RELEVES_CREER`, etc. |
| Dépenses | `DEPENSES_VOIR` | `DEPENSES_CREER`, `DEPENSES_MODIFIER` | `BESOINS_SOUMETTRE`, `BESOINS_APPROUVER` |

**Conclusion :** Les modules complexes ont une permission "voir" de module (gate d'accès) + des permissions granulaires par sous-fonctionnalité. `STOCK_VOIR` gate l'accès au groupe nav "Intrants", puis `APPROVISIONNEMENT_VOIR` gate les items fournisseurs/commandes.

### Décision sur ALEVINS_VOIR

`ALEVINS_VOIR` joue actuellement le rôle de **gate de module**. Ce rôle est conservé : il protège l'accès au groupe "Reproduction" dans la navigation et aux sous-pages. Les nouvelles permissions granulaires s'ajoutent en dessous. `ALEVINS_VOIR` est renommé conceptuellement en "permission d'accès au module Reproduction" mais le nom de l'enum est conservé pour éviter une migration destructive (voir section 7).

---

## 3. Nouvelles valeurs Permission enum

### 3.1 Valeurs à ajouter dans `prisma/schema.prisma`

```prisma
enum Permission {
  // ... (valeurs existantes conservées) ...

  // Reproduction — Géniteurs (2)
  GENITEURS_VOIR
  GENITEURS_GERER

  // Reproduction — Pontes (2)
  PONTES_VOIR
  PONTES_GERER

  // Reproduction — Lots Alevins (2)
  LOTS_ALEVINS_VOIR
  LOTS_ALEVINS_GERER

  // Reproduction — Incubations (2)  [future, défini maintenant]
  INCUBATIONS_VOIR
  INCUBATIONS_GERER

  // Reproduction — Planning dédié (1)
  PLANNING_REPRODUCTION_VOIR
}
```

### 3.2 Sémantique de chaque permission

| Permission | Ce qu'elle autorise |
|-----------|---------------------|
| `ALEVINS_VOIR` | Gate d'accès au module Reproduction entier (dashboard /reproduction, navigation) |
| `GENITEURS_VOIR` | Lecture de la liste géniteurs, détail fiche géniteur, historique pontes |
| `GENITEURS_GERER` | Créer/modifier/archiver géniteurs, gérer lots géniteurs (mode groupe) |
| `PONTES_VOIR` | Lecture de la liste pontes, détail étapes, résultats |
| `PONTES_GERER` | Créer ponte, progresser dans les étapes (injection, stripping, résultat), clôturer |
| `LOTS_ALEVINS_VOIR` | Lecture de la liste lots, détail, relevés associés, KPIs |
| `LOTS_ALEVINS_GERER` | Créer lot, changer phase, split lot, enregistrer sortie |
| `INCUBATIONS_VOIR` | Lecture des incubations, suivi compte-à-rebours éclosion |
| `INCUBATIONS_GERER` | Créer/modifier incubation, ajouter traitements antifongiques |
| `PLANNING_REPRODUCTION_VOIR` | Accès à l'onglet planning du module Reproduction (/reproduction/planning) |

### 3.3 Valeurs à CONSERVER (ne pas supprimer)

Les valeurs `ALEVINS_VOIR`, `ALEVINS_GERER`, `ALEVINS_CREER`, `ALEVINS_MODIFIER`, `ALEVINS_SUPPRIMER` restent dans l'enum Prisma. Elles ne sont pas retirées pour deux raisons :
1. Suppression d'une valeur enum PostgreSQL nécessite une migration destructive (DROP + RECREATE)
2. `ALEVINS_VOIR` est réutilisé comme gate de module (voir section 7)

`ALEVINS_GERER`, `ALEVINS_CREER`, `ALEVINS_MODIFIER`, `ALEVINS_SUPPRIMER` sont mis en soft-deprecation : ils restent dans l'enum mais ne sont plus assignés aux nouveaux rôles système. Le code existant qui les vérifie est migré vers les nouvelles permissions.

---

## 4. Structure de navigation

### 4.1 farm-sidebar.tsx — Groupe Reproduction

**Configuration actuelle (incorrecte) :**
```typescript
{
  labelKey: "items.alevins",          // FAUX — libellé "Alevins"
  items: [
    { href: "/alevins", ... },        // seule route
    { href: "/alevins/reproducteurs", ... },
    { href: "/alevins/pontes", ... },
    { href: "/alevins/lots", ... },
  ],
  permissionRequired: Permission.ALEVINS_VOIR,
  moduleRequired: SiteModule.REPRODUCTION,
}
```

**Configuration cible :**
```typescript
{
  labelKey: "groups.reproduction",    // NOUVEAU — clé i18n dédiée
  items: [
    {
      href: "/reproduction",
      labelKey: "items.dashboardReproduction",
      icon: LayoutDashboard,
    },
    {
      href: "/reproduction/geniteurs",
      labelKey: "items.geniteurs",
      icon: Fish,
      // permissionRequired géré via ITEM_VIEW_PERMISSIONS
    },
    {
      href: "/reproduction/pontes",
      labelKey: "items.pontes",
      icon: Egg,
    },
    {
      href: "/reproduction/lots",
      labelKey: "items.lots",
      icon: Layers,
    },
    {
      href: "/reproduction/incubations",
      labelKey: "items.incubations",
      icon: ThermometerSun,   // nouvelle icône lucide
    },
    {
      href: "/reproduction/planning",
      labelKey: "items.planningReproduction",
      icon: Calendar,
    },
  ],
  permissionRequired: Permission.ALEVINS_VOIR,  // gate de module inchangé
  moduleRequired: SiteModule.REPRODUCTION,
}
```

**Notes d'implémentation sidebar :**
- `labelKey: "groups.reproduction"` requiert l'ajout de la clé i18n dans `messages/fr.json` et `messages/en.json`
- L'icône `ThermometerSun` est importée depuis lucide-react (disponible)
- La route `/alevins` est remplacée par `/reproduction` — le redirect `/alevins → /reproduction` est géré côté Next.js (next.config.js redirects ou middleware)
- Chaque item est filtré par `ITEM_VIEW_PERMISSIONS` (voir section 5)

### 4.2 farm-bottom-nav.tsx — Sheet groupe "reproduction"

**Configuration actuelle (cassée — 1 seul item) :**
```typescript
{
  groupKey: "reproduction",
  gatePermission: Permission.ALEVINS_VOIR,
  items: [
    {
      href: "/alevins",
      labelKey: "items.alevins",
      icon: Egg,
      permissionRequired: Permission.ALEVINS_VOIR,
      moduleRequired: SiteModule.REPRODUCTION,
    },
  ],
},
```

**Configuration cible (5 items — groupe visible avec header) :**
```typescript
{
  groupKey: "reproduction",
  gatePermission: Permission.ALEVINS_VOIR,
  items: [
    {
      href: "/reproduction",
      labelKey: "items.dashboardReproduction",
      icon: LayoutDashboard,
      permissionRequired: Permission.ALEVINS_VOIR,
      moduleRequired: SiteModule.REPRODUCTION,
    },
    {
      href: "/reproduction/geniteurs",
      labelKey: "items.geniteurs",
      icon: Fish,
      permissionRequired: Permission.GENITEURS_VOIR,
      moduleRequired: SiteModule.REPRODUCTION,
    },
    {
      href: "/reproduction/pontes",
      labelKey: "items.pontes",
      icon: Egg,
      permissionRequired: Permission.PONTES_VOIR,
      moduleRequired: SiteModule.REPRODUCTION,
    },
    {
      href: "/reproduction/lots",
      labelKey: "items.lotsAlevins",
      icon: Layers,
      permissionRequired: Permission.LOTS_ALEVINS_VOIR,
      moduleRequired: SiteModule.REPRODUCTION,
    },
    {
      href: "/reproduction/planning",
      labelKey: "items.planningReproduction",
      icon: Calendar,
      permissionRequired: Permission.PLANNING_REPRODUCTION_VOIR,
      moduleRequired: SiteModule.REPRODUCTION,
    },
  ],
},
```

**Notes d'implémentation bottom-nav :**
- Avec 5 items, la logique E5 (masquer header si 1 seul item) n'est plus déclenchée — le label "Reproduction" s'affiche toujours
- `groupKey: "reproduction"` mappe vers `navigation:modules.reproduction` en i18n
- Le groupe est positionné **avant** `analysePilotage` dans le tableau `SHEET_GROUPS` pour respecter l'ordre logique métier : Grossissement → Intrants → Ventes → Reproduction → Analyse
- L'item `/reproduction/incubations` est omis du bottom-nav (complexité opérationnelle, accessible depuis le détail ponte) — à réévaluer selon les retours terrain

### 4.3 Barre de navigation fixe du bas (5 boutons)

Les 5 boutons permanents du bas ne changent pas. "Reproduction" n'est pas assez universel pour y figurer en accès direct — il reste accessible via le bouton Menu (Sheet).

---

## 5. Mise à jour ITEM_VIEW_PERMISSIONS

Dans `src/lib/permissions-constants.ts`, ajouter les entrées suivantes :

```typescript
export const ITEM_VIEW_PERMISSIONS: Record<string, Permission> = {
  // ... entrées existantes ...

  // Reproduction — items granulaires
  "/reproduction":                    Permission.ALEVINS_VOIR,
  "/reproduction/geniteurs":          Permission.GENITEURS_VOIR,
  "/reproduction/pontes":             Permission.PONTES_VOIR,
  "/reproduction/lots":               Permission.LOTS_ALEVINS_VOIR,
  "/reproduction/incubations":        Permission.INCUBATIONS_VOIR,
  "/reproduction/planning":           Permission.PLANNING_REPRODUCTION_VOIR,

  // Compatibilité aliases /alevins (pendant période de transition)
  "/alevins":                         Permission.ALEVINS_VOIR,
  "/alevins/reproducteurs":           Permission.GENITEURS_VOIR,
  "/alevins/pontes":                  Permission.PONTES_VOIR,
  "/alevins/lots":                    Permission.LOTS_ALEVINS_VOIR,
};
```

Mettre à jour également `MODULE_VIEW_PERMISSIONS` :

```typescript
export const MODULE_VIEW_PERMISSIONS: Record<string, Permission> = {
  Reproduction: Permission.ALEVINS_VOIR,  // inchangé — gate de module
  // ... autres inchangés ...
};
```

---

## 6. Permissions par défaut par rôle système

Ces définitions remplacent le bloc `alevins` dans `SYSTEM_ROLE_DEFINITIONS` de `permissions-constants.ts`.

### Administrateur

Toutes les permissions (`Object.values(Permission)`) — inchangé, inclut les nouvelles automatiquement.

### Gerant

Toutes sauf `SITE_GERER` et `MEMBRES_GERER`. Inclut donc toutes les nouvelles permissions Reproduction.

### Pisciculteur

```typescript
// Permissions Reproduction pour le rôle Pisciculteur
Permission.ALEVINS_VOIR,            // accès au module
Permission.GENITEURS_VOIR,          // lecture géniteurs
Permission.PONTES_VOIR,             // lecture pontes
Permission.LOTS_ALEVINS_VOIR,       // lecture lots
Permission.INCUBATIONS_VOIR,        // lecture incubations
// Pas de GERER : le pisciculteur ne crée/modifie pas ces entités
// Pas de PLANNING_REPRODUCTION_VOIR par défaut — peut être ajouté si besoin
```

Le rôle Pisciculteur dans `SYSTEM_ROLE_DEFINITIONS` est mis à jour pour inclure ces 5 nouvelles permissions en mode lecture seule.

### Ingénieur (SiteRole custom — pas dans SYSTEM_ROLE_DEFINITIONS par défaut)

Un ingénieur consultant peut avoir :
```typescript
Permission.ALEVINS_VOIR,
Permission.GENITEURS_VOIR,
Permission.PONTES_VOIR,
Permission.LOTS_ALEVINS_VOIR,
Permission.INCUBATIONS_VOIR,
Permission.PLANNING_REPRODUCTION_VOIR,
```

La gestion reste à la discrétion de l'administrateur du site.

---

## 7. Plan de migration ALEVINS_* → granulaires

### 7.1 Stratégie choisie : Extension sans rupture

**Option retenue : garder ALEVINS_* + ajouter les nouvelles permissions.**

Raisons :
- Supprimer des valeurs d'enum PostgreSQL nécessite une migration `DROP TYPE` + `CREATE TYPE` (approche RECREATE), risquée sur données de production
- `ALEVINS_VOIR` est réutilisé comme gate de module — son maintien est fonctionnellement justifié
- Les autres `ALEVINS_*` peuvent être mis en soft-deprecation sans migration immédiate

**Option rejetée : renommer ALEVINS_VOIR en REPRODUCTION_VOIR.** Trop coûteux (migration destructive + tous les endroits qui font référence au nom).

### 7.2 Étapes de migration

**Étape 1 — Migration Prisma (DB Specialist)**

Générer un script SQL qui ajoute les 9 nouvelles valeurs à l'enum `Permission` via `ALTER TYPE ... ADD VALUE` (non-destructif, PostgreSQL supporte ADD VALUE sans recreate depuis pg10) :

```sql
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'GENITEURS_VOIR';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'GENITEURS_GERER';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'PONTES_VOIR';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'PONTES_GERER';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'LOTS_ALEVINS_VOIR';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'LOTS_ALEVINS_GERER';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'INCUBATIONS_VOIR';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'INCUBATIONS_GERER';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'PLANNING_REPRODUCTION_VOIR';
```

Note : `ADD VALUE` ne peut pas être utilisé dans un bloc de transaction. La migration SQL doit exécuter ces instructions hors transaction (PostgreSQL 12+). Utiliser la directive `-- DISABLE_DDL_TRANSACTION` si la migration est générée via Prisma.

**Étape 2 — Mise à jour seed.sql (DB Specialist)**

Pour les SiteMembers existants en seed, ajouter les nouvelles permissions dans les tableaux `permissions` des rôles Administrateur et Gerant. Le rôle Pisciculteur reçoit les 5 permissions lecture-seule.

**Étape 3 — Mise à jour types TypeScript (Architect)**

Les nouvelles valeurs apparaissent automatiquement dans le type généré Prisma. Aucune modification manuelle de `src/types/models.ts` nécessaire si le type `Permission` est re-exporté depuis le client Prisma généré.

**Étape 4 — Mise à jour permissions-constants.ts (Developer)**

- Ajouter les nouvelles permissions dans `ITEM_VIEW_PERMISSIONS` (section 5)
- Mettre à jour `PERMISSION_GROUPS.alevins` (section 8)
- Mettre à jour `SYSTEM_ROLE_DEFINITIONS` pour Pisciculteur

**Étape 5 — Mise à jour du code API (Developer)**

Identifier tous les endroits où `ALEVINS_GERER`, `ALEVINS_CREER`, `ALEVINS_MODIFIER`, `ALEVINS_SUPPRIMER` sont utilisés dans les route handlers et les remplacer par les nouvelles permissions granulaires :

| Ancienne vérification | Nouvelle vérification |
|-----------------------|-----------------------|
| `requirePermission(ctx, Permission.ALEVINS_GERER)` sur `/api/reproducteurs` | `requirePermission(ctx, Permission.GENITEURS_GERER)` |
| `requirePermission(ctx, Permission.ALEVINS_GERER)` sur `/api/pontes` | `requirePermission(ctx, Permission.PONTES_GERER)` |
| `requirePermission(ctx, Permission.ALEVINS_GERER)` sur `/api/lots-alevins` | `requirePermission(ctx, Permission.LOTS_ALEVINS_GERER)` |
| `requirePermission(ctx, Permission.ALEVINS_VOIR)` sur lecture `/api/reproducteurs` | `requirePermission(ctx, Permission.GENITEURS_VOIR)` |
| `requirePermission(ctx, Permission.ALEVINS_VOIR)` sur lecture `/api/pontes` | `requirePermission(ctx, Permission.PONTES_VOIR)` |
| `requirePermission(ctx, Permission.ALEVINS_VOIR)` sur lecture `/api/lots-alevins` | `requirePermission(ctx, Permission.LOTS_ALEVINS_VOIR)` |

**Étape 6 — Mise à jour navigation (Developer)**

Modifier `farm-sidebar.tsx` et `farm-bottom-nav.tsx` selon les structures définies en section 4. Ajouter les clés i18n manquantes.

**Étape 7 — Mise à jour SiteRoles existants en base (DB Specialist)**

Pour les sites déjà créés, les SiteRoles système (Administrateur, Gerant) contiennent `ALEVINS_GERER` etc. Après la migration Prisma, exécuter un script SQL de backfill pour ajouter les nouvelles permissions aux membres existants qui ont déjà `ALEVINS_VOIR` :

```sql
-- Exemple : ajouter GENITEURS_VOIR à tous les membres qui ont ALEVINS_VOIR
UPDATE "SiteMember"
SET permissions = array_append(permissions, 'GENITEURS_VOIR'::"Permission")
WHERE 'ALEVINS_VOIR' = ANY(permissions)
  AND NOT ('GENITEURS_VOIR' = ANY(permissions));

-- Répéter pour chaque nouvelle permission READ sur les membres avec ALEVINS_VOIR
-- Répéter pour chaque nouvelle permission GERER sur les membres avec ALEVINS_GERER
```

### 7.3 Période de transition

Durant la période de transition (1 sprint), les vérifications de permissions dans le code acceptent l'ancienne OU la nouvelle permission :

```typescript
// Pattern de transition dans les middlewares API
function hasReproducteurAccess(permissions: Permission[]): boolean {
  return (
    permissions.includes(Permission.GENITEURS_VOIR) ||
    permissions.includes(Permission.ALEVINS_VOIR)  // fallback legacy
  );
}
```

Ce fallback est retiré dès que le backfill de la base est confirmé.

---

## 8. Mise à jour PERMISSION_GROUPS

Dans `permissions-constants.ts`, le groupe `alevins` est renommé `reproduction` et étendu :

```typescript
export const PERMISSION_GROUPS = {
  // ... groupes existants ...

  // AVANT (à supprimer/remplacer)
  // alevins: [
  //   Permission.ALEVINS_VOIR,
  //   Permission.ALEVINS_CREER,
  //   Permission.ALEVINS_MODIFIER,
  //   Permission.ALEVINS_SUPPRIMER,
  //   Permission.ALEVINS_GERER,
  // ],

  // APRÈS
  reproduction: [
    // Gate de module
    Permission.ALEVINS_VOIR,
    // Géniteurs
    Permission.GENITEURS_VOIR,
    Permission.GENITEURS_GERER,
    // Pontes
    Permission.PONTES_VOIR,
    Permission.PONTES_GERER,
    // Lots Alevins
    Permission.LOTS_ALEVINS_VOIR,
    Permission.LOTS_ALEVINS_GERER,
    // Incubations
    Permission.INCUBATIONS_VOIR,
    Permission.INCUBATIONS_GERER,
    // Planning Reproduction
    Permission.PLANNING_REPRODUCTION_VOIR,
    // Legacy (soft-deprecated, conservées pour compatibilité)
    Permission.ALEVINS_GERER,
    Permission.ALEVINS_CREER,
    Permission.ALEVINS_MODIFIER,
    Permission.ALEVINS_SUPPRIMER,
  ],
} as const;
```

Ce groupe est utilisé par l'UI de gestion des rôles pour afficher les cases à cocher de la section "Reproduction".

---

## 9. Clés i18n requises

Ajouter dans `messages/fr.json` sous `navigation` :

```json
{
  "navigation": {
    "groups": {
      "reproduction": "Reproduction"
    },
    "modules": {
      "reproduction": "Reproduction"
    },
    "items": {
      "dashboardReproduction": "Tableau de bord",
      "geniteurs": "Géniteurs",
      "pontes": "Pontes",
      "lotsAlevins": "Lots Alevins",
      "incubations": "Incubations",
      "planningReproduction": "Planning"
    }
  }
}
```

Ajouter dans `messages/en.json` sous `navigation` :

```json
{
  "navigation": {
    "groups": {
      "reproduction": "Reproduction"
    },
    "modules": {
      "reproduction": "Reproduction"
    },
    "items": {
      "dashboardReproduction": "Dashboard",
      "geniteurs": "Breeders",
      "pontes": "Spawnings",
      "lotsAlevins": "Fry Batches",
      "incubations": "Incubations",
      "planningReproduction": "Planning"
    }
  }
}
```

---

## 10. Récapitulatif des fichiers à modifier

| Fichier | Action | Responsable |
|---------|--------|-------------|
| `prisma/schema.prisma` | Ajouter 9 valeurs à `enum Permission` | DB Specialist |
| `prisma/seed.sql` | Backfill permissions dans SiteMembers seed | DB Specialist |
| `src/types/models.ts` | Re-export automatique (aucun changement manuel si généré) | — |
| `src/lib/permissions-constants.ts` | `ITEM_VIEW_PERMISSIONS` + `PERMISSION_GROUPS` + `SYSTEM_ROLE_DEFINITIONS` | Developer |
| `src/components/layout/farm-sidebar.tsx` | Restructurer groupe Reproduction | Developer |
| `src/components/layout/farm-bottom-nav.tsx` | Étendre groupe reproduction à 5 items | Developer |
| `src/app/api/reproducteurs/route.ts` | Remplacer ALEVINS_* par GENITEURS_* | Developer |
| `src/app/api/pontes/route.ts` | Remplacer ALEVINS_* par PONTES_* | Developer |
| `src/app/api/lots-alevins/route.ts` | Remplacer ALEVINS_* par LOTS_ALEVINS_* | Developer |
| `messages/fr.json` | Ajouter clés i18n navigation Reproduction | Developer |
| `messages/en.json` | Ajouter clés i18n navigation Reproduction | Developer |

---

## 11. Contraintes et risques

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| `ADD VALUE` dans migration Prisma échoue sur shadow DB | Haute | Utiliser migration SQL manuelle avec `-- DISABLE_DDL_TRANSACTION` ou déployer via `migrate deploy` uniquement |
| Membres existants en production sans les nouvelles permissions | Certaine | Script backfill SQL obligatoire (section 7.2, Étape 7) |
| Routes `/alevins/*` cassées pendant la transition | Moyenne | Conserver les items `/alevins/*` dans `ITEM_VIEW_PERMISSIONS` le temps du déploiement |
| i18n — clés manquantes causant des erreurs next-intl | Faible | Ajouter TOUTES les clés avant de déployer la nav |

---

## Références

- ADR-044 — Module Reproduction Complet (D6 : /reproduction remplace /alevins)
- `src/lib/permissions-constants.ts` — patterns existants de permissions
- `src/components/layout/farm-sidebar.tsx` — structure actuelle sidebar
- `src/components/layout/farm-bottom-nav.tsx` — structure actuelle bottom nav + logique E5
- `prisma/schema.prisma` — enum Permission complet (lignes 137-228)
