/**
 * src/lib/payment/manual-gateway.ts
 *
 * Gateway de paiement manuel — pour les paiements confirmés directement par un admin DKFarm.
 * Utilisé pour les tests, les cas de support, et les paiements hors-ligne.
 *
 * ADR-016 : Phase 1 — ManualGateway implémente l'interface PaymentGateway
 * Sprint 31 — Story 31.1
 *
 * R2 : Utilise FournisseurPaiement.MANUEL (pas la string "MANUEL")
 */

import { FournisseurPaiement, StatutPaiementAbo } from "@/types";
import type {
  PaymentGateway,
  PaymentInitiateParams,
  PaymentInitiateResult,
  PaymentStatusResult,
  WebhookPayload,
  WebhookResult,
} from "./types";

/**
 * ManualGateway — Paiement confirmé manuellement par un admin.
 *
 * Comportement :
 * - initiatePayment : retourne toujours INITIE (pas d'appel réseau)
 * - checkStatus : retourne toujours CONFIRME (admin a validé)
 * - processWebhook : retourne { success: false } — pas de webhook pour les manuels
 * - verifySignature : retourne toujours true — pas de clé secrète pour manuel
 */
export class ManualGateway implements PaymentGateway {
  readonly fournisseur = FournisseurPaiement.MANUEL;

  /**
   * Initie un "paiement" manuel.
   * Pas d'appel réseau — retourne immédiatement INITIE.
   * La confirmation se fait via la route POST /api/webhooks/manuel (admin uniquement).
   */
  async initiatePayment(
    params: PaymentInitiateParams
  ): Promise<PaymentInitiateResult> {
    return {
      referenceExterne: params.referenceInterne,
      statut: "INITIE",
    };
  }

  /**
   * Vérifie le statut d'un paiement manuel.
   * Retourne toujours CONFIRME — un paiement manuel est censé avoir été
   * validé par l'admin avant cette vérification.
   */
  async checkStatus(referenceExterne: string): Promise<PaymentStatusResult> {
    return {
      referenceExterne,
      statut: StatutPaiementAbo.CONFIRME,
      confirmedAt: new Date(),
    };
  }

  /**
   * Traitement webhook — Non applicable pour les paiements manuels.
   * Retourne toujours { success: false }.
   * La confirmation manuelle passe par la route /api/webhooks/manuel (admin).
   */
  async processWebhook(_payload: WebhookPayload): Promise<WebhookResult> {
    return { success: false };
  }

  /**
   * Vérification de signature — Non applicable pour les paiements manuels.
   * Retourne toujours true car la route /api/webhooks/manuel est protégée
   * par l'authentification admin (Permission.ABONNEMENTS_GERER).
   */
  verifySignature(_rawBody: string, _signature: string): boolean {
    return true;
  }
}
