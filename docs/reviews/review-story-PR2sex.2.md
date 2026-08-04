# Review de story — PR2sex.2 (Sprint PR2-sexies)

**Verdict : VALIDÉ AVEC RÉSERVES.** Aucune réserve Critique ni Haute.

**Méthode et limite assumée.** Revue par lecture directe du code (pas seulement des rapports) : `src/lib/previsions/aliments.ts` (`calculerDetailConsommationMensuelle` et son voisinage, `repartirSacsEntreArticles`), `src/lib/previsions/route-orchestration.ts` (accumulateur `sacsEffectifsCycleParAlimentMoisPosition`, boucle mensuelle, `MoisProjectionResult`), `src/lib/previsions/index.ts`, `src/components/previsions/projection-types.ts`, `src/app/api/previsions/scenarios/[id]/calculer/route.ts`, `src/components/pages/previsions-scenario-detail-page.tsx`, `src/lib/previsions/__tests__/aliments.test.ts`, `src/lib/previsions/__tests__/route-orchestration-detail-consommation.test.ts` (5 tests, lus intégralement), `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts` (Section E et cumuls), ADR-053 §4/§7/§11/§12, ERRORS-AND-FIXES (ERR-138, 139, 148, 149, 155, 156, 159), la pré-analyse, le rapport de test et la review PR2-quinquies.

**Limite R9 assumée sans détour** : ce reviewer n'avait pas d'outil shell. Aucun `npx vitest run` ni `npm run build` rejoué par lui. Chiffres repris des agents (recette 2300/2300 ; suite ~8738/8789 avec 4-10 échecs flaky dans 5 fichiers `*-form-dialog.test.tsx` hors périmètre, verts en isolé ; build exit 0), cohérence croisée code/rapport uniquement, pas vérification indépendante.

## 1. ROUND vs CEIL — non-contamination : VALIDÉ
`calculerBesoinAlimentMensuel` (`aliments.ts:55-75`, ceil l.64-66, « sacs à acheter ») et `calculerDetailConsommationMensuelle` (`aliments.ts:422-445`, « sacs consommés, indicatif ») sont strictement séparées. La nouvelle fonction ne prend que `sommeSacsEffectifsCycle` et `repartitions` — jamais `quantiteKg`, `poidsSacKg`, ni le résultat de `calculerBesoinAlimentMensuel` (signature `DetailConsommationCycleInput`, `aliments.ts:408-413`) : aucun appel croisé. Un commentaire (`aliments.ts:354-360`) nomme le risque et renvoie à ERR-138/ERR-139. Le test `NON-CONTAMINATION CEIL/ROUND` (`aliments.test.ts:529-546`) construit un cas (101 sacs, 33 %) où CEIL et ROUND divergent (34 vs 33) et vérifie le ROUND — preuve par construction, pas déclaration.

## 2. sum-then-round — accumulateur hors du moteur pur : VALIDÉ, décision défendable
La somme est faite dans `sacsEffectifsCycleParAlimentMoisPosition` (`route-orchestration.ts:372`, alimenté l.519-530), le round une seule fois par cellule (l.672). La fonction pure ne protège donc pas seule l'invariant — c'est l'accumulateur. Acceptable à condition d'être couvert par un test exerçant l'accumulateur : c'est le cas dans `route-orchestration-detail-consommation.test.ts` — test 1 (deux vagues, même mois) prouve `ROUND(Σ)=1 !== Σ ROUND()=0` par une assertion explicite `expect(...).not.toBe(0)` (l.148), pas seulement `toBe(1)` : le test discrimine réellement (piège ERR-148 évité) ; test 2 : trois vagues coïncidentes ; test 3 : cas non coïncident en contraste ; tests 4-5 : `dureeCycleMoisFigee = 4` et `= 1`. Même exercice sur la fonction pure (`aliments.test.ts:486-527`, `not.toBe(sommeDesArrondisIndividuels)` l.522).
**Point signalé, non défaut** : un second niveau d'accumulation (`route-orchestration.ts:681-682`) somme des valeurs déjà arrondies entre `alimentId` partageant une `tailleGranule` — non atteignable aujourd'hui (`@@unique([scenarioId, tailleGranule])`), non testé, correctement signalé par le @tester.

## 3. Cycle paramétrable — VALIDÉ
Aucun `moisCycle1/2/3` ni `3` en dur hors tests (grep). La boucle utilise `vague.dureeCycleMoisFigee` (`route-orchestration.ts:436, 448, 492`). `MoisProjectionResult.detailParVagueSacs` typé `Record<number, Record<string, number>>` (l.271) — clé entière générique. Tests 4-5 exercent réellement 4 et 1. Conforme ADR-053 §12.5.

## 4. ERR-155 — trois séries sur neuf entièrement nulles
`moisCycle1.4mm`, `moisCycle3.2mm`, `moisCycle3.3mm` sont 0/21 sur les deux fixtures, documenté en commentaire (`route-orchestration.recette.test.ts:358-368`). **Ce que la recette prouve** : sur les six autres séries, la formule ROUND est vérifiée à tolérance zéro contre le classeur, mois par mois et en cumul (18 assertions de cumul). **Ce qu'elle ne prouve pas** : l'arrondi sur les trois cellules jamais non nulles — 42 assertions `0 == 0`. C'est une propriété du plan réel (le cycle démarre en 2mm/3mm et finit en 4mm), pas une faiblesse du code de recette ; la confiance y repose sur l'identité structurelle du code appelé, jamais sur une valeur observée. Dit sans détour dans le rapport de test et le commentaire du fichier — discipline exigée par ERR-155.

