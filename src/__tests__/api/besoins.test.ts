/**
 * Tests Sprint 17 — Besoins + Workflow
 *
 * Couvre :
 * - Workflow transitions valides et invalides
 * - traiterBesoins : creation commandes BROUILLON, depense liee
 * - cloturerBesoins : calcul montantReel
 * - API routes : GET, POST, PUT, DELETE, approuver, rejeter, traiter, cloturer
 * - Permissions : 403 sans permission
 */

import { NextRequest } from "next/server";
import { StatutBesoins, Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListeBesoinsCreate = vi.fn();
const mockListeBesoinsFindFirst = vi.fn();
const mockListeBesoinsFindMany = vi.fn();
const mockListeBesoinsCount = vi.fn();
const mockListeBesoinsUpdate = vi.fn();
const mockListeBesoinsDelete = vi.fn();
const mockListeBesoinsFindUniqueOrThrow = vi.fn();
const mockLigneBesoinCreateMany = vi.fn();
const mockLigneBesoinDeleteMany = vi.fn();
const mockLigneBesoinUpdateMany = vi.fn();
const mockLigneBesoinUpdate = vi.fn();
const mockLigneBesoinFindMany = vi.fn();
const mockCommandeCreate = vi.fn();
const mockCommandeFindFirst = vi.fn();
const mockCommandeFindUniqueOrThrow = vi.fn();
const mockDepenseCreate = vi.fn();
const mockDepenseFindFirst = vi.fn();
const mockLigneDepenseCreateMany = vi.fn();
const mockLigneDepenseUpdateMany = vi.fn();
const mockListeBesoinsVagueCreateMany = vi.fn();
const mockListeBesoinsVagueDeleteMany = vi.fn();
const mockListeBesoinsVagueFindMany = vi.fn();
const mockMouvementStockCreate = vi.fn();
const mockProduitUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    listeBesoins: {
      create: (...args: unknown[]) => mockListeBesoinsCreate(...args),
      findFirst: (...args: unknown[]) => mockListeBesoinsFindFirst(...args),
      findMany: (...args: unknown[]) => mockListeBesoinsFindMany(...args),
      count: (...args: unknown[]) => mockListeBesoinsCount(...args),
      update: (...args: unknown[]) => mockListeBesoinsUpdate(...args),
      delete: (...args: unknown[]) => mockListeBesoinsDelete(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockListeBesoinsFindUniqueOrThrow(...args),
    },
    ligneBesoin: {
      createMany: (...args: unknown[]) => mockLigneBesoinCreateMany(...args),
      deleteMany: (...args: unknown[]) => mockLigneBesoinDeleteMany(...args),
      updateMany: (...args: unknown[]) => mockLigneBesoinUpdateMany(...args),
      update: (...args: unknown[]) => mockLigneBesoinUpdate(...args),
      findMany: (...args: unknown[]) => mockLigneBesoinFindMany(...args),
    },
    listeBesoinsVague: {
      createMany: (...args: unknown[]) => mockListeBesoinsVagueCreateMany(...args),
      deleteMany: (...args: unknown[]) => mockListeBesoinsVagueDeleteMany(...args),
      findMany: (...args: unknown[]) => mockListeBesoinsVagueFindMany(...args),
    },
    commande: {
      create: (...args: unknown[]) => mockCommandeCreate(...args),
      findFirst: (...args: unknown[]) => mockCommandeFindFirst(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockCommandeFindUniqueOrThrow(...args),
    },
    depense: {
      create: (...args: unknown[]) => mockDepenseCreate(...args),
      findFirst: (...args: unknown[]) => mockDepenseFindFirst(...args),
    },
    ligneDepense: {
      createMany: (...args: unknown[]) => mockLigneDepenseCreateMany(...args),
      updateMany: (...args: unknown[]) => mockLigneDepenseUpdateMany(...args),
    },
    mouvementStock: {
      create: (...args: unknown[]) => mockMouvementStockCreate(...args),
    },
    produit: {
      update: (...args: unknown[]) => mockProduitUpdate(...args),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        listeBesoins: {
          create: mockListeBesoinsCreate,
          findFirst: mockListeBesoinsFindFirst,
          update: mockListeBesoinsUpdate,
          delete: mockListeBesoinsDelete,
          findUniqueOrThrow: mockListeBesoinsFindUniqueOrThrow,
        },
        ligneBesoin: {
          createMany: mockLigneBesoinCreateMany,
          deleteMany: mockLigneBesoinDeleteMany,
          updateMany: mockLigneBesoinUpdateMany,
          update: mockLigneBesoinUpdate,
          findMany: mockLigneBesoinFindMany,
        },
        listeBesoinsVague: {
          createMany: mockListeBesoinsVagueCreateMany,
          deleteMany: mockListeBesoinsVagueDeleteMany,
          findMany: mockListeBesoinsVagueFindMany,
        },
        commande: {
          create: mockCommandeCreate,
          findFirst: mockCommandeFindFirst,
          findUniqueOrThrow: mockCommandeFindUniqueOrThrow,
        },
        depense: {
          create: mockDepenseCreate,
          findFirst: mockDepenseFindFirst,
        },
        ligneDepense: {
          createMany: mockLigneDepenseCreateMany,
          updateMany: mockLigneDepenseUpdateMany,
        },
        mouvementStock: {
          create: mockMouvementStockCreate,
        },
        produit: {
          update: mockProduitUpdate,
        },
      })
    ),
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

const FAKE_LISTE_SOUMISE = {
  id: "bes-1",
  numero: "BES-2026-001",
  titre: "Besoins test",
  demandeurId: "user-1",
  valideurId: null,
  vagueId: null,
  statut: StatutBesoins.SOUMISE,
  montantEstime: 50000,
  montantReel: null,
  motifRejet: null,
  notes: null,
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FAKE_LISTE_APPROUVEE = {
  ...FAKE_LISTE_SOUMISE,
  statut: StatutBesoins.APPROUVEE,
  valideurId: "user-2",
};

const FAKE_LISTE_TRAITEE = {
  ...FAKE_LISTE_SOUMISE,
  statut: StatutBesoins.TRAITEE,
  valideurId: "user-2",
};

const FAKE_LIGNES = [
  {
    id: "lb-1",
    listeBesoinsId: "bes-1",
    designation: "Aliment 3mm",
    produitId: "prod-1",
    quantite: 50,
    unite: null,
    prixEstime: 800,
    prixReel: null,
    commandeId: null,
    createdAt: new Date(),
    produit: {
      id: "prod-1",
      nom: "Aliment 3mm",
      categorie: "ALIMENT",
      fournisseur: { id: "fourn-1" },
    },
  },
  {
    id: "lb-2",
    listeBesoinsId: "bes-1",
    designation: "Sel marin",
    produitId: null,
    quantite: 10,
    unite: "kg",
    prixEstime: 200,
    prixReel: null,
    commandeId: null,
    createdAt: new Date(),
    produit: null,
  },
];

function makeRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ---------------------------------------------------------------------------
// Unit tests — workflow transitions
// ---------------------------------------------------------------------------

import {
  approuverBesoins,
  rejeterBesoins,
  cloturerBesoins,
  traiterBesoins,
  creerCommandeDepuisBesoin,
} from "@/lib/queries/besoins";

describe("Workflow — transitions valides", () => {
  beforeEach(() => vi.clearAllMocks());

  it("SOUMISE → APPROUVEE via approuverBesoins", async () => {
    mockListeBesoinsFindFirst.mockResolvedValue(FAKE_LISTE_SOUMISE);
    const updated = { ...FAKE_LISTE_SOUMISE, statut: StatutBesoins.APPROUVEE, valideurId: "user-2" };
    mockListeBesoinsUpdate.mockResolvedValue(updated);
    // approuverBesoins fait update() puis findUniqueOrThrow(include: ...) — le resultat vient de findUniqueOrThrow
    mockListeBesoinsFindUniqueOrThrow.mockResolvedValue({ ...updated, lignes: [], depenses: [], demandeur: null, valideur: null, vague: null, _count: { lignes: 0 } });

    const result = await approuverBesoins("bes-1", "site-1", "user-2");
    expect(result.statut).toBe(StatutBesoins.APPROUVEE);
    expect(result.valideurId).toBe("user-2");
  });

  it("SOUMISE → REJETEE via rejeterBesoins", async () => {
    mockListeBesoinsFindFirst.mockResolvedValue(FAKE_LISTE_SOUMISE);
    const updated = { ...FAKE_LISTE_SOUMISE, statut: StatutBesoins.REJETEE, motifRejet: "Budget depassé" };
    mockListeBesoinsUpdate.mockResolvedValue(updated);
    // rejeterBesoins fait update() puis findUniqueOrThrow(include: ...) — le resultat vient de findUniqueOrThrow
    mockListeBesoinsFindUniqueOrThrow.mockResolvedValue({ ...updated, lignes: [], depenses: [], demandeur: null, valideur: null, vague: null, _count: { lignes: 0 } });

    const result = await rejeterBesoins("bes-1", "site-1", "user-2", "Budget depassé");
    expect(result.statut).toBe(StatutBesoins.REJETEE);
    expect(result.motifRejet).toBe("Budget depassé");
  });

  it("TRAITEE → CLOTUREE via cloturerBesoins calcule montantReel", async () => {
    mockListeBesoinsFindFirst.mockResolvedValue({ ...FAKE_LISTE_TRAITEE, lignes: FAKE_LIGNES });
    mockLigneBesoinUpdateMany.mockResolvedValue({ count: 1 });
    // Lignes avec prixReel mis a jour
    mockLigneBesoinFindMany.mockResolvedValue([
      { ...FAKE_LIGNES[0], prixReel: 750 },
      { ...FAKE_LIGNES[1], prixReel: 180 },
    ]);
    // montantReel = 50*750 + 10*180 = 37500 + 1800 = 39300
    const updated = { ...FAKE_LISTE_TRAITEE, statut: StatutBesoins.CLOTUREE, montantReel: 39300 };
    mockListeBesoinsUpdate.mockResolvedValue({ ...updated, lignes: [], depenses: [], demandeur: null, valideur: null, vague: null, _count: { lignes: 0 } });

    const result = await cloturerBesoins("bes-1", "site-1", {
      lignesReelles: [
        { ligneBesoinId: "lb-1", prixReel: 750 },
        { ligneBesoinId: "lb-2", prixReel: 180 },
      ],
    });
    expect(result.statut).toBe(StatutBesoins.CLOTUREE);
    expect(result.montantReel).toBe(39300);
  });
});

describe("Workflow — transitions invalides", () => {
  beforeEach(() => vi.clearAllMocks());

  it("REJETEE → APPROUVEE est refusee", async () => {
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      statut: StatutBesoins.REJETEE,
    });
    await expect(approuverBesoins("bes-1", "site-1", "user-2")).rejects.toThrow(
      "Transition invalide"
    );
  });

  it("CLOTUREE → TRAITEE est refusee", async () => {
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      statut: StatutBesoins.CLOTUREE,
    });
    await expect(
      cloturerBesoins("bes-1", "site-1", { lignesReelles: [] })
    ).rejects.toThrow("Transition invalide");
  });

  it("APPROUVEE → REJETEE est refusee", async () => {
    mockListeBesoinsFindFirst.mockResolvedValue(FAKE_LISTE_APPROUVEE);
    await expect(
      rejeterBesoins("bes-1", "site-1", "user-2")
    ).rejects.toThrow("Transition invalide");
  });
});

