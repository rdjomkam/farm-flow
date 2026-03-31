import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_list, POST as POST_create } from "@/app/api/factures/route";
import {
  GET as GET_detail,
  PUT,
} from "@/app/api/factures/[id]/route";
import { POST as POST_paiement } from "@/app/api/factures/[id]/paiements/route";
import { NextRequest } from "next/server";
import { Permission, StatutFacture, ModePaiement } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetFactures = vi.fn();
const mockCreateFacture = vi.fn();
const mockGetFactureById = vi.fn();
const mockUpdateFacture = vi.fn();
const mockAjouterPaiement = vi.fn();

vi.mock("@/lib/queries/factures", () => ({
  getFactures: (...args: unknown[]) => mockGetFactures(...args),
  createFacture: (...args: unknown[]) => mockCreateFacture(...args),
  getFactureById: (...args: unknown[]) => mockGetFactureById(...args),
  updateFacture: (...args: unknown[]) => mockUpdateFacture(...args),
  ajouterPaiement: (...args: unknown[]) => mockAjouterPaiement(...args),
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
  siteRoleId: "role-1",
  siteRoleName: "Pisciculteur",
  permissions: [
    Permission.FACTURES_VOIR,
    Permission.FACTURES_GERER,
    Permission.PAIEMENTS_CREER,
  ],
};

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ---------------------------------------------------------------------------
// GET /api/factures
// ---------------------------------------------------------------------------
describe("GET /api/factures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des factures", async () => {
    const fakeFactures = [
      {
        id: "f-1",
        numero: "FAC-2026-001",
        statut: StatutFacture.BROUILLON,
        montantTotal: 50000,
        montantPaye: 0,
      },
    ];
    mockGetFactures.mockResolvedValue({ data: fakeFactures, total: 1 });

    const response = await GET_list(makeRequest("/api/factures"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.data[0].numero).toBe("FAC-2026-001");
  });

  it("passe les filtres de statut et dates", async () => {
    mockGetFactures.mockResolvedValue({ data: [], total: 0 });

    await GET_list(
      makeRequest("/api/factures?statut=BROUILLON&dateFrom=2026-01-01&dateTo=2026-03-31")
    );

    expect(mockGetFactures).toHaveBeenCalledWith("site-1", {
      statut: StatutFacture.BROUILLON,
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    }, expect.any(Object));
  });

  it("ignore un statut invalide", async () => {
    mockGetFactures.mockResolvedValue({ data: [], total: 0 });

    await GET_list(makeRequest("/api/factures?statut=INVALID"));

    expect(mockGetFactures).toHaveBeenCalledWith("site-1", {}, expect.any(Object));
  });

  it("requiert la permission FACTURES_VOIR", async () => {
    mockGetFactures.mockResolvedValue([]);

    await GET_list(makeRequest("/api/factures"));

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.FACTURES_VOIR
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetFactures.mockRejectedValue(new Error("DB error"));

    const response = await GET_list(makeRequest("/api/factures"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// POST /api/factures
// ---------------------------------------------------------------------------
describe("POST /api/factures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("cree une facture a partir d'une vente", async () => {
    const fakeFacture = {
      id: "f-new",
      numero: "FAC-2026-002",
      statut: StatutFacture.BROUILLON,
      montantTotal: 50000,
    };
    mockCreateFacture.mockResolvedValue(fakeFacture);

    const response = await POST_create(
      makeRequest("/api/factures", {
        method: "POST",
        body: JSON.stringify({
          venteId: "v-1",
          dateEcheance: "2026-04-01",
          notes: "Facture test",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.numero).toBe("FAC-2026-002");
    expect(mockCreateFacture).toHaveBeenCalledWith("site-1", "user-1", {
      venteId: "v-1",
      dateEcheance: "2026-04-01",
      notes: "Facture test",
    });
  });

  it("retourne 400 si venteId manquant", async () => {
    const response = await POST_create(
      makeRequest("/api/factures", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "venteId" })])
    );
  });

  it("retourne 400 si dateEcheance invalide", async () => {
    const response = await POST_create(
      makeRequest("/api/factures", {
        method: "POST",
        body: JSON.stringify({ venteId: "v-1", dateEcheance: "not-a-date" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "dateEcheance" })])
    );
  });

  it("retourne 409 si vente a deja une facture", async () => {
    mockCreateFacture.mockRejectedValue(new Error("Cette vente a deja une facture."));

    const response = await POST_create(
      makeRequest("/api/factures", {
        method: "POST",
        body: JSON.stringify({ venteId: "v-1" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("deja une facture");
  });

  it("retourne 404 si vente introuvable", async () => {
    mockCreateFacture.mockRejectedValue(new Error("Vente introuvable."));

    const response = await POST_create(
      makeRequest("/api/factures", {
        method: "POST",
        body: JSON.stringify({ venteId: "unknown" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("requiert la permission FACTURES_GERER", async () => {
    mockCreateFacture.mockResolvedValue({ id: "f-1" });

    await POST_create(
      makeRequest("/api/factures", {
        method: "POST",
        body: JSON.stringify({ venteId: "v-1" }),
      })
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.FACTURES_GERER
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockCreateFacture.mockRejectedValue(new Error("DB error"));

    const response = await POST_create(
      makeRequest("/api/factures", {
        method: "POST",
        body: JSON.stringify({ venteId: "v-1" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// GET /api/factures/[id]
// ---------------------------------------------------------------------------
describe("GET /api/factures/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le detail d'une facture", async () => {
    const fakeFacture = {
      id: "f-1",
      numero: "FAC-2026-001",
      statut: StatutFacture.ENVOYEE,
      montantTotal: 50000,
      montantPaye: 20000,
      vente: { id: "v-1", numero: "VTE-2026-001" },
      paiements: [{ id: "p-1", montant: 20000, mode: ModePaiement.MOBILE_MONEY }],
    };
    mockGetFactureById.mockResolvedValue(fakeFacture);

    const response = await GET_detail(
      makeRequest("/api/factures/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.numero).toBe("FAC-2026-001");
    expect(data.paiements).toHaveLength(1);
    expect(mockGetFactureById).toHaveBeenCalledWith("f-1", "site-1");
  });

  it("retourne 404 si facture introuvable", async () => {
    mockGetFactureById.mockResolvedValue(null);

    const response = await GET_detail(
      makeRequest("/api/factures/unknown"),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetFactureById.mockRejectedValue(new Error("DB error"));

    const response = await GET_detail(
      makeRequest("/api/factures/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/factures/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/factures/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour le statut d'une facture", async () => {
    const updated = { id: "f-1", statut: StatutFacture.ENVOYEE };
    mockUpdateFacture.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/factures/f-1", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutFacture.ENVOYEE }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutFacture.ENVOYEE);
    expect(mockUpdateFacture).toHaveBeenCalledWith("f-1", "site-1", {
      statut: StatutFacture.ENVOYEE,
    });
  });

  it("retourne 400 si statut invalide", async () => {
    const response = await PUT(
      makeRequest("/api/factures/f-1", {
        method: "PUT",
        body: JSON.stringify({ statut: "INVALID" }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("Statut invalide");
  });

  it("retourne 400 si dateEcheance invalide", async () => {
    const response = await PUT(
      makeRequest("/api/factures/f-1", {
        method: "PUT",
        body: JSON.stringify({ dateEcheance: "not-a-date" }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("date d'echeance");
  });

  it("retourne 404 si facture introuvable", async () => {
    mockUpdateFacture.mockRejectedValue(new Error("Facture introuvable."));

    const response = await PUT(
      makeRequest("/api/factures/unknown", {
        method: "PUT",
        body: JSON.stringify({ statut: StatutFacture.ENVOYEE }),
      }),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("requiert la permission FACTURES_GERER", async () => {
    mockUpdateFacture.mockResolvedValue({ id: "f-1" });

    await PUT(
      makeRequest("/api/factures/f-1", {
        method: "PUT",
        body: JSON.stringify({ notes: "Updated" }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.FACTURES_GERER
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/factures/[id]/paiements
// ---------------------------------------------------------------------------
describe("POST /api/factures/[id]/paiements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("ajoute un paiement a une facture", async () => {
    const fakePaiement = {
      id: "p-new",
      montant: 25000,
      mode: ModePaiement.ESPECES,
      date: new Date().toISOString(),
    };
    mockAjouterPaiement.mockResolvedValue(fakePaiement);

    const response = await POST_paiement(
      makeRequest("/api/factures/f-1/paiements", {
        method: "POST",
        body: JSON.stringify({
          montant: 25000,
          mode: ModePaiement.ESPECES,
          reference: "REF-001",
        }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.montant).toBe(25000);
    expect(mockAjouterPaiement).toHaveBeenCalledWith("site-1", "f-1", "user-1", {
      montant: 25000,
      mode: ModePaiement.ESPECES,
      reference: "REF-001",
    });
  });

  it("retourne 400 si montant <= 0", async () => {
    const response = await POST_paiement(
      makeRequest("/api/factures/f-1/paiements", {
        method: "POST",
        body: JSON.stringify({ montant: 0, mode: ModePaiement.ESPECES }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "montant" })])
    );
  });

  it("retourne 400 si mode de paiement invalide", async () => {
    const response = await POST_paiement(
      makeRequest("/api/factures/f-1/paiements", {
        method: "POST",
        body: JSON.stringify({ montant: 10000, mode: "BITCOIN" }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "mode" })])
    );
  });

  it("retourne 400 si mode manquant", async () => {
    const response = await POST_paiement(
      makeRequest("/api/factures/f-1/paiements", {
        method: "POST",
        body: JSON.stringify({ montant: 10000 }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "mode" })])
    );
  });

  it("retourne 409 si le paiement depasse le montant restant", async () => {
    mockAjouterPaiement.mockRejectedValue(
      new Error("Impossible : le montant depasse le reste a payer.")
    );

    const response = await POST_paiement(
      makeRequest("/api/factures/f-1/paiements", {
        method: "POST",
        body: JSON.stringify({ montant: 999999, mode: ModePaiement.ESPECES }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("depasse");
  });

  it("retourne 409 si facture deja payee", async () => {
    mockAjouterPaiement.mockRejectedValue(
      new Error("Impossible : cette facture est deja entierement payee.")
    );

    const response = await POST_paiement(
      makeRequest("/api/factures/f-1/paiements", {
        method: "POST",
        body: JSON.stringify({ montant: 1000, mode: ModePaiement.ESPECES }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("deja");
  });

  it("retourne 404 si facture introuvable", async () => {
    mockAjouterPaiement.mockRejectedValue(new Error("Facture introuvable."));

    const response = await POST_paiement(
      makeRequest("/api/factures/unknown/paiements", {
        method: "POST",
        body: JSON.stringify({ montant: 10000, mode: ModePaiement.ESPECES }),
      }),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("requiert la permission PAIEMENTS_CREER", async () => {
    mockAjouterPaiement.mockResolvedValue({ id: "p-1" });

    await POST_paiement(
      makeRequest("/api/factures/f-1/paiements", {
        method: "POST",
        body: JSON.stringify({ montant: 10000, mode: ModePaiement.ESPECES }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.PAIEMENTS_CREER
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockAjouterPaiement.mockRejectedValue(new Error("DB error"));

    const response = await POST_paiement(
      makeRequest("/api/factures/f-1/paiements", {
        method: "POST",
        body: JSON.stringify({ montant: 10000, mode: ModePaiement.ESPECES }),
      }),
      { params: Promise.resolve({ id: "f-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});
