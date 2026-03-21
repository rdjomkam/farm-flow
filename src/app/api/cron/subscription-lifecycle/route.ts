/**
 * GET /api/cron/subscription-lifecycle
 *
 * Endpoint CRON pour les transitions automatiques de statut des abonnements.
 * Protege par un token secret (env CRON_SECRET) via crypto.timingSafeEqual.
 * Idempotent : re-executer le meme jour ne change rien (updateMany atomiques).
 *
 * Transitions effectuees :
 *   ACTIF → EN_GRACE   (dateFin depassee)
 *   EN_GRACE → SUSPENDU (dateFinGrace depassee)
 *   SUSPENDU → EXPIRE  (suspension trop longue)
 *
 * Commissions :
 *   EN_ATTENTE → DISPONIBLE (creees il y a plus de 30 jours)
 *
 * Appele quotidiennement a 08:00 UTC via vercel.json.
 * ADR : docs/decisions/019-cron-jobs.md
 *
 * Story 36.1 — Sprint 36
 */

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { transitionnerStatuts } from "@/lib/services/abonnement-lifecycle";
import { rendreCommissionsDisponiblesCron } from "@/lib/services/commissions";
import { envoyerRappelsRenouvellement } from "@/lib/services/rappels-abonnement";

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

/**
 * Compare deux tokens de facon timing-safe pour prevenir les timing attacks.
 * Retourne false immediatement si les longueurs different.
 */
function timingSafeTokenEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // ---- Verification du token CRON ----
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error(
        "[CRON /api/cron/subscription-lifecycle] CRON_SECRET non configure"
      );
      return NextResponse.json(
        { status: 500, message: "Configuration serveur manquante." },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";
    if (!timingSafeTokenEqual(token, cronSecret)) {
      return NextResponse.json(
        { status: 401, message: "Token CRON invalide." },
        { status: 401 }
      );
    }

    // ---- Transitions de statut des abonnements ----
    const transitions = await transitionnerStatuts();

    // ---- Commissions disponibles (J+30) ----
    const commissionsDisponibles = await rendreCommissionsDisponiblesCron();

    // ---- Rappels de renouvellement (J-14, J-7, J-3, J-1) ----
    const { envoyes: rappelsEnvoyes } = await envoyerRappelsRenouvellement();

    return NextResponse.json({
      status: 200,
      message: "Lifecycle traite avec succes.",
      processed: {
        graces: transitions.graces,
        suspendus: transitions.suspendus,
        expires: transitions.expires,
        commissionsDisponibles,
        rappelsRenouvellement: rappelsEnvoyes,
      },
    });
  } catch (error) {
    console.error(
      "[CRON /api/cron/subscription-lifecycle] Erreur globale:",
      error
    );
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors du traitement lifecycle." },
      { status: 500 }
    );
  }
}
