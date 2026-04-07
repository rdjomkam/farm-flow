/**
 * Tests API — /api/reproduction/pontes
 *
 * Couvre :
 *   GET    /api/reproduction/pontes              — liste avec filtres
 *   POST   /api/reproduction/pontes              — création étape 1 (XOR femelle sources)
 *   GET    /api/reproduction/pontes/[id]         — détail
 *   PATCH  /api/reproduction/pontes/[id]/stripping — étape 2
 *   PATCH  /api/reproduction/pontes/[id]/resultat  — étape 3 (→ TERMINEE)
 *   PATCH  /api/reproduction/pontes/[id]/echec     — marquer comme échouée
 *   DELETE /api/reproduction/pontes/[id]         — suppression (succès + blocage)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/reproduction/pontes/route";
import {
  GET as GET_DETAIL,
  DELETE,
} from "@/app/api/reproduction/pontes/[id]/route";
import { PATCH as PATCH_STRIPPING } from "@/app/api/reproduction/pontes/[id]/stripping/route";
import { PATCH as PATCH_RESULTAT } from "@/app/api/reproduction/pontes/[id]/resultat/route";
import { PATCH as PATCH_ECHEC } from "@/app/api/reproduction/pontes/[id]/echec/route";
import { NextRequest } from "next/server";
import { Permission, StatutPonte, CauseEchecPonte } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListPontes = vi.fn();
const mockCreatePonteV2 = vi.fn();
const mockGetPonteById = vi.fn();
const mockDeletePonte = vi.fn();
const mockUpdateStripping = vi.fn();
const mockUpdateResultat = vi.fn();
const mockMarkEchec = vi.fn();

vi.mock("@/lib/queries/pontes", () => ({
  listPontes: (...args: unknown[]) => mockListPontes(...args),
  createPonteV2: (...args: unknown[]) => mockCreatePonteV2(...args),
  getPonteById: (...args: unknown[]) => mockGetPonteById(...args),
  deletePonte: (...args: unknown[]) => mockDeletePonte(...args),
  updateStripping: (...args: unknown[]) => mockUpdateStripping(...args),
  updateResultat: (...args: unknown[]) => mockUpdateResultat(...args),
  markEchec: (...args: unknown[]) => mockMarkEchec(...args),
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
// Fixtures
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  isSuperAdmin: false,
  permissions: [
    Permission.ALEVINS_VOIR,
    Permission.ALEVINS_GERER,
    Permission.ALEVINS_CREER,
    Permission.ALEVINS_MODIFIER,
    Permission.ALEVINS_SUPPRIMER,
  ],
};

const FAKE_PONTE = {
  id: "ponte-1",
  code: "PONTE-2026-001",
  datePonte: new Date("2026-03-01"),
  femelleId: "rep-f-1",
  lotGeniteursFemellId: null,
  maleId: "lot-m-1",
  lotGeniteursMaleId: null,
  statut: StatutPonte.EN_COURS,
  typeHormone: null,
  doseHormone: null,
  coutHormone: null,
  heureStripping: null,
  poidsOeufsPontesG: null,
  nombreOeufsEstime: null,
  tauxFecondation: null,
  tauxEclosion: null,
  nombreLarvesViables: null,
  causeEchec: null,
  notes: null,
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  femelle: { id: "rep-f-1", code: "REP-F-001" },
  lotGeniteursFemelle: null,
  _count: { lots: 0, incubations: 0 },
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// GET /api/reproduction/pontes
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/pontes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des pontes avec total", async () => {
    mockListPontes.mockResolvedValue({ data: [FAKE_PONTE], total: 1 });

    const response = await GET(makeRequest("/api/reproduction/pontes"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockListPontes).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ statut: undefined })
    );
  });

  it("filtre par statut valide (EN_COURS)", async () => {
    mockListPontes.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/reproduction/pontes?statut=EN_COURS"));

    expect(mockListPontes).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ statut: "EN_COURS" })
    );
  });

  it("filtre par statut TERMINEE", async () => {
    mockListPontes.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/reproduction/pontes?statut=TERMINEE"));

    expect(mockListPontes).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ statut: "TERMINEE" })
    );
  });

  it("filtre par femelleId", async () => {
    mockListPontes.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/reproduction/pontes?femelleId=rep-f-1"));

    expect(mockListPontes).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ femelleId: "rep-f-1" })
    );
  });

  it("filtre par lotGeniteursFemellId", async () => {
    mockListPontes.mockResolvedValue({ data: [], total: 0 });

    await GET(
      makeRequest("/api/reproduction/pontes?lotGeniteursFemellId=lot-f-1")
    );

    expect(mockListPontes).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ lotGeniteursFemellId: "lot-f-1" })
    );
  });

  it("filtre par dateFrom et dateTo", async () => {
    mockListPontes.mockResolvedValue({ data: [], total: 0 });

    await GET(
      makeRequest(
        "/api/reproduction/pontes?dateFrom=2026-01-01&dateTo=2026-03-31"
      )
    );

    expect(mockListPontes).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        dateFrom: "2026-01-01",
        dateTo: "2026-03-31",
      })
    );
  });

  it("retourne 400 pour un statut invalide", async () => {
    const response = await GET(
      makeRequest("/api/reproduction/pontes?statut=INVALIDE")
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si limit invalide", async () => {
    const response = await GET(
      makeRequest("/api/reproduction/pontes?limit=-5")
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si offset invalide (négatif)", async () => {
    const response = await GET(
      makeRequest("/api/reproduction/pontes?offset=-1")
    );

    expect(response.status).toBe(400);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/reproduction/pontes"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/reproduction/pontes"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockListPontes.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/reproduction/pontes"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/reproduction/pontes — création étape 1
// ---------------------------------------------------------------------------

describe("POST /api/reproduction/pontes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBodyWithFemelleId = {
    datePonte: "2026-03-01T00:00:00.000Z",
    femelleId: "rep-f-1",
    maleId: "lot-m-1",
    typeHormone: "OVAPRIM",
    doseHormone: 0.5,
    coutHormone: 5000,
    temperatureEauC: 28,
    notes: "Ponte induite",
  };

  const validBodyWithLotFemelle = {
    datePonte: "2026-03-01T00:00:00.000Z",
    lotGeniteursFemellId: "lot-f-1",
    lotGeniteursMaleId: "lot-m-1",
    notes: "Ponte groupe",
  };

  it("crée une ponte avec femelleId (reproducteur individuel)", async () => {
    const created = {
      id: "ponte-new",
      code: "PONTE-2026-001",
      statut: StatutPonte.EN_COURS,
    };
    mockCreatePonteV2.mockResolvedValue(created);

    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify(validBodyWithFemelleId),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("ponte-new");
    expect(data.code).toBe("PONTE-2026-001");
    expect(data.statut).toBe(StatutPonte.EN_COURS);
    expect(mockCreatePonteV2).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        datePonte: "2026-03-01T00:00:00.000Z",
        femelleId: "rep-f-1",
        maleId: "lot-m-1",
      })
    );
  });

  it("crée une ponte avec lotGeniteursFemellId (lot de femelles)", async () => {
    const created = {
      id: "ponte-lot",
      code: "PONTE-2026-002",
      statut: StatutPonte.EN_COURS,
    };
    mockCreatePonteV2.mockResolvedValue(created);

    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify(validBodyWithLotFemelle),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreatePonteV2).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        lotGeniteursFemellId: "lot-f-1",
        lotGeniteursMaleId: "lot-m-1",
      })
    );
  });

  it("crée une ponte avec uniquement datePonte + femelleId (champs minimum)", async () => {
    const created = {
      id: "ponte-min",
      code: "PONTE-2026-003",
      statut: StatutPonte.EN_COURS,
    };
    mockCreatePonteV2.mockResolvedValue(created);

    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify({
          datePonte: "2026-03-01T00:00:00.000Z",
          femelleId: "rep-f-1",
        }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("retourne 400 si datePonte manquante", async () => {
    const { datePonte: _dp, ...bodyWithoutDate } = validBodyWithFemelleId;
    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify(bodyWithoutDate),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "datePonte" }),
      ])
    );
  });

  it("retourne 400 si datePonte invalide", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify({
          ...validBodyWithFemelleId,
          datePonte: "pas-une-date",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "datePonte" }),
      ])
    );
  });

  it("retourne 400 si aucun champ femelle fourni (XOR violation — aucun)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify({
          datePonte: "2026-03-01T00:00:00.000Z",
          maleId: "lot-m-1",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "femelleId" }),
      ])
    );
  });

  it("retourne 400 si les deux champs femelle sont fournis (XOR violation — les deux)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify({
          datePonte: "2026-03-01T00:00:00.000Z",
          femelleId: "rep-f-1",
          lotGeniteursFemellId: "lot-f-1",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "femelleId" }),
      ])
    );
  });

  it("retourne 400 si doseHormone est négative", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify({
          ...validBodyWithFemelleId,
          doseHormone: -1,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "doseHormone" }),
      ])
    );
  });

  it("accepte doseHormone = 0", async () => {
    mockCreatePonteV2.mockResolvedValue({
      id: "ponte-ok",
      code: "PONTE-2026-001",
      statut: StatutPonte.EN_COURS,
    });

    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify({
          ...validBodyWithFemelleId,
          doseHormone: 0,
        }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("retourne 400 si coutHormone est négatif", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify({
          ...validBodyWithFemelleId,
          coutHormone: -500,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "coutHormone" }),
      ])
    );
  });

  it("retourne 400 si temperatureEauC n'est pas un nombre", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify({
          ...validBodyWithFemelleId,
          temperatureEauC: "chaud",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "temperatureEauC" }),
      ])
    );
  });

  it("retourne 404 si la femelle est introuvable", async () => {
    mockCreatePonteV2.mockRejectedValue(
      new Error("Reproducteur introuvable")
    );

    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify(validBodyWithFemelleId),
      })
    );

    expect(response.status).toBe(404);
  });

  it("retourne 400 si la femelle n'a pas le statut ACTIF", async () => {
    mockCreatePonteV2.mockRejectedValue(
      new Error("La femelle doit avoir le statut ACTIF")
    );

    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify(validBodyWithFemelleId),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify(validBodyWithFemelleId),
      })
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify(validBodyWithFemelleId),
      })
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/reproduction/pontes/[id]
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/pontes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le détail d'une ponte par ID", async () => {
    const detail = { ...FAKE_PONTE, lots: [], incubations: [] };
    mockGetPonteById.mockResolvedValue(detail);

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/pontes/ponte-1"),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("ponte-1");
    expect(data.code).toBe("PONTE-2026-001");
    expect(mockGetPonteById).toHaveBeenCalledWith("ponte-1", "site-1");
  });

  it("retourne 404 si ponte introuvable", async () => {
    mockGetPonteById.mockResolvedValue(null);

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/pontes/xxx"),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/pontes/ponte-1"),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/pontes/ponte-1"),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/reproduction/pontes/[id]/stripping — étape 2
// ---------------------------------------------------------------------------

describe("PATCH /api/reproduction/pontes/[id]/stripping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validStrippingBody = {
    heureStripping: "2026-03-01T10:30:00.000Z",
    poidsOeufsPontesG: 45.5,
    nombreOeufsEstime: 9100,
    qualiteOeufs: "BONNE",
    methodeMale: "SACRIFICE",
    motiliteSperme: "OK",
    notes: "Stripping réussi",
  };

  it("enregistre le stripping avec succès", async () => {
    const updated = {
      ...FAKE_PONTE,
      heureStripping: new Date("2026-03-01T10:30:00.000Z"),
      poidsOeufsPontesG: 45.5,
      nombreOeufsEstime: 9100,
    };
    mockUpdateStripping.mockResolvedValue(updated);

    const response = await PATCH_STRIPPING(
      makeRequest("/api/reproduction/pontes/ponte-1/stripping", {
        method: "PATCH",
        body: JSON.stringify(validStrippingBody),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.poidsOeufsPontesG).toBe(45.5);
    expect(data.nombreOeufsEstime).toBe(9100);
    expect(mockUpdateStripping).toHaveBeenCalledWith(
      "ponte-1",
      "site-1",
      expect.objectContaining({ heureStripping: "2026-03-01T10:30:00.000Z" })
    );
  });

  it("retourne 400 si heureStripping manquante", async () => {
    const { heureStripping: _hs, ...bodyWithoutHeure } = validStrippingBody;
    const response = await PATCH_STRIPPING(
      makeRequest("/api/reproduction/pontes/ponte-1/stripping", {
        method: "PATCH",
        body: JSON.stringify(bodyWithoutHeure),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "heureStripping" }),
      ])
    );
  });

  it("retourne 400 si heureStripping est une date invalide", async () => {
    const response = await PATCH_STRIPPING(
      makeRequest("/api/reproduction/pontes/ponte-1/stripping", {
        method: "PATCH",
        body: JSON.stringify({ ...validStrippingBody, heureStripping: "pas-une-date" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "heureStripping" }),
      ])
    );
  });

  it("retourne 400 si poidsOeufsPontesG <= 0", async () => {
    const response = await PATCH_STRIPPING(
      makeRequest("/api/reproduction/pontes/ponte-1/stripping", {
        method: "PATCH",
        body: JSON.stringify({ ...validStrippingBody, poidsOeufsPontesG: 0 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "poidsOeufsPontesG" }),
      ])
    );
  });

  it("retourne 400 si nombreOeufsEstime <= 0", async () => {
    const response = await PATCH_STRIPPING(
      makeRequest("/api/reproduction/pontes/ponte-1/stripping", {
        method: "PATCH",
        body: JSON.stringify({ ...validStrippingBody, nombreOeufsEstime: 0 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nombreOeufsEstime" }),
      ])
    );
  });

  it("fonctionne avec uniquement heureStripping (champs optionnels absents)", async () => {
    const updated = {
      ...FAKE_PONTE,
      heureStripping: new Date("2026-03-01T10:30:00.000Z"),
    };
    mockUpdateStripping.mockResolvedValue(updated);

    const response = await PATCH_STRIPPING(
      makeRequest("/api/reproduction/pontes/ponte-1/stripping", {
        method: "PATCH",
        body: JSON.stringify({ heureStripping: "2026-03-01T10:30:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
  });

  it("retourne 404 si ponte introuvable", async () => {
    mockUpdateStripping.mockRejectedValue(new Error("Ponte introuvable"));

    const response = await PATCH_STRIPPING(
      makeRequest("/api/reproduction/pontes/xxx/stripping", {
        method: "PATCH",
        body: JSON.stringify(validStrippingBody),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await PATCH_STRIPPING(
      makeRequest("/api/reproduction/pontes/ponte-1/stripping", {
        method: "PATCH",
        body: JSON.stringify(validStrippingBody),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/reproduction/pontes/[id]/resultat — étape 3
// ---------------------------------------------------------------------------

describe("PATCH /api/reproduction/pontes/[id]/resultat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validResultatBody = {
    tauxFecondation: 80,
    tauxEclosion: 70,
    nombreLarvesViables: 5600,
    coutTotal: 25000,
    notes: "Bonne ponte",
  };

  it("enregistre le résultat final et passe la ponte en TERMINEE", async () => {
    const updated = {
      ...FAKE_PONTE,
      statut: StatutPonte.TERMINEE,
      tauxFecondation: 80,
      tauxEclosion: 70,
      nombreLarvesViables: 5600,
    };
    mockUpdateResultat.mockResolvedValue(updated);

    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-1/resultat", {
        method: "PATCH",
        body: JSON.stringify(validResultatBody),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutPonte.TERMINEE);
    expect(data.tauxFecondation).toBe(80);
    expect(data.nombreLarvesViables).toBe(5600);
    expect(mockUpdateResultat).toHaveBeenCalledWith("ponte-1", "site-1", expect.any(Object));
  });

  it("accepte un résultat sans aucun champ (tous optionnels)", async () => {
    const updated = { ...FAKE_PONTE, statut: StatutPonte.TERMINEE };
    mockUpdateResultat.mockResolvedValue(updated);

    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-1/resultat", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
  });

  it("retourne 400 si tauxFecondation > 100", async () => {
    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-1/resultat", {
        method: "PATCH",
        body: JSON.stringify({ ...validResultatBody, tauxFecondation: 105 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "tauxFecondation" }),
      ])
    );
  });

  it("retourne 400 si tauxFecondation < 0", async () => {
    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-1/resultat", {
        method: "PATCH",
        body: JSON.stringify({ ...validResultatBody, tauxFecondation: -5 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "tauxFecondation" }),
      ])
    );
  });

  it("accepte tauxFecondation = 0", async () => {
    mockUpdateResultat.mockResolvedValue({ ...FAKE_PONTE, tauxFecondation: 0, statut: StatutPonte.TERMINEE });

    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-1/resultat", {
        method: "PATCH",
        body: JSON.stringify({ tauxFecondation: 0 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
  });

  it("retourne 400 si tauxEclosion > 100", async () => {
    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-1/resultat", {
        method: "PATCH",
        body: JSON.stringify({ ...validResultatBody, tauxEclosion: 110 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "tauxEclosion" }),
      ])
    );
  });

  it("retourne 400 si nombreLarvesViables <= 0", async () => {
    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-1/resultat", {
        method: "PATCH",
        body: JSON.stringify({ ...validResultatBody, nombreLarvesViables: 0 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nombreLarvesViables" }),
      ])
    );
  });

  it("retourne 400 si coutTotal négatif", async () => {
    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-1/resultat", {
        method: "PATCH",
        body: JSON.stringify({ ...validResultatBody, coutTotal: -1000 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "coutTotal" }),
      ])
    );
  });

  it("accepte coutTotal = 0", async () => {
    mockUpdateResultat.mockResolvedValue({ ...FAKE_PONTE, coutTotal: 0, statut: StatutPonte.TERMINEE });

    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-1/resultat", {
        method: "PATCH",
        body: JSON.stringify({ coutTotal: 0 }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
  });

  it("retourne 404 si ponte introuvable", async () => {
    mockUpdateResultat.mockRejectedValue(new Error("Ponte introuvable"));

    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/xxx/resultat", {
        method: "PATCH",
        body: JSON.stringify(validResultatBody),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-1/resultat", {
        method: "PATCH",
        body: JSON.stringify(validResultatBody),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/reproduction/pontes/[id]/echec — marquer comme échouée
// ---------------------------------------------------------------------------

describe("PATCH /api/reproduction/pontes/[id]/echec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("marque une ponte comme échouée avec causeEchec", async () => {
    const updated = {
      ...FAKE_PONTE,
      statut: StatutPonte.ECHOUEE,
      causeEchec: CauseEchecPonte.SPERME_NON_VIABLE,
    };
    mockMarkEchec.mockResolvedValue(updated);

    const response = await PATCH_ECHEC(
      makeRequest("/api/reproduction/pontes/ponte-1/echec", {
        method: "PATCH",
        body: JSON.stringify({
          causeEchec: CauseEchecPonte.SPERME_NON_VIABLE,
          notes: "Sperme non viable observé",
        }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.statut).toBe(StatutPonte.ECHOUEE);
    expect(data.causeEchec).toBe(CauseEchecPonte.SPERME_NON_VIABLE);
    expect(mockMarkEchec).toHaveBeenCalledWith("ponte-1", "site-1", {
      causeEchec: CauseEchecPonte.SPERME_NON_VIABLE,
      notes: "Sperme non viable observé",
    });
  });

  it("marque une ponte comme échouée sans notes", async () => {
    const updated = {
      ...FAKE_PONTE,
      statut: StatutPonte.ECHOUEE,
      causeEchec: CauseEchecPonte.STRIPPING_TROP_PRECOCE,
    };
    mockMarkEchec.mockResolvedValue(updated);

    const response = await PATCH_ECHEC(
      makeRequest("/api/reproduction/pontes/ponte-1/echec", {
        method: "PATCH",
        body: JSON.stringify({ causeEchec: CauseEchecPonte.STRIPPING_TROP_PRECOCE }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockMarkEchec).toHaveBeenCalledWith("ponte-1", "site-1", {
      causeEchec: CauseEchecPonte.STRIPPING_TROP_PRECOCE,
    });
  });

  it("retourne 400 si causeEchec manquante", async () => {
    const response = await PATCH_ECHEC(
      makeRequest("/api/reproduction/pontes/ponte-1/echec", {
        method: "PATCH",
        body: JSON.stringify({ notes: "Echec sans cause" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "causeEchec" }),
      ])
    );
  });

  it("retourne 400 si causeEchec invalide", async () => {
    const response = await PATCH_ECHEC(
      makeRequest("/api/reproduction/pontes/ponte-1/echec", {
        method: "PATCH",
        body: JSON.stringify({ causeEchec: "MAUVAIS_TEMPS" }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "causeEchec" }),
      ])
    );
  });

  it("accepte toutes les valeurs valides de CauseEchecPonte", async () => {
    const updated = { ...FAKE_PONTE, statut: StatutPonte.ECHOUEE };
    mockMarkEchec.mockResolvedValue(updated);

    for (const cause of Object.values(CauseEchecPonte)) {
      const response = await PATCH_ECHEC(
        makeRequest("/api/reproduction/pontes/ponte-1/echec", {
          method: "PATCH",
          body: JSON.stringify({ causeEchec: cause }),
        }),
        { params: Promise.resolve({ id: "ponte-1" }) }
      );

      expect(response.status).toBe(200);
    }
  });

  it("retourne 404 si ponte introuvable", async () => {
    mockMarkEchec.mockRejectedValue(new Error("Ponte introuvable"));

    const response = await PATCH_ECHEC(
      makeRequest("/api/reproduction/pontes/xxx/echec", {
        method: "PATCH",
        body: JSON.stringify({ causeEchec: CauseEchecPonte.AUTRE }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await PATCH_ECHEC(
      makeRequest("/api/reproduction/pontes/ponte-1/echec", {
        method: "PATCH",
        body: JSON.stringify({ causeEchec: CauseEchecPonte.AUTRE }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await PATCH_ECHEC(
      makeRequest("/api/reproduction/pontes/ponte-1/echec", {
        method: "PATCH",
        body: JSON.stringify({ causeEchec: CauseEchecPonte.AUTRE }),
      }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/reproduction/pontes/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/reproduction/pontes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("supprime une ponte sans lots liés (retourne 204)", async () => {
    mockDeletePonte.mockResolvedValue(undefined);

    const response = await DELETE(
      makeRequest("/api/reproduction/pontes/ponte-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(204);
    expect(mockDeletePonte).toHaveBeenCalledWith("ponte-1", "site-1");
  });

  it("retourne 409 si la ponte est bloquée par des lots", async () => {
    mockDeletePonte.mockRejectedValue(
      new Error("Impossible de supprimer : cette ponte a des lots d'alevins liés")
    );

    const response = await DELETE(
      makeRequest("/api/reproduction/pontes/ponte-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 404 si ponte introuvable", async () => {
    mockDeletePonte.mockRejectedValue(new Error("Ponte introuvable"));

    const response = await DELETE(
      makeRequest("/api/reproduction/pontes/xxx", { method: "DELETE" }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await DELETE(
      makeRequest("/api/reproduction/pontes/ponte-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await DELETE(
      makeRequest("/api/reproduction/pontes/ponte-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockDeletePonte.mockRejectedValue(new Error("Unexpected DB error"));

    const response = await DELETE(
      makeRequest("/api/reproduction/pontes/ponte-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "ponte-1" }) }
    );

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Workflow complet : création → stripping → résultat (TERMINEE)
// ---------------------------------------------------------------------------

describe("Workflow complet : création → stripping → résultat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("enchaîne les 3 étapes et termine en TERMINEE", async () => {
    // Étape 1 — création
    const created = {
      id: "ponte-wf",
      code: "PONTE-2026-WF",
      statut: StatutPonte.EN_COURS,
    };
    mockCreatePonteV2.mockResolvedValue(created);

    const step1 = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify({
          datePonte: "2026-03-10T08:00:00.000Z",
          femelleId: "rep-f-1",
          typeHormone: "OVAPRIM",
          doseHormone: 0.5,
        }),
      })
    );
    expect(step1.status).toBe(201);
    const step1Data = await step1.json();
    expect(step1Data.statut).toBe(StatutPonte.EN_COURS);

    // Étape 2 — stripping
    const afterStripping = {
      ...FAKE_PONTE,
      id: "ponte-wf",
      heureStripping: new Date("2026-03-10T18:00:00.000Z"),
      poidsOeufsPontesG: 50,
      nombreOeufsEstime: 10000,
    };
    mockUpdateStripping.mockResolvedValue(afterStripping);

    const step2 = await PATCH_STRIPPING(
      makeRequest("/api/reproduction/pontes/ponte-wf/stripping", {
        method: "PATCH",
        body: JSON.stringify({
          heureStripping: "2026-03-10T18:00:00.000Z",
          poidsOeufsPontesG: 50,
          nombreOeufsEstime: 10000,
        }),
      }),
      { params: Promise.resolve({ id: "ponte-wf" }) }
    );
    expect(step2.status).toBe(200);

    // Étape 3 — résultat
    const afterResultat = {
      ...FAKE_PONTE,
      id: "ponte-wf",
      statut: StatutPonte.TERMINEE,
      tauxFecondation: 85,
      tauxEclosion: 75,
      nombreLarvesViables: 7500,
    };
    mockUpdateResultat.mockResolvedValue(afterResultat);

    const step3 = await PATCH_RESULTAT(
      makeRequest("/api/reproduction/pontes/ponte-wf/resultat", {
        method: "PATCH",
        body: JSON.stringify({
          tauxFecondation: 85,
          tauxEclosion: 75,
          nombreLarvesViables: 7500,
          coutTotal: 30000,
        }),
      }),
      { params: Promise.resolve({ id: "ponte-wf" }) }
    );
    expect(step3.status).toBe(200);
    const step3Data = await step3.json();
    expect(step3Data.statut).toBe(StatutPonte.TERMINEE);
  });
});

// ---------------------------------------------------------------------------
// Workflow d'échec : création → echec
// ---------------------------------------------------------------------------

describe("Workflow d'échec : création → echec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("crée une ponte puis la marque comme échouée", async () => {
    // Étape 1 — création
    const created = {
      id: "ponte-fail",
      code: "PONTE-2026-FAIL",
      statut: StatutPonte.EN_COURS,
    };
    mockCreatePonteV2.mockResolvedValue(created);

    const step1 = await POST(
      makeRequest("/api/reproduction/pontes", {
        method: "POST",
        body: JSON.stringify({
          datePonte: "2026-03-15T08:00:00.000Z",
          femelleId: "rep-f-2",
        }),
      })
    );
    expect(step1.status).toBe(201);

    // Étape 2 — échec
    const afterEchec = {
      ...FAKE_PONTE,
      id: "ponte-fail",
      statut: StatutPonte.ECHOUEE,
      causeEchec: CauseEchecPonte.FEMELLE_NON_MATURE,
    };
    mockMarkEchec.mockResolvedValue(afterEchec);

    const step2 = await PATCH_ECHEC(
      makeRequest("/api/reproduction/pontes/ponte-fail/echec", {
        method: "PATCH",
        body: JSON.stringify({
          causeEchec: CauseEchecPonte.FEMELLE_NON_MATURE,
          notes: "Femelle non mature détectée au stripping",
        }),
      }),
      { params: Promise.resolve({ id: "ponte-fail" }) }
    );
    expect(step2.status).toBe(200);
    const step2Data = await step2.json();
    expect(step2Data.statut).toBe(StatutPonte.ECHOUEE);
    expect(step2Data.causeEchec).toBe(CauseEchecPonte.FEMELLE_NON_MATURE);
  });
});
