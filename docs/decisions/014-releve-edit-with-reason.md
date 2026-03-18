# ADR-014 — Modification de relevé avec raison obligatoire et traçabilité

**Date :** 2026-03-18
**Statut :** ACCEPTEE
**Auteurs :** @architect
**Sprint :** 26

---

## Principe transversal d'audit — Raison obligatoire

> **Toute modification d'une donnée de production (relevé ou calibrage) requiert une raison explicite et obligatoire.**

Ce principe est commun à deux ADR :

| Ressource | ADR | Route |
|-----------|-----|-------|
| Relevé (`Releve`) | ADR-014 (ce document) | `PATCH /api/releves/[id]` |
| Calibrage (`Calibrage`) | [ADR-015](./015-calibrage-edit-with-reason.md) | `PATCH /api/calibrages/[id]` |

**Invariant :** sans `raison` (min 5 chars), l'API rejette la requête avec `400 Bad Request`. La raison est le premier champ visible dans les dialogs de modification — l'utilisateur formule l'intention avant de voir les champs à corriger.

**Pattern d'implémentation partagé :**
- Modèle de trace : une ligne par champ modifié (`champModifie`, `ancienneValeur`, `nouvelleValeur`)
- Flag `modifie Boolean @default(false)` sur la ressource principale
- Badge "Modifié" dans les listes (sans JOIN, grâce au flag)
- Ré-évaluation asynchrone des règles SEUIL_* après modification

---

## Contexte

Les relevés (Releve) sont des mesures critiques qui alimentent les indicateurs de production (FCR, SGR, taux de survie, biomasse). Une erreur de saisie non corrigeable est un frein réel pour les pisciculteurs. Actuellement :

- La route `PUT /api/releves/[id]` existe et utilise `Permission.RELEVES_MODIFIER`
- La fonction `updateReleve` dans `src/lib/queries/releves.ts` applique correctement un filtre par type de relevé
- **Mais :** aucune traçabilité — on ne sait pas qui a modifié quoi, ni pourquoi
- **Et :** le flag `modifie` n'existe pas sur le modèle — impossible de distinguer visuellement un relevé corrigé

L'audit est une exigence réglementaire implicite dans tout système de suivi piscicole professionnel. Ajouter une raison obligatoire et un historique des modifications transforme la fonctionnalité existante en outil fiable.

### Périmètre de l'existant à préserver

| Élément | Statut | Action |
|---------|--------|--------|
| `Permission.RELEVES_MODIFIER` | Existe déjà en DB + TS | Conserver, aucune migration nécessaire |
| `PUT /api/releves/[id]` | Implémentée | Enrichir : ajouter `raison` + appel `createReleveModification` |
| `updateReleve(siteId, userId, id, data)` | Implémentée | Étendre : ajouter paramètre `raison`, créer les traces |
| `ReleveFilters` | Existe dans `src/types/api.ts` | Étendre : ajouter filtre `modifie` |
| Route `PATCH /api/releves/[id]` | N'existe pas | Créer comme alternative sémantiquement correcte |

---

## Décisions

### 1. Schéma DB

#### 1a. Modifications du modèle `Releve`

Ajouter deux champs au modèle existant :

```prisma
model Releve {
  // ... champs existants inchangés ...

  // Traçabilité modification (Sprint 26)
  modifie         Boolean            @default(false)
  modifications   ReleveModification[]

  // ... createdAt, updatedAt, index existants inchangés ...
}
```

Le champ `modifie Boolean @default(false)` sert de flag rapide pour les listes (badge "Modifié") sans requête de jointure. Il est passé à `true` lors de la première modification et ne revient jamais à `false`.

#### 1b. Nouveau modèle `ReleveModification`

```prisma
model ReleveModification {
  id             String   @id @default(cuid())
  releveId       String
  releve         Releve   @relation(fields: [releveId], references: [id], onDelete: Cascade)
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  raison         String
  champModifie   String
  ancienneValeur String?
  nouvelleValeur String?
  siteId         String
  site           Site     @relation(fields: [siteId], references: [id])
  createdAt      DateTime @default(now())

  @@index([releveId])
  @@index([userId])
  @@index([siteId])
}
```

**Choix de granularité :** une ligne par champ modifié (pas une ligne par modification). Permet de rechercher l'historique d'un champ spécifique et de comparer facilement l'ancienne/nouvelle valeur dans l'UI.

