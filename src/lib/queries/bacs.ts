import { prisma } from "@/lib/db";
import type { CreateBacDTO, UpdateBacDTO, BacResponse } from "@/types";
import { TypeSystemeBac } from "@/types";

/** Liste tous les bacs d'un site avec le code vague si assigne, avec pagination */
export async function getBacs(
  siteId: string,
  pagination?: { limit: number; offset: number }
): Promise<{ data: BacResponse[]; total: number }> {
  const limit = pagination?.limit ?? 50;
  const offset = pagination?.offset ?? 0;

  const [bacs, total] = await Promise.all([
    prisma.bac.findMany({
      where: { siteId },
      include: { vague: { select: { code: true } } },
      orderBy: { nom: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.bac.count({ where: { siteId } }),
  ]);

  const data = bacs.map((b) => ({
    id: b.id,
    nom: b.nom,
    volume: b.volume,
    nombrePoissons: b.nombrePoissons,
    nombreInitial: b.nombreInitial,
    poidsMoyenInitial: b.poidsMoyenInitial,
    typeSysteme: (b.typeSysteme as TypeSystemeBac | null) ?? null,
    isBlocked: (b as { isBlocked?: boolean }).isBlocked ?? false,
    vagueId: b.vagueId,
    siteId: b.siteId,
    vagueCode: b.vague?.code ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  return { data, total };
}

/** Recupere un bac par son ID (verifie qu'il appartient au site) */
export async function getBacById(id: string, siteId: string) {
  return prisma.bac.findFirst({
    where: { id, siteId },
    include: { vague: { select: { code: true } } },
  });
}

/** Cree un nouveau bac dans un site */
export async function createBac(siteId: string, data: CreateBacDTO) {
  return prisma.bac.create({
    data: {
      nom: data.nom,
      volume: data.volume,
      nombrePoissons: data.nombrePoissons ?? null,
      siteId,
    },
  });
}

/** Met a jour un bac (nom, volume, compteurs poissons) */
export async function updateBac(id: string, siteId: string, data: UpdateBacDTO) {
  const bac = await prisma.bac.findFirst({ where: { id, siteId } });
  if (!bac) throw new Error("Bac introuvable");

  // Si nombreInitial est fourni mais pas nombrePoissons, auto-calculer :
  // nombrePoissons = nombreInitial - sum(mortalité relevés du bac dans la vague)
  let computedNombrePoissons: number | undefined;
  if (data.nombreInitial !== undefined && data.nombrePoissons === undefined && bac.vagueId) {
    const mortaliteSum = await prisma.releve.aggregate({
      where: {
        bacId: id,
        vagueId: bac.vagueId,
        typeReleve: "MORTALITE",
      },
      _sum: { nombreMorts: true },
    });
    computedNombrePoissons = data.nombreInitial - (mortaliteSum._sum.nombreMorts ?? 0);
  }

  return prisma.bac.update({
    where: { id },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.volume !== undefined && { volume: data.volume }),
      ...(data.nombrePoissons !== undefined
        ? { nombrePoissons: data.nombrePoissons }
        : computedNombrePoissons !== undefined
          ? { nombrePoissons: computedNombrePoissons }
          : {}),
      ...(data.nombreInitial !== undefined && { nombreInitial: data.nombreInitial }),
      ...(data.poidsMoyenInitial !== undefined && { poidsMoyenInitial: data.poidsMoyenInitial }),
      ...(data.typeSysteme !== undefined && { typeSysteme: data.typeSysteme as TypeSystemeBac | null }),
    },
  });
}

/** Liste les bacs libres d'un site (non assignes a une vague) */
export async function getBacsLibres(siteId: string) {
  return prisma.bac.findMany({
    where: { siteId, vagueId: null },
    orderBy: { nom: "asc" },
  });
}

/** Assigne un bac a une vague (atomique, sans race condition) */
export async function assignerBac(bacId: string, vagueId: string, siteId: string) {
  const result = await prisma.bac.updateMany({
    where: { id: bacId, siteId, vagueId: null },
    data: { vagueId },
  });

  if (result.count === 0) {
    const bac = await prisma.bac.findFirst({ where: { id: bacId, siteId } });
    if (!bac) throw new Error("Bac introuvable");
    throw new Error("Ce bac est déjà assigné à une vague");
  }
}

/** Libere un bac (retire l'assignation a la vague) */
export async function libererBac(bacId: string, siteId: string) {
  return prisma.bac.updateMany({
    where: { id: bacId, siteId },
    data: { vagueId: null },
  });
}
