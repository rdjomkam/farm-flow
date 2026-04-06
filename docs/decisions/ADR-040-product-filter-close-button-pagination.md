# ADR-040 — Trois correctifs UI : filtre produit alimentation, bouton fermeture Sheet, pagination relevés

**Date :** 2026-04-06
**Statut :** ACCEPTÉ
**Décideur :** @architect
**Impacté :** @developer, @tester

---

## Contexte

Trois problèmes UI ont été remontés par l'utilisateur sur la page `/releves` :

1. Le filtre Alimentation utilise les enums `TypeAliment` (ARTISANAL/COMMERCIAL/MIXTE) et `ComportementAlimentaire` (VORACE/NORMAL/FAIBLE/REFUSE), alors que l'utilisateur veut filtrer par le **nom réel du produit** (ex. "Skretting", "Gouessant") stocké dans le modèle `Produit`.
2. Le bouton de fermeture (`DialogPrimitive.Close`) du Sheet de filtres est caché derrière la safe-area sur iOS, malgré un correctif partiel (`style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}`).
3. La pagination affiche un design "charger plus" cassé : le paramètre `offset` remplace la page entière (comportement offset-pagination) mais l'interface prétend accumuler des résultats (`shown = offset + releves.length`). L'utilisateur ne sait pas sur quelle page il est ni combien de pages existent.

---

## Analyse de la situation existante

### Problème 1 — Filtre aliment

La relation est :
```
Releve (typeReleve=ALIMENTATION)
  -> ReleveConsommation (releveId, produitId)
  -> Produit (nom, categorie=ALIMENT)
```

`releves-filter-sheet.tsx` expose deux `<Select>` pour `typeAliment` et `comportementAlim` sous le bloc conditionnel `localType === TypeReleve.ALIMENTATION`. Ces deux filtres ciblent des champs directs sur la table `Releve` (`typeAliment` enum, `comportementAlim` enum). Ils n'ont aucun lien avec les produits réels de la table `Produit`.

`src/lib/releve-search-params.ts` définit `typeAliment?: string` et `comportementAlim?: string` dans `ReleveSearchParams` et `ParsedReleveFilters`.

`src/lib/queries/releves.ts` filtre directement `where.typeAliment` et `where.comportementAlim` sur la table `Releve`.

Pour filtrer par produit, il faut une jointure via `ReleveConsommation` : un relevé correspond si au moins une de ses lignes `ReleveConsommation` pointe vers le `produitId` sélectionné.

### Problème 2 — Bouton fermeture Sheet

Dans `src/components/ui/sheet.tsx`, le `SheetContent` applique `pt-[env(safe-area-inset-top)]` au conteneur via la classe Tailwind sur `DialogPrimitive.Content`. Simultanément, le bouton `DialogPrimitive.Close` est positionné `absolute` avec `style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}`.

Dans `releves-filter-bar.tsx`, le `SheetContent` reçoit la classe override `!left-auto !right-0` pour faire glisser le Sheet **depuis la droite**. Cela ne change pas le positionnement du bouton Close qui est toujours `absolute right-3`.

Le vrai problème est que le `SheetContent` a un `pt-[env(safe-area-inset-top)]` sur le conteneur **et** que `RelevesFilterSheet` (enfant) a un header avec `pt-[env(safe-area-inset-top)]` sur son propre `<div>`. Le bouton Close est positionné par rapport au conteneur, mais visuellement il se retrouve **sous** le header du filter sheet. Les deux padding s'appliquent en couche et le bouton Close s'aligne sur l'inset top du conteneur pendant que le contenu du sheet est déjà poussé en dessous. Sur certains appareils, le bouton Close tombe à l'intérieur de l'en-tête du sheet mais sous le texte "Filtres", le rendant invisible ou inaccessible.

Le problème fondamental : le composant `SheetContent` générique gère la safe-area **et** injecte un bouton Close absolu. Mais `RelevesFilterSheet` gère **son propre** en-tête avec safe-area. Les deux se marchent dessus.

### Problème 3 — Pagination cassée

`pagination-footer.tsx` reçoit `shown = offset + releves.length`. Quand `offset=20` et que la page renvoie 20 éléments, `shown=40`. Le composant affiche "Affichage 40 sur 45 relevés". Mais l'utilisateur ne voit que 20 cartes à l'écran (la page 2). Le "charger plus" navigue en pushant `offset=40`, ce qui remplace encore la liste par les 5 derniers éléments.

C'est un mélange incohérent entre **pagination par offset** (comportement de l'URL) et **infinite scroll / load-more** (interface). Les deux approches sont mutuellement exclusives :

- **Load-more / infinite scroll** : accumule les résultats dans le state client, offset croît, la liste grandit.
- **Pagination offset** : remplace la liste à chaque changement d'offset, affiche "Page X sur Y".

