import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/releves/route";
import { POST as POST_PRODUIT } from "@/app/api/produits/route";
import { NextRequest } from "next/server";
import { Permission, TailleGranule, FormeAliment, CategorieProduit, UniteStock } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreateReleve = vi.fn();

vi.mock("@/lib/queries/releves", () => ({
  getReleves: vi.fn(),
  createReleve: (...args: unknown[]) => mockCreateReleve(...args),
  getReleveById: vi.fn(),
  updateReleve: vi.fn(),
}));

const mockCreateProduit = vi.fn();

vi.mock("@/lib/queries/produits", () => ({
  getProduits: vi.fn(),
  createProduit: (...args: unknown[]) => mockCreateProduit(...args),
  getProduitById: vi.fn(),
  updateProduit: vi.fn(),
  deleteProduit: vi.fn(),
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

vi.mock("@/lib/db", () => ({
  prisma: {
    vague: { findFirst: vi.fn().mockResolvedValue(null) },
    produit: { findMany: vi.fn().mockResolvedValue([]) },
    regleActivite: { findMany: vi.fn().mockResolvedValue([]) },
    activite: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/activity-engine", () => ({
  buildEvaluationContext: vi.fn(),
  evaluateRules: vi.fn().mockReturnValue([]),
  generateActivities: vi.fn().mockResolvedValue(undefined),
}));

const AUTH_CONTEXT_RELEVES = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  permissions: [Permission.RELEVES_VOIR, Permission.RELEVES_CREER],
};

const AUTH_CONTEXT_STOCK = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  permissions: [Permission.STOCK_VOIR, Permission.STOCK_GERER],
};

function makeReleveRequest(body: unknown) {
  return new NextRequest(new URL("/api/releves", "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeProduitRequest(body: unknown) {
  return new NextRequest(new URL("/api/produits", "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Corps de base pour un releve ALIMENTATION valide
const validAlimentationBase = {
  typeReleve: "ALIMENTATION",
  vagueId: "vague-1",
  bacId: "bac-1",
  quantiteAliment: 2.5,
  typeAliment: "COMMERCIAL",
  frequenceAliment: 2,
};

// Corps de base pour un produit valide de categorie ALIMENT
const validProduitBase = {
  nom: "Aliment Croissance 3mm",
  categorie: CategorieProduit.ALIMENT,
  unite: UniteStock.KG,
  prixUnitaire: 1200,
  seuilAlerte: 20,
};

// ---------------------------------------------------------------------------
// Tests FA — POST /api/releves : validation tauxRefus
// ---------------------------------------------------------------------------

describe("POST /api/releves — FA : validation tauxRefus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_RELEVES);
  });

  it("retourne 400 si tauxRefus=37 (valeur hors liste blanche {0,10,25,50})", async () => {
    const body = { ...validAlimentationBase, tauxRefus: 37 };
    const response = await POST(makeReleveRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxRefus")
    ).toBe(true);
  });

  it("retourne 400 si tauxRefus=100 (hors liste blanche)", async () => {
    const body = { ...validAlimentationBase, tauxRefus: 100 };
    const response = await POST(makeReleveRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxRefus")
    ).toBe(true);
  });

  it("retourne 400 si tauxRefus=25 avec typeReleve=BIOMETRIE (guard non-ALIMENTATION)", async () => {
    const body = {
      typeReleve: "BIOMETRIE",
      vagueId: "vague-1",
      bacId: "bac-1",
      poidsMoyen: 52.3,
      echantillonCount: 25,
      tauxRefus: 25,
    };
    const response = await POST(makeReleveRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxRefus")
    ).toBe(true);
  });

  it("retourne 400 si tauxRefus fourni avec typeReleve=MORTALITE", async () => {
    const body = {
      typeReleve: "MORTALITE",
      vagueId: "vague-1",
      bacId: "bac-1",
      nombreMorts: 3,
      causeMortalite: "MALADIE",
      tauxRefus: 25,
    };
    const response = await POST(makeReleveRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxRefus")
    ).toBe(true);
  });

  it("accepte tauxRefus=25 avec typeReleve=ALIMENTATION (valeur valide)", async () => {
    const body = { ...validAlimentationBase, tauxRefus: 25 };
    mockCreateReleve.mockResolvedValue({ id: "rel-fa-1", ...body });

    const response = await POST(makeReleveRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte tauxRefus=0 avec typeReleve=ALIMENTATION (valeur limite basse)", async () => {
    const body = { ...validAlimentationBase, tauxRefus: 0 };
    mockCreateReleve.mockResolvedValue({ id: "rel-fa-2", ...body });

    const response = await POST(makeReleveRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte tauxRefus=50 avec typeReleve=ALIMENTATION (valeur limite haute)", async () => {
    const body = { ...validAlimentationBase, tauxRefus: 50 };
    mockCreateReleve.mockResolvedValue({ id: "rel-fa-3", ...body });

    const response = await POST(makeReleveRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte un releve ALIMENTATION sans tauxRefus (champ optionnel)", async () => {
    mockCreateReleve.mockResolvedValue({ id: "rel-fa-4", ...validAlimentationBase });

    const response = await POST(makeReleveRequest(validAlimentationBase));

    expect(response.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// Tests FA — POST /api/releves : validation comportementAlim
// ---------------------------------------------------------------------------

describe("POST /api/releves — FA : validation comportementAlim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_RELEVES);
  });

  it("retourne 400 si comportementAlim invalide pour ALIMENTATION", async () => {
    const body = { ...validAlimentationBase, comportementAlim: "AGRESSIF" };
    const response = await POST(makeReleveRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "comportementAlim")
    ).toBe(true);
  });

  it("retourne 400 si comportementAlim fourni avec typeReleve=BIOMETRIE", async () => {
    const body = {
      typeReleve: "BIOMETRIE",
      vagueId: "vague-1",
      bacId: "bac-1",
      poidsMoyen: 52.3,
      echantillonCount: 25,
      comportementAlim: "VORACE",
    };
    const response = await POST(makeReleveRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "comportementAlim")
    ).toBe(true);
  });

  it("accepte comportementAlim=VORACE avec typeReleve=ALIMENTATION", async () => {
    const body = { ...validAlimentationBase, comportementAlim: "VORACE" };
    mockCreateReleve.mockResolvedValue({ id: "rel-fa-5", ...body });

    const response = await POST(makeReleveRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte comportementAlim=REFUSE avec typeReleve=ALIMENTATION", async () => {
    const body = { ...validAlimentationBase, comportementAlim: "REFUSE" };
    mockCreateReleve.mockResolvedValue({ id: "rel-fa-6", ...body });

    const response = await POST(makeReleveRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte tauxRefus=25 + comportementAlim=NORMAL ensemble (releve complet)", async () => {
    const body = {
      ...validAlimentationBase,
      tauxRefus: 25,
      comportementAlim: "NORMAL",
    };
    mockCreateReleve.mockResolvedValue({ id: "rel-fa-7", ...body });

    const response = await POST(makeReleveRequest(body));

    expect(response.status).toBe(201);
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({
        tauxRefus: 25,
        comportementAlim: "NORMAL",
      }),
      undefined
    );
  });
});

// ---------------------------------------------------------------------------
// Tests FA — POST /api/produits : validation champs analytiques
// ---------------------------------------------------------------------------

describe("POST /api/produits — FA : validation tailleGranule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_STOCK);
  });

  it("retourne 400 si tailleGranule='INVALID' (valeur inexistante dans l'enum)", async () => {
    const body = { ...validProduitBase, tailleGranule: "INVALID" };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tailleGranule")
    ).toBe(true);
  });

  it("retourne 400 si tailleGranule='GROS' (valeur inexistante)", async () => {
    const body = { ...validProduitBase, tailleGranule: "GROS" };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tailleGranule")
    ).toBe(true);
  });

  it("accepte tailleGranule=P1 (valeur valide)", async () => {
    const body = { ...validProduitBase, tailleGranule: TailleGranule.P1 };
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-1", ...body });

    const response = await POST_PRODUIT(makeProduitRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte tailleGranule=G3 (valeur valide)", async () => {
    const body = { ...validProduitBase, tailleGranule: TailleGranule.G3 };
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-2", ...body });

    const response = await POST_PRODUIT(makeProduitRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte un produit sans tailleGranule (champ optionnel)", async () => {
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-3", ...validProduitBase });

    const response = await POST_PRODUIT(makeProduitRequest(validProduitBase));

    expect(response.status).toBe(201);
  });
});

describe("POST /api/produits — FA : validation formeAliment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_STOCK);
  });

  it("retourne 400 si formeAliment='INVALID' (valeur inexistante dans l'enum)", async () => {
    const body = { ...validProduitBase, formeAliment: "INVALID" };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "formeAliment")
    ).toBe(true);
  });

  it("retourne 400 si formeAliment='LIQUIDE' (valeur inexistante)", async () => {
    const body = { ...validProduitBase, formeAliment: "LIQUIDE" };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "formeAliment")
    ).toBe(true);
  });

  it("accepte formeAliment=FLOTTANT (valeur valide)", async () => {
    const body = { ...validProduitBase, formeAliment: FormeAliment.FLOTTANT };
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-4", ...body });

    const response = await POST_PRODUIT(makeProduitRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte formeAliment=COULANT (valeur valide)", async () => {
    const body = { ...validProduitBase, formeAliment: FormeAliment.COULANT };
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-5", ...body });

    const response = await POST_PRODUIT(makeProduitRequest(body));

    expect(response.status).toBe(201);
  });
});

