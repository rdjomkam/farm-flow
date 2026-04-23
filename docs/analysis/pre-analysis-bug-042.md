# Pré-analyse BUG-042 — Dialog "Nouvelle vague" non scrollable sur mobile
**Date :** 2026-04-23
**Pré-analyste :** @pre-analyst
**Sévérité recommandée :** **Haute** (bloque un flux métier central — création de vague — sur la cible principale mobile 360-375 px)

## Statut : GO POUR FIX (cause racine identifiée, surface de fix étroite et partagée)

## Résumé
Le wrapper partagé `DialogContent` (`src/components/ui/dialog.tsx`) n'active le scroll
vertical que si le dialog concret utilise le sous-composant opt-in `<DialogBody>`. La
classe `flex flex-col h-full md:max-h-[85dvh] overflow-x-clip` (ligne 64) ne contient
**aucun** `overflow-y-auto` ni `max-h` applicable à mobile. Les ~51 dialogs qui n'utilisent
pas `<DialogBody>` — dont "+ Nouvelle vague" — débordent silencieusement dès que leur
hauteur dépasse la viewport mobile. Fix recommandé : rendre le scroll + le footer sticky
par défaut dans le wrapper partagé (une seule modification surfacique corrige tous les
dialogs concernés).

## Reproduction confirmée

Fichier et lignes exactes qui manquent le scroll :

- `/Users/ronald/project/dkfarm/farm-flow/src/components/ui/dialog.tsx:62-69`

  ```tsx
  <div
    className={cn(
      "flex flex-col h-full md:max-h-[85dvh] overflow-x-clip",
      "px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:pt-0"
    )}
  >
    {children}
  </div>
  ```

  Pas d'`overflow-y-auto`. `h-full` sur mobile (où `DialogContent` est `inset-0`) borne
  la hauteur à la viewport, mais le contenu ne peut pas défiler — il est simplement
  tronqué.

- `/Users/ronald/project/dkfarm/farm-flow/src/components/vagues/vagues-list-client.tsx:207-386`

  ```tsx
  <DialogContent>
    <DialogHeader>…</DialogHeader>
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormSection …/>  {/* Identification */}
      <FormSection …/>  {/* Population */}
      <FormSection …/>  {/* Config élevage */}
      <FormSection …/>  {/* Bacs — variable, potentiellement long */}
      <DialogFooter>…</DialogFooter>
    </form>
  </DialogContent>
  ```

  Pas de `<DialogBody>`, pas de conteneur scrollable interne. Le footer est un frère
  direct des sections dans le flux normal → il est poussé hors écran.

- `DialogFooter` (`/Users/ronald/project/dkfarm/farm-flow/src/components/ui/dialog.tsx:129-142`)
  n'est **pas** `sticky`. Il applique `pb-[max(1rem,env(safe-area-inset-bottom))]` (bon
  pour iOS) mais reste dans le flux → il disparaît avec le contenu quand on "devrait"
  scroller.

## Root cause

Conception opt-in du scroll : le wrapper suppose que chaque dialog concret choisisse
d'utiliser `<DialogBody>` pour obtenir le scroll. En pratique, la majorité des dialogs
(`~51/70`) ne l'utilisent pas. Le comportement par défaut est donc **non-scrollable**,
ce qui est le mauvais défaut pour une appli mobile-first.

Plus précisément, la classe manquante sur le conteneur interne est :

```
overflow-y-auto max-h-[100dvh] supports-[height:100dvh]:max-h-[100dvh]
```

Et le footer devrait être :

```
sticky bottom-0 bg-card  (+ pb existant)
```

Viewport meta (`src/app/layout.tsx:98-104`) : déjà `viewportFit: "cover"` → `env(safe-area-inset-*)`
a bien des valeurs non nulles sur iOS. Rien à changer côté meta.

`globals.css:5-8` définit déjà `--sat/--sar/--sab/--sal`. Rien à ajouter côté CSS global —
les `env(safe-area-inset-bottom)` inline dans Tailwind fonctionnent.

## Inventaire des dialogs impactés (absence de `<DialogBody>`)

Les 51 fichiers suivants utilisent `<DialogContent>` SANS `<DialogBody>` → tous
potentiellement vulnérables au même bug dès que leur contenu dépasse la viewport mobile :

