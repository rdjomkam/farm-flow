# Rapport de tests — Story PR2.2 (Routes API, module Prévisions)

**Date** : 2026-08-03
**Testeur** : @tester
**Sprint** : PR2 — Module Prévisions
**Périmètre** : `src/app/api/previsions/**` (22 routes), `src/app/api/previsions/_shared.ts`,
`src/lib/validation/previsions.schema.ts`, `src/lib/previsions/route-orchestration.ts`

## Verdict final (après revérification du 2026-08-03) : **PASS**

Les trois correctifs (renommage `sacsParTonneUnitaire`/nouveau champ `sacsParTonneStandard`,
conversion kg→tonnes, application de `sacsSaisis`) sont revérifiés chiffres à l'appui, avec des
tests qui auraient échoué avant chacun d'eux. Voir la section **"0. Revérification post-correctifs
(2026-08-03)"** ci-dessous pour le détail complet — c'est la section faisant foi. Le corps du
rapport original (sections 1 à 7) est conservé tel quel en dessous, pour traçabilité, et porte
encore l'ancien verdict "PASS avec réserves" qui ne s'applique plus.

---

## 0. Revérification post-correctifs (2026-08-03)

### 0.1 Bug 1 — `sacsParTonne` / `sacsParTonneUnitaire` / `sacsParTonneStandard` : **CORRIGÉ, vérifié**

- **Migration** (`prisma/migrations/20260803150000_aliment_prevision_sacs_par_tonne_split/migration.sql`) :
  conforme R10 — sous-dossier avec `migration.sql`, rien à la racine de `prisma/migrations/`. Le
  SQL utilise un vrai `RENAME COLUMN "sacsParTonne" TO "sacsParTonneUnitaire"` (pas de
  `DROP`+`ADD`, donc pas de perte de données existantes) puis `ADD COLUMN "sacsParTonneStandard"
  DECIMAL(65,30)` nullable — conforme à l'amendement ADR-053 §11.2/§11.3 (nullable, pas de valeur
  par défaut inventée). `npx prisma migrate deploy` → "Database schema is up to date!", aucune
  dérive. `prisma/schema.prisma` reflète bien les deux champs (lignes 4460-4464).
- **Recherche exhaustive** : plus aucune occurrence du champ `sacsParTonne` (bare) dans `src/` ou
  `prisma/` en dehors de commentaires historiques et des migrations elles-mêmes — confirmé par
  grep ciblé sur `types/models.ts`, `previsions-aliments.ts`, `previsions-scenario-loader.ts`,
  `previsions.schema.ts`.
- **`copierAlimentsPrevisionDepuisProduits`** (`previsions-scenarios.ts:259-269`) : calcule bien
  `sacsParTonneUnitaire = 1000 / poidsSacKg` et initialise `sacsParTonneStandard: null` à la
  création — conforme §11.2 point 3 (pas de best-effort implémenté, ce qui est explicitement
  laissé à la discrétion de l'équipe par l'ADR, donc non bloquant).
- **Formule corrigée** (`route-orchestration.ts:266-276`) : lit `aliment.sacsParTonneStandard`
  (jamais `sacsParTonneUnitaire`), convertit `tonnageCible` (kg) en tonnes avant la multiplication.
  **Chiffre revérifié moi-même**, pas seulement cru sur parole : `5000 × 800 / 1000 = 4000 kg` →
  `4000 / 1000 = 4 tonnes` → `4 × 8 × 15 = 480 kg`. Confirmé par exécution réelle du test
  `previsions-route-orchestration.test.ts` ("REGRESSION...") : `expect(besoinTotalKg).toBe(480)`
  passe, `expect(besoinTotalKg).not.toBe(4_000_000)` passe. Ce test **aurait échoué** avant le
  correctif (l'ancienne formule produisait exactement 4 000 000, comme démontré dans le rapport
  original §4.1).
- **Sensibilité à la granulométrie** revérifiée : deux granulométries à `poidsSacKg` identique
  (15) mais `sacsParTonneStandard` différent (8 vs 18) reçoivent désormais 480 kg et 1080 kg
  respectivement (test dédié) — l'ancienne formule aurait produit la même valeur pour les deux,
  ce qui est le symptôme exact du bug d'origine.
