# ADR-037 — Filtres spécifiques au type de relevé et zones de sécurité du Sheet mobile

**Date :** 2026-04-06
**Statut :** SUPERSÉDÉ par ADR-038
**Auteur :** @architect
**Domaine :** UI / UX / API
**Dépend de :** ADR-034 (Architecture du Filtrage des Relevés)

---

## Contexte

### Enhancement 1 — Filtres spécifiques au type

La page `/releves` (ADR-034) expose aujourd'hui des filtres génériques :
`vagueId`, `bacId`, `typeReleve`, `dateFrom`, `dateTo`, `modifie`.

Quand un utilisateur sélectionne un `typeReleve` précis (ex : ALIMENTATION), il
peut vouloir affiner davantage : quel produit alimentaire ? quelle taille de granulé ?
quel comportement observé ? Ces sous-filtres n'ont de sens que dans le contexte du
type sélectionné. Les afficher en permanence surchargerait l'interface inutilement.

### Enhancement 2 — Zones de sécurité iOS/Android

Le `Sheet` Radix actuel dans `releves-filter-bar.tsx` est configuré avec :

```tsx
<SheetContent className="!left-auto !right-0 !inset-y-0 !w-full sm:!w-96 overflow-y-auto">
```

Les classes `!inset-y-0` positionnent le contenu de `top: 0` à `bottom: 0`. Sur
iOS avec une encoche (notch) en haut ou un indicateur de geste home (home indicator)
en bas, et sur Android avec des punch-hole cameras, le contenu du Sheet empiète sur
ces zones réservées du système.

**Constat dans `sheet.tsx` actuel :** Le composant `SheetContent` de base inclut
`pt-[env(safe-area-inset-top)]` mais seulement pour le Sheet de gauche (sidebar
principale). Le Sheet du filtre relevés override les styles avec `!inset-y-0` et
`!left-auto !right-0`, annulant tout padding safe-area.

**Constat dans `globals.css` :** Les variables CSS `--sat`, `--sar`, `--sab`, `--sal`
sont définies mais ne sont pas utilisées dans les classes Tailwind des Sheets de
filtre.

**Constat dans `layout.tsx` :** `viewportFit: "cover"` est activé — indispensable
pour que `env(safe-area-inset-*)` retourne des valeurs non nulles. C'est correct.

---

## Inventaire complet des champs par TypeReleve

Basé sur le modèle `Releve` dans `prisma/schema.prisma` et les enums dans
`src/types/models.ts` :

### BIOMETRIE
| Champ DB | Type | Filtrable par |
|----------|------|---------------|
| `poidsMoyen` | Float? | plage min/max |
| `tailleMoyenne` | Float? | plage min/max |
| `echantillonCount` | Int? | plage min/max |

### MORTALITE
| Champ DB | Type | Filtrable par |
|----------|------|---------------|
| `nombreMorts` | Int? | plage min/max |
| `causeMortalite` | CauseMortalite? | valeur enum |

Valeurs `CauseMortalite` : `MALADIE`, `QUALITE_EAU`, `STRESS`, `PREDATION`,
`CANNIBALISME`, `INCONNUE`, `AUTRE`

### ALIMENTATION
| Champ DB | Type | Filtrable par |
|----------|------|---------------|
| `typeAliment` | TypeAliment? | valeur enum |
| `quantiteAliment` | Float? | plage min/max |
| `frequenceAliment` | Int? | valeur exacte ou plage |
| `tauxRefus` | Float? | valeur exacte (0, 10, 25, 50) |
| `comportementAlim` | ComportementAlimentaire? | valeur enum |

Valeurs `TypeAliment` : `ARTISANAL`, `COMMERCIAL`, `MIXTE`

Valeurs `ComportementAlimentaire` : `VORACE`, `NORMAL`, `FAIBLE`, `REFUSE`

**Note sur les filtres aliment par granulométrie et forme :**
`TailleGranule` et `FormeAliment` sont des attributs du modèle `Produit`, **pas**
du modèle `Releve`. La liaison est indirecte : `Releve → ReleveConsommation → Produit`.
Filtrer par `tailleGranule` ou `formeAliment` nécessite une sous-requête ou une
jointure, ce qui est plus coûteux. Ces deux filtres sont traités différemment :
voir D4 ci-dessous.

### QUALITE_EAU
| Champ DB | Type | Filtrable par |
|----------|------|---------------|
| `temperature` | Float? | plage min/max |
| `ph` | Float? | plage min/max |
| `oxygene` | Float? | plage min/max |
| `ammoniac` | Float? | plage min/max |

### COMPTAGE
| Champ DB | Type | Filtrable par |
|----------|------|---------------|
| `nombreCompte` | Int? | plage min/max |
| `methodeComptage` | MethodeComptage? | valeur enum |

Valeurs `MethodeComptage` : `DIRECT`, `ESTIMATION`, `ECHANTILLONNAGE`

