# Pré-analyse R1-S7 — Redirects /alevins → /reproduction

**Date :** 2026-04-07
**Story :** R1-S7 — Redirects /alevins → /reproduction (301)
**Agent cible :** @developer
**Référence :** ADR-044 §2.4 et §D6

---

## Statut : GO AVEC RÉSERVES

## Résumé

La story est techniquement simple : aucun middleware.ts n'existe, next.config.ts n'a pas de section redirects, et /reproduction n'existe pas encore comme route. L'implémentation recommandée est d'ajouter les redirects dans next.config.ts. Les réserves portent sur deux points : (1) deux arborescences /alevins coexistent dans le file system (src/app/alevins/ et src/app/(farm)/alevins/), (2) plusieurs tests hardcodent /alevins comme href attendu et échoueront après la migration de la navigation.

---

## Vérifications effectuées

### Routes /alevins existantes : INVENTAIRE COMPLET

Deux arborescences distinctes coexistent :

**Arborescence A — src/app/alevins/ (sans route group)**
| Page | Route URL |
|------|-----------|
| `src/app/alevins/loading.tsx` | skeleton (pas une page) |
| `src/app/alevins/reproducteurs/page.tsx` | /alevins/reproducteurs |
| `src/app/alevins/reproducteurs/[id]/page.tsx` | /alevins/reproducteurs/[id] |
| `src/app/alevins/pontes/page.tsx` | /alevins/pontes |
| `src/app/alevins/pontes/[id]/page.tsx` | /alevins/pontes/[id] |
| `src/app/alevins/lots/[id]/page.tsx` | /alevins/lots/[id] |

Note : pas de `src/app/alevins/page.tsx` (dashboard index manquant, confirmé par ADR-044 §1).

**Arborescence B — src/app/(farm)/alevins/ (avec route group farm)**
| Page | Route URL |
|------|-----------|
| `src/app/(farm)/alevins/page.tsx` | /alevins (dashboard) |
| `src/app/(farm)/alevins/lots/page.tsx` | /alevins/lots |

Mapping complet des redirects requis selon ADR-044 §7 :

| Source (301) | Destination |
|---|---|
| /alevins | /reproduction |
| /alevins/reproducteurs | /reproduction/geniteurs |
| /alevins/reproducteurs/:id | /reproduction/geniteurs/:id |
| /alevins/pontes | /reproduction/pontes |
| /alevins/pontes/:id | /reproduction/pontes/:id |
| /alevins/lots | /reproduction/lots |
| /alevins/lots/:id | /reproduction/lots/:id |

### /reproduction existe-t-il déjà : NON

Aucun fichier dans `src/app/reproduction/` ni `src/app/(farm)/reproduction/`. La route de destination n'existe pas encore au moment de cette story. Les redirects pointeront donc vers des pages 404 jusqu'à ce que les stories R2+ créent les routes /reproduction.

### Middleware existant : AUCUN middleware.ts à la racine

`src/middleware.ts` n'existe pas. Le fichier `src/proxy.ts` est utilisé à la place (commentaire interne : "Middleware Next.js — proxy.ts utilisé par Next.js 16+ / Turbopack"). Ce fichier contient `FARM_ONLY_PREFIXES` qui liste `/alevins`. Ce tableau devra être mis à jour pour inclure `/reproduction`.

### next.config.ts — Section redirects : ABSENTE

Le fichier `next.config.ts` ne contient aucune section `redirects`. La configuration actuelle : output standalone, reactCompiler, next-intl plugin, serwist PWA. Une fonction `redirects()` async peut être ajoutée directement dans `nextConfig`.

### Navigation référençant /alevins

**src/lib/module-nav-items.ts** — 4 hrefs hardcodés :
- `matchPaths: ["/alevins"]`
- `{ href: "/alevins", ... }`
- `{ href: "/alevins/reproducteurs", ... }`
- `{ href: "/alevins/pontes", ... }`
- `{ href: "/alevins/lots", ... }`

**src/components/layout/farm-sidebar.tsx** — 5 occurrences :
- `labelKey: "items.alevins"`
- `{ href: "/alevins", ... }`
- `{ href: "/alevins/reproducteurs", ... }`
- `{ href: "/alevins/pontes", ... }`
- `{ href: "/alevins/lots", ... }`
- Logique active-path teste `href === "/alevins"` (ligne 192)

**src/components/layout/farm-bottom-nav.tsx** — 2 occurrences :
- `href: "/alevins"` (item principal)
- `labelKey: "items.alevins"`

**src/proxy.ts** — FARM_ONLY_PREFIXES contient `"/alevins"` (ligne 52). Si /reproduction n'est pas ajouté ici, les ingénieurs pourront accéder à /reproduction sans être redirigés.

### Tests impactés

Les tests suivants hardcodent `/alevins` et échoueront si la navigation est mise à jour vers `/reproduction` :

| Fichier | Ligne | Assertion |
|---------|-------|-----------|
| `src/__tests__/ui/farm-nav.test.ts` | 43, 246, 254 | `href: "/alevins"`, `ALEVINS_VOIR`, test masquage module |
| `src/__tests__/ui/sprint-nc-nav-cleanup.test.ts` | 63, 105, 277, 280 | `href: "/alevins"`, liste hrefs attendus |
| `src/__tests__/navigation-sprint23.test.ts` | 247, 291, 292 | `startsWith("/alevins")` → "Reproduction" |

---

## Incohérences trouvées

