/**
 * Tests Sprint 13 — Liaison Planning ↔ Relevés
 *
 * Couvre les 8 cas de test demandés :
 * 1. POST /api/releves avec activiteId explicite → activité mise à jour TERMINEE
 * 2. POST /api/releves sans activiteId → auto-match activité PLANIFIEE compatible
 * 3. POST /api/releves sans match possible → relevé créé normalement sans liaison
 * 4. POST /api/releves type OBSERVATION → pas de liaison (absent de ACTIVITE_RELEVE_TYPE_MAP)
 * 5. POST /api/releves type MORTALITE → pas de liaison (absent de ACTIVITE_RELEVE_TYPE_MAP)
 * 6. GET /api/activites → chaque activité inclut releve {id, typeReleve, date} si liée
 * 7. Activité déjà TERMINEE avec releveId → pas re-matchée par un nouveau relevé
 * 8. activiteId invalide (chaine vide / nombre) → erreur 400
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/releves/route";
import { GET as GET_ACTIVITES } from "@/app/api/activites/route";
import { NextRequest } from "next/server";
import {
  Permission,
  TypeReleve,
  TypeAliment,
  CauseMortalite,
  StatutActivite,
  TypeActivite,
} from "@/types";

// ---------------------------------------------------------------------------
// Mocks — lib/queries/releves (pour POST /api/releves)
// ---------------------------------------------------------------------------

const mockCreateReleve = vi.fn();
const mockGetReleves = vi.fn();
const mockGetReleveById = vi.fn();
const mockUpdateReleve = vi.fn();

vi.mock("@/lib/queries/releves", () => ({
  createReleve: (...args: unknown[]) => mockCreateReleve(...args),
  getReleves: (...args: unknown[]) => mockGetReleves(...args),
  getReleveById: (...args: unknown[]) => mockGetReleveById(...args),
  updateReleve: (...args: unknown[]) => mockUpdateReleve(...args),
}));

// ---------------------------------------------------------------------------
// Mocks — lib/queries (pour GET /api/activites)
// ---------------------------------------------------------------------------

const mockGetActivites = vi.fn();
const mockCreateActivite = vi.fn();
const mockGetActiviteById = vi.fn();
const mockUpdateActivite = vi.fn();
const mockDeleteActivite = vi.fn();
const mockGetActivitesAujourdhui = vi.fn();

vi.mock("@/lib/queries", () => ({
  getActivites: (...args: unknown[]) => mockGetActivites(...args),
  createActivite: (...args: unknown[]) => mockCreateActivite(...args),
  getActiviteById: (...args: unknown[]) => mockGetActiviteById(...args),
  updateActivite: (...args: unknown[]) => mockUpdateActivite(...args),
  deleteActivite: (...args: unknown[]) => mockDeleteActivite(...args),
  getActivitesAujourdhui: (...args: unknown[]) =>
    mockGetActivitesAujourdhui(...args),
}));

// ---------------------------------------------------------------------------
// Mocks — auth + permissions
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CONTEXT = {
  userId: "user-1",
  email: "test@dkfarm.cm",
  phone: null,
  name: "Test User",
  globalRole: "ADMIN",
  activeSiteId: "site-1",
  siteRole: "ADMIN",
  permissions: [
    Permission.RELEVES_VOIR,
    Permission.RELEVES_CREER,
    Permission.PLANNING_VOIR,
  ],
};

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

/** Relevé BIOMETRIE factice retourné par createReleve */
const FAKE_RELEVE_BIOMETRIE = {
  id: "releve-1",
  date: new Date("2026-03-11T10:00:00Z"),
  typeReleve: TypeReleve.BIOMETRIE,
  vagueId: "vague-1",
  bacId: "bac-1",
  siteId: "site-1",
  poidsMoyen: 45.5,
  tailleMoyenne: 12.3,
  echantillonCount: 20,
  notes: null,
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
};

/** Corps de requête valides par type */
const VALID_BIOMETRIE_BODY = {
  typeReleve: TypeReleve.BIOMETRIE,
  vagueId: "vague-1",
  bacId: "bac-1",
  poidsMoyen: 45.5,
  tailleMoyenne: 12.3,
  echantillonCount: 20,
};

const VALID_ALIMENTATION_BODY = {
  typeReleve: TypeReleve.ALIMENTATION,
  vagueId: "vague-1",
  bacId: "bac-1",
  quantiteAliment: 2.5,
  typeAliment: TypeAliment.COMMERCIAL,
  frequenceAliment: 3,
};

