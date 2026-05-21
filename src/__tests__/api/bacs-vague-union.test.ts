/**
 * Tests de non-régression — GET /api/bacs?vagueId=X
 *
 * ADR-043 Phase 3: AssignationBac est la seule source de vérité.
 * La logique UNION (AssignationBac + Bac.vagueId) est supprimée.
 * Les tests vérifient uniquement le comportement basé sur AssignationBac.
 *
 * Cas couverts :
 *   1. Bac via AssignationBac active → apparaît dans la liste
 *   2. Aucun bac → liste vide
 *   3. Plusieurs bacs via AssignationBac → liste complète
 *   4. nombrePoissons lu depuis AssignationBac.nombreActuel
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/bacs/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/queries/bacs", () => ({
  getBacs: vi.fn(),
  getBacsLibres: vi.fn(),
}));

vi.mock("@/lib/abonnements/check-quotas", () => ({
  normaliseLimite: (valeur: number) => (valeur >= 999 ? null : valeur),
  isQuotaAtteint: (ressource: { actuel: number; limite: number | null }) => {
    if (ressource.limite === null) return false;
    return ressource.actuel >= ressource.limite;
  },
  getQuotasUsage: vi.fn(),
}));

vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementActifPourSite: vi.fn(),
}));

const mockAssignationBacFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
    },
  },
}));

const mockRequirePermission = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  ForbiddenError: class ForbiddenError extends Error {
    public readonly status = 403;
    constructor(message: string) {
      super(message);
      this.name = "ForbiddenError";
    }
  },
}));

vi.mock("@/lib/auth", () => ({
  AuthError: class AuthError extends Error {
    public readonly status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  permissions: [Permission.BACS_GERER],
};

const VAGUE_ID = "vague-test-001";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

/** Fabrique une entrée AssignationBac.findMany (avec bac inclus) */
function makeAssignation(opts: {
  bacId: string;
  nom: string;
  volume: number;
  nombrePoissons: number;
  nombreInitial?: number;
  poidsMoyenInitial?: number;
}) {
  return {
    id: `assignation-${opts.bacId}`,
    bacId: opts.bacId,
    vagueId: VAGUE_ID,
    siteId: "site-1",
    dateFin: null,
    nombreActuel: opts.nombrePoissons,
    nombreInitial: opts.nombreInitial ?? opts.nombrePoissons,
    poidsMoyenInitial: opts.poidsMoyenInitial ?? 50,
    bac: {
      id: opts.bacId,
      nom: opts.nom,
      volume: opts.volume,
      typeSysteme: null,
      siteId: "site-1",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests — ADR-043 Phase 3 (AssignationBac uniquement)
// ---------------------------------------------------------------------------

describe("GET /api/bacs?vagueId — AssignationBac source unique (ADR-043 Phase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // -------------------------------------------------------------------------
  // Cas 1 : bac via AssignationBac active → apparaît dans la liste
  // -------------------------------------------------------------------------
  it("Cas 1 — bac avec AssignationBac active doit apparaître", async () => {
    const assignation = makeAssignation({
      bacId: "bac-assignation-only",
      nom: "Bac Assignation",
      volume: 1000,
      nombrePoissons: 300,
    });

    mockAssignationBacFindMany.mockResolvedValue([assignation]);

    const response = await GET(makeRequest(`/api/bacs?vagueId=${VAGUE_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("bac-assignation-only");
    expect(body.data[0].nombrePoissons).toBe(300);
  });

  // -------------------------------------------------------------------------
  // Cas 2 : vague sans aucun bac — retourne liste vide
  // -------------------------------------------------------------------------
  it("Cas 2 — vague sans bacs retourne une liste vide", async () => {
    mockAssignationBacFindMany.mockResolvedValue([]);

    const response = await GET(makeRequest(`/api/bacs?vagueId=${VAGUE_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Cas 3 : plusieurs bacs via AssignationBac → liste complète
  // -------------------------------------------------------------------------
  it("Cas 3 — plusieurs bacs via AssignationBac retourne tous les bacs", async () => {
    const assignationA = makeAssignation({
      bacId: "bac-a",
      nom: "Bac A",
      volume: 1000,
      nombrePoissons: 200,
    });
    const assignationB = makeAssignation({
      bacId: "bac-b",
      nom: "Bac B",
      volume: 800,
      nombrePoissons: 150,
    });

    mockAssignationBacFindMany.mockResolvedValue([assignationA, assignationB]);

    const response = await GET(makeRequest(`/api/bacs?vagueId=${VAGUE_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    const ids = body.data.map((b: { id: string }) => b.id);
    expect(ids).toContain("bac-a");
    expect(ids).toContain("bac-b");
  });

  // -------------------------------------------------------------------------
  // Cas 4 : nombrePoissons provient de AssignationBac.nombreActuel
  // -------------------------------------------------------------------------
  it("Cas 4 — nombrePoissons lu depuis AssignationBac.nombreActuel (200), pas depuis Bac.nombrePoissons", async () => {
    // L'API lit nombreActuel de l'AssignationBac
    const assignation = makeAssignation({
      bacId: "bac-dual",
      nom: "Bac Dual",
      volume: 1500,
      nombrePoissons: 200, // valeur à jour dans AssignationBac.nombreActuel
    });

    mockAssignationBacFindMany.mockResolvedValue([assignation]);

    const response = await GET(makeRequest(`/api/bacs?vagueId=${VAGUE_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("bac-dual");
    // La valeur provient de AssignationBac.nombreActuel
    expect(body.data[0].nombrePoissons).toBe(200);
  });
});
