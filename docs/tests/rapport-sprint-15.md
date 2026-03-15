# Rapport de Tests — Sprint 15

**Date :** 2026-03-15
**Testeur :** @tester
**Sprint :** 15 — Upload Facture sur Commande

---

## Résumé

| Métrique | Valeur |
|---------|--------|
| Tests base (Sprints 1-14) | 1079 |
| Nouveaux tests Sprint 15 | 23 |
| **Total** | **1102** |
| **Résultat** | **1102/1102 passent — 0 échec** |
| Build production | OK |
| Fichiers de test | 38 |

---

## Nouveau fichier de test

### `src/__tests__/api/commandes-facture.test.ts` — 23 tests

Ce fichier couvre les 4 nouvelles routes (POST, GET, DELETE /api/commandes/[id]/facture) et les modifications à POST /api/commandes/[id]/recevoir.

---

## Cas de test couverts

### Suite `POST /api/commandes/[id]/facture` — 9 tests

| # | Cas de test | Résultat |
|---|-------------|---------|
| 1 | Upload PDF → 201 + signed URL + fileName | OK |
| 2 | Upload JPG → 201 | OK |
| 3 | Upload PNG → 201 | OK |
| 4 | Type MIME invalide (application/octet-stream) → 400 | OK |
| 5 | Fichier trop volumineux (> 10 Mo) → 400 | OK |
| 6 | Champ file manquant dans FormData → 400 | OK |
| 7 | Commande introuvable → 404 | OK |
| 8 | Non authentifié → 401 | OK |
| 9 | Permission manquante → 403 | OK |
| 10 | Ancienne facture supprimée avant upload si existante | OK |

### Suite `GET /api/commandes/[id]/facture` — 4 tests

| # | Cas de test | Résultat |
|---|-------------|---------|
| 1 | Facture existante → 200 + signed URL valide + fileName | OK |
| 2 | Commande introuvable → 404 | OK |
| 3 | Pas de facture attachée → 404 | OK |
| 4 | Permission manquante → 403 | OK |

### Suite `DELETE /api/commandes/[id]/facture` — 4 tests

| # | Cas de test | Résultat |
|---|-------------|---------|
| 1 | Suppression → 200 + fichier supprimé sur S3 + factureUrl = null en DB | OK |
| 2 | Commande introuvable → 404 | OK |
| 3 | Pas de facture à supprimer → 404 | OK |
| 4 | Non authentifié → 401 | OK |

### Suite `POST /api/commandes/[id]/recevoir` (Sprint 15) — 5 tests

| # | Cas de test | Résultat |
|---|-------------|---------|
| 1 | JSON sans fichier → 200, upload non appelé (comportement inchangé) | OK |
| 2 | FormData avec fichier → 200 + upload effectué | OK |
| 3 | FormData sans fichier → 200, upload non appelé | OK |
| 4 | FormData avec fichier invalide → 400, recevoirCommande non appelé | OK |
| 5 | Permission manquante → 403 | OK |

---

## Couverture fonctionnelle Sprint 15

| Fonctionnalité | Couverte |
|---------------|---------|
| Upload PDF, JPG, PNG | Oui (3 tests) |
| Rejet type MIME invalide | Oui (1 test) |
| Rejet fichier trop grand | Oui (1 test) |
| Rejet champ file manquant | Oui (1 test) |
| Signed URL expire après 1h | Oui (mock getSignedUrl appelé) |
| Suppression fichier S3 + factureUrl null | Oui (1 test) |
| Réception avec facture en FormData | Oui (1 test) |
| Réception sans facture (rétro-compat) | Oui (2 tests : JSON et FormData) |
| Permissions APPROVISIONNEMENT_GERER | Oui (3 tests 403) |
| siteId sur toutes les routes | Oui (filtre WHERE { id, siteId }) |

---

## Non-régression

Tous les tests des Sprints 1-14 passent sans modification :

| Sprint | Tests |
|--------|-------|
| 1-14 base | 1079 |
| Sprint 15 nouveaux | 23 |
| **Total** | **1102** |

Aucune régression détectée.

---

## Build production

```
npm run build — résultat : OK
Aucune erreur TypeScript
Toutes les routes compilées
```

---

## Conclusion

Le Sprint 15 est implémenté et testé :
- 5 stories livrées (15.1 schema, 15.2 storage, 15.3 types, 15.4 API, 15.5 UI)
- 23 nouveaux tests couvrant tous les cas critiques
- 1102/1102 tests passent, build OK
- Prêt pour la review @code-reviewer