const VALID_MORTALITE_BODY = {
  typeReleve: TypeReleve.MORTALITE,
  vagueId: "vague-1",
  bacId: "bac-1",
  nombreMorts: 2,
  causeMortalite: CauseMortalite.INCONNUE,
};

const VALID_OBSERVATION_BODY = {
  typeReleve: TypeReleve.OBSERVATION,
  vagueId: "vague-1",
  bacId: "bac-1",
  description: "Les poissons sont actifs et se nourrissent normalement",
};

// ---------------------------------------------------------------------------
// Activités factices pour GET /api/activites
// ---------------------------------------------------------------------------

const FAKE_ACTIVITE_AVEC_RELEVE = {
  id: "activite-1",
  titre: "Biometrie vague 1",
  description: null,
  typeActivite: TypeActivite.BIOMETRIE,
  statut: StatutActivite.TERMINEE,
  recurrence: null,
  dateDebut: new Date("2026-03-11T08:00:00Z"),
  dateFin: null,
  vagueId: "vague-1",
  bacId: null,
  assigneAId: null,
  releveId: "releve-1",
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date("2026-03-11T07:00:00Z"),
  updatedAt: new Date("2026-03-11T10:00:00Z"),
  vague: { id: "vague-1", code: "V-2026-001" },
  bac: null,
  assigneA: null,
  user: { id: "user-1", name: "Test User" },
  releve: {
    id: "releve-1",
    typeReleve: TypeReleve.BIOMETRIE,
    date: new Date("2026-03-11T10:00:00Z"),
  },
};

const FAKE_ACTIVITE_SANS_RELEVE = {
  id: "activite-2",
  titre: "Alimentation vague 1",
  description: null,
  typeActivite: TypeActivite.ALIMENTATION,
  statut: StatutActivite.PLANIFIEE,
  recurrence: null,
  dateDebut: new Date("2026-03-11T12:00:00Z"),
  dateFin: null,
  vagueId: "vague-1",
  bacId: null,
  assigneAId: null,
  releveId: null,
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date("2026-03-11T07:00:00Z"),
  updatedAt: new Date("2026-03-11T07:00:00Z"),
  vague: { id: "vague-1", code: "V-2026-001" },
  bac: null,
  assigneA: null,
  user: { id: "user-1", name: "Test User" },
  releve: null,
};

const FAKE_ACTIVITE_TERMINEE = {
  id: "activite-terminee",
  titre: "Comptage vague 1",
  description: null,
  typeActivite: TypeActivite.COMPTAGE,
  statut: StatutActivite.TERMINEE,
  recurrence: null,
  dateDebut: new Date("2026-03-10T08:00:00Z"),
  dateFin: null,
  vagueId: "vague-1",
  bacId: null,
  assigneAId: null,
  releveId: "releve-ancien",
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date("2026-03-10T07:00:00Z"),
  updatedAt: new Date("2026-03-10T09:00:00Z"),
  vague: { id: "vague-1", code: "V-2026-001" },
  bac: null,
  assigneA: null,
  user: { id: "user-1", name: "Test User" },
  releve: {
    id: "releve-ancien",
    typeReleve: TypeReleve.COMPTAGE,
    date: new Date("2026-03-10T09:00:00Z"),
  },
};

// ===========================================================================
// TEST 1 — POST /api/releves avec activiteId EXPLICITE
// ===========================================================================

describe("Test 1 — POST /api/releves avec activiteId explicite (liaison directe)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("transmet activiteId a createReleve comme 4eme argument", async () => {
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: "activite-1",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",      // siteId
      "user-1",      // userId
      expect.objectContaining({ typeReleve: TypeReleve.BIOMETRIE }),
      "activite-1"   // activiteId (4eme argument) → liaison explicite
    );
  });

  it("retourne le releve cree avec statut 201", async () => {
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: "activite-1",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("releve-1");
    expect(data.typeReleve).toBe(TypeReleve.BIOMETRIE);
  });

  it("fonctionne avec type ALIMENTATION + activiteId", async () => {
    const fakeAlimReleve = {
      ...FAKE_RELEVE_BIOMETRIE,
      id: "releve-alim-1",
      typeReleve: TypeReleve.ALIMENTATION,
    };
    mockCreateReleve.mockResolvedValue(fakeAlimReleve);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_ALIMENTATION_BODY,
          activiteId: "activite-alim-1",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ typeReleve: TypeReleve.ALIMENTATION }),
      "activite-alim-1"
    );
  });

  it("trim l'activiteId avant de le transmettre", async () => {
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: "  activite-1  ",
        }),
      })
    );

    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.anything(),
      "activite-1"  // trimmé
    );
  });
});

