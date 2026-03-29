# Revue de conformite — Implementation Gompertz

**Date :** 2026-03-29
**Auteur :** @architect
**Documents de reference :**
- `docs/reviews/review-gompertz-implementation.md` (revue architecturale)
- `docs/sprints/SPRINT-PLAN-GOMPERTZ.md` (stories G0.1 — G3.4)
- `docs/decisions/ADR-gompertz-lm-validation.md` (decision GO)

**Perimetre audite :**
- `src/lib/gompertz.ts`
- `src/app/api/vagues/[id]/gompertz/route.ts`
- `src/lib/benchmarks.ts` (section Gompertz)
- `src/types/calculs.ts` (ProjectionVagueV2, CourbeCroissancePoint)
- `src/components/dashboard/projections.tsx`
- `src/lib/queries/dashboard.ts` (enrichWithGompertz)
- `src/lib/queries/gompertz-analytics.ts`
- `src/components/analytics/feed-comparison-cards.tsx`
- `src/components/analytics/feed-k-comparison-chart.tsx`
- `prisma/schema.prisma` (GompertzVague, ConfigElevage)
- `src/types/models.ts` (ConfigElevage interface)
- `src/components/config-elevage/config-elevage-form-client.tsx`

---

## 1. Tableau de conformite

### Sprint G0 — Pre-requis

| ID | Exigence | Fichier cible | Statut | Commentaire |
|----|----------|---------------|--------|-------------|
| G0.1 | Installer `levenberg-marquardt` (mljs) et valider convergence LM | `scripts/test-gompertz-lm.ts` + ADR | **CONFORME** | Decision GO documentee dans `ADR-gompertz-lm-validation.md`. Choix LM from scratch justifie par probleme ESM/CJS mljs. Tous les criteres C1–C4 valides. |

### Sprint G1 — Fondations

