import { NextRequest, NextResponse } from "next/server";
import {
  getListeBesoins,
  createListeBesoins,
  getBesoinsForCommandeSelector,
} from "@/lib/queries/besoins";
import { apiError, handleApiError } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutBesoins, UniteBesoin, parsePaginationQuery } from "@/types";
import type { CreateListeBesoinsDTO, ListeBesoinsFilters, VagueRatioDTO } from "@/types";

const VALID_UNITES = Object.values(UniteBesoin);

const VALID_STATUTS = Object.values(StatutBesoins);

/**
 * GET /api/besoins
 * Liste les listes de besoins du site actif.
 *
 * Query params : statut, demandeurId, vagueId, dateFrom, dateTo
 * Permission : BESOINS_SOUMETTRE (ses propres) ou BESOINS_APPROUVER (tous)
 */
export async function GET(request: NextRequest) {
  try {
    // BESOINS_SOUMETTRE permet de voir ses propres besoins,
    // BESOINS_APPROUVER permet de voir tous les besoins.
    // On autorise les deux — le filtre demandeurId sera applique cote client si besoin.
    const auth = await requirePermission(
      request,
      Permission.BESOINS_SOUMETTRE
    );
    const { searchParams } = new URL(request.url);

    // Lightweight selector for order creation dialog
    if (searchParams.get("forSelector") === "true") {
      const data = await getBesoinsForCommandeSelector(auth.activeSiteId);
      return NextResponse.json({ data });
    }

    const filters: ListeBesoinsFilters = {};

    const statut = searchParams.get("statut");
    if (statut) {
      const parts = statut.split(",").filter((s) => VALID_STATUTS.includes(s as StatutBesoins)) as StatutBesoins[];
      if (parts.length === 1) filters.statut = parts[0];
      else if (parts.length > 1) filters.statut = parts;
    }

    const demandeurId = searchParams.get("demandeurId");
    if (demandeurId) {
      const parts = demandeurId.split(",").filter(Boolean);
      filters.demandeurId = parts.length === 1 ? parts[0] : parts;
    }

    const vagueId = searchParams.get("vagueId");
    if (vagueId) {
      const parts = vagueId.split(",").filter(Boolean);
      filters.vagueId = parts.length === 1 ? parts[0] : parts;
    }

    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;

    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;

    const valideurId = searchParams.get("valideurId");
    if (valideurId) {
      const parts = valideurId.split(",").filter(Boolean);
      filters.valideurId = parts.length === 1 ? parts[0] : parts;
    }

    const dateLimiteFrom = searchParams.get("dateLimiteFrom");
    if (dateLimiteFrom) filters.dateLimiteFrom = dateLimiteFrom;

    const dateLimiteTo = searchParams.get("dateLimiteTo");
    if (dateLimiteTo) filters.dateLimiteTo = dateLimiteTo;

    const montantEstimeMinRaw = searchParams.get("montantEstimeMin");
    if (montantEstimeMinRaw !== null) {
      const parsed = parseFloat(montantEstimeMinRaw);
      if (isFinite(parsed)) filters.montantEstimeMin = parsed;
    }

    const montantEstimeMaxRaw = searchParams.get("montantEstimeMax");
    if (montantEstimeMaxRaw !== null) {
      const parsed = parseFloat(montantEstimeMaxRaw);
      if (isFinite(parsed)) filters.montantEstimeMax = parsed;
    }

    const search = searchParams.get("search");
    if (search) filters.search = search.trim();

    const hasCommandeRaw = searchParams.get("hasCommande");
    if (hasCommandeRaw === "true") filters.hasCommande = true;

    const produitId = searchParams.get("produitId");
    if (produitId) {
      const parts = produitId.split(",").filter(Boolean);
      filters.produitId = parts.length === 1 ? parts[0] : parts;
    }

    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    const { data, total } = await getListeBesoins(auth.activeSiteId, filters, { limit, offset });

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    return handleApiError("GET /api/besoins", error, "Erreur serveur lors de la recuperation des listes de besoins.");
  }
}

