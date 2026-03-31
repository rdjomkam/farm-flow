import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _prisma: PrismaClient | undefined;

const CONNECTION_ERROR_PATTERNS = [
  "Connection terminated",
  "ECONNRESET",
  "ENOTCONN",
  "ECONNREFUSED",
  "connection closed",
  "Client has encountered a connection error",
];

function isConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CONNECTION_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function resetPrisma(): void {
  _prisma = undefined;
  globalForPrisma.prisma = undefined;
}

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = globalForPrisma.prisma ?? (() => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("[Prisma] DATABASE_URL is not set");
      }
      const adapter = new PrismaPg({
        connectionString,
        max: 1,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
      });
      const client = new PrismaClient({ adapter });
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = client;
      }
      return client;
    })();
  }
  return _prisma;
}

// Lazy proxy: PrismaPg constructor only runs on first DB query, not at module import.
// Wraps calls to auto-retry once on stale connection errors (common in serverless).
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const value = (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value !== "function") {
      return value;
    }
    // Return a wrapper that retries on connection errors
    return new Proxy(value as object, {
      get(fnTarget, fnProp) {
        const nested = (fnTarget as Record<string | symbol, unknown>)[fnProp];
        if (typeof nested !== "function") {
          return nested;
        }
        return async (...args: unknown[]) => {
          try {
            return await (nested as Function).apply(fnTarget, args);
          } catch (error) {
            if (isConnectionError(error)) {
              console.warn("[Prisma] Stale connection detected, reconnecting…");
              resetPrisma();
              const freshTarget = (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
              const freshFn = (freshTarget as Record<string | symbol, unknown>)[fnProp];
              return await (freshFn as Function).apply(freshTarget, args);
            }
            throw error;
          }
        };
      },
    });
  },
});
