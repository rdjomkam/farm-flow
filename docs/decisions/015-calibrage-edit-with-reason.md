# ADR-015 — Modification de calibrage avec raison obligatoire et traçabilité

**Date :** 2026-03-18
**Statut :** ACCEPTEE
**Auteurs :** @architect
**Sprint :** 26
**Dépend de :** ADR-015 s'inscrit dans le pattern transversal défini par ADR-014

---

## Principe transversal (partagé avec ADR-014)

> **Toute modification d'une donnée de production (relevé ou calibrage) requiert une raison explicite et obligatoire.**

La raison est un outil d'audit : elle force l'utilisateur à formuler l'intention de la correction avant de l'appliquer. Sans raison, l'API rejette la requête avec 400. Ce principe est identique entre relevés (ADR-014) et calibrages (ce document).

---

## Contexte

Un calibrage est une opération critique et complexe : il redistribue physiquement les poissons entre bacs, enregistre des mortalités, et génère automatiquement plusieurs relevés (BIOMETRIE, COMPTAGE, MORTALITE). Une erreur de saisie (nombre de morts surévalué, poids moyen erroné sur un groupe, mauvais bac de destination) a des conséquences sur l'ensemble du tableau de bord — biomasse, FCR, taux de survie — et sur les stocks de poissons par bac.

Actuellement :
- `POST /api/calibrages` crée un calibrage et exécute les 8 étapes de la transaction
- `GET /api/calibrages/[id]` retourne le détail
- **Pas de route PATCH ni PUT** — aucune correction n'est possible
- **Pas de `CALIBRAGES_MODIFIER`** dans l'enum Permission
- Aucune traçabilité en cas de correction manuelle directe en base

Le calibrage est structurellement plus difficile à modifier qu'un relevé : ses effets secondaires (dispatch sur les bacs, relevés auto-créés) doivent être annulés puis réappliqués en une seule transaction atomique.

### Périmètre de l'existant à préserver

| Élément | Statut | Action |
|---------|--------|--------|
| `POST /api/calibrages` | Implémentée | Inchangée |
| `GET /api/calibrages` | Implémentée | Étendre : inclure `modifie` dans le retour |
| `GET /api/calibrages/[id]` | Implémentée | Étendre : inclure `modifications` dans l'include |
| `createCalibrage` dans `src/lib/queries/calibrages.ts` | Implémentée | Inchangée |
| Permission `CALIBRAGES_VOIR` | Existe | Inchangée |
| Permission `CALIBRAGES_CREER` | Existe | Inchangée |
| `Calibrage`, `CalibrageGroupe`, `CalibrageWithRelations` dans `models.ts` | Existent | Étendre |
| `CreateCalibrageDTO`, `CreateCalibrageGroupeDTO` dans `api.ts` | Existent | Inchangés |

---

## Décisions

### 1. Schéma DB

#### 1a. Nouveau champ `modifie` sur le modèle `Calibrage`

```prisma
model Calibrage {
  // ... champs existants inchangés ...

  // Traçabilité modification (Sprint 26)
  modifie       Boolean               @default(false)
  modifications CalibrageModification[]

  // ... createdAt, updatedAt, index existants inchangés ...
}
```

Le champ `modifie Boolean @default(false)` est un flag rapide pour les listes (badge "Modifié") sans JOIN. Il passe à `true` lors de la première modification et ne revient jamais à `false`.

#### 1b. Nouveau modèle `CalibrageModification`

Même granularité que `ReleveModification` (ADR-014) : une ligne par champ modifié.

```prisma
model CalibrageModification {
  id             String    @id @default(cuid())
  calibrageId    String
  calibrage      Calibrage @relation(fields: [calibrageId], references: [id], onDelete: Cascade)
  userId         String
  user           User      @relation(fields: [userId], references: [id])
  raison         String
  champModifie   String
  ancienneValeur String?
  nouvelleValeur String?
  siteId         String
  site           Site      @relation(fields: [siteId], references: [id])
  createdAt      DateTime  @default(now())

  @@index([calibrageId])
  @@index([userId])
  @@index([siteId])
}
```

**Cascade DELETE :** si un calibrage est supprimé (pas de route DELETE en v1), ses modifications sont supprimées aussi. Cohérent avec `ReleveModification`.

**Granularité par champ :** une ligne par champ modifié, pas par opération. Permet de comparer ancienne/nouvelle valeur dans l'UI et de filtrer par champ dans les requêtes d'audit.

**`ancienneValeur` / `nouvelleValeur` en String :** sérialisation JSON pour les valeurs complexes (groupes complets), valeur directe pour les primitifs.

#### 1c. Nouvelle permission `CALIBRAGES_MODIFIER`

**Contrainte :** l'enum `Permission` est en PostgreSQL. Ajouter une valeur nécessite la stratégie RECREATE (renommer l'ancien type, créer le nouveau, caster les colonnes, supprimer l'ancien) — identique aux migrations d'enum précédentes du projet.

```prisma
// Dans l'enum Permission (prisma/schema.prisma)
CALIBRAGES_MODIFIER = "CALIBRAGES_MODIFIER"
```

L'ordre d'insertion dans l'enum compte pour la migration RECREATE. Insérer après `CALIBRAGES_CREER`.

#### 1d. Migration Prisma

Fichier : `prisma/migrations/20260318300000_add_calibrage_modification/migration.sql`

