# Pré-analyse Sprint PR2-septies — La remise fournisseur se décide au tonnage de la vague
**Date :** 2026-08-04 · **Agent :** @pre-analyst · **Périmètre :** stories 2 (SCHEMA), 3 (moteur/QUERIES), 4 (UI)

## Statuts

| Story | Verdict |
|---|---|
| **2 — SCHEMA** (`seuilSacs` → `seuilTonnes`) | **GO** |
| **3 — Moteur** (remise décidée au tonnage de la vague) | **GO AVEC RÉSERVE** (un arbitrage à trancher : le sort de `sacsSaisis` dans la décision de remise) |
| **4 — UI** (libellé/aide contextuelle) | **GO** |

Base saine : 287 fichiers / 8753 tests, 0 échec ; `npm run build` OK ; `PalierRemise` **vide en base** (0 ligne, tous scénarios confondus) → aucune donnée à convertir.

---

## A. Formule du tonnage d'une vague — CONFIRMÉE, elle existe déjà

**Chemin :** `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/route-orchestration.ts`
**Fonction :** `tonnageCibleKg`, **ligne 289-291**

```ts
function tonnageCibleKg(vague: VaguePrevuePourCalcul, poidsObjectifG: Decimal): Decimal {
  return new Decimal(vague.effectifAlevinsPrevu).times(poidsObjectifG).dividedBy(1000);
}
```

puis, **ligne 399** : `const tonnageCibleTonnes = tonnageCible.dividedBy(1000);`

Soit exactement `effectifAlevinsPrevu × poidsObjectifG / 1 000 000` en tonnes — l'énoncé du sprint est **confirmé**, et la formule **ne doit pas être réécrite** : elle est déjà dans le fichier, documentée en tête (GAP 1, ADR-053 §11) et déjà utilisée pour `sacsCalculesCycle` (ligne 407). Story 3 doit **réutiliser `tonnageCibleTonnes` déjà calculé dans la boucle**, jamais recalculer.

- **`objectifTonnes` persisté sur `VaguePrevue` : N'EXISTE PAS.** Vérifié sur `prisma/schema.prisma:4562-4595` — les champs sont `code, dateStockagePrevue, effectifAlevinsPrevu, poidsMoyenInitialG, dureeCycleMoisFigee, statut, vaguePrevueParentId, siteId`. L'en-tête de `route-orchestration.ts:21-23` le dit explicitement : « Le schéma de production n'a pas de champ "tonnage cible" par `VaguePrevue` (contrairement au jeu d'or, qui le fournit comme une entrée littérale, `objectifTonnes`) ». **Ne pas ajouter ce champ** dans ce sprint : ce serait une donnée dérivée dupliquée, et l'ADR a déjà tranché en faveur du calcul.
- **Mortalité / marge de sécurité alevins : N'INTERVIENT PAS.** ADR-053 décision 4 + `route-orchestration.ts:61-70` : `tonnageCibleKg()` est fondé sur `effectifAlevinsPrevu` (= D, poissons à vendre), la marge `margeSecuriteAlevinsPct` ne concerne **que** l'achat et le transport d'alevins (`alevinsACommanderNb`, = E). Confondre les deux est le bug ERR-141/ERR-142 déjà corrigé — **ne pas le réintroduire** dans la décision de remise.
- **Type : `Decimal`** (`src/lib/previsions/decimal-config.ts`, `precision: 20`, `ROUND_HALF_UP`). Jamais `number`, jamais d'opérateur natif.
- **Alignement sur le jeu d'or :** dans le classeur, `planVagues[].objectifTonnes` est **saisi directement** (`Empoissonnement!A4:H22`). Vérifié : la valeur saisie **coïncide exactement** avec le calcul — `poissonsAVendreNb × poidsMoyenVenteKg` (10 000 × 0,4 kg = 4 t ; 37 500 × 0,4 = 15 t) sur les 19 vagues. **Le moteur doit rester sur le calcul** (le schéma ne porte pas la valeur saisie) ; le jeu d'or reste valide car les deux coïncident. Vérifié aussi côté base (requête §E) : les 19 `VaguePrevue` du scénario `EXCEL-V12` donnent 4/4/8/8/10/12/15×13 t, identique à la fixture.

