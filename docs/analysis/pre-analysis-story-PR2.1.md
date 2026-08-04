# Pré-analyse Story PR2.1 — Queries Prisma (module Prévisions) — 2026-08-03

## Statut : GO AVEC RÉSERVES

## Résumé
Le terrain est prêt : schéma (13 modèles + 7 enums), migrations, types miroirs et moteur pur sont
livrés et stables (build OK, 236/239 fichiers de test verts, 6660 tests passés, 0 échec). Le seul
point non trivial à trancher avant d'écrire du code est la circulation des `Decimal` entre trois
représentations (Prisma `Decimal`, `decimal.js` du moteur, `number` TS/JSON) — aucun utilitaire de
conversion partagé n'existe aujourd'hui dans le dépôt, et le seul précédent réel (portefeuille
ingénieur) laisse fuiter des `Decimal` bruts jusqu'au JSON de réponse sans les convertir. La dette
« homonymie `sacsCalcules` » (réserve 6 de PR1) est confirmée par lecture du code : c'est bien deux
concepts différents portant le même nom, à documenter avant PR2 mais pas nécessairement à renommer.

## Vérifications effectuées

### Schema ↔ Types : OK
13 modèles Prévisions présents dans `prisma/schema.prisma` (lignes 4358-4670+), miroirs dans
`src/types/models.ts`. Le client Prisma généré (`src/generated/prisma/models/*.ts`) expose bien les
13 modèles (`ScenarioPrevision`, `ParametresPrevision`, `PalierRemise`, `AlimentPrevision`,
`RepartitionMoisAliment`, `VaguePrevue`, `AlimentParVaguePrevue`, `PostePrevision`,
`ChargeMensuellePrevue`, `JournalDepensePrevue`, `ApportCapital`, `MappingRapprochement`,
`ClotureMois`). `npx prisma validate` : schéma valide.

### API ↔ Queries : N/A (hors périmètre PR2.1, aucune route API n'existe encore)
Le pattern de `src/lib/queries/` a été inventorié (voir section dédiée ci-dessous) pour préparer
PR2.1 dans le bon style.

### Navigation ↔ Permissions : OK pour ce qui existe
`Permission.PREVISIONS_VOIR/GERER/PARAMETRER/CLOTURER` déjà déclarées et vérifiées présentes dans
`src/lib/permissions-constants.ts` (groupe `previsions`). `requirePermission()` a la forme attendue
dans `src/lib/permissions.ts`. Navigation (`sidebar.tsx`, `MODULE_NAV`) volontairement non touchée —
hors périmètre PR2.1/PR2, prévue PR3 selon l'ADR.

### Build : OK
`npm run build` : compilation réussie, aucune erreur.

### Tests : 6660 passés / 236 fichiers verts sur 239 (3 skip), 17 skipped, 26 todo, 0 échec
Ligne de base avant travaux PR2.1 (à comparer à la ligne de base de fin de sprint PR1 : 239 fichiers,
6677 tests passés, 26 todo, 0 échec — l'écart de 17 tests vient de tests `describe.skip`/gated DB déjà
présents avant ce sprint, pas d'une régression).

## Inventaire de l'existant — patron réel des queries

Lu : `src/lib/queries/vagues.ts` (référence explicite de CLAUDE.md), `src/lib/queries/depenses.ts`,
`src/lib/queries/ventes.ts`, `src/lib/queries/besoins.ts`, `src/lib/queries/commissions.ts`,
`src/lib/queries/admin-analytics.ts`.

**Position de `siteId` — pas uniforme, contrairement à ce que suppose l'énoncé.** Deux sous-patrons
coexistent, tous deux légitimes et à choisir consciemment pour PR2.1 :
- **Listes / créations** : `siteId` en **premier** paramètre — `getVagues(siteId, filters?, pagination?)`,
  `createVague(siteId, data)`.
- **Opérations par id** : `id` en premier, `siteId` en second — `getVagueById(id, siteId)`,
  `updateVague(id, siteId, data)`, `deleteVague(id, siteId)`, `cloturerVague(id, siteId, dateFin?)`,
  `getDepenseById(id, siteId)`, `getVenteById(id, siteId)`.
  Le `siteId` est systématiquement dans le `where` Prisma (`where: { id, siteId }`), jamais oublié —
  c'est ça que R8 garantit réellement, pas l'ordre lexical des paramètres. **Recommandation pour
  PR2.1** : suivre ce même sous-patron par catégorie d'opération (liste/création → `siteId` d'abord ;
  par id → `id` puis `siteId`), pour rester cohérent avec le reste du dépôt plutôt qu'inventer une
  troisième convention.

