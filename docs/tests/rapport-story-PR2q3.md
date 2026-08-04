# Rapport de vérification indépendante — Story PR2q.3 (Compléter la vue Prévisions mensuelle)

**Sprint :** PR2-quinquies
**Vérifié par :** @tester
**Date :** 2026-08-04
**Livré par :** @developer

## Verdict

**Fonctionnellement correct, recette solide et non-tautologique, 2 réserves mineures** (une
documentaire, une i18n) détaillées en section 9 et 11. Aucun bug bloquant trouvé. Le cassage
volontaire d'un accumulateur (section 3 ci-dessous) prouve que la Section D détecte réellement une
régression, avec restauration vérifiée `diff`-identique.

---

## 1. Rejeu des commandes — sorties effectives

### `npx vitest run src/lib/previsions/__tests__/recette` (x2)

```
Run 1 :
 ✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (461 tests)
 ✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (461 tests)
 ✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (982 tests)
 Test Files  3 passed (3)
      Tests  1904 passed (1904)

Run 2 :
 Test Files  3 passed (3)
      Tests  1904 passed (1904)
```

Confirme exactement la progression annoncée : **1482 → 1904 (+422)**.

### `npx vitest run` — suite complète (x2, avant ajout de mes tests mobiles)

```
Run 1 : Test Files  278 passed | 5 skipped (283)   Tests  8308 passed | 21 skipped | 26 todo (8355)
Run 2 : Test Files  278 passed | 5 skipped (283)   Tests  8308 passed | 21 skipped | 26 todo (8355)
```

Aucune instabilité observée sur `scenario-form-dialog.test.tsx` (contrairement à l'épisode
signalé lors de PR2q.2) — 2 exécutions complètes, 0 échec, mêmes chiffres aux deux passages.

### `npm run build`

```
BUILD EXIT: 0
✓ Compiled successfully in 12.1s
```

Aucune erreur TypeScript, aucun `Failed to compile`.

### Suite complète après ajout des 5 tests mobiles (section 7) — rejouée 2x

```
Run 1 : Test Files  278 passed | 5 skipped (283)   Tests  8313 passed | 21 skipped | 26 todo (8360)
Run 2 : Test Files  278 passed | 5 skipped (283)   Tests  8313 passed | 21 skipped | 26 todo (8360)
```

8308 + 5 (mes tests mobiles) = 8313, cohérent. Toujours 0 échec.

---

## 2. Non-tautologie de la Section D — vérifiée ligne par ligne

Lu `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts`, fonction
`runSectionD` (lignes 245-321). Chaque assertion tire sa valeur ATTENDUE d'un champ de fixture,
jamais d'un recalcul :

| Assertion (fichier, ligne) | Champ ACTUAL (sortie moteur) | Champ EXPECTED (fixture, jamais recalculé) |
|---|---|---|
| L259-265 | `moisCourant.empoissonneKg` | `fixture.entrees.empoissonneT[m] * 1000` |
| L267-273 | `moisCourant.ventesKg` | `fixture.entrees.ventesT[m] * 1000` |
| L275-281 | `moisCourant.besoinAlimentsTotalKg` | `fixture.besoinsAliments.totalKg[m]` |
| L283-289 | `moisCourant.sacsAlimentsTotal` | `fixture.besoinsAliments.sacsTotal[m]` |
| L291-299 | `moisCourant.sacsParGranulometrie[G1/G2/G3]` | `fixture.besoinsAliments.sacsParGranulometrie["2mm"/"3mm"/"4mm"][m]` |
| L301-307 | `moisCourant.alevinsACommanderNb` | `fixture.depenses.alevinsCommandes[m]` |
| L309-312 | `moisCourant.revenusFCFA` | `fixture.entrees.chiffreAffaires[m]` |
| L314-318 | `moisCourant.revenusFCFA + moisCourant.apportsFCFA` | `moisCourant.revenusFCFA` (dérivation UI, cf. §5) |

Vérifié indépendamment que ces 7 clés de fixture existent bel et bien dans les deux fichiers JSON
(`plan-v12-corrige.json` / `annexe-b-corrigee.json`) :

```
entrees.keys      = ['empoissonneT', 'ventesT', 'chiffreAffaires']
besoinsAliments.keys = ['totalKg', 'kgParGranulometrie', 'sacsTotal', 'sacsParGranulometrie']
depenses.keys     = ['aliments', 'alevins', 'alevinsCommandes', 'chargesExploitation',
                      'baseRepartition', 'chargesOperationnelles']
```

