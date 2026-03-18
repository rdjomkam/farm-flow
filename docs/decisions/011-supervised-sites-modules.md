# ADR-011 — Sites supervisés et contrôle d'accès par module

**Date :** 2026-03-17
**Statut :** Accepté
**Auteur :** @architect
**Sprint :** 23 (Monitoring Ingénieur / Phase 3)

---

## Contexte

L'application évolue vers un modèle à deux niveaux de sites :

1. **Sites DKFarm** ("full") — la ferme principale de l'entreprise DKFarm, avec accès complet à toutes les fonctionnalités.
2. **Sites clients supervisés** — créés automatiquement lors de l'activation d'un pack par un ingénieur DKFarm. Ces sites appartiennent à des clients pisciculteurs et ne doivent exposer que les modules pertinents pour leur niveau d'accompagnement.

Sans contrôle au niveau du site, un client parvenu via pack provisioning verrait toutes les fonctionnalités (stock avancé, finances, configuration ingénieur, etc.) — ce qui n'est pas souhaitable et crée de la confusion dans l'UX.

Il faut une solution :
- rétrocompatible (sites existants non impactés),
- pilotable depuis le pack (l'ingénieur décide des modules accessibles),
- cohérente avec le système de permissions existant (ADR-004),
- simple à maintenir (pas de configuration par page).

---

## Décisions

### 1. Enum SiteModule — 9 modules

Un enum `SiteModule` identifie les grandes fonctionnalités de l'application. Chaque valeur correspond à une section de navigation ou un domaine métier :

```prisma
enum SiteModule {
  REPRODUCTION          // Alevins & pontes
  GROSSISSEMENT         // Vagues, bacs, relevés
  INTRANTS              // Stock & approvisionnement
  VENTES                // Ventes & facturation
  ANALYSE_PILOTAGE      // Analytics & graphiques
  PACKS_PROVISIONING    // Packs & activation (ingénieur uniquement)
  CONFIGURATION         // Paramètres du site
  INGENIEUR             // Dashboard ingénieur multi-clients
  NOTES                 // Notes & observations
}
```

Le modèle `Site` est étendu :

```prisma
model Site {
  // ... champs existants ...
  supervised     Boolean      @default(false)
  enabledModules SiteModule[]
}
```

### 2. Sémantique de enabledModules — tableau vide = tout activer

**Règle :** si `enabledModules` est vide (`[]`), tous les modules sont considérés comme activés.

Cette règle garantit la **rétrocompatibilité** : les sites existants (DKFarm) ont `enabledModules = []` et continuent de voir toutes les fonctionnalités sans aucune migration de données.

Seuls les sites supervisés peuplent explicitement ce tableau avec les modules autorisés.

```typescript
// Utilitaire dans src/lib/modules.ts
export function isModuleEnabled(site: { enabledModules: SiteModule[] }, module: SiteModule): boolean {
  // Tableau vide = tout activé (sites full DKFarm)
  if (site.enabledModules.length === 0) return true;
  return site.enabledModules.includes(module);
}
```

### 3. Flag supervised — distinction full vs supervisé

Le champ `supervised: Boolean @default(false)` marque les sites créés via pack provisioning.

| supervised | enabledModules | Comportement |
|------------|----------------|--------------|
| `false` | `[]` | Site DKFarm full — tous modules visibles |
| `true` | `[GROSSISSEMENT, ANALYSE_PILOTAGE, NOTES]` | Site client — accès restreint |
| `true` | `[GROSSISSEMENT, INTRANTS, VENTES, ANALYSE_PILOTAGE, NOTES]` | Site client — accès étendu |

Ce flag sert également à différencier les sites dans le dashboard ingénieur (`/ingenieur`) et à filtrer les listes dans l'UX (un client ne voit pas les sites DKFarm).

### 4. Propagation Pack → Site lors du provisioning

Lors de l'activation d'un pack (`POST /api/packs/[id]/activer`), la transaction de provisioning :

1. Crée le site client avec `supervised: true`.
2. Copie `pack.enabledModules` dans `site.enabledModules`.
3. Si `pack.enabledModules` est vide, applique la valeur par défaut : `[GROSSISSEMENT, ANALYSE_PILOTAGE, NOTES]`.

```typescript
// Dans src/app/api/packs/[id]/activer/route.ts
const enabledModules = pack.enabledModules.length > 0
  ? pack.enabledModules
  : [SiteModule.GROSSISSEMENT, SiteModule.ANALYSE_PILOTAGE, SiteModule.NOTES];

await prisma.site.create({
  data: {
    supervised: true,
    enabledModules,
    // ...
  }
});
```

Le modèle `Pack` est également étendu avec ce champ :

```prisma
model Pack {
  // ... champs existants ...
  enabledModules SiteModule[]
}
```

### 5. Rôle du client — GERANT + périmètre contrôlé par les modules

**Option retenue :** le client créé lors du provisioning reçoit le rôle `GERANT` (et non `PISCICULTEUR`).

Justification :
- Le client est **propriétaire de son site** et doit pouvoir gérer ses propres membres, paramètres et données.
- Le rôle `PISCICULTEUR` est trop restrictif (6 permissions seulement — ADR-004 §7).
- Ce sont les **modules du site** (et non le rôle) qui limitent ce que le client voit, pas ses permissions individuelles.

Le `SiteRole` créé lors du provisioning est `ADMIN` sur le site client (le client est maître chez lui), avec les permissions par défaut du rôle `GERANT` (23 permissions).

```typescript
// Provisioning : création du SiteMember client
await prisma.siteMember.create({
  data: {
    userId: clientUser.id,
    siteId: newSite.id,
    role: Role.GERANT,
    permissions: DEFAULT_PERMISSIONS[Role.GERANT],
  }
});
```

### 6. Triple filtre de navigation

La navigation est filtrée par trois conditions successives, toutes devant être satisfaites pour afficher un item :

| Ordre | Filtre | Source | Responsable |
|-------|--------|--------|-------------|
| 1 | Permissions utilisateur | `SiteMember.permissions` | `requirePermission()` |
| 2 | Phase 3 permission gates | `PHASE3_PERMISSIONS` dans `permissions-constants.ts` | `hasPermission()` côté client |
| 3 | Module du site actif | `Site.enabledModules` | `isModuleEnabled()` + `MODULE_LABEL_TO_SITE_MODULE` |

**Implémentation dans la navigation (ex. sidebar, bottom-nav, hamburger-menu) :**

```typescript
const visibleItems = navItems.filter(item => {
  // Filtre 1 : permission utilisateur
  if (item.permission && !hasPermission(auth.permissions, item.permission)) return false;
  // Filtre 2 : gate Phase 3
  if (item.phase3Gate && !isPhase3Enabled(item.phase3Gate)) return false;
  // Filtre 3 : module du site
  const siteModule = MODULE_LABEL_TO_SITE_MODULE[item.label];
  if (siteModule && !isModuleEnabled(activeSite, siteModule)) return false;
  return true;
});
```

Ce filtre se fait **côté client** dans les composants de navigation (qui sont déjà `"use client"`). Il s'agit d'un filtre UX (masquage de liens), pas d'un contrôle de sécurité : les API routes restent protégées par `requirePermission()`.

### 7. MODULE_LABEL_TO_SITE_MODULE — mapping label → module

Un dictionnaire dans `src/lib/modules.ts` mappe les labels de navigation (tels qu'ils apparaissent dans `navItems`) vers les valeurs `SiteModule` :

```typescript
export const MODULE_LABEL_TO_SITE_MODULE: Record<string, SiteModule> = {
  // Navigation principale
  "Alevins":             SiteModule.REPRODUCTION,
  "Élevage":             SiteModule.GROSSISSEMENT,   // alias pisciculteur
  "Vagues":              SiteModule.GROSSISSEMENT,
  "Bacs":                SiteModule.GROSSISSEMENT,
  "Relevés":             SiteModule.GROSSISSEMENT,
  "Stock":               SiteModule.INTRANTS,
  "Approvisionnement":   SiteModule.INTRANTS,
  "Ventes":              SiteModule.VENTES,
  "Factures":            SiteModule.VENTES,
  "Clients":             SiteModule.VENTES,
  "Analytics":           SiteModule.ANALYSE_PILOTAGE,
  "Finances":            SiteModule.ANALYSE_PILOTAGE,
  "Packs":               SiteModule.PACKS_PROVISIONING,
  "Activations":         SiteModule.PACKS_PROVISIONING,
  "Paramètres":          SiteModule.CONFIGURATION,
  "Ingénieur":           SiteModule.INGENIEUR,
  "Notes":               SiteModule.NOTES,
  "Observations":        SiteModule.NOTES,
};
```

Les items sans entrée dans ce dictionnaire (ex. "Accueil", "Dashboard", "Mes tâches") sont toujours visibles — ils ne sont pas scopés par module.

---

## Alternatives considérées

### Alternative A — Vérification par page (middleware ou layout)

Ajouter un contrôle de module dans chaque `layout.tsx` ou `page.tsx` scopé à un module.

| Pour | Contre |
|------|--------|
| Contrôle de sécurité au niveau serveur | ~30 pages à modifier |
| Redirection possible (ex. 404 ou /dashboard) | Duplication du mapping partout |
| | Sur-ingénierie pour un MVP |

**Rejetée.** Le filtrage de navigation est suffisant pour le MVP. Les API routes restent protégées par permissions. Une vérification par page peut être ajoutée en Phase 4 si nécessaire.

### Alternative B — Nouveau rôle PISCICULTEUR_SUPERVISE

Créer un rôle spécifique pour les clients supervisés, avec des permissions restreintes.

| Pour | Contre |
|------|--------|
| Modèle de permission pur | Nouveau rôle à maintenir |
| | Permissions à calibrer finement |
| | Moins flexible que les modules (un module peut couvrir N pages) |
| | Incohérent : le client est admin de son site |

**Rejetée.** La combinaison GERANT + modules de site est plus claire, plus flexible, et évite de polluer l'enum `Role`.

### Alternative C — Modèle SiteConfig séparé

Stocker la configuration des modules dans une table `SiteConfig { siteId, enabledModules }` liée à `Site`.

| Pour | Contre |
|------|--------|
| Historisation possible | JOIN supplémentaire à chaque lecture de session |
| | Surcharge pour un tableau simple |
| | `enabledModules` sur `Site` est plus direct et chargé avec le site actif |

**Rejetée.** Le champ `enabledModules SiteModule[]` directement sur `Site` est plus simple et évite un JOIN.

---

## Conséquences

### Positives
- Les sites DKFarm existants ne sont pas affectés (`enabledModules = []` → tout activé).
- L'ingénieur contrôle finement ce que voit chaque client via les modules du pack.
- La navigation est cohérente avec le périmètre du site sans toucher aux permissions individuelles.
- Le client pisciculteur a un accès GERANT complet sur les modules activés de son site.

### Négatives
- Le mapping `MODULE_LABEL_TO_SITE_MODULE` doit être maintenu à jour quand de nouveaux items de navigation sont ajoutés.
- Les modules ne bloquent pas l'accès direct aux URLs (pas de redirection serveur) — acceptable pour le MVP.
- Le champ `supervised` doit être inclus dans le payload de la session (`AuthContext`) pour être disponible côté client sans requête supplémentaire.

### Impact sur les fichiers existants

| Fichier | Changement |
|---------|------------|
| `prisma/schema.prisma` | Ajout `SiteModule` enum, `supervised` + `enabledModules` sur `Site`, `enabledModules` sur `Pack` |
| `src/types/models.ts` | Interface `Site` étendue, nouveau type `SiteModule` |
| `src/lib/modules.ts` | Nouveau fichier — `isModuleEnabled()` + `MODULE_LABEL_TO_SITE_MODULE` |
| `src/lib/auth/session.ts` | `AuthContext` inclut `activeSite.supervised` et `activeSite.enabledModules` |
| `src/components/layout/sidebar.tsx` | Triple filtre appliqué |
| `src/components/layout/bottom-nav.tsx` | Triple filtre appliqué |
| `src/components/layout/hamburger-menu.tsx` | Triple filtre appliqué |
| `src/app/api/packs/[id]/activer/route.ts` | Propagation `enabledModules` lors du provisioning |
