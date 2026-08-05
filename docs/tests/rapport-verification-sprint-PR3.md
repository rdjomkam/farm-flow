# Rapport de vérification — Sprint PR3 (Rapprochement prévu/réel)

**Rôle :** @tester — vérification, pas embellissement. Tout chiffre ci-dessous a été mesuré,
pas recopié d'une annonce.

**Date :** 2026-08-05
**Périmètre livré à vérifier :** moteur pur (`src/lib/previsions/rapprochement.ts`,
`rapprochement-vagues.ts`), queries de lecture du réel
(`src/lib/queries/previsions-rapprochement*.ts`, `previsions-cloture.ts`,
`previsions-snapshot-budget.ts`), routes API (mapping-rapprochement, clôtures), UI (onglet
Rapprochement, 4 vues, `/previsions/scenarios/[id]`), + 3 dettes soldées (trésorerie initiale,
ERR-162, ERR-165).

---

## 1. `npx prisma migrate deploy`

```
170 migrations found in prisma/migrations
No pending migrations to apply.
```

Aucune erreur. Schéma à jour.

---

## 2. `npx vitest run` — trois passages consécutifs

| Passage | Fichiers de test | Tests | Skipped | Todo | Échecs |
|---|---|---|---|---|---|
| 1 | 292 passed / 10 skipped (302) | 9339 passed | 35 | 26 | **0** |
| 2 | 292 passed / 10 skipped (302) | 9339 passed | 35 | 26 | **0** |
| 3 | 292 passed / 10 skipped (302) | 9339 passed | 35 | 26 | **0** |

Les trois passages sont **strictement identiques** (mêmes compteurs à l'unité près). Aucune
instabilité détectée sur ces trois exécutions. 0 échec sur les trois passages.

Durées : ~13.4–13.8 s par passage (transform/import/tests inclus) — pas de signal d'instabilité
temporelle notable.

---

## 3. Recette du module Prévisions

Pas de script `npm run recette` (confirmé en pré-analyse). Exécution isolée du dossier recette :

```
npx vitest run src/lib/previsions/__tests__/recette/
```

Résultat :

```
✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (480 tests)
✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (480 tests)
✓ src/lib/previsions/__tests__/recette/route-orchestration-baseRepartition.recette.test.ts (209 tests)
✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (1540 tests)

Test Files  4 passed (4)
     Tests  2709 passed (2709)
```

**2709 tests passés, 0 écart** — conforme au seuil annoncé (≥ 2709).

**Réserve honnête sur le mot « assertions » :** les fonctions de comparaison du dossier recette
(`expectEntierExact`, `expectMontantFCFA`, `expectKgApprox` dans `helpers.ts`) n'utilisent pas
`expect()` de vitest — elles font un `throw new Error(...)` manuel en cas d'écart. Vitest ne
compte donc que des **tests** (`it(...)`, generés dynamiquement en boucle dans ces 4 fichiers),
pas un compteur d'assertions distinct. Je ne peux pas produire un compte d'« assertions » séparé
et fiable, différent du compte de tests — je rapporte donc 2709 **tests** passés, 0 échec, ce qui
est le seul chiffre que j'ai réellement mesuré. Si le nombre annoncé de « 2709 assertions »
correspond en réalité au nombre de tests généré par ces boucles, il est cohérent avec ce que j'ai
mesuré ; je ne peux pas aller plus loin sans compter manuellement chaque appel `expectXxx(...)`
dans chaque itération de boucle, ce que je n'ai pas fait.

---

## 4. `npm run build`

Succès. Sortie complète parcourue (liste des routes générées, y compris
`/previsions/scenarios`, `/previsions/scenarios/[id]`) ; aucune ligne contenant `error`, `failed`
ou `✗` dans la sortie complète (`grep -iE "error|failed|✗"` → 0 correspondance).

---

## 5. Intégrité du plan de référence EXCEL-V12

Audit rejoué en lecture seule : `npx tsx scripts/audits/tst-audit-excel-v12-empreinte.ts`
(`DATABASE_URL` lu depuis `.env` via `process.env`, R11 respecté — aucun identifiant en dur dans
aucune commande).

Diff structurel strict entre l'empreinte AVANT sprint
(`excel-v12-empreinte-avant.json`, fournie) et l'empreinte APRÈS (rejouée maintenant), clé par
clé, valeur par valeur :

**Seule différence trouvée :**
```
KEY ONLY IN AFTER: root.parametres.tresorerieInitialeFCFA = 0.000000000000000000000000000000
```

C'est exactement la différence légitime annoncée (nouveau champ ajouté par migration avec
`DEFAULT 0`). Aucune autre différence, nulle part.

