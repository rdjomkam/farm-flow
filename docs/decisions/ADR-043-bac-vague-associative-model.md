# ADR-043 — Modèle Associatif Bac-Vague (AssignationBac)

**Date :** 2026-04-06
**Statut :** PROPOSE
**Auteur :** @architect
**Remplace partiellement :** ADR-024 (qui avait conclu au statu quo)

---

## Contexte et motivation

La relation actuelle entre `Bac` et `Vague` est une clé étrangère nullable directe :
`Bac.vagueId String?` — assignée lors du stockage, remise à null lors de la clôture ou
du retrait. Cette approche a été analysée dans ADR-024, qui avait alors recommandé le
statu quo par pragmatisme (impact sur 99 fichiers).

Depuis ADR-024, plusieurs problèmes structurels supplémentaires ont émergé :

1. **ADR-041 (bacs orphelins)** — après un calibrage qui détache un bac (vagueId → null),
   ce bac disparaît du sélecteur de filtres des relevés, obligeant à créer un endpoint
   dédié `GET /api/bacs/by-vague-releves` comme contournement. Ce contournement existe
   précisément parce que `Bac.vagueId` n'est pas la source de vérité pour l'histoire.

2. **Perte du nombre de poissons à la clôture** — quand une vague est clôturée,
   `cloturerVague` remet `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial` à null
   sur chaque bac. L'information "combien de poissons restaient au dernier jour" est
   perdue sur le bac lui-même (elle survit uniquement dans le dernier relevé COMPTAGE).

3. **Pas d'historique natif** — il est impossible de récupérer proprement la liste de
   toutes les vagues dans lesquelles un bac a été utilisé, ni l'effectif de départ par
   bac pour chaque vague passée.

4. **Cohérence vacillante** — la vérification "ce bac est-il libre ?" repose sur
   `Bac.vagueId IS NULL`, ce qui nécessite des opérations atomiques type `updateMany`
   (ADR implicite dans `assignerBac`). Avec un modèle associatif, la contrainte devient
   exprimable directement en base.

L'utilisateur demande une refonte vers un modèle associatif `AssignationBac` qui joue
le rôle de table de jonction entre `Bac` et `Vague`, tout en portant les métadonnées de
chaque assignation.

---

## Partie 1 — Conception du modèle AssignationBac

### 1.1 Modèle proposé

```prisma
model AssignationBac {
  id                String    @id @default(cuid())

  /** FK vers le bac physique */
  bacId             String
  bac               Bac       @relation(fields: [bacId], references: [id], onDelete: Restrict)

  /** FK vers la vague d'élevage */
  vagueId           String
  vague             Vague     @relation(fields: [vagueId], references: [id], onDelete: Restrict)

  /** Date de début de l'assignation (= date de stockage des alevins dans ce bac) */
  dateAssignation   DateTime  @default(now())

  /**
   * Date de fin de l'assignation.
   * null = assignation ACTIVE (bac encore dans la vague).
   * non-null = assignation terminée (bac retiré ou vague clôturée).
   */
  dateFin           DateTime?

  /**
   * Nombre de poissons stockés dans ce bac AU MOMENT du stockage initial.
   * Immuable après création — sert de référence historique stable.
   */
  nombrePoissonsInitial Int

  /**
   * Poids moyen des poissons en grammes AU MOMENT du stockage.
   * Copié depuis Vague.poidsMoyenInitial à la création.
   */
  poidsMoyenInitial Float

  /**
   * Effectif courant des poissons dans ce bac (mis à jour en temps réel).
   * Remplace Bac.nombrePoissons pour la vague en cours.
   * null = jamais mis à jour depuis le stockage initial.
   */
  nombrePoissons    Int?

  /** Notes libres lors du stockage ou du retrait */
  notes             String?

  /** ID du site — R8 obligatoire */
  siteId            String
  site              Site      @relation(fields: [siteId], references: [id])

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([bacId])
  @@index([vagueId])
  @@index([siteId])
  @@index([bacId, dateFin])   -- index critique pour "bac actif ?"
  @@index([vagueId, dateFin]) -- index critique pour "bacs actifs d'une vague"
}
```

### 1.2 Contrainte d'unicité d'assignation active

La contrainte "un bac ne peut avoir qu'UNE assignation active à la fois" ne peut pas être
exprimée via `@@unique` en SQL standard sur une valeur nullable. Elle s'exprime de deux façons :

**Option A — Contrainte partielle PostgreSQL (recommandé)**

```sql
CREATE UNIQUE INDEX "AssignationBac_bacId_active_unique"
ON "AssignationBac" ("bacId")
WHERE "dateFin" IS NULL;
```

Cette contrainte garantit qu'il ne peut exister qu'un seul enregistrement avec
`dateFin IS NULL` pour un `bacId` donné. Elle est exprimable dans Prisma via
une migration SQL manuelle.

**Option B — Vérification applicative**

Vérifier dans `assignerBac()` qu'il n'existe pas d'`AssignationBac` active avant
d'en créer une nouvelle. Moins robuste mais plus simple à mettre en place.

**Recommandation :** Option A + Option B en défense en profondeur.

### 1.3 Remplacement de Bac.vagueId

Après migration, `Bac` perd les champs suivants :
- `vagueId String?` — remplacé par la relation `AssignationBac` active
- `nombrePoissons Int?` — déplacé vers `AssignationBac.nombrePoissons`
- `nombreInitial Int?` — renommé `AssignationBac.nombrePoissonsInitial`
- `poidsMoyenInitial Float?` — déplacé vers `AssignationBac.poidsMoyenInitial`

`Bac` conserve ses champs non-liés à une vague spécifique :
- `nom`, `volume`, `typeSysteme`, `isBlocked`, `siteId`
- Relations : `releves`, `lotsAlevins`, `activites`, `calibrageGroupesDst`
- Nouvelle relation : `assignations AssignationBac[]`

### 1.4 Requête "bac actif ?"

Remplace `bac.vagueId !== null` :

```typescript
// Bac libre = aucune AssignationBac avec dateFin IS NULL
const assignationActive = await prisma.assignationBac.findFirst({
  where: { bacId, dateFin: null, siteId },
});
const estLibre = assignationActive === null;
```

Ou côté Prisma, via include :

```prisma
// Pour charger la vague active d'un bac
bac {
  include: {
    assignations: {
      where: { dateFin: null },
      take: 1,
      include: { vague: { select: { code: true } } },
    }
  }
}
```

### 1.5 Relation Site sur AssignationBac

Conformément à la règle R8, `AssignationBac` porte un `siteId` direct (FK vers `Site`).
Ce champ est redondant (déduit depuis `bac.siteId` ou `vague.siteId`) mais requis par
l'architecture multi-tenant pour les requêtes filtrées par site sans jointure supplémentaire.

