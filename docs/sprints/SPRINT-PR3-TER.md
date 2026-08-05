# Sprint PR3-ter — Achever le §6 : portée du mapping, trésorerie à trois séries, reprévision glissante

**Statut du sprint : FAIT**

## Contexte

Le module Prévisions est commité (`8bba209`). Le rapprochement, le moteur d'écarts, quatre vues
et l'écran d'administration du mapping sont livrés et vérifiés en navigateur. Il reste deux choses
de nature très différente — la story A est **prioritaire** car elle **produit des chiffres faux en
silence**, la story B est une fonctionnalité absente.

## Stories

| Story | Titre | Type | Agent | Statut | Dépendances |
|---|---|---|---|---|---|
| **PR3ter.A1** | Pré-analyse de la portée du mapping : trancher la correction structurelle (`MappingRapprochement.cibleId` site-scopé vs `PostePrevision`/`AlimentPrevision` scénario-scopés, ADR-053 §3.9) | ANALYSE | @pre-analyst | FAIT | Aucune |
| **PR3ter.A2** | Correction structurelle de la portée du mapping, compatible avec le versionnage §6.2 (« changer un mapping ne doit pas réécrire l'historique des écarts figés ») | à déterminer par A1 | à déterminer par A1 | FAIT (moitié `ALIMENT_PREVISION` livrée ici ; moitié `POSTE_PREVISION` **livrée depuis** par la story A.4 — sprint PR3-quater, cf. `docs/TASKS.md`) | PR3ter.A1 |
| **PR3ter.A3** | Filet de sécurité **non négociable** : détection explicite et signalement à l'écran d'une cible de mapping orpheline. Un mapping dont la cible n'existe plus doit **se voir, pas s'évaporer** | API+UI | @developer | FAIT | PR3ter.A1 |
| **PR3ter.A4** | Tests de la portée du mapping, dont la preuve que le montant réel ne disparaît plus silencieusement | TEST | @tester | FAIT | PR3ter.A2, PR3ter.A3 |
| **PR3ter.B1** | Pré-analyse : ce que `SnapshotBudgetInitial` et `ClotureMois` portent **réellement**, avant que l'UI ne raconte quoi que ce soit | ANALYSE | @pre-analyst | FAIT | Aucune |
| **PR3ter.B2** | Backend des trois séries : BUDGET INITIAL (figé, conservé, consultable) / PRÉVISION ACTUALISÉE (réel substitué aux mois clos, trajectoire recalculée) / RÉEL | à déterminer par B1 | @db-specialist ou @developer | FAIT | PR3ter.B1 |
| **PR3ter.B3** | Vue trésorerie §6.5 : courbe prévue vs réelle avec **bande d'écart** (§6.4 vue 4), **zone sous zéro colorée** comme sur le tableau de bord, option « **Reprévision** » déclenchant la substitution | UI | @developer | FAIT | PR3ter.B2 |
| **PR3ter.B4** | Tests : prouver que **le gel mord** — modifier la prévision après clôture ne doit **pas** changer le budget initial | TEST | @tester | FAIT | PR3ter.B2, PR3ter.B3 |
| **PR3ter.C1** | `getDepensesAlimentReellesParGranulometrie` produit une nature `DEPENSE` sous une clé `MOUVEMENT_STOCK` : sans effet aujourd'hui (non branchée), **collision si une story la branche** | BUGFIX | @developer | FAIT | Aucune |
| **PR3ter.C2** | « Total du mois » et « Top écarts » mélangent **FCFA et kg** sous un tri unique | BUGFIX | @developer | FAIT | Aucune |
| **PR3ter.C3** | `GET ?version=N` existe mais reste inutilisé : l'écran ne montre que la version active, pas l'historique. §6.2 parle d'un mapping versionné — consulter une version passée a du sens | UI | @developer | FAIT | Aucune |
| **PR3ter.C4** | **ERR-176** : `vente-detail-client.tsx` et `depense-vente-dialog.tsx` portent des tables `CATEGORIE_LABELS` codées en dur et non accentuées, doublons du référentiel i18n ; et `/depenses` affiche encore « Depenses », « payee », « recurrentes configurees » | BUGFIX | @developer | FAIT | Aucune |
| **PR3ter.R** | Review de sprint (R1-R11, rendu réel 375px et 1280px) | REVIEW | @code-reviewer | FAIT | Toutes les précédentes |

Les stories C sont **à traiter si le sprint le permet**, et tout report doit être **dit
explicitement**, pas passé sous silence.

## Contraintes du sprint

- **Méthode de test, valable pour tout le sprint** : `npx vitest run` doit **toujours** être lancé
  avec `DATABASE_URL` exportée. Sans elle, les tests adossés à la base — dont la preuve
  d'immuabilité du mapping face à la clôture — sont **silencieusement ignorés, pas en échec** (cf.
  ERR-116). Base de référence **avec** la variable : **306 fichiers / 9 413 tests / 0 skip /
  0 échec**.