Vérification explicite point par point (valeur attendue → valeur constatée, identique
avant/après) :

| Point | Attendu | Constaté (avant = après) |
|---|---|---|
| VaguePrevue | 19 vagues / 602 500 alevins | `nb: 19, total_alevins: "602500"` ✅ |
| AlimentPrevision (calibres) | 3 calibres | G1, G2, G3 présents, `sacsParTonneStandard` 8/18/50, `ordre` 0/1/2 ✅ |
| Répartitions par calibre | G1 80/20/0, G2 20/80/0, G3 0/40/60 | présentes dans `repartitionMoisAliment`, identiques avant/après (aucun diff structurel signalé sur cette clé) ✅ |
| PalierRemise | 4 paliers, seuils 0/5/10/15 t → 0/2/4/6 % | `seuilTonnes` 0/5/10/15, `pourcentageRemise` 0/2/4/6, ordre 1-4 ✅ |
| ApportCapital | 7 lignes, total 30 000 000 | `nb: 7, total: "30000000..."` ✅ |
| JournalDepensePrevue | 5 lignes, total 34 400 000 | `nb: 5, total: "34400000..."` ✅ |
| ChargeMensuellePrevue | 4 postes × 21 mois, total 20 580 000 | `nb_lignes: 84, total: "20580000..."` ✅ (4×21=84 cohérent) |
| ParametresPrevision (colonne par colonne) | identique sauf `tresorerieInitialeFCFA` nouveau à 0 | seule différence trouvée = ce champ ; toutes les autres colonnes (effectifAlevinsParVague, marges, poids, prix, capacités transport, coûts transport, tauxEpargnePct, alevinsAchetesParDefaut, `updatedAt`…) identiques bit à bit ✅ |
| ScenarioPrevision | code/nom/dureeCycleMois/dateDebutPlan/statut/siteId/timestamps inchangés | tous identiques, **`updatedAt` n'a PAS bougé** (`2026-08-03T18:10:26.493Z` avant et après) ✅ |

### Verdict : **INTÈGRE**

Aucune altération détectée. La seule divergence entre les deux empreintes est l'apparition
attendue de `tresorerieInitialeFCFA = 0` (migration avec DEFAULT), rien d'autre.

Note en marge (non anormale) : `clotureMois_count` et `mappingRapprochement_count_for_site`
valent `{nb: 0}` avant et après — le scénario EXCEL-V12 n'a aucune clôture ni aucun mapping de
rapprochement, avant comme après le sprint. Voir §6 pour l'impact de ce fait sur la vérification
navigateur.

---

## 6. Vérification navigateur réelle (ERR-157)

Playwright est installé (`@playwright/test` en devDependency, `playwright.config.ts` présent,
serveur dev déjà lancé sur `:4200`). J'ai écrit un script Playwright ad hoc (hors dossier de test,
supprimé après usage, aucun commit) qui : se connecte (`admin@dkfarm.cm` / `admin123`), sélectionne
le site actif, navigue vers `/previsions/scenarios/cmsdnypml0000n4ekuadykn0f` (EXCEL-V12, seul
scénario présent en base), ouvre l'onglet Rapprochement, à 375 px puis à 1280 px.

### Constats à 375 px
- Pas de débordement horizontal : `document.documentElement.scrollWidth` (375) ==
  `clientWidth` (375).
- Onglet « Rapprochement » trouvé et cliquable, texte lisible, bouton bottom-nav atteignable.
- Aucun `NaN`, `Infinity`, `undefined`, `null` détecté dans le texte de la page.
- Le contenu affiché est un état vide explicite : **« Aucun rapprochement disponible pour ce
  scénario (aucun mois dans l'horizon, ou la projection n'a pas pu être calculée). »** — pas de
  disparition silencieuse, message clair. Capture : voir description ci-dessous.

### Constats à 1280 px
- Les 9 onglets du scénario (Tableau de bord, Prévisions, Paramètres, Granulométries, Plan des
  vagues, Charges, Journal, Apports, **Rapprochement**) s'affichent tous, sidebar desktop visible,
  pas de débordement.
- Le contenu de l'onglet Rapprochement est le **même état vide** qu'à 375 px.

### Limite factuelle — ce que je n'ai PAS pu vérifier

