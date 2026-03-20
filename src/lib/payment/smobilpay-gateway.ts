/**
 * src/lib/payment/smobilpay-gateway.ts
 *
 * Gateway Smobilpay/Maviance — agrégateur Mobile Money camerounais (MTN + Orange).
 * Implémentation complète.
 *
 * API Maviance (documentation publique) :
 * - POST /api/v1/cashin — initier un paiement USSD push
 * - GET /api/v1/cashin/{payToken} — vérifier le statut
 * - Webhook : POST sur l'URL configurée dans le dashboard Maviance
 *
 * ADR-016 : Phase 1 — SmobilpayGateway
 * Sprint 31 — Story 31.2
 *
 * Variables d'environnement requises :
 * - SMOBILPAY_API_KEY
 * - SMOBILPAY_API_SECRET
 * - SMOBILPAY_BASE_URL (https://api.smobilpay.com/v1)
 * - SMOBILPAY_WEBHOOK_SECRET
 * - SMOBILPAY_SANDBOX (true = sandbox)
 *
 * R2 : Utilise FournisseurPaiement.SMOBILPAY (jamais "SMOBILPAY")
 */

import crypto from "crypto";
import { FournisseurPaiement, StatutPaiementAbo } from "@/types";
import type {
  PaymentGateway,
  PaymentInitiateParams,
  PaymentInitiateResult,
  PaymentStatusResult,
  WebhookPayload,
  WebhookResult,
} from "./types";

// ---------------------------------------------------------------------------
// Types internes Smobilpay/Maviance
// ---------------------------------------------------------------------------

interface SmobilpayCashinResponse {
  /** ID de transaction Maviance — devient notre referenceExterne */
  payToken: string;
  /** Statut initial ("pending", "initiated", etc.) */
  status: string;
  /** Message d'erreur si échec */
  message?: string;
  /** Code d'erreur si échec */
  code?: string;
}

interface SmobilpayCashinStatusResponse {
  payToken: string;
  status: string; // "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED"
  amount?: number;
  /** ISO 8601 si confirmé */
  confirmedAt?: string;
}

interface SmobilpayWebhookBody {
  payToken: string;
  status: string; // "SUCCESS" | "FAILED" | "EXPIRED"
  amount?: number;
  confirmedAt?: string;
}

// ---------------------------------------------------------------------------
// Mapping statuts Smobilpay → StatutPaiementAbo
// ---------------------------------------------------------------------------

function mapSmobilpayStatus(status: string): StatutPaiementAbo {
  const normalized = status.toUpperCase();
  switch (normalized) {
    case "PENDING":
      return StatutPaiementAbo.EN_ATTENTE;
    case "INITIATED":
      return StatutPaiementAbo.INITIE;
    case "SUCCESS":
      return StatutPaiementAbo.CONFIRME;
    case "FAILED":
      return StatutPaiementAbo.ECHEC;
    case "EXPIRED":
      return StatutPaiementAbo.EXPIRE;
    default:
      // Statut inconnu → considéré en attente (conservative)
      return StatutPaiementAbo.EN_ATTENTE;
  }
}

// ---------------------------------------------------------------------------
// Helper : sleep pour retry
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// SmobilpayGateway
// ---------------------------------------------------------------------------

/**
 * SmobilpayGateway — Intégration Smobilpay/Maviance Phase 1.
 *
 * Architecture USSD push :
 * 1. `initiatePayment()` → POST /cashin → client reçoit USSD push
 * 2. Client valide sur son téléphone
 * 3. Maviance appelle notre webhook → `processWebhook()` → confirmerPaiement()
 * 4. En cas de timeout : `checkStatus()` pour polling manuel
 */
export class SmobilpayGateway implements PaymentGateway {
  readonly fournisseur = FournisseurPaiement.SMOBILPAY;

  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly webhookSecret: string;
  private readonly isSandbox: boolean;

  constructor() {
    this.apiKey = process.env.SMOBILPAY_API_KEY ?? "";
    this.apiSecret = process.env.SMOBILPAY_API_SECRET ?? "";
    this.webhookSecret = process.env.SMOBILPAY_WEBHOOK_SECRET ?? "";
    this.isSandbox = process.env.SMOBILPAY_SANDBOX === "true";

    // URL sandbox ou production selon SMOBILPAY_SANDBOX
    const defaultBaseUrl = this.isSandbox
      ? "https://sandbox.smobilpay.com/v1"
      : "https://api.smobilpay.com/v1";
    this.baseUrl = process.env.SMOBILPAY_BASE_URL ?? defaultBaseUrl;
  }

