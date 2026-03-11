import { NextRequest, NextResponse } from "next/server";
import { getReleves, createReleve } from "@/lib/queries/releves";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { TypeReleve, CauseMortalite, TypeAliment, MethodeComptage, Permission } from "@/types";
import type { CreateReleveDTO, ReleveFilters } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_VOIR);
    const { searchParams } = new URL(request.url);

    const filters: ReleveFilters = {};
    const vagueId = searchParams.get("vagueId");
    const bacId = searchParams.get("bacId");
    const typeReleve = searchParams.get("typeReleve");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (vagueId) filters.vagueId = vagueId;
    if (bacId) filters.bacId = bacId;
    if (typeReleve) {
      if (!Object.values(TypeReleve).includes(typeReleve as TypeReleve)) {
        return NextResponse.json(
          {
            status: 400,
            message: `Type de releve invalide. Valeurs acceptees : ${Object.values(TypeReleve).join(", ")}.`,
            field: "typeReleve",
          },
          { status: 400 }
        );
      }
      filters.typeReleve = typeReleve as TypeReleve;
    }
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (searchParams.get("nonLie") === "true") filters.nonLie = true;

    const result = await getReleves(auth.activeSiteId, filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/releves] Error:", error);
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des releves." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.RELEVES_CREER);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Common required fields
    if (!body.typeReleve) {
      errors.push({
        field: "typeReleve",
        message: "Le type de releve est obligatoire.",
      });
    } else if (
      !Object.values(TypeReleve).includes(body.typeReleve as TypeReleve)
    ) {
      errors.push({
        field: "typeReleve",
        message: `Type de releve invalide. Valeurs acceptees : ${Object.values(TypeReleve).join(", ")}.`,
      });
    }

    if (!body.vagueId || typeof body.vagueId !== "string") {
      errors.push({
        field: "vagueId",
        message: "L'identifiant de la vague est obligatoire.",
      });
    }

    if (!body.bacId || typeof body.bacId !== "string") {
      errors.push({
        field: "bacId",
        message: "L'identifiant du bac est obligatoire.",
      });
    }

    // Type-specific validations
    if (body.typeReleve === TypeReleve.BIOMETRIE) {
      if (body.poidsMoyen == null || typeof body.poidsMoyen !== "number" || body.poidsMoyen <= 0) {
        errors.push({
          field: "poidsMoyen",
          message: "Le poids moyen est obligatoire et doit etre superieur a 0.",
        });
      }
      if (body.tailleMoyenne == null || typeof body.tailleMoyenne !== "number" || body.tailleMoyenne <= 0) {
        errors.push({
          field: "tailleMoyenne",
          message: "La taille moyenne est obligatoire et doit etre superieure a 0.",
        });
      }
      if (
        body.echantillonCount == null ||
        typeof body.echantillonCount !== "number" ||
        !Number.isInteger(body.echantillonCount) ||
        body.echantillonCount <= 0
      ) {
        errors.push({
          field: "echantillonCount",
          message: "Le nombre d'echantillons est obligatoire et doit etre un entier superieur a 0.",
        });
      }
    }

    if (body.typeReleve === TypeReleve.MORTALITE) {
      if (
        body.nombreMorts == null ||
        typeof body.nombreMorts !== "number" ||
        !Number.isInteger(body.nombreMorts) ||
        body.nombreMorts < 0
      ) {
        errors.push({
          field: "nombreMorts",
          message: "Le nombre de morts est obligatoire et doit etre un entier positif ou nul.",
        });
      }
      if (
        !body.causeMortalite ||
        !Object.values(CauseMortalite).includes(body.causeMortalite as CauseMortalite)
      ) {
        errors.push({
          field: "causeMortalite",
          message: `La cause de mortalite est obligatoire. Valeurs acceptees : ${Object.values(CauseMortalite).join(", ")}.`,
        });
      }
    }

    if (body.typeReleve === TypeReleve.ALIMENTATION) {
      if (
        body.quantiteAliment == null ||
        typeof body.quantiteAliment !== "number" ||
        body.quantiteAliment <= 0
      ) {
        errors.push({
          field: "quantiteAliment",
          message: "La quantite d'aliment est obligatoire et doit etre superieure a 0.",
        });
      }
      if (
        !body.typeAliment ||
        !Object.values(TypeAliment).includes(body.typeAliment as TypeAliment)
      ) {
        errors.push({
          field: "typeAliment",
          message: `Le type d'aliment est obligatoire. Valeurs acceptees : ${Object.values(TypeAliment).join(", ")}.`,
        });
      }
      if (
        body.frequenceAliment == null ||
        typeof body.frequenceAliment !== "number" ||
        !Number.isInteger(body.frequenceAliment) ||
        body.frequenceAliment <= 0
      ) {
        errors.push({
          field: "frequenceAliment",
          message: "La frequence d'alimentation est obligatoire et doit etre un entier superieur a 0.",
        });
      }
    }

    if (body.typeReleve === TypeReleve.COMPTAGE) {
      if (
        body.nombreCompte == null ||
        typeof body.nombreCompte !== "number" ||
        !Number.isInteger(body.nombreCompte) ||
        body.nombreCompte < 0
      ) {
        errors.push({
          field: "nombreCompte",
          message: "Le nombre compte est obligatoire et doit etre un entier positif ou nul.",
        });
      }
      if (
        !body.methodeComptage ||
        !Object.values(MethodeComptage).includes(body.methodeComptage as MethodeComptage)
      ) {
        errors.push({
          field: "methodeComptage",
          message: `La methode de comptage est obligatoire. Valeurs acceptees : ${Object.values(MethodeComptage).join(", ")}.`,
        });
      }
    }

    if (body.typeReleve === TypeReleve.OBSERVATION) {
      if (!body.description || typeof body.description !== "string" || body.description.trim() === "") {
        errors.push({
          field: "description",
          message: "La description est obligatoire pour une observation.",
        });
      }
    }

    // Validate optional activiteId
    let activiteId: string | undefined;
    if (body.activiteId != null) {
      if (typeof body.activiteId !== "string" || body.activiteId.trim() === "") {
        errors.push({
          field: "activiteId",
          message: "L'identifiant d'activite doit etre une chaine non vide.",
        });
      } else {
        activiteId = body.activiteId.trim();
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    // Validate consommations if present
    if (body.consommations != null) {
      if (!Array.isArray(body.consommations)) {
        errors.push({ field: "consommations", message: "Les consommations doivent etre un tableau." });
      } else {
        for (let i = 0; i < body.consommations.length; i++) {
          const c = body.consommations[i];
          if (!c.produitId || typeof c.produitId !== "string") {
            errors.push({ field: `consommations[${i}].produitId`, message: "L'identifiant du produit est obligatoire." });
          }
          if (c.quantite == null || typeof c.quantite !== "number" || c.quantite <= 0) {
            errors.push({ field: `consommations[${i}].quantite`, message: "La quantite doit etre superieure a 0." });
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

    // Build clean DTO from validated fields
    const consommations = Array.isArray(body.consommations) && body.consommations.length > 0
      ? body.consommations.map((c: { produitId: string; quantite: number }) => ({
          produitId: c.produitId,
          quantite: c.quantite,
        }))
      : undefined;

    const base = {
      vagueId: body.vagueId,
      bacId: body.bacId,
      ...(body.notes != null && { notes: body.notes }),
      ...(consommations && { consommations }),
    };

    let dto!: CreateReleveDTO;

    switch (body.typeReleve as TypeReleve) {
      case TypeReleve.BIOMETRIE:
        dto = {
          ...base,
          typeReleve: TypeReleve.BIOMETRIE,
          poidsMoyen: body.poidsMoyen,
          tailleMoyenne: body.tailleMoyenne,
          echantillonCount: body.echantillonCount,
        };
        break;
      case TypeReleve.MORTALITE:
        dto = {
          ...base,
          typeReleve: TypeReleve.MORTALITE,
          nombreMorts: body.nombreMorts,
          causeMortalite: body.causeMortalite,
        };
        break;
      case TypeReleve.ALIMENTATION:
        dto = {
          ...base,
          typeReleve: TypeReleve.ALIMENTATION,
          quantiteAliment: body.quantiteAliment,
          typeAliment: body.typeAliment,
          frequenceAliment: body.frequenceAliment,
        };
        break;
      case TypeReleve.QUALITE_EAU:
        dto = {
          ...base,
          typeReleve: TypeReleve.QUALITE_EAU,
          ...(body.temperature != null && { temperature: body.temperature }),
          ...(body.ph != null && { ph: body.ph }),
          ...(body.oxygene != null && { oxygene: body.oxygene }),
          ...(body.ammoniac != null && { ammoniac: body.ammoniac }),
        };
        break;
      case TypeReleve.COMPTAGE:
        dto = {
          ...base,
          typeReleve: TypeReleve.COMPTAGE,
          nombreCompte: body.nombreCompte,
          methodeComptage: body.methodeComptage,
        };
        break;
      case TypeReleve.OBSERVATION:
        dto = {
          ...base,
          typeReleve: TypeReleve.OBSERVATION,
          description: body.description.trim(),
        };
        break;
      default:
        return NextResponse.json(
          { status: 400, message: `Type de relevé non supporté: ${body.typeReleve}` },
          { status: 400 }
        );
    }

    const releve = await createReleve(auth.activeSiteId, auth.userId, dto, activiteId);
    return NextResponse.json(releve, { status: 201 });
  } catch (error) {
    console.error("[POST /api/releves] Error:", error);
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

    if (message.includes("n'appartient pas") || message.includes("cloturee") || message.includes("Stock insuffisant") || message.includes("n'est pas de categorie")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la creation du releve." },
      { status: 500 }
    );
  }
}
