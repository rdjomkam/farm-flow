# ADR 001 — Structure du projet

**Date :** 2026-03-08
**Statut :** Acceptee
**Auteur :** @architect

## Contexte

Le projet Suivi Silures est une application Next.js (App Router) pour le suivi piscicole. Il faut definir une arborescence claire, maintenable et adaptee a une equipe de plusieurs agents.

## Decision

Arborescence retenue :

```
farm-flow/
├── prisma/
│   ├── schema.prisma          # Schema de la base de donnees
│   ├── migrations/            # Migrations Prisma
│   └── seed.sql                # Donnees de seed (SQL direct)
├── src/
│   ├── app/                   # App Router Next.js
│   │   ├── layout.tsx         # Layout racine (Server Component)
│   │   ├── page.tsx           # Dashboard (page d'accueil)
│   │   ├── globals.css        # Styles globaux Tailwind
│   │   ├── api/               # API Routes
│   │   │   ├── bacs/
│   │   │   │   └── route.ts   # GET (lister) + POST (creer)
│   │   │   ├── vagues/
│   │   │   │   ├── route.ts   # GET (lister) + POST (creer)
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts # GET (detail) + PUT (modifier/cloturer)
│   │   │   └── releves/
│   │   │       └── route.ts   # GET (filtrer) + POST (creer)
│   │   ├── vagues/
│   │   │   ├── page.tsx       # Liste des vagues
│   │   │   └── [id]/
│   │   │       └── page.tsx   # Detail d'une vague
│   │   ├── bacs/
│   │   │   └── page.tsx       # Gestion des bacs
│   │   └── releves/
│   │       └── nouveau/
│   │           └── page.tsx   # Formulaire de saisie de releve
│   ├── components/
│   │   ├── ui/                # Composants UI generiques (Radix UI + Tailwind)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── input.tsx
│   │   │   └── badge.tsx
│   │   ├── layout/            # Layout et navigation
│   │   │   ├── bottom-nav.tsx # Navigation mobile (bottom bar)
│   │   │   └── header.tsx     # Header avec titre + actions
│   │   ├── dashboard/         # Composants du dashboard
│   │   │   ├── stats-cards.tsx
│   │   │   └── vague-summary-card.tsx
│   │   ├── vagues/            # Composants lies aux vagues
│   │   │   ├── vague-card.tsx
│   │   │   ├── vague-form.tsx
│   │   │   └── indicateurs-cards.tsx
│   │   └── releves/           # Composants lies aux releves
│   │       ├── form-biometrie.tsx
│   │       ├── form-mortalite.tsx
│   │       ├── form-alimentation.tsx
│   │       ├── form-qualite-eau.tsx
│   │       ├── form-comptage.tsx
│   │       └── form-observation.tsx
│   ├── lib/                   # Utilitaires et logique metier
│   │   ├── db.ts              # Singleton Prisma
│   │   ├── calculs.ts         # Fonctions de calcul des indicateurs
│   │   └── queries/           # Fonctions de requete Prisma
│   │       ├── bacs.ts
│   │       ├── vagues.ts
│   │       ├── releves.ts
│   │       └── indicateurs.ts
│   ├── types/                 # Types TypeScript partages
│   │   ├── models.ts          # Types miroirs du schema Prisma
│   │   ├── api.ts             # DTOs request/response
│   │   ├── releves.ts         # Union type discrimine
│   │   ├── calculs.ts         # Types indicateurs et graphiques
│   │   └── index.ts           # Barrel export
│   └── generated/
│       └── prisma/            # Client Prisma genere
├── docs/
│   ├── TASKS.md               # Backlog (source de verite)
│   ├── decisions/             # Decisions architecturales (ADR)
│   ├── reviews/               # Rapports de code review
│   └── tests/                 # Rapports de test
├── public/                    # Assets statiques
├── CLAUDE.md                  # Instructions du projet
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── docker-compose.yml         # PostgreSQL pour le dev
└── prisma.config.ts
```

## Options considerees

### Option A — Structure par feature (dossiers feature)
Regrouper par fonctionnalite (`src/features/vagues/`, `src/features/bacs/`), chaque feature contenant ses composants, queries et types.

**Rejete** car le projet est petit (3 modeles). La separation par couche (components, lib, types) est plus simple et suffisante.

### Option B — Structure par couche (retenue)
Separer les composants, la logique metier et les types dans des dossiers distincts.

**Retenu** car :
- Plus naturel avec Next.js App Router (pages dans `app/`)
- Conforme aux conventions Next.js
- Facile a naviguer pour une equipe multi-agents
- Suffisant pour la taille du projet

## Consequences

- Les imports utilisent le path alias `@/` (ex: `import { Bac } from "@/types"`)
- Les composants UI sont reutilisables et independants du domaine
- Les queries Prisma sont encapsulees dans `src/lib/queries/` et jamais appelees directement depuis les composants
