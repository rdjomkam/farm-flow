# Pré-analyse Story PR2.2 — Routes API (module Prévisions) — 2026-08-03

## Statut : GO AVEC RÉSERVES

## Résumé
Le terrain livré par PR2.1 est solide : les 5 fichiers de queries existent, les trois validations
bloquantes du §8 sont déjà portées (deux entièrement câblées dans les queries, une structurellement
impossible à contourner par construction), le découplage Decimal a un utilitaire partagé
(`decimal-io.ts`) et non répété nulle part encore. Build vert, 6660 tests passés (0 échec), recette
du moteur reconfirmée à 842/842. Le point réellement bloquant n'est pas dans PR2.1 : c'est que
**la route de calcul doit combler un gap de modèle explicitement documenté par PR1.3 comme non
résolu** (`AlimentPrevisionCalcInput.besoinTotalCycleKg`) — la formule que le @developer choisira
n'aura **jamais été vérifiée contre le jeu d'or**, parce que la recette traite ce champ comme une
entrée littérale du classeur, pas comme une valeur dérivée. Ce n'est pas une raison de bloquer (le
moteur reste intouchable, la formule à écrire est une composition arithmétique simple en amont du
moteur, pas une modification du moteur), mais c'est un risque à documenter explicitement plutôt qu'à
deviner silencieusement.

## 1. Le patron réel d'une route API du dépôt

Lu intégralement : `src/app/api/vagues/route.ts`, `src/app/api/remises/route.ts`, et les handlers
`requirePermission`/`handleApiError`/`apiError` (`src/lib/permissions.ts`, `src/lib/api-utils.ts`).

**`requirePermission(request, ...permissions)`** (`src/lib/permissions.ts:100`) :
- Prend une liste variadique de `Permission`, exige **toutes** (ET logique, pas OU — pour du OU il
  existe `requireHasPermission`, non pertinent ici).
- Résout `requireAuth(request)` puis, si `session.role !== Role.ADMIN`, charge `getSiteMember`
  du site actif et vérifie `member.siteRole.permissions` ⊇ `required`. Lève `ForbiddenError` (403)
  sinon.
- Renvoie un `AuthContext` avec, entre autres, `activeSiteId: string` et `permissions: Permission[]`.
  **`auth.activeSiteId` est donc obtenu une seule fois, en tête de route**, puis threadé
  explicitement dans chaque appel de query (`getVagues(auth.activeSiteId, ...)`,
  `tx.vague.count({ where: { siteId: auth.activeSiteId, ... } })`). Il n'y a **aucun mécanisme
  implicite** de filtrage par site (pas de middleware Prisma, pas de RLS) — c'est entièrement
  discipliné par écriture explicite à chaque appel, exactement ce que PR2.2 doit reproduire.
- Le rôle global `ADMIN` bypass la vérification de permission de site (`permissions:
  Object.values(Permission)`), mais garde un `activeSiteId` (celui de la session, ou `""`).

**Mapping erreur → HTTP** (`src/lib/api-utils.ts`, `handleApiError`) — centralisé, pas ad hoc par
route :
1. `AuthError` → 401 (pas de log)
2. `ForbiddenError` → 403 (pas de log)
3. `ValidationError` (`src/lib/errors.ts`) → 400
4. Prisma `P2002` (contrainte unique) → 409, message générique `"Cette valeur existe déjà (champs)."`
   sauf cas spécial `numero`/`code` (message de réessai dédié)
5. `opts.statusMap` (mapping message→status **spécifique à la route**, passé en argument) — vérifié
   **avant** les patterns génériques suivants
6. Patterns de message génériques codés en dur : `"introuvable"`/`"n'existe pas"` → 404 ;
   `"Impossible"`, `"deja assigne"`, `"Transition invalide"`, `"statut doit etre"`, etc. → 409 ;
   `"n'appartient pas"`, `"Stock insuffisant"`, `"negative"`, etc. → 400
7. Sinon → `console.error` + 500

