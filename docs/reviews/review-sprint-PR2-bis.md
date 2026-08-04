# Review Sprint PR2-bis — Dettes du module Prévisions à solder avant PR3

**Reviewer :** @code-reviewer
**Sprint :** PR2-bis
**Verdict global : VALIDÉ AVEC RÉSERVES**

Aucune réserve Critique ni Haute. Une divergence d'architecture (`PalierRemise`) est identifiée comme **bloquante avant toute story PR3 qui s'appuierait sur des remises multi-granulométrie réelles**, mais ne bloque pas la clôture de PR2-bis elle-même (elle est une découverte documentée, pas une régression introduite par ce sprint).

## Méthode

Vérification par lecture directe du code (pas seulement des rapports) : `src/lib/queries/previsions-vagues.ts`, `src/app/api/previsions/scenarios/[id]/vagues/generer/route.ts`, `src/components/previsions/generer-plan-dialog.tsx`, `src/app/api/previsions/_shared.ts`, `src/lib/module-nav-items.ts`, `src/components/layout/{farm-sidebar,farm-bottom-nav}.tsx`, `src/messages/{fr,en}/navigation.json`, `docs/decisions/ADR-053-module-previsions.md` (§11), `docs/sprints/SPRINT-PR2-bis-PREVISIONS.md` (intégral), les 4 rapports de test PR2bis.1-4, les 2 pré-analyses PR2bis.1-2. Recherches exhaustives par grep sur `any`, secrets, `MappingRapprochement`/`ClotureMois`.

---

## Point de gouvernance — réserve 2 de PR2 : SOLDÉE

`docs/sprints/SPRINT-PR2-bis-PREVISIONS.md` a été lu intégralement. **Aucune note de clôture rédigée par un agent développeur n'y figure** : le contenu du fichier est exclusivement du texte de cadrage (contexte, exigences, critères d'acceptation) — cohérent avec une rédaction par @pre-analyst/@project-manager/@status-updater, pas par @developer en cours de mission. Contraste net avec PR2, où quatre agents avaient écrit directement leurs statuts de clôture dans ce même type de fichier.

**Verdict : réserve soldée pour ce sprint.** Recommandation : maintenir la règle telle quelle — elle a fonctionné dès qu'elle a été rappelée explicitement à chaque agent spawné, ce qui confirme que le problème de PR2 était un défaut de rappel, pas un défaut de règle. Aucun amendement nécessaire.

---

## Story PR2bis.1 — Internationalisation — VALIDÉ

- Constat corrigé (0 fichier sur 25 utilisait `next-intl`, pas « 4 sur 34 ») — les 4 fichiers citant `next-intl` étaient des tests le mockant de façon vestigiale.
- `src/messages/{fr,en}/previsions.json` : 299/299 clés, parité stricte vérifiée par le tester avec un script indépendant.
- Le point le plus risqué de la pré-analyse (désynchronisation `src/messages/index.ts` / `src/i18n/request.ts`, cette dernière étant le point de chargement réel au runtime) a été traité par un vrai garde-fou, prouvé par cassage volontaire puis restauration — c'est le niveau de preuve attendu, pas une simple déclaration.
- Chaînes résiduelles en dur : 0 trouvée en dehors de JSDoc et de `placeholder="0"` (neutre).
- Aucun indice d'affaiblissement de test : les 8 fichiers de test à risque ont été mis à jour avec un mock `next-intl` qui résout les vraies clés depuis le JSON français (pas un pass-through `key => key`), donc les assertions testent toujours un vrai contenu.
- Réserves résiduelles, non bloquantes : 2 clés mortes (`page.detailTitle`/`page.backToList`) ; les blocs `describe` de parité stricte du test de complétude itèrent toujours sur une liste figée recopiée à la main (dette préexistante, non aggravée au-delà de l'ajout d'un cas identique).

**Verdict story : VALIDÉ.**

---

## Story PR2bis.2 — Câblage `genererPlanEmpoissonnement` — VALIDÉ

