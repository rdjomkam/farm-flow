# Review Sprint 28 — Couche Données Offline Chiffrée

**Date :** 2026-03-21
**Reviewer :** @code-reviewer
**Stories :** 28.1, 28.2, 28.3, 28.4, 28.5

## Verdict : VALIDÉ AVEC CORRECTIONS OBLIGATOIRES

4 corrections bloquantes, 6 observations mineures. Architecture crypto solide.

## Issues bloquantes

| ID | Fichier | Sévérité | Problème |
|----|---------|----------|---------|
| ISSUE-002 | pin-setup/unlock-dialog.tsx | Moyenne | R6: couleurs teal hardcodées → bg-primary |
| ISSUE-004 | auth-cache.ts | Moyenne | Délai exponentiel PIN 3 tentatives manquant (ADR spec) |
| ISSUE-006 | crypto.ts | Basse | unwrapDataKey retourne clé extractable (doit être false) |
| ISSUE-008 | ref-cache.ts + db.ts | Moyenne | R8: RefRecord sans siteId → pollution inter-sites |

## Issues recommandées

| ID | Fichier | Sévérité | Problème |
|----|---------|----------|---------|
| ISSUE-001 | pin dialogs | Basse | Absence DialogTrigger (volontaire, ajouter commentaire) |
| ISSUE-003 | queue.ts | Basse | R4: enqueue count+put non atomique |
| ISSUE-005 | auth-cache.ts | Basse | loginIdentifier PII en clair dans auth-meta |
| ISSUE-007 | crypto.ts | Basse | Comparaison hash non temps constant (acceptable avec PBKDF2) |
| ISSUE-009 | ref-cache.ts | Basse | clearSiteRefData efface tous sites (lié ISSUE-008) |
| ISSUE-010 | queue.ts | Basse | getPendingCount/getQueueItems n'utilisent pas index by-site |

## Points forts

- Architecture crypto solide : PBKDF2 600K, AES-GCM 256, isolation (userId, siteId)
- Key lifecycle correct : clearSiteKey, clearKeys, deleteOfflineDB
- Safari private browsing : dégradation gracieuse
- IndexedDB schema typé avec idb DBSchema
- Mobile first : dialogs PIN w-[calc(100%-2rem)] max-w-sm

*Report par @code-reviewer le 2026-03-21*
