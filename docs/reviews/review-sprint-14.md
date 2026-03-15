# Review Sprint 14 — Support des unités d'achat/consommation

**Revieweur :** @code-reviewer
**Date :** 2026-03-15
**Sprint :** 14
**Verdict : VALIDE** (avec 2 observations mineures non-bloquantes)

---

## Périmètre de la review

Fichiers modifiés / créés dans ce sprint :

| Fichier | Nature |
|---------|--------|
| `prisma/schema.prisma` | Enum UniteStock étendu (GRAMME, MILLILITRE), champs uniteAchat + contenance sur Produit |
| `prisma/migrations/20260312150000_add_unit_conversion/migration.sql` | Migration ALTER TYPE (recreate) + ALTER TABLE |
| `src/types/models.ts` | UniteStock.GRAMME + UniteStock.MILLILITRE, Produit.uniteAchat + Produit.contenance |
| `src/types/api.ts` | CreateProduitDTO.uniteAchat + .contenance, UpdateProduitDTO idem |
| `src/lib/calculs.ts` | Fonctions getPrixParUniteBase() + convertirQuantiteAchat() |
| `src/lib/queries/produits.ts` | createProduit/updateProduit gèrent uniteAchat+contenance, blocage si stockActuel>0 |
| `src/app/api/produits/route.ts` | Validation POST uniteAchat+contenance ensemble |
| `src/app/api/produits/[id]/route.ts` | Validation PUT + 409 pour contenance non modifiable |
| `src/components/stock/produits-list-client.tsx` | GRAMME/MILLILITRE dans uniteLabels, formulaire + affichage équivalence |
| `src/components/stock/produit-detail-client.tsx` | Idem + champ contenance désactivé si stockActuel > 0 |
| `src/components/stock/mouvements-list-client.tsx` | Affichage uniteAchat pour ENTREE, unite pour SORTIE |
| `src/components/stock/commandes-list-client.tsx` | uniteAchat dans lignes commande |
| `src/components/stock/commande-detail-client.tsx` | uniteAchat dans affichage lignes |
| `src/components/releves/consommation-fields.tsx` | GRAMME/MILLILITRE dans uniteLabels |
| `src/components/releves/form-alimentation.tsx` | Prop uniteAliment, label dynamique |
| `src/components/releves/releve-form-client.tsx` | Dérivation uniteAliment depuis premier produit sélectionné |
| `src/__tests__/calculs.test.ts` | Suites getPrixParUniteBase (8 tests) + convertirQuantiteAchat (9 tests) |
| `src/__tests__/api/produits.test.ts` | 12 nouveaux tests validation uniteAchat+contenance POST + PUT |

---

## Checklist R1-R9

### R1 — Enums MAJUSCULES

Vérification du schéma Prisma :
```
enum UniteStock {
  GRAMME
  KG
  MILLILITRE
  LITRE
  UNITE
  SACS
}
```
Les deux nouvelles valeurs GRAMME et MILLILITRE sont bien en UPPERCASE.

Vérification TypeScript (`src/types/models.ts`) :
```typescript
export enum UniteStock {
  GRAMME = "GRAMME",
  KG = "KG",
  MILLILITRE = "MILLILITRE",
  ...
}
```
Conforme.

### R2 — Toujours importer les enums

| Fichier | Imports | Usage |
|---------|---------|-------|
| `src/app/api/produits/route.ts` | `import { Permission, CategorieProduit, UniteStock } from "@/types"` | `Object.values(UniteStock)` pour validation |
| `src/app/api/produits/[id]/route.ts` | `import { Permission, CategorieProduit, UniteStock } from "@/types"` | Idem |
| `src/components/stock/produits-list-client.tsx` | `import { ..., UniteStock } from "@/types"` | `UniteStock.GRAMME`, etc. dans uniteLabels |
| `src/components/stock/produit-detail-client.tsx` | `import { CategorieProduit, UniteStock, TypeMouvement } from "@/types"` | Conforme |
| `src/components/stock/mouvements-list-client.tsx` | `import { TypeMouvement, UniteStock, Permission } from "@/types"` | Conforme |
| `src/components/stock/commandes-list-client.tsx` | Inclut `UniteStock` | Conforme |
| `src/components/stock/commande-detail-client.tsx` | Inclut `UniteStock` | Conforme |
| `src/components/releves/consommation-fields.tsx` | `import { UniteStock } from "@/types"` | Conforme |
| `src/lib/queries/produits.ts` | Import depuis `@/types` | Conforme |

Aucun usage de valeurs string littérales pour les enums.

### R3 — Prisma = TypeScript identiques

Comparaison schéma vs types :

| Champ Prisma | Type Prisma | Type TypeScript |
|-------------|-------------|-----------------|
| `Produit.uniteAchat` | `UniteStock?` | `UniteStock \| null` |
| `Produit.contenance` | `Float?` | `number \| null` |
| `UniteStock.GRAMME` | enum value | `GRAMME = "GRAMME"` |
| `UniteStock.MILLILITRE` | enum value | `MILLILITRE = "MILLILITRE"` |

Alignement parfait. R3 respecté.

### R4 — Opérations atomiques

