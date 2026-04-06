# ADR-039 — Filter Sheet UX Fixes (4 issues)

**Date :** 2026-04-06
**Statut :** Accepté
**Auteur :** @architect

---

## Contexte

Quatre problèmes UX ont été remontés sur le Sheet de filtres des relevés
(composants `releves-filter-sheet.tsx` et `releves-filter-bar.tsx`).

---

## Issue 1 — Le bouton "Appliquer" ne ferme pas le Sheet

### Cause racine

`RelevesFilterSheet` reçoit une prop `onApply` et appelle `onApply(base)` dans
`handleApply` (ligne 302). Il n'existe aucun mécanisme pour fermer le Sheet
depuis l'intérieur du composant enfant : le Sheet est contrôlé par
`<Sheet>` (non-contrôlé, sans `open`/`onOpenChange`) dans `releves-filter-bar.tsx`,
et `RelevesFilterSheet` ne reçoit pas de callback de fermeture.

### Fix

**Fichier :** `src/components/releves/releves-filter-bar.tsx`

Passer le Sheet en mode contrôlé avec `open` + `onOpenChange`, puis fermer le
Sheet dans `updateMultipleParams` via un callback transmis à
`RelevesFilterSheet`.

```tsx
// releves-filter-bar.tsx — remplacer le bloc <Sheet> mobile (ligne 189)
const [sheetOpen, setSheetOpen] = useState(false);

// Dans updateMultipleParams, après router.push, ajouter :
//   setSheetOpen(false);

<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
  <SheetTrigger asChild>
    ...
  </SheetTrigger>
  <SheetContent ...>
    <RelevesFilterSheet
      ...
      onApply={(params) => {
        updateMultipleParams(params);
        setSheetOpen(false);   // ← ferme le Sheet
      }}
      onClear={() => {
        resetAllFilters();
        setSheetOpen(false);   // ← ferme le Sheet au reset aussi
      }}
    />
  </SheetContent>
</Sheet>
```

**Fichier :** `src/components/releves/releves-filter-sheet.tsx`

Aucun changement nécessaire — `handleApply` appelle déjà `onApply(base)`,
et le parent gère la fermeture.

---

## Issue 2 — Le bouton X (fermeture) caché derrière la safe area

### Cause racine

Dans `src/components/ui/sheet.tsx` (ligne 50), le bouton X est positionné
avec `top-3` fixe. Quand le Sheet est ouvert à droite en plein écran (sur
mobile avec encoche), le `top-3` (0.75rem = 12px) ne tient pas compte du
`env(safe-area-inset-top)` qui peut atteindre 44–59px. Le bouton se retrouve
sous l'encoche et est inatteignable.

Par ailleurs, `releves-filter-bar.tsx` ligne 207 ajoute `!p-0` qui supprime
tout padding du `SheetContent`, et `RelevesFilterSheet` gère son propre header
avec `pt-[env(safe-area-inset-top)]` (ligne 311). Mais le bouton X du
`SheetContent` est rendu **par-dessus** ce header, avec seulement `top-3`.

### Fix

**Fichier :** `src/components/ui/sheet.tsx`

Remplacer `top-3` par un top calculé intégrant la safe area :

```tsx
// Avant (ligne 50)
<DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 ...">

// Après
<DialogPrimitive.Close
  className="absolute right-3 rounded-md p-1 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] min-w-[44px] flex items-center justify-center"
  style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
>
```

**Alternative si le bouton X du Sheet de base est supprimé dans le cas filtre :**

`RelevesFilterSheet` possède déjà son propre header avec un bouton "Effacer
tout" et gère la safe area. On peut retirer le bouton X du `SheetContent`
de base **uniquement** pour ce Sheet en lui passant une prop ou en utilisant
`SheetClose` manuellement dans le header de `RelevesFilterSheet`.

La solution recommandée est la correction dans `sheet.tsx` (style inline `top`)
car elle est globale et ne casse aucun autre usage du Sheet.

---

## Issue 3 — Défilement horizontal dans le Sheet

### Cause racine

Deux sources potentielles de débordement horizontal :

