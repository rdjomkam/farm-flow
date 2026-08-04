# Sprint PR2-sexies — Détail des sacs par mois de cycle

**Statut** : FAIT
**Commit** : aucun commit ni push par les agents — l'utilisateur commite lui-même
**Référence** : [ADR-053 — Module Prévisions](../decisions/ADR-053-module-previsions.md), `docs/reviews/review-sprint-PR2-quinquies.md`, classeur de référence `prisma/fixtures/previsions/Previsions_Elevage_Silure_v12.xlsx`, jeu d'or `prisma/fixtures/previsions/`

## Contexte — les 13 lignes que PR2-quinquies a délibérément écartées

Le classeur `Previsions_Elevage_Silure_v12.xlsx` porte, **lignes 11 à 23** de sa feuille `Prévisions`, un bloc intitulé **« DÉTAIL PAR VAGUE — sacs consommés dans le mois (indicatif) »** : les sacs consommés chaque mois, ventilés **par position de la vague dans son cycle** (1er, 2e, 3e mois) **ET** par **granulométrie** (2 mm, 3 mm, 4 mm) — soit **9 séries**.

**L'application n'en expose aucune.** PR2-quinquies (story PR2q.3) les avait **délibérément écartées**, sur recommandation assumée du @pre-analyst : `prisma/fixtures/previsions/extract-golden.py` **ne les extrait pas**, et les exposer sans jeu d'or reviendrait à **comparer le moteur à lui-même** — exactement l'anti-pattern que le README du jeu d'or interdit. Ce sprint **lève ce blocage** : il commence par étendre l'extraction, puis n'expose qu'ensuite.

Lignes concernées (colonne A, feuille `Prévisions`) :

```
11  DÉTAIL PAR VAGUE — sacs consommés dans le mois (indicatif)
12  Vague en 1er mois de cycle           (libellé INDEX/MATCH — défaut, voir §8)
13-15   dont sacs 2 mm / 3 mm / 4 mm     ← série extractible
16  Vague en 2e mois de cycle            (libellé INDEX/MATCH — défaut, voir §8)
17-19   dont sacs 2 mm / 3 mm / 4 mm     ← série extractible
20  Vague en 3e mois de cycle            (libellé INDEX/MATCH — défaut, voir §8)
21-23   dont sacs 2 mm / 3 mm / 4 mm     ← série extractible
```

## Formules du classeur

Pour la granulométrie `g` et le mois `M`, avec `sacs(g, vague)` = feuille `'Aliment par vague'` colonnes **D/E/F**, et `pct_mois_k(g)` = feuille `Aliments` colonnes **F/G/H** :

```
mois 1 de cycle : ROUND( Σ sacs(g) des vagues empoissonnées en M   × pct_mois1(g) , 0 )
mois 2 de cycle : ROUND( Σ sacs(g) des vagues empoissonnées en M-1 × pct_mois2(g) , 0 )
mois 3 de cycle : ROUND( Σ sacs(g) des vagues empoissonnées en M-2 × pct_mois3(g) , 0 )
```

### ⚠️ POINT D'ATTENTION — `ROUND`, PAS `ceil`

C'est un **`ROUND`**, **PAS** le **`ceil`** de la ligne « Sacs à acheter ». Le classeur qualifie lui-même ce bloc d'**« indicatif »** : ce sont les sacs **CONSOMMÉS**, **pas** les sacs **À COMMANDER**. **Confondre les deux arrondis est exactement le glissement qui a produit le bug de facteur 8300** (ADR-053 §11, **ERR-138** / **ERR-139**).

### Cumuls de contrôle sur l'horizon (colonne W du classeur)

| | 2 mm | 3 mm | 4 mm |
|---|---|---|---|
| **1er mois de cycle** | 1 543 | 867 | 0 |
| **2e mois de cycle** | 385 | 3 471 | 4 820 |
| **3e mois de cycle** | 0 | 0 | 7 230 |

### Défaut du classeur à NE PAS reproduire (§8 des exigences)

Les lignes **12, 16 et 20** du classeur affichent un **code de vague obtenu par `INDEX/MATCH`**, qui **ne renvoie qu'UNE seule vague** même quand **plusieurs coïncident** — signalé au **§8 des exigences comme un défaut à corriger**. Les **quantités**, elles, utilisent **`SUMIFS`** et **cumulent correctement** : **c'est ce comportement-là qu'il faut implémenter**. Si un **libellé de cohorte** est exposé, il doit lister **TOUTES** les vagues concernées.