```sql
-- =========================================================
-- Étape 1 : Ajout du flag modifie sur Calibrage
-- =========================================================
ALTER TABLE "Calibrage" ADD COLUMN "modifie" BOOLEAN NOT NULL DEFAULT false;

-- =========================================================
-- Étape 2 : Nouveau modèle CalibrageModification
-- =========================================================
CREATE TABLE "CalibrageModification" (
  "id"             TEXT NOT NULL,
  "calibrageId"    TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "raison"         TEXT NOT NULL,
  "champModifie"   TEXT NOT NULL,
  "ancienneValeur" TEXT,
  "nouvelleValeur" TEXT,
  "siteId"         TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalibrageModification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CalibrageModification"
  ADD CONSTRAINT "CalibrageModification_calibrageId_fkey"
    FOREIGN KEY ("calibrageId") REFERENCES "Calibrage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CalibrageModification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CalibrageModification_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CalibrageModification_calibrageId_idx" ON "CalibrageModification"("calibrageId");
CREATE INDEX "CalibrageModification_userId_idx"      ON "CalibrageModification"("userId");
CREATE INDEX "CalibrageModification_siteId_idx"      ON "CalibrageModification"("siteId");

-- =========================================================
-- Étape 3 : Ajout de CALIBRAGES_MODIFIER à l'enum Permission
-- Stratégie RECREATE (impossible d'ADD VALUE dans la même migration)
-- =========================================================

-- 3a. Renommer l'ancien type
ALTER TYPE "Permission" RENAME TO "Permission_old";

-- 3b. Créer le nouveau type avec la valeur supplémentaire
-- (reprendre TOUTES les valeurs existantes + la nouvelle)
CREATE TYPE "Permission" AS ENUM (
  'SITE_GERER',
  'MEMBRES_GERER',
  'VAGUES_VOIR',
  'VAGUES_CREER',
  'VAGUES_MODIFIER',
  'BACS_GERER',
  'BACS_MODIFIER',
  'RELEVES_VOIR',
  'RELEVES_CREER',
  'RELEVES_MODIFIER',
  'STOCK_VOIR',
  'STOCK_GERER',
  'APPROVISIONNEMENT_VOIR',
  'APPROVISIONNEMENT_GERER',
  'CLIENTS_VOIR',
  'CLIENTS_GERER',
  'VENTES_VOIR',
  'VENTES_CREER',
  'FACTURES_VOIR',
  'FACTURES_GERER',
  'PAIEMENTS_CREER',
  'ALEVINS_VOIR',
  'ALEVINS_GERER',
  'ALEVINS_CREER',
  'ALEVINS_MODIFIER',
  'ALEVINS_SUPPRIMER',
  'PLANNING_VOIR',
  'PLANNING_GERER',
  'FINANCES_VOIR',
  'FINANCES_GERER',
  'ALERTES_VOIR',
  'ALERTES_CONFIGURER',
  'DASHBOARD_VOIR',
  'EXPORT_DONNEES',
  'DEPENSES_VOIR',
  'DEPENSES_CREER',
  'DEPENSES_PAYER',
  'BESOINS_SOUMETTRE',
  'BESOINS_APPROUVER',
  'BESOINS_TRAITER',
  'GERER_PACKS',
  'ACTIVER_PACKS',
  'GERER_CONFIG_ELEVAGE',
  'REGLES_ACTIVITES_VOIR',
  'GERER_REGLES_ACTIVITES',
  'MONITORING_CLIENTS',
  'ENVOYER_NOTES',
  'CALIBRAGES_VOIR',
  'CALIBRAGES_CREER',
  'CALIBRAGES_MODIFIER',
  'GERER_REGLES_GLOBALES'
);

-- 3c. Caster les colonnes qui utilisent Permission_old vers le nouveau type
-- SiteRole.permissions est un tableau
ALTER TABLE "SiteRole"
  ALTER COLUMN "permissions" TYPE "Permission"[]
  USING "permissions"::text::"Permission"[];

-- SiteMember.permissions (si présent comme override)
ALTER TABLE "SiteMember"
  ALTER COLUMN "permissions" TYPE "Permission"[]
  USING "permissions"::text::"Permission"[];

-- 3d. Supprimer l'ancien type
DROP TYPE "Permission_old";
```

**Note pour @db-specialist :** vérifier les tables qui utilisent `Permission` dans le schéma avant d'exécuter — ajouter les `ALTER TABLE` manquants si nécessaire. La stratégie RECREATE est documentée dans MEMORY.md (section "Enum migration strategy").

---

### 2. Champs modifiables vs non modifiables

#### Champs modifiables

| Champ | Niveau | Contrainte de validation | Impact sur les effets secondaires |
|-------|--------|--------------------------|------------------------------------|
| `nombreMorts` | Calibrage | `>= 0` ; conservation vérifiée si `groupes` non fournis | Mettre à jour le relevé MORTALITE auto-créé (si > 0) |
| `notes` | Calibrage | String ou null | Aucun |
| `groupes` | Calibrage | Tableau non vide ; conservation respectée | Recalcul complet des bacs + relevés BIOMETRIE et COMPTAGE |

#### Champs NON modifiables (rejet 400 si envoyés)

```
id, vagueId, sourceBacIds, siteId, userId, date, createdAt, updatedAt
```

