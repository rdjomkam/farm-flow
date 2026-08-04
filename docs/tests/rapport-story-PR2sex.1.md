# Rapport de test — Story PR2sex.1

**Sprint :** PR2-sexies
**Story :** PR2sex.1 (TEST, pipeline @tester seul)
**Date :** 2026-08-04
**Objectif :** lever le blocage laissé par PR2-quinquies (review VALIDÉ AVEC RÉSERVES) en étendant
`extract-golden.py` pour extraire les neuf séries du bloc « DÉTAIL PAR VAGUE — sacs consommés dans
le mois (indicatif) » (`Prévisions!A11:V23`), délibérément écartées jusqu'ici.

## 1. Vérification de la correspondance ligne↔série (avant tout code)

Lecture directe des libellés de colonne A, lignes 11 à 24 du classeur (`data_only=True`,
`openpyxl`) :

| Ligne | Libellé colonne A | Valeur B (2026-08) | Valeur W (cumul) |
|---|---|---|---|
| 11 | DÉTAIL PAR VAGUE — sacs consommés dans le mois (indicatif) | — | — |
| 12 | Vague en 1er mois de cycle | `V1` | — |
| 13 | dont sacs 2 mm | 26 | 1 543 |
| 14 | dont sacs 3 mm | 14 | 867 |
| 15 | dont sacs 4 mm | 0 | 0 |
| 16 | Vague en 2e mois de cycle | `—` | — |
| 17 | dont sacs 2 mm | 0 | 385 |
| 18 | dont sacs 3 mm | 0 | 3 471 |
| 19 | dont sacs 4 mm | 0 | 4 820 |
| 20 | Vague en 3e mois de cycle | `—` | — |
| 21 | dont sacs 2 mm | 0 | 0 |
| 22 | dont sacs 3 mm | 0 | 0 |
| 23 | dont sacs 4 mm | 0 | 7 230 |

**Correspondance confirmée exactement conforme à l'énoncé de la story** — lignes 13/14/15 = 1er
mois de cycle 2/3/4 mm, 17/18/19 = 2e mois, 21/22/23 = 3e mois. Aucune surprise, aucun réordonnancement
nécessaire.

Les lignes 12/16/20 portent bien un code de vague issu d'un lookup (`V1`, `—`, `—`) — traitées
comme métadonnée défectueuse marquée `$defectueux`, jamais comme série numérique (cf. §3).

## 2. Preuve d'invariance (avant/après régénération)

### 2.1 Empreintes avant modification

```
668b48888f0c447ae7213a7a05f3d49ee14f59357e5445bcbf7690ecbd8452cd  plan-v12-corrige.json
3607571c3a6ad319838f45140c70bfad2bd8c2977a326afaf517c9a466d5a0a5  annexe-b-corrigee.json
```

Copies de sauvegarde conservées dans le scratchpad (hors dépôt) :
`plan-v12-corrige.BEFORE.json`, `annexe-b-corrigee.BEFORE.json`.

### 2.2 Empreintes après régénération

```
f794d79d94e0e2fb911a8506e9f422c1229f6f7e96fac159d0d1591576ea3eb0  plan-v12-corrige.json
e02d56f369953532471da3e19d3c7d0e78d77daacb0824fe185f5288bb99a32f  annexe-b-corrigee.json
```

Empreintes différentes (attendu : nouveau contenu ajouté), donc la comparaison ne s'arrête pas là —
diff structurel clé par clé effectué (§2.3).

### 2.3 Diff structurel clé par clé (avant vs après)

Script Python de comparaison récursive dict par dict (avant/après), séparant clés ajoutées,
supprimées et valeurs changées :

```
=== plan-v12-corrige.json ===
added (1): ['/besoinsAliments/detailParVagueSacs']
removed (0): []
changed (0): []
=== annexe-b-corrigee.json ===
added (1): ['/besoinsAliments/detailParVagueSacs']
removed (0): []
changed (0): []
```

**Conclusion : toutes les séries préexistantes sont strictement inchangées (0 valeur modifiée, 0
clé supprimée) — seule la nouvelle clé `besoinsAliments.detailParVagueSacs` est apparue, dans les
deux fixtures.**

### 2.4 Idempotence / déterminisme

Le script a été exécuté deux fois de suite sur le fichier déjà régénéré ; les empreintes sha256 des
deux exécutions sont identiques (`IDEMPOTENT: identical output across two runs`) — pas de dépendance
à l'ordre d'itération d'un dict Python ou à un horodatage.

## 3. Extraction implémentée

`extract-golden.py` : nouvelle fonction `extraire_detail_par_vague(pv)`, appelée depuis `main()`,
injectée dans `commun["besoinsAliments"]["detailParVagueSacs"]` (bloc partagé entre les deux
scénarios A et B — voir §4).

- Neuf séries numériques via `read_row` (B..V, comme toutes les autres séries du script) :
  `moisCycle1.2mm/3mm/4mm`, `moisCycle2.2mm/3mm/4mm`, `moisCycle3.2mm/3mm/4mm`.
- Chaque sous-bloc `moisCycleN` porte sa propre clé `$source` (ex.
  `"Prévisions!B13:V13, B14:V14, B15:V15"`), comme le reste du script.
- Lignes 12/16/20 : **pas** extraites comme séries numériques. Extraites uniquement comme
  métadonnée `moisCycleNVagueLabelIndexMatch` (`valeurMois1` = colonne B seule), avec une clé
  `$defectueux` documentant explicitement le défaut INDEX/MATCH (une seule vague affichée même
  quand plusieurs coïncident) et renvoyant à ADR-053 §7 (« Défaut bénin confirmé ») — jamais
  consommée par une future recette comme une entrée numérique.
