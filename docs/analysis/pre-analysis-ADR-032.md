# Pré-analyse ADR-032 — Calibrage-aware nombreVivants + suppression GOMPERTZ_BAC

**Date :** 2026-04-05
**Analysé par :** @pre-analyst

---

## Statut : GO AVEC RÉSERVES

---

## Résumé

L'ADR-032 est faisable immédiatement. Le build est vert, les tests feed-periods passent tous
(90/90). Les modèles Calibrage et CalibrageGroupe sont bien présents dans le schéma et
contiennent tous les champs requis. Les 24 tests actuellement en échec sont tous dans des
fichiers non liés à l'ADR (middleware, vagues, abonnements) et constituent une dette de test
pré-existante. La réserve principale : trois fichiers de messages i18n (JSON) contiennent des
clés GOMPERTZ_BAC à supprimer — non mentionnés dans l'ADR.

---

## Vérifications effectuées

### Schema (Calibrage/CalibrageGroupe) : OK

Le modèle `Calibrage` (ligne 2300) et `CalibrageGroupe` (ligne 2332) existent dans
`prisma/schema.prisma`. Les champs requis par l'ADR sont présents :

| Champ | Modèle | Présent |
|-------|--------|---------|
| `date` | Calibrage | Oui |
| `nombreMorts` | Calibrage | Oui |
| `groupes` | Calibrage → CalibrageGroupe[] | Oui |
| `destinationBacId` | CalibrageGroupe | Oui |
| `nombrePoissons` | CalibrageGroupe | Oui |
| `poidsMoyen` | CalibrageGroupe | Oui |

Aucune migration de schéma requise pour Phase B (confirme ADR).

### Schema (GompertzBac/StrategieInterpolation) : PRÉSENT, À SUPPRIMER

- `enum StrategieInterpolation` : lignes 430-434, valeur `GOMPERTZ_BAC` à ligne 433
- `model GompertzBac` : lignes 3100-3153
- Relations sur `Site` (ligne 562), `Bac` (ligne 1006), `Vague` (ligne 1056)
- Migration existante : `prisma/migrations/20260421000000_add_gompertz_bac/migration.sql`

Phase A requiert une migration RECREATE (approche établie dans ERRORS-AND-FIXES.md via ERR-038).
Les `ConfigElevage` avec `interpolationStrategy = GOMPERTZ_BAC` devront être castées vers
`GOMPERTZ_VAGUE` dans la migration SQL.

### Types ↔ Schema : COHÉRENT, TOUCHES MULTIPLES

Fichiers touchés par Phase A (suppression GOMPERTZ_BAC) :

| Fichier | Ligne(s) | Action |
|---------|----------|--------|
| `src/types/models.ts` | 1992, 2002 | Supprimer valeur enum `GOMPERTZ_BAC` |
| `src/types/models.ts` | 2264-fin | Supprimer interface `GompertzBac` (~20 lignes) |
| `src/types/index.ts` | 154-155 | Supprimer l'export `GompertzBac` |
| `src/types/calculs.ts` | 664 | Supprimer `"GOMPERTZ_BAC"` de union `methodeEstimation` |
| `src/types/calculs.ts` | 746 | Supprimer `"GOMPERTZ_BAC"` de `MethodeEstimationPoids` |
| `src/types/calculs.ts` | 808 | Simplifier `FCRTraceEstimationGompertz.methode` à `"GOMPERTZ_VAGUE"` seulement |
| `src/types/calculs.ts` | 905 | Supprimer champ `gompertzBac: FCRTraceGompertzParams \| null` de `FCRTracePeriode` |

### API ↔ Queries : GOMPERTZ_BAC OMNIPRÉSENT

Fichiers touchés par Phase A dans la couche logique/API :