**Je n'ai pas pu observer le contenu réel des 4 vues (mensuelle, cumulée, par vague, top écarts),
le sélecteur de mois, le bac « Non rapproché » peuplé, ni le bandeau de fraîcheur — parce que la
seule base de données disponible ne contient aucune donnée permettant de les déclencher.**

Vérifié dans le code (`src/components/previsions/rapprochement-tab.tsx` lignes ~49-71) : l'état
vide (`rapprochement.moisDisponibles.length === 0`) court-circuite l'affichage *avant* le rendu du
bandeau de fraîcheur et des 4 vues — ce n'est donc pas une garantie cassée, c'est une garantie que
mon environnement de test n'a structurellement pas les données pour exercer. Confirmé en base
(lecture seule) : EXCEL-V12 a `clotureMois_count = 0` et `mappingRapprochement_count_for_site = 0`
avant et après le sprint — aucun mois clôturé, aucun mapping créé, et c'est le seul scénario
présent dans la base (`SELECT * FROM "ScenarioPrevision"` → 1 ligne).

Le texte du bandeau de fraîcheur existe bel et bien dans le code
(`src/messages/fr/previsions.json` clé `freshnessNote` : *« Le "réel" affiché reflète l'état des
données au moment de cette consultation ({date}), pas une photo figée d'un import passé. »*) mais
je n'ai pas pu l'observer rendu à l'écran, faute de données déclenchant ce chemin.

**Ce n'est pas une validation de complaisance : je le déclare explicitement comme angle mort.**
Pour lever cet angle mort, il faudrait soit (a) une clôture de mois + des relevés réels rattachés
via `MappingRapprochement` sur un scénario de test (pas sur EXCEL-V12, protégé), soit (b) des
fixtures/tests Playwright dédiés qui montent cet état via l'API avant de visiter la page — aucun
des deux n'existe actuellement dans le dépôt (`src/__tests__/e2e/` ne contient que
`conservation-flow.spec.ts`, rien sur le rapprochement).

### Aucune erreur console
Aucune erreur console JS interceptée pendant la navigation, à 375 px comme à 1280 px.

---

## 7. Synthèse — ce qui a échoué / ce qui n'a pas pu être vérifié

**Rien n'a échoué** parmi ce qui a pu être exécuté :
- `prisma migrate deploy` : OK, aucune migration en attente.
- `vitest run` × 3 : identiques, 9339/9339 tests verts, 0 échec, aucune instabilité.
- Recette isolée : 2709/2709 tests verts, 0 écart.
- `npm run build` : succès.
- Intégrité EXCEL-V12 : **INTÈGRE**, un seul écart et c'est l'écart attendu.
- Layout 375 px / 1280 px de l'onglet Rapprochement (état vide) : correct, pas de débordement,
  pas de valeurs cassées, message explicite au lieu d'un silence.

**Ce qui n'a PAS pu être vérifié (angle mort déclaré, pas dissimulé) :**
- Le rendu réel des 4 vues du rapprochement (mensuelle, cumulée, par vague, top écarts), le
  sélecteur de mois fonctionnel, le bac « Non rapproché » peuplé et visible, et le bandeau de
  fraîcheur affiché — faute de toute donnée de rapprochement en base (aucune clôture, aucun
  mapping, sur le seul scénario existant). Le code source montre que ce chemin existe et est
  distinct du chemin vide observé, mais je ne l'ai pas exercé en navigateur réel.
- Le compte d'« assertions » distinct du compte de « tests » dans la recette (voir §3) — je
  rapporte 2709 tests/0 échec, mesuré ; je ne certifie pas un chiffre d'assertions séparé que je
  n'ai pas compté.

**Réplication pour lever l'angle mort du §6** (recommandation, pas exécutée par moi — je
n'écris pas en base) : créer un scénario de test dédié distinct d'EXCEL-V12 (jamais sur
EXCEL-V12, en lecture seule stricte), y attacher une VaguePrevue liée à une vraie Vague avec des
Relevés, créer une ClotureMois et des MappingRapprochement via l'API, puis rejouer ce même script
Playwright sur ce scénario de test.

**Mise à jour du 2026-08-05 : l'angle mort ci-dessus est levé.** Voir §8 ci-dessous.

---

## 8. Vérification navigateur sur données peuplées (levée de l'angle mort §6)

