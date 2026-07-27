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

## Phase 2 — Règles obligatoires (R1-R11)

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
| R10 | **Tout correctif de données est une migration** | Jamais un `.sql` à la racine de `prisma/migrations/`, jamais appliqué à la main en prod |
| R11 | **Aucun secret en dur dans le dépôt** | Toute URL de connexion, clé API, token ou mot de passe vient de `process.env.<VAR>` — jamais écrit en dur, dans **aucun fichier du dépôt, quel qu'il soit**, y compris la configuration d'outillage/IDE/agent (`.claude/`, `.vscode/`, `.idea/`, `*.local.*`) |

### R10 — Détail

- **Interdit** : un `.sql` de correctif à la racine de `prisma/migrations/` (Prisma ne lit que les sous-dossiers contenant un `migration.sql` — un fichier à la racine est inerte, jamais exécuté par `migrate deploy`). Interdit aussi : appliquer un correctif à la main sur la production (aucune trace, aucune garantie de rejeu).
- **Correctif de données** (UPDATE/DELETE/INSERT de rattrapage) = `prisma/migrations/<timestamp>_<nom>/migration.sql`, idempotent (valeur cible, jamais un delta relatif) et no-op silencieux si les lignes visées sont absentes.
- **Audit en lecture seule** (zéro écriture) = script dans `scripts/audits/`, nommé `*-audit-*`.
- **Garde-fou de précondition** (doit bloquer la migration si les données ne satisfont pas une contrainte) = dans la migration elle-même, jamais dans un script préalable qu'un humain doit penser à lancer.
- Détail complet, taxonomie et exemples : [ADR-049](docs/decisions/ADR-049-correctifs-donnees-migrations.md), [ADR-050](docs/decisions/ADR-050-sort-des-scripts-audit.md).

### R11 — Détail

- **Origine du besoin** : un secret réel (URL Postgres de production avec mot de passe en clair) a été committé dans `scripts/data-fixes/gd3-apply.sh` puis supprimé du working tree — le secret reste dans l'historique git, invalidable uniquement par rotation (voir `docs/security/REMEDIATION-SECRET-HISTORIQUE.md`). La cause racine méthodologique : un script écrit avec son URL de connexion en dur, plutôt que lue depuis l'environnement.
- **Ce besoin a en principe disparu depuis R10** : tout correctif de données passe désormais par `prisma migrate deploy`, qui lit `DATABASE_URL` depuis l'environnement (`prisma.config.ts`) — plus aucun script de correctif n'a de raison d'exister, donc plus aucun script de ce type n'a de raison de porter une URL en dur. Les scripts d'audit en lecture seule restants (`scripts/audits/*.ts`, catégorie légitime selon R10/ADR-049 §3.1) lisent déjà tous `process.env.DATABASE_URL` — la discipline est déjà respectée dans le code actuel du dépôt ; R11 la rend explicite et vérifiable pour tout ce qui sera écrit après ce sprint.
- **Périmètre exhaustif par principe, pas par énumération** : R11 s'applique à **tout fichier du dépôt, sans exception de nature ni d'extension** — code applicatif, script, migration, test, documentation, **et configuration d'outillage, d'IDE ou d'agent** (`.claude/`, `.vscode/`, `.idea/`, tout fichier `*.local.*`). Une liste fermée de catégories est précisément ce qui a créé la faille de lecture initiale (une énumération invite à conclure, par contraste, que ce qui n'y figure pas est hors périmètre) : le critère est « ce fichier est-il tracké par git dans ce dépôt ? », jamais « ce fichier appartient-il à une catégorie déjà citée ? ». Le mécanisme technique (scanner gitleaks, section CI ci-dessous) n'a lui-même aucune restriction d'extension ; c'est la formulation de la règle qui doit désormais refléter cette même absence de restriction.
- **Configuration locale vs configuration partagée — la distinction qui tranche** :
  - **Configuration locale** (spécifique à une machine ou un agent, ex. `.claude/settings.local.json`, `.env`, tout fichier `*.local.*`) : ne doit **jamais être trackée** par git — elle va dans `.gitignore`. Si un tel fichier existe déjà dans l'index, il doit en être retiré (`git rm --cached`) et ajouté à `.gitignore`, indépendamment de la question de savoir s'il contient un secret au moment de la vérification — le risque est qu'il en contienne un plus tard, sans que personne ne pense à revérifier avant de committer.
  - **Configuration partagée et légitimement versionnée** (ex. `.claude/settings.json`, `.vscode/settings.json` non-`.local`, `.gitleaks.toml`, `docker-compose.yml`) : peut être trackée, mais ne doit **jamais** contenir d'identifiant réel — elle lit l'environnement (`process.env.<VAR>` côté Node, ou l'équivalent de l'outil) ou pointe vers un fichier `.env` non tracké, exactement comme le reste du dépôt.
  - Un agent ou un humain qui hésite applique donc la question dans l'ordre : (1) ce fichier est-il local à une machine/un agent, ou partagé par toute l'équipe ? Si local → non tracké, point final, la question du contenu ne se pose même pas. (2) S'il est partagé et tracké → aucun identifiant réel dedans, jamais.
