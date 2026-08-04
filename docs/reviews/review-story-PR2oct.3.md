# Review — Story PR2oct.3 (MOTEUR)

## Périmètre

Revue par lecture directe des fichiers (accès `Read`/`Grep`/`Glob` uniquement — pas d'accès `git diff` dans cet environnement ; le cadrage s'appuie sur la comparaison entre le contenu actuel des fichiers et les descriptions exhaustives de `docs/analysis/pre-analysis-story-PR2oct.3.md` §1/§8, considérées comme l'état de référence avant story).

Fichiers de production examinés : `src/lib/previsions/route-orchestration.ts:562-583` ; `src/lib/previsions/logistique.ts` (intégralité, vérifié intouché) ; `src/lib/queries/previsions-scenario-loader.ts:140-153, 325-335` ; `src/lib/validation/previsions.schema.ts:58-82, 228-248` ; `src/lib/queries/previsions-vagues.ts:61-91, 163-308, 644-694` ; `src/lib/queries/previsions-scenarios.ts:52-91, 178-227, 400-446` ; `src/components/previsions/api-types.ts:51-54, 159-164` ; `src/components/pages/previsions-scenario-detail-page.tsx` ; les routes API `previsions/vagues-prevues/[id]/scinder`, `vagues-prevues/[id]`, `scenarios/[id]/vagues`, `scenarios/[id]/parametres`.

Fichiers de test examinés : `recette/route-orchestration-builder.ts:208-211` ; `recette/route-orchestration.recette.test.ts:142-152, 306-331` ; `recette/orchestration.ts:509-535` ; `recette/helpers.ts:32-63` ; `__tests__/route-orchestration-alevins-achetes.test.ts` (intégralité) ; `src/lib/queries/__tests__/previsions-vagues.test.ts` ; `route-orchestration-detail-consommation.test.ts`, `route-orchestration-remise-ordre.test.ts`, `src/__tests__/lib/previsions-route-orchestration.test.ts`.

Références lues intégralement : CLAUDE.md, ERR-160/ERR-170, ADR-053 §14 (14.1 à 14.7), pré-analyse et rapport de test de la story, README des fixtures.

## Checklist R1-R11

| Règle | Verdict | Justification |
|---|---|---|
| R1 — Enums MAJUSCULES | Conforme | Aucun nouvel enum ; `alevinsAchetes`/`alevinsAchetesParDefaut` sont des `Boolean`. |
| R2 — Import des enums | Conforme | Aucune chaîne littérale d'enum en dur dans le périmètre. |
| R3 — Prisma = TypeScript identiques | Conforme | `VaguePrevuePourCalcul.alevinsAchetes: boolean` reflète fidèlement la colonne ; `api-types.ts` porte les deux champs au bon type. |
| R4 — Opérations atomiques | Conforme | `updateVaguePrevue` reste un `updateMany({ where: { id, siteId } })` (`previsions-vagues.ts:221-234`) ; `scinderVaguePrevue` et `genererPlanVaguesPrevues` restent dans une `$transaction` unique, `createMany` en bloc (lignes 679-691). Aucune régression d'atomicité. |
| R5 — DialogTrigger asChild | Non concerné | Aucun composant UI Radix touché. |
| R6 — CSS variables du thème | Non concerné | Aucun style. |
| R7 — Nullabilité explicite | Conforme | Les deux champs restent `Boolean` non nullables ; le moteur n'introduit aucune ambiguïté ternaire. |
| R8 — siteId partout | Conforme | Toutes les requêtes touchées filtrent `siteId` : `chargerScenarioPourMoteur` (`previsions-scenario-loader.ts:221-265`), `createVaguePrevue`/`updateVaguePrevue`/`scinderVaguePrevue`/`genererPlanVaguesPrevues`, `createScenario`/`updateParametresPrevision`. |
| R9 — Tests avant review | Conforme | `npx vitest run` (2 458/2 458 recette ; 8 957/8 957 suite complète, 3 passages identiques) et `npm run build` exécutés et rapportés avant review (`docs/tests/rapport-story-PR2oct.3.md` §3.1, §7). |
| R10 — Correctifs de données = migration | Non concerné | Aucun correctif de données dans cette story. |
| R11 — Aucun secret en dur | Conforme | Aucun identifiant, URL ou token dans le périmètre. |

## Constats par sévérité

### Critique
Aucun.

### Haute
Aucun. Le point le plus sensible de la story — la non-contamination de la logistique — est correctement traité.

### Moyenne

**M1 — `scinderVaguePrevueSchema` valide un champ `alevinsAchetes` par enfant que la couche query ignore silencieusement.**
`src/lib/validation/previsions.schema.ts:232-247` : `scinderVaguePrevueSchema` réutilise `createVaguePrevueSchema`, qui porte désormais `alevinsAchetes: z.boolean().optional()` (ligne 238). Un client API peut soumettre `{ scissions: [{ ..., alevinsAchetes: true }] }` : Zod l'accepte, mais `scinderVaguePrevue` (`previsions-vagues.ts:257-308`) ignore le champ et écrit systématiquement `alevinsAchetes: parent.alevinsAchetes` (ligne 289) — comportement voulu et correctement testé (`previsions-vagues.test.ts:260-289`). Le problème n'est pas le comportement métier (correct), mais le **contrat d'API trompeur** : le champ est absorbé sans erreur ni avertissement — exactement la catégorie de « maillon silencieux » recherchée. Recommandation : `.omit({ alevinsAchetes: true })` sur le schéma dérivé, ou documentation explicite dans le JSDoc. Non bloquant (aucune fixture ni test ne peut être trompé, la règle métier est correcte et testée dans les deux sens).

### Basse

**B1 — Réserve sur la remise (§5.3 des exigences), correctement documentée, décision assumée.**
Le commentaire `route-orchestration.ts:571-578` explique clairement pourquoi aucune remise n'est appliquée au coût d'achat des alevins, avec renvoi à ADR-053 §13.3 et ERR-160. C'est le bon choix technique compte tenu de l'absence totale de donnée de recette capable de discriminer une formule candidate d'une autre — inventer une réutilisation du `PalierRemise` aurait été une décision d'architecture non vérifiable. À faire remonter par le PM comme point de backlog explicite : si un futur besoin exige une remise alevins, il faudra d'abord une donnée de recette qui l'exerce.

## Points de vérification explicite (synthèse)

1. **Formule `coutAlevinsFCFA`** — conforme à ADR-053 §14.2 : `vague.alevinsAchetes ? Decimal(alevinsACommanderNb).times(prixAlevinUnitaireFCFA) : Decimal(0)` (`route-orchestration.ts:579-581`). Le `nb_alevins` est bien `alevinsACommanderNb` (marge de sécurité incluse), conforme au §5.3. `Decimal` préservé de bout en bout, jamais de détour par `number` avant la sortie DTO.
2. **Absence de remise** — décision jugée correcte et bien commentée (voir B1).
3. **Logistique non gatée — POINT CRITIQUE, vérifié conforme.** `logistique.ts` intégralement intouché (aucune occurrence de `alevinsAchetes` ; `LogistiqueMensuelleInput` n'a aucun paramètre de gating). `alevinsACommanderNb`/`alevinsNbParMois` restent alimentés **inconditionnellement** (ligne 583, hors de la branche conditionnelle du coût) ; `quantiteAlevinsNb` (ligne 720) et l'appel à `calculerLogistiqueMensuelle` (lignes 722-729) n'ont reçu aucune modification. Le cas synthétique D (`route-orchestration-alevins-achetes.test.ts:155-171`) le démontre chiffré : `voyagesAlevins = 1`, `sousTotalFCFA = 45 000` alors que le coût d'achat vaut 0 sur le même mois. C'est la garantie exigée par §14.5.
4. **Propagation du défaut** — les quatre points d'application sont corrects : `createVaguePrevue` (`data.alevinsAchetes ?? scenario.parametres.alevinsAchetesParDefaut`, lignes 176-195) ; `updateVaguePrevue` (édition libre, ligne 232) ; `scinderVaguePrevue` (copie stricte du **parent**, lignes 271-289, testée dans les deux sens) ; `genererPlanVaguesPrevues` (`alevinsAchetes: parametres.alevinsAchetesParDefaut` au `createMany`, ligne 687, sans requête supplémentaire). Aucun site de création oublié (grep exhaustif : `createVaguePrevue`, `scinderVaguePrevue`, `genererPlanVaguesPrevues`, `createScenario` — les quatre seuls sites d'écriture du module).
5. **Maillons silencieux** — un seul trouvé, non bloquant (M1). Tous les autres portent le champ de bout en bout : `parametresPrevisionCreateSchema` (schema.ts:81) → `CreateScenarioPrevisionDTO.parametres` (scenarios.ts:70) → `createScenario` (223-225) ; `createVaguePrevueSchema` (schema.ts:238) → `CreateVaguePrevueDTO` (vagues.ts:67) → `createVaguePrevue` (195) ; loader (`previsions-scenario-loader.ts:335`) → `route-orchestration.ts:579` → `VagueProjectionResult`/`MoisProjectionResult` (201, 221) → page passthrough (233, 285) → `api-types.ts:54, 162`.
6. **Qualité des tests** — point le plus fort de la story. Les +80 assertions de recette comparent `projection.coutAlevinsFCFA` à `vague.coutAlevinsFCFA` (valeur de fixture, jamais recalculée — lignes 146-148) et `moisCourant.coutAlevinsFCFA` à `fixture.depenses.alevins[m]` (lignes 325-331) : aucune réimplémentation du moteur. **Cas A recalculé indépendamment par le reviewer** : `alevinsACommanderNb = ceil(10 000 × 1,10) = 11 000`, `11 000 × 70 = 770 000` FCFA — **confirmé exact**. Le cas D prouve la non-contamination de la logistique. La preuve de régression contrôlée (`rapport-story-PR2oct.3.md` §3.2 : restauration temporaire de l'ancienne formule, 76/80 assertions en échec, écart chiffré ~2 887 500 FCFA, puis `git diff --stat` vide vérifié) confirme que les assertions sont bien discriminantes.
7. **Modifications de tests existants** — légitimes, pas des contournements. Les trois ajouts mécaniques `alevinsAchetes: false` sont des corrections de compilation pures : aucun de ces fichiers n'asserte `coutAlevinsFCFA`, mettre `false` ne peut masquer aucune régression sur le terme sous test. L'ajout de `seedParametres("s1")` (`previsions-vagues.test.ts:124`) est nécessaire car `createVaguePrevue` exige désormais `scenario.parametres` (garde explicite lignes 183-185) — adaptation légitime au changement de contrat, pas un masquage.
8. **Débordement de périmètre** — `previsions-scenario-detail-page.tsx` est un passthrough strict : seuls ajouts, `alevinsAchetesParDefaut` au mapping DTO des paramètres (ligne 233) et `alevinsAchetes` au mapping DTO des vagues (ligne 285), nécessaires à la compilation. Aucun composant, aucune logique de rendu, aucun toggle introduit — la story UI PR2oct.4 restait entièrement à faire.

## Verdict

**VALIDÉ AVEC RÉSERVES**

Réserve unique, non bloquante : **M1** — le schéma Zod de scission accepte un champ `alevinsAchetes` ensuite silencieusement ignoré (comportement métier correct, contrat d'API trompeur).

Le point critique de la story (non-contamination de la logistique par le drapeau) est traité de façon exemplaire, avec un test dédié qui casserait immédiatement toute régression future. La cécité de recette dénoncée par ERR-170 / ADR-053 §14.7 est correctement comblée (+80 assertions, prouvées discriminantes par régression contrôlée). La propagation du défaut de scénario est complète et testée aux quatre points d'application, y compris le cas subtil de la scission. Aucune violation R1-R11 constatée.
