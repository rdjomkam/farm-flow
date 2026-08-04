# Rapport de test — Story PR2bis.1 (UI — internationalisation du module Prévisions)

**Testeur :** @tester
**Date :** 2026-08-03
**Étape :** 3/pipeline (post-implémentation, avant code-review)

## Verdict : PASS

Aucune réserve bloquante. Deux réserves mineures (basse sévérité) signalées en fin de rapport.

---

## 1. Rejeu des 4 commandes déclarées

### `npx vitest run src/__tests__/integration/i18n-completeness.test.ts`
```
✓ src/__tests__/integration/i18n-completeness.test.ts (159 tests) 109ms
Test Files  1 passed (1)
     Tests  159 passed (159)
```
Conforme au chiffre déclaré (159/159).

### `npx vitest run src/lib/previsions/__tests__/recette`
```
✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (440 tests) 10ms
✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (440 tests) 10ms
Test Files  2 passed (2)
     Tests  880 passed (880)
```
Conforme : 880/0 écart, le moteur de calcul n'a pas été touché.

### `npx vitest run` (suite complète)
```
Test Files  260 passed | 4 skipped (264)
     Tests  7050 passed | 19 skipped | 26 todo (7095)
Duration  22.62s
```
Conforme au chiffre déclaré (264 fichiers / 7050 tests passés / 0 échec).

### `npm run build`
Succès — build production terminé sans erreur, routes `/previsions/scenarios` et
`/previsions/scenarios/[id]` bien buildées en dynamique (ƒ), comme le reste de l'app.

---

## 2. Le point critique — 3e registre `src/i18n/request.ts`

Vérifié par lecture directe : `"previsions"` figure bien dans `requestNamespaces`
(`src/i18n/request.ts` ligne 48), en plus de `src/messages/index.ts` (`namespaces`, ligne 11) et
de la map `namespaceFiles` dans `i18n-completeness.test.ts`.

**Preuve que le garde-fou fonctionne réellement** (pas juste présent, mais efficace) :
1. `previsions` retiré temporairement de `requestNamespaces` dans `src/i18n/request.ts`.
2. `npx vitest run src/__tests__/integration/i18n-completeness.test.ts -t "chaque namespace ... est charge"`
   → **échec constaté**, avec message explicite :
   `"previsions" est enregistre dans src/messages/index.ts mais absent de requestNamespaces
   (src/i18n/request.ts) — useTranslations("previsions") ne recevrait aucun message au runtime`
3. `src/i18n/request.ts` restauré à l'identique (diff vérifié nul après restauration), suite
   `i18n-completeness.test.ts` re-exécutée → 159/159 de nouveau vert.

Le garde-fou n'est pas cosmétique : il casse réellement quand on casse ce qu'il garde. Point
critique de la pré-analyse levé.

---

## 3. Qualité des traductions françaises

`src/messages/fr/previsions.json` (299 clés) lu intégralement (les 545 lignes), plus vérification
programmatique : recherche des motifs désaccentués caractéristiques cités par la story
(`prevision`, `securite`, `creez`, `tresorerie`, `duree`, `reel`, `periode`, `deja`, `numero`,
`annee`, `depense`, `recolte`, `echeance`, `systeme`) dans les **valeurs** (pas les clés) —
**aucune occurrence trouvée**. Un balayage plus large (97 chaînes de plus de 12 caractères sans
aucun caractère accentué) a été inspecté à la main : toutes sont des phrases qui n'ont légitimement
pas besoin d'accent en français (« Mois », « Enregistrement... », « Transport (optionnel) »,
« Identification », etc.) — aucune faute détectée.

Échantillon relu en détail (tableauBordTab, previsionsMensuellesTab, tresorerieChart,
valeurCalculee) : français correct, accentué, cohérent avec le reste du dépôt (« Trésorerie
projetée », « Point bas de trésorerie », « Aucune donnée sur ce scénario », etc.).

**Conclusion : critère d'acceptation rempli.**

---

## 4. Qualité de l'anglais

Recherche programmatique de caractères accentués français (`éèêàâçîïôûùëü`) dans
`src/messages/en/previsions.json` : **0 occurrence** — aucun résidu français détecté par ce
critère. Échantillon large relu à la main (mêmes sections que le français, comparaison ligne à
ligne) : anglais de bonne qualité, formulations idiomatiques et non du mot-à-mot
(« Outside the plan's horizon: the plan starts in the future. », « The indicators below are
empty because of this error — this is not a real absence of batches or expenses. »,
« Shared expenses », « Cumulative balance »). Seules 12 valeurs sont identiques fr/en, toutes des
cognats légitimes courts (Code, Date, Type, Journal, Description, Identification) — pas des
traductions ratées.

