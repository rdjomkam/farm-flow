/**
 * Tests Sprint 16 — Dépenses
 *
 * Couvre :
 * - ajouterPaiementDepense : partiel, surpaiement refusé, auto-statut NON_PAYEE→PAYEE_PARTIELLEMENT→PAYEE
 * - Auto-création dépense dans recevoirCommande
 * - API routes : GET, POST, PUT, DELETE, paiements, upload
 * - Permissions : 403 sans permission
 */

import { NextRequest } from "next/server";
import { StatutDepense, StatutCommande, ModePaiement, CategorieDepense, Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaDepenseFindFirst = vi.fn();
const mockPrismaDepenseCreate = vi.fn();
const mockPrismaDepenseUpdateMany = vi.fn();
const mockPrismaDepenseDeleteMany = vi.fn();
const mockPrismaDepenseDelete = vi.fn();
const mockPrismaDepenseFindMany = vi.fn();
const mockPrismaDepenseCount = vi.fn();
const mockPrismaDepenseUpdate = vi.fn();
const mockPrismaPaiementDepenseCreate = vi.fn();
const mockPrismaPaiementDepenseAggregate = vi.fn();
const mockPrismaPaiementDepenseFindUniqueOrThrow = vi.fn();
const mockPrismaPaiementDepenseFindFirst = vi.fn();
const mockPrismaPaiementDepenseDelete = vi.fn();
const mockPrismaFraisPaiementDepenseCreateMany = vi.fn();
const mockPrismaFraisPaiementDepenseAggregate = vi.fn();
const mockPrismaAjustementDepenseCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    depense: {
      findFirst: (...args: unknown[]) => mockPrismaDepenseFindFirst(...args),
      findMany: (...args: unknown[]) => mockPrismaDepenseFindMany(...args),
      create: (...args: unknown[]) => mockPrismaDepenseCreate(...args),
      updateMany: (...args: unknown[]) => mockPrismaDepenseUpdateMany(...args),
      deleteMany: (...args: unknown[]) => mockPrismaDepenseDeleteMany(...args),
      delete: (...args: unknown[]) => mockPrismaDepenseDelete(...args),
      count: (...args: unknown[]) => mockPrismaDepenseCount(...args),
      update: (...args: unknown[]) => mockPrismaDepenseUpdate(...args),
    },
    paiementDepense: {
      create: (...args: unknown[]) => mockPrismaPaiementDepenseCreate(...args),
      aggregate: (...args: unknown[]) => mockPrismaPaiementDepenseAggregate(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockPrismaPaiementDepenseFindUniqueOrThrow(...args),
      findFirst: (...args: unknown[]) => mockPrismaPaiementDepenseFindFirst(...args),
      delete: (...args: unknown[]) => mockPrismaPaiementDepenseDelete(...args),
    },
    fraisPaiementDepense: {
      createMany: (...args: unknown[]) => mockPrismaFraisPaiementDepenseCreateMany(...args),
      aggregate: (...args: unknown[]) => mockPrismaFraisPaiementDepenseAggregate(...args),
    },
    ajustementDepense: {
      create: (...args: unknown[]) => mockPrismaAjustementDepenseCreate(...args),
    },
    vague: { findFirst: vi.fn() },
    commande: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({
      depense: {
        findFirst: mockPrismaDepenseFindFirst,
        create: mockPrismaDepenseCreate,
        updateMany: mockPrismaDepenseUpdateMany,
        update: mockPrismaDepenseUpdate,
        count: mockPrismaDepenseCount,
      },
      paiementDepense: {
        create: mockPrismaPaiementDepenseCreate,
        aggregate: mockPrismaPaiementDepenseAggregate,
        findUniqueOrThrow: mockPrismaPaiementDepenseFindUniqueOrThrow,
        findFirst: mockPrismaPaiementDepenseFindFirst,
        delete: mockPrismaPaiementDepenseDelete,
      },
      fraisPaiementDepense: {
        createMany: mockPrismaFraisPaiementDepenseCreateMany,
        aggregate: mockPrismaFraisPaiementDepenseAggregate,
      },
      ajustementDepense: {
        create: mockPrismaAjustementDepenseCreate,
      },
      vague: { findFirst: vi.fn() },
      commande: { findFirst: vi.fn() },
    })),
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

vi.mock("@/lib/feature-flags", () => ({
  checkPlatformMaintenance: vi.fn().mockResolvedValue(null),
  getFeatureFlag: vi.fn().mockResolvedValue(null),
  isMaintenanceModeEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/storage", () => ({
  validateFile: vi.fn(),
  generateStorageKey: vi.fn().mockReturnValue("farm-flow/site-1/depenses/dep-test/1234-facture.pdf"),
  uploadFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  getSignedUrl: vi.fn().mockResolvedValue("https://storage.example.com/signed-url"),
  extractFileNameFromKey: vi.fn().mockReturnValue("facture.pdf"),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  activeSiteId: "site-1",
  permissions: Object.values(Permission),
  email: "admin@test.com",
  phone: null,
  name: "Admin",
  globalRole: "ADMIN",
  isSuperAdmin: false,
  siteRoleId: "role-1",
  siteRoleName: "Administrateur",
};

const FAKE_DEPENSE = {
  id: "dep-1",
  numero: "DEP-2026-001",
  description: "Test depense",
  categorieDepense: CategorieDepense.ELECTRICITE,
  montantTotal: 50000,
  montantPaye: 0,
  statut: StatutDepense.NON_PAYEE,
  date: new Date("2026-03-01"),
  dateEcheance: null,
  factureUrl: null,
  notes: null,
  commandeId: null,
  vagueId: null,
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ---------------------------------------------------------------------------
// Unit tests — ajouterPaiementDepense (pattern paiement partiel)
// ---------------------------------------------------------------------------

import { ajouterPaiementDepense } from "@/lib/queries/depenses";

describe("ajouterPaiementDepense — paiement partiel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cree un paiement partiel et passe en PAYEE_PARTIELLEMENT", async () => {
    mockPrismaDepenseFindFirst.mockResolvedValue(FAKE_DEPENSE);
    const paiementCree = { id: "pdep-1", montant: 20000, mode: ModePaiement.ESPECES, depenseId: "dep-1", userId: "user-1", siteId: "site-1", reference: null, date: new Date(), createdAt: new Date(), fraisSupp: [], user: { id: "user-1", name: "Admin" } };
    mockPrismaPaiementDepenseCreate.mockResolvedValue(paiementCree);
    mockPrismaPaiementDepenseFindUniqueOrThrow.mockResolvedValue(paiementCree);
    mockPrismaPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 20000 } });
    mockPrismaFraisPaiementDepenseCreateMany.mockResolvedValue({ count: 0 });
    mockPrismaFraisPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaDepenseUpdate.mockResolvedValue({ ...FAKE_DEPENSE, montantPaye: 20000, statut: StatutDepense.PAYEE_PARTIELLEMENT });

    const result = await ajouterPaiementDepense("site-1", "dep-1", "user-1", {
      montant: 20000,
      mode: ModePaiement.ESPECES,
    });

    expect(result.statut).toBe(StatutDepense.PAYEE_PARTIELLEMENT);
    expect(result.montantPaye).toBe(20000);
    expect(result.paiement.montant).toBe(20000);
  });

  it("passe en PAYEE quand montant total est atteint", async () => {
    mockPrismaDepenseFindFirst.mockResolvedValue(FAKE_DEPENSE);
    const paiementCree = { id: "pdep-1", montant: 50000, mode: ModePaiement.VIREMENT, depenseId: "dep-1", userId: "user-1", siteId: "site-1", reference: null, date: new Date(), createdAt: new Date(), fraisSupp: [], user: { id: "user-1", name: "Admin" } };
    mockPrismaPaiementDepenseCreate.mockResolvedValue(paiementCree);
    mockPrismaPaiementDepenseFindUniqueOrThrow.mockResolvedValue(paiementCree);
    mockPrismaPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 50000 } });
    mockPrismaFraisPaiementDepenseCreateMany.mockResolvedValue({ count: 0 });
    mockPrismaFraisPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaDepenseUpdate.mockResolvedValue({ ...FAKE_DEPENSE, montantPaye: 50000, statut: StatutDepense.PAYEE });

    const result = await ajouterPaiementDepense("site-1", "dep-1", "user-1", {
      montant: 50000,
      mode: ModePaiement.VIREMENT,
    });

    expect(result.statut).toBe(StatutDepense.PAYEE);
    expect(result.montantPaye).toBe(50000);
  });

  it("accepte un paiement superieur au reste (frais supplementaires possibles)", async () => {
    // La logique metier permet desormais les surpaiements pour couvrir les frais supplementaires.
    const depensePartielle = { ...FAKE_DEPENSE, montantPaye: 30000, statut: StatutDepense.PAYEE_PARTIELLEMENT };
    mockPrismaDepenseFindFirst.mockResolvedValue(depensePartielle);
    const paiementCree = { id: "pdep-2", montant: 25000, mode: ModePaiement.ESPECES, depenseId: "dep-1", userId: "user-1", siteId: "site-1", reference: null, date: new Date(), createdAt: new Date(), fraisSupp: [], user: { id: "user-1", name: "Admin" } };
    mockPrismaPaiementDepenseCreate.mockResolvedValue(paiementCree);
    mockPrismaPaiementDepenseFindUniqueOrThrow.mockResolvedValue(paiementCree);
    // Total paye apres: 30000 + 25000 = 55000 > montantTotal (50000) => PAYEE
    mockPrismaPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 55000 } });
    mockPrismaFraisPaiementDepenseCreateMany.mockResolvedValue({ count: 0 });
    mockPrismaFraisPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaDepenseUpdate.mockResolvedValue({ ...depensePartielle, montantPaye: 55000, statut: StatutDepense.PAYEE });

    const result = await ajouterPaiementDepense("site-1", "dep-1", "user-1", {
      montant: 25000,
      mode: ModePaiement.ESPECES,
    });

    expect(result.statut).toBe(StatutDepense.PAYEE);
    expect(result.montantPaye).toBe(55000);
  });

  it("refuse d'ajouter un paiement sur une depense PAYEE", async () => {
    mockPrismaDepenseFindFirst.mockResolvedValue({
      ...FAKE_DEPENSE,
      statut: StatutDepense.PAYEE,
      montantPaye: 50000,
    });

    await expect(
      ajouterPaiementDepense("site-1", "dep-1", "user-1", {
        montant: 1000,
        mode: ModePaiement.ESPECES,
      })
    ).rejects.toThrow("entierement payee");
  });

  it("leve une erreur si depense introuvable", async () => {
    mockPrismaDepenseFindFirst.mockResolvedValue(null);

    await expect(
      ajouterPaiementDepense("site-1", "dep-xxx", "user-1", {
        montant: 1000,
        mode: ModePaiement.ESPECES,
      })
    ).rejects.toThrow("introuvable");
  });
});