// ---------------------------------------------------------------------------
// API Routes tests
// ---------------------------------------------------------------------------

import { GET, POST } from "@/app/api/besoins/route";
import { GET as GET_ID, PUT, DELETE } from "@/app/api/besoins/[id]/route";
import { POST as POST_APPROUVER } from "@/app/api/besoins/[id]/approuver/route";
import { POST as POST_REJETER } from "@/app/api/besoins/[id]/rejeter/route";
import { POST as POST_TRAITER } from "@/app/api/besoins/[id]/traiter/route";
import { POST as POST_CLOTURER } from "@/app/api/besoins/[id]/cloturer/route";

const PARAMS = { params: Promise.resolve({ id: "bes-1" }) };

describe("GET /api/besoins", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 200 avec liste des besoins", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindMany.mockResolvedValue([FAKE_LISTE_SOUMISE]);
    mockListeBesoinsCount.mockResolvedValue(1);

    const req = makeRequest("http://localhost:3000/api/besoins");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.total).toBe(1);
  });

  it("retourne 403 sans permission BESOINS_SOUMETTRE", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission refusee")
    );

    const req = makeRequest("http://localhost:3000/api/besoins");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("filtre par vagueId via vagues some query path", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindMany.mockResolvedValue([FAKE_LISTE_SOUMISE]);
    mockListeBesoinsCount.mockResolvedValue(1);

    const req = makeRequest(
      "http://localhost:3000/api/besoins?vagueId=vague-42"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    // Verify that findMany was called with a filter including the vagueId
    const callArgs = mockListeBesoinsFindMany.mock.calls[0]?.[0];
    const whereClause = JSON.stringify(callArgs?.where ?? {});
    expect(whereClause).toContain("vague-42");
  });
});

