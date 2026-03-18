/**
 * Tests Sprint 23 — API Notes Ingenieur
 *
 * Couvre :
 *   GET  /api/ingenieur/notes    — liste avec filtres, permission ENVOYER_NOTES
 *   POST /api/ingenieur/notes    — creation, validation des champs obligatoires
 *   GET  /api/ingenieur/notes/[id] — detail note
 *   PUT  /api/ingenieur/notes/[id] — mise a jour partielle
 *
 * Regles testees :
 *   - Permission ENVOYER_NOTES requise sur toutes les routes
 *   - Visibilite PUBLIC / INTERNE
 *   - Validation : titre, contenu, visibility, clientSiteId obligatoires (POST)
 *   - Mise a jour partielle (PUT) : seuls les champs fournis sont valides
 *   - Note non trouvee → 404
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as GET_NOTES, POST as POST_NOTE } from "@/app/api/ingenieur/notes/route";
import {
  GET as GET_NOTE_BY_ID,
  PUT as PUT_NOTE,
} from "@/app/api/ingenieur/notes/[id]/route";
import { NextRequest } from "next/server";
import { Permission, VisibiliteNote } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetNotes = vi.fn();
const mockGetNoteById = vi.fn();
const mockCreateNote = vi.fn();
const mockUpdateNote = vi.fn();
const mockMarkNoteRead = vi.fn();
const mockMarkThreadRepliesRead = vi.fn();

vi.mock("@/lib/queries/notes", () => ({
  getNotes: (...args: unknown[]) => mockGetNotes(...args),
  getNoteById: (...args: unknown[]) => mockGetNoteById(...args),
  createNote: (...args: unknown[]) => mockCreateNote(...args),
  updateNote: (...args: unknown[]) => mockUpdateNote(...args),
  markNoteRead: (...args: unknown[]) => mockMarkNoteRead(...args),
  markThreadRepliesRead: (...args: unknown[]) => mockMarkThreadRepliesRead(...args),
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

const AUTH_INGENIEUR = {
  userId: "user-ingenieur-1",
  email: "ingenieur@dkfarm.cm",
  phone: null,
  name: "Ingenieur DKFarm",
  globalRole: "INGENIEUR",
  activeSiteId: "site-dkfarm",
  siteRole: "INGENIEUR",
  permissions: [Permission.ENVOYER_NOTES],
};

const FAKE_NOTE_PUBLIC = {
  id: "note-pub-1",
  titre: "Rapport hebdomadaire",
  contenu: "Tout va bien cette semaine.",
  visibility: VisibiliteNote.PUBLIC,
  isUrgent: false,
  isRead: false,
  isFromClient: false,
  observationTexte: null,
  ingenieurId: "user-ingenieur-1",
  clientSiteId: "site-client-1",
  vagueId: null,
  siteId: "site-dkfarm",
  createdAt: new Date("2026-03-10"),
  updatedAt: new Date("2026-03-10"),
};

const FAKE_NOTE_INTERNE = {
  ...FAKE_NOTE_PUBLIC,
  id: "note-int-1",
  titre: "Note interne confidentielle",
  visibility: VisibiliteNote.INTERNE,
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function makeJsonRequest(url: string, body: unknown, method = "POST") {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// GET /api/ingenieur/notes
// ---------------------------------------------------------------------------

describe("GET /api/ingenieur/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_INGENIEUR);
  });

  it("retourne la liste des notes avec total", async () => {
    mockGetNotes.mockResolvedValue([FAKE_NOTE_PUBLIC, FAKE_NOTE_INTERNE]);

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes");
    const res = await GET_NOTES(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it("passe le siteId de l'ingenieur a getNotes", async () => {
    mockGetNotes.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes");
    await GET_NOTES(req);

    expect(mockGetNotes).toHaveBeenCalledWith("site-dkfarm", expect.any(Object));
  });

  it("filtre par clientSiteId si fourni en query", async () => {
    mockGetNotes.mockResolvedValue([FAKE_NOTE_PUBLIC]);

    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/notes?clientSiteId=site-client-1"
    );
    await GET_NOTES(req);

    expect(mockGetNotes).toHaveBeenCalledWith(
      "site-dkfarm",
      expect.objectContaining({ clientSiteId: "site-client-1" })
    );
  });

  it("filtre par visibility=PUBLIC si fourni en query", async () => {
    mockGetNotes.mockResolvedValue([FAKE_NOTE_PUBLIC]);

    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/notes?visibility=PUBLIC"
    );
    await GET_NOTES(req);

    expect(mockGetNotes).toHaveBeenCalledWith(
      "site-dkfarm",
      expect.objectContaining({ visibility: VisibiliteNote.PUBLIC })
    );
  });

  it("filtre par visibility=INTERNE si fourni en query", async () => {
    mockGetNotes.mockResolvedValue([FAKE_NOTE_INTERNE]);

    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/notes?visibility=INTERNE"
    );
    await GET_NOTES(req);

    expect(mockGetNotes).toHaveBeenCalledWith(
      "site-dkfarm",
      expect.objectContaining({ visibility: VisibiliteNote.INTERNE })
    );
  });

  it("retourne 400 si visibility invalide", async () => {
    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/notes?visibility=INVALIDE"
    );
    const res = await GET_NOTES(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("visibility");
  });

  it("filtre par isUrgent=true", async () => {
    mockGetNotes.mockResolvedValue([]);

    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/notes?isUrgent=true"
    );
    await GET_NOTES(req);

    expect(mockGetNotes).toHaveBeenCalledWith(
      "site-dkfarm",
      expect.objectContaining({ isUrgent: true })
    );
  });

  it("filtre par isRead=false (notes non lues)", async () => {
    mockGetNotes.mockResolvedValue([FAKE_NOTE_PUBLIC]);

    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/notes?isRead=false"
    );
    await GET_NOTES(req);

    expect(mockGetNotes).toHaveBeenCalledWith(
      "site-dkfarm",
      expect.objectContaining({ isRead: false })
    );
  });

  it("filtre par isFromClient=true (observations clients)", async () => {
    mockGetNotes.mockResolvedValue([]);

    const req = makeRequest(
      "http://localhost:3000/api/ingenieur/notes?isFromClient=true"
    );
    await GET_NOTES(req);

    expect(mockGetNotes).toHaveBeenCalledWith(
      "site-dkfarm",
      expect.objectContaining({ isFromClient: true })
    );
  });

  it("requiert la permission ENVOYER_NOTES", async () => {
    mockGetNotes.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes");
    await GET_NOTES(req);

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      Permission.ENVOYER_NOTES
    );
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non autorise"));

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes");
    const res = await GET_NOTES(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission ENVOYER_NOTES manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission insuffisante.")
    );

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes");
    const res = await GET_NOTES(req);

    expect(res.status).toBe(403);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockGetNotes.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes");
    const res = await GET_NOTES(req);

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/ingenieur/notes
// ---------------------------------------------------------------------------

describe("POST /api/ingenieur/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_INGENIEUR);
  });

  const validBody = {
    titre: "Conseil technique",
    contenu: "Augmenter la ration alimentaire de 10%.",
    visibility: VisibiliteNote.PUBLIC,
    clientSiteId: "site-client-1",
    isUrgent: false,
    isFromClient: false,
  };

  it("cree une note valide et retourne 201", async () => {
    mockCreateNote.mockResolvedValue({ ...FAKE_NOTE_PUBLIC, ...validBody });

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      validBody
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(201);
  });

  it("passe le siteId et userId de l'ingenieur a createNote", async () => {
    mockCreateNote.mockResolvedValue(FAKE_NOTE_PUBLIC);

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      validBody
    );
    await POST_NOTE(req);

    expect(mockCreateNote).toHaveBeenCalledWith(
      "site-dkfarm",
      "user-ingenieur-1",
      expect.any(Object)
    );
  });

  it("cree une note INTERNE sans erreur", async () => {
    const body = { ...validBody, visibility: VisibiliteNote.INTERNE };
    mockCreateNote.mockResolvedValue({ ...FAKE_NOTE_INTERNE, ...body });

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      body
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(201);
    expect(mockCreateNote).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ visibility: VisibiliteNote.INTERNE })
    );
  });

  it("cree une note urgente (isUrgent=true)", async () => {
    const body = { ...validBody, isUrgent: true };
    mockCreateNote.mockResolvedValue({ ...FAKE_NOTE_PUBLIC, isUrgent: true });

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      body
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(201);
    expect(mockCreateNote).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ isUrgent: true })
    );
  });

  it("cree une note avec vagueId optionnel", async () => {
    const body = { ...validBody, vagueId: "vague-abc" };
    mockCreateNote.mockResolvedValue({ ...FAKE_NOTE_PUBLIC, vagueId: "vague-abc" });

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      body
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(201);
    expect(mockCreateNote).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ vagueId: "vague-abc" })
    );
  });

  it("retourne 400 si titre manquant", async () => {
    const { titre: _titre, ...bodyWithoutTitre } = validBody;
    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      bodyWithoutTitre
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e: { field: string }) => e.field === "titre")).toBe(true);
  });

  it("retourne 400 si titre est une chaine vide", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      { ...validBody, titre: "   " }
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(400);
  });

  it("retourne 400 si contenu manquant", async () => {
    const { contenu: _contenu, ...bodyWithoutContenu } = validBody;
    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      bodyWithoutContenu
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e: { field: string }) => e.field === "contenu")).toBe(true);
  });

  it("retourne 400 si visibility manquante", async () => {
    const { visibility: _v, ...bodyWithoutVisibility } = validBody;
    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      bodyWithoutVisibility
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e: { field: string }) => e.field === "visibility")).toBe(true);
  });

  it("retourne 400 si visibility est invalide", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      { ...validBody, visibility: "INVALIDE" }
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e: { field: string }) => e.field === "visibility")).toBe(true);
  });

  it("retourne 400 si clientSiteId manquant", async () => {
    const { clientSiteId: _c, ...bodyWithoutClientSiteId } = validBody;
    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      bodyWithoutClientSiteId
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(
      data.errors.some((e: { field: string }) => e.field === "clientSiteId")
    ).toBe(true);
  });

  it("retourne plusieurs erreurs si plusieurs champs manquent", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      {}
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.length).toBeGreaterThan(1);
  });

  it("trimme le titre et le contenu avant de creer la note", async () => {
    const body = { ...validBody, titre: "  Titre  ", contenu: "  Contenu  " };
    mockCreateNote.mockResolvedValue(FAKE_NOTE_PUBLIC);

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      body
    );
    await POST_NOTE(req);

    expect(mockCreateNote).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ titre: "Titre", contenu: "Contenu" })
    );
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non autorise"));

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      validBody
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission ENVOYER_NOTES manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission insuffisante.")
    );

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      validBody
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(403);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockCreateNote.mockRejectedValue(new Error("DB error"));

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes",
      validBody
    );
    const res = await POST_NOTE(req);

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/ingenieur/notes/[id]
// ---------------------------------------------------------------------------

describe("GET /api/ingenieur/notes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_INGENIEUR);
    mockMarkThreadRepliesRead.mockResolvedValue(undefined);
  });

  it("retourne la note si elle existe", async () => {
    mockGetNoteById.mockResolvedValue(FAKE_NOTE_PUBLIC);

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes/note-pub-1");
    const res = await GET_NOTE_BY_ID(req, { params: Promise.resolve({ id: "note-pub-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("note-pub-1");
    expect(data.titre).toBe("Rapport hebdomadaire");
  });

  it("retourne 404 si la note n'existe pas", async () => {
    mockGetNoteById.mockResolvedValue(null);

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes/note-inconnu");
    const res = await GET_NOTE_BY_ID(req, { params: Promise.resolve({ id: "note-inconnu" }) });

    expect(res.status).toBe(404);
  });

  it("passe l'id et le siteId de l'ingenieur a getNoteById", async () => {
    mockGetNoteById.mockResolvedValue(FAKE_NOTE_PUBLIC);

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes/note-pub-1");
    await GET_NOTE_BY_ID(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(mockGetNoteById).toHaveBeenCalledWith("note-pub-1", "site-dkfarm");
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non autorise"));

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes/note-pub-1");
    const res = await GET_NOTE_BY_ID(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission insuffisante.")
    );

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes/note-pub-1");
    const res = await GET_NOTE_BY_ID(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(403);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockGetNoteById.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/ingenieur/notes/note-pub-1");
    const res = await GET_NOTE_BY_ID(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/ingenieur/notes/[id]
// ---------------------------------------------------------------------------

describe("PUT /api/ingenieur/notes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_INGENIEUR);
    mockMarkNoteRead.mockResolvedValue(true);
  });

  it("met a jour le titre seul", async () => {
    const updated = { ...FAKE_NOTE_PUBLIC, titre: "Nouveau titre" };
    mockUpdateNote.mockResolvedValue(updated);

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes/note-pub-1",
      { titre: "Nouveau titre" },
      "PUT"
    );
    const res = await PUT_NOTE(req, { params: Promise.resolve({ id: "note-pub-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.titre).toBe("Nouveau titre");
  });

  it("met a jour la visibilite de PUBLIC vers INTERNE", async () => {
    const updated = { ...FAKE_NOTE_PUBLIC, visibility: VisibiliteNote.INTERNE };
    mockUpdateNote.mockResolvedValue(updated);

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes/note-pub-1",
      { visibility: VisibiliteNote.INTERNE },
      "PUT"
    );
    const res = await PUT_NOTE(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(200);
    expect(mockUpdateNote).toHaveBeenCalledWith(
      "note-pub-1",
      "site-dkfarm",
      expect.objectContaining({ visibility: VisibiliteNote.INTERNE })
    );
  });

  it("marque la note comme lue (isRead=true)", async () => {
    mockMarkNoteRead.mockResolvedValue(true);

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes/note-pub-1",
      { isRead: true },
      "PUT"
    );
    const res = await PUT_NOTE(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(200);
    expect(mockMarkNoteRead).toHaveBeenCalledWith("note-pub-1", "user-ingenieur-1");
  });

  it("retourne 400 si titre fourni mais vide", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes/note-pub-1",
      { titre: "" },
      "PUT"
    );
    const res = await PUT_NOTE(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e: { field: string }) => e.field === "titre")).toBe(true);
  });

  it("retourne 400 si visibility fournie mais invalide", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes/note-pub-1",
      { visibility: "INVALIDE" },
      "PUT"
    );
    const res = await PUT_NOTE(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e: { field: string }) => e.field === "visibility")).toBe(true);
  });

  it("retourne 400 si isUrgent n'est pas un booleen", async () => {
    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes/note-pub-1",
      { isUrgent: "oui" },
      "PUT"
    );
    const res = await PUT_NOTE(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.errors.some((e: { field: string }) => e.field === "isUrgent")).toBe(true);
  });

  it("retourne 404 si la note n'est pas trouvee ou acces refuse", async () => {
    mockUpdateNote.mockResolvedValue(null);

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes/note-inconnu",
      { titre: "Test" },
      "PUT"
    );
    const res = await PUT_NOTE(req, { params: Promise.resolve({ id: "note-inconnu" }) });

    expect(res.status).toBe(404);
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequirePermission.mockRejectedValue(new AuthError("Non autorise"));

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes/note-pub-1",
      { titre: "Test" },
      "PUT"
    );
    const res = await PUT_NOTE(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(401);
  });

  it("retourne 403 si permission manquante", async () => {
    const { ForbiddenError } = await import("@/lib/permissions");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Permission insuffisante.")
    );

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes/note-pub-1",
      { titre: "Test" },
      "PUT"
    );
    const res = await PUT_NOTE(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(403);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockUpdateNote.mockRejectedValue(new Error("DB error"));

    const req = makeJsonRequest(
      "http://localhost:3000/api/ingenieur/notes/note-pub-1",
      { titre: "Test" },
      "PUT"
    );
    const res = await PUT_NOTE(req, { params: Promise.resolve({ id: "note-pub-1" }) });

    expect(res.status).toBe(500);
  });
});