Vérifié directement dans le code, pas seulement dans le rapport de test :
- `genererPlanVaguesPrevues` : une seule transaction Prisma englobant chargement + annulation partielle éventuelle + `createMany` — R4 respecté, pas de boucle de `create()` unitaires.
- `chargerPourGenerationPlan` filtre par `siteId` ; la route thread `auth.activeSiteId` sur GET et POST, jamais un `siteId` venant du payload client — R8 respecté.
- Aucune fonction `deleteVaguePrevue` introduite — confirmé par grep.
- Mode « remplacer » : l'annulation ne peut atteindre que les `VaguePrevue` de statut `PLANIFIEE` et non rattachées, filtrées depuis une lecture cohérente dans la même transaction. **Aucune `VaguePrevue` rattachée à une vague réelle ne peut être détruite** — garantie centrale de l'ADR décision 2 tenue. Le libellé UI évite le mot trompeur « remplacer ».
- Codes : `plusHautNumeroCode` ignore silencieusement les codes non conformes au motif `V<entier>` (la scission produit des codes du type `V2a`), sans lever ; aucune collision possible car la numérotation repart toujours du maximum déjà utilisé, annulées comprises.
- `<DialogTrigger asChild>` confirmé — R5 respecté.
- Aperçu (GET) et écriture (POST) partagent les mêmes fonctions de chargement et de calcul théorique : **la divergence entre le décompte annoncé et le résultat réel est structurellement impossible**, ce qui est plus fort qu'une simple duplication testée après coup.

**Verdict story : VALIDÉ.** Réserve mineure non bloquante : nommage `positiveInt` trompeur (accepte 0) dans `previsions.schema.ts` — préexistant.

---

## Story PR2bis.3 — `margeSecuriteAlevinsPct` effective — VALIDÉ