describe("POST /api/besoins", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 201 avec liste creee", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue(null); // no existing
    mockListeBesoinsCreate.mockResolvedValue(FAKE_LISTE_SOUMISE);
    mockLigneBesoinCreateMany.mockResolvedValue({ count: 1 });
    mockListeBesoinsFindUniqueOrThrow.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      lignes: [],
      depenses: [],
      demandeur: { id: "user-1", name: "Admin" },
      valideur: null,
      vague: null,
      _count: { lignes: 0 },
    });

    const req = makeRequest("http://localhost:3000/api/besoins", {
      method: "POST",
      body: JSON.stringify({
        titre: "Besoins test",
        lignes: [
          {
            designation: "Aliment 3mm",
            quantite: 50,
            prixEstime: 800,
          },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("retourne 400 si titre manquant", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/besoins", {
      method: "POST",
      body: JSON.stringify({
        lignes: [{ designation: "Test", quantite: 1, prixEstime: 100 }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si lignes vides", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/besoins", {
      method: "POST",
      body: JSON.stringify({ titre: "Test", lignes: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 403 sans permission BESOINS_SOUMETTRE", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission refusee")
    );

    const req = makeRequest("http://localhost:3000/api/besoins", {
      method: "POST",
      body: JSON.stringify({ titre: "Test", lignes: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("retourne 201 avec payload multi-vague (deux vagues, ratios = 1.0)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue(null);
    mockListeBesoinsCreate.mockResolvedValue(FAKE_LISTE_SOUMISE);
    mockLigneBesoinCreateMany.mockResolvedValue({ count: 1 });
    mockListeBesoinsVagueCreateMany.mockResolvedValue({ count: 2 });
    mockListeBesoinsFindUniqueOrThrow.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      lignes: [],
      depenses: [],
      demandeur: { id: "user-1", name: "Admin" },
      valideur: null,
      vagues: [
        { id: "lbv-1", vagueId: "vague-1", ratio: 0.6 },
        { id: "lbv-2", vagueId: "vague-2", ratio: 0.4 },
      ],
      _count: { lignes: 1 },
    });

    const req = makeRequest("http://localhost:3000/api/besoins", {
      method: "POST",
      body: JSON.stringify({
        titre: "Besoins multi-vague",
        lignes: [{ designation: "Aliment 3mm", quantite: 50, prixEstime: 800 }],
        vagues: [
          { vagueId: "vague-1", ratio: 0.6 },
          { vagueId: "vague-2", ratio: 0.4 },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockListeBesoinsVagueCreateMany).toHaveBeenCalled();
  });

  it("retourne 400 si la somme des ratios vagues != 1.0", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/besoins", {
      method: "POST",
      body: JSON.stringify({
        titre: "Besoins mauvais ratios",
        lignes: [{ designation: "Aliment", quantite: 10, prixEstime: 500 }],
        vagues: [
          { vagueId: "vague-1", ratio: 0.5 },
          { vagueId: "vague-2", ratio: 0.3 },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    // apiError wraps details in the errors array; check the error message there
    const errorsText = JSON.stringify(data.errors ?? data);
    expect(errorsText).toMatch(/ratios/i);
  });

  it("retourne 400 si vagueId duplique dans le payload vagues", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/besoins", {
      method: "POST",
      body: JSON.stringify({
        titre: "Besoins avec doublons",
        lignes: [{ designation: "Aliment", quantite: 10, prixEstime: 500 }],
        vagues: [
          { vagueId: "vague-1", ratio: 0.5 },
          { vagueId: "vague-1", ratio: 0.5 },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    // apiError wraps details in the errors array; check the error message there
    const errorsText = JSON.stringify(data.errors ?? data);
    expect(errorsText).toMatch(/une seule fois/i);
  });
});

describe("GET /api/besoins/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 200 avec la liste de besoins", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      lignes: [],
      depenses: [],
      demandeur: { id: "user-1", name: "Admin" },
      valideur: null,
      vague: null,
      _count: { lignes: 0 },
    });

    const req = makeRequest("http://localhost:3000/api/besoins/bes-1");
    const res = await GET_ID(req, PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.numero).toBe("BES-2026-001");
  });

  it("retourne 404 si liste introuvable", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/besoins/bes-99");
    const res = await GET_ID(req, { params: Promise.resolve({ id: "bes-99" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/besoins/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 200 et supprime une liste SOUMISE", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue(FAKE_LISTE_SOUMISE);
    mockListeBesoinsDelete.mockResolvedValue(FAKE_LISTE_SOUMISE);

    const req = makeRequest("http://localhost:3000/api/besoins/bes-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(200);
  });

  it("retourne 400 si liste n'est plus SOUMISE", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue(FAKE_LISTE_APPROUVEE);

    const req = makeRequest("http://localhost:3000/api/besoins/bes-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/besoins/[id]/approuver", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 200 avec liste APPROUVEE", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue(FAKE_LISTE_SOUMISE);
    mockListeBesoinsUpdate.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      statut: StatutBesoins.APPROUVEE,
      valideurId: "user-1",
    });
    mockListeBesoinsFindUniqueOrThrow.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      statut: StatutBesoins.APPROUVEE,
      valideurId: "user-1",
      lignes: [],
      depenses: [],
      demandeur: null,
      valideur: null,
      vague: null,
      _count: { lignes: 0 },
    });

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/approuver",
      { method: "POST" }
    );
    const res = await POST_APPROUVER(req, PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statut).toBe(StatutBesoins.APPROUVEE);
  });

  it("retourne 400 si transition invalide (REJETEE → APPROUVEE)", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      statut: StatutBesoins.REJETEE,
    });

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/approuver",
      { method: "POST" }
    );
    const res = await POST_APPROUVER(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it("retourne 403 sans permission BESOINS_APPROUVER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission refusee")
    );

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/approuver",
      { method: "POST" }
    );
    const res = await POST_APPROUVER(req, PARAMS);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/besoins/[id]/rejeter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 200 avec liste REJETEE", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue(FAKE_LISTE_SOUMISE);
    mockListeBesoinsUpdate.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      statut: StatutBesoins.REJETEE,
      motifRejet: "Budget insuffisant",
    });
    mockListeBesoinsFindUniqueOrThrow.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      statut: StatutBesoins.REJETEE,
      motifRejet: "Budget insuffisant",
      lignes: [],
      depenses: [],
      demandeur: null,
      valideur: null,
      vague: null,
      _count: { lignes: 0 },
    });

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/rejeter",
      {
        method: "POST",
        body: JSON.stringify({ motif: "Budget insuffisant" }),
      }
    );
    const res = await POST_REJETER(req, PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statut).toBe(StatutBesoins.REJETEE);
  });
});

describe("POST /api/besoins/[id]/traiter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 400 si ligneActions manquant", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/traiter",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    const res = await POST_TRAITER(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it("retourne 403 sans permission BESOINS_TRAITER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission refusee")
    );

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/traiter",
      {
        method: "POST",
        body: JSON.stringify({ ligneActions: [] }),
      }
    );
    const res = await POST_TRAITER(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retourne 200 apres traitement reussi", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_APPROUVEE,
      lignes: FAKE_LIGNES,
    });
    mockCommandeFindFirst.mockResolvedValue(null);
    mockDepenseFindFirst.mockResolvedValue(null);
    mockCommandeCreate.mockResolvedValue({
      id: "cmd-new",
      numero: "CMD-2026-010",
      lignes: [{ id: "lc-new-1", produitId: "prod-1" }],
    });
    mockCommandeFindUniqueOrThrow.mockResolvedValue({
      id: "cmd-new",
      numero: "CMD-2026-010",
      lignes: [{ id: "lc-new-1", produitId: "prod-1" }],
    });
    mockLigneBesoinUpdateMany.mockResolvedValue({ count: 1 });
    mockDepenseCreate.mockResolvedValue({ id: "dep-new", numero: "DEP-2026-010" });
    mockLigneDepenseCreateMany.mockResolvedValue({ count: 2 });
    mockListeBesoinsUpdate.mockResolvedValue({
      ...FAKE_LISTE_APPROUVEE,
      statut: StatutBesoins.TRAITEE,
      lignes: FAKE_LIGNES,
      depenses: [{ id: "dep-new", numero: "DEP-2026-010", montantTotal: 50000, statut: "NON_PAYEE" }],
      demandeur: null,
      valideur: null,
      vague: null,
      _count: { lignes: 2 },
    });

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/traiter",
      {
        method: "POST",
        body: JSON.stringify({
          ligneActions: [
            { ligneBesoinId: "lb-1", action: "COMMANDE" },
            { ligneBesoinId: "lb-2", action: "LIBRE" },
          ],
        }),
      }
    );
    const res = await POST_TRAITER(req, PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statut).toBe(StatutBesoins.TRAITEE);
  });
});

