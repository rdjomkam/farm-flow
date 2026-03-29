# ADR — Architecture de Navigation (Farm, Ingénieur, Backoffice)

**Date :** 2026-03-28
**Statut :** RÉVISÉ v2 — Intègre review adversariale (A1–A13) + edge cases (E1–E19) + corrections critiques (SuperAdmin bypass, route-level auth, layout résolution, loading state)
**Auteur :** @architect
**Référence :** ADR-ingenieur-interface.md, ADR-022-backoffice-separation.md, PLAN-feed-analytics-v2.md
**Supersède :** Version PROPOSÉ du 2026-03-28

---

## Contraintes héritées des ADR référencés

| ADR | Contrainte |
|-----|-----------|
| ADR-ingenieur-interface.md | INGENIEUR = layout séparé. Config élevage + règles activités = modules INGENIEUR exclusivement. Monitoring clients = INGENIEUR only. |
| ADR-022-backoffice-separation.md | Backoffice = `/backoffice/*` pour isSuperAdmin uniquement. Aucune navigation croisée. |
| PLAN-feed-analytics-v2.md | `/analytics/aliments` accessible via `/analytics` — pas d'item top-level dédié dans Stock. Simulation = outil avancé via bouton contextuel depuis `/analytics/aliments/[produitId]`. |
| CLAUDE.md | Mobile first 360px. Radix UI pour composants interactifs. Server Components par défaut. Touch targets ≥ 44px. |

---

## 1. Contexte et motivation

FarmFlow dessert trois audiences avec des besoins radicalement différents :

1. **Farm layout** (ADMIN, GERANT, PISCICULTEUR) — propriétaires et personnel de ferme. Utilisateurs quotidiens. Littératie tech variable, mobile-first strict.
2. **Ingénieur layout** (INGENIEUR) — techniciens terrain supervisant plusieurs fermes. Terrain, mobile, offline potentiel, actions rapides prioritaires.
3. **Backoffice layout** (isSuperAdmin) — équipe DKFarm uniquement. Pas de contrainte mobile critique.

**Principe d'accessibilité (révisé A2) :** "2 taps depuis la bottom nav pour toutes les fonctions PRIMAIRES (quotidiennes). Les vues détail et formulaires de création sont accessibles en 1 tap supplémentaire depuis la liste correspondante (3 taps total). Aucune fonction primaire ne dépasse 2 taps."

