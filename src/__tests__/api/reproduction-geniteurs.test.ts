/**
 * Tests API — /api/reproduction/geniteurs
 *
 * Couvre :
 *   GET  /api/reproduction/geniteurs       — liste (mode GROUPE par défaut, mode INDIVIDUEL)
 *   POST /api/reproduction/geniteurs       — création (GROUPE avec champs requis, INDIVIDUEL)
 *   GET  /api/reproduction/geniteurs/[id]  — détail (GROUPE par défaut, INDIVIDUEL, fallback)
 *   PATCH /api/reproduction/geniteurs/[id] — mise à jour (GROUPE et INDIVIDUEL)
 *   DELETE /api/reproduction/geniteurs/[id]— suppression (succès + blocage pontes actives)
 *   POST /api/reproduction/geniteurs/[id]/utiliser-male — décrémentation mâles
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/reproduction/geniteurs/route";
import {
  GET as GET_DETAIL,
  PATCH,
  DELETE,
} from "@/app/api/reproduction/geniteurs/[id]/route";
import { POST as POST_UTILISER_MALE } from "@/app/api/reproduction/geniteurs/[id]/utiliser-male/route";
import { NextRequest } from "next/server";
import { Permission, SexeReproducteur, StatutReproducteur } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListLotGeniteurs = vi.fn();
const mockCreateLotGeniteurs = vi.fn();
const mockListReproducteurs = vi.fn();
const mockGetLotGeniteursById = vi.fn();
const mockUpdateLotGeniteurs = vi.fn();
const mockDeleteLotGeniteurs = vi.fn();
const mockUtiliserMale = vi.fn();

vi.mock("@/lib/queries/geniteurs", () => ({
  listLotGeniteurs: (...args: unknown[]) => mockListLotGeniteurs(...args),
  createLotGeniteurs: (...args: unknown[]) => mockCreateLotGeniteurs(...args),
  listReproducteurs: (...args: unknown[]) => mockListReproducteurs(...args),
  getLotGeniteursById: (...args: unknown[]) => mockGetLotGeniteursById(...args),
  updateLotGeniteurs: (...args: unknown[]) => mockUpdateLotGeniteurs(...args),
  deleteLotGeniteurs: (...args: unknown[]) => mockDeleteLotGeniteurs(...args),
  utiliserMale: (...args: unknown[]) => mockUtiliserMale(...args),
}));

const mockCreateReproducteur = vi.fn();
const mockGetReproducteurById = vi.fn();
const mockUpdateReproducteur = vi.fn();
const mockDeleteReproducteur = vi.fn();

vi.mock("@/lib/queries/reproducteurs", () => ({
  createReproducteur: (...args: unknown[]) => mockCreateReproducteur(...args),
  getReproducteurById: (...args: unknown[]) => mockGetReproducteurById(...args),
  updateReproducteur: (...args: unknown[]) => mockUpdateReproducteur(...args),
  deleteReproducteur: (...args: unknown[]) => mockDeleteReproducteur(...args),
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
  code: "LG-F-001",
  nom: "Lot femelles A",
  sexe: SexeReproducteur.FEMELLE,
  nombrePoissons: 20,
  poidsMoyenG: 1200,
  statut: StatutReproducteur.ACTIF,
  siteId: "site-1",
  bacId: null,
  bac: null,
  nombreMalesDisponibles: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { pontesAsFemelle: 0, pontesAsMale: 0 },
};

const FAKE_REPRODUCTEUR = {
  id: "rep-1",
  code: "REP-F-001",
  sexe: SexeReproducteur.FEMELLE,
  poids: 1200,
  age: 18,
  origine: "Ecloserie Douala",
  statut: StatutReproducteur.ACTIF,
  dateAcquisition: new Date("2024-06-01"),
  notes: null,
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { pontesAsFemelle: 0, pontesAsMale: 0 },
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ---------------------------------------------------------------------------
// GET /api/reproduction/geniteurs — mode GROUPE (défaut)
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/geniteurs — mode GROUPE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des lots avec total (mode GROUPE par défaut)", async () => {
    mockListLotGeniteurs.mockResolvedValue({ data: [FAKE_LOT], total: 1 });

    const response = await GET(makeRequest("/api/reproduction/geniteurs"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockListLotGeniteurs).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ sexe: undefined, statut: undefined })
    );
  });

  it("filtre par sexe valide (FEMELLE)", async () => {
    mockListLotGeniteurs.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/reproduction/geniteurs?sexe=FEMELLE"));

    expect(mockListLotGeniteurs).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ sexe: SexeReproducteur.FEMELLE })
    );
  });

  it("filtre par statut valide (ACTIF)", async () => {
    mockListLotGeniteurs.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/reproduction/geniteurs?statut=ACTIF"));

    expect(mockListLotGeniteurs).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ statut: StatutReproducteur.ACTIF })
    );
  });

  it("filtre par bacId", async () => {
    mockListLotGeniteurs.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/reproduction/geniteurs?bacId=bac-123"));

    expect(mockListLotGeniteurs).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ bacId: "bac-123" })
    );
  });

  it("ignore un sexe invalide", async () => {
    mockListLotGeniteurs.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/reproduction/geniteurs?sexe=HERMAPHRODITE"));

    expect(mockListLotGeniteurs).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ sexe: undefined })
    );
  });

  it("ignore un statut invalide", async () => {
    mockListLotGeniteurs.mockResolvedValue({ data: [], total: 0 });

    await GET(makeRequest("/api/reproduction/geniteurs?statut=INVALIDE"));

    expect(mockListLotGeniteurs).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ statut: undefined })
    );
  });

  it("retourne 400 pour un mode invalide", async () => {
    const response = await GET(
      makeRequest("/api/reproduction/geniteurs?mode=INVALIDE")
    );

    expect(response.status).toBe(400);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET(makeRequest("/api/reproduction/geniteurs"));
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET(makeRequest("/api/reproduction/geniteurs"));
    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockListLotGeniteurs.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/reproduction/geniteurs"));
    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/reproduction/geniteurs — mode INDIVIDUEL
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/geniteurs — mode INDIVIDUEL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des reproducteurs individuels", async () => {
    mockListReproducteurs.mockResolvedValue({
      data: [FAKE_REPRODUCTEUR],
      total: 1,
    });

    const response = await GET(
      makeRequest("/api/reproduction/geniteurs?mode=INDIVIDUEL")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockListReproducteurs).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ sexe: undefined, statut: undefined })
    );
  });

  it("filtre par sexe en mode INDIVIDUEL", async () => {
    mockListReproducteurs.mockResolvedValue({ data: [], total: 0 });

    await GET(
      makeRequest("/api/reproduction/geniteurs?mode=INDIVIDUEL&sexe=MALE")
    );

    expect(mockListReproducteurs).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ sexe: SexeReproducteur.MALE })
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/reproduction/geniteurs — mode GROUPE
// ---------------------------------------------------------------------------

describe("POST /api/reproduction/geniteurs — mode GROUPE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validGroupeBody = {
    mode: "GROUPE",
    nom: "Lot femelles printemps",
    sexe: SexeReproducteur.FEMELLE,
    nombrePoissons: 20,
    poidsMoyenG: 1200,
    origine: "Ecloserie Douala",
    dateAcquisition: "2026-03-01T00:00:00.000Z",
    notes: "Bonne reproduction",
  };

  it("crée un lot de géniteurs avec les champs obligatoires", async () => {
    const created = { ...FAKE_LOT, id: "lot-new" };
    mockCreateLotGeniteurs.mockResolvedValue(created);

    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify(validGroupeBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("lot-new");
    expect(mockCreateLotGeniteurs).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        nom: "Lot femelles printemps",
        sexe: SexeReproducteur.FEMELLE,
        nombrePoissons: 20,
      })
    );
  });

  it("retourne 400 si mode manquant", async () => {
    const { mode: _mode, ...bodyWithoutMode } = validGroupeBody;
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify(bodyWithoutMode),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si mode invalide", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validGroupeBody, mode: "INCONNU" }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si nom manquant (mode GROUPE)", async () => {
    const { nom: _nom, ...bodyWithoutNom } = validGroupeBody;
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify(bodyWithoutNom),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nom" })])
    );
  });

  it("retourne 400 si nom est vide (mode GROUPE)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validGroupeBody, nom: "   " }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si sexe manquant (mode GROUPE)", async () => {
    const { sexe: _sexe, ...bodyWithoutSexe } = validGroupeBody;
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify(bodyWithoutSexe),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sexe" })])
    );
  });

  it("retourne 400 si sexe invalide (mode GROUPE)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validGroupeBody, sexe: "NEUTRE" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sexe" })])
    );
  });

  it("retourne 400 si nombrePoissons manquant (mode GROUPE)", async () => {
    const { nombrePoissons: _n, ...bodyWithoutNb } = validGroupeBody;
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify(bodyWithoutNb),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nombrePoissons" }),
      ])
    );
  });

  it("retourne 400 si nombrePoissons <= 0 (mode GROUPE)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validGroupeBody, nombrePoissons: 0 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nombrePoissons" }),
      ])
    );
  });

  it("retourne 400 si poidsMoyenG <= 0 (mode GROUPE)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validGroupeBody, poidsMoyenG: -50 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poidsMoyenG" })])
    );
  });

  it("retourne 400 si dateAcquisition invalide (mode GROUPE)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validGroupeBody, dateAcquisition: "pas-une-date" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "dateAcquisition" }),
      ])
    );
  });

  it("retourne 400 si statut invalide (mode GROUPE)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validGroupeBody, statut: "INCONNU" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "statut" })])
    );
  });

  it("retourne 409 si code déjà utilisé", async () => {
    mockCreateLotGeniteurs.mockRejectedValue(
      new Error('Le code "LG-F-001" est déjà utilisé')
    );

    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify(validGroupeBody),
      })
    );

    expect(response.status).toBe(409);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify(validGroupeBody),
      })
    );

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/reproduction/geniteurs — mode INDIVIDUEL
// ---------------------------------------------------------------------------

describe("POST /api/reproduction/geniteurs — mode INDIVIDUEL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  const validIndividuelBody = {
    mode: "INDIVIDUEL",
    code: "REP-F-001",
    sexe: SexeReproducteur.FEMELLE,
    poids: 1200,
    age: 18,
    origine: "Ecloserie Douala",
    dateAcquisition: "2026-03-01T00:00:00.000Z",
    notes: "Bonne reproductrice",
  };

  it("crée un reproducteur individuel", async () => {
    const created = { ...FAKE_REPRODUCTEUR, id: "rep-new" };
    mockCreateReproducteur.mockResolvedValue(created);

    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify(validIndividuelBody),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("rep-new");
    expect(mockCreateReproducteur).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        code: "REP-F-001",
        sexe: SexeReproducteur.FEMELLE,
        poids: 1200,
      })
    );
  });

  it("retourne 400 si code manquant (mode INDIVIDUEL)", async () => {
    const { code: _code, ...bodyWithoutCode } = validIndividuelBody;
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
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

  it("retourne 400 si code vide (mode INDIVIDUEL)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validIndividuelBody, code: "  " }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si poids manquant (mode INDIVIDUEL)", async () => {
    const { poids: _poids, ...bodyWithoutPoids } = validIndividuelBody;
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify(bodyWithoutPoids),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poids" })])
    );
  });

  it("retourne 400 si poids <= 0 (mode INDIVIDUEL)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validIndividuelBody, poids: 0 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poids" })])
    );
  });

  it("retourne 400 si age négatif (mode INDIVIDUEL)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validIndividuelBody, age: -1 }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "age" })])
    );
  });

  it("retourne 400 si dateAcquisition invalide (mode INDIVIDUEL)", async () => {
    const response = await POST(
      makeRequest("/api/reproduction/geniteurs", {
        method: "POST",
        body: JSON.stringify({ ...validIndividuelBody, dateAcquisition: "pas-une-date" }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "dateAcquisition" }),
      ])
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/reproduction/geniteurs/[id]
// ---------------------------------------------------------------------------

describe("GET /api/reproduction/geniteurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne un lot de géniteurs par ID (mode GROUPE par défaut)", async () => {
    mockGetLotGeniteursById.mockResolvedValue(FAKE_LOT);

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/geniteurs/lot-1"),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("lot-1");
    expect(mockGetLotGeniteursById).toHaveBeenCalledWith("lot-1", "site-1");
  });

  it("retourne un reproducteur individuel si non trouvé comme lot (fallback)", async () => {
    mockGetLotGeniteursById.mockResolvedValue(null);
    mockGetReproducteurById.mockResolvedValue(FAKE_REPRODUCTEUR);

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/geniteurs/rep-1"),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("rep-1");
  });

  it("retourne 404 si ni lot ni reproducteur trouvé", async () => {
    mockGetLotGeniteursById.mockResolvedValue(null);
    mockGetReproducteurById.mockResolvedValue(null);

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/geniteurs/xxx"),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne un reproducteur individuel via mode=INDIVIDUEL", async () => {
    mockGetReproducteurById.mockResolvedValue(FAKE_REPRODUCTEUR);

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/geniteurs/rep-1?mode=INDIVIDUEL"),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("rep-1");
    // En mode INDIVIDUEL, on n'appelle PAS getLotGeniteursById
    expect(mockGetLotGeniteursById).not.toHaveBeenCalled();
  });

  it("retourne 404 si reproducteur individuel introuvable (mode INDIVIDUEL)", async () => {
    mockGetReproducteurById.mockResolvedValue(null);

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/geniteurs/xxx?mode=INDIVIDUEL"),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await GET_DETAIL(
      makeRequest("/api/reproduction/geniteurs/lot-1"),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/reproduction/geniteurs/[id] — mode GROUPE
// ---------------------------------------------------------------------------

describe("PATCH /api/reproduction/geniteurs/[id] — mode GROUPE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met à jour un lot de géniteurs (mode GROUPE)", async () => {
    const updated = { ...FAKE_LOT, nombrePoissons: 25, statut: StatutReproducteur.EN_REPOS };
    mockUpdateLotGeniteurs.mockResolvedValue(updated);

    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "GROUPE", nombrePoissons: 25, statut: StatutReproducteur.EN_REPOS }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nombrePoissons).toBe(25);
    expect(data.statut).toBe(StatutReproducteur.EN_REPOS);
    expect(mockUpdateLotGeniteurs).toHaveBeenCalledWith("lot-1", "site-1", expect.any(Object));
  });

  it("retourne 400 si nom vide (mode GROUPE)", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "GROUPE", nom: "" }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nom" })])
    );
  });

  it("retourne 400 si nombrePoissons <= 0 (mode GROUPE)", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "GROUPE", nombrePoissons: 0 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nombrePoissons" }),
      ])
    );
  });

  it("retourne 400 si statut invalide (mode GROUPE)", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "GROUPE", statut: "INCONNU" }),
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
    mockUpdateLotGeniteurs.mockRejectedValue(
      new Error("Lot de géniteurs introuvable")
    );

    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/xxx", {
        method: "PATCH",
        body: JSON.stringify({ mode: "GROUPE", nombrePoissons: 10 }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/lot-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "GROUPE", nombrePoissons: 10 }),
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/reproduction/geniteurs/[id] — mode INDIVIDUEL
// ---------------------------------------------------------------------------

describe("PATCH /api/reproduction/geniteurs/[id] — mode INDIVIDUEL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met à jour un reproducteur individuel", async () => {
    const updated = { ...FAKE_REPRODUCTEUR, poids: 1350, statut: StatutReproducteur.REFORME };
    mockUpdateReproducteur.mockResolvedValue(updated);

    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/rep-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "INDIVIDUEL", poids: 1350, statut: StatutReproducteur.REFORME }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.poids).toBe(1350);
    expect(data.statut).toBe(StatutReproducteur.REFORME);
    expect(mockUpdateReproducteur).toHaveBeenCalledWith("rep-1", "site-1", expect.any(Object));
  });

  it("retourne 400 si code vide (mode INDIVIDUEL)", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/rep-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "INDIVIDUEL", code: "" }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "code" })])
    );
  });

  it("retourne 400 si sexe invalide (mode INDIVIDUEL)", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/rep-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "INDIVIDUEL", sexe: "NEUTRE" }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "sexe" })])
    );
  });

  it("retourne 400 si poids <= 0 (mode INDIVIDUEL)", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/rep-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "INDIVIDUEL", poids: -100 }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "poids" })])
    );
  });

  it("retourne 400 si age négatif (mode INDIVIDUEL)", async () => {
    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/rep-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "INDIVIDUEL", age: -5 }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "age" })])
    );
  });

  it("retourne 404 si reproducteur introuvable", async () => {
    mockUpdateReproducteur.mockRejectedValue(new Error("Reproducteur introuvable"));

    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/xxx", {
        method: "PATCH",
        body: JSON.stringify({ mode: "INDIVIDUEL", poids: 1000 }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si code déjà utilisé (mode INDIVIDUEL)", async () => {
    mockUpdateReproducteur.mockRejectedValue(
      new Error('Le code "REP-F-002" est déjà utilisé')
    );

    const response = await PATCH(
      makeRequest("/api/reproduction/geniteurs/rep-1", {
        method: "PATCH",
        body: JSON.stringify({ mode: "INDIVIDUEL", code: "REP-F-002" }),
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );

    expect(response.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/reproduction/geniteurs/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/reproduction/geniteurs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("supprime un lot de géniteurs sans pontes actives (mode GROUPE)", async () => {
    mockDeleteLotGeniteurs.mockResolvedValue(undefined);

    const response = await DELETE(
      makeRequest("/api/reproduction/geniteurs/lot-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteLotGeniteurs).toHaveBeenCalledWith("lot-1", "site-1");
  });

  it("retourne 409 si des pontes actives sont liées au lot", async () => {
    mockDeleteLotGeniteurs.mockRejectedValue(
      new Error(
        "Impossible de supprimer : ce lot a 2 ponte(s) active(s) liée(s). Clôturez ou marquez les pontes comme terminées avant de supprimer le lot."
      )
    );

    const response = await DELETE(
      makeRequest("/api/reproduction/geniteurs/lot-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("supprime un reproducteur individuel (mode INDIVIDUEL)", async () => {
    mockDeleteReproducteur.mockResolvedValue(undefined);

    const response = await DELETE(
      makeRequest("/api/reproduction/geniteurs/rep-1?mode=INDIVIDUEL", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "rep-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteReproducteur).toHaveBeenCalledWith("rep-1", "site-1");
  });

  it("retourne 404 si lot introuvable (mode GROUPE, fallback en reproducteur aussi introuvable)", async () => {
    mockDeleteLotGeniteurs.mockRejectedValue(new Error("Lot de géniteurs introuvable"));
    mockDeleteReproducteur.mockRejectedValue(new Error("Reproducteur introuvable"));

    const response = await DELETE(
      makeRequest("/api/reproduction/geniteurs/xxx", { method: "DELETE" }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 400 si mode invalide", async () => {
    const response = await DELETE(
      makeRequest("/api/reproduction/geniteurs/lot-1?mode=INVALIDE", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await DELETE(
      makeRequest("/api/reproduction/geniteurs/lot-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await DELETE(
      makeRequest("/api/reproduction/geniteurs/lot-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "lot-1" }) }
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/reproduction/geniteurs/[id]/utiliser-male
// ---------------------------------------------------------------------------

describe("POST /api/reproduction/geniteurs/[id]/utiliser-male", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("décrémente le stock de mâles disponibles avec succès", async () => {
    mockUtiliserMale.mockResolvedValue(18); // 20 - 2 = 18

    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/lot-m-1/utiliser-male", {
        method: "POST",
        body: JSON.stringify({ nombreUtilises: 2 }),
      }),
      { params: Promise.resolve({ id: "lot-m-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nombreMalesDisponibles).toBe(18);
    expect(mockUtiliserMale).toHaveBeenCalledWith("lot-m-1", "site-1", 2);
  });

  it("retourne 400 si nombreUtilises manquant", async () => {
    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/lot-m-1/utiliser-male", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "lot-m-1" }) }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain("nombreUtilises");
  });

  it("retourne 400 si nombreUtilises = 0", async () => {
    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/lot-m-1/utiliser-male", {
        method: "POST",
        body: JSON.stringify({ nombreUtilises: 0 }),
      }),
      { params: Promise.resolve({ id: "lot-m-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si nombreUtilises négatif", async () => {
    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/lot-m-1/utiliser-male", {
        method: "POST",
        body: JSON.stringify({ nombreUtilises: -5 }),
      }),
      { params: Promise.resolve({ id: "lot-m-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si nombreUtilises est un flottant", async () => {
    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/lot-m-1/utiliser-male", {
        method: "POST",
        body: JSON.stringify({ nombreUtilises: 1.5 }),
      }),
      { params: Promise.resolve({ id: "lot-m-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 404 si lot introuvable", async () => {
    mockUtiliserMale.mockRejectedValue(new Error("Lot de géniteurs introuvable"));

    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/xxx/utiliser-male", {
        method: "POST",
        body: JSON.stringify({ nombreUtilises: 2 }),
      }),
      { params: Promise.resolve({ id: "xxx" }) }
    );

    expect(response.status).toBe(404);
  });

  it("retourne 409 si stock insuffisant", async () => {
    mockUtiliserMale.mockRejectedValue(
      new Error("Stock insuffisant : le lot ne dispose que de 1 mâle(s) disponible(s) (demandé : 5)")
    );

    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/lot-m-1/utiliser-male", {
        method: "POST",
        body: JSON.stringify({ nombreUtilises: 5 }),
      }),
      { params: Promise.resolve({ id: "lot-m-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("retourne 400 si le lot n'est pas un lot de mâles", async () => {
    mockUtiliserMale.mockRejectedValue(
      new Error("Ce lot n'est pas un lot de mâles : impossible d'utiliser des mâles")
    );

    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/lot-f-1/utiliser-male", {
        method: "POST",
        body: JSON.stringify({ nombreUtilises: 1 }),
      }),
      { params: Promise.resolve({ id: "lot-f-1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 400 si nombreMalesDisponibles non initialisé", async () => {
    mockUtiliserMale.mockRejectedValue(
      new Error("Le nombre de mâles disponibles n'est pas initialisé pour ce lot")
    );

    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/lot-m-2/utiliser-male", {
        method: "POST",
        body: JSON.stringify({ nombreUtilises: 1 }),
      }),
      { params: Promise.resolve({ id: "lot-m-2" }) }
    );

    expect(response.status).toBe(400);
  });

  it("retourne 401 si non authentifié", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/lot-m-1/utiliser-male", {
        method: "POST",
        body: JSON.stringify({ nombreUtilises: 2 }),
      }),
      { params: Promise.resolve({ id: "lot-m-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockUtiliserMale.mockRejectedValue(new Error("DB error inattendue"));

    const response = await POST_UTILISER_MALE(
      makeRequest("/api/reproduction/geniteurs/lot-m-1/utiliser-male", {
        method: "POST",
        body: JSON.stringify({ nombreUtilises: 2 }),
      }),
      { params: Promise.resolve({ id: "lot-m-1" }) }
    );

    expect(response.status).toBe(500);
  });
});