**Conséquence directe pour PR2.2, vérifiée par grep** : les erreurs levées par
`validerSommeRepartitionMoisAliment`/`validerPaliersRemiseCroissants` (`throw new Error("La somme
des pourcentages ... doit valoir 100 ...")`, `"Les paliers de remise doivent avoir des seuils
strictement croissants ..."`) sont de simples `Error`, **et leurs messages ne matchent aucun des
patterns codés en dur de `handleApiError`** (pas de "introuvable", pas de "Impossible", pas de
"n'appartient pas"...). Sans intervention explicite de la route, ces deux violations tomberaient
dans le cas 7 : **500 Erreur serveur, alors qu'il s'agit d'une erreur de saisie utilisateur (422 ou
400)**. Un précédent typé existe déjà et est directement transposable :
`ConservationError` (`src/lib/errors.ts`), attrapée explicitement dans `src/app/api/calibrages/route.ts`
et mappée à **422** avec un corps enrichi (`sourcesTotal`, `saisiTotal`, `ecart`...). **Recommandation
ferme pour PR2.2** : soit passer ces deux messages dans `opts.statusMap` de chaque route concernée
(`{ match: "doit valoir 100", status: 422 }`, `{ match: "seuils strictement croissants", status: 422 }`),
soit — mieux, plus robuste à un changement de libellé — faire lever par `validation.ts` un type
d'erreur dédié (`ValidationError` existant convient très bien, il est déjà mappé à 400 par
`handleApiError`) plutôt que `Error` nu. **Ce changement touche `src/lib/previsions/validation.ts`
(moteur) — à signaler comme nécessité prouvée, pas confort**, ou alternativement faire ce
`try/catch` + retype dans la couche query (PR2.1, hors périmètre de cette story) avant que PR2.2 ne
s'appuie dessus. Le choix (retype dans le moteur vs. retype dans la query vs. `statusMap` par route)
est à trancher explicitement par @developer, pas à découvrir en test.

**Validation de payload** : **pas de zod dans le chemin API historique** (`vagues/route.ts`,
`remises/route.ts`) — validation manuelle champ par champ, tableau `{field, message}[]`, `apiError(400,
"Erreurs de validation", { errors })`. Zod **existe** dans le dépôt (`"zod": "^4.3.6"` en
dépendance, `src/lib/validation/*.schema.ts`) mais seulement pour une poignée de domaines récents
(`releve.schema.ts`, `bon-livraison.ts`, `config-elevage.ts`, `ecart-assignation.schema.ts`,
`common.schema.ts`) — **les deux conventions coexistent**, aucune n'est actuellement dominante pour
un nouveau module. **Point à trancher par @developer, pas déjà tranché par le dépôt** : le module
Prévisions a un nombre de payloads bien plus élevé que la moyenne (7 groupes de modèles, dont
plusieurs remplacements en bloc de tableaux) — zod (schémas dans `src/lib/validation/previsions/*.schema.ts`,
suivant le patron déjà établi) réduirait sensiblement le code répétitif par rapport à la validation
manuelle de `vagues/route.ts`. Recommandation : zod, mais ce n'est pas un blocage si @developer choisit
la validation manuelle pour rester cohérent avec le patron le plus cité par CLAUDE.md
(`src/app/api/vagues/route.ts`).

## 2. Table de correspondance route → méthode → permission (proposition MVP)

