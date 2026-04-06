# Test Report — ADR-036 FCR-by-feed Integration

**Date :** 2026-04-06
**Testeur :** @tester
**Scope :** Validation de l'integration ADR-036 dans le systeme analytics

---

## 1. Contexte

Le developpeur a integre l'algorithme FCR-by-feed (ADR-036) dans le systeme analytics :

- `computeAlimentMetrics` dans `src/lib/queries/analytics.ts` est desormais un wrapper mince appelant `getFCRByFeed` depuis `src/lib/queries/fcr-by-feed.ts`
- `getFCRTrace` supprime de `analytics.ts`
- Route `src/app/api/analytics/aliments/[produitId]/fcr-trace/route.ts` supprimee
- Nouvelle route : `src/app/api/analytics/aliments/[produitId]/fcr-by-feed/route.ts`
- `FCRTransparencyDialog` reecrit pour utiliser les types ADR-036 (`FCRBacPeriode`, `FCRByFeedResult`)
- `saisonFilter` ajoute a `FCRByFeedParams`
- Types `FCRTracePeriode`, `FCRTraceVague`, `FCRTrace` retires du barrel `src/types/index.ts`
- Mocks de `feed-analytics-fournisseurs.test.ts` reecrits pour couvrir le pipeline `getFCRByFeed`

---

## 2. Resultats des tests

### 2.1 Suite complete

| Metrique | Resultat |
|---|---|
| Fichiers de test | 137 total : **126 passes**, 11 echecs |
| Tests individuels | 4403 total : **4296 passes**, 81 echecs, 26 todo |
| Duree | ~42s |

### 2.2 Tests ADR-036 specifiques — TOUS PASSES

#### `src/__tests__/lib/fcr-by-feed.test.ts` — 25/25 passes

| Describe | Tests | Statut |
|---|---|---|
| `buildDailyGainTable` | 4 | PASS |
| `segmenterPeriodesParBac` | 7 | PASS |
| `estimerPopulationBac` | 5 | PASS |
| `calculerFCRPeriodeBac` | 4 | PASS |
| `aggregerFCRVague` | 5 | PASS |

#### `src/__tests__/api/analytics-aliments.test.ts` — 14/14 passes

| Describe | Tests | Statut |
|---|---|---|
| `GET /api/analytics/aliments` | 4 | PASS |
| `GET /api/analytics/aliments/[produitId]` | 4 | PASS |
| `POST /api/analytics/aliments/simulation` | 6 | PASS |

#### `src/__tests__/lib/feed-analytics-fournisseurs.test.ts` — 11/11 passes

| Describe | Tests | Statut |
|---|---|---|
| `getScoresFournisseurs — liste vide` | 3 | PASS |
| `getScoresFournisseurs — fournisseur sans consommation exclu` | 1 | PASS |
| `getScoresFournisseurs — fournisseur avec un seul produit` | 2 | PASS |
| `getScoresFournisseurs — tri par scoreMoyen DESC` | 2 | PASS |
| `getScoresFournisseurs — agregation par fournisseur` | 2 | PASS |
| `getScoresFournisseurs — structure du resultat` | 1 | PASS |

**Total ADR-036 : 50/50 tests passes (100%).**

### 2.3 Tests en echec (pre-existants, hors scope ADR-036)

Les 81 echecs proviennent de 11 fichiers de test. **Aucun n'est lie aux changements ADR-036.** Ils pre-datent cette integration.

| Fichier | Echecs | Cause racine |
|---|---|---|
| `src/__tests__/api/abonnements-statut-middleware.test.ts` | 8 | Logique `isBlocked` pour le statut sans abonnement |
| `src/__tests__/api/bacs.test.ts` | 1 | Quota retourne `NO_SUBSCRIPTION` au lieu de `QUOTA_DEPASSE` |
| `src/__tests__/api/vagues.test.ts` | 4 | Guard abonnement retourne 402 avant la logique metier |
| `src/__tests__/api/vagues-distribution.test.ts` | 4 | Guard abonnement retourne 402 avant la logique metier |
| `src/__tests__/permissions.test.ts` | 1 | `PERMISSION_GROUPS` a 71 entrees, `ALL_PERMISSIONS` en a 72 |
| `src/__tests__/components/plan-form-dialog.test.tsx` | 24 | Composant UI non conforme |
| `src/__tests__/components/plan-toggle.test.tsx` | 5 | Composant UI non conforme |
| `src/__tests__/components/plans-admin-list.test.tsx` | 22 | Composant UI non conforme |
| `src/__tests__/lib/check-subscription.test.ts` | 4 | `isBlocked(null)` retourne `true` au lieu de `false` |
| `src/__tests__/integration/quota-enforcement.test.ts` | 5 | Retourne `NO_SUBSCRIPTION` au lieu de `QUOTA_DEPASSE` |
| `src/__tests__/middleware/proxy-redirect.test.ts` | 3 | Redirections middleware incorrectes |

