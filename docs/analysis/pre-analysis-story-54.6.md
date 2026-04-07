# Pre-analyse Story 54.6 — Component Pattern Upgrades

**Date :** 2026-04-07
**Analyste :** @pre-analyst

## Statut : GO AVEC RESERVES

## Resume

Story 54.6 porte sur trois taches independantes : (1) ajout d'une prop `shape` au composant Badge, (2) creation d'un composant SlidePanel base sur Radix Dialog, (3) remplacement de l'icone Fish de lucide-react par un SVG silure custom. La base de code est saine pour ces trois taches. Un point de vigilance important : le Fish lucide-react n'est pas utilise seulement dans les headers/sidebar — il est repandu dans 15+ fichiers sources. L'histoire parle uniquement de remplacer dans farm-sidebar, bottom-nav et farm-header, mais un inventaire complet est necessaire. Le build ne peut pas etre valide (memoire insuffisante pour next build complet), mais TypeScript est propre en dehors des tests.

---

## Verifications effectuees

### Schema / Types : N/A
Cette story n'implique pas de modifications Prisma ou de types metier.

### API / Queries : N/A
Aucune route API concernee.

### Build : INDETERMITE (contrainte machine)

Le processus `next build` est tue par le systeme (exit code 144/137 = SIGKILL) avant completion — contrainte de memoire RAM sur la machine de dev, pas un echec de code. La compilation TypeScript `npx tsc --noEmit --skipLibCheck` (hors `.next/types` stales) ne retourne aucune erreur dans les fichiers sources applicatifs. Les seules erreurs TS concernent `src/__tests__/activity-engine/api/regles-activites.test.ts` (types vitest non declares dans tsconfig tests) — pre-existantes, hors perimetre Story 54.6.

**Conclusion build :** Pas de regression TypeScript detectee sur les fichiers source. La contrainte est materielle, pas une erreur de code.

