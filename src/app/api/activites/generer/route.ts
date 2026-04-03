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
import { runEngineForSite } from "@/lib/activity-engine";
import { runEngineerAlerts } from "@/lib/activity-engine/engineer-alerts";
import { getOrCreateSystemUser } from "@/lib/queries/users";
import { runLifecycle } from "@/lib/queries/lifecycle";
import { genererDepensesRecurrentes } from "@/lib/queries/depenses-recurrentes";
import { apiError } from "@/lib/api-utils";

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
      return apiError(500, "Configuration serveur manquante.");
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") ?? "";
    if (!timingSafeTokenEqual(token, cronSecret)) {
      return apiError(401, "Token CRON invalide.");
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

    // Compteurs pour les alertes ingenieur
    let totalAlertesCreees = 0;
    let totalAlertesSautees = 0;

    // Compteurs pour les depenses recurrentes
    let totalDepensesGenerees = 0;

    // Compteurs pour le lifecycle
    let totalExpirationsPackActivation = 0;
    let totalSuspensionsPackActivation = 0;
    let totalActivitesArchivees = 0;

    for (const site of sitesQuery) {
      try {
        // ---- Generer les activites planifiees ----
        const siteResult = await runEngineForSite(
          site.id,
          systemUserId
        );
        totalCreated += siteResult.created;
        totalSkipped += siteResult.skipped;
        allErrors.push(...siteResult.errors);

        // ---- Generer les alertes ingenieur pour ce site ----
        try {
          const alertesResult = await runEngineerAlerts(site.id, systemUserId);
          totalAlertesCreees += alertesResult.alertesCreees;
          totalAlertesSautees += alertesResult.alertesSautees;
          allErrors.push(...alertesResult.errors);
        } catch (alertError) {
          const msg = alertError instanceof Error ? alertError.message : String(alertError);
          allErrors.push(`[Alertes ingenieur] Site ${site.id} : ${msg}`);
          console.error(`[CRON] Erreur alertes ingenieur site ${site.id}:`, alertError);
        }

        // ---- Generer les depenses recurrentes pour ce site ----
        try {
          const depensesResult = await genererDepensesRecurrentes(site.id, systemUserId);
          totalDepensesGenerees += depensesResult.length;
        } catch (depenseError) {
          const msg = depenseError instanceof Error ? depenseError.message : String(depenseError);
          allErrors.push(`[Depenses recurrentes] Site ${site.id} : ${msg}`);
          console.error(`[CRON] Erreur depenses recurrentes site ${site.id}:`, depenseError);
        }

        // ---- Lifecycle PackActivation + archivage activites ----
        try {
          const lifecycleResult = await runLifecycle(site.id);
          totalExpirationsPackActivation += lifecycleResult.expirationsPackActivation;
          totalSuspensionsPackActivation += lifecycleResult.suspensionsPackActivation;
          totalActivitesArchivees += lifecycleResult.activitesArchivees;
          allErrors.push(...lifecycleResult.errors);
        } catch (lifecycleError) {
          const msg = lifecycleError instanceof Error ? lifecycleError.message : String(lifecycleError);
          allErrors.push(`[Lifecycle] Site ${site.id} : ${msg}`);
          console.error(`[CRON] Erreur lifecycle site ${site.id}:`, lifecycleError);
        }
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
        alertesIngenieurCreees: totalAlertesCreees,
        alertesIngenieurSautees: totalAlertesSautees,
        depensesRecurrentesGenerees: totalDepensesGenerees,
        lifecycle: {
          expirationsPackActivation: totalExpirationsPackActivation,
          suspensionsPackActivation: totalSuspensionsPackActivation,
          activitesArchivees: totalActivitesArchivees,
        },
        erreurs: allErrors.length,
      },
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (error) {
    console.error("[CRON /api/activites/generer] Erreur globale:", error);
    return apiError(500, "Erreur serveur lors de la generation.");
  }
}