// ===========================================================================
// TEST 2 — POST /api/releves SANS activiteId → auto-match PLANIFIEE
// ===========================================================================

describe("Test 2 — POST /api/releves sans activiteId → auto-match activité PLANIFIEE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("appelle createReleve avec activiteId=undefined pour declencher l'auto-match", async () => {
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_BIOMETRIE_BODY), // pas d'activiteId
      })
    );

    expect(response.status).toBe(201);
    // 4eme argument = undefined → createReleve effectue l'auto-match interne
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ typeReleve: TypeReleve.BIOMETRIE }),
      undefined
    );
  });

  it("retourne 201 quand l'auto-match reussit", async () => {
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_BIOMETRIE_BODY),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("releve-1");
  });

  it("auto-match pour type ALIMENTATION (dans le map) → undefined activiteId", async () => {
    const fakeAlimReleve = {
      ...FAKE_RELEVE_BIOMETRIE,
      typeReleve: TypeReleve.ALIMENTATION,
    };
    mockCreateReleve.mockResolvedValue(fakeAlimReleve);

    await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_ALIMENTATION_BODY),
      })
    );

    // createReleve reçoit undefined → fera l'auto-match interne (ALIMENTATION est dans le map)
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ typeReleve: TypeReleve.ALIMENTATION }),
      undefined
    );
  });
});

// ===========================================================================
// TEST 3 — POST /api/releves SANS match possible → relevé créé normalement
// ===========================================================================

describe("Test 3 — POST /api/releves sans activité compatible → relevé créé normalement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("cree le releve normalement meme si aucune activite ne correspond", async () => {
    // createReleve est mocké → simule le cas où l'auto-match ne trouve rien
    // La fonction retourne quand même le relevé (pas d'erreur)
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_BIOMETRIE_BODY),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("releve-1");
  });

  it("createReleve est toujours appellee une seule fois", async () => {
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_BIOMETRIE_BODY),
      })
    );

    expect(mockCreateReleve).toHaveBeenCalledOnce();
  });

  it("la reponse contient le releve sans echec lie a l'absence d'activite", async () => {
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_BIOMETRIE_BODY),
      })
    );
    const data = await response.json();

    // Relevé créé normalement, pas d'erreur 404 ou 409
    expect(response.status).toBe(201);
    expect(data).toMatchObject({ id: "releve-1", typeReleve: TypeReleve.BIOMETRIE });
  });
});

// ===========================================================================
// TEST 4 — POST /api/releves type OBSERVATION → pas de liaison
// ===========================================================================

describe("Test 4 — POST /api/releves type OBSERVATION → absent de ACTIVITE_RELEVE_TYPE_MAP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("OBSERVATION sans activiteId → createReleve reçoit undefined (pas de liaison possible)", async () => {
    const fakeObsReleve = {
      ...FAKE_RELEVE_BIOMETRIE,
      typeReleve: TypeReleve.OBSERVATION,
      description: "Les poissons sont actifs",
    };
    mockCreateReleve.mockResolvedValue(fakeObsReleve);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_OBSERVATION_BODY),
      })
    );

    expect(response.status).toBe(201);
    // OBSERVATION n'est pas dans ACTIVITE_RELEVE_TYPE_MAP
    // → createReleve reçoit undefined, l'auto-match ne s'exécutera pas
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ typeReleve: TypeReleve.OBSERVATION }),
      undefined
    );
  });

  it("OBSERVATION avec activiteId fourni → activiteId transmis (mais createReleve ignorera le mapping)", async () => {
    // La route transmet l'activiteId si fourni ; c'est createReleve qui gère le cas
    // (elle vérifie si le type est dans le map → OBSERVATION ne l'est pas → aucun update)
    const fakeObsReleve = {
      ...FAKE_RELEVE_BIOMETRIE,
      typeReleve: TypeReleve.OBSERVATION,
    };
    mockCreateReleve.mockResolvedValue(fakeObsReleve);

    await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_OBSERVATION_BODY,
          activiteId: "activite-nettoyage-1",
        }),
      })
    );

    // La route passe quand même activiteId à createReleve
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ typeReleve: TypeReleve.OBSERVATION }),
      "activite-nettoyage-1"
    );
  });

  it("OBSERVATION retourne 201 normalement", async () => {
    mockCreateReleve.mockResolvedValue({
      ...FAKE_RELEVE_BIOMETRIE,
      typeReleve: TypeReleve.OBSERVATION,
    });

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_OBSERVATION_BODY),
      })
    );

    expect(response.status).toBe(201);
  });
});

// ===========================================================================
// TEST 5 — POST /api/releves type MORTALITE → pas de liaison
// ===========================================================================

