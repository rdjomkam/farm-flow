# Pré-analyse ADR-038 — Amélioration unifiée des relevés
**Date :** 2026-04-06
**ADR analysé :** ADR-038 (Pagination vagues, Filtres spécifiques, Safe areas, PaginationFooter)

---

## Statut : GO AVEC RÉSERVES

---

## Résumé

L'ADR-038 consolide quatre chantiers sur des fichiers bien identifiés. Tous les prérequis
structurels sont présents (enums, interfaces de base, composants existants). Cinq points
nécessitent une attention particulière avant ou pendant l'implémentation, notamment le
fait que plusieurs appelants de `getVagueById()` accèdent à `vague.releves` — ils
**casseront** dès que le `include` releves sera retiré. L'ordre d'implémentation de l'ADR
doit être respecté strictement.

---

## Vérifications effectuées

### Schema / Enums : OK

Tous les enums requis par l'ADR sont présents et exportés.

| Enum | Fichier | Export index.ts |
|------|---------|-----------------|
| `CauseMortalite` | `src/types/models.ts` ligne 171 | Oui |
| `TypeAliment` | `src/types/models.ts` ligne 164 | Oui |
| `ComportementAlimentaire` | `src/types/models.ts` ligne 2022 | Oui |
| `MethodeComptage` | `src/types/models.ts` ligne 182 | Oui |
| `TypeReleve` | `src/types/models.ts` | Oui |

L'enum `RENOUVELLEMENT` est présent dans `TypeReleve` (vérifié via `releves-global-list.tsx`
ligne 24 et `releves-filter-sheet.tsx` ligne 33). Le type `ReleveFilters` dans
`src/types/api.ts` lignes 416-431 ne contient que les 7 champs de base — extension
requise par l'ADR étape 1.

---

### Partie A — Analyse des appelants de `getVagueById()` : RÉSERVE CRITIQUE

`getVagueById()` actuelle (lignes 34-55 de `src/lib/queries/vagues.ts`) inclut `releves`
avec relations complètes. L'ADR propose de retirer cet `include`. Il y a **8 appelants
identifiés** — certains utilisent `vague.releves`, d'autres non.

**Appelants qui accèdent à `vague.releves` — CASSERONT après la modification :**

| Fichier | Ligne | Usage de `vague.releves` |
|---------|-------|--------------------------|
| `src/components/pages/vague-detail-page.tsx` | 99, 100 | `computeVivantsByBac(vague.bacs, vague.releves, ...)` et `.filter(r => r.typeReleve === ...)` |
| `src/components/pages/vague-releves-page.tsx` | 53, 68 | `vague.releves.length` (titre) et `releves={vague.releves}` |
| `src/app/api/export/vague/[id]/route.ts` | 56 | `vague.releves.map(r => ...)` |

**Appelants qui n'accèdent qu'à `vague.bacs` / `vague.statut` — non affectés :**

| Fichier | Usage |
|---------|-------|
| `src/app/vagues/[id]/calibrage/nouveau/page.tsx` | `vague.bacs`, `vague.statut` uniquement |
| `src/app/vagues/[id]/calibrages/page.tsx` | `vague.bacs` uniquement |
| `src/app/api/vagues/[id]/route.ts` | méta-données uniquement |

**Point d'attention critique :** La route d'export `/api/export/vague/[id]/route.ts` ligne 56
utilise `vague.releves.map(...)` pour construire les relevés du rapport PDF. Cette route
n'est PAS listée dans le tableau "Impact sur les fichiers" de l'ADR-038. Elle doit être
migrée vers une query directe `prisma.releve.findMany()` ou `getReleves()` avec `vagueId`
filtré, sous peine de régression silencieuse sur l'export PDF.

**`VagueWithBacs` absent de `src/types/models.ts`** : L'ADR référence
`VagueWithPaginatedReleves` avec `vague: VagueWithBacs` comme type de base. Mais
`VagueWithBacs` n'existe pas actuellement dans `src/types/models.ts` — seule
`VagueWithRelations` (qui inclut `releves: Releve[]`) existe (ligne 498-501). Il faudra
créer `VagueWithBacs` (ou utiliser `Vague & { bacs: Bac[] }`) avant d'écrire
`VagueWithPaginatedReleves`.

