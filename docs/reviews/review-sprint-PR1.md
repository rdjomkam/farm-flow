# Review Sprint PR1 — Module Prévisions (moteur + fondations)

**Reviewer :** @code-reviewer
**Sprint :** PR1
**Verdict global : VALIDÉ AVEC RÉSERVES**

Aucune réserve bloquante. Le périmètre couvre PR1.0 à PR1.4 (dépendance decimal.js, schéma +
migrations, types, moteur, recette contre jeu d'or). Référence : ADR-053, fichier de sprint
`docs/sprints/SPRINT-PR1-PREVISIONS.md`.

**Périmètre revu :**
- PR1.0 — dépendance `decimal.js`
- PR1.1 — schéma Prisma (13 modèles, `siteId` partout), migrations `20260803120000`
  (enum `Permission` +4 valeurs, `SiteModule` +1 valeur), `20260803120200` (backfill)
- PR1.2 — miroir TypeScript (`src/types/models.ts`, `src/types/index.ts`)
- PR1.3 — moteur de calcul (`src/lib/previsions/*.ts`, dont `logistique.ts` et ajouts à
  `aliments.ts`)
- PR1.4 — recette contre jeu d'or (842 tests, `extract-golden.py`, `helpers.ts`,
  `orchestration.ts`)

---

## Suivi des réserves des reviews de story précédentes

| Story | Réserve | Statut |
|-------|---------|--------|
| PR1.1 (schéma) | Le miroir TS de `Permission` cassait un test de garde-fou | **LEVÉE** — groupe `previsions` ajouté à `src/lib/permissions-constants.ts`, 17 groupes attendus et trouvés dans `src/__tests__/permissions.test.ts` |
| PR1.2 (types) | Vérification exécutable non faite | **LEVÉE** — types alignés champ à champ, barrel correct (enums en `export {}`, interfaces en `export type {}`) |
| PR1.2 (types) | Coordination backfill | **LEVÉE** — les 4 permissions du backfill `20260803120200` correspondent exactement à celles ajoutées par `20260803120000` et au miroir TS |
| PR1.3 (moteur) | Réserve 1 — `sacsCalcules`/`sacsSaisis` en `Decimal` | **Nuancée**, voir ci-dessous |
| PR1.3 (moteur) | Réserve 2 (R9) | **CONFIRMÉE OK** |
| PR1.3 (moteur) | Réserve 3 (gap transport) | **COMBLÉE** par `src/lib/previsions/logistique.ts` |

### Nuance sur la réserve 1 (PR1.3)

Ce n'est pas une violation isolée de R3. La convention du dépôt est que TOUT `Decimal` Prisma se
mappe en `number` TS, y compris pour des montants — le typage est donc conforme. Le point
substantiel est ailleurs : le schéma déclare `AlimentParVaguePrevue.sacsCalcules`/`sacsSaisis` en
`Decimal(65,30)` alors que la valeur est par construction toujours un entier (ADR-053 §4 :
« nombre de sacs pour achat reste un `number`/`Int` »).

**Recommandation : passer ces champs en `Int`/`Int?` via une migration dédiée, à trancher AVANT
d'écrire les routes API de PR2.**

---

## Points spécifiques examinés

### `logistique.ts` et ajouts à `aliments.ts`
Purs, typage correct, JSDoc, aucun `any`, exports au barrel. Sémantique de la remise vérifiée
correcte : décidée une seule fois sur le total du cycle de la vague, puis le montant remisé est
ventilé par pourcentages mensuels — jamais recalculée mois par mois. Testé sur la vague V7 (15 t,
remise 6 %).

### Recette (842 tests)
Ne réimplémente aucune formule du moteur. `helpers.ts` ne contient que le chargement des JSON et
les assertions de tolérance (0 strict sur les entiers, `> 1 FCFA` → échec sur les montants ; un
epsilon flottant 1e-6 sur les kg, documenté comme bruit d'extraction Python, jamais une tolérance
métier). `orchestration.ts` documente sa propre discipline et la respecte. Point exemplaire : le
piège « ceil-après-somme vs somme-de-ceils » est vérifié en rappelant le moteur une seconde fois,
pas en codant un `Math.ceil()` dans le test. Aucun `skip`, `todo` ni `.only`.

