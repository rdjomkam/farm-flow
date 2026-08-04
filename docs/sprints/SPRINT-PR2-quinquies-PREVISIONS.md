# Sprint PR2-quinquies — Compléter la vue Prévisions mensuelle

**Statut** : FAIT
**Commit** : aucun commit ni push par les agents — l'utilisateur commite lui-même
**Référence** : [ADR-053 — Module Prévisions](../decisions/ADR-053-module-previsions.md), `docs/reviews/review-sprint-PR2-bis.md`, `docs/reviews/review-sprint-PR2-quater.md`, classeur de référence `prisma/fixtures/previsions/Previsions_Elevage_Silure_v12.xlsx`

## Contexte — 8 lignes rendues au départ, sur 30 lignes de classeur

La feuille « Prévisions » du classeur de référence `prisma/fixtures/previsions/Previsions_Elevage_Silure_v12.xlsx` porte **30 lignes d'indicateurs** ; l'application n'en affiche que **8** (Revenus, Coût aliments, Coût alevins, Charges réparties, Investissements, Dépenses totales, Apports, Solde cumulé).

**Cible de ce sprint (chiffre corrigé, vérifié par comptage direct des `LigneDescriptor`)** : le passage de **8 à 19 lignes rendues à l'écran** — Résultat (4) + Production (3) + Aliments (2 statiques + **3 dynamiques selon le nombre de calibres du scénario**) + Entrées & dépenses détaillées (7). Ces 19 lignes rendues couvrent **17 des 30 lignes du classeur** ; les **13 restantes (lignes 11-23, détail par vague) sont explicitement exclues** du périmètre. Le nombre **30** est celui du classeur source, **jamais** un nombre de lignes affichées.

Lignes du classeur (colonne A, feuille `Prévisions`) :

```
 4  Empoissonné (t)
 5  Alevins à commander (nb)
 6  Besoin en aliments (kg)
 7  Sacs à acheter (total)
 8-10   dont sacs 2 mm / 3 mm / 4 mm
11  DÉTAIL PAR VAGUE — sacs consommés dans le mois (indicatif)
12  Vague en 1er mois de cycle
13-15   dont sacs 2 mm / 3 mm / 4 mm
16  Vague en 2e mois de cycle
17-19   dont sacs 2 mm / 3 mm / 4 mm
20  Vague en 3e mois de cycle
21-23   dont sacs 2 mm / 3 mm / 4 mm
24  Ventes (t)
25  Entrées — chiffre d'affaires (FCFA)
26  Apport en capital (FCFA)
27  Total des entrées (FCFA)
28  Dépense aliments (FCFA)
29  Dépense alevins (FCFA)
30  Autres dépenses (FCFA)
31     dont investissements (hors coût de production)
32  Dépenses totales (FCFA)
33  Résultat du mois (FCFA)
34  Épargne conseillée (FCFA)
35  Trésorerie cumulée (FCFA)
```

## Levier décisif — la plupart de ces séries sont déjà vérifiables au franc près

La plupart des séries manquantes sont **déjà présentes dans le jeu d'or** :

`entrees.empoissonneT`, `entrees.ventesT`, `besoinsAliments.totalKg`, `besoinsAliments.sacsTotal`, `besoinsAliments.sacsParGranulometrie`, `depenses.alevinsCommandes`, `resultats.totalEntrees`, `resultats.resultat`, `resultats.epargne`.

**Règle non négociable** : toute série nouvellement exposée qui existe dans les fixtures **DOIT** être comparée au jeu d'or — tolérance **0 sur les entiers**, **≤ 1 FCFA sur les montants**. Exposer une série déjà extraite sans la recetter serait renoncer gratuitement à une garantie disponible.

**Exception à traiter explicitement** : le **détail par vague** (lignes 11-23) n'est **PAS** extrait dans les fixtures. S'il est exposé, il faut étendre `prisma/fixtures/previsions/extract-golden.py`.

## Contraintes transverses

- **i18n** : `fr` et `en` **complètes**, accents français corrects, **aucune chaîne en dur**, et **clés mortes supprimées dans les deux langues**.
- **Formats (§7.4 des exigences)** : séparateur de milliers, **aucune décimale sur les montants**, zéros affichés en « – », négatifs **en rouge**, tonnages à **une décimale**, **unité dans le libellé de ligne** (jamais répétée dans chaque cellule).
- **Boutons d'explication** (§7.4 « d'où vient ce nombre ») pour **chaque** nouvelle ligne calculée.
- **Moteur** : `src/lib/previsions/` n'est modifiable que par la story **PR2q.2**. La recette doit finir à **≥ 1270 tests et 0 écart**.
- **Mobile** : la vue carte par mois doit rester cohérente avec les nouvelles lignes.
- **Jeu de test de l'utilisateur** : un scénario `EXCEL-V12` existe en base (3 calibres G1/G2/G3, 19 vagues, 602 500 alevins, 241 t). **AUCUNE de ses données ne doit être modifiée.**
- **Ne pas défaire** ce qui vient d'être livré : transposition indicateurs-en-lignes / mois-en-colonnes, colonne collante, défilement horizontal.

## Gouvernance

