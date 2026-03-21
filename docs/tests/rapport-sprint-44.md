# Rapport de tests — Sprint 44
**Sprint :** 44 — "Packs lies aux plans + Abonnement automatique"
**Testeur :** @tester
**Date :** 2026-03-21
**Statut global :** VALIDE

---

## 1. Perimetre teste

Sprint 44 lie `Pack.planId` a `PlanAbonnement` (remplacement de `Pack.enabledModules`) et
introduit `createAbonnementFromPack()` pour creer automatiquement un abonnement lors de
l'activation d'un pack.

### Fichiers de la logique metier
- `src/lib/abonnements/create-from-pack.ts` — Story 44.4
- `src/lib/queries/provisioning.ts` — integration abonnement dans `activerPack`
- `src/app/api/packs/route.ts` — validation `planId` obligatoire

---

## 2. Nouveaux fichiers de test

| Fichier | Tests | Statut |
|---------|-------|--------|
| `src/__tests__/lib/create-from-pack.test.ts` | 18 | PASS |
| `src/__tests__/api/packs-sprint44.test.ts` | 8 | PASS |

**Total nouveaux tests Sprint 44 : 26/26 passes**

---

## 3. Resultats des nouveaux tests

### 3.1 `createAbonnementFromPack` — tests unitaires (18 tests)

#### Pack DECOUVERTE (3 tests)
- `cree un abonnement ACTIF avec prixPaye = 0` — PASS
  - prixPaye est bien 0 car TypePlan.DECOUVERTE retourne 0 depuis `calculatePrixPaye`
- `appelle abonnement.create avec statut ACTIF et planId correct` — PASS
- `la dateFin est environ 1 mois apres dateDebut (MENSUEL)` — PASS
  - Verifiee par delta en ms : entre 28 et 32 jours

#### Pack PROFESSIONNEL (4 tests)
- `cree abonnement MENSUEL avec prixPaye = prixMensuel du plan (15000)` — PASS
- `cree abonnement TRIMESTRIEL avec prixPaye = prixTrimestriel du plan (40000)` — PASS
- `cree abonnement ANNUEL avec prixPaye = prixAnnuel du plan (140000)` — PASS
- `dateFin ANNUEL est environ 12 mois apres dateDebut` — PASS
  - Verifiee par delta : entre 363 et 367 jours

#### Renouvellement — meme plan (4 tests)
- `met a jour l'abonnement existant (update, pas create)` — PASS
  - `abonnement.update` appele une fois, `abonnement.create` pas appele
- `la nouvelle dateFin est etendue depuis l'ancienne dateFin (si dans le futur)` — PASS
  - La nouvelle dateFin est posterieure a l'ancienne
- `renouvelle depuis now si l'ancienne dateFin est dans le passe` — PASS
  - Si la dateFin actuelle est depassee, la base est `now` et pas l'ancienne dateFin
- `preserve le statut ACTIF lors du renouvellement` — PASS
  - `dateFinGrace` mis a null, `statut = ACTIF`

#### Changement de plan (3 tests)
- `annule l'ancien abonnement avant de creer le nouveau` — PASS
  - `update` avec `statut ANNULE` sur l'ID de l'ancien, puis `create` avec le nouveau planId
- `le nouvel abonnement a prixPaye du nouveau plan` — PASS
- `le nouvel abonnement DECOUVERTE a prixPaye = 0 meme si l'ancien etait payant` — PASS

#### Cas d'erreur (2 tests)
- `throw si le pack est introuvable` — PASS
  - Message : `Pack pack-inexistant introuvable`
  - `abonnement.create` et `update` non appeles
- `throw si le pack n'a pas de plan associe` — PASS
  - Message contient `n'a pas de plan associ`

#### Modules et periode par defaut (2 tests)
- `appelle applyPlanModulesTx avec siteId et planId corrects` — PASS
- `utilise MENSUEL comme periode par defaut si non fournie` — PASS

---

### 3.2 API Packs — Sprint 44 (8 tests)

#### POST /api/packs — planId obligatoire (5 tests)
- `retourne 400 si planId est absent` — PASS
  - Message contient "plan"
- `retourne 400 si planId est une chaine vide` — PASS
- `retourne 400 si planId n'est pas une chaine` — PASS
- `cree un pack (201) quand planId est valide` — PASS
- `passe planId a createPack` — PASS
  - `createPack` appele avec `{ planId: "plan-decouverte" }` dans les args

#### PUT /api/packs/[id] — mise a jour planId (2 tests)
- `met a jour le planId avec succes (200)` — PASS
- `passe planId a updatePack quand fourni` — PASS
  - Signature verifiee : `updatePack(id, siteId, body)` — 3 arguments

#### Absence de enabledModules (1 test)
- `createPack n'est pas appele avec enabledModules` — PASS

---

## 4. Verification grep : absence de `pack.enabledModules` / `Pack.enabledModules`

```
grep -r "pack\.enabledModules\|Pack\.enabledModules" src/ --include="*.ts" --include="*.tsx"
```

Resultat : **CLEAN — aucune occurrence trouvee dans les fichiers source non-generes.**

---

## 5. Correction de non-regression : `packs.test.ts`

Le test pre-existant `POST /api/packs > cree un pack valide` echouait car Sprint 44 a
rendu `planId` obligatoire, et le corps du test ne l'incluait pas.

**Fix applique :** ajout de `planId: "plan-decouverte"` dans le corps de la requete et
ajout du champ `planId` + `plan` dans la fixture `FAKE_PACK`.

Ce test passe desormais (31/31 dans `packs.test.ts`).

---

## 6. Suite complete de tests

| Metrique | Avant Sprint 44 | Apres Sprint 44 |
|----------|-----------------|-----------------|
| Tests passes | 2849 | 2876 (+27) |
| Tests echoues | 197 (pre-existants) | 196 (pre-existants) |
| Nouveaux tests Sprint 44 | — | 26 (create-from-pack + packs-sprint44) |
| Correction non-regression | — | 1 (packs.test.ts) |

Les 196 echecs restants sont tous pre-existants aux Sprints 42-44 (benchmarks,
vagues, sites, remises-verifier, components UI). Aucun n'est imputable au Sprint 44.

---

## 7. Build production

```
npm run build → Compiled successfully in 31.6s
```

**Build : OK — aucune erreur TypeScript ni erreur de compilation.**

---

## 8. Checklist R1-R9

| Regle | Statut |
|-------|--------|
| R1 — Enums MAJUSCULES | OK — TypePlan.DECOUVERTE, StatutAbonnement.ACTIF, etc. |
| R2 — Imports enums | OK — imports depuis `@/types` dans tous les nouveaux fichiers |
| R3 — Prisma = TypeScript | OK — Abonnement retourne `prixPaye: Number(...)` (Decimal → number) |
| R4 — Opérations atomiques | OK — `$transaction` dans `createAbonnementFromPack` |
| R7 — Nullabilite explicite | OK — `prixMensuel: null` gere → prixPaye = 0 |
| R8 — siteId PARTOUT | OK — siteId obligatoire dans `abonnement.create` |
| R9 — Tests avant review | OK — `npx vitest run` + `npm run build` executes |

---

## 9. Conclusion

Sprint 44 est valide. Les 26 nouveaux tests couvrent l'integralite de la logique
introduite :

1. `createAbonnementFromPack` — tous les cas (DECOUVERTE, payant, renouvellement,
   changement de plan, erreurs)
2. API POST/PUT /api/packs — `planId` obligatoire et mise a jour
3. Absence confirmee de `pack.enabledModules` dans le code source

La correction de non-regression sur `packs.test.ts` est incluse dans ce sprint.
