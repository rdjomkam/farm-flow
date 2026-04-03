# ADR-027 — LigneDepense : suivi des catégories par ligne de dépense

**Statut :** Accepté
**Date :** 2026-04-03
**Auteur :** @architect

## Contexte

Lorsque `traiterBesoins` convertit une `ListeBesoins` en `Depense`, la catégorie
de la dépense est hardcodée à `AUTRE`. Cette simplification perd de l'information
car une même liste de besoins peut contenir des produits de catégories différentes
(`ALIMENT`, `INTRANT`, `EQUIPEMENT`). Le résultat est que les dashboards financiers
et les analyses de coûts par catégorie (`CategorieDepense`) ne reflètent pas
fidèlement la réalité des dépenses engagées.

### Modèles existants impliqués

- `Depense` : un enregistrement unique par dépense, avec `categorieDepense CategorieDepense`
  comme champ unique de catégorisation. Lié en option à `ListeBesoins`, `Commande`,
  `Vague`.
- `LigneBesoin` : ligne individuelle d'une `ListeBesoins`, avec `produitId?` (FK
  `Produit`) et des prix estimé/réel.
- `LigneCommande` : ligne d'une `Commande`, toujours liée à un `Produit`.
- `Produit` : porte `categorie CategorieProduit` (sous-ensemble de `CategorieDepense` :
  `ALIMENT`, `INTRANT`, `EQUIPEMENT`).
- `CategorieDepense` : enum à 12 valeurs (`ALIMENT`, `INTRANT`, `EQUIPEMENT`,
  `ELECTRICITE`, `EAU`, `LOYER`, `SALAIRE`, `TRANSPORT`, `VETERINAIRE`, `REPARATION`,
  `INVESTISSEMENT`, `AUTRE`).

### Alternatives évaluées

#### Option 1 — Inférence de la catégorie dominante

Calculer la catégorie qui représente le plus grand montant dans les `LigneBesoin`
et l'affecter à `Depense.categorieDepense`. Simple à implémenter, ne modifie pas
le schéma.

**Rejeté.** Une liste contenant 60 % d'aliments et 40 % d'intrants serait classée
entièrement en `ALIMENT`. Les analyses de coûts restent inexactes. La perte
d'information n'est que partiellement réduite, pas éliminée.

#### Option 2 — Éclatement en plusieurs Depense par catégorie

Créer une `Depense` distincte par `CategorieDepense` présente dans la liste de
besoins. Par exemple, une liste mixte génère deux dépenses : une `ALIMENT`, une
`INTRANT`.

**Rejeté.** Les paiements (`PaiementDepense`) ciblent une seule `Depense`. Éclater
la dépense oblige soit à dupliquer les paiements, soit à introduire un objet
agrégateur supplémentaire. La complexité ajoutée est disproportionnée par rapport
au besoin.

#### Option 3 — Modèle LigneDepense (retenu)

Ajouter un modèle `LigneDepense` enfant de `Depense` qui porte la catégorie au
niveau de la ligne. La `Depense` reste l'unité de paiement unique ; les lignes
permettent la ventilation analytique.

## Décision

### Principe

Introduire le modèle `LigneDepense` pour conserver la granularité catégorielle des
besoins au sein d'une dépense unique. `Depense.categorieDepense` reste mais devient
une catégorie "principale" calculée (dominant par montant), utilisée pour le
filtrage rapide en liste. Les analyses de coûts doivent requêter `LigneDepense`
groupé par `categorieDepense` pour obtenir des ventilations précises.

### Schéma Prisma

```prisma
model LigneDepense {
  id               String           @id @default(cuid())
  depenseId        String
  depense          Depense          @relation(fields: [depenseId], references: [id], onDelete: Cascade)
  designation      String
  categorieDepense CategorieDepense
  quantite         Float
  prixUnitaire     Float
  montantTotal     Float            // quantite * prixUnitaire, calculé à la création/mise à jour
  // Liens optionnels vers les origines
  produitId        String?
  produit          Produit?         @relation(fields: [produitId], references: [id], onDelete: SetNull)
  ligneBesoinId    String?
  ligneBesoin      LigneBesoin?     @relation(fields: [ligneBesoinId], references: [id], onDelete: SetNull)
  ligneCommandeId  String?
  ligneCommande    LigneCommande?   @relation(fields: [ligneCommandeId], references: [id], onDelete: SetNull)
  // R8 : siteId obligatoire sur chaque nouveau modèle
  siteId           String
  site             Site             @relation(fields: [siteId], references: [id])
  createdAt        DateTime         @default(now())

  @@index([depenseId])
  @@index([siteId])
  @@index([siteId, categorieDepense])
  @@index([produitId])
  @@index([ligneBesoinId])
  @@index([ligneCommandeId])
}
```

La relation inverse sur `Depense` :

```prisma
// Dans model Depense
lignes  LigneDepense[]
```

Les relations inverses sur `LigneBesoin` et `LigneCommande` :

```prisma
// Dans model LigneBesoin
lignesDepense  LigneDepense[]

// Dans model LigneCommande
lignesDepense  LigneDepense[]
```

### Mapping catégorie

`CategorieProduit` est un sous-ensemble strict de `CategorieDepense` :

| CategorieProduit | CategorieDepense |
|------------------|-----------------|
| ALIMENT          | ALIMENT          |
| INTRANT          | INTRANT          |
| EQUIPEMENT       | EQUIPEMENT       |

