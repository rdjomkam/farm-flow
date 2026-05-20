import { prisma } from "@/lib/db";
import { TypeUniteProduction } from "@/types";
import type { CreateUniteProductionDTO, UpdateUniteProductionDTO } from "@/types";

/** Liste les unites de production d'un site */
export async function getUnitesProduction(
  siteId: string,
  filters?: { type?: string; isActive?: boolean }
) {
  const where: Record<string, unknown> = { siteId };
  if (filters?.type) where.type = filters.type;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  return prisma.uniteProduction.findMany({
    where,
    include: {
      _count: {
        select: {
          vagues: true,
          depenses: true,
          transfertsSortants: true,
          transfertsEntrants: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Recupere une unite par ID */
export async function getUniteProductionById(id: string, siteId: string) {
  return prisma.uniteProduction.findFirst({
    where: { id, siteId },
    include: {
      vagues: {
        select: { id: true, code: true, statut: true, nombreInitial: true, dateDebut: true },
        orderBy: { dateDebut: "desc" },
      },
      _count: {
        select: {
          vagues: true,
          depenses: true,
          transfertsSortants: true,
          transfertsEntrants: true,
        },
      },
    },
  });
}

/** Cree une unite de production */
export async function createUniteProduction(
  siteId: string,
  dto: CreateUniteProductionDTO
) {
  // Validate type
  if (!Object.values(TypeUniteProduction).includes(dto.type as TypeUniteProduction)) {
    throw new Error(`Type d'unite invalide: ${dto.type}`);
  }

  // Check code uniqueness within site (enforced by @@unique but better error)
  const existing = await prisma.uniteProduction.findFirst({
    where: { siteId, code: dto.code },
  });
  if (existing) {
    throw new Error(`Le code '${dto.code}' est deja utilise pour ce site`);
  }

  const created = await prisma.uniteProduction.create({
    data: {
      code: dto.code,
      nom: dto.nom,
      type: dto.type as TypeUniteProduction,
      description: dto.description ?? null,
      siteId,
    },
  });
  return prisma.uniteProduction.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      _count: {
        select: {
          vagues: true,
          depenses: true,
          transfertsSortants: true,
          transfertsEntrants: true,
        },
      },
    },
  });
}

/** Met a jour une unite de production */
export async function updateUniteProduction(
  id: string,
  siteId: string,
  dto: UpdateUniteProductionDTO
) {
  const existing = await prisma.uniteProduction.findFirst({
    where: { id, siteId },
  });
  if (!existing) throw new Error("Unite de production introuvable");

  return prisma.uniteProduction.update({
    where: { id },
    data: {
      ...(dto.nom !== undefined && { nom: dto.nom }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    },
    include: {
      _count: {
        select: {
          vagues: true,
          depenses: true,
          transfertsSortants: true,
          transfertsEntrants: true,
        },
      },
    },
  });
}

/** Assigne une vague a une unite de production */
export async function assignerVagueAUnite(
  vagueId: string,
  uniteProductionId: string | null,
  siteId: string
) {
  const vague = await prisma.vague.findFirst({
    where: { id: vagueId, siteId },
  });
  if (!vague) throw new Error("Vague introuvable");

  if (uniteProductionId) {
    const unite = await prisma.uniteProduction.findFirst({
      where: { id: uniteProductionId, siteId },
    });
    if (!unite) throw new Error("Unite de production introuvable");
  }

  return prisma.vague.update({
    where: { id: vagueId },
    data: { uniteProductionId },
  });
}

/** Assigne une depense a une unite de production */
export async function assignerDepenseAUnite(
  depenseId: string,
  uniteProductionId: string | null,
  siteId: string
) {
  const depense = await prisma.depense.findFirst({
    where: { id: depenseId, siteId },
  });
  if (!depense) throw new Error("Depense introuvable");

  if (uniteProductionId) {
    const unite = await prisma.uniteProduction.findFirst({
      where: { id: uniteProductionId, siteId },
    });
    if (!unite) throw new Error("Unite de production introuvable");
  }

  return prisma.depense.update({
    where: { id: depenseId },
    data: { uniteProductionId },
  });
}

/** Assigne une depense recurrente a une unite de production */
export async function assignerDepenseRecurrenteAUnite(
  depenseRecurrenteId: string,
  uniteProductionId: string | null,
  siteId: string
) {
  const dr = await prisma.depenseRecurrente.findFirst({
    where: { id: depenseRecurrenteId, siteId },
  });
  if (!dr) throw new Error("Depense recurrente introuvable");

  if (uniteProductionId) {
    const unite = await prisma.uniteProduction.findFirst({
      where: { id: uniteProductionId, siteId },
    });
    if (!unite) throw new Error("Unite de production introuvable");
  }

  return prisma.depenseRecurrente.update({
    where: { id: depenseRecurrenteId },
    data: { uniteProductionId },
  });
}