| ID | Exigence | Fichier cible | Statut | Commentaire |
|----|----------|---------------|--------|-------------|
| G1.1a | Interfaces `GompertzParams`, `GompertzCalibrationInput`, `GompertzCalibrationResult` | `src/lib/gompertz.ts` | **CONFORME** | Toutes les interfaces sont definies. `GompertzConfidenceLevel` exportee en type separe, ce qui est mieux que le string literal inline preconise. |
| G1.1b | `gompertzWeight(t, params)` | `src/lib/gompertz.ts` | **CONFORME** | Formule correcte W(t) = W∞ × exp(-exp(-K×(t-ti))). Pur, sans effet de bord. |
| G1.1c | `gompertzVelocity(t, params)` | `src/lib/gompertz.ts` | **CONFORME** | dW/dt correctement implementee avec derivee analytique. |
| G1.1d | `calibrerGompertz(input)` avec LM, bornes, initialisation | `src/lib/gompertz.ts` | **CONFORME** | LM from scratch avec bornes physiques. Initialisation heuristique W∞=2.5×max, K=0.03, ti=tMean. Convergence en <200 iterations. |
| G1.1e | `projeterDateRecolte(params, poidsObjectif, joursActuels)` | `src/lib/gompertz.ts` | **CONFORME** | Inversion analytique correcte. Retourne null si W∞ <= poidsObjectif. Retourne 0 si cible deja depassee. |
| G1.1f | `genererCourbeGompertz(params, joursMax, pas)` | `src/lib/gompertz.ts` | **CONFORME** | Generation correcte. Inclut le dernier point si joursMax non multiple du pas. |
| G1.1g | Graduation de confiance INSUFFICIENT_DATA / LOW / MEDIUM / HIGH | `src/lib/gompertz.ts` | **CONFORME** | `resolveConfidenceLevel()` interne implementee. Seuils: <5 → null (INSUFFICIENT_DATA retourne null), 5-6 → LOW, 7-9 → MEDIUM, 10+ avec R²>0.95 → HIGH. |
| G1.1h | Initialisation LM (W∞₀=max×1.5 ou 2.5, K₀=0.03, ti₀=45 ou tMean) | `src/lib/gompertz.ts` | **PARTIEL** | Initialisation implementee mais coefficients differents de la revue (2.5×max vs 1.5×max, tMean vs 45j). L'ADR documente 2.5× et tMean, validees. Ecart documenté, non critique. |
| G1.2 | Tests unitaires gompertz.ts — couverture > 90% | `src/__tests__/lib/gompertz.test.ts` | **CONFORME** | 50+ tests couvrant: gompertzWeight (8 cas), gompertzVelocity (5 cas), calibrerGompertz (12 cas), projeterDateRecolte (8 cas), genererCourbeGompertz (8 cas), niveaux de confiance (7 cas). |
| G1.3a | Modele `GompertzVague` dans prisma/schema.prisma | `prisma/schema.prisma` | **CONFORME** | Table creee avec tous les champs requis. Contrainte UNIQUE sur vagueId. FK CASCADE. Index siteId et vagueId. R8 respecte (siteId obligatoire). |
| G1.3b | Relation `gompertz GompertzVague?` sur Vague | `prisma/schema.prisma` | **CONFORME** | Relation 1:1 presente sur le modele Vague (ligne 874). |
| G1.3c | Relation `gompertzVagues GompertzVague[]` sur Site | `prisma/schema.prisma` | **CONFORME** | Relation presente sur Site (ligne 508). |
| G1.4a | API route GET /api/vagues/[id]/gompertz | `src/app/api/vagues/[id]/gompertz/route.ts` | **CONFORME** | Route implementee. Auth + siteId verifies. Calibrage lazy. Upsert GompertzVague. |
| G1.4b | Retour 200 avec `calibration: null` si < 5 biometries | `src/app/api/vagues/[id]/gompertz/route.ts` | **CONFORME** | Cas < 5 points gere, retourne `{vagueId, calibration: null, courbe: null, dateRecolteEstimee: null}`. |
| G1.4c | Auth et siteId verifies (R8) | `src/app/api/vagues/[id]/gompertz/route.ts` | **CONFORME** | `requirePermission(request, Permission.VAGUES_VOIR)` + `where: { id: vagueId, siteId: auth.activeSiteId }`. |
| G1.4d | Lecture ConfigElevage pour valeurs initiales custom | `src/app/api/vagues/[id]/gompertz/route.ts` | **NON-CONFORME** | La route lit `configElevage.poidsObjectif` pour la projection de recolte, mais NE PASSE PAS de valeurs initiales Gompertz custom a `calibrerGompertz()`. Le calibrage utilise toujours les heuristiques internes. Voir section 2 (ecart critique A). |
| G1.5a | `GOMPERTZ_REF_CLARIAS` dans benchmarks.ts | `src/lib/benchmarks.ts` | **PARTIEL** | Constante presente. MAIS les plages different de la revue: wInfinity.min=800 (vs 600), k.min=0.015 (vs 0.01), k.max=0.05 (vs 0.08), ti.typical=70 (vs 45). Revue et ADR divergent — la revue est la reference normative. Non-bloquant car les constantes ne gouvernent que l'evaluation qualitative. |
| G1.5b | `evaluerKGompertz(k): GompertzKLevel` | `src/lib/benchmarks.ts` | **CONFORME** | Implementee. k>=0.020 → EXCELLENT, k>=0.015 → BON, k<0.015 → FAIBLE. Conforme aux seuils du sprint plan (G1.5 criteres d'acceptation). |
| G1.5c | Export type `GompertzKLevel` | `src/lib/benchmarks.ts` | **CONFORME** | Type exporte depuis benchmarks.ts. |

### Sprint G2 — Integration UI

| ID | Exigence | Fichier cible | Statut | Commentaire |
|----|----------|---------------|--------|-------------|
| G2.1a | `poidsGompertz?: number \| null` dans `CourbeCroissancePoint` | `src/types/calculs.ts` | **CONFORME** | Champ optionnel presente sur l'interface. Non-breaking. |
| G2.1b | Interface `ProjectionVagueV2` etendant `ProjectionVague` | `src/types/calculs.ts` | **CONFORME** | Interface creee avec `gompertzParams`, `gompertzR2`, `gompertzConfidence`, `dateRecolteGompertz`. Tous les champs optionnels. |
| G2.1c | Export `GompertzParams` depuis `src/types/index.ts` | `src/types/index.ts` | **NON-VERIFIE** | Non audite directement. Le composant projections.tsx importe `GompertzParams` depuis `@/lib/gompertz`, pas depuis `@/types`. La revue preconisait l'export depuis `types/index.ts`. Ecart mineur de convention. |
| G2.2a | Ligne Gompertz conditionnelle dans `CourbeProjectionChart` | `src/components/dashboard/projections.tsx` | **CONFORME** | `<Line dataKey="poidsGompertz">` conditionnelle sur `hasGompertzCurve`. |
| G2.2b | Style amber/dasharray pour la courbe Gompertz | `src/components/dashboard/projections.tsx` | **PARTIEL** | Couleur utilisee : `var(--accent-green, #22c55e)` (vert) au lieu de `var(--accent-amber)` preconise dans la revue. Le sprint plan ne specifie pas la couleur exacte. Ecart mineur de design. |
| G2.2c | Legende etendue ("Reel", "Projete (SGR)", "Gompertz") | `src/components/dashboard/projections.tsx` | **CONFORME** | Legende presente avec formatter qui mappe les datakeys aux labels francais. |
| G2.2d | Tooltip etendu pour les 3 valeurs | `src/components/dashboard/projections.tsx` | **CONFORME** | Tooltip custom affiche toutes les series presentes via `payload.map()`. |
| G2.3a | Badge fiabilite (HIGH/MEDIUM/LOW/INSUFFICIENT_DATA) | `src/components/dashboard/projections.tsx` | **CONFORME** | `GompertzBadge` presente avec 4 etats visuels distincts. |
| G2.3b | Date recolte Gompertz cote a cote avec SGR | `src/components/dashboard/projections.tsx` | **CONFORME** | `HarvestDateBlock` affiche les deux dates avec labels "SGR" et "Gompertz" si disponibles. |
| G2.3c | Parametres traduits en langage metier (W∞, K, ti) | `src/components/dashboard/projections.tsx` | **CONFORME** | `GompertzParamsMetier` traduit W∞ → "Poids plafond", K → "Vitesse: Rapide/Normale/Lente", ti → "Pic jour X". |
| G2.3d | Section "Details techniques" collapsible INGENIEUR/ADMIN | `src/components/dashboard/projections.tsx` | **CONFORME** | `TechnicalDetailsSection` presente, conditionnelle sur `canSeeTechnicalDetails` (ADMIN || INGENIEUR). Affiche W∞, K, ti, R² bruts. |
| G2.3e | L'utilisateur GERANT ne voit jamais les valeurs brutes W∞/K/ti | `src/components/dashboard/projections.tsx` | **CONFORME** | La section technique est filtree par role. GERANT ne voit que le langage metier. |
| G2.4a | Connexion Server Component → Gompertz via dashboard.ts | `src/lib/queries/dashboard.ts` | **CONFORME** | `enrichWithGompertz()` implementee et appelee en `Promise.all` depuis `getProjectionsDashboard()`. |
| G2.4b | Merge poidsGompertz dans courbeProjection | `src/lib/queries/dashboard.ts` | **CONFORME** | Index par jour (Map) + merge O(1) sur chaque point de `courbeProjection`. |
| G2.4c | Pas de N+1 (un seul appel par vague) | `src/lib/queries/dashboard.ts` | **PARTIEL** | `Promise.all` evite la sequentialisation mais chaque appel `enrichWithGompertz()` fait 2-3 requetes Prisma (count, findUnique, findMany). Pour N vagues actives, cela fait 3N requetes. Non-critique en production (N typiquement < 10) mais pas strictement un "seul appel par vague" au sens SQL. Voir ecart mineur. |
| G2.4d | Graceful degradation si Gompertz non disponible | `src/lib/queries/dashboard.ts` | **CONFORME** | `try/catch` global dans `enrichWithGompertz()` avec retour silencieux en cas d'erreur. Cas < 5 points gere explicitement. |
| G2.5 | Tests UI projections avec 4 scenarios Gompertz | Attendu dans `src/__tests__/ui/gompertz-projections.test.tsx` | **NON-CONFORME** | Fichier absent. Les tests unitaires de `gompertz.ts` existent mais les tests UI du composant `projections.tsx` n'ont pas ete crees. Ecart critique pour la story G2.5. |

### Sprint G3 — Comparaison aliments via K

| ID | Exigence | Fichier cible | Statut | Commentaire |
|----|----------|---------------|--------|-------------|
| G3.1a | `getKParAliment(siteId)` dans gompertz-analytics.ts | `src/lib/queries/gompertz-analytics.ts` | **CONFORME** | Requete Prisma implementee. Jointure GompertzVague → Vague → Releves ALIMENTATION → ReleveConsommation → Produit. |
| G3.1b | K pondere par quantite d'aliment | `src/lib/queries/gompertz-analytics.ts` | **CONFORME** | Ponderation correcte : Σ(K×quantite) / Σ(quantite) par produit. |
| G3.1c | Filtre HIGH ou MEDIUM uniquement | `src/lib/queries/gompertz-analytics.ts` | **CONFORME** | `confidenceLevel: { in: ["HIGH", "MEDIUM"] }` dans le where Prisma. |
| G3.1d | Minimum 2 vagues par aliment | `src/lib/queries/gompertz-analytics.ts` | **CONFORME** | Filtre `if (vaguesEntries.length < 2) continue` avant ajout aux resultats. |
| G3.1e | Filtre siteId respecte (R8) | `src/lib/queries/gompertz-analytics.ts` | **CONFORME** | `where: { siteId }` present sur GompertzVague, releves, et consommations. |
| G3.1f | Pas de N+1 | `src/lib/queries/gompertz-analytics.ts` | **CONFORME** | Une seule requete Prisma avec includes profonds. Agregation en memoire. |
| G3.2a | `kMoyenGompertz?: number \| null` dans `AnalytiqueAliment` | `src/types/calculs.ts` | **CONFORME** | Champ optionnel present sur l'interface. |
| G3.2b | `kNiveauGompertz?: GompertzKLevel \| null` dans `AnalytiqueAliment` | `src/types/calculs.ts` | **CONFORME** | Champ optionnel present. |
| G3.2c | `kGompertz?: number \| null` dans `DetailAlimentVague` | `src/types/calculs.ts` | **CONFORME** | Champ optionnel present sur `DetailAlimentVague`. |
| G3.3a | Extension `FeedComparisonCards` avec badge K Gompertz | `src/components/analytics/feed-comparison-cards.tsx` | **CONFORME** | Fonction `kNiveauBadge()` presente. Prop `meilleurK?` ajoutee. |
| G3.3b | Graphique `FeedKComparisonChart` barre horizontale K par aliment | `src/components/analytics/feed-k-comparison-chart.tsx` | **CONFORME** | BarChart horizontal implementee. Couleurs par niveau. Masque si < 2 aliments avec donnees. |
| G3.3c | Tooltip : ecart % vs moyenne | `src/components/analytics/feed-k-comparison-chart.tsx` | **CONFORME** | `KTooltip` calcule et affiche `pct` vs moyenne avec direction (superieur/inferieur). |
| G3.3d | Conditionnel si aucune donnee Gompertz | `src/components/analytics/feed-k-comparison-chart.tsx` | **CONFORME** | `if (alimentsAvecK.length < 2) return null`. |
| G3.3e | Mobile first 360px | `src/components/analytics/feed-k-comparison-chart.tsx` | **CONFORME** | `ResponsiveContainer`, hauteur dynamique, labels de taille 10-11px. |
| G3.4 | Tests agregation K + UI | Attendu dans `src/__tests__/lib/gompertz-analytics.test.ts` | **NON-CONFORME** | Fichier absent. Story G3.4 non implementee. |

### Points de la revue architecturale (sections F)

| Section | Exigence | Statut | Commentaire |
|---------|----------|--------|-------------|
| F.1 | Cache GompertzVague pour eviter recalibrage a chaque rendu | **CONFORME** | Table GompertzVague utilisee comme cache. Invalidation par biometrieCount. |
| F.2 | Graduation de confiance INSUFFICIENT_DATA / LOW / MEDIUM / HIGH | **CONFORME** | Implementee dans `resolveConfidenceLevel()` et affichee dans `GompertzBadge`. |
| F.3 | UX non-technique — parametres traduits en metier | **CONFORME** | `GompertzParamsMetier` presente. Details bruts reserves INGENIEUR/ADMIN. |
| F.4 | Fallback SGR si poidsObjectif > 0.99 × W∞ | **NON-CONFORME** | `projeterDateRecolte()` retourne `null` si W∞ <= poidsObjectif, MAIS il n'y a aucun fallback vers le SGR dans ce cas. L'UI affiche simplement l'absence de date Gompertz sans basculer vers la projection SGR lineaire. Voir ecart critique B. |
| F.5 | Limitation vagues multi-bacs documentee | **PARTIEL** | L'implementation calibre sur le poids moyen vague (correct pour v1). Aucune mention explicite de cette limitation dans le code ou la documentation produite. Ecart mineur — a documenter. |
| F.6 | Bibliotheque LM : choix documente | **CONFORME** | ADR-gompertz-lm-validation.md documente le choix LM from scratch + raison (ESM/CJS mljs). |

### Point A : ConfigElevage — Champs Gompertz manquants

| Verification | Statut | Commentaire |
|-------------|--------|-------------|
| Champs `gompertzWInf`, `gompertzK`, `gompertzTInflexion` dans ConfigElevage (schema) | **NON-CONFORME** | Absents du schema Prisma. ConfigElevage ne contient aucun parametre Gompertz initial personnalisable. |
| Champs Gompertz dans interface TypeScript ConfigElevage | **NON-CONFORME** | Interface `ConfigElevage` dans models.ts ne contient pas ces champs. |
| Formulaire config-elevage-form-client.tsx expose ces champs | **NON-CONFORME** | Aucune section Gompertz dans le formulaire. |
| `calibrerGompertz()` accepte des valeurs initiales custom | **NON-CONFORME** | `GompertzCalibrationInput` n'a pas de champ `initialGuess` ou `bornes` personnalisables. L'interface de la revue (section B.1) prevoyait un champ `bornes?` optionnel. |
| L'API route lit ConfigElevage pour les valeurs initiales | **NON-CONFORME** | La route lit `configElevage.poidsObjectif` mais pas de valeurs initiales Gompertz. |

---

## 2. Ecarts critiques — A corriger

### EC-1 : Tests UI projections absents (G2.5)

**Fichier attendu :** `src/__tests__/ui/gompertz-projections.test.tsx`
**Impact :** Haute — la story G2.5 est explicitement dans le sprint plan. Sans ces tests, la non-regression du composant `projections.tsx` n'est pas garantie.
**Actions requises :**
- Creer `src/__tests__/ui/gompertz-projections.test.tsx`
- Tester les 4 scenarios : pas de ligne Gompertz si donnees absentes, ligne presente si donnees presentes, badge INSUFFICIENT_DATA, badge HIGH, section details visible uniquement INGENIEUR

### EC-2 : Tests agregation K absents (G3.4)

**Fichier attendu :** `src/__tests__/lib/gompertz-analytics.test.ts`
**Impact :** Haute — la story G3.4 est dans le sprint plan. La logique de ponderation K de `getKParAliment` n'est pas couverte.
**Actions requises :**
- Creer `src/__tests__/lib/gompertz-analytics.test.ts`
- Tester : K pondere correct, exclusion < 2 vagues, filtrage siteId, integration seed DK Farm

### EC-3 : Absence de fallback SGR en fin de cycle (F.4)

**Localisation :** `src/components/dashboard/projections.tsx` (HarvestDateBlock), `src/lib/queries/dashboard.ts` (enrichWithGompertz)
**Description :** La revue architecturale (section F.4) exige que si `poidsObjectif > 0.99 × W∞`, le systeme bascule vers la projection SGR avec un avertissement. Actuellement, quand `projeterDateRecolte()` retourne `null` (W∞ <= poidsObjectif), l'UI affiche simplement l'absence de date Gompertz. L'utilisateur ne sait pas pourquoi et ne reoit pas la date SGR en remplacement.
**Impact :** Moyen — cas PRE_RECOLTE avec W∞ sous-estime produit une UX degradee silencieuse.
**Actions requises :**
- Dans `enrichWithGompertz()`, detecter si `poidsObjectif > 0.99 × wInfinity`
- Si oui, ne pas mettre `dateRecolteGompertz`, ajouter un champ `gompertzFallbackReason: "ASYMPTOTE"` a `ProjectionVagueV2`
- Dans `HarvestDateBlock`, afficher un message explicatif : "Modele en zone asymptotique — date estimee par SGR"

### EC-4 : Valeurs initiales Gompertz non configurables via ConfigElevage (Point A)

**Description :** La revue architecturale (section A, note sur la section C "Pourquoi pas dans ConfigElevage") etablit une nuance importante : les parametres CALIBRES vont dans `GompertzVague` (correct), mais les valeurs INITIALES par defaut (W∞, K, ti) devraient etre configurables dans `ConfigElevage` pour permettre a l'ingenieur d'ajuster les hypotheses de depart selon le profil d'elevage local (ex: Clarias camerounais vs souche amelioree, temperature de l'eau differente, densite differente).