- **Rejet explicite sur `null`** : vérifié à **deux niveaux**, conformément à la demande de la
  mission :
  1. Au niveau de la fonction pure (`previsions-route-orchestration.test.ts`) :
     `calculerProjectionScenario` lève une erreur nommant la granulométrie en cause.
  2. **Au niveau de la vraie route**, test ajouté par mes soins pendant cette revérification
     (`previsions-validations-http-mapping.test.ts`, describe "Cablage reel — GET
     /scenarios/[id]/calculer, sacsParTonneStandard null -> 422, pas 500") : appel réel de
     `calculerGET` (le handler exporté par `src/app/api/previsions/scenarios/[id]/calculer/route.ts`)
     avec `chargerScenarioPourMoteur` mocké pour renvoyer un aliment `sacsParTonneStandard: null`
     effectivement utilisé par une `VaguePrevue` active → **`response.status === 422`**, message
     contenant `sacsParTonneStandard` et le libellé de la granulométrie. Ce test n'existait pas
     avant cette revérification — c'était un vrai trou de couverture (le premier jet ne vérifiait
     le rejet qu'au niveau de la fonction pure, jamais via `PREVISIONS_STATUS_MAP` +
     `handleApiError` câblés sur la route réelle). Comblé.
  3. Contrat isolé également ajouté : `PREVISIONS_STATUS_MAP` mappe bien le message
     "sacsParTonneStandard non configure" à 422 (test dédié dans la section "contrat de mapping
     HTTP" du même fichier).

**Verdict Bug 1 : CORRIGÉ et vérifié aux trois niveaux (fonction pure, contrat statusMap, route
réelle).**

### 0.2 Bug 3 (erreur ×1000, kg vs tonnes) — **CORRIGÉ, vérifié, composé correctement avec Bug 1**

C'est le même correctif que celui vérifié en 0.1 (les deux défauts étaient composés dans la même
formule) : `tonnageCibleKg()` reste nommée ainsi et renvoie toujours des **kg** — la conversion
kg→tonnes est faite explicitement dans `calculerProjectionScenario`
(`tonnageCibleTonnes = tonnageCible.dividedBy(1000)`, `route-orchestration.ts:272`) avant la
multiplication par `sacsParTonneStandard × poidsSacKg`. Le chiffre de contrôle annoncé par la
mission (480 kg, pas 4 000 000 kg) est confirmé par exécution réelle du test, pas seulement par
lecture du code — voir 0.1.

### 0.3 Bug 2 — `sacsSaisis` appliqué : **CORRIGÉ pour le périmètre explicite de l'ADR, interprétation du grain jugée fidèle**

- **Non-régression du bug d'origine** : un test dédié (`previsions-route-orchestration.test.ts`,
  "une surcharge... PREVAUT sur le besoin brut") pose `sacsSaisis = 999` sur le mois 1 d'une ligne
  `AlimentParVaguePrevue` déjà persistée, et vérifie `ligneAliment.sacs === 999` ainsi que
  `montantFCFA === 999 × 18000`. **Ce test aurait échoué avant le correctif** : l'ancien code
  codait `sacsSaisisCycle: null` en dur, donc `sacs` serait resté au besoin brut du moteur (pas
  999) et `montantFCFA` n'aurait jamais reflété 999 sacs. Un test complémentaire confirme
  qu'en l'absence de toute surcharge, le comportement reste inchangé (retombe sur
  `sacsCalculesCycle`), et un troisième confirme qu'une surcharge sur un mois n'affecte pas les
  autres mois du même cycle qui n'en portent pas.
