import { prisma } from "@/lib/db";
import { VisibiliteNote, StatutActivation, StatutVague } from "@/types";
import type { CreateNoteIngenieurDTO, UpdateNoteIngenieurDTO, NoteIngenieurFilters } from "@/types";
import { getOrCreateSystemUser } from "@/lib/queries/users";

// ---------------------------------------------------------------------------
// Shared include constant
// ---------------------------------------------------------------------------

const noteInclude = {
  ingenieur: { select: { id: true, name: true } },
  clientSite: { select: { id: true, name: true } },
  vague: { select: { id: true, code: true } },
  site: { select: { id: true, name: true } },
  _count: { select: { replies: true } },
};

// ---------------------------------------------------------------------------
// Queries NoteIngenieur
// ---------------------------------------------------------------------------

/**
 * Liste les notes ingenieur avec filtres optionnels.
 * Usage ingenieur : peut voir PUBLIC + INTERNE.
 * Usage client : ne voir que les notes PUBLIC via getNotesPourClient.
 *
 * @param siteId  - Site DKFarm de l'ingenieur (R8)
 * @param filters - Filtres optionnels
 */
export async function getNotes(siteId: string, filters?: NoteIngenieurFilters) {
  const where: Record<string, unknown> = {};

  // Quand on filtre par client, scoper par clientSiteId pour voir
  // TOUTES les notes (ingenieur + observations client).
  // Sans filtre client, scoper par siteId (vue globale DKFarm).
  if (filters?.clientSiteId) {
    where.clientSiteId = filters.clientSiteId;
  } else {
    where.siteId = siteId;
  }
  if (filters?.visibility) where.visibility = filters.visibility;
  if (filters?.isUrgent !== undefined) where.isUrgent = filters.isUrgent;
  if (filters?.isRead !== undefined) where.isRead = filters.isRead;
  if (filters?.isFromClient !== undefined) where.isFromClient = filters.isFromClient;
  if (filters?.vagueId) where.vagueId = filters.vagueId;
  where.replyToId = null;

  return prisma.noteIngenieur.findMany({
    where,
    include: noteInclude,
    orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Recupere une note par ID (verifie appartenance au site).
 *
 * @param id     - ID de la note
 * @param siteId - Site DKFarm de l'ingenieur (R8)
 */
export async function getNoteById(id: string, siteId: string) {
  return prisma.noteIngenieur.findFirst({
    where: { id, siteId },
    include: {
      ...noteInclude,
      replies: { include: noteInclude, orderBy: { createdAt: "asc" } },
    },
  });
}

/**
 * Cree une note ingenieur.
 *
 * @param siteId      - Site DKFarm de l'ingenieur (R8)
 * @param ingenieurId - ID de l'ingenieur auteur
 * @param data        - DTO de creation
 */
export async function createNote(
  siteId: string,
  ingenieurId: string,
  data: CreateNoteIngenieurDTO
) {
  // --- Reply path ---
  if (data.replyToId) {
    const parent = await prisma.noteIngenieur.findFirst({
      where: { id: data.replyToId },
    });
    if (!parent) {
      throw new Error("La note parente est introuvable.");
    }

    return prisma.noteIngenieur.create({
      data: {
        titre: data.titre?.trim() ? data.titre.trim() : `Re: ${parent.titre}`,
        contenu: data.contenu.trim(),
        visibility: data.visibility,
        isUrgent: data.isUrgent ?? false,
        isFromClient: data.isFromClient ?? false,
        observationTexte: data.observationTexte?.trim() ?? null,
        ingenieurId,
        clientSiteId: parent.clientSiteId,
        vagueId: parent.vagueId,
        siteId,
        replyToId: data.replyToId,
      },
      include: noteInclude,
    });
  }

  // --- Root note path ---
  // Verify clientSiteId is supervised by this site (via active PackActivation)
  const activation = await prisma.packActivation.findFirst({
    where: {
      siteId,
      clientSiteId: data.clientSiteId,
      statut: StatutActivation.ACTIVE,
    },
  });
  if (!activation) {
    throw new Error("Ce site client n'est pas supervise par votre site ou l'activation n'est plus active.");
  }

  // If vagueId provided, verify it belongs to the client site and is EN_COURS
  if (data.vagueId) {
    const vague = await prisma.vague.findFirst({
      where: {
        id: data.vagueId,
        siteId: data.clientSiteId,
        statut: StatutVague.EN_COURS,
      },
    });
    if (!vague) {
      throw new Error("La vague specifiee est introuvable, n'appartient pas a ce client, ou n'est plus en cours.");
    }
  }

  return prisma.noteIngenieur.create({
    data: {
      titre: data.titre.trim(),
      contenu: data.contenu.trim(),
      visibility: data.visibility,
      isUrgent: data.isUrgent ?? false,
      isFromClient: data.isFromClient ?? false,
      observationTexte: data.observationTexte?.trim() ?? null,
      ingenieurId,
      clientSiteId: data.clientSiteId,
      vagueId: data.vagueId ?? null,
      siteId,
      replyToId: null,
    },
    include: noteInclude,
  });
}

/**
 * Marque une note comme lue en verifiant par ingenieurId (pas siteId).
 * Permet a l'ingenieur de marquer comme lues les notes dont le siteId
 * est celui du client (observations soumises par le client).
 *
 * @param noteId      - ID de la note
 * @param ingenieurId - ID de l'ingenieur connecte
 */
export async function markNoteRead(noteId: string, ingenieurId: string): Promise<boolean> {
  const updated = await prisma.noteIngenieur.updateMany({
    where: { id: noteId, ingenieurId },
    data: { isRead: true },
  });
  return updated.count > 0;
}

/**
 * Met a jour une note ingenieur (modification partielle).
 *
 * @param id     - ID de la note
 * @param siteId - Site DKFarm de l'ingenieur (R8)
 * @param data   - DTO de mise a jour
 */
export async function updateNote(
  id: string,
  siteId: string,
  data: UpdateNoteIngenieurDTO
) {
  // Verifier que la note appartient bien au site (R4 : pas de check-then-update)
  const updated = await prisma.noteIngenieur.updateMany({
    where: { id, siteId },
    data: {
      ...(data.titre !== undefined && { titre: data.titre.trim() }),
      ...(data.contenu !== undefined && { contenu: data.contenu.trim() }),
      ...(data.visibility !== undefined && { visibility: data.visibility }),
      ...(data.isUrgent !== undefined && { isUrgent: data.isUrgent }),
      ...(data.isRead !== undefined && { isRead: data.isRead }),
      // vagueId peut etre null pour dissocier (passage explicite de null)
      ...(data.vagueId !== undefined && { vagueId: data.vagueId }),
    },
  });

  if (updated.count === 0) {
    return null;
  }

  return prisma.noteIngenieur.findFirst({
    where: { id, siteId },
    include: noteInclude,
  });
}

/**
 * Liste les notes PUBLIC destinee a un site client.
 * Utilise par le client pour consulter ses notes.
 * Marque automatiquement les notes comme lues (R4 : updateMany atomique).
 *
 * @param clientSiteId - Site client destinataire
 * @param vagueId      - Filtre optionnel par vague
 * @param isUrgent     - Filtre optionnel par urgence
 */
export async function getNotesPourClient(
  clientSiteId: string,
  filters?: { vagueId?: string; isUrgent?: boolean }
) {
  const where: Record<string, unknown> = {
    clientSiteId,
    visibility: VisibiliteNote.PUBLIC,
    replyToId: null,
  };

  if (filters?.vagueId) where.vagueId = filters.vagueId;
  if (filters?.isUrgent !== undefined) where.isUrgent = filters.isUrgent;

  const notes = await prisma.noteIngenieur.findMany({
    where,
    include: {
      ingenieur: { select: { id: true, name: true } },
      vague: { select: { id: true, code: true } },
      _count: { select: { replies: true } },
    },
    orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
  });

  // Marquer comme lues toutes les notes non lues retournees (R4 : atomique)
  const unreadIds = notes.filter((n) => !n.isRead).map((n) => n.id);
  if (unreadIds.length > 0) {
    await prisma.noteIngenieur.updateMany({
      where: { id: { in: unreadIds }, clientSiteId, visibility: VisibiliteNote.PUBLIC },
      data: { isRead: true },
    });
  }

  return notes;
}

// ---------------------------------------------------------------------------
// Observations client — S17-8 : communication bidirectionnelle
// ---------------------------------------------------------------------------

/**
 * Recupere toutes les observations et reponses pour un site client.
 *
 * Retourne :
 * - les observations soumises par le client (isFromClient=true)
 * - les reponses/notes PUBLIC de l'ingenieur (isFromClient=false, visibility=PUBLIC)
 *
 * Permet au PISCICULTEUR de voir l'historique complet de ses echanges avec DKFarm.
 *
 * @param clientSiteId - Site client
 */
export async function getObservationsClient(clientSiteId: string) {
  return prisma.noteIngenieur.findMany({
    where: {
      clientSiteId,
      replyToId: null,
      OR: [
        { isFromClient: true },
        { isFromClient: false, visibility: VisibiliteNote.PUBLIC },
      ],
    },
    include: noteInclude,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Fil unifie pour un site client : observations du client + notes PUBLIC de l'ingenieur.
 * Combine getObservationsClient (meme WHERE/OR) + mark-as-read des notes ingenieur.
 *
 * @param clientSiteId - Site client
 */
export async function getClientFeed(clientSiteId: string) {
  const notes = await prisma.noteIngenieur.findMany({
    where: {
      clientSiteId,
      replyToId: null,
      OR: [
        { isFromClient: true },
        { isFromClient: false, visibility: VisibiliteNote.PUBLIC },
      ],
    },
    include: noteInclude,
    orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
  });

  // Marquer comme lues les notes de l'ingenieur (pas les propres obs du client)
  const unreadEngineerIds = notes
    .filter((n) => !n.isRead && !n.isFromClient)
    .map((n) => n.id);
  if (unreadEngineerIds.length > 0) {
    await prisma.noteIngenieur.updateMany({
      where: { id: { in: unreadEngineerIds } },
      data: { isRead: true },
    });
  }

  return notes;
}

/**
 * Cree une observation soumise par un client PISCICULTEUR.
 *
 * Regles :
 * - isFromClient = true (identifie que l'auteur est un client)
 * - visibility = PUBLIC (visible par l'ingenieur DKFarm)
 * - siteId = clientSiteId (R8 : le site client est le siteId de l'observation)
 * - ingenieurId = ingenieur DKFarm assigné au site client via PackActivation, ou system user
 *   (le champ ingenieurId doit pointer vers un INGENIEUR, pas un PISCICULTEUR)
 *
 * @param clientSiteId     - Site client auteur de l'observation
 * @param userId           - Utilisateur connecte (PISCICULTEUR) — non utilisé comme ingenieurId
 * @param data             - Contenu de l'observation
 */
export async function createObservationClient(
  clientSiteId: string,
  _userId: string,
  data: {
    titre: string;
    contenu: string;
    observationTexte: string;
    vagueId?: string;
    replyToId?: string;
  }
) {
  // Chercher l'ingenieur DKFarm assigné au site client via PackActivation active
  // L'utilisateur ayant activé le pack (PackActivation.userId) est l'ingenieur responsable
  const packActivation = await prisma.packActivation.findFirst({
    where: {
      clientSiteId,
      statut: StatutActivation.ACTIVE,
    },
    select: { userId: true },
    orderBy: { dateActivation: "desc" },
  });

  // Utiliser l'ingenieur qui a cree l'activation, ou fallback vers le system user
  const ingenieurId =
    packActivation?.userId ?? (await getOrCreateSystemUser()).id;

  // --- Reply path ---
  if (data.replyToId) {
    const parent = await prisma.noteIngenieur.findFirst({
      where: { id: data.replyToId },
    });
    if (!parent) {
      throw new Error("La note parente est introuvable.");
    }

    return prisma.noteIngenieur.create({
      data: {
        titre: data.titre,
        contenu: data.contenu,
        observationTexte: data.observationTexte,
        visibility: VisibiliteNote.PUBLIC,
        isFromClient: true,
        isUrgent: false,
        isRead: false,
        ingenieurId,
        clientSiteId,
        siteId: clientSiteId,
        vagueId: parent.vagueId,
        replyToId: data.replyToId,
      },
      include: noteInclude,
    });
  }

  // --- Root observation path ---
  return prisma.noteIngenieur.create({
    data: {
      titre: data.titre,
      contenu: data.contenu,
      observationTexte: data.observationTexte,
      visibility: VisibiliteNote.PUBLIC,
      isFromClient: true,
      isUrgent: false,
      isRead: false,
      // ingenieurId = ingenieur DKFarm responsable du site (ou system user)
      // isFromClient=true identifie que l'observation vient du client PISCICULTEUR
      ingenieurId,
      clientSiteId,
      // R8 : siteId = clientSiteId (le site du client est le site de l'observation)
      siteId: clientSiteId,
      vagueId: data.vagueId ?? null,
      replyToId: null,
    },
    include: noteInclude,
  });
}

/**
 * Marque comme lues toutes les reponses d'un thread pour un ingenieur.
 *
 * @param parentId    - ID de la note racine du thread
 * @param ingenieurId - ID de l'ingenieur connecte
 */
export async function markThreadRepliesRead(parentId: string, ingenieurId: string) {
  await prisma.noteIngenieur.updateMany({
    where: { replyToId: parentId, ingenieurId, isRead: false },
    data: { isRead: true },
  });
}
