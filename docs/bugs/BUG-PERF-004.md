# BUG-PERF-004 — Polling continu sans respect de la visibilité de l'onglet
**Sévérité :** Haute
**Détecté par :** @architect
**Sprint :** Performance (hors-sprint)
**Fichier(s) :**
- `src/components/layout/notification-bell.tsx`
- `src/hooks/queries/use-alertes-queries.ts` (useNotificationsCount)
- `src/hooks/queries/use-planning-queries.ts` (useMesTachesCount)
- `src/hooks/use-network-status.ts`

## Description
Quatre sources de polling actif ignorent la visibilité de l'onglet et continuent d'envoyer des requêtes même quand l'application est en arrière-plan.

**Source 1 — NotificationBell (`notification-bell.tsx`) :**
```typescript
refetchInterval: 60_000,  // aucun refetchIntervalInBackground
```
TanStack Query v5 : sans `refetchIntervalInBackground: false`, le polling continue en arrière-plan.

**Source 2 — `useNotificationsCount` (`use-alertes-queries.ts`) :**
```typescript
refetchInterval: 60_000,
```
Cette query partage la même clé `queryKeys.notifications.count()` que NotificationBell. Si les deux sont montés simultanément, TanStack Query déduplique les requêtes — mais le polling continue tout de même en arrière-plan.

**Source 3 — `useMesTachesCount` (`use-planning-queries.ts`) :**
```typescript
refetchInterval: 60_000,
```
Même problème.

**Source 4 — `useNetworkStatus` (`use-network-status.ts`) :**
```typescript
const interval = setInterval(updateCount, 5000); // Every 5s
```
Un `setInterval` natif qui interroge IndexedDB toutes les 5 secondes. Il n'est pas suspendu quand le document est caché. Le hook gère déjà `visibilitychange` pour la synchronisation offline, mais le polling de `pendingCount` est indépendant.

**Calcul d'impact (onglet en arrière-plan, 24h) :**
- `NotificationBell` + `useNotificationsCount` : ~1 440 appels API/jour (dédupliqués sur même clé)
- `useMesTachesCount` : ~1 440 appels API/jour
- `useNetworkStatus` : ~17 280 opérations IndexedDB/jour
- **Total : ~2 880 appels API réseau inutiles/jour/utilisateur**

Sur connexion 2G africaine (latence 300-500ms), chaque appel consomme ~150-300ms de temps CPU et de batterie.

## Étapes de reproduction
1. Ouvrir l'application, attendre 2 minutes
2. Passer l'onglet en arrière-plan (autre onglet ou minimiser)
3. Attendre 10 minutes
4. Revenir sur l'onglet
5. Observer dans l'onglet Network : des appels à `/api/notifications/count` et `/api/planning/activites/mes-taches/count` ont eu lieu pendant l'absence

## Cause racine
Absence de `refetchIntervalInBackground: false` sur les queries avec `refetchInterval`. Pour `useNetworkStatus`, le `setInterval` n'est pas conditionné à `document.visibilityState === "visible"`.

## Fix
- [ ] Ajouter `refetchIntervalInBackground: false` sur les 3 queries avec `refetchInterval` (NotificationBell, useNotificationsCount, useMesTachesCount)
- [ ] Dans `useNetworkStatus`, remplacer le `setInterval` inconditionnel par un poll qui s'arrête quand `document.visibilityState !== "visible"` (utiliser `visibilitychange` déjà écouté dans le hook)
- [ ] Vérifier qu'un Service Worker ou une autre mécanique prend le relai pour les notifications en arrière-plan si besoin
- [ ] Test de non-régression : aucun appel API n'est émis pendant 2 minutes avec l'onglet caché
- [ ] Tous les tests passent
- [ ] Build OK

## Statut : OUVERT