**Conclusion : anglais réel, pas du français recopié.**

---

## 5. Parité stricte des clés fr/en

Script Python : aplatissement récursif des deux JSON en notation pointée.
- `fr` : 299 clés feuilles
- `en` : 299 clés feuilles
- Clés présentes en `fr` et absentes de `en` : **aucune**
- Clés présentes en `en` et absentes de `fr` : **aucune**

Parité stricte confirmée dans les deux sens.

---

## 6. Chaînes résiduelles en dur

Grep systématique des 25 fichiers du module (2 wrappers `page.tsx` + 23 composants) :
- **Littéraux JSX capitalisés en dur** : 7 correspondances trouvées, **toutes dans des
  commentaires JSDoc** (exemples de documentation, ex. `"Tresorerie actuelle"` dans un commentaire
  au-dessus de `tableau-bord-tab.tsx`, ou noms d'identifiants comme `` `Decimal` ``,
  `` `DialogTrigger` ``) — **0 chaîne visible réellement rendue en dur**.
- **`placeholder=`** : 2 occurrences, toutes `placeholder="0"` (valeur numérique neutre, pas de
  texte à traduire).
- **`aria-label=`, `title=`, `alt=`** : 0 occurrence en dur (tous passent par `t(...)`, vérifiés
  plus haut au §7 pour la résolution correcte des clés dynamiques).
- **`toast.*(...)`** : 0 appel avec chaîne littérale trouvé dans le module.
- **Messages d'erreur (`setError`, template literals)** : tous les `setError(...)` du module
  passent par `t("...")` (`apport-form-dialog.tsx`, `journal-form-dialog.tsx`,
  `poste-form-dialog.tsx`, `rattacher-vague-dialog.tsx`), à l'exception du cas
  `data?.message ?? t("rattacherVagueDialog.errors.generic")` où `data.message` vient de l'API
  (fr côté serveur, hors périmètre i18n front) — comportement correct.
- 2 fichiers sans `next-intl` : `src/app/(farm)/previsions/scenarios/page.tsx` et
  `.../[id]/page.tsx` — attendu, ce sont de purs réexports Server sans texte propre (confirmé par
  la pré-analyse et re-vérifié ici).

**Décompte : 0 chaîne visible résiduelle en dur trouvée** dans les 25 fichiers du module.

---

## 7. Clés mortes / clés manquantes

Croisement programmatique entre les 299 clés déclarées et les usages réels dans le code
(y compris les constructions dynamiques `t(\`prefix.${var}.suffix\`)` : `list.statuts.${statut}`,
`planVaguesTab.statuts.${statut}`, `previsionsMensuellesTab.columns.${key}.label/.formule`,
`parametresTab.fields.${key}.label/.hint`, `parametresTab.transportFields.${key}.label`).

- Valeurs des enums `StatutScenarioPrevision` (BROUILLON/ACTIF/ARCHIVE) et `StatutVaguePrevue`
  (PLANIFIEE/EN_COURS/REALISEE/NON_REALISEE/ANNULEE) croisées avec `src/types/models.ts` :
  correspondance exacte avec les clés JSON — **0 clé manquante qui lèverait au runtime**.
- Les 8 champs de `CHAMPS` et 6 champs de `CHAMPS_TRANSPORT` (`parametres-tab.tsx`) correspondent
  exactement aux clés `parametresTab.fields.*` / `parametresTab.transportFields.*` du JSON, y
  compris les 2 clés `.hint` optionnelles (`margeSecuriteAlevinsPct`, `nombreBacsSimultanesCible`).
- **Clés utilisées mais absentes du JSON (critique) : 0.**
- **Clés déclarées mais jamais utilisées (mineur) : 2** — `page.detailTitle` et `page.backToList`,
  dans le namespace `previsions` racine (probablement prévues pour un usage qui a finalement été
  fait autrement, ou vestiges d'une itération antérieure). Sans impact fonctionnel (aucune clé
  manquante ne lève), signalé en réserve mineure ci-dessous.

---

## 8. Les 4 mocks `next-intl` — testent-ils encore quelque chose ?