| Route (proposée) | Méthode | Query(ies) PR2.1 | Permission |
|---|---|---|---|
| `/api/previsions/scenarios` | GET | `getScenarios` | `PREVISIONS_VOIR` |
| `/api/previsions/scenarios` | POST | `createScenario` | **AMBIGU** — voir ci-dessous |
| `/api/previsions/scenarios/[id]` | GET | `getScenarioById` | `PREVISIONS_VOIR` |
| `/api/previsions/scenarios/[id]/parametres` | PUT/PATCH | `updateParametresPrevision` | `PREVISIONS_PARAMETRER` (explicite ADR) |
| `/api/previsions/scenarios/[id]/paliers-remise` | PUT | `replacePaliersRemise` | `PREVISIONS_PARAMETRER` (explicite ADR — paliers de remise cités) |
| `/api/previsions/scenarios/[id]/archiver` | POST | `archiverScenario` | **AMBIGU** — voir ci-dessous |
| `/api/previsions/scenarios/[id]/activer` | POST | `activerScenario` | **AMBIGU** — voir ci-dessous |
| `/api/previsions/scenarios/[id]/aliments` | GET | `getAlimentsPrevisionParScenario` | `PREVISIONS_VOIR` |
| `/api/previsions/aliments/[id]` | GET | `getAlimentPrevisionById` | `PREVISIONS_VOIR` |
| `/api/previsions/scenarios/[id]/aliments` | POST | `createAlimentPrevision` | `PREVISIONS_PARAMETRER` (référentiel aliments, explicite ADR) |
| `/api/previsions/aliments/[id]/repartitions` | PUT | `replaceRepartitionsMoisAliment` | `PREVISIONS_PARAMETRER` |
| `/api/previsions/aliments/[id]` | DELETE | `deleteAlimentPrevision` | `PREVISIONS_PARAMETRER` |
| `/api/previsions/scenarios/[id]/vagues` | GET | `getVaguesPrevuesParScenario` | `PREVISIONS_VOIR` |
| `/api/previsions/vagues-prevues/[id]` | GET | `getVaguePrevueById` | `PREVISIONS_VOIR` |
| `/api/previsions/scenarios/[id]/vagues` | POST | `createVaguePrevue` | `PREVISIONS_GERER` (explicite ADR) |
| `/api/previsions/vagues-prevues/[id]` | PUT | `updateVaguePrevue` | `PREVISIONS_GERER` |
| `/api/previsions/vagues-prevues/[id]` | **DELETE — n'existe pas, volontairement** | — | — (voir §3c) |
| `/api/previsions/vagues-prevues/[id]/annuler` | POST | `annulerVaguePrevue` | `PREVISIONS_GERER` |
| `/api/previsions/vagues-prevues/[id]/scinder` | POST | `scinderVaguePrevue` | `PREVISIONS_GERER` |
| `/api/previsions/vagues-prevues/[id]/rattacher` | POST | `rattacherVaguePrevue` | **AMBIGU** — voir ci-dessous |
| `/api/previsions/vagues-prevues/[id]/aliments` | PUT | `replaceAlimentsParVaguePrevue` | **AMBIGU** (interne au calcul, ou exposée ?) — voir §5 |
| `/api/previsions/aliments-par-vague-prevue/[id]/sacs-saisis` | PATCH | `updateSacsSaisis` | `PREVISIONS_GERER` (surcharge terrain, explicite ADR) |
| `/api/previsions/scenarios/[id]/postes` | GET | `getPostesPrevisionParScenario` | `PREVISIONS_VOIR` |
| `/api/previsions/scenarios/[id]/postes` | POST | `createPostePrevision` | `PREVISIONS_PARAMETRER` (référentiel postes, explicite ADR) |
| `/api/previsions/scenarios/[id]/charges` | GET | `getChargesMensuellesParScenario` | `PREVISIONS_VOIR` |
| `/api/previsions/postes/[id]/charges` | PUT/POST | `upsertChargeMensuelle` | `PREVISIONS_GERER` (charges mensuelles, explicite ADR) |
| `/api/previsions/scenarios/[id]/journal` | GET | `getJournalDepensesParScenario` | `PREVISIONS_VOIR` |
| `/api/previsions/journal/[id]` (+ collection) | POST/PUT/DELETE | `createJournalDepensePrevue`/`update`/`delete` | `PREVISIONS_GERER` |
| `/api/previsions/scenarios/[id]/apports` | GET | `getApportsCapitalParScenario` | `PREVISIONS_VOIR` |
| `/api/previsions/scenarios/[id]/apports` | POST | `createApportCapital` | `PREVISIONS_GERER` |
| `/api/previsions/scenarios/[id]/calculer` | GET ou POST | `chargerScenarioPourMoteur` + orchestration (nouvelle) | **AMBIGU** — voir §5 |

**Cas ambigus à trancher explicitement par @developer, pas silencieusement :**

