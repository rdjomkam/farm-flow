# Sprint Pré-Grossissement et Transferts Inter-Vagues

## Contexte métier

Les alevins sortent de l'alevinage à 10g, mais le grossissement exige 15g minimum. Cette phase intermédiaire (pré-grossissement 10g→15g) doit être suivie comme une vague autonome avec relevés, dépenses, alimentation, mortalité. Quand le poids cible est atteint, transfert vers une vague de grossissement (nouvelle ou existante, multi-source).

## Conception validée

- Enum `TypeVague` (PRE_GROSSISSEMENT, GROSSISSEMENT) sur Vague, default GROSSISSEMENT (backwards compat)
- Nouveaux modèles : `Transfert`, `TransfertGroupe`, `TransfertModification` (pattern Calibrage cross-vague)
- Transfert direction unique : PRE_GROSSISSEMENT → GROSSISSEMENT
- Mode A : créer nouvelle vague destination dans le même acte
- Mode B : cibler vague GROSSISSEMENT EN_COURS existante (avec recalcul pondéré poidsMoyenInitial)
- Vague GROSSISSEMENT peut être créée vide (nombreInitial=0, sans bacs) en attente de transfert
- Vague PRE_GROSSISSEMENT partiellement vidée reste EN_COURS
- Suppression d'une vague avec transferts sortants : bloquée
- Modification rétroactive autorisée avec snapshot
- Auto-création relevés MORTALITE (si pertes) + BIOMETRIE au moment du transfert
- Rapports PDF (coût production + général) avec toggle `?includeParents=true` pour imputation proportionnelle des coûts parents

## Stories

| Story | Type | Pipeline | Dépend de | Statut |
|-------|------|----------|-----------|--------|
| PG.1 — Enum TypeVague + champ type sur Vague | SCHEMA | pre-analyst → db-specialist → code-reviewer → knowledge-keeper | — | TODO |
| PG.2 — Modèles Transfert, TransfertGroupe, TransfertModification | SCHEMA | pre-analyst → db-specialist → code-reviewer → knowledge-keeper | PG.1 | TODO |
| PG.3 — Types TS (enum + interfaces + DTOs) | TYPES | pre-analyst → architect → code-reviewer | PG.1, PG.2 | TODO |
| PG.4 — Queries Prisma transferts (mode A/B, recalcul pondéré, blocage delete) | QUERIES | pre-analyst → db-specialist → tester → code-reviewer → knowledge-keeper | PG.2, PG.3 | TODO |
| PG.5 — ADR règles métier transferts | ADR | architect seul (parallélisable) | — | TODO |
| PG.6 — API routes transferts + extension /api/vagues (type + démarrer vide) | API | pre-analyst → developer → tester → code-reviewer → knowledge-keeper | PG.4, PG.5 | TODO |
| PG.7 — UI Vague form + liste avec type | UI | pre-analyst → developer → tester → code-reviewer | PG.6 | TODO |
| PG.8 — UI Page transfert multi-source mode A/B | UI | pre-analyst → developer → tester → code-reviewer | PG.6 | TODO |
| PG.9 — Rapport PDF coût de production + toggle includeParents | INTEGRATION | pre-analyst → architect → developer → tester → code-reviewer → knowledge-keeper | PG.4, PG.6 | TODO |
| PG.10 — Rapport PDF général vague + toggle + lineage | INTEGRATION | pre-analyst → architect → developer → tester → code-reviewer → knowledge-keeper | PG.4, PG.6 | TODO |
| PG.11 — Tests E2E + review finale R1-R9 | TEST | tester | PG.1..PG.10 | TODO |

## Parallélisation

- PG.5 (ADR) en parallèle de PG.1 dès le démarrage
- PG.7, PG.8, PG.9, PG.10 en parallèle après PG.6
- PG.11 en dernier

## Estimation : ~6 jours

## Règles R1-R9 spécifiques à ce sprint

- R1 : TypeVague en MAJUSCULES (PRE_GROSSISSEMENT, GROSSISSEMENT)
- R2 : `import { TypeVague } from "@/types"` puis `TypeVague.PRE_GROSSISSEMENT`
- R4 : Transferts en `prisma.$transaction` (clôture AssignationBac source + création AssignationBac destination + recalcul vague destination + création relevés MORTALITE/BIOMETRIE atomique)
- R7 : Nullabilité explicite (notes?, snapshotAvant?, nombreMorts @default(0))
- R8 : siteId obligatoire sur Transfert, TransfertGroupe, TransfertModification
- R9 : npm run build + npx vitest run avant chaque review