- **Pas de jeu d'or** (ERR-172) : fixtures construites pour faire **diverger** les implémentations
  candidates, falsification systématique, restauration vérifiée par `git diff`. Si une mutation ne
  fait tomber **aucun** test, il faut **le dire** comme PR3-bis l'a fait pour sa falsification (j),
  pas l'arrondir.
- Piège **ERR-160** : un test qui passerait dans les deux cas ne prouve rien.
- **`src/lib/previsions/`** est un moteur pur protégé — recette **≥ 2 709 assertions, 0 écart**.
  Toute nécessité d'y toucher rouvre la pré-analyse, ne se contourne pas.
- **Lecture seule stricte sur le domaine réel** (`Depense`/`Vente`/`MouvementStock`), ADR §5.1(a)
  et §15.6.
- **`EXCEL-V12` est le plan de référence de l'utilisateur : lecture seule stricte**, aucune écriture
  sous aucun prétexte.
- **i18n fr + en complète**, aucun libellé en dur.
- **Mobile first 375px** + desktop 1280px, cartes empilées, pas de tableau (CLAUDE.md).
- **R5** `DialogTrigger asChild`, **R6** variables CSS du thème, **R8** siteId, **R11** aucun secret
  en dur.
- Si un écran est vide faute de données, créer un scénario jetable **sur un site isolé**, montrer
  l'écran peuplé, **nettoyer et le prouver par comptage SQL**.

## Critères de fin de sprint

- `npx prisma migrate deploy`
- `npx vitest run` **avec `DATABASE_URL`**, **trois passages consécutifs**, **0 échec et 0 skip**
- Recette **≥ 2 709 / 0 écart**
- `npm run build`
- Rendu vérifié en **navigateur réel** à **375 px et 1280 px** (ERR-157)
- **`EXCEL-V12` inchangé**, vérifié par comptage SQL **avant/après** : 19 vagues / 602 500 alevins,
  3 calibres, 4 paliers, apports **30 000 000**, journal **34 400 000**, charges **20 580 000**,
  `ParametresPrevision` **colonne par colonne**, et **`MappingRapprochement` à 0 ligne**
- Le **chemin utilisateur à rejouer** doit être documenté explicitement pour que l'utilisateur
  refasse le parcours lui-même dans le navigateur avant tout commit
- **Aucun commit, aucun push** dans ce sprint

## Clôture du sprint — mesures réelles

- **Tests** : 3 passages consécutifs de `npx vitest run` **strictement identiques** — **325 fichiers /
  9 532 tests, 26 todo, 0 skip, 0 échec**. Mesures obtenues avec `DATABASE_URL` exportée ; sans elle,
  les tests DB-gated sont **silencieusement ignorés, pas en échec** (cf. **ERR-116**). Méthode
  d'export qui fonctionne sur cette machine : `set -a && source .env && set +a` — `xargs -d` (GNU)
  échoue silencieusement sur le `xargs` BSD de macOS et n'exporte rien.
- **Recette du moteur** : `src/lib/previsions/` → **2 709 / 2 709, 0 écart**. **Aucun fichier du
  moteur modifié** — `git diff --stat src/lib/previsions/` **vide**, vérifié à plusieurs reprises.
