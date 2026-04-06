# Pré-analyse ADR-043 — Modèle Associatif AssignationBac

**Date :** 2026-04-06
**Analysé par :** @pre-analyst
**ADR :** ADR-043 — Remplacement de Bac.vagueId par une table de jonction AssignationBac

---

## Statut : GO AVEC RÉSERVES

## Résumé

L'ADR-043 propose un refactor majeur du schéma qui remplace la FK nullable `Bac.vagueId` par une table d'association `AssignationBac`. La cohérence entre l'ADR et le code existant est bonne — les lignes mentionnées dans l'ADR correspondent exactement à ce qui existe en base. Deux prérequis bloquants ont été identifiés : (1) `@radix-ui/react-collapsible` est absent du `package.json` et doit être installé avant l'implémentation des composants UI de la Partie 5, et (2) le variant `success` est absent du composant `Badge` alors que l'ADR l'exige pour les badges "Active". Plusieurs écarts entre l'impact décrit dans l'ADR et le code réel ont également été trouvés.

---

## Vérifications effectuées

### Schema — État actuel confirmé

Le modèle `Bac` (ligne 959 de `prisma/schema.prisma`) possède bien tous les champs ciblés par la migration :
- `vagueId String?` avec relation `Vague?` et `@@index([vagueId])`
- `nombrePoissons Int?`
- `nombreInitial Int?`
- `poidsMoyenInitial Float?`

Le modèle `Vague` (ligne 990) possède bien la relation `bacs Bac[]`.

Le modèle `Site` (lignes 494-587) ne possède PAS encore la relation `assignationsBac AssignationBac[]` — c'est attendu, elle sera ajoutée lors de l'implémentation.

L'ADR est exact sur l'état du schéma actuel.

### Queries — Impact réel vs ADR

#### `src/lib/queries/bacs.ts` — Impact confirmé, PLUS ÉTENDU que décrit

- Ligne 16 : `include: { vague: { select: { code: true } } }` — correspond
- Ligne 28-33 : lecture de `b.nombrePoissons`, `b.nombreInitial`, `b.poidsMoyenInitial`, `b.vagueId` — correspond
- Ligne 47 : `include: { vague: ... }` dans `getBacById` — correspond
- Ligne 71 : `bac.vagueId` dans `updateBac` — correspond
- Ligne 75 : `vagueId: bac.vagueId` — correspond
- Ligne 83-94 : `updateBac` écrit `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial` directement sur le bac — **NON MENTIONNÉ dans l'ADR**. Ces écritures devront également cibler `AssignationBac` après migration.
- Ligne 101-105 : `getBacsLibres` avec `where: { vagueId: null }` — correspond
- Ligne 109-120 : `assignerBac` avec `updateMany` sur `Bac.vagueId` — correspond
- Ligne 122-127 : `libererBac` avec `vagueId: null` — correspond

#### `src/lib/queries/vagues.ts` — Impact confirmé

- Ligne 22 : `_count: { select: { bacs: true } }` dans `getVagues` — **NON MENTIONNÉ dans l'ADR** (section 2.2 commence à `getVagueById`). Ce comptage retournera 0 pour les vagues terminées après migration, car `bacs` sera vide. Doit devenir `_count: { select: { assignations: { where: { dateFin: null } } } }` pour les vagues actives, et sans filtre pour le total historique.
- Ligne 41 : `include: { bacs: ... }` dans `getVagueById` — correspond
- Ligne 61 : même pattern dans `getVagueByIdWithReleves` — correspond
- Ligne 104 : `bacs.filter((b) => b.vagueId !== null)` dans `createVague` — correspond
- Lignes 133-141 : `tx.bac.update` avec `vagueId`, `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial` dans `createVague` — correspond
- Ligne 144-146 : `return tx.vague.findUnique({ include: { bacs: true } })` — **NON MENTIONNÉ** dans l'ADR, devra être adapté
- Lignes 155-157 : `include: { bacs: true }` dans `cloturerVague` — **NON MENTIONNÉ**
- Ligne 185 : `include: { _count: { select: { bacs: true } } }` dans `cloturerVague` retour — **NON MENTIONNÉ**
- Ligne 200 : `_count: { select: { bacs: true } }` dans `updateVague` — correspond (via `vague._count.bacs` ligne 254)
- Ligne 222 : `bacs.filter((b) => b.vagueId !== null)` dans `addBacs` — correspond
- Ligne 261 : `tx.bac.findMany({ where: { vagueId: id, siteId } })` dans `removeBacs` — correspond
- Lignes 280, 284, 288, 290, 292 : `tx.bac.findFirst({ where: { vagueId: id } })` pour le bac de destination, lectures de `bacDestination.nombrePoissons`, `tx.bac.update({ increment: poissonsPresents })` — **NON MENTIONNÉS** dans l'ADR. Ces opérations de transfert lisent et écrivent `nombrePoissons` sur le bac lui-même.
- Lignes 325-332 : `tx.bac.updateMany` pour libérer les bacs — correspond