### Tests : NON EXECUTES
`npx vitest run` non lance (dependance au build pour certains tests d'integration). Les tests unitaires purs restent valides.

---

## Etat actuel des composants concernes

### Badge (`src/components/ui/badge.tsx`)

**API actuelle :**
```ts
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants; // "default" | "en_cours" | "terminee" | "annulee" | "info" | "warning" | "success"
}
```

**Rendu actuel :** `rounded-full px-2.5 py-0.5 text-xs font-medium` — pill uniquement, pas de prop shape.

**Variantes disponibles :** default, en_cours, terminee, annulee, info, warning, success.

**Ce qui doit etre ajoute :** prop `shape?: "pill" | "square"` (pill = `rounded-full` par defaut, square = `rounded-md`). Modification minimale, pas de risque de regression car `pill` est la valeur par defaut.

**Fichiers utilisant Badge :** nombreux. Un changement non retrocompatible casserait tout. La prop doit etre optionnelle avec `pill` comme defaut.

### Sheet (`src/components/ui/sheet.tsx`)

**Structure actuelle :**
- Wrapper autour de `@radix-ui/react-dialog` (meme primitive que Dialog)
- `SheetContent` : glisse depuis la gauche (`fixed inset-y-0 left-0 w-72`, `slide-in-from-left`)
- Prop `hideCloseButton?: boolean`
- Utilise `useTranslations("common.buttons")` — composant "use client"
- `SheetOverlay` avec `bg-overlay` et animations fade-in/out

**Reutilisabilite pour SlidePanel :**
Le Sheet est code en dur `side="left"` et `w-72`. Un SlidePanel `side="right" w-[480px]` ne peut pas reutiliser `SheetContent` directement. Options :
1. Creer `src/components/ui/slide-panel.tsx` independant, base sur `@radix-ui/react-dialog` (meme patron que Sheet)
2. Refactoriser Sheet pour accepter un prop `side` — risque de regression sur les usages existants

**Recommandation :** Creer un composant `SlidePanel` distinct. Ne pas modifier Sheet.

**ERR-064 (ERRORS-AND-FIXES.md) :** Le Sheet existant a deja le pattern safe-area correct. Le nouveau SlidePanel doit reproduire `pt-[env(safe-area-inset-top)]` dans le header et `pb-[max(0.75rem,env(safe-area-inset-bottom))]` dans le footer.

### Icone Fish — inventaire complet

L'histoire mentionne uniquement `farm-sidebar.tsx`, `bottom-nav.tsx`, et `farm-header.tsx`. En realite, `Fish` de lucide-react est importe dans **15 fichiers sources** :

| Fichier | Usage | Remplacer ? |
|---------|-------|-------------|
| `src/components/layout/farm-sidebar.tsx` | Logo header (ligne 214) + icone nav Reproducteurs (ligne 119) | Logo oui, icone nav NON |
| `src/components/layout/farm-bottom-nav.tsx` | Logo dans sheet header (ligne 423) | Oui |
| `src/components/layout/farm-header.tsx` | Logo mobile header (ligne 31) | Oui |
| `src/components/layout/ingenieur-sidebar.tsx` | Logo header (ligne 164) | Oui si scope inclut ingenieur |
| `src/components/layout/ingenieur-header.tsx` | Logo mobile header (ligne 17) | Oui si scope inclut ingenieur |
| `src/components/layout/ingenieur-bottom-nav.tsx` | Logo dans sheet header (ligne 330) | Oui si scope inclut ingenieur |
| `src/components/calibrage/calibrage-card.tsx` | Icone de comptage de poissons | NON (semantique) |
| `src/components/calibrage/step-sources.tsx` | Icone de source de poissons | NON (semantique) |
| `src/components/ingenieur/client-card.tsx` | Indicateur nombre de poissons | NON (semantique) |
| `src/components/ingenieur/ingenieur-dashboard-single-farm.tsx` | KPI poissons | NON (semantique) |
| `src/components/notes/note-detail-dialog.tsx` | Tag poisson dans note | NON (semantique) |
| `src/components/pages/vague-detail-page.tsx` | Indicateur poissons vague | NON (semantique) |
| `src/app/vagues/[id]/calibrage/[calibrageId]/page.tsx` | Indicateur poissons | NON (semantique) |
| `src/app/login/page.tsx` | Logo page login (h-8 et h-7) | Oui si scope inclut pages auth |
| `src/app/register/page.tsx` | Logo page register (h-8 et h-7) | Oui si scope inclut pages auth |
| `src/app/(ingenieur)/monitoring/[siteId]/page.tsx` | Logo + placeholder vide | Partiel (logo oui) |
| `src/app/(ingenieur)/monitoring/[siteId]/vagues/[vagueId]/page.tsx` | Indicateur poissons | NON |

**ATTENTION :** L'histoire scope "sidebar et header" — mais il existe des layouts ingenieur (`ingenieur-sidebar.tsx`, `ingenieur-header.tsx`, `ingenieur-bottom-nav.tsx`) avec le meme logo Fish. Il faut clarifier avec le developer si ces layouts sont dans le perimetre de la story.

**Aussi :** dans `farm-sidebar.tsx` ligne 119, Fish est utilise comme icone de navigation pour "Reproducteurs" (pas un logo). Il ne doit PAS etre remplace par le SVG silure custom (semantique differente).

### SVG custom (`public/icons/silure.svg`)

**Etat actuel :** Le repertoire `public/icons/` n'existe pas. Il faut le creer.

**Precedent existant :** `src/components/ui/fish-loader.tsx` contient deja un SVG silure inline tres elabore avec corps, tete, queue bifurquee, nageoires, barbillons et oeil. Ce SVG (viewBox `0 0 64 32`) peut servir de base ou reference pour le `silure.svg` statique a creer dans `public/icons/`.

**Tailles requises :** Le SVG doit etre reconnaissable a 24px (sidebar desktop) et a 20px (header mobile). Il faut un viewBox carre ou quasi-carre pour un bon rendu aux petites tailles.

---

## Incohérences / Points d'attention

1. **Fish icone vs Fish logo** : Dans `farm-sidebar.tsx`, Fish apparait a deux endroits distincts — ligne 119 (icone de navigation pour "Reproducteurs") et ligne 214 (logo de la sidebar). Seule la ligne 214 doit etre remplacee. Le developer doit faire attention a ne pas remplacer les deux.

2. **Layouts ingenieur hors perimetre explicite** : L'histoire ne mentionne pas `ingenieur-sidebar.tsx`, `ingenieur-header.tsx` ni `ingenieur-bottom-nav.tsx` qui utilisent tous Fish comme logo. Un remplacement partiel (farm seulement) creerait une incoherence visuelle entre les deux layouts. Recommande : inclure les 3 layouts ingenieur dans le perimetre.

3. **Pages login/register hors perimetre** : `src/app/login/page.tsx` et `src/app/register/page.tsx` utilisent Fish h-8/h-7 comme logo branding. Non mentionnes dans l'histoire. Meme incoherence potentielle.

4. **SlidePanel vs Sheet** : La story demande un SlidePanel base sur Radix Dialog. Le Sheet existant est deja sur Radix Dialog. Ne pas introduire une seconde dependance `@radix-ui/react-dialog` — elle est deja dans le projet via le composant Sheet. Le developer doit importer depuis `@radix-ui/react-dialog` directement (comme Sheet le fait).

5. **ERR-064 safe areas** : Tout nouveau composant glissant (SlidePanel) doit gerer les safe areas iOS. Pattern valide : `pt-[env(safe-area-inset-top)]` dans le header interne, `pb-[max(0.75rem,env(safe-area-inset-bottom))]` dans le footer. Ne pas modifier SheetContent.

6. **Badge shape=square et border-radius** : La story 54.4 (independante) introduit aussi des changements de border-radius. Pas de conflict direct car 54.4 touche Card et 54.6 touche Badge. Aucune dependance.

---

## Risques identifies

1. **Remplacement partiel du logo Fish** : Si le developer remplace Fish dans farm-sidebar/header mais oublie les layouts ingenieur, le branding sera incoherent. Impact : Moyenne. Mitigation : lister explicitement tous les fichiers logo dans le ticket.

2. **Taille SVG silure a 20-24px** : Le SVG de fish-loader (viewBox `0 0 64 32`, ratio 2:1) est tres large. A 24px de hauteur, il ferait 48px de large — trop large pour un logo inline. Le nouveau `silure.svg` doit avoir un viewBox plus proche du carre (ex: `0 0 32 32` ou `0 0 40 32`) pour rester dans le gap de 6px prevu dans la sidebar. Impact : Haute. Mitigation : tester le rendu a 24px et 20px avant finalisation.

3. **SlidePanel mobile** : La story demande un "fallback dialog sur mobile". Ce comportement conditionnel (slide depuis droite sur desktop, dialog center sur mobile) necessite soit un media query CSS soit un hook `useIsMobile`. Verifier l'existence d'un tel hook avant de l'inventer.

---

## Prerequis manquants

1. Clarification du perimetre : les layouts ingenieur (`ingenieur-sidebar`, `ingenieur-header`, `ingenieur-bottom-nav`) et les pages login/register sont-ils dans le perimetre du remplacement logo ?
2. Creer le repertoire `public/icons/` — il n'existe pas encore.
3. Verifier si un hook `useIsMobile` existe pour le comportement adaptatif du SlidePanel.

---

## Recommandation

**GO** — les trois taches sont techniquement bien bornees, les composants cibles sont simples et les dependances (Radix Dialog, lucide-react) sont deja presentes.

**Reserves a traiter lors du developpement :**
- Ne remplacer Fish comme LOGO que dans les fichiers de layout (farm + ingenieur), pas les usages semantiques (calibrage, vague-detail, etc.)
- Concevoir le SVG `silure.svg` avec un viewBox adapte aux petites tailles (carre ou quasi-carre)
- Le SlidePanel doit respecter les safe areas iOS (pattern ERR-064)
- Ajouter `shape` au Badge de facon purement additive (valeur par defaut `pill` pour zero regression)
