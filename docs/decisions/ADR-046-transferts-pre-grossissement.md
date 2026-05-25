# ADR-046 — Transferts inter-vagues : pré-grossissement vers grossissement

**Statut :** ACCEPTÉ
**Date :** 2026-05-25
**Auteur :** @architect
**Sprint :** PG (Pré-Grossissement)
**Dépend de :** ADR-043 (AssignationBac), ADR-015 (Calibrage — pattern clone + modification)

---

## Contexte

Le cycle d'élevage de silures comporte trois phases biologiques :

| Phase | Durée typique | Poids entrée | Poids sortie |
|-------|---------------|--------------|--------------|
| Alevinage | 3-4 sem | 0,1 g | 10 g |
| **Pré-grossissement** | 3-6 sem | 10 g | 15-20 g |
| Grossissement | 3-5 mois | 15-20 g | 500-1000 g |

Actuellement, le modèle `Vague` ne distingue pas ces phases. Un promoteur qui pratique le pré-grossissement crée manuellement une vague "fictive" puis saisit les données de démarrage à la main sur la vague de grossissement, perdant toute la traçabilité coûts/mortalité de la phase intermédiaire.

**Besoin :** modéliser la phase pré-grossissement comme une vague autonome, avec une opération de transfert traçable vers la vague de grossissement, et une option d'agrégation des coûts sur le cycle complet.

---

## Options envisagées

### Option 1 — Vague typée + transferts inter-vagues (retenue)

Ajout d'un enum `TypeVague` sur le modèle `Vague` existant, et d'un ensemble de modèles `Transfert` / `TransfertGroupe` / `TransfertModification` calqués sur le pattern Calibrage.

**Avantages :**
- Réutilise toute l'infrastructure existante (relevés, bacs, dépenses, alimentation, calibrages au sein de la vague)
- Multi-parent natif via `TransfertGroupe.vagueSourceId`
- Backward-compatible : tout l'existant reçoit `type = GROSSISSEMENT` via DEFAULT

**Inconvénients :**
- Ajoute des contraintes de direction au niveau API (non exprimables dans Prisma seul)

### Option 2 — Nouveau modèle PreGrossissement dédié (rejetée)

Un modèle séparé avec ses propres tables de relevés, bacs, dépenses.

**Raison du rejet :** duplication de toute la logique métier existante. Coût de maintenance prohibitif.

### Option 3 — Champ vagueParentId simple (rejetée)

Un seul champ `vagueParentId` sur `Vague`, pointant vers la vague source.

**Raison du rejet :** ne supporte pas les scénarios multi-source (deux vagues pré-grossissement vers une seule vague de grossissement). Pas de modélisation de l'opération de transfert elle-même (date, mortalité, poids moyen au transfert).

---

## Décision

**Option 1 retenue.** Les sections suivantes définissent les modèles, règles métier et contrats API.

---

## Modèle de données

### 1.1 Enum TypeVague

```prisma
enum TypeVague {
  PRE_GROSSISSEMENT
  GROSSISSEMENT
}
```

Ajouté sur `Vague` avec valeur par défaut :

```prisma
model Vague {
  // ... champs existants ...
  type TypeVague @default(GROSSISSEMENT)

  // Relations nouvelles
  transfertsSource      TransfertGroupe[] @relation("TransfertsSource")
  transfertsDestination TransfertGroupe[] @relation("TransfertsDestination")
}
```

### 1.2 Modèle Transfert (en-tête)

```prisma
model Transfert {
  id          String    @id @default(cuid())
  siteId      String
  site        Site      @relation(fields: [siteId], references: [id])

  date        DateTime  @default(now())
  notes       String?
  userId      String
  user        User      @relation(fields: [userId], references: [id])

  groupes     TransfertGroupe[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([siteId])
}
```

### 1.3 Modèle TransfertGroupe (ligne par vague source)

