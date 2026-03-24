# ADR-023 — Distribution des alevins par bac lors de la création d'une vague

**Statut :** ACCEPTE
**Date :** 2026-03-24
**Auteur :** @architect

---

## Contexte

Lors de la création d'une vague, l'utilisateur saisit `nombreInitial` (total des alevins) et sélectionne un ou plusieurs bacs. Actuellement, `createVague()` assigne `vagueId` sur les bacs sans renseigner `nombrePoissons`. En conséquence, le formulaire de calibrage (`step-sources.tsx`) grise tous les bacs car il vérifie `nombrePoissons > 0`, rendant le calibrage inaccessible jusqu'à ce qu'un relevé de comptage soit saisi manuellement.

---

## Problème

1. `Bac.nombrePoissons` reste `null` après la création d'une vague, même quand l'utilisateur sait combien de poissons vont dans chaque bac.
2. Le formulaire de calibrage (`step-sources.tsx`) bloque sur `nombrePoissons === 0`, empêchant toute opération de calibrage en début de vague.
3. Les ventes (`vente-form-client.tsx`) et les alertes de densité (`bacs/[id]/densite/route.ts`) utilisent également `bac.nombrePoissons`.

---

## Décision

### 1. Extension du DTO — Option A retenue

Remplacer `bacIds: string[]` par `bacDistribution: BacStockingEntry[]` dans `CreateVagueDTO`.

```typescript
/** Répartition des alevins pour un bac lors de la création d'une vague */
export interface BacStockingEntry {
  bacId: string;
  nombrePoissons: number; // entier > 0
}

/** DTO pour créer une nouvelle vague */
export interface CreateVagueDTO {
  code: string;
  dateDebut: string;
  nombreInitial: number;
  poidsMoyenInitial: number;
  origineAlevins?: string;
  /** Remplace bacIds — contient la répartition par bac */
  bacDistribution: BacStockingEntry[];
}
```

**Raisons du choix de l'Option A vs B :**
- L'Option B (garder `bacIds` + ajouter `bacDistribution` optionnel) aurait créé deux sources de vérité conflictuelles, complexifiant la validation côté serveur.
- L'Option A force la saisie de la distribution dès la création, ce qui est la donnée correcte que l'utilisateur possède à ce moment-là.
- La migration de `bacIds` vers `bacDistribution` est un changement de DTO uniquement — aucune migration de base de données requise.

### 2. Règles de validation

**Règle principale :** `sum(distribution.nombrePoissons) === nombreInitial`

La somme des poissons répartis DOIT être égale exactement à `nombreInitial`. Cela évite les incohérences entre le total de la vague et les comptages par bac.

**Règle complémentaire :** Chaque `BacStockingEntry.nombrePoissons` doit être un entier strictement positif (`> 0`). Un bac ne peut pas être sélectionné avec 0 poissons.

**Raison :** Permettre une répartition partielle (somme < nombreInitial) créerait une perte comptable silencieuse que le système ne pourrait pas réconcilier. Si l'utilisateur veut stocker un bac plus tard, il doit créer un relevé de transfert ou utiliser le calibrage.

### 3. Comportement backend dans `createVague()`

Dans la transaction existante, remplacer :

```typescript
// AVANT
await tx.bac.updateMany({
  where: { id: { in: data.bacIds }, siteId },
  data: { vagueId: vague.id },
});
```

Par des mises à jour individuelles par bac (R4 — opérations atomiques) :

```typescript
// APRES
for (const entry of data.bacDistribution) {
  await tx.bac.update({
    where: { id: entry.bacId, siteId },
    data: {
      vagueId: vague.id,
      nombrePoissons: entry.nombrePoissons,
      nombreInitial: entry.nombrePoissons,
      poidsMoyenInitial: data.poidsMoyenInitial,
    },
  });
}
```

**Pourquoi `updateMany` ne suffit plus :** `updateMany` ne peut pas définir des valeurs différentes par enregistrement. Il faut des `update` individuels dans la même transaction.

