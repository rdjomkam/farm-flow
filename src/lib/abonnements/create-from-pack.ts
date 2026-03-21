/**
 * src/lib/abonnements/create-from-pack.ts
 *
 * Crée ou renouvelle un Abonnement lors de l'activation d'un Pack.
 *
 * Story 44.4 — Sprint 44
 * R2 : enums importés depuis @/types
 * R4 : toutes les opérations DB dans une transaction Prisma atomique
 * R7 : prixMensuel nullable (DECOUVERTE = 0)
 * R8 : siteId obligatoire sur Abonnement
 */

import { prisma } from "@/lib/db";
import { PeriodeFacturation, StatutAbonnement, TypePlan } from "@/types";
import { applyPlanModulesTx } from "@/lib/abonnements/apply-plan-modules";
import type { Abonnement } from "@/types";

/** Type interne — client transactionnel Prisma */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Calcule la date de fin selon la période de facturation.
 * @param from - Date de départ (dateDebut)
 * @param periode - Période de facturation
 */
function calculateDateFin(from: Date, periode: PeriodeFacturation): Date {
  const d = new Date(from);
  switch (periode) {
    case PeriodeFacturation.MENSUEL:
      d.setMonth(d.getMonth() + 1);
      break;
    case PeriodeFacturation.TRIMESTRIEL:
      d.setMonth(d.getMonth() + 3);
      break;
    case PeriodeFacturation.ANNUEL:
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

/**
 * Calcule le prix à payer pour un plan et une période donnés.
 * R7 : prixMensuel / prixTrimestriel / prixAnnuel peuvent être null (plan DECOUVERTE).
 * Si null → retourne 0.
 */
function calculatePrixPaye(
  plan: { typePlan: string; prixMensuel: unknown; prixTrimestriel: unknown; prixAnnuel: unknown },
  periode: PeriodeFacturation
): number {
  // DECOUVERTE est gratuit
  if (plan.typePlan === TypePlan.DECOUVERTE) return 0;

  switch (periode) {
    case PeriodeFacturation.MENSUEL:
      return plan.prixMensuel != null ? Number(plan.prixMensuel) : 0;
    case PeriodeFacturation.TRIMESTRIEL:
      return plan.prixTrimestriel != null ? Number(plan.prixTrimestriel) : 0;
    case PeriodeFacturation.ANNUEL:
      return plan.prixAnnuel != null ? Number(plan.prixAnnuel) : 0;
  }
}

/**
 * Crée ou renouvelle un Abonnement pour un site à partir d'un Pack activé.
 *
 * Comportement :
 * - Si le site a déjà un abonnement ACTIF sur le même plan → renouvellement (dateFin étendue).
 * - Si le site a un abonnement ACTIF sur un plan différent → annulation de l'ancien, création du nouveau.
 * - Sinon → création directe.
 *
 * L'activation d'un pack ne nécessite pas de paiement préalable :
 * le statut est positionné à ACTIF directement.
 *
 * @param siteId - ID du site client (R8)
 * @param packId - ID du Pack activé
 * @param userId - ID de l'utilisateur souscripteur/activateur
 * @param periode - Période de facturation (défaut : MENSUEL)
 * @returns Abonnement créé ou renouvelé
 */
export async function createAbonnementFromPack(
  siteId: string,
  packId: string,
  userId: string,
  periode: PeriodeFacturation = PeriodeFacturation.MENSUEL
): Promise<Abonnement> {
  return prisma.$transaction(async (tx) => {
    // 1. Charger le pack avec son plan
    const pack = await tx.pack.findUnique({
      where: { id: packId },
      include: { plan: true },
    });

    if (!pack) {
      throw new Error(`[createAbonnementFromPack] Pack ${packId} introuvable`);
    }

    if (!pack.plan) {
      throw new Error(
        `[createAbonnementFromPack] Pack ${packId} n'a pas de plan associé`
      );
    }

    const plan = pack.plan;

    // 2. Vérifier si le site a déjà un abonnement actif
    const abonnementExistant = await tx.abonnement.findFirst({
      where: {
        siteId,
        statut: { in: [StatutAbonnement.ACTIF, StatutAbonnement.EN_GRACE] },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    let abonnement;

    if (abonnementExistant) {
      if (abonnementExistant.planId === plan.id) {
        // Même plan → renouvellement : on étend la dateFin à partir de la dateFin actuelle
        const baseDate =
          abonnementExistant.dateFin > now ? abonnementExistant.dateFin : now;
        const newDateFin = calculateDateFin(baseDate, periode);

        abonnement = await tx.abonnement.update({
          where: { id: abonnementExistant.id },
          data: {
            statut: StatutAbonnement.ACTIF,
            dateFin: newDateFin,
            dateProchainRenouvellement: newDateFin,
            dateFinGrace: null,
          },
        });
      } else {
        // Plan différent → annuler l'ancien, créer le nouveau
        await tx.abonnement.update({
          where: { id: abonnementExistant.id },
          data: { statut: StatutAbonnement.ANNULE },
        });

        const dateFin = calculateDateFin(now, periode);
        const prixPaye = calculatePrixPaye(plan, periode);

        abonnement = await tx.abonnement.create({
          data: {
            siteId,
            planId: plan.id,
            periode,
            statut: StatutAbonnement.ACTIF,
            dateDebut: now,
            dateFin,
            dateProchainRenouvellement: dateFin,
            dateFinGrace: null,
            prixPaye,
            userId,
            remiseId: null,
          },
        });
      }
    } else {
      // Aucun abonnement actif → création directe
      const dateFin = calculateDateFin(now, periode);
      const prixPaye = calculatePrixPaye(plan, periode);

      abonnement = await tx.abonnement.create({
        data: {
          siteId,
          planId: plan.id,
          periode,
          statut: StatutAbonnement.ACTIF,
          dateDebut: now,
          dateFin,
          dateProchainRenouvellement: dateFin,
          dateFinGrace: null,
          prixPaye,
          userId,
          remiseId: null,
        },
      });
    }

    // 3. Appliquer les modules du plan sur le site (dans la transaction)
    await applyPlanModulesTx(tx, siteId, plan.id);

    console.log(
      `[createAbonnementFromPack] Site ${siteId} — abonnement ${abonnement.id} (${plan.typePlan}, ${periode}) — statut: ${abonnement.statut}`
    );

    // Convertir Decimal → number pour aligner avec l'interface Abonnement (R3)
    return {
      ...abonnement,
      prixPaye: Number(abonnement.prixPaye),
    } as Abonnement;
  });
}