```
src/components/abonnements/abonnement-actuel-card.tsx
src/components/abonnements/abonnements-admin-list.tsx
src/components/abonnements/changer-plan-client.tsx
src/components/abonnements/plans-admin-list.tsx
src/components/admin/modules/admin-module-form-dialog.tsx
src/components/admin/sites/admin-site-status-dialog.tsx
src/components/alevins/lot-detail-client.tsx
src/components/alevins/lots-list-client.tsx
src/components/alevins/ponte-detail-client.tsx
src/components/alevins/pontes-list-client.tsx
src/components/alevins/reproducteur-detail-client.tsx
src/components/alevins/reproducteurs-list-client.tsx
src/components/backoffice/backoffice-site-status-dialog.tsx
src/components/backoffice/exoneration-form-dialog.tsx
src/components/backoffice/exonerations-list.tsx
src/components/backoffice/feature-flag-toggle.tsx
src/components/bacs/bacs-list-client.tsx
src/components/commissions/admin-retraits-list.tsx
src/components/commissions/retrait-dialog.tsx
src/components/depenses/recurrentes-list-client.tsx
src/components/ingenieur/nouvelle-note-dialog.tsx
src/components/notes/observation-dialog.tsx
src/components/packs/pack-detail-client.tsx
src/components/packs/packs-list-client.tsx
src/components/planning/completer-activite-dialog.tsx
src/components/planning/planning-client.tsx
src/components/regles-activites/placeholders-client.tsx
src/components/regles-activites/regle-detail-client.tsx
src/components/releves/delete-releve-button-global.tsx
src/components/remises/remise-form-dialog.tsx
src/components/remises/remises-list-client.tsx
src/components/reproduction/geniteur-detail-client.tsx
src/components/reproduction/geniteur-form.tsx
src/components/reproduction/incubation-detail-client.tsx
src/components/reproduction/lot-detail-client.tsx
src/components/reproduction/lot-phase-stepper.tsx
src/components/reproduction/lot-split-dialog.tsx
src/components/reproduction/ponte-detail-client.tsx
src/components/sites/member-actions-dialog.tsx
src/components/sites/site-detail-client.tsx
src/components/sites/sites-list-client.tsx
src/components/stock/commande-detail-client.tsx
src/components/ui/blocked-resource-overlay.tsx
src/components/users/user-profile-tab.tsx
src/components/users/user-security-tab.tsx
src/components/vagues/cloturer-dialog.tsx
src/components/vagues/gerer-bacs-dialog.tsx
src/components/vagues/modifier-vague-dialog.tsx
src/components/vagues/releves-list.tsx
src/components/vagues/vagues-list-client.tsx
src/components/ventes/clients-list-client.tsx
```

Dialogs courts (confirmations, toggles) : pas de symptôme visible, mais aucun risque
non plus — le nouveau défaut ne dégrade pas leur rendu.

Dialogs longs à fort risque (formulaires multi-sections) :
- `src/components/vagues/vagues-list-client.tsx` (cas observé)
- `src/components/vagues/modifier-vague-dialog.tsx`
- `src/components/vagues/gerer-bacs-dialog.tsx`
- `src/components/reproduction/geniteur-form.tsx`
- `src/components/reproduction/lot-split-dialog.tsx`
- `src/components/remises/remise-form-dialog.tsx`
- `src/components/backoffice/exoneration-form-dialog.tsx`
- `src/components/admin/modules/admin-module-form-dialog.tsx`
- `src/components/commissions/retrait-dialog.tsx`
- `src/components/ingenieur/nouvelle-note-dialog.tsx`
- `src/components/notes/observation-dialog.tsx`
- `src/components/users/user-profile-tab.tsx`, `user-security-tab.tsx`
- `src/components/packs/pack-detail-client.tsx`, `packs-list-client.tsx`

Les 19 dialogs qui utilisent déjà `<DialogBody>` (`fournisseurs-list`, `modifier-releve`,
`reception-commande`, `plan-form-dialog`, etc.) n'auront pas besoin de modification
individuelle — le fix du wrapper ne doit simplement pas régresser leur comportement.

## Fix chirurgical proposé

Cible unique : `src/components/ui/dialog.tsx`. Deux changements :

### 1. Scroll par défaut sur le conteneur interne

```tsx
// AVANT (dialog.tsx:62-67)
<div
  className={cn(
    "flex flex-col h-full md:max-h-[85dvh] overflow-x-clip",
    "px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:pt-0"
  )}
>

// APRÈS
<div
  className={cn(
    // Layout flex-col — identique
    "flex flex-col",
    // Mobile : occupe toute la viewport dynamique (barre URL iOS comprise) et scroll
    "h-[100dvh] max-h-[100dvh] overflow-y-auto",
    // Desktop : redevient compact, identique à avant
    "md:h-auto md:max-h-[85dvh]",
    // Conserve overflow-x-clip pour éviter les débordements horizontaux imprévus
    "overflow-x-clip",
    // Padding safe-area (identique)
    "px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:pt-0"
  )}
>
```

