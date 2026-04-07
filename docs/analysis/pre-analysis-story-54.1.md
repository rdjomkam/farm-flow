# Pre-analyse Story 54.1 — Typography Polish — 2026-04-07

## Statut : GO AVEC RESERVES

## Resume
La story 54.1 est simple CSS/JSX sans interaction base de donnees ni logique metier. Les changements sont localises a `globals.css`, `kpi-card.tsx` et `card.tsx`. Le build actuel est casse par une erreur de type TypeScript preexistante dans `src/app/(farm)/bacs/[id]/page.tsx` — cette erreur est independante de la story 54.1 et doit etre signalée.

---

## Verifications effectuees

### Schema <-> Types : N/A
Story purement CSS/UI, aucun modele Prisma implique.

### API <-> Queries : N/A
Aucune route API modifiee.

### Navigation <-> Permissions : N/A
Aucun changement de navigation.

### Build : ECHEC (erreur preexistante, non liee a 54.1)

Erreur detectee dans `src/app/(farm)/bacs/[id]/page.tsx` ligne 36 :

```
Type error: Parameter 'a' implicitly has an 'any' type.
```

Cause : Le retour de `getBacWithAssignations` inclut `assignations` dont le type d'element n'est pas infere correctement par TypeScript (Prisma Client 7.4.2 avec `include` nested). La lambda `.some((a) => a.dateFin === null)` ne connait pas le type de `a`.

Ce bug preexiste a la story 54.1. Le @developer devra corriger cette erreur dans le meme PR ou s'assurer qu'elle est deja traitee en bug track avant de livrer 54.1 (le build doit passer).

### Tests : Non executes (build casse en amont)

---

## Etat actuel de la typographie (globals.css + composants)

### Ce qui existe deja

| Element | Etat actuel |
|---------|-------------|
| `font-variant-numeric: tabular-nums` | **Absent** de globals.css. Present en classes utilitaires Tailwind (`tabular-nums`) mais utilise de facon sporadique : 4 occurrences dans `fcr-transparency-dialog.tsx` et 1 dans `indicateurs-panel.tsx`. Absent de `kpi-card.tsx`. |
| `text-wrap: balance` | **Absent** de globals.css et de tous les composants. |
| Classe `.display-text` | **Absente**. |
| `font-mono` | Defini dans `@theme inline` via `--font-mono: var(--font-geist-mono)` mais aucune regle CSS globale ne lui applique `tabular-nums`. |
| Headings h1/h2/h3 | Aucun style global defini dans `globals.css`. Relies uniquement aux classes utilitaires Tailwind au niveau des composants. |
| CardTitle | `text-lg font-semibold leading-tight` — pas de `text-wrap`. |
| KPI value (`p.text-xl`) | `text-xl sm:text-2xl font-bold tracking-tight` — pas de `tabular-nums`. |

### Ce qui doit etre ajoute

1. **globals.css** :
   - Regle globale `font-variant-numeric: tabular-nums` sur `.font-mono` et eventuellement comme classe utilitaire globale pour les valeurs KPI
   - `text-wrap: balance` sur `h1, h2, h3`
   - Classe `.display-text` : `font-weight: 300; letter-spacing: -0.02em`

2. **kpi-card.tsx** :
   - Ajouter `tabular-nums` (classe Tailwind) sur la `<p>` qui rend `value` (ligne 33)

3. **card.tsx** :
   - `CardTitle` peut beneficier de `text-wrap: balance` si des titres longs apparaissent. La story indique "ajuster styles titres si besoin" — verification necessaire mais pas obligatoire.

---

## Risques identifies

### Risque 1 — Build casse preexistant (impact : BLOQUANT pour la livraison)
Fichier : `src/app/(farm)/bacs/[id]/page.tsx:36`
Le build TypeScript echoue avant meme la compilation. Si le @developer livre 54.1 sans corriger ce bug preexistant, le build restera rouge.
Mitigation : Soit corriger l'erreur dans le meme PR (ajouter un type explicite `(a: { dateFin: Date | null })` ou equivalent), soit s'assurer qu'un BUG ticket existe et qu'il est traite en parallele.

### Risque 2 — `text-wrap: balance` compatibilite navigateur
`text-wrap: balance` est supporte depuis Chrome 114, Firefox 121, Safari 17.4. Pas de risque pour les navigateurs modernes, mais c'est une propriete recente. Pas de fallback necessaire — les navigateurs plus anciens l'ignorent proprement.

### Risque 3 — Tailwind v4 et `font-variant-numeric`
Le projet utilise Tailwind v4 (`@import "tailwindcss"` dans globals.css). La classe utilitaire `tabular-nums` existe dans Tailwind v4 et correspond a `font-variant-numeric: tabular-nums`. Ajouter cette classe dans `kpi-card.tsx` est preferable a une regle CSS globale dans `globals.css` pour eviter des regressions sur des elements textuels non numeriques.

### Risque 4 — `.display-text` conflit de nom
Verifier qu'aucun composant n'utilise deja une classe `.display-text` avant de la creer.

---

## Incoherences trouvees

1. **Usage inconsistant de `tabular-nums`** : Utilise dans `fcr-transparency-dialog.tsx` et `indicateurs-panel.tsx` mais absent de `kpi-card.tsx` qui est le composant KPI principal. La story 54.1 corrige exactement ce manque.

2. **Aucune regle typographique globale pour les headings** : `globals.css` ne definit aucun style de base pour `h1/h2/h3`. Les styles sont entierement portes par les classes Tailwind dans chaque composant. L'ajout de `text-wrap: balance` en CSS global est la bonne approche (non-breaking).

---

## Prerequis manquants

1. **Bug TypeScript preexistant** dans `src/app/(farm)/bacs/[id]/page.tsx:36` doit etre corrige pour que `npm run build` passe. Suggestion de fix : typer explicitement le parametre `a` avec le type de retour de l'include Prisma, ou utiliser `bac.assignations.some((a: { dateFin: Date | null }) => a.dateFin === null)`.

---

## Perimetre exact de 54.1 (resume pour @developer)

| Fichier | Changement |
|---------|-----------|
| `src/app/globals.css` | Ajouter apres les animations : regle `h1, h2, h3 { text-wrap: balance; }` + classe `.display-text { font-weight: 300; letter-spacing: -0.02em; }` + regle `.font-mono { font-variant-numeric: tabular-nums; }` |
| `src/components/ui/kpi-card.tsx` | Ajouter classe `tabular-nums` sur la `<p>` value (ligne 33) |
| `src/components/ui/card.tsx` | Optionnel : ajouter `text-wrap: balance` sur `CardTitle` via classe Tailwind si disponible en v4, sinon via style inline ou CSS global |
| `src/app/(farm)/bacs/[id]/page.tsx` | Corriger l'erreur TypeScript preexistante (hors perimetre 54.1 mais bloquante pour le build) |

---

## Recommandation

**GO avec une reserve** : Les changements de la story 54.1 sont mineurs, localises et sans risque de regression fonctionnelle. Cependant, le build est actuellement casse par une erreur TypeScript preexistante dans `bacs/[id]/page.tsx`. Le @developer doit soit corriger ce bug en meme temps, soit confirmer qu'il est traite ailleurs avant que le @tester puisse valider le build.

Les 3 changements CSS/JSX de la story 54.1 sont independants de ce bug et peuvent etre implementes immediatement.