**Justification :** les bacs sources sont des données historiques — ils définissent l'état de départ du calibrage. Modifier `sourceBacIds` ou `date` invaliderait la cohérence de l'historique. Si une erreur concerne les sources, il faut supprimer le calibrage (non supporté en v1) et en créer un nouveau.

#### Règle de conservation (invariant)

```
sum(groupes.nombrePoissons) + nombreMorts === totalSourcePoissons
```

`totalSourcePoissons` est immuable après la création (snapshot capturé dans `sourceBacIds` + état des bacs au moment de la création). La modification ne peut pas changer ce total.

**Extraction du total source lors du PATCH :**

```
totalSourcePoissons = calibrageExistant.groupes.reduce(sum, nombrePoissons) + calibrageExistant.nombreMorts
```

Ce total est utilisé pour valider le nouveau dispatch.

---

### 3. API

#### 3a. Route `PATCH /api/calibrages/[id]`

Nouveau fichier : `src/app/api/calibrages/[id]/route.ts` — ajouter l'export `PATCH` aux côtés du `GET` existant.

**Méthode HTTP :** `PATCH` (modification partielle). Pas de `PUT` — un remplacement complet du calibrage ne fait pas sens compte tenu de sa complexité transactionnelle.

##### Requête

```
PATCH /api/calibrages/{id}
Authorization: session cookie (requirePermission CALIBRAGES_MODIFIER)
Content-Type: application/json
```

##### Interfaces TypeScript du corps de requête

```typescript
// src/types/api.ts

/** Groupe modifié dans un PATCH calibrage — remplace complètement les groupes existants si fourni */
export interface UpdateCalibrageGroupeDTO {
  /** Catégorie de taille de ce groupe */
  categorie: CategorieCalibrage;
  /** Bac de destination (doit appartenir à la même vague) */
  destinationBacId: string;
  /** Nombre de poissons dans ce groupe (>= 1) */
  nombrePoissons: number;
  /** Poids moyen en grammes (> 0) */
  poidsMoyen: number;
  /** Taille moyenne en cm (optionnel) */
  tailleMoyenne?: number;
}

/**
 * Corps du PATCH /api/calibrages/[id]
 *
 * La raison est obligatoire (min 5 chars, max 500).
 * Au moins un champ métier parmi nombreMorts, notes, groupes doit être fourni.
 * Si groupes est fourni, il remplace complètement les groupes existants.
 * La règle de conservation est vérifiée si nombreMorts ou groupes sont fournis.
 */
export interface PatchCalibrageBody {
  /** Raison de la modification — obligatoire, min 5 chars, max 500 */
  raison: string;
  /** Nouvelle valeur du nombre de morts (>= 0) */
  nombreMorts?: number;
  /** Nouvelles notes libres (null pour effacer) */
  notes?: string | null;
  /** Remplacement complet des groupes — si omis, les groupes existants sont conservés */
  groupes?: UpdateCalibrageGroupeDTO[];
}
```

##### Validations dans la route

```
1. requirePermission(request, Permission.CALIBRAGES_MODIFIER)
2. raison : présente, typeof string, trim().length >= 5 && <= 500
3. Champs non modifiables : rejet 400 si envoyés
   (id, vagueId, sourceBacIds, siteId, userId, date, createdAt, updatedAt)
4. Au moins un champ métier fourni parmi : nombreMorts, notes, groupes
5. Si groupes fournis :
   a. tableau non vide (>= 1 groupe)
   b. destinationBacIds appartenant à la même vague (vérifié dans la transaction)
   c. nombrePoissons > 0 par groupe
   d. poidsMoyen > 0
6. Si nombreMorts fourni : >= 0
7. Conservation : vérifiée dans la transaction (pas dans la route — nécessite les données DB)
8. Appel patchCalibrage(auth.activeSiteId, auth.userId, id, body)
9. triggerSeuilRulesAsync(...) si les groupes ou nombreMorts sont modifiés
```

##### Réponses

| Code | Condition |
|------|-----------|
| 200 | Modification réussie |
| 400 | `raison` absente ou < 5 chars ; champ non modifiable envoyé ; aucun champ métier ; conservation non respectée ; groupes invalides |
| 401 | Session expirée ou absente |
| 403 | `CALIBRAGES_MODIFIER` absent des permissions |
| 404 | Calibrage introuvable ou hors du site |
| 409 | Vague clôturée |
| 500 | Erreur serveur |

##### Interface de réponse

```typescript
// src/types/api.ts

/**
 * Réponse du PATCH /api/calibrages/[id]
 */
export interface PatchCalibrageResponse {
  calibrage:     CalibrageWithModifications;
  modifications: CalibrageModificationWithUser[];
}
```

##### Exemple de réponse 200

```json
{
  "calibrage": {
    "id": "clx...",
    "modifie": true,
    "nombreMorts": 3,
    "groupes": [...],
    "modifications": [
      {
        "id": "clx...",
        "champModifie": "nombreMorts",
        "ancienneValeur": "5",
        "nouvelleValeur": "3",
        "raison": "Erreur de comptage des mortalités lors du calibrage",
        "user": { "id": "clx...", "name": "Jean Dupont" },
        "createdAt": "2026-03-18T16:45:00.000Z"
      }
    ]
  },
  "modifications": [...]
}
```

---

### 4. Interfaces TypeScript

