# Pré-analyse Story PR2.4 — Vue Prévisions mensuelle et tableau de bord — 2026-08-03

## Statut : GO AVEC RÉSERVES

## Résumé

Le terrain applicatif est complet pour le périmètre strict de PR2.4 : la route de calcul
(`GET /api/previsions/scenarios/[id]/calculer`) renvoie déjà toutes les séries mensuelles, le point
bas de trésorerie et son mois, et un budget agrégé — corrigée des 3 bugs de sévérité Haute de PR2.2.
Les livrables transverses que PR2.4 doit réutiliser (formatteurs `format-previsions.ts`, composant
`ValeurCalculee`, dépendance `@radix-ui/react-popover`) **existent déjà sur disque**, livrés en avance
par le travail en cours de PR2.3 — aucune duplication à craindre si PR2.4 les importe directement au
lieu de les réécrire. Le point réellement délicat n'est pas l'API mais une question de sens : la
« trésorerie actuelle » du §7.2 n'a **aucune donnée réelle correspondante** dans le schéma (aucun
solde de caisse/compte n'existe nulle part dans le domaine farm-flow) — c'est un gap de même nature
que `dashboard.ts:218`, à ne pas combler en inventant un champ, mais à résoudre en tranchant que
« trésorerie actuelle » = le solde projeté du mois correspondant à aujourd'hui dans la même série que
le point bas, jamais une donnée du réel. `npm run build` échoue actuellement, mais pour une cause
strictement localisée au travail en cours de PR2.3 (un cast d'enum manquant dans un fichier WIP non
commité) — sans rapport avec PR2.4 et à ne pas confondre avec une régression de cette story.

## 1. Le contrat JSON réel de la route de calcul

Lu intégralement `src/app/api/previsions/scenarios/[id]/calculer/route.ts` et
`src/lib/previsions/route-orchestration.ts`.

### 1.1 Forme exacte de la réponse

```jsonc
{
  "scenarioId": "string",
  "horizonMois": number,                 // nb de mois total de la projection (0-based, dernier mois inclus)
  "mois": [
    {
      "moisAbsolu": number,               // 0 = scenario.dateDebutPlan
      "revenusFCFA": number,
      "coutAlimentsFCFA": number,
      "coutAlevinsFCFA": number,
      "baseRepartitionFCFA": number,
      "investissementsFCFA": number,
      "depensesFCFA": number,             // = coutAliments + coutAlevins + baseRepartition + investissements
      "apportsFCFA": number,
      "soldeFCFA": number,                // trésorerie CUMULÉE à ce mois (série complète, c'est LA courbe à tracer)
      "logistique": { "voyagesAliments": number, "voyagesPoissons": number, "voyagesAlevins": number, "sousTotalFCFA": number }
    }
    // ... un objet par mois, 0..horizonMois-1
  ],
  "vagues": [
    {
      "vaguePrevueId": "string", "code": "string", "statut": "PLANIFIEE|EN_COURS|REALISEE|NON_REALISEE|ANNULEE",
      "moisStockageAbsolu": number, "moisRecolteAbsolu": number,
      "coutAlimentFCFA": number, "coutAlevinsFCFA": number, "quotePartChargesFCFA": number,
      "coutProductionFCFA": number, "revenuPrevuFCFA": number, "biomasseKg": number,
      "alimentsParMois": [ { "alimentPrevisionId": "string", "moisCycle": number, "moisAbsolu": number,
                             "quantiteKg": number, "sacs": number, "montantFCFA": number } ]
    }
  ],
  "pointBas": { "pointBasFCFA": number, "moisAbsolu": number } | null,
  "budget": {
    "totalCoutsProductionFCFA": number, "totalChargesHorsProductionFCFA": number,
    "totalApportsFCFA": number, "budgetTotalFCFA": number
  }
}
```

Tous les `Decimal` sont convertis en `number` à la frontière (`n(value: Decimal)`, JSDoc explicite
« jamais un Decimal brut dans NextResponse.json ») — PR2.4 ne manipule donc jamais `decimal.js`
côté client, seulement des `number` déjà arrondis pour l'affichage (attention : ce sont des `number`
JS, pas des `Decimal` — les formatteurs `format-previsions.ts` acceptent déjà `number | string`,
donc compatibles tels quels).

