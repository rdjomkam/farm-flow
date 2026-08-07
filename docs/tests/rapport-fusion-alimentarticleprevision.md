# Rapport @tester — Correction des tests apres fusion AlimentArticlePrevision -> AlimentPrevision

## Contexte

Le modele `AlimentArticlePrevision` a ete fusionne dans `AlimentPrevision` :
chaque calibre porte desormais directement `produitId`, `libelle`,
`poidsSacKg`, `prixSacFCFA`, `sacsParTonneUnitaire`. `partApprovisionnementPct`,
`repartirSacsEntreArticles`, `validerSommeApprovisionnementArticles`,
`poidsSacKgReference`, `AlimentPrevisionWithArticles`,
`createAlimentPrevisionAvecArticle` (renomme `createAlimentPrevision`),
`addAlimentArticlePrevision`, `updateAlimentArticlePrevision` et les routes API
`POST .../articles` / `PATCH .../articles/[articleId]` ont disparu du code
source. 54 tests etaient rouges suite a cette fusion, repartis sur 14 fichiers.

## Perimetre traite

1 fichier supprime, 12 fichiers de test adaptes (fixtures + assertions), aucun
fichier source touche.

### Supprime
- `src/__tests__/api/previsions-aliments-articles-routes.test.ts` (routes disparues)

### Adaptes
- `src/lib/previsions/__tests__/aliments.test.ts` — suite `repartirSacsEntreArticles` retiree
- `src/lib/previsions/__tests__/validation.test.ts` — suite `validerSommeApprovisionnementArticles` retiree
- `src/__tests__/lib/previsions-route-orchestration.test.ts` — fixtures `articles[]` -> champs plats sur l'aliment ; suite "N articles d'un meme calibre" supprimee (le cas n'existe plus)
- `src/lib/previsions/__tests__/route-orchestration-detail-consommation.test.ts` — fixture `articles[]` -> champs plats
- `src/lib/previsions/__tests__/route-orchestration-remise-ordre.test.ts` — idem
- `src/lib/previsions/__tests__/recette/route-orchestration-builder.ts` (helper partage) — `buildAliments` construit desormais les champs article directement sur le calibre
- `src/__tests__/api/previsions-auth-permissions.test.ts` — mock `createAlimentPrevisionAvecArticle` -> `createAlimentPrevision`, body POST envoie les champs plats au lieu d'un sous-objet `article`
- `src/__tests__/api/previsions-cross-site-and-serialization.test.ts` — fixture mock `articles[]` -> champs plats
- `src/lib/queries/__tests__/previsions-aliments.test.ts` — reecrit : tests de `createAlimentPrevision`/`updateAlimentPrevision` (les tests d'`addAlimentArticlePrevision`, fonction supprimee, ont ete retires)
- `src/lib/queries/__tests__/previsions-scenarios.test.ts` — assertions qui cherchaient des `AlimentArticlePrevision` en DB adaptees pour lire les champs directement sur `AlimentPrevision` ; les scenarios "2 produits meme tailleGranule -> 2 articles" corriges en "1 seul calibre retenu, le premier alphabetique" (nouveau comportement de `copierAlimentsPrevisionDepuisProduits`)
- `src/lib/queries/__tests__/previsions-scenario-loader.test.ts` et `previsions-scenario-loader-tauxepargne-e2e.test.ts` — fixtures `articles[]` -> champs plats sur l'aliment

### Fichier de support (non liste dans la tache initiale, necessaire pour que les tests passent)
- `src/lib/queries/__tests__/previsions-fake-db.ts` — retrait du store `alimentArticlePrevision` et du resolver d'include `articles` (fake Prisma partage par les tests de queries `previsions-*`)

## Verification

- `npx vitest run` : **0 echec**, 9683 tests passes, 68 skipped (DB-gated, non concernes), 26 todo.
  - avant correction : 54 tests en echec sur 14 fichiers.
- `npm run build` : succes, aucune erreur TypeScript/Next.

## Points d'attention pour la suite

- Le comportement de `copierAlimentsPrevisionDepuisProduits` a change de
  semantique observable (pas seulement de forme) : deux `Produit` partageant
  la meme `tailleGranule` ne produisent plus deux articles sous un meme
  calibre avec repartition des parts — seul le premier alphabetiquement est
  copie, les autres sont silencieusement ignores. Les tests refletent ce
  nouveau comportement (`docs/tests` -> voir `previsions-scenarios.test.ts`,
  describe `createScenario`) ; a signaler a l'UI si un ecran affichait
  auparavant la repartition entre plusieurs marques d'un meme calibre.
- Un warning `[DecimalError] Invalid argument: undefined` apparait dans les
  logs stderr de `previsions-cross-site-and-serialization.test.ts` (chemin
  `calculerEpargne` / `tresorerie.ts`) sur un test qui exerce volontairement
  une reponse d'erreur de la route `GET /scenarios/[id]/calculer` (fixture
  minimale). Le test concerne reste vert (l'erreur est catchee par
  `handleApiError`) — signale ici par prudence, hors perimetre de cette tache
  (pas de fixture `articles`/`AlimentArticlePrevision` en cause).