Seul le `@status-updater` écrit dans `docs/sprints/` et `docs/TASKS.md`. Tout agent qui a quelque chose à consigner le rapporte au `@project-manager`, qui spawne le `@status-updater`.

## Hors périmètre (= PR3)

Rapprochement prévu/réel, vues de comparaison, reprévision glissante, exports.

## Stories

| Story | Type | Sujet | Pipeline | Statut |
|-------|------|-------|----------|--------|
| PR2q.1 | BUGFIX | Corriger la colonne Total de la ligne cumulative | @developer → @code-reviewer | FAIT |
| PR2q.2 | QUERIES/moteur | L'épargne dans le moteur (`resultats.epargne`) | @pre-analyst → @db-specialist → @developer → @tester → @code-reviewer → @knowledge-keeper | FAIT |
| PR2q.3 | UI | Compléter la vue mensuelle (8 → 19 lignes rendues, dans l'ordre du classeur) | @pre-analyst → @developer → @tester → @code-reviewer | FAIT |
| PR2q.4 | UI | Ventilations demandées par l'utilisateur (apports par type, dépenses par poste) | @pre-analyst → @developer → @tester → @code-reviewer | FAIT |
| PR2q.5 | REVIEW | Review de sprint → `docs/reviews/review-sprint-PR2-quinquies.md` | @code-reviewer → @knowledge-keeper | FAIT |
| — | CORRECTIF | Correctif post-livraison — titres de section invisibles au défilement horizontal (détecté en navigateur réel) | @developer | FAIT |

**Légende** : `TODO` · `EN COURS` · `REVIEW` · `FAIT` · `BLOQUÉ`

> **⚠️ Note de sprint — collision d'identifiants de stories.** Le sprint **PR2-quater** utilise **déjà** les identifiants `PR2q.1` à `PR2q.6`, pour des sujets **sans aucun rapport** avec ceux du présent sprint, et **tous `FAIT`**. Les identifiants `PR2q.*` sont donc **ambigus hors contexte** : toute référence à `PR2q.1`, `PR2q.2`, etc. doit impérativement préciser le sprint concerné (quater ou quinquies). À trancher par le @project-manager s'il faut renommer les identifiants de ce sprint (par ex. `PR2quin.*`).

---

### PR2q.1 — Corriger la colonne Total de la ligne cumulative

**Type** : BUGFIX
**Pipeline** : @developer → @code-reviewer
**Statut** : FAIT

**Contexte** : la colonne Total de la ligne « Solde cumulé » **additionne aujourd'hui les 21 soldes mensuels**. Un cumul additionné à lui-même n'a aucun sens financier : le total affiché ne correspond à rien.

Vérifié dans le classeur : `Prévisions!W35` vaut `=V35` — **la valeur du dernier mois**, pas une somme.

**Exigences** : corriger **cette ligne seule** ; toutes les autres lignes gardent une somme. La correction doit être **généralisée proprement** : une ligne déclarée cumulative se totalise par **sa dernière valeur**, et non par un cas particulier codé en dur sur un libellé.

**Critères d'acceptation** :
- [x] Le total de « Solde cumulé » vaut la valeur du dernier mois, conformément à `Prévisions!W35 = V35`
- [x] Les autres lignes conservent une somme
- [x] La nature cumulative est une **propriété déclarée** de la ligne, pas un `if` sur un libellé
- [x] Test couvrant les deux comportements (ligne cumulative vs ligne sommable)
- [x] `npx vitest run` sans régression, `npm run build` OK

**Note de clôture** — implémentée par @developer, review @code-reviewer **VALIDÉ**, une seule réserve de sévérité **Basse**, non bloquante : la robustesse « dernière valeur non vide » n'est pas couverte par un test dédié — sans impact actuel, `MoisProjectionDTO.soldeFCFA` étant non-optionnel.

**Mécanisme retenu** : un champ `totalMode: "somme" | "derniereValeur"` porté par la structure `LIGNE_KEYS` de `src/components/previsions/previsions-mensuelles-tab.tsx`, consommé uniformément par `calculerTotalLigne()` **sans aucune branche conditionnelle par nom de ligne**. Une ligne cumulative ajoutée par PR2q.3 / PR2q.4 n'a donc qu'à déclarer ce champ. Seule `soldeFCFA` porte `"derniereValeur"` aujourd'hui.

**Tests** : 2 tests de non-régression ajoutés dans `src/components/previsions/__tests__/previsions-mensuelles-tab.test.tsx`.
**Vérification** : `npx vitest run` → 277 fichiers passés / 5 skipped, 7668 tests passés / 21 skipped / 26 todo, **0 échec** ; `npm run build` → **exit 0**.

---

### PR2q.2 — L'épargne dans le moteur

**Type** : QUERIES/moteur
**Pipeline** (amendé par le chef de projet) : @pre-analyst → @db-specialist → @developer → @tester → @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Contexte** : `resultats.epargne` **existe dans les deux fixtures** du jeu d'or, mais le moteur ne la calcule pas. Dette ouverte explicitement signalée par la review PR2-bis.

Règle §5.6 des exigences :

```
epargne(M) = max(0, resultat(M)) × taux_epargne
```

Le taux vit dans les **paramètres du scénario** (`tauxEpargnePct`) — valeur du classeur : **30 %**.

**Exigences** : c'est la **seule** story du sprint autorisée à modifier `src/lib/previsions/`. La recette doit **AUGMENTER** de cette série, comparée **sur les 21 mois des deux fixtures**. Attention aux deux pièges déjà rencontrés dans ce module : l'**échelle du pourcentage** (0..100 en base et dans le moteur, fraction dans les fixtures — un seul site de conversion de chaque côté) et l'**arrondi flottant** (passer par `Decimal`, jamais par l'arithmétique binaire native).

