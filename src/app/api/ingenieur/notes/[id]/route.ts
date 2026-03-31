import { NextRequest, NextResponse } from "next/server";
import { getNoteById, updateNote, markNoteRead, markThreadRepliesRead } from "@/lib/queries/notes";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission, VisibiliteNote } from "@/types";
import type { UpdateNoteIngenieurDTO } from "@/types";
import { apiError } from "@/lib/api-utils";

/**
 * GET /api/ingenieur/notes/[id]
 *
 * Recupere le detail d'une note ingenieur.
 *
 * Permission requise : ENVOYER_NOTES
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.ENVOYER_NOTES);
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return apiError(400, "L'identifiant de la note est requis.");
    }

    const note = await getNoteById(id, auth.activeSiteId);

    if (!note) {
      return apiError(404, "Note introuvable.");
    }

    // Marquer les reponses du thread comme lues quand l'ingenieur ouvre la note
    await markThreadRepliesRead(id, auth.userId);

    return NextResponse.json(note);
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    return apiError(500, "Erreur serveur lors de la recuperation de la note.");
  }
}

/**
 * PUT /api/ingenieur/notes/[id]
 *
 * Met a jour une note ingenieur (modification partielle).
 * Tous les champs sont optionnels.
 *
 * Permission requise : ENVOYER_NOTES
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.ENVOYER_NOTES);
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return apiError(400, "L'identifiant de la note est requis.");
    }

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // Validation conditionnelle des champs fournis
    if (body.titre !== undefined) {
      if (typeof body.titre !== "string" || body.titre.trim() === "") {
        errors.push({ field: "titre", message: "Le titre ne peut pas etre vide." });
      }
    }

    if (body.contenu !== undefined) {
      if (typeof body.contenu !== "string" || body.contenu.trim() === "") {
        errors.push({ field: "contenu", message: "Le contenu ne peut pas etre vide." });
      }
    }

    if (body.visibility !== undefined) {
      if (!Object.values(VisibiliteNote).includes(body.visibility)) {
        errors.push({
          field: "visibility",
          message: "Valeur de visibility invalide. Valeurs acceptees : PUBLIC, INTERNE.",
        });
      }
    }

    if (body.isUrgent !== undefined && typeof body.isUrgent !== "boolean") {
      errors.push({ field: "isUrgent", message: "isUrgent doit etre un booleen." });
    }

    if (body.isRead !== undefined && typeof body.isRead !== "boolean") {
      errors.push({ field: "isRead", message: "isRead doit etre un booleen." });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    // Fast path: isRead-only update (mark as read) — uses ingenieurId instead of siteId
    // This handles client observations whose siteId is the client's farm, not DKFarm
    const bodyKeys = Object.keys(body).filter(k => body[k] !== undefined);
    if (bodyKeys.length === 1 && bodyKeys[0] === "isRead" && body.isRead === true) {
      const success = await markNoteRead(id, auth.userId);
      if (!success) {
        return apiError(404, "Note introuvable ou acces refuse.");
      }
      return NextResponse.json({ status: 200, message: "Note marquee comme lue." });
    }

    const data: UpdateNoteIngenieurDTO = {
      ...(body.titre !== undefined && { titre: body.titre }),
      ...(body.contenu !== undefined && { contenu: body.contenu }),
      ...(body.visibility !== undefined && {
        visibility: body.visibility as VisibiliteNote,
      }),
      ...(body.isUrgent !== undefined && { isUrgent: body.isUrgent }),
      ...(body.isRead !== undefined && { isRead: body.isRead }),
      // vagueId peut etre null (pour dissocier) ou une chaine
      ...(body.vagueId !== undefined && { vagueId: body.vagueId }),
    };

    const note = await updateNote(id, auth.activeSiteId, data);

    if (!note) {
      return apiError(404, "Note introuvable ou acces refuse.");
    }

    return NextResponse.json(note);
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
      { status: 500, message: `Erreur serveur lors de la mise a jour de la note : ${message}` },
      { status: 500 }
    );
  }
}
