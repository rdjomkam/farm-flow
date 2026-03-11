import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/lots-alevins/route";
import {
  GET as GET_DETAIL,
  PUT,
} from "@/app/api/lots-alevins/[id]/route";
import { POST as POST_TRANSFERER } from "@/app/api/lots-alevins/[id]/transferer/route";
import { NextRequest } from "next/server";
import { Permission, StatutLotAlevins, StatutVague } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetLotsAlevins = vi.fn();
const mockCreateLotAlevins = vi.fn();
const mockGetLotAlevinsById = vi.fn();
const mockUpdateLotAlevins = vi.fn();
const mockTransfererLotVersVague = vi.fn();

vi.mock("@/lib/queries/lots-alevins", () => ({
  getLotsAlevins: (...args: unknown[]) => mockGetLotsAlevins(...args),
  createLotAlevins: (...args: unknown[]) => mockCreateLotAlevins(...args),
  getLotAlevinsById: (...args: unknown[]) => mockGetLotAlevinsById(...args),
  updateLotAlevins: (...args: unknown[]) => mockUpdateLotAlevins(...args),
  transfererLotVersVague: (...args: unknown[]) => mockTransfererLotVersVague(...args),
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
  permissions: [
    Permission.ALEVINS_VOIR,
    Permission.ALEVINS_GERER,
    Permission.ALEVINS_CREER,
    Permission.ALEVINS_MODIFIER,
    Permission.ALEVINS_SUPPRIMER,
  ],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const FAKE_LOT = {
  id: "lot-1",
  code: "LOT-2026-001",
  ponteId: "ponte-1",
  nombreInitial: 3000,
  nombreActuel: 2800,
  ageJours: 15,
  poidsMoyen: 0.5,
  statut: StatutLotAlevins.EN_ELEVAGE,
  bacId: "bac-1",
  vagueDestinationId: null,
  dateTransfert: null,
  notes: null,
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  ponte: { id: "ponte-1", code: "PONTE-2026-001" },
  bac: { id: "bac-1", nom: "Bac A1" },
  vagueDestination: null,
};

const FAKE_VAGUE = {
  id: "vague-new",
  code: "VAGUE-2026-001",
  dateDebut: new Date(),
  nombreInitial: 2800,
  statut: StatutVague.EN_COURS,
  siteId: "site-1",
  bacs: [{ id: "bac-2", nom: "Bac B1" }],
};

// ---------------------------------------------------------------------------
// GET /api/lots-alevins
// ---------------------------------------------------------------------------
describe("GET /api/lots-alevins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des lots avec le total", async () => {
    mockGetLotsAlevins.mockResolvedValue([FAKE_LOT]);

    const response = await GET(makeRequest("/api/lots-alevins"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lots).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockGetLotsAlevins).toHaveBeenCalledWith("site-1", {
      statut: undefined,
      ponteId: undefined,
      search: undefined,
    });
  });

  it("passe le filtre statut valide", async () => {
    mockGetLotsAlevins.mockResolvedValue([]);

    await GET(makeRequest("/api/lots-alevins?statut=TRANSFERE"));

    expect(mockGetLotsAlevins).toHaveBeenCalledWith("site-1", {
      statut: StatutLotAlevins.TRANSFERE,
      ponteId: undefined,
      search: undefined,
    });
  });

  it("passe le filtre ponteId", async () => {
    mockGetLotsAlevins.mockResolvedValue([]);

    await GET(makeRequest("/api/lots-alevins?ponteId=ponte-1"));

    expect(mockGetLotsAlevins).toHaveBeenCalledWith("site-1", {
      statut: undefined,
      ponteId: "ponte-1",
      search: undefined,
    });
  });

  it("passe le filtre search", async () => {
    mockGetLotsAlevins.mockResolvedValue([]);

    await GET(makeRequest("/api/lots-alevins?search=LOT-2026"));

    expect(mockGetLotsAlevins).toHaveBeenCalledWith("site-1", {
      statut: undefined,
      ponteId: undefined,
      search: "LOT-2026",
    });
  });

  it("ignore un statut invalide", async () => {
    mockGetLotsAlevins.mockResolvedValue([]);

    await GET(makeRequest("/api/lots-alevins?statut=INCONNU"));

    expect(mockGetLotsAlevins).toHaveBeenCalledWith("site-1", {
      statut: undefined,
      ponteId: undefined,
      search: undefined,
    });
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/lots-alevins"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/lots-alevins"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetLotsAlevins.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/lots-alevins"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/lots-alevins
// ---------------------------------------------------------------------------
describe("POST /api/lots-alevins", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBody = {
    code: "LOT-2026-001",
    ponteId: "ponte-1",
    nombreInitial: 3000,
    nombreActuel: 3000,
    ageJours: 1,
    poidsMoyen: 0.1,
    bacId: "bac-1",
    notes: "Premier lot",
  };

  it("cree un lot d'alevins avec tous les champs", async () => {
    const created = { ...FAKE_LOT, id: "lot-new" };
    mockCreateLotAlevins.mockResolvedValue(created);

    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("lot-new");
    expect(mockCreateLotAlevins).toHaveBeenCalledWith("site-1", {
      code: "LOT-2026-001",
      ponteId: "ponte-1",
      nombreInitial: 3000,
      nombreActuel: 3000,
      ageJours: 1,
      poidsMoyen: 0.1,
      bacId: "bac-1",
      notes: "Premier lot",
    });
  });

  it("cree un lot avec seulement les champs obligatoires, nombreActuel par defaut = nombreInitial", async () => {
    mockCreateLotAlevins.mockResolvedValue({ ...FAKE_LOT, nombreActuel: 2500 });

    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify({
          code: "LOT-MIN",
          ponteId: "ponte-1",
          nombreInitial: 2500,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateLotAlevins).toHaveBeenCalledWith("site-1", {
      code: "LOT-MIN",
      ponteId: "ponte-1",
      nombreInitial: 2500,
      nombreActuel: 2500,
      ageJours: undefined,
      poidsMoyen: undefined,
      bacId: undefined,
      notes: undefined,
    });
  });

  it("retourne 400 si code manquant", async () => {
    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify({ ponteId: "ponte-1", nombreInitial: 3000 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "code" })])
    );
  });

  it("retourne 400 si code est vide", async () => {
    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify({ code: "", ponteId: "ponte-1", nombreInitial: 3000 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si ponteId manquant", async () => {
    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify({ code: "LOT-001", nombreInitial: 3000 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "ponteId" })])
    );
  });

  it("retourne 400 si nombreInitial manquant", async () => {
    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify({ code: "LOT-001", ponteId: "ponte-1" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nombreInitial" })])
    );
  });

  it("retourne 400 si nombreInitial <= 0", async () => {
    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify({ code: "LOT-001", ponteId: "ponte-1", nombreInitial: 0 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nombreInitial" })])
    );
  });

  it("retourne 400 si nombreActuel negatif", async () => {
    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify({
          code: "LOT-001",
          ponteId: "ponte-1",
          nombreInitial: 3000,
          nombreActuel: -10,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nombreActuel" })])
    );
  });

  it("retourne 400 si ageJours negatif", async () => {
    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify({
          code: "LOT-001",
          ponteId: "ponte-1",
          nombreInitial: 3000,
          ageJours: -1,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "ageJours" })])
    );
  });

  it("retourne 400 si poidsMoyen <= 0", async () => {
    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify({
          code: "LOT-001",
          ponteId: "ponte-1",
          nombreInitial: 3000,
          poidsMoyen: 0,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poidsMoyen" })])
    );
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    expect(response.status).toBe(401);
  });

  it("retourne 409 si code deja utilise (erreur query)", async () => {
    mockCreateLotAlevins.mockRejectedValue(
      new Error('Le code "LOT-2026-001" est deja utilise')
    );

    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(409);
  });

  it("retourne 409 si le bac est deja assigne a une vague", async () => {
    mockCreateLotAlevins.mockRejectedValue(
      new Error("Bac deja assigne a une vague en cours")
    );

    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(409);
  });

  it("retourne 404 si la ponte est introuvable", async () => {
    mockCreateLotAlevins.mockRejectedValue(
      new Error("Ponte introuvable")
    );

    const response = await POST(
      makeRequest("/api/lots-alevins", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/lots-alevins/[id]
// ---------------------------------------------------------------------------
describe("GET /api/lots-alevins/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le lot par ID avec ses details", async () => {
    mockGetLotAlevinsById.mockResolvedValue(FAKE_LOT);

    const response = await GET_DETAIL(makeRequest("/api/lots-alevins/lot-1"), {
      params: Promise.resolve({ id: "lot-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("lot-1");
    expect(data.code).toBe("LOT-2026-001");
    expect(data.nombreInitial).toBe(3000);
    expect(mockGetLotAlevinsById).toHaveBeenCalledWith("lot-1", "site-1");
  });

  it("retourne 404 si lot introuvable", async () => {
    mockGetLotAlevinsById.mockResolvedValue(null);

    const response = await GET_DETAIL(makeRequest("/api/lots-alevins/xxx"), {
      params: Promise.resolve({ id: "xxx" }),
    });

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_DETAIL(makeRequest("/api/lots-alevins/lot-1"), {
      params: Promise.resolve({ id: "lot-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_DETAIL(makeRequest("/api/lots-alevins/lot-1"), {
      params: Promise.resolve({ id: "lot-1" }),
    });

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/lots-alevins/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/lots-alevins/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour un lot d'alevins", async () => {
    const updated = { ...FAKE_LOT, nombreActuel: 2600, ageJours: 30 };
    mockUpdateLotAlevins.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/lots-alevins/lot-1", {
        method: "PUT",
        body: JSON.stringify({ nombreActuel: 2600, ageJours: 30 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nombreActuel).toBe(2600);
    expect(data.ageJours).toBe(30);
    expect(mockUpdateLotAlevins).toHaveBeenCalledWith("lot-1", "site-1", {
      nombreActuel: 2600,
      ageJours: 30,
    });
  });

  it("retourne 400 si nombreActuel negatif", async () => {
    const response = await PUT(
      makeRequest("/api/lots-alevins/lot-1", {
        method: "PUT",
        body: JSON.stringify({ nombreActuel: -5 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nombreActuel" })])
    );
  });

  it("retourne 400 si ageJours negatif", async () => {
    const response = await PUT(
      makeRequest("/api/lots-alevins/lot-1", {
        method: "PUT",
        body: JSON.stringify({ ageJours: -3 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "ageJours" })])
    );
  });

  it("retourne 400 si poidsMoyen <= 0", async () => {
    const response = await PUT(
      makeRequest("/api/lots-alevins/lot-1", {
        method: "PUT",
        body: JSON.stringify({ poidsMoyen: 0 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poidsMoyen" })])
    );
  });

  it("retourne 400 si statut invalide", async () => {
    const response = await PUT(
      makeRequest("/api/lots-alevins/lot-1", {
        method: "PUT",
        body: JSON.stringify({ statut: "INVALIDE" }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "statut" })])
    );
  });

  it("retourne 404 si lot introuvable", async () => {
    mockUpdateLotAlevins.mockRejectedValue(new Error("Lot d'alevins introuvable"));

    const response = await PUT(
      makeRequest("/api/lots-alevins/xxx", {
        method: "PUT",
        body: JSON.stringify({ nombreActuel: 100 }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await PUT(
      makeRequest("/api/lots-alevins/lot-1", {
        method: "PUT",
        body: JSON.stringify({ nombreActuel: 2600 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/lots-alevins/[id]/transferer
// ---------------------------------------------------------------------------
describe("POST /api/lots-alevins/[id]/transferer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validTransfertBody = {
    nom: "Vague Grossissement Mars 2026",
    bacIds: ["bac-2", "bac-3"],
  };

  it("transfere un lot vers une nouvelle vague avec succes", async () => {
    const lotTransfere = {
      ...FAKE_LOT,
      statut: StatutLotAlevins.TRANSFERE,
      vagueDestinationId: "vague-new",
      dateTransfert: new Date(),
      vagueDestination: FAKE_VAGUE,
    };
    mockTransfererLotVersVague.mockResolvedValue(lotTransfere);

    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify(validTransfertBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lot.statut).toBe(StatutLotAlevins.TRANSFERE);
    expect(data.vague).toBeDefined();
    expect(data.message).toContain("transfere");
    expect(mockTransfererLotVersVague).toHaveBeenCalledWith("site-1", "lot-1", {
      nom: "Vague Grossissement Mars 2026",
      bacIds: ["bac-2", "bac-3"],
      userId: "user-1",
    });
  });

  it("retourne 400 si nom manquant", async () => {
    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify({ bacIds: ["bac-2"] }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nom" })])
    );
  });

  it("retourne 400 si nom est vide", async () => {
    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify({ nom: "  ", bacIds: ["bac-2"] }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si bacIds est vide", async () => {
    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify({ nom: "Nouvelle Vague", bacIds: [] }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bacIds" })])
    );
  });

  it("retourne 400 si bacIds n'est pas un tableau", async () => {
    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify({ nom: "Nouvelle Vague", bacIds: "bac-2" }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "bacIds" })])
    );
  });

  it("retourne 400 si bacIds est absent", async () => {
    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify({ nom: "Nouvelle Vague" }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 404 si lot introuvable", async () => {
    mockTransfererLotVersVague.mockRejectedValue(
      new Error("Lot d'alevins introuvable")
    );

    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/xxx/transferer", {
        method: "POST",
        body: JSON.stringify(validTransfertBody),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si lot n'est pas EN_ELEVAGE (non transferable)", async () => {
    mockTransfererLotVersVague.mockRejectedValue(
      new Error("Lot non transferable : le statut doit etre EN_ELEVAGE")
    );

    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify(validTransfertBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 409 si des bacs sont deja assignes a une vague", async () => {
    mockTransfererLotVersVague.mockRejectedValue(
      new Error("Bacs deja assignes a une vague : Bac C1, Bac D1")
    );

    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify({ nom: "Vague Test", bacIds: ["bac-occupied"] }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify(validTransfertBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify(validTransfertBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockTransfererLotVersVague.mockRejectedValue(new Error("Connexion DB perdue"));

    const response = await POST_TRANSFERER(
      makeRequest("/api/lots-alevins/lot-1/transferer", {
        method: "POST",
        body: JSON.stringify(validTransfertBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(500);
  });
});
