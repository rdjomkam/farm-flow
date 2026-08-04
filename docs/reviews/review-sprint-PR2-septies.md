# Review de sprint — PR2-septies

**Sprint :** PR2-septies — La remise fournisseur se décide au tonnage de la vague
**Auteur :** @code-reviewer
**Date :** 2026-08-04
**Story :** PR2sept.5
**Réfs :** ADR-053 §13, ERR-143, docs/analysis/pre-analysis-sprint-PR2-septies.md, docs/tests/rapport-sprint-PR2-septies.md
**Note :** rapport persisté par un agent scribe, l'agent @code-reviewer ne disposant pas d'outil d'écriture.

---

# Verdict de sprint : **VALIDÉ AVEC RÉSERVES**

Aucune réserve bloquante. Le correctif d'ERR-143 est complet, cohérent de bout en bout et **prouvé par la recette d'orchestration**, ce qui est exactement ce que les deux sprints précédents n'avaient pas. Les réserves sont de niveau Faible/Moyenne, toutes documentaires ou de dette assumée.

## Point 2 — Le contrat est-il exprimable par l'utilisateur ? **OUI.** ERR-143 peut être close.

C'est la question qui décide, et elle se tranche par une chaîne vérifiable maillon par maillon, sans aucune mise à l'échelle cachée :

| Maillon | Fichier:ligne | Grandeur | Unité |
|---|---|---|---|
| Libellé + aide | `src/messages/{fr,en}/previsions.json:180-181` | seuil de palier | **tonnes** (« Seuil (tonnes) », `seuilHint` explicite) |
| État de saisie | `parametres-tab.tsx:106-111` | chaîne brute, `step="any"` (l.373) | tonnes, décimales acceptées (2,5 t) |
| Payload PUT | `parametres-tab.tsx:255` | `Number(p.seuilTonnes)` | tonnes |
| zod | `previsions.schema.ts:96` (`nonNegativeNumber`) | — | tonnes |
| Query | `previsions-scenarios.ts:468, 509` | `new Decimal(p.seuilTonnes)` | tonnes |
| Prisma | `schema.prisma:4452` `seuilTonnes Decimal` | — | tonnes |
| Loader | `previsions-scenario-loader.ts:300` | `prismaDecimalToEngine` | tonnes |
| Décision | `aliments.ts:126-140` `determinerPourcentageRemise(tonnageVagueT, paliers)` | **tonnage de vague** | tonnes |
| Orchestration | `route-orchestration.ts:397, 405-409` | `tonnageCibleTonnes = effectif × poidsObjectifG / 1e6`, décidé **hors** de la boucle `for (const aliment …)` (l.413) | tonnes |

**Aucun facteur ne s'intercale** : pas un seul `sacsParTonneStandard`, pas une conversion kg↔sacs, pas un `/1000` de plus, entre le champ du formulaire et la comparaison `tonnageVagueT.gte(palier.seuilTonnes)`. Le point de décision est unique dans tout le dépôt (une seule occurrence de `determinerPourcentageRemise` en applicatif) et l'application du taux est unique elle aussi (`appliquerTauxRemise`, deux appelants : `aliments.ts:203` et `route-orchestration.ts:508`).

**La preuve numérique existe et porte sur le chemin réel** : `route-orchestration.recette.test.ts:98` compare `coutAlimentFCFA` **remisé** produit par `calculerProjectionScenario` à `planVagues[].coutAlimentsFCFA` du classeur, sur les 19 vagues (tolérance ≤ 1 FCFA), et `:110` compare le **taux retenu** à `planVagues[].remisePct` (0/2/4/6 %). Les 4 paliers du classeur (0/5/10/15 t) sont passés **tels quels** par `buildPaliersRemise` (`recette/orchestration.ts:152-158`), c'est-à-dire dans la forme exacte qu'un exploitant saisit dans l'onglet Paramètres. Les seuils exacts (10 t, 15 t) exercent réellement la sémantique `≥`.

Autrement dit : la règle §4.3 est aujourd'hui **saisissable** (4 champs), **stockable**, **calculée une fois par vague**, et **recettée contre le classeur sur le chemin applicatif**. Les trois conditions qui manquaient à ERR-143 sont remplies.

## Point 3 — Les trois contournements sont morts, et rien ne les a remplacés

