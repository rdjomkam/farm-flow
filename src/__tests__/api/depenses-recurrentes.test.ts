/**
 * Tests Sprint 18 — Dépenses Récurrentes
 *
 * Couvre :
 * - genererDepensesRecurrentes : MENSUEL/TRIMESTRIEL/ANNUEL due/not due, idempotent
 * - getResumeFinancier mis à jour : anti double-comptage (avec/sans commandeId)
 * - API routes : GET/POST/PUT/DELETE depenses-recurrentes, POST generer
 * - Permissions : 403 sans permission
 * - Non-régression finances existantes
 */

import { NextRequest } from "next/server";
import { FrequenceRecurrence, Permission, CategorieDepense } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDepenseRecurrenteFindMany = vi.fn();
const mockDepenseRecurrenteCreate = vi.fn();
const mockDepenseRecurrenteUpdateMany = vi.fn();
const mockDepenseRecurrenteDeleteMany = vi.fn();
const mockDepenseRecurrenteFindFirst = vi.fn();
const mockDepenseRecurrenteUpdate = vi.fn();
const mockDepenseCreate = vi.fn();
const mockDepenseCount = vi.fn();
const mockDepenseFindMany = vi.fn();
const mockVenteFindMany = vi.fn();
const mockVenteAggregate = vi.fn();
const mockPaiementAggregate = vi.fn();
const mockFactureCount = vi.fn();
const mockMouvementFindMany = vi.fn();
const mockPaiementFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    depenseRecurrente: {
      findMany: (...args: unknown[]) => mockDepenseRecurrenteFindMany(...args),
      create: (...args: unknown[]) => mockDepenseRecurrenteCreate(...args),
      updateMany: (...args: unknown[]) => mockDepenseRecurrenteUpdateMany(...args),
      deleteMany: (...args: unknown[]) => mockDepenseRecurrenteDeleteMany(...args),
      findFirst: (...args: unknown[]) => mockDepenseRecurrenteFindFirst(...args),
      update: (...args: unknown[]) => mockDepenseRecurrenteUpdate(...args),
    },
    depense: {
      create: (...args: unknown[]) => mockDepenseCreate(...args),
      count: (...args: unknown[]) => mockDepenseCount(...args),
      findMany: (...args: unknown[]) => mockDepenseFindMany(...args),
    },
    vente: {
      aggregate: (...args: unknown[]) => mockVenteAggregate(...args),
      findMany: (...args: unknown[]) => mockVenteFindMany(...args),
    },
    paiement: {
      aggregate: (...args: unknown[]) => mockPaiementAggregate(...args),
      findMany: (...args: unknown[]) => mockPaiementFindMany(...args),
    },
    facture: {
      count: (...args: unknown[]) => mockFactureCount(...args),
    },
    mouvementStock: {
      findMany: (...args: unknown[]) => mockMouvementFindMany(...args),
    },
    releveConsommation: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        depenseRecurrente: {
          update: mockDepenseRecurrenteUpdate,
          updateMany: mockDepenseRecurrenteUpdateMany,
        },
        depense: {
          create: mockDepenseCreate,
          count: mockDepenseCount,
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

const TEMPLATE_MENSUEL = {
  id: "rec-1",
  description: "Loyer mensuel",
  categorieDepense: CategorieDepense.LOYER,
  montantEstime: 150000,
  frequence: FrequenceRecurrence.MENSUEL,
  jourDuMois: 5,
  isActive: true,
  derniereGeneration: null,
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const TEMPLATE_TRIMESTRIEL = {
  ...TEMPLATE_MENSUEL,
  id: "rec-2",
  frequence: FrequenceRecurrence.TRIMESTRIEL,
  description: "Maintenance trimestrielle",
};

const TEMPLATE_ANNUEL = {
  ...TEMPLATE_MENSUEL,
  id: "rec-3",
  frequence: FrequenceRecurrence.ANNUEL,
  description: "Assurance annuelle",
};

function makeRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ---------------------------------------------------------------------------
// Unit tests — genererDepensesRecurrentes
// ---------------------------------------------------------------------------

import {
  genererDepensesRecurrentes,
  createDepenseRecurrente,
} from "@/lib/queries/depenses-recurrentes";

describe("genererDepensesRecurrentes — MENSUEL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Verrou optimiste : updateMany conditionnel retourne count=1 par defaut (verrou acquis)
    mockDepenseRecurrenteUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("genere une depense si derniereGeneration est null (jamais generee)", async () => {
    mockDepenseRecurrenteFindMany.mockResolvedValue([TEMPLATE_MENSUEL]);
    mockDepenseCount.mockResolvedValue(2);
    mockDepenseCreate.mockResolvedValue({
      id: "dep-new",
      numero: "DEP-2026-003",
      description: "Loyer mensuel",
      montantTotal: 150000,
    });
    mockDepenseRecurrenteUpdate.mockResolvedValue({ ...TEMPLATE_MENSUEL, derniereGeneration: new Date() });

    const result = await genererDepensesRecurrentes("site-1", "user-1");
    expect(result).toHaveLength(1);
    expect(result[0].numero).toBe("DEP-2026-003");
    expect(result[0].montantTotal).toBe(150000);
  });

  it("genere une depense si derniereGeneration < debut du mois courant", async () => {
    // Utiliser le 15 du mois precedent pour eviter les rollovers de fin de mois
    // (ex: 29 mars -> setMonth(1) -> 1 mars en annee non-bissextile)
    const dernierMois = new Date();
    dernierMois.setDate(15);
    dernierMois.setMonth(dernierMois.getMonth() - 1);

    mockDepenseRecurrenteFindMany.mockResolvedValue([
      { ...TEMPLATE_MENSUEL, derniereGeneration: dernierMois },
    ]);
    mockDepenseCount.mockResolvedValue(0);
    mockDepenseCreate.mockResolvedValue({
      id: "dep-new",
      numero: "DEP-2026-001",
      description: "Loyer mensuel",
      montantTotal: 150000,
    });
    mockDepenseRecurrenteUpdate.mockResolvedValue({ ...TEMPLATE_MENSUEL, derniereGeneration: new Date() });

    const result = await genererDepensesRecurrentes("site-1", "user-1");
    expect(result).toHaveLength(1);
  });

  it("ne genere pas si derniereGeneration est dans le mois courant (idempotent)", async () => {
    const cettemois = new Date();
    cettemois.setDate(1); // Début du mois courant

    mockDepenseRecurrenteFindMany.mockResolvedValue([
      { ...TEMPLATE_MENSUEL, derniereGeneration: cettemois },
    ]);

    const result = await genererDepensesRecurrentes("site-1", "user-1");
    expect(result).toHaveLength(0);
    expect(mockDepenseCreate).not.toHaveBeenCalled();
  });
});

describe("genererDepensesRecurrentes — TRIMESTRIEL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDepenseRecurrenteUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("genere une depense si derniereGeneration < debut du trimestre courant", async () => {
    const now = new Date();
    const trimestre = Math.floor(now.getMonth() / 3);
    const debutTrimestre = new Date(now.getFullYear(), trimestre * 3, 1);
    // Mettre derniereGeneration avant le trimestre
    const avantTrimestre = new Date(debutTrimestre);
    avantTrimestre.setDate(avantTrimestre.getDate() - 1);

    mockDepenseRecurrenteFindMany.mockResolvedValue([
      { ...TEMPLATE_TRIMESTRIEL, derniereGeneration: avantTrimestre },
    ]);
    mockDepenseCount.mockResolvedValue(0);
    mockDepenseCreate.mockResolvedValue({
      id: "dep-new",
      numero: "DEP-2026-001",
      description: "Maintenance trimestrielle",
      montantTotal: 150000,
    });
    mockDepenseRecurrenteUpdate.mockResolvedValue({});

    const result = await genererDepensesRecurrentes("site-1", "user-1");
    expect(result).toHaveLength(1);
  });

  it("ne genere pas si dans le trimestre courant (idempotent)", async () => {
    const now = new Date();
    const trimestre = Math.floor(now.getMonth() / 3);
    const debutTrimestre = new Date(now.getFullYear(), trimestre * 3, 1);

    mockDepenseRecurrenteFindMany.mockResolvedValue([
      { ...TEMPLATE_TRIMESTRIEL, derniereGeneration: debutTrimestre },
    ]);

    const result = await genererDepensesRecurrentes("site-1", "user-1");
    expect(result).toHaveLength(0);
    expect(mockDepenseCreate).not.toHaveBeenCalled();
  });
});

