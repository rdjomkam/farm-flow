# Rapport de tests — Sprint PR3-bis — « L'écran d'administration du mapping »

**Date :** 2026-08-05
**Auteur :** @tester

## 1. Résumé

Le @developer a livré un écran d'administration du `MappingRapprochement` (sous-onglet
`rapprochement-mapping-tab.tsx` + `mapping-form-dialog.tsx` + helpers d'i18n), avec 25 tests dédiés
déjà en place à ma prise en main :
- `src/lib/validation/__tests__/previsions-mapping-schema.test.ts` (8 tests)
- `src/components/previsions/__tests__/mapping-form-dialog.test.tsx` (6 tests)
- `src/components/previsions/__tests__/rapprochement-mapping-tab.test.tsx` (11 tests)

Après audit complet de cette couverture contre les 6 points de la mission (§A) et falsification
chiffrée systématique de 5 règles de production (§B), **je n'ai eu à ajouter aucun test** : la
couverture livrée par le @developer est déjà construite pour discriminer les implémentations
candidates (ERR-160/ERR-172), et chacune des 5 falsifications tentées a fait tomber au moins un
test. Aucun trou de couverture identifié n'a nécessité de nouveau test — le rapport documente donc
une **vérification**, pas un ajout, avec la falsification chiffrée comme preuve.

## 2. Audit de couverture (§A de la mission)

### A.1 — Le POST en bloc (piège n°1 du sprint)
Couvert par `mapping-form-dialog.tsx:106-144` (création) et `:146-167` (édition) — fixture
discriminante : mapping actif à **2 lignes** (`MAPPING_ACTIF_EXISTANT`), ajout d'une 3ᵉ, assertion
sur le **contenu exact** du corps POSTé (`body.lignes` = les 3 lignes complètes, pas juste
« POST appelé »). Confirmé par falsification (a) ci-dessous : **2 tests tombent** si le composant
poste uniquement la nouvelle ligne.

### A.2 — La règle de versionnement mord
Couvert côté queries (DB-gated) par
`src/lib/queries/__tests__/previsions-rapprochement-integration.test.ts`, test `(c) IMMUABILITE`
(lignes 224-296) : mois M clôturé avec `ClotureMois.versionMapping = v1` → création d'une version v2
(TRANSPORT retiré du mapping) → le rapprochement de M reste `RAPPROCHE`, `reel = 30000`, alors que le
mapping actif courant ne mappe plus `TRANSPORT`. Fixture construite précisément pour faire échouer
une implémentation naïve qui relirait toujours `getMappingActif` — confirmé par falsification (b) :
**1 test tombe** exactement sur cette assertion.

Ce test est **DB-gated** (`requireDatabaseUrl`) et n'était **pas exécuté** par défaut dans mon
environnement (`npx vitest run` sans `DATABASE_URL` exporté le compte comme `skipped`, pas comme
échec — 11 fichiers/39 tests DB-gated ignorés silencieusement). Après export de `DATABASE_URL` depuis
`.env` (`set -a; source .env; set +a`), tous les tests DB-gated (7 fichiers, 20 tests concernés,
mapping/clôture/rapprochement inclus) s'exécutent et passent. **Signalé comme point de vigilance
process** : toute vérification de ce module doit exporter `DATABASE_URL` avant `npx vitest run`, sous
peine de ne jamais exercer les preuves d'immuabilité §15.3 de l'ADR.

### A.3 — Granulométrie lisible, un seul référentiel
`libelleSourceCle` (`mapping-rapprochement-helpers.ts`) réutilise exclusivement
`stock.produits.taillesGranule.*` (même referentiel que `aliment-form-dialog.tsx`). Grep exhaustif
(`grep -rln "G0|G1|G2|G3|G4|G5"` sur `src/lib/previsions/`, `src/components/previsions/`,
`src/app/api/previsions/`) : aucun second référentiel de granulométrie créé — seul le fichier de
helpers du mapping y fait référence via le namespace `stock`, comme documenté dans son en-tête.
Testé : `rapprochement-mapping-tab.test.tsx` — `"G3" → "G3 — Granulé 4mm"`, `"INCONNU" →
"Granulométrie inconnue"`.

### A.4 — `NON_RAPPROCHE` comme cible explicite, `cibleId` null
`ligneMappingRapprochementInputSchema.superRefine()` accepte `NON_RAPPROCHE` avec `cibleId` absent ou
`null`, rejette `NON_RAPPROCHE` avec un `cibleId` renseigné — 8 tests dans
`previsions-mapping-schema.test.ts` couvrant les 4 branches (POSTE_PREVISION/ALIMENT_PREVISION avec
et sans `cibleId`, NON_RAPPROCHE/VENTE_PREVUE avec et sans `cibleId`). Côté formulaire,
`MappingFormDialog` propose `NON_RAPPROCHE` par défaut et ne force `cibleId` que si
`CIBLES_AVEC_ID.includes(cibleType)`.

### A.5 — Permissions
Client : `rapprochement-mapping-tab.test.tsx` — le bouton « Mapper »/« Modifier » n'apparaît que si
`permissions.includes(PREVISIONS_PARAMETRER)`, testé avec `rerender`. Serveur : le POST exige
`PREVISIONS_PARAMETRER` (route.ts:71), testé par
`src/app/api/previsions/mapping-rapprochement/__tests__/route.test.ts` — 11 tests, dont un test qui
vérifie **l'argument exact** passé à `requirePermission` (pas seulement le statut 403 générique).
Confirmé par falsification (e) ci-dessous.

### A.6 — État vide
`rapprochement-mapping-tab.test.tsx` — « Tout est mappé : aucune catégorie réelle sans correspondance
sur ce site. » (non-mappées vides) et « Aucun mapping actif sur ce site pour le moment. » (mapping
vide) — deux messages explicites distincts, jamais un tableau blanc.

**Conclusion §A : aucun test ajouté, couverture existante jugée suffisante et discriminante après
audit ligne à ligne.**

