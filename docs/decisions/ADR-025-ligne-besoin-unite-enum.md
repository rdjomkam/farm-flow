# ADR-025 — LigneBesoin.unite : remplacement du texte libre par un enum étendu

**Statut :** ACCEPTED
**Date :** 2026-04-03
**Auteur :** @architect
**Contexte :** Sprint courant — correction de cohérence de données

---

## Contexte

`LigneBesoin.unite` est actuellement un champ `String?` (texte libre, nullable). Les données
de seed contiennent des valeurs hétérogènes : `NULL`, `'flacons'`, `'rouleaux'`, `'metres'`,
`'kg'`, `'boites'`. Ce libre arbitre entraîne des incohérences ("kg" vs "Kg" vs "KG") et
casse les lookups de traduction dans `besoins-detail-client.tsx` (`tStock("unites.${u}")`).

`Produit.unite` et `Produit.uniteAchat` utilisent déjà l'enum `UniteStock` (GRAMME, KG,
MILLILITRE, LITRE, UNITE, SACS). Quand un produit du catalogue est sélectionné dans le
formulaire, `unite` est auto-rempli depuis `produit.unite` — il faut donc que les deux
types soient compatibles.

Mais les besoins couvrent aussi des articles hors-catalogue (équipements, consommables) qui
requièrent des unités non représentées dans `UniteStock` : rouleaux de filet, mètres de
tuyau, flacons, boîtes.

---

## Décision

### 1. Créer un nouvel enum `UniteBesoin` (ne pas étendre `UniteStock`)

**Raison du choix d'un enum distinct :**

- `UniteStock` est un contrat de gestion de stock (mesures quantifiables, conversions). Le
  mélanger avec des unités de commandes diverses augmente le couplage et violerait R3 en
  forçant une asymétrie entre le domaine stock et le domaine besoins.
- `UniteBesoin` englobe `UniteStock` pour les produits liés au catalogue, plus des unités
  propres aux achats ad-hoc.

### 2. Valeurs de `UniteBesoin` (R1 — UPPERCASE)

```prisma
enum UniteBesoin {
  // Mesures continues (alignées avec UniteStock)
  GRAMME
  KG
  MILLILITRE
  LITRE
  // Unités de comptage génériques
  UNITE
  SACS
  // Unités de conditionnement courantes en aquaculture / exploitation
  FLACONS
  BOITES
  ROULEAUX
  METRES
}
```

**Mapping des valeurs de seed existantes :**

| Valeur actuelle (texte libre) | Valeur cible `UniteBesoin` |
|-------------------------------|---------------------------|
| `NULL`                        | `NULL` (field reste nullable) |
| `'kg'`                        | `KG` |
| `'flacons'`                   | `FLACONS` |
| `'rouleaux'`                  | `ROULEAUX` |
| `'metres'`                    | `METRES` |
| `'boites'`                    | `BOITES` |

### 3. Nullabilité — le champ reste `UniteBesoin?` (nullable)

**Justification (R7 — nullabilité explicite) :**