La page `/releves` est un Server Component qui relit les données depuis l'URL à chaque navigation. Elle ne peut pas accumuler des résultats sans state client. Donc le pattern load-more ne fonctionne pas sans refactoring majeur. La pagination offset est le choix correct pour ce contexte.

---

## Décisions

### Décision 1 — Remplacer TypeAliment/ComportementAlimentaire par un sélecteur de produit dynamique

#### Approche retenue

Supprimer les filtres `typeAliment` et `comportementAlim` du bloc ALIMENTATION dans le filter sheet. Les remplacer par un sélecteur de produit alimentaire chargé dynamiquement depuis l'API.

L'appel API doit retourner uniquement les produits de catégorie `ALIMENT` **qui ont au moins une ReleveConsommation** dans le site courant. Cela évite de proposer des produits jamais utilisés dans des relevés.

**Alternatives considérées :**
- Charger tous les produits `ALIMENT` actifs : plus simple mais pollue le sélecteur avec des produits jamais consommés.
- Charger uniquement ceux utilisés dans des relevés ALIMENTATION : choix retenu — pertinent pour l'utilisateur, liste courte.

#### Nouveau endpoint

```
GET /api/produits/aliment-releve?siteId=<active>
```

Retourne : `{ data: [{ id: string; nom: string; unite: string }] }`

Ce endpoint filtre les produits ainsi (Prisma) :
```
produit.categorie = ALIMENT
AND produit.isActive = true
AND EXISTS (SELECT 1 FROM ReleveConsommation rc WHERE rc.produitId = produit.id AND rc.siteId = siteId)
```

En Prisma : `findMany` avec `where: { categorie: CategorieProduit.ALIMENT, isActive: true, siteId, consommations: { some: { siteId } } }`.

#### Modifications `releve-search-params.ts`

Ajouter dans `ReleveSearchParams` :
```typescript
// Filtre ALIMENTATION — produit par ID (remplace typeAliment + comportementAlim)
produitId?: string;
```

Ajouter dans `ALL_FILTER_PARAMS` : `"produitId"`.

Garder `typeAliment` et `comportementAlim` dans `ReleveSearchParams` et `ALL_FILTER_PARAMS` pour la rétrocompatibilité des URLs existantes (ils seront ignorés si `produitId` est présent). Retirer leur parsing actif dans `parseReleveSearchParams` est optionnel — ils peuvent rester inactifs.

Ajouter dans `ParsedReleveFilters` :
```typescript
produitId?: string; // filtre ALIMENTATION par produit
```

#### Modifications `releves-filter-sheet.tsx`

Dans le bloc `localType === TypeReleve.ALIMENTATION` :

1. Supprimer les deux `<Select>` `typeAliment` et `comportementAlim`.
2. Ajouter un état local `localProduitId` (initialisé depuis `current.produitId ?? ALL_VALUE`).
3. Charger les produits via `fetch("/api/produits/aliment-releve")` dans un `useEffect` au montage (une seule fois — la liste ne dépend pas des autres filtres).
4. Afficher un `<Select>` "Produit alimentaire" avec un item "Tous les produits".
5. Dans `handleApply`, si `localProduitId !== ALL_VALUE` : `base.produitId = localProduitId`.

Le filtre `frequenceAlimentMin`/`frequenceAlimentMax` est conservé — il filtre un champ direct sur `Releve.frequenceAliment`.

#### Modifications `releves-filter-bar.tsx`

Dans `handleTypeChange` : ajouter reset de `localProduitId` (état local correspondant).

Dans `updateMultipleParams` : `"produitId"` est déjà couvert par `ALL_FILTER_PARAMS`.

#### Modifications `src/lib/queries/releves.ts`

Dans `getReleves`, ajouter après le bloc ALIMENTATION existant :

```typescript
// Filtre ALIMENTATION par produit — jointure via ReleveConsommation
if (filters.produitId) {
  where.consommations = {
    some: { produitId: filters.produitId, siteId },
  };
}
```

Note : ce filtre est indépendant de `typeReleve`. Il peut techniquement filtrer des relevés non-ALIMENTATION ayant consommé ce produit (ex. MORTALITE avec un intrant). En pratique, le sélecteur UI ne s'affiche que quand `typeReleve=ALIMENTATION` est actif, ce qui limite le risque. Aucune guard côté query n'est nécessaire.

#### Modifications `src/app/api/releves/route.ts`

Dans `GET`, ajouter :
```typescript
const produitId = searchParams.get("produitId");
if (produitId) filters.produitId = produitId;
```

#### Interface `ReleveFilters` dans `src/types/`

Ajouter `produitId?: string` dans `ReleveFilters`.

#### `countActiveFilters`

Ajouter : `if (params.produitId) count++;`

---

### Décision 2 — Corriger le bouton fermeture Sheet

