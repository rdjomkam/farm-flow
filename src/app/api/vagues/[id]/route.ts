import { NextRequest, NextResponse } from "next/server";
import { getVagueById, updateVague } from "@/lib/queries/vagues";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { StatutVague } from "@/types";
import type { UpdateVagueDTO } from "@/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vague = await getVagueById(id);

    if (!vague) {
      return NextResponse.json(
        { status: 404, message: "Vague introuvable." },
        { status: 404 }
      );
    }

    const indicateurs = await getIndicateursVague(id);

    return NextResponse.json({
      vague: {
        id: vague.id,
        code: vague.code,
        dateDebut: vague.dateDebut,
        dateFin: vague.dateFin,
        statut: vague.statut,
        nombreInitial: vague.nombreInitial,
        poidsMoyenInitial: vague.poidsMoyenInitial,
        origineAlevins: vague.origineAlevins,
        createdAt: vague.createdAt,
        updatedAt: vague.updatedAt,
      },
      bacs: vague.bacs,
      releves: vague.releves,
      indicateurs: indicateurs ?? {
        tauxSurvie: null,
        fcr: null,
        sgr: null,
        biomasse: null,
        poidsMoyen: null,
        tailleMoyenne: null,
        nombreVivants: null,
        totalMortalites: 0,
        totalAliment: 0,
        gainPoids: null,
        joursEcoules: 0,
      },
    });
  } catch {
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération de la vague." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validate statut if provided
    if (body.statut != null) {
      const validStatuts = Object.values(StatutVague);
      if (!validStatuts.includes(body.statut)) {
        errors.push({
          field: "statut",
          message: `Le statut doit être l'un de : ${validStatuts.join(", ")}.`,
        });
      }

      if (body.statut === StatutVague.TERMINEE && !body.dateFin) {
        errors.push({
          field: "dateFin",
          message:
            "La date de fin est obligatoire pour clôturer une vague.",
        });
      }
    }

    if (body.dateFin != null && typeof body.dateFin === "string" && isNaN(Date.parse(body.dateFin))) {
      errors.push({
        field: "dateFin",
        message: "La date de fin n'est pas une date valide.",
      });
    }

    if (body.addBacIds != null && (!Array.isArray(body.addBacIds) || body.addBacIds.length === 0)) {
      errors.push({
        field: "addBacIds",
        message: "addBacIds doit être un tableau non vide.",
      });
    }

    if (body.removeBacIds != null && (!Array.isArray(body.removeBacIds) || body.removeBacIds.length === 0)) {
      errors.push({
        field: "removeBacIds",
        message: "removeBacIds doit être un tableau non vide.",
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: UpdateVagueDTO = {};
    if (body.statut != null) data.statut = body.statut;
    if (body.dateFin != null) data.dateFin = body.dateFin;
    if (body.addBacIds != null) data.addBacIds = body.addBacIds;
    if (body.removeBacIds != null) data.removeBacIds = body.removeBacIds;

    const vague = await updateVague(id, data);

    const now = vague.dateFin ?? new Date();
    const joursEcoules = Math.floor(
      (now.getTime() - vague.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
    );

    return NextResponse.json({
      id: vague.id,
      code: vague.code,
      dateDebut: vague.dateDebut,
      dateFin: vague.dateFin,
      statut: vague.statut,
      nombreInitial: vague.nombreInitial,
      poidsMoyenInitial: vague.poidsMoyenInitial,
      origineAlevins: vague.origineAlevins,
      nombreBacs: vague._count.bacs,
      joursEcoules,
      createdAt: vague.createdAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }

    if (message.includes("déjà assigné") || message.includes("clôturée")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la mise à jour de la vague." },
      { status: 500 }
    );
  }
}
