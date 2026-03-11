import { NextRequest, NextResponse } from "next/server";
import { getReleveById, updateReleve } from "@/lib/queries/releves";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import {
  TypeReleve,
  CauseMortalite,
  TypeAliment,
  MethodeComptage,
  Permission,
} from "@/types";
import type { UpdateReleveDTO } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_VOIR);
    const { id } = await params;
    const releve = await getReleveById(auth.activeSiteId, id);

    if (!releve) {
      return NextResponse.json(
        { status: 404, message: "Releve introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(releve);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation du releve." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_MODIFIER);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // typeReleve is never modifiable
    if (body.typeReleve !== undefined) {
      errors.push({
        field: "typeReleve",
        message: "Le type de releve ne peut pas etre modifie.",
      });
    }

    // Structural fields are not modifiable
    for (const field of ["vagueId", "bacId", "date", "siteId"]) {
      if (body[field] !== undefined) {
        errors.push({
          field,
          message: `Le champ '${field}' ne peut pas etre modifie.`,
        });
      }
    }

    // Validate type-specific fields if provided
    if (body.poidsMoyen !== undefined && (typeof body.poidsMoyen !== "number" || body.poidsMoyen <= 0)) {
      errors.push({ field: "poidsMoyen", message: "Le poids moyen doit etre superieur a 0." });
    }
    if (body.tailleMoyenne !== undefined && (typeof body.tailleMoyenne !== "number" || body.tailleMoyenne <= 0)) {
      errors.push({ field: "tailleMoyenne", message: "La taille moyenne doit etre superieure a 0." });
    }
    if (body.echantillonCount !== undefined && (typeof body.echantillonCount !== "number" || !Number.isInteger(body.echantillonCount) || body.echantillonCount <= 0)) {
      errors.push({ field: "echantillonCount", message: "Le nombre d'echantillons doit etre un entier superieur a 0." });
    }
    if (body.nombreMorts !== undefined && (typeof body.nombreMorts !== "number" || !Number.isInteger(body.nombreMorts) || body.nombreMorts < 0)) {
      errors.push({ field: "nombreMorts", message: "Le nombre de morts doit etre un entier positif ou nul." });
    }
    if (body.causeMortalite !== undefined && !Object.values(CauseMortalite).includes(body.causeMortalite)) {
      errors.push({ field: "causeMortalite", message: `Valeurs acceptees : ${Object.values(CauseMortalite).join(", ")}.` });
    }
    if (body.quantiteAliment !== undefined && (typeof body.quantiteAliment !== "number" || body.quantiteAliment <= 0)) {
      errors.push({ field: "quantiteAliment", message: "La quantite d'aliment doit etre superieure a 0." });
    }
    if (body.typeAliment !== undefined && !Object.values(TypeAliment).includes(body.typeAliment)) {
      errors.push({ field: "typeAliment", message: `Valeurs acceptees : ${Object.values(TypeAliment).join(", ")}.` });
    }
    if (body.frequenceAliment !== undefined && (typeof body.frequenceAliment !== "number" || !Number.isInteger(body.frequenceAliment) || body.frequenceAliment <= 0)) {
      errors.push({ field: "frequenceAliment", message: "La frequence doit etre un entier superieur a 0." });
    }
    if (body.nombreCompte !== undefined && (typeof body.nombreCompte !== "number" || !Number.isInteger(body.nombreCompte) || body.nombreCompte < 0)) {
      errors.push({ field: "nombreCompte", message: "Le nombre compte doit etre un entier positif ou nul." });
    }
    if (body.methodeComptage !== undefined && !Object.values(MethodeComptage).includes(body.methodeComptage)) {
      errors.push({ field: "methodeComptage", message: `Valeurs acceptees : ${Object.values(MethodeComptage).join(", ")}.` });
    }
    if (body.description !== undefined && (typeof body.description !== "string" || body.description.trim() === "")) {
      errors.push({ field: "description", message: "La description ne peut pas etre vide." });
    }

    // Validate consommations if provided
    if (body.consommations !== undefined) {
      if (!Array.isArray(body.consommations)) {
        errors.push({ field: "consommations", message: "consommations doit etre un tableau." });
      } else {
        for (let i = 0; i < body.consommations.length; i++) {
          const c = body.consommations[i];
          if (!c.produitId || typeof c.produitId !== "string") {
            errors.push({ field: `consommations[${i}].produitId`, message: "produitId est requis." });
          }
          if (typeof c.quantite !== "number" || c.quantite <= 0) {
            errors.push({ field: `consommations[${i}].quantite`, message: "quantite doit etre superieure a 0." });
          }
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    // Build clean DTO
    const data: UpdateReleveDTO = {};
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.poidsMoyen !== undefined) data.poidsMoyen = body.poidsMoyen;
    if (body.tailleMoyenne !== undefined) data.tailleMoyenne = body.tailleMoyenne;
    if (body.echantillonCount !== undefined) data.echantillonCount = body.echantillonCount;
    if (body.nombreMorts !== undefined) data.nombreMorts = body.nombreMorts;
    if (body.causeMortalite !== undefined) data.causeMortalite = body.causeMortalite;
    if (body.quantiteAliment !== undefined) data.quantiteAliment = body.quantiteAliment;
    if (body.typeAliment !== undefined) data.typeAliment = body.typeAliment;
    if (body.frequenceAliment !== undefined) data.frequenceAliment = body.frequenceAliment;
    if (body.temperature !== undefined) data.temperature = body.temperature;
    if (body.ph !== undefined) data.ph = body.ph;
    if (body.oxygene !== undefined) data.oxygene = body.oxygene;
    if (body.ammoniac !== undefined) data.ammoniac = body.ammoniac;
    if (body.nombreCompte !== undefined) data.nombreCompte = body.nombreCompte;
    if (body.methodeComptage !== undefined) data.methodeComptage = body.methodeComptage;
    if (body.description !== undefined) data.description = body.description.trim();
    if (body.consommations !== undefined) data.consommations = body.consommations;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { status: 400, message: "Aucun champ a modifier." },
        { status: 400 }
      );
    }

    const releve = await updateReleve(auth.activeSiteId, auth.userId, id, data);
    return NextResponse.json(releve);
  } catch (error) {
    console.error("[PUT /api/releves/[id]] Error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }

    if (message.includes("Stock insuffisant") || message.includes("n'appartient pas") || message.includes("n'est pas de categorie")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la mise a jour du releve." },
      { status: 500 }
    );
  }
}
