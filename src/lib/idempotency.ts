/**
 * Server-side idempotency handler for offline queue replay protection.
 * Prevents duplicate mutations when the same request is retried after network timeout.
 */

import { prisma } from "@/lib/db";

const EXPIRY_HOURS = 48;

interface IdempotencyResult {
  /** True if this key was already processed — return cached response */
  isDuplicate: boolean;
  /** Cached response body (if duplicate) */
  response?: unknown;
  /** Cached status code (if duplicate) */
  statusCode?: number;
}

/**
 * Check if a request with this idempotency key has already been processed.
 * Call this at the START of a POST/PUT handler.
 */
export async function checkIdempotency(
  key: string | null,
  siteId: string
): Promise<IdempotencyResult> {
  if (!key) return { isDuplicate: false };

  const existing = await prisma.idempotencyRecord.findUnique({
    where: { key },
  });

  if (existing && existing.siteId === siteId) {
    return {
      isDuplicate: true,
      response: existing.response,
      statusCode: existing.statusCode,
    };
  }

  return { isDuplicate: false };
}

/**
 * Store the response for an idempotency key.
 * Call this AFTER successfully processing a request.
 */
export async function storeIdempotency(
  key: string | null,
  siteId: string,
  response: unknown,
  statusCode: number
): Promise<void> {
  if (!key) return;

  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.idempotencyRecord.upsert({
    where: { key },
    update: { response: response as object, statusCode, expiresAt },
    create: { key, siteId, response: response as object, statusCode, expiresAt },
  });
}

/**
 * Clean up expired idempotency records.
 * Call this periodically (e.g., from a cron job or API route).
 */
export async function cleanupIdempotency(): Promise<number> {
  const result = await prisma.idempotencyRecord.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
