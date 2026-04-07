# Pré-analyse R1-S3 — Nouveaux modèles : LotGeniteurs, Incubation, TraitementIncubation

**Date :** 2026-04-07
**Story :** R1-S3 — Ajout de 3 nouveaux modèles Prisma (ADR-044 §3.2, §3.4, §3.5)
**Dépendance déclarée :** R1-S1 (DONE)
**Auteur :** @pre-analyst

---

## Statut : GO AVEC RÉSERVES

---

## Résumé

Les 6 enums utilisés par les 3 nouveaux modèles sont présents dans le schéma (R1-S1 confirmé). Les FK cibles `Bac`, `Site` et `Ponte` existent. Aucun conflit de nommage n'est détecté. Cependant, deux incohérences bloquantes héritées de R1-S1 (non-compliance partielle) doivent être documentées : `StatutReproducteur` est toujours incomplet (`EN_REPOS` et `SACRIFIE` absents) et `TypeReleve` n'a pas encore `TRI`. Ces deux gaps n'empêchent pas les 3 modèles cibles de R1-S3, mais ils bloquent les stories R1-S2 (extension Reproducteur) et R1-S5 (extension LotAlevins). Par ailleurs, l'intégration de `LotGeniteurs` dans `Ponte` implique des modifications non triviales du modèle `Ponte` existant qui doivent être coordonnées avec la story portant sur la révision de ce modèle.

---

## Vérifications effectuées

### Schema — Enums requis par R1-S3 : OK

Les 6 enums utilisés par les 3 nouveaux modèles sont tous présents dans `prisma/schema.prisma` :

| Enum | Ligne dans le schéma | Modèle utilisateur |
|---|---|---|
| `SexeReproducteur` | 436 | `LotGeniteurs.sexe` |
| `SourcingGeniteur` | 507 | `LotGeniteurs.sourcing` |
| `GenerationGeniteur` | 499 | `LotGeniteurs.generation` |
| `StatutReproducteur` | 441 | `LotGeniteurs.statut` |
| `SubstratIncubation` | 556 | `Incubation.substrat` |
| `StatutIncubation` | 567 | `Incubation.statut` |

### Schema — FK cibles : OK

| FK cible | Modèle source | Présent dans le schéma |
|---|---|---|
| `Bac` | `LotGeniteurs.bacId` | Oui (ligne 1061) |
| `Ponte` | `Incubation.ponteId` | Oui (ligne 1536) |
| `Incubation` | `TraitementIncubation.incubationId` | Non encore — modèle à créer dans cette story |
| `Site` | Tous 3 | Oui (ligne 594) |

La FK `TraitementIncubation → Incubation` est une dépendance intra-story (les deux modèles sont créés ensemble) : pas de problème.

### Schema — Conflits de nommage : OK

Aucun modèle nommé `LotGeniteurs`, `Incubation` ou `TraitementIncubation` n'existe dans le schéma courant. Aucune table portant ces noms n'existe non plus dans les migrations.

Vérification croisée avec les 30+ modèles existants : aucun conflit.

### Schema — R8 (siteId obligatoire) : OK

Les 3 modèles définis dans ADR-044 §3.2, §3.4, §3.5 portent tous un champ `siteId String` avec FK vers `Site`. Conforme à R8.

### Schema — Modèles existants impactés par R1-S3 : PROBLÈMES

R1-S3 introduit `LotGeniteurs`, qui doit être référencé dans le modèle `Ponte` (ADR-044 §3.3, §3.6 et décision D7). La `Ponte` actuelle ne possède ni `lotGeniteursFemellId` ni `lotGeniteursMaleId`. Ces ajouts relèvent techniquement d'une story séparée (révision de `Ponte`), mais ils sont des prérequis pour que `LotGeniteurs.pontesAsFemelle` et `LotGeniteurs.pontesAsMale` aient leurs back-relations inverses dans `Ponte`.

