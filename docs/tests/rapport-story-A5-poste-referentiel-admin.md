# Rapport de tests — story A.5 : administration du référentiel de postes + visibilité du rattachement

**Sprint :** PR3-quinquies (story A.5)
**Testeur :** @tester
**Date :** 2026-08-05
**Référence :** ADR-053 §16.6, §16.8, §16.9, §16.10, §16.11, §16.12 ; pré-analyse
`docs/analysis/pre-analysis-story-A5-poste-referentiel-admin.md`

## 1. État à l'arrivée

29 tests échouaient dans 6 fichiers, tous par obsolescence de contrat assumée (nouveau contrat
XOR ACTIVE `posteReferentielId` / `nouveauPosteReferentielLibelle` remplaçant le get-or-create
silencieux de §16.11). Mission : remettre la suite au vert, ajouter la couverture manquante, et
falsifier chaque règle nouvellement introduite pour prouver que sa violation fait effectivement
tomber des tests (discipline ERR-160/ERR-171).

## 2. Remise au vert (6 fichiers, 29 tests)

| Fichier | Nature du fix |
|---|---|
| `src/lib/queries/__tests__/previsions-charges.test.ts` | Mécanique (`nouveauPosteReferentielLibelle`) + réécriture complète du describe "get-or-create" en describe "contrat XOR ACTIVE" (11 tests, dont les 4 branches 400/404/409/201) |
| `src/lib/queries/__tests__/previsions-mapping-orphelins-integration.test.ts` | Mécanique sur 5 tests ; réécriture des tests (2)/(3) pour utiliser `posteReferentielId` explicite (branche a) au lieu du get-or-create implicite ; réécriture complète du test (6) concurrence — **divergence explicite** : la seconde requête reçoit désormais un 409 `POSTE_REFERENTIEL_CODE_COLLISION` (`Promise.allSettled`, jamais une réutilisation silencieuse) |
| `src/lib/queries/__tests__/previsions-rapprochement-integration.test.ts` | Mécanique (2 tests) |
| `src/lib/queries/__tests__/previsions-snapshot-budget-integration.test.ts` | Mécanique (2 tests) |
| `src/lib/queries/__tests__/previsions-tresorerie-trois-series-integration.test.ts` | Mécanique (6 tests) |
| `src/components/previsions/__tests__/poste-form-dialog.test.tsx` | **Réécriture complète** (16 tests) — parcours à deux temps (onglets Rechercher/Créer) |

Pièges rencontrés pendant la réécriture UI (documentés pour éviter une récidive) :
- `Input` avec `required` ajoute un `*` accolé sans espace au texte du `<label>` → `getByLabelText(/^Libellé$/)` (ancrage `$`) ne matche jamais ; corrigé en `/^Libellé\*?$/`.
- Les `TabsTrigger` Radix ne réagissent pas de façon fiable à `fireEvent.click` seul dans jsdom (nécessite `userEvent.click`, geste utilisateur complet avec pointerdown/pointerup).
- Le composant affiche le message d'erreur **deux fois** (prop `error` de l'`Input` + bloc `{error && !collision}` séparé) pour le cas `POSTE_REFERENTIEL_INACTIF` — `getAllByText` au lieu de `findByText` (comportement de présentation existant, non corrigé ici, hors périmètre du contrat testé).

## 3. Couverture ajoutée (contrat A.5)

### 3.1 Contrat XOR — niveau fonction (`previsions-charges.test.ts`, mock)
400 CHAMP_REQUIS (aucun champ), 400 CHAMPS_EXCLUSIFS (les deux), 404 INTROUVABLE (autre site/absent,
jamais 403), 409 INACTIF (branche a), 409 CODE_COLLISION avec preuve explicite qu'**aucun suffixe
numérique n'est généré** (`salaires` reste unique, jamais `salaires-2`), 409 INACTIF (branche b),
isolation multi-site (R8).

### 3.2 Contrat XOR — niveau route HTTP (`scenarios/[id]/postes/__tests__/route.test.ts`, nouveau, 9 tests)
400/400/201/201/404/409/409 + 401/403 — vérifie que `handleApiError` propage bien `code` et
`details.posteReferentielExistant` jusqu'au JSON de réponse.