`pointBas` peut être **`null`** — cas d'un scénario sans une seule ligne de données (aucune vague,
aucune charge). PR2.4 doit gérer explicitement ce cas dans le bandeau (état vide, pas un crash sur
`pointBas.pointBasFCFA`).

### 1.2 Confrontation aux besoins §7.2 (bandeau + tableau)

| Besoin §7.2 | Disponible directement | Calcul client nécessaire | Manque |
|---|---|---|---|
| Point bas de trésorerie (montant) | `pointBas.pointBasFCFA` | — | — |
| Mois où survient le point bas | `pointBas.moisAbsolu` (entier 0-based) | **Oui** : convertir `moisAbsolu` en date calendaire lisible (`scenario.dateDebutPlan + moisAbsolu mois`) — la route ne renvoie **aucune** date ni libellé de mois, seulement un entier relatif. `scenarioId` est renvoyé mais **pas `dateDebutPlan`** : cette route seule ne suffit pas à afficher un mois lisible, il faut aussi le `GET /api/previsions/scenarios/[id]` (détail scénario, expose `dateDebutPlan`) en parallèle. | — |
| Courbe de trésorerie sur l'horizon | `mois[].soldeFCFA` (déjà cumulé) + `mois[].moisAbsolu` | Même conversion moisAbsolu → date/libellé pour l'axe X | — |
| Trésorerie « actuelle » | **Rien de direct** | Voir section 2 — nécessite de localiser, côté client, le mois correspondant à « aujourd'hui » dans la série `mois[]`, PAS une donnée renvoyée telle quelle | Le concept de trésorerie réelle n'existe pas dans le domaine (section 2) |
| Budget total du plan | `budget.budgetTotalFCFA` | — | — |
| Revenu total prévu | Pas d'agrégat direct au niveau scénario | **Oui** : sommer `vagues[].revenuPrevuFCFA`, ou sommer `mois[].revenusFCFA` sur l'horizon | — |
| Coût total aliments | Pas d'agrégat direct | **Oui** : sommer `mois[].coutAlimentsFCFA` | — |
| Biomasse totale / tonnage à produire | Pas d'agrégat direct | **Oui** : sommer `vagues[].biomasseKg` | — |
| Nombre de vagues actives / planifiées | Pas de compteur direct | **Oui** : `vagues.length`, ou filtrer par `statut` | — |
| Nom/code du scénario, `dureeCycleMois`, `dateDebutPlan` | **Absent de cette route** | — | Nécessite un second appel : `GET /api/previsions/scenarios/[id]` (détail) — la route de calcul ne renvoie que `scenarioId`, pas le reste des métadonnées du scénario |
| Statut du scénario (BROUILLON/ACTIF/ARCHIVE) | Absent de cette route | — | Idem — détail scénario |

**Le risque principal demandé explicitement par la mission — trouvé** : la route de calcul ne
renvoie **ni le nom du scénario, ni sa `dateDebutPlan`, ni son statut**. Une page qui n'appellerait
QUE cette route ne peut pas afficher un titre de page correct ni convertir `moisAbsolu` en date
lisible. **PR2.4 doit composer deux appels côté Server Component** : le détail du scénario
(`getScenario`/`getScenarioById` de PR2.1, qui expose `dateDebutPlan`, `nom`, `statut`) et
`calculerProjectionScenario` (directement, pas via `fetch`, voir section 6) — jamais l'un sans
l'autre. Ce n'est pas un manque bloquant (les deux briques existent), mais un point de composition
que le @developer doit trancher explicitement, pas découvrir après coup en voyant un mois affiché
`"Mois 7"` au lieu d'une date.

**Second manque mineur, non bloquant** : aucun libellé humain de mois calendaire (« Nov. 2026 »)
n'est produit ni par la route de calcul ni par aucun helper existant du module Prévisions — à
construire dans PR2.4 elle-même (`dateDebutPlan` + `moisAbsolu` mois, via `date-fns` déjà une
dépendance du projet d'après les usages `formatDate` ailleurs — à vérifier par @developer, non
audité en détail ici).