- **Jugement sur le désaccord de grain (mois vs cycle)** : l'implémentation retenue —
  `sacsSaisisCycle = Σ COALESCE(surcharge du mois, besoin brut du mois)` sur tous les mois du
  cycle, calculé **uniquement** si au moins une surcharge existe pour la granulométrie — est
  **fidèle à la lettre de l'ADR §3.6** (`COALESCE(sacsSaisis, sacsCalcules)` appliqué à `sacsCalculesCycle`
  au bon niveau d'agrégation, celui que `calculerCoutAlimentGranulometrieParMois` exige en entrée).
  C'est la seule lecture cohérente avec le fait que `AlimentParVaguePrevue` est persisté par mois
  (`@@unique([vaguePrevueId, alimentPrevisionId, moisCycle])`) alors que le moteur pilote la
  remise de volume au niveau du cycle entier — le développeur a correctement identifié qu'il n'y a
  pas de correspondance 1:1 et a choisi la seule ventilation qui ne perd ni la remise (calculée sur
  un vrai total agrégé) ni la fidélité mois par mois (`sacs` affiché = la surcharge exacte du mois
  quand elle existe).
- **Sur l'exclusion de `quantiteKg` et du calendrier logistique (GAP 2)** : le texte de l'ADR §3.6
  vise explicitement *"coût, budget, trésorerie"*. J'ai vérifié le câblage effectif de
  `route-orchestration.ts` : `depensesFCFA` (qui alimente `soldeFCFA`/la série de trésorerie, étape
  5) est composé de `coutAlimentsFCFA + coutAlevinsFCFA + baseRepartitionFCFA + investissementsFCFA`
  — **`logistique.sousTotalFCFA` n'y entre pas** (il reste un champ d'affichage séparé,
  `mois[].logistique.sousTotalFCFA`, jamais sommé dans `depensesFCFA` ni dans
  `calculerBudgetTotalPlan`). Autrement dit, dans le câblage actuel, aucun montant FCFA de
  trésorerie/budget ne dépend aujourd'hui du calendrier logistique — l'exclusion du calendrier
  logistique de la surcharge ne viole donc **pas** le texte de l'ADR à ce stade, puisqu'il n'y a
  actuellement aucun "calcul downstream de coût/trésorerie" dérivé de cette quantité. **Réserve
  documentée pour la suite** (sévérité Basse, non bloquante) : si une story future câble le coût de
  transport (`logistique.sousTotalFCFA`) dans `depensesFCFA`/le budget total, il faudra revisiter
  cette exclusion — le nombre de voyages, et donc le coût de transport, dépend physiquement de la
  quantité réelle consommée, que la surcharge `sacsSaisis` reflète justement mieux que le besoin
  brut calculé. Ce n'est pas un bug aujourd'hui ; ce serait un bug si/quand ce câblage est ajouté
  sans revisiter ce point.
- **`quantiteKg`** : reste le besoin brut (jamais surchargé) — cohérent avec le fait qu'aucune
  colonne "kg saisis" n'existe dans le modèle (`sacsSaisis` est en nombre de sacs, pas en kg) ;
  appliquer la surcharge à `quantiteKg` demanderait une conversion inverse (`sacsSaisis ×
  poidsSacKg`) que l'ADR ne demande pas et qui introduirait une grandeur dérivée absente du modèle.

**Verdict Bug 2 : CORRIGÉ. L'interprétation du développeur sur le grain mois/cycle est fidèle à
l'ADR. L'exclusion de la logistique est également fidèle au texte au vu du câblage actuel — signalée
comme point de vigilance pour une story future, pas comme un défaut présent.**

### 0.4 Fixture `previsions-cross-site-and-serialization.test.ts` modifiée par le développeur — couverture non perdue

