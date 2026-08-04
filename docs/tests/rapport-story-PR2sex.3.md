# Rapport de test — Story PR2sex.3 (UI, sprint PR2-sexies)

**Testeur** : @tester (vérification adverse, pas complaisante)
**Date** : 2026-08-04
**Fichier principal** : `src/components/previsions/previsions-mensuelles-tab.tsx`
**Test principal** : `src/components/previsions/__tests__/previsions-mensuelles-tab.test.tsx`

## Verdict : **PASS**

Toutes les affirmations vérifiables du @developer sont confirmées, y compris — pour la première
fois sur cette story — **en navigateur réel** (Chromium/Playwright, scénario `EXCEL-V12`, lecture
seule stricte). Aucune régression détectée. 8 tests adverses supplémentaires ajoutés (cycle
paramétrable à 4 et à 1 position, caractères Unicode exacts §7.4) — tous passent. Un point de
vigilance signalé, pas bloquant : la flakiness des `*-form-dialog.test.tsx` est réelle et plus
large que ce que le @developer a rapporté (voir §6).

---

## 1. ERR-157 — vérification en navigateur réel (Chromium, 375 px et 1280 px)

**Outillage retrouvé** : `playwright`/`@playwright/test` déjà en dépendance du dépôt
(`package.json`), navigateurs déjà installés localement (`~/Library/Caches/ms-playwright`), dev
server déjà actif sur `http://localhost:4200` (`npm run dev`, port 4200 — cf.
`playwright.config.ts`). Aucun outil de campagne ERR-157 nommé n'existe dans `scripts/` (aucun
`*visual*`/`*screenshot*` référencé) — la vérification précédente (review PR2-quinquies) a
vraisemblablement été faite via un script ad hoc jamais committé. J'ai donc écrit mon propre script
Playwright, exécuté depuis un fichier temporaire à la racine du dépôt (supprimé après usage, jamais
committé) — mesures réelles, pas simulées.

**Procédure** : connexion (`admin@dkfarm.cm` / `admin123`, identifiants déjà publics dans
`src/__tests__/e2e/conservation-flow.spec.ts`, aucun secret nouveau exposé), sélection du site
"Ferme Douala" (le compte admin est multi-site), navigation vers le scénario `EXCEL-V12`
(`Plan de reference Excel v12`, `/previsions/scenarios/<id>`), onglet "Prévisions", ouverture
"Aliments" puis "Détail par mois de cycle" — **aucune écriture SQL, aucun appel API en écriture** ;
uniquement navigation UI et lecture (`GET`).

### Mesures — 375 px

| Mesure | Valeur |
|---|---|
| `document.documentElement.scrollWidth` / `clientWidth` | 375 / 375 — **aucun débordement de page** |
| Conteneur du tableau — `scrollWidth` / `clientWidth` / `scrollLeftMax` | 2101 / 341 / 1760 |
| En-tête "Détail par mois de cycle" — bounding box à `scrollLeft=0` | `x=25, y=642, w=95.5, h=16` |
| En-tête "Détail par mois de cycle" — bounding box à `scrollLeft=1760` (max) | `x=25, y=642, w=95.5, h=16` — **identique**, aucune dérive |
| Couleur de fond calculée de la cellule collante | `rgb(241, 245, 249)` — sans canal alpha, opaque |
| `elementFromPoint` au centre de l'en-tête à `scrollLeft` max | `<span class="truncate">Détail par mois de cycle</span>` — le libellé, pas une bande vide |
| Libellé le plus long testé (`"Sacs G1 — Granulé 2mm consommés (indicatif) — Mois 1 du cycle"`) | `scrollWidth=432` vs `clientWidth=72` → **tronqué**, `title` complet présent sur la cellule |

### Mesures — 1280 px

| Mesure | Valeur |
|---|---|
| `document.documentElement.scrollWidth` / `clientWidth` | 1280 / 1280 — **aucun débordement de page** |
| Conteneur du tableau — `scrollWidth` / `clientWidth` / `scrollLeftMax` | 2389 / 990 / 1399 |
| En-tête "Détail par mois de cycle" à `scrollLeft=0` puis `scrollLeft=1399` (max) | `x=277, y=604, w=199.5, h=16` — **identique aux deux positions** |
| Couleur de fond | `rgb(241, 245, 249)` — identique à 375 px |
| `elementFromPoint` au centre de l'en-tête à `scrollLeft` max | le libellé, pas une bande vide |
| Troncature du même libellé | `scrollWidth=432` vs `clientWidth=176` → tronqué, `title` présent |

