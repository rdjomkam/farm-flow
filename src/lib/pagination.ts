/**
 * Cursor-based pagination utilities for Prisma + TanStack Query.
 *
 * Usage (API route):
 *   const params = parsePaginationParams(request.nextUrl.searchParams);
 *   const result = await paginatedQuery(prisma.releve, { where, orderBy }, params);
 *   return NextResponse.json(result);
 *
 * Usage (client):
 *   const query = usePaginatedQuery(queryKeys.releves.list(), "/api/releves");
 *   query.data.pages.flatMap(p => p.items)  // all loaded items
 *   query.fetchNextPage()                   // load more
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

// ---------------------------------------------------------------------------
// Server helpers
// ---------------------------------------------------------------------------

/** Parse cursor & limit from URLSearchParams (defaults: limit=20, no cursor). */
export function parsePaginationParams(
  searchParams: URLSearchParams,
): PaginationParams {
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 100) : 20;
  const cursor = searchParams.get("cursor") ?? undefined;
  return { cursor, limit };
}

/**
 * Execute a paginated Prisma query using cursor-based pagination.
 *
 * @param model   - Prisma delegate (e.g. `prisma.releve`)
 * @param args    - `where`, `orderBy`, `include`, `select` etc.
 * @param params  - `{ cursor?, limit }` from `parsePaginationParams`
 *
 * Assumes `orderBy` sorts by a field whose value on the last item serves
 * as the next cursor. Default cursor field is `id`.
 */
export async function paginatedQuery<T extends { id: string }>(
  model: {
    findMany: (args: Record<string, unknown>) => Promise<T[]>;
    count: (args: { where?: Record<string, unknown> }) => Promise<number>;
  },
  args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
  },
  params: PaginationParams,
): Promise<PaginatedResult<T>> {
  const { cursor, limit } = params;

  // Build findMany args
  const findArgs: Record<string, unknown> = {
    ...args,
    take: limit + 1, // fetch one extra to detect if there's a next page
  };

  if (cursor) {
    findArgs.cursor = { id: cursor };
    findArgs.skip = 1; // skip the cursor item itself
  }

  const [items, total] = await Promise.all([
    model.findMany(findArgs) as Promise<T[]>,
    model.count({ where: args.where }),
  ]);

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const nextItem = items.pop()!;
    nextCursor = nextItem.id;
  }

  return { items, nextCursor, total };
}