```prisma
model TransfertGroupe {
  id               String    @id @default(cuid())
  transfertId      String
  transfert        Transfert @relation(fields: [transfertId], references: [id], onDelete: Cascade)

  // Source
  vagueSourceId    String
  vagueSource      Vague     @relation("TransfertsSource", fields: [vagueSourceId], references: [id], onDelete: Restrict)
  bacSourceId      String?
  bacSource        Bac?      @relation("TransfertsBacSource", fields: [bacSourceId], references: [id])

  // Destination
  vagueDestId      String
  vagueDest        Vague     @relation("TransfertsDestination", fields: [vagueDestId], references: [id], onDelete: Restrict)
  bacDestId        String?
  bacDest          Bac?      @relation("TransfertsBacDest", fields: [bacDestId], references: [id])

  // Données du transfert
  nombrePoissons   Int
  poidsMoyenG      Float
  nombreMorts      Int       @default(0)

  // Snapshot pour modification rétroactive
  snapshotAvantModif Json?

  modifications    TransfertModification[]

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([vagueSourceId])
  @@index([vagueDestId])
  @@index([transfertId])
}
```

### 1.4 Modèle TransfertModification (traçabilité)

```prisma
model TransfertModification {
  id                 String          @id @default(cuid())
  transfertGroupeId  String
  transfertGroupe    TransfertGroupe @relation(fields: [transfertGroupeId], references: [id], onDelete: Cascade)

  userId             String
  user               User            @relation(fields: [userId], references: [id])
  raison             String
  snapshotAvant      Json
  snapshotApres      Json

  createdAt          DateTime        @default(now())
}
```

---

## Règles métier

### 2.1 Règles de direction (invariants stricts)

| Règle | Détail |
|-------|--------|
| **Direction unique** | Transfert SEULEMENT depuis `type=PRE_GROSSISSEMENT` vers `type=GROSSISSEMENT`. L'API rejette toute autre direction avec HTTP 422. |
| **Inter-type obligatoire** | Un transfert entre deux vagues du même type est interdit, même si les IDs diffèrent. |
| **Même site** | `vagueSource.siteId === vagueDest.siteId`. Transfert cross-site interdit. |
| **Statut source** | La vague source doit être `EN_COURS`. |
| **Statut destination** | La vague destination doit être `EN_COURS` (mode B) ou être créée dans la même transaction (mode A). |
| **Non-identité** | `vagueSourceId !== vagueDestId`. |

### 2.2 Modes de création

| Mode | Description |
|------|-------------|
| **Mode A — Nouvelle destination** | Le payload inclut `nouvelleVague: { nom, bacs[], ... }`. La vague GROSSISSEMENT est créée dans la même transaction atomique que le transfert. |
| **Mode B — Destination existante** | Le payload inclut `vagueDestId` d'une vague GROSSISSEMENT existante. La vague est incrémentée via recalcul pondéré. |

### 2.3 Recalcul pondéré (Mode B)

Quand un transfert incrémente une vague GROSSISSEMENT existante :

```typescript
const newNombreInitial =
  vagueDest.nombreInitial + groupe.nombrePoissons;

const newPoidsMoyenInitial =
  (vagueDest.nombreInitial * vagueDest.poidsMoyenInitial +
    groupe.nombrePoissons * groupe.poidsMoyenG) /
  newNombreInitial;

// Appliqué dans la transaction via prisma.vague.update(...)
```

Le champ `nombreActuel` de la vague destination est également mis à jour :
`nombreActuel += groupe.nombrePoissons`.

### 2.4 Vague GROSSISSEMENT vide (en attente)

Une vague GROSSISSEMENT peut être créée avec `nombreInitial = 0` et `poidsMoyenInitial = 0`, sans bacs assignés, statut `EN_COURS`. Elle attend un premier transfert pour recevoir ses poissons. Aucune validation ne bloque cette création.

### 2.5 Vidage partiel de la vague source

La vague PRE_GROSSISSEMENT reste `EN_COURS` tant que `nombreActuel > 0`. Elle peut faire l'objet de :
- Nouveaux transferts partiels vers d'autres vagues GROSSISSEMENT
- Ventes directes (via le module Ventes)
- Clôture manuelle si le promoteur décide d'arrêter

Le solde après transfert est calculé par l'API et mis à jour sur la vague source :
`vagueSource.nombreActuel -= groupe.nombrePoissons`.

### 2.6 Auto-création de relevés (pattern Calibrage étape 8)

Déclenchée à la fin de la transaction, pour chaque `TransfertGroupe` :

| Condition | Relevé créé |
|-----------|-------------|
| `nombreMorts > 0` | `Releve { type: MORTALITE, cause: AUTRE, notes: "Mortalité au transfert", vagueId: vagueSourceId }` |
| Toujours | `Releve { type: BIOMETRIE, poidsMoyen: poidsMoyenG, bacId: bacDestId ?? null, vagueId: vagueDestId }` |

