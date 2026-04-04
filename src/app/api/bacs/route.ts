import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getBacs, getBacsLibres } from "@/lib/queries/bacs";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, TypePlan, parsePaginationQuery } from "@/types";
import type { CreateBacDTO } from "@/types";
import { normaliseLimite, isQuotaAtteint } from "@/lib/abonnements/check-quotas";
import { getAbonnementActifPourSite } from "@/lib/queries/abonnements";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";
import type { QuotaRessource } from "@/lib/abonnements/check-quotas";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.BACS_GERER);
    const { searchParams } = new URL(request.url);
    const libre = searchParams.get("libre") === "true";

    // Pagination
    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    let data: ReturnType<typeof Array.prototype.map>;
    let total: number;

    if (libre) {
      const list = await getBacsLibres(auth.activeSiteId);
      const mapped = list.map((b) => ({
        id: b.id,
        nom: b.nom,
        volume: b.volume,
        nombrePoissons: b.nombrePoissons,
        nombreInitial: b.nombreInitial,
        poidsMoyenInitial: b.poidsMoyenInitial,
        typeSysteme: b.typeSysteme ?? null,
        vagueId: b.vagueId,
        siteId: b.siteId,
        vagueCode: null,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }));
      // Apply pagination manually for libre (small list, no DB-level pagination needed here)
      total = mapped.length;
      data = mapped.slice(offset, offset + limit);
    } else {
      const result = await getBacs(auth.activeSiteId, { limit, offset });
      data = result.data;
      total = result.total;
    }

    return cachedJson({ data, total, limit, offset }, "medium");
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des bacs.", { code: ErrorKeys.SERVER_GET_BACS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.BACS_GERER);
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    if (!body.nom || typeof body.nom !== "string" || body.nom.trim() === "") {
      errors.push({ field: "nom", message: "Le champ 'nom' est obligatoire." });
    }

    if (body.volume == null || typeof body.volume !== "number" || body.volume <= 0) {
      errors.push({
        field: "volume",
        message: "Le volume doit etre un nombre superieur a 0.",
      });
    }

    if (
      body.nombrePoissons != null &&
      (typeof body.nombrePoissons !== "number" || body.nombrePoissons < 0)
    ) {
      errors.push({
        field: "nombrePoissons",
        message: "Le nombre de poissons doit etre un nombre positif ou nul.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreateBacDTO = {
      nom: body.nom.trim(),
      volume: body.volume,
      ...(body.nombrePoissons != null && { nombrePoissons: body.nombrePoissons }),
    };

    // Vérifier le quota et créer le bac dans une transaction atomique (R4)
    const bac = await prisma.$transaction(async (tx) => {
      // 1. Charger l'abonnement actif pour déterminer la limite
      const abonnement = await getAbonnementActifPourSite(auth.activeSiteId);
      let limitesBacs: number;

      if (abonnement) {
        const planLimites = PLAN_LIMITES[abonnement.plan.typePlan as TypePlan];
        limitesBacs = planLimites
          ? planLimites.limitesBacs
          : PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs;
      } else {
        limitesBacs = PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs;
      }

      // 2. Compter les bacs existants (dans la transaction pour éviter la race condition)
      const nombreBacs = await tx.bac.count({ where: { siteId: auth.activeSiteId } });

      const quotaBacs: QuotaRessource = {
        actuel: nombreBacs,
        limite: normaliseLimite(limitesBacs),
      };

      // 3. Vérifier le quota
      if (isQuotaAtteint(quotaBacs)) {
        const err = new Error("QUOTA_DEPASSE");
        (err as Error & { quotaLimite: number | null }).quotaLimite = quotaBacs.limite;
        throw err;
      }

      // 4. Créer le bac
      return tx.bac.create({
        data: {
          nom: data.nom,
          volume: data.volume,
          nombrePoissons: data.nombrePoissons ?? null,
          siteId: auth.activeSiteId,
        },
      });
    }).catch((err: Error & { quotaLimite?: number | null }) => {
      if (err.message === "QUOTA_DEPASSE") {
        return { __quotaError: true, limite: err.quotaLimite } as const;
      }
      throw err;
    });

    if ("__quotaError" in bac && bac.__quotaError) {
      return apiError(
        402,
        `Vous avez atteint la limite de ${bac.limite} bac(s) autorisé(s) par votre plan. Passez à un plan supérieur pour en créer davantage.`,
        { code: "QUOTA_DEPASSE" }
      );
    }

    return NextResponse.json(bac, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la creation du bac.", { code: ErrorKeys.SERVER_CREATE_BAC });
  }
}