describe("POST /api/besoins/[id]/cloturer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 400 si lignesReelles manquant", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/cloturer",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    const res = await POST_CLOTURER(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it("retourne 200 apres cloture reussie", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue({ ...FAKE_LISTE_TRAITEE, lignes: FAKE_LIGNES });
    mockLigneBesoinUpdateMany.mockResolvedValue({ count: 1 });
    mockLigneBesoinFindMany.mockResolvedValue([
      { ...FAKE_LIGNES[0], prixReel: 750 },
      { ...FAKE_LIGNES[1], prixReel: 180 },
    ]);
    mockListeBesoinsUpdate.mockResolvedValue({
      ...FAKE_LISTE_TRAITEE,
      statut: StatutBesoins.CLOTUREE,
      montantReel: 39300,
      lignes: [],
      depenses: [],
      demandeur: null,
      valideur: null,
      vague: null,
      _count: { lignes: 0 },
    });

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/cloturer",
      {
        method: "POST",
        body: JSON.stringify({
          lignesReelles: [
            { ligneBesoinId: "lb-1", prixReel: 750 },
            { ligneBesoinId: "lb-2", prixReel: 180 },
          ],
        }),
      }
    );
    const res = await POST_CLOTURER(req, PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statut).toBe(StatutBesoins.CLOTUREE);
    expect(data.montantReel).toBe(39300);
  });
});

