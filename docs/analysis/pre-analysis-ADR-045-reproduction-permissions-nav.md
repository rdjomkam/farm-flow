# Pré-analyse ADR-045 — Reproduction : Permissions Granulaires et Navigation

**Date :** 2026-04-07
**Analyste :** @pre-analyst
**ADR cible :** ADR-045 — Reproduction Permissions Granulaires et Navigation

---

## Statut : GO AVEC RÉSERVES

---

## Résumé

Le terrain est globalement prêt pour l'implémentation d'ADR-045. La quasi-totalité des fichiers identifiés dans l'ADR existent avec les structures attendues. Trois divergences notables doivent être signalées aux agents implémenteurs : (1) le scope des API routes à modifier est plus large que décrit dans l'ADR (23 call sites au lieu de 6), (2) un fichier supplémentaire `src/lib/role-form-labels.ts` n'est pas listé dans le récapitulatif de l'ADR mais doit être modifié, (3) la stratégie `ADD VALUE` décrite dans l'ADR entre en contradiction directe avec ERR-001 documenté dans la base de connaissances — ce point est le risque le plus critique à traiter.

---

## Vérifications effectuées

### 1. Schema Prisma — enum Permission : OK

L'enum `Permission` dans `prisma/schema.prisma` (lignes 137–228) contient bien les 5 valeurs `ALEVINS_*` à migrer. Le schéma se termine à la ligne 228 après `ANALYTICS_PLATEFORME`. Aucune des 9 nouvelles valeurs (`GENITEURS_VOIR`, `GENITEURS_GERER`, `PONTES_VOIR`, `PONTES_GERER`, `LOTS_ALEVINS_VOIR`, `LOTS_ALEVINS_GERER`, `INCUBATIONS_VOIR`, `INCUBATIONS_GERER`, `PLANNING_REPRODUCTION_VOIR`) n'est présente. L'espace pour les ajouter est disponible.

### 2. Types TypeScript — enum Permission : OK avec réserve

`src/types/models.ts` contient l'enum `Permission` manuellement maintenu (non auto-généré depuis Prisma). Les 5 valeurs `ALEVINS_*` sont présentes (lignes 59–63). Les 9 nouvelles valeurs n'y sont pas encore.

**Réserve :** L'ADR section 7.2 Étape 3 dit "Aucune modification manuelle de `src/types/models.ts` nécessaire si le type `Permission` est re-exporté depuis le client Prisma généré." Ceci est FAUX pour ce projet : `src/types/models.ts` maintient un enum TypeScript manuel, distinct du client Prisma généré. Ce fichier DOIT être mis à jour manuellement avec les 9 nouvelles valeurs.

### 3. Navigation — farm-sidebar.tsx : PROBLÈMES CONFIRMÉS

**Confirmé — P3 :** Le groupe Reproduction (lignes 116–126) utilise `labelKey: "items.alevins"` au lieu d'une clé de groupe dédiée.

**Confirmé — Structure actuelle :**
- Ligne 117 : `labelKey: "items.alevins"` (incorrect — doit être `"groups.reproduction"`)
- Ligne 119 : `href: "/alevins"` (doit être `/reproduction`)
- Ligne 120 : `href: "/alevins/reproducteurs"` (doit être `/reproduction/geniteurs`)
- Ligne 121 : `href: "/alevins/pontes"` (doit être `/reproduction/pontes`)
- Ligne 122 : `href: "/alevins/lots"` (doit être `/reproduction/lots`)
- Logique `isActive` (ligne 192) inclut `"/alevins"` — doit ajouter `"/reproduction"`

**Note :** Les redirects `/alevins → /reproduction` existent dans `next.config.ts` (lignes 32–39), donc les routes `/alevins/*` dans la sidebar redirigent déjà vers `/reproduction/*` en production. La migration de nav est fonctionnellement urgente pour la cohérence d'affichage.

