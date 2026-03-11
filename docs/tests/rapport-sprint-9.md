# Rapport de tests — Sprint 9 (Ventes & Facturation)

**Date :** 2026-03-10
**Testeur :** @developer-cr003
**Sprint :** 9

## Resume

| Metrique | Valeur |
|----------|--------|
| Tests Sprint 9 (nouveaux) | 67 |
| Total tests suite | 636 |
| Fichiers de tests | 27 |
| Echecs | 0 |
| Build production | OK |

## Fichiers de tests crees

### `src/__tests__/api/clients.test.ts` — 21 tests

| Groupe | Tests | Statut |
|--------|-------|--------|
| GET /api/clients | 4 | PASS |
| POST /api/clients | 6 | PASS |
| GET /api/clients/[id] | 3 | PASS |
| PUT /api/clients/[id] | 4 | PASS |
| DELETE /api/clients/[id] | 4 | PASS |

**Couverture :**
- Liste clients avec total
- Passage siteId aux queries
- Permission CLIENTS_VOIR / CLIENTS_GERER
- Validation : nom manquant, nom vide, email invalide
- CRUD complet (create, read, update, delete)
- Desactivation client (isActive: false)
- 404 client introuvable
- 500 erreurs serveur

### `src/__tests__/api/ventes.test.ts` — 17 tests

| Groupe | Tests | Statut |
|--------|-------|--------|
| GET /api/ventes | 5 | PASS |
| POST /api/ventes | 9 | PASS |
| GET /api/ventes/[id] | 3 | PASS |

**Couverture :**
- Liste ventes avec filtres (clientId, vagueId, dateFrom, dateTo)
- Permission VENTES_VOIR / VENTES_CREER
- Validation : clientId manquant, vagueId manquant, quantitePoissons <= 0, poidsTotalKg <= 0, prixUnitaireKg <= 0
- Transaction : stock insuffisant (409), client introuvable (404)
- Detail vente avec relations
- 500 erreurs serveur

### `src/__tests__/api/factures.test.ts` — 29 tests

| Groupe | Tests | Statut |
|--------|-------|--------|
| GET /api/factures | 5 | PASS |
| POST /api/factures | 7 | PASS |
| GET /api/factures/[id] | 3 | PASS |
| PUT /api/factures/[id] | 5 | PASS |
| POST /api/factures/[id]/paiements | 9 | PASS |

**Couverture :**
- Liste factures avec filtres (statut, dateFrom, dateTo)
- Filtrage statut invalide ignore
- Permission FACTURES_VOIR / FACTURES_GERER / PAIEMENTS_CREER
- Validation : venteId manquant, dateEcheance invalide, montant <= 0, mode invalide, mode manquant
- Conflit : vente deja facturee (409), depassement reste a payer (409), facture deja payee (409)
- 404 vente/facture introuvable
- Update statut + dateEcheance
- Ajout paiement avec recalcul automatique
- 500 erreurs serveur

## Regles metier testees

| Regle | Test | Statut |
|-------|------|--------|
| Stock insuffisant → 409 | POST /api/ventes + "Stock de poissons insuffisant" | PASS |
| Client introuvable → 404 | POST /api/ventes + "Client introuvable ou inactif" | PASS |
| 1 vente = 1 facture max | POST /api/factures + "deja une facture" → 409 | PASS |
| Montant paiement <= reste | POST paiements + "depasse" → 409 | PASS |
| Facture payee → pas de paiement | POST paiements + "deja payee" → 409 | PASS |
| Statut invalide → 400 | PUT factures + statut invalide | PASS |

## Execution

```
npx vitest run
 27 test files | 636 tests | 0 failures
 Duration: 3.51s

npx next build — OK (Turbopack)
```

## Non-regression

Tous les tests existants (569 avant Sprint 9) continuent de passer sans modification. Les 67 nouveaux tests couvrent l'ensemble du module Ventes & Facturation.
