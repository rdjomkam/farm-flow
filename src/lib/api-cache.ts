import { NextResponse } from "next/server";

type CacheTier = "static" | "slow" | "medium" | "fast" | "none";

const CACHE_CONFIG: Record<CacheTier, { maxAge: number; swr: number }> = {
  static: { maxAge: 3600, swr: 86400 },
  slow: { maxAge: 300, swr: 600 },
  medium: { maxAge: 60, swr: 120 },
  fast: { maxAge: 10, swr: 30 },
  none: { maxAge: 0, swr: 0 },
};

export function cachedJson<T>(data: T, tier: CacheTier = "medium"): NextResponse {
  const { maxAge, swr } = CACHE_CONFIG[tier];
  const headers: HeadersInit = {};
  if (maxAge > 0) {
    headers["Cache-Control"] = `private, max-age=${maxAge}, stale-while-revalidate=${swr}`;
  } else {
    headers["Cache-Control"] = "no-store";
  }
  return NextResponse.json(data, { headers });
}
