# ADR 002 — Composants UI et strategie mobile first

**Date :** 2026-03-08
**Statut :** Acceptee
**Auteur :** @architect

## Contexte

L'application cible des pisciculteurs au Cameroun qui utilisent principalement des smartphones. L'interface doit etre utilisable a une main, sur des ecrans 360px, avec des connexions parfois instables.

## Decision

### 1. Approche mobile first

- **Breakpoint de reference** : 360px (petits smartphones Android)
- **Styles par defaut** : styles mobile (pas de breakpoint)
- **Breakpoints progressifs** :
  - `sm:` (640px) — pas utilise sauf cas special
  - `md:` (768px) — passage tablette/desktop
  - `lg:` (1024px) — desktop large
- **Pas de tableaux sur mobile** : cartes empilees en scroll vertical
- **Sur desktop (md:+)** : grilles et tableaux autorises

### 2. Taille tactile

Tout element interactif (bouton, lien, champ, select) a une taille minimale de **44px** (recommandation WCAG 2.5.8).

```
Classes Tailwind : min-h-11 (44px), py-3 pour les boutons, text-base minimum
```

### 3. Navigation

#### Mobile (< md)
- **Bottom navigation bar** fixee en bas de l'ecran
- 4 onglets : Dashboard | Vagues | + Releve | Bacs
- Le "+" est un bouton d'action rapide (acces direct au formulaire de releve)
- Icones avec label en dessous (lucide-react)

```
┌──────────────────────────────────┐
│           Header                 │
│  Titre page    [Action btn]     │
├──────────────────────────────────┤
│                                  │
│         Contenu page             │
│         (scroll vertical)        │
│                                  │
│                                  │
├──────────────────────────────────┤
│  🏠     📊     ➕     🧱       │
│ Accueil Vagues Releve  Bacs     │
└──────────────────────────────────┘
```

#### Desktop (>= md)
- **Sidebar laterale** a gauche, toujours visible
- Memes liens que la bottom nav
- Le contenu occupe le reste de l'ecran

```
┌────────┬────────────────────────────┐
│        │         Header             │
│  Logo  │  Titre page  [Actions]    │
│        ├────────────────────────────┤
│ Accueil│                            │
│ Vagues │      Contenu page          │
│ Releves│                            │
│ Bacs   │                            │
│        │                            │
└────────┴────────────────────────────┘
```

### 4. Composants Radix UI

Tous les composants interactifs utilisent les primitives Radix UI pour l'accessibilite et la composabilite.

| Composant | Primitive Radix | Usage |
|-----------|----------------|-------|
| `Button` | `Slot` (optionnel) | Actions, soumission |
| `Card` | Aucun (div style) | Affichage donnees mobile |
| `Dialog` | `@radix-ui/react-dialog` | Formulaires, confirmations. **Plein ecran sur mobile** |
| `Select` | `@radix-ui/react-select` | Selection vague, bac, type |
| `Tabs` | `@radix-ui/react-tabs` | Filtres par statut/type |
| `Toast` | `@radix-ui/react-toast` | Notifications succes/erreur |
| `Input` | Natif `<input>` style | Saisie texte et nombres |
| `Badge` | Aucun (span style) | Statuts, types de releve |
| `Label` | `@radix-ui/react-label` | Labels de formulaire |
| `DropdownMenu` | `@radix-ui/react-dropdown-menu` | Actions contextuelles |

### 5. Arbre des composants

```
<RootLayout>                              # Server Component
├── <Header />                            # Server Component — titre, actions
├── <main>
│   ├── [Dashboard] page.tsx              # Server Component
│   │   ├── <StatsCards />                # Server Component
│   │   └── <VagueSummaryCard />          # Server Component
│   │
│   ├── [Vagues] vagues/page.tsx          # Server Component
│   │   ├── <Tabs>                        # "use client" — filtres statut
│   │   │   └── <VagueCard />             # Server Component
│   │   └── <Dialog>                      # "use client" — creation vague
│   │       └── <VagueForm />             # "use client"
│   │
│   ├── [Detail] vagues/[id]/page.tsx     # Server Component
│   │   ├── <IndicateursCards />          # Server Component
│   │   ├── <EvolutionChart />            # "use client" (Recharts)
│   │   ├── <Tabs>                        # "use client" — filtre type releve
│   │   │   └── <ReleveCard />            # Server Component
│   │   └── <Dialog>                      # "use client" — cloture confirmation
│   │
│   ├── [Releve] releves/nouveau/page.tsx # "use client" — formulaire dynamique
│   │   ├── <Select> (vague)
│   │   ├── <Select> (bac)
│   │   ├── <Select> (type)
│   │   └── <Form*> (dynamique selon type)
│   │       ├── <FormBiometrie />
│   │       ├── <FormMortalite />
│   │       ├── <FormAlimentation />
│   │       ├── <FormQualiteEau />
│   │       ├── <FormComptage />
│   │       └── <FormObservation />
│   │
│   └── [Bacs] bacs/page.tsx              # Server Component
│       ├── <BacCard />                   # Server Component
│       └── <Dialog>                      # "use client" — creation bac
│           └── <BacForm />              # "use client"
│
└── <BottomNav />                         # "use client" — md:hidden
    (ou <Sidebar /> sur desktop)          # "use client" — hidden md:flex
```

### 6. Pattern Server vs Client Components

| Critere | Server Component | Client Component |
|---------|-----------------|-----------------|
| Affichage de donnees | ✅ | |
| Acces Prisma direct | ✅ | |
| Formulaires interactifs | | ✅ |
| Radix UI interactif (Dialog, Select, Tabs) | | ✅ |
| Navigation bottom bar | | ✅ (usePathname) |
| Graphiques Recharts | | ✅ |
| Cartes d'affichage simples | ✅ | |

**Regle** : "use client" uniquement quand c'est necessaire (interactivite, hooks React, Radix primitives).

## Options considerees

### Option A — Tout client components
**Rejete** : perte de performance, pas de rendu serveur, donnees chargees cote client.

### Option B — Server components par defaut (retenu)
**Retenu** : meilleure performance, donnees chargees cote serveur, hydratation minimale.

### Option C — React Server Components + Server Actions
**Partiellement retenu** : on utilise des Server Components pour l'affichage, mais les mutations passent par des API routes (plus explicite et testable).

## Consequences

- Les formulaires et composants interactifs sont les seuls "use client"
- Les pages de liste et de dashboard sont des Server Components qui appellent directement Prisma via `src/lib/queries/`
- Les graphiques Recharts sont wrapes dans un composant client dedie
- La bottom nav utilise `usePathname()` pour marquer l'onglet actif