**Cascade DELETE :** si un relevé est supprimé (futur), ses modifications sont supprimées aussi. Le relevé n'est jamais supprimé dans la v1 (pas de route DELETE), donc ce cas ne se produit pas encore.

**`ancienneValeur` / `nouvelleValeur` en String :** sérialisation JSON simple pour les valeurs numériques, enum values directes pour les enums. Évite les colonnes polymorphes complexes.

#### 1c. Migration Prisma

Fichier : `prisma/migrations/20260318250000_add_releve_modification/`

Stratégie SQL (sans ADD VALUE dans le même migration) :

```sql
-- Ajout du flag sur Releve
ALTER TABLE "Releve" ADD COLUMN "modifie" BOOLEAN NOT NULL DEFAULT false;

-- Nouveau modele ReleveModification
CREATE TABLE "ReleveModification" (
  "id"             TEXT NOT NULL,
  "releveId"       TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "raison"         TEXT NOT NULL,
  "champModifie"   TEXT NOT NULL,
  "ancienneValeur" TEXT,
  "nouvelleValeur" TEXT,
  "siteId"         TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReleveModification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReleveModification"
  ADD CONSTRAINT "ReleveModification_releveId_fkey"
    FOREIGN KEY ("releveId") REFERENCES "Releve"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ReleveModification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ReleveModification_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ReleveModification_releveId_idx" ON "ReleveModification"("releveId");
CREATE INDEX "ReleveModification_userId_idx" ON "ReleveModification"("userId");
CREATE INDEX "ReleveModification_siteId_idx" ON "ReleveModification"("siteId");
```

---

### 2. Permission

`Permission.RELEVES_MODIFIER` est **déjà défini** dans :
- `prisma/schema.prisma` (enum Permission)
- `src/types/models.ts` (enum TypeScript)
- `src/lib/permissions-constants.ts` (groupe `elevage`, route `PUT /api/releves/[id]`)

**Aucune nouvelle permission ne sera créée.** La fonctionnalité s'appuie sur `RELEVES_MODIFIER` existant.

#### Attribution par rôle système

| Rôle système | `RELEVES_MODIFIER` | Justification |
|---|---|---|
| Administrateur | Oui | Accès complet |
| Gérant | Oui | Gestion quotidienne |
| Pisciculteur | Non | Ne peut que créer |

Le rôle Pisciculteur n'a pas `RELEVES_MODIFIER` dans `SYSTEM_ROLE_DEFINITIONS` (fichier `src/lib/permissions-constants.ts`) — ce comportement est conservé tel quel.

---

### 3. API

#### 3a. Route principale : `PATCH /api/releves/[id]`

Nouveau fichier : `src/app/api/releves/[id]/route.ts` — ajouter un export `PATCH` aux côtés du `GET` et `PUT` existants.

La route `PUT` existante est conservée pour rétrocompatibilité mais dépréciée. La route `PATCH` est la nouvelle surface canonique pour les modifications avec traçabilité.

**Méthode HTTP :** `PATCH` (modification partielle) plutôt que `PUT` (remplacement complet). Sémantiquement plus correcte pour une mise à jour partielle.

##### Requête

```
PATCH /api/releves/{id}
Authorization: session cookie (requirePermission RELEVES_MODIFIER)
Content-Type: application/json
```

```typescript
// Corps de la requête
interface PatchReleveBody {
  // Raison obligatoire — min 5 caractères, max 500
  raison: string;

  // Champs modifiables (tous optionnels, au moins un requis)
  // Biométrie
  poidsMoyen?:       number;   // > 0
  tailleMoyenne?:    number;   // > 0
  echantillonCount?: number;   // entier > 0
  // Mortalité
  nombreMorts?:      number;   // entier >= 0
  causeMortalite?:   CauseMortalite;
  // Alimentation
  quantiteAliment?:  number;   // > 0
  typeAliment?:      TypeAliment;
  frequenceAliment?: number;   // entier > 0
  // Qualité eau
  temperature?:      number;
  ph?:               number;   // 0..14
  oxygene?:          number;   // >= 0
  ammoniac?:         number;   // >= 0
  // Comptage
  nombreCompte?:     number;   // entier >= 0
  methodeComptage?:  MethodeComptage;
  // Observation
  description?:      string;   // non vide
  // Commun
  notes?:            string | null;
  // Consommations (remplacement complet si fourni)
  consommations?:    { produitId: string; quantite: number }[];
}
```

