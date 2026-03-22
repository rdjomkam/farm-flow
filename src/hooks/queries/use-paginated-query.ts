"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import type { PaginatedResult } from "@/lib/pagination";

interface UsePaginatedQueryOptions {
  /** TanStack query key */
  queryKey: readonly unknown[];
  /** API endpoint URL (without pagination params) */
  url: string;
  /** Additional query params to append */
  params?: Record<string, string>;
  /** Override staleTime */
  staleTime?: number;
  /** Override gcTime */
  gcTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * Wrapper around `useInfiniteQuery` for cursor-based pagination.
 *
 * Automatically handles `getNextPageParam` using the `nextCursor` field
 * returned by `paginatedQuery` on the server.
 *
 * @example
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
 *   usePaginatedQuery({
 *     queryKey: queryKeys.releves.list({ vagueId }),
 *     url: "/api/releves",
 *     params: { vagueId },
 *   });
 * const allItems = data?.pages.flatMap(p => p.items) ?? [];
 */
export function usePaginatedQuery<T>(options: UsePaginatedQueryOptions) {
  const { call } = useApi();

  return useInfiniteQuery<PaginatedResult<T>>({
    queryKey: options.queryKey,
    queryFn: async ({ pageParam }) => {
      const searchParams = new URLSearchParams(options.params);
      if (pageParam) {
        searchParams.set("cursor", pageParam as string);
      }
      const qs = searchParams.toString();
      const url = `${options.url}${qs ? `?${qs}` : ""}`;

      const result = await call<PaginatedResult<T>>(url, undefined, { silentLoading: true });
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "Erreur de chargement");
      }
      return result.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: options.staleTime,
    gcTime: options.gcTime,
    enabled: options.enabled,
  });
}
