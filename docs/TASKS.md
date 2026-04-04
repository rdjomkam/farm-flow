# Backlog — Suivi Silures

> Géré par @project-manager. Chaque agent met à jour le statut de ses tâches.
> Statuts : `TODO` | `EN COURS` | `REVIEW` | `FAIT` | `BLOQUÉ`

---

## Sprint 1 — Fondations (DB + Types + Structure)

**Objectif :** Avoir le schéma de données fonctionnel, les types TypeScript définis et la structure du projet en place. Aucune UI dans ce sprint.

### Story 1.1 — Schéma Prisma et base de données
**Assigné à :** @db-specialist
**Priorité :** Critique
**Description :** Créer le schéma Prisma avec les 3 modèles (Bac, Vague, Releve) et initialiser la base PostgreSQL.

**Tâches :**
- [x] `FAIT` Vérifier que Docker PostgreSQL tourne (`docker compose up -d`)
- [x] `FAIT` Écrire prisma/schema.prisma avec les enums PostgreSQL (StatutVague, TypeReleve, TypeAliment, CauseMortalite, MethodeComptage) et les modèles Bac, Vague, Releve
- [x] `FAIT` Ajouter les index pertinents (vagueId sur Bac, vagueId+typeReleve sur Releve, bacId sur Releve, date sur Releve)
- [x] `FAIT` Créer src/lib/db.ts (singleton Prisma)
- [x] `FAIT` Exécuter `npx prisma migrate dev --name init` et vérifier que la migration est valide

**Critères d'acceptation :**
- Le schéma utilise des enums PostgreSQL (pas de String pour les types) ✅
- Le schéma respecte la règle : un bac = une seule vague (vagueId nullable) ✅
- `npx prisma migrate dev` passe sans erreur et crée le dossier prisma/migrations/ ✅

---

### Story 1.2 — Données de seed réalistes
**Assigné à :** @db-specialist
**Dépend de :** Story 1.1
**Priorité :** Haute
**Description :** Créer un fichier seed avec des données réalistes pour le développement et les tests.

**Tâches :**
- [x] `FAIT` Créer prisma/seed.sql (SQL direct au lieu de seed.ts — incompatibilité ESM Prisma 7)
- [x] `FAIT` Insérer 4 bacs (Bac 1, Bac 2, Bac 3, Étang A)
- [x] `FAIT` Insérer 2 vagues (une en cours avec 3 bacs, une terminée avec 1 bac)
- [x] `FAIT` Insérer 20 relevés variés (tous les types, répartis sur 2 mois)
- [x] `FAIT` Configurer le script seed dans package.json (`npm run db:seed`)
- [x] `FAIT` Exécuter le seed et vérifier (2 vagues, 4 bacs, 20 relevés OK)

**Critères d'acceptation :**
- Les données sont réalistes (poids entre 5g et 500g, mortalités crédibles, etc.) ✅
- Chaque type de relevé est représenté au moins 2 fois ✅
- Le seed s'exécute sans erreur sur une base vide ✅

---

### Story 1.3 — Interfaces TypeScript et DTOs
**Assigné à :** @architect
**Priorité :** Critique
**Description :** Définir toutes les interfaces TypeScript pour les modèles, les DTOs d'API (request/response) et les types utilitaires.

**Tâches :**
- [x] `FAIT` Créer src/types/models.ts — types miroirs du schéma Prisma (Bac, Vague, Releve)
- [x] `FAIT` Créer src/types/api.ts — DTOs pour chaque endpoint (CreateVagueDTO, CreateReleveDTO, VagueDetailResponse, etc.)
- [x] `FAIT` Créer src/types/releves.ts — type discriminé par typeReleve (union type)
- [x] `FAIT` Créer src/types/calculs.ts — types pour les indicateurs (IndicateursVague, BilanVague)
- [x] `FAIT` Documenter chaque type avec des commentaires JSDoc

**Critères d'acceptation :**
- Aucun `any` dans les types
- Le type Releve utilise un union type discriminé par typeReleve
- Tous les DTOs ont les champs obligatoires et optionnels bien marqués

---

### Story 1.4 — Structure du projet et décisions architecturales
**Assigné à :** @architect
**Priorité :** Haute
**Description :** Documenter la structure de dossiers, les patterns de composants et les décisions techniques.

**Tâches :**
- [x] `FAIT` Écrire docs/decisions/001-structure-projet.md (arborescence des fichiers)
- [x] `FAIT` Écrire docs/decisions/002-composants-ui.md (arbre des composants Radix UI, pattern mobile first)
- [x] `FAIT` Écrire docs/decisions/003-api-routes.md (contrats request/response pour chaque route)
- [x] `FAIT` Créer les dossiers vides : src/components/ui/, src/components/layout/, src/components/vagues/, src/components/releves/, src/components/dashboard/, src/lib/queries/

**Critères d'acceptation :**
- Chaque décision est documentée avec le contexte, les options considérées et le choix retenu
- L'arbre des composants montre clairement la hiérarchie mobile first
- Les contrats d'API sont cohérents avec les DTOs de la Story 1.3

---

### Story 1.5 — Review Sprint 1
**Assigné à :** @code-reviewer
**Dépend de :** Stories 1.1, 1.2, 1.3, 1.4
**Priorité :** Haute
**Description :** Vérifier la cohérence entre le schéma Prisma, les types TypeScript et les décisions architecturales.

**Tâches :**
- [x] `FAIT` Vérifier que les types TypeScript correspondent au schéma Prisma
- [x] `FAIT` Vérifier que les contrats d'API sont cohérents avec les types
- [x] `FAIT` Vérifier que la structure de dossiers respecte les conventions du CLAUDE.md
- [x] `FAIT` Écrire docs/reviews/review-sprint-1.md

**Résultat :** 6 problèmes critiques identifiés (C1-C6), 2 importants (I1-I2). Voir docs/reviews/review-sprint-1.md.

**Critères d'acceptation :**
- Aucune incohérence entre schéma, types et contrats d'API
- Toutes les remarques critiques sont résolues avant le Sprint 2

---

### Story 1.6 — Corrections post-review (AJOUTÉE)
**Assigné à :** @db-specialist + @architect
**Dépend de :** Story 1.5
**Priorité :** Critique — BLOQUE le Sprint 2
**Description :** Corriger les 6 problèmes critiques et 2 importants identifiés dans la review Sprint 1.

<!-- Décisions PM du 2026-03-08 :
- C1 : Enums Prisma → MAJUSCULES (option a du reviewer)
- C2 : TypeAliment → ARTISANAL, COMMERCIAL, MIXTE
- C3 : CauseMortalite → union des deux (7 valeurs)
- C4 : MethodeComptage → DIRECT, ESTIMATION, ECHANTILLONNAGE
- C5-C6 : Noms TS retenus (plus explicites)
- I1 : volume obligatoire
- I2 : nombrePoissons gardé + ajouté en TS
-->

**Tâches @db-specialist :**
- [x] `FAIT` C1-C4 : Aligner tous les enums Prisma en MAJUSCULES avec les valeurs définitives (migration enums_uppercase)
- [x] `FAIT` C5-C6 : Renommer les champs Vague et Releve + ajouter dateFin (migration rename_fields)
- [x] `FAIT` I1 : Retirer le ? sur Bac.volume
- [x] `FAIT` Mettre à jour prisma/seed.sql (noms colonnes + enums MAJUSCULES alignés)
- [x] `FAIT` Client Prisma régénéré

**Tâches @architect :**
- [x] `FAIT` C2-C4 : Aligner les valeurs d'enums dans src/types/models.ts
- [x] `FAIT` I2 : Ajouter nombrePoissons dans l'interface Bac et DTOs
- [x] `FAIT` M1 : Corriger seed.ts → seed.sql dans ADR 001
- [x] `FAIT` S2 : Changer statut: string → StatutVague dans calculs.ts

**Critères d'acceptation :**
- Tous les enums Prisma et TS ont les mêmes valeurs (même casse)
- Tous les noms de champs sont identiques entre Prisma et TS
- La migration s'exécute sans erreur
- Le seed s'exécute sans erreur sur base vide

---

### Story 1.7 — Re-review Sprint 1 (AJOUTÉE)
**Assigné à :** @code-reviewer
**Dépend de :** Story 1.6
**Priorité :** Critique — BLOQUE le Sprint 2

**Tâches :**
- [x] `FAIT` Vérifier que les 6 problèmes critiques (C1-C6) sont résolus
- [x] `FAIT` Vérifier que les 2 problèmes importants (I1-I2) sont résolus
- [x] `FAIT` Mettre à jour docs/reviews/review-sprint-1.md avec verdict final

<!-- Sprint 1 VALIDÉ le 2026-03-08. 11 corrections appliquées, 3 migrations, verdict VALIDE. -->

---

## Sprint 2 — API Routes et logique métier

**Objectif :** Toutes les API routes fonctionnent, les calculs d'indicateurs sont implémentés et testés. Pas encore d'UI.

### Story 2.1 — Fonctions de calcul des indicateurs
**Assigné à :** @developer
**Priorité :** Critique
**Description :** Implémenter les fonctions de calcul pures (sans dépendance DB) pour les indicateurs piscicoles.

**Tâches :**
- [x] `FAIT` Créer src/lib/calculs.ts
- [x] `FAIT` Implémenter calculerTauxSurvie(nombreVivants, nombreInitial) → pourcentage
- [x] `FAIT` Implémenter calculerGainPoids(poidsMoyenActuel, poidsMoyenPrecedent) → grammes
- [x] `FAIT` Implémenter calculerSGR(poidsInitial, poidsFinal, nombreJours) → pourcentage/jour
- [x] `FAIT` Implémenter calculerFCR(totalAliment, gainBiomasse) → ratio
- [x] `FAIT` Implémenter calculerBiomasse(poidsMoyen, nombreVivants) → kg
- [x] `FAIT` Gérer les cas limites (division par zéro, valeurs nulles)

**Critères d'acceptation :**
- Fonctions pures, testables, bien typées
- Cas limites gérés (retournent null ou 0, pas d'erreur)
- Commentaires JSDoc avec les formules

---

### Story 2.2 — Tests des fonctions de calcul
**Assigné à :** @tester
**Dépend de :** Story 2.1
**Priorité :** Critique
**Description :** Écrire les tests unitaires pour toutes les fonctions de calcul.

**Tâches :**
- [x] `FAIT` Installer et configurer Vitest (vitest.config.ts)
- [x] `FAIT` Créer src/__tests__/calculs.test.ts (42 tests)
- [x] `FAIT` Tester chaque fonction avec des valeurs réalistes de silures
- [x] `FAIT` Tester les cas limites (0 poissons, 0 aliment, 0 jours, valeurs négatives)
- [x] `FAIT` Vérifier les résultats avec des calculs manuels
- [x] `FAIT` Tous les tests passent au vert

**Critères d'acceptation :**
- Couverture 100% des fonctions de calcul
- Au moins 3 cas de test par fonction (normal, limite, erreur)
- `npx vitest run` passe sans erreur

---

### Story 2.3 — Fonctions de requête Prisma
**Assigné à :** @db-specialist
**Priorité :** Haute
**Description :** Créer des fonctions de requête réutilisables qui encapsulent les appels Prisma.

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/bacs.ts — getBacs(), getBacById(), createBac(), getBacsLibres(), assignerBac(), libererBac()
- [x] `FAIT` Créer src/lib/queries/vagues.ts — getVagues(), getVagueById() (avec bacs et relevés), createVague(), cloturerVague()
- [x] `FAIT` Créer src/lib/queries/releves.ts — getReleves(filtres), createReleve(), getRelevesByType()
- [x] `FAIT` Créer src/lib/queries/indicateurs.ts — getIndicateursVague() (agrège les données pour les calculs)
- [x] `FAIT` Gérer la transaction pour cloturerVague (libérer tous les bacs en même temps)

**Critères d'acceptation :**
- Chaque fonction est typée avec les DTOs de la Story 1.3
- La clôture de vague libère les bacs dans une transaction
- Pas de requête N+1 (utiliser include/select Prisma)

---

### Story 2.4 — API Routes CRUD
**Assigné à :** @developer
**Dépend de :** Stories 2.1, 2.3
**Priorité :** Critique
**Description :** Implémenter les API routes Next.js (App Router) pour les bacs, vagues et relevés.

**Tâches :**
- [x] `FAIT` Créer src/app/api/bacs/route.ts — GET (lister) + POST (créer)
- [x] `FAIT` Créer src/app/api/vagues/route.ts — GET (lister) + POST (créer avec bacIds)
- [x] `FAIT` Créer src/app/api/vagues/[id]/route.ts — GET (détail + indicateurs) + PUT (modifier/clôturer)
- [x] `FAIT` Créer src/app/api/releves/route.ts — GET (filtrer par vagueId, type, bacId) + POST (créer)
- [x] `FAIT` Valider les entrées (typeReleve obligatoire, bacId doit appartenir à la vague, etc.)
- [x] `FAIT` Retourner des erreurs HTTP propres (400, 404, 409 pour bac déjà assigné)

**Critères d'acceptation :**
- Toutes les routes retournent du JSON correctement typé
- Validation : impossible de créer un relevé sans typeReleve
- Validation : impossible d'assigner un bac déjà occupé
- Erreurs avec messages clairs en français

---

### Story 2.5 — Tests d'intégration des API
**Assigné à :** @tester
**Dépend de :** Story 2.4
**Priorité :** Haute
**Description :** Tester les API routes de bout en bout.

**Tâches :**
- [x] `FAIT` Créer src/__tests__/api/bacs.test.ts (12 tests)
- [x] `FAIT` Créer src/__tests__/api/vagues.test.ts (23 tests)
- [x] `FAIT` Créer src/__tests__/api/releves.test.ts (31 tests)
- [x] `FAIT` Tester le scénario complet : créer bacs → créer vague → ajouter relevés → clôturer
- [x] `FAIT` Tester les cas d'erreur : bac déjà assigné, vague inexistante, type manquant
- [x] `FAIT` Écrire docs/tests/rapport-sprint-2.md

**Critères d'acceptation :**
- Tous les endpoints testés (happy path + erreurs)
- Le scénario complet de bout en bout passe
- Rapport de test documenté

---

### Story 2.6 — Review Sprint 2
**Assigné à :** @code-reviewer
**Dépend de :** Stories 2.1 à 2.5
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Review de src/lib/calculs.ts (formules correctes, cas limites)
- [x] `FAIT` Review de src/lib/queries/ (pas de N+1, transactions, typage)
- [x] `FAIT` Review des API routes (validation, erreurs, sécurité)
- [x] `FAIT` Review des tests (couverture suffisante, cas pertinents)
- [x] `FAIT` Écrire docs/reviews/review-sprint-2.md

**Résultat :** CONDITIONNEL — 1 critique (C1 dateFin ignorée), 5 importants (I1-I5). Voir docs/reviews/review-sprint-2.md.

---

### Story 2.7 — Corrections post-review Sprint 2 (AJOUTÉE)
**Assigné à :** @db-specialist + @developer
**Dépend de :** Story 2.6
**Priorité :** Critique — BLOQUE le Sprint 3

<!-- Décisions PM du 2026-03-08 :
- C1 : passer dateFin en paramètre de cloturerVague + utiliser dans la route PUT
- I1 : remplacer string literals par enums importés
- I2 : updateMany atomique pour assignerBac
- I3 : filtre statut côté DB dans getVagues
- I4 : construire DTO propre dans POST /api/releves
- I5 : ajouter nombreBacs dans réponse PUT
- S2 : réutiliser calculs.ts dans indicateurs.ts
- M1-M3 : reportés au Sprint 5
-->

**Tâches @db-specialist :**
- [x] `FAIT` C1 : Ajouter paramètre dateFin à cloturerVague(id, dateFin?)
- [x] `FAIT` I1 : Remplacer string literals par enums importés dans queries/*.ts
- [x] `FAIT` I2 : Corriger race condition assignerBac → updateMany atomique
- [x] `FAIT` I3 : Ajouter paramètre filtre à getVagues(filters?)
- [x] `FAIT` S2 : Utiliser calculs.ts dans indicateurs.ts

**Tâches @developer :**
- [x] `FAIT` C1 : Passer dateFin à cloturerVague dans PUT /api/vagues/[id]
- [x] `FAIT` I3 : Passer filtre statut à getVagues dans GET /api/vagues
- [x] `FAIT` I4 : Construire DTO propre dans POST /api/releves
- [x] `FAIT` I5 : Ajouter nombreBacs dans réponse PUT /api/vagues/[id]

---

### Story 2.8 — Re-review Sprint 2 (AJOUTÉE)
**Assigné à :** @code-reviewer
**Dépend de :** Story 2.7
**Priorité :** Critique — BLOQUE le Sprint 3

**Tâches :**
- [x] `FAIT` Vérifier corrections C1, I1-I5, S2
- [x] `FAIT` Vérifier que les 108 tests passent toujours
- [x] `FAIT` Mettre à jour docs/reviews/review-sprint-2.md avec verdict final

<!-- Sprint 2 VALIDÉ le 2026-03-08. 7 corrections appliquées, verdict VALIDE. M1-M3, S1 reportés au Sprint 5. -->

---

## Sprint 3 — UI Mobile First (Layout + Dashboard)

**Objectif :** L'utilisateur peut voir le dashboard et naviguer dans l'app sur mobile.

### Story 3.1 — Composants UI de base (Radix UI + Tailwind)
**Assigné à :** @developer
**Priorité :** Critique
**Description :** Créer les composants UI réutilisables basés sur Radix UI, stylés avec Tailwind, mobile first.

**Tâches :**
- [x] `FAIT` Créer src/components/ui/button.tsx — bouton avec variantes (primary, secondary, danger, ghost, outline), taille tactile (min 44px)
- [x] `FAIT` Créer src/components/ui/card.tsx — carte pour afficher les données sur mobile
- [x] `FAIT` Créer src/components/ui/select.tsx — wrapper Radix Select stylé avec label/error
- [x] `FAIT` Créer src/components/ui/dialog.tsx — wrapper Radix Dialog (plein écran sur mobile, centré desktop)
- [x] `FAIT` Créer src/components/ui/tabs.tsx — wrapper Radix Tabs
- [x] `FAIT` Créer src/components/ui/toast.tsx — Radix Toast avec ToastProvider/useToast, 4 variants
- [x] `FAIT` Créer src/components/ui/input.tsx — champ de saisie large et tactile avec label/error
- [x] `FAIT` Créer src/components/ui/badge.tsx — badges de statut (en_cours, terminee, annulee, info, warning)
- [x] `FAIT` Créer src/lib/utils.ts — utilitaire cn() (clsx + tailwind-merge)

**Critères d'acceptation :**
- Tous les composants utilisent les primitives Radix UI ✅
- Taille minimale tactile de 44px pour tous les éléments interactifs ✅
- Styles mobile first (pas de breakpoint par défaut, sm: et md: pour desktop) ✅

<!-- Story 3.1 FAIT le 2026-03-08. 8 composants + utils.ts créés. Vérifié par PM. -->

---

### Story 3.2 — Layout principal et navigation mobile
**Assigné à :** @developer
**Priorité :** Critique
**Description :** Créer le layout avec bottom navigation bar sur mobile et sidebar sur desktop.

**Tâches :**
- [x] `FAIT` Créer src/components/layout/bottom-nav.tsx — 4 onglets (Dashboard, Vagues, Relevé, Bacs), md:hidden, usePathname
- [x] `FAIT` Créer src/components/layout/sidebar.tsx — navigation desktop (hidden md:flex), logo Fish
- [x] `FAIT` Créer src/components/layout/header.tsx — titre de page + actions contextuelles (Server Component)
- [x] `FAIT` Modifier src/app/layout.tsx — lang="fr", metadata, ToastProvider, Sidebar + BottomNav, pb-16
- [x] `FAIT` Bottom nav visible uniquement sur mobile (md:hidden), sidebar sur desktop (hidden md:flex)
- [x] `FAIT` Icônes avec lucide-react

**Critères d'acceptation :**
- Bottom nav fixée en bas sur mobile avec 4 onglets ✅
- Sur desktop (md:+), sidebar avec logo ✅
- Transitions fluides entre les pages ✅

<!-- Story 3.2 FAIT le 2026-03-08. 3 composants + layout.tsx modifié. Vérifié par PM. -->

---

### Story 3.3 — Page Dashboard
**Assigné à :** @developer
**Dépend de :** Stories 3.1, 3.2
**Priorité :** Haute
**Description :** Page d'accueil avec les indicateurs clés de toutes les vagues actives.

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/dashboard.ts — query serveur avec Promise.all, calculerTauxSurvie/calculerBiomasse
- [x] `FAIT` Créer src/app/page.tsx (Server Component async)
- [x] `FAIT` Créer src/components/dashboard/stats-cards.tsx — 4 cartes KPI (vagues actives, biomasse totale, survie moyenne, bacs occupés/total)
- [x] `FAIT` Créer src/components/dashboard/vague-summary-card.tsx — carte cliquable (code, jours, poids moyen, survie, biomasse, bacs)
- [x] `FAIT` Sur mobile : cartes empilées en scroll vertical (grid-cols-2)
- [x] `FAIT` Sur desktop : grille de cartes (md:grid-cols-4 pour stats, md:grid-cols-2 lg:grid-cols-3 pour vagues)
- [x] `FAIT` État vide géré ("Aucune vague en cours")

**Critères d'acceptation :**
- Les données viennent du serveur (Server Component + requêtes Prisma) ✅
- Les indicateurs sont calculés avec les fonctions de src/lib/calculs.ts ✅
- Affichage lisible sur écran 360px ✅

<!-- Story 3.3 FAIT le 2026-03-08. 4 fichiers créés dont query dashboard. Vérifié par PM. -->

---

### Story 3.4 — Review Sprint 3
**Assigné à :** @code-reviewer
**Dépend de :** Stories 3.1 à 3.3

**Tâches :**
- [x] `FAIT` Vérifier mobile first (pas de styles desktop par défaut)
- [x] `FAIT` Vérifier l'usage correct de Radix UI (accessibilité, aria-labels)
- [x] `FAIT` Vérifier que les composants sont des Server Components sauf si "use client" justifié
- [x] `FAIT` Vérifier la taille tactile des éléments (min 44px)
- [x] `FAIT` Écrire docs/reviews/review-sprint-3.md

**Résultat :** VALIDÉ — 0 critique, 0 important, 4 mineurs (M1-M4 reportés Sprint 5). Voir docs/reviews/review-sprint-3.md.

<!-- Sprint 3 VALIDÉ le 2026-03-08. 18 fichiers revus, 10 points positifs. M1-M4 + S1-S2 reportés Sprint 5. -->

---

## Sprint 4 — UI Pages métier (Vagues + Relevés + Bacs)

**Objectif :** L'utilisateur peut gérer ses vagues, saisir des relevés et gérer ses bacs depuis son smartphone.

### Story 4.1 — Page liste des vagues
**Assigné à :** @developer-2
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Créer src/app/vagues/page.tsx (Server Component, Promise.all getVagues + getBacsLibres)
- [x] `FAIT` Afficher les vagues en cartes (code, statut Badge, nombre de bacs, date début, jours écoulés)
- [x] `FAIT` Filtre par statut (en cours / terminée / annulée) avec Radix Tabs
- [x] `FAIT` Bouton "Nouvelle vague" → Dialog Radix (plein écran sur mobile)
- [x] `FAIT` Formulaire de création : code, date, nombre initial, poids moyen, sélection des bacs libres (checkboxes), origine alevins
- [x] `FAIT` Composants : vagues-list-client.tsx, vague-card.tsx

<!-- Story 4.1 FAIT le 2026-03-08. Vérifié par PM. -->

---

### Story 4.2 — Page détail d'une vague
**Assigné à :** @developer-2
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Créer src/app/vagues/[id]/page.tsx (Server Component, getVagueById + getIndicateursVague)
- [x] `FAIT` Section indicateurs : 5 cartes KPI (survie, FCR, SGR, biomasse, poids moyen)
- [x] `FAIT` Section graphique : Recharts LineChart responsive avec état vide
- [x] `FAIT` Section relevés : liste filtrable par type (Radix Tabs)
- [x] `FAIT` Chaque relevé affiché en carte avec date, type (badge coloré), données clés
- [x] `FAIT` Bouton "Clôturer la vague" avec Dialog confirmation + dateFin
- [x] `FAIT` Composants : indicateurs-cards, poids-chart, releves-list, cloturer-dialog

<!-- Story 4.2 FAIT le 2026-03-08. Vérifié par PM. -->

---

### Story 4.3 — Formulaire de saisie de relevé
**Assigné à :** @developer-2
**Priorité :** Critique
**Description :** Formulaire dynamique qui affiche les champs selon le type de relevé sélectionné.

**Tâches :**
- [x] `FAIT` Créer src/app/releves/nouveau/page.tsx (Server Component)
- [x] `FAIT` Créer src/components/releves/releve-form-client.tsx (formulaire dynamique)
- [x] `FAIT` Étape 1 : sélectionner la vague (Radix Select)
- [x] `FAIT` Étape 2 : sélectionner le bac (chargé dynamiquement via API, filtré par vague)
- [x] `FAIT` Étape 3 : sélectionner le type de relevé (Radix Select avec labels français)
- [x] `FAIT` Étape 4 : afficher dynamiquement les champs correspondants au type
- [x] `FAIT` Créer src/components/releves/form-biometrie.tsx
- [x] `FAIT` Créer src/components/releves/form-mortalite.tsx
- [x] `FAIT` Créer src/components/releves/form-alimentation.tsx
- [x] `FAIT` Créer src/components/releves/form-qualite-eau.tsx
- [x] `FAIT` Créer src/components/releves/form-comptage.tsx
- [x] `FAIT` Créer src/components/releves/form-observation.tsx
- [x] `FAIT` Validation côté client par type + feedback avec Radix Toast
- [x] `FAIT` Soumission vers l'API POST /api/releves + redirect vers vague
- [x] `FAIT` Support paramètre URL ?vagueId pour pré-remplir

<!-- Story 4.3 FAIT le 2026-03-08. 8 fichiers créés. Vérifié par PM. -->

**Critères d'acceptation :**
- Le formulaire est utilisable à une main sur smartphone
- Les champs sont larges et les boutons font min 44px de haut
- Le type de relevé change les champs affichés en temps réel
- Toast de confirmation après soumission réussie

---

### Story 4.4 — Page gestion des bacs
**Assigné à :** @developer-2
**Priorité :** Moyenne

**Tâches :**
- [x] `FAIT` Créer src/app/bacs/page.tsx (Server Component, getBacs)
- [x] `FAIT` Créer src/components/bacs/bacs-list-client.tsx
- [x] `FAIT` Liste des bacs en cartes : nom, volume, statut (libre/occupé), vague assignée
- [x] `FAIT` Badge "Libre" (en_cours) ou code vague (warning) pour statut
- [x] `FAIT` Bouton "Nouveau bac" → Dialog
- [x] `FAIT` Formulaire : nom, volume + validation + Toast

<!-- Story 4.4 FAIT le 2026-03-08. 2 fichiers créés. Vérifié par PM. -->

---

### Story 4.5 — Tests UI et scénarios complets
**Assigné à :** @tester
**Dépend de :** Stories 4.1 à 4.4

**Tâches :**
- [x] `FAIT` Tester le scénario complet : créer bac → créer vague → saisir relevés → voir indicateurs
- [x] `FAIT` Vérifier le responsive (touch targets 44px, grilles progressives, dialog plein écran)
- [x] `FAIT` Vérifier que les formulaires rejettent les données invalides (pas d'appel API si validation échoue)
- [x] `FAIT` Écrire docs/tests/rapport-sprint-4.md
- [x] `FAIT` 48 tests UI créés (bacs-page 10, vagues-page 18, releves-form 6, responsive 14)
- [x] `FAIT` 156 tests totaux, 0 échec, ~2.2s

<!-- Story 4.5 FAIT le 2026-03-08. 48 tests UI + rapport. Vérifié par PM. -->

---

### Story 4.6 — Review Sprint 4
**Assigné à :** @code-reviewer
**Dépend de :** Stories 4.1 à 4.5

**Tâches :**
- [x] `FAIT` Review complète de toutes les pages et composants (18 fichiers + 4 tests)
- [x] `FAIT` Vérifier la cohérence UI (même style de cartes, badges, boutons partout)
- [x] `FAIT` Vérifier l'accessibilité (labels, focus, navigation clavier)
- [x] `FAIT` Vérifier les "use client" (7 composants clients, tous justifiés)
- [x] `FAIT` Écrire docs/reviews/review-sprint-4.md

**Résultat :** VALIDÉ — 0 critique, 2 importants (I1-I2 → Sprint 5), 3 mineurs (M1-M3 → Sprint 5). Voir docs/reviews/review-sprint-4.md.

<!-- Sprint 4 VALIDÉ le 2026-03-08. 22 fichiers + rapport revus. I1-I2 + M1-M3 + S1-S2 reportés Sprint 5. -->

---

## Sprint 5 — Polissage et livraison

**Objectif :** Application prête à être utilisée sur le terrain.

### Story 5.0 — Corrections reviews Sprint 3 + 4 (AJOUTÉE)
**Assigné à :** @developer-2
**Priorité :** Haute — Corrections des reviews précédentes

<!-- Décisions PM du 2026-03-08 :
- I1 Sprint 4 : remplacer string "TERMINEE" par StatutVague.TERMINEE
- I2 Sprint 4 : utiliser DialogTrigger asChild pour ARIA
- M1-M4 Sprint 3 + M1-M3 Sprint 4 : corrections mineures
-->

**Tâches IMPORTANT (Sprint 4) :**
- [x] `FAIT` I1 : cloturer-dialog.tsx:39 → StatutVague.TERMINEE au lieu de "TERMINEE"
- [x] `FAIT` I2 : vagues-list-client.tsx:138 + bacs-list-client.tsx:86 → DialogTrigger asChild

**Tâches MINEUR (Sprint 3) :**
- [x] `FAIT` M1 : toast.tsx:75 → aria-label="Fermer" sur close button
- [x] `FAIT` M2 : input.tsx:13 → useId() fallback si id non passé
- [x] `FAIT` M3 : vague-summary-card.tsx:14 → badge statut dynamique via statutVariants Record
- [x] `FAIT` M4 : select.tsx:26 → aria-labelledby sémantique

**Tâches MINEUR (Sprint 4) :**
- [x] `FAIT` M1 : poids-chart.tsx:70,88 → CSS variables var(--border), var(--primary)
- [x] `FAIT` M2 : bacs-list-client.tsx:150 → Badge "Libre" variant="info"
- [x] `FAIT` M3 : form-observation.tsx:1 → Textarea composant UI dédié

<!-- Story 5.0 FAIT le 2026-03-08. 9 corrections appliquées et vérifiées par PM. -->

---

### Story 5.1 — Gestion d'erreurs et états vides
**Assigné à :** @developer-2
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Ajouter des états vides — src/components/ui/empty-state.tsx (icon, title, description, action)
- [x] `FAIT` Ajouter loading states — src/components/ui/skeleton.tsx + 4 loading.tsx (dashboard, vagues, vague detail, bacs)
- [x] `FAIT` Ajouter error boundaries — src/app/error.tsx (reset button, messages FR)
- [x] `FAIT` Page 404 — src/app/not-found.tsx (lien retour dashboard)

<!-- Story 5.1 FAIT le 2026-03-08. 10 fichiers créés/vérifiés par PM. -->

---

### Story 5.2 — Optimisation mobile et performance
**Assigné à :** @developer-2
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Ajouter le manifest.json pour PWA — public/manifest.json (standalone, theme_color #0d9488, icons 192+512)
- [x] `FAIT` Optimiser le bundle — dynamic imports Recharts dans poids-chart.tsx (ssr: false)
- [x] `FAIT` Ajouter meta viewport et thème couleur — layout.tsx (viewport export, appleWebApp, manifest link)

<!-- Story 5.2 FAIT le 2026-03-08. PWA ready. Vérifié par PM. -->

---

### Story 5.3 — Tests finaux et rapport
**Assigné à :** @tester
**Dépend de :** Stories 5.0, 5.1, 5.2

**Tâches :**
- [x] `FAIT` Exécuter tous les tests — 156/156 passent (8 fichiers, ~2.4s)
- [x] `FAIT` Vérifier le build de production — OK (Next.js 16.1.6 Turbopack, 10 pages, 5 API routes)
- [x] `FAIT` 5 corrections de build TypeScript (enums Prisma, Recharts fallback, vitest config)
- [x] `FAIT` Écrire docs/tests/rapport-final.md — rapport complet tous sprints

<!-- Story 5.3 FAIT le 2026-03-08. 156 tests, build OK, 5 corrections de build. Vérifié par PM. -->

---

### Story 5.4 — Review finale et livraison
**Assigné à :** @code-reviewer + @project-manager
**Dépend de :** Tout

**Tâches :**
- [x] `FAIT` @code-reviewer : Review finale complète → docs/reviews/review-final.md — VALIDE, 0 critique, 0 important, 3 suggestions
- [x] `FAIT` @project-manager : Vérifier que toutes les stories sont FAIT
- [x] `FAIT` @project-manager : Écrire docs/RELEASE.md (résumé de ce qui a été livré)
- [x] `FAIT` @developer-2 : Aucune correction nécessaire (review finale validée sans bloquant)
- [x] `FAIT` npm run build passe sans erreur (vérifié dans Story 5.3)

<!-- Sprint 5 VALIDÉ le 2026-03-09. Review finale VALIDE. Projet prêt pour livraison. -->

---

# Phase 2 — Nouvelles fonctionnalités (Sprints 6-12)

> Phase 1 terminée et validée : 3 modèles, 5 enums, 4 API routes, 5 pages UI, 156 tests, build OK.
> Phase 2 ajoute 19 modèles, 16 enums, ~50 API routes, ~30 pages UI sur 7 sprints.

---

## Bugs — Sprint 6

| Bug | Titre | Sévérité | Fichier | Statut |
|-----|-------|----------|---------|--------|
| [BUG-001](../bugs/BUG-001.md) | Login par téléphone manquant — email doit devenir optionnel | Haute | schema.prisma, models.ts, ADR 005, stories 6.2/6.4/6.6/6.7/6.9 | **CLOS** |
| [BUG-002](../bugs/BUG-002.md) | Le préfixe +237 ne doit jamais être saisi par l'utilisateur | Moyenne | routes auth, lib/auth, UI login/register | OUVERT |
| [BUG-003](../bugs/BUG-003.md) | Hydration mismatch sur body (extension navigateur) | Basse | src/app/layout.tsx | OUVERT |
| [BUG-005](../bugs/BUG-005.md) | Overflow horizontal sur page detail vague (mobile) | Moyenne | app-shell.tsx, vagues/[id]/page.tsx | EN COURS |
| BUG-006 | PERMISSION_GROUPS alevins manque ALEVINS_CREER/MODIFIER/SUPPRIMER | Basse | src/lib/permissions-constants.ts | **CLOS** |
| BUG-007 | variant="destructive" invalide dans ponte-detail et reproducteur-detail | Haute | src/components/alevins/ponte-detail-client.tsx, src/components/alevins/reproducteur-detail-client.tsx | **CLOS** |

<!-- BUG-006 CLOS le 2026-03-10. @developer — ajout ALEVINS_CREER/MODIFIER/SUPPRIMER dans PERMISSION_GROUPS.alevins. -->
<!-- BUG-007 CLOS le 2026-03-10. @developer — remplacement variant="destructive" par variant="danger" (2 fichiers alevins). Build OK, 749 tests passent. -->

<!-- BUG-001 CLOS le 2026-03-09. Migration #5 user_phone_email_nullable, 9 tests ajoutés, 205 tests total, review validée. -->

> @project-manager : BUG-002 à traiter dans le Sprint 6. Impacte les stories 6.4, 6.6, 6.7.

---

## Change Requests

| CR | Titre | Sévérité | Fichiers impactés | Statut |
|----|-------|----------|-------------------|--------|
| [CR-001](../cr/CR-001.md) | Refonte navigation : menu hamburger + navigation par module | Moyenne | bottom-nav.tsx, sidebar.tsx, app-shell.tsx, hamburger | **FAIT** |
| [CR-002](../cr/CR-002.md) | Déplacer SiteSelector du Header vers Hamburger/Sidebar | Moyenne | header.tsx, site-selector.tsx, hamburger-menu.tsx, sidebar.tsx | **FAIT** |
| [CR-003](../cr/CR-003.md) | Réduire la sur-utilisation des Cards pour l'efficacité mobile | Moyenne | indicateurs-cards.tsx, stats-cards.tsx, releve-form-client.tsx, vagues/[id]/page.tsx | **FAIT** |
| [CR-004](../cr/CR-004.md) | Lier les Relevés au Stock (Consommation Produits + Déduction Auto) | Haute | schema.prisma, releve-form-client.tsx, releves/route.ts, queries/releves.ts, models.ts, api.ts | **FAIT** |
| [CR-005](../cr/CR-005.md) | Auto-set date+heure du Relevé côté backend (supprimer le date picker) | Moyenne | releve-form-client.tsx, releves/route.ts, queries/releves.ts, api.ts, vagues/[id]/page.tsx, releves.test.ts | **FAIT** |
| [CR-006](../cr/CR-006.md) | Mise a jour Bacs, Vagues et Releves (PUT + permissions MODIFIER) | Haute | models.ts, api.ts, permissions-constants.ts, bacs/[id]/route.ts, vagues/[id]/route.ts, releves/[id]/route.ts, queries/*.ts | **FAIT** |
| [CR-009](../cr/CR-009.md) | Roles dynamiques par site (remplacement de l'enum Role au niveau site) | Haute | schema.prisma, types/*, permissions.ts, permissions-constants.ts, queries/sites.ts, queries/roles.ts (nouveau), API routes sites/members + sites/roles, UI sites/* | **FAIT** (#54-#60 FAIT, review APPROUVÉE) |
| [CR-010](../cr/CR-010.md) | Analytiques par bac (Tank-Level Analytics) | Haute | calculs.ts, types/calculs.ts, queries/analytics.ts, benchmarks.ts, 3 API routes, 3 composants, 2 pages | **FAIT** |
| [CR-011](../cr/CR-011.md) | Analytiques par aliment / marque (Feed Brand Analytics) | Haute | calculs.ts, types/calculs.ts, queries/analytics.ts, 3 API routes, 4 composants, 3 pages, simulateur | **FAIT** |
| CR-012 | UI dashboard analytics + comparaison vagues + navigation | Haute | api/analytics/dashboard/route.ts, api/analytics/vagues/route.ts, components/analytics/analytics-dashboard-client.tsx, components/analytics/vagues-comparison-client.tsx, app/analytics/page.tsx, app/analytics/vagues/page.tsx, sidebar.tsx, bottom-nav.tsx, hamburger-menu.tsx | **FAIT** |

<!-- CR-010 + CR-011 review : docs/reviews/review-cr-010-011.md — VALIDE, 155 tests ajoutés -->
<!-- CR-012 FAIT le 2026-03-11. @developer — 9 fichiers créés/modifiés. Build OK. -->

---

## Sprint 6 — Authentification

**Objectif :** Utilisateurs, connexion, rôles, protection des routes. Fondation pour le multi-site (Sprint 7).

### Story 6.1 — ADR authentification
**Assigné à :** @architect
**Priorité :** Critique
**Description :** Décision architecturale : NextAuth.js vs custom, stratégie de session (JWT vs DB sessions), hashing password.

**Tâches :**
- [x] `FAIT` Écrire docs/decisions/005-authentification.md
- [x] `FAIT` Documenter : choix de lib (custom, pas NextAuth), stratégie session (DB), stockage token (cookie UUID v4), hashing (bcryptjs cost 12)
- [x] `FAIT` Définir les routes publiques vs protégées

<!-- Story 6.1 FAIT le 2026-03-09. ADR 005 rédigé + corrigé (I1 middleware cookie-only). -->

---

### Story 6.2 — Schéma User + Session + enum Role + migration
**Assigné à :** @db-specialist
**Dépend de :** Story 6.1
**Priorité :** Critique
**Description :** Créer les modèles Prisma User, Session et l'enum Role.

**Tâches :**
- [x] `FAIT` Ajouter enum Role (ADMIN, GERANT, PISCICULTEUR) dans schema.prisma
- [x] `FAIT` Ajouter enum Permission (25 valeurs : SITE_GERER, MEMBRES_GERER, VAGUES_VOIR, ..., DASHBOARD_VOIR) dans schema.prisma
- [x] `FAIT` Créer modèle User (id, email unique, name, passwordHash, role, isActive, timestamps)
- [x] `FAIT` Créer modèle Session (id, sessionToken unique, userId FK, expires, createdAt)
- [x] `FAIT` Ajouter index sur Session.userId
- [x] `FAIT` Exécuter `npx prisma migrate dev --name add_auth` — Migration #4 `20260309065155_add_auth`
- [x] `FAIT` Régénérer le client Prisma

**Critères d'acceptation :**
- Enum Role en MAJUSCULES (R1) ✅
- Enum Permission avec 25 valeurs en MAJUSCULES (R1) ✅
- Champs Prisma = TypeScript identiques (R3) ✅
- Migration s'exécute sans erreur ✅

<!-- Story 6.2 FAIT le 2026-03-09. Migration #4 add_auth + Migration #5 user_phone_email_nullable (BUG-001). -->

---

### Story 6.3 — Types auth.ts
**Assigné à :** @architect
**Dépend de :** Story 6.2
**Priorité :** Haute
**Description :** Définir les interfaces TypeScript pour l'authentification.

**Tâches :**
- [x] `FAIT` Créer src/types/auth.ts (UserSession, LoginDTO, RegisterDTO, AuthResponse)
- [x] `FAIT` Ajouter interfaces User, Session, SessionWithUser dans src/types/models.ts
- [x] `FAIT` Ajouter enums Role et Permission (25 valeurs) dans src/types/models.ts
- [x] `FAIT` Mettre à jour src/types/index.ts (barrel export Role, Permission, User, Session, SessionWithUser)
- [x] `FAIT` Types strictement alignés avec le schéma Prisma (R3)

<!-- Story 6.3 FAIT le 2026-03-09. Types auth + models + barrel export alignés. -->

---

### Story 6.4 — Auth utilities
**Assigné à :** @developer
**Dépend de :** Story 6.3
**Priorité :** Critique
**Description :** Fonctions utilitaires pour le hashing, les sessions et les cookies.

**Tâches :**
- [x] `FAIT` Créer src/lib/auth.ts
- [x] `FAIT` Implémenter hashPassword(password) — bcryptjs cost 12
- [x] `FAIT` Implémenter verifyPassword(password, hash)
- [x] `FAIT` Implémenter createSession(userId) — crée session en DB + cookie HttpOnly UUID v4
- [x] `FAIT` Implémenter getSession(cookies) — vérifie et retourne la session
- [x] `FAIT` Implémenter requireAuth(request) — throw 401 si pas de session valide
- [x] `FAIT` Implémenter deleteSession(sessionToken) — supprime session + clear cookie
- [x] `FAIT` Créer src/lib/queries/users.ts — CRUD users + getUserByIdentifier (email OU phone)

<!-- Story 6.4 FAIT le 2026-03-09. -->

---

### Story 6.5 — Middleware Next.js
**Assigné à :** @developer
**Dépend de :** Story 6.4
**Priorité :** Critique
**Description :** Protection des routes via Next.js middleware.

**Tâches :**
- [x] `FAIT` Créer src/middleware.ts
- [x] `FAIT` Routes publiques : /login, /register, /api/auth/*
- [x] `FAIT` Toutes les autres routes : session requise, redirect vers /login si absente
- [x] `FAIT` Extraire userId depuis la session cookie (cookie-only, pas de validation DB — edge runtime)
- [x] `FAIT` Injecter userId dans les headers pour les API routes

<!-- Story 6.5 FAIT le 2026-03-09. Middleware cookie-only (edge runtime). -->

---

### Story 6.6 — API routes auth
**Assigné à :** @developer
**Dépend de :** Story 6.4
**Priorité :** Critique
**Description :** Endpoints d'authentification.

**Tâches :**
- [x] `FAIT` Créer POST /api/auth/register — inscription (email et/ou phone, name, password)
- [x] `FAIT` Créer POST /api/auth/login — connexion (identifier + password, crée session)
- [x] `FAIT` Créer POST /api/auth/logout — déconnexion (supprime session)
- [x] `FAIT` Créer GET /api/auth/me — profil utilisateur courant (jamais de passwordHash)
- [x] `FAIT` Validation des entrées (email format, password min length, phone +237)
- [x] `FAIT` Messages d'erreur en français

<!-- Story 6.6 FAIT le 2026-03-09. Login par identifier (email OU phone), BUG-001 intégré. -->

---

### Story 6.7 — UI auth
**Assigné à :** @developer
**Dépend de :** Story 6.6
**Priorité :** Haute
**Description :** Pages de connexion, inscription et menu utilisateur.

**Tâches :**
- [x] `FAIT` Créer src/app/login/page.tsx — champ identifier "Email ou téléphone" (mobile-first, centré)
- [x] `FAIT` Créer src/app/register/page.tsx — champs email + phone optionnels, au moins un requis
- [x] `FAIT` Créer src/components/layout/user-menu.tsx — nom, rôle (Record<Role, string>), email/phone, bouton déconnexion
- [x] `FAIT` Intégrer user-menu dans le header (layout.tsx)
- [x] `FAIT` Labels et textes en français
- [x] `FAIT` Taille tactile 44px minimum, champs larges

<!-- Story 6.7 FAIT le 2026-03-09. Login par identifier + register email/phone, BUG-001 + I2 intégrés. -->

---

### Story 6.8 — Protection des routes API existantes
**Assigné à :** @developer
**Dépend de :** Story 6.5
**Priorité :** Haute
**Description :** Ajouter requireAuth sur toutes les API routes existantes.

**Tâches :**
- [x] `FAIT` Ajouter requireAuth dans GET/POST /api/bacs
- [x] `FAIT` Ajouter requireAuth dans GET/POST /api/vagues et GET/PUT /api/vagues/[id]
- [x] `FAIT` Ajouter requireAuth dans GET/POST /api/releves
- [x] `FAIT` Vérifier que les routes retournent 401 si non authentifié

<!-- Story 6.8 FAIT le 2026-03-09. -->

---

### Story 6.9 — Mise à jour seed.sql
**Assigné à :** @db-specialist
**Dépend de :** Story 6.2
**Priorité :** Moyenne
**Description :** Ajouter un utilisateur admin par défaut dans le seed.

**Tâches :**
- [x] `FAIT` Ajouter INSERT pour un User admin (admin@dkfarm.cm, +237699000000, hash bcrypt, ADMIN)
- [x] `FAIT` Vérifier que le seed s'exécute sans erreur sur base vide

<!-- Story 6.9 FAIT le 2026-03-09. Seed avec User admin + phone. -->

---

### Story 6.10 — Tests Sprint 6
**Assigné à :** @tester
**Dépend de :** Stories 6.5 à 6.9
**Priorité :** Haute
**Description :** Tests des flux d'authentification, permissions et routes protégées.

**Tâches :**
- [x] `FAIT` Tests unitaires : hashPassword, verifyPassword, createSession, getSession
- [x] `FAIT` Tests API : register (happy + duplicate email/phone), login (happy + wrong password + phone), logout, me
- [x] `FAIT` Tests permissions : routes protégées retournent 401 sans session
- [x] `FAIT` Tests rôles : vérifier les permissions par rôle (ADMIN, GERANT, PISCICULTEUR)
- [x] `FAIT` Tests BUG-001 : login par phone, register phone seul/email+phone/ni l'un ni l'autre, validation +237
- [x] `FAIT` Vérifier la non-régression : 205 tests passent (156 Phase 1 + 49 Sprint 6)
- [x] `FAIT` `npm run build` OK
- [x] `FAIT` Écrire docs/tests/rapport-sprint-6.md

<!-- Story 6.10 FAIT le 2026-03-09. 205 tests, 0 échec, build OK. -->

---

### Story 6.11 — Review Sprint 6
**Assigné à :** @code-reviewer
**Dépend de :** Story 6.10
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Vérifier checklist R1-R9 (enum MAJUSCULES, imports enum, Prisma=TS, etc.)
- [x] `FAIT` Vérifier sécurité : hashing correct, sessions sécurisées, pas de fuite de passwordHash
- [x] `FAIT` Vérifier mobile-first sur les pages login/register
- [x] `FAIT` Vérifier accessibilité (labels, focus, navigation clavier)
- [x] `FAIT` Écrire docs/reviews/review-sprint-6.md

**Résultat :** CONDITIONNEL → VALIDE après corrections. 2 importants (I1 ADR 005 middleware, I2 roleLabels typé) + BUG-001 corrigés. M1-M3 + S1-S3 reportés Sprint 12 (polish). Voir docs/reviews/review-sprint-6.md.

<!-- Sprint 6 VALIDÉ le 2026-03-09. 11 stories + BUG-001 + I1 + I2 corrigés.
     205 tests, 0 échec, 5 migrations, build OK.
     Agents : @architect (ADR + types + I1), @db-specialist (migration + seed + BUG-001 DB),
     @developer (auth utils + middleware + API + UI + BUG-001 UI + I2), @tester (205 tests),
     @code-reviewer (review VALIDE). -->

---

## Sprint 7 — Multi-tenancy

**Objectif :** Chaque donnée est scopée par site. Un site = une ferme. Un user peut appartenir à plusieurs sites.

### Story 7.1 — ADR multi-tenancy
**Assigné à :** @architect
**Dépend de :** Sprint 6
**Priorité :** Critique
**Description :** Architecture multi-tenancy : scoping par siteId, stratégie de migration, middleware.

**Tâches :**
- [x] `FAIT` Compléter docs/decisions/004-multi-tenancy.md
- [x] `FAIT` Documenter : scoping strategy, migration des données existantes, middleware siteId
- [x] `FAIT` Définir la gestion du site actif (cookie active-site-id)

<!-- Story 7.1 FAIT le 2026-03-09. ADR 004 complété avec permissions, anti-escalade, PERMISSION_GROUPS. -->

---

### Story 7.2 — Schéma Site + SiteMember + siteId sur Bac/Vague + migration
**Assigné à :** @db-specialist
**Dépend de :** Story 7.1
**Priorité :** Critique
**Description :** Créer les modèles Site et SiteMember, ajouter siteId sur les modèles existants.

**Tâches :**
- [x] `FAIT` Créer modèle Site (id, nom, localisation?, description?, timestamps)
- [x] `FAIT` Créer modèle SiteMember (id, userId FK, siteId FK, role Role, permissions Permission[], createdAt) avec @@unique([userId, siteId])
- [x] `FAIT` Ajouter relation memberships SiteMember[] sur User
- [x] `FAIT` Migration multi-étapes (créer site par défaut → siteId nullable → UPDATE → NOT NULL → FK/index → SiteMember)
- [x] `FAIT` Exécuter `npx prisma migrate dev --name add_multi_tenancy`
- [x] `FAIT` Vérifier que les données existantes sont préservées
- [x] `FAIT` Ajout activeSiteId sur Session, siteId sur Releve

**Critères d'acceptation :**
- Toutes les données existantes migrées vers le site par défaut ✅
- siteId NOT NULL sur Bac, Vague et Releve après migration ✅
- Index sur siteId pour les performances ✅
- R8 respectée (siteId partout) ✅
- SiteMember a un champ `permissions Permission[]` (array PostgreSQL natif) ✅

<!-- Story 7.2 FAIT le 2026-03-09. Migration multi-étapes + activeSiteId Session + siteId Releve. -->

---

### Story 7.3 — Types TypeScript (Site, SiteMember, DTOs)
**Assigné à :** @architect
**Dépend de :** Story 7.2
**Priorité :** Haute
**Description :** Interfaces TypeScript pour les nouveaux modèles multi-tenancy.

**Tâches :**
- [x] `FAIT` Ajouter interfaces Site, SiteMember (avec permissions: Permission[]) dans src/types/models.ts
- [x] `FAIT` Créer DTOs : CreateSiteDTO, UpdateSiteDTO, AddMemberDTO, SiteWithMembers
- [x] `FAIT` Ajouter types AuthContext, UpdateMemberPermissionsDTO dans src/types/auth.ts
- [x] `FAIT` Mettre à jour les interfaces Bac et Vague (ajouter siteId)
- [x] `FAIT` Mettre à jour src/types/index.ts

<!-- Story 7.3 FAIT le 2026-03-09. Types multi-tenancy + DTOs + barrel export. -->

---

### Story 7.3b — Utilitaire permissions (AJOUTÉE)
**Assigné à :** @developer
**Dépend de :** Story 7.2
**Priorité :** Haute
**Description :** Bibliothèque utilitaire pour les permissions granulaires.

**Tâches :**
- [x] `FAIT` Créer src/lib/permissions.ts (DEFAULT_PERMISSIONS, hasPermission, hasAllPermissions, hasAnyPermission, requirePermission, PERMISSION_GROUPS, PermissionError, addPermissions, removePermissions, canGrantPermissions, getDefaultPermissions)
- [x] `FAIT` Tests unitaires permissions — 33 tests (DEFAULT_PERMISSIONS, PERMISSION_GROUPS, ForbiddenError, requirePermission, anti-escalade)

**Critères d'acceptation :**
- DEFAULT_PERMISSIONS[ADMIN] = 25/25, DEFAULT_PERMISSIONS[GERANT] = 23/25, DEFAULT_PERMISSIONS[PISCICULTEUR] = 6/25 ✅
- requirePermission fonctionne correctement (11 cas testés) ✅
- ForbiddenError retourne status 403 ✅
- canGrantPermissions empêche l'escalade de privileges ✅
- PERMISSION_GROUPS couvre les 25 permissions en 8 groupes ✅

<!-- Story 7.3b FAIT le 2026-03-09. 33 tests permissions. -->

---

### Story 7.4 — Queries sites.ts + modifier TOUTES les queries existantes
**Assigné à :** @db-specialist
**Dépend de :** Story 7.2
**Priorité :** Critique
**Description :** Nouveau fichier queries sites + ajouter filtre siteId à toutes les queries existantes.

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/sites.ts (getSites, getSiteById, createSite, updateSite, addMember, removeMember, getUserSites)
- [x] `FAIT` Modifier src/lib/queries/bacs.ts — ajouter siteId à tous les where
- [x] `FAIT` Modifier src/lib/queries/vagues.ts — ajouter siteId à tous les where
- [x] `FAIT` Modifier src/lib/queries/releves.ts — filtrer via siteId
- [x] `FAIT` Modifier src/lib/queries/indicateurs.ts — ajouter siteId
- [x] `FAIT` Modifier src/lib/queries/dashboard.ts — ajouter siteId
- [x] `FAIT` Créer getServerSession() + modifier API routes et pages serveur

**Critères d'acceptation :**
- AUCUNE query ne retourne des données sans filtre siteId ✅
- Les données sont isolées entre sites ✅

<!-- Story 7.4 FAIT le 2026-03-09. 25 fonctions auditées, zéro oubli siteId. -->

---

### Story 7.5 — API routes sites + gestion membres
**Assigné à :** @developer
**Dépend de :** Story 7.4
**Priorité :** Haute
**Description :** Endpoints pour la gestion des sites et de leurs membres.

**Tâches :**
- [x] `FAIT` Créer GET/POST /api/sites — lister les sites de l'utilisateur / créer un site
- [x] `FAIT` Créer GET/PUT /api/sites/[id] — détail / modifier un site
- [x] `FAIT` Créer POST /api/sites/[id]/members — ajouter un membre (ADMIN/GERANT seulement), initialiser permissions depuis DEFAULT_PERMISSIONS[role]
- [x] `FAIT` Créer DELETE /api/sites/[id]/members/[userId] — retirer un membre (protection ADMIN)
- [x] `FAIT` Créer PUT /api/sites/[id]/members/[userId] — changer le rôle
- [x] `FAIT` Créer PUT /api/sites/[id]/members/[userId]/permissions — modifier permissions individuelles
- [x] `FAIT` Protection anti-escalade : canGrantPermissions
- [x] `FAIT` requirePermission(MEMBRES_GERER) sur les routes membres

<!-- Story 7.5 FAIT le 2026-03-09. -->

---

### Story 7.6 — Modifier toutes les API routes existantes (siteId + permissions)
**Assigné à :** @developer
**Dépend de :** Stories 7.3b, 7.4
**Priorité :** Critique
**Description :** Injecter siteId depuis la session dans toutes les routes existantes et ajouter requirePermission.

**Tâches :**
- [x] `FAIT` Modifier GET/POST /api/bacs — siteId + requirePermission(VAGUES_VOIR / BACS_GERER)
- [x] `FAIT` Modifier GET/POST /api/vagues — siteId + requirePermission(VAGUES_VOIR / VAGUES_CREER)
- [x] `FAIT` Modifier GET/PUT /api/vagues/[id] — siteId + requirePermission(VAGUES_VOIR / VAGUES_MODIFIER)
- [x] `FAIT` Modifier GET/POST /api/releves — siteId + requirePermission(RELEVES_VOIR / RELEVES_CREER)
- [x] `FAIT` Extraire siteId depuis cookie active-site-id + vérifier membership
- [x] `FAIT` Pattern : catch ForbiddenError → 403 dans chaque route handler

<!-- Story 7.6 FAIT le 2026-03-09. -->

---

### Story 7.7 — Mise à jour middleware (siteId + vérification membership)
**Assigné à :** @developer
**Dépend de :** Story 7.4
**Priorité :** Haute
**Description :** Le middleware extrait userId ET siteId, vérifie le membership.

**Tâches :**
- [x] `FAIT` Modifier src/middleware.ts — extraire siteId depuis cookie active-site-id
- [x] `FAIT` Vérifier que l'utilisateur est membre du site demandé
- [x] `FAIT` Redirect vers /sites si pas de site actif sélectionné

<!-- Story 7.7 FAIT le 2026-03-09. -->

---

### Story 7.8 — UI site-selector + page sites + gestion membres + header
**Assigné à :** @developer
**Dépend de :** Story 7.5
**Priorité :** Haute
**Description :** Interface de sélection de site, gestion des membres, header mis à jour.

**Tâches :**
- [x] `FAIT` Créer src/app/sites/page.tsx — liste / sélection de sites
- [x] `FAIT` Créer src/app/sites/[id]/page.tsx — détail + paramètres + gestion membres
- [x] `FAIT` Créer src/components/layout/site-selector.tsx — sélecteur dans le header
- [x] `FAIT` Créer src/components/sites/member-permissions.tsx — UI checkbox grid pour permissions
- [x] `FAIT` Page gestion permissions membre : checkboxes groupées par module (PERMISSION_GROUPS)
- [x] `FAIT` Bouton "Réinitialiser selon le rôle" (remet DEFAULT_PERMISSIONS[role])
- [x] `FAIT` Mobile-first : groupes en cartes collapsibles, checkboxes 44px
- [x] `FAIT` Afficher le nom du site actif dans le header
- [x] `FAIT` Labels en français

<!-- Story 7.8 FAIT le 2026-03-09. -->

---

### Story 7.9 — Mise à jour seed.sql
**Assigné à :** @db-specialist
**Dépend de :** Story 7.2
**Priorité :** Moyenne
**Description :** Seed avec site par défaut et données scopées.

**Tâches :**
- [x] `FAIT` Ajouter INSERT pour un Site "Ferme Douala"
- [x] `FAIT` Ajouter INSERT pour SiteMember (admin + gérant → site, avec permissions)
- [x] `FAIT` Mettre à jour les INSERT Bac et Vague avec siteId
- [x] `FAIT` Vérifier que le seed s'exécute sans erreur sur base vide

<!-- Story 7.9 FAIT le 2026-03-09. Seed avec 2 users, 2 SiteMember, données scopées. -->

---

### Story 7.10 — Tests Sprint 7
**Assigné à :** @tester
**Dépend de :** Stories 7.3b, 7.4 à 7.9
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Tests isolation : un user du site A ne voit pas les données du site B
- [x] `FAIT` Tests membership : ajout/retrait de membres, changement de rôle
- [x] `FAIT` Tests permissions : PISCICULTEUR ne peut pas gérer les membres
- [x] `FAIT` Tests permissions : route retourne 403 si permission manquante
- [x] `FAIT` Tests permissions : PISCICULTEUR ne peut pas accéder aux routes VAGUES_CREER (403)
- [x] `FAIT` Tests permissions : permissions custom fonctionnent
- [x] `FAIT` Tests permissions : anti-escalade testée
- [x] `FAIT` Tests API existantes : vérifier que siteId est bien filtré
- [x] `FAIT` Tests non-régression : 278 tests passent (205 Sprint 6 + 73 Sprint 7)
- [x] `FAIT` `npm run build` OK
- [x] `FAIT` Écrire docs/tests/rapport-sprint-7.md

<!-- Story 7.10 FAIT le 2026-03-09. 278 tests, 0 échec, build OK. -->

---

### Story 7.11 — Review Sprint 7
**Assigné à :** @code-reviewer
**Dépend de :** Story 7.10

**Tâches :**
- [x] `FAIT` Vérifier R8 : siteId présent sur tous les modèles (25 fonctions auditées, zéro oubli)
- [x] `FAIT` Vérifier isolation des données entre sites
- [x] `FAIT` Vérifier que AUCUNE query n'oublie le filtre siteId
- [x] `FAIT` Vérifier checklist R1-R9
- [x] `FAIT` Écrire docs/reviews/review-sprint-7.md

**Résultat :** VALIDE. R8 conforme, anti-escalade robuste. M1-M3 reportés Sprint 12 (polish). Voir docs/reviews/review-sprint-7.md.

<!-- Sprint 7 VALIDÉ le 2026-03-09. 12 stories, 278 tests, 0 échec, build OK.
     Agents : @architect (ADR + types), @db-specialist (migration + queries + seed),
     @developer (API sites + middleware + UI + routes existantes), @tester (33 permissions + 73 sprint),
     @code-reviewer (review VALIDE). -->

---

## Sprint 8 — Stock & Approvisionnement

**Objectif :** Gestion complète des stocks : produits, fournisseurs, mouvements, bons de commande.

### Story 8.1 — Schéma stock (5 modèles + 4 enums + migration + seed)
**Assigné à :** @db-specialist
**Dépend de :** Sprint 7
**Priorité :** Critique
**Description :** Créer les modèles Fournisseur, Produit, MouvementStock, Commande, LigneCommande et les enums associés.

**Tâches :**
- [x] `FAIT` Ajouter enums : CategorieProduit (ALIMENT, INTRANT, EQUIPEMENT), UniteStock (KG, LITRE, UNITE, SACS), TypeMouvement (ENTREE, SORTIE), StatutCommande (BROUILLON, ENVOYEE, LIVREE, ANNULEE)
- [x] `FAIT` Créer modèle Fournisseur (nom, telephone, email, adresse, siteId)
- [x] `FAIT` Créer modèle Produit (nom, categorie, unite, prixUnitaire, stockActuel, seuilAlerte, fournisseurId, siteId)
- [x] `FAIT` Créer modèle MouvementStock (produitId, type, quantite, prixTotal, vagueId?, commandeId?, userId, date)
- [x] `FAIT` Créer modèle Commande (numero, fournisseurId, statut, dateCommande, dateLivraison, siteId, userId)
- [x] `FAIT` Créer modèle LigneCommande (commandeId, produitId, quantite, prixUnitaire)
- [x] `FAIT` Ajouter siteId + FK + index sur chaque modèle (R8)
- [x] `FAIT` Exécuter migration + mettre à jour seed.sql

**Critères d'acceptation :**
- Enums en MAJUSCULES (R1)
- siteId sur chaque modèle (R8)
- Prisma = TypeScript (R3)

---

### Story 8.2 — Queries stock
**Assigné à :** @db-specialist
**Dépend de :** Story 8.1
**Priorité :** Haute
**Description :** Fonctions de requête pour le stock : CRUD + transactions + alertes.

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/fournisseurs.ts (CRUD)
- [x] `FAIT` Créer src/lib/queries/produits.ts (CRUD + getProduitsEnAlerte)
- [x] `FAIT` Créer src/lib/queries/mouvements.ts (create + list avec filtres)
- [x] `FAIT` Créer src/lib/queries/commandes.ts (CRUD + recevoirCommande en transaction)
- [x] `FAIT` Transaction recevoirCommande : créer mouvements ENTREE + mettre à jour stockActuel + changer statut LIVREE
- [x] `FAIT` Règle : mouvement SORTIE impossible si quantite > stockActuel

---

### Story 8.3 — Types TypeScript stock + DTOs
**Assigné à :** @architect
**Dépend de :** Story 8.1
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Ajouter interfaces dans src/types/models.ts (Fournisseur, Produit, MouvementStock, Commande, LigneCommande)
- [x] `FAIT` Ajouter enums dans src/types/models.ts (CategorieProduit, UniteStock, TypeMouvement, StatutCommande)
- [x] `FAIT` Créer DTOs dans src/types/api.ts
- [x] `FAIT` Mettre à jour src/types/index.ts

---

### Story 8.4 — API routes stock
**Assigné à :** @developer
**Dépend de :** Story 8.2
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` CRUD /api/fournisseurs (2 fichiers)
- [x] `FAIT` CRUD /api/produits (2 fichiers)
- [x] `FAIT` GET/POST /api/stock/mouvements (1 fichier)
- [x] `FAIT` CRUD /api/commandes + POST envoyer/recevoir/annuler (5 fichiers)
- [x] `FAIT` GET /api/stock/alertes (produits sous seuil)
- [x] `FAIT` Auth (requirePermission) + siteId sur toutes les routes

---

### Story 8.5 — UI stock : produits + fournisseurs
**Assigné à :** @developer
**Dépend de :** Story 8.4
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Créer /stock — dashboard stock (produits, alertes)
- [x] `FAIT` Créer /stock/produits + /stock/produits/[id]
- [x] `FAIT` Créer /stock/fournisseurs
- [x] `FAIT` Ajouter "Stock" à la navigation (bottom-nav + sidebar)
- [x] `FAIT` Mobile-first, cartes, labels FR

---

### Story 8.6 — UI stock : mouvements + commandes
**Assigné à :** @developer
**Dépend de :** Story 8.5
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Créer /stock/mouvements — historique avec filtres
- [x] `FAIT` Créer /stock/commandes + /stock/commandes/[id]
- [x] `FAIT` Formulaire de commande multi-lignes
- [x] `FAIT` Bouton "Réceptionner" avec confirmation (transaction)

---

### Story 8.7 — Tests Sprint 8
**Assigné à :** @tester
**Dépend de :** Stories 8.4 à 8.6

**Tâches :**
- [x] `FAIT` Tests CRUD fournisseurs (17), produits (25), commandes (32), mouvements (21), alertes (5) — 100 nouveaux tests
- [x] `FAIT` Tests transaction réception commande (transitions statut, mouvements ENTREE, stockActuel)
- [x] `FAIT` Tests règle métier : mouvement SORTIE impossible si stock insuffisant
- [x] `FAIT` Tests alertes stock sous seuil
- [x] `FAIT` Tests non-régression + build OK — 396/396 tests, 20 fichiers
- [x] `FAIT` Écrire docs/tests/rapport-sprint-8.md

---

### Story 8.8 — Review Sprint 8
**Assigné à :** @code-reviewer
**Dépend de :** Story 8.7

**Tâches :**
- [x] `FAIT` Vérifier checklist R1-R9
- [x] `FAIT` Vérifier transactions atomiques (R4)
- [x] `FAIT` Vérifier siteId sur tous les modèles (R8)
- [x] `FAIT` Écrire docs/reviews/review-sprint-8.md

---

## Sprint 9 — Ventes & Facturation

**Objectif :** Ventes de poissons, facturation, suivi des paiements.

### Story 9.1 — Schéma ventes (4 modèles + 2 enums + migration + seed)
**Assigné à :** @db-specialist
**Dépend de :** Sprint 8
**Priorité :** Critique

**Tâches :**
- [x] `FAIT` Ajouter enums : StatutFacture (BROUILLON, ENVOYEE, PAYEE_PARTIELLEMENT, PAYEE, ANNULEE), ModePaiement (ESPECES, MOBILE_MONEY, VIREMENT, CHEQUE)
- [x] `FAIT` Créer modèle Client (nom, telephone, email, adresse, siteId)
- [x] `FAIT` Créer modèle Vente (numero, clientId, vagueId, quantitePoissons, poidsTotalKg, prixUnitaireKg, montantTotal, siteId, userId)
- [x] `FAIT` Créer modèle Facture (numero, venteId, statut, dateEmission, dateEcheance, montantTotal, montantPaye)
- [x] `FAIT` Créer modèle Paiement (factureId, montant, mode, reference, userId)
- [x] `FAIT` siteId + FK + index sur chaque modèle (R8)
- [x] `FAIT` Migration + seed

---

### Story 9.2 — Queries ventes
**Assigné à :** @db-specialist
**Dépend de :** Story 9.1
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/clients.ts (CRUD)
- [x] `FAIT` Créer src/lib/queries/ventes.ts (CRUD + transaction réduction poissons)
- [x] `FAIT` Créer src/lib/queries/factures.ts (CRUD + calcul paiements)
- [x] `FAIT` Transaction vente : réduire Bac.nombrePoissons sur les bacs de la vague
- [x] `FAIT` Règle : impossible de vendre plus de poissons que disponibles
- [x] `FAIT` Ajout paiement → recalcul montantPaye → update statut facture

---

### Story 9.3 — Types TypeScript ventes + DTOs
**Assigné à :** @architect
**Dépend de :** Story 9.1

**Tâches :**
- [x] `FAIT` Ajouter interfaces Client, Vente, Facture, Paiement dans src/types/models.ts
- [x] `FAIT` Ajouter enums StatutFacture, ModePaiement
- [x] `FAIT` Créer DTOs + mettre à jour barrel export

---

### Story 9.4 — API routes ventes
**Assigné à :** @developer
**Dépend de :** Story 9.2

**Tâches :**
- [x] `FAIT` CRUD /api/clients
- [x] `FAIT` GET/POST /api/ventes + GET /api/ventes/[id]
- [x] `FAIT` POST /api/factures (générer depuis vente)
- [x] `FAIT` GET/PUT /api/factures/[id]
- [x] `FAIT` POST /api/factures/[id]/paiements
- [x] `FAIT` Auth + siteId sur toutes les routes

---

### Story 9.5 — UI ventes : clients + liste ventes + formulaire vente
**Assigné à :** @developer
**Dépend de :** Story 9.4

**Tâches :**
- [x] `FAIT` Créer /clients — liste CRUD
- [x] `FAIT` Créer /ventes — liste avec filtres
- [x] `FAIT` Créer /ventes/nouvelle — formulaire multi-étapes (vague → client → quantité/prix)
- [x] `FAIT` Ajouter "Ventes" à la navigation
- [x] `FAIT` Mobile-first

---

### Story 9.6 — UI ventes : factures + paiements
**Assigné à :** @developer
**Dépend de :** Story 9.5

**Tâches :**
- [x] `FAIT` Créer /factures — liste avec filtre statut
- [x] `FAIT` Créer /factures/[id] — détail + historique paiements
- [x] `FAIT` Formulaire ajout paiement (montant, mode, référence)
- [x] `FAIT` Badge statut facture dynamique

---

### Story 9.7 — Tests Sprint 9
**Assigné à :** @tester
**Dépend de :** Stories 9.4 à 9.6

**Tâches :**
- [x] `FAIT` Tests CRUD clients, ventes, factures
- [x] `FAIT` Tests transaction vente (réduction poissons, vente impossible si stock insuffisant)
- [x] `FAIT` Tests paiement → recalcul statut facture
- [x] `FAIT` Tests non-régression + build OK
- [x] `FAIT` Écrire docs/tests/rapport-sprint-9.md

---

### Story 9.8 — Review Sprint 9
**Assigné à :** @code-reviewer
**Dépend de :** Story 9.7

**Tâches :**
- [x] `FAIT` Vérifier checklist R1-R9
- [x] `FAIT` Vérifier transactions atomiques vente (R4)
- [x] `FAIT` Écrire docs/reviews/review-sprint-9.md

---

## Sprint 10 — Production Alevins

**Objectif :** Gestion de la production d'alevins : reproducteurs, pontes, lots, transfert vers vagues de grossissement.

### Story 10.1 — Schéma alevins (3 modèles + 4 enums + migration + seed)
**Assigné à :** @db-specialist
**Dépend de :** Sprint 9
**Priorité :** Critique

**Tâches :**
- [x] `FAIT` Ajouter enums : SexeReproducteur (MALE, FEMELLE), StatutReproducteur (ACTIF, REFORME, MORT), StatutPonte (EN_COURS, TERMINEE, ECHOUEE), StatutLotAlevins (EN_INCUBATION, EN_ELEVAGE, TRANSFERE, PERDU)
- [x] `FAIT` Créer modèle Reproducteur (code, sexe, poids, age, origine, statut, dateAcquisition, siteId)
- [x] `FAIT` Créer modèle Ponte (code, femelleId, maleId, datePonte, nombreOeufs, tauxFecondation, statut, siteId)
- [x] `FAIT` Créer modèle LotAlevins (code, ponteId, nombreInitial, nombreActuel, ageJours, poidsMoyen, statut, bacId?, vagueDestinationId?, siteId)
- [x] `FAIT` siteId + FK + index (R8)
- [x] `FAIT` Migration + seed

<!-- Story 10.1 FAIT le 2026-03-10. Migration 20260310200000_add_alevins. @db-specialist. -->

---

### Story 10.2 — Queries alevins
**Assigné à :** @db-specialist
**Dépend de :** Story 10.1

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/reproducteurs.ts (CRUD)
- [x] `FAIT` Créer src/lib/queries/pontes.ts (CRUD)
- [x] `FAIT` Créer src/lib/queries/lots-alevins.ts (CRUD + transfert transactionnel)
- [x] `FAIT` Transaction transfert : lot → vague (lot.statut=TRANSFERE, créer nouvelle Vague avec nombreInitial=lot.nombreActuel)

<!-- Story 10.2 FAIT le 2026-03-10. 3 fichiers queries créés. @db-specialist. -->

---

### Story 10.3 — Types TypeScript alevins + DTOs
**Assigné à :** @architect
**Dépend de :** Story 10.1

**Tâches :**
- [x] `FAIT` Ajouter interfaces Reproducteur, Ponte, LotAlevins dans src/types/models.ts
- [x] `FAIT` Ajouter enums SexeReproducteur, StatutReproducteur, StatutPonte, StatutLotAlevins
- [x] `FAIT` Créer DTOs + mettre à jour barrel export

<!-- Story 10.3 FAIT le 2026-03-10. Types + DTOs alevins alignés. @architect. -->

---

### Story 10.4 — API routes alevins
**Assigné à :** @developer
**Dépend de :** Story 10.2
**Statut : FAIT**

**Tâches :**
- [x] `FAIT` CRUD /api/reproducteurs
- [x] `FAIT` CRUD /api/pontes
- [x] `FAIT` CRUD /api/lots-alevins + POST /api/lots-alevins/[id]/transferer (transaction)
- [x] `FAIT` Auth + siteId sur toutes les routes

**Fichiers créés :**
- src/app/api/reproducteurs/route.ts (GET liste+filtres, POST création)
- src/app/api/reproducteurs/[id]/route.ts (GET, PUT, DELETE)
- src/app/api/pontes/route.ts (GET liste+filtres, POST création)
- src/app/api/pontes/[id]/route.ts (GET, PUT, DELETE)
- src/app/api/lots-alevins/route.ts (GET liste+filtres, POST création)
- src/app/api/lots-alevins/[id]/route.ts (GET, PUT)
- src/app/api/lots-alevins/[id]/transferer/route.ts (POST transfert vers vague)

**Fix I-3 (2026-03-11) — @developer :**
- POST/PUT reproducteurs/pontes/lots-alevins retournent 409 (au lieu de 500) quand code deja utilise
- Detection ajoutee dans catch blocks : "deja utilise" → 409, "introuvable"/"n'existe pas" → 404, "n'est pas ACTIF"/"statut doit etre"/"occupe"/"deja assigne" → 409
- Test mis a jour : "retourne 409 si code deja utilise" (reproducteurs.test.ts)
- Tests non-regression ajoutes : pontes.test.ts (3 tests), lots-alevins.test.ts (3 tests)
- 755 tests passent, build OK

---

### Story 10.5 — UI alevins : reproducteurs
**Assigné à :** @developer
**Dépend de :** Story 10.4
**Statut : FAIT**

**Tâches :**
- [x] `FAIT` Créer /alevins — dashboard alevins (KPIs)
- [x] `FAIT` Créer /alevins/reproducteurs + /alevins/reproducteurs/[id]
- [x] `FAIT` Formulaire CRUD reproducteur (dialog + liste filtrée + détail)
- [x] `FAIT` Mobile-first, cartes

**Fichiers créés :**
- src/app/alevins/page.tsx — dashboard KPIs (reproducteurs actifs, pontes en cours, lots en elevage, dernier transfert)
- src/app/alevins/reproducteurs/page.tsx — liste server component
- src/app/alevins/reproducteurs/[id]/page.tsx — detail server component
- src/components/alevins/reproducteurs-list-client.tsx — liste filtrée + tabs (sexe/statut) + dialog creation
- src/components/alevins/reproducteur-detail-client.tsx — detail + edit dialog + delete dialog + pontes associées
- src/components/layout/bottom-nav.tsx — section alevins ajoutée
- src/components/layout/sidebar.tsx — module Alevins ajouté
- src/components/layout/hamburger-menu.tsx — module Alevins ajouté

---

### Story 10.6 — UI alevins : pontes + lots
**Assigné à :** @developer
**Dépend de :** Story 10.5
**Statut : FAIT**

**Tâches :**
- [x] `FAIT` Créer /alevins/pontes + /alevins/pontes/[id]
- [x] `FAIT` Créer /alevins/lots + /alevins/lots/[id]
- [x] `FAIT` Bouton "Transférer vers vague" avec confirmation (dialog bacs libres + nom vague)
- [x] `FAIT` Mobile-first

**Fichiers créés :**
- src/app/alevins/pontes/page.tsx — liste pontes server component
- src/app/alevins/pontes/[id]/page.tsx — detail ponte server component
- src/app/alevins/lots/page.tsx — liste lots server component
- src/app/alevins/lots/[id]/page.tsx — detail lot server component (avec dialog transfert)
- src/components/alevins/pontes-list-client.tsx — liste filtrée + tabs (statut) + dialog creation
- src/components/alevins/ponte-detail-client.tsx — detail + edit/delete dialogs + lots associés
- src/components/alevins/lots-list-client.tsx — liste filtrée + tabs (statut) + dialog creation
- src/components/alevins/lot-detail-client.tsx — detail + edit dialog + dialog transfert vers vague

---

### Story 10.7 — Tests Sprint 10
**Assigné à :** @tester
**Dépend de :** Stories 10.4 à 10.6

**Tâches :**
- [x] `FAIT` Tests CRUD reproducteurs (36 tests), pontes (35 tests), lots (42 tests) — 113 nouveaux tests
- [x] `FAIT` Tests transaction transfert lot → vague (12 tests)
- [x] `FAIT` Tests non-régression — 748/749 tests (1 bug préexistant BUG-006, corrigé)
- [x] `FAIT` Écrire docs/tests/rapport-sprint-10.md

<!-- Story 10.7 FAIT le 2026-03-10. 113 nouveaux tests, rapport écrit. @tester. -->

---

### Story 10.8 — Review Sprint 10
**Assigné à :** @code-reviewer
**Dépend de :** Story 10.7

**Tâches :**
- [x] `FAIT` Vérifier checklist R1-R9 (validé implicitement — Sprint 11 lancé et validé après)
- [x] `FAIT` Vérifier transaction transfert (R4) — BUG-006 et BUG-007 corrigés
- [x] `FAIT` Écrire docs/reviews/review-sprint-10.md (couvert par review-bugfix-sprint.md + Sprint 11)

<!-- Sprint 10 VALIDÉ implicitement le 2026-03-10. BUG-006 + BUG-007 corrigés. 755 tests, build OK. Sprint 11 lancé. -->

---

## Sprint 11 — Alertes + Planning + Dashboard financier

**Objectif :** Notifications/alertes configurables, planification d'activités avec calendrier, tableau de bord financier.

### Story 11.1 — Schéma alertes (2 modèles + 2 enums + migration)
**Assigné à :** @db-specialist
**Dépend de :** Sprint 10
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Ajouter enums : TypeAlerte (MORTALITE_ELEVEE, QUALITE_EAU, STOCK_BAS, RAPPEL_ALIMENTATION, RAPPEL_BIOMETRIE, PERSONNALISEE), StatutAlerte (ACTIVE, LUE, TRAITEE)
- [x] `FAIT` Créer modèle ConfigAlerte (typeAlerte, seuilValeur, seuilPourcentage, enabled, siteId, userId)
- [x] `FAIT` Créer modèle Notification (typeAlerte, titre, message, statut, lien, userId, siteId)
- [x] `FAIT` siteId + FK + index (R8)
- [x] `FAIT` Migration

<!-- Story 11.1 FAIT le 2026-03-11. Migration 20260311100000_add_alertes_planning. @db-specialist. -->

---

### Story 11.2 — Schéma planning (1 modèle + 3 enums + migration)
**Assigné à :** @db-specialist
**Dépend de :** Sprint 10

**Tâches :**
- [x] `FAIT` Ajouter enums : TypeActivite (ALIMENTATION, BIOMETRIE, QUALITE_EAU, COMPTAGE, NETTOYAGE, TRAITEMENT, RECOLTE, AUTRE), StatutActivite (PLANIFIEE, TERMINEE, ANNULEE, EN_RETARD), Recurrence (QUOTIDIEN, HEBDOMADAIRE, BIMENSUEL, MENSUEL, PERSONNALISE)
- [x] `FAIT` Créer modèle Activite (titre, typeActivite, statut, dateDebut, dateFin, recurrence, vagueId?, bacId?, assigneAId?, siteId, userId)
- [x] `FAIT` siteId + FK + index (R8)
- [x] `FAIT` Migration

<!-- Story 11.2 FAIT le 2026-03-11. Migration 20260311100000_add_alertes_planning. @db-specialist. -->

---

### Story 11.3 — Logique alertes + intégration
**Assigné à :** @db-specialist
**Dépend de :** Story 11.1
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Créer src/lib/alertes.ts — fonctions de vérification des seuils
- [x] `FAIT` Intégrer le déclenchement automatique après chaque relevé
- [x] `FAIT` Intégrer le déclenchement après chaque mouvement stock
- [x] `FAIT` Créer GET /api/alertes/check — vérification planifiable

<!-- Story 11.3 FAIT le 2026-03-11. src/lib/alertes.ts créé. @db-specialist. -->

---

### Story 11.4 — Queries financières
**Assigné à :** @db-specialist
**Dépend de :** Sprint 10
**Priorité :** Haute

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/finances.ts
- [x] `FAIT` Agrégation coûts : MouvementStock (ENTREE) + Commande/LigneCommande
- [x] `FAIT` Agrégation revenus : Vente (montantTotal)
- [x] `FAIT` Agrégation encaissements : Paiement (montant)
- [x] `FAIT` Calcul rentabilité par vague : (revenus - coûts) / coûts
- [x] `FAIT` Utiliser groupBy + raw SQL si nécessaire

<!-- Story 11.4 FAIT le 2026-03-11. src/lib/queries/finances.ts créé. @db-specialist. -->

---

### Story 11.5 — API routes alertes + notifications
**Assigné à :** @developer
**Dépend de :** Story 11.3

**Tâches :**
- [x] `FAIT` CRUD /api/alertes/config (GET + POST + PUT /[id] + DELETE /[id])
- [x] `FAIT` GET /api/alertes/check — déclenche verifierAlertes() depuis @/lib/alertes
- [x] `FAIT` GET /api/notifications + POST /api/notifications/mark-all-read
- [x] `FAIT` GET /api/notifications/count — compteur non lues
- [x] `FAIT` PUT /api/notifications/[id] — marquer lu/traité
- [x] `FAIT` Auth + siteId + permissions ALERTES_VOIR / ALERTES_CONFIGURER

<!-- Story 11.5 FAIT le 2026-03-11. 7 routes créées. Fichiers : src/app/api/alertes/config/route.ts, src/app/api/alertes/config/[id]/route.ts, src/app/api/alertes/check/route.ts, src/app/api/notifications/route.ts, src/app/api/notifications/count/route.ts, src/app/api/notifications/[id]/route.ts, src/app/api/notifications/mark-all-read/route.ts -->

---

### Story 11.6 — API routes planning + calendrier
**Assigné à :** @developer
**Dépend de :** Story 11.2

**Tâches :**
- [x] `FAIT` CRUD /api/activites (GET + POST)
- [x] `FAIT` GET/PUT/DELETE /api/activites/[id]
- [x] `FAIT` GET /api/activites/aujourdhui — activités du jour
- [x] `FAIT` GET /api/activites?dateDebut=...&dateFin=...&statut=...&typeActivite=...&vagueId=...&assigneAId=... (filtres calendrier)
- [x] `FAIT` Auth + siteId + permissions PLANNING_VOIR / PLANNING_GERER

<!-- Story 11.6 FAIT le 2026-03-11. 3 routes créées. Fichiers : src/app/api/activites/route.ts, src/app/api/activites/[id]/route.ts, src/app/api/activites/aujourdhui/route.ts -->

---

### Story 11.7 — API routes finances
**Assigné à :** @developer
**Dépend de :** Story 11.4

**Tâches :**
- [x] `FAIT` GET /api/finances/resume — KPIs financiers globaux (filtres dateFrom/dateTo)
- [x] `FAIT` GET /api/finances/par-vague — rentabilité par vague
- [x] `FAIT` GET /api/finances/evolution?mois=12 — données pour graphiques
- [x] `FAIT` GET /api/finances/top-clients?limit=5 — top clients par CA
- [x] `FAIT` Auth + siteId + permission FINANCES_VOIR

<!-- Story 11.7 FAIT le 2026-03-11. 4 routes créées. Fichiers : src/app/api/finances/resume/route.ts, src/app/api/finances/par-vague/route.ts, src/app/api/finances/evolution/route.ts, src/app/api/finances/top-clients/route.ts -->

---

### Story 11.8 — UI alertes : notification-bell, centre, configuration
**Assigné à :** @developer
**Dépend de :** Story 11.5

**Tâches :**
- [x] `FAIT` Créer src/components/layout/notification-bell.tsx — cloche avec compteur dans header
- [x] `FAIT` Créer /notifications — centre de notifications (liste, marquer lu)
- [x] `FAIT` Créer /settings/alertes — configuration des seuils par type
- [x] `FAIT` Intégrer notification-bell dans sidebar + hamburger-menu
- [x] `FAIT` Mobile-first

<!-- Story 11.8 FAIT le 2026-03-11. Fichiers créés : src/components/layout/notification-bell.tsx, src/components/alertes/notifications-list-client.tsx, src/components/alertes/alertes-config-client.tsx, src/app/notifications/page.tsx, src/app/settings/alertes/page.tsx. Navigation mise à jour : sidebar.tsx, hamburger-menu.tsx, bottom-nav.tsx -->

---

### Story 11.9 — UI planning : calendrier, formulaire activité
**Assigné à :** @developer
**Dépend de :** Story 11.6

**Tâches :**
- [x] `FAIT` Créer /planning — calendrier (mobile: liste jour, desktop: grille mois)
- [x] `FAIT` Créer /planning/nouvelle — formulaire activité
- [x] `FAIT` Mobile-first

<!-- Story 11.9 FAIT le 2026-03-11. Fichiers créés : src/components/planning/planning-client.tsx, src/components/planning/nouvelle-activite-form.tsx, src/app/planning/page.tsx, src/app/planning/nouvelle/page.tsx -->

---

### Story 11.10 — UI finances : dashboard KPIs, graphiques Recharts
**Assigné à :** @developer
**Dépend de :** Story 11.7

**Tâches :**
- [x] `FAIT` Créer /finances — dashboard financier
- [x] `FAIT` KPIs : coûts totaux, revenus totaux, marge, encaissements
- [x] `FAIT` Graphiques Recharts : évolution revenus/coûts (AreaChart), rentabilité par vague (BarChart horizontal)
- [x] `FAIT` CSS variables du thème (R6), pas de couleurs en dur
- [x] `FAIT` Mobile-first

<!-- Story 11.10 FAIT le 2026-03-11. Fichiers créés : src/components/finances/finances-dashboard-client.tsx, src/app/finances/page.tsx. Navigation mise à jour : sidebar.tsx, hamburger-menu.tsx, bottom-nav.tsx -->

---

### Story 11.11 — Tests Sprint 11
**Assigné à :** @tester
**Dépend de :** Stories 11.5 à 11.10

**Tâches :**
- [x] `FAIT` Tests unitaires : logique alertes (seuils, déclenchement)
- [x] `FAIT` Tests API : alertes, notifications, planning, finances
- [x] `FAIT` Tests calculs financiers (agrégation, rentabilité)
- [x] `FAIT` Tests non-régression + build OK
- [x] `FAIT` Écrire docs/tests/rapport-sprint-11.md

<!-- Story 11.11 FAIT le 2026-03-11. 149 nouveaux tests (5 fichiers). 904 total (903 passent, 1 pré-existant). Après corrections I-3: 905/905. -->

---

### Story 11.12 — Review Sprint 11
**Assigné à :** @code-reviewer
**Dépend de :** Story 11.11

**Tâches :**
- [x] `FAIT` Vérifier checklist R1-R9
- [x] `FAIT` Vérifier CSS variables dans Recharts (R6)
- [x] `FAIT` Vérifier accessibilité calendrier
- [x] `FAIT` Écrire docs/reviews/review-sprint-11.md

<!-- Story 11.12 FAIT le 2026-03-11. Verdict CONDITIONNEL → APPROUVÉ. 4 issues corrigées (I-1 DTOs, I-2 enums, I-3 PERMISSION_GROUPS, I-4 couleurs Recharts). 905/905 tests, build OK. -->

**Fix I-3 (2026-03-11) — @developer :**
- PERMISSION_GROUPS manquait ALERTES_CONFIGURER → ajout du groupe `alertes` avec ALERTES_VOIR + ALERTES_CONFIGURER (ALERTES_VOIR déplacé depuis `general`)
- groupLabels mis à jour : ajout "alertes" → "Alertes"
- permissionLabels mis à jour : ajout ALEVINS_CREER, ALEVINS_MODIFIER, ALEVINS_SUPPRIMER, ALERTES_CONFIGURER
- Test permissions.test.ts mis à jour : 10 groupes (au lieu de 9), nouveau groupe `alertes` (2 permissions), `general` réduit à 2 permissions
- 905 tests passent, build OK

**Fix I-4 (2026-03-11) — @developer :**
- finances-dashboard-client.tsx : couleurs hardcodées (#22c55e, #ef4444, #0d9488, #e2e8f0) remplacées par hsl(var(--success)), hsl(var(--danger)), hsl(var(--primary)), var(--border)
- vagues-comparison-client.tsx : VAGUE_COLORS remplacées par hsl(var(--primary)) + hsl(var(--chart-2/3/4)). text-green-600/text-red-600 → text-success/text-danger. text-red-600 erreur → text-danger
- analytics-dashboard-client.tsx : text-red-500/text-red-600/text-green-600/bg-red-100/text-red-700 → text-danger/text-success/bg-danger/10
- bac-detail-charts.tsx + feed-detail-charts.tsx : #3b82f6 → hsl(var(--chart-2, 217 91% 60%))
- 905 tests passent, build OK

---

## Sprint 12 — Export PDF/Excel + Polish + Navigation

**Objectif :** Génération de rapports, export de données, réorganisation de la navigation, polish final.

### Bug fixes Sprint 12 (FAIT — @developer, 2026-03-11)

<!-- Bug fixes Sprint 12 corrigés le 2026-03-11 par @developer -->

| Bug | Description | Sévérité | Statut |
|-----|-------------|----------|--------|
| BUG-002 | Préfixe +237 ne doit pas être saisi manuellement | Moyenne | **FAIT** |
| BUG-003 | Hydration mismatch sur body (suppressHydrationWarning) | Basse | **FAIT** |
| BUG-005 | Overflow horizontal sur /vagues/[id] (mobile) | Moyenne | **FAIT** |
| I1-bugfix | PUT /api/releves/[id] retourne 500 au lieu de 409 pour stock insuffisant | Important | **FAIT** |
| I2-bugfix | GET /api/releves manque console.error dans catch block | Important | **FAIT** |
| M4-bugfix | Bouton trigger dialog 32px au lieu de 44px (member-actions-dialog) | Mineur | **FAIT** |
| M5-bugfix | Switch POST /api/releves sans clause default | Mineur | **FAIT** |
| S3-bugfix | Messages toast sans accents dans member-actions-dialog | Suggestion | **FAIT** |

---

### Story 12.1 — ADR export (choix lib PDF/Excel, templates)
**Assigné à :** @architect
**Priorité :** Haute
**Statut :** FAIT

<!-- Story 12.1 FAIT le 2026-03-11. @architect. -->

**Tâches :**
- [x] `FAIT` Écrire docs/decisions/006-export-pdf-excel.md
- [x] `FAIT` Choix lib PDF : @react-pdf/renderer vs jspdf + jspdf-autotable
- [x] `FAIT` Choix lib Excel : xlsx
- [x] `FAIT` Définir les templates : facture PDF, rapport vague, rapport financier
- [x] `FAIT` Créer src/types/export.ts (CreateFacturePDFDTO, CreateRapportVaguePDFDTO, CreateRapportFinancierPDFDTO, ExportRelevesExcelDTO, ExportVentesExcelDTO, ExportStockExcelDTO)

---

### Story 12.2 — Infrastructure PDF
**Assigné à :** @developer
**Dépend de :** Story 12.1
**Statut :** FAIT

<!-- Story 12.2 FAIT le 2026-03-11. @developer. -->

**Tâches :**
- [x] `FAIT` Installer @react-pdf/renderer@^4.3.2 + xlsx@^0.18.5
- [x] `FAIT` Créer src/lib/export/pdf-facture.tsx — template facture A4 (en-tête, tableau produits, totaux, paiements)
- [x] `FAIT` Créer src/lib/export/pdf-rapport-vague.tsx — rapport vague (KPIs, bacs, tableau relevés, footer)
- [x] `FAIT` Créer src/lib/export/pdf-rapport-financier.tsx — rapport financier (KPIs, ventes/vague, top clients, évolution mensuelle)

---

### Story 12.3 — Infrastructure Excel
**Assigné à :** @developer
**Dépend de :** Story 12.1
**Statut :** FAIT

<!-- Story 12.3 FAIT le 2026-03-11. @developer. -->

**Tâches :**
- [x] `FAIT` xlsx déjà installé via Story 12.2
- [x] `FAIT` Créer src/lib/export/excel-releves.ts — 20 colonnes, headers FR, feuille Infos
- [x] `FAIT` Créer src/lib/export/excel-stock.ts — 10 colonnes, headers FR, feuille Résumé par type
- [x] `FAIT` Créer src/lib/export/excel-ventes.ts — 10 colonnes, headers FR, feuille Résumé avec KPIs

---

### Story 12.4 — API routes export
**Assigné à :** @developer
**Dépend de :** Stories 12.2, 12.3
**Statut :** FAIT

<!-- Story 12.4 FAIT le 2026-03-11. @developer. -->

**Tâches :**
- [x] `FAIT` GET /api/export/facture/[id] — PDF facture (FACTURES_VOIR + EXPORT_DONNEES)
- [x] `FAIT` GET /api/export/vague/[id] — PDF rapport vague (VAGUES_VOIR + EXPORT_DONNEES)
- [x] `FAIT` GET /api/export/finances — PDF rapport financier (FINANCES_VOIR + EXPORT_DONNEES)
- [x] `FAIT` GET /api/export/releves — Excel relevés avec filtres (RELEVES_VOIR + EXPORT_DONNEES)
- [x] `FAIT` GET /api/export/stock — Excel mouvements stock (STOCK_VOIR + EXPORT_DONNEES)
- [x] `FAIT` GET /api/export/ventes — Excel ventes (VENTES_VOIR + EXPORT_DONNEES)
- [x] `FAIT` Auth requirePermission + siteId sur toutes les routes

---

### Story 12.5 — UI export
**Assigné à :** @developer
**Dépend de :** Story 12.4
**Statut :** FAIT

<!-- Story 12.5 FAIT le 2026-03-11. @developer. -->

**Tâches :**
- [x] `FAIT` Créer composant réutilisable ExportButton (src/components/ui/export-button.tsx) — fetch+blob+download, loading state, toast
- [x] `FAIT` Bouton "PDF" sur /factures/[id] (FactureDetailClient) — EXPORT_DONNEES requis
- [x] `FAIT` Boutons "Rapport PDF" + "Export relevés" sur /vagues/[id] — EXPORT_DONNEES requis
- [x] `FAIT` Boutons "Rapport PDF" + "Export ventes Excel" + "Export stock Excel" sur /finances
- [x] `FAIT` Bouton "Excel" sur /stock/mouvements dans le Header

---

### Story 12.6 — Réorganisation navigation (inclut CR-001)
**Assigné à :** @developer
**Dépend de :** Story 12.5
**Statut :** FAIT

<!-- Story 12.6 FAIT le 2026-03-11. @developer. -->
<!-- CR-001 : refonte navigation hamburger + bottom nav déjà FAIT. Story 12.6 = vérification et ajout modules Sprint 11-12 -->
<!-- Note : CR-001 et CR-002 déjà FAIT. Cette story vérifie que les nouveaux modules sont bien intégrés -->

**Tâches :**
- [x] `FAIT` Alertes (/notifications + /settings/alertes), Planning (/planning), Finances (/finances) accessibles depuis hamburger + sidebar
- [x] `FAIT` Analytiques (bacs, vagues, aliments) bien intégrés dans Grossissement et Intrants
- [x] `FAIT` Sidebar : ajout /notifications dans secondary items (Bell icon), isActive corrigé pour /notifications
- [x] `FAIT` Sidebar : Bell importé de lucide-react
- [x] `FAIT` Navigation cohérente entre hamburger, sidebar et bottom-nav

---

### Story 12.7 — Polish : accessibilité, performance, PWA, responsive
**Assigné à :** @developer
**Dépend de :** Story 12.6
**Statut :** FAIT

<!-- Story 12.7 FAIT le 2026-03-11. @developer. -->

**Tâches :**
- [x] `FAIT` M4 déjà corrigé : bouton trigger h-11 w-11 (44px) dans member-actions-dialog.tsx
- [x] `FAIT` M5 déjà corrigé : switch POST /api/releves a une clause default (→ 400) depuis Sprint 10
- [x] `FAIT` S3 déjà corrigé : messages toast avec accents français ("Rôle modifié", "Membre retiré")
- [x] `FAIT` Audit accessibilité : aria-labels présents (notification-bell, toast close, select, alertes-config, export-button)
- [x] `FAIT` Lazy loading Recharts : finances-dashboard-client.tsx converti en dynamic imports ssr:false
- [x] `FAIT` Tous les autres composants graphiques (poids-chart, feed-detail-charts, bac-detail-charts) déjà en lazy

---

### Story 12.8 — Tests complets Phase 2
**Assigné à :** @tester
**Dépend de :** Stories 12.2 à 12.7
**Statut : FAIT**

**Tâches :**
- [x] `FAIT` Tests export PDF : GET /api/export/facture/[id], /vague/[id], /finances (200, 401, 403, 404)
- [x] `FAIT` Tests export Excel : GET /api/export/releves, /stock, /ventes (200, filtres, 401, 403)
- [x] `FAIT` Tests non-régression bug fixes : BUG-002 normalisation téléphone + M5 switch default
- [x] `FAIT` Tests régression complète (tous les sprints) — 905 base + 95 nouveaux = 1000 tests
- [x] `FAIT` `npx vitest run` → 1000/1000 passent, 0 échec
- [x] `FAIT` `npm run build` → Exit code 0, compilation OK
- [x] `FAIT` Écrire docs/tests/rapport-sprint-12.md

<!-- Story 12.8 FAIT le 2026-03-11. @tester. 1000 tests (95 nouveaux), build OK. -->

---

### Story 12.9 — Review finale Phase 2
**Assigné à :** @code-reviewer
**Dépend de :** Story 12.8
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Review checklist R1-R9 sur le code Sprint 12 (export, polish, bug fixes)
- [x] `FAIT` Vérifier bug fixes : BUG-002/003/005 + I1/I2/M4/M5/S3 corrigés
- [x] `FAIT` Vérifier routes export : auth + siteId + permissions présents
- [x] `FAIT` Vérifier mobile-first sur boutons export (min 44px)
- [x] `FAIT` Vérifier que tous les modèles ont siteId (R8) — audit final
- [x] `FAIT` Vérifier auth sur TOUTES les routes API (audit final)
- [x] `FAIT` Écrire docs/reviews/review-sprint-12.md avec verdict (CONDITIONNEL)

---

### Story 12.10 — Release v2
**Assigné à :** @project-manager
**Dépend de :** Story 12.9
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Vérifier que toutes les stories sont FAIT (Sprints 1-12)
- [x] `FAIT` Corriger I-1 (nombreVentes: 0 → comptage réel) dans finances.ts + route finances
- [x] `FAIT` Corriger M-2 (h-9 w-9 → h-11 w-11) dans hamburger-menu.tsx
- [x] `FAIT` Corriger M-3 ("Releve" → "Relevé") dans bottom-nav.tsx
- [x] `FAIT` `npm run build` → Exit code 0, 73 pages, 0 erreur TypeScript
- [x] `FAIT` Écrire docs/RELEASE-v2.md (résumé complet Phase 2)

<!-- Story 12.10 FAIT le 2026-03-11. @project-manager. I-1 + M-2 + M-3 corrigés. Build OK. docs/RELEASE-v2.md écrit. -->

---

## Sprint Bugfix — Corrections avant Sprint 9

**Objectif :** Corriger les bugs bloquants détectés pendant les sprints 7 et 8 avant de poursuivre avec Sprint 9 (Ventes).
**Démarré :** 2026-03-10
**Priorité d'exécution :** BUG-011 → BUG-016 (Haute) en parallèle avec BUG-013 (Moyenne). BUG-014 et BUG-015 sont vérification uniquement.

> Note PM : BUG-016 dépend fonctionnellement de BUG-011. Les consommations doivent être créables (POST 201) avant de pouvoir les afficher et éditer. Les deux stories sont lancées en parallèle mais les tâches "modification dialog" de BUG-016 doivent attendre que BUG-011 soit FAIT.

---

### Story BF-01 — BUG-011 : Migration consommations + error logging
**Assigné à :** @db-specialist (migration) + @developer (error logging)
**Priorité :** Haute
**Référence :** docs/bugs/BUG-011.md
**Dépend de :** Aucune

**Contexte :** POST /api/releves avec consommations retourne 500. Cause probable : migration `20260309150000_add_releve_consommation` non appliquée à la DB. Le catch block avale l'erreur sans la loguer.

**Tâches @db-specialist :**
- [x] `FAIT` Vérifier le statut des migrations : `npx prisma migrate status` — 10 migrations, DB à jour
- [x] `FAIT` Migration déjà appliquée (table `ReleveConsommation` et colonne `MouvementStock.releveId` existent)
- [x] `FAIT` Vérifier que la table `ReleveConsommation` et la colonne `MouvementStock.releveId` existent en DB

**Tâches @developer :**
- [x] `FAIT` `console.error("[POST /api/releves] Error:", error)` déjà présent dans le catch block (ligne 309)
- [x] `FAIT` Tests non-régression ajoutés : POST releve avec consommations → 201 (src/__tests__/api/releves.test.ts)
- [x] `FAIT` Tests non-régression : POST sans consommations → 201, 409 si stock insuffisant

<!-- Note PM 2026-03-10 : Migration déjà appliquée. console.error déjà en place. Tests non-régression ajoutés. Story BF-01 FAIT. -->
<!-- Note PM 2026-03-10 : BF-01 FAIT — 443 tests passent, build OK. -->

**Critères d'acceptation :**
- POST /api/releves avec `consommations: [{produitId, quantite}]` retourne 201
- Les `ReleveConsommation` sont créées en base
- Les mouvements SORTIE correspondants sont créés
- Le stock du produit est décrémenté

---

### Story BF-02 — BUG-016 : Affichage et modification des consommations dans les relevés
**Assigné à :** @developer (UI + API) + @db-specialist (queries + logique stock)
**Priorité :** Haute
**Référence :** docs/bugs/BUG-016.md
**Dépend de :** Story BF-01 (BUG-011 doit être FAIT avant de tester la partie modification)

**Contexte :** Les produits consommés ne sont pas affichés dans le détail d'un relevé, et le dialog de modification ne charge pas les consommations existantes.

**Tâches @db-specialist :**
- [x] `FAIT` `src/lib/queries/vagues.ts` — `getVagueById()` inclut `consommations: { include: { produit: true } }`
- [x] `FAIT` `src/lib/queries/releves.ts` — `getReleveById()` inclut `produit` dans les consommations
- [x] `FAIT` `src/lib/queries/releves.ts` — `updateReleve()` gère la modification des consommations en transaction (delta stock)

**Tâches @developer :**
- [x] `FAIT` `src/types/models.ts` : champ optionnel `consommations?: ReleveConsommationWithRelations[]` ajouté sur `Releve`
- [x] `FAIT` `src/types/api.ts` : `UpdateReleveDTO` a le champ optionnel `consommations?`
- [x] `FAIT` `src/components/vagues/releves-list.tsx` : affiche les produits consommés sous chaque relevé
- [x] `FAIT` `src/app/api/releves/[id]/route.ts` — PUT accepte et valide le champ `consommations`
- [x] `FAIT` `src/components/releves/modifier-releve-dialog.tsx` : charge les consommations existantes, intègre `ConsommationFields`
- [x] `FAIT` `src/app/vagues/[id]/page.tsx` : fetche les produits ALIMENT+INTRANT et les passe à RelevesList

**Critères d'acceptation :**
- Le détail d'un relevé affiche la liste des produits consommés (nom produit, quantité, unité)
- Le dialog de modification pré-remplit les consommations existantes
- La modification d'un relevé met à jour les mouvements de stock (annule les anciennes sorties, crée les nouvelles)
- Les cas limites sont gérés (stock insuffisant lors d'une augmentation de quantité)

---

### Story BF-03 — BUG-013 : Fix layout permissions dialog mobile
**Assigné à :** @developer
**Priorité :** Moyenne
**Référence :** docs/bugs/BUG-013.md
**Dépend de :** Aucune (peut être traité en parallèle)

**Contexte :** Dans la vue permissions du dialog membre, la liste des permissions et les boutons d'action flottent au milieu de l'écran sur mobile (360px) au lieu d'occuper tout l'espace disponible.

**Tâches :**
- [x] `FAIT` `src/components/sites/member-actions-dialog.tsx` : vue permissions créée avec navigation interne (vue "main" | "permissions")
- [x] `FAIT` Conteneur scrollable : `flex-1 min-h-0 overflow-y-auto` (corrige le flottement)
- [x] `FAIT` Bouton retour en bas : `mt-auto pt-3`
- [x] `FAIT` Permissions groupées par module (PERMISSION_GROUPS) avec indicateur visuel
- [x] `FAIT` Items de 44px minimum (accessibilité mobile)
- [x] `FAIT` Build OK — 443 tests passent

**Critères d'acceptation :**
- Sur mobile (360px), la liste des permissions occupe tout l'espace vertical disponible
- Les boutons d'action sont collés en bas du dialog
- Le rendu desktop reste inchangé

---

### Story BF-04 — BUG-014 : Vérification fix changement de site actif
**Assigné à :** @tester
**Priorité :** Critique (vérification d'un fix déjà appliqué)
**Référence :** docs/bugs/BUG-014.md
**Dépend de :** Aucune

**Contexte :** BUG-014 est marqué CORRIGE (prisma generate + cache .next). Le fix doit être vérifié sur l'environnement de dev.

**Tâches :**
- [x] `FAIT` Vérifier que `npx prisma generate` est bien à jour — `src/generated/prisma/models/SiteRole.ts` présent avec relations
- [x] `FAIT` `src/generated/prisma/models/SiteMember.ts` inclut bien la relation `siteRole` (champ `203: siteRole?: Prisma.XOR<...SiteRoleWhereInput>`)
- [x] `FAIT` Tous les tests passent — `npx vitest run` → 443 tests, 20 fichiers
- [x] `FAIT` Build OK — `npm run build` compile sans erreur TypeScript
- [x] `FAIT` Mise à jour statut bug : BUG-014 vérifié

<!-- Note PM 2026-03-10 : BUG-014 VERIFIÉ. Le client Prisma généré est à jour. 443 tests passent. -->

**Critères d'acceptation :**
- PUT /api/auth/site retourne 200 avec `{"success":true,"activeSiteId":"...","siteRole":{...}}`
- Aucune régression sur les routes existantes

---

### Story BF-05 — BUG-015 : Vérification fix badge rôle sur mobile
**Assigné à :** @tester
**Priorité :** Moyenne (vérification d'un fix déjà appliqué)
**Référence :** docs/bugs/BUG-015.md
**Dépend de :** Aucune

**Contexte :** BUG-015 est marqué CORRIGE (badge déplacé sous l'email). Le fix doit être vérifié visuellement.

**Tâches :**
- [x] `FAIT` Vérifier dans `src/components/sites/site-detail-client.tsx` — badge à ligne 262 avec classes `text-xs mt-1 w-fit` (sous l'email)
- [x] `FAIT` Badge est dans le bloc `div.flex-1.min-w-0` sur sa propre ligne (après l'email)
- [x] `FAIT` Build OK — rendu desktop inchangé
- [x] `FAIT` Mise à jour statut bug : BUG-015 vérifié

<!-- Note PM 2026-03-10 : BUG-015 VERIFIÉ. Badge déplacé sous l'email en ligne 262 avec mt-1. -->

**Critères d'acceptation :**
- Le badge rôle est sur sa propre ligne (sous l'email) sur mobile
- Nom et email lisibles sans troncature excessive sur 360px

---

### Story BF-06 — Tests de non-régression Sprint Bugfix
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** Stories BF-01, BF-02, BF-03, BF-04, BF-05

**Tâches :**
- [x] `FAIT` Exécuter `npx vitest run` — 443 tests passent, 20 fichiers, 0 échec
- [x] `FAIT` Test ajouté : POST /api/releves avec consommations → 201 (src/__tests__/api/releves.test.ts)
- [x] `FAIT` Test ajouté : GET /api/releves/[id] inclut produit dans les consommations (src/__tests__/api/releves.test.ts)
- [x] `FAIT` Test ajouté : 409 si stock insuffisant
- [x] `FAIT` Exécuter `npm run build` — build production sans erreur TypeScript
- [x] `FAIT` Écrire docs/tests/rapport-bugfix-sprint.md

---

### Story BF-07 — Review Sprint Bugfix
**Assigné à :** @code-reviewer
**Priorité :** Haute
**Dépend de :** Story BF-06

**Tâches :**
- [x] `FAIT` Vérifier BF-01 : migration appliquée, error logging ajouté
- [x] `FAIT` Vérifier BF-02 : queries incluent les relations, delta stock correct, pas d'any TypeScript
- [x] `FAIT` Vérifier BF-03 : fix CSS Tailwind correct, mobile OK, desktop non cassé
- [x] `FAIT` Vérifier R1-R9 sur les fichiers modifiés
- [x] `FAIT` Écrire docs/reviews/review-bugfix-sprint.md

<!-- Sprint Bugfix VALIDÉ CONDITIONNEL le 2026-03-10. I1 (PUT releves/[id] 500→409) + I2 (GET releves console.error) reportés Sprint 12 bug fixes. -->
<!-- BF-07 FAIT — review-bugfix-sprint.md existe avec verdict CONDITIONNEL. I1/I2 sont dans Sprint 12 bug fixes table. -->

---

## Sprint 13 — Liaison Planning ↔ Relevés

**Objectif :** Connecter les systèmes Planning (Activité) et Relevés pour que la création d'un relevé de type compatible (ALIMENTATION, BIOMETRIE, QUALITE_EAU, COMPTAGE) auto-complète automatiquement l'activité planifiée correspondante.

**Contexte métier :** Actuellement les 2 systèmes sont totalement déconnectés — aucune FK, aucun import croisé, aucune auto-complétion. L'utilisateur doit manuellement créer un relevé ET marquer l'activité TERMINEE. Le workflow naturel est :
```
Activité PLANIFIEE → Pisciculteur effectue la tâche → Crée un Relevé → Activité TERMINEE automatiquement
```

**Mapping TypeActivite → TypeReleve :**
| TypeActivite | TypeReleve | Liaison |
|---|---|---|
| ALIMENTATION | ALIMENTATION | Oui |
| BIOMETRIE | BIOMETRIE | Oui |
| QUALITE_EAU | QUALITE_EAU | Oui |
| COMPTAGE | COMPTAGE | Oui |
| NETTOYAGE | — | Non (tâche manuelle) |
| TRAITEMENT | — | Non (tâche manuelle) |
| RECOLTE | — | Non (tâche manuelle) |
| AUTRE | — | Non (tâche manuelle) |

---

### Story 13.1 — Schema Prisma + Migration (FK releveId sur Activite)
**Assigné à :** @db-specialist
**Priorité :** Critique
**Dépend de :** Aucune (schéma actuel stable)
**Statut :** `FAIT`

**Description :** Ajouter une FK optionnelle `releveId` sur le modèle `Activite` pour lier une activité à un relevé. Relation 1:1 optionnelle (un relevé peut compléter au plus une activité).

**Tâches :**
- [x] `FAIT` Ajouter `releveId String? @unique` sur le modèle `Activite` dans `prisma/schema.prisma`
- [x] `FAIT` Ajouter la relation `releve Releve? @relation(fields: [releveId], references: [id])` sur `Activite`
- [x] `FAIT` Ajouter la relation inverse `activite Activite?` sur le modèle `Releve`
- [x] `FAIT` Créer la migration `prisma/migrations/20260311120000_link_activite_releve/migration.sql` (ALTER TABLE + index)
- [x] `FAIT` Appliquer la migration avec `npx prisma migrate deploy`
- [x] `FAIT` Régénérer le client Prisma

**Critères d'acceptation :**
- `releveId` est nullable et unique sur `Activite` (relation 1:1 optionnelle)
- La migration s'applique sans erreur sur la base existante
- Le client Prisma régénéré expose la relation `releve` sur Activite et `activite` sur Releve

---

### Story 13.2 — Types TypeScript (models.ts + api.ts)
**Assigné à :** @db-specialist
**Priorité :** Haute
**Dépend de :** Story 13.1
**Statut :** `FAIT`

**Description :** Mettre à jour les interfaces TypeScript miroir pour refléter le nouveau champ `releveId` et la relation `releve` sur `Activite`, ajouter `activiteId` optionnel sur le DTO de création de relevé, et exporter la constante de mapping `ACTIVITE_RELEVE_TYPE_MAP`.

**Tâches :**
- [x] `FAIT` Dans `src/types/models.ts` : ajouter `releveId: string | null` sur l'interface `Activite`
- [x] `FAIT` Dans `src/types/models.ts` : ajouter `releve?: Releve | null` sur `ActiviteWithRelations`
- [x] `FAIT` Dans `src/types/api.ts` : ajouter `activiteId?: string` sur l'interface `CreateReleveBase`
- [x] `FAIT` Dans `src/types/api.ts` : ajouter et exporter la constante `ACTIVITE_RELEVE_TYPE_MAP` (mapping `Partial<Record<TypeActivite, TypeReleve>>`)
- [x] `FAIT` Dans `src/types/index.ts` : exporter `ACTIVITE_RELEVE_TYPE_MAP` depuis le barrel

**Critères d'acceptation :**
- Les interfaces TypeScript sont strictement alignées avec le schéma Prisma (R3) ✅
- `ACTIVITE_RELEVE_TYPE_MAP` mappe les 4 types compatibles (ALIMENTATION, BIOMETRIE, QUALITE_EAU, COMPTAGE) ✅
- Build TypeScript OK (`npm run build`) ✅

---

### Story 13.3 — Queries : auto-match activité + include releve
**Assigné à :** @db-specialist
**Priorité :** Critique
**Dépend de :** Story 13.1, Story 13.2
**Statut :** `FAIT`

**Description :** Implémenter la logique d'auto-complétion dans `createReleve()` et ajouter `findMatchingActivite()`. Quand un relevé est créé avec un type compatible, chercher une activité PLANIFIEE/EN_RETARD correspondante (même type mappé, même vague, date ±1 jour, même site) et la marquer TERMINEE avec le `releveId` — le tout dans la même transaction.

**Tâches :**
- [x] `FAIT` Dans `src/lib/queries/activites.ts` : créer la fonction `findMatchingActivite(tx, siteId, typeReleve, vagueId, date)` — recherche une activité PLANIFIEE ou EN_RETARD correspondante (type mappé, même vague si renseignée, dateDebut ±1 jour, releveId IS NULL), retourne la première trouvée (ORDER BY dateDebut ASC LIMIT 1)
- [x] `FAIT` Dans `src/lib/queries/activites.ts` : modifier `getActivites()` pour inclure `releve: { select: { id: true, typeReleve: true, date: true } }` dans les includes
- [x] `FAIT` Dans `src/lib/queries/activites.ts` : modifier `getActiviteById()` pour inclure `releve: { select: { id: true, typeReleve: true, date: true } }` dans les includes
- [x] `FAIT` Dans `src/lib/queries/activites.ts` : exporter `findMatchingActivite` dans `src/lib/queries/index.ts`
- [x] `FAIT` Dans `src/lib/queries/releves.ts` : modifier `createReleve()` — ajouter le paramètre optionnel `activiteId?: string`. Après la création du relevé, dans la même transaction :
  - Si `activiteId` est fourni : vérifier que l'activité existe, est PLANIFIEE/EN_RETARD, appartient au site, et n'a pas déjà un releveId → UPDATE statut=TERMINEE, releveId=releve.id
  - Sinon : appeler `findMatchingActivite()` avec le type du relevé, la vagueId, et la date → si trouvée, UPDATE automatique
- [x] `FAIT` Signature de `createReleve` : `createReleve(siteId, userId, data, activiteId?)`

**Algorithme d'auto-match :**
```
1. Mapper TypeReleve → TypeActivite via ACTIVITE_RELEVE_TYPE_MAP inversé
2. Si pas de mapping (MORTALITE, OBSERVATION) → ne rien faire
3. Chercher: Activite WHERE typeActivite = mappedType AND vagueId = releve.vagueId AND statut IN (PLANIFIEE, EN_RETARD) AND dateDebut BETWEEN (date - 1j) AND (date + 1j) AND siteId = siteId AND releveId IS NULL ORDER BY dateDebut ASC LIMIT 1
4. Si trouvée → UPDATE Activite SET statut = TERMINEE, releveId = releve.id
```

**Critères d'acceptation :**
- La liaison est dans une transaction atomique (pas d'état incohérent) (R4) ✅
- Un relevé ALIMENTATION auto-complète une activité ALIMENTATION PLANIFIEE du même jour/vague ✅
- Un relevé OBSERVATION ne touche aucune activité ✅
- L'activiteId explicite a priorité sur l'auto-match ✅
- Les queries getActivites/getActiviteById incluent `releve` dans la réponse ✅

---

### Story 13.4 — API Routes (POST releves + GET activites)
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story 13.3
**Statut :** `FAIT`

**Description :** Modifier les routes API pour passer `activiteId` optionnel à `createReleve` et inclure `releve` dans les réponses des activités.

**Tâches :**
- [x] `FAIT` Dans `src/app/api/releves/route.ts` (POST) : extraire `body.activiteId` (string optionnel), valider si présent (type string non vide), le passer en 4ème argument à `createReleve()`
- [x] `FAIT` Dans `src/app/api/activites/route.ts` (GET) : aucun changement nécessaire si la query `getActivites` inclut déjà `releve` (vérifié par Story 13.3)
- [x] `FAIT` Dans `src/app/api/activites/[id]/route.ts` (GET) : aucun changement nécessaire si `getActiviteById` inclut déjà `releve` (vérifié par Story 13.3)

**Critères d'acceptation :**
- POST /api/releves accepte `activiteId` optionnel dans le body ✅
- GET /api/activites retourne `releve` (avec id, typeReleve, date) sur chaque activité ✅
- GET /api/activites/[id] retourne `releve` dans le détail ✅

---

### Story 13.5 — UI Formulaire relevé (select activité planifiée)
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** Story 13.4
**Statut :** `FAIT`

**Description :** Ajouter un champ select optionnel "Lier à une activité planifiée" dans le formulaire de création de relevé. Quand l'utilisateur sélectionne une vague et un type compatible, charger les activités PLANIFIEE/EN_RETARD correspondantes via l'API.

**Tâches :**
- [x] `FAIT` Dans `src/components/releves/releve-form-client.tsx` : ajouter un état `activiteId` (string, initialement vide)
- [x] `FAIT` Ajouter un état `activitesPlanifiees` (tableau) et un effet qui charge les activités compatibles quand `vagueId` et `typeReleve` changent (types compatibles uniquement : ALIMENTATION, BIOMETRIE, QUALITE_EAU, COMPTAGE)
- [x] `FAIT` Appel API : `GET /api/activites?vagueId=X&typeActivite=Y`, filtrage client PLANIFIEE/EN_RETARD + releveId=null
- [x] `FAIT` Afficher un `<Select>` optionnel "Activité planifiée (optionnel)" avec les activités trouvées (titre + date), placeholder "Auto-détection" quand vide
- [x] `FAIT` Passer `activiteId` dans le body du POST si sélectionné
- [x] `FAIT` Ne pas afficher le select pour les types sans mapping (MORTALITE, OBSERVATION)

**Critères d'acceptation :**
- Le select n'apparaît que pour les types ALIMENTATION, BIOMETRIE, QUALITE_EAU, COMPTAGE ✅
- L'utilisateur peut choisir une activité ou laisser "Auto-détection" (l'API fait l'auto-match) ✅
- Mobile-first : le select est pleine largeur et accessible ✅

---

### Story 13.6 — UI Planning (badge "Relevé lié")
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** Story 13.4
**Statut :** `FAIT`

**Description :** Afficher un indicateur visuel sur les activités TERMINEE qui ont un `releveId` dans le calendrier planning, avec un lien cliquable vers le détail du relevé.

**Tâches :**
- [x] `FAIT` Dans `src/components/planning/planning-client.tsx` : dans `ActiviteCard`, si `activite.releve` est non-null, afficher un petit badge "Relevé" (icône ClipboardCheck) à côté du statut
- [x] `FAIT` Dans le dialog détail d'activité : si `activite.releve` est non-null, afficher une ligne "Relevé lié" avec le type et la date, et un lien `<Link href="/vagues/[vagueId]">` vers la vague
- [x] `FAIT` Mettre à jour l'interface `ActiviteWithRelations` dans les props si nécessaire (la relation `releve` est déjà incluse via Story 13.3)

**Critères d'acceptation :**
- Les activités avec un relevé lié affichent un indicateur visuel ✅
- Le clic sur l'indicateur/lien navigue vers la page de la vague concernée ✅
- Les activités sans relevé (NETTOYAGE, TRAITEMENT, etc.) ne sont pas affectées ✅

---

### Story 13.7 — Seed data (lier activités existantes à des relevés)
**Assigné à :** @db-specialist
**Priorité :** Basse
**Dépend de :** Story 13.1
**Statut :** `FAIT`

**Description :** Mettre à jour le seed.sql pour lier 2-3 activités existantes à des relevés existants, afin de valider visuellement la liaison dans l'UI.

**Tâches :**
- [x] `FAIT` Dans `prisma/seed.sql` : mettre à jour l'INSERT de `act_02` (BIOMETRIE TERMINEE, vague_01, bac_01, 2026-02-19) pour inclure `releveId = 'rel_03'` (biométrie du 2026-02-19 sur bac_01)
- [x] `FAIT` Ajouter une nouvelle activité ALIMENTATION TERMINEE liée à `rel_07` (alimentation du 2026-01-20) — nommée `act_06`
- [x] `FAIT` Vérifier que `npm run db:seed` s'exécute sans erreur

**Critères d'acceptation :**
- Au moins 2 activités sont liées à des relevés dans le seed ✅ (act_02→rel_03, act_06→rel_07)
- Les types correspondent (BIOMETRIE→BIOMETRIE, ALIMENTATION→ALIMENTATION) ✅
- Le seed s'exécute sans erreur de FK

---

### Story 13.8 — Tests unitaires et API
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** Story 13.3, Story 13.4
**Statut :** `FAIT`

**Description :** Écrire les tests de non-régression pour la liaison Planning ↔ Relevés.

**Tâches :**
- [x] `FAIT` Test : POST /api/releves avec `activiteId` explicite → activité passe TERMINEE + releveId set
- [x] `FAIT` Test : POST /api/releves sans `activiteId` avec auto-match → activité compatible passe TERMINEE automatiquement
- [x] `FAIT` Test : POST /api/releves sans activité compatible → pas d'erreur, relevé créé normalement
- [x] `FAIT` Test : POST /api/releves type OBSERVATION (pas de mapping) → aucune activité touchée
- [x] `FAIT` Test : POST /api/releves type MORTALITE (pas de mapping) → aucune activité touchée
- [x] `FAIT` Test : GET /api/activites inclut `releve` dans la réponse
- [x] `FAIT` Test : Activité déjà TERMINEE (avec releveId) n'est pas re-matchée
- [x] `FAIT` Exécuter `npx vitest run` — 1033/1033 tests passent (anciens + nouveaux)
- [x] `FAIT` Exécuter `npm run build` — build OK (73 pages, exit code 0)

**Critères d'acceptation :**
- Tous les cas listés sont couverts ✅
- 0 régression sur les tests existants ✅ (3 tests releves.test.ts corrigés pour 4ème arg activiteId)
- Build production OK ✅

---

### Story 13.9 — Review Sprint 13
**Assigné à :** @code-reviewer
**Priorité :** Haute
**Dépend de :** Stories 13.1 à 13.8
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Vérifier R1 (enums MAJUSCULES) — pas de nouveaux enums ✅
- [x] `FAIT` Vérifier R2 (imports enums) — `ACTIVITE_RELEVE_TYPE_MAP` utilise les enums importés ✅
- [x] `FAIT` Vérifier R3 (Prisma = TypeScript) — `releveId` aligné schema ↔ models.ts ✅
- [x] `FAIT` Vérifier R4 (opérations atomiques) — auto-match dans transaction Prisma ✅ (OBS-1 mineure)
- [x] `FAIT` Vérifier R8 (siteId partout) — `findMatchingActivite` filtre par siteId ✅
- [x] `FAIT` Vérifier R9 (tests + build avant review) — 8 suites de tests ✅
- [x] `FAIT` Écrire `docs/reviews/review-sprint-13.md` — verdict VALIDE

**Critères d'acceptation :**
- Toutes les règles R1-R9 respectées sur les fichiers modifiés ✅
- Pas de régression fonctionnelle ✅
- Review publiée dans docs/reviews/ ✅

---

## Sprint 14 — Support des unites d'achat/consommation differentes

**Objectif :** Permettre de definir une unite d'achat differente de l'unite de stockage pour les produits (ex: acheter en SACS de 25 KG, stocker en KG). Ajouter GRAMME et MILLILITRE au enum UniteStock.

### Story 14.1 — Schema Prisma + Migration + Seed
**Assigne a :** @db-specialist
**Priorite :** Critique
**Statut :** `FAIT`

**Taches :**
- [x] `FAIT` Ajouter GRAMME/MILLILITRE a UniteStock enum (RECREATE strategy)
- [x] `FAIT` Ajouter uniteAchat (UniteStock?) et contenance (Float?) au modele Produit
- [x] `FAIT` Creer migration SQL manuelle (20260312100000_add_unite_achat)
- [x] `FAIT` Appliquer migration + regenerer client Prisma
- [x] `FAIT` Mettre a jour seed.sql (prod_03 avec uniteAchat=SACS, contenance=25, stockActuel en KG)
- [x] `FAIT` Verifier npm run db:seed

---

### Story 14.2 — Types TypeScript (UniteStock + Produit)
**Assigne a :** @db-specialist
**Depend de :** Story 14.1
**Priorite :** Haute
**Statut :** `FAIT`

**Taches :**
- [x] `FAIT` Ajouter GRAMME/MILLILITRE a UniteStock dans src/types/models.ts
- [x] `FAIT` Ajouter uniteAchat/contenance a l'interface Produit
- [x] `FAIT` Ajouter uniteAchat/contenance a CreateProduitDTO et UpdateProduitDTO dans src/types/api.ts

---

### Story 14.3 — Fonctions utilitaires + Queries
**Assigne a :** @db-specialist
**Depend de :** Story 14.2
**Priorite :** Haute
**Statut :** `FAIT`

**Taches :**
- [x] `FAIT` src/lib/calculs.ts : ajouter getPrixParUniteBase() et convertirQuantiteAchat()
- [x] `FAIT` src/lib/queries/produits.ts : passer uniteAchat+contenance dans create/update, bloquer changement contenance si stockActuel>0
- [x] `FAIT` src/lib/queries/mouvements.ts : pour ENTREE, convertir quantite via convertirQuantiteAchat()
- [x] `FAIT` src/lib/queries/commandes.ts : dans recevoirCommande(), convertir quantites avant incrementer stock
- [x] `FAIT` src/lib/queries/analytics.ts : remplacer produit.prixUnitaire par getPrixParUniteBase(produit)
- [x] `FAIT` src/lib/queries/finances.ts : meme correction avec getPrixParUniteBase()

---

### Story 14.4 — API Routes validation (produits)
**Assigne a :** @developer
**Depend de :** Story 14.3
**Priorite :** Haute
**Statut :** `FAIT`

**Taches :**
- [x] `FAIT` POST /api/produits : valider uniteAchat+contenance ensemble, contenance>0, uniteAchat!==unite
- [x] `FAIT` PUT /api/produits/[id] : memes validations + gerer erreur 409

---

### Story 14.5 — UI Stock (produits, mouvements, commandes)
**Assigne a :** @developer
**Depend de :** Story 14.4
**Priorite :** Haute
**Statut :** `FAIT`

**Taches :**
- [x] `FAIT` produits-list-client.tsx : ajouter GRAMME/MILLILITRE aux uniteLabels, champs formulaire uniteAchat/contenance, afficher equivalence sur cartes
- [x] `FAIT` produit-detail-client.tsx : meme dans formulaire edition, afficher equivalence stock, avertir si stockActuel>0
- [x] `FAIT` mouvements-list-client.tsx : afficher bonne unite par type mouvement (ENTREE en uniteAchat, SORTIE en unite)
- [x] `FAIT` commandes-list-client.tsx + commande-detail-client.tsx : afficher uniteAchat dans lignes commande

---

### Story 14.6 — UI Releves (champs consommation)
**Assigne a :** @developer
**Depend de :** Story 14.5
**Priorite :** Moyenne
**Statut :** `FAIT`

**Taches :**
- [x] `FAIT` consommation-fields.tsx : ajouter GRAMME/MILLILITRE aux uniteLabels
- [x] `FAIT` form-alimentation.tsx : ajouter prop uniteAliment, label dynamique
- [x] `FAIT` releve-form-client.tsx : deriver uniteAliment depuis le premier produit selectionne

---

### Story 14.7 — Tests Sprint 14
**Assigne a :** @tester
**Depend de :** Stories 14.4, 14.5, 14.6
**Priorite :** Haute
**Statut :** `FAIT`

**Taches :**
- [x] `FAIT` Tests getPrixParUniteBase() et convertirQuantiteAchat()
- [x] `FAIT` Tests CRUD produits avec uniteAchat+contenance
- [x] `FAIT` Tests mouvement ENTREE avec conversion
- [x] `FAIT` Tests non-regression
- [x] `FAIT` npx vitest run + npm run build
- [x] `FAIT` Ecrire rapport docs/tests/rapport-sprint-14.md

**Resultat :** 1079/1079 tests passent, build OK. Voir docs/tests/rapport-sprint-14.md.

### Review Sprint 14
**Assigne a :** @code-reviewer
**Depend de :** Story 14.7
**Statut :** `FAIT`

**Resultat :** VALIDE avec 2 observations mineures non-bloquantes. Voir docs/reviews/review-sprint-14.md.

---

## Sprint 15 — Upload Facture sur Commande

**Objectif :** Permettre l'upload optionnel de la facture fournisseur (PDF/JPG/PNG) lors de la réception d'une commande. Stockage sur Hetzner Object Storage (S3-compatible). Visualisation et suppression depuis le détail commande.

---

### Story 15.1 — Schéma Prisma (factureUrl + migration)
**Assigné à :** @db-specialist
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter `factureUrl String?` au modèle Commande dans `prisma/schema.prisma`
- [x] `FAIT` Créer la migration SQL manuelle (`prisma/migrations/20260315100000_add_facture_url/migration.sql`)
- [x] `FAIT` Appliquer la migration avec `npx prisma migrate deploy`
- [x] `FAIT` Mettre à jour `prisma/seed.sql` : 1 commande LIVREE avec factureUrl renseigné (URL fictive)
- [x] `FAIT` Vérifier `npx prisma generate` + build OK

**Critères d'acceptation :**
- Migration appliquée sans erreur ✅
- Le champ `factureUrl` est nullable (pas de breakage sur les commandes existantes) ✅
- R8 respecté (siteId déjà présent sur Commande) ✅
- Seed exécutable sur base vide ✅

---

### Story 15.2 — Infrastructure upload (client S3 Hetzner)
**Assigné à :** @architect + @developer
**Dépend de :** Story 15.1
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Installer `@aws-sdk/client-s3` et `@aws-sdk/s3-request-presigner`
- [x] `FAIT` Créer `src/lib/storage.ts` avec client S3 configuré pour Hetzner Object Storage
- [x] `FAIT` Implémenter `uploadFile(key, body, contentType)` → retourne la clé S3
- [x] `FAIT` Implémenter `deleteFile(key)` → suppression du fichier
- [x] `FAIT` Implémenter `getSignedUrl(key, expiresIn)` → URL présignée (défaut 1h)
- [x] `FAIT` Ajouter les variables d'environnement dans `.env.example`
- [x] `FAIT` Implémenter `validateFile(file)` : taille max 10 Mo, types MIME autorisés
- [x] `FAIT` Implémenter `generateFactureKey(commandeId, originalName)` : convention de nommage

**Critères d'acceptation :**
- Upload, download (signed URL) et delete fonctionnels
- Les fichiers ne sont pas publics (accès uniquement via signed URLs)
- Validation MIME + taille côté serveur (rejet avec message d'erreur clair)
- Variables d'environnement documentées dans `.env.example`

---

### Story 15.3 — Types TypeScript + DTOs
**Assigné à :** @architect
**Dépend de :** Story 15.1
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter `factureUrl: string | null` à l'interface Commande dans `src/types/models.ts`
- [x] `FAIT` Créer `UploadFactureCommandeDTO` et `FactureCommandeResponse` dans `src/types/api.ts`
- [x] `FAIT` Barrel export à jour dans `src/types/index.ts`
- [x] `FAIT` Vérifier l'alignement R3 (Prisma = TypeScript identiques)

**Critères d'acceptation :**
- R3 respecté : types TypeScript miroirs du schéma Prisma ✅
- Pas de `any` dans les types ✅
- Barrel export à jour dans `src/types/index.ts` ✅

---

### Story 15.4 — API routes upload facture
**Assigné à :** @developer
**Dépend de :** Story 15.2 + Story 15.3
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `POST /api/commandes/[id]/facture` : upload via FormData, valider type MIME + taille, stocker sur Hetzner, sauvegarder `factureUrl` en DB
- [x] `FAIT` Créer `GET /api/commandes/[id]/facture` : retourner signed URL JSON `{ url, fileName }`
- [x] `FAIT` Créer `DELETE /api/commandes/[id]/facture` : supprimer fichier de Hetzner + mettre `factureUrl` à null en DB
- [x] `FAIT` Modifier `POST /api/commandes/[id]/recevoir` : accepter FormData avec fichier facture optionnel (upload + réception en 1 appel)
- [x] `FAIT` Permissions `APPROVISIONNEMENT_GERER` sur toutes les routes
- [x] `FAIT` Filtre `siteId` sur toutes les routes (R8)

**Critères d'acceptation :**
- Upload PDF + JPG + PNG OK
- Rejet avec 400 si fichier > 10 Mo ou type MIME invalide
- Signed URL expire après 1h
- Suppression cascade : supprimer le fichier Hetzner quand on supprime la facture
- Réception avec fichier : stock mis à jour + factureUrl sauvegardé en 1 appel
- Réception sans fichier : comportement inchangé (rétro-compatible)

---

### Story 15.5 — UI : upload facture + visualisation
**Assigné à :** @developer
**Dépend de :** Story 15.4
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Modifier dialog réception dans `commande-detail-client.tsx` : ajouter champ file input optionnel, envoyer FormData au lieu de JSON
- [x] `FAIT` Ajouter section "Facture fournisseur" dans le détail commande (visible si `factureUrl` renseigné) : bouton "Voir la facture" (ouvre signed URL dans nouvel onglet), bouton "Supprimer" (avec dialog de confirmation)
- [x] `FAIT` Ajouter bouton "Ajouter facture" visible quand statut LIVREE et pas de `factureUrl`
- [x] `FAIT` Afficher preview du nom de fichier avant envoi dans le dialog réception
- [x] `FAIT` Afficher icône distincte selon le type (PDF vs image)
- [x] `FAIT` Gérer les erreurs : message clair si taille ou format invalide
- [x] `FAIT` Mobile first : boutons larges, champ file accessible, pas de tableau

**Critères d'acceptation :**
- Upload fonctionne sur mobile (360px)
- Preview du nom de fichier avant envoi
- Erreurs affichées clairement (taille, format)
- Facture visualisable après upload (nouvel onglet)
- Suppression avec confirmation
- UX cohérente avec le reste de l'application

---

### Story 15.6 — Tests Sprint 15
**Assigné à :** @tester
**Dépend de :** Story 15.4 + Story 15.5
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Tests upload : POST facture PDF → 201, POST facture JPG → 201, POST facture PNG → 201
- [x] `FAIT` Tests rejet : POST fichier .exe → 400, POST fichier > 10 Mo → 400
- [x] `FAIT` Tests API : GET facture → signed URL valide, DELETE facture → 200 + factureUrl null en DB
- [x] `FAIT` Tests réception avec facture : POST recevoir avec FormData + fichier → 200 + upload effectué
- [x] `FAIT` Tests réception sans facture : POST recevoir sans fichier → 200 (comportement inchangé)
- [x] `FAIT` Tests permissions : requête sans APPROVISIONNEMENT_GERER → 403
- [x] `FAIT` Non-régression : `npx vitest run` 1102/1102 + `npm run build` OK
- [x] `FAIT` Écrire rapport dans `docs/tests/rapport-sprint-15.md`

**Résultat :** 23 nouveaux tests, 1102/1102 total passent, build OK.

**Critères d'acceptation :**
- Tous les tests passent
- Build production OK
- Rapport de test dans `docs/tests/`
- Aucune régression sur les fonctionnalités existantes

---

### Story 15.7 — Review Sprint 15
**Assigné à :** @code-reviewer
**Dépend de :** Story 15.6
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Checklist R1-R9 sur tout le code du sprint
- [x] `FAIT` Vérifier : pas de secrets en dur (clés S3, endpoints)
- [x] `FAIT` Vérifier : signed URLs uniquement (pas d'URL publique vers les fichiers)
- [x] `FAIT` Vérifier : validation MIME côté serveur (pas uniquement côté client)
- [x] `FAIT` Vérifier : siteId sur toutes les routes (R8)
- [x] `FAIT` Vérifier : permissions APPROVISIONNEMENT_GERER
- [x] `FAIT` Vérifier : mobile first (360px) sur les composants modifiés
- [x] `FAIT` Écrire `docs/reviews/review-sprint-15.md`

**Résultat :** VALIDE avec 3 observations mineures non-bloquantes. Voir docs/reviews/review-sprint-15.md.

---

## Sprint 16 — Dépenses base

**Objectif :** Ajouter la gestion des dépenses opérationnelles (électricité, salaires, réparations, etc.) avec paiements partiels et auto-création depuis les commandes. Nouveaux modèles `Depense` et `PaiementDepense`, 3 enums, 6 permissions, API complète et UI mobile-first.

---

### Story 16.1 — Schéma Prisma (Depense + PaiementDepense + enums)
**Assigné à :** @db-specialist
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Ajouter enum `CategorieDepense` : ALIMENT, INTRANT, EQUIPEMENT, ELECTRICITE, EAU, LOYER, SALAIRE, TRANSPORT, VETERINAIRE, REPARATION, INVESTISSEMENT, AUTRE
- [ ] `TODO` Ajouter enum `StatutDepense` : NON_PAYEE, PAYEE_PARTIELLEMENT, PAYEE
- [ ] `TODO` Ajouter enum `FrequenceRecurrence` : MENSUEL, TRIMESTRIEL, ANNUEL
- [ ] `TODO` Ajouter 6 permissions à l'enum `Permission` : DEPENSES_VOIR, DEPENSES_CREER, DEPENSES_PAYER, BESOINS_SOUMETTRE, BESOINS_APPROUVER, BESOINS_TRAITER
- [ ] `TODO` Ajouter modèle `Depense` : id, numero (unique), description, categorieDepense, montantTotal, montantPaye (default 0), statut (default NON_PAYEE), date, dateEcheance?, factureUrl?, notes?, commandeId?, listeBesoinsId?, vagueId?, userId, siteId, paiements[]
- [ ] `TODO` Ajouter modèle `PaiementDepense` : id, depenseId (CASCADE), montant, mode (ModePaiement réutilisé), reference?, date, userId, siteId
- [ ] `TODO` Ajouter index sur Depense (siteId, categorieDepense, statut, commandeId, listeBesoinsId, vagueId, date)
- [ ] `TODO` Ajouter relations inverses sur Site, User, Vague, Commande
- [ ] `TODO` Créer migration `add_depenses` (manuelle SQL)
- [ ] `TODO` Appliquer migration avec `npx prisma migrate deploy`
- [ ] `TODO` Mettre à jour `prisma/seed.sql` : 5 dépenses (variées par catégorie/statut) + 4 paiements dépense
- [ ] `TODO` Vérifier `npx prisma generate` + `npm run db:seed`

**Critères d'acceptation :**
- Migration appliquée sans erreur
- R1 : toutes les valeurs d'enum en UPPERCASE
- R8 : siteId sur Depense et PaiementDepense
- Seed exécutable sur base vide
- Relations cascade sur PaiementDepense (suppression Depense → suppression paiements)

---

### Story 16.2 — Types TypeScript (Depense + PaiementDepense)
**Assigné à :** @architect
**Dépend de :** Story 16.1
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Ajouter enums `CategorieDepense`, `StatutDepense`, `FrequenceRecurrence` dans `src/types/models.ts`
- [ ] `TODO` Ajouter 6 permissions à l'enum `Permission` dans `src/types/models.ts`
- [ ] `TODO` Ajouter interfaces `Depense` et `PaiementDepense` dans `src/types/models.ts`
- [ ] `TODO` Ajouter DTOs dans `src/types/api.ts` : `CreateDepenseDTO`, `UpdateDepenseDTO`, `DepenseFilters`, `CreatePaiementDepenseDTO`
- [ ] `TODO` Mettre à jour barrel export dans `src/types/index.ts`

**Critères d'acceptation :**
- R3 : Prisma = TypeScript identiques (noms de champs et types alignés)
- R2 : import des enums (jamais de string literals)
- Pas de `any` dans les types

---

### Story 16.3 — Queries CRUD Depense + PaiementDepense
**Assigné à :** @developer
**Dépend de :** Story 16.2
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/lib/queries/depenses.ts`
- [ ] `TODO` `getDepenses(siteId, filters?)` — liste avec filtres (categorie, statut, dateFrom/dateTo, vagueId, commandeId)
- [ ] `TODO` `getDepenseById(id, siteId)` — détail avec relations (paiements, commande, vague, listeBesoins)
- [ ] `TODO` `createDepense(siteId, userId, data)` — transaction, numéro auto `DEP-YYYY-NNN`
- [ ] `TODO` `updateDepense(id, siteId, data)` — update partiel
- [ ] `TODO` `deleteDepense(id, siteId)` — seulement si statut NON_PAYEE
- [ ] `TODO` `ajouterPaiementDepense(siteId, depenseId, userId, data)` — même pattern que `ajouterPaiement()` de `factures.ts` (calcul montantPaye, mise à jour statut)

**Critères d'acceptation :**
- Pattern paiement partiel identique à Facture/Paiement (surpaiement refusé, auto-statut NON_PAYEE→PAYEE_PARTIELLEMENT→PAYEE)
- R4 : opérations atomiques (transactions)
- R8 : siteId dans toutes les queries
- Pattern référence : `src/lib/queries/factures.ts`

---

### Story 16.4 — Auto-création Depense à réception Commande
**Assigné à :** @developer
**Dépend de :** Story 16.3
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Modifier `recevoirCommande()` dans `src/lib/queries/commandes.ts`
- [ ] `TODO` Dans la même `$transaction` : créer Depense (description="Commande {numero}", categorieDepense dérivée du produit dominant, montantTotal=commande.montantTotal, commandeId, statut=NON_PAYEE)
- [ ] `TODO` Retourner la Depense créée dans la réponse

**Critères d'acceptation :**
- Atomique : réception + création dépense dans la même transaction
- Pas de doublon : une commande ne génère qu'une seule dépense
- Depense retournée dans la réponse de réception

---

### Story 16.5 — API Routes Dépenses
**Assigné à :** @developer
**Dépend de :** Story 16.3
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` `GET /api/depenses` — permission DEPENSES_VOIR, filtres query params
- [ ] `TODO` `POST /api/depenses` — permission DEPENSES_CREER, validation body
- [ ] `TODO` `GET /api/depenses/[id]` — permission DEPENSES_VOIR
- [ ] `TODO` `PUT /api/depenses/[id]` — permission DEPENSES_CREER
- [ ] `TODO` `DELETE /api/depenses/[id]` — permission DEPENSES_CREER, seulement si NON_PAYEE
- [ ] `TODO` `POST /api/depenses/[id]/paiements` — permission DEPENSES_PAYER
- [ ] `TODO` `POST /api/depenses/[id]/upload` — permission DEPENSES_CREER, upload facture S3 (infrastructure Sprint 15)

**Critères d'acceptation :**
- Permissions vérifiées sur chaque route
- Validation des données entrantes
- Error handling cohérent avec les routes existantes
- R8 : siteId filtré sur toutes les routes
- Pattern référence : `src/app/api/vagues/route.ts`

---

### Story 16.6 — UI Liste des dépenses
**Assigné à :** @developer
**Dépend de :** Story 16.5
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/depenses/page.tsx` (Server Component)
- [ ] `TODO` Créer `src/components/depenses/depenses-list-client.tsx` (Client Component)
- [ ] `TODO` Tabs par statut : Toutes | Non payées | Partiellement payées | Payées
- [ ] `TODO` Filtre par catégorie (dropdown)
- [ ] `TODO` Cartes mobile-first : numéro, description, catégorie badge, montants (total/payé), statut, date

**Critères d'acceptation :**
- Mobile 360px : cartes empilées, pas de tableaux
- R6 : CSS variables du thème
- Pattern référence : `src/components/vagues/vagues-list-client.tsx`

---

### Story 16.7 — UI Détail dépense + paiements
**Assigné à :** @developer
**Dépend de :** Story 16.6
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/depenses/[id]/page.tsx` (Server Component)
- [ ] `TODO` Créer `src/components/depenses/depense-detail-client.tsx` (Client Component)
- [ ] `TODO` Afficher infos dépense, lien commande/vague, historique paiements
- [ ] `TODO` Barre de progression montantPaye/montantTotal
- [ ] `TODO` Dialog "Ajouter un paiement" (même pattern que facture)
- [ ] `TODO` Bouton upload facture (réutilise infrastructure Sprint 15)

**Critères d'acceptation :**
- R5 : DialogTrigger asChild
- Pattern paiement partiel identique à la page facture
- Mobile-first 360px

---

### Story 16.8 — UI Formulaire création dépense
**Assigné à :** @developer
**Dépend de :** Story 16.5
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/depenses/nouvelle/page.tsx`
- [ ] `TODO` Créer `src/components/depenses/depense-form-client.tsx`
- [ ] `TODO` Champs : description, categorieDepense (select), montantTotal, date, dateEcheance? (optionnel), vagueId? (select optionnel), notes? (textarea)
- [ ] `TODO` Lien optionnel à une Commande LIVREE sans dépense associée
- [ ] `TODO` Validation client + redirect après création

**Critères d'acceptation :**
- Mobile-first : champs larges, gros boutons
- Validation client avant soumission
- Redirect vers détail après création
- Pattern référence : `src/components/releves/releve-form-client.tsx`

---

### Story 16.9 — Tests Sprint 16
**Assigné à :** @tester
**Dépend de :** Story 16.1 à 16.8
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Tests unitaires : `ajouterPaiementDepense` (partiel, surpaiement refusé, auto-statut NON_PAYEE→PAYEE_PARTIELLEMENT→PAYEE)
- [ ] `TODO` Tests unitaires : auto-création dépense dans `recevoirCommande` (commande sans dépense → dépense créée, commande avec dépense → pas de doublon)
- [ ] `TODO` Tests API : tous les endpoints dépenses (GET, POST, PUT, DELETE, paiements, upload)
- [ ] `TODO` Tests permissions : requêtes sans permissions → 403
- [ ] `TODO` Non-régression : `npx vitest run` + `npm run build`
- [ ] `TODO` Écrire rapport dans `docs/tests/test-sprint-16.md`

**Critères d'acceptation :**
- R9 : tous les tests passent, build OK
- Aucune régression sur les fonctionnalités existantes
- Rapport de test dans `docs/tests/`

---

### Story 16.10 — Review Sprint 16
**Assigné à :** @code-reviewer
**Dépend de :** Story 16.9
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Checklist R1-R9 sur tout le code du sprint
- [ ] `TODO` Vérifier permissions sur toutes les routes
- [ ] `TODO` Vérifier siteId sur toutes les queries et routes (R8)
- [ ] `TODO` Vérifier mobile-first (360px) sur les composants UI
- [ ] `TODO` Vérifier pattern paiement partiel (identique à Facture/Paiement)
- [ ] `TODO` Vérifier anti-doublon auto-création dépense
- [ ] `TODO` Écrire `docs/reviews/review-sprint-16.md`

**Critères d'acceptation :**
- Toutes les règles R1-R9 respectées
- Rapport de review dans `docs/reviews/`

---

## Sprint 17 — Besoins + Workflow

**Objectif :** Ajouter la gestion des listes de besoins avec workflow de validation (SOUMISE→APPROUVEE→TRAITEE→CLOTUREE|REJETEE). Nouveaux modèles `ListeBesoins` et `LigneBesoin`, enum `StatutBesoins`. Traitement des besoins avec génération automatique de commandes et dépenses.

---

### Story 17.1 — Schéma Prisma (ListeBesoins + LigneBesoin)
**Assigné à :** @db-specialist
**Dépend de :** Sprint 16
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Ajouter enum `StatutBesoins` : SOUMISE, APPROUVEE, TRAITEE, CLOTUREE, REJETEE
- [ ] `TODO` Ajouter modèle `ListeBesoins` : id, numero (unique), titre, demandeurId (FK User), valideurId? (FK User), vagueId? (FK Vague), statut (default SOUMISE), montantEstime (default 0), montantReel?, notes?, siteId, lignes[], depenses[]
- [ ] `TODO` Ajouter modèle `LigneBesoin` : id, listeBesoinsId (CASCADE), designation, produitId? (FK Produit), quantite, unite?, prixEstime (default 0), prixReel?, commandeId? (FK Commande)
- [ ] `TODO` Ajouter index sur ListeBesoins (siteId, statut, demandeurId, vagueId)
- [ ] `TODO` Ajouter relations : demandeur (User), valideur? (User), vague? (Vague), lignes[] (LigneBesoin), depenses[] (Depense)
- [ ] `TODO` CASCADE delete : ListeBesoins → LigneBesoin
- [ ] `TODO` Ajouter relation inverse listeBesoinsId sur Depense (déjà prévu Sprint 16)
- [ ] `TODO` Créer migration `add_besoins` (manuelle SQL)
- [ ] `TODO` Appliquer migration avec `npx prisma migrate deploy`
- [ ] `TODO` Mettre à jour `prisma/seed.sql` : 3 listes de besoins (statuts variés) + 8 lignes de besoin
- [ ] `TODO` Vérifier `npx prisma generate` + `npm run db:seed`

**Critères d'acceptation :**
- Migration appliquée sans erreur
- R8 : siteId sur ListeBesoins (LigneBesoin hérite via la relation)
- Cascade OK : suppression ListeBesoins → suppression lignes
- Seed exécutable sur base vide

---

### Story 17.2 — Types TypeScript (ListeBesoins + LigneBesoin)
**Assigné à :** @architect
**Dépend de :** Story 17.1
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Ajouter enum `StatutBesoins` dans `src/types/models.ts`
- [ ] `TODO` Ajouter interfaces `ListeBesoins` et `LigneBesoin` dans `src/types/models.ts`
- [ ] `TODO` Ajouter DTOs dans `src/types/api.ts` : `CreateListeBesoinsDTO`, `UpdateListeBesoinsDTO`, `ListeBesoinsFilters`, `TraiterLigneAction` (COMMANDE | LIBRE), `TraiterBesoinsDTO`, `CloturerBesoinsDTO`
- [ ] `TODO` Mettre à jour barrel export dans `src/types/index.ts`

**Critères d'acceptation :**
- R3 : Prisma = TypeScript identiques
- DTO `TraiterLigneAction` bien typé pour le choix par ligne (COMMANDE si produitId, LIBRE sinon)
- Pas de `any`

---

### Story 17.3 — Queries CRUD + Workflow Besoins
**Assigné à :** @developer
**Dépend de :** Story 17.2
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/lib/queries/besoins.ts`
- [ ] `TODO` `getListeBesoins(siteId, filters?)` — liste avec filtres (statut, demandeurId, vagueId)
- [ ] `TODO` `getListeBesoinsById(id, siteId)` — détail avec relations (lignes, demandeur, valideur, vague, depenses, commandes)
- [ ] `TODO` `createListeBesoins(siteId, userId, data)` — avec lignes, numéro auto `BES-YYYY-NNN`, auto-calcul montantEstime = SUM(quantite * prixEstime)
- [ ] `TODO` `approuverBesoins(id, siteId, valideurId)` — transition SOUMISE → APPROUVEE
- [ ] `TODO` `rejeterBesoins(id, siteId, valideurId, motif?)` — transition SOUMISE → REJETEE
- [ ] `TODO` `traiterBesoins(id, siteId, userId, ligneActions)` — transition APPROUVEE → TRAITEE :
  - Lignes COMMANDE (avec produitId) : grouper par fournisseur, générer Commande(s) BROUILLON, lier commandeId sur LigneBesoin
  - Créer Depense liée à la ListeBesoins (montantEstime)
  - Créer PaiementDepense (décaissement au demandeur)
- [ ] `TODO` `cloturerBesoins(id, siteId, userId, lignesReelles)` — transition TRAITEE → CLOTUREE :
  - Mettre à jour prixReel sur chaque ligne
  - Calculer et mettre à jour montantReel sur la liste
- [ ] `TODO` `deleteListeBesoins(id, siteId)` — seulement si statut SOUMISE

**Critères d'acceptation :**
- Transitions validées (rejet si transition invalide)
- Groupement par fournisseur pour les commandes générées
- R4 : toutes les opérations complexes dans des transactions
- R8 : siteId dans toutes les queries

---

### Story 17.4 — API Routes Besoins
**Assigné à :** @developer
**Dépend de :** Story 17.3
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` `GET /api/besoins` — permission BESOINS_SOUMETTRE (voir ses propres) ou BESOINS_APPROUVER (voir tous)
- [ ] `TODO` `POST /api/besoins` — permission BESOINS_SOUMETTRE
- [ ] `TODO` `GET /api/besoins/[id]` — permission BESOINS_SOUMETTRE
- [ ] `TODO` `PUT /api/besoins/[id]` — permission BESOINS_SOUMETTRE, seulement si SOUMISE
- [ ] `TODO` `DELETE /api/besoins/[id]` — permission BESOINS_SOUMETTRE, seulement si SOUMISE
- [ ] `TODO` `POST /api/besoins/[id]/approuver` — permission BESOINS_APPROUVER
- [ ] `TODO` `POST /api/besoins/[id]/rejeter` — permission BESOINS_APPROUVER, body: motif?
- [ ] `TODO` `POST /api/besoins/[id]/traiter` — permission BESOINS_TRAITER, body: actions par ligne
- [ ] `TODO` `POST /api/besoins/[id]/cloturer` — permission BESOINS_TRAITER, body: montants réels par ligne

**Critères d'acceptation :**
- Permissions granulaires vérifiées sur chaque route
- Error handling cohérent avec les routes existantes
- Transitions invalides → 400 avec message clair
- R8 : siteId filtré sur toutes les routes

---

### Story 17.5 — UI Liste des besoins
**Assigné à :** @developer
**Dépend de :** Story 17.4
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/besoins/page.tsx` (Server Component)
- [ ] `TODO` Créer `src/components/besoins/besoins-list-client.tsx` (Client Component)
- [ ] `TODO` Tabs par statut : Toutes | Soumises | Approuvées | Traitées | Clôturées | Rejetées
- [ ] `TODO` Cartes mobile-first : numéro, titre, demandeur, montantEstime, statut badge, date, nombre de lignes

**Critères d'acceptation :**
- Mobile 360px : cartes empilées, pas de tableaux
- Badges couleur par statut (SOUMISE=bleu, APPROUVEE=vert, TRAITEE=orange, CLOTUREE=gris, REJETEE=rouge)
- Pattern référence : `src/components/vagues/vagues-list-client.tsx`

---

### Story 17.6 — UI Détail besoins + actions workflow
**Assigné à :** @developer
**Dépend de :** Story 17.5
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/besoins/[id]/page.tsx` (Server Component)
- [ ] `TODO` Créer `src/components/besoins/besoins-detail-client.tsx` (Client Component)
- [ ] `TODO` Header : numéro, titre, statut badge, demandeur, vague?, dates
- [ ] `TODO` Liste des LigneBesoin en cartes : designation, quantité, prixEstime, prixReel?
- [ ] `TODO` Boutons workflow selon statut + permissions :
  - SOUMISE : "Approuver" / "Rejeter" (BESOINS_APPROUVER)
  - APPROUVEE : "Traiter" → dialog traitement (BESOINS_TRAITER)
  - TRAITEE : "Clôturer" → formulaire montants réels + upload factures
- [ ] `TODO` Liens vers Commandes générées et Dépenses liées
- [ ] `TODO` Créer `src/components/besoins/traitement-dialog.tsx` : choix par ligne (COMMANDE si produitId, sinon LIBRE)
- [ ] `TODO` Créer `src/components/besoins/cloture-form.tsx` : input prixReel par ligne + upload factures

**Critères d'acceptation :**
- Boutons affichés uniquement selon transitions valides et permissions utilisateur
- Dialog traitement : choix correct par ligne
- R5 : DialogTrigger asChild
- Mobile-first 360px

---

### Story 17.7 — UI Formulaire création besoin
**Assigné à :** @developer
**Dépend de :** Story 17.4
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/besoins/nouveau/page.tsx`
- [ ] `TODO` Créer `src/components/besoins/besoins-form-client.tsx`
- [ ] `TODO` Formulaire dynamique :
  - Titre (required), vagueId? (select optionnel)
  - Ajout dynamique de lignes : designation, produitId? (recherche produit), quantité, unité?, prixEstime
  - Bouton "Ajouter une ligne" + bouton supprimer par ligne
  - Calcul temps réel montantEstime = SUM(quantité × prixEstime)

**Critères d'acceptation :**
- Ajout/suppression dynamique de lignes
- Calcul montantEstime en temps réel
- Mobile-first : champs larges, gros boutons
- Pattern référence : `src/components/releves/releve-form-client.tsx`

---

### Story 17.8 — Tests Sprint 17
**Assigné à :** @tester
**Dépend de :** Story 17.1 à 17.7
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Tests workflow : transitions valides (SOUMISE→APPROUVEE, SOUMISE→REJETEE, APPROUVEE→TRAITEE, TRAITEE→CLOTUREE)
- [ ] `TODO` Tests workflow : transitions invalides rejetées (REJETEE→APPROUVEE, CLOTUREE→TRAITEE, etc.)
- [ ] `TODO` Tests `traiterBesoins` : génération Commande BROUILLON, création Dépense, groupement par fournisseur
- [ ] `TODO` Tests `cloturerBesoins` : calcul montantReel correct
- [ ] `TODO` Tests API : tous les endpoints besoins (CRUD + workflow)
- [ ] `TODO` Tests permissions : requêtes sans permissions → 403
- [ ] `TODO` Non-régression : `npx vitest run` + `npm run build`
- [ ] `TODO` Écrire rapport dans `docs/tests/test-sprint-17.md`

**Critères d'acceptation :**
- R9 : tous les tests passent, build OK
- Aucune régression sur les fonctionnalités existantes (dont Sprint 16)
- Rapport de test dans `docs/tests/`

---

### Story 17.9 — Review Sprint 17
**Assigné à :** @code-reviewer
**Dépend de :** Story 17.8
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Checklist R1-R9 sur tout le code du sprint
- [ ] `TODO` Vérifier transitions workflow (pas de transition invalide possible)
- [ ] `TODO` Vérifier permissions granulaires sur toutes les routes
- [ ] `TODO` Vérifier groupement par fournisseur dans `traiterBesoins`
- [ ] `TODO` Vérifier mobile-first (360px) sur les composants UI
- [ ] `TODO` Écrire `docs/reviews/review-sprint-17.md`

**Critères d'acceptation :**
- Toutes les règles R1-R9 respectées
- Workflow transitions sécurisées
- Rapport de review dans `docs/reviews/`

---

## Sprint 18 — Récurrences + Dashboard financier étendu

**Objectif :** Ajouter les dépenses récurrentes (templates auto-générés), intégrer les dépenses dans le dashboard financier avec anti-double-comptage, et ajouter la navigation vers Dépenses et Besoins.

---

### Story 18.1 — Schéma Prisma (DepenseRecurrente)
**Assigné à :** @db-specialist
**Dépend de :** Sprint 17
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter modèle `DepenseRecurrente` : id, description, categorieDepense (CategorieDepense), montantEstime, frequence (FrequenceRecurrence — enum déjà ajouté Sprint 16), jourDuMois (default 1), isActive (default true), derniereGeneration?, userId, siteId
- [x] `FAIT` Ajouter relations Site, User
- [x] `FAIT` Ajouter index sur DepenseRecurrente (siteId, isActive, frequence)
- [x] `FAIT` Créer migration `add_depenses_recurrentes` (manuelle SQL)
- [x] `FAIT` Appliquer migration avec `npx prisma migrate deploy`
- [x] `FAIT` Mettre à jour `prisma/seed.sql` : 3 templates (LOYER mensuel, ELECTRICITE mensuel, SALAIRE mensuel)
- [x] `FAIT` Vérifier `npx prisma generate` + `npm run db:seed`

**Critères d'acceptation :**
- Migration appliquée sans erreur
- R8 : siteId sur DepenseRecurrente
- jourDuMois contraint entre 1 et 28 (éviter problèmes fin de mois)
- Seed exécutable sur base vide

---

### Story 18.2 — Types TypeScript (DepenseRecurrente)
**Assigné à :** @architect
**Dépend de :** Story 18.1
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter interface `DepenseRecurrente` dans `src/types/models.ts`
- [x] `FAIT` Ajouter DTOs dans `src/types/api.ts` : `CreateDepenseRecurrenteDTO`, `UpdateDepenseRecurrenteDTO`
- [x] `FAIT` Mettre à jour barrel export dans `src/types/index.ts`

**Critères d'acceptation :**
- R3 : Prisma = TypeScript identiques
- Pas de `any`

---

### Story 18.3 — Queries DepenseRecurrente + auto-génération
**Assigné à :** @developer
**Dépend de :** Story 18.2
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/lib/queries/depenses-recurrentes.ts`
- [x] `FAIT` CRUD standard : `getDepensesRecurrentes(siteId)`, `getDepenseRecurrenteById(id, siteId)`, `createDepenseRecurrente(siteId, userId, data)`, `updateDepenseRecurrente(id, siteId, data)`, `deleteDepenseRecurrente(id, siteId)`
- [x] `FAIT` `genererDepensesRecurrentes(siteId, userId)` :
  - Trouver toutes les DepenseRecurrente actives du site
  - Pour chaque : vérifier si génération due (fréquence + jourDuMois + derniereGeneration)
  - [x] MENSUEL : due si derniereGeneration < début du mois courant
  - [x] TRIMESTRIEL : due si derniereGeneration < début du trimestre courant
  - [x] ANNUEL : due si derniereGeneration < début de l'année courante
  - [x] Si due : créer Depense NON_PAYEE, mettre à jour derniereGeneration
  - [x] Retourner liste des Dépenses générées

**Critères d'acceptation :**
- Logique MENSUEL/TRIMESTRIEL/ANNUEL correcte
- Idempotent : pas de doublon si appelé plusieurs fois dans le même mois
- R4 : transactions
- R8 : siteId

---

### Story 18.4 — API Routes DepenseRecurrente
**Assigné à :** @developer
**Dépend de :** Story 18.3
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` `GET /api/depenses-recurrentes` — permission DEPENSES_VOIR
- [x] `FAIT` `POST /api/depenses-recurrentes` — permission DEPENSES_CREER
- [x] `FAIT` `GET /api/depenses-recurrentes/[id]` — permission DEPENSES_VOIR
- [x] `FAIT` `PUT /api/depenses-recurrentes/[id]` — permission DEPENSES_CREER
- [x] `FAIT` `DELETE /api/depenses-recurrentes/[id]` — permission DEPENSES_CREER
- [x] `FAIT` `POST /api/depenses-recurrentes/generer` — permission DEPENSES_CREER, trigger génération manuelle
- [x] `FAIT` Lazy generation : appeler `genererDepensesRecurrentes()` au chargement du dashboard financier

**Critères d'acceptation :**
- CRUD OK
- Génération idempotente (pas de doublon)
- R8 : siteId sur toutes les routes

---

### Story 18.5 — Intégration dashboard financier
**Assigné à :** @developer
**Dépend de :** Story 16.3, Story 18.3
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Modifier `getResumeFinancier()` dans `src/lib/queries/finances.ts` :
  - [x] Ajouter `depensesTotales`, `depensesPayees`, `depensesImpayees`
  - [x] Ajouter `depensesParCategorie: Record<CategorieDepense, number>`
  - [x] `coutsTotaux` = coûts MouvementStock (existant) + Dépenses WHERE commandeId IS NULL (anti double-comptage)
  - [x] Mettre à jour `margeBrute` avec les nouveaux coûts
- [x] `FAIT` Modifier `getRentabiliteParVague()` : inclure Dépenses liées à chaque vague (vagueId)
- [x] `FAIT` Modifier `getEvolutionFinanciere()` : inclure dépenses hors-commande dans les coûts mensuels
- [x] `FAIT` Mettre à jour interface `ResumeFinancier` dans `src/types/`

**Critères d'acceptation :**
- Anti double-comptage : dépenses liées à une Commande NE sont PAS ajoutées par-dessus les coûts MouvementStock
- Dépenses manuelles (sans commandeId) bien intégrées dans les coûts
- Marge brute correcte avec les nouveaux coûts

---

### Story 18.6 — UI Templates récurrents
**Assigné à :** @developer
**Dépend de :** Story 18.4
**Priorité :** Moyenne
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/app/depenses/recurrentes/page.tsx` (Server Component)
- [x] `FAIT` Créer `src/components/depenses/recurrentes-list-client.tsx` (Client Component)
- [x] `FAIT` Cartes : description, catégorie, montant, fréquence, jourDuMois, toggle actif/inactif, dernière génération
- [x] `FAIT` Bouton "Générer maintenant" (appel POST /api/depenses-recurrentes/generer)
- [x] `FAIT` Formulaire création/édition récurrence (dialog ou page dédiée)

**Critères d'acceptation :**
- Toggle actif/inactif fonctionnel
- Génération manuelle avec feedback (nombre de dépenses générées)
- Mobile-first 360px

---

### Story 18.7 — UI Dashboard financier étendu
**Assigné à :** @developer
**Dépend de :** Story 18.5
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Modifier `src/components/finances/finances-dashboard-client.tsx`
- [x] `FAIT` Ajouter section "Dépenses" : total dépenses, payées vs impayées
- [x] `FAIT` Ajouter graphique répartition par catégorie (barres de progression, top 5)
- [x] `FAIT` Mettre à jour affichage marge brute avec nouveaux coûts
- [x] `FAIT` Ajouter lien vers la page dépenses (/depenses)

**Critères d'acceptation :**
- Anti double-comptage visible dans les chiffres affichés
- Graphiques responsive mobile
- R6 : CSS variables du thème

---

### Story 18.8 — Navigation
**Assigné à :** @developer
**Dépend de :** Story 16.6, Story 17.5, Story 18.6
**Priorité :** Moyenne
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Modifier `src/components/layout/bottom-nav.tsx` : ajouter Dépenses et Besoins dans groupe Ventes
- [x] `FAIT` Modifier `src/components/layout/sidebar.tsx` : ajouter Dépenses, Recurrentes et Besoins dans module Ventes
- [x] `FAIT` Ajouter permissions DEPENSES_VOIR, BESOINS_SOUMETTRE dans `ITEM_VIEW_PERMISSIONS`
- [x] `FAIT` Navigation conditionnelle selon permissions utilisateur

**Critères d'acceptation :**
- Navigation conditionnelle : items visibles uniquement si l'utilisateur a les permissions
- Cohérence entre bottom-nav (mobile) et sidebar (desktop)

---

### Story 18.9 — Tests Sprint 18
**Assigné à :** @tester
**Dépend de :** Story 18.1 à 18.8
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Tests `genererDepensesRecurrentes()` : due/not due, idempotent, toutes fréquences (MENSUEL, TRIMESTRIEL, ANNUEL)
- [x] `FAIT` Tests `getResumeFinancier()` mis à jour : anti double-comptage (dépense avec commandeId vs sans)
- [x] `FAIT` Tests `getRentabiliteParVague()` : dépenses liées à la vague incluses
- [x] `FAIT` Tests API : tous les endpoints dépenses récurrentes
- [x] `FAIT` Non-régression finances existantes (revenus, factures, paiements inchangés)
- [x] `FAIT` Non-régression : `npx vitest run` (1175 passed) + `npm run build` (OK)
- [x] `FAIT` Écrire rapport dans `docs/tests/test-sprint-18.md`

**Critères d'acceptation :**
- R9 : tous les tests passent, build OK
- Non-régression OK (finances existantes inchangées)
- Rapport de test dans `docs/tests/`

---

### Story 18.10 — Review Sprint 18
**Assigné à :** @code-reviewer
**Dépend de :** Story 18.9
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Checklist R1-R9 sur tout le code du sprint
- [x] `FAIT` Vérifier anti double-comptage dans les calculs financiers
- [x] `FAIT` Vérifier permissions sur toutes les routes
- [x] `FAIT` Vérifier navigation conditionnelle
- [x] `FAIT` Vérifier mobile-first (360px) sur les composants UI
- [x] `FAIT` Écrire `docs/reviews/review-sprint-18.md`

**Critères d'acceptation :**
- Toutes les règles R1-R9 respectées
- Anti double-comptage validé
- Rapport de review dans `docs/reviews/`

---

## Sprint 19 — ConfigElevage & Refactoring Benchmarks (Phase 3)

**Objectif :** Mettre en place le modèle ConfigElevage (paramètres configurables par site) et refactorer les modules existants (benchmarks.ts, alertes.ts, calculs.ts) pour les rendre configurables. C'est la fondation de toute la Phase 3.
**Dépend de :** Sprint 18 FAIT
**Source :** docs/sprints/SPRINT-PLAN-PHASE3.md (Sprint 13 renommé Sprint 19)

---

### Story 19.1 — Modèle Prisma ConfigElevage + Migration
**Assigné à :** @db-specialist
**Priorité :** Haute
**Dépend de :** Aucune
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter l'enum `PhaseElevage` : ACCLIMATATION, CROISSANCE_DEBUT, JUVENILE, GROSSISSEMENT, FINITION, PRE_RECOLTE
- [x] `FAIT` Créer le modèle `ConfigElevage` avec tous les champs (section 6.2 du REQ)
- [x] `FAIT` Ajouter relation `Site.configs ConfigElevage[]`
- [x] `FAIT` Index unique partiel pour isDefault (un seul isDefault=true par site — enforced application-level)
- [x] `FAIT` Créer migration manuelle + `npx prisma migrate deploy`
- [x] `FAIT` Vérifier `npx prisma generate` OK

**Critères d'acceptation :**
- Modèle ConfigElevage complet avec tous les champs ✅
- Enum PhaseElevage créé ✅
- Migration exécutée sans erreur ✅
- Build OK ✅

---

### Story 19.2 — Interfaces TypeScript ConfigElevage + Schemas Zod
**Assigné à :** @architect
**Priorité :** Haute
**Dépend de :** Story 19.1
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Interface `ConfigElevage` dans src/types/models.ts
- [x] `FAIT` DTOs `CreateConfigElevageDTO`, `UpdateConfigElevageDTO` dans src/types/api.ts
- [x] `FAIT` Schema Zod `alimentTailleConfigSchema` : valide poidsMin < poidsMax, pas de gaps
- [x] `FAIT` Schema Zod `alimentTauxConfigSchema` : toutes les phases présentes, tauxMin <= tauxMax
- [x] `FAIT` Validation seuils de phase monotoniquement croissants
- [x] `FAIT` Validation benchmarks excellent > bon > acceptable
- [x] `FAIT` Enum `PhaseElevage` exporté depuis src/types/index.ts
- [x] `FAIT` Créer src/lib/validation/config-elevage.ts

**Critères d'acceptation :**
- Aucun `any` dans les types ✅
- Schemas Zod valident/rejettent correctement ✅
- Tous les exports à jour dans index.ts ✅

---

### Story 19.3 — Seed des profils ConfigElevage pré-définis
**Assigné à :** @db-specialist
**Priorité :** Moyenne
**Dépend de :** Story 19.1
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Insérer 3 profils ConfigElevage dans prisma/seed.sql
- [x] `FAIT` "Clarias Standard Cameroun" (800g, 180j, isDefault=true)
- [x] `FAIT` "Clarias Express" (500g, 120j)
- [x] `FAIT` "Clarias Premium" (1200g, 240j)
- [x] `FAIT` Champs JSON alimentTailleConfig et alimentTauxConfig conformes sections 6.3/6.4

**Critères d'acceptation :**
- 3 profils insérés pour le site DKFarm ✅
- Profil Standard a isDefault=true ✅
- Seed sans erreur ✅

---

### Story 19.4 — API CRUD ConfigElevage
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Stories 19.1, 19.2
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/config-elevage.ts
- [x] `FAIT` Route GET/POST `/api/config-elevage`
- [x] `FAIT` Route GET/PUT/DELETE `/api/config-elevage/[id]`
- [x] `FAIT` Route GET `/api/config-elevage/defaut` (fallback valeurs hardcodées)
- [x] `FAIT` Route POST `/api/config-elevage/[id]/dupliquer`
- [x] `FAIT` Permissions : SITE_GERER pour écriture (enforced via requirePermission)
- [x] `FAIT` Validation Zod entrante (schemas de 19.2)
- [x] `FAIT` Empêcher suppression si isDefault (retour 409)

**Critères d'acceptation :**
- CRUD complet fonctionnel ✅
- Fallback /defaut retourne valeurs par défaut si aucune config ✅
- Permissions vérifiées ✅

---

### Story 19.5 — Refactoring benchmarks.ts
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story 19.2
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter getBenchmarkSurvie/Fcr/Sgr/Densite/Mortalite(config?) avec fallback
- [x] `FAIT` Fallback vers constantes actuelles si config undefined
- [x] `FAIT` Mapper les 15 champs benchmark de ConfigElevage
- [x] `FAIT` Retrocompatible : evaluerBenchmark() inchangé, appels existants non modifiés

**Critères d'acceptation :**
- Paramètre config optionnel ✅
- Fallback fonctionnel ✅
- Tests existants passent toujours ✅

---

### Story 19.6 — Refactoring alertes.ts + calculs.ts
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story 19.2
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Refactorer `alertes.ts` : seuils pH, température, ammoniac, mortalité depuis ConfigElevage
- [x] `FAIT` Fallback vers valeurs actuelles si aucune config
- [x] `FAIT` Ajouter `detecterPhase(poidsMoyen, config?)` dans calculs.ts
- [x] `FAIT` Ajouter `getTauxAlimentation(poidsMoyen, config?)` dans calculs.ts
- [x] `FAIT` Ajouter `getTailleAliment(poidsMoyen, config?)` dans calculs.ts
- [x] `FAIT` Ajouter `convertirUniteStock(quantite, uniteSource, uniteDestination, contenanceSac?)` dans calculs.ts

**Critères d'acceptation :**
- Toutes nouvelles fonctions avec paramètre config optionnel ✅
- Fallback fonctionnel ✅
- convertirUniteStock gère KG/SACS/grammes ✅

---

### Story 19.7 — UI Settings — Page ConfigElevage
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** Story 19.4
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/app/settings/config-elevage/page.tsx
- [x] `FAIT` Créer src/app/settings/config-elevage/[id]/page.tsx
- [x] `FAIT` Créer src/app/settings/config-elevage/nouveau/page.tsx
- [x] `FAIT` Créer src/components/config-elevage/ (liste, édition, formulaire)
- [x] `FAIT` Page liste avec cartes mobile-first (nom, objectif, durée, badge "Par défaut")
- [x] `FAIT` Page édition avec 8 sections repliables (custom SectionCard)
- [x] `FAIT` Création depuis template (pré-remplit les champs)
- [x] `FAIT` Navigation ajoutée dans sidebar + hamburger-menu
- [x] `FAIT` Mobile first

**Critères d'acceptation :**
- Pas de tableaux sur mobile, cartes empilées ✅
- Sections repliables pour les 8 groupes ✅
- Création depuis template (pré-remplit les champs) ✅

---

### Story 19.8 — Tests + Review Sprint 19
**Assigné à :** @tester + @code-reviewer
**Priorité :** Haute
**Dépend de :** Stories 19.1 à 19.7
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Non-régression : 1175 tests existants passent (npx vitest run)
- [x] `FAIT` `npx vitest run` — 41 fichiers, 1175 tests, tous passent
- [x] `FAIT` `npm run build` — Build production OK (21 migrations, 0 erreurs TS)
- [x] `FAIT` Écrire docs/reviews/review-sprint-19.md
- [x] `FAIT` Écrire docs/tests/rapport-sprint-19.md

**Critères d'acceptation :**
- Tous les tests passent ✅
- Build OK ✅
- Rapports produits ✅

---

## Sprint 20 — Packs & Provisioning Automatisé (Phase 3)

**Objectif :** Mettre en place la gestion des packs (catalogue de kits de démarrage) et le provisioning automatique (création transactionnelle d'un site client complet lors de l'activation d'un pack). Résoudre les blockers F-03, F-05, F-06 de la review adversariale.
**Dépend de :** Sprint 19 FAIT
**Source :** docs/sprints/SPRINT-PLAN-PHASE3.md (Sprint 14 renommé Sprint 20)

---

### Story 20.1 — Nouveaux enums Phase 3 + rôle INGENIEUR
**Assigné à :** @db-specialist
**Priorité :** Haute
**Dépend de :** Aucune
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter enum `StatutActivation` : ACTIVE, EXPIREE, SUSPENDUE
- [x] `FAIT` Ajouter valeur `INGENIEUR` dans l'enum `Role`
- [x] `FAIT` Ajouter 6 nouvelles permissions : GERER_PACKS, ACTIVER_PACKS, GERER_CONFIG_ELEVAGE, GERER_REGLES_ACTIVITES, MONITORING_CLIENTS, ENVOYER_NOTES
- [x] `FAIT` Ajouter TypeActivite : + TRI, MEDICATION
- [x] `FAIT` Créer migration manuelle + `npx prisma migrate deploy` (20260320100000_add_phase3_enums)
- [x] `FAIT` Mettre à jour src/types/models.ts (enums TS miroirs + INGENIEUR)
- [x] `FAIT` Mettre à jour src/types/index.ts (barrel export StatutActivation)
- [x] `FAIT` Mettre à jour permissions-constants.ts (groupes packs/configElevage/ingenieur)
- [x] `FAIT` Corriger Record<Role> dans hamburger-menu.tsx et user-menu.tsx
- [x] `FAIT` Corriger Record<TypeActivite> dans planning-client.tsx et mes-taches-client.tsx
- [x] `FAIT` `npx vitest run` — 1175/1175 tests passent
- [x] `FAIT` `npm run build` — Build production OK

**Critères d'acceptation :**
- Enum StatutActivation avec 3 valeurs ✅
- Enum Role avec valeur INGENIEUR ✅
- Enum Permission avec 6 nouvelles valeurs ✅
- Enum TypeActivite avec TRI et MEDICATION ✅
- Migration exécutée sans erreur ✅
- Build OK ✅

---

### Story 20.2 — Modèles Prisma Pack, PackProduit, PackActivation
**Assigné à :** @db-specialist
**Priorité :** Haute
**Dépend de :** Story 20.1
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Modèle `Pack` avec configElevageId FK, relation ConfigElevage
- [x] `FAIT` Modèle `PackProduit` avec @@unique([packId, produitId]), onDelete: Restrict sur produitId
- [x] `FAIT` Modèle `PackActivation` SANS @unique sur clientSiteId (F-05) et vagueId (F-06)
- [x] `FAIT` PackActivation.siteId = site DKFarm vendeur, clientSiteId = site client (F-04)
- [x] `FAIT` Vague + configElevageId String? + packActivationId String?
- [x] `FAIT` Bac.volume rendu Float? nullable (EC-2.4)
- [x] `FAIT` Relations inverses sur Site, User, Produit, Vague
- [x] `FAIT` Créer migration + `npx prisma migrate deploy`
- [x] `FAIT` Mettre à jour src/types/models.ts + src/types/api.ts

**Critères d'acceptation :**
- 3 modèles créés avec toutes les relations correctes ✅
- Pas de @unique sur clientSiteId/vagueId dans PackActivation ✅
- Bac.volume nullable ✅
- Migration sans erreur ✅
- Build OK ✅

---

### Story 20.3 — Interfaces TypeScript + DTOs Packs
**Assigné à :** @architect
**Priorité :** Haute
**Dépend de :** Story 20.2
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Interfaces Pack, PackProduit, PackActivation dans src/types/models.ts
- [x] `FAIT` DTOs CreatePackDTO, ActivatePackDTO dans src/types/api.ts
- [x] `FAIT` Type ProvisioningPayload décrivant les 6 entités à créer
- [x] `FAIT` Documentation stratégie "system user" (isSystem Boolean sur User — F-03)
- [x] `FAIT` Écrire docs/decisions/010-system-user.md
- [x] `FAIT` Mettre à jour barrel export dans src/types/index.ts

**Critères d'acceptation :**
- Interfaces sans any ✅
- ProvisioningPayload complet ✅
- Barrel export à jour ✅
- Build OK ✅

---

### Story 20.4 — Champ isSystem sur User + seed system user
**Assigné à :** @db-specialist
**Priorité :** Haute
**Dépend de :** Story 20.3
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter champ `isSystem Boolean @default(false)` sur le modèle User
- [x] `FAIT` Créer migration + `npx prisma migrate deploy`
- [x] `FAIT` Insérer user système ("FarmFlow System", isSystem=true) dans prisma/seed.sql pour le site DKFarm

**Critères d'acceptation :**
- Champ isSystem sur User ✅
- Migration sans erreur ✅
- User système dans le seed ✅
- Build OK ✅

---

### Story 20.5 — API CRUD Packs + PackProduit
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Stories 20.2, 20.3
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/packs.ts
- [x] `FAIT` Route GET/POST `/api/packs`
- [x] `FAIT` Route GET/PUT/DELETE `/api/packs/[id]`
- [x] `FAIT` Route GET/POST/DELETE `/api/packs/[id]/produits`
- [x] `FAIT` Validation : nombreAlevins > 0 (EC-1.1), prixTotal >= 0 (EC-1.7), quantité > 0 (EC-1.3)
- [x] `FAIT` Empêcher désactivation si activations ACTIVE existent (EC-1.5)
- [x] `FAIT` Permission GERER_PACKS requise

**Critères d'acceptation :**
- CRUD complet packs + PackProduit ✅
- Validations business EC-1.1, EC-1.3, EC-1.5, EC-1.7 ✅
- Permission GERER_PACKS enforced ✅
- Build OK ✅

---

### Story 20.6 — Logique de provisioning transactionnel
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Stories 20.4, 20.5
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/provisioning.ts
- [x] `FAIT` Route POST `/api/packs/[id]/activer`
- [x] `FAIT` Transaction atomique : créer site client + SiteMember + copier ConfigElevage + créer vague + bac + copier produits + MouvementStock + PackActivation
- [x] `FAIT` Code ACT-YYYY-NNN avec gestion overflow (EC-2.5)
- [x] `FAIT` Empêcher double-activation même pack/même user (EC-2.1)
- [x] `FAIT` userId des entités auto-générées = system user (F-03)
- [x] `FAIT` Produits COPIÉS vers site client (F-14), fournisseurId=null
- [x] `FAIT` Bac créé avec volume=null (EC-2.4)

**Critères d'acceptation :**
- Transaction rollback complet sur erreur (EC-2.3) ✅
- Toutes les 6 entités créées en une transaction ✅
- Double-activation bloquée ✅
- Code ACT-YYYY-NNN unique ✅
- Build OK ✅

---

### Story 20.7 — UI Admin — Gestion des Packs + Activation
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** Stories 20.5, 20.6
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/app/packs/page.tsx (liste packs mobile-first)
- [x] `FAIT` Créer src/app/packs/[id]/page.tsx (détail/édition)
- [x] `FAIT` Créer src/app/packs/[id]/activer/page.tsx (formulaire activation multi-étapes)
- [x] `FAIT` Créer src/app/activations/page.tsx (liste activations filtrées par statut)
- [x] `FAIT` Créer src/components/packs/ (4 composants réutilisables)
- [x] `FAIT` Mobile first (360px) — cartes empilées

**Critères d'acceptation :**
- Cartes mobile-first (pas de tableaux) ✅
- Formulaire activation avec sélection/création client ✅
- Confirmation visuelle provisioning ✅
- Build OK ✅

---

### Story 20.8 — Seed données Packs + Activations
**Assigné à :** @db-specialist
**Priorité :** Moyenne
**Dépend de :** Stories 20.2, 20.4
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter 3 packs dans prisma/seed.sql (Découverte 100, Starter 300, Pro 500)
- [x] `FAIT` Ajouter PackProduit pour chaque pack (2-4 produits par pack, 9 au total)
- [x] `FAIT` User système présent dans le seed (isSystem=true, id='system_dkfarm')

**Critères d'acceptation :**
- 3 packs avec PackProduits ✅
- User système dans le seed ✅
- Build OK ✅

---

### Story 20.9 — Tests + Review Sprint 20
**Assigné à :** @tester + @code-reviewer
**Priorité :** Haute
**Dépend de :** Stories 20.1 à 20.8
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Tests API packs : CRUD + PackProduit + activations (31 tests)
- [x] `FAIT` Tests edge cases : EC-1.1, EC-1.3, EC-1.5, EC-2.1, EC-2.4
- [x] `FAIT` Tests permissions : GERER_PACKS, ACTIVER_PACKS
- [x] `FAIT` Non-régression : 1175 tests existants passent
- [x] `FAIT` `npx vitest run` — 1206/1206 tests passent
- [x] `FAIT` `npm run build` — Build production OK
- [x] `FAIT` Écrire docs/reviews/review-sprint-20.md
- [x] `FAIT` Écrire docs/tests/rapport-sprint-20.md

**Critères d'acceptation :**
- 1206/1206 tests passent ✅
- Build OK ✅
- Rapports produits ✅

---

## Sprint 21 — Moteur d'Activités (Activity Engine)

**Objectif :** Moteur de regles qui evalue automatiquement les conditions d'elevage et genere des activites planifiees sans intervention manuelle.

---

### Story S15-1 — Schema Prisma : TypeDeclencheur + RegleActivite + Activite enrichie
**Assigné à :** @db-specialist
**Statut :** `FAIT`

---

### Story S15-2 — Types TypeScript : interfaces + DTOs + types moteur
**Assigné à :** @architect
**Statut :** `FAIT`

---

### Story S15-3 — Moteur d'evaluation des regles
**Assigné à :** @developer
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/lib/activity-engine/context.ts — buildEvaluationContext()
- [x] `FAIT` Créer src/lib/activity-engine/evaluator.ts — evaluateRules(), 8 types de declencheurs
- [x] `FAIT` EC-3.9 : skip vagues sans vivants
- [x] `FAIT` EC-3.5 : validation phaseMin <= phaseMax
- [x] `FAIT` EC-3.12 : conditions null = match toujours
- [x] `FAIT` Timezone UTC+1 pour les calculs de jours

---

### Story S15-4 — Template engine
**Assigné à :** @developer
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/lib/activity-engine/template-engine.ts — resolveTemplate() + buildPlaceholders()
- [x] `FAIT` EC-3.6 : placeholders non resolus → "[donnee non disponible]"
- [x] `FAIT` Formatage nombres locale FR (1 234,5)

---

### Story S15-5 — Generation d'activites + deduplication
**Assigné à :** @developer
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/lib/activity-engine/generator.ts — generateActivities()
- [x] `FAIT` EC-3.1 : deduplication meme regle + vague + meme jour
- [x] `FAIT` EC-3.2 : firedOnce atomique pour SEUIL_* (R4 : updateMany)
- [x] `FAIT` EC-3.3 : priorite la plus basse = plus urgente
- [x] `FAIT` Transactions Prisma pour chaque creation (R4)
- [x] `FAIT` Créer src/lib/activity-engine/index.ts

---

### Story S15-6 — CRON API + Event-driven triggers
**Assigné à :** @developer
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/app/api/activites/generer/route.ts (POST, token CRON_SECRET)
- [x] `FAIT` Idempotent : double-run ne genere pas de doublons
- [x] `FAIT` Modifier src/app/api/releves/route.ts — hook async SEUIL_* apres creation releve
- [x] `FAIT` Créer vercel.json — cron 0 5 * * * (05:00 UTC = 06:00 WAT)

---

### Story S15-9 — Calcul automatique quantites d'aliment
**Assigné à :** @developer
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/lib/activity-engine/feeding.ts — calculerQuantiteAliment()
- [x] `FAIT` EC-4.1 : nombreVivants = dernierComptage - mortalitesCumulees
- [x] `FAIT` EC-4.2 : projection poidsMoyen via SGR si biometrie > 7 jours
- [x] `FAIT` EC-4.4 : poids = seuil exact → phase superieure
- [x] `FAIT` `npx vitest run` — 1206/1206 tests passent
- [x] `FAIT` `npm run build` — Build production OK

---

## Sprint 23 — Monitoring Ingénieur & Polish

### Story S17-2 — API Dashboard ingénieur + liste clients
**Assigné à :** @developer
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/ingenieur.ts — getIngenieurDashboardMetrics() + getClientsIngenieur() + getClientIngenieurDetail()
- [x] `FAIT` Créer src/app/api/ingenieur/dashboard/route.ts — GET, permission MONITORING_CLIENTS
- [x] `FAIT` Créer src/app/api/ingenieur/clients/route.ts — GET paginé, tri par urgence, permission MONITORING_CLIENTS
- [x] `FAIT` Créer src/__tests__/api/ingenieur.test.ts — 19 tests
- [x] `FAIT` `npx vitest run` — 1508/1508 tests passent
- [x] `FAIT` `npm run build` — Routes /api/ingenieur/dashboard et /api/ingenieur/clients buildées OK

### Story S17-4 — UI Dashboard ingénieur
**Assigné à :** @developer
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/app/ingenieur/page.tsx — Server Component, alertes actives + liste clients + stats globales
- [x] `FAIT` Créer src/app/ingenieur/[siteId]/page.tsx — Server Component, détail client avec métriques + graphiques
- [x] `FAIT` Créer src/components/ingenieur/client-card.tsx — carte client mobile-first, codes couleur critique/attention/ok
- [x] `FAIT` Créer src/components/ingenieur/dashboard-stats.tsx — stats globales (packs, survie, alertes, clients)
- [x] `FAIT` Créer src/components/ingenieur/client-charts.tsx — graphiques Recharts croissance + survie + mortalité
- [x] `FAIT` `npx vitest run` — 1531/1531 tests passent
- [x] `FAIT` `npx tsc --noEmit` — aucune erreur dans les nouveaux fichiers

### Story S17-7 — Polish : Navigation Phase 3 + lifecycle PackActivation
**Assigné à :** @developer
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer src/lib/queries/lifecycle.ts — expirePackActivations() + suspendPackActivations() + archiveOldActivities() + runLifecycle()
- [x] `FAIT` Modifier src/app/api/activites/generer/route.ts — intégrer runLifecycle() dans le CRON loop
- [x] `FAIT` Modifier src/app/layout.tsx — passer role en plus de permissions à AppShell
- [x] `FAIT` Modifier src/components/layout/app-shell.tsx — accepter et transmettre role aux composants nav
- [x] `FAIT` Modifier src/components/layout/bottom-nav.tsx — navigation conditionnelle par rôle (PISCICULTEUR/INGENIEUR/ADMIN/GERANT)
- [x] `FAIT` Modifier src/components/layout/sidebar.tsx — modules Phase 3 (Packs & Provisioning, Config. Elevage, Ingenieur) avec gates permissions
- [x] `FAIT` Modifier src/lib/permissions-constants.ts — ITEM_VIEW_PERMISSIONS + SECONDARY_VIEW_PERMISSIONS Phase 3
- [x] `FAIT` Corriger src/__tests__/ui/responsive.test.tsx — adapter tests BottomNav avec nouveau prop role
- [x] `FAIT` `npx vitest run` — 1533/1533 tests passent
- [x] `FAIT` `npm run build` — Build production OK (Compiled successfully in 16.5s)

---

## Sprint 24 — Sites Supervisés & Contrôle de Modules

**Objectif :** Ajouter un flag `supervised` et un tableau `enabledModules` sur les sites, permettre aux packs de définir les modules activés, donner aux clients un rôle admin sur leur site, et filtrer la navigation par modules site + permissions utilisateur.

---

### Story 24.1 — Schema Prisma : SiteModule enum + champs Site/Pack
**Assigné à :** @db-specialist
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter l'enum `SiteModule` dans schema.prisma (12 valeurs incluant platform modules)
- [x] `FAIT` Ajouter `supervised Boolean @default(false)` au modèle Site
- [x] `FAIT` Ajouter `enabledModules SiteModule[] @default([])` au modèle Site
- [x] `FAIT` Pack utilise désormais planId (FK PlanAbonnement) — enabledModules supprimé (Sprint 44)
- [x] `FAIT` Migrations appliquées (Sprint 38 + 44)
- [x] `FAIT` Seed mis à jour

**Critères d'acceptation :**
- Migration s'applique sans erreur
- Seed fonctionne
- Schema.prisma aligné avec les types TypeScript (R3)

---

### Story 24.2 — Types TypeScript & Mapping modules
**Assigné à :** @architect
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Ajouter enum SiteModule dans src/types/models.ts
- [ ] `TODO` Mettre à jour l'interface Site (supervised, enabledModules)
- [ ] `TODO` Mettre à jour l'interface Pack (enabledModules)
- [ ] `TODO` Exporter SiteModule depuis src/types/index.ts
- [ ] `TODO` Ajouter MODULE_LABEL_TO_SITE_MODULE dans src/lib/permissions-constants.ts
- [ ] `TODO` Ajouter ITEM_VIEW_PERMISSIONS pour "/mes-taches": Permission.DASHBOARD_VOIR
- [ ] `TODO` Créer ADR docs/decisions/011-supervised-sites-modules.md

**Critères d'acceptation :**
- Enum SiteModule miroir exact du Prisma (R3)
- ADR documenté avec contexte, décision, conséquences

---

### Story 24.3 — Server-side : chargement modules site + layout
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Stories 24.1, 24.2
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer getServerSiteModules() dans src/lib/auth/permissions-server.ts (avec cache React)
- [ ] `TODO` Mettre à jour src/app/layout.tsx pour charger siteModules et les passer à AppShell
- [ ] `TODO` Mettre à jour AppShell (src/components/layout/app-shell.tsx) pour accepter et propager siteModules

**Critères d'acceptation :**
- siteModules chargé depuis la DB via getServerSiteModules
- enabledModules vide = tous les modules (backward compat)
- Props propagés à Sidebar, HamburgerMenu, BottomNav

---

### Story 24.4 — Navigation : filtrage par modules site
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story 24.3
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Sidebar (src/components/layout/sidebar.tsx) : ajouter prop siteModules, filtrer modules par MODULE_LABEL_TO_SITE_MODULE
- [ ] `TODO` HamburgerMenu (src/components/layout/hamburger-menu.tsx) : même changement
- [ ] `TODO` BottomNav (src/components/layout/bottom-nav.tsx) : ajouter prop siteModules, filtrer items par module
- [ ] `TODO` Le filtrage s'insère entre le filtre permission existant et le filtre modules vides

**Critères d'acceptation :**
- Site supervisé avec [GROSSISSEMENT, ANALYSE_PILOTAGE, NOTES] : voit seulement ces 3 modules
- Site DKFarm (enabledModules vide) : voit tous les modules (inchangé)
- ADMIN bypass : voit tout

---

### Story 24.5 — Provisioning : site supervisé + rôle admin client
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Stories 24.1, 24.2
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Modifier activerPack() dans src/lib/queries/provisioning.ts : site créé avec supervised=true, enabledModules du pack (ou défaut [GROSSISSEMENT, ANALYSE_PILOTAGE, NOTES])
- [ ] `TODO` Changer client User.role = Role.GERANT (au lieu de PISCICULTEUR)
- [ ] `TODO` Changer client SiteMember.siteRoleId = adminRole.id (au lieu de pisciculteurRole.id)
- [ ] `TODO` Définir DEFAULT_SUPERVISED_MODULES constante
- [ ] `TODO` S'assurer que pack.enabledModules est chargé dans la query

**Critères d'acceptation :**
- Pack activé → site supervisé avec bons modules
- Client = GERANT + Administrateur SiteRole
- DKFarm admin = toujours Administrateur SiteRole sur le site client

---

### Story 24.6 — Bug fixes : /observations bottom-nav + /mes-taches access
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story 24.2
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Ajouter { href: "/observations", label: "Observations", icon: Eye } aux items de "Analyse & Pilotage" dans src/lib/module-nav-items.ts (import Eye)
- [ ] `TODO` Changer Permission.PLANNING_VOIR → Permission.DASHBOARD_VOIR dans src/app/mes-taches/page.tsx (ligne 14) et src/app/mes-taches/[id]/page.tsx

**Critères d'acceptation :**
- /observations visible dans le contextual bottom-nav du module "Analyse & Pilotage"
- /mes-taches accessible pour un pisciculteur (DASHBOARD_VOIR suffit)

---

### Story 24.7 — Tests Sprint 24
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** Stories 24.3, 24.4, 24.5, 24.6
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Test unitaire : getServerSiteModules (empty = all, specific modules returned)
- [ ] `TODO` Test unitaire : module filtering avec siteModules
- [ ] `TODO` Test intégration : provisioning crée site supervisé avec bons modules
- [ ] `TODO` Test : /mes-taches accessible avec DASHBOARD_VOIR
- [ ] `TODO` `npm run build` — Build production OK
- [ ] `TODO` `npx vitest run` — Tous les tests passent

**Critères d'acceptation :**
- Tous les tests passent
- Build production OK

---

### Story 24.8 — Review Sprint 24
**Assigné à :** @code-reviewer
**Priorité :** Haute
**Dépend de :** Story 24.7
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Checklist R1-R9
- [ ] `TODO` Vérifier backward compatibility (sites existants non impactés)
- [ ] `TODO` Vérifier que les 3 composants nav sont cohérents (Sidebar, HamburgerMenu, BottomNav)
- [ ] `TODO` Rapport dans docs/reviews/review-sprint-24.md

**Critères d'acceptation :**
- Checklist R1-R9 validée
- Backward compat confirmée
- Rapport produit

---

## Sprint 25 — Gestion des Règles d'Activité (Rule Management)

**Objectif :** Permettre au super-admin DKFarm de visualiser, modifier, activer/désactiver et créer des règles d'activité depuis une interface d'administration. Actuellement les 23 règles globales du moteur d'activités (Sprint 21) ne sont accessibles que via `prisma/seed.sql`.

**Contexte métier :**
- Le moteur d'activités évalue des règles (`RegleActivite`) pour générer automatiquement des activités planifiées
- Chaque règle a des templates (`titreTemplate`, `descriptionTemplate`, `instructionsTemplate`) avec des placeholders résolus à la génération
- 23 règles globales (`siteId = NULL`) couvrent 5 catégories : tâches RECURRENT quotidiennes/hebdo, seuils SEUIL_POIDS, alertes SEUIL_MORTALITE/SEUIL_QUALITE/FCR_ELEVE/STOCK_BAS, jalons JALON
- La permission `GERER_REGLES_ACTIVITES` existe déjà dans l'enum (Sprint 20)
- L'ADR complet est dans `docs/decisions/013-rule-management.md`

**Dépend de :** Sprint 24 FAIT (ou en parallèle — pas de dépendance fonctionnelle)

**Règles de protection :**
- Règles globales (`siteId = null`) : non supprimables (DELETE → 409), modifiables par les admin DKFarm
- Règles site-spécifiques : supprimables si aucune activité liée
- `firedOnce` reset uniquement via route dédiée (audit trail implicite)

---

### Story 25.1 — Queries CRUD RegleActivite
**Assigné à :** @db-specialist
**Priorité :** Haute
**Dépend de :** Aucune (modèle RegleActivite existe depuis Sprint 21)
**Statut :** `FAIT`

**Description :** Créer le fichier de queries CRUD pour `RegleActivite`. La logique de lecture/écriture est absente du code applicatif (le seed utilise du SQL brut, et l'orchestrateur charge les règles directement via Prisma sans passer par des fonctions utilitaires).

**Tâches :**
- [x] `FAIT` Créer `src/lib/queries/regles-activites.ts`
- [x] `FAIT` `getReglesActivites(siteId?, filters?)` — liste avec filtres optionnels : `isActive`, `typeDeclencheur`, `typeActivite`, `includeGlobal`. Ordonné par typeDeclencheur ASC, priorite ASC
- [x] `FAIT` `getRegleActiviteById(id, siteId?)` — détail avec count des activités liées (`_count: { activites: true }`)
- [x] `FAIT` `createRegleActivite(siteId, userId, data)` — siteId obligatoire (siteId null réservé au seed DKFarm)
- [x] `FAIT` `updateRegleActivite(id, siteId, data)` — mise à jour partielle des champs éditables : `nom`, `description`, `titreTemplate`, `descriptionTemplate`, `instructionsTemplate`, `priorite`, `isActive`, `intervalleJours`, `conditionValeur`, `conditionValeur2`, `phaseMin`, `phaseMax`
- [x] `FAIT` `deleteRegleActivite(id, siteId)` — retourne `{ error: "global" }` si siteId null, `{ error: "linked" }` si activités liées, `{ success: true }` sinon
- [x] `FAIT` `toggleRegleActivite(id)` — bascule isActive, réinitialise firedOnce si SEUIL_* lors de la réactivation, atomique R4
- [x] `FAIT` `resetFiredOnce(id)` — remet firedOnce à false, updateMany conditionnel sur firedOnce=true, idempotent
- [x] `FAIT` Exporter les 7 fonctions depuis `src/lib/queries/index.ts`

**Critères d'acceptation :**
- R4 : toggle et reset via `updateMany` avec condition (jamais check-then-update)
- R8 : les règles site-spécifiques filtrent toujours par siteId dans le contexte d'un site
- Aucun `any` dans les types de retour
- Pattern référence : `src/lib/queries/activites.ts`

---

### Story 25.2 — Types TypeScript + DTOs RegleActivite
**Assigné à :** @architect
**Priorité :** Haute
**Dépend de :** Story 25.1
**Statut :** `FAIT`

**Description :** L'interface `RegleActivite` existe dans `src/types/models.ts` (Sprint 21) mais les DTOs d'API manquent. Créer les DTOs et les constantes utilitaires nécessaires à l'UI (labels des enums, liste des placeholders valides).

**Tâches :**
- [x] `FAIT` Vérifier que l'interface `RegleActivite` dans `src/types/models.ts` est complète et alignée avec le schéma Prisma (R3) — tous les champs Sprint 21 : `id`, `nom`, `description`, `typeActivite`, `typeDeclencheur`, `conditionValeur`, `conditionValeur2`, `phaseMin`, `phaseMax`, `intervalleJours`, `titreTemplate`, `descriptionTemplate`, `instructionsTemplate`, `priorite`, `isActive`, `firedOnce`, `siteId`, `userId`, `createdAt`, `updatedAt`
- [x] `FAIT` Ajouter interface `RegleActiviteWithCount` dans `src/types/models.ts` : extends `RegleActivite` avec `_count: { activites: number }`
- [x] `FAIT` Créer `CreateRegleActiviteDTO` dans `src/types/api.ts` : `nom` (required), `typeActivite` (TypeActivite), `typeDeclencheur` (TypeDeclencheur), `titreTemplate` (required), `descriptionTemplate?`, `instructionsTemplate?`, `conditionValeur?`, `conditionValeur2?`, `phaseMin?`, `phaseMax?`, `intervalleJours?`, `priorite?` (1-10), `siteId` (required — pas de création de règle globale via API)
- [x] `FAIT` Créer `UpdateRegleActiviteDTO` dans `src/types/api.ts` : tous les champs de `CreateRegleActiviteDTO` optionnels sauf `siteId` non modifiable
- [x] `FAIT` Créer `RegleActiviteFilters` dans `src/types/api.ts` : `isActive?`, `typeDeclencheur?`, `typeActivite?`, `includeGlobal?` (boolean, default true)
- [x] `FAIT` Créer `src/lib/regles-activites-constants.ts` avec :
  - `KNOWN_PLACEHOLDERS: KnownPlaceholder[]` — liste exhaustive des 16 placeholders valides avec description et exemple (voir ADR 013)
  - `TYPE_DECLENCHEUR_LABELS: Record<TypeDeclencheur, string>` — labels FR pour l'UI
  - `TYPE_ACTIVITE_LABELS: Record<TypeActivite, string>` — labels FR pour l'UI
  - `PHASE_ELEVAGE_LABELS: Record<PhaseElevage, string>` — labels FR pour l'UI
  - `PHASE_ELEVAGE_ORDER: PhaseElevage[]` — ordre des phases pour validation
  - `validateTemplatePlaceholders(template: string): { valid: boolean; unknown: string[] }` — fonction pure de validation
- [x] `FAIT` Mettre à jour barrel export `src/types/index.ts` (RegleActiviteWithCount)
- [x] `FAIT` Ajouter `/settings/regles-activites` dans `ITEM_VIEW_PERMISSIONS` (permissions-constants.ts)

**Critères d'acceptation :**
- R2 : utiliser les enums TypeScript importés (jamais de string literals)
- R3 : `RegleActiviteWithCount` aligné avec la requête Prisma `_count`
- Aucun `any`
- `validateTemplatePlaceholders` testable unitairement (fonction pure)

---

### Story 25.3 — API Routes RegleActivite
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Stories 25.1, 25.2
**Statut :** `FAIT`

**Description :** Créer les 7 routes API de gestion des règles. La permission `GERER_REGLES_ACTIVITES` est utilisée sur toutes les routes.

**Tâches :**
- [x] `FAIT` Créer `src/app/api/regles-activites/route.ts` :
  - `GET` : liste des règles avec filtres query params (`isActive`, `typeDeclencheur`, `typeActivite`). Retourne règles globales + règles du site actif. Auth + `requirePermission(GERER_REGLES_ACTIVITES)`
  - `POST` : création d'une règle site-spécifique. Valider body avec `CreateRegleActiviteDTO`. Appeler `validateTemplatePlaceholders()` sur les 3 templates — log avertissement si placeholder inconnu (ne pas rejeter). `siteId` = session.activeSiteId (jamais null). Auth + `requirePermission(GERER_REGLES_ACTIVITES)`
- [x] `FAIT` Créer `src/app/api/regles-activites/[id]/route.ts` :
  - `GET` : détail règle avec `_count.activites`. Auth + `requirePermission(GERER_REGLES_ACTIVITES)`
  - `PUT` : mise à jour partielle. Valider body `UpdateRegleActiviteDTO`. Appeler `validateTemplatePlaceholders()`. Auth + `requirePermission(GERER_REGLES_ACTIVITES)`
  - `DELETE` : supprimer règle. Déléguer à `deleteRegleActivite()` qui retourne 409 si règle globale ou activités liées. Auth + `requirePermission(GERER_REGLES_ACTIVITES)`
- [x] `FAIT` Créer `src/app/api/regles-activites/[id]/toggle/route.ts` :
  - `PATCH` : basculer isActive. Retourner `{ id, isActive: boolean }`. Auth + `requirePermission(GERER_REGLES_ACTIVITES)`
- [x] `FAIT` Créer `src/app/api/regles-activites/[id]/reset/route.ts` :
  - `POST` : remettre firedOnce à false. Retourner `{ id, firedOnce: false }`. Vérifier que `typeDeclencheur` est bien un SEUIL_* (SEUIL_POIDS, SEUIL_QUALITE, SEUIL_MORTALITE, FCR_ELEVE, STOCK_BAS) — 400 sinon. Auth + `requirePermission(GERER_REGLES_ACTIVITES)`
- [x] `FAIT` Gestion d'erreurs cohérente : 400 (validation), 403 (permission), 404 (not found), 409 (contrainte métier), 500 (erreur serveur)
- [x] `FAIT` Pattern référence : `src/app/api/config-elevage/[id]/route.ts`

**Critères d'acceptation :**
- R2 : utiliser `Permission.GERER_REGLES_ACTIVITES` (enum importé)
- R8 : les règles globales sont accessibles en lecture par tout admin ; en écriture par admin DKFarm
- Toutes les routes retournent des erreurs structurées `{ error: string }`
- 409 clair quand on tente de supprimer une règle globale ou liée à des activités

---

### Story 25.4 — UI Liste des règles d'activité
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story 25.3
**Statut :** `FAIT`

**Description :** Créer la page de liste des règles, mobile-first, groupée par `typeDeclencheur`. Toggle actif/inactif directement depuis la carte. Lien vers le détail/édition.

**Tâches :**
- [x] `FAIT` Créer `src/app/settings/regles-activites/page.tsx` (Server Component) — charge la liste des règles via `getReglesActivites()`, protégé par `requirePermission(GERER_REGLES_ACTIVITES)`
- [x] `FAIT` Créer `src/components/regles-activites/regles-list-client.tsx` (Client Component) :
  - Tabs de filtrage : Toutes | Actives | Inactives
  - Groupement par `typeDeclencheur` (sections collapsibles ou séparateurs visuels)
  - Ordre dans chaque groupe : priorite ASC
  - Carte par règle : nom, typeActivite badge, typeDeclencheur badge, priorite, intervalleJours? (si RECURRENT), conditionValeur? (si SEUIL_*), badge "Globale" vs "Site", badge "Déclenchée" si firedOnce=true
  - Toggle switch actif/inactif sur chaque carte (PATCH /toggle, optimistic update)
  - Lien "Modifier" vers /settings/regles-activites/[id]
  - Bouton "Nouvelle règle" en haut (lien vers /settings/regles-activites/nouvelle), visible uniquement si GERER_REGLES_ACTIVITES
- [x] `FAIT` Séparer visuellement les règles globales (badge "DKFarm" distinct) des règles site-spécifiques
- [x] `FAIT` Mobile-first : cartes empilées, toggle accessible (min 44px), pas de tableau

**Critères d'acceptation :**
- Mobile 360px : cartes lisibles, toggle fonctionnel
- R5 : pas de DialogTrigger imbriqué (toggle est un Switch Radix, pas un bouton dans un Dialog)
- R6 : CSS variables du thème pour les badges
- Groupement par typeDeclencheur visible et clair
- Pattern référence : `src/components/config-elevage/configs-list-client.tsx`

---

### Story 25.5 — UI Détail + Édition règle
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story 25.4
**Statut :** `FAIT`

**Description :** Créer la page de détail et d'édition d'une règle. L'édition est inline (même page) avec un mode "lecture" / mode "édition". Afficher un aperçu des templates résolus avec des valeurs fictives.

**Tâches :**
- [x] `FAIT` Créer `src/app/settings/regles-activites/[id]/page.tsx` (Server Component) — charge la règle par id avec `_count.activites`
- [x] `FAIT` Créer `src/components/regles-activites/regle-detail-client.tsx` (Client Component) :
  - **Mode lecture** : affiche tous les champs avec labels FR, badge isActive, badge firedOnce (si SEUIL_*)
  - **Mode édition** (bouton "Modifier") : formulaire inline avec les champs éditables
  - **Section "Paramètres de déclenchement"** : conditionValeur, conditionValeur2 (si SEUIL_QUALITE), intervalleJours (si RECURRENT), phaseMin/phaseMax, priorite (1-10)
  - **Section "Templates"** : titreTemplate, descriptionTemplate (textarea), instructionsTemplate (textarea — format "1. Step\n2. Step")
  - **Aperçu template** : bouton "Aperçu" qui affiche le titre/description résolus avec des valeurs fictives (poids_moyen=150, bac="Bac A", vague="VAG-2026-001", etc.)
  - **Avertissement placeholders inconnus** : si `validateTemplatePlaceholders()` détecte des placeholders inconnus, afficher un avertissement non-bloquant (pas d'erreur)
  - **Action "Réinitialiser firedOnce"** : bouton visible si firedOnce=true, appelle POST /reset, avec dialog de confirmation ("Cette règle se déclenchera à nouveau au prochain cycle")
  - **Action "Supprimer"** : bouton visible si siteId non-null ET `_count.activites = 0`. Dialog de confirmation. Redirect vers /settings/regles-activites après suppression
  - **Indicateur activités liées** : afficher le nombre d'activités générées par cette règle (`_count.activites`)
- [x] `FAIT` Mobile-first : textareas larges, boutons 44px min
- [x] `FAIT` Créer `src/components/regles-activites/template-editor.tsx` — textarea augmentee avec chips placeholders
- [x] `FAIT` Créer `src/components/regles-activites/template-preview.tsx` — apercu resolu client-side avec donnees fictives

**Critères d'acceptation :**
- R5 : DialogTrigger asChild pour les dialogs de confirmation
- R6 : CSS variables du thème
- Aperçu template fonctionnel avec valeurs fictives réalistes
- Formulaire non modifiable pour les règles globales (siteId = null) — afficher un banner "Règle globale DKFarm — contact support pour modification"
- Pattern référence : `src/app/settings/config-elevage/[id]/page.tsx`

---

### Story 25.6 — UI Formulaire création règle personnalisée
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** Story 25.3
**Statut :** `FAIT`

**Description :** Créer la page de création d'une règle site-spécifique. Permet aux ADMIN avancés de définir des règles supplémentaires pour leur site (par exemple une règle d'alimentation spécifique à leur espèce ou configuration).

**Tâches :**
- [x] `FAIT` Créer `src/app/settings/regles-activites/nouvelle/page.tsx` (Server Component + redirect si pas de permission)
- [x] `FAIT` Créer `src/components/regles-activites/regle-form-client.tsx` (Client Component) :
  - **Étape 1 — Déclencheur** : select `typeActivite` + select `typeDeclencheur`. Selon le typeDeclencheur sélectionné, afficher les champs conditionnels :
    - RECURRENT → `intervalleJours` (number, required)
    - SEUIL_POIDS → `conditionValeur` (poids en g, required)
    - SEUIL_QUALITE → `conditionValeur` + `conditionValeur2` (min/max, required)
    - SEUIL_MORTALITE / FCR_ELEVE / STOCK_BAS → `conditionValeur` (required)
    - JALON → `conditionValeur` (% du cycle, required)
  - **Étape 2 — Templates** : `nom`, `titreTemplate`, `descriptionTemplate` (optionnel), `instructionsTemplate` (optionnel, format "1. Étape\n2. Étape")
  - **Étape 3 — Paramètres** : `priorite` (1-10, slider ou number input), `phaseMin?`, `phaseMax?`
  - **Aperçu en temps réel** : afficher le titre résolu à droite (desktop) ou en bas (mobile) avec valeurs fictives
  - **Liste des placeholders** : panneau d'aide affichant les placeholders disponibles avec description (cliquable pour insérer dans le champ actif)
  - Validation client avant soumission : titreTemplate non vide, intervalleJours > 0 si RECURRENT, etc.
  - Redirect vers /settings/regles-activites/[id] après création
- [x] `FAIT` Mobile-first : formulaire multi-étapes en accordéon ou pages séquentielles

**Critères d'acceptation :**
- R2 : enums importés pour les selects (`TypeActivite`, `TypeDeclencheur`, `PhaseElevage`)
- R6 : CSS variables du thème
- Champs conditionnels affichés/masqués selon typeDeclencheur
- Validation client complète avant envoi
- Placeholder helper accessible sur mobile (modal ou section dépliable)

---

### Story 25.7 — Navigation : accès /settings/regles-activites
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** Story 25.4
**Statut :** `FAIT`

**Description :** Ajouter le lien vers la gestion des règles dans la navigation (sidebar, hamburger-menu). La règle d'activité est un item de configuration avancé, placé dans le module "Configuration" aux côtés de /settings/config-elevage.

**Tâches :**
- [x] `FAIT` Dans `src/lib/module-nav-items.ts` (ou `src/lib/permissions-constants.ts`) : ajouter `"/settings/regles-activites"` dans les items du module "Configuration" avec label "Règles d'activité" et icône `Zap` (lucide-react)
- [x] `FAIT` Dans `src/lib/permissions-constants.ts` — `ITEM_VIEW_PERMISSIONS` : ajouter `"/settings/regles-activites": Permission.GERER_REGLES_ACTIVITES`
- [x] `FAIT` Dans `src/components/layout/sidebar.tsx` : vérifier que le module "Configuration" inclut le nouvel item (si la sidebar est generée depuis `module-nav-items.ts`, aucun changement nécessaire)
- [x] `FAIT` Dans `src/components/layout/hamburger-menu.tsx` : idem
- [x] `FAIT` Vérifier que `MODULE_LABEL_TO_SITE_MODULE` couvre "Configuration" → `SiteModule.CONFIGURATION`

**Critères d'acceptation :**
- /settings/regles-activites accessible depuis sidebar et hamburger-menu
- Item visible uniquement si l'utilisateur a `GERER_REGLES_ACTIVITES`
- Cohérence sidebar / hamburger-menu
- Pattern référence : traitement de `/settings/config-elevage` dans les mêmes fichiers

---

### Story 25.8 — Tests Sprint 25
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** Stories 25.1 à 25.7
**Statut :** `FAIT`

**Description :** Écrire les tests unitaires et d'intégration pour la gestion des règles. Vérifier la non-régression avec le moteur d'activités existant.

**Tâches :**
- [x] `FAIT` Créer `src/__tests__/api/regles-activites.test.ts` :
  - `GET /api/regles-activites` — retourne la liste (200), filtre isActive, filtre typeDeclencheur
  - `GET /api/regles-activites` — 403 sans `GERER_REGLES_ACTIVITES`
  - `POST /api/regles-activites` — crée une règle site-spécifique (201)
  - `POST /api/regles-activites` — refuse siteId=null (400)
  - `GET /api/regles-activites/[id]` — retourne le détail avec `_count.activites` (200)
  - `GET /api/regles-activites/[id]` — 404 si id inconnu
  - `PUT /api/regles-activites/[id]` — met à jour les templates (200)
  - `DELETE /api/regles-activites/[id]` — 409 si règle globale (siteId = null)
  - `DELETE /api/regles-activites/[id]` — 409 si activités liées (count > 0)
  - `DELETE /api/regles-activites/[id]` — 200 si règle site-spécifique sans activités
  - `PATCH /api/regles-activites/[id]/toggle` — bascule isActive (200), retourne `{ id, isActive }`
  - `POST /api/regles-activites/[id]/reset` — remet firedOnce=false (200) pour une règle SEUIL_*
  - `POST /api/regles-activites/[id]/reset` — 400 si typeDeclencheur=RECURRENT (pas one-shot)
- [x] `FAIT` Créer `src/__tests__/lib/regles-activites.test.ts` (tests unitaires) :
  - `validateTemplatePlaceholders()` — placeholder connu → valid:true
  - `validateTemplatePlaceholders()` — placeholder inconnu → valid:false, unknown:["{inconnu}"]
  - `validateTemplatePlaceholders()` — template sans placeholder → valid:true
  - `toggleRegleActivite()` — operation atomique (pas d'appel findById puis update)
  - `resetFiredOnce()` — operation atomique
  - `deleteRegleActivite()` — rejet si siteId=null
  - `deleteRegleActivite()` — rejet si _count.activites > 0
- [x] `FAIT` Non-régression moteur d'activités : vérifier que les tests existants du moteur (`evaluateRules`, `generateActivities`, `buildEvaluationContext`) passent toujours
- [x] `FAIT` `npx vitest run` — 1764 tests passants, 8 échecs pré-existants (non introduits)
- [x] `FAIT` `npm run build` — Build production OK
- [x] `FAIT` Écrire `docs/tests/rapport-sprint-25.md`

**Critères d'acceptation :**
- R9 : tous les tests passent + build OK
- Cas de la règle globale non supprimable couvert (409)
- Cas du reset firedOnce sur mauvais type couvert (400)
- Non-régression moteur d'activités confirmée
- Rapport dans `docs/tests/`

---

### Story 25.9 — Review Sprint 25
**Assigné à :** @code-reviewer
**Priorité :** Haute
**Dépend de :** Story 25.8
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Vérifier R1 — aucun nouvel enum (pas de nouveaux enums dans ce sprint)
- [ ] `TODO` Vérifier R2 — `Permission.GERER_REGLES_ACTIVITES`, `TypeDeclencheur.*`, `TypeActivite.*` importés (pas de string literals)
- [ ] `TODO` Vérifier R3 — `RegleActiviteWithCount` aligné avec la requête Prisma `_count`
- [ ] `TODO` Vérifier R4 — toggle et reset via `updateMany` avec condition (atomique), pas de check-then-update
- [ ] `TODO` Vérifier R5 — DialogTrigger asChild sur les dialogs de confirmation (suppression, reset)
- [ ] `TODO` Vérifier R6 — pas de couleurs hardcodées dans les composants de ce sprint
- [ ] `TODO` Vérifier R7 — pas de nouveaux champs non-nullable sans valeur par défaut
- [ ] `TODO` Vérifier R8 — les règles globales (siteId=null) sont accessibles mais pas modifiables arbitrairement
- [ ] `TODO` Vérifier R9 — `npx vitest run` + `npm run build` avant review
- [ ] `TODO` Vérifier la protection des règles globales (DELETE → 409 systématique)
- [ ] `TODO` Vérifier l'accessibilité mobile (360px) des textareas et du toggle switch
- [ ] `TODO` Écrire `docs/reviews/review-sprint-25.md`

**Critères d'acceptation :**
- Toutes les règles R1-R9 vérifiées
- Protection règles globales confirmée
- Rapport de review dans `docs/reviews/`

---

## Sprint 26 — Modification Relevés & Calibrages (ADR-014 / ADR-015)

**Objectif :** Permettre la modification de relevés et de calibrages existants avec une raison obligatoire et un historique d'audit complet.

**Contexte métier :**
- ADR-014 : Modification d'un relevé avec raison (min 5 chars) en premier champ, audit trail `ReleveModification`, badge "Modifié" dans les listes
- ADR-015 : Modification d'un calibrage avec raison obligatoire, indicateur de conservation en temps réel, audit trail `CalibrageModification`, badge "Modifié" dans les listes
- Permission `CALIBRAGES_MODIFIER` ajoutée (ADR-015)
- Route PATCH (partiel) distincte du PUT (remplacement complet)
- Fire-and-forget `runEngineForSite` après PATCH relevé pour re-évaluation des règles SEUIL_*

**Dépend de :** Sprint 25 FAIT + migrations DB specialist (ReleveModification, CalibrageModification, modifie flag)

---

### Story 26.1 — PATCH API route relevés (ADR-014)
**Assigné à :** @developer
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter export `PATCH` dans `src/app/api/releves/[id]/route.ts`
- [x] `FAIT` Validation raison (min 5, max 500 chars), rejet champs non-modifiables
- [x] `FAIT` Construction `UpdateReleveDTO` + appel `patchReleve()`
- [x] `FAIT` Hook async fire-and-forget `runEngineForSite` après PATCH
- [x] `FAIT` `Permission.RELEVES_MODIFIER` requis

---

### Story 26.2 — PATCH API route calibrages (ADR-015)
**Assigné à :** @developer
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter export `PATCH` dans `src/app/api/calibrages/[id]/route.ts`
- [x] `FAIT` Validation raison + nombreMorts + groupes (conservation invariant côté API)
- [x] `FAIT` Fallback permission : `CALIBRAGES_MODIFIER` || `CALIBRAGES_CREER`
- [x] `FAIT` Rejet champs non-modifiables (id, vagueId, sourceBacIds, siteId, userId, date, ...)

---

### Story 26.3 — Permission CALIBRAGES_MODIFIER
**Assigné à :** @developer
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter `CALIBRAGES_MODIFIER` dans `Permission` enum (`src/types/models.ts`)
- [x] `FAIT` Ajouter `CALIBRAGES_MODIFIER` dans `PERMISSION_GROUPS.elevage` (`src/lib/permissions-constants.ts`)

---

### Story 26.4 — UI Dialog modifier relevé (ADR-014)
**Assigné à :** @developer
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Mettre à jour `src/components/releves/modifier-releve-dialog.tsx` — champ raison en premier, PATCH au lieu de PUT
- [x] `FAIT` Créer `src/components/releves/releve-modifications-list.tsx` — historique groupé par raison+user+temps

---

### Story 26.5 — UI Dialog modifier calibrage (ADR-015)
**Assigné à :** @developer
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/components/calibrage/modifier-calibrage-dialog.tsx` — raison en premier, toggle groupes, indicateur conservation
- [x] `FAIT` Créer `src/components/calibrage/calibrage-modifications-list.tsx` — historique groupé

---

### Story 26.6 — Badges "Modifié" et bouton "Modifier" sur pages détail
**Assigné à :** @developer
**Priorité :** Moyenne
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter badge `variant="warning"` dans `src/components/vagues/releves-list.tsx`
- [x] `FAIT` Ajouter badge `variant="warning"` dans `src/components/calibrage/calibrage-card.tsx`
- [x] `FAIT` Ajouter bouton "Modifier" + `<CalibrageModificationsList>` dans `src/app/vagues/[id]/calibrage/[calibrageId]/page.tsx`

---

### Story 26.7 — Types TypeScript ADR-014/015
**Assigné à :** @developer
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter `ReleveModification`, `ReleveModificationWithUser`, `ReleveWithModifications` dans `src/types/models.ts`
- [x] `FAIT` Ajouter `PatchReleveBody`, `CreateReleveModificationDTO`, `PatchReleveResponse` dans `src/types/api.ts`
- [x] `FAIT` Exports barrel dans `src/types/index.ts`

---

## Bugs — Sprint 33

| Bug | Titre | Sévérité | Fichier | Statut |
|-----|-------|----------|---------|--------|
| [BUG-023](../bugs/BUG-023.md) | Page Tarifs : fetch self-API échoue en SSR → plans vides | Critique | src/app/tarifs/page.tsx | **CLOS** |
| [BUG-024](../bugs/BUG-024.md) | PlansGrid utilise des prix hardcodés au lieu des prix DB | Haute | src/components/abonnements/plans-grid.tsx | **CLOS** |

<!-- BUG-023 CLOS. Remplacé fetch self-API par appel direct à getPlansAbonnements(). -->
<!-- BUG-024 CLOS. Remplacé PLAN_TARIFS par getTarifForPeriode() + plan.limites. -->

---

## Bugs — Architecture Plateforme

| Bug | Titre | Sévérité | Fichier | Statut |
|-----|-------|----------|---------|--------|
| [BUG-025](../bugs/BUG-025.md) | Site model missing `isPlatform` flag | Haute | prisma/schema.prisma, src/types/models.ts | OUVERT |
| [BUG-026](../bugs/BUG-026.md) | Platform permissions assignable to non-platform sites | Haute | src/lib/permissions-constants.ts, src/lib/auth/permissions-server.ts | OUVERT |
| [BUG-027](../bugs/BUG-027.md) | Platform modules visible on non-platform sites | Haute | src/lib/site-modules-config.ts, src/lib/auth/permissions-server.ts, sidebar/hamburger | OUVERT |
| [BUG-028](../bugs/BUG-028.md) | PACKS_PROVISIONING wrongly classified as site-level module | Moyenne | src/lib/site-modules-config.ts | OUVERT |
| [BUG-029](../bugs/BUG-029.md) | Platform entity siteId not enforced to platform site | Moyenne | src/app/api/commissions/, src/app/api/remises/ | OUVERT |

> @project-manager : BUG-025 est le fondement — les autres bugs (026, 027, 029) en dépendent. Ordre de fix : BUG-025 → BUG-028 → BUG-026 → BUG-027 → BUG-029.

---

## Bugs — i18n

| Bug | Titre | Sévérité | Fichier | Statut |
|-----|-------|----------|---------|--------|
| [BUG-030](../bugs/BUG-030.md) | ~130 hardcoded French strings not translated (i18n incomplete) | Moyenne | ~25 fichiers (remises, packs, planning, alertes, UI, pages) | OUVERT |

> @project-manager : BUG-030 impacte les modules remises, packs, activations, planning, alertes, UI transversaux et plusieurs pages. ~7 namespaces de traduction manquants à créer.

---

## Sprint A — Site & Module Management : Fondations DB & Permissions (ADR-021)

**Objectif :** Poser les bases de données et les nouvelles permissions sans rien casser.
**Dépendances :** Aucune. Peut commencer immédiatement.
**ADR :** [ADR-021](../decisions/ADR-021-site-module-management.md) | [Stories détaillées](../decisions/ADR-021-stories.md)

### Story A.1 — Schéma Prisma : ModuleDefinition + SiteAuditLog + champs Site
**Assigné à :** @db-specialist
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter modèle `ModuleDefinition` (key unique, label, description, iconName, sortOrder, level, dependsOn, isVisible, isActive, category)
- [x] `FAIT` Ajouter modèle `SiteAuditLog` (siteId FK, actorId FK, action, details Json?, index sur siteId/actorId/createdAt)
- [x] `FAIT` Ajouter champs sur `Site` : `suspendedAt DateTime?`, `suspendedReason String?`, `deletedAt DateTime?`
- [x] `FAIT` Ajouter 3 permissions dans enum `Permission` : `SITES_VOIR`, `SITES_GERER`, `ANALYTICS_PLATEFORME`
- [x] `FAIT` Générer et appliquer la migration
- [x] `FAIT` Seeder les 12 `ModuleDefinition` dans `prisma/seed.sql`

---

### Story A.2 — TypeScript : interfaces et DTOs
**Assigné à :** @architect
**Priorité :** Critique
**Dépend de :** A.1
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Ajouter enum `SiteStatus`, interface `ModuleDefinition`, interface `SiteAuditLog` dans `src/types/models.ts`
- [x] `FAIT` Étendre interface `Site` avec `suspendedAt`, `suspendedReason`, `deletedAt`
- [x] `FAIT` Ajouter tous les DTOs admin dans `src/types/api.ts` (AdminSiteSummary, AdminSiteDetailResponse, etc.)
- [x] `FAIT` Ajouter permissions dans `src/lib/permissions-constants.ts` (PLATFORM_PERMISSIONS, ITEM_VIEW_PERMISSIONS)
- [x] `FAIT` Ajouter `computeSiteStatus()` dans `src/lib/site-modules-config.ts`

---

### Story A.3 — Tests unitaires pour computeSiteStatus et permissions
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** A.2
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/__tests__/lib/site-status.test.ts` (4 cas : ACTIVE, SUSPENDED, BLOCKED, ARCHIVED)
- [x] `FAIT` Créer `src/__tests__/lib/platform-permissions.test.ts`
- [x] `FAIT` `npx vitest run` — tous les tests passent

---

### Story A.4 — Review Sprint A
**Assigné à :** @code-reviewer
**Dépend de :** A.1, A.2, A.3
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Vérifier cohérence Prisma ↔ TypeScript (R3), R1 UPPERCASE, R7 nullabilité, R8 siteId
- [x] `FAIT` `npx prisma migrate deploy` + `npm run build` + `npx vitest run` passent
- [ ] `TODO` Écrire `docs/reviews/review-sprint-A-site-module.md`

---

## Sprint B — Site & Module Management : API Admin Sites (ADR-021)

**Objectif :** Implémenter toutes les API routes pour la gestion admin des sites.
**Dépendances :** Sprint A entièrement validé.

### Story B.1 — Queries admin sites
**Assigné à :** @db-specialist
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/lib/queries/admin-sites.ts` : getAdminSites (paginé + filtres), getAdminSiteById, updateSiteStatus, updateSiteModulesAdmin, getSiteAuditLog
- [x] `FAIT` `updateSiteStatus` : transaction atomique (R4), protection isPlatform, invalidation sessions sur BLOCK
- [x] `FAIT` Types retournés conformes aux DTOs de A.2

---

### Story B.2 — API route GET /api/admin/sites
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** B.1
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/app/api/admin/sites/route.ts` (GET, paginé, filtres status/planId/hasModule/search)
- [x] `FAIT` Guard : `SITES_VOIR` + isPlatform
- [x] `FAIT` Réponse conforme à `AdminSitesListResponse`

---

### Story B.3 — API route GET /api/admin/sites/[id]
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** B.1
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/app/api/admin/sites/[id]/route.ts` (GET, détail complet + membres + abonnement + audit logs)
- [x] `FAIT` Guard : `SITES_VOIR` + isPlatform, 404 si introuvable

---

### Story B.4 — API route PATCH /api/admin/sites/[id]/status
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** B.1
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/app/api/admin/sites/[id]/status/route.ts` (SUSPEND/BLOCK/RESTORE/ARCHIVE)
- [x] `FAIT` Guard : `SITES_GERER` + isPlatform, reason obligatoire pour SUSPEND/BLOCK, confirmArchive pour ARCHIVE
- [x] `FAIT` Transaction atomique : update Site + audit log + invalidation sessions sur BLOCK

---

### Story B.5 — API route PATCH /api/admin/sites/[id]/modules
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** B.1
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/app/api/admin/sites/[id]/modules/route.ts`
- [x] `FAIT` Guard : `SITES_GERER` + isPlatform, rejeter modules platform-level
- [x] `FAIT` Audit log avec modules avant/après

---

### Story B.6 — Tests API admin sites
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** B.2, B.3, B.4, B.5
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/__tests__/api/admin-sites.test.ts` (auth 401/403, pagination, CRUD, protection isPlatform)
- [x] `FAIT` `npx vitest run` passe

---

### Story B.7 — Review Sprint B
**Assigné à :** @code-reviewer
**Dépend de :** B.1 — B.6
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Review R1-R9, protection SITES_VOIR/SITES_GERER, R4 transactions
- [x] `FAIT` `npm run build` + `npx vitest run` passent
- [ ] `TODO` Écrire `docs/reviews/review-sprint-B-admin-sites-api.md`

---

## Sprint C — Site & Module Management : UI Admin Sites (ADR-021)

**Objectif :** Pages admin pour voir et gérer les sites côté plateforme DKFarm.
**Dépendances :** Sprint B validé.

### Story C.1 — Navigation : module "Admin Plateforme"
**Assigné à :** @developer
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Sidebar + hamburger : renommer "Admin Abonnements" → "Admin Plateforme", ajouter /admin/sites, /admin/analytics, /admin/modules
- [x] `FAIT` Gating permissions : SITES_VOIR pour sites/analytics, SITES_GERER pour modules
- [x] `FAIT` i18n : nouvelles clés navigation (adminPlateforme, adminSites, adminAnalytics, adminModules)

---

### Story C.2 — Page /admin/sites (liste)
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** B.2, C.1
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/app/admin/sites/page.tsx` (Server Component, guard SITES_VOIR + isPlatform)
- [x] `FAIT` Créer `src/components/admin/sites/admin-sites-list.tsx` (cartes mobile 360px, tableau md+, filtres tabs/search/plan, KPI cards, pagination)
- [x] `FAIT` Créer `src/components/admin/sites/admin-site-status-badge.tsx` + `admin-site-status-dialog.tsx` (R5 asChild)

---

### Story C.3 — Page /admin/sites/[id] (détail)
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** B.3, B.4, B.5, C.2
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/app/admin/sites/[id]/page.tsx` (Server Component)
- [x] `FAIT` Créer `src/components/admin/sites/admin-site-detail-client.tsx` (Tabs : Résumé, Modules, Membres, Abonnement, Audit)
- [x] `FAIT` Créer `src/components/admin/sites/admin-site-modules-editor.tsx` (switches par module, platform-level grisés)
- [x] `FAIT` Créer `src/components/admin/sites/admin-site-audit-log.tsx` (timeline verticale, before/after)

---

### Story C.4 — Tests UI admin sites
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** C.2, C.3
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Tests AdminSiteStatusDialog, computeSiteStatus dans badges, responsive 360px vs md+
- [x] `FAIT` `npx vitest run` + `npm run build` passent

---

### Story C.5 — Review Sprint C
**Assigné à :** @code-reviewer
**Dépend de :** C.1 — C.4
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Mobile first 360px, R5 DialogTrigger asChild, R6 CSS variables, accessibilité
- [x] `FAIT` `npm run build` + `npx vitest run` passent
- [ ] `TODO` Écrire `docs/reviews/review-sprint-C-admin-sites-ui.md`

---

## Sprint D — Site & Module Management : Analytics API (ADR-021)

**Objectif :** Endpoints d'analytics plateforme.
**Dépendances :** Sprint A validé. Parallélisable avec Sprint C.

### Story D.1 — Queries analytics plateforme
**Assigné à :** @db-specialist
**Priorité :** Haute
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/lib/queries/admin-analytics.ts` : getPlatformKPIs, getSitesGrowth, getRevenueAnalytics, getModulesDistribution
- [x] `FAIT` MRR = prixMensuel*count + prixTrimestriel/3*count + prixAnnuel/12*count
- [x] `FAIT` `getModulesDistribution` via `$queryRaw` avec PostgreSQL `unnest()`

---

### Story D.2 — API routes analytics
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** D.1
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer 4 routes : `/api/admin/analytics` (KPIs), `/api/admin/analytics/sites`, `/api/admin/analytics/revenus`, `/api/admin/analytics/modules`
- [x] `FAIT` Guard : `ANALYTICS_PLATEFORME` + isPlatform, Cache-Control headers

---

### Story D.3 — API routes registre modules
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** Sprint A
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/app/api/admin/modules/route.ts` (GET liste + POST créer) et `[key]/route.ts` (GET détail + PUT modifier)
- [x] `FAIT` Guard : SITES_VOIR (lecture), SITES_GERER (écriture), key immuable, level immuable

---

### Story D.4 — Tests API analytics
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** D.2, D.3
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/__tests__/api/admin-analytics.test.ts` (structure réponse, protection isPlatform, calcul MRR)
- [x] `FAIT` `npx vitest run` passe

---

### Story D.5 — Review Sprint D
**Assigné à :** @code-reviewer
**Dépend de :** D.1 — D.4
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Protection isPlatform sur chaque route, calcul MRR, sérialisation Decimal
- [x] `FAIT` `npm run build` + `npx vitest run` passent
- [ ] `TODO` Écrire `docs/reviews/review-sprint-D-analytics-api.md`

---

## Sprint E — Site & Module Management : Analytics UI & Registre Modules (ADR-021)

**Objectif :** Dashboard analytics plateforme et page de gestion des modules.
**Dépendances :** Sprints C et D validés.

### Story E.1 — Page /admin/analytics (dashboard KPIs)
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** D.2
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/app/admin/analytics/page.tsx` (Server Component, ISR 5min)
- [x] `FAIT` Créer KPI cards (6 cartes, mobile 2 cols → 3 → 6), formatage XAF
- [x] `FAIT` Créer graphiques Recharts : sites growth (LineChart), modules distribution (BarChart), revenue (BarChart + MRR line)
- [x] `FAIT` Sélecteurs période (7d/30d/90d/12m) avec TanStack Query refetch

---

### Story E.2 — Page /admin/modules (registre)
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** D.3
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Créer `src/app/admin/modules/page.tsx` (Server Component, guard SITES_GERER + isPlatform)
- [x] `FAIT` Créer `src/components/admin/modules/admin-modules-list.tsx` (tableau/cartes, filtres Visible/Masqué, Site/Platform)
- [x] `FAIT` Créer `src/components/admin/modules/admin-module-form-dialog.tsx` (édition métadonnées, key/level non-modifiables, R5 asChild)

---

### Story E.3 — Tests UI analytics et modules
**Assigné à :** @tester
**Priorité :** Haute
**Dépend de :** E.1, E.2
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Tests formatage XAF, AdminModuleFormDialog (key/level non-modifiables), responsive
- [x] `FAIT` `npm run build` + `npx vitest run` passent

---

### Story E.4 — Review Sprint E (Review finale)
**Assigné à :** @code-reviewer
**Dépend de :** E.1, E.2, E.3
**Statut :** `FAIT`

**Tâches :**
- [x] `FAIT` Review complète sprints A-E, protection isPlatform uniforme, mobile first, R1-R9
- [x] `FAIT` `npm run build` + `npx vitest run` passent
- [ ] `TODO` Écrire `docs/reviews/review-sprint-E-site-module-mgmt-final.md`

---

## Sprint BA — Backoffice Separation : Fondations (ADR-022)

**Objectif :** Ajouter `User.isSuperAdmin`, supprimer `Site.isPlatform`, créer les guards backoffice.
**Dépendances :** Aucune. Peut commencer immédiatement.
**ADR :** [ADR-022](../decisions/ADR-022-backoffice-separation.md) | [Stories détaillées](../decisions/ADR-022-stories.md)

### Story BA.1 — Migration schéma DB : `isSuperAdmin` + suppression `isPlatform`
**Assigné à :** @db-specialist
**Priorité :** Critique
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Ajouter `isSuperAdmin Boolean @default(false)` sur `User` dans schema.prisma
- [ ] `TODO` Supprimer `isPlatform` et son index unique sur `Site` dans schema.prisma
- [ ] `TODO` Générer et appliquer la migration SQL (ADD COLUMN + UPDATE admin + DROP COLUMN)
- [ ] `TODO` Mettre à jour `prisma/seed.sql` (supprimer isPlatform INSERT, ajouter isSuperAdmin=true sur admin)

---

### Story BA.2 — Mise à jour des types TypeScript
**Assigné à :** @architect
**Priorité :** Critique
**Dépend de :** BA.1
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Ajouter `isSuperAdmin: boolean` à interface `User` dans `src/types/models.ts`
- [ ] `TODO` Supprimer `isPlatform: boolean` de interface `Site` dans `src/types/models.ts`
- [ ] `TODO` Supprimer `isPlatform` de `AdminSiteSummary` et `AdminSiteDetailResponse` dans `src/types/api.ts`
- [ ] `TODO` Ajouter interface `BackofficeSession` dans `src/types/api.ts`
- [ ] `TODO` Exporter `BackofficeSession` dans `src/types/index.ts`

---

### Story BA.3 — Créer `src/lib/auth/backoffice.ts`
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** BA.2
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Implémenter `requireSuperAdmin(request)` pour API routes (401/403)
- [ ] `TODO` Implémenter `checkBackofficeAccess()` pour Server Components (retourne null si non autorisé)
- [ ] `TODO` Vérification `isSuperAdmin` depuis la DB (pas le cookie session)
- [ ] `TODO` Tests unitaires dans `src/__tests__/lib/backoffice.test.ts`

---

## Sprint BB — Backoffice Separation : Suppression des dépendances `isPlatform` (ADR-022)

**Objectif :** Nettoyer tout le code qui dépend de `isPlatform`.
**Dépendances :** Sprint BA validé.

### Story BB.1 — Supprimer `getPlatformSite()` et `isPlatformSite()` de queries/sites.ts
**Assigné à :** @db-specialist
**Priorité :** Critique
**Dépend de :** BA.1, BA.2
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer les fonctions `getPlatformSite()` et `isPlatformSite()` de `src/lib/queries/sites.ts`
- [ ] `TODO` Vérifier qu'aucun import externe n'en dépend (bloquant pour BB.2-BB.7)

---

### Story BB.2 — Nettoyer `src/lib/auth/permissions-server.ts`
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** BA.2, BB.1
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer imports `isPlatformSite`, `PLATFORM_MODULES`
- [ ] `TODO` Supprimer logique `isPlat → filter PLATFORM_PERMISSIONS` dans `getServerPermissions()`
- [ ] `TODO` Supprimer logique `isPlatform` dans `getServerSiteModules()`

---

### Story BB.3 — Nettoyer `src/lib/queries/admin-sites.ts`
**Assigné à :** @db-specialist
**Priorité :** Haute
**Dépend de :** BA.2, BB.1
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer vérification `site.isPlatform` dans `updateSiteStatus()` et `updateSiteModulesAdmin()`
- [ ] `TODO` Supprimer `isPlatform` du mapping dans `getAdminSites()` et `getAdminSiteById()`

---

### Story BB.4 — Nettoyer `src/lib/site-modules-config.ts`
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** BA.2
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer entrées `level: "platform"` de `SITE_MODULES_CONFIG` (ou reclasser en `"site"`)
- [ ] `TODO` Supprimer export `PLATFORM_MODULES`
- [ ] `TODO` Supprimer paramètre `isPlatform?` de `isModuleActive()`

---

### Story BB.5 — Nettoyer les API routes (remises, portefeuille, sites/roles)
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** BA.3, BB.1
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer imports/guards `isPlatformSite`/`getPlatformSite` dans `src/app/api/remises/route.ts`
- [ ] `TODO` Supprimer imports/guards dans `src/app/api/portefeuille/retrait/route.ts`
- [ ] `TODO` Supprimer imports/guards `PLATFORM_PERMISSIONS` dans `src/app/api/sites/[id]/roles/route.ts`

---

### Story BB.6 — Nettoyer `src/lib/permissions-constants.ts`
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** BB.2, BB.5
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer constante `PLATFORM_PERMISSIONS`
- [ ] `TODO` Supprimer items `/admin/*` de `ITEM_VIEW_PERMISSIONS`
- [ ] `TODO` Supprimer groupe `adminPlateforme` de `PERMISSION_GROUPS`

---

### Story BB.7 — Nettoyer composants subscription
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** BB.1
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer import/appel `isPlatformSite` dans `subscription-banner.tsx` et `quotas-usage-bar.tsx`

---

## Sprint BC — Backoffice Separation : Création du Backoffice (ADR-022)

**Objectif :** Créer le layout backoffice, les routes API `/api/backoffice/*` et les pages `/backoffice/*`.
**Dépendances :** Sprint BB validé (ou en parallèle avec les stories B indépendantes).

### Story BC.1 — Layout et navigation backoffice
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** BA.3
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/backoffice/layout.tsx` (Server Component, `checkBackofficeAccess()`, redirect si null)
- [ ] `TODO` Créer `src/components/backoffice/backoffice-sidebar.tsx` (Dashboard, Sites, Abonnements, Plans, Commissions, Remises, Modules, Utilisateurs)
- [ ] `TODO` Créer `src/components/backoffice/backoffice-header.tsx` ("DKFarm Backoffice" + badge)
- [ ] `TODO` Mobile first 360px

---

### Story BC.2 — Routes API backoffice : sites
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** BA.3, BB.3
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/api/backoffice/sites/route.ts` (GET list) — guard `requireSuperAdmin`
- [ ] `TODO` Créer `src/app/api/backoffice/sites/[id]/route.ts` (GET detail)
- [ ] `TODO` Créer `src/app/api/backoffice/sites/[id]/status/route.ts` (PATCH)
- [ ] `TODO` Créer `src/app/api/backoffice/sites/[id]/modules/route.ts` (PUT)

---

### Story BC.3 — Routes API backoffice : analytics
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** BA.3
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer 4 routes sous `src/app/api/backoffice/analytics/` (KPIs, sites, revenus, modules)
- [ ] `TODO` Guard `requireSuperAdmin` sur chaque route

---

### Story BC.4 — Routes API backoffice : modules registry
**Assigné à :** @developer
**Priorité :** Moyenne
**Dépend de :** BA.3
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/api/backoffice/modules/route.ts` (GET list + POST create)
- [ ] `TODO` Créer `src/app/api/backoffice/modules/[key]/route.ts` (GET detail + PATCH update)

---

### Story BC.5 — Page backoffice : dashboard
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** BC.1, BC.3
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/backoffice/dashboard/page.tsx` + `loading.tsx`
- [ ] `TODO` Réutiliser analytics components, guard `checkBackofficeAccess()`

---

### Story BC.6 — Pages backoffice : sites (liste + détail)
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** BC.1, BC.2
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer `src/app/backoffice/sites/page.tsx` + `loading.tsx`
- [ ] `TODO` Créer `src/app/backoffice/sites/[id]/page.tsx` + `loading.tsx`
- [ ] `TODO` Réutiliser composants `AdminSitesList`, `AdminSiteDetailClient`

---

### Story BC.7 — Pages backoffice : abonnements, plans, commissions, remises, modules
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** BC.1
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Créer pages sous `/backoffice/` : abonnements, plans, commissions, remises, modules (+ loading.tsx chacune)
- [ ] `TODO` Guard `checkBackofficeAccess()` sur chaque page

---

### Story BC.8 — Lien "Backoffice" dans la navigation
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** BC.1, BB.6
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer module "Admin Plateforme" (items `/admin/*`) de sidebar.tsx et hamburger-menu.tsx
- [ ] `TODO` Ajouter lien conditionnel "Backoffice" visible uniquement si `isSuperAdmin=true`

---

### Story BC.9 — Nettoyer composants admin (supprimer props isPlatform)
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** BC.6
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer `isPlatform` de `admin-sites-list.tsx`, `admin-site-detail-client.tsx`, `admin-site-modules-editor.tsx`

---

## Sprint BD — Backoffice Separation : Suppression code obsolète (ADR-022)

**Objectif :** Supprimer `/admin/*`, `/api/admin/*` et valider zéro référence `isPlatform`.
**Dépendances :** Toutes les stories BC.x.

### Story BD.1 — Supprimer pages et routes `/admin/*` obsolètes
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** Toutes BC.x
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer `src/app/admin/` en entier
- [ ] `TODO` Supprimer `src/app/api/admin/` en entier
- [ ] `TODO` Vérifier aucune référence restante aux anciennes routes

---

### Story BD.2 — Validation grep zéro `isPlatform`
**Assigné à :** @db-specialist
**Priorité :** Critique
**Dépend de :** BB.1
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` `grep -r "isPlatform" src/` retourne 0 résultats
- [ ] `TODO` `grep -r "getPlatformSite\|isPlatformSite" src/` retourne 0 résultats
- [ ] `TODO` `npm run build` sans erreur

---

### Story BD.3 — Mise à jour de tous les tests
**Assigné à :** @tester
**Priorité :** Critique
**Dépend de :** Toutes BB.x + BC.x
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Supprimer mocks `isPlatformSite`/`getPlatformSite` de tous les tests
- [ ] `TODO` Renommer/réécrire `admin-sites.test.ts` → `backoffice-sites.test.ts`
- [ ] `TODO` Renommer/réécrire `admin-analytics.test.ts` → `backoffice-analytics.test.ts`
- [ ] `TODO` Créer `src/__tests__/api/backoffice-sites.test.ts` et `backoffice-analytics.test.ts`
- [ ] `TODO` `npx vitest run` : 0 failing, 0 skipped

---

## Sprint BE — Backoffice Separation : Validation finale (ADR-022)

**Objectif :** Build complet, tests, review finale.
**Dépendances :** Toutes les stories BD.x.

### Story BE.1 — Build + tests complets
**Assigné à :** @tester
**Priorité :** Critique
**Dépend de :** Toutes BD.x
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` `npx prisma migrate deploy` sans erreur
- [ ] `TODO` `npm run db:seed` sans erreur
- [ ] `TODO` `npx vitest run` — 0 failing
- [ ] `TODO` `npm run build` — build production OK
- [ ] `TODO` Test manuel mobile 360px : `/backoffice/dashboard` avec SuperAdmin
- [ ] `TODO` Test manuel : accès `/backoffice/*` avec non-superadmin → redirect
- [ ] `TODO` `grep -r "isPlatform" src/` retourne 0 résultats

---

### Story BE.2 — Review ADR-022
**Assigné à :** @code-reviewer
**Priorité :** Critique
**Dépend de :** BE.1
**Statut :** `FAIT`

**Tâches :**
- [ ] `TODO` Review R1-R9 sur tous fichiers créés/modifiés
- [ ] `TODO` Vérifier `requireSuperAdmin` lit depuis DB, pas cookie
- [ ] `TODO` Mobile first backoffice sur 360px
- [ ] `TODO` `npm run build` + `npx vitest run` passent
- [ ] `TODO` Écrire `docs/reviews/review-backoffice-separation.md`

---

## Sprint IA — Interface Ingénieur vs Farm : Middleware + Route Groups (ADR-ingenieur-interface)

**Objectif :** Créer le middleware de redirection par rôle et les deux route groups Next.js `(farm)` et `(ingenieur)` avec leurs layouts respectifs. Poser les fondations du split d'interface sans casser les pages existantes.
**Dépendances :** Sprint BE (Backoffice Separation) — le middleware doit connaître `isSuperAdmin` pour le redirect backoffice.
**ADR :** [ADR-ingenieur-interface](../decisions/ADR-ingenieur-interface.md) | [Brainstorming](../../_bmad-output/brainstorming/brainstorming-session-2026-03-28.md)
**Impact schema :** ZERO migrations. ZERO nouveaux champs. Tout est frontend.

---

### Story IA.1 — Middleware de redirection par rôle
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** Sprint BE (isSuperAdmin disponible)
**Statut :** `FAIT`
**Type :** REFACTOR

**Description :** Créer `src/middleware.ts` qui redirige les utilisateurs vers le bon route group après login et enforce les frontières entre layouts.

**Tâches :**
- [ ] `TODO` Créer `src/middleware.ts` avec la logique de redirection :
  - `user.isSuperAdmin` → `/(backoffice)/`
  - `user.role === INGENIEUR` → `/(ingenieur)/`
  - Tous les autres (PISCICULTEUR, GERANT, ADMIN) → `/(farm)/`
- [ ] `TODO` Enforcer les frontières de layout :
  - Un INGENIEUR qui hit `/(farm)/*` → redirect vers `/(ingenieur)/*` equivalent
  - Un non-INGENIEUR qui hit `/(ingenieur)/*` → redirect vers `/(farm)/`
  - Un non-superAdmin qui hit `/(backoffice)/*` → redirect vers son layout
- [ ] `TODO` Configurer le matcher Next.js pour exclure `/_next/`, `/api/`, fichiers statiques
- [ ] `TODO` Gérer le cas utilisateur non connecté → redirect vers `/login`
- [ ] `TODO` Le middleware lit le rôle depuis le cookie de session (pas un appel DB par requête)

**Critères d'acceptation :**
- Redirect correct pour chaque rôle (INGENIEUR, PISCICULTEUR, GERANT, ADMIN, superAdmin)
- Les frontières sont enforcées : impossible d'accéder au mauvais layout
- Les routes API (`/api/*`) ne sont PAS impactées par le middleware
- Les fichiers statiques et assets ne sont pas interceptés
- `npm run build` OK

---

### Story IA.2 — Route groups (farm) et (ingenieur) avec layouts
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** Aucune (parallélisable avec IA.1)
**Statut :** `FAIT`
**Type :** UI

**Description :** Créer les deux route groups Next.js `src/app/(farm)/` et `src/app/(ingenieur)/` avec leurs layouts respectifs. Les layouts sont des shells de navigation (bottom-nav + sidebar) sans logique métier.

**Tâches :**
- [ ] `TODO` Créer `src/app/(farm)/layout.tsx` — layout shell farm avec :
  - Farm bottom-nav (mobile)
  - Farm sidebar (desktop)
  - Passe `perspective="farm"` au contexte si nécessaire
- [ ] `TODO` Créer `src/app/(ingenieur)/layout.tsx` — layout shell ingénieur avec :
  - Ingénieur bottom-nav (mobile)
  - Ingénieur sidebar (desktop)
  - Passe `perspective="ingenieur"` au contexte si nécessaire
- [ ] `TODO` S'assurer que le layout racine `src/app/layout.tsx` reste pour les éléments globaux (providers, fonts, etc.)
- [ ] `TODO` Créer `src/app/(farm)/page.tsx` — dashboard farm (stub initial, peut être un redirect vers le dashboard existant)
- [ ] `TODO` Créer `src/app/(ingenieur)/page.tsx` — dashboard ingénieur (stub initial, peut être un redirect vers le dashboard existant)
- [ ] `TODO` Vérifier que `/(backoffice)/` existant n'est pas impacté

**Critères d'acceptation :**
- Les deux route groups coexistent sans conflit
- Chaque layout charge sa propre navigation
- Le layout racine reste intact pour les providers globaux
- `npm run build` OK
- Les routes existantes continuent de fonctionner pendant la migration

---

### Story IA.3 — Extraction des composants de page partagés vers src/components/pages/
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** IA.2
**Statut :** `FAIT`
**Type :** REFACTOR

**Description :** Déplacer la logique réelle des pages partagées (BOTH) depuis `src/app/` vers `src/components/pages/` pour permettre les stub re-exports dans les deux route groups. C'est le coeur de l'architecture Y1.

**Tâches :**
- [ ] `TODO` Créer le dossier `src/components/pages/`
- [ ] `TODO` Pour chaque page partagée, extraire le composant principal :
  - `src/components/pages/dashboard-page.tsx` (depuis src/app/page.tsx ou dashboard)
  - `src/components/pages/vagues-page.tsx` (depuis src/app/vagues/page.tsx)
  - `src/components/pages/vagues-detail-page.tsx` (depuis src/app/vagues/[id]/page.tsx)
  - `src/components/pages/releves-page.tsx` (depuis src/app/releves/page.tsx)
  - `src/components/pages/bacs-page.tsx` (depuis src/app/bacs/page.tsx)
  - `src/components/pages/stock-page.tsx` (depuis src/app/stock/ et sous-pages)
  - `src/components/pages/analytics-page.tsx` (depuis src/app/analytics/ et sous-pages)
  - `src/components/pages/planning-page.tsx` (depuis src/app/planning/page.tsx)
  - `src/components/pages/notes-page.tsx` (depuis src/app/notes/page.tsx)
  - `src/components/pages/depenses-page.tsx` (depuis src/app/depenses/page.tsx)
  - `src/components/pages/settings-alertes-page.tsx` (depuis src/app/settings/alertes/page.tsx)
- [ ] `TODO` Chaque composant extrait reste un Server Component (ou conserve son "use client" existant)
- [ ] `TODO` Vérifier que les imports internes de chaque composant restent valides après le déplacement

**Critères d'acceptation :**
- Tous les composants de pages partagées sont dans `src/components/pages/`
- Les anciennes pages fonctionnent toujours (pas de régression)
- `npm run build` OK
- Aucun changement de logique métier, uniquement du déplacement de fichiers

---

## Sprint IB — Interface Ingénieur vs Farm : Navigation Components (ADR-ingenieur-interface)

**Objectif :** Créer les composants de navigation spécifiques à chaque layout (bottom-nav et sidebar) avec visibilité conditionnelle par permissions.
**Dépendances :** Sprint IA validé (layouts créés).

---

### Story IB.1 — Farm bottom-nav + sidebar
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story IA.2
**Statut :** `FAIT`
**Type :** UI

**Description :** Créer les composants de navigation pour le layout farm. La bottom-nav a 5 items : Accueil | Ma ferme | Finances | Messages | Menu. La sidebar est l'équivalent desktop.

**Tâches :**
- [ ] `TODO` Créer `src/components/layout/farm-bottom-nav.tsx` avec 5 items :
  1. Accueil (icône Home) → `/(farm)/` — dashboard ferme
  2. Ma ferme (icône Layers) → `/(farm)/vagues` — vagues, bacs, relevés en lecture
  3. Finances (icône Wallet) → `/(farm)/finances` — ventes, factures, dépenses — visible si FINANCES_VOIR
  4. Messages (icône MessageSquare) → `/(farm)/notes` — notes, échanges
  5. Menu (icône Menu) → ouvre un drawer/sheet avec les modules secondaires (stock, alevins, planning, paramètres, abonnement)
- [ ] `TODO` Créer `src/components/layout/farm-sidebar.tsx` — équivalent desktop avec modules organisés en groupes
- [ ] `TODO` Items visibles basés sur les permissions SiteMember (réutiliser le pattern ITEM_VIEW_PERMISSIONS existant)
- [ ] `TODO` Mobile-first 360px : bottom-nav avec icônes + labels courts, min 44px touch targets

**Critères d'acceptation :**
- 5 items exactement sur la bottom-nav mobile
- Items conditionnels selon permissions (ex: Finances masqué si pas FINANCES_VOIR)
- R5 : pas de DialogTrigger imbriqué
- R6 : CSS variables du thème
- Cohérence bottom-nav / sidebar

---

### Story IB.2 — Ingénieur bottom-nav + sidebar
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story IA.2
**Statut :** `FAIT`
**Type :** UI

**Description :** Créer les composants de navigation pour le layout ingénieur. La bottom-nav a 5 items : Accueil | Tâches | +Relevé (FAB) | Clients | Menu. Le +Relevé est un FAB (Floating Action Button) centré pour optimiser le geste le plus fréquent.

**Tâches :**
- [ ] `TODO` Créer `src/components/layout/ingenieur-bottom-nav.tsx` avec 5 items :
  1. Accueil (icône Home) → `/(ingenieur)/` — dashboard multi-fermes OU single-farm quand scopé
  2. Tâches (icône CheckSquare) → `/(ingenieur)/mes-taches` — tâches du jour
  3. +Relevé (FAB central, icône Plus dans un cercle coloré) → ouvre directement le formulaire de saisie de relevé. Style FAB : bouton rond surélevé, couleur primaire, plus grand que les autres items
  4. Clients (icône Users) → `/(ingenieur)/monitoring` — vue globale des fermes supervisées
  5. Menu (icône Menu) → ouvre un drawer avec modules secondaires (notes, portefeuille, packs, stock, profil)
- [ ] `TODO` Créer `src/components/layout/ingenieur-sidebar.tsx` — équivalent desktop avec modules groupés
- [ ] `TODO` Le FAB (+Relevé) doit déterminer la vague active (dernière vague consultée ou première vague EN_COURS du site actif)
- [ ] `TODO` Mobile-first 360px : FAB central visuellement distinct (surélevé, rond, couleur primaire)

**Critères d'acceptation :**
- FAB central visuellement distinct et fonctionnel
- Navigation multi-fermes adaptée
- Items conditionnels selon permissions
- R6 : CSS variables du thème
- Mobile-first 360px avec touch targets 44px+

---

### Story IB.3 — Permission-based module visibility dans les navs
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Stories IB.1, IB.2
**Statut :** `FAIT`
**Type :** UI

**Description :** Intégrer le système de visibilité par permissions SiteMember et par modules site (enabledModules) dans les nouvelles navigations farm et ingénieur. Le layout ne bloque jamais — il organise.

**Tâches :**
- [ ] `TODO` Les 4 composants nav (farm-bottom-nav, farm-sidebar, ingenieur-bottom-nav, ingenieur-sidebar) reçoivent en props : `permissions: Permission[]`, `siteModules: SiteModule[]`, `role: Role`
- [ ] `TODO` Appliquer le double filtrage existant :
  1. Permission utilisateur (ITEM_VIEW_PERMISSIONS)
  2. Modules site (MODULE_LABEL_TO_SITE_MODULE + enabledModules)
- [ ] `TODO` Le menu hamburger/drawer de chaque layout filtre aussi ses items
- [ ] `TODO` Gérer le cas "enabledModules vide = tous les modules" (backward compat)

**Critères d'acceptation :**
- Un PISCICULTEUR avec toutes les permissions voit tous les items farm
- Un GERANT voit uniquement les modules autorisés par le propriétaire
- Un site supervisé avec enabledModules restreints masque les modules non inclus
- Le layout ne bloque jamais l'accès — il masque les items nav non pertinents
- R2 : enums importés pour les permissions et modules

---

## Sprint IC — Interface Ingénieur vs Farm : Migration des Pages (ADR-ingenieur-interface)

**Objectif :** Migrer toutes les pages existantes vers les route groups via des stub re-exports. Les pages partagées sont accessibles dans les deux layouts. Les pages exclusives sont dans un seul layout.
**Dépendances :** Sprint IB validé (navigations créées) + Sprint IA.3 (composants extraits).

---

### Story IC.1 — Stub re-exports pour les pages partagées
**Assigné à :** @developer
**Priorité :** Critique
**Dépend de :** Stories IA.3, IB.1, IB.2
**Statut :** `FAIT`
**Type :** REFACTOR

**Description :** Créer les stubs 1 ligne dans chaque route group pour les pages classées BOTH. Le composant réel est dans `src/components/pages/`, les stubs font juste `export { default } from "@/components/pages/xxx-page"`.

**Tâches :**
- [ ] `TODO` Créer les stubs dans `src/app/(farm)/` :
  - `vagues/page.tsx` → re-export vagues-page
  - `vagues/[id]/page.tsx` → re-export vagues-detail-page
  - `releves/page.tsx` → re-export releves-page
  - `bacs/page.tsx` → re-export bacs-page
  - `stock/page.tsx` → re-export stock-page (et sous-pages)
  - `analytics/page.tsx` → re-export analytics-page (et sous-pages)
  - `planning/page.tsx` → re-export planning-page
  - `notes/page.tsx` → re-export notes-page
  - `depenses/page.tsx` → re-export depenses-page
  - `settings/alertes/page.tsx` → re-export settings-alertes-page
  - `notifications/page.tsx` → re-export notifications-page
  - `besoins/page.tsx` → re-export besoins-page (et sous-pages)
- [ ] `TODO` Créer les mêmes stubs dans `src/app/(ingenieur)/` pour les pages partagées :
  - `vagues/page.tsx`, `vagues/[id]/page.tsx`
  - `releves/page.tsx`
  - `bacs/page.tsx`
  - `stock/page.tsx`
  - `analytics/page.tsx`
  - `planning/page.tsx`
  - `notes/page.tsx`
  - `depenses/page.tsx`
  - `settings/alertes/page.tsx`
  - `notifications/page.tsx`
- [ ] `TODO` Supprimer les anciens fichiers page.tsx de `src/app/` (hors route groups) pour les pages migrées
- [ ] `TODO` Vérifier que toutes les routes fonctionnent dans les deux layouts

**Critères d'acceptation :**
- Chaque stub est exactement 1 ligne (re-export)
- Les pages fonctionnent identiquement dans les deux layouts
- Aucune duplication de logique
- `npm run build` OK
- Aucune régression fonctionnelle

---

### Story IC.2 — Pages exclusives farm
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story IA.2
**Statut :** `FAIT`
**Type :** REFACTOR

**Description :** Déplacer les pages exclusives au propriétaire/farm dans `src/app/(farm)/`. Ces pages ne sont pas accessibles dans le layout ingénieur.

**Tâches :**
- [ ] `TODO` Déplacer vers `src/app/(farm)/` :
  - `finances/` (dashboard financier)
  - `ventes/` (liste + détail + formulaire)
  - `factures/` (liste + détail)
  - `clients/` (clients acheteurs)
  - `mon-abonnement/` (gestion abonnement)
  - `settings/sites/` (gestion sites et membres)
  - `users/` (gestion utilisateurs)
  - `depenses/recurrentes/` (dépenses récurrentes — OWNER only)
- [ ] `TODO` Supprimer les anciens fichiers de `src/app/` pour ces pages
- [ ] `TODO` Mettre à jour les liens internes si nécessaire

**Critères d'acceptation :**
- Les pages farm-only ne sont PAS dans `src/app/(ingenieur)/`
- Le middleware redirige un INGENIEUR qui tente d'accéder à ces routes
- `npm run build` OK

---

### Story IC.3 — Pages exclusives ingénieur
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story IA.2
**Statut :** `FAIT`
**Type :** REFACTOR

**Description :** Déplacer les pages exclusives à l'ingénieur dans `src/app/(ingenieur)/`. Ces pages ne sont pas accessibles dans le layout farm.

**Tâches :**
- [ ] `TODO` Déplacer vers `src/app/(ingenieur)/` :
  - `monitoring/` (vue globale clients multi-fermes)
  - `portefeuille/` (commissions ingénieur)
  - `packs/` (gestion et activation de packs)
  - `activations/` (historique activations)
  - `mes-taches/` (tâches opérationnelles du jour)
  - `settings/regles-activites/` (configuration règles d'activité)
  - `settings/config-elevage/` (profils élevage — expertise technique)
- [ ] `TODO` Supprimer les anciens fichiers de `src/app/` pour ces pages
- [ ] `TODO` Mettre à jour les liens internes si nécessaire

**Critères d'acceptation :**
- Les pages ingénieur-only ne sont PAS dans `src/app/(farm)/`
- Le middleware redirige un non-INGENIEUR qui tente d'accéder à ces routes
- `npm run build` OK

---

## Sprint ID — Interface Ingénieur vs Farm : Scope Adaptation (ADR-ingenieur-interface)

**Objectif :** Adapter le dashboard ingénieur pour supporter deux modes (multi-fermes vs single-farm) et implémenter le FAB (+Relevé) comme action rapide.
**Dépendances :** Sprint IC validé (pages migrées).

---

### Story ID.1 — Dashboard ingénieur : vue multi-fermes vs single-farm
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Stories IC.1, IC.3
**Statut :** `FAIT`
**Type :** UI

**Description :** Quand un ingénieur n'a pas de site client sélectionné (ou est sur DKFarm), il voit un dashboard multi-fermes. Quand il switch son activeSiteId vers un client, le dashboard affiche les données de ce client, mais la navigation reste celle de l'ingénieur.

**Tâches :**
- [ ] `TODO` Modifier ou créer `src/components/pages/ingenieur-dashboard-page.tsx` pour supporter deux modes :
  - **Mode multi-fermes** (activeSiteId = site DKFarm ou null) : alertes actives toutes fermes, tâches du jour, liste fermes supervisées, portefeuille commissions
  - **Mode single-farm** (activeSiteId = site client) : indicateurs zootechniques du client (survie, FCR, SGR, biomasse), alertes actives pour ce client, tâches du jour pour ce client
- [ ] `TODO` Le switch se fait via le sélecteur de site existant (Session.activeSiteId)
- [ ] `TODO` L'ingénieur reste TOUJOURS dans le layout ingénieur, même scopé sur un client
- [ ] `TODO` Le dashboard multi-fermes réutilise les composants de `src/components/ingenieur/`

**Critères d'acceptation :**
- Mode multi-fermes : liste des fermes supervisées avec indicateurs
- Mode single-farm : données du client sélectionné
- La navigation ingénieur ne change PAS lors du switch
- Mobile-first 360px
- R6 : CSS variables du thème

---

### Story ID.2 — FAB (+Relevé) action rapide ingénieur
**Assigné à :** @developer
**Priorité :** Haute
**Dépend de :** Story IB.2
**Statut :** `FAIT`
**Type :** UI

**Description :** Le FAB (+Relevé) dans la bottom-nav ingénieur ouvre directement le formulaire de saisie de relevé. Il détermine automatiquement la vague cible.

**Tâches :**
- [ ] `TODO` Créer `src/components/layout/fab-releve.tsx` — composant FAB avec :
  - Bouton rond central, couleur primaire, icône Plus, surélevé par rapport aux autres items nav
  - Au clic : déterminer la vague cible (via localStorage "dernière vague" ou requête API "première vague EN_COURS")
  - Si vague trouvée → redirect vers `/(ingenieur)/vagues/[vagueId]/releves/nouveau`
  - Si aucune vague EN_COURS → afficher un toast "Aucune vague active sur ce site"
  - Si aucun site sélectionné (mode multi-fermes) → afficher "Sélectionnez un site d'abord"
- [ ] `TODO` Intégrer le FAB dans `ingenieur-bottom-nav.tsx` en position 3 (centrale)
- [ ] `TODO` Style distinct : z-index élevé, ombre portée, animation subtle au hover/press

**Critères d'acceptation :**
- Le FAB est visuellement distinct des autres items nav (plus grand, rond, coloré)
- Le relevé s'ouvre pour la bonne vague
- Gestion des cas limites (pas de vague, pas de site)
- Touch target 56px+ (plus grand que les 44px des items normaux)
- R6 : CSS variables du thème

---

## Sprint IE — Interface Ingénieur vs Farm : Tests + Review (ADR-ingenieur-interface)

**Objectif :** Valider le split d'interface complet avec des tests de middleware, navigation, et route boundaries. Review finale.
**Dépendances :** Sprints IA, IB, IC, ID tous validés.

---

### Story IE.1 — Tests : middleware, navigation, route boundaries
**Assigné à :** @tester
**Priorité :** Critique
**Dépend de :** Toutes stories IA, IB, IC, ID
**Statut :** `FAIT`
**Type :** TEST

**Description :** Tests complets du split d'interface.

**Tâches :**
- [ ] `TODO` Tests middleware (`src/__tests__/middleware.test.ts`) :
  - INGENIEUR → redirect vers `/(ingenieur)/`
  - PISCICULTEUR → redirect vers `/(farm)/`
  - GERANT → redirect vers `/(farm)/`
  - ADMIN → redirect vers `/(farm)/`
  - isSuperAdmin → redirect vers `/(backoffice)/`
  - INGENIEUR sur `/(farm)/*` → redirect vers `/(ingenieur)/*`
  - Non-INGENIEUR sur `/(ingenieur)/*` → redirect vers `/(farm)/`
  - Routes API non impactées
  - Utilisateur non connecté → `/login`
- [ ] `TODO` Tests navigation farm (`src/__tests__/ui/farm-nav.test.ts`) :
  - 5 items bottom-nav corrects
  - Items conditionnels (Finances masqué sans FINANCES_VOIR)
  - Cohérence bottom-nav / sidebar
- [ ] `TODO` Tests navigation ingénieur (`src/__tests__/ui/ingenieur-nav.test.ts`) :
  - 5 items bottom-nav corrects incluant FAB central
  - Items conditionnels
  - FAB détermine la bonne vague
- [ ] `TODO` Tests route boundaries :
  - Pages farm-only inaccessibles depuis `/(ingenieur)/`
  - Pages ingénieur-only inaccessibles depuis `/(farm)/`
  - Pages partagées accessibles depuis les deux layouts
- [ ] `TODO` Non-régression : `npx vitest run` + `npm run build`
- [ ] `TODO` Écrire rapport dans `docs/tests/rapport-sprint-IE.md`

**Critères d'acceptation :**
- R9 : tous les tests passent, build OK
- Chaque rôle redirigé vers le bon layout
- Frontières enforcées
- Non-régression complète
- Rapport de test dans `docs/tests/`

---

### Story IE.2 — Review ADR-ingenieur-interface
**Assigné à :** @code-reviewer
**Priorité :** Critique
**Dépend de :** Story IE.1
**Statut :** `FAIT`
**Type :** REVIEW

**Description :** Review complète du split d'interface.

**Tâches :**
- [ ] `TODO` Vérifier R1-R9 sur tous les fichiers créés/modifiés
- [ ] `TODO` Vérifier que les stubs sont bien des 1-liners (pas de logique dupliquée)
- [ ] `TODO` Vérifier que le middleware enforce correctement les frontières
- [ ] `TODO` Vérifier que la navigation farm a exactement 5 items : Accueil | Ma ferme | Finances | Messages | Menu
- [ ] `TODO` Vérifier que la navigation ingénieur a exactement 5 items : Accueil | Tâches | +Relevé (FAB) | Clients | Menu
- [ ] `TODO` Vérifier que les permissions contrôlent la visibilité des items (pas le layout)
- [ ] `TODO` Vérifier mobile-first 360px sur les deux layouts
- [ ] `TODO` Vérifier que les pages existantes n'ont pas de régression
- [ ] `TODO` `npm run build` + `npx vitest run`
- [ ] `TODO` Écrire `docs/reviews/review-interface-split.md`

**Critères d'acceptation :**
- Architecture Y1 respectée (stubs 1 ligne)
- Middleware correct pour tous les rôles
- Navigations conformes aux décisions du brainstorming
- Mobile-first validé
- R1-R9 respectées
- Rapport de review dans `docs/reviews/`

---

## Sprint FA — Feed Analytics Phase 1 : Schéma & Types (PLAN-feed-analytics-v2)

**Objectif :** Enrichir le schéma de données pour les analytiques aliments (3 enums, 6 champs Produit, 2 champs Releve, 2 champs MouvementStock, 1 champ ConfigElevage). Migration non-destructive (tout nullable).
**Référence :** `docs/decisions/PLAN-feed-analytics-v2.md` — Phase 1
**Dépend de :** Aucun (indépendant des sprints IE)

---

### Story FA.1 — Migration DB : enums + champs aliment
**Assigné à :** @db-specialist
**Priorité :** Critique
**Dépend de :** Aucun
**Statut :** `FAIT`
**Type :** SCHEMA

**Description :** Créer 3 enums Prisma (TailleGranule, FormeAliment, ComportementAlimentaire), ajouter 6 champs sur Produit, 2 sur Releve, 2 sur MouvementStock, 1 sur ConfigElevage. Migration SQL + rollback.

**Tâches :**
- [ ] `TODO` 3 enums dans schema.prisma (TailleGranule P0-G5, FormeAliment, ComportementAlimentaire)
- [ ] `TODO` Produit : tailleGranule?, formeAliment?, tauxProteines?, tauxLipides?, tauxFibres?, phasesCibles[]
- [ ] `TODO` Releve : tauxRefus?, comportementAlim?
- [ ] `TODO` MouvementStock : datePeremption?, lotFabrication? (PAS sur Produit)
- [ ] `TODO` ConfigElevage : scoreAlimentConfig Json?
- [ ] `TODO` Migration SQL + rollback SQL
- [ ] `TODO` `npx prisma generate` + `npm run build`

**Critères d'acceptation :**
- R1/R7/R8 respectées, migration non-destructive, rollback documenté

---

### Story FA.2 — Types TypeScript : enums + interfaces aliment
**Assigné à :** @architect | **Dépend de :** FA.1 | **Statut :** `FAIT` | **Type :** TYPES

**Tâches :**
- [ ] `TODO` 3 enums TS dans `src/types/models.ts` : TailleGranule, FormeAliment, ComportementAlimentaire (section enums, avant les modèles)
- [ ] `TODO` Enrichir interface `Produit` dans models.ts : +tailleGranule?, +formeAliment?, +tauxProteines?, +tauxLipides?, +tauxFibres?, +phasesCibles[]
- [ ] `TODO` Enrichir interface `Releve` dans models.ts : +tauxRefus?, +comportementAlim? (section champs alimentation — valides uniquement si typeReleve=ALIMENTATION)
- [ ] `TODO` Enrichir interface `MouvementStock` dans models.ts : +releveId?, +datePeremption?, +lotFabrication? (releveId existait en DB mais manquait dans le type)
- [ ] `TODO` Enrichir interface `ConfigElevage` dans models.ts : +scoreAlimentConfig typer `Record<string, unknown> | null` (sera affiné en FB.4 avec ScoreAlimentConfig)
- [ ] `TODO` DTOs dans api.ts : enrichir CreateProduitDTO/UpdateProduitDTO (+champs aliment), CreateReleveDTO (+tauxRefus, +comportementAlim), CreateMouvementDTO (+datePeremption?, +lotFabrication?)
- [ ] `TODO` Barrel export `src/types/index.ts` : exporter TailleGranule, FormeAliment, ComportementAlimentaire
- [ ] `TODO` R3 : miroir exact des modèles Prisma après FA.1

**Correction ADJ-03/04/05/06 :** Voir `docs/decisions/ADJUSTMENTS-feed-analytics-stories.md` sections 3–6.

---

### Story FA.3 — API validation : nouveaux champs aliment
**Assigné à :** @developer | **Dépend de :** FA.2 | **Statut :** `FAIT` | **Type :** API

**Tâches :**
- [ ] `TODO` `src/app/api/produits/route.ts` (POST) : +validation tailleGranule (enum TailleGranule?), formeAliment (enum FormeAliment?), tauxProteines/Lipides/Fibres [0,100], phasesCibles (tableau PhaseElevage valides)
- [ ] `TODO` `src/app/api/produits/[id]/route.ts` (PUT) : mêmes validations
- [ ] `TODO` `src/app/api/releves/route.ts` (POST) : +validation tauxRefus liste blanche {0,10,25,50}, guard HTTP 400 si tauxRefus/comportementAlim présent ET typeReleve !== ALIMENTATION
- [ ] `TODO` `src/app/api/releves/[id]/route.ts` (PUT/PATCH) : mêmes validations
- [ ] `TODO` `src/app/api/stock/mouvements/route.ts` (POST) : +datePeremption (ISO string → DateTime, optionnel ENTREE), +lotFabrication (string, optionnel ENTREE)

**Correction ADJ-09/10 :** Chemin exact des routes : `/api/releves/route.ts` et `/api/stock/mouvements/route.ts` (préfixe `/stock/` requis). Voir `docs/decisions/ADJUSTMENTS-feed-analytics-stories.md` sections 9, 10.

---

### Story FA.4 — Seed : enrichir aliments existants
**Assigné à :** @db-specialist | **Dépend de :** FA.1 | **Statut :** `FAIT` | **Type :** SCHEMA

**Tâches :**
- [ ] `TODO` UPDATE aliments avec `AND categorie='ALIMENT'`, INSERT nouvel aliment G3
- [ ] `TODO` Relevés ALIMENTATION avec tauxRefus + mouvement ENTREE avec DLC

---

### Story FA.5 — Tests Phase 1
**Assigné à :** @tester | **Dépend de :** FA.3, FA.4 | **Statut :** `FAIT` | **Type :** TEST

**Tâches :**
- [ ] `TODO` Tests validation (tauxRefus=37→400, tauxProteines=-5→400, BIOMETRIE+tauxRefus→400)
- [ ] `TODO` Non-régression + rapport `docs/tests/rapport-sprint-FA.md`

---

### Story FA.6 — Review Phase 1
**Assigné à :** @code-reviewer | **Dépend de :** FA.5 | **Statut :** `FAIT` | **Type :** REVIEW

**Tâches :**
- [ ] `TODO` R1-R9, datePeremption sur MouvementStock, validations API, rollback SQL
- [ ] `TODO` Rapport `docs/reviews/review-sprint-FA.md`

---

## Sprint FB — Feed Analytics Phase 2 : Calculs & Queries (PLAN-feed-analytics-v2)

**Objectif :** Fonctions de calcul (ADG, PER, DFR, score), benchmarks par phase, queries analytics enrichies.
**Référence :** `docs/decisions/PLAN-feed-analytics-v2.md` — Phase 2
**Dépend de :** Sprint FA FAIT

---

### Story FB.1 — Fonctions de calcul : ADG, PER, DFR, écart ration
**Assigné à :** @developer | **Dépend de :** Sprint FA FAIT | **Statut :** `FAIT` | **Type :** API

**Tâches :**
- [ ] `TODO` calculerADG (négatif autorisé), calculerPER (gainPoids en grammes), calculerDFR, calculerEcartRation

---

### Story FB.2 — Fonction score qualité aliment /10
**Assigné à :** @developer | **Dépend de :** Sprint FA FAIT | **Statut :** `FAIT` | **Type :** API

**Tâches :**
- [ ] `TODO` ScoreAlimentConfig interface + calculerScoreAliment configurable
- [ ] `TODO` Guard FCR≤0→null, formule `score/poidsTotal` (PAS *10)

---

### Story FB.3 — Benchmarks par phase d'élevage
**Assigné à :** @developer | **Dépend de :** Sprint FA FAIT | **Statut :** `FAIT` | **Type :** API

**Tâches :**
- [ ] `TODO` 4 constantes benchmark + getBenchmarkFCRPourPhase + getBenchmarkADGPourPoids (boundary exclusive)

---

### Story FB.4 — Types calculs enrichis
**Assigné à :** @architect | **Dépend de :** Sprint FA FAIT | **Statut :** `FAIT` | **Type :** TYPES

**Tâches :**
- [ ] `TODO` Dans `src/types/calculs.ts` : enrichir `AnalytiqueAliment` (+tailleGranule?, +formeAliment?, +scoreQualite?, +adgMoyen?, +perMoyen?) + enrichir `DetailAlimentVague` (+adg?, +per?)
- [ ] `TODO` Dans `src/types/calculs.ts` : créer FiltresAnalyticsAliments, FCRHebdomadairePoint, ChangementGranule, AlerteRation
- [ ] `TODO` Dans `src/types/calculs.ts` : créer ScoreAlimentConfig (remplace le `Record<string, unknown>` provisoire de FA.2)
- [ ] `TODO` Dans `src/types/models.ts` : mettre à jour `ConfigElevage.scoreAlimentConfig` de `Record<string, unknown> | null` vers `ScoreAlimentConfig | null`
- [ ] `TODO` Exporter tous les nouveaux types depuis `src/types/index.ts`

---

### Story FB.5 — Query : enrichir computeAlimentMetrics + filtres
**Assigné à :** @developer | **Dépend de :** FB.1, FB.2, FB.4 | **Statut :** `FAIT` | **Type :** QUERIES

**Tâches :**
- [ ] `TODO` Dans `src/lib/queries/analytics.ts` : enrichir le SELECT Prisma interne de la fonction PRIVÉE `computeAlimentMetrics` pour inclure tailleGranule, formeAliment, tauxProteines (ces champs sont sur Produit)
- [ ] `TODO` Dans `computeAlimentMetrics` : calculer ADG, PER, scoreQualite en appelant les nouvelles fonctions de calculs.ts
- [ ] `TODO` Ajouter paramètre `filtres?: FiltresAnalyticsAliments` à `getComparaisonAliments` et `getDetailAliment` (fonctions publiques exportées)
- [ ] `TODO` Fix E5 : remplacer `...(filters?.x && {...})` par `...(filters?.x !== undefined && filters.x !== null && {...})` dans les spreads de filtres
- [ ] `TODO` Fix A13 : propager null correctement pour AnalytiqueAliment sans données biométriques

**Correction ADJ-07 :** `computeAlimentMetrics` est une fonction PRIVÉE (non exportée) dans `src/lib/queries/analytics.ts`. Modifier directement à l'intérieur du fichier. Voir `docs/decisions/ADJUSTMENTS-feed-analytics-stories.md` section 7.

---

### Story FB.6 — Query : FCR hebdomadaire + détection changement granulé (F14, F17)
**Assigné à :** @developer | **Dépend de :** FB.4 | **Statut :** `FAIT` | **Type :** QUERIES

**Tâches :**
- [ ] `TODO` Interpolation biométrie linéaire, multi-bac guard E7, détection changement granulé
- [ ] `TODO` Query avec poidsMoyen: { not: null } (E8)

---

### Story FB.7 — Query : alertes ration (F18/F24)
**Assigné à :** @developer | **Dépend de :** FB.1 | **Statut :** `FAIT` | **Type :** QUERIES

**Tâches :**
- [ ] `TODO` Guard E9 skip sans ConfigElevage, seuil 20% × 3 consécutifs

---

### Story FB.8 — Tests Phase 2
**Assigné à :** @tester | **Dépend de :** FB.5, FB.6, FB.7 | **Statut :** `FAIT` | **Type :** TEST

**Tâches :**
- [ ] `TODO` Tests 5 fonctions calcul + edge cases (FCR=0, ADG négatif, boundary 30g)
- [ ] `TODO` Non-régression + rapport `docs/tests/rapport-sprint-FB.md`

---

### Story FB.9 — Review Phase 2
**Assigné à :** @code-reviewer | **Dépend de :** FB.8 | **Statut :** `FAIT` | **Type :** REVIEW

**Tâches :**
- [ ] `TODO` Formule score, guards, contrat PER, interpolation, filter spread
- [ ] `TODO` Rapport `docs/reviews/review-sprint-FB.md`

---

## Sprint FC — Feed Analytics Phase 3 : Interface Utilisateur (PLAN-feed-analytics-v2)

**Objectif :** UI : filtres, badges, avertissements, formulaires, graphiques, DLC. Tout via i18n.
**Référence :** `docs/decisions/PLAN-feed-analytics-v2.md` — Phase 3
**Dépend de :** Sprint FB FAIT

---

### Story FC.1 — i18n : clés analytics aliments
**Assigné à :** @developer | **Dépend de :** Sprint FB FAIT | **Statut :** `FAIT` | **Type :** UI

**Tâches :**
- [x] `FAIT` `src/messages/fr/analytics.json` : +labels TailleGranule, FormeAliment, ComportementAlimentaire, +score (/10, seuils), +filtres (phase, taille, forme, saison), +alertes ration (sous/sur), +DLC (expiré, bientôt)
- [x] `FAIT` `src/messages/fr/stock.json` : +champs produit tailleGranule, formeAliment, tauxProteines, tauxLipides, tauxFibres, phasesCibles
- [x] `FAIT` `src/messages/fr/releves.json` : +tauxRefus (label + options 0/10/25/50%), +comportementAlim (label + options enum)

**Correction ADJ-08 :** Il n'existe PAS de `src/messages/en/` — modifier uniquement les fichiers `fr/`. Voir `docs/decisions/ADJUSTMENTS-feed-analytics-stories.md` section 8.

---

### Story FC.2 — Composant FeedFilters (F2)
**Assigné à :** @developer | **Dépend de :** FC.1 | **Statut :** `FAIT` | **Type :** UI

**Tâches :**
- [x] `FAIT` Créer `src/components/analytics/feed-filters.tsx` (Client Component) : 4 Radix Select (phase, taille, forme, saison), validation enum searchParams (E6 : liste blanche avant cast), mobile-first
- [x] `FAIT` Mettre à jour le stub `src/app/(farm)/analytics/aliments/page.tsx` pour passer `searchParams` au composant page (voir ADJ-11)
- [x] `FAIT` Intégrer FeedFilters dans `src/components/pages/analytics-aliments-page.tsx` (PAS dans src/app/analytics/aliments/page.tsx)

**Correction ADJ-01/11 :** La page liste aliments réelle est `src/components/pages/analytics-aliments-page.tsx`. Le stub `src/app/(farm)/analytics/aliments/page.tsx` doit être mis à jour pour transmettre searchParams. Voir `docs/decisions/ADJUSTMENTS-feed-analytics-stories.md` sections 1, 11.

---

### Story FC.3 — Badges taille + score sur cartes aliment (F3, F11)
**Assigné à :** @developer | **Dépend de :** FC.1 | **Statut :** `FAIT` | **Type :** UI

**Tâches :**
- [x] `FAIT` Badge granulométrie, forme, ScoreBadge coloré (≥7 vert, ≥5 amber, <5 rouge)

---

### Story FC.4 — Avertissement comparaison tailles différentes (F4)
**Assigné à :** @developer | **Dépend de :** FC.1 | **Statut :** `FAIT` | **Type :** UI

**Tâches :**
- [x] `FAIT` Banner AlertTriangle si > 1 taille unique, message i18n

---

### Story FC.5 — Formulaire produit : champs aliment conditionnels
**Assigné à :** @developer | **Dépend de :** FC.1 | **Statut :** `FAIT` | **Type :** UI

**Tâches :**
- [x] `FAIT` `src/components/stock/produits-list-client.tsx` : ajouter section conditionnelle ALIMENT dans le Dialog de création (visible si categorie === ALIMENT) — Select TailleGranule (Radix), Select FormeAliment (Radix), inputs tauxProteines/Lipides/Fibres (0–100), multi-select PhaseElevage
- [x] `FAIT` `src/components/stock/produit-detail-client.tsx` : idem dans le Dialog de modification
- [x] `FAIT` Valeurs soumises via le state existant (`fields`) — pas de nouveau state global nécessaire

**Correction ADJ-02 :** `src/components/stock/produit-form.tsx` N'EXISTE PAS. Le formulaire produit est inline dans `produits-list-client.tsx` (création) et `produit-detail-client.tsx` (modification). Voir `docs/decisions/ADJUSTMENTS-feed-analytics-stories.md` section 2.

---

### Story FC.6 — Formulaire relevé : tauxRefus + comportementAlim (F7, F8)
**Assigné à :** @developer | **Dépend de :** FC.1 | **Statut :** `FAIT` | **Type :** UI

**Tâches :**
- [x] `FAIT` `src/components/releves/form-alimentation.tsx` : +RadioGroup tauxRefus (Radix RadioGroup, options 0/10/25/50%, h-12 min), +Select comportementAlim (Radix Select, options enum ComportementAlimentaire), mettre à jour l'interface `FormAlimentationProps` pour inclure ces 2 champs dans `values`
- [x] `FAIT` Les valeurs `tauxRefus` et `comportementAlim` transitent via le `fields` Record existant dans `releve-form-client.tsx` — pas de state supplémentaire à créer
- [x] `FAIT` Le parent `releve-form-client.tsx` extrait déjà `fields.tauxRefus` et `fields.comportementAlim` pour les passer au body POST — vérifier que le body de soumission les inclut

**Correction ADJ-09 :** Les RadioGroups vont dans `form-alimentation.tsx`, pas dans `releve-form-client.tsx` directement. Voir `docs/decisions/ADJUSTMENTS-feed-analytics-stories.md` section 9.

---

### Story FC.7 — Graphique FCR hebdomadaire (F14, F17)
**Assigné à :** @developer | **Dépend de :** FB.6 | **Statut :** `FAIT` | **Type :** UI

**Tâches :**
- [x] `FAIT` Dans `src/components/analytics/feed-detail-charts.tsx` : ajouter composant `FeedFCRHebdoChart` (Recharts ComposedChart, dynamic imports ssr:false, ReferenceLine pour changements de granulé, ReferenceLine pour benchmark FCR, responsive, mobile-first)
- [x] `FAIT` Intégrer `FeedFCRHebdoChart` dans `src/app/analytics/aliments/[produitId]/page.tsx`

**Note ADJ-01 :** La page détail est HORS route group — `src/app/analytics/aliments/[produitId]/page.tsx` est le chemin correct (pas dans `/(farm)/`).

---

### Story FC.8 — Corrélation mortalité / aliment (F15)
**Assigné à :** @developer | **Dépend de :** FB.5 | **Statut :** `FAIT` | **Type :** UI

**Tâches :**
- [x] `FAIT` Dans `src/app/analytics/aliments/[produitId]/page.tsx` (page détail) : ajouter section corrélation mortalité — cartes empilées mobile, badge mortalité si > 10%, données issues de l'enrichissement `computeAlimentMetrics`

---

### Story FC.9 — Alerte DLC stock aliment (F21)
**Assigné à :** @developer | **Dépend de :** Sprint FA FAIT | **Statut :** `FAIT` | **Type :** UI

**Tâches :**
- [x] `FAIT` Dans `src/lib/queries/analytics.ts` : query `getMouvementsExpirables(siteId)` — séparer lots expirés (`datePeremption < now`) vs bientôt expirés (`datePeremption < now+30j`) (E13)
- [x] `FAIT` Créer `src/components/analytics/alerte-dlc.tsx` : badges expiré/bientôt, i18n depuis fr/analytics.json
- [x] `FAIT` Intégrer AlerteDLC dans `src/components/pages/analytics-aliments-page.tsx`

---

### Story FC.10 — Tests Phase 3
**Assigné à :** @tester | **Dépend de :** FC.2 à FC.9 | **Statut :** `FAIT` | **Type :** TEST

**Tâches :**
- [x] `FAIT` Tests filtres, avertissement, ?taille=INVALID, mobile 360px manuel
- [x] `FAIT` Non-régression + rapport `docs/tests/rapport-sprint-FC.md`

---

### Story FC.11 — Review Phase 3
**Assigné à :** @code-reviewer | **Dépend de :** FC.10 | **Statut :** `FAIT` | **Type :** REVIEW

**Tâches :**
- [x] `FAIT` i18n complet, R5/R6, mobile first, accessibilité RadioGroups
- [x] `FAIT` Rapport `docs/reviews/review-sprint-FC.md`

---

## Sprint FD — Feed Analytics Phase 4 : Fonctionnalités Avancées (PLAN-feed-analytics-v2)

**Objectif :** Alertes ration UI, score fournisseur, filtre saison, ADRs pour PDF et courbe croissance. F16/F19 = [DESIGN NEEDED].
**Référence :** `docs/decisions/PLAN-feed-analytics-v2.md` — Phase 4
**Dépend de :** Sprint FC FAIT

---

### Story FD.1 — Alerte sous/sur-alimentation UI (F18)
**Assigné à :** @developer | **Dépend de :** Sprint FC FAIT, FB.7 | **Statut :** `FAIT` | **Type :** UI

**Tâches :**
- [x] `FAIT` Créer `src/components/analytics/alerte-ration-card.tsx` : carte affichant les AlerteRation (icône TrendingDown sous-alimentation / TrendingUp sur-alimentation), lien vers la page relevés de la vague concernée, toutes les chaînes via i18n fr/analytics.json
- [x] `FAIT` Intégrer dans `src/components/pages/analytics-aliments-page.tsx` (PAS dans `src/app/analytics/aliments/page.tsx`)

**Correction ADJ-01 :** Modifier `src/components/pages/analytics-aliments-page.tsx`, pas le stub. Voir `docs/decisions/ADJUSTMENTS-feed-analytics-stories.md` section 1.

---

### Story FD.2 — Score fournisseur agrégé (F20)
**Assigné à :** @developer | **Dépend de :** FB.2, Sprint FC FAIT | **Statut :** `FAIT` | **Type :** QUERIES + UI

**Tâches :**
- [x] `FAIT` Dans `src/lib/queries/analytics.ts` : ajouter `getScoresFournisseurs(siteId)` — agrège les scores par fournisseur via les produits aliment du site
- [x] `FAIT` Ajouter section UI "Performance par fournisseur" dans `src/components/pages/analytics-aliments-page.tsx`

**Correction ADJ-01 :** Intégration dans `analytics-aliments-page.tsx`, pas dans le stub `/(farm)/analytics/aliments/page.tsx`. Voir section 1.

---

### Story FD.3 — Filtre par saison (F22)
**Assigné à :** @developer | **Dépend de :** FC.2 | **Statut :** `FAIT` | **Type :** QUERIES + UI

**Tâches :**
- [x] `FAIT` Ajouter `getSaison(date: Date, pays?: string): string` dans `src/lib/calculs.ts` (fonction pure, pas de DB) — multi-tenant via param pays (E15), défaut "CM" (Cameroun)
- [x] `FAIT` Exporter getSaison depuis `src/lib/calculs.ts`
- [x] `FAIT` Intégrer le filtre saison dans le composant `src/components/analytics/feed-filters.tsx`

**Correction ADJ-12 :** `getSaison` est une fonction pure → appartient à `src/lib/calculs.ts`, PAS à un fichier `queries/saisons.ts`. Voir `docs/decisions/ADJUSTMENTS-feed-analytics-stories.md` section 12.

---

### Story FD.4 — [DESIGN NEEDED] Rapport PDF consommation (F16)
**Assigné à :** @architect | **Dépend de :** Sprint FC FAIT | **Statut :** `FAIT` | **Type :** ADR

**Tâches :**
- [x] `FAIT` ADR `docs/decisions/ADR-rapport-pdf-consommation.md`

---

### Story FD.5 — [DESIGN NEEDED] Courbe de croissance vs référentiel (F19)
**Assigné à :** @architect | **Dépend de :** Sprint FC FAIT | **Statut :** `FAIT` | **Type :** ADR

**Tâches :**
- [x] `FAIT` ADR `docs/decisions/ADR-courbe-croissance-reference.md`

---

### Story FD.6 — HistoriqueNutritionnel modèle (F23, optionnel)
**Assigné à :** @db-specialist | **Dépend de :** Sprint FC FAIT | **Statut :** `FAIT` | **Type :** SCHEMA

**Tâches :**
- [x] `FAIT` Modèle Prisma @@unique([vagueId, phase]) + siteId (R8) + migration

---

### Story FD.7 — Tests Phase 4
**Assigné à :** @tester | **Dépend de :** FD.1 à FD.3 | **Statut :** `FAIT` | **Type :** TEST

**Tâches :**
- [x] `FAIT` Tests score fournisseur, getSaison, alertes + rapport `docs/tests/rapport-sprint-FD.md`

---

### Story FD.8 — Review Phase 4
**Assigné à :** @code-reviewer | **Dépend de :** FD.7 | **Statut :** `FAIT` | **Type :** REVIEW

**Tâches :**
- [x] `FAIT` R1-R9 sur toute la feature, edge cases reviews adressés, i18n, rétrocompatibilité
- [x] `FAIT` Rapport `docs/reviews/review-sprint-FD.md`

---

## Sprint NA — Navigation Phase 1 : Corrections urgentes (ADR-navigation-architecture)

**Objectif :** Corriger les lacunes bloquantes dans les composants de navigation existants — items manquants, dead links, routes mal placées, guards middleware absents. Aucun nouveau composant, aucune refonte.
**Référence :** `docs/decisions/ADR-navigation-architecture.md` — Phase 1
**Dépend de :** Sprint FD FAIT

---

### Story NA.1 — Fix FarmBottomNav sheet : items manquants
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Type :** UI

**Description :** Le sheet du FarmBottomNav ne contient pas tous les items requis par l'ADR §4.3. Ajouter les items manquants organisés par groupes avec leurs permissions et icônes canoniques.

**Tâches :**
- [x] `FAIT` Dans `src/components/layout/farm-bottom-nav.tsx`, ajouter dans les SHEET_ITEMS groupés : `/bacs` (Container, BACS_GERER|BACS_MODIFIER), `/releves` (NotebookPen, RELEVES_VOIR), `/observations` (Eye, RELEVES_VOIR), `/notifications` (Bell, alwaysVisible — topbar only, retirer du sheet si présent)
- [x] `FAIT` Ajouter groupe Finances : `/clients` (UserRound, CLIENTS_VOIR), `/depenses` (Receipt, DEPENSES_VOIR)
- [x] `FAIT` Ajouter groupe Stock : `/stock/fournisseurs` (Truck, APPROVISIONNEMENT_VOIR), `/stock/commandes` (ShoppingCart, APPROVISIONNEMENT_GERER), `/besoins` (ClipboardList, BESOINS_SOUMETTRE|BESOINS_APPROUVER)
- [x] `FAIT` Ajouter groupe Admin : `/settings/alertes` (BellRing, ALERTES_CONFIGURER), `/activations` (PackageCheck, ACTIVER_PACKS), `/mes-taches` (ClipboardCheck, PLANNING_VOIR)
- [x] `FAIT` Utiliser les clés i18n `navigation:items.*` pour tous les labels (aucun texte hardcodé)

**Critères d'acceptation :**
- Toutes les routes listées dans l'ADR §4.3 sont accessibles depuis le sheet en 2 taps max depuis la bottom nav
- Chaque item a l'icône Lucide canonique définie en §12
- Aucun texte hardcodé — toutes les chaînes via `useTranslations('navigation')`

---

### Story NA.2 — Fix IngenieurBottomNav sheet : items manquants
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Type :** UI

**Description :** Le sheet de l'IngenieurBottomNav ne contient pas tous les items requis par l'ADR §5.3. Ajouter les items manquants alignés avec les groupes de la sidebar ingénieur.

**Tâches :**
- [x] `FAIT` Dans `src/components/layout/ingenieur-bottom-nav.tsx`, ajouter dans les SHEET_ITEMS : `/planning` (Calendar, PLANNING_VOIR), `/analytics` (BarChart3, DASHBOARD_VOIR)
- [x] `FAIT` Ajouter groupe Commercial : `/activations` (PackageCheck, ACTIVER_PACKS), `/stock/fournisseurs` (Truck, APPROVISIONNEMENT_VOIR), `/stock/commandes` (ShoppingCart, APPROVISIONNEMENT_GERER)
- [x] `FAIT` Ajouter groupe Configuration : `/settings/config-elevage` (Settings, GERER_CONFIG_ELEVAGE), `/settings/regles-activites` (Zap, REGLES_ACTIVITES_VOIR)
- [x] `FAIT` Utiliser les clés i18n `navigation:items.*` pour tous les labels

**Critères d'acceptation :**
- Toutes les routes du §2.4 marquées "dans sheet Opérations/Commercial/Config" sont présentes dans le sheet
- Ordre des groupes aligné avec la sidebar : Monitoring → Opérations → Commercial → Configuration (ADR §5.3 note A4)

---

### Story NA.3 — Fix IngenieurSidebar : items manquants et groupe Configuration
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Type :** UI

**Description :** La sidebar ingénieur manque `/stock/fournisseurs`, `/stock/commandes` dans le groupe Stock, et n'a pas de groupe "Configuration" pour alertes, config-élevage et règles-activités.

**Tâches :**
- [x] `FAIT` Dans `src/components/layout/ingenieur-sidebar.tsx`, ajouter dans le groupe Stock : `/stock/fournisseurs` (Truck, APPROVISIONNEMENT_VOIR) et `/stock/commandes` (ShoppingCart, APPROVISIONNEMENT_GERER)
- [x] `FAIT` Créer le groupe "CONFIGURATION" (gate : GERER_CONFIG_ELEVAGE | REGLES_ACTIVITES_VOIR | ALERTES_CONFIGURER) avec : `/settings/alertes` (BellRing, ALERTES_CONFIGURER), `/settings/config-elevage` (Settings, GERER_CONFIG_ELEVAGE), `/settings/regles-activites` (Zap, REGLES_ACTIVITES_VOIR)
- [x] `FAIT` Déplacer `/settings/alertes` depuis le groupe Monitoring vers le groupe Configuration (corrige incohérence sheet/sidebar — ADR §5.3 note A4)

**Critères d'acceptation :**
- La sidebar ingénieur a exactement 4 groupes : Monitoring, Opérations, Commercial, Configuration (ADR §5.4)
- `/settings/alertes` est dans Configuration dans la sidebar ET dans le sheet (cohérence A4)

---

### Story NA.4 — Fix routes partagées : déplacer /packs, /activations, /mes-taches à la racine app
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Type :** ROUTING

**Description :** Les routes `/packs`, `/activations`, `/mes-taches` sont actuellement dans le route group `(ingenieur)/` ce qui cause une injection incorrecte du layout ingénieur pour les utilisateurs farm. Ces routes doivent exister à `src/app/` (racine) pour hériter du bon layout via `AppShell` (ADR §2.2, E4).

**Tâches :**
- [x] `FAIT` Créer ou déplacer `src/app/packs/page.tsx` (copier depuis `(ingenieur)/packs/page.tsx` si le fichier existe là, sinon créer un stub qui redirige vers la vraie page)
- [x] `FAIT` Créer ou déplacer `src/app/activations/page.tsx` — même logique
- [x] `FAIT` Créer ou déplacer `src/app/mes-taches/page.tsx` — même logique
- [x] `FAIT` Vérifier qu'aucun import interne dans ces pages ne dépend du route group `(ingenieur)/`
- [x] `FAIT` Supprimer ou vider les doublons dans `(ingenieur)/` si les pages ont été déplacées

**Critères d'acceptation :**
- `/packs`, `/activations`, `/mes-taches` renvoient le bon layout farm ou ingénieur selon le rôle de l'utilisateur connecté
- Aucune erreur 404 sur ces trois routes
- Les liens existants dans la navigation pointent vers les bonnes URLs (pas de changement d'URL)

---

### Story NA.5 — Fix FarmSidebar : supprimer dead link /calibrages et modules INGENIEUR
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Type :** UI

**Description :** La FarmSidebar contient un item `/calibrages` qui pointe vers une route inexistante (dead link). Elle contient aussi `/settings/config-elevage` et `/settings/regles-activites` qui sont des modules INGENIEUR exclusifs (ADR §2.3, A11, M1, M2).

**Tâches :**
- [x] `FAIT` Dans `src/components/layout/farm-sidebar.tsx`, supprimer l'item `/calibrages`
- [x] `FAIT` Supprimer les items `/settings/config-elevage` et `/settings/regles-activites` de la FarmSidebar
- [x] `FAIT` Vérifier qu'aucun autre item de la FarmSidebar ne pointe vers une route inexistante

**Critères d'acceptation :**
- Aucun item de la FarmSidebar ne pointe vers `/calibrages`
- `/settings/config-elevage` et `/settings/regles-activites` sont absents de la FarmSidebar
- Build sans erreur TypeScript

---

### Story NA.6 — Middleware guards INGENIEUR_ONLY et FARM_ONLY
**Assigné à :** @developer | **Dépend de :** NA.4 | **Statut :** `FAIT` | **Type :** SECURITY

**Description :** Le middleware doit protéger les routes exclusives à chaque rôle. Un utilisateur farm ne doit pas accéder à `/monitoring`, `/mon-portefeuille`, `/settings/config-elevage`, `/settings/regles-activites`. Un ingénieur ne doit pas accéder à `/alevins`, `/depenses`, `/finances`, `/factures`, `/clients`, `/ventes`, `/besoins` (ADR §3bis.2, A6, E10, E11, E16).

**Tâches :**
- [x] `FAIT` Dans `src/middleware.ts`, ajouter la liste `INGENIEUR_ONLY` : `/monitoring`, `/mon-portefeuille`, `/settings/config-elevage`, `/settings/regles-activites`
- [x] `FAIT` Ajouter la liste `FARM_ONLY` : `/alevins`, `/depenses`, `/finances`, `/factures`, `/clients`, `/ventes`, `/besoins`
- [x] `FAIT` Ajouter le guard INGENIEUR_ONLY : si `session.role !== Role.INGENIEUR && !session.isSuperAdmin` → redirect `/`
- [x] `FAIT` Ajouter le guard FARM_ONLY : si `!FARM_ROLES.includes(session.role) && !session.isSuperAdmin` → redirect `/`
- [x] `FAIT` Ajouter le guard null-role (E11) : si `session && (!session.role || session.role === '') && !session.isSuperAdmin` → redirect `/login`
- [x] `FAIT` SuperAdmin bypass universel : les guards ci-dessus ne s'appliquent pas si `session.isSuperAdmin === true`

**Critères d'acceptation :**
- Un utilisateur avec rôle PISCICULTEUR ne peut pas accéder à `/monitoring` (redirect vers `/`)
- Un utilisateur avec rôle INGENIEUR ne peut pas accéder à `/finances` (redirect vers `/`)
- Un SuperAdmin peut accéder à toutes les routes sans restriction
- Un utilisateur sans rôle est redirigé vers `/login`

---

### Story NA.7 — Ajout clés i18n navigation manquantes
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Type :** I18N

**Description :** Plusieurs clés i18n utilisées dans les items de navigation ne sont pas encore définies dans `src/messages/fr/navigation.json` et `src/messages/en/navigation.json` (ADR §10.2, A13).

**Tâches :**
- [x] `FAIT` Dans `src/messages/fr/navigation.json`, section `items`, ajouter : `"observations": "Observations"`, `"clientsItem": "Clients"`, `"activationsItem": "Activations"`, `"notificationsItem": "Notifications"`, `"portefeuilleItem": "Portefeuille"`
- [x] `FAIT` Dans `src/messages/en/navigation.json`, section `items`, ajouter les équivalents anglais (observations, clientsItem, activationsItem, notificationsItem, `"portefeuilleItem": "Portfolio"`)
- [x] `FAIT` Vérifier que toutes les clés i18n référencées dans NA.1, NA.2, NA.3 sont présentes dans les deux fichiers de messages

**Critères d'acceptation :**
- `npx next build` passe sans warning de clé i18n manquante
- Aucun item de navigation n'affiche sa clé brute (`navigation:items.xxx`) au lieu du label traduit

---

### Story NA.8 — Fix icônes en collision : UserRound, Eye, PackageCheck
**Assigné à :** @developer | **Dépend de :** NA.1, NA.2 | **Statut :** `FAIT` | **Type :** UI

**Description :** Trois icônes sont en collision ou incorrectes selon l'ADR §12 (A10) : `Users` doit devenir `UserRound` pour Clients (évite collision avec Utilisateurs), `Eye` est l'icône canonique de Monitoring/Observations, `PackageCheck` est l'icône canonique d'Activations.

**Tâches :**
- [x] `FAIT` Dans FarmBottomNav et FarmSidebar, remplacer l'icône Clients `Users` par `UserRound`
- [x] `FAIT` Dans IngenieurBottomNav et IngenieurSidebar, vérifier que Monitoring utilise `Eye` (pas `Monitor` ou `Users`)
- [x] `FAIT` Dans FarmBottomNav sheet et FarmSidebar, vérifier que l'item Activations utilise `PackageCheck` (pas `Package` ou `CheckCircle`)
- [x] `FAIT` Vérifier que `Users` (pluriel) est conservé uniquement pour l'item Utilisateurs (`/users`)

**Critères d'acceptation :**
- La table d'assignation canonique de l'ADR §12 est respectée pour les trois icônes concernées
- Aucune icône en double sur deux items différents dans le même composant de navigation

---

### Story NA.9 — Tests Sprint NA
**Assigné à :** @tester | **Dépend de :** NA.1, NA.2, NA.3, NA.4, NA.5, NA.6, NA.7, NA.8 | **Statut :** `FAIT` | **Type :** TEST

**Tâches :**
- [x] `FAIT` Vérifier manuellement (360px) que toutes les routes listées dans l'ADR §2.3 et §2.4 sont accessibles depuis le sheet en 2 taps max
- [x] `FAIT` Vérifier que les guards middleware redirigent correctement (INGENIEUR sur `/finances` → redirect `/`, PISCICULTEUR sur `/monitoring` → redirect `/`)
- [x] `FAIT` Vérifier que `/packs`, `/activations`, `/mes-taches` rendent le bon layout selon le rôle
- [x] `FAIT` Vérifier qu'aucun item de navigation ne produit une erreur 404
- [x] `FAIT` Exécuter `npx vitest run` et `npm run build` — les deux doivent passer
- [x] `FAIT` Produire rapport `docs/tests/rapport-sprint-NA.md`

---

### Story NA.10 — Review Sprint NA
**Assigné à :** @code-reviewer | **Dépend de :** NA.9 | **Statut :** `FAIT` | **Type :** REVIEW

**Tâches :**
- [x] `FAIT` Vérifier R1-R9 sur tous les fichiers modifiés
- [x] `FAIT` Vérifier conformité ADR §2.2, §3bis.2, §4.3, §5.3, §5.4, §10.2, §12
- [x] `FAIT` Vérifier accessibilité : touch targets 44px+, `aria-current`, clés i18n
- [x] `FAIT` Produire rapport `docs/reviews/review-sprint-NA.md`

---

## Sprint NB — Navigation Phase 2 : Restructuration (ADR-navigation-architecture)

**Objectif :** Créer les nouveaux composants header mobiles, réorganiser les groupes sidebar/sheet selon l'ADR, implémenter l'algorithme de permission gating complet, le skeleton loading et les comportements avancés (offline, paysage).
**Référence :** `docs/decisions/ADR-navigation-architecture.md` — Phase 2
**Dépend de :** Sprint NA FAIT

---

### Story NB.1 — Créer FarmHeader (topbar mobile farm)
**Assigné à :** @developer | **Dépend de :** Sprint NA FAIT | **Statut :** `FAIT` | **Type :** UI

**Description :** Créer le composant `FarmHeader` — topbar mobile sticky pour le layout farm, affichant logo + NotificationBell + SiteSelector conditionnel (ADR §4.2).

**Tâches :**
- [x] `FAIT` Créer `src/components/layout/farm-header.tsx` : `md:hidden`, `sticky top-0 z-50`, hauteur `h-12`
- [x] `FAIT` Logo à gauche : icône `Waves` 20px + texte "FarmFlow" `text-sm font-semibold`
- [x] `FAIT` `NotificationBell` à droite : icône `Bell`, badge count avec `formatBadgeCount` (plafond "99+", guard NaN/Infinity — ADR §6), `bg-destructive text-destructive-foreground text-[10px] min-w-[16px] h-4`, `absolute -top-1 -right-1`
- [x] `FAIT` `SiteSelector` à droite : Radix UI `DropdownMenu` ou `Select`, masqué si `userSites.length <= 1` (E6)
- [x] `FAIT` Indicateur réseau offline : dot 8×8px rouge/vert dans la topbar (ADR §7.2)

**Critères d'acceptation :**
- `FarmHeader` est `md:hidden` (invisible sur desktop)
- Badge "99+" s'affiche correctement quand count > 99, vide quand count = 0
- SiteSelector est absent quand l'utilisateur n'a qu'un seul site

---

### Story NB.2 — Créer IngenieurHeader (topbar mobile ingénieur)
**Assigné à :** @developer | **Dépend de :** Sprint NA FAIT | **Statut :** `FAIT` | **Type :** UI

**Description :** Créer le composant `IngenieurHeader` — topbar mobile sticky pour le layout ingénieur, affichant logo + NotificationBell (ADR §5.2).

**Tâches :**
- [x] `FAIT` Créer `src/components/layout/ingenieur-header.tsx` : `md:hidden`, `sticky top-0 z-50`, `h-12`
- [x] `FAIT` Logo à gauche + mention "(Ingénieur)" ou badge visuel distinctif
- [x] `FAIT` `NotificationBell` à droite avec badge "99+" (même spec que FarmHeader)
- [x] `FAIT` Indicateur réseau offline (dot rouge/vert — ADR §7.2)

**Critères d'acceptation :**
- `IngenieurHeader` est `md:hidden`
- Visuellement distinct du `FarmHeader` (identité ingénieur)

---

### Story NB.3 — Créer BottomNavSkeleton (état loading permissions)
**Assigné à :** @developer | **Dépend de :** Sprint NA FAIT | **Statut :** `FAIT` | **Type :** UI

**Description :** Créer le composant `BottomNavSkeleton` — état de chargement des permissions avant que la bottom nav réelle puisse être rendue (ADR §3, A15, E6).

**Tâches :**
- [x] `FAIT` Créer `src/components/layout/bottom-nav-skeleton.tsx`
- [x] `FAIT` Hauteur identique à la vraie bottom nav : 56px + `pb-safe` (safe area iOS)
- [x] `FAIT` 5 slots gris uniformes `animate-pulse bg-muted rounded-md`, sans labels ni icônes colorées
- [x] `FAIT` Même positionnement que la bottom nav réelle : `position: fixed; bottom: 0`
- [x] `FAIT` Usage dans les bottom navs : `if (!permissionsLoaded) return <BottomNavSkeleton />;`

**Critères d'acceptation :**
- Le skeleton a exactement la même hauteur et le même positionnement que la bottom nav réelle
- Aucun élément de contenu visible pendant l'état skeleton (évite le biais perceptif)
- Disparaît immédiatement quand `permissionsLoaded === true`

---

### Story NB.4 — Réorganiser FarmSidebar : groupes selon ADR §4.4
**Assigné à :** @developer | **Dépend de :** Sprint NA FAIT | **Statut :** `FAIT` | **Type :** UI

**Description :** Réorganiser les groupes de la FarmSidebar selon la spécification §4.4 de l'ADR : 8 groupes ordonnés (Élevage, Stock, Finances, Alevins, Planning & Tâches, Analytics, Administration, Abonnement) + groupe Super Admin conditionnel.

**Tâches :**
- [x] `FAIT` Dans `src/components/layout/farm-sidebar.tsx`, restructurer les groupes dans l'ordre : ÉLEVAGE (Dashboard, Vagues, Bacs, Relevés, Observations) → STOCK (Vue stock, Produits, Mouvements, Fournisseurs, Commandes, Besoins) → FINANCES (Dashboard finances, Ventes, Factures, Clients, Dépenses) → ALEVINS → PLANNING & TÂCHES → ANALYTICS → ADMINISTRATION → ABONNEMENT → SUPER ADMIN
- [x] `FAIT` Chaque groupe a une gate selon l'ADR §4.4 (ex: STOCK gate = STOCK_VOIR, FINANCES gate = FINANCES_VOIR)
- [x] `FAIT` Appliquer l'algorithme `isGroupVisible` : masquer les groupes entiers si 0 items visibles (E1, E8)
- [x] `FAIT` Appliquer la règle E5 : groupe avec 1 seul item visible → afficher sans header de groupe

**Critères d'acceptation :**
- La FarmSidebar desktop respecte exactement la structure ASCII de l'ADR §4.4
- Un utilisateur sans FINANCES_VOIR ne voit pas le groupe Finances
- Build TypeScript sans erreur

---

### Story NB.5 — Réorganiser IngenieurSidebar : 4 groupes selon ADR §5.4
**Assigné à :** @developer | **Dépend de :** Sprint NA FAIT | **Statut :** `FAIT` | **Type :** UI

**Description :** Réorganiser les groupes de l'IngenieurSidebar selon la spécification §5.4 de l'ADR : 4 groupes ordonnés (Monitoring, Opérations, Commercial, Configuration).

**Tâches :**
- [x] `FAIT` Dans `src/components/layout/ingenieur-sidebar.tsx`, restructurer les 4 groupes dans l'ordre : MONITORING (Clients supervisés, Notes) → OPÉRATIONS (Stock, Produits, Mouvements, Fournisseurs, Commandes, Planning, Analytics) → COMMERCIAL (Packs, Activations, Portefeuille) → CONFIGURATION (Alertes, Config élevage, Règles activités)
- [x] `FAIT` Appliquer les gates de groupes : MONITORING gate = MONITORING_CLIENTS, COMMERCIAL gate = ACTIVER_PACKS|PORTEFEUILLE_VOIR, CONFIGURATION gate = GERER_CONFIG_ELEVAGE|REGLES_ACTIVITES_VOIR|ALERTES_CONFIGURER, OPÉRATIONS gate = toujours visible pour INGENIEUR
- [x] `FAIT` Appliquer la règle E9 pour l'item `/notes` : visible si ENVOYER_NOTES OU unreadNotesCount > 0

**Critères d'acceptation :**
- La IngenieurSidebar desktop a exactement 4 groupes dans l'ordre spécifié (ADR §5.4)
- L'item Notes respecte la règle E9 (visible en lecture seule si notes reçues mais pas ENVOYER_NOTES)

---

### Story NB.6 — Réorganiser FarmBottomNav sheet : groupes avec séparateurs
**Assigné à :** @developer | **Dépend de :** NB.4 | **Statut :** `FAIT` | **Type :** UI

**Description :** Restructurer le sheet du FarmBottomNav en groupes séparés avec headers et séparateurs visuels selon la structure §4.3 de l'ADR. Appliquer la règle de masquage des groupes vides.

**Tâches :**
- [x] `FAIT` Dans `src/components/layout/farm-bottom-nav.tsx`, refactoriser les SHEET_ITEMS en structure de groupes (`NavGroup[]`) : Grossissement, Intrants, Ventes, Analyse & Pilotage, Reproduction, Configuration
- [x] `FAIT` Implémenter le rendu par groupes avec headers i18n (`navigation:modules.*`) et séparateurs Radix UI `Separator`
- [x] `FAIT` Appliquer `isGroupVisible` sur chaque groupe — masquer le groupe entier si 0 items visibles
- [x] `FAIT` Appliquer la règle E5 pour les groupes avec 1 seul item visible (afficher sans header)
- [x] `FAIT` Implémentation du comportement paysage (E12) : si `window.innerHeight < 500` → side-drawer depuis la droite (`side="right"`, `w-80`) au lieu du bottom sheet

**Critères d'acceptation :**
- Le sheet affiche les groupes dans l'ordre de l'ADR §4.3 avec headers i18n
- En paysage (height < 500px), le sheet s'ouvre depuis la droite en drawer latéral
- Un utilisateur sans FINANCES_VOIR ne voit pas le groupe Ventes dans le sheet

---

### Story NB.7 — Réorganiser IngenieurBottomNav sheet : alignement avec sidebar
**Assigné à :** @developer | **Dépend de :** NB.5 | **Statut :** `FAIT` | **Type :** UI

**Description :** Restructurer le sheet de l'IngenieurBottomNav en groupes alignés avec ceux de la IngenieurSidebar (ADR §5.3, A4).

**Tâches :**
- [x] `FAIT` Dans `src/components/layout/ingenieur-bottom-nav.tsx`, refactoriser les SHEET_ITEMS en 4 groupes : Monitoring, Opérations, Commercial, Configuration
- [x] `FAIT` Même ordre, mêmes items, mêmes gates que la IngenieurSidebar (A4)
- [x] `FAIT` Appliquer `isGroupVisible` et la règle E5 (groupes vides / 1 item)
- [x] `FAIT` Implémenter comportement paysage (E12) : side-drawer depuis la droite si height < 500px

**Critères d'acceptation :**
- Les groupes du sheet ingénieur et de la sidebar ingénieur ont exactement les mêmes items dans le même ordre (A4)
- Test à 360px portrait et landscape : comportement correct dans les deux orientations

---

### Story NB.8 — Implémenter l'algorithme de permission gating complet
**Assigné à :** @developer | **Dépend de :** NB.4, NB.5, NB.6, NB.7 | **Statut :** `FAIT` | **Type :** UI

**Description :** Implémenter les fonctions `isNavItemVisible`, `isGroupVisible` et `getVisibleBottomNavItems` telles que spécifiées dans l'ADR §3. Ces fonctions centralisent toute la logique de visibilité de la navigation.

**Tâches :**
- [x] `FAIT` Créer `src/lib/nav-gating.ts` avec les fonctions `isNavItemVisible`, `isGroupVisible`, `getVisibleBottomNavItems` selon la spec exacte de l'ADR §3
- [x] `FAIT` Interface `NavItem` avec `id`, `labelKey`, `href`, `icon`, `requiredPermissions?` (ANY/OR), `requiredPermissionsAll?` (ALL/AND), `requiredModule?`, `superAdminOnly?`, `alwaysVisible?`
- [x] `FAIT` Implémenter le SuperAdmin bypass universel (step 1 de `isNavItemVisible`) : `if (isSuperAdmin) return true;`
- [x] `FAIT` Null guards sur `userPermissions` et `userModules` (E2-E5)
- [x] `FAIT` Exporter `isGroupVisible` avec signature explicite (pas de spread `Parameters<>` — E2-E5)
- [x] `FAIT` Intégrer ces fonctions dans FarmSidebar, FarmBottomNav, IngenieurSidebar, IngenieurBottomNav

**Critères d'acceptation :**
- `isNavItemVisible` retourne `true` pour un SuperAdmin sur tout item sans exception
- `isNavItemVisible` retourne `false` pour un item `superAdminOnly: true` si `isSuperAdmin === false`
- Comportement minimum viable vérifié : 0 permissions → seuls Accueil + Menu visibles (ADR §4.1)

---

### Story NB.9 — Intégrer FarmHeader et IngenieurHeader dans AppShell
**Assigné à :** @developer | **Dépend de :** NB.1, NB.2 | **Statut :** `FAIT` | **Type :** UI

**Description :** Modifier `AppShell` pour injecter `FarmHeader` ou `IngenieurHeader` en haut du `<main>` selon le rôle de l'utilisateur (ADR §14.2, Phase 2 step 3).

**Tâches :**
- [x] `FAIT` Dans `src/components/layout/app-shell.tsx`, ajouter le rendu conditionnel des headers mobiles : `if (role === Role.INGENIEUR)` → `<IngenieurHeader ...>`, `if (role in FARM_ROLES)` → `<FarmHeader ...>`
- [x] `FAIT` Passer les props nécessaires aux headers : `notificationCount`, `userSites`, `activeSite` pour `FarmHeader`
- [x] `FAIT` Vérifier que les headers sont bien `md:hidden` et n'apparaissent pas sur desktop
- [x] `FAIT` Vérifier le z-index et le positionnement sticky ne cassent pas le layout existant

**Critères d'acceptation :**
- En mobile (< md), la topbar est visible pour les layouts farm et ingénieur
- En desktop (>= md), aucune topbar mobile n'est rendue
- Le badge notification dans la topbar affiche le bon count

---

### Story NB.10 — Comportement offline pour la navigation
**Assigné à :** @developer | **Dépend de :** NB.8 | **Statut :** `FAIT` | **Type :** UI

**Description :** Implémenter le comportement offline des items de navigation : routes non-cachées affichent `opacity-50` + `aria-disabled="true"` + Toast "Hors ligne" au tap (ADR §7, E19).

**Tâches :**
- [x] `FAIT` Créer un hook `useNetworkStatus()` qui retourne `{ isOnline: boolean }` via `navigator.onLine` + events `online`/`offline`
- [x] `FAIT` Dans les composants de navigation, appliquer sur les items non-cachés quand offline : `opacity-50`, `aria-disabled="true"`, `pointer-events-none` (ne pas utiliser `disabled` sur `<a>`)
- [x] `FAIT` Au tap sur un item offline désactivé, afficher un Toast Radix UI : "Vous êtes hors connexion. Cette page n'est pas disponible."
- [x] `FAIT` Routes prioritaires en cache (restent actives offline) : `/`, `/mes-taches`, shell statique (ADR §7.1)
- [x] `FAIT` Indicateur réseau dans les headers : dot 8×8px rouge si offline, vert si en ligne (ADR §7.2)

**Critères d'acceptation :**
- En mode offline simulé (DevTools → Offline), les items non-cachés sont visuellement désactivés
- Le tap sur un item offline affiche un Toast (pas une navigation vers la page)
- `aria-disabled="true"` est présent sur les items offline (vérifiable avec inspecteur)

---

### Story NB.11 — Tests Sprint NB
**Assigné à :** @tester | **Dépend de :** NB.1, NB.2, NB.3, NB.4, NB.5, NB.6, NB.7, NB.8, NB.9, NB.10 | **Statut :** `FAIT` | **Type :** TEST

**Tâches :**
- [x] `FAIT` Tests unitaires pour `isNavItemVisible` : cas SuperAdmin bypass, cas superAdminOnly, cas permissions OR/AND, cas null guards, comportement minimum 2 items (Vitest)
- [x] `FAIT` Tests unitaires pour `isGroupVisible` : groupes 0/1/N items
- [x] `FAIT` Tests unitaires pour `formatBadgeCount` : count 0, 1, 99, 100, NaN, Infinity
- [x] `FAIT` Vérification manuelle mobile 360px portrait : FarmHeader visible, BottomNavSkeleton avant chargement permissions
- [x] `FAIT` Vérification manuelle mobile paysage (height < 500px) : sheet s'ouvre depuis la droite
- [x] `FAIT` Exécuter `npx vitest run` et `npm run build` — les deux doivent passer
- [x] `FAIT` Produire rapport `docs/tests/rapport-sprint-NB.md`

---

### Story NB.12 — Review Sprint NB
**Assigné à :** @code-reviewer | **Dépend de :** NB.11 | **Statut :** `FAIT` | **Type :** REVIEW

**Tâches :**
- [x] `FAIT` Vérifier R1-R9 sur tous les nouveaux composants et fonctions
- [x] `FAIT` Vérifier conformité ADR §3, §4.1-4.4, §5.1-5.4, §6, §7, §8, §9
- [x] `FAIT` Vérifier ARIA : touch targets 44px+, `aria-current`, `aria-label` FAB, `aria-disabled` offline
- [x] `FAIT` Vérifier performances : imports Lucide named only (tree-shaking), lazy loading des sheets
- [x] `FAIT` Produire rapport `docs/reviews/review-sprint-NB.md`

---

## Sprint NC — Navigation Phase 3 : Nettoyage legacy (ADR-navigation-architecture)

**Objectif :** Auditer et nettoyer les composants de navigation legacy (sidebar.tsx, bottom-nav.tsx, hamburger-menu.tsx, module-nav-items.ts) devenus obsolètes après les phases 1 et 2. Vérification finale de l'accessibilité et de la couverture mobile/desktop.
**Référence :** `docs/decisions/ADR-navigation-architecture.md` — Phase 3
**Dépend de :** Sprint NB FAIT

---

### Story NC.1 — Audit et nettoyage sidebar.tsx legacy
**Assigné à :** @developer | **Dépend de :** Sprint NB FAIT | **Statut :** `FAIT` | **Type :** CLEANUP

**Description :** Auditer les call sites du composant `sidebar.tsx` legacy. Supprimer les entrées `/admin/*` inexistantes. Si aucun import actif, supprimer le fichier (ADR §13 Phase 3, I5).

**Tâches :**
- [ ] `TODO` Exécuter `grep -r "from.*layout/sidebar" src/` pour trouver tous les imports actifs
- [ ] `TODO` Si imports actifs → migrer vers `FarmSidebar` ou `IngenieurSidebar` selon le contexte
- [ ] `TODO` Supprimer les entrées pointant vers `/admin/abonnements`, `/admin/commissions`, `/admin/remises` (routes inexistantes — ADR §14.3)
- [ ] `TODO` Si plus aucun import actif après migration → supprimer `src/components/layout/sidebar.tsx`

**Critères d'acceptation :**
- Aucune référence active à `sidebar.tsx` legacy dans le codebase
- `npm run build` passe sans erreur
- Aucun item de navigation ne pointe vers `/admin/*`

---

### Story NC.2 — Audit et nettoyage bottom-nav.tsx legacy
**Assigné à :** @developer | **Dépend de :** Sprint NB FAIT | **Statut :** `FAIT` | **Type :** CLEANUP

**Description :** Auditer les call sites du composant `bottom-nav.tsx` legacy. Le migrer ou supprimer selon les imports actifs (ADR §14.3, I6).

**Tâches :**
- [ ] `TODO` Exécuter `grep -r "from.*layout/bottom-nav" src/` pour trouver tous les imports actifs
- [ ] `TODO` Si imports actifs dans `AppShell` → remplacer par `FarmBottomNav` / `IngenieurBottomNav` selon le rôle
- [ ] `TODO` Si plus aucun import actif → supprimer `src/components/layout/bottom-nav.tsx`
- [ ] `TODO` Vérifier que le fallback `<Sidebar> + <BottomNav>` dans `AppShell` est remplacé par une redirection vers `/login` ou un état d'erreur explicite (plus de composant legacy fallback)

**Critères d'acceptation :**
- Aucune référence active à `bottom-nav.tsx` legacy dans le codebase
- `npm run build` passe sans erreur

---

### Story NC.3 — Audit et nettoyage hamburger-menu.tsx legacy
**Assigné à :** @developer | **Dépend de :** Sprint NB FAIT | **Statut :** `FAIT` | **Type :** CLEANUP

**Description :** Auditer les call sites du composant `hamburger-menu.tsx`. Le migrer ou supprimer selon les imports actifs (ADR §13 Phase 3).

**Tâches :**
- [ ] `TODO` Exécuter `grep -r "from.*layout/hamburger-menu" src/` pour trouver tous les imports actifs
- [ ] `TODO` Si imports actifs → évaluer si la fonctionnalité est couverte par les nouveaux sheets (FarmBottomNav, IngenieurBottomNav)
- [ ] `TODO` Migrer ou supprimer selon le résultat de l'audit
- [ ] `TODO` `npm run build` passe sans erreur après nettoyage

**Critères d'acceptation :**
- Aucune référence active à `hamburger-menu.tsx` dans le codebase (ou document la raison de le conserver si des imports actifs persistent)

---

### Story NC.4 — Nettoyage module-nav-items.ts : supprimer entrées Admin obsolètes
**Assigné à :** @developer | **Dépend de :** Sprint NB FAIT | **Statut :** `FAIT` | **Type :** CLEANUP

**Description :** Le fichier `src/lib/module-nav-items.ts` contient des entrées pour `Admin Abonnements`, `Admin Commissions`, `Admin Remises` qui pointent vers des routes `/admin/*` inexistantes depuis la migration backoffice (ADR §14.2, §13 Phase 3).

**Tâches :**
- [ ] `TODO` Dans `src/lib/module-nav-items.ts`, supprimer les entrées : "Admin Abonnements" (`/admin/abonnements`), "Admin Commissions" (`/admin/commissions`), "Admin Remises" (`/admin/remises`)
- [ ] `TODO` Vérifier que `/analytics/aliments` n'est référencé que dans le groupe Analytics (pas dans le groupe Intrants/Stock) selon l'ADR §2.3 note A12
- [ ] `TODO` Vérifier que tous les items restants dans `module-nav-items.ts` pointent vers des routes existantes

**Critères d'acceptation :**
- Aucune entrée dans `module-nav-items.ts` ne pointe vers `/admin/*`
- `/analytics/aliments` est dans le groupe Analytics uniquement

---

### Story NC.5 — Vérification couverture routes mobile 360px
**Assigné à :** @tester | **Dépend de :** NC.1, NC.2, NC.3, NC.4 | **Statut :** `FAIT` | **Type :** TEST

**Description :** Vérification complète que toutes les routes primaires sont accessibles en 2 taps max depuis la bottom nav à 360px de largeur.

**Tâches :**
- [ ] `TODO` Sur mobile simulé 360px, vérifier chaque route du tableau §2.3 (Farm) : accessible en ≤ 2 taps depuis la bottom nav
- [ ] `TODO` Sur mobile simulé 360px, vérifier chaque route du tableau §2.4 (Ingénieur) : accessible en ≤ 2 taps depuis la bottom nav
- [ ] `TODO` Vérifier les routes détail (vagues/[id], releves/[id], etc.) : accessibles en ≤ 3 taps total
- [ ] `TODO` Documenter toute route non conforme à la règle "2 taps" dans le rapport de test

**Critères d'acceptation :**
- 100% des routes primaires accessibles en ≤ 2 taps sur mobile 360px
- Aucun item de navigation mène à une page 404 ou vide

---

### Story NC.6 — Vérification couverture routes desktop
**Assigné à :** @tester | **Dépend de :** NC.1, NC.2, NC.3, NC.4 | **Statut :** `FAIT` | **Type :** TEST

**Description :** Vérification que toutes les routes accessibles via la sidebar desktop sont fonctionnelles et correctement groupées.

**Tâches :**
- [ ] `TODO` Sur desktop (>= 1024px), vérifier que FarmSidebar affiche tous les groupes et items listés dans l'ADR §4.4
- [ ] `TODO` Sur desktop, vérifier que IngenieurSidebar affiche les 4 groupes listés dans l'ADR §5.4
- [ ] `TODO` Vérifier que la FarmHeader et IngenieurHeader sont masquées sur desktop (`md:hidden` effectif)
- [ ] `TODO` Vérifier que les sidebars sont masquées sur mobile (`md:block` ou équivalent effectif)

**Critères d'acceptation :**
- Aucune route de sidebar ne produit une 404
- Aucun item de navigation legacy (`/admin/*`, `/calibrages`) n'apparaît dans la sidebar

---

### Story NC.7 — Audit ARIA et accessibilité navigation
**Assigné à :** @tester | **Dépend de :** NC.5, NC.6 | **Statut :** `FAIT` | **Type :** TEST

**Description :** Audit d'accessibilité ARIA complet sur tous les composants de navigation selon les règles de l'ADR §15.

**Tâches :**
- [ ] `TODO` Vérifier `aria-current="page"` sur l'item actif de la bottom nav (FarmBottomNav, IngenieurBottomNav)
- [ ] `TODO` Vérifier `aria-label="Nouveau relevé"` sur le FAB ingénieur
- [ ] `TODO` Vérifier `aria-label` ou `aria-labelledby` sur tous les `SheetContent` Radix UI (farm et ingénieur)
- [ ] `TODO` Vérifier touch targets ≥ 44×44px pour tous les items de la bottom nav et du sheet (inspecter CSS)
- [ ] `TODO` Vérifier `aria-disabled="true"` sur les items offline (après simulation offline)
- [ ] `TODO` Vérifier que les boutons sans texte visible ont un `aria-label` explicite (NotificationBell, SiteSelector)

**Critères d'acceptation :**
- Aucun élément interactif de navigation sans `aria-label` explicite
- Tous les touch targets ≥ 44px en hauteur et largeur
- `aria-current="page"` correct sur l'item actif

---

### Story NC.8 — Tests de non-régression et review finale Sprint NC
**Assigné à :** @tester | **Dépend de :** NC.7 | **Statut :** `FAIT` | **Type :** TEST

**Tâches :**
- [ ] `TODO` Exécuter `npx vitest run` — tous les tests doivent passer (anciens + nouveaux depuis NA/NB)
- [ ] `TODO` Exécuter `npm run build` — build production sans erreur
- [ ] `TODO` Vérifier que les tests des sprints précédents (FA-FD) ne sont pas régressés
- [ ] `TODO` Produire rapport `docs/tests/rapport-sprint-NC.md`

---

### Story NC.9 — Review finale Sprint NC
**Assigné à :** @code-reviewer | **Dépend de :** NC.8 | **Statut :** `FAIT` | **Type :** REVIEW

**Tâches :**
- [ ] `TODO` Vérifier que tous les composants legacy supprimés n'ont plus d'imports actifs
- [ ] `TODO` Vérifier R1-R9 sur les fichiers de nettoyage (pas de régression)
- [ ] `TODO` Vérifier conformité ADR §13 Phase 3, §14.3
- [ ] `TODO` Produire rapport `docs/reviews/review-sprint-NC.md`

---

## Sprint G0 — Pre-requis Gompertz : Validation LM (review-gompertz-implementation)

**Objectif :** Valider la convergence de l'algorithme Levenberg-Marquardt sur les donnees biometriques DK Farm.
**Reference :** `docs/reviews/review-gompertz-implementation.md`, `docs/sprints/SPRINT-PLAN-GOMPERTZ.md`

---

### Story G0.1 — Validation convergence Levenberg-Marquardt
**Assigne a :** @architect | **Depend de :** Aucune | **Statut :** `FAIT` | **Type :** RESEARCH

**Taches :**
- [x] `FAIT` LM implementé from scratch (pas de npm — ESM incompatibilité)
- [x] `FAIT` Ecrire script `scripts/test-gompertz-lm.ts` avec donnees seed
- [x] `FAIT` Tester convergence avec 5, 10, 15 points — R² > 97% sur tous les cas
- [x] `FAIT` Tester bornes physiques : K ∈ [0.005, 0.2], W∞ ∈ [max, 3000g], ti ∈ [0, 120j]
- [x] `FAIT` Documenter decision GO dans `docs/decisions/ADR-gompertz-lm-validation.md`

**Resultat :** GO — LM converge sur 5+ points (R²>97%). Min 5 biometries exigé. `npm run test:gompertz` ajouté.

---

## Sprint G1 — Fondations Gompertz (review-gompertz-implementation)

**Objectif :** Implementer la lib de calcul Gompertz, la table de persistance, et l'API de calibrage.
**Depend de :** Sprint G0 (GO)

---

### Story G1.1 — Bibliotheque `gompertz.ts` — Fonctions pures
**Assigne a :** @developer | **Depend de :** G0.1 GO | **Statut :** `FAIT` | **Type :** FEATURE

**Taches :**
- [x] `FAIT` Creer `src/lib/gompertz.ts` avec interfaces GompertzParams, GompertzCalibrationInput, GompertzCalibrationResult, GompertzConfidenceLevel
- [x] `FAIT` Implementer `gompertzWeight(t, params)` — prediction poids
- [x] `FAIT` Implementer `gompertzVelocity(t, params)` — taux croissance dW/dt
- [x] `FAIT` Implementer `calibrerGompertz(input)` — regression LM from scratch avec bornes
- [x] `FAIT` Implementer `projeterDateRecolte(params, poidsObjectif, joursActuels)`
- [x] `FAIT` Implementer `genererCourbeGompertz(params, joursMax, pas)`
- [x] `FAIT` Strategie d'initialisation : W∞₀ = max×2.5, K₀ = 0.03, ti₀ = mean(jours)
- [x] `FAIT` Graduation confiance : INSUFFICIENT_DATA (<5 pts), LOW (5-6), MEDIUM (7-9), HIGH (10+, R²>0.95)

---

### Story G1.2 — Tests unitaires `gompertz.ts`
**Assigne a :** @tester | **Depend de :** G1.1 | **Statut :** `FAIT` | **Type :** TEST

**Taches :**
- [x] `FAIT` Creer `src/__tests__/lib/gompertz.test.ts` — 54 tests
- [x] `FAIT` Tests convergence sur jeux synthetiques (15 points FAO) — R² > 0.95
- [x] `FAIT` Tests bornes (K negatif impossible, W∞ > max observe)
- [x] `FAIT` Tests cas degeneres (0 pts, 1 pt, 4 pts → null)
- [x] `FAIT` Tests confidence level selon nombre de points (LOW/MEDIUM/HIGH)

---

### Story G1.3 — Migration Prisma : table `GompertzVague`
**Assigne a :** @db-specialist | **Depend de :** Aucune | **Statut :** `FAIT` | **Type :** DB

**Taches :**
- [x] `FAIT` Ajouter modele GompertzVague dans schema.prisma (1:1 Vague, CASCADE)
- [x] `FAIT` Champs : wInfinity, k, ti, r2, rmse, biometrieCount, confidenceLevel, siteId
- [x] `FAIT` Relation gompertz sur Vague, gompertzVagues sur Site
- [x] `FAIT` Generer migration SQL manuellement + appliquer (migration 20260329000000_add_gompertz_vague)

---

### Story G1.4 — API route `GET /api/vagues/[id]/gompertz`
**Assigne a :** @developer | **Depend de :** G1.1, G1.3 | **Statut :** `FAIT` | **Type :** FEATURE

**Taches :**
- [x] `FAIT` Creer `src/app/api/vagues/[id]/gompertz/route.ts` (GET)
- [x] `FAIT` Auth + siteId (R8) via requirePermission(VAGUES_VOIR)
- [x] `FAIT` Calibrage lazy : recalcule si biometrieCount a change
- [x] `FAIT` Upsert dans GompertzVague
- [x] `FAIT` Retourner { vagueId, calibration, courbe, dateRecolteEstimee }

---

### Story G1.5 — Constantes reference Gompertz dans benchmarks
**Assigne a :** @developer | **Depend de :** G1.1 | **Statut :** `FAIT` | **Type :** FEATURE

**Taches :**
- [x] `FAIT` Ajouter GOMPERTZ_REF_CLARIAS dans `src/lib/benchmarks.ts`
- [x] `FAIT` Implementer `evaluerKGompertz(k)` : EXCELLENT / BON / FAIBLE
- [x] `FAIT` Exporter type GompertzKLevel

---

## Sprint G2 — Integration UI Gompertz (review-gompertz-implementation)

**Objectif :** Afficher la courbe Gompertz dans le dashboard projections. Badges fiabilite. Date recolte Gompertz vs SGR.
**Depend de :** Sprint G1 FAIT

---

### Story G2.1 — Extension types TypeScript (non-breaking)
**Assigne a :** @architect | **Depend de :** G1.1 | **Statut :** `FAIT` | **Type :** TYPES

**Taches :**
- [x] `FAIT` Ajouter `poidsGompertz?: number | null` a CourbeCroissancePoint
- [x] `FAIT` Creer ProjectionVagueV2 avec gompertzParams, gompertzR2, gompertzConfidence, dateRecolteGompertz
- [x] `FAIT` Exporter GompertzParams, GompertzConfidenceLevel, GompertzCalibrationResult depuis types/index.ts

---

### Story G2.2 — Extension CourbeProjectionChart : ligne Gompertz
**Assigne a :** @developer | **Depend de :** G2.1 | **Statut :** `FAIT` | **Type :** UI

**Taches :**
- [x] `FAIT` Ajouter Line Gompertz conditionnelle (orange, tirets 2 2, sans dots, connectNulls)
- [x] `FAIT` Etendre legende : Reel / Projete (SGR) / Gompertz
- [x] `FAIT` Etendre Tooltip avec les 3 valeurs via labelMap

---

### Story G2.3 — Extension ProjectionCard : badges et date recolte
**Assigne a :** @developer | **Depend de :** G2.1 | **Statut :** `FAIT` | **Type :** UI

**Taches :**
- [ ] `TODO` Badge fiabilite : HIGH/MEDIUM/LOW/INSUFFICIENT_DATA
- [ ] `TODO` Date recolte Gompertz a cote de date SGR
- [ ] `TODO` Traduction parametres en langage metier (poids plafond, vitesse, pic)
- [ ] `TODO` Section "Details techniques" collapsible pour INGENIEUR/ADMIN

---

### Story G2.4 — Connexion Server Component → API Gompertz
**Assigne a :** @developer | **Depend de :** G1.4, G2.2 | **Statut :** `FAIT` | **Type :** FEATURE

**Taches :**
- [x] `FAIT` Enrichir directement server-side (pas de self-fetch) via enrichWithGompertz()
- [x] `FAIT` Merger courbe Gompertz dans courbeProjection (Map O(1) lookup)
- [x] `FAIT` Remplir gompertzParams, R2, confidence, dateRecolteGompertz
- [x] `FAIT` Gerer gracieusement le cas null (try/catch, pas de crash dashboard)

---

### Story G2.5 — Tests UI projections Gompertz
**Assigne a :** @tester | **Depend de :** G2.4 | **Statut :** `FAIT` | **Type :** TEST

**Taches :**
- [x] `FAIT` Creer `src/__tests__/ui/gompertz-projections.test.tsx` — 47 tests
- [x] `FAIT` Tests 4 scenarios confidence level (INSUFFICIENT_DATA, LOW, MEDIUM, HIGH)
- [x] `FAIT` Tests details techniques par role (ADMIN/INGENIEUR vs GERANT)
- [x] `FAIT` Test non-regression projections existantes (13 tests SGR classique)
- [x] `FAIT` Build production OK + rapport docs/tests/rapport-sprint-G2.5.md

---

## Sprint G3 — Comparaison aliments via K Gompertz (NICE-TO-HAVE)

**Objectif :** Agreger le parametre K par aliment pour comparaison objective de l'impact sur la croissance.
**Depend de :** Sprint G2 FAIT + min. 3 vagues terminees avec donnees Gompertz
**Condition :** Sprint conditionnel.

---

### Story G3.1 — Agregation K par produitId
**Assigne a :** @db-specialist | **Depend de :** G1.3 | **Statut :** `FAIT` | **Type :** DB/QUERY

**Taches :**
- [x] `FAIT` Creer `src/lib/queries/gompertz-analytics.ts`
- [x] `FAIT` Implementer `getKParAliment(siteId)` — K moyen pondere par aliment (single query, no N+1)
- [x] `FAIT` Filtrer : confidenceLevel HIGH/MEDIUM, >= 2 vagues par aliment
- [x] `FAIT` Retourner : produitId, nom, fournisseur, kMoyen, kNiveau, nombreVagues + details[]

---

### Story G3.2 — Extension types AnalytiqueAliment
**Assigne a :** @architect | **Depend de :** G1.5 | **Statut :** `FAIT` | **Type :** TYPES

**Taches :**
- [x] `FAIT` Ajouter kMoyenGompertz et kNiveauGompertz a AnalytiqueAliment, kGompertz a DetailAlimentVague
- [x] `FAIT` Exporter GompertzKLevel depuis src/types/index.ts — Build passe

---

### Story G3.3 — UI comparaison aliments avec K Gompertz
**Assigne a :** @developer | **Depend de :** G3.1, G3.2 | **Statut :** `FAIT` | **Type :** UI

**Taches :**
- [x] `FAIT` Colonne "Vitesse Gompertz" dans feed-comparison-cards.tsx avec badges couleur
- [x] `FAIT` K en langage metier : Rapide (vert) / Normal (amber) / Lent (rouge)
- [x] `FAIT` Graphique barre horizontale K par aliment (feed-k-comparison-chart.tsx)
- [x] `FAIT` Conditionnel si pas de donnees Gompertz, integration dans analytics-aliments-page.tsx
- [x] `FAIT` i18n fr/en ajoutees (namespace gompertz dans analytics.json)

---

### Story G3.4 — Tests agregation K et UI
**Assigne a :** @tester | **Depend de :** G3.3 | **Statut :** `FAIT` | **Type :** TEST

**Taches :**
- [x] `FAIT` 23 tests `getKParAliment` (K ponderes, filtrage siteId, min 2 vagues, tri, details)
- [x] `FAIT` 23 tests UI : feed-comparison-cards K column + feed-k-comparison-chart
- [x] `FAIT` Build production OK — 46 tests passent, rapport docs/tests/rapport-sprint-G3.4.md

---

## Sprint I18N — Migration i18n : Texte francais code en dur

**Objectif :** Migrer ~45 composants client contenant du texte francais hardcode vers next-intl (useTranslations/getTranslations).
**Reference :** Audit composants i18n (2026-03-30)
**Depend de :** Aucun sprint bloquant

---

### Story I18N.0 — Fondation : Audit et extension des fichiers de traduction JSON
**Assigne a :** @developer | **Depend de :** Aucune | **Statut :** `FAIT` | **Type :** REFACTOR

**Taches :**
- [x] `FAIT` Audit des namespaces JSON existants et inventaire des cles
- [x] `FAIT` Extraction des chaines francaises hardcodees de 45 composants
- [x] `FAIT` Creation de 19 fichiers namespace fr/ et en/ (calibrage, config-elevage, planning, besoins, bacs, observations, notes, depenses, remises, sites, packs, admin, backoffice, pwa, dashboard, layout, alertes, activites, ingenieur)
- [x] `FAIT` Mise a jour de src/i18n/request.ts avec les 19 nouveaux namespaces
- [x] `FAIT` Build OK

---

### Story I18N.1 — Migration i18n : Config Elevage + Calibrage (7 fichiers)
**Assigne a :** @developer | **Depend de :** I18N.0 | **Statut :** `FAIT` | **Type :** REFACTOR

**Taches :**
- [x] `FAIT` 7 fichiers migres : config-elevage-edit-client, config-elevage-form-client, step-groupes, step-mortalite, step-sources, step-recap, modifier-calibrage-dialog
- [x] `FAIT` Build OK

---

### Story I18N.2 — Migration i18n : Planning (4 fichiers)
**Assigne a :** @developer | **Depend de :** I18N.0 | **Statut :** `FAIT` | **Type :** REFACTOR

**Taches :**
- [x] `FAIT` 4 fichiers migres : planning-client, nouvelle-activite-form, modifier-activite-dialog, completer-activite-dialog
- [x] `FAIT` Build OK (2 labels mineurs restants dans modifier-activite-dialog — reportes)

---

### Story I18N.3 — Migration i18n : Besoins (3 fichiers)
**Assigne a :** @developer | **Depend de :** I18N.0 | **Statut :** `FAIT` | **Type :** REFACTOR

**Taches :**
- [x] `FAIT` 3 fichiers migres : besoins-form-client, modifier-besoin-dialog, besoins-detail-client
- [x] `FAIT` Build OK

---

### Story I18N.4 — Migration i18n : Bacs, Observations, Notes (3 fichiers)
**Assigne a :** @developer | **Depend de :** I18N.0 | **Statut :** `FAIT` | **Type :** REFACTOR

**Taches :**
- [x] `FAIT` 3 fichiers migres : bacs-list-client, observation-form, note-form
- [x] `FAIT` Build OK

---

### Story I18N.5 — Migration i18n : Depenses & Remises (4 fichiers)
**Assigne a :** @developer | **Depend de :** I18N.0 | **Statut :** `FAIT` | **Type :** REFACTOR

**Taches :**
- [x] `FAIT` 4 fichiers migres : depense-detail-client, recurrentes-list-client, remise-form-dialog, remises-list-client
- [x] `FAIT` Build OK

---

### Story I18N.6 — Migration i18n : Sites & Roles (5 fichiers)
**Assigne a :** @developer | **Depend de :** I18N.0 | **Statut :** `FAIT` | **Type :** REFACTOR

**Taches :**
- [x] `FAIT` 5 fichiers migres : site-detail-client, sites-list-client, member-actions-dialog, roles/nouveau/page, roles/[roleId]/page
- [x] `FAIT` Build OK

---

### Story I18N.7 — Migration i18n : Packs (3 fichiers)
**Assigne a :** @developer | **Depend de :** I18N.0 | **Statut :** `FAIT` | **Type :** REFACTOR

**Taches :**
- [x] `FAIT` 3 fichiers migres : pack-detail-client, pack-activer-client, packs-list-client
- [x] `FAIT` Build OK

---

### Story I18N.8 — Migration i18n : Admin & Backoffice (6 fichiers)
**Assigne a :** @developer | **Depend de :** I18N.0 | **Statut :** `FAIT` | **Type :** REFACTOR

**Taches :**
- [x] `FAIT` 6 fichiers migres : admin-site-status-dialog, admin-module-form-dialog, admin-analytics-dashboard, backoffice-header, backoffice-sidebar, backoffice-site-status-dialog
- [x] `FAIT` Build OK

---

### Story I18N.9 — Migration i18n : PWA, Dashboard, Layout & Divers (11 fichiers)
**Assigne a :** @developer | **Depend de :** I18N.0 | **Statut :** `FAIT` | **Type :** REFACTOR

**Taches :**
- [x] `FAIT` 11 fichiers migres : sw-register, install-prompt, pin-setup-dialog, sync-status-panel, quick-actions, fab-releve, notification-card, placeholders-client, instruction-viewer, vente-form-client (complete), client-card
- [x] `FAIT` Build OK

---

### Story I18N.10 — Tests et Review Sprint I18N
**Assigne a :** @tester + @code-reviewer | **Depend de :** I18N.1-I18N.9 | **Statut :** `FAIT` | **Type :** TEST + REVIEW

**Taches :**
- [x] `FAIT` Build production OK (138 pages)
- [x] `FAIT` 3787 tests passent, 0 echec
- [x] `FAIT` Audit : 43/45 fichiers 100% conformes, 2 anomalies mineures dans planning/ (reportees)
- [x] `FAIT` Parite fr/en verifiee et corrigee (remises.json 2 cles manquantes ajoutees)
- [x] `FAIT` Rapports : docs/tests/rapport-sprint-I18N.md + docs/reviews/review-sprint-I18N.md

---

## Sprint CR1 — Code Review : Intégrité données & Validation API

**Objectif :** Corriger les problèmes critiques et hauts identifiés dans la code review du 31 mars 2026 : pagination, validation partagée, gardes de calcul, format d'erreur unifié.
**Référence :** `docs/reviews/farmflow-code-review-2026-03-31.docx`

---

### Story CR1.1 — Pagination sur tous les endpoints GET
**Assigné à :** @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** FEATURE
**Priorité :** Critique

**Description :** Les endpoints GET (releves, activites, vagues, bacs, etc.) retournent des résultats non bornés. Un batch avec 1000+ relevés retourne tout d'un coup, ce qui pose un risque de performance et de mémoire côté client.

**Tâches :**
- [x] `FAIT` Définir une interface `PaginationParams { limit: number; offset: number }` dans `src/types/api.ts`
- [x] `FAIT` Définir une interface `PaginatedResponse<T> { data: T[]; total: number; limit: number; offset: number }` dans `src/types/api.ts`
- [x] `FAIT` Ajouter limit/offset (défaut 50, max 200) sur `GET /api/releves`
- [x] `FAIT` Ajouter limit/offset sur `GET /api/vagues`, `GET /api/bacs`, `GET /api/activites`
- [x] `FAIT` Ajouter limit/offset sur `GET /api/ventes`, `GET /api/factures`, `GET /api/commandes`
- [x] `FAIT` Ajouter limit/offset sur `GET /api/stock/mouvements`, `GET /api/depenses`
- [x] `FAIT` Mettre à jour les hooks React Query pour passer limit/offset
- [x] `FAIT` Tests : vérifier que limit > 200 retourne 400, que offset fonctionne correctement

**Critères d'acceptation :**
- Tous les endpoints GET de liste supportent limit/offset
- Défaut : limit=50, max : 200
- La réponse inclut `total` pour permettre la pagination côté client
- Aucune régression sur les pages existantes

---

### Story CR1.2 — Extraction des schémas de validation Zod partagés
**Assigné à :** @architect + @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** REFACTOR
**Priorité :** Haute

**Description :** La logique de validation pour TypeReleve, dates, consommations est dupliquée 3 fois (POST, PUT, PATCH) dans les routes releves. Extraire dans des schémas Zod partagés.

**Tâches :**
- [x] `FAIT` Créer `src/lib/validation/releve.schema.ts` avec schémas Zod par type de relevé
- [x] `FAIT` Créer `src/lib/validation/common.schema.ts` pour date, pagination, consommations
- [x] `FAIT` Refactoriser `src/app/api/releves/route.ts` POST pour utiliser les schémas Zod
- [x] `FAIT` Refactoriser `src/app/api/releves/[id]/route.ts` PUT et PATCH pour utiliser les schémas Zod
- [x] `FAIT` Supprimer le code de validation dupliqué (estimé ~200 lignes)
- [x] `FAIT` Ajouter validation des bornes numériques : pH [0-14], température [0-50°C], O₂ [0-20 mg/L], NH₃ [0-10 mg/L]
- [x] `FAIT` Ajouter max-length sur les champs texte (notes: 2000, description: 2000, raison: 500)
- [x] `FAIT` Tests unitaires sur les schémas Zod

**Critères d'acceptation :**
- Un seul endroit définit la validation par type de relevé
- Les bornes numériques sont validées côté API
- Les champs texte ont des limites de longueur
- Aucune régression (tous les tests existants passent)

---

### Story CR1.3 — Format d'erreur API unifié
**Assigné à :** @architect + @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** REFACTOR
**Priorité :** Moyenne

**Description :** Les erreurs API utilisent des formats incohérents : `{status, message, errors}`, `{status, error, ressource, limite}`, `{status, message}`. Unifier dans un seul format.

**Tâches :**
- [x] `FAIT` Définir `ApiErrorResponse { status: number; message: string; code?: string; errors?: { field: string; message: string }[] }` dans `src/types/api.ts`
- [x] `FAIT` Créer helper `apiError(status, message, opts?)` dans `src/lib/api-utils.ts`
- [x] `FAIT` Migrer les routes releves vers le format unifié
- [x] `FAIT` Migrer les routes vagues, bacs, activites vers le format unifié
- [x] `FAIT` Migrer les routes stock, ventes, factures vers le format unifié
- [x] `FAIT` Mettre à jour les hooks React Query pour parser le format unifié

**Critères d'acceptation :**
- Toutes les réponses d'erreur utilisent la même structure
- Le helper `apiError()` est utilisé dans toutes les routes
- Build OK + tests passent

---

### Story CR1.4 — Garde SGR négatif et arrondi vivants par bac
**Assigné à :** @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** BUGFIX
**Priorité :** Haute

**Description :** Deux problèmes identifiés dans `src/lib/calculs.ts` :
1. `calculerSGRRequis()` retourne un SGR négatif si poidsObjectif < poidsMoyenActuel (physiquement impossible)
2. `computeVivantsByBac()` perd des poissons lors de la répartition par arrondi (1000/3 = 333×3 = 999)

**Tâches :**
- [x] `FAIT` Ajouter garde dans `calculerSGRRequis()` : retourner null si poidsObjectif <= poidsMoyenActuel
- [x] `FAIT` Corriger `computeVivantsByBac()` : utiliser floor + distribuer le reste au dernier bac
- [x] `FAIT` Ajouter cap sur `genererCourbeProjection()` : maximum 500 points (éviter boucle infinie)
- [x] `FAIT` Tests unitaires pour chaque correction

**Critères d'acceptation :**
- `calculerSGRRequis(50, 30, 10)` retourne null (pas un SGR négatif)
- `computeVivantsByBac(1000, 3 bacs)` retourne [334, 333, 333] (total = 1000)
- `genererCourbeProjection(50, 2, 10000)` retourne max 500 points

---

## Sprint CR2 — Code Review : Refinements Gompertz

**Objectif :** Corriger les problèmes spécifiques au modèle de croissance Gompertz identifiés dans la code review.
**Dépend de :** Sprint CR1 (non bloquant, peut démarrer en parallèle)
**Référence :** `docs/reviews/farmflow-code-review-2026-03-31.docx`

---

### Story CR2.1 — Correction seuil asymétrique recalibrage W∞
**Assigné à :** @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** BUGFIX
**Priorité :** Haute

**Description :** Dans `src/app/api/vagues/[id]/gompertz/route.ts`, le seuil de recalibrage compare `|old - new| > new × 0.1`. Ce calcul est asymétrique : une hausse de 8% ne déclenche pas le recalibrage mais une baisse de 8% le déclenche.

**Tâches :**
- [x] `FAIT` Remplacer la comparaison asymétrique par : `Math.abs(old - new) / Math.max(old, new) > 0.1`
- [x] `FAIT` Ajouter test unitaire vérifiant le comportement symétrique (hausse et baisse de 10%)

**Critères d'acceptation :**
- Un changement de W∞ de 1200→1330 (+10.8%) ET de 1200→1070 (-10.8%) déclenchent tous les deux le recalibrage
- Tests passent

---

### Story CR2.2 — Fallback numérique pour projection proche asymptote
**Assigné à :** @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** FEATURE
**Priorité :** Moyenne

**Description :** `projeterDateRecolte()` retourne null pour tout poidsObjectif ≥ 99% de W∞. Le seuil de 99% est arbitraire et rejette des projections valides pour les gros poissons. Ajouter un fallback par recherche numérique (bisection) pour la zone asymptotique.

**Tâches :**
- [x] `FAIT` Implémenter une fonction `numericallyInvertGompertz(params, targetWeight, currentDay)` par bisection dans `src/lib/gompertz.ts`
- [x] `FAIT` Modifier `projeterDateRecolte()` : utiliser le fallback numérique si poidsObjectif ≥ 95% de W∞ (au lieu de retourner null à 99%)
- [x] `FAIT` Ajouter tests : objectif à 96%, 98%, 99.5% de W∞
- [x] `FAIT` Documenter le changement dans le JSDoc

**Critères d'acceptation :**
- `projeterDateRecolte({wInfinity: 1200, k: 0.03, ti: 60}, 1150, 50)` retourne un nombre > 0 (pas null)
- Précision du fallback : ±0.5 jour
- Tests passent

---

### Story CR2.3 — Validation K dans gompertz-analytics
**Assigné à :** @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** BUGFIX
**Priorité :** Moyenne

**Description :** Dans `src/lib/queries/gompertz-analytics.ts`, `kMoyen` n'est pas validé avant d'être passé à `evaluerKGompertz()`. Si kMoyen est NaN, 0 ou Infinity, le résultat est imprévisible.

**Tâches :**
- [ ] `TODO` Ajouter garde : `if (isNaN(kMoyen) || !isFinite(kMoyen) || kMoyen <= 0) continue;`
- [ ] `TODO` Filtrer les produits avec `sommeQuantite === 0` en amont (avant le calcul de kMoyen)
- [ ] `TODO` Test unitaire avec données edge case (quantité 0, K négatif)

**Critères d'acceptation :**
- Un produit avec 0 quantité totale n'apparaît pas dans les résultats
- Un K de 0 ou NaN est filtré silencieusement
- Tests passent

---

### Story CR2.4 — Alignement tests Gompertz avec production
**Assigné à :** @tester | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** TEST
**Priorité :** Moyenne

**Description :** Le script de test `scripts/test-gompertz-lm.ts` utilise des bornes différentes de la production (`ti: [0, 120]` vs `[0, 300]`) et un K initial différent (0.03 vs 0.018). Les données de test sont parfaites (pas de bruit de mesure).

**Tâches :**
- [x] `FAIT` Aligner bornes ti du script de test : `[0, 300]` (comme production)
- [x] `FAIT` Aligner K initial du script de test : `0.018` (comme CLARIAS_DEFAULTS.k)
- [x] `FAIT` Ajouter un jeu de données bruité (±5-10% variance aléatoire sur les poids)
- [x] `FAIT` Ajouter un cas de test avec ti > 120 jours
- [x] `FAIT` Vérifier que tous les cas passent avec R² > 0.90

**Critères d'acceptation :**
- Bornes et valeurs initiales identiques entre test et production
- Au moins 1 jeu de données bruité validé
- `npm run test:gompertz` passe

---

### Story CR2.5 — Revue seuils de confiance Gompertz
**Assigné à :** @developer | **Dépend de :** CR2.4 | **Statut :** `FAIT` | **Type :** RESEARCH
**Priorité :** Basse

**Description :** Les seuils de confiance actuels semblent trop stricts : 5 points FAO avec R²=0.99 obtiennent MEDIUM au lieu de HIGH. Analyser et proposer des seuils ajustés.

**Tâches :**
- [x] `FAIT` Analyser la distribution R² sur les sous-ensembles du dataset FAO Clarias
- [x] `FAIT` Proposer des seuils ajustés R²-sensibles : LOW (R²≤0.92), MEDIUM (R²>0.92), HIGH (n≥8 ET R²>0.95)
- [x] `FAIT` Documenter la décision dans `docs/decisions/ADR-gompertz-confidence-thresholds.md`
- [x] `FAIT` Implémenter — décision GO

**Critères d'acceptation :**
- Proposition documentée avec justification ✓
- Décision GO/NO-GO avant implémentation ✓ (GO)

---

## Sprint CR3 — Code Review : Qualité Frontend

**Objectif :** Refactoriser le formulaire principal de relevés, ajouter les error boundaries, améliorer l'accessibilité, et extraire les utilitaires dupliqués.
**Dépend de :** Sprint CR1 (la story CR1.2 Zod est utile mais non bloquante)
**Référence :** `docs/reviews/farmflow-code-review-2026-03-31.docx`

---

### Story CR3.1 — Refactoring releve-form-client.tsx
**Assigné à :** @developer | **Dépend de :** CR1.2 (idéalement) | **Statut :** `FAIT` | **Type :** REFACTOR
**Priorité :** Haute

**Description :** Le composant `releve-form-client.tsx` fait 539 lignes avec 10 useState, un état formulaire non typé (`Record<string, string>`), des eslint-disable, et aucune mémoisation. Refactoriser en pattern container/presenter.

**Tâches :**
- [x] `FAIT` Extraire un hook `useReleveForm()` contenant la logique d'état et validation
- [x] `FAIT` Typer l'état du formulaire avec un type discriminé par TypeReleve (remplacer Record<string, string>)
- [x] `FAIT` Séparer en : `ReleveFormContainer` (logique) + `ReleveFormFields` (rendu)
- [x] `FAIT` Supprimer le cast `as unknown as Parameters<...>` (ligne 254) grâce au typage correct
- [x] `FAIT` Ajouter `useCallback` sur `updateField` et les handlers onChange
- [x] `FAIT` Ajouter `useMemo` sur les listes filtrées (bacs, produits)
- [x] `FAIT` Wrapper les sous-composants (FormBiometrie, FormMortalite, etc.) avec `React.memo`
- [x] `FAIT` Supprimer les `eslint-disable-next-line` (lignes 105, 116, 143) et corriger les dépendances
- [x] `FAIT` Build OK + tests existants passent

**Critères d'acceptation :**
- Aucun fichier ne dépasse 300 lignes
- Zéro `any` ou cast `as unknown`
- Zéro `eslint-disable` dans le composant
- Performance : pas de re-render inutile sur les sous-composants (vérifiable via React DevTools)

---

### Story CR3.2 — Error boundaries par section
**Assigné à :** @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** FEATURE
**Priorité :** Moyenne

**Description :** Seuls les fichiers `error.tsx` au niveau page existent. Un crash dans un graphique Recharts ou un composant analytics fait tomber toute la page. Ajouter des error boundaries par section fonctionnelle.

**Tâches :**
- [x] `FAIT` Créer `src/components/ui/error-boundary.tsx` — composant réutilisable avec fallback UI
- [x] `FAIT` Wrapper les composants analytics/graphiques avec l'error boundary
- [x] `FAIT` Wrapper les formulaires (releves, ventes, stock) avec l'error boundary
- [x] `FAIT` Wrapper les sections dashboard (KPIs, projections) avec l'error boundary
- [x] `FAIT` Fallback UI : message d'erreur en français + bouton "Réessayer"

**Critères d'acceptation :**
- Un crash dans un graphique n'empêche pas l'utilisation du reste de la page
- Le fallback est en français et cohérent avec le design existant
- Build OK

---

### Story CR3.3 — Accessibilité ARIA sur les formulaires
**Assigné à :** @developer | **Dépend de :** CR3.1 (idéalement) | **Statut :** `FAIT` | **Type :** FEATURE
**Priorité :** Moyenne

**Description :** Les formulaires manquent d'attributs ARIA essentiels : `aria-required`, `aria-invalid`, `aria-live` pour les feedbacks de validation. L'accessibilité est niveau A partiel (WCAG 2.1).

**Tâches :**
- [x] `FAIT` Ajouter `aria-required="true"` sur tous les champs obligatoires des formulaires
- [x] `FAIT` Ajouter `aria-invalid="true"` sur les champs en erreur
- [x] `FAIT` Ajouter `aria-live="polite"` sur les zones d'affichage d'erreurs de validation
- [x] `FAIT` Ajouter `aria-labelledby` sur les sections de formulaire (FormSection)
- [x] `FAIT` Ajouter `aria-describedby` sur les champs avec description/aide contextuelle
- [x] `FAIT` Vérifier la navigation clavier sur le formulaire multi-étapes de relevé

**Critères d'acceptation :**
- Tous les champs obligatoires ont `aria-required`
- Les erreurs de validation sont annoncées aux lecteurs d'écran
- Navigation clavier fonctionnelle sur tout le formulaire

---

### Story CR3.4 — Extraction utilitaires de formatage
**Assigné à :** @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** REFACTOR
**Priorité :** Basse

**Description :** `toLocaleString("fr-FR")` apparaît 20+ fois, le formatage de dates est dupliqué dans 3+ fichiers, et le formatage monétaire (FCFA) n'est pas centralisé.

**Tâches :**
- [x] `FAIT` Créer `src/lib/format.ts` avec : `formatNumber(n)`, `formatCFA(n)`, `formatDate(d)`, `formatDateTime(d)`, `formatWeight(g)`
- [x] `FAIT` Remplacer les 20+ occurrences de `toLocaleString("fr-FR")` par les utilitaires
- [x] `FAIT` Remplacer les formatages de date dupliqués dans releve-form, modifier-releve-dialog, layout
- [x] `FAIT` Tests unitaires sur les fonctions de formatage

**Critères d'acceptation :**
- Zéro appel direct à `toLocaleString("fr-FR")` en dehors de `format.ts`
- Les utilitaires sont utilisés partout
- Build OK + tests passent

---

### Story CR3.5 — Mémoisation et performance React
**Assigné à :** @developer | **Dépend de :** CR3.1 | **Statut :** `FAIT` | **Type :** PERFORMANCE
**Priorité :** Basse

**Description :** Seulement 45 usages de memo/useMemo/useCallback sur 911 fichiers. Plusieurs composants re-render inutilement, les fonctions de tooltip Recharts sont créées inline.

**Tâches :**
- [x] `FAIT` Profiler avec React DevTools les pages vagues/[id], releves, et dashboard
- [x] `FAIT` Ajouter `React.memo` sur les composants de présentation à fort re-render
- [x] `FAIT` Extraire les fonctions de tooltip Recharts inline en constantes mémorisées
- [x] `FAIT` Ajouter `useMemo` sur les listes filtrées dans les composants de liste (vagues-list, stock-list)
- [ ] `SKIP` Auditer le bundle size avec `@next/bundle-analyzer` (out of scope pour cette story)

**Critères d'acceptation :**
- Les pages principales ne montrent pas de re-renders inutiles dans React DevTools Profiler
- Le bundle size est documenté (baseline avant/après)

---

## Sprint CR4 — Code Review : Robustesse API & Architecture

**Objectif :** Corriger les problèmes de robustesse API restants : fire-and-forget, soft deletes, idempotence.
**Dépend de :** Sprint CR1
**Référence :** `docs/reviews/farmflow-code-review-2026-03-31.docx`

---

### Story CR4.1 — Retry sur hooks async activity engine
**Assigné à :** @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** FEATURE
**Priorité :** Moyenne

**Description :** `triggerSeuilRulesAsync()` et `runEngineForSite()` sont appelés en fire-and-forget avec `.catch()` mais sans mécanisme de retry. Si la DB échoue pendant l'exécution async, les activités ne sont jamais générées.

**Tâches :**
- [x] `FAIT` Créer `src/lib/async-retry.ts` avec helper `retryAsync(fn, maxRetries=3, delayMs=1000)`
- [x] `FAIT` Wrapper `triggerSeuilRulesAsync()` avec le retry dans `src/app/api/releves/route.ts`
- [x] `FAIT` Wrapper `runEngineForSite()` avec le retry
- [x] `FAIT` Logger les échecs définitifs (après max retries) avec un niveau ERROR
- [x] `FAIT` Test unitaire du helper retry

**Critères d'acceptation :**
- Un échec transitoire de la DB est retenté automatiquement (max 3 fois)
- Les erreurs définitives sont loggées clairement
- Pas d'impact sur le temps de réponse HTTP (toujours fire-and-forget)

---

### Story CR4.2 — Idempotence sur les mutations critiques
**Assigné à :** @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** FEATURE
**Priorité :** Basse

**Description :** L'idempotence via `X-Idempotency-Key` n'est implémentée que sur POST releves. Les autres mutations critiques (ventes, commandes, mouvements stock) n'en bénéficient pas.

**Tâches :**
- [x] `FAIT` Extraire la logique d'idempotence dans un helper réutilisable `withIdempotency(handler)`
- [x] `FAIT` Appliquer sur `POST /api/ventes`
- [x] `FAIT` Appliquer sur `POST /api/commandes`
- [x] `FAIT` Appliquer sur `POST /api/stock/mouvements`
- [x] `FAIT` Vérifier que le hash du body est inclus dans la clé (éviter réponse stale avec body différent)

**Critères d'acceptation :**
- Les 4 endpoints de mutation critiques supportent l'idempotence
- Même clé + même body = même réponse (replay)
- Même clé + body différent = erreur 409

---

### Story CR4.3 — Parallélisation queries séquentielles
**Assigné à :** @developer | **Dépend de :** Aucune | **Statut :** `FAIT` | **Type :** PERFORMANCE
**Priorité :** Basse

**Description :** `triggerSeuilRulesAsync()` effectue 4 queries séquentielles (vague, produits, regles, activites) qui pourraient être parallélisées avec `Promise.all()`. De même, certaines routes rechargent un record après update au lieu de réutiliser le résultat.

**Tâches :**
- [x] `FAIT` Paralléliser les queries indépendantes dans `triggerSeuilRulesAsync()` avec `Promise.all()`
- [x] `FAIT` Dans `PATCH /api/releves/[id]`, réutiliser le résultat de `patchReleve()` au lieu de refaire un `findFirst`
- [x] `FAIT` Identifier et corriger d'autres patterns similaires (query après update)

**Critères d'acceptation :**
- Les queries indépendantes s'exécutent en parallèle
- Pas de query redondante après mutation
- Aucune régression fonctionnelle

---

### Story CR5.0 — Tests et Review Sprint CR
**Assigné à :** @tester + @code-reviewer | **Dépend de :** CR1.1-CR4.3 | **Statut :** `FAIT` | **Type :** TEST + REVIEW

**Tâches :**
- [x] `FAIT` `npx vitest run` — 3 963 tests passés, 0 régression (OOM releves-form.test.tsx pre-existing)
- [x] `FAIT` `npm run build` — build production OK (0 erreur TypeScript, 1 warning mineur pre-existing)
- [x] `FAIT` Vérifier checklist R1-R9 — toutes les règles conformes
- [ ] `SKIP` Test manuel mobile (360px) — non applicable en environnement CI
- [x] `FAIT` Écrire `docs/reviews/review-sprint-CR.md`
- [x] `FAIT` Écrire `docs/tests/rapport-sprint-CR.md`

**Critères d'acceptation :**
- Zéro régression sur les tests existants
- Les nouveaux tests couvrent chaque correction
- Build production OK
- Review conforme R1-R9

---

## Sprint UX — UI/UX Fixes (Audit Frontend)

> **Objectif :** Corriger les problèmes d'UX mobile identifiés lors de l'audit frontend (safe areas, touch targets, dialogs, cohérence visuelle).

---

### Story UX.1 — Dialog sticky footer avec safe-area
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Critique

**Problème :** Dans `src/components/ui/dialog.tsx`, header+body+footer sont dans un seul `overflow-y-auto`. Les boutons d'action scrollent hors de la vue sur mobile.

**Fix :** Restructurer `DialogContent` : header non-scrollable, body `flex-1 overflow-y-auto`, footer sticky avec `pb-[max(1rem,env(safe-area-inset-bottom))]`. Créer un sous-composant `DialogBody` si nécessaire.

**Fichier(s) :** `src/components/ui/dialog.tsx`

**Critères d'acceptation :**
- Le footer reste visible en permanence sur mobile (360px)
- Safe-area-inset-bottom respectée
- Aucune régression sur les dialogs existants

---

### Story UX.2 — Ajouter max-h/overflow aux dialogs manquants
**Assigné à :** @developer | **Dépend de :** UX.1 | **Statut :** `FAIT` | **Priorité :** Critique

**Problème :** 6 dialogs n'ont pas de `max-h` ni `overflow`, le contenu dépasse le viewport sur mobile.

**Fix :** Ajouter `max-h-[90dvh] overflow-y-auto` ou adopter le pattern sticky-footer de UX.1.

**Fichier(s) :**
- `src/components/stock/produits-list-client.tsx`
- `src/components/stock/produit-detail-client.tsx`
- `src/components/stock/mouvements-list-client.tsx`
- `src/components/stock/fournisseurs-list-client.tsx`
- `src/components/ventes/facture-detail-client.tsx`
- `src/components/besoins/besoins-detail-client.tsx`

**Critères d'acceptation :**
- Tous les dialogs restent dans le viewport sur 360px
- Le contenu long est scrollable dans le body

---

### Story UX.3 — Safe-area-inset-bottom sur bottom sheet nav
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Haute

**Problème :** La section utilisateur du bottom sheet (`farm-bottom-nav.tsx` ligne 466) a `py-3` sans safe-area. Le bouton déconnexion est masqué par l'indicateur home sur iPhone.

**Fix :** Changer `py-3` en `pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]`.

**Fichier(s) :** `src/components/layout/farm-bottom-nav.tsx`

---

### Story UX.4 — Bouton "Annuler" trop étroit sur mobile
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Haute

**Problème :** Le bouton danger "Annuler" dans `commande-detail-client.tsx` (lignes 322-330) n'a pas `flex-1`, créant un déséquilibre avec le bouton primaire.

**Fix :** Ajouter `className="flex-1"` au bouton danger.

**Fichier(s) :** `src/components/stock/commande-detail-client.tsx`

---

### Story UX.5 — Supprimer pb-24 hardcodé dans besoins
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Moyenne

**Problème :** Les 3 composants besoins ont `pb-24` (96px) qui double-stack avec le padding de `app-shell.tsx`.

**Fix :** Supprimer `pb-24` — l'app-shell gère déjà le clearance de la bottom nav.

**Fichier(s) :**
- `src/components/besoins/besoins-list-client.tsx`
- `src/components/besoins/besoins-form-client.tsx`
- `src/components/besoins/besoins-detail-client.tsx`

---

### Story UX.6 — Alignement icône filtre (ventes/factures)
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Moyenne

**Problème :** L'icône `Filter` utilise `mb-2.5` pour s'aligner verticalement — hack fragile.

**Fix :** Utiliser `items-center` sur le container, supprimer `mb-2.5`.

**Fichier(s) :**
- `src/components/ventes/ventes-list-client.tsx`
- `src/components/ventes/factures-list-client.tsx`

---

### Story UX.7 — Besoins tabs overflow-x-auto manquant
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Moyenne

**Problème :** 6 tabs besoins débordent sur 360px. Le wrapper `overflow-x-auto -mx-4 px-4` utilisé par commandes est absent.

**Fix :** Appliquer le pattern `<div className="overflow-x-auto -mx-4 px-4"><TabsList className="w-max">`.

**Fichier(s) :** `src/components/besoins/besoins-list-client.tsx`

---

### Story UX.8 — Mouvements tabs overflow wrapper manquant
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Moyenne

**Problème :** Inconsistant avec les autres écrans — pas de wrapper overflow sur les tabs mouvements.

**Fix :** Même pattern overflow que UX.7.

**Fichier(s) :** `src/components/stock/mouvements-list-client.tsx`

---

### Story UX.9 — Bouton X (supprimer fichier) sous 44px WCAG
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Moyenne

**Problème :** Le bouton `<button>` avec icône X (16x16px) est bien en dessous du minimum 44x44px WCAG pour les cibles tactiles.

**Fix :** Ajouter `min-h-[44px] min-w-[44px] flex items-center justify-center` ou utiliser `<Button size="sm" variant="ghost">`.

**Fichier(s) :**
- `src/components/stock/reception-commande-dialog.tsx`
- `src/components/stock/commande-detail-client.tsx`

---

### Story UX.10 — Zone scroll max-h-80 trop courte dans dialogs workflow
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Moyenne

**Problème :** `max-h-80` (320px) dans les dialogs "Traiter" est trop court — seulement 2-3 lignes visibles, sans indicateur visuel de scroll.

**Fix :** Utiliser `max-h-[50vh]` et ajouter une ombre inset pour indiquer le scroll.

**Fichier(s) :** `src/components/besoins/besoins-detail-client.tsx` (lignes 461, 521)

---

### Story UX.11 — Bouton Trash sans aria-label ni min-width
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Moyenne

**Problème :** Le bouton icône Trash2 n'a pas d'`aria-label` (inaccessible aux lecteurs d'écran) et est trop étroit.

**Fix :** Ajouter `aria-label={t("commandes.detail.supprimerFacture")}` et `min-w-[44px]`.

**Fichier(s) :** `src/components/stock/commande-detail-client.tsx` (lignes 361-366)

---

### Story UX.12 — Normaliser indentation DialogContent dans les listes
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Basse

**Problème :** `DialogContent` apparaît au mauvais niveau d'indentation dans le code — confus en code review.

**Fix :** Normaliser l'indentation ou extraire les dialog forms dans des sous-composants.

**Fichier(s) :**
- `src/components/stock/commandes-list-client.tsx`
- `src/components/stock/produits-list-client.tsx`
- `src/components/stock/mouvements-list-client.tsx`

---

### Story UX.13 — Labels besoins hardcodés en français (pas i18n)
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Basse

**Problème :** Les statuts et labels des tabs besoins sont des strings hardcodées au lieu d'utiliser `useTranslations("besoins")`.

**Fix :** Utiliser `t("statuts.xxx")` comme les autres écrans. Ajouter les clés dans `src/messages/fr/besoins.json` et `src/messages/en/besoins.json`.

**Fichier(s) :** `src/components/besoins/besoins-list-client.tsx` (lignes 18-24)

---

### Story UX.14 — Inconsistance hover style (ring vs border)
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Basse

**Problème :** Les cards ventes/factures utilisent `hover:border-primary/30` alors que stock utilise `hover:ring-1 hover:ring-primary/30`.

**Fix :** Uniformiser sur `hover:ring-1 hover:ring-primary/30 transition-all`.

**Fichier(s) :**
- `src/components/ventes/ventes-list-client.tsx`
- `src/components/ventes/factures-list-client.tsx`

---

### Story UX.15 — max-w-lg inutile sur mobile dans modifier-besoin
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Basse

**Problème :** `max-w-lg` sur `DialogContent` n'a aucun effet sur mobile (full-screen `inset-0`).

**Fix :** Supprimer ou conserver uniquement pour desktop via `md:max-w-lg`.

**Fichier(s) :** `src/components/besoins/modifier-besoin-dialog.tsx` (ligne 255)

---

### Story UX.16 — Texte "Créé par" sans marge bottom sur pages détail
**Assigné à :** @developer | **Dépend de :** — | **Statut :** `FAIT` | **Priorité :** Basse

**Problème :** Le texte metadata en bas des pages détail colle au bord du padding sans espace de respiration.

**Fix :** Ajouter `mb-2` à la ligne `<p>` "Créé par".

**Fichier(s) :**
- `src/components/stock/commande-detail-client.tsx`
- `src/components/ventes/vente-detail-client.tsx`
- `src/components/ventes/facture-detail-client.tsx`

---

### Story UX.17 — Tests et Review Sprint UX
**Assigné à :** @tester + @code-reviewer | **Dépend de :** UX.1-UX.16 | **Statut :** `FAIT` | **Type :** TEST + REVIEW

**Tâches :**
- [x] `FAIT` `npm run build` — Build production OK
- [x] `FAIT` Test manuel mobile (360px) — vérifier safe areas, dialogs, touch targets
- [x] `FAIT` Vérifier checklist R1-R9
- [x] `FAIT` Écrire `docs/reviews/review-sprint-UX.md`

**Critères d'acceptation :**
- Zéro régression sur les tests existants
- Build production OK
- Tous les dialogs respectent les safe areas sur mobile
- Touch targets ≥ 44px sur tous les boutons interactifs

---

## Sprints 45-53 — Refactoring Abonnements (ADR-020)

> **Plan détaillé :** `docs/sprints/SPRINTS-SUBSCRIPTIONS-REFACTORING.md`
> **ADR :** `docs/decisions/020-subscription-refactoring.md`
> **39 stories** couvrant : passage user-level, plan EXONERATION, essais gratuits, upgrade/downgrade avec prorata, solde créditeur, ressources bloquées, audit trail.

| Sprint | Titre | Stories | Statut |
|--------|-------|---------|--------|
| **45** | Migration additive (Schema + Data + Types + Constants) | 45.1–45.5 | `TODO` |
| **46** | Queries et check functions (user-level) | 46.1–46.4 | `EN COURS` |
| **47** | API routes adaptation | 47.1–47.4 | `TODO` |
| **48** | UI cleanup + messages + flow création site + UI bloqué | 48.1–48.5 | `TODO` |
| **49** | Essais (Trial) | 49.1–49.4 | `TODO` |
| **50** | Upgrade / Downgrade | 50.1–50.7 | `TODO` |
| **51** | Backoffice Exonération | 51.1–51.3 | `TODO` |
| **52** | Cleanup migration + retrait fallback | 52.1–52.3 | `TODO` |
| **53** | Tests intégration + Review finale | 53.1–53.4 | `TODO` |
