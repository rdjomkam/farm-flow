# ADR-PWA-MOBILE-FIX — Corrections PWA Mobile : Safe Areas, Splash Screen, Couleurs, Manifest

**Statut :** Proposé
**Date :** 2026-03-22
**Auteur :** @architect
**Sprint cible :** Sprint 12 (Polish + Navigation)

---

## Contexte

FarmFlow est une PWA Next.js 14+ installable sur iOS et Android. Une analyse approfondie de tous les fichiers PWA et layout révèle six catégories de problèmes affectant l'expérience mobile en mode installé (standalone). Ces problèmes sont documentés ci-dessous avec leur cause racine précise et la solution technique complète.

---

## Inventaire des problèmes — Analyse de l'état actuel

### Problème 1 — Safe areas : couverture partielle

**Observation :** `env(safe-area-inset-*)` est utilisé dans deux endroits seulement :

- `bottom-nav.tsx` ligne 116 : `pb-[env(safe-area-inset-bottom)]` — **correct**
- `app-shell.tsx` ligne 44 : `pb-[calc(4rem+env(safe-area-inset-bottom))]` pour le `<main>` — **correct**

**Ce qui manque :**

1. Le **top safe area** (status bar / notch) n'est géré nulle part. Avec `statusBarStyle: "black-translucent"` dans `layout.tsx` (ligne 40) et `viewportFit: "cover"` (ligne 53), le contenu commence sous la barre d'état transparente. Le `<header>` dans `header.tsx` utilise `sticky top-0` sans `pt-[env(safe-area-inset-top)]`. Le contenu passe donc sous la status bar iOS.

2. Le `<Sheet>` (`hamburger-menu.tsx`) : `SheetContent` utilise `inset-y-0` (ligne 38 de `sheet.tsx`). Le contenu interne commence à y=0, sans `pt-[env(safe-area-inset-top)]`.

3. La page offline (`~offline/page.tsx`) : `min-h-screen` sans ajustement des safe areas — problème mineur car aucun élément `fixed`.

4. Les dialogs `SyncStatusPanel` (feuille bottom-sheet) : `fixed inset-x-0 bottom-0` avec `p-4` sans `pb-[env(safe-area-inset-bottom)]`. Sur iPhone, le handle et les boutons du bas peuvent être masqués par l'home indicator.

5. Les dialogs `PinUnlockDialog` et `PinSetupDialog` : centrés à `top-1/2` — pas de problème de safe area, mais centrés visuellement sans tenir compte du clavier virtuel.

### Problème 2 — Splash screen : écran noir au lancement

**Cause racine :** Le manifest ne contient pas d'entrée `screenshots`. Sur iOS, Safari génère automatiquement un splash screen depuis `apple-touch-icon` et `theme_color` uniquement si les balises `<link rel="apple-touch-startup-image">` sont présentes pour chaque taille d'écran. Sur Android (Chrome), le splash screen est généré depuis `name`, `background_color`, `theme_color`, et l'icône de 512px — ceci fonctionne déjà.

**État actuel :**
- `layout.tsx` ligne 43 : `apple: "/apple-touch-icon.png"` — une seule taille, sans tailles multiples
- `appleWebApp.statusBarStyle: "black-translucent"` — correct
- Aucune balise `<link rel="apple-touch-startup-image">` dans le layout
- `manifest.json` : pas d'entrée `screenshots`

**Impact :** iOS affiche un écran blanc/noir pendant 1-2 secondes au démarrage en mode standalone.

### Problème 3 — Couleurs hardcodées (violation R6)

**Fichiers en infraction — inventaire exhaustif :**

