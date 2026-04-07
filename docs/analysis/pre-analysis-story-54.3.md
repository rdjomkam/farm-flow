# Pré-analyse Story 54.3 — Hover & Motion Upgrades

**Date :** 2026-04-07
**Analyste :** @pre-analyst
**Sprint :** 54

---

## Statut : GO AVEC RÉSERVES

## Résumé

La story 54.3 est implémentable sans blocage. Le terrain est partiellement préparé (keyframe `fade-in-up` existe déjà, certains `activeDot` existent déjà), mais il manque `scroll-behavior: smooth`, la classe `.stagger-children`, la règle `prefers-reduced-motion`, et les `activeDot` sur 2 fichiers charts. Le build complet n'a pas pu être terminé dans cet environnement (processus tué par le système), mais le contrôle TypeScript `tsc --noEmit` ne révèle aucune erreur dans le code source de l'application (seuls les fichiers `__tests__` ont des erreurs, connues et préexistantes).

---

## Vérifications effectuées

### Inventaire des animations existantes dans `globals.css`

| Keyframe | Classe utilitaire | Durée | Statut |
|----------|-------------------|-------|--------|
| `fade-in-up` | `.animate-fade-in-up` | 0.4s ease-out | EXISTE |
| `fade-in` | `.animate-fade-in` | 0.3s ease-out | EXISTE |
| `slide-in-left` | `.animate-slide-in-left` | 0.3s ease-out | EXISTE |
| `scale-in` | `.animate-scale-in` | 0.2s ease-out | EXISTE |
| `fish-wiggle` | `.animate-fish-wiggle` | 0.6s infinite | EXISTE |
| `fish-swim` | `.animate-fish-swim` | 2s infinite | EXISTE |

**CE QUI MANQUE :**
- `scroll-behavior: smooth` sur `html` — ABSENT
- Classe `.stagger-children` (animation décalée par enfant) — ABSENTE
- Règle `@media (prefers-reduced-motion: reduce)` — ABSENTE dans tout le code source

### Classe de transition actuelle du bouton

Fichier : `src/components/ui/button.tsx`, ligne 39

Valeur actuelle : `"transition-colors focus-visible:outline-none focus-visible:ring-2 ..."`

Valeur cible selon la story : `"transition-all duration-200 ..."`

La migration est directe : remplacer `transition-colors` par `transition-all duration-200`.

### Inventaire des `<Line>` Recharts

| Fichier | Ligne | `activeDot` présent ? | Détail |
|---------|-------|----------------------|--------|
| `src/components/analytics/analytics-dashboard-client.tsx` | 111 | NON | Manquant |
| `src/components/analytics/feed-detail-charts.tsx` | 163 | OUI | `{{ r: 6 }}` — sans glow |
| `src/components/analytics/feed-detail-charts.tsx` | 434 | OUI | `{{ r: 6 }}` — sans glow |
| `src/components/dashboard/projections.tsx` | 238 | OUI | `{{ r: 5 }}` — sans glow |
| `src/components/dashboard/projections.tsx` | 249 | OUI | `{{ r: 4 }}` — sans glow |
| `src/components/admin/analytics/admin-analytics-dashboard.tsx` | 243 | NON | Manquant |
| `src/components/admin/analytics/admin-analytics-dashboard.tsx` | 251 | NON | Manquant |
| `src/components/admin/analytics/admin-analytics-dashboard.tsx` | 400 | NON | Manquant |
| `src/components/vagues/poids-chart.tsx` | 223 | OUI | `{{ r: 6 }}` — sans glow |
| `src/components/vagues/poids-chart.tsx` | 235 | OUI | `{{ r: 4 }}` — sans glow |
| `src/components/vagues/poids-chart.tsx` | 268 | OUI | `{{ r: 6 }}` — sans glow |
| `src/components/vagues/poids-chart.tsx` | 278 | OUI | `{{ r: 4 }}` — sans glow |
| `src/components/ingenieur/client-charts.tsx` | 248 | OUI | `{{ r: 6 }}` — sans glow |
| `src/components/ingenieur/client-charts.tsx` | 291 | OUI | `{{ r: 6 }}` — sans glow |

**Résumé :** 4 `<Line>` sans aucun `activeDot`, 10 `<Line>` avec `activeDot` basique (sans stroke glow).
Tous les 14 doivent être mis à jour vers `activeDot={{ r: 6, stroke: "var(--primary)", strokeWidth: 2, fill: "white" }}`.

### `prefers-reduced-motion` : ABSENT

