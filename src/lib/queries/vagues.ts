import { prisma } from "@/lib/db";
import { StatutVague } from "@/types";
import type { CreateVagueDTO, UpdateVagueDTO } from "@/types";

/** Liste les vagues avec filtre optionnel sur le statut */
export async function getVagues(filters?: { statut?: string }) {
  const where: Record<string, unknown> = {};
  if (filters?.statut) where.statut = filters.statut;

  return prisma.vague.findMany({
    where,
    include: {
      _count: { select: { bacs: true, releves: true } },
    },
    orderBy: { dateDebut: "desc" },
  });
}

/** Recupere une vague par ID avec ses bacs et releves */
export async function getVagueById(id: string) {
  return prisma.vague.findUnique({
    where: { id },
    include: {
      bacs: { orderBy: { nom: "asc" } },
      releves: { orderBy: { date: "desc" } },
    },
  });
}

/** Cree une vague et assigne les bacs en transaction */
export async function createVague(data: CreateVagueDTO) {
  return prisma.$transaction(async (tx) => {
    // Verifier que tous les bacs existent et sont libres
    const bacs = await tx.bac.findMany({
      where: { id: { in: data.bacIds } },
    });

    if (bacs.length !== data.bacIds.length) {
      throw new Error("Un ou plusieurs bacs sont introuvables");
    }

    const bacsOccupes = bacs.filter((b) => b.vagueId !== null);
    if (bacsOccupes.length > 0) {
      const noms = bacsOccupes.map((b) => b.nom).join(", ");
      throw new Error(`Bacs déjà assignés à une vague : ${noms}`);
    }

    // Verifier unicite du code
    const existingVague = await tx.vague.findUnique({
      where: { code: data.code },
    });
    if (existingVague) {
      throw new Error(`Le code "${data.code}" est déjà utilisé`);
    }

    // Creer la vague
    const vague = await tx.vague.create({
      data: {
        code: data.code,
        dateDebut: new Date(data.dateDebut),
        nombreInitial: data.nombreInitial,
        poidsMoyenInitial: data.poidsMoyenInitial,
        origineAlevins: data.origineAlevins ?? null,
      },
    });

    // Assigner les bacs
    await tx.bac.updateMany({
      where: { id: { in: data.bacIds } },
      data: { vagueId: vague.id },
    });

    return tx.vague.findUnique({
      where: { id: vague.id },
      include: { bacs: true },
    });
  });
}

/** Cloturer une vague : passe le statut a TERMINEE et libere tous les bacs */
export async function cloturerVague(id: string, dateFin?: string) {
  return prisma.$transaction(async (tx) => {
    const vague = await tx.vague.findUnique({
      where: { id },
      include: { bacs: true },
    });

    if (!vague) {
      throw new Error("Vague introuvable");
    }

    if (vague.statut !== StatutVague.EN_COURS) {
      throw new Error("Seule une vague en cours peut être clôturée");
    }

    // Liberer tous les bacs
    await tx.bac.updateMany({
      where: { vagueId: id },
      data: { vagueId: null },
    });

    // Mettre a jour le statut et la date de fin
    return tx.vague.update({
      where: { id },
      data: {
        statut: StatutVague.TERMINEE,
        dateFin: dateFin ? new Date(dateFin) : new Date(),
      },
      include: { _count: { select: { bacs: true } } },
    });
  });
}

/** Mettre a jour une vague (modification partielle) */
export async function updateVague(id: string, data: UpdateVagueDTO) {
  // Si cloture demandee, deleguer a cloturerVague (evite une transaction imbriquee)
  if (data.statut === StatutVague.TERMINEE) {
    return cloturerVague(id, data.dateFin);
  }

  return prisma.$transaction(async (tx) => {
    const vague = await tx.vague.findUnique({ where: { id } });

    if (!vague) {
      throw new Error("Vague introuvable");
    }

    // Ajouter des bacs
    if (data.addBacIds && data.addBacIds.length > 0) {
      const bacs = await tx.bac.findMany({
        where: { id: { in: data.addBacIds } },
      });

      const bacsOccupes = bacs.filter((b) => b.vagueId !== null);
      if (bacsOccupes.length > 0) {
        const noms = bacsOccupes.map((b) => b.nom).join(", ");
        throw new Error(`Bacs déjà assignés : ${noms}`);
      }

      await tx.bac.updateMany({
        where: { id: { in: data.addBacIds } },
        data: { vagueId: id },
      });
    }

    // Retirer des bacs
    if (data.removeBacIds && data.removeBacIds.length > 0) {
      await tx.bac.updateMany({
        where: { id: { in: data.removeBacIds }, vagueId: id },
        data: { vagueId: null },
      });
    }

    // Mettre a jour les champs simples
    return tx.vague.update({
      where: { id },
      data: {
        ...(data.statut && { statut: data.statut }),
        ...(data.dateFin && { dateFin: new Date(data.dateFin) }),
      },
      include: { _count: { select: { bacs: true } } },
    });
  });
}
