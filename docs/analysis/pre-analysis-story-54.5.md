# Pre-analyse Story 54.5 — Semantic HTML & Accessibility
**Date :** 2026-04-07
**Analyste :** @pre-analyst

---

## Statut : GO AVEC RESERVES

## Resume

Le build est propre (aucune erreur TypeScript en dehors des fichiers de test). Les 5 changements de Story 54.5 sont clairement circonscrits et sans dependances croisees entre eux. Une reserve : le composant `Card` n'est pas polymorphique (prop `as` absente), et les listes de cartes dans les 3 composants cibles utilisent toutes des `<div>` non semantiques. Aucune erreur connue dans ERRORS-AND-FIXES.md ne concerne cette story.

---

## Verifications effectuees

### Build : OK

`npm run build` passe avec succes — artifacts `.next/static/` presents, aucune erreur de compilation.

Note : un processus `next build` en cours pendant l'analyse a cree des conflits de lock file (`.next/lock`). Ce n'est pas un probleme de code — c'est un artefact de l'environnement de dev. Le build final est propre.

### Schema / Types / API : NON CONCERNE

Story 54.5 est purement UI (HTML semantique et accessibilite). Aucun modele Prisma, aucune API route, aucun type ne sont touches.

---

## Etat actuel des fichiers cibles

### 1. Skip-to-content link : ABSENT

**`src/components/layout/app-shell.tsx`**
- Aucun skip link present.
- L'element `<main>` (ligne 66 et 100) n'a pas d'attribut `id`.
- Il y a DEUX blocs `<main>` : un pour le layout INGENIEUR (ligne 66) et un pour le layout FARM (ligne 100). Les deux devront recevoir `id="main-content"`.

**`src/app/layout.tsx`**
- Aucun skip link present.
- Le skip link doit etre ajoute dans `app-shell.tsx` (avant le premier element affiche), pas dans `layout.tsx`, car `layout.tsx` ne sait pas si on est sur une page auth (sans nav).
- Recommandation : placer le skip link dans les deux branches de rendu (INGENIEUR et FARM) de `app-shell.tsx`, juste avant le `<div className="flex min-h-dvh">`.

### 2. Composant Card : PAS DE PROP `as`

**`src/components/ui/card.tsx`**
- Interface actuelle : `interface CardProps extends React.HTMLAttributes<HTMLDivElement> { interactive?: boolean; }`
- Aucune prop `as` polymorphique.
- Le composant est hardcode sur `<div>`.
- Ajout necessaire : `as?: "article" | "section" | "div"` avec `defaultProps` ou valeur par defaut `"div"`.
- Point d'attention TypeScript : il faudra typer correctement les props selon l'element choisi, ou utiliser `React.ElementType` avec cast.

### 3. Listes de cartes — Structure actuelle

**`src/components/vagues/vagues-list-client.tsx`**
- La fonction `renderVagueGrid` (ligne 164) retourne un `<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">` avec des `<VagueCard>` directement comme enfants.
- Pas de `<ul>/<li>`. Pas de `role="list"`.
- Le composant `VagueCard` devra etre wrappe dans un `<li>`, et le conteneur `<div className="grid ...">` devra devenir `<ul role="list" className="grid ...">`.

**`src/components/releves/releves-global-list.tsx`**
- La fonction `RelevesGlobalList` (ligne 137) retourne :
  ```
  <div className="flex flex-col gap-0">
    <div className="flex flex-col">
      {releves.map((r) => <ReleveCard key={r.id} ... />)}
    </div>
  </div>
  ```
- Aucun `<ul>/<li>`. La structure est un double `<div>` imbriquee.
- Recommandation : transformer le `<div className="flex flex-col">` interieur en `<ul role="list" className="flex flex-col">` et chaque `<ReleveCard>` dans un `<li>`.
- Note : `ReleveCard` lui-meme est un `<div>` (ligne 58). Il faudra evaluer si on wrape le `<div id="releve-${releve.id}">` dans un `<li>`, ou si on remplace le `<div>` par un `<li>` directement.

**`src/components/ventes/ventes-list-client.tsx`**
- Le conteneur des cartes (ligne 110) : `<div className="flex flex-col gap-2">` avec des `<Link>/<Card>` imbriques.
- Chaque item est un `<Link href="..."><Card>...`.
- Pour la semantique : `<ul role="list">` + `<li><Link href="..."><Card as="article">`.
- La `Card` ayant besoin de la prop `as="article"`, cette sous-tache depend directement du fix du composant Card.

