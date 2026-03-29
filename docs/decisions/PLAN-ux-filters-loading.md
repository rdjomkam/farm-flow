# PLAN — UX Filters & Loading Fixes (P1–P7)

**Date :** 2026-03-29
**Auteur :** @architect
**Scope :** 7 problèmes UX identifiés par audit — filtres, états de chargement, navigation

---

## 1. Contexte et analyse des causes racines

### Architecture du chargement (état actuel)

Il existe un seul contexte partagé `GlobalLoadingContext` avec un compteur de requêtes actives. Ce contexte est consommé par deux composants simultanément :

- `GlobalLoadingBar` — barre fine en haut de page (non-intrusive, correcte pour navigation)
- `LoadingOverlay` — overlay plein écran bloquant (z-[9999], correct pour mutations critiques)

Le problème : **`NavigationLoader`** (utilisé dans les fichiers `loading.tsx`) appelle `increment()` sur ce même contexte unique, ce qui déclenche les **deux** composants à la fois. Toute navigation de page affiche donc un overlay plein écran bloquant, ce qui est un comportement bien trop agressif.

### Cascade des problèmes

```
NavigationLoader.increment()
  → GlobalLoadingContext.isLoading = true
    → GlobalLoadingBar affiche (OK)
    → LoadingOverlay affiche (MAUVAIS — bloque la UI pendant la navigation)
```

### Résumé des causes racines

| # | Problème | Cause racine |
|---|----------|-------------|
| P1 | BesoinsListClient — filtre par onglet incorrect | `filteredListes` est calculé une seule fois depuis `activeTab`, puis la même variable est passée à tous les `TabsContent` dans le `.map()` |
| P2 | FeedFilters — bloque l'UI | `router.push()` déclenche un re-render serveur entier ; pas de `loading.tsx` sur `(farm)/analytics/aliments` ; pas de feedback optimiste local |
| P3 | LoadingOverlay déclenché à chaque navigation | `NavigationLoader` partage le même contexte que `LoadingOverlay` |
| P4 | VaguesComparison — pas d'état de chargement | `handleComparer()` est `async` sans aucun state `isLoading` |
| P5 | Planning — vide hors plage préchargée | Les données sont chargées une fois côté serveur ; la navigation de mois ne refetch pas |
| P6 | Pas de recherche textuelle sur les listes | Enhancement manquant — hors scope bugfix |
| P7 | Dépenses — tab state stale après filtre | `<Tabs defaultValue>` est non-contrôlé ; le changement de `categorieFilter` ne reset pas l'onglet actif |

---

## 2. Ordre de priorité et dépendances

```
P3 (systémique) → débloquer avant P2 pour ne pas régresser
P2 (plainte utilisateur principale) → dépend de P3 pour ne pas aggraver
P1 (bug fonctionnel silencieux) → indépendant, peut être fait en parallèle
P4 (UX manquant) → indépendant
P7 (état stale) → indépendant
P5 (enhancement) → plus complexe, dépend de service client-side
P6 (feature future) → ne pas implémenter maintenant
```

**Ordre recommandé :** P3 → P1 → P7 → P4 → P2 → P5 → P6 (skip)

---

## 3. Fixes détaillés

---

### P3 — LoadingOverlay bloque toutes les navigations

**Fichiers à modifier :**
- `src/contexts/global-loading.context.tsx`
- `src/components/ui/loading-overlay.tsx`
- `src/components/ui/global-loading-bar.tsx`
- `src/components/ui/navigation-loader.tsx`

**Problème actuel :**

`NavigationLoader` est rendu par chaque `loading.tsx`. Il appelle `increment()` du contexte global. Ce même contexte alimente `LoadingOverlay` (overlay bloquant) ET `GlobalLoadingBar` (barre fine). Résultat : chaque transition de page affiche l'overlay plein écran.

