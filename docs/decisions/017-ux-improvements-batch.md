# ADR-017 — Lot d'améliorations UX (5 features)

**Date :** 2026-03-18
**Statut :** PROPOSE
**Auteur :** @architect
**Sprint cible :** Sprint 27

---

## Contexte et périmètre

Cinq demandes d'amélioration UX ont été identifiées par les utilisateurs après les sprints 24-26.
Cet ADR analyse l'état actuel du codebase pour chacune, décrit les changements nécessaires,
et établit un ordre de priorité d'implémentation.

---

## 1. Choix de la date lors d'une prise de relevé

### État actuel

La date du relevé est auto-générée côté backend, commentée "CR-005" dans `src/lib/queries/releves.ts` :

```typescript
// Date auto-generee cote backend (CR-005)
const now = new Date();
```

L'interface `CreateReleveBase` dans `src/types/api.ts` ne contient pas de champ `date`.
La route `PUT /api/releves/[id]` rejette explicitement le champ `date` comme non modifiable.
La route `PATCH` (ADR-014) inclut `"date"` dans `NON_MODIFIABLE_FIELDS`.

Le formulaire `ReleveFormClient` ne propose aucun sélecteur de date.

### Problème

Les pisciculteurs saisissent souvent les relevés en différé (le soir, le lendemain).
La date auto-générée est celle de la saisie, pas celle de l'observation réelle.
Cela fausse les indicateurs temporels (SGR, courbes de croissance, FCR par période).

### Décision

Permettre la saisie d'une date dans le formulaire de création uniquement.
La date reste non modifiable après création (cohérence avec ADR-014 sur la traçabilité).

**Contrainte :** La date saisie ne peut pas être dans le futur.
**Contrainte :** La date saisie ne peut pas être antérieure à la `dateDebut` de la vague.

### Changements DB

Aucun — le champ `date DateTime` existe déjà sur le modèle `Releve`. Pas de migration nécessaire.

### Changements API

**`CreateReleveBase` dans `src/types/api.ts` :**

```typescript
interface CreateReleveBase {
  vagueId: string;
  bacId: string;
  notes?: string;
  consommations?: CreateReleveConsommationDTO[];
  activiteId?: string;
  /** Date du relevé (ISO 8601, optionnel — défaut : maintenant).
   * Ne peut pas être dans le futur.
   * Ne peut pas être antérieure à la dateDebut de la vague.
   */
  date?: string;
}
```

**`POST /api/releves/route.ts` :**

Ajouter la validation du champ `date` optionnel avant la construction du DTO :

```typescript
// Validation date optionnelle
let releveDate: Date | undefined;
if (body.date != null) {
  const parsed = new Date(body.date);
  if (isNaN(parsed.getTime())) {
    errors.push({ field: "date", message: "Date invalide (format ISO 8601 attendu)." });
  } else if (parsed > new Date()) {
    errors.push({ field: "date", message: "La date du relevé ne peut pas être dans le futur." });
  } else {
    releveDate = parsed;
  }
}
```

La validation "antérieure à dateDebut" est faite dans la query (accès à la vague).

**`src/lib/queries/releves.ts` — `createReleve` :**

```typescript
// Date : saisie si fournie et valide, sinon maintenant
const releveDate = data.date ? new Date(data.date) : new Date();

// Validation : la date ne peut pas être antérieure à la dateDebut de la vague
if (releveDate < vague.dateDebut) {
  throw new Error(
    `La date du relevé ne peut pas être antérieure au début de la vague (${vague.dateDebut.toISOString()}).`
  );
}
```

### Changements UI

**`ReleveFormClient` :**

Ajouter un champ `<Input type="date">` entre le sélecteur de bac et le sélecteur de type.
Valeur par défaut : date du jour (format `YYYY-MM-DD`).
Attribut `max` : date du jour.

```tsx
<FormSection title="Date du relevé">
  <Input
    type="date"
    value={releveDate}
    onChange={(e) => setReleveDate(e.target.value)}
    max={new Date().toISOString().split("T")[0]}
  />
</FormSection>
```