- **Build** : `npm run build` → **EXIT=0**.
- **Migrations** : `npx prisma migrate deploy` → **aucune migration en attente** (170 migrations).
  **Aucun changement de schéma dans ce sprint** ; aucun correctif R10 nécessaire,
  `MappingRapprochement` étant à 0 ligne.
- **Story A (portée du mapping)** : moitié **`ALIMENT_PREVISION` corrigée structurellement** par une
  clé métier stable (`tailleGranule`, résolution dynamique à la lecture vers le scénario courant) ;
  Zod durci rejetant l'ancien format brut. Moitié **`POSTE_PREVISION` non corrigée dans ce sprint**,
  **corrigée depuis** par la **story A.4** (sprint PR3-quater, `FAIT` le 2026-08-05) — voir Points
  ouverts. **Filet de sécurité livré pour les deux types** : `cibleOrpheline` détecté côté queries
  (`previsions-mapping-orphelins.ts`, moteur non touché), exposé par
  `GET /api/previsions/mapping-rapprochement?scenarioId=`, affiché comme état **distinct** de
  `NON_RAPPROCHE` (ERR-173) et de `cibleIntrouvable`/`cibleNonChargee` (ERR-177/178).
- **Story B (§6.5)** : trois séries livrées — **BUDGET INITIAL lu depuis `SnapshotBudgetInitial`,
  jamais recalculé**, **PRÉVISION ACTUALISÉE**, **RÉEL netté**. Reprévision glissante en fonction pure
  de présentation (`src/lib/previsions-presentation/`, hors moteur). Vue : courbe prévue vs réelle
  avec **bande d'écart**, **zone sous zéro** réutilisant la technique du tableau de bord (gradient
  extrait, pas dupliqué), bascule « Reprévision ». **Le gel mord, prouvé** : `budgetInitialFCFA`
  recalculé à la volée au lieu d'être lu → **2 assertions tombent**.
- **Story C** : **C.1** collision de clé éliminée (`DEPENSE_CATEGORIE` + `sourceCle` composé) ;
  **C.2** FCFA et kg **séparés** en totaux et en tris (`partitionnerParGrandeur`) ; **C.3** consultation
  de l'historique des versions de mapping, **version passée en lecture seule stricte** ; **C.4** dette
  ERR-176 résorbée (Ventes/Dépenses accentués, `CATEGORIE_LABELS` supprimées), plus un défaut de la
  même famille trouvé en navigateur et corrigé (`vente-detail-client.tsx:818`, enum brut « PAYEE »).
- **Falsification** : rapport dédié produit — `docs/tests/rapport-falsification-sprint-PR3-ter.md`.
  Les mutations y sont **rejouées par un tiers**, pas recopiées des rapports d'implémentation. Deux
  écarts sont **signalés, non arrondis** : (a) C.2 « formatage par nature → 2/2 » était **non
  reproductible** car **aucun test ne couvrait `rapprochement-lignes-liste.tsx`** — trou comblé
  depuis, mutation groupée mesurée à **6/23** ; (b) B.5, chiffres annoncés 3/6 et 1/8 et 1/8,
  **remesurés à 1/8 pour les trois**, divergence non expliquée. Une **falsification à 0 test** est
  documentée comme telle : neutraliser `versionParMois`/`versionsDistinctes` fait tomber 1 assertion
  au niveau du rapprochement mais **0** au niveau agrégé de la trésorerie,
  `netterTresorerieReelleParMois` sommant `RAPPROCHE` et `NON_RAPPROCHE` dans le même total nette
  (§15.5) — non discriminable à cette couche.
