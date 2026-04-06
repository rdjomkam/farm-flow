# Pré-analyse ADR-036 — FCR par aliment (remplacement de `computeAlimentMetrics`)

**Date :** 2026-04-06
**Analysé par :** @pre-analyst
**ADR de référence :** `docs/decisions/ADR-036-fcr-by-feed-algorithm.md`

---

## Statut : GO AVEC RÉSERVES

L'implémentation peut démarrer. Quatre points de divergence entre l'ADR et le code réel
doivent être connus de l'implémenteur. Ils n'empêchent pas le démarrage mais imposent des
ajustements pendant l'implémentation.

---

## Résumé

L'architecture décrite dans l'ADR-036 est cohérente avec le code existant. Les fichiers
référencés existent avec les signatures attendues. La route à supprimer
(`fcr-trace/route.ts`) est bien présente et appelle bien `getFCRTrace`. Le composant
`FCRTransparencyDialog` fait bien un appel API vers `/api/analytics/aliments/[produitId]/fcr-trace`
et devra être refactorisé comme décrit. Quatre divergences mineures ont été identifiées,
détaillées ci-dessous.

---

## Vérifications effectuées

### Schema ↔ Types : OK

Aucune modification de schéma Prisma requise par cet ADR. Les types TypeScript existants
dans `src/types/calculs.ts` sont conformes à ce que l'ADR décrit (présence de `FCRTrace`,
`FCRTraceVague`, `FCRTracePeriode`, `FCRTraceGompertzParams`, `avecInterpolation` dans
`DetailAlimentVague`). Tout correspond.

### API ↔ Queries : OK

- `computeAlimentMetrics` est bien une fonction interne (non exportée) dans
  `src/lib/queries/analytics.ts`, confirmé par grep — l'ADR est correct.
- `getFCRTrace` est bien une fonction publique exportée dans `analytics.ts`, confirmé.
- La route `GET /api/analytics/aliments/[produitId]/fcr-trace/route.ts` existe et importe
  `getFCRTrace` depuis `@/lib/queries/analytics`.
- Les 5 callers de `computeAlimentMetrics` (non 4 comme indiqué dans l'ADR — voir
  Divergence 1) sont identifiés dans le code.

### Navigation ↔ Permissions : OK

Non applicable à cet ADR. Aucune nouvelle page ni nouveau menu.

### Build et Tests : Non exécutés

Le build et les tests ne sont pas exécutés dans cette pré-analyse (pas de modification de
code à valider). Ils devront être exécutés à la fin de l'implémentation (étape 12 du plan).

---

## Divergences trouvées entre l'ADR et le code réel

### Divergence 1 — Nombre de callers de `computeAlimentMetrics` : 5, pas 4

**ADR (§1.1) :** Liste 4 callers dans le tableau.
**Code réel :** `getScoresFournisseurs` est listé dans le tableau mais omis dans le décompte
narratif de l'ADR ("appelée par quatre fonctions publiques"). Le tableau liste bien
`getScoresFournisseurs` — c'est le texte qui dit "quatre" alors qu'il y en a cinq.

**Fichier concerné :** `src/lib/queries/analytics.ts`

**Impact :** L'implémenteur doit s'assurer que `getScoresFournisseurs` est aussi mis à jour
pour utiliser le wrapper `computeAlimentMetricsFromFCRByFeed`. Aucun impact sur
l'architecture.

---

### Divergence 2 — `GompertzParams` est dans `gompertz.ts`, pas dans `feed-periods.ts`

**ADR (§7.3, tableau réutilisation) :** Pour "Step 3 — Poids journalier", indique
`gompertzWeight(t, params)` depuis `src/lib/gompertz.ts`. Le type `GompertzParams` utilisé
comme paramètre de `buildDailyGainTable` dans l'ADR vient implicitement de ce même fichier.

**Code réel :** `GompertzParams` est défini dans `src/lib/gompertz.ts` et exporté depuis
`src/types/index.ts` via le barrel. `CalibragePoint` est dans `src/lib/feed-periods.ts`
(exporté). L'ADR §7.3 indique correctement les deux sources — pas de divergence réelle,
juste à confirmer pour l'implémenteur.

**Fichier concerné :** `src/lib/queries/fcr-by-feed.ts` (à créer)