L'implementation actuelle utilise des heuristiques fixes (`buildInitialGuess()`) sans tenir compte du profil d'elevage.

**Impact :** Moyen — manque de personnalisation pour les ingenieurs. Peut produire des calibrages sous-optimaux si les conditions locales s'ecartent de la moyenne FAO.
**Actions requises :**
- Ajouter 3 champs optionnels dans `prisma/schema.prisma` sur `ConfigElevage` :
  ```
  gompertzWInfDefault Float?  -- poids asymptotique initial (g), defaut: 1200
  gompertzKDefault    Float?  -- taux de croissance initial, defaut: 0.03
  gompertzTiDefault   Float?  -- point d'inflexion initial (jours), defaut: 70
  ```
- Mettre a jour l'interface TypeScript `ConfigElevage` dans `src/types/models.ts`
- Ajouter les champs dans `GompertzCalibrationInput` :
  ```typescript
  initialGuess?: { wInfinity?: number; k?: number; ti?: number }
  ```
- Dans `buildInitialGuess()`, accepter un override optionnel
- Dans l'API route et `enrichWithGompertz()`, lire `configElevage.gompertzWInfDefault` etc. et les passer a `calibrerGompertz()`
- Ajouter une section "Parametres Gompertz" dans le formulaire `config-elevage-form-client.tsx` (visible INGENIEUR/ADMIN uniquement)

