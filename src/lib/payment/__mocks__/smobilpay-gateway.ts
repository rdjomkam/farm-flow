/**
 * src/lib/payment/__mocks__/smobilpay-gateway.ts
 *
 * Mock du SmobilpayGateway pour les tests unitaires et d'intégration.
 * Retourne des réponses prédéfinies sans appels HTTP réels.
 *
 * Usage dans les tests :
 * vi.mock("@/lib/payment/smobilpay-gateway");
 * // ou
 * import { MockSmobilpayGateway } from "@/lib/payment/__mocks__/smobilpay-gateway";
 *
 * Sprint 31 — Story 31.2
 */

import { FournisseurPaiement, StatutPaiementAbo } from "@/types";
import type {
  PaymentGateway,
  PaymentInitiateParams,
  PaymentInitiateResult,
  PaymentStatusResult,
  WebhookPayload,
  WebhookResult,
} from "../types";

/**
 * Scénarios de test disponibles pour le mock.
 */
export type SmobilpayMockScenario =
  | "success" // initiatePayment → INITIE, checkStatus → CONFIRME
  | "failure" // initiatePayment → ECHEC
  | "timeout" // initiatePayment → ECHEC (message: "Timeout")
  | "pending"; // checkStatus → EN_ATTENTE

/**
 * MockSmobilpayGateway — Gateway de test configurable.
 * Pas d'appels réseau, retourne des données prédéfinies.
 */
export class MockSmobilpayGateway implements PaymentGateway {
  readonly fournisseur = FournisseurPaiement.SMOBILPAY;

  constructor(
    private readonly scenario: SmobilpayMockScenario = "success",
    private readonly webhookSignatureValid: boolean = true
  ) {}

  async initiatePayment(
    params: PaymentInitiateParams
  ): Promise<PaymentInitiateResult> {
    switch (this.scenario) {
      case "failure":
        return {
          referenceExterne: params.referenceInterne,
          statut: "ECHEC",
          message: "Solde insuffisant",
        };
      case "timeout":
        return {
          referenceExterne: params.referenceInterne,
          statut: "ECHEC",
          message: "Timeout : impossible de joindre Smobilpay",
        };
      default: // success, pending
        return {
          referenceExterne: `mock-paytoken-${params.referenceInterne}`,
          statut: "INITIE",
        };
    }
  }

  async checkStatus(referenceExterne: string): Promise<PaymentStatusResult> {
    if (this.scenario === "pending") {
      return {
        referenceExterne,
        statut: StatutPaiementAbo.EN_ATTENTE,
      };
    }

    return {
      referenceExterne,
      statut: StatutPaiementAbo.CONFIRME,
      montant: 8000,
      confirmedAt: new Date("2026-03-20T10:00:00Z"),
    };
  }

  verifySignature(
    _rawBody: string,
    _signature: string
  ): boolean {
    return this.webhookSignatureValid;
  }

  async processWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    if (!this.verifySignature(payload.rawBody, payload.signature)) {
      return { success: false };
    }

    return {
      success: true,
      referenceExterne: payload.referenceExterne,
      statut: StatutPaiementAbo.CONFIRME,
    };
  }
}

/**
 * Mock par défaut de SmobilpayGateway (scenario "success").
 * Utilisé par vi.mock() automatique.
 */
export const SmobilpayGateway = MockSmobilpayGateway;