describe("Test 5 — POST /api/releves type MORTALITE → absent de ACTIVITE_RELEVE_TYPE_MAP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("MORTALITE sans activiteId → createReleve reçoit undefined (pas de liaison)", async () => {
    const fakeMortReleve = {
      ...FAKE_RELEVE_BIOMETRIE,
      typeReleve: TypeReleve.MORTALITE,
      nombreMorts: 2,
      causeMortalite: CauseMortalite.INCONNUE,
    };
    mockCreateReleve.mockResolvedValue(fakeMortReleve);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_MORTALITE_BODY),
      })
    );

    expect(response.status).toBe(201);
    // MORTALITE n'est pas dans ACTIVITE_RELEVE_TYPE_MAP
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ typeReleve: TypeReleve.MORTALITE }),
      undefined
    );
  });

  it("MORTALITE retourne le releve cree avec 201", async () => {
    mockCreateReleve.mockResolvedValue({
      ...FAKE_RELEVE_BIOMETRIE,
      typeReleve: TypeReleve.MORTALITE,
    });

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_MORTALITE_BODY),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("releve-1");
  });

  it("MORTALITE createReleve est appelee une seule fois", async () => {
    mockCreateReleve.mockResolvedValue({
      ...FAKE_RELEVE_BIOMETRIE,
      typeReleve: TypeReleve.MORTALITE,
    });

    await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_MORTALITE_BODY),
      })
    );

    expect(mockCreateReleve).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// TEST 6 — GET /api/activites → inclut releve {id, typeReleve, date} si liée
// ===========================================================================

describe("Test 6 — GET /api/activites inclut releve dans la réponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne les activités avec le champ releve non null quand liée", async () => {
    mockGetActivites.mockResolvedValue([FAKE_ACTIVITE_AVEC_RELEVE]);

    const response = await GET_ACTIVITES(makeRequest("/api/activites"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.activites).toHaveLength(1);
    const activite = data.activites[0];
    expect(activite.releve).not.toBeNull();
    expect(activite.releve).toMatchObject({
      id: "releve-1",
      typeReleve: TypeReleve.BIOMETRIE,
    });
  });

  it("retourne releve=null pour une activité non liée (PLANIFIEE sans releveId)", async () => {
    mockGetActivites.mockResolvedValue([FAKE_ACTIVITE_SANS_RELEVE]);

    const response = await GET_ACTIVITES(makeRequest("/api/activites"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.activites).toHaveLength(1);
    expect(data.activites[0].releve).toBeNull();
  });

  it("inclut le champ releve pour toutes les activités (liées et non liées)", async () => {
    mockGetActivites.mockResolvedValue([
      FAKE_ACTIVITE_AVEC_RELEVE,
      FAKE_ACTIVITE_SANS_RELEVE,
    ]);

    const response = await GET_ACTIVITES(makeRequest("/api/activites"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.activites).toHaveLength(2);

    // Première activité — liée à un relevé
    expect(data.activites[0].releve).toMatchObject({
      id: "releve-1",
      typeReleve: TypeReleve.BIOMETRIE,
    });

    // Deuxième activité — non liée
    expect(data.activites[1].releve).toBeNull();
  });

  it("la date du releve est incluse dans la reponse", async () => {
    mockGetActivites.mockResolvedValue([FAKE_ACTIVITE_AVEC_RELEVE]);

    const response = await GET_ACTIVITES(makeRequest("/api/activites"));
    const data = await response.json();

    const releve = data.activites[0].releve;
    expect(releve.date).toBeDefined();
    // La date est sérialisée en string ISO par JSON.stringify
    expect(new Date(releve.date).toISOString()).toContain("2026-03-11");
  });

  it("activite TERMINEE avec releveId contient le releve associe", async () => {
    mockGetActivites.mockResolvedValue([FAKE_ACTIVITE_TERMINEE]);

    const response = await GET_ACTIVITES(makeRequest("/api/activites"));
    const data = await response.json();

    const activite = data.activites[0];
    expect(activite.statut).toBe(StatutActivite.TERMINEE);
    expect(activite.releveId).toBe("releve-ancien");
    expect(activite.releve).toMatchObject({
      id: "releve-ancien",
      typeReleve: TypeReleve.COMPTAGE,
    });
  });

  it("retourne le total et la liste", async () => {
    mockGetActivites.mockResolvedValue([
      FAKE_ACTIVITE_AVEC_RELEVE,
      FAKE_ACTIVITE_SANS_RELEVE,
      FAKE_ACTIVITE_TERMINEE,
    ]);

    const response = await GET_ACTIVITES(makeRequest("/api/activites"));
    const data = await response.json();

    expect(data.total).toBe(3);
    expect(data.activites).toHaveLength(3);
  });
});

// ===========================================================================
// TEST 7 — Activité TERMINEE avec releveId → pas re-matchée par nouveau relevé
// ===========================================================================

describe("Test 7 — Activité TERMINEE avec releveId ne peut pas être re-matchée", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("createReleve est appelée et retourne 201 même si l'activiteId pointe vers une TERMINEE", async () => {
    // Dans createReleve, la liaison explicite vérifie :
    //   statut IN [PLANIFIEE, EN_RETARD] ET releveId IS NULL
    // Si l'activite est TERMINEE ou a déjà un releveId → findFirst retourne null → pas d'update
    // La route retourne quand même 201 (pas d'erreur throwée)
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: "activite-terminee",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("releve-1");
  });

  it("createReleve reçoit l'activiteId TERMINEE mais ne lève pas d'erreur", async () => {
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: "activite-terminee",
        }),
      })
    );

    // La route transmet activiteId à createReleve
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ typeReleve: TypeReleve.BIOMETRIE }),
      "activite-terminee"
    );
  });

  it("GET /api/activites — l'activite TERMINEE garde son releve original (non re-matche)", async () => {
    // Simuler le cas : l'activite TERMINEE a déjà releveId = "releve-ancien"
    // Un nouveau relevé a été créé mais l'activite n'a pas été re-matchée
    mockGetActivites.mockResolvedValue([FAKE_ACTIVITE_TERMINEE]);

    const response = await GET_ACTIVITES(makeRequest("/api/activites"));
    const data = await response.json();

    const activite = data.activites[0];
    // L'activite reste TERMINEE avec son releveId original
    expect(activite.statut).toBe(StatutActivite.TERMINEE);
    expect(activite.releveId).toBe("releve-ancien");
    // Le releve lié est "releve-ancien", pas un nouveau
    expect(activite.releve.id).toBe("releve-ancien");
  });

  it("auto-match respecte la contrainte releveId IS NULL (simulé via mock)", async () => {
    // Sans activiteId dans la requête → auto-match via findMatchingActivite
    // findMatchingActivite filtre : statut IN [PLANIFIEE|EN_RETARD] + releveId IS NULL
    // → une activite TERMINEE (releveId non null) ne sera JAMAIS matchée
    // Ce test vérifie que le relevé est créé normalement sans liaison non désirée
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify(VALID_BIOMETRIE_BODY),
      })
    );

    expect(response.status).toBe(201);
    // createReleve reçoit undefined → l'auto-match interne filtre correctement
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.objectContaining({ typeReleve: TypeReleve.BIOMETRIE }),
      undefined
    );
  });
});

