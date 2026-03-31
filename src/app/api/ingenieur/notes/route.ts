import { NextRequest, NextResponse } from "next/server";
import { getNotes, createNote } from "@/lib/queries/notes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, VisibiliteNote } from "@/types";
import type { CreateNoteIngenieurDTO } from "@/types";
import { apiError } from "@/lib/api-utils";

/**
 * GET /api/ingenieur/notes
 *
 * Liste les notes de l'ingenieur pour son site.
 * Filtres disponibles : clientSiteId, vagueId, isUrgent, isRead, isFromClient, visibility.
 *
 * Permission requise : ENVOYER_NOTES
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ENVOYER_NOTES);
    const { searchParams } = new URL(request.url);

    const clientSiteId = searchParams.get("clientSiteId") ?? undefined;
    const vagueId = searchParams.get("vagueId") ?? undefined;
    const visibility = searchParams.get("visibility") as VisibiliteNote | null;
    const isUrgentParam = searchParams.get("isUrgent");
    const isReadParam = searchParams.get("isRead");
    const isFromClientParam = searchParams.get("isFromClient");

    const isUrgent =
      isUrgentParam === "true" ? true : isUrgentParam === "false" ? false : undefined;
    const isRead =
      isReadParam === "true" ? true : isReadParam === "false" ? false : undefined;
    const isFromClient =
      isFromClientParam === "true" ? true : isFromClientParam === "false" ? false : undefined;

    // Valider la visibilite si fournie
    if (visibility && !Object.values(VisibiliteNote).includes(visibility)) {
      return NextResponse.json(
        { status: 400, message: "Valeur de visibility invalide. Valeurs acceptees : PUBLIC, INTERNE." },
        { status: 400 }
      );
    }

    const notes = await getNotes(auth.activeSiteId, {
      clientSiteId,
      vagueId,
      visibility: visibility ?? undefined,
      isUrgent,
      isRead,
      isFromClient,
    });

    return NextResponse.json({ notes, total: notes.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation des notes.");
  }
}

/**
 * POST /api/ingenieur/notes
 *
 * Cree une nouvelle note ingenieur.
 *
 * Permission requise : ENVOYER_NOTES
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.ENVOYER_NOTES);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation des champs obligatoires
    if (!body.titre || typeof body.titre !== "string" || body.titre.trim() === "") {
      errors.push({ field: "titre", message: "Le titre est obligatoire." });
    }

    if (!body.contenu || typeof body.contenu !== "string" || body.contenu.trim() === "") {
      errors.push({ field: "contenu", message: "Le contenu est obligatoire." });
    }

    if (!body.visibility || !Object.values(VisibiliteNote).includes(body.visibility)) {
      errors.push({
        field: "visibility",
        message: "La visibilite est obligatoire. Valeurs acceptees : PUBLIC, INTERNE.",
      });
    }

    // replyToId est optionnel — si fourni, clientSiteId est herite du parent
    const replyToId =
      body.replyToId && typeof body.replyToId === "string" ? body.replyToId : undefined;

    // clientSiteId est obligatoire seulement si ce n'est pas une reponse a un thread
    if (!replyToId && (!body.clientSiteId || typeof body.clientSiteId !== "string")) {
      errors.push({
        field: "clientSiteId",
        message: "Le site client destinataire est obligatoire.",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const data: CreateNoteIngenieurDTO = {
      titre: body.titre.trim(),
      contenu: body.contenu.trim(),
      visibility: body.visibility as VisibiliteNote,
      isUrgent: typeof body.isUrgent === "boolean" ? body.isUrgent : false,
      isFromClient: typeof body.isFromClient === "boolean" ? body.isFromClient : false,
      observationTexte:
        body.observationTexte && typeof body.observationTexte === "string"
          ? body.observationTexte
          : undefined,
      clientSiteId: body.clientSiteId,
      vagueId:
        body.vagueId && typeof body.vagueId === "string" ? body.vagueId : undefined,
      replyToId,
    };

    const note = await createNote(auth.activeSiteId, auth.userId, data);

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";
    return NextResponse.json(
      { status: 500, message: `Erreur serveur lors de la creation de la note : ${message}` },
      { status: 500 }
    );
  }
}