| Fichier | Lignes | Couleurs hardcodées |
|---------|--------|---------------------|
| `src/components/pwa/install-prompt.tsx` | 13, 21, 23, 27, 34 | `bg-white`, `text-gray-500`, `text-blue-500`, `text-gray-400/600` |
| `src/components/pwa/sync-status-panel.tsx` | 85, 89, 112, 122, 130, 136, 162, 178 | `bg-white`, `text-gray-500`, `border-red-200`, `bg-red-50`, `text-red-600/700`, `bg-red-600`, `text-gray-600/500`, `bg-gray-50` |
| `src/components/pwa/pin-unlock-dialog.tsx` | 106, 116, 121-123, 144, 150, 162, 170 | `bg-white`, `text-gray-500`, `bg-amber-50`, `text-amber-700`, `border-gray-300`, `text-red-500`, `text-gray-400/600` |
| `src/components/pwa/pin-setup-dialog.tsx` | 57, 69, 94, 101, 111, 121-122 | `bg-white`, `text-gray-500`, `border-gray-300`, `text-gray-400`, `text-red-500`, `text-gray-700`, `bg-gray-50` |
| `src/app/layout.tsx` | 54 | `themeColor: "#0d9488"` hardcodé |
| `public/manifest.json` | 9-10 | `background_color: "#ffffff"` et `theme_color: "#0d9488"` (inévitable dans JSON) |

**Note :** Dans `manifest.json`, les valeurs hexadécimales sont inévitables (format JSON ne supporte pas les variables CSS). La règle R6 s'applique uniquement aux fichiers TSX/CSS.

### Problème 4 — Status bar overlap

**Cause racine — détail technique :**

La configuration `viewport: { viewportFit: "cover" }` (layout.tsx ligne 53) + `appleWebApp: { statusBarStyle: "black-translucent" }` (ligne 40) rend la status bar iOS transparente. Cela est intentionnel pour que le contenu s'étende sous la status bar.

Cependant, le `<header>` dans `header.tsx` utilise `sticky top-0` (ligne 40). Sans `padding-top: env(safe-area-inset-top)`, le haut du header chevauche la zone de la status bar.

**Calcul correct :**
- `top-0` doit être compensé par `pt-[env(safe-area-inset-top)]` sur le header
- La hauteur totale du header doit donc être `56px + env(safe-area-inset-top)` au lieu de `56px` fixe
- La valeur `top-14 sm:top-11` utilisée pour le mode impersonation (layout.tsx ligne 95, header.tsx ligne 41) doit aussi intégrer `env(safe-area-inset-top)`

**Composants `fixed` concernés :**

| Composant | Position | Problème |
|-----------|----------|----------|
| `bottom-nav.tsx` | `fixed bottom-0` | Gere (pb safe-area-bottom) |
| `header.tsx` | `sticky top-0` | Manque pt safe-area-top |
| `sw-register.tsx` | `fixed bottom-20` | Correct (distance relative) |
| `install-prompt.tsx` | `fixed bottom-20` | Correct |
| `SyncStatusPanel` (bottom-sheet) | `fixed inset-x-0 bottom-0` | Manque pb safe-area-bottom |
| `SheetContent` (hamburger) | `fixed inset-y-0 left-0` | Manque pt safe-area-top |

### Problème 5 — Screenshots manquants dans le manifest

**État actuel :** `manifest.json` ne contient pas de champ `screenshots`.

**Impact :**
- Chrome (Android) : la bannière d'installation ("Add to Home Screen") n'affiche pas de preview de l'app
- Chrome 119+ : les screenshots sont requis pour déclencher la bannière mini-infobar avancée

**Spécifications requises :**
- Au minimum 1 screenshot `narrow` (mobile) et 1 screenshot `wide` (desktop)
- Taille recommandée : entre 320x640px et 3840x2160px
- Ratio : entre 0.5 et 2.0

### Problème 6 — Apple touch icon : taille unique

**État actuel :**
- `public/apple-touch-icon.png` — une seule taille, non spécifiée
- `layout.tsx` ligne 44 : `apple: "/apple-touch-icon.png"` — aucune taille déclarée

**Impact :** iOS redimensionne l'icône, résultat flou sur les écrans haute densité (Retina). La taille recommandée par Apple est 180x180px. Pour la qualité optimale, plusieurs tailles sont supportées.

---

## Solutions techniques

### Solution 1 — Safe areas : stratégie globale

**Principe :** Appliquer le safe area top au niveau du layout global via une variable CSS plutôt que composant par composant.

#### 1a. globals.css — ajouter les variables safe area

```css
/* Safe area custom properties */
:root {
  --sat: env(safe-area-inset-top);
  --sar: env(safe-area-inset-right);
  --sab: env(safe-area-inset-bottom);
  --sal: env(safe-area-inset-left);
}
```

Ces raccourcis permettent l'utilisation dans les `calc()` Tailwind arbitraires.

