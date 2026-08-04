# Rapport de vérification indépendante — Story PR2q.4 (Ventilations demandées par l'utilisateur)

**Sprint :** PR2-quinquies
**Vérifié par :** @tester
**Date :** 2026-08-04
**Statut :** Livraison **conforme** — garantie centrale « total ventilé = ligne agrégée » vérifiée et sa détection de régression prouvée.

---

## 1. Rejeu des commandes (sorties réelles)

### 1.1 Recette (jeu d'or) — non-régression obligatoire

```
$ npx vitest run src/lib/previsions/__tests__/recette
✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (461 tests)
✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (461 tests)
✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (982 tests)

Test Files  3 passed (3)
     Tests  1904 passed (1904)
```

**1904 tests, 0 écart — inchangé.**

### 1.2 Suite complète — 3 exécutions indépendantes (voir §5 pour l'analyse flaky)

| Run | Fichiers | Tests | Résultat |
|-----|----------|-------|----------|
| 1 | 279 passed / 5 skipped (284) | 8323 passed / 21 skipped / 26 todo (8370) | ✅ |
| 2 | 279 passed / 5 skipped (284) | 8323 passed / 21 skipped / 26 todo (8370) | ✅ |
| 3 | 279 passed / 5 skipped (284) | 8323 passed / 21 skipped / 26 todo (8370) | ✅ |

Aucun échec sur les 3 runs, y compris pour les 7 fichiers signalés flaky par le @developer (`aliment-form-dialog.test.tsx`, `apport-form-dialog.test.tsx`, `journal-form-dialog.test.tsx`, `poste-form-dialog.test.tsx`, `scenario-form-dialog.test.tsx`, `vague-prevue-form-dialog.test.tsx`, `render-pdf-safely.test.ts`).

### 1.3 Build production

```
$ npm run build
```
Succès — toutes les routes (dont `/previsions/scenarios/[id]`) compilées, aucune erreur TypeScript.

---

## 2. Garantie centrale : « total ventilé = ligne agrégée »

Le critère d'acceptation de la story exige un cas **NON dégénéré**, avec au moins une ligne de journal `OPERATIONNEL` à `vaguePrevueId` non nul, comparée à `calculerBaseRepartition` réellement appelée (pas réimplémentée dans le test).

Ce test existe et est conforme, `src/lib/previsions/__tests__/ventilations.test.ts:145-202` :

```ts
it("piege 2 (pre-analyse PR2q.4) — un journal OPERATIONNEL affecte a une vague reste HORS ventilation, ...", () => {
  ...
  const journal: JournalVentilationInput[] = [
    { date: ..., montantFCFA: 80_000,  categorie: OPERATIONNEL, vaguePrevueId: null },            // general
    { date: ..., montantFCFA: 500_000, categorie: OPERATIONNEL, vaguePrevueId: "vague-prevue-1" }, // NON DEGENERE
    { date: ..., montantFCFA: 1_000_000, categorie: INVESTISSEMENT, vaguePrevueId: null },
  ];

  const { parPoste, journalGeneral } = ventilerDepensesParPoste(charges, postes, journal, DATE_DEBUT);
  const sommeVentilation = parPoste.reduce(...) + (journalGeneral.get(0) ?? 0);

  // Reference moteur REELLEMENT appelee, pas reimplementee :
  const attendu = calculerBaseRepartition(
    [{ montantFCFA: new Decimal(200_000), inclusBaseRepartition: true }],
    [ /* les 3 memes lignes de journal */ ]
  );

  expect(attendu.toNumber()).toBe(280_000);
  expect(sommeVentilation).toBe(attendu.toNumber());
});
```

- `calculerBaseRepartition` est **importé depuis `../charges`** (ligne 29 du test) et appelé tel quel — aucune réimplémentation.
- La ligne à `vaguePrevueId: "vague-prevue-1"` (500 000 FCFA) est bien présente et exclue par construction : la somme attendue (280 000 = 200 000 poste + 80 000 journal général) exclut à la fois ce montant et les 1 000 000 d'investissement.
- Le jeu d'or (`plan-v12-corrige.json`, `annexe-b-corrigee.json`) a bien un journal `OPERATIONNEL` à `vaguePrevueId = null` sur les 21 mois des deux scénarios (confirmé dans le JSDoc du test et ERR-154 cité en référence) — il ne peut structurellement pas exercer ce cas, ce que le test synthétique « piège 2 » comble explicitement.

