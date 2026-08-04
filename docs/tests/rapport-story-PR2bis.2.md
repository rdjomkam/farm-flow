# Rapport de test — Story PR2bis.2 (UI câblage `genererPlanEmpoissonnement`)

**Testeur :** @tester
**Date :** 2026-08-03

## 1. Sorties réelles des 4 commandes

### `npx vitest run src/__tests__/integration/i18n-completeness.test.ts`
```
✓ src/__tests__/integration/i18n-completeness.test.ts (159 tests) 107ms
Test Files  1 passed (1)
Tests  159 passed (159)
```

### `npx vitest run src/lib/previsions/__tests__/recette`
```
✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (440 tests)
✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (440 tests)
✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (390 tests)
Test Files  3 passed (3)
Tests  1270 passed (1270)
```
Confirmé : **1270/0**, le moteur n'a pas été touché.

### `npx vitest run` (avant ajout de mes tests)
```
Test Files  262 passed | 4 skipped (266)
Tests  7472 passed | 19 skipped | 26 todo (7517)
```
Conforme aux chiffres déclarés (266 fichiers / 7472 passés / 0 échec).

### `npx vitest run` (après ajout de mon fichier de vérification, 15 tests)
```
Test Files  263 passed | 4 skipped (267)
Tests  7487 passed | 19 skipped | 26 todo (7532)
```
0 échec.

