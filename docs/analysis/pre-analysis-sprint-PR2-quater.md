# Pré-analyse Sprint PR2-quater — 2026-08-03

## Statut : GO AVEC RÉSERVES

## Résumé

Le défaut de conception (homonymie calibre/article dans `AlimentPrevision`) est réel et confirmé
par lecture directe du code. L'état de départ est sain (build OK, 277 fichiers / 7588 tests / 0
échec, recette 1270/0 écart, schéma Prisma valide). Les 5 points d'arbitrage demandés sont tranchés
ci-dessous avec preuves de code. Un chantier concurrent est en cours sur
`src/components/previsions/aliments-tab.tsx` (retrait du badge `sacsParTonneUnitaire`) — **pas
encore fait** au moment de cette analyse : à coordonner, pas à écraser.

## Vérifications effectuées

### État de départ (factuel, sorties réelles)

```
npx vitest run
 Test Files  273 passed | 4 skipped (277)
      Tests  7588 passed | 19 skipped | 26 todo (7633)
```
Conforme à l'attendu (277 fichiers / 7588 tests / 0 échec).

```
npx vitest run src/lib/previsions/__tests__/recette/
 Test Files  3 passed (3)
      Tests  1270 passed (1270)
```
Conforme à l'attendu (1270/0 écart) — `plan-v12-corrige` 440, `annexe-b-corrigee` 440,
`route-orchestration.recette.test.ts` 390.

```
npm run build
```
Build production OK, aucune erreur (grep sur `error|fail` : 0 occurrence).

```
npx prisma validate
The schema at prisma/schema.prisma is valid 🚀
```

### `prisma/seed.sql` et fixtures — comptage

- `prisma/seed.sql` : contient `DELETE FROM "AlimentParVaguePrevue"/"AlimentPrevision"/"VaguePrevue"/"ScenarioPrevision"` mais **aucun `INSERT INTO "ScenarioPrevision"/"VaguePrevue"/"AlimentPrevision"`** — 0 ligne de seed pour tout le module Prévisions. Le seed ne sera donc pas cassé par cette migration (rien à réécrire), mais aucune donnée de démo n'existe pour valider manuellement le module après migration.
- `prisma/fixtures/previsions/plan-v12-corrige.json` : les 3 granulométries sont `"granulometrie": "2mm"/"3mm"/"4mm"` avec `marque` ("Marque A", "Marque A", "Marque B"), `sacsParTonneStandard` (8/18/50), `poidsSacKg` = 15 pour les trois. Ce sont des données de recette (JSON), jamais persistées via migration — aucun impact sur la migration Prisma elle-même, mais confirment le mapping mm ↔ `TailleGranule` utilisé au point 4.

### Chantier concurrent — `src/components/previsions/aliments-tab.tsx`

Fichier lu intégralement (non versionné : tout le module Prévisions est encore non commité,
`git status` le montre en `??`). **Le badge n'est PAS encore retiré** :

- Ligne 74-79 : la chaîne i18n `aliments.weightPrice` = `"{poids} kg/sac — {prix} (1 t d'aliment =
  {ratio} sacs)"` (`src/messages/fr/previsions.json:188`) est toujours rendue avec
  `ratio: formatRatioPrevision(a.sacsParTonneUnitaire)` — c'est exactement le badge/texte que la
  décision du développeur en cours vise à retirer (le ratio poids pur, qui n'a pas de sens
  nutritionnel et a causé ERR-138).
- Ligne 94-102 : le badge `needLabel`/`needMissing` (basé sur `sacsParTonneStandard`, le vrai
  coefficient de besoin) est correctement affiché séparément et n'est pas concerné par ce retrait.
- Aucune modification de test dans `aliments-tab.test.tsx` ne verrouille encore ce retrait (aucune
  assertion sur `ratio`/`weightPrice` présente).

**Recommandation pour le sprint** : ce fichier va être touché par PR2-quater de toute façon (le
niveau article — `poidsSacKg`, `prixSacFCFA`, `sacsParTonneUnitaire` — quitte le niveau calibre).
Ne pas écraser le travail en cours à l'aveugle : avant de restructurer ce composant,
1. vérifier l'état git le plus récent de ce fichier (il peut avoir changé entre cette analyse et le
   début de l'implémentation),
