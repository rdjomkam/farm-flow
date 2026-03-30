# Rapport de tests — Survie calculs & removeBac fixes

**Date :** 2026-03-30
**Auteur :** @tester
**Sprint :** Verification fixes survie (computeVivantsByBac, removeBac, getIndicateursVague)

---

## Step 1 — Suite existante avant ajout des nouveaux tests

**Resultat :** 1 fichier en echec | 119 fichiers passes | 3778 tests passes | 2 echecs connus

Echecs pre-existants (non-regression, sans rapport avec les fixes) :

| Test | Fichier | Raison |
|------|---------|--------|
| `(ingenieur)/settings/config-elevage/ existe` | `route-boundaries.test.ts:128` | Chemin FS absent — bug connu, route sous `(farm)` |
| `(farm)/settings/config-elevage/ n'existe PAS` | `route-boundaries.test.ts:144` | Coherent avec ci-dessus |

**Build :** `npm run build` — compile avec succes (✓ Compiled successfully in 11.3s).

---

## Step 2 — Nouveaux fichiers de tests ecrits

### `src/__tests__/survie-calculs.test.ts` (16 tests)

Teste `computeVivantsByBac` et `computeNombreVivantsVague` de `src/lib/calculs.ts`.

| # | Description | Resultat |
|---|-------------|----------|
| 1 | Soustraction morts post-COMPTAGE : COMPTAGE j5=480, morts j6+j7=5 → 475 | PASSE |
| 2 | COMPTAGE sans morts apres → vivants = compte exact | PASSE |
| 3 | Aucun COMPTAGE : fallback initial - totalMorts | PASSE |
| 4 | Aucune mort, aucun COMPTAGE : vivants = nombreInitial | PASSE |
| 5 | Bacs A (COMPTAGE j3) et B (COMPTAGE j5) : mort j4 soustrait A, pas B | PASSE |
| 6 | bac.nombreInitial=null : repartition uniforme depuis vague | PASSE |
| 7 | Morts avant COMPTAGE non soustraits en post-comptage | PASSE |
| 8 | Agregation multi-bacs : somme correcte | PASSE |
| 9 | bacs=[] + COMPTAGE global + morts apres → soustraction correcte | PASSE |
| 10 | bacs=[] + COMPTAGE sans morts apres → compte exact | PASSE |
| 11 | bacs=[] sans COMPTAGE → initial - totalMorts | PASSE |
| 12 | Releves sans date (undefined) → ne plante pas | PASSE |
| 13 | COMPTAGE sans date → traite comme epoch (toutes morts apres) | PASSE |
| 14 | Aucun releve → vivants = nombreInitial | PASSE |
| 15 | bacs=[] + releves=[] → vivants = nombreInitial | PASSE |
| 16 | Morts a la meme date exacte que COMPTAGE non soustraits (strict >) | PASSE |

### `src/__tests__/vagues-remove-bac.test.ts` (8 tests)

Teste la logique de retrait de bac dans `updateVague` de `src/lib/queries/vagues.ts`.
Mock complet de Prisma via `prisma.$transaction` executant le callback directement.

| # | Description | Resultat |
|---|-------------|----------|
| 1 | `transferDestinationBacId` dans `removeBacIds` → erreur metier | PASSE |
| 2 | Bac avec poissons + sans destination → erreur contient nom du bac | PASSE |
| 3 | Bac avec poissons + sans destination → erreur contient count de poissons | PASSE |
| 4 | Retrait bac vide : `vague.nombreInitial` non decremente | PASSE |
| 5 | Retrait bac vide : aucun releve COMPTAGE cree | PASSE |
| 6 | Retrait avec transfert : 2 releves COMPTAGE crees (source=0, dest=nouveau total) | PASSE |
| 7 | Retrait dernier bac → erreur "au moins un bac" | PASSE |
| 8 | Vague introuvable → erreur "Vague introuvable" | PASSE |

### `src/__tests__/indicateurs-nombreinitial.test.ts` (7 tests)

Teste que `getIndicateursVague` utilise toujours `vague.nombreInitial` comme denominateur du taux de survie.
Mock complet de Prisma.

| # | Description | Resultat |
|---|-------------|----------|
| 1 | `vague.nombreInitial` > somme bacs : survie = vivants / vague.nombreInitial | PASSE |
| 2 | Bac ajoute en cours de vague : tauxSurvie = 450/500 = 90% | PASSE |
| 3 | Aucun bac attache : fallback global, denominateur = vague.nombreInitial | PASSE |
| 4 | Aucune mortalite → tauxSurvie = 100 | PASSE |
| 5 | Mortalite totale → tauxSurvie = 0 | PASSE |
| 6 | Vague introuvable → null | PASSE |
| 7 | Avec COMPTAGE : denominateur reste vague.nombreInitial (pas le comptage) | PASSE |

---

## Step 3 — Suite complete apres ajout

**Resultat :** 1 fichier en echec | 122 fichiers passes | 3807 tests passes | 2 echecs (pre-existants)

Comparaison avant/apres :

| Metrique | Avant | Apres |
|----------|-------|-------|
| Fichiers passes | 119 | 122 (+3) |
| Tests passes | 3776 | 3807 (+31) |
| Tests en echec | 2 | 2 (inchanges) |
| Fichiers en echec | 1 | 1 (inchange) |

---

## Synthese

- Les 3 fichiers de tests crees couvrent 31 cas de test supplementaires.
- Tous les nouveaux tests passent (16 + 8 + 7 = 31 tests, 0 echec).
- Les 2 echecs pre-existants dans `route-boundaries.test.ts` sont connus, sans rapport avec les fixes de survie.
- Le build Next.js passe sans erreur.

---

## Logique metier verifiee

### Fix 1 — computeVivantsByBac

Algorithme correct :
- Si COMPTAGE existe pour un bac : `vivants = dernierComptage.nombreCompte - somme(morts ou date > comptageDate)`
- Sinon : `vivants = bac.nombreInitial ?? (vague.nombreInitial / nbBacs) - totalMortsBac`
- Bacs sans date dans les releves ne causent pas de crash (fallback `new Date(0)`)

### Fix 2 — removeBac

Gardes correctes :
- Destination dans les sources → erreur immediate
- Bac non vide sans destination → erreur avec nom et count
- `vague.nombreInitial` jamais decremente (commentaire `// Fix 4` confirme)

### Fix 3 — getIndicateursVague

Denominateur de survie :
- `nombreInitialEffectif = vague.nombreInitial` (ligne 168 de indicateurs.ts)
- La somme des `bac.nombreInitial` n'est utilise que pour le calcul du poids initial pondere
- tauxSurvie = calculerTauxSurvie(nombreVivants, vague.nombreInitial) — correct