1. **`RangeInputs` (ligne 89)** : la paire `<input>` min/max utilise
   `flex items-center gap-2` avec `flex-1` sur chaque input. Si le conteneur
   n'a pas de contrainte de largeur maximale, les inputs peuvent dépasser.
   Le Sheet lui-même utilise `w-full sm:w-96` (ligne 207 de `releves-filter-bar.tsx`)
   mais le contenu intérieur n'est pas contraint à `max-w-full`.

2. **Inputs de date (lignes 577-591)** : la ligne `flex items-center gap-2`
   contient un `<span>` de texte fixe et un `<input type="date" className="flex-1 ...">`.
   Sur certains navigateurs mobiles, le rendu natif du date-picker peut
   dépasser la largeur disponible.

### Fix

**Fichier :** `src/components/releves/releves-filter-sheet.tsx`

a) Ajouter `overflow-x-hidden` sur le conteneur scrollable (ligne 325) :

```tsx
// Avant
<div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

// Après
<div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">
```

b) Dans `RangeInputs`, ajouter `min-w-0` sur chaque input pour forcer le
rétrécissement du flex-child (ligne 90 et 100) :

```tsx
// Avant
className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"

// Après
className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
```

c) Sur les inputs de date dans la section "Période" (lignes 582 et 591),
ajouter également `min-w-0` :

```tsx
// Avant
className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"

// Après
className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
```

---

## Issue 4 — Bordure noire solide sur les champs input

### Cause racine

**`border-input` est une classe Tailwind référençant `--color-input`, qui
n'est pas défini dans `globals.css`.** Le thème du projet définit `--border`
(`#e2e8f0`, gris clair) mais pas `--input`. En Tailwind v4, une variable CSS
manquante dans `@theme inline` retourne une valeur vide, forçant le navigateur
à utiliser la couleur par défaut du système — ce qui produit une bordure noire
solide (`currentColor` ou black selon l'OS/navigateur).

La classe correcte pour les champs dans ce projet est `border-border`
(= `var(--border)` = `#e2e8f0`).

### Fix

**Fichier :** `src/components/releves/releves-filter-sheet.tsx`

Remplacer toutes les occurrences de `border-input` par `border-border`
(lignes 97, 107, 553, 582, 591, 602) :

```
border border-input  →  border border-border
border-input         →  border-border        (checkbox, ligne 602)
```

Il y a 6 occurrences dans ce fichier.

**Fichier :** `src/components/releves/releves-filter-bar.tsx`

Même correction pour les inputs date et checkbox desktop (lignes 290, 301, 311) :

```
border border-input  →  border border-border
border-input         →  border-border
```

**Note :** `src/components/ui/input.tsx` est correct — il utilise
`border-border` (via la classe `error ? "border-danger" : "border-border"`).
Les inputs custom dans `releves-filter-sheet.tsx` et `releves-filter-bar.tsx`
n'utilisent pas le composant `<Input>` et ont donc cette erreur manuellement
introduite.

---

## Résumé des fichiers à modifier

| Fichier | Issue(s) | Changements |
|---------|----------|-------------|
| `src/components/releves/releves-filter-bar.tsx` | 1, 4 | Passer Sheet en mode contrôlé (`open`/`onOpenChange`), `setSheetOpen(false)` dans onApply/onClear, `border-border` sur 3 inputs |
| `src/components/releves/releves-filter-sheet.tsx` | 3, 4 | `overflow-x-hidden` sur le corps scrollable, `min-w-0` sur tous les inputs flex, `border-border` sur 6 inputs |
| `src/components/ui/sheet.tsx` | 2 | `style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}` sur le bouton X |

---

## Conséquences

- Le Sheet se ferme automatiquement après "Appliquer" ou "Effacer tout".
- Le bouton X est toujours accessible, même sur iPhone avec Dynamic Island.
- Aucun scroll horizontal dans le Sheet, quelle que soit la largeur d'écran.
- Les champs input s'affichent avec la bordure gris clair du design system
  (`#e2e8f0`) au lieu du noir natif du navigateur.
- La correction de `sheet.tsx` (Issue 2) est globale et bénéficie à tous
  les Sheets de l'application (navigation sidebar, etc.).
- La correction de `border-input → border-border` est localisée aux deux
  fichiers fautifs ; `src/components/ui/input.tsx` est déjà correct.