#### 4a. Extension de l'interface `Calibrage`

Fichier : `src/types/models.ts` — ajouter dans l'interface `Calibrage` existante :

```typescript
// Ajouter dans l'interface Calibrage existante :
modifie:       boolean;
modifications?: CalibrageModification[];
```

#### 4b. Nouveau modèle miroir `CalibrageModification`

Fichier : `src/types/models.ts` — ajouter après l'interface `CalibrageWithRelations` :

```typescript
/** Trace d'une modification de calibrage avec raison d'audit */
export interface CalibrageModification {
  id:             string;
  calibrageId:    string;
  userId:         string;
  raison:         string;
  champModifie:   string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  siteId:         string;
  createdAt:      Date;
}

/** CalibrageModification avec l'utilisateur dénormalisé (pour affichage) */
export interface CalibrageModificationWithUser extends CalibrageModification {
  user: {
    id:   string;
    name: string;
  };
}
```

#### 4c. Nouvelles interfaces `WithRelations`

```typescript
/** Calibrage avec groupes, relations et historique complet de modifications */
export interface CalibrageWithModifications extends CalibrageWithRelations {
  modifications: CalibrageModificationWithUser[];
}
```

#### 4d. Nouveaux DTOs dans `api.ts`

```typescript
// src/types/api.ts

// ---------------------------------------------------------------------------
// DTOs — Modification de calibrage (Sprint 26)
// ---------------------------------------------------------------------------

/**
 * DTO interne pour créer une trace de modification.
 * Utilisé dans la couche query, jamais exposé directement par l'API.
 */
export interface CreateCalibrageModificationDTO {
  calibrageId:    string;
  userId:         string;
  raison:         string;
  champModifie:   string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  siteId:         string;
}
```

`UpdateCalibrageGroupeDTO`, `PatchCalibrageBody` et `PatchCalibrageResponse` sont définis dans la section 3.

#### 4e. Enum `Permission` — ajout de `CALIBRAGES_MODIFIER`

Fichier : `src/types/models.ts` — dans l'enum `Permission`, après `CALIBRAGES_CREER` :

```typescript
CALIBRAGES_MODIFIER = "CALIBRAGES_MODIFIER",
```

#### 4f. Exports barrel

Fichier : `src/types/index.ts` — ajouter :

```typescript
export type {
  CalibrageModification,
  CalibrageModificationWithUser,
  CalibrageWithModifications,
} from "./models";

export type {
  UpdateCalibrageGroupeDTO,
  PatchCalibrageBody,
  CreateCalibrageModificationDTO,
  PatchCalibrageResponse,
} from "./api";
```

---

### 5. Couche query — `patchCalibrage`

Fichier : `src/lib/queries/calibrages.ts`

#### 5a. Signature de `patchCalibrage`

```typescript
/**
 * Modifie un calibrage existant avec traçabilité obligatoire.
 *
 * Transaction atomique en 9 étapes (voir ci-dessous).
 *
 * @param siteId    - isolation multi-tenant
 * @param userId    - utilisateur effectuant la modification (pour la trace)
 * @param id        - identifiant du calibrage
 * @param data      - champs modifiables (PatchCalibrageBody sans raison)
 * @param raison    - raison obligatoire (min 5 chars, déjà validée en route)
 * @returns         - { calibrage: CalibrageWithModifications, modifications: CalibrageModificationWithUser[] }
 *
 * @throws "Calibrage introuvable"             — 404
 * @throws "Vague clôturée"                    — 409
 * @throws "Conservation non respectée"        — 400
 * @throws "Bac de destination hors vague"     — 400
 * @throws "Aucun champ modifié"               — 400
 */
export async function patchCalibrage(
  siteId: string,
  userId: string,
  id: string,
  data: Omit<PatchCalibrageBody, "raison">,
  raison: string
): Promise<{ calibrage: CalibrageWithModifications; modifications: CalibrageModificationWithUser[] }>;
```

#### 5b. Transaction atomique — 9 étapes détaillées

