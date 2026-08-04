# Review de sprint — PR2-sexies (Détail des sacs par mois de cycle)

**Verdict global : VALIDÉ AVEC RÉSERVES.** Aucune réserve Critique ni Haute *ouverte* à la clôture (ERR-160 est classée Haute mais documente une leçon actée et protégée par des tests, pas un défaut ouvert ; la seule réserve ouverte non-Basse — ERR-162 — est Moyenne, pré-existante, explicitement non bloquante).

**Méthode et limite R9 assumée.** Pas d'outil shell : aucun `npx vitest run` ni `npm run build` rejoué directement. Chiffres repris des rapports `@tester` (`docs/tests/rapport-story-PR2sex.{1,2,3}.md`) et de la review PR2sex.2, croisés entre eux, et complétés par lecture directe du code (`extract-golden.py`, `route-orchestration.ts`, `aliments.ts`, `previsions-mensuelles-tab.tsx`, `projection-types.ts`, `calculer/route.ts`, README des fixtures, ADR-053, ERRORS-AND-FIXES).

## 1. Chaîne de preuve bout en bout
Confirmée, aucun maillon ne compare le moteur à lui-même. `extract-golden.py:334` : `load_workbook(WORKBOOK, data_only=True)` — cellules calculées, jamais recalculées ; `extraire_detail_par_vague(pv)` (l.273-330) lit via `read_row` comme toutes les autres séries (docstring l.276-277). Fixtures : `besoinsAliments.detailParVagueSacs` + métadonnées `$defectueux` pour les lignes 12/16/20, jamais consommées numériquement. Invariance prouvée par diff structurel (`added(1)/removed(0)/changed(0)`) et idempotence sha256. Recette : comparaison à la valeur brute de fixture, le `?? 0` ne s'appliquant qu'au côté moteur. UI (`previsions-mensuelles-tab.tsx:511`) : `accessor: (m) => m.detailParVagueSacs[pos]?.[g] ?? 0` — aucun recalcul côté client ; DTO en passthrough (`calculer/route.ts:64`).

## 2. Le blocage est-il levé ? Oui, partiellement, et le rapport en est honnête
**Prouvé** : 6 des 9 séries sont discriminantes (19/21 valeurs non nulles chacune), vérifiées à tolérance 0, mois par mois et en cumul (18 assertions × 2 fixtures).
**Structurellement non prouvable par le jeu d'or, pour deux raisons distinctes** :
- **ERR-155** : 3 séries (`moisCycle1.4mm`, `moisCycle3.2mm`, `moisCycle3.3mm`) entièrement nulles dans les deux fixtures — 42 assertions `0 == 0`, propriété du plan réel (le cycle démarre en 2/3mm et finit en 4mm), pas un défaut de recette. Documenté en JSDoc (`route-orchestration.recette.test.ts:358-368`).
- **ERR-160** : les 19 vagues ont 19 mois d'empoissonnement distincts — aucune coïncidence multi-vague. `ROUND(Σ)` et `Σ ROUND()` produisent les mêmes valeurs sur les 2300 tests. Le choix a été établi par lecture de la formule brute (`Prévisions!B13 = ROUND(SUMIFS(...))`, un seul `ROUND` enveloppant), puis protégé par 5 tests synthétiques construits pour faire diverger les candidats (assertion `expect(...).not.toBe(0)`, l.148 — discrimination réelle).
**Verdict honnête** : le blocage est levé pour l'existence de la recette et pour 6/9 séries au niveau valeur. Il n'est pas levé pour la propriété d'agrégation elle-même — déplacement partiel du fondement de la preuve, pas élimination complète.

## 3. Défaut INDEX/MATCH — non reproduit, vérifié à deux niveaux
Extraction : lignes 12/16/20 en métadonnée `$defectueux` seulement. Moteur : agrégation `SUMIFS`-like confirmée par tests à deux et trois vagues coïncidentes. Libellé de cohorte absent : dette d'ergonomie assumée, explicitement distincte de la reproduction du défaut (les quantités sont correctement agrégées, seule l'étiquette manque).

## 4. ROUND vs ceil — cohérence de bout en bout
Script : commentaire `extract-golden.py:292-296` (« ROUND, pas CEIL »). Moteur : `calculerBesoinAlimentMensuel` (ceil, `aliments.ts:55-75`) et `calculerDetailConsommationMensuelle` (ROUND, l.408-445) strictement séparées, aucun appel croisé, commentaire nommant ERR-138/139 (l.354-360) ; test de non-contamination sur un cas de divergence (101 sacs, 33 % → 34 vs 33). UI : « indicatif » visible sans ouvrir le popover ; formule nommant `ROUND` et citant la ligne voisine et son `ceil`. Fil rouge tenu à chaque étage, par construction.

## 5. Cohérence documentaire
Écart i18n : 405 (avant) + 3 ajoutées − 2 mortes supprimées = **406**, cohérent avec le recomptage indépendant du @tester ; la mention isolée de « 407 » ne subsiste que dans la pré-analyse, déjà signalée non bloquante. Collision **ERR-158** confirmée (`ERRORS-AND-FIXES.md:3025` et `:3065`), non corrigée, référencée depuis `docs/TASKS.md` et le sprint quinquies. README fixtures / ADR-053 / sprint / ERRORS-AND-FIXES racontent la même histoire sur les points vérifiés — aucune divergence factuelle.