### 3.3 Routes d'administration (nouveaux fichiers)
- `postes-referentiel/__tests__/admin-route.test.ts` (4 tests) : `GET /admin` — 401/403, permission
  EXACTE `PREVISIONS_PARAMETRER` (distincte de `PREVISIONS_VOIR`), 200 actifs+inactifs.
- `postes-referentiel/[id]/__tests__/route.test.ts` (6 tests) : `PATCH` — 401/403, **400 si `code`
  présent dans le body** (schéma `.strict()`), 400 libellé vide, 200 (thread `activeSiteId`), 404
  site-scoping.
- `postes-referentiel/[id]/desactiver/__tests__/route.test.ts` (5 tests) et `.../reactiver/...`
  (5 tests) : 401/403, 200 succès, 200 idempotent (jamais 409 sur double désactivation/réactivation),
  404 site-scoping.

### 3.4 Les trois cas métier exigés par le chef de projet (DB-gated, nouveau fichier)
`previsions-postes-referentiel-admin-integration.test.ts` (3 tests, contre un vrai Postgres) :
- **(a) divergence** : un `PostePrevision` dont le libellé scénario-local diverge du libellé
  référentiel (`"Salaires equipe production (scenario)"` vs `"Salaires"`) reste **rapproché
  correctement** — le mapping résout via `posteReferentielId`, jamais via le texte.
- **(b) renommage** : `renommerPosteReferentiel` (fonction de production, pas un `UPDATE` SQL
  direct) change le libellé référentiel sans casser le mapping ni le rapprochement déjà en place —
  `code` reste figé, le montant rapproché est identique avant/après.
- **(c) désactivation** : `desactiverPosteReferentiel` bloque un **nouveau** rattachement (branche a
  ET branche b, deux assertions distinctes) tout en laissant le `PostePrevision`/
  `MappingRapprochement` déjà liés **intacts et lisibles** (relecture explicite après désactivation).

## 4. Falsification obligatoire — tableau règle → tests tombés → verdict

