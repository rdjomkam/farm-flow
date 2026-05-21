/**
 * Test de non-régression BUG-041 — POST /api/vagues doit dual-writer
 * dans AssignationBac (ADR-043 Phase 2).
 *
 * Symptôme : après création d'une vague avec N bacs, la liste affichait
 * "0 tank" parce que le handler POST ne mettait à jour que Bac.vagueId
 * sans créer les lignes AssignationBac actives lues par getVagues().
 *
 * Ce test vérifie explicitement que tx.assignationBac.create est appelé
 * une fois par bac de la distribution, avec un payload correct (dateFin
 * null = assignation active, siteId propagé).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/vagues/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — minimal set
// ---------------------------------------------------------------------------

const mockGetVagues = vi.fn();

vi.mock("@/lib/queries/vagues", () => ({
  getVagues: (...args: unknown[]) => mockGetVagues(...args),
  getVagueById: vi.fn(),
  updateVague: vi.fn(),
}));

vi.mock("@/lib/queries/indicateurs", () => ({
  getIndicateursVague: vi.fn(),
}));

vi.mock("@/lib/abonnements/check-quotas", () => ({
  isQuotaAtteint: (ressource: { actuel: number; limite: number | null }) => {
    if (ressource.limite === null) return false;
    return ressource.actuel >= ressource.limite;
  },
  normaliseLimite: (val: number) => (val >= 999 ? null : val),
}));

const mockPrismaVagueCount = vi.fn();
const mockPrismaVagueFindUnique = vi.fn();
const mockPrismaVagueCreate = vi.fn();
const mockPrismaBacFindMany = vi.fn();
const mockPrismaBacUpdate = vi.fn();
const mockPrismaTransaction = vi.fn();
const mockAssignationBacCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vague: {
      count: (...args: unknown[]) => mockPrismaVagueCount(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockPrismaTransaction(fn),
  },
}));

const mockGetAbonnementActif = vi.fn();
vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementActif: (...args: unknown[]) => mockGetAbonnementActif(...args),
  getAbonnementActifPourSite: (...args: unknown[]) => mockGetAbonnementActif(...args),
  getAbonnements: vi.fn(),
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

vi.mock("@/lib/feature-flags", () => ({
  checkPlatformMaintenance: vi.fn().mockResolvedValue(null),
  getFeatureFlag: vi.fn().mockResolvedValue(null),
  isMaintenanceModeEnabled: vi.fn().mockResolvedValue(false),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "GERANT",
  activeSiteId: "site-1",
  siteRole: "GERANT",
  isSuperAdmin: false,
  permissions: [
    Permission.VAGUES_VOIR,
    Permission.VAGUES_CREER,
    Permission.VAGUES_MODIFIER,
  ],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const now = new Date("2026-04-23T10:00:00Z");

// ---------------------------------------------------------------------------
// Tests BUG-041
// ---------------------------------------------------------------------------

describe("BUG-041 — POST /api/vagues dual-write AssignationBac (ADR-043 Phase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementActif.mockResolvedValue(null);
    mockPrismaVagueCount.mockResolvedValue(0);

    mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        vague: {
          count: (...args: unknown[]) => mockPrismaVagueCount(...args),
          findUnique: (...args: unknown[]) => mockPrismaVagueFindUnique(...args),
          create: (...args: unknown[]) => mockPrismaVagueCreate(...args),
        },
        bac: {
          findMany: (...args: unknown[]) => mockPrismaBacFindMany(...args),
          update: (...args: unknown[]) => mockPrismaBacUpdate(...args),
        },
        assignationBac: {
          // ADR-043 Phase 3: findMany used to check occupation before creating
          findMany: vi.fn().mockResolvedValue([]),
          create: (...args: unknown[]) => mockAssignationBacCreate(...args),
        },
      };
      return fn(txMock);
    });

    mockPrismaBacFindMany.mockResolvedValue([
      { id: "bac-a", nom: "Etang A", vagueId: null, siteId: "site-1" },
      { id: "bac-b", nom: "Etang B", vagueId: null, siteId: "site-1" },
    ]);

    mockPrismaVagueCreate.mockResolvedValue({
      id: "vague-041",
      code: "VAGUE-2026-BUG041",
      dateDebut: new Date("2026-04-23"),
      dateFin: null,
      statut: "EN_COURS",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      origineAlevins: null,
      configElevageId: "config-1",
      siteId: "site-1",
      createdAt: now,
      updatedAt: now,
    });

    // ADR-043 Phase 3: vague.findUnique retourne assignations (plus bacs)
    mockPrismaVagueFindUnique.mockImplementation(({ where }: { where: { code?: string; id?: string } }) => {
      if (where.id) {
        return Promise.resolve({
          id: "vague-041",
          code: "VAGUE-2026-BUG041",
          dateDebut: new Date("2026-04-23"),
          dateFin: null,
          statut: "EN_COURS",
          nombreInitial: 1000,
          poidsMoyenInitial: 5.0,
          origineAlevins: null,
          createdAt: now,
          updatedAt: now,
          // ADR-043 Phase 3: assignations actives (plus bacs)
          assignations: [
            { id: "assign-bac-a", bacId: "bac-a", vagueId: "vague-041", dateFin: null, nombreInitial: 600, nombreActuel: 600, poidsMoyenInitial: 5.0, bac: { id: "bac-a", nom: "Etang A", volume: 1000 } },
            { id: "assign-bac-b", bacId: "bac-b", vagueId: "vague-041", dateFin: null, nombreInitial: 400, nombreActuel: 400, poidsMoyenInitial: 5.0, bac: { id: "bac-b", nom: "Etang B", volume: 800 } },
          ],
        });
      }
      return Promise.resolve(null);
    });

    mockPrismaBacUpdate.mockResolvedValue({});
    mockAssignationBacCreate.mockResolvedValue({});
  });

  it("crée une AssignationBac active (dateFin null) pour CHAQUE bac de la distribution", async () => {
    const body = {
      code: "VAGUE-2026-BUG041",
      dateDebut: "2026-04-23",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [
        { bacId: "bac-a", nombrePoissons: 600 },
        { bacId: "bac-b", nombrePoissons: 400 },
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    // Le POST réussit et renvoie nombreBacs = 2 (lu depuis vague.assignations.length).
    expect(response.status).toBe(201);
    expect(data.nombreBacs).toBe(2);

    // Cœur de la non-régression : AssignationBac.create appelé pour chaque bac.
    expect(mockAssignationBacCreate).toHaveBeenCalledTimes(2);

    // ADR-043 Phase 3: le DTO utilise nombreActuel (pas nombrePoissons)
    expect(mockAssignationBacCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bacId: "bac-a",
          vagueId: "vague-041",
          siteId: "site-1",
          dateFin: null,
          nombreInitial: 600,
          nombreActuel: 600,
          poidsMoyenInitial: 5.0,
        }),
      })
    );

    expect(mockAssignationBacCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bacId: "bac-b",
          vagueId: "vague-041",
          siteId: "site-1",
          dateFin: null,
          nombreInitial: 400,
          nombreActuel: 400,
          poidsMoyenInitial: 5.0,
        }),
      })
    );

    // dateAssignation = Date(dateDebut)
    for (const call of mockAssignationBacCreate.mock.calls) {
      const arg = call[0] as { data: { dateAssignation: Date } };
      expect(arg.data.dateAssignation).toBeInstanceOf(Date);
      expect(arg.data.dateAssignation.toISOString()).toBe(new Date("2026-04-23").toISOString());
    }
  });
});
