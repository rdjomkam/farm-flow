import { prisma } from "@/lib/db";
import type { CreateTransfertInterneDTO } from "@/types";

/** Liste les transferts internes d'un site */
export async function getTransfertsInternes(
  siteId: string,
  filters?: { uniteProductionId?: string },
  pagination?: { limit: number; offset: number }
) {
  const where: Record<string, unknown> = { siteId };
  if (filters?.uniteProductionId) {
    where.OR = [
      { uniteSourceId: filters.uniteProductionId },
      { uniteDestinationId: filters.uniteProductionId },
    ];
  }

  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.transfertInterne.findMany({
      where,
      include: {
        uniteSource: { select: { id: true, code: true, nom: true, type: true } },
        uniteDestination: { select: { id: true, code: true, nom: true, type: true } },
        lotAlevins: { select: { id: true, code: true } },
        vagueDestination: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.transfertInterne.count({ where }),
  ]);

  return { data, total };
}

/** Recupere un transfert par ID */
export async function getTransfertInterneById(id: string, siteId: string) {
  return prisma.transfertInterne.findFirst({
    where: { id, siteId },
    include: {
      uniteSource: { select: { id: true, code: true, nom: true, type: true } },
      uniteDestination: { select: { id: true, code: true, nom: true, type: true } },
      lotAlevins: { select: { id: true, code: true } },
      vagueDestination: { select: { id: true, code: true } },
      user: { select: { id: true, name: true } },
    },
  });
}

/**
 * Cree un transfert interne entre deux unites de production.
 *
 * Pour l'unite source: montantTotal = revenu interne.
 * Pour l'unite destination: montantTotal = cout d'acquisition.
 */
export async function createTransfertInterne(
  siteId: string,
  userId: string,
  dto: CreateTransfertInterneDTO
) {
  return prisma.$transaction(async (tx) => {
    // Validate source and destination units
    const [source, destination] = await Promise.all([
      tx.uniteProduction.findFirst({
        where: { id: dto.uniteSourceId, siteId, isActive: true },
      }),
      tx.uniteProduction.findFirst({
        where: { id: dto.uniteDestinationId, siteId, isActive: true },
      }),
    ]);

    if (!source) throw new Error("Unite source introuvable ou inactive");
    if (!destination) throw new Error("Unite destination introuvable ou inactive");
    if (source.id === destination.id) {
      throw new Error("Les unites source et destination doivent etre differentes");
    }

    // Validate lot alevins if provided
    if (dto.lotAlevinsId) {
      const lot = await tx.lotAlevins.findFirst({
        where: { id: dto.lotAlevinsId, siteId },
      });
      if (!lot) throw new Error("Lot d'alevins introuvable");
    }

    // Validate destination vague if provided
    if (dto.vagueDestinationId) {
      const vague = await tx.vague.findFirst({
        where: { id: dto.vagueDestinationId, siteId },
      });
      if (!vague) throw new Error("Vague destination introuvable");
    }

    // Calculate montant total
    const prixBase = dto.prixBase ?? "PAR_POISSON";
    let montantTotal: number;
    if (prixBase === "PAR_KG" && dto.poidsMoyenG) {
      // Prix par kg: (nombrePoissons * poidsMoyenG / 1000) * prixUnitaire
      montantTotal = (dto.nombrePoissons * dto.poidsMoyenG / 1000) * dto.prixUnitaire;
    } else {
      // Prix par poisson: nombrePoissons * prixUnitaire
      montantTotal = dto.nombrePoissons * dto.prixUnitaire;
    }

    // Generate code TRF-YYYY-NNN
    const year = new Date().getFullYear();
    const pattern = `TRF-${year}-`;
    const last = await tx.transfertInterne.findFirst({
      where: { siteId, code: { startsWith: pattern } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    let seq = 1;
    if (last) {
      const parts = last.code.split("-");
      seq = (parseInt(parts[2], 10) || 0) + 1;
    }
    const code = `${pattern}${String(seq).padStart(3, "0")}`;

    // Split create + findUniqueOrThrow to avoid Prisma 7 unchecked/checked input conflict
    const created = await tx.transfertInterne.create({
      data: {
        code,
        date: dto.date ? new Date(dto.date) : new Date(),
        uniteSourceId: dto.uniteSourceId,
        uniteDestinationId: dto.uniteDestinationId,
        lotAlevinsId: dto.lotAlevinsId ?? null,
        vagueDestinationId: dto.vagueDestinationId ?? null,
        nombrePoissons: dto.nombrePoissons,
        poidsMoyenG: dto.poidsMoyenG ?? null,
        prixUnitaire: dto.prixUnitaire,
        prixBase,
        montantTotal,
        description: dto.description ?? null,
        siteId,
        userId,
      },
    });

    const transfert = await tx.transfertInterne.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        uniteSource: { select: { id: true, code: true, nom: true, type: true } },
        uniteDestination: { select: { id: true, code: true, nom: true, type: true } },
        lotAlevins: { select: { id: true, code: true } },
        vagueDestination: { select: { id: true, code: true } },
        user: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await tx.siteAuditLog.create({
      data: {
        siteId,
        actorId: userId,
        action: "TRANSFERT_INTERNE_CREE",
        details: {
          code,
          source: source.nom,
          destination: destination.nom,
          nombrePoissons: dto.nombrePoissons,
          montantTotal,
          lotAlevinsId: dto.lotAlevinsId ?? null,
          vagueDestinationId: dto.vagueDestinationId ?? null,
        },
      },
    });

    return transfert;
  });
}