## 2. La trésorerie « actuelle » — tranché

**Il n'existe aucune donnée de trésorerie réelle nulle part dans le schéma Prisma.** Vérifié par
recherche exhaustive : aucun modèle ne porte de solde de caisse/compte bancaire de l'exploitation.
Le seul champ `solde` du schéma est `PortefeuilleIngenieur.solde` (portefeuille de commission d'un
ingénieur platform, modèle métier totalement différent — abonnements/commissions, sans rapport avec
la trésorerie d'une exploitation piscicole). `src/lib/queries/dashboard.ts` et
`src/lib/queries/finances.ts` ne portent aucun concept de solde de trésorerie non plus (uniquement
des agrégats de `Vente`/`Depense`, pas un solde cumulé au sens comptable).

**Conséquence directe, à trancher explicitement comme un fait acquis, pas comme une question ouverte
pour @developer** : la « trésorerie actuelle » du bandeau ne peut être qu'une lecture de la **série
projetée elle-même** — le solde du mois de la série `mois[]` dont le `moisAbsolu` correspond au mois
calendaire courant (`moisAbsoluDepuis(scenario.dateDebutPlan, new Date())`), **pas** une valeur
provenant du réel. C'est cohérent avec :
- **ADR-053 §5.1**, sens unique : le module Prévisions ne lit jamais un solde réel qui n'existe pas,
  et ce module ne doit surtout pas en inventer un par la bande dans le tableau de bord.
- **ADR-053 §8.1**, le précédent `dashboard.ts:218` : un chiffre qui n'a pas de source réelle ne doit
  jamais être calculé silencieusement (`prixVenteKg: number | null = null` en dur) — ici, inventer un
  « solde de trésorerie réel » qui n'existe dans aucune table serait exactement la même faute.

**Cas limite à documenter dans les notes de clôture, pas à découvrir en test manuel** : si
`moisAbsoluDepuis(dateDebutPlan, aujourd'hui)` tombe **avant** le début de l'horizon (plan qui
commence dans le futur) ou **après** la fin de l'horizon (plan déjà entièrement passé), il n'existe
aucun mois « actuel » dans la série. Le bandeau doit alors afficher un état explicite (« hors
horizon du plan », pas un nombre inventé ni un crash sur un `mois[i]` `undefined`). Aucune route
existante ne calcule ce cas — c'est un bout de logique pure à écrire dans PR2.4 elle-même (candidat
naturel pour un petit helper `src/lib/previsions/format-previsions.ts` ou un fichier dédié
`tableau-de-bord-helpers.ts`, testable unitairement sans base de données).

**Libellé UI recommandé, pas juste cosmétique** : afficher quelque chose comme « Trésorerie projetée
au [mois calendaire courant] », jamais un intitulé qui laisserait croire à un solde de caisse réel
constaté — cohérent avec l'esprit du §5.1(b) de l'ADR (« l'UI ne doit jamais laisser croire à une
photo figée » — même logique inversée ici : ne jamais laisser croire à une donnée réelle qui n'existe
pas).

## 3. Recharts — état réel du dépôt

**Version installée : `recharts@3.8.0`** (`package.json`, confirmé). Patron systématique dans tout
le dépôt (`src/components/dashboard/projections.tsx`, `src/components/finances/finances-dashboard-client.tsx`,
`src/components/reproduction/ponte-timeline-chart.tsx`) : **tous les sous-composants Recharts sont
chargés via `next/dynamic` avec `{ ssr: false }`**, jamais un `import { ... } from "recharts"`
statique en haut de fichier — c'est une contrainte du dépôt (pas de SSR pour Recharts, dépendances
`window`/`document`). PR2.4 doit répliquer ce patron pour chaque sous-composant utilisé
(`ResponsiveContainer`, `AreaChart` ou `ComposedChart`, `Area`, `XAxis`, `YAxis`, `CartesianGrid`,
`Tooltip`, `ReferenceLine`).

Couleurs systématiquement via variables CSS du thème (`stroke="var(--primary)"`,
`fill="var(--accent-red)"`, etc.) — jamais de couleur en dur (R6), déjà respecté partout.