- **`POST /scenarios` (créer un scénario) — GERER ou PARAMETRER ?** `createScenario` crée
  `ScenarioPrevision` **et** son `ParametresPrevision` 1-1 dans la même transaction (obligatoire dès
  la création, ADR section 3.3) — c'est indissociablement un acte de gestion (créer l'entité
  scénario) et un acte de paramétrage (fixer tous les paramètres de calcul dès l'instant zéro).
  Le tableau ADR §6 range "créer/éditer scénarios" sous `GERER`, mais range aussi "éditer
  `ParametresPrevision`" sous `PARAMETRER` — la création simultanée des deux ne correspond
  explicitement à aucune des deux lignes. **Recommandation** : `PREVISIONS_GERER` suffit pour créer
  (cohérent avec "créer/éditer scénarios" du tableau, qui est la ligne la plus proche de l'objet
  manipulé), à condition que les valeurs de `ParametresPrevision` fournies à la création restent
  modifiables ensuite uniquement via `PREVISIONS_PARAMETRER` (`updateParametresPrevision`) — ce qui
  est déjà la structure de PR2.1. Un Gestionnaire peut donc démarrer un scénario avec des paramètres
  par défaut, mais seul un Administrateur peut les ajuster ensuite. À documenter explicitement dans
  le rapport de clôture si retenu, car ce n'est pas ce qu'un lecteur pressé du tableau ADR §6
  déduirait spontanément.
- **`archiverScenario`/`activerScenario` — GERER ou PARAMETRER ?** Non listées explicitement dans le
  tableau ADR §6. Changer le statut d'un scénario (`BROUILLON`→`ACTIF`→`ARCHIVE`) n'édite ni un
  paramètre ni le référentiel — c'est un changement de cycle de vie de l'entité elle-même.
  **Recommandation** : `PREVISIONS_GERER`, par analogie avec "créer/éditer scénarios" (le
  changement de statut est une forme d'édition de l'entité `ScenarioPrevision`), pas
  `PREVISIONS_PARAMETRER`. À confirmer par @architect/@developer si un raisonnement différent
  prévaut (ex. faire correspondre `ACTIF` à un niveau de contrôle plus élevé, puisque l'ADR §4.3
  mentionne une « édition restreinte » pour un scénario `ACTIF` — mais cette restriction porte sur
  l'édition du contenu, pas sur qui peut faire la transition de statut elle-même).
- **`rattacherVaguePrevue` (rattacher une vague réelle à une `VaguePrevue`) — quelle(s)
  permission(s) ?** Cette opération écrit sur `Vague.vaguePrevueId`, un champ du domaine **réel**
  (`vagues.ts`), pas seulement sur une table `*Prevue`. `PREVISIONS_GERER` seul autoriserait un
  utilisateur qui n'a **aucune** permission sur les vagues réelles (`VAGUES_CREER`/`VAGUES_MODIFIER`,
  hors du groupe Prévisions) à modifier une `Vague` existante. **Recommandation, à trancher
  explicitement, pas par défaut** : exiger `PREVISIONS_GERER` **et** une permission vagues existante
  (`VAGUES_MODIFIER` ou équivalent) via deux appels `requirePermission` (ET logique déjà supporté
  nativement par la signature variadique), plutôt que de supposer que quiconque gère les prévisions
  peut aussi modifier n'importe quelle vague réelle du site.
- **La route de calcul — VOIR seule, ou VOIR+écriture (donc GERER) ?** Développé en détail au §5 —
  c'est l'ambiguïté la plus importante de cette pré-analyse, pas une case à cocher rapidement.

## 3. Les trois validations bloquantes du §8 — état réel

**a. Somme des pourcentages de répartition = 100 %.** **Entièrement portée par PR2.1**, dans la
même transaction que l'écriture (R4) : `previsions-aliments.ts` appelle
`validerSommeRepartitionMoisAliment(repartitionsInput)` **avant** le `deleteMany`/`createMany`, à
la fois dans `createAlimentPrevision` (ligne 87) et `replaceRepartitionsMoisAliment` (ligne 148).
**Reste à faire côté route (PR2.2)** : uniquement le mapping HTTP — aujourd'hui l'`Error` levée
tomberait en 500 (voir §1). La route doit garantir un **422** (cohérent avec `ConservationError`) ou
un **400**, jamais un 500 pour une violation de saisie utilisateur.

**b. Seuils de remise strictement croissants.** **Entièrement portée par PR2.1**, même patron :
`previsions-scenarios.ts` appelle `validerPaliersRemiseCroissants(paliersInput)` avant l'écriture
dans `replacePaliersRemise` (ligne 313). Même reste à faire côté route que (a) : mapping HTTP
explicite, pas un 500 par défaut.

**c. Suppression d'une `VaguePrevue` rattachée à une vague réelle — interdite, `ANNULEE` à la
place.** **Structurellement impossible à contourner dès PR2.1**, pas seulement documentée :
`previsions-vagues.ts` n'expose **aucune** fonction `deleteVaguePrevue` (le commentaire de tête de
fichier le dit explicitement : "Ce fichier n'expose DELIBEREMENT aucune fonction deleteVaguePrevue").
Seule `annulerVaguePrevue` existe, et elle vérifie elle-même (`prisma.vague.findFirst({ where:
{ vaguePrevueId: id } })`) qu'aucune vague réelle n'est rattachée avant de passer le statut à
`ANNULEE`, sinon `throw new Error("Impossible d'annuler ...")`. **Reste à faire côté route** : ne
**jamais exposer de route `DELETE /api/previsions/vagues-prevues/[id]`** (aucune fonction query ne le
permettrait de toute façon — un développeur qui voudrait l'ajouter devrait d'abord écrire la query
manquante, ce qui serait un signal d'alerte à lui seul) ; le message `"Impossible d'annuler ..."`
matche déjà le pattern générique 409 de `handleApiError` (`message.includes("Impossible")`) — **ce
cas-là n'a pas besoin de traitement supplémentaire**, contrairement à (a) et (b).

## 4. Le flux de scission — l'exigence de l'ADR décision 2

`rattacherVaguePrevue` (PR2.1) est explicite : **aucune vérification préalable** de la contrainte
d'unicité `Vague.vaguePrevueId @unique` — c'est la contrainte DB qui doit rejeter, et le commentaire
du fichier dit noir sur blanc : *"En cas de conflit, Prisma lève `P2002` — à l'appelant (route API,
PR2.2) de le traduire en flux de scission proposé à l'utilisateur."* C'est donc **entièrement**
la responsabilité de PR2.2, rien n'est fait en amont.

