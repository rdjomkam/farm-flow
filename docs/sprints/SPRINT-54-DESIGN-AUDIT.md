# Sprint 54 — Design Audit Polish

> **Objectif :** Appliquer les 7 correctifs prioritaires identifies par l'audit design (`docs/analysis/design-audit-review.md`). Pas de breaking changes — polish uniquement (typographie, couleurs, animations, layout, accessibilite, composants, meta).

| Story | Titre | Type | Pipeline (docs/PROCESSES.md) | Priorite | Depend de | Statut |
|-------|-------|------|------------------------------|----------|-----------|--------|
| 54.1 | Typography Polish | UI | `@pre-analyst → @developer → @tester → @code-reviewer` | Haute | -- | `FAIT` |
| 54.2 | Color & Shadow Refinement | UI | `@pre-analyst → @developer → @tester → @code-reviewer` | Moyenne | -- | `FAIT` |
| 54.3 | Hover & Motion Upgrades | UI | `@pre-analyst → @developer → @tester → @code-reviewer` | Haute | -- | `FAIT` |
| 54.4 | Layout & Spacing Fixes | UI | `@pre-analyst → @developer → @tester → @code-reviewer` | Moyenne | -- | `FAIT` |
| 54.5 | Semantic HTML & Accessibility | UI | `@pre-analyst → @developer → @tester → @code-reviewer` | Haute | -- | `FAIT` |
| 54.6 | Component Pattern Upgrades | UI | `@pre-analyst → @developer → @tester → @code-reviewer` | Moyenne | -- | `FAIT` |
| 54.7 | Meta & 404 Page | UI | `@pre-analyst → @developer → @tester → @code-reviewer` | Moyenne | -- | `FAIT` |
| 54.8 | Tests & Review Sprint 54 | REVIEW | `@code-reviewer → @knowledge-keeper` | Haute | 54.1–54.7 | `FAIT` |

**Parallelisation :** Stories 54.1 a 54.7 n'ont AUCUNE dependance entre elles et peuvent toutes tourner en parallele. Story 54.8 tourne en dernier.

**Chaque story suit le pipeline de son type (voir `docs/PROCESSES.md`) :**
- Type **UI** : `@pre-analyst → @developer → @tester → @code-reviewer` (4 etapes sequentielles)
- Type **REVIEW** : `@code-reviewer → @knowledge-keeper` (2 etapes sequentielles)

