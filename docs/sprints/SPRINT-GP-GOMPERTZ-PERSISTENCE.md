# Sprint GP — Gompertz Persistence

**Statut** : ✅ SIGNÉ — APPROVED
**Lancé le** : 2026-06-16
**Clôturé le** : 2026-06-16

## Objectif

Corriger 3 défauts de persistance `GompertzVague` détectés en prod.

## Stories — toutes livrées

| Story | Sujet | Commit | Verdict |
|-------|-------|--------|---------|
| GP.1 | `await` upsert dans Server Component | `e2b2abc` | APPROVED |
| GP.2 | Guard NaN/Infinity dans `calibrerGompertz` | `535d8b2` | APPROVED |
| GP.3 | Cleanup prod : 1 record NaN supprimé (Vague-26-03-Prep) | `913ee52` | OK |
| GP.4 | Doc : seuil minPoints=5 confirmé comme attendu | (intégré) | OK |
| GP.5 | Review finale | (ce commit) | APPROVED |

## Validation prod

- 4 → 3 records `GompertzVague` (1 NaN supprimé)
- 0 record NaN/Infinity résiduel
- 3 records valides : Vague 26-01, Vague 26-02, Vague 26-02-Dibac
- Vague-26-03-Prep recalculera au prochain chargement (ou GP.2 bloquera si divergent)
- Vague-26-03 (4 biométries < 5 minPoints) reste sans Gompertz — comportement attendu

## Tests

- GP.2 : 8/8 verts (`gompertz-nan-guard.test.ts`)
- Régression Gompertz : 155/155 verts (4 fichiers tests existants)
- Total Sprint GP : **163/163 verts**

## Garde-fous Gompertz actifs en prod

1. 🛡 Upsert awaité — pas de promise drop sur streaming SSR (GP.1)
2. 🛡 NaN/Infinity refusés par `calibrerGompertz` (GP.2)
3. 🛡 Solver divergent → `null` → pas de persistance (GP.2)
