import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getVagues } from "@/lib/queries/vagues";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, StatutVague, TypePlan, parsePaginationQuery } from "@/types";
import type { CreateVagueDTO } from "@/types";
import { normaliseLimite, isQuotaAtteint } from "@/lib/abonnements/check-quotas";
import { getAbonnementActifPourSite } from "@/lib/queries/abonnements";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";
import type { QuotaRessource } from "@/lib/abonnements/check-quotas";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError } from "@/lib/api-utils";

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
    // Check quota + création sont dans la même transaction pour éviter les race conditions.
    const vagueResult = await prisma.$transaction(async (tx) => {
      // 1. Charger l'abonnement actif pour déterminer la limite
      const abonnement = await getAbonnementActifPourSite(auth.activeSiteId);
      let limitesVagues: number;

      if (abonnement) {
        const typePlan = abonnement.plan.typePlan as string;
        const planLimites = (PLAN_LIMITES as Record<string, (typeof PLAN_LIMITES)[keyof typeof PLAN_LIMITES]>)[typePlan];
        limitesVagues = planLimites
          ? planLimites.limitesVagues
          : PLAN_LIMITES[TypePlan.DECOUVERTE].limitesVagues;
      } else {
        limitesVagues = PLAN_LIMITES[TypePlan.DECOUVERTE].limitesVagues;
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

      // 4. Créer la vague dans la même transaction (atomique avec le check)
      const bacIds = data.bacDistribution.map((e) => e.bacId);

      const bacs = await tx.bac.findMany({
        where: { id: { in: bacIds }, siteId: auth.activeSiteId },
      });

      if (bacs.length !== bacIds.length) {
        throw new Error("Un ou plusieurs bacs sont introuvables");
      }

      const bacsOccupes = bacs.filter((b) => b.vagueId !== null);
      if (bacsOccupes.length > 0) {
        const noms = bacsOccupes.map((b) => b.nom).join(", ");
        throw new Error(`Bacs déjà assignés à une vague : ${noms}`);
      }

      const existingVague = await tx.vague.findUnique({
        where: { code: data.code },
      });
      if (existingVague) {
        throw new Error(`Le code "${data.code}" est déjà utilisé`);
      }

      const vague = await tx.vague.create({
        data: {
          code: data.code,
          dateDebut: new Date(data.dateDebut),
          nombreInitial: data.nombreInitial,
          poidsMoyenInitial: data.poidsMoyenInitial,
          origineAlevins: data.origineAlevins ?? null,
          configElevageId: data.configElevageId,
          siteId: auth.activeSiteId,
        },
      });

      for (const entry of data.bacDistribution) {
        await tx.bac.update({
          where: { id: entry.bacId, siteId: auth.activeSiteId },
          data: {
            vagueId: vague.id,
            nombrePoissons: entry.nombrePoissons,
            nombreInitial: entry.nombrePoissons,
            poidsMoyenInitial: data.poidsMoyenInitial,
          },
        });
      }

      return tx.vague.findUnique({
        where: { id: vague.id },
        include: { bacs: true },
      });
    }).catch((err: Error & { quotaLimite?: number | null }) => {
      if (err.message === "QUOTA_DEPASSE") {
        return { __quotaError: true, limite: err.quotaLimite } as const;
      }
      throw err;
    });

    if (vagueResult && "__quotaError" in vagueResult && vagueResult.__quotaError) {
      return apiError(
        402,
        `Vous avez atteint la limite de ${vagueResult.limite} vague(s) en cours autorisée(s) par votre plan. Terminez une vague existante ou passez à un plan supérieur.`,
        { code: "QUOTA_DEPASSE" }
      );
    }

    // Type narrowed : vagueResult ne peut plus être le quota error après la vérification ci-dessus.
    // On utilise une assertion de type explicite pour aider TypeScript.
    if (!vagueResult || "__quotaError" in vagueResult) {
      return apiError(500, "Erreur lors de la creation de la vague.", { code: ErrorKeys.SERVER_CREATE_VAGUE });
    }

    const vague = vagueResult;

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

    if (
      message.includes("deja assigne") ||
      message.includes("déjà assigné") ||
      message.includes("deja utilise") ||
      message.includes("déjà utilisé")
    ) {
      return apiError(409, message);
    }

    if (message.includes("introuvable")) {
      return apiError(404, message);
    }

    console.error("[API POST /vagues]", error);
    return apiError(500, "Erreur serveur lors de la creation de la vague.", { code: ErrorKeys.SERVER_CREATE_VAGUE });
  }
}