Chaque règle a été cassée volontairement dans le code de production, la suite relancée, les
échecs comptés, puis le fichier restauré et la restauration prouvée par `diff` contre une copie
de sauvegarde prise juste avant la casse (identique à l'octet près après restauration).

| # | Règle falsifiée | Geste de casse | Tests tombés | Verdict |
|---|---|---|---|---|
| 1 | XOR (aucun champ / les deux champs acceptés) | Neutralisation des deux `throw` de garde dans `createPostePrevision` (`if (false && ...)`) | **2** (`previsions-charges.test.ts` : CHAMP_REQUIS, CHAMPS_EXCLUSIFS) | Couvert |
| 2 | Refus de collision (réintroduction d'une réutilisation silencieuse, sans suffixe numérique) | Remplacement du `throw 409 CODE_COLLISION` par `return { posteReferentielId: existant.id, reutilise: false }` (reprise du get-or-create §16.11) | **2** (`previsions-charges.test.ts` : collision active ; `previsions-mapping-orphelins-integration.test.ts` : concurrence, 2 succès au lieu de 1) | Couvert |
| 3 | Blocage de rattachement à une entrée désactivée (branche a) | Suppression du `throw 409 INACTIF` dans `resoudreBranchePosteReferentielExistant` | **2** (`previsions-charges.test.ts` : branche a inactive ; `previsions-postes-referentiel-admin-integration.test.ts` : cas métier (c)) | Couvert |
| 4 | Figement de `code` au renommage (autorisation de le modifier) | Retrait du `.strict()` sur `renommerPosteReferentielSchema`, ajout de `code: z.string().optional()` | **1** (`postes-referentiel/[id]/__tests__/route.test.ts` : 400 si `code` présent) | Couvert — défense en profondeur : même avec le schéma relâché, `renommerPosteReferentiel` n'accepte que `libelle` en paramètre de fonction, donc la valeur de `code` en base ne bougerait de toute façon jamais ; le seul test qui peut voir la régression est celui qui vérifie le rejet **au niveau de la route** (comportement contractuel, pas seulement l'état final en base) |

Aucune falsification n'est tombée à 0 test — aucun trou de couverture résiduel identifié sur ces
quatre règles.

### Preuve de restauration (extrait, répétée à chaque étape)
```
$ diff /tmp/previsions-charges.ts.bak{,2,3} src/lib/queries/previsions-charges.ts
IDENTICAL — restauration prouvee   (x3, une par falsification touchant ce fichier)
$ diff /tmp/previsions.schema.ts.bak src/lib/validation/previsions.schema.ts
IDENTICAL — restauration prouvee
```

## 5. Chiffres finaux

- **Suite complète** (`set -a && source .env && set +a && npx vitest run`) : **337 fichiers / 9654
  tests / 0 skip / 0 échec / 26 todo** (pré-existants, module densité, hors périmètre).
  Baseline à l'arrivée : 331 fichiers / 9607 tests (29 en échec) → +6 fichiers de test nouveaux,
  +47 tests nets (11 réécrits + 36 ajoutés, moins quelques suppressions dans la réécriture UI).
- **Recette moteur pur** (`src/lib/previsions/__tests__/recette`) : **2709/2709**, inchangée — le
  moteur de calcul n'a pas bougé, seul l'enrichissement de présentation (rattachement) a été ajouté.
- **Build** (`npm run build`) : exit 0, toutes les routes compilées y compris
  `/previsions/postes-referentiel` et les 3 nouvelles routes d'administration.

## 6. Intégrité EXCEL-V12 (lecture seule stricte)

Vérifiée par SQL direct avant le premier test DB-gated et après la suite complète (falsifications
incluses) :

| Grandeur | Avant | Après |
|---|---|---|
| `VaguePrevue` | 19 | 19 |
| Σ `effectifAlevinsPrevu` | 602 500 | 602 500 |
| `AlimentPrevision` | 3 | 3 |
| `PalierRemise` | 4 | 4 |
| Σ `ApportCapital.montantFCFA` | 30 000 000 | 30 000 000 |
| Σ `JournalDepensePrevue.montantFCFA` | 34 400 000 | 34 400 000 |
| `PosteReferentiel` | 4 | 4 |
| `PostePrevision` | 4 | 4 |
| `MappingRapprochement` | 0 | 0 |

Aucun écart. Tous les tests DB-gated créent leurs propres sites/scénarios isolés (préfixes
`a5-admin-site-*`, `pr3quater-a4-site-concurrence`, etc.) et les nettoient intégralement en `finally`.

## 7. Trous de couverture comblés en cours de route

- Le test de concurrence (6) de `previsions-mapping-orphelins-integration.test.ts` testait
  l'ancien contrat (réutilisation silencieuse) — réécrit pour prouver le nouveau contrat (409 sur
  la requête perdante), sans quoi la falsification de la règle 2 serait passée inaperçue sur ce
  fichier.
- Aucune route HTTP (par opposition à la fonction `createPostePrevision`) n'était testée pour le
  contrat XOR avant cette story — ajouté (`scenarios/[id]/postes/__tests__/route.test.ts`), sans
  quoi une régression dans le mapping `handleApiError`/`code`/`details` serait passée inaperçue.
- Aucune route d'administration (`GET /admin`, `PATCH`, `desactiver`, `reactiver`) n'avait de test
  — ajouté intégralement (4 fichiers, 20 tests).
- Le fichier `db-gated-allowlist.ts` (registre ADR-052) a dû être mis à jour pour déclarer le
  nouveau fichier DB-gated — sans quoi le test meta `db-gated-tests-registry.test.ts` aurait
  échoué (garde-fou anti-invisibilité, ERR-160/171).

## 8. Second passage — fermeture du trou §8 précédent (2026-08-05)

