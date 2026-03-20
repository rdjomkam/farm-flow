/**
 * src/lib/payment/factory.ts
 *
 * Factory pattern pour les gateways de paiement.
 * Retourne l'instance de PaymentGateway selon le FournisseurPaiement.
 *
 * ADR-016 : getPaymentGateway(fournisseur) — point d'entrée unique
 * Sprint 31 — Story 31.1
 *
 * Phase 1 : SMOBILPAY + MANUEL
 * Phase 2 : MTN_MOMO + ORANGE_MONEY (commenté)
 *
 * R2 : Utiliser FournisseurPaiement.SMOBILPAY (pas "SMOBILPAY")
 */

import { FournisseurPaiement } from "@/types";
import type { PaymentGateway } from "./types";
import { ManualGateway } from "./manual-gateway";
import { SmobilpayGateway } from "./smobilpay-gateway";

/**
 * getPaymentGateway — Factory qui retourne la bonne implémentation.
 *
 * @param fournisseur - R2 : utiliser FournisseurPaiement.SMOBILPAY
 * @returns Instance de PaymentGateway
 * @throws Error si le fournisseur n'est pas implémenté en Phase 1
 *
 * @example
 * const gateway = getPaymentGateway(FournisseurPaiement.SMOBILPAY);
 * const result = await gateway.initiatePayment(params);
 */
export function getPaymentGateway(
  fournisseur: FournisseurPaiement
): PaymentGateway {
  switch (fournisseur) {
    case FournisseurPaiement.SMOBILPAY:
      return new SmobilpayGateway();

    case FournisseurPaiement.MANUEL:
      return new ManualGateway();

    // Phase 2 — à décommenter quand les gateways directs seront implémentés
    // case FournisseurPaiement.MTN_MOMO:
    //   return new MtnMomoGateway();
    // case FournisseurPaiement.ORANGE_MONEY:
    //   return new OrangeMoneyGateway();

    default:
      throw new Error(
        `Gateway non implémenté : ${fournisseur}. ` +
          `Fournisseurs supportés en Phase 1 : SMOBILPAY, MANUEL.`
      );
  }
}