**Icône ThermometerSun :** Absente des imports lucide-react actuels du sidebar (ligne 7–38). À ajouter.

### 4. Navigation — farm-bottom-nav.tsx : PROBLÈMES CONFIRMÉS

**Confirmé — P2 :** Le groupe `reproduction` (lignes 196–208) n'a qu'un seul item (`/alevins`). La logique E5 (ligne 430 : `const showHeader = group.items.length > 1`) supprime le header "Reproduction" pour ce groupe.

**Structure actuelle :**
```
groupKey: "reproduction"  (ligne 197)
gatePermission: Permission.ALEVINS_VOIR  (ligne 198)
items: [{ href: "/alevins", ... }]  (1 seul item — lignes 199–206)
```

Icônes `Fish`, `Layers` présentes (lignes 9, 10) mais pas `ThermometerSun`, `LayoutDashboard` — à ajouter aux imports.

### 5. permissions-constants.ts : OK — Champs identifiés

`src/lib/permissions-constants.ts` est complet et lisible. Points à modifier :

- Ligne 104–110 : `PERMISSION_GROUPS.alevins` — à renommer `reproduction` et étendre
- Lignes 180–217 : `ITEM_VIEW_PERMISSIONS` — ajouter les nouvelles routes `/reproduction/*` et aliases `/alevins/*`
- Ligne 30–40 : `SYSTEM_ROLE_DEFINITIONS` pour Pisciculteur — ajouter les 5 permissions lecture

### 6. API routes à modifier : SCOPE PLUS LARGE QUE L'ADR

L'ADR section 10 liste 3 fichiers API (`/api/reproducteurs`, `/api/pontes`, `/api/lots-alevins`). L'analyse réelle révèle **53 call sites `ALEVINS_*`** répartis sur **22 fichiers de routes** :

**Groupe /api/reproducteurs (3 fichiers, 5 call sites) :**
- `src/app/api/reproducteurs/route.ts` lignes 13, 55
- `src/app/api/reproducteurs/[id]/route.ts` lignes 14, 30, 103

**Groupe /api/pontes (2 fichiers, 5 call sites) :**
- `src/app/api/pontes/route.ts` lignes 10, 47
- `src/app/api/pontes/[id]/route.ts` lignes 14, 30, 107

**Groupe /api/lots-alevins (3 fichiers, 5 call sites) :**
- `src/app/api/lots-alevins/route.ts` lignes 10, 47
- `src/app/api/lots-alevins/[id]/route.ts` lignes 13, 29
- `src/app/api/lots-alevins/[id]/transferer/route.ts` ligne 11

**Groupe /api/reproduction/geniteurs (2 fichiers, 5 call sites) :**
- `src/app/api/reproduction/geniteurs/route.ts` lignes 42, 122
- `src/app/api/reproduction/geniteurs/[id]/route.ts` lignes 41, 82, 251
- `src/app/api/reproduction/geniteurs/[id]/utiliser-male/route.ts` ligne 26

**Groupe /api/reproduction/pontes (5 fichiers, 7 call sites) :**
- `src/app/api/reproduction/pontes/route.ts` lignes 12, 61
- `src/app/api/reproduction/pontes/[id]/route.ts` lignes 11, 31
- `src/app/api/reproduction/pontes/[id]/echec/route.ts` ligne 18
- `src/app/api/reproduction/pontes/[id]/stripping/route.ts` ligne 19
- `src/app/api/reproduction/pontes/[id]/resultat/route.ts` ligne 20

**Groupe /api/reproduction/incubations (4 fichiers, 7 call sites) :**
- `src/app/api/reproduction/incubations/route.ts` lignes 12, 58
- `src/app/api/reproduction/incubations/[id]/route.ts` lignes 12, 32
- `src/app/api/reproduction/incubations/[id]/traitements/route.ts` ligne 12
- `src/app/api/reproduction/incubations/[id]/traitements/[traitementId]/route.ts` ligne 11
- `src/app/api/reproduction/incubations/[id]/eclosion/route.ts` ligne 11