Notes :
- `100dvh` (dynamic viewport height) gère correctement la barre URL mobile qui s'agrandit/
  rétrécit. Tailwind 3.4+ et les navigateurs cibles (iOS 16+, Chrome Android) le supportent.
  Fallback : `h-screen` via media query si besoin — optionnel, car cibles supportent `dvh`.
- Quand un dialog utilise `<DialogBody>`, on aura un double-scroll théorique (parent +
  body). En pratique le parent est collé à la hauteur de la viewport et le body occupe
  `flex-1` → un seul scroll utile se déclenche (celui du body). Aucune régression
  attendue sur les 19 dialogs actuels.

### 2. Footer sticky par défaut

```tsx
// AVANT (dialog.tsx:129-142)
function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 pt-4 shrink-0",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
        "sm:flex-row sm:justify-end",
        "md:pb-6",
        className
      )}
      {...props}
    />
  );
}

// APRÈS
function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 pt-4 shrink-0",
        // Rend le footer collant en bas du dialog scrollable (mobile surtout)
        "sticky bottom-0 z-10 bg-card",
        // Petite bordure pour séparer visuellement quand du contenu passe dessous
        "border-t border-border/40 md:border-0",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
        "sm:flex-row sm:justify-end",
        "md:pb-6",
        className
      )}
      {...props}
    />
  );
}
```

Notes :
- `sticky bottom-0` fonctionne à l'intérieur d'un conteneur `overflow-y-auto` (ce que le
  parent devient au point 1). C'est la clé.
- `bg-card` = même fond que `DialogContent` (`bg-card` ligne 41) → cohérence visuelle.
  Respecte R6 (variable CSS, pas de hex en dur).
- `border-t` seulement sur mobile (cachée en md+ où le footer redevient dans le flux
  normal) pour éviter un trait disgracieux sur desktop.
- Les dialogs qui utilisent `<DialogBody>` ont déjà leur footer hors du body scrollable
  → `sticky bottom-0` y est neutre (rien à scroller dans le parent).

### 3. Pas de changement requis sur `vagues-list-client.tsx`

Le fix au niveau du wrapper suffit : le formulaire long scrollera automatiquement, le
footer collera en bas. Aucune modification à faire dans les 51 dialogs individuels.

## Plan de test de non-régression

### Vitest + @testing-library/react (obligatoire)

Créer `src/__tests__/ui/dialog.test.tsx` :

1. **Test `DialogContent` a un scroll vertical par défaut** :
   - Rendre `<Dialog open><DialogContent>…</DialogContent></Dialog>`.
   - Récupérer l'élément racine interne (le `div` avec `flex flex-col`).
   - Assert `className` contient `overflow-y-auto` et `max-h-[100dvh]`.

2. **Test `DialogFooter` est sticky avec safe-area** :
   - Rendre `<DialogFooter>…</DialogFooter>`.
   - Assert `className` contient `sticky`, `bottom-0`, `pb-[max(1rem,env(safe-area-inset-bottom))]`.

3. **Test de non-régression "DialogBody coexiste"** :
   - Rendre un dialog avec `<DialogBody>` + `<DialogFooter>`.
   - Assert `DialogBody` conserve `flex-1 overflow-y-auto` (déjà testé ailleurs ?).
   - Assert aucune erreur de rendu.

4. **Test non-régression dialog "Nouvelle vague"** (`vagues-list-client.test.tsx` si
   existant) : après ouverture, assert que l'élément racine du dialog a un
   `scrollHeight > clientHeight` **autorisant le scroll** (simulable via JSDOM en
   injectant des hauteurs custom sur `HTMLElement.prototype`).

### Playwright mobile (recommandé, optionnel pour ce sprint)

Scénario dans `e2e/vagues-mobile-dialog.spec.ts` :

```ts
test("new-batch dialog scrolls on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/vagues");
  await page.getByRole("button", { name: /nouvelle vague|new batch/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const submit = dialog.getByRole("button", { name: /créer la vague|create batch/i });
  // Avant scroll : submit pas dans la viewport
  await dialog.evaluate(el => el.scrollTo({ top: el.scrollHeight }));
  // Après scroll : submit visible (sticky footer rend le bouton toujours atteignable)
  await expect(submit).toBeInViewport();
});
```

## Dépendances / Prérequis