**Contexte :** le §6 déclarait ne pas avoir vu les 4 vues du Rapprochement rendues avec des
données réelles, faute de tout mapping/clôture sur le seul scénario existant (EXCEL-V12).
Mission ciblée pour combler cet angle mort : construire un scénario de démonstration jetable,
isolé, vérifier le rendu réel en Chromium, puis nettoyer intégralement.

### 8.1 Construction du scénario de démonstration

Isolation totale — **jamais sur EXCEL-V12** : `MappingRapprochement` est scopé au `siteId` (pas
au scénario), donc un mapping créé sur le site d'EXCEL-V12 aurait altéré son comportement
observable même sans toucher une seule ligne lui appartenant. J'ai donc créé un **Site, User,
SiteRole, SiteMember entièrement nouveaux et isolés** (`tmp-pr3demo01-*`), puis un
`ScenarioPrevision` `TMP-PR3-DEMO` sur ce site, avec :
- 2 `VaguePrevue` (une non réalisée `V1-TMP-DEMO`, une réalisée `V2-TMP-DEMO` avec une vraie
  `Vague` rattachée via `vaguePrevueId`) ;
- 7 `PostePrevision` + `ChargeMensuellePrevue` (pour forcer la troncature du Top 5) ;
- 1 `ApportCapital` (toujours `SANS_SOURCE_REELLE`) ;
- 9 lignes de `MappingRapprochement` (version 1, site isolé) ;
- Données réelles minimales : **8 `Depense`** (dont une catégorie non budgétée `EAU` : prévu=0 ;
  une catégorie non mappée `INTRANT` ; une catégorie `ALIMENT` volontairement non mappée
  rattachée à la vague réelle), **2 `Vente`** (dont une rattachée à la vague réelle, montant et
  tonnage réels tous deux > prévu), **1 `MouvementStock`** SORTIE aliment (catégorie non mappée).

Script de mise en place, de comptage et de nettoyage écrits en SQL brut (`pg.Pool`,
`DATABASE_URL` lu depuis `process.env`, R11 respecté), exécutés depuis un dossier temporaire
`.tmp-pr3-demo/` à la racine du dépôt (jamais commité, entièrement supprimé en fin de tâche) —
raw SQL plutôt que les query functions de l'application, pour éviter le problème connu Prisma
7/ESM avec `tsx` (mémoire agent).

**Incident rencontré et corrigé sans toucher au code applicatif** : le premier essai a échoué
avec `Cannot read properties of null (reading 'plus')` dans `calculerTresorerieMensuelle`.
Investigation par instrumentation temporaire (`console`/écriture de fichier dans le `catch`,
retirée avant la fin — diff `git diff` vérifié nul sur ce fichier après retrait) : le Prisma
Client chargé par le process `next dev` **de longue durée** (démarré avant ce sprint) lisait
`ParametresPrevision.tresorerieInitialeFCFA` comme `undefined`, alors qu'une requête Prisma
indépendante lancée dans un process Node frais lisait correctement la valeur. Un **redémarrage
du serveur de dev** (`npm run dev`, aucune modification de code) a résolu le problème
immédiatement — artefact de staleness du process de dev, pas un défaut applicatif. Consigné ici
pour traçabilité ; aucun fichier du dépôt n'a été modifié de façon persistante (vérifié par
`git diff` sur `src/components/pages/previsions-scenario-detail-page.tsx` avant/après : aucune
différence liée à moi, seul le diff de travail non commité préexistant du sprint PR3 demeure).

### 8.2 Ce qui a été VU en Chromium réel (Playwright, `@playwright/test` déjà installé)