**Ces echecs concernent le module abonnements/plans et des composants UI, sans rapport avec FCR-by-feed.**

---

## 3. Build de production

**Resultat : PASSE**

```
npm run build
```

- 0 erreur TypeScript
- 0 erreur de compilation
- 1 seul avertissement non-critique : workspace root (Next.js config, pre-existant)
- Toutes les routes compilees avec succes (ƒ Dynamic)

---

## 4. Verification des imports casses

### 4.1 `getFCRTrace` — verifie

Aucun fichier de production (`src/app/`, `src/lib/`, `src/components/`) n'importe `getFCRTrace`. La seule reference restante est un commentaire dans `src/lib/feed-periods.ts` (ligne 38) de type JSDoc — pas un import.

### 4.2 Types `FCRTrace` supprimes du barrel

Les types `FCRTracePeriode`, `FCRTraceVague`, et `FCRTrace` ne sont plus exportes depuis `src/types/index.ts` (commentaire explicite ligne 549). Les types existent toujours dans `src/types/calculs.ts` mais ne sont plus accessibles via le barrel public.

Les types conserves (encore utiles pour `feed-periods.ts`) :
- `FCRTraceGompertzParams`
- `FCRTraceEstimationBiometrieExacte`
- `FCRTraceEstimationInterpolationLineaire`
- `FCRTraceEstimationGompertz`
- `FCRTraceEstimationValeurInitiale`
- `FCRTraceEstimationDetail`

### 4.3 Route `fcr-trace` supprimee

Le repertoire `src/app/api/analytics/aliments/[produitId]/fcr-trace/` n'existe plus. Confirme.

### 4.4 Nouvelle route `fcr-by-feed`

La route `src/app/api/analytics/aliments/[produitId]/fcr-by-feed/route.ts` est presente et importe correctement `getFCRByFeed` et `FCRByFeedParams`.

### 4.5 `FCRTransparencyDialog` — types corrects

Le composant importe desormais `FCRBacPeriode` et `FCRByFeedResult` (types ADR-036) et non plus les types `FCRTrace*`.

---

## 5. Couverture des cas limites ADR-036

| Cas | Test | Statut |
|---|---|---|
| Gain journalier nul → FCR null | `calculerFCRPeriodeBac — FCR null si gainBiomasseKg <= 0` | PASS |
| Population zero (bac vide) | `estimerPopulationBac — bac vide → reconstitution depuis calibrage` | PASS |
| Aucun COMPTAGE → fallback proportionnel | `estimerPopulationBac — fallback proportionnel si aucun COMPTAGE` | PASS |
| Map consommation vide → aucune periode | `segmenterPeriodesParBac — map vide → tableau vide` | PASS |
| Tableau de periodes vide → FCR null | `aggregerFCRVague — tableau vide → fcrVague null, totaux 0` | PASS |
| FCR > 3.0 → flagHighFCR = true | `calculerFCRPeriodeBac — flagHighFCR = true si FCR > 3.0` | PASS |
| Aucune vague avec consommation → 0 | `getScoresFournisseurs — fournisseur sans consommation exclu` | PASS |
| Scenario complet Vague 26-01 → FCR ~0.66 | `aggregerFCRVague — full Vague 26-01 scenario` | PASS |

---

## 6. Tests des mocks `feed-analytics-fournisseurs`

Les mocks ont ete reecrits pour couvrir le pipeline complet `getFCRByFeed` (au lieu de l'ancien `computeAlimentMetrics` direct). La fonction helper `setupVagueWithConsoNoBio` simule le chemin `insufficientData=true` (pas de biometries), ce qui est le cas nominal pour `getScoresFournisseurs` : la quantite consommee est non-nulle mais le FCR est null.

Le mock couvre 5 appels Prisma dans le bon ordre :
1. `vague.findMany` — vagues avec consommations pour le produit
2. `releve.findMany` — biometries (vide = insufficient data)
3. `releveConsommation.aggregate` — quantite totale consommee
4. `vague.findMany` — metadonnees vague pour SGR
5. `releve.findMany` — releves biometrie/mortalite/comptage pour SGR

Tous les 11 tests du fichier passent.

---

## 7. Conclusion

L'integration ADR-036 est **validee** :

- Les 50 tests ADR-036 specifiques passent tous (100%)
- Le build de production passe sans erreur
- Aucun import casse detecte
- La route supprimee `fcr-trace` est absente du filesystem
- La nouvelle route `fcr-by-feed` est presente et bien typee
- `FCRTransparencyDialog` utilise les bons types ADR-036
- `saisonFilter` est integre dans `FCRByFeedParams` et passe a la route

Les 81 echecs de tests sont des regressions pre-existantes hors scope ADR-036, lies au module abonnements/plans.
