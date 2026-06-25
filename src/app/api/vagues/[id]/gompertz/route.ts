import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { Permission, TypeReleve } from "@/types";
import {
  calibrerGompertz,
  genererCourbeGompertz,
  projeterDateRecolte,
  isCachedGompertzValid,
  mergeLockedCurve,
  buildDisplayCurve,
  type GompertzParams,
  type LockedCurve,
} from "@/lib/gompertz";
import { apiError, handleApiError } from "@/lib/api-utils";
import { computeVivantsByBac } from "@/lib/calculs";
import { getTransfertDestBacIds } from "@/lib/queries/transferts";

const DEFAULT_TARGET_WEIGHT_G = 800;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { id: vagueId } = await params;

    // 1. Fetch vague, verify it belongs to the active site (R8)
    // ADR-043 Phase 3: nombreInitial vient de AssignationBac, pas de Bac
    const vague = await prisma.vague.findFirst({
      where: { id: vagueId, siteId: auth.activeSiteId },
      select: {
        id: true,
        dateDebut: true,
        nombreInitial: true,
        assignations: {
          where: { dateFin: null },
          select: { nombreInitial: true, bac: { select: { id: true } } },
        },
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

    // 2. Fetch all relevant releves for aggregation
    const allReleves = await prisma.releve.findMany({
      where: {
        vagueId,
        siteId: auth.activeSiteId,
        typeReleve: { in: [TypeReleve.BIOMETRIE, TypeReleve.MORTALITE, TypeReleve.COMPTAGE, TypeReleve.VENTE] },
      },
      select: {
        typeReleve: true,
        date: true,
        poidsMoyen: true,
        nombreMorts: true,
        nombreVendus: true,
        nombreTransferes: true,
        nombreCompte: true,
        bacId: true,
      },
      orderBy: { date: "asc" },
    });

    // 3. Compute vivantsByBac for weighted-average aggregation
    // ADR-043 Phase 3: construire les bacs depuis les assignations actives
    const vagueBacs = vague.assignations.map((a) => ({
      id: a.bac.id,
      nombreInitial: a.nombreInitial,
    }));
    const transfertDestBacIds = await getTransfertDestBacIds(auth.activeSiteId, vagueId);
    const vivantsByBac = computeVivantsByBac(vagueBacs, allReleves, vague.nombreInitial, { transfertDestBacIds });

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
    const vagueStartMs = vague.dateDebut.getTime();

    // Compute the last observation day (latest biometry date as days since vague start)
    const sortedDateKeys = Array.from(groupedByDate.keys()).sort();
    const lastObsDay = sortedDateKeys.length > 0
      ? Math.floor((new Date(sortedDateKeys[sortedDateKeys.length - 1] + "T00:00:00").getTime() - vagueStartMs) / 86400000)
      : 0;

    // Lazy calibration: recalibrate if biometrieCount changed, no record, or config threshold lowered
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
    let lockedCurve: LockedCurve | null = (existingGompertz?.lockedCurve as LockedCurve) ?? null;
    let previousLastObsDay: number | null = existingGompertz?.lastObservationDay ?? null;

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
      });
    } else {
      // Build weighted-average points per unique date
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

      // Build initial guess from ConfigElevage if available
      const initialGuess: Partial<GompertzParams> = {};
      if (vague.configElevage?.gompertzWInfDefault) initialGuess.wInfinity = vague.configElevage.gompertzWInfDefault;
      if (vague.configElevage?.gompertzKDefault) initialGuess.k = vague.configElevage.gompertzKDefault;
      if (vague.configElevage?.gompertzTiDefault) initialGuess.ti = vague.configElevage.gompertzTiDefault;

      // Calibrate with aggregated weighted-average points
      const result = calibrerGompertz({ points, initialGuess }, minPoints);

      if (!result) {
        return NextResponse.json({
          vagueId,
          calibration: null,
          courbe: null,
          dateRecolteEstimee: null,
        });
      }

      // Generate fresh curve from new params
      const freshCurve = genererCourbeGompertz(result.params, 200, 1);

      // Merge locked curve: freeze past predictions, update future ones
      lockedCurve = mergeLockedCurve(lockedCurve, previousLastObsDay, freshCurve, lastObsDay);

      // Upsert GompertzVague record with locked curve
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
          lockedCurve: lockedCurve,
          lastObservationDay: lastObsDay,
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
          lockedCurve: lockedCurve,
          lastObservationDay: lastObsDay,
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
      });
    }

    // 5. Generate the display curve — locked past + fresh future
    const freshCurve = genererCourbeGompertz(calibrationParams, 200, 1);
    const courbe = buildDisplayCurve(lockedCurve, freshCurve, lastObsDay);

    // 6. Project harvest date (uses latest params for future projection)
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
    });
  } catch (error) {
    return handleApiError("GET /api/vagues/[id]/gompertz", error, "Erreur serveur lors du calcul Gompertz.");
  }
}
