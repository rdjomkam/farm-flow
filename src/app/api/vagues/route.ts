import { NextRequest, NextResponse } from "next/server";
import { getVagues, createVague } from "@/lib/queries/vagues";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import type { CreateVagueDTO } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { searchParams } = new URL(request.url);
    const statut = searchParams.get("statut");

    const vagues = await getVagues(auth.activeSiteId, statut ? { statut } : undefined);

    const result = vagues.map((v) => {
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

    return NextResponse.json({ vagues: result, total: result.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des vagues." },
      { status: 500 }
    );
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

    if (!Array.isArray(body.bacIds) || body.bacIds.length === 0) {
      errors.push({
        field: "bacIds",
        message: "Au moins un bac doit etre selectionne.",
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: CreateVagueDTO = {
      code: body.code.trim(),
      dateDebut: body.dateDebut,
      nombreInitial: body.nombreInitial,
      poidsMoyenInitial: body.poidsMoyenInitial,
      origineAlevins: body.origineAlevins ?? undefined,
      bacIds: body.bacIds,
    };

    const vague = await createVague(auth.activeSiteId, data);

    if (!vague) {
      return NextResponse.json(
        { status: 500, message: "Erreur lors de la creation de la vague." },
        { status: 500 }
      );
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
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("deja assigne") || message.includes("deja utilise")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }

    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation de la vague." },
      { status: 500 }
    );
  }
}