**Impact :** Aucun, à titre informatif. L'import correct est :
```typescript
import { gompertzWeight, calibrerGompertz, isCachedGompertzValid } from "@/lib/gompertz";
import type { GompertzParams } from "@/lib/gompertz";
import { CalibragePoint, estimerNombreVivantsVague } from "@/lib/feed-periods";
```

---

### Divergence 3 — `FCRTransparencyDialog` : refactoring de props plus profond qu'anticipé

**ADR (§11) :** Montre un avant/après simplifié de la prop `parVague`. La prop actuelle du
composant est `{ produitId, produitNom, fcrMoyen }`. L'ADR dit que la prop `produitId`
disparaît et que `parVague` est ajoutée depuis `DetailAlimentVague`.

**Code réel :** Le composant `FCRTransparencyDialog` (dans
`src/components/analytics/fcr-transparency-dialog.tsx`) est structuré autour de :
- `FCRTransparencyDialog` (public) : reçoit `produitId`, `produitNom`, `fcrMoyen`
- `FCRTraceContent` (interne) : fait le fetch API et lit `FCRTrace`
- `VagueSection` : lit `FCRTraceVague.periodes: FCRTracePeriode[]`

La migration vers les nouvelles props implique de :
1. Supprimer `FCRTraceContent` entièrement (plus de fetch)
2. Réécrire `VagueSection` pour consommer `FCRByFeedVague.periodesBac: FCRBacPeriode[]`
   au lieu de `FCRTraceVague.periodes: FCRTracePeriode[]`
3. Les types des champs affichés diffèrent : `FCRTracePeriode` a `methodeDebut`,
   `methodeFin`, `biomasseDebutKg`, `biomasseFinKg`, `nombreVivants` — alors que
   `FCRBacPeriode` a `gainParPoissonG`, `avgFishCount`, `gainBiomasseKg`, `fcr`,
   `flagHighFCR`. L'UI doit être réécrite pour ces nouvelles colonnes.

**Fichier concerné :** `src/components/analytics/fcr-transparency-dialog.tsx`

**Impact :** Travail de refactoring plus important que suggéré par l'ADR. Le dialog
existant ne peut pas être mis à jour "à la marge" — il faut réécrire la partie affichage
des périodes. Prévoir ce temps dans l'estimation.

---

### Divergence 4 — Route `fcr-by-feed` non mentionnée dans la liste des fichiers à créer (§4.1)

**ADR (§4.1) :** La table "Fichiers à CRÉER" liste 3 fichiers : `src/types/fcr-by-feed.ts`,
`src/lib/queries/fcr-by-feed.ts`, `src/__tests__/lib/fcr-by-feed.test.ts`.

**ADR (§10) :** Décrit la route `GET /api/analytics/aliments/[produitId]/fcr-by-feed` à
créer.

**ADR (§15, étape 10) :** L'étape 10 du plan d'implémentation prévoit bien de créer
`src/app/api/analytics/aliments/[produitId]/fcr-by-feed/route.ts`.

**Inconsistance :** La table §4.1 omet ce fichier. Ce n'est pas un blocage mais peut
induire l'implémenteur en erreur s'il suit uniquement la table §4.1.

