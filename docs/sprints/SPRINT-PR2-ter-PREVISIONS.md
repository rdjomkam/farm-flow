# Sprint PR2-ter — Saisie des charges et fiabilité des dialogues du module Prévisions

**Statut** : FAIT
**Référence** : [ADR-053 — Module Prévisions](../decisions/ADR-053-module-previsions.md), `docs/sprints/SPRINT-PR2-bis-PREVISIONS.md`

## Contexte

Le plan de référence du classeur Excel est en cours de rejeu intégral par l'interface. Deux obstacles concrets ont été constatés à l'écran, tous deux dans `src/components/previsions/`.

## Contrainte transverse — le moteur

**Interdiction de toucher au moteur `src/lib/previsions/`** : la recette doit rester à **1270 tests / 0 écart**.

## Hors périmètre

Rapprochement prévu/réel, vues de comparaison, exports, reprévision.

## Point de process

`docs/sprints/*.md` et `docs/TASKS.md` sont écrits **exclusivement** par le `@status-updater`, spawné par le `@project-manager`. Tout agent qui a quelque chose à consigner le rapporte au PM.

## Stories

| Story | Type | Sujet | Pipeline | Statut |
|-------|------|-------|----------|--------|
| PR2ter.1 | UI + API | Reporter une charge sur plusieurs mois | @pre-analyst → @developer → @tester → @code-reviewer | FAIT |
| PR2ter.2 | BUGFIX | Deux bugs de cycle de vie des dialogues | @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper | FAIT |

**Légende** : `TODO` · `EN COURS` · `REVIEW` · `FAIT` · `BLOQUÉ`

---

### PR2ter.1 — Reporter une charge sur plusieurs mois

**Type** : UI
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer
**Statut** : FAIT

**Pipeline exécuté** : @pre-analyst → @developer → @tester → @code-reviewer.
Rapports : `docs/analysis/pre-analysis-story-PR2ter.1.md`, `docs/tests/rapport-story-PR2ter.1.md`, `docs/reviews/review-story-PR2ter.1.md`.

**Verdict de review** : **VALIDÉ AVEC RÉSERVES** — aucune réserve bloquante. Deux réserves de sévérité **Basse** :
1. L'aperçu est calculé sur un **instantané client** sans verrou optimiste — le risque est identique à celui de la route unitaire préexistante, ce n'est donc **pas une régression** introduite par cette story.
2. Le bouton « mois suivant » de `charges-tab.tsx` n'a **pas de borne haute** sur `horizonMois` — bug **pré-existant de PR2.3**, que le nouveau dialogue rend visible en affichant le message trompeur « Horizon du plan indisponible ». À traiter en sprint de polish.

**Pré-analyse** : faite — verdict **GO AVEC RÉSERVES**, rapport `docs/analysis/pre-analysis-story-PR2ter.1.md`.
La pré-analyse a tranché le point ouvert du 3ᵉ critère d'acceptation en faveur d'une **route de report en lot** (`POST /api/previsions/postes/[id]/charges/reporter`) plutôt que d'une boucle côté client. Conséquence de périmètre : la story n'est plus purement UI, elle devient **UI + API** (nouvelle route, schéma de validation associé, tests d'API en plus des tests d'UI).

