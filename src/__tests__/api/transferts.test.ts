/**
 * Tests d'integration — Routes API Transferts (Story PG.6)
 *
 * Couvre :
 * 1.  POST /api/transferts — Mode CREATE_NEW succes
 * 2.  POST /api/transferts — Mode USE_EXISTING succes
 * 3.  POST /api/transferts — mode invalide → 400
 * 4.  POST /api/transferts — groupes vide → 400
 * 5.  POST /api/transferts — CREATE_NEW sans nouvelleVague.code → 400
 * 6.  POST /api/transferts — USE_EXISTING sans vagueDestId → 400
 * 7.  POST /api/transferts — pas auth → 401
 * 8.  POST /api/transferts — pas permission VAGUES_CREER → 403
 * 9.  POST /api/transferts — conservation violee (concurrence) → 409
 * 10. GET /api/transferts — liste avec pagination
 * 11. GET /api/transferts — vagueId sans direction → 400
 * 12. GET /api/transferts — pas auth → 401
 * 13. GET /api/transferts/[id] — found → 200
 * 14. GET /api/transferts/[id] — not found → 404
 * 15. GET /api/transferts/[id] — pas auth → 401
 * 16. PATCH /api/transferts/[id]/groupes/[groupeId] — update succes
 * 17. PATCH /api/transferts/[id]/groupes/[groupeId] — raison manquante → 400
 * 18. PATCH /api/transferts/[id]/groupes/[groupeId] — conservation violee → 409
 * 19. PATCH /api/transferts/[id]/groupes/[groupeId] — pas permission → 403
 * 20. GET /api/vagues/[id]/transferts — direction source → 200
 * 21. GET /api/vagues/[id]/transferts — direction destination → 200
 * 22. GET /api/vagues/[id]/transferts — direction manquante → 400
 * 23. GET /api/vagues/[id]/transferts — direction invalide → 400
 * 24. GET /api/vagues/[id]/lineage — lineage retourne → 200
 * 25. POST /api/vagues — PRE_GROSSISSEMENT vide (nombreInitial=0, sans configElevageId)
 * 26. POST /api/vagues — GROSSISSEMENT existant non regressé
 * 27. POST /api/vagues — type invalide → 400
 * 28. GET /api/vagues — filtre type=PRE_GROSSISSEMENT
 * 29. DELETE /api/vagues/[id] — suppression bloquee par transferts → 409
 * 30. DELETE /api/vagues/[id] — cas normal → 200
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission, ModeTransfert, TypeVague } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — queries transferts
// ---------------------------------------------------------------------------

const mockCreateTransfert = vi.fn();
const mockListTransfertsForSite = vi.fn();
const mockGetTransfertById = vi.fn();
const mockListTransfertsForVague = vi.fn();
const mockUpdateTransfertGroupe = vi.fn();
const mockGetLineage = vi.fn();

vi.mock("@/lib/queries/transferts", () => ({
  createTransfert: (...args: unknown[]) => mockCreateTransfert(...args),
  listTransfertsForSite: (...args: unknown[]) => mockListTransfertsForSite(...args),
  getTransfertById: (...args: unknown[]) => mockGetTransfertById(...args),
  listTransfertsForVague: (...args: unknown[]) => mockListTransfertsForVague(...args),
  updateTransfertGroupe: (...args: unknown[]) => mockUpdateTransfertGroupe(...args),
  getLineage: (...args: unknown[]) => mockGetLineage(...args),
  canDeleteVague: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Mocks — queries vagues
// ---------------------------------------------------------------------------

const mockGetVagues = vi.fn();
const mockGetVagueById = vi.fn();
const mockUpdateVague = vi.fn();
const mockDeleteVague = vi.fn();

vi.mock("@/lib/queries/vagues", () => ({
  getVagues: (...args: unknown[]) => mockGetVagues(...args),
  getVagueById: (...args: unknown[]) => mockGetVagueById(...args),
  updateVague: (...args: unknown[]) => mockUpdateVague(...args),
  deleteVague: (...args: unknown[]) => mockDeleteVague(...args),
}));

vi.mock("@/lib/queries/indicateurs", () => ({
  getIndicateursVague: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/queries/releves", () => ({
  getReleves: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  createReleve: vi.fn(),
  getReleveById: vi.fn(),
  updateReleve: vi.fn(),
  deleteReleve: vi.fn(),
  patchReleve: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — abonnements + quotas (necessaires pour POST /api/vagues)
// ---------------------------------------------------------------------------

vi.mock("@/lib/abonnements/check-quotas", () => ({
  isQuotaAtteint: (ressource: { actuel: number; limite: number | null }) => {
    if (ressource.limite === null) return false;
    return ressource.actuel >= ressource.limite;
  },
  normaliseLimite: (val: number) => {
    if (val >= 999) return null;
    return val;
  },
}));

const mockGetAbonnementActif = vi.fn();
vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementActifPourSite: (...args: unknown[]) => mockGetAbonnementActif(...args),
  getAbonnements: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — prisma (pour POST /api/vagues qui inline la transaction)
// ---------------------------------------------------------------------------

const mockPrismaVagueCount = vi.fn();
const mockPrismaVagueFindUnique = vi.fn();
const mockPrismaVagueCreate = vi.fn();
const mockPrismaBacFindMany = vi.fn();
const mockPrismaAssignationBacFindMany = vi.fn();
const mockPrismaTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vague: {
      count: (...args: unknown[]) => mockPrismaVagueCount(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockPrismaTransaction(fn),
  },
}));

// ---------------------------------------------------------------------------
// Mocks — permissions + auth
// ---------------------------------------------------------------------------

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

vi.mock("@/lib/api-error-keys", () => ({
  ErrorKeys: {
    NOT_FOUND_VAGUE: "NOT_FOUND_VAGUE",
    SERVER_GET_VAGUE: "SERVER_GET_VAGUE",
    SERVER_GET_VAGUES: "SERVER_GET_VAGUES",
    SERVER_CREATE_VAGUE: "SERVER_CREATE_VAGUE",
    SERVER_UPDATE_VAGUE: "SERVER_UPDATE_VAGUE",
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "GERANT",
  activeSiteId: "site-1",
  siteRole: "GERANT",
  isSuperAdmin: false,
  permissions: [
    Permission.VAGUES_VOIR,
    Permission.VAGUES_CREER,
    Permission.VAGUES_MODIFIER,
    Permission.VAGUES_SUPPRIMER,
  ],
};

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const now = new Date("2026-03-08T10:00:00Z");

// ---------------------------------------------------------------------------
// Donnees de test communes
// ---------------------------------------------------------------------------

const VALID_GROUPE = {
  vagueSourceId: "vague-src-1",
  bacDestId: "bac-dest-1",
  nombrePoissons: 200,
  poidsMoyenG: 150.5,
};

const VALID_TRANSFERT_RESULT = {
  id: "transfert-1",
  siteId: "site-1",
  date: now.toISOString(),
  notes: null,
  groupes: [
    {
      id: "groupe-1",
      transfertId: "transfert-1",
      vagueSourceId: "vague-src-1",
      nombrePoissons: 200,
      poidsMoyenG: 150.5,
      nombreMorts: 0,
    },
  ],
};

// ---------------------------------------------------------------------------
// Import des handlers (apres les mocks)
// ---------------------------------------------------------------------------

// Imports separes pour chaque route
import { GET as GET_TRANSFERTS, POST as POST_TRANSFERT } from "@/app/api/transferts/route";
import { GET as GET_TRANSFERT_BY_ID } from "@/app/api/transferts/[id]/route";
import { PATCH as PATCH_TRANSFERT_GROUPE } from "@/app/api/transferts/[id]/groupes/[groupeId]/route";
import { GET as GET_VAGUE_TRANSFERTS } from "@/app/api/vagues/[id]/transferts/route";
import { GET as GET_VAGUE_LINEAGE } from "@/app/api/vagues/[id]/lineage/route";
import { GET as GET_VAGUES, POST as POST_VAGUE } from "@/app/api/vagues/route";
import { DELETE as DELETE_VAGUE } from "@/app/api/vagues/[id]/route";

// ===========================================================================
// POST /api/transferts
// ===========================================================================

describe("POST /api/transferts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // Cas 1 — Mode CREATE_NEW succes
  it("Cas 1 — Mode CREATE_NEW : cree un transfert et retourne 201", async () => {
    mockCreateTransfert.mockResolvedValue(VALID_TRANSFERT_RESULT);

    const body = {
      mode: ModeTransfert.CREATE_NEW,
      nouvelleVague: {
        code: "VAGUE-DEST-001",
        dateDebut: "2026-03-10T00:00:00Z",
      },
      groupes: [VALID_GROUPE],
    };

    const req = makeRequest("/api/transferts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_TRANSFERT(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("transfert-1");
    expect(mockCreateTransfert).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ mode: ModeTransfert.CREATE_NEW })
    );
  });

  // Cas 2 — Mode USE_EXISTING succes
  it("Cas 2 — Mode USE_EXISTING : cree un transfert et retourne 201", async () => {
    mockCreateTransfert.mockResolvedValue(VALID_TRANSFERT_RESULT);

    const body = {
      mode: ModeTransfert.USE_EXISTING,
      vagueDestId: "vague-dest-1",
      groupes: [VALID_GROUPE],
    };

    const req = makeRequest("/api/transferts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_TRANSFERT(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("transfert-1");
    expect(mockCreateTransfert).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ mode: ModeTransfert.USE_EXISTING, vagueDestId: "vague-dest-1" })
    );
  });

  // Cas 3 — mode invalide → 400
  it("Cas 3 — mode invalide : retourne 400", async () => {
    const body = {
      mode: "INVALID_MODE",
      groupes: [VALID_GROUPE],
    };

    const req = makeRequest("/api/transferts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_TRANSFERT(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors).toBeDefined();
    expect(data.errors.some((e: { field: string }) => e.field === "mode")).toBe(true);
  });

  // Cas 4 — groupes vide → 400
  it("Cas 4 — groupes vide : retourne 400", async () => {
    const body = {
      mode: ModeTransfert.USE_EXISTING,
      vagueDestId: "vague-dest-1",
      groupes: [],
    };

    const req = makeRequest("/api/transferts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_TRANSFERT(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "groupes")).toBe(true);
  });

  // Cas 5 — Mode CREATE_NEW sans nouvelleVague.code → 400
  it("Cas 5 — CREATE_NEW sans nouvelleVague.code : retourne 400", async () => {
    const body = {
      mode: ModeTransfert.CREATE_NEW,
      nouvelleVague: {
        dateDebut: "2026-03-10T00:00:00Z",
        // code absent
      },
      groupes: [VALID_GROUPE],
    };

    const req = makeRequest("/api/transferts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_TRANSFERT(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "nouvelleVague.code")).toBe(true);
  });

  // Cas 6 — Mode USE_EXISTING sans vagueDestId → 400
  it("Cas 6 — USE_EXISTING sans vagueDestId : retourne 400", async () => {
    const body = {
      mode: ModeTransfert.USE_EXISTING,
      // vagueDestId absent
      groupes: [VALID_GROUPE],
    };

    const req = makeRequest("/api/transferts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_TRANSFERT(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "vagueDestId")).toBe(true);
  });

  // Cas 7 — pas auth → 401
  it("Cas 7 — pas authentifie : retourne 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const body = {
      mode: ModeTransfert.USE_EXISTING,
      vagueDestId: "vague-dest-1",
      groupes: [VALID_GROUPE],
    };

    const req = makeRequest("/api/transferts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_TRANSFERT(req);
    expect(res.status).toBe(401);
  });

  // Cas 8 — pas permission VAGUES_CREER → 403
  it("Cas 8 — permission VAGUES_CREER manquante : retourne 403", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const body = {
      mode: ModeTransfert.USE_EXISTING,
      vagueDestId: "vague-dest-1",
      groupes: [VALID_GROUPE],
    };

    const req = makeRequest("/api/transferts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_TRANSFERT(req);
    expect(res.status).toBe(403);
  });

  // Cas 9 — conservation violee (concurrence) → 409
  // FIX BUG-PG6-01 : "Conservation violee" est maintenant mappe a 409 (conflit metier),
  // independamment du sous-message. La regle 409 est desormais en premier dans le statusMap.
  it("Cas 9 — conservation violee (concurrence) : retourne 409", async () => {
    mockCreateTransfert.mockRejectedValue(
      new Error("Conservation violée (concurrence) — reessayez plus tard")
    );

    const body = {
      mode: ModeTransfert.CREATE_NEW,
      nouvelleVague: {
        code: "VAGUE-DEST-001",
        dateDebut: "2026-03-10T00:00:00Z",
      },
      groupes: [VALID_GROUPE],
    };

    const req = makeRequest("/api/transferts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_TRANSFERT(req);
    expect(res.status).toBe(409);
  });
});

// ===========================================================================
// GET /api/transferts
// ===========================================================================

describe("GET /api/transferts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // Cas 10 — liste avec pagination
  it("Cas 10 — retourne la liste avec pagination", async () => {
    mockListTransfertsForSite.mockResolvedValue({
      data: [VALID_TRANSFERT_RESULT],
      total: 1,
    });

    const req = makeRequest("/api/transferts?limit=10&offset=0");
    const res = await GET_TRANSFERTS(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockListTransfertsForSite).toHaveBeenCalledWith(
      "site-1",
      undefined,
      { limit: 10, offset: 0 }
    );
  });

  // Cas 11 — vagueId fourni sans direction → 400
  it("Cas 11 — vagueId sans direction : retourne 400", async () => {
    const req = makeRequest("/api/transferts?vagueId=vague-1");
    const res = await GET_TRANSFERTS(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toContain("direction");
  });

  // Cas 12 — pas auth → 401
  it("Cas 12 — pas authentifie : retourne 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const req = makeRequest("/api/transferts");
    const res = await GET_TRANSFERTS(req);
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// GET /api/transferts/[id]
// ===========================================================================

describe("GET /api/transferts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // Cas 13 — found → 200
  it("Cas 13 — transfert trouve : retourne 200", async () => {
    mockGetTransfertById.mockResolvedValue(VALID_TRANSFERT_RESULT);

    const req = makeRequest("/api/transferts/transfert-1");
    const res = await GET_TRANSFERT_BY_ID(req, { params: Promise.resolve({ id: "transfert-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("transfert-1");
    expect(mockGetTransfertById).toHaveBeenCalledWith("site-1", "transfert-1");
  });

  // Cas 14 — not found → 404
  it("Cas 14 — transfert introuvable : retourne 404", async () => {
    mockGetTransfertById.mockResolvedValue(null);

    const req = makeRequest("/api/transferts/inexistant");
    const res = await GET_TRANSFERT_BY_ID(req, { params: Promise.resolve({ id: "inexistant" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  // Cas 15 — pas auth → 401
  it("Cas 15 — pas authentifie : retourne 401", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const req = makeRequest("/api/transferts/transfert-1");
    const res = await GET_TRANSFERT_BY_ID(req, { params: Promise.resolve({ id: "transfert-1" }) });
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// PATCH /api/transferts/[id]/groupes/[groupeId]
// ===========================================================================

describe("PATCH /api/transferts/[id]/groupes/[groupeId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // Cas 16 — update succes avec raison
  it("Cas 16 — update succes avec raison valide : retourne 200", async () => {
    const updatedGroupe = {
      id: "groupe-1",
      transfertId: "transfert-1",
      nombrePoissons: 180,
      poidsMoyenG: 160.0,
      nombreMorts: 5,
      raison: "Correction apres recomptage",
    };
    mockUpdateTransfertGroupe.mockResolvedValue(updatedGroupe);

    const body = {
      raison: "Correction apres recomptage",
      nombrePoissons: 180,
      nombreMorts: 5,
    };

    const req = makeRequest("/api/transferts/transfert-1/groupes/groupe-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    const res = await PATCH_TRANSFERT_GROUPE(req, {
      params: Promise.resolve({ id: "transfert-1", groupeId: "groupe-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("groupe-1");
    expect(mockUpdateTransfertGroupe).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      "groupe-1",
      expect.objectContaining({ raison: "Correction apres recomptage" })
    );
  });

  // Cas 17 — raison manquante → 400
  it("Cas 17 — raison manquante : retourne 400", async () => {
    const body = {
      nombrePoissons: 180,
    };

    const req = makeRequest("/api/transferts/transfert-1/groupes/groupe-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    const res = await PATCH_TRANSFERT_GROUPE(req, {
      params: Promise.resolve({ id: "transfert-1", groupeId: "groupe-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "raison")).toBe(true);
  });

  // Cas 17b — raison trop courte → 400
  it("Cas 17b — raison trop courte (< 5 chars) : retourne 400", async () => {
    const body = { raison: "Err" };

    const req = makeRequest("/api/transferts/transfert-1/groupes/groupe-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    const res = await PATCH_TRANSFERT_GROUPE(req, {
      params: Promise.resolve({ id: "transfert-1", groupeId: "groupe-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "raison")).toBe(true);
  });

  // Cas 18 — conservation violee (concurrence) → 409
  // FIX BUG-PG6-01 : "Conservation violee" est maintenant mappe a 409 (conflit metier),
  // independamment du sous-message. Meme correction que POST /api/transferts.
  it("Cas 18 — conservation violee (concurrence) : retourne 409", async () => {
    mockUpdateTransfertGroupe.mockRejectedValue(
      new Error("Conservation violée (concurrence) — reessayez")
    );

    const body = { raison: "Correction apres recomptage" };

    const req = makeRequest("/api/transferts/transfert-1/groupes/groupe-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    const res = await PATCH_TRANSFERT_GROUPE(req, {
      params: Promise.resolve({ id: "transfert-1", groupeId: "groupe-1" }),
    });
    expect(res.status).toBe(409);
  });

  // Cas 19 — pas permission VAGUES_MODIFIER → 403
  it("Cas 19 — pas permission VAGUES_MODIFIER : retourne 403", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const body = { raison: "Correction apres recomptage" };

    const req = makeRequest("/api/transferts/transfert-1/groupes/groupe-1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });

    const res = await PATCH_TRANSFERT_GROUPE(req, {
      params: Promise.resolve({ id: "transfert-1", groupeId: "groupe-1" }),
    });
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// GET /api/vagues/[id]/transferts
// ===========================================================================

describe("GET /api/vagues/[id]/transferts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // Cas 20 — direction source → 200
  it("Cas 20 — direction source : retourne les groupes sources", async () => {
    const groupes = [{ id: "groupe-1", vagueSourceId: "vague-1" }];
    mockListTransfertsForVague.mockResolvedValue(groupes);

    const req = makeRequest("/api/vagues/vague-1/transferts?direction=source");
    const res = await GET_VAGUE_TRANSFERTS(req, { params: Promise.resolve({ id: "vague-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.groupes).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockListTransfertsForVague).toHaveBeenCalledWith("site-1", "vague-1", "source");
  });

  // Cas 21 — direction destination → 200
  it("Cas 21 — direction destination : retourne les groupes destination", async () => {
    const groupes = [{ id: "groupe-2", vagueDest: { id: "vague-dest-1" } }];
    mockListTransfertsForVague.mockResolvedValue(groupes);

    const req = makeRequest("/api/vagues/vague-dest-1/transferts?direction=destination");
    const res = await GET_VAGUE_TRANSFERTS(req, {
      params: Promise.resolve({ id: "vague-dest-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.groupes).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(mockListTransfertsForVague).toHaveBeenCalledWith("site-1", "vague-dest-1", "destination");
  });

  // Cas 22 — direction manquante → 400
  it("Cas 22 — direction manquante : retourne 400", async () => {
    const req = makeRequest("/api/vagues/vague-1/transferts");
    const res = await GET_VAGUE_TRANSFERTS(req, { params: Promise.resolve({ id: "vague-1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toContain("direction");
  });

  // Cas 23 — direction invalide → 400
  it("Cas 23 — direction invalide : retourne 400", async () => {
    const req = makeRequest("/api/vagues/vague-1/transferts?direction=both");
    const res = await GET_VAGUE_TRANSFERTS(req, { params: Promise.resolve({ id: "vague-1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toContain("direction");
  });
});

// ===========================================================================
// GET /api/vagues/[id]/lineage
// ===========================================================================

describe("GET /api/vagues/[id]/lineage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // Cas 24 — lineage retourne → 200
  it("Cas 24 — lineage : retourne l'arbre de lineage", async () => {
    const lineage = {
      vagueId: "vague-1",
      code: "VAGUE-001",
      parents: [],
      enfants: [{ vagueId: "vague-dest-1", code: "VAGUE-DEST-001", parents: [], enfants: [] }],
    };
    mockGetLineage.mockResolvedValue(lineage);

    const req = makeRequest("/api/vagues/vague-1/lineage");
    const res = await GET_VAGUE_LINEAGE(req, { params: Promise.resolve({ id: "vague-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.vagueId).toBe("vague-1");
    expect(mockGetLineage).toHaveBeenCalledWith("site-1", "vague-1");
  });
});

// ===========================================================================
// POST /api/vagues — extensions pour transferts
// ===========================================================================

describe("POST /api/vagues (extensions transferts)", () => {
  // Transaction mock commune
  const setupTransactionMock = (nombreInitial: number = 0) => {
    const createdVague = {
      id: "vague-new",
      code: "VAGUE-PRE-001",
      type: TypeVague.PRE_GROSSISSEMENT,
      dateDebut: new Date("2026-03-10"),
      dateFin: null,
      statut: "EN_COURS",
      nombreInitial,
      poidsMoyenInitial: 0,
      origineAlevins: null,
      createdAt: now,
      updatedAt: now,
      assignations: [],
    };

    mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        vague: {
          count: (...args: unknown[]) => mockPrismaVagueCount(...args),
          findUnique: (...args: unknown[]) => mockPrismaVagueFindUnique(...args),
          create: (...args: unknown[]) => mockPrismaVagueCreate(...args),
        },
        bac: {
          findMany: (...args: unknown[]) => mockPrismaBacFindMany(...args),
        },
        assignationBac: {
          findMany: (...args: unknown[]) => mockPrismaAssignationBacFindMany(...args),
          create: vi.fn().mockResolvedValue({}),
        },
      };
      return fn(txMock);
    });

    mockPrismaVagueCount.mockResolvedValue(0);
    mockPrismaVagueFindUnique.mockImplementation(
      ({ where }: { where: { code?: string; id?: string } }) => {
        if (where.id) return Promise.resolve(createdVague);
        return Promise.resolve(null); // code unique check
      }
    );
    mockPrismaVagueCreate.mockResolvedValue(createdVague);
    mockPrismaBacFindMany.mockResolvedValue([]);
    mockPrismaAssignationBacFindMany.mockResolvedValue([]);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetAbonnementActif.mockResolvedValue(null);
  });

  // Cas 25 — PRE_GROSSISSEMENT vide (nombreInitial=0, sans configElevageId, sans bacs) → 201
  it("Cas 25 — PRE_GROSSISSEMENT vide (nombreInitial=0, sans configElevageId) : retourne 201", async () => {
    setupTransactionMock(0);

    const body = {
      type: TypeVague.PRE_GROSSISSEMENT,
      code: "VAGUE-PRE-001",
      dateDebut: "2026-03-10T00:00:00Z",
      nombreInitial: 0,
      poidsMoyenInitial: 0,
      // pas de configElevageId, pas de bacDistribution
    };

    const req = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_VAGUE(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.code).toBe("VAGUE-PRE-001");
    expect(data.nombreBacs).toBe(0);
  });

  // Cas 26 — GROSSISSEMENT existant non regressé : vague vide (nombreInitial=0, bacDistribution=[]) → 201
  it("Cas 26 — GROSSISSEMENT vide (vague en attente de transfert) : retourne 201", async () => {
    const createdVague = {
      id: "vague-new",
      code: "VAGUE-GROSS-VIDE",
      type: TypeVague.GROSSISSEMENT,
      dateDebut: new Date("2026-03-10"),
      dateFin: null,
      statut: "EN_COURS",
      nombreInitial: 0,
      poidsMoyenInitial: 0,
      origineAlevins: null,
      createdAt: now,
      updatedAt: now,
      assignations: [],
    };

    mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        vague: {
          count: () => mockPrismaVagueCount(),
          findUnique: (...args: unknown[]) => mockPrismaVagueFindUnique(...args),
          create: (...args: unknown[]) => mockPrismaVagueCreate(...args),
        },
        bac: {
          findMany: () => mockPrismaBacFindMany(),
        },
        assignationBac: {
          findMany: () => mockPrismaAssignationBacFindMany(),
          create: vi.fn().mockResolvedValue({}),
        },
      };
      return fn(txMock);
    });

    mockPrismaVagueCount.mockResolvedValue(0);
    mockPrismaVagueFindUnique.mockImplementation(
      ({ where }: { where: { code?: string; id?: string } }) => {
        if (where.id) return Promise.resolve(createdVague);
        return Promise.resolve(null);
      }
    );
    mockPrismaVagueCreate.mockResolvedValue(createdVague);
    mockPrismaBacFindMany.mockResolvedValue([]);
    mockPrismaAssignationBacFindMany.mockResolvedValue([]);

    const body = {
      type: TypeVague.GROSSISSEMENT,
      code: "VAGUE-GROSS-VIDE",
      dateDebut: "2026-03-10T00:00:00Z",
      nombreInitial: 0,
      poidsMoyenInitial: 0,
      // pas de bacDistribution, pas de configElevageId (cas vague vide)
    };

    const req = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_VAGUE(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.code).toBe("VAGUE-GROSS-VIDE");
  });

  // Cas 27 — type invalide → 400
  it("Cas 27 — type invalide : retourne 400", async () => {
    const body = {
      type: "INVALIDE",
      code: "VAGUE-001",
      dateDebut: "2026-03-10T00:00:00Z",
      nombreInitial: 500,
      poidsMoyenInitial: 10,
    };

    const req = makeRequest("/api/vagues", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const res = await POST_VAGUE(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.errors.some((e: { field: string }) => e.field === "type")).toBe(true);
  });
});

// ===========================================================================
// GET /api/vagues — filtre par type
// ===========================================================================

describe("GET /api/vagues (filtre type)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // Cas 28 — filtre type=PRE_GROSSISSEMENT
  it("Cas 28 — filtre type=PRE_GROSSISSEMENT : passe le filtre a getVagues", async () => {
    mockGetVagues.mockResolvedValue({
      data: [
        {
          id: "vague-pre-1",
          code: "VAGUE-PRE-001",
          dateDebut: new Date("2026-02-01"),
          dateFin: null,
          statut: "EN_COURS",
          nombreInitial: 0,
          poidsMoyenInitial: 0,
          origineAlevins: null,
          createdAt: now,
          updatedAt: now,
          _count: { assignations: 0 },
        },
      ],
      total: 1,
    });

    const req = makeRequest("/api/vagues?type=PRE_GROSSISSEMENT");
    const res = await GET_VAGUES(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(1);
    expect(mockGetVagues).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ type: "PRE_GROSSISSEMENT" }),
      expect.any(Object)
    );
  });
});

// ===========================================================================
// DELETE /api/vagues/[id] — fix 409 si transferts
// ===========================================================================

describe("DELETE /api/vagues/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  // Cas 29 — suppression bloquee par transferts → 409
  it("Cas 29 — suppression bloquee par transferts : retourne 409", async () => {
    mockDeleteVague.mockRejectedValue(
      new Error("suppression bloquée : des transferts existent pour cette vague")
    );

    const req = makeRequest("/api/vagues/vague-1", { method: "DELETE" });
    const res = await DELETE_VAGUE(req, { params: Promise.resolve({ id: "vague-1" }) });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.message).toBeDefined();
  });

  // Cas 30 — cas normal → 200
  it("Cas 30 — suppression reussie : retourne 200", async () => {
    mockDeleteVague.mockResolvedValue(undefined);

    const req = makeRequest("/api/vagues/vague-1", { method: "DELETE" });
    const res = await DELETE_VAGUE(req, { params: Promise.resolve({ id: "vague-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteVague).toHaveBeenCalledWith("vague-1", "site-1");
  });
});