- `calculerAlevinsACommander` en Decimal strict, aucun `Math.ceil` résiduel confirmé par lecture.
- Distinction D/E cohérente : `tonnageCibleKg`/`calculerRevenuPrevu` restent sur D (poissons à vendre), `coutAlevinsFCFA` **et** `alevinsNbParMois` (le second site, logistique — celui qu'un correctif partiel oublie typiquement) basculés sur E (alevins à commander).
- Recette augmentée de 842 à 880 (+38 = 19 vagues × 2 fixtures), tolérance zéro sur un entier.
- Textes UI relus : n'affirment plus l'inertie du champ et scopent correctement sa portée (coût et logistique alevins seulement, jamais aliment ni revenu) — pas de sur-promesse.
- Un seul site de conversion d'unité de chaque côté (fixture : fraction → échelle 0..100 ; moteur : division par 100).

**Verdict story : VALIDÉ.**

---

## Story PR2bis.4 — Extension de la recette à l'orchestration — VALIDÉ, avec un point d'architecture à trancher

- 390 tests ajoutés, recette 880 → 1270, 0 écart. **Vérification de non-tautologie** : les valeurs attendues viennent bien des fixtures JSON du jeu d'or, jamais recalculées dans le test — la règle sacrée du répertoire de recette est respectée.
- Les deux ajustements de conception documentés (somme des ceils mensuels ≠ ceil de cycle ; calibrage du seuil de remise pour rendre le test du Grain 2 non vide) sont des corrections honnêtes de la conception du test, pas des accommodements pour le faire passer.
- Aucun écart trouvé dans `route-orchestration.ts` : ERR-138/139/140 restent correctement corrigés.

**Point d'architecture `PalierRemise.seuilSacs`** — confirmé après relecture indépendante : `route-orchestration.ts` applique un seul tableau `scenario.paliersRemise` identiquement aux 3 granulométries, alors que le jeu d'or décide sa remise par tonnage réel de la vague, ce qui revient à un seuil différent par granulométrie (coefficients 8/18/50). Structurellement non reproductible avec le schéma `PalierRemise` actuel (un seul scope par scénario).

**Position du reviewer** : ce n'est **pas** une régression de ce sprint — le modèle date de PR1/PR2 et n'avait jamais été recetté à ce niveau, précisément parce que la recette de `route-orchestration.ts` n'existait pas. Ce n'est pas un blocage pour clore PR2-bis. En revanche, **c'est bloquant avant toute story PR3 introduisant une vraie remise multi-granulométrie** : trancher entre (a) assumer que la remise se négocie par granulométrie en pratique et documenter l'écart au classeur comme choix produit, ou (b) scoper `PalierRemise` par `AlimentPrevision` (migration de schéma, à faire trancher par @architect/@db-specialist).

**Verdict story : VALIDÉ.**

---

## Statut des réserves de PR2

| # | Réserve PR2 | Statut |
|---|---|---|
| 1 | Dette i18n (Moyenne) | **Soldée** — story .1 |
| 2 | Gouvernance `docs/sprints/*.md` (Moyenne) | **Soldée** — voir section dédiée |
| 3 | `margeSecuriteAlevinsPct` inerte (Moyenne) | **Soldée** — story .3 |
| 4 | `genererPlanEmpoissonnement` non câblée (Basse-Moyenne) | **Soldée** — story .2 |
| 5 | 2-3 check-then-write résiduels (R4 strict) dans les queries PR2.1 | **Non traitée, toujours présente** — `createVaguePrevue`, `scinderVaguePrevue`, `rattacherVaguePrevue`. Sévérité Basse inchangée : vérifications d'existence de parent avant écriture, pas des races métier réelles (la contrainte `@unique` sur `Vague.vaguePrevueId` protège le cas concurrent le plus sensible). Hors périmètre déclaré de PR2-bis. |
| 6 | Mapping HTTP par sous-chaîne de message | **Aggravée comme annoncé** — une 6e entrée ajoutée à `PREVISIONS_STATUS_MAP` (`"ParametresPrevision absent"` → 422). Toujours Basse, mais le mécanisme grossit sans typage. Recommandation inchangée : typer en `ValidationError` avant toute story qui retouche `validation.ts`. |
| 7 | `module-nav-items.ts` mort | **Non traitée, toujours mort** — le seul fichier qui le référence dans `src/` est un test de nettoyage. Hors périmètre. |
| 8 | 1 entrée de navigation au lieu de 5 | **Inchangée** — un seul item `href: "/previsions/scenarios"`. Info, pas d'action requise. |
| — | ERR-134 obsolète | **Confirmé obsolète** — `modules.adminCommissions`/`adminRemises` existent en fr/en dans `navigation.json` et `common.json`. À mettre à jour. |

---

## Périmètre — respecté

Recherche exhaustive de `MappingRapprochement`/`ClotureMois`/`rapprochement`/`reprevision` dans `src/lib` et `src/app` : aucune occurrence en dehors du client Prisma généré et des types miroirs, posés par PR1 et non touchés. Aucune vue de comparaison, reprévision glissante ni export n'est apparue. Périmètre tenu.

---

## Checklist R1-R11

| Règle | Statut | Note |
|---|---|---|
| R1 (enums MAJUSCULES) | OK | Aucune valeur en minuscule introduite |
| R2 (import enums) | OK | Aucune chaîne d'enum en dur dans le nouveau code |
| R3 (Prisma = TS) | OK | |
| R4 (opérations atomiques) | OK pour le nouveau code, réserve 5 inchangée | `genererPlanVaguesPrevues` en transaction unique exemplaire ; 2-3 résidus Basse de PR2.1 persistent, hors périmètre |
| R5 (DialogTrigger asChild) | OK | Confirmé dans `generer-plan-dialog.tsx` |
| R6 (CSS variables du thème) | OK | 0 couleur hex en dur |
| R7 (nullabilité) | OK | Aucun nouveau champ nullable ambigu |
| R8 (siteId) | OK | `auth.activeSiteId` threadé bout en bout ; `chargerPourGenerationPlan` filtre par siteId |
| R9 (tests avant review) | OK | 4 rapports de test avec sorties de commandes réellement rejouées, pas déclaratives |
| R10 (correctif de données = migration) | OK | Aucune migration de correctif dans ce sprint |
| R11 (aucun secret en dur) | OK | Aucune occurrence liée à ce sprint |

**Aucun `any` introduit** — vérifié par grep sur `src/lib/previsions/` et `src/components/previsions/`.

---

## Tableau des réserves priorisées

| # | Sévérité | Réserve | Bloquant avant PR3 ? |
|---|---|---|---|
| 1 | **Moyenne — à trancher avant PR3** | `PalierRemise.seuilSacs` scopé par scénario, incompatible avec une remise réelle par granulométrie | **Oui, avant toute story PR3 touchant aux remises multi-granulométrie** |
| 2 | Basse | 2-3 check-then-write résiduels R4 dans `previsions-vagues.ts` | Non |
| 3 | Basse | Mapping HTTP par sous-chaîne, aggravé d'une entrée | Non, mais avant la prochaine story qui touche `validation.ts` |
| 4 | Basse | `module-nav-items.ts` toujours mort | Non |
| 5 | Info | 1 entrée de navigation au lieu de 5 | Non |
| 6 | Basse, documentaire | ERR-134 obsolète | Non |
| 7 | Cosmétique | 2 clés i18n mortes | Non |

---

## Verdict final

**VALIDÉ AVEC RÉSERVES.** Les 4 stories livrées sont chacune de bonne qualité, avec des preuves vérifiables (garde-fou cassé puis restauré, script de parité indépendant, non-tautologie de la recette confirmée par lecture des fixtures) plutôt que de simples déclarations. La réserve de gouvernance de PR2 est soldée. La seule réserve qui mérite un arbitrage avant PR3 est le scope de `PalierRemise` — découverte honnête de la story TEST, pas un défaut introduit par ce sprint, mais à trancher avant qu'une story de remises réelles ne s'appuie dessus sans le savoir.

**Évolution mesurée** : recette du moteur 842 → 880 → **1270 tests, 0 écart** ; suite complète 7000 → **7487 tests, 0 échec**.