```
DÉBUT TRANSACTION

Étape 1 — Fetch et vérification du calibrage existant
──────────────────────────────────────────────────────
tx.calibrage.findFirst({
  where: { id, siteId },
  include: {
    groupes: { include: { destinationBac: true } },
    vague: { select: { id: true, statut: true } },
  },
})
→ Si null : throw "Calibrage introuvable"  (→ 404)
→ Si vague.statut !== StatutVague.EN_COURS : throw "Vague clôturée"  (→ 409)

Étape 2 — Calcul du total source (invariant de conservation)
─────────────────────────────────────────────────────────────
totalSourcePoissons =
  ancienCalibrage.groupes.reduce((sum, g) => sum + g.nombrePoissons, 0)
  + ancienCalibrage.nombreMorts

Étape 3 — Détermination des nouvelles valeurs effectives
──────────────────────────────────────────────────────────
nouveauxNombreMorts = data.nombreMorts ?? ancienCalibrage.nombreMorts
nouveauxGroupes     = data.groupes ?? ancienCalibrage.groupes (mapped to UpdateCalibrageGroupeDTO)
nouvellesNotes      = data.notes !== undefined ? data.notes : ancienCalibrage.notes

Étape 4 — Vérification de conservation si nombreMorts ou groupes modifiés
──────────────────────────────────────────────────────────────────────────
Si data.nombreMorts !== undefined || data.groupes !== undefined :
  totalNouveaux = nouveauxGroupes.reduce((sum, g) => sum + g.nombrePoissons, 0)
                 + nouveauxNombreMorts
  Si totalNouveaux !== totalSourcePoissons :
    throw "Conservation non respectée. Total source: X, nouveau total: Y"  (→ 400)

Étape 5 — Vérification des bacs de destination (si groupes modifiés)
──────────────────────────────────────────────────────────────────────
Si data.groupes !== undefined :
  uniqueNewDestIds = [...new Set(data.groupes.map(g => g.destinationBacId))]
  destBacs = tx.bac.findMany({ where: { id: { in: uniqueNewDestIds }, vagueId: ancienCalibrage.vagueId, siteId } })
  Si destBacs.length !== uniqueNewDestIds.length :
    throw "Un ou plusieurs bacs de destination n'appartiennent pas à la vague"  (→ 400)

Étape 6 — Annulation des effets sur les bacs (si groupes modifiés)
───────────────────────────────────────────────────────────────────
Si data.groupes !== undefined :

  6a. Restaurer les bacs sources à leur état pré-calibrage
      (les sourceBacIds sont immuables — ils contiennent les IDs des bacs sources originaux)

      ancienDestTotals = Map<bacId, nombrePoissons> calculé depuis ancienCalibrage.groupes

      Pour chaque [bacId, ancienTotal] dans ancienDestTotals :
        Si bacId est dans ancienCalibrage.sourceBacIds :
          // Ce bac était à la fois source ET destination — il avait été remis à 0 puis
          // réassigné au total reçu. On lui rend son total reçu seulement.
          tx.bac.update({ where: { id: bacId }, data: { nombrePoissons: { decrement: ancienTotal } } })
        Sinon :
          // Bac destination pur — décrémenter du total qu'il avait reçu
          tx.bac.update({ where: { id: bacId }, data: { nombrePoissons: { decrement: ancienTotal } } })

      Pour chaque bacId dans ancienCalibrage.sourceBacIds :
        // Remettre les poissons sur les sources (totalSourcePoissons distribués au prorata)
        // Note : on ne connaît pas le répartition originale entre plusieurs sources.
        // Approche : on remet le total sur le premier source (même logique que la création
        // qui zeroed tous les sources et dispatch sur destinations).
        // Le vrai total source est reconstitué depuis totalSourcePoissons.
        [voir note ci-dessous]

  [NOTE IMPORTANTE SUR LA RESTAURATION DES SOURCES]
  ───────────────────────────────────────────────────
  Le calibrage originel a zeroed tous les bacs sources. On ne connaît plus la
  répartition exacte des poissons entre les sources avant le calibrage (le snapshot
  était capturé dans nombreInitial seulement pour le premier calibrage d'une vague).

  Approche retenue : lors du PATCH, la restauration des sources utilise le
  champ `sourceBacIds` (liste des IDs). On incrémente le premier bac source de
  `totalSourcePoissons` (totalité), puis on remet 0 sur les autres.
  Ce n'est pas parfait pour les cas multi-sources mais c'est atomiquement cohérent
  car la règle de conservation garantit que le total redispatch sera correct.

  Alternative plus robuste (Sprint suivant) : stocker un snapshot des nombrePoissons
  par bac source au moment de la création → champ `sourceBacsSnapshot JSON?` sur Calibrage.
  Documenter ce manque comme limitation v1.

  6b. Remettre les bacs sources à leur état avant calibrage
      Pour chaque sourceBacId en position 0 : increment de totalSourcePoissons
      Pour les autres sourceBacIds : laisser à 0 (ils étaient à 0 après calibrage)

Étape 7 — Application du nouveau dispatch sur les bacs (si groupes modifiés)
──────────────────────────────────────────────────────────────────────────────
Même algorithme que createCalibrage étape 7 (two-pass bac update) :
  Pass 1 : updateMany sourceBacIds → nombrePoissons = 0
  Pass 2 : pour chaque bac destination, mettre à jour selon nouveauxGroupes
    (increment si non-source, set si source)

Étape 8 — Mise à jour des relevés auto-créés
──────────────────────────────────────────────
Les relevés auto-créés par createCalibrage sont identifiés par leurs notes contenant
"lors du calibrage" ou "calibrage". Ils sont liés à la vague et aux bacs concernés.

Stratégie d'identification : les relevés auto-créés n'ont PAS d'ID lié au calibrage
dans la v1 (la création ne stocke pas l'ID du calibrage sur le relevé). On les
identifie par :
  - typeReleve = MORTALITE | BIOMETRIE | COMPTAGE
  - vagueId = ancienCalibrage.vagueId
  - date = ancienCalibrage.createdAt (même jour à la minute près)
  - notes contient "calibrage" (substring)

[NOTE LIMITATION]
Cette identification par heuristique est fragile si plusieurs calibrages ont lieu
le même jour. Solution durable : ajouter un champ `calibrageId String?` sur le
modèle `Releve` (Sprint suivant). Documenter comme limitation v1.

  8a. Si data.nombreMorts !== undefined ET ancienCalibrage.nombreMorts !== data.nombreMorts :
      Trouver le relevé MORTALITE auto-créé (heuristique date+vagueId+notes)
      Si trouvé :
        Si nouveauxNombreMorts === 0 : supprimer le relevé
        Sinon : tx.releve.update({ data: { nombreMorts: nouveauxNombreMorts } })

  8b. Si data.groupes !== undefined :
      // Supprimer les anciens relevés BIOMETRIE et COMPTAGE auto-créés
      tx.releve.deleteMany({
        where: {
          vagueId: ancienCalibrage.vagueId,
          typeReleve: { in: [TypeReleve.BIOMETRIE, TypeReleve.COMPTAGE] },
          notes: { contains: "calibrage" },
          // Filtre temporel : même jour que createdAt du calibrage
          date: {
            gte: startOfDay(ancienCalibrage.createdAt),
            lte: endOfDay(ancienCalibrage.createdAt),
          },
          siteId,
        },
      })
      // Recréer les relevés BIOMETRIE et COMPTAGE avec les nouvelles valeurs
      // Identique aux étapes 8b et 8c de createCalibrage
      for (groupe of nouveauxGroupes) :
        tx.releve.create({ data: { typeReleve: BIOMETRIE, ... } })
      for ([bacId, total] of nouveauxDestTotals) :
        tx.releve.create({ data: { typeReleve: COMPTAGE, ... } })

Étape 9 — Mise à jour du calibrage et création des traces
──────────────────────────────────────────────────────────
9a. Supprimer les anciens CalibrageGroupe si groupes modifiés :
    Si data.groupes !== undefined :
      tx.calibrageGroupe.deleteMany({ where: { calibrageId: id } })

9b. Mettre à jour le Calibrage (champs scalaires + flag modifie) :
    tx.calibrage.update({
      where: { id },
      data: {
        nombreMorts: nouveauxNombreMorts,
        notes:       nouvellesNotes,
        modifie:     true,
        // Créer les nouveaux groupes si fournis
        ...(data.groupes && {
          groupes: {
            create: nouveauxGroupes.map(g => ({
              categorie:        g.categorie,
              destinationBacId: g.destinationBacId,
              nombrePoissons:   g.nombrePoissons,
              poidsMoyen:       g.poidsMoyen,
              tailleMoyenne:    g.tailleMoyenne ?? null,
            })),
          },
        }),
      },
    })

9c. Construire les traces CalibrageModification :

    traces = []

    Si data.nombreMorts !== undefined && data.nombreMorts !== ancienCalibrage.nombreMorts :
      traces.push({
        calibrageId: id, userId, raison, siteId,
        champModifie:   "nombreMorts",
        ancienneValeur: String(ancienCalibrage.nombreMorts),
        nouvelleValeur: String(data.nombreMorts),
      })

    Si data.notes !== undefined && data.notes !== ancienCalibrage.notes :
      traces.push({
        calibrageId: id, userId, raison, siteId,
        champModifie:   "notes",
        ancienneValeur: ancienCalibrage.notes ?? null,
        nouvelleValeur: data.notes ?? null,
      })

    Si data.groupes !== undefined :
      // Trace globale pour le remplacement des groupes (JSON complet)
      traces.push({
        calibrageId: id, userId, raison, siteId,
        champModifie:   "groupes",
        ancienneValeur: JSON.stringify(ancienCalibrage.groupes.map(g => ({
          categorie: g.categorie,
          destinationBacId: g.destinationBacId,
          nombrePoissons: g.nombrePoissons,
          poidsMoyen: g.poidsMoyen,
          tailleMoyenne: g.tailleMoyenne,
        }))),
        nouvelleValeur: JSON.stringify(data.groupes),
      })

    Si traces.length === 0 :
      throw "Aucun champ n'a été modifié"  (→ 400)

    tx.calibrageModification.createMany({ data: traces })

9d. Fetch du calibrage mis à jour avec toutes ses relations :
    tx.calibrage.findFirst({
      where: { id, siteId },
      include: {
        vague: { select: { id: true, code: true } },
        user:  { select: { id: true, name: true } },
        groupes: { include: { destinationBac: { select: { id: true, nom: true } } } },
        modifications: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    })

FIN TRANSACTION
```

