# Sprint Plan — Modele de Croissance Gompertz

**Date :** 2026-03-29
**Reference :** `docs/reviews/review-gompertz-implementation.md`
**Guide source :** `docs/guides/gompertz-farmflow-guide.docx`
**Effort total estime :** ~8.75 jours (+ 0.5 jour pre-requis)

---

## Vue d'ensemble

| Sprint | Nom | Objectif | Effort | Prerequis |
|--------|-----|----------|--------|-----------|
| G0 | Pre-requis | Valider convergence LM sur donnees reelles | 0.5 j | Aucun |
| G1 | Fondations Gompertz | Lib + DB + API | 3.25 j | G0 |
| G2 | Integration UI | Courbe dans projections + badges | 2.25 j | G1 |
| G3 | Comparaison aliments via K | Agregation K par produit + UI analytics | 2.75 j | G2 (NICE-TO-HAVE) |

---

## Sprint G0 — Pre-requis : Validation LM

**Objectif :** Valider que la bibliotheque `ml-levenberg-marquardt` (ou implementation maison) converge correctement sur les donnees biometriques DK Farm avant tout developpement.

---

### Story G0.1 — Validation convergence Levenberg-Marquardt
**Assigne a :** @architect | **Effort :** 0.5 j | **Depend de :** Aucune | **Statut :** `TODO` | **Type :** RESEARCH

**Description :** Installer `levenberg-marquardt` (mljs). Ecrire un script de test avec les donnees seed DK Farm (20 releves biometriques) et les points de reference FAO. Verifier que LM converge vers des parametres physiquement plausibles avec contraintes de bornes.

**Taches :**
- [ ] `TODO` Installer `levenberg-marquardt` (npm) et verifier compatibilite TypeScript/Node.js
- [ ] `TODO` Ecrire un script standalone `scripts/test-gompertz-lm.ts` avec les donnees seed
- [ ] `TODO` Tester avec 5, 10, 15 points biometriques — verifier convergence et R²
- [ ] `TODO` Tester les bornes : K ∈ [0.005, 0.2], W∞ ∈ [max observe, 3000g], ti ∈ [0, 120j]
- [ ] `TODO` Documenter les resultats dans `docs/decisions/ADR-gompertz-lm-validation.md`

**Criteres d'acceptation :**
- LM converge en < 200 iterations sur les jeux de test
- R² > 0.90 avec 5+ points biometriques bien repartis
- Les parametres restent dans les bornes physiques
- Decision GO/NO-GO documentee

---

## Sprint G1 — Fondations Gompertz

**Objectif :** Implementer la bibliotheque de calcul Gompertz, la table de persistance, et l'API route de calibrage. A la fin de ce sprint, le calibrage automatique fonctionne en backend.
**Depend de :** Sprint G0 (decision GO)

---

### Story G1.1 — Bibliotheque `gompertz.ts` — Fonctions pures
**Assigne a :** @developer | **Effort :** 1 j | **Depend de :** G0.1 GO | **Statut :** `TODO` | **Type :** FEATURE

**Description :** Creer `src/lib/gompertz.ts` avec les fonctions pures de calcul Gompertz. Aucune dependance DB. Utilise `levenberg-marquardt` pour le calibrage.

**Taches :**
- [ ] `TODO` Creer `src/lib/gompertz.ts` avec les interfaces `GompertzParams`, `GompertzCalibrationInput`, `GompertzCalibrationResult`
- [ ] `TODO` Implementer `gompertzWeight(t, params)` — prediction de poids a un jour donne
- [ ] `TODO` Implementer `gompertzVelocity(t, params)` — taux de croissance instantane dW/dt
- [ ] `TODO` Implementer `calibrerGompertz(input)` — regression LM avec bornes et initialisation automatique
- [ ] `TODO` Implementer `projeterDateRecolte(params, poidsObjectif, joursActuels)` — jours restants
- [ ] `TODO` Implementer `genererCourbeGompertz(params, joursMax, pas)` — serie de points pour graphique
- [ ] `TODO` Implementer strategie d'initialisation des parametres LM (W∞₀ = max × 1.5, K₀ = 0.03, ti₀ = 45)
- [ ] `TODO` Implementer graduation de confiance : INSUFFICIENT_DATA (< 5 pts), LOW (5-6), MEDIUM (7-9), HIGH (10+, R² > 0.95)

