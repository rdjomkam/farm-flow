"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";

export function useDashboardData<T = unknown>(initialData?: T) {
  const { call } = useApi();

  return useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: async () => {
      const result = await call<T>("/api/dashboard");
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement dashboard");
      return result.data;
    },
    staleTime: 5 * 60_000, // 5 min
    gcTime: 10 * 60_000,
    initialData,
  });
}