## 6. Réserves héritées de PR2-quinquies — ni aggravées ni touchées
`PalierRemise.seuilSacs` : hors périmètre, `schema.prisma` non modifié. Duplication `calculerBaseRepartition` (`charges.ts:105-120` / `ventilations.ts:152-171`) : ni l'un ni l'autre parmi les fichiers touchés — inchangée.

## 7. Propagation de `detailParVagueSacs` — propre
`route-orchestration.ts:271` (type) → `:735` (assignation) → `calculer/route.ts:64` (passthrough) → `projection-types.ts:60` (type DTO) → `previsions-scenario-detail-page.tsx:155` (passthrough) → `previsions-mensuelles-tab.tsx:489,492,511` (consommation). Un seul point de calcul, une seule sérialisation, aucun maillon orphelin.

## 8. R1-R11
R1 OK (aucun nouvel enum ; `TailleGranule` réutilisé). R2 OK. R3/R4/R5/R7/R8 N/A. R6 OK. R9 partiel (rapports @tester cohérents, non ré-exécutés par ce reviewer). **R10 OK confirmé** : `prisma/migrations/` ne contient aucun `.sql` à sa racine, aucune migration créée par ce sprint. **R11 OK** : les rapports ne citent que compteurs, chemins et hash.

## 9. Cycle paramétrable
Grep hors `__tests__` : aucune valeur en dur, seulement des JSDoc expliquant l'absence. Boucle sur `vague.dureeCycleMoisFigee` (`route-orchestration.ts:436,448,492`). UI : `Object.keys(m.detailParVagueSacs)` (l.489). Testé à `dureeCycleMoisFigee = 4` et `= 1` côté moteur, et à 4 et 1 positions côté UI.

## 10. Chiffres consignés
Recette **2300 / 0 écart** (1904 + 378 Section E + 18 cumuls). Suite complète : deux passages, 11 fichiers en échec chacun, 20 puis 27 tests, tous des timeouts de 5 s, **12/12 verts en isolation** — contention CPU/parallélisme, pas une régression métier. `npm run build` exit 0. Chromium réel sur `EXCEL-V12` : en-tête stable entre `scrollLeft=0` et `1760` (375 px) / `1399` (1280 px), aucun débordement, fond opaque, colonne Total = 1 543 / 867 / – puis 385 / 3 471 / 4 820.

## Réserves priorisées

| # | Sévérité | Réserve | Fichier(s) | Bloquant ? |
|---|---|---|---|---|
| 1 | Moyenne — pré-existante | `RepartitionMoisAliment` sans validation de couverture `1..dureeCycleMoisFigee` (ERR-162) | `src/lib/previsions/validation.ts` (absente) | Non pour ce sprint ; **oui avant PR3** |
| 2 | Haute-documentée | Le jeu d'or ne peut discriminer `ROUND(Σ)` de `Σ ROUND()` (ERR-160) — preuve par lecture de formule + tests synthétiques | `route-orchestration.ts`, `route-orchestration-detail-consommation.test.ts` | Non — mitigé |
| 3 | Basse | 3/9 séries entièrement nulles — 42 assertions `0==0` (ERR-155) | `route-orchestration.recette.test.ts:358-368` | Non |
| 4 | Basse | Libellé de cohorte non exposé | `route-orchestration.ts`, `previsions-mensuelles-tab.tsx` | Non |
| 5 | Info | Collision de numérotation ERR-158 non corrigée | `ERRORS-AND-FIXES.md:3025` et `:3065` | Non |
| 6 | Info | Dette de fiabilité de la suite (flakiness, timeouts 5 s sous charge) | hors `previsions/` | Non |

## Ce que ce sprint prouve
- L'exposition des 9 séries repose sur un jeu d'or réel, extrait des cellules calculées, jamais recalculé — le blocage de PR2-quinquies est levé pour l'existence de la recette.
- 6 des 9 séries vérifiées à tolérance 0 sur des valeurs non triviales, mois par mois et en cumul sur 21 mois × 2 fixtures.
- La distinction `ROUND`/`ceil` est tenue par construction et vérifiée par un test qui fait diverger les candidats.
- Le défaut `INDEX/MATCH` n'est pas reproduit : les quantités agrègent toutes les vagues coïncidentes, prouvé par des tests construisant explicitement des coïncidences.
- Le cycle est paramétrable de bout en bout, vérifié à des valeurs différentes de 3.
- La propagation du champ est propre, sans maillon orphelin ni double sérialisation.

## Ce que ce sprint ne prouve pas
- **Que l'ordre d'agrégation est correct sur la base du jeu d'or.** Le jeu d'or y est structurellement aveugle — la garantie vient exclusivement de la lecture de la formule source et de 5 tests synthétiques. Si ces tests étaient affaiblis ou supprimés, plus aucune protection ne subsisterait, malgré 2300 tests verts.
- **Que l'arrondi est correct sur les 3 séries structurellement nulles** — 42 assertions `0==0` ne testent que l'absence d'erreur d'indexation ; la confiance repose sur l'identité de code avec les 6 autres séries.
- **Qu'un mois de cycle mal configuré dans `RepartitionMoisAliment` sera détecté** (ERR-162 ouvert : couverture incomplète → total silencieusement trop faible, sans rejet).
- **Que le rendu tactile, la collision de popover à 375 px pour ces 9 lignes, et la position 3 du cumul (0/0/7 230) en pixels réels** sont corrects — non vérifiés par mesure visuelle indépendante.