#### 1b. globals.css — classe utilitaire pour les pages en mode standalone

```css
/* Applique le top safe area sur l'ensemble du document quand en mode standalone PWA */
@media (display-mode: standalone) {
  body {
    padding-top: env(safe-area-inset-top);
  }
}
```

**Attention :** Cette approche globale est simple mais peut entrer en conflit avec les éléments `sticky top-0`. Il vaut mieux gérer le safe area top au niveau du premier élément fixe/sticky visible, soit le `<header>`.

**Approche recommandée — par composant, pas globale :**

Le header est le premier élément visuel touchant le bord supérieur. C'est lui qui doit absorber le safe area top.

#### 1c. header.tsx — ajouter pt-[env(safe-area-inset-top)]

Fichier : `src/components/layout/header.tsx`

Modification de la classe du `<header>` :

```tsx
// Avant :
"sticky z-30 flex min-h-[56px] items-center justify-between border-b border-border bg-card px-4 py-3 transition-transform duration-300 md:translate-y-0"

// Apres :
"sticky z-30 flex min-h-[calc(56px+env(safe-area-inset-top))] items-center justify-between border-b border-border bg-card px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] transition-transform duration-300 md:translate-y-0 md:min-h-[56px] md:pt-3"
```

**Explication :** `pt-[max(0.75rem,env(safe-area-inset-top))]` garantit un padding minimum de `py-3` (0.75rem) tout en laissant de la place pour la status bar quand elle existe. Sur desktop, `md:pt-3` revient à la valeur par défaut.

La correction `top-14 sm:top-11` du mode impersonation dans `header.tsx` (ligne 41) doit aussi tenir compte du safe area top. Ce cas est plus complexe (combinaison du banner + safe area) — voir la section Risques.

#### 1d. sheet.tsx — SheetContent : ajouter pt safe-area-top

Fichier : `src/components/ui/sheet.tsx`

```tsx
// Avant :
"fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border shadow-lg"

// Apres :
"fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border shadow-lg pt-[env(safe-area-inset-top)]"
```

Cela protège le contenu du Sheet (hamburger menu) de la status bar transparente.

#### 1e. sync-status-panel.tsx — bottom sheet : ajouter pb safe-area-bottom

Fichier : `src/components/pwa/sync-status-panel.tsx`

```tsx
// Avant (ligne 85) :
"fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-xl bg-white p-4 shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"

// Apres :
"fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-4"
```

### Solution 2 — Splash screen iOS

**Contexte technique iOS :** Safari/WebKit génère le splash screen depuis les balises `<link rel="apple-touch-startup-image">`. Sans ces balises, le splash screen est généré dynamiquement (résultat flou ou blanc) ou n'apparaît pas.

**Approche en deux étapes :**

#### 2a. Génération des images splash

Les splash screens iOS doivent correspondre exactement aux dimensions de chaque appareil (résolution logique x device pixel ratio). Les tailles les plus courantes en 2026 :

| Appareil | Largeur CSS | Hauteur CSS | DPR | Image réselle |
|----------|------------|------------|-----|---------------|
| iPhone SE (3rd) | 375 | 667 | 2 | 750x1334 |
| iPhone 13/14 mini | 375 | 812 | 3 | 1125x2436 |
| iPhone 14/15 | 390 | 844 | 3 | 1170x2532 |
| iPhone 14/15 Pro | 393 | 852 | 3 | 1179x2556 |
| iPhone 14/15 Plus | 428 | 926 | 3 | 1284x2778 |
| iPhone 14/15 Pro Max | 430 | 932 | 3 | 1290x2796 |
| iPad mini (6th) | 744 | 1133 | 2 | 1488x2266 |
| iPad Air (5th/M2) | 820 | 1180 | 2 | 1640x2360 |
| iPad Pro 11" | 834 | 1194 | 2 | 1668x2388 |
| iPad Pro 13" | 1024 | 1366 | 2 | 2048x2732 |

**Design du splash screen :** Logo FarmFlow centré (poisson + texte), fond `#ffffff` (ou la valeur de `--background`), barre du bas avec la couleur primary.

**Méthode de génération recommandée :** Script Node.js utilisant `sharp` ou `canvas` pour générer toutes les tailles depuis un template SVG.

