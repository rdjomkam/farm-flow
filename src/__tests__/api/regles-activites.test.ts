import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_list, POST } from "@/app/api/regles-activites/route";
import {
  GET as GET_detail,
  PUT,
  DELETE,
} from "@/app/api/regles-activites/[id]/route";
import { PATCH } from "@/app/api/regles-activites/[id]/toggle/route";
import { POST as POST_reset } from "@/app/api/regles-activites/[id]/reset/route";
import { NextRequest } from "next/server";
import { Permission, TypeDeclencheur, TypeActivite } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetReglesActivites = vi.fn();
const mockCreateRegleActivite = vi.fn();
const mockGetRegleActiviteById = vi.fn();
const mockUpdateRegleActivite = vi.fn();
const mockDeleteRegleActivite = vi.fn();
const mockToggleRegleActivite = vi.fn();
const mockResetFiredOnce = vi.fn();

vi.mock("@/lib/queries/regles-activites", () => ({
  getReglesActivites: (...args: unknown[]) => mockGetReglesActivites(...args),
  createRegleActivite: (...args: unknown[]) => mockCreateRegleActivite(...args),
  getRegleActiviteById: (...args: unknown[]) => mockGetRegleActiviteById(...args),
  updateRegleActivite: (...args: unknown[]) => mockUpdateRegleActivite(...args),
  deleteRegleActivite: (...args: unknown[]) => mockDeleteRegleActivite(...args),
  toggleRegleActivite: (...args: unknown[]) => mockToggleRegleActivite(...args),
  resetFiredOnce: (...args: unknown[]) => mockResetFiredOnce(...args),
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
  email: "admin@dkfarm.cm",
  phone: null,
  name: "Admin DKFarm",
  globalRole: "ADMIN",
  activeSiteId: "site-1",
  siteRoleId: "role-1",
  siteRoleName: "Administrateur",
  permissions: [Permission.REGLES_ACTIVITES_VOIR, Permission.GERER_REGLES_ACTIVITES],
};

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ---------------------------------------------------------------------------
// Fake data
// ---------------------------------------------------------------------------

const FAKE_REGLE_SITE = {
  id: "regle-1",
  nom: "Alimentation hebdomadaire",
  description: null,
  typeActivite: TypeActivite.ALIMENTATION,
  typeDeclencheur: TypeDeclencheur.RECURRENT,
  intervalleJours: 7,
  conditionValeur: null,
  conditionValeur2: null,
  phaseMin: null,
  phaseMax: null,
  titreTemplate: "Distribuer {quantite_calculee}kg en {bac}",
  descriptionTemplate: null,
  instructionsTemplate: null,
  priorite: 5,
  isActive: true,
  firedOnce: false,
  siteId: "site-1",
  userId: "user-1",
  site: { id: "site-1", name: "Ferme DKFarm" },
  user: { id: "user-1", name: "Admin DKFarm" },
  _count: { activites: 0 },
};

const FAKE_REGLE_GLOBAL = {
  ...FAKE_REGLE_SITE,
  id: "regle-global-1",
  nom: "Regle globale DKFarm",
  siteId: null,
  site: null,
};

const FAKE_REGLE_SEUIL = {
  ...FAKE_REGLE_SITE,
  id: "regle-seuil-1",
  nom: "Seuil poids 200g",
  typeDeclencheur: TypeDeclencheur.SEUIL_POIDS,
  conditionValeur: 200,
  intervalleJours: null,
  firedOnce: true,
};

// ---------------------------------------------------------------------------
// GET /api/regles-activites
// ---------------------------------------------------------------------------
describe("GET /api/regles-activites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne la liste des regles (200)", async () => {
    const fakeRegles = [FAKE_REGLE_SITE, FAKE_REGLE_GLOBAL];
    mockGetReglesActivites.mockResolvedValue(fakeRegles);

    const response = await GET_list(makeRequest("/api/regles-activites"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.regles).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.regles[0].nom).toBe("Alimentation hebdomadaire");
  });

  it("filtre par isActive=true", async () => {
    mockGetReglesActivites.mockResolvedValue([FAKE_REGLE_SITE]);

    const response = await GET_list(
      makeRequest("/api/regles-activites?isActive=true")
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetReglesActivites).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ isActive: true, includeGlobal: true })
    );
    expect(data.regles).toHaveLength(1);
  });

  it("filtre par isActive=false", async () => {
    mockGetReglesActivites.mockResolvedValue([]);

    await GET_list(makeRequest("/api/regles-activites?isActive=false"));

    expect(mockGetReglesActivites).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ isActive: false })
    );
  });

  it("filtre par typeDeclencheur valide", async () => {
    mockGetReglesActivites.mockResolvedValue([FAKE_REGLE_SITE]);

    await GET_list(
      makeRequest(`/api/regles-activites?typeDeclencheur=${TypeDeclencheur.RECURRENT}`)
    );

    expect(mockGetReglesActivites).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ typeDeclencheur: TypeDeclencheur.RECURRENT })
    );
  });

  it("ignore un typeDeclencheur invalide", async () => {
    mockGetReglesActivites.mockResolvedValue([]);

    await GET_list(makeRequest("/api/regles-activites?typeDeclencheur=INVALID"));

    // typeDeclencheur invalide ne doit pas etre transmis aux filtres
    const callArgs = mockGetReglesActivites.mock.calls[0][1];
    expect(callArgs.typeDeclencheur).toBeUndefined();
  });

  it("scope=global transmet siteId=null", async () => {
    mockGetReglesActivites.mockResolvedValue([FAKE_REGLE_GLOBAL]);

    await GET_list(makeRequest("/api/regles-activites?scope=global"));

    expect(mockGetReglesActivites).toHaveBeenCalledWith(null, expect.any(Object));
  });

  it("scope=site transmet siteId et includeGlobal=false", async () => {
    mockGetReglesActivites.mockResolvedValue([FAKE_REGLE_SITE]);

    await GET_list(makeRequest("/api/regles-activites?scope=site"));

    expect(mockGetReglesActivites).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ includeGlobal: false })
    );
  });

  it("retourne 403 si ForbiddenError (sans REGLES_ACTIVITES_VOIR)", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));

    const response = await GET_list(makeRequest("/api/regles-activites"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toContain("Permission");
  });

  it("verifie la permission REGLES_ACTIVITES_VOIR", async () => {
    mockGetReglesActivites.mockResolvedValue([]);

    await GET_list(makeRequest("/api/regles-activites"));

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.REGLES_ACTIVITES_VOIR
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetReglesActivites.mockRejectedValue(new Error("DB error"));

    const response = await GET_list(makeRequest("/api/regles-activites"));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// POST /api/regles-activites
// ---------------------------------------------------------------------------
describe("POST /api/regles-activites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("cree une regle site-specifique (201)", async () => {
    mockCreateRegleActivite.mockResolvedValue({ ...FAKE_REGLE_SITE, id: "regle-new" });

    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Alimentation hebdomadaire",
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          intervalleJours: 7,
          titreTemplate: "Distribuer {quantite_calculee}kg en {bac}",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.regle).toBeDefined();
    // siteId vient toujours de la session — jamais du body
    expect(mockCreateRegleActivite).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({
        nom: "Alimentation hebdomadaire",
        typeDeclencheur: TypeDeclencheur.RECURRENT,
        intervalleJours: 7,
      })
    );
  });

  it("refuse si nom manquant (400)", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          intervalleJours: 7,
          titreTemplate: "Titre valide ici",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nom" })])
    );
  });

  it("refuse si nom trop court (400)", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "AB",
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          intervalleJours: 7,
          titreTemplate: "Titre valide ici",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "nom" })])
    );
  });

  it("refuse si typeActivite invalide (400)", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Regle valide",
          typeActivite: "INCONNU",
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          intervalleJours: 7,
          titreTemplate: "Titre valide ici",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "typeActivite" })])
    );
  });

  it("refuse si typeDeclencheur invalide (400)", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Regle valide",
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: "INCONNU",
          titreTemplate: "Titre valide ici",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "typeDeclencheur" })])
    );
  });

  it("refuse si titreTemplate manquant (400)", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Regle valide",
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          intervalleJours: 7,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "titreTemplate" })])
    );
  });

  it("exige intervalleJours pour RECURRENT (400)", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Regle recurrente",
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          titreTemplate: "Titre valide ici",
          // intervalleJours manquant
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "intervalleJours" })])
    );
  });

  it("exige conditionValeur pour SEUIL_POIDS (400)", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Seuil poids 200g",
          typeActivite: TypeActivite.BIOMETRIE,
          typeDeclencheur: TypeDeclencheur.SEUIL_POIDS,
          titreTemplate: "Biometrie au seuil {seuil}g",
          // conditionValeur manquant
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "conditionValeur" })])
    );
  });

  it("refuse conditionValeur2 <= conditionValeur (400)", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Seuil qualite eau",
          typeActivite: TypeActivite.QUALITE_EAU,
          typeDeclencheur: TypeDeclencheur.SEUIL_QUALITE,
          conditionValeur: 8.0,
          conditionValeur2: 6.0, // inferieur a conditionValeur
          titreTemplate: "Qualite eau hors seuil",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "conditionValeur2" })])
    );
  });

  it("refuse une priorite hors de [1, 10] (400)", async () => {
    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Regle priorite invalide",
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          intervalleJours: 7,
          titreTemplate: "Titre valide ici",
          priorite: 15,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "priorite" })])
    );
  });

  it("siteId provient toujours de la session (pas du body)", async () => {
    mockCreateRegleActivite.mockResolvedValue({ ...FAKE_REGLE_SITE });

    await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Tentative injection siteId",
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          intervalleJours: 7,
          titreTemplate: "Titre valide ici",
          siteId: null, // tenter d'injecter siteId=null
        }),
      })
    );

    // siteId doit toujours etre celui de la session (site-1), jamais null
    expect(mockCreateRegleActivite).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.any(Object)
    );
  });

  it("retourne 403 si ForbiddenError", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Permission insuffisante."));

    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Regle test",
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          intervalleJours: 7,
          titreTemplate: "Titre valide ici",
        }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockCreateRegleActivite.mockRejectedValue(new Error("DB error"));

    const response = await POST(
      makeRequest("/api/regles-activites", {
        method: "POST",
        body: JSON.stringify({
          nom: "Regle valide",
          typeActivite: TypeActivite.ALIMENTATION,
          typeDeclencheur: TypeDeclencheur.RECURRENT,
          intervalleJours: 7,
          titreTemplate: "Titre valide ici",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toContain("Erreur serveur");
  });
});

// ---------------------------------------------------------------------------
// GET /api/regles-activites/[id]
// ---------------------------------------------------------------------------
describe("GET /api/regles-activites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne le detail de la regle avec _count.activites (200)", async () => {
    const fakeDetail = {
      ...FAKE_REGLE_SITE,
      _count: { activites: 3 },
      activites: [
        { id: "act-1", titre: "Alimentation", statut: "EN_ATTENTE", dateDebut: new Date() },
      ],
    };
    mockGetRegleActiviteById.mockResolvedValue(fakeDetail);

    const response = await GET_detail(
      makeRequest("/api/regles-activites/regle-1"),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.regle.nom).toBe("Alimentation hebdomadaire");
    expect(data.regle._count.activites).toBe(3);
    expect(mockGetRegleActiviteById).toHaveBeenCalledWith("regle-1", "site-1");
  });

  it("retourne 404 si id inconnu", async () => {
    mockGetRegleActiviteById.mockResolvedValue(null);

    const response = await GET_detail(
      makeRequest("/api/regles-activites/unknown"),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetRegleActiviteById.mockRejectedValue(new Error("DB error"));

    const response = await GET_detail(
      makeRequest("/api/regles-activites/regle-1"),
      { params: Promise.resolve({ id: "regle-1" }) }
    );

    expect(response.status).toBe(500);
  });

  it("verifie la permission REGLES_ACTIVITES_VOIR", async () => {
    mockGetRegleActiviteById.mockResolvedValue(FAKE_REGLE_SITE);

    await GET_detail(
      makeRequest("/api/regles-activites/regle-1"),
      { params: Promise.resolve({ id: "regle-1" }) }
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.REGLES_ACTIVITES_VOIR
    );
  });
});

