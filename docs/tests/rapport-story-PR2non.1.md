# Rapport story PR2non.1 — Audit des court-circuits fixture dans `__tests__/recette/`

**Sprint :** PR2-nonies — « La logistique doit entrer dans les dépenses »
**Story :** PR2non.1 (TEST — audit uniquement, aucun code de production modifié)
**Auteur :** @tester
**Date :** 2026-08-04
**Réfs :** ADR-053 §7 (recette), §11 (amendement), ERR-142, ERR-157, `prisma/fixtures/previsions/README.md`

## Méthode

Lecture ligne à ligne des six fichiers du périmètre, complétée par une vérification directe dans
`src/lib/previsions/route-orchestration.ts` (lignes 647-780) pour établir, avec certitude et sans
hypothèse, ce que la route calcule réellement — condition nécessaire pour juger si un test la
recette ou la contourne. Chaque valeur lue depuis le JSON de fixture a été tracée jusqu'à son usage
(entrée de composition vs. valeur de comparaison attendue) et classée LÉGITIME ou COURT-CIRCUIT.

**Constat préalable, structurant pour toute la suite : il existe deux fichiers nommés
« orchestration » qui ne testent pas la même chose.**

| Fichier | Rôle |
|---|---|
| `src/lib/previsions/route-orchestration.ts` | Code de **production**, appelé par la route API `GET /api/previsions/scenarios/[id]/calculer`. C'est lui qui porte le bug du sprint (ligne 655 : `calculerBaseRepartition(chargesDuMois, journalDuMois)` — **n'ajoute jamais `logistiqueMois.sousTotalFCFA`** ; ligne 738 : `depensesFCFA` composé sans logistique non plus). |
| `src/lib/previsions/__tests__/recette/orchestration.ts` | Fichier de **test**, qui recompose à la main (mais en appelant les vraies fonctions pures) une chaîne `logistique → baseRepartition → dépenses → trésorerie`, via `buildChaineFinanciereCalendrier`. Cette recomposition **additionne correctement** la logistique (`sousTotalLogistiqueFCFA + chargesExpParMois`, ligne 555) — mais cette addition correcte vit **uniquement dans le test**, jamais dans `route-orchestration.ts`. |

Conséquence directe, vérifiée par grep exhaustif : `plan-v12-corrige.recette.test.ts` et
`annexe-b-corrigee.recette.test.ts` n'importent et n'appellent **que** des fonctions de
`__tests__/recette/orchestration.ts` — **jamais** `calculerProjectionScenario` (la fonction publique
de `route-orchestration.ts`). Ces deux fichiers recettent donc uniquement le **moteur pur +
une composition alternative écrite dans le test**, jamais le code de production qui sert la route API.
Le seul fichier qui appelle réellement `calculerProjectionScenario` est
`route-orchestration.recette.test.ts` — et une recherche exhaustive (`grep -n "logistique\|sousTotal"`)
y montre **zéro occurrence** : ni `MoisProjectionResult.logistique`, ni `.baseRepartitionFCFA`, ni
`.depensesFCFA` n'y sont jamais comparés à une valeur du jeu d'or. C'est la cause directe pour
laquelle le bug de logistique a traversé toute la recette (1270+ tests) sans être détecté : la seule
couche qui appelle le code fautif ne teste pas les champs fautifs, et les couches qui testent les
champs corrects ne passent pas par le code fautif.

## Tableau — valeurs lues depuis la fixture JSON

