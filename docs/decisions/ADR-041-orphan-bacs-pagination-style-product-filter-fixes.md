# ADR-041 — Orphan Bacs in Filter / Pagination White Background / Product Filter Count

**Date :** 2026-04-06
**Statut :** ACCEPTE
**Auteur :** @architect

---

## Contexte

Trois anomalies distinctes ont été signalées dans la page `/releves`.
Cette ADR documente les causes racines et les corrections exactes à apporter.

---

## Issue 1 — Bacs orphelins absents du sélecteur après calibration

### Symptôme

Quand un bac est retiré d'une vague (calibration → `vagueId = null` sur `Bac`), il disparaît du
sélecteur de bac dans la barre de filtre et dans le filter sheet.
L'utilisateur ne peut plus filtrer par ce bac même si des relevés historiques y sont attachés.

### Cause racine

`GET /api/bacs?vagueId=XXX` exécute :

```ts
prisma.bac.findMany({ where: { siteId, vagueId } })
```

Cette requête ne retourne que les bacs **actuellement assignés** à la vague (`Bac.vagueId = XXX`).
Après calibration, le bac orphelin a `vagueId = null` et n'est donc plus retourné.

Pourtant, le modèle `Releve` a ses propres colonnes `bacId` et `vagueId` — indépendantes de
`Bac.vagueId`. Un relevé conserve sa relation avec le bac et la vague même si le bac a été
détaché ultérieurement.

### Décision