describe("POST /api/produits — FA : validation tauxProteines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_STOCK);
  });

  it("retourne 400 si tauxProteines=-5 (valeur negative)", async () => {
    const body = { ...validProduitBase, tauxProteines: -5 };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxProteines")
    ).toBe(true);
  });

  it("retourne 400 si tauxProteines=150 (superieur a 100)", async () => {
    const body = { ...validProduitBase, tauxProteines: 150 };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxProteines")
    ).toBe(true);
  });

  it("retourne 400 si tauxProteines=101 (hors plage 0-100)", async () => {
    const body = { ...validProduitBase, tauxProteines: 101 };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxProteines")
    ).toBe(true);
  });

  it("accepte tauxProteines=0 (valeur limite basse valide)", async () => {
    const body = { ...validProduitBase, tauxProteines: 0 };
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-6", ...body });

    const response = await POST_PRODUIT(makeProduitRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte tauxProteines=100 (valeur limite haute valide)", async () => {
    const body = { ...validProduitBase, tauxProteines: 100 };
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-7", ...body });

    const response = await POST_PRODUIT(makeProduitRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte tauxProteines=35 (valeur typique)", async () => {
    const body = { ...validProduitBase, tauxProteines: 35 };
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-8", ...body });

    const response = await POST_PRODUIT(makeProduitRequest(body));

    expect(response.status).toBe(201);
  });

  it("accepte un produit sans tauxProteines (champ optionnel)", async () => {
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-9", ...validProduitBase });

    const response = await POST_PRODUIT(makeProduitRequest(validProduitBase));

    expect(response.status).toBe(201);
  });
});