### 4. Composants Recharts — Aucune `<figure>` presente

Verification effectuee sur l'ensemble du codebase (`grep <figure`) : aucun resultat.

Composants utilisant Recharts (tous sans `<figure>`):

| Fichier | Type de chart | Wrapper actuel |
|---------|--------------|----------------|
| `src/components/vagues/poids-chart.tsx` | LineChart | `<Card>` + `<div className="w-full">` |
| `src/components/analytics/bac-detail-charts.tsx` | BarChart | `<Card>` |
| `src/components/analytics/feed-detail-charts.tsx` | Multiple | `<Card>` |
| `src/components/analytics/feed-k-comparison-chart.tsx` | Multiple | `<Card>` |
| `src/components/analytics/analytics-dashboard-client.tsx` | LineChart | `<Card>` |
| `src/components/analytics/vagues-comparison-client.tsx` | Multiple | `<div>` / `<Card>` |
| `src/components/dashboard/projections.tsx` | LineChart | `<Card>` |
| `src/components/dashboard/indicateurs-panel.tsx` | Aucun Recharts direct | N/A |
| `src/components/finances/finances-dashboard-client.tsx` | AreaChart + BarChart | `<Card>` |
| `src/components/ingenieur/client-charts.tsx` | LineChart + BarChart | `<Card>` |
| `src/components/admin/analytics/admin-analytics-dashboard.tsx` | Multiple | `<div>` |

Le pattern de wrap a adopter : remplacer le `<div className="w-full" style={{ height: X }}>` qui contient `<ResponsiveContainer>` par `<figure>` avec un `<figcaption>` portant le titre du graphique.

### 5. Pattern `role="list"` : Presente une seule fois

- Seul `src/components/abonnements/checkout-form.tsx` (ligne 83) utilise deja `role="list"`.
- Ce fichier N'EST PAS dans le perimetre de Story 54.5. Il sert de reference pour le pattern a adopter.

---

## Incohérences trouvees

### INC-1 : Deux blocs `<main>` dans app-shell.tsx sans `id`
**Fichiers :** `src/components/layout/app-shell.tsx` lignes 66 et 100
**Description :** Le layout Ingenieur (ligne 66) et le layout Farm (ligne 100) ont chacun un `<main>` distinct. Les deux doivent recevoir `id="main-content"` pour que le skip link fonctionne.
**Suggestion :** Ajouter `id="main-content"` sur les deux `<main>`. Pas de conflit car ils ne sont jamais rendus en meme temps.

### INC-2 : VagueCard ne prend pas de prop `as`
**Fichier :** `src/components/vagues/vague-card.tsx` (a verifier)
**Description :** Les cartes dans `vagues-list-client.tsx` sont des `<VagueCard>` qui utilisent probablement `<Card>` en interne. Si la prop `as` est ajoutee a `Card`, il faudra la propager.
**Suggestion :** Apres ajout de `as` sur `Card`, verifier si `VagueCard` doit aussi exposer `as="article"` ou si on laisse le wrapper `<li>` suffire.

### INC-3 : `ReleveCard` utilise un `id` anchor (`id="releve-${releve.id}"`)
**Fichier :** `src/components/releves/releves-global-list.tsx` ligne 58
**Description :** Le `<div>` racine de `ReleveCard` a un `id` qui sert d'ancre de navigation. Si on le remplace par `<li>`, l'ancre reste valide. Aucun conflit.

---

## Risques identifies

### RISQUE-1 : TypeScript strict sur la prop `as` polymorphique
**Impact :** Moyen
**Description :** Implementer un composant polymorphique en TypeScript strict necessite soit un cast (`as unknown as ...`), soit l'utilisation d'une union discriminee. Si mal implementee, des erreurs TypeScript apparaitront sur les usages existants de `<Card>` qui ne passent pas `as`.
**Mitigation :** Utiliser `as = "div"` comme valeur par defaut. Tous les usages existants fonctionneront sans changement. Tester avec `npm run build` apres modification.