### 3.1 Colorer la zone sous zéro — aucun précédent direct, mais un patron de gradient existe

**Aucun `ReferenceArea` ni gradient split-au-zéro n'existe dans le dépôt** (vérifié par recherche
exhaustive de `ReferenceArea`/`linearGradient`/`<Area`/`AreaChart`). Deux précédents partiels
existent, tous deux des gradients **simples** (une seule couleur, dégradé d'opacité, pas de bascule
de couleur à une valeur seuil) :
- `src/components/reproduction/ponte-timeline-chart.tsx` (`AreaChart` + `linearGradient` à 2 stops
  de la même teinte, opacité 0.3→0 du haut vers le bas).
- `src/components/finances/finances-dashboard-client.tsx` (3 `linearGradient`, un par série,
  même patron opacité simple).

**Aucun des deux ne résout « zone sous zéro colorée différemment »** — c'est un besoin nouveau pour
ce module, à construire, pas à copier tel quel. Avec Recharts 3.8.0, la technique standard pour
colorer différemment au-dessus et en dessous d'un seuil (ici zéro) sur une **même** courbe continue,
sans segmenter les données en deux séries, est le **gradient à `offset` calculé dynamiquement** :

```tsx
// offset = position (0..1) du zéro dans l'intervalle [min, max] du domaine Y affiché
const offset = maxSolde <= 0 ? 0 : minSolde >= 0 ? 1 : maxSolde / (maxSolde - minSolde);

<defs>
  <linearGradient id="gradTresorerie" x1="0" y1="0" x2="0" y2="1">
    <stop offset={0} stopColor="var(--accent-green)" stopOpacity={0.35} />
    <stop offset={offset} stopColor="var(--accent-green)" stopOpacity={0.35} />
    <stop offset={offset} stopColor="var(--accent-red)" stopOpacity={0.35} />
    <stop offset={1} stopColor="var(--accent-red)" stopOpacity={0.35} />
  </linearGradient>
</defs>
<Area dataKey="soldeFCFA" stroke="var(--primary)" fill="url(#gradTresorerie)" />
```

C'est la technique éprouvée et largement documentée pour Recharts (aucune fonctionnalité native
« couleur conditionnelle au signe » n'existe côté `Area`/`Line` — le gradient à offset calculé est le
contournement standard, indépendant de la version 2.x/3.x). Une alternative plus simple mais moins
précise visuellement est un unique `ReferenceArea` `y1={minSolde} y2={0}` en fond rouge translucide
posé **sous** la courbe (pas sur la courbe elle-même) — fonctionne, mais ne teinte pas l'aire remplie
sous la courbe elle-même, seulement le fond du graphique entre deux lignes horizontales. **Recommandation** :
le gradient à offset est la bonne réponse à l'exigence « zone sous zéro colorée », le `ReferenceArea`
seul ne suffit pas visuellement à isoler précisément la portion de la courbe qui plonge sous zéro.
Ajouter aussi une `ReferenceLine y={0}` (déjà un pattern connu du dépôt, `projections.tsx`) pour
matérialiser explicitement l'axe zéro — utile en complément du gradient, pas un substitut.

**Aucune nouvelle dépendance requise** — Recharts 3.8.0 supporte nativement `<linearGradient>`/`<stop offset>` (SVG standard, pas une API Recharts spécifique) et `ReferenceLine`/`ReferenceArea` (déjà importés ailleurs dans le dépôt).

## 4. Réutilisation depuis PR2.3 — déjà livré, à consommer tel quel

**Contrairement à ce que la pré-analyse de PR2.3 anticipait comme travail restant, ces deux
livrables transverses existent déjà sur disque au moment de cette pré-analyse** (travail en cours de
PR2.3, non commité mais présent dans le working tree) :

- `src/lib/previsions/format-previsions.ts` : `formatMontantPrevision`, `formatEntierPrevision`,
  `formatPourcentagePrevision`, `formatTonnagePrevision`, `classeMontant` — exactement les règles
  §7.4 (0 décimale montants, zéro → « – », 1 décimale %/tonnage, `text-danger` sur négatif porté par
  `classeMontant`, pas par la fonction de formatage). **PR2.4 doit importer ce fichier directement,
  ne jamais redéfinir ses propres formatteurs.**