Le changement `sacsParTonneStandard: null` → `new Decimal(8)` était nécessaire (sinon la route
lève désormais une erreur 422 avant même d'atteindre la sérialisation). Vérifié que la couverture
visée par ce test est intacte : il vérifie toujours `response.status === 200`, l'absence des motifs
internes de `decimal.js` (`"d":[`, `"s":1,"e":`) dans le texte JSON brut, et `typeof === "number"`
sur chaque champ numérique de la réponse (`mois[].revenusFCFA/depensesFCFA/soldeFCFA`,
`budget.budgetTotalFCFA`). Le commentaire ajouté par le développeur explique correctement pourquoi
la valeur a changé. **Aucune perte de couverture.**

### 0.5 Reste de la matrice PR2.2 — reconfirmé

Ré-exécution complète de tous les fichiers de tests originaux de cette story
(`previsions-auth-permissions`, `previsions-validations-http-mapping`,
`previsions-rattacher-scission`, `previsions-route-orchestration`,
`previsions-cross-site-and-serialization`) : tous passent. Permissions 401/403/200 sur les 22
routes, mapping 422/422/400 du §8, flux de scission (`code: VAGUE_PREVUE_DEJA_RATTACHEE`),
isolation cross-site (R8), absence de `Decimal` brut en JSON — tous reconfirmés sans régression.

### 0.6 Vérifications exécutables — sortie réelle (2026-08-03, revérification)

```
npx vitest run
```
→ **247 fichiers passés, 4 skip (251 total)**, **6872 tests passés, 19 skipped, 26 todo, 0 échec**.
Ligne de base attendue : 6870 passés — **+2 tests** (les deux tests que j'ai ajoutés pendant cette
revérification pour combler le trou de couverture identifié en 0.1, point 2 : rejet 422 vérifié via
la vraie route, et le contrat isolé du statusMap pour ce motif). Aucune régression.

```
npx vitest run src/lib/previsions/__tests__/recette
```
→ **2 fichiers, 842 tests, 0 échec** — recette du moteur (jeu d'or, deux scénarios) **intacte**,
conformément à la contrainte absolue que le moteur reste intouchable (confirmé par ADR-053 §11.4 et
revérifié ici par exécution réelle, pas seulement par lecture).

```
npx prisma migrate deploy
```
→ "164 migrations found in prisma/migrations", "No pending migrations to apply." /
`npx prisma migrate status` → "Database schema is up to date!" — migration déjà appliquée
proprement, aucune dérive, conforme R10.

```
npm run build
```
→ **échec**, mais **sans rapport avec cette story ni avec les 3 correctifs vérifiés ici** :
`src/components/previsions/scenario-detail-client.tsx` importe des composants qui n'existent pas
encore (`aliments-tab`, `plan-vagues-tab`, `charges-tab`, `journal-tab`, `apports-tab`,
`src/components/previsions/`). C'est du travail UI de la story PR2.3, en cours de développement en
parallèle par un autre agent (tout le dossier `src/components/previsions/` et
`src/app/(farm)/previsions/` est non commité / untracked au moment de cette revérification) — ce
n'est ni une régression de PR2.2, ni imputable aux 3 correctifs de cette mission. Signalé
explicitement au lieu d'être traité ou masqué : **le build échouera tant que PR2.3 n'a pas livré ces
5 composants**, indépendamment du verdict PASS de la présente revérification. Aucune tentative de
corriger ce code UI n'a été faite (hors périmètre, travail en cours d'un autre agent).

### 0.7 Fichiers modifiés/ajoutés par cette revérification

- `src/__tests__/api/previsions-validations-http-mapping.test.ts` — ajout de 2 tests : le contrat
  isolé (`sacsParTonneStandard non configure` → 422) et le câblage réel sur la vraie route
  `GET /scenarios/[id]/calculer` (422, jamais 500, message nommant la granulométrie).
- Aucun autre fichier de test ni fichier de production modifié — aucun bug résiduel ne justifiait
  une correction au-delà de ce test manquant.

---

## Rapport original (2026-08-03, avant correctifs) — conservé pour traçabilité

**Verdict d'origine (obsolète, remplacé par la section 0 ci-dessus) : PASS avec réserves — 2 bugs à
trancher par le PM avant PR2.3/PR2.4**

Les 22 routes respectent le contrat auth/permissions/HTTP attendu, le flux de scission est
correctement câblé, et les trois validations bloquantes du §8 produisent le bon code HTTP. En
revanche, l'investigation demandée sur la route de calcul (§4 de la mission) confirme **deux bugs
réels**, pas seulement des "risques documentés" : la formule `sacsParTonne` produit un résultat
faux d'un facteur de plusieurs ordres de grandeur, et les surcharges `sacsSaisis` persistées ne
sont jamais appliquées, en contradiction explicite avec l'ADR. Le moteur (`src/lib/previsions/`,
hors `route-orchestration.ts`) n'a pas été touché — recette reconfirmée à 842/842.

