import { prisma } from "@/lib/db";
import { StatutVague, StatutActivite, TypeReleve, MethodeComptage } from "@/types";
import type { CreateVagueDTO, UpdateVagueDTO } from "@/types";

/** Liste les vagues d'un site avec filtre optionnel sur le statut et pagination */
export async function getVagues(
  siteId: string,
  filters?: { statut?: string },
  pagination?: { limit: number; offset: number }
) {
  const where: Record<string, unknown> = { siteId };
  if (filters?.statut) where.statut = filters.statut;

  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.vague.findMany({
      where,
      include: {
        _count: { select: { bacs: true, releves: true } },
      },
      orderBy: { dateDebut: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.vague.count({ where }),
  ]);

  return { data, total };
}

/** Recupere une vague par ID avec ses bacs uniquement — SANS les releves (ADR-038 A-D1) */
export async function getVagueById(
  id: string,
  siteId: string
): Promise<import("@/types").VagueWithBacs | null> {
  return prisma.vague.findFirst({
    where: { id, siteId },
    include: {
      bacs: { orderBy: { nom: "asc" } },
    },
  }) as Promise<import("@/types").VagueWithBacs | null>;
}

/**
 * Recupere la vague avec ses bacs + ses relevés paginés + le total.
 * Usage : page /vagues/[id]/releves (ADR-038 A-D1)
 */
export async function getVagueByIdWithReleves(
  id: string,
  siteId: string,
  pagination?: { limit: number; offset: number }
): Promise<{ vague: import("@/types").VagueWithBacs; releves: import("@/types").Releve[]; total: number } | null> {
  const limit = pagination?.limit ?? 20;
  const offset = pagination?.offset ?? 0;

  const [vague, releves, total] = await Promise.all([
    prisma.vague.findFirst({
      where: { id, siteId },
      include: { bacs: { orderBy: { nom: "asc" } } },
    }),
    prisma.releve.findMany({
      where: { vagueId: id, siteId },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
      include: {
        bac: { select: { id: true, nom: true } },
        consommations: { include: { produit: true } },
        modifications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.releve.count({ where: { vagueId: id, siteId } }),
  ]);

  if (!vague) return null;

  return {
    vague: vague as unknown as import("@/types").VagueWithBacs,
    releves: releves as unknown as import("@/types").Releve[],
    total,
  };
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
        configElevageId: data.configElevageId,
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

      // Recuperer les bacs a retirer
      const bacsARetirer = await tx.bac.findMany({
        where: { id: { in: data.removeBacIds }, vagueId: id, siteId },
      });

      // Verifier que le bac de destination n'est pas dans les bacs a retirer
      if (data.transferDestinationBacId && data.removeBacIds.includes(data.transferDestinationBacId)) {
        throw new Error("Le bac de destination ne peut pas faire partie des bacs à retirer");
      }

      // Verifier si un bac non vide doit etre transfere
      for (const bacARetirer of bacsARetirer) {
        const poissonsPresents = bacARetirer.nombrePoissons ?? 0;
        if (poissonsPresents > 0) {
          if (!data.transferDestinationBacId) {
            throw new Error(
              `Le bac ${bacARetirer.nom} contient ${poissonsPresents} poissons. Veuillez les transférer vers un autre bac avant de le retirer.`
            );
          }

          // Verifier que le bac de destination appartient a la meme vague
          const bacDestination = await tx.bac.findFirst({
            where: { id: data.transferDestinationBacId, vagueId: id, siteId },
          });
          if (!bacDestination) {
            throw new Error("Le bac de destination est introuvable ou n'appartient pas a cette vague");
          }

          // Transferer les poissons : incrémenter la destination
          const nouveauNombreDestination = (bacDestination.nombrePoissons ?? 0) + poissonsPresents;
          await tx.bac.update({
            where: { id: data.transferDestinationBacId },
            data: { nombrePoissons: { increment: poissonsPresents } },
          });

          // Creer COMPTAGE=0 pour le bac source (maintenant vide)
          await tx.releve.create({
            data: {
              date: new Date(),
              typeReleve: TypeReleve.COMPTAGE,
              nombreCompte: 0,
              methodeComptage: MethodeComptage.DIRECT,
              notes: `Transfert lors du retrait du bac ${bacARetirer.nom}`,
              vagueId: id,
              bacId: bacARetirer.id,
              siteId,
            },
          });

          // Creer COMPTAGE pour le bac destination avec son nouveau total
          await tx.releve.create({
            data: {
              date: new Date(),
              typeReleve: TypeReleve.COMPTAGE,
              nombreCompte: nouveauNombreDestination,
              methodeComptage: MethodeComptage.DIRECT,
              notes: `Transfert depuis le bac ${bacARetirer.nom} lors de son retrait`,
              vagueId: id,
              bacId: data.transferDestinationBacId,
              siteId,
            },
          });
        }
      }

      // Liberer les bacs (ne jamais decrementer vague.nombreInitial)
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
      // Note: vague.nombreInitial n'est jamais decremente lors du retrait d'un bac (Fix 4)
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
        ...(data.configElevageId !== undefined && { configElevageId: data.configElevageId }),
      },
      include: { _count: { select: { bacs: true } } },
    });
  });
}
