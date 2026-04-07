# Pré-analyse R1-S8 — Mise à jour module-nav-items.ts — 2026-04-07

## Statut : GO AVEC RÉSERVES

## Résumé
Le fichier `src/lib/module-nav-items.ts` est le seul fichier à modifier pour cette story. Les icons Lucide requises sont déjà importées. Deux réserves : (1) le `itemKey: "geniteurs"` n'a pas de traduction dans les fichiers i18n (clé manquante), et (2) le bloc Reproduction dans `module-nav-items.ts` utilise actuellement `/alevins` comme seule `matchPath`, il faut ajouter `/reproduction`. Les composants de navigation (`farm-sidebar.tsx`, `farm-bottom-nav.tsx`) n'utilisent PAS `MODULE_NAV` — ils ont leur propre structure interne — donc la modification de `module-nav-items.ts` ne cassera pas ces composants.

---

## Vérifications effectuées

### 1. État actuel du bloc Reproduction dans module-nav-items.ts

Fichier : `/Users/ronald/project/dkfarm/farm-flow/src/lib/module-nav-items.ts` lignes 56-65.

**Actuel :**
```typescript
{
  label: "Reproduction",
  matchPaths: ["/alevins"],
  items: [
    { href: "/alevins", label: "Dashboard", itemKey: "dashboard", icon: LayoutDashboard },
    { href: "/alevins/reproducteurs", label: "Reproducteurs", itemKey: "reproducteurs", icon: Fish },
    { href: "/alevins/pontes", label: "Pontes", itemKey: "pontes", icon: Egg },
    { href: "/alevins/lots", label: "Lots", itemKey: "lots", icon: Layers },
  ],
}
```

**Cible selon ADR-044 §2.4 :**
```typescript
{
  label: "Reproduction",
  matchPaths: ["/reproduction", "/alevins"],
  items: [
    { href: "/reproduction", label: "Dashboard", itemKey: "dashboard", icon: LayoutDashboard },
    { href: "/reproduction/geniteurs", label: "Géniteurs", itemKey: "geniteurs", icon: Fish },
    { href: "/reproduction/pontes", label: "Pontes", itemKey: "pontes", icon: Egg },
    { href: "/reproduction/lots", label: "Lots", itemKey: "lots", icon: Layers },
    { href: "/reproduction/planning", label: "Planning", itemKey: "planning", icon: Calendar },
  ],
}
```

**Delta :**
- `matchPaths` : ajouter `"/reproduction"` (conserver `"/alevins"` en alias)
- `items[0].href` : `"/alevins"` → `"/reproduction"`
- `items[1].href` : `"/alevins/reproducteurs"` → `"/reproduction/geniteurs"` + `itemKey` : `"reproducteurs"` → `"geniteurs"`
- `items[2].href` : `"/alevins/pontes"` → `"/reproduction/pontes"` (label/itemKey OK)
- `items[3].href` : `"/alevins/lots"` → `"/reproduction/lots"` (label/itemKey OK)
- `items[4]` : NOUVEAU — `{ href: "/reproduction/planning", label: "Planning", itemKey: "planning", icon: Calendar }`

### 2. Icons Lucide : OK — aucune import à ajouter

Toutes les icônes requises par la cible ADR-044 §2.4 sont déjà importées en ligne 1-32 :
- `LayoutDashboard` : ligne 2 — present
- `Fish` : ligne 17 — present
- `Egg` : ligne 16 — present
- `Layers` : ligne 18 — present
- `Calendar` : ligne 21 — present

### 3. Consommateurs de MODULE_NAV : OK — impact limité

`MODULE_NAV` et `getModuleNavForPath` ne sont importés que dans un seul fichier de production :
`src/components/abonnements/plan-form-dialog.tsx`. Inspection : ce fichier ne lit pas les `items` du module Reproduction, il utilise `MODULE_NAV` pour une logique non liée aux hrefs Alevins/Reproduction. Aucun risque de régression sur ce consommateur.

`farm-sidebar.tsx` et `farm-bottom-nav.tsx` ont leur propre structure statique interne — ils n'importent pas `module-nav-items.ts`. La modification du fichier `module-nav-items.ts` n'affecte donc pas ces deux composants.

### 4. Test unitaire sprint-nc-nav-cleanup.test.ts : RÉSERVE IMPORTANTE

Le fichier `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/ui/sprint-nc-nav-cleanup.test.ts` hardcode les routes `/alevins` dans ses données de référence :
- `FARM_SHEET_GROUPS.reproduction.items[0].href = "/alevins"` (ligne 63)
- `FARM_SIDEBAR_ITEMS_ALL` contient `"/alevins"`, `"/alevins/reproducteurs"`, `"/alevins/pontes"`, `"/alevins/lots"` (lignes 103-105)