Le premier test (« cas simple, sans journal », lignes 111-143) couvre par ailleurs l'exclusion des postes `inclusBaseRepartition = false` (999 999 FCFA injectés, absents de `attendu` et de `parPoste`).

**Verdict : critère d'acceptation satisfait, avec preuve, pas seulement affirmation.**

---

## 3. Preuve de détection de régression (cassage volontaire)

### 3.1 Cassage

Fichier `src/lib/previsions/ventilations.ts`, retrait de l'exclusion `vaguePrevueId !== null` dans `ventilerDepensesParPoste` :

```diff
   const journalGeneral = new Map<number, number>();
   for (const j of journal) {
-    if (j.categorie !== CategorieJournalPrevu.OPERATIONNEL || j.vaguePrevueId !== null) continue;
+    if (j.categorie !== CategorieJournalPrevu.OPERATIONNEL) continue;
     const m = toMoisAbsolu(dateDebutPlan, j.date);
     journalGeneral.set(m, (journalGeneral.get(m) ?? 0) + versNombre(j.montantFCFA));
   }
```

### 3.2 Sortie obtenue (avant restauration)

```
$ npx vitest run src/lib/previsions/__tests__/ventilations.test.ts
✓ plan-v12-corrige.json
✓ annexe-b-corrigee.json
✓ cas synthetique a 2 types ...
✓ aucun apport — ventilation vide, somme 0
✓ cas simple, sans journal — somme(parPoste) + journalGeneral === calculerBaseRepartition du mois
✗ piege 2 (pre-analyse PR2q.4) — un journal OPERATIONNEL affecte a une vague reste HORS ventilation ...

AssertionError: expected 780000 to be 280000
Test Files  1 failed (1)
     Tests  1 failed | 5 passed (6)
```

Le test « piège 2 » **et lui seul** détecte la régression (780 000 = 280 000 attendu + 500 000 mal inclus). Les 5 autres tests, qui n'exercent pas de journal affecté à une vague, ne bougent pas — ce qui confirme que sans le cas non dégénéré, la régression serait passée inaperçue.

### 3.3 Restauration et vérification

```
$ cp <copie originale> src/lib/previsions/ventilations.ts
$ md5sum src/lib/previsions/ventilations.ts
53680d28f1eb7a5f76eb42816b59ab48  src/lib/previsions/ventilations.ts   # identique à l'original avant cassage
$ npx vitest run src/lib/previsions/__tests__/ventilations.test.ts
✓ 6 tests passed (6)
```

Fichier restauré à l'identique (checksum comparé avant/après), suite de tests de nouveau verte.

---

## 4. Pureté et non-duplication du moteur

- **Pureté confirmée** : aucun `prisma.*`, aucun appel réseau ou I/O dans `src/lib/previsions/ventilations.ts`. Le fichier ne prend que des tableaux en entrée (`ApportVentilationInput[]`, `ChargeVentilationInput[]`, etc.) et retourne des structures en mémoire (`Map`, `Record`).
- **Réutilisation, pas duplication, du moteur pour `moisAbsoluDepuis`** : `import { moisAbsoluDepuis } from "./tableau-de-bord-helpers"` (ligne 62), appelée telle quelle via `toMoisAbsolu`.
- **Le filtre de `calculerBaseRepartition` (postes `inclusBaseRepartition = true` + journal `OPERATIONNEL` à `vaguePrevueId = null`) EST dupliqué en code, mais la duplication est traitée sérieusement** :
  - Le fichier documente explicitement (JSDoc lignes 1-60) qu'il **reproduit** ce filtre plutôt que de l'appeler, et pourquoi (`calculerBaseRepartition` retourne un total agrégé `Decimal`, pas une ventilation par poste — la fonction du moteur n'a structurellement pas la forme dont l'UI a besoin).
  - Cette duplication est **couverte par test de régression** : le test « piège 2 » compare le résultat de `ventilerDepensesParPoste` à `calculerBaseRepartition` **réellement appelé** avec les mêmes données (§2 ci-dessus), donc toute divergence future entre les deux filtres serait détectée immédiatement par ce test, pas seulement par une relecture manuelle.
  - **Risque résiduel signalé** : si `calculerBaseRepartition` (charges.ts) change un jour sa définition du filtre (ex. un 3e état pour `vaguePrevueId`, ou une nouvelle catégorie de journal à exclure), `ventilations.ts` ne le suivra PAS automatiquement — seul le test « piège 2 » le détectera, à condition qu'il continue d'être exécuté et que personne n'affaiblisse son assertion. C'est un risque de maintenance réel, mais mitigé (pas ignoré) par la présence de ce test comparatif. Recommandation pour un sprint futur : envisager d'exposer depuis `charges.ts` un prédicat exporté (`estInclusDansBaseRepartition(poste)`, `estJournalGeneral(ligne)`) que les deux sites appelleraient, éliminant la duplication à la racine — non bloquant pour cette story.

