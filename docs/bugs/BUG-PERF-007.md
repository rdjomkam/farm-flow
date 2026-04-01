# BUG-PERF-007 — 3 requêtes SQL séparées au lieu d'un GROUP BY dans sumCoutsParCategorie
**Sévérité :** Basse
**Détecté par :** @architect
**Sprint :** Performance (hors-sprint)
**Fichier(s) :**
- `src/lib/queries/finances.ts` (fonction `sumCoutsParCategorie`, appelée dans `getResumeFinancier`)

## Description
La fonction `sumCoutsParCategorie` est appelée 3 fois dans `getResumeFinancier` (via `Promise.all`) pour calculer les coûts par catégorie (ALIMENT, INTRANT, EQUIPEMENT) :

```typescript
const [
  ...,
  coutsAliments,     // sumCoutsParCategorie(siteId, ALIMENT, dateFilter)
  coutsIntrants,     // sumCoutsParCategorie(siteId, INTRANT, dateFilter)
  coutsEquipements,  // sumCoutsParCategorie(siteId, EQUIPEMENT, dateFilter)
  ...
] = await Promise.all([...]);
```

Chaque appel exécute un `prisma.mouvementStock.findMany` avec un filtre sur `produit.categorie`, puis fait la somme en JavaScript avec `.reduce`. Cela génère 3 requêtes SQL qui parcourent le même sous-ensemble de données (`MouvementStock JOIN Produit WHERE siteId AND type=ENTREE`).

**Atténuation existante** : les 3 appels sont dans `Promise.all` — ils s'exécutent en parallèle. L'impact est donc réduit comparé à une exécution séquentielle.

**Problème résiduel** : 3 round-trips vers la base de données au lieu d'1, et l'agrégation est faite en JavaScript au lieu d'être déléguée au moteur SQL qui est optimisé pour ça (index, parallel hash aggregation).

## Étapes de reproduction
1. Activer les logs Prisma (`DEBUG=prisma:query`)
2. Appeler `GET /api/finances` ou charger le dashboard finances
3. Observer : 3 requêtes `SELECT` sur `MouvementStock` avec des filtres identiques sauf `categorie`

## Cause racine
Prisma ne supporte pas `aggregate._sum` sur des champs filtrés via des relations (`produit.categorie`). La solution de contournement historique avec `findMany` + `reduce` génère 3 requêtes séparées. Une requête `$queryRaw` avec `GROUP BY` résoudrait cela.

## Fix
- [ ] Remplacer les 3 appels `sumCoutsParCategorie` par une seule requête `prisma.$queryRaw` avec `GROUP BY p."categorie"` :
  ```typescript
  const coutsParCategorie = await prisma.$queryRaw<
    Array<{ categorie: string; total: number }>
  >`
    SELECT p."categorie", COALESCE(SUM(ms."prixTotal"), 0)::float AS total
    FROM "MouvementStock" ms
    JOIN "Produit" p ON ms."produitId" = p."id"
    WHERE ms."siteId" = ${siteId}
      AND ms."type" = 'ENTREE'
      AND ms."prixTotal" IS NOT NULL
    GROUP BY p."categorie"
  `;
  ```
- [ ] Gérer le filtre de date conditionnel avec `Prisma.sql` template tag
- [ ] Extraire `coutsAliments`, `coutsIntrants`, `coutsEquipements` depuis le résultat du GROUP BY
- [ ] Test de non-régression : les valeurs calculées sont identiques avant et après le refactor
- [ ] Tous les tests passent
- [ ] Build OK

## Statut : OUVERT
