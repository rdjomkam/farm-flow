# Verification BUG-047 — Safari iOS safe-area backdrops (top + bottom)

**Date :** 2026-05-03
**Verificateur :** @tester
**Bug :** BUG-047 — Bandes safe-area haut et bas transparentes sur Safari iOS (non-PWA)
**Statut du fix :** VERIFIE

---

## 1. Lecture BUG-047.md

Le fichier `docs/bugs/BUG-047.md` confirme :
- Severite : Haute
- Cause racine documentee : `html::after { bottom: 0 }` insuffisant quand Safari anime la URL bar (inset->0 transitoire) ; absence de `html::before` pour les pages sans FarmHeader (login, select-site, erreurs)
- Fix attendu : `html::before` (z-49) pour le haut, `html::after` etendu a `bottom: -60px` / `height: calc(env(safe-area-inset-bottom) + 60px)` pour le bas
- Statut dans le fichier : CORRIGE

---

## 2. Audit CSS — src/app/globals.css (lignes 121-163)

### Confinement au media query mobile

Les deux pseudo-elements sont DANS `@media (max-width: 767px)` (ligne 139). Ils ne s'appliquent donc pas sur desktop (>= 768px). Conforme.

### html::before (lignes 140-150)

| Propriete | Valeur | Attendu | OK |
|-----------|--------|---------|-----|
| position | fixed | fixed | oui |
| top | 0 | 0 | oui |
| height | env(safe-area-inset-top) | env(safe-area-inset-top) | oui |
| background | var(--card) | var(--card) — pas de couleur en dur (R6) | oui |
| pointer-events | none | none — pas d'interception clic | oui |
| z-index | 49 | 49 (sous header z-50, au-dessus du contenu) | oui |

### html::after (lignes 152-162)

| Propriete | Valeur | Attendu | OK |
|-----------|--------|---------|-----|
| position | fixed | fixed | oui |
| bottom | -60px | valeur negative (absorbe frames glitch Safari) | oui |
| height | calc(env(safe-area-inset-bottom) + 60px) | buffer 60px minimum | oui |
| background | var(--card) | var(--card) — pas de couleur en dur (R6) | oui |
| pointer-events | none | none — pas d'interception clic | oui |
| z-index | 39 | 39 (sous bottom-nav z-40) | oui |

Toutes les proprietes sont correctes.

---

## 3. Audit tests — bottom-nav.test.tsx

### Structure des tests

Le fichier contient 3 describe blocks :

- `BUG-043 — Bottom nav variants apply safe-area padding + GPU layer hint` : 3 tests (FarmBottomNav, IngenieurBottomNav, BottomNavSkeleton)
- `BUG-043 — globals.css mobile safe-area backdrop (bottom)` : 1 test (regression CSS bas)
- `BUG-047 — globals.css safe-area backdrops (top + extended bottom)` : 7 tests

### Couverture des 7 tests BUG-047

| Test | Assertion | OK |
|------|-----------|-----|
| html::before exists | `cssNoComments.toMatch(/html::before/)` | oui |
| html::before uses position: fixed | extrait le bloc, verifie `position:\s*fixed` | oui |
| html::before is pinned to top (top: 0) | verifie `top:\s*0` | oui |
| html::before covers safe-area-inset-top height | verifie `height:\s*env(safe-area-inset-top)` | oui |
| html::before uses var(--card) background | verifie `background:\s*var(--card)` | oui |
| html::before sits at z-index 49 | verifie `z-index:\s*49` | oui |
| html::after extends 60px past viewport | verifie `bottom:\s*-\d+px` + `height:\s*calc(env(safe-area-inset-bottom)\s*\+\s*\d+px)` | oui |

### Lacune mineure identifiee