**Type de retour.** Jamais de DTO de sérialisation dédié au niveau des queries : elles renvoient
directement l'objet/la forme Prisma (éventuellement retravaillée, ex. `bacs` reconstruit depuis
`assignations` dans `getVagueById`), et la conversion pour la frontière API/JSON (si besoin) est
laissée à la route ou n'existe pas du tout aujourd'hui (voir section Decimal ci-dessous — c'est
précisément le point faible constaté).

**Transactions.** `prisma.$transaction(async (tx) => {...})` partout où plusieurs écritures doivent
être atomiques (R4) : `createVague`, `cloturerVague`, `deleteVague`, `updateVague`. Le patron de
« remplacement en bloc » (pertinent pour `RepartitionMoisAliment` d'un `AlimentPrevision`, ou les
lignes d'un `AlimentParVaguePrevue`) existe déjà et est éprouvé : `besoins.ts` fait
`tx.ligneBesoin.deleteMany({ where: { listeBesoinsId: id } })` puis `tx.ligneBesoin.createMany({ data: [...] })`
dans la même transaction (lignes ~444-446) — c'est le patron à répliquer pour tout remplacement en
bloc de PR2.1.

**Piège Prisma 7 create/update + include.** Confirmé dans `vagues.ts` : `createVague` fait
`tx.vague.create({ data: {...} })` **sans** `include`, puis un second appel
`tx.vague.findUnique({ where, include: {...} })` pour recharger avec les relations. Ce contournement
(documenté dans la mémoire du @db-specialist, mais **absent** de `docs/knowledge/ERRORS-AND-FIXES.md`
en tant qu'entrée ERR — lacune de capitalisation à signaler au @knowledge-keeper) doit être reproduit
à l'identique pour toute création/mise à jour de PR2.1 qui utilise des FK brutes
(`scenarioId`, `alimentPrevisionId`, `vaguePrevueId`, `posteId`...) combinées à un `include`.

## Le point le plus important : la sérialisation des `Decimal`

Trois représentations réellement en jeu, confirmées par lecture de code (pas supposées) :

1. **Prisma `Decimal`** — le type stocké en base et renvoyé par toute query Prisma non retravaillée.
   Vérification faite : `Prisma.Decimal` (dans `src/generated/prisma/internal/prismaNamespace.ts:62`)
   est `runtime.Decimal`, **réexporté depuis `@prisma/client/runtime/client`** — une copie **vendorée**
   de `decimal.js` embarquée dans le runtime Prisma généré, **pas la même instance de module** que le
   `decimal.js@10.6.0` déclaré en dépendance directe et importé par
   `src/lib/previsions/decimal-config.ts`. Cette distinction est réelle et vérifiable
   (`grep "@prisma/client/runtime/client"`), pas de la paranoïa : le `Decimal.set({ precision: 20,
   rounding: Decimal.ROUND_HALF_UP })` fait dans `decimal-config.ts` **ne configure pas** le
   `Decimal` de Prisma — c'est un module distinct. Un `new (moteur)Decimal(prismaDecimalValue)` peut
   fonctionner par duck-typing (même forme interne `decimal.js`), mais ce n'est **pas testé
   aujourd'hui dans le dépôt** — aucune query ni aucun test n'effectue cette conversion.
2. **`decimal.js` du moteur** — ce que consomment les 12+ fonctions pures de `src/lib/previsions/*.ts`
   (`AlimentPrevisionCalcInput.besoinTotalCycleKg: Decimal`, etc.).
3. **`number` TS / JSON** — la convention confirmée du dépôt pour tout `Decimal` Prisma mappé en
   TypeScript (`src/types/models.ts`, ex. `CommissionIngenieur.montant: number`,
   `PortefeuilleIngenieur.solde: number`), et donc la forme attendue au franchissement de la frontière
   API.

**Où chaque conversion doit se faire — position tranchée pour ce rapport :**
- **Query → moteur** : la query renvoie les données brutes Prisma (`Decimal` Prisma) issues du
  chargement d'un scénario ; la fonction de « chargement complet d'un scénario pour alimenter le
  moteur » (demandée par l'énoncé) doit être le point de conversion explicite
  `Decimal Prisma → decimal.js`, via `new Decimal(prismaValue.toString())` (jamais `.toNumber()`
  puis `new Decimal(number)` — cela réintroduirait un détour par le binaire flottant que le choix
  `Decimal` visait justement à éviter). Cette conversion doit vivre dans la couche queries (ou un
  petit mapper adjacent dédié au module Prévisions), **jamais** dans le moteur lui-même (le moteur
  reste zéro I/O et ne doit pas savoir d'où viennent ses `Decimal`).
- **Moteur → écriture Prisma** : le sens inverse, `decimal.js → Decimal Prisma`, est en réalité
  **transparent** côté Prisma Client : le client accepte `string`, `number` ou un objet
  `DecimalJsLike` en entrée d'un champ `Decimal` — passer directement l'instance `decimal.js` du
  moteur (ou son `.toString()`) à `data: { montantFCFA: valeur }` fonctionne sans conversion
  manuelle. Point à vérifier une fois en pratique (test d'intégration DB-gated), pas à supposer.
- **Query → frontière API/JSON** : **c'est le point faible du dépôt aujourd'hui**, à ne pas répéter.
  Le seul précédent de queries `Decimal` (`src/lib/queries/commissions.ts`, `getPortefeuille`) ne fait
  **aucune conversion** — `montant`, `solde`, `soldePending`, `totalGagne`, `totalPaye` (tous `Decimal`
  en base) traversent tels quels jusqu'à `NextResponse.json(data)` dans
  `src/app/api/portefeuille/route.ts`. Un objet `Decimal` sérialisé par `JSON.stringify`/
  `NextResponse.json` passe par son `toJSON()` (héritage decimal.js), qui renvoie une **chaîne**, pas
  un nombre — en contradiction avec le type TS déclaré (`number`) et avec la convention documentée
  du dépôt. C'est une dette pré-existante, pas introduite par PR2.1, mais PR2.1 ne doit **pas** la
  reproduire : chaque query Prévisions destinée à être consommée par une route API (donc pas
  `chargerScenarioPourMoteur`, qui reste interne) doit convertir explicitement chaque champ `Decimal`
  en `number` via `.toNumber()` avant de renvoyer la donnée à l'appelant — un seul utilitaire partagé
  (ex. `src/lib/previsions/serialization.ts` ou une fonction `toNumber()` réutilisée depuis
  `admin-analytics.ts`, qui existe déjà mais n'est pas exportée/partagée) est recommandé plutôt que de
  la redéfinir localement dans chaque fichier de queries comme le fait déjà (silencieusement) le
  reste du dépôt.

**Recommandation concrète pour @db-specialist** : créer un petit module utilitaire partagé (ex.
`src/lib/previsions/decimal-utils.ts`, distinct du moteur pour ne pas y introduire un souci de
sérialisation JSON) avec deux fonctions : `prismaDecimalToEngine(d: Prisma.Decimal): Decimal`
(`decimal.js` du moteur) et `decimalToNumber(d: Prisma.Decimal | null): number` — utilisées
systématiquement dans les queries de PR2.1, jamais une conversion ad hoc par appel.

## Réserve 6 de PR1 — homonymie `sacsCalcules` : confirmée, traitement recommandé

Lecture de `src/lib/previsions/aliments.ts` : le diagnostic de la réserve 6 est **confirmé
exactement**, avec une nuance importante trouvée en creusant :

- **Colonne DB** `AlimentParVaguePrevue.sacsCalcules` (schema.prisma, ligne ~4531) : `Int`, sortie
  entière du moteur (`ceil` appliqué dans `calculerBesoinAlimentMensuel`), jamais éditée directement.
- **`AlimentParVagueCalcInput.sacsCalcules`** (`aliments.ts:126`, `number`) : **selon le point d'appel,
  ce champ ne représente pas la même grandeur physique** :
  - Dans `calculerCoutAlimentVague` (consommateur direct de l'interface), la doc dit « sortie du
    moteur — jamais éditée directement », suggérant un entier de sortie de `calculerBesoinAlimentMensuel`.
  - Mais l'usage réel observé dans la recette (`orchestration.ts:139-171`,
    `buildCoutAlimentsParVague`) construit ce même champ comme
    `objectifTonnes.times(sacsParTonneStandard).toNumber()` — un produit de deux `Decimal`, **converti
    en `number` sans `.ceil()` ni `.round()`**, donc potentiellement **fractionnaire**, utilisé
    uniquement comme **proxy d'échelle** pour que le ratio (sacs/seuil) reproduise le ratio
    (tonnage/seuilTonnes) du classeur Excel lors de la décision de palier de remise
    (`appliquerPalierRemise`). Le commentaire du fichier le documente explicitement comme une «
    adaptation d'unité … pas une réimplémentation de formule ».
  - Le champ soeur `AlimentParVagueMensuelCalcInput.sacsCalculesCycle` (ligne 210, utilisé par
    `calculerCoutAlimentGranulometrieParMois`) porte la même ambiguïté potentielle (« total de sacs
    sur TOUT le cycle », alimenté dans la recette par le même calcul non arrondi).

**Recommandation : documentation seule, PAS de renommage du moteur pour cette story.** Raisons :
- Le moteur est intouchable sauf nécessité prouvée (règle de l'énoncé) ; la recette est à 842 tests /
  0 écart et tout renommage, même mécanique, oblige à retoucher `aliments.ts`,
  `orchestration.ts` (recette) et `aliments.test.ts` — un risque de régression pour un problème qui
  n'en est pas un aujourd'hui : le code de production (query PR2.1) qui alimentera
  `AlimentParVagueCalcInput.sacsCalcules` en conditions réelles doit et va lui passer un entier (issu
  de `calculerBesoinAlimentMensuel`, déjà `ceil`), donc la voie fractionnaire n'existe que dans le
  jeu de recette qui reproduit une contrainte du classeur Excel — pas dans le chemin applicatif réel.
  Une écriture Prisma d'une valeur fractionnaire dans la colonne `Int` échouerait de toute façon
  bruyamment (cf. réserve déjà notée par PR1).
- Ce qui doit changer concrètement dans PR2.1 : **la query qui construit
  `AlimentParVagueCalcInput`/`AlimentParVagueMensuelCalcInput` à partir des lignes
  `AlimentParVaguePrevue` de la base doit toujours alimenter `sacsCalcules`/`sacsCalculesCycle` avec
  un entier réel** (celui déjà stocké en colonne `Int`, ou celui recalculé par
  `calculerBesoinAlimentMensuel`) — jamais reproduire par erreur le pattern de la recette (produit de
  Decimal non arrondi) dans du code applicatif, sous peine de fausser une décision de palier de
  remise sur des cas limites.
- Ajouter un commentaire JSDoc dans `aliments.ts` à côté des deux interfaces, explicitant que le nom
  est partagé avec la colonne DB `Int` mais que la fonction ne garantit ni n'exige un entier au
  niveau du type TS — seul l'appelant (ici : les queries PR2.1) garantit cette invariance en
  pratique. C'est un travail de documentation, à faire dans PR2.1 ou juste avant, pas un item bloquant.

## Périmètre MVP — `ClotureMois`

`ClotureMois` **n'a pas besoin d'une query dans PR2.1** au sens plein (créer une clôture, vérifier le
verrou avant écriture de rapprochement) : la section 5/ADR précise que le verrou de clôture porte sur
« toute écriture de **rapprochement** » — et le rapprochement est explicitement hors périmètre du
sprint entier (PR3). Il **n'y a donc aucune écriture protégée par une clôture à faire dans PR2.1**.

Cependant, une **query de lecture minimale** (`getCloturesParScenario(scenarioId, siteId)` ou
équivalent) est probablement utile dès PR2.1 si l'UI de PR2 doit afficher un badge « mois clôturé »
sur le plan/aliments — mais ce n'est **pas garanti nécessaire** par l'énoncé du MVP fourni (qui ne
mentionne aucune page de clôture). **Recommandation : ne pas écrire de query CRUD pour `ClotureMois`
dans PR2.1** ; une simple lecture peut être ajoutée à la volée si une story UI de PR2 en a besoin,
sinon la totalité de `ClotureMois` (create + lecture + verrou) relève de PR3 avec le rapprochement,
dont elle est indissociable fonctionnellement.

## Découpage recommandé

**Plusieurs fichiers, pas un seul** — suit le découpage déjà établi par domaine dans
`src/lib/queries/` (un fichier par entité/domaine plutôt qu'un fourre-tout), et reflète les frontières
transactionnelles naturelles du module :

1. **`src/lib/queries/previsions-scenarios.ts`** — `ScenarioPrevision`, `ParametresPrevision`,
   `PalierRemise` (portés par le même écran de paramétrage).
   - `getScenarios(siteId, filters?, pagination?)` → `{ data, total }`
   - `getScenarioById(id, siteId)` → scénario + `parametres` + `paliersRemise` (include simple)
   - `createScenario(siteId, data)` → transaction : crée `ScenarioPrevision` + `ParametresPrevision`
     (1-1 obligatoire dès la création, cf. ADR — `ParametresPrevision.scenarioId @unique`) + copie
     des `AlimentPrevision` depuis `Produit` (décision 1 de l'ADR : *pré-remplies par copie*) — cette
     dernière étape mérite sa propre fonction interne mais dans la même transaction.
   - `updateParametresPrevision(scenarioId, siteId, data)` → update simple (1-1, pas de bulk replace)
   - `replacePaliersRemise(scenarioId, siteId, paliers[])` → **transaction** `deleteMany` + `createMany`
     (patron `besoins.ts`), avec revalidation de `ordre` strictement croissant en amont (R4 : validation
     + écriture même transaction, cf. `validation.ts` existant du moteur)
   - `archiverScenario(id, siteId)` / `activerScenario(id, siteId)` → `update` simple sur `statut`

2. **`src/lib/queries/previsions-aliments.ts`** — `AlimentPrevision`, `RepartitionMoisAliment`.
   - `getAlimentsPrevisionParScenario(scenarioId, siteId)` → avec `repartitions` incluses (évite le N+1
     si l'appelant a besoin des deux)
   - `createAlimentPrevision(scenarioId, siteId, data)` → **transaction** : crée l'`AlimentPrevision`
     puis `createMany` ses `RepartitionMoisAliment` — jamais deux appels non transactionnels
   - `replaceRepartitionsMoisAliment(alimentPrevisionId, siteId, repartitions[])` → **transaction**
     obligatoire (c'est LA query citée par l'énoncé comme exigeant une transaction) : validation bloquante
     « somme = 100 % » (déjà prévue par l'ADR comme vivant en couche API, mais l'écriture elle-même,
     `deleteMany` + `createMany`, doit être dans la même transaction Prisma que la validation, cf.
     ADR §3.5)
   - `deleteAlimentPrevision(id, siteId)` → cascade DB déjà en place (`onDelete: Cascade` sur
     `RepartitionMoisAliment`), donc `delete` simple suffit, PAS de suppression manuelle enfant-par-
     enfant (à la différence de `deleteVague`, où le cascade DB est volontairement doublé pour raisons
     documentées ailleurs — ici rien ne justifie de dupliquer, `onDelete: Cascade` est natif)

3. **`src/lib/queries/previsions-vagues.ts`** — `VaguePrevue`, `AlimentParVaguePrevue` (le cœur métier :
   plan d'empoissonnement + besoin aliment par vague).
   - `getVaguesPrevuesParScenario(scenarioId, siteId, filters?)` → avec `alimentsParMois` si demandé
     explicitement (paramètre `withAliments?: boolean`, pour éviter de charger inutilement le détail
     mensuel sur une simple liste de plan)
   - `getVaguePrevueById(id, siteId)` → avec `alimentsParMois`, `journal`, `vague` (relation inverse),
     `enfantsScission`
   - `createVaguePrevue(scenarioId, siteId, data)` → simple `create` (pas de FK brute + include combinés
     si l'appelant sépare create/read, cf. piège Prisma 7 ci-dessus) — copie `dureeCycleMoisFigee`
     depuis `scenario.dureeCycleMois` **au moment de la création** (jamais recalculée après, ADR
     décision 1)
   - `updateVaguePrevue(id, siteId, data)` → refuse toute modification si `vagueId` réel est lié et que
     le champ touché fait partie des « figés » (`dureeCycleMoisFigee`) — logique métier, pas juste CRUD
   - `scinderVaguePrevue(id, siteId, scissions: {code, ...}[])` → **transaction obligatoire** (citée par
     l'énoncé) : crée N nouvelles `VaguePrevue` avec `vaguePrevueParentId = id`, statut `PLANIFIEE` sur
     les enfants, passe le parent en `ANNULEE` — jamais une suppression physique du parent (ADR
     décision 2)
   - `annulerVaguePrevue(id, siteId)` → passe `statut = ANNULEE`, **interdit si `vagueId` réel non nul**
     côté `Vague` (vérification avant écriture, throw explicite — pas de contrainte DB pour cette règle,
     donc portée par la query)
   - `rattacherVagueReelle(vaguePrevueId, vagueId, siteId)` — pas forcément une query dédiée : c'est
     plutôt `createVague`/`updateVague` (déjà existant dans `vagues.ts`) qui devra accepter
     `vaguePrevueId` optionnel ; **à trancher avec @architect** si cette story doit toucher
     `vagues.ts` existant ou si c'est repoussé à la story API qui exposera le flux de scission (l'énoncé
     de PR2.1 dit « rattachement à une vague réelle » comme faisant partie du périmètre — recommandation :
     une fonction `rattacherVaguePrevue(vagueId, vaguePrevueId, siteId)` dans
     `previsions-vagues.ts` qui fait l'`update` sur `Vague.vaguePrevueId`, et laisse la contrainte
     `@unique` de Prisma faire respecter le rejet en cas de double-rattachement (ADR décision 2) — PAS
     de vérification préalable qui dupliquerait ce que la contrainte DB fait déjà, R4)
   - `replaceAlimentsParVaguePrevue(vaguePrevueId, siteId, lignes[])` → **transaction** `deleteMany` +
     `createMany`, résultat du moteur (`sacsCalcules: Int`, jamais `Decimal`, cf. section homonymie)
   - `updateSacsSaisis(alimentParVaguePrevueId, siteId, sacsSaisis: number | null)` → `update` ciblé,
     champ éditable isolément (ADR : surcharge manuelle indépendante d'un recalcul complet)

4. **`src/lib/queries/previsions-charges.ts`** — `PostePrevision`, `ChargeMensuellePrevue`,
   `JournalDepensePrevue`, `ApportCapital`.
   - `getPostesPrevisionParScenario(scenarioId, siteId)`
   - `createPostePrevision(scenarioId, siteId, data)`
   - `getChargesMensuellesParScenario(scenarioId, siteId, moisAbsolu?)` — filtre optionnel un seul mois
     (évite de tout charger pour un simple formulaire d'un mois)
   - `upsertChargeMensuelle(posteId, siteId, moisAbsolu, montantFCFA)` — `upsert` sur `@@unique([posteId, moisAbsolu])`,
     opération naturellement atomique (R4), pas besoin de transaction explicite
   - `getJournalDepensesParScenario(scenarioId, siteId, filters?)` — filtrage par `vaguePrevueId`
     (affectée/non affectée) important pour `base_repartition` (décision 6 ADR)
   - `createJournalDepensePrevue(scenarioId, siteId, data)` / `updateJournalDepensePrevue` /
     `deleteJournalDepensePrevue`
   - `getApportsCapitalParScenario(scenarioId, siteId)` / `createApportCapital(scenarioId, siteId, data)`

5. **`src/lib/queries/previsions-scenario-loader.ts`** (ou une fonction dans `previsions-scenarios.ts`,
   à trancher par @db-specialist selon la taille réelle du fichier) — **le chargement complet d'un
   scénario pour le moteur**, fonction pivot de cette story :
   - `chargerScenarioPourMoteur(scenarioId, siteId): Promise<ScenarioPourCalcul>` — une seule fonction
     qui va chercher `ScenarioPrevision` + `ParametresPrevision` + `PalierRemise[]` +
     `AlimentPrevision[]` (avec `repartitions`) + `VaguePrevue[]` (avec `alimentsParMois`) +
     `PostePrevision[]` (avec `chargesMensuelles`) + `JournalDepensePrevue[]` + `ApportCapital[]`, et
     **convertit chaque `Decimal` Prisma en `Decimal` decimal.js** au passage (voir section Decimal),
     pour produire directement les types d'entrée du moteur (`AlimentPrevisionCalcInput`,
     `PalierRemiseInput`, etc., déjà définis dans `src/lib/previsions/types.ts`).
   - Doit être un **petit nombre de requêtes larges avec `include`/`select` ciblés**, jamais une boucle
     de queries par vague/aliment (N+1) — un scénario complet (19 vagues × 3 mois × N granulométries
     dans le jeu d'or) doit se charger en une poignée de round-trips, pas des centaines.

**Queries exigeant une transaction Prisma (explicitement listées par l'énoncé + trouvées à l'analyse)** :
- `createScenario` (crée 2+ modèles liés)
- `replacePaliersRemise` (remplacement en bloc)
- `createAlimentPrevision` (parent + repartitions)
- `replaceRepartitionsMoisAliment` (remplacement en bloc, cf. ADR §3.5 explicitement)
- `scinderVaguePrevue` (remplacement en bloc + changement de statut du parent)
- `replaceAlimentsParVaguePrevue` (remplacement en bloc)

## Pièges vérifiés dans le code réel

**Piège Prisma 7 create/update + include (FK brutes).** Se déclenchera concrètement sur : toute
création de `VaguePrevue`/`AlimentPrevision`/`ChargeMensuellePrevue`/`JournalDepensePrevue`/
`ApportCapital` qui passerait une FK brute (`scenarioId`, `posteId`, `vaguePrevueId`...) **et** un
`include` dans le même appel `create`/`update`. Contournement vérifié dans `vagues.ts` : séparer en
`create()` (sans `include`) puis `findUnique()`/`findUniqueOrThrow()` (avec `include`). À appliquer
systématiquement dans les 5 fichiers de queries proposés ci-dessus.

**Modèles sans `createdAt`/`updatedAt`.** Vérifié directement dans `prisma/schema.prisma` : n'ont
**ni l'un ni l'autre** — `PalierRemise`, `RepartitionMoisAliment`, `AlimentParVaguePrevue`,
`PostePrevision`, `ChargeMensuellePrevue`, `JournalDepensePrevue`, `ApportCapital`. `MappingRapprochement`
a `createdAt` seul (pas `updatedAt` — cohérent avec son modèle « jamais d'UPDATE en place », hors
périmètre PR2.1 de toute façon). `ClotureMois` n'a ni l'un ni l'autre (a `dateCloture` à la place).
Ont les deux : `ScenarioPrevision`, `ParametresPrevision`, `AlimentPrevision`, `VaguePrevue`.
**Conséquence directe** : toute query qui voudrait trier `JournalDepensePrevue` ou
`ChargeMensuellePrevue` par ordre de saisie doit trier sur un champ métier existant (`date`,
`moisAbsolu`) — jamais sur `createdAt`, qui n'existe pas sur ces modèles. Pour `PalierRemise`, le tri
naturel est `ordre` (explicite par construction, ADR §3.4) — jamais `createdAt` de toute façon, même
s'il existait.

**Capitalisation manquante.** Le contournement Prisma 7 create+include (confirmé utilisé dans
`vagues.ts`, connu de la mémoire du @db-specialist) n'a **pas d'entrée dédiée** dans
`docs/knowledge/ERRORS-AND-FIXES.md` — à signaler au @knowledge-keeper indépendamment de cette story,
pour que le prochain agent qui écrit une query n'ait pas à redécouvrir le piège par un message d'erreur.

## Vérifications exécutables — ligne de base avant travaux

- `npx prisma validate` : schéma valide.
- Client Prisma généré (`src/generated/prisma/models/*.ts`) : les 13 modèles du module Prévisions
  sont bien présents et générés.
- `npm run build` : compilation réussie, aucune erreur.
- `npx vitest run` : **236 fichiers passés / 3 skip (239 total), 6660 tests passés, 17 skipped,
  26 todo, 0 échec.**

## VERDICT : GO AVEC RÉSERVES

Aucun blocage factuel (build vert, schéma valide, client généré complet, tests verts). Points que le
@db-specialist doit trancher explicitement avant/en écrivant PR2.1, dans l'ordre de priorité :

1. **Créer l'utilitaire de conversion Decimal partagé** (`prismaDecimalToEngine` / `decimalToNumber`)
   avant d'écrire la première query, plutôt que de réinventer une conversion locale par fichier —
   c'est le risque n°1 de cette story, et le seul précédent du dépôt (`commissions.ts`) montre
   exactement l'erreur à ne pas répéter (Decimal brut jusqu'au JSON).
2. **Confirmer par un test d'intégration DB-gated** (pas une simple lecture de doc) que
   `new Decimal(prismaValue.toString())` restitue bien la valeur exacte pour au moins un cas limite
   du jeu d'or (ex. `margeSecuriteAlevinsPct`), avant de généraliser le pattern à toutes les queries.
3. **Choisir le découpage en 4-5 fichiers proposé** (ou le simplifier si @db-specialist juge que
   certains domaines sont trop petits pour mériter un fichier séparé — ex. fusionner
   `previsions-scenarios.ts` et le loader) ; documenter le choix dans le rapport de clôture de la
   story.
4. **Ne pas écrire de query `ClotureMois` complète dans PR2.1** — seulement une lecture minimale si
   une story UI de PR2 le demande explicitement, sinon la totalité relève de PR3.
5. **Ajouter le commentaire JSDoc de clarification** sur l'homonymie `sacsCalcules` dans
   `aliments.ts` (documentation seule, pas de renommage) — petit effort, referme la réserve 6 de PR1.
6. **Signaler au @knowledge-keeper** l'absence d'entrée ERR dédiée au piège Prisma 7 create+include,
   indépendamment de cette story.
