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
        // ADR-043 Phase 3: AssignationBac est la seule source de vérité
        assignations: {
          where: { dateFin: null },
          take: 1,
          include: { vague: { select: { code: true } } },
        },
      },
      orderBy: { nom: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.bac.count({ where: { siteId } }),
  ]);

  const data = bacs.map((b) => {
    // ADR-043 Phase 3: toutes les données de production viennent de l'assignation active
    const activeAssignation = b.assignations?.[0] ?? null;
    return {
      id: b.id,
      nom: b.nom,
      volume: b.volume,
      nombrePoissons: activeAssignation?.nombreActuel ?? null,
      nombreInitial: activeAssignation?.nombreInitial ?? null,
      poidsMoyenInitial: activeAssignation?.poidsMoyenInitial ?? null,
      typeSysteme: (b.typeSysteme as TypeSystemeBac | null) ?? null,
      isBlocked: b.isBlocked ?? false,
      vagueId: activeAssignation?.vagueId ?? null,
      siteId: b.siteId,
      vagueCode: activeAssignation?.vague?.code ?? null,
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
      // ADR-043 Phase 3: AssignationBac est la seule source de vérité
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
    // ADR-043 Phase 3: toutes les données de production viennent de l'assignation active
    vagueId: activeAssignation?.vagueId ?? null,
    nombrePoissons: activeAssignation?.nombreActuel ?? null,
    nombreInitial: activeAssignation?.nombreInitial ?? null,
    poidsMoyenInitial: activeAssignation?.poidsMoyenInitial ?? null,
    vagueCode: activeAssignation?.vague?.code ?? null,
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
  // ADR-043 Phase 3: Bac ne stocke plus les données de production — elles vivent dans AssignationBac
  return prisma.bac.create({
    data: {
      nom: data.nom,
      volume: data.volume,
      siteId,
    },
  });
}

/** Met a jour un bac (nom, volume, typeSysteme) et/ou l'assignation active (compteurs poissons) */
/**
 * Met a jour les caracteristiques physiques d'un bac.
 * ADR-043 Phase 3 : seuls nom, volume, typeSysteme sont modifiables.
 * Les donnees de production (nombrePoissons, nombreInitial, poidsMoyenInitial)
 * sont gerees exclusivement via AssignationBac.
 */
export async function updateBac(id: string, siteId: string, data: UpdateBacDTO) {
  const bac = await prisma.bac.findFirst({
    where: { id, siteId },
  });
  if (!bac) throw new Error("Bac introuvable");

  return prisma.bac.update({
    where: { id },
    data: {
      ...(data.nom !== undefined && { nom: data.nom }),
      ...(data.volume !== undefined && { volume: data.volume }),
      ...(data.typeSysteme !== undefined && { typeSysteme: data.typeSysteme as TypeSystemeBac | null }),
    },
  });
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
    // ADR-043 Phase 3: vérification atomique via AssignationBac (pas Bac.vagueId)
    const existingActive = await tx.assignationBac.findFirst({
      where: { bacId, siteId, dateFin: null },
    });

    if (existingActive) {
      const bac = await tx.bac.findFirst({ where: { id: bacId, siteId } });
      if (!bac) throw new Error("Bac introuvable");
      throw new Error("Ce bac est déjà assigné à une vague");
    }

    // Vérifier que le bac existe
    const bac = await tx.bac.findFirst({ where: { id: bacId, siteId } });
    if (!bac) throw new Error("Bac introuvable");

    // ADR-043 Phase 3: créer l'enregistrement AssignationBac (seule source de vérité)
    await tx.assignationBac.create({
      data: {
        bacId,
        vagueId,
        siteId,
        dateAssignation: options?.dateAssignation ?? new Date(),
        dateFin: null,
        nombreInitial: options?.nombrePoissons ?? null,
        poidsMoyenInitial: options?.poidsMoyenInitial ?? null,
        nombreActuel: options?.nombrePoissons ?? null,
      },
    });
  });
}

/** Libere un bac (retire l'assignation a la vague) */
export async function libererBac(bacId: string, siteId: string) {
  return prisma.$transaction(async (tx) => {
    // ADR-043 Phase 3: fermer l'assignation active (seule source de vérité)
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
