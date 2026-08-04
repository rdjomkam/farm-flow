# Pré-analyse Sprint PR2-nonies — La logistique doit entrer dans les dépenses

**Auteur :** @pre-analyst — **Date :** 2026-08-04 — **Verdict : GO**

> Note de régularisation : ce document a été rendu par @pre-analyst au @project-manager en début de sprint et retranscrit ici a posteriori par un scribe, le fichier n'ayant pas été écrit lors de la passe initiale. Les chiffres sont ceux constatés avant tout correctif du sprint.

## 0. Périmètre et méthode

Scénario examiné : `id=cmsdnypml0000n4ekuadykn0f`, `code=EXCEL-V12`, `siteId=site_01`, statut `BROUILLON`, `dureeCycleMois=3`, `dateDebutPlan=2026-08-01`.

**Aucune écriture effectuée.** Requêtes `SELECT` uniquement via `docker exec silures-db psql`, plus un script `tsx` jetable appelant `chargerScenarioPourMoteur` + `calculerProjectionScenario` en lecture pure (la route `GET /api/previsions/scenarios/[id]/calculer` ne fait qu'appeler ces deux fonctions et ne persiste rien).

## 1. État des lieux EXCEL-V12 — les 7 vérifications chiffrées

| # | Vérification | ATTENDU | OBSERVÉ | Statut |
|---|---|---|---|---|
| 1 | Vagues / alevins | 19 vagues / 602 500 alevins | 19 `VaguePrevue`, `SUM(effectifAlevinsPrevu)=602 500` | **OK** |
| 2 | Calibres aliment | 3 | 3 (`G1`, `G2`, `G3`) | **OK** |
| 3 | Paliers remise | 0/5/10/15 t → 0/2/4/6 % | ordre 1→0t/0%, 2→5t/2%, 3→10t/4%, 4→15t/6% | **OK** |
| 4 | Apports capital | 6 lignes / 30 000 000 | **7 lignes** / 30 000 000 exact | **ÉCART sur le nombre de lignes**, total OK |
| 5 | Journal dépenses ponctuelles | 5 lignes / 34 400 000 | 5 lignes / 34 400 000 (5M+5M+4M+16,4M+4M) | **OK** |
| 6 | Postes charges × 21 mois | 4 postes / 20 580 000 | 4 `PostePrevision` (Salaires, Énergie, Produits vétérinaires, Loyer), 21 lignes chacun (84 `ChargeMensuellePrevue`), total exact 20 580 000 | **OK** |
| 7 | `ParametresPrevision` colonne par colonne | voir §1.3 | voir §1.3 | **OK, 1 réserve structurelle** |

### 1.1 Détail point 4 — les 7 apports (au lieu de 6 attendus)

```
2026-08-04  Vente Vague 26-03    CAPITAL   4 000 000
2026-09-04  Vente Vague 26-04    CAPITAL   4 000 000
2026-09-04  Fonds propres        CAPITAL   2 000 000
2026-10-01  Apport octobre       CAPITAL   4 000 000
2026-12-01  Apport decembre      CAPITAL   4 000 000
2027-01-01  Apport janvier       CAPITAL  10 000 000
2027-02-01  Apport fevrier       CAPITAL   2 000 000
```

Le total (30 000 000) tombe pile sur l'attendu, ce qui masquerait l'écart à un contrôle qui ne vérifierait que la somme. Il y a très probablement un apport de 6 000 000 le 2026-09-04 saisi en **deux lignes** (4M « Vente Vague 26-04 » + 2M « Fonds propres ») plutôt qu'une seule. À noter aussi : deux libellés (« Vente Vague 26-03 », « Vente Vague 26-04 ») ressemblent à des produits de vente plutôt qu'à de vrais apports en capital — à faire confirmer par l'exploitant, car cela affecte `budget.totalApportsFCFA`.

### 1.2 Détail point 6 — l'écart apparent avec le README (4 vs 6 postes)

`prisma/fixtures/previsions/README.md` annonce « 6 postes non nuls » mais n'en liste que 4. Vérification directe sur `plan-v12-corrige.json` :

```
Main-d'œuvre et salaires          -> total 10 500 000 (21 mois non nuls)
Énergie et carburant              -> total  2 520 000 (21 mois non nuls)
Eau et pompage                    -> total          0 (0 mois non nuls)
Entretien bassins et matériel     -> total          0 (0 mois non nuls)
Produits vétérinaires et intrants -> total  5 250 000 (21 mois non nuls)
Loyer et redevances               -> total  2 310 000 (21 mois non nuls)
Communication et administratif    -> total          0 (0 mois non nuls)
Frais financiers et bancaires     -> total          0 (0 mois non nuls)
```

Le classeur porte **8 lignes de postes**, dont **4 seulement non nulles**. La base est donc **fidèle au classeur**. C'est le **texte du README qui est erroné**.

### 1.3 Détail point 7 — `ParametresPrevision` colonne par colonne

| Colonne | Golden | DB (EXCEL-V12) | Statut |
|---|---|---|---|
| `prixVenteKgFCFA` | 1900 | 1900 | OK |
| `poidsObjectifG` | 400 | 400 | OK |
| `margeSecuriteAlevinsPct` | 0.1 (fraction) | 10 (échelle %) | OK, conversion documentée |
| `prixAlevinUnitaireFCFA` | 70 | 70 | OK |
| `tauxEpargnePct` | 0.3 (fraction) | 30 (%) | OK |
| `capaciteTransportAlimentsSacs` / `coutTransportAlimentsFCFA` | 60 / 15 000 | 60 / 15 000 | OK |
| `capaciteTransportPoissonsKg` / `coutTransportPoissonsFCFA` | 1500 / 25 000 | 1500 / 25 000 | OK |
| `capaciteTransportAlevinsNb` / `coutTransportAlevinsFCFA` | 20 000 / 30 000 | 20 000 / 30 000 | OK |
| `dureeCycleMois` (sur `ScenarioPrevision`) | 3 (implicite) | 3 | OK |
| `poidsMoyenInitialG` | absent du classeur | 5 | OK, saisie manuelle documentée |
| `nombreBacsSimultanesCible` | absent du classeur | 4 | OK, paramétrique pur |
| `frequenceStockageMois` | absent comme paramètre nommé | 1 | OK |
| `effectifAlevinsParVague` | n'existe pas comme scalaire | 10000 | OK, valeur de gabarit |
| `tresorerieInitialeFCFA` | 0 (`Paramètres!B22`) | **aucune colonne dans `ParametresPrevision`** | **RÉSERVE STRUCTURELLE** |

**Réserve trésorerie initiale :** le schéma `ParametresPrevision` ne porte aucun champ de trésorerie d'ouverture ; `route-orchestration.ts` fige `genererSerieTresorerie(..., new Decimal(0))`. Pour EXCEL-V12 cela coïncide avec la valeur attendue (0), donc aucun écart visible — mais c'est une omission de schéma qui empêcherait de représenter un scénario futur à trésorerie d'ouverture non nulle. Hors périmètre de ce sprint.

## 2. Diagnostic confirmé — la logistique n'entre ni dans `baseRepartitionFCFA` ni dans `depensesFCFA`

Exécution de `calculerProjectionScenario(scenario)` sur EXCEL-V12 (lecture pure), **avant correctif** :

```
Mois 0 :
  logistique.sousTotalFCFA : 45 000
  baseRepartitionFCFA      : 980 000
  depensesFCFA             : 1 678 400   (= 698 400 aliments + 0 alevins + 980 000 base + 0 invest.)
  resultatFCFA             : 2 321 600
  soldeFCFA                : 2 321 600

Cumul (21 mois) :
  Total dépenses (somme mois)        : 332 349 600
  Total logistique (jamais incluse)  : 10 210 000
  332 349 600 + 10 210 000 = 342 559 600  <- exactement la valeur attendue (Scénario A)
  Résultat cumulé observé            : 155 550 400
  Résultat cumulé attendu             : 145 340 400   (écart = 10 210 000, exactement le total logistique)
  Point bas observé                  : +2 321 600 au mois 0
  Point bas attendu                  : +2 276 600 (2026-08)  (écart = 45 000, exactement la logistique du mois 0)
```

Chacun des trois écarts est **exactement égal** au montant de logistique omis. Diagnostic confirmé sans ambiguïté.

### 2.1 Lignes exactes de l'omission

`src/lib/previsions/route-orchestration.ts` (numérotation avant correctif) :

```
655:  const baseRepartitionFCFA = calculerBaseRepartition(chargesDuMois, journalDuMois);
664:  const quotePartParVague = calculerQuotePartVague(baseRepartitionFCFA, vaguesActivesCeMois);
...
722:  const logistiqueMois = calculerLogistiqueMensuelle({ ... });   // calculé APRÈS, jamais réinjecté
...
738:  const depensesFCFA = coutAlimentsFCFA.plus(coutAlevinsFCFA).plus(baseRepartitionFCFA).plus(investissementsFCFA);
```

`baseRepartitionFCFA` (655) est calculé **avant** `logistiqueMois` (722), qui dépend lui-même de `sacsAlimentsDuMois` (672-688) et de `quantitePoissonsKg`/`quantiteAlevinsNb` (716-720) — toutes produites après la base de répartition et la quote-part (664). `logistiqueMois.sousTotalFCFA` n'est ensuite ajouté nulle part.

Le nommage du moteur pur (`calculerBaseRepartition`, paramètre `chargesLogistiqueEtExploitation`, JSDoc `charges.ts:71`) montre que la logistique était **prévue** pour entrer dans la base de répartition : c'est l'enchaînement de la route qui ne la lui fournit jamais.

### 2.2 Effet en aval

1. `route-orchestration.ts:664` → `calculerQuotePartVague(...)` → quote-part sous-évaluée sur les vagues actives.
2. `route-orchestration.ts:794-800` → `vague.quotePartChargesFCFA` → `calculerCoutProductionVague` (`vague.ts`) → `vague.coutProductionFCFA`, **sous-évalué pour chaque vague**.
3. `route-orchestration.ts:803-807` → `calculerBudgetTotalPlan` (`budget.ts`) → `budget.totalCoutsProductionFCFA` / `budgetTotalFCFA`, **sous-évalués**.
4. API : `GET /api/previsions/scenarios/[id]/calculer` sérialise ces valeurs telles quelles.
5. UI : `previsions-scenario-detail-page.tsx` et `projection-types.ts` affichent un coût de production par vague et un budget total incorrects.

Exemple observé (vague V1, avant correctif) : `quotePartChargesFCFA = 1 796 666,67`, `coutProductionFCFA = 6 660 666,67`.

### 2.3 Pourquoi la recette existante ne l'a pas vu

`route-orchestration.recette.test.ts` appelle bien `calculerProjectionScenario` (production), mais ses seules assertions touchant `depensesFCFA`/`baseRepartitionFCFA` sont des **identités internes** (`resultat = revenus + apports − depenses` ; `solde[m] − solde[m−1] = resultat[m]` ; `epargne = f(resultat)`). Aucune ne compare au jeu d'or. Ces identités restent vraies avec la logistique manquante — trou de couverture, pas défaut de la recette existante. Signature exacte d'**ERR-142**.

## 3. Fichiers à modifier

1. **`src/lib/previsions/route-orchestration.ts`** — réordonner la boucle mensuelle (logistique avant la base de répartition) et injecter `logistiqueMois.sousTotalFCFA` dans `calculerBaseRepartition`.
2. **Recette au niveau route** — ajouter une comparaison au jeu d'or de `depensesFCFA`/`baseRepartitionFCFA`/cumuls/point bas, scénarios A et B.
3. **`prisma/fixtures/previsions/README.md`** — corriger « 6 postes non nuls » → 4.
4. Optionnel : ADR-053, expliciter la logistique comme composante obligatoire de `base_repartition`.

Aucune modification nécessaire dans `charges.ts`, `logistique.ts`, `vague.ts`, `budget.ts` : fonctions pures correctes et déjà couvertes.

## 4. Verdict

**GO.** Diagnostic confirmé à la FCFA près, point d'omission localisé à deux lignes d'un seul fichier de production, portée du correctif circonscrite. Réserves non bloquantes : nombre de lignes d'apports (total juste, forme à faire confirmer par l'exploitant) et absence de `tresorerieInitiale` au schéma (sans effet sur EXCEL-V12).
