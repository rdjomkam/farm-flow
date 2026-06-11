/**
 * Queries Prisma — Arrivages d'alevins dans les vagues PRE_GROSSISSEMENT.
 *
 * Un arrivage = entrée externe de poissons (achat fournisseur, alevinage interne, etc.)
 * dans une vague PRE_GROSSISSEMENT EN_COURS. Chaque groupe correspond à un bac
 * destinataire avec un nombre de poissons et un poids moyen.
 *
 * Effets atomiques dans la transaction :
 *  1. Créer l'en-tête Arrivage + ArrivageGroupe[]
 *  2. Mettre à jour AssignationBac (topup) ou créer si bac libre
 *  3. Mettre à jour la vague : nombreInitial += Σ(qty), recalcul pondéré poidsMoyenInitial
 *  4. Auto-créer un relevé BIOMETRIE + un relevé ARRIVAGE par groupe
 *
 * Pattern de référence : calibrages.ts (transaction atomique, snapshot, auto-relevés).
 *
 * Règles critiques :
 * - R2 : enums importés depuis @/types, jamais de strings en dur
 * - R4 : toutes les mutations dans prisma.$transaction, updateMany avec borne basse
 * - R8 : toutes les queries filtrent par siteId
 * - ERR-089 : source de vérité = AssignationBac, jamais Bac.vagueId
 * - ERR-093 : pas de cast forcé sur retours Prisma
 * - MEMORY.md Prisma 7 : create + findUniqueOrThrow séparés si include nécessaire
 * - ADR-043 : AssignationBac.nombreActuel = source de vérité pour le compte de poissons
 */

import { prisma } from "@/lib/db";
import { StatutVague, TypeVague, TypeReleve } from "@/types";
import type {
  CreateArrivageDTO,
  UpdateArrivageGroupeDTO,
} from "@/types";
import type {
  ArrivageWithRelations,
  ArrivageGroupe,
} from "@/types";

// ---------------------------------------------------------------------------
// Include standard pour ArrivageWithRelations
// ---------------------------------------------------------------------------