**Groupe /api/reproduction/lots (5 fichiers, 8 call sites) :**
- `src/app/api/reproduction/lots/route.ts` lignes 13, 73
- `src/app/api/reproduction/lots/[id]/route.ts` lignes 13, 36, 121
- `src/app/api/reproduction/lots/[id]/split/route.ts` ligne 13
- `src/app/api/reproduction/lots/[id]/phase/route.ts` ligne 15
- `src/app/api/reproduction/lots/[id]/sortie/route.ts` ligne 15

**Groupe /api/reproduction/kpis + stats + planning (4 fichiers, 4 call sites) :**
- `src/app/api/reproduction/kpis/route.ts` ligne 26
- `src/app/api/reproduction/kpis/lots/route.ts` ligne 22
- `src/app/api/reproduction/kpis/funnel/route.ts` ligne 26
- `src/app/api/reproduction/stats/route.ts` ligne 26
- `src/app/api/reproduction/planning/route.ts` ligne 26

**Table de mapping complète des remplacements :**

| Ancienne permission | Nouvelle permission | Routes concernées |
|---------------------|---------------------|-------------------|
| `ALEVINS_VOIR` (GET) | `GENITEURS_VOIR` | `/api/reproducteurs`, `/api/reproduction/geniteurs` |
| `ALEVINS_VOIR` (GET) | `PONTES_VOIR` | `/api/pontes`, `/api/reproduction/pontes` |
| `ALEVINS_VOIR` (GET) | `LOTS_ALEVINS_VOIR` | `/api/lots-alevins`, `/api/reproduction/lots` |
| `ALEVINS_VOIR` (GET) | `INCUBATIONS_VOIR` | `/api/reproduction/incubations` |
| `ALEVINS_VOIR` (GET) | `ALEVINS_VOIR` (inchangé) | `/api/reproduction/kpis`, `/api/reproduction/stats`, `/api/reproduction/planning` |
| `ALEVINS_CREER` (POST) | `GENITEURS_GERER` | `/api/reproducteurs`, `/api/reproduction/geniteurs` |
| `ALEVINS_CREER` (POST) | `PONTES_GERER` | `/api/pontes` |
| `ALEVINS_CREER` (POST) | `LOTS_ALEVINS_GERER` | `/api/lots-alevins`, `/api/reproduction/lots` (PUT étapes) |
| `ALEVINS_MODIFIER` (PUT/PATCH) | `GENITEURS_GERER` | `/api/reproduction/geniteurs/[id]`, `utiliser-male` |
| `ALEVINS_MODIFIER` (PUT/PATCH) | `PONTES_GERER` | `/api/pontes/[id]`, `echec`, `stripping`, `resultat` |
| `ALEVINS_MODIFIER` (PUT/PATCH) | `LOTS_ALEVINS_GERER` | `/api/lots-alevins/[id]`, `transferer`, `lots/[id]/*` |
| `ALEVINS_MODIFIER` (PUT/PATCH) | `INCUBATIONS_GERER` | `/api/reproduction/incubations/*` |
| `ALEVINS_SUPPRIMER` (DELETE) | `GENITEURS_GERER` | `/api/reproducteurs/[id]`, `/api/reproduction/geniteurs/[id]` |
| `ALEVINS_SUPPRIMER` (DELETE) | `PONTES_GERER` | `/api/pontes/[id]`, `/api/reproduction/pontes/[id]` |
| `ALEVINS_SUPPRIMER` (DELETE) | `LOTS_ALEVINS_GERER` | `/api/reproduction/lots/[id]` |
| `ALEVINS_SUPPRIMER` (DELETE) | `INCUBATIONS_GERER` | `/api/reproduction/incubations/[id]/traitements/[id]` |