**Criteres d'acceptation :**
- `gompertzWeight(0, {wInfinity: 1200, k: 0.018, ti: 95})` retourne ~0.2g (≈ poids initial)
- `calibrerGompertz` converge sur les donnees FAO de reference avec R² > 0.98
- Les bornes physiques sont respectees (K > 0, W∞ > max observe)
- Toutes les fonctions sont pures, sans effet de bord

---

### Story G1.2 — Tests unitaires `gompertz.ts`
**Assigne a :** @tester | **Effort :** 0.5 j | **Depend de :** G1.1 | **Statut :** `TODO` | **Type :** TEST

**Description :** Tests unitaires couvrant la convergence LM, les cas limites, et les bornes physiques.

**Taches :**
- [ ] `TODO` Creer `src/__tests__/lib/gompertz.test.ts`
- [ ] `TODO` Test : `gompertzWeight` retourne des valeurs croissantes pour t croissant
- [ ] `TODO` Test : `gompertzWeight` tend vers W∞ quand t → ∞
- [ ] `TODO` Test : `gompertzVelocity` est maximale a t = ti
- [ ] `TODO` Test : `calibrerGompertz` converge sur jeu synthetique (15 points FAO)
- [ ] `TODO` Test : `calibrerGompertz` retourne null si < 5 points
- [ ] `TODO` Test : `calibrerGompertz` respecte les bornes (pas de K negatif, W∞ > max)
- [ ] `TODO` Test : `projeterDateRecolte` retourne null si W∞ < poidsObjectif
- [ ] `TODO` Test : confidence level correct selon nombre de points

**Criteres d'acceptation :**
- Couverture > 90% sur `gompertz.ts`
- Tous les tests passent avec `npx vitest run`
- Cas degeneres testes (0 points, 1 point, points identiques, W∞ trop bas)

---

### Story G1.3 — Migration Prisma : table `GompertzVague`
**Assigne a :** @db-specialist | **Effort :** 0.5 j | **Depend de :** Aucune | **Statut :** `TODO` | **Type :** DB

**Description :** Creer la table `GompertzVague` (relation 1:1 avec Vague) pour persister les parametres calibres. Ajouter la relation sur le modele Vague.

**Taches :**
- [ ] `TODO` Ajouter le modele `GompertzVague` dans `prisma/schema.prisma` (id, vagueId unique, wInfinity, k, ti, r2, rmse, biometrieCount, confidenceLevel, siteId, calculatedAt, updatedAt)
- [ ] `TODO` Ajouter `gompertz GompertzVague?` sur le modele `Vague`
- [ ] `TODO` Ajouter `gompertzVagues GompertzVague[]` sur le modele `Site`
- [ ] `TODO` Generer la migration SQL manuellement (workaround non-interactif)
- [ ] `TODO` Appliquer avec `npx prisma migrate deploy`
- [ ] `TODO` Mettre a jour le seed si necessaire (optionnel)

**Criteres d'acceptation :**
- Migration appliquee sans erreur
- `GompertzVague` a une contrainte UNIQUE sur vagueId
- FK CASCADE sur vagueId (suppression vague → suppression parametres)
- Index sur siteId et vagueId
- R8 respecte : siteId present

---

### Story G1.4 — API route `GET /api/vagues/[id]/gompertz`
**Assigne a :** @developer | **Effort :** 1 j | **Depend de :** G1.1, G1.3 | **Statut :** `TODO` | **Type :** FEATURE

**Description :** Creer l'API route qui retourne les parametres Gompertz calibres pour une vague. Calibrage lazy : recalcule si nouvelles biometries depuis le dernier calibrage.

**Taches :**
- [ ] `TODO` Creer `src/app/api/vagues/[id]/gompertz/route.ts` (GET)
- [ ] `TODO` Verifier auth + siteId (R8)
- [ ] `TODO` Lire `GompertzVague` existant pour la vague
- [ ] `TODO` Compter les releves BIOMETRIE de la vague
- [ ] `TODO` Si pas de GompertzVague OU biometrieCount a change → recalibrer via `calibrerGompertz()`
- [ ] `TODO` Upsert le resultat dans `GompertzVague`
- [ ] `TODO` Retourner `{ vagueId, calibration, courbe, dateRecolteEstimee }`
- [ ] `TODO` Gerer le cas < 5 biometries → retourner `confidenceLevel: "INSUFFICIENT_DATA"` sans courbe

