import { prisma } from "@/lib/db";
import { StatutVague, StatutActivite, TypeReleve, MethodeComptage, TypeVague } from "@/types";
import type { CreateVagueDTO, UpdateVagueDTO } from "@/types";
import { canDeleteVague } from "@/lib/queries/transferts";

/** Liste les vagues d'un site avec filtre optionnel sur le statut, le type et pagination */
export async function getVagues(
  siteId: string,
  filters?: { statut?: string; type?: string },
  pagination?: { limit: number; offset: number }
) {
  const where: Record<string, unknown> = { siteId };
  if (filters?.statut) where.statut = filters.statut;
  if (filters?.type) where.type = filters.type as TypeVague;

  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.vague.findMany({
      where,
      include: {
        // ADR-043 Phase 3: compter uniquement les assignations actives
        _count: {
          select: {
            releves: true,
            assignations: { where: { dateFin: null } },
          },
        },
        uniteProduction: { select: { id: true, code: true, nom: true, type: true } },
        // Pour computeNombreVivantsVague (progress bars)
        assignations: {
          where: { dateFin: null },
          select: { nombreInitial: true, bac: { select: { id: true } } },
        },
        // Pour calcul biomasse estimée
        releves: {
          where: { OR: [{ typeReleve: "BIOMETRIE" }, { typeReleve: "MORTALITE" }, { typeReleve: "VENTE" }, { typeReleve: "COMPTAGE" }, { typeReleve: "TRANSFERT" }] },
          orderBy: { date: "asc" },
          select: {
            typeReleve: true,
            date: true,
            poidsMoyen: true,
            nombreMorts: true,
            nombreVendus: true,
            nombreTransferes: true,
            nombreCompte: true,
            bacId: true,
            transfertGroupeId: true,
          },
        },
        // Pour totalVenduKg — DV.0 : exclure les ventes EN_PREPARATION et ANNULEE
        lignesVente: {
          where: { vente: { statut: { in: ["LIVREE", "CLOTUREE"] } } },
          select: {
            poidsTotalKg: true,
            vente: { select: { poidsLivreKg: true, poidsTotalKg: true } },
          },
        },
        configElevage: { select: { poidsObjectif: true } },
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
      // ADR-043 Phase 3: AssignationBac est la seule source de vérité
      assignations: {
        include: { bac: { select: { id: true, nom: true, volume: true } } },
        orderBy: { dateAssignation: "asc" },
      },
      uniteProduction: { select: { id: true, code: true, nom: true, type: true } },
    },
  });

  if (!vague) return null;

  // ADR-043 Phase 3: construire la liste des bacs depuis les assignations actives uniquement
  const bacs = vague.assignations
    .filter((a) => a.dateFin === null)
    .map((a) => ({
      id: a.bac.id,
      nom: a.bac.nom,
      volume: a.bac.volume,
      nombrePoissons: a.nombreActuel ?? 0,
      nombreInitial: a.nombreInitial ?? 0,
      poidsMoyenInitial: a.poidsMoyenInitial ?? 0,
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  return {
    ...vague,
    bacs: bacs as unknown as import("@/types").BacAvecProduction[],
  } as unknown as import("@/types").VagueWithBacs;
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
        // ADR-043 Phase 3: assignations actives uniquement pour reconstruire les bacs
        assignations: {
          where: { dateFin: null },
          include: { bac: { select: { id: true, nom: true, volume: true } } },
        },
        uniteProduction: { select: { id: true, code: true, nom: true, type: true } },
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

  // ADR-043 Phase 3: construire la liste des bacs depuis les assignations actives
  const finalBacs = vague.assignations
    .map((a) => ({
      id: a.bac.id,
      nom: a.bac.nom,
      volume: a.bac.volume,
      nombrePoissons: a.nombreActuel ?? 0,
      nombreInitial: a.nombreInitial ?? 0,
      poidsMoyenInitial: a.poidsMoyenInitial ?? 0,
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom));

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

    // Verifier que tous les bacs existent et appartiennent au site
    const bacs = await tx.bac.findMany({
      where: { id: { in: bacIds }, siteId },
    });

    if (bacs.length !== bacIds.length) {
      throw new Error("Un ou plusieurs bacs sont introuvables");
    }

    // ADR-043 Phase 3: vérifier l'occupation via AssignationBac (source de vérité)
    const existingAssignations = await tx.assignationBac.findMany({
      where: { bacId: { in: bacIds }, dateFin: null },
      include: { bac: { select: { nom: true } } },
    });
    if (existingAssignations.length > 0) {
      const noms = existingAssignations.map((a) => a.bac.nom).join(", ");
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
        poidsObjectifKg: data.poidsObjectifKg ?? null,
        uniteProductionId: data.uniteProductionId ?? null,
        siteId,
      },
    });

    // Assigner les bacs via AssignationBac (ADR-043 Phase 3 — plus de dual-write sur Bac)
    for (const entry of data.bacDistribution) {
      await tx.assignationBac.create({
        data: {
          bacId: entry.bacId,
          vagueId: vague.id,
          siteId,
          dateAssignation: new Date(data.dateDebut),
          dateFin: null,
          nombreInitial: entry.nombrePoissons,
          poidsMoyenInitial: data.poidsMoyenInitial,
          nombreActuel: entry.nombrePoissons,
        },
      });
    }

    return tx.vague.findUnique({
      where: { id: vague.id },
      include: {
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
    });

    if (!vague) {
      throw new Error("Vague introuvable");
    }

    if (vague.statut !== StatutVague.EN_COURS) {
      throw new Error("Seule une vague en cours peut être clôturée");
    }

    const dateFinDate = dateFin ? new Date(dateFin) : new Date();

    // ADR-043 Phase 3: fermer toutes les assignations actives de cette vague
    // (Bac n'a plus de vagueId/nombrePoissons — plus de dual-write)
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
            assignations: true,
          },
        },
      },
    });
  });
}

