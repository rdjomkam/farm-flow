import { prisma } from "@/lib/db";
import type { CreateClientDTO, UpdateClientDTO } from "@/types";

/** Liste tous les clients actifs d'un site */
export async function getClients(siteId: string) {
  return prisma.client.findMany({
    where: { siteId, isActive: true },
    include: {
      _count: { select: { ventes: true } },
    },
    orderBy: { nom: "asc" },
  });
}

/** Recupere un client par ID (verifie siteId) */
export async function getClientById(id: string, siteId: string) {
  return prisma.client.findFirst({
    where: { id, siteId },
    include: {
      ventes: {
        include: {
          vague: { select: { id: true, code: true } },
          facture: { select: { id: true, numero: true, statut: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { ventes: true } },
    },
  });
}

/** Cree un client */
export async function createClient(siteId: string, data: CreateClientDTO) {
  return prisma.client.create({
    data: {
      nom: data.nom,
      telephone: data.telephone ?? null,
      email: data.email ?? null,
      adresse: data.adresse ?? null,
      siteId,
    },
  });
}

/** Met a jour un client */
export async function updateClient(
  id: string,
  siteId: string,
  data: UpdateClientDTO
) {
  const result = await prisma.client.updateMany({
    where: { id, siteId },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.telephone !== undefined && { telephone: data.telephone || null }),
      ...(data.email !== undefined && { email: data.email || null }),
      ...(data.adresse !== undefined && { adresse: data.adresse || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  if (result.count === 0) {
    throw new Error("Client introuvable");
  }

  return prisma.client.findFirst({ where: { id, siteId } });
}

/** Desactive un client (soft delete) */
export async function deleteClient(id: string, siteId: string) {
  const result = await prisma.client.updateMany({
    where: { id, siteId },
    data: { isActive: false },
  });

  if (result.count === 0) {
    throw new Error("Client introuvable");
  }
}