Les tests BUG-047 ne verifient pas explicitement `pointer-events: none` sur `html::before` ni sur `html::after`. Cette propriete est presente dans le CSS (verifiee manuellement lignes 148 et 160) mais n'est pas couverte par un test automatique. La regression est peu probable (propriete simple), mais une assertion supplementaire renforcerait la couverture.

---

## 4. Resultats des tests automatises

### Test unitaire cible

```
npx vitest run src/components/layout/__tests__/bottom-nav.test.tsx
```

Resultat : **11/11 tests passes** (4 BUG-043 + 7 BUG-047)
Duree : 301ms

### Suite complete

```
npx vitest run
```

Resultat :
- Test Files : 5 failed | 155 passed (160)
- Tests : **37 failed | 4944 passed** | 26 todo (5007)

Les 37 echecs sont identiques a la baseline pre-existante (rapportee dans BUG-047.md). Aucun nouvel echec introduit par le fix.

---

## 5. Build production

```
npx next build --webpack
```

Resultat : **Build OK** — compilation Next.js sans erreur TypeScript ni erreur de lint.
Un avertissement pre-existant `outputFileTracingRoot` (workspace root inference) est present mais sans rapport avec ce fix.

Note : `npm run build` inclut `prisma migrate deploy` qui echoue en environnement dev (schema non base-line en prod) — ceci est un comportement connu du setup dev, pas lie au fix.

---

## 6. Audit d'occurrences

```
grep -rn "html::before" src/
```
- `src/app/globals.css` ligne 140 : la declaration CSS (1 occurrence dans le code de production)
- `src/components/layout/__tests__/bottom-nav.test.tsx` : occurrences uniquement dans les assertions de test

```
grep -rn "html::after" src/
```
- `src/app/globals.css` ligne 152 : la declaration CSS (1 occurrence dans le code de production)
- `src/components/layout/__tests__/bottom-nav.test.tsx` : occurrences uniquement dans les assertions de test

Chaque pseudo-element n'est declare qu'une seule fois dans le code de production. Pas de doublon ni de conflit.

---

## 7. Verification browser

La verification browser (simulation insets, screenshot mobile Safari) n'a pas ete realisee dans cette session — le serveur de preview n'etait pas disponible dans l'environnement d'execution. La verification est donc limitee aux tests automatises et a l'audit statique du CSS.

Ce point ne bloque pas la validation : les tests automatises lisent le CSS source et verifient les proprietes critiques. La verification visuelle reste un complement recommande.

---

## Synthese

| Critere | Resultat |
|---------|---------|
| Fix verifie (CSS) | OUI |
| html::before dans @media mobile uniquement | OUI |
| html::after dans @media mobile uniquement | OUI |
| pointer-events: none sur les deux | OUI |
| z-index coherents (49 / 39) | OUI |
| Pas de couleur en dur (R6) | OUI |
| Tests BUG-047 : 7/7 passes | OUI |
| Suite complete : 37 echecs pre-existants, pas de nouveaux | OUI |
| Build Next.js | OK |
| Unicite des declarations CSS | OUI |
| Verification browser | NON REALISEE (serveur preview absent) |

### Concerns / Follow-ups

1. **pointer-events: none non teste** : ajouter une assertion dans le describe BUG-047 pour `html::before` et `html::after` afin de prevenir une regression sur cette propriete (risque faible mais cout d'ajout minimal).

2. **Verification browser manquante** : effectuer un test manuel sur Safari iOS (device ou simulateur) avec la technique d'injection CSS decrite dans le brief pour confirmer visuellement que les pseudo-elements sont bien rendus et qu'il n'y a pas de discontinuite sur /login.

3. **Side-effect /login** : non verifie automatiquement. Sur les pages sans FarmHeader, `html::before` avec `background: var(--card)` s'appliquera meme si le fond de la page utilise une autre variable CSS (ex. `bg-background`). Cela peut produire une bande coloree visible en haut si le theme du fond est different de `--card`. A valider visuellement sur /login, /settings/sites et les pages d'erreur.
