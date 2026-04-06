import { prisma } from "@/lib/db";
import { StatutVague, TypeReleve, CauseMortalite, MethodeComptage, CategorieCalibrage } from "@/types";
import type { CreateCalibrageDTO, PatchCalibrageBody, CalibrageSnapshot } from "@/types";
import type { CalibrageWithModifications, CalibrageModificationWithUser } from "@/types";

/** Liste les calibrages d'un site avec filtres optionnels */
export async function getCalibrages(
  siteId: string,
  filters?: { vagueId?: string }
) {
  return prisma.calibrage.findMany({
    where: {
      siteId,
      ...(filters?.vagueId && { vagueId: filters.vagueId }),
    },
    include: {
      vague: { select: { id: true, code: true } },
      user: { select: { id: true, name: true } },
      groupes: {
        include: {
          destinationBac: { select: { id: true, nom: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });
}

/** Recupere un calibrage par ID avec ses relations completes — inclut modifications (ADR-015) */
export async function getCalibrageById(id: string, siteId: string) {
  return prisma.calibrage.findFirst({
    where: { id, siteId },
    include: {
      vague: { select: { id: true, code: true } },
      user: { select: { id: true, name: true } },
      groupes: {
        include: {
          destinationBac: { select: { id: true, nom: true } },
        },
      },
      modifications: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
}

/**
 * Cree un calibrage avec redistribution atomique des poissons.
 *
 * Regles metier :
 * 1. La vague doit etre EN_COURS
 * 2. Les bacs sources doivent appartenir a la vague et avoir des poissons
 * 3. Les bacs de destination doivent appartenir a la meme vague
 * 4. Conservation : sum(groupes.nombrePoissons) + nombreMorts === sum(sourceBacs.nombrePoissons)
 * 5. Snapshot des bacs sources si nombreInitial est null
 * 6. Creation du Calibrage + CalibrageGroupe (nested)
 * 7. Mise a jour des bacs (sources a 0, destinations au total recu)
 */
export async function createCalibrage(
  siteId: string,
  userId: string,
  data: CreateCalibrageDTO
) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify vague belongs to site and is EN_COURS
    const vague = await tx.vague.findFirst({
      where: { id: data.vagueId, siteId },
    });
    if (!vague) throw new Error("Vague introuvable");
    if (vague.statut !== StatutVague.EN_COURS) {
      throw new Error("Le calibrage n'est possible que sur une vague en cours");
    }

    // 2. Verify source bacs belong to this vague and have fish
    const sourceBacs = await tx.bac.findMany({
      where: { id: { in: data.sourceBacIds }, vagueId: data.vagueId, siteId },
    });

    if (sourceBacs.length !== data.sourceBacIds.length) {
      throw new Error(
        "Un ou plusieurs bacs sources n'appartiennent pas a cette vague"
      );
    }

    for (const bac of sourceBacs) {
      if ((bac.nombrePoissons ?? 0) <= 0) {
        throw new Error(
          `Le bac ${bac.nom} ne contient aucun poisson a calibrer`
        );
      }
    }

    // 3. Verify destination bacs belong to the same vague
    const destBacIds = data.groupes.map((g) => g.destinationBacId);
    const uniqueDestBacIds = [...new Set(destBacIds)];
    const destBacs = await tx.bac.findMany({
      where: { id: { in: uniqueDestBacIds }, vagueId: data.vagueId, siteId },
    });

    if (destBacs.length !== uniqueDestBacIds.length) {
      throw new Error(
        "Un ou plusieurs bacs de destination n'appartiennent pas a cette vague"
      );
    }

    // 4. Conservation check
    const totalSourcePoissons = sourceBacs.reduce(
      (sum, bac) => sum + (bac.nombrePoissons ?? 0),
      0
    );
    const totalGroupePoissons = data.groupes.reduce(
      (sum, g) => sum + g.nombrePoissons,
      0
    );

    if (totalGroupePoissons + data.nombreMorts !== totalSourcePoissons) {
      throw new Error(
        `Conservation non respectee. Source : ${totalSourcePoissons} poissons, ` +
          `groupes : ${totalGroupePoissons} + morts : ${data.nombreMorts} = ` +
          `${totalGroupePoissons + data.nombreMorts}`
      );
    }

    // 5a. Capture snapshotAvant — état vague + tous ses bacs AVANT toute mutation (Fix 5)
    const allBacsOfVague = await tx.bac.findMany({
      where: { vagueId: data.vagueId, siteId },
      select: { id: true, nom: true, nombrePoissons: true, nombreInitial: true, poidsMoyenInitial: true, vagueId: true },
    });
    const snapshotAvant: CalibrageSnapshot = {
      capturedAt: new Date().toISOString(),
      vague: {
        id: vague.id,
        code: vague.code,
        nombreInitial: vague.nombreInitial,
        poidsMoyenInitial: vague.poidsMoyenInitial,
        statut: vague.statut,
      },
      allBacsOfVague,
    };

    // 5b. Snapshot bacs sources if nombreInitial is null
    for (const bac of sourceBacs) {
      if (bac.nombreInitial === null) {
        await tx.bac.update({
          where: { id: bac.id },
          data: {
            nombreInitial: bac.nombrePoissons,
            poidsMoyenInitial: bac.poidsMoyenInitial ?? null,
          },
        });
      }
    }

    // 6. Create Calibrage with nested CalibrageGroupe records
    const calibrageDate = data.date ? new Date(data.date) : new Date();
    const calibrage = await tx.calibrage.create({
      data: {
        vagueId: data.vagueId,
        sourceBacIds: data.sourceBacIds,
        nombreMorts: data.nombreMorts,
        notes: data.notes ?? null,
        date: calibrageDate,
        siteId,
        userId,
        snapshotAvant: snapshotAvant as object,
        groupes: {
          create: data.groupes.map((g) => ({
            categorie: g.categorie,
            destinationBacId: g.destinationBacId,
            nombrePoissons: g.nombrePoissons,
            poidsMoyen: g.poidsMoyen,
            tailleMoyenne: g.tailleMoyenne ?? null,
          })),
        },
      },
      include: {
        vague: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
        groupes: {
          include: {
            destinationBac: { select: { id: true, nom: true } },
          },
        },
      },
    });

    // 7. Two-pass bac update
    // Pass 1: Set all source bacs to 0
    await tx.bac.updateMany({
      where: { id: { in: data.sourceBacIds } },
      data: { nombrePoissons: 0 },
    });

    // ADR-043 Phase 2: mettre à jour les assignations actives des bacs sources à 0
    await tx.assignationBac.updateMany({
      where: { bacId: { in: data.sourceBacIds }, vagueId: data.vagueId, dateFin: null },
      data: { nombrePoissons: 0 },
    });

    // Pass 2: For each destination bac, sum fish going to it across all groups
    const destBacTotals = new Map<string, number>();
    for (const groupe of data.groupes) {
      const current = destBacTotals.get(groupe.destinationBacId) ?? 0;
      destBacTotals.set(groupe.destinationBacId, current + groupe.nombrePoissons);
    }

    for (const [bacId, total] of destBacTotals.entries()) {
      // If this bac is also a source bac, it was zeroed in Pass 1 — just set the total.
      // If it's a non-source bac, increment to preserve existing fish.
      const isSourceBac = data.sourceBacIds.includes(bacId);
      if (isSourceBac) {
        await tx.bac.update({
          where: { id: bacId },
          data: { nombrePoissons: total },
        });
        // ADR-043 Phase 2: dual-write sur AssignationBac
        await tx.assignationBac.updateMany({
          where: { bacId, vagueId: data.vagueId, dateFin: null },
          data: { nombrePoissons: total },
        });
      } else {
        // Lire la valeur actuelle de l'assignation active pour l'incrément
        const assignationDest = await tx.assignationBac.findFirst({
          where: { bacId, vagueId: data.vagueId, dateFin: null },
          select: { id: true, nombrePoissons: true },
        });

        await tx.bac.update({
          where: { id: bacId },
          data: { nombrePoissons: { increment: total } },
        });

        // ADR-043 Phase 2: dual-write sur AssignationBac
        if (assignationDest) {
          await tx.assignationBac.update({
            where: { id: assignationDest.id },
            data: { nombrePoissons: (assignationDest.nombrePoissons ?? 0) + total },
          });
        }
      }
    }

    // 8. Auto-create Releve records from calibrage data

    // 8a. MORTALITE releve (if deaths occurred)
    if (data.nombreMorts > 0) {
      await tx.releve.create({
        data: {
          date: calibrageDate,
          typeReleve: TypeReleve.MORTALITE,
          nombreMorts: data.nombreMorts,
          causeMortalite: CauseMortalite.AUTRE,
          notes: "Mortalite constatee lors du calibrage",
          vagueId: data.vagueId,
          bacId: sourceBacs[0].id,
          siteId,
          calibrageId: calibrage.id,
        },
      });
    }

    // 8b. BIOMETRIE releve per calibrage group (one per destination bac/category)
    for (const groupe of data.groupes) {
      const categorieLabel =
        groupe.categorie === CategorieCalibrage.PETIT ? "Petit" :
        groupe.categorie === CategorieCalibrage.MOYEN ? "Moyen" :
        groupe.categorie === CategorieCalibrage.GROS ? "Gros" :
        groupe.categorie === CategorieCalibrage.TRES_GROS ? "Tres gros" :
        groupe.categorie;

      await tx.releve.create({
        data: {
          date: calibrageDate,
          typeReleve: TypeReleve.BIOMETRIE,
          poidsMoyen: groupe.poidsMoyen,
          tailleMoyenne: groupe.tailleMoyenne ?? null,
          echantillonCount: groupe.nombrePoissons,
          notes: `Biometrie calibrage — categorie ${categorieLabel}`,
          vagueId: data.vagueId,
          bacId: groupe.destinationBacId,
          siteId,
          calibrageId: calibrage.id,
        },
      });
    }

    // 8c. COMPTAGE releve per unique destination bac
    for (const [bacId, total] of destBacTotals.entries()) {
      await tx.releve.create({
        data: {
          date: calibrageDate,
          typeReleve: TypeReleve.COMPTAGE,
          nombreCompte: total,
          methodeComptage: MethodeComptage.DIRECT,
          notes: "Comptage post-calibrage",
          vagueId: data.vagueId,
          bacId,
          siteId,
          calibrageId: calibrage.id,
        },
      });
    }

    // 8d. COMPTAGE=0 for source-only bacs (now empty after calibrage)
    for (const sourceBac of sourceBacs) {
      if (!destBacTotals.has(sourceBac.id)) {
        await tx.releve.create({
          data: {
            date: calibrageDate,
            typeReleve: TypeReleve.COMPTAGE,
            nombreCompte: 0,
            methodeComptage: MethodeComptage.DIRECT,
            notes: "Comptage post-calibrage (bac source vide)",
            vagueId: data.vagueId,
            bacId: sourceBac.id,
            siteId,
            calibrageId: calibrage.id,
          },
        });
      }
    }

    return calibrage;
  });
}

/**
 * Modifie un calibrage existant avec traçabilite obligatoire (ADR-015).
 *
 * Transaction atomique en 9 etapes :
 * 1. Fetch et verification du calibrage existant (vague EN_COURS)
 * 2. Calcul du totalSourcePoissons (invariant de conservation)
 * 3. Determination des nouvelles valeurs effectives
 * 4. Verification de conservation si nombreMorts ou groupes modifies
 * 5. Verification des bacs de destination si groupes modifies
 * 6. Annulation des effets sur les bacs (restauration)
 * 7. Application du nouveau dispatch sur les bacs
 * 8. Mise a jour des releves auto-crees
 * 9. Mise a jour du calibrage + creation des traces + fetch resultat
 *
 * @param siteId  - isolation multi-tenant
 * @param userId  - utilisateur effectuant la modification
 * @param id      - identifiant du calibrage
 * @param data    - champs modifiables (PatchCalibrageBody sans raison)
 * @param raison  - raison obligatoire (min 5 chars, deja validee en route)
 */
export async function patchCalibrage(
  siteId: string,
  userId: string,
  id: string,
  data: Omit<PatchCalibrageBody, "raison">,
  raison: string
): Promise<{ calibrage: CalibrageWithModifications; modifications: CalibrageModificationWithUser[] }> {
  return prisma.$transaction(async (tx) => {
    // ----------------------------------------------------------------
    // Etape 1 — Fetch et verification du calibrage existant
    // ----------------------------------------------------------------
    const ancienCalibrage = await tx.calibrage.findFirst({
      where: { id, siteId },
      include: {
        groupes: { include: { destinationBac: true } },
        vague: { select: { id: true, statut: true } },
      },
    });

    if (!ancienCalibrage) throw new Error("Calibrage introuvable");
    if (ancienCalibrage.vague.statut !== StatutVague.EN_COURS) {
      throw new Error("Vague cloturee");
    }

    // ----------------------------------------------------------------
    // Etape 2 — Calcul du totalSourcePoissons (invariant)
    // ----------------------------------------------------------------
    const totalSourcePoissons =
      ancienCalibrage.groupes.reduce((sum, g) => sum + g.nombrePoissons, 0) +
      ancienCalibrage.nombreMorts;

    // ----------------------------------------------------------------
    // Etape 3 — Determination des nouvelles valeurs effectives
    // ----------------------------------------------------------------
    const nouveauxNombreMorts =
      data.nombreMorts !== undefined ? data.nombreMorts : ancienCalibrage.nombreMorts;
    const nouvellesNotes =
      data.notes !== undefined ? data.notes : ancienCalibrage.notes;
    const nouveauxGroupes =
      data.groupes !== undefined
        ? data.groupes
        : ancienCalibrage.groupes.map((g) => ({
            categorie: g.categorie,
            destinationBacId: g.destinationBacId,
            nombrePoissons: g.nombrePoissons,
            poidsMoyen: g.poidsMoyen,
            tailleMoyenne: g.tailleMoyenne ?? undefined,
          }));

    // ----------------------------------------------------------------
    // Etape 4 — Verification de conservation
    // ----------------------------------------------------------------
    if (data.nombreMorts !== undefined || data.groupes !== undefined) {
      const totalNouveaux =
        nouveauxGroupes.reduce((sum, g) => sum + g.nombrePoissons, 0) + nouveauxNombreMorts;
      if (totalNouveaux !== totalSourcePoissons) {
        throw new Error(
          `Conservation non respectee. Total source: ${totalSourcePoissons}, nouveau total: ${totalNouveaux}`
        );
      }
    }

    // ----------------------------------------------------------------
    // Etape 5 — Verification des bacs de destination si groupes modifies
    // ----------------------------------------------------------------
    if (data.groupes !== undefined) {
      const uniqueNewDestIds = [...new Set(data.groupes.map((g) => g.destinationBacId))];
      const destBacs = await tx.bac.findMany({
        where: { id: { in: uniqueNewDestIds }, vagueId: ancienCalibrage.vague.id, siteId },
      });
      if (destBacs.length !== uniqueNewDestIds.length) {
        throw new Error("Un ou plusieurs bacs de destination n'appartiennent pas a la vague");
      }
    }

    // ----------------------------------------------------------------
    // Etape 6 — Annulation des effets sur les bacs (si groupes modifies)
    // ----------------------------------------------------------------
    if (data.groupes !== undefined) {
      // 6a. Calculer les totaux par bac destination dans l'ancien calibrage
      const ancienDestTotals = new Map<string, number>();
      for (const g of ancienCalibrage.groupes) {
        const current = ancienDestTotals.get(g.destinationBacId) ?? 0;
        ancienDestTotals.set(g.destinationBacId, current + g.nombrePoissons);
      }

      // 6b. Decrementer les bacs de destination de l'ancien dispatch
      for (const [bacId, ancienTotal] of ancienDestTotals.entries()) {
        await tx.bac.update({
          where: { id: bacId },
          data: { nombrePoissons: { decrement: ancienTotal } },
        });
        // ADR-043 dual-write: lire l'assignation active pour calculer la nouvelle valeur
        const assignationDest6 = await tx.assignationBac.findFirst({
          where: { bacId, vagueId: ancienCalibrage.vague.id, dateFin: null },
          select: { id: true, nombrePoissons: true },
        });
        if (assignationDest6) {
          await tx.assignationBac.update({
            where: { id: assignationDest6.id },
            data: { nombrePoissons: (assignationDest6.nombrePoissons ?? 0) - ancienTotal },
          });
        }
      }

      // 6c. Remettre les poissons sur le premier bac source
      // (approche v1 : totalSourcePoissons sur le premier source)
      if (ancienCalibrage.sourceBacIds.length > 0) {
        const firstSourceId = ancienCalibrage.sourceBacIds[0];
        await tx.bac.update({
          where: { id: firstSourceId },
          data: { nombrePoissons: { increment: totalSourcePoissons } },
        });
        // ADR-043 dual-write sur le bac source
        const assignationSource6 = await tx.assignationBac.findFirst({
          where: { bacId: firstSourceId, vagueId: ancienCalibrage.vague.id, dateFin: null },
          select: { id: true, nombrePoissons: true },
        });
        if (assignationSource6) {
          await tx.assignationBac.update({
            where: { id: assignationSource6.id },
            data: { nombrePoissons: (assignationSource6.nombrePoissons ?? 0) + totalSourcePoissons },
          });
        }
      }
    }

    // ----------------------------------------------------------------
    // Etape 7 — Application du nouveau dispatch sur les bacs
    // ----------------------------------------------------------------
    if (data.groupes !== undefined) {
      // Pass 1 : zeroed tous les bacs sources
      await tx.bac.updateMany({
        where: { id: { in: ancienCalibrage.sourceBacIds } },
        data: { nombrePoissons: 0 },
      });
      // ADR-043 dual-write: mettre à zéro les assignations actives des bacs sources
      await tx.assignationBac.updateMany({
        where: { bacId: { in: ancienCalibrage.sourceBacIds }, vagueId: ancienCalibrage.vague.id, dateFin: null },
        data: { nombrePoissons: 0 },
      });

      // Pass 2 : appliquer le nouveau dispatch
      const nouveauxDestTotals = new Map<string, number>();
      for (const g of nouveauxGroupes) {
        const current = nouveauxDestTotals.get(g.destinationBacId) ?? 0;
        nouveauxDestTotals.set(g.destinationBacId, current + g.nombrePoissons);
      }

      for (const [bacId, total] of nouveauxDestTotals.entries()) {
        const isSourceBac = ancienCalibrage.sourceBacIds.includes(bacId);
        if (isSourceBac) {
          await tx.bac.update({ where: { id: bacId }, data: { nombrePoissons: total } });
          // ADR-043 dual-write: bac source reçoit un total fixe (déjà zeroed en Pass 1)
          await tx.assignationBac.updateMany({
            where: { bacId, vagueId: ancienCalibrage.vague.id, dateFin: null },
            data: { nombrePoissons: total },
          });
        } else {
          // Lire l'assignation active pour calculer l'incrément correct
          const assignationDest7 = await tx.assignationBac.findFirst({
            where: { bacId, vagueId: ancienCalibrage.vague.id, dateFin: null },
            select: { id: true, nombrePoissons: true },
          });
          await tx.bac.update({ where: { id: bacId }, data: { nombrePoissons: { increment: total } } });
          // ADR-043 dual-write: bac destination non-source
          if (assignationDest7) {
            await tx.assignationBac.update({
              where: { id: assignationDest7.id },
              data: { nombrePoissons: (assignationDest7.nombrePoissons ?? 0) + total },
            });
          }
        }
      }
    }

    // ----------------------------------------------------------------
    // Etape 3b — Determination de la nouvelle date effective
    // ----------------------------------------------------------------
    const nouvelleDate = data.date !== undefined ? new Date(data.date) : ancienCalibrage.date;

    // ----------------------------------------------------------------
    // Etape 3c — Verification qu'au moins un champ a reellement change
    // (fail-fast avant toute ecriture sur les releves)
    // ----------------------------------------------------------------
    const hasChanges =
      (data.nombreMorts !== undefined && data.nombreMorts !== ancienCalibrage.nombreMorts) ||
      (data.notes !== undefined && data.notes !== ancienCalibrage.notes) ||
      data.groupes !== undefined ||
      (data.date !== undefined && new Date(data.date).getTime() !== ancienCalibrage.date.getTime());

    if (!hasChanges) {
      throw new Error("Aucun champ n'a ete modifie");
    }

    // ----------------------------------------------------------------
    // Etape 5b — Capture snapshotAvantModif (apres hasChanges check)
    // ----------------------------------------------------------------
    const allBacsOfVagueModif = await tx.bac.findMany({
      where: { vagueId: ancienCalibrage.vague.id, siteId },
      select: { id: true, nom: true, nombrePoissons: true, nombreInitial: true, poidsMoyenInitial: true, vagueId: true },
    });
    const vagueForSnapshot = await tx.vague.findFirst({
      where: { id: ancienCalibrage.vague.id, siteId },
      select: { id: true, code: true, nombreInitial: true, poidsMoyenInitial: true, statut: true },
    });
    if (vagueForSnapshot) {
      const snapshotAvantModif: CalibrageSnapshot = {
        capturedAt: new Date().toISOString(),
        vague: {
          id: vagueForSnapshot.id,
          code: vagueForSnapshot.code,
          nombreInitial: vagueForSnapshot.nombreInitial,
          poidsMoyenInitial: vagueForSnapshot.poidsMoyenInitial,
          statut: vagueForSnapshot.statut,
        },
        allBacsOfVague: allBacsOfVagueModif,
      };
      await tx.calibrage.update({
        where: { id },
        data: { snapshotAvantModif: snapshotAvantModif as object },
      });
    }

    // ----------------------------------------------------------------
    // Etape 8 — Mise a jour des releves auto-crees
    // ----------------------------------------------------------------

    // 8a. Mettre a jour ou supprimer le releve MORTALITE auto-cree
    if (data.nombreMorts !== undefined && data.nombreMorts !== ancienCalibrage.nombreMorts) {
      const relevesMortalite = await tx.releve.findMany({
        where: {
          calibrageId: id,
          typeReleve: TypeReleve.MORTALITE,
          siteId,
        },
      });

      if (relevesMortalite.length > 0) {
        if (nouveauxNombreMorts === 0) {
          await tx.releve.deleteMany({
            where: { calibrageId: id, typeReleve: TypeReleve.MORTALITE, siteId },
          });
        } else {
          await tx.releve.update({
            where: { id: relevesMortalite[0].id },
            data: { nombreMorts: nouveauxNombreMorts, date: nouvelleDate },
          });
        }
      }
    } else if (data.date !== undefined) {
      // Mettre a jour la date du releve MORTALITE meme si nombreMorts n'a pas change
      await tx.releve.updateMany({
        where: { calibrageId: id, typeReleve: TypeReleve.MORTALITE, siteId },
        data: { date: nouvelleDate },
      });
    }

    // 8b. Reconstruire les releves BIOMETRIE et COMPTAGE si groupes modifies
    if (data.groupes !== undefined) {
      // Supprimer les anciens releves BIOMETRIE et COMPTAGE auto-crees
      await tx.releve.deleteMany({
        where: {
          calibrageId: id,
          typeReleve: { in: [TypeReleve.BIOMETRIE, TypeReleve.COMPTAGE] },
          siteId,
        },
      });

      // Recréer les releves BIOMETRIE
      for (const groupe of nouveauxGroupes) {
        const categorieLabel =
          groupe.categorie === CategorieCalibrage.PETIT ? "Petit" :
          groupe.categorie === CategorieCalibrage.MOYEN ? "Moyen" :
          groupe.categorie === CategorieCalibrage.GROS ? "Gros" :
          groupe.categorie === CategorieCalibrage.TRES_GROS ? "Tres gros" :
          groupe.categorie;

        await tx.releve.create({
          data: {
            date: nouvelleDate,
            typeReleve: TypeReleve.BIOMETRIE,
            poidsMoyen: groupe.poidsMoyen,
            tailleMoyenne: groupe.tailleMoyenne ?? null,
            echantillonCount: groupe.nombrePoissons,
            notes: `Biometrie calibrage — categorie ${categorieLabel}`,
            vagueId: ancienCalibrage.vague.id,
            bacId: groupe.destinationBacId,
            siteId,
            calibrageId: id,
          },
        });
      }

      // Recreer les releves COMPTAGE par bac destination
      const nouveauxDestTotals2 = new Map<string, number>();
      for (const g of nouveauxGroupes) {
        const current = nouveauxDestTotals2.get(g.destinationBacId) ?? 0;
        nouveauxDestTotals2.set(g.destinationBacId, current + g.nombrePoissons);
      }

      for (const [bacId, total] of nouveauxDestTotals2.entries()) {
        await tx.releve.create({
          data: {
            date: nouvelleDate,
            typeReleve: TypeReleve.COMPTAGE,
            nombreCompte: total,
            methodeComptage: MethodeComptage.DIRECT,
            notes: "Comptage post-calibrage",
            vagueId: ancienCalibrage.vague.id,
            bacId,
            siteId,
            calibrageId: id,
          },
        });
      }

      // COMPTAGE=0 for source-only bacs (now empty after calibrage)
      for (const sourceBacId of ancienCalibrage.sourceBacIds) {
        if (!nouveauxDestTotals2.has(sourceBacId)) {
          await tx.releve.create({
            data: {
              date: nouvelleDate,
              typeReleve: TypeReleve.COMPTAGE,
              nombreCompte: 0,
              methodeComptage: MethodeComptage.DIRECT,
              notes: "Comptage post-calibrage (bac source vide)",
              vagueId: ancienCalibrage.vague.id,
              bacId: sourceBacId,
              siteId,
              calibrageId: id,
            },
          });
        }
      }
    } else if (data.date !== undefined) {
      // Mettre a jour la date des releves BIOMETRIE et COMPTAGE si seulement la date change
      await tx.releve.updateMany({
        where: {
          calibrageId: id,
          typeReleve: { in: [TypeReleve.BIOMETRIE, TypeReleve.COMPTAGE] },
          siteId,
        },
        data: { date: nouvelleDate },
      });
    }

    // ----------------------------------------------------------------
    // Etape 9 — Mise a jour du calibrage + traces + fetch resultat
    // ----------------------------------------------------------------

    // 9a. Supprimer les anciens groupes si groupes modifies
    if (data.groupes !== undefined) {
      await tx.calibrageGroupe.deleteMany({ where: { calibrageId: id } });
    }

    // 9b. Mettre a jour le calibrage
    await tx.calibrage.update({
      where: { id },
      data: {
        nombreMorts: nouveauxNombreMorts,
        notes: nouvellesNotes,
        modifie: true,
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.groupes !== undefined && {
          groupes: {
            create: nouveauxGroupes.map((g) => ({
              categorie: g.categorie,
              destinationBacId: g.destinationBacId,
              nombrePoissons: g.nombrePoissons,
              poidsMoyen: g.poidsMoyen,
              tailleMoyenne: g.tailleMoyenne ?? null,
            })),
          },
        }),
      },
    });

    // 9c. Construire les traces de modification
    const traces: Array<{
      id: string;
      calibrageId: string;
      userId: string;
      raison: string;
      champModifie: string;
      ancienneValeur: string | null;
      nouvelleValeur: string | null;
      siteId: string;
    }> = [];

    if (data.nombreMorts !== undefined && data.nombreMorts !== ancienCalibrage.nombreMorts) {
      traces.push({
        id: crypto.randomUUID(),
        calibrageId: id,
        userId,
        raison,
        siteId,
        champModifie: "nombreMorts",
        ancienneValeur: String(ancienCalibrage.nombreMorts),
        nouvelleValeur: String(data.nombreMorts),
      });
    }

    if (data.notes !== undefined && data.notes !== ancienCalibrage.notes) {
      traces.push({
        id: crypto.randomUUID(),
        calibrageId: id,
        userId,
        raison,
        siteId,
        champModifie: "notes",
        ancienneValeur: ancienCalibrage.notes ?? null,
        nouvelleValeur: data.notes ?? null,
      });
    }

    if (data.date !== undefined && new Date(data.date).getTime() !== ancienCalibrage.date.getTime()) {
      traces.push({
        id: crypto.randomUUID(),
        calibrageId: id,
        userId,
        raison,
        siteId,
        champModifie: "date",
        ancienneValeur: ancienCalibrage.date.toISOString(),
        nouvelleValeur: data.date,
      });
    }

    if (data.groupes !== undefined) {
      traces.push({
        id: crypto.randomUUID(),
        calibrageId: id,
        userId,
        raison,
        siteId,
        champModifie: "groupes",
        ancienneValeur: JSON.stringify(
          ancienCalibrage.groupes.map((g) => ({
            categorie: g.categorie,
            destinationBacId: g.destinationBacId,
            nombrePoissons: g.nombrePoissons,
            poidsMoyen: g.poidsMoyen,
            tailleMoyenne: g.tailleMoyenne,
          }))
        ),
        nouvelleValeur: JSON.stringify(data.groupes),
      });
    }

    if (traces.length === 0) {
      throw new Error("Aucun champ n'a ete modifie");
    }

    await tx.calibrageModification.createMany({ data: traces });

    // 9d. Fetch du calibrage mis a jour avec toutes ses relations
    const updatedCalibrage = await tx.calibrage.findFirst({
      where: { id, siteId },
      include: {
        vague: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
        groupes: {
          include: { destinationBac: { select: { id: true, nom: true } } },
        },
        modifications: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!updatedCalibrage) throw new Error("Erreur interne : calibrage introuvable apres mise a jour");

    const result = updatedCalibrage as unknown as CalibrageWithModifications;
    const newModifications = result.modifications.filter(
      (m) => traces.some((t) => t.champModifie === m.champModifie)
    ) as CalibrageModificationWithUser[];

    return { calibrage: result, modifications: newModifications };
  });
}