// ---------------------------------------------------------------------------
// traiterBesoins — comportement enrichi (Fix bug : besoins sans commande / sans stock)
// ---------------------------------------------------------------------------

describe("traiterBesoins — LIBRE + produit cree un MouvementStock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cree un MouvementStock ENTREE et incremente Produit.stockActuel pour LIBRE+produit", async () => {
    const ligneLibreAvecProduit = {
      id: "lb-libre-prod",
      listeBesoinsId: "bes-1",
      designation: "Aliment 4mm",
      produitId: "prod-2",
      quantite: 30,
      unite: null,
      prixEstime: 600,
      prixReel: null,
      commandeId: null,
      createdAt: new Date(),
      produit: {
        id: "prod-2",
        nom: "Aliment 4mm",
        categorie: "ALIMENT",
        uniteAchat: "sac",
        contenance: 25,
        fournisseur: null,
      },
    };

    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_APPROUVEE,
      lignes: [ligneLibreAvecProduit],
    });
    mockCommandeFindFirst.mockResolvedValue(null);
    mockDepenseCreate.mockResolvedValue({ id: "dep-x", numero: "DEP-2026-001" });
    mockLigneDepenseCreateMany.mockResolvedValue({ count: 1 });
    mockMouvementStockCreate.mockResolvedValue({ id: "mvt-1" });
    mockProduitUpdate.mockResolvedValue({ id: "prod-2" });
    mockListeBesoinsUpdate.mockResolvedValue({
      ...FAKE_LISTE_APPROUVEE,
      statut: StatutBesoins.TRAITEE,
      lignes: [],
      depenses: [],
      demandeur: null,
      valideur: null,
      vague: null,
      _count: { lignes: 1 },
    });

    await traiterBesoins("bes-1", "site-1", "user-1", {
      ligneActions: [{ ligneBesoinId: "lb-libre-prod", action: "LIBRE" }],
    });

    // Verifier creation du mouvement stock ENTREE
    expect(mockMouvementStockCreate).toHaveBeenCalledTimes(1);
    const mvtArgs = mockMouvementStockCreate.mock.calls[0][0];
    expect(mvtArgs.data.produitId).toBe("prod-2");
    expect(mvtArgs.data.type).toBe("ENTREE");
    expect(mvtArgs.data.quantite).toBe(30);

    // Verifier increment du stockActuel (avec conversion : 30 sacs * 25 = 750 unites de base)
    expect(mockProduitUpdate).toHaveBeenCalledTimes(1);
    const updArgs = mockProduitUpdate.mock.calls[0][0];
    expect(updArgs.where.id).toBe("prod-2");
    expect(updArgs.data.stockActuel.increment).toBe(750);
  });

  it("ne cree pas de MouvementStock pour LIBRE sans produit", async () => {
    const ligneLibreSansProduit = {
      id: "lb-libre",
      listeBesoinsId: "bes-1",
      designation: "Frais divers",
      produitId: null,
      quantite: 1,
      unite: null,
      prixEstime: 5000,
      prixReel: null,
      commandeId: null,
      createdAt: new Date(),
      produit: null,
    };

    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_APPROUVEE,
      lignes: [ligneLibreSansProduit],
    });
    mockCommandeFindFirst.mockResolvedValue(null);
    mockDepenseCreate.mockResolvedValue({ id: "dep-x", numero: "DEP-2026-001" });
    mockLigneDepenseCreateMany.mockResolvedValue({ count: 1 });
    mockListeBesoinsUpdate.mockResolvedValue({
      ...FAKE_LISTE_APPROUVEE,
      statut: StatutBesoins.TRAITEE,
      lignes: [],
      depenses: [],
      demandeur: null,
      valideur: null,
      vague: null,
      _count: { lignes: 1 },
    });

    await traiterBesoins("bes-1", "site-1", "user-1", {
      ligneActions: [{ ligneBesoinId: "lb-libre", action: "LIBRE" }],
    });

    expect(mockMouvementStockCreate).not.toHaveBeenCalled();
    expect(mockProduitUpdate).not.toHaveBeenCalled();
  });
});