- `globals.css` : aucune modification requise — les utilitaires `env(safe-area-inset-*)`
  sont utilisés inline dans Tailwind, et `--sat/--sab` sont déjà définis.
- `layout.tsx` meta viewport : déjà `viewport-fit=cover` (ligne 102). RAS.
- Tailwind : `100dvh` natif supporté. Aucune extension `tailwind.config` nécessaire
  (classes arbitraires `h-[100dvh]`, `max-h-[100dvh]` fonctionnent out-of-the-box).
- Navigateurs cibles : iOS Safari 16+, Chrome Android 108+, Edge/Chrome desktop — tous
  supportent `dvh`. RAS.
- Respect des règles R5 (DialogTrigger asChild — déjà appliqué dans `vagues-list-client.tsx:201`)
  et R6 (variables CSS du thème — `bg-card` respecte ce principe).

## Risques identifiés

1. **Double scroll potentiel** sur les dialogs qui utilisent déjà `<DialogBody>` (19 fichiers).
   *Mitigation* : en pratique le parent bornant à `100dvh` n'a rien de plus haut à scroller
   que son `DialogBody` enfant (`flex-1`) ; pas de contenu en dehors du body qui déborde.
   Vérifier manuellement 2-3 de ces dialogs après fix (ex. `modifier-releve-dialog.tsx`,
   `plan-form-dialog.tsx`, `fournisseurs-list-client.tsx`).

2. **Sticky footer masque un tout petit peu de contenu final** à hauteur égale du footer.
   *Mitigation* : le body/contenu scrollable aura un `pb` généré implicitement par la
   somme des paddings ; si nécessaire ajouter `pb-4` au dernier élément ou documenter.

3. **z-index du sticky footer** : `z-10` local au conteneur suffit ; pas d'interaction
   avec l'overlay (z-50 sur `DialogOverlay`) car le stacking context est celui du dialog
   content, pas de la page.

4. **Tests existants** : un `vagues-page.test.tsx` existe (listé plus haut). Vérifier
   qu'il n'asserte pas la structure DOM exacte du dialog de manière trop stricte — sinon
   adapter.

## Fichiers impactés (absolus)

À modifier (fix) :
- `/Users/ronald/project/dkfarm/farm-flow/src/components/ui/dialog.tsx`

À créer (tests) :
- `/Users/ronald/project/dkfarm/farm-flow/src/__tests__/ui/dialog.test.tsx` (nouveau)
- (optionnel) `/Users/ronald/project/dkfarm/farm-flow/e2e/vagues-mobile-dialog.spec.ts`

À vérifier manuellement (QA mobile 375 px) :
- `/Users/ronald/project/dkfarm/farm-flow/src/components/vagues/vagues-list-client.tsx` (cas observé)
- `/Users/ronald/project/dkfarm/farm-flow/src/components/vagues/modifier-vague-dialog.tsx`
- `/Users/ronald/project/dkfarm/farm-flow/src/components/reproduction/geniteur-form.tsx`
- `/Users/ronald/project/dkfarm/farm-flow/src/components/remises/remise-form-dialog.tsx`
- `/Users/ronald/project/dkfarm/farm-flow/src/components/stock/fournisseurs-list-client.tsx` (utilise DialogBody — non-régression)
- `/Users/ronald/project/dkfarm/farm-flow/src/components/releves/modifier-releve-dialog.tsx` (utilise DialogBody — non-régression)

Fichiers en lecture seule (contexte) :
- `/Users/ronald/project/dkfarm/farm-flow/src/app/globals.css` (safe-area vars déjà OK)
- `/Users/ronald/project/dkfarm/farm-flow/src/app/layout.tsx` (viewport-fit=cover déjà OK)
- `/Users/ronald/project/dkfarm/farm-flow/docs/knowledge/ERRORS-AND-FIXES.md` (ERR-064 donne le pattern de safe-area sticky)

## Recommandation

**GO** — fix étroit et chirurgical dans `src/components/ui/dialog.tsx` (une seule
source de vérité). Sévérité **Haute** : bloque un parcours métier central (création
de vague) sur cible mobile principale. Assigner à @developer avec review obligatoire
par @code-reviewer (sévérité Haute) et vérification @tester (build + vitest + smoke
manuel mobile sur 2-3 dialogs à contenu long).

Knowledge-keeper à notifier après fix pour ajouter un ERR-XXX : "Le défaut d'un
wrapper Dialog partagé doit être **scroll-on** et footer-sticky ; rendre le scroll
opt-in est un anti-pattern mobile-first" (complémentaire de ERR-064 sur les Sheets).