**Aucune valeur ATTENDUE n'est recalculée dans le test** — chaque `it()` appelle uniquement
`fixture.<bloc>.<champ>[m]`. La règle sacrée du fichier (JSDoc lignes 18-22 du builder,
`route-orchestration-builder.ts`) est respectée.

---

## 3. Preuve que la Section D détecte une régression — cassage volontaire + restauration

**Cassage :** injecté un `+ 1` sac sur `sacsAlimentsDuMois`/`sacsParGranulometrieDuMois` dans
`route-orchestration.ts` (boucle d'agrégation calendaire, ligne ~607) :

```diff
- const sacs = ceilViaMoteur(alimentId, poidsSacKgReference(aliment.articles), kgDuMois);
+ const sacs = ceilViaMoteur(alimentId, poidsSacKgReference(aliment.articles), kgDuMois) + 1; // BUG INJECTE
```

**Résultat du rejeu** (`npx vitest run src/lib/previsions/__tests__/recette`) :

```
FAIL src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts
  ...mois[2028-04] — sacsAlimentsTotal == besoinsAliments.sacsTotal
    Error: entier attendu 450, obtenu 451 (ecart 1, tolerance = 0)
  ...mois[2028-04] — sacsParGranulometrie.G3 == besoinsAliments.sacsParGranulometrie.4mm
    Error: entier attendu 450, obtenu 451 (ecart 1, tolerance = 0)

 Test Files  1 failed | 2 passed (3)
      Tests  162 failed | 1742 passed (1904)
```

**162 tests tombent** — la Section D détecte bien la régression, sur les deux fixtures et sur
tous les mois concernés.

**Restauration :**

```
$ cp <backup> src/lib/previsions/route-orchestration.ts
$ diff <backup> src/lib/previsions/route-orchestration.ts && echo IDENTICAL
IDENTICAL
$ md5 src/lib/previsions/route-orchestration.ts
c8f5afabb9cee39f5b13a115e17c769b   (identique avant/après cassage)
```

Rejeu post-restauration :

```
Test Files  3 passed (3)
     Tests  1904 passed (1904)
```

`route-orchestration.ts` n'étant pas encore suivi par git (fichier `??` dans `git status`), la
vérification "aucun résidu" a été faite par `diff` binaire contre une copie de sauvegarde plutôt
que par `git diff` — équivalent en rigueur, `md5` identique avant/après confirmé.

---

## 4. Le `ceil` par granulométrie — vérifié dans le code livré

Dans la boucle d'agrégation calendaire (`route-orchestration.ts`, ~ligne 602-611) :

```ts
for (const [alimentId, parMois] of kgParGranulometrieEtMois) {
  const kgDuMois = parMois.get(m);
  if (!kgDuMois || kgDuMois.lte(0)) continue;
  besoinAlimentsTotalKgDuMois = besoinAlimentsTotalKgDuMois.plus(kgDuMois);
  const aliment = scenario.aliments.find((a) => a.id === alimentId)!;
  const sacs = ceilViaMoteur(alimentId, poidsSacKgReference(aliment.articles), kgDuMois);
  sacsAlimentsDuMois = sacsAlimentsDuMois.plus(sacs);
  sacsParGranulometrieDuMois[aliment.tailleGranule] =
    (sacsParGranulometrieDuMois[aliment.tailleGranule] ?? 0) + sacs;
}
```

`ceilViaMoteur` est appelé **à l'intérieur de la boucle, une fois par granulométrie**, sur le
`kgDuMois` propre à cette seule granulométrie — le `ceil` est appliqué **par granulométrie**,
puis les sacs déjà arrondis sont sommés dans `sacsAlimentsDuMois`. `sacsAlimentsTotal` est donc
bien la **somme des ceils par granulométrie**, jamais le ceil du total agrégé. Conforme à la
vérification n°1 du README du jeu d'or. Le cassage de la section 3 ci-dessus confirme cette
lecture : casser un seul `ceilViaMoteur` fait tomber `sacsParGranulometrie.G3` ET
`sacsAlimentsTotal` simultanément, exactement le comportement attendu d'une somme de valeurs déjà
arrondies individuellement.

---

## 5. La réserve du @developer sur `resultats.totalEntrees` (ligne 27) — vérifiée exacte

Recherche exhaustive dans `entreesModele` des deux fixtures :

```python
em = json.load(open("plan-v12-corrige.json"))["entreesModele"]
list(em.keys())
# ['$description', 'parametresScenario', 'paliersRemise', 'transport', 'aliments',
#  'planVagues', 'chargesExploitation', 'journalDepensesPonctuelles', 'donneesManquantes']
"apport" in json.dumps(em).lower()   # False
```

Aucune occurrence du mot "apport" nulle part dans `entreesModele` — confirmé. `resultats` et
`cumuls`, en revanche, portent bien `apportsCapital` :

```
resultats.keys = ['apportsCapital', 'totalEntrees', 'investissements', 'autresDepenses',
                   'depensesTotales', 'resultat', 'epargne', 'tresorerie']
cumuls.keys    = [..., 'apportsCapital', ...]
```

Ce sont des **sorties** du classeur (colonnes calculées), jamais une ligne de saisie. La
réserve du @developer est donc **exacte** : `resultats.totalEntrees` ne peut pas être rapproché
intégralement sans fabriquer artificiellement des apports non issus du classeur — ce que la règle
de non-tautologie de ce fichier interdit explicitement. Ce n'est pas une série rapprochable
déclarée non-rapprochable par facilité ; c'est une absence réelle de donnée source.

---

## 6. Synchronisation des deux sérialiseurs — vérifiée champ par champ

Comparé ligne à ligne `src/app/api/previsions/scenarios/[id]/calculer/route.ts` (lignes 46-70) et
`src/components/pages/previsions-scenario-detail-page.tsx` (lignes 137-161). Les deux blocs
`mois.map((m) => ({...}))` sont **identiques champ pour champ**, y compris pour les 6 nouveaux
champs de la story (`empoissonneKg`, `ventesKg`, `alevinsACommanderNb`, `besoinAlimentsTotalKg`,
`sacsAlimentsTotal`, `sacsParGranulometrie`) et pour l'objet `logistique` imbriqué. Aucune
désynchronisation trouvée. `grep` de vérification :

```
route.ts:                          detail-page.tsx:
resultatFCFA: n(m.resultatFCFA);   resultatFCFA: n(m.resultatFCFA);
epargneFCFA: n(m.epargneFCFA);     epargneFCFA: n(m.epargneFCFA);
empoissonneKg: n(m.empoissonneKg); empoissonneKg: n(m.empoissonneKg);
ventesKg: n(m.ventesKg);           ventesKg: n(m.ventesKg);
alevinsACommanderNb: n(...);       alevinsACommanderNb: n(...);
besoinAlimentsTotalKg: n(...);     besoinAlimentsTotalKg: n(...);
sacsAlimentsTotal: m....;          sacsAlimentsTotal: m....;
sacsParGranulometrie: m....;       sacsParGranulometrie: m....;
```

---

## 7. Tests de rendu UI — couverture vérifiée + test manquant écrit (mobile)

### Ce qui était déjà couvert (`previsions-mensuelles-tab.test.tsx`, avant mon ajout)

- État déplié/replié par défaut des 4 sections (desktop) — `aria-expanded`.
- Contenu masqué/révélé par section (desktop).
- Ligne dynamique par granulométrie construite depuis les clés réelles (pas codée en dur), y
  compris le cas d'absence (G3).
- Bouton d'explication `ExplicationLigne` testé sur au moins une nouvelle ligne (coût alevins) —
  popover ouvert, contenu vérifié.
- Formats : séparateur de milliers (`11 000`), aucune décimale sur les entiers, `alevinsACommander`
  affiché **sans** suffixe FCFA (test explicite ligne 169 du fichier original), tonnage à 1
  décimale (`4,0 t`), colonne Total en somme vs dernière valeur (ligne cumulative), unité dans le
  libellé de ligne (pas répétée par cellule desktop).
- Ces formats eux-mêmes (séparateurs, zéro → "–", négatif → `text-danger`, tonnage 1 décimale)
  sont couverts exhaustivement par `format-previsions.test.ts` (pré-existant, story PR2.3), réutilisé
  tel quel par cette story sans régression.

### Ce qui manquait — écrit dans ce rapport (5 tests ajoutés à
`src/components/previsions/__tests__/previsions-mensuelles-tab.test.tsx`)