| # | Contournement d'origine | État vérifié |
|---|---|---|
| 1 | `orchestration.ts:159` `seuilSacs = seuilTonnes × sacsParTonneStandard` (`buildCoutAlimentsParVague`) | **supprimé** — `orchestration.ts:152-158` passe `seuilTonnes` direct ; JSDoc l.146-150 documente pourquoi |
| 2 | `orchestration.ts:358` (jumeau, `buildCoutAlimentsParVagueEtMois`) | **supprimé** — même primitive `buildPaliersRemise` réutilisée |
| 3 | `route-orchestration-builder.ts` `paliersRemise: []` | **supprimé** — l.219 `options.paliersRemise ?? buildPaliersRemise(fixture)` : les 4 paliers réels sont le **défaut** ; l'option de remplacement est documentée « jamais un moyen de désactiver la remise » (l.135-139) |

Recherche d'un équivalent plus discret : les seules occurrences restantes de `sacsParTonneStandard` dans la recette (`orchestration.ts:86, 202, 391`, `route-orchestration.recette.test.ts:89-93, 585`) sont des calculs de **besoin/sacs** (`ceil` par granulométrie, README point 1), jamais un seuil de palier. Le seul `paliersRemise: []` subsistant est `route-orchestration-detail-consommation.test.ts:126`, dans un test qui **n'asserte aucun montant** (uniquement `detailParVagueSacs`) et dont le commentaire l.124-125 renvoie explicitement à la recette d'orchestration pour la remise. **Conforme.**

Sécurité structurelle en plus : `appliquerTauxRemise` ne reçoit ni tonnage, ni paliers, ni sacs — la forme condamnée par ERR-143 (redécider le palier par calibre) est **impossible à écrire par inadvertance** depuis la boucle de `route-orchestration.ts`, et la JSDoc (`aliments.ts:151-157`) l'énonce comme frontière.

## Point 4 — Les correctifs de réserves n'ont rien réintroduit

- **`input.tsx` (partagé par toute l'app)** : `hint && !error ? hintId : null` (l.33) est désormais **strictement identique** à la condition de rendu du paragraphe (l.81 `{hint && !error && …}`). C'est un resserrement : l'attribut ne peut plus pointer un id absent. J'ai passé en revue les 15 appelants de `hint=` (`ponte-form-client`, `ponte-completer-client`, `regle-form-client`, `feeding-recommendation`, `scenario-form-dialog` ×4, `journal-form-dialog`, `vente-detail-client`, `aliment-form-dialog`, `parametres-tab` ×2) : **aucun n'est cassé** — le rendu visible est inchangé pour tous, seul l'`aria-describedby` du cas « hint + error simultanés » change, et ce cas n'était atteignable nulle part ailleurs. Aucun autre test du dépôt n'asserte `aria-describedby` (grep exhaustif sur `*.test.tsx` : seul `parametres-tab.test.tsx`).
- **État chaîne des paliers** (`PalierFormRow`, l.106-111) : aligné sur `values` des paramètres ; la conversion `Number()` a lieu une seule fois, à l'enregistrement (l.255). La saisie « 2,5 t » est possible et testée (`parametres-tab.test.tsx:215, 234-248`, y compris l'absence d'arrondi dans le payload).
- **`paliersFieldErrors`** (l.154, 196-205, 239-247, 262-273) : indexé sur le `field` zod exact `paliers.<i>.<champ>`, effacé à la frappe du champ concerné, **vidé intégralement à la suppression d'un palier** (les clés sont positionnelles — le raisonnement l.241-245 est juste et c'est le seul comportement correct).
- **`PREVISIONS_STATUS_MAP` aligné sur 400** (`_shared.ts:88`) : le test correspondant a bien été mis à jour (`previsions-validations-http-mapping.test.ts:216, 233`), et l'argument « un même refus ne peut pas avoir deux codes selon le chemin » est le bon.

## Problèmes par sévérité

**Aucun Critique. Aucun Haut.**

### Moyenne