##### Champs NON modifiables (rejetés avec 400)

```
id, vagueId, bacId, siteId, typeReleve, date, userId, createdAt
```

##### Réponse succès `200 OK`

```typescript
interface PatchReleveResponse {
  releve:        ReleveWithModifications;  // relevé mis à jour avec ses modifications
  modifications: ReleveModification[];     // les nouvelles traces créées pour cette opération
}
```

##### Réponses d'erreur

| Code | Condition |
|------|-----------|
| 400 | `raison` absente ou < 5 chars ; champ non modifiable envoyé ; aucun champ métier à modifier |
| 401 | Session expirée ou absente |
| 403 | `RELEVES_MODIFIER` absent des permissions |
| 404 | Relevé introuvable ou hors du site |
| 409 | Vague clôturée ; stock insuffisant |
| 500 | Erreur serveur |

#### 3b. Route GET existante — extension

`GET /api/releves/[id]` doit désormais inclure les modifications dans la réponse :

```typescript
// Ajout dans getReleveById :
include: {
  consommations: { include: { produit: true } },
  modifications: {
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  },
}
```

#### 3c. Route GET liste — filtre `modifie`

`GET /api/releves?modifie=true` — retourne uniquement les relevés modifiés.

---

### 4. Interfaces TypeScript

#### 4a. Nouveau modèle miroir `ReleveModification`

Fichier : `src/types/models.ts` — ajouter après l'interface `Releve` existante.

```typescript
/** Trace d'une modification de relevé avec raison d'audit */
export interface ReleveModification {
  id:             string;
  releveId:       string;
  userId:         string;
  raison:         string;
  champModifie:   string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  siteId:         string;
  createdAt:      Date;
}

/** ReleveModification avec l'utilisateur dénormalisé (pour affichage) */
export interface ReleveModificationWithUser extends ReleveModification {
  user: {
    id:   string;
    name: string;
  };
}
```

#### 4b. Extension de l'interface `Releve` existante

Fichier : `src/types/models.ts` — ajouter les deux champs sur l'interface `Releve` :

```typescript
// Ajouter dans l'interface Releve existante :
modifie:       boolean;
modifications?: ReleveModification[];
```

#### 4c. Nouvelles interfaces `WithRelations`

```typescript
/** Relevé avec consommations ET historique de modifications */
export interface ReleveWithModifications extends Releve {
  consommations: (ReleveConsommation & { produit: Produit })[];
  modifications: ReleveModificationWithUser[];
}
```

#### 4d. Nouveaux DTOs

Fichier : `src/types/api.ts` — ajouter à la suite des DTOs existants.

```typescript
// ---------------------------------------------------------------------------
// DTOs — Modification de relevé (Sprint 26)
// ---------------------------------------------------------------------------

/**
 * Corps du PATCH /api/releves/[id]
 * La raison est obligatoire (min 5 chars, max 500).
 * Au moins un champ métier doit être fourni.
 */
export interface PatchReleveBody {
  raison:          string;
  // Biométrie
  poidsMoyen?:     number;
  tailleMoyenne?:  number;
  echantillonCount?: number;
  // Mortalité
  nombreMorts?:    number;
  causeMortalite?: CauseMortalite;
  // Alimentation
  quantiteAliment?:  number;
  typeAliment?:      TypeAliment;
  frequenceAliment?: number;
  // Qualité eau
  temperature?: number;
  ph?:          number;
  oxygene?:     number;
  ammoniac?:    number;
  // Comptage
  nombreCompte?:    number;
  methodeComptage?: MethodeComptage;
  // Observation
  description?: string;
  // Commun
  notes?: string | null;
  // Consommations (remplacement total si fourni)
  consommations?: { produitId: string; quantite: number }[];
}

/**
 * DTO interne pour créer une trace de modification.
 * Utilisé dans la couche query, jamais exposé directement par l'API.
 */
export interface CreateReleveModificationDTO {
  releveId:       string;
  userId:         string;
  raison:         string;
  champModifie:   string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  siteId:         string;
}

/**
 * Réponse du PATCH /api/releves/[id]
 */
export interface PatchReleveResponse {
  releve:        ReleveWithModifications;
  modifications: ReleveModificationWithUser[];
}
```

