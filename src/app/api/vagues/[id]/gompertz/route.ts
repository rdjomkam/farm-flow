import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, TypeReleve } from "@/types";
import {
  calibrerGompertz,
  genererCourbeGompertz,
  projeterDateRecolte,
  type GompertzParams,
} from "@/lib/gompertz";

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
        configElevage: {
          select: { poidsObjectif: true },
        },
        gompertz: true,
      },
    });

    if (!vague) {
      return NextResponse.json(
        { status: 404, message: "Vague introuvable." },
        { status: 404 }
      );
    }

    // 2. Count BIOMETRIE releves for this vague (scoped by site)
    const biometrieCount = await prisma.releve.count({
      where: {
        vagueId,
        siteId: auth.activeSiteId,
        typeReleve: TypeReleve.BIOMETRIE,
      },
    });

    // 3. Lazy calibration: recalibrate only if biometrieCount changed or no record exists
    const existingGompertz = vague.gompertz;
    const needsCalibration =
      !existingGompertz || existingGompertz.biometrieCount !== biometrieCount;

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
    } else if (biometrieCount < 5) {
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
          },
          update: {
            biometrieCount,
            confidenceLevel: "INSUFFICIENT_DATA",
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
      // 4a. Fetch all BIOMETRIE releves ordered by date (asc)
      const releves = await prisma.releve.findMany({
        where: {
          vagueId,
          siteId: auth.activeSiteId,
          typeReleve: TypeReleve.BIOMETRIE,
          poidsMoyen: { not: null },
        },
        select: { date: true, poidsMoyen: true },
        orderBy: { date: "asc" },
      });

      // 4b. Convert to calibration input: day index since vague start
      const vagueStartMs = vague.dateDebut.getTime();
      const points = releves
        .filter((r) => r.poidsMoyen !== null)
        .map((r) => ({
          jour: Math.floor(
            (r.date.getTime() - vagueStartMs) / (1000 * 60 * 60 * 24)
          ),
          poidsMoyen: r.poidsMoyen as number,
        }));

      // 4c. Calibrate
      const result = calibrerGompertz({ points });

      if (!result) {
        // calibrerGompertz returned null (< 5 points after filtering nulls)
        return NextResponse.json({
          vagueId,
          calibration: null,
          courbe: null,
          dateRecolteEstimee: null,
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
        },
        update: {
          wInfinity: result.params.wInfinity,
          k: result.params.k,
          ti: result.params.ti,
          r2: result.r2,
          rmse: result.rmse,
          biometrieCount: result.biometrieCount,
          confidenceLevel: result.confidenceLevel,
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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
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