Emplacement des fichiers générés : `public/splash/`

```
public/splash/
  apple-splash-750-1334.png
  apple-splash-1125-2436.png
  apple-splash-1170-2532.png
  apple-splash-1179-2556.png
  apple-splash-1284-2778.png
  apple-splash-1290-2796.png
  apple-splash-1488-2266.png
  apple-splash-1640-2360.png
  apple-splash-1668-2388.png
  apple-splash-2048-2732.png
```

#### 2b. layout.tsx — ajouter les balises apple-touch-startup-image

Next.js `generateMetadata` ne supporte pas nativement les balises `apple-touch-startup-image` (elles ne sont pas dans le type `Metadata`). Il faut les ajouter via une section `<head>` dans le layout ou via `other` dans les métadonnées.

**Option A — via metadata.other (recommandé) :**

```tsx
export async function generateMetadata(): Promise<Metadata> {
  return {
    // ... métadonnées existantes ...
    other: {
      // iPhone SE / 8 / 7 / 6s (750x1334)
      "apple-touch-startup-image-750x1334": '<link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/apple-splash-750-1334.png">',
      // iPhone 13/14 mini (1125x2436)
      "apple-touch-startup-image-1125x2436": '<link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/apple-splash-1125-2436.png">',
      // ... etc. pour chaque taille
    },
  };
}
```

**Attention :** `metadata.other` injecte des balises `<meta>` non des `<link>`. Cette approche ne fonctionnera pas correctement pour les balises `<link>`.

**Option B — via un composant Server Component dans layout.tsx (recommandée) :**

Créer un composant `AppleSplashLinks` sans `"use client"` qui retourne les balises `<link>` appropriées dans un fragment :

```tsx
// src/components/pwa/apple-splash-links.tsx
// Server Component — pas de "use client"

const SPLASH_SCREENS = [
  { width: 375, height: 667, dpr: 2, file: "apple-splash-750-1334.png" },
  { width: 375, height: 812, dpr: 3, file: "apple-splash-1125-2436.png" },
  { width: 390, height: 844, dpr: 3, file: "apple-splash-1170-2532.png" },
  { width: 393, height: 852, dpr: 3, file: "apple-splash-1179-2556.png" },
  { width: 428, height: 926, dpr: 3, file: "apple-splash-1284-2778.png" },
  { width: 430, height: 932, dpr: 3, file: "apple-splash-1290-2796.png" },
  { width: 744, height: 1133, dpr: 2, file: "apple-splash-1488-2266.png" },
  { width: 820, height: 1180, dpr: 2, file: "apple-splash-1640-2360.png" },
  { width: 834, height: 1194, dpr: 2, file: "apple-splash-1668-2388.png" },
  { width: 1024, height: 1366, dpr: 2, file: "apple-splash-2048-2732.png" },
] as const;

export function AppleSplashLinks() {
  return (
    <>
      {SPLASH_SCREENS.map((screen) => (
        <link
          key={screen.file}
          rel="apple-touch-startup-image"
          media={`screen and (device-width: ${screen.width}px) and (device-height: ${screen.height}px) and (-webkit-device-pixel-ratio: ${screen.dpr}) and (orientation: portrait)`}
          href={`/splash/${screen.file}`}
        />
      ))}
    </>
  );
}
```

L'injecter dans le `<head>` du layout via le pattern Next.js `<head>` dans `layout.tsx` :

```tsx
// Dans layout.tsx, l'import et l'usage dans la balise <html> :
import { AppleSplashLinks } from "@/components/pwa/apple-splash-links";

// Dans le return :
return (
  <html lang={locale}>
    <head>
      <AppleSplashLinks />
    </head>
    <body ...>
```

**Note :** Next.js App Router fusionne automatiquement le `<head>` défini dans le layout avec les métadonnées générées. L'ajout d'un `<head>` explicite dans le layout est supporté.

#### 2c. layout.tsx — icônes apple multiples tailles

```tsx
icons: {
  apple: [
    { url: "/apple-touch-icon-180.png", sizes: "180x180" },
    { url: "/apple-touch-icon-152.png", sizes: "152x152" },
    { url: "/apple-touch-icon-120.png", sizes: "120x120" },
    { url: "/apple-touch-icon.png" }, // fallback
  ],
},
```