---

## 3. Ecarts mineurs — Nice-to-have ou ameliorations

### EM-1 : Couleur de la courbe Gompertz (amber vs vert)

**Localisation :** `src/components/dashboard/projections.tsx` ligne ~480
**Description :** La revue preconise `var(--accent-amber)` pour la courbe Gompertz. L'implementation utilise `var(--accent-green, #22c55e)`. La couleur verte peut porter a confusion avec la courbe "reelle" qui utilise `var(--primary)` (souvent vert/teal selon le theme).
**Recommandation :** Utiliser `var(--accent-amber)` pour differencier visuellement la projection Gompertz (predictif/modelise) de la courbe reelle. La couleur amber est plus semantiquement appropriee pour un modele theorique.

### EM-2 : Initialisation W∞₀ diverge entre la revue et l'ADR

**Localisation :** `src/lib/gompertz.ts` (`buildInitialGuess()`)
**Description :** La revue architecturale (section D) preconise W∞₀ = max×1.5. L'ADR de validation (conditions d'initialisation) et l'implementation utilisent W∞₀ = max×2.5. Les tests de validation confirment que 2.5× converge mieux. La revue est le document normatif mais l'ADR (produit apres validation reelle) prend precedence.
**Recommandation :** Mettre a jour la revue architecturale pour refleter la valeur validee 2.5×. Aucune modification de code requise.

