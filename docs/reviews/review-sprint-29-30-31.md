# Review Sprints 29-30-31 — Hook API Offline + Synchronisation + UI PWA

**Date :** 2026-03-21
**Reviewer :** @code-reviewer
**Stories :** 29.1-29.3, 30.1-30.4, 31.1-31.3

## Verdict : EN ATTENTE DE CORRECTIONS — 2 High, 3 Medium

## Issues bloquantes (Haute)

| ID | Fichier | Problème |
|----|---------|----------|
| BUG-R29-01 | releve.service.ts:57 | R2: string "MORTALITE" en dur au lieu de TypeReleve.MORTALITE |
| BUG-R29-02 | sync.ts:106, db.ts, queue.ts | Retry delay basé sur createdAt au lieu du dernier échec, champ lastAttemptAt manquant |

## Issues moyennes

| ID | Fichier | Problème |
|----|---------|----------|
| BUG-R29-03 | install-prompt.tsx, sync-status-panel.tsx, offline-indicator.tsx | R6: couleurs Tailwind hardcodées |
| BUG-R29-04 | idempotency.ts | IdempotencyResult non discriminant — statusCode peut être undefined |
| BUG-R29-05 | use-install-prompt.ts:48 | navigator.platform déprécié |

## Observations non-bloquantes

1. getPendingCount utilise getAll au lieu de l'index by-site
2. clearQueue avec await séquentiels dans transaction
3. syncInProgress module-level — pas d'isolation multi-onglet
4. Toast offline sans entityLabel
5. Messages depense.service.ts sans accents

## Points forts

- Architecture offline solide : séparation enqueue/dequeue/processItem
- Background Sync tag cohérent entre SW et client
- Debounce 3s correctement implémenté
- Crash recovery avec resetSyncingItems
- Idempotency conforme R8 avec index siteId + expiresAt
- SyncStatusPanel avec confirmation avant clear
- InstallPrompt avec 30-day dismiss persistence
- useApi chemin normal non modifié par logique offline

*Report par @code-reviewer le 2026-03-21*