Le champ `date` est envoyé dans le corps de la requête POST uniquement s'il diffère de la date du jour (ou toujours, pour la clarté).

### Interfaces TypeScript

```typescript
// Ajout dans CreateReleveBase (src/types/api.ts)
interface CreateReleveBase {
  vagueId: string;
  bacId: string;
  notes?: string;
  consommations?: CreateReleveConsommationDTO[];
  activiteId?: string;
  date?: string; // ISO 8601, optionnel, pas dans le futur, >= vague.dateDebut
}
```

### Impact sur le schéma Prisma

Aucune migration requise.

---

## 2. Date limite sur les besoins + alertes

### État actuel

Le modèle `ListeBesoins` dans `prisma/schema.prisma` ne contient aucun champ `dateLimite` ni `dateEcheance`.

```prisma
model ListeBesoins {
  id            String        @id @default(cuid())
  numero        String        @unique
  titre         String
  statut        StatutBesoins @default(SOUMISE)
  montantEstime Float         @default(0)
  montantReel   Float?
  motifRejet    String?
  notes         String?
  // ... relations
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}
```

L'enum `TypeAlerte` ne contient pas de valeur `BESOIN_EN_RETARD`.
Le système d'alertes (`src/lib/alertes.ts`) n'a pas de logique pour les besoins.

### Décision

1. Ajouter `dateLimite DateTime?` sur `ListeBesoins`.
2. Ajouter `BESOIN_EN_RETARD` dans l'enum `TypeAlerte`.
3. Ajouter une fonction `verifierBesoinsEnRetard` dans `src/lib/alertes.ts`.
4. Déclencher cette vérification via le cron d'alertes existant ou un endpoint dédié.

**Règle métier :** Un besoin est "en retard" si son statut est `SOUMISE` ou `APPROUVEE` et que `dateLimite < now()`. Les statuts terminaux (`TRAITEE`, `CLOTUREE`, `REJETEE`) ne déclenchent pas d'alerte.

**Déduplication :** Une seule notification active par liste de besoins par jour (même pattern que les alertes existantes).

### Changements DB

**Migration : `20260319120000_add_besoin_date_limite`**

```sql
-- Ajouter dateLimite sur ListeBesoins
ALTER TABLE "ListeBesoins" ADD COLUMN "dateLimite" TIMESTAMP(3);
CREATE INDEX "ListeBesoins_dateLimite_idx" ON "ListeBesoins"("dateLimite");

-- Ajouter BESOIN_EN_RETARD dans TypeAlerte
-- Utiliser le pattern RECREATE (ADR mémoire DB specialist)
ALTER TYPE "TypeAlerte" RENAME TO "TypeAlerte_old";
CREATE TYPE "TypeAlerte" AS ENUM (
  'MORTALITE_ELEVEE', 'QUALITE_EAU', 'STOCK_BAS',
  'RAPPEL_ALIMENTATION', 'RAPPEL_BIOMETRIE', 'FCR_ELEVE',
  'BESOIN_EN_RETARD'
);
ALTER TABLE "ConfigAlerte"
  ALTER COLUMN "typeAlerte" TYPE "TypeAlerte"
  USING "typeAlerte"::text::"TypeAlerte";
ALTER TABLE "Notification"
  ALTER COLUMN "typeAlerte" TYPE "TypeAlerte"
  USING "typeAlerte"::text::"TypeAlerte";
DROP TYPE "TypeAlerte_old";
```

**`prisma/schema.prisma` — `ListeBesoins` :**

```prisma
model ListeBesoins {
  // ... champs existants
  /** Date limite de traitement (optionnelle) */
  dateLimite     DateTime?
  // ...
  @@index([dateLimite])
}
```

**`src/types/models.ts` — `TypeAlerte` :**

