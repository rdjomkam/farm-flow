import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/packs/route";
import { GET as GET_DETAIL, PUT, DELETE } from "@/app/api/packs/[id]/route";
import {
  GET as GET_PRODUITS,
  POST as POST_PRODUIT,
  DELETE as DELETE_PRODUIT,
} from "@/app/api/packs/[id]/produits/route";
import { GET as GET_ACTIVATIONS } from "@/app/api/activations/route";
import { POST as POST_ACTIVER } from "@/app/api/packs/[id]/activer/route";
import { NextRequest } from "next/server";
import { Permission, StatutActivation } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPacks = vi.fn();
const mockCreatePack = vi.fn();
const mockGetPackById = vi.fn();
const mockUpdatePack = vi.fn();
const mockDeletePack = vi.fn();
const mockGetPackProduits = vi.fn();
const mockAddPackProduit = vi.fn();
const mockRemovePackProduit = vi.fn();
const mockGetPackActivations = vi.fn();
const mockActiverPack = vi.fn();

vi.mock("@/lib/queries/packs", () => ({
  getPacks: (...args: unknown[]) => mockGetPacks(...args),
  createPack: (...args: unknown[]) => mockCreatePack(...args),
  getPackById: (...args: unknown[]) => mockGetPackById(...args),
  updatePack: (...args: unknown[]) => mockUpdatePack(...args),
  deletePack: (...args: unknown[]) => mockDeletePack(...args),
  getPackProduits: (...args: unknown[]) => mockGetPackProduits(...args),
  addPackProduit: (...args: unknown[]) => mockAddPackProduit(...args),
  removePackProduit: (...args: unknown[]) => mockRemovePackProduit(...args),
  getPackActivations: (...args: unknown[]) => mockGetPackActivations(...args),
}));

vi.mock("@/lib/queries/provisioning", () => ({
  activerPack: (...args: unknown[]) => mockActiverPack(...args),
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
  normalizePhone: vi.fn().mockReturnValue("699000001"),
}));

vi.mock("@/lib/activity-engine", () => ({
  runEngineForSite: vi.fn().mockResolvedValue(undefined),
  generateOnboardingActivities: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/queries/users", () => ({
  getOrCreateSystemUser: vi.fn().mockResolvedValue({ id: "system-user" }),
}));