### 7. i18n — messages/fr.json et messages/en.json : RÉSERVES

**Structure des fichiers :** Les messages sont organisés par namespace sous `src/messages/{fr,en}/navigation.json` (pas `messages/fr.json` comme l'ADR l'indique).

**État actuel (fr/navigation.json) :**
- `modules.reproduction` : EXISTE (ligne 3) — la clé bottom-nav `modules.reproduction` est présente
- `items.geniteurs` : EXISTE (ligne 20)
- `items.pontes` : EXISTE (ligne 22)
- `items.lotsAlevins` : EXISTE (ligne 23)
- `items.alevins` : EXISTE (ligne 84) — à conserver pour les aliases temporaires

**Clés MANQUANTES requises par l'ADR :**
- `groups.reproduction` — ABSENT (seuls 10 clés présentes dans `groups`, pas `reproduction`)
- `items.dashboardReproduction` — ABSENT
- `items.incubations` — ABSENT
- `items.planningReproduction` — ABSENT

**État actuel (en/navigation.json) :**
Mêmes absences : `groups.reproduction`, `items.dashboardReproduction`, `items.incubations`, `items.planningReproduction`.

### 8. Structure des routes pages : RÉSERVE

**Pages existantes sous `(farm)/reproduction/` :**
- `src/app/(farm)/reproduction/geniteurs/page.tsx` (seule page existante)

**Pages MANQUANTES requises par la nouvelle navigation :**
- `src/app/(farm)/reproduction/page.tsx` — dashboard Reproduction (href `/reproduction`)
- `src/app/(farm)/reproduction/pontes/page.tsx`
- `src/app/(farm)/reproduction/lots/page.tsx`
- `src/app/(farm)/reproduction/incubations/page.tsx`
- `src/app/(farm)/reproduction/planning/page.tsx`

**Note :** Les redirects dans `next.config.ts` font que `/alevins` → `/reproduction` et `/alevins/:path*` → `/reproduction/:path*`. Les pages existantes sous `(farm)/alevins/` (`page.tsx` et `lots/page.tsx`) servent donc actuellement de destination pour ces redirects. La navigation va pointer vers des routes qui n'ont pas encore de pages dédiées.

### 9. Seed.sql : RÉSERVE

`prisma/seed.sql` contient 3 blocs de permissions (lignes 133–139, 211–217, 305–311) avec les valeurs `ALEVINS_*` pour les SiteMembers. Les 9 nouvelles valeurs ne sont pas encore présentes. Le backfill décrit en section 7.2 Étape 2 et Étape 7 de l'ADR doit être appliqué.

### 10. Fichier non listé dans l'ADR — role-form-labels.ts

`src/lib/role-form-labels.ts` (lignes 51–55) contient des labels UI pour les 5 permissions `ALEVINS_*` existantes. Ce fichier n'est pas mentionné dans la section 10 de l'ADR mais DOIT recevoir des labels pour les 9 nouvelles permissions.

---

## Incohérences trouvées

### INC-1 — Contradiction ADR-045 vs ERR-001 : stratégie migration enum (CRITIQUE)

**Description :** L'ADR-045 section 7.2 Étape 1 prescrit `ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS ...` suivi de la directive `-- DISABLE_DDL_TRANSACTION`. Or ERR-001 dans `docs/knowledge/ERRORS-AND-FIXES.md` dit explicitement "JAMAIS `ADD VALUE` + `UPDATE` dans la même migration. Toujours RECREATE."

**Analyse :** La contradiction est partielle. L'ADR-045 n'effectue pas de `UPDATE` après le `ADD VALUE` — il ajoute uniquement des valeurs NOUVELLES (non retrait de valeurs existantes). PostgreSQL 12+ supporte `ADD VALUE` sans transaction et sans `UPDATE`, ce qui est techniquement correct. La règle ERR-001 vise spécifiquement l'ajout + utilisation immédiate dans la même transaction, pas l'ajout seul.