### OBSERVATION
| Champ DB | Type | Filtrable par |
|----------|------|---------------|
| `description` | String? | recherche textuelle (ILIKE) |

### RENOUVELLEMENT
| Champ DB | Type | Filtrable par |
|----------|------|---------------|
| `pourcentageRenouvellement` | Float? | plage min/max |
| `volumeRenouvele` | Float? | plage min/max |
| `nombreRenouvellements` | Int? | plage min/max |

---

## Décisions

### D1 — Paramètres URL pour les filtres spécifiques au type

Les filtres spécifiques au type sont des URL search params supplémentaires. Ils sont
ignorés par le backend si `typeReleve` ne correspond pas au type qui les définit.

**Convention de nommage :** camelCase, direct, sans préfixe de type.

#### Paramètres URL par type

| Type | Param URL | Type | Exemple |
|------|-----------|------|---------|
| **BIOMETRIE** | `poidsMoyenMin` | number string | `?poidsMoyenMin=30` |
| | `poidsMoyenMax` | number string | `?poidsMoyenMax=120` |
| | `tailleMoyenneMin` | number string | `?tailleMoyenneMin=10` |
| | `tailleMoyenneMax` | number string | `?tailleMoyenneMax=40` |
| **MORTALITE** | `causeMortalite` | CauseMortalite | `?causeMortalite=MALADIE` |
| | `nombreMortsMin` | number string | `?nombreMortsMin=1` |
| | `nombreMortsMax` | number string | `?nombreMortsMax=50` |
| **ALIMENTATION** | `typeAliment` | TypeAliment | `?typeAliment=COMMERCIAL` |
| | `comportementAlim` | ComportementAlimentaire | `?comportementAlim=VORACE` |
| | `frequenceAlimentMin` | number string | `?frequenceAlimentMin=2` |
| | `frequenceAlimentMax` | number string | `?frequenceAlimentMax=4` |
| **QUALITE_EAU** | `temperatureMin` | number string | `?temperatureMin=25` |
| | `temperatureMax` | number string | `?temperatureMax=32` |
| | `phMin` | number string | `?phMin=6.5` |
| | `phMax` | number string | `?phMax=8.0` |
| **COMPTAGE** | `methodeComptage` | MethodeComptage | `?methodeComptage=DIRECT` |
| **OBSERVATION** | `descriptionSearch` | string | `?descriptionSearch=stress` |
| **RENOUVELLEMENT** | `pourcentageMin` | number string | `?pourcentageMin=25` |
| | `pourcentageMax` | number string | `?pourcentageMax=100` |

**Rationale :** Les noms de params correspondent directement aux noms de champs
Prisma (sans préfixe `type_`), ce qui facilite le mapping backend. Les suffixes
`Min`/`Max` sont explicites et cohérents avec les conventions Tailwind (ex: `min-w`,
`max-w`). Le param `descriptionSearch` est suffixé pour le distinguer d'une valeur
exacte.

**Params exclus (Phase 1 de cette feature) :**
- `tailleGranule`, `formeAliment` — voir D4
- `echantillonCount`, `oxygene`, `ammoniac`, `volumeRenouvele`, `nombreRenouvellements`
  — filtrables en Phase 2 si besoin métier confirmé

### D2 — Extension de ReleveSearchParams et ParsedReleveFilters

`src/lib/releve-search-params.ts` doit être étendu avec les nouveaux params.

```typescript
// Extension de ReleveSearchParams
export interface ReleveSearchParams {
  // Filtres existants
  vagueId?: string;
  bacId?: string;
  typeReleve?: string;
  dateFrom?: string;
  dateTo?: string;
  modifie?: string;
  offset?: string;

  // Filtres spécifiques BIOMETRIE
  poidsMoyenMin?: string;
  poidsMoyenMax?: string;
  tailleMoyenneMin?: string;
  tailleMoyenneMax?: string;

  // Filtres spécifiques MORTALITE
  causeMortalite?: string;      // valeur CauseMortalite enum
  nombreMortsMin?: string;
  nombreMortsMax?: string;

  // Filtres spécifiques ALIMENTATION
  typeAliment?: string;         // valeur TypeAliment enum
  comportementAlim?: string;    // valeur ComportementAlimentaire enum
  frequenceAlimentMin?: string;
  frequenceAlimentMax?: string;

  // Filtres spécifiques QUALITE_EAU
  temperatureMin?: string;
  temperatureMax?: string;
  phMin?: string;
  phMax?: string;

  // Filtres spécifiques COMPTAGE
  methodeComptage?: string;     // valeur MethodeComptage enum

  // Filtres spécifiques OBSERVATION
  descriptionSearch?: string;

  // Filtres spécifiques RENOUVELLEMENT
  pourcentageMin?: string;
  pourcentageMax?: string;
}
```