- `src/components/previsions/valeur-calculee.tsx` : composant `ValeurCalculee` (Popover Radix,
  clic/clavier, style neutre `bg-muted`/`text-muted-foreground`). **Directement réutilisable pour le
  tableau de bord** : chaque indicateur du bandeau qui résulte d'un calcul (point bas, budget total,
  revenu prévu total) est un candidat naturel à envelopper dans `ValeurCalculee` plutôt que d'afficher
  un chiffre nu — cohérent avec §7.4 qui ne restreint pas l'exigence d'explicabilité aux seuls écrans
  de saisie.
- `@radix-ui/react-popover@^1.1.23` déjà ajouté à `package.json` — aucune dépendance supplémentaire à
  déclarer pour l'explicabilité.
- `src/components/previsions/api-types.ts` : DTOs pour les routes CRUD (scénario, aliments, vagues
  prévues, postes, charges, apports) — **utile pour le tableau mensuel** (détail scénario) mais **ne
  couvre pas la forme de la réponse de la route de calcul** (`ProjectionScenarioResult` sérialisé) :
  PR2.4 devra ajouter ses propres types locaux pour `mois[]`/`vagues[]`/`pointBas`/`budget` (aucun
  DTO existant ne les documente encore) — à faire dans le même esprit que `api-types.ts` (documenter
  la forme réelle qui traverse le fil JSON, pas dupliquer `route-orchestration.ts`).

**Risque de coordination signalé, pas bloquant** : ces fichiers appartiennent au périmètre de PR2.3
(`TODO` selon `SPRINT-PR2-PREVISIONS.md`, mais du code existe déjà dessus dans le répertoire de
travail au moment de cette lecture). Si PR2.4 démarre avant que PR2.3 ait figé ces deux fichiers
(nom de props, signature), un changement ultérieur de `ValeurCalculee`/`format-previsions.ts` par
PR2.3 pourrait casser silencieusement PR2.4 sans qu'aucune des deux stories ne s'en aperçoive avant
un `npm run build`/`npx vitest run` global. **Recommandation** : @developer de PR2.4 vérifie l'état de
ces deux fichiers juste avant de commencer (ils sont normalement stables — ce sont des livrables
transverses écrits en premier, avant les écrans, selon la pré-analyse PR2.3 §2 point 4), et signale
immédiatement au PM tout changement de signature constaté en cours de route plutôt que de le
découvrir via un échec de build tardif.

## 5. L'exigence des 10 secondes (§7.1)

Ce que ça implique concrètement, vérifiable sans ambiguïté :
- **Aucun scroll requis à 360px pour voir** : (a) le point bas + son mois, (b) le statut global
  (trésorerie qui reste positive vs qui plonge), (c) au moins le début de la courbe. Le bandeau
  d'indicateurs et le haut du graphique doivent tenir dans le premier écran mobile sans interaction.
- **Priorité visuelle stricte** : le point bas de trésorerie et la courbe doivent être visuellement
  dominants (taille, position en haut) — pas un indicateur parmi 6 de taille égale. Cohérent avec la
  consigne explicite du sprint (« priorité visuelle au point bas et à la courbe, pas au détail »).
- **Pas plus de 4-6 nombres à lire d'un coup** — au-delà, la lecture en 10 secondes n'est plus
  vérifiable qualitativement par le @tester (un bandeau à 10 indicateurs équivalents n'est pas
  « scannable » en 10 secondes, quel que soit le layout).

**Proposition de 4 à 6 indicateurs du bandeau, avec calculabilité vérifiée** :