Cependant, la MEMORY.md du projet note : "Enum migration strategy (PostgreSQL) — NEVER use `ADD VALUE` + `UPDATE` in the same migration (fails on shadow DB)" et "Use RECREATE approach only". La MEMORY.md dit "Use RECREATE approach only" sans restriction aux cas avec UPDATE.

**Impact :** Si le DB Specialist applique aveuglément la règle RECREATE pour cette migration, cela risque de recréer l'enum complet (55+ valeurs actuelles) et de caster toutes les colonnes — migration lourde et risquée. Si le DB Specialist applique `ADD VALUE` selon l'ADR, cela doit être fait HORS transaction (directive `-- DISABLE_DDL_TRANSACTION` ou migration SQL manuelle).

**Suggestion :** Utiliser `ADD VALUE IF NOT EXISTS` hors transaction est la bonne approche ici car AUCUNE valeur existante n'est retirée. Documenter explicitement dans le ticket que ERR-001 ne s'applique pas à ce cas (ajout pur, sans retrait ni UPDATE dans la même migration).

**Fichiers :** `docs/knowledge/ERRORS-AND-FIXES.md`, `prisma/schema.prisma`, ADR-045 section 7.2

### INC-2 — src/types/models.ts doit être mis à jour manuellement

**Description :** L'ADR section 7.2 Étape 3 dit "Aucune modification manuelle de `src/types/models.ts` nécessaire si le type `Permission` est re-exporté depuis le client Prisma généré." Le type `Permission` dans `src/types/models.ts` est un enum TypeScript MANUEL, pas auto-généré.

**Fichiers :** `src/types/models.ts` (lignes 28–63)

### INC-3 — 14 fichiers API supplémentaires non listés dans l'ADR

**Description :** L'ADR liste 3 fichiers API à modifier. L'analyse révèle 22 fichiers avec des références `ALEVINS_*`. Les routes sous `/api/reproduction/` (créées dans les sprints R1–R5) utilisent toutes `ALEVINS_*` — elles ne sont pas mentionnées.

**Fichiers :** Voir section 6 ci-dessus — liste exhaustive.

### INC-4 — role-form-labels.ts absent du récapitulatif ADR

**Description :** `src/lib/role-form-labels.ts` a des labels UI pour les permissions `ALEVINS_*`. Il n'est pas listé dans la section 10 de l'ADR.

**Fichiers :** `src/lib/role-form-labels.ts` (lignes 51–55)

### INC-5 — Pages routes manquantes pour la navigation cible

**Description :** La nouvelle navigation pointe vers 5 routes (`/reproduction`, `/reproduction/pontes`, `/reproduction/lots`, `/reproduction/incubations`, `/reproduction/planning`). Seule `/reproduction/geniteurs` a une page. Les autres routes n'ont pas de `page.tsx`.

**Note :** ADR-045 est explicitement une ADR de permissions et navigation — la création des pages n'est peut-être pas dans son scope. Mais si la navigation est déployée avant les pages, les utilisateurs verront des 404. À clarifier avec l'architecte.

---

## Risques identifiés

### RISQUE-1 — Priorité HAUTE : Stratégie migration enum ambiguë
L'agent DB Specialist pourrait choisir l'approche RECREATE par réflexe (suite à MEMORY.md "Use RECREATE approach only"), ce qui est inutilement complexe et risqué pour 9 ajouts purs. A contrario, s'il utilise `ADD VALUE` dans une transaction Prisma standard, la migration échouera sur la shadow DB. **Mitigation :** Expliciter dans le ticket que cette migration doit utiliser un fichier SQL manuel avec les `ADD VALUE IF NOT EXISTS` hors transaction (workflow `migrate deploy` non-interactif documenté dans ERR-002).

