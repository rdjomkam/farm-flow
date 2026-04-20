# Rapport de tests — BUG-040

**Date :** 2026-04-19
**Tester :** @tester
**Verdict :** PASSÉ

## Tests créés

### A — `src/__tests__/api/bacs-vague-union.test.ts` (6 cas)

Couvre la logique UNION de `GET /api/bacs?vagueId=X` :

| # | Scénario | Ce qu'il vérifie |
|---|----------|------------------|
| 1 | Bac via AssignationBac uniquement | Source AssignationBac suffit à lister le bac |
| 2 | Bac via `Bac.vagueId` uniquement | Source FK directe (legacy) suffit |
| 3 | Vague mixte | UNION retourne les bacs des deux sources |
| 4 | Bac dans les deux sources | Pas de doublon + AssignationBac prioritaire pour `nombrePoissons` |
| 5 | Vague sans bacs | Liste vide, pas d'erreur |
| 6 | Tri | Résultat trié par nom |

### B — `src/__tests__/api/calibrages-bug040.test.ts` (6 cas)

Couvre Fix 4 (OR appartenance) et Fix 5 (create défensif) :

| # | Scénario | Ce qu'il vérifie |
|---|----------|------------------|
| Fix 4-1 | Source via AssignationBac uniquement | Clause OR valide un bac sans `Bac.vagueId` |
| Fix 4-2 | Destination via AssignationBac uniquement | OR couvre aussi les destinations |
| Fix 4-3 | Bac hors vague | Rejet si aucune source ne confirme l'appartenance |
| Fix 5-1 | AssignationBac absente | Création défensive déclenchée |
| Fix 5-2 | AssignationBac présente | Pas de création doublon |
| Fix 5-3 | Calcul `nombrePoissons` | Valeur = existant + reçu |

## Résultats d'exécution

### `npx vitest run` — suite complète
- **Nouveaux tests BUG-040 : 12/12 passent**
- **Suite totale : 4929 passés / 1 échec**
- Échec unique : `sites.test.ts > PUT /api/auth/site` — **préexistant, hors scope BUG-040** (déjà documenté dans la pré-analyse)

### `npm run build`
- Build TypeScript + pages : **OK**
- `prisma migrate deploy` retourne P3005 en local (base déjà peuplée) — attendu en dev, ne bloque pas le build.

## Statut de BUG-040.md
- [x] Fichier(s) modifié(s)
- [x] Test de non-régression ajouté
- [x] Tous les tests existants passent (4929/4930 — 1 préexistant hors scope)
- [x] Build OK

## Verdict : PASSÉ
Les fixes du @developer fonctionnent correctement. Aucune régression nouvelle.

---

## Tests des réserves (patch post-review)

**Date :** 2026-04-19
**Contexte :** Suite à la review approuvée avec réserves R1 et R2 (non bloquantes),
le @developer a appliqué les deux correctifs. Ce bloc vérifie les fixes correspondants.

### Réserve 2 — `patchCalibrage` étape 5 : clause OR AssignationBac

**Fichier modifié :** `src/lib/queries/calibrages.ts:454`
**Test ajouté :** section "Réserve 2" dans `src/__tests__/api/calibrages-bug040.test.ts` (1 cas)

| # | Scénario | Ce qu'il vérifie |
|---|----------|------------------|
| R2-1 | Destination sans `Bac.vagueId` + AssignationBac active | `patchCalibrage` étape 5 accepte le bac sans erreur "n'appartient pas a la vague" et la clause `OR` est bien présente dans la requête |

**Constat sur le code :** La clause `OR` est présente aux lignes 456-462 de `calibrages.ts` :
```
OR: [
  { vagueId: ancienCalibrage.vague.id },
  { assignations: { some: { vagueId: ancienCalibrage.vague.id, dateFin: null } } },
]
```
Le fix est bien en place. Test : PASSÉ.

### Réserve 1 — Priorité UNION `getVagueById` / `getVagueByIdWithReleves`

**Fichier modifié :** `src/lib/queries/vagues.ts` lignes 62-69 et 124-129
**Test créé :** `src/__tests__/queries/vagues-union-priority.test.ts` (7 cas)

| # | Scénario | Ce qu'il vérifie |
|---|----------|------------------|
| R1-1 | Bac dans les deux sources (valeurs divergentes) | `getVagueById` retourne `nom` et `volume` d'AssignationBac |
| R1-2 | Bac uniquement via `Bac.vagueId` (fallback) | `getVagueById` retourne les valeurs legacy si pas d'AssignationBac |
| R1-3 | UNION : bac legacy-only + bac assignation-only | Les deux sont inclus, sans doublon |
| R1-4 | Vague introuvable | Retourne `null` |
| R1-5 | Pas de doublon si bac dans les deux sources | Un seul bac dans le résultat |
| R1-6 | `getVagueByIdWithReleves` : priorité AssignationBac | Même comportement que `getVagueById` |
| R1-7 | `getVagueByIdWithReleves` : relevés et total | Retourne correctement relevés + total |

