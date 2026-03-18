# Review — Sprint 25 : Rule Management (Regles d'activites)

**Date :** 2026-03-18
**Reviewer :** @code-reviewer
**Sprint :** 25

---

## Perimetre

Sprint 25 ajoute l'interface d'administration des regles d'activites (RegleActivite). 18 fichiers crees, 5 fichiers modifies.

## Checklist R1-R9

| Regle | Statut | Note |
|-------|--------|------|
| R1 — Enums MAJUSCULES | PASS | Aucun nouvel enum |
| R2 — Import des enums | PASS | Tous importes depuis @/types |
| R3 — Prisma = TypeScript | PASS | RegleActiviteWithCount aligne avec _count |
| R4 — Operations atomiques | PASS | toggle/reset via updateMany avec condition |
| R5 — DialogTrigger asChild | PASS | Toutes les dialogs conformes |
| R6 — CSS variables | PASS | Classes semantiques Tailwind, pas de hex en dur |
| R7 — Nullabilite explicite | PASS | Pas de nouveau schema |
| R8 — siteId PARTOUT | PASS | Systematique dans queries et routes |
| R9 — Tests avant review | PASS | Story 25.8 |

## Bugs trouves et corriges

### BUG-1 (Haute) — Redirect post-creation vers undefined
`regle-form-client.tsx:529` — `created.id` au lieu de `created.regle.id`.
**Corrige.**

### BUG-2 (Moyenne) — Mauvais champ DTO
`regle-form-client.tsx:487` — `dto.description` au lieu de `dto.descriptionTemplate`.
**Corrige.**

### BUG-3 (Basse) — SEUIL_TYPES incoherent entre fichiers
Defini 4 fois avec des contenus differents (avec/sans STOCK_BAS).
**Corrige** — extrait en `SEUIL_TYPES_FIREDONCE` dans `regles-activites-constants.ts`, importe partout.

## Recommandations non-bloquantes

1. Envelopper `updateRegleActivite` findFirst + updateMany dans une transaction Prisma (risque TOCTOU theorique)

## Verdict : VALIDE
