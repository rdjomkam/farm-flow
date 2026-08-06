# Pré-analyse T2 — « Les tests vides de sens » — 2026-08-06

## Statut : GO AVEC RÉSERVES (lecture seule confirmée, aucune régression introduite ; travail de correction reste à cadrer)

## Résumé
178 erreurs `tsc --noEmit`, confirmées, **toutes dans des fichiers de test, zéro en production**. Les
3 cas cités dans la commande sont confirmés à l'identique. Une famille élargie de « fixtures que la base
ne peut pas produire » touche en plus `TypePlan.PRO`, `TypeSystemeBac.BASSIN` et `CouleurEcartDTO:
"favorable"`. Le gros du volume (~96/178) est une seule famille mécanique : des DTO enrichis
(`Releve`, `RegleActivite`, `PlanAdminItem`, `FCRBacPeriode`...) dont les fixtures de test n'ont pas
suivi — cassé au typage, donc **pas silencieusement faux**, juste une dette de synchronisation. Le
run `vitest` complet a montré une divergence transitoire par rapport à la baseline attendue
(346/9803/26 todo/0 échec), due à une édition concurrente d'un autre agent sur `src/types/api.ts`
pendant l'exécution — documentée ci-dessous, hors périmètre T2. La base de dev partagée (EXCEL-V12) a
été vérifiée AVANT et APRÈS : aucune altération, malgré un comptage transitoire à 2
`ScenarioPrevision` capté en pleine exécution des tests DB-gated (race, résolu, contenu inchangé).

---

## 1. Les 3 cas connus, confirmés et documentés précisément

### (a) `TypeRemise.POURCENTAGE` / `TypeRemise.FIXE` — fixture impossible en base
**Fichier :** `src/__tests__/integration/abonnement-checkout-flow.test.ts`
**Lignes tsc :** 405, 432, 458 (+ 577, 619, 711 pour l'erreur d'arité liée, voir plus bas)
**`describe` :** `Parcours 2 — Souscription avec code promo valide`
**`it` concernés :** « code promo SOLDES10 → 10% de remise → prixFinal réduit », « code promo fixe
FIXE500 → réduction de 500 FCFA », « remise supérieure au prix → prix minimum 0 »

**Ce que le test prétend prouver :** que `calculerMontantRemise(prixBase, remise)` calcule
correctement un prix réduit pour une remise en pourcentage et une remise fixe, à partir d'un objet
`Remise` tel qu'il existe réellement en base.

**Ce qu'il prouve réellement :** rien sur le contrat `TypeRemise` réel. L'enum réel
(`prisma/schema.prisma:3257-3264`) est `EARLY_ADOPTER | SAISONNIERE | PARRAINAGE | COOPERATIVE |
VOLUME | MANUELLE` — aucune valeur `POURCENTAGE` ni `FIXE` n'existe. `TypeRemise.POURCENTAGE` vaut
`undefined` au runtime ; le champ `remise.type` est donc `undefined` dans les trois fixtures. Le
calcul réel de `calculerMontantRemise` (`src/lib/abonnements-constants.ts:218`) ignore ce champ et
se base uniquement sur `estPourcentage`/`valeur`, deux champs positionnés en dur et corrects dans la
fixture — c'est *cette* redondance qui fait passer le test au vert, pas une preuve que `type` est
cohérent avec ce que Prisma peut produire.

**Bonus découvert dans le même fichier — erreur d'arité, 5 occurrences :** `initierPaiement` est
appelée avec 4 arguments (`ABONNEMENT_ID, USER_ID, SITE_ID, {...}`) à 5 endroits (lignes 290, 378,
577, 619, 711 dans le test), alors que la signature réelle
(`src/lib/services/billing.ts:62-66`) n'en prend que 3 :
`(abonnementId: string, userId: string, params: InitierPaiementDTO)`. Un `SITE_ID` littéral est donc
passé comme 3ᵉ argument à la place de l'objet `params`, et `params` (le 4ᵉ argument) est ignoré par
la vraie fonction. **Ce test appelle une fonction avec un `SITE_ID` string qui n'est jamais lu**
— il ne prouve donc pas que le scoping multi-site (R8) du paiement fonctionne. Le seul mock
générique (`vi.mock` sur toute la couche `billing`) rend cette dérive invisible : le mock n'a pas de
contrat d'arité imposé par TypeScript au runtime.

