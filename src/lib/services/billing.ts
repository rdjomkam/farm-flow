/**
 * src/lib/services/billing.ts
 *
 * Service d'initiation de paiement d'abonnement.
 * Orchestre la création du PaiementAbonnement et l'appel au gateway.
 *
 * ADR-016 : Idempotence + atomicité
 * Story 31.4 — Sprint 31
 * Story 47.3 — Ownership check adapté au user-level (userId au lieu de siteId)
 *
 * R2 : Utiliser les enums importés depuis "@/types"
 * R4 : Opérations atomiques via fonctions de query (updateMany)
 */

import { getPaymentGateway } from "@/lib/payment/factory";
import {
  createPaiementAbonnement,
  getPaiementsByAbonnement,
  getPaiementByReference,
  confirmerPaiement,
  updatePaiementApresInitiation,
} from "@/lib/queries/paiements-abonnements";
import { getAbonnementById, activerAbonnement, logAbonnementAudit } from "@/lib/queries/abonnements";
import { invalidateSubscriptionCaches } from "@/lib/abonnements/invalidate-caches";
import { prisma } from "@/lib/db";
import {
  FournisseurPaiement,
  StatutPaiementAbo,
} from "@/types";
import type { InitierPaiementDTO } from "@/types";

// ---------------------------------------------------------------------------
// Types de retour
// ---------------------------------------------------------------------------

export interface InitierPaiementResult {
  paiementId: string;
  referenceExterne?: string;
  statut: StatutPaiementAbo;
  message?: string;
}

// ---------------------------------------------------------------------------
// initierPaiement — Orchestre création PaiementAbonnement + appel gateway
// ---------------------------------------------------------------------------

/**
 * Initie un paiement pour un abonnement donné.
 *
 * Étapes :
 * 1. Vérifier que l'abonnement appartient au userId (sécurité user-level — Story 47.3)
 * 2. Vérifier l'idempotence (pas de paiement EN_ATTENTE/INITIE existant)
 * 3. Créer un PaiementAbonnement EN_ATTENTE en DB
 * 4. Appeler la gateway pour initier le paiement
 * 5. Mettre à jour le PaiementAbonnement avec referenceExterne + statut INITIE ou ECHEC
 *
 * @param abonnementId - ID de l'abonnement à payer
 * @param userId - ID de l'utilisateur propriétaire de l'abonnement (vérification ownership)
 * @param siteId - ID du site actif (utilisé pour créer le PaiementAbonnement en DB)
 * @param params - Détails du paiement (fournisseur, numéro de téléphone)
 */