  /**
   * Construit les headers d'authentification Basic pour l'API Maviance.
   * Maviance utilise HTTP Basic Auth : base64(apiKey:apiSecret)
   */
  private getAuthHeaders(): Record<string, string> {
    const credentials = Buffer.from(
      `${this.apiKey}:${this.apiSecret}`
    ).toString("base64");
    return {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Exécute une requête HTTP avec 1 retry automatique en cas d'erreur réseau.
   * Délai de 2s entre les tentatives (ADR-016 : retry logic).
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    try {
      return await fetch(url, options);
    } catch (firstError) {
      // 1 seul retry avec délai 2s
      await sleep(2000);
      try {
        return await fetch(url, options);
      } catch {
        // Les deux tentatives ont échoué — propager une erreur descriptive
        throw new Error(
          `Smobilpay : impossible de joindre ${url} après 2 tentatives — ${firstError}`
        );
      }
    }
  }

  /**
   * Initie un paiement USSD push via Smobilpay/Maviance.
   * POST {baseUrl}/cashin
   *
   * En cas d'erreur réseau après retry, retourne { statut: "ECHEC", message: "Timeout" }
   * plutôt que de propager l'exception (ADR-016 : fail gracefully).
   */
  async initiatePayment(
    params: PaymentInitiateParams
  ): Promise<PaymentInitiateResult> {
    const body = {
      phoneNumber: params.phoneNumber,
      amount: params.montant,
      externalRef: params.referenceInterne,
      description: params.description,
      ...(params.metadata && { metadata: params.metadata }),
    };

    let response: Response;
    try {
      response = await this.fetchWithRetry(`${this.baseUrl}/cashin`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      // Erreur réseau après 2 tentatives
      return {
        referenceExterne: params.referenceInterne,
        statut: "ECHEC",
        message: `Timeout : ${networkError instanceof Error ? networkError.message : "Erreur réseau"}`,
      };
    }

    const rawData = (await response.json()) as SmobilpayCashinResponse;

    if (!response.ok || !rawData.payToken) {
      return {
        referenceExterne: params.referenceInterne,
        statut: "ECHEC",
        message: rawData.message ?? `Erreur HTTP ${response.status}`,
      };
    }

    return {
      referenceExterne: rawData.payToken,
      statut: "INITIE",
    };
  }

  /**
   * Vérifie le statut d'une transaction Smobilpay.
   * GET {baseUrl}/cashin/{payToken}
   */
  async checkStatus(referenceExterne: string): Promise<PaymentStatusResult> {
    let response: Response;
    try {
      response = await this.fetchWithRetry(
        `${this.baseUrl}/cashin/${referenceExterne}`,
        {
          method: "GET",
          headers: this.getAuthHeaders(),
        }
      );
    } catch {
      // Erreur réseau — retourner statut EN_ATTENTE (conservative)
      return {
        referenceExterne,
        statut: StatutPaiementAbo.EN_ATTENTE,
      };
    }

    if (!response.ok) {
      return {
        referenceExterne,
        statut: StatutPaiementAbo.ECHEC,
      };
    }

    const rawData = (await response.json()) as SmobilpayCashinStatusResponse;

    return {
      referenceExterne,
      statut: mapSmobilpayStatus(rawData.status),
      ...(rawData.amount !== undefined && { montant: rawData.amount }),
      ...(rawData.confirmedAt && {
        confirmedAt: new Date(rawData.confirmedAt),
      }),
    };
  }

  /**
   * Vérifie la signature HMAC-SHA256 d'un webhook Smobilpay.
   * Utilise SMOBILPAY_WEBHOOK_SECRET.
   *
   * CRITIQUE (ADR-016) : toujours appeler AVANT tout traitement DB.
   * Signature attendue dans le header x-smobilpay-signature.
   */
  verifySignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) {
      // Pas de secret configuré — rejeter par sécurité
      console.error(
        "Smobilpay : SMOBILPAY_WEBHOOK_SECRET non configuré — webhook rejeté"
      );
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(rawBody)
        .digest("hex");

      // Comparaison en temps constant pour éviter les timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch {
      // Signature malformée (pas en hex, longueur incorrecte, etc.)
      return false;
    }
  }

  /**
   * Traite un webhook entrant de Smobilpay.
   *
   * ORDRE CRITIQUE (ADR-016) :
   * 1. Vérifier la signature — retourner { success: false } si invalide
   * 2. Parser le payload
   * 3. Mapper le statut Smobilpay → StatutPaiementAbo
   * 4. Retourner le résultat pour que la route webhook applique les changements DB
   *
   * La route webhook est responsable de l'idempotence (vérifier referenceExterne en DB).
   */
  async processWebhook(payload: WebhookPayload): Promise<WebhookResult> {
    // Étape 1 : vérification de signature (AVANT tout parsing métier)
    if (!this.verifySignature(payload.rawBody, payload.signature)) {
      // Ne pas logger le rawBody complet (données sensibles potentielles)
      console.warn(
        `Smobilpay webhook : signature invalide pour referenceExterne ${payload.referenceExterne}`
      );
      return { success: false };
    }

    // Étape 2 : parser le payload brut
    let webhookBody: SmobilpayWebhookBody;
    try {
      webhookBody = JSON.parse(payload.rawBody) as SmobilpayWebhookBody;
    } catch {
      console.error("Smobilpay webhook : body JSON invalide");
      return { success: false };
    }

    // Étape 3 : extraire les données
    const referenceExterne = webhookBody.payToken ?? payload.referenceExterne;
    const statut = mapSmobilpayStatus(webhookBody.status ?? payload.statut);

    return {
      success: true,
      referenceExterne,
      statut,
    };
  }
}
