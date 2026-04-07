import { prisma } from "@/lib/db";
import type { CreateBacDTO, UpdateBacDTO, BacResponse } from "@/types";
import { TypeSystemeBac, TypeReleve } from "@/types";

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
      include: {
        // ADR-043 Phase 2: lire l'assignation active pour obtenir vagueCode et nombrePoissons
        assignations: {
          where: { dateFin: null },
          take: 1,
          include: { vague: { select: { code: true } } },
        },
        vague: { select: { code: true } },
      },
      orderBy: { nom: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.bac.count({ where: { siteId } }),
  ]);

  const data = bacs.map((b) => {
    // ADR-043: préférer l'assignation active; fallback sur bac.vagueId (rétrocompat)
    const activeAssignation = b.assignations?.[0] ?? null;
    return {
      id: b.id,
      nom: b.nom,
      volume: b.volume,
      nombrePoissons: activeAssignation?.nombrePoissons ?? b.nombrePoissons,
      nombreInitial: activeAssignation?.nombrePoissonsInitial ?? b.nombreInitial,
      poidsMoyenInitial: activeAssignation?.poidsMoyenInitial ?? b.poidsMoyenInitial,
      typeSysteme: (b.typeSysteme as TypeSystemeBac | null) ?? null,
      isBlocked: b.isBlocked ?? false,
      vagueId: activeAssignation?.vagueId ?? b.vagueId,
      siteId: b.siteId,
      vagueCode: activeAssignation?.vague?.code ?? b.vague?.code ?? null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  });

  return { data, total };
}

/** Recupere un bac par son ID (verifie qu'il appartient au site) */
export async function getBacById(id: string, siteId: string) {
  const bac = await prisma.bac.findFirst({
    where: { id, siteId },
    include: {
      vague: { select: { code: true } },
      // ADR-043: inclure l'assignation active
      assignations: {
        where: { dateFin: null },
        take: 1,
        include: { vague: { select: { code: true } } },
      },
    },
  });
  if (!bac) return null;

  const activeAssignation = bac.assignations?.[0] ?? null;
  return {
    ...bac,
    // Exposer les champs depuis l'assignation active en priorité (dual-source)
    vagueId: activeAssignation?.vagueId ?? bac.vagueId,
    nombrePoissons: activeAssignation?.nombrePoissons ?? bac.nombrePoissons,
    nombreInitial: activeAssignation?.nombrePoissonsInitial ?? bac.nombreInitial,
    poidsMoyenInitial: activeAssignation?.poidsMoyenInitial ?? bac.poidsMoyenInitial,
    vagueCode: activeAssignation?.vague?.code ?? bac.vague?.code ?? null,
  };
}

/**
 * Recupere un bac avec tout son historique d'assignations (toutes, pas seulement actives).
 * ADR-043 — pour la page de détail bac.
 */
export async function getBacWithAssignations(bacId: string, siteId: string) {
  return prisma.bac.findFirst({
    where: { id: bacId, siteId },
    include: {
      assignations: {
        include: { vague: { select: { id: true, code: true, statut: true } } },
        orderBy: { dateAssignation: "desc" },
      },
    },
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
  const bac = await prisma.bac.findFirst({
    where: { id, siteId },
    include: {
      assignations: { where: { dateFin: null }, take: 1 },
    },
  });
  if (!bac) throw new Error("Bac introuvable");

  // ADR-043: lire vagueId depuis l'assignation active en priorité
  const activeAssignation = bac.assignations?.[0] ?? null;
  const currentVagueId = activeAssignation?.vagueId ?? bac.vagueId;

  // Si nombreInitial est fourni mais pas nombrePoissons, auto-calculer :
  // nombrePoissons = nombreInitial - sum(mortalité relevés du bac dans la vague)
  let computedNombrePoissons: number | undefined;
  if (data.nombreInitial !== undefined && data.nombrePoissons === undefined && currentVagueId) {
    const mortaliteSum = await prisma.releve.aggregate({
      where: {
        bacId: id,
        vagueId: currentVagueId,
        typeReleve: TypeReleve.MORTALITE,
      },
      _sum: { nombreMorts: true },
    });
    computedNombrePoissons = data.nombreInitial - (mortaliteSum._sum.nombreMorts ?? 0);
  }

  const newNombrePoissons =
    data.nombrePoissons !== undefined
      ? data.nombrePoissons
      : computedNombrePoissons !== undefined
        ? computedNombrePoissons
        : undefined;

  // Mise à jour du bac (backward compat — Phase 2 dual-write)
  const updatedBac = await prisma.bac.update({
    where: { id },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.volume !== undefined && { volume: data.volume }),
      ...(newNombrePoissons !== undefined && { nombrePoissons: newNombrePoissons }),
      ...(data.nombreInitial !== undefined && { nombreInitial: data.nombreInitial }),
      ...(data.poidsMoyenInitial !== undefined && { poidsMoyenInitial: data.poidsMoyenInitial }),
      ...(data.typeSysteme !== undefined && { typeSysteme: data.typeSysteme as TypeSystemeBac | null }),
    },
  });

  // ADR-043 Phase 2: également mettre à jour l'assignation active si elle existe
  if (activeAssignation) {
    await prisma.assignationBac.update({
      where: { id: activeAssignation.id },
      data: {
        ...(newNombrePoissons !== undefined && { nombrePoissons: newNombrePoissons }),
        ...(data.nombreInitial !== undefined && { nombrePoissonsInitial: data.nombreInitial }),
        ...(data.poidsMoyenInitial !== undefined && { poidsMoyenInitial: data.poidsMoyenInitial }),
      },
    });
  }

  return updatedBac;
}