| # | Indicateur | Source | Calculable aujourd'hui ? |
|---|---|---|---|
| 1 | Trésorerie actuelle (projetée au mois courant) | `mois[moisCourant].soldeFCFA` | Oui, avec la logique de repli du cas limite (section 2) |
| 2 | Point bas projeté + mois | `pointBas.pointBasFCFA` + `pointBas.moisAbsolu` (converti en date via `dateDebutPlan` du détail scénario) | Oui, en composant les deux routes (section 1.2) |
| 3 | Budget total du plan | `budget.budgetTotalFCFA` | Oui, direct |
| 4 | Revenu total prévu sur l'horizon | Somme de `mois[].revenusFCFA` (ou `vagues[].revenuPrevuFCFA`) | Oui, calcul client trivial (réduction, pas une formule métier) |
| 5 | Nombre de vagues actives sur le plan | `vagues.length` (filtré hors `ANNULEE`, déjà exclues par la route elle-même — `route-orchestration.ts` filtre `statut !== ANNULEE` en amont) | Oui, direct |
| 6 (optionnel, 6e) | Biomasse totale prévue (tonnage) | Somme de `vagues[].biomasseKg`, affichée via `formatTonnagePrevision` | Oui, calcul client trivial |

Les indicateurs 1 et 2 sont les deux **non négociables** explicitement exigés par la story ; 3-4-5
comblent le §7.2 (budget, revenu, activité du plan) sans inventer de donnée absente ; 6 est un bon
candidat si le bandeau vise 6 plutôt que 4. Aucun de ces 6 indicateurs ne requiert une donnée
manquante côté API — tous sont soit directs, soit une réduction pure côté client sur des données déjà
renvoyées.

## 6. Performance et chargement

**Patron confirmé partout ailleurs dans le dépôt (`finances/page.tsx`, `vagues/page.tsx`)** : la page
est un **Server Component async** qui appelle les **queries/fonctions du moteur directement**
(`Promise.all` de plusieurs `getXxx(siteId)`), **jamais un `fetch` vers sa propre route API** depuis
le Server Component. `calculerProjectionScenario` est déjà une fonction pure exportée de
`src/lib/previsions/route-orchestration.ts` — **PR2.4 doit l'appeler directement**, précédée de
`chargerScenarioPourMoteur(scenarioId, siteId)` (la même paire déjà utilisée par la route elle-même),
exactement comme `finances/page.tsx` appelle `getResumeFinancier` sans passer par `/api/finances`.
**Ne PAS faire un `fetch("/api/previsions/scenarios/[id]/calculer")` depuis le Server Component** —
ce serait un aller-retour HTTP inutile vers soi-même, contraire au patron du dépôt.

Le calcul rejoue toute la projection (21 mois sur le jeu d'or) à chaque chargement de page — ce n'est
**pas mis en cache** aujourd'hui (ni côté route API, qui est explicitement documentée « lecture pure,
ne persiste rien », ni côté query). Sur le jeu d'or (19 vagues, 21 mois, 3 granulométries), le coût
est une boucle en mémoire sur des `Decimal` — pas d'I/O dans la boucle elle-même (le moteur est pur),
donc a priori rapide (millisecondes), mais **non mesuré ici** : aucun test de performance/benchmark
n'existe sur `calculerProjectionScenario` à ce jour. **Risque signalé, pas un blocage** : si un
scénario grossissait bien au-delà du jeu d'or (ex. 100+ vagues, horizon de plusieurs années), le
recalcul complet à chaque navigation vers le tableau de bord deviendrait un candidat naturel à la
mise en cache — hors périmètre de cette story (MVP), mais un point à surveiller si le @tester
constate un temps de réponse notable en recette manuelle. Pas de recommandation de résoudre ce risque
dans PR2.4 : le mettre en note pour un futur sprint si le besoin se confirme en usage réel.

**Client Component pour le graphique uniquement** (contrainte SSR de Recharts, section 3), pas pour
le chargement des données — le patron `finances-dashboard-client.tsx` (Server Component charge,
passe tout en props à un unique gros Client Component qui contient à la fois les `KPICard` et
les graphiques) est directement transposable.

## 7. Vérifications exécutables

- **`npm run build`** : **ÉCHEC**, mais localisé et sans rapport avec PR2.4. Erreur TypeScript dans
  `src/components/pages/previsions-scenarios-page.tsx:27` (`Type '"ACTIF"' is not assignable to type
  'StatutScenarioPrevision'`) — un cast d'enum manquant (`s.statut` doit être écrit
  `s.statut as StatutScenarioPrevision`, exactement le patron déjà appliqué correctement dans
  `src/lib/queries/previsions-scenario-loader.ts:240/289`). **Ce fichier appartient au périmètre de
  PR2.3 (statut `TODO` dans le sprint mais du travail est déjà en cours dans le répertoire), pas à
  PR2.4** — c'est un travail en cours d'un autre agent, pas une régression de cette pré-analyse ni un
  problème à corriger ici. À signaler au @developer de PR2.3, pas au @developer de PR2.4. Le
  précédent correct (`as StatutScenarioPrevision`) existe déjà dans le dépôt — la correction est
  triviale une fois identifiée.