2. traiter le retrait du badge comme une sous-étape du refactor (le ratio `sacsParTonneUnitaire`
   n'a plus sa place dans une carte "calibre" une fois que `poidsSacKg`/le ratio deviennent des
   attributs d'article — la restructuration règle donc ce chantier par construction si elle est
   bien faite, mais il faut vérifier explicitement que le texte "1 t d'aliment = X sacs" ne
   réapparaît pas accroché au mauvais niveau après refactor).

## Les 5 points d'arbitrage — tranchés

### 1. Calcul du coût quand un calibre a N articles

**Constat de code.** `appliquerPalierRemise(sacs, prixSacFCFA, paliers)` (`aliments.ts`) prend UN
SEUL prix. `route-orchestration.ts` calcule aujourd'hui, par granulométrie :
```
besoinTotalCycleKg = tonnageCibleTonnes × sacsParTonneStandard × poidsSacKg   // GAP1(1/2)
sacsCalculesCycle  = ceilViaMoteur(poidsSacKg, besoinTotalCycleKg)            // = ceil(kg / poidsSacKg)
```
**Découverte non demandée par le brief mais critique** : algébriquement, `kg / poidsSacKg` où
`kg = tonnage × coef × poidsSacKg` fait que `poidsSacKg` **s'annule exactement** (Decimal, precision
20 configurée dans `decimal-config.ts` — largement suffisant pour ces ordres de grandeur, division
exacte vérifiée). Le passage par les kg est donc un aller-retour mathématiquement redondant
aujourd'hui — mais c'est *cet* aller-retour qui décide, dans le modèle actuel, quel `poidsSacKg`
sert de référence pour convertir le besoin biologique en nombre de sacs. Dès que `poidsSacKg` migre
au niveau article (comme l'exige la cible), il n'existe plus **un seul** `poidsSacKg` de calibre
pour faire ce même calcul — il faut trancher explicitement lequel utiliser, faute de quoi la
formule devient ambiguë sans qu'aucun test ne le révèle (le seul cas testé par la recette,
1 article/100%, ne peut pas distinguer les deux implémentations candidates).

**Décision recommandée : moyenne pondérée par la part d'approvisionnement, jamais split-puis-somme.**
- `poidsSacKgReference (calibre)` = Σ(article.poidsSacKg × part_i) / 100
- `prixSacFCFAReference (calibre)` = Σ(article.prixSacFCFA × part_i) / 100
- Ces deux valeurs de référence sont ensuite injectées **telles quelles** dans le moteur **inchangé**
  (`calculerBesoinAlimentMensuel`, `appliquerPalierRemise`, `calculerCoutAlimentVague`) — aucune
  signature de `src/lib/previsions/aliments.ts`/`types.ts` ne change.
- **Preuve de non-régression** : dans le cas dégénéré 1 article à 100 %, la moyenne pondérée d'un
  seul terme à 100 % est **égale exactement** au terme lui-même (`x × 100 / 100 = x`, Decimal, aucune
  perte). La recette (1270 tests, y compris les 390 de `route-orchestration.recette.test.ts`)
  reste donc byte-identique sans aucune modification du moteur pur.
- **Pourquoi pas split-puis-somme** : répartir les sacs entre articles puis appliquer
  `appliquerPalierRemise` **par article** changerait la sémantique déjà documentée et vérifiée par
  la recette PR1.4 dans `aliments.ts` (« la remise est décidée UNE SEULE FOIS pour la vague entière,
  sur son tonnage/sacs-cycle propres, PUIS répartie — jamais recalculée sur un sous-volume »). Avec
  N articles, un split préalable ferait évaluer le palier sur des volumes plus petits par article,
  produisant une remise **plus faible** qu'aujourd'hui dès que N > 1 — un écart pur d'implémentation,
  pas un choix produit assumé. La moyenne pondérée préserve l'invariant « décision de palier unique
  par calibre par vague ».