#### 5c. Extension de `getCalibrageById`

```typescript
// Remplacer l'include existant par :
include: {
  vague:  { select: { id: true, code: true } },
  user:   { select: { id: true, name: true } },
  groupes: {
    include: { destinationBac: { select: { id: true, nom: true } } },
  },
  modifications: {
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  },
}
```

---

### 6. Permissions — attribution par rôle

#### Nouveau groupe dans `PERMISSION_GROUPS`

Fichier : `src/lib/permissions-constants.ts`

```typescript
// Dans le groupe elevage, ajouter après CALIBRAGES_CREER :
Permission.CALIBRAGES_MODIFIER,
```

#### Attribution par rôle système

| Rôle système | `CALIBRAGES_MODIFIER` | Justification |
|---|---|---|
| Administrateur | Oui | `Object.values(Permission)` — inclus automatiquement |
| Gérant | Oui | Filtrage seulement `SITE_GERER` et `MEMBRES_GERER` — inclus |
| Pisciculteur | Non | Permissions listées explicitement — non inclus |

Le rôle Pisciculteur n'a pas `CALIBRAGES_MODIFIER` dans `SYSTEM_ROLE_DEFINITIONS` — cohérent avec l'absence de `RELEVES_MODIFIER` pour ce rôle (ADR-014).

---

### 7. UI (spécification — implémentation par @developer)