describe("traiterBesoins — COMMANDE sans fournisseur leve une erreur", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejette une ligne COMMANDE dont le produit n'a pas de fournisseur (et pas de fallback DTO)", async () => {
    const ligneSansFournisseur = {
      id: "lb-no-supp",
      listeBesoinsId: "bes-1",
      designation: "Produit X",
      produitId: "prod-orphan",
      quantite: 5,
      unite: null,
      prixEstime: 1000,
      prixReel: null,
      commandeId: null,
      createdAt: new Date(),
      produit: {
        id: "prod-orphan",
        nom: "Produit X",
        categorie: "ALIMENT",
        uniteAchat: null,
        contenance: null,
        fournisseur: null, // pas de fournisseur sur le produit
      },
    };

    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_APPROUVEE,
      lignes: [ligneSansFournisseur],
    });

    await expect(
      traiterBesoins("bes-1", "site-1", "user-1", {
        ligneActions: [{ ligneBesoinId: "lb-no-supp", action: "COMMANDE" }],
      })
    ).rejects.toThrow(/COMMANDE impossible sans fournisseur/);

    // Aucune commande ne doit etre creee
    expect(mockCommandeCreate).not.toHaveBeenCalled();
  });

  it("accepte la commande quand dto.fournisseurId fournit un fallback", async () => {
    const ligneSansFournisseur = {
      id: "lb-no-supp",
      listeBesoinsId: "bes-1",
      designation: "Produit X",
      produitId: "prod-orphan",
      quantite: 5,
      unite: null,
      prixEstime: 1000,
      prixReel: null,
      commandeId: null,
      createdAt: new Date(),
      produit: {
        id: "prod-orphan",
        nom: "Produit X",
        categorie: "ALIMENT",
        uniteAchat: null,
        contenance: null,
        fournisseur: null,
      },
    };

    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_APPROUVEE,
      lignes: [ligneSansFournisseur],
    });
    mockCommandeFindFirst.mockResolvedValue(null);
    mockCommandeCreate.mockResolvedValue({
      id: "cmd-1",
      numero: "CMD-2026-001",
      lignes: [{ id: "lc-1", produitId: "prod-orphan" }],
    });
    mockCommandeFindUniqueOrThrow.mockResolvedValue({
      id: "cmd-1",
      numero: "CMD-2026-001",
      lignes: [{ id: "lc-1", produitId: "prod-orphan" }],
    });
    mockLigneBesoinUpdateMany.mockResolvedValue({ count: 1 });
    mockListeBesoinsUpdate.mockResolvedValue({
      ...FAKE_LISTE_APPROUVEE,
      statut: StatutBesoins.TRAITEE,
      lignes: [],
      depenses: [],
      demandeur: null,
      valideur: null,
      vague: null,
      _count: { lignes: 1 },
    });

    await traiterBesoins("bes-1", "site-1", "user-1", {
      ligneActions: [{ ligneBesoinId: "lb-no-supp", action: "COMMANDE" }],
      fournisseurId: "fourn-fallback",
    });

    expect(mockCommandeCreate).toHaveBeenCalledTimes(1);
    const cmdArgs = mockCommandeCreate.mock.calls[0][0];
    expect(cmdArgs.data.fournisseurId).toBe("fourn-fallback");
  });
});