Sans cette modification de `Ponte`, les relations Prisma `LotGeniteurs.pontesAsFemelle Ponte[] @relation("PonteGroupeFemelle")` ne pourront pas être déclarées (Prisma exige que les deux côtés d'une relation soient présents dans le schéma).

Cela signifie que **R1-S3 ne peut pas ajouter les champs de relation `pontesAsFemelle`/`pontesAsMale` sur `LotGeniteurs`** sans simultanément modifier `Ponte`.

Deux options :
1. Inclure la modification de `Ponte` dans R1-S3 (scope élargi).
2. Séparer : R1-S3 crée `LotGeniteurs` sans les relations `Ponte[]`, et une story dédiée (R1-S4 ?) ajoute les FKs dans `Ponte`.

L'option 1 est recommandée car les deux opérations forment une unité atomique en Prisma (la relation doit exister des deux côtés).

### Schema — Back-relation Site : ATTENTION

Le modèle `Site` (ligne 594-690) liste toutes ses back-relations. Après ajout des 3 nouveaux modèles, il faudra ajouter 3 back-relations dans `Site` :
```
lotGeniteurs           LotGeniteurs[]
incubations            Incubation[]
traitementsIncubation  TraitementIncubation[]
```
Cet ajout doit être fait dans la même migration pour éviter une erreur de validation Prisma.

### Schema — Enum StatutReproducteur incomplet : HÉRITAGE R1-S1

Le pre-analysis R1-S1 a signalé que `StatutReproducteur` devait être étendu avec `EN_REPOS` et `SACRIFIE`. L'inspection du schéma courant (ligne 441-445) montre que ces deux valeurs N'ONT PAS été ajoutées. L'enum ne contient que : `ACTIF`, `REFORME`, `MORT`.

Impact sur R1-S3 : `LotGeniteurs.statut` utilise `StatutReproducteur`. Le modèle fonctionnera avec les 3 valeurs existantes, mais les stories aval (gestion du cycle de vie, alertes mâles) seront bloquées si ces valeurs ne sont pas ajoutées.

Ce n'est pas un bloquant strict pour R1-S3, mais le @db-specialist doit planifier la migration RECREATE de `StatutReproducteur` avant les stories qui utilisent `EN_REPOS`/`SACRIFIE`.

### Schema — Enum TypeReleve sans TRI : HÉRITAGE R1-S1

`TypeReleve` ne contient pas la valeur `TRI` (lignes 20-28 du schéma). Ce gap n'impacte pas directement R1-S3 (les 3 nouveaux modèles n'utilisent pas `TypeReleve`). Il impacte R1-S5 (LotAlevins et Releve).

### Build & Compilation : NON EXÉCUTÉ

Le build n'a pas été exécuté pour cette pré-analyse car R1-S3 est une story SCHEMA pure : aucun fichier TypeScript ou de routes n'est modifié dans ce périmètre. La validation du build post-implémentation relève du @tester.

### Base de connaissances (ERRORS-AND-FIXES.md) : APPLICABLE

Les erreurs suivantes s'appliquent directement à R1-S3 :

- **ERR-001 / ERR-049** : si `StatutReproducteur` est étendu dans la même migration que les 3 nouveaux modèles, utiliser RECREATE et inclure un UPDATE préalable sur les lignes existantes avant le CAST. Ne jamais utiliser `ADD VALUE` + `UPDATE` dans la même transaction.
- **ERR-002** : ne pas utiliser `npx prisma migrate dev`. Utiliser `migrate diff --script` + création manuelle du dossier + `migrate deploy`.
- **ERR-038** : inspecter le SQL généré par `migrate diff` avant deploy pour détecter toute dérive de schéma non liée.

---

## Incohérences trouvées

1. **Relations `LotGeniteurs → Ponte` impossibles sans modification de `Ponte`**
   - Fichiers concernés : `prisma/schema.prisma` (modèle Ponte, lignes 1536-1557)
   - Problème : Prisma exige que les deux côtés d'une relation bidirectionnelle soient définis. `LotGeniteurs.pontesAsFemelle Ponte[] @relation("PonteGroupeFemelle")` ne peut exister que si `Ponte` déclare `lotGeniteursFemellId String?` et `lotGeniteursFemelle LotGeniteurs? @relation("PonteGroupeFemelle", ...)`.
   - Suggestion de fix : élargir le périmètre de R1-S3 pour inclure les champs `lotGeniteursFemellId`, `lotGeniteursMaleId` sur `Ponte`, et les relations correspondantes (ADR-044 §3.3). C'est une unité atomique Prisma.

2. **`StatutReproducteur` toujours incomplet — R1-S1 partiellement non conforme**
   - Fichiers concernés : `prisma/schema.prisma` lignes 441-445
   - Problème : `EN_REPOS` et `SACRIFIE` annoncés dans R1-S1 (et dans le pré-analysis R1-S1) ne sont pas présents dans le schéma courant.
   - Suggestion : créer une story ou un fix-sprint explicite pour cette migration RECREATE, ou l'inclure dans R1-S3 si le scope est élargi.

