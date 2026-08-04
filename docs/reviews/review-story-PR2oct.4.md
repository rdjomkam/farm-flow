# Review — Story PR2oct.4 (UI)

## Périmètre

Composants revus :
- `src/components/previsions/vague-prevue-form-dialog.tsx`
- `src/components/previsions/parametres-tab.tsx`
- `src/components/previsions/plan-vagues-tab.tsx`
- `src/messages/fr/previsions.json`, `src/messages/en/previsions.json`

Tests revus : `vague-prevue-form-dialog.test.tsx` (+7), `parametres-tab.test.tsx` (+10), `plan-vagues-tab.test.tsx` (+3), et les 4 fixtures corrigées (`permissions-gating.test.tsx`, `rattacher-vague-dialog.test.tsx`, `scission-dialog.test.tsx`, `scenario-detail-client-refresh.test.tsx`).

Chaîne amont vérifiée pour s'assurer que l'UI ne pousse pas un champ dans le vide : `src/lib/validation/previsions.schema.ts`, `src/lib/queries/previsions-vagues.ts`, `src/components/previsions/api-types.ts` — tous portent déjà `alevinsAchetes`/`alevinsAchetesParDefaut` (PR2oct.2/PR2oct.3), la dépendance NO-GO signalée par la pré-analyse est bien levée.

## Checklist R1-R11

| Règle | Verdict | Justification |
|---|---|---|
| R1 | N/A | Pas de nouvel enum introduit par cette story. |
| R2 | OK | `StatutVaguePrevue`, `Permission` importés depuis `@/types` (`plan-vagues-tab.tsx:16`, `parametres-tab.tsx:17`), aucune chaîne en dur pour un enum. |
| R3 | OK | `alevinsAchetes: boolean` / `alevinsAchetesParDefaut: boolean` cohérents Prisma ↔ `api-types.ts` ↔ composants. |
| R4 | N/A | Pas d'opération d'écriture DB dans cette story (composants clients). |
| R5 | OK | Seul `DialogTrigger` du périmètre (`vague-prevue-form-dialog.tsx:171`) porte déjà `asChild` — non modifié par cette story, toujours correct. |
| R6 | OK | Checkbox en `border-input`, hint en `text-muted-foreground`, badge en `variant="default"` (mappé thème) — aucune couleur en dur (`vague-prevue-form-dialog.tsx:242`, `parametres-tab.tsx:324`, `plan-vagues-tab.tsx:188-192`). |
| R7 | OK | `existant ? existant.alevinsAchetes : alevinsAchetesParDefaut` (`vague-prevue-form-dialog.tsx:84-86`) et `scenario.parametres?.alevinsAchetesParDefaut ?? false` (`parametres-tab.tsx:148-150`) — nullabilité traitée explicitement. |
| R8 | N/A | Pas de nouveau modèle. |
| R9 | OK | Tests exécutés avant review (`npx vitest run` ×3, `npm run build`) ; voir le point ouvert sur `tsc` ci-dessous. |
| R10 | N/A | Pas de correctif de données dans cette story. |
| R11 | OK | Aucun secret, aucune URL en dur dans les fichiers revus. |
| TypeScript strict | OK | Aucun `any` introduit. |
| Mobile first | VALIDÉ AVEC RÉSERVE | Voir constat Moyenne (375px ≠ 360px). |
| Server Components | OK | Les deux fichiers étaient déjà `"use client"` avant cette story — aucune conversion Server→Client injustifiée. |
| Validation des entrées API | OK | `alevinsAchetes`/`alevinsAchetesParDefaut` bien déclarés dans `previsions.schema.ts:81,238`. |
| Gestion d'erreurs | OK | Patron existant réutilisé sans changement (`useApi`, `fieldErrors`). |
| Noms anglais / UI française | OK | Voir revue i18n ci-dessous. |

## Constats détaillés