Aucun test ne rendait/interrogeait la **vue carte mobile** (`.md\:hidden`) — seul le tableau
desktop (`<table>`) était scopé et vérifié ; la carte mobile restait présente dans le DOM jsdom
mais jamais interrogée. Ajouté :

1. État initial des 4 sections sur la carte mobile (`data-state="open"`/`"closed"`, cohérent avec
   le desktop).
2. Ouverture de la section Production sur mobile : tonnage (`4,0 t`) et entier alevins
   (`11 000`, **jamais** suivi de `FCFA`) pour le **seul mois courant** (contrairement au tableau
   desktop qui affiche tous les mois en colonnes).
3. Ouverture de la section Aliments sur mobile : détail par granulométrie dynamique (G1/G2
   présents, G3 absent), même comportement que desktop.
4. Bouton d'explication présent et fonctionnel sur une ligne mobile (Empoissonné).
5. Navigation mois précédent/suivant : la carte reflète bien le mois courant, l'ancienne valeur
   disparaît.

Résultat : `13 tests passed` sur ce fichier (8 existants + 5 nouveaux), suite complète toujours à
0 échec après ajout (voir section 1).

---

## 8. Mobile 375px — vue carte confirmée cohérente avec les sections

Confirmé par les 5 tests de la section 7 : la carte mobile utilise **les mêmes 4
`SectionDescriptor`** que le tableau desktop (`SECTIONS`, mémoïsé une seule fois, partagé entre
les deux rendus — pas de duplication de structure), donc toute nouvelle ligne ajoutée au tableau
apparaît automatiquement sur la carte. Le composant `Collapsible.Root`/`Trigger`/`Content` de
Radix gère l'ouverture/fermeture indépendamment du tableau (états synchronisés via le même
`sectionsOuvertes`), vérifié par les tests ci-dessus.