**Critères d'acceptation** :
- [x] Le moteur calcule `epargne(M) = max(0, resultat(M)) × tauxEpargnePct`, en `Decimal`
- [x] `resultats.epargne` passe d'entrée non calculée à **valeur calculée comparée au jeu d'or**, sur **21 mois × 2 fixtures**
- [x] Tolérance : ≤ 1 FCFA
- [x] Nombre de tests de recette **en hausse**, **0 écart** (1270 → 1482)
- [ ] `tauxEpargnePct` lisible et modifiable dans les paramètres du scénario — **laissé décoché** : la persistance (colonne `ParametresPrevision.tauxEpargnePct`, migration, transit DB → loader → moteur prouvé par test e2e) est acquise, mais **aucun rapport du sprint n'atteste de l'exposition du champ dans l'UI `parametres-tab.tsx`**, que la pré-analyse signalait absente. À confirmer ou à traiter en story dédiée.
- [x] Capitalisation par le @knowledge-keeper

**Note de clôture** — pipeline amendé **exécuté intégralement** : @pre-analyst → @db-specialist → @developer → @tester → @code-reviewer → @knowledge-keeper.

- **Fonction pure** ajoutée dans `src/lib/previsions/tresorerie.ts` : `calculerEpargne(resultat, tauxEpargnePct) = Decimal.max(0, resultat).times(tauxEpargnePct).dividedBy(100)` — aucun I/O, `Decimal` strict.
- `resultatFCFA` et `epargneFCFA` ajoutés à `MoisProjectionResult` dans `src/lib/previsions/route-orchestration.ts`. L'identité `resultatFCFA = revenusFCFA + apportsFCFA − depensesFCFA` = delta de `calculerTresorerieMensuelle` est **prouvée numériquement**, pas supposée.
- **Recette : 1270 → 1482 tests, 0 écart** (+42 pour `resultats.epargne` sur les 21+21 mois des 2 fixtures ; le reste pour une nouvelle « Section C » appliquant ERR-142 — comparaison des séries mensuelles `mois[]` de la vraie fonction publique `calculerProjectionScenario`, zone jusqu'ici non recettée où 3 bugs Haute s'étaient déjà logés).
- **@tester** : suite rejouée 2 fois (`277 passed | 5 skipped`, `7880 passed`, 0 échec), détection de régression prouvée par mutation volontaire de `calculerEpargne` (11 tests tombent, restauration vérifiée), et **gap ERR-141 comblé** qu'aucun test existant ne couvrait — nouveau test `src/lib/queries/__tests__/previsions-scenario-loader-tauxepargne-e2e.test.ts` faisant transiter deux valeurs différentes du taux par le chemin complet DB → loader → `calculerProjectionScenario`. Rapport : `docs/tests/rapport-story-PR2q2.md`.
- **@code-reviewer : VALIDÉ**, aucune réserve Critique ni Haute. Une seule réserve **Basse et informative, hors périmètre** : `updateParametresPrevision` reste un `findFirst({ siteId })` suivi d'un `update({ where: { scenarioId } })`, donc pas strictement atomique au sens R4 — pattern préexistant, non introduit par cette story. Rapport : `docs/reviews/review-story-PR2q2.md`.
- Instabilité de `src/components/previsions/__tests__/scenario-form-dialog.test.tsx` observée une fois sous charge parallèle : **non reproduite** en 3 exécutions ultérieures (2 complètes + 1 isolée). Aucune assertion affaiblie.

**Historique d'avancement**

- **@pre-analyst — verdict `GO AVEC RÉSERVE`.** Le champ `tauxEpargnePct` **n'existait nulle part dans le code applicatif** : absent de `prisma/schema.prisma`, de `src/types/`, de `previsions.schema.ts`, de `parametres-tab.tsx` et des queries ; présent **uniquement** dans les fixtures du jeu d'or. Le pipeline a donc été **amendé par le chef de projet** par insertion d'une étape @db-specialist pour la migration : `@pre-analyst → @db-specialist → @developer → @tester → @code-reviewer → @knowledge-keeper`.
- **Formule confirmée numériquement** par le @pre-analyst sur les **21 mois des 2 fixtures**, écart **0,0** : `epargne(M) = max(0, resultat(M)) × tauxEpargne`.
- **Étape @db-specialist — TERMINÉE.** `ParametresPrevision.tauxEpargnePct Decimal @default(30)` (échelle **0..100**, **NOT NULL**, R7 justifié) ; migration `prisma/migrations/20260803170000_add_taux_epargne_pct/migration.sql`, **idempotente** (garde `IF NOT EXISTS`), appliquée par `npx prisma migrate deploy`. Le scénario `EXCEL-V12` a bien reçu `tauxEpargnePct = 30` par **backfill du DEFAULT**, **aucune autre de ses données touchée**.
- **Étape @developer — TERMINÉE.**

