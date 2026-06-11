import { prisma } from "@/lib/db";
import { StatutVague, TypeReleve, CauseMortalite, MethodeComptage, CategorieCalibrage } from "@/types";
import type { CreateCalibrageDTO, PatchCalibrageBody, CalibrageSnapshot } from "@/types";
import type { CalibrageWithModifications, CalibrageModificationWithUser } from "@/types";
import { computeVivantsByBac } from "@/lib/calculs";
import { ConservationError } from "@/lib/errors";

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
    // ADR-043 Phase 3: source of truth is AssignationBac (dateFin = null)
    const sourceAssignations = await tx.assignationBac.findMany({
      where: {
        bacId: { in: data.sourceBacIds },
        vagueId: data.vagueId,
        siteId,
        dateFin: null,
      },
      include: {
        bac: { select: { id: true, nom: true } },
      },
    });

    if (sourceAssignations.length !== data.sourceBacIds.length) {
      throw new Error(
        "Un ou plusieurs bacs sources n'appartiennent pas a cette vague"
      );
    }

    // Keep sourceBacs shape for compatibility (id + nom only)
    const sourceBacs = sourceAssignations.map((a) => a.bac);

    for (const assignation of sourceAssignations) {
      if ((assignation.nombreActuel ?? 0) <= 0) {
        throw new Error(
          `Le bac ${assignation.bac.nom} ne contient aucun poisson a calibrer`
        );
      }
    }

    // 3. Verify destination bacs belong to the same vague
    // ADR-043 Phase 3: source of truth is AssignationBac (dateFin = null)
    const destBacIds = data.groupes.map((g) => g.destinationBacId);
    const uniqueDestBacIds = [...new Set(destBacIds)];
    const destAssignations = await tx.assignationBac.findMany({
      where: {
        bacId: { in: uniqueDestBacIds },
        vagueId: data.vagueId,
        siteId,
        dateFin: null,
      },
      select: { bacId: true },
    });

    if (destAssignations.length !== uniqueDestBacIds.length) {
      throw new Error(
        "Un ou plusieurs bacs de destination n'appartiennent pas a cette vague"
      );
    }

    // 4. Conservation check — utilise computeVivantsByBac (BUG-048)
    // AssignationBac.nombreActuel n'est PAS decremente par les mortalites ; on doit
    // donc recalculer les vivants en combinant nombreInitial + comptages + mortalites.
    const allAssignationsVague = await tx.assignationBac.findMany({
      where: { vagueId: data.vagueId, siteId, dateFin: null },
      select: { bacId: true, nombreInitial: true },
    });
    // computeVivantsByBac expects { id, nombreInitial }
    const allBacsVague = allAssignationsVague.map((a) => ({ id: a.bacId, nombreInitial: a.nombreInitial ?? null }));
    const relevesForVivants = await tx.releve.findMany({
      where: {
        siteId,
        vagueId: data.vagueId,
        // Tous les types qui affectent les vivants (sinon le calibrage surestime les vivants
        // après transferts/ventes/arrivages — voir computeVivantsByBac).
        typeReleve: {
          in: [
            TypeReleve.MORTALITE,
            TypeReleve.COMPTAGE,
            TypeReleve.ARRIVAGE,
            TypeReleve.TRANSFERT,
            TypeReleve.VENTE,
          ],
        },
      },
      orderBy: { date: "asc" },
      select: { bacId: true, typeReleve: true, nombreMorts: true, nombreVendus: true, nombreTransferes: true, nombreCompte: true, date: true },
    });
    const vivantsByBac = computeVivantsByBac(
      allBacsVague,
      relevesForVivants,
      vague.nombreInitial
    );

    // Suppression du fallback dangereux (BUG CG — 10 juin 2026) :
    // si computeVivantsByBac n'a pas de donnee pour un bac source, on rejette
    // immediatement plutot que de tomber sur nombreActuel non-decremente.
    let totalSourcePoissons = 0;
    for (const bac of sourceBacs) {
      const v = vivantsByBac.get(bac.id);
      if (v == null) {
        throw new ConservationError(
          `Impossible de calculer les vivants pour le bac ${bac.nom}. Aucun releve exploitable.`,
          0, 0, 0, 0
        );
      }
      totalSourcePoissons += v;
    }

    const totalGroupePoissons = data.groupes.reduce(
      (sum, g) => sum + g.nombrePoissons,
      0
    );

    const totalSaisi = totalGroupePoissons + data.nombreMorts;
    const ecartSigne = totalSaisi - totalSourcePoissons;
    const ecartAbs = Math.abs(ecartSigne);
    const tolerance = Math.max(1, Math.round(totalSourcePoissons * 0.005)); // 0.5 % min 1
    if (ecartAbs > tolerance) {
      throw new ConservationError(
        `Conservation non respectee. Sources : ${totalSourcePoissons} poissons vivants. Saisi : ${totalGroupePoissons} (redistribues) + ${data.nombreMorts} (morts) = ${totalSaisi}. Ecart : ${ecartSigne > 0 ? "+" : ""}${ecartSigne}. Tous les poissons doivent etre saisis dans une categorie.`,
        totalSourcePoissons,
        totalSaisi,
        ecartSigne,
        data.nombreMorts
      );
    }

    // 5a. Capture snapshotAvant — état vague + tous ses bacs AVANT toute mutation (Fix 5)
    // ADR-043 Phase 3: bac data sourced from AssignationBac
    const allBacsOfVagueRaw = await tx.assignationBac.findMany({
      where: { vagueId: data.vagueId, siteId, dateFin: null },
      select: { bacId: true, nombreActuel: true, nombreInitial: true, poidsMoyenInitial: true, bac: { select: { id: true, nom: true } } },
    });
    const allBacsOfVague = allBacsOfVagueRaw.map((a) => ({
      id: a.bac.id,
      nom: a.bac.nom,
      nombrePoissons: a.nombreActuel,
      nombreInitial: a.nombreInitial,
      poidsMoyenInitial: a.poidsMoyenInitial,
      vagueId: data.vagueId,
    }));
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

    // 5b. Snapshot bacs sources if nombreInitial is null — update AssignationBac
    for (const assignation of sourceAssignations) {
      if (assignation.nombreInitial === null) {
        await tx.assignationBac.updateMany({
          where: { bacId: assignation.bac.id, vagueId: data.vagueId, dateFin: null },
          data: {
            nombreInitial: assignation.nombreActuel,
          },
        });
      }
    }

    // 6. Create Calibrage with nested CalibrageGroupe records
    const calibrageDate = data.date ? new Date(data.date) : new Date();
    const calibrageRaw = await tx.calibrage.create({
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
    });
    const calibrage = await tx.calibrage.findUniqueOrThrow({
      where: { id: calibrageRaw.id },
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

    // 7. Two-pass bac update — ADR-043 Phase 3: only AssignationBac, no Bac fields
    // Pass 1: Set all source bacs to 0
    await tx.assignationBac.updateMany({
      where: { bacId: { in: data.sourceBacIds }, vagueId: data.vagueId, dateFin: null },
      data: { nombreActuel: 0 },
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
        await tx.assignationBac.updateMany({
          where: { bacId, vagueId: data.vagueId, dateFin: null },
          data: { nombreActuel: total },
        });
      } else {
        // Lire la valeur actuelle de l'assignation active pour l'incrément
        const assignationDest = await tx.assignationBac.findFirst({
          where: { bacId, vagueId: data.vagueId, dateFin: null },
          select: { id: true, nombreActuel: true, nombreInitial: true, poidsMoyenInitial: true },
        });

        if (assignationDest) {
          // Cas normal : AssignationBac existe
          await tx.assignationBac.update({
            where: { id: assignationDest.id },
            data: { nombreActuel: (assignationDest.nombreActuel ?? 0) + total },
          });
        } else {
          // AssignationBac manquante — create défensif pour le bac destination
          // Try to get initial values from most recent historical assignation for this bac
          const historicAssignation = await tx.assignationBac.findFirst({
            where: { bacId, vagueId: data.vagueId },
            orderBy: { createdAt: "desc" },
            select: { nombreInitial: true, poidsMoyenInitial: true },
          });
          await tx.assignationBac.create({
            data: {
              bacId,
              vagueId: data.vagueId,
              siteId,
              dateAssignation: calibrageDate,
              dateFin: null,
              nombreActuel: total,
              nombreInitial: historicAssignation?.nombreInitial ?? 0,
              poidsMoyenInitial: historicAssignation?.poidsMoyenInitial ?? 0,
            },
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
    // Etape 4 — Verification de conservation (tolerance 0.5 % min 1)
    // ----------------------------------------------------------------
    if (data.nombreMorts !== undefined || data.groupes !== undefined) {
      const totalNouveauxGroupes = nouveauxGroupes.reduce((sum, g) => sum + g.nombrePoissons, 0);
      const totalNouveaux = totalNouveauxGroupes + nouveauxNombreMorts;
      const ecartSignePatch = totalNouveaux - totalSourcePoissons;
      const ecartAbsPatch = Math.abs(ecartSignePatch);
      const tolerancePatch = Math.max(1, Math.round(totalSourcePoissons * 0.005)); // 0.5 % min 1
      if (ecartAbsPatch > tolerancePatch) {
        throw new ConservationError(
          `Conservation non respectee. Sources : ${totalSourcePoissons} poissons vivants. Saisi : ${totalNouveauxGroupes} (redistribues) + ${nouveauxNombreMorts} (morts) = ${totalNouveaux}. Ecart : ${ecartSignePatch > 0 ? "+" : ""}${ecartSignePatch}. Tous les poissons doivent etre saisis dans une categorie.`,
          totalSourcePoissons,
          totalNouveaux,
          ecartSignePatch,
          nouveauxNombreMorts
        );
      }
    }

    // ----------------------------------------------------------------
    // Etape 5 — Verification des bacs de destination si groupes modifies
    // ----------------------------------------------------------------
    if (data.groupes !== undefined) {
      const uniqueNewDestIds = [...new Set(data.groupes.map((g) => g.destinationBacId))];
      // ADR-043 Phase 3: verify via AssignationBac only
      const destAssignationsPatch = await tx.assignationBac.findMany({
        where: {
          bacId: { in: uniqueNewDestIds },
          vagueId: ancienCalibrage.vague.id,
          siteId,
          dateFin: null,
        },
        select: { bacId: true },
      });
      if (destAssignationsPatch.length !== uniqueNewDestIds.length) {
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
      // ADR-043 Phase 3: only AssignationBac, no Bac.nombrePoissons
      for (const [bacId, ancienTotal] of ancienDestTotals.entries()) {
        const assignationDest6 = await tx.assignationBac.findFirst({
          where: { bacId, vagueId: ancienCalibrage.vague.id, dateFin: null },
          select: { id: true, nombreActuel: true },
        });
        if (assignationDest6) {
          await tx.assignationBac.update({
            where: { id: assignationDest6.id },
            data: { nombreActuel: (assignationDest6.nombreActuel ?? 0) - ancienTotal },
          });
        }
      }

      // 6c. Remettre les poissons sur le premier bac source
      // (approche v1 : totalSourcePoissons sur le premier source)
      if (ancienCalibrage.sourceBacIds.length > 0) {
        const firstSourceId = ancienCalibrage.sourceBacIds[0];
        // ADR-043 Phase 3: only AssignationBac
        const assignationSource6 = await tx.assignationBac.findFirst({
          where: { bacId: firstSourceId, vagueId: ancienCalibrage.vague.id, dateFin: null },
          select: { id: true, nombreActuel: true },
        });
        if (assignationSource6) {
          await tx.assignationBac.update({
            where: { id: assignationSource6.id },
            data: { nombreActuel: (assignationSource6.nombreActuel ?? 0) + totalSourcePoissons },
          });
        }
      }
    }

    // ----------------------------------------------------------------
    // Etape 7 — Application du nouveau dispatch sur les bacs
    // ADR-043 Phase 3: only AssignationBac, no Bac.nombrePoissons
    // ----------------------------------------------------------------
    if (data.groupes !== undefined) {
      // Pass 1 : zeroed tous les bacs sources via AssignationBac
      await tx.assignationBac.updateMany({
        where: { bacId: { in: ancienCalibrage.sourceBacIds }, vagueId: ancienCalibrage.vague.id, dateFin: null },
        data: { nombreActuel: 0 },
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
          // Bac source déjà zeroed en Pass 1 — fixer au total reçu
          await tx.assignationBac.updateMany({
            where: { bacId, vagueId: ancienCalibrage.vague.id, dateFin: null },
            data: { nombreActuel: total },
          });
        } else {
          // Lire l'assignation active pour calculer l'incrément correct
          const assignationDest7 = await tx.assignationBac.findFirst({
            where: { bacId, vagueId: ancienCalibrage.vague.id, dateFin: null },
            select: { id: true, nombreActuel: true },
          });
          if (assignationDest7) {
            await tx.assignationBac.update({
              where: { id: assignationDest7.id },
              data: { nombreActuel: (assignationDest7.nombreActuel ?? 0) + total },
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
    // ADR-043 Phase 3: bac data sourced from AssignationBac
    // ----------------------------------------------------------------
    const allAssignationsVagueModif = await tx.assignationBac.findMany({
      where: { vagueId: ancienCalibrage.vague.id, siteId, dateFin: null },
      select: { bacId: true, nombreActuel: true, nombreInitial: true, poidsMoyenInitial: true, bac: { select: { id: true, nom: true } } },
    });
    const allBacsOfVagueModif = allAssignationsVagueModif.map((a) => ({
      id: a.bac.id,
      nom: a.bac.nom,
      nombrePoissons: a.nombreActuel,
      nombreInitial: a.nombreInitial,
      poidsMoyenInitial: a.poidsMoyenInitial,
      vagueId: ancienCalibrage.vague.id,
    }));
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
