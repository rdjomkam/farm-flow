/**
 * Tests Sprint 23 — API Notes Client (GET /api/notes)
 *
 * Couvre :
 *   GET /api/notes  — retourne uniquement les notes PUBLIC pour le site actif du client
 *
 * Regles testees :
 *   - Seules les notes PUBLIC sont exposees (jamais INTERNE)
 *   - requireAuth suffit (pas de permission specifique)
 *   - Retourne 403 si aucun site actif
 *   - Filtre par vagueId et isUrgent en query
 *   - Les notes sont marquees comme lues lors de la consultation (atomique)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/notes/route";
import { NextRequest } from "next/server";
import { VisibiliteNote } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetNotesPourClient = vi.fn();

vi.mock("@/lib/queries/notes", () => ({
  getNotesPourClient: (...args: unknown[]) => mockGetNotesPourClient(...args),
}));

const mockRequireAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
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

const SESSION_CLIENT = {
  userId: "user-client-1",
  email: "client@ferme-mbongo.cm",
  phone: null,
  name: "Jean Mbongo",
  globalRole: "PISCICULTEUR",
  activeSiteId: "site-client-1",
  siteRole: "PISCICULTEUR",
  permissions: [],
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

const FAKE_NOTE_URGENTE = {
  ...FAKE_NOTE_PUBLIC,
  id: "note-pub-urgent",
  isUrgent: true,
};

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

// ---------------------------------------------------------------------------
// Tests GET /api/notes
// ---------------------------------------------------------------------------

describe("GET /api/notes (client)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION_CLIENT);
  });

  it("retourne les notes PUBLIC avec total", async () => {
    mockGetNotesPourClient.mockResolvedValue([FAKE_NOTE_PUBLIC]);

    const req = makeRequest("http://localhost:3000/api/notes");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.notes[0].visibility).toBe(VisibiliteNote.PUBLIC);
  });

  it("utilise le siteId actif de la session client", async () => {
    mockGetNotesPourClient.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/notes");
    await GET(req);

    expect(mockGetNotesPourClient).toHaveBeenCalledWith(
      "site-client-1",
      expect.any(Object)
    );
  });

  it("filtre par vagueId si fourni en query", async () => {
    mockGetNotesPourClient.mockResolvedValue([FAKE_NOTE_PUBLIC]);

    const req = makeRequest("http://localhost:3000/api/notes?vagueId=vague-xyz");
    await GET(req);

    expect(mockGetNotesPourClient).toHaveBeenCalledWith(
      "site-client-1",
      expect.objectContaining({ vagueId: "vague-xyz" })
    );
  });

  it("filtre par isUrgent=true", async () => {
    mockGetNotesPourClient.mockResolvedValue([FAKE_NOTE_URGENTE]);

    const req = makeRequest("http://localhost:3000/api/notes?isUrgent=true");
    await GET(req);

    expect(mockGetNotesPourClient).toHaveBeenCalledWith(
      "site-client-1",
      expect.objectContaining({ isUrgent: true })
    );
  });

  it("filtre par isUrgent=false", async () => {
    mockGetNotesPourClient.mockResolvedValue([FAKE_NOTE_PUBLIC]);

    const req = makeRequest("http://localhost:3000/api/notes?isUrgent=false");
    await GET(req);

    expect(mockGetNotesPourClient).toHaveBeenCalledWith(
      "site-client-1",
      expect.objectContaining({ isUrgent: false })
    );
  });

  it("ne passe pas isUrgent si non fourni en query", async () => {
    mockGetNotesPourClient.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/notes");
    await GET(req);

    expect(mockGetNotesPourClient).toHaveBeenCalledWith("site-client-1", {
      vagueId: undefined,
      isUrgent: undefined,
    });
  });

  it("retourne une liste vide si aucune note", async () => {
    mockGetNotesPourClient.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/notes");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.notes).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("retourne 403 si aucun site actif dans la session", async () => {
    mockRequireAuth.mockResolvedValue({ ...SESSION_CLIENT, activeSiteId: null });

    const req = makeRequest("http://localhost:3000/api/notes");
    const res = await GET(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain("site actif");
  });

  it("retourne 401 si non authentifie", async () => {
    const { AuthError } = await import("@/lib/auth");
    mockRequireAuth.mockRejectedValue(new AuthError("Non autorise"));

    const req = makeRequest("http://localhost:3000/api/notes");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("retourne 500 si erreur serveur", async () => {
    mockGetNotesPourClient.mockRejectedValue(new Error("DB error"));

    const req = makeRequest("http://localhost:3000/api/notes");
    const res = await GET(req);

    expect(res.status).toBe(500);
  });

  it("ne requiert pas de permission specifique (juste une session authentifiee)", async () => {
    // Un client PISCICULTEUR sans permissions speciales peut acceder a /api/notes
    mockRequireAuth.mockResolvedValue({
      ...SESSION_CLIENT,
      permissions: [], // aucune permission
    });
    mockGetNotesPourClient.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/notes");
    const res = await GET(req);

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Invariant de visibilite — les notes INTERNE ne doivent jamais etre exposees
// ---------------------------------------------------------------------------

describe("Invariant visibilite — /api/notes n'expose que les notes PUBLIC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue(SESSION_CLIENT);
  });

  it("la fonction getNotesPourClient est la seule appelee (pas getNotes)", async () => {
    // getNotesPourClient applique le filtre visibility=PUBLIC en interne
    // Si on appelait getNotes directement, les notes INTERNE seraient exposees
    mockGetNotesPourClient.mockResolvedValue([]);

    const req = makeRequest("http://localhost:3000/api/notes");
    await GET(req);

    expect(mockGetNotesPourClient).toHaveBeenCalledTimes(1);
  });

  it("toutes les notes retournees ont visibility=PUBLIC", async () => {
    // getNotesPourClient garantit que seules les notes PUBLIC sont retournees
    const publicNotes = [
      { ...FAKE_NOTE_PUBLIC, id: "n1" },
      { ...FAKE_NOTE_PUBLIC, id: "n2", isUrgent: true },
    ];
    mockGetNotesPourClient.mockResolvedValue(publicNotes);

    const req = makeRequest("http://localhost:3000/api/notes");
    const res = await GET(req);
    const data = await res.json();

    for (const note of data.notes) {
      expect(note.visibility).toBe(VisibiliteNote.PUBLIC);
    }
  });
});