---

## B. Story 2 — SCHEMA

### Localisation
`prisma/schema.prisma:4446-4458`
```prisma
model PalierRemise {
  id                String            @id @default(cuid())
  scenarioId        String
  scenario          ScenarioPrevision @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  seuilSacs         Decimal   // ← à renommer
  pourcentageRemise Decimal
  ordre             Int
  siteId            String
  site              Site              @relation(fields: [siteId], references: [id])
  @@index([scenarioId])
  @@index([siteId])
}
```
Aucune FK entrante, aucune contrainte unique, deux index simples. **Le scope reste le scénario** — c'est correct après correctif : la remise redevient un paramètre unique de scénario, décidé sur une grandeur (le tonnage) qui, elle, varie par vague. C'est précisément ce qui résout ERR-143 sans scoper `PalierRemise` par `AlimentPrevision` (option (b) de ERR-143, à **écarter**).

### Nom du champ — TRANCHÉ : `seuilTonnes`, type `Decimal` sans `@db.Decimal`

Justification :
1. **Cohérence avec le jeu d'or** : les fixtures (`prisma/fixtures/previsions/plan-v12-corrige.json:42-67`, `annexe-b-corrigee.json:42-67`) nomment déjà ce champ `seuilTonnes`, avec `$source: "Paramètres!B16:C19"`. Le README (`prisma/fixtures/previsions/README.md:80`) l'appelle « 4 paliers (seuil en tonnes, % de remise, ordre) ».
2. **L'unité doit rester dans le nom** — c'est la confusion d'unité qui a produit le bug de facteur ~8300 (ERR-138/139). `seuil` nu serait une régression méthodologique.
3. **Type `Decimal` nu** (aucun `@db.Decimal(p,s)`) : vérifié par grep, **aucun** champ du module Prévisions ne porte d'annotation `@db.Decimal` — tous sont en `DECIMAL(65,30)` par défaut de Prisma (cf. `prisma/migrations/20260803120100_add_previsions_module/migration.sql:63`). Introduire une précision ici créerait une exception isolée dans un modèle homogène, et un tonnage à 0,001 t près (le kg) reste très largement dans la portée. **Ne pas ajouter `@db.Decimal`.**

### Valeur existante en base — TRANCHÉ : il n'y en a aucune, la migration est un renommage pur

**Fait vérifié (§E) : `SELECT count(*) FROM "PalierRemise"` → 0.** Zéro ligne, tous scénarios et tous sites confondus, y compris `EXCEL-V12`. La table n'a jamais été peuplée — `prisma/seed.sql:75` ne contient qu'un `DELETE FROM "PalierRemise";` et aucun `INSERT`.

Conséquence : **la question de la conversion sacs→tonnes est sans objet en pratique**, mais la démonstration reste à énoncer dans la migration, car elle est vraie dans l'absolu :

> Une conversion sacs→tonnes **n'est pas déterministe**. Le facteur `sacsParTonneStandard` vaut 8 / 18 / 50 selon la granulométrie (vérifié en base : `AlimentPrevision.sacsParTonneStandard` = 8, 18, 50 pour G1/G2/G3). Un `seuilSacs` unique par scénario n'appartient à aucune granulométrie en particulier ; il n'existe donc **aucun facteur unique** pour le convertir. Toute migration qui « devinerait » une conversion inventerait une donnée métier.

