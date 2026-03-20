# ADR-018 — Service Layer : Centralisation des appels API

**Statut :** PROPOSE
**Date :** 2026-03-20
**Auteur :** @architect

---

## Contexte

Audit du code source révèle **66 fichiers composants** effectuant des `fetch()` directs, avec au minimum **80+ appels fetch distincts** dispersés. Chaque composant gère son propre état de chargement (`useState`), sa gestion d'erreur, et son parsing JSON — trois problèmes récurrents qui ne sont résolus nulle part de façon centralisée.

Symptômes observés :
- `const [loading, setLoading] = useState(false)` répété dans ~40 composants
- `const [submitting, setSubmitting] = useState(false)` répété dans ~25 formulaires
- Le même bloc `try { fetch → if !res.ok → toast error } catch { toast réseau } finally { setLoading(false) }` recopié partout
- Le `FishLoader` est instancié individuellement dans chaque bouton/dialog
- Pas de retry, pas de timeout, pas de logging uniforme

---

## Décision

Créer une **couche service client-side** composée de :

1. **`useApi` hook** — wrappeur `fetch` avec loading, error, toast automatiques
2. **`GlobalLoadingContext`** — compteur de requêtes actives pour afficher le FishLoader une seule fois en layout
3. **Services de domaine** — collections de fonctions typées groupées par domaine (vague, releve, bac, stock, etc.)

### Ce que l'on NE fait PAS

- Pas de classe abstraite `ApiService` (React = hooks, pas OOP)
- Pas de cache (SWR/React Query) — hors scope, le projet utilise `router.refresh()` volontairement
- Pas de migration forcée immédiate — migration progressive, les anciens `fetch()` continuent de fonctionner

---

## Architecture proposée

### Structure des fichiers

```
src/
  hooks/
    use-api.ts              # Hook de base — wrappeur fetch typé
  services/
    vague.service.ts        # Appels /api/vagues/**
    releve.service.ts       # Appels /api/releves/**
    bac.service.ts          # Appels /api/bacs/**
    stock.service.ts        # Appels /api/produits/**, /api/commandes/**, /api/fournisseurs/**
    vente.service.ts        # Appels /api/ventes/**, /api/factures/**, /api/clients/**
    finance.service.ts      # Appels /api/finances/**
    activite.service.ts     # Appels /api/activites/**
    notification.service.ts # Appels /api/notifications/**
    export.service.ts       # Appels /api/export/** (blob downloads)
    analytics.service.ts    # Appels /api/analytics/**
  contexts/
    global-loading.context.tsx  # Compteur de requêtes actives
```

---

## A. Le hook `useApi`

Fichier : `src/hooks/use-api.ts`

```typescript
"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { useGlobalLoading } from "@/contexts/global-loading.context";

export interface ApiOptions {
  /** Ne pas afficher de toast en cas d'erreur (géré manuellement par l'appelant) */
  silentError?: boolean;
  /** Ne pas contribuer au compteur de loading global (ex: polling silencieux) */
  silentLoading?: boolean;
  /** Message de toast en cas de succès (optionnel) */
  successMessage?: string;
}

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  ok: boolean;
}

/**
 * useApi — Hook de base pour tous les appels fetch.
 *
 * - Gère loading global automatiquement (sauf silentLoading: true)
 * - Parse JSON automatiquement
 * - Affiche un toast d'erreur automatiquement (sauf silentError: true)
 * - Retourne toujours { data, error, ok } — jamais de throw non géré
 *
 * NE PAS utiliser directement dans les composants.
 * Utiliser les services de domaine (useVagueService, etc.)
 */
export function useApi() {
  const { toast } = useToast();
  const { increment, decrement } = useGlobalLoading();

  const call = useCallback(
    async <T>(
      url: string,
      init?: RequestInit,
      options?: ApiOptions
    ): Promise<ApiResult<T>> => {
      const { silentError = false, silentLoading = false, successMessage } = options ?? {};

      if (!silentLoading) increment();

      try {
        const res = await fetch(url, init);

        let data: T | null = null;
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          data = await res.json();
        }

        if (!res.ok) {
          const message =
            (data as Record<string, string> | null)?.message ??
            (data as Record<string, string> | null)?.error ??
            `Erreur ${res.status}`;

          if (!silentError) {
            toast({ title: message, variant: "error" });
          }

          return { data: null, error: message, ok: false };
        }

        if (successMessage) {
          toast({ title: successMessage, variant: "success" });
        }

        return { data, error: null, ok: true };
      } catch {
        const message = "Erreur réseau. Vérifiez votre connexion.";
        if (!silentError) {
          toast({ title: message, variant: "error" });
        }
        return { data: null, error: message, ok: false };
      } finally {
        if (!silentLoading) decrement();
      }
    },
    [toast, increment, decrement]
  );

  /**
   * Variante pour les téléchargements de fichiers (blob).
   * Retourne le blob ou null en cas d'erreur.
   */
  const download = useCallback(
    async (url: string, filename: string, options?: Pick<ApiOptions, "silentLoading">): Promise<boolean> => {
      const { silentLoading = false } = options ?? {};
      if (!silentLoading) increment();

      try {
        const res = await fetch(url);
        if (!res.ok) {
          let errorMsg = "Erreur lors du téléchargement";
          try {
            const data = await res.json();
            errorMsg = data.error ?? data.message ?? errorMsg;
          } catch { /* ignore */ }
          toast({ title: errorMsg, variant: "error" });
          return false;
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        toast({ title: `${filename} téléchargé`, variant: "success" });
        return true;
      } catch {
        toast({ title: "Erreur réseau lors du téléchargement", variant: "error" });
        return false;
      } finally {
        if (!silentLoading) decrement();
      }
    },
    [toast, increment, decrement]
  );

  return { call, download };
}
```

