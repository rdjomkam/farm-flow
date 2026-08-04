# Rapport de test — Story PR2oct.4 (UI) — Sprint PR2-octies

**Testeur :** @tester
**Périmètre :** drapeau `alevinsAchetes` (VaguePrevue) / `alevinsAchetesParDefaut`
(ParametresPrevision) — ADR-053 §14, ERR-170.

## 1. Contexte au démarrage

`docs/TASKS.md` marquait `PR2oct.2` `FAIT` et `PR2oct.3` `EN COURS`. Vérification directe :
tous les maillons de la chaîne (`src/types/models.ts`, `src/lib/queries/previsions-vagues.ts`,
`src/lib/queries/previsions-scenarios.ts`, `src/lib/validation/previsions.schema.ts`,
`src/components/previsions/api-types.ts`) portaient déjà `alevinsAchetes` /
`alevinsAchetesParDefaut` — le blocage NO-GO signalé par la pré-analyse était levé, la story UI
était bien implémentable.

## 2. Bug de fixtures de test découvert et corrigé (hors production)

`npx tsc --noEmit` (hors du scope de `npm run build`, qui ne signale rien) a révélé que
l'extension du DTO `VaguePrevueListItemDTO` (champ `alevinsAchetes: boolean` requis) et de
`ParametresPrevisionDTO` (`alevinsAchetesParDefaut: boolean`, `tauxEpargnePct` déjà requis mais
absent de certaines fixtures) avait cassé le typage de **7 fichiers de test préexistants**, tous
en dehors du périmètre de cette story mais dans le même module :
- `src/components/previsions/__tests__/parametres-tab.test.tsx`
- `src/components/previsions/__tests__/plan-vagues-tab.test.tsx`
- `src/components/previsions/__tests__/permissions-gating.test.tsx`
- `src/components/previsions/__tests__/rattacher-vague-dialog.test.tsx`
- `src/components/previsions/__tests__/scission-dialog.test.tsx`
- `src/components/previsions/__tests__/scenario-detail-client-refresh.test.tsx`

Corrigé en ajoutant les champs manquants à chaque fixture/`makeVague()` (valeurs par défaut
`false`/`0`, cohérentes avec le comportement Prisma `@default`). **Aucun fichier de production
touché.** `npm run build` n'échouait pas malgré ces erreurs (le type-check de `next build` ne
couvre apparemment pas l'intégralité de l'arbre `__tests__/`), mais les laisser aurait dégradé la
fiabilité de `npx tsc --noEmit` pour tout agent futur — corrigé par prudence, hors mandat strict
mais dans le même fichier/la même nature de changement (fixture de test, pas de code applicatif).

**Restant, hors périmètre de cette story, signalé pour triage PM/PR2oct.3 :**
`src/lib/previsions/__tests__/recette/orchestration.ts` et
`.../recette/route-orchestration-builder.ts` (4 erreurs `tsc`, `margeSecuriteAlevinsPct` /
`prixAlevinUnitaireFCFA` absents d'un type de paramètres) — préexistantes avant toute intervention
sur cette story, aucun lien avec `alevinsAchetes`. `npx vitest run src/lib/previsions/__tests__/recette`
passe intégralement malgré ces erreurs `tsc` (vitest ne type-check pas par défaut) — **non
bloquant pour cette story**, mais à corriger par le porteur de PR2oct.3.

## 3. Tests écrits

### `src/components/previsions/__tests__/vague-prevue-form-dialog.test.tsx`
Nouveau describe `VaguePrevueFormDialog — drapeau alevinsAchetes (ADR-053 §14)` (7 tests) :
- case présente, décochée par défaut si `alevinsAchetesParDefaut` absent ;
- création : préremplie à `true` quand `alevinsAchetesParDefaut` du scénario vaut `true` ;
- cochable/décochable par l'utilisateur ;
- payload de création (`POST`) contient `alevinsAchetes: true` après un clic ;
- payload contient explicitement `alevinsAchetes: false` (jamais absent) quand décochée ;
- édition : reprend `existant.alevinsAchetes` (`true`) **même quand** `alevinsAchetesParDefaut`
  du scénario diverge (`false`) — protège explicitement la règle « jamais le défaut du scénario
  en édition » (ADR-053 §14) ;
- Annuler après avoir touché la case restaure la valeur d'origine à la réouverture (garde de
  fermeture déjà couverte par le Bug A du fichier, étendue au nouveau champ).

