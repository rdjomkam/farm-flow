# Leçons — ADR-043 Modèle Associatif AssignationBac

**Date :** 2026-04-06
**ADR :** ADR-043 — Remplacement de Bac.vagueId par une table de jonction AssignationBac
**Source :** Pre-analyse + review de l'implémentation
**Maintenu par :** @knowledge-keeper

---

## Leçon 1 — Dual-write : toutes les mutations, pas seulement les créations

### Contexte

Quand une table associative (`AssignationBac`) est introduite en parallèle d'une FK existante
(`Bac.vagueId`) dans une migration en plusieurs phases (Phase 2 = double source de vérité),
il est naturel de penser à "créer l'AssignationBac quand on assigne un bac". Mais toutes les
opérations qui **modifient** les données du bac en cours de vague sont également des mutations
qui doivent être répercutées sur la table associative.

### Problème rencontré

La fonction `patchCalibrage` (et d'autres fonctions de modification) écrivait `nombrePoissons`,
`nombreInitial` et `poidsMoyenInitial` directement sur le modèle `Bac` sans mettre à jour
l'`AssignationBac` correspondante. Résultat : après un calibrage modifié ou un transfert de
poissons, `AssignationBac.nombrePoissons` divergeait de `Bac.nombrePoissons`. L'interface UI
lisait depuis la table associative et affichait des chiffres erronés.

### Fonctions impactées identifiées lors de la pré-analyse (à ne pas oublier)

Les fonctions suivantes touchent `bac.nombrePoissons` / `bac.vagueId` et DOIVENT toutes
dual-écrire vers `AssignationBac` pendant la Phase 2, et écrire exclusivement vers
`AssignationBac` en Phase 3 :

| Fonction | Fichier | Type de mutation |
|---|---|---|
| `assignerBac` | `src/lib/queries/bacs.ts` | Assignation initiale |
| `libererBac` | `src/lib/queries/bacs.ts` | Clôture assignation |
| `updateBac` | `src/lib/queries/bacs.ts` | Mise à jour nombrePoissons/nombreInitial/poidsMoyenInitial |
| `createVague` (tx.bac.update) | `src/lib/queries/vagues.ts` | Assignation + init nombrePoissons au stockage |
| `cloturerVague` (tx.bac.updateMany) | `src/lib/queries/vagues.ts` | Clôture de toutes les assignations |
| `addBacs` | `src/lib/queries/vagues.ts` | Ajout de bac(s) à une vague existante |
| `removeBacs` | `src/lib/queries/vagues.ts` | Retrait de bac(s) d'une vague |
| Transfert de poissons (lignes 280-292) | `src/lib/queries/vagues.ts` | Décrémente source, incrémente destination |
| `createCalibrage` (deux passes d'écriture) | `src/lib/queries/calibrages.ts` | Redistribution nombrePoissons bacs source/destination |
| Déduction vente (après ligne 114) | `src/lib/queries/ventes.ts` | Décrémente nombrePoissons proportionnellement |
| `transfererLotVersVague` | `src/lib/queries/lots-alevins.ts` | Assigne bacs à une nouvelle vague sans nombrePoissons |

### Leçon / Règle

**Lors d'une migration Phase 2 (double source de vérité), inventorier TOUTES les fonctions
qui mutent les champs migrés — pas seulement les fonctions "create/assign". Les fonctions
"update/patch/calibrate/sell" modifient les mêmes champs et doivent être incluses dans le
scope de dual-write dès le début.**

Protocole recommandé :
1. Faire un `grep -r "bac\.nombrePoissons\|bac\.vagueId\|tx\.bac\." src/lib/` AVANT d'écrire
   une seule ligne de code de migration.
2. Construire un tableau exhaustif des mutations (comme ci-dessus) et en faire un checklist
   de review obligatoire.
3. Ne pas se fier uniquement à la section "Impact" de l'ADR — la pré-analyse montre que des
   fonctions critiques peuvent être omises (patchCalibrage, updateBac, ventes, lots-alevins).

---

## Leçon 2 — Index unique partiel PostgreSQL : Prisma schema ne suffit pas

### Contexte

La contrainte métier "un bac ne peut être actif que dans une seule vague à la fois" se
traduit par : il ne peut exister qu'une seule `AssignationBac` avec `dateFin IS NULL` pour
un `bacId` donné.

### Problème

Prisma `schema.prisma` ne supporte pas les index uniques partiels (index avec clause `WHERE`).
Un `@@unique([bacId])` sans condition interdirait d'historiser les assignations passées. Un
`@@index([bacId])` sans `@unique` n'empêche pas les doublons actifs.

### Solution correcte

L'index doit être créé via une migration SQL manuelle, en dehors de ce que Prisma peut générer :

```sql
-- Dans la migration SQL (après CREATE TABLE "AssignationBac")
CREATE UNIQUE INDEX "AssignationBac_bacId_active_unique"
  ON "AssignationBac" ("bacId")
  WHERE "dateFin" IS NULL;
```

Ce que Prisma peut générer automatiquement ne couvre PAS cette contrainte. Elle doit être
ajoutée manuellement dans le fichier `migration.sql`.

### Workflow d'implémentation

1. Générer le SQL de base avec `prisma migrate diff --from-config-datasource --to-schema ... --script`
2. Inspecter le SQL généré (voir ERR-038 sur la dérive de schéma)
3. Ajouter manuellement l'index unique partiel APRÈS le `CREATE TABLE "AssignationBac"`
4. Appliquer avec `prisma migrate deploy` (workflow non-interactif, voir ERR-002)

### Leçon / Règle

**Pour toute contrainte d'unicité conditionnelle ("un seul X actif par Y"), un index unique
partiel PostgreSQL (`CREATE UNIQUE INDEX ... WHERE condition IS NULL`) est la seule garantie
au niveau base de données. Prisma schema ne peut pas l'exprimer. La contrainte DOIT être
ajoutée manuellement dans le SQL de migration.**

Pattern récurrent : "une seule ligne active par entité parente" — toujours vérifier si une
clause `WHERE` est nécessaire sur l'index d'unicité.

---

## Leçon 3 — Check-then-update : la vérification mémoire ne remplace pas l'atomicité (R4)

### Contexte

Avant d'assigner un bac à une vague, le code doit vérifier que le bac est libre (pas déjà
assigné à une vague active). Le pattern naif est :

```typescript
// ANTI-PATTERN (check-then-update non atomique)
const bac = await prisma.bac.findFirst({ where: { id: bacId } });
if (bac.vagueId !== null) throw new Error("Bac déjà occupé");
await prisma.bac.update({ where: { id: bacId }, data: { vagueId: newVagueId } });
```

### Problème

Deux requêtes concurrentes peuvent toutes les deux passer le `findFirst` avant que l'une
n'exécute le `update`. Les deux écriront sur le même bac, violant la contrainte métier.
Avec l'ancien modèle (`Bac.vagueId`), ce problème était partiellement atténué car `updateMany`
avec une condition `WHERE vagueId IS NULL` agit atomiquement. Avec `AssignationBac`, sans
index unique partiel, deux `INSERT` simultanés pourraient tous les deux réussir.

### Solution pour AssignationBac

L'index unique partiel de la Leçon 2 résout ce problème au niveau base de données : la
deuxième transaction en concurrence qui tente un `INSERT` avec `dateFin IS NULL` pour le
même `bacId` recevra une erreur PostgreSQL `unique_violation` (code `23505`). Ce cas doit
être géré explicitement dans le code :

```typescript
try {
  await prisma.assignationBac.create({
    data: { bacId, vagueId, dateDebut: new Date(), nombrePoissonsInitial, ... }
  });
} catch (e) {
  if (isPrismaUniqueError(e)) {
    throw new Error("Ce bac est déjà assigné à une vague active");
  }
  throw e;
}
```

### Pour l'ancien modèle (Bac.vagueId)

La règle R4 de Phase 2 documente le bon pattern : `updateMany` avec condition dans le `WHERE`
plutôt que `findMany + filter + update` :

```typescript
// BON PATTERN (R4 — atomique)
const updated = await prisma.bac.updateMany({
  where: { id: { in: bacIds }, vagueId: null, siteId },
  data: { vagueId: newVagueId }
});
if (updated.count !== bacIds.length) {
  throw new Error("Un ou plusieurs bacs sont déjà occupés");
}
```

### Leçon / Règle

**Ne jamais vérifier une condition de disponibilité en mémoire (findFirst/findMany + filter)
avant d'écrire. Utiliser soit (a) une contrainte unique partielle au niveau base de données
qui fait échouer l'INSERT concurrent, soit (b) un updateMany avec la condition de disponibilité
dans le WHERE et vérification du count retourné. Voir règle R4 dans CLAUDE.md.**

---

## Récapitulatif des entrées ERRORS-AND-FIXES correspondantes

Ces leçons complètent ou recoupent des erreurs déjà documentées dans
`docs/knowledge/ERRORS-AND-FIXES.md` :

- **ERR-002** : Workflow non-interactif `migrate diff` + `migrate deploy` (applicable ici
  pour ajouter l'index partiel manuel)
- **ERR-038** : Dérive de schéma dans `migrate diff` — inspecter le SQL généré avant deploy
- **ERR-049** : Migrations d'enum RECREATE — même workflow non-interactif requis

Pour documenter les bugs de dual-write ou d'index partiel lors de l'implémentation effective
d'ADR-043, créer des entrées ERR-050+ dans ERRORS-AND-FIXES.md avec le format standard.
