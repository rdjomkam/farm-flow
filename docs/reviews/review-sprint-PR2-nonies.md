# Review Sprint PR2-nonies — La logistique doit entrer dans les dépenses

**Sprint :** PR2-nonies
**Story revue :** PR2non.4 (Review)
**Reviewer :** @code-reviewer
**Date :** 2026-08-04
**Périmètre :** `src/lib/previsions/route-orchestration.ts` (correctif logistique → base de répartition), `src/lib/previsions/__tests__/recette/route-orchestration-baseRepartition.recette.test.ts` (nouveau, 209 tests), `src/lib/previsions/__tests__/recette/route-orchestration-builder.ts` (mappage postes/journal/apports), `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts` (Section D, tautologie retirée)
**Documents lus :** CLAUDE.md (R1-R11), ADR-053 §5.5/§7/§11-§14, ERR-142, ERR-157, `prisma/fixtures/previsions/README.md`, `docs/tests/rapport-story-PR2non.1.md`, `docs/tests/rapport-story-PR2non.3.md`, `docs/sprints/SPRINT-PR2-nonies-PREVISIONS.md`

## 1. Le correctif — `route-orchestration.ts`

**Localisation du fix : correcte.** La logistique du mois (`logistiqueMois.sousTotalFCFA`) est injectée comme une entrée supplémentaire du paramètre `chargesLogistiqueEtExploitation` de `calculerBaseRepartition` (charges.ts, moteur pur), avec `inclusBaseRepartition: true` construit en dur côté appelant — jamais une addition après coup sur `depensesFCFA`. C'est exactement la formule de la décision 6 / §5.5 de l'ADR-053 (`base_repartition = logistique + charges_exploitation + journal_op_general`). Vérifié dans `charges.ts` : `calculerBaseRepartition` est **inchangée** — elle fait toujours `Σ(charges filtrées inclusBaseRepartition) + Σ(journal OPERATIONNEL non affecté)`, sans aucune modification. `logistique.ts`, `vague.ts`, `budget.ts` : recherchés, aucune modification. Le moteur reste la seule source de la formule (ERR-142 respectée à la lettre).

**Ordre du calcul dans la boucle mensuelle : correct, aucun cycle introduit.** À l'intérieur de l'itération `m` : `sacsAlimentsDuMois`, `quantitePoissonsKg`, `quantiteAlevinsNb` (tous précalculés par les maps de l'étape 1, en dehors de la boucle mensuelle) → `logistiqueMois` calculé → `baseRepartitionFCFA` calculé en consommant `logistiqueMois.sousTotalFCFA` → `quotePartParVague` calculé en consommant `baseRepartitionFCFA`. Aucune de ces grandeurs ne dépend d'un mois `m' ≠ m` ni d'un résultat calculé plus tard dans la boucle (`soldeFCFA`, `pointBas` restent des passes séparées après la boucle, étapes 5-6). Le réordonnancement est un simple déplacement en avant du calcul déjà existant de `baseRepartitionFCFA`/`quotePartParVague`, rien de plus.

**Pas de double comptage.** `depensesFCFA = coutAlimentsFCFA + coutAlevinsFCFA + baseRepartitionFCFA + investissementsFCFA` — la logistique n'entre dans `depensesFCFA` que via `baseRepartitionFCFA`, une seule fois. Aucun autre site du fichier n'ajoute `logistiqueMois.sousTotalFCFA` séparément (vérifié par lecture complète du fichier). Le champ `mois[].logistique.sousTotalFCFA` exposé en sortie reste une donnée d'affichage indépendante, jamais resommée dans le calcul.

**Decimal :** aucun `number`/flottant natif introduit dans la cascade monétaire — `logistiqueMois.sousTotalFCFA` est un `Decimal` produit par `calculerLogistiqueMensuelle`, l'objet littéral `{ montantFCFA: ..., inclusBaseRepartition: true }` respecte le type `ChargePourBaseInput`.

**Documentation en tête de bloc (lignes 722-736) : exemplaire.** Le commentaire cite explicitement l'ADR-053 §5.5, justifie `inclusBaseRepartition: true` comme non négociable (« la logistique calculée par le moteur est TOUJOURS incluse »), et référence ERR-142. Aucune réserve.

**Verdict section 1 : conforme, sans réserve.**

## 2. La recette (`route-orchestration-baseRepartition.recette.test.ts`, `route-orchestration-builder.ts`, `route-orchestration.recette.test.ts` Section D)

### 2.1 Non-tautologie (ERR-142/règle de recette)

Vérifié par lecture intégrale du nouveau fichier :
- Section F compare `mois[m].logistique.sousTotalFCFA`, `.baseRepartitionFCFA`, `.depensesFCFA` à `fixture.logistique.sousTotal[m]`, `fixture.depenses.baseRepartition[m]`, `fixture.resultats.depensesTotales[m]` — valeurs lues dans le JSON du jeu d'or, jamais recalculées. L'identité supplémentaire (`baseRepartitionFCFA == logistique + Σ chargesExploitation`) recombine des grandeurs déjà toutes issues de la sortie réelle du moteur ou de l'entrée fixture — pas une réimplémentation de la formule de production.
- Section G additionne des séries déjà présentes dans le jeu d'or (agrégation par somme, jamais une formule métier réinventée) et compare à des constantes de la story elles-mêmes dérivées du jeu d'or (garde-fou anti-faute-de-frappe explicite, ligne 136-154, qui vérifie que les constantes codées en dur correspondent aux blocs `fixture.cumuls`/`fixture.depenses`/`fixture.logistique`).
- Le compte de tests (209 = 170 Section F + 36 Section G + 3 V1) est vérifiable arithmétiquement et correspond exactement au chiffre annoncé par le rapport PR2non.3 — aucune divergence trouvée.
- Section D de `route-orchestration.recette.test.ts` : la tautologie interne signalée par l'audit PR2non.1 (`apportsFCFA` dégénérait systématiquement à 0, rendant l'assertion `resultatFCFA == revenus + apports − depenses` incapable de détecter une omission) est bien remplacée par deux comparaisons externes au jeu d'or (`apportsFCFA == resultats.apportsCapital[m]`, `revenusFCFA + apportsFCFA == resultats.totalEntrees[m]`) — vérifié par lecture directe des lignes 328-342.