```typescript
export enum TypeAlerte {
  MORTALITE_ELEVEE = "MORTALITE_ELEVEE",
  QUALITE_EAU = "QUALITE_EAU",
  STOCK_BAS = "STOCK_BAS",
  RAPPEL_ALIMENTATION = "RAPPEL_ALIMENTATION",
  RAPPEL_BIOMETRIE = "RAPPEL_BIOMETRIE",
  FCR_ELEVE = "FCR_ELEVE",
  BESOIN_EN_RETARD = "BESOIN_EN_RETARD", // NOUVEAU
}
```

### Changements API

**`POST /api/besoins/route.ts` :** Accepter `dateLimite` dans le body (ISO 8601, doit être dans le futur).

**`PUT /api/besoins/[id]/route.ts` :** Accepter `dateLimite` dans la modification (si statut SOUMISE).

**`GET /api/besoins/route.ts` :** Ajouter filtre `enRetard=true` (besoins avec `dateLimite < now()` et statut non terminal).

**Nouveau endpoint : `POST /api/alertes/besoins/route.ts`**

```typescript
// Déclenche la vérification des besoins en retard pour le site actif
// Permission : ALERTES_CONFIGURER ou appelé par cron système
export async function POST(request: NextRequest) { ... }
```

Ou intégrer dans la logique de `src/lib/alertes.ts` :

```typescript
export async function verifierBesoinsEnRetard(siteId: string): Promise<void> {
  const maintenant = new Date();
  const statutsActifs = [StatutBesoins.SOUMISE, StatutBesoins.APPROUVEE];

  const besoinsEnRetard = await prisma.listeBesoins.findMany({
    where: {
      siteId,
      statut: { in: statutsActifs },
      dateLimite: { lt: maintenant, not: null },
    },
    include: {
      demandeur: { select: { id: true } },
    },
  });

  for (const besoin of besoinsEnRetard) {
    await creerNotificationSiAbsente(
      siteId,
      besoin.demandeur.id,
      TypeAlerte.BESOIN_EN_RETARD,
      `Besoin en retard : ${besoin.numero}`,
      `La liste de besoins "${besoin.titre}" (${besoin.numero}) n'a pas été traitée avant la date limite du ${besoin.dateLimite!.toLocaleDateString("fr-FR")}.`,
    );
  }
}
```

### Changements UI

**`BesoinsFormClient` :** Ajouter un champ `<Input type="date">` optionnel "Date limite" dans le formulaire de création.

**`BesoinsDetailClient` :** Afficher la date limite avec indicateur visuel (badge rouge si dépassée, orange si dans les 2 jours).

**`BesoinsListClient` :** Afficher un badge "En retard" sur les cartes concernées.

### Interfaces TypeScript

```typescript
// Ajouter dans CreateListeBesoinsDTO (src/types/api.ts)
export interface CreateListeBesoinsDTO {
  titre: string;
  vagueId?: string;
  lignes: CreateLigneBesoinDTO[];
  notes?: string;
  /** Date limite de traitement (ISO 8601, optionnelle, doit être dans le futur) */
  dateLimite?: string;
}

// Ajouter dans UpdateListeBesoinsDTO
export interface UpdateListeBesoinsDTO {
  titre?: string;
  vagueId?: string | null;
  notes?: string | null;
  lignes?: CreateLigneBesoinDTO[];
  /** Modifier la date limite (null = supprimer) */
  dateLimite?: string | null;
}