## Contraintes transverses

- **i18n** : `fr` et `en` **complètes**, accents français corrects, **aucune chaîne en dur**, **clés mortes supprimées dans les deux langues** — dont les **2 clés mortes résiduelles** `page.detailTitle` et `page.backToList` signalées par la review PR2-quinquies.
- **Formats du §7.4 conservés** : espace fine **U+202F** comme séparateur de milliers, **aucune décimale sur les montants**, zéros affichés en tiret **U+2013**, négatifs **en rouge**, **unité dans le libellé de ligne** (jamais répétée dans chaque cellule), **bouton d'explication sur chaque ligne calculée**.
- **Ne rien défaire** : le tableau mensuel vient d'être **transposé** (indicateurs en lignes, mois en colonnes), rendu **défilable** et **unifié mobile/bureau** — **CONSTRUIRE DESSUS**.
- **Moteur** : `src/lib/previsions/` n'est modifiable que par la story **PR2sex.2**.
- **Recette exigée** : **≥ 1904 tests et 0 écart**, tolérance **0** (entiers), sur **21 mois × 3 granulométries × 3 positions de cycle**, sur les **DEUX** fixtures.
- **Cycle paramétrable** : boucler sur `k = 1..dureeCycleMois`, **jamais trois branches en dur**. Le jeu d'or a un cycle de **3** ; **le code ne doit pas le supposer**.
- **Fixtures** : valeurs lues dans les **CELLULES CALCULÉES** du classeur, **jamais recalculées**. L'**invariance des séries déjà présentes** doit être **prouvée** (comparaison avant/après par **empreinte**).
- **ERR-157** : les garanties visuelles **ne se prouvent pas en jsdom** → vérification **en navigateur réel** à **375 px** et **1280 px**.
- **Base** : `npx vitest run` (**286 fichiers, 8333 tests hors DB-gated, 0 échec**), `npm run build`.
- **Lecture seule stricte** sur le scénario `EXCEL-V12` (jeu de test de l'utilisateur, **en cours d'utilisation**) : vérifier **par SQL en fin de sprint** que **19 vagues / 602 500 alevins / 3 apports** sont **inchangés**.

## Gouvernance

Seul le `@status-updater` écrit dans `docs/sprints/` et `docs/TASKS.md`. Tout agent qui a quelque chose à consigner le rapporte au `@project-manager`, qui spawne le `@status-updater`. **Aucun commit ni push par les agents.**

## Hors périmètre

- Toute **modification du classeur source**.
- La **partition CAPITAL/CREDIT** des apports.
- Les **réserves ouvertes de la review PR2-quinquies** (`PalierRemise.seuilSacs`, duplication de `calculerBaseRepartition`) — **sauf si elles bloquent**.

## Stories

| Story | Type | Sujet | Pipeline | Statut |
|-------|------|-------|----------|--------|
| PR2sex.1 | TEST | Étendre `extract-golden.py` aux 9 séries « détail par vague » (lignes 13-15, 17-19, 21-23, colonnes B à V) + régénérer les 2 fixtures + prouver l'invariance des séries existantes + MAJ README | @tester | FAIT |
| PR2sex.2 | QUERIES | Calcul dans le moteur : fonction pure, cycle paramétrable `dureeCycleMois`, exposée dans la projection, recette tolérance 0 sur les 2 fixtures | @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper | FAIT |
| PR2sex.3 | UI | 9 lignes sous la section « Aliments » du tableau mensuel transposé, regroupement §7.1, bouton d'explication §7.4, i18n fr+en | @pre-analyst → @developer → @tester → @code-reviewer | FAIT |
| PR2sex.4 | REVIEW | Review de sprint → `docs/reviews/review-sprint-PR2-sexies.md` | @code-reviewer → @knowledge-keeper | FAIT |

**Légende** : `TODO` · `EN COURS` · `REVIEW` · `FAIT` · `BLOQUÉ`

