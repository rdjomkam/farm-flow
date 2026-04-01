# BUG-PERF-005 — GlobalLoadingContext : re-renders en cascade amplifié par les invalidations
**Sévérité :** Moyenne
**Détecté par :** @architect
**Sprint :** Performance (hors-sprint)
**Fichier(s) :**
- `src/contexts/global-loading.context.tsx`
- `src/hooks/use-api.ts`

## Description
`GlobalLoadingProvider` expose deux valeurs de state React (`isLoading`, `isMutating`) qui sont modifiées à chaque appel API via `useApi()`. Chaque transition 0→1 et 1→0 des compteurs déclenche un setState, forçant un re-render de l'arbre entier sous `GlobalLoadingProvider`.

Le provider est positionné au niveau du layout racine, ce qui signifie que tous les composants de la page se re-rendent potentiellement lors de chaque changement d'état.

**Atténuation existante** (confirmée dans le code) : les compteurs utilisent `useRef` (`countRef`, `mutationCountRef`). `setIsLoading(true)` n'est appelé que quand le compteur passe de 0 à 1, et `setIsLoading(false)` avec un debounce de 300ms. Ce n'est donc pas "un re-render par requête" dans le cas normal.

**Cas problématique validé** : quand BUG-PERF-002 (sur-invalidation) déclenche 5 refetches en cascade, chaque refetch GET incrémente/décrémente `countRef`. Si les appels ne se chevauchent pas parfaitement, `isLoading` peut flipper plusieurs fois (false→true→false→true→false), générant autant de re-renders de l'arbre complet.

Le hook `useApi` incrémente le compteur pour TOUS les appels GET, y compris les polls silencieux des notifications — sauf si l'appelant passe `silentLoading: true` explicitement. Cette option existe mais n'est pas utilisée systématiquement.

## Étapes de reproduction
1. Activer React DevTools Profiler
2. Créer un nouveau relevé
3. Observer le flamegraph : plusieurs re-renders de composants non liés au relevé (sidebar, navigation, etc.)

## Cause racine
Le contexte de loading est un seul provider couvrant l'arbre entier, et les invalidations en cascade (BUG-PERF-002) amplifient le nombre de transitions isLoading.

## Fix
- [ ] S'assurer que tous les polls silencieux (NotificationBell, useMesTachesCount) passent `silentLoading: true` dans `useApi` — vérifier les services correspondants
- [ ] Séparer le contexte en deux providers indépendants : `LoadingBarProvider` (isLoading) et `MutationOverlayProvider` (isMutating) pour que les composants ne souscrivent qu'à ce dont ils ont besoin
- [ ] Alternative légère : utiliser `useSyncExternalStore` avec un store externe (Zustand atom) pour éviter les re-renders contextuels
- [ ] Ce bug est amplifié par BUG-PERF-002 — résoudre BUG-PERF-002 en priorité
- [ ] Test de non-régression : le Profiler React montre ≤2 re-renders de la sidebar lors d'une mutation unique
- [ ] Tous les tests passent
- [ ] Build OK

## Statut : OUVERT
