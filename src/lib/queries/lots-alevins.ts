import { prisma } from "@/lib/db";
import { StatutLotAlevins, StatutVague, PhaseLot, DestinationLot } from "@/types";
import type {
  CreateLotAlevinsDTO,
  UpdateLotAlevinsDTO,
  LotAlevinsFilters,
  TransfertLotDTO,
  SplitLotDTO,
  ChangePhaseLotDTO,
  SortieLotDTO,
} from "@/types";

export type {
  CreateLotAlevinsDTO,
  UpdateLotAlevinsDTO,
  LotAlevinsFilters,
  TransfertLotDTO,
  SplitLotDTO,
  ChangePhaseLotDTO,
  SortieLotDTO,
};

/** Liste les lots d'alevins d'un site avec filtres optionnels et pagination */
export async function getLotsAlevins(
  siteId: string,
  filters?: LotAlevinsFilters,
  pagination?: { limit: number; offset: number }
) {
  const where: Record<string, unknown> = { siteId };

  if (filters?.statut) where.statut = filters.statut;
  if (filters?.ponteId) where.ponteId = filters.ponteId;
  if (filters?.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { notes: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const limit = Math.min(pagination?.limit ?? 50, 200);
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.lotAlevins.findMany({
      where,
      include: {
        ponte: { select: { id: true, code: true } },
        bac: { select: { id: true, nom: true } },
        vagueDestination: { select: { id: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.lotAlevins.count({ where }),
  ]);

  return { data, total };
}

/** Recupere un lot d'alevins par ID (verifie siteId), detail complet */
export async function getLotAlevinsById(id: string, siteId: string) {
  return prisma.lotAlevins.findFirst({
    where: { id, siteId },
    include: {
      ponte: {
        include: {
          femelle: { select: { id: true, code: true, sexe: true } },
          male: { select: { id: true, code: true, sexe: true } },
        },
      },
      bac: true,
      vagueDestination: {
        include: {
          bacs: { select: { id: true, nom: true } },
        },
      },
    },
  });
}

/** Cree un lot d'alevins */
export async function createLotAlevins(
  siteId: string,
  data: CreateLotAlevinsDTO
) {
  // Verifier unicite du code
  const existing = await prisma.lotAlevins.findUnique({
    where: { code: data.code },
  });
  if (existing) {
    throw new Error(`Le code "${data.code}" est deja utilise`);
  }

  // Verifier que la ponte existe et appartient au site
  const ponte = await prisma.ponte.findFirst({
    where: { id: data.ponteId, siteId },
  });
  if (!ponte) {
    throw new Error("Ponte introuvable");
  }

  // Verifier le bac si fourni
  if (data.bacId) {
    const bac = await prisma.bac.findFirst({
      where: { id: data.bacId, siteId },
    });
    if (!bac) {
      throw new Error("Bac introuvable");
    }
  }

  // nombreActuel par defaut = nombreInitial si non fourni
  const nombreActuel =
    data.nombreActuel !== undefined ? data.nombreActuel : data.nombreInitial;

  return prisma.lotAlevins.create({
    data: {
      code: data.code,
      ponteId: data.ponteId,
      nombreInitial: data.nombreInitial,
      nombreActuel,
      ageJours: data.ageJours ?? 0,
      poidsMoyen: data.poidsMoyen ?? null,
      bacId: data.bacId ?? null,
      notes: data.notes ?? null,
      siteId,
    },
    include: {
      ponte: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
    },
  });
}

/** Met a jour un lot d'alevins */
export async function updateLotAlevins(
  id: string,
  siteId: string,
  data: UpdateLotAlevinsDTO
) {
  // Verifier unicite du code si modifie
  if (data.code !== undefined) {
    const existing = await prisma.lotAlevins.findFirst({
      where: { code: data.code, NOT: { id } },
    });
    if (existing) {
      throw new Error(`Le code "${data.code}" est deja utilise`);
    }
  }

  // Verifier le bac si modifie
  if (data.bacId) {
    const bac = await prisma.bac.findFirst({
      where: { id: data.bacId, siteId },
    });
    if (!bac) {
      throw new Error("Bac introuvable");
    }
  }

  const result = await prisma.lotAlevins.updateMany({
    where: { id, siteId },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.nombreActuel !== undefined && {
        nombreActuel: data.nombreActuel,
      }),
      ...(data.ageJours !== undefined && { ageJours: data.ageJours }),
      ...(data.poidsMoyen !== undefined && {
        poidsMoyen: data.poidsMoyen ?? null,
      }),
      ...(data.statut !== undefined && { statut: data.statut }),
      ...(data.bacId !== undefined && { bacId: data.bacId }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  if (result.count === 0) {
    throw new Error("Lot d'alevins introuvable");
  }

  return prisma.lotAlevins.findFirst({
    where: { id, siteId },
    include: {
      ponte: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      vagueDestination: { select: { id: true, code: true } },
    },
  });
}

/**
 * Transfere un lot d'alevins vers une nouvelle vague.
 *
 * Transaction atomique :
 * 1. Verifier que le lot existe et est en statut EN_ELEVAGE
 * 2. Creer une nouvelle Vague (nom, nombreInitial = lot.nombreActuel, statut EN_COURS, siteId)
 * 3. Assigner les bacs a la vague (update Bac.vagueId)
 * 4. Mettre a jour le lot : statut = TRANSFERE, vagueDestinationId = nouvelle vague, dateTransfert = now()
 * 5. Retourner le lot mis a jour avec la vague creee
 */
export async function transfererLotVersVague(
  siteId: string,
  lotId: string,
  vagueData: TransfertLotDTO
) {
  return prisma.$transaction(async (tx) => {
    // 1. Verifier que le lot existe, appartient au site et est en statut EN_ELEVAGE
    const lot = await tx.lotAlevins.findFirst({
      where: { id: lotId, siteId },
    });

    if (!lot) {
      throw new Error("Lot d'alevins introuvable");
    }

    if (lot.statut !== StatutLotAlevins.EN_ELEVAGE) {
      throw new Error(
        "Lot non transferable : le statut doit etre EN_ELEVAGE"
      );
    }

    // 2. Verifier que les bacs existent, appartiennent au site et sont libres
    if (!vagueData.bacIds || vagueData.bacIds.length === 0) {
      throw new Error("Au moins un bac doit etre assigne a la nouvelle vague");
    }

    const bacs = await tx.bac.findMany({
      where: { id: { in: vagueData.bacIds }, siteId },
    });

    if (bacs.length !== vagueData.bacIds.length) {
      throw new Error("Un ou plusieurs bacs sont introuvables");
    }

    const bacsOccupes = bacs.filter((b) => b.vagueId !== null);
    if (bacsOccupes.length > 0) {
      const noms = bacsOccupes.map((b) => b.nom).join(", ");
      throw new Error(`Bacs deja assignes a une vague : ${noms}`);
    }

    // Generer un code unique pour la vague (format : VAGUE-YYYY-XXX)
    const annee = new Date().getFullYear();
    const count = await tx.vague.count({
      where: { siteId, code: { startsWith: `VAGUE-${annee}-` } },
    });
    const code = `VAGUE-${annee}-${String(count + 1).padStart(3, "0")}`;

    // 3. Creer la nouvelle vague
    const nouvelleVague = await tx.vague.create({
      data: {
        code,
        dateDebut: new Date(),
        nombreInitial: lot.nombreActuel,
        poidsMoyenInitial: lot.poidsMoyen ?? 0,
        origineAlevins: `Lot alevins ${lot.code}`,
        statut: StatutVague.EN_COURS,
        siteId,
      },
    });

    // 4. Assigner les bacs a la vague (backward compat: écrire sur Bac)
    await tx.bac.updateMany({
      where: { id: { in: vagueData.bacIds }, siteId },
      data: { vagueId: nouvelleVague.id },
    });

    // ADR-043 Phase 2: créer les AssignationBac correspondantes
    for (const bacId of vagueData.bacIds) {
      await tx.assignationBac.create({
        data: {
          bacId,
          vagueId: nouvelleVague.id,
          siteId,
          dateAssignation: new Date(),
          dateFin: null,
          nombrePoissonsInitial: null, // pas de distribution par bac dans ce flux
          poidsMoyenInitial: lot.poidsMoyen ?? null,
          nombrePoissons: null,
        },
      });
    }

    // 5. Mettre a jour le lot : statut TRANSFERE, vagueDestinationId, dateTransfert
    const lotMisAJour = await tx.lotAlevins.update({
      where: { id: lotId },
      data: {
        statut: StatutLotAlevins.TRANSFERE,
        vagueDestinationId: nouvelleVague.id,
        dateTransfert: new Date(),
      },
      include: {
        ponte: { select: { id: true, code: true } },
        bac: { select: { id: true, nom: true } },
        vagueDestination: {
          include: {
            bacs: { select: { id: true, nom: true } },
          },
        },
      },
    });

    return lotMisAJour;
  });
}

// ---------------------------------------------------------------------------
// Fonctions etendues R3-S4 — list etendu, detail, crud, phases, fractionnement, sortie
// ---------------------------------------------------------------------------

/**
 * Liste les lots d'alevins avec filtres etendus (phase, statut, ponteId, bacId)
 * et pagination.
 *
 * R8 : filtre siteId systematique.
 */
export async function listLots(
  siteId: string,
  params: {
    phase?: string;
    statut?: string;
    ponteId?: string;
    bacId?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const where: Record<string, unknown> = { siteId };

  if (params.statut) where.statut = params.statut;
  if (params.phase) where.phase = params.phase;
  if (params.ponteId) where.ponteId = params.ponteId;
  if (params.bacId) where.bacId = params.bacId;

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.lotAlevins.findMany({
      where,
      include: {
        ponte: { select: { id: true, code: true } },
        bac: { select: { id: true, nom: true } },
        vagueDestination: { select: { id: true, code: true } },
        _count: { select: { sousLots: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.lotAlevins.count({ where }),
  ]);

  return { data, total };
}

/**
 * Recupere un lot d'alevins par ID avec toutes ses relations chargees.
 *
 * Relations incluses : ponte, bac, vagueDestination, incubation,
 * parentLot, sousLots, releves (10 plus recents).
 *
 * R8 : verifie siteId.
 */
export async function getLotById(id: string, siteId: string) {
  return prisma.lotAlevins.findFirst({
    where: { id, siteId },
    include: {
      ponte: {
        include: {
          femelle: { select: { id: true, code: true, sexe: true } },
          male: { select: { id: true, code: true, sexe: true } },
        },
      },
      bac: true,
      vagueDestination: {
        include: {
          bacs: { select: { id: true, nom: true } },
        },
      },
      incubation: {
        select: {
          id: true,
          code: true,
          statut: true,
          dateDebutIncubation: true,
          dateEclosionReelle: true,
          nombreLarvesViables: true,
        },
      },
      parentLot: {
        select: {
          id: true,
          code: true,
          phase: true,
          nombreActuel: true,
          statut: true,
        },
      },
      sousLots: {
        select: {
          id: true,
          code: true,
          phase: true,
          nombreActuel: true,
          nombreInitial: true,
          statut: true,
          bacId: true,
          bac: { select: { id: true, nom: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      releves: {
        orderBy: { date: "desc" },
        take: 10,
        select: {
          id: true,
          date: true,
          typeReleve: true,
          notes: true,
        },
      },
    },
  });
}

/**
 * Cree un lot d'alevins manuellement.
 *
 * Valide l'unicite du code, l'existence de la ponte et du bac si fourni.
 * R2 : statut et phase utilises via les enums.
 * R8 : siteId obligatoire.
 */
export async function createLot(siteId: string, dto: CreateLotAlevinsDTO) {
  // Verifier l'unicite du code
  const existing = await prisma.lotAlevins.findUnique({
    where: { code: dto.code },
  });
  if (existing) {
    throw new Error(`Le code "${dto.code}" est deja utilise`);
  }

  // Verifier que la ponte existe et appartient au site
  const ponte = await prisma.ponte.findFirst({
    where: { id: dto.ponteId, siteId },
  });
  if (!ponte) {
    throw new Error("Ponte introuvable");
  }

  // Verifier le bac si fourni
  if (dto.bacId) {
    const bac = await prisma.bac.findFirst({
      where: { id: dto.bacId, siteId },
    });
    if (!bac) {
      throw new Error("Bac introuvable");
    }
  }

  // Verifier l'incubation si fournie
  if (dto.incubationId) {
    const incubation = await prisma.incubation.findFirst({
      where: { id: dto.incubationId, siteId },
    });
    if (!incubation) {
      throw new Error("Incubation introuvable");
    }
  }

  const nombreActuel =
    dto.nombreActuel !== undefined ? dto.nombreActuel : dto.nombreInitial;

  return prisma.lotAlevins.create({
    data: {
      code: dto.code,
      ponteId: dto.ponteId,
      nombreInitial: dto.nombreInitial,
      nombreActuel,
      ageJours: dto.ageJours ?? 0,
      poidsMoyen: dto.poidsMoyen ?? null,
      statut: dto.statut ?? StatutLotAlevins.EN_INCUBATION,
      bacId: dto.bacId ?? null,
      notes: dto.notes ?? null,
      phase: dto.phase ?? PhaseLot.INCUBATION,
      incubationId: dto.incubationId ?? null,
      dateDebutPhase: dto.dateDebutPhase
        ? new Date(dto.dateDebutPhase)
        : new Date(),
      poidsObjectifG: dto.poidsObjectifG ?? null,
      siteId,
    },
    include: {
      ponte: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
    },
  });
}

/**
 * Met a jour un lot d'alevins (modification partielle).
 *
 * R4 : utilise updateMany avec siteId pour l'isolation multi-tenant.
 * Lance une erreur si le lot est introuvable.
 */
export async function updateLot(
  id: string,
  siteId: string,
  data: UpdateLotAlevinsDTO
) {
  // Verifier l'unicite du code si modifie
  if (data.code !== undefined) {
    const conflict = await prisma.lotAlevins.findFirst({
      where: { code: data.code, NOT: { id } },
      select: { id: true },
    });
    if (conflict) {
      throw new Error(`Le code "${data.code}" est deja utilise`);
    }
  }

  // Verifier le bac si modifie
  if (data.bacId) {
    const bac = await prisma.bac.findFirst({
      where: { id: data.bacId, siteId },
    });
    if (!bac) {
      throw new Error("Bac introuvable");
    }
  }

  const result = await prisma.lotAlevins.updateMany({
    where: { id, siteId },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.nombreActuel !== undefined && {
        nombreActuel: data.nombreActuel,
      }),
      ...(data.ageJours !== undefined && { ageJours: data.ageJours }),
      ...(data.poidsMoyen !== undefined && {
        poidsMoyen: data.poidsMoyen ?? null,
      }),
      ...(data.statut !== undefined && { statut: data.statut }),
      ...(data.bacId !== undefined && { bacId: data.bacId }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
      ...(data.nombreDeformesRetires !== undefined && {
        nombreDeformesRetires: data.nombreDeformesRetires,
      }),
      ...(data.poidsObjectifG !== undefined && {
        poidsObjectifG: data.poidsObjectifG ?? null,
      }),
    },
  });

  if (result.count === 0) {
    throw new Error("Lot d'alevins introuvable");
  }

  return prisma.lotAlevins.findFirst({
    where: { id, siteId },
    include: {
      ponte: { select: { id: true, code: true } },
      bac: { select: { id: true, nom: true } },
      vagueDestination: { select: { id: true, code: true } },
    },
  });
}

/**
 * Change la phase de developpement d'un lot d'alevins.
 *
 * R4 : utilise updateMany avec siteId.
 * R2 : PhaseLot importe depuis @/types.
 * Lance une erreur si le lot est introuvable.
 */
export async function changeLotPhase(
  id: string,
  siteId: string,
  data: ChangePhaseLotDTO
) {
  // Verifier le bac si fourni
  if (data.bacId) {
    const bac = await prisma.bac.findFirst({
      where: { id: data.bacId, siteId },
    });
    if (!bac) {
      throw new Error("Bac introuvable");
    }
  }

  const result = await prisma.lotAlevins.updateMany({
    where: { id, siteId },
    data: {
      phase: data.phase,
      dateDebutPhase: data.dateDebutPhase
        ? new Date(data.dateDebutPhase)
        : new Date(),
      ...(data.bacId !== undefined && { bacId: data.bacId }),
    },
  });

  if (result.count === 0) {
    throw new Error("Lot d'alevins introuvable");
  }
}

/**
 * Fractionne un lot d'alevins en plusieurs sous-lots.
 *
 * Transaction atomique R4 :
 * 1. Valider que la somme des sous-lots <= parent.nombreActuel
 * 2. Creer chaque sous-lot avec codes auto-generes (parent-code + "-A", "-B", ...)
 * 3. Decrementer parent.nombreActuel de la somme totale
 * 4. Chaque sous-lot herite : ponteId, phase, incubationId du parent
 *
 * R2 : enums importes depuis @/types.
 * R4 : $transaction obligatoire.
 * R8 : siteId verifie.
 */
export async function splitLot(
  id: string,
  siteId: string,
  dto: SplitLotDTO
) {
  return prisma.$transaction(async (tx) => {
    // 1. Charger le lot parent et verifier qu'il appartient au site
    const parent = await tx.lotAlevins.findFirst({
      where: { id, siteId },
    });

    if (!parent) {
      throw new Error("Lot d'alevins introuvable");
    }

    // Validation : somme des sous-lots <= parent.nombreActuel
    const totalSousLots = dto.sousLots.reduce(
      (acc, sl) => acc + sl.nombrePoissons,
      0
    );
    if (totalSousLots > parent.nombreActuel) {
      throw new Error(
        `Impossible de fractionner : la somme des sous-lots (${totalSousLots}) ` +
          `depasse l'effectif actuel du lot parent (${parent.nombreActuel})`
      );
    }

    if (dto.sousLots.length === 0) {
      throw new Error("Au moins un sous-lot est requis pour le fractionnement");
    }

    // 2. Verifier tous les bacs si fournis
    const bacIds = dto.sousLots.flatMap((sl) => (sl.bacId ? [sl.bacId] : []));
    if (bacIds.length > 0) {
      const bacs = await tx.bac.findMany({
        where: { id: { in: bacIds }, siteId },
        select: { id: true },
      });
      if (bacs.length !== new Set(bacIds).size) {
        throw new Error("Un ou plusieurs bacs des sous-lots sont introuvables");
      }
    }

    // Determiner les lettres suffixes pour les codes auto-generes
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    // 3. Creer les sous-lots
    const sousLotsCreated = [];
    for (let i = 0; i < dto.sousLots.length; i++) {
      const sl = dto.sousLots[i];
      // Code : fourni explicitement ou auto-genere
      const suffix = alphabet[i] ?? String(i + 1);
      const code = sl.code ?? `${parent.code}-${suffix}`;

      // Verifier l'unicite du code
      const codeConflict = await tx.lotAlevins.findUnique({
        where: { code },
        select: { id: true },
      });
      if (codeConflict) {
        throw new Error(
          `Le code "${code}" est deja utilise pour un sous-lot`
        );
      }

      const sousLot = await tx.lotAlevins.create({
        data: {
          code,
          ponteId: parent.ponteId,
          nombreInitial: sl.nombrePoissons,
          nombreActuel: sl.nombrePoissons,
          ageJours: parent.ageJours,
          poidsMoyen: parent.poidsMoyen,
          statut: parent.statut,
          bacId: sl.bacId ?? null,
          notes: sl.notes ?? null,
          phase: parent.phase,
          incubationId: parent.incubationId ?? null,
          parentLotId: parent.id,
          dateDebutPhase: parent.dateDebutPhase,
          nombreDeformesRetires: 0,
          poidsObjectifG: parent.poidsObjectifG ?? null,
          siteId,
        },
      });
      sousLotsCreated.push(sousLot);
    }

    // 4. Decrementer parent.nombreActuel
    await tx.lotAlevins.update({
      where: { id: parent.id },
      data: {
        nombreActuel: { decrement: totalSousLots },
      },
    });

    return sousLotsCreated;
  });
}

/**
 * Enregistre la sortie d'un lot d'alevins.
 *
 * Selon la destination :
 * - TRANSFERT_GROSSISSEMENT : statut → TRANSFERE, vagueDestinationId renseigne
 * - Autres : statut → TRANSFERE (sortie generique)
 *
 * R4 : updateMany avec siteId.
 * R2 : DestinationLot importe depuis @/types.
 * R8 : siteId verifie.
 */
export async function sortirLot(
  id: string,
  siteId: string,
  data: SortieLotDTO
) {
  // Verifier la vague destination si fournie
  if (data.vagueDestinationId) {
    const vague = await prisma.vague.findFirst({
      where: { id: data.vagueDestinationId, siteId },
    });
    if (!vague) {
      throw new Error("Vague de destination introuvable");
    }
  }

  const result = await prisma.lotAlevins.updateMany({
    where: { id, siteId },
    data: {
      statut: StatutLotAlevins.TRANSFERE,
      destinationSortie: data.destinationSortie,
      ...(data.vagueDestinationId !== undefined && {
        vagueDestinationId: data.vagueDestinationId,
      }),
      dateTransfert: new Date(data.dateTransfert),
      phase: PhaseLot.SORTI,
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  if (result.count === 0) {
    throw new Error("Lot d'alevins introuvable");
  }
}

/**
 * Supprime un lot d'alevins.
 *
 * Refuse la suppression si le lot possede des sous-lots actifs
 * (statut different de TRANSFERE et PERDU).
 *
 * R8 : verifie siteId.
 */
export async function deleteLot(id: string, siteId: string) {
  const lot = await prisma.lotAlevins.findFirst({
    where: { id, siteId },
    include: {
      sousLots: {
        where: {
          statut: {
            notIn: [StatutLotAlevins.TRANSFERE, StatutLotAlevins.PERDU],
          },
        },
        select: { id: true, code: true, statut: true },
      },
    },
  });

  if (!lot) {
    throw new Error("Lot d'alevins introuvable");
  }

  if (lot.sousLots.length > 0) {
    const codes = lot.sousLots.map((sl) => sl.code).join(", ");
    throw new Error(
      `Impossible de supprimer : ce lot a ${lot.sousLots.length} sous-lot(s) actif(s) : ${codes}. ` +
        `Transferez ou marquez les sous-lots comme perdus avant de supprimer le lot parent.`
    );
  }

  await prisma.lotAlevins.delete({ where: { id } });
}