#### 4e. Extension de `ReleveFilters`

```typescript
// Ajouter dans l'interface ReleveFilters existante :
modifie?: boolean;  // true = uniquement les relevés modifiés
```

#### 4f. Exports barrel

Fichier : `src/types/index.ts` — ajouter les nouveaux exports :

```typescript
export type {
  ReleveModification,
  ReleveModificationWithUser,
  ReleveWithModifications,
} from "./models";

export type {
  PatchReleveBody,
  CreateReleveModificationDTO,
  PatchReleveResponse,
} from "./api";
```

---

### 5. Couche query

Fichier : `src/lib/queries/releves.ts`

#### 5a. Nouvelle fonction `patchReleve`

```typescript
/**
 * Met à jour un relevé avec traçabilité obligatoire de la raison.
 *
 * Opération atomique (transaction Prisma) :
 * 1. Vérifie que le relevé appartient au site
 * 2. Filtre les champs autorisés pour le typeReleve
 * 3. Met à jour le relevé (+ flag modifie = true)
 * 4. Crée une ReleveModification par champ modifié
 * 5. Gère les consommations si fournies (même logique que updateReleve)
 *
 * @param siteId  - site de l'utilisateur (isolation multi-tenant)
 * @param userId  - utilisateur effectuant la modification (pour la trace)
 * @param id      - identifiant du relevé
 * @param data    - champs modifiables (UpdateReleveDTO existant)
 * @param raison  - raison obligatoire de la modification (min 5 chars)
 * @returns       - { releve: ReleveWithModifications, modifications: ReleveModificationWithUser[] }
 */
export async function patchReleve(
  siteId: string,
  userId: string,
  id: string,
  data: UpdateReleveDTO,
  raison: string
): Promise<{ releve: ReleveWithModifications; modifications: ReleveModificationWithUser[] }>;
```

**Logique de détection des champs modifiés :**

```
Pour chaque champ dans data :
  - Comparer data[champ] avec releve[champ] (valeur avant)
  - Si différent → créer une ReleveModification avec :
      champModifie   = nom du champ (ex: "poidsMoyen")
      ancienneValeur = String(releve[champ]) ou null si undefined/null
      nouvelleValeur = String(data[champ]) ou null si undefined/null
      raison         = raison fournie
```

**Sérialisation des valeurs :** `String(valeur)` pour les nombres et strings. Pour les enums : valeur directe (ex: `"MALADIE"`). Pour `null` : stocker `null` (pas `"null"`).

**Transaction atomique :**

```
tx.releve.findFirst({ where: { id, siteId } })          // vérification propriété + fetch old values
→ buildUpdateData(data, releve.typeReleve)               // filtrage type-safe
→ tx.releve.update({ where: { id }, data: {             // mise à jour
    ...updateData,
    modifie: true,
  }})
→ tx.releveModification.createMany({ data: traces })     // traces (une par champ)
→ [si data.consommations fourni] → gestion consommations (même logique updateReleve)
→ tx.releve.findFirst({ include: { modifications: {...}, consommations: {...} } })
```

**Ré-évaluation des règles SEUIL_* :** appelée de manière asynchrone (fire-and-forget) depuis la route API, identiquement à `triggerSeuilRulesAsync` dans `POST /api/releves`. Le query layer n'appelle pas le moteur d'activités directement.

#### 5b. Extension de `getReleves`

```typescript
// Ajouter dans la fonction getReleves :
if (filters.modifie !== undefined) where.modifie = filters.modifie;
```

#### 5c. Extension de `getReleveById`

```typescript
// Remplacer l'include existant par :
include: {
  consommations: { include: { produit: true } },
  modifications: {
    orderBy:  { createdAt: "desc" },
    include:  { user: { select: { id: true, name: true } } },
  },
}
```

---

### 6. Route API PATCH

Fichier : `src/app/api/releves/[id]/route.ts` — ajouter l'export `PATCH`.

#### Validations dans la route

```
1. requirePermission(request, Permission.RELEVES_MODIFIER)
2. raison : présente, typeof string, trim().length >= 5 && <= 500
3. Champs non modifiables : rejet 400 si envoyés (id, vagueId, bacId, siteId, typeReleve, date, userId)
4. Validations des champs métier (réutiliser la logique du PUT existant)
5. Au moins un champ métier fourni (hors raison)
6. Appel patchReleve(auth.activeSiteId, auth.userId, id, data, raison)
7. triggerSeuilRulesAsync(...) si le typeReleve est BIOMETRIE ou MORTALITE
```