Le premier passage avait déclaré « hors budget » exactement les trois fichiers qui portent la
contrepartie de la story : `poste-rattachement.ts` (fonctions pures de décision du signal),
`poste-rattachement-badge.tsx` (présentation, deux formes), et `postes-referentiel-admin-client.tsx`
(écran d'administration). Sans test sur ces fichiers, la garantie « le rattachement est visible
partout où un `PostePrevision` apparaît » n'était affirmée nulle part — trou comblé ici.

### 8.1 Fichiers de test ajoutés

| Fichier | Tests | Couvre |
|---|---|---|
| `src/lib/previsions/__tests__/poste-rattachement.test.ts` | 14 | `libelleDivergeDuReferentiel` (identique, divergent, trim, casse insensible, accents **non** normalisés, espace interne, chaînes vides) ; `calculerSignalRattachement` (les 4 quadrants {coïncident,divergent}×{actif,inactif}, priorité de `inactif` sur `divergent` dans le `kind`) |
| `src/components/previsions/__tests__/poste-rattachement-badge.test.tsx` | 16 | `PosteRattachementLigne` (undefined défensif, aucun signal, divergent actif, désactivé+divergent, désactivé+coïncident) ; `suffixeCompactRattachement` (les 3 sorties : `null`, `réf. {libelle}`, `réf. désactivé`) ; `posteIdDepuisLigneId` ; `enrichirLibelleAvecRattachement` (table absente, clé absente, clé avec/sans suffixe mois, non-divergent = no-op, désactivé) |
| `src/components/previsions/__tests__/postes-referentiel-admin-client.test.tsx` | 12 | Liste actives+inactives, empty state, R5 (`DialogTrigger asChild` — un seul `<button>` par action), renommer (succès, libellé vide rejeté, échec API = pas de mise à jour optimiste), désactiver/réactiver (succès + échec API), i18n fr/en exhaustive sur les clés `posteReferentielAdmin.*` utilisées |
| `src/components/previsions/__tests__/rapprochement-vue-rattachement.test.tsx` | 8 | Propagation de `posteRattachementParId` dans les 3 vues (`RapprochementVueMensuelle`, `RapprochementVueCumulee`, `RapprochementVueTopEcarts`) — cas positif (donnée fournie → suffixe affiché) ET négatif (donnée absente → no-op), lignes `NON_RAPPROCHE` jamais enrichies |
| `src/components/previsions/__tests__/charges-tab.test.tsx` (étendu) | +6 | `PosteRattachementLigne` réellement monté dans `ChargesTab` : aucun signal (coïncident+actif), divergent+actif, désactivé+divergent, désactivé+coïncident (règle non négociable — visible même sans divergence) |
| `src/components/previsions/__tests__/previsions-mensuelles-tab.test.tsx` (étendu) | +1 | Ligne « Dépenses — {poste} » de la section Ventilations porte le suffixe compact quand `posteReferentiel` diverge, et n'en porte AUCUN quand il coïncide |
| `src/components/previsions/__tests__/permissions-gating.test.tsx` (fixture corrigée) | 0 (fix de compilation) | — |

Au passage, 3 fichiers de fixtures existants (`charges-tab.test.tsx`, `previsions-mensuelles-tab.test.tsx`,
`permissions-gating.test.tsx`) construisaient un `PostePrevisionDTO` sans `posteReferentielId`/
`posteReferentiel` — champs devenus **non optionnels** dans `api-types.ts` depuis cette story
(`posteReferentielId` NOT NULL en base). `npx tsc --noEmit` sur `tsconfig.json` complet révélait
ces erreurs (7 emplacements) ; `next build` ne les révèle PAS (le vérificateur de types de Next
n'inclut pas les fichiers `__tests__` dans son graphe de contrôle) — corrigé ici pour que les
fixtures reflètent le contrat réel, indépendamment de ce que `next build` détecte ou non.

### 8.2 Comportement documenté par le test (pas seulement supposé)

`libelleDivergeDuReferentiel` compare en `trim().toLowerCase()` — une différence de **casse** ou
d'**espace de bord** seule n'est PAS une divergence, mais une différence d'**accentuation**
(« Electricite » vs « Électricité ») EST une divergence (comparaison texte simple, jamais
sluggifiée — comportement du code, prouvé par test plutôt que simplement lu dans le commentaire).

### 8.3 Falsification — tableau règle → tests tombés → verdict

| # | Règle falsifiée | Geste de casse | Fichier | Tests tombés | Verdict |
|---|---|---|---|---|---|
| 5 | Signal "divergent" affiché quand le libellé diverge (entrée active) | `if (false && divergent)` dans `calculerSignalRattachement` | `poste-rattachement.ts` | **10**, réparties sur **5 fichiers** : `poste-rattachement.test.ts` (1), `poste-rattachement-badge.test.tsx` (4), `charges-tab.test.tsx` (1), `previsions-mensuelles-tab.test.tsx` (1), `rapprochement-vue-rattachement.test.tsx` (3, une par vue) | Couvert — défense en profondeur réelle sur toute la chaîne fonction pure → badge → 5 écrans consommateurs |
| 6 | Signal "inactif" affiché MÊME sans divergence (règle non négociable §16.12) | `if (!referentiel.actif && divergent)` (ajout de la condition manquante) | `poste-rattachement.ts` | **4** au premier essai, sur 3 fichiers — cf. §8.4 : trou détecté (aucune des 3 vues de rapprochement ne couvrait ce sous-cas), test manquant ajouté, falsification **rejouée** → **7**, sur **4 fichiers** (`poste-rattachement.test.ts` (1), `poste-rattachement-badge.test.tsx` (2), `charges-tab.test.tsx` (1), `rapprochement-vue-rattachement.test.tsx` (3, une par vue)) | Couvert (après complément) |
| 7 | Propagation du rattachement jusqu'à l'écran Charges (`ChargesTab` doit monter `PosteRattachementLigne`) | `{false && <PosteRattachementLigne .../>}` dans `charges-tab.tsx` | `charges-tab.tsx` | **3** (`charges-tab.test.tsx` — divergent, désactivé+divergent, désactivé+coïncident) | Couvert |
| 8 | Propagation du rattachement jusqu'à la vue Rapprochement mensuelle (`RapprochementVueMensuelle` doit appeler `enrichirLibelleAvecRattachement`) | Remplacement de l'appel par `libelle: l.libelle` (no-op) dans `rapprochement-vue-mensuelle.tsx` | `rapprochement-vue-mensuelle.tsx` | **2** (`rapprochement-vue-rattachement.test.tsx` — divergent, désactivé) | Couvert |
| 9 | L'écran d'administration liste TOUTES les entrées (actives ET inactives), jamais seulement les actives | `entries.filter((e) => e.actif).map(...)` dans `postes-referentiel-admin-client.tsx` | `postes-referentiel-admin-client.tsx` | **5** (`postes-referentiel-admin-client.test.tsx` — liste actives+inactives, code, boutons désactiver/réactiver présents, les deux tests de mutation qui rendent une entrée inactive) | Couvert |

Aucune falsification n'est tombée à 0 test. La règle 6 est le cas conforme à la consigne
« si une falsification ne fait tomber aucun test pour un des écrans visés, ajoute le test manquant
puis refais la falsification » — appliqué ici bien que le premier essai n'ait pas été à 0 (4 tests
sont tombés), parce que le trou détecté (0 test tombé DANS `rapprochement-vue-rattachement.test.tsx`
spécifiquement) portait exactement sur la garantie que la mission demande de vérifier
« écran par écran ».

### 8.4 Trou détecté PUIS comblé pendant la falsification elle-même (règle 6)

Premier essai de la falsification 6 : 4 tests tombent, tous en dehors de
`rapprochement-vue-rattachement.test.tsx` — signe que ce fichier ne couvrait, pour le sous-cas
"inactif + libellé coïncident", aucune des 3 vues de rapprochement (il ne couvrait que
inactif+divergent). Un composant qui affiche le signal via une fonction partagée
(`enrichirLibelleAvecRattachement`) déjà testée ailleurs peut sembler couvert "par transitivité" —
mais c'est précisément le type de raisonnement qui a produit ERR-185 : un appelant peut toujours
diverger de la fonction qu'il appelle (branchement conditionnel, filtre, transformation
intermédiaire), et seul un test qui exerce l'appelant lui-même le prouve.