**Criteres d'acceptation :**
- La route retourne 200 avec les parametres calibres si >= 5 biometries
- La route retourne 200 avec `calibration: null` si < 5 biometries
- Le recalibrage n'est declenche que si necessaire (lazy)
- Auth et siteId verifies

---

### Story G1.5 — Constantes de reference Gompertz dans benchmarks
**Assigne a :** @developer | **Effort :** 0.25 j | **Depend de :** G1.1 | **Statut :** `TODO` | **Type :** FEATURE

**Description :** Ajouter les constantes de reference FAO/CIRAD pour Clarias dans `src/lib/benchmarks.ts` et une fonction d'evaluation du parametre K.

**Taches :**
- [ ] `TODO` Ajouter `GOMPERTZ_REF_CLARIAS` dans `src/lib/benchmarks.ts` (plages W∞, K, ti)
- [ ] `TODO` Implementer `evaluerKGompertz(k): "EXCELLENT" | "BON" | "FAIBLE"`
- [ ] `TODO` Exporter le type `GompertzKLevel`

**Criteres d'acceptation :**
- K ∈ [0.020, 0.2] → "EXCELLENT", K ∈ [0.015, 0.020) → "BON", K < 0.015 → "FAIBLE"
- Constantes coherentes avec la recherche `docs/research/clarias-gariepinus-density-parameters.md`

---

## Sprint G2 — Integration UI et Projections

**Objectif :** Afficher la courbe Gompertz dans le dashboard de projections existant. Badges de fiabilite et date de recolte Gompertz vs SGR.
**Depend de :** Sprint G1 FAIT

---

### Story G2.1 — Extension des types TypeScript
**Assigne a :** @architect | **Effort :** 0.25 j | **Depend de :** G1.1 | **Statut :** `TODO` | **Type :** TYPES

**Description :** Etendre `CourbeCroissancePoint` et `ProjectionVague` dans `src/types/calculs.ts` avec les champs Gompertz optionnels (non-breaking).

**Taches :**
- [ ] `TODO` Ajouter `poidsGompertz: number | null` a `CourbeCroissancePoint`
- [ ] `TODO` Creer `ProjectionVagueV2` etendant `ProjectionVague` avec `gompertzParams`, `gompertzR2`, `gompertzConfidence`, `dateRecolteGompertz`
- [ ] `TODO` Exporter `GompertzParams` depuis `src/types/index.ts`

**Criteres d'acceptation :**
- Les types existants restent compatibles (champs optionnels)
- Build passe sans erreur

---

### Story G2.2 — Extension `CourbeProjectionChart` : ligne Gompertz
**Assigne a :** @developer | **Effort :** 0.5 j | **Depend de :** G2.1 | **Statut :** `TODO` | **Type :** UI

**Description :** Ajouter une troisieme ligne Recharts (Gompertz) dans le composant `CourbeProjectionChart` de `src/components/dashboard/projections.tsx`. Couleur amber, tirets fins, conditionnelle.

**Taches :**
- [ ] `TODO` Ajouter `<Line dataKey="poidsGompertz">` conditionnelle dans `CourbeProjectionChart`
- [ ] `TODO` Style : `stroke="var(--accent-amber)"`, `strokeDasharray="2 2"`, `strokeWidth={1.5}`, pas de dots
- [ ] `TODO` Etendre la legende : "Reel", "Projete (SGR)", "Gompertz"
- [ ] `TODO` Etendre le Tooltip pour afficher les 3 valeurs si presentes

**Criteres d'acceptation :**
- La ligne Gompertz n'apparait que si `poidsGompertz` est non-null dans les donnees
- Le graphique existant fonctionne identiquement sans donnees Gompertz (non-breaking)
- Mobile 360px : les 3 lignes restent lisibles

---

### Story G2.3 — Extension `ProjectionCard` : badges et date recolte Gompertz
**Assigne a :** @developer | **Effort :** 0.5 j | **Depend de :** G2.1 | **Statut :** `TODO` | **Type :** UI

**Description :** Afficher un badge de fiabilite du modele Gompertz et la date de recolte Gompertz (vs SGR) dans la carte de projection.