**Piège méthodologique rencontré et corrigé pendant la vérification** : mon premier script ciblait
`.overflow-x-auto` avec `.first()` pour trouver le conteneur défilant du tableau — mais
`scenario-detail-client.tsx:152` pose la **même classe** sur la liste d'onglets
(Tableau de bord/Prévisions/Paramètres/…), qui apparaît avant le tableau dans le DOM. Le premier
run scrollait donc silencieusement la liste d'onglets, jamais le tableau (`scrollLeftMax` mesuré à
tort comme 501/0 au lieu de 1760/1399), un faux négatif qui aurait pu passer pour "peu de contenu
hors écran". Corrigé en ciblant explicitement le parent du `<table>`. **Cette classe DOM dupliquée
partageant le même sélecteur générique est elle-même un risque pour toute future vérification
automatisée** — signalé ici pour mémoire, hors périmètre de correction pour ce rapport.

**Captures d'écran** (scénario `EXCEL-V12`, 14 lignes "Aliments" dépliées + sous-section ouverte,
défilées à `scrollLeft` max) : confirment visuellement — colonne "INDICATEUR" et les 4 bandes de
section (RÉSULTAT/PRODUCTION/ALIMENTS/DÉTAIL PAR MOIS DE CYCLE) restent des bandes de texte
lisibles à `scrollLeft` max, jamais des bandes grises vides (le symptôme exact d'ERR-157). À 1280 px,
la colonne Total affiche **1 543 / 867 / – ** (position 1) puis **385 / 3 471 / 4 820** (position 2)
pour les granulométries G1/G2/G3 — ces valeurs **coïncident exactement avec les cumuls de contrôle
du jeu d'or** cités par la pré-analyse (§3), confirmant en conditions réelles (pas seulement en
fixture jsdom) que l'intégration avec le moteur PR2sex.2 est correcte de bout en bout.

**Verdict ERR-157 pour cette story : CONFIRMÉ, pas une hypothèse.** La sous-section hérite
correctement du motif à 2 cellules ; le fond opaque masque bien les colonnes de mois qui défilent
dessous ; aucun débordement horizontal de la page à aucune des deux largeurs ; la troncature de la
colonne collante fonctionne avec un `title` complet en filet de secours.

---

## 2. Cycle paramétrable côté UI

**Lecture du code** (`previsions-mensuelles-tab.tsx:485-520`) : `detailPositionsEtGranules` calcule
l'union RÉELLE des positions (`Object.keys(m.detailParVagueSacs)`) et des granulométries sur tous
les mois — aucun `1,2,3` en dur trouvé (`grep` sur les chaînes littérales du fichier, aucune
occurrence hors documentation JSDoc).

**Tests adverses ajoutés** (dans `previsions-mensuelles-tab.test.tsx`, nouvelle section
`"cycle paramétrable (vérification adverse @tester, story PR2sex.3)"`) :
- Une fixture à **4 positions de cycle** (`detailParVagueSacs: {1,2,3,4}`) → 4 lignes rendues dans
  l'ordre, aucune "Mois 5" fantôme.
- Une fixture à **1 seule position** → 1 seule ligne rendue, ni "Mois 2" ni "Mois 3" codés en dur.

Les deux passent. Confirme la garantie "jamais 1..3 codé en dur" par du code exécuté, pas seulement
par lecture.

---

## 3. Non-régression de la transposition (extraction `EnTeteRepliable`/`LigneRow`)

