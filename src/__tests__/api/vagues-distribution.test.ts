/**
 * Tests de non-regression pour BUG-033 — Distribution des alevins par bac.
 *
 * Ces tests verifient que le champ `bacDistribution` (remplacant `bacIds`)
 * est correctement valide par l'API POST /api/vagues :
 *  - Distribution valide : 201 + nombrePoissons corrects sur les bacs
 *  - Somme != nombreInitial : 400
 *  - Distribution vide : 400
 *  - nombrePoissons <= 0 dans une entree : 400
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/vagues/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
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

// Mock check-quotas : fonctions pures utilisées dans la transaction inline
vi.mock("@/lib/abonnements/check-quotas", () => ({
  isQuotaAtteint: (ressource: { actuel: number; limite: number | null }) => {
    if (ressource.limite === null) return false;
    return ressource.actuel >= ressource.limite;
  },
  normaliseLimite: (val: number) => {
    if (val >= 999) return null;
    return val;
  },
}));

// Mock prisma — la transaction inline réalise le check quota + création
const mockPrismaVagueCount = vi.fn();
const mockPrismaVagueFindUnique = vi.fn();
const mockPrismaVagueCreate = vi.fn();
const mockPrismaBacFindMany = vi.fn();
const mockPrismaBacUpdate = vi.fn();
const mockPrismaTransaction = vi.fn();

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

const now = new Date("2026-03-10T10:00:00Z");

// ---------------------------------------------------------------------------
// Tests BUG-033 — bacDistribution
// ---------------------------------------------------------------------------

describe("POST /api/vagues — bacDistribution (BUG-033)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementActif.mockResolvedValue(null);
    mockPrismaVagueCount.mockResolvedValue(0);
    // Transaction inline : check quota + création dans la même tx
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
      };
      return fn(txMock);
    });
    // Par défaut : pas de bacs occupés, code unique
    mockPrismaBacFindMany.mockImplementation(({ where }: { where: { id: { in: string[] } } }) => {
      const ids = where.id.in;
      return Promise.resolve(ids.map((id: string) => ({
        id,
        nom: `Bac ${id}`,
        vagueId: null,
        siteId: "site-1",
      })));
    });
    mockPrismaVagueFindUnique.mockImplementation(({ where }: { where: { code?: string; id?: string } }) => {
      if (where.id) {
        // Appelé après création — retourner la vague créée
        return Promise.resolve(mockPrismaVagueCreate.mock.results[0]?.value ?? null);
      }
      return Promise.resolve(null); // pas de doublon de code
    });
    mockPrismaVagueCreate.mockResolvedValue({
      id: "vague-new",
      code: "VAGUE-CREATED",
      dateDebut: new Date("2026-03-01"),
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
    mockPrismaBacUpdate.mockResolvedValue({});
  });

  // -------------------------------------------------------------------------
  // CAS 1 : Distribution valide → 201 avec nombrePoissons corrects sur les bacs
  // -------------------------------------------------------------------------
  it("cree une vague avec bacDistribution valide et bacs contenant les nombrePoissons corrects", async () => {
    const bacDistribution = [
      { bacId: "bac-1", nombrePoissons: 600 },
      { bacId: "bac-2", nombrePoissons: 400 },
    ];

    // Mock tx.bac.findMany pour retourner des bacs libres avec les bons ids
    mockPrismaBacFindMany.mockResolvedValue([
      { id: "bac-1", nom: "Bac A", vagueId: null, siteId: "site-1" },
      { id: "bac-2", nom: "Bac B", vagueId: null, siteId: "site-1" },
    ]);

    // Mock tx.vague.create pour retourner la vague créée
    mockPrismaVagueCreate.mockResolvedValue({
      id: "vague-new",
      code: "VAGUE-2026-010",
      dateDebut: new Date("2026-03-01"),
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

    // Mock tx.vague.findUnique (appelé après create avec include: {bacs: true})
    mockPrismaVagueFindUnique.mockImplementation(({ where }: { where: { code?: string; id?: string } }) => {
      if (where.id) {
        return Promise.resolve({
          id: "vague-new",
          code: "VAGUE-2026-010",
          dateDebut: new Date("2026-03-01"),
          dateFin: null,
          statut: "EN_COURS",
          nombreInitial: 1000,
          poidsMoyenInitial: 5.0,
          origineAlevins: null,
          createdAt: now,
          updatedAt: now,
          bacs: [
            { id: "bac-1", nom: "Bac A", nombrePoissons: 600, nombreInitial: 600, poidsMoyenInitial: 5.0 },
            { id: "bac-2", nom: "Bac B", nombrePoissons: 400, nombreInitial: 400, poidsMoyenInitial: 5.0 },
          ],
        });
      }
      return Promise.resolve(null); // pas de doublon de code
    });

    const body = {
      code: "VAGUE-2026-010",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution,
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.code).toBe("VAGUE-2026-010");
    expect(data.nombreBacs).toBe(2);
    // La création est inline dans la transaction — vérifier que la tx a bien été appelée
    expect(mockPrismaTransaction).toHaveBeenCalled();
    expect(mockPrismaVagueCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "VAGUE-2026-010",
          siteId: "site-1",
        }),
      })
    );
    // Vérifier que bac.update a été appelé avec les bons nombrePoissons
    expect(mockPrismaBacUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nombrePoissons: 600 }),
      })
    );
    expect(mockPrismaBacUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nombrePoissons: 400 }),
      })
    );
  });

  it("accepte une distribution avec un seul bac recevant tous les poissons", async () => {
    mockPrismaBacFindMany.mockResolvedValue([
      { id: "bac-3", nom: "Bac C", vagueId: null, siteId: "site-1" },
    ]);

    mockPrismaVagueCreate.mockResolvedValue({
      id: "vague-new",
      code: "VAGUE-2026-011",
      dateDebut: new Date("2026-03-01"),
      dateFin: null,
      statut: "EN_COURS",
      nombreInitial: 500,
      poidsMoyenInitial: 3.0,
      origineAlevins: null,
      configElevageId: "config-1",
      siteId: "site-1",
      createdAt: now,
      updatedAt: now,
    });

    mockPrismaVagueFindUnique.mockImplementation(({ where }: { where: { code?: string; id?: string } }) => {
      if (where.id) {
        return Promise.resolve({
          id: "vague-new",
          code: "VAGUE-2026-011",
          dateDebut: new Date("2026-03-01"),
          dateFin: null,
          statut: "EN_COURS",
          nombreInitial: 500,
          poidsMoyenInitial: 3.0,
          origineAlevins: null,
          createdAt: now,
          updatedAt: now,
          bacs: [
            { id: "bac-3", nom: "Bac C", nombrePoissons: 500, nombreInitial: 500, poidsMoyenInitial: 3.0 },
          ],
        });
      }
      return Promise.resolve(null);
    });

    const body = {
      code: "VAGUE-2026-011",
      dateDebut: "2026-03-01",
      nombreInitial: 500,
      poidsMoyenInitial: 3.0,
      configElevageId: "config-1",
      bacDistribution: [
        { bacId: "bac-3", nombrePoissons: 500 },
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(201);
    // Vérifier que la transaction a appelé vague.create avec les bonnes données
    expect(mockPrismaVagueCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombreInitial: 500,
          siteId: "site-1",
        }),
      })
    );
    // Vérifier que bac.update a bien été appelé avec les bons nombrePoissons
    expect(mockPrismaBacUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nombrePoissons: 500 }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // CAS 2 : Somme != nombreInitial → 400
  // -------------------------------------------------------------------------
  it("retourne 400 si la somme de bacDistribution ne correspond pas au nombreInitial", async () => {
    const body = {
      code: "VAGUE-2026-012",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [
        { bacId: "bac-1", nombrePoissons: 600 },
        { bacId: "bac-2", nombrePoissons: 300 }, // somme = 900, pas 1000
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toBeDefined();
    const distributionError = data.errors.find(
      (e: { field: string }) => e.field === "bacDistribution"
    );
    expect(distributionError).toBeDefined();
    expect(distributionError.message).toContain("900");
    expect(distributionError.message).toContain("1000");
  });

  it("retourne 400 si la somme depasse le nombreInitial", async () => {
    const body = {
      code: "VAGUE-2026-013",
      dateDebut: "2026-03-01",
      nombreInitial: 500,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [
        { bacId: "bac-1", nombrePoissons: 300 },
        { bacId: "bac-2", nombrePoissons: 400 }, // somme = 700, superieur a 500
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    const distributionError = data.errors.find(
      (e: { field: string }) => e.field === "bacDistribution"
    );
    expect(distributionError).toBeDefined();
    expect(distributionError.message).toContain("700");
    expect(distributionError.message).toContain("500");
  });

  // -------------------------------------------------------------------------
  // CAS 3 : Distribution absente ou vide → 400
  // -------------------------------------------------------------------------
  it("retourne 400 si bacDistribution est absent", async () => {
    const body = {
      code: "VAGUE-2026-014",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      // bacDistribution absent
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    const distributionError = data.errors.find(
      (e: { field: string }) => e.field === "bacDistribution"
    );
    expect(distributionError).toBeDefined();
  });

  it("retourne 400 si bacDistribution est un tableau vide", async () => {
    const body = {
      code: "VAGUE-2026-015",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    const distributionError = data.errors.find(
      (e: { field: string }) => e.field === "bacDistribution"
    );
    expect(distributionError).toBeDefined();
    expect(distributionError.message).toContain("Au moins un bac");
  });

  it("retourne 400 si bacDistribution est null", async () => {
    const body = {
      code: "VAGUE-2026-016",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: null,
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    const distributionError = data.errors.find(
      (e: { field: string }) => e.field === "bacDistribution"
    );
    expect(distributionError).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // CAS 4 : nombrePoissons <= 0 dans une entree → 400
  // -------------------------------------------------------------------------
  it("retourne 400 si nombrePoissons est 0 dans une entree", async () => {
    const body = {
      code: "VAGUE-2026-017",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [
        { bacId: "bac-1", nombrePoissons: 1000 },
        { bacId: "bac-2", nombrePoissons: 0 }, // invalide
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    // La somme = 1000 = nombreInitial mais nombrePoissons=0 est invalide
    expect(response.status).toBe(400);
    const entryError = data.errors.find(
      (e: { field: string }) => e.field === "bacDistribution[1].nombrePoissons"
    );
    expect(entryError).toBeDefined();
    expect(entryError.message).toContain("superieur a 0");
  });

  it("retourne 400 si nombrePoissons est negatif dans une entree", async () => {
    const body = {
      code: "VAGUE-2026-018",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [
        { bacId: "bac-1", nombrePoissons: -100 }, // invalide
        { bacId: "bac-2", nombrePoissons: 500 },
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    const entryError = data.errors.find(
      (e: { field: string }) => e.field === "bacDistribution[0].nombrePoissons"
    );
    expect(entryError).toBeDefined();
    expect(entryError.message).toContain("superieur a 0");
  });

  it("retourne 400 si nombrePoissons n'est pas un entier", async () => {
    const body = {
      code: "VAGUE-2026-019",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [
        { bacId: "bac-1", nombrePoissons: 500.5 }, // non-entier
        { bacId: "bac-2", nombrePoissons: 499.5 },
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    const entryErrors = data.errors.filter(
      (e: { field: string }) => e.field.startsWith("bacDistribution[")
    );
    expect(entryErrors.length).toBeGreaterThan(0);
  });

  it("retourne 400 si bacId est absent dans une entree", async () => {
    const body = {
      code: "VAGUE-2026-020",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [
        { nombrePoissons: 1000 }, // bacId absent
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    const entryError = data.errors.find(
      (e: { field: string }) => e.field === "bacDistribution[0].bacId"
    );
    expect(entryError).toBeDefined();
    expect(entryError.message).toContain("bacId valide");
  });

  it("retourne 400 si bacId est une chaine vide dans une entree", async () => {
    const body = {
      code: "VAGUE-2026-021",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [
        { bacId: "", nombrePoissons: 1000 }, // bacId vide
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    const entryError = data.errors.find(
      (e: { field: string }) => e.field === "bacDistribution[0].bacId"
    );
    expect(entryError).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // CAS 5 : Conflits de bacs (409) et bacs introuvables (404)
  // Verifier que ces erreurs remontent correctement avec bacDistribution
  // -------------------------------------------------------------------------
  it("retourne 409 quand un bac dans la distribution est deja assigne a une vague", async () => {
    // Simuler un bac déjà assigné à une vague via tx.bac.findMany dans la transaction inline
    mockPrismaBacFindMany.mockResolvedValue([
      { id: "bac-already-assigned", nom: "Bac A", vagueId: "vague-existante", siteId: "site-1" },
    ]);

    const body = {
      code: "VAGUE-2026-022",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [
        { bacId: "bac-already-assigned", nombrePoissons: 1000 },
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(409);
    // Le message contient "assigné" (avec accent) — matcher les deux formes
    expect(data.message).toMatch(/assign[eé]/i);
  });

  it("retourne 404 quand un bacId de la distribution n'existe pas", async () => {
    // Simuler des bacs introuvables (moins retournés que demandés)
    mockPrismaBacFindMany.mockResolvedValue([]); // aucun bac trouvé

    const body = {
      code: "VAGUE-2026-023",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacDistribution: [
        { bacId: "bac-inexistant", nombrePoissons: 1000 },
      ],
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  // -------------------------------------------------------------------------
  // CAS 6 : Verifier que l'ancien champ bacIds est rejete
  // (protection contre regression vers l'ancien format)
  // -------------------------------------------------------------------------
  it("retourne 400 si l'on envoie l'ancien champ bacIds au lieu de bacDistribution", async () => {
    const body = {
      code: "VAGUE-2026-024",
      dateDebut: "2026-03-01",
      nombreInitial: 1000,
      poidsMoyenInitial: 5.0,
      configElevageId: "config-1",
      bacIds: ["bac-1", "bac-2"], // ancien format — doit etre rejete
    };

    const response = await POST(makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    // L'API doit demander bacDistribution
    const distributionError = data.errors.find(
      (e: { field: string }) => e.field === "bacDistribution"
    );
    expect(distributionError).toBeDefined();
    // La transaction ne doit jamais etre appelée (validation échoue avant)
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });
});