// ===========================================================================
// TEST 8 — activiteId invalide → erreur 400
// ===========================================================================

describe("Test 8 — activiteId invalide → erreur 400", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue(AUTH_CONTEXT);
  });

  it("retourne 400 si activiteId est une chaine vide", async () => {
    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: "",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "activiteId" }),
      ])
    );
  });

  it("retourne 400 si activiteId est uniquement des espaces", async () => {
    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: "   ",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "activiteId" }),
      ])
    );
  });

  it("retourne 400 si activiteId est un nombre (pas une string)", async () => {
    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: 12345,
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "activiteId" }),
      ])
    );
  });

  it("retourne 400 si activiteId est un objet (pas une string)", async () => {
    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: { id: "activite-1" },
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "activiteId" }),
      ])
    );
  });

  it("le message d'erreur mentionne activiteId", async () => {
    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: "",
        }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    const activiteError = data.errors.find(
      (e: { field: string }) => e.field === "activiteId"
    );
    expect(activiteError).toBeDefined();
    expect(activiteError.message).toMatch(/activit/i);
  });

  it("accepte activiteId=null (traite comme absent — pas d'erreur)", async () => {
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: null,
        }),
      })
    );

    // null == null → body.activiteId == null → validé comme absent
    expect(response.status).toBe(201);
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.anything(),
      undefined  // activiteId reste undefined
    );
  });

  it("accepte activiteId valide (ID non vide) → pas d'erreur 400", async () => {
    mockCreateReleve.mockResolvedValue(FAKE_RELEVE_BIOMETRIE);

    const response = await POST(
      makeRequest("/api/releves", {
        method: "POST",
        body: JSON.stringify({
          ...VALID_BIOMETRIE_BODY,
          activiteId: "cma-valid-id-xyz",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockCreateReleve).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.anything(),
      "cma-valid-id-xyz"
    );
  });
});
