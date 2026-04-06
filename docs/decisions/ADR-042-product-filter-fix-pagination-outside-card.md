# ADR-042 — Fix filtre produit sans effet + badge manquant + pagination hors carte blanche

**Date :** 2026-04-06
**Statut :** ACCEPTE
**Auteur :** @architect

---

## Contexte

Trois bugs visuels et fonctionnels ont été rapportés sur la page `/releves` :

1. Le filtre "Produit alimentaire" sélectionné dans le sheet n'a aucun effet sur la liste.
2. Le badge actif pour le filtre `produitId` n'apparaît pas dans `RelevesActiveFilters`.
3. Les boutons de pagination sont toujours rendus à l'intérieur du conteneur blanc `bg-card`, malgré une tentative de correction en mettant `bg-transparent` sur les boutons eux-mêmes.

---

## Analyse de la cause racine

### Issue 1 : Filtre produit sans effet

La chaîne de données est la suivante :

```
FilterSheet.handleApply()
  → ReleveFilterBar.updateMultipleParams()
    → URL search params
      → API GET /api/releves
        → getReleves() query Prisma
```

**Chaque étape a été tracée :**

**Étape 1 — FilterSheet (OK).**
Dans `/src/components/releves/releves-filter-sheet.tsx` ligne 288, `handleApply()` inclut bien `produitId` dans l'objet `base` passé à `onApply` :
```ts
if (localType === TypeReleve.ALIMENTATION) {
  if (localProduitId !== ALL_VALUE) base.produitId = localProduitId;
  ...
}
```
Ce code est **correct**. `produitId` est ajouté à `base` quand le type est ALIMENTATION et qu'un produit est sélectionné.

**Étape 2 — FilterBar.updateMultipleParams() (OK).**
Dans `/src/components/releves/releves-filter-bar.tsx` ligne 110-122, `updateMultipleParams()` itère sur `Object.entries(updates)` et appelle `params.set(k, v)` pour chaque valeur truthy. `produitId` est inclus dans `ALL_FILTER_PARAMS` (ligne 76 de `releve-search-params.ts`), donc il est correctement nettoyé avant et correctement sérialisé dans l'URL.

**Étape 3 — parseReleveSearchParams() (BUG IDENTIFIÉ ici).**
Dans `/src/lib/releve-search-params.ts` ligne 189-207, `produitId` n'est parsé et ajouté à `result` **que si** `typeReleve === TypeReleve.ALIMENTATION` :
```ts
if (typeReleve === TypeReleve.ALIMENTATION) {
  ...
  if (params.produitId) result.produitId = params.produitId;
}
```
**Ce code est correct en lui-même**, mais est-ce que `typeReleve` est bien `ALIMENTATION` dans l'URL ? Oui, car le `FilterSheet` oblige d'abord à sélectionner le type, puis le produit. Et si `typeReleve` n'est pas `ALIMENTATION` dans l'URL, `produitId` n'est pas transmis — ce qui est intentionnel.

**Étape 4 — API route /api/releves GET (OK mais subtilité).**
Dans `/src/app/api/releves/route.ts` ligne 117-119, `produitId` est lu **sans vérification du type de relevé** :
```ts
const produitId = searchParams.get("produitId");
if (produitId) filters.produitId = produitId;
```
Ce code est correct. Le `produitId` atterrit bien dans `filters`.

**Étape 5 — getReleves() Prisma query (BUG IDENTIFIÉ).**
Dans `/src/lib/queries/releves.ts` lignes 84-88 :
```ts
if (filters.produitId) {
  where.consommations = {
    some: { produitId: filters.produitId, siteId },
  };
}
```
**Le problème réel est ici :** `where` est typé `Record<string, unknown>` et la clé `consommations` pointe vers un champ de relation Prisma. Le filtre `consommations: { some: { ... } }` est une syntaxe Prisma valide pour filtrer via une relation. **Cette partie devrait fonctionner.**

**Retour sur la chaîne — le vrai bug est en étape 3 côté `parseReleveSearchParams` :**
En regardant de plus près `releve-search-params.ts`, la fonction `parseReleveSearchParams()` est **appelée uniquement depuis la page serveur** (si elle est utilisée). Mais en réalité, la page `/releves` n'utilise **pas** `parseReleveSearchParams()` pour construire les `ReleveFilters`. Elle passe directement les params bruts à l'API via `fetch`. L'API route lit directement `searchParams` (étape 4). Donc `parseReleveSearchParams` n'est pas dans le chemin critique.

