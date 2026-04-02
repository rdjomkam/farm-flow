import { NextRequest, NextResponse } from "next/server";
import {
  getListeBesoins,
  createListeBesoins,
} from "@/lib/queries/besoins";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutBesoins, parsePaginationQuery } from "@/types";
import type { CreateListeBesoinsDTO, ListeBesoinsFilters, VagueRatioDTO } from "@/types";

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

    const filters: ListeBesoinsFilters = {};

    const statut = searchParams.get("statut");
    if (statut && VALID_STATUTS.includes(statut as StatutBesoins)) {
      filters.statut = statut as StatutBesoins;
    }

    const demandeurId = searchParams.get("demandeurId");
    if (demandeurId) filters.demandeurId = demandeurId;

    const vagueId = searchParams.get("vagueId");
    if (vagueId) filters.vagueId = vagueId;

    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = dateFrom;

    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = dateTo;

    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    const { data, total } = await getListeBesoins(auth.activeSiteId, filters, { limit, offset });

    return NextResponse.json({ data, total, limit, offset });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la recuperation des listes de besoins.",
      },
      { status: 500 }
    );
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
          l: { designation?: unknown; quantite?: unknown; prixEstime?: unknown },
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
      lignes: body.lignes.map((l: {
        designation: string;
        produitId?: string;
        quantite: number;
        unite?: string;
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
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json(
      {
        status: 500,
        message: `Erreur serveur lors de la creation de la liste de besoins : ${message}`,
      },
      { status: 500 }
    );
  }
}