Fichiers à créer dans `public/` : `apple-touch-icon-180.png` (priorité haute), `apple-touch-icon-152.png`, `apple-touch-icon-120.png`.

### Solution 3 — Correction des couleurs hardcodées (R6)

**Mapping de remplacement :**

| Couleur hardcodée | Remplacement via token |
|-------------------|------------------------|
| `bg-white` | `bg-card` |
| `text-gray-500` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground` |
| `text-gray-600` | `text-foreground` |
| `text-gray-700` | `text-foreground` |
| `bg-gray-50` | `bg-muted` |
| `hover:bg-gray-50` | `hover:bg-muted` |
| `border-gray-300` | `border-border` |
| `text-blue-500` | `text-accent-blue` |
| `text-red-500` | `text-danger` |
| `text-red-600` | `text-danger` |
| `text-red-700` | `text-danger` |
| `bg-red-600` | `bg-danger` |
| `border-red-200` | `border-danger/30` |
| `bg-red-50` | `bg-danger/10` |
| `hover:bg-red-50` | `hover:bg-danger/10` |
| `hover:bg-red-700` | `hover:bg-danger/90` |
| `text-amber-700` | `text-warning/80` |
| `bg-amber-50` | `bg-warning/10` |

**Fichiers à modifier :**

1. `src/components/pwa/install-prompt.tsx` — 5 occurrences
2. `src/components/pwa/sync-status-panel.tsx` — 9 occurrences
3. `src/components/pwa/pin-unlock-dialog.tsx` — 7 occurrences
4. `src/components/pwa/pin-setup-dialog.tsx` — 6 occurrences
5. `src/app/layout.tsx` ligne 54 — `themeColor: "#0d9488"` → pas de variable CSS possible ici (type Viewport de Next.js attend une string), mais documenter que cette valeur doit être synchronisée manuellement avec `--primary`

**Cas particulier `layout.tsx` :**

```tsx
// Avant :
export const viewport: Viewport = {
  themeColor: "#0d9488",
};

// Apres — avec valeur claire pour dark/light mode :
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d9488" },
    { media: "(prefers-color-scheme: dark)", color: "#0d9488" },
  ],
};
```

Note : la valeur hex reste inévitable dans le type Viewport. Ajouter un commentaire `// Sync avec --primary dans globals.css`.

### Solution 4 — Status bar overlap (déjà couvert par Solution 1c)

Le problème de la status bar est résolu intégralement par l'application de `pt-[max(0.75rem,env(safe-area-inset-top))]` sur le `<header>` (Solution 1c). Aucune modification supplémentaire n'est nécessaire pour ce point.

**Vérification :** Tester sur un iPhone avec notch (ex. iPhone 14) en mode standalone — le menu hamburger et la cloche doivent apparaître sous la status bar, pas derrière.

### Solution 5 — Screenshots dans le manifest

**Ajouter à `public/manifest.json` :**

```json
"screenshots": [
  {
    "src": "/screenshots/mobile-dashboard.png",
    "sizes": "390x844",
    "type": "image/png",
    "form_factor": "narrow",
    "label": "Tableau de bord FarmFlow"
  },
  {
    "src": "/screenshots/mobile-vagues.png",
    "sizes": "390x844",
    "type": "image/png",
    "form_factor": "narrow",
    "label": "Gestion des vagues"
  },
  {
    "src": "/screenshots/desktop-dashboard.png",
    "sizes": "1280x800",
    "type": "image/png",
    "form_factor": "wide",
    "label": "Dashboard desktop FarmFlow"
  }
]
```

**Dossier :** `public/screenshots/`

**Méthode de capture :** Captures manuelles ou via Playwright screenshot sur les pages clés.

### Solution 6 — Apple touch icons : tailles manquantes

**Tailles requises :**

| Fichier | Taille | Utilisation |
|---------|--------|-------------|
| `apple-touch-icon-180.png` | 180x180 | iPhone (Retina, toutes générations récentes) |
| `apple-touch-icon-152.png` | 152x152 | iPad Retina |
| `apple-touch-icon-120.png` | 120x120 | iPhone (écrans standard) |
| `apple-touch-icon.png` | 180x180 | Fallback générique |