| Fichier | Lignes clés | Action |
|---------|-------------|--------|
| `src/lib/feed-periods.ts` | 68-94 | Supprimer `GompertzBacContext` interface |
| `src/lib/feed-periods.ts` | 100-133 (signature) | Supprimer `gompertzBacContexts` des options |
| `src/lib/feed-periods.ts` | 169-206 | Supprimer bloc `// 2a. Gompertz per-tank strategy` |
| `src/lib/feed-periods.ts` | 211-212 | Simplifier condition du fallback GOMPERTZ_VAGUE |
| `src/lib/feed-periods.ts` | 332-351 | Remplacer `estimerNombreVivants` par `estimerNombreVivantsADate` (Phase B) |
| `src/lib/feed-periods.ts` | 384-387 | Supprimer `gompertzBacContexts` des options de `segmenterPeriodesAlimentaires` |
| `src/lib/feed-periods.ts` | 470-481 | Simplifier `methodeRank` : supprimer case `GOMPERTZ_BAC` (rank 3→supprimé) |
| `src/lib/queries/analytics.ts` | 54 | Supprimer import `GompertzBacContext` |
| `src/lib/queries/analytics.ts` | 546-556 | Supprimer `gompertzBacs` de la requête Prisma `computeAlimentMetrics` |
| `src/lib/queries/analytics.ts` | 704-735 | Supprimer bloc construction `gompertzBacContexts` |
| `src/lib/queries/analytics.ts` | 2511-2521 | Supprimer `gompertzBacs` de la requête Prisma `getFCRTrace` |
| `src/lib/queries/analytics.ts` | 2631-2658 | Supprimer bloc construction `gompertzBacContexts` dans `getFCRTrace` |
| `src/lib/queries/analytics.ts` | 2759-2799 | Supprimer calcul `gompertzBacParams` + champ `gompertzBac` dans période trace |
| `src/app/api/vagues/[id]/gompertz/route.ts` | 251-410 | Supprimer boucle per-bac complète (ADR-030 loop) |
| `src/app/api/vagues/[id]/gompertz/route.ts` | 144, 183, 228 | Supprimer `calibrationsBacs: []` des réponses early-return |
| `src/app/api/vagues/[id]/gompertz/route.ts` | 413 | Supprimer `calibrationsBacs` de la réponse finale |

### Navigation ↔ UI : TOUCHES UI IDENTIFIÉES

| Fichier | Lignes clés | Action |
|---------|-------------|--------|
| `src/components/analytics/fcr-transparency-dialog.tsx` | 29-31, 42-45 | Supprimer `GOMPERTZ_BAC` du type local `MethodeEstimation` et du `config` objet |
| `src/components/analytics/fcr-transparency-dialog.tsx` | 128 | Simplifier la condition `if (detail.methode === "GOMPERTZ_BAC" \|\| ...)` |
| `src/components/analytics/fcr-transparency-dialog.tsx` | 439-444 | Supprimer case `traceData.strategieInterpolation === "GOMPERTZ_BAC"` |
| `src/components/config-elevage/config-elevage-form-client.tsx` | 720-723 | Supprimer `<option value={StrategieInterpolation.GOMPERTZ_BAC}>` |

### Fichiers i18n : NON MENTIONNÉS DANS L'ADR — À TRAITER

Trois fichiers JSON contiennent des clés GOMPERTZ_BAC qui provoqueront des erreurs ou
des clés orphelines après la suppression :

| Fichier | Lignes | Clé(s) à supprimer |
|---------|--------|---------------------|
| `src/messages/fr/analytics.json` | 276 (`gompertzBac`), 301 (`stratGOMPERTZ_BAC`) | Deux clés |
| `src/messages/en/analytics.json` | 276 (`gompertzBac`), 301 (`stratGOMPERTZ_BAC`) | Deux clés |
| `src/messages/fr/config-elevage.json` | 87 (`GOMPERTZ_BAC`) | Une clé dans `interpolationStrategy` |

Le composant `fcr-transparency-dialog.tsx` appelle `t("gompertzBac")` et `t("stratGOMPERTZ_BAC")`
via `useTranslations`. Si les clés sont supprimées du JSON sans supprimer les appels `t()`,
next-intl lèvera une erreur au runtime. L'implémenteur doit traiter les deux ensemble.

### Fichiers générés (src/generated/prisma/) : À REGÉNÉRER

20 fichiers dans `src/generated/prisma/` contiennent des références à `GOMPERTZ_BAC` ou
`GompertzBac`. Ces fichiers sont auto-générés par `npx prisma generate`. Ils seront
recréés automatiquement après la migration + `prisma generate` — ne pas éditer
manuellement.