## Fichiers de tests livrés

| Fichier | Tests | Objet |
|---|---|---|
| `src/__tests__/api/previsions-auth-permissions.test.ts` | 97 | Matrice 401/403/200-201 sur les 32 combinaisons méthode×route (22 routes), vérifie la permission exacte demandée à `requirePermission` pour chacune |
| `src/__tests__/api/previsions-validations-http-mapping.test.ts` | 7 | Contrat `PREVISIONS_STATUS_MAP` (422/422/400, jamais 500) + câblage réel sur 3 routes représentatives |
| `src/__tests__/api/previsions-rattacher-scission.test.ts` | 8 | Flux de scission (ADR-053 décision 2) : P2002 spécifique → 409 + `code: VAGUE_PREVUE_DEJA_RATTACHEE`, distinction du P2002 générique, route `scinder`, absence structurelle de `DELETE` sur `vagues-prevues/[id]` |
| `src/__tests__/lib/previsions-route-orchestration.test.ts` | 7 | Orchestration de la route de calcul (moteur réel, non mocké) : démonstration chiffrée du bug `sacsParTonne`, non-application de `sacsSaisis`, point bas + mois, décision 6 (exclusion du journal affecté) |
| `src/__tests__/api/previsions-cross-site-and-serialization.test.ts` | 6 | R8 (siteId threadé, 404 cross-site) + absence de `Decimal` brut dans la réponse JSON de la route de calcul |
| **Total nouveau** | **125** | |

## 1. Auth et permissions — 22 routes

Vérifié systématiquement (97 tests) : non authentifié → 401, authentifié sans la permission → 403,
avec la permission → 200/201 **et** la permission exacte demandée correspond à la table de l'ADR /
du rapport de clôture PR2.2 :

| Groupe | Permission observée | Conforme |
|---|---|---|
| Lecture (tous les GET, 12 routes) | `PREVISIONS_VOIR` | ✅ |
| Scénario (créer, archiver, activer), VaguePrevue (créer/éditer/annuler/scinder/rattacher), aliments par vague, sacs-saisis, journal, charges (upsert), apports | `PREVISIONS_GERER` | ✅ |
| Paramètres, référentiel aliments/granulométries, paliers de remise, référentiel postes | `PREVISIONS_PARAMETRER` | ✅ |
| Route de calcul (`GET /scenarios/[id]/calculer`) | `PREVISIONS_VOIR` **seule** | ✅ conforme à la décision explicite du sprint |

Aucune route n'utilise `PREVISIONS_CLOTURER` (aucune route de clôture de mois n'existe dans ce
sprint — cohérent avec le périmètre PR2, `ClotureMois` hors MVP de cette story).

**Route de calcul — vérifiée en lecture pure.** Test dédié (`previsions-cross-site-and-serialization.test.ts`)
confirme qu'elle n'appelle que `chargerScenarioPourMoteur` (lecture) et ne référence aucune fonction
d'écriture (`replaceAlimentsParVaguePrevue` n'est jamais importée dans `calculer/route.ts` — vérifié
par lecture directe du fichier, § developer notes). Aucune tentative de persistance décelée.

**R8 (activeSiteId threadé).** Spot-check sur un représentant de chaque groupe (`scenarios/[id]`,
`vagues-prevues/[id]`, `scenarios/[id]/calculer`) : la route transmet bien `auth.activeSiteId`
issu de `requirePermission`, jamais une valeur du body/params. Une ressource dont la query renvoie
`null` (site différent) donne 404, jamais un contenu partiel — cohérent avec le filtre `siteId`
déjà porté par PR2.1 dans chaque query.

## 2. Les trois validations bloquantes du §8 — HTTP correct, pas 500

Vérifié à la fois en isolation (le contrat `PREVISIONS_STATUS_MAP`) et câblé sur une route réelle
par cas :

