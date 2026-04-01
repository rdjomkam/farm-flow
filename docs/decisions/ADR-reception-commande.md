# ADR — Réception de Commande avec Quantités Reçues par Ligne

**Statut :** Proposé
**Date :** 2026-04-01
**Auteur :** @architect

---

## Contexte et problème

Actuellement, quand un utilisateur clique sur "Réceptionner" pour une commande en statut `ENVOYEE`, le système :
1. Crée un `MouvementStock` ENTREE pour chaque `LigneCommande` en utilisant **la quantité commandée** (`quantite`)
2. Incrémente le `stockActuel` du produit de la quantité convertie (`convertirQuantiteAchat`)
3. Passe la commande au statut `LIVREE`
4. Crée automatiquement une `Depense` liée

**Le problème :** En pratique, la livraison peut différer de la commande :
- Un article peut arriver en quantité partielle (ex : 80 sacs commandés, 70 livrés)
- Un article peut ne pas arriver du tout (quantité reçue = 0)
- Un article peut arriver en surplus (surlivraison — cas rare mais possible)

Sans saisie des quantités réellement reçues, le stock est faux et les dépenses sont incorrectes.

---

## Analyse de l'état actuel

### Schéma Prisma

```
model LigneCommande {
  id           String   @id @default(cuid())
  commandeId   String
  commande     Commande @relation(...)
  produitId    String
  produit      Produit  @relation(...)
  quantite     Float        // quantite commandee
  prixUnitaire Float
  createdAt    DateTime @default(now())
}
```

`LigneCommande` ne possède pas de champ `quantiteRecue`. La quantité commandée est utilisée directement pour créer les mouvements de stock.

### API actuelle

`POST /api/commandes/[id]/recevoir` accepte uniquement :
- `dateLivraison` (optionnel)
- `file` (optionnel — facture fournisseur)

Aucun paramètre pour les quantités reçues par ligne.

### Service client actuel (`stock.service.ts`)

```typescript
recevoirCommande(id: string, dateLivraison: string, file?: File)
```

### Composant UI actuel (`commande-detail-client.tsx`)

Le Dialog de réception affiche :
- Un champ date de livraison
- Un champ fichier optionnel (facture fournisseur)

Il ne montre pas les lignes de commande et ne permet pas la saisie de quantités reçues.

---

## Décision

### 1. Schema : Ajout de `quantiteRecue` sur `LigneCommande`

Ajouter un champ nullable `quantiteRecue Float?` sur le modèle `LigneCommande`.

**Pourquoi nullable ?** La valeur est `null` tant que la commande n'est pas réceptionnée. Après réception, elle contient la quantité effectivement reçue (0 inclus). Cela permet de distinguer "pas encore réceptionné" de "reçu à 0".

```prisma
model LigneCommande {
  id             String   @id @default(cuid())
  commandeId     String
  commande       Commande @relation(fields: [commandeId], references: [id], onDelete: Cascade)
  produitId      String
  produit        Produit  @relation(fields: [produitId], references: [id])
  quantite       Float
  prixUnitaire   Float
  quantiteRecue  Float?   // null = non encore réceptionné, 0+ = reçu
  createdAt      DateTime @default(now())

  @@index([commandeId])
  @@index([produitId])
}
```