- **`npx vitest run`** : **6870 tests passés / 19 skipped / 26 todo / 0 échec** (247 fichiers passés,
  4 skipped sur 251) — **identique à la ligne de base attendue**, aucune régression détectée.
- **Recette moteur** : non ré-exécutée isolément dans cette pré-analyse (aucune modification de code
  n'a été faite ni prévue par cette pré-analyse elle-même), mais les 842 tests de recette sont inclus
  dans le total ci-dessus et passent (0 échec sur l'ensemble). Le @tester devra la revérifier
  explicitement après implémentation de PR2.4, conformément à la contrainte transverse du sprint
  (« le moteur est intouchable » — PR2.4 ne le touche de toute façon pas, elle ne fait que consommer
  `route-orchestration.ts` en lecture).

## 8. Verdict — GO AVEC RÉSERVES

**GO pour démarrer PR2.4.** Aucun manque d'API ne bloque structurellement le bandeau ni le graphique
de trésorerie — tous les indicateurs proposés (section 5) sont calculables avec les données déjà
renvoyées par `GET /api/previsions/scenarios/[id]/calculer` composée avec le détail du scénario.

**Points que le @developer devra trancher explicitement, pas découvrir en cours de route :**

1. **Composer deux appels, pas un seul** : la route de calcul ne renvoie ni `nom`, ni `dateDebutPlan`,
   ni `statut` du scénario — le Server Component doit charger le détail du scénario (PR2.1) **et**
   appeler `calculerProjectionScenario` (directement, pas via `fetch`, section 6), jamais l'un sans
   l'autre.
2. **Trésorerie actuelle = solde projeté du mois courant dans la série, jamais une donnée réelle**
   (section 2) — aucun solde de trésorerie réel n'existe dans le schéma farm-flow ; documenter ce
   choix dans les notes de clôture de la story, avec le libellé UI qui ne laisse pas croire à une
   donnée réelle constatée. Gérer explicitement le cas où le mois courant tombe hors de l'horizon du
   plan (avant le début ou après la fin) — état explicite, jamais un accès `mois[i]` non défini.
3. **Technique de coloration de la zone sous zéro** : gradient SVG à `offset` calculé dynamiquement
   depuis min/max de la série (`maxSolde / (maxSolde - minSolde)`), pas de fonctionnalité native
   Recharts pour ça — aucun précédent direct dans le dépôt, mais aucune nouvelle dépendance requise
   (SVG standard). Compléter avec une `ReferenceLine y={0}`, patron déjà utilisé ailleurs.
4. **Réutiliser tel quel** `format-previsions.ts` et `ValeurCalculee` (déjà livrés par le travail en
   cours de PR2.3) plutôt que de les redévelopper — vérifier leur stabilité de signature juste avant
   de commencer PR2.4, et signaler tout changement constaté en cours de route au PM.
5. **Convertir `moisAbsolu` en libellé de mois calendaire lisible** (« Nov. 2026 ») : aucun helper
   existant ne le fait aujourd'hui pour ce module — à écrire dans PR2.4, à partir de
   `scenario.dateDebutPlan` + l'entier `moisAbsolu`.
6. Le `npm run build` actuellement en échec (`previsions-scenarios-page.tsx`) est un problème du
   périmètre PR2.3 en cours, sans rapport avec PR2.4 — ne pas le confondre avec une régression
   introduite par cette pré-analyse ou par un futur travail de PR2.4 ; le signaler au bon agent.

**Aucun manque d'API ne bloque un écran prévu par le périmètre de PR2.4** — les seuls ajustements
nécessaires sont des compositions/calculs côté client (agrégations simples, conversions de mois en
date) documentés ci-dessus, pas de nouvelle route ni de modification du moteur.