- Somme des pourcentages ≠ 100 % (`PUT /aliments/[id]/repartitions`) → **422** ✅
- Seuils de remise non strictement croissants (`PUT /scenarios/[id]/paliers-remise`) → **422** ✅
- Valeur fractionnaire sur colonne `Int` (`PUT /vagues-prevues/[id]/aliments`) → **400** ✅
- Test de contrôle : le même message, **sans** `statusMap`, retombe bien en 500 — preuve que le
  risque signalé par la pré-analyse était réel et que le mapping ajouté par le développeur le
  corrige effectivement (pas un test qui passerait de toute façon).

Aucune `VaguePrevue` ne peut être supprimée : aucune route `DELETE` n'existe sur cette collection
(vérifié par import direct du module de route et assertion `DELETE === undefined`), conforme à
l'ADR décision 2.

## 3. Flux de scission (ADR-053 décision 2)

`POST /vagues-prevues/[id]/rattacher` :
- Rattachement réussi → 200, aucun `code` d'erreur dans le corps.
- P2002 avec `meta.target` contenant `vaguePrevueId` → **409**, `code: "VAGUE_PREVUE_DEJA_RATTACHEE"`,
  `vaguePrevueId` présent dans le corps — **distinct** du traitement générique (vérifié par un
  deuxième test avec `target: ["code"]`, qui ne renvoie **pas** ce code métier).
- 400 si `vagueId` absent (validation zod).

`POST /vagues-prevues/[id]/scinder` : scission réussie → 201 avec les enfants portant
`vaguePrevueParentId` ; 400 si moins de 2 scissions fournies (contrainte du schéma zod,
`min(2, ...)`) ; 409 si la query rejette un statut incompatible.

Les deux routes sont bien indépendantes (aucune dépendance forcée testée ni observée dans le code).

## 4. La route de calcul — investigation prioritaire (§4 de la mission)

### 4.1 BUG CONFIRMÉ (sévérité proposée : **Haute**) — `sacsParTonne` produit un résultat faux

**Constat chiffré (test `previsions-route-orchestration.test.ts`, section "GAP 1")** :

- `AlimentPrevision.sacsParTonne` en **production** est calculé par `previsions-scenarios.ts`
  (`copierAlimentsPrevisionDepuisProduits`) comme `1000 / poidsSacKg` — un pur facteur de
  conversion d'unité (nombre de sacs de CE produit pour faire une tonne de CE produit).
- Le moteur/la recette (`__tests__/recette/orchestration.ts`) utilise `sacsParTonneStandard`, une
  notion **complètement différente** : un taux de conversion aliment/poisson (nombre de sacs de
  cette granulométrie nécessaires par tonne de POISSON produit), qui varie fortement par
  granulométrie dans le jeu d'or (8 pour le 2mm, 18 pour le 3mm, 50 pour le 4mm — alors que les
  trois granulométries ont le même `poidsSacKg` = 15 dans les fixtures).
- La formule retenue par `route-orchestration.ts` (`besoinTotalCycleKg = tonnageCibleKg ×
  aliment.sacsParTonne × aliment.poidsSacKg`) est mathématiquement cohérente **seulement** si
  `sacsParTonne` porte la sémantique "jeu d'or" (`sacsParTonneStandard`). Avec la formule de
  production réelle (`sacsParTonne = 1000 / poidsSacKg`), le produit `sacsParTonne × poidsSacKg`
  vaut **toujours 1000**, quelle que soit la granulométrie — la formule dégénère en
  `besoinTotalCycleKg = tonnageCibleKg × 1000`, complètement insensible à la granulométrie.
- **Démonstration numérique** (test) : pour une vague de 5000 alevins visant 800 g
  (`tonnageCibleKg` = 4000 kg), la route produit **4 000 000 kg** de besoin pour une seule
  granulométrie — alors que la formule correcte (jeu d'or, `sacsParTonneStandard` = 8, `poidsSacKg`
  = 15, tonnage cible ≈ 4 tonnes) donnerait **480 kg**. Écart d'un facteur **~8300**.