**Taches :**
- [ ] `TODO` Badge fiabilite : "Modele fiable" (HIGH, vert), "En construction" (MEDIUM, amber), "Estimation preliminaire" (LOW, gris), "Donnees insuffisantes (min. 5 biometries)" (INSUFFICIENT_DATA)
- [ ] `TODO` Afficher la date de recolte Gompertz a cote de la date SGR si disponible
- [ ] `TODO` Traduction des parametres en langage metier : W∞ → "Poids plafond", K → "Vitesse: Rapide/Normale/Lente", ti → "Pic jour X"
- [ ] `TODO` Section "Details techniques" collapsible pour INGENIEUR/ADMIN avec W∞, K, ti, R², RMSE bruts

**Criteres d'acceptation :**
- L'utilisateur GERANT ne voit jamais W∞/K/ti en valeurs brutes
- Le badge s'affiche correctement sur les 4 niveaux de confiance
- Les deux dates de recolte (SGR et Gompertz) sont clairement identifiees
- UX non-breaking si Gompertz absent

---

### Story G2.4 — Connexion Server Component → API Gompertz
**Assigne a :** @developer | **Effort :** 0.5 j | **Depend de :** G1.4, G2.2 | **Statut :** `TODO` | **Type :** FEATURE

**Description :** Dans le Server Component parent du dashboard, appeler l'API Gompertz pour chaque vague active et injecter les donnees dans `ProjectionVague`.

**Taches :**
- [ ] `TODO` Dans `src/lib/queries/dashboard.ts` ou le Server Component parent, fetcher `/api/vagues/[id]/gompertz` pour chaque vague active
- [ ] `TODO` Merger la courbe Gompertz dans `courbeProjection` (ajouter `poidsGompertz` a chaque point)
- [ ] `TODO` Remplir `gompertzParams`, `gompertzR2`, `gompertzConfidence`, `dateRecolteGompertz` dans `ProjectionVague`
- [ ] `TODO` Gerer gracieusement le cas ou l'API Gompertz retourne null (pas assez de donnees)

**Criteres d'acceptation :**
- Le dashboard affiche la courbe Gompertz si donnees suffisantes
- Le dashboard fonctionne normalement si Gompertz non disponible
- Pas de N+1 : un seul appel par vague

---

### Story G2.5 — Tests UI projections avec Gompertz
**Assigne a :** @tester | **Effort :** 0.5 j | **Depend de :** G2.4 | **Statut :** `TODO` | **Type :** TEST

**Description :** Tests du composant projections etendu avec les 4 scenarios de confiance Gompertz.

**Taches :**
- [ ] `TODO` Creer `src/__tests__/ui/gompertz-projections.test.tsx`
- [ ] `TODO` Test : pas de ligne Gompertz si `poidsGompertz` absent dans les donnees
- [ ] `TODO` Test : ligne Gompertz affichee si donnees presentes
- [ ] `TODO` Test : badge "Donnees insuffisantes" si confidenceLevel = INSUFFICIENT_DATA
- [ ] `TODO` Test : badge "Modele fiable" si confidenceLevel = HIGH
- [ ] `TODO` Test : section details techniques visible seulement pour INGENIEUR
- [ ] `TODO` Test : build passe (`npm run build`)

**Criteres d'acceptation :**
- Tous les tests passent
- Build production OK
- Non-regression : les tests projections existants passent toujours

---

## Sprint G3 — Comparaison aliments via parametre K (NICE-TO-HAVE)

**Objectif :** Agreger le parametre K de Gompertz par aliment pour permettre une comparaison objective de l'impact de chaque aliment sur la croissance.
**Depend de :** Sprint G2 FAIT + minimum 3 vagues terminees avec donnees Gompertz
**Condition :** Sprint conditionnel. Ne demarrer que si les sites ont assez de vagues terminees.

---

### Story G3.1 — Agregation K par produitId
**Assigne a :** @db-specialist | **Effort :** 1 j | **Depend de :** G1.3 | **Statut :** `TODO` | **Type :** DB/QUERY

**Description :** Requete Prisma joignant `GompertzVague`, `Vague`, `ReleveConsommation`, `Produit` pour agreger le K moyen par aliment.

**Taches :**
- [ ] `TODO` Creer `src/lib/queries/gompertz-analytics.ts`
- [ ] `TODO` Implementer `getKParAliment(siteId)` : pour chaque produit, agreger le K moyen pondere des vagues ou il est utilise
- [ ] `TODO` Ponderer par quantite d'aliment distribuee dans chaque vague
- [ ] `TODO` Filtrer : uniquement vagues avec `confidenceLevel` HIGH ou MEDIUM
- [ ] `TODO` Retourner : produitId, nom, fournisseur, kMoyen, kNiveau, nombreVagues

