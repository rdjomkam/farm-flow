import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _prisma: PrismaClient | undefined;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = globalForPrisma.prisma ?? (() => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("[Prisma] DATABASE_URL is not set");
      }
      const adapter = new PrismaPg({ connectionString });
      const client = new PrismaClient({ adapter });
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = client;
      }
      return client;
    })();
  }
  return _prisma;
}

// Lazy proxy: PrismaPg constructor only runs on first DB query, not at module import
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
