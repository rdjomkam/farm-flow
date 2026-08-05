# Rapport de test — Story A.4 « Périmètre de mapping POSTE_PREVISION — correction structurelle »

**Date :** 2026-08-05
**Agent :** @tester
**Sprint :** PR3-quater
**Réf :** ADR-053 §16, `docs/analysis/pre-analysis-story-A4-mapping-poste-prevision.md`, ERR-179, ERR-180, ERR-160, ERR-171

## 0. Intégrité EXCEL-V12 — vérifiée AVANT et APRÈS toute la session

Scénario `Plan de reference Excel v12`, id `cmsdnypml0000n4ekuadykn0f`, site `site_01`.

| Mesure | Attendu | Avant | Après |
|---|---|---|---|
| `VaguePrevue` | 19 | 19 | 19 |
| Σ `effectifAlevinsPrevu` | 602 500 | 602 500 | 602 500 |
| `AlimentPrevision` | 3 | 3 | 3 |
| `PalierRemise` | 4 | 4 | 4 |
| Σ `ApportCapital` | 30 000 000 | 30 000 000 | 30 000 000 |
| Σ `JournalDepensePrevue` | 34 400 000 | 34 400 000 | 34 400 000 |

Vérifié par requête SQL directe (`node` + `pg`, `DATABASE_URL` lu depuis l'environnement — aucune valeur en dur, R11). Aucune écriture n'a jamais touché ce scénario : tous les tests d'intégration créent leurs propres sites jetables (`pr3quater-a4-site-*`) et les nettoient dans un bloc `finally`, dans l'ordre FK correct (`PosteReferentiel` supprimé APRÈS `PostePrevision`, cf. §3 ci-dessous).

Constat complémentaire (post-session) : `PostePrevision` total en base = **4** (toujours les 4 postes d'EXCEL-V12, aucun résidu), `PosteReferentiel` total = **4** (backfill correct, aucun doublon), `MappingRapprochement` total = **0** (comme à l'état initial — confirmé qu'aucun site de test créé pendant la session n'est resté en base).

## 1. Ce qui a été livré côté code de production (lu, pas écrit par moi)

Le code de la story A.4 était déjà implémenté avant mon intervention (DB + applicatif) :
- Migration `prisma/migrations/20260805120000_add_poste_referentiel/` — nouvelle table `PosteReferentiel`, colonne `PostePrevision.posteReferentielId` (NOT NULL, FK `Restrict`), backfill idempotent avec garde-fou de précondition (R10).
- `src/lib/previsions/sluggifier-poste.ts` — normalisation slug (ADR-053 §16.11).
- `src/lib/queries/previsions-postes-referentiel.ts` + route `GET /api/previsions/postes-referentiel` (site-scope, `PREVISIONS_VOIR`).
- `src/lib/queries/previsions-charges.ts` — `createPostePrevision` avec get-or-create transactionnel + retry déterministe sur `P2002` (R4).
- `src/lib/queries/previsions-mapping-orphelins.ts` — `resoudreCibleCleDuScenarioCourant` résout désormais `POSTE_PREVISION` dynamiquement par `posteReferentielId` (même patron qu'`ALIMENT_PREVISION`/story A.3).
- `src/lib/queries/previsions-rapprochement.ts` — le **moteur de rapprochement lui-même** (`versMappingActif`/`resoudrePosteCibleCle`) a été corrigé, pas seulement le filet de détection : une résolution `POSTE_PREVISION` orpheline retombe désormais sur `NON_RAPPROCHE` explicite, jamais un montant qui disparaît (ERR-179 réellement corrigé à la source, pas seulement détecté).
- `src/components/previsions/mapping-orpheline-banner.tsx` — bandeau partagé, monté dans `scenario-detail-client.tsx` **au-dessus** du composant `Tabs` (donc visible depuis tous les sous-onglets, §16.7).
- `src/components/previsions/mapping-form-dialog.tsx` — pour `POSTE_PREVISION`, charge désormais `GET /postes-referentiel` (site-scope) au lieu de `GET /scenarios/[id]/postes` (scénario-scope) ; messages dédiés (`siteScopedNote`, `cibleReferentielIntrouvableWarning`) distincts de ceux d'`ALIMENT_PREVISION`.

Mon travail a consisté à **prouver** ce code (réécrire les tests contre l'ancien contrat, combler les trous, falsifier).

## 1bis. Correction post-review — Majeur #1 (point 4 §16.9 absent) et table de correspondance

**Constat du reviewer, confirmé** : le rapport initial ci-dessous listait un test « (4) orphelin
légitime » dans le fichier d'intégration, ce qui a créé une confusion de numérotation avec le
point 4 réel de l'ADR §16.9 (« `DELETE` SQL direct sur une `PosteReferentiel` référencée →
violation de contrainte FK Postgres, jamais un succès silencieux »). Ce point 4 réel n'avait
**aucun** test avant cette correction — confirmé par grep exhaustif de `PosteReferentiel` sur
tous les `*.test.ts` du dépôt avant l'ajout ci-dessous.

**Correctif appliqué** : ajout d'un 7ᵉ test dans
`src/lib/queries/__tests__/previsions-mapping-orphelins-integration.test.ts`, DB-gated, contre le
vrai Postgres — `(7, §16.9 point 4) RESTRICT BLOQUE LA SUPPRESSION`. Il exécute un `DELETE FROM
"PosteReferentiel" WHERE id = $1` sur une entrée référencée par un `PostePrevision` réel, attend
un rejet Postgres `code: "23503"` (`foreign_key_violation`), puis vérifie que ni la
`PosteReferentiel` ni le `PostePrevision` n'ont été touchés (pas de suppression partielle).

**Table de correspondance complète — les 10 points de §16.9 (renumérotés correctement) :**

| Point §16.9 | Intitulé ADR | Fichier | Nom du test |
|---|---|---|---|
| 1 | Résolution dynamique — cas nominal | `previsions-mapping-orphelins-integration.test.ts` | `(1) resolution nominale : une cible POSTE_PREVISION dont cibleId = posteReferentielId n'est JAMAIS orpheline sous le scenario qui la porte` |
| 1 (unitaire) | idem, sans DB | `previsions-mapping-orphelins.test.ts` | `POSTE_PREVISION : resolution DYNAMIQUE par posteReferentielId (A.4)…` |
| 2 | Renommage n'affecte jamais le mapping (falsification requise) | `previsions-mapping-orphelins.test.ts` | `RENOMMAGE (ADR-053 §16.4, §16.9 point 2)…` |
| 3 | Suppression de scénario ne casse jamais le mapping | `previsions-mapping-orphelins-integration.test.ts` | `(3) SURVIE A LA SUPPRESSION D'UN SCENARIO : supprimer physiquement le scenario A (cascade sur ses PostePrevision) laisse PosteReferentiel intact et le mapping toujours resolvable sous B` |
| **4** | **Restrict bloque la suppression — DELETE SQL direct** | `previsions-mapping-orphelins-integration.test.ts` | **`(7, §16.9 point 4) RESTRICT BLOQUE LA SUPPRESSION : un DELETE SQL direct sur une PosteReferentiel referencee par au moins un PostePrevision echoue avec une violation de contrainte FK Postgres, jamais un succes silencieux` — AJOUTÉ par cette correction** |
| 5 | Non-régression A.1/A.3 | `previsions-mapping-orphelins-integration.test.ts` (suite existante) + `previsions-rapprochement-integration.test.ts` | Suite complète des deux fichiers, verte sans modification des assertions `ALIMENT_PREVISION` |
| 6 | `sluggifierLibellePoste` — table de vérité | `sluggifier-poste.test.ts` | `it.each` — 7 paires libellé→code + 3 cas de rejet (`"!!!"`/`""`/`"   "`) |
| 7 | Get-or-create — réutilisation (cas nominal) | `previsions-mapping-orphelins-integration.test.ts` | `(2) PORTABILITE INTER-SCENARIOS — LA PROPRIETE CENTRALE ACHETEE PAR CETTE STORY : un mapping cree contre le scenario A resout AUSSI, sans reconfiguration, sous le scenario B du meme site` (couvre aussi la réutilisation par casse différente) |
| 7 (unitaire) | idem | `previsions-charges.test.ts` | describe `PostePrevision — get-or-create PosteReferentiel` — réutilisation malgré la casse |
| 8 | Get-or-create — création (aucune entrée existante) | `previsions-charges.test.ts` | describe `PostePrevision — get-or-create PosteReferentiel` — création si absent |
| 9 | Get-or-create — collision avec entrée désactivée | `previsions-charges.test.ts` | describe `PostePrevision — get-or-create PosteReferentiel` — 409 sur entrée désactivée |
| 10 | Get-or-create — concurrence (R4) | `previsions-mapping-orphelins-integration.test.ts` | `(6, §16.9 point 10, R4) GET-OR-CREATE SOUS CONCURRENCE REELLE : deux createPostePrevision concomitants du meme libelle dans deux scenarios du meme site ne produisent JAMAIS deux entrees PosteReferentiel` |

Les deux tests supplémentaires du fichier d'intégration qui ne correspondent à aucun point
explicitement numéroté de §16.9 mais couvrent des propriétés adjacentes documentées ailleurs dans
l'ADR (§16.5) restent en place : `(4) cas orphelin LEGITIME` (distinction orphelin légitime vs
corruption, §16.5) et `(5) COMPOSITION filet + moteur` (régression Moyenne #3, review PR3-ter).

**Verdict** : les 10 points de §16.9 sont désormais tous couverts par au moins un test qui
échouerait si la propriété correspondante était rompue. Aucun point restant sans test.

## 2. Tests réécrits contre le nouveau contrat (§16.9)

5 fichiers étaient rouges contre l'ancien comportement (`cibleId: poste.id` littéral). Aucun n'a été supprimé ni neutralisé — chacun a été réécrit pour prouver le nouveau contrat :

| Fichier | Avant | Après |
|---|---|---|
| `src/lib/queries/__tests__/previsions-mapping-orphelins.test.ts` | résolution "littérale, A.4 reportée" | résolution dynamique par `posteReferentielId`, + tests portabilité inter-scénarios, + test résistance au renommage |
| `src/lib/queries/__tests__/previsions-mapping-orphelins-integration.test.ts` | 2 tests, ancien contrat | réécrit intégralement (6 tests DB-gated, cf. §3) |
| `src/lib/queries/__tests__/previsions-rapprochement-integration.test.ts` | `cibleId: poste.id` (2 occurrences) | `cibleId: poste.posteReferentielId` |
| `src/components/previsions/__tests__/mapping-form-dialog.test.tsx` | attend le message générique "hors de ce scénario" | attend le message dédié `cibleReferentielIntrouvableWarning` pour `POSTE_PREVISION` (distinct du message `ALIMENT_PREVISION`) ; texte du placeholder Select mis à jour (`"Cible actuelle indisponible"`) |
| `src/components/previsions/__tests__/rapprochement-mapping-tab.test.tsx` | attend `"Cible introuvable dans ce scénario"` | attend `"Cible introuvable"` (la notion de "scénario" n'a plus de sens : la liste est site-scope) |

## 3. Nouveaux tests ajoutés (couverture manquante identifiée)

| Fichier | Portée | Tests |
|---|---|---|
| `src/lib/queries/__tests__/previsions-mapping-orphelins-integration.test.ts` (réécrit, puis étendu post-review) | DB-gated, **7 tests** | (1) résolution nominale ; (2) **portabilité inter-scénarios** (la propriété centrale) ; (3) **survie à la suppression d'un scénario** (suppression physique SQL directe, cascade réelle Postgres) ; (4) cas orphelin légitime ; (5) composition filet+moteur — prouve que le moteur ne fait **plus** disparaître le montant, il bascule en `NON_RAPPROCHE` ; (6) **get-or-create sous concurrence réelle** (§16.9 point 10, `Promise.all` de deux `createPostePrevision` concomitants, contrainte `@@unique([siteId, code])` réelle de Postgres comme arbitre) ; **(7, §16.9 point 4, AJOUTÉ post-review) `RESTRICT` bloque la suppression — `DELETE` SQL direct sur une `PosteReferentiel` référencée → rejet `23503` (foreign_key_violation), jamais un succès silencieux** |
| `src/app/api/previsions/postes-referentiel/__tests__/route.test.ts` (nouveau) | unitaire | 401/403, permission exacte `PREVISIONS_VOIR`, `activeSiteId` threadé (R8, jamais un id de la query string), bac vide, 500 explicite |
| `src/lib/queries/__tests__/previsions-postes-referentiel.test.ts` (nouveau) | unitaire (fake DB) | isolation stricte par site (R8, aucune fuite croisée), filtre `actif` |
| `src/components/previsions/__tests__/mapping-orpheline-banner.test.tsx` (nouveau) | unitaire | 0 cible orpheline → rien affiché ; N cibles → bandeau avec le compte exact ; appelle bien `?scenarioId=` du scénario courant ; échec réseau → état nommé distinct (jamais confondu avec "0 cible") |

Les tests suivants existaient déjà, écrits par le développeur avant mon intervention, et couvrent déjà correctement les points 6, 7, 8, 9 de §16.9 :
- `src/lib/previsions/__tests__/sluggifier-poste.test.ts` (13 tests) — table de vérité complète (casse, accents, espaces multiples, ponctuation, `&`/`/`, chaîne vide → 400, troncature 100, idempotence, les 4 libellés réels d'EXCEL-V12).
- `src/lib/queries/__tests__/previsions-charges.test.ts` (describe `PostePrevision — get-or-create PosteReferentiel`) — réutilisation malgré la casse, création si absent, isolation site, 409 sur entrée désactivée.

### 3bis. Test ajouté post-review — mineur recommandé : parité slug SQL ↔ TS

`src/lib/previsions/__tests__/sluggifier-poste-parite-sql.test.ts` (nouveau, 36 tests, pur, sans
DB) — réimplémente **littéralement** en JS le pipeline `translate()` du backfill SQL (même table
`src_chars`/`tgt_chars`, copiée verbatim de la migration) et le compare à
`sluggifierLibellePoste` sur un jeu de caractères élargi.

**Périmètre de parité prouvé, pas seulement affirmé :**
- **GARANTI (parité stricte, valeur identique)** : alphabet français standard — voyelles
  accentuées `à/â/ä/é/è/ê/ë/î/ï/ô/ö/ù/û/ü/ÿ`, `ñ`, `ç` (dans les deux casses) — toutes composées
  d'une lettre latine de base + une marque diacritique combinante Unicode (U+0300–U+036F), donc
  décomposables par `.normalize("NFD")` **et** présentes dans la table `src_chars`/`tgt_chars` du
  SQL. 20 cas testés, y compris les 4 libellés réels d'EXCEL-V12.
- **GARANTI (parité de comportement, pas de valeur)** : `œ`/`æ`/`Œ`/`Æ` — ni décomposables par
  NFD ni présentes dans `src_chars`, donc traitées comme un simple séparateur des deux côtés
  (`c-ur` pour `"cœur"` identique des deux côtés) ; un libellé composé **uniquement** d'une
  ligature est rejeté des deux côtés (TS : `BusinessRuleError` immédiate ; SQL : slug vide,
  équivalent du `RAISE EXCEPTION` du backfill) — mécanismes distincts, même verdict.
- **NON GARANTI, divergence prouvée (le test échouerait s'il affirmait une parité à tort)** :
  - `Ø`/`ø` — présentes dans `src_chars` du SQL (traduites en `O`/`o`), mais **pas** décomposables
    par NFD (lettre autonome, pas une base + diacritique détachable) : le TS les traite comme un
    séparateur, le SQL comme une lettre. Divergence réelle, hors du français standard (`Ø` n'est
    pas une lettre française — la table SQL provient d'un jeu de translittération Latin-1
    générique, plus large que le strict alphabet français).
  - Caractères d'Europe centrale/Baltique (`ą ć ń ś ź ż ș ț` et majuscules) — décomposables par
    NFD côté TS (conservent la lettre de base : `ą` → `a`), absents de `src_chars` côté SQL
    (deviennent un séparateur) — divergence prouvée sur 8 cas, hors périmètre linguistique réel
    du produit (libellés de postes de charges en français, pré-analyse §8).

`npx vitest run src/lib/previsions/__tests__/sluggifier-poste-parite-sql.test.ts` → **36/36
passés**.

## 4. Falsification obligatoire — tableau

Quatre mutations (3 initiales + 1 post-review), chacune exécutée dans le vrai code de production ou par mutation directe des données du test, suite complète relancée, comptée précisément, puis restaurée et vérifiée par `git diff`/checksum.

| # | Mutation | Fichier | Tests tombés (nombre) | Noms des tests tombés | Restauration vérifiée |
|---|---|---|---|---|---|
| 1 | `resoudreCibleCleDuScenarioCourant` compare sur `p.id === ligne.cibleId` (id `PostePrevision` littéral) au lieu de `p.posteReferentielId === ligne.cibleId` | `src/lib/queries/previsions-mapping-orphelins.ts` | **8** | `POSTE_PREVISION : resolution DYNAMIQUE par posteReferentielId (A.4)…` ; `POSTE_PREVISION : PORTABILITE INTER-SCENARIOS…` (unitaire) ; `PORTABILITE INTER-SCENARIOS (le coeur de la story A.4)…` ; `une cible qui EXISTE dans le scenario courant n'est jamais signalee orpheline` ; `RENOMMAGE (ADR-053 §16.4, §16.9 point 2)…` ; `(1) resolution nominale…` (DB-gated) ; `(2) PORTABILITE INTER-SCENARIOS — LA PROPRIETE CENTRALE…` (DB-gated) ; `(3) SURVIE A LA SUPPRESSION D'UN SCENARIO…` (DB-gated) | `git diff` du fichier identique octet-pour-octet à l'état pré-falsification (`diff` shell sur les deux `git diff` capturés — vide) |
| 2 | `resoudreCibleCleDuScenarioCourant` compare sur `p.libelle === ligne.cibleId` (résolution par libellé plutôt que par id) | `src/lib/queries/previsions-mapping-orphelins.ts` | **8** (mêmes 8 tests que #1 — le libellé n'égale jamais un `PosteReferentiel.id` dans les fixtures, donc la résolution échoue systématiquement) | Identiques à la ligne #1 | `git diff` identique à l'état pré-falsification |
| 3 | `sluggifierLibellePoste` : suppression de l'étape NFD/diacritiques (`const sansDiacritiques = libelle;`) | `src/lib/previsions/sluggifier-poste.ts` | **4** | `Énergie et Carburant -> energie-et-carburant` ; `Énergie   et Carburant!! -> energie-et-carburant` ; `les 4 libelles reels du scenario EXCEL-V12 slugifient sans collision` ; `point 8 : cree une nouvelle entree PosteReferentiel dans la meme transaction quand aucune n'existe pour ce slug` | Fichier non tracké par git (créé dans ce sprint) — vérifié par checksum MD5 identique avant/après (`2f3b978f1d80ed33c80cdb48966d20e5`) |
| 4 (post-review) | Suppression de la référence AVANT la tentative de `DELETE` : `await client.query('DELETE FROM "PostePrevision" WHERE id = $1', [poste.id])` insérée juste avant le `DELETE` sur `PosteReferentiel` — simule l'absence de la contrainte (l'entrée n'est alors plus référencée, le `DELETE` réussit) | `src/lib/queries/__tests__/previsions-mapping-orphelins-integration.test.ts` (mutation du test lui-même, pas du code de production — voir note ci-dessous) | **1** | `(7, §16.9 point 4) RESTRICT BLOQUE LA SUPPRESSION…` — passe de 7/7 à **6 passés / 1 échoué** ; le message d'échec Vitest montre le `DELETE` ayant réussi (`command: "DELETE", rowCount: 1`) là où `.rejects.toMatchObject({ code: "23503" })` attendait un rejet | Fichier restauré depuis une copie pré-falsification (`cp` scratchpad) ; **MD5 identique** avant/après (`1972a5e35eaaadbf3abc9811e170cd8d`) ; ré-exécution : 7/7 de nouveau verts |

**Note sur la mutation #4** : la contrainte `FK Restrict` elle-même vit dans la base Postgres
partagée (`onDelete: Restrict` appliqué par la migration `20260805120000_add_poste_referentiel`).
Le classeur de contrainte absolue interdit toute altération de schéma (`ALTER TABLE … DROP
CONSTRAINT`) sur cette base partagée, même réversible et même sans toucher aux données
EXCEL-V12 — une tentative en ce sens a d'ailleurs été bloquée par le classificateur d'exécution
automatique. La falsification a donc porté sur le **scénario testé** plutôt que sur la contrainte
elle-même : en supprimant la référence (`PostePrevision`) juste avant le `DELETE`, on simule
exactement ce qui se passerait si la contrainte n'existait pas (le `DELETE` réussirait) —
prouvant que l'assertion `.rejects.toMatchObject({ code: "23503" })` n'est pas une tautologie :
elle dépend bien du fait que l'entrée est réellement référencée et que Postgres refuse réellement
la suppression dans ce cas, pas d'un comportement toujours vrai indépendamment du scénario.

**Couverture des 4 propriétés centrales demandées par le PM :**
- **Résolution par `posteReferentielId`** : falsifiée et détectée par les mutations #1 et #2.
- **Portabilité inter-scénarios** : falsifiée et détectée par les mutations #1 et #2 (les 2 tests dédiés « PORTABILITE INTER-SCENARIOS » tombent dans les deux cas).
- **Survie à la suppression** : falsifiée et détectée par la mutation #1 (le test `(3) SURVIE A LA SUPPRESSION D'UN SCENARIO` tombe — la comparaison sur l'id littéral casse la résolution pour le scénario B, qui n'a jamais eu de `PostePrevision` avec cet id précis).
- **Résistance au renommage** : falsifiée et détectée par la mutation #2 en particulier (résolution par libellé — le test dédié `RENOMMAGE…` tombe explicitement, ainsi que sous la mutation #1 par ricochet puisque le mécanisme entier de résolution dynamique est cassé).

Aucune mutation n'est tombée à 0 test — chaque propriété centrale demandée est donc bien couverte, pas seulement nommée.

## 5. Recette du moteur — non négociable

```
src/lib/previsions/__tests__/recette/
  helpers.ts
  route-orchestration-builder.ts
  route-orchestration.recette.test.ts
  plan-v12-corrige.recette.test.ts
  route-orchestration-baseRepartition.recette.test.ts
  annexe-b-corrigee.recette.test.ts
```

Exécution : `npx vitest run src/lib/previsions/__tests__/recette`

**Résultat : 4 fichiers, 2709 tests, 2709 passés, 0 échec.** Chiffre identique à la cible imposée (« 2 709 assertions, 0 écart ») — aucun écart, pas de signal d'alarme.

## 6. Vérifications finales

### 6.1 Suite complète

Commande exacte : `set -a && source .env && set +a && npx vitest run`

```
Test Files  331 passed (331)
     Tests  9607 passed | 26 todo (9633)
```

**0 échec, 0 skip.** (331 fichiers contre 330 avant la correction post-review : +1 nouveau fichier
— `src/lib/previsions/__tests__/sluggifier-poste-parite-sql.test.ts` (36 tests). +37 tests au
total par rapport aux 9570 précédents : les 36 tests de parité + le test `(7, §16.9 point 4)
RESTRICT` ajouté dans le fichier d'intégration existant.)

### 6.2 Confirmation que les tests DB-gated ont bien TOURNÉ (pas skippés)

Preuve, pas affirmation :
1. `set -a && source .env && set +a && [ -n "$DATABASE_URL" ] && echo yes` → `yes`.
2. Exécution isolée des deux fichiers DB-gated modifiés/réécrits (`previsions-mapping-orphelins-integration.test.ts`, `previsions-rapprochement-integration.test.ts`) avec `grep -i "injoignable"` sur la sortie → **0 occurrence**. Le message `console.warn("[...] DB de dev injoignable — test ignore")` n'apparaît dans aucun test : chaque `it()` DB-gated a bien exécuté son corps contre la vraie base, pas retourné tôt sur `!dbAvailable`.
3. Les temps d'exécution mesurés (43 ms à 280 ms par test DB-gated) sont cohérents avec de vraies requêtes Postgres (`createScenario`, `createPostePrevision`, transactions, `DELETE` cascade réel) — un test qui aurait été skippé silencieusement se serait terminé en < 1 ms.
4. Vérification finale d'intégrité EXCEL-V12 et de propreté des sites de test (§0 et §7 ci-dessous) — ces requêtes SQL directes elles-mêmes prouvent que `DATABASE_URL` était valide et joignable pendant toute la session.

### 6.3 Build production

`set -a && source .env && set +a && npm run build` → **exit code 0**, toutes les routes générées avec succès (dont `/previsions/scenarios`, `/previsions/scenarios/[id]`), aucune erreur TypeScript.

### 6.4 Les 26 `todo`

Localisés : **exclusivement** dans `src/__tests__/density-calculs.test.ts` (21) et `src/__tests__/density-integration.test.ts` (5) — module « densité » (kg/m³ par bac), **totalement indépendant** du module Prévisions et de la story A.4. Chaque `it.todo(...)` porte un commentaire détaillant le calcul attendu (formule, valeurs d'exemple) — ce sont des specs documentées en attente d'implémentation, pas des tests réels désactivés silencieusement. **Pré-existants, légitimes, sans lien avec cette story.**

## 7. Nettoyage des sites de test créés pendant la session

Vérifié après exécution complète (session initiale ET session de correction post-review) :
`SELECT id FROM "Site" WHERE id LIKE 'pr3ter-a1-site-%' OR id LIKE 'pr3-rappr-site-%' OR id LIKE
'pr3quater-a4-site-%'` → **0 ligne**. Tous les sites jetables créés par les tests d'intégration
(nominal, portable, suppression, légitime, composition, concurrence, **restrict**) ont été
nettoyés dans leur bloc `finally`, dans l'ordre FK correct (`PosteReferentiel` après
`PostePrevision`).

## 7bis. Intégrité EXCEL-V12 — re-vérifiée après la correction post-review

Requête SQL directe (`node` + `pg`, `DATABASE_URL` lu depuis l'environnement, R11) sur le
scénario `cmsdnypml0000n4ekuadykn0f` (site `site_01`), après ajout du test `(7, §16.9 point 4)`
et du fichier de parité slug, exécution complète de la suite et falsification/restauration :

| Mesure | Attendu | Mesuré |
|---|---|---|
| `VaguePrevue` | 19 | **19** |
| Σ `effectifAlevinsPrevu` | 602 500 | **602 500** |
| `AlimentPrevision` | 3 | **3** |
| `PalierRemise` | 4 | **4** |
| Σ `ApportCapital.montantFCFA` | 30 000 000 | **30 000 000** |
| Σ `JournalDepensePrevue.montantFCFA` | 34 400 000 | **34 400 000** |

Aucun écart. Aucune ligne EXCEL-V12 touchée par la correction.

## 8. Verdict

**GO.** Le défaut structurel d'ERR-179/ERR-180 pour `POSTE_PREVISION` est corrigé à la fois dans le filet de détection (`previsions-mapping-orphelins.ts`) ET dans le moteur de rapprochement lui-même (`previsions-rapprochement.ts`) — un montant réel sous une cible orpheline ne disparaît plus silencieusement, il bascule explicitement en `NON_RAPPROCHE`. Les quatre propriétés centrales (résolution par id, portabilité inter-scénarios, survie à la suppression, résistance au renommage) sont chacune couvertes par au moins un test qui échouerait si la propriété était rompue — prouvé par falsification, pas seulement par lecture de code. Recette moteur intacte (2709/2709). Aucune donnée d'EXCEL-V12 touchée.

**Correction post-review (Majeur #1 + mineur) : GO.** Le point 4 de §16.9 (`Restrict` bloque la
suppression) est désormais couvert par un test falsifié avec succès, et les 10 points de §16.9
sont tous couverts avec une numérotation corrigée et vérifiable (table de correspondance §1bis).
Le mineur recommandé (parité slug SQL↔TS) est couvert par 36 tests documentant explicitement le
périmètre garanti (français, `œ`/`æ`) et le périmètre non garanti (`Ø`/`ø`, Europe centrale/
Baltique) — aucune prétention à une parité universelle.

Fichiers modifiés/créés par moi (tests + documentation uniquement, aucun code de production laissé modifié) :
- `src/lib/queries/__tests__/previsions-mapping-orphelins.test.ts` (réécrit + étendu)
- `src/lib/queries/__tests__/previsions-mapping-orphelins-integration.test.ts` (réécrit intégralement, puis étendu post-review avec le test `(7, §16.9 point 4) RESTRICT`)
- `src/lib/queries/__tests__/previsions-rapprochement-integration.test.ts` (2 lignes corrigées)
- `src/components/previsions/__tests__/mapping-form-dialog.test.tsx` (2 tests mis à jour)
- `src/components/previsions/__tests__/rapprochement-mapping-tab.test.tsx` (1 test mis à jour)
- `src/app/api/previsions/postes-referentiel/__tests__/route.test.ts` (nouveau)
- `src/lib/queries/__tests__/previsions-postes-referentiel.test.ts` (nouveau)
- `src/components/previsions/__tests__/mapping-orpheline-banner.test.tsx` (nouveau)
- `src/lib/previsions/__tests__/sluggifier-poste-parite-sql.test.ts` (nouveau, post-review)
- `docs/tests/rapport-story-A4-mapping-poste-prevision.md` (ce fichier — table de correspondance §16.9 ajoutée, numérotation corrigée)
