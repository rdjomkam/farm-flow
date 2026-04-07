# Rapport de tests — Sprint R5 : KPIs et Planning

**Date :** 2026-04-07
**Agent :** @tester
**Sprint :** R5 — KPIs et Planning de Reproduction

---

## Resultats d'execution

```
Test Files  3 passed (3)
Tests       87 passed (87)
Start at    21:56:51
Duration    678ms
```

Tous les tests passent. Les messages stderr visibles sont des logs intentionnels
de `handleApiError` lors des tests de cas 500 — comportement normal et attendu.

---

## Fichiers de tests crees

### 1. `src/__tests__/api/reproduction-kpis.test.ts`
**37 tests** — API routes KPIs

Couvre les 3 routes :

#### GET /api/reproduction/kpis (14 tests)
- Retourne un objet kpis avec tous les champs attendus
- Retourne les donnees completes de la fixture
- Retourne `periode.dateDebut` et `periode.dateFin` null sans filtres
- Accepte `dateDebut` et `dateFin` ISO valides et les passe a la requete
- Inclut les dates dans la periode quand filtres actifs
- Passe le `siteId` de l'auth context a `getReproductionKpis`
- Retourne 400 si `dateDebut` invalide
- Retourne 400 si `dateFin` invalide
- Retourne 400 si `dateDebut > dateFin`
- Retourne 401 sur `AuthError`
- Retourne 403 sur `ForbiddenError`
- Appelle `requirePermission` avec `Permission.ALEVINS_VOIR`
- Retourne 500 sur erreur serveur inattendue
- Retourne des kpis corrects avec `productionMensuelle` vide quand pas de donnees

#### GET /api/reproduction/kpis/lots (9 tests)
- Retourne `data.parPhase` comme tableau
- Retourne `data.phaseMoyenneDureeJours`
- Retourne les donnees completes de la fixture
- Passe le `siteId` a `getReproductionLotsKpis`
- Appelle `requirePermission` avec `Permission.ALEVINS_VOIR`
- Retourne 401 / 403 / 500 dans les cas adequats
- Retourne `parPhase` et `phaseMoyenneDureeJours` vides sans lots actifs

#### GET /api/reproduction/kpis/funnel (14 tests)
- Retourne un funnel de 3 etapes
- Retourne les etapes avec `etape`, `count`, `pourcentage`
- Retourne les donnees completes de la fixture
- Retourne `periode` avec dates null sans filtres
- Accepte `dateDebut` / `dateFin` ISO valides et les passe a la requete
- Inclut les dates dans la periode quand filtres actifs
- Passe le `siteId` a `getReproductionFunnel`
- Retourne 400 si dates invalides ou `dateDebut > dateFin`
- Retourne 401 / 403 / 500 dans les cas adequats
- Appelle `requirePermission` avec `Permission.ALEVINS_VOIR`

---

### 2. `src/__tests__/api/reproduction-planning.test.ts`
**17 tests** — API route Planning

Couvre : GET /api/reproduction/planning

- Retourne les 4 tableaux d'evenements (`pontesPlanifiees`, `incubationsEnCours`, `lotsEnElevage`, `eclosionsPrevues`)
- Retourne les 4 tableaux comme `Array`
- Passe les dates correctement a `getReproductionPlanningEvents`
- Passe le `siteId` de l'auth context
- Retourne 400 si `dateDebut` absent
- Retourne 400 si `dateFin` absent
- Retourne 400 si ni `dateDebut` ni `dateFin` fournis
- Retourne 400 si `dateDebut` n'est pas une date ISO valide
- Retourne 400 si `dateFin` n'est pas une date ISO valide
- Retourne 400 si `dateFin == dateDebut` (doit etre strictement posterieure)
- Retourne 400 si `dateFin < dateDebut`
- Retourne 401 sur `AuthError`
- Retourne 403 sur `ForbiddenError`
- Appelle `requirePermission` avec `Permission.ALEVINS_VOIR`
- Retourne 500 sur erreur serveur inattendue
- Retourne des tableaux vides sans evenements dans la periode
- Accepte une plage sur plusieurs mois