### 2.7 Blocage de suppression

| Condition | Comportement |
|-----------|-------------|
| Vague a des `TransfertGroupe` en tant que source | `DELETE /api/vagues/[id]` → HTTP 409, message explicite |
| Vague a des `TransfertGroupe` en tant que destination | `DELETE /api/vagues/[id]` → HTTP 409, message explicite |

### 2.8 Modification rétroactive

- Toujours autorisée via `PATCH /api/transferts/groupes/[id]`
- Requiert un champ `raison: string` (non vide, obligatoire)
- L'API sauvegarde `snapshotAvantModif` sur `TransfertGroupe` avant modification
- Crée un enregistrement `TransfertModification` avec `snapshotAvant / snapshotApres`
- La transaction ré-exécute le recalcul pondéré et les auto-relevés

### 2.9 Atomicité (R4)

L'ensemble du processus de création d'un transfert est exécuté dans `prisma.$transaction` :

```typescript
prisma.$transaction([
  // 1. Créer Transfert (en-tête)
  // 2. Pour chaque groupe :
  //    2a. Créer TransfertGroupe
  //    2b. Clôturer AssignationBac source (dateFin = now)
  //    2c. Créer AssignationBac destination
  //    2d. Mettre à jour vagueSource.nombreActuel
  //    2e. Mettre à jour vagueDest.nombreInitial + poidsMoyenInitial (mode B)
  // 3. Créer vague destination si mode A
  // 4. Auto-créer Releve MORTALITE si nombreMorts > 0
  // 5. Auto-créer Releve BIOMETRIE par groupe
])
```

---

## Contrats API

### 3.1 POST /api/transferts — Créer un transfert

**Request body :**

Le champ `mode` (enum `ModeTransfert`) est le discriminateur de l'union :

```typescript
// Mode A : créer une nouvelle vague GROSSISSEMENT dans la même transaction
interface CreateTransfertModeADTO {
  mode: ModeTransfert.CREATE_NEW;
  nouvelleVague: {
    code: string;               // code unique (ex: "VAGUE-2024-001")
    dateDebut: string;          // ISO 8601
    poidsObjectifKg?: number | null;
    uniteProductionId?: string | null;
    notes?: string | null;
  };
  groupes: TransfertGroupeInputDTO[];
  notes?: string | null;
  date?: string;                // ISO 8601, défaut = now
}

// Mode B : vague GROSSISSEMENT existante
interface CreateTransfertModeBDTO {
  mode: ModeTransfert.USE_EXISTING;
  vagueDestId: string;          // doit être statut=EN_COURS, type=GROSSISSEMENT
  groupes: TransfertGroupeInputDTO[];
  notes?: string | null;
  date?: string;                // ISO 8601, défaut = now
}

interface TransfertGroupeInputDTO {
  vagueSourceId: string;
  bacSourceId?: string | null;
  bacDestId?: string | null;    // bac dans la vague destination
  nombrePoissons: number;
  poidsMoyenG: number;
  nombreMorts?: number;         // défaut 0
}

type CreateTransfertDTO = CreateTransfertModeADTO | CreateTransfertModeBDTO;
```

