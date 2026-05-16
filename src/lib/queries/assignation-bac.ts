import { prisma } from "@/lib/db";

type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

/** Retourne l'assignation active d'un bac (dateFin = null), ou null si le bac est libre */
export async function getActiveAssignation(bacId: string, siteId: string) {
  return prisma.assignationBac.findFirst({
    where: { bacId, siteId, dateFin: null },
  });
}

/** Retourne le nombreActuel d'un bac (lecture directe, pas de calcul) */
export async function getNombreActuelBac(
  bacId: string,
  siteId: string
): Promise<number | null> {
  const assignation = await prisma.assignationBac.findFirst({
    where: { bacId, siteId, dateFin: null },
    select: { nombreActuel: true },
  });
  return assignation?.nombreActuel ?? null;
}

/** Retourne le nombreActuel total d'une vague (somme des assignations actives) */
export async function getNombreActuelVague(
  vagueId: string,
  siteId: string
): Promise<number> {
  const result = await prisma.assignationBac.aggregate({
    where: { vagueId, siteId, dateFin: null },
    _sum: { nombreActuel: true },
  });
  return result._sum.nombreActuel ?? 0;
}

/**
 * Décrémente atomiquement nombreActuel sur l'assignation active d'un bac.
 * Utilisé par createReleve(MORTALITE) et createVente.
 * Retourne le nouveau nombreActuel.
 */
export async function decrementerAssignationActive(
  tx: PrismaTransactionClient,
  bacId: string,
  vagueId: string,
  delta: number
): Promise<number> {
  const assignation = await tx.assignationBac.findFirst({
    where: { bacId, vagueId, dateFin: null },
    select: { id: true, nombreActuel: true },
  });
  if (!assignation) {
    throw new Error(`Aucune assignation active pour bacId=${bacId}, vagueId=${vagueId}`);
  }

  const nouveauNombreActuel = Math.max(0, (assignation.nombreActuel ?? 0) - delta);
  await tx.assignationBac.update({
    where: { id: assignation.id },
    data: { nombreActuel: nouveauNombreActuel },
  });
  return nouveauNombreActuel;
}

/**
 * Force nombreActuel à une valeur (utilisé par COMPTAGE — Option B ADR-049).
 * Retourne l'écart constaté (ancien - nouveau).
 */
export async function setNombreActuelAssignation(
  tx: PrismaTransactionClient,
  bacId: string,
  vagueId: string,
  nouvelleValeur: number
): Promise<{ ecart: number }> {
  const assignation = await tx.assignationBac.findFirst({
    where: { bacId, vagueId, dateFin: null },
    select: { id: true, nombreActuel: true },
  });
  if (!assignation) {
    throw new Error(`Aucune assignation active pour bacId=${bacId}, vagueId=${vagueId}`);
  }

  const ancienNombreActuel = assignation.nombreActuel ?? 0;
  const ecart = ancienNombreActuel - nouvelleValeur;

  await tx.assignationBac.update({
    where: { id: assignation.id },
    data: { nombreActuel: nouvelleValeur },
  });

  return { ecart };
}

/**
 * Incrémente nombreActuel (utilisé lors du revert d'une mortalité — edit/delete).
 */
export async function incrementerAssignationActive(
  tx: PrismaTransactionClient,
  bacId: string,
  vagueId: string,
  delta: number
): Promise<number> {
  const assignation = await tx.assignationBac.findFirst({
    where: { bacId, vagueId, dateFin: null },
    select: { id: true, nombreActuel: true },
  });
  if (!assignation) {
    throw new Error(`Aucune assignation active pour bacId=${bacId}, vagueId=${vagueId}`);
  }

  const nouveauNombreActuel = (assignation.nombreActuel ?? 0) + delta;
  await tx.assignationBac.update({
    where: { id: assignation.id },
    data: { nombreActuel: nouveauNombreActuel },
  });
  return nouveauNombreActuel;
}