**Pourquoi renseigner aussi `bac.nombreInitial` et `bac.poidsMoyenInitial` :** Ces champs permettent de retrouver l'état initial d'un bac indépendamment de la vague, notamment pour les calculs de densité (`/api/bacs/[id]/densite`) et les exports PDF.

### 4. Backward compatibility — Bacs existants avec `nombrePoissons = null`

Les vagues déjà créées (avant ce changement) ont des bacs avec `nombrePoissons = null`. Deux niveaux de mitigation :

**A. Côté formulaire de calibrage (`step-sources.tsx`) :**
Assouplir la condition de visibilité. Actuellement : `nombrePoissons > 0`. Nouvelle logique :

```typescript
// Un bac est "disponible" si :
// 1. Il a nombrePoissons > 0 (cas normal post-ADR-023)
// 2. OU il est assigné à la vague courante (cas legacy — bacs sans distribution)
const bacsAvecPoissons = bacs.filter((b) => (b.nombrePoissons ?? 0) > 0);
const bacsLegacy = bacs.filter(
  (b) => (b.nombrePoissons ?? 0) === 0 && b.vagueId !== null
);
// bacsLegacy sont affichés comme sélectionnables avec une mention "quantité inconnue"
```

**B. Côté bac edit (`PATCH /api/bacs/[id]`) :**
L'API bac existante accepte déjà `nombrePoissons` et `nombreInitial` dans le body. Ce mécanisme sert de "surcharge manuelle" pour les bacs legacy. Aucune modification requise — c'est la backward compatibility naturelle décrite dans le brief.

**Important :** La modification du bac via `PATCH /api/bacs/[id]` écrase les valeurs posées lors de la création de la vague. C'est le comportement voulu (override).

### 5. UX Frontend — Formulaire de création de vague

Le formulaire actuel est un Dialog inline dans `vagues-list-client.tsx`. La distribution par bac nécessite une étape supplémentaire après la sélection des bacs.

**Approche recommandée : inputs inline dans la section bacs**

Après sélection des bacs (checkboxes existantes), afficher sous chaque bac sélectionné un input numérique pour `nombrePoissons`. Un indicateur de somme en temps réel compare avec `nombreInitial`.

```
Section "Bacs"
  [x] Bac A (1000L)     [____500____] poissons
  [x] Bac B (800L)      [____300____] poissons
  [ ] Bac C (600L)      (non sélectionné)

  Total distribué : 800 / 1000
  ⚠ Il manque 200 poissons à distribuer
```

**Pourquoi pas une étape multi-step séparée :**
Le formulaire actuel est dans un `Dialog` simple (pas multi-step). Ajouter une étape dédiée nécessiterait une refonte en wizard (`step-sources` style calibrage), ce qui est disproportionné pour 1-3 bacs typiques. Les inputs inline sont suffisants et mobiles-friendly (scroll vertical naturel).

**Distribution automatique :**
Fournir un bouton "Répartir équitablement" qui calcule `Math.floor(nombreInitial / nbBacs)` et distribue le reste sur le premier bac. Ce bouton est un helper optionnel, non la valeur par défaut.

```typescript
function distributeEvenly(nombreInitial: number, bacIds: string[]): Record<string, number> {
  const base = Math.floor(nombreInitial / bacIds.length);
  const remainder = nombreInitial % bacIds.length;
  return Object.fromEntries(
    bacIds.map((id, i) => [id, base + (i === 0 ? remainder : 0)])
  );
}
```

### 6. Validation côté API route (`POST /api/vagues`)

Ajouter dans le handler POST :

