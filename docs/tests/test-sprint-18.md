# Rapport de tests — Sprint 18

**Sprint :** 18 — Recurrences + Dashboard financier etendu
**Date :** 2026-03-15
**Tester :** @tester
**Commande :** `npx vitest run`

---

## Resultats globaux

| Indicateur | Valeur |
|------------|--------|
| Fichiers de test | 41 passed (41) |
| Tests totaux | **1175 passed** |
| Tests Sprint 18 (nouveaux) | **29 nouveaux** |
| Tests precedents | 1146 (inchanges) |
| Build production | **OK** (`Compiled successfully in 16.1s`) |
| Non-regression | **OK** (0 regression) |

---

## Fichier de test Sprint 18

`src/__tests__/api/depenses-recurrentes.test.ts`

### Tests genererDepensesRecurrentes (frequence MENSUEL)

| # | Description | Resultat |
|---|-------------|---------|
| 1 | Due quand derniereGeneration est null | PASS |
| 2 | Due quand derniereGeneration est le mois precedent | PASS |
| 3 | NOT due quand derniereGeneration est ce mois (idempotent) | PASS |

### Tests genererDepensesRecurrentes (frequence TRIMESTRIEL)

| # | Description | Resultat |
|---|-------------|---------|
| 4 | Due quand derniereGeneration est avant ce trimestre | PASS |
| 5 | NOT due quand derniereGeneration est dans ce trimestre | PASS |

### Tests genererDepensesRecurrentes (frequence ANNUEL)

| # | Description | Resultat |
|---|-------------|---------|
| 6 | Due quand derniereGeneration est l'annee precedente | PASS |
| 7 | NOT due quand derniereGeneration est cette annee | PASS |

### Templates inactifs

| # | Description | Resultat |
|---|-------------|---------|
| 8 | Templates isActive=false ignores lors de la generation | PASS |

### Validation jourDuMois

| # | Description | Resultat |
|---|-------------|---------|
| 9 | Rejette jourDuMois > 28 (erreur validation) | PASS |
| 10 | Rejette jourDuMois < 1 (erreur validation) | PASS |

### API Routes

| # | Endpoint | Description | Resultat |
|---|----------|-------------|---------|
| 11 | GET /api/depenses-recurrentes | 200 avec liste | PASS |
| 12 | GET /api/depenses-recurrentes | 403 sans permission | PASS |
| 13 | POST /api/depenses-recurrentes | 201 creation valide | PASS |
| 14 | POST /api/depenses-recurrentes | 400 description manquante | PASS |
| 15 | POST /api/depenses-recurrentes | 400 frequence invalide | PASS |
| 16 | POST /api/depenses-recurrentes | 400 jourDuMois > 28 | PASS |
| 17 | POST /api/depenses-recurrentes | 403 sans permission | PASS |
| 18 | GET /api/depenses-recurrentes/[id] | 200 template existant | PASS |
| 19 | GET /api/depenses-recurrentes/[id] | 404 template inexistant | PASS |
| 20 | PUT /api/depenses-recurrentes/[id] | 200 mise a jour valide | PASS |
| 21 | PUT /api/depenses-recurrentes/[id] | 400 jourDuMois invalide | PASS |
| 22 | DELETE /api/depenses-recurrentes/[id] | 200 suppression OK | PASS |
| 23 | DELETE /api/depenses-recurrentes/[id] | 404 inexistant | PASS |
| 24 | POST /api/depenses-recurrentes/generer | 200 generated=0 (deja fait) | PASS |
| 25 | POST /api/depenses-recurrentes/generer | 200 avec generation | PASS |
| 26 | POST /api/depenses-recurrentes/generer | 403 sans permission | PASS |

### Anti-double-comptage (getResumeFinancier)

| # | Description | Resultat |
|---|-------------|---------|
| 27 | Inclut depenses avec commandeId=null dans coutsTotaux | PASS |
| 28 | Exclut depenses avec commandeId!=null (deja en stock) | PASS |
| 29 | Calcule correctement depensesPayees vs depensesImpayees | PASS |

---

## Non-regression

Tous les tests existants (Sprints 6 a 17) passent sans modification :

| Suite de tests | Tests | Statut |
|----------------|-------|--------|
| calculs.test.ts | 115 | PASS |
| auth-protection.test.ts | 12 | PASS |
| fournisseurs.test.ts | 17 | PASS |
| mouvements.test.ts | 23 | PASS |
| ventes.test.ts | 18 | PASS |
| besoins.test.ts | 25 | PASS |
| commandes.test.ts | 32 | PASS |
| analytics-bacs.test.ts | 15 | PASS |
| analytics-aliments.test.ts | 14 | PASS |
| alertes-stock.test.ts | 5 | PASS |
| auth/password.test.ts | 5 | PASS |
| auth/session.test.ts | 12 | PASS |
| auth/phone.test.ts | 15 | PASS |
| ui/vagues-page.test.tsx | 18 | PASS |
| ... (autres) | ... | PASS |

---

## Verification R9

- [x] `npx vitest run` — 1175 tests passes
- [x] `npm run build` — Compile avec succes (16.1s)
- [x] Non-regression : 0 regression sur les 1146 tests precedents
- [x] 29 nouveaux tests couvrant les stories 18.1 a 18.5
- [x] Rapport dans `docs/tests/test-sprint-18.md`

---

## Couverture fonctionnelle par story

| Story | Description | Tests couverts |
|-------|-------------|----------------|
| 18.1 | Schema Prisma DepenseRecurrente | Indirectement via mocks |
| 18.2 | Types TypeScript | Import/compilation |
| 18.3 | Queries + genererDepensesRecurrentes | Tests 1-10, 27-29 |
| 18.4 | API Routes | Tests 11-26 |
| 18.5 | Integration dashboard financier | Tests 27-29 |
| 18.6 | UI Templates recurrents | Build OK |
| 18.7 | UI Dashboard financier etendu | Build OK |
| 18.8 | Navigation | Build OK |

---

**Conclusion :** Sprint 18 VALIDE pour review.