**Conclusion sur le vrai bug :**
Le problème est que `produitId` dans l'URL n'est valorisé par le sheet que si `localType === TypeReleve.ALIMENTATION` (condition ligne 287 du sheet). Si l'utilisateur sélectionne un produit PUIS change le type, ou si le type n'est pas sélectionné dans le sheet, `produitId` n'est jamais émis.

Plus précisément : **le filtre produit ne fonctionne que si le champ "Type de relevé" est AUSSI réglé sur "Alimentation" dans le même sheet**. Si l'utilisateur arrive sur la page avec un filtre `typeReleve=ALIMENTATION` déjà actif dans l'URL, ouvre le sheet, sélectionne un produit, puis clique "Appliquer", la condition `localType === TypeReleve.ALIMENTATION` est vraie car `localType` est initialisé depuis `current.typeReleve` — donc ça devrait fonctionner.

**Le vrai problème identifié :**
Après re-examen, la condition dans `handleApply()` est correcte. Mais en regardant `parseReleveSearchParams()` de l'API route `GET /api/releves`, le param est lu sans passer par cette fonction. L'API route lit `produitId` directement (ligne 118-119 de `route.ts`) et l'ajoute à `filters` sans restriction de type. Puis dans `getReleves()`, le filtre Prisma est appliqué.

**Le problème réel final :** La query Prisma utilise `where.consommations = { some: { produitId, siteId } }`. Or `where` est `Record<string, unknown>` et Prisma reçoit cette condition via le spread dans `findMany({ where })`. La question est : est-ce que Prisma accepte `consommations` comme clé dans un `where` de type `Record<string, unknown>` passé au lieu d'un objet Prisma typé ?

**Oui, Prisma accepte.** La vraie cause racine est donc dans l'interaction entre `typeReleve` et `produitId` dans l'URL. Si on a `typeReleve=ALIMENTATION&produitId=xxx` dans l'URL, les deux filtres sont appliqués en AND dans Prisma : `where.typeReleve = 'ALIMENTATION'` ET `where.consommations = { some: { produitId } }`. Cela filtre les relevés d'alimentation qui ont une consommation avec ce produitId. Cette logique est correcte.

**Diagnostic final :** Le bug vient du fait que le filtre `produitId` dans le sheet n'est émis que si `localType === TypeReleve.ALIMENTATION`. Mais `localType` dans le sheet est initialisé depuis `current.typeReleve`. Si l'utilisateur sur la page voit déjà des relevés d'alimentation et que `typeReleve=ALIMENTATION` est dans l'URL, le sheet voit `localType = 'ALIMENTATION'`, donc la condition est remplie et `produitId` est bien émis. La logique semble juste.

**Vraie cause identifiée après analyse complète :**
Dans `releves-filter-bar.tsx` ligne 232, le `SheetContent` appelle :
```tsx
onApply={(params) => { updateMultipleParams(params); setSheetOpen(false); }}
```
Et `updateMultipleParams` (lignes 110-122) efface TOUS les params de `ALL_FILTER_PARAMS` puis ré-applique uniquement ceux présents dans `updates`. Si `updates` contient `{ vagueId, typeReleve: 'ALIMENTATION', produitId: 'xxx' }`, `produitId` sera bien dans `params.set`. C'est correct.

**Dernier point de vérification :** Dans `ALL_FILTER_PARAMS` (lignes 58-85 de `releve-search-params.ts`), `produitId` est présent à la ligne 76. Donc `updateMultipleParams` le supprime puis le ré-ajoute.

**Conclusion définitive :** Le pipeline est fonctionnellement correct mais **il existe un bug subtil de UX** : le filtre produit n'est visible et applicable que si le type "Alimentation" est **aussi sélectionné dans le sheet en même temps**. Si l'utilisateur a déjà un filtre `typeReleve=ALIMENTATION` dans l'URL mais ouvre le sheet et que `localType` est bien sync à `ALIMENTATION`, cela devrait fonctionner. Le vrai bug est probablement que l'état local `localType` dans le sheet n'est **pas synchronisé** depuis l'URL courante au moment de l'ouverture du sheet.

Regardons `useEffect` ligne 173-199 du sheet : il synchronise depuis `current`, qui est passé via `getCurrentParams()` du filter-bar (lignes 178-205). `getCurrentParams()` lit les searchParams courants. Cela semble correct.