describe("genererDepensesRecurrentes — ANNUEL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDepenseRecurrenteUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("genere une depense si derniereGeneration < debut de l'annee courante", async () => {
    const anneeDerniere = new Date(new Date().getFullYear() - 1, 5, 1);

    mockDepenseRecurrenteFindMany.mockResolvedValue([
      { ...TEMPLATE_ANNUEL, derniereGeneration: anneeDerniere },
    ]);
    mockDepenseCount.mockResolvedValue(0);
    mockDepenseCreate.mockResolvedValue({
      id: "dep-new",
      numero: "DEP-2026-001",
      description: "Assurance annuelle",
      montantTotal: 150000,
    });
    mockDepenseRecurrenteUpdate.mockResolvedValue({});

    const result = await genererDepensesRecurrentes("site-1", "user-1");
    expect(result).toHaveLength(1);
  });

  it("ne genere pas si dans l'annee courante (idempotent)", async () => {
    const cetteAnnee = new Date(new Date().getFullYear(), 0, 1);

    mockDepenseRecurrenteFindMany.mockResolvedValue([
      { ...TEMPLATE_ANNUEL, derniereGeneration: cetteAnnee },
    ]);

    const result = await genererDepensesRecurrentes("site-1", "user-1");
    expect(result).toHaveLength(0);
    expect(mockDepenseCreate).not.toHaveBeenCalled();
  });
});