// Ajouter dans ListeBesoinsFilters
export interface ListeBesoinsFilters {
  statut?: StatutBesoins;
  demandeurId?: string;
  vagueId?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Filtrer les besoins dont la dateLimite est dépassée et statut non terminal */
  enRetard?: boolean;
}
```

### Impact sur le schéma Prisma

Migration requise : ajout de `dateLimite DateTime?` sur `ListeBesoins` + recreation de l'enum `TypeAlerte`.

---

## 3. Modification d'un besoin existant

### État actuel

L'API `PUT /api/besoins/[id]` existe et appelle `updateListeBesoins`, qui impose :

```typescript
if (liste.statut !== StatutBesoins.SOUMISE) {
  throw new Error("Impossible de modifier une liste qui n'est plus SOUMISE");
}
```

La page `src/app/besoins/[id]/page.tsx` ne passe pas `canEdit` au composant `BesoinsDetailClient`.
Le composant `BesoinsDetailClient` affiche des boutons d'action (Approuver, Rejeter, Traiter) mais pas de bouton "Modifier".
Le formulaire de création `/besoins/nouveau/page.tsx` n'est pas conçu pour pré-remplir un besoin existant.

### Décision

La logique API est déjà en place. Il manque uniquement la couche UI :
1. Passer `canEdit` depuis la page serveur vers `BesoinsDetailClient`.
2. Afficher un bouton "Modifier" si `canEdit && statut === SOUMISE`.
3. Ouvrir un Dialog (Radix) contenant le formulaire d'édition (réutilisation partielle de `BesoinsFormClient`).

**Alternative envisagée :** Utiliser `/besoins/[id]/modifier` comme page séparée.
**Décision retenue :** Dialog inline dans `BesoinsDetailClient`, plus fluide sur mobile.

**Règle :** Seul le `demandeurId` de la liste ou un utilisateur avec `BESOINS_APPROUVER` peut modifier. Cette règle est à vérifier côté API.

**Complément API :** Ajouter validation ownership dans `updateListeBesoins` :

```typescript
// Dans updateListeBesoins, après vérification du statut
if (liste.demandeurId !== userId && !canApprove) {
  throw new Error("Seul le demandeur peut modifier cette liste.");
}
```

Cela implique de passer `userId` et `canApprove` à la query (actuellement absent).

### Changements DB

Aucune migration requise.

### Changements API

**`PUT /api/besoins/[id]/route.ts` :** Faire passer `userId` à `updateListeBesoins` pour la vérification d'ownership.

**`src/lib/queries/besoins.ts` — `updateListeBesoins` :**

```typescript
export async function updateListeBesoins(
  id: string,
  siteId: string,
  userId: string,       // NOUVEAU
  canApprove: boolean,  // NOUVEAU
  data: UpdateListeBesoinsDTO
) {
  return prisma.$transaction(async (tx) => {
    const liste = await tx.listeBesoins.findFirst({ where: { id, siteId } });
    if (!liste) throw new Error("Liste de besoins introuvable");
    if (liste.statut !== StatutBesoins.SOUMISE) {
      throw new Error("Impossible de modifier une liste qui n'est plus SOUMISE");
    }
    if (liste.demandeurId !== userId && !canApprove) {
      throw new Error("Seul le demandeur peut modifier cette liste.");
    }
    // ... reste inchangé
  });
}
```

### Changements UI

**`src/app/besoins/[id]/page.tsx` :**

```typescript
const canEdit = permissions.includes(Permission.BESOINS_SOUMETTRE) &&
  (listeBesoins.demandeurId === session.userId || canApprove);