---

### PR2q.3 — Compléter la vue mensuelle

**Type** : UI
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer
**Statut** : FAIT

**Contexte** : 8 lignes rendues au départ. Exposer les lignes manquantes **dans l'ordre du classeur**, avec l'**unité entre parenthèses dans le libellé de ligne**, pour atteindre **19 lignes rendues** (dont 3 dynamiques selon le nombre de calibres), couvrant **17 des 30 lignes du classeur** — les 13 restantes (lignes 11-23) étant explicitement exclues.

**Exigences** :
- Ne **pas** défaire la transposition indicateurs-en-lignes / mois-en-colonnes, la **colonne collante** ni le **défilement horizontal** livrés juste avant.
- 19 lignes rendues imposent un **regroupement lisible obligatoire** : sections repliables ou séparateurs de section. Le **§7.1 des exigences reste la règle** — compréhension en **moins de 10 secondes**. Un tableau plat est un échec de cette story, même si toutes les valeurs sont justes.
- Toute série exposée qui existe dans les fixtures est **comparée au jeu d'or** (0 sur les entiers, ≤ 1 FCFA sur les montants).
- Le **détail par vague** (lignes 11-23) n'est pas extrait : s'il est exposé, étendre `prisma/fixtures/previsions/extract-golden.py`. S'il ne l'est pas, le dire explicitement dans la note de clôture plutôt que de le laisser disparaître en silence.
- Formats §7.4 et boutons d'explication §7.4 pour **chaque** nouvelle ligne calculée.
- La **vue carte par mois (mobile)** doit rester cohérente avec les nouvelles lignes.

**Critères d'acceptation** :
- [x] Les 17 lignes du classeur retenues (sur 30) sont exposées en **19 lignes rendues**, dans l'ordre du classeur, unité dans le libellé de ligne — les 13 lignes 11-23 sont explicitement exclues
- [x] Regroupement lisible en sections (repliables ou séparées) — §7.1 tenu
- [x] Transposition, colonne collante et défilement horizontal préservés
- [x] Chaque série présente dans les fixtures est recettée contre le jeu d'or, 0 écart
- [x] Bouton d'explication sur chaque nouvelle ligne calculée
- [x] Formats §7.4 respectés (milliers, 0 décimale sur montants, « – » pour zéro, négatifs en rouge, tonnages à 1 décimale)
- [x] Vue carte mobile cohérente à 360px
- [x] i18n fr + en complètes, accents corrects, aucune chaîne en dur, clés mortes supprimées des deux langues

**Note de pré-analyse — @pre-analyst : `GO`.** Points actés :

- **Le détail par vague (lignes 11-23 du classeur) est explicitement laissé HORS PÉRIMÈTRE**, sur recommandation assumée du @pre-analyst : `prisma/fixtures/previsions/extract-golden.py` **ne lit pas** ces lignes, et les exposer sans les extraire du classeur reviendrait à **comparer le moteur à lui-même** — exactement l'anti-pattern que le README du jeu d'or interdit. L'extraction est **mécaniquement faisable** et **mérite sa propre story**, pas un ajout silencieux à PR2q.3.
- Les lignes **27 (Total des entrées)** et **33 (Résultat du mois)** sont **dérivables côté UI**, sans toucher au moteur.
- La ligne **30 « Autres dépenses »** du classeur est déjà affichée **plus finement** par l'application (charges réparties et investissements en **2 lignes séparées**) : **à garder tel quel** plutôt que de fusionner.

**Note de clôture — story `FAIT`, pipeline exécuté intégralement** (@pre-analyst → @developer → @tester → @code-reviewer).