- **Interaction avec `appliquerPalierRemise`** : le palier continue de s'appliquer au total de sacs
  du **calibre** (comme aujourd'hui), jamais par article — cohérent avec ERR-143, qui reste un point
  ouvert *orthogonal* (le scope de `PalierRemise` lui-même — par scénario vs par granulométrie —
  n'est ni aggravé ni résolu par ce choix ; ce sprint ne le retranche pas).
- **Répartition des sacs par article** (pour un futur bon de commande par marque) reste une opération
  **d'affichage/suggestion downstream**, dérivée de `sacsNecessaires (calibre) × part_i`, jamais
  réinjectée dans le calcul du coût.

### 2. Le sort de `AlimentParVaguePrevue.alimentPrevisionId`

**Consommateurs réels inventoriés** avant de trancher : `route-orchestration.ts` (clé `aliment.id`
= calibre), `src/lib/queries/previsions-vagues.ts` (tri/`orderBy` par `alimentPrevisionId`, écriture
`replaceAlimentsParVaguePrevue`), `src/components/previsions/repartition-mois-dialog.tsx` (opère au
grain calibre, pas article), `RepartitionMoisAliment` (déjà au grain calibre, ADR §3.5).

**Décision : la FK reste pointée sur le CALIBRE, sans aucun changement de schéma sur
`AlimentParVaguePrevue`.** Directement conséquence du point 1 : puisque `sacsNecessaires`/
`coutCalculeFCFA` restent des grandeurs de calibre (calculées via prix/poids de référence pondérés),
`sacsCalcules`, `sacsSaisis`, `quantiteKgCalculee`, `coutCalculeFCFA` restent tous des grandeurs de
calibre — aucune raison de faire pointer la FK vers l'article. La surcharge manuelle `sacsSaisis`
reste elle aussi au niveau calibre : un pisciculteur qui ajuste « j'ai utilisé plus/moins de 2mm que
prévu » raisonne en calibre, pas en marque — `COALESCE(sacsSaisis, sacsCalcules)` continue de
s'appliquer sans changement de sémantique.

**Conséquence positive pour la migration (point 5)** : puisque le PK d'`AlimentPrevision` (qui
devient le calibre) n'a pas besoin de changer, ni `AlimentParVaguePrevue.alimentPrevisionId` ni
`RepartitionMoisAliment.alimentPrevisionId` n'ont besoin d'être touchés par la migration — seule la
table `AlimentPrevision` elle-même est restructurée (colonnes article extraites vers une nouvelle
table enfant).

**Conséquence pour PR3 (rapprochement)** : `produitId` migre au niveau article (voir point 1/5) ;
le rapprochement prévu/réel devra donc joindre `MouvementStock.produitId` → article(s) portant ce
`produitId` → calibre parent, puis comparer au total calibre déjà planifié dans
`AlimentParVaguePrevue`. C'est cohérent avec le fait que le besoin/coût est décidé au niveau calibre :
plusieurs achats réels de marques différentes se recomposent naturellement vers une seule ligne de
comparaison prévue.

### 3. Somme des parts d'approvisionnement

**Décision : contrainte à 100 %, bloquante à l'enregistrement, exactement le même patron que
`validerSommeRepartitionMoisAliment`.** Constat de code : cette fonction existe déjà dans
`src/lib/previsions/validation.ts` (lignes ~34-42) et lève une erreur si la somme des pourcentages
≠ 100, appelée en amont de l'écriture, dans la même transaction Prisma (R4). Une nouvelle fonction
analogue, ex. `validerSommeApprovisionnementArticles(articles)`, doit vivre au même endroit
(`src/lib/previsions/validation.ts`) et être appelée par la route API qui écrit
`AlimentArticlePrevision` en lot (`createMany`/`updateMany` remplaçant l'ensemble des articles d'un
calibre en une transaction — même pattern « replace-all » que `RepartitionMoisDialog` /
`replaceRepartitionMoisAliment`), jamais une vérification préalable suivie d'une écriture non
protégée. Aucune contrainte SQL (même raison qu'en §3.5 de l'ADR : un `CHECK` ne voit qu'une ligne
à la fois).

### 4. Vocabulaire — `TailleGranule` vs millimètres

**Constat de code** : `TailleGranule` (schema.prisma, enum `P0 P1 P2 P3 G1 G2 G3 G4 G5`) a **déjà**
une correspondance mm complète et existante en i18n, dans deux fichiers de messages
(`src/messages/fr/stock.json:69-77` et `src/messages/fr/analytics.json:221-231`, avec équivalent
`en/`) :
```
"G1": "G1 — Granulé 2mm", "G2": "G2 — Granulé 3mm", "G3": "G3 — Granulé 4mm", ...
```
Ce mapping colle **exactement** aux granulométries du jeu d'or (2mm→G1, 3mm→G2, 4mm→G3 — les trois
seules utilisées dans `plan-v12-corrige.json`).