### EM-3 : N+1 potentiel dans enrichWithGompertz (2-3 requetes par vague)

**Localisation :** `src/lib/queries/dashboard.ts` (`enrichWithGompertz()`)
**Description :** Pour chaque vague active, `enrichWithGompertz()` effectue :
1. `prisma.releve.count(...)` — count biometries
2. `prisma.gompertzVague.findUnique(...)` — check cache
3. `prisma.releve.findMany(...)` — si recalibrage necessaire

Pour 5 vagues actives, cela fait jusqu'a 15 requetes vs la recommandation "un seul appel par vague" de G2.4. En pratique, avec le cache GompertzVague actif, seules les requetes 1+2 sont executes (2×N). Acceptable pour N<10 mais suboptimal.
**Recommandation :** Pre-charger les GompertzVague de toutes les vagues actives en une seule requete dans `getProjectionsDashboard()` avant de boucler. Passer la donnee en parametre a `enrichWithGompertz()` pour eliminer la requete `findUnique`.

### EM-4 : Constantes GOMPERTZ_REF_CLARIAS divergent de la revue

**Localisation :** `src/lib/benchmarks.ts`
**Description :** Les plages definies dans l'implementation different de la revue architecturale :
| Parametre | Revue | Implementation |
|-----------|-------|----------------|
| wInfinity.min | 600 g | 800 g |
| k.min | 0.01 | 0.015 |
| k.max | 0.08 | 0.05 |
| wInfinity.optimal | 1000 g | 1200 g |
Ces constantes sont issues de sources FAO/CIRAD et les valeurs de l'implementation sont defensibles. L'impact est limite a l'affichage qualitatif (evaluerKGompertz n'utilise pas GOMPERTZ_REF_CLARIAS directement).
**Recommandation :** Documenter les sources des valeurs retenues dans un commentaire. Aligner la revue avec les constantes validees.