/**
 * Supprimer une vague et toutes ses données en cascade.
 *
 * Ordre de suppression (child-first pour respecter les FK) :
 *   1. ReleveConsommation (enfant de Releve)
 *   2. MouvementStock liés aux Releves (via releveId) — désassocier avant de supprimer les releves
 *   3. Releve (avec ses relations Cascade : ReleveModification, Activite via releveId)
 *   4. CalibrageGroupe (Cascade depuis Calibrage, mais on fait explicitement pour être sûr)
 *   5. Calibrage (Cascade CalibrageModification)
 *   6. MouvementStock liés à la vague (vagueId)
 *   7. Paiement (enfant de Facture, Cascade depuis Facture)
 *   8. Facture (enfant de Vente — 1:1)
 *   9. Vente
 *  10. Activite (vagueId)
 *  11. HistoriqueNutritionnel (vagueId)
 *  12. Vague (Cascade : AssignationBac, ListeBesoinsVague, GompertzVague, NoteIngenieur SetNull, Depense SetNull)
 */
export async function deleteVague(id: string, siteId: string): Promise<void> {
  // Vérifier les contraintes de transfert avant d'ouvrir la transaction
  // (onDelete: Restrict sur TransfertGroupe — ADR-046)
  const { canDelete, reason } = await canDeleteVague(siteId, id);
  if (!canDelete) {
    throw new Error(reason ?? "Suppression bloquée par des transferts existants");
  }

  return prisma.$transaction(async (tx) => {
    // Vérifier l'existence et le siteId
    const vague = await tx.vague.findFirst({ where: { id, siteId } });
    if (!vague) {
      throw new Error("Vague introuvable ou accès refusé.");
    }

    // 1. ReleveConsommation (enfants des Releves de cette vague)
    await tx.releveConsommation.deleteMany({
      where: { releve: { vagueId: id } },
    });

    // 2. Désassocier MouvementStock des relevés avant suppression des relevés
    //    (MouvementStock.releveId n'a pas de Cascade, il faut mettre à null)
    await tx.mouvementStock.updateMany({
      where: { releve: { vagueId: id }, siteId },
      data: { releveId: null },
    });

    // 3. Releve (Cascade : ReleveModification, et Activite.releveId mis à null via SetNull implicite)
    await tx.releve.deleteMany({ where: { vagueId: id, siteId } });

    // 4. CalibrageGroupe (Cascade depuis Calibrage, mais on supprime explicitement pour clarté)
    await tx.calibrageGroupe.deleteMany({
      where: { calibrage: { vagueId: id } },
    });

    // 5. Calibrage (Cascade : CalibrageModification)
    await tx.calibrage.deleteMany({ where: { vagueId: id, siteId } });

    // 6. MouvementStock liés directement à la vague (vagueId)
    await tx.mouvementStock.deleteMany({ where: { vagueId: id, siteId } });

    // 7-9. Ventes et leurs factures/paiements (Paiement a Cascade depuis Facture)
    //      On supprime Paiement via Facture.paiements (Cascade), puis Facture, puis Vente
    const factures = await tx.facture.findMany({
      where: { vente: { vagueId: id } },
      select: { id: true },
    });
    if (factures.length > 0) {
      const factureIds = factures.map((f) => f.id);
      // Paiement a onDelete: Cascade depuis Facture — la suppression des factures suffira
      await tx.paiement.deleteMany({ where: { factureId: { in: factureIds } } });
      await tx.facture.deleteMany({ where: { id: { in: factureIds } } });
    }
    await tx.vente.deleteMany({ where: { vagueId: id, siteId } });

    // 10. Activite (vagueId nullable, mais on supprime celles liées à la vague)
    await tx.activite.deleteMany({ where: { vagueId: id, siteId } });

    // 11. HistoriqueNutritionnel
    await tx.historiqueNutritionnel.deleteMany({ where: { vagueId: id, siteId } });

    // 12. Supprimer la Vague (Cascade : AssignationBac, ListeBesoinsVague, GompertzVague)
    //     ADR-043 Phase 3 : plus de Bac.vagueId à remettre à null — AssignationBac est supprimée en cascade
    await tx.vague.delete({ where: { id } });
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

      // ADR-043 Phase 3: vérifier l'occupation via AssignationBac (source de vérité)
      const existingAssignations = await tx.assignationBac.findMany({
        where: { bacId: { in: bacIds }, dateFin: null },
        include: { bac: { select: { nom: true } } },
      });
      if (existingAssignations.length > 0) {
        const noms = existingAssignations.map((a) => a.bac.nom).join(", ");
        throw new Error(`Bacs déjà assignés à une vague : ${noms}`);
      }

      let totalPoissonAjoutes = 0;
      for (const entry of data.addBacs) {
        // ADR-043 Phase 3: créer l'AssignationBac (plus de dual-write sur Bac)
        await tx.assignationBac.create({
          data: {
            bacId: entry.bacId,
            vagueId: id,
            siteId,
            dateAssignation: new Date(),
            dateFin: null,
            nombreInitial: entry.nombrePoissons,
            poidsMoyenInitial: vague.poidsMoyenInitial,
            nombreActuel: entry.nombrePoissons,
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

      const currentBacCount = vague._count.assignations;

      if (currentBacCount - data.removeBacIds.length < 1) {
        throw new Error("Impossible de retirer tous les bacs : une vague doit avoir au moins un bac");
      }

      // Recuperer les assignations actives des bacs à retirer
      const assignationsARetirer = await tx.assignationBac.findMany({
        where: {
          bacId: { in: data.removeBacIds },
          vagueId: id,
          dateFin: null,
        },
        include: {
          bac: { select: { id: true, nom: true } },
        },
      });

      // Verifier que le bac de destination n'est pas dans les bacs a retirer
      if (data.transferDestinationBacId && data.removeBacIds.includes(data.transferDestinationBacId)) {
        throw new Error("Le bac de destination ne peut pas faire partie des bacs à retirer");
      }

      // Verifier si un bac non vide doit etre transfere
      for (const assignation of assignationsARetirer) {
        // ADR-043 Phase 3: lire nombreActuel depuis AssignationBac (source de vérité)
        const poissonsPresents = assignation.nombreActuel ?? 0;
        if (poissonsPresents > 0) {
          if (!data.transferDestinationBacId) {
            throw new Error(
              `Le bac ${assignation.bac.nom} contient ${poissonsPresents} poissons. Veuillez les transférer vers un autre bac avant de le retirer.`
            );
          }

          // Verifier que le bac de destination appartient a la meme vague
          const destAssignation = await tx.assignationBac.findFirst({
            where: {
              bacId: data.transferDestinationBacId,
              vagueId: id,
              dateFin: null,
            },
            include: {
              bac: { select: { id: true, nom: true } },
            },
          });
          if (!destAssignation) {
            throw new Error("Le bac de destination est introuvable ou n'appartient pas a cette vague");
          }

          // Transferer les poissons : incrémenter la destination via AssignationBac
          const destCurrentCount = destAssignation.nombreActuel ?? 0;
          const nouveauNombreDestination = destCurrentCount + poissonsPresents;

          // ADR-043 Phase 3: mettre à jour l'assignation active de la destination
          await tx.assignationBac.updateMany({
            where: { bacId: data.transferDestinationBacId, vagueId: id, dateFin: null },
            data: { nombreActuel: nouveauNombreDestination },
          });

          // Creer COMPTAGE=0 pour le bac source (maintenant vide)
          await tx.releve.create({
            data: {
              date: new Date(),
              typeReleve: TypeReleve.COMPTAGE,
              nombreCompte: 0,
              methodeComptage: MethodeComptage.DIRECT,
              notes: `Transfert lors du retrait du bac ${assignation.bac.nom}`,
              vagueId: id,
              bacId: assignation.bac.id,
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
              notes: `Transfert depuis le bac ${assignation.bac.nom} lors de son retrait`,
              vagueId: id,
              bacId: data.transferDestinationBacId,
              siteId,
            },
          });
        }
      }

      // ADR-043 Phase 3: fermer les assignations actives des bacs retirés
      // (plus de Bac.vagueId/nombrePoissons à remettre à null)
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
      if (data.nombreInitial !== undefined || data.poidsMoyenInitial !== undefined || data.origineAlevins !== undefined || data.dateDebut !== undefined) {
        throw new Error("Impossible de modifier les parametres d'une vague cloturee");
      }
    }

    // Validation dateDebut si fournie : doit etre antérieure à dateFin
    if (data.dateDebut !== undefined) {
      const newDateDebut = new Date(data.dateDebut);
      if (isNaN(newDateDebut.getTime())) {
        throw new Error("La date de mise en eau n'est pas une date valide");
      }
      const dateFinRef = data.dateFin ? new Date(data.dateFin) : vague.dateFin;
      if (dateFinRef && newDateDebut >= dateFinRef) {
        throw new Error("La date de mise en eau doit etre anterieure a la date de fin");
      }
    }

    // Mettre a jour les champs simples
    await tx.vague.update({
      where: { id },
      data: {
        ...(data.statut && { statut: data.statut }),
        ...(data.dateDebut && { dateDebut: new Date(data.dateDebut) }),
        ...(data.dateFin && { dateFin: new Date(data.dateFin) }),
        ...(data.nombreInitial !== undefined && { nombreInitial: data.nombreInitial }),
        ...(data.poidsMoyenInitial !== undefined && { poidsMoyenInitial: data.poidsMoyenInitial }),
        ...(data.origineAlevins !== undefined && { origineAlevins: data.origineAlevins }),
        ...(data.configElevageId !== undefined && { configElevageId: data.configElevageId }),
        ...(data.poidsObjectifKg !== undefined && { poidsObjectifKg: data.poidsObjectifKg }),
        ...(data.uniteProductionId !== undefined && { uniteProductionId: data.uniteProductionId }),
      },
    });
    return tx.vague.findUniqueOrThrow({
      where: { id },
      include: {
        _count: {
          select: {
            assignations: { where: { dateFin: null } },
          },
        },
      },
    });
  });
}
