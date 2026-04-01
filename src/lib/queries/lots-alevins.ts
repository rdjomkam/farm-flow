import { prisma } from "@/lib/db";
import { StatutLotAlevins, StatutVague } from "@/types";
import type {
  CreateLotAlevinsDTO,
  UpdateLotAlevinsDTO,
  LotAlevinsFilters,
  TransfertLotDTO,
} from "@/types";

export type {
  CreateLotAlevinsDTO,
  UpdateLotAlevinsDTO,
  LotAlevinsFilters,
  TransfertLotDTO,
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

    // 4. Assigner les bacs a la vague
    await tx.bac.updateMany({
      where: { id: { in: vagueData.bacIds }, siteId },
      data: { vagueId: nouvelleVague.id },
    });

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