**1. Les 4 vues s'affichent réellement avec des données — CONFIRMÉ.** Vue mensuelle, vue
cumulée, vue par vague, top écarts : toutes rendues avec les données du scénario de démo (plus
d'état vide). Captures : `pr3-rapprochement-1280-mensuelle.png`,
`pr3-rapprochement-1280-cumulee.png`, `pr3-rapprochement-1280-parvague.png`,
`pr3-rapprochement-1280-topecarts.png`, et les équivalents `375-*`.

**2. Le sélecteur de mois fonctionne — CONFIRMÉ.** Changement août 2026 → février 2026 : contenu
affiché différent avant/après (vérifié programmatiquement, `innerText` différent), capture
`pr3-rapprochement-1280-apres-changement-mois.png`. Vérifié aussi manuellement sur janvier 2026
pour observer la ligne `SANS_SOURCE_REELLE` (voir point 5).

**3. Couleurs sémantiquement correctes, y compris l'inversion critique — CONFIRMÉ.**
- Dépense dépassée (`Electricite`, prévu 100 000 / réel 133 000, +33 %) → **rouge**,
  « Défavorable ».
- Dépense sous-consommée (`Salaires`, `Transport`) → **vert**, « Favorable ».
- **Entrée dépassée** (`Revenu de vente prévu`, prévu 1 600 000 / réel 2 740 000, +71,3 %) →
  **vert**, « Favorable » — inversion vérifiée.
- **Tonnage dépassé** (`Tonnage récolté prévu`, prévu 800 kg / réel 1 350 kg, +68,8 %) →
  **vert**, « Favorable » — inversion vérifiée sur le cas explicitement signalé comme le plus
  facile à rater.

**4. Le bac « Non rapproché » est visible et peuplé — CONFIRMÉ.** Trois lignes distinctes
observées le mois d'août : `DEPENSE_CATEGORIE:INTRANT` (45 000 FCFA), `DEPENSE_CATEGORIE:ALIMENT`
(700 000 FCFA, rattachée à la vague réelle et donc absente de la vue « par vague » sous ce
libellé), `MOUVEMENT_STOCK:G1` (40, favorable car nature QUANTITE). Le mois de février (sans
donnée), affiche explicitement « Aucune catégorie non rapprochée ce mois » plutôt qu'un silence.

**5. Aucun `NaN`/`Infinity`/`undefined`/`null`/« 0 % » isolé où l'écart est non applicable —
CONFIRMÉ, avec un correctif de méthode en cours de route.** Mon premier balayage de chaînes a
signalé un faux positif (`"33,0 %"` contient la sous-chaîne `"0 %"`) — corrigé par une regex qui
exclut les `"0 %"` précédés d'un chiffre/virgule. Après correction, balayage propre sur les 4
vues aux deux largeurs. Cas `prévu = 0, réel > 0` (poste `Eau`) : `PRÉVU` affiché `–`, `ÉCART %`
affiché **`N/A`** — jamais « 0 % » ni `NaN`. Cas `SANS_SOURCE_REELLE` (`Apports en capital`,
janvier 2026) : colonne réel affiche littéralement **« Pas de source réelle disponible pour ce
poste »** (italique), jamais `0`.

**6. Bandeau de fraîcheur présent — CONFIRMÉ.** « Le "réel" affiché reflète l'état des données au
moment de cette consultation (05/08/2026 00:52), pas une photo figée d'un import passé. » —
visible en haut de l'onglet aux deux largeurs.

**7. À 375 px — CONFIRMÉ.** `document.documentElement.scrollWidth === clientWidth` (375 = 375,
pas de débordement horizontal). Cartes empilées (pas de tableau) sur les 4 vues, badges
« Défavorable »/« Favorable »/« Neutre » lisibles, rien de tronqué dans le contenu métier.
Réserve non bloquante : la capture `fullPage` montre la barre de navigation basse (icônes
Accueil/Menu) apparaître au milieu du flux — artefact connu de la capture `fullPage` de
Playwright avec les éléments `position: fixed` (dupliqués à leur position d'écran à chaque
segment composé), pas un défaut de rendu réel constaté au défilement.

**8. À 1280 px — CONFIRMÉ.** Les 9 onglets du scénario s'affichent sans débordement, sidebar
desktop visible, tableaux lisibles. Réserve mineure : le tableau « Par vague » déborde
légèrement à droite dans un conteneur `overflow-x-auto` dédié (colonne « Coût / kg » partiellement
hors cadre dans la capture) — comportement de défilement horizontal **contenu au tableau**, pas
un débordement de la page ; cohérent avec le patron déjà en place ailleurs dans le module
(ERR-157).

**Aucune erreur console JS liée au Rapprochement.** Trois `403 Forbidden` observés sur
`/api/notifications/count` — expliqués et non liés : le `SiteRole` de démo, construit avec
seulement les permissions nécessaires (`PREVISIONS_*`, `SITE_GERER`, `MEMBRES_GERER`,
`DASHBOARD_VOIR`), n'inclut pas la permission requise par cette route ; artefact de mon jeu de
permissions minimal, pas un défaut du rapprochement.

### 8.3 Défaut potentiel constaté (à signaler, pas corrigé)

**« Total du mois » et le classement « Top écarts » mélangent des grandeurs de nature
différente (FCFA et kg) sans les distinguer.** Le total mensuel affiché (`2 640 800 FCFA`)
additionne des montants FCFA (charges, revenu) avec un tonnage brut en kg (`800` pour
« Tonnage récolté prévu ») sous une seule étiquette « FCFA » — visuellement trompeur même si le
code documente explicitement cette limite (`cumuleGlobalParMois reste un total numérique brut,
sans sens`, commentaire de `previsions-vue-rapprochement.ts`). Le classement « Top écarts »
mélange de la même façon des écarts en FCFA et un écart en kg (`Tonnage récolté prévu`, écart de
550 **kg**, pas 550 000 FCFA) dans un seul tri par magnitude brute — ici sans conséquence visible
dans mon scénario (l'écart kg reste petit en valeur absolue), mais rien n'empêche structurellement
un écart de tonnage important de squatter une place du Top 5 à côté d'écarts FCFA, sans que
l'utilisateur puisse le distinguer autrement qu'en lisant le libellé. Je ne corrige pas (hors
mandat), je signale : candidat à un `BUG-XXX` de sévérité Basse/Moyenne pour @project-manager, si
jugé pertinent — le code lui-même reconnaît déjà la limite en commentaire, donc probablement un
arbitrage déjà assumé plutôt qu'un oubli.

### 8.4 Preuve de nettoyage complet

**Comptage DB-wide (Depense/Vente/MouvementStock + tables annexes), avant/après (identique à
l'unité près) :**

| Table | Avant | Après création | Après nettoyage |
|---|---|---|---|
| Depense | 5 | 14 | **5** |
| Vente | 2 | 4 | **2** |
| MouvementStock | 10 | 11 | **10** |
| Client | 5 | 6 | **5** |
| Produit | 7 | 8 | **7** |
| Vague | 3 | 4 | **3** |
| ScenarioPrevision | 1 | 2 | **1** |
| MappingRapprochement | 0 | 9 | **0** |

Recherche de résidus par motif d'id (`%pr3demo%`, `%PR3-DEMO%`, `%TMP-PR3%`) sur 18 tables
(User, Site, SiteRole, SiteMember, Produit, ScenarioPrevision, ParametresPrevision, VaguePrevue,
Vague, PostePrevision, ChargeMensuellePrevue, ApportCapital, MappingRapprochement, Depense,
Vente, MouvementStock, Client, Session) : **0 résidu**.

**Diff d'empreinte EXCEL-V12** (`scripts/audits/tst-audit-excel-v12-empreinte.ts`, rejoué après
nettoyage, comparé à `excel-v12-empreinte-avant.json`) :

```
35c35,36
<     "alevinsAchetesParDefaut": false
---
>     "alevinsAchetesParDefaut": false,
>     "tresorerieInitialeFCFA": "0.000000000000000000000000000000"
```

Seule différence : l'apparition de `tresorerieInitialeFCFA = 0`, exactement la différence
légitime déjà identifiée au §5 (nouveau champ, migration `DEFAULT 0`) — **aucune trace de mon
scénario de démonstration dans l'empreinte d'EXCEL-V12**, `mappingRapprochement_count_for_site`
et `clotureMois_count` restent à `0` (site isolé, jamais celui d'EXCEL-V12).

**Fichiers temporaires** : dossier `.tmp-pr3-demo/` (scripts de mise en place/comptage/nettoyage,
scripts de debug ad hoc, manifeste JSON) créé à la racine du dépôt puis **supprimé
intégralement** (`rm -rf`) en fin de tâche — confirmé absent de `git status --porcelain`. Aucun
fichier commité, aucune trace dans l'historique git (jamais ajouté à l'index).

### 8.5 Ce qui reste non vérifié après cette mission

- Le rendu réel avec une **granulométrie d'aliment** (`AlimentPrevision`/`RepartitionMoisAliment`)
  rapprochée à un mapping `ALIMENT_PREVISION` — mon scénario de démo n'inclut délibérément aucun
  `AlimentPrevision` (simplification pour rester dans le budget de la mission ; le
  `MouvementStock` de démo tombe donc en `NON_RAPPROCHE` plutôt que rapproché à un calibre). Angle
  mort résiduel, mineur : le chemin de mapping `ALIMENT_PREVISION` lui-même n'est exercé nulle
  part dans cette vérification navigateur.
- Le comportement d'un **mois CLOTURÉ** (`ClotureMois` + `versionMapping` figée, ADR-053 §15.3) —
  hors mandat explicite de cette mission (qui portait sur les 4 vues avec données, pas sur le
  cycle de clôture) ; non exercé en navigateur.