---

## 5. Instabilité flaky signalée par le @developer

Suite complète rejouée **3 fois** (§1.2) : **0 échec constaté**, sur les 3 runs, pour les 7 fichiers cités (`aliment-form-dialog.test.tsx`, `apport-form-dialog.test.tsx`, `journal-form-dialog.test.tsx`, `poste-form-dialog.test.tsx`, `scenario-form-dialog.test.tsx`, `vague-prevue-form-dialog.test.tsx`, `render-pdf-safely.test.ts`) comme pour le reste de la suite (8323/8323 passants à chaque run, compte identique).

Tentative de forcer un parallélisme plus élevé (`--pool threads --minWorkers 8 --maxWorkers 8`, `--pool=threads --poolOptions.threads.maxThreads=8`) : options rejetées par la CLI de cette version de Vitest (`v4.0.18`, `CACError: Unknown option`) — non concluant, pas de configuration alternative essayée au-delà de la commande standard demandée par le sprint (`npx vitest run`).

**Constat, sans affaiblir ni retirer aucune assertion :**
- L'instabilité n'a **pas été reproduite** dans cet environnement (12 cœurs), sur 3 exécutions complètes de la suite avec la commande standard du projet.
- Ceci ne prouve pas l'absence du problème — un flaky peut dépendre de facteurs non contrôlés ici (charge machine concurrente, ordre de scheduling des workers, CI vs local). Le signalement du @developer doit rester ouvert, pas classé « non reproductible » sur la seule base de ce rapport.
- Aucune modification n'a été apportée à ces 7 fichiers ni à leur configuration de test dans le cadre de cette vérification.
- **Recommandation** : si l'instabilité se reproduit en CI, ouvrir un `docs/bugs/BUG-XXX.md` dédié avec les logs CI exacts (l'environnement local ne suffit pas à la caractériser) plutôt que de la documenter uniquement ici.

---

## 6. Vérifications complémentaires (checklist story)