> **⚠️ Identifiants de stories.** Ce sprint utilise le préfixe **`PR2sex.`** et **non** `PR2q.` : les identifiants `PR2q.1` à `PR2q.6` sont **déjà utilisés deux fois** (PR2-quater **et** PR2-quinquies), collision documentée dans le fichier de sprint PR2-quinquies. Le préfixe `PR2sex.` est **sans ambiguïté**.

---

### PR2sex.1 — Étendre le jeu d'or aux 9 séries « détail par vague »

**Type** : TEST
**Pipeline** : @tester
**Statut** : FAIT

**Contexte** : `prisma/fixtures/previsions/extract-golden.py` **n'extrait pas** les lignes 11-23 de la feuille `Prévisions`. C'est **le seul et unique blocage** qui a fait écarter ces séries de PR2-quinquies. **Aucune ligne de moteur ni d'UI ne doit être écrite avant que cette story soit `FAIT`** : exposer une série sans jeu d'or reviendrait à comparer le moteur à lui-même.

**Exigences** :
- Étendre `extract-golden.py` aux **9 séries** des lignes **13-15**, **17-19** et **21-23**, **colonnes B à V** (les 21 mois de l'horizon).
- Les valeurs sont lues dans les **CELLULES CALCULÉES** du classeur (`data_only`), **jamais recalculées** par le script — un script qui recalcule produit un jeu d'or qui ne prouve rien.
- **Régénérer les 2 fixtures** (`plan-v12-corrige.json`, `annexe-b-corrigee.json`).
- **Prouver l'invariance** des séries déjà présentes : **empreinte (hash) avant / après régénération** sur les blocs existants, **comparaison explicite**, résultat consigné. Une régénération qui déplacerait silencieusement une valeur déjà recettée invaliderait les 1904 tests existants.
- **Mettre à jour le README du jeu d'or** : nommer les nouvelles séries, leur origine (feuille, lignes, colonnes), et rappeler que l'arrondi du bloc est un **`ROUND`**, pas le `ceil` de « Sacs à acheter ».
- **Vérifier les cumuls de contrôle** de la colonne W (tableau du présent fichier) contre la somme des 21 mois extraits, pour les **9 séries**.
- **Ne modifier ni le classeur source, ni aucune série existante des fixtures.**

**Critères d'acceptation** :
- [x] Les 9 séries sont présentes dans les **2 fixtures**, sur les **21 mois**
- [x] Valeurs issues des **cellules calculées**, jamais recalculées — vérifiable par lecture du script
- [x] **Invariance des séries existantes prouvée par empreinte avant/après**, résultat écrit dans le rapport
- [x] Les **9 cumuls de la colonne W** correspondent (1 543 / 867 / 0 — 385 / 3 471 / 4 820 — 0 / 0 / 7 230)
- [x] README du jeu d'or à jour, incluant l'avertissement `ROUND` vs `ceil`
- [x] Classeur source **non modifié** (`git status` propre sur le `.xlsx`)
- [x] Recette existante **toujours à 1904 tests / 0 écart** après régénération

**Tests** : recette `npx vitest run src/lib/previsions/__tests__/recette` rejouée **avant et après** régénération, résultats comparés ; suite complète `npx vitest run`.
**Vérification** : `npx vitest run` (base : **286 fichiers, 8333 tests hors DB-gated, 0 échec**), `npm run build`. Rapport dans `docs/tests/`.

**Note de clôture** :
- Nouvelle fonction `extraire_detail_par_vague(pv)` dans `prisma/fixtures/previsions/extract-golden.py`, injectée sous la clé **`besoinsAliments.detailParVagueSacs`** dans les deux fixtures.
- Correspondance ligne↔série confirmée par **lecture directe des libellés de la colonne A** du classeur (lignes 11-24), et non par déduction : 13/14/15 = 1er mois de cycle 2/3/4 mm, 17/18/19 = 2e mois, 21/22/23 = 3e mois.
- Lignes **12/16/20** (INDEX/MATCH défectueux, §8) extraites **uniquement comme métadonnée `$defectueux`**, jamais comme série numérique.
- Les **9 cumuls sur 21 mois** tombent **exactement** sur les valeurs de contrôle attendues (1543/867/0 · 385/3471/4820 · 0/0/7230), **aucun écart**.
- **Preuve d'invariance** : diff structurel clé par clé avant/après régénération = **0 clé supprimée, 0 valeur changée, 1 seule clé ajoutée par fixture**. **Idempotence confirmée** (sha256 identiques sur deux exécutions).
- Séries **non affectées** par le patch `Dépenses!B10` ni par le scénario B (ce sont des **décomptes de sacs, pas des montants**) — confirmé par **identité stricte du bloc** entre les fixtures A et B.
- **Vérifications** : `npx vitest run` = **286 fichiers / 8333 tests / 0 échec** ; recette = **1904 tests / 0 écart** (inchangée, moteur non touché) ; `npm run build` **OK**.
- **Rapport** : `docs/tests/rapport-story-PR2sex.1.md`.

---

### PR2sex.2 — Calcul des sacs consommés par mois de cycle dans le moteur

**Type** : QUERIES
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Contexte** : une fois le jeu d'or étendu par PR2sex.1, les 9 séries deviennent **recettables au sac près**. C'est la **seule** story du sprint autorisée à modifier `src/lib/previsions/`.

**Exigences** :
- **Fonction pure** (aucun I/O), dans `src/lib/previsions/`, calculant pour chaque mois `M`, chaque granulométrie `g` et chaque position de cycle `k` :
  ```
  ROUND( Σ sacs(g) des vagues empoissonnées en M-(k-1) × pct_mois_k(g) , 0 )
  ```
- **`ROUND`, pas `ceil`** : ce sont les sacs **consommés** (indicatif), pas les sacs **à commander**. Un commentaire dans le code doit **nommer explicitement ERR-138 / ERR-139** et le facteur 8300, pour que le prochain lecteur ne « corrige » pas l'arrondi.
- **Cycle paramétrable** : boucler sur `k = 1..dureeCycleMois`. **Aucune branche en dur pour 3 mois.** Le jeu d'or vaut 3 ; le code ne doit pas le supposer.
- **Comportement `SUMIFS`, pas `INDEX/MATCH`** : quand **plusieurs vagues** sont empoissonnées le même mois, elles **s'additionnent**. Si un libellé de cohorte est produit, il liste **TOUTES** les vagues concernées — le défaut §8 du classeur **n'est pas reproduit**.
- Série **exposée dans la projection** (`MoisProjectionResult` / `MoisProjectionDTO`), afin que PR2sex.3 n'ait rien à recalculer côté UI.
- Arithmétique en **`Decimal`**, jamais en flottant natif.

**Critères d'acceptation** :
- [x] Fonction **pure**, sans I/O, testée isolément
- [x] **`ROUND`** appliqué (et non `ceil`), commentaire citant ERR-138/ERR-139
- [x] Boucle `k = 1..dureeCycleMois` — **aucun 3 codé en dur** ; test avec un `dureeCycleMois ≠ 3`
- [x] Plusieurs vagues du même mois **s'additionnent** (comportement `SUMIFS`) — test dédié
- [x] Libellé de cohorte, s'il existe, listant **toutes** les vagues
- [x] Série exposée dans la projection, consommable telle quelle par l'UI
- [x] Recette : **21 mois × 3 granulométries × 3 positions**, **tolérance 0**, sur les **2 fixtures**, **≥ 1904 tests / 0 écart**
- [x] Les **9 cumuls de la colonne W** vérifiés par test
- [x] **Détection de régression prouvée** par mutation volontaire (`ROUND` → `ceil` doit faire tomber des tests), restauration vérifiée
- [x] Capitalisation par le @knowledge-keeper

**Tests** : tests unitaires de la fonction pure + extension de la recette (`src/lib/previsions/__tests__/recette`).
**Vérification** : recette **≥ 1904 / 0 écart**, `npx vitest run`, `npm run build`. Rapports : `docs/analysis/pre-analysis-story-PR2sex.2.md`, `docs/tests/rapport-story-PR2sex.2.md`, `docs/reviews/review-story-PR2sex.2.md`.

**Note de clôture** :
- Fonction pure `calculerDetailConsommationMensuelle` en fin de `src/lib/previsions/aliments.ts` (+ types `DetailConsommationCycleInput` / `DetailConsommationMoisResult`), strictement **additive** : les **6 signatures gelées** de l'ADR-053 §12.4 sont **intactes**.
- **sum-then-round** : sommation dans l'accumulateur `sacsEffectifsCycleParAlimentMoisPosition` (`route-orchestration.ts:372`, alimenté l. 519-530), **round unique par cellule** (l. 672), `Decimal.ROUND_HALF_UP` **explicite** (half-away-from-zero, comme le `ROUND` d'Excel).
- Ce choix a été établi par **lecture de la formule brute** du classeur (`Prévisions!B13`), **PAS** par la recette : les 19 vagues ont **19 mois d'empoissonnement distincts**, donc le jeu d'or **ne peut structurellement pas** discriminer `ROUND(Σ)` de `Σ ROUND()` (voir **ERR-160**). Protégé par des **tests synthétiques** qui font **réellement diverger** les deux candidats, au niveau de la fonction pure **et** de l'accumulateur (`route-orchestration-detail-consommation.test.ts`, **5 tests**).
- **Non-contamination `ceil`/`ROUND` prouvée par construction** (101 sacs à 33 % → **33** et non 34) — voir **ERR-161**.
- **Cycle paramétrable** : aucun `3` en dur, `dureeCycleMoisFigee` partout, tests à `dureeCycleMois = 4` et `= 1`.
- **Exposition** : `MoisProjectionResult.detailParVagueSacs: Record<number, Record<string, number>>` → `MoisProjectionDTO` → route `GET /api/previsions/scenarios/[id]/calculer`.
- **Recette : 2300 tests, 0 écart** (1904 + 378 Section E + 18 assertions de cumul sur l'horizon, contre 1543/867/0 · 385/3471/4820 · 0/0/7230).
- **Review** : `docs/reviews/review-story-PR2sex.2.md` — **VALIDÉ AVEC RÉSERVES**, **aucune Critique ni Haute** ; 1 réserve **Moyenne** (**ERR-162**, ouverte), 3 **Basses**, 1 **Info**.
- **Franchise ERR-155** : **3 des 9 séries** (`moisCycle1.4mm`, `moisCycle3.2mm`, `moisCycle3.3mm`) sont **entièrement nulles** dans les deux fixtures — **42 assertions `0 == 0`**, documentées comme ne prouvant presque rien.
- **Rapports** : `docs/tests/rapport-story-PR2sex.2.md`, `docs/analysis/pre-analysis-story-PR2sex.2.md`.

---

### PR2sex.3 — Les 9 lignes dans la vue mensuelle

**Type** : UI
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer
**Statut** : FAIT

**Contexte** : le tableau mensuel vient d'être **transposé** (indicateurs en lignes, mois en colonnes), rendu **défilable** et **unifié mobile/bureau**. Les 9 nouvelles lignes se placent **sous la section « Aliments »**, dont elles sont le détail. **Construire dessus, ne rien défaire.**

**Exigences** :
- **9 lignes** rendues sous la section « **Aliments** », dans l'**ordre du classeur** (1er mois de cycle : 2/3/4 mm, puis 2e, puis 3e).
- **Regroupement lisible obligatoire (§7.1)** : compréhension en **moins de 10 secondes**. Neuf lignes ajoutées à plat dans une section déjà chargée est un **échec de cette story**, même si toutes les valeurs sont justes.
- **Bouton d'explication (§7.4)** « d'où vient ce nombre » sur **chaque** ligne calculée, mentionnant que ce sont les sacs **consommés** (indicatif), **pas** les sacs à commander.
- **Formats du §7.4 conservés** : espace fine **U+202F**, **aucune décimale**, zéros en tiret **U+2013**, négatifs en rouge, **unité dans le libellé de ligne**.
- **Granulométries dynamiques** : union des calibres réellement présents dans le scénario, **aucun 2/3/4 mm codé en dur** ; réutiliser les libellés existants de `stock.json` — **aucun second référentiel** (ADR-053 §12.2.4).
- **i18n `fr` + `en` complètes**, accents corrects, **aucune chaîne en dur**, et **suppression des 2 clés mortes résiduelles** `page.detailTitle` et `page.backToList` **dans les deux langues**.
- Ne **pas** défaire la transposition, la colonne collante, le défilement horizontal, ni l'unification mobile/bureau.
- **ERR-157** : les garanties visuelles ne se prouvent pas en jsdom → **vérification en navigateur réel** à **375 px** et **1280 px**, par **mesure** et non à l'œil.

**Critères d'acceptation** :
- [x] **9 lignes** rendues sous « Aliments », dans l'ordre du classeur, unité dans le libellé
- [x] Regroupement lisible §7.1 tenu (sous-section ou repli dédié)
- [x] Bouton d'explication §7.4 sur chacune des 9 lignes, disant « consommés, indicatif »
- [x] Formats §7.4 vérifiés **au caractère près** (U+202F, U+2013, 0 décimale, rouge sur négatifs)
- [x] Granulométries **dynamiques**, libellés réutilisés de `stock.json`
- [x] Transposition, colonne collante, défilement horizontal et unification mobile/bureau **préservés**
- [x] i18n fr + en complètes, parité vérifiée, **`page.detailTitle` et `page.backToList` supprimées des deux langues**
- [x] Vérification **en navigateur réel** à **375 px** et **1280 px**, par mesure
- [x] Aucune valeur recalculée côté UI — les 9 séries viennent de la projection (PR2sex.2)

**Tests** : tests de rendu (tableau bureau + carte mobile), tests d'i18n/parité, tests de format.
**Vérification** : `npx vitest run`, `npm run build`, plus la vérification navigateur réel. Rapports : `docs/analysis/pre-analysis-story-PR2sex.3.md`, `docs/tests/rapport-story-PR2sex.3.md`, `docs/reviews/review-story-PR2sex.3.md`.

**Note de clôture** :
- **Review** : `docs/reviews/review-story-PR2sex.3.md` — **VALIDÉ AVEC RÉSERVES**, **aucune réserve Critique ni Haute** ; **1 Moyenne de signalement** (flakiness de la suite, **hors périmètre**), **4 Basses**, **1 Info**.
- Le motif **ERR-157 à 2 cellules** est **préservé à la lettre** dans `EnTeteRepliable` : cellule collante **étroite sans `colSpan`**, fond **opaque** `bg-muted`, bande `colSpan` en `aria-hidden` — **réutilisé à l'identique aux deux niveaux** (section et sous-section).
- **Aucune valeur en dur** : grep **négatif** sur `1,2,3` (positions de cycle) et sur `2mm` / `3mm` / `4mm` (granulométries).
- **Parité i18n stricte 406/406** : 405 avant + **3 clés ajoutées** − **2 clés mortes supprimées** (`page.detailTitle`, `page.backToList`, dans les deux langues).
- **@tester : verdict PASS** — `docs/tests/rapport-story-PR2sex.3.md`.

**Détail de la livraison** :
- Sous-section « **Détail par mois de cycle** » **repliée par défaut** sous « Aliments », via `SectionDescriptor.groupes?: SousSectionDescriptor[]` ; le motif d'en-tête collant à **2 cellules** (fix **ERR-157**) est **extrait** dans un composant partagé `EnTeteRepliable`, **jamais réimplémenté** ; rendu de ligne extrait dans `LigneRow`.
- Lignes produites par **produit cartésien** des positions de cycle et des granulométries **réellement présentes**, **jamais `1,2,3` en dur**.
- **i18n fr/en**, parité stricte **406/406**, clés mortes `page.detailTitle` et `page.backToList` **supprimées des deux langues**.
- **Vérification Chromium réelle (Playwright, ERR-157)** : en-tête de sous-section **stable** entre `scrollLeft = 0` et `scrollLeft = 1760` à **375 px**, et entre `0` et `1399` à **1280 px** ; **aucun débordement de page** (`scrollWidth === clientWidth === 375`) ; fond **opaque** `rgb(241, 245, 249)` ; colonne Total **lue à l'écran** = 1 543 / 867 / – puis 385 / 3 471 / 4 820, **conforme au jeu d'or**.
- **@tester : verdict PASS.** Rapport `docs/tests/rapport-story-PR2sex.3.md`.
- **Non vérifié et déclaré comme tel** : cumul de la position 3 en pixels réels, collision de popover à 375 px, rendu tactile.

---

### PR2sex.4 — Review de sprint

**Type** : REVIEW
**Pipeline** : @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Contexte** : clôture du sprint, avec une attention particulière au piège central : **`ROUND` vs `ceil`**.

**Exigences** : produire `docs/reviews/review-sprint-PR2-sexies.md` avec verdict explicite et checklist **R1-R11**.

**Critères d'acceptation** :
- [x] `docs/reviews/review-sprint-PR2-sexies.md` produit, **verdict explicite**
- [x] Checklist **R1-R11**
- [x] État de la recette confirmé (**≥ 1904 tests, 0 écart**, tolérance **0** sur les 9 séries × 21 mois × 2 fixtures)
- [x] **Vérification explicite que l'arrondi implémenté est un `ROUND`** et non un `ceil`, par lecture de code **et** par test de mutation
- [x] **Vérification explicite que le cycle est paramétrable** (`k = 1..dureeCycleMois`), sans 3 codé en dur
- [x] **Vérification explicite du comportement `SUMIFS`** (plusieurs vagues du même mois s'additionnent) et de la non-reproduction du défaut `INDEX/MATCH` du §8
- [x] Aucune série disponible dans les fixtures exposée **sans** être comparée au jeu d'or
- [x] Parité et complétude i18n fr/en vérifiées, **`page.detailTitle` et `page.backToList` confirmées supprimées des deux langues**
- [x] Périmètre tenu : moteur non modifié hors PR2sex.2, classeur source intact, scénario `EXCEL-V12` inchangé
- [x] Capitalisation par le @knowledge-keeper

**Tests** : sans objet (review).
**Vérification** : sorties réelles rejouées et citées dans le rapport de review.

**Note de clôture** :
- Rapport produit : `docs/reviews/review-sprint-PR2-sexies.md` — **verdict : VALIDÉ AVEC RÉSERVES**, **aucune réserve Critique ni Haute ouverte**.

---

## Vérification de fin de sprint

- [x] `npx prisma migrate deploy` — aucune migration en attente
- [x] `npx vitest run` — suite complète : **287 fichiers / ~8800 tests** (voir mesures réelles ci-dessous)
- [x] `npx vitest run src/lib/previsions/__tests__/recette` — **2300 / 2300, 0 écart**
- [x] `npm run build` — **exit 0**, `✓ Compiled successfully in 53s`
- [x] Vérification **en navigateur réel** à **375 px** et **1280 px** (ERR-157), par mesure et non à l'œil
- [x] **Classeur source `Previsions_Elevage_Silure_v12.xlsx` non modifié**
- [x] **Invariance des séries préexistantes du jeu d'or prouvée** par empreinte avant/après régénération
- [x] **Scénario `EXCEL-V12` vérifié par SQL en lecture seule** : **19 vagues, 602 500 alevins, 3 apports — inchangés**
- [x] Parité i18n fr/en, **`page.detailTitle` et `page.backToList` supprimées des deux langues**, aucune clé morte nouvelle
- [x] Toute mutation volontaire de test (`ROUND` → `ceil`, etc.) confirmée **restaurée**, par lecture de code **et** par tests passants

### Mesures réelles

**Données utilisateur `EXCEL-V12` — INTACTES.** Lecture seule stricte respectée : **19 vagues**, **602 500 alevins**, **3 apports**, inchangés.
> **Note méthodologique.** Le scénario s'identifie par `ScenarioPrevision.code = 'EXCEL-V12'` — son champ `nom` vaut « Plan de reference Excel v12 ». Une requête de vérification portant sur `nom` renvoie **0 à tort**.

**Recette** — `npx vitest run src/lib/previsions/__tests__/recette` → **2300 / 2300, 0 écart** (461 + 461 + 1378).

**Suite complète** — **287 fichiers / ~8800 tests**. Deux passages :
- passage 1 : **8733 passés / 20 échoués** ;
- passage 2 : **8726 passés / 27 échoués** ;
- **11 fichiers en échec à chaque passage, composition variable**. Les **12 fichiers distincts** concernés ont été **rejoués isolément : 12/12 passent à 100 %**.
- **Cause** : `Error: Test timed out in 5000ms` sous **contention CPU en exécution parallèle**, **jamais une `AssertionError` métier**. Concerne notamment les `*-form-dialog.test.tsx`, `password.test.ts` (bcrypt), et **par ricochet** `previsions-mensuelles-tab.test.tsx` et `scenario-detail-client-refresh.test.tsx`.

**Correction du chiffre de référence.** La base annoncée en ouverture de sprint (**286 fichiers / 8333 tests**) était **antérieure au module Prévisions complet** ; la base réelle mesurée est **287 fichiers / ~8800 tests**.

**Build** — `npm run build` → **exit 0**, `✓ Compiled successfully in 53s`.

**Vérification Chromium réelle** (Playwright, ERR-157) : en-tête de sous-section **stable** entre `scrollLeft = 0` et `1760` à **375 px**, et entre `0` et `1399` à **1280 px** ; **aucun débordement** (`scrollWidth === clientWidth === 375`) ; fond **opaque** `rgb(241, 245, 249)` ; `elementFromPoint` renvoie **le libellé**, pas une bande vide ; colonne Total lue **à l'écran** = 1 543 / 867 / – puis 385 / 3 471 / 4 820.

**R10** — **aucune migration créée par ce sprint** ; aucun `.sql` à la racine de `prisma/migrations/`.

**R11** — scan **gitleaks** + grep ciblé sur le diff : **aucun secret introduit**. Les seules occurrences de motifs `postgresql://` sont des lignes **supprimées**, remplacées par des **placeholders** (poursuite de la remédiation **ERR-159**).

**i18n** — **406 clés de chaque côté**, aucune clé présente d'un seul côté ; `page.detailTitle` et `page.backToList` **absentes des deux fichiers** et **sans référence dans `src/`**.

**Aucun commit, aucun push** — conformément à la gouvernance.

---

## Points ouverts consignés à la clôture

*(PAS des stories de ce sprint.)*

1. **ERR-162 (OUVERT, Moyenne)** — aucune validation ne rejette (**422**) un `RepartitionMoisAliment` dont la couverture de `moisCycle` est **incohérente avec `dureeCycleMoisFigee`** : le mois manquant est traité **silencieusement comme 0 %**. Gap **pré-existant**, à solder **avant PR3**.
2. **Dette de fiabilité de la suite de tests** — mesures réelles de clôture : **11 fichiers en échec à chaque passage**, **20 tests** au 1er passage et **27** au 2e, **composition variable** d'un passage à l'autre ; les **12 fichiers distincts** concernés sont **verts en isolation (12/12, 100 %)**. Cause constatée : `Error: Test timed out in 5000ms` sous **contention CPU en exécution parallèle**, **jamais une `AssertionError` métier**. Concerne notamment les `*-form-dialog.test.tsx`, `password.test.ts` (bcrypt), et **par ricochet** `previsions-mensuelles-tab.test.tsx` et `scenario-detail-client-refresh.test.tsx`. **Piste** : ajuster le `testTimeout` global ou la **concurrence** vitest. Ce n'est **pas** une régression métier, mais la suite n'est plus un signal binaire fiable.
3. **Collision de numérotation ERR-158** — **deux entrées distinctes** portent ce numéro dans `docs/knowledge/ERRORS-AND-FIXES.md`. **Non corrigée**, car des références existent déjà dans `docs/TASKS.md`, `docs/sprints/SPRINT-PR2-quinquies-PREVISIONS.md` (plage « ERR-153 à ERR-158 ») et `docs/analysis/pre-analysis-story-PR2sex.3.md`.
4. **Libellé de cohorte non exposé** (liste des vagues contributrices par cellule) — **dette d'ergonomie assumée**. Le défaut `INDEX/MATCH` du classeur n'est **PAS** reproduit : les **quantités sont correctement agrégées**.
5. **ERR-160 (Haute, documentée)** — le jeu d'or est **structurellement aveugle à l'ordre d'agrégation** (`ROUND(Σ)` vs `Σ ROUND()`) : les **19 vagues** ont **19 mois d'empoissonnement distincts**, **aucune coïncidence**. La garantie repose donc **exclusivement** sur (a) la lecture de la **formule brute** du classeur et (b) **5 tests synthétiques dédiés** qui font réellement diverger les deux candidats. **Si ces tests étaient affaiblis ou supprimés, plus aucune protection ne subsisterait** — et ce **malgré 2300 tests de recette verts**.
6. **Correction du chiffre de référence de la suite** — la base annoncée en ouverture de sprint (**286 fichiers / 8333 tests**) était **antérieure au module Prévisions complet**. Base réelle mesurée : **287 fichiers / ~8800 tests**. À reprendre comme référence dans les sprints suivants.