/** Liste les bacs libres d'un site (non assignes a une vague) */
export async function getBacsLibres(siteId: string) {
  // ADR-043 Phase 2: un bac est libre s'il n'a aucune assignation active (dateFin null)
  // Fallback: aussi aucun vagueId (rétrocompat)
  return prisma.bac.findMany({
    where: {
      siteId,
      // Bac sans assignation active dans la table AssignationBac
      assignations: { none: { dateFin: null } },
    },
    orderBy: { nom: "asc" },
  });
}

/** Assigne un bac a une vague (atomique, sans race condition) */
export async function assignerBac(
  bacId: string,
  vagueId: string,
  siteId: string,
  options?: { nombrePoissons?: number; poidsMoyenInitial?: number; dateAssignation?: Date }
) {
  return prisma.$transaction(async (tx) => {
    // Vérification atomique : pas d'assignation active existante
    const result = await tx.bac.updateMany({
      where: { id: bacId, siteId, vagueId: null },
      data: { vagueId },
    });

    if (result.count === 0) {
      const bac = await tx.bac.findFirst({ where: { id: bacId, siteId } });
      if (!bac) throw new Error("Bac introuvable");
      throw new Error("Ce bac est déjà assigné à une vague");
    }

    // ADR-043 Phase 2: créer l'enregistrement AssignationBac
    await tx.assignationBac.create({
      data: {
        bacId,
        vagueId,
        siteId,
        dateAssignation: options?.dateAssignation ?? new Date(),
        dateFin: null,
        nombrePoissonsInitial: options?.nombrePoissons ?? null,
        poidsMoyenInitial: options?.poidsMoyenInitial ?? null,
        nombrePoissons: options?.nombrePoissons ?? null,
      },
    });
  });
}

/** Libere un bac (retire l'assignation a la vague) */
export async function libererBac(bacId: string, siteId: string) {
  return prisma.$transaction(async (tx) => {
    // Backward compat: null-ifier Bac.vagueId
    await tx.bac.updateMany({
      where: { id: bacId, siteId },
      data: { vagueId: null },
    });

    // ADR-043 Phase 2: fermer l'assignation active
    await tx.assignationBac.updateMany({
      where: { bacId, siteId, dateFin: null },
      data: { dateFin: new Date() },
    });
  });
}

/**
 * Retourne tous les bacs distincts qui ont au moins un releve pour la vague demandee.
 * Contrairement a getBacs(vagueId), cette fonction joint via la table Releve et inclut
 * les bacs orphelins (Bac.vagueId = null) qui ont des releves historiques pour cette vague.
 */
export async function getBacsAvecRelevesPourVague(
  siteId: string,
  vagueId: string
): Promise<{ id: string; nom: string }[]> {
  const rows = await prisma.releve.findMany({
    where: { vagueId, siteId },
    select: { bacId: true },
    distinct: ["bacId"],
  });
  // Filter null bacIds — lot d'alevins releves can have null bacId (R3-S5)
  const bacIds = rows.map((r) => r.bacId).filter((id): id is string => id !== null);
  if (bacIds.length === 0) return [];

  return prisma.bac.findMany({
    where: { id: { in: bacIds }, siteId },
    select: { id: true, nom: true },
    orderBy: { nom: "asc" },
  });
}