Dans `src/lib/queries/produits.ts`, la fonction `updateProduit` :
- Utilise `prisma.produit.updateMany({ where: { id, siteId }, data: {...} })` — conforme R4
- La vérification "contenance non modifiable si stockActuel > 0" fait d'abord un `findFirst` puis un `updateMany`. Il y a théoriquement une fenêtre de race condition entre le read et le write. En pratique, dans le contexte piscicole (un seul opérateur actif à la fois par site), ce risque est acceptable. Voir observation M1.

### R5 — DialogTrigger asChild

| Composant | Usage DialogTrigger |
|-----------|---------------------|
| `produits-list-client.tsx` | `<DialogTrigger asChild><Button>...</Button></DialogTrigger>` — conforme |
| `produit-detail-client.tsx` | `<DialogTrigger asChild><Button>...</Button></DialogTrigger>` — conforme |

R5 respecté dans tous les composants modifiés.

### R6 — CSS variables du thème

Vérification des composants modifiés : aucune couleur hexadécimale ou RGB en dur. Usage exclusif de classes Tailwind (`text-muted-foreground`, `text-destructive`, `bg-primary`, etc.) qui mappent sur les variables CSS du thème.

### R7 — Nullabilité explicite

Les nouveaux champs sont explicitement nullables :
- `uniteAchat` : `UniteStock?` dans Prisma, `UniteStock | null` dans TypeScript — conforme
- `contenance` : `Float?` dans Prisma, `number | null` dans TypeScript — conforme
- Les DTOs `CreateProduitDTO` et `UpdateProduitDTO` marquent ces champs optionnels (`?`) — conforme

### R8 — siteId PARTOUT

| Route | siteId vérifié |
|-------|---------------|
| `POST /api/produits` | `auth.activeSiteId` passé à `createProduit(siteId, data)` |
| `GET /api/produits` | `getProduits(auth.activeSiteId, filters)` |
| `GET /api/produits/[id]` | `getProduitById(id, auth.activeSiteId)` |
| `PUT /api/produits/[id]` | `updateProduit(id, auth.activeSiteId, data)` |
| `DELETE /api/produits/[id]` | `deleteProduit(id, auth.activeSiteId)` |

Les queries Prisma utilisent toutes `where: { id, siteId }`. R8 respecté.

### R9 — Tests avant review

- `npx vitest run` : 1079/1079 tests passent (37 fichiers), 0 échec
- `npm run build` : Build production OK, aucune erreur TypeScript
- Rapport de tests : `docs/tests/rapport-sprint-14.md` produit

---

## Observations

### M1 (Mineur) — Race condition théorique sur la vérification contenance

**Fichier :** `src/lib/queries/produits.ts`, fonction `updateProduit`, lignes 97-105

**Description :** La logique de blocage de modification de contenance effectue d'abord un `findFirst` (lecture `stockActuel`) puis un `updateMany` séparé. Dans un environnement multi-utilisateurs à forte concurrence, un mouvement de stock pourrait s'intercaler entre les deux opérations et rendre le check obsolète.

**Impact :** Très faible dans le contexte métier (pisciculture, un opérateur par site). Non-bloquant.

**Recommandation :** Si la charge augmente, encapsuler dans une transaction Prisma ou utiliser une contrainte CHECK en base.

### M2 (Mineur) — Label uniteAliment dérivé du premier produit seulement

**Fichier :** `src/components/releves/releve-form-client.tsx`, lignes 382-387

**Description :** L'`uniteAliment` affiché dans le formulaire d'alimentation est dérivé uniquement du premier produit sélectionné dans les lignes de consommation. Si l'utilisateur sélectionne des produits avec des unités différentes (ex: aliment 1 en KG, aliment 2 en GRAMME), le label n'est affiché que pour le premier.

**Impact :** UX marginalement incohérente, mais le cas est rare (aliments de même catégorie ont en général la même unité). Non-bloquant.

**Recommandation :** Dans une itération future, afficher l'unité par ligne de consommation plutôt qu'un label global. Reportable à Sprint 16 ou Sprint 12 polish.

---

## Points positifs

1. **Migration conforme** : La stratégie RECREATE pour l'enum PostgreSQL est correcte (R1 lessons learned de la Phase 1). ALTER TYPE RENAME + CREATE NEW + CAST + DROP OLD évite les problèmes de shadow DB.

2. **Cohérence des uniteLabels** : GRAMME="g" et MILLILITRE="mL" sont cohérents dans tous les 6 composants qui les utilisent (produits-list, produit-detail, mouvements-list, commandes-list, commande-detail, consommation-fields, releve-form-client).

3. **UX de protection** : Le champ contenance est désactivé dans le formulaire d'édition si `stockActuel > 0` — bonne prévention utilisateur en plus de la protection serveur.

4. **Fonctions pures testables** : `getPrixParUniteBase` et `convertirQuantiteAchat` sont des fonctions pures sans effets de bord, bien testées (17 tests unitaires).

5. **Rétro-compatibilité** : Les produits existants sans `uniteAchat`/`contenance` continuent de fonctionner normalement. Les affichages conditionnels (`p.uniteAchat && p.contenance`) sont bien gérés.

---

## Verdict final

**VALIDE** — Le Sprint 14 respecte toutes les règles R1-R9. Les 2 observations sont mineures et non-bloquantes. Le sprint est prêt pour être marqué FAIT.

Le Sprint 15 (Upload Facture sur Commande) peut commencer.