- **M-1 — `PREVISIONS_STATUS_MAP` : couplage par sous-chaîne d'un message utilisateur.** 7 entrées, toutes fondées sur `message.includes(...)` d'un texte français **volontairement désaccentué** pour que le matching tienne (`previsions-scenarios.ts:485-491`, `_shared.ts:78-86`). Accentuer « meme ordre d'evaluation » — correction légitime dans une UI française — ferait silencieusement retomber le cas en 500. **Qualification : risque, pas dette acceptable**, parce que le mécanisme d'échec est *silencieux* et que la garde qui le protège est un commentaire. La correction (erreur métier typée portant son statut, `BusinessRuleError { status }`) est correctement identifiée et hors périmètre de ce sprint. À planifier explicitement, pas à laisser dériver : c'est la 3e review consécutive qui la signale (réserve n°6 PR2-bis, M3 PR2sept.4, ici).
- **M-2 — Vérification de présentation en Chromium réel à 360 px non faite.** `parametresTab.paliers.description` fait ~490 caractères en FR (plus long encore que les ~330 annoncés par le @tester après l'ajout de la phrase sur l'unicité de l'ordre), et le `seuilHint` s'ajoute sous le premier champ d'une grille `grid-cols-1 sm:grid-cols-3`. ERR-157 : jsdom ne prouve rien ici. Reste ouvert (déjà listé §8 du rapport de test).

### Faible

- **R-1 — R9 sur l'arbre final.** Le rapport `docs/tests/rapport-sprint-PR2-septies.md` (4 passages, 8 858 tests, build OK) est **antérieur aux deux passes de correction de réserves** : il décrit encore `PREVISIONS_STATUS_MAP` en 422 (§B5) et signale comme ouvert le fait que `handleSavePaliers` n'exploite pas `result.errors` (§6.1) — deux points depuis corrigés. Le code et les tests correspondants sont cohérents entre eux à la lecture (test aligné sur 400, tests de saisie décimale et d'`aria-describedby` présents), mais **aucun rapport ne documente un run complet vert + build sur l'arbre livré**. À faire avant clôture, sans attente d'écart.
- **F-1 — Message d'erreur utilisateur portant un identifiant de code.** `validation.ts:68` renvoie « … seuilTonnes=5 n'est pas > … seuilTonnes=0 ». §13.8 point 2 demandait de sortir `seuilSacs` des messages utilisateur : c'est fait, mais on a remplacé un nom de champ faux par un nom de champ juste — l'utilisateur lit toujours du camelCase dans une UI française. Formulation cible : « seuil 5 t ».
- **F-2 — `deleteMany({ where: { scenarioId } })`** (`previsions-scenarios.ts:503`) sans `siteId`. R8 est sauvée par le `findFirst({ id, siteId })` de la ligne 458 dans la même transaction — donc pas de faille — mais le filtre défensif coûte zéro et le pattern « siteId sur chaque écriture » de l'en-tête du fichier n'est pas littéralement tenu ici.
- **F-3 — Course entre deux PUT concurrents.** Deux `replacePaliersRemise` simultanés sur le même scénario peuvent, en READ COMMITTED, se croiser entre `deleteMany` et `createMany` et violer `@@unique([scenarioId, ordre])` → P2002 → 409 « Cette valeur existe déjà (scenarioId, ordre) », soit exactement le message de base de données que le sprint a chassé. **Qualification : dette acceptable** — probabilité très faible (un seul utilisateur édite les paliers d'un scénario), aucune corruption possible (transaction annulée), un simple réessai résout. À ne traiter que si le cas se produit.
- **F-4 — `positiveInt` est en fait `.nonnegative()`** (`previsions.schema.ts:38`). Le nom ment sur 5 autres champs (`capaciteTransport*`) en plus d'`ordre`. Conséquence concrète et unique : `ordre = 0` est acceptable par l'API alors que l'UI numérote à partir de 1 (`addPalier`, max+1 depuis 0). Sans effet fonctionnel (l'ordre relatif seul compte), mais un nom de validateur qui ment est un ERR-138 en germe. Renommer en `nonNegativeInt`.
- **F-5 — JSDoc trompeuse de `src/lib/api-utils.ts`.** L'en-tête annonce « 3. Route-specific statusMap matches (**checked first**) » et « Route-specific mappings (**highest priority**) » (l.76, 137) alors que le bloc P2002 → 409 s'exécute **avant** (l.112-135). Sans effet aujourd'hui sur les paliers (les deux gardes empêchent tout P2002 d'atteindre la route), mais un futur développeur qui ajoutera une entrée de map pour requalifier un P2002 constatera qu'elle ne s'applique jamais. **Corriger la doc, pas le code** (l'ordre actuel est le bon).
- **F-6 — Commentaire périmé dans un test.** `previsions-validations-http-mapping.test.ts:202` cite encore `{ match: "meme ordre d'evaluation", status: 422 }` ; le rectificatif est trois lignes plus bas (l.211-214), donc lisible, mais la citation initiale est fausse.

## Conformité R1-R11 (niveau sprint)

| Règle | Verdict | Élément décisif |
|---|---|---|
| R1/R2 | OK | Enums importés (`StatutVaguePrevue`, `TailleGranule`, `Permission`), aucune chaîne en dur |
| R3 | OK | `seuilTonnes` Decimal en Prisma → `Decimal` moteur → `number` DTO, cascade complète et typée |
| R4 | OK | `replacePaliersRemise` = `deleteMany` + `createMany` dans **une** transaction, validations avant écriture |
| R5 | N/A | Aucun Dialog touché |
| R6 | OK | `text-danger`, `text-muted-foreground`, `border-border` — aucune couleur en dur |
| R7 | OK | `seuilTonnes` NOT NULL, décidé au schéma |
| R8 | OK | `PalierRemise.siteId` présent, `createMany` l'écrit (l.512), lecture filtrée par scénario vérifié site |
| **R9** | **Partiel** | voir R-1 |
| **R10** | **OK, exemplaire** | La migration `20260804100000_palier_remise_seuil_tonnes` est un `RENAME COLUMN` (pas DROP/ADD — ERR-140 évitée pour la 3e fois, et l'en-tête dit pourquoi le réflexe a été appliqué **avant** de vérifier que la table était vide), garde-fou `RAISE EXCEPTION` **dans** la migration, idempotence par `IF EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS`, refus argumenté d'insérer les données métier d'un client. C'est la meilleure migration du module. |
| **R11** | OK | Aucun identifiant dans la migration ni dans le code du sprint ; les 13 fichiers contenant un motif `postgres://…:…@` sont tous antérieurs et légitimes (placeholder factice de `CLAUDE.md`, credentials éphémères du service container de `ci.yml:38`, doc de remédiation) |
| Mobile first | OK | `grid-cols-1 sm:grid-cols-3`, cibles tactiles 44 px (`h-11 w-11`), sous réserve M-2 |
| i18n | OK | Parité fr/en stricte, 0 clé morte, 0 chaîne visible en dur |
| TS strict | OK | Aucun `any` introduit |

## Story par story

| Story | Verdict | Commentaire |
|---|---|---|
| **PR2sept.1 — ADR §13.1-13.8** | **VALIDÉ** | §13.7 tranche `sacsSaisis` **avant** le code, avec le bon argument (deux grandeurs, pas deux règles) et une conséquence métier écrite noir sur blanc. §13.8 tranche les 3 corollaires sans les laisser à l'appréciation. Seul défaut : `ADR-053:1973` nomme `mettreAJourPaliersRemise`, fonction inexistante (`replacePaliersRemise`). |
| **PR2sept.2 — schéma + migration** | **VALIDÉ** | Réserve de review de story levée. R10 exemplaire (ci-dessus). |
| **PR2sept.3 — moteur** | **VALIDÉ** | Réserves M1/M2 fermées : `appliquerTauxRemise` extraite, décision hissée hors boucle, test d'ordre discriminant vérifié par mutation (§C2 du rapport de test, les deux falsifications tombent). Le @tester a en outre fermé un 3e trou réel (arrondi amont sur `coutBrutFCFA`, prouvé par une mutation qui survivait aux 2 378 assertions) — bonne prise. |
| **PR2sept.4 — UI** | **VALIDÉ AVEC RÉSERVE** | Réserves fermées (saisie décimale, erreur au champ fautif, `aria-describedby` sans id orphelin, 400). Reste M-2 (vérification 360 px en navigateur réel). |

---

## À transmettre au @knowledge-keeper (liste précise)

1. **ERR-143 → statut `CORRIGÉ` / `FERMÉ`, sévérité relevée de « Moyenne » à « Haute ».** Fiche `ERRORS-AND-FIXES.md:55-79`. Aujourd'hui encore : « **Sévérité :** Moyenne — ouvert, décision produit/schéma à trancher avant PR3 » et « **Fix :** Aucun à ce stade ». C'est faux depuis ce sprint. Rédaction à porter, conformément à ADR-053 §13.6 :
   - sévérité **Haute** — ce n'était pas un écart de calcul mais une règle des exigences **impossible à saisir depuis l'application** ;
   - les **options (a) et (b)** de la fiche sont **toutes deux écartées** (elles raisonnent en sacs et par granulométrie ; la spécification raisonne en tonnes et par vague) ;
   - fix réel : `seuilSacs` → `seuilTonnes` (migration `20260804100000_palier_remise_seuil_tonnes`), `determinerPourcentageRemise(tonnageVagueT, paliers)`, décision hissée au niveau vague dans `route-orchestration.ts:405-409`, 3 contournements de recette supprimés ;
   - **la leçon**, qui est la vraie valeur de la fiche et n'est consignée nulle part ailleurs : *quand un harnais de recette doit transformer ses propres entrées pour que le moteur les accepte, cette transformation est un défaut de modèle, jamais une adaptation d'unité anodine. La question à poser devant toute ligne de ce type : « un utilisateur peut-il produire cette entrée depuis un formulaire ? » Si non, la recette ne teste pas le produit.*
2. **Double numérotation ERR-158** — `ERRORS-AND-FIXES.md:3025` (« Dupliquer un prédicat métier entre deux fichiers… ») et `:3065` (« Une exigence produit "le grand tableau peut rester réservé au bureau"… »). Deux entrées distinctes sous le même numéro. Renuméroter l'une des deux et propager les renvois (`:3108`, `:3114` et tout renvoi externe).
3. **Référence morte « ADR-053 §7.4 »** — située à `ERRORS-AND-FIXES.md:3114`, c'est-à-dire dans le bloc **Références de la seconde entrée ERR-158** (et non d'ERR-156, contrairement à ce qu'indiquait la commande de review). Vérifié : l'ADR-053 ne contient qu'un titre `## 7. Recette`, **aucune sous-section numérotée 7.x**. La cible réelle est le **§7.4 du document d'exigences fonctionnelles du module**, qui n'est pas dans le dépôt. Corriger en « §7.4 des exigences fonctionnelles (document hors dépôt) », et non en pointant l'ADR.
4. **`ADR-053:1973` nomme `mettreAJourPaliersRemise`** — la fonction s'appelle `replacePaliersRemise` (`src/lib/queries/previsions-scenarios.ts:448`). L'ADR étant append-only et propriété de @architect, l'inscription se fait côté knowledge-keeper (note de correspondance), avec demande d'amendement à @architect.
5. **Leçon i18n à consigner** (soulevée par le @tester, §B2, non encore fichée) : *deux tests de parité structurelle fr/en ne protègent contre aucun libellé faux — « Seuil (sacs) » / "Threshold (bags)" passe la parité sans broncher. La seule protection réelle contre une régression de libellé métier est une assertion de composant sur le texte exact* (`parametres-tab.test.tsx`, `queryByLabelText(/^Seuil \(sacs\)$/i)).not.toBeInTheDocument()`). Même famille qu'ERR-127/ERR-148 : une garantie apparente qui ne discrimine pas.
6. **Leçon « couplage par sous-chaîne d'un message utilisateur »** (M-1) : *un mapping HTTP fondé sur `message.includes(...)` transforme un texte d'UI en contrat d'API. Il oblige à figer une orthographe (ici : à laisser un message français sans accents) et casse en silence si quelqu'un corrige ce texte. Le remède est une erreur métier typée portant son statut, jamais un commentaire d'avertissement.* Trois reviews consécutives l'ont signalé sans qu'il soit fiché.

## Ce qui reste ouvert après ce sprint

| # | Point | Sévérité | Pour qui |
|---|---|---|---|
| 1 | Run complet `npx vitest run` + `npm run build` sur l'arbre **final** (post-corrections de réserves) — R9 | Faible | @tester avant clôture |
| 2 | Vérification 360 px en Chromium réel du bloc « Paliers de remise » (ERR-157) | Moyenne | @developer |
| 3 | Refonte `PREVISIONS_STATUS_MAP` → erreur métier typée (`BusinessRuleError { status }`) | Moyenne | @architect / backlog |
| 4 | `validation.ts:68` : sortir `seuilTonnes=` du message utilisateur | Faible | polissage |
| 5 | `previsions.schema.ts:38` : renommer `positiveInt` → `nonNegativeInt` | Faible | polissage |
| 6 | `api-utils.ts` : corriger la JSDoc sur la priorité P2002 / statusMap | Faible | polissage |
| 7 | `previsions-scenarios.ts:503` : ajouter `siteId` au `deleteMany` (défense en profondeur) | Faible | polissage |
| 8 | Course entre deux PUT concurrents sur les paliers | Faible — **dette acceptée** | aucun, sauf occurrence réelle |