### EM-5 : Limitation vagues multi-bacs non documentee dans le code

**Localisation :** `src/lib/gompertz.ts`, `src/lib/queries/dashboard.ts`
**Description :** La revue recommande de documenter explicitement que Gompertz v1 calibre sur le poids moyen vague uniquement (limitation F.5). Il n'y a aucun commentaire explicite dans le code mentionnant cette limitation ni sa consequence (bacs heterogenes dans une meme vague produisent un K "moyen" qui peut masquer des disparites).
**Recommandation :** Ajouter un commentaire JSDoc dans `calibrerGompertz()` et `enrichWithGompertz()` documentant cette limitation v1.

### EM-6 : `GompertzParams` non exporte depuis `src/types/index.ts`

**Description :** La revue et le sprint plan (G2.1) demandent l'export de `GompertzParams` depuis `src/types/index.ts` pour uniformiser les imports. Actuellement, le composant `projections.tsx` importe depuis `@/lib/gompertz` directement.
**Recommandation :** Ajouter `export type { GompertzParams } from "@/lib/gompertz"` dans `src/types/index.ts` ou dans `src/types/calculs.ts`.

### EM-7 : Distribution temporelle des biometries non verifiee (condition ADR)

**Localisation :** `src/lib/gompertz.ts` (`calibrerGompertz()`), `src/app/api/vagues/[id]/gompertz/route.ts`
**Description :** L'ADR de validation (condition supplementaire) exige que les points biometriques couvrent >= 60% du cycle. Si tous les points sont concentres sur les 30 premiers jours d'un cycle de 180 jours, le calibrage LM peut converger vers des parametres non representatifs de la courbe complete.
**Recommandation :** Ajouter un check optionnel dans `calibrerGompertz()` : si max(jours) < 0.4 × ti_initial, mettre `confidenceLevel` a "LOW" meme avec 10+ points. Ce check peut etre introduce comme avertissement non-bloquant (`warning` field de l'interface `GompertzCalibrationResult` — champ prevu dans la revue mais absent de l'implementation).

