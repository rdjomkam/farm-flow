# Plan de Sprints — Phase 3 : Starter Packs & Guided Farming

**Version :** 1.1
**Date :** 2026-03-15
**Auteur :** @project-manager
**Source :** docs/requirements/REQ-STARTER-PACKS.md v1.1
**Reviews intégrées :** adversarial-review-REQ-STARTER-PACKS.md (23 findings), edge-cases-REQ-STARTER-PACKS.md (76 edge cases)

> **IMPORTANT — Renumérotation des sprints :** Ce plan utilisait initialement les numéros 13-17.
> Ces numéros étaient en conflit avec les sprints existants dans `docs/TASKS.md` (Sprint 13 = Liaison Planning,
> Sprint 14 = Unités d'achat, Sprint 15 = Upload Facture, Sprint 16-18 = Dépenses/Besoins/Récurrences).
> **Les sprints Phase 3 Starter Packs sont renumérotés Sprint 19-23** pour éviter tout conflit.
> Mettre à jour `docs/TASKS.md` quand ces sprints commencent.

---

## Résumé des Sprints (renumérotés Sprint 19-23)

| Sprint original | Sprint réel | Stories | Focus | Dépend de |
|----------------|-------------|---------|-------|-----------|
| Sprint 13 | **Sprint 19** | 8 | ConfigElevage & Refactoring Benchmarks | Sprint 18 terminé |
| Sprint 14 | **Sprint 20** | 9 | Packs & Provisioning automatisé | Sprint 19 |
| Sprint 15 | **Sprint 21** | 10 | Moteur d'Activités (Activity Engine) | Sprint 20 |
| Sprint 16 | **Sprint 22** | 8 | UX Guidée & Instructions | Sprint 21 |
| Sprint 17 | **Sprint 23** | 9 | Monitoring Ingénieur & Polish | Sprint 22 |
| **Total** | | **44** | | |

---

## Findings et Edge Cases adressés par sprint

| Sprint | Findings adressés | Edge Cases adressés |
|--------|-------------------|---------------------|
| 13 | F-08, F-22 | EC-5.1, EC-5.2, EC-5.3, EC-5.4, EC-5.5, EC-5.6, EC-5.7 |
| 14 | F-03, F-04, F-05, F-06, F-07, F-10, F-14, F-15 | EC-1.1–1.7, EC-2.1–2.10, EC-12.1 |
| 15 | F-01, F-02, F-11, F-16 | EC-3.1–3.13, EC-9.1–9.4, EC-11.1–11.2 |
| 16 | F-19, F-21 | EC-4.1–4.5, EC-14.4, EC-11.3 |
| 17 | F-09, F-17 | EC-7.1–7.5, EC-10.1, EC-10.3, EC-10.4, EC-12.4 |

---

## Sprint 13 — ConfigElevage & Refactoring Benchmarks

**Objectif :** Mettre en place le modèle ConfigElevage (paramètres configurables par site) et refactorer les modules existants (benchmarks.ts, alertes.ts, calculs.ts) pour les rendre configurables. C'est la fondation de toute la Phase 3.

---

### S13-1 : Modèle Prisma ConfigElevage + Migration
**Agent :** @db-specialist
**Priorite :** Haute
**Dependances :** Aucune
**Statut :** FAIT

**Description :**
Créer le modèle ConfigElevage dans schema.prisma avec ses ~50 champs scalaires et 2 champs JSON. Ajouter l'enum PhaseElevage. Créer et exécuter la migration. Ajouter la relation Site ↔ ConfigElevage. Ajouter un index unique partiel pour garantir qu'un seul `isDefault=true` existe par site (adresse F-22, EC-5.2).

**Criteres d'acceptation :**
- [ ] Modèle ConfigElevage complet avec tous les champs de la section 6.2 du REQ
- [ ] Enum `PhaseElevage` créé (ACCLIMATATION, CROISSANCE_DEBUT, JUVENILE, GROSSISSEMENT, FINITION, PRE_RECOLTE)
- [ ] Contrainte unique partielle `@@unique([siteId], where: { isDefault: true })` ou équivalent via trigger/index filtré pour EC-5.2
- [ ] Relation `Site.configs ConfigElevage[]` ajoutée
- [ ] `onDelete: SetNull` sur les FK pointant vers ConfigElevage (EC-5.5)
- [ ] Migration exécutée sans erreur (`npx prisma migrate deploy`)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- prisma/schema.prisma
- prisma/migrations/YYYYMMDDHHMMSS_add_config_elevage/

---

### S13-2 : Interfaces TypeScript ConfigElevage + Schemas Zod
**Agent :** @architect
**Priorite :** Haute
**Dependances :** S13-1
**Statut :** FAIT

**Description :**
Définir les interfaces TypeScript miroir de ConfigElevage, les DTOs de création/édition, et les schemas Zod pour valider les champs JSON (`alimentTailleConfig`, `alimentTauxConfig`). La validation Zod doit vérifier la cohérence des ranges de poids (pas de gaps/overlaps), la monotonie des seuils de phase, et l'absence d'inversions dans les benchmarks (adresse F-08, EC-5.3, EC-5.6, EC-5.7).

**Criteres d'acceptation :**
- [ ] Interface `ConfigElevage` dans src/types/models.ts
- [ ] DTOs `CreateConfigElevageDTO`, `UpdateConfigElevageDTO` dans src/types/api.ts
- [ ] Schema Zod `alimentTailleConfigSchema` : valide poidsMin < poidsMax, pas de gaps dans les ranges
- [ ] Schema Zod `alimentTauxConfigSchema` : valide toutes les phases présentes, tauxMin <= tauxMax
- [ ] Validation que les seuils de phase sont monotoniquement croissants (EC-5.7)
- [ ] Validation que les benchmarks excellent > bon > acceptable (EC-5.6)
- [ ] Enum `PhaseElevage` exporté depuis src/types/index.ts
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/types/models.ts
- src/types/api.ts
- src/types/index.ts
- src/lib/validation/config-elevage.ts (nouveau)

---

### S13-3 : Seed des profils ConfigElevage pré-définis
**Agent :** @db-specialist
**Priorite :** Moyenne
**Dependances :** S13-1
**Statut :** FAIT

**Description :**
Ajouter les 3 profils ConfigElevage pré-définis dans le seed SQL : "Clarias Standard Cameroun" (800g, 180j, isDefault=true), "Clarias Express" (500g, 120j), "Clarias Premium" (1200g, 240j). Chaque profil a ses valeurs JSON `alimentTailleConfig` et `alimentTauxConfig` conformes aux tables des sections 6.3 et 6.4 du REQ.

**Criteres d'acceptation :**
- [ ] 3 profils ConfigElevage insérés pour le site DKFarm existant
- [ ] Le profil "Clarias Standard Cameroun" a `isDefault = true`
- [ ] Les champs JSON sont valides et conformes aux sections 6.3/6.4
- [ ] Les valeurs de benchmarks correspondent aux defaults du modèle
- [ ] Seed s'exécute sans erreur sur base vide (`npm run db:seed`)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- prisma/seed.sql

---

### S13-4 : API CRUD ConfigElevage + endpoint /defaut + /dupliquer
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S13-1, S13-2
**Statut :** FAIT

**Description :**
Implémenter les routes API pour gérer les profils ConfigElevage. GET/POST sur `/api/config-elevage`, GET/PUT/DELETE sur `/api/config-elevage/[id]`, GET sur `/api/config-elevage/defaut` (retourne la config par défaut du site, ou une config système en fallback — adresse EC-5.1), POST sur `/api/config-elevage/[id]/dupliquer`. La validation entrante utilise les schemas Zod de S13-2. Restreindre l'accès : seuls ADMIN et GERANT peuvent modifier, PISCICULTEUR lecture seule (adresse EC-12.2).

**Criteres d'acceptation :**
- [ ] Route GET `/api/config-elevage` : liste les profils du site actif
- [ ] Route POST `/api/config-elevage` : crée un profil avec validation Zod des champs JSON
- [ ] Route GET `/api/config-elevage/[id]` : détail d'un profil
- [ ] Route PUT `/api/config-elevage/[id]` : mise à jour partielle avec validation
- [ ] Route DELETE `/api/config-elevage/[id]` : suppression (interdit si `isDefault` ou si liée à un Pack actif)
- [ ] Route GET `/api/config-elevage/defaut` : retourne la config par défaut du site, ou les valeurs hardcodées en fallback (EC-5.1)
- [ ] Route POST `/api/config-elevage/[id]/dupliquer` : copie un profil avec nouveau nom
- [ ] Permissions : PISCICULTEUR = lecture seule (EC-12.2)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/api/config-elevage/route.ts (nouveau)
- src/app/api/config-elevage/[id]/route.ts (nouveau)
- src/app/api/config-elevage/defaut/route.ts (nouveau)
- src/app/api/config-elevage/[id]/dupliquer/route.ts (nouveau)
- src/lib/queries/config-elevage.ts (nouveau)

---

### S13-5 : Refactoring benchmarks.ts — Seuils configurables
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S13-2
**Statut :** FAIT

**Description :**
Refactorer `src/lib/benchmarks.ts` pour que `evaluerBenchmark()` accepte un paramètre `ConfigElevage` optionnel au lieu de lire depuis des constantes hardcodées. Si aucune config n'est fournie, les valeurs par défaut actuelles sont utilisées (fallback — EC-5.1). Mapper les 15 champs benchmark de ConfigElevage (fcrExcellentMax, sgrBonMin, etc.) aux seuils existants. Mettre à jour tous les appels existants.

**Criteres d'acceptation :**
- [ ] `evaluerBenchmark()` accepte un paramètre optionnel `config?: ConfigElevage`
- [ ] Fallback vers les constantes actuelles si `config` est undefined (EC-5.1)
- [ ] Les 5 benchmarks (FCR, SGR, Survie, Densité, Mortalité) lisent depuis la config
- [ ] Tous les appels existants dans le codebase mis à jour
- [ ] Les tests existants passent toujours (rétrocompatibilité)
- [ ] Nouveaux tests avec config custom
- [ ] Build OK

**Fichiers concernes :**
- src/lib/benchmarks.ts
- src/components/ (tous les fichiers appelant evaluerBenchmark)

---

### S13-6 : Refactoring alertes.ts + calculs.ts — Seuils et taux configurables
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S13-2
**Statut :** FAIT

**Description :**
Refactorer `src/lib/alertes.ts` pour lire les seuils de qualité d'eau et mortalité depuis ConfigElevage. Refactorer `src/lib/calculs.ts` pour ajouter les fonctions `detecterPhase()`, `getTauxAlimentation()`, `getTailleAliment()` qui acceptent un paramètre ConfigElevage. Ajouter la conversion d'unités entre stock (KG/SACS) et alimentation (grammes) pour EC-14.4.

**Criteres d'acceptation :**
- [ ] `alertes.ts` : seuils pH, température, ammoniac, mortalité lus depuis ConfigElevage
- [ ] `alertes.ts` : fallback vers les valeurs actuelles si aucune config
- [ ] `calculs.ts` : nouvelle fonction `detecterPhase(poidsMoyen, config?)` → PhaseElevage
- [ ] `calculs.ts` : nouvelle fonction `getTauxAlimentation(poidsMoyen, config?)` → number
- [ ] `calculs.ts` : nouvelle fonction `getTailleAliment(poidsMoyen, config?)` → string
- [ ] `calculs.ts` : nouvelle fonction `convertirUniteStock(quantite, uniteSource, uniteDestination)` → number (EC-14.4)
- [ ] Tous les appels existants mis à jour
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/lib/alertes.ts
- src/lib/calculs.ts
- src/components/ (fichiers utilisant ces modules)

---

### S13-7 : UI Settings — Page ConfigElevage (liste + édition)
**Agent :** @developer
**Priorite :** Moyenne
**Dependances :** S13-4
**Statut :** FAIT

**Description :**
Créer les pages UI pour gérer les profils ConfigElevage. Page liste (`/settings/config-elevage`) avec cartes mobile-first montrant nom, objectif, durée, badge "Par défaut". Page édition (`/settings/config-elevage/[id]`) avec 8 sections repliables (Objectif, Phases, Alimentation, Benchmarks, Qualité eau, Tri/Biométrie, Densité, Récolte). Page création depuis un template. Formulaires avec gros boutons, mobile first.

**Criteres d'acceptation :**
- [ ] Page liste avec cartes (pas de tableaux sur mobile)
- [ ] Page édition avec sections repliables (Accordion Radix UI)
- [ ] Prévisualisation couleur des benchmarks (Excellent=vert, Bon=bleu, Acceptable=orange, Mauvais=rouge)
- [ ] Page création depuis un template (pré-remplit les champs)
- [ ] Validation côté client (schemas Zod réutilisés)
- [ ] Mobile first (360px testé)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/settings/config-elevage/page.tsx (nouveau)
- src/app/settings/config-elevage/[id]/page.tsx (nouveau)
- src/app/settings/config-elevage/nouveau/page.tsx (nouveau)
- src/components/config-elevage/ (nouveau dossier)

---

### S13-8 : Tests + Review Sprint 13
**Agent :** @tester + @code-reviewer
**Priorite :** Haute
**Dependances :** S13-1 à S13-7
**Statut :** FAIT

**Description :**
Écrire les tests unitaires pour les schemas Zod, les fonctions refactorées (benchmarks, alertes, calculs), les API routes config-elevage. Vérifier que les tests existants passent toujours (non-régression). Le code-reviewer valide la checklist R1-R9 et produit le rapport de review.

**Criteres d'acceptation :**
- [ ] Tests Zod : validation/rejet des JSON malformés, gaps dans ranges, inversions benchmarks
- [ ] Tests calculs : `detecterPhase()`, `getTauxAlimentation()`, `getTailleAliment()`, `convertirUniteStock()`
- [ ] Tests benchmarks : avec et sans config, fallback vérifié
- [ ] Tests alertes : seuils custom respectés
- [ ] Tests API : CRUD complet, permissions, fallback /defaut
- [ ] Non-régression : tous les tests existants (Phase 1+2) passent
- [ ] `npx vitest run` — tous les tests passent
- [ ] `npm run build` — Build production OK
- [ ] docs/reviews/review-sprint-13.md produit
- [ ] docs/tests/rapport-sprint-13.md produit

**Fichiers concernes :**
- src/__tests__/config-elevage/ (nouveau dossier)
- src/__tests__/calculs.test.ts (enrichi)
- src/__tests__/benchmarks.test.ts (enrichi ou nouveau)
- src/__tests__/alertes.test.ts (enrichi ou nouveau)
- docs/reviews/review-sprint-13.md (nouveau)
- docs/tests/rapport-sprint-13.md (nouveau)

---

## Sprint 14 — Packs & Provisioning Automatisé

**Objectif :** Mettre en place la gestion des packs (catalogue de kits de démarrage) et le provisioning automatique (création transactionnelle d'un site client complet lors de l'activation d'un pack). Résoudre les blockers F-03, F-05, F-06 de la review adversariale.

---

### S14-1 : Nouveaux enums et rôle INGENIEUR + permissions Phase 3
**Agent :** @db-specialist
**Priorite :** Haute
**Dependances :** Sprint 13 terminé
**Statut :** FAIT

**Description :**
Ajouter l'enum `StatutActivation` dans schema.prisma. Ajouter la valeur `INGENIEUR` dans l'enum `Role` (adresse F-10). Ajouter les nouvelles permissions Phase 3 : `GERER_PACKS`, `ACTIVER_PACKS`, `GERER_CONFIG_ELEVAGE`, `GERER_REGLES_ACTIVITES`, `MONITORING_CLIENTS`, `ENVOYER_NOTES`. Ajouter les valeurs manquantes à `TypeActivite` : `TRI`, `MEDICATION` (adresse F-02, EC-3.10). Créer et exécuter la migration.

**Criteres d'acceptation :**
- [ ] Enum `StatutActivation` : ACTIVE, EXPIREE, SUSPENDUE
- [ ] Enum `Role` : + INGENIEUR
- [ ] Enum `Permission` : + 6 nouvelles valeurs
- [ ] Enum `TypeActivite` : + TRI, MEDICATION (EC-3.10)
- [ ] Migration exécutée sans erreur
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- prisma/schema.prisma
- prisma/migrations/YYYYMMDDHHMMSS_add_phase3_enums/
- src/types/models.ts (mise à jour enums TS)
- src/types/index.ts

---

### S14-2 : Modèles Prisma Pack, PackProduit, PackActivation
**Agent :** @db-specialist
**Priorite :** Haute
**Dependances :** S14-1, S13-1
**Statut :** FAIT

**Description :**
Créer les 3 modèles dans schema.prisma conformément à la section 3.2 du REQ, avec les corrections issues de la review adversariale : retirer `@unique` sur `PackActivation.clientSiteId` (F-05 — un client peut acheter plusieurs packs), retirer `@unique` sur `PackActivation.vagueId` (F-06 — une vague peut être splitée après tri). Ajouter `configElevageId` sur Pack (section 6.13). Ajouter `configElevageId?` sur Vague (F-07). Ajouter `packActivationId?` sur Vague. Ajouter validation `nombreAlevins > 0` et `prixTotal >= 0` au niveau applicatif (EC-1.1, EC-1.7). Ajouter `onDelete: Restrict` sur PackProduit→Produit (EC-1.6). Bac.volume rendu nullable pour le provisioning (EC-2.4).

**Criteres d'acceptation :**
- [ ] Modèle `Pack` avec relation ConfigElevage (F-07)
- [ ] Modèle `PackProduit` avec `@@unique([packId, produitId])`, `onDelete: Restrict` sur produitId (EC-1.6)
- [ ] Modèle `PackActivation` SANS `@unique` sur clientSiteId (F-05) et vagueId (F-06)
- [ ] `PackActivation.siteId` = site DKFarm vendeur, `clientSiteId` = site client (F-04 clarifié)
- [ ] Vague + `configElevageId String?` + `packActivationId String?` (F-07)
- [ ] Bac.volume rendu `Float?` (nullable pour provisioning — EC-2.4)
- [ ] Relations inverses sur Site, User, Produit, Vague correctement ajoutées
- [ ] Migration exécutée sans erreur
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- prisma/schema.prisma
- prisma/migrations/YYYYMMDDHHMMSS_add_packs/
- src/types/models.ts
- src/types/api.ts

---

### S14-3 : Interfaces TypeScript + DTOs Packs
**Agent :** @architect
**Priorite :** Haute
**Dependances :** S14-2
**Statut :** FAIT

**Description :**
Définir les interfaces TypeScript miroir des 3 nouveaux modèles (Pack, PackProduit, PackActivation), les DTOs de création/édition, et le type pour le payload de provisioning. Définir le concept de "system user" pour les entités auto-générées (F-03) : un user système par site avec `isSystem=true` dont l'ID est utilisé pour `userId` sur les activités et mouvements stock auto-générés.

**Criteres d'acceptation :**
- [ ] Interfaces `Pack`, `PackProduit`, `PackActivation` dans models.ts
- [ ] DTOs `CreatePackDTO`, `ActivatePackDTO` dans api.ts
- [ ] Type `ProvisioningPayload` décrivant les 6 entités à créer
- [ ] Documentation de la stratégie "system user" pour F-03 (champ `isSystem Boolean @default(false)` sur User)
- [ ] Mise à jour barrel export dans index.ts
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/types/models.ts
- src/types/api.ts
- src/types/index.ts
- docs/decisions/010-system-user.md (nouveau)

---

### S14-4 : Champ isSystem sur User + seed system user
**Agent :** @db-specialist
**Priorite :** Haute
**Dependances :** S14-3
**Statut :** FAIT

**Description :**
Ajouter le champ `isSystem Boolean @default(false)` sur le modèle User. Créer la migration. Dans le seed, insérer un user système ("FarmFlow System", isSystem=true) pour le site DKFarm. Ce user sera utilisé comme `userId` pour toutes les entités auto-générées (activités, mouvements stock) lors du provisioning et par le moteur d'activités (adresse F-03).

**Criteres d'acceptation :**
- [ ] Champ `isSystem` ajouté sur User
- [ ] Migration exécutée sans erreur
- [ ] User système créé dans le seed pour le site DKFarm
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- prisma/schema.prisma
- prisma/migrations/YYYYMMDDHHMMSS_add_system_user/
- prisma/seed.sql

---

### S14-5 : API CRUD Packs + PackProduit
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S14-2, S14-3
**Statut :** FAIT

**Description :**
Implémenter les routes API pour gérer les packs. GET/POST sur `/api/packs`, GET/PUT/DELETE sur `/api/packs/[id]`, GET/POST/DELETE sur `/api/packs/[id]/produits`. Validation : `nombreAlevins > 0` (EC-1.1), `prixTotal >= 0` (EC-1.7), quantité PackProduit > 0 (EC-1.3). Empêcher la désactivation d'un Pack si des activations ACTIVE existent (EC-1.5). Permissions : seul ADMIN avec `GERER_PACKS`.

**Criteres d'acceptation :**
- [ ] Routes CRUD packs avec validation (EC-1.1, EC-1.3, EC-1.7)
- [ ] Routes CRUD PackProduit avec contrainte unique (packId + produitId)
- [ ] Empêcher désactivation si activations actives (EC-1.5)
- [ ] Permission `GERER_PACKS` requise
- [ ] Erreurs HTTP claires en français
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/api/packs/route.ts (nouveau)
- src/app/api/packs/[id]/route.ts (nouveau)
- src/app/api/packs/[id]/produits/route.ts (nouveau)
- src/lib/queries/packs.ts (nouveau)

---

### S14-6 : Logique de provisioning transactionnel
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S14-4, S14-5
**Statut :** FAIT

**Description :**
Implémenter la route POST `/api/packs/[id]/activer` qui exécute le provisioning complet dans une transaction Prisma (adresse EC-2.3). En une seule transaction : (1) créer le site client, (2) créer SiteMember (client=PISCICULTEUR, DKFarm admin=ADMIN), (3) copier la ConfigElevage du pack vers le site client, (4) créer la vague pré-configurée, (5) copier les produits du pack vers le stock client (F-14 — copier les Produit, pas juste référencer, avec `fournisseurId=null`), (6) créer les mouvements stock d'entrée, (7) créer la PackActivation. Générer le code "ACT-YYYY-NNN" avec gestion de l'overflow (EC-2.5). Empêcher la double-activation (EC-2.1).

**Criteres d'acceptation :**
- [ ] Transaction atomique — rollback complet si erreur (EC-2.3)
- [ ] Site créé avec nom dérivé du client
- [ ] SiteMember : client=PISCICULTEUR + DKFarm system user ajouté comme ADMIN (F-03)
- [ ] ConfigElevage copiée (pas liée) vers le site client (EC-5.8)
- [ ] Vague créée avec nombreInitial, poidsMoyenInitial depuis le Pack
- [ ] Bac créé avec volume=null (à renseigner par le client — EC-2.4)
- [ ] Produits COPIES vers le site client (F-14), fournisseurId=null
- [ ] MouvementStock ENTREE créés pour chaque produit copié
- [ ] Code PackActivation généré avec séquence (EC-2.5)
- [ ] Empêcher la double-activation même pack/même user (EC-2.1)
- [ ] userId des entités auto-générées = system user (F-03)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/api/packs/[id]/activer/route.ts (nouveau)
- src/lib/queries/provisioning.ts (nouveau)

---

### S14-7 : UI Admin — Gestion des Packs + Activation
**Agent :** @developer
**Priorite :** Moyenne
**Dependances :** S14-5, S14-6
**Statut :** FAIT

**Description :**
Créer les pages UI pour gérer les packs et activer un pack pour un client. Page liste des packs (`/packs`), page détail/édition (`/packs/[id]`), page création (`/packs/nouveau`), page d'activation (`/packs/[id]/activer`). Formulaire d'activation : sélectionner/créer un utilisateur client, résumé du pack, bouton de confirmation. Page liste des activations (`/activations`). Mobile first.

**Criteres d'acceptation :**
- [ ] Page liste packs avec cartes mobile-first
- [ ] Page création pack avec sélection de produits depuis le stock
- [ ] Page activation : formulaire avec sélection/création client
- [ ] Confirmation visuelle du provisioning (résumé des entités créées)
- [ ] Page liste activations avec filtres par statut
- [ ] Mobile first (360px)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/packs/page.tsx (nouveau)
- src/app/packs/[id]/page.tsx (nouveau)
- src/app/packs/nouveau/page.tsx (nouveau)
- src/app/packs/[id]/activer/page.tsx (nouveau)
- src/app/activations/page.tsx (nouveau)
- src/app/activations/[id]/page.tsx (nouveau)
- src/components/packs/ (nouveau dossier)

---

### S14-8 : Seed données Packs + Activations
**Agent :** @db-specialist
**Priorite :** Moyenne
**Dependances :** S14-2, S14-4
**Statut :** FAIT

**Description :**
Ajouter dans le seed SQL les données de test pour les Packs : 3 packs (Découverte 100, Starter 300, Pro 500) avec leurs PackProduit associés. Ajouter 1 PackActivation complète (un client avec son site, vague, stock, etc.) pour tester le flow complet en dev.

**Criteres d'acceptation :**
- [ ] 3 packs avec chacun 3-5 PackProduit
- [ ] 1 PackActivation complète avec toutes les entités liées
- [ ] User système présent pour les entités auto-générées
- [ ] Seed s'exécute sans erreur
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- prisma/seed.sql

---

### S14-9 : Tests + Review Sprint 14
**Agent :** @tester + @code-reviewer
**Priorite :** Haute
**Dependances :** S14-1 à S14-8
**Statut :** FAIT

**Description :**
Tests unitaires et d'intégration pour les modèles Pack, le provisioning transactionnel (rollback vérifié), les API routes packs. Tests des edge cases : double activation, pack avec 0 alevins, PackProduit quantité négative, désactivation avec activation active. Review checklist R1-R9.

**Criteres d'acceptation :**
- [ ] Tests provisioning : transaction complète + rollback sur erreur
- [ ] Tests edge cases : EC-1.1 à EC-1.7, EC-2.1 à EC-2.5
- [ ] Tests permissions : GERER_PACKS, ACTIVER_PACKS
- [ ] Non-régression : tous les tests Sprint 13 passent
- [ ] `npx vitest run` — tous les tests passent
- [ ] `npm run build` — Build production OK
- [ ] docs/reviews/review-sprint-14.md produit
- [ ] docs/tests/rapport-sprint-14.md produit

**Fichiers concernes :**
- src/__tests__/packs/ (nouveau dossier)
- src/__tests__/provisioning.test.ts (nouveau)
- docs/reviews/review-sprint-14.md (nouveau)
- docs/tests/rapport-sprint-14.md (nouveau)

---

## Sprint 15 — Moteur d'Activités (Activity Engine)

**Objectif :** Implémenter le moteur de règles qui génère automatiquement des activités basées sur le temps, les relevés, le stock et les jalons de croissance. C'est le coeur de la fonctionnalité de guidage automatisé. Résoudre le blocker F-01 et le finding F-11.

---

### S15-1 : Modèle Prisma RegleActivite + enrichissement Activite
**Agent :** @db-specialist
**Priorite :** Haute
**Dependances :** Sprint 14 terminé
**Statut :** FAIT

**Description :**
Créer le modèle `RegleActivite` avec l'enum `TypeDeclencheur` (section 4.3 du REQ). Enrichir le modèle `Activite` existant avec les champs de la section 4.4 : `regleId`, `instructionsDetaillees`, `conseilIA`, `produitRecommandeId` (FK avec `@relation` — corrige F-01), `quantiteRecommandee`, `priorite`, `isAutoGenerated`, `phaseElevage`. Ajouter un champ `firedOnce Boolean @default(false)` sur RegleActivite pour gérer les seuils one-shot (EC-3.2). Résoudre le conflit `recurrence` vs `intervalleJours` en gardant `recurrence` sur Activite pour les manuelles et `intervalleJours` sur RegleActivite pour les règles (F-01). Rendre `userId` nullable sur Activite pour les auto-générées (ou utiliser system user — cohérent avec F-03).

**Criteres d'acceptation :**
- [ ] Modèle `RegleActivite` complet avec tous les champs section 4.3
- [ ] Enum `TypeDeclencheur` créé (8 valeurs)
- [ ] Champ `firedOnce` sur RegleActivite (EC-3.2)
- [ ] Activite enrichie : `regleId?`, `instructionsDetaillees?`, `produitRecommandeId?` (FK Produit avec @relation — F-01), `quantiteRecommandee?`, `priorite?`, `isAutoGenerated`, `phaseElevage?`
- [ ] `produitRecommandeId` est une vraie FK (pas un String dangling — F-01)
- [ ] RegleActivite.siteId nullable pour les règles globales (F-15 — null = global, sinon site-specific)
- [ ] Migration exécutée sans erreur
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- prisma/schema.prisma
- prisma/migrations/YYYYMMDDHHMMSS_add_activity_engine/

---

### S15-2 : Interfaces TypeScript RegleActivite + types du moteur
**Agent :** @architect
**Priorite :** Haute
**Dependances :** S15-1
**Statut :** FAIT

**Description :**
Définir les interfaces TypeScript pour RegleActivite, les DTOs, et les types internes du moteur de règles : `RuleEvaluationContext` (vague, indicateurs, stock, config), `RuleMatch` (règle + données de contexte), `GeneratedActivity` (activité à créer). Définir les types pour le template engine (placeholders résolus). Spécifier la liste exhaustive des placeholders disponibles (adresse F-19) : `{quantite_calculee}`, `{taille}`, `{poids_moyen}`, `{stock}`, `{taux}`, `{valeur}`, `{semaine}`, `{produit}`, `{seuil}`, `{jours_restants}`, `{quantite_recommandee}`.

**Criteres d'acceptation :**
- [ ] Interface `RegleActivite` dans models.ts
- [ ] DTOs `CreateRegleActiviteDTO`, `UpdateRegleActiviteDTO` dans api.ts
- [ ] Type `RuleEvaluationContext` avec tous les champs nécessaires
- [ ] Type `RuleMatch` pour le résultat de l'évaluation
- [ ] Type `TemplatePlaceholders` avec la liste exhaustive des placeholders (F-19)
- [ ] Documentation des placeholders dans le type (JSDoc)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/types/models.ts
- src/types/api.ts
- src/types/activity-engine.ts (nouveau)
- src/types/index.ts

---

### S15-3 : Moteur de règles — évaluation des conditions
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S15-2, S13-6
**Statut :** FAIT

**Description :**
Implémenter le moteur d'évaluation de règles dans `src/lib/activity-engine/evaluator.ts`. Pour chaque vague active, assembler le contexte (indicateurs, stock, config), puis évaluer chaque règle applicable (filtrée par phase, isActive). Implémenter les 8 types de déclencheurs. Gérer les cas : `phaseMin > phaseMax` rejeté à la validation (EC-3.5), règles avec conditions null match toujours (EC-3.12), skip vague avec 0 vivants (EC-3.9). Utiliser ConfigElevage du site pour les seuils. Définir le timezone Cameroon WAT (UTC+1) pour les calculs de jours (F-16, EC-11.1, EC-11.2).

**Criteres d'acceptation :**
- [ ] Évaluateur pour les 8 types de déclencheurs (CALENDRIER, RECURRENT, SEUIL_POIDS, SEUIL_QUALITE, SEUIL_MORTALITE, STOCK_BAS, FCR_ELEVE, JALON)
- [ ] Phase détectée via `detecterPhase()` de calculs.ts avec ConfigElevage
- [ ] Skip des vagues avec 0 vivants (EC-3.9)
- [ ] Validation `phaseMin <= phaseMax` (EC-3.5)
- [ ] Conditions null = match toujours (EC-3.12)
- [ ] Timezone UTC+1 pour les calculs de jours (F-16, EC-11.1)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/lib/activity-engine/evaluator.ts (nouveau)
- src/lib/activity-engine/context.ts (nouveau)
- src/lib/activity-engine/index.ts (nouveau)

---

### S15-4 : Template engine — résolution des placeholders
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S15-2, S15-3
**Statut :** FAIT

**Description :**
Implémenter le template engine qui résout les placeholders dans `titreTemplate` et `descriptionTemplate` des règles. Chaque placeholder (`{quantite_calculee}`, `{poids_moyen}`, etc.) est résolu depuis le `RuleEvaluationContext`. Les placeholders non résolus sont remplacés par un texte de fallback "[donnée non disponible]" (adresse F-19, EC-3.6).

**Criteres d'acceptation :**
- [ ] Fonction `resolveTemplate(template, context)` → string
- [ ] Tous les placeholders de la liste (F-19) supportés
- [ ] Placeholders non résolus → "[donnée non disponible]" (EC-3.6)
- [ ] Formattage des nombres selon la locale FR (EC-11.3)
- [ ] Tests unitaires pour chaque placeholder
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/lib/activity-engine/template-engine.ts (nouveau)

---

### S15-5 : Génération d'activités + déduplication + idempotence
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S15-3, S15-4
**Statut :** FAIT

**Description :**
Implémenter la génération d'activités à partir des règles matchées. Assurer l'idempotence : pour les règles RECURRENT et CALENDRIER, vérifier qu'une activité avec le même `regleId` + `vagueId` + même jour n'existe pas déjà avant de créer (EC-3.1). Pour les règles SEUIL_*, respecter le flag `firedOnce` (EC-3.2) et gérer les déclenchements concurrents (EC-3.11 — vérification atomique avec `createMany` conditionnel ou upsert). Gérer la priorité quand plusieurs règles conflictuelles matchent (EC-3.3 — la règle avec la plus haute priorité gagne).

**Criteres d'acceptation :**
- [ ] Génération d'activités depuis les règles matchées
- [ ] Déduplication : pas de doublon même regle+vague+date (EC-3.1)
- [ ] `firedOnce` respecté pour SEUIL_* (EC-3.2)
- [ ] Opérations atomiques pour éviter les doublons concurrents (EC-3.11)
- [ ] Priorité : si conflit, la règle avec `priorite` la plus basse (=plus urgent) gagne (EC-3.3)
- [ ] `userId` = system user du site (F-03)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/lib/activity-engine/generator.ts (nouveau)
- src/lib/activity-engine/dedup.ts (nouveau)

---

### S15-6 : CRON API + Event-driven triggers
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S15-5
**Statut :** FAIT

**Description :**
Implémenter deux points d'entrée pour le moteur : (1) Route API POST `/api/activites/generer` pour le CRON quotidien (évalue CALENDRIER + RECURRENT pour toutes les vagues actives du site), protégée par un token secret. (2) Hook event-driven dans POST `/api/releves` : après la création d'un relevé, évaluer les règles SEUIL_* pour la vague concernée. L'exécution CRON est idempotente (F-11). Utiliser Vercel Cron ou une API route schedulée. Gérer la concurrence CRON + event-driven (EC-9.2) via la dédup de S15-5.

**Criteres d'acceptation :**
- [ ] Route POST `/api/activites/generer` avec token d'authentification
- [ ] CRON idempotent (double-run ne génère pas de doublons — F-11, EC-3.1)
- [ ] Hook post-relevé pour évaluation SEUIL_* dans la route POST `/api/releves`
- [ ] Config Vercel cron dans vercel.json (quotidien à 06:00 WAT / 05:00 UTC)
- [ ] Concurrence CRON + event gérée (EC-9.2)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/api/activites/generer/route.ts (nouveau)
- src/app/api/releves/route.ts (modifié — ajout hook)
- vercel.json (modifié — ajout cron)

---

### S15-7 : API CRUD RegleActivite
**Agent :** @developer
**Priorite :** Moyenne
**Dependances :** S15-1, S15-2
**Statut :** FAIT

**Description :**
Implémenter les routes API pour gérer les règles d'activités. GET/POST sur `/api/regles-activites`, GET/PUT/DELETE sur `/api/regles-activites/[id]`. Les règles globales (`siteId=null`) sont visibles par tous les sites mais ne peuvent être modifiées que par un ADMIN DKFarm. Les règles site-specific sont gérées par l'ADMIN du site. Validation : `phaseMin <= phaseMax` (EC-3.5).

**Criteres d'acceptation :**
- [ ] Routes CRUD avec validation
- [ ] Règles globales (siteId=null) en lecture seule sauf pour ADMIN DKFarm
- [ ] Validation phaseMin <= phaseMax (EC-3.5)
- [ ] Permission `GERER_REGLES_ACTIVITES` requise pour modification
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/api/regles-activites/route.ts (nouveau)
- src/app/api/regles-activites/[id]/route.ts (nouveau)
- src/lib/queries/regles-activites.ts (nouveau)

---

### S15-8 : Seed du catalogue de règles pré-définies
**Agent :** @db-specialist
**Priorite :** Moyenne
**Dependances :** S15-1
**Statut :** FAIT

**Description :**
Insérer le catalogue complet de règles pré-définies (sections 4.5.1 à 4.5.5 du REQ) dans le seed SQL. Ce sont des règles globales (`siteId=null`). Inclure les ~20 règles couvrant : 4 activités quotidiennes récurrentes, 4 activités hebdomadaires, 5 seuils de poids, 5 activités d'anomalie, 5 jalons de production.

**Criteres d'acceptation :**
- [ ] ~23 règles insérées avec tous les champs renseignés
- [ ] `siteId = NULL` pour les règles globales (F-15)
- [ ] Templates avec placeholders conformes à la spéc (sections 4.5.x)
- [ ] Phases correctement assignées (phaseMin, phaseMax)
- [ ] Priorités assignées (anomalies = 1-3, quotidiennes = 5, jalons = 7)
- [ ] Seed s'exécute sans erreur
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- prisma/seed.sql

---

### S15-9 : Calcul automatique quantités d'aliment
**Agent :** @developer
**Priorite :** Moyenne
**Dependances :** S15-3, S13-6
**Statut :** FAIT

**Description :**
Implémenter le calcul automatique des quantités d'aliment dans le contexte du moteur d'activités. Quand une règle ALIMENTATION est évaluée, calculer la quantité quotidienne (`nombreVivants * poidsMoyen * tauxAlimentation`) en utilisant `getTauxAlimentation()` et `getTailleAliment()` de calculs.ts. Le `nombreVivants` est dérivé des relevés (comptage + mortalité - ventes) car il n'est pas stocké directement (EC-4.1). Le poids moyen est projeté si la dernière biométrie date de plus de 7 jours (EC-4.2).

**Criteres d'acceptation :**
- [ ] Fonction `calculerQuantiteAliment(context)` → { quantiteGrammes, tailleGranule, frequence }
- [ ] `nombreVivants` dérivé des relevés : dernierComptage - somme(mortalites) - somme(ventes) (EC-4.1)
- [ ] Projection poids moyen si dernière biométrie > 7 jours via SGR (EC-4.2)
- [ ] Taux d'alimentation = moyenne de tauxMin et tauxMax pour la phase (EC-4.3)
- [ ] Phase boundary : poids = seuil exact → phase supérieure (EC-4.4)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/lib/activity-engine/feeding.ts (nouveau)
- src/lib/calculs.ts (enrichi)

---

### S15-10 : Tests + Review Sprint 15
**Agent :** @tester + @code-reviewer
**Priorite :** Haute
**Dependances :** S15-1 à S15-9
**Statut :** FAIT

**Description :**
Tests unitaires et d'intégration pour le moteur d'activités : évaluation des 8 types de déclencheurs, déduplication, idempotence CRON, template engine, calcul alimentation. Tests des edge cases critiques : EC-3.1 à EC-3.13. Review checklist R1-R9 avec attention particulière sur les opérations atomiques (R4) et le siteId partout (R8).

**Criteres d'acceptation :**
- [ ] Tests évaluateur : 8 types de déclencheurs avec cas positifs et négatifs
- [ ] Tests déduplication : double-run CRON, concurrent event+CRON
- [ ] Tests template engine : tous les placeholders, fallbacks
- [ ] Tests alimentation : quantités correctes par phase, projection poids
- [ ] Tests edge cases : EC-3.1, EC-3.2, EC-3.5, EC-3.9, EC-3.11
- [ ] Non-régression : tous les tests Sprint 13+14 passent
- [ ] `npx vitest run` — tous les tests passent
- [ ] `npm run build` — Build production OK
- [ ] docs/reviews/review-sprint-15.md produit
- [ ] docs/tests/rapport-sprint-15.md produit

**Fichiers concernes :**
- src/__tests__/activity-engine/ (nouveau dossier)
- docs/reviews/review-sprint-15.md (nouveau)
- docs/tests/rapport-sprint-15.md (nouveau)

---

## Sprint 16 — UX Guidée & Instructions

**Objectif :** Créer l'expérience utilisateur guidée pour les clients pisciculteurs : page "Mes tâches" enrichie avec instructions Markdown, lien activité→relevé, recommandations produit, projections de performance, et notifications.

---

### S16-1 : Page "Mes tâches" enrichie — liste + filtres
**Agent :** @developer
**Priorite :** Haute
**Dependances :** Sprint 15 terminé
**Statut :** FAIT

**Description :**
Enrichir la page "Mes tâches" existante pour afficher les activités auto-générées avec priorité visuelle (couleur par priorité), badge phase de croissance, indicateur auto-généré vs manuelle. Ajouter des filtres par type d'activité, par statut (PLANIFIEE, EN_COURS, TERMINEE), par priorité. Afficher le résumé quotidien en haut ("3 tâches aujourd'hui, 1 urgente"). Mobile first avec cartes empilées.

**Criteres d'acceptation :**
- [ ] Cartes d'activité avec : titre résolu (placeholders), priorité colorée, badge phase, icône type
- [ ] Filtres : type d'activité, statut, priorité
- [ ] Résumé quotidien en haut de page
- [ ] Différenciation visuelle auto-générée vs manuelle
- [ ] Tri par priorité puis par heure
- [ ] Mobile first (360px)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/mes-taches/page.tsx (modifié ou nouveau)
- src/components/activites/activite-card.tsx (nouveau)
- src/components/activites/activite-list-client.tsx (nouveau)

---

### S16-2 : Instructions détaillées en Markdown
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S16-1
**Statut :** FAIT

**Description :**
Afficher les `instructionsDetaillees` (Markdown) dans une vue détaillée quand l'utilisateur clique sur une activité. Utiliser un renderer Markdown léger (react-markdown ou similaire). Les instructions doivent être lisibles sur 360px avec une typographie adaptée. Ajouter une section "Produit recommandé" si `produitRecommandeId` est renseigné, avec la quantité et un lien vers le stock.

**Criteres d'acceptation :**
- [ ] Vue détaillée d'une activité avec Markdown rendu
- [ ] Section "Produit recommandé" avec nom, quantité, stock actuel
- [ ] Typographie lisible sur 360px (taille de police, espacement)
- [ ] Bouton "Marquer comme terminé" bien visible
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/mes-taches/[id]/page.tsx (nouveau)
- src/components/activites/instruction-viewer.tsx (nouveau)
- package.json (ajout react-markdown si nécessaire)

---

### S16-3 : Lien Activité → Relevé (complétion via relevé)
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S16-2
**Statut :** FAIT

**Description :**
Quand un utilisateur marque une activité de type BIOMETRIE, QUALITE_EAU, COMPTAGE, MORTALITE, ou ALIMENTATION comme terminée, le guider vers la création d'un relevé du type correspondant. Le relevé créé est automatiquement lié à l'activité via `releveId`. Si l'utilisateur crée un relevé depuis la page relevés, vérifier s'il existe une activité planifiée du même type pour la même vague et la lier automatiquement.

**Criteres d'acceptation :**
- [ ] Bouton "Terminer avec un relevé" sur les activités liées à un type de relevé
- [ ] Pré-remplissage du formulaire de relevé (vagueId, bacId, typeReleve)
- [ ] Lien automatique relevé ↔ activité (mise à jour `releveId` et `statut=TERMINEE`)
- [ ] Lien inverse : création de relevé depuis la page relevés lie l'activité existante
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/components/activites/activite-complete.tsx (nouveau)
- src/components/releves/releve-form-client.tsx (modifié)
- src/app/api/activites/[id]/route.ts (modifié)

---

### S16-4 : Recommandations d'alimentation dynamiques
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S15-9, S16-1
**Statut :** FAIT

**Description :**
Afficher les recommandations d'alimentation calculées sur la carte d'activité alimentation : quantité quotidienne en grammes, taille de granulé, fréquence de distribution, stock restant du produit recommandé, jours de stock estimés. Gérer la conversion KG→grammes pour l'affichage (EC-14.4). Si plusieurs bacs avec des poissons de tailles différentes après un tri, calculer par bac (EC-4.5).

**Criteres d'acceptation :**
- [ ] Quantité quotidienne affichée en grammes sur la carte alimentation
- [ ] Taille de granulé recommandée
- [ ] Fréquence de distribution
- [ ] Stock restant et jours estimés
- [ ] Conversion d'unités pour l'affichage (EC-14.4)
- [ ] Calcul par bac si plusieurs bacs avec tailles différentes (EC-4.5)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/components/activites/feeding-recommendation.tsx (nouveau)
- src/lib/activity-engine/feeding.ts (enrichi)

---

### S16-5 : Projections de performance
**Agent :** @developer
**Priorite :** Moyenne
**Dependances :** S13-6, S16-1
**Statut :** FAIT

**Description :**
Ajouter une section "Projections" au dashboard client : SGR requis vs actuel pour atteindre l'objectif (depuis ConfigElevage.poidsObjectif), date de récolte estimée, aliment total restant nécessaire, revenu attendu estimé. Utiliser les formules de la section 6.8.3 du REQ. Afficher avec des graphiques simples (Recharts).

**Criteres d'acceptation :**
- [ ] SGR requis calculé : `(ln(poidsObjectif) - ln(poidsMoyenActuel)) / joursRestants * 100`
- [ ] Comparaison SGR actuel vs requis (vert si en avance, rouge si en retard)
- [ ] Date de récolte estimée projetée
- [ ] Aliment total restant estimé
- [ ] Revenu attendu estimé (si prix de vente renseigné)
- [ ] Graphique Recharts : courbe de croissance projetée vs réelle
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/components/dashboard/projections.tsx (nouveau)
- src/lib/calculs.ts (enrichi — fonctions de projection)
- src/app/dashboard/page.tsx (modifié)

---

### S16-6 : Alertes graduées par benchmark
**Agent :** @developer
**Priorite :** Moyenne
**Dependances :** S13-5, S16-1
**Statut :** FAIT

**Description :**
Intégrer les alertes graduées par benchmark dans le dashboard et les cartes d'activité. 4 niveaux visuels : EXCELLENT (vert), BON (bleu), ACCEPTABLE (orange), MAUVAIS (rouge). Quand un indicateur passe en MAUVAIS, afficher une notification prominente et lier à l'activité corrective auto-générée.

**Criteres d'acceptation :**
- [ ] 4 niveaux de couleur cohérents (CSS variables du thème — R6)
- [ ] Indicateurs FCR, SGR, Survie, Densité, Mortalité avec badge coloré
- [ ] Notification prominente pour le niveau MAUVAIS
- [ ] Lien vers l'activité corrective quand elle existe
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/components/dashboard/benchmark-badge.tsx (nouveau)
- src/components/dashboard/indicateurs-panel.tsx (modifié)

---

### S16-7 : Route API instructions détaillées + activité completion
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S15-1
**Statut :** FAIT

**Description :**
Implémenter la route GET `/api/activites/[id]/instructions` qui retourne les instructions détaillées résolues (template + placeholders) d'une activité. Implémenter la route PUT `/api/activites/[id]` pour la complétion d'une activité (changement de statut, dateTerminee, noteCompletion, releveId optionnel).

**Criteres d'acceptation :**
- [ ] Route GET `/api/activites/[id]/instructions` retourne le Markdown résolu
- [ ] Route PUT `/api/activites/[id]` gère la complétion
- [ ] Validation : statut ne peut aller que vers l'avant (PLANIFIEE → EN_COURS → TERMINEE)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/api/activites/[id]/route.ts (modifié)
- src/app/api/activites/[id]/instructions/route.ts (nouveau)

---

### S16-8 : Tests + Review Sprint 16
**Agent :** @tester + @code-reviewer
**Priorite :** Haute
**Dependances :** S16-1 à S16-7
**Statut :** FAIT

**Description :**
Tests de l'UX guidée : rendu Markdown, lien activité→relevé, recommandations alimentation, projections, alertes graduées. Tests mobile (360px) manuels documentés. Review checklist R1-R9 avec focus sur mobile-first et DialogTrigger asChild (R5).

**Criteres d'acceptation :**
- [ ] Tests recommandations alimentation : quantités, conversions, multi-bacs
- [ ] Tests projections : SGR, date récolte, formules correctes
- [ ] Tests lien activité ↔ relevé
- [ ] Test rendu Markdown (pas de XSS)
- [ ] Non-régression : tous les tests Sprint 13-15 passent
- [ ] `npx vitest run` — tous les tests passent
- [ ] `npm run build` — Build production OK
- [ ] Test manuel mobile 360px documenté
- [ ] docs/reviews/review-sprint-16.md produit
- [ ] docs/tests/rapport-sprint-16.md produit

**Fichiers concernes :**
- src/__tests__/projections.test.ts (nouveau)
- src/__tests__/feeding.test.ts (nouveau)
- docs/reviews/review-sprint-16.md (nouveau)
- docs/tests/rapport-sprint-16.md (nouveau)

---

## Sprint 17 — Monitoring Ingénieur & Polish

**Objectif :** Créer le tableau de bord ingénieur pour le monitoring à distance des fermes clientes, le système de notes, les observations client, et le polish final de la Phase 3. Review globale et stabilisation.

---

### S17-1 : Modèle Prisma NoteIngenieur + migration
**Agent :** @db-specialist
**Priorite :** Haute
**Dependances :** Sprint 16 terminé
**Statut :** FAIT

**Description :**
Créer le modèle `NoteIngenieur` dans schema.prisma avec les relations correctes : `ingenieurId` FK User, `clientSiteId` FK Site, `siteId` FK Site (R8 — site DKFarm), `vagueId?` FK Vague. Ajouter un champ `visibility` enum (PUBLIC, INTERNE) pour distinguer les notes visibles par le client des notes internes (EC-7.1, EC-12.4).

**Criteres d'acceptation :**
- [ ] Modèle `NoteIngenieur` avec toutes les FK et @relation
- [ ] Champ `visibility` avec valeurs PUBLIC et INTERNE (EC-7.1, EC-12.4)
- [ ] Relation `siteId` = site DKFarm (R8), `clientSiteId` = site du client
- [ ] Migration exécutée sans erreur
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- prisma/schema.prisma
- prisma/migrations/YYYYMMDDHHMMSS_add_note_ingenieur/
- src/types/models.ts
- src/types/api.ts

---

### S17-2 : API Dashboard ingénieur + liste clients
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S17-1
**Statut :** FAIT

**Description :**
Implémenter GET `/api/ingenieur/dashboard` qui retourne les métriques agrégées de tous les clients (nombre de packs actifs, survie moyenne, alertes actives, fermes nécessitant attention). Implémenter GET `/api/ingenieur/clients` avec pagination (EC-7.5) et tri par urgence. Le rôle INGENIEUR a accès en lecture seule aux sites clients (EC-7.3).

**Criteres d'acceptation :**
- [ ] Route GET `/api/ingenieur/dashboard` : métriques agrégées
- [ ] Route GET `/api/ingenieur/clients` : liste paginée (EC-7.5), tri par urgence
- [ ] Permission `MONITORING_CLIENTS` requise
- [ ] INGENIEUR = lecture seule (pas de modification des données client — EC-7.3)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/api/ingenieur/dashboard/route.ts (nouveau)
- src/app/api/ingenieur/clients/route.ts (nouveau)
- src/lib/queries/ingenieur.ts (nouveau)

---

### S17-3 : API Notes ingénieur + endpoint client
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S17-1
**Statut :** FAIT

**Description :**
Implémenter GET/POST `/api/ingenieur/notes` et GET/PUT `/api/ingenieur/notes/[id]` pour l'ingénieur. Implémenter GET `/api/notes` pour le CLIENT : retourne uniquement les notes avec `visibility=PUBLIC` pour son site (adresse F-09). Permission `ENVOYER_NOTES` pour l'ingénieur.

**Criteres d'acceptation :**
- [ ] Routes CRUD notes pour l'ingénieur avec permission `ENVOYER_NOTES`
- [ ] Route GET `/api/notes` pour le client (notes PUBLIC uniquement — F-09)
- [ ] Filtrage par clientSiteId, vagueId, isUrgent
- [ ] Notes INTERNE invisibles pour le client (EC-12.4)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/api/ingenieur/notes/route.ts (nouveau)
- src/app/api/ingenieur/notes/[id]/route.ts (nouveau)
- src/app/api/notes/route.ts (nouveau)
- src/lib/queries/notes.ts (nouveau)

---

### S17-4 : UI Dashboard ingénieur
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S17-2
**Statut :** FAIT

**Description :**
Créer la page `/ingenieur` avec le tableau de bord multi-clients. Afficher : alertes actives en haut, liste des clients avec cartes (nom, pack, jour, survie, FCR, dernière activité), stats globales en bas. Codes couleur : rouge=critique, orange=attention, vert=OK. Cliquer sur un client → page détaillée `/ingenieur/[siteId]`.

**Criteres d'acceptation :**
- [ ] Section alertes actives en haut (triées par sévérité)
- [ ] Cartes clients avec métriques clés et couleurs
- [ ] Badge "inactif" si aucune activité depuis 3 jours (EC-7.4 — ignorer weekends)
- [ ] Stats globales : packs actifs, survie moyenne, fermes en alerte
- [ ] Page détaillée client avec graphiques (croissance, mortalité, FCR)
- [ ] Mobile first (360px)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/ingenieur/page.tsx (nouveau)
- src/app/ingenieur/[siteId]/page.tsx (nouveau)
- src/components/ingenieur/ (nouveau dossier)

---

### S17-5 : UI Notes ingénieur + vue client
**Agent :** @developer
**Priorite :** Moyenne
**Dependances :** S17-3
**Statut :** FAIT

**Description :**
Ajouter un formulaire d'envoi de note sur la page détaillée ingénieur (`/ingenieur/[siteId]`). Afficher l'historique des notes envoyées. Côté client, afficher les notes reçues dans une section dédiée du dashboard ou une page `/notes`. Badge notification pour les notes non lues. Badge "Urgent" pour les notes marquées urgentes.

**Criteres d'acceptation :**
- [ ] Formulaire note : titre, contenu (Markdown), vagueId optionnel, isUrgent, visibility (PUBLIC/INTERNE)
- [ ] Historique des notes sur la page ingénieur/[siteId]
- [ ] Page `/notes` côté client (notes PUBLIC uniquement)
- [ ] Badge notification pour notes non lues
- [ ] Mobile first (360px)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/app/ingenieur/[siteId]/page.tsx (modifié)
- src/app/notes/page.tsx (nouveau)
- src/components/notes/ (nouveau dossier)

---

### S17-6 : Alertes automatiques vers l'ingénieur
**Agent :** @developer
**Priorite :** Moyenne
**Dependances :** S17-2, S15-5
**Statut :** FAIT

**Description :**
Implémenter les alertes automatiques vers l'ingénieur quand les seuils critiques sont atteints chez un client : survie < 80%, FCR > 2.2, inactivité > 3 jours ouvrés (EC-7.4 — exclure weekends/jours fériés), stock aliment < 5 jours. Les alertes sont créées dans le modèle Notification existant avec un type dédié. Hook dans le moteur d'activités et dans la complétion de relevé.

**Criteres d'acceptation :**
- [ ] Alerte créée quand survie < seuil (configurable via ConfigElevage)
- [ ] Alerte créée quand FCR > seuil
- [ ] Alerte inactivité : 3 jours OUVRES sans activité (EC-7.4)
- [ ] Alerte stock bas
- [ ] Notifications visibles dans le dashboard ingénieur
- [ ] Pas de doublons (1 alerte par type par jour par client)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/lib/activity-engine/engineer-alerts.ts (nouveau)
- src/app/api/activites/generer/route.ts (modifié — hook alertes)

---

### S17-7 : Polish — Navigation Phase 3 + lifecycle PackActivation
**Agent :** @developer
**Priorite :** Moyenne
**Dependances :** S17-4
**Statut :** FAIT

**Description :**
Mettre à jour la navigation (bottom-nav, sidebar) pour intégrer les nouvelles pages Phase 3 : Packs, Activations, Ingénieur, Notes, Config Élevage. Conditionner la visibilité par rôle. Implémenter le lifecycle de PackActivation : quand une vague liée est TERMINEE → PackActivation passe en EXPIREE (EC-10.4, EC-14.5). Archiver les activités terminées de plus de 90 jours (EC-10.1).

**Criteres d'acceptation :**
- [ ] Bottom-nav mis à jour avec items conditionnels par rôle
- [ ] Sidebar mis à jour avec sous-sections Phase 3
- [ ] PackActivation TERMINEE quand vague termine (EC-10.4)
- [ ] PackActivation SUSPENDUE si vague ANNULEE (EC-14.5)
- [ ] Archivage activités > 90 jours (soft delete ou flag — EC-10.1)
- [ ] Tests passent
- [ ] Build OK

**Fichiers concernes :**
- src/components/layout/bottom-nav.tsx (modifié)
- src/components/layout/sidebar.tsx (modifié)
- src/lib/queries/lifecycle.ts (nouveau)

---

### S17-8 : Observations client (communication bidirectionnelle)
**Agent :** @developer
**Priorite :** Haute
**Dependances :** S17-1
**Statut :** FAIT

**Description :**
Permettre aux clients (PISCICULTEUR) d'envoyer des observations textuelles à l'ingénieur DKFarm depuis l'app. L'ingénieur peut répondre via une NoteIngenieur liée. Enrichir NoteIngenieur avec `isFromClient Boolean @default(false)` et `observationTexte String?`.

**Criteres d'acceptation :**
- [ ] Champs `isFromClient` et `observationTexte` ajoutés à NoteIngenieur
- [ ] API `POST /api/mes-observations` — client envoie une observation
- [ ] API `GET /api/mes-observations` — client voit ses observations + réponses
- [ ] UI mobile: bouton "Signaler un problème" sur /mes-taches
- [ ] UI formulaire: texte libre + sélection type (mortalité, eau, comportement, autre)
- [ ] Notification ingénieur quand nouvelle observation reçue
- [ ] Tests unitaires API
- [ ] Build OK

**Fichiers concernes :**
- prisma/schema.prisma
- src/app/api/mes-observations/route.ts
- src/components/observations/observation-form.tsx
- src/app/(dashboard)/mes-taches/page.tsx

---

### S17-9 : Tests finaux + Review Sprint 17 + Review Phase 3
**Agent :** @tester + @code-reviewer
**Priorite :** Haute
**Dependances :** S17-1 à S17-8
**Statut :** FAIT

**Description :**
Tests finaux couvrant l'ensemble de la Phase 3. Tests d'intégration du flow complet : création pack → activation → génération d'activités → complétion avec relevés → monitoring ingénieur → notes. Review globale Phase 3 : checklist R1-R9, sécurité (permissions Phase 3), accessibilité, mobile-first. Vérification de tous les findings et edge cases adressés.

**Criteres d'acceptation :**
- [ ] Test E2E du flow complet (pack → activation → activités → relevé → monitoring ingénieur → notes)
- [ ] Tests dashboard ingénieur : pagination, tri, métriques
- [ ] Tests alertes ingénieur : seuils, jours ouvrés, dédup
- [ ] Tests notes : visibilité PUBLIC/INTERNE, permissions
- [ ] Tests lifecycle : PackActivation TERMINEE/SUSPENDUE
- [ ] Vérification de tous les findings Blocker et High résolus
- [ ] Non-régression complète : tous les tests Phase 1+2+3 passent
- [ ] `npx vitest run` — tous les tests passent
- [ ] `npm run build` — Build production OK
- [ ] Test manuel mobile 360px + desktop documenté
- [ ] docs/reviews/review-sprint-17.md produit
- [ ] docs/reviews/review-phase-3.md produit (review globale)
- [ ] docs/tests/rapport-sprint-17.md produit
- [ ] docs/tests/rapport-phase-3.md produit (rapport global)

**Fichiers concernes :**
- src/__tests__/ingenieur/ (nouveau dossier)
- src/__tests__/notes/ (nouveau dossier)
- src/__tests__/e2e/ (nouveau dossier)
- docs/reviews/review-sprint-17.md (nouveau)
- docs/reviews/review-phase-3.md (nouveau)
- docs/tests/rapport-sprint-17.md (nouveau)
- docs/tests/rapport-phase-3.md (nouveau)

---

## Annexe A — Matrice des Findings adressés

| Finding | Sévérité | Sprint | Story | Résolution |
|---------|----------|--------|-------|------------|
| F-01 | BLOCKER | 15 | S15-1 | `produitRecommandeId` FK avec @relation, conflit recurrence résolu |
| F-02 | HIGH | 14 | S14-1 | TypeActivite + TRI, MEDICATION |
| F-03 | BLOCKER | 14 | S14-3, S14-4 | Champ `isSystem` sur User, system user par site |
| F-04 | HIGH | 14 | S14-2 | siteId = DKFarm, clientSiteId = client (clarifié) |
| F-05 | HIGH | 14 | S14-2 | @unique retiré sur clientSiteId |
| F-06 | HIGH | 14 | S14-2 | @unique retiré sur vagueId |
| F-07 | HIGH | 14 | S14-2 | configElevageId ajouté sur Vague ET Pack |
| F-08 | HIGH | 13 | S13-2 | Schemas Zod pour validation JSON |
| F-09 | MEDIUM-HIGH | 17 | S17-3 | Route GET /api/notes pour le client |
| F-10 | MEDIUM-HIGH | 14 | S14-1 | Rôle INGENIEUR + 7 nouvelles permissions |
| F-11 | MEDIUM-HIGH | 15 | S15-5, S15-6 | Dédup + idempotence CRON |
| F-12 | MEDIUM | — | — | *Différé Phase 4 (IA)* |
| F-13 | MEDIUM | — | — | *Différé Phase 4 (IA)* |
| F-14 | MEDIUM | 14 | S14-6 | Copie des Produit vers le site client |
| F-15 | MEDIUM | 15 | S15-1, S15-8 | siteId nullable sur RegleActivite (null = global) |
| F-16 | LOW-MEDIUM | 15 | S15-3 | Timezone UTC+1 défini pour calculs jours |
| F-19 | LOW-MEDIUM | 15 | S15-2, S15-4 | Liste exhaustive des placeholders + fallback |
| F-22 | LOW | 13 | S13-1 | Index unique partiel sur isDefault per site |

## Annexe B — Matrice des Edge Cases critiques adressés

| Edge Case | Sprint | Story | Résolution |
|-----------|--------|-------|------------|
| EC-1.1 | 14 | S14-5 | Validation nombreAlevins > 0 |
| EC-1.3 | 14 | S14-5 | Validation quantité PackProduit > 0 |
| EC-1.5 | 14 | S14-5 | Empêcher désactivation si activations actives |
| EC-1.6 | 14 | S14-2 | onDelete: Restrict sur PackProduit→Produit |
| EC-2.1 | 14 | S14-6 | Empêcher double-activation même pack/user |
| EC-2.3 | 14 | S14-6 | Transaction Prisma atomique |
| EC-2.4 | 14 | S14-2 | Bac.volume nullable |
| EC-2.5 | 14 | S14-6 | Gestion overflow code ACT-YYYY-NNN |
| EC-3.1 | 15 | S15-5 | Déduplication CRON double-run |
| EC-3.2 | 15 | S15-1, S15-5 | Flag firedOnce sur RegleActivite |
| EC-3.3 | 15 | S15-5 | Priorité : règle plus urgente gagne |
| EC-3.5 | 15 | S15-3 | Validation phaseMin <= phaseMax |
| EC-3.9 | 15 | S15-3 | Skip vague avec 0 vivants |
| EC-3.10 | 14 | S14-1 | TypeActivite + TRI, MEDICATION |
| EC-3.11 | 15 | S15-5 | Opérations atomiques concurrent |
| EC-4.1 | 15 | S15-9 | nombreVivants dérivé des relevés |
| EC-4.2 | 15 | S15-9 | Projection poids moyen via SGR |
| EC-5.1 | 13 | S13-4, S13-5, S13-6 | Fallback vers valeurs hardcodées |
| EC-5.2 | 13 | S13-1 | Index unique partiel isDefault per site |
| EC-5.3 | 13 | S13-2 | Schemas Zod pour JSON |
| EC-5.6 | 13 | S13-2 | Validation inversions benchmarks |
| EC-5.7 | 13 | S13-2 | Validation seuils monotoniques |
| EC-6.1 | — | — | *Différé Phase 4 (IA)* |
| EC-6.2 | — | — | *Différé Phase 4 (IA)* |
| EC-6.3 | — | — | *Différé Phase 4 (IA)* |
| EC-7.1 | 17 | S17-1 | Champ visibility PUBLIC/INTERNE |
| EC-7.3 | 17 | S17-2 | INGENIEUR = lecture seule |
| EC-7.4 | 17 | S17-6 | Inactivité = jours ouvrés |
| EC-7.5 | 17 | S17-2 | Pagination dashboard ingénieur |
| EC-10.1 | 17 | S17-7 | Archivage activités > 90 jours |
| EC-10.4 | 17 | S17-7 | Lifecycle PackActivation → TERMINEE/SUSPENDUE |
| EC-11.1 | 15 | S15-3 | Timezone UTC+1 pour calculs jours |
| EC-12.1 | 14 | S14-1 | 7 nouvelles permissions |
| EC-12.2 | 13 | S13-4 | PISCICULTEUR = lecture seule sur ConfigElevage |
| EC-12.3 | — | — | *Différé Phase 4 (IA)* |
| EC-12.4 | 17 | S17-1 | Champ visibility sur NoteIngenieur |
| EC-14.4 | 13 | S13-6 | Fonction convertirUniteStock() |
| EC-14.5 | 17 | S17-7 | Vague ANNULEE → PackActivation SUSPENDUE |

---

## Phase 4 — Différée

Les fonctionnalités suivantes, initialement prévues dans la Phase 3, ont été reportées à la Phase 4 :

| Sprint | Focus | Contenu |
|--------|-------|---------|
| **Sprint 18+** | Intelligence Artificielle | Modèle ConseilIA, enum TypeConseil, intégration Claude API (Anthropic SDK), assembleur de contexte IA, rate limiting par site (aiQuota sur Pack), fallback UX, interface chat `/conseil`, auto-diagnostic post-relevé, rapport hebdomadaire IA, seed + configuration IA |

**Findings et Edge Cases différés :**
- F-12 : Champ aiQuota sur Pack (rate limiting par tier)
- F-13 : Relations complètes sur ConseilIA (@relation)
- EC-6.1 à EC-6.7 : Fallback UX, reset rate limit, filtre sécurité, anonymisation, payload limité
- EC-10.2 : Archivage des conseils IA
- EC-12.3 : Anonymisation des données envoyées à l'IA