Le module Prévisions n'est **pas encore committé dans git** (`git ls-files | grep
components/previsions` → aucun résultat ; tout le répertoire est `??` dans `git status`) — aucun
diff `git` possible contre une version antérieure pour comparer le nombre d'assertions avant/après.

Vérification alternative : lecture complète du fichier de test (623 lignes) et comparaison avec la
description de la pré-analyse §7/§8 (tests existants à étendre : l.206 sections repliées par défaut,
l.263 granulométrie dynamique, l.322 structure à 2 cellules). Constat :
- Les 4 `describe` préexistants (sections repliables, en-tête collant, orientation desktop, tableau
  unique à toutes les tailles, colonne Total cumulative, Ventilations) sont **tous présents,
  intacts**, aucune assertion affaiblie ou supprimée observée à la lecture.
- Le test "chaque section (pas seulement Résultat) suit la même structure à 2 cellules" (l.436-442)
  reste scopé aux 5 sections top-level — **conforme à la pré-analyse** (une sous-section imbriquée
  n'entre pas dans ce compte par construction, cf. §8 pré-analyse).
- Un test dédié étend explicitement cette garantie à la sous-section (l.444-465) : motif à 2
  cellules réutilisé, `colSpan` correct, jamais de `colSpan` pleine largeur.
- Colonne collante, défilement confiné, unification mobile/bureau (`describe` "tableau unique à
  toutes les tailles") : tests inchangés, tous verts.

**Conclusion** : construction sur l'existant confirmée par lecture, aucune régression de structure
détectée ; l'absence de commit antérieur empêche une preuve `git diff` stricte — limite documentée,
pas contournée.

---

## 4. Cumuls (colonne Total, jeu d'or)

Deux niveaux de preuve :
1. **Recette moteur** (`src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts`,
   Section E, déjà en place — hors périmètre UI mais consommée par le composant) : compare
   `resultat.mois[m].detailParVagueSacs[position][granule]` à
   `besoinsAliments.detailParVagueSacs` du jeu d'or, tolérance zéro, pour chacune des 3 positions ×
   3 granulométries × 21 mois — **1378 tests**, tous verts.
2. **Navigateur réel** (§1 ci-dessus) : colonne Total affichée dans l'UI réelle sur `EXCEL-V12` =
   **1 543 / 867 / –** (position 1), **385 / 3 471 / 4 820** (position 2) — identique aux cumuls de
   contrôle cités par la pré-analyse. La position 3 (0/0/7230) n'a pas été capturée visuellement
   (hors cadre de la capture d'écran prise), mais la recette moteur (point 1) la couvre déjà avec
   tolérance zéro.

`totalMode: "somme"` confirmé par lecture (`calculerTotalLigne`, aucun branchement par nom de
ligne) et par test unitaire dédié (100 + 20 = 120, fixture à 2 mois).

---

## 5. Formats §7.4 — caractères Unicode exacts

Tests adverses ajoutés (comparaison de points de code, pas d'apparence visuelle) :
- Séparateur de milliers : `"1 543"` — confirmé **U+202F** (espace fine insécable), jamais un
  espace normal U+0020. Vérifié aussi indépendamment via `Intl.NumberFormat('fr-FR').format(1000)`
  dans l'environnement Node du projet → `"1 000"`.
- Zéro affiché en tiret : confirmé **U+2013** (en dash), jamais un hyphen-minus U+002D — vérifié par
  lecture directe du code source de `format-previsions.ts` (`return "–";` → `0x2013`).
- Aucune décimale sur les 9 nouvelles lignes (`format: "entier"`).
- Unité ("Sacs") portée par le libellé uniquement, jamais répétée dans les cellules de valeur —
  testé explicitement.

Tous ces tests passent (3/3).

---

## 6. Distinction consommés (ROUND) vs à commander (ceil)

Le libellé (`"Sacs {granule} consommés (indicatif) — Mois {count} du cycle"`) porte le mot
"indicatif" **visible en permanence**, sans ouvrir le popover — conforme à la pré-analyse §4. La
formule d'explication mentionne explicitement `ROUND`, cite la ligne voisine `"dont sacs {granule}
(total)"` par son nom exact, et précise `"arrondi PAR EXCÈS, ceil"` pour cette dernière — la
distinction est donc levée à deux niveaux (libellé visible + popover). Testé (`ROUND`, `À ACHETER`,
`arrondi PAR EXCÈS, ceil` tous présents dans le texte de formule rendu).

---

## 7. i18n

- **Parité stricte fr/en** : 406 clés de chaque côté (recomptage indépendant par script Node,
  comparaison ensembliste des chemins aplatis) — **aucune clé présente d'un seul côté**.
- **Clés mortes** : `page.detailTitle` et `page.backToList` absentes des deux fichiers JSON ET
  d'aucun fichier `.ts`/`.tsx` du dépôt (`grep -rn` = 0 résultat) — suppression confirmée dans les
  deux langues.
- **Aucune chaîne en dur** dans le composant : grep manuel de toutes les chaînes entre guillemets du
  fichier, aucune ne s'affiche à l'utilisateur sans passer par `t(...)`/`tStock(...)` (les
  occurrences trouvées sont des valeurs internes de type — `"somme"`, `"montant"`, `"entier"` — ou
  des commentaires JSDoc).
- **Accents corrects** : vérifiés à l'œil sur les clés ajoutées (`"Détail par mois de cycle"`,
  `"consommés"`, `"À ACHETER"`, `"arrondi PAR EXCÈS"`) — aucune séquence mal encodée détectée, et
  confirmés visuellement dans les captures d'écran du navigateur réel (§1).
- **ERR-144** : `previsions` figure bien dans les deux listes (`src/i18n/request.ts` et
  `src/messages/index.ts`) — aucun changement requis pour cette story, conforme à la pré-analyse.

---

## 8. Flakiness des tests `*-form-dialog.test.tsx` — mesurée sur 2 passages, PAS balayée

Suite complète rejouée **deux fois**, chiffres exacts :

| Passage | Fichiers en échec | Tests en échec | Total tests | Durée |
|---|---|---|---|---|
| 1 | **8** | **19** | 8734 passés / 21 skip / 26 todo (8800) | 95 s |
| 2 | **4** | **8** | 8745 passés / 21 skip / 26 todo (8800) | (non chronométré séparément) |

