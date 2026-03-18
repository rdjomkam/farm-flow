import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GET as GET_FACTURE,
  POST as POST_FACTURE,
  DELETE as DELETE_FACTURE,
} from "@/app/api/commandes/[id]/facture/route";
import { POST as POST_RECEVOIR } from "@/app/api/commandes/[id]/recevoir/route";
import { NextRequest } from "next/server";
import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaCommandeFindFirst = vi.fn();
const mockPrismaCommandeUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    commande: {
      findFirst: (...args: unknown[]) => mockPrismaCommandeFindFirst(...args),
      updateMany: (...args: unknown[]) => mockPrismaCommandeUpdateMany(...args),
    },
  },
}));

const mockUploadFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockGetSignedUrl = vi.fn();
const mockValidateFile = vi.fn();
const mockGenerateStorageKey = vi.fn();
const mockExtractFileNameFromKey = vi.fn();

vi.mock("@/lib/storage", () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
  validateFile: (...args: unknown[]) => mockValidateFile(...args),
  generateStorageKey: (...args: unknown[]) => mockGenerateStorageKey(...args),
  extractFileNameFromKey: (...args: unknown[]) => mockExtractFileNameFromKey(...args),
}));

const mockRecevoirCommande = vi.fn();

vi.mock("@/lib/queries/commandes", () => ({
  recevoirCommande: (...args: unknown[]) => mockRecevoirCommande(...args),
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
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-1",
  siteRole: "PISCICULTEUR",
  permissions: [Permission.APPROVISIONNEMENT_VOIR, Permission.APPROVISIONNEMENT_GERER],
};

const FAKE_COMMANDE_SANS_FACTURE = {
  id: "cmd-1",
  factureUrl: null,
  siteId: "site-1",
};

const FAKE_COMMANDE_AVEC_FACTURE = {
  id: "cmd-1",
  factureUrl: "factures/cmd-1/1736870400000-facture.pdf",
  siteId: "site-1",
};

const FAKE_KEY = "factures/cmd-1/1736870400000-facture.pdf";
const FAKE_SIGNED_URL = "https://storage.hetzner.com/signed/facture.pdf?token=abc123";
const FAKE_FILE_NAME = "facture.pdf";

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

/** Crée un mock FormData avec un fichier */
function makeFormDataRequest(url: string, fileName: string, mimeType: string, sizeKb = 100) {
  const fileContent = new Uint8Array(sizeKb * 1024);
  const file = new File([fileContent], fileName, { type: mimeType });
  const formData = new FormData();
  formData.set("file", file);

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    body: formData,
  });
}