describe("genererDepensesRecurrentes — templates inactifs ignores", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ne genere pas de depense pour les templates inactifs", async () => {
    // findMany avec isActive: true retourne liste vide (templates inactifs exclus)
    mockDepenseRecurrenteFindMany.mockResolvedValue([]);

    const result = await genererDepensesRecurrentes("site-1", "user-1");
    expect(result).toHaveLength(0);
    expect(mockDepenseCreate).not.toHaveBeenCalled();
  });
});

describe("createDepenseRecurrente — validation jourDuMois", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejette jourDuMois > 28", async () => {
    await expect(
      createDepenseRecurrente("site-1", "user-1", {
        description: "Test",
        categorieDepense: CategorieDepense.LOYER,
        montantEstime: 100,
        frequence: FrequenceRecurrence.MENSUEL,
        jourDuMois: 31,
      })
    ).rejects.toThrow("jourDuMois doit etre compris entre 1 et 28");
  });

  it("rejette jourDuMois < 1", async () => {
    await expect(
      createDepenseRecurrente("site-1", "user-1", {
        description: "Test",
        categorieDepense: CategorieDepense.LOYER,
        montantEstime: 100,
        frequence: FrequenceRecurrence.MENSUEL,
        jourDuMois: 0,
      })
    ).rejects.toThrow("jourDuMois doit etre compris entre 1 et 28");
  });
});

// ---------------------------------------------------------------------------
// API Routes tests
// ---------------------------------------------------------------------------

import { GET, POST } from "@/app/api/depenses-recurrentes/route";
import {
  GET as GET_ID,
  PUT,
  DELETE,
} from "@/app/api/depenses-recurrentes/[id]/route";
import { POST as POST_GENERER } from "@/app/api/depenses-recurrentes/generer/route";

const PARAMS = { params: Promise.resolve({ id: "rec-1" }) };