**Impact :** Migration `ALTER TABLE` simple (ajout colonne nullable). Aucune migration destructive. Les lignes existantes auront `quantiteRecue = null`, ce qui est cohérent (commandes déjà livrées n'ont pas de traçabilité rétrospective — acceptable).

### 2. API : Nouveau contrat pour `POST /api/commandes/[id]/recevoir`

Le endpoint accepte désormais en JSON ou FormData un tableau `lignes` de quantités reçues. Le champ est **optionnel pour rétrocompatibilité** : si absent, le comportement actuel (quantite commandée) est conservé.

#### Request body (JSON)

```typescript
interface RecevoirCommandeBody {
  dateLivraison?: string;           // ISO date, optionnel
  lignes?: LigneReceptionInput[];   // si absent : comportement actuel
}

interface LigneReceptionInput {
  ligneId: string;    // ID de la LigneCommande
  quantiteRecue: number;  // >= 0
}
```

#### Request body (FormData — avec fichier)

Champs identiques + `file` (File, optionnel).

Nouveau champ FormData :
```
lignes  — JSON stringifié du tableau LigneReceptionInput[]
```

#### Response

```typescript
interface RecevoirCommandeResponse {
  commande: CommandeWithLignes;   // commande LIVREE avec lignes mises à jour
  depense: Depense | null;
  avertissements?: string[];      // ex: "Produit X : surlivraison détectée"
}
```

### 3. Règles métier pour la réception

| Cas | Comportement |
|-----|-------------|
| `lignes` absent dans le body | Fallback : utiliser `quantite` pour chaque ligne (comportement actuel) |
| `ligneId` inconnu ou n'appartenant pas à la commande | Erreur 400 |
| `quantiteRecue < 0` | Erreur 400 |
| `quantiteRecue = 0` | Ligne ignorée pour le mouvement de stock, mais `quantiteRecue` est sauvegardée sur la ligne |
| `quantiteRecue > quantite` (surlivraison) | Autorisé, avertissement dans la réponse, mouvement créé avec la quantité reçue |
| Ligne non couverte dans `lignes` | Erreur 400 : toutes les lignes doivent être couvertes si `lignes` est fourni |
| `montantTotal` de la commande | Recalculé selon les quantités reçues : `sum(quantiteRecue * prixUnitaire)` — et la `Depense` reflète ce montant réel |

**Règle d'atomicité :** Tout se passe dans une seule transaction Prisma. Si une ligne échoue (produit introuvable, etc.), toute la réception est annulée.

### 4. Query `recevoirCommande` : signature mise à jour

```typescript
export async function recevoirCommande(
  id: string,
  siteId: string,
  userId: string,
  dateLivraison?: string,
  lignesRecues?: { ligneId: string; quantiteRecue: number }[]
): Promise<{ commande: CommandeWithLignes; depense: Depense | null; avertissements: string[] }>
```

**Logique interne (transaction) :**

1. Charger la commande avec ses lignes (vérifier `statut === ENVOYEE`)
2. Si `lignesRecues` fourni, valider que chaque `ligneId` appartient à la commande et que toutes les lignes sont couvertes
3. Construire la map `ligneId -> quantiteRecue` (fallback vers `ligne.quantite` si `lignesRecues` absent)
4. Pour chaque ligne où `quantiteRecue > 0` :
   - Créer un `MouvementStock` ENTREE avec `quantite = quantiteRecue`
   - Incrémenter `stockActuel` du produit avec `convertirQuantiteAchat(quantiteRecue, ligne.produit)`
5. Mettre à jour chaque `LigneCommande` avec `quantiteRecue`
6. Calculer `montantTotalReel = sum(quantiteRecue * prixUnitaire)`
7. Mettre à jour la commande : `statut = LIVREE`, `dateLivraison`, `montantTotal = montantTotalReel`
8. Auto-créer la `Depense` avec `montantTotal = montantTotalReel`
9. Collecter les avertissements (surlivraisons)

### 5. Service client : signature mise à jour

```typescript
recevoirCommande(
  id: string,
  dateLivraison: string,
  lignes: { ligneId: string; quantiteRecue: number }[],
  file?: File
): Promise<ServiceResult<RecevoirCommandeResponse>>
```

**Changement :** `lignes` devient obligatoire côté client (le service envoie toujours les quantités saisies). La rétrocompatibilité sans `lignes` est uniquement côté serveur pour les anciens appels API directs.

Pour le FormData (avec fichier), le champ `lignes` est sérialisé en JSON string :
```typescript
formData.set("lignes", JSON.stringify(lignes));
```

### 6. UI : Dialog de réception redessiné

Le Dialog "Réceptionner la commande" dans `commande-detail-client.tsx` est remplacé par un composant dédié `ReceptionCommandeDialog` (ou inline dans le detail, selon la complexité).

#### Structure du Dialog (mobile-first, 360px)

```
┌──────────────────────────────────────────┐
│  Réceptionner la commande CMD-2026-001   │
│  (sous-titre : vérifiez les qtes reçues) │
├──────────────────────────────────────────┤
│  Date de livraison                       │
│  [____________________] (date picker)    │
├──────────────────────────────────────────┤
│  Quantités reçues                        │
│ ┌────────────────────────────────────┐   │
│ │ Aliment Tilapia Premium            │   │
│ │ Commandé : 80 sacs                 │   │
│ │ Reçu : [____] sacs  (input number) │   │
│ └────────────────────────────────────┘   │
│ ┌────────────────────────────────────┐   │
│ │ Vitamine C                         │   │
│ │ Commandé : 5 kg                    │   │
│ │ Reçu : [____] kg   (input number)  │   │
│ └────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│  Facture fournisseur (optionnel)         │
│  [Choisir un fichier]                    │
├──────────────────────────────────────────┤
│  Montant réel : 45 000 FCFA              │
│  (calculé en live selon qtes reçues)     │
├──────────────────────────────────────────┤
│  [Annuler]          [Confirmer réception]│
└──────────────────────────────────────────┘
```

**Comportements UX :**
- Les champs `quantiteRecue` sont pré-remplis avec la `quantite` commandée (happy path : tout est arrivé)
- Les champs sont de type `number`, `min="0"`, `step="0.001"`
- Le montant réel se recalcule en temps réel à chaque modification
- Un badge visuel distingue les lignes avec écart (jaune si `quantiteRecue < quantite`, rouge si = 0)
- Le bouton "Confirmer" est désactivé si une valeur est vide ou négative
- Le Dialog est scrollable verticalement pour les commandes avec beaucoup de lignes (`max-h-[85dvh] overflow-y-auto`)

#### État du formulaire dans le composant

```typescript
interface LigneReceptionState {
  ligneId: string;
  produit: { nom: string; unite: string; uniteAchat: string | null };
  quantiteCommandee: number;
  prixUnitaire: number;
  quantiteRecue: string;  // string pour l'input contrôlé
}
```

---

## Types TypeScript à créer/modifier

### `src/types/api.ts`

```typescript
/** Saisie d'une quantite recue pour une ligne de commande */
export interface LigneReceptionInput {
  ligneId: string;
  quantiteRecue: number;  // >= 0
}

/** DTO pour la reception d'une commande */
export interface RecevoirCommandeDTO {
  dateLivraison?: string;
  lignes: LigneReceptionInput[];  // obligatoire cote UI, optionnel cote API
}

/** Reponse de la reception */
export interface RecevoirCommandeResponse {
  commande: {
    id: string;
    numero: string;
    statut: StatutCommande;
    dateLivraison: string;
    montantTotal: number;
    lignes: Array<{
      id: string;
      quantite: number;
      quantiteRecue: number | null;
      prixUnitaire: number;
      produit: { id: string; nom: string; unite: string };
    }>;
  };
  depense: { id: string; numero: string; montantTotal: number } | null;
  avertissements: string[];
}
```

---

## Gestion des cas limites

| Cas | Décision |
|-----|----------|
| Réception partielle (qte < commandée) | Autorisé. `montantTotal` de la commande et de la `Depense` est recalculé sur les qtes reçues. |
| Réception à zéro d'un article | Autorisé. `quantiteRecue = 0` sur la ligne, aucun mouvement de stock créé pour cet article. |
| Surlivraison (qte > commandée) | Autorisé avec avertissement retourné dans la réponse. Le mouvement de stock utilise `quantiteRecue`. |
| Toutes les lignes à zéro | Autorisé techniquement. La commande passe `LIVREE` avec `montantTotal = 0` et aucune Depense créée. |
| `montantTotal` de la commande d'origine | **Non modifié** — `montantTotal` sur `Commande` représente le montant commandé. Un nouveau champ `montantRecu` est introduit (voir ci-dessous). |
| Double réception (déjà LIVREE) | Le check `statut !== ENVOYEE` existant bloque déjà ce cas avec une erreur 409. |

**Ajustement sur `montantTotal` :** Plutôt que de modifier `montantTotal` (qui représente la valeur commandée), un champ `montantRecu Float?` est ajouté sur `Commande` pour stocker le montant effectivement reçu. Cela préserve la traçabilité financière (montant commandé vs montant reçu). La `Depense` auto-créée utilise `montantRecu`.

---

## Schéma final (modifications)

### `Commande`
```prisma
model Commande {
  // ... champs existants ...
  montantTotal   Float           @default(0)  // montant commandé (inchangé)
  montantRecu    Float?                        // montant effectivement reçu (null = non réceptionné)
  // ... reste inchangé ...
}
```

### `LigneCommande`
```prisma
model LigneCommande {
  // ... champs existants ...
  quantite       Float    // quantite commandee
  quantiteRecue  Float?   // quantite effectivement recue (null = non réceptionné)
  // ... reste inchangé ...
}
```

---

## Migration Prisma

Fichier : `prisma/migrations/YYYYMMDDHHMMSS_add_reception_quantities/migration.sql`

```sql
-- Ajouter quantiteRecue sur LigneCommande
ALTER TABLE "LigneCommande" ADD COLUMN "quantiteRecue" DOUBLE PRECISION;

-- Ajouter montantRecu sur Commande
ALTER TABLE "Commande" ADD COLUMN "montantRecu" DOUBLE PRECISION;
```

Pas de valeurs par défaut requises (nullable). Les lignes de commandes déjà LIVREE conservent `quantiteRecue = null` (comportement rétrocompatible : l'UI affiche `quantite` quand `quantiteRecue` est null).

---

## Séquence d'implémentation

### Étape 1 — Schema Prisma (db-specialist)
1. Modifier `prisma/schema.prisma` : ajouter `quantiteRecue Float?` sur `LigneCommande` et `montantRecu Float?` sur `Commande`
2. Générer la migration SQL avec `prisma migrate diff`
3. Appliquer avec `prisma migrate deploy`
4. Mettre à jour `prisma/seed.sql` si nécessaire

### Étape 2 — Types TypeScript (architect / developer)
1. Ajouter `LigneReceptionInput`, `RecevoirCommandeDTO`, `RecevoirCommandeResponse` dans `src/types/api.ts`
2. Mettre à jour l'interface `LigneCommande` dans `src/types/models.ts` (ajouter `quantiteRecue: number | null`)
3. Mettre à jour l'interface `Commande` dans `src/types/models.ts` (ajouter `montantRecu: number | null`)
4. Exporter les nouveaux types depuis `src/types/index.ts`

### Étape 3 — Query layer (developer / db-specialist)
1. Modifier `recevoirCommande` dans `src/lib/queries/commandes.ts` :
   - Nouvelle signature avec `lignesRecues?: { ligneId: string; quantiteRecue: number }[]`
   - Validation que tous les `ligneId` appartiennent à la commande
   - Fallback vers `quantite` si `lignesRecues` absent
   - `quantiteRecue = 0` : update la ligne mais skip le mouvement de stock
   - Mettre à jour `ligne.quantiteRecue` dans la transaction
   - Calculer et sauvegarder `commande.montantRecu`
   - Utiliser `montantRecu` pour la `Depense` auto-créée

### Étape 4 — API route (developer)
1. Modifier `src/app/api/commandes/[id]/recevoir/route.ts` :
   - Parser `lignes` depuis JSON body et FormData
   - Valider chaque `LigneReceptionInput` (ligneId string, quantiteRecue number >= 0)
   - Passer `lignesRecues` à `recevoirCommande`
   - Inclure `avertissements` dans la réponse

### Étape 5 — Service client (developer)
1. Modifier `recevoirCommande` dans `src/services/stock.service.ts` :
   - Nouvelle signature : `(id, dateLivraison, lignes, file?)`
   - Sérialiser `lignes` en JSON dans FormData si fichier présent
   - Envoyer `lignes` dans le body JSON sinon

### Étape 6 — Composant UI (developer)
1. Extraire le Dialog de réception en composant `ReceptionCommandeDialog` dans `src/components/stock/reception-commande-dialog.tsx`
2. Props : `commande`, `onSuccess`, `open`, `onOpenChange`
3. État local : `lignesState: LigneReceptionState[]` (initialisé avec `quantiteRecue = quantite`)
4. Calcul live du `montantReel`
5. Badges de statut par ligne (tout reçu / partiel / rien reçu)
6. Connecter au `stockService.recevoirCommande` (nouvelle signature)
7. Dans `commande-detail-client.tsx`, remplacer le Dialog inline par `<ReceptionCommandeDialog />`

### Étape 7 — Tests (tester)
1. Test unitaire sur `recevoirCommande` :
   - Cas nominal (toutes lignes avec quantités)
   - Réception partielle
   - Ligne à zéro
   - Surlivraison
   - `lignesRecues` absent (fallback)
   - Validation `ligneId` invalide
2. Test API route
3. Non-régression : vérifier que les tests existants passent toujours

---

## Fichiers à créer/modifier

| Action | Fichier |
|--------|---------|
| MODIFIER | `prisma/schema.prisma` |
| CRÉER | `prisma/migrations/YYYYMMDD_add_reception_quantities/migration.sql` |
| MODIFIER | `src/types/api.ts` |
| MODIFIER | `src/types/models.ts` |
| MODIFIER | `src/types/index.ts` |
| MODIFIER | `src/lib/queries/commandes.ts` |
| MODIFIER | `src/app/api/commandes/[id]/recevoir/route.ts` |
| MODIFIER | `src/services/stock.service.ts` |
| CRÉER | `src/components/stock/reception-commande-dialog.tsx` |
| MODIFIER | `src/components/stock/commande-detail-client.tsx` |
| MODIFIER OU CRÉER | `src/__tests__/api/commandes.test.ts` |
| CRÉER | `src/__tests__/lib/queries/reception-commande.test.ts` |

---

## Alternatives considérées

### Alternative A : Pas de changement de schéma, saisir les quantités uniquement en mémoire

Rejettée : sans persistance de `quantiteRecue`, impossible d'auditer les écarts entre commandé et reçu.

### Alternative B : Nouveau modèle `ReceptionCommande`

Rejettée : surengineering. Un simple champ `quantiteRecue Float?` sur `LigneCommande` est suffisant et cohérent avec le modèle existant.

### Alternative C : Modifier `montantTotal` de la commande à la réception

Rejettée : `montantTotal` doit refléter le montant commandé pour conserver la traçabilité. Un champ séparé `montantRecu` est plus explicite.

### Alternative D : Rendre `lignes` obligatoire dans l'API

Rejeté : casser la rétrocompatibilité sans bénéfice. Le fallback vers `quantite` permet aux intégrations existantes de continuer à fonctionner.

---

## Conséquences

**Positives :**
- Traçabilité complète des écarts entre commande et livraison
- `montantRecu` sur `Commande` permet un reporting financier précis
- La `Depense` auto-créée reflète le coût réel (pas le coût prévu)
- UX mobile adaptée : cartes par ligne, input number grand format

**Négatives / Risques :**
- Migration SQL à déployer (simple mais nécessaire)
- Les commandes déjà LIVREE n'ont pas de `quantiteRecue` — l'UI doit gérer ce cas (afficher `quantite` quand `quantiteRecue` est null)
- Le service client change de signature — vérifier qu'il n'y a pas d'autres appelants