- **@tester** (`docs/tests/rapport-story-PR2q3.md`) : recette rejouée **2 fois**, **1904/1904** (progression 1482 → 1904 confirmée exactement) ; suite complète rejouée 2 fois avant et 2 fois après ses ajouts (**278 fichiers passés / 5 skipped**, **8308 → 8313 tests**, **0 échec**) ; `npm run build` → **exit 0**.
- **Non-tautologie de la Section D confirmée par citation de code** : chaque valeur attendue provient d'un bloc de fixture (`entrees.*`, `besoinsAliments.*`, `depenses.alevinsCommandes`), **jamais recalculée** par le code testé.
- **Détection de régression prouvée** : injection d'un `+1` dans l'accumulation du `ceil` par granulométrie → **162 tests sur 1904 tombent** ; restauration vérifiée **octet pour octet** (diff/md5, le fichier n'étant pas suivi par git).
- Le **`ceil` par granulométrie** est bien appliqué **par granulométrie puis sommé**, jamais un ceil de la somme — conforme à la vérification n°1 du README du jeu d'or.
- Les **lignes de granulométrie sont dynamiques** (union des clés réellement présentes, aucun 2/3/4 mm codé en dur) et réutilisent les libellés existants de `stock.json` — **aucun second référentiel** créé, conforme à ADR-053 §12.2.4.
- Les **deux sérialiseurs sont identiques champ pour champ**.
- **La réserve du @developer sur `resultats.totalEntrees` est confirmée exacte** : une recherche exhaustive de `entreesModele` dans les deux fixtures confirme qu'**aucune entrée d'apport n'y existe comme donnée de saisie**. La limite est **documentée en JSDoc** dans le test plutôt que masquée.
- Le @tester a ajouté **5 tests de rendu de la carte mobile 375 px** — seul le tableau desktop était exercé auparavant.
- Lignes **11-23 confirmées réellement exclues**, pas silencieusement omises.
- **@code-reviewer : `VALIDÉ AVEC RÉSERVES`** (`docs/reviews/review-story-PR2q3.md`). **Aucune réserve Critique ni Haute.** Deux réserves :
  1. **Basse** — clé i18n morte `previsionsMensuellesTab.sectionToggleAria` (fr + en), jamais référencée. Les boutons de bascule ont **déjà** un nom accessible via leur texte visible : **aucune régression d'accessibilité**. **Réserve soldée par le @developer de PR2q.4**, qui a supprimé la clé des deux fichiers de langue.
  2. **Documentaire** — le décompte « 8 → 30 lignes », **corrigé dans ce fichier** : le chiffre réel est **8 → 19 lignes rendues** (dont 3 dynamiques selon le nombre de calibres), couvrant **17 des 30 lignes du classeur**.

**Historique d'avancement — étape @developer.**

- 6 nouveaux champs sur `MoisProjectionResult` / `MoisProjectionDTO` (`empoissonneKg`, `ventesKg`, `alevinsACommanderNb`, `besoinAlimentsTotalKg`, `sacsAlimentsTotal`, `sacsParGranulometrie`) et 4 accumulateurs mensuels dans `route-orchestration.ts` — **six séries étaient déjà calculées mais gardées dans des variables locales de boucle ou des Map internes**, jamais copiées dans la structure de sortie.
- Vue réécrite avec **4 sections repliables** (Radix Collapsible) : « Résultat » (dépliée par défaut : Total des entrées, Dépenses totales, Résultat du mois, Trésorerie cumulée), « Production » (repliée), « Aliments » (repliée), « Entrées & dépenses détaillées » (repliée). Structure `LigneDescriptor` (`accessor` / `totalMode` / `format`), **aucune branche par nom de ligne** ; lignes de granulométrie construites **dynamiquement**, pas codées en dur ; `ExplicationLigne` sur toutes les nouvelles lignes.
- **8 → 19 lignes rendues** (dont **3 dynamiques** selon le nombre de calibres du scénario), couvrant **17 des 30 lignes du classeur**. Lignes du classeur nouvellement exposées : 4, 5, 6, 7, 8-10, 24, 27, 33, 34 (les autres l'étaient déjà). Lignes 11-23 **exclues**.
- **Recette : 1482 → 1904 tests (+422), 0 écart**, via une « Section D » au grain `mois[]`. Séries rapprochées au jeu d'or : `empoissonneKg` ↔ `entrees.empoissonneT`, `ventesKg` ↔ `entrees.ventesT`, `besoinAlimentsTotalKg` ↔ `besoinsAliments.totalKg`, `sacsAlimentsTotal` ↔ `besoinsAliments.sacsTotal`, `sacsParGranulometrie.{G1,G2,G3}` ↔ `besoinsAliments.sacsParGranulometrie.{2mm,3mm,4mm}` (tolérance 0), `alevinsACommanderNb` ↔ `depenses.alevinsCommandes` (tolérance 0), `revenusFCFA` ↔ `entrees.chiffreAffaires` (≤ 1 FCFA).
- **Réserve déclarée par le @developer, à confirmer par le @tester** : la ligne 27 « Total des entrées » n'est **pas rapprochée intégralement** — `entreesModele` ne porte aucune entrée brute d'apports (`resultats.apportsCapital` est une **sortie** du classeur, jamais une ligne de saisie), donc le builder de recette construit toujours `apports: []` et la dérivation `revenusFCFA + apportsFCFA` dégénère à `revenusFCFA`. Documenté explicitement dans le JSDoc de la Section D plutôt que présenté comme couvert.
- Lignes **11-23 (détail par vague) non implémentées** — exclusion assumée, conformément à la décision de sprint ci-dessus.
- Suite complète après livraison : 283 fichiers (278 passed / 5 skipped), **8308 tests passés, 0 échec** ; `npm run build` compilé sans erreur.

---

### PR2q.4 — Ventilations demandées par l'utilisateur

**Type** : UI
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer
**Statut** : FAIT

**Contexte** : **c'est un AJOUT au classeur, pas une reproduction.** Le classeur n'a pas ces ventilations ; l'utilisateur les demande.

- Ventiler les **apports par type** : `ApportCapital.type` / `TypeApportCapital`
- Ventiler les **dépenses par poste** : `PostePrevision` / `ChargeMensuellePrevue`

**Exigences** : le **total ventilé doit rester égal à la ligne agrégée** — et cette égalité doit être **vérifiée par test**, pas seulement constatée à l'écran. Comme il n'y a ici **aucune référence dans le jeu d'or**, cette invariante de cohérence est la seule garantie disponible : elle est donc obligatoire.

**Critères d'acceptation** :
- [x] Apports ventilés par `TypeApportCapital`
- [x] Dépenses ventilées par `PostePrevision` (via `ChargeMensuellePrevue`)
- [x] Test prouvant que la somme des lignes ventilées est **égale** à la ligne agrégée correspondante, mois par mois — y compris dans le **cas non dégénéré**, dont la valeur est prouvée par mutation (voir note de clôture)
- [x] Formats §7.4 et regroupement lisible (§7.1) respectés
- [x] i18n fr + en complètes, accents corrects, aucune chaîne en dur
- [x] Vue carte mobile cohérente

**Note de pré-analyse — @pre-analyst : `GO`.** Deux pièges actés :

- **`TypePostePrevision` n'a que 2 valeurs** (`LOGISTIQUE`, `CHARGE_EXPLOITATION`) — **trop grossier** pour une ventilation utile. La ventilation par poste doit **grouper par `PostePrevision` individuel**, via `posteId` → `libelle`.
- **`calculerBaseRepartition` exclut les lignes de journal `OPERATIONNEL` affectées à une vague.** La ventilation doit donc porter sur **`baseRepartitionFCFA`**, pas sur `depensesFCFA` complet — ou bien inclure **explicitement** une catégorie pour le journal affecté. À **prouver par un test** comportant au moins une ligne `OPERATIONNEL` avec `vaguePrevueId` **non nul** : le jeu d'or a ce journal **nul partout**, il ne peut donc pas révéler le problème.

**Note de clôture — story `FAIT`, pipeline exécuté intégralement** (@pre-analyst → @developer → @tester → @code-reviewer).

- **@tester** (`docs/tests/rapport-story-PR2q4.md`) : recette **1904/1904 inchangée** ; suite complète rejouée **3 fois** (**8323/8323 à chaque run**) ; `npm run build` → **exit 0**.
- **Preuve de détection de régression** : retrait de l'exclusion `vaguePrevueId !== null` dans `ventilations.ts` → le test « **piège 2** » échoue **seul** (`expected 780000 to be 280000`), les **5 autres restent verts**. Cela confirme leur **incapacité structurelle** à détecter ce bug, et donc la valeur du cas non dégénéré exigé par la pré-analyse. Fichier restauré à l'identique, **checksum vérifié**.
- **@code-reviewer : `VALIDÉ AVEC RÉSERVES`** (`docs/reviews/review-story-PR2q4.md`), aucune réserve Critique ni Haute :
  1. **Moyenne — maintenue ouverte** : le filtre de `calculerBaseRepartition` est **dupliqué** entre `charges.ts` et `ventilations.ts` — un **ERR-138 en puissance**. Le test comparatif est un filet réel mais **partiel**, dont la valeur dépend de la discipline de maintenance future. **Bloquante avant toute story modifiant `base_repartition` dans `charges.ts`.**
  2. **Basse** : cardinalité **non bornée** de la section Ventilations (une ligne par poste).
- **Vérifié** : aucune injection HTML possible via `PostePrevision.libelle` — interpolation `next-intl` puis rendu comme **enfant React**, jamais `dangerouslySetInnerHTML`.

**Historique d'avancement — étape @developer.**

- **Créé** : `src/lib/previsions/ventilations.ts` (logique pure : `ventilerApportsParType`, `ventilerDepensesParPoste`) et `src/lib/previsions/__tests__/ventilations.test.ts` (**6 tests**).
- 5ᵉ section « **Ventilations** », **repliée par défaut** (§7.1). Props de `PrevisionsMensuellesTab` élargies ; `scenario-detail-client.tsx` transmet `initialApports` / `initialCharges` / `initialPostes` / `initialJournal`, **déjà chargés — aucune nouvelle requête, aucun changement de moteur**.
- **Piège n°2 tranché** : la ventilation porte explicitement sur **`baseRepartitionFCFA`**, **pas** sur `depensesFCFA`, en **deux composantes reproduisant exactement le filtre de `calculerBaseRepartition`** — charges des `PostePrevision` à `inclusBaseRepartition = true` (groupées **par poste individuel** via `posteId` → `libelle`, jamais par `TypePostePrevision`, qui n'a que 2 valeurs) + journal `OPERATIONNEL` à `vaguePrevueId = null` (« Journal général »). Les postes `inclusBaseRepartition = false` sont exclus, comme le moteur les exclut de `depensesFCFA` : les ventiler aurait créé un **écart silencieux**.
- **Garantie « total ventilé = ligne agrégée »** testée y compris dans le **cas non dégénéré** (journal `OPERATIONNEL` à `vaguePrevueId` non nul), que le jeu d'or **ne peut pas exercer** puisqu'il a ce journal nul partout sur les 21 mois des deux scénarios (ADR-053 §12.5, ERR-154).
- **Ce qui n'est pas rapprochable au jeu d'or, et pourquoi** : le classeur n'a **qu'une ligne d'apports et une ligne de dépenses** — la partition `CAPITAL`/`CREDIT` et le détail poste par poste **n'existent pas dans le classeur**. Seul le **total** est réconcilié (`resultats.apportsCapital` de `plan-v12-corrige.json`) ; `annexe-b-corrigee.json` est **dégénéré** (0 apport partout). Documenté explicitement **en tête des fichiers de test**.
- **Dette soldée au passage** : clé i18n morte `sectionToggleAria` (réserve Basse de la review PR2q.3) supprimée des **deux** langues.
- **Recette inchangée à 1904 tests, 0 écart.** `npm run build` → **exit 0**.
- **Point ouvert à confirmer par le @tester** : le @developer signale des échecs **flaky** sous exécution parallèle sur `aliment-form-dialog.test.tsx`, `apport-form-dialog.test.tsx`, `journal-form-dialog.test.tsx`, `poste-form-dialog.test.tsx`, `scenario-form-dialog.test.tsx`, `vague-prevue-form-dialog.test.tsx` et `render-pdf-safely.test.ts`, **tous passants isolément** (suite ciblée **1935/1935**). À qualifier : instabilité de timing préexistante ou régression.

---

### PR2q.5 — Review de sprint

**Type** : REVIEW
**Pipeline** : @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Livrable** : `docs/reviews/review-sprint-PR2-quinquies.md`, verdict explicite, checklist R1-R11, confirmation de l'état de la recette (**≥ 1270, 0 écart**), et vérification explicite qu'aucune série présente dans les fixtures n'a été exposée à l'écran **sans** être comparée au jeu d'or.

**Critères d'acceptation** :
- [x] `docs/reviews/review-sprint-PR2-quinquies.md` produit, verdict explicite
- [x] Checklist R1-R11
- [x] État de la recette confirmé (**1904 tests, 0 écart** — progression 1270 → 1482 → 1904)
- [x] Aucune série disponible dans les fixtures exposée sans recette — les séries non rapprochables sont **nommées et justifiées**, pas omises (voir « Points ouverts », point 4)
- [ ] Parité et complétude i18n fr/en vérifiées, clés mortes absentes des deux langues — **laissé décoché** : la **parité est vérifiée** (407 clés de chaque côté, aucune manquante) et `sectionToggleAria` a bien disparu des deux fichiers, mais **deux clés mortes subsistent** (`page.detailTitle`, `page.backToList`) — connues, antérieures et hors périmètre. Le critère est **partiellement** satisfait ; il ne sera soldé qu'avec leur suppression.
- [x] Capitalisation par le @knowledge-keeper (**ERR-153 à ERR-158** — après la renumérotation opérée en **PR2-septies** (collision de numéros sur ERR-158), ce lot couvre **ERR-153 à ERR-158 plus ERR-163**)

**Note de clôture — `VALIDÉ AVEC RÉSERVES`** (`docs/reviews/review-sprint-PR2-quinquies.md`). **Aucune réserve Critique ni Haute.**

Réserves priorisées :
1. **Moyenne** — `PalierRemise.seuilSacs` : héritée de **PR2-bis**, **inchangée**. **Bloquante avant toute story de remise multi-granulométrie.**
2. **Moyenne** — duplication du filtre `calculerBaseRepartition` entre `charges.ts` et `ventilations.ts`. **Bloquante avant toute story modifiant `base_repartition` dans `charges.ts`.**
3. **Moyenne — nouvelle** — les **garanties visuelles du §7.4 sont hors de portée de jsdom** (capitalisée en **ERR-157**, sévérité Haute).
4. Puis **4 réserves Basses héritées** et **2 points d'information**.

Autres constats de la review : **gouvernance PR2-bis confirmée toujours soldée** (grep de la première personne dans le fichier de sprint : **négatif**) ; **périmètre tenu** (lignes 11-23 exclues, moteur non modifié hors PR2q.2).

---

### Correctif post-livraison — titres de section invisibles au défilement horizontal

**Type** : BUGFIX (hors stories, découvert après livraison de PR2q.4)
**Pipeline** : @developer
**Statut** : FAIT

**Ce qu'aucun test jsdom ne pouvait voir.** Une vérification de **rendu réel** (Chromium/Playwright, scénario `EXCEL-V12`, **1280×800** et **375×812**) a révélé que les **titres de section disparaissaient au défilement horizontal**. Ils étaient un `<td colSpan={mois.length + 2}>` en `sticky left-0` — une cellule occupant **déjà toute la largeur du tableau** n'a **aucune marge pour s'épingler**. Mesuré : titre à `left = -1331` pour un conteneur commençant à **264**, soit **1595 px hors écran** ; les **5 en-têtes devenaient des bandes grises vides**.

**Correctif** : cellule collante **étroite** (largeur de la colonne des libellés, fond `bg-muted` **opaque**, `z-10`, `border-r`) + bande de fond **non collante** en `colSpan={mois.length + 1}` avec `aria-hidden="true"` — **réutilisation exacte** du mécanisme déjà en place pour les lignes d'indicateurs, **aucun mécanisme parallèle**. Plus deux correctifs cosmétiques : `text-left` sur le bouton de bascule mobile (le style UA le centrait) et `collisionPadding = 16` par défaut sur `PopoverContent`.

**Revérifié en navigateur réel après correctif** :
- Titre mesuré à `265 → 717` à `scrollLeft` **0, 804, 1608 et max** — **identique à la colonne des libellés, jamais déplacé**, pour les **5 sections**.
- Fond `rgb(241, 245, 249)` **sans canal alpha**, donc réellement opaque ; `elementFromPoint` renvoie le **bouton de section** à 15/40/60/85 % de la largeur de la cellule.
- En **375 px** : les 5 boutons alignés à gauche (texte à `x = 55`), « VENTILATIONS » sur 2 lignes **sans se recentrer** ; marge du popover portée à **16 px** (`right = 359` dans un viewport de 375, contre 375 auparavant).
- **Non-régression** : première colonne collée à `265 → 717`, **23 en-têtes** atteignables, `TOTAL` visible à scroll max, **aucun débordement de page** (`scrollWidth = clientWidth = 1280` et `= 375`), **22 lignes** après dépliage, **22/22 popovers desktop** s'ouvrent, formats **§7.4 vérifiés au caractère près** (**381** espaces fines U+202F, **150** tirets U+2013, `rgb(239, 68, 68)` sur les négatifs, tonnages `4,0 t`).
- **3 tests de non-régression jsdom** ajoutés, avec mention **explicite dans le test** de ce qu'ils **ne peuvent pas** prouver.

**Critères d'acceptation** :
- [x] Les titres des 5 sections restent visibles à toute position de défilement horizontal, vérifié **en navigateur réel**
- [x] Le mécanisme réutilise celui des lignes d'indicateurs, sans mécanisme parallèle
- [x] Aucune régression sur la colonne collante, les en-têtes, le total, la largeur de page ni les popovers
- [x] Formats §7.4 revérifiés au caractère près après correctif
- [x] Tests de non-régression ajoutés, avec leurs limites **écrites dans le test**

---

## Vérification de fin de sprint

Sorties réelles — rapport : `docs/tests/rapport-final-sprint-PR2-quinquies.md`.

- [x] `npx prisma migrate deploy` — **aucune migration en attente**
- [x] `npx vitest run` — **3 runs identiques** : **284 fichiers** (279 passed + 5 skipped), **8326 tests passed**, 21 skipped, 26 todo, **0 échec aux 3 runs**
- [x] `npx vitest run src/lib/previsions/__tests__/recette` — **1904/1904, 0 écart** (461 + 461 + 982). Progression du sprint : **1270 → 1482 → 1904**
- [x] `npm run build` — `✓ Compiled successfully`
- [x] Vérification manuelle mobile et desktop — faite **en navigateur réel** (Chromium/Playwright) à **375×812** et **1280×800**, pas à 360 px : vue carte par mois, transposition, colonne collante et défilement horizontal vérifiés par **mesure**, pas à l'œil (voir « Correctif post-livraison »)
- [x] Scénario `EXCEL-V12` en base : données **inchangées** — vérifié **en lecture seule**, conforme (19 vagues, 602 500 alevins, 3 calibres G1/G2/G3, 241 t, `tauxEpargnePct = 30`)
- [x] Fixtures du jeu d'or **intactes** (`git status` / `git diff --stat` vides)
- [x] Parité i18n : **407 clés de chaque côté**, aucune manquante ; `sectionToggleAria` disparue des deux fichiers ; aucune clé morte **nouvelle**
- [x] Les **3 cassages volontaires** des campagnes de test (`calculerEpargne`, le `ceil` par granulométrie dans `route-orchestration.ts`, le filtre de `ventilerDepensesParPoste`) sont confirmés **restaurés correctement**, par lecture de code **et** par les tests passants

## Points ouverts consignés à la clôture

1. **Écart documentaire mineur** — **284** fichiers de test observés contre « 282 » annoncés comme base ; le **nombre de tests (8326) correspond exactement**.
2. **Instabilité *flaky*** signalée sur `aliment-form-dialog`, `apport-form-dialog`, `journal-form-dialog`, `poste-form-dialog`, `scenario-form-dialog`, `vague-prevue-form-dialog` et `render-pdf-safely` sous charge parallèle : **non reproduite** en **6 exécutions complètes cumulées**. **Ni confirmée ni infirmée** ; **aucune assertion affaiblie, aucun `retry` ni `skip` ajouté**. À rouvrir en `BUG-XXX.md` **avec logs** si la CI la reproduit.
3. **Violation R11 trouvée par gitleaks dans un fichier antérieur à ce sprint** : `docs/tests/rapport-story-PR1.4.md` contenait en dur l'identifiant de la base de **développement locale** (**pas de production**). Corrigé par le @knowledge-keeper (placeholder) et capitalisé en entrée ERR. La valeur **reste présente dans l'historique git** de ce fichier — information factuelle, **pas une action de ce sprint**.
4. **Non couvert, assumé** : lignes **11-23** du classeur (détail par vague) ; partition `CAPITAL`/`CREDIT` des apports et détail poste par poste (**absents du classeur**, validés par tests synthétiques seulement) ; composante `apportsFCFA` de « Total des entrées » (**aucune ligne d'apport en saisie dans les fixtures** — la dérivation n'est rapprochée qu'en dégénérant à `revenusFCFA`).
5. **Nouvelles entrées de capitalisation** : **ERR-153 à ERR-158** dans `docs/knowledge/ERRORS-AND-FIXES.md`, dont **ERR-157** (sévérité **Haute**) : *jsdom ne prouve aucune garantie de mise en page*.
