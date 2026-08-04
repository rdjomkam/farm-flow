# Rapport de tests — Sprint PR2-septies (La remise fournisseur se décide au tonnage de la vague)

**Date :** 2026-08-04 · **Agent :** @tester · **Périmètre :** stories PR2sept.1 (ADR §13), PR2sept.2 (schéma), PR2sept.3 (moteur), PR2sept.4 (UI), **+ passe 1 de correction (moteur) et passe 2 de correction (UI + statut HTTP)** + vérification finale de clôture (R9).

> **Ce rapport a été entièrement refait sur l'état du dépôt d'après les deux passes de correction.** Les compteurs, empreintes et mesures de durée de la version précédente sont périmés et ont été remplacés. Les sections conservées (B1-B6 de l'ancienne §2, §7 intégrité DB) ont été revérifiées, pas recopiées.

## Verdict global

**SPRINT VALIDÉ — clôture recommandée.**

- 5 passages complets de la suite après les deux passes, **0 échec**, compteurs strictement identiques d'un passage à l'autre, **durées stables au repos (12,8 à 13,9 s)**.
- Build production OK (EXIT=0), zéro erreur TypeScript/ESLint.
- Recette ciblée : **2 378 assertions, 0 écart**.
- **6 falsifications rejouées, les 6 discriminent** ; tous les fichiers applicatifs restaurés bit-à-bit (preuve sha256 + `diff` vide).
- Aucune écriture en base (prouvée par `updatedAt` d'`EXCEL-V12`, inchangé).
- **Un trou de couverture réel trouvé et fermé** dans la passe 2 (le vidage des erreurs positionnelles à la suppression d'un palier n'était testé par rien) — test uniquement, aucun code applicatif modifié.
- **Aucun bug de logique applicative découvert.** Deux réserves non bloquantes et une inexactitude de mon rapport précédent sont signalées (§6).

---

## 1. Vérification finale de clôture (R9)

### 1.1 `npx prisma migrate deploy`

```
Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "farm-flow", schema "public" at "localhost:8432"

167 migrations found in prisma/migrations


No pending migrations to apply.
EXIT=0
```

### 1.2 `npx vitest run` — trois passages consécutifs, machine au repos

Les trois passages ont été lancés **en série, sans aucune autre commande en parallèle** (correction du biais de mesure signalé dans la version précédente de ce rapport).

| Passage | Fichiers | Tests | Échecs | `Duration` | `total` (shell) |
|---|---|---|---|---|---|
| 1 | 283 passed / 5 skipped (288) | **8864 passed** / 21 skipped / 26 todo (8911) | **0** | 13,86 s | 14,408 s |
| 2 | 283 passed / 5 skipped (288) | **8864 passed** / 21 skipped / 26 todo (8911) | **0** | 13,48 s | 14,012 s |
| 3 | 283 passed / 5 skipped (288) | **8864 passed** / 21 skipped / 26 todo (8911) | **0** | 13,89 s | 14,433 s |

Sorties brutes (queues) :

```
===== RUN 1 START 13:40:01 =====
 Test Files  283 passed | 5 skipped (288)
      Tests  8864 passed | 21 skipped | 26 todo (8911)
   Start at  13:40:02
   Duration  13.86s (transform 15.90s, setup 2.17s, import 44.15s, tests 58.62s, environment 18.67s)
npx vitest run  114.87s user 15.62s system 905% cpu 14.408 total
===== RUN 1 END 13:40:16 =====

===== RUN 2 START 13:40:16 =====
 Test Files  283 passed | 5 skipped (288)
      Tests  8864 passed | 21 skipped | 26 todo (8911)
   Start at  13:40:16
   Duration  13.48s (transform 15.97s, setup 2.01s, import 43.53s, tests 56.08s, environment 17.31s)
npx vitest run  115.01s user 15.42s system 930% cpu 14.012 total
===== RUN 2 END 13:40:30 =====

===== RUN 3 START 13:40:30 =====
 Test Files  283 passed | 5 skipped (288)
      Tests  8864 passed | 21 skipped | 26 todo (8911)
   Start at  13:40:30
   Duration  13.89s (transform 16.96s, setup 2.23s, import 45.33s, tests 56.65s, environment 18.18s)
npx vitest run  120.11s user 15.71s system 941% cpu 14.433 total
===== RUN 3 END 13:40:44 =====
```

**Conforme à la baseline annoncée : 288 fichiers (283 passed / 5 skipped), 8 864 tests passed.**

- **Aucune variation de compteur** entre les trois passages (fichiers, tests, skipped, todo : identiques au chiffre près).
- **Aucun test dépendant de l'ordre** : vitest ordonne les fichiers par durée décroissante et la composition des shards change d'un run à l'autre (visible dans les queues) sans le moindre effet sur les résultats.
- **Aucun handle non fermé, aucune erreur non gérée** : un 4ᵉ passage a été capturé **en intégralité** (pas seulement la queue) et scanné — `Unhandled`, `did not close`, `open handle`, « Tests closed successfully but something prevents… » : **0 occurrence**.
- **Durées : le facteur 2,6× de la version précédente a disparu.** 13,86 / 13,48 / 13,89 s, soit un écart maximal de 3 % — ce qui **confirme rétroactivement** le diagnostic de contention machine (mes propres `docker exec` et `grep` tournaient alors en parallèle) et exclut toute lenteur intrinsèque de la suite. **Le chiffre publiable est ~13,5-14 s.**

**Signal rapporté nommément malgré le vert (correction d'une inexactitude de mon rapport précédent) :** l'affirmation « aucune sortie parasite » était **fausse**. Le scan du run complet remonte **79 avertissements Radix sur `stderr`** : `Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}`. Ils ne font échouer aucun test.

- **Préexistants et hors périmètre du sprint** : ils sont répartis sur **47 fichiers de test** couvrant tout le dépôt (`ventes`, `vagues`, `dashboard`, `layout`, `filters`, `export`, `plans`…), pas seulement `previsions`.
- C'est néanmoins un **défaut d'accessibilité réel** (un `DialogContent` sans description accessible), pas un bruit d'outillage. Versé à ce qui reste ouvert (§8).

### 1.3 `npm run build`

```
> farm-flow@0.1.0 build
> prisma generate && prisma migrate deploy && next build --webpack

✔ Generated Prisma Client (7.4.2) to ./src/generated/prisma in 668ms
Datasource "db": PostgreSQL database "farm-flow", schema "public" at "localhost:8432"
167 migrations found in prisma/migrations
No pending migrations to apply.
⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
 We detected multiple lockfiles and selected the directory of /Users/ronald/package-lock.json as the root directory.
 [...]
EXIT=0
```

Log intégral scanné : **une seule ligne `Warning`, zéro `Error`, zéro `Failed`**. Le warning `outputFileTracingRoot` est préexistant (un `package-lock.json` traîne dans `/Users/ronald/`) et sans rapport avec le sprint.

### 1.4 Recette ciblée

```
 ✓ src/lib/previsions/__tests__/recette/annexe-b-corrigee.recette.test.ts (480 tests) 10ms
 ✓ src/lib/previsions/__tests__/recette/plan-v12-corrige.recette.test.ts (480 tests) 10ms
 ✓ src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts (1418 tests) 25ms

 Test Files  3 passed (3)
      Tests  2378 passed (2378)
   Duration  272ms
```

**2 378 assertions ≥ 2 300 attendues, 0 écart.**

### 1.5 Passage de confirmation après l'ajout de test du @tester (§5)

```
 Test Files  283 passed | 5 skipped (288)
      Tests  8865 passed | 21 skipped | 26 todo (8912)
   Duration  12.80s
```

**8 865 = 8 864 + 1.** Nombre de fichiers inchangé.
**Nouvelle baseline pour le sprint suivant : 288 fichiers (283 passed / 5 skipped), 8 865 tests passed.**

---

## 2. Section B — Vérification des deux passes de correction

### B1. `input.tsx` est partagé par toute l'application — **CONFORME, sans casse d'aucun appelant**

Le changement est d'une ligne : `hint ? hintId : null` → `hint && !error ? hintId : null` dans le calcul d'`aria-describedby`.

**Le rendu du hint, lui, était DÉJÀ conditionné par `hint && !error`** (ligne 81, inchangée par ce sprint — vérifié au `git diff`). Les deux conditions étaient donc désaccordées : dès qu'un appelant fournissait `hint` **et** `error`, l'attribut annonçait une description qui n'était pas rendue. Le correctif ne fait qu'aligner la référence sur le rendu.

**Conséquence sur le comportement, énoncée précisément :** le seul cas où la sortie change est `hint` **et** `error` simultanés, et le changement y consiste **uniquement à retirer un id orphelin** — jamais à retirer un id rendu, jamais à en ajouter un. Aucun appelant ne peut donc perdre une description existante.

**Recensement exhaustif des appelants d'`Input` avec `hint` (15 sites, grep sur tout `src/`) :**

| Fichier | Ligne | `error` aussi fourni ? | Impact du changement |
|---|---|---|---|
| `previsions/scenario-form-dialog.tsx` | 250 (`margeSecuriteAlevinsPct`) | **oui** | l'id orphelin disparaît quand l'erreur est présente |
| `previsions/scenario-form-dialog.tsx` | 302 (`nombreBacsSimultanesCible`) | **oui** | idem |
| `previsions/scenario-form-dialog.tsx` | 314 (`frequenceStockageMois`) | **oui** | idem |
| `previsions/parametres-tab.tsx` | 303 (3 champs de `CHAMPS_AVEC_HINT`) | **oui** (`fieldErrors[key]`) | idem |
| `previsions/parametres-tab.tsx` | 387 (seuil du 1ᵉʳ palier) | **oui** (`paliersFieldErrors`) | cas visé par le correctif |
| `previsions/scenario-form-dialog.tsx` | 214 (`dureeCycleMois`) | non | **aucun** |
| `previsions/aliment-form-dialog.tsx` | 271 | non | **aucun** |
| `reproduction/ponte-form-client.tsx` | 483, 552 | non | **aucun** |
| `reproduction/ponte-completer-client.tsx` | 327, 405 | non | **aucun** |
| Autres (`Textarea`, `SelectTrigger`, `MetricRow`, `TemplateField`) | — | — | **hors périmètre** : composants distincts, `input.tsx` ne les traverse pas |

**Constat important qui corrige la JSDoc du correctif :** le commentaire ajouté présente le cas `hint` + `error` comme « désormais atteignable sur le premier palier de remise ». **C'est faux — il était déjà atteignable avant ce sprint** sur les 4 champs de `scenario-form-dialog.tsx` et `parametres-tab.tsx` ci-dessus. Le défaut d'accessibilité existait donc en production ; le correctif le répare partout, ce qui est mieux que ce que son propre commentaire annonce. **Aucune conséquence fonctionnelle — imprécision documentaire uniquement**, signalée en §8.

**Confirmation par les tests, et par mutation (falsification G) :** le retour à `hint ? hintId : null` a été appliqué et **la suite ENTIÈRE** rejouée :

```
 FAIL  src/components/previsions/__tests__/parametres-tab.test.tsx > ... > aria-describedby ne reference jamais un id non rendu quand un champ porte a la fois un hint et une erreur
 Test Files  1 failed | 282 passed | 5 skipped (288)
      Tests  1 failed | 8864 passed | 21 skipped | 26 todo (8912)
```

Ce résultat prouve **les deux directions** en une seule mesure :
1. **le correctif est réellement testé** — exactement 1 test le discrimine ;
2. **aucun autre appelant n'est cassé** — les 8 864 autres tests passent aussi bien sous l'ancien que sous le nouveau comportement, donc rien dans le dépôt ne dépendait de l'id orphelin.

**Réserve de cohérence (non bloquante, §8) :** `src/components/ui/textarea.tsx` (l.22) et `src/components/ui/select.tsx` (l.29) portent **le défaut identique et non corrigé** (`hint ? hintId : null` face à un rendu `hint && !error`). Aucun appelant actuel ne leur passe `hint` **et** `error` en même temps — le défaut est donc **latent, pas actif**. Il le deviendra au premier appelant qui le fera.

### B2. Saisie décimale — **CONFORME**

**L'état est bien en chaînes brutes.** `PalierFormRow` déclare `seuilTonnes: string` / `pourcentageRemise: string` / `ordre: string` ; `toPalierRows` fait `String(p.seuilTonnes)` ; `updatePalier` enregistre `e.target.value` **tel quel**, sans aucun `Number()`. La conversion a lieu **une seule fois**, dans `handleSavePaliers`.

| Point demandé | Vérifié | Preuve |
|---|---|---|
| `2.5` est saisissable caractère par caractère | oui | test `parametres-tab.test.tsx:206` — `clear()` puis `type("2.5")`, `expect(seuil.value).toBe("2.5")`. Traverse donc les états `""`, `"2"`, `"2."`, `"2.5"` |
| la frappe intermédiaire `"2."` / `""` ne devient plus `0` | oui | c'est précisément ce que l'assertion ci-dessus mesure : un état numérique aurait ramené `"2."` à `2` puis `""` à `0`, rendant `"2.5"` inatteignable — le test échouerait sur la valeur finale |
| transmis **non arrondi** à l'API | oui | test `:234` — `expect(mockPut).toHaveBeenCalledWith(..., { paliers: [..., { seuilTonnes: 2.5, ... }, ...] })`, valeur littérale `2.5`, pas un `expect.any(Number)` |
| l'attribut n'invalide pas la valeur | oui | test `:219` — `step="any"` asserté sur **tous** les champs Seuil et Remise, `step="1"` sur Ordre (colonne `Int`) |

**Cohérence bout en bout confirmée** : `seuilTonnes` est un `Decimal` en base (colonne `numeric`, vérifiée en §7), un `z.number()` non entier côté zod, et `step="any"` + `inputMode="decimal"` côté DOM. Les trois couches acceptent 2,5.

### B3. `paliersFieldErrors` — **CONFORME sur les 3 points, mais le 3ᵉ n'était couvert par AUCUN test : trou fermé par le @tester**

| Exigence | Code | Testé **avant** mon intervention |
|---|---|---|
| erreur restituée sous le **bon** champ | `error={paliersFieldErrors[\`paliers.${i}.<champ>\`]}` sur les 3 `Input` (l.375, 398, 410), clé produite par le `path` zod | **oui** — `:257`, qui asserte en plus que les champs Ordre **voisins** ne portent pas `aria-invalid` |
| effacée à la correction | `updatePalier` supprime la clé exacte `paliers.<i>.<champ>` | **oui** — `:285` |
| **vidée à la suppression d'un palier** | `removePalier` fait `setPaliersFieldErrors({})` (l.246) | **NON — aucune assertion** |

**Le piège est réel et le code le traite correctement**, mais rien ne le protégeait. Le scénario exact : une erreur sur `paliers.1.ordre`, puis suppression du palier d'**index 0** ; les index restants glissent, et la clé `paliers.1.ordre` désignerait alors l'**ancien index 2** — un palier que l'API n'a jamais refusé, marqué `aria-invalid` à tort avec un message qui ne le concerne pas.

**Fermé** par un test ajouté dans `parametres-tab.test.tsx` (test uniquement, **aucun code applicatif modifié**). **Prouvé discriminant par mutation (falsification F)** : en retirant le `setPaliersFieldErrors({})` de `removePalier`, il tombe seul (`1 failed | 13 passed`) ; fichier applicatif restauré, `diff` vide (§4).

### B4. Statut 400 — **CONFORME sur les deux chemins, aucun P2002 atteignable**

| Chemin | Garde | Statut | Message | Testé |
|---|---|---|---|---|
| **HTTP réel** | `.superRefine` de `replacePaliersRemiseSchema` (zod), avant la query | **400** | message métier FR + `field: "paliers.1.ordre"` | `previsions-validations-http-mapping.test.ts:250` |
| **filet non-HTTP** | garde métier de `replacePaliersRemise`, avant le `deleteMany` | **400** via `PREVISIONS_STATUS_MAP` | message métier FR | `previsions-validations-http-mapping.test.ts:216` |

Le refus de doublon d'`ordre` sort donc bien en **400 sur le chemin HTTP**, et l'entrée `{ match: "meme ordre d'evaluation", status: 400 }` de la map **reste un filet utile** : sans elle, une `Error` nue levée par la query (appelant non-HTTP, ou garde zod relâchée) sortirait en **500**.

**Prouvé par mutation (falsification D)** : entrée retirée de `PREVISIONS_STATUS_MAP` → `1 failed | 10 passed`, et c'est exactement le test du filet qui tombe. **La ligne n'est donc pas du code mort**, contrairement au 422 qu'elle remplace (celui-ci n'était, lui, exercé par rien — je l'avais fermé par un test au sprint précédent, ce qui a précisément permis à la review de constater que le statut déclaré n'était jamais celui observé).

**Aucun P2002 ne peut remonter à l'utilisateur.** Recensement exhaustif des écritures sur `PalierRemise` dans tout `src/` (hors client Prisma généré et tests) :

```
src/lib/queries/previsions-scenarios.ts:503   tx.palierRemise.deleteMany
src/lib/queries/previsions-scenarios.ts:506   tx.palierRemise.createMany
```

**Un seul `createMany`, dans une seule fonction (`replacePaliersRemise`), atteinte par une seule route.** Aucune duplication de scénario ne recopie de paliers (`paliersRemise` n'apparaît que dans deux `include` de lecture). Les deux gardes sont en amont du `createMany` ; le test `:216` asserte en outre explicitement `not.toContain("Cette valeur existe deja")` et `not.toContain("P2002")` dans la réponse.

**Réserve reportée du code (assumée et documentée dans les deux fichiers) :** le mapping repose sur une **sous-chaîne d'un message destiné à l'utilisateur, écrit sans accents**. Accentuer ce message — correction légitime dans une UI française — casserait le lien en silence et ferait retomber ce cas en 500. Aucun test ne protège ce couplage. La correction de fond (erreur métier typée portant son statut) est hors périmètre ; versée à §8.

### B5. Le test M2 d'ordre des opérations tient après `appliquerTauxRemise` — **OUI, les 3 falsifications tombent**

Voir §4 pour les sorties brutes et les empreintes. Résumé :

| Falsification | Effet attendu | Constaté |
|---|---|---|
| A — `toDecimalPlaces(0)` sur `coutCalibreFCFA` | tombe | **5 failed / 4 passed** |
| B — `toDecimalPlaces(0)` sur les montants mensuels | tombe | **5 failed / 4 passed** |
| C — `toDecimalPlaces(0)` sur `coutBrutFCFA` (amont) | tombe | **2 failed / 7 passed** |

**La primitive extraite n'a rien affaibli** — elle a même **élargi** la couverture : une falsification supplémentaire (E) portant sur `appliquerTauxRemise` **elle-même** (`aliments.ts:168`) fait tomber **6 tests répartis sur 2 fichiers**, dont un test unitaire de `calculerCoutAlimentVague` qui ne passait pas par l'orchestration. La formule n'ayant plus qu'une seule écriture, toute altération est désormais détectée par les deux familles de tests à la fois.

**Point ERR-148 vérifié à la source :** les valeurs attendues du test M2 ne sont **pas** produites par le code testé. Elles sont recalculées à partir des constantes du test (`PRIX_SAC_G1_FCFA`, `TAUX_REMISE_PCT`) **et** confrontées à des littéraux en dur (`23251.86`, `13950.465`), et chaque bloc asserte explicitement que le candidat rejeté est **numériquement distinct** de l'attendu. Le test ne peut pas passer par coïncidence.

### B6. Justesse des libellés et parité i18n — **CONFORME (revérifié)**

Contrôles de l'ancienne §2 rejoués sur l'état actuel : aucune occurrence de `seuilSacs` dans `src/` ni `prisma/schema.prisma` ; aucun « sacs »/"bags" dans le bloc `parametresTab.paliers` (fr et en) ; parité fr↔en stricte (407 clés, 0 asymétrie, 0 valeur vide, interpolations identiques) ; 100 % des textes visibles du JSX passent par `t(...)` ; la description décrit exactement ce que fait `determinerPourcentageRemise`. La phrase ajoutée en passe 2 sur l'unicité de l'`ordre` est présente et symétrique dans les deux langues.

**Réserve maintenue (§B2 de la version précédente) :** les deux tests i18n ne couvrent que la **symétrie structurelle** des clés — ils n'auraient **pas** détecté « Seuil (sacs) » traduit fidèlement en "Threshold (bags)". La seule protection réelle contre une régression de ce libellé reste le test de composant `parametres-tab.test.tsx:117`.

---

## 3. Section C — Recherche active de régressions après deux passes de correction

Deux passes consécutives après review sont le moment typique d'une régression discrète. Recherche menée sur les cinq formes demandées :

| Forme recherchée | Méthode | Résultat |
|---|---|---|
| **Assertions affaiblies** | `git diff` des 3 fichiers de test suivis touchés par le module (`recette/*.test.ts`, `helpers.ts`) | **Aucune.** Le diff est **exclusivement additif** : +2 blocs de recette (`remisePct` par vague, `alevinsACommanderNb`), +1 assertion `epargne` par mois. Aucune assertion supprimée, aucune transformée en assertion plus faible |
| **Tolérances élargies** | grep de toutes les tolérances des fichiers de recette | **Aucune.** Les conventions sont inchangées : `tolerance 0` sur tout entier (sacs, voyages, alevins), `<= 1 FCFA` sur les montants — exactement les seuils d'avant le sprint. Le fichier M2 travaille en **égalité stricte `Decimal.equals`, tolérance nulle** |
| **Tests devenus tautologiques (ERR-148)** | inspection ligne à ligne des 18 assertions du fichier M2 + grep `expect(true).toBe(true)` et assimilés sur tout le module | **Aucune.** Attendus recalculés indépendamment **et** confrontés à des littéraux ; chaque bloc asserte la distinction numérique du candidat rejeté. Zéro `expect.any(`, zéro `expect.anything()` dans les 3 fichiers de test du sprint |
| **`it.skip` / `it.todo` ajoutés** | grep exhaustif `it.skip`/`describe.skip`/`test.skip`/`it.todo`/`.only(` sur tout `src/` | **Aucun ajout.** Les 26 `todo` sont tous dans `density-calculs.test.ts` / `density-integration.test.ts`, préexistants. Les 21 `skipped` sont les DB-gated connus, tous inscrits dans `src/test/db-gated-allowlist.ts` — dont le respect est lui-même vérifié par le test méta `db-gated-tests-registry.test.ts`. **Aucun `.only` nulle part** |
| **Mocks élargis** | inspection des mocks de `parametres-tab.test.tsx` et du fichier de mapping HTTP | **Aucun.** `mockPut` est réinitialisé par `vi.clearAllMocks()` en `beforeEach` et **re-stubé par test** avec la réponse exacte du scénario ; les assertions portent sur l'appel **exact** (URL littérale + payload littéral), pas sur des matchers permissifs |

**Contrôle transverse supplémentaire :** la falsification G (§B1) a été jouée contre la **suite entière**, pas contre un fichier isolé — elle établit que le changement d'`input.tsx`, fichier partagé par toute l'application, ne modifie le résultat d'**aucun** des 8 864 autres tests.

**Aucune régression détectée.**

---

## 4. Falsifications rejouées — sorties brutes et preuve de restauration

Empreintes **de référence**, prises avant toute mutation :

```
fef1cb9d05ff8f90ec4ba1e6d871175318c1186d85ae84280733431eb8f224de  src/lib/previsions/route-orchestration.ts
b20ab7018c6601234ce018d1e2e7551d3c25d1d9dc7dd69c387d0fe0957d8951  src/lib/previsions/aliments.ts
8c87d9f851c0e1fe353d6d17db41435af841f0ee1925d4d9fba515fac8e8c723  src/app/api/previsions/_shared.ts
e7d685a370bec9cb858548548729af158c63bcfd13ec5e2ddfbf33a7f184dc0e  src/components/previsions/parametres-tab.tsx
```

> Note : l'empreinte de `_shared.ts` **diffère** de celle du rapport précédent (`ec10c9…`) — c'est attendu, la passe 2 y a changé le statut 422 → 400.

### A — `toDecimalPlaces(0)` sur `coutCalibreFCFA` (`route-orchestration.ts:508`)

```
     ✓ les deux candidats rejetes sont NUMERIQUEMENT DISTINCTS de l'attendu (ERR-148)
     × coutAlimentFCFA = (Σ couts bruts des calibres) x (1 − r) — EGALITE STRICTE, aucune tolerance
     × aucun arrondi ne s'intercale sur le cout remise PAR CALIBRE (rejette 23 252)
     ✓ aucun arrondi ne s'intercale sur les MONTANTS MENSUELS (rejette 23 250)
     × les montants mensuels eux-memes restent exacts (6 975,465 et 4 650,465 par mois)
     ✓ la somme des montants mensuels reconstitue EXACTEMENT coutAlimentFCFA
     ✓ le candidat rejete est NUMERIQUEMENT DISTINCT de l'attendu (ERR-148)
     × coutAlimentFCFA conserve les decimales du prix de sac (rejette 13 950,93)
     × les montants mensuels heritent des memes decimales (13 950,465 / 2 par mois)
 Test Files  1 failed (1)
      Tests  5 failed | 4 passed (9)
```

L'assertion nominative du candidat rejeté **23 252** tombe bien.

### B — `toDecimalPlaces(0)` sur les montants mensuels (`route-orchestration.ts:510-512`)

```
 Tests  5 failed | 4 passed (9)
```
Tests tombés : égalité stricte, **« rejette 23 250 »**, montants mensuels exacts, et les 2 tests du bloc à prix fractionnaire. Le test « rejette 23 252 » **résiste** — les deux mutations sont bien discriminées séparément.

### C — `toDecimalPlaces(0)` sur `coutBrutFCFA` (`route-orchestration.ts:494-497`, arrondi EN AMONT)

```
 Tests  2 failed | 7 passed (9)
```
Seuls les 2 tests du bloc à prix de sac fractionnaire tombent — **exactement ceux qui existent pour ça**.

**Contre-preuve que le trou n'était pas théorique** : la même mutation C rejouée contre la recette complète **survit toujours** :
```
 Test Files  3 passed (3)
      Tests  2378 passed (2378)
```
Les 2 378 assertions du jeu d'or ne ferment pas ce cas (leurs prix de sac sont entiers) ; **seuls les 3 tests ajoutés au sprint précédent le ferment.**

### D — suppression de `{ match: "meme ordre d'evaluation", status: 400 }` de `PREVISIONS_STATUS_MAP`

```
     × PUT /scenarios/[id]/paliers-remise renvoie 400 (jamais 500) quand la garde METIER de la query rejette un doublon d'ordre
 Tests  1 failed | 10 passed (11)
```

### E — `toDecimalPlaces(0)` dans `appliquerTauxRemise` (`aliments.ts:168`, la primitive partagée)

```
 FAIL  aliments.test.ts > calculerCoutAlimentVague > ORDRE DES OPERATIONS ... AUCUN arrondi ne s'intercale
 FAIL  route-orchestration-remise-ordre.test.ts > ... EGALITE STRICTE
 FAIL  route-orchestration-remise-ordre.test.ts > ... rejette 23 252
 FAIL  route-orchestration-remise-ordre.test.ts > ... montants mensuels exacts
 FAIL  route-orchestration-remise-ordre.test.ts > ... rejette 13 950,93
 FAIL  route-orchestration-remise-ordre.test.ts > ... montants mensuels fractionnaires
 Test Files  2 failed | 15 passed (17)
      Tests  6 failed | 2570 passed (2576)
```

### F — suppression de `setPaliersFieldErrors({})` dans `removePalier` (`parametres-tab.tsx:246`)

```
     × vide les erreurs de palier a la suppression (les cles sont positionnelles : sinon l'erreur glisse sur un autre palier)
 Tests  1 failed | 13 passed (14)
```

### G — retour à `hint ? hintId : null` (`input.tsx:33`) — jouée contre la **suite entière**

```
 FAIL  parametres-tab.test.tsx > ... aria-describedby ne reference jamais un id non rendu quand un champ porte a la fois un hint et une erreur
 Test Files  1 failed | 282 passed | 5 skipped (288)
      Tests  1 failed | 8864 passed | 21 skipped | 26 todo (8912)
```

### Preuve de restauration

```
$ shasum -a 256 <les 4 fichiers mutés>
fef1cb9d05ff8f90ec4ba1e6d871175318c1186d85ae84280733431eb8f224de  src/lib/previsions/route-orchestration.ts
b20ab7018c6601234ce018d1e2e7551d3c25d1d9dc7dd69c387d0fe0957d8951  src/lib/previsions/aliments.ts
8c87d9f851c0e1fe353d6d17db41435af841f0ee1925d4d9fba515fac8e8c723  src/app/api/previsions/_shared.ts
e7d685a370bec9cb858548548729af158c63bcfd13ec5e2ddfbf33a7f184dc0e  src/components/previsions/parametres-tab.tsx

$ diff -q <sauvegarde> <fichier>     # pour chacun des 4 + input.tsx
DIFFS VIDES — IDENTIQUES

$ git diff --stat src/components/ui/input.tsx
 src/components/ui/input.tsx | 29 +++++++++++++++++++++++++++--   ← le correctif du sprint, intact
```

**Les 5 fichiers applicatifs mutés sont bit-à-bit identiques à leur état d'avant mes mutations**, empreintes sha256 **identiques aux empreintes de référence** prises avant la première falsification, et `diff` vide dans les 5 cas. Le passage final de la suite (§1.5) confirme : 0 échec.

---

## 5. Trou de couverture découvert et fermé pendant cette vérification

**Un seul, décrit en §B3** : le vidage de `paliersFieldErrors` à la suppression d'un palier n'était couvert par aucune assertion, alors que les clés d'erreur sont **positionnelles** et qu'un glissement d'index ferait porter une erreur sur un palier innocent.

- **Le code applicatif est correct** — le défaut est une absence de test, pas un bug.
- Fermé par **1 test** dans `src/components/previsions/__tests__/parametres-tab.test.tsx` (fichier de test uniquement).
- **Fermeture prouvée** par la falsification F : le test tombe seul quand on retire la ligne, passe quand elle est là.

**Aucun bug de logique applicative découvert pendant cette vérification.**

---

## 6. Observations mineures — aucune bloquante

1. **Inexactitude de mon rapport précédent, corrigée ici :** j'affirmais « aucune sortie parasite » dans les trois passages. **Faux** : 79 avertissements Radix `Missing \`Description\` … for {DialogContent}` sur `stderr`, répartis sur 47 fichiers de test. Ils ne font échouer aucun test et sont préexistants au sprint, mais ils signalent un défaut d'accessibilité réel. Versé à §8.
2. **Mon rapport précédent annonçait 8 854 puis 8 858 tests ; la baseline réelle mesurée aujourd'hui est 8 864** (+6 : les tests des deux passes de correction). Aucun test n'a disparu — la progression est intégralement expliquée.
3. **JSDoc d'`input.tsx` imprécise** : elle présente le cas `hint` + `error` comme « désormais atteignable », alors qu'il l'était **déjà** sur 4 champs avant ce sprint (§B1). Sans conséquence fonctionnelle.
4. **`textarea.tsx` et `select.tsx` portent le même défaut, non corrigé** (§B1). Latent : aucun appelant actuel ne leur passe `hint` et `error` simultanément.
5. **Le mapping HTTP du doublon d'`ordre` reste couplé par sous-chaîne** à un message utilisateur volontairement écrit sans accents (§B4). Le couplage est documenté aux deux extrémités, mais aucun test ne le protège : accentuer le message ferait retomber ce cas en 500 en silence.
6. **`handleSavePaliers` convertit par `Number(...)` sans garde** : un champ vidé par l'utilisateur (`""`) part en `0`, une saisie non numérique part en `NaN` (sérialisé `null`). Comportement identique à `handleSaveParametres` (qui, lui, filtre les chaînes vides) — l'API refuse proprement dans les deux cas, donc aucun risque de valeur fausse persistée. **Incohérence d'UX mineure**, file de polissage.
7. **`_prisma_migrations` contient toujours une ligne `rolled_back_at`** pour `20260803160000_aliment_prevision_calibre_article` (ré-appliquée avec succès 3 s plus tard). Antérieure au sprint, sans effet (`migrate deploy` : aucune migration en attente).
8. **Double numérotation ERR-158** dans `ERRORS-AND-FIXES.md` — préexistant, à trancher par @knowledge-keeper (je n'y touche pas).
9. **Warning `outputFileTracingRoot` au build** — préexistant, dû à un `package-lock.json` dans `/Users/ronald/`.

---

## 7. Intégrité d'`EXCEL-V12` (SQL en lecture seule)

Connexion établie sans qu'aucun identifiant ne figure dans ce rapport ni dans aucun fichier du dépôt (R11) — `psql` n'étant pas installé sur l'hôte, l'accès s'est fait par `docker exec` sur le conteneur de développement, sans mot de passe en ligne de commande. **Aucune écriture : uniquement des `SELECT`.**

```
--- 1. Scenario EXCEL-V12 : identite + updatedAt
            id             |   code    |  statut   |        createdAt        |        updatedAt
---------------------------+-----------+-----------+-------------------------+-------------------------
 cmsdnypml0000n4ekuadykn0f | EXCEL-V12 | BROUILLON | 2026-08-03 20:10:26.493 | 2026-08-03 20:10:26.493

--- 2. VaguePrevue : compte + somme alevins
 nb_vagues | somme_alevins
-----------+---------------
        19 |        602500

--- 3. Apports (ApportCapital)
 nb_apports
------------
          3

--- 4. PalierRemise : total tous scenarios
 paliers_tous_scenarios
------------------------
                      0

--- 5. Colonnes de PalierRemise
    column_name    | data_type
-------------------+-----------
 id                | text
 scenarioId        | text
 seuilTonnes       | numeric      <-- present
 pourcentageRemise | numeric
 ordre             | integer
 siteId            | text
                                  <-- seuilSacs ABSENT (6 colonnes, aucune autre)

--- 6. Index / contraintes de PalierRemise
             indexname             |                              indexdef
-----------------------------------+--------------------------------------------------------------------
 PalierRemise_pkey                 | CREATE UNIQUE INDEX ... USING btree (id)
 PalierRemise_scenarioId_idx       | CREATE INDEX ... USING btree ("scenarioId")
 PalierRemise_scenarioId_ordre_key | CREATE UNIQUE INDEX ... USING btree ("scenarioId", ordre)   <-- present
 PalierRemise_siteId_idx           | CREATE INDEX ... USING btree ("siteId")

--- 7. max(updatedAt) des enfants VaguePrevue
    max_vague_prevue
-------------------------
 2026-08-03 21:10:00.698
```

| Contrôle | Attendu | Constaté | Verdict |
|---|---|---|---|
| `VaguePrevue` | 19 | 19 | OK |
| Somme alevins | 602 500 | 602 500 | OK |
| Apports (`ApportCapital`) | 3 | 3 | OK |
| `PalierRemise` | 0 ligne | 0 ligne | OK |
| Colonne `seuilTonnes` | présente | présente (`numeric`) | OK |
| Colonne `seuilSacs` | absente | absente | OK |
| `UNIQUE (scenarioId, ordre)` | présent | `PalierRemise_scenarioId_ordre_key` | OK |
| **`ScenarioPrevision.updatedAt`** | `2026-08-03 20:10:26.493` | **`2026-08-03 20:10:26.493`** | **OK — inchangé** |

**Preuve de non-écriture.** L'`updatedAt` du scénario est identique **à la milliseconde** à la valeur de référence, **et identique à son propre `createdAt`** : le scénario n'a jamais été modifié depuis sa création. Le contrôle élargi aux enfants donne `max(VaguePrevue.updatedAt) = 2026-08-03 21:10:00.698`, soit **la veille** — antérieur à l'application de la migration du sprint (2026-08-04 09:56:59) comme à toute activité d'aujourd'hui. **Aucune écriture n'a eu lieu pendant le sprint PR2-septies, ni pendant les deux passes de correction, ni pendant cette vérification finale.**

---

## 8. Ce qui reste ouvert à la clôture

| # | Point | Sévérité | Pour qui |
|---|---|---|---|
| 1 | **Vérification de présentation en Chromium réel à 360 px** du bloc « Paliers de remise » : `description` de ~330 caractères, `seuilHint` sous le premier champ, et **désormais un message d'erreur potentiel sous chacun des 3 champs** d'une grille `grid-cols-1 sm:grid-cols-3`. jsdom ne prouve rien sur le débordement (ERR-157). Le risque a **augmenté** avec la passe 2 (`paliersFieldErrors` ajoute des lignes de texte). | **Moyenne** | @developer / @code-reviewer |
| 2 | **79 avertissements Radix `Missing \`Description\` for {DialogContent}`** sur 47 fichiers de test — défaut d'accessibilité réel, préexistant, à traiter globalement (pas dans ce sprint). | Moyenne | file de polissage |
| 3 | **`textarea.tsx` et `select.tsx` portent le défaut `aria-describedby` orphelin** corrigé dans `input.tsx` (latent : aucun appelant ne leur passe `hint` + `error` aujourd'hui). | Basse | file de polissage |
| 4 | **Mapping HTTP couplé par sous-chaîne** à un message utilisateur non accentué : l'accentuer ferait retomber le doublon d'`ordre` en 500 sans qu'aucun test ne le signale. Correction de fond = erreur métier typée portant son statut. | Basse | @architect (hors sprint) |
| 5 | Les tests i18n ne protègent **structurellement pas** contre un libellé faux traduit symétriquement ; la protection réelle est le test de composant. | Documentaire | @knowledge-keeper |
| 6 | `handleSavePaliers` : `Number("")` → `0`, `Number("abc")` → `NaN`, sans filtrage préalable (§6.6). Refusé proprement par l'API, incohérent avec `handleSaveParametres`. | Basse | file de polissage |
| 7 | Double numérotation ERR-158 dans `ERRORS-AND-FIXES.md`. | Basse | @knowledge-keeper |
| 8 | Warning `outputFileTracingRoot` au build, préexistant. | Basse | hors sprint |

**Aucun de ces points ne bloque la clôture du sprint PR2-septies.**

---

## 9. Fichiers modifiés par le @tester

**Vérification finale (ce document) — un seul fichier, de test :**

- `src/components/previsions/__tests__/parametres-tab.test.tsx` — **+1 test** (fermeture du trou §B3 / §5)

**Sprint (avant les passes de correction), rappel :**

- `src/lib/previsions/__tests__/route-orchestration-remise-ordre.test.ts` — +3 tests
- `src/__tests__/api/previsions-validations-http-mapping.test.ts` — +1 test

**Fichiers applicatifs mutés temporairement pour falsification, tous restaurés bit-à-bit et vérifiés par sha256 (§4) :** `route-orchestration.ts`, `aliments.ts`, `_shared.ts`, `parametres-tab.tsx`, `input.tsx`.

Aucun commit, aucun push, aucune écriture en base, aucune modification de `docs/sprints/`, `docs/TASKS.md`, `ADR-053`, `ERRORS-AND-FIXES.md` ni `docs/reviews/`.
