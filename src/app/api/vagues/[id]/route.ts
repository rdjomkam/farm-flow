import { NextRequest, NextResponse } from "next/server";
import { getVagueById, updateVague } from "@/lib/queries/vagues";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { StatutVague, Permission } from "@/types";
import type { UpdateVagueDTO } from "@/types";
import { ErrorKeys } from "@/lib/api-error-keys";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_VOIR);
    const { id } = await params;
    const vague = await getVagueById(id, auth.activeSiteId);

    if (!vague) {
      return NextResponse.json(
        { status: 404, message: "Vague introuvable.", errorKey: ErrorKeys.NOT_FOUND_VAGUE },
        { status: 404 }
      );
    }

    const indicateurs = await getIndicateursVague(auth.activeSiteId, id);

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
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation de la vague.", errorKey: ErrorKeys.SERVER_GET_VAGUE },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.VAGUES_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validate statut if provided
    if (body.statut != null) {
      const validStatuts = Object.values(StatutVague);
      if (!validStatuts.includes(body.statut)) {
        errors.push({
          field: "statut",
          message: `Le statut doit etre l'un de : ${validStatuts.join(", ")}.`,
        });
      }

      if (body.statut === StatutVague.TERMINEE && !body.dateFin) {
        errors.push({
          field: "dateFin",
          message:
            "La date de fin est obligatoire pour cloturer une vague.",
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
        message: "addBacIds doit etre un tableau non vide.",
      });
    }

    if (body.removeBacIds != null && (!Array.isArray(body.removeBacIds) || body.removeBacIds.length === 0)) {
      errors.push({
        field: "removeBacIds",
        message: "removeBacIds doit etre un tableau non vide.",
      });
    }

    // Validate new editable fields
    if (body.nombreInitial !== undefined) {
      if (typeof body.nombreInitial !== "number" || !Number.isInteger(body.nombreInitial) || body.nombreInitial <= 0) {
        errors.push({ field: "nombreInitial", message: "Le nombre initial doit etre un entier superieur a 0." });
      }
    }

    if (body.poidsMoyenInitial !== undefined) {
      if (typeof body.poidsMoyenInitial !== "number" || body.poidsMoyenInitial <= 0) {
        errors.push({ field: "poidsMoyenInitial", message: "Le poids moyen initial doit etre superieur a 0." });
      }
    }

    if (body.origineAlevins !== undefined && body.origineAlevins !== null) {
      if (typeof body.origineAlevins !== "string") {
        errors.push({ field: "origineAlevins", message: "L'origine des alevins doit etre une chaine de caracteres." });
      }
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
    if (body.nombreInitial !== undefined) data.nombreInitial = body.nombreInitial;
    if (body.poidsMoyenInitial !== undefined) data.poidsMoyenInitial = body.poidsMoyenInitial;
    if (body.origineAlevins !== undefined) data.origineAlevins = body.origineAlevins;

    const vague = await updateVague(id, auth.activeSiteId, data);

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

    if (message.includes("deja assigne") || message.includes("cloturee") || message.includes("vague cloturee")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la mise a jour de la vague.", errorKey: ErrorKeys.SERVER_UPDATE_VAGUE },
      { status: 500 }
    );
  }
}
