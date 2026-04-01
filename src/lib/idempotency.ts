/**
 * Server-side idempotency handler for offline queue replay protection.
 * Prevents duplicate mutations when the same request is retried after network timeout.
 *
 * Behaviour:
 *   - Same key + same body  → replay cached response (200/201)
 *   - Same key + diff body  → 409 Conflict
 *   - No key               → pass-through (no idempotency)
 */

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const EXPIRY_HOURS = 48;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IdempotencyCheckResult =
  | { isDuplicate: false }
  | { isDuplicate: true; response: unknown; statusCode: number }
  | { isConflict: true };

/** Context returned by requirePermission */
interface AuthContext {
  activeSiteId: string;
}

/** Handler signature — receives auth context + parsed body */
type PostHandler<TAuth extends AuthContext> = (
  request: NextRequest,
  auth: TAuth,
  body: unknown
) => Promise<NextResponse>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute a stable SHA-256 hex digest of any JSON-serialisable value.
 * The body is sorted by key to make the hash deterministic regardless of
 * property insertion order.
 */
export function hashBody(body: unknown): string {
  const stable = JSON.stringify(body, Object.keys(body as object).sort());
  return createHash("sha256").update(stable).digest("hex");
}

// ---------------------------------------------------------------------------
// Low-level primitives (used by releves, kept for backward compat)
// ---------------------------------------------------------------------------

/**
 * Check if a request with this idempotency key has already been processed.
 * If bodyHash is provided it will be compared against the stored hash.
 *
 * Returns:
 *   - { isDuplicate: false }                           → proceed normally
 *   - { isDuplicate: true, response, statusCode }      → replay stored response
 *   - { isConflict: true }                             → same key, different body (409)
 */
export async function checkIdempotency(
  key: string | null,
  siteId: string,
  bodyHash?: string
): Promise<IdempotencyCheckResult> {
  if (!key) return { isDuplicate: false };

  const existing = await prisma.idempotencyRecord.findUnique({
    where: { key },
  });

  if (!existing) return { isDuplicate: false };

  // Wrong site — treat as not found to avoid leaking cross-site data
  if (existing.siteId !== siteId) return { isDuplicate: false };

  // If a bodyHash is provided, verify it matches the stored hash
  if (bodyHash !== undefined && existing.bodyHash !== null && existing.bodyHash !== undefined) {
    if (existing.bodyHash !== bodyHash) {
      return { isConflict: true };
    }
  }

  return {
    isDuplicate: true,
    response: existing.response,
    statusCode: existing.statusCode,
  };
}

/**
 * Store the response for an idempotency key.
 * Call this AFTER successfully processing a request.
 */
export async function storeIdempotency(
  key: string | null,
  siteId: string,
  response: unknown,
  statusCode: number,
  bodyHash?: string
): Promise<void> {
  if (!key) return;

  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.idempotencyRecord.upsert({
    where: { key },
    update: {
      response: response as object,
      statusCode,
      expiresAt,
      ...(bodyHash !== undefined && { bodyHash }),
    },
    create: {
      key,
      siteId,
      response: response as object,
      statusCode,
      expiresAt,
      ...(bodyHash !== undefined && { bodyHash }),
    },
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

// ---------------------------------------------------------------------------
// Higher-order helper — withIdempotency
// ---------------------------------------------------------------------------

/**
 * Wrap a POST handler with idempotency protection.
 *
 * Usage:
 *   export const POST = withIdempotency(async (request, auth, body) => {
 *     const result = await createThing(auth.activeSiteId, body);
 *     return NextResponse.json(result, { status: 201 });
 *   });
 *
 * The wrapper:
 *   1. Reads X-Idempotency-Key header
 *   2. Reads + parses the request body (so the handler must NOT call request.json() again)
 *   3. Computes a SHA-256 hash of the body
 *   4. Checks the idempotency store
 *      - Replay  → returns cached response immediately
 *      - Conflict → returns 409
 *      - New      → calls the inner handler
 *   5. Stores the response in the idempotency store after a successful call
 *
 * The inner handler receives:
 *   - request  : original NextRequest (body already consumed, do not call .json())
 *   - auth     : result of requirePermission (must be called inside the inner handler
 *                BEFORE calling withIdempotency — see example in POST /api/ventes)
 *   - body     : parsed JSON body (already read by the wrapper)
 *
 * Note: requirePermission must be called OUTSIDE the wrapper because auth errors
 * (401/403) must still be returned even when idempotency headers are present.
 */
export function withIdempotency<TAuth extends AuthContext>(
  handler: PostHandler<TAuth>
): (request: NextRequest, auth: TAuth) => Promise<NextResponse> {
  return async (request: NextRequest, auth: TAuth): Promise<NextResponse> => {
    const idempotencyKey = request.headers.get("X-Idempotency-Key");

    // Parse body once
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { status: 400, message: "Corps de la requete invalide (JSON attendu)." },
        { status: 400 }
      );
    }

    // Check idempotency if key present
    if (idempotencyKey) {
      const bHash = hashBody(body);
      const check = await checkIdempotency(idempotencyKey, auth.activeSiteId, bHash);

      if ("isConflict" in check) {
        return NextResponse.json(
          {
            status: 409,
            message:
              "Cle d'idempotence deja utilisee avec un corps de requete different.",
          },
          { status: 409 }
        );
      } else if (check.isDuplicate) {
        return NextResponse.json(check.response, { status: check.statusCode });
      }

      // Execute the inner handler
      const response = await handler(request, auth, body);

      // Store result only on success (2xx)
      if (response.status >= 200 && response.status < 300) {
        try {
          const cloned = response.clone();
          const responseBody = await cloned.json();
          await storeIdempotency(
            idempotencyKey,
            auth.activeSiteId,
            responseBody,
            response.status,
            bHash
          );
        } catch {
          // Non-fatal: if storing fails, the request succeeded anyway
          console.warn("[withIdempotency] Failed to store idempotency record");
        }
      }

      return response;
    }

    // No idempotency key — call handler directly
    return handler(request, auth, body);
  };
}