---

## Partie 2 — Analyse d'impact sur l'existant

### 2.1 Modèle Prisma — fichiers à modifier

**`prisma/schema.prisma`**

- Retirer de `Bac` : `vagueId`, `vague`, `nombrePoissons`, `nombreInitial`,
  `poidsMoyenInitial`, l'index `@@index([vagueId])`
- Retirer de `Vague` : `bacs Bac[]` (relation inverse directe)
- Ajouter le modèle `AssignationBac` (voir 1.1)
- Ajouter dans `Bac` : `assignations AssignationBac[]`
- Ajouter dans `Vague` : `assignations AssignationBac[]`
- Ajouter dans `Site` : `assignationsBac AssignationBac[]`

### 2.2 Queries — fichiers impactés

#### `src/lib/queries/bacs.ts` — impact majeur

| Fonction | Ligne | Changement requis |
|----------|-------|-------------------|
| `getBacs()` | 14-18 | `include: { vague: ... }` → `include: { assignations: { where: { dateFin: null }, take: 1, include: { vague: ... } } }` |
| `getBacs()` | 32-35 | `vagueId: b.vagueId` → `vagueId: b.assignations[0]?.vagueId ?? null` |
| `getBacById()` | 45-48 | même transformation sur l'include |
| `updateBac()` | 71 | `bac.vagueId` → récupérer l'assignation active |
| `updateBac()` | 75 | `vagueId: bac.vagueId` → `vagueId: assignationActive.vagueId` |
| `getBacsLibres()` | 101-106 | `where: { vagueId: null }` → `where: { assignations: { none: { dateFin: null } } }` |
| `assignerBac()` | 109-120 | Remplacer `updateMany` sur `Bac.vagueId` par création d'une `AssignationBac` |
| `libererBac()` | 122-128 | Remplacer `vagueId: null` par `dateFin: new Date()` sur l'assignation active |

La fonction `getBacsAvecRelevesPourVague()` (lignes 135-152) **n'est plus nécessaire** comme
contournement — le modèle associatif expose nativement l'histoire complète. Elle peut être
gardée pour des raisons de compatibilité descendante mais son usage principal (ADR-041) disparaît.

#### `src/lib/queries/vagues.ts` — impact majeur

| Fonction | Ligne | Changement requis |
|----------|-------|-------------------|
| `getVagueById()` | 38-44 | `include: { bacs: ... }` → `include: { assignations: { where: { dateFin: null }, include: { bac: true } } }` — ou adapter le type de retour |
| `getVagueByIdWithReleves()` | 59-62 | même transformation |
| `createVague()` | 96-148 | (1) vérif libres : `bac.vagueId !== null` → `assignationActive !== null` ; (2) création : `tx.bac.update({ vagueId })` → `tx.assignationBac.create(...)` |
| `cloturerVague()` | 168-176 | `tx.bac.updateMany({ data: { vagueId: null, ... } })` → `tx.assignationBac.updateMany({ where: { vagueId: id, dateFin: null }, data: { dateFin: new Date(), nombrePoissons: /* snapshot */ } })` |
| `updateVague()` — addBacs | 213-245 | même remplacement que createVague |
| `updateVague()` — removeBacs | 260-332 | `tx.bac.findMany({ where: { vagueId: id } })` → `tx.assignationBac.findMany({ where: { vagueId: id, dateFin: null } })` ; libération = `dateFin: new Date()` |
| `updateVague()` — removeBacs | 326-333 | retrait des champs `vagueId: null`, `nombrePoissons: null` etc. sur `Bac` |

#### `src/lib/queries/releves.ts` — impact modéré

| Ligne | Changement requis |
|-------|-------------------|
| 158-167 | `bac.vagueId !== data.vagueId` → vérifier via `AssignationBac` active que ce bac est bien dans la vague demandée. Attention : avec le modèle actuel, un relevé peut être créé sur un bac retiré de la vague (bac orphelin). Avec AssignationBac, on peut vérifier l'assignation **à la date du relevé** (`dateAssignation <= releveDate && (dateFin IS NULL OR dateFin >= releveDate)`) |

#### `src/lib/queries/analytics.ts` — impact modéré

| Ligne | Changement requis |
|-------|-------------------|
| 185-186 | `_count: { select: { bacs: true } }` sur Vague → `_count: { select: { assignations: { where: { dateFin: null } } } }` |
| 1013 | `prisma.bac.count({ where: { vagueId: { not: null } } })` → `prisma.assignationBac.count({ where: { dateFin: null, siteId } })` |
| `computeIndicateursBac()` : 59, 77 | `bac.nombreInitial` → `assignation.nombrePoissonsInitial` |
| `getIndicateursBac()` : 188-192 | `bac.findFirst({ where: { id: bacId, siteId }, select: { nombreInitial: true } })` → inclure l'assignation |

#### `src/lib/queries/dashboard.ts`

| Ligne | Changement requis |
|-------|-------------------|
| 67 | `prisma.bac.count({ where: { siteId, vagueId: { not: null } } })` → `prisma.assignationBac.count({ where: { siteId, dateFin: null } })` |

#### `src/lib/queries/lots-alevins.ts`

| Ligne | Changement requis |
|-------|-------------------|
| 231 | `bacs.filter((b) => b.vagueId !== null)` → `AssignationBac` active |
| 193-194 (commentaire) | `update Bac.vagueId` → `create AssignationBac` |

#### `src/lib/queries/ventes.ts`

| Ligne | Changement requis |
|-------|-------------------|
| 98 | `where: { vagueId: data.vagueId, siteId }` sur `bac.findMany` → `assignationBac.findMany({ where: { vagueId, dateFin: null } })` pour obtenir les bacs actifs de la vague |

### 2.3 API Routes — fichiers impactés

#### `src/app/api/bacs/route.ts`

| Ligne | Changement requis |
|-------|-------------------|
| 35-38 | `prisma.bac.findMany({ where: { vagueId } })` → `prisma.assignationBac.findMany({ where: { vagueId, dateFin: null, siteId }, include: { bac: true } })` |
| 39-52 | Le mapping doit lire `nombrePoissons` depuis l'assignation, pas depuis le bac |
| 55 | `getBacsLibres()` — voir transformation dans queries/bacs.ts |

#### `src/app/api/vagues/route.ts`

| Ligne | Changement requis |
|-------|-------------------|
| 49 | `nombreBacs: v._count.bacs` → `nombreBacs: v._count.assignations` (avec le filtre `dateFin: null`) |
| 219-222 | `bacs.filter((b) => b.vagueId !== null)` → vérification via AssignationBac |
| 244-253 | `tx.bac.update({ data: { vagueId, nombrePoissons, ... } })` → `tx.assignationBac.create(...)` |