### `extract-golden.py`
Purement extractif, lit le classeur via openpyxl `data_only=True`, n'importe jamais le code
applicatif, ne lit aucune variable d'environnement. Seule valeur en dur : `PATCH_B10 = 30000`, qui
est le patch acté par ADR-053 §7.

### R10 — les 3 migrations
Toutes en sous-dossiers, aucun `.sql` à la racine. `20260803120000` = `ADD VALUE` pur (conforme
ERR-001/ERR-083). `20260803120200` = backfill idempotent par `array_cat` + `unnest`/`DISTINCT`,
no-op silencieux, valeur cible et non delta relatif.

### R11
Scan négatif sur tout le périmètre, toutes extensions confondues.

### Périmètre
Aucune route API, page, composant, navigation ni rapprochement. Unique exception assumée et jugée
minimale : entrée `PREVISIONS` dans le `Record<SiteModule, string>` de
`src/components/abonnements/plan-form-dialog.tsx`, requise par l'exhaustivité TypeScript, jamais
rendue à l'exécution puisque `PREVISIONS` n'est pas dans `SITE_MODULES_CONFIG`.

---

## Checklist R1-R11

| Règle | Statut | Note |
|-------|--------|------|
| R1 (enums MAJUSCULES) | ✅ | |
| R2 (import enums) | ✅ | |
| R3 (Prisma=TS) | ✅ | avec la nuance `sacsCalcules`/`sacsSaisis` ci-dessus |
| R4 (opérations atomiques) | ✅ | |
| R5 (DialogTrigger asChild) | N/A | aucun Dialog dans le périmètre |
| R6 (CSS variables du thème) | N/A | aucun UI dans le périmètre |
| R7 (nullabilité) | ✅ | |
| R8 (siteId) | ✅ | les 13 modèles portent `siteId` |
| R9 (tests avant review) | ✅ | |
| R10 (correctif de données = migration) | ✅ | |
| R11 (aucun secret en dur) | ✅ | scan négatif |

Pas de `any`, gestion d'erreurs conforme à la convention du dépôt.

---

## Tableau des réserves (priorisées, aucune bloquante)

| # | Sévérité | Réserve | Traitement |
|---|----------|---------|------------|
| 1 | Haute, avant PR2 | Passer `AlimentParVaguePrevue.sacsCalcules`/`sacsSaisis` de `Decimal` à `Int`/`Int?` | Migration dédiée à écrire avant les routes API de PR2 |
| 2 | Moyenne, au moment de PR3 | La clé i18n `"modules.previsions"` référencée par l'entrée morte de `plan-form-dialog.tsx` n'existe pas dans `src/messages/fr/navigation.json` ni son équivalent `en`. Sans conséquence aujourd'hui (code jamais exécuté), mais régression UI immédiate dès que PR3 rendra le module togglable | À ajouter en même temps que l'entrée dans `SITE_MODULES_CONFIG` |
| 3 | Basse | Modéliser les paramètres de transport (capacités, coûts par voyage) dans Prisma plutôt que de les laisser portés en entrée de fonction | @db-specialist, sprint ultérieur |
| 4 | Cosmétique | Corriger le décalage éditorial ADR-053 §8.3 : « 14 nouveaux modèles » alors que la section 3 en définit 13 | @architect |

Problèmes Critique : aucun. Haute : aucun (réserve 1 est « Haute » au sens produit/dette, mais
non bloquante pour ce sprint — à traiter avant PR2).

---

## Reports vers PR2/PR3 et dettes assumées

- Routes API, UI, navigation, rapprochement prévu/réel (PR2/PR3)
- Décision `Decimal` vs `Int` sur `sacsCalcules`/`sacsSaisis` (réserve 1 ci-dessus)
- Modélisation du transport dans Prisma (réserve 3 ci-dessus)
- `Vague.code` unicité globale (ADR-053 §8.2)
- Gap `dashboard.ts:218` (ADR-053 §8.1)
- Points §9 de l'ADR-053 reportés en Phase 3

---

## Verdict

**VALIDÉ AVEC RÉSERVES.** Aucune réserve n'est bloquante avant merge. La réserve 1
(`Decimal`→`Int`) doit être tranchée avant l'écriture des routes API de PR2 pour éviter de
propager un type structurellement inexact dans les payloads. Les réserves 2 à 4 peuvent suivre le
calendrier normal des sprints PR2/PR3.
