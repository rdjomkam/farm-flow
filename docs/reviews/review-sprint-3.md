# Review Sprint 3 — UI Layout + Dashboard

**Date :** 2026-03-08
**Reviewer :** @code-reviewer
**Stories couvertes :** 3.1 (Composants UI), 3.2 (Layout + Navigation), 3.3 (Dashboard)

---

## Fichiers revus

### Story 3.1 — Composants UI (10 fichiers)
- `src/lib/utils.ts` — utilitaire cn() (clsx + twMerge)
- `src/app/globals.css` — design tokens CSS custom properties
- `src/components/ui/button.tsx` — 5 variantes, Radix Slot, tactile 44px
- `src/components/ui/card.tsx` — Card + 5 sous-composants
- `src/components/ui/input.tsx` — label/error intégres, tactile 44px
- `src/components/ui/badge.tsx` — variantes en_cours/terminee/annulee
- `src/components/ui/select.tsx` — wrapper Radix Select complet
- `src/components/ui/dialog.tsx` — plein ecran mobile, centre desktop
- `src/components/ui/tabs.tsx` — wrapper Radix Tabs
- `src/components/ui/toast.tsx` — ToastProvider/useToast (Radix Toast)

### Story 3.2 — Layout (4 fichiers)
- `src/components/layout/bottom-nav.tsx` — 4 onglets, md:hidden
- `src/components/layout/sidebar.tsx` — hidden md:flex, logo Fish
- `src/components/layout/header.tsx` — sticky, Server Component
- `src/app/layout.tsx` — lang="fr", ToastProvider, flex layout

### Story 3.3 — Dashboard (4 fichiers)
- `src/lib/queries/dashboard.ts` — query serveur avec calculs.ts
- `src/components/dashboard/stats-cards.tsx` — 4 KPI cards
- `src/components/dashboard/vague-summary-card.tsx` — carte cliquable par vague
- `src/app/page.tsx` — Server Component async

---

## Verdict : VALIDE

Le Sprint 3 est de tres bonne qualite. L'approche mobile-first est rigoureuse, les composants Radix UI sont correctement implementes avec une bonne accessibilite, et les Server Components sont utilises par defaut. Aucune issue critique ou bloquante.

---

## Checklist

### 1. Mobile First : OK

| Composant | Mobile (defaut) | Desktop (breakpoint) |
|-----------|-----------------|---------------------|
| dialog.tsx | `inset-0 rounded-none` (plein ecran) | `md:max-w-lg md:rounded-xl` (centre) |
| DialogFooter | `flex-col-reverse` (boutons empiles) | `sm:flex-row sm:justify-end` |
| bottom-nav.tsx | Visible (fixe en bas) | `md:hidden` |
| sidebar.tsx | `hidden` | `md:flex md:w-60` |
| layout.tsx main | `pb-16` (place pour nav) | `md:pb-0` |
| stats-cards.tsx | `grid-cols-2` | `md:grid-cols-4` |
| page.tsx vagues | Pile simple | `md:grid-cols-2 lg:grid-cols-3` |
| toast viewport | `w-full` | `sm:max-w-[420px]` |

Tous les styles commencent par mobile, puis ajoutent `sm:`, `md:`, `lg:`. Aucun style desktop-first detecte.

### 2. Radix UI / Accessibilite : OK (1 mineur)

| Composant | Primitif Radix | Accessibilite |
|-----------|----------------|---------------|
| Button | `Slot` (asChild) | `focus-visible:ring-2` |
| Select | Root, Trigger, Content, Portal, Viewport, Item, ItemIndicator, ItemText, Label, Group, Value, Icon | `focus:ring-2`, Portal pour z-index |
| Dialog | Root, Trigger, Close, Portal, Overlay, Content, Title, Description | `sr-only` sur close, Title/Description via primitives |
| Tabs | Root, List, Trigger, Content | `focus-visible:ring-2`, data-state styling |
| Toast | Provider, Root, Title, Description, Close, Viewport | Swipe support, auto-dismiss 4s |

