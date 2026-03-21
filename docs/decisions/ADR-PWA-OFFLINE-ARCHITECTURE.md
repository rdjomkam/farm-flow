# ADR — Architecture PWA Offline (Service Worker + IndexedDB + Sync)

**Date :** 2026-03-21
**Statut :** Accepté
**Sprint :** 27-31

## Contexte

FarmFlow est déployé en zone rurale au Cameroun où la connectivité est intermittente.
Les utilisateurs doivent pouvoir enregistrer des relevés, ventes et dépenses même sans réseau,
avec synchronisation automatique au retour de la connexion.

## Décisions

### 1. Service Worker : Serwist (@serwist/next)

**Choix :** Serwist (fork maintenu de Workbox) via `@serwist/next`.

**Alternatives rejetées :**
- `next-pwa` : déprécié, plus maintenu
- Workbox direct : configuration manuelle trop complexe avec App Router
- Custom SW : maintenance lourde, pas de precaching automatique

**Configuration :**
- `skipWaiting: false` — bannière de mise à jour contrôlée par l'utilisateur
- `clientsClaim: true` — prendre le contrôle des clients immédiatement
- Navigation fallback vers `/~offline`
- Runtime caching par défaut (NetworkFirst pour pages, CacheFirst pour assets)

### 2. Stockage offline : IndexedDB via `idb`

**Choix :** IndexedDB avec wrapper typé `idb` (~1.2KB).

**Stores :**
| Store | Contenu | Chiffré |
|-------|---------|---------|
| `auth-meta` | Salts, clés wrappées, credentials offline | Non (contient les clés wrappées) |
| `offline-queue` | Mutations en attente de sync | Oui (payload) |
| `ref-vagues` | Cache données référence vagues | Oui |
| `ref-bacs` | Cache données référence bacs | Oui |
| `ref-produits` | Cache données référence produits | Oui |
| `ref-clients` | Cache données référence clients | Oui |
| `sync-meta` | Timestamps de dernière synchronisation | Non |
| `session-mirror` | Copie session pour usage offline | Non |

### 3. File d'attente mutations : Priority + FIFO

**Priorités :**
| Priorité | Types | Justification |
|----------|-------|---------------|
| 1 (Critique) | Relevé mortalité | Déclenche les alertes, sensible au temps |
| 2 (Standard) | Autres relevés, ventes, dépenses | Opérations normales |
| 3 (Basse) | Notes, observations | Peuvent attendre |

**Limites :** Max 500 items (~1MB). À 12 items/jour = 41 jours de capacité offline.

**Idempotency :** Chaque item a un UUID comme `X-Idempotency-Key`. Le serveur stocke
les réponses dans `IdempotencyRecord` pendant 48h pour dédupliquer les replays.

### 4. Synchronisation

**Android Chrome :** Background Sync API — sync même app en arrière-plan.
**iOS Safari :** Fallback via événements `online` + `visibilitychange`.

**Stratégie de retry :**
```
Tentative 1 → 30s
Tentative 2 → 2min
Tentative 3 → 10min
Tentative 4 → 30min
Tentative 5 → Marqué "échoué", notification utilisateur
```

**Résolution de conflits :** Last-Write-Wins avec autorité serveur.
Les relevés sont append-only (chaque enregistrement est distinct).
Pas de CRDT nécessaire.

**Crash recovery :** Au démarrage, tous les items "syncing" repassent en "pending".

### 5. Intégration hook API

Le hook `useApi` est étendu avec des options `offlineCapable` :
- Si mutation échoue (erreur réseau) ET `offlineCapable: true` → queue au lieu d'erreur
- Toast "Enregistré hors ligne" (ambre)
- Retourne `{ _offline: true, tempId }` pour que l'UI continue

Services concernés : `releve.service.ts`, `vente.service.ts`, `depense.service.ts`.

## Conséquences

- Les utilisateurs peuvent travailler 41 jours sans connexion (500 items max)
- La synchronisation est automatique et transparente
- Les données sont chiffrées au repos (voir ADR-PWA-ENCRYPTION.md)
- Le serveur est protégé contre les doublons via idempotency keys
- iOS a une expérience légèrement dégradée (pas de Background Sync natif)