// ---------------------------------------------------------------------------
// POST /api/commandes/[id]/facture
// ---------------------------------------------------------------------------
describe("POST /api/commandes/[id]/facture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockValidateFile.mockImplementation(() => {/* no throw = valid */});
    mockGenerateStorageKey.mockReturnValue(FAKE_KEY);
    mockUploadFile.mockResolvedValue(FAKE_KEY);
    mockPrismaCommandeUpdateMany.mockResolvedValue({ count: 1 });
    mockGetSignedUrl.mockResolvedValue(FAKE_SIGNED_URL);
    mockExtractFileNameFromKey.mockReturnValue(FAKE_FILE_NAME);
    mockPrismaCommandeFindFirst.mockResolvedValue(FAKE_COMMANDE_SANS_FACTURE);
  });

  it("retourne 201 et signed URL apres upload PDF", async () => {
    const req = makeFormDataRequest("/api/commandes/cmd-1/facture", "facture.pdf", "application/pdf");
    const response = await POST_FACTURE(req, { params: Promise.resolve({ id: "cmd-1" }) });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.url).toBe(FAKE_SIGNED_URL);
    expect(data.fileName).toBe(FAKE_FILE_NAME);
    expect(mockUploadFile).toHaveBeenCalled();
    expect(mockPrismaCommandeUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { factureUrl: FAKE_KEY } })
    );
  });

  it("retourne 201 apres upload JPG", async () => {
    const req = makeFormDataRequest("/api/commandes/cmd-1/facture", "photo.jpg", "image/jpeg");
    const response = await POST_FACTURE(req, { params: Promise.resolve({ id: "cmd-1" }) });
    expect(response.status).toBe(201);
  });

  it("retourne 201 apres upload PNG", async () => {
    const req = makeFormDataRequest("/api/commandes/cmd-1/facture", "scan.png", "image/png");
    const response = await POST_FACTURE(req, { params: Promise.resolve({ id: "cmd-1" }) });
    expect(response.status).toBe(201);
  });

  it("retourne 400 si type MIME invalide", async () => {
    mockValidateFile.mockImplementation(() => {
      throw new Error("Type de fichier non autorise : application/octet-stream.");
    });

    const req = makeFormDataRequest("/api/commandes/cmd-1/facture", "virus.exe", "application/octet-stream");
    const response = await POST_FACTURE(req, { params: Promise.resolve({ id: "cmd-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("Type de fichier non autorise");
  });

  it("retourne 400 si fichier trop volumineux (> 10 Mo)", async () => {
    mockValidateFile.mockImplementation(() => {
      throw new Error("Fichier trop volumineux : 11.0 Mo. La taille maximum est 10 Mo.");
    });

    const req = makeFormDataRequest("/api/commandes/cmd-1/facture", "facture-grande.pdf", "application/pdf", 11 * 1024);
    const response = await POST_FACTURE(req, { params: Promise.resolve({ id: "cmd-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toContain("trop volumineux");
  });

  it("retourne 400 si champ file manquant", async () => {
    const formData = new FormData();
    formData.set("autreChamp", "valeur");
    const req = new NextRequest(new URL("/api/commandes/cmd-1/facture", "http://localhost:3000"), {
      method: "POST",
      body: formData,
    });

    const response = await POST_FACTURE(req, { params: Promise.resolve({ id: "cmd-1" }) });
    expect(response.status).toBe(400);
  });

  it("retourne 404 si commande introuvable", async () => {
    mockPrismaCommandeFindFirst.mockResolvedValue(null);

    const req = makeFormDataRequest("/api/commandes/xxx/facture", "facture.pdf", "application/pdf");
    const response = await POST_FACTURE(req, { params: Promise.resolve({ id: "xxx" }) });
    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const req = makeFormDataRequest("/api/commandes/cmd-1/facture", "facture.pdf", "application/pdf");
    const response = await POST_FACTURE(req, { params: Promise.resolve({ id: "cmd-1" }) });
    expect(response.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const req = makeFormDataRequest("/api/commandes/cmd-1/facture", "facture.pdf", "application/pdf");
    const response = await POST_FACTURE(req, { params: Promise.resolve({ id: "cmd-1" }) });
    expect(response.status).toBe(403);
  });

  it("supprime l'ancienne facture avant l'upload si une existe", async () => {
    mockPrismaCommandeFindFirst.mockResolvedValue(FAKE_COMMANDE_AVEC_FACTURE);
    mockDeleteFile.mockResolvedValue(undefined);

    const req = makeFormDataRequest("/api/commandes/cmd-1/facture", "nouvelle.pdf", "application/pdf");
    await POST_FACTURE(req, { params: Promise.resolve({ id: "cmd-1" }) });

    expect(mockDeleteFile).toHaveBeenCalledWith(FAKE_COMMANDE_AVEC_FACTURE.factureUrl);
  });
});

// ---------------------------------------------------------------------------
// GET /api/commandes/[id]/facture
// ---------------------------------------------------------------------------
describe("GET /api/commandes/[id]/facture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockGetSignedUrl.mockResolvedValue(FAKE_SIGNED_URL);
    mockExtractFileNameFromKey.mockReturnValue(FAKE_FILE_NAME);
  });

  it("retourne 200 avec une signed URL valide", async () => {
    mockPrismaCommandeFindFirst.mockResolvedValue(FAKE_COMMANDE_AVEC_FACTURE);

    const response = await GET_FACTURE(
      makeRequest("/api/commandes/cmd-1/facture"),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toBe(FAKE_SIGNED_URL);
    expect(data.fileName).toBe(FAKE_FILE_NAME);
    expect(mockGetSignedUrl).toHaveBeenCalledWith(FAKE_COMMANDE_AVEC_FACTURE.factureUrl);
  });

  it("retourne 404 si commande introuvable", async () => {
    mockPrismaCommandeFindFirst.mockResolvedValue(null);

    const response = await GET_FACTURE(
      makeRequest("/api/commandes/xxx/facture"),
      { params: Promise.resolve({ id: "xxx" }) }
    );
    expect(response.status).toBe(404);
  });

  it("retourne 404 si pas de facture attachee", async () => {
    mockPrismaCommandeFindFirst.mockResolvedValue(FAKE_COMMANDE_SANS_FACTURE);

    const response = await GET_FACTURE(
      makeRequest("/api/commandes/cmd-1/facture"),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    expect(response.status).toBe(404);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await GET_FACTURE(
      makeRequest("/api/commandes/cmd-1/facture"),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/commandes/[id]/facture
// ---------------------------------------------------------------------------
describe("DELETE /api/commandes/[id]/facture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    mockDeleteFile.mockResolvedValue(undefined);
    mockPrismaCommandeUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("retourne 200 et supprime le fichier + met factureUrl a null en DB", async () => {
    mockPrismaCommandeFindFirst.mockResolvedValue(FAKE_COMMANDE_AVEC_FACTURE);

    const response = await DELETE_FACTURE(
      makeRequest("/api/commandes/cmd-1/facture", { method: "DELETE" }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteFile).toHaveBeenCalledWith(FAKE_COMMANDE_AVEC_FACTURE.factureUrl);
    expect(mockPrismaCommandeUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { factureUrl: null } })
    );
  });

  it("retourne 404 si commande introuvable", async () => {
    mockPrismaCommandeFindFirst.mockResolvedValue(null);

    const response = await DELETE_FACTURE(
      makeRequest("/api/commandes/xxx/facture", { method: "DELETE" }),
      { params: Promise.resolve({ id: "xxx" }) }
    );
    expect(response.status).toBe(404);
  });

  it("retourne 404 si pas de facture a supprimer", async () => {
    mockPrismaCommandeFindFirst.mockResolvedValue(FAKE_COMMANDE_SANS_FACTURE);

    const response = await DELETE_FACTURE(
      makeRequest("/api/commandes/cmd-1/facture", { method: "DELETE" }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    expect(response.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non authentifie"));

    const response = await DELETE_FACTURE(
      makeRequest("/api/commandes/cmd-1/facture", { method: "DELETE" }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/commandes/[id]/recevoir — Tests Sprint 15 (FormData avec fichier)
// ---------------------------------------------------------------------------
describe("POST /api/commandes/[id]/recevoir — avec fichier facture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
    // Sprint 16: recevoirCommande retourne { commande, depense }
    mockRecevoirCommande.mockResolvedValue({ commande: { id: "cmd-1", statut: "LIVREE" }, depense: null });
    mockValidateFile.mockImplementation(() => {/* no throw = valid */});
    mockGenerateStorageKey.mockReturnValue(FAKE_KEY);
    mockUploadFile.mockResolvedValue(FAKE_KEY);
    mockPrismaCommandeUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("retourne 200 si JSON sans fichier (comportement inchange)", async () => {
    const response = await POST_RECEVOIR(
      makeRequest("/api/commandes/cmd-1/recevoir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateLivraison: "2026-03-15" }),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockRecevoirCommande).toHaveBeenCalledWith("cmd-1", "site-1", "user-1", "2026-03-15");
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it("retourne 200 si FormData avec fichier — upload effectue", async () => {
    const file = new File([new Uint8Array(100)], "facture.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.set("dateLivraison", "2026-03-15");
    formData.set("file", file);

    const req = new NextRequest(new URL("/api/commandes/cmd-1/recevoir", "http://localhost:3000"), {
      method: "POST",
      body: formData,
    });

    const response = await POST_RECEVOIR(req, { params: Promise.resolve({ id: "cmd-1" }) });
    expect(response.status).toBe(200);
    expect(mockRecevoirCommande).toHaveBeenCalled();
    expect(mockUploadFile).toHaveBeenCalled();
  });

  it("retourne 200 si FormData sans fichier — pas d'upload", async () => {
    const formData = new FormData();
    formData.set("dateLivraison", "2026-03-15");

    const req = new NextRequest(new URL("/api/commandes/cmd-1/recevoir", "http://localhost:3000"), {
      method: "POST",
      body: formData,
    });

    const response = await POST_RECEVOIR(req, { params: Promise.resolve({ id: "cmd-1" }) });
    expect(response.status).toBe(200);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it("retourne 400 si fichier invalide dans FormData", async () => {
    mockValidateFile.mockImplementation(() => {
      throw new Error("Type de fichier non autorise.");
    });

    const file = new File([new Uint8Array(100)], "virus.exe", { type: "application/octet-stream" });
    const formData = new FormData();
    formData.set("file", file);

    const req = new NextRequest(new URL("/api/commandes/cmd-1/recevoir", "http://localhost:3000"), {
      method: "POST",
      body: formData,
    });

    const response = await POST_RECEVOIR(req, { params: Promise.resolve({ id: "cmd-1" }) });
    expect(response.status).toBe(400);
    expect(mockRecevoirCommande).not.toHaveBeenCalled();
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Acces refuse"));

    const response = await POST_RECEVOIR(
      makeRequest("/api/commandes/cmd-1/recevoir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "cmd-1" }) }
    );
    expect(response.status).toBe(403);
  });
});