// ---------------------------------------------------------------------------
// API route tests — GET /api/depenses
// ---------------------------------------------------------------------------

import { GET as GET_DEPENSES, POST as POST_DEPENSES } from "@/app/api/depenses/route";
import { GET as GET_DEPENSE, PUT as PUT_DEPENSE, DELETE as DELETE_DEPENSE } from "@/app/api/depenses/[id]/route";
import { POST as POST_PAIEMENT } from "@/app/api/depenses/[id]/paiements/route";

describe("GET /api/depenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockPrismaDepenseFindMany.mockResolvedValue([FAKE_DEPENSE]);
    mockPrismaDepenseCount.mockResolvedValue(1);
  });

  it("retourne 200 avec liste des depenses", async () => {
    const response = await GET_DEPENSES(makeRequest("/api/depenses"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.limit).toBe(50);
    expect(data.offset).toBe(0);
  });

  it("retourne 403 sans permission DEPENSES_VOIR", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await GET_DEPENSES(makeRequest("/api/depenses"));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/depenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockPrismaDepenseCount.mockResolvedValue(0);
    mockPrismaDepenseCreate.mockResolvedValue({ ...FAKE_DEPENSE, numero: "DEP-2026-001" });
  });

  it("retourne 201 avec depense creee", async () => {
    const response = await POST_DEPENSES(
      makeRequest("/api/depenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Electricite mars",
          categorieDepense: CategorieDepense.ELECTRICITE,
          montantTotal: 45000,
          date: "2026-03-01T00:00:00.000Z",
        }),
      })
    );
    expect(response.status).toBe(201);
  });

  it("retourne 400 si description manquante", async () => {
    const response = await POST_DEPENSES(
      makeRequest("/api/depenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorieDepense: CategorieDepense.ELECTRICITE,
          montantTotal: 45000,
          date: "2026-03-01T00:00:00.000Z",
        }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("retourne 400 si montant negatif", async () => {
    const response = await POST_DEPENSES(
      makeRequest("/api/depenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Test",
          categorieDepense: CategorieDepense.ELECTRICITE,
          montantTotal: -1000,
          date: "2026-03-01T00:00:00.000Z",
        }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("retourne 403 sans permission DEPENSES_CREER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await POST_DEPENSES(
      makeRequest("/api/depenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "test", categorieDepense: CategorieDepense.AUTRE, montantTotal: 1000, date: "2026-03-01" }),
      })
    );
    expect(response.status).toBe(403);
  });
});

describe("GET /api/depenses/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockPrismaDepenseFindFirst.mockResolvedValue({ ...FAKE_DEPENSE, paiements: [], user: { id: "user-1", name: "Admin" } });
  });

  it("retourne 200 avec la depense", async () => {
    const response = await GET_DEPENSE(makeRequest("/api/depenses/dep-1"), { params: Promise.resolve({ id: "dep-1" }) });
    expect(response.status).toBe(200);
  });

  it("retourne 404 si depense introuvable", async () => {
    mockPrismaDepenseFindFirst.mockResolvedValue(null);
    const response = await GET_DEPENSE(makeRequest("/api/depenses/dep-xxx"), { params: Promise.resolve({ id: "dep-xxx" }) });
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/depenses/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    // Par defaut : deleteMany reussit (NON_PAYEE supprimee)
    mockPrismaDepenseDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("retourne 200 et supprime la depense NON_PAYEE", async () => {
    const response = await DELETE_DEPENSE(makeRequest("/api/depenses/dep-1", { method: "DELETE" }), { params: Promise.resolve({ id: "dep-1" }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("retourne 409 si depense a des paiements", async () => {
    // deleteMany retourne count=0 (statut non NON_PAYEE), findFirst retourne la depense avec statut non supprimable
    mockPrismaDepenseDeleteMany.mockResolvedValue({ count: 0 });
    mockPrismaDepenseFindFirst.mockResolvedValue({ id: "dep-1", statut: StatutDepense.PAYEE_PARTIELLEMENT });
    const response = await DELETE_DEPENSE(makeRequest("/api/depenses/dep-1", { method: "DELETE" }), { params: Promise.resolve({ id: "dep-1" }) });
    expect(response.status).toBe(409);
  });

  it("retourne 404 si depense introuvable", async () => {
    // deleteMany retourne count=0 (introuvable), findFirst retourne null
    mockPrismaDepenseDeleteMany.mockResolvedValue({ count: 0 });
    mockPrismaDepenseFindFirst.mockResolvedValue(null);
    const response = await DELETE_DEPENSE(makeRequest("/api/depenses/dep-xxx", { method: "DELETE" }), { params: Promise.resolve({ id: "dep-xxx" }) });
    expect(response.status).toBe(404);
  });
});

describe("POST /api/depenses/[id]/paiements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockPrismaDepenseFindFirst.mockResolvedValue(FAKE_DEPENSE);
    const paiementCree = { id: "pdep-1", montant: 20000, mode: ModePaiement.ESPECES, depenseId: "dep-1", userId: "user-1", siteId: "site-1", reference: null, date: new Date(), createdAt: new Date(), fraisSupp: [], user: { id: "user-1", name: "Admin" } };
    mockPrismaPaiementDepenseCreate.mockResolvedValue(paiementCree);
    mockPrismaPaiementDepenseFindUniqueOrThrow.mockResolvedValue(paiementCree);
    mockPrismaPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 20000 } });
    mockPrismaFraisPaiementDepenseCreateMany.mockResolvedValue({ count: 0 });
    mockPrismaFraisPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaDepenseUpdate.mockResolvedValue({ ...FAKE_DEPENSE, montantPaye: 20000, statut: StatutDepense.PAYEE_PARTIELLEMENT });
  });

  it("retourne 201 avec paiement cree", async () => {
    const response = await POST_PAIEMENT(
      makeRequest("/api/depenses/dep-1/paiements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: 20000, mode: ModePaiement.ESPECES }),
      }),
      { params: Promise.resolve({ id: "dep-1" }) }
    );
    expect(response.status).toBe(201);
  });

  it("retourne 400 si montant manquant", async () => {
    const response = await POST_PAIEMENT(
      makeRequest("/api/depenses/dep-1/paiements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: ModePaiement.ESPECES }),
      }),
      { params: Promise.resolve({ id: "dep-1" }) }
    );
    expect(response.status).toBe(400);
  });

  it("retourne 403 sans permission DEPENSES_PAYER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await POST_PAIEMENT(
      makeRequest("/api/depenses/dep-1/paiements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: 1000, mode: ModePaiement.ESPECES }),
      }),
      { params: Promise.resolve({ id: "dep-1" }) }
    );
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Unit tests — supprimerPaiementDepense
// ---------------------------------------------------------------------------