```

Passer `canEdit` à `BesoinsDetailClient`.

**`BesoinsDetailClient` :** Nouveau Dialog "Modifier la liste" avec :

- Champ `titre` (Input)
- Champ `dateLimite` (Input type date, si ADR-017.2 implémenté)
- Champ `notes` (Textarea)
- Tableau de lignes modifiables (même structure que le formulaire de création)
- Boutons "Annuler" et "Enregistrer"

Ce Dialog doit utiliser le pattern `<DialogTrigger asChild>` (R5).

### Interfaces TypeScript

Pas de nouveau type requis — `UpdateListeBesoinsDTO` est déjà défini (modifié au point 2 pour ajouter `dateLimite`).

### Impact sur le schéma Prisma

Aucune migration requise.

---

## 4. Modification en lot (bulk edit) de besoins

### État actuel

Aucune route de bulk edit n'existe pour les besoins.
La liste `BesoinsListClient` n'a pas de mécanisme de sélection multiple.
Toutes les opérations se font liste par liste.

### Décision

Implémenter un bulk edit limité à **deux opérations** :
1. **Bulk update `dateLimite`** : appliquer la même date limite à plusieurs listes sélectionnées (utile pour une semaine de besoins similaires).
2. **Bulk delete** : supprimer plusieurs listes en statut `SOUMISE`.

Le bulk edit complet de lignes (contenu) est trop complexe sur mobile et hors scope.

**Pattern de sélection UI :** Cases à cocher sur chaque carte (apparaissent en mode "sélection"). Un bouton "Sélectionner" toggle le mode sélection. Sur mobile : tap long sur une carte active le mode sélection (progressif).

### Changements DB

Aucune migration requise.

### Changements API

**Nouveau endpoint : `PATCH /api/besoins/bulk/route.ts`**

```typescript
// Permission : BESOINS_SOUMETTRE
// Corps :
export interface BulkUpdateBesoinsDTO {
  /** IDs des listes à modifier (toutes doivent appartenir au site et être SOUMISE) */
  ids: string[];
  /** Opération à effectuer */
  operation: "SET_DATE_LIMITE" | "DELETE";
  /** Date limite à appliquer (requis si operation === SET_DATE_LIMITE) */
  dateLimite?: string;
}

// Réponse :
export interface BulkUpdateBesoinsResponse {
  updated: number;
  skipped: number;  // IDs ignorés (statut non SOUMISE, ou non ownership)
  errors: { id: string; message: string }[];
}
```

**`src/lib/queries/besoins.ts` — nouvelle fonction :**

```typescript
export async function bulkUpdateBesoins(
  siteId: string,
  userId: string,
  dto: BulkUpdateBesoinsDTO
): Promise<BulkUpdateBesoinsResponse> {
  // Vérifier que toutes les listes appartiennent au site et sont SOUMISE
  // Utiliser updateMany avec where: { id: { in: dto.ids }, siteId, statut: SOUMISE }
  // R4 : opération atomique
}
```

### Changements UI

**`BesoinsListClient` :**

- Bouton "Sélectionner" dans le header.
- En mode sélection : checkboxes sur chaque carte, barre d'actions en bas (sticky, mobile-first).
- Barre d'actions : "Appliquer date limite" (ouvre un DatePicker), "Supprimer", "Annuler".
- Compteur du nombre d'items sélectionnés.

```tsx
// Barre d'actions sticky en bas (mobile-first)
{selectionMode && selectedIds.length > 0 && (
  <div className="fixed bottom-16 left-0 right-0 z-50 bg-background border-t p-3 flex gap-2 justify-between items-center">
    <span className="text-sm font-medium">{selectedIds.length} sélectionné(s)</span>
    <div className="flex gap-2">
      <BulkDateLimiteDialog ids={selectedIds} onSuccess={handleBulkSuccess} />
      <BulkDeleteDialog ids={selectedIds} onSuccess={handleBulkSuccess} />
    </div>
  </div>
)}
```

### Interfaces TypeScript

```typescript
// Nouveau dans src/types/api.ts

export type BulkBesoinsOperation = "SET_DATE_LIMITE" | "DELETE";

export interface BulkUpdateBesoinsDTO {
  ids: string[];
  operation: BulkBesoinsOperation;
  dateLimite?: string; // ISO 8601, requis si operation === SET_DATE_LIMITE
}