### 3. "use client" : OK — Tous justifies

| Fichier | Raison |
|---------|--------|
| button.tsx | forwardRef + event handlers (onClick) |
| input.tsx | forwardRef + event handlers (onChange) |
| select.tsx | Radix Select (etat interne) |
| dialog.tsx | Radix Dialog (etat interne) |
| tabs.tsx | Radix Tabs (etat interne) |
| toast.tsx | useState, useCallback, useContext, createContext |
| bottom-nav.tsx | usePathname() |
| sidebar.tsx | usePathname() |

**Server Components (pas de "use client") :**
- card.tsx, badge.tsx — presentationnel pur
- header.tsx — Server Component
- stats-cards.tsx, vague-summary-card.tsx — presentationnel, props only
- page.tsx — async Server Component (fetch serveur)
- layout.tsx — Server Component composant des Client Components

### 4. Taille tactile 44px : OK

| Element | Classe | Taille effective |
|---------|--------|-----------------|
| Button (toutes tailles) | `min-h-[44px] min-w-[44px]` | >= 44px |
| Input | `h-11 min-h-[44px]` | 44px |
| SelectTrigger | `h-11 min-h-[44px]` | 44px |
| SelectItem | `min-h-[44px]` | >= 44px |
| TabsTrigger | `min-h-[44px]` | >= 44px |
| Dialog Close | `min-h-[44px] min-w-[44px]` | 44px |
| Toast Close | `min-h-[44px] min-w-[44px]` | 44px |
| BottomNav links | `min-h-[56px]` | 56px |

### 5. Dashboard utilise calculs.ts : OK

`src/lib/queries/dashboard.ts:4` importe `calculerTauxSurvie` et `calculerBiomasse` depuis `@/lib/calculs`. Lignes 49-50 les utilisent. Enums `StatutVague` et `TypeReleve` importes. `Promise.all` pour les requetes paralleles.

---

## Issues mineures

### M1 — Toast close button : aria-label en anglais
**Severite : mineur**
**Fichier :** `src/components/ui/toast.tsx:75-77`
**Probleme :** Le bouton close du Dialog a `<span className="sr-only">Fermer</span>` (dialog.tsx:56) mais le Toast close button n'a pas d'equivalent. Radix fournit `aria-label="Close"` par defaut mais c'est en anglais. Pour une UI francaise, ajouter `aria-label="Fermer"`.
**Suggestion :**
```tsx
<ToastPrimitive.Close aria-label="Fermer" className="...">
```

### M2 — Input label non associe sans id
**Severite : mineur**
**Fichier :** `src/components/ui/input.tsx:12-16`
**Probleme :** `<label htmlFor={id}>` et `<input id={id}>` utilisent le prop `id`. Si le caller ne passe pas `id`, le label n'est pas associe a l'input (htmlFor=undefined). La click-to-focus ne marchera pas.
**Suggestion :** Generer un id automatique avec `useId()` comme fallback :
```tsx
import { useId } from "react";
const autoId = useId();
const inputId = id ?? autoId;
```

### M3 — VagueSummaryCard badge hardcode
**Severite : mineur**
**Fichier :** `src/components/dashboard/vague-summary-card.tsx:17`
**Probleme :** `<Badge variant="en_cours">En cours</Badge>` est hardcode. Le composant recoit `vague.statut` mais ne l'utilise pas pour le badge. Actuellement le composant n'est utilise que pour des vagues actives, mais si reutilise ailleurs, le badge sera faux.
**Suggestion :** Mapper le statut dynamiquement :
```tsx
const statutConfig = {
  EN_COURS: { variant: "en_cours", label: "En cours" },
  TERMINEE: { variant: "terminee", label: "Terminée" },
  ANNULEE: { variant: "annulee", label: "Annulée" },
} as const;
// ...
<Badge variant={statutConfig[vague.statut].variant}>
  {statutConfig[vague.statut].label}
</Badge>
```