#### 7a. Dialog de modification

Composant : `src/components/calibrage/modifier-calibrage-dialog.tsx`

```
Déclencheur : bouton "Modifier" sur la page détail /vagues/[id]/calibrage/[calibrageId]
  → visible uniquement si user a CALIBRAGES_MODIFIER
  → <DialogTrigger asChild> (règle R5)

Dialog (Radix UI Dialog) — plein écran mobile, max-w-2xl desktop :
  Titre : "Modifier le calibrage"
  Sous-titre : "Toutes les modifications sont tracées pour l'audit"

  Section 1 — Raison (obligatoire, EN PREMIER)
    Label : "Raison de la modification *"
    Textarea (4 lignes min, 500 chars max, compteur de caractères)
    Validation inline : rouge si < 5 chars, message "Minimum 5 caractères"

  Section 2 — Nombre de morts
    Label : "Nombre de mortalités"
    Input number >= 0
    Pré-rempli avec ancienCalibrage.nombreMorts
    Validation conservation en temps réel (afficher le total actuel vs attendu)

  Section 3 — Groupes (accordéon ou liste éditable)
    Toggle "Modifier les groupes" (checkbox) — expansible
    Si coché :
      Liste des groupes existants pré-remplis, modifiables
      Chaque groupe : categorie (Select), destinationBacId (Select), nombrePoissons, poidsMoyen, tailleMoyenne?
      Afficher en bas : "Conservation : X / Y poissons" (rouge si X ≠ Y)

  Section 4 — Notes
    Label : "Notes"
    Textarea optionnel
    Pré-rempli avec ancienCalibrage.notes

  Actions :
    [Annuler]  [Enregistrer les modifications]
    → Désactiver "Enregistrer" si conservation invalide ou raison < 5 chars
    → Spinner pendant l'appel PATCH
    → Toast succès (Radix UI Toast) : "Calibrage modifié"
    → Toast erreur : message d'erreur de l'API
    → Fermeture du dialog et refresh de la page détail au succès
```

**Règle UX :** la raison est le premier champ — intention de traçabilité explicite (même principe que ADR-014 section 7d).

#### 7b. Historique des modifications

Composant : `src/components/calibrage/calibrage-modifications-list.tsx`

```
Section "Historique des modifications" sur la page détail
  Visible si calibrage.modifie = true (ou modifications.length > 0)

Pour chaque CalibrageModification (ordre chronologique inverse) :
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Jean Dupont — 18 mar. 2026 à 16h45                                   │
  │ Raison : "Erreur de comptage des mortalités lors du calibrage"        │
  │                                                                      │
  │ nombreMorts    5  →  3                                                │
  │ groupes        [JSON complet avant] → [JSON complet après]            │
  └──────────────────────────────────────────────────────────────────────┘

Pour le champ "groupes" (JSON complexe) :
  Afficher un diff simplifié ou un bouton "Voir le détail" ouvrant un sous-dialog
  Ne pas afficher le JSON brut — trop illisible sur mobile
```

#### 7c. Badge "Modifié" dans les listes

Dans `src/components/calibrage/calibrage-card.tsx` :

```typescript
{calibrage.modifie && <Badge variant="warning">Modifié</Badge>}
```

Dans `src/components/calibrage/calibrages-list.tsx` : idem.

#### 7d. Indicateur de conservation en temps réel (UX critique)

La validation de la conservation doit être visible avant la soumission. Composant inline dans le dialog :

```
┌─────────────────────────────────────────────────────┐
│ Conservation des poissons                           │
│ Total source : 120 poissons                         │
│ Groupes : 112  +  Morts : 3  =  115 ✗              │
│ Il manque 5 poissons pour respecter la conservation │
└─────────────────────────────────────────────────────┘
```

Rouge si invalide, vert si valide. Le bouton "Enregistrer" est désactivé tant que la conservation n'est pas respectée.

---

### 8. Sécurité

| Vérification | Où | Comment |
|---|---|---|
| Authentification | Route PATCH | `requirePermission` → 401 si pas de session |
| Autorisation | Route PATCH | `Permission.CALIBRAGES_MODIFIER` → 403 si absent |
| Isolation site | Query layer étape 1 | `where: { id, siteId }` → 404 si hors site |
| Raison obligatoire | Route PATCH | Validation longueur min 5 → 400 |
| Champs immuables | Route PATCH | Rejet explicite avec 400 |
| Conservation | Query layer étape 4 | Vérification dans la transaction → 400 |
| Vague EN_COURS | Query layer étape 1 | Statut vérifié en début de transaction → 409 |
| Bacs dans la vague | Query layer étape 5 | Vérification dans la transaction → 400 |

---

### 9. Impact sur le moteur d'activités

Les calibrages modifient potentiellement les relevés BIOMETRIE et COMPTAGE auto-créés. Ces relevés alimentent les règles `SEUIL_POIDS` et `FCR_ELEVE`.

**Pattern identique à ADR-014 section 9 :** `triggerSeuilRulesAsync` appelé en fire-and-forget depuis la route PATCH si `data.groupes` ou `data.nombreMorts` sont fournis.

| Champ modifié | Règles potentiellement re-évaluées |
|---|---|
| `groupes` (poidsMoyen) | SEUIL_POIDS, FCR_ELEVE (biométrie recalculée) |
| `groupes` (nombrePoissons) | SEUIL_MORTALITE (comptage recalculé) |
| `nombreMorts` | SEUIL_MORTALITE |
| `notes` seules | Aucune |

