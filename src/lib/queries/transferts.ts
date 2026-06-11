/**
 * Queries Prisma — Transferts inter-vagues pré-grossissement.
 *
 * ADR-046 : transferts de type PRE_GROSSISSEMENT → GROSSISSEMENT.
 * Pattern : clone de calibrages.ts adapté pour cross-vague.
 *
 * Règles critiques :
 * - R2 : enums importés depuis @/types, jamais de strings en dur
 * - R4 : toutes les mutations dans prisma.$transaction, updateMany avec borne basse
 * - R8 : toutes les queries filtrent par siteId
 * - ERR-089 : source de vérité = AssignationBac, jamais Bac.vagueId
 * - ERR-093 : pas de cast forcé sur retours Prisma
 * - MEMORY.md Prisma 7 : create + findUniqueOrThrow séparés si include nécessaire
 */

import { prisma } from "@/lib/db";
import {
  StatutVague,
  TypeVague,
  TypeReleve,
  CauseMortalite,
  ModeTransfert,
} from "@/types";
import type {
  CreateTransfertDTO,
  UpdateTransfertGroupeDTO,
  VagueLineage,
} from "@/types";
import type {
  TransfertWithGroupes,
  TransfertGroupeWithRelations,
} from "@/types";
import { computeVivantsByBac } from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Helper interne — moyenne pondérée cumulative
// ---------------------------------------------------------------------------

function computeWeightedAverage(
  currentTotal: number,
  currentAvg: number,
  newCount: number,
  newAvg: number
): { newTotal: number; newAvg: number } {
  const newTotal = currentTotal + newCount;
  if (newTotal === 0) return { newTotal: 0, newAvg: 0 };
  const computedAvg =
    (currentTotal * currentAvg + newCount * newAvg) / newTotal;
  return { newTotal, newAvg: computedAvg };
}

// ---------------------------------------------------------------------------
// Include standard pour TransfertWithGroupes
// ---------------------------------------------------------------------------