#### `src/app/api/vagues/[id]/route.ts`

| Ligne | Changement requis |
|-------|-------------------|
| 44 | `bacs: vague.bacs` → `bacs: vague.assignations.map(a => a.bac)` (ou adapter la structure) |

### 2.4 Composants UI — fichiers impactés

#### `src/components/bacs/bacs-list-client.tsx`

| Ligne | Changement requis |
|-------|-------------------|
| 189 | `const isOccupe = bac.vagueId !== null` → `const isOccupe = bac.assignationActive !== null` (ou propriété calculée dans le DTO) |
| 206-209 | Lecture de `bac.vagueCode` — inchangé si le DTO conserve cette propriété calculée |

#### `src/components/vagues/gerer-bacs-dialog.tsx`

| Ligne | Changement requis |
|-------|-------------------|
| 119 | `bac.nombrePoissons ?? 0` — reste fonctionnel si `BacResponse` expose toujours `nombrePoissons` depuis l'assignation active |
| 66 | `useBacsLibres()` — continue de fonctionner si l'API est adaptée |

#### `src/components/releves/releve-form-client.tsx`

Aucun impact direct si les DTOs BacResponse et VagueWithBacs sont adaptés correctement.
Le formulaire utilise `bacId` et `vagueId` comme identifiants purs — ces identifiants ne
changent pas.

### 2.5 Types TypeScript — fichiers impactés

#### `src/types/models.ts`

| Lignes | Changement requis |
|--------|-------------------|
| 433-459 | Interface `Bac` : retirer `vagueId`, `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial` ; ajouter `assignationActive?: AssignationBac | null` |
| 461-463 | `BacWithVague` → `BacWithAssignation` |
| 732 | Autres interfaces avec `vagueId: string | null` sur Bac |
| 1292 | Autre interface avec `vagueId: string | null` |
| 1728 | Idem |

Nouvelle interface à créer :

```typescript
export interface AssignationBac {
  id: string;
  bacId: string;
  vagueId: string;
  dateAssignation: Date;
  dateFin: Date | null;
  nombrePoissonsInitial: number;
  poidsMoyenInitial: number;
  nombrePoissons: number | null;
  notes: string | null;
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `src/types/models.ts` — BacResponse

Le DTO `BacResponse` (ligne ~732) qui est retourné par l'API doit continuer à exposer
`vagueId` et `vagueCode` comme propriétés calculées depuis l'assignation active, pour
éviter de casser les composants UI consommateurs.

**Stratégie de compatibilité descendante :** les DTOs API peuvent maintenir les mêmes
champs `vagueId`, `vagueCode`, `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial`
calculés depuis `AssignationBac` active — les composants ne voient aucun changement.

### 2.6 Services et hooks — fichiers impactés

#### `src/services/bac.service.ts`

Les lignes 18-20 construisent l'URL `?vagueId=...` — cela reste valide car le endpoint
s'adapte côté serveur.

#### `src/services/vague.service.ts`

Ligne 94-95 : `GET /api/bacs?vagueId=...` — continue de fonctionner.

### 2.7 Moteur d'activités et alertes — fichiers impactés

#### `src/lib/activity-engine/orchestrator.ts`

| Ligne | Changement requis |
|-------|-------------------|
| 39 | `where: { vagueId: { not: null } }` sur `bac.findMany` → `AssignationBac.findMany({ where: { dateFin: null } })` |
| 138 | Le type `vagueId: string | null` reste sur la structure interne |

#### `src/lib/queries/analytics.ts` — `getIndicateursBac` (ligne 188-192)

Le champ `nombreInitial` du bac est utilisé pour calculer les indicateurs. Après migration,
cette valeur doit être lue depuis `AssignationBac.nombrePoissonsInitial` pour la vague
demandée — ce qui est plus précis qu'actuellement (où `nombreInitial` sur Bac est la valeur
de la dernière vague, pas nécessairement celle demandée).

### 2.8 Calibrage — fichiers impactés

#### `src/lib/queries/calibrages.ts`

Le calibrage lit intensivement `bac.nombrePoissons` pour :
- Vérifier que le bac source a des poissons
- Calculer la conservation de la masse totale
- Mettre à jour les compteurs post-calibrage

Toutes ces lectures de `bac.nombrePoissons` devront lire depuis `AssignationBac.nombrePoissons`
(filtre `{ vagueId: calibrage.vagueId, dateFin: null }`). Les écritures de
`tx.bac.update({ data: { nombrePoissons: X } })` devront devenir
`tx.assignationBac.update({ where: { bacId, vagueId, dateFin: null }, data: { nombrePoissons: X } })`.

**Point critique :** le calibrage a une transaction atomique complexe. La modification de la
source de vérité de `nombrePoissons` de `Bac` vers `AssignationBac` est le changement le plus
risqué de toute la migration.

---

## Partie 3 — Analyse des bénéfices

### 3.1 Simplification de la logique (problèmes existants résolus)

#### Le problème des bacs orphelins (ADR-041) disparaît

**Avant (ADR-041) :** quand un bac est retiré d'une vague (calibration → `vagueId = null`),
il n'apparaît plus dans `GET /api/bacs?vagueId=XXX`, ce qui oblige à l'endpoint de contournement
`GET /api/bacs/by-vague-releves`. Ce contournement est une cicatrice architecturale.

**Après (AssignationBac) :** la question "quels bacs ont été dans cette vague ?" se répond via
`AssignationBac.findMany({ where: { vagueId } })` sans filtre sur `dateFin`. L'endpoint
`by-vague-releves` devient inutile. Le sélecteur de filtre relevés peut directement requêter
les assignations historiques. La cicatrice disparaît.

#### La vérification "bac libre" est plus robuste

**Avant :** `bac.vagueId !== null` — une race condition théorique existe si deux transactions
parallèles lisent `vagueId = null` avant que l'une n'ait écrit. L'`updateMany` atomique dans
`assignerBac()` (lignes 110-119) protège contre ça, mais c'est fragile.

**Après :** l'index unique partiel `ON AssignationBac(bacId) WHERE dateFin IS NULL` rend la
contrainte garantie par PostgreSQL. Aucune logique applicative de protection nécessaire.

#### La clôture de vague ne détruit plus d'information

**Avant :** `cloturerVague` met `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial` à null
sur tous les bacs (fix ADR-024). L'effectif final de chaque bac disparaît du modèle Bac.

**Après :** `cloturerVague` pose `dateFin: new Date()` sur chaque `AssignationBac` et peut
snapshoter `nombrePoissons` au moment de la clôture. L'effectif final par bac par vague est
conservé indéfiniment et consultable.

### 3.2 Nouvelles fonctionnalités activées

#### Historique complet d'un bac

```typescript
// "Dans quelles vagues ce bac a-t-il été utilisé ?"
const historique = await prisma.assignationBac.findMany({
  where: { bacId, siteId },
  orderBy: { dateAssignation: 'desc' },
  include: { vague: { select: { code: true, dateDebut: true, dateFin: true } } },
});
```

Cette requête est impossible aujourd'hui sans fouiller les relevés.

#### Historique complet d'une vague

```typescript
// "Quels bacs ont été utilisés dans cette vague, y compris les retraits ?"
const historique = await prisma.assignationBac.findMany({
  where: { vagueId, siteId },
  orderBy: { dateAssignation: 'asc' },
  include: { bac: { select: { nom: true } } },
});
```

#### Effectif initial par bac pour n'importe quelle vague passée

Aujourd'hui `computeIndicateursBac()` (analytics.ts ligne 77) utilise un fallback
`Math.round(nombreInitialVague / totalBacsVague)` pour les bacs sans `nombreInitial`.
Avec `AssignationBac.nombrePoissonsInitial`, la valeur exacte est toujours disponible,
même pour des vagues terminées il y a 2 ans.

#### Durée de présence d'un bac dans une vague

```typescript
const duree = assignation.dateFin
  ? assignation.dateFin.getTime() - assignation.dateAssignation.getTime()
  : Date.now() - assignation.dateAssignation.getTime();