export async function initierPaiement(
  abonnementId: string,
  userId: string,
  siteId: string,
  params: InitierPaiementDTO
): Promise<InitierPaiementResult> {
  // Étape 1 : vérifier que l'abonnement appartient à l'utilisateur (user-level — Story 47.3)
  // On ne filtre plus par siteId car l'abonnement est désormais au niveau user.
  // Le siteId reste utilisé pour créer le PaiementAbonnement en DB (compatibilité schéma Sprint 52).
  const abonnement = await getAbonnementById(abonnementId);

  if (!abonnement) {
    return {
      paiementId: "",
      statut: StatutPaiementAbo.ECHEC,
      message: "Abonnement introuvable",
    };
  }

  if (abonnement.userId !== userId) {
    return {
      paiementId: "",
      statut: StatutPaiementAbo.ECHEC,
      message: "Accès refusé : cet abonnement n'appartient pas à cet utilisateur",
    };
  }

  // Étape 2 : vérifier l'idempotence
  // Comparer les statuts comme strings pour éviter le conflit enum Prisma vs TypeScript
  const paiementsExistants = await getPaiementsByAbonnement(abonnementId);
  const paiementEnCours = paiementsExistants.find(
    (p) =>
      (p.statut as string) === StatutPaiementAbo.EN_ATTENTE ||
      (p.statut as string) === StatutPaiementAbo.INITIE
  );

  if (paiementEnCours) {
    // Un paiement est déjà en cours — retourner l'existant (idempotence)
    return {
      paiementId: paiementEnCours.id,
      referenceExterne: paiementEnCours.referenceExterne ?? undefined,
      statut: paiementEnCours.statut as StatutPaiementAbo,
      message: "Paiement en cours — utilisez la référence existante",
    };
  }

  // Étape 3 : créer le PaiementAbonnement EN_ATTENTE en DB
  const montant = Number(abonnement.prixPaye);
  const paiement = await createPaiementAbonnement({
    abonnementId,
    montant,
    fournisseur: params.fournisseur,
    initiePar: userId,
    siteId,
    phoneNumber: params.phoneNumber,
  });

  // Étape 4 : générer la référence interne déterministe
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const referenceInterne = `SUB-${abonnementId}-${yyyymm}`;

  // Étape 5 : appeler la gateway
  const gateway = getPaymentGateway(params.fournisseur);

  try {
    const gatewayResult = await gateway.initiatePayment({
      abonnementId,
      phoneNumber: params.phoneNumber ?? "",
      montant,
      description: `Abonnement FarmFlow — ${abonnement.plan.nom}`,
      referenceInterne,
    });

    if (gatewayResult.statut === "INITIE") {
      // Succès : mettre à jour le paiement avec referenceExterne + statut INITIE
      const paiementMisAJour = await updatePaiementApresInitiation(
        paiement.id,
        gatewayResult.referenceExterne
      );

      // Audit : paiement initié (fire-and-forget — ne pas bloquer la réponse)
      logAbonnementAudit(abonnementId, "PAIEMENT_INITIE", userId, {
        paiementId: paiementMisAJour.id,
        referenceExterne: paiementMisAJour.referenceExterne,
        fournisseur: params.fournisseur,
        montant,
      }).catch((auditError) => {
        console.error("[billing] Erreur logAbonnementAudit (non-bloquant) :", auditError);
      });

      return {
        paiementId: paiementMisAJour.id,
        referenceExterne: paiementMisAJour.referenceExterne ?? undefined,
        statut: StatutPaiementAbo.INITIE,
      };
    } else {
      // Échec gateway — marquer le paiement ECHEC (pas laissé EN_ATTENTE)
      await prisma.paiementAbonnement.updateMany({
        where: { id: paiement.id },
        data: { statut: StatutPaiementAbo.ECHEC },
      });

      return {
        paiementId: paiement.id,
        statut: StatutPaiementAbo.ECHEC,
        message: gatewayResult.message ?? "Échec de l'initiation du paiement",
      };
    }
  } catch (gatewayError) {
    // Erreur inattendue de la gateway — marquer ECHEC atomiquement
    await prisma.paiementAbonnement.updateMany({
      where: { id: paiement.id },
      data: { statut: StatutPaiementAbo.ECHEC },
    });

    return {
      paiementId: paiement.id,
      statut: StatutPaiementAbo.ECHEC,
      message:
        gatewayError instanceof Error
          ? gatewayError.message
          : "Erreur inattendue",
    };
  }
}

// ---------------------------------------------------------------------------
// verifierEtActiverPaiement — Polling manuel si webhook non reçu
// ---------------------------------------------------------------------------

/**
 * Vérifie le statut d'un paiement auprès de la gateway et applique les changements si confirmé.
 * Utilisé pour le polling manuel (cas où le webhook n'arrive pas).
 *
 * @param referenceExterne - Référence externe de la transaction
 * @returns true si le paiement a été confirmé, false sinon
 */
export async function verifierEtActiverPaiement(
  referenceExterne: string
): Promise<boolean> {
  // Récupérer le paiement en DB
  const paiement = await getPaiementByReference(referenceExterne);

  if (!paiement) {
    return false;
  }

  // Déjà confirmé — idempotence (comparer comme string pour éviter conflit enum)
  if ((paiement.statut as string) === StatutPaiementAbo.CONFIRME) {
    return true;
  }

  // Vérifier auprès de la gateway
  // Cast car Prisma génère un enum distinct du TypeScript enum (même valeurs)
  const gateway = getPaymentGateway(paiement.fournisseur as FournisseurPaiement);
  const statusResult = await gateway.checkStatus(referenceExterne);

  if (statusResult.statut !== StatutPaiementAbo.CONFIRME) {
    return false;
  }

  // Confirmer le paiement puis activer l'abonnement (R4 : via fonctions de query updateMany)
  await confirmerPaiement(referenceExterne);
  await activerAbonnement(paiement.abonnementId);

  // Invalider le cache d'abonnement user-level + sites (Story 47.3)
  // paiement.abonnement est inclus par getPaiementByReference (include: { abonnement: true })
  if (paiement.abonnement?.userId) {
    await invalidateSubscriptionCaches(paiement.abonnement.userId);
  }

  return true;
}
