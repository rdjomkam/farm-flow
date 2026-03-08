import { prisma } from "@/lib/db";
import type { CreateBacDTO, BacResponse } from "@/types";

/** Liste tous les bacs avec le code vague si assigne */
export async function getBacs(): Promise<BacResponse[]> {
  const bacs = await prisma.bac.findMany({
    include: { vague: { select: { code: true } } },
    orderBy: { nom: "asc" },
  });

  return bacs.map((b) => ({
    id: b.id,
    nom: b.nom,
    volume: b.volume,
    nombrePoissons: b.nombrePoissons,
    vagueId: b.vagueId,
    vagueCode: b.vague?.code ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));
}

/** Recupere un bac par son ID */
export async function getBacById(id: string) {
  return prisma.bac.findUnique({
    where: { id },
    include: { vague: { select: { code: true } } },
  });
}

/** Cree un nouveau bac */
export async function createBac(data: CreateBacDTO) {
  return prisma.bac.create({
    data: {
      nom: data.nom,
      volume: data.volume,
      nombrePoissons: data.nombrePoissons ?? null,
    },
  });
}

/** Liste les bacs libres (non assignes a une vague) */
export async function getBacsLibres() {
  return prisma.bac.findMany({
    where: { vagueId: null },
    orderBy: { nom: "asc" },
  });
}

/** Assigne un bac a une vague (atomique, sans race condition) */
export async function assignerBac(bacId: string, vagueId: string) {
  const result = await prisma.bac.updateMany({
    where: { id: bacId, vagueId: null },
    data: { vagueId },
  });

  if (result.count === 0) {
    const bac = await prisma.bac.findUnique({ where: { id: bacId } });
    if (!bac) throw new Error("Bac introuvable");
    throw new Error("Ce bac est déjà assigné à une vague");
  }
}

/** Libere un bac (retire l'assignation a la vague) */
export async function libererBac(bacId: string) {
  return prisma.bac.update({
    where: { id: bacId },
    data: { vagueId: null },
  });
}
