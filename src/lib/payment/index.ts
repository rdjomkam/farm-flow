/**
 * src/lib/payment/index.ts
 *
 * Barrel export — couche d'abstraction des passerelles de paiement.
 *
 * Usage recommandé :
 * import { getPaymentGateway, type PaymentGateway } from "@/lib/payment";
 *
 * Sprint 31 — Story 31.1
 */

// Types et interfaces
export type {
  PaymentGateway,
  PaymentInitiateParams,
  PaymentInitiateResult,
  PaymentStatusResult,
  WebhookPayload,
  WebhookResult,
} from "./types";

// Factory
export { getPaymentGateway } from "./factory";

// Implémentations
export { ManualGateway } from "./manual-gateway";
export { SmobilpayGateway } from "./smobilpay-gateway";
