import { NextRequest, NextResponse } from "next/server";
import { getBacs, createBac } from "@/lib/queries/bacs";
import type { CreateBacDTO } from "@/types";

export async function GET() {
  try {
    const bacs = await getBacs();
    return NextResponse.json({ bacs, total: bacs.length });
  } catch {
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la récupération des bacs." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const errors: { field: string; message: string }[] = [];

    if (!body.nom || typeof body.nom !== "string" || body.nom.trim() === "") {
      errors.push({ field: "nom", message: "Le champ 'nom' est obligatoire." });
    }

    if (body.volume == null || typeof body.volume !== "number" || body.volume <= 0) {
      errors.push({
        field: "volume",
        message: "Le volume doit être un nombre supérieur à 0.",
      });
    }

    if (
      body.nombrePoissons != null &&
      (typeof body.nombrePoissons !== "number" || body.nombrePoissons < 0)
    ) {
      errors.push({
        field: "nombrePoissons",
        message: "Le nombre de poissons doit être un nombre positif ou nul.",
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: CreateBacDTO = {
      nom: body.nom.trim(),
      volume: body.volume,
      ...(body.nombrePoissons != null && { nombrePoissons: body.nombrePoissons }),
    };

    const bac = await createBac(data);

    return NextResponse.json(bac, { status: 201 });
  } catch {
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la création du bac." },
      { status: 500 }
    );
  }
}
