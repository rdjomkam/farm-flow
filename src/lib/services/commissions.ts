/**
 * src/lib/services/commissions.ts
 *
 * Service de calcul et création des commissions ingénieur.
 * Déclenché automatiquement après confirmation d'un paiement d'abonnement.
 *
 * R2 : Importer les enums depuis "@/types"
 * R4 : Opérations atomiques via les queries (pas de check-then-update)
 * R8 : siteId obligatoire sur CommissionIngenieur (site DKFarm de l'ingénieur)
 *
 * Story 34.1 — Sprint 34
 */

import { prisma } from "@/lib/db";
import { Role, Permission, StatutCommissionIng } from "@/types";
import { createCommission, rendreCommissionsDisponibles } from "@/lib/queries/commissions";
import { getPlatformSite } from "@/lib/queries/sites";
import { COMMISSION_TAUX_DEFAULT, COMMISSION_TAUX_PREMIUM } from "@/lib/abonnements-constants";

// ---------------------------------------------------------------------------
// calculerEtCreerCommission
// ---------------------------------------------------------------------------

/**
 * Calcule et crée la commission de l'ingénieur superviseur suite à un paiement confirmé.
 *
 * Logique :
 * 1. Vérifier que le site client est supervisé (supervised = true)
 * 2. Trouver l'ingénieur superviseur (SiteMember avec user.role = INGENIEUR)
 * 3. Déterminer le taux selon la permission COMMISSION_PREMIUM
 * 4. Idempotence : retourner null si une commission existe déjà pour ce paiement
 * 5. Créer CommissionIngenieur EN_ATTENTE
 *
 * @param abonnementId - ID de l'abonnement concerné
 * @param paiementId - ID du PaiementAbonnement (idempotence clé)
 * @param siteClientId - ID du site client qui a payé
 * @returns Commission créée ou null si pas d'ingénieur superviseur / déjà créée
 */
export async function calculerEtCreerCommission(
  abonnementId: string,
  paiementId: string,
  siteClientId: string
): Promise<{ id: string; montant: number; taux: number; ingenieurId: string } | null> {
  try {
    // Étape 1 : Vérifier que le site est supervisé
    const site = await prisma.site.findUnique({
      where: { id: siteClientId },
      select: { id: true, supervised: true },
    });

    if (!site?.supervised) {
      // Site non supervisé → pas de commission
      return null;
    }

    // Étape 2 : Trouver l'ingénieur superviseur via SiteMember
    const membreIngenieur = await prisma.siteMember.findFirst({
      where: {
        siteId: siteClientId,
        isActive: true,
        user: {
          role: Role.INGENIEUR,
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
        siteRole: {
          select: {
            id: true,
            permissions: true,
          },
        },
      },
    });

    if (!membreIngenieur) {
      // Pas d'ingénieur membre actif sur ce site
      return null;
    }

    const ingenieurId = membreIngenieur.user.id;

    // Idempotence : vérifier qu'une commission n'existe pas déjà pour ce paiement
    const commissionExistante = await prisma.commissionIngenieur.findFirst({
      where: { paiementAbonnementId: paiementId },
      select: { id: true },
    });

    if (commissionExistante) {
      // Commission déjà créée — retourner null (idempotence)
      return null;
    }

    // Étape 3 : Déterminer le taux selon la permission COMMISSION_PREMIUM
    const hasPremium = membreIngenieur.siteRole.permissions.includes(
      Permission.COMMISSION_PREMIUM as unknown as (typeof membreIngenieur.siteRole.permissions)[0]
    );
    const taux = hasPremium ? COMMISSION_TAUX_PREMIUM : COMMISSION_TAUX_DEFAULT;

    // Étape 4 : Charger le paiement pour obtenir le montant et les dates de période
    const paiement = await prisma.paiementAbonnement.findUnique({
      where: { id: paiementId },
      select: {
        id: true,
        montant: true,
        siteId: true,
        abonnement: {
          select: {
            dateDebut: true,
            dateFin: true,
          },
        },
      },
    });

    if (!paiement) {
      return null;
    }

    // Étape 5 : Calculer le montant de la commission
    const montant = Number(paiement.montant) * taux;

    // Étape 6 : BUG-029 — CommissionIngenieur est une entité plateforme.
    // Le siteId DOIT être celui du site plateforme DKFarm, pas le site client.
    const platformSite = await getPlatformSite();
    if (!platformSite) {
      console.error("[commissions.service] Site plateforme introuvable — impossible de créer la commission.");
      return null;
    }
    const ingenieurSiteId = platformSite.id;

    // Étape 7 : Créer la commission EN_ATTENTE
    const commission = await createCommission({
      ingenieurId,
      siteClientId,
      abonnementId,
      paiementAbonnementId: paiementId,
      montant,
      taux,
      periodeDebut: paiement.abonnement.dateDebut,
      periodeFin: paiement.abonnement.dateFin,
      siteId: ingenieurSiteId,
    });

    return {
      id: commission.id,
      montant: Number(commission.montant),
      taux: Number(commission.taux),
      ingenieurId,
    };
  } catch (error) {
    // Ne pas propager l'erreur — fire-and-forget dans le webhook
    console.error("[commissions.service] Erreur lors du calcul de commission :", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// rendreCommissionsDisponibles (CRON J+30)
// ---------------------------------------------------------------------------

/**
 * Rend disponibles toutes les commissions EN_ATTENTE créées il y a plus de 30 jours.
 * Destiné au CRON job mensuel.
 *
 * @returns Nombre de commissions rendues disponibles
 */
export async function rendreCommissionsDisponiblesCron(): Promise<number> {
  const dateAvant = new Date();
  dateAvant.setDate(dateAvant.getDate() - 30);
  const result = await rendreCommissionsDisponibles(dateAvant);
  return result.count;
}
