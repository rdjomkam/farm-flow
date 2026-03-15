import { prisma } from "@/lib/db";
import { FrequenceRecurrence, CategorieDepense, StatutDepense } from "@/types";
import type {
  CreateDepenseRecurrenteDTO,
  UpdateDepenseRecurrenteDTO,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine si une DepenseRecurrente est due selon sa frequence et sa
 * derniere generation.
 *
 * Logique :
 * - MENSUEL    : due si derniereGeneration < debut du mois courant
 * - TRIMESTRIEL: due si derniereGeneration < debut du trimestre courant
 * - ANNUEL     : due si derniereGeneration < debut de l'annee courante
 *
 * Idempotent : retourne false si deja generee dans la periode courante.
 */
function estDue(
  frequence: FrequenceRecurrence,
  derniereGeneration: Date | null
): boolean {
  const now = new Date();

  if (derniereGeneration === null) {
    // Jamais generee — toujours due
    return true;
  }

  if (frequence === FrequenceRecurrence.MENSUEL) {
    // Due si derniereGeneration < debut du mois courant
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    return derniereGeneration < debutMois;
  }

  if (frequence === FrequenceRecurrence.TRIMESTRIEL) {
    // Due si derniereGeneration < debut du trimestre courant
    const trimestre = Math.floor(now.getMonth() / 3);
    const debutTrimestre = new Date(now.getFullYear(), trimestre * 3, 1);
    return derniereGeneration < debutTrimestre;
  }

  if (frequence === FrequenceRecurrence.ANNUEL) {
    // Due si derniereGeneration < debut de l'annee courante
    const debutAnnee = new Date(now.getFullYear(), 0, 1);
    return derniereGeneration < debutAnnee;
  }

  return false;
}

/**
 * Genere le numero auto-incremantal d'une Depense au format DEP-YYYY-NNN.
 * Utilise un compte sur le siteId + prefixe annuel — meme pattern que createDepense.
 */
async function generateNumeroDepense(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  siteId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.depense.count({
    where: { siteId, numero: { startsWith: `DEP-${year}` } },
  });
  return `DEP-${year}-${String(count + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Liste les templates recurrents d'un site */
export async function getDepensesRecurrentes(
  siteId: string,
  onlyActive?: boolean
) {
  return prisma.depenseRecurrente.findMany({
    where: {
      siteId,
      ...(onlyActive !== undefined && { isActive: onlyActive }),
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { description: "asc" }],
  });
}

/** Recupere un template par ID */
export async function getDepenseRecurrenteById(id: string, siteId: string) {
  return prisma.depenseRecurrente.findFirst({
    where: { id, siteId },
    include: {
      user: { select: { id: true, name: true } },
    },
  });
}

/** Cree un template de depense recurrente */
export async function createDepenseRecurrente(
  siteId: string,
  userId: string,
  data: CreateDepenseRecurrenteDTO
) {
  const jourDuMois = data.jourDuMois ?? 1;

  if (jourDuMois < 1 || jourDuMois > 28) {
    throw new Error("jourDuMois doit etre compris entre 1 et 28.");
  }

  return prisma.depenseRecurrente.create({
    data: {
      description: data.description,
      categorieDepense: data.categorieDepense,
      montantEstime: data.montantEstime,
      frequence: data.frequence,
      jourDuMois,
      isActive: data.isActive ?? true,
      userId,
      siteId,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });
}

/** Met a jour un template de depense recurrente — R4 : updateMany atomique */
export async function updateDepenseRecurrente(
  id: string,
  siteId: string,
  data: UpdateDepenseRecurrenteDTO
) {
  if (data.jourDuMois !== undefined && (data.jourDuMois < 1 || data.jourDuMois > 28)) {
    throw new Error("jourDuMois doit etre compris entre 1 et 28.");
  }

  const result = await prisma.depenseRecurrente.updateMany({
    where: { id, siteId },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.categorieDepense !== undefined && { categorieDepense: data.categorieDepense }),
      ...(data.montantEstime !== undefined && { montantEstime: data.montantEstime }),
      ...(data.frequence !== undefined && { frequence: data.frequence }),
      ...(data.jourDuMois !== undefined && { jourDuMois: data.jourDuMois }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  if (result.count === 0) {
    throw new Error("Template introuvable ou acces refuse.");
  }

  return prisma.depenseRecurrente.findFirst({
    where: { id, siteId },
    include: { user: { select: { id: true, name: true } } },
  });
}

/** Supprime un template de depense recurrente — R4 : deleteMany atomique */
export async function deleteDepenseRecurrente(id: string, siteId: string) {
  const result = await prisma.depenseRecurrente.deleteMany({
    where: { id, siteId },
  });

  if (result.count === 0) {
    throw new Error("Template introuvable ou acces refuse.");
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Auto-generation
// ---------------------------------------------------------------------------

/**
 * Genere les Depenses dues pour tous les templates actifs du site.
 *
 * Pour chaque template actif :
 * 1. Verifie si la generation est due (frequence + derniereGeneration)
 * 2. Si due : cree une Depense NON_PAYEE avec montantTotal = montantEstime
 * 3. Met a jour derniereGeneration sur le template
 *
 * Idempotent : si appelee plusieurs fois dans le meme mois, ne cree pas de doublon.
 *
 * @param siteId - ID du site (R8)
 * @param userId - Utilisateur declenchant la generation
 * @returns Liste des Depenses generees
 */
export async function genererDepensesRecurrentes(
  siteId: string,
  userId: string
): Promise<{ id: string; numero: string; description: string; montantTotal: number }[]> {
  // Charger tous les templates actifs
  const templates = await prisma.depenseRecurrente.findMany({
    where: { siteId, isActive: true },
  });

  const generated: { id: string; numero: string; description: string; montantTotal: number }[] = [];

  for (const template of templates) {
    // Verifier si la generation est due
    const due = estDue(
      template.frequence as FrequenceRecurrence,
      template.derniereGeneration
    );

    if (!due) continue;

    // Generer dans une transaction — verrou optimiste R4 :
    // On tente d'abord d'acquerir le "verrou" en mettant a jour derniereGeneration
    // uniquement si elle n'a pas change depuis la lecture (condition atomique).
    // Si count === 0, un appel concurrent a deja traite ce template — on skip.
    const depense = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Verrou optimiste : updateMany conditionnel sur derniereGeneration courante
      const locked = await tx.depenseRecurrente.updateMany({
        where: {
          id: template.id,
          derniereGeneration: template.derniereGeneration,
        },
        data: { derniereGeneration: now },
      });

      // Si aucune ligne affectee, un concurrent a deja mis a jour — skip
      if (locked.count === 0) return null;

      // Generer le numero
      const numero = await generateNumeroDepense(tx, siteId);

      // Creer la depense
      return tx.depense.create({
        data: {
          numero,
          description: template.description,
          categorieDepense: template.categorieDepense as CategorieDepense,
          montantTotal: template.montantEstime,
          montantPaye: 0,
          statut: StatutDepense.NON_PAYEE,
          date: now,
          userId,
          siteId,
        },
      });
    });

    if (depense !== null) {
      generated.push({
        id: depense.id,
        numero: depense.numero,
        description: depense.description,
        montantTotal: depense.montantTotal,
      });
    }
  }

  return generated;
}
