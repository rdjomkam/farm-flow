import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, TypeReleve } from "@/types";
import {
  calibrerGompertz,
  genererCourbeGompertz,
  projeterDateRecolte,
  isCachedGompertzValid,
  type GompertzParams,
} from "@/lib/gompertz";
import { apiError } from "@/lib/api-utils";
import { computeVivantsByBac } from "@/lib/calculs";

const DEFAULT_TARGET_WEIGHT_G = 800;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { id: vagueId } = await params;

    // 1. Fetch vague, verify it belongs to the active site (R8)
    const vague = await prisma.vague.findFirst({
      where: { id: vagueId, siteId: auth.activeSiteId },
      select: {
        id: true,
        dateDebut: true,
        nombreInitial: true,
        bacs: { select: { id: true, nombreInitial: true } },
        configElevage: {
          select: {
            poidsObjectif: true,
            gompertzWInfDefault: true,
            gompertzKDefault: true,
            gompertzTiDefault: true,
            gompertzMinPoints: true,
          },
        },
        gompertz: true,
      },
    });

    if (!vague) {
      return apiError(404, "Vague introuvable.");
    }

    // 2. Fetch all BIOMETRIE + MORTALITE + COMPTAGE releves for aggregation
    const allReleves = await prisma.releve.findMany({
      where: {
        vagueId,
        siteId: auth.activeSiteId,
        typeReleve: { in: [TypeReleve.BIOMETRIE, TypeReleve.MORTALITE, TypeReleve.COMPTAGE] },
      },
      select: {
        typeReleve: true,
        date: true,
        poidsMoyen: true,
        nombreMorts: true,
        nombreCompte: true,
        bacId: true,
      },
      orderBy: { date: "asc" },
    });

    // 3. Compute vivantsByBac for weighted-average aggregation
    const vivantsByBac = computeVivantsByBac(vague.bacs, allReleves, vague.nombreInitial);

    // 4. Aggregate biometries by date (weighted average per unique date)
    const biometriesRaw = allReleves.filter(
      (r) => r.typeReleve === TypeReleve.BIOMETRIE && r.poidsMoyen !== null
    );
    const groupedByDate = new Map<string, typeof biometriesRaw>();
    for (const r of biometriesRaw) {
      const key = new Date(r.date).toISOString().slice(0, 10);
      const group = groupedByDate.get(key);
      if (group) group.push(r);
      else groupedByDate.set(key, [r]);
    }

    // biometrieCount = unique dates (not raw releve count)
    const biometrieCount = groupedByDate.size;

    // 3. Lazy calibration: recalibrate if biometrieCount changed, no record, or config threshold lowered
    const existingGompertz = vague.gompertz;
    const minPoints = vague.configElevage?.gompertzMinPoints ?? 5;
    const configWInf = vague.configElevage?.gompertzWInfDefault ?? null;
    const needsCalibration =
      !isCachedGompertzValid(existingGompertz, biometrieCount, minPoints, configWInf) ||
      // Also recalibrate when INSUFFICIENT_DATA but we now have enough points
      (existingGompertz?.confidenceLevel === "INSUFFICIENT_DATA" && biometrieCount >= minPoints);

    let calibrationParams: GompertzParams | null = null;
    let r2: number | null = null;
    let rmse: number | null = null;
    let confidenceLevel: string = "INSUFFICIENT_DATA";
    let storedBiometrieCount = biometrieCount;

    if (!needsCalibration && existingGompertz) {
      // Use cached calibration
      calibrationParams = {
        wInfinity: existingGompertz.wInfinity,
        k: existingGompertz.k,
        ti: existingGompertz.ti,
      };
      r2 = existingGompertz.r2;
      rmse = existingGompertz.rmse;
      confidenceLevel = existingGompertz.confidenceLevel;
      storedBiometrieCount = existingGompertz.biometrieCount;
    } else if (biometrieCount < minPoints) {
      // Not enough data — return early with INSUFFICIENT_DATA
      // Still upsert with count=0 or current to track state (only if count changed)
      if (needsCalibration) {
        await prisma.gompertzVague.upsert({
          where: { vagueId },
          create: {
            vagueId,
            siteId: auth.activeSiteId,
            wInfinity: 0,
            k: 0,
            ti: 0,
            r2: 0,
            rmse: 0,
            biometrieCount,
            confidenceLevel: "INSUFFICIENT_DATA",
            configWInfUsed: configWInf,
          },
          update: {
            biometrieCount,
            confidenceLevel: "INSUFFICIENT_DATA",
            configWInfUsed: configWInf,
            calculatedAt: new Date(),
          },
        });
      }

      return NextResponse.json({
        vagueId,
        calibration: null,
        courbe: null,
        dateRecolteEstimee: null,
        calibrationsBacs: [],
      });
    } else {
      // 4a. Build weighted-average points per unique date
      const vagueStartMs = vague.dateDebut.getTime();
      const points = Array.from(groupedByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, releves]) => {
          let sumWeighted = 0;
          let sumWeights = 0;
          for (const r of releves) {
            const weight = (r.bacId ? vivantsByBac.get(r.bacId) : undefined) ?? 1;
            sumWeighted += r.poidsMoyen! * weight;
            sumWeights += weight;
          }
          const dateMs = new Date(dateKey + "T00:00:00").getTime();
          return {
            jour: Math.floor((dateMs - vagueStartMs) / (1000 * 60 * 60 * 24)),
            poidsMoyen: Math.round((sumWeighted / sumWeights) * 100) / 100,
          };
        });

      // 4b. Build initial guess from ConfigElevage if available
      const initialGuess: Partial<GompertzParams> = {};
      if (vague.configElevage?.gompertzWInfDefault) initialGuess.wInfinity = vague.configElevage.gompertzWInfDefault;
      if (vague.configElevage?.gompertzKDefault) initialGuess.k = vague.configElevage.gompertzKDefault;
      if (vague.configElevage?.gompertzTiDefault) initialGuess.ti = vague.configElevage.gompertzTiDefault;

      // 4c. Calibrate with aggregated weighted-average points
      const result = calibrerGompertz({ points, initialGuess }, minPoints);

      if (!result) {
        // calibrerGompertz returned null (< 5 points after filtering nulls)
        return NextResponse.json({
          vagueId,
          calibration: null,
          courbe: null,
          dateRecolteEstimee: null,
          calibrationsBacs: [],
        });
      }

      // 4d. Upsert GompertzVague record
      await prisma.gompertzVague.upsert({
        where: { vagueId },
        create: {
          vagueId,
          siteId: auth.activeSiteId,
          wInfinity: result.params.wInfinity,
          k: result.params.k,
          ti: result.params.ti,
          r2: result.r2,
          rmse: result.rmse,
          biometrieCount: result.biometrieCount,
          confidenceLevel: result.confidenceLevel,
          configWInfUsed: configWInf,
        },
        update: {
          wInfinity: result.params.wInfinity,
          k: result.params.k,
          ti: result.params.ti,
          r2: result.r2,
          rmse: result.rmse,
          biometrieCount: result.biometrieCount,
          confidenceLevel: result.confidenceLevel,
          configWInfUsed: configWInf,
          calculatedAt: new Date(),
        },
      });

      calibrationParams = result.params;
      r2 = result.r2;
      rmse = result.rmse;
      confidenceLevel = result.confidenceLevel;
      storedBiometrieCount = result.biometrieCount;
    }

    if (!calibrationParams || r2 === null || rmse === null) {
      return NextResponse.json({
        vagueId,
        calibration: null,
        courbe: null,
        dateRecolteEstimee: null,
        calibrationsBacs: [],
      });
    }

    // 5. Generate the Gompertz curve (0 to 200 days, step 1)
    const courbe = genererCourbeGompertz(calibrationParams, 200, 1);

    // 6. Project harvest date
    const targetWeight =
      vague.configElevage?.poidsObjectif ?? DEFAULT_TARGET_WEIGHT_G;

    const currentDay = Math.floor(
      (Date.now() - vague.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
    );

    const dateRecolteEstimee = projeterDateRecolte(
      calibrationParams,
      targetWeight,
      currentDay
    );

    // 7. ADR-030 — Per-tank calibration loop
    // Load existing GompertzBac records for this vague
    const existingGompertzBacs = await prisma.gompertzBac.findMany({
      where: { vagueId, siteId: auth.activeSiteId },
    });
    const existingBacMap = new Map(existingGompertzBacs.map((g) => [g.bacId, g]));
    const vagueStartMs = vague.dateDebut.getTime();

    const calibrationsBacs: {
      bacId: string;
      calibration: {
        params: GompertzParams;
        r2: number;
        rmse: number;
        confidenceLevel: string;
        biometrieCount: number;
      } | null;
    }[] = [];

    for (const bac of vague.bacs) {
      // Filter biometries for this specific bac
      const bacBiometries = biometriesRaw.filter((r) => r.bacId === bac.id);

      // Group bac biometries by unique date
      const bacByDate = new Map<string, typeof bacBiometries>();
      for (const r of bacBiometries) {
        const key = new Date(r.date).toISOString().slice(0, 10);
        const group = bacByDate.get(key);
        if (group) group.push(r);
        else bacByDate.set(key, [r]);
      }
      const bacBiometrieCount = bacByDate.size;

      // Check if cached record is still valid
      const existingBacGompertz = existingBacMap.get(bac.id) ?? null;
      const bacNeedsCalibration =
        !isCachedGompertzValid(existingBacGompertz, bacBiometrieCount, minPoints, configWInf) ||
        (existingBacGompertz?.confidenceLevel === "INSUFFICIENT_DATA" && bacBiometrieCount >= minPoints);

      if (!bacNeedsCalibration && existingBacGompertz && existingBacGompertz.confidenceLevel !== "INSUFFICIENT_DATA") {
        // Use cached bac calibration
        calibrationsBacs.push({
          bacId: bac.id,
          calibration: {
            params: {
              wInfinity: existingBacGompertz.wInfinity,
              k: existingBacGompertz.k,
              ti: existingBacGompertz.ti,
            },
            r2: existingBacGompertz.r2,
            rmse: existingBacGompertz.rmse,
            confidenceLevel: existingBacGompertz.confidenceLevel,
            biometrieCount: existingBacGompertz.biometrieCount,
          },
        });
        continue;
      }

      if (bacBiometrieCount < minPoints) {
        // Not enough data for this bac — upsert INSUFFICIENT_DATA
        await prisma.gompertzBac.upsert({
          where: { bacId: bac.id },
          create: {
            bacId: bac.id,
            vagueId,
            siteId: auth.activeSiteId,
            wInfinity: 0,
            k: 0,
            ti: 0,
            r2: 0,
            rmse: 0,
            biometrieCount: bacBiometrieCount,
            confidenceLevel: "INSUFFICIENT_DATA",
            configWInfUsed: configWInf,
          },
          update: {
            biometrieCount: bacBiometrieCount,
            confidenceLevel: "INSUFFICIENT_DATA",
            configWInfUsed: configWInf,
            calculatedAt: new Date(),
          },
        });
        calibrationsBacs.push({ bacId: bac.id, calibration: null });
        continue;
      }

      // Build weighted-average points per unique date for this bac.
      // Note: all releves here share the same bacId (we are inside a per-bac loop),
      // so vivantsByBac.get(r.bacId) resolves to the same value for every entry.
      // The weighting therefore has no effect — this is effectively a simple
      // arithmetic average. Weight is kept at 1 for clarity.
      const bacPoints = Array.from(bacByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, releves]) => {
          let sumWeighted = 0;
          let sumWeights = 0;
          for (const r of releves) {
            const weight = 1;
            sumWeighted += r.poidsMoyen! * weight;
            sumWeights += weight;
          }
          const dateMs = new Date(dateKey + "T00:00:00").getTime();
          return {
            jour: Math.floor((dateMs - vagueStartMs) / (1000 * 60 * 60 * 24)),
            poidsMoyen: Math.round((sumWeighted / sumWeights) * 100) / 100,
          };
        });

      // Build initial guess from ConfigElevage if available
      const bacInitialGuess: Partial<GompertzParams> = {};
      if (vague.configElevage?.gompertzWInfDefault) bacInitialGuess.wInfinity = vague.configElevage.gompertzWInfDefault;
      if (vague.configElevage?.gompertzKDefault) bacInitialGuess.k = vague.configElevage.gompertzKDefault;
      if (vague.configElevage?.gompertzTiDefault) bacInitialGuess.ti = vague.configElevage.gompertzTiDefault;

      // Calibrate with this bac's biometry points
      const bacResult = calibrerGompertz({ points: bacPoints, initialGuess: bacInitialGuess }, minPoints);

      if (!bacResult) {
        calibrationsBacs.push({ bacId: bac.id, calibration: null });
        continue;
      }

      // Upsert GompertzBac record
      await prisma.gompertzBac.upsert({
        where: { bacId: bac.id },
        create: {
          bacId: bac.id,
          vagueId,
          siteId: auth.activeSiteId,
          wInfinity: bacResult.params.wInfinity,
          k: bacResult.params.k,
          ti: bacResult.params.ti,
          r2: bacResult.r2,
          rmse: bacResult.rmse,
          biometrieCount: bacResult.biometrieCount,
          confidenceLevel: bacResult.confidenceLevel,
          configWInfUsed: configWInf,
        },
        update: {
          wInfinity: bacResult.params.wInfinity,
          k: bacResult.params.k,
          ti: bacResult.params.ti,
          r2: bacResult.r2,
          rmse: bacResult.rmse,
          biometrieCount: bacResult.biometrieCount,
          confidenceLevel: bacResult.confidenceLevel,
          configWInfUsed: configWInf,
          calculatedAt: new Date(),
        },
      });

      calibrationsBacs.push({
        bacId: bac.id,
        calibration: {
          params: bacResult.params,
          r2: bacResult.r2,
          rmse: bacResult.rmse,
          confidenceLevel: bacResult.confidenceLevel,
          biometrieCount: bacResult.biometrieCount,
        },
      });
    }

    return NextResponse.json({
      vagueId,
      calibration: {
        params: calibrationParams,
        r2,
        rmse,
        confidenceLevel,
        biometrieCount: storedBiometrieCount,
      },
      courbe,
      dateRecolteEstimee,
      calibrationsBacs,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/vagues/[id]/gompertz]", error);
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors du calcul Gompertz.",
      },
      { status: 500 }
    );
  }
}
