import { prisma } from "@/lib/db";
import { StatutReproducteur } from "@/types";
import type {
  CreateReproducteurDTO,
  UpdateReproducteurDTO,
  ReproducteurFilters,
} from "@/types";

export type { CreateReproducteurDTO, UpdateReproducteurDTO, ReproducteurFilters };

/** Liste les reproducteurs d'un site avec filtres optionnels et pagination */
export async function getReproducteurs(
  siteId: string,
  filters?: ReproducteurFilters,
  pagination?: { limit: number; offset: number }
) {
  const where: Record<string, unknown> = { siteId };

  if (filters?.sexe) where.sexe = filters.sexe;
  if (filters?.statut) where.statut = filters.statut;
  if (filters?.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { origine: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const limit = Math.min(pagination?.limit ?? 50, 200);
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.reproducteur.findMany({
      where,
      include: {
        _count: {
          select: {
            pontesAsFemelle: true,
            pontesAsMale: true,
          },
        },
      },
      orderBy: { code: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.reproducteur.count({ where }),
  ]);

  return { data, total };
}

/** Recupere un reproducteur par ID (verifie siteId), avec ses pontes recentes */
export async function getReproducteurById(id: string, siteId: string) {
  return prisma.reproducteur.findFirst({
    where: { id, siteId },
    include: {
      pontesAsFemelle: {
        orderBy: { datePonte: "desc" },
        take: 10,
        include: {
          _count: { select: { lots: true } },
        },
      },
      pontesAsMale: {
        orderBy: { datePonte: "desc" },
        take: 10,
        include: {
          _count: { select: { lots: true } },
        },
      },
      _count: {
        select: {
          pontesAsFemelle: true,
          pontesAsMale: true,
        },
      },
    },
  });
}

/** Cree un reproducteur */
export async function createReproducteur(
  siteId: string,
  data: CreateReproducteurDTO
) {
  // Verifier unicite du code
  const existing = await prisma.reproducteur.findUnique({
    where: { code: data.code },
  });
  if (existing) {
    throw new Error(`Le code "${data.code}" est deja utilise`);
  }

  return prisma.reproducteur.create({
    data: {
      code: data.code,
      sexe: data.sexe,
      poids: data.poids,
      age: data.age ?? null,
      origine: data.origine ?? null,
      notes: data.notes ?? null,
      statut: data.statut ?? StatutReproducteur.ACTIF,
      dateAcquisition: data.dateAcquisition
        ? new Date(data.dateAcquisition)
        : new Date(),
      siteId,
    },
  });
}

/** Met a jour un reproducteur */
export async function updateReproducteur(
  id: string,
  siteId: string,
  data: UpdateReproducteurDTO
) {
  // Verifier unicite du code si modifie
  if (data.code !== undefined) {
    const existing = await prisma.reproducteur.findFirst({
      where: { code: data.code, NOT: { id } },
    });
    if (existing) {
      throw new Error(`Le code "${data.code}" est deja utilise`);
    }
  }

  const result = await prisma.reproducteur.updateMany({
    where: { id, siteId },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.sexe !== undefined && { sexe: data.sexe }),
      ...(data.poids !== undefined && { poids: data.poids }),
      ...(data.age !== undefined && { age: data.age }),
      ...(data.origine !== undefined && { origine: data.origine || null }),
      ...(data.statut !== undefined && { statut: data.statut }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  if (result.count === 0) {
    throw new Error("Reproducteur introuvable");
  }

  return prisma.reproducteur.findFirst({ where: { id, siteId } });
}

/** Supprime un reproducteur (verifie qu'il n'a pas de pontes liees) */
export async function deleteReproducteur(id: string, siteId: string) {
  const reproducteur = await prisma.reproducteur.findFirst({
    where: { id, siteId },
    include: {
      _count: {
        select: {
          pontesAsFemelle: true,
          pontesAsMale: true,
        },
      },
    },
  });

  if (!reproducteur) {
    throw new Error("Reproducteur introuvable");
  }

  const totalPontes =
    reproducteur._count.pontesAsFemelle + reproducteur._count.pontesAsMale;
  if (totalPontes > 0) {
    throw new Error(
      `Impossible de supprimer : ce reproducteur a ${totalPontes} ponte(s) liee(s)`
    );
  }

  await prisma.reproducteur.delete({ where: { id } });
}