// ---------------------------------------------------------------------------
// PUT /api/regles-activites/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/regles-activites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("met a jour les templates (200)", async () => {
    const updated = {
      ...FAKE_REGLE_SITE,
      titreTemplate: "Nouveau titre {quantite_calculee}kg",
    };
    mockUpdateRegleActivite.mockResolvedValue(updated);

    const response = await PUT(
      makeRequest("/api/regles-activites/regle-1", {
        method: "PUT",
        body: JSON.stringify({
          titreTemplate: "Nouveau titre {quantite_calculee}kg",
        }),
      }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.regle.titreTemplate).toBe("Nouveau titre {quantite_calculee}kg");
    expect(mockUpdateRegleActivite).toHaveBeenCalledWith(
      "regle-1",
      "site-1",
      expect.objectContaining({ titreTemplate: "Nouveau titre {quantite_calculee}kg" }),
      { allowGlobal: false }
    );
  });

  it("met a jour isActive (200)", async () => {
    mockUpdateRegleActivite.mockResolvedValue({ ...FAKE_REGLE_SITE, isActive: false });

    const response = await PUT(
      makeRequest("/api/regles-activites/regle-1", {
        method: "PUT",
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateRegleActivite).toHaveBeenCalledWith(
      "regle-1",
      "site-1",
      expect.objectContaining({ isActive: false }),
      { allowGlobal: false }
    );
  });

  it("refuse une priorite invalide (400)", async () => {
    const response = await PUT(
      makeRequest("/api/regles-activites/regle-1", {
        method: "PUT",
        body: JSON.stringify({ priorite: 0 }),
      }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "priorite" })])
    );
  });

  it("refuse conditionValeur2 <= conditionValeur (400)", async () => {
    const response = await PUT(
      makeRequest("/api/regles-activites/regle-1", {
        method: "PUT",
        body: JSON.stringify({ conditionValeur: 10, conditionValeur2: 5 }),
      }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "conditionValeur2" })])
    );
  });

  it("retourne 404 si regle introuvable", async () => {
    mockUpdateRegleActivite.mockResolvedValue(null);

    const response = await PUT(
      makeRequest("/api/regles-activites/unknown", {
        method: "PUT",
        body: JSON.stringify({ nom: "Test" }),
      }),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("retourne 403 si tentative de modification d'une regle globale", async () => {
    mockUpdateRegleActivite.mockRejectedValue(
      new Error("Les regles globales DKFarm ne peuvent pas etre modifiees.")
    );

    const response = await PUT(
      makeRequest("/api/regles-activites/regle-global-1", {
        method: "PUT",
        body: JSON.stringify({ nom: "Nouveau nom" }),
      }),
      { params: Promise.resolve({ id: "regle-global-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockUpdateRegleActivite.mockRejectedValue(new Error("DB error"));

    const response = await PUT(
      makeRequest("/api/regles-activites/regle-1", {
        method: "PUT",
        body: JSON.stringify({ nom: "Nom valide" }),
      }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/regles-activites/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/regles-activites/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne 409 si la regle est globale (siteId = null)", async () => {
    mockDeleteRegleActivite.mockResolvedValue({ error: "global" });

    const response = await DELETE(
      makeRequest("/api/regles-activites/regle-global-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "regle-global-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("globales DKFarm");
  });

  it("retourne 409 si des activites sont liees (count > 0)", async () => {
    mockDeleteRegleActivite.mockResolvedValue({ error: "linked" });

    const response = await DELETE(
      makeRequest("/api/regles-activites/regle-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain("activites");
  });

  it("retourne 200 si la regle est site-specifique sans activites", async () => {
    mockDeleteRegleActivite.mockResolvedValue({ success: true });

    const response = await DELETE(
      makeRequest("/api/regles-activites/regle-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.id).toBe("regle-1");
    expect(mockDeleteRegleActivite).toHaveBeenCalledWith("regle-1", "site-1");
  });

  it("retourne 404 si regle introuvable", async () => {
    mockDeleteRegleActivite.mockRejectedValue(new Error("Regle introuvable."));

    const response = await DELETE(
      makeRequest("/api/regles-activites/unknown", { method: "DELETE" }),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("verifie la permission GERER_REGLES_ACTIVITES", async () => {
    mockDeleteRegleActivite.mockResolvedValue({ success: true });

    await DELETE(
      makeRequest("/api/regles-activites/regle-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.GERER_REGLES_ACTIVITES
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockDeleteRegleActivite.mockRejectedValue(new Error("DB error"));

    const response = await DELETE(
      makeRequest("/api/regles-activites/regle-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/regles-activites/[id]/toggle
// ---------------------------------------------------------------------------
describe("PATCH /api/regles-activites/[id]/toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("bascule isActive de true a false (200)", async () => {
    mockToggleRegleActivite.mockResolvedValue({ id: "regle-1", isActive: false });

    const response = await PATCH(
      makeRequest("/api/regles-activites/regle-1/toggle", { method: "PATCH" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("regle-1");
    expect(data.isActive).toBe(false);
    expect(mockToggleRegleActivite).toHaveBeenCalledWith("regle-1", { allowGlobal: false });
  });

  it("bascule isActive de false a true (200)", async () => {
    mockToggleRegleActivite.mockResolvedValue({ id: "regle-1", isActive: true });

    const response = await PATCH(
      makeRequest("/api/regles-activites/regle-1/toggle", { method: "PATCH" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.isActive).toBe(true);
  });

  it("retourne { id, isActive } uniquement", async () => {
    mockToggleRegleActivite.mockResolvedValue({ id: "regle-1", isActive: false });

    const response = await PATCH(
      makeRequest("/api/regles-activites/regle-1/toggle", { method: "PATCH" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(Object.keys(data)).toEqual(["id", "isActive"]);
  });

  it("retourne 404 si regle introuvable", async () => {
    mockToggleRegleActivite.mockRejectedValue(new Error("Regle introuvable."));

    const response = await PATCH(
      makeRequest("/api/regles-activites/unknown/toggle", { method: "PATCH" }),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("verifie la permission GERER_REGLES_ACTIVITES", async () => {
    mockToggleRegleActivite.mockResolvedValue({ id: "regle-1", isActive: true });

    await PATCH(
      makeRequest("/api/regles-activites/regle-1/toggle", { method: "PATCH" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.GERER_REGLES_ACTIVITES
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockToggleRegleActivite.mockRejectedValue(new Error("DB error"));

    const response = await PATCH(
      makeRequest("/api/regles-activites/regle-1/toggle", { method: "PATCH" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );

    expect(response.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/regles-activites/[id]/reset
// ---------------------------------------------------------------------------
describe("POST /api/regles-activites/[id]/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("remet firedOnce=false pour une regle SEUIL_POIDS (200)", async () => {
    mockGetRegleActiviteById.mockResolvedValue(FAKE_REGLE_SEUIL);
    mockResetFiredOnce.mockResolvedValue({ id: "regle-seuil-1", firedOnce: false });

    const response = await POST_reset(
      makeRequest("/api/regles-activites/regle-seuil-1/reset", { method: "POST" }),
      { params: Promise.resolve({ id: "regle-seuil-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("regle-seuil-1");
    expect(data.firedOnce).toBe(false);
    expect(mockResetFiredOnce).toHaveBeenCalledWith("regle-seuil-1");
  });

  it("remet firedOnce=false pour une regle FCR_ELEVE (200)", async () => {
    const fakeRegleFCR = {
      ...FAKE_REGLE_SEUIL,
      id: "regle-fcr-1",
      typeDeclencheur: TypeDeclencheur.FCR_ELEVE,
    };
    mockGetRegleActiviteById.mockResolvedValue(fakeRegleFCR);
    mockResetFiredOnce.mockResolvedValue({ id: "regle-fcr-1", firedOnce: false });

    const response = await POST_reset(
      makeRequest("/api/regles-activites/regle-fcr-1/reset", { method: "POST" }),
      { params: Promise.resolve({ id: "regle-fcr-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.firedOnce).toBe(false);
  });

  it("remet firedOnce=false pour une regle STOCK_BAS (200)", async () => {
    const fakeRegleStock = {
      ...FAKE_REGLE_SEUIL,
      id: "regle-stock-1",
      typeDeclencheur: TypeDeclencheur.STOCK_BAS,
    };
    mockGetRegleActiviteById.mockResolvedValue(fakeRegleStock);
    mockResetFiredOnce.mockResolvedValue({ id: "regle-stock-1", firedOnce: false });

    const response = await POST_reset(
      makeRequest("/api/regles-activites/regle-stock-1/reset", { method: "POST" }),
      { params: Promise.resolve({ id: "regle-stock-1" }) }
    );

    expect(response.status).toBe(200);
  });

  it("retourne 400 si typeDeclencheur=RECURRENT (pas one-shot)", async () => {
    mockGetRegleActiviteById.mockResolvedValue(FAKE_REGLE_SITE); // RECURRENT

    const response = await POST_reset(
      makeRequest("/api/regles-activites/regle-1/reset", { method: "POST" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("SEUIL");
    expect(mockResetFiredOnce).not.toHaveBeenCalled();
  });

  it("retourne 400 si typeDeclencheur=CALENDRIER (pas one-shot)", async () => {
    const fakeRegleCalendrier = {
      ...FAKE_REGLE_SITE,
      typeDeclencheur: TypeDeclencheur.CALENDRIER,
    };
    mockGetRegleActiviteById.mockResolvedValue(fakeRegleCalendrier);

    const response = await POST_reset(
      makeRequest("/api/regles-activites/regle-1/reset", { method: "POST" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("SEUIL");
  });

  it("retourne 404 si regle introuvable", async () => {
    mockGetRegleActiviteById.mockResolvedValue(null);

    const response = await POST_reset(
      makeRequest("/api/regles-activites/unknown/reset", { method: "POST" }),
      { params: Promise.resolve({ id: "unknown" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toContain("introuvable");
  });

  it("verifie la permission GERER_REGLES_ACTIVITES", async () => {
    mockGetRegleActiviteById.mockResolvedValue(FAKE_REGLE_SEUIL);
    mockResetFiredOnce.mockResolvedValue({ id: "regle-seuil-1", firedOnce: false });

    await POST_reset(
      makeRequest("/api/regles-activites/regle-seuil-1/reset", { method: "POST" }),
      { params: Promise.resolve({ id: "regle-seuil-1" }) }
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.GERER_REGLES_ACTIVITES
    );
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetRegleActiviteById.mockRejectedValue(new Error("DB error"));

    const response = await POST_reset(
      makeRequest("/api/regles-activites/regle-1/reset", { method: "POST" }),
      { params: Promise.resolve({ id: "regle-1" }) }
    );

    expect(response.status).toBe(500);
  });
});