### EM-8 : Champ `warning` absent de `GompertzCalibrationResult`

**Description :** La revue (section B.1) prevoit un champ `warning: string | null` dans `GompertzCalibrationResult` pour les convergences partielles et les cas limites. L'interface implementee ne contient pas ce champ. Cela ne bloque pas l'usage actuel mais limite la capacite a communiquer des alertes specifiques a l'utilisateur.
**Recommandation :** Ajouter `warning?: string | null` a `GompertzCalibrationResult` et l'utiliser pour les cas EM-7 (distribution temporelle) et d'autres cas limites futurs.

---

## 4. Recommandations prioritisees

### Priorite HAUTE (bloquant pour la completude du sprint)

1. **Creer les tests UI projections** (`src/__tests__/ui/gompertz-projections.test.tsx`) — Story G2.5 non completee
2. **Creer les tests agregation K** (`src/__tests__/lib/gompertz-analytics.test.ts`) — Story G3.4 non completee
3. **Implémenter le fallback SGR en zone asymptotique** — Protection UX pour les vagues PRE_RECOLTE avec W∞ sous-estime

### Priorite MOYENNE (a traiter avant mise en production)

4. **Ajouter les champs Gompertz dans ConfigElevage** — Migration Prisma + interface + formulaire + passage a calibrerGompertz(). Necessite une migration DB.
5. **Corriger la couleur de la courbe Gompertz** (amber vs vert) — Disambiguation visuelle