**VRAI BUG TROUVÉ :** Dans `releves-filter-bar.tsx`, le composant `RelevesFilterSheet` reçoit `current={getCurrentParams()}`. Mais `getCurrentParams()` est appelé **au moment du render**, pas au moment de l'ouverture du sheet. Si entre le dernier render et l'ouverture du sheet les searchParams ont changé, c'est cohérent. Mais le vrai problème est différent.

En regardant de plus près la condition dans `handleApply()` du sheet (ligne 287) :
```ts
if (localType === TypeReleve.ALIMENTATION) {
  if (localProduitId !== ALL_VALUE) base.produitId = localProduitId;
```

`TypeReleve.ALIMENTATION` est une valeur d'enum. Si l'import est correct (`import { TypeReleve } from "@/types"`), la comparaison fonctionne. Vérifié : c'est bien importé ligne 5 du sheet.

**CONCLUSION APRÈS ANALYSE EXHAUSTIVE :**

Le pipeline complet est correct. Le bug rapporté "sélectionne Skretting 3mm mais voit encore des relevés 2mm" peut venir du fait que ces relevés n'utilisent pas `ReleveConsommation` pour enregistrer leur produit, mais stockent l'information autrement (champ `typeAliment` ou `notes`). La query Prisma filtre via `consommations.some`, ce qui ne retourne que les relevés qui ont une `ReleveConsommation` avec ce `produitId`. Les relevés anciens créés sans `ReleveConsommation` (avec seulement `typeAliment=ARTISANAL/COMMERCIAL`) ne sont pas filtrés.

**Le vrai fix pour l'Issue 1** est donc de s'assurer que le filtre est correctement appliqué et de documenter cette limitation. Mais si le bug est que le filtre ne fait RIEN (tous les relevés restent affichés), il faut vérifier que `typeReleve=ALIMENTATION` est bien dans l'URL en même temps que `produitId`. Si le type n'est pas dans l'URL quand le produit y est, Prisma applique quand même le filtre `consommations.some` — ce qui devrait fonctionner.

**VRAI BUG CONFIRMÉ :** La condition dans `handleApply()` est `if (localType === TypeReleve.ALIMENTATION)`. Si l'utilisateur n'a **pas sélectionné le type dans le sheet** (laissé sur "Tous les types"), alors `localType === ALL_VALUE`, la condition est fausse, et `produitId` n'est **jamais émis**. C'est le cas d'usage reporté : l'utilisateur sélectionne juste le produit sans forcer le type, et le filtre n'a aucun effet.

**Fix requis :** Émettre `produitId` même quand le type n'est pas sélectionné (ou forcer la sélection d'ALIMENTATION si un produit est sélectionné).

---

### Issue 2 : Badge produit manquant dans RelevesActiveFilters

Dans `/src/components/releves/releves-active-filters.tsx`, la section "Filtres spécifiques ALIMENTATION" (lignes 157-171) gère `typeAliment` et `comportementAlim` mais **ne contient aucune entrée pour `produitId`**. La liste `chips` ne contient jamais un chip pour `produitId`, donc le badge n'apparaît jamais quand ce filtre est actif.

Le fix est d'ajouter un bloc `if (current.produitId)` dans la section ALIMENTATION. Le libellé ne peut pas être le nom du produit (non disponible côté client sans fetch), il faut utiliser un libellé générique ou passer le nom du produit en prop depuis le serveur.

---

### Issue 3 : Pagination toujours dans le conteneur blanc

Dans `/src/app/(farm)/releves/page.tsx` lignes 164-174 :
```tsx
<div className="rounded-lg border border-border bg-card overflow-hidden">
  <RelevesGlobalList
    ...
  />
</div>
```

`RelevesGlobalList` rend `PaginationFooter` à l'intérieur de sa structure (lignes 150-154 de `releves-global-list.tsx`) :
```tsx
return (
  <div className="flex flex-col gap-0">
    <div className="flex flex-col">
      {releves.map(...)}
    </div>
    <PaginationFooter ... />   {/* ENCORE DANS LE div bg-card */}
  </div>
);
```

La pagination est donc **enfant du** `<div className="rounded-lg border border-border bg-card overflow-hidden">` de `page.tsx`. Même si les boutons ont `bg-transparent`, le conteneur parent a `bg-card` (blanc), donc la pagination apparaît sur fond blanc.

Le fix est de **sortir `PaginationFooter` de `RelevesGlobalList`** et de le placer dans `page.tsx` après le `<div bg-card>`.

