import { NextRequest, NextResponse } from "next/server";
import { getCalibrages, createCalibrage } from "@/lib/queries/calibrages";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, CategorieCalibrage } from "@/types";
import type { CreateCalibrageDTO } from "@/types";

const VALID_CATEGORIES = new Set(Object.values(CategorieCalibrage));
const MAX_GROUPES = 4;

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.CALIBRAGES_VOIR);
    const { searchParams } = new URL(request.url);

    const vagueId = searchParams.get("vagueId") ?? undefined;

    const calibrages = await getCalibrages(auth.activeSiteId, { vagueId });

    return NextResponse.json({
      calibrages,
      total: calibrages.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des calibrages." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.CALIBRAGES_CREER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.vagueId || typeof body.vagueId !== "string") {
      errors.push({ field: "vagueId", message: "La vague est obligatoire." });
    }

    if (
      !Array.isArray(body.sourceBacIds) ||
      body.sourceBacIds.length === 0 ||
      !body.sourceBacIds.every((id: unknown) => typeof id === "string")
    ) {
      errors.push({
        field: "sourceBacIds",
        message: "Au moins un bac source est obligatoire.",
      });
    }

    if (typeof body.nombreMorts !== "number" || body.nombreMorts < 0) {
      errors.push({
        field: "nombreMorts",
        message: "Le nombre de morts doit etre un entier >= 0.",
      });
    }

    if (!Array.isArray(body.groupes) || body.groupes.length === 0) {
      errors.push({
        field: "groupes",
        message: "Au moins un groupe de redistribution est obligatoire.",
      });
    } else if (body.groupes.length > MAX_GROUPES) {
      errors.push({
        field: "groupes",
        message: `Le nombre maximum de groupes est ${MAX_GROUPES}.`,
      });
    } else {
      body.groupes.forEach((g: unknown, index: number) => {
        const groupe = g as Record<string, unknown>;
        if (!groupe.categorie || typeof groupe.categorie !== "string" || !VALID_CATEGORIES.has(groupe.categorie as CategorieCalibrage)) {
          errors.push({
            field: `groupes[${index}].categorie`,
            message: "La categorie du groupe est invalide. Valeurs acceptees : PETIT, MOYEN, GROS, TRES_GROS.",
          });
        }
        if (!groupe.destinationBacId || typeof groupe.destinationBacId !== "string") {
          errors.push({
            field: `groupes[${index}].destinationBacId`,
            message: "Le bac de destination est obligatoire.",
          });
        }
        if (typeof groupe.nombrePoissons !== "number" || groupe.nombrePoissons <= 0) {
          errors.push({
            field: `groupes[${index}].nombrePoissons`,
            message: "Le nombre de poissons du groupe doit etre > 0.",
          });
        }
        if (typeof groupe.poidsMoyen !== "number" || groupe.poidsMoyen <= 0) {
          errors.push({
            field: `groupes[${index}].poidsMoyen`,
            message: "Le poids moyen du groupe doit etre > 0.",
          });
        }
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: CreateCalibrageDTO = {
      vagueId: body.vagueId,
      sourceBacIds: body.sourceBacIds,
      nombreMorts: body.nombreMorts,
      notes: body.notes?.trim() || undefined,
      groupes: body.groupes.map((g: Record<string, unknown>) => ({
        categorie: g.categorie as CreateCalibrageDTO["groupes"][number]["categorie"],
        destinationBacId: g.destinationBacId as string,
        nombrePoissons: g.nombrePoissons as number,
        poidsMoyen: g.poidsMoyen as number,
        tailleMoyenne: typeof g.tailleMoyenne === "number" ? g.tailleMoyenne : undefined,
      })),
    };

    const calibrage = await createCalibrage(auth.activeSiteId, auth.userId, data);
    return NextResponse.json(calibrage, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (
      message.includes("Conservation non respectee") ||
      message.includes("n'est possible que") ||
      message.includes("n'appartiennent pas") ||
      message.includes("ne contient aucun")
    ) {
      return NextResponse.json({ status: 400, message }, { status: 400 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du calibrage." },
      { status: 500 }
    );
  }
}