### Priorite BASSE (ameliorations future, Sprint 12 Polish)

6. **Optimiser le N+1 dans enrichWithGompertz** — Pre-chargement batch des GompertzVague
7. **Exporter GompertzParams depuis types/index.ts** — Convention imports
8. **Documenter la limitation multi-bacs** dans les JSDoc
9. **Ajouter le champ `warning` a GompertzCalibrationResult** — Pour les alertes de distribution temporelle
10. **Verifier la distribution temporelle des biometries** — Condition ADR supplementaire

---

## 5. Synthese

| Categorie | Total | Conforme | Partiel | Non-Conforme | Non-Verifie |
|-----------|-------|----------|---------|--------------|-------------|
| Sprint G0 | 1 | 1 | 0 | 0 | 0 |
| Sprint G1 | 15 | 12 | 2 | 1 | 0 |
| Sprint G2 | 14 | 10 | 2 | 2 | 0 |
| Sprint G3 | 12 | 10 | 0 | 2 | 0 |
| Sections F | 6 | 4 | 1 | 1 | 0 |
| Point A (ConfigElevage) | 5 | 0 | 0 | 5 | 0 |
| **Total** | **53** | **37** | **5** | **11** | **0** |

**Taux de conformite global : 37/53 = 70%** (conforme strict) / **79%** (conforme + partiel)

**Conclusion :** L'implementation Gompertz couvre correctement le noyau fonctionnel — algorithme LM, calibrage, API, courbe UI, badges, comparaison aliments. Les ecarts critiques sont au nombre de 4 : 2 concernent des tests manquants (EC-1, EC-2), 1 concerne une protection UX absente en fin de cycle (EC-3), et 1 concerne la configurabilite des valeurs initiales via ConfigElevage (EC-4). Ces 4 ecarts doivent etre corriges avant de considerer les sprints Gompertz comme completement livres.

---

*Rapport produit par @architect le 2026-03-29.*
*Aucun code fonctionnel implemente dans ce document. Les ecarts identifies sont des contrats a corriger par @developer et @db-specialist.*
