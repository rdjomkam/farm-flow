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
