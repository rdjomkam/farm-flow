# Review Sprint 39 — i18n Infrastructure

**Date :** 2026-03-21
**Reviewer :** @code-reviewer
**Stories :** 39.1, 39.2, 39.3, 39.4, 39.5

---

## Verdict : VALIDÉ

---

## Checklist R1-R9

| Règle | Statut | Notes |
|-------|--------|-------|
| R1 — Enums MAJUSCULES | PASS | Aucun nouvel enum dans ce sprint |
| R2 — Import des enums | PASS | Aucune valeur d'enum en dur |
| R3 — Prisma = TypeScript identiques | PASS | Session.locale : String = string |
| R4 — Opérations atomiques | PASS | updateMany dans PUT /api/locale |
| R5 — DialogTrigger asChild | N/A | Aucun dialog dans ce sprint |
| R6 — CSS variables du thème | PASS | themeColor #0d9488 pré-existant, non introduit |
| R7 — Nullabilité explicite | PASS | locale NOT NULL avec défaut 'fr' |
| R8 — siteId PARTOUT | N/A | Session n'est pas multi-tenant |
| R9 — Tests avant review | PASS | 78 tests Sprint 39, build OK |

---

## Sécurité

| Point | Statut |
|-------|--------|
| Validation locale côté API | OK — seules "fr" et "en" acceptées |
| Auth sur PUT /api/locale | OK — requireAuth en première ligne |
| Cookie NEXT_LOCALE non-sensible | OK — valeur limitée à fr/en |
| Pas de secrets en dur | OK |

---

## Observations mineures (Basse)

| # | Description |
|---|-------------|
| O1 | `namespaces` dupliqué entre request.ts et messages/index.ts |
| O2 | `catch {}` vide dans loadMessages masque les erreurs JSON invalides |
| O3 | `formatXAFOrFree` traduit "Free"/"Gratuit" en dur au lieu des messages JSON |
| O4 | themeColor #0d9488 en dur dans layout.tsx (pré-existant) |

---

## Tests

| Fichier | Tests | Statut |
|---------|-------|--------|
| format-i18n.test.ts | 26 | PASS |
| locale.test.ts | 15 | PASS |
| messages.test.ts | 37 | PASS |
| **Total Sprint 39** | **78** | **PASS** |

Build : PASS — 128 routes.

---

## Décision finale

**Sprint 39 VALIDÉ. Sprint 40 peut démarrer.**
