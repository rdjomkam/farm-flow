# Pré-analyse Sprint PR3 — Rapprochement prévu/réel — 2026-08-04

## Statut : GO AVEC RÉSERVES

## Résumé
Le socle du sprint PR2 est stable (285/290 fichiers, 9228/9228 tests, build OK, `prisma validate` OK).
`MappingRapprochement` et `ClotureMois` existent **en base et au schéma uniquement** — aucune query,
aucune route API, aucune UI ne les utilise : ce sont des modèles morts à date, tout le §6 est à
construire depuis zéro. Les 4 dettes signalées sont confirmées réelles et localisées précisément.
Le risque n°1 (absence de jeu d'or pour le rapprochement) est confirmé structurel : aucune fixture,
aucun classeur ne couvre le réel (`Depense`/`Vente`/`MouvementStock`), et le précédent direct
(ERR-171, récidive d'ERR-142, découvert le jour même dans ce module) montre que le risque n'est pas
théorique. Le sprint peut démarrer, à condition d'imposer une discipline de tests synthétiques
explicite (section C) puisque aucune recette externe ne pourra jouer ce rôle ici.

## Vérifications effectuées

### Schema ↔ Types : OK (pour le périmètre déjà livré)
- `npx prisma validate` → schéma valide.
- `MappingRapprochement`/`ClotureMois` : présents dans `prisma/schema.prisma` (lignes 4734-4766),
  migration `20260803120100_add_previsions_module` déjà appliquée (dans `prisma/migrations/`,
  antérieure à `20260805090000_add_vague_prevue_alevins_achetes`, la plus récente). Colonnes exactes :
  - `MappingRapprochement` : `id, siteId, version Int, sourceType SourceRapprochement, sourceCle String, cibleType CibleRapprochement, cibleId String?, actif Boolean @default(true), createdAt`. `@@unique([siteId, version, sourceType, sourceCle])`, `@@index([siteId, actif])`.
  - `ClotureMois` : `id, scenarioId, moisAbsolu Int, clotureeParId (FK User), dateCloture, siteId`. `@@unique([scenarioId, moisAbsolu])`, `@@index([siteId])`.
  - Enums `SourceRapprochement { DEPENSE_CATEGORIE, PRODUIT_CATEGORIE, VENTE, MOUVEMENT_STOCK }` et `CibleRapprochement { POSTE_PREVISION, ALIMENT_PREVISION, VENTE_PREVUE, NON_RAPPROCHE }` présents (schema.prisma §3.1 de l'ADR).
- **Modèles morts confirmés** : `grep -rn "MappingRapprochement\|ClotureMois" src/` ne remonte
  **aucune occurrence** en dehors de `src/generated/prisma/**` (client généré). Zéro query, zéro
  route API, zéro composant. `PREVISIONS_CLOTURER` existe dans l'enum `Permission`
  (`prisma/schema.prisma:316`, `src/types/models.ts:144`) et dans `role-form-labels.ts`/
  `permissions-constants.ts:205`, mais n'est vérifié par aucune route (aucune route de clôture
  n'existe).
- `Vague.vaguePrevueId String? @unique` : bien en place (`prisma/schema.prisma:1382-1383`), `onDelete: SetNull`
  conforme à l'ADR §3.7. Consommé côté API par `src/app/api/previsions/vagues-prevues/[id]/rattacher/route.ts`
  et `.../scinder/route.ts` — le flux de scission de la décision 2 (`vaguePrevueParentId`, auto-relation)
  **existe** : composant `src/components/previsions/scission-dialog.tsx` + test `scission-dialog.test.tsx`,
  route `vagues-prevues/[id]/scinder/route.ts`. Le flux « rattacher une vague réelle à une VaguePrevue »
  existe aussi (`rattacher-vague-dialog.tsx` + route `rattacher/route.ts`).

### Inventaire src/lib/previsions/, queries, API, components

**Moteur (`src/lib/previsions/`, fonctions pures)** :
| Fichier | Rôle |
|---|---|
| `aliments.ts` | Besoin aliment mensuel, palier de remise, coût aliment vague |
| `budget.ts` | Agrégats budget total du plan |
| `charges.ts` | Charges mensuelles par poste, `calculerBaseRepartition` |
| `decimal-config.ts` / `decimal-io.ts` | Config `decimal.js`, sérialisation Decimal↔string pour I/O API |
| `format-previsions.ts` | Formatage d'affichage (FCFA, %, etc.) |
| `logistique.ts` | Coûts de transport (aliments/poissons/alevins) |
| `plan.ts` | `genererPlanEmpoissonnement` |
| `route-orchestration.ts` | Orchestrateur principal `calculerProjectionScenario`, consommé par la route `scenarios/[id]/calculer` |
| `tableau-de-bord-helpers.ts` | Agrégats pour l'onglet tableau de bord |
| `tresorerie.ts` | `genererSerieTresorerie`, `calculerPointBasTresorerie` |
| `types.ts` | Types partagés du moteur |
| `validation.ts` | Validations bloquantes (somme 100 %, paliers croissants, somme parts d'approvisionnement) |
| `ventilations.ts` | Ventilation aliment par vague/mois |
| `vague.ts` | Helpers `VaguePrevue` |
| `index.ts` | Barrel export |

**Aucun fichier de rapprochement n'existe** dans `src/lib/previsions/` (pas de `rapprochement.ts`,
pas de `mapping.ts`, pas de `ecarts.ts`).

**Queries (`src/lib/queries/previsions-*.ts`)** : `previsions-scenarios.ts`, `previsions-vagues.ts`,
`previsions-aliments.ts`, `previsions-charges.ts`, `previsions-scenario-loader.ts` (charge un
scénario complet pour l'orchestrateur). Aucune query `previsions-rapprochement.ts` /
`previsions-mapping.ts` / `previsions-cloture.ts`.

**API (`src/app/api/previsions/`)** : routes scénarios (CRUD, activer/archiver/calculer/paramètres/
postes/charges/journal/apports/paliers-remise/vagues+génération), routes aliments (CRUD, articles,
répartitions), routes vagues-prévues (CRUD, aliments, sacs-saisis, rattacher, scinder, annuler),
routes postes/charges (reporter). **Aucune route `rapprochement/`, `mapping-rapprochement/`,
`cloture/`**.

**Pages (`src/app/(farm)/previsions/`)** : seulement `scenarios/` et `scenarios/[id]/` — pas de
route `/previsions` (dashboard), `/previsions/plan`, `/previsions/aliments`, `/previsions/charges`,
`/previsions/tresorerie`, `/previsions/rapprochement` en tant que routes séparées (contrairement au
`MODULE_NAV` décrit en ADR-053 §6) : le détail est organisé en **onglets** dans
`scenario-detail-client.tsx` (`plan-vagues-tab.tsx`, `aliments-tab.tsx`, `charges-tab.tsx`,
`journal-tab.tsx`, `apports-tab.tsx`, `previsions-mensuelles-tab.tsx`, `tableau-bord-tab.tsx`) — pas
d'onglet `rapprochement-tab.tsx`. `npm run build` confirme : seules `/previsions/scenarios` et
`/previsions/scenarios/[id]` existent comme routes buildées.

### Tables du domaine réel à lire pour le rapprochement
- **`Depense`** (`prisma/schema.prisma:2452`) : `categorieDepense CategorieDepense` (NOT NULL),
  `montantTotal Float`, `montantPaye Float`, `date DateTime`, `vagueId String?`, `venteId String?`,
  `siteId String` (NOT NULL). Détail par article via `LigneDepense.categorieDepense` +
  `LigneDepense.produitId?` (nullable) — un chemin **plus fin** que `Depense.categorieDepense` existe
  donc si une dépense a des lignes détaillées.
- **`Vente`** (`:1747`) : `quantitePoissons Int`, `poidsTotalKg Float`, `prixUnitaireKg Float`,
  `montantTotal Float`, `dateCommande DateTime`, `vagueId String?`, `siteId String`.
- **`MouvementStock`** (`:1617`) : `produitId String` (NOT NULL, → `Produit.categorie`/
  `tailleGranule`), `type TypeMouvement` (`ENTREE | SORTIE`), `quantite Float`, `prixTotal Float?`,
  `vagueId String?`, `depenseId String?`, `date DateTime`, `siteId String`.
- **Enums réels exacts** :
  - `CategorieDepense { ALIMENT, INTRANT, EQUIPEMENT, ELECTRICITE, EAU, LOYER, SALAIRE, TRANSPORT, VETERINAIRE, REPARATION, INVESTISSEMENT, AUTRE }` (12 valeurs, `:401-414`).
  - `CategorieProduit { ALIMENT, INTRANT, EQUIPEMENT }` (`:84-88`).
  - `TypeMouvement { ENTREE, SORTIE }` (`:112-115`).
- **Tonnage sorti** : pas de champ dédié « tonnage sorti » — se déduit soit de `Vente.poidsTotalKg`
  (poissons vendus), soit de `MouvementStock` où `type=SORTIE` et `produit.categorie=ALIMENT` (sacs
  d'aliment sortis du stock, proxy de consommation réelle). Rien ne relie nativement une sortie de
  stock à une `VaguePrevue` (seulement à `Vague.vagueId?`, nullable).

- **Granulométrie (`TailleGranule`, 9 valeurs `P0..P3,G1..G5`, `:589-599`)** : portée par
  `Produit.tailleGranule TailleGranule?` (`:1587`). Chemin réel : `MouvementStock.produitId →
  Produit.tailleGranule` **existe** (`MouvementStock` a une FK directe `produitId`, pas nullable).
  Côté `Depense`, le chemin passe par `LigneDepense.produitId? → Produit.tailleGranule` — **nullable
  à deux niveaux** (une dépense peut n'avoir aucune `LigneDepense`, et une ligne peut n'avoir aucun
  `produitId`) : si une dépense d'aliment est saisie sans lignes de détail (dépense « globale »,
  `categorieDepense=ALIMENT` sans `LigneDepense`), la granulométrie réelle n'est **pas récupérable**
  pour cette dépense-là — c'est un trou de données réel, pas un bug, mais une limite fonctionnelle à
  documenter dans les stories : le rapprochement par granulométrie ne pourra être fiable que via
  `MouvementStock` (FK non-nullable), pas via `Depense` seule.

- **« Encaissements hors vente » (apports, subventions, prêts) côté réel** : **absent**. Recherche
  exhaustive de modèles `Apport*`/`Subvention*`/`Pret*`/`Emprunt*` dans `prisma/schema.prisma` : seul
  `ApportCapital` existe, et c'est un modèle du module **Prévisions** (`prisma/schema.prisma:4718`,
  scopé à un `ScenarioPrevision`), pas une table du domaine réel. Aucun équivalent réel n'existe.
  **Conséquence directe pour PR3** : la comparaison « prévu (`ApportCapital`) vs réel » pour la vue
  trésorerie du §6 n'a **aucune source réelle à lire** — c'est un trou de modèle côté réel, pas
  seulement côté mapping, à trancher explicitement dans une story ADR/SCHEMA avant d'implémenter la
  vue trésorerie (soit on élargit la lecture réelle à un sous-ensemble de `Depense`/dépôts non
  catégorisés, soit on assume que seul le côté « dépenses/ventes » du rapprochement est couvert au
  MVP PR3 et que les apports réels restent hors périmètre — l'ADR-053 §5 ne tranche pas ce point).

### B. Les 4 dettes à solder

**1. ERR-162 — validation de couverture des mois manquante.**
- Localisation : `src/lib/previsions/validation.ts:34-41` (`validerSommeRepartitionMoisAliment`).
  Elle vérifie **uniquement** `Σ pourcentage == 100` sur le tableau `repartitions` **qui lui est
  passé** — elle ne vérifie ni le nombre de lignes, ni que chaque `moisCycle` de `1..dureeCycleMoisFigee`
  (ou `scenario.dureeCycleMois`) est représenté.
- Confirmé au site d'appel : `src/lib/queries/previsions-aliments.ts:152-172` — si
  `data.repartitions` est vide/absent (`data.repartitions && data.repartitions.length > 0`), la
  validation n'est **même pas appelée** ; aucun garde-fou ne compare `repartitions.length` (ou
  l'ensemble des `moisCycle` présents) à `dureeCycleMois` du scénario. Un mois de cycle omis vaut
  donc `0 %` d'aliment servi ce mois-là, silencieusement, sans erreur.
- Ce qui manque : une garde `validerCouvertureMoisRepartition(repartitions, dureeCycleMois)` (ou
  équivalent) qui échoue si l'ensemble des `moisCycle` reçus ≠ `{1..dureeCycleMois}`, appelée au même
  site que `validerSommeRepartitionMoisAliment`, avant toute écriture (même transaction, patron R4).

**2. ERR-165 — `PREVISIONS_STATUS_MAP` par `message.includes()`.**
- Fichier exact : `src/app/api/previsions/_shared.ts:59-93`. Contenu actuel (9 entrées, matching de
  sous-chaîne sur un message utilisateur sans accents) :
  ```ts
  export const PREVISIONS_STATUS_MAP = [
    { match: "doit valoir 100", status: 422 },
    { match: "seuils strictement croissants", status: 422 },
    { match: "meme ordre d'evaluation", status: 400 },
    { match: "doit etre un entier (colonne Prisma Int)", status: 400 },
    { match: "sacsParTonneStandard non configure", status: 422 },
    { match: "ParametresPrevision absent", status: 422 },
    { match: "sans tailleGranule", status: 422 },
  ];
  ```
  (le fichier documente lui-même, ligne 78-86, la fragilité : « accentuer ce message romprait
  silencieusement le lien et ferait retomber ce cas en 500 »). Le fichier a déjà commencé à migrer un
  cas hors de ce mécanisme (§NB ligne 40-52) vers une `ValidationError` typée gérée en amont par
  `handleApiError` — c'est le précédent que PR3 devrait généraliser plutôt que d'ajouter de nouvelles
  entrées `match` pour le rapprochement.
- Design de remplacement proposé (non implémenté, à discuter avec @architect) : une classe
  `BusinessRuleError extends Error { status: number; code: string }` (ou un objet `{ code, status,
  message }` levé au lieu d'une `Error` nue) dans `src/lib/errors.ts`, consommée directement par
  `handleApiError` sans passer par un `statusMap` de sous-chaînes — chaque site de levée
  (`validation.ts`, queries) porte son propre code et son propre statut, la route n'a plus besoin
  d'un mapping partagé du tout. Migration incrémentale : chaque nouvelle validation du sprint PR3
  (couverture mois, mapping actif, mois clôturé) devrait être créée directement en `BusinessRuleError`
  plutôt que d'ajouter une 10e entrée `match` à `_shared.ts` — sinon la dette grossit encore.

**3. `tresorerieInitiale` absente de `ParametresPrevision`.**
- Localisation exacte du figeage à 0 : `src/lib/previsions/route-orchestration.ts:800` —
  `const serieTresorerie = genererSerieTresorerie(moisOrdonnesPourTresorerie, new Decimal(0));`.
  Déjà signalé comme risque résiduel priorité basse dans `docs/reviews/review-sprint-PR2-nonies.md`
  §5 point 5 (« sans conséquence sur EXCEL-V12 [...] mais empêcherait de représenter un scénario futur
  à trésorerie initiale non nulle »).
- Élément notable : le jeu d'or **porte déjà** cette donnée côté fixture de test uniquement —
  `src/lib/previsions/__tests__/recette/helpers.ts:80` (`tresorerieInitialeFCFA: number`) et
  `.../recette/orchestration.ts:592-595` (harnais de recette, PAS le code de production) l'utilisent
  pour reconstituer la trésorerie de l'annexe B. Le classeur source la porte
  (`prisma/fixtures/previsions/README.md:79`, `Paramètres!B37`). C'est donc une valeur déjà extraite
  et déjà consommée par le harnais de test, mais qui n'existe **nulle part** dans le modèle Prisma ni
  dans le moteur de production — le risque relevé en C ci-dessous (recette qui recompose au lieu
  d'appeler la production) s'applique **littéralement** à cette valeur dès aujourd'hui.
- Ce qui devrait changer pour introduire `tresorerieInitiale` (§4.1 des exigences, libre, peut être
  négatif) :
  - **Schéma** : `ParametresPrevision.tresorerieInitialeFCFA Decimal` (NOT NULL avec défaut `0`,
    cohérent R7 — pas de calcul silencieux sur un `null`), migration Prisma.
  - **Types** : `src/types/models.ts` (interface miroir), `src/lib/validation/previsions.schema.ts`
    (zod, `parametresPrevisionSchema`).
  - **Moteur** : `route-orchestration.ts:800` doit lire `parametres.tresorerieInitialeFCFA` au lieu de
    `new Decimal(0)` en dur ; `tresorerie.ts:51-58` (`genererSerieTresorerie(..., soldeInitial =
    new Decimal(0))`) garde son défaut à 0 (fonction pure générique, correcte telle quelle) — c'est
    l'appelant qui doit cesser de figer l'argument.
  - **API** : route `scenarios/[id]/parametres/route.ts` (PUT) — champ à accepter en entrée/sortie.
  - **UI** : `parametres-tab.tsx` + `parametres-tab.test.tsx` — nouveau champ de saisie (libre, signe
    négatif autorisé, pas de validation `>= 0`).
  - **Fixtures** : `plan-v12-corrige.json`/`annexe-b-corrigee.json` portent déjà
    `entreesModele.parametresScenario.tresorerieInitialeFCFA` — à câbler dans le **seed applicatif**
    (données EXCEL-V12 en base) si ce n'est pas déjà fait (à vérifier par @db-specialist au moment de
    la story), pas seulement dans le JSON de fixture de test.
  - **Tests** : le harnais `recette/orchestration.ts` doit cesser d'être la seule source qui applique
    cette valeur — une fois le champ ajouté à `route-orchestration.ts`, un test doit prouver que
    **la production**, pas seulement le harnais, produit la trésorerie attendue avec
    `tresorerieInitialeFCFA ≠ 0` (le jeu d'or actuel EXCEL-V12/annexe B vaut 0 pour ce champ — un test
    synthétique dédié sera nécessaire, cf. section C).

**4. Libellé de cohorte du détail par vague — absent, confirmé.**
- `grep -rn "cohorte" src/ docs/decisions/ADR-053-module-previsions.md` → **zéro résultat**. Aucun
  champ, aucune fonction, aucun composant ne porte ce concept sous ce nom.
- Ce qui existe : `VagueProjectionResult` (`src/lib/previsions/route-orchestration.ts:194-196`)
  expose `vaguePrevueId: string` et `code: string` (le `VaguePrevue.code`, ex. « V7 ») — c'est le seul
  identifiant de cohorte exposé aujourd'hui côté prévu. Côté réel, `Vague.code` (`@unique` global,
  `prisma/schema.prisma:1321`) est un identifiant **distinct**, jamais joint à `VaguePrevue.code` dans
  aucune query ni aucun type actuel : `grep` sur les routes `vagues-prevues/[id]/*` ne montre aucun
  `include: { vague: ... }` qui remonterait `Vague.code` au même niveau que `VaguePrevue.code`.
- Ce qui manque concrètement pour la vue « par vague » du §6 : un type de sortie qui porte les DEUX
  identifiants (prévu + réel une fois rattachée) avec un libellé lisible unique à afficher (ex.
  `"V7 → VAG-2026-014"` ou équivalent), et la query/join qui les assemble — rien de tout cela n'existe
  aujourd'hui, ni côté moteur ni côté query ni côté composant.

### C. Risque n°1 — absence de jeu d'or pour le rapprochement

**ERR-160** (jeu d'or structurellement incapable de discriminer deux formules — sum-then-round vs
round-then-sum n'était différentiable que par un test synthétique construit exprès, le jeu d'or réel
ne divergeait sur aucun des 19 mois) et **ERR-171** (récidive directe d'ERR-142 : le harnais de
recette `__tests__/recette/orchestration.ts` recompose la formule dans le test au lieu d'appeler
`calculerProjectionScenario`, si bien que 2 458 assertions vertes n'ont rien détecté pendant deux
sprints ; falsification chiffrée après coup : 140-141 assertions tombent une fois le vrai bug
réintroduit et testé par le bon chemin) s'appliquent **directement** à PR3, en pire : il n'existe
**aucun classeur Excel de référence pour le rapprochement au réel** (`Depense`/`Vente`/
`MouvementStock` sont des données opérationnelles farm-flow, jamais modélisées dans
`Previsions_Elevage_Silure_v12.xlsx`). PR3 ne peut donc s'appuyer sur **aucune** recette externe
(0 écart contre un classeur) comme filet — la seule protection possible sera des **fixtures
synthétiques conçues pour discriminer**, au sens strict d'ERR-160, et une recette qui appelle
**exclusivement** le code de production (jamais une réimplémentation locale au test, au sens strict
d'ERR-171).

Précautions de conception de tests à imposer explicitement dans les stories PR3 (pas laissées à
l'appréciation de l'implémenteur) :

- **(a) Signe de l'écart selon dépense vs entrée/tonnage.** Une fixture doit couvrir au moins un cas
  où `réel > prévu` ET un cas où `réel < prévu`, sur les DEUX familles de grandeur (dépense en FCFA —
  où « dépasser le prévu » est un signal négatif — et tonnage/quantité — où « dépasser le prévu » peut
  être un signal positif selon le contexte). Un test qui ne vérifie que `|écart| == constante` sans
  vérifier le **signe** ne peut pas distinguer une formule `réel - prévu` d'une formule `prévu - réel`
  inversée par erreur — exactement le type de piège nommé par ERR-160.
- **(b) `prevu=0 & reel>0`.** Cas explicite : une catégorie réelle jamais mappée à un `PostePrevision`
  mais avec des dépenses réelles non nulles. Doit produire un écart affiché (jamais une division par
  zéro silencieuse, jamais un `NaN`/`Infinity` sur un `% d'écart relatif` si le calcul en propose un) —
  fixture dédiée à écrire, un jeu réel « normal » n'a aucune raison de contenir spontanément ce cas
  (même famille qu'ERR-155 : une série jamais non nulle dans le jeu par défaut est un angle mort).
- **(c) Le bac « Non rapproché ».** Fixture avec au moins une `CategorieDepense` ou `CategorieProduit`
  réellement utilisée sur le site testé mais **sans** entrée `MappingRapprochement` active
  correspondante — doit apparaître dans `NON_RAPPROCHE`, jamais silencieusement absorbée dans le
  total ni ignorée. Un test qui ne construit que des mappings complets ne peut jamais détecter une
  régression qui ferait disparaître ce bac.
- **(d) Immuabilité de l'historique d'écarts figés quand le mapping change.** Séquence de test
  explicite : calculer un rapprochement pour un mois M avec le mapping version N, changer le mapping
  (nouvelle version N+1, jamais un UPDATE en place — conforme au schéma), puis revérifier que le
  rapprochement déjà affiché/figé pour M reste identique (ou reste explicable via la version N,
  archivée) — pas recalculé silencieusement avec le nouveau mapping. Ce test n'a de sens que si la
  couche API/queries de PR3 conserve effectivement la version utilisée au moment du calcul (ce qui
  n'est pas encore défini — à trancher dans la story SCHEMA/API du rapprochement lui-même, cf. section
  E) : la fixture doit être écrite pour FAIRE ÉCHOUER une implémentation naïve qui relirait toujours
  `MappingRapprochement` au mapping `actif` du moment sans historisation.
- **(e) Coexistence des 3 séries (BUDGET INITIAL / PRÉVISION ACTUALISÉE / RÉEL).** Fixture avec un
  scénario `ACTIF` dont un `ParametresPrevision`/poste a été modifié **après** publication (donc
  divergence attendue entre BUDGET INITIAL figé à l'activation et PRÉVISION ACTUALISÉE courante), plus
  des données réelles partiellement saisies pour la période — un test qui construit les 3 séries à
  partir d'un seul état de la base (sans distinguer un état « figé à l'activation » d'un état
  « courant ») ne peut pas prouver que BUDGET INITIAL reste effectivement figé. **Point de conception
  non tranché par l'ADR actuel** : aucun mécanisme de gel d'un « budget initial » distinct de l'état
  courant du scénario n'existe dans le schéma (`ScenarioPrevision.statut=ACTIF` ne fige aucune copie
  des valeurs) — cette série suppose soit une table de snapshot à l'activation, soit une convention
  「le budget initial est recalculé depuis les mêmes tables mais uniquement les lignes créées avant la
  date d'activation」, à trancher explicitement par une story ADR avant l'implémentation, pas déduit
  implicitement pendant le développement.

Recommandation méthodologique transverse : appliquer **par construction** la méthode de falsification
d'ERR-168/ERR-171 à chaque nouvelle fonction de rapprochement — casser volontairement le calcul de
production (ex. inverser le signe, oublier un mapping, ignorer la clôture) et vérifier que des tests
tombent, avant de considérer une story terminée. Le nombre brut d'assertions vertes ne sera **jamais**
une preuve suffisante ici, faute de classeur externe.

### D. Vérifications d'état

**`git status --short`** :
```
?? docs/reviews/CS4-audit-prod.md
?? test-results/
```
(rien lié à PR3 — ce sont des artefacts non liés, non modifiés par cette analyse).

**`git log --oneline -3`** :
```
cc1ce0a feat(prev): le plan de référence saisi à la main, et ce qu'il a révélé
d789ce7 feat(prev): module Prévisions — un moteur qui se prouve contre son classeur
e7cd502 ci: une garantie qui ne se rejoue pas n'est pas une garantie
```

**`npx vitest run`** :
```
Test Files  285 passed | 5 skipped (290)
     Tests  9228 passed | 21 skipped | 26 todo (9275)
```
0 échec, conforme à l'annonce.

**`npm run build`** : succès (`prisma generate && prisma migrate deploy && next build --webpack`),
liste de routes buildées confirmée, incluant `/previsions/scenarios` et `/previsions/scenarios/[id]`
uniquement pour le module Prévisions — aucune route `/previsions` racine ni `/previsions/rapprochement`.

**`npx prisma validate`** : `The schema at prisma/schema.prisma is valid 🚀`.

**Commande de recette dédiée** : **absente de `package.json`** — il n'existe pas de script
`npm run recette` ou équivalent. Les tests de recette (`*.recette.test.ts`, 4 fichiers sous
`src/lib/previsions/__tests__/recette/`) sont exécutés comme partie intégrante de `npx vitest run`
(script `"test": "vitest run"`), déjà confirmé à 0 échec ci-dessus. Le chiffre « 2709 assertions »
cité dans la consigne n'est pas un compteur explicite dans le dépôt (pas de `expect.assertions()`
global) — cohérent avec les chiffres déjà documentés dans `review-sprint-PR2-nonies.md` (2 458
assertions avant PR2-nonies, +140+141 après falsification/correctif), la valeur exacte n'a pas pu
être revérifiée par une commande dédiée faute de script — **à signaler**, pas bloquant pour PR3
lui-même (le filet de recette existant n'est pas dans le périmètre de ce sprint), mais un manque
d'observabilité qui vaudrait la peine d'être comblé (`npm run recette` qui isole
`*.recette.test.ts` + affiche un compte d'assertions) si le rythme de sprint continue à s'appuyer sur
ce chiffre en pré-analyse.

## Incohérences trouvées
1. `MODULE_NAV` décrit en ADR-053 §6 (7 items : dashboard, scénarios, plan, aliments, charges,
   trésorerie, rapprochement) ne correspond pas à l'implémentation réelle (tout est en onglets sous
   `/previsions/scenarios/[id]`, pas de routes séparées). Fichiers : `src/app/(farm)/previsions/**`,
   `src/components/previsions/scenario-detail-client.tsx`. Sans conséquence bloquante pour PR3 (le
   rapprochement peut être un onglet de plus, cohérent avec le patron déjà en place), mais l'ADR
   décrit une navigation qui ne sera jamais construite telle quelle — à signaler à
   @knowledge-keeper/@architect pour corriger le décalage documentaire plutôt que de le laisser
   silencieux plus longtemps.
2. `prisma/fixtures/previsions/README.md:84` annonce « 6 postes non nuls » alors que 4 seulement le
   sont (déjà signalé, non corrigé, `review-sprint-PR2-nonies.md` §4.2/§5 point 3) — sans impact sur
   PR3 mais document de référence à corriger.

## Risques identifiés
1. **Absence de jeu d'or pour le rapprochement au réel** (détaillé section C) — impact Haut si non
   mitigé : mêmes symptômes qu'ERR-142/ERR-160/ERR-171 (bug de signe ou de terme manquant invisible
   derrière une suite verte). Mitigation : fixtures synthétiques de discrimination + interdiction de
   recette qui recompose au lieu d'appeler la production, imposées dès le découpage des stories.
2. **« Encaissements hors vente » côté réel n'existe pas** (`ApportCapital` est un modèle Prévisions,
   pas un modèle réel) — bloque toute vue « trésorerie » complète du §6 tant qu'une story ADR n'a pas
   tranché le périmètre exact (voir section A). Impact Moyen : peut être découpé en « rapprochement
   dépenses/ventes d'abord, trésorerie ensuite » sans bloquer tout le sprint.
3. **Granulométrie non fiable depuis `Depense`** (dépenses sans `LigneDepense` détaillée) — impact
   Moyen sur la vue « achats d'aliment par granulométrie si disponible » : le mot « si disponible » de
   l'énoncé §6 est justifié par un vrai trou de données, pas une facilité de langage à ignorer.
4. **Absence de mécanisme de gel du « budget initial »** distinct de l'état courant du scénario —
   impact Haut sur la reprévision glissante à 3 séries : sans ce mécanisme, BUDGET INITIAL et
   PRÉVISION ACTUALISÉE ne peuvent pas être distingués en base, la fonctionnalité centrale du §6 ne
   peut pas être construite sans une décision de modèle préalable (voir section E).
5. **`PREVISIONS_STATUS_MAP` (ERR-165)** grossira mécaniquement si le sprint PR3 ajoute des
   validations bloquantes (mapping incomplet, mois clôturé) selon le même patron `match: string` — un
   nouveau message non accentué de plus, un couplage de plus. Impact Moyen, mitigation proposée en
   section B.2.

## Prérequis manquants
1. **Décision ADR explicite sur le périmètre du §6 côté « encaissements hors vente »** (apports réels
   absents du domaine réel) avant de démarrer la story API/UI trésorerie du rapprochement.
2. **Décision ADR explicite sur le mécanisme de « budget initial figé »** (snapshot à l'activation vs
   convention de filtrage par date) avant toute story touchant la reprévision glissante à 3 séries —
   c'est un choix de modèle de données, pas un détail d'implémentation, il doit précéder les stories
   SCHEMA de PR3.
3. **Design retenu (même informel) pour le remplacement d'ERR-165** avant d'ajouter de nouvelles
   entrées à `PREVISIONS_STATUS_MAP` — sinon la dette continue de grossir dans ce sprint précisément.
4. Aucun prérequis technique bloquant côté build/tests/migrations : le socle est vert.

## Découpage proposé en stories (indicatif, à trancher par @project-manager)

| Story (indicative) | Type | Contenu |
|---|---|---|
| PR3.0 | ADR | Trancher : périmètre exact « encaissements hors vente » côté réel, mécanisme de gel « budget initial », remplacement d'ERR-165 (BusinessRuleError typée) — préalable à tout le reste |
| PR3.1 | SCHEMA | `ParametresPrevision.tresorerieInitialeFCFA` (dette 3) ; champ(s) nécessaires au gel du budget initial si l'ADR PR3.0 retient un snapshot (ex. `ScenarioPrevisionSnapshot` ou équivalent) |
| PR3.2 | SCHEMA | Garde de couverture des mois (dette 1, ERR-162) — pas un nouveau modèle mais une validation bloquante, éventuellement une contrainte de comptage exposée par le schéma commenté |
| PR3.3 | QUERIES/API | CRUD `MappingRapprochement` (création versionnée, jamais d'UPDATE en place, `PREVISIONS_PARAMETRER`) + endpoint de lecture des catégories réelles non mappées → bac `NON_RAPPROCHE` |
| PR3.4 | QUERIES/API | Calcul des écarts (lecture seule `Depense`/`Vente`/`MouvementStock` agrégés par mois/catégorie, jointure au mapping actif au moment du calcul avec historisation par version — dette 4/risque (d)) |
| PR3.5 | API | Endpoint(s) de clôture de mois (`ClotureMois`, `PREVISIONS_CLOTURER`) + verrouillage en écriture du rapprochement sur un mois clôturé |
| PR3.6 | UI | Vue mensuelle + vue cumulée (2 des 5 vues du §6) |
| PR3.7 | UI | Vue par vague (nécessite le libellé de cohorte, dette 4) + vue « top écarts » |
| PR3.8 | UI | Vue trésorerie à 3 séries — dépend strictement de PR3.0/PR3.1 (gel budget initial) |
| PR3.9 | TESTS | Campagne de fixtures synthétiques de discrimination (section C, points a-e) + falsification (méthode ERR-168) sur chaque fonction de rapprochement livrée |

**Ce qui devrait être reporté hors de ce sprint** : la vue « trésorerie à 3 séries » (PR3.8) si la
décision ADR PR3.0 sur le gel du budget initial n'aboutit pas rapidement à un modèle simple — mieux
vaut livrer 4 vues solides et reporter la 5e que de forcer un modèle de snapshot mal conçu sous
pression de délai (cf. la leçon ERR-160/ERR-171 : un modèle bâclé sous pression, dans ce module
précisément, a déjà coûté deux sprints de récidive). La granularité « achats d'aliment par
granulométrie » devrait être explicitement documentée comme partielle (dépend de `LigneDepense`
présente) plutôt que promise comme complète.

## Recommandation
**GO**, sous réserve de traiter PR3.0 (les 3 décisions ADR) en tout premier, avant toute story
SCHEMA/API — le socle technique (build, tests, schéma) est sain et ne bloque rien, mais le §6 touche
trois points que l'ADR-053 actuel ne tranche pas (encaissements hors vente réels, gel du budget
initial, typage des erreurs) : les construire sans décision explicite reproduirait le patron déjà vu
deux fois dans ce module (ERR-142/ERR-171) — un choix de modèle pris en cours d'implémentation plutôt
qu'avant.