| Fichier:ligne | Valeur | Verdict | Détail |
|---|---|---|---|
| `helpers.ts` (tout le fichier) | Typage `GoldenFixture` (`entreesModele`, `entrees`, `besoinsAliments`, `logistique`, `depenses`, `resultats`, `cumuls`) + `loadGoldenFixture` | **LÉGITIME** | Pas de calcul : chargement JSON + déclarations de type. Les blocs `resultats`/`depenses`/`logistique`/`besoinsAliments` sont légitimement lus **comme valeurs attendues de comparaison** (`expectMontantFCFA`/`expectEntierExact`/`expectKgApprox`) dans les `*.recette.test.ts` — c'est la définition même d'une recette, pas un court-circuit. |
| `orchestration.ts:86` | `objectifTonnes.times(a.sacsParTonneStandard).times(a.poidsSacKg)` (`entreesModele.aliments`, `entreesModele.planVagues[].objectifTonnes`) | **LÉGITIME** | Entrées de modèle (§ ADR-053, décision 1) : tonnage visé et coefficient de besoin biologique, jamais des sorties. |
| `orchestration.ts:152-157` (`buildPaliersRemise`) | `entreesModele.paliersRemise` | **LÉGITIME** | Vraie entrée de paramétrage (`Paramètres!B16:C19`). |
| `orchestration.ts:230-231, 306` | `entreesModele.parametresScenario.margeSecuriteAlevinsPct`, `vague.poissonsAVendreNb` | **LÉGITIME** | Entrées ; le résultat (`alevinsACommanderNb`) est calculé via `calculerAlevinsACommander` (moteur réel), **jamais** lu depuis `vague.alevinsACommanderNb` — correctif historique ERR-141/ERR-142 déjà appliqué et documenté dans le JSDoc. |
| `orchestration.ts:294-333` (`buildLogistiqueCalendrier`) | `entreesModele.transport` (capacités/coûts unitaires) | **LÉGITIME** | Entrée de paramétrage, jamais une sortie. |
| `orchestration.ts:319` | `sacsTotalCalcule[m]` (paramètre de fonction, sortie de `buildBesoinsAlimentsCalendrier`) | **LÉGITIME** | Explicitement **pas** lu depuis `fixture.besoinsAliments.sacsTotal` — c'est la sortie déjà produite par le moteur réel, documenté en JSDoc lignes 256-263 comme un « renforcement de chaîne » délibéré. |
| `orchestration.ts:324` | `fixture.entrees.ventesT[m]` → `quantitePoissonsKg` | **LÉGITIME (par nécessité, gap documenté)** | Aucune des 12 fonctions ADR-053 §4 n'agrège un tonnage de récolte par mois calendaire (`calculerRevenuPrevu` opère par vague). Documenté honnêtement en JSDoc lignes 269-273 comme une limite assumée, pas masquée. |
| `orchestration.ts:561` | `vague.coutAlevinsFCFA` (`entreesModele.planVagues`) | **LÉGITIME** | Vraie entrée de modèle (0 sur les 19 vagues, `alevinsAchetes="NON"`), jamais calculée par aucune fonction du moteur (documenté ADR-053, README fixtures). |
| `orchestration.ts:575` | `fixture.resultats.investissements[m]` | **LÉGITIME (mais mal rangé dans le JSON)** | Décision de financement du scénario (capex), jamais dérivée d'un calcul — vit sous `resultats` uniquement par un artefact de structure d'export (`extract-golden.py`), documenté explicitement en JSDoc lignes 517-521. |
| `orchestration.ts:579` | `fixture.resultats.apportsCapital[m]` | **LÉGITIME (idem)** | Même raisonnement : décision de financement, jamais une sortie de calcul. |
| `orchestration.ts:579, 586` | `fixture.entrees.chiffreAffaires[m]` → `revenusFCFA` | **LÉGITIME (par nécessité, gap documenté)** | Même limite que `ventesT` ci-dessus : aucune fonction n'agrège un revenu par mois calendaire à partir d'un tonnage vendu sans fabriquer un `effectifFinal` factice. Documenté en JSDoc lignes 509-516. |
| `orchestration.ts:548-555` (`baseRepartitionFCFA`) | Calculée depuis `sousTotalLogistiqueFCFA` (**paramètre**, sortie moteur) + `chargesExpParMois` (**entrée**, `entreesModele.chargesExploitation`) | **LÉGITIME comme calcul isolé** — mais voir la mise en garde ci-dessous : cette composition correcte n'existe que dans ce fichier de test, jamais dans `route-orchestration.ts`. Ne pas confondre « le test prouve que la formule composée à la main est correcte » avec « le test prouve que le code de production applique cette formule » — ce n'est **pas** le cas. |
| `route-orchestration-builder.ts` (tout le fichier) | Construction de `ScenarioPourCalcul` depuis `entreesModele.{parametresScenario, aliments, planVagues, transport}` | **LÉGITIME** | Toutes les valeurs utilisées sont des entrées de modèle (§ ADR-053 décision 1). Champs de remplissage explicitement documentés comme non consommés (`effectifAlevinsParVague: 0`, `poidsMoyenInitialG: new Decimal(1)`, `sacsCalcules: 0` pour les surcharges) — jamais une fixture-sortie réinjectée, juste des valeurs neutres pour satisfaire un type. |
| `route-orchestration-builder.ts:226-227` | `postes: [], journal: [], apports: []` | **GAP STRUCTUREL, PAS UN COURT-CIRCUIT AU SENS STRICT — mais critique pour la conclusion** | `entreesModele.chargesExploitation` (6 postes non nuls, vraie entrée disponible dans la fixture) **n'est jamais mappé** vers `scenario.postes`. Conséquence : même une fois le bug de logistique corrigé dans `route-orchestration.ts`, `route-orchestration.recette.test.ts` ne pourrait **toujours pas** prouver `baseRepartitionFCFA = logistique + chargesExploitation` de bout en bout au niveau production, puisque `chargesDuMois` serait toujours vide (`calculerBaseRepartition([], ...)`). Voir conclusion. |
| `route-orchestration.recette.test.ts` Section C (`resultatFCFA == revenusFCFA + apportsFCFA - depensesFCFA`) | Aucune lecture fixture ; identité interne | **NON-COURT-CIRCUIT MAIS TAUTOLOGIE** | `depensesFCFA` et `resultatFCFA` viennent tous deux de la **même** exécution de `calculerProjectionScenario` (route-orchestration.ts lignes 738/744) — l'identité est vraie par construction du code testé, qu'il contienne ou non le bug de logistique. Cette section ne peut, par construction, jamais détecter que `depensesFCFA` omet un poste : elle ne compare à aucune valeur externe (golden). |
| `route-orchestration.recette.test.ts` Sections A/C/D/E | `logistique`, `baseRepartitionFCFA`, `depensesFCFA` | **ABSENCE TOTALE D'ASSERTION** (vérifié par `grep -n "logistique\|baseRepartitionFCFA\|depensesFCFA\|sousTotal"` → 2 correspondances, toutes dans la Section C tautologique ci-dessus) | Ce n'est pas un court-circuit (rien n'est lu depuis la fixture pour ces champs), c'est un **trou de couverture total** sur exactement les trois champs concernés par le bug du sprint, dans le seul fichier qui exécute le code de production fautif. |
| `plan-v12-corrige.recette.test.ts` / `annexe-b-corrigee.recette.test.ts` (tout le fichier) | N'appellent que `__tests__/recette/orchestration.ts`, jamais `calculerProjectionScenario` | **HORS PÉRIMÈTRE DE PRODUCTION** | Ces deux fichiers recettent le moteur pur (à 0 écart, confirmé) mais ne peuvent, par construction, jamais détecter un bug de composition situé dans `route-orchestration.ts` — ils ne l'appellent jamais. |

## Conclusion — le bug de logistique n'est pas isolé, il est structurellement inévitable avec ce harnais

**Le bug de logistique n'est pas un accident isolé : c'est un cas particulier prévisible d'une lacune
structurelle du harnais de recette, exactement celle qu'ERR-142 avait déjà nommée et que la story
PR2bis.4 pensait avoir refermée.**

Trois constats s'enchaînent :

1. **Aucun court-circuit fixture classique n'explique le bug.** L'audit ligne par ligne ne trouve
   aucune valeur de sortie du moteur réinjectée depuis la fixture pour masquer artificiellement le
   défaut de logistique — les lectures fixture identifiées sont toutes des entrées légitimes (ou des
   limites documentées honnêtement, jamais dissimulées).
2. **La cause réelle est une bifurcation de couverture.** Deux implémentations indépendantes de la
   même formule (`baseRepartition = logistique + chargesExploitation`) coexistent : celle du fichier
   de test (`__tests__/recette/orchestration.ts`, correcte, prouvée à 0 écart) et celle du code de
   production (`route-orchestration.ts`, fautive). Le fichier qui exécute réellement le code de
   production (`route-orchestration.recette.test.ts`) ne teste jamais les trois champs concernés
   (`logistique`, `baseRepartitionFCFA`, `depensesFCFA`) — sa seule assertion qui les touche
   (Section C) est une tautologie interne au code testé, incapable par construction de détecter un
   terme manquant.
3. **Corriger uniquement le bug de logistique laisserait la même classe de défaut ouverte pour
   n'importe quel autre poste de `baseRepartition`.** Même après correctif, `route-orchestration-
   builder.ts` ne mappe jamais `entreesModele.chargesExploitation` vers `scenario.postes` : un futur
   bug qui omettrait les charges d'exploitation (au lieu de la logistique) de `baseRepartitionFCFA`
   traverserait la recette exactement de la même façon, invisible pour la même raison structurelle.

**Ce que cela signifie pour le reste du sprint (hors périmètre de cette story, à l'attention de
@developer/@architect) :** corriger `route-orchestration.ts` (ajouter `logistiqueMois.sousTotalFCFA`
à `baseRepartitionFCFA`/`depensesFCFA`) est nécessaire mais insuffisant pour clore le risque. Il faut
en plus :
- Étendre `route-orchestration.recette.test.ts` (Section D est le point d'ancrage naturel, elle
  itère déjà `resultat.mois[m]`) avec des assertions sur `.logistique.sousTotalFCFA`,
  `.baseRepartitionFCFA` et `.depensesFCFA` contre `fixture.logistique.sousTotal[m]`,
  `fixture.depenses.baseRepartition[m]` et `fixture.resultats.depensesTotales[m]` respectivement —
  ce sont des cibles déjà prouvées correctes par `orchestration.ts`/`*.recette.test.ts`, donc pas de
  nouvelle recette à inventer, seulement un branchement manquant.
- Mapper `entreesModele.chargesExploitation` vers `scenario.postes` dans
  `route-orchestration-builder.ts`, faute de quoi l'extension ci-dessus resterait partielle (elle ne
  prouverait que le terme logistique, jamais le terme charges d'exploitation, de la même formule).

Ces deux actions sont des recommandations pour les stories suivantes du sprint, pas un engagement de
code de cette story (TEST, audit uniquement — aucune ligne de production ni de test modifiée ici).