**`entreesModele.chargesExploitation` → `scenario.postes` : LÉGITIME, pas un court-circuit.** C'est une vraie entrée de saisie du classeur (`Dépenses!A14:V21`), jamais une sortie recalculée — le mappage restaure une entrée manquante du harnais, il ne fabrique aucune valeur attendue.

**`resultats.investissements`/`resultats.apportsCapital` → `scenario.journal`/`scenario.apports` : jugement tranché — LÉGITIME, pas un court-circuit, mais rangement fragile.** Ces deux séries sont des décisions de financement du scénario (capex, apports), jamais des sorties d'un calcul du moteur — elles n'ont structurellement aucun autre site de saisie dans le classeur que la même zone que les résultats agrégés (artefact de `extract-golden.py`, déjà documenté avant ce sprint dans `orchestration.ts`, lignes 517-521/575/579 selon le rapport PR2non.1). Le raisonnement est cohérent avec le traitement déjà appliqué à `investissementsFCFA`/`apportsFCFA` dans `orchestration.ts` (le fichier de recette jumeau, en place depuis PR2bis.4) — ce sprint ne fait qu'étendre au niveau `route-orchestration-builder.ts` un précédent déjà validé, pas une décision nouvelle. **Ce n'est donc pas un court-circuit** au sens de la règle de non-tautologie (la valeur ne sert jamais de résultat ATTENDU, seulement de composition d'ENTRÉE), mais c'est une dépendance structurelle fragile : si `extract-golden.py` change un jour de convention de rangement JSON (par exemple en déplaçant ces deux séries hors de `resultats` vers un futur bloc `entreesModele.financement`), rien dans le code actuel ne signale que ce déplacement casserait le mappage — seul le commentaire JSDoc (ligne 50-51 du builder) documente cette dépendance, aucun test ne l'exerce directement. Risque mineur, déjà atténué par le fait que la relecture de ce point est explicitement demandée par la story et tranchée deux fois de façon cohérente (PR2bis.4 puis ce sprint).

### 2.2 Drapeaux d'opt-out de falsification (`inclureChargesExploitation`/`inclureInvestissements`/`inclureApports`)

**Défaut sûr : oui.** Les trois flags de `BuildScenarioOptions` défaultent à `true` (`options.inclureChargesExploitation ?? true`, etc.) — un test futur qui ne les mentionne pas obtient le comportement fidèle au jeu d'or. Le JSDoc de chaque flag (lignes 260-276 du builder) est sans ambiguïté : « réservé EXCLUSIVEMENT à la preuve par falsification — jamais un moyen normal de construire un scénario de recette ».

**Risque résiduel identifié, à traiter :** rien dans le code n'empêche mécaniquement qu'un futur test légitime (pas une falsification) passe `inclureChargesExploitation: false` par erreur de copier-coller depuis le bloc de falsification, et se retrouve avec une recette silencieusement aveugle sur ce terme — exactement le risque nommé par la consigne de review. Le seul garde-fou actuel est documentaire (JSDoc), pas structurel. Deux garde-fous simples, peu coûteux, réduiraient ce risque sans toucher au comportement actuel :
1. Renommer les trois flags avec un préfixe explicite (`_FALSIFICATION_ONLY_inclureChargesExploitation` ou équivalent), ou les regrouper dans un objet distinct `optionsFalsification?: { ... }` séparé de `BuildScenarioOptions` — rend l'usage accidentel visible au site d'appel, pas seulement dans la JSDoc.
2. Une recherche de test qui grep les usages non commentés `inclure(ChargesExploitation|Investissements|Apports)\s*:\s*false` en dehors des fichiers `*falsification*`/du seul point où la campagne PR2non.3 les active pourrait être un garde-fou peu coûteux, mais reste optionnel — **recommandation non bloquante**, à traiter en priorité basse.

### 2.3 Falsification (ERR-157 — un test qui ne prouve pas ce qu'il prétend)

Preuve chiffrée et documentée dans `rapport-story-PR2non.3.md`, revérifiée point par point ici :
- Falsification #1 (retrait de la logistique de `route-orchestration.ts`) : 140 échecs, tous localisés dans le nouveau fichier, Sections A-E de `route-orchestration.recette.test.ts` restent à 0 échec (confirme que ces sections sont structurellement aveugles au bug, cohérent avec l'audit PR2non.1).
- Falsification #2 (mapping des charges d'exploitation forcé à `[]`) : 141 échecs, une assertion de plus qu'en #1 (le terme `chargesExploitation` de l'identité disparaît en plus de la logistique).
- Restauration vérifiée par `git diff --stat` vide sur `route-orchestration.ts` après chaque falsification, suite complète repassée à 0 échec après restauration.

**Seuil largement dépassé** (demande de la story : ~10 ; obtenu : 140/141). La méthodologie est saine : falsifier le code de production réel, jamais falsifier uniquement le test.

**Grandeurs encore non couvertes par une falsification explicite, à noter comme limite honnête (pas un défaut) :** la campagne ne falsifie que deux défauts (logistique, mapping des charges) — elle ne prouve pas, par construction, l'absence de tout autre défaut de composition résiduel (ex. un futur oubli d'un poste `LOGISTIQUE` porté par `PostePrevision` plutôt que calculé par le moteur, ou un double comptage caché ailleurs). C'est cohérent avec la portée de la story (corriger et recetter *ce* bug précis), pas un manque de cette review.