---

## B. Le contexte `GlobalLoadingContext`

Fichier : `src/contexts/global-loading.context.tsx`

```typescript
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

interface GlobalLoadingContextValue {
  isLoading: boolean;
  increment: () => void;
  decrement: () => void;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function useGlobalLoading() {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) throw new Error("useGlobalLoading must be within GlobalLoadingProvider");
  return ctx;
}

/**
 * GlobalLoadingProvider — Compteur de requêtes actives.
 *
 * Utilise un compteur (ref) pour supporter les requêtes concurrentes.
 * isLoading = true dès qu'au moins une requête est en cours.
 */
export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const countRef = useRef(0);

  const increment = useCallback(() => {
    countRef.current += 1;
    if (countRef.current === 1) setIsLoading(true);
  }, []);

  const decrement = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current === 0) setIsLoading(false);
  }, []);

  return (
    <GlobalLoadingContext value={{ isLoading, increment, decrement }}>
      {children}
    </GlobalLoadingContext>
  );
}
```

Le `GlobalLoadingProvider` s'imbrique dans `layout.tsx` autour du `ToastProvider` :

```tsx
// src/app/layout.tsx (extrait)
<ToastProvider>
  <GlobalLoadingProvider>
    <GlobalLoadingBar />     {/* barre discrète en haut — voir §D */}
    {children}
  </GlobalLoadingProvider>
</ToastProvider>
```

---

## C. Services de domaine — exemple `useVagueService`

Fichier : `src/services/vague.service.ts`