export interface BulkUpdateBesoinsResponse {
  updated: number;
  skipped: number;
  errors: { id: string; message: string }[];
}
```

### Impact sur le schéma Prisma

Aucune migration requise (mais dépend de ADR-017.2 pour l'opération `SET_DATE_LIMITE`).

---

## 5. Dépenses récurrentes — intégration dans la page principale

### État actuel — PARTIELLEMENT IMPLÉMENTÉ

L'investigation du codebase révèle que la feature de dépenses récurrentes est **substantiellement implémentée** :

| Couche | Fichier | Statut |
|--------|---------|--------|
| Schéma Prisma | `model DepenseRecurrente` | Implémenté |
| Queries | `src/lib/queries/depenses-recurrentes.ts` | Complet (CRUD + `genererDepensesRecurrentes`) |
| API CRUD | `src/app/api/depenses-recurrentes/route.ts` | Complet |
| API item | `src/app/api/depenses-recurrentes/[id]/route.ts` | Complet |
| API génération | `src/app/api/depenses-recurrentes/generer/route.ts` | Présent |
| Page dédiée | `src/app/depenses/recurrentes/page.tsx` | Implémenté |
| Composant liste | `src/components/depenses/recurrentes-list-client.tsx` | Implémenté (CRUD Dialog inline) |

**Ce qui manque :**

La page principale `/depenses/page.tsx` et son composant `DepensesListClient` n'ont pas de lien/tab vers les dépenses récurrentes. L'utilisateur doit connaître l'URL `/depenses/recurrentes` pour y accéder.

### Décision

Ne pas dupliquer la logique. Ajouter uniquement un **lien de navigation** depuis la page principale des dépenses vers la page des dépenses récurrentes. Deux options :

**Option A — Tab supplémentaire dans `DepensesListClient` :**
Ajouter un 5e onglet "Récurrentes" dans les Tabs existants, qui affiche la liste des templates avec un lien vers `/depenses/recurrentes` ou intègre directement `RecurrentesListClient`.

**Option B — Bouton/lien dans le header de la page :**
Ajouter un bouton secondaire "Dépenses récurrentes →" dans le header de `DepensesListClient`.

**Décision retenue : Option B (lien header)**, moins invasive, plus rapide à implémenter, conserve la cohérence actuelle des tabs (statuts de paiement).

Sur mobile, le lien sera présenté comme une `Card` cliquable distincte au-dessus des tabs (pattern "accès rapide").

### Changements DB

Aucune migration requise.

### Changements API

Aucun changement d'API requis — toutes les routes existent.

**Vérification :** S'assurer que la route `GET /api/depenses-recurrentes` fonctionne correctement (déjà implémentée).

### Changements UI

**`src/components/depenses/depenses-list-client.tsx` :**

Ajouter dans le header, après le sélecteur de catégorie et avant le bouton "Nouvelle" :

```tsx
{canManage && (
  <Link href="/depenses/recurrentes">
    <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
      <RefreshCw className="h-4 w-4" />
      <span className="hidden sm:inline">Récurrentes</span>
    </Button>
  </Link>
)}
```

Sur mobile (< 360px), le bouton affiche uniquement l'icône.
Sur la page `/depenses/recurrentes`, un bouton retour "← Dépenses" est déjà présent via le Header.

**Accessibilité mobile :** Ajouter une `Card` d'accès rapide en tête de page pour les utilisateurs qui voient `/depenses` et cherchent les récurrentes :

```tsx
{/* Accès rapide aux récurrentes — visible si templates actifs > 0 */}
{templatesActifsCount > 0 && (
  <Link href="/depenses/recurrentes">
    <Card className="bg-muted/40 border-dashed cursor-pointer hover:bg-muted/60">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <span>{templatesActifsCount} dépense(s) récurrente(s) configurée(s)</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </CardContent>
    </Card>
  </Link>
)}
```

Cela nécessite de passer `templatesActifsCount` depuis la page serveur.

**`src/app/depenses/page.tsx` :**

```typescript
const [depenses, templates] = await Promise.all([
  getDepenses(session.activeSiteId),
  getDepensesRecurrentes(session.activeSiteId, true), // onlyActive = true
]);

// Passer le count au composant
<DepensesListClient
  depenses={JSON.parse(JSON.stringify(depenses))}
  canManage={canManage}
  canPay={canPay}
  templatesActifsCount={templates.length}  // NOUVEAU