- **Conséquence pratique testée** : deux granulométries différentes (2mm et 3mm) avec le même
  `poidsSacKg` mais des `sacsParTonneStandard` différents (8 vs 18 dans le jeu d'or) reçoivent
  **exactement le même besoin en kg** dans la route de production — ce qui est impossible pour
  deux granulométries qui ont des profils de consommation différents.
- Ce n'est donc **pas un simple "risque non vérifié par la recette"** comme documenté
  prudemment par le développeur (à raison, vu qu'aucun test de recette n'exerce cette
  composition) : c'est une **divergence numérique démontrable et reproductible**, avec un facteur
  d'erreur de plusieurs ordres de grandeur sur la sortie phare de la route (besoin en aliment,
  coût, trésorerie).
- **Recommandation** : ne pas corriger `route-orchestration.ts` sans trancher d'abord la
  sémantique du champ. Deux pistes, à la décision du PM/@architect : (a) renommer/ajouter un champ
  `AlimentPrevision.sacsParTonneStandard` distinct de `sacsParTonne` (pur ratio d'unité), avec
  saisie manuelle obligatoire par l'utilisateur (la valeur ne peut pas être dérivée
  automatiquement de `Produit`, elle dépend d'un taux de conversion biologique qui n'existe nulle
  part dans le catalogue produit actuel) ; (b) ou documenter que `sacsParTonne` doit être **édité
  manuellement** par l'utilisateur après création du scénario pour refléter le vrai taux de
  conversion, et ajouter une garde qui empêche silencieusement le calcul de tourner avec la valeur
  par défaut dérivée de `poidsSacKg`.

### 4.2 BUG CONFIRMÉ (sévérité proposée : **Haute**) — `sacsSaisis` jamais appliqué, contredit l'ADR

Confirmé par lecture du code (`route-orchestration.ts` passe systématiquement
`sacsSaisisCycle: null` à `calculerCoutAlimentGranulometrieParMois`, sans jamais lire
`AlimentParVaguePrevue.sacsSaisis` déjà persisté) et par test (`previsions-route-orchestration.test.ts`,
section "GAP 2") : une ligne `AlimentParVaguePrevue` portant `sacsSaisis = 999` n'a **aucun effet**
sur le résultat recalculé par la route — elle repart de zéro à chaque appel.

Ceci contredit littéralement l'ADR-053 section 3.6 : *"Tous les calculs downstream (coût, budget,
trésorerie) utilisent `COALESCE(sacsSaisis, sacsCalcules)` — jamais `sacsCalcules` seul une fois
qu'une surcharge existe."* La route de calcul est un calcul downstream (elle alimente
potentiellement le tableau de bord / la vue mensuelle de PR2.4) et ignore silencieusement les
surcharges terrain déjà saisies via `PATCH /aliments-par-vague-prevue/[id]/sacs-saisis`.