Vérifié pour les 4 fichiers (`scission-dialog.test.tsx`, `permissions-gating.test.tsx`,
`scenario-form-dialog.test.tsx`, `rattacher-vague-dialog.test.tsx`) : le mock `next-intl` n'est
**pas** `useTranslations: () => (key) => key` (ce qui ferait passer n'importe quel texte) mais une
résolution réelle :
```ts
import frPrevisions from "@/messages/fr/previsions.json";
const DICTIONARIES = { previsions: frPrevisions, ... };
function deepGet(obj, path) { ... }
function interpolate(template, values) { ... }
vi.mock("next-intl", () => ({
  useTranslations: (namespace) => (key, values) => {
    const value = deepGet(DICTIONARIES[namespace], key);
    return typeof value === "string" ? interpolate(value, values) : key;
  },
}));
```
Les assertions (`getByRole("button", { name: "Confirmer la scission" })`,
`getByText("Conflit générique.")`, `getByRole("button", { name: /Rattacher une vague réelle/i })`)
portent sur le **texte français réel résolu depuis le JSON**, pas sur la clé brute. Si une clé
disparaît ou change de valeur dans `previsions.json`, ces tests casseraient réellement — le mock
n'est pas vestigial, il vérifie effectivement le contenu.

---

## 9. Non-régression fonctionnelle des 21 fichiers de test mis à jour

Le module Prévisions dans son ensemble est actuellement non commité (`??` en `git status`,
hérité du sprint PR2 précédent jamais commité) — impossible de diffser directement contre une
version antérieure committée pour ces fichiers de test précis. Vérification faite par lecture
directe des assertions : les tests couvrent toujours le **comportement métier** décrit par la
pré-analyse (minimum 2 lignes filles pour la scission, champs requis par ligne, payload envoyé à
l'API, message de conflit affiché, bouton désactivé/activé selon l'état) — aucune assertion vidée
de son contenu ni remplacée par un simple `toBeInTheDocument()` générique sans texte attendu.

---

## 10. Mobile-first 360px et R5/R6

- **R5** (`DialogTrigger asChild`) : aucune régression — 0 `<DialogTrigger>` sans `asChild` trouvé
  dans le module.
- **R6** (variables CSS du thème) : 0 couleur hexadécimale en dur trouvée dans les composants du
  module.
- **Longueur des chaînes anglaises** : comparaison systématique fr/en sur les libellés courts
  (tabs, boutons, badges). Les libellés d'onglets (les plus contraints à 360px) sont en fait plus
  longs en français qu'en anglais dans ce module (`"Tableau de bord"` 15 car., `"Plan des vagues"`
  16 car. contre `"Dashboard"` 9 car., `"Batch plan"` 10 car.) — le pire cas anglais
  (`"Contributions"`, 13 car.) reste plus court que le pire cas français déjà en production. Un
  petit nombre de libellés de champ individuels sont plus longs en anglais de quelques caractères
  (`"Fingerling transport capacity (count)"` 37 car. vs `"Capacité transport alevins (nb)"` 31
  car.) — écart faible (+6 car.), sur des champs de formulaire déjà en `<Label>` qui wrap
  naturellement, pas dans un badge/tab à largeur fixe. **Aucun cas identifié à risque réel de
  casse de mise en page à 360px.**

---

## Réserves (non bloquantes)

1. **Basse — 2 clés mortes** : `previsions.page.detailTitle` et `previsions.page.backToList`
   déclarées dans `src/messages/{fr,en}/previsions.json` mais jamais consommées dans le code du
   module. Sans impact fonctionnel ; à nettoyer en polissage (Sprint 12) ou à la prochaine
   itération sur ce module.
2. **Basse — dette déjà signalée par la pré-analyse, non résolue par cette story (hors
   périmètre)** : les blocs de parité stricte fr/en de `i18n-completeness.test.ts` (describe
   lignes ~252-332) itèrent toujours sur une liste figée de namespaces qui n'inclut pas
   `previsions` — la parité stricte de ce nouveau namespace n'est vérifiée que par le script de ce
   rapport (§5), pas par un test automatisé dédié dans le dépôt. Recommandé mais non bloquant pour
   cette story (déjà signalé comme dette structurelle préexistante par la pré-analyse, point 4 des
   incohérences).

## Verdict final

**PASS.** Les 4 commandes rejouées confirment exactement les chiffres déclarés. Le garde-fou du
3e registre (`src/i18n/request.ts`) a été vérifié efficace par cassage contrôlé et restauration.
Le français est correctement accentué, l'anglais est un vrai anglais idiomatique, la parité de
clés fr/en est stricte (299/299, 0 orpheline dans les deux sens), aucune chaîne visible résiduelle
en dur n'a été trouvée dans les 25 fichiers du module, aucune clé utilisée n'est absente du JSON
(0 risque de crash runtime), et les 4 mocks `next-intl` vestigiaux signalés par la pré-analyse
résolvent réellement les clés depuis le JSON français — ils testent un vrai contenu, pas un
pass-through de clé.