### M4 — Select label utilise span au lieu de label
**Severite : mineur**
**Fichier :** `src/components/ui/select.tsx:18-19`
**Probleme :** Le label du SelectTrigger utilise `<span>` alors que Input utilise `<label htmlFor>`. Inconsistance et semantique HTML reduite. Radix Select Trigger a un `id` interne, mais le `<span>` n'est pas relie.
**Suggestion :** Utiliser `aria-label` sur le Trigger ou `aria-labelledby` pointant vers un `<label>` avec un id.

---

## Suggestions

### S1 — navItems dupliques entre sidebar et bottom-nav
**Fichiers :** `sidebar.tsx:8-13` et `bottom-nav.tsx:8-13`
Les deux fichiers definissent `navItems` separement avec des labels differents ("Nouveau releve" vs "Releve"). Extraire dans un fichier partage `src/lib/navigation.ts` avec un `shortLabel` pour le bottom-nav.

### S2 — Button size "sm" identique a "md" en hauteur
**Fichier :** `src/components/ui/button.tsx:21`
`h-9` (36px) est ecrase par `min-h-[44px]` (44px). En pratique, les boutons sm et md ont la meme hauteur. C'est correct pour le tactile mais le nommage "sm" est trompeur. Pas un probleme fonctionnel.

---

## Points positifs

1. **Mobile first rigoureux** : Tous les composants partent du mobile (360px) et ajoutent les breakpoints responsifs. Le Dialog plein ecran mobile / centre desktop est exemplaire.
2. **Radix UI complet** : Select, Dialog, Tabs, Toast — tous implementes avec les primitives Radix completes (Portal, animations, focus management).
3. **Accessibilite** : `focus-visible:ring-2` partout, `sr-only` sur le close Dialog, swipe support Toast, aria-labels.
4. **Taille tactile 44px** : `min-h-[44px]` systematique sur tous les elements interactifs (Button, Input, Select, Tabs, Dialog close, Toast close, BottomNav).
5. **Server Components** : `page.tsx` est un async Server Component. `header.tsx`, `card.tsx`, `badge.tsx`, `stats-cards.tsx` sont des Server Components. Seuls les composants avec hooks/interactivite sont "use client".
6. **Dashboard** : Utilise `calculerTauxSurvie` et `calculerBiomasse` de `calculs.ts` (pas de duplication). Enums importes. `Promise.all` pour les requetes paralleles.
7. **Design tokens** : Variables CSS dans globals.css (primary teal, danger, success, etc.) + `@theme inline` pour Tailwind v4. Coherent et maintenable.
8. **Layout adaptatif** : BottomNav mobile + Sidebar desktop, `pb-16 md:pb-0` sur main — transition fluide.
9. **TypeScript strict** : Interfaces typees pour tous les props, pas de `any`.
10. **Textes en francais** : "Suivi Silures", "Vagues actives", "Biomasse totale", "Aucune vague en cours", "Fermer" (sr-only), `lang="fr"`.

---

## Resume

| ID | Severite | Fichier | Resume | Statut |
|----|----------|---------|--------|--------|
| M1 | mineur | toast.tsx | aria-label en anglais sur close | Sprint 5 |
| M2 | mineur | input.tsx | label non associe sans id | Sprint 5 |
| M3 | mineur | vague-summary-card.tsx | badge statut hardcode | Sprint 5 |
| M4 | mineur | select.tsx | span au lieu de label | Sprint 5 |
| S1 | suggestion | sidebar/bottom-nav | navItems dupliques | Sprint 5 |
| S2 | suggestion | button.tsx | size sm = md en pratique | Info |

**Aucune issue critique ou importante. Sprint 3 VALIDE. Pret pour le Sprint 4.**