### `src/components/previsions/__tests__/parametres-tab.test.tsx`
Nouveau describe `ParametresTab — drapeau alevinsAchetesParDefaut (ADR-053 §14)` (10 tests) :
- case présente, reflète `scenario.parametres.alevinsAchetesParDefaut` (`false` et `true`) ;
- cochable/décochable ;
- incluse explicitement dans le corps du `PUT` (`true` après clic, **et `false` explicite quand
  jamais touchée** — protège contre un `undefined` silencieusement absorbé côté zod) ;
- `disabled` quand la permission `PREVISIONS_PARAMETRER` est absente ;
- hint du drapeau rendu ;
- **test de non-régression dédié ADR-053 §14.4** (`it.each([true, false])`) :
  `prixAlevinUnitaireFCFA` reste visible, non-`disabled`, avec sa valeur, **quel que soit** l'état
  de `alevinsAchetesParDefaut` — c'est exactement le raccourci ("désactiver le prix quand le
  drapeau est false") qu'un futur développeur serait tenté de reprendre ;
- hint contextuel de `prixAlevinUnitaireFCFA` lié par `aria-describedby` (même patron que le
  test existant du premier palier de remise, ligne 138-146).

### `src/components/previsions/__tests__/plan-vagues-tab.test.tsx`
Nouveau describe `PlanVaguesTab — badge alevinsAchetes (lecture seule)` (3 tests) :
- badge « Alevins achetés » affiché quand le drapeau est `true` (et pas « Production interne ») ;
- badge « Production interne » affiché quand `false` (et pas l'autre libellé) ;
- plusieurs vagues sur la même page affichent chacune le badge cohérent avec son propre drapeau
  (pas de fuite d'état entre cartes).

## 4. i18n

`npx vitest run src/__tests__/integration/i18n-completeness.test.ts src/__tests__/i18n/messages.test.ts`
→ **201/201 passés** (159 + 42), parité fr/en confirmée pour les nouvelles clés
(`vaguePrevueForm.fields.alevinsAchetes.label`,
`parametresTab.fields.alevinsAchetesParDefaut.label`/`.hint`,
`parametresTab.fields.prixAlevinUnitaireFCFA.hint`, `planVaguesTab.badgeAlevinsAchetes`,
`planVaguesTab.badgeProductionInterne`).

Relecture manuelle des libellés français : accents corrects (« Alevins achetés », « Alevins
achetés par défaut »), apostrophes droites cohérentes avec le reste du fichier (`S'applique`,
`n'affecte`), guillemets français « » utilisés dans le hint de `prixAlevinUnitaireFCFA` cohérents
avec le style déjà présent ailleurs dans le fichier. **Aucune faute relevée.**

## 5. Vérification navigateur réel (ERR-157)

Playwright + Chromium (déjà installés dans le dépôt, `@playwright/test` en dépendance,
`playwright.config.ts` existant) contre le serveur de dev déjà lancé sur `http://localhost:4200`
(DB Docker `silures-db` déjà up), connecté en `admin@dkfarm.cm` / `admin123`, site sélectionné,
scénario `EXCEL-V12` (`cmsdnypml0000n4ekuadykn0f`, 19 vagues planifiées en base).

**Observations réelles (pas jsdom) :**
- **Dialogue "Nouvelle vague planifiée", desktop (1024px) et 375px** : case à cocher « Alevins
  achetés » visible et cliquable, positionnée juste sous « Poids moyen initial (g) ». À 375px,
  bounding box mesurée du `<label>` englobant : `{x:16, y:398.5, width:343, height:44}` — cible
  tactile de **44px de hauteur** confirmée par mesure réelle du DOM rendu (pas seulement la
  classe `min-h-[44px]` présente dans le code), conforme au mobile-first CLAUDE.md.
- **Onglet Paramètres, desktop et 375px** : case « Alevins achetés par défaut » visible et
  cliquable, positionnée après « Taux d'épargne (%) », avant la section Transport. Le hint de
  `prixAlevinUnitaireFCFA` (« Appliqué uniquement aux vagues dont « Alevins achetés » est actif. »)
  est intégralement lisible, non tronqué, correctement enroulé sur 2 lignes à 375px — capture
  d'écran après scroll confirmant le texte complet (une première capture obtenue via
  `scrollIntoViewIfNeeded()` positionnait le texte exactement sous la barre de navigation basse
  fixe et semblait tronqué ; un scroll manuel supplémentaire confirme que ce n'était qu'un
  artefact de positionnement, le texte est intégralement visible et lisible dès qu'on scrolle
  normalement — **pas un bug**).
- **Cartes de vagues planifiées (`plan-vagues-tab`), desktop et 375px** : badge « Production
  interne » affiché sur les 19 vagues du scénario (toutes à `alevinsAchetes: false` en base,
  cohérent avec `@default(false)`), à côté du badge de statut « Planifiée » — aucune collision,
  aucun texte tronqué, layout de carte non cassé à 375px (cartes empilées verticalement, badges
  sur une seule ligne avec le code de la vague).
- Aucune erreur console (`pageerror`/`console.error`) levée pendant toute la navigation.

Captures d'écran conservées dans le scratchpad de session (non commitées, hors dépôt) :
`desktop-plan-vagues.png`, `desktop-vague-dialog.png`, `desktop-parametres.png`,
`mobile-375-parametres.png`, `mobile-375-plan-vagues.png`, `mobile-375-vague-dialog.png`,
`mobile-375-hint-scrolled.png`.

Les scripts Playwright ad hoc utilisés pour cette vérification ont été supprimés du dépôt après
usage (jamais commités) — aucune trace laissée dans l'arbre de travail.

## 6. Vérification finale

### `npx vitest run src/lib/previsions/__tests__/recette`
```
Test Files  3 passed (3)
     Tests  2458 passed (2458)
```
0 écart, 2 458 assertions — conforme au plancher exigé, aucune diminution.

### `npx vitest run` — trois passages consécutifs
```
Run 1 : Test Files 284 passed | 5 skipped (289)  —  Tests 8977 passed | 21 skipped | 26 todo (9024)
Run 2 : Test Files 284 passed | 5 skipped (289)  —  Tests 8977 passed | 21 skipped | 26 todo (9024)
Run 3 : Test Files 284 passed | 5 skipped (289)  —  Tests 8977 passed | 21 skipped | 26 todo (9024)
```
Trois compteurs **identiques**, **0 échec** sur les trois passages. Baseline avant story :
289 fichiers / 8957 tests (0 échec) — **+20 tests** ajoutés par cette story
(`vague-prevue-form-dialog.test.tsx` : 7→14, +7 ; `parametres-tab.test.tsx` : 14→24, +10 ;
`plan-vagues-tab.test.tsx` : 5→8, +3 ; total +20), exactement l'écart observé entre la baseline et
les trois passages ci-dessus.

### `npm run build`
```
✓ Compiled successfully in 12.1s
```
Exit code 0, aucune erreur, aucun avertissement TypeScript affiché par le build.

## 7. Ce qui a échoué ou a été laissé de côté

- **Rien dans le périmètre de cette story n'a échoué.**
- Signalé au PM pour triage (hors périmètre PR2oct.4, pré-existant, ne bloque ni les tests ni le
  build) : les 4 erreurs `tsc --noEmit` dans `src/lib/previsions/__tests__/recette/orchestration.ts`
  et `route-orchestration-builder.ts` (`margeSecuriteAlevinsPct` / `prixAlevinUnitaireFCFA`
  absents d'un type de paramètres du moteur) — probablement à la charge du porteur de PR2oct.3.
- Le léger doute initial sur le hint tronqué à 375px (§5) a été vérifié et écarté après contrôle
  manuel — documenté ici par souci de transparence plutôt que masqué.

## 8. Fichiers de test modifiés/créés (chemins absolus)

- `/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/__tests__/vague-prevue-form-dialog.test.tsx`
- `/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/__tests__/parametres-tab.test.tsx`
- `/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/__tests__/plan-vagues-tab.test.tsx`
- `/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/__tests__/permissions-gating.test.tsx` (fixture uniquement)
- `/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/__tests__/rattacher-vague-dialog.test.tsx` (fixture uniquement)
- `/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/__tests__/scission-dialog.test.tsx` (fixture uniquement)
- `/Users/ronald/project/dkfarm/farm-flow/src/components/previsions/__tests__/scenario-detail-client-refresh.test.tsx` (fixture uniquement)

Aucun fichier de production (`src/components/`, `src/messages/`, `src/lib/previsions/*.ts` hors
`__tests__/`) modifié. Aucune écriture en base — la vérification navigateur a utilisé les données
de seed déjà présentes (scénario `EXCEL-V12`), sans créer ni modifier de ligne.