### 1. ADR-053 §14.4 — le point le plus important : CONFORME
`prixAlevinUnitaireFCFA` reste dans la boucle générique `CHAMPS.map` (`parametres-tab.tsx:294-317`) avec exactement `disabled={!peutParametrer}` (ligne 304), au même titre que tous les autres champs — aucun `disabled` conditionné par `alevinsAchetesParDefaut` n'existe nulle part dans le fichier. Seule addition : une entrée dans `CHAMPS_AVEC_HINT` (ligne 92) pour un texte d'aide, exactement le mécanisme prescrit par la pré-analyse. Le test de non-régression dédié (`parametres-tab.test.tsx:238-252`, `it.each([true, false])`) couvre réellement le cas : `toBeInTheDocument()`, `not.toBeDisabled()` et valeur affichée, pour les deux états du drapeau.

### 2. Préremplissage : CONFORME
Création : `alevinsAchetes` initialisé à `alevinsAchetesParDefaut` (`vague-prevue-form-dialog.tsx:84-86`, répété dans `resetForm()` ligne 101). Édition : initialisé à `existant.alevinsAchetes`, jamais au défaut du scénario — le test `vague-prevue-form-dialog.test.tsx:200-230` construit délibérément un cas où le défaut du scénario (`false`) diverge de `existant.alevinsAchetes` (`true`) et vérifie que la case reflète bien `true`. Ce test ne peut pas passer par coïncidence.

### 3. Le champ part bien dans le payload, y compris `false` : CONFORME
POST/PUT vague : `payload` construit littéralement avec `alevinsAchetes` (`vague-prevue-form-dialog.tsx:130`), jamais dans un `if`, donc `false` traverse ; test `vague-prevue-form-dialog.test.tsx:176-198` (`expect.objectContaining({ alevinsAchetes: false })`). PUT paramètres : `body` initialisé directement avec `{ alevinsAchetesParDefaut }` (`parametres-tab.tsx:183-185`), **en dehors** de la boucle `Number(raw)` qui aurait corrompu un booléen — c'est exactement le piège identifié par la pré-analyse, correctement évité ; test `parametres-tab.test.tsx:205-216` pour le cas `false`.

### 6. i18n — CONFORME, aucune faute relevée
Parité fr/en vérifiée par lecture directe des deux fichiers (sections `vaguePrevueForm.fields.alevinsAchetes`, `parametresTab.fields.alevinsAchetesParDefaut`, `parametresTab.fields.prixAlevinUnitaireFCFA.hint`, `planVaguesTab.badgeAlevinsAchetes`/`badgeProductionInterne`). Accents corrects, guillemets français cohérents dans le hint, apostrophes conformes au style existant du fichier. Libellés anglais idiomatiques (« Purchased fingerlings », « Internal production »). Aucune clé orpheline ou manquante.

### 7. Le badge bonus dans `plan-vagues-tab.tsx` — avis nuancé
La pré-analyse (§4, `pre-analysis-story-PR2oct.4.md:164-169`) tranchait explicitement : « ne pas l'exiger du @developer dans le périmètre GO de cette story ; le signaler comme amélioration possible ». Le @developer l'a fait quand même. Ce n'est pas une violation R1-R11, et l'exécution est propre : patron `Badge` réutilisé à l'identique (`plan-vagues-tab.tsx:188-192`), 3 tests dédiés bien construits (dont un test anti-fuite d'état entre cartes, `plan-vagues-tab.test.tsx:160-169`), i18n complète, vérifié en navigateur réel sur les 19 vagues d'`EXCEL-V12`. Risque réel mais faible et déjà couvert. Recommandation : accepter ce sprint-ci, mais signaler que dépasser un périmètre explicitement refusé par la pré-analyse — même « peu coûteux » — mérite une confirmation **avant** implémentation, pas après coup.

### 8. Fixtures corrigées — jugement sévère : NÉCESSITÉ CONFIRMÉE, AUCUNE RÉGRESSION MASQUÉE
Vérifié directement dans les 4 fichiers : chaque modification est un unique ajout `alevinsAchetes: false,` (ou `alevinsAchetesParDefaut: false` pour `permissions-gating.test.tsx`) dans un objet fixture/`makeVague()`, valeur alignée sur le `@default(false)` Prisma — aucune assertion affaiblie, aucun `expect` supprimé ou modifié, aucune valeur artificielle choisie pour faire passer un test qui échouait pour une autre raison. Correctif de compilation pur.