```typescript
"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type {
  CreateVagueDTO,
  UpdateVagueDTO,
  VagueResponse,
  VagueSummaryResponse,
} from "@/types";

export function useVagueService() {
  const { call } = useApi();

  const list = useCallback(
    () => call<{ vagues: VagueSummaryResponse[] }>("/api/vagues"),
    [call]
  );

  const get = useCallback(
    (id: string) => call<VagueResponse>(`/api/vagues/${id}`),
    [call]
  );

  const create = useCallback(
    (dto: CreateVagueDTO) =>
      call<VagueResponse>("/api/vagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      }, { successMessage: "Vague créée avec succès !" }),
    [call]
  );

  const update = useCallback(
    (id: string, dto: UpdateVagueDTO) =>
      call<VagueResponse>(`/api/vagues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      }, { successMessage: "Vague modifiée." }),
    [call]
  );

  const cloture = useCallback(
    (id: string, body: { dateFin: string; notes?: string }) =>
      call<VagueResponse>(`/api/vagues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "TERMINEE", ...body }),
      }, { successMessage: "Vague clôturée." }),
    [call]
  );

  return { list, get, create, update, cloture };
}
```

---

## D. Indicateur de chargement global — `GlobalLoadingBar`

Fichier : `src/components/ui/global-loading-bar.tsx`

```typescript
"use client";

import { useGlobalLoading } from "@/contexts/global-loading.context";
import { cn } from "@/lib/utils";

/**
 * GlobalLoadingBar — Barre de progression discrète en haut de page.
 *
 * Visible dès qu'au moins une requête API est en cours.
 * Utilise une animation CSS indéterminée (pas de valeur de progression réelle).
 * Mobile-first : 2px de haut, z-index élevé pour passer au-dessus du header.
 */
export function GlobalLoadingBar() {
  const { isLoading } = useGlobalLoading();

  if (!isLoading) return null;

  return (
    <div
      role="progressbar"
      aria-label="Chargement en cours"
      aria-valuetext="Chargement..."
      className={cn(
        "fixed top-0 left-0 right-0 z-[200] h-0.5",
        "bg-primary/20"
      )}
    >
      <div className="h-full bg-primary animate-loading-bar" />
    </div>
  );
}
```

L'animation CSS `animate-loading-bar` à ajouter dans `globals.css` ou `tailwind.config.ts` :

```css
@keyframes loading-bar {
  0%   { transform: translateX(-100%); }
  50%  { transform: translateX(0%); width: 75%; }
  100% { transform: translateX(100%); }
}
```

```typescript
// tailwind.config.ts (extend animation)
animation: {
  "loading-bar": "loading-bar 1.2s ease-in-out infinite",
}
```

### Pourquoi une barre et pas un FishLoader global ?

Le FishLoader `md`/`lg` occupe de l'espace visuel et convient aux états vides (page entière). Pour les interactions rapides (POST formulaire, DELETE, etc.), une **barre de progression discrète en haut** est la convention UX mobile moderne — non intrusive, visible sans bloquer l'interface.

Les boutons et formulaires continuent d'afficher leur propre `FishLoader size="sm"` via leur `submitting` local — cela reste nécessaire pour désactiver le bouton (`disabled={submitting}`). Le loading global est **additionnel**, pas remplaçant.

---

## E. Stratégie de migration progressive

### Phase 1 — Infrastructure (sans toucher aux composants)

1. Créer `src/contexts/global-loading.context.tsx`
2. Créer `src/hooks/use-api.ts`
3. Intégrer `GlobalLoadingProvider` + `GlobalLoadingBar` dans `layout.tsx`
4. Créer le service exemple `src/services/vague.service.ts`

A ce stade : les anciens composants fonctionnent sans changement. La barre de chargement n'apparaît que pour les composants migrés.

### Phase 2 — Migration par domaine (impact décroissant)

Priorité basée sur la fréquence d'utilisation et la répétition de code :

| Ordre | Domaine | Composants ciblés | Raison |
|-------|---------|-------------------|--------|
| 1 | Vagues | `vagues-list-client`, `modifier-vague-dialog`, `cloturer-dialog` | Core métier, le plus utilisé |
| 2 | Relevés | `releve-form-client`, `modifier-releve-dialog` | Formulaire complexe avec 3 fetch() |
| 3 | Stock/Commandes | `commandes-list-client`, `produits-list-client` | Beaucoup de CRUD répété |
| 4 | Ventes/Factures | `vente-form-client`, `facture-detail-client` | Patterns similaires |
| 5 | Export | `export-button.tsx`, `vague-action-menu.tsx` | Logique blob déjà extraite, facile |
| 6 | Autres | Tous les restants | Long tail |

### Phase 3 — Unification des états locaux (optionnel)

Une fois les services en place, les `useState(false)` pour `submitting` peuvent être gardés — ils servent à `disabled={submitting}` sur les boutons. Le service ne les remplace pas, il vient en complément.

---

## F. Comment un composant migre

### Avant (pattern actuel dans `vagues-list-client.tsx`)

```typescript
const [submitting, setSubmitting] = useState(false);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSubmitting(true);
  try {
    const res = await fetch("/api/vagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const data = await res.json();
      toast({ title: data.message || "Erreur lors de la création.", variant: "error" });
      return;
    }
    toast({ title: "Vague créée avec succès !", variant: "success" });
    setDialogOpen(false);
    router.refresh();
  } catch {
    toast({ title: "Erreur réseau.", variant: "error" });
  } finally {
    setSubmitting(false);
  }
}
```

### Après (avec service)

```typescript
const vagueService = useVagueService();
const [submitting, setSubmitting] = useState(false);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSubmitting(true);
  const { ok } = await vagueService.create(dto);
  setSubmitting(false);
  if (ok) {
    setDialogOpen(false);
    router.refresh();
  }
}
```

- Le toast d'erreur : géré automatiquement par le service
- Le toast de succès : passé en option `successMessage` au service
- Le `submitting` local : conservé pour `disabled={submitting}` sur le bouton
- Le `isLoading` global : automatiquement incrémenté/décrémenté par `useApi`

---

## G. Cas particuliers

### Polling silencieux (NotificationBell)

Le composant `notification-bell.tsx` poll toutes les 60 secondes. Ce fetch ne doit PAS activer la barre de chargement globale.

```typescript
// Dans notification.service.ts
const getCount = useCallback(
  () => call<{ count: number }>("/api/notifications/count", undefined,
    { silentLoading: true, silentError: true }  // polling silencieux
  ),
  [call]
);
```

### Téléchargements de fichiers (ExportButton)

Le hook `useApi` expose une méthode `download()` dédiée qui gère le blob + trigger du téléchargement. Le composant `export-button.tsx` peut migrer vers `useExportService()` sans changer son interface publique.

### useEffect avec fetch (chargement de données dépendantes)

Exemple dans `releve-form-client.tsx` : chargement des bacs quand `vagueId` change.

```typescript
// Avant
useEffect(() => {
  if (!vagueId) return;
  setLoadingBacs(true);
  fetch(`/api/bacs?vagueId=${vagueId}`)
    .then(res => res.json())
    .then(data => setBacs(data.bacs ?? []))
    .catch(() => setBacs([]))
    .finally(() => setLoadingBacs(false));
}, [vagueId]);

// Après
const bacService = useBacService();
const [loadingBacs, setLoadingBacs] = useState(false);

useEffect(() => {
  if (!vagueId) return;
  setLoadingBacs(true);
  bacService.listByVague(vagueId)
    .then(({ data }) => setBacs(data?.bacs ?? []))
    .finally(() => setLoadingBacs(false));
}, [vagueId]);
// Note : loadingBacs local reste nécessaire pour désactiver le Select
```

---

## H. Décisions de design

### Hooks vs module singleton

On utilise des **hooks** (`useVagueService()`) plutôt qu'un singleton importé directement. Raison : le hook accède à `useToast()` et `useGlobalLoading()` qui sont eux-mêmes des hooks React nécessitant un contexte. Un singleton module (importé hors composant) ne pourrait pas appeler ces hooks.

### `useCallback` dans les services

Chaque méthode est wrappée dans `useCallback` avec `[call]` comme dépendance. `call` est stable (mémoïsé dans `useApi`), donc les méthodes du service sont également stables — ce qui permet de les inclure dans les `useEffect` deps sans boucle infinie.

### Pas de state dans les services

Les services ne stockent pas d'état (pas de `data`, `loading`, `error` dans le service lui-même). Ce sont des collections de fonctions async qui retournent `{ data, error, ok }`. L'état reste dans le composant qui appelle le service. Cela évite les problèmes de state partagé entre plusieurs composants utilisant le même service.

---

## Fichiers à créer

| Fichier | Taille estimée |
|---------|----------------|
| `src/contexts/global-loading.context.tsx` | ~60 lignes |
| `src/hooks/use-api.ts` | ~90 lignes |
| `src/components/ui/global-loading-bar.tsx` | ~30 lignes |
| `src/services/vague.service.ts` | ~60 lignes |
| `src/services/releve.service.ts` | ~70 lignes |
| `src/services/bac.service.ts` | ~40 lignes |
| `src/services/stock.service.ts` | ~80 lignes |
| `src/services/vente.service.ts` | ~70 lignes |
| `src/services/finance.service.ts` | ~40 lignes |
| `src/services/activite.service.ts` | ~60 lignes |
| `src/services/notification.service.ts` | ~30 lignes |
| `src/services/export.service.ts` | ~50 lignes |
| `src/services/analytics.service.ts` | ~50 lignes |
| `src/services/index.ts` | ~20 lignes (barrel) |

Fichiers modifiés :
- `src/app/layout.tsx` — ajouter `GlobalLoadingProvider` + `GlobalLoadingBar`
- `tailwind.config.ts` — ajouter animation `loading-bar`

---

## Résumé des choix

| Question | Choix | Raison |
|----------|-------|--------|
| Class vs Hook | Hook (`useVagueService`) | React idioms, accès aux contextes |
| Global fish vs barre | Barre top 2px | Non-intrusive, standard mobile UX |
| State dans services | Non | Évite le shared mutable state |
| Migration forcée | Non — progressive | 66 fichiers, risque de régression |
| Gestion du `submitting` local | Conservé | Nécessaire pour `disabled` bouton |
| Polling silencieux | `silentLoading: true` | Évite la barre qui clignote en boucle |
