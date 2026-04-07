# Pre-analyse Story 54.4 — Layout & Spacing Fixes

**Date :** 2026-04-07
**Auteur :** @pre-analyst
**Story :** 54.4 — Layout & Spacing Fixes (max-width, KPI grid, optical padding, border-radius)

---

## Statut : GO AVEC RESERVES

## Résumé

Les 4 tâches de la story sont implémentables sans risque de breaking change pour la logique métier. Les modifications sont purement CSS/layout. La seule réserve est l'ampleur des changements de `rounded-xl` (151 occurrences dans 70 fichiers) qui dépasse largement le scope de la story — la story doit cibler uniquement les composants internes (badge, form-section), pas une refonte globale.

---

## Vérifications effectuées

### Schema ↔ Types : N/A
Story purement UI — pas de modification de schéma ou de types.

### API ↔ Queries : N/A
Aucune API touchée.

### Navigation ↔ Permissions : N/A
Aucune navigation touchée.

### Build : ECHEC ENVIRONNEMENT (non lié à la story)

La commande `npm run build` echoue systématiquement avec `exit code 143` (SIGTERM externe) ou `Unable to acquire lock` dû à un conflit de processus dans l'environnement CI. Le compilateur TypeScript (`npx tsc --noEmit`) confirme que les seules erreurs existantes sont :

1. **Fichiers test** (`src/__tests__/activity-engine/api/regles-activites.test.ts`) : erreurs `vi`, `describe`, `expect` non reconnus — vitest globals manquants dans tsconfig. Erreurs pre-existantes, non liées à 54.4.
2. **Fichiers `.next/types`** : erreurs TS6053 "file not found" car le build n'a pas été exécuté au moins une fois depuis le dernier reset. Pre-existantes, non liées à 54.4.
3. **Aucune erreur dans les fichiers source applicatifs** hors tests.

Conclusion : le code source est TypeScript-valide. Le build est bloqué par l'environnement, pas par le code.

### Tests : Non exécutables (même cause de lock)
Les tests vitest ne peuvent pas être lancés dans l'environnement actuel. Les erreurs TS connues dans les tests sont pre-existantes (sprint précédent).

---

## Etat actuel des fichiers cibles

### 1. `src/components/layout/app-shell.tsx`

**Structure actuelle du `<main>` :**
```tsx
<main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
  {children}
</main>
```

Observation : Le `<main>` n'a **aucun wrapper `max-w-*`**. Le contenu s'etend sur toute la largeur disponible quelle que soit la résolution. La fix consiste à ajouter un `div` interne avec `max-w-7xl mx-auto w-full` autour de `{children}`.

**Deux layouts concernés** :
- Ingénieur (lignes 52-80)
- Farm — ADMIN/GERANT/PISCICULTEUR (lignes 86-114)

Les deux `<main>` sont structurellement identiques et doivent recevoir le même wrapper.

### 2. `src/components/dashboard/stats-cards.tsx`

**Grid actuel :**
```tsx
<div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 lg:grid-cols-4">
```

Observation : La grille passe à 4 colonnes égales sur `lg`. La story demande que le premier KPI reçoive `lg:col-span-2`, ce qui implique de changer la grille en `lg:grid-cols-5` (pour que col-span-2 + 3 items en col-span-1 = 5 colonnes), ou de restructurer en 2 rangées. Attention : l'implémentation exacte (grille 5 colonnes vs 3+1 disposition) doit être précisée par le développeur.

**Composant utilisé :** `KPICard` (dans `src/components/ui/kpi-card.tsx`), rendu dans une `div` wrapper individuelle avec animation `animate-fade-in-up`.

### 3. `src/components/ui/card.tsx`

**Etat actuel :**
- `Card` : `rounded-xl` + `border border-border bg-card`
- `CardHeader` : `p-4` (uniform)
- `CardContent` : `p-4 pt-0` (uniform)
- `CardFooter` : `p-4 pt-0`

**Changements demandés :**
- Padding `pb-5` / `pt-4` pour balance optique dans CardContent ou CardHeader
- Radius `rounded-2xl` au niveau page-level (actuellement `rounded-xl`)

La modification du radius sur `Card` de `rounded-xl` → `rounded-xl` (cards) avec `rounded-2xl` pour page-level suggère une variante ou un prop `size="page"`. A préciser : soit on garde `rounded-xl` sur Card et les appelants utilisent un wrapper `rounded-2xl`, soit on ajoute un prop.

### 4. `src/components/ui/badge.tsx`

**Etat actuel :**
```tsx
"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
```
Badge utilise `rounded-full` (pill) sans variante shape. La story 54.4 demande `rounded-lg` pour les composants internes — mais la story 54.6 (Component Pattern Upgrades) demande explicitement d'ajouter un prop `shape?: "pill" | "square"` avec `rounded-md` pour square.

**Risque de conflit** : Story 54.4 et 54.6 touchent toutes deux `badge.tsx`. La 54.4 demande `rounded-lg` sur les badges internes, la 54.6 demande une variante `shape`. Ces deux stories sont censées tourner en parallèle, ce qui crée un conflit de merge potentiel.

### 5. `src/components/ui/form-section.tsx`

**Etat actuel :**
```tsx
<div className="rounded-xl bg-surface-2 p-4 space-y-3">
```
Utilise `rounded-xl`. La story demande `rounded-lg` sur les composants internes (inner). Ce changement est minimal et sans risque.

---

## Portée des changements border-radius

