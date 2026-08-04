# Rapport de test — Story PR2.4 — Vue Prévisions mensuelle et tableau de bord

**Testeur** : @tester
**Sprint** : PR2 — Module Prévisions
**Périmètre testé** :
- `src/lib/previsions/tableau-de-bord-helpers.ts` (`calculerTresorerieActuelle`, `libelleMoisCalendaire`)
- `src/components/previsions/projection-types.ts`
- `src/components/previsions/tresorerie-chart.tsx`
- `src/components/previsions/tableau-bord-tab.tsx`
- `src/components/previsions/previsions-mensuelles-tab.tsx`
- Diff de `src/components/pages/previsions-scenario-detail-page.tsx` et `src/components/previsions/scenario-detail-client.tsx`

## Verdict : **PASS** (avec 2 réserves non bloquantes, sévérité Moyenne et Basse)

---

## 1. Tests ajoutés

### 1.1 `src/lib/previsions/__tests__/tableau-de-bord-helpers.test.ts` (15 tests)

Couvre `calculerTresorerieActuelle` de façon méchante, comme demandé :

| Cas | Résultat |
|---|---|
| Mois courant au **début** de l'horizon (moisAbsolu=0) | `disponible`, solde exact |
| Mois courant au **milieu** de l'horizon (moisAbsolu=10/20) | `disponible`, solde exact |
| Mois courant à la **fin exacte** de l'horizon (moisAbsolu = horizonMois-1) | `disponible`, solde exact, confirmé aussi via `moisAbsoluDepuis` |
| Mois courant **avant** `dateDebutPlan` (plan futur) | `avant_horizon`, `moisAbsolu`/`soldeFCFA` = `null` |
| Mois courant **après** la fin de l'horizon (plan périmé) | `apres_horizon`, `null`/`null` |
| Série mensuelle **vide**, moisCourant nominalement dans l'horizon | repli défensif `apres_horizon`, **jamais** un `0` ou un accès `mois[i]` `undefined` rendu comme une vraie valeur |
| `horizonMois = 0` + série vide | `apres_horizon`, jamais de crash |
| Série **partielle** (mois manquants alors que `moisCourant < horizonMois`) | repli défensif, `soldeFCFA` reste `null`, jamais `0` |
| Point bas négatif nominal (jeu d'or annexe B, −6 334 704 FCFA en novembre 2026) | lu correctement dans la série au bon mois |

Vérifié explicitement : **aucun cas ne renvoie `soldeFCFA: 0` comme substitut d'un état "hors horizon"** — le helper distingue toujours `disponible` (avec valeur) de `avant_horizon`/`apres_horizon` (valeurs `null`), conformément à l'exigence de la mission ("un `undefined` rendu comme 0 FCFA serait un bug grave").

`libelleMoisCalendaire` : mois 0 = `dateDebutPlan`, passage d'année (décembre 2026 → janvier 2027) vérifié explicitement, robustesse au jour du mois de `dateDebutPlan` (17 mars ne décale pas le calcul), et vérification que le libellé est un texte français lisible («&nbsp;nov. 2026&nbsp;»), jamais un index brut ("10" ou "Mois 10").

**Point à signaler, non un bug** : le libellé produit est **abrégé** (« nov. 2026 »), alors que la mission citait l'exemple « novembre 2026 » (mois en toutes lettres). Les deux formes sont du français lisible et non ambiguës ; à trancher explicitement par le PM/l'architecte si le format en toutes lettres est attendu — je ne le traite pas comme un bug faute de spécification stricte sur ce point dans l'ADR/le sprint (aucune des deux formes n'y est prescrite littéralement).

### 1.2 `src/components/previsions/__tests__/tresorerie-chart.test.tsx` (8 tests)

Recharts est mocké (patron déjà utilisé par `gompertz-projections.test.tsx`), mais `<defs>`/`<linearGradient>`/`<stop>` sont des éléments SVG natifs écrits en dur dans le composant, donc réellement rendus et inspectables — ce test exerce le vrai calcul d'offset, pas une réimplémentation parallèle.

| Cas | Attendu | Résultat |
|---|---|---|
| Série vide | Message explicite, aucun graphique | PASS |
| Série entièrement **positive** | offset = 1 (toute la zone verte) | PASS |
| Série entièrement **négative** | offset = 0 (toute la zone rouge) | PASS |
| Série **plate à zéro** | offset fini, **pas de NaN** (piège de division par zéro `maxSolde - minSolde = 0`) | PASS — le composant force `minSolde`/`maxSolde` à inclure 0 dans le domaine (`Math.max(...soldes, 0)`), ce qui évite la division par zéro en désambiguïsant via la branche `maxSolde <= 0 ? 0 : ...` avant d'atteindre le dénominateur nul |
| Série à **un seul point** positif / négatif | offset fini | PASS (2 tests) |
| Série **mixte** (positive puis négative) | offset strictement entre 0 et 1, valeur exacte vérifiée (`2000000/3000000`) | PASS |
| `ReferenceLine y={0}` toujours présente | PASS |

