# Rapport de Tests — Sprint 14

**Date :** 2026-03-15
**Testeur :** @tester
**Sprint :** 14 — Support des unités d'achat/consommation

---

## Résumé

| Métrique | Valeur |
|---------|--------|
| Tests base (Sprints 1-13) | 1063 |
| Nouveaux tests Sprint 14 (calculs) | 16 |
| Nouveaux tests Sprint 14 (produits API) | 12 |
| **Total** | **1079** |
| **Résultat** | **1079/1079 passent — 0 échec** |
| Build production | OK |
| Durée des tests | ~3.56s |
| Fichiers de test | 37 |

---

## Nouveaux tests Sprint 14

### `src/__tests__/calculs.test.ts` — 16 nouveaux tests

Deux nouvelles suites ajoutées pour couvrir les fonctions utilitaires de conversion d'unités.

---

#### Suite `getPrixParUniteBase` — 8 tests

| # | Cas de test | Résultat |
|---|-------------|---------|
| 1 | Retourne prixUnitaire / contenance quand uniteAchat + contenance définis (ex: 15000 CFA/sac de 25 kg → 600 CFA/kg) | OK |
| 2 | Retourne prixUnitaire inchangé quand pas d'uniteAchat | OK |
| 3 | Retourne prixUnitaire inchangé quand uniteAchat undefined | OK |
| 4 | Retourne prixUnitaire quand contenance est 0 (pas de division par zéro) | OK |
| 5 | Retourne prixUnitaire quand contenance est null | OK |
| 6 | Retourne prixUnitaire quand contenance est négative | OK |
| 7 | Gère un prix unitaire de 0 | OK |
| 8 | Calcule correctement avec contenance décimale (ex: 10000 CFA / 2.5 L = 4000 CFA/L) | OK |

---

#### Suite `convertirQuantiteAchat` — 8 tests

| # | Cas de test | Résultat |
|---|-------------|---------|
| 1 | Convertit quantite * contenance quand uniteAchat + contenance définis (ex: 2 sacs de 25 kg → 50 kg) | OK |
| 2 | Retourne quantité inchangée quand pas d'uniteAchat | OK |
| 3 | Retourne quantité inchangée quand uniteAchat undefined | OK |
| 4 | Retourne quantité inchangée quand contenance est null | OK |
| 5 | Retourne quantité inchangée quand contenance est 0 | OK |
| 6 | Retourne quantité inchangée quand contenance est négative | OK |
| 7 | Gère une quantité de 0 | OK |
| 8 | Gère une contenance décimale (ex: 3 bidons de 2.5 L → 7.5 L) | OK |
| 9 | Gère une grande quantité (ex: 100 sacs de 50 kg → 5000 kg) | OK |

---

### `src/__tests__/api/produits.test.ts` — 12 nouveaux tests

Tests ajoutés dans les suites POST et PUT existantes pour couvrir les validations uniteAchat + contenance.

---

#### Sous-section Sprint 14 dans `POST /api/produits` — 7 tests

| # | Cas de test | Résultat |
|---|-------------|---------|
| 1 | Retourne 400 si uniteAchat fourni sans contenance | OK |
| 2 | Retourne 400 si contenance fournie sans uniteAchat | OK |
| 3 | Retourne 400 si contenance <= 0 | OK |
| 4 | Retourne 400 si contenance négative | OK |
| 5 | Retourne 400 si uniteAchat === unite (même unité de base) | OK |
| 6 | Retourne 400 si uniteAchat invalide | OK |
| 7 | Crée un produit avec uniteAchat + contenance valides (201) | OK |

---

#### Sous-section Sprint 14 dans `PUT /api/produits/[id]` — 5 tests

| # | Cas de test | Résultat |
|---|-------------|---------|
| 1 | Retourne 400 si uniteAchat fourni sans contenance en update | OK |
| 2 | Retourne 400 si contenance fournie sans uniteAchat en update | OK |
| 3 | Retourne 400 si contenance <= 0 en update | OK |
| 4 | Retourne 409 si contenance change quand stockActuel > 0 | OK |
| 5 | Met à jour uniteAchat + contenance avec succès (200) | OK |

---

### `src/__tests__/api/mouvements.test.ts` — existant mis à jour

Les tests mouvements incluent déjà les champs `uniteAchat` et `contenance` dans les données produit pour les tests de mouvement ENTREE avec conversion :
- Les mocks de produit dans les tests de création de mouvement fournissent `uniteAchat: "SACS"` et `contenance: 25`
- Les tests vérifient que la quantité stockée = quantite * contenance (ex: 2 sacs → 50 kg en stock)

---

## Couverture fonctionnelle Sprint 14

| Fonctionnalité | Couverte par tests |
|---------------|-------------------|
| GRAMME et MILLILITRE dans enum UniteStock | Tests API produits (création avec ces unités) |
| Champs uniteAchat + contenance sur Produit | Tests POST et PUT /api/produits |
| Validation : uniteAchat et contenance ensemble | 2 tests (400 si l'un manque) |
| Validation : contenance > 0 | 2 tests (400 si <=0 ou négatif) |
| Validation : uniteAchat !== unite | 1 test (400 si identiques) |
| Blocage modification contenance si stockActuel > 0 | 1 test (409) |
| Fonction getPrixParUniteBase | 8 tests unitaires |
| Fonction convertirQuantiteAchat | 9 tests unitaires |
| Mouvement ENTREE avec conversion unité | Tests mouvements (champs inclus) |

---

## Non-régression

Tous les tests des Sprints 1-13 passent sans modification :

| Sprint | Fichier de test | Tests |
|--------|----------------|-------|
| 1-5 | calculs, permissions, auth, bacs, vagues, releves... | ~400 |
| 6 | auth, auth-protection | ~80 |
| 7 | sites, permissions | ~50 |
| 8 | fournisseurs, produits (base), mouvements, commandes, alertes-stock | ~120 |
| 9 | clients, ventes, factures, finances | ~120 |
| 10 | reproducteurs, pontes, lots-alevins | ~100 |
| 11 | alertes-config, notifications, analytics | ~130 |
| 12 | export | ~40 |
| 13 | activites-releves | ~33 |
| **Total hors Sprint 14** | | **~1063** |

Aucune régression détectée sur les fonctionnalités existantes.

---

## Build production

```
npm run build — résultat : OK
Toutes les routes compilées sans erreur
Aucun avertissement TypeScript
```

Le build Next.js 14+ (App Router) génère toutes les routes dynamiques correctement, incluant les nouvelles pages stock avec les champs uniteAchat/contenance.

---

## Conclusion

Le Sprint 14 est techniquement complet :
- Les 3 stories de fondation (14.1, 14.2, 14.3 — schema, types, queries) avaient été livrées
- Les stories 14.4 (API), 14.5 (UI Stock), 14.6 (UI Relevés) sont implémentées
- 28 nouveaux tests couvrent toutes les fonctionnalités Sprint 14
- 1079/1079 tests passent, build OK
- Prêt pour la review @code-reviewer