**Le problème avec la convention actuelle** : `handleApiError` traite **tout** `P2002` de façon
générique — 409, `"Cette valeur existe déjà (vaguePrevueId)."` (ou le message de réessai dédié
`numero`/`code`, non pertinent ici). **Ce générique est indiscernable, côté UI, d'un conflit
quelconque** (ex. un code de scénario déjà pris) — l'UI ne peut pas savoir, à la seule lecture du
409 générique, qu'elle doit proposer un flux de scission plutôt qu'un simple message d'erreur.

**Précédent réel dans le dépôt pour une erreur métier typée, à réutiliser à l'identique** : le
pattern `QUOTA_DEPASSE` de `POST /api/vagues` (`src/app/api/vagues/route.ts:418-431`) — un code
d'erreur métier **distinct du texte du message**, porté dans le corps JSON via
`apiError(status, message, { code: "QUOTA_DEPASSE" })`, que le frontend peut tester par égalité
stricte sur `code` sans dépendre du texte francophone du message (fragile à toute reformulation).
`ConservationError` va plus loin encore : le corps 422 porte des **champs de données structurés**
(`sourcesTotal`, `saisiTotal`, `ecart`...), pas seulement un `code`.

**Ce que la route de rattachement doit faire, précisément (ce n'est pas une option, c'est
l'exigence de l'ADR)** :
1. Appeler `rattacherVaguePrevue` dans un `try`/`catch` **dédié** de la route (pas seulement
   `handleApiError` générique en bout de chaîne).
2. Détecter spécifiquement `error.code === "P2002"` **et** `error.meta?.target` contenant
   `vaguePrevueId` (pas n'importe quel P2002 — un code de scénario dupliqué au même instant ne doit
   pas déclencher, à tort, une proposition de scission).
3. Renvoyer un statut **409** (conflit — cohérent avec la convention P2002 existante, pas un 422 qui
   introduirait une troisième sémantique HTTP pour un cas très proche du conflit générique) **avec
   un corps enrichi et un `code` distinct et stable**, par exemple :
   ```json
   {
     "status": 409,
     "message": "Cette VaguePrevue a déjà une vague réelle rattachée. Proposez une scission (V7 → V7a + V7b) pour rattacher un second lot.",
     "code": "VAGUE_PREVUE_DEJA_RATTACHEE",
     "vaguePrevueId": "clxxx..."
   }
   ```
   C'est ce triplet (`code` stable + `vaguePrevueId` explicite dans le corps, pas seulement dans
   l'URL) qui permet à l'UI de PR2.3 de distinguer ce cas d'un 409 générique et de déclencher le
   flux de scission **sans parser le texte du message**. **`code` distinct requis** : ne pas
   réutiliser `"QUOTA_DEPASSE"` bien sûr, et ne pas réutiliser le comportement générique P2002 de
   `handleApiError` pour cette route précise (le générique reste correct pour tous les autres P2002
   du module — codes de scénario, de vague prévue, etc. — seul ce cas précis a besoin d'un
   traitement dédié).
4. **Ne pas exposer** un `scinderVaguePrevue` qui exige que l'appelant devine lui-même l'existence
   du conflit avant de l'invoquer — la route `POST /vagues-prevues/[id]/scinder` doit rester
   utilisable indépendamment (l'utilisateur peut scinder préventivement, pas seulement en réaction
   à un rejet), les deux routes coexistent sans dépendance forcée l'une envers l'autre.

## 5. La route de calcul — le point le plus délicat

**Constat confirmé par lecture directe de `types.ts`, pas supposé** : `AlimentPrevisionCalcInput`
porte un commentaire de tête explicite, non ambigu : *"GAP DE MODELE signalé au rapport de la story
PR1.3 : ni le schéma Prisma ... ni le texte de l'ADR ne spécifient de champ ni de formule pour
dériver cette valeur"* (`besoinTotalCycleKg`). Le loader `chargerScenarioPourMoteur` (PR2.1) le
confirme dans son propre en-tête : *"cette fonction ... NE COMPOSE PAS
`AlimentPrevisionCalcInput.besoinTotalCycleKg`"* — délibérément laissé à la route de calcul.