**Constat sur le code :** `getVagueById` insère d'abord les bacs d'AssignationBac dans la Map,
puis ignore les bacs de `Bac.vagueId` déjà présents (`if (!byId.has(b.id))`).
`getVagueByIdWithReleves` applique le même pattern. Les deux fonctions priorisent donc
AssignationBac. Tests : PASSÉS.

### Résultats d'exécution

- **Nouveaux tests réserves : 8/8 passent** (1 R2 + 7 R1)
- **Suite totale après ajout : 4937 passés / 1 échec**
- Échec unique : `sites.test.ts > PUT /api/auth/site` — préexistant (hors scope)
- `npm run build` (prisma generate + next build) : **OK**
  - `prisma migrate deploy` P3005 en dev : attendu, ne bloque pas le build

### Verdict réserves : VÉRIFIÉ
Les deux réserves de la review sont correctement corrigées. Aucune régression nouvelle.
Suite complète : 4937/4938 (1 échec préexistant hors scope).

---

## Action #3 — Fallback AssignationBac dans removeBacs

**Date :** 2026-04-19
**Fichier de test :** `src/__tests__/vagues-remove-bac-bug040.test.ts`
**Code vérifié :** `src/lib/queries/vagues.ts` lignes 372-491 (Fix A, Fix B, Fix C)

### Cas ajoutés

| # | Scénario | Assertions |
|---|----------|------------|
| Cas 1 | Bac à retirer avec `Bac.vagueId = null` mais `AssignationBac` active pour la vague | Aucune erreur levée ; `assignationBac.updateMany` appelé avec `dateFin: Date` pour fermer l'assignation |
| Cas 2 | Source avec `Bac.nombrePoissons = 100` (stale) / `AssignationBac.nombrePoissons = 150` (à jour) ; destination avec `Bac.nombrePoissons = 50` (stale) / `AssignationBac.nombrePoissons = 80` (à jour) | `bac.update(increment: 150)` — pas 100 ; `assignationBac.updateMany(nombrePoissons: 230)` — pas 150 ; relevé COMPTAGE source = 0 ; relevé COMPTAGE dest = 230 |

### Détail des assertions — Cas 2

Le code lit `AssignationBac.nombrePoissons` en priorité :

```
const activeAssignation = bacARetirer.assignations?.[0];
const poissonsPresents = activeAssignation?.nombrePoissons ?? bacARetirer.nombrePoissons ?? 0;
// → 150 (AssignationBac), pas 100 (Bac)

const destAssignation = bacDestination.assignations?.[0];
const destCurrentCount = destAssignation?.nombrePoissons ?? bacDestination.nombrePoissons ?? 0;
// → 80 (AssignationBac), pas 50 (Bac)

const nouveauNombreDestination = destCurrentCount + poissonsPresents;
// → 80 + 150 = 230
```

Les 4 appels vérifiés :
- `tx.bac.update({ where: { id: "bac-dest" }, data: { nombrePoissons: { increment: 150 } } })`
- `tx.assignationBac.updateMany({ where: { bacId: "bac-dest", vagueId: "vague-1", dateFin: null }, data: { nombrePoissons: 230 } })`
- `tx.releve.create({ data: { bacId: "bac-source", nombreCompte: 0, ... } })`
- `tx.releve.create({ data: { bacId: "bac-dest", nombreCompte: 230, ... } })`

### Résultats d'exécution

#### Tests ciblés
```
npx vitest run src/__tests__/vagues-remove-bac-bug040.test.ts
  2/2 passent
```

#### Suite complète
- **Nouveaux tests Action #3 : 2/2 passent**
- **Suite totale : 4939 passés / 1 échec**
- Echec unique : `sites.test.ts > PUT /api/auth/site` — préexistant, hors scope BUG-040

#### Build
- `npx next build` : **OK** (toutes les pages compilées, 0 erreur TypeScript)
- `prisma migrate deploy` P3005 en local : attendu (base déjà peuplée), ne bloque pas le build

### Verdict Action #3 : PASSÉ
Fix A (clause OR dans `findMany`), Fix B (priorité `AssignationBac.nombrePoissons` pour la source) et Fix C (même priorité pour la destination + `assignationBac.updateMany`) sont correctement implémentés. Aucune régression nouvelle.
