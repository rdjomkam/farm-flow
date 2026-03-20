# Rapport de Tests — Sprint 30

**Date :** 2026-03-20
**Agent :** @tester
**Sprint :** Sprint 30 — Fondations Abonnements

---

## Résumé

| Métrique | Valeur |
|----------|--------|
| Total tests | 1936 |
| Tests passants | 1902 |
| Tests échouants | 8 |
| Tests todo | 26 |
| Fichiers de test | 62 |
| Nouveaux tests Sprint 30 | 26 |
| Build | OK |

---

## Nouveaux tests Sprint 30

### src/__tests__/lib/abonnements-constants.test.ts (26 tests — TOUS PASS)

| Test | Statut |
|------|--------|
| calculerMontantRemise — remise fixe 2000 FCFA sur 8000 = 6000 | PASS |
| calculerMontantRemise — remise fixe dépasse le prix → 0 | PASS |
| calculerMontantRemise — remise fixe égale au prix → 0 | PASS |
| calculerMontantRemise — remise 10% sur 25000 = 22500 | PASS |
| calculerMontantRemise — remise 50% sur 8000 = 4000 | PASS |
| calculerMontantRemise — remise 100% → 0 | PASS |
| calculerMontantRemise — remise > 100% → jamais négatif | PASS |
| calculerProchaineDate — MENSUEL +1 mois | PASS |
| calculerProchaineDate — TRIMESTRIEL +3 mois | PASS |
| calculerProchaineDate — ANNUEL +12 mois | PASS |
| calculerProchaineDate — passage décembre → janvier | PASS |
| calculerProchaineDate — ne modifie pas la date originale | PASS |
| PLAN_TARIFS DECOUVERTE MENSUEL = 0 | PASS |
| PLAN_TARIFS DECOUVERTE TRIMESTRIEL = null | PASS |
| PLAN_TARIFS ELEVEUR MENSUEL = 3000 FCFA | PASS |
| PLAN_TARIFS PROFESSIONNEL ANNUEL = 70000 FCFA | PASS |
| PLAN_TARIFS INGENIEUR_PRO MENSUEL = 15000 FCFA | PASS |
| PLAN_LIMITES DECOUVERTE limitesBacs = 3 | PASS |
| PLAN_LIMITES DECOUVERTE limitesSites = 1 | PASS |
| PLAN_LIMITES PROFESSIONNEL limitesBacs = 30 | PASS |
| PLAN_LIMITES INGENIEUR_PRO limitesIngFermes = 20 | PASS |
| PLAN_LIMITES ENTREPRISE limitesBacs = 999 | PASS |
| GRACE_PERIOD_JOURS = 7 | PASS |
| SUSPENSION_JOURS = 30 | PASS |
| COMMISSION_TAUX_DEFAULT = 0.10 | PASS |
| COMMISSION_TAUX_PREMIUM = 0.20 | PASS |

---

## Tests pré-existants mis à jour

### src/__tests__/permissions.test.ts
- Test "15 groupes" mis à jour → "16 groupes" (ajout groupe `abonnements` Sprint 30)
- Test "39 permissions" mis à jour → "47 permissions" (ajout 8 permissions Sprint 30)
- 57/57 tests passent

---

## Échecs pré-existants (NON liés au Sprint 30)

| Fichier | Tests | Cause |
|---------|-------|-------|
| benchmarks.test.ts | 3 | Tests de densité kg/m3 — valeurs hardcodées décalées |
| sprint22.test.ts | 1 | RELEVE_COMPATIBLE_TYPES attendu = 4 types — pré-existant |
| api/sites.test.ts | 4 | Tests de rôles de sites — pré-existants |

Ces 8 échecs existaient avant Sprint 30 et ne sont pas causés par nos changements.

---

## Vérifications R9

- `npx vitest run` : 1902/1936 passent (8 failures pré-existantes)
- `npm run build` : OK (aucune erreur)
- `npx prisma validate` : OK
- `npx prisma migrate deploy` : Migration 20260327000000_add_subscriptions appliquée OK
- `npm run db:seed` : Données Sprint 30 insérées OK

---

## Verdict

Sprint 30 validé. Les 26 nouveaux tests passent tous. Aucune régression introduite.
