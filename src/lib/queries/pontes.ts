import { prisma } from "@/lib/db";
import { StatutReproducteur } from "@/types";
import type {
  CreatePonteDTO,
  UpdatePonteDTO,
  PonteFilters,
} from "@/types";

export type { CreatePonteDTO, UpdatePonteDTO, PonteFilters };

/** Liste les pontes d'un site avec filtres optionnels et pagination */
export async function getPontes(
  siteId: string,
  filters?: PonteFilters,
  pagination?: { limit: number; offset: number }
) {
  const where: Record<string, unknown> = { siteId };

  if (filters?.statut) where.statut = filters.statut;
  if (filters?.femelleId) where.femelleId = filters.femelleId;
  if (filters?.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { notes: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const limit = Math.min(pagination?.limit ?? 50, 200);
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.ponte.findMany({
      where,
      include: {
        femelle: { select: { id: true, code: true, sexe: true, poids: true } },
        male: { select: { id: true, code: true, sexe: true, poids: true } },
        _count: { select: { lots: true } },
      },
      orderBy: { datePonte: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.ponte.count({ where }),
  ]);

  return { data, total };
}

/** Recupere une ponte par ID (verifie siteId), avec femelle, male et lots */
export async function getPonteById(id: string, siteId: string) {
  return prisma.ponte.findFirst({
    where: { id, siteId },
    include: {
      femelle: true,
      male: true,
      lots: {
        orderBy: { createdAt: "desc" },
        include: {
          bac: { select: { id: true, nom: true } },
          vagueDestination: { select: { id: true, code: true } },
        },
      },
      _count: { select: { lots: true } },
    },
  });
}

/** Cree une ponte, verifie que la femelle existe et est ACTIF */
export async function createPonte(siteId: string, data: CreatePonteDTO) {
  // Verifier unicite du code
  const existing = await prisma.ponte.findUnique({ where: { code: data.code } });
  if (existing) {
    throw new Error(`Le code "${data.code}" est deja utilise`);
  }

  // Verifier que la femelle appartient au site et est active
  const femelle = await prisma.reproducteur.findFirst({
    where: { id: data.femelleId, siteId },
  });
  if (!femelle) {
    throw new Error("Femelle introuvable");
  }
  if (femelle.statut !== StatutReproducteur.ACTIF) {
    throw new Error(
      "La femelle doit avoir le statut ACTIF pour creer une ponte"
    );
  }

  // Verifier le male si fourni
  if (data.maleId) {
    const male = await prisma.reproducteur.findFirst({
      where: { id: data.maleId, siteId },
    });
    if (!male) {
      throw new Error("Male introuvable");
    }
    if (male.statut !== StatutReproducteur.ACTIF) {
      throw new Error(
        "Le male doit avoir le statut ACTIF pour creer une ponte"
      );
    }
  }

  return prisma.ponte.create({
    data: {
      code: data.code,
      femelleId: data.femelleId,
      maleId: data.maleId ?? null,
      datePonte: new Date(data.datePonte),
      nombreOeufs: data.nombreOeufs ?? null,
      tauxFecondation: data.tauxFecondation ?? null,
      notes: data.notes ?? null,
      siteId,
    },
    include: {
      femelle: { select: { id: true, code: true } },
      male: { select: { id: true, code: true } },
    },
  });
}

/** Met a jour une ponte */
export async function updatePonte(
  id: string,
  siteId: string,
  data: UpdatePonteDTO
) {
  // Verifier unicite du code si modifie
  if (data.code !== undefined) {
    const existing = await prisma.ponte.findFirst({
      where: { code: data.code, NOT: { id } },
    });
    if (existing) {
      throw new Error(`Le code "${data.code}" est deja utilise`);
    }
  }

  const result = await prisma.ponte.updateMany({
    where: { id, siteId },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.maleId !== undefined && { maleId: data.maleId }),
      ...(data.datePonte !== undefined && {
        datePonte: new Date(data.datePonte),
      }),
      ...(data.nombreOeufs !== undefined && { nombreOeufs: data.nombreOeufs }),
      ...(data.tauxFecondation !== undefined && {
        tauxFecondation: data.tauxFecondation,
      }),
      ...(data.statut !== undefined && { statut: data.statut }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  if (result.count === 0) {
    throw new Error("Ponte introuvable");
  }

  return prisma.ponte.findFirst({
    where: { id, siteId },
    include: {
      femelle: { select: { id: true, code: true } },
      male: { select: { id: true, code: true } },
      _count: { select: { lots: true } },
    },
  });
}

/** Supprime une ponte (verifie qu'elle n'a pas de lots lies) */
export async function deletePonte(id: string, siteId: string) {
  const ponte = await prisma.ponte.findFirst({
    where: { id, siteId },
    include: { _count: { select: { lots: true } } },
  });

  if (!ponte) {
    throw new Error("Ponte introuvable");
  }

  if (ponte._count.lots > 0) {
    throw new Error(
      `Impossible de supprimer : cette ponte a ${ponte._count.lots} lot(s) d'alevins lie(s)`
    );
  }

  await prisma.ponte.delete({ where: { id } });
}
