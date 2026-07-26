/**
 * Tests — POST /api/bons-livraison/[id]/signer
 *
 * Durcissement review Sprint BF phase 2 : signer un RECTIFICATIF (BL dont
 * `rectifieId` != null) doit exiger EN PLUS de VENTES_MODIFIER la permission
 * BONS_LIVRAISON_RECTIFIER — c'est la signature, pas la saisie des
 * quantites, qui applique reellement la correction (stock/mortalites/montants).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Permission } from "@/types";

const mockRequirePermission = vi.fn();
const mockBonLivraisonFindFirst = vi.fn();
const mockSignerBonLivraison = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    bonLivraison: {
      findFirst: (...args: unknown[]) => mockBonLivraisonFindFirst(...args),
    },
  },
}));
vi.mock("@/lib/queries/bons-livraison", () => ({
  signerBonLivraison: (...args: unknown[]) => mockSignerBonLivraison(...args),
}));
vi.mock("@/lib/validation/bon-livraison", () => ({
  signerBonLivraisonSchema: {
    safeParse: (body: unknown) => ({ success: true, data: body }),
  },
}));

const { POST } = await import("../route");

const SITE_ID = "site-1";
const BL_ID = "bl-1";

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/bons-livraison/bl-1/signer", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.resetAllMocks();
  mockSignerBonLivraison.mockResolvedValue({ id: BL_ID });
});

describe("POST /api/bons-livraison/[id]/signer — permission rectificatif", () => {
  it("BL normal (rectifieId null) + VENTES_MODIFIER seul -> autorise", async () => {
    mockRequirePermission.mockResolvedValue({
      activeSiteId: SITE_ID,
      permissions: [Permission.VENTES_MODIFIER],
    });
    mockBonLivraisonFindFirst.mockResolvedValue({ rectifieId: null });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: BL_ID }) });

    expect(response.status).toBe(200);
    expect(mockSignerBonLivraison).toHaveBeenCalled();
  });

  it("BL rectificatif + VENTES_MODIFIER seul (sans BONS_LIVRAISON_RECTIFIER) -> 403", async () => {
    mockRequirePermission.mockResolvedValue({
      activeSiteId: SITE_ID,
      permissions: [Permission.VENTES_MODIFIER],
    });
    mockBonLivraisonFindFirst.mockResolvedValue({ rectifieId: "bl-origine" });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: BL_ID }) });

    expect(response.status).toBe(403);
    expect(mockSignerBonLivraison).not.toHaveBeenCalled();
  });

  it("BL rectificatif + BONS_LIVRAISON_RECTIFIER -> autorise", async () => {
    mockRequirePermission.mockResolvedValue({
      activeSiteId: SITE_ID,
      permissions: [Permission.VENTES_MODIFIER, Permission.BONS_LIVRAISON_RECTIFIER],
    });
    mockBonLivraisonFindFirst.mockResolvedValue({ rectifieId: "bl-origine" });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: BL_ID }) });

    expect(response.status).toBe(200);
    expect(mockSignerBonLivraison).toHaveBeenCalled();
  });
});