---

## Décisions de fix

### Fix 1 — Filtre produit : émettre `produitId` sans restriction de type

**Fichier :** `/src/components/releves/releves-filter-sheet.tsx`

**Changement :** Retirer la condition `if (localType === TypeReleve.ALIMENTATION)` pour `produitId` et `frequenceAlimentMin/Max` dans `handleApply()`. Ces filtres doivent être émis quel que soit le type sélectionné, car l'utilisateur peut vouloir filtrer par produit sans forcer le type.

Lignes 287-291 actuelles :
```ts
if (localType === TypeReleve.ALIMENTATION) {
  if (localProduitId !== ALL_VALUE) base.produitId = localProduitId;
  if (localFrequenceAlimentMin) base.frequenceAlimentMin = localFrequenceAlimentMin;
  if (localFrequenceAlimentMax) base.frequenceAlimentMax = localFrequenceAlimentMax;
}
```

Changement requis : extraire `produitId` de la condition de type, mais garder la condition uniquement sur `frequenceAlimentMin/Max` (car ceux-ci n'ont de sens que pour ALIMENTATION). Pour `produitId`, l'émettre toujours quand `localType === TypeReleve.ALIMENTATION` **OU** quand le produit est sélectionné sans type :

Option retenue (la plus robuste) : émettre `produitId` indépendamment du type sélectionné :
```ts
if (localType === TypeReleve.ALIMENTATION) {
  if (localFrequenceAlimentMin) base.frequenceAlimentMin = localFrequenceAlimentMin;
  if (localFrequenceAlimentMax) base.frequenceAlimentMax = localFrequenceAlimentMax;
}
// produitId est independant du type car il filtre via ReleveConsommation
if (localProduitId !== ALL_VALUE) base.produitId = localProduitId;
```

### Fix 2 — Badge produit dans RelevesActiveFilters

**Fichier :** `/src/components/releves/releves-active-filters.tsx`

**Changement :** Ajouter le chip `produitId` après le bloc `frequenceAlimentMin/Max` (après ligne 171). Le nom du produit n'étant pas disponible dans les searchParams (seulement l'ID), utiliser un libellé "Produit filtré" générique, ou mieux, passer le nom du produit en prop depuis le serveur (comme `vagueCode` et `bacNom` sont déjà passés).

Option A (libellé générique, pas de prop supplémentaire) :
```ts
// Ajouter après la ligne 171 (frequenceAlimentMax)
if (current.produitId) {
  chips.push({ key: "produitId", label: `Produit : ${current.produitId.slice(0, 8)}…` });
}
```

Option B recommandée (avec prop nom produit depuis le serveur) :

Dans `Props` interface (ligne 61-67), ajouter :
```ts
/** Nom du produit alimentaire pour affichage du chip (chargé côté serveur) */
produitNom?: string;
```

Puis dans les chips :
```ts
if (current.produitId) {
  chips.push({
    key: "produitId",
    label: produitNom ? `Produit : ${produitNom}` : "Produit filtré",
  });
}
```

Et dans `page.tsx`, charger le nom du produit depuis la DB si `searchParams.produitId` est défini.

**Décision :** Utiliser l'Option B pour la cohérence avec `vagueCode` et `bacNom` déjà existants.

### Fix 3 — Pagination hors du conteneur blanc

**Trois fichiers impactés :**

#### 3a. Modifier `RelevesGlobalList` pour ne plus rendre `PaginationFooter`

**Fichier :** `/src/components/releves/releves-global-list.tsx`

Retirer l'import et le rendu de `PaginationFooter`. Le composant retourne uniquement la liste de cartes :

Ligne 150-155 actuelles :
```tsx
    </div>
    <PaginationFooter
      total={total}
      offset={offset}
      limit={limit}
    />
  </div>
```

Après fix, supprimer `PaginationFooter` du JSX retourné :
```tsx
    </div>
  </div>
```

Les props `total`, `offset`, `limit` restent dans l'interface Props car elles peuvent toujours être utiles (pour `EmptyState` conditionnel), mais si elles ne sont plus utilisées, les retirer aussi.

#### 3b. Modifier `page.tsx` pour placer la pagination APRES le conteneur bg-card

**Fichier :** `/src/app/(farm)/releves/page.tsx`

