/**
 * src/lib/payment/types.ts
 *
 * Interfaces TypeScript pour l'abstraction des passerelles de paiement.
 * Source de vérité pour toutes les implémentations de gateway.
 *
 * Décision architecturale : ADR-016 (docs/decisions/016-payment-gateway-abstraction.md)
 * Sprint 31 — Story 31.1
 *
 * R2 : Importer les enums depuis "@/types"
 * R7 : Nullabilité explicite sur tous les champs optionnels
 */

import { FournisseurPaiement, StatutPaiementAbo } from "@/types";

// ---------------------------------------------------------------------------
// Paramètres d'initiation de paiement
// ---------------------------------------------------------------------------

/**
 * Paramètres pour initier un paiement USSD push via Mobile Money.
 * Utilisé par toutes les implémentations de PaymentGateway.
 */
export interface PaymentInitiateParams {
  /** ID de l'abonnement lié à ce paiement */
  abonnementId: string;
  /** Numéro Mobile Money du payeur (format international : +237699000000) */
  phoneNumber: string;
  /** Montant en FCFA (entier — pas de centimes au Cameroun) */
  montant: number;
  /** Description affichée sur le téléphone du client (USSD) */
  description: string;
  /** Référence interne déterministe côté app (ex: SUB-{abonnementId}-{YYYYMM}) */
  referenceInterne: string;
  /** Métadonnées supplémentaires optionnelles (passées à la gateway) */
  metadata?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Résultats de l'initiation
// ---------------------------------------------------------------------------

/**
 * Résultat d'une initiation de paiement.
 * Le statut INITIE signifie que la demande USSD push a été envoyée.
 * Le client doit valider sur son téléphone — confirmation via webhook.
 */
export interface PaymentInitiateResult {
  /** Référence externe attribuée par la gateway (ex: payToken Smobilpay) */
  referenceExterne: string;
  /** Statut initial : INITIE = envoyé au client, ECHEC = erreur immédiate */
  statut: "INITIE" | "ECHEC";
  /** Message d'erreur en cas d'ECHEC */
  message?: string;
  /** URL de redirection si la gateway utilise un flow web (non USSD) */
  redirectUrl?: string;
}

// ---------------------------------------------------------------------------
// Résultat de vérification de statut
// ---------------------------------------------------------------------------

/**
 * Résultat d'une vérification de statut de paiement.
 * Utilisé pour le polling ou après réception d'un webhook.
 */
export interface PaymentStatusResult {
  /** Référence externe de la transaction (cohérente avec l'initiation) */
  referenceExterne: string;
  /** Statut actuel — R2 : utiliser StatutPaiementAbo.CONFIRME */
  statut: StatutPaiementAbo;
  /** Montant confirmé en FCFA (peut différer si frais gateway) */
  montant?: number;
  /** Date de confirmation par le client (undefined si pas encore confirmé) */
  confirmedAt?: Date;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * Payload d'un webhook entrant d'une gateway de paiement.
 * Inclut le body brut (nécessaire pour la vérification HMAC de la signature).
 */
export interface WebhookPayload {
  /** Référence externe de la transaction concernée */
  referenceExterne: string;
  /** Nouveau statut selon la gateway (mapping vers StatutPaiementAbo dans processWebhook) */
  statut: string;
  /** Signature HMAC fournie par la gateway dans les headers */
  signature: string;
  /** Body HTTP brut (string) — nécessaire pour HMAC-SHA256 */
  rawBody: string;
  /** Headers HTTP de la requête webhook */
  headers: Record<string, string>;
}

/**
 * Résultat du traitement d'un webhook.
 * success=false signifie signature invalide ou paiement déjà traité (idempotence).
 */
export interface WebhookResult {
  /** true = traitement effectué, false = ignoré (idempotence ou erreur signature) */
  success: boolean;
  /** Référence externe extraite du webhook (si success=true) */
  referenceExterne?: string;
  /** Statut extrait et mappé (si success=true) — R2 : StatutPaiementAbo.CONFIRME */
  statut?: StatutPaiementAbo;
}

// ---------------------------------------------------------------------------
// Interface principale
// ---------------------------------------------------------------------------

/**
 * Interface d'abstraction des passerelles de paiement Mobile Money.
 *
 * Implémentations :
 * - Phase 1 : SmobilpayGateway (agrégateur MTN + Orange), ManualGateway
 * - Phase 2 : MtnMomoGateway, OrangeMoneyGateway (direct)
 *
 * ADR-016 : Factory pattern via getPaymentGateway(fournisseur)
 */
export interface PaymentGateway {
  /** Identifie la gateway — R2 : FournisseurPaiement.SMOBILPAY */
  readonly fournisseur: FournisseurPaiement;

  /**
   * Initie un paiement USSD push.
   * Le client reçoit une invitation USSD sur son téléphone.
   * La confirmation arrive via webhook (asynchrone).
   */
  initiatePayment(params: PaymentInitiateParams): Promise<PaymentInitiateResult>;

  /**
   * Vérifie le statut d'une transaction existante.
   * Utilisé pour le polling si le webhook n'arrive pas.
   */
  checkStatus(referenceExterne: string): Promise<PaymentStatusResult>;

  /**
   * Traite un webhook entrant de la gateway.
   * DOIT appeler verifySignature() en interne avant tout traitement.
   */
  processWebhook(payload: WebhookPayload): Promise<WebhookResult>;

  /**
   * Vérifie la signature HMAC d'un webhook.
   * Appelé avant tout traitement DB pour éviter les fraudes.
   * Doit utiliser la clé secrète depuis .env (SMOBILPAY_WEBHOOK_SECRET, etc.)
   */
  verifySignature(rawBody: string, signature: string): boolean;
}
