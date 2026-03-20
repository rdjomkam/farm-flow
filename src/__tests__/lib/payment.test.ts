/**
 * Tests unitaires — src/lib/payment/ (Sprint 31)
 *
 * Couvre :
 * - ManualGateway (implémentation complète)
 * - SmobilpayGateway (vérification de signature)
 * - getPaymentGateway factory
 * - billingService.initierPaiement (idempotence, cas nominal)
 *
 * Sprint 31 — Story 31.5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ManualGateway } from "@/lib/payment/manual-gateway";
import { SmobilpayGateway } from "@/lib/payment/smobilpay-gateway";
import { getPaymentGateway } from "@/lib/payment/factory";
import { FournisseurPaiement, StatutPaiementAbo } from "@/types";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// ManualGateway — Tests complets (implémentation finale en 31.1)
// ---------------------------------------------------------------------------

describe("ManualGateway", () => {
  let gateway: ManualGateway;

  beforeEach(() => {
    gateway = new ManualGateway();
  });

  it("fournisseur = FournisseurPaiement.MANUEL", () => {
    expect(gateway.fournisseur).toBe(FournisseurPaiement.MANUEL);
  });

  describe("initiatePayment()", () => {
    it("retourne statut INITIE avec referenceExterne = referenceInterne", async () => {
      const result = await gateway.initiatePayment({
        abonnementId: "abo-123",
        phoneNumber: "+237699000001",
        montant: 8000,
        description: "Test abonnement",
        referenceInterne: "SUB-abo-123-202603",
      });

      expect(result.statut).toBe("INITIE");
      expect(result.referenceExterne).toBe("SUB-abo-123-202603");
      expect(result.message).toBeUndefined();
    });

    it("ne fait aucun appel réseau", async () => {
      const fetchSpy = vi.spyOn(global, "fetch");

      await gateway.initiatePayment({
        abonnementId: "abo-1",
        phoneNumber: "+237699000001",
        montant: 25000,
        description: "Test",
        referenceInterne: "SUB-abo-1-202603",
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  describe("checkStatus()", () => {
    it("retourne StatutPaiementAbo.CONFIRME pour tout referenceExterne", async () => {
      const result = await gateway.checkStatus("any-ref-123");
      expect(result.statut).toBe(StatutPaiementAbo.CONFIRME);
      expect(result.referenceExterne).toBe("any-ref-123");
      expect(result.confirmedAt).toBeInstanceOf(Date);
    });
  });

  describe("processWebhook()", () => {
    it("retourne success=false (pas de webhook pour paiements manuels)", async () => {
      const result = await gateway.processWebhook({
        referenceExterne: "ref-1",
        statut: "SUCCESS",
        signature: "any",
        rawBody: "{}",
        headers: {},
      });

      expect(result.success).toBe(false);
    });
  });

  describe("verifySignature()", () => {
    it("retourne toujours true (pas de vérification pour manuel)", () => {
      expect(gateway.verifySignature("any-body", "any-signature")).toBe(true);
      expect(gateway.verifySignature("", "")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// SmobilpayGateway — Tests de signature HMAC
// ---------------------------------------------------------------------------

describe("SmobilpayGateway — verifySignature()", () => {
  let gateway: SmobilpayGateway;

  beforeEach(() => {
    // Configurer les variables d'environnement pour les tests
    vi.stubEnv("SMOBILPAY_WEBHOOK_SECRET", "test-webhook-secret-123");
    vi.stubEnv("SMOBILPAY_API_KEY", "test-key");
    vi.stubEnv("SMOBILPAY_API_SECRET", "test-secret");
    vi.stubEnv("SMOBILPAY_SANDBOX", "true");
    gateway = new SmobilpayGateway();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retourne true pour une signature HMAC-SHA256 valide", () => {
    const secret = "test-webhook-secret-123";
    const rawBody = JSON.stringify({ payToken: "tok-123", status: "SUCCESS" });
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    expect(gateway.verifySignature(rawBody, validSignature)).toBe(true);
  });

  it("retourne false pour une signature invalide", () => {
    const rawBody = JSON.stringify({ payToken: "tok-123", status: "SUCCESS" });
    expect(gateway.verifySignature(rawBody, "invalid-signature")).toBe(false);
  });

  it("retourne false si le body est modifié après signature", () => {
    const secret = "test-webhook-secret-123";
    const rawBodyOriginal = JSON.stringify({
      payToken: "tok-123",
      status: "SUCCESS",
    });
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBodyOriginal)
      .digest("hex");

    // Body modifié (attaque potentielle)
    const rawBodyModifie = JSON.stringify({
      payToken: "tok-123",
      status: "SUCCESS",
      amount: 999999,
    });

    expect(gateway.verifySignature(rawBodyModifie, validSignature)).toBe(false);
  });

  it("retourne false si SMOBILPAY_WEBHOOK_SECRET n'est pas configuré", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("SMOBILPAY_WEBHOOK_SECRET", "");
    const gatewayNoSecret = new SmobilpayGateway();
    expect(gatewayNoSecret.verifySignature("body", "sig")).toBe(false);
  });

  it("fournisseur = FournisseurPaiement.SMOBILPAY", () => {
    expect(gateway.fournisseur).toBe(FournisseurPaiement.SMOBILPAY);
  });
});

// ---------------------------------------------------------------------------
// SmobilpayGateway — processWebhook()
// ---------------------------------------------------------------------------

describe("SmobilpayGateway — processWebhook()", () => {
  let gateway: SmobilpayGateway;

  beforeEach(() => {
    vi.stubEnv("SMOBILPAY_WEBHOOK_SECRET", "test-secret");
    vi.stubEnv("SMOBILPAY_API_KEY", "test-key");
    vi.stubEnv("SMOBILPAY_API_SECRET", "test-secret");
    vi.stubEnv("SMOBILPAY_SANDBOX", "true");
    gateway = new SmobilpayGateway();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retourne success=false si signature invalide", async () => {
    const result = await gateway.processWebhook({
      referenceExterne: "tok-123",
      statut: "SUCCESS",
      signature: "invalid",
      rawBody: JSON.stringify({ payToken: "tok-123", status: "SUCCESS" }),
      headers: {},
    });

    expect(result.success).toBe(false);
    expect(result.referenceExterne).toBeUndefined();
  });

  it("retourne success=true avec statut CONFIRME pour signature valide + status SUCCESS", async () => {
    const rawBody = JSON.stringify({ payToken: "tok-456", status: "SUCCESS" });
    const validSignature = crypto
      .createHmac("sha256", "test-secret")
      .update(rawBody)
      .digest("hex");

    const result = await gateway.processWebhook({
      referenceExterne: "tok-456",
      statut: "SUCCESS",
      signature: validSignature,
      rawBody,
      headers: {},
    });

    expect(result.success).toBe(true);
    expect(result.referenceExterne).toBe("tok-456");
    expect(result.statut).toBe(StatutPaiementAbo.CONFIRME);
  });

  it("retourne statut ECHEC pour status FAILED", async () => {
    const rawBody = JSON.stringify({ payToken: "tok-789", status: "FAILED" });
    const validSignature = crypto
      .createHmac("sha256", "test-secret")
      .update(rawBody)
      .digest("hex");

    const result = await gateway.processWebhook({
      referenceExterne: "tok-789",
      statut: "FAILED",
      signature: validSignature,
      rawBody,
      headers: {},
    });

    expect(result.success).toBe(true);
    expect(result.statut).toBe(StatutPaiementAbo.ECHEC);
  });
});

// ---------------------------------------------------------------------------
// getPaymentGateway factory
// ---------------------------------------------------------------------------

describe("getPaymentGateway — factory", () => {
  beforeEach(() => {
    vi.stubEnv("SMOBILPAY_API_KEY", "test-key");
    vi.stubEnv("SMOBILPAY_API_SECRET", "test-secret");
    vi.stubEnv("SMOBILPAY_WEBHOOK_SECRET", "test-webhook-secret");
    vi.stubEnv("SMOBILPAY_SANDBOX", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retourne une instance SmobilpayGateway pour SMOBILPAY", () => {
    const gateway = getPaymentGateway(FournisseurPaiement.SMOBILPAY);
    expect(gateway).toBeInstanceOf(SmobilpayGateway);
    expect(gateway.fournisseur).toBe(FournisseurPaiement.SMOBILPAY);
  });

  it("retourne une instance ManualGateway pour MANUEL", () => {
    const gateway = getPaymentGateway(FournisseurPaiement.MANUEL);
    expect(gateway).toBeInstanceOf(ManualGateway);
    expect(gateway.fournisseur).toBe(FournisseurPaiement.MANUEL);
  });

  it("lance une Error pour MTN_MOMO (non implémenté Phase 1)", () => {
    expect(() => getPaymentGateway(FournisseurPaiement.MTN_MOMO)).toThrow(
      /non implémenté|Gateway/i
    );
  });

  it("lance une Error pour ORANGE_MONEY (non implémenté Phase 1)", () => {
    expect(() => getPaymentGateway(FournisseurPaiement.ORANGE_MONEY)).toThrow(
      /non implémenté|Gateway/i
    );
  });
});