Code actuel dans `src/components/ui/navigation-loader.tsx` :
```tsx
export function NavigationLoader() {
  const { increment, decrement } = useGlobalLoading();
  useEffect(() => {
    increment();
    return () => decrement();
  }, [increment, decrement]);
  return null;
}
```

Code actuel dans `src/components/ui/loading-overlay.tsx` :
```tsx
export function LoadingOverlay() {
  const { isLoading } = useGlobalLoading();
  if (!isLoading) return null;
  // ... overlay plein écran
}
```

**Fix — Approche : deux compteurs distincts dans le même contexte**

Ajouter un compteur `mutationCount` séparé du compteur `navigationCount` dans le contexte. `LoadingOverlay` ne réagit qu'aux mutations. `GlobalLoadingBar` réagit aux deux.

**`src/contexts/global-loading.context.tsx` — code de remplacement :**

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface GlobalLoadingContextValue {
  /** true dès qu'au moins une requête (navigation ou mutation) est en cours */
  isLoading: boolean;
  /** true uniquement quand une mutation bloquante est en cours */
  isMutating: boolean;
  /** Incrémente le compteur de requêtes actives (navigation) */
  increment: () => void;
  /** Décrémente le compteur de requêtes actives (navigation) */
  decrement: () => void;
  /** Incrémente le compteur de mutations bloquantes */
  incrementMutation: () => void;
  /** Décrémente le compteur de mutations bloquantes */
  decrementMutation: () => void;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function useGlobalLoading(): GlobalLoadingContextValue {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }
  return ctx;
}

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const countRef = useRef(0);
  const mutationCountRef = useRef(0);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hideMutationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const increment = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    countRef.current += 1;
    if (countRef.current === 1) setIsLoading(true);
  }, []);

  const decrement = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current === 0) {
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        setIsLoading(false);
      }, 300);
    }
  }, []);

  const incrementMutation = useCallback(() => {
    if (hideMutationTimerRef.current) {
      clearTimeout(hideMutationTimerRef.current);
      hideMutationTimerRef.current = null;
    }
    mutationCountRef.current += 1;
    if (mutationCountRef.current === 1) {
      setIsLoading(true);
      setIsMutating(true);
    }
  }, []);

  const decrementMutation = useCallback(() => {
    mutationCountRef.current = Math.max(0, mutationCountRef.current - 1);
    if (mutationCountRef.current === 0) {
      hideMutationTimerRef.current = setTimeout(() => {
        hideMutationTimerRef.current = null;
        setIsMutating(false);
        // isLoading suit le countRef normal
        if (countRef.current === 0) setIsLoading(false);
      }, 300);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (hideMutationTimerRef.current) clearTimeout(hideMutationTimerRef.current);
    };
  }, []);

  return (
    <GlobalLoadingContext
      value={{ isLoading, isMutating, increment, decrement, incrementMutation, decrementMutation }}
    >
      {children}
    </GlobalLoadingContext>
  );
}
```

**`src/components/ui/loading-overlay.tsx` — code de remplacement :**

```tsx
"use client";

import { useGlobalLoading } from "@/contexts/global-loading.context";
import { FishLoader } from "@/components/ui/fish-loader";

export function LoadingOverlay() {
  // Ne s'affiche QUE pour les mutations bloquantes, pas pour la navigation
  const { isMutating } = useGlobalLoading();

  if (!isMutating) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      aria-busy="true"
      aria-label="Chargement en cours"
    >
      <FishLoader size="lg" text="Chargement..." />
    </div>
  );
}
```

**`src/components/ui/navigation-loader.tsx` — code de remplacement :**

```tsx
"use client";

import { useEffect } from "react";
import { useGlobalLoading } from "@/contexts/global-loading.context";

