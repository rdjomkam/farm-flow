import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getVagues, createVague } from "@/lib/queries/vagues";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutVague, parsePaginationQuery } from "@/types";
import type { CreateVagueDTO } from "@/types";
import { normaliseLimite, isQuotaAtteint } from "@/lib/abonnements/check-quotas";
import { getAbonnementActif } from "@/lib/queries/abonnements";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";
import type { QuotaRessource } from "@/lib/abonnements/check-quotas";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError } from "@/lib/api-utils";
import { checkPlatformMaintenance } from "@/lib/feature-flags";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { searchParams } = new URL(request.url);
    const statut = searchParams.get("statut");

    // Pagination
    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    const { data: vaguesRaw, total } = await getVagues(
      auth.activeSiteId,
      statut ? { statut } : undefined,
      { limit, offset }
    );

    const data = vaguesRaw.map((v) => {
      const now = v.dateFin ?? new Date();
      const joursEcoules = Math.floor(
        (now.getTime() - v.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: v.id,
        code: v.code,
        dateDebut: v.dateDebut,
        dateFin: v.dateFin,
        statut: v.statut,
        nombreInitial: v.nombreInitial,
        poidsMoyenInitial: v.poidsMoyenInitial,
        origineAlevins: v.origineAlevins,
        nombreBacs: v._count.bacs,
        joursEcoules,
        createdAt: v.createdAt,
      };
    });

    return cachedJson({ data, total, limit, offset }, "medium");
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[API GET /vagues]", error);
    return apiError(500, "Erreur serveur lors de la recuperation des vagues.", { code: ErrorKeys.SERVER_GET_VAGUES });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_CREER);

    // Guard maintenance — super-admin (Role.ADMIN) bypasse le blocage
    const maintenanceResponse = await checkPlatformMaintenance(auth.globalRole === "ADMIN");
    if (maintenanceResponse) return maintenanceResponse;

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.code || typeof body.code !== "string" || body.code.trim() === "") {
      errors.push({ field: "code", message: "Le champ 'code' est obligatoire." });
    }

    if (!body.dateDebut || typeof body.dateDebut !== "string") {
      errors.push({
        field: "dateDebut",
        message: "La date de debut est obligatoire (format ISO 8601).",
      });
    } else if (isNaN(Date.parse(body.dateDebut))) {
      errors.push({
        field: "dateDebut",
        message: "La date de debut n'est pas une date valide.",
      });
    }

    if (
      body.nombreInitial == null ||
      typeof body.nombreInitial !== "number" ||
      !Number.isInteger(body.nombreInitial) ||
      body.nombreInitial <= 0
    ) {
      errors.push({
        field: "nombreInitial",
        message: "Le nombre initial doit etre un entier superieur a 0.",
      });
    }

    if (
      body.poidsMoyenInitial == null ||
      typeof body.poidsMoyenInitial !== "number" ||
      body.poidsMoyenInitial <= 0
    ) {
      errors.push({
        field: "poidsMoyenInitial",
        message: "Le poids moyen initial doit etre un nombre superieur a 0.",
      });
    }

    if (!body.configElevageId || typeof body.configElevageId !== "string") {
      errors.push({
        field: "configElevageId",
        message: "La configuration d'elevage est obligatoire.",
      });
    }

    if (!Array.isArray(body.bacDistribution) || body.bacDistribution.length === 0) {
      errors.push({
        field: "bacDistribution",
        message: "Au moins un bac doit etre selectionne avec sa distribution d'alevins.",
      });
    } else {
      // Valider chaque entree de la distribution
      for (let i = 0; i < body.bacDistribution.length; i++) {
        const entry = body.bacDistribution[i];
        if (!entry || typeof entry.bacId !== "string" || entry.bacId.trim() === "") {
          errors.push({
            field: `bacDistribution[${i}].bacId`,
            message: `L'entree ${i + 1} doit avoir un bacId valide.`,
          });
        }
        if (
          entry == null ||
          typeof entry.nombrePoissons !== "number" ||
          !Number.isInteger(entry.nombrePoissons) ||
          entry.nombrePoissons <= 0
        ) {
          errors.push({
            field: `bacDistribution[${i}].nombrePoissons`,
            message: `L'entree ${i + 1} doit avoir un nombrePoissons entier superieur a 0.`,
          });
        }
      }

      // Valider que la somme des nombrePoissons correspond au nombreInitial
      if (errors.length === 0 && body.nombreInitial != null) {
        const somme = (body.bacDistribution as Array<{ nombrePoissons: number }>).reduce(
          (acc, e) => acc + e.nombrePoissons,
          0
        );
        if (somme !== body.nombreInitial) {
          errors.push({
            field: "bacDistribution",
            message: `La somme des poissons par bac (${somme}) doit etre egale au nombre initial (${body.nombreInitial}).`,
          });
        }
      }
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreateVagueDTO = {
      code: body.code.trim(),
      dateDebut: body.dateDebut,
      nombreInitial: body.nombreInitial,
      poidsMoyenInitial: body.poidsMoyenInitial,
      origineAlevins: body.origineAlevins ?? undefined,
      configElevageId: body.configElevageId,
      bacDistribution: body.bacDistribution,
    };

    // Vérifier le quota et créer la vague dans une transaction atomique (R4)
    // Note : createVague utilise déjà prisma.$transaction en interne pour les bacs,
    // mais le check quota doit aussi être atomique avec la création.
    // On effectue le check dans une transaction séparée avant d'appeler createVague.
    const quotaResult = await prisma.$transaction(async (tx) => {
      // 1. Charger l'abonnement actif pour déterminer la limite
      const abonnement = await getAbonnementActif(auth.activeSiteId);
      let limitesVagues: number;

      if (abonnement) {
        const typePlan = abonnement.plan.typePlan as string;
        const planLimites = (PLAN_LIMITES as Record<string, (typeof PLAN_LIMITES)[keyof typeof PLAN_LIMITES]>)[typePlan];
        limitesVagues = planLimites
          ? planLimites.limitesVagues
          : PLAN_LIMITES["DECOUVERTE" as keyof typeof PLAN_LIMITES].limitesVagues;
      } else {
        limitesVagues = PLAN_LIMITES["DECOUVERTE" as keyof typeof PLAN_LIMITES].limitesVagues;
      }

      // 2. Compter les vagues EN_COURS (dans la transaction pour éviter la race condition)
      const nombreVagues = await tx.vague.count({
        where: { siteId: auth.activeSiteId, statut: StatutVague.EN_COURS },
      });

      const quotaVagues: QuotaRessource = {
        actuel: nombreVagues,
        limite: normaliseLimite(limitesVagues),
      };

      // 3. Vérifier le quota
      if (isQuotaAtteint(quotaVagues)) {
        const err = new Error("QUOTA_DEPASSE");
        (err as Error & { quotaLimite: number | null }).quotaLimite = quotaVagues.limite;
        throw err;
      }

      return { ok: true } as const;
    }).catch((err: Error & { quotaLimite?: number | null }) => {
      if (err.message === "QUOTA_DEPASSE") {
        return { ok: false, limite: err.quotaLimite } as const;
      }
      throw err;
    });

    if (!quotaResult.ok) {
      return apiError(
        402,
        `Vous avez atteint la limite de ${quotaResult.limite} vague(s) en cours autorisée(s) par votre plan. Terminez une vague existante ou passez à un plan supérieur.`,
        { code: "QUOTA_DEPASSE" }
      );
    }

    const vague = await createVague(auth.activeSiteId, data);

    if (!vague) {
      return apiError(500, "Erreur lors de la creation de la vague.", { code: ErrorKeys.SERVER_CREATE_VAGUE });
    }

    const now = new Date();
    const joursEcoules = Math.floor(
      (now.getTime() - vague.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
    );

    return NextResponse.json(
      {
        id: vague.id,
        code: vague.code,
        dateDebut: vague.dateDebut,
        dateFin: vague.dateFin,
        statut: vague.statut,
        nombreInitial: vague.nombreInitial,
        poidsMoyenInitial: vague.poidsMoyenInitial,
        origineAlevins: vague.origineAlevins,
        nombreBacs: vague.bacs.length,
        joursEcoules,
        createdAt: vague.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("deja assigne") || message.includes("deja utilise")) {
      return apiError(409, message);
    }

    if (message.includes("introuvable")) {
      return apiError(404, message);
    }

    console.error("[API POST /vagues]", error);
    return apiError(500, "Erreur serveur lors de la creation de la vague.", { code: ErrorKeys.SERVER_CREATE_VAGUE });
  }
}