import { supprimerPaiementDepense } from "@/lib/queries/depenses";

const FAKE_PAIEMENT = {
  id: "pdep-1",
  depenseId: "dep-1",
  montant: 20000,
  mode: ModePaiement.ESPECES,
  reference: null,
  date: new Date("2026-03-15"),
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date(),
};

describe("supprimerPaiementDepense — logique metier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supprime un paiement et repasse a NON_PAYEE quand aucun paiement restant", async () => {
    // Depense PAYEE_PARTIELLEMENT avec un seul paiement de 20000
    const depensePartielle = { ...FAKE_DEPENSE, montantPaye: 20000, statut: StatutDepense.PAYEE_PARTIELLEMENT };
    mockPrismaDepenseFindFirst.mockResolvedValue(depensePartielle);
    mockPrismaPaiementDepenseFindFirst.mockResolvedValue(FAKE_PAIEMENT);
    mockPrismaAjustementDepenseCreate.mockResolvedValue({ id: "ajust-1" });
    mockPrismaPaiementDepenseDelete.mockResolvedValue(FAKE_PAIEMENT);
    // Apres suppression : aucun paiement restant
    mockPrismaPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaFraisPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaDepenseUpdate.mockResolvedValue({
      ...depensePartielle,
      montantPaye: 0,
      statut: StatutDepense.NON_PAYEE,
    });

    const result = await supprimerPaiementDepense("site-1", "dep-1", "pdep-1", "user-1");

    expect(result.statut).toBe(StatutDepense.NON_PAYEE);
    expect(result.montantPaye).toBe(0);
    expect(result.montantFraisSupp).toBe(0);
  });

  it("repasse a PAYEE_PARTIELLEMENT quand des paiements restants existent", async () => {
    // Depense PAYEE avec deux paiements ; on en supprime un
    const depensePayee = { ...FAKE_DEPENSE, montantPaye: 50000, statut: StatutDepense.PAYEE };
    mockPrismaDepenseFindFirst.mockResolvedValue(depensePayee);
    mockPrismaPaiementDepenseFindFirst.mockResolvedValue(FAKE_PAIEMENT);
    mockPrismaAjustementDepenseCreate.mockResolvedValue({ id: "ajust-2" });
    mockPrismaPaiementDepenseDelete.mockResolvedValue(FAKE_PAIEMENT);
    // Apres suppression : 30000 restants (< montantTotal de 50000)
    mockPrismaPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 30000 } });
    mockPrismaFraisPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaDepenseUpdate.mockResolvedValue({
      ...depensePayee,
      montantPaye: 30000,
      statut: StatutDepense.PAYEE_PARTIELLEMENT,
    });

    const result = await supprimerPaiementDepense("site-1", "dep-1", "pdep-1", "user-1");

    expect(result.statut).toBe(StatutDepense.PAYEE_PARTIELLEMENT);
    expect(result.montantPaye).toBe(30000);
  });

  it("leve une erreur si la depense est introuvable", async () => {
    mockPrismaDepenseFindFirst.mockResolvedValue(null);

    await expect(
      supprimerPaiementDepense("site-1", "dep-xxx", "pdep-1", "user-1")
    ).rejects.toThrow("Depense introuvable");
  });

  it("leve une erreur si le paiement n'appartient pas a la depense", async () => {
    mockPrismaDepenseFindFirst.mockResolvedValue(FAKE_DEPENSE);
    mockPrismaPaiementDepenseFindFirst.mockResolvedValue(null);

    await expect(
      supprimerPaiementDepense("site-1", "dep-1", "pdep-xxx", "user-1")
    ).rejects.toThrow("Paiement introuvable");
  });

  it("cree un audit trail AjustementDepense avant la suppression", async () => {
    mockPrismaDepenseFindFirst.mockResolvedValue(FAKE_DEPENSE);
    mockPrismaPaiementDepenseFindFirst.mockResolvedValue(FAKE_PAIEMENT);
    mockPrismaAjustementDepenseCreate.mockResolvedValue({ id: "ajust-3" });
    mockPrismaPaiementDepenseDelete.mockResolvedValue(FAKE_PAIEMENT);
    mockPrismaPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaFraisPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaDepenseUpdate.mockResolvedValue({ ...FAKE_DEPENSE, montantPaye: 0, statut: StatutDepense.NON_PAYEE });

    await supprimerPaiementDepense("site-1", "dep-1", "pdep-1", "user-1");

    expect(mockPrismaAjustementDepenseCreate).toHaveBeenCalledOnce();
    const createCall = mockPrismaAjustementDepenseCreate.mock.calls[0][0];
    expect(createCall.data.depenseId).toBe("dep-1");
    expect(createCall.data.paiementId).toBe("pdep-1");
    expect(createCall.data.montantAvant).toBe(20000);
    expect(createCall.data.montantApres).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// API route tests — DELETE /api/depenses/[id]/paiements/[paiementId]
// ---------------------------------------------------------------------------

import { DELETE as DELETE_PAIEMENT } from "@/app/api/depenses/[id]/paiements/[paiementId]/route";

describe("DELETE /api/depenses/[id]/paiements/[paiementId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    // Depense PAYEE_PARTIELLEMENT avec un paiement
    const depensePartielle = { ...FAKE_DEPENSE, montantPaye: 20000, statut: StatutDepense.PAYEE_PARTIELLEMENT };
    mockPrismaDepenseFindFirst.mockResolvedValue(depensePartielle);
    mockPrismaPaiementDepenseFindFirst.mockResolvedValue(FAKE_PAIEMENT);
    mockPrismaAjustementDepenseCreate.mockResolvedValue({ id: "ajust-1" });
    mockPrismaPaiementDepenseDelete.mockResolvedValue(FAKE_PAIEMENT);
    mockPrismaPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaFraisPaiementDepenseAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockPrismaDepenseUpdate.mockResolvedValue({
      ...depensePartielle,
      montantPaye: 0,
      montantFraisSupp: 0,
      statut: StatutDepense.NON_PAYEE,
    });
  });

  it("retourne 200 avec statut recalcule apres suppression du paiement", async () => {
    const response = await DELETE_PAIEMENT(
      makeRequest("/api/depenses/dep-1/paiements/pdep-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "dep-1", paiementId: "pdep-1" }) }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.statut).toBe(StatutDepense.NON_PAYEE);
    expect(data.montantPaye).toBe(0);
  });

  it("retourne 404 si la depense est introuvable", async () => {
    mockPrismaDepenseFindFirst.mockResolvedValue(null);
    const response = await DELETE_PAIEMENT(
      makeRequest("/api/depenses/dep-xxx/paiements/pdep-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "dep-xxx", paiementId: "pdep-1" }) }
    );
    expect(response.status).toBe(404);
  });

  it("retourne 404 si le paiement n'appartient pas a la depense", async () => {
    // La query retourne null quand le paiement n'existe pas ou n'appartient pas a la depense.
    // L'erreur levee contient "introuvable" donc l'API retourne 404 (avant le check "n'appartient pas").
    mockPrismaPaiementDepenseFindFirst.mockResolvedValue(null);
    const response = await DELETE_PAIEMENT(
      makeRequest("/api/depenses/dep-1/paiements/pdep-xxx", { method: "DELETE" }),
      { params: Promise.resolve({ id: "dep-1", paiementId: "pdep-xxx" }) }
    );
    expect(response.status).toBe(404);
  });

  it("retourne 403 sans permission DEPENSES_PAYER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));
    const response = await DELETE_PAIEMENT(
      makeRequest("/api/depenses/dep-1/paiements/pdep-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "dep-1", paiementId: "pdep-1" }) }
    );
    expect(response.status).toBe(403);
  });

  it("retourne 401 sans session", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie."));
    const response = await DELETE_PAIEMENT(
      makeRequest("/api/depenses/dep-1/paiements/pdep-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "dep-1", paiementId: "pdep-1" }) }
    );
    expect(response.status).toBe(401);
  });
});
