# ADR — Traçabilité de l'origine des dépenses (Besoin / Commande)

**Statut :** Proposé
**Date :** 2026-04-01
**Auteur :** @architect

---

## Contexte

Une dépense (`Depense`) peut naître de deux sources structurées dans le système :

1. **Une liste de besoins** (`ListeBesoins`) — lors du traitement d'une liste (passage au statut `TRAITEE`), une `Depense` est créée automatiquement et son `listeBesoinsId` est renseigné.
2. **Une commande fournisseur** (`Commande`) — lors de la création manuelle d'une dépense, l'utilisateur peut lier optionnellement une commande via `commandeId`.

Ces deux champs FK existent déjà dans le schéma Prisma et dans `src/types/models.ts`. Cependant, plusieurs couches de l'application ne les exploitent pas encore de façon cohérente, rendant la traçabilité partielle et invisible dans l'UI.

---

## Constat : état des lieux

### Ce qui existe déjà (aucune migration nécessaire)

| Couche | Champ | Présent |
|--------|-------|---------|
| `prisma/schema.prisma` | `Depense.commandeId` (FK nullable) | Oui |
| `prisma/schema.prisma` | `Depense.listeBesoinsId` (FK nullable) | Oui |
| `prisma/schema.prisma` | `ListeBesoins.depenses` (back-relation) | Oui |
| `prisma/schema.prisma` | `Commande.depenses` (back-relation) | Oui |
| `src/types/models.ts` | `Depense.commandeId / .listeBesoinsId` | Oui |
| `src/types/models.ts` | `Depense.commande? / .listeBesoins?` | Oui |
| `src/lib/queries/besoins.ts` — `traiterBesoins` | Passe `listeBesoinsId` lors de la création automatique | Oui |

### Ce qui est manquant ou incomplet

| Couche | Problème |
|--------|----------|
| `src/types/api.ts` — `CreateDepenseDTO` | `listeBesoinsId?` absent |
| `src/types/api.ts` — `DepenseFilters` | `listeBesoinsId?` absent |
| `src/lib/queries/depenses.ts` — `getDepenses` | `listeBesoins` absent du `include` |
| `src/lib/queries/depenses.ts` — `getDepenseById` | `listeBesoins` absent du `include` |
| `src/lib/queries/depenses.ts` — `createDepense` | `listeBesoinsId` non passé à `prisma.depense.create` |
| `src/lib/queries/depenses.ts` — `createDepense` | Pas de vérification que le `listeBesoinsId` appartient au site |
| `src/components/depenses/depense-detail-client.tsx` | Ligne "Origine : Besoin #XXX" absente |
| `src/components/depenses/depenses-list-client.tsx` | Badge origine besoin absent sur les cartes |
| `src/components/depenses/depense-form-client.tsx` | Aucun champ pour lier un besoin lors de la création manuelle |
| `src/lib/queries/besoins.ts` — `cloturerBesoins` | Ne crée pas de dépense avec `montantReel` à la clôture |

---

## Décision

### Principe directeur

L'origine d'une dépense doit être :
1. **Propagée automatiquement** lors des flux de création automatique (traitement besoin, réception commande).
2. **Sélectionnable manuellement** lors de la création d'une dépense libre.
3. **Affichée de façon consistante** partout où une dépense est visible, avec un lien navigable vers l'entité source.

### Règle de priorité des origines

Un `Depense` ne peut avoir qu'une seule origine structurée :
- Si `listeBesoinsId` est renseigné, l'origine est "Besoin".
- Sinon, si `commandeId` est renseigné, l'origine est "Commande".
- Sinon, la dépense est libre (origine libre — pas de lien structuré).

Ces deux champs ne sont pas mutuellement exclusifs au niveau schéma (Prisma accepterait les deux), mais **la règle métier les rend exclusifs** : on ne peut pas renseigner les deux simultanément. Cette contrainte est appliquée au niveau de l'API (validation dans la route POST `/api/depenses`) et dans `createDepense`.

---

## Plan de mise en oeuvre

### 1. Types (`src/types/api.ts`)

**`CreateDepenseDTO`** — ajouter `listeBesoinsId?` :

```typescript
export interface CreateDepenseDTO {
  description: string;
  categorieDepense: CategorieDepense;
  montantTotal: number;
  date: string;
  dateEcheance?: string;
  vagueId?: string;
  commandeId?: string;
  /** Lien optionnel vers la liste de besoins d'origine (exclusif avec commandeId) */
  listeBesoinsId?: string;
  notes?: string;
}
```

**`DepenseFilters`** — ajouter `listeBesoinsId?` :

```typescript
export interface DepenseFilters {
  categorieDepense?: CategorieDepense;
  statut?: StatutDepense;
  vagueId?: string;
  commandeId?: string;
  /** Filtrer les depenses liees a une liste de besoins */
  listeBesoinsId?: string;
  dateFrom?: string;
  dateTo?: string;
}
```

