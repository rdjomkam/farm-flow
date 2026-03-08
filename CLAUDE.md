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
Voir prisma/schema.prisma — 3 modèles : Bac, Vague, Releve

## Processus de travail — Sprints et Stories
Le projet est organisé en **5 sprints**. Chaque sprint contient des **stories** assignées à un agent.

### Règles du processus
1. Le backlog complet est dans **docs/TASKS.md**
2. @project-manager pilote les sprints et met à jour les statuts
3. Un agent ne commence une story que si ses dépendances sont marquées FAIT
4. Quand un agent termine une tâche, il met à jour son statut dans docs/TASKS.md (TODO → EN COURS → FAIT)
5. Quand toutes les stories d'un sprint sont FAIT, @code-reviewer fait la review
6. On ne passe au sprint suivant que quand la review est validée
7. Les agents communiquent via les fichiers partagés (docs/decisions/, docs/reviews/, docs/tests/)

### Sprints
- **Sprint 1** : Fondations (DB + Types + Structure) → @db-specialist + @architect
- **Sprint 2** : API Routes et logique métier → @developer + @db-specialist + @tester
- **Sprint 3** : UI Layout + Dashboard → @developer
- **Sprint 4** : UI Pages métier (Vagues, Relevés, Bacs) → @developer + @tester
- **Sprint 5** : Polissage et livraison → tous

## Communication entre agents
- Le backlog est dans docs/TASKS.md (source de vérité pour les tâches)
- Les décisions architecturales vont dans docs/decisions/
- Les rapports de code review vont dans docs/reviews/
- Les rapports de test vont dans docs/tests/
- Chaque agent lit docs/TASKS.md au début de son travail pour connaître ses tâches