**Regles transversales :**
- Chaque agent lit `CLAUDE.md` + `docs/knowledge/ERRORS-AND-FIXES.md` avant de travailler
- Chaque agent execute `npm run build` + `npx vitest run` apres avoir code
- `@status-updater` met a jour les statuts (jamais d'edition directe de TASKS.md)

---

## Story 54.1 — Typography Polish (tabular nums, text-wrap, display text)
**Type :** UI | **Pipeline :** `@pre-analyst → @developer → @tester → @code-reviewer` | **Depend de :** — | **Statut :** `FAIT` | **Priorite :** Haute

**Description :** Ajouter `font-variant-numeric: tabular-nums` sur les elements numeriques (KPI, donnees financieres), `text-wrap: balance` sur les headings, et une classe utilitaire `.display-text` pour les titres hero.

**Fichier(s) a modifier :**
- `src/app/globals.css` — ajouter regles `tabular-nums` sur `.font-mono` et headings `text-wrap: balance`, classe `.display-text`
- `src/components/ui/kpi-card.tsx` — ajouter `tabular-nums` sur les valeurs numeriques
- `src/components/ui/card.tsx` — ajuster styles titres si besoin

**Taches :**
- [ ] `TODO` Ajouter `font-variant-numeric: tabular-nums` globalement pour elements `.font-mono` et KPI values
- [ ] `TODO` Ajouter `text-wrap: balance` sur `h1`, `h2`, `h3`
- [ ] `TODO` Creer classe `.display-text` (font-weight: 300, letter-spacing: -0.02em)
- [ ] `TODO` Verifier alignement des chiffres dans les listes et cartes KPI

**Criteres d'acceptation :**
- Les chiffres sont alignes en colonnes dans les KPI et tableaux
- Les titres longs ne laissent pas de mots orphelins sur mobile 360px
- `npm run build` OK, aucune regression visuelle

---

## Story 54.2 — Color & Shadow Refinement (tinted shadows, grain overlay, palette cleanup)
**Type :** UI | **Pipeline :** `@pre-analyst → @developer → @tester → @code-reviewer` | **Depend de :** — | **Statut :** `FAIT` | **Priorite :** Moyenne

**Description :** Teinter les ombres des cartes avec la couleur primaire (teal), ajouter un overlay grain subtil sur le body, et reduire la palette d'accents de 12 a 7 couleurs utiles.

**Fichier(s) a modifier :**
- `src/app/globals.css` — modifier `--shadow-card` et `--shadow-elevated` avec teinte primaire, ajouter `body::before` grain overlay, supprimer accents inutilises (pink, yellow, indigo, green doublons)

**Taches :**
- [ ] `TODO` Teinter les ombres cartes : `rgb(13 148 136 / 0.04)` au lieu de `rgb(0 0 0 / 0.03)`
- [ ] `TODO` Ajouter grain noise overlay sur body (opacity 0.015, pointer-events none, z-index 9999)
- [ ] `TODO` Reduire palette accents a 7 : blue, amber, emerald, red, purple, orange, cyan
- [ ] `TODO` Verifier qu'aucun composant n'utilise les accents supprimes avant de les retirer

**Criteres d'acceptation :**
- Les ombres ont une teinte chaude visible subtile
- Le grain overlay est imperceptible sauf en regardant attentivement
- Aucun composant ne casse suite a la suppression d'accents
- `npm run build` OK

---

## Story 54.3 — Hover & Motion Upgrades (smooth scroll, transitions, stagger animations)
**Type :** UI | **Pipeline :** `@pre-analyst → @developer → @tester → @code-reviewer` | **Depend de :** — | **Statut :** `FAIT` | **Priorite :** Haute

**Description :** Ajouter `scroll-behavior: smooth`, upgrader les transitions boutons de `transition-colors` a `transition-all`, creer des animations d'entree staggered pour les listes de cartes, et ameliorer le hover des graphiques Recharts.

**Fichier(s) a modifier :**
- `src/app/globals.css` — ajouter `scroll-behavior: smooth` sur `html`, creer keyframe `fade-in-up` et classe `.stagger-children`
- `src/components/ui/button.tsx` — remplacer `transition-colors` par `transition-all duration-200`
- Composants Recharts (charts dashboard) — ajouter `activeDot` avec glow sur les `<Line>`

**Taches :**
- [ ] `TODO` Ajouter `scroll-behavior: smooth` sur `html` dans globals.css
- [ ] `TODO` Upgrader transition boutons : `transition-all duration-200`
- [ ] `TODO` Creer animation staggered (fade-in-up, 50ms delay par enfant, jusqu'a 12 items)
- [ ] `TODO` Ajouter `activeDot={{ r: 6, stroke: "var(--primary)", strokeWidth: 2, fill: "white" }}` sur les Line charts
- [ ] `TODO` Respecter `prefers-reduced-motion` pour les animations

**Criteres d'acceptation :**
- Le scroll entre sections est fluide
- Les boutons ont une transition smooth sur hover (shadow + couleur)
- Les cartes de liste apparaissent avec un leger decalage progressif
- Les points de donnees Recharts ont un glow au hover
- `npm run build` OK

---

## Story 54.4 — Layout & Spacing Fixes (max-width, KPI grid, optical padding)
**Type :** UI | **Pipeline :** `@pre-analyst → @developer → @tester → @code-reviewer` | **Depend de :** — | **Statut :** `FAIT` | **Priorite :** Moyenne

**Description :** Ajouter un conteneur `max-w-7xl mx-auto` sur le contenu principal pour les ecrans ultrawide, ameliorer la grille KPI (premier KPI en col-span-2), ajuster le padding optique des cartes, et varier les border-radius.

**Fichier(s) a modifier :**
- `src/components/layout/app-shell.tsx` — ajouter `max-w-7xl mx-auto` wrapper sur le contenu `<main>`
- `src/components/dashboard/stats-cards.tsx` — premier KPI `lg:col-span-2`
- `src/components/ui/card.tsx` — ajuster padding `pb-5 pt-4` pour balance optique, `rounded-2xl` sur page-level
- Composants internes (badges, form sections) — `rounded-lg` au lieu de `rounded-xl`

**Taches :**
- [ ] `TODO` Ajouter `max-w-7xl mx-auto` dans app-shell.tsx sur le contenu principal
- [ ] `TODO` Rendre le premier KPI `lg:col-span-2` dans stats-cards.tsx
- [ ] `TODO` Ajuster Card padding : `pb-5` (20px) vs `pt-4` (16px) pour balance optique
- [ ] `TODO` Varier border-radius : `rounded-lg` inner, `rounded-xl` cards, `rounded-2xl` page-level

**Criteres d'acceptation :**
- Le contenu ne s'etire plus sur toute la largeur en ultrawide (>1280px)
- Le KPI principal est visuellement proeminent en desktop
- Les cartes ont un meilleur equilibre visuel vertical
- `npm run build` OK, aucune regression mobile

---

## Story 54.5 — Semantic HTML & Accessibility (skip-link, semantic lists, figure charts)
**Type :** UI | **Pipeline :** `@pre-analyst → @developer → @tester → @code-reviewer` | **Depend de :** — | **Statut :** `FAIT` | **Priorite :** Haute

**Description :** Ajouter un lien skip-to-content pour les utilisateurs clavier, convertir les listes de cartes en `<ul>/<li>` semantiques, rendre le composant Card polymorphique (`as="article"`), et wrapper les charts dans `<figure>/<figcaption>`.

**Fichier(s) a modifier :**
- `src/components/layout/app-shell.tsx` ou `src/app/layout.tsx` — ajouter skip-to-content link + `id="main-content"` sur `<main>`
- `src/components/ui/card.tsx` — ajouter prop `as?: "article" | "section" | "div"` (polymorphique)
- `src/components/vagues/vagues-list-client.tsx` — wrapper cards dans `<ul role="list">` + `<li>`
- `src/components/releves/releves-global-list.tsx` — idem
- `src/components/ventes/ventes-list-client.tsx` — idem
- Composants charts — wrapper dans `<figure>` + `<figcaption>`

**Taches :**
- [ ] `TODO` Ajouter skip-to-content link : `<a href="#main-content" className="sr-only focus:not-sr-only ...">Aller au contenu principal</a>`
- [ ] `TODO` Ajouter `id="main-content"` sur l'element `<main>`
- [ ] `TODO` Ajouter prop `as` polymorphique au composant Card
- [ ] `TODO` Convertir les card lists en `<ul role="list">` + `<li>` (vagues, releves, ventes)
- [ ] `TODO` Wrapper les composants chart dans `<figure>` + `<figcaption>`

**Criteres d'acceptation :**
- Le skip link est visible au focus clavier et amene au contenu principal
- Les listes de cartes sont semantiquement correctes (testable avec un lecteur d'ecran)
- Les charts sont dans des `<figure>` avec une legende descriptive
- `npm run build` OK, aucune regression

---

## Story 54.6 — Component Pattern Upgrades (badge variants, slide panel, custom logo)
**Type :** UI | **Pipeline :** `@pre-analyst → @developer → @tester → @code-reviewer` | **Depend de :** — | **Statut :** `FAIT` | **Priorite :** Moyenne

**Description :** Ajouter une variante `rounded-md` (square) au composant Badge pour les indicateurs de statut, creer un composant SlidePanel pour les flux de creation desktop, et remplacer l'icone Fish generique par un SVG silure custom pour le branding.

**Fichier(s) a modifier/creer :**
- `src/components/ui/badge.tsx` — ajouter variante `shape?: "pill" | "square"` (pill = rounded-full par defaut, square = rounded-md)
- `src/components/ui/slide-panel.tsx` — CREER : composant base sur Radix Dialog, `side="right"`, `w-[480px]`, pour les flux creation desktop
- `src/components/layout/farm-sidebar.tsx` — remplacer icone Fish par SVG silure custom
- `src/components/layout/bottom-nav.tsx` — idem si logo present
- `public/icons/silure.svg` — CREER : SVG silhouette silure (catfish)

**Taches :**
- [ ] `TODO` Ajouter variante `shape` au Badge (pill par defaut, square = rounded-md)
- [ ] `TODO` Creer composant SlidePanel (Radix Dialog, side="right", w-[480px], avec overlay)
- [ ] `TODO` Creer SVG silure custom dans public/icons/
- [ ] `TODO` Remplacer icone Fish par le SVG custom dans sidebar et header

**Criteres d'acceptation :**
- Les badges statut peuvent etre carres (rounded-md) ou pills
- Le SlidePanel s'ouvre par la droite sur desktop, fallback dialog sur mobile
- Le logo silure est distinctif et reconnaissable a 24px et 32px
- `npm run build` OK

---

## Story 54.7 — Meta & 404 Page (OG tags, custom not-found)
**Type :** UI | **Pipeline :** `@pre-analyst → @developer → @tester → @code-reviewer` | **Depend de :** — | **Statut :** `FAIT` | **Priorite :** Moyenne

**Description :** Ajouter les tags Open Graph et Twitter Card dans les metadata du layout root, et creer une page 404 custom brandee avec le FishLoader.

**Fichier(s) a modifier/creer :**
- `src/app/layout.tsx` — ajouter `openGraph` et `twitter` dans l'objet `metadata`
- `src/app/not-found.tsx` — CREER : page 404 avec FishLoader, message en francais, lien retour dashboard

**Taches :**
- [ ] `TODO` Ajouter metadata Open Graph : type, locale fr_CM, siteName, title, description
- [ ] `TODO` Ajouter metadata Twitter Card : card summary, title, description
- [ ] `TODO` Creer `src/app/not-found.tsx` avec FishLoader, titre "Page introuvable", bouton retour dashboard
- [ ] `TODO` Styliser la page 404 mobile-first, centree, brandee

**Criteres d'acceptation :**
- Les liens partages affichent un apercu OG correct (titre + description)
- La page 404 est brandee avec le FishLoader et un CTA retour
- `npm run build` OK
- La page 404 s'affiche correctement sur mobile 360px

---

## Story 54.8 — Tests & Review Sprint 54
**Type :** REVIEW | **Pipeline :** `@code-reviewer → @knowledge-keeper` | **Depend de :** 54.1–54.7 | **Statut :** `FAIT` | **Priorite :** Haute

**Taches :**
- [ ] `TODO` `npm run build` — Build production OK
- [ ] `TODO` `npx vitest run` — Tous les tests passent
- [ ] `TODO` Test visuel mobile (360px) — typographie, ombres, animations, layout
- [ ] `TODO` Test accessibilite — skip link fonctionne, semantic HTML correct
- [ ] `TODO` Verifier checklist R1-R9
- [ ] `TODO` Ecrire `docs/reviews/review-sprint-54.md`
- [ ] `TODO` `@knowledge-keeper` extrait les erreurs recurrentes dans ERRORS-AND-FIXES.md

**Criteres d'acceptation :**
- Zero regression sur les tests existants
- Build production OK
- Skip-to-content link fonctionne au clavier
- Les animations respectent `prefers-reduced-motion`
- Page 404 brandee et fonctionnelle
