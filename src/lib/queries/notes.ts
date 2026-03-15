import { prisma } from "@/lib/db";
import { VisibiliteNote, StatutActivation } from "@/types";
import type { CreateNoteIngenieurDTO, UpdateNoteIngenieurDTO, NoteIngenieurFilters } from "@/types";
import { getOrCreateSystemUser } from "@/lib/queries/users";

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
  const where: Record<string, unknown> = { siteId };

  if (filters?.clientSiteId) where.clientSiteId = filters.clientSiteId;
  if (filters?.visibility) where.visibility = filters.visibility;
  if (filters?.isUrgent !== undefined) where.isUrgent = filters.isUrgent;
  if (filters?.isRead !== undefined) where.isRead = filters.isRead;
  if (filters?.isFromClient !== undefined) where.isFromClient = filters.isFromClient;
  if (filters?.vagueId) where.vagueId = filters.vagueId;

  return prisma.noteIngenieur.findMany({
    where,
    include: {
      ingenieur: { select: { id: true, name: true } },
      clientSite: { select: { id: true, name: true } },
      vague: { select: { id: true, code: true } },
      site: { select: { id: true, name: true } },
    },
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
      ingenieur: { select: { id: true, name: true } },
      clientSite: { select: { id: true, name: true } },
      vague: { select: { id: true, code: true } },
      site: { select: { id: true, name: true } },
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
    },
    include: {
      ingenieur: { select: { id: true, name: true } },
      clientSite: { select: { id: true, name: true } },
      vague: { select: { id: true, code: true } },
      site: { select: { id: true, name: true } },
    },
  });
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
    include: {
      ingenieur: { select: { id: true, name: true } },
      clientSite: { select: { id: true, name: true } },
      vague: { select: { id: true, code: true } },
      site: { select: { id: true, name: true } },
    },
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
  };

  if (filters?.vagueId) where.vagueId = filters.vagueId;
  if (filters?.isUrgent !== undefined) where.isUrgent = filters.isUrgent;

  const notes = await prisma.noteIngenieur.findMany({
    where,
    include: {
      ingenieur: { select: { id: true, name: true } },
      vague: { select: { id: true, code: true } },
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
      OR: [
        { isFromClient: true },
        { isFromClient: false, visibility: VisibiliteNote.PUBLIC },
      ],
    },
    include: {
      ingenieur: { select: { id: true, name: true } },
      clientSite: { select: { id: true, name: true } },
      vague: { select: { id: true, code: true } },
      site: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
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
    },
    include: {
      ingenieur: { select: { id: true, name: true } },
      clientSite: { select: { id: true, name: true } },
      vague: { select: { id: true, code: true } },
    },
  });
}