1. **Double arborescence /alevins** — `src/app/alevins/` et `src/app/(farm)/alevins/` coexistent. La première héberge les pages detail (reproducteurs, pontes, lots/[id]), la seconde le dashboard et la liste lots. C'est inhabituel : le découpage entre route groups semble être un résidu du développement. Les redirects next.config.ts doivent couvrir les deux chemins (ils résolvent vers la même URL, donc pas de conflit côté Next.js).

2. **src/proxy.ts liste /alevins dans FARM_ONLY_PREFIXES mais pas /reproduction** — Quand /reproduction sera créé, les ingénieurs pourront y accéder sans contrôle de rôle. Cette mise à jour est hors-scope R1-S7 mais doit être signalée.

3. **Pas de page /alevins dans src/app/alevins/** — Le dashboard est dans `src/app/(farm)/alevins/page.tsx`. Le loading skeleton dans `src/app/alevins/loading.tsx` est orphelin (aucune page dans ce segment).

---

## Risques identifiés

1. **Redirects vers 404 pendant les sprints R2, R3, R4** — /reproduction n'existe pas encore. Les redirects 301 seront actifs mais la destination est vide jusqu'à la création des routes /reproduction. Impact : les utilisateurs bookmarkant /alevins seront redirigés vers 404. Mitigation : documenter que R1-S7 est un pré-requis de la navigation, mais les redirects sont inopérants en pratique tant que R2-S3 (pages /reproduction) n'est pas livré.

2. **Tests de navigation casseront si la navigation est mise à jour dans cette story** — ADR-044 §2.4 spécifie que la navigation doit être mise à jour (matchPaths: ["/reproduction", "/alevins"]). Si le développeur met à jour farm-sidebar.tsx et module-nav-items.ts en même temps que les redirects, 3 fichiers de test échoueront. Ces tests devront être mis à jour dans la même PR. Si les redirects sont faits sans toucher la navigation, les tests passent mais la navigation reste incohérente.

3. **permanent: true vs permanent: false** — ADR-044 spécifie des redirects 301 (permanents). En développement, les redirects 301 sont mis en cache par les navigateurs. Si une destination change entre sprints, les développeurs devront vider le cache manuellement. Considérer `permanent: false` (302) pendant la phase de développement.

---

## Prérequis manquants

1. Aucun — cette story n'a pas de dépendances déclarées dans ADR-044 §8 et c'est confirmé dans la story (No dependencies).

---

## Approche d'implémentation recommandée

### Option A — next.config.ts redirects (RECOMMANDÉE)

Ajouter une fonction `redirects` dans `nextConfig` dans `/Users/ronald/project/dkfarm/farm-flow/next.config.ts` :

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    serverSourceMaps: true,
  },
  async redirects() {
    return [
      { source: "/alevins", destination: "/reproduction", permanent: true },
      { source: "/alevins/reproducteurs", destination: "/reproduction/geniteurs", permanent: true },
      { source: "/alevins/reproducteurs/:id", destination: "/reproduction/geniteurs/:id", permanent: true },
      { source: "/alevins/pontes", destination: "/reproduction/pontes", permanent: true },
      { source: "/alevins/pontes/:id", destination: "/reproduction/pontes/:id", permanent: true },
      { source: "/alevins/lots", destination: "/reproduction/lots", permanent: true },
      { source: "/alevins/lots/:id", destination: "/reproduction/lots/:id", permanent: true },
    ];
  },
};
```

Avantages : géré par Next.js avant tout middleware, fonctionne sur Edge et Node, aucun nouveau fichier. Compatible avec la stack existante (next-intl + serwist wrappent nextConfig mais préservent les redirects).

### Option B — Route files avec redirect() (NON recommandée pour ce cas)

Transformer chaque page /alevins/* en un Server Component appelant `redirect("/reproduction/...")`. Inconvénient : les pages alevins resteraient dans le file system, créant de la confusion avec les futures pages /reproduction. Non approprié pour une migration d'URL à grande échelle.

### Option C — src/proxy.ts (NON recommandée)

Ajouter la logique de redirect dans proxy.ts côté Edge. Inconvénient : proxy.ts est déjà complexe (auth + rôles + abonnements), y ajouter des redirects d'URL structure est un mélange de responsabilités.

---

## Périmètre exact de la story R1-S7

D'après ADR-044 §2.4 et le titre de la story, le scope est :
1. Redirects 301 /alevins → /reproduction dans next.config.ts
2. Mise à jour de `matchPaths` dans module-nav-items.ts pour inclure "/alevins" comme alias
3. Mise à jour des hrefs dans farm-sidebar.tsx et farm-bottom-nav.tsx vers /reproduction

Hors-scope R1-S7 (à faire dans R1-S8 ou stories navigation) :
- Mise à jour de src/proxy.ts FARM_ONLY_PREFIXES
- Mise à jour des tests farm-nav.test.ts, sprint-nc-nav-cleanup.test.ts, navigation-sprint23.test.ts
- Création des pages /reproduction/* (stories R2 et suivantes)

---

## Recommandation

GO — Implémenter les redirects via next.config.ts redirects(). Inclure dans la même PR la mise à jour de la navigation (farm-sidebar.tsx, farm-bottom-nav.tsx, module-nav-items.ts) et les tests correspondants. Documenter dans le PR que les redirects pointent vers des 404 temporaires jusqu'à la livraison des pages /reproduction (stories R2+).

Corriger dans la même PR : mise à jour FARM_ONLY_PREFIXES dans src/proxy.ts pour ajouter "/reproduction".