`ConfigElevage.alimentTailleConfig` est un **référentiel entièrement différent** : un JSON libre de
tranches de poids de poisson → description d'aliment (`{"poidsMin":0,"poidsMax":15,"tailleGranule":
"1.2mm", "description": "Aliment demarrage", ...}`, consommé par `activity-engine/feeding.ts` pour
des recommandations d'activité). Ses valeurs `tailleGranule` sont des **chaînes libres** (`"1.2mm"`,
`"2-3mm"`, `"4-6mm"`...), pas les codes de l'enum `TailleGranule` — et son usage (suggestion
d'activité par poids de poisson) est sémantiquement indépendant du calibre planifié dans le module
Prévisions (composition du plan d'achat par cycle).

**Décision : réutiliser exactement les libellés existants du namespace `stock`/`analytics`
(`tailleGranule.G1`... déjà traduits fr/en), ne PAS inventer un second référentiel.** L'UI du module
Prévisions affiche le calibre via `<Select>`/badge peuplé par l'enum `TailleGranule`, avec les mêmes
clés i18n (`t("stock.tailleGranule.G1")` ou dupliquées dans `previsions.json` avec le même texte —
à trancher par convention de namespace existante du projet, mais le contenu doit être identique,
jamais reformulé indépendamment). `alimentTailleConfig` n'est touché par rien de ce sprint.

### 5. Migration des données existantes

**État réel constaté** : `prisma/seed.sql` ne contient aucune ligne `AlimentPrevision` (voir plus
haut) — le scénario de collision (deux lignes du même scénario avec la même `tailleGranule`) et le
scénario `tailleGranule = null` ne sont **pas démontrables dans ce dépôt aujourd'hui**. Mais
`Produit.tailleGranule` est **nullable** dans le schéma actuel (`tailleGranule TailleGranule?`,
ligne 1586) et `copierAlimentsPrevisionDepuisProduits` (`previsions-scenarios.ts:244-275`) copie
`produit.tailleGranule` **tel quel**, y compris `null`, dans un `AlimentPrevision` par `Produit` —
donc un environnement réel (dev/staging non visible depuis ce dépôt) pourrait déjà contenir des
lignes `tailleGranule = null`, ou deux `Produit` actifs de catégorie `ALIMENT` partageant la même
`tailleGranule` (exactement le cas multi-marque qui motive ce sprint), produisant après migration
une collision sur `@@unique([scenarioId, tailleGranule])`.

**Décision explicite (R10) — ni valeur de repli, ni suppression silencieuse :**
- **`tailleGranule = null`** : migration **rejetée par un garde-fou de précondition intégré à la
  migration elle-même** (un bloc `DO $$ ... RAISE EXCEPTION` en tête de fichier
  `migration.sql`, avant tout `ALTER TABLE`), qui échoue bruyamment si `SELECT count(*) FROM
  "AlimentPrevision" WHERE "tailleGranule" IS NULL` est non nul. Jamais une valeur de repli
  inventée (0/`P0`/copie d'un autre champ) — cohérent avec la discipline déjà appliquée par l'ADR
  à `sacsParTonneStandard`. Cas no-op garanti : sur une table vide (état actuel de ce dépôt), la
  garde passe trivialement.
- **Collision `(scenarioId, tailleGranule)`** : même traitement, un second garde-fou (`GROUP BY
  "scenarioId", "tailleGranule" HAVING count(*) > 1`) qui échoue bruyamment plutôt que de fusionner
  arbitrairement deux lignes en devinant une part d'approvisionnement 50/50 (ou toute autre
  répartition) — une fusion automatique inventerait une donnée métier (la part réelle de chaque
  marque) qui n'existe nulle part dans les lignes sources.
- **Cas nominal (aucune collision, aucun null)** : le PK d'`AlimentPrevision` est **conservé** (voir
  point 2) — la migration ne fait donc **aucun** `INSERT`/remap de FK sur `AlimentParVaguePrevue`
  ni `RepartitionMoisAliment`. Elle : (a) crée `AlimentArticlePrevision` (nouvelle table, FK
  `alimentCalibrePrevisionId` → `AlimentPrevision.id`), (b) copie `poidsSacKg`, `prixSacFCFA`,
  `produitId`, `libelle`, `sacsParTonneUnitaire` de chaque `AlimentPrevision` existante vers une
  unique ligne `AlimentArticlePrevision` fille avec `partApprovisionnementPct = 100`, (c) `DROP
  COLUMN` ces mêmes colonnes sur `AlimentPrevision`, (d) rend `tailleGranule` `NOT NULL`. **Attention
  au piège déjà rencontré (ERR-140)** : relire à la main tout SQL généré par `prisma migrate diff`
  avant de l'appliquer — un déplacement de colonne entre deux tables n'est structurellement pas un
  renommage simple, mais le contenu doit être préservé par un `INSERT ... SELECT` explicite, jamais
  un simple `DROP`/`ADD` qui perdrait les valeurs.
- Idempotence : chaque étape est un no-op silencieux si la table source est vide (garanti par
  `INSERT ... SELECT` sur un ensemble vide) — conforme R10.

## Inventaire exhaustif des fichiers impactés

- `prisma/schema.prisma` : `AlimentPrevision` restructuré (retrait `produitId`, `libelle`,
  `poidsSacKg`, `prixSacFCFA`, `sacsParTonneUnitaire` ; ajout `@@unique([scenarioId,
  tailleGranule])`, `tailleGranule` NOT NULL) ; nouvelle table `AlimentArticlePrevision`.
- `prisma/seed.sql` : aucune ligne existante à migrer (confirmé), mais toute story future qui y
  ajouterait des données de démo pour Prévisions doit utiliser le nouveau modèle à deux niveaux dès
  le départ.
- `prisma/fixtures/previsions/*.json` : inchangés en valeur (ce sont des données de recette, pas des
  lignes persistées) — mais `helpers.ts`/`orchestration.ts`/`route-orchestration-builder.ts` (dans
  `__tests__/recette/`) qui construisent des `AlimentPrevisionCalcInput`/`ScenarioPourCalcul` à
  partir de ces fixtures devront être vérifiés pour confirmer qu'ils continuent de produire un seul
  article à 100 % par calibre (cas dégénéré garant de la non-régression du point 1).
- `src/types/models.ts`, `src/types/index.ts`, `src/types/api.ts` : nouveau type
  `AlimentArticlePrevision`/DTO, `AlimentPrevisionDTO` restructuré (retrait des champs déplacés,
  ajout d'un tableau `articles`).
- `src/lib/queries/previsions-aliments.ts`, `previsions-scenarios.ts` (notamment
  `copierAlimentsPrevisionDepuisProduits`, à regrouper par `tailleGranule`), `previsions-vagues.ts`,
  `previsions-scenario-loader.ts` (chargeur pour le moteur — doit désormais résoudre les valeurs de
  référence pondérées avant d'appeler `route-orchestration.ts`).
- `src/lib/previsions/route-orchestration.ts` : calcul des valeurs de référence pondérées (point 1),
  `types.ts` de la couche orchestration (pas le moteur pur `aliments.ts`, qui reste intouché).
- `src/lib/previsions/validation.ts` : nouvelle fonction de validation somme = 100 % des parts
  d'approvisionnement.
- `src/app/api/previsions/scenarios/[id]/aliments/**`, nouvelle route
  `.../aliments/[id]/articles` (CRUD des articles d'un calibre, remplace-tout comme
  `RepartitionMoisDialog`).
- `src/components/previsions/aliments-tab.tsx` (chantier concurrent — voir section dédiée),
  `aliment-form-dialog.tsx` (ajout des champs `tailleGranule`, `produitId` manquants — cause racine
  du second défaut signalé dans le contexte), nouveau composant de gestion des articles.
- `src/messages/{fr,en}/previsions.json` : nouvelles clés pour le formulaire calibre/article,
  réutilisation des clés `tailleGranule.*` existantes (point 4).
- Tests : `src/lib/queries/__tests__/previsions-aliments.test.ts`,
  `previsions-scenarios.test.ts`, `previsions-scenario-loader.test.ts`,
  `src/lib/previsions/__tests__/recette/*` (vérifier non-régression du cas dégénéré),
  `src/components/previsions/__tests__/aliments-tab.test.tsx`,
  `aliment-form-dialog.test.tsx`.
- `docs/knowledge/ERRORS-AND-FIXES.md` : à documenter par @knowledge-keeper après implémentation
  (nouvelle entrée pour ce refactor, référence croisée avec ERR-138/139/140/143).

## Risques identifiés

1. **Chantier concurrent sur `aliments-tab.tsx`** — collision d'édition si l'implémenteur du refactor
   ne relit pas l'état git le plus récent avant de commencer (impact : régression du retrait de
   badge déjà en cours). Mitigation : décrite en section dédiée ci-dessus.
2. **`prisma migrate diff` ne détecte pas un déplacement de colonne entre deux tables** (variante
   d'ERR-140, plus sévère qu'un simple renommage) — le SQL généré fera un `DROP COLUMN` pur sur
   `AlimentPrevision` sans jamais générer l'`INSERT INTO "AlimentArticlePrevision" SELECT ...`
   nécessaire pour préserver la donnée. Mitigation : écrire ce SQL à la main, ne jamais appliquer le
   diff généré tel quel.
3. **`ConfigElevage.alimentTailleConfig` pourrait être confondu avec `TailleGranule`** par un agent
   qui n'aurait pas lu ce rapport — les deux référentiels se ressemblent superficiellement (les deux
   parlent de "taille de granulé"). Mitigation : ce rapport documente explicitement pourquoi ce sont
   deux domaines indépendants (point 4) ; à faire remonter à ERRORS-AND-FIXES si un agent futur les
   confond en pratique.
4. **ERR-143 (scope de `PalierRemise`) reste un point ouvert non résolu par ce sprint** — le choix du
   point 1 (moyenne pondérée) ne l'aggrave ni ne le corrige, mais toute story qui voudrait résoudre
   ERR-143 en scopant `PalierRemise` par `AlimentPrevision` (option b) devra composer avec le fait
   que `AlimentPrevision` est désormais le calibre (pas l'article) — cohérent, mais à rappeler
   explicitement à qui traitera ERR-143 plus tard.

## Prérequis manquants avant implémentation

1. **Validation formelle par @architect** des 5 arbitrages ci-dessus (ce rapport les tranche avec
   arguments et preuves de code, mais la mission demande un arbitrage avant qu'une ligne de code ne
   soit écrite — un ADR-053 amendement supplémentaire, sur le modèle de la section 11 déjà existante,
   est recommandé pour acter formellement le passage à deux niveaux, avant la story
   d'implémentation).
2. **Vérifier l'état git courant de `aliments-tab.tsx`** immédiatement avant de démarrer
   l'implémentation (le chantier concurrent peut avoir avancé entre cette analyse et le début du
   sprint).
3. **Écrire et relire à la main** la migration Prisma (garde-fous de précondition + `INSERT ...
   SELECT` de préservation) avant toute application — ne jamais faire confiance au SQL généré brut
   (ERR-140).

## Recommandation

**GO**, sous réserve que les 3 prérequis ci-dessus soient traités en tout début de sprint (le premier
avant tout code, les deux autres au moment de l'implémentation). Aucun défaut d'état de dépôt ne
bloque : build, tests, recette et schéma sont tous sains au moment de cette analyse.