> **Note** : `nouvelleVague` utilise `code` (identifiant unique d'une vague, R1) et non `nom`.
> Il n'y a pas de champ `bacIds` dans `nouvelleVague` : les bacs destination sont implicitement
> déduits de l'union des `bacDestId` distincts fournis dans les groupes. La nouvelle vague
> se voit assigner ces bacs au sein de la transaction atomique.

**Réponse 201 :**

```typescript
interface TransfertResponse {
  id: string;
  date: string;
  notes: string | null;
  vagueDest: {
    id: string;
    nom: string;
    nombreInitial: number;
    poidsMoyenInitial: number;
  };
  groupes: TransfertGroupeResponse[];
  relevesCrees: { id: string; type: string }[];
}
```

**Erreurs :**

| Code | Condition |
|------|-----------|
| 400 | `groupes` vide, `nombrePoissons <= 0`, `raison` manquante (PATCH) |
| 409 | Direction invalide, même site non respecté, statut vague incorrect |
| 422 | Transfert entre mêmes types, source = destination |

### 3.2 GET /api/transferts — Liste des transferts du site

Query params : `?vagueId=`, `?type=source|destination`, `?page=`, `?limit=`

### 3.3 GET /api/transferts/[id] — Détail

Inclut `groupes`, `modifications`, relations `vagueSource`, `vagueDest`.

### 3.4 PATCH /api/transferts/groupes/[groupeId] — Modifier un groupe

```typescript
interface PatchTransfertGroupeDTO {
  raison: string;           // obligatoire
  nombrePoissons?: number;
  poidsMoyenG?: number;
  nombreMorts?: number;
  bacDestId?: string;
}
```

### 3.5 GET /api/vagues/[id]/lineage — Arbre généalogique

Retourne la chaîne de vagues parentes (récursif, N niveaux) avec les ratios d'imputation.

---

## Rapports avec toggle `?includeParents=true`

S'applique aux deux endpoints PDF existants :
- `GET /api/export/vague/[id]` (rapport général)
- `GET /api/export/cout-production/[id]` (rapport coût)

### 4.1 Imputation proportionnelle des coûts parents

Pour chaque `TransfertGroupe` entrant (depuis une vague parente) :

```typescript
const ratio = groupe.nombrePoissons / parentVague.nombreInitial;
const coutParentImpute = parentCoutTotal * ratio;
```

Récursif sur N niveaux : si la vague parente a elle-même des parents, on remonte jusqu'à la racine. Chaque niveau calcule son propre ratio avant de propager.

### 4.2 Rapport général — Sections additionnelles

| Section | Contenu |
|---------|---------|
| "Origine des poissons" | Tableau des vagues sources avec date, nombre transféré, poids moyen au transfert |
| "KPIs cycle complet" | Durée depuis la vague la plus ancienne, poids initial réel (10 g), gain de poids cumulé |

### 4.3 Rapport coût — Sections additionnelles

| Section | Contenu |
|---------|---------|
| "Coûts pré-grossissement imputés" | Coûts parentaux × ratio, par poste (aliment, main-d'œuvre, etc.) |
| "Coût total cycle complet" | Somme coûts propres + coûts imputés |
| "ROI ajusté" | Recalculé sur la base du coût cycle complet |

---

## Permissions

Deux nouvelles valeurs à ajouter à l'enum `Permission` :

```prisma
enum Permission {
  // ... valeurs existantes ...
  TRANSFERTS_VOIR
  TRANSFERTS_CREER
  TRANSFERTS_MODIFIER
}
```

---

## Migration et compatibilité

| Aspect | Stratégie |
|--------|-----------|
| Backward compat | `Vague.type` avec `@default(GROSSISSEMENT)` — toutes les vagues existantes restent valides |
| Données existantes | Aucune migration de données nécessaire |
| Build cassant | Non — ajout de champs optionnels + nouveaux modèles uniquement |
| Enum PostgreSQL | Utiliser la stratégie RECREATE (ADR pattern migrations) pour `TypeVague` |

---

## Conséquences

### Positives

- Toute l'infrastructure existante (relevés, bacs, dépenses, alimentation, calibrages internes à la vague) fonctionne sans modification dans les vagues PRE_GROSSISSEMENT
- Multi-parent natif : une vague GROSSISSEMENT peut recevoir des poissons de plusieurs vagues PRE_GROSSISSEMENT sans surcoût schéma
- Le toggle `?includeParents=true` laisse le promoteur choisir entre vue phase isolée et vue lifecycle complet sur les rapports PDF
- Le modèle `Transfert` est isolé du `Calibrage` — concerns clairement séparés

### Négatives / points de vigilance

| Risque | Mitigation |
|--------|------------|
| Cycles si direction autorisée dans les deux sens à l'avenir | Contrainte stricte dans la couche API — jamais dans Prisma seul |
| Cohérence du ratio d'imputation sur vague partiellement vidée | Le ratio utilise `nombrePoissons transférés / parentNombreInitial`, pas le ratio temporel — documenté clairement dans l'UI |
| Rapport déjà émis invalidé par modification rétroactive | Afficher un bandeau d'avertissement dans l'UI et dans le PDF si des modifications existent post-émission |
| Récursivité N niveaux sur le lineage | Limiter à 5 niveaux max côté API (cas réel : 1-2 niveaux) avec erreur explicite si dépassé |

---

## Références

- ADR-015 — Pattern modification rétroactive (Calibrage)
- ADR-043 — Modèle associatif AssignationBac (clôture/création dans transaction)
- `docs/sprints/SPRINT-PRE-GROSSISSEMENT.md`
- Règle R4 (opérations atomiques), Règle R8 (siteId partout)