### RISQUE-2 — Priorité MOYENNE : Navigation cassée si pages manquantes
Si la navigation est mise à jour avant la création des pages `page.tsx` manquantes, les items de nav mèneront à des 404. **Mitigation :** Soit créer des pages stub minimalistes dans le même ticket, soit contraindre le déploiement de la navigation après création des pages.

### RISQUE-3 — Priorité MOYENNE : Backfill seed insuffisant
Le `seed.sql` n'inclura pas les nouvelles permissions pour les membres existants. En dev local, après `npm run db:seed`, les membres n'auront pas les nouvelles permissions même si le schéma les supporte. **Mitigation :** Ajouter le backfill SQL dans `seed.sql` ET fournir un script de backfill pour les environnements déjà peuplés.

### RISQUE-4 — Priorité BASSE : Clé i18n `groups.reproduction` manquante
Si la nav est déployée avec `labelKey: "groups.reproduction"` avant que la clé soit ajoutée à `navigation.json`, next-intl lancera une erreur ou affichera la clé brute. **Mitigation :** Ajouter les 4 clés manquantes en priorité dans la même PR que la nav.

---

## Prérequis manquants

1. **Décision sur la stratégie migration** : l'agent DB Specialist doit confirmer qu'il utilise `ADD VALUE IF NOT EXISTS` hors transaction (et non RECREATE). À documenter dans le ticket.

2. **Clarification du scope des pages** : ADR-045 couvre-t-il la création des pages stub manquantes, ou est-ce un prérequis d'un autre ADR/ticket ?

3. **Périmètre des "legacy routes"** `/api/reproducteurs`, `/api/pontes`, `/api/lots-alevins` : Ces routes existent en parallèle de `/api/reproduction/*`. Faut-il les déprécier/supprimer dans ce sprint ou les maintenir ? L'ADR ne le précise pas.

---

## Récapitulatif complet des fichiers à modifier