#### `src/lib/queries/releves.ts` — Impact confirmé

- Ligne 166 : `bac.vagueId !== data.vagueId` — correspond exactement à ce que l'ADR décrit.

#### `src/lib/queries/analytics.ts` — Impact confirmé

- Ligne 59 : `bac: { nombreInitial: number | null }` dans `computeIndicateursBac` — correspond
- Ligne 77 : `bac.nombreInitial ?? Math.round(...)` — correspond
- Ligne 185 : `_count: { select: { bacs: true } }` dans `getIndicateursBac` — correspond
- Ligne 190 : `prisma.bac.findFirst({ select: { nombreInitial: true } })` — correspond
- Ligne 1013 : `prisma.bac.count({ where: { vagueId: { not: null } } })` — correspond

**Écart** : l'ADR cite la ligne 185-186 pour `_count: { select: { bacs: true } }` dans `getIndicateursBac`. En réalité, cette ligne concerne un `select` dans une requête `findFirst`, pas un comptage. L'impact est le même mais l'emplacement exact est différent. La vraie ligne 185 est le début de `getIndicateursBac` qui fait un `prisma.vague.findFirst` avec `_count: { select: { bacs: true } }`.

**Écart supplémentaire** : ligne 1027 `bacs: { select: { id: true, nom: true, volume: true, nombreInitial: true } }` dans `getAnalyticsDashboard` — **NON MENTIONNÉ** dans l'ADR section 2.2. La relation `bacs` de `vague` est chargée ici pour le calcul par bac de la densité. Doit devenir `assignations`.

#### `src/lib/queries/dashboard.ts` — Impact confirmé

- Ligne 67 : `prisma.bac.count({ where: { siteId, vagueId: { not: null } } })` — correspond exactement.
- Ligne 72 : `computeNombreVivantsVague(v.bacs, v.releves, v.nombreInitial)` — chargement via `v.bacs`. Cette fonction recevra un tableau vide pour les vagues terminées. **NON MENTIONNÉ** dans l'ADR.

#### `src/lib/queries/lots-alevins.ts` — Impact confirmé avec CORRECTION

- Ligne 231 : `bacs.filter((b) => b.vagueId !== null)` — correspond
- Ligne 258-261 : `tx.bac.updateMany({ data: { vagueId: nouvelleVague.id } })` — **NON MENTIONNÉ** dans l'ADR. La fonction `transfererLotVersVague` fait un simple `updateMany` sur `Bac.vagueId` sans `nombrePoissons` ni `nombreInitial`. Ce code devra créer des `AssignationBac` après migration.
- Ligne 276 : `include: { bacs: ... }` dans le retour — **NON MENTIONNÉ**

#### `src/lib/queries/ventes.ts` — Impact confirmé