**Aucun NaN détecté dans aucun cas dégénéré.** La garde du développeur (forcer l'inclusion de 0 dans le domaine min/max affiché) est correcte et couvre bien le cas piège identifié par la mission.

---

## 2. Vérifications R1-R11 et exigences ADR-053 §7.4

- **R6 (CSS variables du thème)** : vérifié par inspection systématique — `var(--success)`/`var(--danger)`/`var(--primary)`/`var(--muted-foreground)`/`var(--border)` dans `tresorerie-chart.tsx`, classes `border-danger`/`border-success`/`text-danger` dans `tableau-bord-tab.tsx` et `previsions-mensuelles-tab.tsx` (`classeMontant`). Confirmé que `--color-danger`/`--color-success` sont bien déclarées dans `@theme inline` de `globals.css` (les classes Tailwind `border-danger`/`text-danger` ne sont donc pas des no-op). **Aucune couleur en dur trouvée.**
- **Formatteurs** : `formatMontantPrevision`, `formatEntierPrevision`, `formatTonnagePrevision`, `classeMontant` de `format-previsions.ts` utilisés partout dans le périmètre PR2.4. **`formatXAF`** (2 décimales, § 7.4 contraire) n'est **jamais** appelé — seule occurrence trouvée est une mention en commentaire explicatif dans l'en-tête de `format-previsions.ts`.
- **`ValeurCalculee`** : utilisée pour les 6 indicateurs du bandeau du tableau de bord (trésorerie projetée, point bas + mois, budget total, revenu prévu, nombre de vagues, biomasse), chacune avec une `formule` en langage courant et des `explication[]` en valeurs sources — conforme à §7.4.
  - **Réserve Basse, non bloquante** : le tableau mensuel (`previsions-mensuelles-tab.tsx`, desktop et mobile) affiche 8 colonnes de chiffres calculés par mois **sans** les envelopper dans `ValeurCalculee` (utilise directement `formatMontantPrevision`/`classeMontant`). Signalé conformément à la demande de la mission, mais je ne le qualifie pas de bug : les critères d'acceptation explicites de PR2.4 ne demandent l'explicabilité que pour le tableau de bord (« Mêmes règles de format que PR2.3 appliquées au tableau de bord »), pas pour la vue mensuelle ; envelopper 168 cellules (8 colonnes × 21 mois) dans un Popover individuel serait probablement disproportionné. À trancher explicitement par le PM/l'architecte si l'intention était de couvrir aussi ce tableau.
- **Aucun `Decimal` passé en prop à un Client Component** : vérifié dans `previsions-scenario-detail-page.tsx` — toute la projection est convertie via `n()`/`decimalToNumber` avant d'être injectée dans `ScenarioDetailClient`/`TableauBordTab`/`PrevisionsMensuellesTab`.
- **Mobile 360px** : la navigation mois par mois existe réellement (`previsions-mensuelles-tab.tsx`, bloc `md:hidden`, boutons précédent/suivant avec `aria-label`, désactivés en butée), aucun `overflow-x` forcé sur les cartes mobiles — le tableau brut (`hidden overflow-x-auto md:block`) reste bien réservé au bureau. Le bandeau d'indicateurs du tableau de bord passe en `grid-cols-1` (1re rangée, priorité visuelle) et `grid-cols-2` (2e rangée) dès le mobile — pas de tableau brut.
- **Objectif des 10 secondes (§7.1)** : constat qualitatif — le bandeau contient exactement **6 indicateurs** (dans la fourchette 4-6 demandée), avec les 2 indicateurs prioritaires (trésorerie projetée, point bas + mois) placés **en premier**, dans des `Card` à `border-2` (bordure verte/rouge selon le signe) et `text-xl`, contre `text-xs`/taille par défaut pour les 4 indicateurs secondaires — dominance visuelle réelle, cohérente avec la consigne explicite du sprint.

---

## 3. Robustesse du chargement (repli "projection vide")

Vérifié dans `previsions-scenario-detail-page.tsx` : `calculerProjectionScenario` est appelée dans un `try/catch`, et toute exception (ex. `sacsParTonneStandard` non configuré) retombe sur `PROJECTION_VIDE` plutôt que de faire planter la page — confirmé, pas de silence total : les onglets affichent bien des messages explicites (« Aucune donnée à projeter pour ce scénario. », « Aucune donnée sur ce scénario (aucune vague ni charge saisie). »).

### Finding — Sévérité **Moyenne** : le message de repli attribue l'absence de données à une cause métier, jamais à l'échec réel du calcul

Quand `calculerProjectionScenario` lève une exception (config manquante), la page retombe sur `PROJECTION_VIDE` (`horizonMois: 0`, `pointBas: null`, `mois: []`). Conséquence observée dans `TableauBordTab` :
- Le point bas affiche : *« Aucune donnée sur ce scénario (aucune vague ni charge saisie). »*
- La trésorerie projetée affiche : *« Hors horizon du plan : le plan est déjà entièrement passé. »* (car `calculerTresorerieActuelle(dateDebut, 0, [], aujourdHui)` retombe systématiquement sur `apres_horizon` dès que `horizonMois = 0`, quel que soit `aujourdHui`).

Ces deux messages **laissent croire à un problème de données de saisie** (pas de vagues/charges) ou à un plan expiré — alors que la cause réelle peut être une **erreur de configuration** (ex. granulométrie sans `sacsParTonneStandard`) sur un scénario par ailleurs correctement rempli. C'est exactement le risque que la mission demandait de vérifier explicitement (« un tableau de bord silencieusement vide qui ressemble à "tout est à zéro" serait pire que l'erreur elle-même ») : ici ce n'est pas un chiffre inventé (bien géré), mais le **message d'état est trompeur quant à la cause**, ce qui peut orienter l'exploitant vers la mauvaise action corrective (aller ajouter des vagues, alors qu'il faut configurer un aliment).