**Criteres d'acceptation :**
- La requete est optimisee (pas de N+1)
- Filtre siteId respecte (R8)
- Ne retourne que les aliments avec >= 2 vagues de donnees

---

### Story G3.2 — Extension types AnalytiqueAliment
**Assigne a :** @architect | **Effort :** 0.25 j | **Depend de :** G1.5 | **Statut :** `TODO` | **Type :** TYPES

**Description :** Etendre les types analytics aliments avec les champs Gompertz K.

**Taches :**
- [ ] `TODO` Ajouter `kMoyenGompertz: number | null` aux types analytiques aliment existants
- [ ] `TODO` Ajouter `kNiveauGompertz: GompertzKLevel | null`
- [ ] `TODO` Exporter les nouveaux types

**Criteres d'acceptation :**
- Types non-breaking (champs optionnels)
- Build passe

---

### Story G3.3 — UI comparaison aliments avec K Gompertz
**Assigne a :** @developer | **Effort :** 1 j | **Depend de :** G3.1, G3.2 | **Statut :** `TODO` | **Type :** UI

**Description :** Ajouter une colonne "Vitesse de croissance Gompertz" dans la page analytics aliments et un graphique comparatif K par aliment.

**Taches :**
- [ ] `TODO` Etendre `src/components/analytics/feed-comparison-cards.tsx` avec colonne K Gompertz
- [ ] `TODO` Afficher K en langage metier : "Rapide" (vert), "Normal" (amber), "Lent" (rouge)
- [ ] `TODO` Ajouter un graphique barre horizontale : K par aliment (ordonne du meilleur au moins bon)
- [ ] `TODO` Tooltip : "Cet aliment a produit une vitesse de croissance X% superieure/inferieure a la moyenne"
- [ ] `TODO` Conditionnel : section masquee si aucun aliment n'a de donnees Gompertz

**Criteres d'acceptation :**
- La comparaison K est coherente avec la comparaison FCR existante
- Mobile first 360px : graphique lisible
- Non-breaking si pas de donnees Gompertz

---

### Story G3.4 — Tests agregation K et UI
**Assigne a :** @tester | **Effort :** 0.5 j | **Depend de :** G3.3 | **Statut :** `TODO` | **Type :** TEST

**Description :** Tests de l'agregation K par aliment et de l'affichage UI.

**Taches :**
- [ ] `TODO` Creer `src/__tests__/lib/gompertz-analytics.test.ts`
- [ ] `TODO` Test : `getKParAliment` retourne les bons K ponderes
- [ ] `TODO` Test : aliments avec < 2 vagues sont exclus
- [ ] `TODO` Test : filtrage par siteId
- [ ] `TODO` Test UI : colonne K affichee si donnees presentes
- [ ] `TODO` Test : build passe

**Criteres d'acceptation :**
- Tous les tests passent
- Build production OK
- Validation sur donnees seed

---

## Resume des efforts

| Sprint | Stories | Effort | Agents |
|--------|---------|--------|--------|
| G0 | 1 | 0.5 j | @architect |
| G1 | 5 | 3.25 j | @developer (2.25j), @tester (0.5j), @db-specialist (0.5j) |
| G2 | 5 | 2.25 j | @architect (0.25j), @developer (1.5j), @tester (0.5j) |
| G3 | 4 | 2.75 j | @db-specialist (1j), @architect (0.25j), @developer (1j), @tester (0.5j) |
| **Total** | **15** | **~8.75 j** | |

## Diagramme de dependances

```
G0.1 (validation LM)
  └── G1.1 (lib gompertz.ts)
        ├── G1.2 (tests)
        ├── G1.5 (benchmarks)
        │     └── G3.2 (types analytics)
        └── G1.4 (API route) ←── G1.3 (migration DB)
              └── G2.4 (connexion Server Component)
                    └── G2.5 (tests UI)
  G2.1 (types) ←── G1.1
        ├── G2.2 (ligne Recharts)
        └── G2.3 (badges + date recolte)
  G3.1 (agregation K) ←── G1.3
        └── G3.3 (UI comparaison) → G3.4 (tests)
```
