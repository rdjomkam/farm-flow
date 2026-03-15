# Rapport de tests — Sprint 16 (Dépenses base)

## Résultat global
- **Tests :** 1121 / 1121 passent (39 fichiers)
- **Build :** OK (`npm run build` — aucune erreur TypeScript)
- **Seed :** OK (`npm run db:seed` — 5 dépenses + 4 paiements insérés)
- **Migration :** OK (`20260315110000_add_depenses` — applied)

## Nouveaux tests (19)

### `src/__tests__/api/depenses.test.ts` — 19 tests

**ajouterPaiementDepense — paiement partiel** (5 tests)
- Crée un paiement partiel et passe en PAYEE_PARTIELLEMENT
- Passe en PAYEE quand le montant total est atteint
- Refuse un surpaiement (montant > resteAPayer)
- Refuse d'ajouter un paiement sur une dépense PAYEE
- Lève une erreur si dépense introuvable

**GET /api/depenses** (2 tests)
- Retourne 200 avec liste des dépenses
- Retourne 403 sans permission DEPENSES_VOIR

**POST /api/depenses** (4 tests)
- Retourne 201 avec dépense créée
- Retourne 400 si description manquante
- Retourne 400 si montant négatif
- Retourne 403 sans permission DEPENSES_CREER

**GET /api/depenses/[id]** (2 tests)
- Retourne 200 avec la dépense
- Retourne 404 si dépense introuvable

**DELETE /api/depenses/[id]** (3 tests)
- Retourne 200 et supprime la dépense NON_PAYEE
- Retourne 409 si dépense a des paiements (statut PAYEE_PARTIELLEMENT)
- Retourne 404 si dépense introuvable

**POST /api/depenses/[id]/paiements** (3 tests)
- Retourne 201 avec paiement créé
- Retourne 400 si montant manquant
- Retourne 403 sans permission DEPENSES_PAYER

## Tests corrigés (non-régression Sprint 16)

### `src/__tests__/api/commandes.test.ts` — 2 tests mis à jour
- `recevoirCommande` retourne maintenant `{ commande, depense }` (Sprint 16)
- Tests mis à jour : mock + assertion `data.commande.statut` (au lieu de `data.statut`)

### `src/__tests__/api/commandes-facture.test.ts` — 1 test mis à jour
- Mock `mockRecevoirCommande.mockResolvedValue({ commande: {...}, depense: null })`

### `src/__tests__/permissions.test.ts` — 2 tests mis à jour
- "10 groupes" → "11 groupes" (ajout groupe `depenses`)
- Titre du test dynamique mis à jour

## Vérification R9
- `npx vitest run` : 1121/1121 tests passent
- `npm run build` : compilation TypeScript OK, aucune erreur
- `npm run db:seed` : seed exécuté sans erreur
- `npx prisma migrate deploy` : migration appliquée sans erreur