**Stratégie R10-conforme retenue (par ordre de priorité) :**
1. `ALTER TABLE "PalierRemise" RENAME COLUMN "seuilSacs" TO "seuilTonnes";` — **jamais** la paire `DROP COLUMN`/`ADD COLUMN` que `prisma migrate diff` va générer (ERR-140, piège déjà rencontré deux fois sur ce module ; relire et éditer à la main le SQL généré, avec commentaire d'en-tête expliquant l'édition).
2. **Garde-fou de précondition dans la migration elle-même** (jamais dans un script préalable, R10) : un bloc `DO $$ ... IF (SELECT count(*) FROM "PalierRemise") > 0 THEN RAISE EXCEPTION ...` qui **bloque bruyamment** si des lignes existent au moment de l'application (le cas de la prod future, ou d'une base de dev où quelqu'un aurait saisi des paliers entre-temps). Le message doit dire quoi faire : re-saisir les seuils en tonnes depuis l'onglet Paramètres. Idempotent et no-op silencieux sur base vide.
3. **Écarté : écrire des valeurs cibles issues du classeur** (0 / 5 / 10 / 15 t → 0 / 2 / 4 / 6 %). Elles sont pourtant documentées et vérifiables (`Paramètres!B16:C19`, fixtures lignes 42-67). Raison du rejet : ces valeurs appartiennent au **classeur de référence d'un utilisateur**, pas au schéma ; un `INSERT` conditionné au seul nom de scénario `EXCEL-V12` ferait entrer une donnée métier d'un client particulier dans une migration partagée par tous les sites — et il n'y a de toute façon **rien à sauver** (0 ligne). Si l'utilisateur veut ces 4 paliers, il les saisit dans l'UI (4 champs, 30 secondes), ce qui a le mérite d'exercer le chemin réel corrigé.

### Fichiers référençant `seuilSacs` (grep exhaustif, chemins absolus)

**Schéma / migration**
- `/Users/ronald/project/dkfarm/farm-flow/prisma/schema.prisma:4450` (champ), `:4452` (commentaire de `ordre`)
- `/Users/ronald/project/dkfarm/farm-flow/prisma/migrations/20260803120100_add_previsions_module/migration.sql:63` — **NE PAS TOUCHER** (migration passée, R10 : une migration appliquée est immuable)
- `/Users/ronald/project/dkfarm/farm-flow/prisma/seed.sql:75` — `DELETE FROM "PalierRemise";` seulement, **aucun changement requis**