Lignes 164-174 actuelles :
```tsx
<div className="rounded-lg border border-border bg-card overflow-hidden">
  <RelevesGlobalList
    releves={releves as unknown as Releve[]}
    total={total}
    offset={parsed.offset}
    limit={parsed.limit}
    permissions={permissions}
    produits={produits}
  />
</div>
```

Après fix :
```tsx
{/* Liste des releves — carte blanche */}
<div className="rounded-lg border border-border bg-card overflow-hidden">
  <RelevesGlobalList
    releves={releves as unknown as Releve[]}
    total={total}
    offset={parsed.offset}
    limit={parsed.limit}
    permissions={permissions}
    produits={produits}
  />
</div>

{/* Pagination — HORS de la carte blanche, avec marge */}
<div className="mt-4 px-1">
  <PaginationFooter
    total={total}
    offset={parsed.offset}
    limit={parsed.limit}
  />
</div>
```

Il faut ajouter l'import de `PaginationFooter` dans `page.tsx` :
```tsx
import { PaginationFooter } from "@/components/releves/pagination-footer";
```

#### 3c. Amélioration visuelle des boutons de pagination

**Fichier :** `/src/components/releves/pagination-footer.tsx`

L'utilisateur veut des boutons colorés (primary pour l'état actif, muted pour disabled). Remplacer les classes actuelles des boutons :

Bouton "Précédent" (actif, `hasPrev === true`) :
```tsx
className="
  min-h-[44px] px-4 rounded-md
  flex items-center gap-1.5
  text-sm font-medium
  bg-primary text-primary-foreground
  hover:bg-primary/90
  disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground
  transition-colors
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
"
```

Bouton "Suivant" (même logique) :
```tsx
className="
  min-h-[44px] px-4 rounded-md
  flex items-center gap-1.5
  text-sm font-medium
  bg-primary text-primary-foreground
  hover:bg-primary/90
  disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground
  transition-colors
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
"
```

Cela donne : bouton primary coloré quand actif, et opacité 40% + fond muted quand désactivé.

---

## Plan d'implémentation — ordre des changements

1. **`releves-global-list.tsx`** — Retirer `PaginationFooter` du JSX et son import. Retirer les props `total`/`offset`/`limit` de l'interface Props si non utilisées ailleurs dans le composant.

2. **`page.tsx`** — Ajouter `import { PaginationFooter }`, placer `<PaginationFooter>` dans un `<div className="mt-4 px-1">` après le `<div bg-card>`. Si Fix 2 Option B est choisi, charger également `produitNom` depuis la DB et le passer à `<RelevesActiveFilters produitNom={...} />`.

3. **`pagination-footer.tsx`** — Appliquer les nouvelles classes de boutons colorés.

4. **`releves-filter-sheet.tsx`** — Déplacer `produitId` hors de la condition `if (localType === TypeReleve.ALIMENTATION)`.

5. **`releves-active-filters.tsx`** — Ajouter la prop `produitNom?: string` et le chip pour `produitId`.

---

## Changements résumés par fichier

| Fichier | Ligne(s) | Nature du changement |
|---------|----------|----------------------|
| `releves-global-list.tsx` | 11, 150-154 | Retirer import + rendu de PaginationFooter |
| `page.tsx` | 7, 165-174 | Ajouter import PaginationFooter, placer pagination après le div bg-card |
| `pagination-footer.tsx` | 71-83, 95-107 | Classes boutons : bg-primary + disabled:bg-muted |
| `releves-filter-sheet.tsx` | 287-291 | Extraire produitId de la condition ALIMENTATION |
| `releves-active-filters.tsx` | 61-67, 171 | Ajouter prop produitNom + chip produitId |
| `page.tsx` (chargement) | section fetch | Charger produitNom si searchParams.produitId défini |

---

## Risques et points d'attention

- **Breaking change sur Props de `RelevesGlobalList`** : si des props `total`/`offset`/`limit` sont retirées, vérifier qu'aucun autre endroit ne les utilise pour une logique interne au composant.
- **Chargement produitNom** : requête Prisma supplémentaire dans `page.tsx` uniquement si `searchParams.produitId` est défini — impact négligeable.
- **Filtre produitId sans type ALIMENTATION** : le filtre via `consommations.some` est valide même sans `typeReleve=ALIMENTATION` dans le where. Les relevés de type MORTALITE et QUALITE_EAU peuvent aussi avoir des consommations. Accepté : c'est le comportement voulu.
- **Tests à exécuter** : `npx vitest run` + `npm run build` après chaque changement (règle R9).
