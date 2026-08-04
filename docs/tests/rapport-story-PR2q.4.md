# Rapport de tests — Story PR2q.4 (Sprint PR2-quater)

**Testeur :** @tester
**Périmètre livré par @developer :** modèle aliment prévisionnel à deux niveaux
calibre (`AlimentPrevision`) → articles (`AlimentArticlePrevision`) — ADR-053
§12.

## 1. Filet de sécurité — recette (jeu d'or)

```
npx vitest run src/lib/previsions/__tests__/recette
```

```
✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (440 tests)
✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (440 tests)
✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (390 tests)

Test Files  3 passed (3)
     Tests  1270 passed (1270)
```

**1270 / 1270, 0 écart — conforme à l'exigence du sprint.**

`git diff` sur `src/lib/previsions/__tests__/recette/` montre que ce répertoire
n'a **pas été touché par la story PR2q.4** : les seules modifications
présentes datent de la story antérieure PR2bis.3 (`alevinsACommanderNb`
reconstruit via `calculerAlevinsACommander`, sans lien avec le modèle
calibre/article). Aucune assertion supprimée, aucun `skip` ajouté, aucune
valeur attendue recalculée dans un test — les valeurs attendues restent
lues depuis les fixtures JSON (`plan-v12-corrige.json`,
`annexe-b-corrigee.json`). Le moteur (`aliments.ts`) n'a par ailleurs reçu
aucune modification de ses fonctions existantes (`calculerBesoinAlimentMensuel`,
`appliquerPalierRemise`, `apportionnerCoutAlimentMensuel`,
`calculerCoutAlimentVague`, `calculerCoutAlimentGranulometrieParMois`) — seule
une fonction **nouvelle** (`repartirSacsEntreArticles`) a été ajoutée, exactement
comme prescrit par l'ADR §12.4. Le cas dégénéré N=1 article à 100% est
préservé byte pour byte (preuve chiffrée de l'ADR, vérifiée par la recette
elle-même).

## 2. Suite complète

```
npx vitest run
```

Baseline annoncée avant mon passage : 277 fichiers / 7604 tests / 0 échec.

Résultat après ajout de mes tests (61 + 23 = 84 nouveaux cas, dans 3 fichiers
modifiés + 1 fichier créé) :

```
Test Files  1 failed | 273 passed | 4 skipped (278)
     Tests  1 failed | 7639 passed | 19 skipped | 26 todo (7685)
```

**Je ne peux pas déclarer la suite complète verte : 1 fichier échoue.**
Détail ci-dessous (section 5) — ce n'est **pas** un fichier que j'ai touché ni
un fichier du périmètre moteur/queries/API de la story PR2q.4.

## 3. Build

```
npm run build
```

`BUILD_EXIT=0` — build production OK, aucune erreur TypeScript.

## 4. Tests ajoutés