/**
 * POST /api/besoins
 * Cree une nouvelle liste de besoins.
 *
 * Permission : BESOINS_SOUMETTRE
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(
      request,
      Permission.BESOINS_SOUMETTRE
    );

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.titre || typeof body.titre !== "string") {
      errors.push({
        field: "titre",
        message: "Le titre est obligatoire.",
      });
    }

    if (!Array.isArray(body.lignes) || body.lignes.length === 0) {
      errors.push({
        field: "lignes",
        message: "La liste doit contenir au moins une ligne de besoin.",
      });
    } else {
      body.lignes.forEach(
        (
          l: { designation?: unknown; quantite?: unknown; prixEstime?: unknown; unite?: unknown },
          i: number
        ) => {
          if (!l.designation || typeof l.designation !== "string") {
            errors.push({
              field: `lignes[${i}].designation`,
              message: `La designation de la ligne ${i + 1} est obligatoire.`,
            });
          }
          if (
            l.quantite === undefined ||
            typeof l.quantite !== "number" ||
            l.quantite <= 0
          ) {
            errors.push({
              field: `lignes[${i}].quantite`,
              message: `La quantite de la ligne ${i + 1} doit etre un nombre positif.`,
            });
          }
          if (l.prixEstime === undefined || typeof l.prixEstime !== "number" || (l.prixEstime as number) < 0) {
            errors.push({
              field: `lignes[${i}].prixEstime`,
              message: `Le prix estime de la ligne ${i + 1} doit etre un nombre positif ou zero.`,
            });
          }
          if (l.unite !== undefined && l.unite !== null && !VALID_UNITES.includes(l.unite as UniteBesoin)) {
            errors.push({
              field: `lignes[${i}].unite`,
              message: `L'unite de la ligne ${i + 1} est invalide. Valeurs autorisees : ${VALID_UNITES.join(", ")}.`,
            });
          }
        }
      );
    }

    // Validation vagues (optionnel)
    let vagues: VagueRatioDTO[] | undefined;
    if (body.vagues != null) {
      if (!Array.isArray(body.vagues)) {
        errors.push({ field: "vagues", message: "Le champ vagues doit etre un tableau." });
      } else {
        const vaguesArr = body.vagues as Array<{ vagueId?: unknown; ratio?: unknown }>;
        for (let i = 0; i < vaguesArr.length; i++) {
          const v = vaguesArr[i];
          if (!v.vagueId || typeof v.vagueId !== "string") {
            errors.push({ field: `vagues[${i}].vagueId`, message: `vagueId requis pour l'entree vague ${i + 1}.` });
          }
          if (v.ratio === undefined || typeof v.ratio !== "number" || (v.ratio as number) <= 0 || (v.ratio as number) > 1) {
            errors.push({ field: `vagues[${i}].ratio`, message: `Ratio invalide pour la vague ${i + 1} (doit etre > 0 et <= 1).` });
          }
        }
        if (vaguesArr.length > 0) {
          const vagueIds = vaguesArr.map((v) => v.vagueId);
          if (new Set(vagueIds).size !== vagueIds.length) {
            errors.push({ field: "vagues", message: "Chaque vague ne peut apparaitre qu'une seule fois." });
          }
          const somme = vaguesArr.reduce((acc, v) => acc + (typeof v.ratio === "number" ? v.ratio : 0), 0);
          if (Math.abs(somme - 1.0) > 0.001) {
            errors.push({ field: "vagues", message: `La somme des ratios doit etre egale a 1.0 (somme actuelle : ${somme.toFixed(3)}).` });
          }
        }
        vagues = vaguesArr as VagueRatioDTO[];
      }
    }

    // Validation uniteProductionId (optionnel)
    let uniteProductionId: string | undefined;
    if (body.uniteProductionId != null && body.uniteProductionId !== "") {
      if (typeof body.uniteProductionId !== "string") {
        errors.push({ field: "uniteProductionId", message: "L'identifiant de l'unite de production doit etre une chaine." });
      } else {
        // Verify it belongs to the site
        const { prisma: db } = await import("@/lib/db");
        const unite = await db.uniteProduction.findFirst({
          where: { id: body.uniteProductionId, siteId: auth.activeSiteId },
          select: { id: true },
        });
        if (!unite) {
          errors.push({ field: "uniteProductionId", message: "Unite de production introuvable ou non accessible." });
        } else {
          uniteProductionId = body.uniteProductionId;
        }
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // Validation dateLimite optionnelle
    let dateLimite: string | undefined;
    if (body.dateLimite != null) {
      const parsed = new Date(body.dateLimite);
      if (isNaN(parsed.getTime())) {
        return apiError(400, "Date limite invalide (format ISO 8601 attendu).");
      }
      dateLimite = parsed.toISOString();
    }

    const data: CreateListeBesoinsDTO = {
      titre: body.titre.trim(),
      vagues: vagues && vagues.length > 0 ? vagues : undefined,
      notes: body.notes?.trim() || undefined,
      uniteProductionId: uniteProductionId,
      lignes: body.lignes.map((l: {
        designation: string;
        produitId?: string;
        quantite: number;
        unite?: UniteBesoin;
        prixEstime: number;
      }) => ({
        designation: l.designation.trim(),
        produitId: l.produitId || undefined,
        quantite: l.quantite,
        unite: l.unite || undefined,
        prixEstime: l.prixEstime,
      })),
      ...(dateLimite && { dateLimite }),
    };

    const listeBesoins = await createListeBesoins(
      auth.activeSiteId,
      auth.userId,
      data
    );
    return NextResponse.json(listeBesoins, { status: 201 });
  } catch (error) {
    return handleApiError("POST /api/besoins", error, "Erreur serveur lors de la creation de la liste de besoins.");
  }
}