- Valeurs lues exclusivement depuis les cellules calculées (`data_only=True`) — aucun recalcul.

## 4. Cumuls de contrôle (colonne W du classeur) vs attendu

| | 2 mm | 3 mm | 4 mm |
|---|---|---|---|
| 1er mois de cycle | attendu 1 543, obtenu **1 543** | attendu 867, obtenu **867** | attendu 0, obtenu **0** |
| 2e mois de cycle | attendu 385, obtenu **385** | attendu 3 471, obtenu **3 471** | attendu 4 820, obtenu **4 820** |
| 3e mois de cycle | attendu 0, obtenu **0** | attendu 0, obtenu **0** | attendu 7 230, obtenu **7 230** |

**Les neuf cumuls tombent exactement juste — aucun écart, aucune hypothèse de correspondance fausse
à signaler.** Vérifié deux fois indépendamment : (a) somme des 21 valeurs `B{row}:V{row}` lues par
`read_row` comparée à la cellule `W{row}` du classeur (script Python indépendant, hors
`extract-golden.py`), (b) somme du tableau JSON `to_json(...)` déjà écrit dans la fixture finale.

## 5. Affectation par le patch B10 / différences A vs B

Question posée explicitement (pas supposée en silence) : ces neuf séries sont-elles affectées par
le patch `Dépenses!B10` ou par l'absence d'apports/investissements du scénario B ?

**Non, sur les deux points**, et c'est vérifié, pas seulement affirmé :
- Ce sont des décomptes de sacs (entiers), jamais des montants en FCFA — le patch B10 est une
  correction de 30 000 FCFA sur une ligne de dépense de transport, sans rapport avec un comptage de
  sacs consommés.
- Le bloc est extrait dans `extraire_detail_par_vague(pv)` et injecté dans le dict `commun`, la
  même structure partagée par les deux scénarios (comme `entreesModele`, `besoinsAliments.totalKg`,
  etc.) — jamais dans les blocs `resultats` propres à A ou B.
- Vérification directe : les deux fixtures régénérées portent des valeurs **identiques** pour
  `detailParVagueSacs` (diff structurel §2.3 : le bloc entier est identique caractère pour
  caractère entre `plan-v12-corrige.json` et `annexe-b-corrigee.json`, seule la zone `resultats`
  diverge — cohérent avec le README préexistant sur `entreesModele`).

## 6. Mise à jour de la documentation

`prisma/fixtures/previsions/README.md` : nouvelle section
« `besoinsAliments.detailParVagueSacs` — les neuf séries « DÉTAIL PAR VAGUE » (Sprint PR2-sexies) »
documentant : la table ligne↔série, la distinction `ROUND` (sacs consommés) vs `CEIL` (sacs à
acheter, lignes 7-10 déjà existantes), la non-affectation par B10/scénario B, les cumuls de
contrôle, et le défaut INDEX/MATCH des lignes 12/16/20 à ne pas reproduire.

## 7. Vérification finale (sortie réelle)

### `npx vitest run`

```
Test Files  281 passed | 5 skipped (286)
     Tests  8333 passed | 21 skipped | 26 todo (8380)
```

Conforme à la base attendue : **286 fichiers, 8333 tests hors DB-gated, 0 échec.**

### `npx vitest run src/lib/previsions/__tests__/recette`

```
✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (461 tests)
✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (461 tests)
✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (982 tests)

 Test Files  3 passed (3)
      Tests  1904 passed (1904)
```

Conforme à la base attendue : **1904 tests, 0 écart** — la recette reste strictement inchangée,
comme attendu puisque le moteur (`src/lib/previsions/`) n'a pas été touché par cette story.

### `npm run build`

Build production terminé sans erreur (toutes les routes générées, aucune erreur TypeScript/ESLint
bloquante).

## 8. Ce qui a échoué / ce qui a été laissé de côté

**Rien n'a échoué.** Les neuf cumuls tombent exactement juste au premier essai — aucun écart à
diagnostiquer, aucune correspondance à corriger.

**Explicitement laissé de côté, hors mandat de cette story TEST :**
- Aucune fonction du moteur (`src/lib/previsions/*.ts`) n'a été créée ou modifiée pour consommer ce
  nouveau bloc `detailParVagueSacs` — c'est réservé à la story suivante du sprint PR2-sexies
  (extension de la recette pour asserter ces neuf séries, cf. ERR-155 : une série présente dans le
  jeu d'or mais jamais assertée par la recette est un angle mort invisible).
- Le classeur `.xlsx` n'a pas été modifié (contrainte explicite).
- Aucun commit, aucun push effectué (hors mandat de cette story).

## 9. Fichiers modifiés

- `prisma/fixtures/previsions/extract-golden.py` — nouvelle fonction `extraire_detail_par_vague`,
  appel depuis `main()`, injection dans `besoinsAliments.detailParVagueSacs`.
- `prisma/fixtures/previsions/plan-v12-corrige.json` — régénéré (1 clé ajoutée, 0 valeur changée,
  0 clé supprimée, preuve §2.3).
- `prisma/fixtures/previsions/annexe-b-corrigee.json` — régénéré (idem).
- `prisma/fixtures/previsions/README.md` — nouvelle section documentant le bloc.
- `docs/tests/rapport-story-PR2sex.1.md` — ce rapport.

Aucun secret, aucune URL de connexion dans ce document (R11, cf. ERR-159) — le script d'extraction
n'accède à aucune base de données et ne lit aucune variable d'environnement.
