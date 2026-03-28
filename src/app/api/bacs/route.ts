import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getBacs, getBacsLibres } from "@/lib/queries/bacs";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CreateBacDTO } from "@/types";
import { normaliseLimite, isQuotaAtteint } from "@/lib/abonnements/check-quotas";
import { getAbonnementActif } from "@/lib/queries/abonnements";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";
import type { QuotaRessource } from "@/lib/abonnements/check-quotas";
import { ErrorKeys } from "@/lib/api-error-keys";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.BACS_GERER);
    const { searchParams } = new URL(request.url);
    const libre = searchParams.get("libre") === "true";
    const bacs = libre
      ? await getBacsLibres(auth.activeSiteId).then((list) =>
          list.map((b) => ({
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
          }))
        )
      : await getBacs(auth.activeSiteId);
    return cachedJson({ bacs, total: bacs.length }, "medium");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des bacs.", errorKey: ErrorKeys.SERVER_GET_BACS },
      { status: 500 }
    );
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
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: CreateBacDTO = {
      nom: body.nom.trim(),
      volume: body.volume,
      ...(body.nombrePoissons != null && { nombrePoissons: body.nombrePoissons }),
    };

    // Vérifier le quota et créer le bac dans une transaction atomique (R4)
    const bac = await prisma.$transaction(async (tx) => {
      // 1. Charger l'abonnement actif pour déterminer la limite
      const abonnement = await getAbonnementActif(auth.activeSiteId);
      let limitesBacs: number;

      if (abonnement) {
        const typePlan = abonnement.plan.typePlan as string;
        const planLimites = (PLAN_LIMITES as Record<string, (typeof PLAN_LIMITES)[keyof typeof PLAN_LIMITES]>)[typePlan];
        limitesBacs = planLimites
          ? planLimites.limitesBacs
          : PLAN_LIMITES["DECOUVERTE" as keyof typeof PLAN_LIMITES].limitesBacs;
      } else {
        limitesBacs = PLAN_LIMITES["DECOUVERTE" as keyof typeof PLAN_LIMITES].limitesBacs;
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
      return NextResponse.json(
        {
          status: 402,
          error: "QUOTA_DEPASSE",
          ressource: "bacs",
          limite: bac.limite,
          message: `Vous avez atteint la limite de ${bac.limite} bac(s) autorisé(s) par votre plan. Passez à un plan supérieur pour en créer davantage.`,
        },
        { status: 402 }
      );
    }

    return NextResponse.json(bac, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du bac.", errorKey: ErrorKeys.SERVER_CREATE_BAC },
      { status: 500 }
    );
  }
}
