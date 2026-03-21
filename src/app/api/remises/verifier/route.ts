/**
 * src/app/api/remises/verifier/route.ts
 *
 * GET /api/remises/verifier?code=XXX  — vérifier un code promo (PUBLIC, sans auth)
 *
 * Sécurité :
 * - Rate limiting basique en mémoire : 10 appels/min par IP
 * - La réponse ne fuit pas les détails internes (userId, siteId exclus)
 *
 * Story 35.1 — Sprint 35 (remplace version Sprint 33 qui requérait auth)
 * R2 : enums importés depuis @/types
 */
import { NextRequest, NextResponse } from "next/server";
import { verifierRemiseApplicable } from "@/lib/queries/remises";

// Rate limiting en mémoire — Map<ip, { count: number, resetAt: number }>
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    // Nouvelle fenêtre ou fenêtre expirée
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // Limite dépassée
  }

  entry.count += 1;
  return true;
}

export async function GET(request: NextRequest) {
  // Extraire l'IP du client
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // Vérifier le rate limit
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { valide: false, messageErreur: "Trop de requêtes. Réessayez dans 1 minute." },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const siteId = searchParams.get("siteId") ?? undefined;

  if (!code || code.trim().length === 0) {
    return NextResponse.json(
      { valide: false, messageErreur: "Le code promo est requis." },
      { status: 400 }
    );
  }

  try {
    const result = await verifierRemiseApplicable(code.trim().toUpperCase(), siteId);

    if (!result.remise) {
      return NextResponse.json({
        valide: false,
        messageErreur: result.erreur ?? "Code promo invalide.",
      });
    }

    // Exposer uniquement les données publiques — jamais userId ni siteId
    const remise = result.remise;
    return NextResponse.json({
      valide: true,
      remise: {
        id: remise.id,
        code: remise.code,
        nom: remise.nom,
        type: remise.type,
        valeur: Number(remise.valeur),
        estPourcentage: remise.estPourcentage,
        dateFin: remise.dateFin,
        limiteUtilisations: remise.limiteUtilisations,
        nombreUtilisations: remise.nombreUtilisations,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json(
      { valide: false, messageErreur: `Erreur lors de la vérification. ${message}` },
      { status: 500 }
    );
  }
}