---

### Partie A — `VagueRelevesPage` actuelle : INCOMPATIBLE avec la cible

La page actuelle (`src/components/pages/vague-releves-page.tsx`) :
- Utilise `RelevesList` (le composant vague-context, pas `RelevesGlobalList`)
- N'accepte pas `searchParams` (ne lit pas `offset` depuis l'URL)
- Passe `vague.releves as unknown as Releve[]` directement

L'ADR demande de la réécrire pour utiliser `getVagueByIdWithReleves()` + `RelevesGlobalList`
+ `PaginationFooter`. C'est une réécriture complète, pas un patch. Le point de route
`src/app/(farm)/vagues/[id]/releves/page.tsx` est un simple re-export (ligne 1 : `export { default } from "@/components/pages/vague-releves-page"`), donc il faudra ajouter la
signature `searchParams` dans le page wrapper ou dans le page component.

**Note :** Les pages App Router Next.js 14+ reçoivent `searchParams` uniquement dans les
Page components (pas dans les composants importés). La route wrapper devra être modifiée
pour recevoir et passer `searchParams`.

---

### Partie B — Extension des filtres : OK, insertion point clair

`src/lib/releve-search-params.ts` (80 lignes) est petit et bien structuré. Les interfaces
`ReleveSearchParams` (ligne 10) et `ParsedReleveFilters` (ligne 21) sont des cibles
d'extension directes. `countActiveFilters()` (ligne 58) et `parseReleveSearchParams()`
(ligne 33) sont prêts à accueillir les nouveaux champs.

`src/lib/queries/releves.ts` — le where builder dans `getReleves()` est aux lignes 24-45.
La structure est un `Record<string, unknown>` simple — extension par ajout de blocs
conditionnels. Aucune restructuration requise.

`src/app/api/releves/route.ts` — extraction des params GET aux lignes 37-61. Extension
par ajout de blocs `searchParams.get("...")` après la ligne 61.