**Note :** Le fichier `apple-touch-icon.png` existant doit être vérifié. Si sa taille n'est pas 180x180, il doit être remplacé.

**Génération :** À partir de `public/icon.svg` via `sharp` ou équivalent.

---

## Liste ordonnée des fichiers à modifier

### Phase A — Critique (safe areas + couleurs)

1. **`src/app/globals.css`** — Ajouter les variables CSS `--sat`, `--sar`, `--sab`, `--sal`
2. **`src/components/layout/header.tsx`** — `pt-[max(0.75rem,env(safe-area-inset-top))]` + ajustement `min-h`
3. **`src/components/ui/sheet.tsx`** — `pt-[env(safe-area-inset-top)]` sur SheetContent
4. **`src/components/pwa/sync-status-panel.tsx`** — `pb-[max(1rem,env(safe-area-inset-bottom))]` sur la bottom-sheet + remplacement des couleurs hardcodées
5. **`src/components/pwa/install-prompt.tsx`** — Remplacement des couleurs hardcodées + `pb-[env(safe-area-inset-bottom)]` sur le container fixe
6. **`src/components/pwa/pin-unlock-dialog.tsx`** — Remplacement des couleurs hardcodées
7. **`src/components/pwa/pin-setup-dialog.tsx`** — Remplacement des couleurs hardcodées
8. **`src/app/layout.tsx`** — Ajout `<head>` avec `<AppleSplashLinks>`, icônes apple multiples, themeColor commenté

### Phase B — Important (splash screen)

9. **`src/components/pwa/apple-splash-links.tsx`** — Nouveau fichier Server Component
10. **`public/manifest.json`** — Ajout `screenshots`
11. **`public/splash/*.png`** — 10 images à générer (script externe)
12. **`public/screenshots/*.png`** — 3 captures d'écran
13. **`public/apple-touch-icon-180.png`** — Icône 180x180
14. **`public/apple-touch-icon-152.png`** — Icône 152x152
15. **`public/apple-touch-icon-120.png`** — Icône 120x120

### Phase C — Nice to have