```typescript
// Extension de ParsedReleveFilters
export interface ParsedReleveFilters {
  // Filtres existants
  vagueId?: string;
  bacId?: string;
  typeReleve?: TypeReleve;
  dateFrom?: string;
  dateTo?: string;
  modifie?: boolean;
  offset: number;
  limit: number;

  // Filtres spécifiques BIOMETRIE
  poidsMoyenMin?: number;
  poidsMoyenMax?: number;
  tailleMoyenneMin?: number;
  tailleMoyenneMax?: number;

  // Filtres spécifiques MORTALITE
  causeMortalite?: CauseMortalite;
  nombreMortsMin?: number;
  nombreMortsMax?: number;

  // Filtres spécifiques ALIMENTATION
  typeAliment?: TypeAliment;
  comportementAlim?: ComportementAlimentaire;
  frequenceAlimentMin?: number;
  frequenceAlimentMax?: number;

  // Filtres spécifiques QUALITE_EAU
  temperatureMin?: number;
  temperatureMax?: number;
  phMin?: number;
  phMax?: number;

  // Filtres spécifiques COMPTAGE
  methodeComptage?: MethodeComptage;

  // Filtres spécifiques OBSERVATION
  descriptionSearch?: string;

  // Filtres spécifiques RENOUVELLEMENT
  pourcentageMin?: number;
  pourcentageMax?: number;
}
```

**Règle de validation dans `parseReleveSearchParams` :**
- Les params numériques (`poidsMoyenMin`, etc.) sont parsés via `parseFloat`/`parseInt`.
  Si le parsing échoue (`NaN`) ou si la valeur est négative, le filtre est ignoré.