Le cast est direct (même nom de valeur). Les lignes sans `produitId` reçoivent
`AUTRE`.

### Logique d'auto-population dans traiterBesoins

Lorsque `traiterBesoins` crée une `Depense` à partir d'une `ListeBesoins`, il doit
également créer les `LigneDepense` correspondantes dans la même transaction :

1. Pour chaque `LigneBesoin` de la liste :
   - `designation` ← `ligneBesoin.designation`
   - `categorieDepense` ← `ligneBesoin.produit?.categorie ?? AUTRE`
   - `quantite` ← `ligneBesoin.quantite`
   - `prixUnitaire` ← `ligneBesoin.prixReel ?? ligneBesoin.prixEstime`
   - `montantTotal` ← `quantite * prixUnitaire`
   - `produitId` ← `ligneBesoin.produitId`
   - `ligneBesoinId` ← `ligneBesoin.id`
   - `ligneCommandeId` ← `ligneBesoin.commandeId` si une `LigneCommande` correspondante existe

2. `Depense.categorieDepense` ← catégorie dont la somme des `montantTotal` est la
   plus élevée parmi les lignes. En cas d'égalité, priorité selon l'ordre :
   `ALIMENT > INTRANT > EQUIPEMENT > AUTRE`.

3. `Depense.montantTotal` ← somme des `montantTotal` de toutes les lignes.

### Dépenses manuelles — compatibilité ascendante

Les `Depense` créées manuellement (sans `listeBesoinsId`) n'ont pas de lignes
obligatoires. Les `LigneDepense` sont optionnelles pour garantir la compatibilité
ascendante avec les dépenses existantes et le formulaire de création manuelle.

L'interface utilisateur de création manuelle peut proposer l'ajout de lignes dans
une section optionnelle "Détail par ligne". Si aucune ligne n'est saisie, le
comportement actuel (catégorie unique en en-tête) s'applique.

### Règles d'intégrité

- `montantTotal` sur `LigneDepense` est calculé et persisté à la création/mise à
  jour, pas recalculé à la lecture. Cela évite les divergences entre la valeur
  affichée et la somme réelle.
- `Depense.montantTotal` doit être recalculé et mis à jour à chaque ajout,
  modification ou suppression d'une `LigneDepense`.
- La suppression d'une `LigneDepense` (cascade depuis `Depense`) ne supprime pas
  le `Produit`, `LigneBesoin` ou `LigneCommande` lié (SetNull ou pas de cascade).

### Impact sur les paiements

Aucun. Les `PaiementDepense` ciblent toujours une seule `Depense`. L'ajout de
`LigneDepense` est transparent pour le circuit de paiement.

### Requêtes analytiques

Pour la ventilation des coûts par catégorie sur un site et une période :

```sql
SELECT
  ld.categorieDepense,
  SUM(ld.montantTotal) AS total
FROM LigneDepense ld
JOIN Depense d ON d.id = ld.depenseId
WHERE ld.siteId = :siteId
  AND d.date BETWEEN :debut AND :fin
GROUP BY ld.categorieDepense
ORDER BY total DESC;
```

Pour les dépenses sans lignes (compatibilité ascendante), continuer à utiliser
`Depense.categorieDepense` directement dans les requêtes de liste et de filtrage.

## Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `prisma/schema.prisma` | Ajout modèle `LigneDepense`, relations inverses sur `Depense`, `LigneBesoin`, `LigneCommande` |
| `prisma/seed.sql` | Données de test : 3-5 `LigneDepense` sur les `Depense` existantes issues de besoins |
| `src/types/models.ts` | Interface `LigneDepense`, mise à jour de `Depense` avec `lignes?: LigneDepense[]` |
| `src/types/index.ts` | Export `LigneDepense` |
| `src/lib/queries/besoins.ts` | `traiterBesoins` : création des lignes dans la même transaction |
| `src/app/api/depenses/route.ts` | POST : création optionnelle des lignes lors d'une dépense manuelle |
| `src/app/api/depenses/[id]/route.ts` | GET : inclure `lignes` dans le `include` Prisma |
| `src/lib/calculs.ts` ou équivalent | Fonction utilitaire `computeDominantCategorie(lignes)` |

## Contraintes et précautions

### R8 — siteId

`LigneDepense.siteId` doit être alimenté avec le même `siteId` que la `Depense`
parente. Ne pas laisser l'appelant le choisir indépendamment.

### R4 — Opérations atomiques

La création de `Depense` et de ses `LigneDepense` doit se faire dans un bloc
`prisma.$transaction([...])`. Aucune création partielle ne doit être possible.

### R3 — Prisma = TypeScript identiques

L'interface TypeScript `LigneDepense` dans `src/types/models.ts` doit être le
miroir exact du modèle Prisma : mêmes noms de champs, mêmes types optionnels.

### Migration

La migration ajoute uniquement la nouvelle table `LigneDepense` et les index. Les
enregistrements `Depense` existants restent sans lignes. Aucune rétro-alimentation
des données historiques n'est requise (les lignes sont optionnelles pour les
dépenses manuelles).

## Résumé

L'ajout de `LigneDepense` résout la perte d'information catégorielle lors de la
conversion `ListeBesoins → Depense` sans remettre en cause l'unité de paiement.
La `Depense` reste l'objet central du circuit financier ; `LigneDepense` est un
satellite analytique. La compatibilité ascendante est assurée par le caractère
optionnel des lignes sur les dépenses manuelles.