#### Cause racine confirmée

Le `SheetContent` générique injecte un `DialogPrimitive.Close` absolu, positionné via `style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}`. Mais `RelevesFilterSheet` gère son propre header avec `pt-[env(safe-area-inset-top)]`, ce qui crée un double-padding. Le bouton Close se retrouve aligné sur le top du conteneur, visuellement dans la zone de l'inset, pendant que le header du sheet est poussé plus bas.

De plus, le `SheetContent` a lui-même `pt-[env(safe-area-inset-top)]` dans ses classes Tailwind, ce qui pousse tout le contenu. Le bouton Close positionné `absolute` échappe à ce padding et se retrouve en dehors de la zone visible (dans la safe area native).

#### Approche retenue — Supprimer le bouton Close générique du SheetContent pour le filter sheet

Le composant `RelevesFilterSheet` gère déjà son propre header avec un titre "Filtres" et un bouton "Effacer tout". Il n'a pas besoin du bouton Close générique du `SheetContent`.

La solution : passer une prop `hideCloseButton` (ou `showCloseButton={false}`) au `SheetContent`, ou utiliser `SheetClose` manuellement dans le header du filter sheet.

**Approche concrète :**

Modifier `src/components/ui/sheet.tsx` pour accepter une prop `hideCloseButton?: boolean` dans `SheetContent`. Quand `hideCloseButton={true}`, le `DialogPrimitive.Close` n'est pas rendu.

Modifier le header de `RelevesFilterSheet` pour inclure un vrai bouton `SheetClose` (accessible) avec une icône X :

```tsx
import { SheetClose } from "@/components/ui/sheet";
import { X } from "lucide-react";

// Dans le header du filter sheet
<div className="shrink-0 flex items-center justify-between px-4 border-b border-border"
     style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}>
  <h2 className="text-base font-semibold">Filtres</h2>
  <div className="flex items-center gap-2">
    {activeCount > 0 && (
      <button type="button" onClick={onClear} className="text-sm text-muted-foreground hover:text-foreground underline">
        Effacer tout
      </button>
    )}
    <SheetClose asChild>
      <button type="button" className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-accent">
        <X className="h-5 w-5" />
        <span className="sr-only">Fermer</span>
      </button>
    </SheetClose>
  </div>
</div>
```

Supprimer `pt-[env(safe-area-inset-top)]` de la classe Tailwind de `SheetContent` (ou le rendre conditionnel), puisque le filter sheet gère lui-même ce padding dans son header.

Dans `releves-filter-bar.tsx`, passer `hideCloseButton` au `SheetContent` :
```tsx
<SheetContent className="!left-auto !right-0 !inset-y-0 !w-full sm:!w-96 !p-0 flex flex-col" hideCloseButton>
```