### 2.4 Grandeurs par vague sans colonne golden (`quotePartChargesFCFA`/`coutProductionFCFA`)

Jugement : **couverture honnête et suffisante, correctement qualifiée.** Le rapport et le code du test documentent explicitement, sans ambiguïté, que ces deux grandeurs n'ont aucune colonne dans le classeur, et distinguent clairement deux niveaux de preuve :
1. Constantes de la story, re-vérifiées par un script Python indépendant **hors du moteur et hors du dépôt de test** (jamais un recalcul de `calculerQuotePartVague` dans le test lui-même) — c'est la garantie la plus forte disponible en l'absence de jeu d'or, et elle est correctement qualifiée comme telle dans le JSDoc (lignes 262-283 du fichier de test).
2. Une identité de cohérence interne (`Σ quotePartChargesFCFA == Σ baseRepartitionFCFA`), explicitement documentée comme dépendant d'une propriété du planning (aucun mois à zéro vague active) — la consigne demandait explicitement « sinon dis explicitement qu'elles ne sont couvertes que par cohérence interne et pourquoi », et c'est fait, au mot près.

Rien à redire sur ce point : c'est la meilleure preuve atteignable sans falsifier le classeur source lui-même, et la limite est déclarée, pas dissimulée.

**Verdict section 2 : conforme, avec une réserve mineure non bloquante (2.2) et une observation de robustesse (2.1, dépendance de rangement JSON).**

## 3. Conformité R1-R11