### Tests : 90/90 FEED-PERIODS PASSENT — DETTE PRÉ-EXISTANTE

- `src/__tests__/lib/feed-periods.test.ts` : **90/90 passent** (incluant les 20+ tests ADR-030)
- Tests en échec pré-existants (24 failures, non liés à l'ADR) :
  - `proxy-redirect.test.ts` (3 failures — middleware INGENIEUR)
  - `permissions.test.ts` (1 failure — compte permissions)
  - `abonnements-statut-middleware.test.ts` (8 failures — mocking)
  - `bacs.test.ts` (1 failure — quota DECOUVERTE)
  - `vagues-distribution.test.ts` (4 failures — DB mock)
  - `vagues.test.ts` (4 failures — DB mock)
  - `quota-enforcement.test.ts` (1 failure)
  - `proxy-redirect.test.ts` (2 autres failures)
- Ces 24 failures sont antérieures à ADR-032 et n'affectent pas la fiabilité du travail.

### Build : OK

`npm run build` passe sans erreur. Un seul avertissement non bloquant sur `outputFileTracingRoot`
(pré-existant, non lié à l'ADR).

---

## Inventaire complet des fichiers impactés

### Phase A — Suppression GOMPERTZ_BAC

| # | Fichier | Nature | Lignes approximatives |
|---|---------|--------|-----------------------|
| 1 | `prisma/schema.prisma` | Supprimer enum value + model + relations | 430-434, 562, 1006, 1056, 3088-3153 |
| 2 | `prisma/migrations/` | Créer migration RECREATE | Nouveau fichier |
| 3 | `src/types/models.ts` | Supprimer enum value + interface | 1992, 2002, 2264-~2295 |
| 4 | `src/types/index.ts` | Supprimer export | 154-155 |
| 5 | `src/types/calculs.ts` | Supprimer 4 occurrences dans types | 664, 746, 808, 905 |
| 6 | `src/lib/feed-periods.ts` | Supprimer GompertzBacContext + bloc 2a + options + methodeRank | ~68-94, 129-132, 169-206, 384-387, 470-481 |
| 7 | `src/lib/queries/analytics.ts` | Supprimer gompertzBacs queries + contexts | 546-556, 704-735, 2511-2521, 2631-2658, 2759-2799 |
| 8 | `src/app/api/vagues/[id]/gompertz/route.ts` | Supprimer boucle per-bac + calibrationsBacs | 144, 183, 228, 251-410, 413 |
| 9 | `src/components/analytics/fcr-transparency-dialog.tsx` | Supprimer GOMPERTZ_BAC badge + stratégie | 29-31, 42-45, 128, 439-444 |
| 10 | `src/components/config-elevage/config-elevage-form-client.tsx` | Supprimer option GOMPERTZ_BAC | 720-723 |
| 11 | `src/messages/fr/analytics.json` | Supprimer 2 clés i18n | 276, 301 |
| 12 | `src/messages/en/analytics.json` | Supprimer 2 clés i18n | 276, 301 |
| 13 | `src/messages/fr/config-elevage.json` | Supprimer 1 clé i18n | 87 |
| 14 | `src/__tests__/lib/feed-periods.test.ts` | Supprimer/adapter 20+ tests ADR-030 | 32, 1148-1577, 1644-1781 |

### Phase B — Calibrage-aware nombreVivants

| # | Fichier | Nature | Lignes |
|---|---------|--------|--------|
| 15 | `src/lib/feed-periods.ts` | Ajouter `CalibragePoint`, update `VagueContext`, remplacer `estimerNombreVivants` | 34-39, 332-351 |
| 16 | `src/lib/queries/analytics.ts` | Inclure `calibrages + groupes` dans 2 requêtes, construire VagueContext | ~530-560, ~2500-2520 |
| 17 | `src/__tests__/lib/feed-periods.test.ts` | Ajouter cas calibrage-aware | Nouveau bloc après ligne 2088 |

**Total : 17 fichiers** (14 src + 2 messages + 1 nouveau test + 1 nouvelle migration)

---

## Risques identifiés

### R1 — Migration RECREATE pour StrategieInterpolation (Haute)
La migration doit : renommer l'ancien enum, créer le nouveau sans GOMPERTZ_BAC, caster
les colonnes (ConfigElevage.interpolationStrategy), supprimer l'ancien enum, puis DROP
TABLE GompertzBac. Les ConfigElevage avec `interpolationStrategy = GOMPERTZ_BAC` doivent
être migrées vers `GOMPERTZ_VAGUE` dans le CAST. Consulter ERR-038 : inspecter le SQL
généré avant validation pour éviter la dérive de schéma.

### R2 — FCRTracePeriode.gompertzBac : champ dans la réponse API (Haute)
`FCRTracePeriode.gompertzBac` est un champ de la réponse de `GET /api/analytics/aliments/[id]/fcr-trace`.
Les consommateurs de cette API (y compris `fcr-transparency-dialog.tsx`) font référence à
`periode.gompertzBac`. Après suppression, ce champ disparaît du type TypeScript et du JSON.
Il faut s'assurer que le composant UI ne référence pas `.gompertzBac` à un endroit non identifié.

### R3 — FCRTraceEstimationGompertz.methode union type (Moyenne)
`FCRTraceEstimationGompertz.methode` est actuellement `"GOMPERTZ_BAC" | "GOMPERTZ_VAGUE"`.
Après suppression, ce devient `"GOMPERTZ_VAGUE"` seulement. Le `if (detail.methode === "GOMPERTZ_BAC" || detail.methode === "GOMPERTZ_VAGUE")` dans `fcr-transparency-dialog.tsx`
(ligne 128) doit être simplifié en `if (detail.methode === "GOMPERTZ_VAGUE")`.

### R4 — Nombre de vivants per-bac dans tests ADR-030 (Basse)
Les 3 describe blocks de tests ADR-030 (lignes 1177-1781) représentent ~60 tests.
Leur suppression ne doit pas réduire la couverture des cas valides (GOMPERTZ_VAGUE,
fallbacks). Les tests GOMPERTZ_VAGUE dans le bloc `segmenterPeriodesAlimentaires —
strategie GOMPERTZ_BAC` qui testent le fallback vers GOMPERTZ_VAGUE doivent être
conservés ou convertis.

---

## Prérequis manquants

Aucun prérequis bloquant. Le modèle Calibrage est présent depuis Sprint 24. Toutes les
dépendances déclarées dans l'ADR (ADR-028, ADR-029) sont satisfaites.

---

## Points d'attention pour l'implémenteur

1. **Fichiers i18n** : non listés dans l'ADR mais obligatoires. Supprimer les clés
   `gompertzBac` et `stratGOMPERTZ_BAC` dans `fr/analytics.json`, `en/analytics.json`,
   et `GOMPERTZ_BAC` dans `fr/config-elevage.json` en même temps que les appels `t()`.

2. **Ordre des phases** : faire Phase A en premier (ADR recommande). La migration
   RECREATE doit passer avant toute modification du code TypeScript pour éviter les
   erreurs Prisma Client sur GompertzBac.

3. **`calibrationsBacs` dans la réponse de l'endpoint gompertz** : ce champ est
   retourné dans 4 endroits du fichier route.ts. Le supprimer partout (early-returns
   aux lignes 144, 183, 228 et réponse finale ligne 413).

4. **Pas de migration pour Phase B** : confirmé par l'ADR. Calibrage + CalibrageGroupe
   ont tous les champs requis. Seulement des modifications de requêtes Prisma.

5. **methodeRank** : après suppression de GOMPERTZ_BAC (rank 3), le rang 4 (BIOMETRIE_EXACTE)
   reste inchangé. La fonction peut être simplifiée en supprimant le case rank 3.

---

## Recommandation

**GO** — Commencer l'implémentation.

Les conditions sont réunies : build vert, tests feed-periods 90/90, modèles DB présents,
ADR complet et précis. L'implémenteur doit traiter les fichiers i18n (non mentionnés dans
l'ADR) comme partie intégrante de Phase A. Les 24 tests en échec pré-existants ne sont
pas des blockers pour ce travail.
