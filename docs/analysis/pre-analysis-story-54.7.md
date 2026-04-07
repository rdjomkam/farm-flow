# Pré-analyse Story 54.7 — Meta & 404 Page

**Date :** 2026-04-07
**Sprint :** 54 — Design Audit Polish
**Analyste :** @pre-analyst

---

## Statut : GO

---

## Résumé

Le layout root dispose déjà d'une structure `generateMetadata` fonctionnelle mais incomplète : les balises `openGraph` et `twitter` sont absentes. Une page `src/app/not-found.tsx` existe déjà mais ne contient pas le `FishLoader` et n'est pas brandée. Le travail est bien délimité, sans risque de régression.

---

## Vérifications effectuées

### Schema ↔ Types : N/A
Story 54.7 ne touche pas au schéma Prisma ni aux types. Non applicable.

### API ↔ Queries : N/A
Aucune API route ni query impliquée. Non applicable.

### Navigation ↔ Permissions : N/A
La page `not-found.tsx` est hors du périmètre de navigation/permissions. Non applicable.

### Build : INDÉTERMINÉ (lock concurrente)
`npm run build` n'a pas pu s'exécuter jusqu'à son terme — un verrou `.next/lock` tenu par un processus concurrent (PID 95192, zombifié) bloquait tous les appels. Le TypeScript check (`npx tsc --noEmit`) ne remonte aucune erreur dans les fichiers sources non-test. Les erreurs TS visibles sont toutes dans `src/__tests__/activity-engine/` (vitest globals non typés) — problème pré-existant non lié à cette story.

**Recommandation :** le developer doit exécuter `npm run build` manuellement après ses modifications pour confirmer le statut final.

### Tests : Non exécutés (dépendance build)
`npx vitest run` n'a pas été tenté (le problème de build lock rendrait les résultats non fiables). Les tests unitaires sont indépendants de cette story (pas de logique métier modifiée).

---

## État actuel détaillé

### src/app/layout.tsx — Metadata existante

L'objet retourné par `generateMetadata()` (lignes 62–82) contient :

```
title.default = "FarmFlow"
title.template = "%s | FarmFlow"
description = t("appDescription") | fallback "Application de suivi d'élevage de silures"
manifest = "/manifest.json"
appleWebApp = { capable, statusBarStyle, title }
icons.apple = [180, 152, 120, default]
```

**Manquant :**
- `openGraph` : type, locale, siteName, title, description (aucune balise OG)
- `twitter` : card, title, description (aucune balise Twitter Card)
- Pas d'image OG (pas de `og:image` — un placeholder `icon-512.png` peut servir de fallback)

### src/app/not-found.tsx — État actuel

Le fichier existe à `/Users/ronald/project/dkfarm/farm-flow/src/app/not-found.tsx`.

Contenu actuel :
- Affiche le texte "404" (chiffres bruts, `text-5xl text-muted-foreground`)
- Texte i18n depuis `errors.page.notFoundTitle` et `errors.page.notFoundDescription`
- Bouton retour vers `/` via `common.accessDenied.backButton`
- **Pas de FishLoader**
- **Pas de branding visuel** (couleur primaire, logo)
- Structure basique, non brandée, non mobile-optimisée pour une page d'erreur

Il n'existe **pas** de `src/app/(farm)/not-found.tsx` (la glob n'a retourné aucun résultat).

### src/components/ui/fish-loader.tsx — API complète

```typescript
interface FishLoaderProps {
  size?: "sm" | "md" | "lg";  // défaut : "md"
  text?: string;               // texte affiché sous le SVG (md/lg seulement)
  className?: string;
}
```

Comportements par taille :
- `sm` : wiggle en place, `<span>` container, adapté aux boutons
- `md` : nage gauche-droite, `<div>` avec `overflow-hidden`, adapté aux dialogs
- `lg` : nage lente grande, même structure que `md`, adapté aux pages entières

Pour la page 404 : utiliser `size="lg"` avec `text="..."` pour un effet page entière. Le composant est un Server Component (pas de `"use client"`).