| Règle | Statut | Constat |
|---|---|---|
| R1 (enums MAJUSCULES) | OK | `TypePostePrevision.CHARGE_EXPLOITATION`, `CategorieJournalPrevu.INVESTISSEMENT`, `TypeApportCapital.CAPITAL` — tous importés depuis `@/types`, jamais de chaîne en dur. |
| R2 (import des enums) | OK | Vérifié dans `route-orchestration-builder.ts` et `route-orchestration.ts` : aucun literal string en lieu d'enum. |
| R3 (Prisma = TypeScript identiques) | OK | Aucun changement de schéma dans ce sprint ; les types `PostePrevisionPourCalcul`/`JournalDepensePrevuePourCalcul`/`ApportCapitalPourCalcul` utilisés par le builder sont ceux déjà exportés par `previsions-scenario-loader`, non modifiés. |
| R4 (opérations atomiques) | Sans objet | Aucune écriture DB dans ce périmètre — fonctions pures/orchestration lecture seule. |
| R5 (DialogTrigger asChild) | Sans objet | Aucun composant UI touché par ce sprint. |
| R6 (CSS variables du thème) | Sans objet | Idem. |
| R7 (nullabilité explicite) | OK | Aucun nouveau champ de schéma introduit ; `TypeApportCapital` fixé à `CAPITAL` par défaut est documenté et justifié (le jeu d'or ne distingue pas capital/crédit dans la série agrégée), sans conséquence sur les grandeurs testées (vérifié : `calculerProjectionScenario` ne filtre jamais par ce champ). |
| R8 (siteId partout) | Sans objet | Aucun nouveau modèle. |
| R9 (tests avant review) | OK | `npx vitest run` (285 fichiers / 9228 tests / 0 échec) et `npm run build` (succès) exécutés et documentés dans le rapport PR2non.3, avant la demande de review. |
| R10 (correctifs de données = migrations) | Sans objet | Aucun correctif de données dans ce périmètre. |
| R11 (aucun secret en dur) | OK | Recherche ciblée sur `src/lib/previsions/` (fichiers touchés) : aucun motif de secret, URL de connexion ou clé trouvé. |

**TypeScript strict :** aucun `any` introduit dans les fichiers du périmètre (vérifié par lecture complète).
**Prisma / requêtes optimisées :** sans objet, aucune requête DB dans ce périmètre (le moteur et l'orchestration restent des fonctions pures/lecture de fixture in-memory).

## 4. Écarts documentaires déjà connus — tranchés

### 4.1 Sept lignes d'apports en capital en base pour `EXCEL-V12` (6 attendues)

**Analyse.** `calculerProjectionScenario` (ligne 625, `scenario.apports.map(...)`) somme tous les apports d'un mois sans jamais faire d'hypothèse sur le nombre de lignes qui composent ce total — le moteur est indifférent à ce qu'un même montant mensuel soit porté par une ligne ou par plusieurs. Les deux lignes signalées au 2026-09-04 (4 000 000 « Vente Vague 26-04 » + 2 000 000 « Fonds propres ») totalisent 6 000 000, cohérent avec ce qu'une ligne unique de 6 000 000 aurait porté à ce même mois. Le contrôle de fin de sprint confirme par ailleurs le total inchangé (30 000 000) et 0 écart sur les douze indicateurs de cumul.

**Verdict : défaut de saisie de l'exploitant (granularité de traçabilité comptable), pas un symptôme de bug de calcul.** Scinder un apport en deux lignes pour distinguer sa provenance (vente d'une vague antérieure vs. fonds propres) est une pratique de saisie légitime et même souhaitable pour l'auditabilité — le moteur ne l'interprète pas comme un montant différent tant que la somme du mois est correcte. Aucun risque de calcul n'en découle.

**Action recommandée (priorité basse, hors périmètre code) :** documenter dans le contrôle de fin de sprint (ou dans un futur audit `scripts/audits/`) que « 6 apports » doit être lu comme « 6 apports décrits par le plan de référence », et que le nombre réel de lignes en base peut légitimement diverger tant que la somme par mois est inchangée — pour éviter qu'un futur contrôle « nombre de lignes == 6 » échoue à tort sur une saisie par ailleurs correcte. **Deux libellés (« Vente Vague 26-03 », « Vente Vague 26-04 ») ressemblent toutefois à des produits de vente plutôt qu'à de vrais apports en capital : à faire confirmer par l'exploitant.**

### 4.2 README fixtures — « 6 postes non nuls » vs 4 réellement non nuls

**Vérifié directement dans `prisma/fixtures/previsions/plan-v12-corrige.json`** (lignes 498-715) : le bloc `entreesModele.chargesExploitation` porte bien **8** postes (Main-d'œuvre, Énergie, Eau, Entretien, Produits vétérinaires, Loyer, Communication, Frais financiers), dont **4 seulement sont non nuls** sur les 21 mois (Main-d'œuvre 500 000, Énergie 120 000, Produits vétérinaires 250 000, Loyer 110 000 → total mensuel 980 000 × 21 = 20 580 000, exact). Le README (`prisma/fixtures/previsions/README.md`, ligne 84) annonce « 6 postes non nuls » — c'est une erreur factuelle, le total FCFA cité (20 580 000) restant lui exact.

**Action à faire (priorité basse, documentaire uniquement, aucun impact code) :** corriger `prisma/fixtures/previsions/README.md` ligne 84, remplacer « 6 postes non nuls » par « 4 postes non nuls ».

## 5. Risques résiduels

1. **(Priorité basse)** Flags d'opt-out de falsification (`inclureChargesExploitation`/`inclureInvestissements`/`inclureApports`) sans garde structurel autre que la JSDoc — recommandation §2.2 (renommage explicite ou isolement dans un objet dédié), non bloquant, à traiter à la discrétion de @developer lors d'une prochaine story touchant ce fichier.
2. **(Priorité basse)** Dépendance implicite entre le rangement JSON de `extract-golden.py` (`resultats.investissements`/`resultats.apportsCapital`) et le mappage du builder — aucun test ne casserait silencieusement si ce rangement changeait un jour ; actuellement sans conséquence car aucun changement n'est prévu, mais à garder en mémoire si `extract-golden.py` est retouché.
3. **(Priorité basse, documentaire)** README fixtures ligne 84 à corriger (« 6 postes non nuls » → 4).
4. **(Priorité basse, documentaire)** Contrôle de fin de sprint « 6 apports = 30 000 000 » à préciser pour ne pas confondre nombre de lignes et montant total.
5. **(Priorité basse, structurelle, hors périmètre de ce sprint)** `ParametresPrevision` ne porte aucun champ de trésorerie d'ouverture ; `route-orchestration.ts` fige `new Decimal(0)`. Sans conséquence sur `EXCEL-V12` (valeur attendue = 0), mais empêcherait de représenter un scénario futur à trésorerie initiale non nulle.

Aucun de ces cinq points n'affecte la correction du calcul de production ni la validité de la recette livrée par ce sprint.

## Verdict final

## VALIDÉ AVEC RÉSERVES

Le correctif (`route-orchestration.ts`) est placé au bon endroit, respecte fidèlement l'ADR-053 §5.5, ne modifie aucune fonction du moteur pur, n'introduit aucun double comptage ni aucun flottant natif, et le réordonnancement de la boucle mensuelle est sans cycle ni régression silencieuse. La recette qui l'accompagne (209 nouveaux tests) est non tautologique, comble exactement le trou identifié par l'audit PR2non.1, et sa capacité de détection est prouvée par une campagne de falsification chiffrée (140/141 échecs) qui cible le code de production réel. Les grandeurs par vague sans colonne golden sont couvertes honnêtement et qualifiées comme telles. R1-R11 respectées dans le périmètre de ce sprint.

Les réserves sont toutes de priorité basse, aucune n'est bloquante pour la clôture du sprint :

1. Corriger `prisma/fixtures/previsions/README.md` (ligne 84) : « 6 postes non nuls » → 4 postes non nuls sur 8 lignes.
2. Préciser le critère de fin de sprint « 6 apports = 30 000 000 » pour ne pas confondre nombre de lignes et montant total (le cas 7 lignes / 30 000 000 constaté sur `EXCEL-V12` est une saisie légitime, pas un bug), et faire confirmer par l'exploitant les deux libellés « Vente Vague 26-0x » rangés en apports en capital.
3. (Optionnel, à la discrétion de @developer) Isoler ou renommer explicitement les trois flags d'opt-out de falsification du builder de recette pour réduire le risque qu'un futur test légitime les active par erreur.

Aucune de ces réserves ne nécessite de rouvrir `route-orchestration.ts` ni la campagne de recette déjà livrée.
