import { NextRequest, NextResponse } from "next/server";
import { getReleves, createReleve } from "@/lib/queries/releves";
import { TypeReleve, CauseMortalite, TypeAliment, MethodeComptage } from "@/types";
import type { CreateReleveDTO, ReleveFilters } from "@/types";

export async function GET(request: NextRequest) {
  try {
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
            message: `Type de relevé invalide. Valeurs acceptées : ${Object.values(TypeReleve).join(", ")}.`,
            field: "typeReleve",
          },
          { status: 400 }
        );
      }
      filters.typeReleve = typeReleve as TypeReleve;
    }
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const result = await getReleves(filters);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération des relevés." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Common required fields
    if (!body.date || typeof body.date !== "string") {
      errors.push({ field: "date", message: "La date est obligatoire." });
    } else if (Number.isNaN(Date.parse(body.date))) {
      errors.push({ field: "date", message: "La date n'est pas valide." });
    }

    if (!body.typeReleve) {
      errors.push({
        field: "typeReleve",
        message: "Le type de relevé est obligatoire.",
      });
    } else if (
      !Object.values(TypeReleve).includes(body.typeReleve as TypeReleve)
    ) {
      errors.push({
        field: "typeReleve",
        message: `Type de relevé invalide. Valeurs acceptées : ${Object.values(TypeReleve).join(", ")}.`,
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
          message: "Le poids moyen est obligatoire et doit être supérieur à 0.",
        });
      }
      if (body.tailleMoyenne == null || typeof body.tailleMoyenne !== "number" || body.tailleMoyenne <= 0) {
        errors.push({
          field: "tailleMoyenne",
          message: "La taille moyenne est obligatoire et doit être supérieure à 0.",
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
          message: "Le nombre d'échantillons est obligatoire et doit être un entier supérieur à 0.",
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
          message: "Le nombre de morts est obligatoire et doit être un entier positif ou nul.",
        });
      }
      if (
        !body.causeMortalite ||
        !Object.values(CauseMortalite).includes(body.causeMortalite as CauseMortalite)
      ) {
        errors.push({
          field: "causeMortalite",
          message: `La cause de mortalité est obligatoire. Valeurs acceptées : ${Object.values(CauseMortalite).join(", ")}.`,
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
          message: "La quantité d'aliment est obligatoire et doit être supérieure à 0.",
        });
      }
      if (
        !body.typeAliment ||
        !Object.values(TypeAliment).includes(body.typeAliment as TypeAliment)
      ) {
        errors.push({
          field: "typeAliment",
          message: `Le type d'aliment est obligatoire. Valeurs acceptées : ${Object.values(TypeAliment).join(", ")}.`,
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
          message: "La fréquence d'alimentation est obligatoire et doit être un entier supérieur à 0.",
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
          message: "Le nombre compté est obligatoire et doit être un entier positif ou nul.",
        });
      }
      if (
        !body.methodeComptage ||
        !Object.values(MethodeComptage).includes(body.methodeComptage as MethodeComptage)
      ) {
        errors.push({
          field: "methodeComptage",
          message: `La méthode de comptage est obligatoire. Valeurs acceptées : ${Object.values(MethodeComptage).join(", ")}.`,
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

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    // Build clean DTO from validated fields
    const base = {
      date: body.date,
      vagueId: body.vagueId,
      bacId: body.bacId,
      ...(body.notes != null && { notes: body.notes }),
    };

    let dto: CreateReleveDTO;

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
    }

    const releve = await createReleve(dto);
    return NextResponse.json(releve, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }

    if (message.includes("n'appartient pas") || message.includes("clôturée")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }

    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la création du relevé." },
      { status: 500 }
    );
  }
}