// ---------------------------------------------------------------------------
// creerCommandeDepuisBesoin — recuperation post-traitement
// ---------------------------------------------------------------------------

describe("creerCommandeDepuisBesoin", () => {
  beforeEach(() => vi.clearAllMocks());

  const FAKE_LISTE_CLOTUREE = {
    ...FAKE_LISTE_TRAITEE,
    statut: StatutBesoins.CLOTUREE,
  };

  const ORPHELINE_AVEC_FOURNISSEUR = {
    id: "lb-orph",
    listeBesoinsId: "bes-1",
    designation: "Aliment 6mm",
    produitId: "prod-3",
    quantite: 10,
    unite: null,
    prixEstime: 700,
    prixReel: 720,
    commandeId: null,
    createdAt: new Date(),
    produit: {
      id: "prod-3",
      nom: "Aliment 6mm",
      categorie: "ALIMENT",
      uniteAchat: null,
      contenance: null,
      fournisseur: { id: "fourn-A" },
    },
    lignesDepense: [],
  };

  it("cree une Commande BROUILLON pour des lignes orphelines (CLOTUREE)", async () => {
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_CLOTUREE,
      lignes: [ORPHELINE_AVEC_FOURNISSEUR],
    });
    mockCommandeFindFirst.mockResolvedValue(null);
    mockCommandeCreate.mockResolvedValue({
      id: "cmd-new",
      numero: "CMD-2026-005",
      lignes: [{ id: "lc-new", produitId: "prod-3" }],
    });
    mockCommandeFindUniqueOrThrow.mockResolvedValue({
      id: "cmd-new",
      numero: "CMD-2026-005",
      lignes: [{ id: "lc-new", produitId: "prod-3" }],
    });
    mockLigneBesoinUpdate.mockResolvedValue({ id: "lb-orph" });
    mockListeBesoinsFindUniqueOrThrow.mockResolvedValue({
      ...FAKE_LISTE_CLOTUREE,
      lignes: [],
      depenses: [],
      demandeur: null,
      valideur: null,
      vague: null,
      _count: { lignes: 1 },
    });

    await creerCommandeDepuisBesoin("bes-1", "site-1", "user-1", {
      ligneBesoinIds: ["lb-orph"],
    });

    expect(mockCommandeCreate).toHaveBeenCalledTimes(1);
    const cmdArgs = mockCommandeCreate.mock.calls[0][0];
    expect(cmdArgs.data.statut).toBe("BROUILLON");
    expect(cmdArgs.data.fournisseurId).toBe("fourn-A");
    expect(cmdArgs.data.listeBesoinsId).toBe("bes-1");
    // prixUnitaire utilise prixReel quand present
    expect(cmdArgs.data.lignes.create[0].prixUnitaire).toBe(720);

    // La ligne a son commandeId rempli (et pas LigneDepense.updateMany car aucune existante)
    expect(mockLigneBesoinUpdate).toHaveBeenCalledTimes(1);
    expect(mockLigneDepenseUpdateMany).not.toHaveBeenCalled();
  });

  it("rattache une LigneDepense existante a la nouvelle LigneCommande", async () => {
    const orphelineAvecDepense = {
      ...ORPHELINE_AVEC_FOURNISSEUR,
      id: "lb-orph-2",
      lignesDepense: [{ id: "ld-existing" }],
    };
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_CLOTUREE,
      lignes: [orphelineAvecDepense],
    });
    mockCommandeFindFirst.mockResolvedValue(null);
    mockCommandeCreate.mockResolvedValue({
      id: "cmd-new",
      numero: "CMD-2026-006",
      lignes: [{ id: "lc-new", produitId: "prod-3" }],
    });
    mockCommandeFindUniqueOrThrow.mockResolvedValue({
      id: "cmd-new",
      numero: "CMD-2026-006",
      lignes: [{ id: "lc-new", produitId: "prod-3" }],
    });
    mockLigneBesoinUpdate.mockResolvedValue({ id: "lb-orph-2" });
    mockLigneDepenseUpdateMany.mockResolvedValue({ count: 1 });
    mockListeBesoinsFindUniqueOrThrow.mockResolvedValue({
      ...FAKE_LISTE_CLOTUREE,
      lignes: [],
      depenses: [],
      demandeur: null,
      valideur: null,
      vague: null,
      _count: { lignes: 1 },
    });

    await creerCommandeDepuisBesoin("bes-1", "site-1", "user-1", {
      ligneBesoinIds: ["lb-orph-2"],
    });

    // LigneDepense.updateMany doit lier ligneCommandeId pour eviter le double comptage
    expect(mockLigneDepenseUpdateMany).toHaveBeenCalledTimes(1);
    const args = mockLigneDepenseUpdateMany.mock.calls[0][0];
    expect(args.where.ligneBesoinId).toBe("lb-orph-2");
    expect(args.data.ligneCommandeId).toBe("lc-new");
  });

  it("rejette une ligne deja liee a une commande", async () => {
    const dejaCommandee = {
      ...ORPHELINE_AVEC_FOURNISSEUR,
      commandeId: "cmd-deja",
    };
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_CLOTUREE,
      lignes: [dejaCommandee],
    });

    await expect(
      creerCommandeDepuisBesoin("bes-1", "site-1", "user-1", {
        ligneBesoinIds: ["lb-orph"],
      })
    ).rejects.toThrow(/deja liee a une commande/);
  });

  it("rejette une ligne sans produit", async () => {
    const ligneSansProduit = {
      ...ORPHELINE_AVEC_FOURNISSEUR,
      produitId: null,
      produit: null,
    };
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_CLOTUREE,
      lignes: [ligneSansProduit],
    });

    await expect(
      creerCommandeDepuisBesoin("bes-1", "site-1", "user-1", {
        ligneBesoinIds: ["lb-orph"],
      })
    ).rejects.toThrow(/n'a pas de produit lie/);
  });

  it("rejette si le besoin n'est pas TRAITEE/CLOTUREE", async () => {
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_SOUMISE,
      lignes: [ORPHELINE_AVEC_FOURNISSEUR],
    });

    await expect(
      creerCommandeDepuisBesoin("bes-1", "site-1", "user-1", {
        ligneBesoinIds: ["lb-orph"],
      })
    ).rejects.toThrow(/TRAITEE ou CLOTUREE/);
  });

  it("rejette si aucun fournisseur resolvable", async () => {
    const sansFournisseur = {
      ...ORPHELINE_AVEC_FOURNISSEUR,
      produit: { ...ORPHELINE_AVEC_FOURNISSEUR.produit, fournisseur: null },
    };
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_CLOTUREE,
      lignes: [sansFournisseur],
    });

    await expect(
      creerCommandeDepuisBesoin("bes-1", "site-1", "user-1", {
        ligneBesoinIds: ["lb-orph"],
      })
    ).rejects.toThrow(/Aucun fournisseur n'est defini/);
  });
});