### `npm run build`
Build production **OK**, aucune erreur, toutes les routes générées (dont `/api/previsions/scenarios/[id]/vagues/generer` implicite dans le build dynamique de l'App Router).

## 2. Résultat des 11 vérifications

1. **Aucun écrasement silencieux** — VÉRIFIÉ. J'ai écrit un test explicite non couvert par la suite du développeur : une `VaguePrevue` de statut **PLANIFIEE mais déjà rattachée à une vague réelle** (cas plus subtil que le test existant qui ne couvrait que le rattachement avec statut `EN_COURS`) **survit intacte** à une régénération `mode: "remplacer"` — seule la ligne non rattachée est annulée. Aucune fonction `deleteVaguePrevue` n'existe (confirmé par grep + test). PASS.
2. **Cohérence aperçu ↔ écriture** — VÉRIFIÉ sur 7 combinaisons (`horizonMois` ∈ {0,1,4,12,21}, modes `ajouter`/`remplacer`) : `apercuGenerationPlan(...).nombreNouvellesVagues` == `genererPlanVaguesPrevues(...).length`, et les codes annoncés == les codes réellement créés, dans tous les cas. L'aperçu (GET) ne mute strictement aucune ligne (vérifié avant/après). PASS — les deux chemins partagent `chargerPourGenerationPlan`/`genererTheorique`/`plusHautNumeroCode`, donc structurellement pas de divergence possible.
3. **Attribution des codes** — VÉRIFIÉ. Une `VaguePrevue` `ANNULEE` occupe toujours sa ligne de code (non réutilisée après régénération). Un code non conforme au motif `V<entier>` (`"V2a"` issu de scission, `"ALEVINS-2026"` en saisie libre) est ignoré silencieusement par `plusHautNumeroCode` sans exception et sans collision de code. PASS.
4. **R8 étanchéité inter-site** — VÉRIFIÉ à deux niveaux : queries (`genererPlanVaguesPrevues("s1","site-B",...)` rejette "Scenario introuvable", aucune écriture — test développeur) et route (`auth.activeSiteId` threadé, vérifié par `expect(mockApercuGenerationPlan).toHaveBeenCalledWith("scenario-1","site-1",...)` / idem POST). PASS.
5. **Permissions** — VÉRIFIÉ : GET = `PREVISIONS_VOIR` (401/403/200/400/404/422 tous testés), POST = `PREVISIONS_GERER` (401/403/201/400/404/422 tous testés). Le bouton "Générer un plan" est bien **absent** avec `PREVISIONS_VOIR` seule (`permissions-gating.test.tsx`, ligne 122), et **désactivé avec motif explicite** si `ParametresPrevision` est `null` (ligne 158-172). PASS.
6. **Cas limites du moteur** — VÉRIFIÉ : `horizonMois = 0` produit bien 1 vague (pas `[]` silencieux), `frequenceStockageMois <= 0` produit `[]` proprement sans exception ni écriture partielle (mes tests). `horizonMois` absent est bien distingué de `horizonMois = 0` côté schéma GET (`z.string().min(1, ...)` avant `.transform(Number)`, pas de `z.coerce.number()` seul — commentaire explicite dans le schéma sur le piège `Number(null) === 0`). PASS.
7. **ERR-135 / ERR-136** — VÉRIFIÉ : `assertEntierColonneInt` appliqué sur `effectifAlevinsPrevu` avant le `createMany` ; `createMany` (pas de `create`+`include`) suivi d'un `findMany` séparé pour relire les lignes créées — conforme au pattern documenté. PASS.
8. **i18n** — VÉRIFIÉ : aucune chaîne française en dur dans `generer-plan-dialog.tsx` ni dans les nouvelles parties de `plan-vagues-tab.tsx` (grep ciblé, seules les valeurs d'état interne `"ajouter"/"remplacer"/"saisie"/"apercu"` et les clés de traduction apparaissent en littéral). Parité stricte fr/en vérifiée par script (aucune clé fr-only ni en-only). Accents fr corrects et anglais idiomatique (vérification manuelle du texte). Le mode "remplacer" est bien nommé honnêtement dans les deux langues ("Annuler les vagues planifiées non réalisées et régénérer" / "Cancel unrealized planned batches and regenerate"), pas un "remplacer" trompeur — conforme à la réserve de la pré-analyse §5. PASS.
9. **Mobile-first / R5 / R6** — `<DialogTrigger asChild>` utilisé (R5). Classes `w-full md:w-auto` sur le bouton déclencheur et le conteneur d'actions (mobile d'abord). Aucune couleur hex en dur (`text-danger`, `text-muted-foreground`, classes du thème réutilisées) — R6 respecté. Pas de tableau brut, cartes/liste à puces dans le dialogue. PASS.
10. **Non-régression** — La branche "créer une vague" (`VaguePrevueFormDialog`) et le flux de scission/rattachement (`ScissionDialog`, `RattacherVagueDialog`) restent inchangés dans `plan-vagues-tab.tsx` ; le test de gating distingue bien le bouton "Ajouter" (regex `/Ajouter/i`) du nouveau bouton "Générer un plan" (regex `/Générer un plan/i`), pas de collision de sélecteur. Suite complète 267 fichiers / 0 échec après ajout de mes tests. PASS.
11. Schéma zod : `positiveInt` (nom trompeur mais comportement `.nonnegative()`, donc `horizonMois = 0` accepté côté POST comme côté GET) — vérifié cohérent avec le comportement documenté du moteur (0 = 1 vague), pas un bug, juste une observation de nommage (voir Réserve ci-dessous).

## 3. Tests ajoutés par @tester

Fichier : `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/__tests__/previsions-generer-plan-tester-verification.test.ts` (15 tests, tous passants) :
- Garantie centrale : `VaguePrevue` `PLANIFIEE` **et** rattachée à une vague réelle survit à une régénération `remplacer` (cas non couvert par la suite développeur, qui ne testait que le rattachement avec statut `EN_COURS`).
- Cohérence aperçu/écriture sur 7 combinaisons horizon×mode.
- Dry-run réellement sans écriture (vérification stricte avant/après).
- Codes non conformes (`V2a`, `ALEVINS-2026`) : pas de plantage, pas de collision.
- Code `ANNULEE` jamais réutilisé.
- Cas limites `horizonMois = 0` et `frequenceStockageMois <= 0`.

## 4. Bugs trouvés

**Aucun bug bloquant trouvé.** Une observation mineure, non bloquante :
- `positiveInt` (helper dans `previsions.schema.ts`, ligne 38-40) est en réalité `z.number().int().nonnegative()` — le nom suggère "strictement positif" alors que 0 est accepté. C'est le comportement **correct** ici (cohérent avec `horizonMois = 0` valide côté moteur), mais le nom est trompeur et partagé avec d'autres champs du fichier où la sémantique "positif ou nul" est bien voulue également. Pas un défaut de cette story (le helper préexistait), signalé pour information seulement — pas d'action requise.

## 5. Verdict

**PASS.**

Les 11 points de vérification demandés par le PM sont tous validés, y compris le point le plus sensible (garantie de non-destruction d'une `VaguePrevue` rattachée, testée dans un cas plus strict que la suite livrée). Suite complète : 267 fichiers / 7487 tests passés / 0 échec (dont mes 15 tests ajoutés). Build production OK. i18n fr/en en parité stricte, accents corrects. Aucune régression sur les flux existants (création, scission, rattachement).
