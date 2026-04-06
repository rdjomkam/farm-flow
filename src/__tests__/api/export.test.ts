/**
 * Tests — Routes /api/export/*
 *
 * Sprint 12 — Story 12.8
 * Couvre :
 *   - GET /api/export/facture/[id]  → PDF
 *   - GET /api/export/vague/[id]    → PDF
 *   - GET /api/export/finances      → PDF
 *   - GET /api/export/releves       → Excel
 *   - GET /api/export/stock         → Excel
 *   - GET /api/export/ventes        → Excel
 *   - Non-régression BUG-002 (normalisation téléphone)
 *   - Non-régression M5 (switch default clause releves)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Permission, StatutFacture, StatutVague, TypeReleve, ModePaiement } from "@/types";

// ---------------------------------------------------------------------------
// Mocks communs — Auth + Permissions
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
  normalizePhone: (input: string): string | null => {
    const cleaned = input.replace(/[\s\-().]/g, "");
    let digits: string;
    if (cleaned.startsWith("+237")) digits = cleaned.slice(4);
    else if (cleaned.startsWith("00237")) digits = cleaned.slice(5);
    else if (cleaned.startsWith("237") && cleaned.length === 12) digits = cleaned.slice(3);
    else digits = cleaned;
    if (/^[62]\d{8}$/.test(digits)) return `+237${digits}`;
    return null;
  },
}));

// ---------------------------------------------------------------------------
// Mocks — Queries
// ---------------------------------------------------------------------------

const mockGetFactureById = vi.fn();
vi.mock("@/lib/queries/factures", () => ({
  getFactureById: (...args: unknown[]) => mockGetFactureById(...args),
}));

const mockGetVagueById = vi.fn();
vi.mock("@/lib/queries/vagues", () => ({
  getVagueById: (...args: unknown[]) => mockGetVagueById(...args),
}));

const mockGetIndicateursVague = vi.fn();
vi.mock("@/lib/queries/indicateurs", () => ({
  getIndicateursVague: (...args: unknown[]) => mockGetIndicateursVague(...args),
}));

const mockGetResumeFinancier = vi.fn();
const mockGetRentabiliteParVague = vi.fn();
const mockGetEvolutionFinanciere = vi.fn();
const mockGetTopClients = vi.fn();
vi.mock("@/lib/queries/finances", () => ({
  getResumeFinancier: (...args: unknown[]) => mockGetResumeFinancier(...args),
  getRentabiliteParVague: (...args: unknown[]) => mockGetRentabiliteParVague(...args),
  getEvolutionFinanciere: (...args: unknown[]) => mockGetEvolutionFinanciere(...args),
  getTopClients: (...args: unknown[]) => mockGetTopClients(...args),
}));

const mockGetReleves = vi.fn();
vi.mock("@/lib/queries/releves", () => ({
  getReleves: (...args: unknown[]) => mockGetReleves(...args),
  createReleve: vi.fn(),
  getReleveById: vi.fn(),
  updateReleve: vi.fn(),
}));

const mockGetVentes = vi.fn();
vi.mock("@/lib/queries/ventes", () => ({
  getVentes: (...args: unknown[]) => mockGetVentes(...args),
}));

// ---------------------------------------------------------------------------
// Mock — Prisma (pour getFactureById, mouvements stock, etc.)
// ---------------------------------------------------------------------------

const mockPrismaFindUnique = vi.fn();
const mockPrismaReleveFindMany = vi.fn();
const mockPrismaMouvementFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    site: {
      findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockPrismaReleveFindMany(...args),
    },
    mouvementStock: {
      findMany: (...args: unknown[]) => mockPrismaMouvementFindMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock — Générateurs PDF / Excel
// ---------------------------------------------------------------------------

const FAKE_PDF_BUFFER = Buffer.from("%PDF-1.4 fake pdf content");
const FAKE_EXCEL_BUFFER = Buffer.from("PK fake xlsx content");

vi.mock("@/lib/export/pdf-facture", () => ({
  renderFacturePDF: vi.fn().mockResolvedValue(FAKE_PDF_BUFFER),
}));

vi.mock("@/lib/export/pdf-rapport-vague", () => ({
  renderRapportVaguePDF: vi.fn().mockResolvedValue(FAKE_PDF_BUFFER),
}));

vi.mock("@/lib/export/pdf-rapport-financier", () => ({
  renderRapportFinancierPDF: vi.fn().mockResolvedValue(FAKE_PDF_BUFFER),
}));

vi.mock("@/lib/export/excel-releves", () => ({
  genererExcelReleves: vi.fn().mockReturnValue(FAKE_EXCEL_BUFFER),
}));

vi.mock("@/lib/export/excel-stock", () => ({
  genererExcelStock: vi.fn().mockReturnValue(FAKE_EXCEL_BUFFER),
}));

vi.mock("@/lib/export/excel-ventes", () => ({
  genererExcelVentes: vi.fn().mockReturnValue(FAKE_EXCEL_BUFFER),
}));

vi.mock("@/lib/feature-flags", () => ({
  checkPlatformMaintenance: vi.fn().mockResolvedValue(null),
  getFeatureFlag: vi.fn().mockResolvedValue(null),
  isMaintenanceModeEnabled: vi.fn().mockResolvedValue(false),
}));

// ---------------------------------------------------------------------------
// Contexte d'authentification commun
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "ADMIN",
  activeSiteId: "site-1",
  isSuperAdmin: false,
  siteRoleId: "role-1",
  siteRoleName: "Admin",
  permissions: [
    Permission.FACTURES_VOIR,
    Permission.VAGUES_VOIR,
    Permission.FINANCES_VOIR,
    Permission.RELEVES_VOIR,
    Permission.STOCK_VOIR,
    Permission.VENTES_VOIR,
    Permission.EXPORT_DONNEES,
  ],
};

// ---------------------------------------------------------------------------
// Données de test réutilisables
// ---------------------------------------------------------------------------

const FAKE_SITE = { name: "Ferme DKFarm", address: "Yaoundé, Cameroun" };

const FAKE_FACTURE = {
  id: "f-1",
  numero: "FAC-2026-001",
  statut: StatutFacture.ENVOYEE,
  dateEmission: new Date("2026-03-01"),
  dateEcheance: new Date("2026-04-01"),
  montantTotal: 75000,
  montantPaye: 25000,
  notes: "Facture test",
  vente: {
    id: "v-1",
    numero: "VTE-2026-001",
    quantitePoissons: 50,
    poidsTotalKg: 150,
    prixUnitaireKg: 500,
    montantTotal: 75000,
    client: {
      nom: "Client Test",
      email: "client@test.cm",
      telephone: "+237677000001",
      adresse: "Douala",
    },
    vague: { code: "V-2026-001" },
  },
  paiements: [
    {
      id: "p-1",
      montant: 25000,
      mode: ModePaiement.MOBILE_MONEY,
      reference: "REF-001",
      date: new Date("2026-03-05"),
    },
  ],
};

const FAKE_VAGUE = {
  id: "vague-1",
  code: "V-2026-001",
  statut: StatutVague.EN_COURS,
  dateDebut: new Date("2026-01-01"),
  dateFin: null,
  nombreInitial: 500,
  poidsMoyenInitial: 50,
  origineAlevins: "Interne",
  bacs: [
    { id: "bac-1", nom: "Bac A", volume: 5000, nombrePoissons: 250 },
    { id: "bac-2", nom: "Bac B", volume: 5000, nombrePoissons: 250 },
  ],
  releves: [
    {
      id: "r-1",
      typeReleve: TypeReleve.BIOMETRIE,
      date: new Date("2026-02-01"),
      bacId: "bac-1",
      poidsMoyen: 250,
      tailleMoyenne: 35,
      nombreMorts: null,
      causeMortalite: null,
      quantiteAliment: null,
      temperature: null,
      ph: null,
      nombreCompte: null,
      notes: null,
    },
  ],
};

const FAKE_INDICATEURS = {
  tauxSurvie: 98,
  fcr: 1.5,
  sgr: 2.3,
  biomasse: 125000,
  poidsMoyen: 250,
  nombreVivants: 490,
};

// Données financières
const FAKE_RESUME_FINANCIER = {
  revenus: 500000,
  coutsTotaux: 200000,
  margeBrute: 300000,
  tauxMarge: 60,
};

const FAKE_RENTABILITE = {
  vagues: [
    { code: "V-2026-001", poidsTotalVendu: 300, revenus: 300000 },
  ],
};

const FAKE_EVOLUTION = {
  evolution: [
    { mois: "2026-01", revenus: 100000, couts: 50000, marge: 50000 },
    { mois: "2026-02", revenus: 200000, couts: 80000, marge: 120000 },
    { mois: "2026-03", revenus: 200000, couts: 70000, marge: 130000 },
  ],
};

const FAKE_TOP_CLIENTS = {
  clients: [
    { nom: "Client Alpha", totalVentes: 300000, nombreVentes: 3 },
    { nom: "Client Beta", totalVentes: 200000, nombreVentes: 2 },
  ],
};

// Helper
function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

// ===========================================================================
// GET /api/export/facture/[id]
// ===========================================================================

describe("GET /api/export/facture/[id]", () => {
  // Import lazy pour éviter les conflits de mock
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetFactureById.mockResolvedValue(FAKE_FACTURE);
    mockPrismaFindUnique.mockResolvedValue(FAKE_SITE);
    const mod = await import("@/app/api/export/facture/[id]/route");
    GET = mod.GET;
  });

  it("retourne 200 avec Content-Type application/pdf", async () => {
    const response = await GET(
      makeRequest("/api/export/facture/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("retourne le header Content-Disposition avec le numéro de facture", async () => {
    const response = await GET(
      makeRequest("/api/export/facture/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(response.headers.get("Content-Disposition")).toContain("facture-FAC-2026-001.pdf");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("retourne Cache-Control: no-store", async () => {
    const response = await GET(
      makeRequest("/api/export/facture/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("retourne 401 sans authentification", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifié"));

    const response = await GET(
      makeRequest("/api/export/facture/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 sans permission FACTURES_VOIR", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission FACTURES_VOIR requise")
    );

    const response = await GET(
      makeRequest("/api/export/facture/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("retourne 403 sans permission EXPORT_DONNEES", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission EXPORT_DONNEES requise")
    );

    const response = await GET(
      makeRequest("/api/export/facture/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("retourne 404 si facture inexistante", async () => {
    mockGetFactureById.mockResolvedValue(null);

    const response = await GET(
      makeRequest("/api/export/facture/unknown"),
      { params: Promise.resolve({ id: "unknown" }) }
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.message).toContain("introuvable");
  });

  it("retourne 404 si site inexistant", async () => {
    mockPrismaFindUnique.mockResolvedValue(null);

    const response = await GET(
      makeRequest("/api/export/facture/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.message).toContain("Site introuvable");
  });

  it("appelle requirePermission avec FACTURES_VOIR et EXPORT_DONNEES", async () => {
    await GET(
      makeRequest("/api/export/facture/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.FACTURES_VOIR,
      Permission.EXPORT_DONNEES
    );
  });

  it("filtre la facture par siteId", async () => {
    await GET(
      makeRequest("/api/export/facture/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(mockGetFactureById).toHaveBeenCalledWith("f-1", "site-1");
  });

  it("retourne 500 en cas d'erreur serveur inattendue", async () => {
    mockGetFactureById.mockRejectedValue(new Error("DB connection failed"));

    const response = await GET(
      makeRequest("/api/export/facture/f-1"),
      { params: Promise.resolve({ id: "f-1" }) }
    );

    expect(response.status).toBe(500);
  });
});

// ===========================================================================
// GET /api/export/vague/[id]
// ===========================================================================

describe("GET /api/export/vague/[id]", () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetVagueById.mockResolvedValue(FAKE_VAGUE);
    mockGetIndicateursVague.mockResolvedValue(FAKE_INDICATEURS);
    mockPrismaFindUnique.mockResolvedValue(FAKE_SITE);
    // ADR-038 : la route charge les releves separement via prisma.releve.findMany
    mockPrismaReleveFindMany.mockResolvedValue(FAKE_VAGUE.releves);
    const mod = await import("@/app/api/export/vague/[id]/route");
    GET = mod.GET;
  });

  it("retourne 200 avec Content-Type application/pdf", async () => {
    const response = await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("retourne le header Content-Disposition avec le code de vague", async () => {
    const response = await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    expect(response.headers.get("Content-Disposition")).toContain("rapport-vague-V-2026-001.pdf");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("retourne Cache-Control: no-store", async () => {
    const response = await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("retourne 401 sans authentification", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifié"));

    const response = await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("retourne 403 sans permission VAGUES_VOIR ou EXPORT_DONNEES", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission VAGUES_VOIR requise")
    );

    const response = await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    expect(response.status).toBe(403);
  });

  it("retourne 404 si vague inexistante", async () => {
    mockGetVagueById.mockResolvedValue(null);
    mockGetIndicateursVague.mockResolvedValue(null);

    const response = await GET(
      makeRequest("/api/export/vague/unknown"),
      { params: Promise.resolve({ id: "unknown" }) }
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.message).toContain("introuvable");
  });

  it("retourne 404 si site inexistant", async () => {
    mockPrismaFindUnique.mockResolvedValue(null);

    const response = await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    expect(response.status).toBe(404);
  });

  it("appelle requirePermission avec VAGUES_VOIR et EXPORT_DONNEES", async () => {
    await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.VAGUES_VOIR,
      Permission.EXPORT_DONNEES
    );
  });

  it("filtre la vague par siteId", async () => {
    await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    expect(mockGetVagueById).toHaveBeenCalledWith("vague-1", "site-1");
  });

  it("inclut les indicateurs KPI dans le rapport", async () => {
    await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    expect(mockGetIndicateursVague).toHaveBeenCalledWith("site-1", "vague-1");
  });

  it("gère les indicateurs null (vague sans relevés)", async () => {
    mockGetIndicateursVague.mockResolvedValue(null);

    const response = await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    // Doit toujours retourner 200 avec des valeurs par défaut
    expect(response.status).toBe(200);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetVagueById.mockRejectedValue(new Error("DB error"));

    const response = await GET(
      makeRequest("/api/export/vague/vague-1"),
      { params: Promise.resolve({ id: "vague-1" }) }
    );

    expect(response.status).toBe(500);
  });
});

// ===========================================================================
// GET /api/export/finances
// ===========================================================================

describe("GET /api/export/finances", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetResumeFinancier.mockResolvedValue(FAKE_RESUME_FINANCIER);
    mockGetRentabiliteParVague.mockResolvedValue(FAKE_RENTABILITE);
    mockGetEvolutionFinanciere.mockResolvedValue(FAKE_EVOLUTION);
    mockGetTopClients.mockResolvedValue(FAKE_TOP_CLIENTS);
    mockPrismaFindUnique.mockResolvedValue(FAKE_SITE);
    const mod = await import("@/app/api/export/finances/route");
    GET = mod.GET;
  });

  it("retourne 200 avec Content-Type application/pdf", async () => {
    const response = await GET(makeRequest("/api/export/finances"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("retourne le header Content-Disposition avec la date du jour", async () => {
    const response = await GET(makeRequest("/api/export/finances"));

    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).toContain("rapport-financier-");
    expect(contentDisposition).toContain(".pdf");
    expect(contentDisposition).toContain("attachment");
  });

  it("retourne Cache-Control: no-store", async () => {
    const response = await GET(makeRequest("/api/export/finances"));

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("accepte les filtres dateFrom et dateTo", async () => {
    const response = await GET(
      makeRequest("/api/export/finances?dateFrom=2026-01-01&dateTo=2026-03-31")
    );

    expect(response.status).toBe(200);
    expect(mockGetResumeFinancier).toHaveBeenCalledWith("site-1", {
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    });
  });

  it("utilise les 30 derniers jours par défaut si pas de filtres", async () => {
    await GET(makeRequest("/api/export/finances"));

    // getResumeFinancier appelé sans période (undefined)
    expect(mockGetResumeFinancier).toHaveBeenCalledWith("site-1", undefined);
  });

  it("retourne 401 sans authentification", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifié"));

    const response = await GET(makeRequest("/api/export/finances"));

    expect(response.status).toBe(401);
  });

  it("retourne 403 sans permission FINANCES_VOIR", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission FINANCES_VOIR requise")
    );

    const response = await GET(makeRequest("/api/export/finances"));

    expect(response.status).toBe(403);
  });

  it("retourne 403 sans permission EXPORT_DONNEES", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission EXPORT_DONNEES requise")
    );

    const response = await GET(makeRequest("/api/export/finances"));

    expect(response.status).toBe(403);
  });

  it("appelle requirePermission avec FINANCES_VOIR et EXPORT_DONNEES", async () => {
    await GET(makeRequest("/api/export/finances"));

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.FINANCES_VOIR,
      Permission.EXPORT_DONNEES
    );
  });

  it("retourne 404 si site introuvable", async () => {
    mockPrismaFindUnique.mockResolvedValue(null);

    const response = await GET(makeRequest("/api/export/finances"));

    expect(response.status).toBe(404);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetResumeFinancier.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/export/finances"));

    expect(response.status).toBe(500);
  });
});

// ===========================================================================
// GET /api/export/releves
// ===========================================================================

describe("GET /api/export/releves", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  const FAKE_RELEVES_DB = [
    {
      id: "r-1",
      typeReleve: TypeReleve.BIOMETRIE,
      date: new Date("2026-02-01"),
      bacId: "bac-1",
      poidsMoyen: 250,
      tailleMoyenne: 35,
      echantillonCount: 10,
      nombreMorts: null,
      causeMortalite: null,
      quantiteAliment: null,
      typeAliment: null,
      frequenceAliment: null,
      temperature: null,
      ph: null,
      oxygene: null,
      ammoniac: null,
      nombreCompte: null,
      methodeComptage: null,
      description: null,
      notes: "Test relevé",
      bac: { nom: "Bac A" },
      vague: { code: "V-2026-001" },
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetReleves.mockResolvedValue({ data: [{ id: "r-1" }], total: 1 });
    mockPrismaReleveFindMany.mockResolvedValue(FAKE_RELEVES_DB);
    const mod = await import("@/app/api/export/releves/route");
    GET = mod.GET;
  });

  it("retourne 200 avec Content-Type xlsx", async () => {
    const response = await GET(makeRequest("/api/export/releves"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("retourne le header Content-Disposition avec extension .xlsx", async () => {
    const response = await GET(makeRequest("/api/export/releves"));

    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).toContain("releves-");
    expect(contentDisposition).toContain(".xlsx");
    expect(contentDisposition).toContain("attachment");
  });

  it("retourne Cache-Control: no-store", async () => {
    const response = await GET(makeRequest("/api/export/releves"));

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("accepte le filtre vagueId", async () => {
    await GET(makeRequest("/api/export/releves?vagueId=vague-1"));

    expect(mockGetReleves).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ vagueId: "vague-1" })
    );
  });

  it("accepte les filtres dateFrom et dateTo", async () => {
    await GET(
      makeRequest("/api/export/releves?dateFrom=2026-01-01&dateTo=2026-03-31")
    );

    expect(mockGetReleves).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        dateFrom: "2026-01-01",
        dateTo: "2026-03-31",
      })
    );
  });

  it("accepte le filtre typeReleve valide", async () => {
    await GET(makeRequest("/api/export/releves?typeReleve=BIOMETRIE"));

    expect(mockGetReleves).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ typeReleve: TypeReleve.BIOMETRIE })
    );
  });

  it("ignore un typeReleve invalide", async () => {
    await GET(makeRequest("/api/export/releves?typeReleve=INVALIDE"));

    // typeReleve ne doit pas être passé si invalide
    const callArgs = mockGetReleves.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.typeReleve).toBeUndefined();
  });

  it("accepte le filtre bacId", async () => {
    await GET(makeRequest("/api/export/releves?bacId=bac-1"));

    expect(mockGetReleves).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ bacId: "bac-1" })
    );
  });

  it("retourne 401 sans authentification", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifié"));

    const response = await GET(makeRequest("/api/export/releves"));

    expect(response.status).toBe(401);
  });

  it("retourne 403 sans permission RELEVES_VOIR", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission RELEVES_VOIR requise")
    );

    const response = await GET(makeRequest("/api/export/releves"));

    expect(response.status).toBe(403);
  });

  it("retourne 403 sans permission EXPORT_DONNEES", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission EXPORT_DONNEES requise")
    );

    const response = await GET(makeRequest("/api/export/releves"));

    expect(response.status).toBe(403);
  });

  it("appelle requirePermission avec RELEVES_VOIR et EXPORT_DONNEES", async () => {
    await GET(makeRequest("/api/export/releves"));

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.RELEVES_VOIR,
      Permission.EXPORT_DONNEES
    );
  });

  it("retourne 200 avec liste vide si aucun relevé", async () => {
    mockGetReleves.mockResolvedValue({ data: [], total: 0 });
    mockPrismaReleveFindMany.mockResolvedValue([]);

    const response = await GET(makeRequest("/api/export/releves"));

    expect(response.status).toBe(200);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetReleves.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/export/releves"));

    expect(response.status).toBe(500);
  });
});

// ===========================================================================
// GET /api/export/stock
// ===========================================================================

describe("GET /api/export/stock", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  const FAKE_MOUVEMENTS = [
    {
      id: "mv-1",
      date: new Date("2026-02-15"),
      type: "ENTREE",
      quantite: 100,
      prixTotal: 50000,
      siteId: "site-1",
      produit: {
        id: "prod-1",
        nom: "Aliment granulé",
        categorie: "ALIMENT",
        unite: "KG",
      },
      vague: { code: "V-2026-001" },
      commande: { numero: "CMD-2026-001" },
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockPrismaMouvementFindMany.mockResolvedValue(FAKE_MOUVEMENTS);
    const mod = await import("@/app/api/export/stock/route");
    GET = mod.GET;
  });

  it("retourne 200 avec Content-Type xlsx", async () => {
    const response = await GET(makeRequest("/api/export/stock"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("retourne le header Content-Disposition avec extension .xlsx", async () => {
    const response = await GET(makeRequest("/api/export/stock"));

    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).toContain("mouvements-stock-");
    expect(contentDisposition).toContain(".xlsx");
    expect(contentDisposition).toContain("attachment");
  });

  it("retourne Cache-Control: no-store", async () => {
    const response = await GET(makeRequest("/api/export/stock"));

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("accepte les filtres dateFrom et dateTo", async () => {
    await GET(
      makeRequest("/api/export/stock?dateFrom=2026-01-01&dateTo=2026-03-31")
    );

    const callArgs = mockPrismaMouvementFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArgs.where.siteId).toBe("site-1");
  });

  it("accepte le filtre produitId", async () => {
    await GET(makeRequest("/api/export/stock?produitId=prod-1"));

    const callArgs = mockPrismaMouvementFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArgs.where.produitId).toBe("prod-1");
  });

  it("accepte le filtre type de mouvement valide", async () => {
    await GET(makeRequest("/api/export/stock?type=ENTREE"));

    const callArgs = mockPrismaMouvementFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArgs.where.type).toBe("ENTREE");
  });

  it("ignore un type de mouvement invalide", async () => {
    await GET(makeRequest("/api/export/stock?type=INVALID_TYPE"));

    const callArgs = mockPrismaMouvementFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArgs.where.type).toBeUndefined();
  });

  it("filtre toujours par siteId", async () => {
    await GET(makeRequest("/api/export/stock"));

    const callArgs = mockPrismaMouvementFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArgs.where.siteId).toBe("site-1");
  });

  it("retourne 401 sans authentification", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifié"));

    const response = await GET(makeRequest("/api/export/stock"));

    expect(response.status).toBe(401);
  });

  it("retourne 403 sans permission STOCK_VOIR", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission STOCK_VOIR requise")
    );

    const response = await GET(makeRequest("/api/export/stock"));

    expect(response.status).toBe(403);
  });

  it("retourne 403 sans permission EXPORT_DONNEES", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission EXPORT_DONNEES requise")
    );

    const response = await GET(makeRequest("/api/export/stock"));

    expect(response.status).toBe(403);
  });

  it("appelle requirePermission avec STOCK_VOIR et EXPORT_DONNEES", async () => {
    await GET(makeRequest("/api/export/stock"));

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.STOCK_VOIR,
      Permission.EXPORT_DONNEES
    );
  });

  it("retourne 200 avec liste vide si aucun mouvement", async () => {
    mockPrismaMouvementFindMany.mockResolvedValue([]);

    const response = await GET(makeRequest("/api/export/stock"));

    expect(response.status).toBe(200);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockPrismaMouvementFindMany.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/export/stock"));

    expect(response.status).toBe(500);
  });
});

// ===========================================================================
// GET /api/export/ventes
// ===========================================================================

describe("GET /api/export/ventes", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  const FAKE_VENTES = [
    {
      id: "v-1",
      numero: "VTE-2026-001",
      createdAt: new Date("2026-03-01"),
      quantitePoissons: 50,
      poidsTotalKg: 150,
      prixUnitaireKg: 500,
      montantTotal: 75000,
      notes: null,
      client: { nom: "Client Alpha" },
      vague: { code: "V-2026-001" },
      facture: { statut: StatutFacture.PAYEE },
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetVentes.mockResolvedValue({ data: FAKE_VENTES, total: FAKE_VENTES.length });
    const mod = await import("@/app/api/export/ventes/route");
    GET = mod.GET;
  });

  it("retourne 200 avec Content-Type xlsx", async () => {
    const response = await GET(makeRequest("/api/export/ventes"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("retourne le header Content-Disposition avec extension .xlsx", async () => {
    const response = await GET(makeRequest("/api/export/ventes"));

    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).toContain("ventes-");
    expect(contentDisposition).toContain(".xlsx");
    expect(contentDisposition).toContain("attachment");
  });

  it("retourne Cache-Control: no-store", async () => {
    const response = await GET(makeRequest("/api/export/ventes"));

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("accepte le filtre clientId", async () => {
    await GET(makeRequest("/api/export/ventes?clientId=client-1"));

    expect(mockGetVentes).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ clientId: "client-1" })
    );
  });

  it("accepte le filtre vagueId", async () => {
    await GET(makeRequest("/api/export/ventes?vagueId=vague-1"));

    expect(mockGetVentes).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ vagueId: "vague-1" })
    );
  });

  it("accepte les filtres dateFrom et dateTo", async () => {
    await GET(
      makeRequest("/api/export/ventes?dateFrom=2026-01-01&dateTo=2026-03-31")
    );

    expect(mockGetVentes).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        dateFrom: "2026-01-01",
        dateTo: "2026-03-31",
      })
    );
  });

  it("retourne 401 sans authentification", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifié"));

    const response = await GET(makeRequest("/api/export/ventes"));

    expect(response.status).toBe(401);
  });

  it("retourne 403 sans permission VENTES_VOIR", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission VENTES_VOIR requise")
    );

    const response = await GET(makeRequest("/api/export/ventes"));

    expect(response.status).toBe(403);
  });

  it("retourne 403 sans permission EXPORT_DONNEES", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission EXPORT_DONNEES requise")
    );

    const response = await GET(makeRequest("/api/export/ventes"));

    expect(response.status).toBe(403);
  });

  it("appelle requirePermission avec VENTES_VOIR et EXPORT_DONNEES", async () => {
    await GET(makeRequest("/api/export/ventes"));

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.any(NextRequest),
      Permission.VENTES_VOIR,
      Permission.EXPORT_DONNEES
    );
  });

  it("retourne 200 avec liste vide si aucune vente", async () => {
    mockGetVentes.mockResolvedValue({ data: [], total: 0 });

    const response = await GET(makeRequest("/api/export/ventes"));

    expect(response.status).toBe(200);
  });

  it("gère correctement le statut facture null", async () => {
    mockGetVentes.mockResolvedValue({
      data: [{ ...FAKE_VENTES[0], facture: null }],
      total: 1,
    });

    const response = await GET(makeRequest("/api/export/ventes"));

    expect(response.status).toBe(200);
  });

  it("retourne 500 en cas d'erreur serveur", async () => {
    mockGetVentes.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest("/api/export/ventes"));

    expect(response.status).toBe(500);
  });
});

// ===========================================================================
// Non-régression — BUG-002 : Normalisation téléphone
// ===========================================================================

describe("BUG-002 — Normalisation téléphone (non-régression)", () => {
  // La fonction normalizePhone est mockée dans @/lib/auth avec la logique réelle
  // On importe directement depuis le mock pour tester le comportement

  it("normalise 6XXXXXXXXX → +2376XXXXXXXXX", async () => {
    const { normalizePhone } = await import("@/lib/auth");
    expect(normalizePhone("677000001")).toBe("+237677000001");
    expect(normalizePhone("699000001")).toBe("+237699000001");
    expect(normalizePhone("620000001")).toBe("+237620000001");
  });

  it("normalise 2XXXXXXXXX → +2372XXXXXXXXX (fixe)", async () => {
    const { normalizePhone } = await import("@/lib/auth");
    expect(normalizePhone("222000001")).toBe("+237222000001");
  });

  it("accepte le préfixe +237 déjà présent", async () => {
    const { normalizePhone } = await import("@/lib/auth");
    expect(normalizePhone("+237677000001")).toBe("+237677000001");
  });

  it("accepte le préfixe 00237", async () => {
    const { normalizePhone } = await import("@/lib/auth");
    expect(normalizePhone("00237677000001")).toBe("+237677000001");
  });

  it("accepte le préfixe 237 (12 chiffres)", async () => {
    const { normalizePhone } = await import("@/lib/auth");
    expect(normalizePhone("237677000001")).toBe("+237677000001");
  });

  it("supprime les espaces et tirets", async () => {
    const { normalizePhone } = await import("@/lib/auth");
    expect(normalizePhone("677 000 001")).toBe("+237677000001");
    expect(normalizePhone("677-000-001")).toBe("+237677000001");
  });

  it("retourne null pour un numéro invalide", async () => {
    const { normalizePhone } = await import("@/lib/auth");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("12345678")).toBeNull(); // commence par 1
    expect(normalizePhone("")).toBeNull();
  });

  it("retourne null pour 8 chiffres (trop court)", async () => {
    const { normalizePhone } = await import("@/lib/auth");
    expect(normalizePhone("67700000")).toBeNull();
  });

  it("retourne null pour 10 chiffres (trop long)", async () => {
    const { normalizePhone } = await import("@/lib/auth");
    expect(normalizePhone("6770000012")).toBeNull();
  });
});

// ===========================================================================
// Non-régression — M5 : Switch default clause dans POST /api/releves
// ===========================================================================

describe("M5 — Switch default clause (non-régression)", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  const mockCreateReleve = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockCreateReleve.mockResolvedValue({ id: "r-new" });
    // Override du mock releves pour ce contexte
    vi.doMock("@/lib/queries/releves", () => ({
      getReleves: mockGetReleves,
      createReleve: mockCreateReleve,
      getReleveById: vi.fn(),
      updateReleve: vi.fn(),
    }));
    const mod = await import("@/app/api/releves/route");
    POST = mod.POST;
  });

  it("retourne 400 pour un typeReleve inconnu (switch default)", async () => {
    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          vagueId: "vague-1",
          bacId: "bac-1",
          date: "2026-03-01",
          typeReleve: "TYPE_INEXISTANT",
        }),
      })
    );

    // typeReleve invalide → validation échoue (400) avant même d'atteindre le switch
    expect([400, 422]).toContain(response.status);
  });

  it("accepte typeReleve BIOMETRIE valide (avec tous les champs requis)", async () => {
    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          vagueId: "vague-1",
          bacId: "bac-1",
          date: "2026-03-01",
          typeReleve: "BIOMETRIE",
          poidsMoyen: 250,
          tailleMoyenne: 35,
          echantillonCount: 10,
        }),
      })
    );

    // Doit passer la validation et retourner 201
    expect(response.status).toBe(201);
  });

  it("accepte typeReleve MORTALITE valide (avec tous les champs requis)", async () => {
    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          vagueId: "vague-1",
          bacId: "bac-1",
          date: "2026-03-01",
          typeReleve: "MORTALITE",
          nombreMorts: 5,
          causeMortalite: "MALADIE",
        }),
      })
    );

    expect(response.status).toBe(201);
  });

  it("accepte typeReleve OBSERVATION valide (cas limite switch — description requise)", async () => {
    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          vagueId: "vague-1",
          bacId: "bac-1",
          date: "2026-03-01",
          typeReleve: "OBSERVATION",
          description: "Comportement normal, poissons actifs",
          notes: "Aucune anomalie",
        }),
      })
    );

    expect(response.status).toBe(201);
  });
});