/>
```

### Interfaces TypeScript

```typescript
// Modifier Props dans DepensesListClient
interface Props {
  depenses: DepenseData[];
  canManage: boolean;
  canPay: boolean;
  templatesActifsCount?: number; // NOUVEAU — optionnel pour rétrocompatibilité
}
```

### Impact sur le schéma Prisma

Aucune migration requise.

---

## Synthèse des changements par couche

### Migrations Prisma nécessaires

| Migration | Feature | Contenu |
|-----------|---------|---------|
| `20260319120000_add_besoin_date_limite` | ADR-017.2 | `dateLimite` sur `ListeBesoins` + recreation enum `TypeAlerte` |

### Nouveaux endpoints API

| Route | Méthode | Feature |
|-------|---------|---------|
| `POST /api/alertes/besoins` | POST | ADR-017.2 — vérification besoins en retard |
| `PATCH /api/besoins/bulk` | PATCH | ADR-017.4 — bulk edit |

### Endpoints API modifiés

| Route | Modification | Feature |
|-------|-------------|---------|
| `POST /api/releves` | Accepter `date` optionnel | ADR-017.1 |
| `POST /api/besoins` | Accepter `dateLimite` optionnel | ADR-017.2 |
| `PUT /api/besoins/[id]` | Accepter `dateLimite`, passer `userId` | ADR-017.2 + 017.3 |

### Nouveaux types TypeScript

```typescript
// src/types/api.ts — ajouts
interface CreateReleveBase {
  date?: string; // ADR-017.1
}

interface CreateListeBesoinsDTO {
  dateLimite?: string; // ADR-017.2
}

interface UpdateListeBesoinsDTO {
  dateLimite?: string | null; // ADR-017.2
}

interface ListeBesoinsFilters {
  enRetard?: boolean; // ADR-017.2
}

export type BulkBesoinsOperation = "SET_DATE_LIMITE" | "DELETE"; // ADR-017.4
export interface BulkUpdateBesoinsDTO { ... } // ADR-017.4
export interface BulkUpdateBesoinsResponse { ... } // ADR-017.4
```

```typescript
// src/types/models.ts — ajouts
export enum TypeAlerte {
  // ...existants...
  BESOIN_EN_RETARD = "BESOIN_EN_RETARD", // ADR-017.2
}
```

---

## Ordre de priorité recommandé

| Priorité | Feature | Effort | Valeur | Dépendances |
|----------|---------|--------|--------|-------------|
| 1 | **017.5 — Dépenses récurrentes (lien nav)** | XS (< 1h) | Haute | Aucune — déjà implémenté côté back |
| 2 | **017.1 — Date du relevé** | S (2-3h) | Haute | Aucune |
| 3 | **017.3 — Modification d'un besoin** | S (2-3h) | Haute | ADR-017.2 pour dateLimite (peut être fait sans) |
| 4 | **017.2 — Date limite + alertes besoins** | M (4-6h) | Moyenne | Migration DB requise |
| 5 | **017.4 — Bulk edit besoins** | L (6-8h) | Moyenne | ADR-017.2 (pour SET_DATE_LIMITE) |

**Rationale :**

- 017.5 est presque un bug d'UX (la page existe, juste pas de lien) — à faire immédiatement.
- 017.1 résout un vrai problème de fiabilité des données (dates fausses = indicateurs faux).
- 017.3 est un oubli d'UI (la route API existe déjà).
- 017.2 est une vraie feature nouvelle avec migration DB.
- 017.4 est une amélioration de confort qui dépend de 017.2 pour être complète.

---

## Règles de développement applicables

| Règle | Application |
|-------|-------------|
| R1 | `BESOIN_EN_RETARD` en UPPERCASE dans l'enum |
| R2 | Utiliser `TypeAlerte.BESOIN_EN_RETARD` jamais `"BESOIN_EN_RETARD"` en dur |
| R4 | `updateMany` atomique pour le bulk edit (pas check-then-update) |
| R5 | `<DialogTrigger asChild>` pour tous les dialogs de modification |
| R7 | `dateLimite` nullable explicite dès le schéma |
| R8 | Tous les nouveaux endpoints vérifient `siteId` |
| R9 | Tests avant review : `npx vitest run` + `npm run build` |