const transfertWithGroupesInclude = {
  user: { select: { id: true, name: true } },
  groupes: {
    include: {
      vagueSource: { select: { id: true, code: true, type: true } },
      vagueDest: { select: { id: true, code: true, type: true } },
      bacSource: { select: { id: true, nom: true } },
      bacDest: { select: { id: true, nom: true } },
      modifications: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// 1. createTransfert
// ---------------------------------------------------------------------------

/**
 * Crée un transfert inter-vagues de manière atomique.
 *
 * Mode A : nouvelle vague GROSSISSEMENT créée dans la même transaction.
 * Mode B : vague GROSSISSEMENT existante mise à jour par recalcul pondéré.
 *
 * Étapes :
 *  1. Validation DTO de base
 *  2. Chargement et vérification des vagues sources (type + statut)
 *  3. Mode A : création de la vague destination
 *  4. Mode B : vérification de la vague destination existante
 *  5. Validation conservation par source (computeVivantsByBac)
 *  6. Validation / création des AssignationBac destination (Mode B)
 *  7. Création de l'en-tête Transfert + groupes (nested create)
 *  8. Décrémentation AssignationBac sources (R4 — updateMany avec borne basse)
 *  9. Incrémentation AssignationBac destinations
 * 10. Recalcul pondéré de la vague destination
 * 11. Auto-création des relevés (MORTALITE + BIOMETRIE)
 * 12. Clôture automatique des vagues sources vidées
 */
export async function createTransfert(
  siteId: string,
  userId: string,
  dto: CreateTransfertDTO
): Promise<TransfertWithGroupes> {
  return prisma.$transaction(
    async (tx) => {
      // -----------------------------------------------------------------------
      // Étape 1 — Validation DTO de base
      // -----------------------------------------------------------------------
      if (!dto.groupes || dto.groupes.length === 0) {
        throw new Error("Au moins un groupe est requis");
      }
      for (let i = 0; i < dto.groupes.length; i++) {
        const g = dto.groupes[i];
        if (!g.bacDestId) {
          throw new Error(`Le bac destination est obligatoire pour le groupe ${i + 1}.`);
        }
        if (g.nombrePoissons <= 0) {
          throw new Error("nombrePoissons doit être > 0 pour chaque groupe");
        }
        if (g.poidsMoyenG <= 0) {
          throw new Error("poidsMoyenG doit être > 0 pour chaque groupe");
        }
        const morts = g.nombreMorts ?? 0;
        if (morts < 0) {
          throw new Error("nombreMorts doit être >= 0 pour chaque groupe");
        }
      }

      const transfertDate = dto.date ? new Date(dto.date) : new Date();

      // -----------------------------------------------------------------------
      // Étape 2 — Charger et vérifier les vagues sources distinctes
      // -----------------------------------------------------------------------
      const uniqueSourceIds = [
        ...new Set(dto.groupes.map((g) => g.vagueSourceId)),
      ];

      const vaguesSources = await tx.vague.findMany({
        where: { id: { in: uniqueSourceIds }, siteId },
      });

      if (vaguesSources.length !== uniqueSourceIds.length) {
        throw new Error(
          "Une ou plusieurs vagues sources sont introuvables ou n'appartiennent pas à ce site"
        );
      }

      for (const vs of vaguesSources) {
        if (vs.type !== TypeVague.PRE_GROSSISSEMENT) {
          throw new Error(
            `La vague ${vs.code} n'est pas de type PRE_GROSSISSEMENT — transfert interdit`
          );
        }
        if (vs.statut !== StatutVague.EN_COURS) {
          throw new Error(
            `La vague source ${vs.code} n'est pas EN_COURS (statut actuel : ${vs.statut})`
          );
        }
      }

      const vagueSourceMap = new Map(vaguesSources.map((v) => [v.id, v]));

      // -----------------------------------------------------------------------
      // Étape 3 / 4 — Déterminer la vague destination
      // -----------------------------------------------------------------------
      let vagueDestId: string;

      if (dto.mode === ModeTransfert.CREATE_NEW) {
        // Mode A — Vérifier unicité du code
        const existing = await tx.vague.findFirst({
          where: { code: dto.nouvelleVague.code, siteId },
          select: { id: true },
        });
        if (existing) {
          throw new Error(
            `Le code de vague "${dto.nouvelleVague.code}" est déjà utilisé sur ce site`
          );
        }

        const nouvelleVagueRaw = await tx.vague.create({
          data: {
            code: dto.nouvelleVague.code,
            type: TypeVague.GROSSISSEMENT,
            statut: StatutVague.EN_COURS,
            nombreInitial: 0,
            poidsMoyenInitial: 0,
            dateDebut: new Date(dto.nouvelleVague.dateDebut),
            poidsObjectifKg: dto.nouvelleVague.poidsObjectifKg ?? null,
            uniteProductionId: dto.nouvelleVague.uniteProductionId ?? null,
            // Note : Vague.notes est une relation NoteIngenieur[], pas un champ scalaire.
            // Les notes libres de l'opération sont stockées dans Transfert.notes.
            siteId,
          },
        });
        vagueDestId = nouvelleVagueRaw.id;
      } else {
        // Mode B — Vérifier la vague destination existante
        vagueDestId = dto.vagueDestId;

        if (uniqueSourceIds.includes(vagueDestId)) {
          throw new Error(
            "La vague destination ne peut pas être aussi une vague source"
          );
        }

        const vagueDest = await tx.vague.findFirst({
          where: { id: vagueDestId, siteId },
        });

        if (!vagueDest) {
          throw new Error(
            "Vague destination introuvable ou n'appartient pas à ce site"
          );
        }
        if (vagueDest.type !== TypeVague.GROSSISSEMENT) {
          throw new Error(
            `La vague destination ${vagueDest.code} n'est pas de type GROSSISSEMENT`
          );
        }
        if (vagueDest.statut !== StatutVague.EN_COURS) {
          throw new Error(
            `La vague destination ${vagueDest.code} n'est pas EN_COURS`
          );
        }
      }

      // -----------------------------------------------------------------------
      // Étape 5 — Validation conservation par source
      // -----------------------------------------------------------------------
      for (const vagueSourceId of uniqueSourceIds) {
        const vague = vagueSourceMap.get(vagueSourceId)!;

        // Charger AssignationBac actives de la vague source
        const assignationsBacs = await tx.assignationBac.findMany({
          where: { vagueId: vagueSourceId, siteId, dateFin: null },
          select: { bacId: true, nombreInitial: true, nombreActuel: true },
        });

        const bacsForCalc = assignationsBacs.map((a) => ({
          id: a.bacId,
          nombreInitial: a.nombreInitial ?? null,
        }));

        // Charger TOUS les types de relevés qui affectent le compte vivant :
        // MORTALITE, COMPTAGE, ARRIVAGE, TRANSFERT, VENTE.
        // Manquer un de ces types fausse le calcul des vivants (ex: ne pas charger
        // TRANSFERT ignore les transferts déjà effectués et surestime les vivants).
        const relevesSource = await tx.releve.findMany({
          where: {
            siteId,
            vagueId: vagueSourceId,
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
          select: {
            bacId: true,
            typeReleve: true,
            nombreMorts: true,
            nombreVendus: true,
            nombreTransferes: true,
            nombreCompte: true,
            date: true,
          },
        });

        const vivantsParBac = computeVivantsByBac(
          bacsForCalc,
          relevesSource,
          vague.nombreInitial
        );

        // Groupes liés à cette vague source
        const groupesSource = dto.groupes.filter(
          (g) => g.vagueSourceId === vagueSourceId
        );

        // Agréger par bacSourceId
        const totalParBacSource = new Map<string | null, number>();
        for (const g of groupesSource) {
          const key = g.bacSourceId ?? null;
          const morts = g.nombreMorts ?? 0;
          const current = totalParBacSource.get(key) ?? 0;
          totalParBacSource.set(key, current + g.nombrePoissons + morts);
        }

        for (const [bacSourceId, total] of totalParBacSource.entries()) {
          if (bacSourceId !== null) {
            // Validation par bac spécifique
            const assignation = assignationsBacs.find(
              (a) => a.bacId === bacSourceId
            );
            const vivants =
              vivantsParBac.get(bacSourceId) ??
              assignation?.nombreActuel ??
              0;
            if (total > vivants) {
              throw new Error(
                `Conservation violée pour le bac source ${bacSourceId} de la vague ${vague.code} : ` +
                  `tentative de transfert de ${total} poissons mais seulement ${vivants} vivants`
              );
            }
          } else {
            // Validation sur l'ensemble de la vague source
            const totalVivants = Array.from(vivantsParBac.values()).reduce(
              (sum, v) => sum + v,
              0
            );
            // Fallback si computeVivantsByBac n'a pas de données
            const totalAssignation = assignationsBacs.reduce(
              (sum, a) => sum + (a.nombreActuel ?? 0),
              0
            );
            const vivantsEffectifs =
              vivantsParBac.size > 0 ? totalVivants : totalAssignation;
            if (total > vivantsEffectifs) {
              throw new Error(
                `Conservation violée pour la vague source ${vague.code} : ` +
                  `tentative de transfert de ${total} poissons mais seulement ${vivantsEffectifs} vivants`
              );
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // Étape 6 — Validation / création des AssignationBac destination (Mode B)
      // -----------------------------------------------------------------------
      const uniqueDestBacIds = [
        ...new Set(
          dto.groupes
            .map((g) => g.bacDestId)
            .filter((id): id is string => id != null)
        ),
      ];

      for (const bacDestId of uniqueDestBacIds) {
        const assignationDest = await tx.assignationBac.findFirst({
          where: { bacId: bacDestId, vagueId: vagueDestId, dateFin: null },
          select: { id: true },
        });

        if (!assignationDest) {
          // Créer l'AssignationBac pour ce bac destination — pattern calibrage lignes 283-301
          const historicAssignation = await tx.assignationBac.findFirst({
            where: { bacId: bacDestId, vagueId: vagueDestId },
            orderBy: { createdAt: "desc" },
            select: { nombreInitial: true, poidsMoyenInitial: true },
          });
          await tx.assignationBac.create({
            data: {
              bacId: bacDestId,
              vagueId: vagueDestId,
              siteId,
              dateAssignation: transfertDate,
              dateFin: null,
              nombreActuel: 0,
              nombreInitial: historicAssignation?.nombreInitial ?? 0,
              poidsMoyenInitial: historicAssignation?.poidsMoyenInitial ?? 0,
            },
          });
        }
      }

      // -----------------------------------------------------------------------
      // Étape 7 — Créer l'en-tête Transfert + groupes (nested create)
      //           Prisma 7 pattern : create sans include, puis findUniqueOrThrow
      // -----------------------------------------------------------------------
      const transfertRaw = await tx.transfert.create({
        data: {
          siteId,
          userId,
          date: transfertDate,
          notes: dto.notes ?? null,
          groupes: {
            create: dto.groupes.map((g) => ({
              vagueSourceId: g.vagueSourceId,
              bacSourceId: g.bacSourceId ?? null,
              vagueDestId,
              bacDestId: g.bacDestId ?? null,
              nombrePoissons: g.nombrePoissons,
              poidsMoyenG: g.poidsMoyenG,
              nombreMorts: g.nombreMorts ?? 0,
            })),
          },
        },
      });

      const transfert = await tx.transfert.findUniqueOrThrow({
        where: { id: transfertRaw.id },
        include: transfertWithGroupesInclude,
      });

      // -----------------------------------------------------------------------
      // Étapes 8, 9, 10, 11, 12 — Effets sur bacs, vague dest, relevés, clôture
      // -----------------------------------------------------------------------

      // Recalcul pondéré accumulatif sur la vague destination
      const vagueDest = await tx.vague.findUniqueOrThrow({
        where: { id: vagueDestId },
        select: { nombreInitial: true, poidsMoyenInitial: true },
      });
      // Si la vague destination était vide, ce transfert est sa première mise en eau
      // → on synchronise dateDebut pour que J reflète la vraie durée d'élevage.
      // (Pour Mode A, la vague vient d'être créée avec dateDebut = transfertDate, donc no-op.)
      const wasDestEmpty = vagueDest.nombreInitial === 0;
      let accTotal = vagueDest.nombreInitial;
      let accAvg = vagueDest.poidsMoyenInitial;

      for (let groupeIdx = 0; groupeIdx < dto.groupes.length; groupeIdx++) {
        const groupe = dto.groupes[groupeIdx];
        const transfertGroupeId = transfert.groupes[groupeIdx]?.id ?? null;
        const vagueSourceId = groupe.vagueSourceId;
        const bacSourceId = groupe.bacSourceId ?? null;
        // bacDestId garanti non-null par la validation de l'étape 1 (throw si null/undefined)
        const bacDestId = groupe.bacDestId as string;
        const nombrePoissons = groupe.nombrePoissons;
        const nombreMorts = groupe.nombreMorts ?? 0;
        const poidsMoyenG = groupe.poidsMoyenG;

        // -------------------------------------------------------------------
        // Étape 8 — Décrémenter AssignationBac source (R4 — updateMany + borne basse)
        // -------------------------------------------------------------------
        if (bacSourceId !== null) {
          const updated = await tx.assignationBac.updateMany({
            where: {
              bacId: bacSourceId,
              vagueId: vagueSourceId,
              dateFin: null,
              nombreActuel: { gte: nombrePoissons + nombreMorts },
            },
            data: { nombreActuel: { decrement: nombrePoissons + nombreMorts } },
          });
          if (updated.count === 0) {
            throw new Error(
              `Conservation violée (concurrence détectée) sur le bac source ${bacSourceId}`
            );
          }
        } else {
          // Pas de bac source spécifié : décrémenter proportionnellement
          // sur tous les bacs actifs de la vague source
          const assignationsSources = await tx.assignationBac.findMany({
            where: { vagueId: vagueSourceId, siteId, dateFin: null },
            select: { id: true, nombreActuel: true },
            orderBy: { nombreActuel: "desc" },
          });

          let remaining = nombrePoissons + nombreMorts;
          for (const a of assignationsSources) {
            if (remaining <= 0) break;
            const decrBy = Math.min(remaining, a.nombreActuel ?? 0);
            if (decrBy > 0) {
              await tx.assignationBac.update({
                where: { id: a.id },
                data: { nombreActuel: { decrement: decrBy } },
              });
              remaining -= decrBy;
            }
          }
          if (remaining > 0) {
            throw new Error(
              `Conservation violée (concurrence détectée) sur la vague source ${vagueSourceId} : manque ${remaining} poissons`
            );
          }
        }

        // -------------------------------------------------------------------
        // Étape 9 — Incrémenter AssignationBac destination (bacDestId garanti non-null)
        // -------------------------------------------------------------------
        const assignationDest = await tx.assignationBac.findFirst({
          where: { bacId: bacDestId, vagueId: vagueDestId, dateFin: null },
          select: { id: true },
        });
        if (assignationDest) {
          await tx.assignationBac.update({
            where: { id: assignationDest.id },
            data: { nombreActuel: { increment: nombrePoissons } },
          });
        } else {
          // Créer si inexistant (défense en profondeur)
          await tx.assignationBac.create({
            data: {
              bacId: bacDestId,
              vagueId: vagueDestId,
              siteId,
              dateAssignation: transfertDate,
              dateFin: null,
              nombreActuel: nombrePoissons,
              nombreInitial: 0,
              poidsMoyenInitial: 0,
            },
          });
        }

        // -------------------------------------------------------------------
        // Étape 10 — Recalcul pondéré accumulatif vague destination
        // -------------------------------------------------------------------
        const weighted = computeWeightedAverage(
          accTotal,
          accAvg,
          nombrePoissons,
          poidsMoyenG
        );
        accTotal = weighted.newTotal;
        accAvg = weighted.newAvg;

        // -------------------------------------------------------------------
        // Étape 11 — Auto-création des relevés
        // -------------------------------------------------------------------

        // MORTALITE si nombreMorts > 0
        if (nombreMorts > 0) {
          await tx.releve.create({
            data: {
              date: transfertDate,
              typeReleve: TypeReleve.MORTALITE,
              nombreMorts,
              causeMortalite: CauseMortalite.AUTRE,
              notes: "Mortalite au transfert",
              vagueId: vagueSourceId,
              bacId: bacSourceId,
              siteId,
            },
          });
        }

        // BIOMETRIE sur la vague destination
        await tx.releve.create({
          data: {
            date: transfertDate,
            typeReleve: TypeReleve.BIOMETRIE,
            poidsMoyen: poidsMoyenG,
            notes: "Biometrie au transfert",
            vagueId: vagueDestId,
            bacId: bacDestId,
            siteId,
          },
        });

        // TRANSFERT sur la vague source (traçabilité déduction poissons sortants).
        // Le relevé existe uniquement côté PRE_GROSSISSEMENT (source), pas côté
        // GROSSISSEMENT (destination) qui reçoit le BIOMETRIE ci-dessus.
        if (bacSourceId !== null && nombrePoissons > 0) {
          await tx.releve.create({
            data: {
              date: transfertDate,
              typeReleve: TypeReleve.TRANSFERT,
              nombreTransferes: nombrePoissons,
              transfertGroupeId,
              notes: "Transfert vers grossissement",
              vagueId: vagueSourceId,
              bacId: bacSourceId,
              siteId,
            },
          });
        }

      }

      // -------------------------------------------------------------------
      // Appliquer le recalcul pondéré final sur la vague destination
      // -------------------------------------------------------------------
      await tx.vague.update({
        where: { id: vagueDestId },
        data: {
          nombreInitial: accTotal,
          poidsMoyenInitial: accAvg,
          ...(wasDestEmpty && { dateDebut: transfertDate }),
        },
      });

      // -------------------------------------------------------------------
      // Étape 12 — Clôture automatique des vagues sources vidées
      // -------------------------------------------------------------------
      for (const vagueSourceId of uniqueSourceIds) {
        const assignationsSources = await tx.assignationBac.findMany({
          where: { vagueId: vagueSourceId, siteId, dateFin: null },
          select: { nombreActuel: true },
        });
        const totalVivants = assignationsSources.reduce(
          (sum, a) => sum + (a.nombreActuel ?? 0),
          0
        );
        if (totalVivants === 0) {
          await tx.vague.update({
            where: { id: vagueSourceId },
            data: { statut: StatutVague.TERMINEE, dateFin: transfertDate },
          });
        }
      }

      return transfert as unknown as TransfertWithGroupes;
    },
    { timeout: 30000 }
  );
}

// ---------------------------------------------------------------------------
// 2. getTransfertById
// ---------------------------------------------------------------------------

/**
 * Récupère un transfert par ID avec toutes ses relations.
 *
 * Retourne null si le transfert n'existe pas ou n'appartient pas au site.
 */
export async function getTransfertById(
  siteId: string,
  transfertId: string
): Promise<TransfertWithGroupes | null> {
  const transfert = await prisma.transfert.findFirst({
    where: { id: transfertId, siteId },
    include: transfertWithGroupesInclude,
  });

  return transfert as unknown as TransfertWithGroupes | null;
}

// ---------------------------------------------------------------------------
// 3. listTransfertsForSite
// ---------------------------------------------------------------------------

/**
 * Liste les transferts d'un site avec filtres optionnels et pagination.
 *
 * Filtre optionnel `vagueId` : si `direction = "source"`, filtre sur vagueSourceId ;
 * si `direction = "destination"`, filtre sur vagueDestId.
 * Si direction non précisée, filtre sur les deux (union).
 */
export async function listTransfertsForSite(
  siteId: string,
  filters?: { vagueId?: string; direction?: "source" | "destination" },
  pagination?: { limit?: number; offset?: number }
): Promise<{ data: TransfertWithGroupes[]; total: number }> {
  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  let vagueFilter: Record<string, unknown> | undefined;
  if (filters?.vagueId) {
    if (filters.direction === "source") {
      vagueFilter = { groupes: { some: { vagueSourceId: filters.vagueId } } };
    } else if (filters.direction === "destination") {
      vagueFilter = { groupes: { some: { vagueDestId: filters.vagueId } } };
    } else {
      vagueFilter = {
        groupes: {
          some: {
            OR: [
              { vagueSourceId: filters.vagueId },
              { vagueDestId: filters.vagueId },
            ],
          },
        },
      };
    }
  }

  const where = { siteId, ...vagueFilter };

  const [data, total] = await Promise.all([
    prisma.transfert.findMany({
      where,
      include: transfertWithGroupesInclude,
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.transfert.count({ where }),
  ]);

  return { data: data as unknown as TransfertWithGroupes[], total };
}

// ---------------------------------------------------------------------------
// 4. listTransfertsForVague
// ---------------------------------------------------------------------------

/**
 * Liste les TransfertGroupe d'une vague, filtrés par direction.
 *
 * Sécurité multi-tenant : filtre sur transfert.siteId (pas de fuite cross-site).
 */
export async function listTransfertsForVague(
  siteId: string,
  vagueId: string,
  direction: "source" | "destination"
): Promise<TransfertGroupeWithRelations[]> {
  const where =
    direction === "source"
      ? { vagueSourceId: vagueId, transfert: { siteId } }
      : { vagueDestId: vagueId, transfert: { siteId } };

  const groupes = await prisma.transfertGroupe.findMany({
    where,
    include: {
      vagueSource: { select: { id: true, code: true, type: true } },
      vagueDest: { select: { id: true, code: true, type: true } },
      bacSource: { select: { id: true, nom: true } },
      bacDest: { select: { id: true, nom: true } },
      modifications: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return groupes as unknown as TransfertGroupeWithRelations[];
}

// ---------------------------------------------------------------------------
// 5. updateTransfertGroupe
// ---------------------------------------------------------------------------

/**
 * Modifie un TransfertGroupe avec traçabilité obligatoire.
 *
 * Transaction atomique :
 *  1. Fetch groupe + vérification siteId
 *  2. Vérification statut vague source EN_COURS
 *  3. Snapshot avant modification
 *  4. Annulation des effets précédents (incrémenter source, décrémenter dest, annuler recalcul)
 *  5. Validation conservation avec nouvelles valeurs
 *  6. Application des nouvelles valeurs (décrémenter source, incrémenter dest, recalculer)
 *  7. Création TransfertModification
 *  8. Update TransfertGroupe + retour avec relations
 */
export async function updateTransfertGroupe(
  siteId: string,
  userId: string,
  groupeId: string,
  dto: UpdateTransfertGroupeDTO
): Promise<TransfertGroupeWithRelations> {
  if (!dto.raison || dto.raison.trim().length === 0) {
    throw new Error("La raison de la modification est obligatoire");
  }
  if (dto.bacDestId !== undefined && !dto.bacDestId) {
    throw new Error("Le bac destination est obligatoire et ne peut pas être null ou vide.");
  }

  return prisma.$transaction(
    async (tx) => {
      // -----------------------------------------------------------------------
      // Étape 1 — Fetch groupe + relations + vérification siteId
      // -----------------------------------------------------------------------
      const groupe = await tx.transfertGroupe.findFirst({
        where: { id: groupeId },
        include: {
          transfert: { select: { id: true, siteId: true } },
          vagueSource: { select: { id: true, code: true, statut: true } },
          vagueDest: {
            select: {
              id: true,
              code: true,
              nombreInitial: true,
              poidsMoyenInitial: true,
            },
          },
        },
      });

      if (!groupe) {
        throw new Error("TransfertGroupe introuvable");
      }
      if (groupe.transfert.siteId !== siteId) {
        throw new Error("Accès refusé : ce groupe n'appartient pas à ce site");
      }

      // -----------------------------------------------------------------------
      // Étape 2 — Vérification statut vague source EN_COURS
      // -----------------------------------------------------------------------
      if (groupe.vagueSource.statut !== StatutVague.EN_COURS) {
        throw new Error(
          `Modification impossible : la vague source ${groupe.vagueSource.code} n'est pas EN_COURS`
        );
      }

      // -----------------------------------------------------------------------
      // Étape 3 — Snapshot avant modification
      // -----------------------------------------------------------------------
      const snapshotAvant = {
        nombrePoissons: groupe.nombrePoissons,
        poidsMoyenG: groupe.poidsMoyenG,
        nombreMorts: groupe.nombreMorts,
        bacSourceId: groupe.bacSourceId,
        bacDestId: groupe.bacDestId,
      };

      const ancienNombrePoissons = groupe.nombrePoissons;
      const ancienNombreMorts = groupe.nombreMorts;
      const ancienPoidsMoyenG = groupe.poidsMoyenG;
      const ancienBacSourceId = groupe.bacSourceId;
      const ancienBacDestId = groupe.bacDestId;

      const nouveauNombrePoissons = dto.nombrePoissons ?? ancienNombrePoissons;
      const nouveauNombreMorts = dto.nombreMorts ?? ancienNombreMorts;
      const nouveauPoidsMoyenG = dto.poidsMoyenG ?? ancienPoidsMoyenG;
      const nouveauBacSourceId =
        dto.bacSourceId !== undefined ? dto.bacSourceId : ancienBacSourceId;
      const nouveauBacDestId =
        dto.bacDestId !== undefined ? dto.bacDestId : ancienBacDestId;

      // -----------------------------------------------------------------------
      // Étape 4 — Annulation des effets précédents
      // -----------------------------------------------------------------------

      // 4a. Remettre les poissons sur le bac source (incrémenter de l'ancienne valeur)
      if (ancienBacSourceId !== null) {
        await tx.assignationBac.updateMany({
          where: {
            bacId: ancienBacSourceId,
            vagueId: groupe.vagueSource.id,
            dateFin: null,
          },
          data: {
            nombreActuel: {
              increment: ancienNombrePoissons + ancienNombreMorts,
            },
          },
        });
      } else {
        // Pas de bac source spécifié : remettre sur le premier bac disponible
        const assignationsSource = await tx.assignationBac.findMany({
          where: {
            vagueId: groupe.vagueSource.id,
            siteId,
            dateFin: null,
          },
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: 1,
        });
        if (assignationsSource.length > 0) {
          await tx.assignationBac.update({
            where: { id: assignationsSource[0].id },
            data: {
              nombreActuel: {
                increment: ancienNombrePoissons + ancienNombreMorts,
              },
            },
          });
        }
      }

      // 4b. Décrémenter le bac destination de l'ancienne valeur
      if (ancienBacDestId !== null) {
        const undoDest = await tx.assignationBac.updateMany({
          where: {
            bacId: ancienBacDestId,
            vagueId: groupe.vagueDest.id,
            dateFin: null,
            nombreActuel: { gte: ancienNombrePoissons }, // borne basse R4
          },
          data: { nombreActuel: { decrement: ancienNombrePoissons } },
        });
        if (undoDest.count === 0) {
          throw new Error(
            "Annulation impossible : état AssignationBac destination incohérent"
          );
        }
      }

      // 4c. Annuler le recalcul pondéré sur la vague destination
      const totalAvant = groupe.vagueDest.nombreInitial;
      const avgAvant = groupe.vagueDest.poidsMoyenInitial;
      const totalApresAnnulation = totalAvant - ancienNombrePoissons;

      let avgApresAnnulation = 0;
      if (totalApresAnnulation > 0 && totalAvant > 0) {
        avgApresAnnulation =
          (totalAvant * avgAvant - ancienNombrePoissons * ancienPoidsMoyenG) /
          totalApresAnnulation;
      }

      await tx.vague.update({
        where: { id: groupe.vagueDest.id },
        data: {
          nombreInitial: Math.max(0, totalApresAnnulation),
          poidsMoyenInitial: Math.max(0, avgApresAnnulation),
        },
      });

      // -----------------------------------------------------------------------
      // Étape 5 — Validation conservation avec nouvelles valeurs
      // -----------------------------------------------------------------------
      const assignationsSources = await tx.assignationBac.findMany({
        where: { vagueId: groupe.vagueSource.id, siteId, dateFin: null },
        select: { bacId: true, nombreInitial: true, nombreActuel: true },
      });
      const bacsForCalc = assignationsSources.map((a) => ({
        id: a.bacId,
        nombreInitial: a.nombreInitial ?? null,
      }));
      const relevesForCalc = await tx.releve.findMany({
        where: {
          siteId,
          vagueId: groupe.vagueSource.id,
          // Tous les types qui affectent les vivants (sinon calcul faux — voir computeVivantsByBac)
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
        select: {
          bacId: true,
          typeReleve: true,
          nombreMorts: true,
          nombreVendus: true,
          nombreTransferes: true,
          nombreCompte: true,
          date: true,
        },
      });

      const vagueSourceFull = await tx.vague.findFirst({
        where: { id: groupe.vagueSource.id },
        select: { nombreInitial: true },
      });
      const vivantsParBac = computeVivantsByBac(
        bacsForCalc,
        relevesForCalc,
        vagueSourceFull?.nombreInitial ?? 0
      );

      if (nouveauBacSourceId !== null) {
        const assignation = assignationsSources.find(
          (a) => a.bacId === nouveauBacSourceId
        );
        const vivants =
          vivantsParBac.get(nouveauBacSourceId) ??
          assignation?.nombreActuel ??
          0;
        if (nouveauNombrePoissons + nouveauNombreMorts > vivants) {
          throw new Error(
            `Conservation violée pour le nouveau bac source ${nouveauBacSourceId} : ` +
              `tentative de ${nouveauNombrePoissons + nouveauNombreMorts} mais seulement ${vivants} disponibles`
          );
        }
      } else {
        const totalVivants = Array.from(vivantsParBac.values()).reduce(
          (sum, v) => sum + v,
          0
        );
        const totalAssignation = assignationsSources.reduce(
          (sum, a) => sum + (a.nombreActuel ?? 0),
          0
        );
        const vivantsEffectifs =
          vivantsParBac.size > 0 ? totalVivants : totalAssignation;
        if (nouveauNombrePoissons + nouveauNombreMorts > vivantsEffectifs) {
          throw new Error(
            `Conservation violée : tentative de transférer ${nouveauNombrePoissons + nouveauNombreMorts} poissons ` +
              `mais seulement ${vivantsEffectifs} disponibles dans la vague source`
          );
        }
      }

      // -----------------------------------------------------------------------
      // Étape 6 — Application des nouvelles valeurs
      // -----------------------------------------------------------------------

      // 6a. Décrémenter bac source (R4 — updateMany avec borne basse)
      if (nouveauBacSourceId !== null) {
        const updated = await tx.assignationBac.updateMany({
          where: {
            bacId: nouveauBacSourceId,
            vagueId: groupe.vagueSource.id,
            dateFin: null,
            nombreActuel: {
              gte: nouveauNombrePoissons + nouveauNombreMorts,
            },
          },
          data: {
            nombreActuel: {
              decrement: nouveauNombrePoissons + nouveauNombreMorts,
            },
          },
        });
        if (updated.count === 0) {
          throw new Error(
            `Conservation violée (concurrence) sur le bac source ${nouveauBacSourceId}`
          );
        }
      } else {
        // Décrémenter proportionnellement
        const assignationsSourcesNow = await tx.assignationBac.findMany({
          where: { vagueId: groupe.vagueSource.id, siteId, dateFin: null },
          select: { id: true, nombreActuel: true },
          orderBy: { nombreActuel: "desc" },
        });
        let remaining = nouveauNombrePoissons + nouveauNombreMorts;
        for (const a of assignationsSourcesNow) {
          if (remaining <= 0) break;
          const decrBy = Math.min(remaining, a.nombreActuel ?? 0);
          if (decrBy > 0) {
            await tx.assignationBac.update({
              where: { id: a.id },
              data: { nombreActuel: { decrement: decrBy } },
            });
            remaining -= decrBy;
          }
        }
        if (remaining > 0) {
          throw new Error(
            `Conservation violée (concurrence) sur la vague source : manque ${remaining} poissons`
          );
        }
      }

      // 6b. Incrémenter bac destination
      if (nouveauBacDestId !== null) {
        const assignationDestNow = await tx.assignationBac.findFirst({
          where: {
            bacId: nouveauBacDestId,
            vagueId: groupe.vagueDest.id,
            dateFin: null,
          },
          select: { id: true },
        });
        if (assignationDestNow) {
          await tx.assignationBac.update({
            where: { id: assignationDestNow.id },
            data: { nombreActuel: { increment: nouveauNombrePoissons } },
          });
        } else {
          await tx.assignationBac.create({
            data: {
              bacId: nouveauBacDestId,
              vagueId: groupe.vagueDest.id,
              siteId,
              dateAssignation: new Date(),
              dateFin: null,
              nombreActuel: nouveauNombrePoissons,
              nombreInitial: 0,
              poidsMoyenInitial: 0,
            },
          });
        }
      }

      // 6c. Recalcul pondéré vague destination avec nouvelles valeurs
      const vagueDest = await tx.vague.findUniqueOrThrow({
        where: { id: groupe.vagueDest.id },
        select: { nombreInitial: true, poidsMoyenInitial: true },
      });
      const weightedNew = computeWeightedAverage(
        vagueDest.nombreInitial,
        vagueDest.poidsMoyenInitial,
        nouveauNombrePoissons,
        nouveauPoidsMoyenG
      );
      await tx.vague.update({
        where: { id: groupe.vagueDest.id },
        data: {
          nombreInitial: weightedNew.newTotal,
          poidsMoyenInitial: weightedNew.newAvg,
        },
      });

      // -----------------------------------------------------------------------
      // Étape 7 — Créer TransfertModification
      // -----------------------------------------------------------------------
      const snapshotApres = {
        nombrePoissons: nouveauNombrePoissons,
        poidsMoyenG: nouveauPoidsMoyenG,
        nombreMorts: nouveauNombreMorts,
        bacSourceId: nouveauBacSourceId,
        bacDestId: nouveauBacDestId,
      };

      await tx.transfertModification.create({
        data: {
          transfertGroupeId: groupeId,
          userId,
          raison: dto.raison,
          snapshotAvant: snapshotAvant as object,
          snapshotApres: snapshotApres as object,
          siteId,
        },
      });

      // -----------------------------------------------------------------------
      // Étape 8 — Update TransfertGroupe
      // -----------------------------------------------------------------------
      await tx.transfertGroupe.update({
        where: { id: groupeId },
        data: {
          nombrePoissons: nouveauNombrePoissons,
          poidsMoyenG: nouveauPoidsMoyenG,
          nombreMorts: nouveauNombreMorts,
          bacSourceId: nouveauBacSourceId,
          bacDestId: nouveauBacDestId,
          snapshotAvantModif: snapshotAvant as object,
        },
      });

      // Retourner avec relations — Prisma 7 pattern
      const updated = await tx.transfertGroupe.findUniqueOrThrow({
        where: { id: groupeId },
        include: {
          vagueSource: { select: { id: true, code: true, type: true } },
          vagueDest: { select: { id: true, code: true, type: true } },
          bacSource: { select: { id: true, nom: true } },
          bacDest: { select: { id: true, nom: true } },
          modifications: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      });

      return updated as unknown as TransfertGroupeWithRelations;
    },
    { timeout: 30000 }
  );
}

// ---------------------------------------------------------------------------
// 6. getLineage
// ---------------------------------------------------------------------------

/**
 * Retourne l'arbre généalogique d'une vague (parents récursifs via TransfertGroupe).
 *
 * Limite à maxDepth niveaux (défaut 5). Lecture seule, hors transaction.
 * Si depth >= maxDepth, retourne les parents sans descendre (accepte profondeur limitée).
 */
export async function getLineage(
  siteId: string,
  vagueId: string,
  maxDepth = 5
): Promise<VagueLineage> {
  async function fetchParents(
    currentVagueId: string,
    depth: number
  ): Promise<VagueLineage["parents"]> {
    if (depth >= maxDepth) {
      return [];
    }

    const groupes = await prisma.transfertGroupe.findMany({
      where: {
        vagueDestId: currentVagueId,
        transfert: { siteId },
      },
      include: {
        vagueSource: { select: { id: true, code: true } },
        transfert: { select: { date: true } },
      },
    });

    const parents: VagueLineage["parents"] = groupes.map((g) => ({
      transfertGroupeId: g.id,
      vagueSourceId: g.vagueSourceId,
      vagueSourceCode: g.vagueSource.code,
      dateTransfert: g.transfert.date.toISOString(),
      nombrePoissons: g.nombrePoissons,
      poidsMoyenG: g.poidsMoyenG,
      nombreMorts: g.nombreMorts,
    }));

    // Récursion sur les parents de chaque parent
    const parentsWithAncestors: VagueLineage["parents"] = [];
    for (const parent of parents) {
      parentsWithAncestors.push(parent);
      const grandParents = await fetchParents(parent.vagueSourceId, depth + 1);
      parentsWithAncestors.push(...grandParents);
    }

    return parentsWithAncestors;
  }

  const parents = await fetchParents(vagueId, 0);
  return { vagueId, parents };
}

// ---------------------------------------------------------------------------
// 7. canDeleteVague
// ---------------------------------------------------------------------------

/**
 * Vérifie si une vague peut être supprimée sans violer les contraintes de transfert.
 *
 * Retourne { canDelete: true } si aucun TransfertGroupe ne référence la vague.
 * Retourne { canDelete: false, reason: string } si la suppression est bloquée.
 */
export async function canDeleteVague(
  siteId: string,
  vagueId: string
): Promise<{ canDelete: boolean; reason?: string }> {
  const [asSource, asDest] = await Promise.all([
    prisma.transfertGroupe.count({
      where: { vagueSourceId: vagueId, transfert: { siteId } },
    }),
    prisma.transfertGroupe.count({
      where: { vagueDestId: vagueId, transfert: { siteId } },
    }),
  ]);

  if (asSource > 0) {
    return {
      canDelete: false,
      reason: `Vague source de ${asSource} transfert(s) — suppression bloquée`,
    };
  }
  if (asDest > 0) {
    return {
      canDelete: false,
      reason: `Vague destination de ${asDest} transfert(s) — suppression bloquée`,
    };
  }
  return { canDelete: true };
}