const arrivageWithRelationsInclude = {
  vague: { select: { id: true, code: true, type: true } },
  user: { select: { id: true, name: true } },
  groupes: {
    include: {
      destinationBac: { select: { id: true, nom: true } },
    },
  },
  modifications: {
    orderBy: { createdAt: "desc" as const },
    include: {
      user: { select: { id: true, name: true } },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// 1. createArrivage
// ---------------------------------------------------------------------------

/**
 * Crée un arrivage d'alevins dans une vague PRE_GROSSISSEMENT de manière atomique.
 *
 * Transaction atomique (timeout 30s). Étapes :
 *  1. Validation DTO de base
 *  2. Vérification vague (type + statut + siteId)
 *  3. Vérification bacs destination (existence + disponibilité)
 *  4. Snapshot avant (état vague + AssignationBac)
 *  5. Création Arrivage + groupes (nested create, Prisma 7 pattern)
 *  6. Recalcul pondéré accumulatif sur la vague
 *  7. Mise à jour ou création des AssignationBac par bac destination (topup)
 *  8. Auto-création des relevés BIOMETRIE + ARRIVAGE par groupe
 *
 * Note sur le relevé ARRIVAGE :
 *   On crée deux relevés par groupe : BIOMETRIE (poids) + ARRIVAGE (quantité).
 *   ARRIVAGE utilise nombreCompte pour stocker la quantité arrivée (champ existant
 *   sur Releve, sémantiquement proche du comptage physique). Ce choix évite
 *   d'ajouter un nouveau champ nombreArrives et est cohérent avec le pattern
 *   MORTALITE (nombreMorts) et COMPTAGE (nombreCompte) du calibrage.
 */
export async function createArrivage(
  siteId: string,
  userId: string,
  dto: CreateArrivageDTO
): Promise<ArrivageWithRelations> {
  return prisma.$transaction(
    async (tx) => {
      // -----------------------------------------------------------------------
      // Étape 1 — Validation DTO de base
      // -----------------------------------------------------------------------
      if (!dto.groupes || dto.groupes.length === 0) {
        throw new Error("Au moins un groupe est requis");
      }
      for (const g of dto.groupes) {
        if (!g.destinationBacId || g.destinationBacId.trim() === "") {
          throw new Error("destinationBacId est requis pour chaque groupe");
        }
        if (g.nombrePoissons <= 0) {
          throw new Error("nombrePoissons doit être > 0 pour chaque groupe");
        }
        if (g.poidsMoyen <= 0) {
          throw new Error("poidsMoyen doit être > 0 pour chaque groupe");
        }
      }

      const arrivageDate = dto.date ? new Date(dto.date) : new Date();

      // -----------------------------------------------------------------------
      // Étape 2 — Vérifier la vague (existence + siteId + type + statut)
      // -----------------------------------------------------------------------
      const vague = await tx.vague.findFirst({
        where: { id: dto.vagueId, siteId },
      });

      if (!vague) {
        throw new Error("Vague introuvable ou n'appartient pas à ce site");
      }
      if (vague.type !== TypeVague.PRE_GROSSISSEMENT) {
        throw new Error(
          "Les arrivages ne sont possibles que sur les vagues de pré-grossissement"
        );
      }
      if (vague.statut !== StatutVague.EN_COURS) {
        throw new Error(
          `La vague ${vague.code} n'est pas EN_COURS (statut actuel : ${vague.statut})`
        );
      }

      // -----------------------------------------------------------------------
      // Étape 3 — Vérifier les bacs destination
      //   - Existent et appartiennent au site
      //   - Soit ont une AssignationBac active pour cette vague (topup autorisé)
      //   - Soit n'ont aucune AssignationBac active du tout (bac libre — création)
      //   - Refuser si bac actif sur une AUTRE vague (conflit)
      // -----------------------------------------------------------------------
      const uniqueDestBacIds = [
        ...new Set(dto.groupes.map((g) => g.destinationBacId)),
      ];

      // Vérifier que tous les bacs existent et appartiennent au site
      const bacs = await tx.bac.findMany({
        where: { id: { in: uniqueDestBacIds }, siteId },
        select: { id: true, nom: true },
      });

      if (bacs.length !== uniqueDestBacIds.length) {
        throw new Error(
          "Un ou plusieurs bacs de destination sont introuvables ou n'appartiennent pas à ce site"
        );
      }

      // Vérifier conflits : pas d'AssignationBac active sur une autre vague
      for (const bacId of uniqueDestBacIds) {
        const autreAssignation = await tx.assignationBac.findFirst({
          where: {
            bacId,
            siteId,
            dateFin: null,
            NOT: { vagueId: dto.vagueId },
          },
          select: { vagueId: true },
        });
        if (autreAssignation) {
          const bacNom = bacs.find((b) => b.id === bacId)?.nom ?? bacId;
          throw new Error(
            `Le bac "${bacNom}" est déjà assigné à une autre vague active — conflit`
          );
        }
      }

      // -----------------------------------------------------------------------
      // Étape 4 — Snapshot avant (état vague + AssignationBac actuels)
      // -----------------------------------------------------------------------
      const allAssignationsVague = await tx.assignationBac.findMany({
        where: { vagueId: dto.vagueId, siteId, dateFin: null },
        select: {
          bacId: true,
          nombreActuel: true,
          nombreInitial: true,
          poidsMoyenInitial: true,
          bac: { select: { id: true, nom: true } },
        },
      });

      const snapshotAvant = {
        capturedAt: new Date().toISOString(),
        vague: {
          id: vague.id,
          code: vague.code,
          nombreInitial: vague.nombreInitial,
          poidsMoyenInitial: vague.poidsMoyenInitial,
          statut: vague.statut,
        },
        allBacsOfVague: allAssignationsVague.map((a) => ({
          id: a.bac.id,
          nom: a.bac.nom,
          nombreActuel: a.nombreActuel,
          nombreInitial: a.nombreInitial,
          poidsMoyenInitial: a.poidsMoyenInitial,
          vagueId: dto.vagueId,
        })),
      };

      // -----------------------------------------------------------------------
      // Étape 5 — Créer l'en-tête Arrivage + groupes (Prisma 7 pattern)
      //           create sans include, puis findUniqueOrThrow avec relations
      // -----------------------------------------------------------------------
      const arrivageRaw = await tx.arrivage.create({
        data: {
          vagueId: dto.vagueId,
          date: arrivageDate,
          origine: dto.origine ?? null,
          notes: dto.notes ?? null,
          siteId,
          userId,
          snapshotAvant: snapshotAvant as object,
          groupes: {
            create: dto.groupes.map((g) => ({
              destinationBacId: g.destinationBacId,
              nombrePoissons: g.nombrePoissons,
              poidsMoyen: g.poidsMoyen,
            })),
          },
        },
      });

      const arrivage = await tx.arrivage.findUniqueOrThrow({
        where: { id: arrivageRaw.id },
        include: arrivageWithRelationsInclude,
      });

      // -----------------------------------------------------------------------
      // Étape 6 — Recalcul pondéré accumulatif sur la vague
      //   Charger état actuel, accumuler groupe par groupe
      // -----------------------------------------------------------------------
      const vagueActuelle = await tx.vague.findUniqueOrThrow({
        where: { id: dto.vagueId },
        select: { nombreInitial: true, poidsMoyenInitial: true },
      });

      // Si la vague était vide avant cet arrivage, c'est la première mise en eau
      // → on synchronise dateDebut avec la date de l'arrivage pour que J reflète
      // la vraie durée d'élevage.
      const wasEmpty = vagueActuelle.nombreInitial === 0;

      let accTotal = vagueActuelle.nombreInitial;
      let accAvg = vagueActuelle.poidsMoyenInitial;

      for (const g of dto.groupes) {
        const newTotal = accTotal + g.nombrePoissons;
        accAvg =
          newTotal === 0
            ? 0
            : (accTotal * accAvg + g.nombrePoissons * g.poidsMoyen) / newTotal;
        accTotal = newTotal;
      }

      await tx.vague.update({
        where: { id: dto.vagueId },
        data: {
          nombreInitial: accTotal,
          poidsMoyenInitial: accAvg,
          ...(wasEmpty && { dateDebut: arrivageDate }),
        },
      });

      // -----------------------------------------------------------------------
      // Étapes 7 + 8 — Pour chaque groupe : màj AssignationBac + auto-relevés
      // -----------------------------------------------------------------------
      for (const g of dto.groupes) {
        // -------------------------------------------------------------------
        // Étape 7 — Topup ou création AssignationBac
        // -------------------------------------------------------------------
        const existingAssign = await tx.assignationBac.findFirst({
          where: { bacId: g.destinationBacId, vagueId: dto.vagueId, dateFin: null },
          select: {
            id: true,
            nombreActuel: true,
            nombreInitial: true,
            poidsMoyenInitial: true,
          },
        });

        if (existingAssign) {
          // Topup — incrémenter nombreActuel, nombreInitial et recalcul pondéré
          const oldInitial = existingAssign.nombreInitial ?? 0;
          const oldAvg = existingAssign.poidsMoyenInitial ?? 0;
          const newAssignInitial = oldInitial + g.nombrePoissons;
          const newAssignAvg =
            newAssignInitial === 0
              ? 0
              : (oldInitial * oldAvg + g.nombrePoissons * g.poidsMoyen) /
                newAssignInitial;
          const newAssignActuel =
            (existingAssign.nombreActuel ?? 0) + g.nombrePoissons;

          await tx.assignationBac.update({
            where: { id: existingAssign.id },
            data: {
              nombreActuel: newAssignActuel,
              nombreInitial: newAssignInitial,
              poidsMoyenInitial: newAssignAvg,
            },
          });
        } else {
          // Bac libre — créer une nouvelle AssignationBac pour cette vague
          await tx.assignationBac.create({
            data: {
              bacId: g.destinationBacId,
              vagueId: dto.vagueId,
              siteId,
              dateAssignation: arrivageDate,
              dateFin: null,
              nombreActuel: g.nombrePoissons,
              nombreInitial: g.nombrePoissons,
              poidsMoyenInitial: g.poidsMoyen,
            },
          });
        }

        // -------------------------------------------------------------------
        // Étape 8a — Relevé BIOMETRIE par groupe
        //   Enregistre le poids moyen au moment de l'arrivage pour suivi.
        // -------------------------------------------------------------------
        await tx.releve.create({
          data: {
            date: arrivageDate,
            typeReleve: TypeReleve.BIOMETRIE,
            poidsMoyen: g.poidsMoyen,
            echantillonCount: g.nombrePoissons,
            notes: `Biométrie à l'arrivage${dto.origine ? ` (${dto.origine})` : ""}`,
            vagueId: dto.vagueId,
            bacId: g.destinationBacId,
            siteId,
            arrivageId: arrivage.id,
          },
        });

        // -------------------------------------------------------------------
        // Étape 8b — Relevé ARRIVAGE par groupe
        //   Utilise nombreCompte pour stocker la quantité arrivée (champ existant
        //   sur Releve). Ce choix évite d'ajouter un nouveau champ et est cohérent
        //   avec le pattern MORTALITE (nombreMorts) / COMPTAGE (nombreCompte).
        //   Crée une traçabilité opérationnelle cohérente avec les autres types.
        // -------------------------------------------------------------------
        await tx.releve.create({
          data: {
            date: arrivageDate,
            typeReleve: TypeReleve.ARRIVAGE,
            nombreCompte: g.nombrePoissons,
            poidsMoyen: g.poidsMoyen,
            notes: `Arrivage de ${g.nombrePoissons} poissons${dto.origine ? ` (${dto.origine})` : ""}`,
            vagueId: dto.vagueId,
            bacId: g.destinationBacId,
            siteId,
            arrivageId: arrivage.id,
          },
        });
      }

      return arrivage as unknown as ArrivageWithRelations;
    },
    { timeout: 30000 }
  );
}

// ---------------------------------------------------------------------------
// 2. getArrivageById
// ---------------------------------------------------------------------------

/**
 * Récupère un arrivage par ID avec toutes ses relations.
 *
 * Retourne null si l'arrivage n'existe pas ou n'appartient pas au site.
 */
export async function getArrivageById(
  siteId: string,
  arrivageId: string
): Promise<ArrivageWithRelations | null> {
  const arrivage = await prisma.arrivage.findFirst({
    where: { id: arrivageId, siteId },
    include: arrivageWithRelationsInclude,
  });

  return arrivage as unknown as ArrivageWithRelations | null;
}

// ---------------------------------------------------------------------------
// 3. listArrivagesForVague
// ---------------------------------------------------------------------------

/**
 * Liste les arrivages d'une vague, triés par date décroissante.
 *
 * Sécurité multi-tenant : filtre sur siteId (R8).
 */
export async function listArrivagesForVague(
  siteId: string,
  vagueId: string
): Promise<ArrivageWithRelations[]> {
  const arrivages = await prisma.arrivage.findMany({
    where: { vagueId, siteId },
    include: arrivageWithRelationsInclude,
    orderBy: { date: "desc" },
  });

  return arrivages as unknown as ArrivageWithRelations[];
}

// ---------------------------------------------------------------------------
// 4. updateArrivageGroupe
// ---------------------------------------------------------------------------

/**
 * Modifie un ArrivageGroupe de façon rétroactive avec traçabilité obligatoire.
 *
 * Transaction atomique (timeout 30s). Étapes :
 *  1. Validation DTO (raison obligatoire)
 *  2. Fetch groupe + arrivage parent + vague — vérification siteId
 *  3. Vérification vague encore EN_COURS et type PRE_GROSSISSEMENT
 *  4. Capture snapshotAvant (état ancien du groupe)
 *  5. Annulation des effets précédents sur AssignationBac et Vague
 *  6. Application des nouvelles valeurs sur AssignationBac et Vague
 *  7. Création ArrivageModification (audit)
 *  8. Update ArrivageGroupe + flag arrivage.modifie = true
 *
 * Limitation documentée :
 *   Le recalcul inverse pondéré est mathématiquement imparfait en cas de
 *   modifications multiples successives (instabilité numérique cumulée).
 *   Accepté comme limitation de la v1 — voir ADR-015 pour le contexte.
 */
export async function updateArrivageGroupe(
  siteId: string,
  userId: string,
  groupeId: string,
  dto: UpdateArrivageGroupeDTO
): Promise<ArrivageGroupe> {
  if (!dto.raison || dto.raison.trim().length === 0) {
    throw new Error("La raison de la modification est obligatoire");
  }

  return prisma.$transaction(
    async (tx) => {
      // -----------------------------------------------------------------------
      // Étape 2 — Fetch groupe + arrivage parent + vague
      // -----------------------------------------------------------------------
      const groupe = await tx.arrivageGroupe.findFirst({
        where: { id: groupeId },
        include: {
          arrivage: {
            select: {
              id: true,
              siteId: true,
              vagueId: true,
              date: true,
              vague: {
                select: {
                  id: true,
                  code: true,
                  type: true,
                  statut: true,
                  nombreInitial: true,
                  poidsMoyenInitial: true,
                },
              },
            },
          },
        },
      });

      if (!groupe) {
        throw new Error("ArrivageGroupe introuvable");
      }
      if (groupe.arrivage.siteId !== siteId) {
        throw new Error("Accès refusé : ce groupe n'appartient pas à ce site");
      }

      const { vague, vagueId } = groupe.arrivage;

      // -----------------------------------------------------------------------
      // Étape 3 — Vérifier vague EN_COURS et type PRE_GROSSISSEMENT
      // -----------------------------------------------------------------------
      if (vague.type !== TypeVague.PRE_GROSSISSEMENT) {
        throw new Error(
          "Les modifications d'arrivage ne sont possibles que sur les vagues de pré-grossissement"
        );
      }
      if (vague.statut !== StatutVague.EN_COURS) {
        throw new Error(
          `Modification impossible : la vague ${vague.code} n'est pas EN_COURS`
        );
      }

      // -----------------------------------------------------------------------
      // Étape 4 — Snapshot avant (état ancien du groupe)
      // -----------------------------------------------------------------------
      const snapshotAvant = {
        nombrePoissons: groupe.nombrePoissons,
        poidsMoyen: groupe.poidsMoyen,
        destinationBacId: groupe.destinationBacId,
      };

      const ancienNombrePoissons = groupe.nombrePoissons;
      const ancienPoidsMoyen = groupe.poidsMoyen;
      const ancienDestBacId = groupe.destinationBacId;

      const nouveauNombrePoissons = dto.nombrePoissons ?? ancienNombrePoissons;
      const nouveauPoidsMoyen = dto.poidsMoyen ?? ancienPoidsMoyen;
      const nouveauDestBacId = dto.destinationBacId ?? ancienDestBacId;

      // -----------------------------------------------------------------------
      // Étape 5 — Annulation des effets précédents
      // 5a. Sur AssignationBac ancienne : décrémenter de l'ancienne qty
      // 5b. Sur Vague : décrémenter nombreInitial + recalcul inverse pondéré
      //
      // Limitation : le recalcul inverse pondéré est imparfait si poidsMoyenInitial
      // a été influencé par d'autres groupes ou modifications. Accepté en v1.
      // -----------------------------------------------------------------------

      // 5a. Annuler l'effet sur l'ancienne AssignationBac
      const ancienneAssignation = await tx.assignationBac.findFirst({
        where: { bacId: ancienDestBacId, vagueId, dateFin: null },
        select: { id: true, nombreActuel: true, nombreInitial: true, poidsMoyenInitial: true },
      });

      if (ancienneAssignation) {
        const oldInitial = ancienneAssignation.nombreInitial ?? 0;
        const oldAvg = ancienneAssignation.poidsMoyenInitial ?? 0;
        const newInitialAnnule = Math.max(0, oldInitial - ancienNombrePoissons);
        // Recalcul inverse pondéré
        const newAvgAnnule =
          newInitialAnnule <= 0 || oldInitial <= 0
            ? 0
            : (oldInitial * oldAvg - ancienNombrePoissons * ancienPoidsMoyen) /
              newInitialAnnule;

        await tx.assignationBac.update({
          where: { id: ancienneAssignation.id },
          data: {
            nombreActuel: Math.max(
              0,
              (ancienneAssignation.nombreActuel ?? 0) - ancienNombrePoissons
            ),
            nombreInitial: newInitialAnnule,
            poidsMoyenInitial: Math.max(0, newAvgAnnule),
          },
        });
      }

      // 5b. Annuler l'effet sur la vague
      const totalVagueApresAnnulation = Math.max(
        0,
        vague.nombreInitial - ancienNombrePoissons
      );
      const avgVagueApresAnnulation =
        totalVagueApresAnnulation <= 0 || vague.nombreInitial <= 0
          ? 0
          : (vague.nombreInitial * vague.poidsMoyenInitial -
              ancienNombrePoissons * ancienPoidsMoyen) /
            totalVagueApresAnnulation;

      await tx.vague.update({
        where: { id: vagueId },
        data: {
          nombreInitial: totalVagueApresAnnulation,
          poidsMoyenInitial: Math.max(0, avgVagueApresAnnulation),
        },
      });

      // -----------------------------------------------------------------------
      // Étape 6 — Application des nouvelles valeurs
      // 6a. Sur AssignationBac nouvelle (peut être le même bac ou un nouveau)
      // 6b. Sur Vague : recalcul pondéré accumulatif
      // -----------------------------------------------------------------------

      // 6a. Appliquer sur l'AssignationBac du nouveau bac destination
      if (nouveauDestBacId === ancienDestBacId) {
        // Même bac : travailler sur l'assignation déjà décrémntée
        const assignApresAnnulation = await tx.assignationBac.findFirst({
          where: { bacId: nouveauDestBacId, vagueId, dateFin: null },
          select: { id: true, nombreActuel: true, nombreInitial: true, poidsMoyenInitial: true },
        });

        if (assignApresAnnulation) {
          const baseInitial = assignApresAnnulation.nombreInitial ?? 0;
          const baseAvg = assignApresAnnulation.poidsMoyenInitial ?? 0;
          const newInitial = baseInitial + nouveauNombrePoissons;
          const newAvg =
            newInitial === 0
              ? 0
              : (baseInitial * baseAvg + nouveauNombrePoissons * nouveauPoidsMoyen) /
                newInitial;

          await tx.assignationBac.update({
            where: { id: assignApresAnnulation.id },
            data: {
              nombreActuel:
                (assignApresAnnulation.nombreActuel ?? 0) + nouveauNombrePoissons,
              nombreInitial: newInitial,
              poidsMoyenInitial: newAvg,
            },
          });
        } else {
          // Cas défensif : créer si inexistant
          await tx.assignationBac.create({
            data: {
              bacId: nouveauDestBacId,
              vagueId,
              siteId,
              dateAssignation: groupe.arrivage.date,
              dateFin: null,
              nombreActuel: nouveauNombrePoissons,
              nombreInitial: nouveauNombrePoissons,
              poidsMoyenInitial: nouveauPoidsMoyen,
            },
          });
        }
      } else {
        // Bac différent : appliquer sur le nouveau bac
        const nouvelleAssignation = await tx.assignationBac.findFirst({
          where: { bacId: nouveauDestBacId, vagueId, dateFin: null },
          select: { id: true, nombreActuel: true, nombreInitial: true, poidsMoyenInitial: true },
        });

        if (nouvelleAssignation) {
          const baseInitial = nouvelleAssignation.nombreInitial ?? 0;
          const baseAvg = nouvelleAssignation.poidsMoyenInitial ?? 0;
          const newInitial = baseInitial + nouveauNombrePoissons;
          const newAvg =
            newInitial === 0
              ? 0
              : (baseInitial * baseAvg + nouveauNombrePoissons * nouveauPoidsMoyen) /
                newInitial;

          await tx.assignationBac.update({
            where: { id: nouvelleAssignation.id },
            data: {
              nombreActuel:
                (nouvelleAssignation.nombreActuel ?? 0) + nouveauNombrePoissons,
              nombreInitial: newInitial,
              poidsMoyenInitial: newAvg,
            },
          });
        } else {
          // Nouveau bac libre ou pas encore dans cette vague
          await tx.assignationBac.create({
            data: {
              bacId: nouveauDestBacId,
              vagueId,
              siteId,
              dateAssignation: groupe.arrivage.date,
              dateFin: null,
              nombreActuel: nouveauNombrePoissons,
              nombreInitial: nouveauNombrePoissons,
              poidsMoyenInitial: nouveauPoidsMoyen,
            },
          });
        }
      }

      // 6b. Appliquer les nouvelles valeurs sur la vague (après annulation en étape 5b)
      const vagueApresAnnulation = await tx.vague.findUniqueOrThrow({
        where: { id: vagueId },
        select: { nombreInitial: true, poidsMoyenInitial: true },
      });

      const newVagueTotal =
        vagueApresAnnulation.nombreInitial + nouveauNombrePoissons;
      const newVagueAvg =
        newVagueTotal === 0
          ? 0
          : (vagueApresAnnulation.nombreInitial *
              vagueApresAnnulation.poidsMoyenInitial +
              nouveauNombrePoissons * nouveauPoidsMoyen) /
            newVagueTotal;

      await tx.vague.update({
        where: { id: vagueId },
        data: {
          nombreInitial: newVagueTotal,
          poidsMoyenInitial: newVagueAvg,
        },
      });

      // -----------------------------------------------------------------------
      // Étape 7 — Créer ArrivageModification (audit)
      // -----------------------------------------------------------------------
      const snapshotApres = {
        nombrePoissons: nouveauNombrePoissons,
        poidsMoyen: nouveauPoidsMoyen,
        destinationBacId: nouveauDestBacId,
      };

      await tx.arrivageModification.create({
        data: {
          arrivageId: groupe.arrivage.id,
          userId,
          raison: dto.raison,
          snapshotAvant: snapshotAvant as object,
          snapshotApres: snapshotApres as object,
          siteId,
        },
      });

      // -----------------------------------------------------------------------
      // Étape 8 — Update ArrivageGroupe + flag arrivage.modifie = true
      // -----------------------------------------------------------------------
      await tx.arrivage.update({
        where: { id: groupe.arrivage.id },
        data: { modifie: true },
      });

      await tx.arrivageGroupe.update({
        where: { id: groupeId },
        data: {
          nombrePoissons: nouveauNombrePoissons,
          poidsMoyen: nouveauPoidsMoyen,
          destinationBacId: nouveauDestBacId,
        },
      });

      // Retourner le groupe mis à jour avec ses relations — Prisma 7 pattern
      const updated = await tx.arrivageGroupe.findUniqueOrThrow({
        where: { id: groupeId },
        include: {
          destinationBac: { select: { id: true, nom: true } },
        },
      });

      return updated as unknown as ArrivageGroupe;
    },
    { timeout: 30000 }
  );
}