**Ce que fait la recette (`orchestration.ts`) pour ce même champ, à titre de référence — mais
attention, ce n'est PAS transposable telle quelle** : dans la recette, `besoinTotalCycleKg` est
composé à partir de `objectifTonnes` — un champ du **jeu d'or** (`fixture.entreesModele.planVagues[].
objectifTonnes`), c'est-à-dire une **entrée littérale du classeur Excel**, jamais dérivée d'un
calcul. Le schéma Prisma de production, lui, **n'a pas de champ `objectifTonnes` sur
`VaguePrevue`** — la donnée la plus proche disponible en production est
`VaguePrevue.effectifAlevinsPrevu` (nombre d'alevins stockés) et `ParametresPrevision.poidsObjectifG`
(poids visé, commun à tout le scénario). **La formule de conversion
`effectifAlevinsPrevu × poidsObjectifG → tonnage cible` n'a donc JAMAIS été vérifiée contre le jeu
d'or** : la recette ne l'exerce pas, parce que le jeu d'or fournit directement le tonnage comme une
entrée, sans exposer comment ce tonnage a été obtenu à partir d'un effectif d'alevins. **C'est un
risque réel à signaler explicitement, pas à passer sous silence** : la formule que @developer devra
écrire (probablement `kg = effectifAlevinsPrevu × poidsObjectifG / 1000`, sans facteur de survie
explicite — décision 4 de l'ADR, la mortalité est absorbée ailleurs, pas dans ce calcul) est une
**composition arithmétique simple, pas une modification du moteur** (elle vit dans la route, pas
dans `src/lib/previsions/`), donc elle ne viole pas la contrainte "le moteur est intouchable" — mais
son exactitude n'est garantie par **aucun test de recette existant**. **Recommandation impérative** :
un test unitaire dédié pour cette composition (pas un test d'intégration API complet), qui vérifie au
moins que la formule produit un ordre de grandeur cohérent avec le jeu d'or pour au moins une vague
du plan v12 (ex. reconstituer `objectifTonnes` de la fixture à partir de son
`effectifAlevinsPrevu`/`poidsObjectifG` équivalents, si ces valeurs sont dérivables des fixtures —
sinon documenter explicitement que ce point reste non vérifié et pourquoi).

**Séquence exacte que la route de calcul doit reproduire (dérivée d'`orchestration.ts`, adaptée aux
données réelles de production plutôt qu'aux fixtures)** :

1. `chargerScenarioPourMoteur(scenarioId, siteId)` → `ScenarioPourCalcul` (données brutes,
   `Decimal` moteur, PR2.1).
2. Pour **chaque** `VaguePrevue` du scénario (`scenario.vaguesPrevues`) :
   a. Composer le tonnage cible (le gap ci-dessus) à partir de `vaguePrevue.effectifAlevinsPrevu`
      et `scenario.parametres.poidsObjectifG`.
   b. Pour **chaque** `AlimentPrevision` (granulométrie) du scénario, composer
      `AlimentPrevisionCalcInput.besoinTotalCycleKg = tonnageCible × aliment.sacsParTonne ×
      aliment.poidsSacKg` (même formule que la recette, transposée), et
      `repartitions` depuis `aliment.repartitions` filtrées/étendues sur
      `1..vaguePrevue.dureeCycleMoisFigee` (pas `scenario.dureeCycleMois` courant — la valeur
      **figée** de la vague, ADR décision 1).
   c. Appeler `calculerBesoinAlimentMensuel(alimentsInput, moisCycle)` pour chaque mois de cycle →
      kg et sacs par granulométrie et par mois de cycle.
   d. Construire `AlimentParVagueCalcInput[]` (un par granulométrie, `sacsCalcules` = total sacs du
      cycle complet — **entier**, cf. §6) et appeler `calculerCoutAlimentVague` (coût total après
      remise, en utilisant `scenario.paliersRemise` déjà chargés) et
      `calculerCoutAlimentGranulometrieParMois` (répartition mensuelle du coût).
3. Convertir le mois de cycle en mois calendaire (`moisAbsolu = indexMois(vaguePrevue.
   dateStockagePrevue, scenario.dateDebutPlan) + (moisCycle - 1)`, même logique
   qu'`indexMoisCalendaire` de la recette) et **agréger par mois calendaire, toutes vagues actives
   confondues ce mois-là** (somme associative — le moteur n'agrège jamais lui-même à cette échelle,
   cf. section 4 de l'ADR : "aucune des 12 fonctions n'opère à l'échelle du mois calendaire
   multi-vague").
4. `calculerLogistiqueMensuelle` par mois calendaire (transport aliments/poissons/alevins), en
   utilisant les `sacsTotal`/`ventes`/`alevinsACommander` du mois — **note** : le tonnage de poissons
   vendu par mois calendaire (`quantitePoissonsKg`) est, comme dans la recette, une valeur qui n'est
   produite par **aucune** des 12 fonctions du moteur à cette granularité (`calculerRevenuPrevu`
   opère par vague, pas par mois calendaire agrégé) — la route devra construire ce calendrier de
   récolte elle-même à partir de `dateStockagePrevue + dureeCycleMoisFigee` de chaque `VaguePrevue`
   et de son tonnage cible, sans qu'aucune fonction moteur ne le fasse pour elle. **Signaler ce
   second gap explicitement**, du même ordre que le premier (§5, gap `besoinTotalCycleKg`).
5. `calculerChargesMensuelles` / `calculerBaseRepartition` / `calculerQuotePartVague` par mois
   calendaire, à partir de `scenario.postes`/`chargesMensuelles`/`journal` (décision 6 : exclure le
   journal affecté nominativement).
6. Assembler `depensesTotalesFCFA[mois] = coutAliments + coutAlevins + baseRepartition +
   investissements` et `revenusMois[mois]` (agrégat de `calculerRevenuPrevu` par vague récoltée ce
   mois), puis `genererSerieTresorerie(moisOrdonnes, soldeInitial)` et enfin
   `calculerPointBasTresorerie(serie)`.

**Ce que la route doit renvoyer en JSON** : la projection complète par mois calendaire (série de
`{ moisAbsolu, revenus, depenses, apports, soldeTresorerie }`), le point bas (`{ pointBasFCFA,
moisAbsolu }`), et probablement le détail par vague (coût de production, revenu prévu) pour le
tableau mensuel de PR2.4 — **chaque `Decimal` du résultat doit être converti via `decimalToNumber`
(`decimal-io.ts`) avant `NextResponse.json(...)`**, jamais laissé tel quel (c'est exactement le
piège documenté par PR2.1 pour `commissions.ts`/`getPortefeuille`, à ne pas reproduire ici).

**Persistance ou pas — la question non tranchée à trancher explicitement** : `replaceAlimentsParVaguePrevue`
(PR2.1) existe et sait écrire `sacsCalcules`/`quantiteKgCalculee`/`coutCalculeFCFA` par
`(vaguePrevue, alimentPrevision, moisCycle)`. Rien dans le sprint PR2 ne dit explicitement si la
route de calcul doit **persister** ces résultats (pour que `getVaguesPrevuesParScenario(...,
{withAliments:true})` les retrouve sans recalcul) ou rester **purement en lecture** (recalcul à la
volée à chaque appel, jamais écrit). **Recommandation à trancher par @developer avant de coder** :
étant donné que `AlimentParVaguePrevue.sacsCalcules` existe comme colonne persistée avec une
sémantique explicite ("sortie pure du moteur ... jamais éditée directement"), la route de calcul
devrait very probablement **persister** (appeler `replaceAlimentsParVaguePrevue` par `VaguePrevue`
en plus de renvoyer la projection agrégée) — sinon cette colonne resterait **structurellement
vide** pour toute donnée créée via l'UI (elle n'est peuplée par aucune autre route du tableau du
§2). Si la route persiste, elle **écrit**, donc elle exige `PREVISIONS_GERER` (pas seulement
`PREVISIONS_VOIR`) — ce qui tranche l'ambiguïté "VOIR ou GERER" soulevée au §2 : **GERER**, sauf si
@developer choisit explicitement le mode "jamais persisté" (auquel cas VOIR suffit, mais alors une
autre route ou un autre mécanisme doit exister pour peupler `AlimentParVaguePrevue` — actuellement
aucune n'existe dans PR2.1 en dehors de `replaceAlimentsParVaguePrevue` elle-même, invoquée par
qui ?). **Ce n'est pas une case à cocher rapidement : c'est une décision d'architecture qui doit
être écrite noir sur blanc dans le rapport de clôture de PR2.2.**

**Le moteur est intouchable — vérification explicite** : aucune des compositions ci-dessus (tonnage
cible, calendrier de récolte, agrégation multi-vague par mois) ne nécessite de modifier un fichier de
`src/lib/previsions/` (hors `__tests__/`) — elles vivent toutes dans la route (ou dans un module
d'orchestration dédié à créer, ex. `src/lib/previsions/route-orchestration.ts`, **hors** du dossier
protégé si l'équipe préfère isoler ce code du moteur pur testé par la recette — à trancher par
@developer, une frontière claire vaut mieux qu'un mélange). **Aucun gap trouvé ici ne justifie de
toucher au moteur** — les deux gaps identifiés (`besoinTotalCycleKg`, calendrier de récolte mensuel)
sont tous deux de la composition d'entrée, pas des fonctions manquantes du moteur lui-même.

## 6. Dette PR1 réserve 6 — homonymie `sacsCalcules`

**La documentation posée par PR2.1 est suffisante** pour le développeur des routes API : trois
endroits distincts portent le même avertissement de façon cohérente et non contradictoire —
`aliments.ts` (moteur), `previsions-scenario-loader.ts` (JSDoc de
`AlimentParVaguePrevuePourCalcul`), et `previsions-vagues.ts` (JSDoc de
`AlimentParVaguePrevueInputDTO`, qui est précisément le type que la route de calcul devra remplir
avant d'appeler `replaceAlimentsParVaguePrevue`). Le message est répété **au point d'écriture
Prisma exact**, pas seulement dans le moteur lointain — c'est là que ça compte le plus pour éviter
l'erreur.

**Chemin API où une valeur fractionnaire pourrait atteindre la colonne `Int`** : le point de risque
concret est précisément l'étape 2d de la séquence du §5 — si la route de calcul construit
`AlimentParVaguePrevueInputDTO.sacsCalcules` en recopiant directement le `number` produit par
`objectifTonnes.times(sacsParTonne).toNumber()` (le pattern **non arrondi** utilisé par la recette
pour la décision de palier, cf. `orchestration.ts:154`) plutôt que le résultat **entier** (`.sacs`,
déjà `ceil`) de `calculerBesoinAlimentMensuel`, l'écriture Prisma échouerait bruyamment sur la
colonne `Int` (ou, pire, réussirait silencieusement si Prisma tronque plutôt que de rejeter — **à
vérifier explicitement en test d'intégration DB-gated, pas supposé**). **Recommandation à faire
respecter en revue de code** : la route doit toujours utiliser le champ `sacs` (entier, `ceil`) du
résultat de `calculerBesoinAlimentMensuel`/`calculerCoutAlimentGranulometrieParMois` pour peupler
`sacsCalcules`/`quantiteKgCalculee` (colonnes DB), et réserver tout `number` fractionnaire
intermédiaire (proxy d'échelle façon recette) exclusivement à la décision de palier de remise,
jamais à une écriture Prisma directe.

## 7. Vérifications exécutables

- `npm run build` : **compilation réussie, aucune erreur.**
- `npx vitest run` : **236 fichiers passés / 3 skip (239 total), 6660 tests passés, 17 skipped,
  26 todo, 0 échec** — identique à la ligne de base post-PR2.1, aucune régression détectée.
- `npx vitest run src/lib/previsions/__tests__/recette/` : **2 fichiers, 842 tests, 0 échec** — la
  recette du moteur (jeu d'or, deux scénarios) est **intacte**.

Ligne de base non régressée sur les deux fronts demandés par le sprint.

## 8. VERDICT : GO AVEC RÉSERVES

Aucun blocage factuel (build vert, tests verts, recette intacte, terrain PR2.1 solide). Points que
le @developer **doit trancher explicitement et documenter dans le rapport de clôture**, dans l'ordre
de priorité :

1. **Mapping HTTP des deux validations §8(a)(b)** — aujourd'hui elles produiraient un 500 par
   défaut via `handleApiError`. Choisir : `statusMap` par route, ou retyper l'`Error` de
   `validation.ts` en `ValidationError`/nouveau type dédié. Sans ce choix, un test d'intégration
   API sur "somme ≠ 100 %" ou "seuils non croissants" échouerait silencieusement en 500 au lieu du
   code attendu.
2. **Le flux de scission (§4)** — un `code` métier stable et un corps enrichi
   (`vaguePrevueId`) sur le P2002 spécifique à `Vague.vaguePrevueId`, distinct du traitement P2002
   générique de `handleApiError`. C'est une exigence de l'ADR, pas une option — son absence bloque
   fonctionnellement PR2.3 (qui doit détecter ce cas précis pour proposer la scission).
3. **La route de calcul (§5)** — décision explicite sur : (a) la formule de composition du tonnage
   cible par `VaguePrevue` (jamais vérifiée par la recette — risque à documenter, pas à cacher),
   (b) la construction du calendrier mensuel de récolte (second gap, également jamais couvert par
   les 12 fonctions du moteur), (c) persistance ou non des résultats dans
   `AlimentParVaguePrevue` (tranche l'ambiguïté VOIR/GERER de cette route).
4. **Permission de `rattacherVaguePrevue`** — `PREVISIONS_GERER` seul, ou combiné à une permission
   vagues réelles existante (`VAGUES_MODIFIER`) ? Cette route touche une table hors du module
   Prévisions.
5. **Permission de création de scénario et des transitions de statut** (`archiverScenario`/
   `activerScenario`) — non couvertes explicitement par le tableau ADR §6, tranchées ici par
   recommandation (`GERER`) mais à confirmer.
6. **Choix de validation de payload** (zod vs. manuelle) — non tranché par le dépôt, les deux
   conventions coexistent ; recommandation zod compte tenu du volume de payloads du module, non
   bloquant.

Rien dans ces six points n'exige de retour à PR2.1 pour combler un manque de queries — toutes les
fonctions nécessaires existent déjà. Les décisions à prendre sont toutes de la couche route
(HTTP, permissions, orchestration), conformément au périmètre de PR2.2.
