/**
 * POST /api/depenses/backfill
 *
 * Backfill LigneDepense records for existing Depenses created before ADR-027.
 * Gated by CRON_SECRET Bearer token (no user auth).
 *
 * Body (optional): { siteId?: string }
 * If siteId absent, processes ALL sites.
 */

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { backfillLignesDepense } from "@/lib/queries/depenses";
import { apiError } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function timingSafeTokenEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // ---- Verification du token CRON ----
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[POST /api/depenses/backfill] CRON_SECRET non configure");
      return apiError(500, "Configuration serveur manquante.");
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";
    if (!timingSafeTokenEqual(token, cronSecret)) {
      return apiError(401, "Token CRON invalide.");
    }

    // ---- Parsing du corps ----
    let targetSiteId: string | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      if (body?.siteId && typeof body.siteId === "string") {
        targetSiteId = body.siteId;
      }
    } catch {
      // Corps absent ou invalide — traiter tous les sites
    }

    // ---- Backfill ----
    const result = await backfillLignesDepense(targetSiteId);

    return NextResponse.json({
      status: 200,
      message: "Backfill termine.",
      stats: {
        processed: result.processed,
        skipped: result.skipped,
        errors: result.errors.length,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error("[POST /api/depenses/backfill] Erreur globale:", error);
    return apiError(500, "Erreur serveur lors du backfill.");
  }
}
