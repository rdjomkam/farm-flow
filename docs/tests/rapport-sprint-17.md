# Rapport de tests — Sprint 17 (Besoins + Workflow)

## Résultat global
- **Tests :** 1146 / 1146 passent (40 fichiers)
- **Build :** OK (`npm run build` — aucune erreur TypeScript)
- **Seed :** OK (`npm run db:seed` — 3 listes de besoins + 8 lignes insérées)
- **Migration :** OK (`20260316100000_add_besoins` — applied)

## Nouveaux tests (25)

### `src/__tests__/api/besoins.test.ts` — 25 tests

**Workflow — transitions valides** (3 tests)
- SOUMISE → APPROUVEE via approuverBesoins
- SOUMISE → REJETEE via rejeterBesoins (avec motif)
- TRAITEE → CLOTUREE via cloturerBesoins — calcul montantReel correct

**Workflow — transitions invalides** (3 tests)
- REJETEE → APPROUVEE est refusée
- CLOTUREE → TRAITEE est refusée
- APPROUVEE → REJETEE est refusée

**GET /api/besoins** (2 tests)
- Retourne 200 avec liste des besoins
- Retourne 403 sans permission BESOINS_SOUMETTRE

**POST /api/besoins** (4 tests)
- Retourne 201 avec liste créée
- Retourne 400 si titre manquant
- Retourne 400 si lignes vides
- Retourne 403 sans permission BESOINS_SOUMETTRE

**GET /api/besoins/[id]** (2 tests)
- Retourne 200 avec la liste de besoins
- Retourne 404 si liste introuvable

**DELETE /api/besoins/[id]** (2 tests)
- Retourne 200 et supprime une liste SOUMISE
- Retourne 400 si liste n'est plus SOUMISE

**POST /api/besoins/[id]/approuver** (3 tests)
- Retourne 200 avec liste APPROUVEE
- Retourne 400 si transition invalide (REJETEE → APPROUVEE)
- Retourne 403 sans permission BESOINS_APPROUVER

**POST /api/besoins/[id]/rejeter** (1 test)
- Retourne 200 avec liste REJETEE et motif

**POST /api/besoins/[id]/traiter** (3 tests)
- Retourne 400 si ligneActions manquant
- Retourne 403 sans permission BESOINS_TRAITER
- Retourne 200 après traitement réussi (commande + dépense créés)

**POST /api/besoins/[id]/cloturer** (2 tests)
- Retourne 400 si lignesReelles manquant
- Retourne 200 après clôture réussie (montantReel calculé correctement)

## Non-régression

Aucune régression — 1121 tests Sprint 1-16 continuent de passer.

## Vérification R9
- `npx vitest run` : 1146/1146 tests passent (40 fichiers)
- `npm run build` : compilation TypeScript OK, aucune erreur
- `npm run db:seed` : seed exécuté sans erreur (3 listes + 8 lignes insérées)
- `npx prisma migrate deploy` : migration appliquée sans erreur