// ---------------------------------------------------------------------------
// POST /api/besoins/[id]/commandes — Validation route
// ---------------------------------------------------------------------------

import { POST as POST_CREER_COMMANDE } from "@/app/api/besoins/[id]/commandes/route";

describe("POST /api/besoins/[id]/commandes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 400 si ligneBesoinIds vide", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/commandes",
      {
        method: "POST",
        body: JSON.stringify({ ligneBesoinIds: [] }),
      }
    );
    const res = await POST_CREER_COMMANDE(req, PARAMS);
    expect(res.status).toBe(400);
  });

  it("retourne 403 sans permission BESOINS_TRAITER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission refusee")
    );

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/commandes",
      {
        method: "POST",
        body: JSON.stringify({ ligneBesoinIds: ["lb-1"] }),
      }
    );
    const res = await POST_CREER_COMMANDE(req, PARAMS);
    expect(res.status).toBe(403);
  });

  it("retourne 201 apres creation reussie", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockListeBesoinsFindFirst.mockResolvedValue({
      ...FAKE_LISTE_TRAITEE,
      lignes: [
        {
          id: "lb-1",
          listeBesoinsId: "bes-1",
          designation: "Aliment 3mm",
          produitId: "prod-1",
          quantite: 50,
          unite: null,
          prixEstime: 800,
          prixReel: null,
          commandeId: null,
          createdAt: new Date(),
          produit: {
            id: "prod-1",
            nom: "Aliment 3mm",
            categorie: "ALIMENT",
            uniteAchat: null,
            contenance: null,
            fournisseur: { id: "fourn-1" },
          },
          lignesDepense: [],
        },
      ],
    });
    mockCommandeFindFirst.mockResolvedValue(null);
    mockCommandeCreate.mockResolvedValue({
      id: "cmd-new",
      numero: "CMD-2026-010",
      lignes: [{ id: "lc-new", produitId: "prod-1" }],
    });
    mockCommandeFindUniqueOrThrow.mockResolvedValue({
      id: "cmd-new",
      numero: "CMD-2026-010",
      lignes: [{ id: "lc-new", produitId: "prod-1" }],
    });
    mockLigneBesoinUpdate.mockResolvedValue({ id: "lb-1" });
    mockListeBesoinsFindUniqueOrThrow.mockResolvedValue({
      ...FAKE_LISTE_TRAITEE,
      lignes: [],
      depenses: [],
      demandeur: null,
      valideur: null,
      vague: null,
      _count: { lignes: 1 },
    });

    const req = makeRequest(
      "http://localhost:3000/api/besoins/bes-1/commandes",
      {
        method: "POST",
        body: JSON.stringify({ ligneBesoinIds: ["lb-1"] }),
      }
    );
    const res = await POST_CREER_COMMANDE(req, PARAMS);
    expect(res.status).toBe(201);
  });
});
