# BUG-PERF-006 — Bundle client : recharts non lazy-loaded sur les pages sans graphiques
**Sévérité :** Basse
**Détecté par :** @architect
**Sprint :** Performance (hors-sprint)
**Fichier(s) :**
- `src/components/finances/finances-dashboard-client.tsx`
- `src/components/analytics/analytics-dashboard-client.tsx`
- `src/components/analytics/feed-detail-charts.tsx`
- `src/components/dashboard/projections.tsx`
- `src/components/vagues/poids-chart.tsx`
- et 6 autres fichiers avec `import recharts`

## Description
`recharts` (~300KB gzippé) est importé directement (import statique) dans tous les composants de graphiques. Ces composants sont des "use client" components, donc recharts est inclus dans le bundle JavaScript initial de toutes les pages qui les importent.

**Note importante** : après vérification du code, `xlsx`, `@react-pdf/renderer`, et `@aws-sdk/client-s3` sont importés uniquement dans des API routes (server-only) — ils ne contaminent pas le bundle client. L'analyse initiale était erronée sur ce point.

Le seul problème confirmé est recharts sans `dynamic()`.

**Impact estimé :** Sur les pages qui affichent des graphiques (dashboard, analytics, finances), recharts est inévitable. Mais sur les pages qui n'affichent pas de graphiques (liste des bacs, liste des ventes, formulaire de relevé), recharts est inclus dans le bundle si un composant chart est dans le même chunk.

Sur connexion 2G (1 Mbps) : 300KB supplémentaires = ~2.4s de chargement bloquant.

## Étapes de reproduction
1. Exécuter `npm run build`
2. Observer les chunks générés dans `.next/static/chunks/`
3. Identifier si `recharts` apparaît dans le bundle initial des pages sans graphiques
4. Utiliser `@next/bundle-analyzer` pour visualiser la composition des chunks

## Cause racine
Import statique de recharts sans `next/dynamic`. Next.js ne peut pas code-splitter automatiquement les imports statiques dans les composants "use client".

## Fix
- [ ] Installer `@next/bundle-analyzer` pour identifier précisément les chunks affectés
- [ ] Wrapper les composants de graphiques lourds avec `dynamic(() => import(...), { ssr: false, loading: () => <ChartSkeleton /> })`
- [ ] Priorité : `FinancesDashboardClient`, `AnalyticsDashboardClient`, `ProjectionsSection` (pages avec graphiques multiples)
- [ ] Vérifier que `ChartSkeleton` a les mêmes dimensions que le graphique pour éviter le layout shift
- [ ] Test de non-régression : `npm run build` montre que recharts n'est pas dans le bundle initial des pages sans graphiques
- [ ] Tous les tests passent
- [ ] Build OK

## Statut : OUVERT
