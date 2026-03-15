import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import {
  getObservationsClient,
  createObservationClient,
} from "@/lib/queries/notes";

// ---------------------------------------------------------------------------
// Types d'observation disponibles pour un client PISCICULTEUR
// ---------------------------------------------------------------------------

const TYPES_OBSERVATION = [
  "mortalite",
  "eau",
  "comportement",
  "alimentation",
  "autre",
] as const;

type TypeObservation = (typeof TYPES_OBSERVATION)[number];

const TYPE_LABELS: Record<TypeObservation, string> = {
  mortalite: "Mortalite",
  eau: "Qualite de l'eau",
  comportement: "Comportement",
  alimentation: "Alimentation",
  autre: "Autre",
};

// ---------------------------------------------------------------------------
// GET /api/mes-observations
// Client PISCICULTEUR — liste ses observations + reponses de l'ingenieur
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    if (!session.activeSiteId) {
      return NextResponse.json(
        { status: 400, message: "Aucun site actif selectionne." },
        { status: 400 }
      );
    }

    const notes = await getObservationsClient(session.activeSiteId);

    return NextResponse.json({ notes, total: notes.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la recuperation des observations.",
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/mes-observations
// Client PISCICULTEUR — envoie une observation a l'ingenieur DKFarm
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    if (!session.activeSiteId) {
      return NextResponse.json(
        { status: 400, message: "Aucun site actif selectionne." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation — observationTexte obligatoire
    if (
      !body.observationTexte ||
      typeof body.observationTexte !== "string" ||
      body.observationTexte.trim() === ""
    ) {
      errors.push({
        field: "observationTexte",
        message: "Le texte de l'observation est obligatoire.",
      });
    } else if (body.observationTexte.length > 2000) {
      // S3 : validation longueur côté API (le frontend limite à 2000 chars)
      errors.push({
        field: "observationTexte",
        message: "Le texte de l'observation ne peut pas dépasser 2000 caractères.",
      });
    }

    // Validation — type obligatoire
    if (
      !body.type ||
      !TYPES_OBSERVATION.includes(body.type as TypeObservation)
    ) {
      errors.push({
        field: "type",
        message: `Le type est obligatoire. Valeurs acceptees : ${TYPES_OBSERVATION.join(", ")}.`,
      });
    }

    // Validation — vagueId optionnel mais doit etre une string si fourni
    if (
      body.vagueId !== undefined &&
      body.vagueId !== null &&
      (typeof body.vagueId !== "string" || body.vagueId.trim() === "")
    ) {
      errors.push({
        field: "vagueId",
        message: "vagueId doit etre un identifiant valide.",
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    // Le titre est construit depuis le type : "[TYPE] — texte court"
    const typeLabel = TYPE_LABELS[body.type as TypeObservation];
    const shortText = (body.observationTexte as string).trim();
    const titre = `[${typeLabel}] — ${shortText.substring(0, 60)}${shortText.length > 60 ? "..." : ""}`;

    const note = await createObservationClient(
      session.activeSiteId,
      session.userId,
      {
        titre,
        // contenu = texte complet de l'observation (identique a observationTexte)
        contenu: shortText,
        observationTexte: shortText,
        vagueId: body.vagueId ?? undefined,
      }
    );

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";

    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }

    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la creation de l'observation.",
      },
      { status: 500 }
    );
  }
}