| # | Point | Résultat |
|---|-------|----------|
| 5 | `TypePostePrevision` n'est jamais une clé de regroupement | ✅ `postesInclus.map((p) => ({ posteId: p.id, libelle: p.libelle, ... }))` — regroupement par `posteId`/`libelle` (ventilations.ts:152-158), confirmé par grep : aucune occurrence de `TypePostePrevision` dans `ventilations.ts` |
| 6 | R2 — `TypeApportCapital` importé depuis `@/types`, jamais de chaîne en dur | ✅ `import { CategorieJournalPrevu, type TypeApportCapital } from "@/types"` (ventilations.ts:61) et `import { TypeApportCapital } from "@/types"` (previsions-mensuelles-tab.tsx:95) ; grep `"CAPITAL"`/`"CREDIT"` en dur dans ces 2 fichiers → 0 occurrence |
| 7 | Section « Ventilations » repliée par défaut | ✅ `sectionsOuvertes` initialisé avec `ventilations: false` (previsions-mensuelles-tab.tsx:247) ; test dédié `"est repliée par défaut (§7.1 ...)"` (previsions-mensuelles-tab.test.tsx:428-434) vérifie `aria-expanded="false"` et l'absence du texte `Apports — Capital propre` avant ouverture |
| 7 (10 postes) | Une ligne par poste, section repliée | Le composant construit `lignesDepensesParPoste` dynamiquement depuis `ventilationDepenses.parPoste` (1 entrée par poste `inclusBaseRepartition=true`) — donc oui, 10 postes = 10 lignes. Tenable car la section reste repliée par défaut (aucun impact sur le premier écran) ; à l'ouverture, c'est un tableau/carte défilable comme les autres sections à cardinalité variable (ex. « dont sacs Xmm »). Pas de pagination ni de troncature au-delà de 10 — acceptable au regard du patron déjà en place pour les granulométries, mais à surveiller si un scénario réel dépasse ~15-20 postes (lisibilité de la carte mobile). |
| 8 | Formats §7.4 (séparateur milliers, 0 décimale, zéro en « – », négatif en rouge, unité au libellé) | ✅ Réutilise `formatMontantPrevision`/`classeMontant` existants (format-previsions.ts:53-68,160-164), aucune nouvelle logique de formatage. Unité `(FCFA)` dans chaque libellé i18n (`apportParType.label`, `depenseParPoste.label`, `depenseJournalGeneral.label`) |
| 8 | Explicabilité + R5 | ✅ Chaque nouvelle ligne utilise `ExplicationLigne` (bouton Popover, `PopoverTrigger asChild` — ventilations respectent R5 comme le reste du composant, previsions-mensuelles-tab.tsx:209) ; texte de formule explicite dans les 3 clés i18n (§ ci-dessous) |
| 9 | Mobile 375 px | ✅ Test dédié `"carte mobile 375px : la section Ventilations révèle les mêmes lignes pour le mois courant"` (previsions-mensuelles-tab.test.tsx:479-497), couvre les 4 lignes (2 apports + 1 poste + journal général) avec valeurs et exclusion du poste hors base |
| 10 | Parité i18n fr/en (script, pas à l'œil) | ✅ Comparaison programmatique (flatten JSON récursif) : `only in fr: set()`, `only in en: set()` — 0 écart dans les deux sens |
| 10 | `sectionToggleAria` disparu des deux fichiers | ✅ `grep -n "sectionToggleAria" src/messages/fr/previsions.json src/messages/en/previsions.json` → aucune occurrence |
| 10 | `page.detailTitle`/`page.backToList` non touchées | ✅ Non modifiées (hors du diff de cette story, confirmé par grep — clés toujours présentes, identiques) |
| 12 | Fixtures du jeu d'or non modifiées | ✅ `git status --porcelain prisma/fixtures/` → aucune sortie, aucun changement |
| 12 | Moteur non touché par CETTE story | ✅ `charges.ts` et `types.ts` : aucun diff. `tresorerie.ts` et `aliments.ts` : diffs présents mais attribuables, par leur propre JSDoc, à des stories antérieures non commitées (PR2.1, PR2-quater §12, PR2q.2 `calculerEpargne`) — pas à PR2q.4. Aucune trace de `ventilations`/`ventiler` dans ces diffs. |

---

## 7. Conclusion

La story PR2q.4 est **validée** :
- Garantie centrale prouvée par un cas non dégénéré, testée contre le moteur réel.
- Régression volontaire correctement détectée par le test dédié, puis intégralement restaurée (checksum identique).
- Aucune fuite de `TypePostePrevision` comme clé de regroupement, R2 respectée, R5 respectée.
- i18n fr/en strictement pareillé, clé morte `sectionToggleAria` bien retirée des deux langues.
- Mobile 375px couvert par test.
- 1904/1904 tests de recette inchangés, build OK, suite complète verte sur 3 exécutions.
- Instabilité flaky signalée par le @developer **non reproduite** dans cet environnement sur 3 runs complets — à documenter comme non confirmée localement, pas comme résolue, et à réexaminer si elle réapparaît en CI.
- Point de vigilance non bloquant : duplication volontaire (documentée, testée) du filtre de `calculerBaseRepartition` — risque de dérive future si le moteur change sans que le test comparatif soit maintenu.