// Utilisé dans les fichiers loading.tsx pour les transitions de page.
// Déclenche uniquement la barre fine (GlobalLoadingBar), PAS l'overlay bloquant.
export function NavigationLoader() {
  const { increment, decrement } = useGlobalLoading();
  useEffect(() => {
    increment();
    return () => decrement();
  }, [increment, decrement]);
  return null;
}
```

**Note :** Le code d'appel existant qui utilisait `increment`/`decrement` pour des mutations (si applicable dans `useApi` ou hooks similaires) doit migrer vers `incrementMutation`/`decrementMutation`. Vérifier `src/hooks/use-api.ts` ou équivalent.

---

### P1 — BesoinsListClient — filtre par onglet incorrect (bug silencieux)

**Fichier à modifier :**
- `src/components/besoins/besoins-list-client.tsx`

**Problème actuel :**

Lignes 120–126 calculent une seule variable `filteredListes` basée sur `activeTab` :

```tsx
const filteredListes = tabs
  .find((t) => t.value === activeTab)
  ?.statuts
  ? listesBesoins.filter((lb) =>
      tabs.find((t) => t.value === activeTab)!.statuts!.includes(lb.statut)
    )
  : listesBesoins;
```

Puis lignes 170–291, chaque `TabsContent` réutilise la même variable :

```tsx
{tabs.map((tab) => (
  <TabsContent key={tab.value} value={tab.value}>
    {filteredListes.length === 0 ? (   // <-- MÊME variable pour tous les onglets
      ...
    ) : (
      <div className="space-y-3">
        {filteredListes.map((lb) => (  // <-- MÊME variable pour tous les onglets
```

Radix Tabs masque visuellement le contenu des onglets inactifs, ce qui cache le bug. Mais si le rendu SSR ou un test accède au DOM complet, tous les onglets affichent la même liste filtrée selon l'onglet actif au moment du rendu.

**Fix — Pattern C2 : un seul `TabsContent` actif avec valeur dynamique**

Remplacer le `.map()` de `TabsContent` par un unique `TabsContent` dont `value` est lié à `activeTab`. Cela simplifie le code et corrige le bug structurellement.

```tsx
// SUPPRIMER la variable filteredListes calculée en dehors des tabs
// La déplacer à l'intérieur du rendu ou utiliser une fonction inline

return (
  <div className="p-4 pb-24 max-w-2xl mx-auto">
    {/* Header actions — inchangé */}
    ...

    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="w-full overflow-x-auto flex mb-4">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="flex-1 text-xs whitespace-nowrap"
          >
            {tab.label}
            {tab.statuts && (
              <span className="ml-1 text-xs opacity-70">
                (
                {listesBesoins.filter((lb) => tab.statuts!.includes(lb.statut)).length}
                )
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* UN SEUL TabsContent — valeur dynamique liée à activeTab */}
      <TabsContent value={activeTab}>
        {(() => {
          const activeTabDef = tabs.find((t) => t.value === activeTab);
          const currentList = activeTabDef?.statuts
            ? listesBesoins.filter((lb) => activeTabDef.statuts!.includes(lb.statut))
            : listesBesoins;

          return currentList.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                Aucune liste de besoins dans cet onglet
              </p>
              {canCreate && activeTab === "toutes" && (
                <Button asChild variant="primary" className="mt-4">
                  <Link href="/besoins/nouveau">
                    <Plus className="h-4 w-4 mr-1" />
                    Creer une liste
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {currentList.map((lb) => (
                // ... cards inchangées
              ))}
            </div>
          );
        })()}
      </TabsContent>
    </Tabs>
  </div>
);
```

---

### P7 — Dépenses — tab state stale après changement de filtre catégorie

**Fichier à modifier :**
- `src/components/depenses/depenses-list-client.tsx`

**Problème actuel :**

Ligne 177 : `<Tabs defaultValue="toutes">` est **non-contrôlé**. Quand `categorieFilter` change (Select ligne 100), les comptes dans les onglets se mettent à jour, mais l'onglet actif reste inchangé (ex : on est sur "Dues", on filtre par "Aliment", mais "Dues" reste actif même si le filtre vide cet onglet).

```tsx
// ACTUEL — non-contrôlé, onglet actif ne se resynchronise pas
<Tabs defaultValue="toutes">
```

**Fix — Passer en mode contrôlé et resetter à "toutes" sur changement de filtre :**

```tsx
// AJOUTER dans le composant, après la déclaration de categorieFilter :
const [activeTab, setActiveTab] = useState("toutes");

// MODIFIER le handler du Select pour resetter le tab :
function handleCategorieChange(value: string) {
  setCategorieFilter(value);
  setActiveTab("toutes"); // reset l'onglet actif
}

// MODIFIER le Select :
<Select
  value={categorieFilter}
  onValueChange={handleCategorieChange}  // <-- remplacer setCategorieFilter
>

// MODIFIER Tabs :
<Tabs value={activeTab} onValueChange={setActiveTab}>  // <-- controlled
```

Diff complet des lignes concernées :

Ligne 100 actuelle :
```tsx
const [categorieFilter, setCategorieFilter] = useState<string>("TOUTES");
```

Remplacer par :
```tsx
const [categorieFilter, setCategorieFilter] = useState<string>("TOUTES");
const [activeTab, setActiveTab] = useState("toutes");

function handleCategorieChange(value: string) {
  setCategorieFilter(value);
  setActiveTab("toutes");
}
```

Ligne 140–154 actuelle (le Select) :
```tsx
<Select
  value={categorieFilter}
  onValueChange={setCategorieFilter}
>
```

Remplacer par :
```tsx
<Select
  value={categorieFilter}
  onValueChange={handleCategorieChange}
>
```

Ligne 177 actuelle :
```tsx
<Tabs defaultValue="toutes">
```

Remplacer par :
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab}>
```

---

### P4 — VaguesComparison — pas d'état de chargement

**Fichier à modifier :**
- `src/components/analytics/vagues-comparison-client.tsx`

**Problème actuel :**

`handleComparer()` (ligne 428) est `async` et appelle `analyticsService.getVagues()` sans aucun indicateur visuel. L'utilisateur clique sur "Comparer" et rien ne se passe visuellement pendant le fetch.

```tsx
// ACTUEL — pas de loading state
async function handleComparer() {
  if (selectedIds.size < 2) return;
  const ids = Array.from(selectedIds);
  const res = await analyticsService.getVagues({ vagueIds: ids });
  if (res.ok && res.data) {
    setResult(res.data as unknown as ComparaisonVagues);
    setShowSelector(false);
  }
}
```

Et le bouton (ligne 528) :
```tsx
<Button
  onClick={handleComparer}
  disabled={!canCompare}
  className="w-full min-h-[48px]"
>
  {tVagues("comparison.compareButton")}
</Button>
```

**Fix — Ajouter `isComparing` state :**

```tsx
// AJOUTER après la déclaration de showSelector :
const [isComparing, setIsComparing] = useState(false);

// REMPLACER handleComparer :
async function handleComparer() {
  if (selectedIds.size < 2) return;
  setIsComparing(true);
  try {
    const ids = Array.from(selectedIds);
    const res = await analyticsService.getVagues({ vagueIds: ids });
    if (res.ok && res.data) {
      setResult(res.data as unknown as ComparaisonVagues);
      setShowSelector(false);
    }
  } finally {
    setIsComparing(false);
  }
}
```

Bouton avec feedback visuel :
```tsx
<Button
  onClick={handleComparer}
  disabled={!canCompare || isComparing}
  className="w-full min-h-[48px]"
>
  {isComparing ? (
    <span className="flex items-center gap-2">
      {/* Spinner simple — pas de dépendance supplémentaire */}
      <svg
        className="h-4 w-4 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {tVagues("comparison.comparing")}
    </span>
  ) : (
    tVagues("comparison.compareButton")
  )}
</Button>
```

Ajouter la clé de traduction manquante dans les fichiers i18n (fr/en) :
```json
"comparison": {
  "comparing": "Comparaison en cours..."
}
```

---

### P2 — Analytics aliments — filtre bloque l'UI (plainte principale)

**Fichiers à modifier :**
- `src/components/analytics/feed-filters.tsx`
- `src/app/(farm)/analytics/aliments/loading.tsx` — **à créer**
- `src/components/pages/analytics-aliments-page.tsx` — wrapping optionnel avec Suspense

**Problème actuel :**

1. `feed-filters.tsx` appelle `router.push()` immédiatement à chaque changement de Select
2. Cela déclenche une navigation serveur complète (re-fetch de `getComparaisonAliments`, etc.)
3. Il n'existe pas de `loading.tsx` dans `src/app/(farm)/analytics/aliments/` donc Next.js n'affiche aucun skeleton pendant le re-rendu
4. Le Select ne reflète pas le nouveau choix tant que le serveur n'a pas répondu (la valeur affichée revient à l'ancienne pendant le fetch)

**Fix en 3 étapes :**

**Étape 1 — Créer `src/app/(farm)/analytics/aliments/loading.tsx`**

```tsx
import { NavigationLoader } from "@/components/ui/navigation-loader";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <NavigationLoader />
      <Header title="Analytiques aliments" />
      <div className="flex flex-col gap-4 p-4">
        {/* Skeleton filtres */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        {/* Skeleton cards */}
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </>
  );
}
```

**Étape 2 — `feed-filters.tsx` : mise à jour locale optimiste + `useTransition`**

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition, useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhaseElevage, TailleGranule, FormeAliment } from "@/types";

// ... (garder les helpers de validation existants)

const ALL_VALUE = "__all__";

export function FeedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const tAnalytics = useTranslations("analytics");
  const tSettings = useTranslations("settings");

  // État LOCAL qui reflète immédiatement le choix de l'utilisateur
  // sans attendre le serveur.
  const [localPhase, setLocalPhase] = useState(searchParams.get("phase") ?? "");
  const [localTaille, setLocalTaille] = useState(searchParams.get("taille") ?? "");
  const [localForme, setLocalForme] = useState(searchParams.get("forme") ?? "");
  const [localSaison, setLocalSaison] = useState(searchParams.get("saison") ?? "");

  // Synchroniser l'état local quand les searchParams changent (ex : retour navigateur)
  useEffect(() => {
    setLocalPhase(searchParams.get("phase") ?? "");
    setLocalTaille(searchParams.get("taille") ?? "");
    setLocalForme(searchParams.get("forme") ?? "");
    setLocalSaison(searchParams.get("saison") ?? "");
  }, [searchParams]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL_VALUE) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // useTransition : la navigation est non-bloquante
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handlePhaseChange(value: string) {
    if (value === ALL_VALUE || isValidPhase(value)) {
      setLocalPhase(value === ALL_VALUE ? "" : value); // mise à jour locale immédiate
      updateParam("phase", value);
    }
  }
  function handleTailleChange(value: string) {
    if (value === ALL_VALUE || isValidTaille(value)) {
      setLocalTaille(value === ALL_VALUE ? "" : value);
      updateParam("taille", value);
    }
  }
  function handleFormeChange(value: string) {
    if (value === ALL_VALUE || isValidForme(value)) {
      setLocalForme(value === ALL_VALUE ? "" : value);
      updateParam("forme", value);
    }
  }
  function handleSaisonChange(value: string) {
    if (value === ALL_VALUE || isValidSaison(value)) {
      setLocalSaison(value === ALL_VALUE ? "" : value);
      updateParam("saison", value);
    }
  }

  return (
    <div className={`grid grid-cols-2 gap-2 md:grid-cols-4 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      {/* Phase — utiliser localPhase pour la valeur affichée */}
      <Select
        value={isValidPhase(localPhase) ? localPhase : ALL_VALUE}
        onValueChange={handlePhaseChange}
      >
        <SelectTrigger label={tAnalytics("filtres.phase")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{tAnalytics("filtres.toutes")}</SelectItem>
          {Object.values(PhaseElevage).map((phase) => (
            <SelectItem key={phase} value={phase}>
              {tSettings(`phases.${phase}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Taille, Forme, Saison — même pattern avec localTaille, localForme, localSaison */}
      {/* ... (remplacer currentTaille/currentForme/currentSaison par les variables locales) */}
    </div>
  );
}
```

**Étape 3 — `analytics-aliments-page.tsx` : wrapping Suspense pour les résultats (optionnel, amélioration future)**

Si le skeleton du `loading.tsx` n'est pas assez granulaire, on peut wrapper `FeedComparisonCards` dans un `<Suspense>` séparé. Cela nécessite d'extraire les appels de données dans un Server Component enfant. Cette étape est optionnelle — le `loading.tsx` + `useTransition` couvrent déjà le cas principal.

---

### P5 — Planning — vide pour les mois hors plage préchargée

**Fichier à modifier :**
- `src/components/planning/planning-client.tsx`

**Problème actuel :**

`PlanningClient` reçoit `activites: ActiviteWithRelations[]` chargé côté serveur **une seule fois** au moment du rendu initial. La navigation mois (`prevMonth`, `nextMonth`, lignes 203–210) met à jour `viewYear`/`viewMonth` localement, mais ne refetch pas les données. `activitesMoisCourant` (ligne 236) et `activitesByDate` (ligne 224) filtrent uniquement parmi les activités déjà en mémoire.

**Fix — Fetch côté client au changement de mois :**

```tsx
// AJOUTER les imports
import { useActiviteService } from "@/services";
// useActiviteService est déjà importé ligne 41

// AJOUTER après les déclarations de state existantes (après ligne 200) :
const [activitesData, setActivitesData] = useState<ActiviteWithRelations[]>(activites);
const [isFetchingMonth, setIsFetchingMonth] = useState(false);

// AJOUTER une fonction fetchMonth :
async function fetchMonth(year: number, month: number) {
  setIsFetchingMonth(true);
  try {
    // Calculer la plage du mois
    const from = new Date(year, month, 1).toISOString();
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    const res = await activiteService.list({ from, to });
    if (res.ok && res.data) {
      setActivitesData(res.data as ActiviteWithRelations[]);
    }
  } finally {
    setIsFetchingMonth(false);
  }
}

// MODIFIER prevMonth et nextMonth pour déclencher le fetch :
function prevMonth() {
  const newMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const newYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  setViewMonth(newMonth);
  setViewYear(newYear);
  void fetchMonth(newYear, newMonth);
}

function nextMonth() {
  const newMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const newYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  setViewMonth(newMonth);
  setViewYear(newYear);
  void fetchMonth(newYear, newMonth);
}

// REMPLACER toutes les références à `activites` (la prop) par `activitesData` (le state) :
// lignes 213, 224, 236
const filteredActivites = activitesData.filter((a) => { ... });
```

Indicateur de chargement pour la navigation de mois — modifier la section header navigation (ligne 324) :

```tsx
<Button variant="outline" size="sm" onClick={prevMonth}
  disabled={isFetchingMonth} className="h-10 w-10 p-0">
  <ChevronLeft className="h-4 w-4" />
</Button>
<span className="text-sm font-semibold min-w-[120px] text-center">
  {isFetchingMonth ? (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <svg className="h-3.5 w-3.5 animate-spin" ...>...</svg>
      Chargement...
    </span>
  ) : (
    `${MONTHS[viewMonth]} ${viewYear}`
  )}
</span>
<Button variant="outline" size="sm" onClick={nextMonth}
  disabled={isFetchingMonth} className="h-10 w-10 p-0">
  <ChevronRight className="h-4 w-4" />
</Button>
```

**Pré-requis :** Vérifier que `activiteService.list()` accepte des paramètres `from`/`to` pour filtrer par plage de dates. Si ce n'est pas le cas, le service doit être étendu en conséquence avant d'implémenter ce fix.

---

### P6 — Pas de recherche textuelle sur les listes

**Statut : FUTURE IMPROVEMENT — ne pas implémenter dans ce cycle**

Ce n'est pas un bug mais un enhancement manquant. Les listes Besoins, Dépenses, Commandes, Planning n'ont pas de champ de recherche texte. À planifier dans Sprint 12 (Polish).

---

## 4. Vérifications

### Checklist par fix

#### P3 — LoadingOverlay
- [ ] `isLoading` alimente encore `GlobalLoadingBar` (pas de régression)
- [ ] `isMutating` n'est déclenché que par `incrementMutation`
- [ ] `NavigationLoader` utilise toujours `increment`/`decrement` (pas `incrementMutation`)
- [ ] Le code existant qui appelait `increment`/`decrement` pour des mutations a migré vers `incrementMutation`/`decrementMutation`
- [ ] Tester : naviguer entre pages → `GlobalLoadingBar` visible, overlay absent
- [ ] Tester : soumettre un formulaire critique → overlay visible

#### P1 — BesoinsListClient
- [ ] Cliquer sur l'onglet "Soumises" → seules les listes avec `statut === SOUMISE` s'affichent
- [ ] Cliquer sur "Toutes" → toutes les listes
- [ ] Les compteurs dans les tabs reflètent le bon nombre
- [ ] L'état vide ("Aucune liste") s'affiche correctement par onglet

#### P7 — Dépenses
- [ ] Sélectionner "Aliment" dans le filtre catégorie → onglet revient à "Toutes"
- [ ] Changer d'onglet → onglet actif persisté jusqu'au prochain changement de catégorie
- [ ] Les comptes par onglet sont cohérents avec le filtre catégorie actif

#### P4 — VaguesComparison
- [ ] Cliquer "Comparer" → bouton désactivé + spinner visible
- [ ] Après réponse → résultats affichés, bouton réactivé
- [ ] Si erreur API → `isComparing` repasse à `false` (grâce au `finally`)

#### P2 — FeedFilters
- [ ] Changer une valeur de Select → le Select affiche la nouvelle valeur **immédiatement**
- [ ] La barre de chargement fine apparaît pendant le re-fetch serveur
- [ ] L'overlay plein écran n'apparaît PAS (dépend de P3)
- [ ] Sur navigation initiale (sans cache) → skeleton visible via `loading.tsx`
- [ ] Retour navigateur → les Selects se synchronisent avec les searchParams

#### P5 — Planning
- [ ] Naviguer au mois suivant → les activités du nouveau mois se chargent
- [ ] Indicateur de chargement pendant la navigation de mois
- [ ] Le mois initial (données SSR) fonctionne comme avant

### Build et tests

```bash
npx vitest run
npm run build
```

Vérifier qu'aucune erreur TypeScript sur :
- `GlobalLoadingContextValue` — nouveau champ `isMutating` et méthodes `incrementMutation`/`decrementMutation`
- `LoadingOverlay` — utilise `isMutating` au lieu de `isLoading`
- Tous les consommateurs de `useGlobalLoading` qui destructurent uniquement `isLoading` ou `increment`/`decrement` — compatibles (les nouvelles propriétés sont additives)

---

## 5. Fichiers modifiés — récapitulatif

| Fix | Fichiers |
|-----|---------|
| P3 | `src/contexts/global-loading.context.tsx`, `src/components/ui/loading-overlay.tsx` |
| P1 | `src/components/besoins/besoins-list-client.tsx` |
| P7 | `src/components/depenses/depenses-list-client.tsx` |
| P4 | `src/components/analytics/vagues-comparison-client.tsx` |
| P2 | `src/components/analytics/feed-filters.tsx`, `src/app/(farm)/analytics/aliments/loading.tsx` (nouveau) |
| P5 | `src/components/planning/planning-client.tsx` |
| P6 | — (skip) |