- **Vérification en navigateur réel** (Chromium/Playwright, **ERR-157**) : **375 px et 1280 px**. Vue
  Trésorerie peuplée avec les trois séries et la bascule Reprévision (scénario jetable activé, mois
  clos) ; sous-onglet Mapping avec sélecteur de version, bandeau de lecture seule et **zéro bouton
  d'écriture** sur une version passée ; libellés accentués sur `/depenses`, `/depenses/recurrentes` et
  le détail vente. **Aucun débordement horizontal de page** (`documentElement.scrollWidth ===
  innerWidth`) aux deux largeurs. Piège relevé : sans cookie `NEXT_LOCALE=fr`, Playwright envoie
  `Accept-Language: en-US` et toute l'interface bascule en anglais.
- **Sites jetables** : tous **isolés**, créés puis supprimés, **0 résidu prouvé par comptage SQL**
  table par table.
- **`EXCEL-V12` : strictement inchangé**, vérifié par SQL avant/après — 19 vagues prévues, 602 500
  alevins, 3 `AlimentPrevision`, 4 `PalierRemise`, apports 30 000 000, journal 34 400 000, charges
  20 580 000, `ParametresPrevision` **colonne par colonne**, et **`MappingRapprochement` à 0 ligne**.
- **Review** : `docs/reviews/review-sprint-PR3-ter.md` — verdict **VALIDÉ SOUS RÉSERVE**, **4 réserves,
  toutes levées ensuite** (rapport de falsification produit ; preuve de composition filet+moteur
  écrite ; assertion `reelFCFA` ajoutée ; test méta d'immuabilité de `SnapshotBudgetInitial`
  mécanisé ; `git diff` du moteur confirmé vide).
- **Capitalisation** : **ERR-179 à ERR-182** créées ; **ERR-116**, **ERR-157**, **ERR-172** et
  **ERR-176** enrichies.
- **Aucun commit, aucun push** — conformément à la consigne du sprint.

## Points ouverts — NON traités, à porter en backlog (pas des stories de ce sprint)

| Nature | Point |
|---|---|
| ~~Risque structurel non corrigé, report assumé~~ → **SOLDÉ le 2026-08-05, ce point n'est plus
ouvert** | `MappingRapprochement.cibleId` restait **site-scopé** pour `POSTE_PREVISION` alors que
`PostePrevision` est **scénario-scopé** (ADR-053 §3.9), faute de clé métier stable sur
`PostePrevision.libelle` (texte libre) — la correction exigeait un référentiel de postes site-scopé,
hors périmètre de ce sprint. **Traité depuis par la story A.4** (sprint PR3-quater, `FAIT`,
review **VALIDÉ**) : modèle **`PosteReferentiel`** + migration
`20260805120000_add_poste_referentiel` (FK `Restrict`, backfill idempotent avec garde-fou de
précondition), get-or-create transactionnel par slug (R4), et **résolution dynamique du filet ET du
moteur de rapprochement** — un mapping orphelin ne fait plus disparaître le montant, il bascule en
**`NON_RAPPROCHE` explicite** (ERR-179 corrigé à la source, plus seulement signalé). Réf :
ADR-053 §16, `docs/reviews/review-story-A4-mapping-poste-prevision.md`,
`docs/tests/rapport-story-A4-mapping-poste-prevision.md`, `docs/TASKS.md` §Sprint PR3-quater. |
| Limite structurelle assumée de la série RÉEL | le domaine réel n'a **aucun modèle** pour les
apports/subventions/prêts réellement encaissés (§15.1(b), reporté sine die §15.8(a)) : la courbe
RÉEL est **biaisée à la baisse**. Le caveat est affiché en permanence, en haut de l'onglet, avant le
graphique. |
| Dette de test, hors périmètre | divergence non expliquée entre les chiffres de falsification
annoncés pour B.5 (3/6, 1/8, 1/8) et ceux remesurés à la clôture (1/8 pour les trois). |
| Dette signalée, hors périmètre | libellés non accentués restants hors Ventes/Dépenses :
`permissions.json` (« Depenses & Besoins »), `stock.json` et `besoins.json` (« Depenses liees »),
`admin.json`/`calibrage.json`/`stock.json` (« Categorie »). |
| Backlog issu de la review | décalage `MODULE_NAV` (ADR-053 §15.7/15.8e), déjà acté hors périmètre,
non aggravé par ce sprint. |