**`DepenseListItem`** (ou le type inline utilisé dans `depenses-list-client`) — ajouter :

```typescript
listeBesoinsId: string | null;
listeBesoins: { id: string; numero: string; titre: string } | null;
```

---

### 2. Queries (`src/lib/queries/depenses.ts`)

**`getDepenses`** — étendre le `include` et le filtre `where` :

```typescript
// Dans include :
listeBesoins: { select: { id: true, numero: true, titre: true } },

// Dans where :
...(filters?.listeBesoinsId && { listeBesoinsId: filters.listeBesoinsId }),
```

**`getDepenseById`** — étendre le `include` :

```typescript
listeBesoins: {
  select: { id: true, numero: true, titre: true, statut: true },
},
```

**`createDepense`** — ajouter :
1. Validation que `commandeId` et `listeBesoinsId` ne sont pas fournis simultanément (retourner une erreur métier).
2. Vérification que `listeBesoinsId` appartient au site si fourni.
3. Passer `listeBesoinsId: data.listeBesoinsId ?? null` dans `prisma.depense.create`.
4. Inclure `listeBesoins` dans le `include` du retour.

**`updateDepense`** — ne pas permettre la modification des champs d'origine (`commandeId`, `listeBesoinsId`) après création. Ces champs sont immuables une fois définis.

---

### 3. Flux automatiques (`src/lib/queries/besoins.ts`)

#### Flux `traiterBesoins` (APPROUVEE → TRAITEE)

Ce flux crée déjà une `Depense` avec `listeBesoinsId`. Il faut cependant :
- Passer la `categorieDepense` correcte (actuellement `AUTRE` en dur) — idéalement déduire de la catégorie dominante des produits sur les lignes, ou rester sur `AUTRE` si hétérogène.
- Renseigner `commandeId` sur les dépenses générées pour les lignes ayant `action = "COMMANDE"` si une commande est créée dans le même traitement.

Ce second point (lien `commandeId` sur dépenses de traitement) est hors périmètre de cet ADR — traité séparément si besoin.

#### Flux `cloturerBesoins` (TRAITEE → CLOTUREE)

La clôture met à jour les `prixReel` par ligne et calcule `montantReel`, mais **ne crée pas de nouvelle dépense**. Deux options :

**Option A (retenue) — Mettre à jour la dépense existante liée au besoin :**
Lors de la clôture, chercher la `Depense` liée au besoin (`listeBesoinsId = id`) et mettre à jour son `montantTotal` avec le `montantReel` calculé. Cela corrige le montant de la dépense de traitement (qui utilisait `montantEstime`).

**Option B (rejetée) — Créer une nouvelle dépense de clôture :**
Crée une duplication (deux dépenses pour un même besoin), ce qui complique les rapports financiers.

Implémentation Option A dans `cloturerBesoins` :
```typescript
// Après calcul de montantReel, mettre a jour la depense liee si elle existe
await tx.depense.updateMany({
  where: { listeBesoinsId: id, siteId },
  data: { montantTotal: montantReel },
});
```

---

### 4. API Route (`src/app/api/depenses/route.ts`)

Ajouter la validation du champ `listeBesoinsId` dans le handler `POST` :
- Type : `string | undefined`
- Contrainte : mutuellement exclusif avec `commandeId` (retourner 400 si les deux sont fournis)

---

### 5. UI — Composant `depense-detail-client.tsx`

Ajouter dans le bloc d'information (`<CardContent>`) une ligne "Origine" qui unifie les deux types de liens :

```
Origine    [lien vers Besoin BES-2026-001 — "Achat aliments"]   (si listeBesoinsId)
Origine    [lien vers Commande CMD-2026-001]                     (si commandeId)
           (rien si aucun)
```

- Lien besoin : `href="/besoins/{id}"`
- Lien commande : `href="/stock/commandes/{id}"`
- Icône : `ExternalLink` (déjà utilisée pour `commande`)

La section "Commande" existante est renommée "Origine" et unifiée. Si `listeBesoins` est présent, il est affiché en priorité. Si `commande` est présent (et pas `listeBesoins`), c'est la commande qui s'affiche.

---

### 6. UI — Composant `depenses-list-client.tsx`

Chaque carte de dépense affiche actuellement `commande.numero` si présent. Étendre pour afficher aussi `listeBesoins.numero` :

```
[Badge origine] BES-2026-001  ou  CMD-2026-001
```

Le badge doit distinguer visuellement les deux types. Suggestion :
- Besoin : variant `info` avec icône `ClipboardList`
- Commande : variant `default` avec icône `ShoppingCart`

Le type de la dépense locale `DepenseListItem` dans ce composant doit ajouter :
```typescript
listeBesoins: { id: string; numero: string } | null;
```

---

### 7. UI — Composant `depense-form-client.tsx`