**Fichier concerné :** `src/app/api/analytics/aliments/[produitId]/fcr-by-feed/route.ts`
(à créer, comme indiqué à l'étape 10 du plan)

**Impact :** Mineur. L'implémenteur doit créer 4 fichiers, pas 3.

---

## Confirmation de l'état actuel du code

| Élément | État |
|---------|------|
| `src/types/fcr-by-feed.ts` | N'EXISTE PAS — à créer |
| `src/lib/queries/fcr-by-feed.ts` | N'EXISTE PAS — à créer |
| `src/__tests__/lib/fcr-by-feed.test.ts` | N'EXISTE PAS — à créer |
| `src/app/api/analytics/aliments/[produitId]/fcr-by-feed/route.ts` | N'EXISTE PAS — à créer |
| `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` | EXISTE — à supprimer |
| `getFCRTrace` dans `analytics.ts` | EXISTE — à supprimer |
| `computeAlimentMetrics` dans `analytics.ts` | EXISTE — à remplacer par wrapper |
| `src/types/calculs.ts` : `avecInterpolation` dans `DetailAlimentVague` | EXISTE — à retirer |
| `src/types/calculs.ts` : `FCRTrace`, `FCRTraceVague`, `FCRTracePeriode`, `FCRTraceGompertzParams` | EXISTENT — à retirer après migration |
| `src/types/index.ts` : exports `FCRTrace*` | EXISTENT — à nettoyer après migration |
| `src/components/analytics/fcr-transparency-dialog.tsx` | EXISTE — à refactoriser |
| `src/components/analytics/feed-detail-charts.tsx` | EXISTE |
| `src/lib/gompertz.ts` : `calibrerGompertz`, `gompertzWeight`, `isCachedGompertzValid` | EXISTENT — réutilisables |
| `src/lib/feed-periods.ts` : `CalibragePoint`, `estimerNombreVivantsVague` | EXISTENT — réutilisables |
| `src/lib/calculs.ts` : `calculerSGR`, `calculerADG`, `calculerPER`, `getPrixParUniteBase` | EXISTENT — réutilisables |
| `src/__tests__/lib/feed-periods.test.ts` | EXISTE — à préserver |
| `src/__tests__/api/analytics-aliments.test.ts` | EXISTE — à préserver |

---

## Risques identifiés

### Risque 1 — Scope élargi du refactoring `FCRTransparencyDialog`

**Description :** Le dialog de transparence FCR doit être entièrement réécrit du côté
affichage des périodes (voir Divergence 3). Les types des données changent complètement
(`FCRTracePeriode` → `FCRBacPeriode`).

**Impact :** Sous-estimation du temps d'implémentation de l'étape 7 (ADR §15).

**Mitigation :** Prévoir une réécriture complète de `VagueSection` et `PeriodeRow` dans le
dialog. Les composants UI de bas niveau (`MethodeBadge`, `EstimationDetailBlock`) deviennent
obsolètes avec le nouvel algorithme (plus d'interpolation par borne de période) — à évaluer
si à garder ou supprimer.

---

### Risque 2 — `feed-detail-charts.tsx` : contenu inconnu

**Description :** Le fichier `src/components/analytics/feed-detail-charts.tsx` est dans la
liste des fichiers à modifier (§4.2) mais son contenu n'a pas été analysé dans cette
pré-analyse.

**Fichier :** `/Users/ronald/project/dkfarm/farm-flow/src/components/analytics/feed-detail-charts.tsx`

**Mitigation :** L'implémenteur doit lire ce fichier avant de commencer l'étape 8 (ADR
§15) pour évaluer l'ampleur des modifications.

---

### Risque 3 — Tests API existants : vérifier qu'ils mockent `computeAlimentMetrics`

**Description :** L'ADR affirme que `src/__tests__/api/analytics-aliments.test.ts` passera
sans modification (contrats API inchangés). C'est vrai si les tests mockent la couche query.
Si les tests utilisent une base de données de test réelle, le remplacement de
`computeAlimentMetrics` par un wrapper appelant `getFCRByFeed` peut changer les valeurs
calculées et faire échouer des assertions numériques.

**Mitigation :** L'implémenteur doit lire `src/__tests__/api/analytics-aliments.test.ts`
avant de valider l'affirmation "tests inchangés" et ajuster les assertions si nécessaire.

---

## Prérequis manquants

Aucun prérequis bloquant. Les ADR dont dépend ADR-036 sont validés :
- ADR-033 (FCR vague-level) : implémenté (commits `63ce5ba`, `e3d71d3`)
- ADR-034 (Gompertz VAGUE toujours actif) : implémenté (commit `130c345`)

---

## Recommandation

GO — L'implémentation peut démarrer dans l'ordre décrit au §15 de l'ADR. L'implémenteur
doit tenir compte des quatre divergences, en particulier la Divergence 3 (refactoring
`FCRTransparencyDialog` plus profond qu'anticipé) et s'assurer de traiter les 5 callers de
`computeAlimentMetrics` (pas 4).

Avant de commencer l'étape 7, lire :
- `src/components/analytics/fcr-transparency-dialog.tsx` (déjà analysé dans ce rapport)
- `src/components/analytics/feed-detail-charts.tsx` (à lire par l'implémenteur)
- `src/__tests__/api/analytics-aliments.test.ts` (à lire pour vérifier les assertions)
