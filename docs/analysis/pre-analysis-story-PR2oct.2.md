# Pré-analyse — Story PR2oct.2 (SCHEMA) — Sprint PR2-octies

## Statut : GO AVEC RÉSERVES

## Résumé
Le drapeau `alevinsAchetes` est bien absent du schéma (confirmé par grep exhaustif, aucune
occurrence dans `prisma/schema.prisma`, `src/lib/previsions/**`, `src/types/models.ts`). La
correction est additive et bornée : un booléen sur `VaguePrevue`, un défaut sur
`ParametresPrevision`, une migration à `DEFAULT false` qui backfille silencieusement les 19 lignes
existantes d'`EXCEL-V12` avec la valeur exacte du jeu d'or. Réserve majeure trouvée en cours
d'analyse (non demandée explicitement mais bloquante pour la story MOTEUR qui suivra) : la recette
existante ne peut structurellement pas détecter ce bug — voir §7.

## 1. Nom et emplacement du drapeau — TRANCHÉ, proposition validée

**`VaguePrevue.alevinsAchetes Boolean @default(false)`** (`prisma/schema.prisma:4567-4600`) +
**`ParametresPrevision.alevinsAchetesParDefaut Boolean @default(false)`**
(`prisma/schema.prisma:4392-4429`).

Justification par cohérence avec les conventions déjà en place dans ces deux modèles :
- `VaguePrevue.effectifAlevinsPrevu` (ligne 4573) est déjà un champ **copié depuis
  `ParametresPrevision.effectifAlevinsParVague`** à la création, puis éditable par vague
  (`previsions-vagues.ts:79`, `UpdateVaguePrevueDTO.effectifAlevinsPrevu?`). `alevinsAchetes` suit
  exactement ce même patron : une décision par nature **par vague** (le §4.3 des exigences le dit
  explicitement — « alevins_achetes » est indexé sur la vague, pas sur le scénario), avec un défaut
  scénario pour éviter à l'utilisateur de resaisir 19 fois la même réponse.
