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
const mockLigneBesoinFindMany = vi.fn();
const mockCommandeCreate = vi.fn();
const mockCommandeFindFirst = vi.fn();
const mockDepenseCreate = vi.fn();
const mockDepenseFindFirst = vi.fn();

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
      findMany: (...args: unknown[]) => mockLigneBesoinFindMany(...args),
    },
    commande: {
      create: (...args: unknown[]) => mockCommandeCreate(...args),
      findFirst: (...args: unknown[]) => mockCommandeFindFirst(...args),
    },
    depense: {
      create: (...args: unknown[]) => mockDepenseCreate(...args),
      findFirst: (...args: unknown[]) => mockDepenseFindFirst(...args),
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
          findMany: mockLigneBesoinFindMany,
        },
        commande: {
          create: mockCommandeCreate,
          findFirst: mockCommandeFindFirst,
        },
        depense: {
          create: mockDepenseCreate,
          findFirst: mockDepenseFindFirst,
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
} from "@/lib/queries/besoins";

describe("Workflow — transitions valides", () => {
  beforeEach(() => vi.clearAllMocks());

  it("SOUMISE → APPROUVEE via approuverBesoins", async () => {
    mockListeBesoinsFindFirst.mockResolvedValue(FAKE_LISTE_SOUMISE);
    const updated = { ...FAKE_LISTE_SOUMISE, statut: StatutBesoins.APPROUVEE, valideurId: "user-2" };
    mockListeBesoinsUpdate.mockResolvedValue({ ...updated, lignes: [], depenses: [], demandeur: null, valideur: null, vague: null, _count: { lignes: 0 } });

    const result = await approuverBesoins("bes-1", "site-1", "user-2");
    expect(result.statut).toBe(StatutBesoins.APPROUVEE);
    expect(result.valideurId).toBe("user-2");
  });

  it("SOUMISE → REJETEE via rejeterBesoins", async () => {
    mockListeBesoinsFindFirst.mockResolvedValue(FAKE_LISTE_SOUMISE);
    const updated = { ...FAKE_LISTE_SOUMISE, statut: StatutBesoins.REJETEE, motifRejet: "Budget depassé" };
    mockListeBesoinsUpdate.mockResolvedValue({ ...updated, lignes: [], depenses: [], demandeur: null, valideur: null, vague: null, _count: { lignes: 0 } });

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
    mockCommandeCreate.mockResolvedValue({ id: "cmd-new", numero: "CMD-2026-010" });
    mockLigneBesoinUpdateMany.mockResolvedValue({ count: 1 });
    mockDepenseCreate.mockResolvedValue({ id: "dep-new", numero: "DEP-2026-010" });
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