### public/manifest.json — Métadonnées réutilisables

```json
name = "FarmFlow"
short_name = "FarmFlow"
description = "Gestion piscicole — suivi de production, ventes et dépenses"
theme_color = "#0d9488"
lang = "fr"
```

Ces valeurs sont cohérentes avec celles du layout. La description du manifest est plus complète que le fallback hardcodé dans `generateMetadata`.

### Pattern des pages avec generateMetadata

Les pages qui implémentent `generateMetadata` (ex : `tarifs/page.tsx`, `mon-abonnement/page.tsx`) retournent uniquement `{ title, description }` — aucune n'ajoute `openGraph` ou `twitter`. Le pattern OG sera donc introduit pour la première fois dans le layout root, ce qui est la bonne approche (héritée par toutes les pages via Next.js metadata inheritance).

---

## Incohérences trouvées

**Aucune incohérence bloquante.** Une observation mineure :

1. **Le texte "404" dans not-found.tsx est hardcodé** en dehors du système i18n, tandis que le titre et la description passent par `getTranslations`. C'est une incohérence stylistique légère — à corriger lors de la réécriture de la page.

2. **La description dans generateMetadata utilise une clé i18n** (`t("appDescription")`) avec fallback hardcodé. La description dans `manifest.json` ("Gestion piscicole — suivi de production, ventes et dépenses") est plus précise que le fallback ("Application de suivi d'élevage de silures"). L'OG description devrait idéalement utiliser la version manifest si la clé i18n est absente.

---

## Risques identifiés

1. **FishLoader avec `size="lg"` utilise `animate-fish-swim`** défini dans `globals.css`. Si la classe CSS n'est pas définie (sprint 54.3 peut la modifier), la page 404 sera sans animation. Risque faible car les stories sont indépendantes, mais à vérifier après merge de 54.3.

2. **not-found.tsx utilise `getTranslations` (async Server Component)** — la réécriture doit maintenir le caractère async ou supprimer les traductions. Passer à un composant synchrone sans i18n est acceptable pour une page 404 simple.

3. **Image OG absente** : la story ne mentionne pas d'image OG (`og:image`). Sans image, les aperçus de partage sur certains réseaux sociaux seront dégradés. Le developer peut utiliser `/icon-512.png` comme image OG de fallback — c'est une image existante (512x512px) mais non optimisée pour l'OG (format attendu : 1200x630). À documenter comme limitation connue.

4. **`not-found.tsx` at root level s'applique à toutes les routes** — y compris les routes hors `(farm)`. C'est le comportement souhaité.

---

## Prérequis manquants

Aucun prérequis bloquant. La story peut démarrer immédiatement.

---

## Recommandation

**GO**

Les deux tâches sont bien isolées :

1. **OG + Twitter metadata** : modifier uniquement l'objet retourné par `generateMetadata` dans `src/app/layout.tsx` (lignes 62–82). Ajouter les blocs `openGraph` et `twitter`. Aucun import supplémentaire requis (le type `Metadata` de Next.js les inclut).

2. **Page 404 brandée** : réécrire `src/app/not-found.tsx`. Importer `FishLoader` depuis `@/components/ui/fish-loader`. Utiliser `size="lg"`. Conserver le bouton retour dashboard. La page peut rester async (pour i18n) ou devenir synchrone avec textes en dur.

**Ordre recommandé :** les deux modifications sont indépendantes et peuvent être faites dans la même session.

**Valeurs OG suggérées pour le developer :**
```typescript
openGraph: {
  type: "website",
  locale: "fr_CM",
  siteName: "FarmFlow",
  title: "FarmFlow — Gestion piscicole",
  description: "Suivi de production, ventes et dépenses pour l'élevage de silures",
},
twitter: {
  card: "summary",
  title: "FarmFlow — Gestion piscicole",
  description: "Suivi de production, ventes et dépenses pour l'élevage de silures",
},
```