---

## 9. Parité i18n fr/en — vérifiée par script indépendant

```python
fflat = flatten(json.load(open("src/messages/fr/previsions.json")))
eflat = flatten(json.load(open("src/messages/en/previsions.json")))
fkeys - ekeys = set()   # only in fr
ekeys - fkeys = set()   # only in en
len(fkeys) == len(ekeys) == 401
```

**Parité totale confirmée** (401 clés de chaque côté, aucune clé orpheline dans un sens ou
l'autre). Accents fr vérifiés à l'œil sur le bloc `previsionsMensuellesTab.rows.*` — corrects
("Résultat", "Entrées & dépenses détaillées", "Épargne conseillée", "récoltée", "à commander").

Aucune chaîne en dur trouvée dans le composant (`grep` sur les littéraux capitalisés — tous les
résultats sont des commentaires JSDoc, aucun JSX).

**Réserve mineure — clé i18n morte non supprimée.** `previsionsMensuellesTab.sectionToggleAria`
est déclarée dans `fr/previsions.json` **et** `en/previsions.json` mais n'est **référencée nulle
part** dans `previsions-mensuelles-tab.tsx` (`grep -rn "sectionToggleAria" src/` ne retourne
aucune occurrence en dehors des deux fichiers de messages). Les boutons de bascule de section
(desktop `<button onClick={...}>{section.title}</button>` ligne ~350, mobile
`Collapsible.Trigger` ligne ~432) n'ont pas d'`aria-label` explicite — leur nom accessible vient
du texte visible du bouton (le titre de section), ce qui reste fonctionnellement correct pour
l'accessibilité (confirmé par les tests `getByRole("button", { name: "Résultat" })` qui passent),
mais rend la clé `sectionToggleAria` **inutilisée**. Le critère d'acceptation explicite de la
story (« i18n fr + en complètes, [...] clés mortes supprimées des deux langues ») n'est donc pas
strictement rempli sur ce point précis. Sévérité **Basse** — aucun impact fonctionnel ni
utilisateur, correction triviale (suppression de la clé dans les deux fichiers, ou câblage en
`aria-label` explicite sur les deux boutons de bascule).

---

## 10. Intégrité du jeu d'or — vérifiée

```
$ git status --short prisma/fixtures/previsions/     → (rien)
$ git diff --stat prisma/fixtures/previsions/         → (rien)
$ git ls-files prisma/fixtures/previsions/
  Previsions_Elevage_Silure_v12.xlsx
  README.md
  annexe-b-corrigee.json
  extract-golden.py
  plan-v12-corrige.json
$ md5 Previsions_Elevage_Silure_v12.xlsx = 167b15e7b7c2a857feeb86c28705a456
```

Aucune modification en attente sur `prisma/fixtures/previsions/` : ni le `.xlsx`, ni
`extract-golden.py`, ni les deux fixtures JSON n'ont été touchés par cette story. Cohérent avec
l'usage de la Section D (lecture seule des fixtures existantes, aucune régénération nécessaire).

---

## 11. Lignes 11-23 (détail par vague) — exclusion confirmée assumée, pas un oubli

`grep -n "detailVague\|parVague\|ligne 1[1-9]\|ligne 2[0-3]" previsions-mensuelles-tab.tsx` → rien.
Aucune ligne de détail par vague n'est exposée dans le composant, conforme à la décision de
sprint documentée dans `docs/sprints/SPRINT-PR2-quinquies-PREVISIONS.md` (note de pré-analyse
`@pre-analyst : GO`) : « Le détail par vague (lignes 11-23 du classeur) est explicitement laissé
HORS PÉRIMÈTRE [...] `extract-golden.py` ne lit pas ces lignes [...] ». Confirmé également que
`extract-golden.py` n'a pas été modifié (section 10). La note de clôture du sprint documente
cette exclusion explicitement ("Lignes 11-23 (détail par vague) non implémentées — exclusion
assumée") — pas un oubli silencieux, conformément à l'exigence de la story.

**Observation annexe, non bloquante :** la même note de clôture affirme « 8 → 30 lignes
affichées ». En comptant statiquement les `LigneDescriptor` du composant livré (4 en section
Résultat + 3 en Production + 2 statiques + jusqu'à 3 dynamiques en Aliments + 7 en Entrées &
dépenses détaillées), le nombre de lignes réellement rendues à l'écran avec un scénario à 3
granulométries est d'environ **19**, pas 30 — le chiffre "30" désigne vraisemblablement le total
de lignes du classeur source (incluant les 13 lignes 11-23 explicitement hors périmètre), pas le
nombre de lignes effectivement affichées par l'UI. Aucun impact fonctionnel — signalé uniquement
pour que la formulation de la note de clôture (hors du périmètre de ce que je peux modifier,
`docs/sprints/` étant réservé à `@status-updater`) soit clarifiée si elle est reprise ailleurs.

---

## Fichiers modifiés/ajoutés par ce rapport

- `src/components/previsions/__tests__/previsions-mensuelles-tab.test.tsx` — 5 tests ajoutés
  (couverture de la carte mobile, absente avant cette vérification). Aucune assertion existante
  affaiblie.
- `src/lib/previsions/route-orchestration.ts` — cassé puis restauré à l'identique pour la preuve
  de détection de régression (section 3). Diff/`md5` confirmés identiques avant/après ; aucun
  résidu.
- Aucune fixture du jeu d'or, aucun fichier `docs/sprints/`, aucun fichier `docs/TASKS.md` touché.

## Récapitulatif des commandes et résultats

| Commande | Résultat |
|---|---|
| `npx vitest run src/lib/previsions/__tests__/recette` (x2) | 1904/1904, 2x identique |
| `npx vitest run` (avant mes ajouts, x2) | 278 fichiers passés / 5 skipped, 8308 tests, 0 échec, 2x identique |
| `npx vitest run` (après mes ajouts, x2) | 278 fichiers passés / 5 skipped, 8313 tests, 0 échec, 2x identique |
| `npm run build` | exit 0, "Compiled successfully in 12.1s" |
| Cassage volontaire + recette | 162/1904 tests tombent (2 fixtures, mois 2028-04 et au-delà) |
| Restauration | `diff` + `md5` identiques à l'original |

## Réserves reportées au chef de projet

1. **Basse — i18n.** Clé morte `previsionsMensuellesTab.sectionToggleAria` (fr + en), jamais
   consommée par le code. Ne bloque pas la story mais viole littéralement le critère d'acceptation
   « clés mortes supprimées ». Fix trivial : supprimer la clé ou la câbler en `aria-label`.
2. **Informative — documentation.** La note de clôture de sprint PR2q.3 annonce « 8 → 30 lignes
   affichées » ; le compte réel de lignes rendues à l'écran est d'environ 19 (30 désignant plutôt
   le total de lignes du classeur, 13 d'entre elles — lignes 11-23 — étant explicitement hors
   périmètre). Aucun impact fonctionnel ; à clarifier si cette formulation est reprise dans
   `docs/reviews/review-sprint-PR2-quinquies.md`.

Aucune autre anomalie trouvée. Recommandation : **GO pour @code-reviewer**, sous réserve des deux
points ci-dessus qui restent, à mon sens, non bloquants.