### (b) `PhaseLot === "LARVE"` — mock auto-référentiel
**Fichier :** `src/__tests__/lib/reproduction-kpis.test.ts`
**Lignes tsc :** 335, 336, 361, 378
**`describe` :** couvre `getReproductionLotsKpis` (répartition et durée moyenne par phase)
**`it` concernés :** « … regroupe par phase … », « calcule la duree moyenne par phase dans
phaseMoyenneDureeJours », « retourne dureeJours = 0 pour une phase sans lot »

**Ce que le test prétend prouver :** que `getReproductionLotsKpis` regroupe correctement les lots
d'alevins par `PhaseLot` réel et calcule une durée moyenne par phase.

**Ce qu'il prouve réellement :** la fonction sous test (`src/lib/queries/reproduction-stats.ts:622`)
fait `const key = lot.phase as string` puis `phase: phase as PhaseLot` — un **cast**, jamais une
validation. Le mock (`mockLotAlevinsFindMany.mockResolvedValue([{ phase: "LARVE", ... }])`) injecte
directement une chaîne `"LARVE"`, qui traverse le cast sans jamais être comparée à l'enum réel
`PhaseLot` (`prisma/schema.prisma:699-706` : `INCUBATION | LARVAIRE | NURSERIE | ALEVINAGE | SORTI |
PERDU` — ni `LARVE` ni `ALEVIN` n'existent). Le test assert ensuite
`result.parPhase.find((p) => p.phase === "LARVE")` — il compare une chaîne que **lui-même** vient
d'injecter dans le mock à la sortie de la fonction qui n'a fait que la faire traverser sans
transformation. Aucune base réelle ne pourrait produire ces valeurs de `phase` ; le test se vérifie
lui-même.

### (c) `Decimal === number` — infidélité du faux Prisma de test
**Fichier :** `src/lib/queries/__tests__/previsions-charges.test.ts`
**Lignes tsc :** 165 (`r.code` unknown, apparenté), 166 (`Decimal`/`number`)
**`describe` :** `reporterChargeMensuelle — report en lot atomique (story PR2ter.1)`
**`it` :** « ecrase les mois deja saisis dans la plage (update) et cree les autres (create), sans
dupliquer » (ligne 381 : `expect(lignes.every((l) => l.montantFCFA === 500000)).toBe(true)`)

**Ce que le test prétend prouver :** que `reporterChargeMensuelle` écrit bien un montant FCFA de
500 000 sur chaque ligne créée/mise à jour.

**Ce qu'il prouve réellement :** rien sur le type réel du champ. En production,
`ChargeMensuellePrevue.montantFCFA` est un `Decimal` Prisma (`numeric` en base) —
`decimalInstance === 500000` est **toujours `false`** avec le vrai client Prisma (un objet `Decimal`
n'est jamais `===` à un `number`, même si sa valeur logique est identique). Le test passe uniquement
parce que le « faux Prisma » de ce fichier (un store en mémoire construit à la main, cf. `stores.*`)
stocke des `number` natifs plutôt que des `Decimal` — le mock est **infidèle au type réel du
runtime Prisma**, pas seulement à ses valeurs. La même famille se retrouve ligne 400
(`expect(moisDeux?.montantFCFA).toBe(500000)`), non signalée par `tsc` cette fois précisément parce
que ce site n'a pas d'erreur de compilation (le literal `500000` est comparé à un champ typé `number`
dans le store local, cohérent avec lui-même — la preuve manque, mais silencieusement).

---

## 2. Famille complète — 178/178 confirmées, zéro en production

```
npx tsc --noEmit 2>&1 | grep -c "error TS"   → 178
grep "error TS" | grep -v __tests__          → 0 résultat (confirmé, zéro erreur hors test)
```

### Classification par catégorie de « vide de sens »

| Catégorie | Compte | Gravité |
|---|---|---|
| **A — Membre d'enum/union inexistant** (fixture impossible en base) | **11** | **Grave** |
| **B — Comparaison de types runtime incompatibles** (Decimal/number, instanceof invalide) | **2** | **Grave** |
| **C — Mock auto-référentiel** (recoupe A pour PhaseLot, listé une fois dans A) | *(inclus dans A)* | **Grave** |
| **D — Fixture drift mécanique** (DTO enrichi, fixture non suivie — mais **cassé au typage**, donc visible, pas silencieux) | **~96** | Moyenne |
| **E — Cosmétique pur** (typage de helper/mock, import, excès de propriété sans effet sur l'assertion) | **~69** | Basse |

Le détail ligne-par-ligne des 178 (fichier + n° de ligne + code TS) a été établi lors de l'analyse
et est reproductible par `npx tsc --noEmit | grep "error TS"` — non recopié intégralement ici pour
rester lisible ; les extraits significatifs sont cités dans chaque section.

### Catégorie A — membre d'enum/union inexistant (11)

| Fichier:ligne | Valeur fictive | Valeur(s) réelle(s) (schema.prisma / types.ts) |
|---|---|---|
| `abonnement-checkout-flow.test.ts:405,432,458` | `TypeRemise.POURCENTAGE`, `TypeRemise.FIXE` (×2) | `EARLY_ADOPTER\|SAISONNIERE\|PARRAINAGE\|COOPERATIVE\|VOLUME\|MANUELLE` |
| `rappels-abonnement.test.ts:83` | `TypePlan.PRO` | `DECOUVERTE\|ELEVEUR\|PROFESSIONNEL\|ENTREPRISE\|INGENIEUR_STARTER\|INGENIEUR_PRO\|INGENIEUR_EXPERT\|EXONERATION` |
| `releves-form-lot-mode.test.tsx:147` | `TypeSystemeBac.BASSIN` | `BAC_BETON\|BAC_PLASTIQUE\|ETANG_TERRE\|RAS` |
| `reproduction-kpis.test.ts:335,336,361,378` | `"LARVE"`, `"ALEVIN"` (×4, cf. cas (b)) | `PhaseLot` = `INCUBATION\|LARVAIRE\|NURSERIE\|ALEVINAGE\|SORTI\|PERDU` |
| `rapprochement-vue-rattachement.test.tsx:65,164` | `couleur: "favorable"` (×2) | `CouleurEcart` (`src/lib/previsions/types.ts:122`) = `"vert"\|"orange"\|"rouge"\|"neutre"` |

Le cas `CouleurEcartDTO` est structurellement identique au cas (b) : la fixture pose `couleur:
"favorable"`, `sens: "FAVORABLE"` — le vrai moteur (`rapprochement.ts:180`,
`teinteDuSens`) ne produit **jamais** `"favorable"`, seulement `"vert"|"orange"|"rouge"|"neutre"`.
Le composant testé (`RapprochementVueMensuelle`) et la table de correspondance
(`rapprochement-ui-helpers.ts`) reçoivent une valeur que le moteur réel ne peut jamais leur envoyer —
si un `switch`/table de correspondance n'a pas d'entrée par défaut cohérente, ce test masque un
défaut d'affichage réel (case manquante) derrière une valeur qui n'existera jamais.

### Catégorie B — comparaison de types runtime incompatibles (2)
- `previsions-charges.test.ts:166` — `Decimal === number` (cas (c) détaillé ci-dessus)
- `bac-performance.test.ts:131` — `instanceof` sur un type non objet (`TS2358`) : un test qui
  vérifie une classe d'erreur via `instanceof` sur une valeur dont le type ne peut structurellement
  jamais être un objet — même famille (le test ne peut jamais avoir échoué pour la bonne raison).

### Catégorie D — fixture drift (~96, dette « visible » pas « silencieuse »)
Sous-familles principales (chacune = un seul DTO/type enrichi côté production, fixtures non
suivies) :
- **`Releve`/`ReleveCtx` (46 erreurs)** — `calculs.test.ts` (5), `density-calculs.test.ts` (11),
  `density-integration.test.ts` (3), `survie-calculs.test.ts` (19), `transfert-entrant-callers.test.ts`
  (8) : toutes échouent sur l'absence de `nombreVendus`/`nombreTransferes`/`transfertGroupeId` dans
  les fixtures. Un seul type a évolué (probablement à l'occasion des stories de transfert entre
  bacs) ; une factory de fixture partagée corrigerait sans doute les 46 d'un coup.
- **`RegleActivite`/`ConfigElevage` (5 erreurs)** — `activity-engine/evaluator.test.ts`,
  `generator.test.ts`, `feeding.test.ts`, `density-evaluator.test.ts`, `density-integration.test.ts`.
- **`PlanAdminItem.modulesInclus` (13 erreurs)** — `plan-form-dialog.test.tsx` — DTO d'admin des
  plans d'abonnement, champ ajouté et non répercuté dans les fixtures de test.
- **`FCRBacPeriode` (12 erreurs)** — `fcr-by-feed.test.ts` — `poidsDebutG`, `poidsFinG`,
  `populationMethode`, `populationDebut` et 3 autres champs manquants.
- **Prévisions (6 erreurs)** — `previsions-route-orchestration.test.ts` (`tresorerieInitialeFCFA`,
  `posteReferentielId` manquants), `previsions-rapprochement-unite-aliment.test.ts`
  (`AlimentArticlePourCalcul` incomplet), `previsions-postes-referentiel-admin-integration.test.ts`
  (`LigneRapprochement.previsionnel` n'existe plus/pas), `route-orchestration-builder.ts`
  (helper de fixture partagé, pas un fichier `.test.ts` lui-même — propage l'erreur à ses appelants).
- **`AnalytiqueAliment` (3 erreurs)** — `analytics-aliments.test.tsx` — `tailleGranule`,
  `formeAliment`, `tauxProteines`, `adgMoyen` et 2 autres manquants.
- **`VagueSummaryResponse` (2 erreurs)** — `vagues-page.test.tsx` — `poidsObjectifKg`, `biomasse`,
  `totalVenduKg`, `vaguePrevueId` manquants.

### Catégorie E — cosmétique pur (~69)
`Element` vs `HTMLElement` sur `charges-tab.test.tsx` (7) ; conversion générique `Record<string,
Record<string,string>>` sur les tests i18n `messages-sprint40/41.test.ts` (9) ; `params:
{ id }` synchrone vs `Promise<{id}>` (Next 15) sur `remises.test.ts` (3) — mécanique, sans risque
runtime (`await` sur une valeur non-Promise fonctionne) ; `null` vs `undefined` sur les fixtures
`calibrages-bug040/048.test.ts` (4) ; spread sur tuple (`assignation-date-alignment.test.ts`,
`su12-numero-unique-par-site.test.ts`) (3) ; excès de propriété sur objet littéral
(`releve-form-validation-lot-mode.test.ts` 12, `validation.test.ts` 9 — cf. §5) ; mock de fonction de
traduction i18n mal typé (`gompertz-feed-comparison.test.tsx`, 3) ; `KeyboardEvent` vs événement Radix
réel (`use-dialog-close-guard.test.ts`, 2) ; union restreinte `Permission`/`SiteModule` dans
`farm-nav.test.ts` (2, typage interne du composant, pas une fixture) ; conflit de globals
Playwright/Vitest sur `conservation-flow.spec.ts` (2, fichier non exécuté par `vitest`) ; module
inexistant sur `ci-db-guard.test.ts` (1) ; `it.each` typé strictement sur
`sluggifier-poste-parite-sql.test.ts` (1).

**Cas borderline signalé, pas classé « vide de sens » mais à surveiller —
`su12-numero-unique-par-site.test.ts:106,124,163,175`** : les mocks `create` du type
`{ id: mockId, ...data }` se font écraser leur `id` si `data` en porte déjà un (spread après la
clé). Sans effet démontré sur les assertions actuelles (le fichier teste l'unicité `(siteId,
numero)`, pas l'unicité des `id`), mais c'est un pattern de mock fragile qui pourrait un jour cacher
une vraie collision d'ID — noté pour @knowledge-keeper, pas corrigé ici.

---

## 3. Balayage grep — tests vides de sens que `tsc` ne voit pas
- `expect(true).toBe(true)`, `expect(1).toBe(1)`, `expect(false).toBe(false)` : **0 occurrence**.
- `it.skip`/`xit`/`describe.skip`/`xdescribe` hors du test méta dédié : **0 occurrence** — le seul
  fichier qui mentionne ces motifs est `src/__tests__/meta/db-gated-tests-registry.test.ts`, qui les
  cite comme motifs à *détecter*, conformément à ADR-052 §6 (registre d'allowlist).
- `.toBeDefined()` en fin de ligne : 41 occurrences réparties dans le dépôt — trop nombreuses pour
  une revue exhaustive dans ce budget ; à noter comme **zone grise non auditée** : `toBeDefined()`
  sur un mock qu'on vient soi-même de peupler est une assertion faible par construction, mais
  légitime dans beaucoup de contextes (garde avant `!`-assertion, ex. `reproduction-kpis.test.ts`
  déjà cité). Recommandation : ne pas traiter comme famille « vide de sens » sans revue fichier par
  fichier — hors périmètre de ce budget de pré-analyse.
- Aucun `describe` sans `it` n'a été détecté par une recherche structurelle rapide, mais ce point
  n'a pas été vérifié exhaustivement (nécessiterait un parseur AST, pas un grep).

---

## 4. Cas FACTURATION — comportements de production à examiner (signalés, non corrigés)
1. **`initierPaiement` appelée avec un `SITE_ID` en 3ᵉ position** dans 5 tests d'intégration
   checkout — la vraie signature n'a que `(abonnementId, userId, params)`. Soit le test ne prouve
   rien sur le scoping multi-site du paiement (R8), soit — à vérifier par un agent implémenteur —
   la fonction `initierPaiement` elle-même devrait accepter/vérifier un `siteId` et ne le fait pas :
   dans les deux cas, une incohérence entre le contrat testé et le contrat réel sur un chemin de
   paiement.
2. **`CouleurEcartDTO`/`sens` avec des valeurs `"favorable"`/`"FAVORABLE"` inexistantes côté moteur**
   — si la table de correspondance UI (`rapprochement-ui-helpers.ts`) n'a pas d'entrée par défaut
   robuste, une valeur `CouleurEcart` que le moteur ne produit jamais mais que le test « valide »
   masque potentiellement une case UI manquante sur un écran de rapprochement financier
   (prévu/réel).
3. **`Decimal === number` sur `montantFCFA`** — comportement de production non examiné ici (le
   store de test est un mock, pas le code de prod), mais le pattern signale qu'aucun test de cette
   suite ne peut aujourd'hui distinguer un `Decimal` mal formé d'un `Decimal` correct, sur un champ
   monétaire.

Aucune correction proposée conformément à la consigne — signalé pour triage ultérieur.

---

## 5. Critère de tri de gravité et ordre de traitement proposé

**Critère retenu :** est-ce que l'erreur *dissimule* un défaut (le test est vert malors qu'il ne
devrait pas l'être), ou se contente-t-elle de *bloquer* la compilation d'un test par ailleurs
honnête (le test échoue à `tsc`, donc personne n'est trompé, seulement bloqué) ?

| Ordre | Catégorie | Nb | Absorbable en 1 sprint ? |
|---|---|---|---|
| 1 | **A — enum/union impossible** (dissimule, le plus grave) | 11 | Oui — corrections ciblées, un fichier à la fois, chacune doit être **rejouée avec falsification** (casser la vraie règle, vérifier que le test tombe) conformément à ERR-189/ERR-193, pas seulement recompilée |
| 2 | **B — Decimal/instanceof** (dissimule) | 2 | Oui, mais nécessite de vérifier si le « faux Prisma » du fichier doit être remplacé par un vrai `Decimal` partout où `montantFCFA`/`prixSacFCFA`/etc. sont comparés — risque de révéler d'autres comparaisons du même fichier non signalées par `tsc` (ex. ligne 400 citée en §1(c)) |
| 3 | **D — fixture drift** (bloque, ne dissimule pas) | ~96 | Oui pour le sous-cas `Releve`/`ReleveCtx` (46, une factory partagée) et `RegleActivite` (5) — mécanique et à faible risque. **Non** en un seul lot pour les DTO prévisions/plan/FCR (35 restants) : chacun mérite une vérification qu'aucun champ manquant ne change le comportement testé (cf. ERR-186 : ne pas rendre un champ optionnel « pour que ça compile ») |
| 4 | **E — cosmétique** | ~69 | Oui, batchable, risque quasi nul — mais à ne traiter qu'**après** A/B/D pour ne pas polluer le signal (corriger 69 lignes cosmétiques en premier masquerait la baisse du compteur qui doit rester traçable pour A/B/D) |

**Hors périmètre explicitement recommandé, avec critère :**
- Le balayage exhaustif des 41 occurrences `.toBeDefined()` et la recherche AST de `describe` sans
  assertion réelle — critère : nécessite un outillage (AST) ou une revue fichier-par-fichier qui
  dépasse un budget de pré-analyse ; à confier à un sprint dédié « audit qualité tests » avec son
  propre budget, pas mélangé à la résorption `tsc`.
- Le cas borderline `su12-numero-unique-par-site.test.ts` (spread `id` écrasé) — critère : aucun
  effet démontré sur les assertions actuelles ; à noter pour @knowledge-keeper, pas à corriger
  préventivement sans un cas d'usage qui le justifie.

---

## 6. État de référence — AVANT/APRÈS, sans modification

### `typecheck-budget.txt` / `scripts/typecheck-budget.sh`
- `typecheck-budget.txt` = **178** (seuil déclaré)
- `npx tsc --noEmit | grep -c "error TS"` mesuré = **178** → **conforme au seuil**, aucune régression
- Le script documente lui-même sa propre limite (§ « Défaut connu de ce garde-fou ») : c'est un
  total agrégé sans distinction de gravité — exactement le trou que cette pré-analyse comble
  partiellement (catégories A-E ci-dessus).

### Suite `vitest` complète (avec `source .env`)
```
Test Files  1 failed | 345 passed (346)
Tests       7 failed | 9796 passed | 26 todo (9829)
```
**Ne correspond PAS exactement à la baseline annoncée** (346 fichiers / 9803 tests / 26 todo / 0
skip / 0 échec) au moment de la mesure — 7 échecs dans
`src/types/__tests__/previsions-eligibilite-produit-alimentaire.test.ts` (« … is not a function »
sur `evaluerEligibiliteProduitAlimentairePrevision »).

**Cause identifiée, hors périmètre T2 :** `git status` montre `src/types/api.ts` modifié et non
committé au moment de la mesure — un autre agent édite ce fichier en parallèle de cette
pré-analyse. C'est exactement le piège méthodologique nommé par **ERR-194** : mesurer pendant qu'un
autre agent modifie le dépôt produit un faux signal. Recommandation : ne pas traiter ces 7 échecs
comme une régression réelle sans une remesure sur un dépôt stable (aucun `git status` en cours). Le
compte de fichiers (346) et le compte todo (26) correspondent bien à la baseline ; seul le nombre
d'échecs diverge, et de façon localisée à un seul fichier cohérent avec la modification concurrente
observée.

### Base de dev partagée EXCEL-V12 — lecture seule stricte respectée
**Avant :**
```
scenario=1 | vague_prevue=19 | effectif_total=602500 | aliment_prevision=3 | aliment_article=3
palier_remise=4 | apport_capital_sum=30000000 | journal_sum=34400000
poste_ref_actifs=4 | poste_ref_total=4 | poste_prevision=4 | mapping_rapprochement=0
```
→ **Conforme intégralement** à l'état de référence attendu.

**Pendant** (capté au milieu de l'exécution `vitest`, qui exerce les tests DB-gated contre cette même
base) : un comptage transitoire a montré `scenario=2` — un second `ScenarioPrevision` existait
momentanément, très probablement créé et nettoyé par un test d'intégration DB-gated de la suite
(setup/teardown), ou par un autre agent actif au même instant. **Aucune écriture n'a été effectuée
par cette pré-analyse** (uniquement des `SELECT`).

**Après** (3 mesures consécutives, stabilisées) :
```
scenario=1 (id cmsdnypml0000n4ekuadykn0f, "Plan de reference Excel v12", createdAt/updatedAt
identiques à l'état initial) | vague_prevue=19 | effectif_total=602500 | ...
```
→ **Identique à l'état initial, ligne par ligne, y compris `createdAt`/`updatedAt` inchangés** :
EXCEL-V12 est intact.

---

## Verdict final

**Nombre réel de tests de cette famille (« vide de sens », toutes sous-catégories confondues, hors
zone grise non auditée) : 178 erreurs `tsc`, réparties sur 41 fichiers de test, dont environ 13
erreurs relèvent strictement de la famille « dissimule un défaut » (catégories A+B) et méritent un
traitement prioritaire immédiat ; les ~165 restantes bloquent la compilation sans dissimuler
activement un comportement (catégories D+E) mais empêchent `tsc --noEmit` d'être un signal fiable
tant qu'elles subsistent.**

**Verdict : GO** pour un sprint de correction, avec l'ordre de traitement du §5 (A → B → D
`Releve`/`RegleActivite` → D reste → E), à condition que :
1. chaque correction de catégorie A/B soit accompagnée d'une **falsification rejouée** (ERR-189/
   ERR-193), pas seulement d'une recompilation verte ;
2. les 7 échecs `vitest` actuels sur `previsions-eligibilite-produit-alimentaire.test.ts` soient
   **remesurés sur un dépôt stable** avant d'être traités comme régression réelle (ERR-194) ;
3. le point « facturation » du §4 (arité `initierPaiement`, `CouleurEcartDTO` non couvert par le
   moteur) soit transmis pour triage séparé, pas noyé dans le lot mécanique de catégorie D.

**Hors périmètre recommandé pour ce sprint, avec critère explicite (§5) :** l'audit AST des
41 `.toBeDefined()` et des `describe` sans assertion réelle.
