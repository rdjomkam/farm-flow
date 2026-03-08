import { NextRequest, NextResponse } from "next/server";
import { getVagues, createVague } from "@/lib/queries/vagues";
import { StatutVague } from "@/types";
import type { CreateVagueDTO } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statut = searchParams.get("statut");

    const vagues = await getVagues(statut ? { statut } : undefined);

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
  } catch {
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération des vagues." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.code || typeof body.code !== "string" || body.code.trim() === "") {
      errors.push({ field: "code", message: "Le champ 'code' est obligatoire." });
    }

    if (!body.dateDebut || typeof body.dateDebut !== "string") {
      errors.push({
        field: "dateDebut",
        message: "La date de début est obligatoire (format ISO 8601).",
      });
    } else if (isNaN(Date.parse(body.dateDebut))) {
      errors.push({
        field: "dateDebut",
        message: "La date de début n'est pas une date valide.",
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
        message: "Le nombre initial doit être un entier supérieur à 0.",
      });
    }

    if (
      body.poidsMoyenInitial == null ||
      typeof body.poidsMoyenInitial !== "number" ||
      body.poidsMoyenInitial <= 0
    ) {
      errors.push({
        field: "poidsMoyenInitial",
        message: "Le poids moyen initial doit être un nombre supérieur à 0.",
      });
    }

    if (!Array.isArray(body.bacIds) || body.bacIds.length === 0) {
      errors.push({
        field: "bacIds",
        message: "Au moins un bac doit être sélectionné.",
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

    const vague = await createVague(data);

    if (!vague) {
      return NextResponse.json(
        { status: 500, message: "Erreur lors de la création de la vague." },
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
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("déjà assigné") || message.includes("déjà utilisé")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }

    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la création de la vague." },
      { status: 500 }
    );
  }
}
