import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/api-cache";
import { getVagues } from "@/lib/queries/vagues";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { Permission, StatutVague, TypePlan, TypeReleve, TypeVague, parsePaginationQuery } from "@/types";
import type { CreateVagueDTO } from "@/types";
import { computeVivantsByBac } from "@/lib/calculs";
import { normaliseLimite, isQuotaAtteint } from "@/lib/abonnements/check-quotas";
import { getAbonnementActifPourSite } from "@/lib/queries/abonnements";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";
import type { QuotaRessource } from "@/lib/abonnements/check-quotas";
import { ErrorKeys } from "@/lib/api-error-keys";
import { apiError, handleApiError } from "@/lib/api-utils";
import { effectivePoidsLigneVente } from "@/lib/ventes-helpers";

const VALID_TYPE_VAGUE = new Set(Object.values(TypeVague));

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { searchParams } = new URL(request.url);
    const statut = searchParams.get("statut");
    const typeRaw = searchParams.get("type");

    // Valider le type si fourni (R2 — utiliser l'enum)
    if (typeRaw && !VALID_TYPE_VAGUE.has(typeRaw as TypeVague)) {
      return apiError(400, `Le parametre 'type' est invalide. Valeurs acceptees : ${Object.values(TypeVague).join(", ")}.`);
    }
    const type = typeRaw ?? undefined;

    // Pagination
    const paginationResult = parsePaginationQuery(searchParams);
    if (!paginationResult.valid) {
      return apiError(400, paginationResult.error);
    }
    const { limit, offset } = paginationResult.params;

    const filters = statut || type ? { ...(statut && { statut }), ...(type && { type }) } : undefined;

    const { data: vaguesRaw, total } = await getVagues(
      auth.activeSiteId,
      filters,
      { limit, offset }
    );

    // CS.2 : charger les transfertDestBacIds pour toutes les vagues en une requête (batch)
    const transfertDestBacIdsMapRoute = new Map<string, Set<string>>();
    if (vaguesRaw.length > 0) {
      const groupesRoute = await prisma.transfertGroupe.findMany({
        where: {
          vagueDestId: { in: vaguesRaw.map((v) => v.id) },
          transfert: { siteId: auth.activeSiteId },
        },
        select: { vagueDestId: true, bacDestId: true },
      });
      for (const g of groupesRoute) {
        if (!g.bacDestId) continue;
        const set = transfertDestBacIdsMapRoute.get(g.vagueDestId) ?? new Set<string>();
        set.add(g.bacDestId);
        transfertDestBacIdsMapRoute.set(g.vagueDestId, set);
      }
    }

    const data = vaguesRaw.map((v) => {
      const now = v.dateFin ?? new Date();
      const joursEcoules = Math.floor(
        (now.getTime() - v.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calcul biomasse estimée (vivants × dernier poidsMoyen biometrie)
      // ADR-043 Phase 3: source = AssignationBac actives
      const vague = v as typeof v & {
        assignations?: { nombreInitial: number | null; bac: { id: string } }[];
        releves?: Array<{
          typeReleve: TypeReleve | string;
          date: Date;
          poidsMoyen: number | null;
          nombreMorts: number | null;
          nombreVendus: number | null;
          nombreTransferes: number | null;
          nombreCompte: number | null;
          bacId: string | null;
        }>;
        lignesVente?: { poidsTotalKg: number; vente: { poidsLivreKg: number | null; poidsTotalKg: number } }[];
        configElevage?: { poidsObjectif: number } | null;
        poidsObjectifKg?: number | null;
      };

      const assignations = vague.assignations ?? [];
      const releves = vague.releves ?? [];
      const lignesVente = vague.lignesVente ?? [];

      // totalVenduKg — DV.0 : utiliser le poids livré effectif (prorata si poidsLivreKg renseigné)
      const totalVenduKg = lignesVente.reduce((sum, lv) => sum + effectivePoidsLigneVente(lv, lv.vente), 0);

      // poidsObjectifKg : direct sur la vague, sinon dérivé du configElevage
      let poidsObjectifKg: number | null = vague.poidsObjectifKg ?? null;
      if (poidsObjectifKg == null && vague.configElevage?.poidsObjectif && v.nombreInitial > 0) {
        poidsObjectifKg = (vague.configElevage.poidsObjectif * v.nombreInitial) / 1000;
      }

      // biomasse estimée : vivants × dernier poidsMoyen BIOMETRIE
      let biomasse: number | null = null;
      const bacsMapped = assignations.map((a) => ({ id: a.bac.id, nombreInitial: a.nombreInitial }));
      const hasPerBacReleves = releves.some((r) => r.bacId !== null);
      const transfertDestBacIdsRoute = transfertDestBacIdsMapRoute.get(v.id) ?? new Set<string>();
      if (bacsMapped.length > 0 && hasPerBacReleves) {
        // Aligné avec indicateurs.ts et finances.ts (fix B5) : vivants déjà après VENTE
        const vivantsByBac = computeVivantsByBac(
          bacsMapped,
          releves as Parameters<typeof computeVivantsByBac>[1],
          v.nombreInitial,
          { transfertDestBacIds: transfertDestBacIdsRoute }
        );
        const biometriesParBac = new Map<string, number>();
        for (const r of releves) {
          if (r.typeReleve === TypeReleve.BIOMETRIE && r.poidsMoyen !== null && r.bacId) {
            biometriesParBac.set(r.bacId, r.poidsMoyen);
          }
        }
        let totalBiomasse = 0;
        let hasBiomasse = false;
        for (const bac of bacsMapped) {
          const poidsMoyen = biometriesParBac.get(bac.id);
          const vivantsBac = vivantsByBac.get(bac.id) ?? 0;
          if (poidsMoyen && vivantsBac > 0) {
            totalBiomasse += (poidsMoyen * vivantsBac) / 1000;
            hasBiomasse = true;
          }
        }
        if (hasBiomasse) {
          biomasse = Math.round(totalBiomasse * 100) / 100;
        }
      }

      return {
        id: v.id,
        code: v.code,
        dateDebut: v.dateDebut,
        dateFin: v.dateFin,
        statut: v.statut,
        type: v.type,
        nombreInitial: v.nombreInitial,
        poidsMoyenInitial: v.poidsMoyenInitial,
        origineAlevins: v.origineAlevins,
        // ADR-043 Phase 3: assignations actives sont la seule source de vérité
        nombreBacs: (v._count as { assignations?: number }).assignations ?? 0,
        joursEcoules,
        createdAt: v.createdAt,
        isBlocked: false,
        poidsObjectifKg,
        biomasse,
        totalVenduKg: Math.round(totalVenduKg * 100) / 100,
      };
    });

    return cachedJson({ data, total, limit, offset }, "medium");
  } catch (error) {
    return handleApiError("GET /api/vagues", error, "Erreur serveur lors de la recuperation des vagues.", {
      code: ErrorKeys.SERVER_GET_VAGUES,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_CREER);

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Lire et valider le type (défaut GROSSISSEMENT)
    const typeRaw = body.type ?? TypeVague.GROSSISSEMENT;
    if (!VALID_TYPE_VAGUE.has(typeRaw)) {
      errors.push({
        field: "type",
        message: `Le type de vague est invalide. Valeurs acceptees : ${Object.values(TypeVague).join(", ")}.`,
      });
      return apiError(400, "Erreurs de validation", { errors });
    }
    const type = typeRaw as TypeVague;
    const isPreGrossissement = type === TypeVague.PRE_GROSSISSEMENT;

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

    if (isPreGrossissement) {
      // PRE_GROSSISSEMENT : nombreInitial peut etre 0
      if (
        body.nombreInitial == null ||
        typeof body.nombreInitial !== "number" ||
        !Number.isInteger(body.nombreInitial) ||
        body.nombreInitial < 0
      ) {
        errors.push({
          field: "nombreInitial",
          message: "Le nombre initial doit etre un entier >= 0.",
        });
      }
    } else {
      // GROSSISSEMENT : nombreInitial peut etre 0 si bacDistribution vide (vague vide en attente de transfert)
      const isVagueVide =
        (body.nombreInitial === 0 || body.nombreInitial == null) &&
        (!Array.isArray(body.bacDistribution) || body.bacDistribution.length === 0);

      if (!isVagueVide) {
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
      }
    }

    if (
      body.poidsMoyenInitial == null ||
      typeof body.poidsMoyenInitial !== "number" ||
      body.poidsMoyenInitial < 0
    ) {
      errors.push({
        field: "poidsMoyenInitial",
        message: "Le poids moyen initial doit etre un nombre >= 0.",
      });
    }

    if (!isPreGrossissement && body.configElevageId) {
      // configElevageId valide uniquement pour GROSSISSEMENT, optionnel pour PRE_GROSSISSEMENT
      if (typeof body.configElevageId !== "string" || body.configElevageId.trim() === "") {
        errors.push({
          field: "configElevageId",
          message: "La configuration d'elevage doit etre un identifiant valide.",
        });
      }
    } else if (!isPreGrossissement && !body.configElevageId) {
      // Pour GROSSISSEMENT standard (non vide), configElevageId est requis
      const nombreInitialIsZero = body.nombreInitial === 0 || body.nombreInitial == null;
      const bacDistributionIsEmpty = !Array.isArray(body.bacDistribution) || body.bacDistribution.length === 0;
      if (!(nombreInitialIsZero && bacDistributionIsEmpty)) {
        errors.push({
          field: "configElevageId",
          message: "La configuration d'elevage est obligatoire.",
        });
      }
    }

    // Valider bacDistribution si non vide
    const bacDistribution = Array.isArray(body.bacDistribution) ? body.bacDistribution : [];
    const isVagueVideGrossissement =
      !isPreGrossissement &&
      (body.nombreInitial === 0 || body.nombreInitial == null) &&
      bacDistribution.length === 0;

    if (!isPreGrossissement && !isVagueVideGrossissement && bacDistribution.length === 0) {
      errors.push({
        field: "bacDistribution",
        message: "Au moins un bac doit etre selectionne avec sa distribution d'alevins.",
      });
    } else if (bacDistribution.length > 0) {
      // Valider chaque entree de la distribution
      for (let i = 0; i < bacDistribution.length; i++) {
        const entry = bacDistribution[i];
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

      // Valider que la somme des nombrePoissons correspond au nombreInitial (sauf si PRE_GROSSISSEMENT)
      if (errors.length === 0 && body.nombreInitial != null && !isPreGrossissement) {
        const somme = (bacDistribution as Array<{ nombrePoissons: number }>).reduce(
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
      nombreInitial: body.nombreInitial ?? 0,
      poidsMoyenInitial: body.poidsMoyenInitial ?? 0,
      origineAlevins: body.origineAlevins ?? undefined,
      configElevageId: body.configElevageId ?? undefined,
      poidsObjectifKg: body.poidsObjectifKg != null ? Number(body.poidsObjectifKg) : undefined,
      uniteProductionId: body.uniteProductionId || undefined,
      bacDistribution: bacDistribution,
    };

    // Vérifier le quota et créer la vague dans une transaction atomique (R4)
    // Check quota + création sont dans la même transaction pour éviter les race conditions.
    const vagueResult = await prisma.$transaction(async (tx) => {
      // 1. Charger l'abonnement actif pour déterminer la limite
      // Sans abonnement actif → appliquer les limites DECOUVERTE par défaut
      const abonnement = await getAbonnementActifPourSite(auth.activeSiteId);
      const planType = abonnement?.plan.typePlan as TypePlan | undefined;
      const planLimites = planType
        ? PLAN_LIMITES[planType] ?? PLAN_LIMITES[TypePlan.DECOUVERTE]
        : PLAN_LIMITES[TypePlan.DECOUVERTE];
      const limitesVagues = planLimites.limitesVagues;

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

      // ADR-043 Phase 3: vérifier l'occupation via AssignationBac (source de vérité)
      const existingAssignations = await tx.assignationBac.findMany({
        where: { bacId: { in: bacIds }, dateFin: null },
        include: { bac: { select: { nom: true } } },
      });
      if (existingAssignations.length > 0) {
        const noms = existingAssignations.map((a) => a.bac.nom).join(", ");
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
          type,
          dateDebut: new Date(data.dateDebut),
          nombreInitial: data.nombreInitial,
          poidsMoyenInitial: data.poidsMoyenInitial,
          origineAlevins: data.origineAlevins ?? null,
          configElevageId: data.configElevageId ?? null,
          uniteProductionId: data.uniteProductionId ?? null,
          siteId: auth.activeSiteId,
        },
      });

      // ADR-043 Phase 3: créer uniquement les AssignationBac (plus de dual-write sur Bac)
      for (const entry of data.bacDistribution) {
        await tx.assignationBac.create({
          data: {
            bacId: entry.bacId,
            vagueId: vague.id,
            siteId: auth.activeSiteId,
            dateAssignation: new Date(data.dateDebut),
            dateFin: null,
            nombreInitial: entry.nombrePoissons,
            poidsMoyenInitial: data.poidsMoyenInitial,
            nombreActuel: entry.nombrePoissons,
          },
        });
      }

      return tx.vague.findUnique({
        where: { id: vague.id },
        include: {
          assignations: {
            where: { dateFin: null },
            select: { id: true },
          },
        },
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
        type: vague.type,
        isBlocked: false,
        nombreInitial: vague.nombreInitial,
        poidsMoyenInitial: vague.poidsMoyenInitial,
        origineAlevins: vague.origineAlevins,
        nombreBacs: vague.assignations.length,
        joursEcoules,
        createdAt: vague.createdAt,
        // Nouvelle vague — pas encore de biomasse ni de ventes
        poidsObjectifKg: vague.poidsObjectifKg ?? null,
        biomasse: null,
        totalVenduKg: 0,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError("POST /api/vagues", error, "Erreur serveur lors de la creation de la vague.", {
      code: ErrorKeys.SERVER_CREATE_VAGUE,
    });
  }
}