**Avantages :**
- Le bouton Close est dans le flux normal du DOM (pas de positionnement absolu).
- `paddingTop: "max(0.75rem, env(safe-area-inset-top))"` sur le header garantit que le bouton est toujours visible, quelle que soit la taille de la safe area.
- Compatible avec le Sheet glissant depuis la droite (pas de logique left/right à gérer).
- Le bouton Close reste accessible (Radix gère l'ARIA et la fermeture du Dialog).

**Alternatives considérées :**
- Augmenter le `top` du bouton absolu : fragile, dépend de la taille de l'inset qui varie par appareil.
- Retirer complètement le `pt-[env(safe-area-inset-top)]` du `SheetContent` : casse la navigation sidebar qui utilise le même composant.

---

### Décision 3 — Refondre la pagination en offset-pagination claire

#### Approche retenue — Pagination offset avec "Page X / Y" et Précédent/Suivant

Remplacer le composant `PaginationFooter` par une pagination offset classique, cohérente avec le comportement URL existant.

**Interface du nouveau composant :**

```typescript
interface PaginationFooterProps {
  total: number;       // total d'éléments (après filtres)
  offset: number;      // offset courant (0-based)
  limit: number;       // éléments par page
  itemLabel?: { singular: string; plural: string };
}
```

La prop `shown` est supprimée — elle était redondante et source de confusion.

**Calculs :**
```typescript
const currentPage = Math.floor(offset / limit) + 1;   // 1-based
const totalPages = Math.ceil(total / limit);           // min 1
const hasPrev = offset > 0;
const hasNext = offset + limit < total;
```

**Layout mobile-first (360px) :**

```
┌────────────────────────────────────────┐
│  [<] Précédent   Page 2 / 5   Suivant [>]  │
│         45 relevés au total            │
└────────────────────────────────────────┘
```

Structure HTML :
```
<div class="mt-4 flex flex-col gap-2">
  <!-- Indicateur total -->
  <p class="text-xs text-center text-muted-foreground">
    {total} {totalLabel} au total
  </p>

  <!-- Contrôles de navigation -->
  <div class="flex items-center justify-between gap-2">
    <!-- Bouton Précédent -->
    <button disabled={!hasPrev} onClick={gotoPrev}
            class="h-10 px-4 rounded-md border ... flex items-center gap-1.5">
      <ChevronLeft class="h-4 w-4" />
      Précédent
    </button>

    <!-- Indicateur de page -->
    <span class="text-sm font-medium text-foreground whitespace-nowrap">
      Page {currentPage} / {totalPages}
    </span>

    <!-- Bouton Suivant -->
    <button disabled={!hasNext} onClick={gotoNext}
            class="h-10 px-4 rounded-md border ... flex items-center gap-1.5">
      Suivant
      <ChevronRight class="h-4 w-4" />
    </button>
  </div>
</div>
```

Les deux boutons utilisent `useRouter().push` + `useTransition` (pattern existant) pour naviguer en mettant à jour uniquement le paramètre `offset` dans l'URL.

**Cas bord :**
- `total === 0` : le composant ne rend rien (la liste affiche déjà un `EmptyState`).
- `totalPages === 1` : le composant rend uniquement le compteur total, sans les boutons.
- `isPending` : les boutons montrent un état de chargement (opacity-60 sur le wrapper).

**Modification de `releves-global-list.tsx` :**

Le calcul actuel `shown={offset + releves.length}` est supprimé. Le composant reçoit simplement :
```tsx
<PaginationFooter
  total={total}
  offset={offset}
  limit={limit}
/>
```

**Rétrocompatibilité :**

Le paramètre URL `offset` reste identique. Les URLs existantes avec un `offset` continuent de fonctionner — elles affichent la page correspondante. La suppression du paramètre `offset` (reset) se produit toujours lors d'un changement de filtre.

---

## Résumé des fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/lib/releve-search-params.ts` | Ajouter `produitId` dans `ReleveSearchParams`, `ParsedReleveFilters`, `ALL_FILTER_PARAMS`, `countActiveFilters` |
| `src/types/` (ReleveFilters) | Ajouter `produitId?: string` dans l'interface `ReleveFilters` |
| `src/lib/queries/releves.ts` | Ajouter filtre `where.consommations.some` sur `produitId` |
| `src/app/api/releves/route.ts` | Lire et passer `produitId` depuis les searchParams |
| `src/app/api/produits/aliment-releve/route.ts` | Nouveau endpoint (liste produits ALIMENT utilisés dans des relevés) |
| `src/components/ui/sheet.tsx` | Ajouter prop `hideCloseButton?: boolean` |
| `src/components/releves/releves-filter-sheet.tsx` | Remplacer typeAliment/comportementAlim par sélecteur produit ; ajouter `SheetClose` dans le header ; supprimer `pt-[env(safe-area-inset-top)]` du header div |
| `src/components/releves/releves-filter-bar.tsx` | Passer `hideCloseButton` au `SheetContent` ; synchroniser `produitId` |
| `src/components/releves/pagination-footer.tsx` | Refondre complètement (Page X/Y + Précédent/Suivant) |
| `src/components/releves/releves-global-list.tsx` | Corriger l'appel `PaginationFooter` (supprimer `shown`) |

## Fichier à créer

| Fichier | Contenu |
|---------|---------|
| `src/app/api/produits/aliment-releve/route.ts` | GET — retourne produits ALIMENT avec au moins 1 ReleveConsommation dans le site |

---

## Contraintes et règles

- R2 : Utiliser `CategorieProduit.ALIMENT` (enum importé), jamais la string `"ALIMENT"` en dur.
- R5 : `SheetClose asChild` sur le bouton X dans le header du filter sheet.
- R8 : Le nouveau endpoint `/api/produits/aliment-releve` filtre toujours par `siteId` (auth.activeSiteId).
- Mobile first : les boutons Précédent/Suivant ont `min-h-[44px]` pour respecter les cibles tactiles.
- Server Components : `pagination-footer.tsx` reste `"use client"` (utilise `useRouter`, `useSearchParams`, `useTransition`).

---

## Ordre d'implémentation suggéré pour @developer

1. `releve-search-params.ts` — ajouter `produitId` (pas de dépendances).
2. `src/types/` — ajouter `produitId` dans `ReleveFilters`.
3. `queries/releves.ts` — ajouter le filtre `consommations.some`.
4. `api/releves/route.ts` — lire `produitId`.
5. `api/produits/aliment-releve/route.ts` — nouveau endpoint.
6. `sheet.tsx` — ajouter `hideCloseButton`.
7. `releves-filter-sheet.tsx` — remplacer UI aliment + corriger header close.
8. `releves-filter-bar.tsx` — passer `hideCloseButton` + sync `produitId`.
9. `pagination-footer.tsx` — refondre.
10. `releves-global-list.tsx` — corriger l'appel.