**`rounded-xl` :** 151 occurrences dans 70 fichiers source.
**`rounded-2xl` :** 12 occurrences dans 8 fichiers source (surtout auth pages et skeletons).

La story 54.4 ne doit PAS refactoriser toutes les occurrences de `rounded-xl`. Seuls les fichiers explicitement cités dans le sprint document sont concernés :
- `src/components/ui/card.tsx` (1 occurrence — `Card` root)
- `src/components/ui/badge.tsx` (0 occurrence de `rounded-xl`, utilise `rounded-full`)
- `src/components/ui/form-section.tsx` (1 occurrence)

La portée réelle est donc **3 occurrences dans 3 fichiers UI**, plus le `app-shell.tsx` et `stats-cards.tsx`. Total : 5 fichiers.

---

## Incohérences trouvées

### 1. Conflit potentiel badge.tsx entre 54.4 et 54.6

Story 54.4 demande `rounded-lg` sur les badges internes ; story 54.6 demande un prop `shape` sur Badge. Les deux stories sont marquées comme parallélisables mais touchent le même fichier. Le développeur de 54.4 doit se limiter à changer la classe de `rounded-full` → `rounded-lg` dans la base, tandis que 54.6 ajoutera la variante `shape`. Risque de conflit git si les deux stories sont committées sans coordination.

**Suggestion :** Le développeur 54.4 NE modifie PAS badge.tsx et laisse la refonte complète à 54.6 qui couvre le même besoin de manière plus structurée.

### 2. Ambiguïté sur la grille KPI col-span-2

La story demande `lg:col-span-2` sur le premier KPI sans préciser comment la grille doit s'adapter. Avec 4 KPI et un col-span-2 sur le premier, la grille `lg:grid-cols-4` produirait un layout asymétrique (premier KPI = 2 cols, les 3 suivants = 1 col chacun = 5 cols total, overflow). La grille doit passer à `lg:grid-cols-5` ou une approche différente.

### 3. max-w-7xl dans app-shell : impact sur les pages avec leur propre padding

Certaines pages utilisent déjà `px-4`, `mx-auto`, ou `max-w-*` dans leur propre layout. Ajouter un wrapper `max-w-7xl` dans `app-shell` pourrait créer une double contrainte de largeur (le wrapper + les pages individuelles). Il faudra vérifier que le wrapper `max-w-7xl` dans app-shell n'entre pas en conflit avec des pages qui appliquent leur propre `max-w-*`.

---

## Risques identifiés

### Risque 1 — Regression mobile sur le wrapper max-w-7xl (Moyen)

Sur mobile (360px), `max-w-7xl mx-auto` est transparent (écran < 1280px, donc la contrainte ne s'applique pas). Aucun risque mobile direct. Cependant, si le wrapper `max-w-7xl` est appliqué sans `w-full`, il peut créer un shrink involontaire sur les écrans intermédiaires si le parent n'a pas de `flex-1` ou `w-full` explicite.

**Mitigation :** Utiliser `max-w-7xl mx-auto w-full` comme wrapper interne du `<main>`.

### Risque 2 — KPI grid col-span-2 sur mobile (Moyen)

Sur mobile, la grille est `grid-cols-1` puis `min-[400px]:grid-cols-2`. Un `lg:col-span-2` n'affecte que lg+. Aucun risque mobile. Sur `min-[400px]:grid-cols-2`, le premier item en col-span-2 occuperait toute la largeur, ce qui peut être souhaitable (item proéminent) ou non.

**Mitigation :** Confirmer que le col-span-2 est uniquement `lg:col-span-2` (pas md ou sm).

### Risque 3 — Card padding asymetrique pb-5/pt-4 (Bas)

Changer `p-4` en `pb-5 pt-4` dans `CardContent` affecte tous les composants utilisant `<CardContent>`. Il y a environ 50+ usages de `CardContent` dans le projet. Le risque de régression visuelle est réel mais l'impact métier est nul.

**Mitigation :** Utiliser un prop `optical?: boolean` sur `CardContent` pour ne modifier que les cartes qui le demandent explicitement, plutôt que changer la valeur par défaut globalement.

---

## Prerequis manquants

Aucun prérequis bloquant. Tous les fichiers cibles existent et sont syntaxiquement corrects.

---

## Recommandation

**GO** — avec les reserves suivantes transmises au développeur :

1. **Ne pas modifier `badge.tsx` dans 54.4** — laisser ce travail à 54.6 (Component Pattern Upgrades) qui couvre le même besoin de façon plus complète avec la variante `shape`.

2. **Grille KPI :** Passer à `lg:grid-cols-5` pour accommoder `lg:col-span-2` sur le premier item (2 + 1 + 1 + 1 = 5), ou conserver `lg:grid-cols-4` avec `lg:col-span-2` et retirer un KPI du dashboard — à décider avec le PM.

3. **max-w-7xl wrapper :** Appliquer dans les deux layouts (`INGENIEUR` et `FARM`) avec `max-w-7xl mx-auto w-full` comme div interne du `<main>`, pas en remplaçant les classes du `<main>` lui-même (pour préserver le `pb-[calc(...)]` du bottom nav mobile).

4. **Card padding :** Préférer une modification ciblée (prop optionnel ou classe utilitaire) plutôt qu'un changement de la valeur par défaut globale de `CardContent`.

5. **Portee border-radius :** Se limiter aux 3 fichiers UI cités (`card.tsx`, `form-section.tsx`) — ne pas toucher les 151 autres occurrences de `rounded-xl` dans le projet.