3. **`TypeReleve` sans `TRI` — R1-S1 partiellement non conforme**
   - Fichiers concernés : `prisma/schema.prisma` lignes 20-28
   - Problème : la valeur `TRI` requise par ADR-044 §3.7 n'est pas dans `TypeReleve`. Cela bloque la story liée à l'extension de `LotAlevins` et du modèle `Releve`.
   - Suggestion : inclure cette migration RECREATE dans la story R1-S3 ou dans une story immédiatement suivante.

4. **Back-relations manquantes dans `Site` pour les 3 nouveaux modèles**
   - Fichiers concernés : `prisma/schema.prisma` lignes 594-690 (modèle Site)
   - Problème : les 3 nouvelles relations (`lotGeniteurs`, `incubations`, `traitementsIncubation`) doivent être déclarées dans `Site`. Oubli fréquent signalé dans les pre-analysis précédentes.
   - Suggestion : inclure systématiquement dans la checklist du @db-specialist l'ajout des back-relations dans `Site` pour chaque nouveau modèle.

---

## Risques identifiés

1. **Migration atomique obligatoire : 3 modèles + modification Ponte + back-relations Site**
   - Si la story tente d'ajouter `LotGeniteurs` avec ses relations `Ponte[]` sans modifier `Ponte` en même temps, Prisma génèrera une erreur de validation du schéma (`Error validating: The relation field ... must be present on the other side`).
   - Impact : build et migration bloqués.
   - Mitigation : le @db-specialist doit traiter LotGeniteurs + modification Ponte comme une unité atomique, dans la même migration.

2. **Dérive de schéma potentielle (ERR-038)**
   - Le schéma contient déjà des modèles complexes (30+). Le `migrate diff` peut inclure des changements non liés si une dérive existe.
   - Mitigation : inspecter le SQL complet avant deploy.

3. **`concentration` de type String dans TraitementIncubation**
   - ADR-044 §3.5 déclare `concentration String` (ex : "0.1 ppm"). Ce choix est volontaire (flexibilité). Pas de risque technique, mais implique une validation applicative côté API. À documenter pour les futurs agents.

4. **`dateRenouvellementGénétique` avec accent dans le nom de champ**
   - ADR-044 §3.2 utilise `dateRenouvellementGénétique` avec un accent (`é`). PostgreSQL accepte les noms de colonnes avec caractères Unicode si entre guillemets, mais Prisma les gère. Recommandation : utiliser `dateRenouvellementGenetique` (sans accent) pour éviter tout risque d'incompatibilité d'encodage dans les scripts SQL bruts.

---

## Prérequis manquants

1. **Décision sur le périmètre de R1-S3** : inclure ou non la modification de `Ponte` (ajout de `lotGeniteursFemellId`, `lotGeniteursMaleId`, et les relations inverses). Sans cette décision, l'implémentation des relations bidirectionnelles `LotGeniteurs ↔ Ponte` est impossible.

2. **Migration RECREATE de `StatutReproducteur`** (ajout de `EN_REPOS` et `SACRIFIE`) : à planifier dans R1-S3 ou dans un fix dédié avant les stories aval.

3. **Migration RECREATE de `TypeReleve`** (ajout de `TRI`) : à planifier avant la story qui modifie `LotAlevins` et `Releve` (probablement R1-S5 selon ADR-044 §3.7).

---

## Recommandation

**GO AVEC RÉSERVES** — Les enums requis sont présents et les FK cibles existent. Les 3 modèles peuvent être créés.

Avant de commencer, le @db-specialist doit :

1. Confirmer que le périmètre de R1-S3 inclut la modification atomique de `Ponte` (ajout des 4 champs de relation groupe) — sans cela, les relations `LotGeniteurs.pontesAsFemelle` et `LotGeniteurs.pontesAsMale` ne peuvent pas être déclarées dans Prisma.

2. Dans la même migration, ajouter les back-relations dans `Site` pour les 3 nouveaux modèles.

3. Utiliser le nom `dateRenouvellementGenetique` (sans accent) à la place de `dateRenouvellementGénétique`.

4. Appliquer le workflow non-interactif (ERR-002) : `migrate diff --script` + dossier manuel + `migrate deploy`.

5. Inspecter le SQL généré avant deploy (ERR-038).

6. Planifier dans une story adjacente ou dans R1-S3 les RECREATE de `StatutReproducteur` et `TypeReleve` pour clore les gaps de R1-S1.