- Ligne 97-100 : `tx.bac.findMany({ where: { vagueId: data.vagueId, siteId } })` — correspond
- Lignes 103-106 : lecture de `bac.nombrePoissons` pour le total disponible — correspond
- Il y a aussi une mise à jour de `nombrePoissons` sur les bacs lors d'une vente (après ligne 114). **NON MENTIONNÉ** dans l'ADR, mais critique : la déduction proportionnelle des poissons lors d'une vente écrira sur `Bac.nombrePoissons`. Après migration, doit écrire sur `AssignationBac.nombrePoissons`.

#### `src/lib/queries/calibrages.ts` — Impact MAJEUR confirmé

- Ligne 78 : `tx.bac.findMany({ where: { vagueId: data.vagueId, siteId } })` — correspond
- Lignes 87-92 : lecture de `bac.nombrePoissons` — correspond
- Ligne 99 : `tx.bac.findMany({ where: { vagueId: data.vagueId, siteId } })` pour bacs destination — correspond
- Ligne 109-110 : `totalSourcePoissons` depuis `bac.nombrePoissons` — correspond
- Lignes 127-129 : snapshot des bacs avec `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial`, `vagueId` — correspond, mais après migration le snapshot JSON devra être adapté
- Lignes 144-153 : écriture de `nombreInitial` et `poidsMoyenInitial` sur le bac si null — correspond
- Lignes 191-218 : deux passes d'écriture de `nombrePoissons` sur les bacs sources et destinations — correspond exactement à ce que l'ADR décrit comme "le changement le plus risqué"

#### `src/lib/activity-engine/orchestrator.ts` — Impact confirmé

- Ligne 38-39 : `include: { bacs: { where: { vagueId: { not: null } } } }` — correspond. Ironiquement, ce filtre est redondant puisque dans la relation Prisma actuelle `vague.bacs` retourne déjà uniquement les bacs avec `vagueId = vague.id`. Ce code fait un double filtre qui fonctionne mais est mal formulé.

### API Routes — Impact confirmé

#### `src/app/api/bacs/route.ts`

- Ligne 36 : `prisma.bac.findMany({ where: { siteId, vagueId } })` — correspond
- Lignes 39-51 : mapping avec `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial`, `vagueId` — correspond
- Ligne 55 : `getBacsLibres` — correspond

**Écart** : l'ADR ne mentionne pas que la branche `libre` (lignes 56-72) effectue également un mapping identique avec `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial`, `vagueId`. Ce mapping devra être adapté lui aussi.

#### `src/app/api/vagues/route.ts`

- Ligne 49 : `nombreBacs: v._count.bacs` — correspond
- Lignes 219-222 et 244-253 dans le POST (qui délègue à `createVague`) — correspond via la query

**Clarification** : l'ADR cite des lignes 219-222 et 244-253 comme étant dans `route.ts`, mais ces transformations se passent en réalité dans `createVague` (query layer). La route POST délègue entièrement à `createVague()`. Ce n'est pas un problème, juste une imprécision de l'ADR.

#### `src/app/api/vagues/[id]/route.ts`

- Ligne 44 : `bacs: vague.bacs` — correspond exactement

### Types — Impact confirmé

- `src/types/models.ts` lignes 433-458 : l'interface `Bac` a bien `vagueId: string | null`, `nombrePoissons: number | null`, `nombreInitial: number | null`, `poidsMoyenInitial: number | null`
- Ligne 462 : `BacWithVague extends Bac` — correspond
- Lignes 502-503 : `VagueWithBacs extends Vague { bacs: Bac[] }` — correspond
- Lignes 506-510 : `VagueWithRelations extends Vague { bacs: Bac[] }` — correspond, **NON MENTIONNÉ** dans l'ADR

### Composants UI — Impact confirmé

- `bacs-list-client.tsx` ligne 189 : `bac.vagueId !== null` — correspond
- `bacs-list-client.tsx` lignes 199-229 : lecture de `bac.nombrePoissons`, `bac.nombreInitial`, `bac.poidsMoyenInitial` dans les cartes — les cartes affichent directement ces champs. Si le DTO BacResponse conserve les mêmes propriétés calculées depuis l'assignation active, l'impact UI est nul.
- `gerer-bacs-dialog.tsx` ligne 119 : `bac.nombrePoissons ?? 0` — correspond