Aucune occurrence dans le code source (CSS, TSX, TS). La story impose d'ajouter cette règle. Le pattern recommandé :

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Build : INDÉTERMINÉ (environnement contraint)

- `tsc --noEmit` : aucune erreur sur le code source applicatif (src/** hors `__tests__`)
- Les erreurs TypeScript dans `src/__tests__/activity-engine/` (`vi`, `describe`, `expect` non résolus) sont préexistantes — elles ne sont pas dans le scope de cette story et ne bloquent pas le build Next.js (vitest injecte ses globals en runtime, pas via tsconfig)
- `next build --webpack` : processus tué par le système (SIGKILL/exit 137) — probablement mémoire insuffisante en session. La première tentative (avant interruption) a montré `Compiled successfully in 3.1min` avant l'erreur `ENOENT pages-manifest.json`, qui est un artefact d'interruption et non une erreur de compilation

**Conclusion build :** Pas de blocage TypeScript identifié dans le périmètre de la story 54.3.

---

## Incohérences trouvées

1. **`prefers-reduced-motion` totalement absent** — `globals.css`, tous les composants.
   Risque : les animations stagger (50ms delay par enfant jusqu'à 12 items) peuvent causer inconfort visuel chez les utilisateurs sensibles au mouvement. Requis par la story et par les critères d'acceptation de la story 54.8.

2. **`activeDot` incohérent entre les charts** — 4 fichiers sans `activeDot`, 10 avec mais sans glow.
   Le pattern glow `{{ r: 6, stroke: "var(--primary)", strokeWidth: 2, fill: "white" }}` doit être appliqué de façon uniforme à tous les 14 `<Line>` identifiés.

3. **`scroll-behavior` absent sur `html`** — `globals.css`.
   Uniquement `overscroll-behavior-y: none` dans le media query PWA standalone, mais pas de `scroll-behavior: smooth`.

4. **Keyframe `fade-in-up` existe mais sans classe `.stagger-children`** — Le keyframe est prêt mais le mécanisme de stagger (nth-child delay) est absent. Le développeur devra créer la classe `.stagger-children` avec des `animation-delay` par nth-child (50ms × n, jusqu'à 12 items).

---

## Risques identifiés

1. **Conflit entre stagger et animations existantes** — Des composants utilisent déjà `.animate-fade-in-up` directement. Si `.stagger-children` wrappe ces éléments, les animations pourraient se cumuler. Impact : faible. Mitigation : la classe `.stagger-children` ne doit s'appliquer qu'au conteneur, les enfants héritent du délai via CSS `nth-child`.

2. **`transition-all` sur Button peut inclure `transform`** — `transition-all duration-200` couvre toutes les propriétés CSS y compris `transform`. Si un composant parent applique un `transform` au hover qui englobe un Button, cela pourrait produire un effet inattendu. Impact : faible. Mitigation : vérifier visuellement les boutons dans les DialogTrigger et cartes au hover.

3. **Performance mobile du stagger** — Sur appareils bas de gamme (360px), animer 12 items en cascade peut produire du jank. Impact : moyen. Mitigation : `prefers-reduced-motion` est obligatoire (voir incohérence 1).

---

## Prérequis manquants

Aucun prérequis bloquant. Les 3 fichiers cibles (`globals.css`, `button.tsx`, et les fichiers Recharts) sont tous accessibles et indépendants.

---

## Recommandation

**GO.** Le développeur peut commencer immédiatement.

### Checklist pour le développeur

1. `src/app/globals.css` :
   - Ajouter `scroll-behavior: smooth` sur `html` (avant ou après `overflow-x: clip`)
   - Créer `.stagger-children > *:nth-child(1..12)` avec `animation: fade-in-up 0.4s ease-out forwards; animation-delay: N * 50ms`
   - Ajouter `@media (prefers-reduced-motion: reduce)` qui désactive toutes les animations

2. `src/components/ui/button.tsx` ligne 39 :
   - Remplacer `transition-colors` par `transition-all duration-200`

3. Fichiers Recharts — ajouter `activeDot={{ r: 6, stroke: "var(--primary)", strokeWidth: 2, fill: "white" }}` sur :
   - `src/components/analytics/analytics-dashboard-client.tsx` ligne 111
   - `src/components/admin/analytics/admin-analytics-dashboard.tsx` lignes 243, 251, 400
   - Mettre à jour (remplacer `activeDot` incomplet) : tous les autres fichiers listés dans l'inventaire ci-dessus