Le développeur l'a documenté explicitement en tête de fichier ("Surcharges manuelles NON
appliquées ici") comme une décision assumée du sprint ("la route de calcul est en LECTURE PURE...
recalcule PUREMENT depuis les paramètres bruts") — mais cette décision, aussi explicite soit-elle,
**contredit le texte de l'ADR** qui ne prévoit aucune exception pour une route "pure lecture". À
trancher explicitement par le PM : soit la route doit fusionner les surcharges persistées
(nécessite de charger `AlimentParVaguePrevue.sacsSaisis` déjà fait par `chargerScenarioPourMoteur`,
disponible dans `vague.alimentsParMois`, simplement non utilisé par l'orchestration), soit l'ADR
doit être amendé pour exempter explicitement cette route.

### 4.3 Ce qui est correct et vérifié

- **Point bas de trésorerie** : la route renvoie bien `pointBas.pointBasFCFA` et
  `pointBas.moisAbsolu`, vérifié égal au minimum réel de la série de soldes mensuels (test dédié).
- **Décision 6 (exclusion du journal affecté)** : un poste `inclusBaseRepartition = false`
  n'entre pas dans `baseRepartitionFCFA` — vérifié.
- **Sérialisation** : aucun `Decimal` brut ne fuite dans la réponse JSON de la route de calcul —
  tous les champs numériques sont des `number` JS après `decimal-io`/`n()`. Vérifié par inspection
  du texte JSON brut (absence de la structure interne `{s, e, d}` de `decimal.js`) et par
  assertion de type sur chaque champ.
- **Le moteur n'est pas modifié** : `route-orchestration.ts` n'appelle que des fonctions déjà
  exportées par `src/lib/previsions/*.ts`, aucune n'a été touchée. Recette 842/842 intacte
  (revérifiée explicitement, section 5 ci-dessous).

## 5. Vérifications exécutables — sortie réelle

```
npx vitest run
```
→ **247 fichiers passés, 4 skip (251 total)**, **6867 tests passés, 19 skipped, 26 todo, 0 échec**.
Ligne de base attendue par le sprint : 6742 tests passés — **+125 tests** (les 5 fichiers livrés
par cette story), **aucune régression**.

```
npm run build
```
→ compilation réussie, aucune erreur.

```
npx vitest run src/lib/previsions/__tests__/recette
```
→ **2 fichiers, 842 tests, 0 échec** — recette du moteur (jeu d'or, deux scénarios) **intacte**,
revérifiée explicitement après les tests de cette story (pas seulement incidemment via le run
global).

## 6. Bugs à trier — liste priorisée

| # | Titre | Sévérité proposée | Fichier(s) | Statut |
|---|---|---|---|---|
| 1 | `sacsParTonne` (production) vs `sacsParTonneStandard` (jeu d'or) — homonymie qui fait dégénérer `besoinTotalCycleKg` en une valeur indépendante de la granulométrie, fausse d'un facteur ~1000-8000x | **Haute** | `src/lib/previsions/route-orchestration.ts` (fonction `tonnageCibleKg`/formule GAP 1), `src/lib/queries/previsions-scenarios.ts` (`copierAlimentsPrevisionDepuisProduits`) | **CORRIGÉ ET VÉRIFIÉ** (2026-08-03, cf. section 0.1/0.2 ci-dessus — ADR-053 §11, migration `20260803150000_aliment_prevision_sacs_par_tonne_split`) |
| 2 | Route de calcul n'applique jamais `AlimentParVaguePrevue.sacsSaisis` déjà persisté — contredit littéralement ADR-053 §3.6 (`COALESCE(sacsSaisis, sacsCalcules)` obligatoire dans tous les calculs downstream) | **Haute** | `src/lib/previsions/route-orchestration.ts` (`sacsSaisisCycle: null` en dur) | **CORRIGÉ ET VÉRIFIÉ** (2026-08-03, cf. section 0.3 ci-dessus) |

Aucun des deux bugs n'a été corrigé dans le cadre de ce rapport (hors périmètre du @tester) — les
tests écrits les **démontrent** et **capturent le comportement actuel** (ils échoueraient si l'un
des deux bugs disparaissait silencieusement sans mise à jour du test, ce qui est volontaire :
ils servent de garde-fou de non-régression une fois le fix décidé et implémenté).

## 7. Ce qui n'a pas été testé (hors périmètre explicite de cette story)

- Les écrans UI (PR2.3/PR2.4) — pas encore développés.
- La persistance de `AlimentParVaguePrevue` via `PUT /vagues-prevues/[id]/aliments` en intégration
  DB réelle (déjà couverte côté queries par PR2.1, cf. `docs/tests/rapport-story-PR2.1.md`) — ici
  testée uniquement au niveau route (mock de la query).
- Le calendrier de récolte/transport (GAP 2 de `route-orchestration.ts`) n'a pas de test dédié
  distinct — sa logique de sommation associative est exercée indirectement par les tests de
  `calculerProjectionScenario` (point bas, base_repartition), mais aucun test ne vérifie
  spécifiquement le nombre de voyages logistiques calculé. Risque résiduel documenté par le
  développeur, non couvert davantage ici faute de jeu de données de recette pour cette
  granularité (cf. pré-analyse PR2.2 §5).
