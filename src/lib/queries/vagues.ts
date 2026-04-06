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
        // ADR-043 Phase 2: compter les assignations actives (et garder aussi _count.bacs pour compat)
        _count: {
          select: {
            bacs: true,
            releves: true,
            assignations: { where: { dateFin: null } },
          },
        },
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
  const vague = await prisma.vague.findFirst({
    where: { id, siteId },
    include: {
      bacs: { orderBy: { nom: "asc" } },
      // ADR-043 Phase 2: inclure toutes les assignations (actives + terminées)
      assignations: {
        include: { bac: { select: { id: true, nom: true, volume: true } } },
        orderBy: { dateAssignation: "asc" },
      },
    },
  });

  if (!vague) return null;

  // Construire la liste de bacs depuis les assignations si bacs est vide (rétrocompat Phase 3)
  const bacsFromAssignations = vague.assignations
    .filter((a) => a.dateFin === null)
    .map((a) => ({ id: a.bac.id, nom: a.bac.nom, volume: a.bac.volume }));

  const finalBacs = vague.bacs.length > 0
    ? vague.bacs
    : bacsFromAssignations;

  return {
    ...vague,
    bacs: finalBacs as import("@/types").Bac[],
  } as import("@/types").VagueWithBacs;
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
      include: {
        bacs: { orderBy: { nom: "asc" } },
        // ADR-043 Phase 2: inclure les assignations actives pour fallback
        assignations: {
          where: { dateFin: null },
          include: { bac: { select: { id: true, nom: true, volume: true } } },
        },
      },
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

  // Fallback: si bacs vide, utiliser les assignations actives
  const bacsFromAssignations = vague.assignations
    .map((a) => ({ id: a.bac.id, nom: a.bac.nom, volume: a.bac.volume }));
  const finalBacs = vague.bacs.length > 0 ? vague.bacs : bacsFromAssignations;

  return {
    vague: { ...vague, bacs: finalBacs } as unknown as import("@/types").VagueWithBacs,
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
      // Backward compat: toujours écrire sur Bac (Phase 2 dual-write)
      await tx.bac.update({
        where: { id: entry.bacId, siteId },
        data: {
          vagueId: vague.id,
          nombrePoissons: entry.nombrePoissons,
          nombreInitial: entry.nombrePoissons,
          poidsMoyenInitial: data.poidsMoyenInitial,
        },
      });

      // ADR-043 Phase 2: créer l'AssignationBac correspondante
      await tx.assignationBac.create({
        data: {
          bacId: entry.bacId,
          vagueId: vague.id,
          siteId,
          dateAssignation: new Date(data.dateDebut),
          dateFin: null,
          nombrePoissonsInitial: entry.nombrePoissons,
          poidsMoyenInitial: data.poidsMoyenInitial,
          nombrePoissons: entry.nombrePoissons,
        },
      });
    }

    return tx.vague.findUnique({
      where: { id: vague.id },
      include: {
        bacs: true,
        assignations: {
          where: { dateFin: null },
          include: { bac: { select: { id: true, nom: true, volume: true } } },
        },
      },
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

    const dateFinDate = dateFin ? new Date(dateFin) : new Date();

    // Liberer tous les bacs et remettre les compteurs a zero (backward compat)
    await tx.bac.updateMany({
      where: { vagueId: id, siteId },
      data: {
        vagueId: null,
        nombrePoissons: null,
        nombreInitial: null,
        poidsMoyenInitial: null,
      },
    });

    // ADR-043 Phase 2: fermer toutes les assignations actives de cette vague
    await tx.assignationBac.updateMany({
      where: { vagueId: id, siteId, dateFin: null },
      data: { dateFin: dateFinDate },
    });

    // Mettre a jour le statut et la date de fin
    return tx.vague.update({
      where: { id },
      data: {
        statut: StatutVague.TERMINEE,
        dateFin: dateFinDate,
      },
      include: {
        _count: {
          select: {
            bacs: true,
            assignations: true,
          },
        },
      },
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
      include: {
        _count: {
          select: {
            bacs: true,
            assignations: { where: { dateFin: null } },
          },
        },
      },
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
        // Backward compat: toujours écrire sur Bac (Phase 2 dual-write)
        await tx.bac.update({
          where: { id: entry.bacId, siteId },
          data: {
            vagueId: id,
            nombrePoissons: entry.nombrePoissons,
            nombreInitial: entry.nombrePoissons,
            poidsMoyenInitial: vague.poidsMoyenInitial,
          },
        });

        // ADR-043 Phase 2: créer l'AssignationBac
        await tx.assignationBac.create({
          data: {
            bacId: entry.bacId,
            vagueId: id,
            siteId,
            dateAssignation: new Date(),
            dateFin: null,
            nombrePoissonsInitial: entry.nombrePoissons,
            poidsMoyenInitial: vague.poidsMoyenInitial,
            nombrePoissons: entry.nombrePoissons,
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

      // ADR-043 Phase 2: utiliser le compte d'assignations actives
      const currentBacCount = vague._count.assignations > 0
        ? vague._count.assignations
        : vague._count.bacs;

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

          // ADR-043 Phase 2: mettre à jour l'assignation active de la destination
          await tx.assignationBac.updateMany({
            where: { bacId: data.transferDestinationBacId, vagueId: id, dateFin: null },
            data: { nombrePoissons: nouveauNombreDestination },
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

      // Liberer les bacs (ne jamais decrementer vague.nombreInitial) — backward compat
      await tx.bac.updateMany({
        where: { id: { in: data.removeBacIds }, vagueId: id, siteId },
        data: {
          vagueId: null,
          nombrePoissons: null,
          nombreInitial: null,
          poidsMoyenInitial: null,
        },
      });

      // ADR-043 Phase 2: fermer les assignations actives des bacs retirés
      await tx.assignationBac.updateMany({
        where: { bacId: { in: data.removeBacIds }, vagueId: id, dateFin: null },
        data: { dateFin: new Date() },
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
      include: {
        _count: {
          select: {
            bacs: true,
            assignations: { where: { dateFin: null } },
          },
        },
      },
    });
  });
}