**Ne pas modifier l'endpoint existant `GET /api/bacs?vagueId=XXX`** — il sert à d'autres usages
(affichage de la liste des bacs actifs d'une vague).

**Créer un nouvel endpoint dédié :**

```
GET /api/bacs/by-vague-releves?vagueId=XXX
```

Cet endpoint retourne tous les bacs distincts qui ont **au moins un relevé** pour la vague
demandée, en joignant via la table `Releve` :

```ts
// src/lib/queries/bacs.ts — nouvelle fonction
export async function getBacsAvecRelevesPourVague(
  siteId: string,
  vagueId: string
): Promise<{ id: string; nom: string }[]> {
  // Récupérer les bacId distincts depuis Releve pour cette vague + site
  const rows = await prisma.releve.findMany({
    where: { vagueId, siteId },
    select: { bacId: true },
    distinct: ["bacId"],
  });
  const bacIds = rows.map((r) => r.bacId);
  if (bacIds.length === 0) return [];

  return prisma.bac.findMany({
    where: { id: { in: bacIds }, siteId },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });
}
```

**Nouveau fichier route :**
`src/app/api/bacs/by-vague-releves/route.ts`

```ts
// GET /api/bacs/by-vague-releves?vagueId=XXX
// Auth : Permission.BACS_GERER (même que l'endpoint parent)
// Retourne : { data: { id: string; nom: string }[] }
```

**Modification des composants filtre :**

- `src/components/releves/releves-filter-sheet.tsx` — dans le `useEffect` qui charge les bacs,
  remplacer `/api/bacs?vagueId=${localVagueId}` par `/api/bacs/by-vague-releves?vagueId=${localVagueId}`

- `src/components/releves/releves-filter-bar.tsx` — même remplacement dans le `useEffect` desktop.

### Avantages de cette approche

- L'endpoint existant reste inchangé — aucune régression.
- La sémantique est explicite : "bacs qui ont des relevés pour cette vague" vs "bacs assignés à cette vague".
- La requête est légère : `DISTINCT` sur `bacId` dans `Releve`, puis `IN` sur `Bac`.
- Conforme à R8 : le filtre `siteId` est appliqué sur les deux tables.

### Contrat API

```
GET /api/bacs/by-vague-releves?vagueId={vagueId}

200 OK
{
  "data": [
    { "id": "clxxx", "nom": "Bac 1" },
    { "id": "clyyy", "nom": "Bac 3" }   // bac orphelin mais avec relevés
  ]
}

400 Bad Request  — vagueId manquant
401 Unauthorized
403 Forbidden
```

---

## Issue 2 — Fond blanc sur les boutons de pagination

### Symptôme

Les boutons "Précédent" et "Suivant" dans `PaginationFooter` ont un fond blanc visible qui
tranche visuellement avec l'arrière-plan de la page.

### Cause racine

Les deux boutons utilisent la classe `bg-background` :

```tsx
// src/components/releves/pagination-footer.tsx — ligne 75 et 99
className="
  min-h-[44px] px-4 rounded-md border border-border bg-background
  ...
"
```

`bg-background` mappe sur la variable CSS `--background` qui vaut blanc en thème clair.
Quand le fond de page n'est pas blanc (couleur de surface différente, fond grisé), les boutons
ressortent comme des îlots blancs.

### Décision

Remplacer `bg-background` par `bg-transparent` sur les deux boutons. L'état hover
(`hover:bg-accent`) continue de fonctionner correctement car `bg-accent` reste appliqué au hover.
La bordure (`border-border`) assure que les boutons restent visuellement délimités.

```tsx
// Avant
className="min-h-[44px] px-4 rounded-md border border-border bg-background ..."

// Après
className="min-h-[44px] px-4 rounded-md border border-border bg-transparent ..."
```

Ce changement s'applique aux **deux boutons** (Précédent et Suivant) dans
`src/components/releves/pagination-footer.tsx`.

---

## Issue 3 — Le filtre produit alimentaire ne met pas à jour le compteur et ne se sauvegarde pas

### Symptôme

1. Sélectionner un produit dans la section ALIMENTATION du filter sheet.
2. Le badge de compteur de filtres actifs n'augmente pas.
3. Cliquer "Appliquer" — le produit sélectionné n'est pas pris en compte.

### Cause racine : trois problèmes indépendants

#### 3a. `produitId` absent du `current` passé à `RelevesFilterSheet`

Dans `src/components/releves/releves-filter-bar.tsx`, le `current` prop construit pour
`RelevesFilterSheet` n'inclut **pas** `produitId` ni les autres filtres spécifiques :

```tsx
// releves-filter-bar.tsx — lignes 210-217
<RelevesFilterSheet
  current={{
    vagueId: localVagueId || undefined,
    bacId: localBacId || undefined,
    typeReleve: localType || undefined,
    dateFrom: localDateFrom || undefined,
    dateTo: localDateTo || undefined,
    modifie: localModifie ? "true" : undefined,
    // produitId absent ! Et tous les autres filtres spécifiques aussi
  }}
  ...
/>
```

Conséquence : quand le sheet s'ouvre après qu'un filtre produit est déjà actif (URL),
`localProduitId` dans le sheet est initialisé à `ALL_VALUE` au lieu de la vraie valeur.
Au `handleApply`, le produit n'est jamais inclus dans `base`.

**Correction :** passer tous les filtres URL courants dans `current`, en lisant directement
depuis `searchParams` :

```tsx
current={{
  vagueId: localVagueId || undefined,
  bacId: localBacId || undefined,
  typeReleve: localType || undefined,
  dateFrom: localDateFrom || undefined,
  dateTo: localDateTo || undefined,
  modifie: localModifie ? "true" : undefined,
  // Filtres spécifiques lus depuis searchParams
  produitId: searchParams.get("produitId") ?? undefined,
  frequenceAlimentMin: searchParams.get("frequenceAlimentMin") ?? undefined,
  frequenceAlimentMax: searchParams.get("frequenceAlimentMax") ?? undefined,
  poidsMoyenMin: searchParams.get("poidsMoyenMin") ?? undefined,
  poidsMoyenMax: searchParams.get("poidsMoyenMax") ?? undefined,
  tailleMoyenneMin: searchParams.get("tailleMoyenneMin") ?? undefined,
  tailleMoyenneMax: searchParams.get("tailleMoyenneMax") ?? undefined,
  causeMortalite: searchParams.get("causeMortalite") ?? undefined,
  nombreMortsMin: searchParams.get("nombreMortsMin") ?? undefined,
  nombreMortsMax: searchParams.get("nombreMortsMax") ?? undefined,
  temperatureMin: searchParams.get("temperatureMin") ?? undefined,
  temperatureMax: searchParams.get("temperatureMax") ?? undefined,
  phMin: searchParams.get("phMin") ?? undefined,
  phMax: searchParams.get("phMax") ?? undefined,
  methodeComptage: searchParams.get("methodeComptage") ?? undefined,
  descriptionSearch: searchParams.get("descriptionSearch") ?? undefined,
  pourcentageMin: searchParams.get("pourcentageMin") ?? undefined,
  pourcentageMax: searchParams.get("pourcentageMax") ?? undefined,
}}
```

#### 3b. `countActiveFilters` non appelé avec les filtres spécifiques dans `releves-filter-bar.tsx`

Le `activeCount` calculé dans `ReleveFilterBar` (lignes 177-184) n'inclut pas `produitId` ni
aucun filtre spécifique :

```ts
// Avant — releves-filter-bar.tsx lignes 177-184
const activeCount = countActiveFilters({
  vagueId: localVagueId || undefined,
  bacId: localBacId || undefined,
  typeReleve: localType || undefined,
  dateFrom: localDateFrom || undefined,
  dateTo: localDateTo || undefined,
  modifie: localModifie ? "true" : undefined,
  // Aucun filtre spécifique ici — produitId manquant !
});
```

`countActiveFilters` dans `releve-search-params.ts` **inclut bien `produitId`** (ligne 269),
mais il ne le reçoit jamais car le composant ne le lui passe pas.

**Correction :** inclure tous les filtres spécifiques depuis `searchParams` dans l'appel :

```ts
const activeCount = countActiveFilters({
  vagueId: localVagueId || undefined,
  bacId: localBacId || undefined,
  typeReleve: localType || undefined,
  dateFrom: localDateFrom || undefined,
  dateTo: localDateTo || undefined,
  modifie: localModifie ? "true" : undefined,
  produitId: searchParams.get("produitId") ?? undefined,
  frequenceAlimentMin: searchParams.get("frequenceAlimentMin") ?? undefined,
  frequenceAlimentMax: searchParams.get("frequenceAlimentMax") ?? undefined,
  poidsMoyenMin: searchParams.get("poidsMoyenMin") ?? undefined,
  poidsMoyenMax: searchParams.get("poidsMoyenMax") ?? undefined,
  tailleMoyenneMin: searchParams.get("tailleMoyenneMin") ?? undefined,
  tailleMoyenneMax: searchParams.get("tailleMoyenneMax") ?? undefined,
  causeMortalite: searchParams.get("causeMortalite") ?? undefined,
  nombreMortsMin: searchParams.get("nombreMortsMin") ?? undefined,
  nombreMortsMax: searchParams.get("nombreMortsMax") ?? undefined,
  temperatureMin: searchParams.get("temperatureMin") ?? undefined,
  temperatureMax: searchParams.get("temperatureMax") ?? undefined,
  phMin: searchParams.get("phMin") ?? undefined,
  phMax: searchParams.get("phMax") ?? undefined,
  methodeComptage: searchParams.get("methodeComptage") ?? undefined,
  descriptionSearch: searchParams.get("descriptionSearch") ?? undefined,
  pourcentageMin: searchParams.get("pourcentageMin") ?? undefined,
  pourcentageMax: searchParams.get("pourcentageMax") ?? undefined,
});
```

#### 3c. `handleApply` dans le filter sheet conditionne `produitId` au type sélectionné (comportement correct)

La logique de `handleApply` dans `releves-filter-sheet.tsx` est correcte :
`produitId` n'est ajouté à `base` que si `localType === TypeReleve.ALIMENTATION`.
Ce comportement doit être conservé — si l'utilisateur sélectionne un produit mais change ensuite
le type, le produit ne doit pas être appliqué.

**Pas de modification nécessaire dans `handleApply`.**

Le problème était uniquement que `localProduitId` était toujours `ALL_VALUE` à l'ouverture du
sheet (point 3a), ce qui empêchait le filtre d'être inclus même quand il était valide.

### Résumé des fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/app/api/bacs/by-vague-releves/route.ts` | Créer — nouvel endpoint |
| `src/lib/queries/bacs.ts` | Ajouter `getBacsAvecRelevesPourVague()` |
| `src/components/releves/releves-filter-sheet.tsx` | Changer URL fetch bacs vers `/api/bacs/by-vague-releves` |
| `src/components/releves/releves-filter-bar.tsx` | (1) Changer URL fetch bacs, (2) ajouter filtres spécifiques dans `current` prop, (3) ajouter filtres spécifiques dans `countActiveFilters` |
| `src/components/releves/pagination-footer.tsx` | Remplacer `bg-background` par `bg-transparent` sur les deux boutons |

---

## Alternatives rejetées

### Issue 1 — Modifier l'endpoint existant avec un param `includeOrphans=true`
Rejeté : ajoute de la complexité à un endpoint déjà utilisé dans d'autres contextes.
Un endpoint dédié a une sémantique claire et peut évoluer indépendamment.

### Issue 2 — Supprimer la bordure au lieu du fond
Rejeté : les boutons perdent leur délimitation visuelle, ce qui nuit à l'accessibilité
(WCAG 1.4.11 — Non-text Contrast).

### Issue 3 — Stocker les filtres spécifiques dans des états locaux dans `ReleveFilterBar`
Rejeté : cela duplique l'état déjà disponible dans `searchParams`. Lire depuis `searchParams`
est la source de vérité unique et évite la désynchronisation.

---

## Impact

- Aucune migration de base de données nécessaire.
- Aucune modification du schéma Prisma.
- Aucune régression attendue sur les fonctionnalités existantes.
- `countActiveFilters` dans `releve-search-params.ts` est déjà correct — aucune modification.
