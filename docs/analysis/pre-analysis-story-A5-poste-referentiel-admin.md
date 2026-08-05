# Pré-analyse — story successeur de A.4 : visibilité du rattachement + administration du référentiel de postes — 2026-08-05

## Statut : GO AVEC RÉSERVES

## Identifiant de la story

**Aucune story successeur n'existe encore** dans `docs/sprints/*.md` ni dans `docs/TASKS.md`. La
story A.4 (sprint PR3-quater, commit `ade1757`) est marquée `FAIT` et close ; le tableau des
« points restés ouverts » de PR3-quater liste explicitement §16.10 (écran de sélection/création) et
§16.6 (contrat XOR) comme **évolutions futures optionnelles, non planifiées**, mais ne contient
**aucune ligne** correspondant aux deux points tranchés par l'utilisateur (A : visibilité partout du
rattachement ; B : écran d'administration renommer/désactiver). Aucun fichier
`docs/sprints/SPRINT-PR3-QUINQUIES*.md` (prochain suffixe dans la série latine PR2→PR2-nonies,
PR3→PR3-quater) n'existe. **Recommandation : cette pré-analyse est le document fondateur d'une
nouvelle story, à immatriculer par @project-manager — proposition : `A.5`, sprint `PR3-quinquies`**,
avant que @developer ne commence.

## Résumé

Le terrain est sain : `PosteReferentiel.actif` et `PostePrevision.posteReferentielId` (NOT NULL, FK
`Restrict`) existent déjà en base depuis la migration `20260805120000_add_poste_referentiel`
(commit `ade1757`) — **aucune nouvelle migration de schéma n'est nécessaire** pour livrer le
périmètre demandé. Le chemin 409 « entrée désactivée » (§16.5/§16.11) est déjà codé et déjà testé.
Ce qui manque est exclusivement applicatif : (1) le DTO frontend et les mappings SSR qui **omettent
aujourd'hui `posteReferentielId`** malgré sa présence en base et dans les payloads API bruts, (2)
tout affichage du rattachement dans l'UI, (3) une route PATCH de renommage du référentiel, (4) une
route de désactivation, (5) i18n et permissions pour un nouvel écran d'administration. Build et
tests sont verts à l'identique de la baseline attendue ; `EXCEL-V12` est intact et vérifié par SQL.

## Vérifications effectuées

### Schema ↔ Types : OK, avec un écart applicatif à corriger (pas un écart de schéma)
- `prisma/schema.prisma:4688-4739` — `PosteReferentiel` (`code`, `libelle`, `actif Boolean
  @default(true)`, `@@unique([siteId, code])`, `@@index([siteId, actif])`) et
  `PostePrevision.posteReferentielId String` (NOT NULL) + FK `onDelete: Restrict` sont **déjà en
  place**, exactement comme décrits par ADR-053 §16.3.
- **Écart réel, pas dans le schéma mais dans la couche DTO** : `PostePrevisionDTO`
  (`src/components/previsions/api-types.ts:194-202`) ne déclare **pas** `posteReferentielId`. Le
  mapping SSR explicite `src/components/pages/previsions-scenario-detail-page.tsx:411-418`
  (`postesDto = postes.map(...)`) **omet ce champ à la construction**, bien qu'il soit présent dans
  l'objet Prisma brut (`getPostesPrevisionParScenario`,
  `src/lib/queries/previsions-charges.ts:87-92`, aucun `select`, donc le champ existe dans la
  requête). La route `POST /api/previsions/scenarios/[id]/postes` renvoie l'objet Prisma brut sans
  filtrage (`route.ts:41`) — le champ **y transite déjà**, il est seulement perdu au SSR et jamais
  typé côté client.
- `PosteReferentielDTO` (`api-types.ts:211-219`) existe déjà et est complet (`id`, `siteId`, `code`,
  `libelle`, `actif`, `createdAt`, `updatedAt`).

### API ↔ Queries : OK pour l'existant, routes manquantes identifiées
- `GET /api/previsions/postes-referentiel/route.ts` **existe réellement** (contrairement à une
  simple description ADR) — site-scopé, `PREVISIONS_VOIR`, appelle
  `listerPostesReferentielActifs(siteId)` (`src/lib/queries/previsions-postes-referentiel.ts`),
  filtre déjà `actif: true`.
- `POST /api/previsions/scenarios/[id]/postes/route.ts` : `PREVISIONS_PARAMETRER`, contrat actuel
  `{ libelle, type, inclusBaseRepartition, ordre }` — **inchangé**, get-or-create interne
  (`createPostePrevision`, `previsions-charges.ts:168-239`).