`updateMultipleParams()` dans `releves-filter-bar.tsx` ligne 109-123 hard-code la liste
des 6 paramètres à effacer (`["vagueId", "bacId", "typeReleve", "dateFrom", "dateTo", "modifie"]`).
Ce tableau doit être remplacé par `ALL_FILTER_PARAMS` (à créer dans `releve-search-params.ts`
per l'ADR étape B-D2) pour éviter que les nouveaux filtres spécifiques ne soient oubliés
lors d'un reset.

---

### Partie C — Safe Areas : OK, structure claire

`src/components/ui/sheet.tsx` (lignes 41-43) : `SheetContent` par défaut inclut déjà
`pt-[env(safe-area-inset-top)]`. La classe `!inset-y-0 !left-auto !right-0` dans
`releves-filter-bar.tsx` ligne 209 override ce padding. Le fix C (padding dans le contenu,
pas dans `SheetContent`) est la bonne approche — cela n'impacte pas la sidebar.

`src/app/globals.css` lignes 5-8 : les variables `--sat`, `--sar`, `--sab`, `--sal`
sont déjà définies. L'utilisation de `env(safe-area-inset-bottom)` directement dans les
classes Tailwind (via `pb-[max(0.75rem,env(safe-area-inset-bottom))]`) fonctionnera sans
configuration supplémentaire.

`src/components/releves/releves-filter-sheet.tsx` (ligne 107) : le contenu actuel est
un simple `<div className="flex flex-col gap-4 p-4">` sans structure header/corps/footer.
La restructuration en flex-col h-full avec sections sticky est une refonte du layout
interne — les états locaux existants sont conservés.

---

### Partie D — PaginationFooter : OK, migration propre

`src/components/releves/load-more-button.tsx` (46 lignes) : fichier simple, interface
`{ offset: number; total: number }`. Deux différences avec le `PaginationFooter` de l'ADR :

1. `LoadMoreButton` calcule `shown = offset + limit` en interne — le `PaginationFooter`
   reçoit `shown` en prop (plus flexible, nécessite que l'appelant calcule).
2. `LoadMoreButton` hard-code le chemin `/releves?...` dans le `router.push` (ligne 29).
   `PaginationFooter` utilise `?${params.toString()}` (relatif) — plus adaptable à la
   page vagues.

`src/components/releves/releves-global-list.tsx` ligne 150-153 : le `<LoadMoreButton>`
est entouré d'un `{total > offset + limit && (...)}` guard. Lors de la migration vers
`PaginationFooter`, ce guard devient inutile car `PaginationFooter` gère lui-même l'état
"tout chargé" (pas de bouton si `isComplete`). La suppression du guard est nécessaire pour
que la barre de progression s'affiche même quand tout est chargé.

---

### API ↔ Queries : OK

`getReleves()` dans `src/lib/queries/releves.ts` accepte déjà `ReleveFilters` et une
pagination optionnelle. L'extension du where builder suivra le pattern existant sans
risque de régression sur les filtres actuels (ajouts conditionnels uniquement).

---

### Navigation ↔ Permissions : OK

Aucune nouvelle route ni permission n'est introduite par cet ADR. Les pages existantes
`/releves` et `/vagues/[id]/releves` conservent leurs permissions
(`Permission.RELEVES_VOIR`, `Permission.VAGUES_VOIR`).

---

### Build et Tests : NON EXÉCUTÉS

Le build et les tests n'ont pas été exécutés dans cette pré-analyse (lecture seule).
Ils doivent être exécutés par l'implémenteur après chaque étape (R9).

---

## Incohérences trouvées

### INC-1 — `VagueWithBacs` absent de `src/types/models.ts`

L'ADR référence ce type comme base de `VagueWithPaginatedReleves` mais il n'existe pas.
Seule `VagueWithRelations` (avec `releves: Releve[]`) existe. Il faut créer :

```typescript
// src/types/models.ts — à ajouter avant VagueWithRelations
export interface VagueWithBacs extends Vague {
  bacs: Bac[];
}
```

Et l'exporter depuis `src/types/index.ts`.

### INC-2 — Route export PDF utilise `vague.releves` mais n'est pas dans le scope ADR

`src/app/api/export/vague/[id]/route.ts` ligne 56 utilise `vague.releves` directement.
Le tableau "Impact sur les fichiers" de l'ADR-038 marque ce fichier comme INCHANGÉ
(ligne "Surfaces exclues de la pagination"). Mais si `getVagueById()` est modifié pour
ne plus inclure les relevés, cette route cassera silencieusement (TypeScript ne verra
pas l'erreur car le type de retour de `getVagueById()` change).

Suggestion de fix : dans `src/app/api/export/vague/[id]/route.ts`, remplacer l'accès
à `vague.releves` par un `prisma.releve.findMany({ where: { vagueId: id, siteId } })`
séparé ou appeler `getReleves(siteId, { vagueId: id })`.

### INC-3 — `VagueRelevesPage` ne reçoit pas `searchParams`

La page actuelle n'a pas de signature `searchParams`. La route wrapper
`src/app/(farm)/vagues/[id]/releves/page.tsx` est un simple re-export. Pour passer
`searchParams` à la page, le wrapper doit être modifié pour accepter `searchParams` et
les passer au composant, ou `VagueRelevesPage` doit être transformée en une vraie Page
component (pas un composant importé).

### INC-4 — `updateMultipleParams()` hard-code la liste des params

`src/components/releves/releves-filter-bar.tsx` ligne 112-114 hard-code la liste des
6 paramètres à effacer. Les nouveaux paramètres spécifiques (poidsMoyenMin, causeMortalite,
etc.) ne seront pas effacés lors d'un changement de type ou d'un reset partiel tant que
ce tableau n'est pas remplacé par `ALL_FILTER_PARAMS`.

---

## Risques identifiés

### RISQUE-1 — Régression TypeScript silencieuse sur la route export PDF

**Impact :** L'export PDF vague casse en production après que `getVagueById()` ne retourne
plus de relevés. TypeScript peut ne pas détecter l'erreur si le type de retour de la
fonction est inféré (non annoté explicitement comme `VagueWithBacs | null`).

**Mitigation :** Annoter explicitement le type de retour de la nouvelle `getVagueById()`
comme `Promise<VagueWithBacs | null>`. Cela fera apparaître l'erreur TypeScript dans la
route export. Migrer la route export en même temps que l'étape 2 (queries).

### RISQUE-2 — Casse des tests existants qui mockent `getVagueById`

5 fichiers de test mockent `getVagueById` :
- `src/__tests__/api/vagues-distribution.test.ts`
- `src/__tests__/api/auth-protection.test.ts`
- `src/__tests__/api/export.test.ts`
- `src/__tests__/api/vagues.test.ts`

Ces mocks retournent probablement des objets avec `releves: []`. Après la modification,
les tests qui passaient `releves` dans le mock continueront de fonctionner (champ ignoré),
mais les tests qui testent des comportements dépendant de `vague.releves` dans les
composants cassent. En particulier `export.test.ts` ligne 68 est à haut risque.

**Mitigation :** Mettre à jour les mocks et les tests dans l'étape 9 (Tests).

### RISQUE-3 — `renouvellement` dans les filtres spécifiques

L'ADR ajoute `pourcentageMin`/`pourcentageMax` pour `RENOUVELLEMENT`. Le champ Prisma
s'appelle `pourcentageRenouvellement`. Le where builder devra utiliser
`where.pourcentageRenouvellement = { gte: ..., lte: ... }` (pas `pourcentage`).
Vérifier la cohérence des noms de params URL vs champs Prisma lors de l'implémentation.

### RISQUE-4 — `searchParams` dans `VagueRelevesPage` avec App Router

La page `src/app/(farm)/vagues/[id]/releves/page.tsx` est un re-export d'un composant
de `src/components/pages/`. En App Router, `searchParams` est passé uniquement aux
composants qui sont des Page files (dans `app/`). Le refactoring devra soit :
- Réécrire le wrapper pour accepter et passer `searchParams`
- Ou déplacer la logique directement dans le wrapper

---

## Prérequis manquants

1. `VagueWithBacs` doit être créé dans `src/types/models.ts` et exporté depuis
   `src/types/index.ts` avant d'écrire `VagueWithPaginatedReleves`.

2. La route export PDF `src/app/api/export/vague/[id]/route.ts` doit être mise à jour
   en même temps que la modification de `getVagueById()` (étape 2 de l'ADR) pour éviter
   une régression silencieuse.

3. Le wrapper `src/app/(farm)/vagues/[id]/releves/page.tsx` doit accepter `searchParams`
   (actuellement simple re-export sans props).

---

## Recommandation

**GO — avec les réserves suivantes à traiter dans l'ordre d'implémentation :**

1. Lors de l'étape 1 (types) : créer `VagueWithBacs` avant `VagueWithPaginatedReleves`.

2. Lors de l'étape 2 (queries) : annoter le type de retour de la nouvelle `getVagueById()`
   explicitement en `Promise<VagueWithBacs | null>` et migrer simultanément la route
   `src/app/api/export/vague/[id]/route.ts`.

3. Lors de l'étape 5 (pages) : modifier le wrapper
   `src/app/(farm)/vagues/[id]/releves/page.tsx` pour accepter et transmettre
   `searchParams`.

4. Lors de l'étape 8 (filtres) : remplacer le tableau hard-codé dans
   `updateMultipleParams()` par la constante `ALL_FILTER_PARAMS`.

5. Les tests existants mockant `getVagueById` doivent être mis à jour lors de l'étape 9.

L'ordre d'implémentation de l'ADR (étapes 1 à 9) est bien conçu — le respecter
strictement minimise les risques de régression intermédiaire.