Fonctions primaires : tout item accessible depuis la bottom nav (tap direct) ou depuis le sheet Menu (1 tap sur Menu + 1 tap sur l'item = 2 taps).

---

## 2. Cartographie complète des routes

### 2.1 Routes hors layout (publiques / système)

| Route | Accessible depuis nav ? | Notes |
|-------|------------------------|-------|
| `/login` | N/A — page auth | Pas de nav |
| `/register` | N/A — page auth | Pas de nav |
| `/select-site` | N/A — flux session | Pas de nav |
| `/tarifs` | Non (lien dans sheet "Abonnement") | Page publique |
| `/checkout` | Non (flux depuis /tarifs) | Flux transactionnel |
| `/abonnement-expire` | Non (redirect automatique) | Page d'erreur |
| `/~offline` | N/A — PWA offline fallback | Pas de nav |

### 2.2 Routes partagées hors layout groups

Un sous-ensemble de routes existe à la racine de `src/app/` (hors des groupes `(farm)/` et `(ingenieur)/`). Ces routes héritent du layout (farm ou ingénieur) par la session active et le `AppShell`.

**Règle Next.js App Router (E4) :** Les route groups `(farm)` et `(ingenieur)` affectent uniquement les layouts, pas les URLs. Si une page existe dans `(ingenieur)/packs/page.tsx` mais pas dans `(farm)/`, le layout ingénieur est injecté quand un utilisateur farm navigue vers `/packs` — comportement incorrect. La solution est de placer ces pages à la racine `src/app/`.

**Mécanisme de résolution du layout (A7, E18) — vérifié dans `src/components/layout/app-shell.tsx` :**

`AppShell` est un Client Component wrappant tous les `children` depuis `src/app/layout.tsx`. Il lit `role` depuis les props (injectées par le Server Component layout depuis la session) et branche le rendu :

```
if (role === Role.INGENIEUR)   → <IngenieurSidebar> + <IngenieurBottomNav>
if (role in FARM_ROLES)        → <FarmSidebar> + <FarmBottomNav>
else (fallback)                → <Sidebar> + <BottomNav>  (legacy — à migrer)
```

Les pages racine (`/packs`, `/activations`, `/mes-taches`, etc.) héritent donc automatiquement du bon layout via ce branchement. Aucun mécanisme additionnel n'est nécessaire — `AppShell` délègue déjà à `IngenieurSidebar`/`FarmSidebar` selon le rôle.

Cas `/backoffice/*` : `AppShell` détecte `pathname.startsWith('/backoffice')` et rend `children` nus (sans nav), délégant la navigation au layout backoffice dédié.

**Note :** Les routes racine partagées doivent toutefois être placées à `src/app/` (non dans un route group) pour que le `layout.tsx` racine soit leur layout Next.js. Si elles sont dans `(ingenieur)/`, le layout du route group s'applique en priorité sur `src/app/layout.tsx`.

| Route | Fichier recommandé | Contexte |
|-------|-------------------|---------|
| `/packs` | `src/app/packs/page.tsx` | Farm + Ingénieur — **Phase 1 : déplacer depuis (ingenieur)/** |
| `/activations` | `src/app/activations/page.tsx` | Farm + Ingénieur — **Phase 1 : déplacer depuis (ingenieur)/** |
| `/mes-taches` | `src/app/mes-taches/page.tsx` | Farm + Ingénieur — **Phase 1 : déplacer depuis (ingenieur)/** |
| `/observations` | `src/app/observations/page.tsx` | Farm |
| `/stock/fournisseurs` | `src/app/stock/fournisseurs/page.tsx` | Farm + Ingénieur |
| `/stock/produits` | `src/app/stock/produits/page.tsx` | Farm + Ingénieur |
| `/stock/produits/[id]` | `src/app/stock/produits/[id]/page.tsx` | Farm + Ingénieur |
| `/alevins/lots/[id]` | `src/app/alevins/lots/[id]/page.tsx` | Farm |
| `/alevins/pontes` | `src/app/alevins/pontes/page.tsx` | Farm |
| `/alevins/pontes/[id]` | `src/app/alevins/pontes/[id]/page.tsx` | Farm |
| `/alevins/reproducteurs` | `src/app/alevins/reproducteurs/page.tsx` | Farm |
| `/alevins/reproducteurs/[id]` | `src/app/alevins/reproducteurs/[id]/page.tsx` | Farm |
| `/analytics/bacs` | `src/app/analytics/bacs/page.tsx` | Farm + Ingénieur |
| `/analytics/bacs/[bacId]` | `src/app/analytics/bacs/[bacId]/page.tsx` | Farm + Ingénieur |
| `/analytics/aliments/[produitId]` | `src/app/analytics/aliments/[produitId]/page.tsx` | Farm + Ingénieur |
| `/analytics/aliments/simulation` | `src/app/analytics/aliments/simulation/page.tsx` | Farm + Ingénieur |
| `/besoins/[id]` | `src/app/besoins/[id]/page.tsx` | Farm |
| `/besoins/nouveau` | `src/app/besoins/nouveau/page.tsx` | Farm |
| `/depenses/[id]` | `src/app/depenses/[id]/page.tsx` | Farm |
| `/depenses/nouvelle` | `src/app/depenses/nouvelle/page.tsx` | Farm |
| `/planning/nouvelle` | `src/app/planning/nouvelle/page.tsx` | Farm + Ingénieur |
| `/releves/nouveau` | `src/app/releves/nouveau/page.tsx` | Farm + Ingénieur (via FAB) |
| `/vagues/[id]/calibrages` | `src/app/vagues/[id]/calibrages/page.tsx` | Farm |
| `/vagues/[id]/calibrage/[calibrageId]` | `src/app/vagues/[id]/calibrage/[calibrageId]/page.tsx` | Farm |
| `/vagues/[id]/calibrage/nouveau` | `src/app/vagues/[id]/calibrage/nouveau/page.tsx` | Farm |

### 2.3 Routes Farm layout — `(farm)/*`

#### Groupe Élevage opérationnel

| Route | Farm sidebar | Farm bottom nav / sheet | Accessible mobile ? | Notes |
|-------|-------------|------------------------|---------------------|-------|
| `/` (dashboard) | Oui | Oui — item "Accueil" | Oui | — |
| `/vagues` | Oui | Oui — item "Ma ferme" | Oui | — |
| `/vagues/[id]` | Non | Via /vagues | Oui — 2 taps | — |
| `/vagues/[id]/releves` | Non | Via /vagues/[id] | Oui — 3 taps | — |
| `/vagues/[id]/calibrages` | Non | Via /vagues/[id] | Oui — 3 taps | — |
| `/vagues/[id]/calibrage/[calibrageId]` | Non | Via liste calibrages | Oui — 4 taps | — |
| `/vagues/[id]/calibrage/nouveau` | Non | Via /vagues/[id] | Oui | — |
| `/bacs` | Oui | Oui — dans sheet Élevage | Oui — 2 taps | Corrige L1 |
| `/releves` | Oui | Oui — dans sheet Élevage | Oui — 2 taps | Corrige L2 |
| `/calibrages` | **SUPPRIMÉ** | **N/A** | **Dead link corrigé** | A11, E10 — supprimer item FarmSidebar, route racine n'existe pas |
| `/observations` | Oui | Oui — dans sheet Élevage | Oui — 2 taps | Corrige L17 |
| `/notifications` | Non — topbar uniquement | Topbar (cloche) | Oui — topbar | A7 : cross-cutting, pas dans groupe Élevage |
| `/releves/nouveau` | Non (via FAB) | Via FAB | Oui — 1 tap | — |
| `/notes` | Oui | Oui — item bottom nav | Oui — 1 tap | E9 : conditionnel si ENVOYER_NOTES absent |

#### Groupe Stock & Approvisionnement

| Route | Farm sidebar | Farm sheet | Accessible mobile ? | Notes |
|-------|-------------|-----------|---------------------|-------|
| `/stock` | Oui | Oui — dans sheet Stock | Oui — 2 taps | — |
| `/stock/produits` | Oui | Via /stock tabs | Oui | — |
| `/stock/produits/[id]` | Non | Via liste produits | Oui — 3 taps | — |
| `/stock/mouvements` | Oui | Via /stock tabs | Oui | — |
| `/stock/fournisseurs` | Oui | Oui — dans sheet Stock | Oui — 2 taps | Corrige L15, I10 |
| `/stock/commandes` | Oui | Oui — dans sheet Stock | Oui — 2 taps | — |
| `/stock/commandes/[id]` | Non | Via liste commandes | Oui | — |
| `/besoins` | Oui | Oui — dans sheet Stock | Oui — 2 taps | Corrige L18 |
| `/besoins/[id]` | Non | Via /besoins | Oui | — |
| `/besoins/nouveau` | Non | Via /besoins | Oui | — |

#### Groupe Finances & Ventes

| Route | Farm sidebar | Farm sheet | Accessible mobile ? | Notes |
|-------|-------------|-----------|---------------------|-------|
| `/finances` | Oui | Oui — item bottom nav | Oui — 1 tap | — |
| `/ventes` | Oui | Oui — dans sheet Finances | Oui — 2 taps | — |
| `/ventes/[id]` | Non | Via /ventes | Oui | — |
| `/ventes/nouvelle` | Non | Via /ventes | Oui | — |
| `/factures` | Oui | Oui — dans sheet Finances | Oui — 2 taps | — |
| `/factures/[id]` | Non | Via /factures | Oui | — |
| `/clients` | Oui | Oui — dans sheet Finances | Oui — 2 taps | Corrige L9 |
| `/depenses` | Oui | Oui — dans sheet Finances | Oui — 2 taps | Corrige L8 |
| `/depenses/[id]` | Non | Via /depenses | Oui | — |
| `/depenses/nouvelle` | Non | Via /depenses | Oui | — |
| `/depenses/recurrentes` | Oui | Via /depenses | Oui | Corrige L10 |

#### Groupe Alevins

| Route | Farm sidebar | Farm sheet | Accessible mobile ? | Notes |
|-------|-------------|-----------|---------------------|-------|
| `/alevins` | Oui | Oui — dans sheet Alevins | Oui — 2 taps | Module REPRODUCTION requis |
| `/alevins/lots` | Oui | Via /alevins tabs | Oui | — |
| `/alevins/lots/[id]` | Non | Via /alevins/lots | Oui | — |
| `/alevins/pontes` | Oui | Via /alevins tabs | Oui | — |
| `/alevins/pontes/[id]` | Non | Via liste | Oui | — |
| `/alevins/reproducteurs` | Oui | Via /alevins tabs | Oui | — |
| `/alevins/reproducteurs/[id]` | Non | Via liste | Oui | — |

#### Groupe Planning & Activités

| Route | Farm sidebar | Farm sheet | Accessible mobile ? | Notes |
|-------|-------------|-----------|---------------------|-------|
| `/planning` | Oui | Oui — dans sheet Analyse | Oui — 2 taps | — |
| `/planning/nouvelle` | Non | Via /planning | Oui | — |
| `/mes-taches` | Oui | Oui — dans sheet Analyse | Oui — 2 taps | Corrige L4 — Phase 1 requis (déplacer à racine) |

#### Groupe Analytics

| Route | Farm sidebar | Farm sheet | Accessible mobile ? | Notes |
|-------|-------------|-----------|---------------------|-------|
| `/analytics` | Oui | Oui — dans sheet Analyse | Oui — 2 taps | — |
| `/analytics/vagues` | Oui | Via /analytics tabs | Oui | — |
| `/analytics/bacs` | Oui | Via /analytics tabs | Oui | — |
| `/analytics/bacs/[bacId]` | Non | Via liste | Oui | — |
| `/analytics/aliments` | Oui | Via /analytics tabs | Oui | A12 : PAS dans sheet Stock |
| `/analytics/aliments/[produitId]` | Non | Via liste | Oui | — |
| `/analytics/aliments/simulation` | Non | Via bouton sur [produitId] | Oui | Outil avancé — pas de nav directe |

#### Groupe Administration

| Route | Farm sidebar | Farm sheet | Accessible mobile ? | Notes |
|-------|-------------|-----------|---------------------|-------|
| `/settings/sites` | Oui | Oui — dans sheet Admin | Oui — 2 taps | — |
| `/settings/sites/[id]` | Non | Via liste | Oui | — |
| `/settings/sites/[id]/roles` | Non | Via /settings/sites/[id] | Oui | — |
| `/settings/alertes` | Oui | Oui — dans sheet Admin | Oui — 2 taps | Corrige L5 |
| `/settings/config-elevage` | **RETIRÉ farm** | **N/A farm** | N/A | Corrige M1 — module INGENIEUR |
| `/settings/regles-activites` | **RETIRÉ farm** | **N/A farm** | N/A | Corrige M2 — module INGENIEUR |
| `/users` | Oui | Oui — dans sheet Admin | Oui — 2 taps | — |
| `/users/[id]` | Non | Via liste | Oui | — |
| `/mon-abonnement` | Oui | Oui — dans sheet Admin | Oui — 2 taps | — |
| `/packs` | Oui | Oui — dans sheet Admin | Oui — 2 taps | Phase 1 : déplacer à racine |
| `/activations` | Oui | Oui — dans sheet Admin | Oui — 2 taps | Corrige L11 — Phase 1 : déplacer à racine |
| `/backoffice` | Oui | Oui — dans sheet Admin | Oui | isSuperAdmin uniquement |

### 2.4 Routes Ingénieur layout — `(ingenieur)/*`

| Route | Ingénieur sidebar | Ingénieur sheet | Accessible mobile ? | Notes |
|-------|------------------|----------------|---------------------|-------|
| `/` (dashboard) | Oui | Oui — item "Accueil" | Oui | — |
| `/mes-taches` | Oui | Oui — item bottom nav | Oui — 1 tap | Phase 1 : déplacer à racine |
| `/mes-taches/[id]` | Non | Via /mes-taches | Oui | — |
| `/monitoring` | Oui | Oui — item bottom nav | Oui — 1 tap | — |
| `/monitoring/[siteId]` | Non | Via /monitoring | Oui | — |
| `/monitoring/[siteId]/notes` | Non | Via /monitoring/[siteId] | Oui | — |
| `/monitoring/[siteId]/vagues/[vagueId]` | Non | Via /monitoring/[siteId] | Oui | — |
| `/notes` | Oui | Oui — dans sheet Monitoring | Oui — 2 taps | E9 : conditionnel |
| `/mon-portefeuille` | Oui | Oui — dans sheet Commercial | Oui — 2 taps | — |
| `/packs` | Oui | Oui — dans sheet Commercial | Oui — 2 taps | Phase 1 : déplacer à racine |
| `/packs/[id]` | Non | Via liste | Oui | — |
| `/activations` | Oui | Oui — dans sheet Commercial | Oui — 2 taps | Corrige L11 — Phase 1 : déplacer à racine |
| `/stock` | Oui | Oui — dans sheet Opérations | Oui — 2 taps | — |
| `/stock/produits` | Oui | Via /stock tabs | Oui | — |
| `/stock/produits/[id]` | Non | Via liste | Oui | — |
| `/stock/mouvements` | Oui | Via /stock tabs | Oui | — |
| `/stock/fournisseurs` | Oui | Oui — dans sheet Opérations | Oui — 2 taps | Corrige L15 |
| `/stock/commandes` | Oui | Oui — dans sheet Opérations | Oui — 2 taps | Corrige L16 |
| `/stock/commandes/[id]` | Non | Via liste | Oui | — |
| `/settings/alertes` | Oui | Oui — dans sheet Monitoring | Oui — 2 taps | Corrige I1, I9 |
| `/settings/config-elevage` | Oui | Oui — dans sheet Config | Oui — 2 taps | Corrige L6 |
| `/settings/config-elevage/[id]` | Non | Via liste | Oui | — |
| `/settings/config-elevage/nouveau` | Non | Via liste | Oui | — |
| `/settings/regles-activites` | Oui | Oui — dans sheet Config | Oui — 2 taps | Corrige L7 |
| `/settings/regles-activites/[id]` | Non | Via liste | Oui | — |
| `/settings/regles-activites/nouvelle` | Non | Via liste | Oui | — |
| `/settings/regles-activites/placeholders` | Non | Via liste | Oui | — |
| `/planning` | Oui | Oui — dans sheet Opérations | Oui — 2 taps | Corrige L13 |
| `/analytics` | Oui | Oui — dans sheet Opérations | Oui — 2 taps | Corrige L14 |
| `/releves/nouveau` | Non (via FAB) | Via FAB | Oui — 1 tap | FAB fonctionne |

### 2.5 Routes Backoffice layout — `/backoffice/*`

| Route | Backoffice sidebar | Backoffice mobile (sheet header) | Accessible mobile ? |
|-------|-------------------|----------------------------------|---------------------|
| `/backoffice` | — (redirect dashboard) | — | Oui |
| `/backoffice/dashboard` | Oui | Oui | Oui |
| `/backoffice/sites` | Oui | Oui | Oui |
| `/backoffice/sites/[id]` | Non | Via liste | Oui |
| `/backoffice/abonnements` | Oui | Oui | Oui |
| `/backoffice/plans` | Oui | Oui | Oui |
| `/backoffice/commissions` | Oui | Oui | Oui |
| `/backoffice/remises` | Oui | Oui | Oui |
| `/backoffice/modules` | Oui | Oui | Oui |

Le backoffice a une navigation mobile cohérente via hamburger + sheet. Aucune lacune identifiée.

---

## 3. Algorithme de permission gating

**Source de vérité :** `Permission` enum dans `src/types/models.ts`.

**SiteModule (A11) :** L'enum `SiteModule` est défini dans `src/types/models.ts` (ligne ~268). Valeurs actuelles :
`REPRODUCTION`, `GROSSISSEMENT`, `INTRANTS`, `VENTES`, `ANALYSE_PILOTAGE`, `PACKS_PROVISIONING`, `CONFIGURATION`, `INGENIEUR`, `NOTES`, `ABONNEMENTS`, `COMMISSIONS`, `REMISES`.
Toujours importer via `import { SiteModule } from "@/types"` (règle R2). Ne jamais utiliser la chaîne `"REPRODUCTION"` directement.

```typescript
/**
 * Interface NavItem — structure d'un item de navigation avec ses gates.
 */
interface NavItem {
  id: string;
  labelKey: string;              // Clé i18n : "navigation:items.xxx"
  href: string;
  icon: LucideIcon;
  requiredPermissions?: Permission[];      // ANY (OR logic)
  requiredPermissionsAll?: Permission[];   // ALL (AND logic)
  requiredModule?: SiteModule;
  superAdminOnly?: boolean;
  alwaysVisible?: boolean;       // A8 : Accueil + Menu
}

/**
 * Algorithme principal de gate — à appeler pour chaque item.
 *
 * Décision SuperAdmin (A5, E1, E17) :
 *   Un SuperAdmin voit TOUS les items de nav sans exception, y compris les items
 *   normaux (non-superAdminOnly) et les items protégés par module ou permission.
 *   Le bypass universel au step 1 remplace les anciennes étapes disjointes
 *   (check superAdminOnly puis check exclusion non-superAdmin) et élimine le bug
 *   où un SuperAdmin avec permissions[] vide se faisait refuser les items ordinaires.
 */
function isNavItemVisible(
  item: NavItem,
  userPermissions: Permission[],
  userModules: SiteModule[],
  isSuperAdmin: boolean
): boolean {
  // Null guards — défense en profondeur (E2-E5)
  const perms = userPermissions ?? [];
  const mods = userModules ?? [];

  // 1. SuperAdmin bypass universel — voit TOUT sans exception
  //    (remplace les anciens steps 1 "superAdminOnly+isSuperAdmin" et 2 "exclusion non-SA")
  if (isSuperAdmin) return true;

  // 2. SuperAdmin exclusif — refuser aux non-SA
  //    (ce step ne peut être atteint que si isSuperAdmin === false, cf. step 1)
  if (item.superAdminOnly) return false;

  // 3. Items toujours visibles (Accueil, Menu)
  if (item.alwaysVisible) return true;

  // 4. Gate module SiteModule
  if (item.requiredModule && !mods.includes(item.requiredModule)) {
    return false;
  }

  // 5. Gate permission ANY (OR)
  if (item.requiredPermissions && item.requiredPermissions.length > 0) {
    const hasAny = item.requiredPermissions.some(p => perms.includes(p));
    if (!hasAny) return false;
  }

  // 6. Gate permission ALL (AND)
  if (item.requiredPermissionsAll && item.requiredPermissionsAll.length > 0) {
    const hasAll = item.requiredPermissionsAll.every(p => perms.includes(p));
    if (!hasAll) return false;
  }

  return true;
}

/**
 * Gate de groupe — masquer si 0 items visibles (E1, E8).
 *
 * Signature explicite (corrige E2-E5 — évite le spread Parameters<> ambigu).
 */
function isGroupVisible(
  group: NavGroup,
  userPermissions: Permission[],
  userModules: SiteModule[],
  isSuperAdmin: boolean
): boolean {
  return group.items.some(item =>
    isNavItemVisible(item, userPermissions, userModules, isSuperAdmin)
  );
}

/**
 * Bottom nav minimum viable (A8, E2).
 * Minimum absolu : [Accueil] [Menu] — 2 items.
 */
function getVisibleBottomNavItems(
  items: BottomNavItem[],
  userPermissions: Permission[],
  userModules: SiteModule[],
  isSuperAdmin: boolean
): BottomNavItem[] {
  return items.filter(item =>
    item.alwaysVisible ||
    isNavItemVisible(item, userPermissions, userModules, isSuperAdmin)
  );
  // Note : ACCUEIL_ITEM et MENU_ITEM ont alwaysVisible: true → toujours présents
}

/**
 * Skeleton bottom nav (A15, E6) — état de chargement des permissions.
 *
 * Problème : avant que les permissions soient chargées, impossible de distinguer
 * "permissions vides" de "chargement en cours". Rendre un skeleton prévient
 * le flash de contenu (minimal → complet) et l'écran blanc.
 *
 * Spécification :
 *   - Hauteur identique à la vraie bottom nav : 56px (+ safe area iOS)
 *   - 5 slots gris uniformes, sans labels, sans icônes colorées
 *   - Implémentation : `animate-pulse`, `bg-muted`, `rounded-md`
 *   - Disparaît dès que `permissionsLoaded === true`
 *
 * Usage dans le composant :
 * ```tsx
 * if (!permissionsLoaded) return <BottomNavSkeleton />;
 * return <FarmBottomNav permissions={permissions} ... />;
 * ```
 *
 * Le skeleton est un composant séparé `BottomNavSkeleton`
 * (`src/components/layout/bottom-nav-skeleton.tsx`) réutilisable par
 * FarmBottomNav et IngenieurBottomNav.
 */
function BottomNavSkeleton(): ReactNode {
  // 5 slots gris uniformes, hauteur 56px, même positionnement que la vraie bottom nav
  // Aucun label, aucune icône — évite tout biais perceptif sur les permissions réelles
}
```

---

## 3bis. Autorisation au niveau des routes (A6, E10, E11)

**Principe fondamental : masquer les items de nav est UX, pas sécurité.**

Un utilisateur peut toujours taper une URL directement dans la barre d'adresse. Le gating de navigation ne protège pas contre l'accès direct.

### 3bis.1 Defense-in-depth — trois couches

| Couche | Mécanisme | Responsable |
|--------|-----------|-------------|
| **1 — Middleware** | Redirection avant rendu — guards layout-spécifiques | `src/middleware.ts` |
| **2 — Page Server Component** | Vérification permissions côté serveur — renvoie 403 ou redirect | Chaque `page.tsx` |
| **3 — API Routes** | Vérification permissions sur chaque mutation/lecture | Chaque `route.ts` |

La navigation (couche 0) est UX uniquement. Elle ne remplace aucune des trois couches ci-dessus.

### 3bis.2 Middleware guards (A6, E10, E11)

```typescript
// src/middleware.ts

// Routes accessibles UNIQUEMENT par INGENIEUR
const INGENIEUR_ONLY = [
  '/monitoring',
  '/mon-portefeuille',
  '/settings/config-elevage',    // ajout A6
  '/settings/regles-activites',  // ajout A6
];

// Routes accessibles UNIQUEMENT par les rôles Farm (ADMIN, GERANT, PISCICULTEUR)
const FARM_ONLY = [
  '/alevins',
  '/depenses',
  '/finances',
  '/factures',
  '/clients',
  '/ventes',
  '/besoins',
];

// Guard rôle null (E11)
if (!session.role || session.role === '') {
  if (!session.isSuperAdmin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// Guard INGENIEUR_ONLY
if (INGENIEUR_ONLY.some(r => pathname.startsWith(r))) {
  if (session.role !== Role.INGENIEUR && !session.isSuperAdmin) {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

// Guard FARM_ONLY
if (FARM_ONLY.some(r => pathname.startsWith(r))) {
  if (!FARM_ROLES.includes(session.role) && !session.isSuperAdmin) {
    return NextResponse.redirect(new URL('/', request.url));
  }
}
```

**Note :** Le middleware est la première ligne de défense, pas la seule. Chaque `page.tsx` DOIT également vérifier les permissions de l'utilisateur côté serveur (couche 2). Les API routes DOIVENT vérifier le `siteId` et les permissions à chaque appel (couche 3 — voir règle R8 CLAUDE.md).

### 3bis.3 Règle page-level (E10)

```typescript
// Exemple : src/app/(ingenieur)/monitoring/page.tsx
export default async function MonitoringPage() {
  const session = await getSession();
  if (!session || session.role !== Role.INGENIEUR) {
    redirect('/');
  }
  // ...
}
```

La vérification page-level est la **couche primaire** de sécurité. Le middleware est la couche de confort (évite le flash de rendu avant redirect).

---

**Mapping complet permissions réelles (cross-référence Permission enum) :**

| Route | Permission(s) requises | Logique | Module |
|-------|----------------------|---------|--------|
| `/` | DASHBOARD_VOIR | — | — |
| `/vagues` | VAGUES_VOIR | — | — |
| `/bacs` | BACS_GERER, BACS_MODIFIER | ANY | — |
| `/releves` | RELEVES_VOIR | — | — |
| `/releves/nouveau` | RELEVES_CREER | — | — |
| `/observations` | RELEVES_VOIR | — | — |
| `/notifications` | — | alwaysVisible | — |
| `/stock` | STOCK_VOIR | — | — |
| `/stock/produits` | STOCK_VOIR | — | — |
| `/stock/mouvements` | STOCK_GERER | — | — |
| `/stock/fournisseurs` | APPROVISIONNEMENT_VOIR | — | — |
| `/stock/commandes` | APPROVISIONNEMENT_GERER | — | — |
| `/besoins` | BESOINS_SOUMETTRE, BESOINS_APPROUVER | ANY | — |
| `/finances` | FINANCES_VOIR | — | — |
| `/ventes` | VENTES_VOIR | — | — |
| `/factures` | FACTURES_VOIR | — | — |
| `/clients` | CLIENTS_VOIR | — | — |
| `/depenses` | DEPENSES_VOIR | — | — |
| `/analytics` | DASHBOARD_VOIR | — | — |
| `/analytics/aliments` | DASHBOARD_VOIR | — | — |
| `/planning` | PLANNING_VOIR | — | — |
| `/mes-taches` | PLANNING_VOIR | — propre (E3) | — |
| `/alevins` | ALEVINS_VOIR | ALL + module | REPRODUCTION |
| `/settings/sites` | SITE_GERER | — | — |
| `/settings/alertes` | ALERTES_CONFIGURER | — | — |
| `/settings/config-elevage` | GERER_CONFIG_ELEVAGE | — | — (INGENIEUR) |
| `/settings/regles-activites` | REGLES_ACTIVITES_VOIR, GERER_REGLES_ACTIVITES | ANY | — (INGENIEUR) |
| `/users` | UTILISATEURS_VOIR | — | — |
| `/mon-abonnement` | ABONNEMENTS_VOIR | — | — |
| `/packs` | ACTIVER_PACKS | — | — |
| `/activations` | ACTIVER_PACKS | — | — |
| `/notes` | ENVOYER_NOTES | E9 : spécial | — |
| `/monitoring` | MONITORING_CLIENTS | — | — |
| `/mon-portefeuille` | PORTEFEUILLE_VOIR | — | — |
| `/backoffice` | — | isSuperAdmin | — |

---

## 4. Architecture Farm Layout — Spécification complète

### 4.1 Farm Bottom Nav Mobile (5 slots max)

```
┌──────────────────────────────────────────────────┐  ← 360px
│  FarmFlow                             [🔔] [▼]  │  ← topbar mobile (48px sticky)
├──────────────────────────────────────────────────┤
│  [contenu page]                                  │
├──────────────────────────────────────────────────┤
│  [Accueil]  [Ma ferme]  [Finances]  [Notes]  [☰]│  ← bottom nav 56px
└──────────────────────────────────────────────────┘
```

| Position | Id | Label (clé i18n) | Icon Lucide | Route | Permission | alwaysVisible |
|----------|----|-----------------|-------------|-------|------------|---------------|
| 1 | accueil | `navigation:items.accueil` | `Home` | `/` | DASHBOARD_VOIR | true |
| 2 | maFerme | `navigation:items.vagues` | `Waves` | `/vagues` | VAGUES_VOIR | false |
| 3 | finances | `navigation:items.analytiquesFinances` | `Wallet` | `/finances` | FINANCES_VOIR | false |
| 4 | messages | `navigation:items.notes` | `MessageSquare` | `/notes` | ENVOYER_NOTES | false |
| 5 | menu | `navigation:actions.menu` | `Menu` | sheet | — | true |

**Règle `isActive` pour Ma ferme (E12) :** couvre tout pathname commençant par `/vagues` (inclut `/vagues/[id]`, `/vagues/[id]/releves`, `/vagues/[id]/calibrages`, etc.), plus `/bacs`, `/releves`, `/observations`, `/analytics/bacs`, `/analytics/vagues`. Utiliser `pathname.startsWith('/vagues')` et non `pathname === '/vagues'` pour éviter de désactiver l'item quand on est sur un détail de vague.

**Règle `isActive` pour Finances :** couvre `/finances`, `/ventes`, `/factures`, `/clients`, `/depenses`.

**Comportement minimum viable (A8, E2) :**
- 0 permissions → `[Accueil]` `[Menu]` — 2 items
- VAGUES_VOIR seulement → `[Accueil]` `[Ma ferme]` `[Menu]` — 3 items
- VAGUES_VOIR + FINANCES_VOIR → `[Accueil]` `[Ma ferme]` `[Finances]` `[Menu]` — 4 items
- Toutes permissions → 5 items

Les items masqués ne laissent pas de slot vide. La bottom nav se recompresse.

**Layout flex quand FAB absent (E15) :** La bottom nav Ingénieur affiche normalement 4 items autour d'un FAB central. Si `RELEVES_CREER` est absent, le FAB est masqué et la bottom nav passe à 4 items normaux avec `justify-evenly` pour un espacement uniforme. Ne jamais laisser un slot vide au centre.

### 4.2 Farm Topbar Mobile — FarmHeader

Composant `FarmHeader` (`src/components/layout/farm-header.tsx`), `md:hidden`, `sticky top-0`, `z-50`, hauteur `h-12` :

```
┌──────────────────────────────────────────────┐
│  FarmFlow (Waves 20px)        [Bell] [Site▼] │
└──────────────────────────────────────────────┘
```

- Logo à gauche (icône `Waves` 20px + texte "FarmFlow" `text-sm font-semibold`)
- `NotificationBell` à droite — icône `Bell`, badge count plafonné à "99+" (E14), `bg-destructive text-destructive-foreground`, `text-[10px]`, `min-w-[16px] h-4`
- `SiteSelector` dropdown à droite — masqué si `userSites.length <= 1` (E6)

La cloche notifications est dans la topbar uniquement (A7). Elle n'apparaît pas dans le sheet Menu ni dans le groupe Élevage.

### 4.3 Farm Sheet "Menu" — Organisation complète

Le sheet s'ouvre du bas (Radix UI `Sheet` avec `side="bottom"`), hauteur max `85vh`, scroll vertical interne. En paysage (`orientation: landscape` + `height < 500px`) : side-drawer depuis la droite (`side="right"`, `w-80`) (E12).

**Structure avec clés i18n et permissions :**

```
GROUPE: navigation:modules.grossissement
  Gate : VAGUES_VOIR
  Items :
    /vagues           navigation:items.vagues          Waves           VAGUES_VOIR
    /bacs             navigation:items.bacs             Container       BACS_GERER | BACS_MODIFIER
    /releves          navigation:items.releve           NotebookPen     RELEVES_VOIR
    /observations     navigation:items.observations*   Eye             RELEVES_VOIR

GROUPE: navigation:modules.intrants
  Gate : STOCK_VOIR
  Items :
    /stock            navigation:items.stock            Package         STOCK_VOIR
    /stock/fournisseurs navigation:items.fournisseurs   Truck           APPROVISIONNEMENT_VOIR
    /stock/commandes  navigation:items.commandes        ShoppingCart    APPROVISIONNEMENT_GERER
    /besoins          navigation:items.besoins          ClipboardList   BESOINS_SOUMETTRE | BESOINS_APPROUVER

GROUPE: navigation:modules.ventes
  Gate : FINANCES_VOIR
  Items :
    /finances         navigation:items.analytiquesFinances Wallet      FINANCES_VOIR
    /ventes           navigation:items.ventesItem        Banknote       VENTES_VOIR
    /factures         navigation:items.factures          FileText        FACTURES_VOIR
    /clients          navigation:items.clientsItem*      UserRound       CLIENTS_VOIR
    /depenses         navigation:items.depenses          Receipt         DEPENSES_VOIR

GROUPE: navigation:modules.analysePilotage
  Gate : DASHBOARD_VOIR
  Items :
    /analytics        navigation:items.analytiquesVagues BarChart3     DASHBOARD_VOIR
    /planning         navigation:items.calendrier        Calendar        PLANNING_VOIR
    /mes-taches       navigation:items.mesTaches         ClipboardCheck  PLANNING_VOIR (gate propre E3)

GROUPE: navigation:modules.reproduction
  Gate : ALEVINS_VOIR + module REPRODUCTION
  Items :
    /alevins          navigation:items.lotsAlevins       Egg

GROUPE: navigation:modules.configuration
  Gate : SITE_GERER | UTILISATEURS_VOIR | ABONNEMENTS_VOIR | isSuperAdmin
  // E17 : isSuperAdmin doit figurer dans la gate du groupe pour que /backoffice
  // soit accessible depuis le sheet même quand les autres permissions sont vides.
  Items :
    /settings/sites   navigation:items.sites             Settings        SITE_GERER
    /settings/alertes navigation:items.alertes           BellRing        ALERTES_CONFIGURER (E15)
    /users            navigation:items.liste             Users           UTILISATEURS_VOIR
    /mon-abonnement   navigation:items.monAbonnement     CreditCard      ABONNEMENTS_VOIR
    /packs            navigation:items.packs             Boxes           ACTIVER_PACKS
    /activations      navigation:items.activationsItem*  PackageCheck    ACTIVER_PACKS
    /backoffice       navigation:items.adminSites        Shield          isSuperAdmin

Règle groupes vides (E1, E8) :
  Si visible_items(groupe) === 0 → masquer groupe entier (header + items)
  Si visible_items(groupe) === 1 → afficher sans header de groupe (E5)
```

*Clés i18n manquantes — à ajouter dans `src/messages/fr/navigation.json` (A13) :*
- `observations` → "Observations"
- `clientsItem` → "Clients"
- `activationsItem` → "Activations"
- `notificationsItem` → "Notifications" (pour usage futur)
- `portefeuilleItem` → "Portefeuille"

### 4.4 Farm Sidebar Desktop — Groupes réorganisés

```
┌──────────────────────────────────────────┐  ← w-60
│  Waves FarmFlow                    [Bell]│  ← header h-14
├──────────────────────────────────────────┤
│  ÉLEVAGE                                 │
│  ● Dashboard     (DASHBOARD_VOIR)        │
│  ● Vagues        (VAGUES_VOIR)           │
│  ● Bacs          (BACS_GERER|MODIFIER)  │
│  ● Relevés       (RELEVES_VOIR)          │
│  ● Observations  (RELEVES_VOIR)          │
├──────────────────────────────────────────┤
│  STOCK        (si STOCK_VOIR)            │
│  ● Vue stock                             │
│  ● Produits                              │
│  ● Mouvements                            │
│  ● Fournisseurs  (APPROVISIONNEMENT_VOIR)│
│  ● Commandes                             │
│  ● Besoins       (BESOINS_SOUMETTRE|…)  │
├──────────────────────────────────────────┤
│  FINANCES     (si FINANCES_VOIR)         │
│  ● Dashboard finances                    │
│  ● Ventes        (VENTES_VOIR)           │
│  ● Factures      (FACTURES_VOIR)         │
│  ● Clients       (CLIENTS_VOIR)          │
│  ● Dépenses      (DEPENSES_VOIR)         │
├──────────────────────────────────────────┤
│  ALEVINS      (si ALEVINS_VOIR+REPRO)   │
│  ● Vue alevins                           │
│  ● Reproducteurs                         │
│  ● Pontes                                │
│  ● Lots                                  │
├──────────────────────────────────────────┤
│  PLANNING & TÂCHES (si PLANNING_VOIR)   │
│  ● Planning                              │
│  ● Mes tâches    (PLANNING_VOIR propre) │
├──────────────────────────────────────────┤
│  ANALYTICS    (si DASHBOARD_VOIR)        │
│  ● Vue globale                           │
│  ● Vagues                                │
│  ● Bacs                                  │
│  ● Aliments                              │
├──────────────────────────────────────────┤
│  ADMINISTRATION (si SITE_GERER)          │
│  ● Paramètres sites                      │
│  ● Alertes       (ALERTES_CONFIGURER)   │
│  ● Utilisateurs  (UTILISATEURS_VOIR)     │
├──────────────────────────────────────────┤
│  ABONNEMENT   (si ABONNEMENTS_VOIR)      │
│  ● Mon abonnement                        │
│  ● Packs         (ACTIVER_PACKS)         │
│  ● Activations                           │
├──────────────────────────────────────────┤
│  SUPER ADMIN  (si isSuperAdmin)          │
│  ● Backoffice                            │
└──────────────────────────────────────────┘
```

**Changements vs état précédent :**
- `/calibrages` supprimé (A11, E10) — dead link
- `/settings/config-elevage` et `/settings/regles-activites` retirés (corrige M1, M2) — modules INGENIEUR
- `/bacs`, `/releves`, `/observations` ajoutés dans groupe Élevage
- `/clients`, `/depenses` dans groupe dédié Finances
- `/mes-taches` dans groupe Planning & Tâches

---

## 5. Architecture Ingénieur Layout — Spécification complète

### 5.1 Ingénieur Bottom Nav Mobile (4 items + FAB)

```
┌──────────────────────────────────────────────────────┐
│  FarmFlow (Ingénieur)                         [Bell] │  ← topbar mobile
├──────────────────────────────────────────────────────┤
│  [contenu page]                                      │
├──────────────────────────────────────────────────────┤
│  [Accueil]  [Tâches]  [  ⊕  ]  [Clients]  [☰]     │  ← 56px + FAB élevé
└──────────────────────────────────────────────────────┘
```

| Position | Id | Label (clé i18n) | Icon Lucide | Route | Permission |
|----------|----|-----------------|-------------|-------|------------|
| 1 | accueil | `navigation:items.accueil` | `Home` | `/` | alwaysVisible |
| 2 | taches | `navigation:items.taches` | `CheckSquare` | `/mes-taches` | PLANNING_VOIR (E3) |
| FAB | fab | — | `Plus` | `/releves/nouveau` | RELEVES_CREER |
| 4 | clients | `navigation:items.dashboardClients` | `Eye` | `/monitoring` | MONITORING_CLIENTS |
| 5 | menu | `navigation:actions.menu` | `Menu` | sheet | alwaysVisible |

**Spécification FAB (E7) :**
- Taille : `56×56px`, `rounded-full`
- Élévation : `absolute`, `-translate-y-3` au-dessus de la bottom nav
- Couleur : `bg-primary text-primary-foreground`
- `aria-label="Nouveau relevé"`
- Si RELEVES_CREER absent : FAB masqué, bottom nav repasse à 4 items normaux sans slot vide

### 5.2 Ingénieur Topbar Mobile — IngenieurHeader

Composant `IngenieurHeader` (`src/components/layout/ingenieur-header.tsx`), `md:hidden`, `sticky top-0`, `z-50`, `h-12` :

- Logo à gauche
- `NotificationBell` à droite — badge "99+" plafond (E14)

### 5.3 Ingénieur Sheet "Menu" — Organisation complète

**Alignement (A4) :** les groupes du sheet et de la sidebar utilisent les mêmes noms et contiennent les mêmes items dans le même ordre.

```
GROUPE: navigation:modules.ingenieur (Monitoring)
  Gate : MONITORING_CLIENTS
  Clé sidebar: MONITORING
  Items :
    /monitoring       navigation:items.dashboardClients  Eye            MONITORING_CLIENTS
    /notes            navigation:items.notes             NotebookPen    spécial E9

GROUPE: navigation:modules.operationsIngenieur (Opérations)
  Gate : aucun (toujours visible pour INGENIEUR)
  Clé sidebar: OPÉRATIONS
  Items :
    /stock            navigation:items.stock             Package        STOCK_VOIR
    /stock/fournisseurs navigation:items.fournisseurs    Truck          APPROVISIONNEMENT_VOIR
    /stock/commandes  navigation:items.commandes         ShoppingCart   APPROVISIONNEMENT_GERER
    /planning         navigation:items.calendrier        Calendar       PLANNING_VOIR
    /analytics        navigation:items.analytiquesVagues BarChart3     DASHBOARD_VOIR

GROUPE: navigation:modules.packsProvisioning (Commercial)
  Gate : ACTIVER_PACKS | PORTEFEUILLE_VOIR
  Clé sidebar: COMMERCIAL
  Items :
    /packs            navigation:items.packs             Boxes          ACTIVER_PACKS
    /activations      navigation:items.activationsItem*  PackageCheck   ACTIVER_PACKS
    /mon-portefeuille navigation:items.monPortefeuille   Wallet         PORTEFEUILLE_VOIR

GROUPE: navigation:modules.configuration (Configuration)
  Gate : GERER_CONFIG_ELEVAGE | REGLES_ACTIVITES_VOIR | ALERTES_CONFIGURER
  Clé sidebar: CONFIGURATION
  Items :
    /settings/alertes          navigation:items.alertes        BellRing ALERTES_CONFIGURER (E15, I1)
    /settings/config-elevage   navigation:items.profilsElevage Settings GERER_CONFIG_ELEVAGE
    /settings/regles-activites navigation:items.reglesActivites Zap     REGLES_ACTIVITES_VOIR

Règle E9 pour /notes :
  Si ENVOYER_NOTES présent → item visible, notes envoyables
  Si ENVOYER_NOTES absent MAIS notes reçues présentes → item visible en lecture seule
  Si ENVOYER_NOTES absent ET aucune note reçue → item masqué
```

**Note alignement (A4) :** `/settings/alertes` est dans le groupe Configuration (dans le sheet comme dans la sidebar). Il était précédemment dans le groupe Monitoring du sheet — cela créait une incohérence. La source de vérité est : alertes = configuration, pas monitoring.

### 5.4 Ingénieur Sidebar Desktop — Groupes réorganisés

```
┌──────────────────────────────────────────┐  ← w-60
│  Waves FarmFlow (Ingénieur)       [Bell] │  ← header h-14
├──────────────────────────────────────────┤
│  MONITORING   (si MONITORING_CLIENTS)    │
│  ● Clients supervisés  (Eye)             │
│  ● Notes        (ENVOYER_NOTES, E9)      │
├──────────────────────────────────────────┤
│  OPÉRATIONS   (toujours visible)         │
│  ● Stock        (STOCK_VOIR)             │
│  ● Produits                              │
│  ● Mouvements                            │
│  ● Fournisseurs (APPROV_VOIR)            │
│  ● Commandes    (APPROV_GERER)           │
│  ● Planning     (PLANNING_VOIR)          │
│  ● Analytics    (DASHBOARD_VOIR)         │
├──────────────────────────────────────────┤
│  COMMERCIAL   (si ACTIVER_PACKS|PORTEF.) │
│  ● Packs         (ACTIVER_PACKS)         │
│  ● Activations   (ACTIVER_PACKS)         │
│  ● Portefeuille  (PORTEFEUILLE_VOIR)     │
├──────────────────────────────────────────┤
│  CONFIGURATION  (si CONF.*)              │
│  ● Alertes      (ALERTES_CONFIGURER)    │
│  ● Config élevage (GERER_CONFIG_ELEVAGE)│
│  ● Règles activités (REGLES_ACT_VOIR)   │
└──────────────────────────────────────────┘
```

**Changements vs état précédent (A4) :**
- Groupe OPÉRATIONS renommé depuis le groupe ambigu (ex: portait la clé `grossissement`)
- `/settings/alertes` déplacé de MONITORING → CONFIGURATION (cohérence sheet/sidebar)
- Ordre des groupes aligné entre sheet et sidebar : Monitoring → Opérations → Commercial → Configuration

---

## 6. Notifications — Topbar mobile (cross-cutting)

`NotificationBell` est un composant cross-cutting accessible depuis la topbar mobile **et** la sidebar desktop pour les deux layouts.

**Architecture du badge (E7, E14) :**
```typescript
function formatBadgeCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';  // E7 : guard NaN/Infinity
  if (count > 99) return '99+';
  return String(count);
}
// Rendu badge : bg-destructive, text-[10px], min-w-[16px] h-4, absolute -top-1 -right-1
```

**Distinction icônes cloche (E15) :**
- `/notifications` (page liste des notifs) → icône `Bell` (état neutre)
- `/settings/alertes` (configuration des alertes) → icône `BellRing` (alerte active/configuration)

---

## 7. Comportement offline

### 7.1 Stratégie PWA

L'application est une PWA avec Service Worker. La navigation en mode offline :

**Bottom nav :** reste entièrement visible (shell mis en cache). Les items pointant vers des routes non-cachées affichent `opacity-50` + Toast "Hors ligne" au tap.

**Routes prioritaires en cache (Service Worker) :**
- Shell statique + nav : `cache-first`
- Dashboard `/` : `stale-while-revalidate`, TTL 5min
- `/mes-taches` : `stale-while-revalidate`, TTL 1h
- `/releves/nouveau` (FAB) : `network-first` avec queue de synchro différée

**Page `/~offline` :** affiche le bottom nav actif (routes en cache), message "Vous êtes hors connexion. Les données affichées peuvent ne pas être à jour."

### 7.2 Indicateur réseau

Dans la topbar mobile : dot `8×8px` rouge si offline, vert si en ligne. Ou bannière `bg-destructive` en haut si offline prolongé.

---

## 8. Spécifications mobiles

### 8.1 Dimensions

| Élément | Hauteur | Largeur | Notes |
|---------|---------|---------|-------|
| Bottom nav | 56px min | 100vw | `position: fixed; bottom: 0` + `pb-safe` |
| Bottom nav items | 44px touch target | `flex-1` | `text-xs` label, icône 20px |
| FAB | 56×56px | — | `position: absolute; -translate-y-3` |
| Topbar mobile | 48px | 100vw | `position: sticky; top: 0; z-50` |
| Sheet menu (portrait) | 85vh max | 100vw | bottom sheet, scroll interne |
| Sheet menu (landscape) | 100vh | 320px max | side-drawer right (E12) |
| Sheet header | 56px | — | `px-4` |
| Items sheet (grille) | 72px | `flex-1` | `grid-cols-3 gap-2 p-3` |
| Touch targets | 44×44px min | — | WCAG 2.5.5 |
| Icônes bottom nav | 20px | 20px | Lucide, `stroke-width: 1.5` |
| Icônes sheet | 24px | 24px | Lucide, `stroke-width: 1.5` |
| Badge notification | 16px | min 16px | position absolue coin icône |
| Safe area iOS | `env(safe-area-inset-bottom)` | — | `pb-safe` sur bottom nav |

### 8.2 SiteSelector (E6)

- Affiché uniquement si `userSites.length > 1`
- Si site unique : afficher le nom du site comme texte statique ou masquer complètement
- Composant Radix UI `DropdownMenu` ou `Select`

---

## 9. Performance et bundle (A1)

### 9.1 Stratégie de code splitting

```typescript
// Lazy loading des sheets — ne charger que si ouvert
const FarmMenuSheet = lazy(() => import('./farm-menu-sheet'));
const IngenieurMenuSheet = lazy(() => import('./ingenieur-menu-sheet'));

// Icônes Lucide — imports named uniquement (tree-shaking, pas import *)
import { Home, Waves, Wallet, MessageSquare, Menu } from 'lucide-react';
```

### 9.2 Cibles performance (appareils bas de gamme)

| Métrique | Cible | Contexte |
|----------|-------|---------|
| FCP | < 2s | 3G lent (1.5 Mbps) |
| TTI | < 4s | 3G lent |
| Bottom nav render | < 100ms | Immédiat |
| Sheet open animation | 200ms | `ease-out` |
| Bundle nav (gzipped) | < 15KB | Icônes + composants |

### 9.3 Optimisations

- `prefers-reduced-motion: reduce` → désactiver animations
- Pas de `backdrop-filter: blur()` sur les sheets (coûteux sur mid-range Android)
- `will-change: transform` uniquement pendant l'animation du sheet
- Réduire `box-shadow` sur bottom nav (coûteux GPU bas de gamme)

---

## 10. Stratégie i18n (A13)

### 10.1 Règle obligatoire

Tous les labels de navigation utilisent des clés i18n depuis `src/messages/fr/navigation.json`. Aucun texte hardcodé.

```typescript
// Correct
import { useTranslations } from 'next-intl';
const t = useTranslations('navigation');
<span>{t('items.vagues')}</span>

// Incorrect
<span>Vagues</span>
```

### 10.2 Clés à ajouter (A13)

Dans `src/messages/fr/navigation.json` — section `items` :
```json
{
  "observations": "Observations",
  "clientsItem": "Clients",
  "activationsItem": "Activations",
  "notificationsItem": "Notifications",
  "portefeuilleItem": "Portefeuille"
}
```

Dans `src/messages/en/navigation.json` — section `items` :
```json
{
  "observations": "Observations",
  "clientsItem": "Clients",
  "activationsItem": "Activations",
  "notificationsItem": "Notifications",
  "portefeuilleItem": "Portfolio"
}
```

---

## 11. Edge cases spécifiés

### E3 — /mes-taches gate propre

`/mes-taches` a son propre gate `PLANNING_VOIR` distinct du gate du groupe "Planning & Tâches". Même si le groupe est visible (ex: PLANNING_VOIR présent via un autre item), `/mes-taches` ne s'affiche que si l'utilisateur a `PLANNING_VOIR`.

### E5 — Groupe avec 1 seul item visible

```typescript
const visibleItems = group.items.filter(item => isNavItemVisible(item, ...));
if (visibleItems.length === 0) return null;
if (visibleItems.length === 1) return <NavItemFlat item={visibleItems[0]} />; // sans header
return <NavGroup header={t(group.labelKey)} items={visibleItems} />;
```

### E9 — /notes et permissions ingénieur

```typescript
const showNotes =
  userPermissions.includes(Permission.ENVOYER_NOTES) ||
  unreadNotesCount > 0; // API: GET /api/notes?unread=true&count=1
```

### E11 — Legacy null-role

```typescript
// src/middleware.ts
if (session && (!session.role || session.role === '') && !session.isSuperAdmin) {
  // E9 : tester role vide ET null — cas legacy possible
  return NextResponse.redirect(new URL('/login', request.url));
}
```

### E16 — Middleware guard routes layout-spécifiques

Voir section 3bis pour la spécification complète incluant `INGENIEUR_ONLY` et `FARM_ONLY`.

```typescript
// Extrait référence — spec complète en section 3bis.2
const INGENIEUR_ONLY = [
  '/monitoring', '/mon-portefeuille',
  '/settings/config-elevage', '/settings/regles-activites',
];
if (INGENIEUR_ONLY.some(r => pathname.startsWith(r))) {
  if (session.role !== Role.INGENIEUR && !session.isSuperAdmin) {
    return NextResponse.redirect(new URL('/', request.url));
  }
}
```

### E17 — SuperAdmin et groupe Configuration du sheet

Le groupe Configuration dans le Farm sheet a pour gate `SITE_GERER | UTILISATEURS_VOIR | ABONNEMENTS_VOIR | isSuperAdmin`. Sans le `isSuperAdmin`, un SuperAdmin avec permissions vides ne verrait pas le groupe, donc pas `/backoffice`. Voir section 4.3.

### E18 — Résolution du layout pour les routes racine

Voir section 2.2 — mécanisme `AppShell` documenté et vérifié dans `src/components/layout/app-shell.tsx`.

### E19 — Items offline inaccessibles

Items pointant vers routes non-cachées en mode offline : `aria-disabled="true"` + `pointer-events-none` + `opacity-50`. Voir section 15.

---

## 12. Icônes Lucide — Assignations canoniques (A10)

Les wireframes ASCII dans ce document sont **illustratifs**. La spécification canonique utilise les noms de composants Lucide React.

| Route / Concept | Icône Lucide |
|----------------|--------------|
| Accueil / Dashboard | `Home` |
| Vagues | `Waves` |
| Bacs | `Container` |
| Relevés | `NotebookPen` |
| Observations | `Eye` |
| Notifications | `Bell` |
| Config alertes (/settings/alertes) | `BellRing` (E15) |
| Stock / Produits | `Package` |
| Fournisseurs | `Truck` |
| Commandes | `ShoppingCart` |
| Besoins | `ClipboardList` |
| Finances | `Wallet` |
| Ventes | `Banknote` |
| Factures | `FileText` |
| Clients | `UserRound` |
| Dépenses | `Receipt` |
| Analytics | `BarChart3` |
| Planning | `Calendar` |
| Mes tâches | `ClipboardCheck` |
| Activations | `PackageCheck` |
| Alevins | `Egg` |
| Paramètres / Config élevage | `Settings` |
| Utilisateurs | `Users` |
| Abonnement | `CreditCard` |
| Packs | `Boxes` |
| Backoffice / Admin | `Shield` |
| Notes ingénieur | `NotebookPen` |
| Monitoring clients | `Eye` |
| Portefeuille ingénieur | `Wallet` |
| Règles activités | `Zap` |
| Menu (sheet trigger) | `Menu` |
| FAB nouveau relevé | `Plus` |

---

## 13. Plan de migration

### Phase 1 — Corrections bloquantes (sprint courant)

**Durée estimée : 2-3 jours**

Ces corrections sont des ajouts/suppressions dans les fichiers de navigation existants. Aucune refonte.

1. **Fix dead link /calibrages** (A11, E10) — Supprimer item de `FarmSidebar` (30min)
2. **Fix routes partagées** (A3, E4) — Déplacer `/packs`, `/activations`, `/mes-taches` à `src/app/` racine (2h + tests)
3. **FarmBottomNav sheet** — Ajouter 10 items manquants avec clés i18n (3h)
4. **IngenieurBottomNav sheet** — Ajouter `/planning`, `/analytics`, `/activations`, `/stock/fournisseurs`, `/stock/commandes`, `/settings/config-elevage`, `/settings/regles-activites` (1h)
5. **IngenieurSidebar** — Ajouter `/stock/fournisseurs`, `/stock/commandes`. Créer groupe "Configuration" avec `/settings/alertes`, `/settings/config-elevage`, `/settings/regles-activites` (1h)
6. **navigation.json** — Ajouter 5 clés i18n manquantes (30min) (A13)
7. **Middleware null-role** (E11) et guards INGENIEUR (E16) (1h)

### Phase 2 — Restructuration des composants (Sprint 12, quinzaine 1)

**Durée estimée : 3-4 jours**

1. Créer `FarmHeader` — topbar mobile avec `NotificationBell` + `SiteSelector` conditionnel (E6)
2. Créer `IngenieurHeader` — topbar mobile avec `NotificationBell`
3. Modifier `AppShell` — injecter les headers mobiles au-dessus du `<main>`
4. Réorganiser groupes `FarmSidebar` (spec §4.4)
5. Réorganiser groupes `IngenieurSidebar` (spec §5.4)
6. Implémenter badge "99+" (E14)
7. Implémenter `BellRing` vs `Bell` (E15)
8. Implémenter comportement offline pour bottom nav (§7)
9. Implémenter algorithme gating complet (§3)
10. Implémenter comportement groupes vides (E1, E5, E8)

### Phase 3 — Nettoyage legacy (Sprint 12, quinzaine 2)

**Durée estimée : 1-2 jours**

Analyser les call sites avant suppression (A9) :
```bash
grep -r "from.*layout/sidebar" src/
grep -r "from.*layout/bottom-nav" src/
grep -r "from.*layout/hamburger-menu" src/
```

Si aucun import actif → supprimer. Si imports → migrer.

Actions :
1. `sidebar.tsx` — Supprimer entrées `/admin/*` inexistantes (I5)
2. `bottom-nav.tsx` — Nettoyer ou supprimer si plus utilisé (I6)
3. `hamburger-menu.tsx` — Nettoyer ou supprimer
4. `module-nav-items.ts` — Supprimer entrées `Admin Abonnements`, `Admin Commissions`, `Admin Remises` qui pointent vers `/admin/*` inexistants

---

## 14. Composants à créer ou modifier

### 14.1 Nouveaux composants

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `FarmHeader` | `src/components/layout/farm-header.tsx` | Topbar mobile farm — logo + NotificationBell + SiteSelector conditionnel. `md:hidden`. |
| `IngenieurHeader` | `src/components/layout/ingenieur-header.tsx` | Topbar mobile ingénieur — logo + NotificationBell. `md:hidden`. |

### 14.2 Composants à modifier

| Composant | Fichier | Modifications |
|-----------|---------|--------------|
| `FarmBottomNav` | `src/components/layout/farm-bottom-nav.tsx` | Ajouter dans SHEET_ITEMS : `/bacs`, `/releves`, `/observations`, `/clients`, `/depenses`, `/stock/fournisseurs`, `/besoins`, `/settings/alertes`, `/activations`. Retirer `/notifications` (vers topbar). Organiser par groupes avec gating. |
| `FarmSidebar` | `src/components/layout/farm-sidebar.tsx` | Réorganiser groupes §4.4. Supprimer item `/calibrages`. Retirer `/settings/config-elevage` et `/settings/regles-activites`. |
| `IngenieurBottomNav` | `src/components/layout/ingenieur-bottom-nav.tsx` | Ajouter dans SHEET_ITEMS : `/planning`, `/analytics`, `/activations`, `/stock/fournisseurs`, `/stock/commandes`, `/settings/config-elevage`, `/settings/regles-activites`. |
| `IngenieurSidebar` | `src/components/layout/ingenieur-sidebar.tsx` | Ajouter `/stock/fournisseurs` et `/stock/commandes` dans groupe Stock. Créer groupe "Configuration" avec `/settings/alertes`, `/settings/config-elevage`, `/settings/regles-activites`. |
| `AppShell` | `src/components/layout/app-shell.tsx` | Injecter FarmHeader / IngenieurHeader en haut du `<main>`. |
| `module-nav-items.ts` | `src/lib/module-nav-items.ts` | Supprimer entrées `/admin/*`. Ajouter `/analytics/aliments` uniquement dans le groupe Analytics (pas dans Intrants). |

### 14.3 Composants legacy à nettoyer (Phase 3)

| Composant | Action |
|-----------|--------|
| `sidebar.tsx` | Supprimer entrées Admin Abonnements / Admin Commissions / Admin Remises |
| `bottom-nav.tsx` | Audit call sites — nettoyer ou supprimer |
| `hamburger-menu.tsx` | Audit call sites — nettoyer ou supprimer |

---

## 15. Règles d'accessibilité ARIA

Pour tous les composants de navigation mobile :

- `aria-label` obligatoire sur boutons sans texte visible
- `aria-current="page"` sur l'item actif de la bottom nav
- FAB : `aria-label="Nouveau relevé"` (hardcodé pour accessibilité)
- Sheets (Radix UI `SheetContent`) : `aria-label` ou `aria-labelledby` pointant vers le titre
- Focus trap dans le sheet : géré par Radix UI
- Touch targets minimum 44×44px
- Hauteur bottom nav minimum 56px (objectif WCAG 2.5.5)
- Items hors ligne (offline) : `aria-disabled="true"` + `pointer-events-none` + `opacity-50`. Ne pas utiliser `disabled` sur les `<a>` — utiliser les attributs ARIA et CSS pour rester dans le DOM accessible (E19).

---

## 16. Décision

Ce document constitue la spécification de référence complète et autonome pour l'implémentation de la navigation FarmFlow. Un développeur peut implémenter entièrement la navigation sans référencer d'autre document.

**Priorité d'implémentation :**
1. Phase 1 — Corrections bloquantes (sprint courant)
2. Phase 2 — Restructuration (Sprint 12, quinzaine 1)
3. Phase 3 — Nettoyage legacy (Sprint 12, quinzaine 2)

**Statut : APPROUVÉ v2 — Remplace la version RÉVISÉ v1 du 2026-03-28**

**Corrections v2 (2026-03-29) :**
- SuperAdmin bypass universel (A5, E1, E17) — step 1 remplace les deux anciens steps disjoints
- Section 3bis Route-level Authorization ajoutée (A6, E10, E11) — INGENIEUR_ONLY + FARM_ONLY
- Section 2.2 Mécanisme AppShell documenté et vérifié (A7, E18)
- BottomNavSkeleton spécifié pour l'état loading permissions (A15, E6)
- Icônes déduites : `/clients` → UserRound, `/monitoring` → Eye, `/activations` → PackageCheck
- Sections 5.3/5.4 alignées — mêmes groupes, mêmes items, même ordre (A4)
- SiteModule cross-référence ajoutée (A11)
- formatBadgeCount : guard NaN/Infinity (E7)
- isActive `/vagues` : startsWith au lieu de === (E12)
- bottom nav 4 items : justify-evenly quand FAB absent (E15)
- aria-disabled + pointer-events-none pour items offline (E19)
- isGroupVisible signature explicite, null guards perms/mods (E2-E5)