**Action prise** : ajout de 3 tests (un par vue, `rapprochement-vue-rattachement.test.tsx`) pour le
sous-cas "inactif + coïncident", avec une nouvelle entrée de fixture `poste-inactif-coincident`
(libellé référentiel === libellé de ligne, `actif: false`). Falsification **rejouée** dans son
intégralité (poste-rattachement.ts restauré, puis re-cassé) : **7 tests tombent** cette fois,
dont les 3 nouveaux — gap comblé, confirmé par re-exécution, pas seulement par lecture du code.

### 8.5 Preuve de restauration (chaque falsification, diff contre sauvegarde)

```
$ diff .../poste-rattachement.ts.bak src/lib/previsions/poste-rattachement.ts
IDENTICAL — restauration prouvee   (x2 : falsifications 5 et 6)
$ diff .../charges-tab.tsx.bak src/components/previsions/charges-tab.tsx
IDENTICAL — restauration prouvee
$ diff .../rapprochement-vue-mensuelle.tsx.bak src/components/previsions/rapprochement-vue-mensuelle.tsx
IDENTICAL — restauration prouvee
$ diff .../postes-referentiel-admin-client.tsx.bak src/components/previsions/postes-referentiel-admin-client.tsx
IDENTICAL — restauration prouvee
$ grep -n "false &&" src/components/previsions/charges-tab.tsx src/components/previsions/rapprochement-vue-mensuelle.tsx src/lib/previsions/poste-rattachement.ts src/components/previsions/postes-referentiel-admin-client.tsx
(aucune sortie — aucun résidu de casse dans le dépôt)
```