Ajouter dans la section "Liens optionnels" un champ Select pour lier à une liste de besoins :

```
[Select — Liste de besoins liée]
  - Aucune liste de besoins  (valeur par défaut)
  - BES-2026-001 — "Achat aliments"
  - BES-2026-002 — "Matériel d'élevage"
```

Le composant parent (`/depenses/nouveau/page.tsx`) doit charger les listes de besoins approuvées ou traitées du site pour les passer en props.

Règle UX : si l'utilisateur sélectionne une liste de besoins, le champ "Commande" est désactivé (et vice-versa). Ce couplage exclusif est géré par état local React.

```typescript
// Désactivation réciproque
function handleBesoinsChange(value: string) {
  setListeBesoinsId(value === "__aucune" ? "" : value);
  if (value !== "__aucune") setCommandeId(""); // exclure commande
}

function handleCommandeChange(value: string) {
  setCommandeId(value === "__aucune" ? "" : value);
  if (value !== "__aucune") setListeBesoinsId(""); // exclure besoin
}
```

---

### 8. UI — Composant `besoins-detail-client.tsx` (section dépenses liées)

La section des dépenses liées au besoin (`liste.depenses`) existe déjà mais n'affiche que `numero`, `montantTotal` et `statut`. Ajouter :
- Un lien cliquable sur chaque dépense vers `/depenses/{id}`
- La mention du statut via badge (déjà présente partiellement)

Aucun changement de données n'est requis ici — c'est purement un enrichissement UI.

---

### 9. UI — Composant `commande-detail-client.tsx` (section dépenses liées)

Si ce composant affiche les dépenses liées à la commande (via `Commande.depenses`), s'assurer que chaque dépense est un lien navigable vers `/depenses/{id}`. Vérifier et ajouter si absent.

---

## Résumé des fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/types/api.ts` | `CreateDepenseDTO` + `DepenseFilters` : ajouter `listeBesoinsId?` |
| `src/lib/queries/depenses.ts` | `getDepenses` + `getDepenseById` : inclure `listeBesoins`; `createDepense` : passer `listeBesoinsId`, valider exclusivité |
| `src/lib/queries/besoins.ts` | `cloturerBesoins` : mettre à jour `montantTotal` de la dépense liée avec `montantReel` |
| `src/app/api/depenses/route.ts` | Validation `listeBesoinsId` + contrainte d'exclusivité avec `commandeId` |
| `src/components/depenses/depense-detail-client.tsx` | Ajouter bloc "Origine" unifié (besoin ou commande) |
| `src/components/depenses/depenses-list-client.tsx` | Ajouter badge origine (besoin ou commande) sur les cartes |
| `src/components/depenses/depense-form-client.tsx` | Ajouter Select "Liste de besoins liée" avec exclusivité vis-à-vis de Commande |
| `src/app/depenses/nouveau/page.tsx` (Server Component) | Charger les listes de besoins approuvées/traitées à passer en props |
| `src/components/besoins/besoins-detail-client.tsx` | Ajouter lien navigable sur chaque dépense listée |
| `src/components/stock/commande-detail-client.tsx` | Vérifier et ajouter liens navigables vers les dépenses listées |

---

## Aucune migration de base de données nécessaire

Les champs `listeBesoinsId` et `commandeId` existent déjà dans le schéma Prisma avec leurs index. Les back-relations `ListeBesoins.depenses` et `Commande.depenses` sont également en place. **Aucune modification de `prisma/schema.prisma` n'est requise.**

---

## Alternatives écartées

### Alternative : Champ `origineType` + `origineId` polymorphique

Remplacer les deux FK distinctes par un champ discriminant (`origineType: "BESOIN" | "COMMANDE" | null`) et un `origineId` générique. Rejeté car :
- Casse les relations Prisma et les jointures typées.
- Moins lisible dans les requêtes.
- Nécessiterait une migration.

### Alternative : Table pivot `DepenseOrigine`

Une table intermédiaire permettant de relier une dépense à plusieurs origines. Rejeté car over-engineering : une dépense a toujours au plus une origine structurée.

---

## Contraintes et règles métier

| # | Règle |
|---|-------|
| M1 | `commandeId` et `listeBesoinsId` sont mutuellement exclusifs sur une même dépense |
| M2 | Une fois l'origine définie (à la création), elle est immuable (pas de modification via `updateDepense`) |
| M3 | Lors du traitement d'un besoin (`traiterBesoins`), `listeBesoinsId` est toujours renseigné sur la dépense créée |
| M4 | Lors de la clôture d'un besoin (`cloturerBesoins`), la dépense existante liée est mise à jour avec `montantReel` |
| M5 | La suppression d'un besoin (`SetNull` on Prisma) met `listeBesoinsId` à `null` — la dépense devient libre |
| M6 | La suppression d'une commande (`SetNull` on Prisma) met `commandeId` à `null` — la dépense devient libre |
