# Projet : Suivi du Grossissement de Silures

## Contexte métier
Application de suivi piscicole pour l'élevage de silures (Clarias gariepinus) au Cameroun.
Les pisciculteurs gèrent des **vagues** (lots de poissons) réparties dans des **bacs**.
Ils effectuent des **relevés** de différents types (biométrie, mortalité, alimentation, qualité eau, comptage, observation) à des fréquences différentes.

## Règles métier clés
- Un bac ne peut être assigné qu'à UNE SEULE vague à la fois (vagueId nullable sur Bac)
- Une vague peut avoir PLUSIEURS bacs
- Chaque relevé a un TYPE obligatoire qui détermine les champs à remplir
- Les types de relevé : biometrie, mortalite, alimentation, qualite_eau, comptage, observation
- Indicateurs calculés : taux de survie, FCR, SGR, biomasse totale

## Stack technique
- Next.js 14+ (App Router) avec TypeScript
- Prisma + PostgreSQL (Docker en dev, Prisma Postgres prisma.io en prod)
- Tailwind CSS + Radix UI (composants headless)
- Recharts pour les graphiques
- Approche MOBILE FIRST (360px d'abord, puis desktop)

## Base de données
- **Dev/Test** : PostgreSQL 16 via Docker (`docker compose up -d`)
- **Prod** : Prisma Postgres (prisma.io) — base managée avec connection pooling
- Le datasource dans schema.prisma utilise `provider = "postgresql"`
- L'URL de connexion est dans .env (DATABASE_URL)
- En prod, utiliser Prisma Accelerate si nécessaire pour le caching

## Conventions de code
- Langue du code : anglais (noms de variables, fonctions, composants)
- Langue de l'UI : français (labels, textes affichés)
- Composants dans src/components/
- API routes dans src/app/api/
- Types partagés dans src/types/
- Utilitaires dans src/lib/
- Toujours utiliser les Server Components par défaut, "use client" uniquement si nécessaire
- Formulaires : champs larges, gros boutons, mobile first
- Pas de tableaux sur mobile : cartes empilées à la place

## Schéma de la base de données
Voir prisma/schema.prisma — Phase 1 : 3 modèles (Bac, Vague, Releve), Phase 2 : +19 modèles, +16 enums

## Processus de travail — Sprints et Stories
Le projet est organisé en **12 sprints** (Phase 1 : 1-5, Phase 2 : 6-12). Chaque sprint contient des **stories** assignées à un agent.

### Règles du processus
1. Le backlog complet est dans **docs/TASKS.md**
2. @project-manager pilote les sprints et met à jour les statuts
3. Un agent ne commence une story que si ses dépendances sont marquées FAIT
4. Quand un agent termine une tâche, il met à jour son statut dans docs/TASKS.md (TODO → EN COURS → FAIT)
5. Quand toutes les stories d'un sprint sont FAIT, @code-reviewer fait la review
6. On ne passe au sprint suivant que quand la review est validée
7. Les agents communiquent via les fichiers partagés (docs/decisions/, docs/reviews/, docs/tests/)

### Sprints Phase 1 (TERMINÉE)
- **Sprint 1** : Fondations (DB + Types + Structure) → @db-specialist + @architect ✅
- **Sprint 2** : API Routes et logique métier → @developer + @db-specialist + @tester ✅
- **Sprint 3** : UI Layout + Dashboard → @developer ✅
- **Sprint 4** : UI Pages métier (Vagues, Relevés, Bacs) → @developer + @tester ✅
- **Sprint 5** : Polissage et livraison → tous ✅

### Sprints Phase 2
- **Sprint 6** : Authentification → @architect + @db-specialist + @developer + @tester
- **Sprint 7** : Multi-tenancy → @architect + @db-specialist + @developer + @tester
- **Sprint 8** : Stock & Approvisionnement → @db-specialist + @architect + @developer + @tester
- **Sprint 9** : Ventes & Facturation → @db-specialist + @architect + @developer + @tester
- **Sprint 10** : Production Alevins → @db-specialist + @architect + @developer + @tester
- **Sprint 11** : Alertes + Planning + Dashboard financier → @db-specialist + @developer + @tester
- **Sprint 12** : Export PDF/Excel + Polish + Navigation → @architect + @developer + @tester

## Communication entre agents
- Le backlog est dans docs/TASKS.md (source de vérité pour les tâches)
- Les décisions architecturales vont dans docs/decisions/
- Les rapports de code review vont dans docs/reviews/
- Les rapports de test vont dans docs/tests/
- Les rapports de bugs vont dans docs/bugs/
- Chaque agent lit docs/TASKS.md au début de son travail pour connaître ses tâches

---

## Phase 2 — Règles obligatoires (R1-R9)

Ces règles sont issues des leçons de la Phase 1 et sont **obligatoires** pour tous les agents.

| # | Règle | Détail |
|---|-------|--------|
| R1 | **Enums MAJUSCULES dès le départ** | Toutes les valeurs d'enum en UPPERCASE |
| R2 | **Toujours importer les enums** | `import { StatutVague } from "@/types"` puis `StatutVague.TERMINEE`, jamais `"TERMINEE"` |
| R3 | **Prisma = TypeScript identiques** | Noms de champs et types strictement alignés |
| R4 | **Opérations atomiques** | Utiliser `updateMany` avec conditions, pas check-then-update |
| R5 | **DialogTrigger asChild** | Toujours wrapper les boutons trigger avec `<DialogTrigger asChild>` pour ARIA |
| R6 | **CSS variables du thème** | `var(--primary)` pas `#0d9488` en dur |
| R7 | **Nullabilité explicite** | Décider required/nullable dès le schéma, pas après |
| R8 | **siteId PARTOUT** | Chaque nouveau modèle DOIT avoir un `siteId` (FK Site) |
| R9 | **Tests avant review** | Toujours exécuter `npx vitest run` + `npm run build` avant chaque review |

## Phase 2 — Descriptions des agents

| Agent | Rôle Phase 2 |
|-------|--------------|
| @project-manager | Coordonne les Sprints 6-12, gère le backlog, pilote le triage des bugs, vérifie les dépendances |
| @architect | Architecture multi-tenancy, authentification, navigation, export PDF/Excel, ADR, interfaces TypeScript |
| @db-specialist | 19 nouveaux modèles Prisma, 16 enums, migrations, queries, transactions critiques, agrégation financière |
| @developer | ~50 API routes, ~30 pages UI, mobile-first, formulaires multi-étapes, graphiques Recharts |
| @tester | Tests unitaires, API, UI, non-régression, vérification build, rapports dans docs/tests/ |
| @code-reviewer | Review par sprint selon checklist R1-R9, auth/permissions, accessibilité, mobile-first |

## Phase 2 — Processus de bugfixing

### Flux
```
Détection → Rapport → Triage → Assignation → Fix → Test → Vérification → Clôture
```

### Rôles
| Étape | Responsable | Action |
|-------|------------|--------|
| **Détection** | Tout agent | Crée un fichier `docs/bugs/BUG-XXX.md` avec le template |
| **Triage** | @project-manager | Assigne une sévérité (Critique/Haute/Moyenne/Basse) et un agent |
| **Fix** | Agent assigné | Corrige le bug + écrit un test de non-régression |
| **Vérification** | @tester | Vérifie le fix + exécute la suite de tests complète |
| **Review** | @code-reviewer | Review obligatoire si sévérité Critique ou Haute |
| **Clôture** | @project-manager | Met à jour le fichier bug et TASKS.md |

### Template bug (`docs/bugs/BUG-XXX.md`)
```markdown
# BUG-XXX — [Titre court]
**Sévérité :** Critique | Haute | Moyenne | Basse
**Détecté par :** @agent-name
**Sprint :** X
**Fichier(s) :** src/...

## Description
[Ce qui se passe vs ce qui devrait se passer]

## Étapes de reproduction
1. ...

## Cause racine
[Analyse après investigation]

## Fix
- [ ] Fichier(s) modifié(s)
- [ ] Test de non-régression ajouté
- [ ] Tous les tests passent
- [ ] Build OK

## Statut : OUVERT | EN COURS | CORRIGÉ | VÉRIFIÉ | CLOS
```

### Règles de priorisation
- **Critique** : Bloque un sprint ou casse le build → fix immédiat
- **Haute** : Fonctionnalité incorrecte → fix dans le sprint courant
- **Moyenne** : UX dégradée, cas limite → fix reportable au sprint suivant
- **Basse** : Cosmétique → file de polissage (Sprint 12)

## Phase 2 — Vérification par sprint

Pour chaque sprint, vérifier :
1. `npx prisma migrate dev` — Migration sans erreur
2. `npm run db:seed` — Seed avec nouvelles données
3. `npx vitest run` — Tous les tests passent (anciens + nouveaux)
4. `npm run build` — Build production OK
5. Test manuel mobile (360px) + desktop
6. Checklist review (R1-R9 respectées)
7. `docs/reviews/review-sprint-X.md` produit

## Phase 2 — Fichiers critiques

| Fichier | Sprints | Raison |
|---------|---------|--------|
| `prisma/schema.prisma` | 6-11 | +19 modèles, +16 enums |
| `prisma/seed.sql` | 6-11 | Données de test pour chaque sprint |
| `src/types/models.ts` | 6-11 | Interfaces TypeScript miroirs |
| `src/types/index.ts` | 6-11 | Barrel export |
| `src/lib/queries/*.ts` | 7+ | Ajouter filtre siteId partout |
| `src/app/api/*/route.ts` | 6-7 | auth (6) + siteId (7) |
| `src/components/layout/bottom-nav.tsx` | 12 | Réorganisation 5 items groupés |
| `src/components/layout/sidebar.tsx` | 12 | Groupes et sous-sections |
| `src/app/layout.tsx` | 6, 11 | user-menu (6), notification-bell (11) |

## Phase 2 — Patterns existants à réutiliser

| Pattern | Fichier référence | Usage Phase 2 |
|---------|-------------------|---------------|
| Queries CRUD | `src/lib/queries/vagues.ts` | Tous les nouveaux modèles |
| API routes validation | `src/app/api/vagues/route.ts` | Toutes les nouvelles routes |
| Liste filtrée + Tabs | `src/components/vagues/vagues-list-client.tsx` | Listes stock, ventes, alevins |
| Formulaire multi-étapes | `src/components/releves/releve-form-client.tsx` | Formulaire vente, ponte, commande |
| Composants UI Radix | `src/components/ui/*.tsx` | Partout |
| Fonctions pures | `src/lib/calculs.ts` | Calculs financiers, alertes |