- Nom du champ de défaut : `alevinsAchetesParDefaut` (pas de suffixe `ParDefaut` déjà en usage
  ailleurs dans le schéma — `grep -n "ParDefaut" prisma/schema.prisma` ne renvoie rien — mais c'est
  la formulation la moins ambiguë : `alevinsAchetes` seul sur `ParametresPrevision` laisserait
  croire à tort à un champ appliqué directement au calcul, alors qu'il n'est qu'une valeur
  d'amorçage copiée à la création, jamais lue par le moteur).
- Type Prisma `Boolean`, cohérent avec les deux seuls autres booléens du module
  (`AlimentPrevision`... en réalité aucun booléen existant côté module Prévisions avant ce champ à
  part `PostePrevision.inclusBaseRepartition Boolean @default(true)`, `prisma/schema.prisma:417`
  dans l'ADR / ligne équivalente en base — même famille : un booléen métier avec défaut explicite,
  jamais nullable).
- Nullabilité (R7) : **NOT NULL sur les deux champs, avec `@default(false)`** — jamais de `Boolean?`.
  Un `null` laisserait une troisième branche implicite (« on ne sait pas ») que ni le moteur ni
  l'UI n'ont de raison de gérer ; le §4.3 des exigences n'énonce que deux états.

## 2. Valeur par défaut à la création d'une vague et à la génération d'un plan

**`false` (= production interne, coût 0) dans les deux cas — pas un choix arbitraire, il découle
directement du jeu d'or :**
- `prisma/fixtures/previsions/plan-v12-corrige.json`, `entreesModele.planVagues[*].alevinsAchetes`
  vaut `"NON"` sur les **19** vagues, sans exception.
- Le champ scénario par défaut (`ParametresPrevision.alevinsAchetesParDefaut`) suit le même défaut
  `false`, cohérent avec le `DEFAULT` de colonne — un scénario nouvellement créé sans saisie
  explicite reproduit le comportement du seul jeu d'or connu du dépôt.
- Chemin de création (`src/lib/queries/previsions-vagues.ts:165` `createVaguePrevue`) et chemin de
  génération automatique (`previsions-vagues.ts:635` `genererPlanVaguesPrevues`, et
  `genererTheorique`/`genererPlanEmpoissonnement` côté moteur pur) doivent tous deux copier
  `parametres.alevinsAchetesParDefaut` vers `VaguePrevue.alevinsAchetes` à la création — même
  patron exact que `effectifAlevinsParVague` → `effectifAlevinsPrevu` déjà en place lignes 186 et
  675 du même fichier. `scinderVaguePrevue` (ligne 249) doit copier la valeur du **parent**, pas le
  défaut scénario — même règle que `dureeCycleMoisFigee` (ligne 280 : "copiée depuis le PARENT,
  jamais depuis une source plus fraîche").

## 3. Sort de `prixAlevinUnitaireFCFA`

**Confirmé : rien dans le code actuel n'efface ce champ.** `ParametresPrevision.prixAlevinUnitaireFCFA`
(`prisma/schema.prisma:4401`) reste un `Decimal` `NOT NULL` sans lien avec un futur `alevinsAchetes`
— aucune écriture conditionnelle ne le touche nulle part dans `src/lib/queries/previsions-*.ts` ni
dans les routes API grep-ées. Le prix continue d'être saisi, stocké et affiché ; seule son
**application au calcul** doit devenir conditionnelle.

**⚠️ Constat fait pendant la Tâche 1, à traiter par la story SCHEMA elle-même (backfill), pas
seulement documenté :** en base, sur `EXCEL-V12`, `prixAlevinUnitaireFCFA` vaut actuellement **0**
(voir snapshot), alors que le jeu d'or (`entreesModele.parametresScenario.prixAlevinUnitaireFCFA`)
vaut **70**. C'est le contournement décrit dans le briefing, déjà appliqué en base — l'information
réelle est déjà perdue sur ce scénario précis. La migration de backfill (§4) doit donc **restaurer
70** sur `EXCEL-V12` en même temps qu'elle pose `alevinsAchetes = false` sur ses 19 vagues, sinon la
correction du drapeau ne change rien au résultat visible (0 × alevins = 0 achetés = 0, tout comme
70 × 0 vague achetée = 0 — mais la première formulation continue de mentir sur le prix réel, ce que
la story doit corriger explicitement).

**Endroits à ajuster (liste, story MOTEUR, pas SCHEMA) :**
- `src/lib/previsions/route-orchestration.ts:571-574` — gater `coutAlevinsFCFA` (achat) sur
  `vague.alevinsAchetes`, jamais sur `logistique.transportAlevins` (§6, distinct).
- `src/lib/queries/previsions-scenario-loader.ts:140-152` (`VaguePrevuePourCalcul`) et sa
  construction lignes 323-333 — propager `v.alevinsAchetes` depuis Prisma vers le moteur pur.

## 4. Migration des vagues existantes (R10)

**Défaut de colonne `DEFAULT false`, sans `UPDATE` explicite pour le drapeau** — exactement le
patron déjà utilisé dans `prisma/migrations/20260803170000_add_taux_epargne_pct/migration.sql`
(« Le DEFAULT 30 backfille implicitement toutes les lignes existantes, y compris le scénario
EXCEL-V12, sans UPDATE explicite »). Ici `DEFAULT false` produit exactement `alevinsAchetes = NON`
sur les 19 lignes d'`EXCEL-V12` — la valeur que le jeu d’or exige, sans avoir besoin d'un `UPDATE`
conditionné sur le code de scénario. C'est un cas plus simple que `seuilTonnes` (migration
`20260804100000_...`, qui a dû bloquer sur une conversion non déterministe) : ici il n'y a **aucune
conversion**, juste une valeur booléenne homogène sur tout le dépôt (aucun autre scénario connu
n'existe avec des vagues déjà achetées).

**Distinct : le prix (`prixAlevinUnitaireFCFA = 0` constaté en base, §3) exige un `UPDATE` explicite
et ciblé**, scopé au scénario `EXCEL-V12` par son `code` (jamais un `UPDATE` global sur toute la
table `ParametresPrevision` — un autre site pourrait légitimement avoir un prix à 0 pour une raison
qui lui est propre). Ce correctif doit être **idempotent** : ne réécrire 70 que si la valeur
actuelle est 0 ET que le scénario a le code `EXCEL-V12`, jamais écraser une valeur déjà saisie
différemment par un utilisateur. No-op silencieux si le scénario `EXCEL-V12` est absent de
l'environnement cible (dev d'un autre agent, CI, prod) — patron déjà en vigueur pour les migrations
`202607270900xx_data_fix_*`.

Nom de migration proposé, suivant la convention des noms déjà présents dans
`prisma/migrations/` : `20260805XXXXXX_add_vague_prevue_alevins_achetes`.

## 5. R8 siteId

- `VaguePrevue` porte déjà `siteId String` + FK `site` (`prisma/schema.prisma:4587-4588`, confirmé
  par lecture directe). Le nouveau champ `alevinsAchetes` n'ajoute **aucun** besoin de `siteId`
  supplémentaire — il vit sur une ligne déjà scopée au site.
- `ParametresPrevision` **ne porte pas** de `siteId` propre (`prisma/schema.prisma:4392-4395`) —
  c'est l'état existant, non introduit par cette story : la table est en relation 1-1 stricte avec
  `ScenarioPrevision` (`scenarioId String @unique`), qui lui porte le `siteId`. Ce n'est pas une
  violation de R8 (le modèle 1-1 hérite du scope de son parent unique, même patron que
  `PalierRemise` qui, lui, porte `siteId` en plus — incohérence déjà existante mais **hors périmètre** de
  cette story, à ne pas corriger au passage). Le nouveau champ `alevinsAchetesParDefaut` n'aggrave
  ni ne corrige cet état.

## 6. La logistique alevins dépend-elle du drapeau ? — NON, vérifié contre fixtures et code

**Vérifié, pas supposé.** Deux notions distinctes portent le même mot « alevins » dans deux fichiers
différents du moteur :
1. `src/lib/previsions/logistique.ts:107-109` `LogistiqueMensuelleResult.coutAlevinsFCFA` = coût de
   **transport** (`voyages × coûtUnitaireFCFA`), alimente `base_repartition`.
2. `src/lib/previsions/route-orchestration.ts:571` variable locale `coutAlevinsFCFA` = coût
   d'**achat** (`alevinsACommanderNb × prixAlevinUnitaireFCFA`) — celui visé par le §5.3 des
   exigences et par cette story.

Valeurs numériques constatées dans `prisma/fixtures/previsions/plan-v12-corrige.json` (scénario
où les 19 vagues portent `alevinsAchetes: "NON"`) :
```
logistique.voyagesAlevins   = [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0]
logistique.transportAlevins = [30000, 30000, 60000, 60000, 60000, 60000, 90000, 90000, 90000, 90000,
                                90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000, 90000, 0, 0]
```
Non nuls sur 19 des 21 mois, alors que `depenses.alevins` (coût d'achat) vaut **0 sur les 21 mois**
dans le même fichier. **Conclusion : le transport des alevins reste dû qu'ils soient achetés ou
produits en interne** (un alevin produit en écloserie interne doit quand même être physiquement
déplacé du bassin d'écloserie au bac de grossissement) — `logistique.ts` ne doit **jamais** être
gaté par `alevinsAchetes`. Seul `route-orchestration.ts:571` (l'achat) doit l'être.

## 7. Impact sur la recette — RÉSERVE MAJEURE, à traiter par la story MOTEUR

Fichiers concernés dans `src/lib/previsions/__tests__/recette/` :
- `orchestration.ts` (helper `buildChaineFinanciereCalendrier`, ligne ~561) — lit directement
  `vague.coutAlevinsFCFA` **depuis la fixture** (`entreesModele.planVagues[].coutAlevinsFCFA`,
  toujours 0 dans le jeu d'or), **sans jamais appeler la formule réelle du moteur**
  (`route-orchestration.ts`). Ce helper est structurellement aveugle au bug : il ne peut pas le
  détecter aujourd'hui ni après le fix, quel que soit l'état du drapeau, puisqu'il ne recalcule
  jamais le coût — il recopie la valeur attendue.
- `route-orchestration.recette.test.ts` — **appelle bien** `calculerProjectionScenario` (le vrai
  code de production), mais sa Section C documente explicitement (JSDoc lignes 161-165) qu'elle
  n'a **aucune assertion directe** sur `resultatFCFA`/`epargneFCFA`/`depensesFCFA` contre les
  valeurs du jeu d'or — seulement des identités algébriques internes
  (`resultatFCFA == revenusFCFA + apportsFCFA - depensesFCFA`, `soldeFCFA[m] - soldeFCFA[m-1] ==
  resultatFCFA[m]`), qui restent vraies **quelle que soit la valeur de `coutAlevinsFCFA`** — un
  bug dans ce terme se propage de façon cohérente dans toute la chaîne sans jamais casser une
  identité purement relative. Seul `alevinsACommanderNb` (un compte, pas un prix) est comparé au
  jeu d'or (ligne 306-312) — insensible au prix par construction.

**Preuve exécutée pendant cette pré-analyse** (`npx vitest run
src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts`) : **480/480 tests passent
aujourd'hui**, alors que le moteur de production calcule actuellement un coût d'achat d'alevins non
nul sur chaque mois de stockage (`prixAlevinUnitaireFCFA = 70` dans le builder de recette,
`route-orchestration-builder.ts:162`, lu directement depuis
`entreesModele.parametresScenario.prixAlevinUnitaireFCFA`) — un écart d'environ 42 175 000 FCFA
(602 500 alevins à commander marge comprise × 70 FCFA) totalement invisible à la recette actuelle.
**C'est la même famille de piège qu'ERR-160** (« un jeu d'or peut être structurellement incapable
de discriminer deux formules candidates ») : ici ce n'est pas l'absence de cas discriminant dans le
jeu d'or, c'est l'absence d'une assertion qui exploite la donnée pourtant présente
(`fixture.depenses.alevins`, disponible et à 0 sur toute la série, jamais comparée à la sortie
réelle du moteur).

**Conséquence pour la story MOTEUR (pas SCHEMA) :** en plus de gater `coutAlevinsFCFA` sur
`alevinsAchetes`, il faut **ajouter une assertion de recette absente aujourd'hui** — comparer
`moisCourant.coutAlevinsFCFA` (sortie réelle de `calculerProjectionScenario`) à
`fixture.depenses.alevins[m]` pour chaque mois, dans `route-orchestration.recette.test.ts`. Sans
cet ajout, la story MOTEUR pourrait introduire une régression (par exemple oublier un cas comme la
scission de vague) sans qu'aucun test ne le révèle — la base de 2378 assertions ne protège pas ce
terme aujourd'hui, elle doit être étendue, pas seulement rejouée.

## 8. Fichiers à modifier, par story

**Story SCHEMA (cette pré-analyse) :**
- `prisma/schema.prisma` — ajout `VaguePrevue.alevinsAchetes Boolean @default(false)` et
  `ParametresPrevision.alevinsAchetesParDefaut Boolean @default(false)`.
- `prisma/migrations/20260805XXXXXX_add_vague_prevue_alevins_achetes/migration.sql` — `ADD COLUMN
  ... DEFAULT false` sur les deux colonnes (backfill implicite des 19 vagues d'`EXCEL-V12` à
  `false`, conforme au jeu d'or) + `UPDATE` idempotent et ciblé (`code = 'EXCEL-V12'` ET valeur
  actuelle `= 0`) restaurant `prixAlevinUnitaireFCFA = 70` sur ce seul scénario.
- `src/types/models.ts` — `VaguePrevue.alevinsAchetes: boolean` (ligne ~4419-4444) et
  `ParametresPrevision.alevinsAchetesParDefaut: boolean` (ligne ~4232-4273).
- `src/lib/queries/previsions-vagues.ts` — `CreateVaguePrevueDTO`/`UpdateVaguePrevueDTO`/
  `ScissionVaguePrevueDTO` (ajout du champ), `createVaguePrevue` (copie depuis
  `parametres.alevinsAchetesParDefaut` si non fourni explicitement — même patron que
  `effectifAlevinsPrevu`), `updateVaguePrevue` (champ éditable), `scinderVaguePrevue` (copie depuis
  le **parent**, jamais depuis le scénario), `genererPlanVaguesPrevues`/`genererTheorique`
  (copie du défaut scénario pour les vagues auto-générées), `chargerPourGenerationPlan` (charger
  `alevinsAchetesParDefaut` en plus des champs déjà sélectionnés).
- `src/lib/previsions/plan.ts` / `genererPlanEmpoissonnement` (moteur pur, `ADR-053` §4) — si cette
  fonction produit déjà la forme `VaguePrevue` théorique consommée par `genererTheorique`, vérifier
  si `alevinsAchetes` doit y transiter ou être appliqué uniquement côté query (probable : le moteur
  pur ne connaît pas `ParametresPrevision.alevinsAchetesParDefaut`, donc c'est la couche query qui
  doit fusionner cette valeur après génération théorique — à trancher précisément par
  l'implémenteur, pas figé ici).
- `docs/knowledge/ERRORS-AND-FIXES.md` — nouvelle entrée signalant le constat §7 (recette
  structurellement aveugle au coût d'achat alevins) à l'attention du @knowledge-keeper.

**Story MOTEUR (hors périmètre SCHEMA, listée pour information) :**
- `src/lib/previsions/route-orchestration.ts:567-591` — gater `coutAlevinsFCFA` sur
  `vague.alevinsAchetes`.
- `src/lib/queries/previsions-scenario-loader.ts:140-152,323-333` — propager `alevinsAchetes` du
  Prisma vers `VaguePrevuePourCalcul`.
- `src/lib/previsions/__tests__/recette/route-orchestration-builder.ts:197-209` — mapper
  `v.alevinsAchetes === "OUI"` (fixture) vers `VaguePrevuePourCalcul.alevinsAchetes`.
- `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts` — nouvelle section
  d'assertions `coutAlevinsFCFA` vs `fixture.depenses.alevins[m]` (§7, gap comblé).
- `src/lib/previsions/__tests__/recette/orchestration.ts` — laisser `buildChaineFinanciereCalendrier`
  tel quel (lit la fixture, reste correct puisque la fixture porte déjà `alevinsAchetes: NON`) mais
  documenter dans son JSDoc qu'il ne recalcule pas le coût — pour éviter qu'un futur agent le
  prenne à tort comme une preuve du fix.

**Story UI (hors périmètre SCHEMA, listée pour information) :**
- `src/components/previsions/vague-prevue-form-dialog.tsx` — case à cocher/switch
  `alevinsAchetes`, avec le prix appliqué affiché conditionnellement.
- `src/components/previsions/generer-plan-dialog.tsx` — si le formulaire de génération expose des
  paramètres scénario, vérifier s'il faut y exposer `alevinsAchetesParDefaut`.
- `src/components/previsions/scission-dialog.tsx` — champ visible/pré-rempli depuis le parent (copie,
  non éditable au moment de la scission ou éditable, à trancher par l'implémenteur UI — cohérent
  avec le fait que `scinderVaguePrevue` copie déjà `dureeCycleMoisFigee` sans le rendre éditable
  dans le payload de scission actuel : `ScissionVaguePrevueDTO` n'a pas ce champ).
- `src/components/previsions/plan-vagues-tab.tsx` / `tableau-bord-tab.tsx` — affichage du coût
  alevins par vague (déjà affiché si `coutAlevinsFCFA` déjà exposé côté API ; sinon vérifier).

## Verdict

**GO** pour la story SCHEMA, avec deux réserves à porter explicitement dans le brief de
l'implémenteur :
1. Le backfill du prix (`prixAlevinUnitaireFCFA` = 0 actuellement sur `EXCEL-V12`) fait partie du
   scope de la migration R10 de cette story — ce n'est pas seulement le drapeau qui doit être
   migré, sinon la story livre un schéma correct sur des données déjà corrompues par un
   contournement antérieur.
2. Le trou de recette documenté en §7 (aucune assertion sur le coût d'achat alevins face au vrai
   moteur) doit être communiqué explicitement à la story MOTEUR qui suivra — ce n'est pas un blocage
   pour SCHEMA (SCHEMA n'écrit aucun test de recette), mais un GO conditionné à ce que MOTEUR ne
   parte pas d'une recette verte comme preuve suffisante.
