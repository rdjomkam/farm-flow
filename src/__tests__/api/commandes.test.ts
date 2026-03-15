import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/commandes/route";
import {
  GET as GET_DETAIL,
  PUT,
} from "@/app/api/commandes/[id]/route";
import { POST as POST_RECEVOIR } from "@/app/api/commandes/[id]/recevoir/route";
import { NextRequest } from "next/server";
import { Permission, StatutCommande } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCommandes = vi.fn();
const mockCreateCommande = vi.fn();
const mockGetCommandeById = vi.fn();
const mockEnvoyerCommande = vi.fn();
const mockAnnulerCommande = vi.fn();
const mockRecevoirCommande = vi.fn();

vi.mock("@/lib/queries/commandes", () => ({
  getCommandes: (...args: unknown[]) => mockGetCommandes(...args),
  createCommande: (...args: unknown[]) => mockCreateCommande(...args),
  getCommandeById: (...args: unknown[]) => mockGetCommandeById(...args),
  envoyerCommande: (...args: unknown[]) => mockEnvoyerCommande(...args),
  annulerCommande: (...args: unknown[]) => mockAnnulerCommande(...args),
  recevoirCommande: (...args: unknown[]) => mockRecevoirCommande(...args),
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

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  permissions: [Permission.APPROVISIONNEMENT_VOIR, Permission.APPROVISIONNEMENT_GERER],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_COMMANDE = {
  id: "cmd-1",
  numero: "CMD-2026-001",
  fournisseurId: "four-1",
  statut: StatutCommande.BROUILLON,
  dateCommande: new Date("2026-03-01"),
  dateLivraison: null,
  montantTotal: 250000,
  userId: "user-1",
  siteId: "site-1",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  fournisseur: { id: "four-1", nom: "Fournisseur SA" },
  _count: { lignes: 2 },
};

// ---------------------------------------------------------------------------
// GET /api/commandes
// ---------------------------------------------------------------------------
describe("GET /api/commandes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des commandes avec le total", async () => {
    mockGetCommandes.mockResolvedValue([FAKE_COMMANDE]);

    const response = await GET(makeRequest("/api/commandes"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.commandes).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockGetCommandes).toHaveBeenCalledWith("site-1", {});
  });

  it("passe le filtre statut", async () => {
    mockGetCommandes.mockResolvedValue([]);

    await GET(makeRequest("/api/commandes?statut=ENVOYEE"));

    expect(mockGetCommandes).toHaveBeenCalledWith("site-1", {
      statut: StatutCommande.ENVOYEE,
    });
  });

  it("passe le filtre fournisseurId", async () => {
    mockGetCommandes.mockResolvedValue([]);

    await GET(makeRequest("/api/commandes?fournisseurId=four-1"));

    expect(mockGetCommandes).toHaveBeenCalledWith("site-1", {
      fournisseurId: "four-1",
    });
  });

  it("passe les filtres de date", async () => {
    mockGetCommandes.mockResolvedValue([]);

    await GET(
      makeRequest("/api/commandes?dateFrom=2026-01-01&dateTo=2026-03-31")
    );

    expect(mockGetCommandes).toHaveBeenCalledWith("site-1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    });
  });

  it("ignore un statut invalide", async () => {
    mockGetCommandes.mockResolvedValue([]);

    await GET(makeRequest("/api/commandes?statut=INVALIDE"));

    expect(mockGetCommandes).toHaveBeenCalledWith("site-1", {});
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/commandes"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/commandes"));
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/commandes
// ---------------------------------------------------------------------------
describe("POST /api/commandes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBody = {
    fournisseurId: "four-1",
    dateCommande: "2026-03-01T00:00:00.000Z",
    lignes: [
      { produitId: "prod-1", quantite: 100, prixUnitaire: 5000 },
      { produitId: "prod-2", quantite: 50, prixUnitaire: 3000 },
    ],
    notes: "Commande urgente",
  };

  it("cree une commande avec ses lignes", async () => {
    mockCreateCommande.mockResolvedValue(FAKE_COMMANDE);

    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("cmd-1");
    expect(mockCreateCommande).toHaveBeenCalledWith("site-1", "user-1", {
      fournisseurId: "four-1",
      dateCommande: "2026-03-01T00:00:00.000Z",
      lignes: [
        { produitId: "prod-1", quantite: 100, prixUnitaire: 5000 },
        { produitId: "prod-2", quantite: 50, prixUnitaire: 3000 },
      ],
      notes: "Commande urgente",
    });
  });

  it("retourne 400 si fournisseurId manquant", async () => {
    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, fournisseurId: undefined }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "fournisseurId" })])
    );
  });

  it("retourne 400 si dateCommande manquante", async () => {
    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, dateCommande: undefined }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "dateCommande" })])
    );
  });

  it("retourne 400 si dateCommande invalide", async () => {
    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, dateCommande: "pas-une-date" }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si lignes vide", async () => {
    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, lignes: [] }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "lignes" })])
    );
  });

  it("retourne 400 si lignes absentes", async () => {
    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify({ ...validBody, lignes: undefined }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si ligne sans produitId", async () => {
    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          lignes: [{ quantite: 10, prixUnitaire: 1000 }],
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "lignes[0].produitId" }),
      ])
    );
  });

  it("retourne 400 si ligne avec quantite <= 0", async () => {
    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          lignes: [{ produitId: "prod-1", quantite: 0, prixUnitaire: 1000 }],
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "lignes[0].quantite" }),
      ])
    );
  });

  it("retourne 400 si ligne avec prixUnitaire negatif", async () => {
    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          lignes: [{ produitId: "prod-1", quantite: 10, prixUnitaire: -5 }],
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "lignes[0].prixUnitaire" }),
      ])
    );
  });

  it("retourne 404 si fournisseur introuvable (query error)", async () => {
    mockCreateCommande.mockRejectedValue(new Error("Fournisseur introuvable"));

    const response = await POST(
      makeRequest("/api/commandes", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/commandes/[id]
// ---------------------------------------------------------------------------
describe("GET /api/commandes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la commande par ID avec ses lignes", async () => {
    const detailCommande = {
      ...FAKE_COMMANDE,
      lignes: [
        { id: "lig-1", produitId: "prod-1", quantite: 100, prixUnitaire: 5000 },
      ],
    };
    mockGetCommandeById.mockResolvedValue(detailCommande);

    const response = await GET_DETAIL(makeRequest("/api/commandes/cmd-1"), {
      params: Promise.resolve({ id: "cmd-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("cmd-1");
    expect(mockGetCommandeById).toHaveBeenCalledWith("cmd-1", "site-1");
  });

  it("retourne 404 si commande introuvable", async () => {
    mockGetCommandeById.mockResolvedValue(null);

    const response = await GET_DETAIL(makeRequest("/api/commandes/xxx"), {
      params: Promise.resolve({ id: "xxx" }),
    });

    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/commandes/[id] — actions (envoyer / annuler)
// ---------------------------------------------------------------------------
describe("PUT /api/commandes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("envoie une commande (action: envoyer)", async () => {
    const envoyee = { ...FAKE_COMMANDE, statut: StatutCommande.ENVOYEE };
    mockEnvoyerCommande.mockResolvedValue(envoyee);

    const response = await PUT(
      makeRequest("/api/commandes/cmd-1", {
        method: "PUT",
        body: JSON.stringify({ action: "envoyer" }),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutCommande.ENVOYEE);
    expect(mockEnvoyerCommande).toHaveBeenCalledWith("cmd-1", "site-1");
  });

  it("annule une commande (action: annuler)", async () => {
    const annulee = { ...FAKE_COMMANDE, statut: StatutCommande.ANNULEE };
    mockAnnulerCommande.mockResolvedValue(annulee);

    const response = await PUT(
      makeRequest("/api/commandes/cmd-1", {
        method: "PUT",
        body: JSON.stringify({ action: "annuler" }),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutCommande.ANNULEE);
    expect(mockAnnulerCommande).toHaveBeenCalledWith("cmd-1", "site-1");
  });

  it("retourne 400 si action manquante", async () => {
    const response = await PUT(
      makeRequest("/api/commandes/cmd-1", {
        method: "PUT",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si action invalide", async () => {
    const response = await PUT(
      makeRequest("/api/commandes/cmd-1", {
        method: "PUT",
        body: JSON.stringify({ action: "supprimer" }),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("Action invalide");
  });

  it("retourne 404 si commande introuvable (envoyer)", async () => {
    mockEnvoyerCommande.mockRejectedValue(new Error("Commande introuvable"));

    const response = await PUT(
      makeRequest("/api/commandes/xxx", {
        method: "PUT",
        body: JSON.stringify({ action: "envoyer" }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si impossible d'envoyer (pas BROUILLON)", async () => {
    mockEnvoyerCommande.mockRejectedValue(
      new Error("Impossible d'envoyer une commande avec le statut LIVREE")
    );

    const response = await PUT(
      makeRequest("/api/commandes/cmd-1", {
        method: "PUT",
        body: JSON.stringify({ action: "envoyer" }),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 409 si impossible d'annuler (deja livree)", async () => {
    mockAnnulerCommande.mockRejectedValue(
      new Error("Impossible d'annuler une commande deja livree")
    );

    const response = await PUT(
      makeRequest("/api/commandes/cmd-1", {
        method: "PUT",
        body: JSON.stringify({ action: "annuler" }),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );

    expect(response.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// POST /api/commandes/[id]/recevoir
// ---------------------------------------------------------------------------
describe("POST /api/commandes/[id]/recevoir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("recoit une commande sans date de livraison", async () => {
    const livree = {
      ...FAKE_COMMANDE,
      statut: StatutCommande.LIVREE,
      dateLivraison: new Date(),
    };
    // Sprint 16: recevoirCommande retourne maintenant { commande, depense }
    mockRecevoirCommande.mockResolvedValue({ commande: livree, depense: null });

    const response = await POST_RECEVOIR(
      makeRequest("/api/commandes/cmd-1/recevoir", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.commande.statut).toBe(StatutCommande.LIVREE);
    expect(mockRecevoirCommande).toHaveBeenCalledWith(
      "cmd-1",
      "site-1",
      "user-1",
      undefined
    );
  });

  it("recoit une commande avec date de livraison", async () => {
    const livree = {
      ...FAKE_COMMANDE,
      statut: StatutCommande.LIVREE,
      dateLivraison: new Date("2026-03-09"),
    };
    // Sprint 16: recevoirCommande retourne maintenant { commande, depense }
    mockRecevoirCommande.mockResolvedValue({ commande: livree, depense: null });

    const response = await POST_RECEVOIR(
      makeRequest("/api/commandes/cmd-1/recevoir", {
        method: "POST",
        body: JSON.stringify({ dateLivraison: "2026-03-09T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockRecevoirCommande).toHaveBeenCalledWith(
      "cmd-1",
      "site-1",
      "user-1",
      "2026-03-09T00:00:00.000Z"
    );
  });

  it("retourne 400 si date de livraison invalide", async () => {
    const response = await POST_RECEVOIR(
      makeRequest("/api/commandes/cmd-1/recevoir", {
        method: "POST",
        body: JSON.stringify({ dateLivraison: "pas-une-date" }),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain("date de livraison");
  });

  it("retourne 404 si commande introuvable", async () => {
    mockRecevoirCommande.mockRejectedValue(new Error("Commande introuvable"));

    const response = await POST_RECEVOIR(
      makeRequest("/api/commandes/xxx/recevoir", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si impossible de recevoir (pas ENVOYEE)", async () => {
    mockRecevoirCommande.mockRejectedValue(
      new Error("Impossible de recevoir une commande avec le statut BROUILLON")
    );

    const response = await POST_RECEVOIR(
      makeRequest("/api/commandes/cmd-1/recevoir", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST_RECEVOIR(
      makeRequest("/api/commandes/cmd-1/recevoir", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );

    expect(response.status).toBe(401);
  });
});