| Fichier | Action | Agent | Lignes concernées |
|---------|--------|-------|-------------------|
| `prisma/schema.prisma` | Ajouter 9 valeurs enum Permission | DB Specialist | Après ligne 172 (bloc Alevins) |
| `prisma/seed.sql` | Backfill permissions SiteMembers + nouvelles permissions | DB Specialist | Lignes 133–139, 211–217, 305–311 |
| `src/types/models.ts` | Ajouter 9 valeurs enum Permission (MANUEL) | Developer/Architect | Après ligne 63 |
| `src/lib/permissions-constants.ts` | `PERMISSION_GROUPS.alevins` → `reproduction` + `ITEM_VIEW_PERMISSIONS` + `SYSTEM_ROLE_DEFINITIONS` | Developer | Lignes 104–110, 180–217, 30–40 |
| `src/lib/role-form-labels.ts` | Ajouter labels pour 9 nouvelles permissions | Developer | Après ligne 55 |
| `src/components/layout/farm-sidebar.tsx` | Restructurer groupe Reproduction (labelKey, hrefs, icône ThermometerSun) | Developer | Lignes 117–126, 192–208 (isActive) |
| `src/components/layout/farm-bottom-nav.tsx` | Étendre groupe reproduction à 5 items | Developer | Lignes 196–208 |
| `src/messages/fr/navigation.json` | Ajouter `groups.reproduction`, `items.dashboardReproduction`, `items.incubations`, `items.planningReproduction` | Developer | Lignes 112–124 (groups), 17–98 (items) |
| `src/messages/en/navigation.json` | Mêmes 4 clés en anglais | Developer | Lignes 112–124 (groups), 17–98 (items) |
| `src/app/api/reproducteurs/route.ts` | `ALEVINS_VOIR` → `GENITEURS_VOIR`, `ALEVINS_CREER` → `GENITEURS_GERER` | Developer | Lignes 13, 55 |
| `src/app/api/reproducteurs/[id]/route.ts` | `ALEVINS_VOIR` → `GENITEURS_VOIR`, `ALEVINS_MODIFIER` → `GENITEURS_GERER`, `ALEVINS_SUPPRIMER` → `GENITEURS_GERER` | Developer | Lignes 14, 30, 103 |
| `src/app/api/pontes/route.ts` | `ALEVINS_VOIR` → `PONTES_VOIR`, `ALEVINS_CREER` → `PONTES_GERER` | Developer | Lignes 10, 47 |
| `src/app/api/pontes/[id]/route.ts` | `ALEVINS_VOIR` → `PONTES_VOIR`, `ALEVINS_MODIFIER` → `PONTES_GERER`, `ALEVINS_SUPPRIMER` → `PONTES_GERER` | Developer | Lignes 14, 30, 107 |
| `src/app/api/lots-alevins/route.ts` | `ALEVINS_VOIR` → `LOTS_ALEVINS_VOIR`, `ALEVINS_CREER` → `LOTS_ALEVINS_GERER` | Developer | Lignes 10, 47 |
| `src/app/api/lots-alevins/[id]/route.ts` | `ALEVINS_VOIR` → `LOTS_ALEVINS_VOIR`, `ALEVINS_MODIFIER` → `LOTS_ALEVINS_GERER` | Developer | Lignes 13, 29 |
| `src/app/api/lots-alevins/[id]/transferer/route.ts` | `ALEVINS_MODIFIER` → `LOTS_ALEVINS_GERER` | Developer | Ligne 11 |
| `src/app/api/reproduction/geniteurs/route.ts` | `ALEVINS_VOIR` → `GENITEURS_VOIR`, `ALEVINS_CREER` → `GENITEURS_GERER` | Developer | Lignes 42, 122 |
| `src/app/api/reproduction/geniteurs/[id]/route.ts` | `ALEVINS_VOIR` → `GENITEURS_VOIR`, `ALEVINS_MODIFIER` → `GENITEURS_GERER`, `ALEVINS_SUPPRIMER` → `GENITEURS_GERER` | Developer | Lignes 41, 82, 251 |
| `src/app/api/reproduction/geniteurs/[id]/utiliser-male/route.ts` | `ALEVINS_MODIFIER` → `GENITEURS_GERER` | Developer | Ligne 26 |
| `src/app/api/reproduction/pontes/route.ts` | `ALEVINS_VOIR` → `PONTES_VOIR`, `ALEVINS_MODIFIER` → `PONTES_GERER` | Developer | Lignes 12, 61 |
| `src/app/api/reproduction/pontes/[id]/route.ts` | `ALEVINS_VOIR` → `PONTES_VOIR`, `ALEVINS_SUPPRIMER` → `PONTES_GERER` | Developer | Lignes 11, 31 |
| `src/app/api/reproduction/pontes/[id]/echec/route.ts` | `ALEVINS_MODIFIER` → `PONTES_GERER` | Developer | Ligne 18 |
| `src/app/api/reproduction/pontes/[id]/stripping/route.ts` | `ALEVINS_MODIFIER` → `PONTES_GERER` | Developer | Ligne 19 |
| `src/app/api/reproduction/pontes/[id]/resultat/route.ts` | `ALEVINS_MODIFIER` → `PONTES_GERER` | Developer | Ligne 20 |
| `src/app/api/reproduction/incubations/route.ts` | `ALEVINS_VOIR` → `INCUBATIONS_VOIR`, `ALEVINS_MODIFIER` → `INCUBATIONS_GERER` | Developer | Lignes 12, 58 |
| `src/app/api/reproduction/incubations/[id]/route.ts` | `ALEVINS_VOIR` → `INCUBATIONS_VOIR`, `ALEVINS_MODIFIER` → `INCUBATIONS_GERER` | Developer | Lignes 12, 32 |
| `src/app/api/reproduction/incubations/[id]/traitements/route.ts` | `ALEVINS_MODIFIER` → `INCUBATIONS_GERER` | Developer | Ligne 12 |
| `src/app/api/reproduction/incubations/[id]/traitements/[traitementId]/route.ts` | `ALEVINS_SUPPRIMER` → `INCUBATIONS_GERER` | Developer | Ligne 11 |
| `src/app/api/reproduction/incubations/[id]/eclosion/route.ts` | `ALEVINS_MODIFIER` → `INCUBATIONS_GERER` | Developer | Ligne 11 |
| `src/app/api/reproduction/lots/route.ts` | `ALEVINS_VOIR` → `LOTS_ALEVINS_VOIR`, `ALEVINS_MODIFIER` → `LOTS_ALEVINS_GERER` | Developer | Lignes 13, 73 |
| `src/app/api/reproduction/lots/[id]/route.ts` | `ALEVINS_VOIR` → `LOTS_ALEVINS_VOIR`, `ALEVINS_MODIFIER` → `LOTS_ALEVINS_GERER`, `ALEVINS_SUPPRIMER` → `LOTS_ALEVINS_GERER` | Developer | Lignes 13, 36, 121 |
| `src/app/api/reproduction/lots/[id]/split/route.ts` | `ALEVINS_MODIFIER` → `LOTS_ALEVINS_GERER` | Developer | Ligne 13 |
| `src/app/api/reproduction/lots/[id]/phase/route.ts` | `ALEVINS_MODIFIER` → `LOTS_ALEVINS_GERER` | Developer | Ligne 15 |
| `src/app/api/reproduction/lots/[id]/sortie/route.ts` | `ALEVINS_MODIFIER` → `LOTS_ALEVINS_GERER` | Developer | Ligne 15 |
| `src/app/api/reproduction/kpis/route.ts` | `ALEVINS_VOIR` → `ALEVINS_VOIR` (inchangé — gate module) | — | Ligne 26 (aucune action) |
| `src/app/api/reproduction/kpis/lots/route.ts` | Idem | — | Ligne 22 (aucune action) |
| `src/app/api/reproduction/kpis/funnel/route.ts` | Idem | — | Ligne 26 (aucune action) |
| `src/app/api/reproduction/stats/route.ts` | Idem | — | Ligne 26 (aucune action) |
| `src/app/api/reproduction/planning/route.ts` | `ALEVINS_VOIR` → `PLANNING_REPRODUCTION_VOIR` | Developer | Ligne 26 |

