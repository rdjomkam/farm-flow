import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getReleves, createReleve } from "@/lib/queries/releves";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { TypeReleve, Permission, StatutVague, TypeDeclencheur, parsePaginationQuery } from "@/types";
import type { CreateReleveDTO, ReleveFilters } from "@/types";
import { prisma } from "@/lib/db";
import {
  buildEvaluationContext,
  evaluateRules,
  generateActivities,
} from "@/lib/activity-engine";
import { retryAsync } from "@/lib/async-retry";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError } from "@/lib/api-utils";
import {
  createReleveSchema,
  createRenouvellementSchema,
  zodErrorToFieldErrors,
} from "@/lib/validation/releve.schema";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_VOIR);
    const { searchParams } = new URL(request.url);

    // Pagination
    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return NextResponse.json({ status: 400, message: paginationResult.error }, { status: 400 });
    }
    const { limit, offset } = paginationResult.params;

    const filters: ReleveFilters = {};
    const vagueId = searchParams.get("vagueId");
    const bacId = searchParams.get("bacId");
    const typeReleve = searchParams.get("typeReleve");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (vagueId) filters.vagueId = vagueId;
    if (bacId) filters.bacId = bacId;
    if (typeReleve) {
      if (!Object.values(TypeReleve).includes(typeReleve as TypeReleve)) {
        return NextResponse.json(
          {
            status: 400,
            message: `Type de releve invalide. Valeurs acceptees : ${Object.values(TypeReleve).join(", ")}.`,
            field: "typeReleve",
          },
          { status: 400 }
        );
      }
      filters.typeReleve = typeReleve as TypeReleve;
    }
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (searchParams.get("nonLie") === "true") filters.nonLie = true;

    const { data, total } = await getReleves(auth.activeSiteId, filters, { limit, offset });
    return cachedJson({ data, total, limit, offset }, "fast");
  } catch (error) {
    console.error("[GET /api/releves] Error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des releves.", errorKey: ErrorKeys.SERVER_GET_RELEVES },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_CREER);

    // Idempotency check
    const idempotencyKey = request.headers.get("X-Idempotency-Key");
    if (idempotencyKey && auth.activeSiteId) {
      const { checkIdempotency } = await import("@/lib/idempotency");
      const check = await checkIdempotency(idempotencyKey, auth.activeSiteId);
      if (check.isDuplicate) {
        return NextResponse.json(check.response, { status: check.statusCode });
      }
    }

    const body = await request.json();

    // RENOUVELLEMENT is handled separately because .and() is incompatible with discriminatedUnion
    if (body.typeReleve === TypeReleve.RENOUVELLEMENT) {
      const result = createRenouvellementSchema.safeParse(body);
      if (!result.success) {
        return apiError(400, "Erreurs de validation", { errors: zodErrorToFieldErrors(result.error) });
      }
      const v = result.data;
      const base = {
        vagueId: v.vagueId,
        bacId: v.bacId,
        ...(v.notes != null && { notes: v.notes }),
        ...(v.consommations && v.consommations.length > 0 && { consommations: v.consommations }),
        ...(v.date && { date: new Date(v.date).toISOString() }),
      };
      const dto: CreateReleveDTO = {
        ...base,
        typeReleve: TypeReleve.RENOUVELLEMENT,
        ...(v.pourcentageRenouvellement != null && { pourcentageRenouvellement: v.pourcentageRenouvellement }),
        ...(v.volumeRenouvele != null && { volumeRenouvele: v.volumeRenouvele }),
        ...(v.nombreRenouvellements != null && { nombreRenouvellements: v.nombreRenouvellements }),
      };
      const activiteId = v.activiteId ?? undefined;
      const releve = await createReleve(auth.activeSiteId, auth.userId, dto, activiteId);
      retryAsync(
        () => triggerSeuilRulesAsync(auth.activeSiteId, dto.vagueId, auth.userId),
        { context: "[POST /api/releves] hook SEUIL (RENOUVELLEMENT)" }
      );
      if (idempotencyKey && auth.activeSiteId) {
        const { storeIdempotency } = await import("@/lib/idempotency");
        await storeIdempotency(idempotencyKey, auth.activeSiteId, releve, 201);
      }
      return NextResponse.json(releve, { status: 201 });
    }

    // Cross-field guard: tauxRefus and comportementAlim are only valid for ALIMENTATION
    if (body.typeReleve !== TypeReleve.ALIMENTATION) {
      const alienFields: { field: string; message: string }[] = [];
      if (body.tauxRefus !== undefined && body.tauxRefus !== null) {
        alienFields.push({
          field: "tauxRefus",
          message: "Le taux de refus est valide uniquement pour un releve de type ALIMENTATION.",
        });
      }
      if (body.comportementAlim !== undefined && body.comportementAlim !== null) {
        alienFields.push({
          field: "comportementAlim",
          message: "Le comportement alimentaire est valide uniquement pour un releve de type ALIMENTATION.",
        });
      }
      if (alienFields.length > 0) {
        return apiError(400, "Erreurs de validation", { errors: alienFields });
      }
    }

    // Validate all other types with discriminated union schema
    const parseResult = createReleveSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(400, "Erreurs de validation", { errors: zodErrorToFieldErrors(parseResult.error) });
    }

    const validated = parseResult.data;
    const activiteId = validated.activiteId ?? undefined;

    // Build clean DTO from validated fields
    const consommations =
      validated.consommations && validated.consommations.length > 0
        ? validated.consommations
        : undefined;

    const base = {
      vagueId: validated.vagueId,
      bacId: validated.bacId,
      ...(validated.notes != null && { notes: validated.notes }),
      ...(consommations && { consommations }),
      ...(validated.date && { date: new Date(validated.date).toISOString() }),
    };

    let dto!: CreateReleveDTO;

    switch (validated.typeReleve) {
      case TypeReleve.BIOMETRIE:
        dto = {
          ...base,
          typeReleve: TypeReleve.BIOMETRIE,
          poidsMoyen: validated.poidsMoyen,
          tailleMoyenne: validated.tailleMoyenne ?? undefined,
          echantillonCount: validated.echantillonCount,
        };
        break;
      case TypeReleve.MORTALITE:
        dto = {
          ...base,
          typeReleve: TypeReleve.MORTALITE,
          nombreMorts: validated.nombreMorts,
          causeMortalite: validated.causeMortalite,
        };
        break;
      case TypeReleve.ALIMENTATION:
        dto = {
          ...base,
          typeReleve: TypeReleve.ALIMENTATION,
          quantiteAliment: validated.quantiteAliment,
          typeAliment: validated.typeAliment,
          frequenceAliment: validated.frequenceAliment,
          ...(validated.tauxRefus != null && { tauxRefus: validated.tauxRefus }),
          ...(validated.comportementAlim != null && { comportementAlim: validated.comportementAlim }),
        };
        break;
      case TypeReleve.QUALITE_EAU:
        dto = {
          ...base,
          typeReleve: TypeReleve.QUALITE_EAU,
          ...(validated.temperature != null && { temperature: validated.temperature }),
          ...(validated.ph != null && { ph: validated.ph }),
          ...(validated.oxygene != null && { oxygene: validated.oxygene }),
          ...(validated.ammoniac != null && { ammoniac: validated.ammoniac }),
        };
        break;
      case TypeReleve.COMPTAGE:
        dto = {
          ...base,
          typeReleve: TypeReleve.COMPTAGE,
          nombreCompte: validated.nombreCompte,
          methodeComptage: validated.methodeComptage,
        };
        break;
      case TypeReleve.OBSERVATION:
        dto = {
          ...base,
          typeReleve: TypeReleve.OBSERVATION,
          description: validated.description,
        };
        break;
    }

    const releve = await createReleve(auth.activeSiteId, auth.userId, dto, activiteId);

    // Hook asynchrone : evaluer les regles SEUIL_* pour la vague concernee.
    // Ne bloque pas la reponse — echecs transitoires retenies, echec definitif logue.
    const vagueId = dto.vagueId;
    const siteId = auth.activeSiteId;
    const userId = auth.userId;
    retryAsync(
      () => triggerSeuilRulesAsync(siteId, vagueId, userId),
      { context: "[POST /api/releves] hook SEUIL" }
    );

    // Store idempotency record
    if (idempotencyKey && auth.activeSiteId) {
      const { storeIdempotency } = await import("@/lib/idempotency");
      await storeIdempotency(idempotencyKey, auth.activeSiteId, releve, 201);
    }

    return NextResponse.json(releve, { status: 201 });
  } catch (error) {
    console.error("[POST /api/releves] Error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }

    if (message.includes("n'appartient pas") || message.includes("cloturee") || message.includes("Stock insuffisant") || message.includes("n'est pas de categorie")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du releve.", errorKey: ErrorKeys.SERVER_CREATE_RELEVE },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Hook asynchrone — evaluation des regles SEUIL_* apres creation d'un releve
// ---------------------------------------------------------------------------

/**
 * Evalue les regles de type SEUIL_* pour une vague donnee apres la creation
 * d'un releve. Appele de facon asynchrone pour ne pas bloquer la reponse HTTP.
 */
async function triggerSeuilRulesAsync(
  siteId: string,
  vagueId: string,
  userId: string
): Promise<void> {
  const vague = await prisma.vague.findFirst({
    where: { id: vagueId, siteId, statut: StatutVague.EN_COURS },
    include: {
      bacs: {
        where: { vagueId: { not: null } },
        select: {
          id: true,
          nom: true,
          volume: true,
          nombrePoissons: true,
          nombreInitial: true,
          poidsMoyenInitial: true,
        },
      },
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
          bacId: true,
          pourcentageRenouvellement: true,
          volumeRenouvele: true,
        },
      },
      configElevage: true,
    },
  });

  if (!vague) return;

  // Paralléliser les queries indépendantes : stock + regles SEUIL
  const seuilTypes = [
    TypeDeclencheur.SEUIL_POIDS,
    TypeDeclencheur.SEUIL_QUALITE,
    TypeDeclencheur.SEUIL_MORTALITE,
    TypeDeclencheur.STOCK_BAS,
    TypeDeclencheur.FCR_ELEVE,
  ];

  const [produits, regles] = await Promise.all([
    prisma.produit.findMany({
      where: { siteId, isActive: true },
      select: {
        id: true,
        nom: true,
        categorie: true,
        unite: true,
        seuilAlerte: true,
        stockActuel: true,
      },
    }),
    prisma.regleActivite.findMany({
      where: {
        isActive: true,
        firedOnce: false,
        typeDeclencheur: { in: seuilTypes },
        OR: [{ siteId }, { siteId: null }],
      },
    }),
  ]);

  if (regles.length === 0) return;

  const trenteDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const historique = await prisma.activite.findMany({
    where: {
      siteId,
      vagueId,
      regleId: { not: null },
      createdAt: { gte: trenteDaysAgo },
    },
    select: {
      id: true,
      regleId: true,
      vagueId: true,
      bacId: true,
      dateDebut: true,
      createdAt: true,
    },
  });

  const contexts: Parameters<typeof evaluateRules>[0] = [];
  const vagueCtx = {
    id: vague.id,
    code: vague.code,
    dateDebut: vague.dateDebut,
    nombreInitial: vague.nombreInitial,
    poidsMoyenInitial: vague.poidsMoyenInitial,
    siteId: vague.siteId,
  };
  const relevesCast = vague.releves as Parameters<typeof buildEvaluationContext>[1];
  const stockCast = produits as Parameters<typeof buildEvaluationContext>[2];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configCast = (vague.configElevage ?? null) as any;

  if (vague.bacs && vague.bacs.length > 0) {
    const allBacsCast = vague.bacs as Parameters<typeof buildEvaluationContext>[5];
    for (const bac of vague.bacs) {
      contexts.push(buildEvaluationContext(vagueCtx, relevesCast, stockCast, configCast, bac, allBacsCast));
    }
    // Vague-level for STOCK_BAS
    contexts.push(buildEvaluationContext(vagueCtx, relevesCast, stockCast, configCast, null));
  } else {
    contexts.push(buildEvaluationContext(vagueCtx, relevesCast, stockCast, configCast, null));
  }

  const matches = evaluateRules(
    contexts,
    regles as Parameters<typeof evaluateRules>[1],
    historique as Parameters<typeof evaluateRules>[2]
  );

  if (matches.length === 0) return;

  await generateActivities(
    matches,
    siteId,
    userId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vague.configElevage ?? null) as any
  );
}
