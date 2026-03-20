"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlobalLoadingContextValue {
  /** true dès qu'au moins une requête API est en cours */
  isLoading: boolean;
  /** Incrémente le compteur de requêtes actives */
  increment: () => void;
  /** Décrémente le compteur de requêtes actives */
  decrement: () => void;
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
 * GlobalLoadingProvider — Compteur de requêtes API actives.
 *
 * Utilise un ref (pas un state) pour le compteur afin d'éviter les re-renders
 * intermédiaires. Seul le boolean `isLoading` trigger un re-render, et
 * seulement lors du passage 0→1 et 1→0.
 *
 * Supporte les requêtes concurrentes : isLoading reste true tant que toutes
 * les requêtes actives ne sont pas terminées.
 *
 * Usage dans layout.tsx :
 *   <GlobalLoadingProvider>
 *     <GlobalLoadingBar />
 *     {children}
 *   </GlobalLoadingProvider>
 */
export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const countRef = useRef(0);

  const increment = useCallback(() => {
    countRef.current += 1;
    if (countRef.current === 1) {
      setIsLoading(true);
    }
  }, []);

  const decrement = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    if (countRef.current === 0) {
      setIsLoading(false);
    }
  }, []);

  return (
    <GlobalLoadingContext value={{ isLoading, increment, decrement }}>
      {children}
    </GlobalLoadingContext>
  );
}