- Les params enum sont validés via `Object.values(EnumType).includes(value)`.
  Une valeur inconnue est silencieusement ignorée (pas d'erreur 400 — évite les
  bookmarks cassés si des valeurs d'enum changent).
- Un filtre spécifique à un type est inclus dans `ParsedReleveFilters` **seulement**
  si `typeReleve` est défini et correspond au bon type. Cette validation est faite
  dans `parseReleveSearchParams` pour éviter de transmettre des filtres incohérents
  au backend.

### D3 — Extension de ReleveFilters et getReleves()

`src/types/api.ts` — interface `ReleveFilters` étendue :

```typescript
export interface ReleveFilters {
  // Filtres existants
  vagueId?: string;
  bacId?: string;
  typeReleve?: TypeReleve;
  dateFrom?: string;
  dateTo?: string;
  nonLie?: boolean;
  modifie?: boolean;

  // Filtres spécifiques BIOMETRIE
  poidsMoyenMin?: number;
  poidsMoyenMax?: number;
  tailleMoyenneMin?: number;
  tailleMoyenneMax?: number;

  // Filtres spécifiques MORTALITE
  causeMortalite?: CauseMortalite;
  nombreMortsMin?: number;
  nombreMortsMax?: number;

  // Filtres spécifiques ALIMENTATION
  typeAliment?: TypeAliment;
  comportementAlim?: ComportementAlimentaire;
  frequenceAlimentMin?: number;
  frequenceAlimentMax?: number;

  // Filtres spécifiques QUALITE_EAU
  temperatureMin?: number;
  temperatureMax?: number;
  phMin?: number;
  phMax?: number;

  // Filtres spécifiques COMPTAGE
  methodeComptage?: MethodeComptage;

  // Filtres spécifiques OBSERVATION
  descriptionSearch?: string;

  // Filtres spécifiques RENOUVELLEMENT
  pourcentageMin?: number;
  pourcentageMax?: number;
}
```

`src/lib/queries/releves.ts` — extension du where builder dans `getReleves()` :

```typescript
// Après la clause modifie existante, ajouter :

// Filtre poidsMoyen (BIOMETRIE)
if (filters.poidsMoyenMin !== undefined || filters.poidsMoyenMax !== undefined) {
  where.poidsMoyen = {
    ...(filters.poidsMoyenMin !== undefined && { gte: filters.poidsMoyenMin }),
    ...(filters.poidsMoyenMax !== undefined && { lte: filters.poidsMoyenMax }),
  };
}

// Filtre tailleMoyenne (BIOMETRIE)
if (filters.tailleMoyenneMin !== undefined || filters.tailleMoyenneMax !== undefined) {
  where.tailleMoyenne = {
    ...(filters.tailleMoyenneMin !== undefined && { gte: filters.tailleMoyenneMin }),
    ...(filters.tailleMoyenneMax !== undefined && { lte: filters.tailleMoyenneMax }),
  };
}

// Filtre causeMortalite (MORTALITE)
if (filters.causeMortalite) {
  where.causeMortalite = filters.causeMortalite;
}

// Filtre nombreMorts (MORTALITE)
if (filters.nombreMortsMin !== undefined || filters.nombreMortsMax !== undefined) {
  where.nombreMorts = {
    ...(filters.nombreMortsMin !== undefined && { gte: filters.nombreMortsMin }),
    ...(filters.nombreMortsMax !== undefined && { lte: filters.nombreMortsMax }),
  };
}

// Filtre typeAliment (ALIMENTATION)
if (filters.typeAliment) {
  where.typeAliment = filters.typeAliment;
}

// Filtre comportementAlim (ALIMENTATION)
if (filters.comportementAlim) {
  where.comportementAlim = filters.comportementAlim;
}

// Filtre frequenceAliment (ALIMENTATION)
if (filters.frequenceAlimentMin !== undefined || filters.frequenceAlimentMax !== undefined) {
  where.frequenceAliment = {
    ...(filters.frequenceAlimentMin !== undefined && { gte: filters.frequenceAlimentMin }),
    ...(filters.frequenceAlimentMax !== undefined && { lte: filters.frequenceAlimentMax }),
  };
}

// Filtre temperature (QUALITE_EAU)
if (filters.temperatureMin !== undefined || filters.temperatureMax !== undefined) {
  where.temperature = {
    ...(filters.temperatureMin !== undefined && { gte: filters.temperatureMin }),
    ...(filters.temperatureMax !== undefined && { lte: filters.temperatureMax }),
  };
}

// Filtre ph (QUALITE_EAU)
if (filters.phMin !== undefined || filters.phMax !== undefined) {
  where.ph = {
    ...(filters.phMin !== undefined && { gte: filters.phMin }),
    ...(filters.phMax !== undefined && { lte: filters.phMax }),
  };
}

// Filtre methodeComptage (COMPTAGE)
if (filters.methodeComptage) {
  where.methodeComptage = filters.methodeComptage;
}

// Filtre descriptionSearch (OBSERVATION) — insensible à la casse
if (filters.descriptionSearch) {
  where.description = {
    contains: filters.descriptionSearch,
    mode: "insensitive",
  };
}

// Filtre pourcentageRenouvellement (RENOUVELLEMENT)
if (filters.pourcentageMin !== undefined || filters.pourcentageMax !== undefined) {
  where.pourcentageRenouvellement = {
    ...(filters.pourcentageMin !== undefined && { gte: filters.pourcentageMin }),
    ...(filters.pourcentageMax !== undefined && { lte: filters.pourcentageMax }),
  };
}
```

**Note sur les index DB :** Les filtres de plage sur des champs Float/Int nullable
(`poidsMoyen`, `temperature`, etc.) ne bénéficient pas d'index actuels. Pour les
requêtes les plus fréquentes, un index sur `(siteId, typeReleve, poidsMoyen)` serait
utile mais non bloquant — les volumes de données par site restent modestes en Phase 1.
L'ajout d'index peut être différé à une migration dédiée si les performances
deviennent un problème.

### D4 — Filtres tailleGranule et formeAliment : hors périmètre Phase 1

`TailleGranule` et `FormeAliment` sont des attributs du modèle `Produit`, pas de
`Releve`. La liaison est `Releve → ReleveConsommation → Produit`.

Filtrer les relevés ALIMENTATION par `tailleGranule` nécessite :
```sql
SELECT r.* FROM "Releve" r
WHERE r."typeReleve" = 'ALIMENTATION'
AND EXISTS (
  SELECT 1 FROM "ReleveConsommation" rc
  JOIN "Produit" p ON rc."produitId" = p.id
  WHERE rc."releveId" = r.id
  AND p."tailleGranule" = 'G2'
)
```

Cette sous-requête corrélée est plus coûteuse et complexifie significativement
le where builder de Prisma (nécessite `some: { produit: { tailleGranule: ... } }`
sur la relation `consommations`). Ces filtres sont reportés en Phase 2 de cette
feature — ils seront documentés dans un ADR dédié si le besoin métier est confirmé.

### D5 — Rendu conditionnel des filtres spécifiques dans le Sheet

**Règle d'affichage :** Le bloc de filtres spécifiques n'apparaît dans le Sheet que
si `localType !== ALL_VALUE`. Quand le type change, les filtres spécifiques du type
précédent sont masqués ET leurs valeurs locales sont réinitialisées.

**Architecture du composant `RelevesFilterSheet` :**

```
RelevesFilterSheet
├── VagueSelect
├── BacSelect (dépend vagueId)
├── TypeSelect               ← sélection du type
│
├── [si localType !== ALL_VALUE]
│   └── TypeSpecificFilters  ← section conditionnelle
│       ├── [si BIOMETRIE]   BiometrieFilters
│       │   ├── PoidsMoyenRangeInputs
│       │   └── TailleMoyenneRangeInputs
│       ├── [si MORTALITE]   MortaliteFilters
│       │   ├── CauseMortaliteSelect
│       │   └── NombreMortsRangeInputs
│       ├── [si ALIMENTATION] AlimentationFilters
│       │   ├── TypeAlimentSelect
│       │   ├── ComportementAlimSelect
│       │   └── FrequenceAlimentRangeInputs
│       ├── [si QUALITE_EAU] QualiteEauFilters
│       │   ├── TemperatureRangeInputs
│       │   └── PhRangeInputs
│       ├── [si COMPTAGE]    ComptageFilters
│       │   └── MethodeComptageSelect
│       ├── [si OBSERVATION] ObservationFilters
│       │   └── DescriptionSearchInput
│       └── [si RENOUVELLEMENT] RenouvellementFilters
│           └── PourcentageRangeInputs
│
├── PeriodeInputs
├── ModifieCheckbox
└── ActionButtons (Effacer / Appliquer)
```

**Réinitialisation au changement de type :**
```typescript
function handleTypeChange(value: string) {
  setLocalType(value);
  // Réinitialiser tous les filtres spécifiques
  resetTypeSpecificFilters();
}

function resetTypeSpecificFilters() {
  setLocalPoidsMoyenMin("");
  setLocalPoidsMoyenMax("");
  // ... tous les autres filtres spécifiques
}
```

**Scrollabilité :** Le Sheet est déjà `overflow-y-auto`. Avec les filtres
spécifiques, le contenu peut dépasser la hauteur de l'écran sur 360px — le scroll
vertical est la solution naturelle. Le header "Filtres" reste fixe (sticky) en
haut du Sheet, les boutons d'action restent collés en bas.

**Sticky header + sticky footer dans le Sheet :**
```
┌──────────────────────────────┐
│ [sticky] Filtres   [Effacer] │  ← sticky top
├──────────────────────────────┤
│                              │
│  [scrollable content]        │
│  VagueSelect                 │
│  BacSelect                   │
│  TypeSelect                  │
│  ─── Filtres ALIMENTATION ── │  ← section conditionnelle
│  TypeAliment                 │
│  Comportement                │
│  Fréquence min/max           │
│  ─────────────────────────── │
│  Période                     │
│  Modifiés seulement          │
│                              │
├──────────────────────────────┤
│ [sticky] [Effacer] [Appliquer│  ← sticky bottom avec safe-area
└──────────────────────────────┘
```

Structure HTML du Sheet :
```tsx
<div className="flex flex-col h-full">
  {/* Header fixe */}
  <div className="shrink-0 flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] pb-3 border-b border-border">
    <h2>Filtres</h2>
  </div>

  {/* Corps scrollable */}
  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
    {/* ... filtres ... */}
  </div>

  {/* Footer fixe avec safe-area-inset-bottom */}
  <div className="shrink-0 flex gap-2 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-border">
    <button>Effacer</button>
    <button>Appliquer</button>
  </div>
</div>
```

**Barre desktop (≥ md) :** Les filtres spécifiques apparaissent inline à droite du
sélecteur de type, sous forme d'une deuxième ligne de filtres. La ligne est masquée
si aucun type n'est sélectionné.

```
Ligne 1 : [Vague ▼] [Bac ▼] [Type ▼] [Du date] [Au date] [Modifiés]
Ligne 2 : [si ALIMENTATION] [TypeAliment ▼] [Comportement ▼] [Fréq. min] [Fréq. max]
```

### D6 — Correction des zones de sécurité (Safe Areas)

#### Problème dans `releves-filter-bar.tsx`

Le `SheetContent` override les styles avec des classes `!` (important) qui écrasent
le `pt-[env(safe-area-inset-top)]` du composant `sheet.tsx` de base. La solution
doit être appliquée au niveau du *contenu* du Sheet, pas au composant `SheetContent`.

#### Solution

**Approche retenue : padding dans le contenu du Sheet, pas dans `SheetContent`.**

Raison : `SheetContent` est partagé avec la sidebar principale et d'autres usages.
Modifier son implémentation impacterait tous les consommateurs. Le Sheet de filtre
relevés a son propre layout interne dans `releves-filter-bar.tsx` — c'est là que
les safe areas doivent être gérées.

**CSS à appliquer :**

```tsx
{/* Header — safe area en haut */}
<div className="shrink-0 px-4 pt-[env(safe-area-inset-top)] ...">
  {/* Le pt s'ajoute au padding top déjà prévu */}
</div>

{/* Footer — safe area en bas */}
<div className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] ...">
  {/* max() garantit un minimum de 12px même si safe-area-inset-bottom = 0 */}
</div>
```

**Pourquoi `max(0.75rem, env(safe-area-inset-bottom))` :**
Sur un iPhone sans notch ou un Android sans gestes système, `safe-area-inset-bottom`
vaut `0`. `max()` garantit que le bouton "Appliquer" a toujours au moins 12px de
padding bas pour respirer et ne pas coller au bord de l'écran.

**Tailwind v4 :** Les classes arbitraires `pb-[max(0.75rem,env(safe-area-inset-bottom))]`
et `pt-[env(safe-area-inset-top)]` sont supportées nativement. Pas de configuration
`safelist` nécessaire.

#### Variables CSS existantes à utiliser

Les variables `--sab`, `--sat` etc. sont définies dans `globals.css` mais non
utilisées pour les Sheets. Elles peuvent remplacer les appels `env()` directs :

```css
/* globals.css — déjà défini */
:root {
  --sat: env(safe-area-inset-top);
  --sab: env(safe-area-inset-bottom);
}
```

```tsx
{/* Utilisation via var() dans les classes Tailwind arbitraires */}
<div className="pt-[var(--sat)]">   {/* = pt-[env(safe-area-inset-top)] */}
<div className="pb-[max(0.75rem,var(--sab))]">
```

Les deux syntaxes sont équivalentes. La syntaxe `env()` directe est préférée car
elle est plus lisible et ne dépend pas de la définition CSS en amont.

#### Sheet côté droit (filtre relevés) vs Sheet côté gauche (sidebar)

| | Sidebar (`sheet.tsx`) | Sheet filtres (`releves-filter-bar.tsx`) |
|---|---|---|
| Position | `left-0` | `right-0` (via `!left-auto !right-0`) |
| Safe area top | `pt-[env(safe-area-inset-top)]` dans SheetContent | Dans le header du contenu |
| Safe area bottom | Non géré (scroll ou nav en dessous) | Dans le footer des boutons |
| Safe area right | Non concerné | `pr-[env(safe-area-inset-right)]` si nécessaire |

**Note sur `safe-area-inset-right` :** Sur iPhone en landscape, l'encoche peut être
à droite. Comme le Sheet filtres s'ouvre à droite (`!right-0`), il faut ajouter
`pr-[env(safe-area-inset-right)]` au padding du contenu. Pour l'usage portrait
(principal), `safe-area-inset-right` vaut 0.

### D7 — Extension de countActiveFilters

La fonction `countActiveFilters` dans `releve-search-params.ts` doit compter les
filtres spécifiques actifs. Chaque paire min/max compte pour 1 filtre (pas 2) :

```typescript
export function countActiveFilters(params: ReleveSearchParams): number {
  let count = 0;
  if (params.vagueId) count++;
  if (params.bacId) count++;
  if (params.typeReleve && params.typeReleve !== ALL_VALUE) count++;
  if (params.dateFrom) count++;
  if (params.dateTo) count++;
  if (params.modifie === "true") count++;

  // Filtres spécifiques — 1 point par filtre actif (paire min/max = 1 point)
  if (params.poidsMoyenMin || params.poidsMoyenMax) count++;
  if (params.tailleMoyenneMin || params.tailleMoyenneMax) count++;
  if (params.causeMortalite) count++;
  if (params.nombreMortsMin || params.nombreMortsMax) count++;
  if (params.typeAliment) count++;
  if (params.comportementAlim) count++;
  if (params.frequenceAlimentMin || params.frequenceAlimentMax) count++;
  if (params.temperatureMin || params.temperatureMax) count++;
  if (params.phMin || params.phMax) count++;
  if (params.methodeComptage) count++;
  if (params.descriptionSearch) count++;
  if (params.pourcentageMin || params.pourcentageMax) count++;

  return count;
}
```

### D8 — Chips des filtres actifs (RelevesActiveFilters)

Les chips existants sont générés par `chips.push(...)` dans `releves-active-filters.tsx`.
Les filtres spécifiques doivent générer des chips supplémentaires quand ils sont actifs.

**Labels des chips :**

| Param | Label chip |
|-------|------------|
| `poidsMoyenMin` + `poidsMoyenMax` | `Poids : 30–120 g` |
| `poidsMoyenMin` seul | `Poids ≥ 30 g` |
| `poidsMoyenMax` seul | `Poids ≤ 120 g` |
| `causeMortalite` | `Cause : Maladie` (label traduit) |
| `typeAliment` | `Aliment : Commercial` |
| `comportementAlim` | `Comportement : Vorace` |
| `methodeComptage` | `Méthode : Direct` |
| `descriptionSearch` | `Recherche : "stress"` |
| `temperatureMin` + `temperatureMax` | `T° : 25–32°C` |
| etc. | Pattern identique |

**Suppression d'un chip :** Supprimer un chip de plage supprime les deux params
(`min` et `max`) en un seul clic — même logique que la suppression des dates
(`key: "dates"` → supprime `dateFrom` et `dateTo`).

```typescript
// Dans removeParam() :
case "poidsMoyen":
  params.delete("poidsMoyenMin");
  params.delete("poidsMoyenMax");
  break;
case "tailleMoyenne":
  params.delete("tailleMoyenneMin");
  params.delete("tailleMoyenneMax");
  break;
// ... etc.
```

### D9 — Réinitialisation des filtres spécifiques lors d'un reset de type

Dans `releves-filter-bar.tsx`, `resetAllFilters()` navigue vers `/releves` — tous
les params sont supprimés, y compris les filtres spécifiques. C'est correct.

Dans `updateMultipleParams()` (appelé depuis le Sheet "Appliquer"), la liste des
params à supprimer avant réapplication doit inclure tous les nouveaux params :

```typescript
const ALL_FILTER_PARAMS = [
  "vagueId", "bacId", "typeReleve", "dateFrom", "dateTo", "modifie",
  // Nouveaux params spécifiques
  "poidsMoyenMin", "poidsMoyenMax", "tailleMoyenneMin", "tailleMoyenneMax",
  "causeMortalite", "nombreMortsMin", "nombreMortsMax",
  "typeAliment", "comportementAlim", "frequenceAlimentMin", "frequenceAlimentMax",
  "temperatureMin", "temperatureMax", "phMin", "phMax",
  "methodeComptage",
  "descriptionSearch",
  "pourcentageMin", "pourcentageMax",
];
```

Cette constante doit être exportée depuis `releve-search-params.ts` pour être
partagée entre `releves-filter-bar.tsx` et d'autres consommateurs.

---

## Impacts sur les fichiers existants

| Fichier | Modification | Impact |
|---------|-------------|--------|
| `src/lib/releve-search-params.ts` | Étendre `ReleveSearchParams`, `ParsedReleveFilters`, `countActiveFilters`, `parseReleveSearchParams`. Ajouter `ALL_FILTER_PARAMS` constant. | Majeur |
| `src/types/api.ts` | Étendre `ReleveFilters` avec les nouveaux champs | Moyen |
| `src/lib/queries/releves.ts` | Étendre le where builder dans `getReleves()` | Moyen |
| `src/app/api/releves/route.ts` | Extraire et valider les nouveaux query params depuis `searchParams` | Moyen |
| `src/components/releves/releves-filter-sheet.tsx` | Ajouter les filtres spécifiques conditionnels + fix safe areas (header/footer sticky) | Majeur |
| `src/components/releves/releves-filter-bar.tsx` | Gérer les nouveaux params dans `updateMultipleParams` + `resetAllFilters`. Ajouter la 2ème ligne de filtres desktop. Fix safe area du SheetContent. | Majeur |
| `src/components/releves/releves-active-filters.tsx` | Ajouter les chips pour les filtres spécifiques | Moyen |

---

## Nouveaux fichiers à créer

Aucun. Tous les changements étendent des fichiers existants.

---

## Composants UI réutilisables à extraire (optionnel)

Pour éviter la répétition dans `releves-filter-sheet.tsx`, extraire un composant
interne `RangeInputs` :

```typescript
// Usage interne (pas exporté) dans releves-filter-sheet.tsx
function RangeInputs({
  label,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minPlaceholder,
  maxPlaceholder,
  step,
}: RangeInputsProps) { ... }
```

Ce composant rend deux `<input type="number">` côte à côte avec un label. Il est
utilisé pour poidsMoyen, tailleMoyenne, nombreMorts, frequenceAliment, temperature,
ph, pourcentage.

---

## Wireframes mobile — filtres spécifiques

### Sheet ouvert, type ALIMENTATION sélectionné

```
┌─────────────────────────────┐  ← 360px
│ Filtres           [Effacer] │  ← header sticky (safe-area-top)
├─────────────────────────────┤
│ [scroll ↕]                  │
│ Vague                       │
│ ┌───────────────────────┐   │
│ │ Toutes les vagues ▼   │   │
│ └───────────────────────┘   │
│ Type de relevé              │
│ ┌───────────────────────┐   │
│ │ Alimentation ▼        │   │  ← type sélectionné
│ └───────────────────────┘   │
│                             │
│ ─── Filtres Alimentation ──  │  ← section conditionnelle
│ Type d'aliment              │
│ ┌───────────────────────┐   │
│ │ Tous ▼                │   │
│ └───────────────────────┘   │
│ Comportement                │
│ ┌───────────────────────┐   │
│ │ Tous ▼                │   │
│ └───────────────────────┘   │
│ Fréquence (repas/jour)      │
│ ┌────────┐  à  ┌────────┐   │
│ │ Min    │     │ Max    │   │
│ └────────┘     └────────┘   │
│ ─────────────────────────── │
│ Période                     │
│ [Du date]   [Au date]       │
│                             │
│ ○ Modifiés seulement        │
├─────────────────────────────┤
│ [Effacer] [Appliquer (3)]   │  ← footer sticky (safe-area-bottom)
└─────────────────────────────┘
```

### Sheet ouvert, type BIOMETRIE sélectionné

```
│ ─── Filtres Biométrie ──    │
│ Poids moyen (g)             │
│ ┌────────┐  à  ┌────────┐   │
│ │ Min    │     │ Max    │   │
│ └────────┘     └────────┘   │
│ Taille moyenne (cm)         │
│ ┌────────┐  à  ┌────────┐   │
│ │ Min    │     │ Max    │   │
│ └────────┘     └────────┘   │
```

### Barre desktop — ligne 2 filtres MORTALITE

```
Ligne 1: [Vague ▼] [Bac ▼] [Mortalité ▼] [Du date] [Au date] [Modifiés]
Ligne 2: [Cause ▼]  Nombre: [min] à [max]
```

---

## Ordre d'implémentation recommandé

1. **Étendre `src/lib/releve-search-params.ts`** — interfaces + parsing + `ALL_FILTER_PARAMS`
   (fonctions pures, testable en isolation)

2. **Étendre `src/types/api.ts`** — `ReleveFilters` avec nouveaux champs

3. **Étendre `src/lib/queries/releves.ts`** — where builder dans `getReleves()`

4. **Étendre `src/app/api/releves/route.ts`** — extraction + validation des nouveaux params

5. **Corriger safe areas dans `releves-filter-bar.tsx`** — restructurer le contenu
   du Sheet avec header/footer sticky + padding safe-area

6. **Étendre `releves-filter-sheet.tsx`** — ajouter les filtres spécifiques par type,
   `handleTypeChange` avec reset, `RangeInputs` interne

7. **Étendre `releves-filter-bar.tsx`** — `updateMultipleParams` avec `ALL_FILTER_PARAMS`,
   deuxième ligne de filtres desktop

8. **Étendre `releves-active-filters.tsx`** — chips pour les filtres spécifiques

---

## Règles Phase 2 respectées

| Règle | Application |
|-------|-------------|
| R1 — Enums MAJUSCULES | `CauseMortalite.MALADIE`, `TypeAliment.COMMERCIAL`, etc. |
| R2 — Importer les enums | `import { CauseMortalite, TypeAliment, ... } from "@/types"` |
| R3 — Prisma = TypeScript | `ParsedReleveFilters` miroir de `ReleveFilters` — champs identiques |
| R4 — Opérations atomiques | Le parsing dans `parseReleveSearchParams` est une fonction pure sans effet de bord |
| R5 — DialogTrigger asChild | Inchangé — les Selects Radix sont déjà utilisés avec asChild |
| R6 — CSS variables | `env(safe-area-inset-bottom)` via `var(--sab)` — variables déjà dans globals.css |
| R7 — Nullabilité explicite | Tous les filtres spécifiques sont `?: number` (optional) — jamais null |
| R8 — siteId PARTOUT | `getReleves(siteId, filters)` — inchangé |
| R9 — Tests avant review | Tests des nouvelles fonctions de parsing à ajouter dans `vitest` |

---

## Alternatives rejetées

### A1 — Filtres spécifiques dans un Dialog séparé

Un bouton "Filtres avancés" ouvrant un Dialog séparé du Sheet principal.
Rejeté : double couche modale sur mobile (Sheet + Dialog). Complexifie le flux
utilisateur. Le Sheet scrollable est suffisant.

### A2 — Accordion dans le Sheet pour les filtres spécifiques

Un `<details>` ou composant Accordion Radix dépliable par type dans le Sheet.
Rejeté : sur 360px, un Accordion rajoute une interaction de plus (ouvrir l'accordion)
avant d'accéder au filtre. L'affichage conditionnel direct (visible quand le type
est sélectionné) est plus direct.

### A3 — Tabs dans le Sheet (un onglet par type)

Rejeté : les Tabs Radix dans un Sheet créent un problème de navigation au clavier
et de gestion du focus. De plus, le sélecteur de type (déjà présent) remplit le
même rôle de sélection — dupliquer avec des Tabs serait redondant.

### A4 — Modifier SheetContent pour gérer les safe areas globalement

Modifier `src/components/ui/sheet.tsx` pour ajouter automatiquement les padding
safe-area à tous les SheetContent. Rejeté : le Sheet est partagé (sidebar, filtres,
potentiellement d'autres usages). Un SheetContent générique avec `padding-top: safe-area`
fixe casserait les usages où le header du contenu doit gérer lui-même ce padding
(ex : sidebar avec image de profil en haut). La correction doit être localisée dans
le composant qui gère le Sheet de filtre relevés.

### A5 — Filtres tailleGranule / formeAliment via jointure Produit

Rejeté pour Phase 1. La jointure `Releve → ReleveConsommation → Produit` nécessite
une clause Prisma `some: { produit: { tailleGranule: ... } }` qui génère une
sous-requête corrélée. Sans index dédié sur `ReleveConsommation(produitId)` en
combinaison avec `Produit(tailleGranule)`, les performances sont imprévisibles.
Reporté à Phase 2 avec benchmark préalable.
