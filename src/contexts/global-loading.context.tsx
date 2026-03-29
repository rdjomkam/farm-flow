"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function useGlobalLoading(): GlobalLoadingContextValue {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * GlobalLoadingProvider — Deux compteurs distincts :
 *
 * 1. `countRef` — navigation + toutes requêtes → alimente `isLoading` → GlobalLoadingBar
 * 2. `mutationCountRef` — mutations bloquantes (POST/PUT/PATCH/DELETE) → alimente
 *    `isMutating` → LoadingOverlay plein écran
 *
 * NavigationLoader utilise increment/decrement (barre fine uniquement).
 * useApi utilise incrementMutation/decrementMutation pour POST/PUT/PATCH/DELETE
 * et increment/decrement pour GET.
 *
 * Usage dans layout.tsx :
 *   <GlobalLoadingProvider>
 *     <GlobalLoadingBar />
 *     <LoadingOverlay />
 *     {children}
 *   </GlobalLoadingProvider>
 */
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