### 9. Server Components — CONFORME
Les deux fichiers modifiés portaient déjà `"use client"` en ligne 1 (état interactif préexistant : `useState`, `onChange`).

## Point ouvert — les 4 erreurs `tsc --noEmit`

Vérifié directement, pas seulement repris du rapport de test. Cause racine : `src/lib/previsions/__tests__/recette/helpers.ts:74-79` — le type `GoldenFixture.entreesModele.parametresScenario` ne déclare que `prixVenteKgFCFA`, `poidsMoyenVenteKg`, `tauxEpargnePct`, `tresorerieInitialeFCFA`, alors que `route-orchestration-builder.ts:158,162` et `orchestration.ts:230-232,295-297` lisent `margeSecuriteAlevinsPct` et `prixAlevinUnitaireFCFA`.

C'est un vrai défaut de typage (accès à des propriétés non déclarées), pas un faux positif — mais **structurellement sans lien avec `alevinsAchetes`/PR2oct.4** : ces fichiers appartiennent au harnais de recette (PR2oct.2/PR2oct.3), pas au périmètre UI. Aucun des trois fichiers touchés par PR2oct.4 n'apparaît dans cette chaîne.

**Verdict sur ce point** : le diagnostic du @tester est correct et confirmé par lecture directe — ni une conséquence de PR2oct.4, ni un bloquant pour sa clôture. Ce n'est pas anodin pour autant : c'est exactement le type de lacune contre laquelle ERR-170 met en garde (un champ que le moteur utilise réellement mais que le typage de son propre harnais de recette ne reconnaît pas — sans conséquence fonctionnelle immédiate car `vitest` ne type-check pas, mais fragilise silencieusement `npx tsc --noEmit` pour tout agent futur). Recommandation : traiter en sévérité **Moyenne** (n'affecte ni `vitest run` ni `build`, donc pas Haute), à la charge du porteur de PR2oct.3, avant clôture finale du sprint.

## Constats par sévérité

**Critique** : aucun.

**Haute** : aucun.

**Moyenne** :
- **Vérification mobile à 375px, pas 360px.** CLAUDE.md pose explicitement « MOBILE FIRST (360px d'abord, puis desktop) », répété dans la pré-analyse §7. Le rapport de test documente une vérification réelle à 375px. L'écart de 15px n'est pas anodin ici précisément parce que le point à risque est un hint textuel qui « s'enroule déjà sur 2 lignes à 375px » — 15px de moins peuvent le faire passer à 3 lignes ou créer une collision que la vérification actuelle ne peut pas exclure. Recommandation : refaire la capture à 360px avant de considérer le risque mobile clos.
- **Typage `tsc` du harnais de recette (`helpers.ts`)** — voir point ouvert ci-dessus, à rattacher à PR2oct.3, pas à cette story.

**Basse** :
- Badge bonus sur `plan-vagues-tab.tsx` ajouté malgré la recommandation explicite de la pré-analyse de ne pas l'exiger — exécution propre et bien testée, mais dépassement de périmètre à signaler pour discipline future.
- `scenarioForm.fields` (dialogue de création initiale d'un scénario, `previsions.json:22-106`) n'expose pas `alevinsAchetesParDefaut` à la création — cohérent avec le périmètre défini par la pré-analyse (non exigé), signalé pour information : un nouveau scénario ne peut fixer ce défaut qu'après coup, via l'onglet Paramètres.

## Verdict

**VALIDÉ AVEC RÉSERVES**

La story respecte scrupuleusement l'exigence la plus sensible (ADR-053 §14.4 : `prixAlevinUnitaireFCFA` jamais désactivé ni masqué), la chaîne payload/préremplissage est correcte et testée de façon rigoureuse (les tests ciblent explicitement les cas pièges — divergence défaut/existant, `false` explicite), l'i18n est propre, et les fixtures corrigées ne masquent aucune régression. Les deux réserves (vérification 360px manquante, typage `tsc` du harnais de recette à rattacher à PR2oct.3) ne remettent pas en cause la fonctionnalité livrée et ne justifient pas un rejet, mais doivent être tracées avant de considérer le sprint PR2-octies entièrement clos.