**Pages stub à créer (si dans le scope) :**
| Fichier | Action |
|---------|--------|
| `src/app/(farm)/reproduction/page.tsx` | Créer page stub dashboard Reproduction |
| `src/app/(farm)/reproduction/pontes/page.tsx` | Créer page stub |
| `src/app/(farm)/reproduction/lots/page.tsx` | Créer page stub |
| `src/app/(farm)/reproduction/incubations/page.tsx` | Créer page stub |
| `src/app/(farm)/reproduction/planning/page.tsx` | Créer page stub |

---

## Recommandation

**GO AVEC RÉSERVES.** Implémenter ADR-045 en respectant les contraintes suivantes :

1. **Pour la migration Prisma** : utiliser `ADD VALUE IF NOT EXISTS` hors transaction via migration SQL manuelle (`migrate deploy`), PAS l'approche RECREATE. Documenter la raison (ajout pur, pas de retrait) pour lever l'ambiguïté avec ERR-001.

2. **Pour `src/types/models.ts`** : mise à jour manuelle obligatoire des 9 nouvelles valeurs enum.

3. **Pour les API routes** : couvrir les 22 fichiers identifiés, pas seulement les 3 listés dans l'ADR.

4. **Pour `role-form-labels.ts`** : ajouter les labels des 9 nouvelles permissions.

5. **Pour les pages manquantes** : soit créer des stubs minimalistes dans ce ticket, soit déployer la navigation uniquement après que les pages existent (à décider par le PM).
