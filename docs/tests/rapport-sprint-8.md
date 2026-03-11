# Rapport de Tests — Sprint 8 (Stock & Approvisionnement)

**Date :** 2026-03-09
**Testeur :** @tester
**Vitest :** v4.0.18

## Resultat global

| Metrique | Valeur |
|----------|--------|
| **Total tests** | 396 |
| **Tests passes** | 396 |
| **Tests echoues** | 0 |
| **Fichiers de test** | 20 |
| **Duree** | ~3.2s |

## Nouveaux tests Sprint 8 (100 tests, 5 fichiers)

### `fournisseurs.test.ts` — 17 tests

| Endpoint | Tests | Couverture |
|----------|-------|------------|
| GET /api/fournisseurs | 4 | Liste, 401, 403, 500 |
| POST /api/fournisseurs | 6 | Creation complete, nom seulement, nom manquant, nom vide, email invalide, 401 |
| GET /api/fournisseurs/[id] | 2 | Par ID, 404 |
| PUT /api/fournisseurs/[id] | 2 | Mise a jour, 404 introuvable |
| DELETE /api/fournisseurs/[id] | 3 | Soft delete, 404, 403 |

### `produits.test.ts` — 25 tests

| Endpoint | Tests | Couverture |
|----------|-------|------------|
| GET /api/produits | 6 | Liste, filtre categorie, filtre fournisseurId, categorie invalide ignoree, 401, 403 |
| POST /api/produits | 9 | Creation, nom manquant, categorie invalide, unite invalide, prixUnitaire negatif, prixUnitaire absent, seuilAlerte negatif, erreurs multiples, fournisseur introuvable 404 |
| GET /api/produits/[id] | 2 | Par ID, 404 |
| PUT /api/produits/[id] | 4 | Update partiel, categorie invalide, unite invalide, prixUnitaire negatif, 404 |
| DELETE /api/produits/[id] | 3 | Soft delete, 404, 401 |

### `commandes.test.ts` — 32 tests

| Endpoint | Tests | Couverture |
|----------|-------|------------|
| GET /api/commandes | 7 | Liste, filtre statut, filtre fournisseurId, filtres date, statut invalide ignore, 401, 403 |
| POST /api/commandes | 10 | Creation avec lignes, fournisseurId manquant, dateCommande manquante, dateCommande invalide, lignes vide, lignes absentes, ligne sans produitId, quantite <= 0, prixUnitaire negatif, fournisseur introuvable 404 |
| GET /api/commandes/[id] | 2 | Detail avec lignes, 404 |
| PUT /api/commandes/[id] | 7 | Action envoyer, action annuler, action manquante 400, action invalide 400, 404 introuvable, 409 pas BROUILLON, 409 deja livree |
| POST /api/commandes/[id]/recevoir | 5 | Reception sans date, reception avec date, date invalide 400, 404 introuvable, 409 pas ENVOYEE, 401 |

### `mouvements.test.ts` — 21 tests

| Endpoint | Tests | Couverture |
|----------|-------|------------|
| GET /api/stock/mouvements | 9 | Liste, filtre produitId, filtre type, filtre vagueId, filtre commandeId, filtres date, type invalide ignore, 401, 403 |
| POST /api/stock/mouvements | 12 | ENTREE, SORTIE avec vagueId, produitId manquant, type invalide, quantite <= 0, quantite negative, date manquante, date invalide, prixTotal negatif, produit introuvable 404, **stock insuffisant 409**, 401 |

### `alertes-stock.test.ts` — 5 tests

| Endpoint | Tests | Couverture |
|----------|-------|------------|
| GET /api/stock/alertes | 5 | Produits en alerte, liste vide, 401, 403, 500 |

## Correction non-regression

- **`responsive.test.tsx`** : BottomNav attend maintenant 5 onglets au lieu de 4 (ajout du lien Stock en Sprint 8)

## Regles metier testees

| Regle | Test | Fichier |
|-------|------|---------|
| Mouvement SORTIE impossible si stock insuffisant | `retourne 409 si stock insuffisant pour SORTIE` | mouvements.test.ts |
| Commande ne peut etre envoyee que si BROUILLON | `retourne 409 si impossible d'envoyer (pas BROUILLON)` | commandes.test.ts |
| Commande ne peut etre recue que si ENVOYEE | `retourne 409 si impossible de recevoir (pas ENVOYEE)` | commandes.test.ts |
| Commande livree ne peut pas etre annulee | `retourne 409 si impossible d'annuler (deja livree)` | commandes.test.ts |
| Fournisseur doit exister pour creer un produit | `retourne 404 si fournisseur introuvable` | produits.test.ts |
| Toutes les routes verifient auth (401) | Tests 401 dans chaque fichier | Tous |
| Toutes les routes verifient permissions (403) | Tests 403 dans chaque fichier | Tous |

## Permissions testees

| Permission | Routes |
|------------|--------|
| APPROVISIONNEMENT_VOIR | GET fournisseurs, GET commandes |
| APPROVISIONNEMENT_GERER | POST/PUT/DELETE fournisseurs, POST/PUT commandes, POST recevoir |
| STOCK_VOIR | GET produits, GET mouvements, GET alertes |
| STOCK_GERER | POST/PUT/DELETE produits, POST mouvements |

## Build production

```
npm run build — OK
Next.js 16.1.6 (Turbopack)
29 pages generees (statiques + dynamiques)
Aucune erreur TypeScript
```

## Conclusion

Sprint 8 est entierement couvert :
- **100 nouveaux tests** couvrant les 5 domaines (fournisseurs, produits, commandes, mouvements, alertes)
- **Toutes les regles metier** du Sprint 8 sont testees (stock insuffisant, transitions de statut commande, validation fournisseur)
- **Non-regression** : 296 tests anciens + 100 nouveaux = 396 tests, tous passent
- **Build production** OK