### Tests existants

Les tests suivants couvrent directement les zones de code impactées :

| Fichier test | Couverture impactée |
|---|---|
| `src/__tests__/api/bacs.test.ts` | GET /api/bacs avec vagueId, getBacsLibres |
| `src/__tests__/api/vagues-distribution.test.ts` | POST /api/vagues, tx.bac.update avec vagueId/nombrePoissons |
| `src/__tests__/vagues-remove-bac.test.ts` | updateVague removeBacs, tx.bac.updateMany vagueId:null |
| `src/__tests__/indicateurs-nombreinitial.test.ts` | bac.nombreInitial dans calculs indicateurs |
| `src/__tests__/api/analytics-bacs.test.ts` | getIndicateursBac avec bac.nombreInitial |
| `src/__tests__/api/ventes.test.ts` | tx.bac.findMany vagueId, bac.nombrePoissons |
| `src/__tests__/activity-engine/generator.test.ts` | orchestrator bacs avec vagueId filter |
| `src/__tests__/activity-engine/evaluator.test.ts` | bac.nombrePoissons dans évaluateur |

Ces 8+ suites de tests moqueront `prisma.bac` avec les anciens champs. Après migration, les mocks devront être mis à jour pour utiliser `prisma.assignationBac`.

### Données seed

`prisma/seed.sql` lines 405-410 :
```sql
INSERT INTO "Bac" (id, nom, volume, "nombrePoissons", "vagueId", "siteId", ...)
VALUES
  ('bac_01', 'Bac 1', 2000, 170, 'vague_01', 'site_01', ...),
  ('bac_02', 'Bac 2', 2000, 165, 'vague_01', 'site_01', ...),
  ('bac_03', 'Bac 3', 1500, 155, 'vague_01', 'site_01', ...),
  ('bac_04', 'Etang A', 5000, NULL, 'vague_02', 'site_01', ...);
```

- `bac_01`, `bac_02`, `bac_03` sont dans `vague_01` (EN_COURS) avec `nombrePoissons` non null
- `bac_04` est dans `vague_02` (TERMINEE) avec `nombrePoissons = null`
- Aucun bac n'a de `nombreInitial` dans le seed — le champ vaut NULL dans le seed SQL

