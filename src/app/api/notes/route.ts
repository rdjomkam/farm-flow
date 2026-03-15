import { NextRequest, NextResponse } from "next/server";
import { getNotesPourClient } from "@/lib/queries/notes";
import { AuthError, requireAuth } from "@/lib/auth";

/**
 * GET /api/notes
 *
 * Endpoint CLIENT — retourne uniquement les notes avec visibility=PUBLIC
 * pour le site actif du client (clientSiteId = activeSiteId de la session).
 *
 * Les notes INTERNE ne sont jamais exposees ici.
 * Marque automatiquement les notes comme lues (isRead=true) lors de la consultation.
 *
 * Filtres disponibles : vagueId, isUrgent.
 *
 * Aucune permission specifique requise : toute session authentifiee avec un site actif
 * peut consulter les notes PUBLIC qui lui sont destinees.
 *
 * Note sur les roles (I3) : cet endpoint peut techniquement etre appele par un INGENIEUR.
 * Ce comportement est intentionnel — un ingenieur peut consulter les notes PUBLIC
 * qu'il a reçues comme client d'un autre site. Il ne voit que les notes PUBLIC
 * du site actif dans sa session, jamais les notes INTERNE.
 * Pour les notes internes, l'ingenieur doit utiliser GET /api/ingenieur/notes.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    if (!session.activeSiteId) {
      return NextResponse.json(
        { status: 403, message: "Aucun site actif selectionne." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const vagueId = searchParams.get("vagueId") ?? undefined;
    const isUrgentParam = searchParams.get("isUrgent");
    const isUrgent =
      isUrgentParam === "true" ? true : isUrgentParam === "false" ? false : undefined;

    // Les notes retournees sont uniquement les notes PUBLIC destinees au site actif du client
    // La fonction marque automatiquement les notes non lues comme lues (R4 : atomique)
    const notes = await getNotesPourClient(session.activeSiteId, { vagueId, isUrgent });

    return NextResponse.json({ notes, total: notes.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la recuperation des notes." },
      { status: 500 }
    );
  }
}