describe("POST /api/produits — FA : validation tauxLipides et tauxFibres", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_STOCK);
  });

  it("retourne 400 si tauxLipides negatif", async () => {
    const body = { ...validProduitBase, tauxLipides: -1 };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxLipides")
    ).toBe(true);
  });

  it("retourne 400 si tauxLipides > 100", async () => {
    const body = { ...validProduitBase, tauxLipides: 110 };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxLipides")
    ).toBe(true);
  });

  it("retourne 400 si tauxFibres negatif", async () => {
    const body = { ...validProduitBase, tauxFibres: -0.5 };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxFibres")
    ).toBe(true);
  });

  it("retourne 400 si tauxFibres > 100", async () => {
    const body = { ...validProduitBase, tauxFibres: 200 };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxFibres")
    ).toBe(true);
  });
});

describe("POST /api/produits — FA : validation phasesCibles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_STOCK);
  });

  it("retourne 400 si phasesCibles n'est pas un tableau", async () => {
    const body = { ...validProduitBase, phasesCibles: "ALEVINAGE" };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "phasesCibles")
    ).toBe(true);
  });

  it("retourne 400 si phasesCibles contient des valeurs invalides", async () => {
    const body = { ...validProduitBase, phasesCibles: ["ALEVINAGE", "PHASE_INCONNUE"] };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(
      data.errors.some((e: { field: string }) => e.field === "phasesCibles")
    ).toBe(true);
  });

  it("accepte phasesCibles comme tableau vide", async () => {
    const body = { ...validProduitBase, phasesCibles: [] };
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-10", ...body });

    const response = await POST_PRODUIT(makeProduitRequest(body));

    expect(response.status).toBe(201);
  });
});

describe("POST /api/produits — FA : combinaison de champs analytiques valides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT_STOCK);
  });

  it("accepte un produit avec tailleGranule, formeAliment et tauxProteines valides", async () => {
    const body = {
      ...validProduitBase,
      tailleGranule: TailleGranule.P2,
      formeAliment: FormeAliment.FLOTTANT,
      tauxProteines: 42,
    };
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-11", ...body });

    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockCreateProduit).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({
        tailleGranule: TailleGranule.P2,
        formeAliment: FormeAliment.FLOTTANT,
        tauxProteines: 42,
      })
    );
  });

  it("accepte un produit avec tous les champs analytiques valides", async () => {
    const body = {
      ...validProduitBase,
      tailleGranule: TailleGranule.G2,
      formeAliment: FormeAliment.SEMI_FLOTTANT,
      tauxProteines: 38,
      tauxLipides: 8,
      tauxFibres: 5,
    };
    mockCreateProduit.mockResolvedValue({ id: "prod-fa-12", ...body });

    const response = await POST_PRODUIT(makeProduitRequest(body));

    expect(response.status).toBe(201);
  });

  it("retourne plusieurs erreurs si tailleGranule et formeAliment sont tous invalides", async () => {
    const body = {
      ...validProduitBase,
      tailleGranule: "INVALID",
      formeAliment: "INVALID",
      tauxProteines: -5,
    };
    const response = await POST_PRODUIT(makeProduitRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors.length).toBeGreaterThanOrEqual(3);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tailleGranule")
    ).toBe(true);
    expect(
      data.errors.some((e: { field: string }) => e.field === "formeAliment")
    ).toBe(true);
    expect(
      data.errors.some((e: { field: string }) => e.field === "tauxProteines")
    ).toBe(true);
  });
});