**Limitation v1 documentée :** les activités déjà générées par les relevés auto-créés originaux ne sont pas auto-annulées. L'utilisateur doit les annuler manuellement si les corrections changent les seuils franchis.

---

### 10. Limitations v1 documentées

| Limitation | Impact | Solution future |
|---|---|---|
| Restauration des sources approximative (multi-sources) | Si le calibrage avait plusieurs bacs sources, la restauration met le total sur le premier source | Ajouter `sourceBacsSnapshot JSON?` sur Calibrage pour stocker `Map<bacId, nombrePoissons>` au moment de la création |
| Identification des relevés auto-créés par heuristique (notes + date) | Fragile si plusieurs calibrages le même jour | Ajouter `calibrageId String?` sur le modèle `Releve` |
| Activités déclenchées par les anciens relevés non auto-annulées | Planning peut contenir des activités obsolètes | Système d'annulation automatique en Sprint 28+ |

---

## Fichiers à créer

| Fichier | Type | Responsable |
|---------|------|-------------|
| `prisma/migrations/20260318300000_add_calibrage_modification/migration.sql` | Migration SQL | @db-specialist |
| `src/components/calibrage/modifier-calibrage-dialog.tsx` | Client Component | @developer |
| `src/components/calibrage/calibrage-modifications-list.tsx` | Component | @developer |

## Fichiers à modifier

| Fichier | Modification | Responsable |
|---------|-------------|-------------|
| `prisma/schema.prisma` | Ajouter `CALIBRAGES_MODIFIER` à enum Permission + `modifie`/`modifications` sur Calibrage + modèle `CalibrageModification` | @db-specialist |
| `src/types/models.ts` | Ajouter `CALIBRAGES_MODIFIER` à enum Permission, `modifie`+`modifications?` sur `Calibrage`, interfaces `CalibrageModification`, `CalibrageModificationWithUser`, `CalibrageWithModifications` | @architect |
| `src/types/api.ts` | Ajouter `UpdateCalibrageGroupeDTO`, `PatchCalibrageBody`, `CreateCalibrageModificationDTO`, `PatchCalibrageResponse` | @architect |
| `src/types/index.ts` | Barrel exports des nouveaux types | @architect |
| `src/lib/queries/calibrages.ts` | Ajouter `patchCalibrage`, étendre `getCalibrageById` (include modifications) | @db-specialist |
| `src/app/api/calibrages/[id]/route.ts` | Ajouter export `PATCH` | @developer |
| `src/lib/permissions-constants.ts` | Ajouter `CALIBRAGES_MODIFIER` dans le groupe `elevage` de `PERMISSION_GROUPS` | @developer |
| `src/components/calibrage/calibrage-card.tsx` | Badge "Modifié" | @developer |
| `src/components/calibrage/calibrages-list.tsx` | Badge "Modifié" | @developer |
| `src/app/vagues/[id]/calibrage/[calibrageId]/page.tsx` | Bouton Modifier + section Historique | @developer |

---

## Alternatives considérées

### A — Autoriser la modification des bacs sources

Rejetée. Modifier `sourceBacIds` après un calibrage remet en cause l'historique complet (qui était dans quel bac avant). L'intégrité de l'audit exige que les sources soient immuables.

### B — Transaction de rollback complet (supprimer + recréer)

Rejetée. Supprimer le calibrage et en créer un nouveau perdrait l'ID du calibrage original et l'historique des modifications. La transaction de modification est plus complexe mais préserve la continuité.

### C — Une ligne `CalibrageModification` par opération (JSON diff complet)

Partiellement retenu pour le champ `groupes` (JSON serialized) — la structure groupes est trop complexe pour une trace par sous-champ sans modèle `CalibrageGroupeModification` dédié. Les champs scalaires (`nombreMorts`, `notes`) restent en mode granulaire par champ.

### D — Stocker `calibrageId` sur les relevés auto-créés

Non retenu pour v1 (nécessite migration du modèle `Releve`). Documenté comme solution durable pour Sprint suivant.

### E — Interdire la modification si des relevés secondaires ont été modifiés

Trop restrictif. Un utilisateur qui a modifié manuellement un relevé BIOMETRIE après le calibrage ne devrait pas être bloqué. La v1 accepte la modification et écrase les relevés auto-créés seulement (identifiés par heuristique notes+date).

---

## Conséquences

### Positives
- Audit complet de toutes les corrections de calibrages (qui, quand, pourquoi)
- Le flag `modifie` permet un badge instantané dans les listes sans JOIN
- La conservation des poissons est maintenue à travers toutes les modifications
- Cohérence avec le pattern ADR-014 — même vocabulaire, même ergonomie pour les utilisateurs
- La `CALIBRAGES_MODIFIER` permission suit le modèle RBAC existant du projet

### Négatives
- Transaction la plus complexe du projet (9 étapes, effets secondaires multiples)
- Restauration des bacs sources approximative en cas de sources multiples (limitation v1)
- Identification des relevés auto-créés par heuristique fragile (limitation v1)
- Volume de données augmenté (JSON complet des groupes dans les traces)
- Pas de `calibrageId` sur `Releve` — la liaison calibrage/relevé est implicite