- **Reproduction** : configurer un scénario avec un aliment utilisé par une vague mais sans `sacsParTonneStandard` renseigné → la route de calcul lève (comportement voulu, PR2.2) → la page attrape l'exception → le tableau de bord affiche les messages ci-dessus au lieu d'un état distinct du type « Calcul indisponible : vérifiez la configuration des aliments ».
- **Recommandation** : propager un indicateur explicite de repli (ex. `projectionIndisponible: boolean`) du Server Component vers `TableauBordTab`/`PrevisionsMensuellesTab`, pour afficher un message dédié distinct des cas "réellement vide" ou "hors horizon".
- Non corrigé par moi (hors mandat du @tester) — documenté ici pour triage par le PM. Sévérité **Moyenne** (UX dégradée, cas limite, pas un chiffre faux ni un crash) → reportable au sprint suivant selon les règles de priorisation du projet.

---

## 4. Vérifications obligatoires — sorties réelles

```
npx vitest run
```
```
Test Files  254 passed | 4 skipped (258)
     Tests  6982 passed | 19 skipped | 26 todo (7027)
```
(Ligne de base attendue : 6959 passés / 19 skipped / 26 todo / 0 échec — **+23 tests** ajoutés par cette story : 15 dans `tableau-de-bord-helpers.test.ts` + 8 dans `tresorerie-chart.test.tsx`, 0 échec.)

```
npm run build
```
Build production **OK** — aucune erreur TypeScript, table de routes générée avec succès (incluant `/previsions/scenarios` et `/previsions/scenarios/[id]`).

```
npx vitest run src/lib/previsions/__tests__/recette
```
```
Test Files  2 passed (2)
     Tests  842 passed (842)
```
**Recette du moteur intacte à 842/842, 0 écart** — confirmé après implémentation de PR2.4 (le moteur `src/lib/previsions/*.ts` n'a subi aucune modification, seul un fichier d'affichage nouveau — `tableau-de-bord-helpers.ts` — a été ajouté, réexportant `moisAbsoluDepuis` sans le modifier).

---

## 5. Récapitulatif des findings

| # | Sévérité | Constat | Statut |
|---|---|---|---|
| 1 | **Moyenne** | Le repli "projection vide" (exception du moteur/orchestration attrapée) réutilise les messages "hors horizon"/"aucune vague ni charge saisie" du cas réellement vide — trompeur sur la cause réelle (erreur de configuration vs données manquantes) | À trianger par le PM, non corrigé (hors mandat @tester) |
| 2 | Basse | Tableau mensuel (`previsions-mensuelles-tab.tsx`) affiche des chiffres calculés sans les envelopper dans `ValeurCalculee`, contrairement au tableau de bord | Info seulement — hors du strict périmètre des critères d'acceptation de la story |
| 3 | Basse | `libelleMoisCalendaire` produit un libellé abrégé (« nov. 2026 ») plutôt qu'en toutes lettres (« novembre 2026 ») cité en exemple par la mission | Info seulement — aucune des deux formes n'est prescrite littéralement par l'ADR/le sprint |

**Aucun finding de sévérité Haute ou Critique.** Aucun bug de calcul détecté sur l'offset du gradient, sur `calculerTresorerieActuelle`, ni régression sur la recette du moteur.

## Verdict final : **PASS**

Story PR2.4 validée pour passage en review (@code-reviewer). Les 2 réserves ci-dessus (findings 1 et 2) sont non bloquantes et peuvent être traitées au triage du PM.
