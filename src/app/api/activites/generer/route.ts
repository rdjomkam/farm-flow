/**
 * POST /api/activites/generer
 *
 * Endpoint CRON pour la generation automatique d'activites.
 * Protege par un token secret (env CRON_SECRET).
 * Idempotent : double-run ne genere pas de doublons (EC-3.1).
 *
 * Corps de la requete :
 *   { siteId?: string } — si absent, traite tous les sites actifs
 *
 * Appelé quotidiennement a 05:00 UTC (06:00 WAT) via vercel.json.
 */

import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { prisma } from "@/lib/db";
import { StatutVague } from "@/types";
import {
  buildEvaluationContext,
  evaluateRules,
  generateActivities,
} from "@/lib/activity-engine";
import { getOrCreateSystemUser } from "@/lib/queries/users";

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

export async function POST(request: NextRequest) {
  try {
    // ---- Verification du token CRON ----
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[CRON /api/activites/generer] CRON_SECRET non configure");
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

    // ---- Parsing du corps ----
    let targetSiteId: string | null = null;
    try {
      const body = await request.json().catch(() => ({}));
      if (body?.siteId && typeof body.siteId === "string") {
        targetSiteId = body.siteId;
      }
    } catch {
      // Corps absent ou invalide → traiter tous les sites
    }

    // ---- Trouver ou creer l'utilisateur systeme ----
    const systemUser = await getOrCreateSystemUser();
    const systemUserId = systemUser.id;

    // ---- Charger les sites cibles ----
    const sitesQuery = targetSiteId
      ? [{ id: targetSiteId, isActive: true }]
      : await prisma.site.findMany({
          where: { isActive: true },
          select: { id: true },
        });

    let totalCreated = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    for (const site of sitesQuery) {
      try {
        const siteResult = await runEngineForSite(
          site.id,
          systemUserId
        );
        totalCreated += siteResult.created;
        totalSkipped += siteResult.skipped;
        allErrors.push(...siteResult.errors);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        allErrors.push(`Site ${site.id} : ${msg}`);
        console.error(`[CRON] Erreur site ${site.id}:`, error);
      }
    }

    return NextResponse.json({
      status: 200,
      message: "Generation terminee.",
      stats: {
        sitesTraites: sitesQuery.length,
        activitesCrees: totalCreated,
        activitesSautees: totalSkipped,
        erreurs: allErrors.length,
      },
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (error) {
    console.error("[CRON /api/activites/generer] Erreur globale:", error);
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la generation." },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Logique par site
// ---------------------------------------------------------------------------

async function runEngineForSite(
  siteId: string,
  systemUserId: string
): Promise<{ created: number; skipped: number; errors: string[] }> {
  // ---- Charger les vagues actives ----
  const vaguesActives = await prisma.vague.findMany({
    where: { siteId, statut: StatutVague.EN_COURS },
    include: {
      releves: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          typeReleve: true,
          date: true,
          poidsMoyen: true,
          tailleMoyenne: true,
          nombreMorts: true,
          quantiteAliment: true,
          temperature: true,
          ph: true,
          oxygene: true,
          ammoniac: true,
          nombreCompte: true,
        },
      },
      configElevage: true,
    },
  });

  if (vaguesActives.length === 0) {
    return { created: 0, skipped: 0, errors: [] };
  }

  // ---- Charger le stock du site ----
  const produits = await prisma.produit.findMany({
    where: { siteId, isActive: true },
    select: {
      id: true,
      nom: true,
      categorie: true,
      unite: true,
      seuilAlerte: true,
      stockActuel: true,
    },
  });

  // ---- Charger les regles applicables ----
  // Regles du site + regles globales (siteId IS NULL)
  const regles = await prisma.regleActivite.findMany({
    where: {
      isActive: true,
      OR: [{ siteId }, { siteId: null }],
    },
  });

  if (regles.length === 0) {
    return { created: 0, skipped: 0, errors: [] };
  }

  // ---- Charger l'historique des activites recentes (30 derniers jours) ----
  const trenteDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const historique = await prisma.activite.findMany({
    where: {
      siteId,
      regleId: { not: null },
      createdAt: { gte: trenteDaysAgo },
    },
    select: {
      id: true,
      regleId: true,
      vagueId: true,
      dateDebut: true,
      createdAt: true,
    },
  });

  // Typer l'historique pour l'evaluateur
  const historiqueTyped = historique.map((a) => ({
    id: a.id,
    regleId: a.regleId,
    vagueId: a.vagueId,
    dateDebut: a.dateDebut,
    createdAt: a.createdAt,
  })) as Array<{
    id: string;
    regleId: string | null;
    vagueId: string | null;
    dateDebut: Date;
    createdAt: Date;
  }>;

  // ---- Construire les contextes ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contextes = vaguesActives.map((vague) =>
    buildEvaluationContext(
      {
        id: vague.id,
        code: vague.code,
        dateDebut: vague.dateDebut,
        nombreInitial: vague.nombreInitial,
        poidsMoyenInitial: vague.poidsMoyenInitial,
        siteId: vague.siteId,
      },
      // Cast required: Prisma generated enums and JSON types are structurally
      // identical to @/types but TypeScript treats them as distinct types.
      vague.releves as unknown as Parameters<typeof buildEvaluationContext>[1],
      produits as unknown as Parameters<typeof buildEvaluationContext>[2],
      (vague.configElevage ?? null) as unknown as Parameters<typeof buildEvaluationContext>[3]
    )
  );

  // ---- Evaluer les regles ----
  const matches = evaluateRules(
    contextes,
    regles as Parameters<typeof evaluateRules>[1],
    historiqueTyped as Parameters<typeof evaluateRules>[2]
  );

  if (matches.length === 0) {
    return { created: 0, skipped: 0, errors: [] };
  }

  // ---- Generer les activites ----
  // Utiliser la config du premier match comme config site (ou null)
  const firstConfigElevageRaw =
    vaguesActives.find((v) => v.configElevage)?.configElevage ?? null;

  // Cast necessaire : Prisma retourne JsonValue pour les champs alimentTailleConfig/alimentTauxConfig,
  // notre interface ConfigElevage attend AlimentTailleEntree[] / AlimentTauxEntree[].
  // Les structures sont identiques au runtime — le cast est sur.
  const firstConfigElevage = firstConfigElevageRaw as unknown as Parameters<typeof generateActivities>[3];

  return generateActivities(
    matches,
    siteId,
    systemUserId,
    firstConfigElevage
  );
}