## 5. Gap : rejet 422 pour `RepartitionMoisAliment` incohérent avec `dureeCycleMoisFigee`
`validation.ts` porte `validerSommeRepartitionMoisAliment` (somme à 100 %) mais **aucune fonction ne vérifie la couverture `1..dureeCycleMoisFigee`**. Le moteur traite un mois de cycle absent comme 0 % : pas un crash, un **silence** — un calibre mal configuré produirait un total trop faible sans erreur. **Sévérité Moyenne, non bloquante pour clore la story, à traiter avant PR3** : (a) gap pré-existant, non introduit par PR2sex.2 ; (b) la doctrine 422 est déjà appliquée pour le cas analogue `sacsParTonneStandard === null` (`route-orchestration.ts:393-398`) — le patron existe, il n'est pas étendu ; (c) la pré-analyse l'avait identifié et recommandé de le signaler plutôt que de le traiter ici, ce que le @developer a fait. Pas Basse pour autant : une donnée mal saisie produit un nombre silencieusement faux en production.

## 6. Libellé de cohorte non exposé — dette documentée
Aucun champ ne porte les codes de vagues contributrices. Ce n'est **pas** une reproduction du défaut INDEX/MATCH du classeur : les quantités sont correctement agrégées (§2), seule l'étiquette de traçabilité manque. Dette d'ergonomie, cohérente avec le périmètre moteur. Réserve Basse.

## 7. R11 — aucun secret en dur
`docs/tests/rapport-story-PR2sex.2.md` et la pré-analyse ne citent que des compteurs et des chemins. Conforme à ERR-159.

## 8. R9 — honnêteté sur la limite d'exécution
Voir « Méthode et limite assumée ».

## 9. Qualité — R2, R3, R8, `any`, types
R2 : enums importés depuis `@/types`, aucune chaîne en dur. `any` : aucune occurrence (grep). Types de retour explicites. R3/R8 : non applicables (aucun modèle Prisma nouveau). Barrel `index.ts:21-41` correct. Frontière Decimal→number : DTO en `number` (`projection-types.ts:60`), valeur déjà `.toNumber()` côté moteur — aucune conversion manquante. Server Component intact. **Les six signatures gelées ADR-053 §12.4 lues intégralement, aucune modifiée** ; la nouvelle fonction est strictement additive.

## Non couvert, à ne pas présenter comme couvert
1. `dureeCycleMois = 0` au niveau orchestration (déduit par lecture, non testé).
2. Les trois séries à zéro (§4).
3. L'accumulation de second niveau entre `alimentId` de même `tailleGranule` (l.681-682).
4. `previsions-mensuelles-tab.test.tsx` : fichier non tracké par git, aucun diff possible, vérifié par lecture seule.
5. Aucune validation bloquante pour la couverture de `RepartitionMoisAliment` (§5).

## Réserves priorisées

| # | Sévérité | Réserve | Fichier(s) / ligne(s) | Bloquant ? |
|---|---|---|---|---|
| 1 | Moyenne | Aucune validation ne rejette (422) un `RepartitionMoisAliment` dont la couverture de `moisCycle` est incohérente avec `dureeCycleMoisFigee` ; le mois manquant est traité silencieusement comme 0 %. | `src/lib/previsions/validation.ts` (fonction absente) ; repli `aliments.ts:60-61` et `aliments.ts:60` | Non pour clore la story ; **oui avant PR3** |
| 2 | Basse | Trois séries sur neuf à 0/21 sur les deux fixtures — 42 assertions `0==0`. | `route-orchestration.recette.test.ts:358-368` | Non — documenté, pas dissimulé |
| 3 | Basse | Libellé de cohorte non exposé — dette d'ergonomie assumée. | `route-orchestration.ts` (`MoisProjectionResult`), `projection-types.ts` | Non |
| 4 | Basse | Accumulation de second niveau entre `alimentId` de même `tailleGranule`, non testée — non atteignable en production. | `route-orchestration.ts:681-682` | Non |
| 5 | Info | `dureeCycleMois = 0` non testé au niveau orchestration. | `route-orchestration.ts` (boucle `moisCycle`) | Non |

## Verdict
**VALIDÉ AVEC RÉSERVES.** Le cœur du sprint (distinction ROUND/CEIL, sum-then-round, cycle paramétrable générique) est implémenté correctement et protégé par des tests qui **discriminent réellement** à chaque niveau où le risque existe (fonction pure ET accumulateur) — discipline exigée par ERR-148/149/155, appliquée de façon vérifiable par lecture. Aucune contamination CEIL/ROUND, aucune signature gelée touchée, aucun `3` en dur. La seule réserve Moyenne est pré-existante, analysée et signalée plutôt qu'ignorée, à solder avant PR3.
