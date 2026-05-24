/**
 * GET /api/export/vague/[id]
 *
 * Génère et télécharge le rapport de vague en PDF.
 * Permissions requises : VAGUES_VOIR + EXPORT_DONNEES
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-utils";
import { getVagueById } from "@/lib/queries/vagues";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { getCoutProductionVague } from "@/lib/queries/finances";
import {
  buildEvolutionPoidsTable,
  buildEvolutionPoidsMoyenTable,
  buildMortalitySummary,
  buildFeedingSummary,
  buildWaterQualitySummary,
  buildGompertzSection,
} from "@/lib/export/pdf-rapport-vague-helpers";
import type { RawReleve, BacInfo } from "@/lib/export/pdf-rapport-vague-helpers";
import { renderRapportVaguePDF } from "@/lib/export/pdf-rapport-vague";
import { Permission, TypeReleve, StatutVague, CauseMortalite, TypeMouvement } from "@/types";
import type { CreateRapportVaguePDFDTO, ReleveRapportPDF, StockConsumptionPDFRow } from "@/types/export";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(
      request,
      Permission.VAGUES_VOIR,
      Permission.EXPORT_DONNEES
    );

    const { id } = await params;

    // Récupérer la vague + relevés + données enrichies en parallèle
    const [
      vague,
      allReleves,
      indicateurs,
      site,
      calibragesDb,
      assignationsDb,
      gompertzRecord,
      configElevageData,
      mouvementsStock,
    ] = await Promise.all([
      getVagueById(id, auth.activeSiteId),
      prisma.releve.findMany({
        where: { vagueId: id, siteId: auth.activeSiteId },
        orderBy: { date: "asc" },
      }),
      getIndicateursVague(auth.activeSiteId, id),
      prisma.site.findUnique({
        where: { id: auth.activeSiteId },
        select: { name: true, address: true },
      }),
      // Calibrages for this vague
      prisma.calibrage.findMany({
        where: { vagueId: id, siteId: auth.activeSiteId },
        include: {
          groupes: {
            include: { destinationBac: { select: { nom: true } } },
          },
        },
        orderBy: { date: "asc" },
      }),
      // Bac assignment timeline
      prisma.assignationBac.findMany({
        where: { vagueId: id, siteId: auth.activeSiteId },
        include: { bac: { select: { nom: true, volume: true } } },
        orderBy: { dateAssignation: "asc" },
      }),
      // Gompertz growth model
      prisma.gompertzVague.findFirst({
        where: { vagueId: id, siteId: auth.activeSiteId },
      }),
      // ConfigElevage for target weight (via vague's configElevageId)
      prisma.vague.findUnique({
        where: { id },
        select: { configElevageId: true },
      }).then(async (v) => {
        if (!v?.configElevageId) return null;
        return prisma.configElevage.findUnique({
          where: { id: v.configElevageId },
          select: { poidsObjectif: true },
        });
      }),
      // Stock consumption (SORTIE movements for this vague)
      prisma.mouvementStock.findMany({
        where: { vagueId: id, siteId: auth.activeSiteId, type: TypeMouvement.SORTIE },
        include: { produit: { select: { nom: true, categorie: true, unite: true } } },
      }),
    ]);

    if (!vague) {
      return NextResponse.json(
        { status: 404, message: "Vague introuvable" },
        { status: 404 }
      );
    }

    if (!site) {
      return NextResponse.json(
        { status: 404, message: "Site introuvable" },
        { status: 404 }
      );
    }

    // Conditional cost of production fetch (requires FINANCES_VOIR permission)
    const hasFinancesPermission = auth.permissions.includes(Permission.FINANCES_VOIR);
    let coutProductionSection = null;
    if (hasFinancesPermission) {
      try {
        coutProductionSection = await getCoutProductionVague(id, auth.activeSiteId);
      } catch {
        // Cost computation may fail — section simply omitted
      }
    }

    // Locale from cookie (fallback: "fr")
    const locale = request.cookies.get("NEXT_LOCALE")?.value ?? "fr";

    // Build aggregated sections using helpers
    const rawReleves = allReleves as unknown as RawReleve[];

    // Bac name map for per-bac weight table
    const bacNameMap = new Map<string, string>();
    for (const b of vague.bacs) bacNameMap.set(b.id, b.nom);

    // BacInfo for weighted average computation
    const bacInfos: BacInfo[] = vague.bacs.map((b) => ({
      id: b.id,
      nom: b.nom,
      nombreInitial: b.nombreInitial ?? null,
    }));

    const evolutionPoidsTable = buildEvolutionPoidsTable(rawReleves, vague.dateDebut, bacNameMap);
    const calibrageMorts = calibragesDb.reduce((sum, c) => sum + (c.nombreMorts ?? 0), 0);
    const mortalitySummary = buildMortalitySummary(rawReleves, vague.nombreInitial, calibrageMorts);
    const feedingSummary = buildFeedingSummary(rawReleves);
    const waterQualitySummary = buildWaterQualitySummary(rawReleves);
    const targetWeight = configElevageData?.poidsObjectif ?? null;

    const gompertzRec = gompertzRecord
      ? {
          wInfinity: gompertzRecord.wInfinity,
          k: gompertzRecord.k,
          ti: gompertzRecord.ti,
          r2: gompertzRecord.r2,
          rmse: gompertzRecord.rmse,
          confidenceLevel: gompertzRecord.confidenceLevel,
        }
      : null;

    const gompertzSection = buildGompertzSection(gompertzRec, vague.dateDebut, targetWeight);

    const evolutionPoidsMoyen = buildEvolutionPoidsMoyenTable(
      rawReleves,
      bacInfos,
      vague.nombreInitial,
      vague.dateDebut,
      gompertzRec
    );

    // Map calibrages
    const calibrageHistory = calibragesDb.map((c) => ({
      date: c.date,
      groupes: c.groupes.map((g) => ({
        categorie: g.categorie,
        nombrePoissons: g.nombrePoissons,
        poidsMoyen: g.poidsMoyen,
      })),
      totalRedistribue: c.groupes.reduce((sum, g) => sum + g.nombrePoissons, 0),
      nombreMorts: c.nombreMorts,
    }));

    // Map assignations with mortality and current count per bac
    const mortalitesParBac = new Map<string, number>();
    for (const r of allReleves) {
      if (r.typeReleve === TypeReleve.MORTALITE && r.bacId) {
        mortalitesParBac.set(r.bacId, (mortalitesParBac.get(r.bacId) ?? 0) + (r.nombreMorts ?? 0));
      }
    }

    const assignationTimeline = assignationsDb.map((a) => {
      const bacId = vague.bacs.find((b) => b.nom === a.bac.nom)?.id;
      const mortalites = bacId ? (mortalitesParBac.get(bacId) ?? 0) : 0;
      const initial = a.nombreActuel ?? 0;
      return {
        nomBac: a.bac.nom,
        dateAssignation: a.dateAssignation,
        dateFin: a.dateFin,
        volume: a.bac.volume,
        nombrePoissons: a.nombreActuel,
        nombrePoissonsCourant: initial > 0 ? initial - mortalites : null,
        mortalites,
      };
    });

    // Aggregate stock consumption
    const stockMap = new Map<string, StockConsumptionPDFRow>();
    for (const m of mouvementsStock) {
      const key = m.produitId;
      const existing = stockMap.get(key);
      if (existing) {
        existing.quantite += m.quantite;
        existing.prixTotal = (existing.prixTotal ?? 0) + (m.prixTotal ?? 0);
      } else {
        stockMap.set(key, {
          nomProduit: m.produit.nom,
          categorie: m.produit.categorie,
          quantite: m.quantite,
          unite: m.produit.unite,
          prixTotal: hasFinancesPermission ? m.prixTotal : null,
        });
      }
    }
    const stockConsumption = Array.from(stockMap.values());

    // Construire les relevés pour le rapport
    const releves: ReleveRapportPDF[] = allReleves.map((r) => ({
      date: r.date,
      typeReleve: r.typeReleve as TypeReleve,
      nomBac:
        vague.bacs.find((b) => b.id === r.bacId)?.nom ?? "—",
      poidsMoyen: r.poidsMoyen,
      tailleMoyenne: r.tailleMoyenne,
      nombreMorts: r.nombreMorts,
      causeMortalite: r.causeMortalite as CauseMortalite | null,
      quantiteAliment: r.quantiteAliment,
      temperature: r.temperature,
      ph: r.ph,
      nombreCompte: r.nombreCompte,
      notes: r.notes,
    }));

    // Points d'évolution du poids (biométrie uniquement)
    const evolutionPoids = allReleves
      .filter((r) => r.typeReleve === TypeReleve.BIOMETRIE && r.poidsMoyen !== null)
      .map((r) => ({
        date: r.date,
        poidsMoyen: r.poidsMoyen as number,
      }));

    // Construire le DTO
    const dto: CreateRapportVaguePDFDTO = {
      site: {
        name: site.name,
        address: site.address ?? null,
      },
      code: vague.code,
      dateDebut: vague.dateDebut,
      dateFin: vague.dateFin,
      statut: vague.statut as StatutVague,
      nombreInitial: vague.nombreInitial,
      poidsMoyenInitial: vague.poidsMoyenInitial,
      origineAlevins: vague.origineAlevins,
      kpis: {
        tauxSurvie: indicateurs?.tauxSurvie ?? 100,
        fcr: indicateurs?.fcr ?? null,
        sgr: indicateurs?.sgr ?? null,
        biomasseTotale: indicateurs?.biomasse ?? null,
        poidsMoyenFinal: indicateurs?.poidsMoyen ?? null,
        nombreActuel: indicateurs?.nombreVivants ?? vague.nombreInitial,
      },
      bacs: vague.bacs.map((b) => ({
        nom: b.nom,
        volume: b.volume,
        nombrePoissons: b.nombrePoissons,
      })),
      releves: releves.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
      evolutionPoids,
      // Sections enrichies
      coutProduction: coutProductionSection,
      evolutionPoidsTable,
      evolutionPoidsMoyen,
      gompertz: gompertzSection,
      locale,
      calibrageHistory,
      assignationTimeline,
      mortalitySummary,
      feedingSummary,
      waterQualitySummary,
      stockConsumption,
      salesSummary: {
        ventes: coutProductionSection?.ventes.map((v) => ({
          numero: "",
          clientNom: v.client,
          date: new Date(v.date),
          quantitePoissons: 0,
          poidsTotalKg: v.poidsKg,
          prixUnitaireKg: v.prixKg ?? 0,
          montantTotal: v.montant,
          statut: "LIVREE",
        })) ?? [],
        totalPoidsKg: coutProductionSection?.resume.poidsTotalVendu ?? 0,
        totalMontant: coutProductionSection?.resume.revenus ?? 0,
        totalPoissonsVendus: coutProductionSection?.resume.nombrePoissonsVendus ?? 0,
        poidsObjectifKg: vague.poidsObjectifKg ?? null,
      },
    };

    // Générer le PDF (renderRapportVaguePDF utilise JSX natif dans le fichier .tsx)
    const buffer = await renderRapportVaguePDF(dto);
    const uint8 = new Uint8Array(buffer);

    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapport-vague-${vague.code}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError("GET /api/export/vague/[id]", error, "Erreur serveur lors de la generation du rapport de vague.");
  }
}