#### Exemple de réponse 200

```json
{
  "releve": {
    "id": "clx...",
    "modifie": true,
    "poidsMoyen": 185.5,
    "modifications": [
      {
        "id": "clx...",
        "champModifie": "poidsMoyen",
        "ancienneValeur": "178",
        "nouvelleValeur": "185.5",
        "raison": "Erreur de lecture de la balance",
        "user": { "id": "clx...", "name": "Jean Dupont" },
        "createdAt": "2026-03-18T14:23:00.000Z"
      }
    ]
  },
  "modifications": [ ... ]
}
```

---

### 7. UI (spécification — implémentation par @developer)

#### 7a. Dialog de modification

Composant : `src/components/releves/modifier-releve-dialog.tsx`

```
Déclencheur : bouton "Modifier" sur la page détail du relevé
  → accessible uniquement si user a RELEVES_MODIFIER

Dialog (Radix UI Dialog) :
  Titre : "Modifier le relevé"
  Sous-titre : "Toutes les modifications sont tracées pour l'audit"

  Section 1 — Raison (obligatoire, affichée EN PREMIER)
    Label : "Raison de la modification *"
    Textarea (4 lignes min, 500 chars max)
    Compteur de caractères
    Validation inline : rouge si < 5 chars

  Section 2 — Champs du type de relevé
    Uniquement les champs editables pour ce typeReleve
    Pré-remplis avec les valeurs actuelles
    Identiques aux champs du formulaire de création

  Actions :
    [Annuler]  [Enregistrer les modifications]
    → Spinner sur "Enregistrer" pendant l'appel API
    → Toast succès / Toast erreur (Radix UI Toast)
```

Mobile-first : dialog plein écran sur mobile (`w-full h-full` sur mobile, `max-w-lg` sur desktop).

#### 7b. Historique des modifications

Composant : `src/components/releves/releve-modifications-list.tsx`

```
Section "Historique des modifications" (visible si releve.modifie = true)

Pour chaque ReleveModification (ordre chronologique inverse) :
  ┌──────────────────────────────────────────────┐
  │ Jean Dupont — 18 mar. 2026 à 14h23           │
  │ Raison : "Erreur de lecture de la balance"   │
  │                                              │
  │ poidsMoyen    178 g  →  185,5 g              │
  └──────────────────────────────────────────────┘
```

Icône crayon + date relative (ex: "il y a 2 heures"). Pas de pagination en v1 (les relevés ne sont pas modifiés des dizaines de fois).

#### 7c. Badge "Modifié" dans les listes

Dans `src/components/releves/releves-list.tsx` (et listes analogues dans les pages vague) :

```
Si releve.modifie = true :
  Badge jaune/ambre "Modifié" à côté du type de relevé
```

Implémentation : `{releve.modifie && <Badge variant="warning">Modifié</Badge>}`

#### 7d. Champ "Raison obligatoire" — règle UX

La raison est le **premier champ** du dialog, pas le dernier. L'utilisateur doit formuler la raison avant de voir les champs à modifier — intention de traçabilité explicite.

---

### 8. Sécurité

| Vérification | Où | Comment |
|---|---|---|
| Authentification | Route PATCH | `requirePermission` → 401 si pas de session |
| Autorisation | Route PATCH | `Permission.RELEVES_MODIFIER` → 403 si absent |
| Isolation site | Query layer | `where: { id, siteId }` → 404 si hors site |
| Raison obligatoire | Route PATCH | Validation longueur min 5 → 400 |
| Champs immuables | Route PATCH | Rejet explicite avec 400 |
| Consommations stock | Query layer | Vérification stock disponible dans tx |

**Pas de limitation temporelle** (ex: "modifiable seulement dans les 24h") en v1 — la raison obligatoire est suffisante pour l'audit.

---

### 9. Impact sur le moteur d'activités

**Les relevés BIOMETRIE et MORTALITE modifiés déclenchent une ré-évaluation SEUIL_*.**

Même pattern que `POST /api/releves` : `triggerSeuilRulesAsync` appelé en fire-and-forget depuis la route PATCH après confirmation de la mise à jour.