Après migration Phase 1+2, le seed devra :
1. Conserver les `INSERT INTO "Bac"` (avec les champs jusqu'à Phase 3)
2. Ajouter les `INSERT INTO "AssignationBac"` pour les 4 bacs :
   - bac_01, bac_02, bac_03 : `dateFin = null`, `nombrePoissonsInitial = COALESCE(nombreInitial, nombrePoissons, 0)`, `poidsMoyenInitial` depuis la vague
   - bac_04 : `dateFin` renseignée (vague terminée le '2025-12-22'), `nombrePoissons = null`

**Point critique** : Le seed actuel n'inclut pas `nombreInitial` dans les colonnes insérées. `COALESCE(null, 170, 0) = 170` — l'approximation sera donc `nombrePoissonsInitial = 170` pour bac_01, ce qui est la valeur actuelle et raisonnable pour les données de test.

---

## Incohérences trouvées

### 1. Queries non mentionnées dans l'ADR

Les fonctions suivantes touchent `bac.vagueId` ou `bac.nombrePoissons` mais ne sont pas listées dans la section 2.2 de l'ADR :

- `getVagues()` dans `vagues.ts` ligne 22 : `_count: { select: { bacs: true } }` — après migration, comptage incorrect pour vagues terminées
- `createVague()` retour ligne 144-146 : `include: { bacs: true }` — retournera liste vide après Phase 3
- `cloturerVague()` chargement ligne 155-157 : `include: { bacs: true }` — encore fonctionnel en Phase 2 (double source de vérité), cassé en Phase 3
- `cloturerVague()` retour ligne 185 : `_count: { select: { bacs: true } }` — retournera 0 après Phase 3
- `updateVague()` transfert de poissons lignes 280-292 : lit et écrit `nombrePoissons` sur le bac de destination
- `transfererLotVersVague()` dans `lots-alevins.ts` lignes 258-261 : `tx.bac.updateMany({ data: { vagueId } })` sans créer d'AssignationBac — listé en commentaire dans l'ADR (ligne 193) mais pas dans le tableau d'impact
- `getAnalyticsDashboard()` dans `analytics.ts` ligne 1027 : `bacs: { select: { nombreInitial: true } }` inclus dans la requête vague
- Branche `libre` dans `api/bacs/route.ts` lignes 56-72 : mapping avec les anciens champs
- `VagueWithRelations` dans `types/models.ts` ligne 507 : interface avec `bacs: Bac[]` non mentionnée
- Déduction des poissons lors d'une vente dans `ventes.ts` (après ligne 114) : écriture de `nombrePoissons` sur les bacs
- `updateBac()` dans `bacs.ts` lignes 83-97 : écriture de `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial` sur le bac

### 2. Variant Badge `success` manquant

L'ADR Partie 5, section 5.1 demande un badge "Active" vert et "Terminée" gris. Le composant `src/components/ui/badge.tsx` dispose des variants : `default`, `en_cours`, `terminee`, `annulee`, `info`, `warning`. Il n'y a pas de variant `success` (vert générique). Le variant `terminee` est vert (`bg-success/15 text-success`) mais son nom est trompeur pour désigner une assignation "active". Il faudra soit réutiliser `terminee` avec une sémantique différente, soit ajouter un variant `success` dédié.

### 3. Contrainte unique partielle non générée par Prisma

L'ADR est correct à ce sujet (section 1.2, Partie 4.2) : l'index unique partiel `WHERE "dateFin" IS NULL` ne peut pas être généré par Prisma schema et doit être ajouté via une migration SQL manuelle. Cela implique d'utiliser le workflow non-interactif (`migrate diff` + `migrate deploy`) documenté dans ERRORS-AND-FIXES.md (ERR-002). L'ADR le mentionne mais c'est un risque d'exécution concret.

### 4. Snapshot calibrage — champ `vagueId` dans le JSON

Le snapshot JSON (`snapshotAvant`, ligne 129-140 de `calibrages.ts`) sérialise `allBacsOfVague` avec les champs `{ id, nom, nombrePoissons, nombreInitial, poidsMoyenInitial, vagueId }`. Après migration Phase 3, `vagueId` n'existera plus sur `Bac`. Le snapshot formattera différemment. Les calibrages historiques auront toujours l'ancien format, les nouveaux auront le nouveau. L'ADR n'aborde pas la rétrocompatibilité du champ `snapshotAvant`.

---

## Risques identifiés

### Risque 1 — Calibrage : transaction atomique complexe (HAUTE)

Le `createCalibrage` fait une transaction en 8 passes qui lit et écrit `nombrePoissons` sur les bacs sources et destinations. C'est le code le plus critique. Après migration, toutes ces opérations devront cibler `AssignationBac`. Un bug de migration ici entraîne une incohérence silencieuse des effectifs.

**Mitigation :** Les tests unitaires pour `createCalibrage` doivent être écrits AVANT Phase 3. Un test d'intégration end-to-end avec une DB de test est recommandé.

### Risque 2 — Bacs terminées dans les indicateurs (HAUTE)

Après Phase 3, `getVagueByIdWithReleves` et `getVagueById` retourneront `bacs: []` pour les vagues TERMINÉE si on ne change que le filtre. `computeNombreVivantsVague`, `getIndicateursVague`, `getComparaisonBacs` recevront des tableaux vides et utiliseront les fallbacks. L'impact est silencieux — les données s'afficheront mais seront incorrectes (fallback uniforme au lieu de per-bac).

**Mitigation :** Adapter `getVagueById` pour inclure toutes les assignations (sans filtre `dateFin`) et les mapper en `bacs` pour l'interface `VagueWithBacs`.

### Risque 3 — Tests cassés en masse (MOYENNE)

38 fichiers de tests moqueront `prisma.bac` avec `vagueId` et/ou `nombrePoissons`. Après Phase 3, ces mocks seront incorrects et les tests échoueront. C'est attendu mais doit être planifié.

**Mitigation :** Mise à jour des mocks dans une story dédiée "mettre à jour les tests".

### Risque 4 — Dérive de schéma (MOYENNE)

Lors de l'exécution de `prisma migrate diff` pour générer la Phase 1, si des colonnes ont été ajoutées manuellement en base (hors migrations), le diff inclura ces changements parasites. Voir ERR-038.

**Mitigation :** Inspecter le SQL généré avant tout `migrate deploy` (ERR-038 documente exactement ce protocole).

### Risque 5 — Double source de vérité en Phase 2 (BASSE)

Entre la Phase 1 (création d'AssignationBac) et la Phase 3 (suppression de Bac.vagueId), les deux sources coexistent. Si un code écrit `Bac.vagueId` mais ne crée pas d'AssignationBac, ou vice versa, les données divergent.

**Mitigation :** Déployer Phases 1, 2 et 3 rapidement en séquence. Ne pas laisser la Phase 2 en production sans la Phase 3.

---

## Prérequis manquants

### Prérequis 1 — BLOQUANT pour Partie 5 UI

`@radix-ui/react-collapsible` est absent du `package.json`. Le composant `VagueBacsSection` (section 5.2 de l'ADR) en dépend pour le panneau "Bacs retirés".

**Action requise :** `npm install @radix-ui/react-collapsible` avant d'implémenter les composants UI de la Partie 5.

### Prérequis 2 — Variant Badge `success`

Le composant Badge ne dispose pas d'un variant `success` générique. L'ADR utilise un badge "Active" vert pour les assignations actives.

**Action requise :** Ajouter `success: "bg-success/15 text-success"` aux variants du Badge, ou documenter l'utilisation du variant existant `terminee` avec un commentaire expliquant la réutilisation sémantique.

### Prérequis 3 — Page de détail bac inexistante

La page `src/app/(farm)/bacs/[id]/page.tsx` n'existe pas encore. L'ADR Partie 5 en a besoin pour l'historique d'assignations. Ce n'est pas bloquant pour les Parties 1-4 (schema + queries + API), mais bloquant pour la Partie 5 Feature 1.

---

## Recommandation

**GO pour les Parties 1-4** (schema, migration, queries, API, types) — le code existant correspond à ce que l'ADR décrit.

**GO AVEC ACTION PRÉALABLE pour la Partie 5** (UI) — installer `@radix-ui/react-collapsible` et ajouter le variant `success` au Badge avant de commencer les composants UI.

**Points à clarifier avec l'implémenteur :**

1. Étendre la liste d'impact de l'ADR (section 2.2) pour couvrir les fonctions manquantes listées ci-dessus. Ces fonctions ne sont pas listées mais devront être modifiées en Phase 3.

2. Décider de la stratégie pour le champ `snapshotAvant` du calibrage : conserver l'ancien format pour les calibrages existants, ou ajouter un champ `snapshotVersion` dans le JSON.

3. Pour `getVagues()` ligne 22 : le comptage `_count: { select: { bacs: true } }` retournera 0 pour toutes les vagues TERMINÉE après Phase 3. Décider si `nombreBacs` dans la liste des vagues doit représenter le nombre de bacs actifs ou historique.

4. `transfererLotVersVague` dans `lots-alevins.ts` (ligne 258) fait un `bac.updateMany({ data: { vagueId } })` sans distribution de `nombrePoissons` par bac — la nouvelle `AssignationBac` créée devra avoir `nombrePoissonsInitial` renseigné, mais cette fonction n'a pas de `bacDistribution` dans son DTO. Décider si ce cas est hors scope de la migration initiale.