**Types**
- `/Users/ronald/project/dkfarm/farm-flow/src/types/models.ts:4280` (`seuilSacs: number`), `:4282` (commentaire)
- `/Users/ronald/project/dkfarm/farm-flow/src/types/index.ts:270` — barrel export du type `PalierRemise` (nom du type inchangé, rien à faire)
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/types.ts:63` (commentaire), `:65` (`seuilSacs: Decimal`)
- `/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/api-types.ts:58` (`seuilSacs: Dec`)

**Validation / queries / API**
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/validation/previsions.schema.ts:96` (zod `palierRemiseInputSchema`)
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/previsions-scenarios.ts:91` (type d'entrée), `:468`, `:479`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/previsions-scenario-loader.ts:300`
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/previsions/scenarios/[id]/paliers-remise/route.ts` — aucune occurrence littérale (passe par le schéma zod), **rien à changer**

**Moteur**
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/aliments.ts:88`, `:90` (JSDoc), `:112` (`sacsDecimal.gte(palier.seuilSacs)`)
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/validation.ts:66`, `:68` (`validerPaliersRemiseCroissants` + message d'erreur)

**UI**
- `/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/parametres-tab.tsx:153`, `:166`, `:264`, `:265`
- `/Users/ronald/project/dkfarm/farm-flow/src/components/pages/previsions-scenario-detail-page.tsx:238`

**Tests**
- `src/lib/previsions/__tests__/validation.test.ts:43,44,45,53,54,62,63,72,73,82`
- `src/lib/previsions/__tests__/aliments.test.ts:87,88,89,106,128,129,344,345,375,376`
- `src/lib/previsions/__tests__/recette/orchestration.ts:159`, `:358`
- `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts:454,455`
- `src/lib/previsions/__tests__/recette/route-orchestration-builder.ts:25` (JSDoc du contournement n°3, voir §C)
- `src/lib/queries/__tests__/previsions-scenario-loader.test.ts:94,204`
- `src/lib/queries/__tests__/previsions-scenarios.test.ts:118,274,275,285,286,301,302,318`
- `src/__tests__/api/previsions-validations-http-mapping.test.ts:188,189`
- `src/__tests__/api/previsions-auth-permissions.test.ts:264`

**Docs (hors périmètre de modification, à laisser à @knowledge-keeper / @architect)** : `docs/decisions/ADR-053-module-previsions.md:242,244` (§3.4, append-only — déjà amendé par un renvoi ligne 253), `docs/knowledge/ERRORS-AND-FIXES.md`, `docs/reviews/*`, `docs/tests/*`, `docs/TASKS.md`, `docs/sprints/*`.

---

## C. Story 3 — Moteur

### Signatures actuelles

`/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/aliments.ts`

| Ligne | Signature |
|---|---|
| 102-121 | `appliquerPalierRemise(sacs: number, prixSacFCFA: Decimal, paliers: PalierRemiseInput[]): RemiseAppliqueeResult` |
| 191-197 | `calculerCoutAlimentVague(alimentsParVague: AlimentParVagueCalcInput[]): Decimal` |
| 289-300 | `calculerCoutAlimentGranulometrieParMois(ligne: AlimentParVagueMensuelCalcInput): CoutAlimentGranulometrieMoisResult[]` |

### Appelants de `appliquerPalierRemise`
1. `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/aliments.ts:194` (dans `calculerCoutAlimentVague`)
2. `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/aliments.ts:293` (dans `calculerCoutAlimentGranulometrieParMois`)
3. `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/route-orchestration.ts:465-469` — **le seul appelant applicatif réel**
4. Tests : `src/lib/previsions/__tests__/aliments.test.ts` (5 cas), `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts:454`

### Appelants de `calculerCoutAlimentVague`
1. `src/lib/previsions/__tests__/recette/orchestration.ts:172` (`buildCoutAlimentsParVague`) — **recette uniquement**
2. `src/lib/previsions/__tests__/aliments.test.ts`
3. Réexport : `src/lib/previsions/index.ts`
**Aucun appelant applicatif** — `route-orchestration.ts` n'utilise pas cette fonction (il compose lui-même `appliquerPalierRemise` + somme par article, cf. ADR §12.2 arbitrage 1). C'est une bonne nouvelle : la surface de risque applicative est réduite au seul bloc `route-orchestration.ts:455-490`.

### Signature cible

```ts
appliquerPalierRemise(tonnageVagueT: Decimal, coutBrutFCFA: Decimal, paliers: PalierRemiseInput[]): RemiseAppliqueeResult
```
ou, en préservant la forme existante, `(tonnageVagueT: Decimal, prixSacFCFA: Decimal, sacs: number, paliers)`. **Recommandation : la première** — le nom `sacs` dans le résultat (`RemiseAppliqueeResult.sacs`) n'a plus aucun sens une fois la remise décidée au tonnage, et le seul appelant applicatif ne lit déjà que `pourcentageRemiseApplique` (ligne 465). Le champ `sacs` du résultat doit disparaître, pas être conservé « au cas où ».

**Où le point d'application se déplace** : dans `route-orchestration.ts`, l'appel ligne 465 est aujourd'hui **dans** la boucle `for (const aliment of scenario.aliments)`. Après correctif, il n'a plus de dépendance à `aliment` → il doit être **hissé au niveau de la vague**, juste après le calcul de `tonnageCible` (ligne 381), et le `pourcentageRemiseApplique` calculé **une fois** puis appliqué aux coûts de chaque calibre (ligne 484-486, inchangée). C'est littéralement la mise en œuvre de « la remise se décide une fois par vague prévue ».

**Ordre des opérations et arrondis — établi, à vérifier** :
1. `ceil` **par granulométrie**, inchangé, en amont (`sacsCalculesCycle` ligne 407, `calculerBesoinAlimentMensuel` ligne 66) — README §Vérifications numériques point 1 ;
2. répartition entière entre articles (`repartirSacsEntreArticles`, Hare-Niemeyer, Σ exacte), inchangée ;
3. coût brut agrégé = Σ(sacs_article × prix_article), inchangé ;
4. **remise appliquée en dernier, une seule fois, sur l'agrégat** : `coutBrut × (1 − r/100)`.
Aucun `ceil`/`round` ne s'intercale entre 3 et 4, donc l'ordre n'introduit aucune nouvelle dérive. Algébriquement Σ(cᵢ(1−r)) = (Σcᵢ)(1−r) ; avec `precision: 20` de decimal.js les deux formes peuvent différer au 20ᵉ chiffre significatif, soit ~10⁻¹² FCFA sur des montants à 9 chiffres — **très en deçà de la tolérance ≤ 1 FCFA** sur les 19 vagues.

### Le point décisif : les contournements de recette à faire disparaître

**Il y en a TROIS, pas un** :

1. `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/orchestration.ts:131-174` — `buildCoutAlimentsParVague`, JSDoc + `seuilSacs: new Decimal(p.seuilTonnes).times(sacsParTonneStandard)` (ligne 159). Cible : passer `seuilTonnes` **directement** et le tonnage de la vague, bloc de JSDoc « Adaptation d'unité nécessaire » supprimé.
2. `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/orchestration.ts:327-390` — `buildCoutAlimentsParVagueEtMois`, **même mise à l'échelle**, ligne 358 : `seuilSacs: new Decimal(p.seuilTonnes).times(sacsParTonneStandard)`. **Non mentionné dans l'énoncé du sprint** — c'est le contournement jumeau, il doit disparaître dans le même geste, sinon le correctif est incomplet et la recette de `depenses.aliments[mois]` continue de masquer le défaut.
3. `/Users/ronald/project/dkfarm/farm-flow/src/lib/previsions/__tests__/recette/route-orchestration-builder.ts:24-51` — **le plus grave** : le builder de la recette d'**orchestration** met `paliersRemise: []`, c'est-à-dire qu'il **désactive entièrement la remise** pour pouvoir comparer `calculerProjectionScenario` au jeu d'or. Sa JSDoc l'assume : « reproduire EXACTEMENT `planVagues[].coutAlimentsFCFA` du jeu d'or via `calculerProjectionScenario` n'est PAS possible sans fabriquer artificiellement un jeu de seuils par granulométrie que le modèle de production ne supporte pas ». **Après le correctif, ce n'est plus vrai** : la recette d'orchestration doit pouvoir passer les 4 vrais paliers et comparer les coûts aliment remisés. C'est le vrai critère de fin du sprint — sans lui, on aura corrigé le modèle sans jamais prouver que le chemin applicatif (`route-orchestration.ts`) reproduit le classeur avec remise.

### Couverture des paliers par le jeu d'or

Seuils réels (fixtures, `Paramètres!B16:C19`) : **0 t → 0 % (ordre 1) · 5 t → 2 % (ordre 2) · 10 t → 4 % (ordre 3) · 15 t → 6 % (ordre 4)**.
Tonnages des 19 vagues : 4, 4, 8, 8, 10, 12, 15 ×13.

| Palier | Atteint ? | Par |
|---|---|---|
| 0 t / 0 % | **OUI** | V1, V2 (4 t, sous le seuil de 5 t) |
| 5 t / 2 % | **OUI** | V3, V4 (8 t) |
| 10 t / 4 % | **OUI** | V5 (10 t, **seuil exact**), V6 (12 t) |
| 15 t / 6 % | **OUI** | V7-V19 (15 t, **seuil exact**) |

**Les 4 paliers sont couverts** — le jeu d'or est plus riche que craint. Deux bonus : `remisePct` par vague est présent dans la fixture (`planVagues[].remisePct` = 0/0,02/0,04/0,06), ce qui permet une recette **directe du pourcentage retenu**, pas seulement du montant ; et la sémantique `≥` (seuil atteint exactement → palier applicable) est **réellement exercée** par V5 (10 t) et V7-V19 (15 t).

**Cas limites NON couverts par le jeu d'or → tests synthétiques obligatoires pour le @tester :**
- tonnage **strictement sous le plus petit seuil** (jamais atteint : le plus petit seuil est 0, tout tonnage lui est ≥) → aucun palier applicable, remise 0 % ;
- **liste de paliers vide** (cas réel aujourd'hui : la table est vide en base !) → 0 %, coût brut ;
- **paliers non ordonnés** en entrée (re-tri interne par `ordre`) ;
- **`ordre` incohérent avec les seuils** — protégé à l'écriture par `validerPaliersRemiseCroissants` (`validation.ts:62-74`), mais le moteur pur ne le revalide pas : le test doit documenter cette frontière, pas la déplacer ;
- **tonnage nul** (effectif 0 ou poidsObjectif 0) → 0 t ≥ seuil 0 → palier 0 % ; à figer explicitement ;
- **tonnage négatif** : impossible par construction (`effectifAlevinsPrevu Int` ≥ 0 et `poidsObjectifG` ≥ 0), mais le moteur pur ne l'interdit pas — test de non-régression à valeur documentaire.

### RÉSERVE sur la story 3 — un arbitrage non tranché

`src/lib/previsions/__tests__/aliments.test.ts:373-390` teste explicitement : « **COALESCE(sacsSaisisCycle, sacsCalculesCycle) : la surcharge manuelle prime pour la décision de remise du cycle** » — aujourd'hui, une surcharge manuelle `sacsSaisis` qui franchit un seuil **change le palier de remise**. Après correctif, la remise ne dépend plus que du tonnage : **une surcharge de sacs n'influence plus le palier**. C'est cohérent avec la cible (§4.3 : la remise se décide sur le tonnage visé), mais **contredit littéralement** ADR-053 §3.6 (« `COALESCE(sacsSaisis, sacsCalcules)` obligatoire dans TOUS les calculs downstream, sans exception »). Ce changement de sémantique doit être **écrit dans l'ADR §13**, pas subi. Il implique la réécriture de ce test et la mise à jour de la JSDoc de `route-orchestration.ts:90-125`. La réserve se lève dès que §13 tranche ce point.

---

## D. Story 4 — UI

### Champ « seuil »
`/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/parametres-tab.tsx:262-266`
```tsx
<Input
  label={t("parametresTab.paliers.seuilLabel")}   // ← "Seuil (sacs)"
  type="number" min={0}
  value={String(p.seuilSacs)}
  onChange={(e) => updatePalier(i, "seuilSacs", e.target.value)}
/>
```
Autres points du même fichier : `:153` (valeur par défaut d'un nouveau palier), `:166` (payload PUT). Et `/Users/ronald/project/dkfarm/farm-flow/src/components/pages/previsions-scenario-detail-page.tsx:238` (sérialisation Decimal → number).

### Clés i18n concernées

`/Users/ronald/project/dkfarm/farm-flow/src/messages/fr/previsions.json` et `/Users/ronald/project/dkfarm/farm-flow/src/messages/en/previsions.json`, bloc `parametresTab.paliers` (lignes 175-185 dans les deux fichiers) :

| Clé | FR actuel | EN actuel | Action |
|---|---|---|---|
| `parametresTab.paliers.seuilLabel` | « Seuil (sacs) » | "Threshold (bags)" | **À changer** → « Seuil (tonnes) » / "Threshold (tonnes)" |
| `parametresTab.paliers.description` | « Remise appliquée au **volume d'aliment acheté**. Les seuils doivent être strictement croissants (vérifié à l'enregistrement). » | idem EN | **À réécrire** — « volume d'aliment acheté » est précisément la formulation fausse ; doit devenir « remise décidée une fois par vague, d'après son tonnage visé, et appliquée à tout son coût d'aliment ». |
| `parametresTab.paliers.title`, `.palierLabel`, `.removeAria`, `.remiseLabel`, `.ordreLabel`, `.addButton`, `.saveButton` | — | — | **inchangées** |

**Aucune clé ne devient morte** : `seuilLabel` change de valeur, pas de nom. Si la story ajoute une aide contextuelle, prévoir **une nouvelle clé** (ex. `parametresTab.paliers.seuilHelp`) **dans les deux langues simultanément**.

### §7.4 des exigences — aide contextuelle
Le document d'exigences fonctionnelles du module Prévisions **n'est pas dans le dépôt** (`docs/requirements/` ne contient que `REQ-STARTER-PACKS*.md`, sans rapport). Ce que le dépôt permet de citer :
- ADR-053 §7.4 est référencé par ERR-157 et ERR-158 comme la section des **garanties de présentation** du module (tableau mensuel, mobile-first, « le grand tableau peut rester réservé au bureau »).
- **ERR-158 est la leçon directement applicable** : une clause « peut » du §7.4 est une **option par défaut révisable**, pas une prescription ; et **ERR-157** : *un test jsdom ne prouve aucune garantie de mise en page*. Toute aide contextuelle ajoutée via un `Popover` doit être vérifiée en **Chromium réel** (collision de popover contre le bord du viewport = l'une des 4 garanties explicitement hors de portée de jsdom), jamais déclarée « testée » sur la seule base d'un test de rendu jsdom.
- Le texte exact du §7.4 des exigences pour l'aide contextuelle **n'a pas pu être vérifié** — voir §Non vérifié.

### Tests i18n
`src/__tests__/i18n/messages.test.ts` et `src/__tests__/integration/i18n-completeness.test.ts` ne référencent **aucune** clé `paliers*` en dur (grep : 0 occurrence). Ce sont des tests de **parité structurelle** fr/en. Ils ne casseront **que** si une clé est ajoutée dans une seule langue. Le test `src/components/previsions/__tests__/parametres-tab.test.tsx` ne monte le composant qu'avec `paliersRemise: []` (ligne 74) — il ne rend jamais le champ seuil, donc il ne cassera pas, ce qui est aussi le signe d'un **trou de couverture UI** sur les paliers, à signaler au @tester.

---

## E. État réel vérifié

### `npx vitest run`
```
 Test Files  282 passed | 5 skipped (287)
      Tests  8753 passed | 21 skipped | 26 todo (8800)
   Duration  16.66s
```
**Conforme à la base attendue (287 fichiers / 8753 tests / 0 échec). Aucun écart.** Les 5 fichiers skippés sont les tests DB-gated connus.

### `npm run build`
`EXIT=0` — `✓ Compiled successfully in 13.3s`, toutes les routes générées.

### Base de dev (lecture seule stricte, `DATABASE_URL` lu depuis `.env` non tracké — R11 respectée, aucun identifiant écrit nulle part)

```
 id                        | nom                         | statut
 cmsdnypml0000n4ekuadykn0f | Plan de reference Excel v12 | BROUILLON

 nom                         | nb_vagues | somme_alevins
 Plan de reference Excel v12 |        19 |        602500     ← attendu 19 / 602 500 ✓

 nom                         | nb_apports
 Plan de reference Excel v12 |          3                    ← attendu 3 ✓

 scenario | ordre | seuilSacs | pourcentageRemise | id
 (0 rows)                                                    ← ★ TABLE VIDE
 SELECT count(*) FROM "PalierRemise"  →  0                   ← 0 ligne, TOUS scénarios

 tailleGranule | sacsParTonneStandard
 G1            |  8
 G2            | 18
 G3            | 50

 poidsObjectifG = 400 | dureeCycleMois = 3 | margeSecuriteAlevinsPct = 10
 19 VaguePrevue, tonnages calculés (effectif × 400 / 1e6) : 4,4,8,8,10,12,15×13  ← identiques à la fixture
 AlimentParVaguePrevue avec sacsSaisis non nul : 0
```

### `docs/sprints/`
Fichiers présents : `SPRINT-PR2-PREVISIONS.md`, `-bis-`, `-ter-`, `-quater-`, `-quinquies-`, `-sexies-`. **Aucun `SPRINT-PR2-septies-*` n'existe** ; aucune story `PR2sept.*` n'y figure. (Rapport seul — l'écriture relève du @status-updater.)

---

## Incohérences et pièges détectés

1. **ADR-053 §13 n'existe pas encore.** Deux renvois pointent vers elle (`:253-257` sur §3.4, `:788-794` sur §7) mais **aucune section 13 n'est écrite** (dernier titre : `### 12.6`, ligne 1524 ; le diff non commité ajoute 670 lignes de renvois/amendements). Le @developer ne doit pas commencer la story 3 sans §13, car l'arbitrage `sacsSaisis` (§C, réserve) y est à trancher.
2. **Le troisième contournement (`route-orchestration-builder.ts`, `paliersRemise: []`) n'est pas mentionné dans l'énoncé du sprint.** C'est pourtant le plus significatif : la recette de la couche d'orchestration — celle qui a produit les 3 bugs Haute de PR2 (ERR-142) — **n'exerce aujourd'hui aucune remise**. Le critère de fin doit l'inclure.
3. **Le second contournement (`orchestration.ts:358`, `buildCoutAlimentsParVagueEtMois`) est jumeau du premier** et non cité non plus.
4. **`RemiseAppliqueeResult.sacs`** devient un champ sans signification (la fonction ne verra plus de sacs). Le laisser serait une homonymie de plus dans un module qui en a déjà deux documentées (`sacsCalcules`, `sacsCalculesCycle`).
5. **Piège ERR-140, troisième récidive potentielle** : `prisma migrate diff` générera `DROP COLUMN "seuilSacs"` + `ADD COLUMN "seuilTonnes"`. Table vide → aucune perte réelle cette fois, mais **le réflexe de relecture doit être appliqué avant de le vérifier, pas après** (leçon explicite de ERR-140).
6. **Trou de couverture UI** : `parametres-tab.test.tsx` ne rend jamais un palier (`paliersRemise: []`). Le champ seuil, son libellé et son binding ne sont couverts par **aucun** test.
7. **`validerPaliersRemiseCroissants`** (`validation.ts:66-68`) porte `seuilSacs` dans son **message d'erreur utilisateur** — à renommer aussi, sinon l'utilisateur lira « seuilSacs » dans une UI en tonnes.
8. **Le zod `nonNegativeNumber`** (`previsions.schema.ts:96`) reste correct pour un tonnage, mais l'ordre de grandeur change radicalement (des sacs à 3 chiffres → des tonnes à 1-2 chiffres). Aucune borne haute n'existe ; à considérer, pas bloquant.

## Risques

| Risque | Impact | Mitigation |
|---|---|---|
| §13 de l'ADR écrite après le code | Le code fixe un arbitrage que l'ADR contredit ensuite | Bloquer le démarrage de la story 3 sur la présence de §13 |
| `sacsSaisis` ne pilote plus la remise | Régression fonctionnelle silencieuse pour un utilisateur qui surcharge ses sacs | Arbitrage explicite en §13 + réécriture du test `aliments.test.ts:373` avec commentaire de justification |
| Un seul des 3 contournements retiré | ERR-143 semble corrigée alors que la recette continue de la masquer (exactement le mécanisme d'origine de ERR-143) | Critère de fin : `grep -rn "sacsParTonneStandard" src/lib/previsions/__tests__/recette/` ne doit plus rien retourner en contexte de palier, et `paliersRemise: []` doit disparaître du builder |
| Remise activée dans la recette d'orchestration → écarts inattendus | Le sprint peut révéler d'autres divergences dormantes de `route-orchestration.ts` | C'est le but ; prévoir du temps de diagnostic, ne pas re-neutraliser la remise pour faire passer la recette |
| Migration appliquée en prod sur une base où des paliers auraient été saisis | Seuils en sacs réinterprétés comme des tonnes → remises absurdes (facteur 8 à 50) | Le garde-fou `RAISE EXCEPTION` conditionnel de §B, **dans** la migration |

## Prérequis manquants
1. **ADR-053 §13 rédigée** (@architect, en cours), incluant l'arbitrage `sacsSaisis` ↔ décision de remise.
2. Rien d'autre : build vert, tests verts, base cohérente, aucune donnée à migrer.

## Recommandation
**GO** sur les trois stories, dans l'ordre 2 → 3 → 4, avec une seule condition bloquante : la section 13 de l'ADR-053 doit exister et trancher le sort de `sacsSaisis` avant que la story 3 ne commence. Le critère de fin du sprint est la disparition des **trois** contournements de recette, pas seulement de celui cité dans l'énoncé.