- **Exemple vécu qui a motivé cet élargissement** : `.claude/settings.local.json`, tracké par git **depuis le commit initial du dépôt**, contenait un identifiant de production — découvert pendant le sprint CI, en dehors de toute catégorie listée dans la version précédente de R11 (script, migration, test, doc). Le scanner gitleaks l'a correctement détecté (il n'a aucune restriction d'extension), ce qui confirme que la lacune était dans la formulation de la règle, pas dans l'outillage. Aucune valeur de cet identifiant n'est reproduite ici ; voir `docs/security/REMEDIATION-SECRET-HISTORIQUE.md` pour la remédiation.
- **Ce qu'il faut faire à la place** : lire l'identifiant depuis `process.env.<VAR>` (jamais une valeur littérale) ; le stocker localement dans un `.env` (ou équivalent `*.local.*`) **non tracké** par git ; documenter les variables attendues dans un `.env.example` **tracké**, avec des valeurs placeholder explicites (`"your-api-key"`, `"change-me-in-production"`), jamais des valeurs qui ressemblent à de vrais identifiants.
- **Exemple de motif interdit, illustré uniquement avec un identifiant factice** : `postgres://user:motdepasse@hote:5432/base` écrit en dur dans un fichier `.sh`, `.ts`, `.sql`, un fichier de configuration d'outillage (`.json`, `.toml`, `.yml`), ou toute documentation — quels que soient l'extension et le rôle du fichier.
- **Mécanisme de vérification** : un scanner de secrets (gitleaks) tourne en CI sur chaque `push`/`pull_request` et bloque le pipeline s'il détecte un motif de ce type dans le dépôt, sans restriction d'extension ni de type de fichier — R11 n'a de valeur qu'accompagnée de ce mécanisme d'application automatique, pas comme seule discipline documentaire (cf. ADR-052, section 5.3, pour la configuration exacte du scanner).
- Détail complet du sprint qui introduit R11 et son outillage : [ADR-052](docs/decisions/ADR-052-ci-anti-invisibilite-tests-db-gated.md) (section 5.3 pour le scanner de secrets ; le mécanisme lui-même, pas la règle R11, qui est définie ici).

## Phase 2 — Descriptions des agents

| Agent | Rôle Phase 2 |
|-------|--------------|
| @project-manager | Coordonne les Sprints 6-12, gère le backlog, pilote le triage des bugs, vérifie les dépendances |
| @architect | Architecture multi-tenancy, authentification, navigation, export PDF/Excel, ADR, interfaces TypeScript |
| @db-specialist | 19 nouveaux modèles Prisma, 16 enums, migrations, queries, transactions critiques, agrégation financière |
| @developer | ~50 API routes, ~30 pages UI, mobile-first, formulaires multi-étapes, graphiques Recharts |
| @tester | Tests unitaires, API, UI, non-régression, vérification build, rapports dans docs/tests/ |
| @code-reviewer | Review par sprint selon checklist R1-R11, auth/permissions, accessibilité, mobile-first |

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

> Si le fix implique de corriger des données déjà en production (pas seulement du code), voir R10 : le correctif est une migration Prisma versionnée, jamais un script exécuté à la main.

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
6. Checklist review (R1-R11 respectées)
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