Conditions de déclenchement :

| typeReleve modifié | Règles potentiellement re-évaluées |
|---|---|
| BIOMETRIE | SEUIL_POIDS, FCR_ELEVE |
| MORTALITE | SEUIL_MORTALITE |
| ALIMENTATION | FCR_ELEVE |
| QUALITE_EAU | SEUIL_QUALITE |
| COMPTAGE, OBSERVATION | Aucune (pas de règles SEUIL liées) |

La ré-évaluation peut générer de nouvelles activités si les seuils sont désormais franchis avec les valeurs corrigées. Elle ne supprime pas les activités générées par l'ancienne valeur incorrecte — ce n'est pas géré en v1.

**Conséquence documentée :** si une erreur de biométrie a déclenché une activité TRI inutile, l'activité reste dans le planning. L'utilisateur doit l'annuler manuellement. Cette limitation est acceptable en v1.

---

## Fichiers à créer

| Fichier | Type | Responsable |
|---------|------|-------------|
| `prisma/migrations/20260318250000_add_releve_modification/migration.sql` | Migration SQL | @db-specialist |
| `src/components/releves/modifier-releve-dialog.tsx` | Client Component | @developer |
| `src/components/releves/releve-modifications-list.tsx` | Component | @developer |

## Fichiers à modifier

| Fichier | Modification | Responsable |
|---------|-------------|-------------|
| `prisma/schema.prisma` | Ajouter `modifie`, `modifications` sur Releve + modèle `ReleveModification` | @db-specialist |
| `src/types/models.ts` | Ajouter `modifie` + `modifications?` sur `Releve`, interfaces `ReleveModification`, `ReleveModificationWithUser`, `ReleveWithModifications` | @architect → @db-specialist |
| `src/types/api.ts` | Ajouter `PatchReleveBody`, `CreateReleveModificationDTO`, `PatchReleveResponse`, champ `modifie?` dans `ReleveFilters` | @architect |
| `src/types/index.ts` | Barrel exports des nouveaux types | @architect |
| `src/lib/queries/releves.ts` | Ajouter `patchReleve`, étendre `getReleves` (filtre `modifie`), étendre `getReleveById` (include modifications) | @db-specialist |
| `src/app/api/releves/[id]/route.ts` | Ajouter export `PATCH` | @developer |
| `src/components/releves/releves-list.tsx` (ou équivalent) | Badge "Modifié" | @developer |
| `src/app/vagues/[id]/releves/page.tsx` | Afficher badge + bouton Modifier | @developer |

---

## Alternatives considérées

### A — Modifier PUT existant pour y inclure `raison`

Rejetée. Casser le contrat PUT existant introduit un risque de régression sur les clients existants. La coexistence de PUT (sans raison) et PATCH (avec raison) permet une migration progressive.

### B — Une ligne `ReleveModification` par opération (pas par champ)

Rejetée. Un seul enregistrement avec un JSON `changes: { poidsMoyen: [178, 185.5] }` est moins structuré et rend les requêtes de filtrage par champ impossible sans JSONB. La granularité par champ est préférable.

### C — Versioning complet du relevé (snapshot)

Rejetée. Stocker une copie complète du relevé à chaque modification est coûteux en stockage et inutile. La trace par champ est suffisante pour l'audit.

### D — Interdire les modifications après clôture de vague

Partiellement retenu. La vérification de clôture est déjà dans `updateReleve` (la vague doit être `EN_COURS`). Ce comportement est préservé dans `patchReleve`.

### E — Limitation temporelle (ex: 48h)

Rejetée pour la v1. La raison obligatoire est une barrière suffisante. Une fenêtre temporelle peut être ajoutée si des abus sont constatés en production.

---

## Conséquences

### Positives
- Audit complet de toutes les corrections de relevés (qui, quand, pourquoi, quelle valeur)
- Le flag `modifie` permet un badge instantané dans les listes sans JOIN
- La route PUT existante reste opérationnelle (aucune régression)
- L'infrastructure SEUIL_* existante est réutilisée sans modification
- Aucune nouvelle permission à créer (`RELEVES_MODIFIER` existe déjà)

### Négatives
- Volume de données augmenté (une ligne par champ modifié, par modification)
- Les activités générées par des valeurs erronées ne sont pas auto-annulées
- La coexistence PUT/PATCH crée deux surfaces API pour la même ressource