### RISQUE-2 : Regression visuelle sur grille vagues
**Impact :** Faible
**Description :** Remplacer `<div className="grid ...">` par `<ul className="grid ...">` modifie l'element racine. Les `<ul>` ont un `list-style: disc` et un `padding-inline-start` par defaut en CSS navigateur. Ces styles sont generalement resetes par Tailwind (via `preflight`), mais il faut verifier.
**Mitigation :** Tailwind preflight resete `list-style: none` et le padding des `<ul>`. Aucune regression attendue. Verification visuelle mobile (360px) recommandee apres le changement.

### RISQUE-3 : Perimetre des composants chart a couvrir
**Impact :** Moyen
**Description :** Il y a 10+ composants utilisant Recharts. La story demande "les composants charts" sans en lister un sous-ensemble. Si le developpeur wrappe tous les charts dans `<figure>`, cela represente un nombre important de modifications avec risque de manquer un composant.
**Mitigation :** Definir explicitement la liste minimale couverte (au moins les charts sur les pages de vague, dashboard et analytics). Les autres peuvent etre traites en incremental.

### RISQUE-4 : Build lock file en environnement dev
**Impact :** Faible (operationnel, pas code)
**Description :** Des processus `next build` concurrents creent des conflits sur `.next/lock`. Ce probleme est specifique a l'environnement multi-agent. Il ne bloque pas le developpement mais necessite de tuer les processus orphelins avant de lancer `npm run build`.
**Mitigation :** Avant de lancer le build, verifier avec `lsof /path/.next/lock` qu'aucun processus n'est actif.

---

## Prerequis manquants

Aucun prerequis manquant. Story 54.5 est independante des autres stories de Sprint 54.

---

## Liste complete des fichiers a modifier

| Fichier | Changement |
|---------|-----------|
| `src/components/layout/app-shell.tsx` | Ajouter skip-to-content link + `id="main-content"` sur les 2 `<main>` |
| `src/components/ui/card.tsx` | Ajouter prop `as?: "article" \| "section" \| "div"` |
| `src/components/vagues/vagues-list-client.tsx` | `renderVagueGrid` : `<div className="grid">` → `<ul role="list" className="grid">` + `<li>` wrapper |
| `src/components/releves/releves-global-list.tsx` | `<div className="flex flex-col">` interieur → `<ul role="list">` + `<li>` wrapper |
| `src/components/ventes/ventes-list-client.tsx` | `<div className="flex flex-col gap-2">` → `<ul role="list">` + `<li>` wrapper |
| `src/components/vagues/poids-chart.tsx` | Wrapper `<div className="w-full">` → `<figure>` + `<figcaption>` |
| `src/components/dashboard/projections.tsx` | Wrapper chart → `<figure>` + `<figcaption>` |
| `src/components/analytics/analytics-dashboard-client.tsx` | Wrapper chart → `<figure>` + `<figcaption>` |
| `src/components/finances/finances-dashboard-client.tsx` | Wrapper charts → `<figure>` + `<figcaption>` |
| `src/components/analytics/bac-detail-charts.tsx` | Wrapper chart → `<figure>` + `<figcaption>` |
| `src/components/analytics/feed-detail-charts.tsx` | Wrapper chart → `<figure>` + `<figcaption>` |
| `src/components/analytics/feed-k-comparison-chart.tsx` | Wrapper chart → `<figure>` + `<figcaption>` |
| `src/components/ingenieur/client-charts.tsx` | Wrapper chart → `<figure>` + `<figcaption>` |

---

## Recommandation

**GO** — Tous les prerequis sont satisfaits. Le build est propre. Les changements sont bien localises.

Points d'attention pour le developpeur :
1. La prop `as` sur `Card` doit avoir `"div"` comme valeur par defaut pour ne pas casser les ~50 usages existants.
2. Pour les listes, `role="list"` est requis sur `<ul>` car Tailwind/preflight supprime les styles de liste natifs et certains lecteurs d'ecran (VoiceOver/Safari) peuvent ne plus annoncer les listes sans ce role.
3. Les `<figure>` sur charts : le `<figcaption>` doit reprendre le titre du chart (generalement deja present dans `<CardTitle>`) — on peut le rendre invisible visuellement avec `sr-only` si le titre est deja affiche dans la Card.
4. Le skip link doit avoir le style `sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:rounded-md focus:shadow-md` pour etre visible uniquement au focus clavier.