```

Cette métrique était impossible à calculer sans les relevés.

### 3.3 Optimisations de requêtes

#### Comptage des bacs occupés (dashboard)

**Avant** (dashboard.ts ligne 67) :
```typescript
prisma.bac.count({ where: { siteId, vagueId: { not: null } } })
```
Scan de la table `Bac` complète.

**Après** :
```typescript
prisma.assignationBac.count({ where: { siteId, dateFin: null } })
```
Utilise l'index `@@index([siteId])` sur une table plus petite (une ligne par assignation
active, pas une ligne par bac).

#### Sélecteur de bacs de la vague dans le formulaire relevé

**Avant** : `GET /api/bacs?vagueId=XXX` → scan `Bac WHERE vagueId = XXX`.

**Après** : `AssignationBac WHERE vagueId = XXX AND dateFin IS NULL` → index `@@index([vagueId, dateFin])` ultra-rapide.

#### Nombre de poissons par bac pré-stocké, non recalculé

**Avant** : certains indicateurs recalculent l'effectif depuis les relevés COMPTAGE et
MORTALITE (fallback dans `computeIndicateursBac`). Le champ `bac.nombrePoissons` agit comme
cache opérationnel, mais il peut dériver des relevés.

**Après** : `AssignationBac.nombrePoissonsInitial` est immuable et exact. `AssignationBac.nombrePoissons`
est mis à jour par les mêmes opérations (calibrage, ventes) — même logique, même fiabilité,
mais scopée proprement à une (vague, bac) paire.

### 3.4 Correction de bugs existants

#### Bug : effectif résiduel sur bac libre (ADR-024, problème 2)

**Avant :** entre clôture et réassignation, `bac.nombrePoissons` conserve une valeur résiduelle
(ex: 320) même si `vagueId = null`. Trompeur sur la page des bacs.

**Après :** un bac libre n'a aucune `AssignationBac` active → `nombrePoissons` n'est pas
exposé comme attribut du bac lui-même, éliminant la confusion à la source.

#### Bug : indicateurs per-bac incorrects pour vagues terminées

**Avant :** `getIndicateursVague` charge `vague.bacs` via la relation Prisma. Pour une vague
terminée, les bacs ont `vagueId = null`, donc la relation est vide. Les indicateurs per-bac
tombent dans le fallback global (ADR-024 section "Note importante").

**Après :** `vague.assignations` (sans filtre `dateFin`) retourne tous les bacs historiques
de la vague. Les indicateurs per-bac sont calculables même pour les vagues terminées.

#### Bug potentiel : perte de `nombreInitial` lors de réassignation multiple

**Avant :** si Bac-1 est utilisé en Vague A, puis en Vague B, `Bac.nombreInitial` contient
uniquement la valeur de Vague B. L'analyse rétrospective de Vague A utilise un fallback
uniforme.

**Après :** `AssignationBac` pour Vague A contient `nombrePoissonsInitial = 500` et pour
Vague B `nombrePoissonsInitial = 300`, indépendamment et pour toujours.

---

## Partie 4 — Stratégie de migration

### 4.1 Vue d'ensemble

La migration doit se faire en trois phases :

```
Phase 1 : Créer AssignationBac (backward compatible)
Phase 2 : Migrer les données existantes
Phase 3 : Retirer Bac.vagueId et champs associés
```

Phases 1 et 2 peuvent être déployées en production sans downtime. Phase 3 est un breaking
change et nécessite un déploiement coordonné.

### 4.2 Phase 1 — Ajout du modèle (non-breaking)

**Migration SQL :**

```sql
-- Créer la table AssignationBac
CREATE TABLE "AssignationBac" (
    "id"                      TEXT NOT NULL,
    "bacId"                   TEXT NOT NULL,
    "vagueId"                 TEXT NOT NULL,
    "dateAssignation"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin"                 TIMESTAMP(3),
    "nombrePoissonsInitial"   INTEGER NOT NULL,
    "poidsMoyenInitial"       DOUBLE PRECISION NOT NULL,
    "nombrePoissons"          INTEGER,
    "notes"                   TEXT,
    "siteId"                  TEXT NOT NULL,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignationBac_pkey" PRIMARY KEY ("id")
);

-- Index de performance
CREATE INDEX "AssignationBac_bacId_idx" ON "AssignationBac"("bacId");
CREATE INDEX "AssignationBac_vagueId_idx" ON "AssignationBac"("vagueId");
CREATE INDEX "AssignationBac_siteId_idx" ON "AssignationBac"("siteId");
CREATE INDEX "AssignationBac_bacId_dateFin_idx" ON "AssignationBac"("bacId", "dateFin");
CREATE INDEX "AssignationBac_vagueId_dateFin_idx" ON "AssignationBac"("vagueId", "dateFin");

-- FK
ALTER TABLE "AssignationBac" ADD CONSTRAINT "AssignationBac_bacId_fkey"
    FOREIGN KEY ("bacId") REFERENCES "Bac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignationBac" ADD CONSTRAINT "AssignationBac_vagueId_fkey"
    FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignationBac" ADD CONSTRAINT "AssignationBac_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contrainte d'unicité partielle (un seul bac actif à la fois)