## 3. Falsification systématique chiffrée (§B, ADR-053 §15.6.3)

Empreintes `sha256` prises avant toute mutation sur les 5 fichiers concernés. Pour chaque règle :
mutation en production → suite ciblée relancée → nombre exact de tests tombés → restauration → hash
identique + `npx vitest run` ciblé repassé à 0 échec.

| # | Règle falsifiée | Fichier muté | Tests tombés | Restauration prouvée |
|---|---|---|---|---|
| (a) | Le POST n'envoie que la ligne ajoutée, pas le mapping complet | `src/components/previsions/mapping-form-dialog.tsx` (`handleSubmit`, `const lignes = [nouvelleLigne]`) | **2** (`mapping-form-dialog.test.tsx` : création 3 lignes attendues, édition 2 lignes attendues) | hash `77466481...` identique après restauration ; suite repassée à 6/6 |
| (b) | La lecture d'un mois clôturé utilise `getMappingActif` au lieu de `getMappingParVersion(ClotureMois.versionMapping)` | `src/lib/queries/previsions-rapprochement.ts` (`getMappingResoluParMois`, résolution forcée à `mappingActifCourant` pour tous les mois) | **1** (`previsions-rapprochement-integration.test.ts`, test `(c) IMMUABILITE`, DB-gated) | hash `31283364...` identique ; suite ciblée repassée à 5/5 |
| (c) | La validation `.superRefine()` `cibleId`/`cibleType` neutralisée | `src/lib/validation/previsions.schema.ts` (`ligneMappingRapprochementInputSchema`, `superRefine` vidé) | **4** (`previsions-mapping-schema.test.ts` : rejets attendus devenus des acceptations) | hash `a8067099...` identique ; suite repassée à 8/8 |
| (d) | Le formatage de granulométrie renvoie la clé brute (`G3`) au lieu du libellé mm | `src/components/previsions/mapping-rapprochement-helpers.ts` (`libelleSourceCle`, cas `MOUVEMENT_STOCK` retourne `sourceCle`) | **2** (`rapprochement-mapping-tab.test.tsx` : `"G3 — Granulé 4mm"` et `"Granulométrie inconnue"` non trouvés) | hash `2706ef7e...` identique ; suite repassée à 11/11 |
| (e) | La garde de permission `PREVISIONS_PARAMETRER` supprimée du POST | `src/app/api/previsions/mapping-rapprochement/route.ts` (POST, `Permission.PREVISIONS_VOIR` au lieu de `PREVISIONS_PARAMETRER`) | **1** (`route.test.ts` : « exige exactement PREVISIONS_PARAMETRER » — assertion sur l'argument exact passé à `requirePermission`) | hash `3fcb37fa...` identique ; suite repassée à 16/16 |

**Aucune falsification n'a fait tomber 0 test** — pas de trou de couverture détecté, donc aucun test
supplémentaire nécessaire.

**Note sur (b) et (e) :** ces deux falsifications ne font tomber qu'1 test chacune — marge de
détection plus fine que (a)/(c)/(d). Pour (e), c'est structurel : les autres tests de permission de
la suite (`403 si sans PREVISIONS_PARAMETRER`) sont pilotés par un mock entièrement contrôlé par le
test (`mockRequirePermission` rejette sur commande, indépendamment de l'argument réel reçu) — seul le
test qui vérifie explicitement l'argument (`toHaveBeenCalledWith(..., Permission.PREVISIONS_PARAMETRER)`)
peut détecter un changement de la permission demandée. C'est un pattern correct mais fragile si ce
test précis venait à être retiré par erreur dans un futur refactor — signalé pour vigilance, pas un
défaut à corriger dans ce sprint.

## 4. Preuve finale de restauration

```
$ git status --short src/lib/queries/previsions-rapprochement.ts src/lib/validation/previsions.schema.ts \
    src/components/previsions/mapping-form-dialog.tsx src/components/previsions/mapping-rapprochement-helpers.ts \
    src/app/api/previsions/mapping-rapprochement/route.ts
 M src/lib/validation/previsions.schema.ts
?? src/app/api/previsions/mapping-rapprochement/route.ts
?? src/components/previsions/mapping-form-dialog.tsx
?? src/components/previsions/mapping-rapprochement-helpers.ts
?? src/lib/queries/previsions-rapprochement.ts
```

Ce statut (`M`/`??`) est **antérieur** à toute intervention du @tester — c'est l'état de la livraison
du sprint PR3-bis, encore non committée au moment de ce rapport (confirmé par le `git status` en
tête de session, avant toute falsification). La preuve de restauration bit-à-bit est donc apportée
par comparaison de `sha256sum` avant/après pour chacun des 5 fichiers falsifiés (tableau §3,
colonne « Restauration prouvée »), pas par `git diff` (qui resterait non vide de toute façon, à
l'identique de l'état de départ, `git diff` ne portant sur aucun contenu ajouté par mes
falsifications).

## 5. Trois passages `npx vitest run` (sortie brute, avec `DATABASE_URL` exporté)

### PASSAGE 1
```
 ✓ src/lib/previsions/__tests__/tableau-de-bord-helpers.test.ts (15 tests) 3ms
 ✓ src/lib/queries/__tests__/indicateurs-mortalites-closed-bacs.test.ts (3 tests) 3ms
 ✓ src/lib/__tests__/vague-detail-jour-clamp.test.ts (8 tests) 4ms
 ✓ src/lib/previsions/__tests__/charges.test.ts (9 tests) 8ms
 ✓ src/__tests__/calculs-transfert-entrant.test.ts (11 tests) 4ms
 ✓ src/__tests__/lib/bon-livraison-rectificatif-validation.test.ts (6 tests) 3ms
 ✓ src/__tests__/lib/platform-permissions.test.ts (11 tests) 3ms
 ✓ scripts/audits/__tests__/su12-audit-doublons-numero.test.ts (4 tests) 2ms
 ✓ src/lib/queries/__tests__/indicateurs-closed-bacs-fallback.test.ts (4 tests) 3ms
 ✓ src/lib/previsions/__tests__/vague.test.ts (6 tests) 4ms
 ✓ src/lib/queries/__tests__/transfert-entrant-callers.test.ts (6 tests) 2ms
 ✓ src/lib/validation/__tests__/previsions-mapping-schema.test.ts (8 tests) 2ms
 ✓ src/__tests__/export/pdf-image-predecode-guard.test.ts (6 tests) 2ms
 ✓ src/__tests__/lib/site-status.test.ts (16 tests) 2ms
 ✓ src/lib/previsions/__tests__/route-orchestration-remise-ordre.test.ts (9 tests) 2ms
 ✓ src/lib/queries/__tests__/calibrages-transfert-entrant.test.ts (4 tests) 2ms
 ✓ src/lib/previsions/__tests__/budget.test.ts (2 tests) 1ms
 ✓ src/lib/__tests__/taux-survie.test.ts (8 tests) 2ms
 ✓ src/__tests__/auth/phone.test.ts (15 tests) 2ms

 Test Files  306 passed (306)
      Tests  9405 passed | 26 todo (9431)
   Start at  05:15:37
   Duration  14.51s (transform 16.05s, setup 2.11s, import 44.38s, tests 65.66s, environment 17.62s)
```

### PASSAGE 2
```
 ✓ src/__tests__/lib/site-status.test.ts (16 tests) 2ms
 ✓ src/__tests__/auth/phone.test.ts (15 tests) 2ms

 Test Files  306 passed (306)
      Tests  9405 passed | 26 todo (9431)
   Start at  05:16:00
   Duration  14.66s (transform 15.82s, setup 2.28s, import 44.51s, tests 65.99s, environment 18.02s)
```

### PASSAGE 3
```
 ✓ src/__tests__/lib/site-status.test.ts (16 tests) 2ms
 ✓ src/__tests__/auth/phone.test.ts (15 tests) 2ms

 Test Files  306 passed (306)
      Tests  9405 passed | 26 todo (9431)
   Start at  05:16:19
   Duration  14.96s (transform 16.09s, setup 2.19s, import 45.76s, tests 67.31s, environment 18.18s)
```

**306 fichiers / 9405 tests, identiques sur 3 passages, 0 échec.**

### Écart avec les chiffres annoncés dans la mission — signalé, non masqué
- Pré-analyse (mesurée sans `DATABASE_URL`) : 292 fichiers / 9340 tests.
- Rapporté par le @developer : 295 fichiers / 9366 tests.
- Mesuré par moi **sans** `DATABASE_URL` exporté : 306 fichiers / 9405 total, mais **11 fichiers /
  39 tests skipped** (DB-gated, `dbAvailable=false` faute de variable d'environnement dans le shell
  du @tester malgré Docker up) → **295 fichiers passés / 9366 tests passés** dans cette configuration
  — cohérent avec le chiffre du @developer.
- Mesuré **avec** `DATABASE_URL` exporté (`set -a; source .env; set +a`) : **306 fichiers passés /
  9405 tests passés, 0 skip, 0 échec** — c'est le chiffre qui exerce réellement les preuves
  d'immuabilité §15.3 et doit faire foi pour ce sprint, car sans lui les tests DB-gated de mapping/
  clôture/rapprochement (dont la fixture (c) discriminante de §3.A2) ne sont jamais exécutés.
- L'utilisateur annonçait 303 fichiers / 9379 tests — ni ce chiffre ni aucun des miens ne
  correspondent exactement ; je rapporte ce que j'observe réellement plutôt que d'arrondir vers
  l'annonce.

## 6. Build

```
npm run build
...
ƒ Proxy (Middleware)
ƒ  (Dynamic)  server-rendered on demand
EXIT=0
```
Aucune erreur (`grep -iE "error|fail"` sur la sortie complète : aucune occurrence). Build production
OK.

## 7. `prisma migrate deploy`

```
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "farm-flow", schema "public" at "localhost:8432"
170 migrations found in prisma/migrations
No pending migrations to apply.
```

## 8. Recette (zone interdite `src/lib/previsions/`) — non touchée, mesurée

```
npx vitest run src/lib/previsions/__tests__/recette
 ✓ annexe-b-corrigee.recette.test.ts (480 tests)
 ✓ plan-v12-corrige.recette.test.ts (480 tests)
 ✓ route-orchestration-baseRepartition.recette.test.ts (209 tests)
 ✓ route-orchestration.recette.test.ts (1540 tests)

 Test Files  4 passed (4)
      Tests  2709 passed (2709)
```
**2 709 tests / 0 écart**, conforme au plancher exigé par la mission (`≥ 2 709`). Aucun fichier de
`src/lib/previsions/` modifié en dehors des falsifications temporaires immédiatement restaurées
(§3, ligne (b), seule falsification touchant ce dossier — restaurée, hash vérifié).

## 9. Contrôle EXCEL-V12 (avant/après, par SQL)

Identique dans les deux mesures (avant intervention et après falsification/restauration) :

| Grandeur | Valeur |
|---|---|
| Vagues prévues | 19 |
| Alevins totaux | 602 500 |
| Calibres (`AlimentPrevision`) | 3 |
| Paliers de remise | 4 |
| Apports capital (somme `montantFCFA`) | 30 000 000 |
| Journal dépenses prévues (somme `montantFCFA`) | 34 400 000 |
| Charges mensuelles (jointure poste, somme `montantFCFA`) | 20 580 000 |

`ParametresPrevision` colonne par colonne — identique avant/après :
`effectifAlevinsParVague=10000`, `margeSecuriteAlevinsPct=10`, `poidsMoyenInitialG=5`,
`poidsObjectifG=400`, `prixAlevinUnitaireFCFA=70`, `prixVenteKgFCFA=1900`,
`nombreBacsSimultanesCible=4`, `frequenceStockageMois=1`, `capaciteTransportAlevinsNb=20000`,
`capaciteTransportAlimentsSacs=60`, `capaciteTransportPoissonsKg=1500`,
`coutTransportAlevinsFCFA=30000`, `coutTransportAlimentsFCFA=15000`,
`coutTransportPoissonsFCFA=25000`, `tauxEpargnePct=30`, `alevinsAchetesParDefaut=false`,
`tresorerieInitialeFCFA=0`.

`MappingRapprochement` / `ClotureMois` — comptage global (toutes les requêtes ont été exécutées en
lecture seule, aucune écriture n'a été faite dans ces deux tables ni dans `Depense`/`Vente`/
`MouvementStock`) :
- **Avant :** 0 ligne `MappingRapprochement`, 0 ligne `ClotureMois`, tous sites confondus.
- **Après :** 0 ligne `MappingRapprochement`, 0 ligne `ClotureMois`, tous sites confondus.

## 11. Passe finale — après 6 correctifs (C1-C6), sprint PR3-bis-bis

**Date :** 2026-08-05 (deuxième passe, post-correctifs)

Le @developer a appliqué 6 correctifs (C1 alerte cible hors scénario, C2 clé i18n câblée, C3 test
GET-échoue-au-submit, C4 accents des catégories fr, C5 message vide dédoublonné, C6 libellé de
cible en liste) sur `mapping-form-dialog.tsx`, `mapping-rapprochement-helpers.ts`,
`rapprochement-mapping-tab.tsx`, leurs tests, et `src/messages/{fr,en}/previsions.json`,
`src/messages/fr/depenses.json`, `src/messages/fr/stock.json`.

### 11.1 — Anti-régression C4 (accents)

Grep exhaustif sur tout `src/` des chaînes non accentuées `Electricite|Equipement|Veterinaire|Reparation` :

- **Aucune régression trouvée dans le module Prévisions/mapping** : le seul diff i18n de C4 porte sur
  `depenses.json` (`EQUIPEMENT`, `ELECTRICITE`, `VETERINAIRE`, `REPARATION` → accentués) et
  `stock.json` (`EQUIPEMENT` → accentué, + ajout de la clé `INCONNU` pour la granulométrie). Aucun
  test n'asserte plus une de ces valeurs non accentuées ; grep dédié
  (`toBe("Equipement")`/`toBe("Electricite")`/`toBe("Veterinaire")`/`toBe("Reparation")`) : **0
  occurrence**.
- Toutes les occurrences restantes de `Electricite` (non accentué) dans les tests
  (`charges-tab.test.tsx`, `permissions-gating.test.tsx`, `reporter-charge-dialog.test.tsx`,
  `previsions-auth-permissions.test.ts`, `previsions-charges.test.ts`,
  `previsions-scenario-loader.test.ts`, `rapprochement.test.ts`, `rapprochement-mapping-tab.test.tsx`)
  sont un **libellé de poste (`PostePrevision.libelle`) libre saisi par l'utilisateur dans la
  fixture**, pas la traduction i18n `depenses.categories.ELECTRICITE` — un poste de charge peut
  légitimement s'appeler « Electricite » sans accent, ce champ n'est ni contraint ni traduit. Ce
  n'est donc pas une chaîne dérivée du référentiel modifié par C4, et ne peut pas régresser à cause
  de C4. `mapping-form-dialog.test.tsx:165-166` asserte sur la **clé d'enum** `sourceCle ===
  "ELECTRICITE"`, jamais sur le libellé — insensible à l'accentuation par construction, signalé
  explicitement comme demandé par la mission.
- **Suspect réel trouvé, hors périmètre C4 mais à signaler** : `src/components/ventes/
  depense-vente-dialog.tsx` et `src/components/ventes/vente-detail-client.tsx` portent chacun une
  table `CATEGORIE_LABELS`/`CATEGORIE_DEPENSE_LABELS` **codée en dur** (`"Equipements"`,
  `"Electricite"`, `"Veterinaire"`, `"Reparation"`, sans accent) au lieu de consommer
  `depenses.categories.*` via `useTranslations`. Vérifié : ces deux fichiers utilisent bien
  `next-intl` mais pour d'autres namespaces (`ventes.depenses`, `ventes`), jamais
  `depenses.categories` — **ce n'est donc pas une régression causée par C4** (ces fichiers n'ont
  jamais consommé ce référentiel), mais une incohérence UI préexistante : le module Ventes affiche
  les catégories de dépense sans accent pendant que le module Prévisions/Dépenses les affiche
  maintenant accentuées. Signalé au PM comme dette, pas comme un défaut de C4.

### 11.2 — Falsification chiffrée des correctifs C1/C3/C5/C6 (§B)

| # | Règle falsifiée | Fichier muté | Tests tombés (avant correction du trou) | Trou détecté | Test ajouté | Tests tombés (après) |
|---|---|---|---|---|---|---|
| (f) | Le garde « GET du mapping actif échoue → ne pas POSTer » retiré (`if (!mappingActuel.ok \|\| !mappingActuel.data)` → `if (false)`) (C3) | `mapping-form-dialog.tsx` | **1** (`mapping-form-dialog.test.tsx` — « aucun POST n'est envoyé si le GET du mapping actif échoue », crash sur `mappingActuel.data.data`) | Non | — | — |
| (g) | `cibleActuelleHorsScenario` neutralisée (`= false`) (C1) | `mapping-form-dialog.tsx` | **1** (`mapping-form-dialog.test.tsx` — « une cible existante hors de ce scénario déclenche un avertissement explicite ») | Non | — | — |
| (h) | `libelleCible(...)` renvoie `cibleId` brut au lieu du libellé (C6) | `mapping-rapprochement-helpers.ts` | **2** (`rapprochement-mapping-tab.test.tsx` — « deux mappings vers deux postes différents… » et « une cible introuvable dans ce scénario… ») | Non | — | — |
| (i) | Le sous-titre du `CardHeader` (`{version !== null && (...)}` → `{true && (...)}`) réaffiché inconditionnellement (C5) | `rapprochement-mapping-tab.tsx` | **0** — le test `toHaveLength(1)` existant n'asserte que sur le message d'état vide du **contenu** (« Aucun mapping actif sur ce site pour le moment. »), jamais sur l'**absence du sous-titre** lui-même. Avec `version=null` et la garde retirée, le sous-titre affiche « Version {version} — … » (texte distinct, l'interpolation ne trouve pas de valeur pour `{version}` car `null ?? fallback` retombe sur le placeholder littéral) — **jamais un doublon du message d'état vide**, donc le test existant reste vert malgré la régression. | **Oui — trou réel** | `rapprochement-mapping-tab.test.tsx` : nouveau test « CORRECTIF C5 (renforcé) : aucun sous-titre de version n'est affiché quand version est null », `expect(screen.queryByText(/en vigueur pour tous les mois/)).not.toBeInTheDocument()` | **1** (le nouveau test, confirmé après re-falsification) |

Restauration prouvée par `sha256sum` avant/après pour les 3 fichiers de production falsifiés — hash
identique dans les 3 cas :
- `mapping-form-dialog.tsx` : `d12b95cb271a022417443a6761d5dd1ae8975db7725ab816ee18bc09884f9a59`
- `mapping-rapprochement-helpers.ts` : `f585926b565ff9ab8e348fa3466e1a9df3ad1cdf7df9c5091170b01eb1338884`
- `rapprochement-mapping-tab.tsx` : `0cb3ec991bf0968a05082503c18f179dc8cc8ac4d13a8aecfce39f5324c464bb`

Suite ciblée (`mapping-form-dialog.test.tsx` + `rapprochement-mapping-tab.test.tsx` +
`previsions-mapping-schema.test.ts`) repassée à **32/32** après restauration (31 avant l'ajout du
test du trou + 1 nouveau).

### 11.3 — Tableau de falsification complet (a)→(i)

| # | Règle falsifiée | Tests tombés | Trou détecté |
|---|---|---|---|
| (a) | POST n'envoie que la ligne ajoutée, pas le mapping complet | **2** | Non |
| (b) | Lecture d'un mois clôturé utilise `getMappingActif` au lieu de `getMappingParVersion` | **1** | Non |
| (c) | `.superRefine()` `cibleId`/`cibleType` neutralisée | **4** | Non |
| (d) | Formatage granulométrie renvoie la clé brute (`G3`) | **2** | Non |
| (e) | Garde de permission `PREVISIONS_PARAMETRER` supprimée du POST | **1** | Non |
| (f) | Garde GET-échoue retiré (C3) | **1** | Non |
| (g) | `cibleActuelleHorsScenario` neutralisée (C1) | **1** | Non |
| (h) | `libelleCible` renvoie l'id brut (C6) | **2** | Non |
| (i) | Sous-titre `CardHeader` réaffiché inconditionnellement (C5) | **0 → 1 après ajout du test manquant** | **Oui — corrigé dans cette passe** |

### 11.4 — Trois passages `npx vitest run` (sortie brute, `DATABASE_URL` exportée)

**PASSAGE 1**
```
 Test Files  306 passed (306)
      Tests  9412 passed | 26 todo (9438)
   Start at  05:54:50
   Duration  14.72s (transform 16.35s, setup 2.11s, import 45.32s, tests 64.90s, environment 18.58s)
```

**PASSAGE 2**
```
 Test Files  306 passed (306)
      Tests  9412 passed | 26 todo (9438)
   Start at  05:55:11
   Duration  14.62s (transform 15.88s, setup 2.26s, import 44.31s, tests 66.01s, environment 17.94s)
```

**PASSAGE 3**
```
 Test Files  306 passed (306)
      Tests  9412 passed | 26 todo (9438)
   Start at  05:55:30
   Duration  14.84s (transform 15.64s, setup 2.33s, import 45.58s, tests 65.75s, environment 18.35s)
```

**306 fichiers / 9412 tests, identiques sur 3 passages, 0 échec, 0 flaky.** Écart de +7 tests par
rapport à la passe précédente (9405 → 9412) : +6 tests des correctifs C1-C6 (nouveaux cas dans
`mapping-form-dialog.test.tsx`/`rapprochement-mapping-tab.test.tsx`) + 1 test ajouté par moi (§11.2,
falsification (i)).

### 11.5 — Build

```
npm run build
EXIT=0
```
`grep -iE "error|fail"` sur la sortie complète : aucune occurrence. Build production OK.

### 11.6 — `prisma migrate deploy`

```
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "farm-flow", schema "public" at "localhost:8432"
170 migrations found in prisma/migrations
No pending migrations to apply.
```

### 11.7 — Recette (zone interdite `src/lib/previsions/`) — non touchée, mesurée

```
npx vitest run src/lib/previsions/__tests__/recette
 Test Files  4 passed (4)
      Tests  2709 passed (2709)
```
**2 709 tests / 0 écart**, conforme au plancher exigé (`≥ 2 709`). Le fichier de production touché
par la falsification (i) n'est pas dans `src/lib/previsions/` (c'est un composant
`src/components/previsions/`) — aucun fichier de `src/lib/previsions/` n'a été modifié dans cette
passe, même temporairement.

### 11.8 — Contrôle EXCEL-V12 (avant/après, par SQL, lecture seule)

Scénario `Plan de reference Excel v12` (id `cmsdnypml0000n4ekuadykn0f`) — identique avant et après
intervention :

| Grandeur | Valeur |
|---|---|
| Vagues prévues | 19 |
| Alevins totaux (`SUM(effectifAlevinsPrevu)`) | 602 500 |
| Calibres (`AlimentPrevision`) | 3 |
| Paliers de remise (`PalierRemise`) | 4 |
| Apports capital (`SUM(montantFCFA)` `ApportCapital`) | 30 000 000 |
| Journal dépenses prévues (`SUM(montantFCFA)` `JournalDepensePrevue`) | 34 400 000 |
| Charges mensuelles (`ChargeMensuellePrevue` jointe `PostePrevision`, `SUM(montantFCFA)`) | 20 580 000 |

`ParametresPrevision` colonne par colonne (`SELECT *`, y compris `updatedAt`) — identique avant/après :
`effectifAlevinsParVague=10000`, `margeSecuriteAlevinsPct=10`, `poidsMoyenInitialG=5`,
`poidsObjectifG=400`, `prixAlevinUnitaireFCFA=70`, `prixVenteKgFCFA=1900`,
`nombreBacsSimultanesCible=4`, `frequenceStockageMois=1`, `capaciteTransportAlevinsNb=20000`,
`capaciteTransportAlimentsSacs=60`, `capaciteTransportPoissonsKg=1500`,
`coutTransportAlevinsFCFA=30000`, `coutTransportAlimentsFCFA=15000`,
`coutTransportPoissonsFCFA=25000`, `tauxEpargnePct=30`, `alevinsAchetesParDefaut=false`,
`tresorerieInitialeFCFA=0`, `createdAt=2026-08-03 20:10:26.499`,
`updatedAt=2026-08-04 06:03:17.707`.

Comptes globaux (lecture seule, aucune écriture dans `Depense`/`Vente`/`MouvementStock`/
`EXCEL-V12`) :
- `Site` : **2** (`site_01` « Ferme Douala », `site_client_01` « Ferme Essomba »).
- `Depense` : **5**.
- `MouvementStock` : **10**.
- `MappingRapprochement` : **0**.
- `ScenarioPrevision` : **1**.
- `ClotureMois` : **0**.

**Contrôle du résidu `vpr3b%`** (site jetable créé/supprimé pendant une passe de vérification
navigateur antérieure) : `SELECT ... WHERE id ILIKE 'vpr3b%' OR name ILIKE 'vpr3b%'` sur `Site`, et
équivalent `siteId ILIKE 'vpr3b%'` sur `SiteMember`, `Bac`, `Vague`, `ScenarioPrevision`,
`MappingRapprochement` : **0 ligne dans les 6 tables — aucun résidu.**

### 11.9 — Ce qui a échoué ou n'a pas pu être fait dans cette passe

- **Un trou de couverture réel a été détecté et corrigé** (§11.2, ligne (i)) : la falsification C5
  ne faisait tomber aucun test avant l'ajout du mien. Ce n'est pas une conformité à 100% « sur
  premier essai » — c'est documenté sans arrondi, conformément à la mission.
- **Vérification manuelle en navigateur réel non refaite dans cette passe** — la passe précédente
  avait jugé cela hors périmètre (ERR-157, pas de mise en page complexe nouvelle) ; cette passe se
  concentre sur la falsification chiffrée et les 3 passages `vitest`/`build`/`migrate deploy`
  demandés explicitement par la mission, qui ne redemande pas de vérification navigateur.
- **Aucun autre écart identifié** : anti-régression C4 propre (à l'exception de la dette
  préexistante, hors périmètre, signalée en §11.1), 3 passages `vitest` identiques et à 0 échec,
  `build` et `migrate deploy` propres, recette à 2 709/2 709, EXCEL-V12 identique avant/après, aucun
  résidu `vpr3b%`.

## 13. Passe de clôture — après D1/D2 (2026-08-05, troisième passe)

Le @developer a appliqué 2 derniers correctifs : D1 (`chargementCibles` transformé en état dérivé
`cibleDataScenarioId` dans `mapping-form-dialog.tsx`, plus de fenêtre de rendu avec `postes`/
`aliments` vides) et D2 (libellé « Cible non chargée » distinct de « Cible introuvable » dans
`mapping-rapprochement-helpers.ts` + `rapprochement-mapping-tab.tsx` + clé i18n `cibleNonChargee`
fr/en).

### 13.1 — Trois passages `npx vitest run` (sortie brute, `DATABASE_URL` exportée)

**PASSAGE 1**
```
 Test Files  306 passed (306)
      Tests  9413 passed | 26 todo (9439)
   Start at  06:07:20
   Duration  14.65s (transform 15.73s, setup 2.15s, import 45.04s, tests 65.17s, environment 18.07s)
```

**PASSAGE 2**
```
 Test Files  306 passed (306)
      Tests  9413 passed | 26 todo (9439)
   Start at  06:07:41
   Duration  14.91s (transform 16.04s, setup 2.21s, import 45.92s, tests 66.23s, environment 18.45s)
```

**PASSAGE 3**
```
 Test Files  306 passed (306)
      Tests  9413 passed | 26 todo (9439)
   Start at  06:08:01
   Duration  17.11s (transform 18.53s, setup 2.63s, import 49.82s, tests 80.95s, environment 21.15s)
```

**306 fichiers / 9413 tests, identiques sur 3 passages, 0 échec, 0 skip, 0 flaky.** Confirme
exactement le chiffre annoncé par le @developer (306 fichiers / 9413 tests). +1 test par rapport à
la passe §11.4 (9412 → 9413) : les 2 derniers correctifs D1/D2 n'ajoutent qu'1 test net dans cette
mesure (le détail des ajouts/suppressions de tests n'a pas été redemandé par la mission ; seul le
compte final avec `DATABASE_URL` exportée fait foi).

### 13.2 — Build

```
npm run build
EXIT=0
```
`grep -iE "error|fail"` sur la sortie complète : aucune occurrence. Build production OK.

### 13.3 — `prisma migrate deploy`

```
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "farm-flow", schema "public" at "localhost:8432"
170 migrations found in prisma/migrations
No pending migrations to apply.
```

### 13.4 — Falsification chiffrée de D1/D2 (§B de la mission)

| # | Correctif falsifié | Fichier muté | Tests tombés | Constat |
|---|---|---|---|---|
| (j) | D1 : `chargementCibles` remis à un `useState(false)` + `setState(true)`/`setState(false)` dans l'effet (version d'avant, avec fenêtre de rendu d'une frame) | `mapping-form-dialog.tsx` | **0** | **Non couvert par un test** — dit franchement, sans le masquer. Le défaut corrigé par D1 est une fenêtre de rendu d'**une frame synchrone** (React batche `setChargementCibles(true)` dans le même effet layout ; aucun test RTL actuel n'observe un état intermédiaire à cette granularité). C'est un défaut réel mais dont la fenêtre est trop étroite pour la suite de tests actuelle basée sur `waitFor`/assertions post-résolution. Acceptable pour ce sprint (le code est quand même correct après D1, et la mission qualifie explicitement ce cas de tolérable) mais **signalé comme trou de couverture non comblé**, pas comme un correctif prouvé par un test. |
| (k) | D2 : `libelleCible` ignore `ciblesChargees` et renvoie toujours `cibleIntrouvable` | `mapping-rapprochement-helpers.ts` | **1** | Confirmé — exactement 1 test tombe (`rapprochement-mapping-tab.test.tsx`, assertion `expect(screen.getByText("Cible non chargée")).toBeInTheDocument()` / `queryByText("Cible introuvable dans ce scénario")).not.toBeInTheDocument()`). Conforme à l'attendu de la mission. |

Restauration prouvée par `sha256sum` avant/après (identique dans les deux cas) :
- `mapping-form-dialog.tsx` : `f9ff8950561b4ba52d3a38b90c47b15e57bd73835c634c964d0eb315c3edb5ef`
- `mapping-rapprochement-helpers.ts` : `10d6cd610c14de714d0dbc4afe634ad048a2a5e1b6cb02384b68923a4afe6e77`

Suite ciblée (`mapping-form-dialog.test.tsx` + `rapprochement-mapping-tab.test.tsx`) repassée à
**25/25** après chaque restauration.

**Aucun nouveau test n'a été ajouté par le @tester pour combler (j)** — la mission (§B) demandait de
mesurer et de rapporter, pas nécessairement de corriger ; le trou est documenté pour arbitrage par le
PM/code-reviewer plutôt que comblé unilatéralement dans une passe de clôture.

### 13.5 — Recette du moteur (`src/lib/previsions/`)

```
npx vitest run src/lib/previsions/__tests__/recette
 Test Files  4 passed (4)
      Tests  2709 passed (2709)
```
**2 709 tests / 0 écart**, conforme au plancher `≥ 2 709`. Aucun fichier de `src/lib/previsions/`
modifié pendant cette passe de clôture (les deux falsifications (j)/(k) ont porté sur
`src/components/previsions/mapping-form-dialog.tsx` et `mapping-rapprochement-helpers.ts`, hors de ce
dossier). Le `git status --short src/lib/previsions/` montre des fichiers modifiés/créés, mais ce sont
des livrables du sprint (rapprochement.ts, rapprochement-vagues.ts, etc.) antérieurs à cette passe de
clôture, pas une intervention du @tester.

### 13.6 — Parité i18n (script)

Comparaison programmatique des arborescences de clés fr/en (aplatissement récursif) :
- `previsions.json` : 0 clé seulement en fr, 0 seulement en en.
- `depenses.json` : 0 / 0.
- `stock.json` : 0 / 0.

Clés ajoutées par ce sprint, vérifiées une à une, présentes en fr **et** en, et consommées dans
`src/` (namespace réel entre parenthèses quand différent de celui indiqué dans la mission) :
- `rapprochementTab.mapping.cibleIntrouvable` — `mapping-rapprochement-helpers.ts:112,119`.
- `rapprochementTab.mapping.cibleNonChargee` — `mapping-rapprochement-helpers.ts:113,120`.
- `rapprochementTab.mapping.form.cibleHorsScenarioWarning` (mission l'écrit sans `.form.` — le
  namespace réel dans le code et les JSON est `rapprochementTab.mapping.form.cibleHorsScenarioWarning`)
  — `mapping-form-dialog.tsx:278`.
- `rapprochementTab.mapping.form.fields.cibleId.horsScenario` — `mapping-form-dialog.tsx:298`.
- `rapprochementTab.mapping.form.fields.cibleId.empty` — `mapping-form-dialog.tsx:316`.
- `stock.produits.taillesGranule.INCONNU` — consommée par `mapping-rapprochement-helpers.ts:62`
  (via `tStock`), `aliment-form-dialog.tsx`, `aliments-tab.tsx`, `previsions-mensuelles-tab.tsx`,
  `mapping-form-dialog.tsx:310`, `produits-list-client.tsx`, `produit-detail-client.tsx`.

**Aucune clé morte parmi les clés listées par la mission.**

### 13.7 — Contrôle EXCEL-V12 (avant/après, lecture seule stricte)

Identique à la mesure §11.8 (aucune écriture effectuée pendant cette passe) :

| Grandeur | Valeur |
|---|---|
| Vagues prévues | 19 |
| Alevins totaux | 602 500 |
| `AlimentPrevision` | 3 |
| `PalierRemise` | 4 |
| Apports capital | 30 000 000 |
| Journal dépenses prévues | 34 400 000 |
| Charges mensuelles | 20 580 000 |

`ParametresPrevision` colonne par colonne — identique avant/après (y compris `updatedAt =
2026-08-04 06:03:17.707`, inchangé, confirmant l'absence de toute écriture) :
`effectifAlevinsParVague=10000`, `margeSecuriteAlevinsPct=10`, `poidsMoyenInitialG=5`,
`poidsObjectifG=400`, `prixAlevinUnitaireFCFA=70`, `prixVenteKgFCFA=1900`,
`nombreBacsSimultanesCible=4`, `frequenceStockageMois=1`, `capaciteTransportAlevinsNb=20000`,
`capaciteTransportAlimentsSacs=60`, `capaciteTransportPoissonsKg=1500`,
`coutTransportAlevinsFCFA=30000`, `coutTransportAlimentsFCFA=15000`,
`coutTransportPoissonsFCFA=25000`, `tauxEpargnePct=30`, `alevinsAchetesParDefaut=false`,
`tresorerieInitialeFCFA=0`.

Comptes globaux (identiques avant/après) :
- `Site` : **2**. `Depense` : **5**. `MouvementStock` : **10**. `MappingRapprochement` : **0**.
  `ScenarioPrevision` : **1**. `ClotureMois` : **0**.

Résidu `vpr3b%` sur `Site`, `SiteMember`, `Bac`, `Vague`, `ScenarioPrevision`,
`MappingRapprochement` : **0 ligne dans les 6 tables.**

### 13.8 — État git (sans rien committer)

`git status --short` (relevé après restauration des deux falsifications (j)/(k) — hashes identiques
aux originaux, confirmés en §13.4) donne la liste complète des fichiers modifiés (`M`) et créés
(`??`) par le sprint PR3-bis / PR3-bis-bis. Résumé par catégorie (liste brute complète disponible via
`git status --short` à la racine du dépôt, ~130 entrées) :
- **Modèle/migrations** : `prisma/schema.prisma` (M), 2 migrations créées
  (`20260804225011_add_tresorerie_initiale/`, `20260805100000_add_snapshot_budget_initial_cloture_version/`).
- **Module rapprochement/mapping (production)** : `src/app/api/previsions/mapping-rapprochement/`
  (??), `src/app/api/previsions/scenarios/[id]/clotures/` (??), 11 fichiers
  `src/components/previsions/rapprochement-*.tsx/.ts` + `mapping-form-dialog.tsx` +
  `mapping-rapprochement-helpers.ts` (??), `src/lib/previsions/rapprochement.ts` +
  `rapprochement-vagues.ts` (??), `src/lib/queries/previsions-cloture.ts` +
  `previsions-rapprochement*.ts` + `previsions-snapshot-budget.ts` + `previsions-vagues-couts-reels.ts`
  + `previsions-vue-rapprochement.ts` (??).
- **Tests nouveaux** : ~13 fichiers `??` sous `src/lib/previsions/__tests__/`,
  `src/lib/queries/__tests__/`, `src/components/previsions/__tests__/`,
  `src/lib/validation/__tests__/`.
- **i18n** : `src/messages/{fr,en}/previsions.json`, `src/messages/fr/{depenses,stock}.json`,
  `src/messages/en/stock.json` (M).
- **Docs** : `docs/TASKS.md`, `docs/decisions/ADR-053-module-previsions.md`,
  `docs/knowledge/ERRORS-AND-FIXES.md` (M) ; `docs/analysis/`, `docs/reviews/`, `docs/sprints/`,
  `docs/tests/` (nouveaux fichiers ??, dont ce rapport).
- **API routes/queries existantes touchées** (fil de la trésorerie initiale, D1/D2, etc.) : ~35
  fichiers `M` sous `src/app/api/previsions/**/route.ts` et `src/lib/queries/previsions-*.ts`.
- **Artefact non lié au sprint, à ignorer/gitignorer** : `test-results/.last-run.json` (??) — fichier
  de sortie de test généré localement, sans rapport avec le contenu du sprint, ne doit pas être
  committé.

**Aucune falsification n'est restée en place** — les deux seuls fichiers mutés pendant cette passe
(`mapping-form-dialog.tsx`, `mapping-rapprochement-helpers.ts`) ont un hash `sha256` strictement
identique à l'état capturé avant mutation (§13.4). **Aucun fichier hors périmètre du sprint** n'a été
touché par le @tester pendant cette passe de clôture — seules des lectures (`Read`, `grep`,
`vitest run`, requêtes SQL en lecture seule) et les deux paires falsification/restauration décrites
en §13.4.

### 13.9 — Ce qui a échoué ou n'a pas pu être fait dans cette passe de clôture

- **(j) est un trou de couverture réel, non comblé** : la falsification de D1 (retour à
  `useState(false)` + `setState` piloté par l'effet) ne fait tomber **aucun** test. Ce n'est pas
  masqué : le correctif D1 protège contre un défaut d'une frame de rendu que la suite RTL actuelle
  ne peut pas observer à cette granularité. Décision de ne pas ajouter de test dans cette passe :
  la mission de clôture demande de **mesurer et rapporter**, pas de compléter unilatéralement la
  couverture ; à arbitrer par le PM/code-reviewer (ajouter un test dédié coûterait un mock React
  plus fin — `act()` synchrone sur le premier rendu avant résolution de la promesse — ce qui
  dépasse le périmètre de vérification demandé ici).
- **Aucun autre écart** : 3 passages `vitest` identiques (306/306 fichiers, 9413/9413 tests, 0
  échec, 0 skip), `build` et `migrate deploy` propres, recette moteur à 2 709/2 709, parité i18n
  totale (fr/en) sur les 3 fichiers demandés, aucune clé morte parmi les clés listées, EXCEL-V12
  identique avant/après (y compris `updatedAt` inchangé), résidu `vpr3b%` à 0 dans les 6 tables,
  falsification (k) confirmée à 1 test exactement, restaurations (j) et (k) prouvées par hash
  identique.
- **Rien n'a été committé ni poussé**, conformément à la mission.

## 12. Ce qui n'a pas été fait / limites (première passe, pré-correctifs — conservé pour historique)

- **Aucun test nouveau écrit** — la couverture livrée par le @developer a été jugée, après audit et
  falsification, suffisante sur les 6 points de la mission §A et les 5 règles de falsification §B.
  Si le PM ou le code-reviewer identifie un angle non couvert par cet audit, je le traiterai en
  itération.
- **Vérification manuelle en navigateur réel (ERR-157) non faite** — la pré-analyse (R4) notait que
  ce n'était pas attendu a priori pour ce sprint (pas de mécanisme de mise en page complexe
  introduit, simple sous-onglet + dialogue dans un `Tabs` déjà en place). Signalé pour information,
  pas un test manquant au sens de la mission.
- **Point de vigilance process (§3, note A.2) :** les tests DB-gated de ce module (immuabilité du
  mapping face à la clôture, isolation `siteId`) ne s'exécutent que si `DATABASE_URL` est exportée
  dans le shell avant `npx vitest run` — sans elle, ils sont silencieusement `skipped`, pas en échec.
  `npm test` / CI doivent garantir cette variable pour que cette preuve continue de mordre.