- **Aucune route** `PATCH /api/previsions/postes-referentiel/[id]` (renommer) ni
  `POST/PATCH .../desactiver` (désactiver) n'existe — à créer intégralement pour le point B.
- **Aucune route PUT/PATCH** pour éditer `PostePrevision.libelle` (renommage scénario-local, §16.4)
  n'existe non plus — hors du périmètre strict demandé (A/B) mais à noter : si l'exigence A exige
  seulement l'**affichage** du rattachement (pas l'édition du libellé scénario), ce n'est pas
  bloquant.

### Navigation ↔ Permissions : à définir
- Permissions existantes : `PREVISIONS_VOIR`, `PREVISIONS_GERER`, `PREVISIONS_PARAMETRER`,
  `PREVISIONS_CLOTURER` (`prisma/schema.prisma:313-316`, rôles ADR-053 §6). Aucune permission dédiée
  « admin référentiel » n'existe — cohérent avec la consigne de l'utilisateur
  (`PREVISIONS_GERER` ou plus strict) : **`PREVISIONS_PARAMETRER`** est le candidat naturel (déjà
  utilisée pour `POST /postes`, décrite ADR §6 comme couvrant `PostePrevision`/`MappingRapprochement`
  — un écran d'administration du référentiel entre directement dans ce périmètre, pas besoin d'une
  nouvelle valeur d'enum).
- Aucun item de navigation dédié à un écran d'administration du référentiel n'existe dans
  `MODULE_NAV` (`src/lib/module-nav-items.ts` — les 7 items de prévisions listés en ADR §6 ne
  contiennent aucun sous-écran « Référentiel »). Un nouvel écran nécessitera soit un nouvel item de
  nav, soit un accès contextuel depuis l'onglet Mapping/Charges — décision UX à trancher par
  @architect/@developer, pas par cette pré-analyse.

### Build : OK
`npm run build` → exit 0, toutes les routes compilées, aucune erreur TypeScript.

### Tests : 331/331 fichiers, 9607/9607 tests passent (0 skip, 0 échec, 26 todo pré-existants hors périmètre)
Commande exacte : `set -a && source .env && set +a && npx vitest run`. Résultat : **331 fichiers
passés / 9607 tests passés / 26 todo (density-calculs.test.ts, density-integration.test.ts,
module densité, sans lien) / 0 skip / 0 échec** — identique à la baseline attendue.

## Incohérences trouvées

1. **`PostePrevisionDTO` et le mapping SSR omettent `posteReferentielId`, alors que le champ existe
   déjà en base et transite déjà dans les réponses API brutes.** Fichiers : `src/components/
   previsions/api-types.ts:194-202`, `src/components/pages/previsions-scenario-detail-page.tsx:
   411-418`, `src/components/previsions/charges-tab.tsx` (consomme `PostePrevisionDTO` sans jamais
   afficher le rattachement). Suggestion de fix : ajouter `posteReferentielId: string` (et
   idéalement `posteReferentiel: { code: string; libelle: string; actif: boolean }` via un `include`
   ciblé pour éviter un aller-retour réseau supplémentaire) au DTO et au mapping SSR ; c'est un
   changement additif, non cassant.

2. **`code` figé au renommage, hypothèse à challenger — CONFIRMÉE PAR LE CODE ET L'ADR, pas
   seulement une hypothèse.** ADR-053 §16.3 : « `code`... JAMAIS recalculé automatiquement ensuite,
   y compris si `libelle` change (renommage explicite du code = action distincte, hors périmètre de
   cette story, non exposée par aucune route) ». Le code (`resoudrePosteReferentielIdDansTransaction`,
   `previsions-charges.ts:120-149`) ne recalcule jamais `code` après création — confirmé
   structurellement, la clé de dédoublonnage du get-or-create est bien figée. **Conséquence directe
   pour la story B** : la route PATCH de renommage doit modifier uniquement `libelle`, jamais `code`
   — un renommage qui recalculerait `code` casserait silencieusement le get-or-create (une future
   création avec le même libellé d'origine ne retrouverait plus l'entrée renommée, créant un
   doublon) et romprait `MappingRapprochement.cibleId` si celui-ci référençait indirectement le slug
   (il ne le fait pas — il référence `id`, donc un renommage de `libelle` seul est sûr, exactement
   comme documenté en §16.4).

## Risques identifiés

1. **Risque de collision de nommage entre l'exigence A (affichage) et l'exigence B (édition) sur le
   même écran.** Si le rattachement est affiché « partout où un poste apparaît » (charges-tab.tsx,
   tout futur écran de liste/export), et que l'écran d'administration permet de renommer l'entrée
   référentiel, un utilisateur peut voir un `PostePrevision.libelle` scénario-local diverger
   visuellement de `PosteReferentiel.libelle` après un renommage administratif — c'est **le
   comportement voulu** par la décision A de l'utilisateur (libellé propre au scénario, rattachement
   visible), mais l'implémentation doit afficher les deux libellés distinctement (ex. « Salaires »
   scénario + badge/lien « rattaché à : Salaires (référentiel) », ou un indicateur visuel si les deux
   divergent) — jamais une fusion silencieuse des deux textes qui masquerait la divergence, ce qui
   serait une récidive de la classe ERR-185/ERR-171 (deux grandeurs/textes distincts affichés sous un
   seul nom implicite).

