/**
 * Tests API — /api/reproduction/lots
 *
 * Couvre :
 *   GET  /api/reproduction/lots            — liste avec pagination, filtres phase/statut/ponteId/bacId
 *   POST /api/reproduction/lots            — creation avec champs requis et optionnels, erreurs validation
 *   GET  /api/reproduction/lots/[id]       — detail par id, 404
 *   PATCH /api/reproduction/lots/[id]      — mise a jour partielle, validation
 *   DELETE /api/reproduction/lots/[id]     — suppression, 404, sous-lots actifs
 *   PATCH /api/reproduction/lots/[id]/phase  — changement de phase, enum valide
 *   POST /api/reproduction/lots/[id]/split   — fractionnement, validation somme, sous-lots vides
 *   PATCH /api/reproduction/lots/[id]/sortie — sortie avec destination, validation champs obligatoires
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/reproduction/lots/route";
import {
  GET as GET_DETAIL,
  PATCH,
  DELETE,
} from "@/app/api/reproduction/lots/[id]/route";
import { PATCH as PATCH_PHASE } from "@/app/api/reproduction/lots/[id]/phase/route";
import { POST as POST_SPLIT } from "@/app/api/reproduction/lots/[id]/split/route";
import { PATCH as PATCH_SORTIE } from "@/app/api/reproduction/lots/[id]/sortie/route";
import { NextRequest } from "next/server";
import {
  Permission,
  PhaseLot,
  StatutLotAlevins,
  DestinationLot,
} from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListLots = vi.fn();
const mockGetLotById = vi.fn();
const mockCreateLot = vi.fn();
const mockUpdateLot = vi.fn();
const mockChangeLotPhase = vi.fn();
const mockSplitLot = vi.fn();
const mockSortirLot = vi.fn();
const mockDeleteLot = vi.fn();

vi.mock("@/lib/queries/lots-alevins", () => ({
  listLots: (...args: unknown[]) => mockListLots(...args),
  getLotById: (...args: unknown[]) => mockGetLotById(...args),
  createLot: (...args: unknown[]) => mockCreateLot(...args),
  updateLot: (...args: unknown[]) => mockUpdateLot(...args),
  changeLotPhase: (...args: unknown[]) => mockChangeLotPhase(...args),
  splitLot: (...args: unknown[]) => mockSplitLot(...args),
  sortirLot: (...args: unknown[]) => mockSortirLot(...args),
  deleteLot: (...args: unknown[]) => mockDeleteLot(...args),
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
    Permission.ALEVINS_CREER,
    Permission.ALEVINS_MODIFIER,
    Permission.ALEVINS_SUPPRIMER,
    Permission.ALEVINS_GERER,
  ],
};

const FAKE_LOT = {
  id: "lot-1",
  code: "LOT-2026-001",
  ponteId: "ponte-1",
  nombreInitial: 500,
  nombreActuel: 480,
  ageJours: 5,
  poidsMoyen: null,
  statut: StatutLotAlevins.EN_INCUBATION,
  phase: PhaseLot.INCUBATION,
  bacId: null,
  bac: null,
  vagueDestinationId: null,
  vagueDestination: null,
  incubationId: null,
  parentLotId: null,
  dateDebutPhase: new Date("2026-03-01"),
  destinationSortie: null,
  dateTransfert: null,
  nombreDeformesRetires: 0,
  poidsObjectifG: null,
  notes: null,
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  ponte: { id: "ponte-1", code: "PONTE-001" },
  _count: { sousLots: 0 },
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// GET /api/reproduction/lots
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/lots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des lots avec total, limit et offset par defaut", async () => {
    mockListLots.mockResolvedValue({ data: [FAKE_LOT], total: 1 });

    const response = await GET(makeRequest("/api/reproduction/lots"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.limit).toBe(50);
    expect(data.offset).toBe(0);
  });

  it("transmet les filtres phase, statut, ponteId, bacId a listLots", async () => {
    mockListLots.mockResolvedValue({ data: [], total: 0 });

    await GET(
      makeRequest(
        "/api/reproduction/lots?phase=LARVAIRE&statut=EN_ELEVAGE&ponteId=ponte-42&bacId=bac-7"
      )
    );

    expect(mockListLots).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        phase: PhaseLot.LARVAIRE,
        statut: StatutLotAlevins.EN_ELEVAGE,
        ponteId: "ponte-42",
        bacId: "bac-7",
      })
    );
  });

  it("transmet les parametres de pagination limit et offset", async () => {
    mockListLots.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/reproduction/lots?limit=10&offset=20"));

    expect(mockListLots).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ limit: 10, offset: 20 })
    );
  });

  it("retourne 400 si phase invalide", async () => {
    const response = await GET(
      makeRequest("/api/reproduction/lots?phase=INVALIDE")
    );
    expect(response.status).toBe(400);
  });

  it("retourne 400 si statut invalide", async () => {
    const response = await GET(
      makeRequest("/api/reproduction/lots?statut=INCONNU")
    );
    expect(response.status).toBe(400);
  });

  it("retourne 400 si limit < 1", async () => {
    const response = await GET(
      makeRequest("/api/reproduction/lots?limit=0")
    );
    expect(response.status).toBe(400);
  });

  it("retourne 400 si offset < 0", async () => {
    const response = await GET(
      makeRequest("/api/reproduction/lots?offset=-1")
    );
    expect(response.status).toBe(400);
  });

  it("retourne 400 si limit est non-numerique", async () => {
    const response = await GET(
      makeRequest("/api/reproduction/lots?limit=abc")
    );
    expect(response.status).toBe(400);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/reproduction/lots"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/reproduction/lots"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockListLots.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/reproduction/lots"));
    expect(response.status).toBe(500);
  });

  it("accepte toutes les valeurs valides de PhaseLot", async () => {
    mockListLots.mockResolvedValue({ data: [], total: 0 });

    for (const phase of Object.values(PhaseLot)) {
      const response = await GET(
        makeRequest(`/api/reproduction/lots?phase=${phase}`)
      );
      expect(response.status).toBe(200);
    }
  });

  it("accepte toutes les valeurs valides de StatutLotAlevins", async () => {
    mockListLots.mockResolvedValue({ data: [], total: 0 });

    for (const statut of Object.values(StatutLotAlevins)) {
      const response = await GET(
        makeRequest(`/api/reproduction/lots?statut=${statut}`)
      );
      expect(response.status).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/reproduction/lots
// ---------------------------------------------------------------------------

describe("POST /api/reproduction/lots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validBody = {
    code: "LOT-2026-NEW",
    ponteId: "ponte-1",
    nombreInitial: 500,
  };

  it("cree un lot avec les champs obligatoires", async () => {
    const created = { ...FAKE_LOT, id: "lot-new", code: "LOT-2026-NEW" };
    mockCreateLot.mockResolvedValue(created);

    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("lot-new");
    expect(mockCreateLot).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        code: "LOT-2026-NEW",
        ponteId: "ponte-1",
        nombreInitial: 500,
      })
    );
  });

  it("cree un lot avec tous les champs optionnels", async () => {
    const created = { ...FAKE_LOT, id: "lot-full" };
    mockCreateLot.mockResolvedValue(created);

    const fullBody = {
      ...validBody,
      nombreActuel: 480,
      ageJours: 3,
      poidsMoyen: 0.05,
      statut: StatutLotAlevins.EN_INCUBATION,
      phase: PhaseLot.INCUBATION,
      bacId: "bac-1",
      incubationId: "incub-1",
      dateDebutPhase: "2026-03-01T00:00:00.000Z",
      poidsObjectifG: 5.0,
      notes: "Notes de test",
    };

    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify(fullBody),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateLot).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        code: "LOT-2026-NEW",
        nombreActuel: 480,
        ageJours: 3,
        poidsMoyen: 0.05,
        bacId: "bac-1",
        notes: "Notes de test",
      })
    );
  });

  it("retourne 400 si code manquant", async () => {
    const { code: _code, ...bodyWithoutCode } = validBody;
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify(bodyWithoutCode),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "code" })])
    );
  });

  it("retourne 400 si code est une chaine vide", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify({ ...validBody, code: "   " }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si ponteId manquant", async () => {
    const { ponteId: _ponteId, ...bodyWithoutPonte } = validBody;
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify(bodyWithoutPonte),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "ponteId" })])
    );
  });

  it("retourne 400 si nombreInitial manquant", async () => {
    const { nombreInitial: _n, ...bodyWithoutNombre } = validBody;
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify(bodyWithoutNombre),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nombreInitial" }),
      ])
    );
  });

  it("retourne 400 si nombreInitial = 0", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify({ ...validBody, nombreInitial: 0 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nombreInitial" }),
      ])
    );
  });

  it("retourne 400 si nombreInitial negatif", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify({ ...validBody, nombreInitial: -10 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si nombreInitial est un flottant", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify({ ...validBody, nombreInitial: 500.5 }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si nombreActuel est negatif", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify({ ...validBody, nombreActuel: -1 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nombreActuel" }),
      ])
    );
  });

  it("retourne 400 si ageJours est negatif", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify({ ...validBody, ageJours: -1 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "ageJours" })])
    );
  });

  it("retourne 400 si poidsMoyen est negatif", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify({ ...validBody, poidsMoyen: -0.5 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poidsMoyen" })])
    );
  });

  it("retourne 400 si phase est invalide", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify({ ...validBody, phase: "ADULTE" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "phase" })])
    );
  });

  it("retourne 409 si code deja utilise", async () => {
    mockCreateLot.mockRejectedValue(
      new Error('Le code "LOT-2026-NEW" est deja utilise')
    );

    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(409);
  });

  it("retourne 409 si ponte introuvable", async () => {
    mockCreateLot.mockRejectedValue(new Error("Ponte introuvable"));

    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(409);
  });

  it("retourne 409 si bac introuvable", async () => {
    mockCreateLot.mockRejectedValue(new Error("Bac introuvable"));

    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify({ ...validBody, bacId: "bac-inexistant" }),
      })
    );

    expect(response.status).toBe(409);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await POST(
      makeRequest("/api/reproduction/lots", {
        method: "POST",
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/reproduction/lots/[id]
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/lots/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne un lot par ID avec detail complet", async () => {
    mockGetLotById.mockResolvedValue(FAKE_LOT);

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/lots/lot-1"),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("lot-1");
    expect(mockGetLotById).toHaveBeenCalledWith("lot-1", "site-1");
  });

  it("retourne 404 si lot introuvable", async () => {
    mockGetLotById.mockResolvedValue(null);

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/lots/xxx"),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/lots/lot-1"),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/lots/lot-1"),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetLotById.mockRejectedValue(new Error("DB error"));

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/lots/lot-1"),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/reproduction/lots/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/reproduction/lots/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour un lot avec les champs fournis", async () => {
    const updated = { ...FAKE_LOT, nombreActuel: 450, ageJours: 10 };
    mockUpdateLot.mockResolvedValue(updated);

    const response = await PATCH(
      makeRequest("/api/reproduction/lots/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ nombreActuel: 450, ageJours: 10 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nombreActuel).toBe(450);
    expect(data.ageJours).toBe(10);
    expect(mockUpdateLot).toHaveBeenCalledWith(
      "lot-1",
      "site-1",
      expect.any(Object)
    );
  });

  it("met a jour le poidsMoyen", async () => {
    const updated = { ...FAKE_LOT, poidsMoyen: 0.12 };
    mockUpdateLot.mockResolvedValue(updated);

    const response = await PATCH(
      makeRequest("/api/reproduction/lots/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ poidsMoyen: 0.12 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(200);
  });

  it("retourne 400 si nombreActuel est negatif", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/lots/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ nombreActuel: -1 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nombreActuel" }),
      ])
    );
  });

  it("retourne 400 si ageJours est negatif", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/lots/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ ageJours: -5 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "ageJours" })])
    );
  });

  it("retourne 400 si poidsMoyen est negatif", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/lots/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ poidsMoyen: -1.5 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poidsMoyen" })])
    );
  });

  it("retourne 400 si ageJours est un flottant", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/lots/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ ageJours: 2.5 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 404 si lot introuvable", async () => {
    mockUpdateLot.mockRejectedValue(new Error("Lot d'alevins introuvable"));

    const response = await PATCH(
      makeRequest("/api/reproduction/lots/xxx", {
        method: "PATCH",
        body: JSON.stringify({ nombreActuel: 100 }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si code deja utilise", async () => {
    mockUpdateLot.mockRejectedValue(
      new Error('Le code "LOT-2026-002" est deja utilise')
    );

    const response = await PATCH(
      makeRequest("/api/reproduction/lots/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ code: "LOT-2026-002" }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await PATCH(
      makeRequest("/api/reproduction/lots/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ nombreActuel: 400 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/reproduction/lots/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/reproduction/lots/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("supprime un lot sans sous-lots actifs et retourne 204", async () => {
    mockDeleteLot.mockResolvedValue(undefined);

    const response = await DELETE(
      makeRequest("/api/reproduction/lots/lot-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(204);
    expect(mockDeleteLot).toHaveBeenCalledWith("lot-1", "site-1");
  });

  it("retourne 404 si lot introuvable", async () => {
    mockDeleteLot.mockRejectedValue(new Error("Lot d'alevins introuvable"));

    const response = await DELETE(
      makeRequest("/api/reproduction/lots/xxx", { method: "DELETE" }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si le lot a des sous-lots actifs", async () => {
    mockDeleteLot.mockRejectedValue(
      new Error(
        "Impossible de supprimer : ce lot a 2 sous-lot(s) actif(s) : LOT-001-A, LOT-001-B. " +
          "Transferez ou marquez les sous-lots comme perdus avant de supprimer le lot parent."
      )
    );

    const response = await DELETE(
      makeRequest("/api/reproduction/lots/lot-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await DELETE(
      makeRequest("/api/reproduction/lots/lot-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await DELETE(
      makeRequest("/api/reproduction/lots/lot-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockDeleteLot.mockRejectedValue(new Error("DB connection lost"));

    const response = await DELETE(
      makeRequest("/api/reproduction/lots/lot-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/reproduction/lots/[id]/phase
// ---------------------------------------------------------------------------

describe("PATCH /api/reproduction/lots/[id]/phase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("change la phase avec une phase valide et retourne 204", async () => {
    mockChangeLotPhase.mockResolvedValue(undefined);

    const response = await PATCH_PHASE(
      makeRequest("/api/reproduction/lots/lot-1/phase", {
        method: "PATCH",
        body: JSON.stringify({ phase: PhaseLot.LARVAIRE }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(204);
    expect(mockChangeLotPhase).toHaveBeenCalledWith(
      "lot-1",
      "site-1",
      expect.objectContaining({ phase: PhaseLot.LARVAIRE })
    );
  });

  it("accepte une dateDebutPhase valide", async () => {
    mockChangeLotPhase.mockResolvedValue(undefined);

    const response = await PATCH_PHASE(
      makeRequest("/api/reproduction/lots/lot-1/phase", {
        method: "PATCH",
        body: JSON.stringify({
          phase: PhaseLot.NURSERIE,
          dateDebutPhase: "2026-03-10T00:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(204);
    expect(mockChangeLotPhase).toHaveBeenCalledWith(
      "lot-1",
      "site-1",
      expect.objectContaining({
        phase: PhaseLot.NURSERIE,
        dateDebutPhase: "2026-03-10T00:00:00.000Z",
      })
    );
  });

  it("accepte un bacId optionnel", async () => {
    mockChangeLotPhase.mockResolvedValue(undefined);

    const response = await PATCH_PHASE(
      makeRequest("/api/reproduction/lots/lot-1/phase", {
        method: "PATCH",
        body: JSON.stringify({ phase: PhaseLot.ALEVINAGE, bacId: "bac-5" }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(204);
    expect(mockChangeLotPhase).toHaveBeenCalledWith(
      "lot-1",
      "site-1",
      expect.objectContaining({ bacId: "bac-5" })
    );
  });

  it("accepte toutes les valeurs valides de PhaseLot", async () => {
    mockChangeLotPhase.mockResolvedValue(undefined);

    for (const phase of Object.values(PhaseLot)) {
      const response = await PATCH_PHASE(
        makeRequest("/api/reproduction/lots/lot-1/phase", {
          method: "PATCH",
          body: JSON.stringify({ phase }),
        }),
        { params: Promise.resolve({ id: "lot-1" }) }
      );
      expect(response.status).toBe(204);
    }
  });

  it("retourne 400 si phase manquante", async () => {
    const response = await PATCH_PHASE(
      makeRequest("/api/reproduction/lots/lot-1/phase", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "phase" })])
    );
  });

  it("retourne 400 si phase invalide", async () => {
    const response = await PATCH_PHASE(
      makeRequest("/api/reproduction/lots/lot-1/phase", {
        method: "PATCH",
        body: JSON.stringify({ phase: "ADULTE" }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "phase" })])
    );
  });

  it("retourne 400 si dateDebutPhase n'est pas une date valide", async () => {
    const response = await PATCH_PHASE(
      makeRequest("/api/reproduction/lots/lot-1/phase", {
        method: "PATCH",
        body: JSON.stringify({
          phase: PhaseLot.LARVAIRE,
          dateDebutPhase: "pas-une-date",
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "dateDebutPhase" }),
      ])
    );
  });

  it("retourne 404 si lot introuvable", async () => {
    mockChangeLotPhase.mockRejectedValue(
      new Error("Lot d'alevins introuvable")
    );

    const response = await PATCH_PHASE(
      makeRequest("/api/reproduction/lots/xxx/phase", {
        method: "PATCH",
        body: JSON.stringify({ phase: PhaseLot.LARVAIRE }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await PATCH_PHASE(
      makeRequest("/api/reproduction/lots/lot-1/phase", {
        method: "PATCH",
        body: JSON.stringify({ phase: PhaseLot.LARVAIRE }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await PATCH_PHASE(
      makeRequest("/api/reproduction/lots/lot-1/phase", {
        method: "PATCH",
        body: JSON.stringify({ phase: PhaseLot.LARVAIRE }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/reproduction/lots/[id]/split
// ---------------------------------------------------------------------------

describe("POST /api/reproduction/lots/[id]/split", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validSplitBody = {
    sousLots: [
      { nombrePoissons: 200 },
      { nombrePoissons: 150, bacId: "bac-2", notes: "Sous-lot B" },
    ],
  };

  it("fractionne un lot en sous-lots et retourne 201 avec les sous-lots crees", async () => {
    const sousLots = [
      { ...FAKE_LOT, id: "sl-1", code: "LOT-2026-001-A", nombreInitial: 200, nombreActuel: 200, parentLotId: "lot-1" },
      { ...FAKE_LOT, id: "sl-2", code: "LOT-2026-001-B", nombreInitial: 150, nombreActuel: 150, parentLotId: "lot-1" },
    ];
    mockSplitLot.mockResolvedValue(sousLots);

    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify(validSplitBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(mockSplitLot).toHaveBeenCalledWith(
      "lot-1",
      "site-1",
      expect.objectContaining({
        sousLots: expect.arrayContaining([
          expect.objectContaining({ nombrePoissons: 200 }),
          expect.objectContaining({ nombrePoissons: 150, bacId: "bac-2" }),
        ]),
      })
    );
  });

  it("fractionne avec un code personnalise pour un sous-lot", async () => {
    mockSplitLot.mockResolvedValue([
      { ...FAKE_LOT, id: "sl-custom", code: "MON-LOT-A" },
    ]);

    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify({
          sousLots: [{ nombrePoissons: 300, code: "MON-LOT-A" }],
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(201);
    expect(mockSplitLot).toHaveBeenCalledWith(
      "lot-1",
      "site-1",
      expect.objectContaining({
        sousLots: expect.arrayContaining([
          expect.objectContaining({ nombrePoissons: 300, code: "MON-LOT-A" }),
        ]),
      })
    );
  });

  it("retourne 400 si sousLots manquant", async () => {
    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sousLots" })])
    );
  });

  it("retourne 400 si sousLots est un tableau vide", async () => {
    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify({ sousLots: [] }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sousLots" })])
    );
  });

  it("retourne 400 si un sous-lot a nombrePoissons = 0", async () => {
    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify({
          sousLots: [{ nombrePoissons: 0 }],
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "sousLots[0].nombrePoissons" }),
      ])
    );
  });

  it("retourne 400 si un sous-lot a nombrePoissons negatif", async () => {
    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify({
          sousLots: [{ nombrePoissons: 200 }, { nombrePoissons: -50 }],
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "sousLots[1].nombrePoissons" }),
      ])
    );
  });

  it("retourne 400 si un sous-lot a nombrePoissons manquant", async () => {
    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify({
          sousLots: [{ bacId: "bac-1" }],
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si sousLots n'est pas un tableau", async () => {
    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify({ sousLots: "pas-un-tableau" }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 409 si la somme des sous-lots depasse l'effectif actuel", async () => {
    mockSplitLot.mockRejectedValue(
      new Error(
        "Impossible de fractionner : la somme des sous-lots (600) depasse l'effectif actuel du lot parent (480)"
      )
    );

    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify({
          sousLots: [{ nombrePoissons: 300 }, { nombrePoissons: 300 }],
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 404 si lot introuvable", async () => {
    mockSplitLot.mockRejectedValue(new Error("Lot d'alevins introuvable"));

    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/xxx/split", {
        method: "POST",
        body: JSON.stringify(validSplitBody),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si un code de sous-lot est deja utilise", async () => {
    mockSplitLot.mockRejectedValue(
      new Error('Le code "LOT-2026-001-A" est deja utilise pour un sous-lot')
    );

    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify({
          sousLots: [{ nombrePoissons: 200, code: "LOT-2026-001-A" }],
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify(validSplitBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify(validSplitBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockSplitLot.mockRejectedValue(new Error("DB connection lost"));

    const response = await POST_SPLIT(
      makeRequest("/api/reproduction/lots/lot-1/split", {
        method: "POST",
        body: JSON.stringify(validSplitBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/reproduction/lots/[id]/sortie
// ---------------------------------------------------------------------------

describe("PATCH /api/reproduction/lots/[id]/sortie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validSortieBody = {
    destinationSortie: DestinationLot.VENTE_ALEVINS,
    dateTransfert: "2026-04-01T00:00:00.000Z",
  };

  it("enregistre une sortie et retourne 204", async () => {
    mockSortirLot.mockResolvedValue(undefined);

    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify(validSortieBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(204);
    expect(mockSortirLot).toHaveBeenCalledWith(
      "lot-1",
      "site-1",
      expect.objectContaining({
        destinationSortie: DestinationLot.VENTE_ALEVINS,
        dateTransfert: "2026-04-01T00:00:00.000Z",
      })
    );
  });

  it("accepte toutes les destinations valides (sauf TRANSFERT_GROSSISSEMENT sans vagueId)", async () => {
    mockSortirLot.mockResolvedValue(undefined);

    const destinationsNonGrossissement = Object.values(DestinationLot).filter(
      (d) => d !== DestinationLot.TRANSFERT_GROSSISSEMENT
    );

    for (const destination of destinationsNonGrossissement) {
      const response = await PATCH_SORTIE(
        makeRequest("/api/reproduction/lots/lot-1/sortie", {
          method: "PATCH",
          body: JSON.stringify({
            destinationSortie: destination,
            dateTransfert: "2026-04-01T00:00:00.000Z",
          }),
        }),
        { params: Promise.resolve({ id: "lot-1" }) }
      );
      expect(response.status).toBe(204);
    }
  });

  it("accepte TRANSFERT_GROSSISSEMENT avec vagueDestinationId", async () => {
    mockSortirLot.mockResolvedValue(undefined);

    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify({
          destinationSortie: DestinationLot.TRANSFERT_GROSSISSEMENT,
          dateTransfert: "2026-04-01T00:00:00.000Z",
          vagueDestinationId: "vague-42",
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(204);
    expect(mockSortirLot).toHaveBeenCalledWith(
      "lot-1",
      "site-1",
      expect.objectContaining({
        destinationSortie: DestinationLot.TRANSFERT_GROSSISSEMENT,
        vagueDestinationId: "vague-42",
      })
    );
  });

  it("accepte des notes optionnelles", async () => {
    mockSortirLot.mockResolvedValue(undefined);

    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify({
          ...validSortieBody,
          notes: "Vendu a Mr Dupont",
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(204);
    expect(mockSortirLot).toHaveBeenCalledWith(
      "lot-1",
      "site-1",
      expect.objectContaining({ notes: "Vendu a Mr Dupont" })
    );
  });

  it("retourne 400 si destinationSortie manquant", async () => {
    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify({ dateTransfert: "2026-04-01T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "destinationSortie" }),
      ])
    );
  });

  it("retourne 400 si destinationSortie est invalide", async () => {
    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify({
          ...validSortieBody,
          destinationSortie: "INCONNU",
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "destinationSortie" }),
      ])
    );
  });

  it("retourne 400 si dateTransfert manquant", async () => {
    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify({
          destinationSortie: DestinationLot.VENTE_ALEVINS,
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "dateTransfert" }),
      ])
    );
  });

  it("retourne 400 si dateTransfert n'est pas une date valide", async () => {
    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify({
          ...validSortieBody,
          dateTransfert: "pas-une-date",
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "dateTransfert" }),
      ])
    );
  });

  it("retourne 400 si TRANSFERT_GROSSISSEMENT sans vagueDestinationId", async () => {
    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify({
          destinationSortie: DestinationLot.TRANSFERT_GROSSISSEMENT,
          dateTransfert: "2026-04-01T00:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "vagueDestinationId" }),
      ])
    );
  });

  it("retourne 404 si lot introuvable", async () => {
    mockSortirLot.mockRejectedValue(new Error("Lot d'alevins introuvable"));

    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/xxx/sortie", {
        method: "PATCH",
        body: JSON.stringify(validSortieBody),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 404 si vague de destination introuvable", async () => {
    mockSortirLot.mockRejectedValue(
      new Error("Vague de destination introuvable")
    );

    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify({
          destinationSortie: DestinationLot.TRANSFERT_GROSSISSEMENT,
          dateTransfert: "2026-04-01T00:00:00.000Z",
          vagueDestinationId: "vague-inexistante",
        }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify(validSortieBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify(validSortieBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockSortirLot.mockRejectedValue(new Error("DB connection lost"));

    const response = await PATCH_SORTIE(
      makeRequest("/api/reproduction/lots/lot-1/sortie", {
        method: "PATCH",
        body: JSON.stringify(validSortieBody),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(500);
  });
});