16. **`src/components/pwa/sw-register.tsx`** — Ajustement `bottom-20` pour tenir compte de la bottom-nav variable selon le rôle (ce composant s'affiche à bottom-20 ce qui peut se superposer avec la bottom-nav selon le contexte)

---

## Ce qui fonctionne déjà — ne pas casser

| Composant | Fonctionnalité | Raison de ne pas toucher |
|-----------|---------------|--------------------------|
| `bottom-nav.tsx` ligne 116 | `pb-[env(safe-area-inset-bottom)]` | Correct, ne pas modifier |
| `app-shell.tsx` ligne 44 | `pb-[calc(4rem+env(safe-area-inset-bottom))]` | Correct, ne pas modifier |
| `sw-register.tsx` | `fixed bottom-20` | Distance relative au bottom-nav, correct |
| `install-prompt.tsx` | `fixed bottom-20` | Distance relative au bottom-nav, correct |
| `dialog.tsx` `DialogContent` | `inset-0` mobile / centré desktop | Comportement correct |
| Service Worker Serwist | Génération `sw.js` | Ne pas toucher `next.config.ts` |

---

## Analyse — Modals et Dialogs sur mobile

### DialogContent (dialog.tsx)

**Mode mobile :** `inset-0 rounded-none` — plein écran. Le `overflow-y-auto` interne gère le scroll. Pas de problème de safe area car le dialog couvre tout l'écran et le contenu est dans une div avec `p-4 md:p-6`.

**Problème potentiel :** Sur iOS avec `viewportFit: "cover"`, le dialog plein écran peut empiéter sur la safe area top (status bar). Ajouter `pt-[env(safe-area-inset-top)]` au `<div className="flex h-full flex-col overflow-y-auto p-4...">` interne serait prudent, mais seulement pour le mobile.

**Correction recommandée :**
```tsx
// dialog.tsx ligne 51 — ajuster le div interne
<div className="flex h-full flex-col overflow-y-auto p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:max-h-[85vh] md:p-6">
```

### SheetContent (sheet.tsx)

**Mode mobile :** `fixed inset-y-0 left-0` — occupe toute la hauteur. Sans `pt-[env(safe-area-inset-top)]`, le logo "FarmFlow" dans le hamburger menu apparaît sous la status bar.

### PinUnlockDialog et PinSetupDialog

Centrés à `top-1/2` avec `transform: translateY(-50%)`. Sur mobile avec clavier virtuel ouvert, l'élément peut être partiellement masqué. L'attribut `inputMode="numeric"` est déjà présent — le clavier numérique iOS est moins haut que le clavier complet. Pas de correction critique nécessaire, mais un `max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))]` sur le dialog limiterait les débordements.

---

## Risques et considérations

### Risque 1 — Impersonation banner + safe area top

La bannière d'impersonation (`ImpersonationBanner`) est positionnée `fixed top-0` dans `layout.tsx`. Elle utilise une hauteur de `h-14 sm:h-11`. Le header compense avec `top-14 sm:top-11` (header.tsx ligne 41).

Avec l'ajout du safe area top, la chaîne devient :
- `ImpersonationBanner` : doit ajouter `pt-[env(safe-area-inset-top)]` et ajuster sa hauteur
- `SubscriptionBanner` (layout.tsx ligne 93) : `pt-14 sm:pt-11` dans le `<div>` wrapper — doit aussi tenir compte du safe area top

**Évaluation :** Ce cas edge (impersonation + PWA + iOS) est rare (admin seulement). Prioriser la correction basique du header, et documenter le cas d'impersonation comme une amélioration ultérieure.

### Risque 2 — env() sur les navigateurs non-Safari

`env(safe-area-inset-top)` vaut `0` sur Android/Chrome hors mode standalone et sur desktop. L'expression `max(0.75rem, env(safe-area-inset-top))` garantit un minimum visuel correct quel que soit le support.

### Risque 3 — Taille des splash screens en cache

Les splash screens iOS sont mis en cache après le premier affichage. Si les noms de fichiers ne changent pas après une mise à jour de design, les anciens splash screens peuvent rester affichés. Utiliser des noms versionnés ou purger le cache est recommandé.

### Risque 4 — manifest.json screenshots et MIME type

Les screenshots doivent être des PNG ou JPEG. Vérifier que le serveur Next.js sert correctement les fichiers depuis `public/screenshots/` avec le bon `Content-Type`.

### Risque 5 — Splash screens iOS : dépendance à des images binaires

Les 10 images splash (et les 3 screenshots) doivent être créées avant que le code soit mergé. Sans les fichiers images, les balises `<link rel="apple-touch-startup-image">` pointent vers des 404, ce qui peut causer un affichage dégradé. Le composant `AppleSplashLinks` doit être conditionnel ou les images doivent être garanties présentes.

---

## Approche de livraison recommandée

### Étape 1 (priorité haute — sans génération d'images)
Corriger les safe areas et les couleurs hardcodées. Ces corrections sont purement CSS/TSX et ne requièrent pas d'assets externes.

Fichiers : `globals.css`, `header.tsx`, `sheet.tsx`, `dialog.tsx`, `sync-status-panel.tsx`, `install-prompt.tsx`, `pin-unlock-dialog.tsx`, `pin-setup-dialog.tsx`, `layout.tsx` (themeColor).

### Étape 2 (priorité moyenne — assets)
Générer et intégrer les assets : icônes apple (180, 152, 120px), screenshots (3 captures). Ces assets sont petits et rapides à produire.

Fichiers : `public/apple-touch-icon-*.png`, `public/screenshots/*.png`, `layout.tsx` (icônes multiples), `manifest.json` (screenshots).

### Étape 3 (priorité basse — splash screens iOS)
Générer les 10 splash screens iOS. Nécessite un script de génération ou un outil graphique. Intégrer `AppleSplashLinks` dans le layout.

Fichiers : `src/components/pwa/apple-splash-links.tsx`, `public/splash/*.png`, `layout.tsx` (head).

---

## Références

- [Apple Human Interface Guidelines — Launching](https://developer.apple.com/design/human-interface-guidelines/launching)
- [Web App Manifest — screenshots](https://developer.mozilla.org/en-US/docs/Web/Manifest/screenshots)
- [CSS env() — safe-area-inset-*](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
- [viewport-fit=cover — iOS](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
- [Next.js Metadata API — appleWebApp](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#applewebapp)