2. **Le chemin 409 dormant devient vivant avec la story B, mais aucun test d'intégration API
   (route HTTP) n'existe encore pour lui — seulement un test de la fonction query.** Le test trouvé
   (`src/lib/queries/__tests__/previsions-charges.test.ts:117-136`, chemin `stores.posteReferentiel`
   avec `actif: false` simulé directement) couvre la **fonction** `createPostePrevision`, avec un
   faux store en mémoire (`previsions-fake-db.ts`), pas la route HTTP `POST /api/previsions/
   scenarios/[id]/postes` de bout en bout contre un vrai Postgres. Tant qu'aucune route ne permet de
   désactiver une entrée, ce chemin reste inatteignable en pratique (aucune donnée réelle ne peut
   avoir `actif = false`) — la story B devra ajouter un test d'intégration DB-gated qui désactive
   réellement une entrée puis vérifie le 409 sur la vraie route, pas seulement sur le mock.

3. **Aucun item `MODULE_NAV` ni convention d'accès pour un écran d'administration du référentiel** —
   décision UX à trancher avant que @developer ne commence l'écran (cohérent avec l'esprit de
   validation préalable déjà appliqué à §16.10 dans l'ADR).

4. **Blast radius de la désactivation actuellement nul, donc non éprouvé.** Un seul site (celui
   d'`EXCEL-V12`) possède des données `PosteReferentiel`/`PostePrevision` dans la base de dev
   partagée (4/4, confirmé par SQL). Aucune requête existante autre que
   `listerPostesReferentielActifs` (déjà filtrée `actif: true`) et le get-or-create ne filtre sur
   `actif` — un audit exhaustif de « qui doit filtrer sur `actif` » devra être refait une fois
   l'écran d'administration livré et testé avec plusieurs sites/scénarios, la situation actuelle
   étant trop pauvre en données pour être représentative.

## Prérequis manquants

1. **Immatriculation de la story** par @project-manager (proposition : `A.5`, sprint
   `PR3-quinquies`) avant tout développement — aucun identifiant n'existe aujourd'hui.
2. **Décision UX explicite** (par @architect, avant @developer) sur : (a) l'emplacement de l'écran
   d'administration (nouvel item `MODULE_NAV` vs accès contextuel depuis Mapping/Charges), (b) la
   représentation visuelle du rattachement quand `PostePrevision.libelle` diverge de
   `PosteReferentiel.libelle` (badge, lien, tooltip) — cohérent avec l'esprit de §16.10 (toute
   évolution d'UX validée avant construction).
3. **Aucune migration Prisma requise** — confirmé par lecture directe du schéma et de la base :
   `actif` et `posteReferentielId` existent déjà, aucun nouveau champ n'est nécessaire pour livrer
   A et B (le renommage touche `libelle` existant ; la désactivation touche `actif` existant).

## Recommandation

**GO** pour démarrer l'implémentation, à condition de :
1. Faire immatriculer la story par @project-manager en premier lieu (aucun identifiant actuel).
2. Traiter en premier le DTO/mapping SSR manquant (`posteReferentielId` absent de
   `PostePrevisionDTO`) — c'est un prérequis technique direct de l'exigence A, pas une tâche séparée.
3. Ajouter un test d'intégration HTTP DB-gated pour le 409 avant de considérer le chemin de
   désactivation comme couvert (le test existant ne couvre que la fonction, pas la route).
4. Ne pas construire l'écran avant la décision UX explicite du point « Prérequis manquants #2 ».