```typescript
// Valider bacDistribution (remplace bacIds)
if (!Array.isArray(body.bacDistribution) || body.bacDistribution.length === 0) {
  errors.push({ field: "bacDistribution", message: "Au moins un bac doit être sélectionné." });
} else {
  const invalidEntries = body.bacDistribution.filter(
    (e: unknown) =>
      typeof (e as BacStockingEntry).bacId !== "string" ||
      typeof (e as BacStockingEntry).nombrePoissons !== "number" ||
      !Number.isInteger((e as BacStockingEntry).nombrePoissons) ||
      (e as BacStockingEntry).nombrePoissons <= 0
  );
  if (invalidEntries.length > 0) {
    errors.push({ field: "bacDistribution", message: "Chaque bac doit avoir un nombre de poissons entier > 0." });
  }

  const totalDistribue = body.bacDistribution.reduce(
    (sum: number, e: BacStockingEntry) => sum + e.nombrePoissons, 0
  );
  if (totalDistribue !== body.nombreInitial) {
    errors.push({
      field: "bacDistribution",
      message: `La somme des poissons distribués (${totalDistribue}) doit être égale au nombre initial (${body.nombreInitial}).`,
    });
  }
}
```

### 7. Impact sur les autres fonctionnalités

| Fonctionnalité | Impact | Action requise |
|---|---|---|
| **Calibrage** (`step-sources.tsx`) | Résolu — bacs auront `nombrePoissons > 0` | Assouplir condition legacy (section 4A) |
| **Ventes** (`vente-form-client.tsx`) | Amélioré — comptage bac disponible dès J0 | Aucune modification requise |
| **Alertes densité** (`/api/bacs/[id]/densite`) | Amélioré — `nombreInitial` renseigné per bac | Aucune modification requise |
| **Dashboard** | Neutre — utilise les relevés, pas `bac.nombrePoissons` | Aucune modification requise |
| **Relevé comptage** | Neutre — peut toujours corriger le comptage | Aucune modification requise |
| **Export PDF** | Amélioré — `poidsMoyenInitial` per bac disponible | Aucune modification requise |
| **Tests** (`vagues.test.ts`) | Impacté — fixtures avec `bacIds` → `bacDistribution` | Mettre à jour les fixtures de test |

### 8. Migration des données existantes

**Aucune migration SQL requise.** Les champs `bac.nombrePoissons`, `bac.nombreInitial`, et `bac.poidsMoyenInitial` sont déjà nullable dans le schéma Prisma. Les bacs existants conservent leurs valeurs null. La backward compatibility est assurée via la condition legacy dans `step-sources.tsx` (section 4A).

---

## Fichiers à modifier

| Fichier | Nature du changement |
|---|---|
| `src/types/api.ts` | Ajouter `BacStockingEntry`, modifier `CreateVagueDTO` |
| `src/types/index.ts` | Exporter `BacStockingEntry` |
| `src/lib/queries/vagues.ts` | `createVague()` — boucle `update` individuelle |
| `src/app/api/vagues/route.ts` | Validation `bacDistribution` |
| `src/components/vagues/vagues-list-client.tsx` | Inputs distribution inline + bouton "Répartir" |
| `src/components/calibrage/step-sources.tsx` | Condition legacy pour bacs sans `nombrePoissons` |
| `src/hooks/queries/use-vagues-queries.ts` | Type `CreateVagueDTO` dans mutation |
| `src/__tests__/api/vagues.test.ts` | Fixtures `bacDistribution` |

---

## Alternatives rejetées

**Option B — `bacIds` + `bacDistribution` optionnel :**
Crée deux chemins de validation divergents sur le serveur. Si `bacDistribution` est fourni, `bacIds` devient redondant. Si `bacIds` seul est fourni, on doit décider de la distribution (équitable implicite) sans en informer l'utilisateur. Rejeté pour complexité sans bénéfice.

**Distribution automatique par défaut (sans saisie) :**
Semble simple mais masque la décision métier. Si le pisciculteur met 500 poissons dans un bac et 300 dans un autre pour une raison précise (taille, état sanitaire), une distribution silencieuse créerait des données fausses. La saisie explicite est préférée.

**Nouvelle table `VagueBacAllocation` :**
Surdimensionné pour ce besoin. Les champs `nombrePoissons` et `nombreInitial` existent déjà sur `Bac` et représentent exactement cette information. Une table dédiée créerait une duplication de données.