Ces données décrivent `farm-bottom-nav.tsx` et `farm-sidebar.tsx`, PAS `module-nav-items.ts`. Ces tests ne testent pas `module-nav-items.ts` directement. Aucune modification du test n'est requise pour cette story, car les composants farm-sidebar/farm-bottom-nav restent inchangés.

### 5. I18n — RÉSERVE : clé "geniteurs" manquante

Le champ `itemKey: "geniteurs"` sera introduit par cette story. La navigation BottomNav (si elle consomme `module-nav-items.ts` via `itemKey`) nécessiterait la clé `navigation.items.geniteurs`.

Vérification dans `src/messages/fr/navigation.json` : la clé `items.geniteurs` est ABSENTE. Seule `items.reproducteurs` existe (ligne 19 : `"reproducteurs": "Reproducteurs"`).

Vérification dans `src/messages/en/navigation.json` : `items.reproducteurs` présent, `items.geniteurs` absent.

**Impact :** `module-nav-items.ts` est un fichier de données statiques (type `SubNavItem`). Le champ `itemKey` est documenté comme "used by BottomNav" (commentaire ligne 38). Cependant, `farm-bottom-nav.tsx` n'importe pas `module-nav-items.ts`. Il n'y a pas d'erreur de build pour une clé i18n manquante dans un objet de données statiques — sauf si un composant futur consomme ce fichier avec `useTranslations`. Le risque immédiat est faible, mais la clé doit être ajoutée pour cohérence et pour éviter des bugs lors de l'intégration future.

**Clés à ajouter dans `fr/navigation.json` et `en/navigation.json` :**
- `items.geniteurs` : `"Géniteurs"` / `"Breeders"`

Les clés `items.planning`, `items.pontes`, `items.lots`, `items.dashboard` sont déjà présentes.

### 6. Pages /reproduction/* : statut des routes cibles

Les routes `/reproduction`, `/reproduction/geniteurs`, `/reproduction/pontes`, `/reproduction/lots`, `/reproduction/planning` n'existent pas encore (ADR-044 est en statut PROPOSÉ). Les hrefs dans `module-nav-items.ts` pointeront vers des pages 404 jusqu'à la création des pages. Ce comportement est attendu à ce stade du développement incrémental.

---

## Incohérences trouvées

1. **itemKey "reproducteurs" → "geniteurs" sans clé i18n correspondante.**
   - Fichiers concernés : `src/lib/module-nav-items.ts` + `src/messages/fr/navigation.json` + `src/messages/en/navigation.json`
   - Suggestion : ajouter `"geniteurs": "Géniteurs"` (fr) et `"geniteurs": "Breeders"` (en) dans la section `items` des deux fichiers, en même temps que la modification de `module-nav-items.ts`.

2. **matchPaths ne contient que "/alevins" alors que D6 de l'ADR-044 spécifie que "/reproduction" est la route principale.**
   - Fichier concerné : `src/lib/module-nav-items.ts` ligne 58
   - Suggestion : remplacer `matchPaths: ["/alevins"]` par `matchPaths: ["/reproduction", "/alevins"]`.

---

## Risques identifiés

1. **Test sprint-nc-nav-cleanup.test.ts — false negative risk.**
   Les données de test hardcodées reflètent `farm-sidebar.tsx` et `farm-bottom-nav.tsx`, qui ne seront PAS modifiés par cette story. Ces tests continueront de passer sans modification. Risque : ils ne couvrent pas `module-nav-items.ts` donc la correction de `module-nav-items.ts` ne sera pas validée par ces tests. Un test unitaire spécifique à `module-nav-items.ts` serait souhaitable mais n'est pas un bloquant pour cette story.

2. **Pages /reproduction/* inexistantes.**
   Les nouveaux hrefs mèneront à des 404. Risque bas : comportement attendu à ce stade du plan ADR-044 (story R1-S8 est une story de navigation, les pages sont créées dans d'autres stories du même plan).

---

## Prérequis manquants

Aucun bloquant technique. La story peut être exécutée en autonomie.

Recommandation de scope étendu (non bloquant) : inclure l'ajout de `items.geniteurs` dans les deux fichiers i18n dans le même commit pour maintenir la cohérence.

---

## Recommandation

GO. La modification est localisée à un seul fichier de données statiques (`src/lib/module-nav-items.ts`). Toutes les icônes Lucide requises sont déjà importées. Aucun impact sur les composants de navigation existants (`farm-sidebar.tsx`, `farm-bottom-nav.tsx`).

Actions requises dans le même commit :
1. Modifier le bloc Reproduction dans `src/lib/module-nav-items.ts` selon la spec ADR-044 §2.4.
2. Ajouter `"geniteurs"` dans `src/messages/fr/navigation.json` et `src/messages/en/navigation.json` (section `items`).