- `NULL` est sémantiquement valide : une désignation libre sans unité précisée (ex: "Divers
  fournitures") est acceptable dans le contexte besoins.
- Forcer une valeur obligatoire casserait les cas d'usage où l'article est purement
  financier (prix estimé sans décompte unitaire).
- Le formulaire affichera `UNITE` comme valeur par défaut suggérée mais n'en fait pas une
  contrainte.

### 4. Auto-remplissage depuis un produit du catalogue

Quand `produitId` est sélectionné dans le formulaire, `unite` est auto-rempli depuis
`produit.unite` (`UniteStock`). Comme `UniteBesoin` contient les mêmes valeurs de base
(`GRAMME`, `KG`, `MILLILITRE`, `LITRE`, `UNITE`, `SACS`), le cast direct est valide.

Règle d'auto-remplissage :

```typescript
// UniteStock et UniteBesoin partagent les mêmes valeurs de base
// Le cast est safe car UniteStock ⊂ UniteBesoin (sous-ensemble strict)
updated.unite = produit.unite as unknown as UniteBesoin;
```

---

## Impact sur les fichiers

### prisma/schema.prisma

1. Ajouter l'enum `UniteBesoin` après `UniteStock` (ligne ~72).
2. Modifier `LigneBesoin.unite` : `String?` → `UniteBesoin?`

```prisma
enum UniteBesoin {
  GRAMME
  KG
  MILLILITRE
  LITRE
  UNITE
  SACS
  FLACONS
  BOITES
  ROULEAUX
  METRES
}

model LigneBesoin {
  // ...
  unite  UniteBesoin?
  // ...
}
```

### Migration SQL (stratégie RECREATE — règle enum PostgreSQL)

La colonne `unite` est actuellement `TEXT`. La migration doit :

1. Créer le type `UniteBesoin` en PostgreSQL.
2. Migrer les données existantes (UPDATE avant conversion).
3. Convertir la colonne avec un CAST explicite.

```sql
-- 1. Créer le nouveau type enum
CREATE TYPE "UniteBesoin" AS ENUM (
  'GRAMME', 'KG', 'MILLILITRE', 'LITRE',
  'UNITE', 'SACS', 'FLACONS', 'BOITES', 'ROULEAUX', 'METRES'
);

-- 2. Normaliser les données existantes avant conversion
UPDATE "LigneBesoin" SET "unite" = 'KG'      WHERE lower("unite") = 'kg';
UPDATE "LigneBesoin" SET "unite" = 'FLACONS' WHERE lower("unite") = 'flacons';
UPDATE "LigneBesoin" SET "unite" = 'ROULEAUX' WHERE lower("unite") = 'rouleaux';
UPDATE "LigneBesoin" SET "unite" = 'METRES'  WHERE lower("unite") = 'metres';
UPDATE "LigneBesoin" SET "unite" = 'BOITES'  WHERE lower("unite") = 'boites';

-- 3. Toute valeur non mappée devient NULL (sécurité)
UPDATE "LigneBesoin"
SET "unite" = NULL
WHERE "unite" IS NOT NULL
  AND "unite" NOT IN (
    'GRAMME','KG','MILLILITRE','LITRE','UNITE','SACS',
    'FLACONS','BOITES','ROULEAUX','METRES'
  );

-- 4. Changer le type de colonne
ALTER TABLE "LigneBesoin"
  ALTER COLUMN "unite" TYPE "UniteBesoin"
  USING "unite"::"UniteBesoin";
```

### src/types/models.ts

Ajouter l'enum `UniteBesoin` dans la section enums (après `UniteStock`) :

```typescript
export enum UniteBesoin {
  GRAMME     = "GRAMME",
  KG         = "KG",
  MILLILITRE = "MILLILITRE",
  LITRE      = "LITRE",
  UNITE      = "UNITE",
  SACS       = "SACS",
  FLACONS    = "FLACONS",
  BOITES     = "BOITES",
  ROULEAUX   = "ROULEAUX",
  METRES     = "METRES",
}
```

Modifier l'interface `LigneBesoin` :

```typescript
export interface LigneBesoin {
  // ...
  unite: UniteBesoin | null;  // was: string | null
  // ...
}
```

Modifier l'interface locale dans `besoins-detail-client.tsx` :

```typescript
interface LigneBesoinData {
  // ...
  unite: UniteBesoin | null;
  produit: { id: string; nom: string; unite: UniteStock } | null;
  // ...
}
```

### src/types/api.ts — CreateLigneBesoinDTO

```typescript
export interface CreateLigneBesoinDTO {
  designation: string;
  produitId?: string;
  quantite: number;
  /** Unite de l'article (enum UniteBesoin, optionnel) */
  unite?: UniteBesoin;
  prixEstime: number;
}
```

### src/types/index.ts

Ajouter `UniteBesoin` au barrel export.

### src/components/besoins/besoins-form-client.tsx

Remplacer le `<Input>` texte libre pour `unite` par un `<Select>` Radix (R5 — DialogTrigger
asChild) avec les valeurs de `UniteBesoin`. Le champ reste optionnel (pas de `required`).

```tsx
// LigneForm : changer le type
interface LigneForm {
  // ...
  unite: UniteBesoin | "";  // "" = pas de valeur sélectionnée
}

// Rendu : Select au lieu d'Input
<Select
  value={l.unite}
  onValueChange={(v) => updateLigne(l.id, "unite", v === "none" ? "" : v)}
>
  <SelectTrigger className="mt-1 w-full">
    <SelectValue placeholder={t("form.unitePlaceholder")} />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="none">{t("form.uniteAucune")}</SelectItem>
    {Object.values(UniteBesoin).map((u) => (
      <SelectItem key={u} value={u}>
        {tStock(`unites.${u}`)}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

Auto-remplissage depuis produit — inchangé dans la logique, juste le cast de type.

### src/components/besoins/modifier-besoin-dialog.tsx

Même remplacement Input → Select pour le champ `unite` (identique au formulaire de
création).

### src/components/besoins/besoins-detail-client.tsx

La fonction `uniteLabel` peut être simplifiée : comme `unite` est maintenant toujours une
valeur d'enum connue (ou NULL), le fallback `u.toLowerCase()` devient inutile.

```typescript
// Avant
const uniteLabel = (u: string) => {
  const key = `unites.${u}` as Parameters<typeof tStock>[0];
  const label = tStock(key);
  return label !== `stock.unites.${u}` ? label : u.toLowerCase();
};

// Après — unite est UniteBesoin | null | UniteStock
const uniteLabel = (u: UniteBesoin | UniteStock | null): string => {
  if (!u) return "";
  return tStock(`unites.${u}` as Parameters<typeof tStock>[0]);
};
```

### src/messages/fr/stock.json

Ajouter les 4 nouvelles unités dans `"unites"` (elles seront partagées entre stock et
besoins — c'est le même namespace de traduction) :

```json
"unites": {
  "GRAMME":     "g",
  "KG":         "kg",
  "MILLILITRE": "mL",
  "LITRE":      "L",
  "UNITE":      "unité",
  "SACS":       "sacs",
  "FLACONS":    "flacons",
  "BOITES":     "boîtes",
  "ROULEAUX":   "rouleaux",
  "METRES":     "m"
}
```

### prisma/seed.sql

Mettre à jour les lignes `INSERT INTO "LigneBesoin"` pour utiliser les valeurs enum
uppercase : `'KG'`, `'FLACONS'`, `'ROULEAUX'`, `'METRES'`, `'BOITES'`. Les lignes avec
`unite = NULL` restent NULL.

---

## Alternatives écartées

### A. Étendre `UniteStock` directement

Rejeté car `UniteStock` appartient au domaine stock/inventaire (mesures quantifiables,
conversions physiques). Y ajouter `FLACONS`, `ROULEAUX`, `METRES` diluerait la sémantique
et créerait de la confusion dans les formulaires de gestion de stock (un produit stock
"en rouleaux" n'a pas de sens).

### B. Garder `String?` avec validation enum côté API

Rejeté car la validation côté API ne garantit pas la cohérence des données historiques ni
des données importées. Le typage au niveau du schéma Prisma (R3) est la bonne couche.

### C. Rendre `unite` obligatoire (`UniteBesoin` sans `?`)

Rejeté (R7). Des besoins "lump sum" sans unité précisée sont légitimes. Forcer une valeur
obligatoire nuirait à l'UX pour les cas d'utilisation courants.

---

## Résumé des changements requis

| Fichier | Nature du changement |
|---------|---------------------|
| `prisma/schema.prisma` | +enum `UniteBesoin`, modifier `LigneBesoin.unite` |
| Migration SQL | RECREATE enum + UPDATE données + ALTER COLUMN |
| `src/types/models.ts` | +enum `UniteBesoin`, modifier interface `LigneBesoin` |
| `src/types/api.ts` | Modifier `CreateLigneBesoinDTO.unite` |
| `src/types/index.ts` | Export `UniteBesoin` |
| `src/messages/fr/stock.json` | +4 entrées dans `unites` |
| `besoins-form-client.tsx` | Input → Select pour le champ `unite` |
| `modifier-besoin-dialog.tsx` | Input → Select pour le champ `unite` |
| `besoins-detail-client.tsx` | Simplifier `uniteLabel`, typage strict |
| `prisma/seed.sql` | Valeurs uppercase dans `LigneBesoin` |

---

## Règles vérifiées

- **R1** — Toutes les valeurs enum en UPPERCASE.
- **R2** — Import `UniteBesoin` depuis `@/types`, usage via `UniteBesoin.KG` etc.
- **R3** — Enum Prisma et enum TypeScript identiques (mêmes valeurs, même nom).
- **R5** — Le Select dans les formulaires utilise les composants Radix existants.
- **R7** — Champ reste `UniteBesoin?` (nullable), justifié explicitement.