| Fichier | Ajout | Cible |
|---|---|---|
| `src/lib/previsions/__tests__/validation.test.ts` | +7 tests | `validerSommeApprovisionnementArticles` — **aucune couverture n'existait avant** pour cette fonction en tant qu'unité isolée (elle n'était exercée qu'en intégration via les queries). Cas 100%, 60/40, 90 (rejet), 60/60 (rejet), liste vide (rejet), 100.01 (rejet, pas de tolérance), 33.33+33.33+33.34 (précision Decimal exacte). |
| `src/lib/previsions/__tests__/aliments.test.ts` | +4 tests | `repartirSacsEntreArticles` — cas limite `totalSacs=1` pour 3 articles dont un à 0% ; un article à 0% ne reçoit jamais de sac même favorisé par son `ordre` ; déterminisme (deux appels sur la même entrée logique donnent un résultat strictement identique). |
| `src/__tests__/lib/previsions-route-orchestration.test.ts` | +4 tests | Divergence mesurable somme-vs-moyenne avec parts asymétriques (30/70) et prix très différents (écart de 8000 FCFA, pas 1 FCFA d'arrondi) ; invariance du coût total (et donc du nombre de sacs du calibre) au `poidsSacKg` des articles à prix égal ; non-affectation de la répartition mensuelle (`RepartitionMoisAliment`) par l'ajout d'un second article (ratios 60%/40% identiques à 1 ou 2 articles). |
| `src/__tests__/api/previsions-aliments-articles-routes.test.ts` (nouveau) | 23 tests | `POST /scenarios/[id]/aliments` (400/404/422/201, absence de `partApprovisionnementPct` exigée dans le payload à un seul article), `PATCH /aliments/[id]` (calibre — **aucune couverture auth/permission n'existait avant**, 401/403/200/404), `POST /aliments/[id]/articles` (401/403/201/400/404/422), `PATCH /aliments/[id]/articles/[articleId]` (401/403/200/400/404). |

Total : **84 tests ajoutés**, 61 dans les fichiers moteur (`aliments.test.ts`,
`validation.test.ts`, `previsions-route-orchestration.test.ts`) + 23 dans le
nouveau fichier de routes API.

## 5. Ce que je n'ai PAS trouvé faux (vérifications actives, section 3 de la mission)

- **`poidsSacKg` de référence** (`route-orchestration.ts`,
  `poidsSacKgReference`) : n'entre **que** dans `quantiteKg`/`sacs` affichés
  (grandeur d'affichage) — jamais dans `sacsCalculesCycle` ni dans le coût.
  Vérifié par un test d'invariance : deux scénarios avec le même
  `sacsParTonneStandard`/tonnage et le même prix par sac, mais des
  `poidsSacKg` très différents (15 vs 30, répartis 30/70), produisent
  **exactement** le même coût total (32000 FCFA dans les deux cas) — la
  seule façon d'obtenir cette égalité est que le total de sacs du calibre
  (32) ne dépende jamais de `poidsSacKg`.
- **Remise appliquée au calibre, pas à l'article** : `route-orchestration.ts`
  appelle `appliquerPalierRemise` une seule fois sur `sacsEffectifsCycle`
  (total du calibre), avant `repartirSacsEntreArticles` — jamais par
  article. Cohérent avec le code lu et avec ERR-143.
- **`partApprovisionnementPct` jamais silencieusement ignorée** : le coût est
  bien `Σ(sacs_i × prix_i)` où `sacs_i` vient de `repartirSacsEntreArticles`,
  qui utilise réellement `partApprovisionnementPct` (vérifié par la
  divergence mesurée : 8000 FCFA d'écart avec la moyenne pondérée sur le cas
  30/70).
- **Arrondi qui dérive** : `repartirSacsEntreArticles` garantit
  `Σsacs_i = totalSacs` exactement dans tous les cas testés (N=1, 2, 3,
  ex æquo sur `ordre`, ex æquo sur `id`, totalSacs=0, totalSacs=1 avec
  article à 0%) — jamais de dépassement (`51+51=102` explicitement rejeté
  par construction de l'algorithme, testé par le développeur et re-vérifié
  ici).
- **`copierAlimentsPrevisionDepuisProduits`** : déjà testée (par
  @developer, `previsions-scenarios.test.ts`) — rejette nommément
  (`/sans tailleGranule.*Granule sans calibre/`) et regroupe bien deux
  `Produit` de même `tailleGranule` en un seul calibre à 2 articles dont la
  somme des parts vaut 100. Je n'ai rien trouvé à ajouter ici, la couverture
  est déjà complète et le message d'erreur est bien actionnable (nomme le
  produit fautif), conforme à ADR-053 §12.2 arbitrage 5.
- **Aucune écriture partielle** en cas de rejet de validation (§8, §12.2
  arbitrage 3) : déjà testé par @developer
  (`previsions-aliments.test.ts`, "AUCUN nouvel article cree, part de
  l'existant intacte") — la validation est appelée **avant** toute écriture,
  et le tout est dans la même transaction Prisma interactive, donc même une
  écriture partielle antérieure au throw serait annulée par le rollback
  automatique. Confirmé par lecture du code (`addAlimentArticlePrevision`).

## 6. Bug trouvé — signalé, PAS corrigé (hors mandat @tester)

**`addAlimentArticlePrevision` — un payload malformé (`repartition` sans
exactement un élément sans `articleId`) retombe en 500, pas en 4xx.**

Le message levé par la query
(`"La repartition doit contenir exactement un element sans articleId (le
nouvel article) — obtenu : 0."`, `previsions-aliments.ts`) ne correspond à
**aucun** pattern de `PREVISIONS_STATUS_MAP` (`_shared.ts`) ni à aucun
pattern générique de `handleApiError` (`introuvable`, `Impossible`,
`n'appartient pas`, etc.). Reproduit et vérifié en isolation :

```ts
handleApiError("test", new Error("La repartition doit contenir exactement un element sans articleId (le nouvel article) — obtenu : 0."), "fallback", { statusMap: PREVISIONS_STATUS_MAP })
// -> status 500, console.error déclenché
```

C'est une erreur de saisie utilisateur (payload `repartition` mal formé
envoyé à `POST /api/previsions/aliments/[id]/articles`), pas une erreur
serveur — elle devrait produire un 400 ou 422, comme les autres violations
de saisie de ce module. Je n'ai **pas** ajouté cette entrée manquante à
`PREVISIONS_STATUS_MAP` (fichier de production, hors mandat de test), ni de
test qui échouerait délibérément dans la suite principale. Je le signale
explicitement au @project-manager pour triage — sévérité proposée
**Basse/Moyenne** (payload difficile à produire par erreur depuis l'UI
prévue, `repartition` est construit par un formulaire, pas saisi librement ;
mais un client API direct ou un bug futur du formulaire pourrait
l'atteindre, et un 500 masque le vrai problème).

## 7. Échec de suite complète — hors périmètre PR2q.4

`src/components/previsions/__tests__/aliment-form-dialog.test.tsx` échoue
(`TypeError: Cannot read properties of undefined (reading 'ok')`, dans
`src/components/previsions/aliment-form-dialog.tsx:98`, plusieurs rejets de
promesse non gérés). Ce fichier et le composant testé sont **untracked**
(nouveaux, non commités) — ils appartiennent au périmètre UI de la story
PR2q.5 (@developer), en cours de développement en parallèle. Conformément à
mon mandat, je n'ai touché **aucun fichier de `src/components/`** (ni code ni
tests) et je ne corrige pas ce défaut : je le signale au @project-manager. Ma
première exécution de la suite complète, avant d'ajouter mes propres tests,
donnait déjà 277 fichiers (ce fichier composant n'y figurait pas encore ou
n'était pas encore en échec) ; toutes mes exécutions suivantes le trouvent en
échec de façon reproductible (deux exécutions consécutives, même résultat) —
ce n'est pas un flake.

**Conséquence pour la déclaration de sortie du sprint** : la suite complète
n'est *pas* à 0 échec au moment de ce rapport, mais l'échec unique est
entièrement contenu dans le périmètre UI (PR2q.5), pas dans le moteur/
queries/API livrés par PR2q.4 — tous les fichiers que j'ai testés ou modifiés
(moteur `aliments.ts`/`validation.ts`, `route-orchestration.ts`, queries
`previsions-aliments.ts`/`previsions-scenarios.ts`, routes API) passent, ainsi
que la recette (1270/1270).

## 8. Verdict

- **Filet de sécurité (recette) : INTACT — 1270/1270, 0 écart.** Aucune
  fixture, aucune valeur attendue modifiée.
- **Modèle calibre/article (moteur, queries, routes) : correct** sur tous
  les axes vérifiés — somme article par article (jamais une moyenne),
  répartition Hare-Niemeyer sans dépassement et déterministe, remise au
  niveau calibre, `poidsSacKg` de référence cantonné à l'affichage,
  validation bloquante 100% dans la transaction, ergonomie §12.6 respectée
  (pas de `partApprovisionnementPct` exigée à la création à un seul
  article).
- **1 bug réel trouvé et signalé** (mapping HTTP 500 au lieu de 4xx sur un
  payload `repartition` malformé) — non corrigé, transmis au PM.
- **1 échec de suite complète, hors périmètre** (UI PR2q.5, `src/components/`)
  — non corrigé, transmis au PM.

Build : OK. Recette : OK. Moteur/queries/API PR2q.4 : OK. Suite complète :
**1 échec, hors périmètre de cette story.**