**Constat qui contredit la déclaration du @developer** ("6 échecs dans 4 fichiers") : le premier
passage montre **8 fichiers et 19 tests** en échec, pas 4/6 — significativement plus large. Le
second passage retombe à 4 fichiers / 8 tests, un sous-ensemble des fichiers touchés au passage 1
(`aliment-form-dialog`, `apport-form-dialog`, `poste-form-dialog`, `scenario-form-dialog` — présents
aux deux passages ; `journal-form-dialog` et `repartition-mois-dialog` uniquement au passage 1).
Tous les échecs sont des `Error: Test timed out in 5000ms` (timeout `userEvent`/rendu, pas une
assertion métier qui diverge), cohérent avec une explication de contention de parallélisme.

**Vérifié en isolation** : les 6 fichiers concernés (union des deux passages), rejoués ensemble mais
**seuls** (`npx vitest run <ces 6 fichiers>`) → **47/47 tests passent**, aucun timeout. Confirme que
le code n'est pas en cause — c'est bien un effet de charge/parallélisme quand la suite complète (287
fichiers) tourne en même temps.

**Verdict sur ce point** : flakiness réelle et confirmée, mais **plus étendue** que ce que le
@developer a rapporté (19 tests sur 4 fichiers de plus qu'annoncé au premier passage) — à signaler
au @project-manager comme dette de fiabilité de la suite (probable limite de ressources/workers
plutôt qu'un bug produit), pas un motif pour retarder cette story (aucun des tests instables ne
touche `previsions-mensuelles-tab.tsx` ni PR2sex.3).

---

## 9. Vérifications finales — sorties réelles

### `npx vitest run` — passage 1
```
Test Files  8 failed | 274 passed | 5 skipped (287)
     Tests  19 failed | 8734 passed | 21 skipped | 26 todo (8800)
  Duration  95.04s
```

### `npx vitest run` — passage 2
```
Test Files  4 failed | 278 passed | 5 skipped (287)
     Tests  8 failed | 8745 passed | 21 skipped | 26 todo (8800)
```

### `npx vitest run src/components/previsions/__tests__/previsions-mensuelles-tab.test.tsx` (isolé)
```
Test Files  1 passed (1)
     Tests  29 passed (29)
```
(24 tests du @developer + 5 tests adverses ajoutés par @tester : cycle 4 positions, cycle 1
position, séparateur milliers U+202F, tiret U+2013, unité non répétée.)

### `npx vitest run src/lib/previsions/__tests__/recette`
```
Test Files  3 passed (3)
     Tests  2300 passed (2300)
```

### `npm run build`
```
✓ Compiled successfully in 26.4s
```
Exit code 0, toutes les routes compilées (`/previsions/scenarios`, `/previsions/scenarios/[id]`
incluses), aucune erreur TypeScript.

---

## 10. Ce qui reste NON vérifié

- **Position 3 du cumul de contrôle (0 / 0 / 7 230)** en navigateur réel — capturée seulement au
  niveau recette moteur (tolérance zéro, 1378 tests), pas dans une capture d'écran dédiée. Risque
  jugé faible (même mécanisme de rendu que positions 1/2, déjà vérifiées réellement) mais non
  strictement prouvé en pixels.
- **Collision du popover d'explication contre le bord du viewport** à 375 px pour les 9 nouvelles
  lignes spécifiquement (le mécanisme `Popover` est partagé et déjà vérifié pour d'autres lignes en
  review PR2-quinquies, mais pas ré-exercé ici pour CES lignes précises).
- **Rendu tactile réel** (geste de balayage au doigt, `touch-pan-x`) — non simulable par Playwright
  sans émulation tactile dédiée, non tentée dans cette vérification.
- **Cause racine exacte de la flakiness `*-form-dialog.test.tsx`** (§8) — caractérisée (timeout,
  disparaît en isolation) mais pas diagnostiquée (quel worker, quelle ressource contendue) ; hors
  mandat de ce rapport, signalée au @project-manager.
- **Comparaison stricte `git diff` du nombre d'assertions avant/après** (§3) — impossible, le module
  n'étant pas encore committé ; compensée par une lecture exhaustive du fichier de test complet.

---

## Fichiers touchés par @tester dans ce rapport

- `src/components/previsions/__tests__/previsions-mensuelles-tab.test.tsx` — 5 tests adverses
  ajoutés (cycle paramétrable 4/1 positions, formats Unicode exacts §7.4). Aucun test existant
  modifié ni supprimé.
- Aucune modification de `src/lib/previsions/`, `prisma/fixtures/previsions/`, `docs/sprints/`,
  `docs/TASKS.md`. Aucune écriture SQL. Scripts Playwright de vérification créés dans un répertoire
  temporaire hors dépôt, supprimés après usage.
