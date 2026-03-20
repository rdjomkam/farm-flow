import { prisma } from "@/lib/db";
import type { CreateBacDTO, UpdateBacDTO, BacResponse } from "@/types";
import { TypeSystemeBac } from "@/types";

/** Liste tous les bacs d'un site avec le code vague si assigne */
export async function getBacs(siteId: string): Promise<BacResponse[]> {
  const bacs = await prisma.bac.findMany({
    where: { siteId },
    include: { vague: { select: { code: true } } },
    orderBy: { nom: "asc" },
  });

  return bacs.map((b) => ({
    id: b.id,
    nom: b.nom,
    volume: b.volume,
    nombrePoissons: b.nombrePoissons,
    nombreInitial: b.nombreInitial,
    poidsMoyenInitial: b.poidsMoyenInitial,
    typeSysteme: (b.typeSysteme as TypeSystemeBac | null) ?? null,
    vagueId: b.vagueId,
    siteId: b.siteId,
    vagueCode: b.vague?.code ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));
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

/** Met a jour un bac (nom, volume) */
export async function updateBac(id: string, siteId: string, data: UpdateBacDTO) {
  const bac = await prisma.bac.findFirst({ where: { id, siteId } });
  if (!bac) throw new Error("Bac introuvable");

  return prisma.bac.update({
    where: { id },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.volume !== undefined && { volume: data.volume }),
      ...(data.nombrePoissons !== undefined && { nombrePoissons: data.nombrePoissons }),
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