CREATE UNIQUE INDEX "AssignationBac_bacId_active_unique"
    ON "AssignationBac"("bacId") WHERE "dateFin" IS NULL;
```

**À ce stade :** `Bac.vagueId` est conservé. Le nouveau modèle coexiste.

### 4.3 Phase 2 — Migration des données existantes

**Bacs actuellement assignés (vagueId non null) :**

```sql
-- Créer une AssignationBac active pour chaque bac actuellement dans une vague
INSERT INTO "AssignationBac" (
    "id", "bacId", "vagueId", "dateAssignation",
    "nombrePoissonsInitial", "poidsMoyenInitial", "nombrePoissons",
    "siteId", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    b."id",
    b."vagueId",
    -- dateAssignation = dateDebut de la vague (meilleure approximation disponible)
    v."dateDebut",
    -- nombrePoissonsInitial = nombreInitial du bac si disponible, sinon nombrePoissons
    COALESCE(b."nombreInitial", b."nombrePoissons", 0),
    -- poidsMoyenInitial = depuis le bac si disponible, sinon depuis la vague
    COALESCE(b."poidsMoyenInitial", v."poidsMoyenInitial"),
    -- nombrePoissons courant = depuis le bac
    b."nombrePoissons",
    b."siteId",
    NOW(),
    NOW()
FROM "Bac" b
JOIN "Vague" v ON v."id" = b."vagueId"
WHERE b."vagueId" IS NOT NULL;
```

**Bacs libres avec résidu (vagueId null mais nombrePoissons non null) :**

Ces bacs ont des stale values. On ne peut pas reconstruire leur historique exact sans
fouiller les relevés (trop complexe pour une migration). On crée des AssignationBac
TERMINÉES approximatives :

```sql
-- Pour chaque bac libre avec résidu, retrouver la dernière vague via les relevés
-- Note : cette migration est optionnelle et peut être sautée pour les vagues terminées
-- dont l'historique exact n'est pas critique.

-- Option simple : ignorer les bacs libres (leur histoire survit dans les relevés)
-- Option complète : script Python/Node séparé qui reconstruit les assignations depuis
--   les relevés COMPTAGE et l'ordre chronologique des vagues.
```

**Recommandation :** pour la migration initiale, traiter uniquement les bacs actuellement
assignés (Phase 2a). Les bacs libres avec résidu auront leur historique dans les relevés.
Un script de reconstruction optionnel peut être écrit séparément.

### 4.4 Phase 3 — Retrait des champs obsolètes (breaking)

**Ordre des opérations :**

1. Déployer les nouvelles versions de toutes les queries et API routes qui lisent depuis
   `AssignationBac` au lieu de `Bac.vagueId`
2. Valider en staging que tous les tests passent
3. En production, effectuer le déploiement applicatif
4. Exécuter la migration SQL de retrait :

```sql
-- Phase 3a : retirer les champs de Bac
ALTER TABLE "Bac" DROP COLUMN "vagueId";
ALTER TABLE "Bac" DROP COLUMN "nombrePoissons";
ALTER TABLE "Bac" DROP COLUMN "nombreInitial";
ALTER TABLE "Bac" DROP COLUMN "poidsMoyenInitial";

-- Phase 3b : retirer l'index devenu inutile
DROP INDEX IF EXISTS "Bac_vagueId_idx";
```

### 4.5 Données de seed à mettre à jour

**`prisma/seed.sql`** — ajouter les `INSERT INTO "AssignationBac"` pour les bacs de seed
actuellement assignés. Les bacs seed assignés à une vague doivent avoir une AssignationBac
correspondante avec `dateFin = null`.

### 4.6 Tests à créer avant migration

Avant d'exécuter Phase 3, les tests suivants doivent passer :

- `createVague` crée bien une `AssignationBac` par bac avec `dateFin = null`
- `cloturerVague` pose `dateFin` sur toutes les assignations actives de la vague
- `getBacsLibres` retourne uniquement les bacs sans assignation active
- `assignerBac` échoue si une assignation active existe déjà (contrainte DB)
- `getIndicateursBac` fonctionne pour une vague terminée (bacs via assignations historiques)
- L'effectif par bac est correct après calibrage (lit depuis `AssignationBac.nombrePoissons`)

---

## Résumé des fichiers à modifier (Phase 3)

### Couche DB / Schéma

| Fichier | Modification |
|---------|-------------|
| `prisma/schema.prisma` | Ajouter `AssignationBac`, retirer `Bac.vagueId` + 3 champs |
| Migration SQL Phase 1 | `CREATE TABLE AssignationBac` + index + FK + contrainte unique partielle |
| Migration SQL Phase 2 | `INSERT INTO AssignationBac` depuis bacs assignés actuels |
| Migration SQL Phase 3 | `ALTER TABLE Bac DROP COLUMN vagueId` + 3 champs |
| `prisma/seed.sql` | Ajouter données `AssignationBac` |

### Couche Queries

| Fichier | Impact |
|---------|--------|
| `src/lib/queries/bacs.ts` | Majeur — toutes les fonctions |
| `src/lib/queries/vagues.ts` | Majeur — createVague, cloturerVague, updateVague |
| `src/lib/queries/releves.ts` | Modéré — vérification bac appartient à vague |
| `src/lib/queries/calibrages.ts` | Majeur — toutes les lectures/écritures de nombrePoissons |
| `src/lib/queries/analytics.ts` | Modéré — computeIndicateursBac, getIndicateursBac |
| `src/lib/queries/dashboard.ts` | Mineur — comptage bacs occupés (ligne 67) |
| `src/lib/queries/lots-alevins.ts` | Modéré — transfererLotVersVague (ligne 231) |
| `src/lib/queries/ventes.ts` | Mineur — vérification bacs actifs vague |

### Couche API

| Fichier | Impact |
|---------|--------|
| `src/app/api/bacs/route.ts` | Modéré — route GET avec vagueId param |
| `src/app/api/vagues/route.ts` | Modéré — POST createVague |
| `src/app/api/vagues/[id]/route.ts` | Mineur — adaptation du shape de réponse |
| `src/app/api/bacs/by-vague-releves/route.ts` | Supprimable après migration (ADR-041 workaround) |

### Couche Types

| Fichier | Impact |
|---------|--------|
| `src/types/models.ts` | Modéré — interface Bac, BacResponse, nouvelle AssignationBac |

### Couche UI / Composants

| Fichier | Impact |
|---------|--------|
| `src/components/bacs/bacs-list-client.tsx` | Mineur — si BacResponse conserve `vagueId` calculé |
| `src/components/vagues/gerer-bacs-dialog.tsx` | Aucun — si l'API reste compatible |
| `src/components/releves/releve-form-client.tsx` | Aucun — utilise bacId/vagueId purs |

### Moteur d'activités

| Fichier | Impact |
|---------|--------|
| `src/lib/activity-engine/orchestrator.ts` | Modéré — lecture des bacs actifs par vague |

---

## Risques et mitigations

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Régression calibrage (nombrePoissons) | Haute | Tests unitaires obligatoires avant Phase 3 |
| Performance dégradée (jointure AssignationBac) | Moyenne | Index `@@index([vagueId, dateFin])` couvre le cas principal |
| Migration données incomplète pour bacs historiques | Faible | Documenter que l'historique pré-migration est dans les relevés |
| Contrainte unique partielle non supportée par Prisma migrate | Moyenne | Migration manuelle SQL + `prisma migrate deploy` |

---

## Alternatives rejetées

### Statu quo (ADR-024 Option A)

Déjà appliqué. Insuffisant face aux problèmes d'ADR-041 et à l'absence d'historique natif.

### BacSnapshot (ADR-024 Option C)

Table en lecture seule à la clôture uniquement. Ne résout pas l'absence d'historique
pour les retraits intermédiaires de bacs, ni le problème des bacs orphelins dans les filtres.

---

## Critères de succès

- [ ] `AssignationBac` créé dans `prisma/schema.prisma` avec la contrainte unique partielle
- [ ] Données existantes migrées (bacs actuellement assignés)
- [ ] Tous les tests `npx vitest run` passent après Phase 2
- [ ] `npm run build` passe après Phase 2
- [ ] `getBacsLibres` ne retourne aucun bac avec une assignation active
- [ ] `cloturerVague` pose `dateFin` sur les assignations et preserve `nombrePoissons` final
- [ ] L'historique d'un bac est consultable via `AssignationBac` sans fouiller les relevés
- [ ] L'endpoint `by-vague-releves` est marqué deprecated (supprimable après validation)
- [ ] `npm run build` + `npx vitest run` passent après Phase 3

---

## Partie 5 — Nouvelles fonctionnalités UI

Cette partie décrit les composants, pages et endpoints à créer pour exploiter les données
exposées par `AssignationBac`. Toutes les UI suivent l'approche **mobile first (360px)**
avec des cartes empilées à la place de tableaux sur mobile.

---

### 5.1 Feature 1 — Historique des assignations sur la page Bac Detail

#### Contexte actuel

Il n'existe pas de page de détail dédiée pour un bac dans le parcours principal `/bacs`.
La page `/analytics/bacs/[bacId]?vagueId=XXX` (`src/app/analytics/bacs/[bacId]/page.tsx`)
est la seule vue de détail, mais elle est scopée à une vague spécifique via `searchParams`.

La liste des bacs (`src/app/(farm)/bacs/page.tsx`) affiche uniquement des cartes de synthèse
sans lien vers une page de détail.

#### Nouvelles pages à créer

**`src/app/(farm)/bacs/[id]/page.tsx`** — Page de détail d'un bac (Server Component)

Cette page charge le bac par son `id` et son `siteId` de session, puis liste toutes ses
assignations historiques via `AssignationBac`.

**`src/components/pages/bac-detail-page.tsx`** — Composant page (Server Component, même
patron que `vague-detail-page.tsx`)

#### Nouvelle section UI : Historique des assignations

La section se positionne sous les informations générales du bac (nom, volume, type de
système). Sur mobile, elle occupe toute la largeur en cartes empilées. Sur desktop (md+),
les cartes passent en grille 2 colonnes.

**Structure d'une carte d'assignation (mobile first) :**

```
+----------------------------------------------+
| BADGE: "Active" (vert) ou "Terminée" (gris)  |
| Vague: VAG-2025-01  [lien vers /vagues/{id}] |
| Du: 15 jan. 2025  →  20 fév. 2025 (36 jours) |
|     ou "En cours depuis 36 jours"             |
| Poissons: 500 → 463                           |
|     ou "500 → non renseigné" si dateFin=null  |
+----------------------------------------------+
```

Tri par `dateAssignation` décroissant (la plus récente en premier).

Le badge "Active" s'affiche uniquement si `dateFin IS NULL` (assignation en cours).
Le badge "Terminée" s'affiche si `dateFin IS NOT NULL`.

La durée est calculée côté serveur :
- Si `dateFin` existe : `Math.round((dateFin - dateAssignation) / 86400000)` jours
- Si active : `Math.round((now - dateAssignation) / 86400000)` jours + mention "En cours"

Le lien sur le code vague pointe vers `/vagues/{vagueId}`.

**Cas vide :** si aucune `AssignationBac` n'existe pour ce bac, afficher un `EmptyState`
avec le message "Ce bac n'a encore été utilisé dans aucune vague."

#### Nouveau composant à créer

**`src/components/bacs/bac-assignation-history.tsx`** — Server Component

Props :
```typescript
interface BacAssignationHistoryProps {
  assignations: AssignationBacWithVague[];
}

interface AssignationBacWithVague {
  id: string;
  vagueId: string;
  vagueCode: string;
  dateAssignation: Date;
  dateFin: Date | null;
  nombrePoissonsInitial: number;
  nombrePoissons: number | null; // effectif final (au moment de dateFin ou courant)
  dureeJours: number;            // calculé côté serveur
  isActive: boolean;             // dateFin === null
}
```

Ce composant n'a pas besoin de `"use client"` — il reçoit les données sérialisées depuis
la page Server Component.

#### Endpoint API à créer

**`GET /api/bacs/[id]/assignations`**

Paramètres : aucun (le `siteId` est lu depuis la session).

Réponse :
```typescript
interface AssignationsResponse {
  assignations: AssignationBacWithVague[];
  total: number;
}
```

Query Prisma :
```typescript
prisma.assignationBac.findMany({
  where: { bacId: id, siteId },
  orderBy: { dateAssignation: 'desc' },
  include: {
    vague: { select: { code: true } },
  },
});
```

Ce endpoint n'est pas nécessaire pour la page Server Component (qui charge directement
depuis Prisma), mais il est utile si un composant client veut recharger les données
(ex: après un retrait de bac depuis `GererBacsDialog`).

---

### 5.2 Feature 2 — Historique complet des bacs sur la page Vague Detail

#### Contexte actuel

La page vague detail (`src/components/pages/vague-detail-page.tsx`) charge `vague.bacs`
via `getVagueById()`. Après migration vers AssignationBac, `vague.bacs` retournera
uniquement les bacs avec `dateFin IS NULL` (bacs actifs). Les bacs retirés en cours
de vague (ex: après un calibrage) ne sont plus visibles.

La section d'information actuelle (lignes 269-275) affiche les bacs actifs sous la forme
d'une liste inline : `"(Bac-A, Bac-B)"`.

#### Nouvelle section UI : Tous les bacs de la vague

Après la section d'informations générales et avant les indicateurs, ajouter une section
"Bacs" qui distingue bacs actifs et bacs retirés.

**Structure sur mobile (cartes empilées) :**

Section "Bacs actifs" :
```
+--------------------------------------+
| Bac-A                   ACTIF (vert) |
| Depuis: 15 jan. 2025 (36 jours)      |
| Poissons actuels: 463                |
+--------------------------------------+
| Bac-B                   ACTIF (vert) |
| Depuis: 15 jan. 2025 (36 jours)      |
| Poissons actuels: 512                |
+--------------------------------------+
```

Section "Bacs retirés" (masquée par défaut, révélée par un Radix UI Collapsible) :
```
[ Voir les bacs retirés (2) ▾ ]

+----------------------------------------------+
| Bac-C                     RETIRÉ (gris, dim) |
| Du: 15 jan. → 02 fév. 2025 (18 jours)        |
| Poissons: 200 → 187 (transférés vers Bac-A)  |
+----------------------------------------------+
```

Les cartes "Retirées" ont une apparence atténuée : `opacity-60` + bord en pointillés
(`border-dashed`). Elles ne sont pas supprimées visuellement mais clairement distinguées.

#### Nouveau composant à créer

**`src/components/vagues/vague-bacs-section.tsx`** — Server Component ou composant léger
client (Collapsible nécessite `"use client"`)

Props :
```typescript
interface VagueBacsSectionProps {
  assignations: AssignationBacForVague[];
  isVagueEnCours: boolean;
  permissions: Permission[];
  vagueId: string;
}

interface AssignationBacForVague {
  id: string;
  bacId: string;
  bacNom: string;
  dateAssignation: Date;
  dateFin: Date | null;
  nombrePoissonsInitial: number;
  nombrePoissons: number | null;
  dureeJours: number;
  isActive: boolean;
}
```

Utilise `@radix-ui/react-collapsible` pour le panneau "Bacs retirés". Le composant
`Collapsible` enveloppe uniquement la liste des bacs retirés, pas les bacs actifs.

Le bouton "Gérer les bacs" (qui ouvre `GererBacsDialog`) reste dans `VagueActionMenu`
pour les vagues en cours.

#### Modification de `vague-detail-page.tsx`

Remplacer la ligne inline des bacs actifs (lignes 269-275) par un appel à
`<VagueBacsSection assignations={...} ... />`.

La requête Prisma dans la page charge désormais toutes les assignations (sans filtre
`dateFin`) via un `include` sur `vague.assignations` dans `getVagueById()`.

---

### 5.3 Feature 3 — Timeline d'assignation des bacs sur la page Vague Detail

#### Concept

Un composant visuel de type "Gantt simplifié" montrant pour chaque bac une barre
horizontale couvrant la période d'assignation, alignée sur la durée totale de la vague.

Sur mobile (360px), la timeline doit être lisible sans scroll horizontal.
Approche recommandée : barres empilées verticalement, axe du temps horizontal avec
labels en jours relatifs (J0, J30, J60...).

#### Nouveau composant à créer

**`src/components/vagues/vague-bacs-timeline.tsx`** — Client Component (`"use client"`)

Utilise Recharts `ComposedChart` avec des barres empilées en mode horizontal (type gantt
simplifié), ou une implémentation SVG pure si Recharts ne supporte pas nativement le
format gantt.

**Alternative recommandée (plus simple et mobile-friendly) :**

CSS Grid avec `grid-template-columns` proportionnel à la durée totale de la vague.
Chaque bac est une ligne, chaque ligne contient une barre colorée dont la largeur et
le décalage sont calculés en pourcentage :

```
offset% = (dateAssignation - vagueDebut) / vagueduree * 100
width%  = (dateFin ?? now  - dateAssignation) / vagueduree * 100
```

Couleurs :
- Bac actif : `var(--primary)` (vert aqua du thème)
- Bac retiré : `var(--muted-foreground)` (gris)

Labels : nom du bac à gauche de chaque ligne (truncate sur mobile), durée en jours
dans la barre si la barre est assez large (>= 60px), sinon en tooltip Radix UI.

Props :
```typescript
interface VagueBacsTimelineProps {
  assignations: AssignationBacForVague[];
  vagueDebut: Date;
  vagueFin: Date | null; // null = vague encore en cours (fin = now)
}
```

Ce composant est optionnel sur mobile — il peut être masqué sur `max-sm` et affiché
uniquement sur `sm:block`. Les features 1 et 2 restent disponibles sur tous les formats.

#### Position dans la page

La timeline s'insère entre la section "Bacs" (Feature 2) et les indicateurs, uniquement
si la vague a au moins 2 bacs dans son historique.

---

### 5.4 Feature 4 — Durée de présence par bac dans la Vague Detail

#### Intégration dans la section Bacs (Feature 2)

La durée "X jours" est une propriété de `AssignationBacForVague.dureeJours` calculée
côté serveur dans la page ou dans une fonction utilitaire :

```typescript
// src/lib/calculs.ts — nouvelle fonction utilitaire
export function calculerDureeAssignation(
  dateAssignation: Date,
  dateFin: Date | null,
  now: Date = new Date()
): number {
  const fin = dateFin ?? now;
  return Math.round((fin.getTime() - dateAssignation.getTime()) / 86400000);
}
```

La durée est affichée dans chaque carte de bac (Feature 2) et dans chaque carte
d'historique de bac (Feature 1). Aucun composant UI dédié n'est nécessaire pour
cette feature — elle est absorbée par les composants des Features 1 et 2.

#### Durée dans la section Bacs actifs de la Vague Detail

Pour les bacs actifs d'une vague en cours, la durée s'affiche comme
"Depuis X jours" (calculé depuis `dateAssignation` jusqu'à now).

Pour les bacs d'une vague terminée, elle s'affiche comme "X jours au total" (calculé
depuis `dateAssignation` jusqu'à `dateFin` de l'assignation, qui correspond à la
clôture de la vague).

---

### 5.5 Flux de données — AssignationBac vers l'UI

```
prisma/schema.prisma
  AssignationBac (bacId, vagueId, dateAssignation, dateFin, nombrePoissonsInitial, nombrePoissons)
        |
        | Prisma queries (Server Components — pas de fetch client)
        |
  src/lib/queries/bacs.ts
    getBacWithAssignations(bacId, siteId)
      → include: { assignations: { include: { vague: { select: { code: true } } }, orderBy: { dateAssignation: 'desc' } } }
        |
        v
  src/components/pages/bac-detail-page.tsx  (Server Component)
    → calcule dureeJours, isActive pour chaque assignation
    → passe AssignationBacWithVague[] à BacAssignationHistory
        |
        v
  src/components/bacs/bac-assignation-history.tsx  (Server Component)
    → Rendu des cartes d'historique

  src/lib/queries/vagues.ts
    getVagueById(id, siteId)
      → include: { assignations: { include: { bac: { select: { nom: true } } } } }  (SANS filtre dateFin)
        |
        v
  src/components/pages/vague-detail-page.tsx  (Server Component)
    → calcule dureeJours, isActive pour chaque assignation
    → sépare assignations actives et retirées
    → passe AssignationBacForVague[] à VagueBacsSection + VagueBacsTimeline
        |
        v
  src/components/vagues/vague-bacs-section.tsx  (Client Component — Radix Collapsible)
    → Cartes bacs actifs + collapsible bacs retirés
  src/components/vagues/vague-bacs-timeline.tsx  (Client Component — CSS Grid ou Recharts)
    → Visualisation gantt simplifiée
```

---

### 5.6 Endpoints API à créer ou modifier

#### Nouveau : `GET /api/bacs/[id]/assignations`

**Fichier :** `src/app/api/bacs/[id]/assignations/route.ts`

**Usage :** optionnel pour rechargement client après actions (ex: retrait de bac).
La page Server Component charge directement depuis Prisma sans passer par ce route.

**Contrat :**
```
GET /api/bacs/{id}/assignations
Authorization: session cookie

Response 200:
{
  "assignations": [
    {
      "id": "clxxx",
      "vagueId": "clyyy",
      "vagueCode": "VAG-2025-01",
      "dateAssignation": "2025-01-15T00:00:00.000Z",
      "dateFin": "2025-02-20T00:00:00.000Z",
      "nombrePoissonsInitial": 500,
      "nombrePoissons": 463,
      "dureeJours": 36,
      "isActive": false
    }
  ],
  "total": 3
}

Response 403: { "error": "Accès refusé" }
Response 404: { "error": "Bac non trouvé" }
```

#### Modifié : `GET /api/bacs/[id]`

**Fichier :** `src/app/api/bacs/[id]/route.ts`

Ajouter optionnellement `assignationActive` dans la réponse si le consommateur le
demande via `?include=assignationActive`. Par défaut, le DTO `BacResponse` conserve
les champs calculés `vagueId`, `vagueCode`, `nombrePoissons` (compatibilité descendante
— voir section 2.5).

#### Modifié : `GET /api/vagues/[id]`

**Fichier :** `src/app/api/vagues/[id]/route.ts`

Enrichir la réponse avec un champ `assignations` (toutes les assignations, pas
uniquement les actives) si `?include=assignations` est présent dans la query string.
Cela évite de bloquer la page Server Component (qui charge directement depuis Prisma)
tout en ouvrant la porte à des consommateurs futurs (ex: page monitoring ingénieur).

**Contrat addition :**
```
GET /api/vagues/{id}?include=assignations

Response 200: {
  ...vagueExistante,
  "assignations": [
    {
      "bacId": "clxxx",
      "bacNom": "Bac-A",
      "dateAssignation": "2025-01-15T00:00:00.000Z",
      "dateFin": null,
      "nombrePoissonsInitial": 500,
      "nombrePoissons": 463,
      "dureeJours": 36,
      "isActive": true
    }
  ]
}
```

---

### 5.7 Résumé des fichiers à créer et modifier (UI + API)

#### Fichiers à créer

| Fichier | Type | Description |
|---------|------|-------------|
| `src/app/(farm)/bacs/[id]/page.tsx` | Server Component (page) | Page de détail d'un bac avec historique des assignations |
| `src/components/pages/bac-detail-page.tsx` | Server Component | Logique métier + rendu de la page bac detail |
| `src/components/bacs/bac-assignation-history.tsx` | Server Component | Section historique des assignations sur bac detail |
| `src/components/vagues/vague-bacs-section.tsx` | Client Component | Section bacs actifs + collapsible retirés sur vague detail |
| `src/components/vagues/vague-bacs-timeline.tsx` | Client Component | Gantt simplifié des assignations |
| `src/app/api/bacs/[id]/assignations/route.ts` | API Route | GET historique des assignations d'un bac |

#### Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/components/pages/vague-detail-page.tsx` | Remplacer la ligne inline des bacs par `<VagueBacsSection>` + `<VagueBacsTimeline>` |
| `src/components/bacs/bacs-list-client.tsx` | Ajouter un lien "Voir détail" sur chaque carte de bac pointant vers `/bacs/{id}` |
| `src/app/api/bacs/[id]/route.ts` | Optionnel : enrichir le DTO avec `assignationActive` |
| `src/app/api/vagues/[id]/route.ts` | Optionnel : ajouter `?include=assignations` |
| `src/lib/calculs.ts` | Ajouter `calculerDureeAssignation()` |
| `src/lib/queries/bacs.ts` | Ajouter `getBacWithAssignations()` |
| `src/lib/queries/vagues.ts` | Modifier `getVagueById()` pour inclure toutes les assignations (sans filtre dateFin) |

---

### 5.8 Règles d'implémentation pour ces composants

1. **Mobile first** : toutes les nouvelles sections sont conçues pour 360px d'abord.
   - Cartes empilées (`flex flex-col gap-3`), jamais de tableau (`<table>`).
   - La timeline (Feature 3) est masquée sur `max-sm` via `hidden sm:block`.

2. **Server Components par défaut** : `bac-assignation-history.tsx` et
   `bac-detail-page.tsx` sont Server Components — ils ne reçoivent pas d'état interactif.
   Seul `vague-bacs-section.tsx` et `vague-bacs-timeline.tsx` nécessitent `"use client"`
   (respectivement pour Radix Collapsible et les interactions de la timeline).

3. **Radix UI pour les interactions** :
   - `@radix-ui/react-collapsible` pour le panneau "Bacs retirés" dans `vague-bacs-section.tsx`.
   - `@radix-ui/react-tooltip` pour les labels de durée tronqués dans la timeline.
   - Les badges "Active" / "Terminée" utilisent le composant `Badge` existant
     (`src/components/ui/badge.tsx`) avec les variants `success` et `default`.

4. **Pas de doublon de données** : la durée `dureeJours` est calculée une seule fois,
   côté serveur dans la page Server Component, via `calculerDureeAssignation()`. Elle
   est passée serialisée aux composants enfants — aucun composant UI ne recalcule.

5. **Compatibilité descendante** : les composants existants (`GererBacsDialog`,
   `BacsListClient`, `RelevesList`) ne sont pas cassés. Ils continuent de recevoir les
   mêmes DTOs (avec `vagueId`, `vagueCode`, `nombrePoissons` calculés depuis
   l'assignation active — voir section 2.5).