## 9. Chiffres finaux (second passage)

- **Suite complète** (`set -a && source .env && set +a && npx vitest run`) : **341 fichiers / 9712
  tests / 0 skip / 0 échec / 26 todo** (pré-existants, module densité, hors périmètre). Point de
  départ de ce passage : 337 fichiers / 9654 tests → **+4 fichiers de test nouveaux, +58 tests
  nets** (50 nouveaux dont les 3 comblant le trou §8.4 + 7 étendus dans des fichiers existants,
  1 fichier corrigé sans ajout).
- **Recette moteur pur** (`src/lib/previsions/__tests__/recette`) : **2709/2709**, inchangée.
- **Build** (`npm run build`) : exit 0 (vérifié trois fois : avant falsification, après restauration
  de la falsification 6 initiale, et après le complément de §8.4).

## 10. Intégrité EXCEL-V12 (lecture seule stricte, second passage)

SQL direct (Docker `silures-db`), scénario `cmsdnypml0000n4ekuadykn0f`, avant le premier test de ce
passage et après la suite complète (falsifications de §8.3 incluses) :

| Grandeur | Avant | Après |
|---|---|---|
| `VaguePrevue` | 19 | 19 |
| Σ `effectifAlevinsPrevu` | 602 500 | 602 500 |
| `AlimentPrevision` | 3 | 3 |
| `PalierRemise` | 4 | 4 |
| Σ `ApportCapital.montantFCFA` | 30 000 000 | 30 000 000 |
| Σ `JournalDepensePrevue.montantFCFA` | 34 400 000 | 34 400 000 |
| `PosteReferentiel` (site_01) | 4 | 4 |
| `PostePrevision` (scénario) | 4 | 4 |
| `MappingRapprochement` (site_01) | 0 | 0 |

Aucun écart. Tous les tests ajoutés dans ce passage sont des tests de composant (jsdom, mocks) —
aucun n'a touché la base de données ; la vérification avant/après confirme néanmoins qu'aucune
suite préexistante n'a dérivé pendant la session.

## 11. Ce qui reste réellement non couvert après ce second passage

- Le trou détecté en §8.4 (sous-cas "inactif + libellé coïncident" sur les 3 vues de rapprochement)
  a été comblé pendant ce passage — plus un trou résiduel à cette date.
- L'écran d'administration n'a pas de test end-to-end navigateur réel (Chromium) — uniquement
  jsdom ; comme documenté ailleurs dans ce dépôt (ERR-157), jsdom ne peut pas prouver le rendu
  visuel réel (troncature, largeur de colonne, defilement tactile) — non applicable ici car
  l'écran est une liste de cartes simple, mais mentionné par principe.
- Aucun test de la route `GET /previsions/postes-referentiel` (Server Component, chargement initial
  `initialEntries`) au niveau page — la couche client (`PostesReferentielAdminClient`) et la couche
  route API (`GET /admin`, §3.3 du premier passage) sont couvertes séparément ; le branchement
  Server Component → prop `initialEntries` ne l'est pas explicitement par un test dédié.

## 12. i18n

Toutes les nouvelles chaînes utilisateur (`posteForm.*`, `posteFormDialog.*`,
`posteReferentielAdmin.*`, `posteRattachement.*`) existent en `fr` et `en` — vérifié dans les
fichiers de messages avant écriture des tests, ET reprouvé par un test dédié (`postes-referentiel-
admin-client.test.tsx`, describe "i18n") qui échoue si une clé `posteReferentielAdmin.*` utilisée
par le composant manque dans l'un des deux fichiers de messages.