const AUTH_ADMIN = {
  userId: "user-admin",
  email: "admin@dkfarm.cm",
  phone: null,
  name: "Admin DKFarm",
  globalRole: "ADMIN",
  activeSiteId: "site-dkfarm",
  siteRole: "ADMIN",
  permissions: [
    Permission.DASHBOARD_VOIR,
    Permission.GERER_PACKS,
    Permission.ACTIVER_PACKS,
  ],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_PACK = {
  id: "pack-1",
  nom: "Pack Decouverte 100",
  description: "Kit de demarrage",
  nombreAlevins: 100,
  poidsMoyenInitial: 5.0,
  prixTotal: 85000,
  isActive: true,
  configElevageId: null,
  planId: "plan-decouverte",
  userId: "user-admin",
  siteId: "site-dkfarm",
  createdAt: new Date(),
  updatedAt: new Date(),
  configElevage: null,
  plan: { id: "plan-decouverte", nom: "Plan Decouverte", typePlan: "DECOUVERTE" },
  user: { id: "user-admin", name: "Admin DKFarm" },
  produits: [],
  _count: { activations: 0 },
};

const FAKE_PACK_PRODUIT = {
  id: "pp-1",
  packId: "pack-1",
  produitId: "prod-1",
  quantite: 25,
  createdAt: new Date(),
  updatedAt: new Date(),
  produit: {
    id: "prod-1",
    nom: "Aliment Croissance 3mm",
    categorie: "ALIMENT",
    unite: "KG",
    prixUnitaire: 850,
    stockActuel: 120,
  },
};

// ---------------------------------------------------------------------------
// Tests GET /api/packs
// ---------------------------------------------------------------------------

describe("GET /api/packs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("retourne la liste des packs", async () => {
    mockGetPacks.mockResolvedValue([FAKE_PACK]);
    const req = makeRequest("http://localhost:3000/api/packs");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.packs).toHaveLength(1);
    expect(data.packs[0].nom).toBe("Pack Decouverte 100");
    expect(data.total).toBe(1);
  });

  it("filtre par isActive=true", async () => {
    mockGetPacks.mockResolvedValue([FAKE_PACK]);
    const req = makeRequest("http://localhost:3000/api/packs?isActive=true");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetPacks).toHaveBeenCalledWith("site-dkfarm", { isActive: true });
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non autorise"));
    const req = makeRequest("http://localhost:3000/api/packs");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests POST /api/packs
// ---------------------------------------------------------------------------

describe("POST /api/packs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("cree un pack valide", async () => {
    mockCreatePack.mockResolvedValue({ ...FAKE_PACK });
    const req = makeRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify({
        nom: "Pack Decouverte 100",
        nombreAlevins: 100,
        prixTotal: 85000,
        planId: "plan-decouverte",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.nom).toBe("Pack Decouverte 100");
  });

  it("retourne 400 si nom manquant", async () => {
    const req = makeRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify({ nombreAlevins: 100 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si nombreAlevins <= 0", async () => {
    const req = makeRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify({ nom: "Test", nombreAlevins: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si prixTotal negatif", async () => {
    const req = makeRequest("http://localhost:3000/api/packs", {
      method: "POST",
      body: JSON.stringify({ nom: "Test", nombreAlevins: 100, prixTotal: -1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests GET /api/packs/[id]
// ---------------------------------------------------------------------------

describe("GET /api/packs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("retourne le pack si trouve", async () => {
    mockGetPackById.mockResolvedValue(FAKE_PACK);
    const req = makeRequest("http://localhost:3000/api/packs/pack-1");
    const params = Promise.resolve({ id: "pack-1" });
    const res = await GET_DETAIL(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("pack-1");
  });

  it("retourne 404 si pack introuvable", async () => {
    mockGetPackById.mockResolvedValue(null);
    const req = makeRequest("http://localhost:3000/api/packs/unknown");
    const params = Promise.resolve({ id: "unknown" });
    const res = await GET_DETAIL(req, { params });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests PUT /api/packs/[id]
// ---------------------------------------------------------------------------

describe("PUT /api/packs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("met a jour un pack", async () => {
    mockUpdatePack.mockResolvedValue({ ...FAKE_PACK, nom: "Pack Modifie" });
    const req = makeRequest("http://localhost:3000/api/packs/pack-1", {
      method: "PUT",
      body: JSON.stringify({ nom: "Pack Modifie" }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await PUT(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.nom).toBe("Pack Modifie");
  });

  it("retourne 404 si pack introuvable", async () => {
    mockUpdatePack.mockResolvedValue(null);
    const req = makeRequest("http://localhost:3000/api/packs/unknown", {
      method: "PUT",
      body: JSON.stringify({ nom: "Test" }),
    });
    const params = Promise.resolve({ id: "unknown" });
    const res = await PUT(req, { params });
    expect(res.status).toBe(404);
  });

  it("retourne 409 si desactivation avec activations actives", async () => {
    mockUpdatePack.mockRejectedValue(
      new Error("Impossible de desactiver ce pack : 2 activation(s) active(s) en cours.")
    );
    const req = makeRequest("http://localhost:3000/api/packs/pack-1", {
      method: "PUT",
      body: JSON.stringify({ isActive: false }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await PUT(req, { params });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Tests DELETE /api/packs/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/packs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("supprime un pack", async () => {
    mockDeletePack.mockResolvedValue(true);
    const req = makeRequest("http://localhost:3000/api/packs/pack-1", {
      method: "DELETE",
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await DELETE(req, { params });
    expect(res.status).toBe(204);
  });

  it("retourne 404 si pack introuvable", async () => {
    mockDeletePack.mockResolvedValue(false);
    const req = makeRequest("http://localhost:3000/api/packs/unknown", {
      method: "DELETE",
    });
    const params = Promise.resolve({ id: "unknown" });
    const res = await DELETE(req, { params });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests GET /api/packs/[id]/produits
// ---------------------------------------------------------------------------

describe("GET /api/packs/[id]/produits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("retourne les produits du pack", async () => {
    mockGetPackProduits.mockResolvedValue([FAKE_PACK_PRODUIT]);
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/produits");
    const params = Promise.resolve({ id: "pack-1" });
    const res = await GET_PRODUITS(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.produits).toHaveLength(1);
  });

  it("retourne 404 si pack introuvable", async () => {
    mockGetPackProduits.mockResolvedValue(null);
    const req = makeRequest("http://localhost:3000/api/packs/unknown/produits");
    const params = Promise.resolve({ id: "unknown" });
    const res = await GET_PRODUITS(req, { params });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests POST /api/packs/[id]/produits
// ---------------------------------------------------------------------------

describe("POST /api/packs/[id]/produits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("ajoute un produit au pack", async () => {
    mockAddPackProduit.mockResolvedValue(FAKE_PACK_PRODUIT);
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/produits", {
      method: "POST",
      body: JSON.stringify({ produitId: "prod-1", quantite: 25 }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await POST_PRODUIT(req, { params });
    expect(res.status).toBe(201);
  });

  it("retourne 400 si produitId manquant", async () => {
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/produits", {
      method: "POST",
      body: JSON.stringify({ quantite: 25 }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await POST_PRODUIT(req, { params });
    expect(res.status).toBe(400);
  });

  it("retourne 400 si quantite <= 0", async () => {
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/produits", {
      method: "POST",
      body: JSON.stringify({ produitId: "prod-1", quantite: 0 }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await POST_PRODUIT(req, { params });
    expect(res.status).toBe(400);
  });

  it("retourne 409 si produit deja dans le pack", async () => {
    mockAddPackProduit.mockRejectedValue(new Error("Unique constraint failed"));
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/produits", {
      method: "POST",
      body: JSON.stringify({ produitId: "prod-1", quantite: 25 }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await POST_PRODUIT(req, { params });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Tests DELETE /api/packs/[id]/produits
// ---------------------------------------------------------------------------

describe("DELETE /api/packs/[id]/produits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("retire un produit du pack", async () => {
    mockRemovePackProduit.mockResolvedValue(true);
    const req = makeRequest(
      "http://localhost:3000/api/packs/pack-1/produits?produitId=prod-1",
      { method: "DELETE" }
    );
    const params = Promise.resolve({ id: "pack-1" });
    const res = await DELETE_PRODUIT(req, { params });
    expect(res.status).toBe(204);
  });

  it("retourne 400 si produitId manquant", async () => {
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/produits", {
      method: "DELETE",
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await DELETE_PRODUIT(req, { params });
    expect(res.status).toBe(400);
  });

  it("retourne 404 si produit ou pack introuvable", async () => {
    mockRemovePackProduit.mockResolvedValue(false);
    const req = makeRequest(
      "http://localhost:3000/api/packs/pack-1/produits?produitId=unknown",
      { method: "DELETE" }
    );
    const params = Promise.resolve({ id: "pack-1" });
    const res = await DELETE_PRODUIT(req, { params });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests GET /api/activations
// ---------------------------------------------------------------------------

describe("GET /api/activations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  it("retourne la liste des activations", async () => {
    const fakeActivation = {
      id: "act-1",
      code: "ACT-2026-001",
      statut: StatutActivation.ACTIVE,
      packId: "pack-1",
      siteId: "site-dkfarm",
      clientSiteId: "site-client-1",
    };
    mockGetPackActivations.mockResolvedValue([fakeActivation]);
    const req = makeRequest("http://localhost:3000/api/activations");
    const res = await GET_ACTIVATIONS(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.activations).toHaveLength(1);
    expect(data.activations[0].code).toBe("ACT-2026-001");
  });

  it("retourne 403 si permission insuffisante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));
    const req = makeRequest("http://localhost:3000/api/activations");
    const res = await GET_ACTIVATIONS(req);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests POST /api/packs/[id]/activer
// ---------------------------------------------------------------------------

describe("POST /api/packs/[id]/activer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_ADMIN);
  });

  const VALID_DTO = {
    clientSiteName: "Ferme Ngozi",
    clientUserName: "Jean Ngozi",
    clientUserPhone: "+237699000001",
    clientUserPassword: "password123",
  };

  const PROVISIONING_RESULT = {
    site: { id: "site-client-1", name: "Ferme Ngozi" },
    user: { id: "user-client-1", name: "Jean Ngozi", phone: "+237699000001" },
    vague: { id: "vague-1", code: "VAG-2026-03-AAAAAA", nombreInitial: 100 },
    nombreProduitsInitialises: 2,
    nombreMouvements: 2,
    activation: { id: "act-1", code: "ACT-2026-001", statut: StatutActivation.ACTIVE },
  };

  it("active un pack avec succes (201)", async () => {
    mockActiverPack.mockResolvedValue(PROVISIONING_RESULT);
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/activer", {
      method: "POST",
      body: JSON.stringify(VALID_DTO),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await POST_ACTIVER(req, { params });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.activation.code).toBe("ACT-2026-001");
    expect(data.site.name).toBe("Ferme Ngozi");
  });

  it("retourne 400 si clientSiteName manquant", async () => {
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/activer", {
      method: "POST",
      body: JSON.stringify({ ...VALID_DTO, clientSiteName: "" }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await POST_ACTIVER(req, { params });
    expect(res.status).toBe(400);
  });

  it("retourne 400 si clientUserPhone manquant", async () => {
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/activer", {
      method: "POST",
      body: JSON.stringify({ ...VALID_DTO, clientUserPhone: "" }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await POST_ACTIVER(req, { params });
    expect(res.status).toBe(400);
  });

  it("retourne 400 si mot de passe trop court", async () => {
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/activer", {
      method: "POST",
      body: JSON.stringify({ ...VALID_DTO, clientUserPassword: "abc" }),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await POST_ACTIVER(req, { params });
    expect(res.status).toBe(400);
  });

  it("retourne 409 si double activation (EC-2.1)", async () => {
    mockActiverPack.mockRejectedValue(
      new Error("Ce client a deja une activation active pour ce pack.")
    );
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/activer", {
      method: "POST",
      body: JSON.stringify(VALID_DTO),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await POST_ACTIVER(req, { params });
    expect(res.status).toBe(409);
  });

  it("retourne 404 si pack introuvable", async () => {
    mockActiverPack.mockRejectedValue(new Error("Pack introuvable ou inactif."));
    const req = makeRequest("http://localhost:3000/api/packs/pack-1/activer", {
      method: "POST",
      body: JSON.stringify(VALID_DTO),
    });
    const params = Promise.resolve({ id: "pack-1" });
    const res = await POST_ACTIVER(req, { params });
    expect(res.status).toBe(404);
  });
});
