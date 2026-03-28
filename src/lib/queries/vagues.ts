import { prisma } from "@/lib/db";
import { StatutVague, StatutActivite } from "@/types";
import type { CreateVagueDTO, UpdateVagueDTO } from "@/types";

/** Liste les vagues d'un site avec filtre optionnel sur le statut */
export async function getVagues(siteId: string, filters?: { statut?: string }) {
  const where: Record<string, unknown> = { siteId };
  if (filters?.statut) where.statut = filters.statut;

  return prisma.vague.findMany({
    where,
    include: {
      _count: { select: { bacs: true, releves: true } },
    },
    orderBy: { dateDebut: "desc" },
  });
}

/** Recupere une vague par ID (verifie qu'elle appartient au site) */
export async function getVagueById(id: string, siteId: string) {
  return prisma.vague.findFirst({
    where: { id, siteId },
    include: {
      bacs: { orderBy: { nom: "asc" } },
      releves: {
        orderBy: { date: "desc" },
        include: {
          consommations: {
            include: { produit: true },
          },
          modifications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
}

/** Cree une vague et assigne les bacs en transaction */
export async function createVague(siteId: string, data: CreateVagueDTO) {
  return prisma.$transaction(async (tx) => {
    const bacIds = data.bacDistribution.map((e) => e.bacId);

    // Verifier que tous les bacs existent, sont libres, et appartiennent au site
    const bacs = await tx.bac.findMany({
      where: { id: { in: bacIds }, siteId },
    });

    if (bacs.length !== bacIds.length) {
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
        siteId,
      },
    });

    // Assigner les bacs avec leur distribution d'alevins
    for (const entry of data.bacDistribution) {
      await tx.bac.update({
        where: { id: entry.bacId, siteId },
        data: {
          vagueId: vague.id,
          nombrePoissons: entry.nombrePoissons,
          nombreInitial: entry.nombrePoissons,
          poidsMoyenInitial: data.poidsMoyenInitial,
        },
      });
    }

    return tx.vague.findUnique({
      where: { id: vague.id },
      include: { bacs: true },
    });
  });
}

/** Cloturer une vague : passe le statut a TERMINEE et libere tous les bacs */
export async function cloturerVague(id: string, siteId: string, dateFin?: string) {
  return prisma.$transaction(async (tx) => {
    const vague = await tx.vague.findFirst({
      where: { id, siteId },
      include: { bacs: true },
    });

    if (!vague) {
      throw new Error("Vague introuvable");
    }

    if (vague.statut !== StatutVague.EN_COURS) {
      throw new Error("Seule une vague en cours peut être clôturée");
    }

    // Liberer tous les bacs et remettre les compteurs a zero
    await tx.bac.updateMany({
      where: { vagueId: id, siteId },
      data: {
        vagueId: null,
        nombrePoissons: null,
        nombreInitial: null,
        poidsMoyenInitial: null,
      },
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
export async function updateVague(id: string, siteId: string, data: UpdateVagueDTO) {
  // Si cloture demandee, deleguer a cloturerVague
  if (data.statut === StatutVague.TERMINEE) {
    return cloturerVague(id, siteId, data.dateFin);
  }

  return prisma.$transaction(async (tx) => {
    const vague = await tx.vague.findFirst({
      where: { id, siteId },
      include: { _count: { select: { bacs: true } } },
    });

    if (!vague) {
      throw new Error("Vague introuvable");
    }

    // Ajouter des bacs (avec nombre de poissons)
    if (data.addBacs && data.addBacs.length > 0) {
      if (vague.statut !== StatutVague.EN_COURS) {
        throw new Error("L'ajout de bacs n'est possible que sur une vague en cours");
      }

      const bacIds = data.addBacs.map((e) => e.bacId);
      const bacs = await tx.bac.findMany({
        where: { id: { in: bacIds }, siteId },
      });

      if (bacs.length !== bacIds.length) {
        throw new Error("Un ou plusieurs bacs sont introuvables");
      }

      const bacsOccupes = bacs.filter((b) => b.vagueId !== null);
      if (bacsOccupes.length > 0) {
        const noms = bacsOccupes.map((b) => b.nom).join(", ");
        throw new Error(`Bacs déjà assignés à une vague : ${noms}`);
      }

      let totalPoissonAjoutes = 0;
      for (const entry of data.addBacs) {
        await tx.bac.update({
          where: { id: entry.bacId, siteId },
          data: {
            vagueId: id,
            nombrePoissons: entry.nombrePoissons,
            nombreInitial: entry.nombrePoissons,
            poidsMoyenInitial: vague.poidsMoyenInitial,
          },
        });
        totalPoissonAjoutes += entry.nombrePoissons;
      }

      await tx.vague.update({
        where: { id },
        data: { nombreInitial: { increment: totalPoissonAjoutes } },
      });
    }

    // Retirer des bacs
    if (data.removeBacIds && data.removeBacIds.length > 0) {
      if (vague.statut !== StatutVague.EN_COURS) {
        throw new Error("Le retrait de bacs n'est possible que sur une vague en cours");
      }

      const currentBacCount = vague._count.bacs;
      if (currentBacCount - data.removeBacIds.length < 1) {
        throw new Error("Impossible de retirer tous les bacs : une vague doit avoir au moins un bac");
      }

      // Recuperer les bacs a retirer pour calculer la somme des poissons
      const bacsARetirer = await tx.bac.findMany({
        where: { id: { in: data.removeBacIds }, vagueId: id, siteId },
      });

      const totalPoissonRetires = bacsARetirer.reduce(
        (sum, b) => sum + (b.nombreInitial ?? 0),
        0
      );

      // Liberer les bacs
      await tx.bac.updateMany({
        where: { id: { in: data.removeBacIds }, vagueId: id, siteId },
        data: {
          vagueId: null,
          nombrePoissons: null,
          nombreInitial: null,
          poidsMoyenInitial: null,
        },
      });

      // Annuler les activites PLANIFIEE liees a ces bacs pour cette vague
      for (const bacId of data.removeBacIds) {
        await tx.activite.updateMany({
          where: { bacId, vagueId: id, statut: StatutActivite.PLANIFIEE },
          data: { statut: StatutActivite.ANNULEE },
        });
      }

      // Decrementer le nombreInitial de la vague
      await tx.vague.update({
        where: { id },
        data: { nombreInitial: { decrement: totalPoissonRetires } },
      });
    }

    // Bloquer modification champs numeriques si vague TERMINEE
    if (vague.statut === StatutVague.TERMINEE) {
      if (data.nombreInitial !== undefined || data.poidsMoyenInitial !== undefined || data.origineAlevins !== undefined) {
        throw new Error("Impossible de modifier les parametres d'une vague cloturee");
      }
    }

    // Mettre a jour les champs simples
    return tx.vague.update({
      where: { id },
      data: {
        ...(data.statut && { statut: data.statut }),
        ...(data.dateFin && { dateFin: new Date(data.dateFin) }),
        ...(data.nombreInitial !== undefined && { nombreInitial: data.nombreInitial }),
        ...(data.poidsMoyenInitial !== undefined && { poidsMoyenInitial: data.poidsMoyenInitial }),
        ...(data.origineAlevins !== undefined && { origineAlevins: data.origineAlevins }),
      },
      include: { _count: { select: { bacs: true } } },
    });
  });
}