describe("GET /api/depenses-recurrentes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 200 avec la liste des templates", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDepenseRecurrenteFindMany.mockResolvedValue([TEMPLATE_MENSUEL]);

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.templates)).toBe(true);
    expect(data.total).toBe(1);
  });

  it("retourne 403 sans permission DEPENSES_VOIR", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission refusee")
    );

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/depenses-recurrentes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 201 avec le template cree", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDepenseRecurrenteCreate.mockResolvedValue({
      ...TEMPLATE_MENSUEL,
      user: { id: "user-1", name: "Admin" },
    });

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes", {
      method: "POST",
      body: JSON.stringify({
        description: "Loyer mensuel",
        categorieDepense: CategorieDepense.LOYER,
        montantEstime: 150000,
        frequence: FrequenceRecurrence.MENSUEL,
        jourDuMois: 5,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("retourne 400 si description manquante", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes", {
      method: "POST",
      body: JSON.stringify({
        categorieDepense: CategorieDepense.LOYER,
        montantEstime: 150000,
        frequence: FrequenceRecurrence.MENSUEL,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si frequence invalide", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes", {
      method: "POST",
      body: JSON.stringify({
        description: "Test",
        categorieDepense: CategorieDepense.LOYER,
        montantEstime: 100,
        frequence: "HEBDOMADAIRE", // invalide
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 400 si jourDuMois > 28", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes", {
      method: "POST",
      body: JSON.stringify({
        description: "Test",
        categorieDepense: CategorieDepense.LOYER,
        montantEstime: 100,
        frequence: FrequenceRecurrence.MENSUEL,
        jourDuMois: 31,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("retourne 403 sans permission DEPENSES_CREER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission refusee")
    );

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes", {
      method: "POST",
      body: JSON.stringify({
        description: "Test",
        categorieDepense: CategorieDepense.LOYER,
        montantEstime: 100,
        frequence: FrequenceRecurrence.MENSUEL,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/depenses-recurrentes/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 200 avec le template", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDepenseRecurrenteFindFirst.mockResolvedValue({
      ...TEMPLATE_MENSUEL,
      user: { id: "user-1", name: "Admin" },
    });

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes/rec-1");
    const res = await GET_ID(req, PARAMS);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("rec-1");
  });

  it("retourne 404 si template introuvable", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDepenseRecurrenteFindFirst.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes/rec-99");
    const res = await GET_ID(
      req,
      { params: Promise.resolve({ id: "rec-99" }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/depenses-recurrentes/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 200 apres mise a jour reussie", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDepenseRecurrenteUpdateMany.mockResolvedValue({ count: 1 });
    mockDepenseRecurrenteFindFirst.mockResolvedValue({
      ...TEMPLATE_MENSUEL,
      isActive: false,
      user: { id: "user-1", name: "Admin" },
    });

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes/rec-1", {
      method: "PUT",
      body: JSON.stringify({ isActive: false }),
    });
    const res = await PUT(req, PARAMS);
    expect(res.status).toBe(200);
  });

  it("retourne 400 si jourDuMois invalide", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes/rec-1", {
      method: "PUT",
      body: JSON.stringify({ jourDuMois: 29 }),
    });
    const res = await PUT(req, PARAMS);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/depenses-recurrentes/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 200 apres suppression reussie", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDepenseRecurrenteDeleteMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes/rec-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, PARAMS);
    expect(res.status).toBe(200);
  });

  it("retourne 404 si template introuvable", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDepenseRecurrenteDeleteMany.mockResolvedValue({ count: 0 });

    const req = makeRequest("http://localhost:3000/api/depenses-recurrentes/rec-99", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "rec-99" }) });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/depenses-recurrentes/generer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 200 avec generated=0 si aucune depense due", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDepenseRecurrenteFindMany.mockResolvedValue([]); // aucun template actif

    const req = makeRequest(
      "http://localhost:3000/api/depenses-recurrentes/generer",
      { method: "POST" }
    );
    const res = await POST_GENERER(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.generated).toBe(0);
    expect(Array.isArray(data.depenses)).toBe(true);
  });

  it("retourne 200 avec la liste des depenses generees", async () => {
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDepenseRecurrenteFindMany.mockResolvedValue([TEMPLATE_MENSUEL]); // null = jamais generee, donc due
    mockDepenseCount.mockResolvedValue(0);
    mockDepenseCreate.mockResolvedValue({
      id: "dep-generated",
      numero: "DEP-2026-001",
      description: "Loyer mensuel",
      montantTotal: 150000,
    });
    mockDepenseRecurrenteUpdate.mockResolvedValue({});
    // Verrou optimiste : updateMany conditionnel retourne count=1 (verrou acquis)
    mockDepenseRecurrenteUpdateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest(
      "http://localhost:3000/api/depenses-recurrentes/generer",
      { method: "POST" }
    );
    const res = await POST_GENERER(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.generated).toBe(1);
    expect(data.depenses[0].numero).toBe("DEP-2026-001");
  });

  it("retourne 403 sans permission DEPENSES_CREER", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission refusee")
    );

    const req = makeRequest(
      "http://localhost:3000/api/depenses-recurrentes/generer",
      { method: "POST" }
    );
    const res = await POST_GENERER(req);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests getResumeFinancier — anti double-comptage
// ---------------------------------------------------------------------------

import { getResumeFinancier } from "@/lib/queries/finances";

describe("getResumeFinancier — anti double-comptage dépenses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inclut les depenses sans commandeId dans coutsTotaux", async () => {
    // Aucun mouvement, aucune vente, 1 depense hors-commande
    mockVenteAggregate.mockResolvedValue({
      _sum: { montantTotal: 0, poidsTotalKg: 0 },
      _count: { id: 0 },
    });
    mockPaiementAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockFactureCount.mockResolvedValue(0);
    // sumCoutsParCategorie appelle mouvementStock.findMany 3 fois
    mockMouvementFindMany.mockResolvedValue([]);
    // Depenses hors-commande : 1 depense LOYER 50000
    mockDepenseFindMany.mockResolvedValue([
      {
        montantTotal: 50000,
        montantPaye: 0,
        statut: "NON_PAYEE",
        categorieDepense: CategorieDepense.LOYER,
      },
    ]);

    const resume = await getResumeFinancier("site-1");

    expect(resume.depensesTotales).toBe(50000);
    expect(resume.depensesImpayees).toBe(50000);
    expect(resume.depensesPayees).toBe(0);
    expect(resume.coutsTotaux).toBe(50000); // 0 stock + 50000 depenses
    expect(resume.margeBrute).toBe(-50000); // 0 revenus - 50000 couts
    expect(resume.depensesParCategorie[CategorieDepense.LOYER]).toBe(50000);
  });

  it("n'inclut PAS les depenses avec commandeId (anti double-comptage)", async () => {
    // findMany est appele avec commandeId: null — donc les depenses avec commandeId ne sont pas retournees
    // Ce test verifie que si findMany retourne 0 depenses (commandeId filtre), coutsTotaux = 0
    mockVenteAggregate.mockResolvedValue({
      _sum: { montantTotal: 0, poidsTotalKg: 0 },
      _count: { id: 0 },
    });
    mockPaiementAggregate.mockResolvedValue({ _sum: { montant: 0 } });
    mockFactureCount.mockResolvedValue(0);
    mockMouvementFindMany.mockResolvedValue([]);
    // Depenses hors-commande : aucune (celles avec commandeId sont filtrees par la query)
    mockDepenseFindMany.mockResolvedValue([]);

    const resume = await getResumeFinancier("site-1");

    expect(resume.depensesTotales).toBe(0);
    expect(resume.coutsTotaux).toBe(0);
  });

  it("calcule correctement depensesPayees vs depensesImpayees", async () => {
    mockVenteAggregate.mockResolvedValue({
      _sum: { montantTotal: 200000, poidsTotalKg: 50 },
      _count: { id: 2 },
    });
    mockPaiementAggregate.mockResolvedValue({ _sum: { montant: 150000 } });
    mockFactureCount.mockResolvedValue(2);
    mockMouvementFindMany.mockResolvedValue([]);
    mockDepenseFindMany.mockResolvedValue([
      {
        montantTotal: 30000,
        montantPaye: 30000,
        statut: "PAYEE",
        categorieDepense: CategorieDepense.ELECTRICITE,
      },
      {
        montantTotal: 80000,
        montantPaye: 0,
        statut: "NON_PAYEE",
        categorieDepense: CategorieDepense.SALAIRE,
      },
    ]);

    const resume = await getResumeFinancier("site-1");

    expect(resume.depensesTotales).toBe(110000);
    expect(resume.depensesPayees).toBe(30000);
    expect(resume.depensesImpayees).toBe(80000); // reste = 80000 - 0 = 80000
    expect(resume.coutsTotaux).toBe(110000);
  });
});