---

### 3. `src/__tests__/lib/reproduction-kpis.test.ts`
**33 tests** — Fonctions de requete Prisma

Couvre les 3 fonctions de `src/lib/queries/reproduction-stats.ts` :

#### getReproductionKpis (15 tests)
- Retourne tous les champs attendus (16 champs)
- Retourne des zeros quand aucune donnee
- Ne retourne pas `NaN` quand division par zero (totalPontes = 0)
- Calcule `tauxFecondation = totalPontesReussies / totalPontes * 100`
- Calcule `tauxEclosion = totalLarvesViables / totalOeufs * 100` depuis incubations
- Se replie sur les oeufs/larves des pontes si les incubations n'en ont pas
- Distingue `totalAlevinsActifs` (EN_ELEVAGE) de `totalAlevinsSortis` (TRANSFERE)
- Calcule `tauxSurvieGlobal = (tauxFecondation * tauxEclosion * tauxSurvieLarvaire) / 10000`
- Plafonne tous les taux a 100%
- Applique le filtre `dateDebut / dateFin` sur les pontes
- N'applique pas de filtre date quand aucune date fournie
- Retourne `productionMensuelle` avec 6 entrees (6 derniers mois)
- Utilise le `siteId` pour filtrer toutes les requetes
- Retourne les counts geniteurs depuis `reproducteur.count`
- Retourne les counts lots depuis `lotAlevins.count`

#### getReproductionLotsKpis (8 tests)
- Retourne `parPhase` et `phaseMoyenneDureeJours`
- Retourne des tableaux vides quand aucun lot actif
- Groupe les lots par phase dans `parPhase` (count + totalPoissons)
- Calcule la duree moyenne par phase dans `phaseMoyenneDureeJours`
- Retourne `dureeJours >= 0` pour une phase valide
- Filtre les lots par `siteId`
- Filtre uniquement les statuts `EN_ELEVAGE` et `EN_INCUBATION`
- Retourne les champs `count` et `totalPoissons` dans `parPhase`

#### getReproductionPlanningEvents (10 tests)
- Retourne un objet avec les 4 tableaux attendus
- Retourne des tableaux vides quand aucun evenement
- Filtre les pontes par plage de dates (`gte / lte`)
- Filtre par `siteId` pour toutes les requetes
- Mappe les pontes vers le format `PontePlanifiee`
- Retourne `femelle: null` quand la ponte n'a pas de femelle
- Mappe les incubations vers le format `IncubationEnCours`
- Mappe les lots vers le format `LotEnElevage`
- Filtre les `eclosionsPrevues` par `dateEclosionPrevue` dans la periode
- Exclut les `eclosionsPrevues` avec `dateEclosionPrevue: null`

---

## Cas limites valides

| Cas | Comportement attendu | Valide |
|-----|---------------------|--------|
| Division par zero (totalPontes = 0) | Retourne 0, pas NaN | Oui |
| Taux > 100% (donnees aberrantes) | Plafonne a 100% via `Math.min` | Oui |
| Incubations sans oeufs places | Fallback sur les oeufs des pontes | Oui |
| Ponte sans femelle associee | `femelle: null` dans la reponse | Oui |
| Eclosion sans date prevue | Exclue du tableau `eclosionsPrevues` | Oui |
| `dateFin == dateDebut` (planning) | Retourne 400 (doit etre strictement posterieure) | Oui |
| Aucune donnee sur la periode | Tous les tableaux/kpis retournent 0 ou [] | Oui |

---

## Couverture des regles metier

- R8 (siteId partout) : verifie que `siteId` est passe dans chaque requete Prisma
- R2 (enums UPPERCASE) : les statuts utilises dans les mocks (`TERMINEE`, `EN_COURS`, `EN_ELEVAGE`, etc.) sont en UPPERCASE
- Permission `ALEVINS_VOIR` : verifiee sur les 3 routes KPIs et la route Planning
- Gestion d'erreurs centralisee via `handleApiError` : retour 401/403/500 selon le type d'erreur
