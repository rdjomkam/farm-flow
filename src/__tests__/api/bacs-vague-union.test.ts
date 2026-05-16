/**
 * Tests de non-régression BUG-040 — GET /api/bacs?vagueId=X
 *
 * Vérifie que la logique UNION des deux sources (AssignationBac + Bac.vagueId)
 * retourne bien TOUS les bacs d'une vague sans doublons, quelle que soit
 * la source qui les référence.
 *
 * Cas couverts :
 *   1. Bac uniquement via AssignationBac (Bac.vagueId = null) → doit apparaître
 *   2. Bac uniquement via Bac.vagueId (pas d'AssignationBac active) → doit apparaître
 *   3. Vague mixte (deux sources) → UNION sans doublon
 *   4. Bac présent dans les deux sources → pas de doublon, AssignationBac prioritaire
 *      pour nombrePoissons
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
const mockBacFindMany = vi.fn();
const mockPrismaTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
    },
    bac: {
      findMany: (...args: unknown[]) => mockBacFindMany(...args),
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
      nombrePoissons: opts.nombrePoissons,
      nombreInitial: opts.nombreInitial ?? opts.nombrePoissons,
      poidsMoyenInitial: opts.poidsMoyenInitial ?? 50,
      typeSysteme: null,
      siteId: "site-1",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    },
  };
}

/** Fabrique un Bac.findMany (sans include) */
function makeBac(opts: {
  bacId: string;
  nom: string;
  volume: number;
  vagueId: string | null;
  nombrePoissons?: number;
}) {
  return {
    id: opts.bacId,
    nom: opts.nom,
    volume: opts.volume,
    vagueId: opts.vagueId,
    nombrePoissons: opts.nombrePoissons ?? null,
    nombreInitial: opts.nombrePoissons ?? null,
    poidsMoyenInitial: null,
    typeSysteme: null,
    siteId: "site-1",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  };
}

// ---------------------------------------------------------------------------
// Tests — BUG-040
// ---------------------------------------------------------------------------

describe("GET /api/bacs?vagueId — UNION des deux sources (BUG-040)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // -------------------------------------------------------------------------
  // Cas 1 : bac uniquement via AssignationBac (Bac.vagueId = null)
  // -------------------------------------------------------------------------
  it("Cas 1 — bac sans Bac.vagueId mais avec AssignationBac active doit apparaître", async () => {
    // Ce bac n'a pas de vagueId direct mais a une AssignationBac active
    const assignation = makeAssignation({
      bacId: "bac-assignation-only",
      nom: "Bac Assignation",
      volume: 1000,
      nombrePoissons: 300,
    });

    mockAssignationBacFindMany.mockResolvedValue([assignation]);
    // Bac.vagueId = null → Bac.findMany ne retourne rien
    mockBacFindMany.mockResolvedValue([]);

    const response = await GET(makeRequest(`/api/bacs?vagueId=${VAGUE_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("bac-assignation-only");
    expect(body.data[0].nombrePoissons).toBe(300);
  });

  // -------------------------------------------------------------------------
  // Cas 2 : bac uniquement via Bac.vagueId (pas d'AssignationBac active)
  // -------------------------------------------------------------------------
  it("Cas 2 — bac avec Bac.vagueId mais sans AssignationBac active doit apparaître", async () => {
    // Ce bac a un vagueId direct mais aucune AssignationBac active
    const bac = makeBac({
      bacId: "bac-fk-only",
      nom: "Bac FK",
      volume: 800,
      vagueId: VAGUE_ID,
      nombrePoissons: 150,
    });

    mockAssignationBacFindMany.mockResolvedValue([]);
    mockBacFindMany.mockResolvedValue([bac]);

    const response = await GET(makeRequest(`/api/bacs?vagueId=${VAGUE_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("bac-fk-only");
    expect(body.data[0].nombrePoissons).toBe(150);
  });

  // -------------------------------------------------------------------------
  // Cas 3 : vague mixte — un bac via AssignationBac, un autre via Bac.vagueId
  // -------------------------------------------------------------------------
  it("Cas 3 — vague mixte retourne l'UNION des deux sources sans doublon", async () => {
    const assignation = makeAssignation({
      bacId: "bac-a",
      nom: "Bac A",
      volume: 1000,
      nombrePoissons: 200,
    });
    const bacLegacy = makeBac({
      bacId: "bac-b",
      nom: "Bac B",
      volume: 800,
      vagueId: VAGUE_ID,
      nombrePoissons: 100,
    });

    mockAssignationBacFindMany.mockResolvedValue([assignation]);
    mockBacFindMany.mockResolvedValue([bacLegacy]);

    const response = await GET(makeRequest(`/api/bacs?vagueId=${VAGUE_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    const ids = body.data.map((b: { id: string }) => b.id);
    expect(ids).toContain("bac-a");
    expect(ids).toContain("bac-b");
  });

  // -------------------------------------------------------------------------
  // Cas 4 : bac présent dans les DEUX sources — pas de doublon
  //         AssignationBac est prioritaire pour nombrePoissons
  // -------------------------------------------------------------------------
  it("Cas 4 — bac dans les deux sources : une seule occurrence, valeur AssignationBac prioritaire", async () => {
    // Le bac est présent dans AssignationBac (200 poissons) ET dans Bac.vagueId (stale: 50)
    const assignation = makeAssignation({
      bacId: "bac-dual",
      nom: "Bac Dual",
      volume: 1500,
      nombrePoissons: 200, // valeur à jour dans AssignationBac
    });
    const bacFk = makeBac({
      bacId: "bac-dual",
      nom: "Bac Dual",
      volume: 1500,
      vagueId: VAGUE_ID,
      nombrePoissons: 50, // valeur stale dans Bac.vagueId
    });

    mockAssignationBacFindMany.mockResolvedValue([assignation]);
    mockBacFindMany.mockResolvedValue([bacFk]);

    const response = await GET(makeRequest(`/api/bacs?vagueId=${VAGUE_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    // Pas de doublon
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("bac-dual");
    // La valeur provient d'AssignationBac (prioritaire)
    expect(body.data[0].nombrePoissons).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Cas 5 : vague sans aucun bac — retourne liste vide (régression safe)
  // -------------------------------------------------------------------------
  it("Cas 5 — vague sans bacs retourne une liste vide", async () => {
    mockAssignationBacFindMany.mockResolvedValue([]);
    mockBacFindMany.mockResolvedValue([]);

    const response = await GET(makeRequest(`/api/bacs?vagueId=${VAGUE_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Cas 6 : tri alphabétique stable après UNION
  // -------------------------------------------------------------------------
  it("Cas 6 — les bacs de l'UNION sont triés par nom (ordre alphabétique)", async () => {
    const assignation = makeAssignation({
      bacId: "bac-z",
      nom: "Zephyr",
      volume: 1000,
      nombrePoissons: 100,
    });
    const bacLegacy = makeBac({
      bacId: "bac-a",
      nom: "Alpha",
      volume: 500,
      vagueId: VAGUE_ID,
      nombrePoissons: 50,
    });

    mockAssignationBacFindMany.mockResolvedValue([assignation]);
    mockBacFindMany.mockResolvedValue([bacLegacy]);

    const response = await GET(makeRequest(`/api/bacs?vagueId=${VAGUE_ID}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].nom).toBe("Alpha");
    expect(body.data[1].nom).toBe("Zephyr");
  });
});