**Problème** : `src/components/previsions/charges-tab.tsx` est un navigateur mois par mois (`moisAbsolu` en state, boutons précédent/suivant, un champ par poste). Pour le plan de référence — 4 postes constants sur 21 mois — cela impose **21 navigations et 84 frappes** pour une information qui tient en 4 nombres (main-d'oeuvre 500 000, énergie 120 000, produits vétérinaires 250 000, loyer 110 000).

**Intention à satisfaire** : saisir un montant **une fois** et l'appliquer à une plage de mois. Au minimum « du mois courant jusqu'à la fin de l'horizon », idéalement avec le choix « tous les mois du plan ». La forme exacte est proposée par @pre-analyst après lecture du composant et de l'API existante (`PUT /api/previsions/postes/[id]/charges`, schéma `upsertChargeMensuelleSchema` avec `moisAbsolu` + `montantFCFA`).

**Critères d'acceptation** :
- [ ] L'utilisateur voit **combien de mois seront touchés** ET **ce qui sera écrasé** avant de valider. Jamais d'écrasement silencieux de montants déjà saisis.
- [ ] Réversibilité, ou au minimum confirmation explicite (action de masse).
- [ ] Le choix « route de report en lot » vs « boucle côté client » est tranché par @pre-analyst sur la base du **volume réel (21 mois)**, pas d'une préférence de principe.
- [ ] i18n `fr` et `en`, accents français corrects, aucune chaîne en dur (le module est à 299 clés en parité stricte).
- [ ] Mobile first, `DialogTrigger asChild` (R5), variables CSS du thème (R6).

---

### PR2ter.2 — Deux bugs de cycle de vie des dialogues

**Type** : BUGFIX
**Pipeline** : @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper
**Statut** : FAIT

**Pipeline exécuté** : @pre-analyst → @developer → @tester → @code-reviewer → @knowledge-keeper.
Rapports : `docs/analysis/pre-analysis-story-PR2ter.2.md`, `docs/tests/rapport-story-PR2ter.2.md`, `docs/reviews/review-story-PR2ter.2.md`.

**Verdict de review** : **VALIDÉ** — aucune réserve bloquante. Deux réserves non bloquantes :
1. **Basse (documentaire)** — commentaire à clarifier sur le `setState` pendant rendu de `scission-dialog.tsx`.
2. **Moyenne (UX)** — le garde de fermeture bloque **silencieusement**, sans feedback visuel. À traiter en sprint de polish.

**Capitalisation (`docs/knowledge/ERRORS-AND-FIXES.md`)** :
- **ERR-145** — Bug B (Critique) : dialogue non réinitialisé à la réouverture, corruption silencieuse de données.
- **ERR-146** — Bug A (Haute) : clic extérieur / Échap ferme un formulaire long sans avertissement.
- **Leçon commune consignée** : ces bugs vivent dans le **cycle de vie du composant**, pas dans la logique métier — aucun des 7487 tests ne les attrapait. **Règle retenue** : tout dialogue de formulaire doit avoir un test « ouvrir → saisir → fermer → rouvrir → champs vides », accompagné du test « clic extérieur **SANS** saisie → le dialogue se ferme bien ».

**Pré-analyse** : faite — verdict **GO**, rapport `docs/analysis/pre-analysis-story-PR2ter.2.md`.
**Cause racine confirmée (Bug B)** : `setForm(EMPTY_STATE)` n'est appelé que dans la **branche de succès** de la soumission — jamais sur « Annuler », jamais sur `onOpenChange`. Le state survit donc à toute fermeture qui n'est pas une validation réussie, d'où la réapparition des valeurs et la concaténation à la ressaisie.
**Référence interne** : `generer-plan-dialog.tsx` est le **seul** dialogue du module qui applique déjà le bon patron de réinitialisation — il sert de modèle pour la correction des autres.

**Périmètre** : constatés sur `scenario-form-dialog.tsx`, à vérifier et corriger sur **TOUS** les dialogues de formulaire du module :
`aliment-form-dialog`, `vague-prevue-form-dialog`, `poste-form-dialog`, `apport-form-dialog`, `journal-form-dialog`, `repartition-mois-dialog`, `generer-plan-dialog`, `scission-dialog`, `rattacher-vague-dialog`.

**Bug A — sévérité Haute** : un clic hors du dialogue ferme et **perd toute la saisie**, sans avertissement. Constaté avec 8 champs sur 19 remplis. Correction : désactiver la fermeture au clic extérieur quand le formulaire est modifié, ou demander confirmation. @pre-analyst tranche laquelle des deux approches est cohérente avec le reste du dépôt (**regarder les autres modules avant d'inventer un patron nouveau**).

**Bug B — sévérité Critique** : le dialogue **ne se réinitialise pas à la réouverture**, et la nouvelle saisie **se concatène** à l'ancienne. Réouvrir « Nouveau scénario » après fermeture accidentelle réaffiche les valeurs précédentes et la saisie suivante s'ajoute au lieu de remplacer. Résultat constaté : code `EXCEL-V12EXCEL-V12`, nom `Plan de reference Excel v12Plan de reference Excel v12`, marge de sécurité `105400701900410`. C'est une **corruption silencieuse de données** : l'utilisateur peut valider sans rien remarquer.

**Critères d'acceptation** :
- [ ] Le state du formulaire est remis à zéro à chaque ouverture.
- [ ] Test de non-régression : ouvrir, saisir, fermer, rouvrir, vérifier que les champs sont vides. C'est exactement le scénario qui a échappé à toute la suite de tests existante.
- [ ] @knowledge-keeper consigne les deux bugs en ERR, avec la leçon : **aucun test ne les attrapait parce qu'ils vivent dans le cycle de vie du composant, pas dans la logique métier**.

---

## Vérification de fin de sprint

- [x] `npx vitest run` — **277 fichiers** (273 passés + 4 skippés), **7633 tests** (7588 passés, 19 skippés, 26 todo), **0 échec**. Base avant sprint : 267 fichiers / 7487 tests. Progression : **7487 → 7633 tests, 0 échec** (+10 fichiers).
- [x] `npx vitest run src/lib/previsions/__tests__/recette` — **1270 tests / 0 écart** (inchangé, contrainte moteur tenue).
- [x] `npm run build` — **exit 0** : compilation + TypeScript + 169/169 pages OK.

## Périmètre

**Tenu.** Une alerte initiale portant sur 9 fichiers modifiés sous `src/lib/previsions/` a été investiguée et déclarée **faux positif** : ces diffs proviennent des stories **PR2.1** et **PR2bis.3** restées non committées au démarrage de PR2-ter (chaque hunk cite littéralement PR2.1 ou PR2bis.3), et non de PR2-ter. Le sprint opère exclusivement dans `src/components/previsions/`, `src/app/api/previsions/` et `src/hooks/`. Aucun rapprochement prévu/réel, aucune vue de comparaison, aucun export ni reprévision n'est apparu.

## Réserves reportées

Aucune réserve bloquante. À reporter au prochain **sprint de polish** :
- **Moyenne (UX)** — feedback visuel du garde de fermeture des dialogues (PR2ter.2).
- **Basse (pré-existant)** — borne haute du navigateur de mois de `charges-tab.tsx` (PR2ter.1, bug de PR2.3).
