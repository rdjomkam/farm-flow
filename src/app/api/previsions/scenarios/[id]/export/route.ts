/**
 * GET /api/previsions/scenarios/[id]/export
 *
 * Génère et télécharge la projection complète d'un scénario de prévision,
 * au format Excel (.xlsx) ou PDF, selon `?format=excel|pdf`.
 * Permissions requises : PREVISIONS_VOIR + EXPORT_DONNEES
 *
 * `calculerProjectionScenario` (moteur pur, `decimal.js`) est appelé
 * directement — jamais un `fetch` vers `/api/previsions/scenarios/[id]/calculer`
 * — puis chaque `Decimal` est converti en `number` AVANT de construire le DTO
 * d'export, même règle que `previsions-scenario-detail-page.tsx` (`n()`).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { getScenarioById } from "@/lib/queries/previsions-scenarios";
import { getAlimentsPrevisionParScenario } from "@/lib/queries/previsions-aliments";
import { chargerScenarioPourMoteur } from "@/lib/queries/previsions-scenario-loader";
import { calculerProjectionScenario } from "@/lib/previsions/route-orchestration";
import { decimalToNumber } from "@/lib/previsions/decimal-io";
import { generatePrevisionExcel } from "@/lib/export/excel-previsions";
import { generatePrevisionPDF } from "@/lib/export/pdf-previsions";
import { renderPdfSafely } from "@/lib/export/render-pdf-safely";
import { Permission } from "@/types";
import type { Decimal } from "@/lib/previsions/decimal-config";
import type { CreatePrevisionExportDTO } from "@/types/export";

/** `decimal.js` (moteur) -> `number`, même règle que `n()` de la page detail. */
function n(value: Decimal): number {
  return value.toNumber();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requirePermission(
      request,
      Permission.PREVISIONS_VOIR,
      Permission.EXPORT_DONNEES
    );

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    if (format !== "excel" && format !== "pdf") {
      return NextResponse.json(
        { status: 400, message: "Paramètre 'format' invalide — attendu 'excel' ou 'pdf'." },
        { status: 400 }
      );
    }

    const siteId = auth.activeSiteId;

    const [scenario, aliments, site] = await Promise.all([
      getScenarioById(id, siteId),
      getAlimentsPrevisionParScenario(id, siteId),
      prisma.site.findUnique({ where: { id: siteId }, select: { name: true } }),
    ]);

    if (!scenario) {
      return NextResponse.json({ status: 404, message: "Scénario introuvable" }, { status: 404 });
    }
    if (!scenario.parametres) {
      return NextResponse.json(
        { status: 409, message: "Le scénario n'a pas de paramètres configurés." },
        { status: 409 }
      );
    }

    const scenarioPourCalcul = await chargerScenarioPourMoteur(id, siteId);
    const p = calculerProjectionScenario(scenarioPourCalcul);

    const dto: CreatePrevisionExportDTO = {
      scenario: {
        id: scenario.id,
        nom: scenario.nom,
        code: scenario.code,
        dateDebutPlan: scenario.dateDebutPlan.toISOString(),
        dureeCycleMois: scenario.dureeCycleMois,
        statut: scenario.statut,
      },
      parametres: {
        effectifAlevinsParVague: scenario.parametres.effectifAlevinsParVague,
        margeSecuriteAlevinsPct: decimalToNumber(scenario.parametres.margeSecuriteAlevinsPct),
        poidsMoyenInitialG: decimalToNumber(scenario.parametres.poidsMoyenInitialG),
        poidsObjectifG: decimalToNumber(scenario.parametres.poidsObjectifG),
        prixAlevinUnitaireFCFA: decimalToNumber(scenario.parametres.prixAlevinUnitaireFCFA),
        prixVenteKgFCFA: decimalToNumber(scenario.parametres.prixVenteKgFCFA),
        nombreBacsSimultanesCible: scenario.parametres.nombreBacsSimultanesCible,
        frequenceStockageMois: decimalToNumber(scenario.parametres.frequenceStockageMois),
        tauxEpargnePct: decimalToNumber(scenario.parametres.tauxEpargnePct),
        tresorerieInitialeFCFA: decimalToNumber(scenario.parametres.tresorerieInitialeFCFA),
      },
      aliments: aliments.map((a) => ({
        libelle: a.libelle,
        tailleGranule: a.tailleGranule,
        poidsSacKg: decimalToNumber(a.poidsSacKg),
        prixSacFCFA: decimalToNumber(a.prixSacFCFA),
      })),
      projection: {
        horizonMois: p.horizonMois,
        mois: p.mois.map((m) => ({
          moisAbsolu: m.moisAbsolu,
          revenusFCFA: n(m.revenusFCFA),
          coutAlimentsFCFA: n(m.coutAlimentsFCFA),
          coutAlevinsFCFA: n(m.coutAlevinsFCFA),
          baseRepartitionFCFA: n(m.baseRepartitionFCFA),
          investissementsFCFA: n(m.investissementsFCFA),
          depensesFCFA: n(m.depensesFCFA),
          apportsFCFA: n(m.apportsFCFA),
          resultatFCFA: n(m.resultatFCFA),
          epargneFCFA: n(m.epargneFCFA),
          soldeFCFA: n(m.soldeFCFA),
          empoissonneKg: n(m.empoissonneKg),
          ventesKg: n(m.ventesKg),
          alevinsACommanderNb: n(m.alevinsACommanderNb),
          besoinAlimentsTotalKg: n(m.besoinAlimentsTotalKg),
          sacsAlimentsTotal: m.sacsAlimentsTotal,
          sacsParGranulometrie: m.sacsParGranulometrie,
        })),
        budget: {
          totalCoutsProductionFCFA: n(p.budget.totalCoutsProductionFCFA),
          totalChargesHorsProductionFCFA: n(p.budget.totalChargesHorsProductionFCFA),
          totalApportsFCFA: n(p.budget.totalApportsFCFA),
          budgetTotalFCFA: n(p.budget.budgetTotalFCFA),
        },
        pointBas: p.pointBas
          ? { pointBasFCFA: n(p.pointBas.pointBasFCFA), moisAbsolu: p.pointBas.moisAbsolu }
          : null,
      },
      siteName: site?.name ?? "",
      exportDate: new Date().toISOString(),
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const nomFichier = scenario.code || scenario.nom || "scenario";

    if (format === "excel") {
      const buffer = await generatePrevisionExcel(dto);
      const uint8 = new Uint8Array(buffer);
      return new Response(uint8, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="previsions-${nomFichier}-${dateStr}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await renderPdfSafely(() => generatePrevisionPDF(dto), {
      context: {
        route: "GET /api/previsions/scenarios/[id]/export",
        documentType: "previsions",
        documentId: id,
      },
    });
    const uint8 = new Uint8Array(buffer);
    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="previsions-${nomFichier}-${dateStr}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(
      "GET /api/previsions/scenarios/[id]/export",
      error,
      "Erreur serveur lors de la génération de l'export des prévisions."
    );
  }
}
