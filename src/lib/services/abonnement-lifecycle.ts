/**
 * src/lib/services/abonnement-lifecycle.ts
 *
 * Service de gestion du cycle de vie des abonnements.
 * Utilisé par le CRON job quotidien pour les transitions automatiques de statut.
 *
 * ADR-017 : Cycle de vie ACTIF → EN_GRACE → SUSPENDU → EXPIRE
 * Story 31.4 — Sprint 31
 * Sprint 36 : CRON job principal + rappels email/SMS
 *
 * R4 : Toutes les transitions via updateMany avec condition (atomique)
 */

import { prisma } from "@/lib/db";
import {
  getAbonnementsEnGraceExpires,
} from "@/lib/queries/abonnements";
import { StatutAbonnement } from "@/types";
import { GRACE_PERIOD_JOURS, SUSPENSION_JOURS } from "@/lib/abonnements-constants";

// ---------------------------------------------------------------------------
// Types de résultat
// ---------------------------------------------------------------------------

export interface TransitionStatutsResult {
  /** Abonnements passés ACTIF → EN_GRACE (expirés sans grâce) */
  graces: number;
  /** Abonnements passés EN_GRACE → SUSPENDU */
  suspendus: number;
  /** Abonnements passés SUSPENDU → EXPIRE */
  expires: number;
}

// ---------------------------------------------------------------------------
// transitionnerStatuts — Exécuté par le CRON job quotidien
// ---------------------------------------------------------------------------

/**
 * Applique toutes les transitions automatiques de statut.
 * Appelé quotidiennement (00:00 UTC selon ADR-017).
 *
 * Ordre des transitions :
 * 1. ACTIF → EN_GRACE (dateFin < maintenant)
 * 2. EN_GRACE → SUSPENDU (dateFinGrace < maintenant)
 * 3. SUSPENDU → EXPIRE (dateFin + GRACE_PERIOD + SUSPENSION < maintenant)
 *
 * @returns Nombre d'abonnements affectés par type de transition
 */
export async function transitionnerStatuts(): Promise<TransitionStatutsResult> {
  const maintenant = new Date();

  // Transition 1 : ACTIF → EN_GRACE
  // Abonnements dont la dateFin est dépassée et pas encore en grâce
  const dateFinGrace = new Date(maintenant);
  dateFinGrace.setDate(dateFinGrace.getDate() + GRACE_PERIOD_JOURS);

  // R2 : utiliser StatutAbonnement.ACTIF depuis "@/types"
  const { count: graces } = await prisma.abonnement.updateMany({
    where: {
      statut: StatutAbonnement.ACTIF,
      dateFin: { lt: maintenant },
    },
    data: {
      statut: StatutAbonnement.EN_GRACE,
      dateFinGrace,
    },
  });

  // Transition 2 : EN_GRACE → SUSPENDU
  // Abonnements dont la période de grâce est expirée
  // R4 : Envelopper dans prisma.$transaction() pour garantir l'atomicité
  // complète — un crash en milieu de boucle ne laisse plus d'état partiel.
  const abonnementsEnGraceExpires = await getAbonnementsEnGraceExpires();
  let suspendus = 0;

  if (abonnementsEnGraceExpires.length > 0) {
    const counts = await prisma.$transaction(
      abonnementsEnGraceExpires.map((abo) =>
        prisma.abonnement.updateMany({
          where: {
            id: abo.id,
            statut: StatutAbonnement.EN_GRACE,
            dateFinGrace: { lt: maintenant },
          },
          data: { statut: StatutAbonnement.SUSPENDU },
        })
      )
    );
    suspendus = counts.reduce((acc, result) => acc + result.count, 0);
  }

  // Transition 3 : SUSPENDU → EXPIRE
  // Abonnements suspendus depuis plus de SUSPENSION_JOURS
  // = dateFin + GRACE_PERIOD_JOURS + SUSPENSION_JOURS < maintenant
  const limiteSuspension = new Date(maintenant);
  limiteSuspension.setDate(
    limiteSuspension.getDate() - (GRACE_PERIOD_JOURS + SUSPENSION_JOURS)
  );

  const { count: expires } = await prisma.abonnement.updateMany({
    where: {
      statut: StatutAbonnement.SUSPENDU,
      dateFin: { lt: limiteSuspension },
    },
    data: { statut: StatutAbonnement.EXPIRE },
  });

  return { graces, suspendus, expires };
}

// ---------------------------------------------------------------------------
// getAbonnementsExpirantProchainement — Pour les rappels (Sprint 36)
// ---------------------------------------------------------------------------

/**
 * Retourne les abonnements ACTIF qui expirent dans X jours.
 * Utilisé par le CRON job de rappels (J-14, J-7, J-3, J-1).
 *
 * @param joursAvant - Nombre de jours avant expiration (ex: 7)
 */
export async function getAbonnementsExpirantDans(joursAvant: number) {
  const maintenant = new Date();
  const limite = new Date(maintenant);
  limite.setDate(limite.getDate() + joursAvant);

  return prisma.abonnement.findMany({
    where: {
      statut: StatutAbonnement.ACTIF,
      dateFin: {
        gte: maintenant,
        lt: limite,
      },
    },
    include: {
      plan: { select: { nom: true, typePlan: true } },
      site: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
}
