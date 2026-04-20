/**
 * Tests de non-régression — Réserve 1 review BUG-040
 *
 * Vérifie que getVagueById et getVagueByIdWithReleves priorisent AssignationBac
 * (source de vérité ADR-043) sur Bac.vagueId quand un bac est présent dans les
 * deux sources avec des valeurs différentes.
 *
 * Scénario : un bac a `Bac.nom = "Ancien Nom"` / `Bac.volume = 500`
 * mais son AssignationBac active a été créée avec les vraies valeurs
 * `nom = "Nouveau Nom"` / `volume = 800`.
 * Le résultat de getVagueById doit retourner les valeurs d'AssignationBac.
 *
 * Stratégie : mock de prisma.vague.findFirst retournant les deux sources
 * avec des valeurs divergentes, puis vérification de la valeur retournée.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getVagueById, getVagueByIdWithReleves } from "@/lib/queries/vagues";
import { StatutVague } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockVagueFindFirst = vi.fn();
const mockRelevesFindMany = vi.fn();
const mockRelevesCount = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vague: {
      findFirst: (...args: unknown[]) => mockVagueFindFirst(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockRelevesFindMany(...args),
      count: (...args: unknown[]) => mockRelevesCount(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Données de test
// ---------------------------------------------------------------------------

const SITE_ID = "site-union-test";
const VAGUE_ID = "vague-union-test";

/**
 * Bac présent dans les deux sources avec des valeurs différentes :
 * - Bac.vagueId = VAGUE_ID (source legacy)
 * - AssignationBac active pour VAGUE_ID (source ADR-043)
 *
 * Les valeurs divergent intentionnellement pour tester la priorité.
 */
const BAC_ID = "bac-dual-source";

/** Valeurs dans Bac (legacy, moins prioritaires) */
const bacLegacy = {
  id: BAC_ID,
  nom: "Nom Legacy",
  volume: 500,
  vagueId: VAGUE_ID,
  siteId: SITE_ID,
  nombrePoissons: 100,
  nombreInitial: 100,
  poidsMoyenInitial: 50,
};

/** Valeurs dans AssignationBac (ADR-043, doivent primer) */
const assignationBacActif = {
  id: "assignation-dual-001",
  bacId: BAC_ID,
  vagueId: VAGUE_ID,
  siteId: SITE_ID,
  dateAssignation: new Date("2025-01-01"),
  dateFin: null, // active
  nombrePoissons: 120,
  nombreInitial: 100,
  poidsMoyenInitial: 50,
  bac: {
    id: BAC_ID,
    nom: "Nom AssignationBac",  // valeur différente de bacLegacy.nom
    volume: 800,                 // valeur différente de bacLegacy.volume
  },
};

/** Vague de base avec les deux sources pour le même bac */
const vagueAvecDeuxSources = {
  id: VAGUE_ID,
  code: "V-UNION-001",
  statut: StatutVague.EN_COURS,
  siteId: SITE_ID,
  nombreInitial: 500,
  poidsMoyenInitial: 50,
  dateDebut: new Date("2025-01-01"),
  dateFin: null,
  bacs: [bacLegacy], // source Bac.vagueId
  assignations: [assignationBacActif], // source AssignationBac
};

// ---------------------------------------------------------------------------
// Tests — getVagueById
// ---------------------------------------------------------------------------

describe("getVagueById — Réserve 1 BUG-040 : priorité AssignationBac sur Bac.vagueId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne les valeurs d'AssignationBac quand le bac est dans les deux sources avec valeurs différentes", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueAvecDeuxSources);

    const result = await getVagueById(VAGUE_ID, SITE_ID);

    expect(result).not.toBeNull();
    expect(result!.bacs).toHaveLength(1); // pas de doublon

    const bac = result!.bacs[0];
    // AssignationBac doit primer
    expect(bac.nom).toBe("Nom AssignationBac");
    expect(bac.volume).toBe(800);
    // Ne doit pas retourner les valeurs legacy
    expect(bac.nom).not.toBe("Nom Legacy");
    expect(bac.volume).not.toBe(500);
  });

  it("retourne les valeurs Bac.vagueId si aucune AssignationBac active (source unique)", async () => {
    const vagueAssignationOnly = {
      ...vagueAvecDeuxSources,
      assignations: [], // pas d'AssignationBac active
      bacs: [bacLegacy],
    };

    mockVagueFindFirst.mockResolvedValue(vagueAssignationOnly);

    const result = await getVagueById(VAGUE_ID, SITE_ID);

    expect(result).not.toBeNull();
    expect(result!.bacs).toHaveLength(1);

    const bac = result!.bacs[0];
    // Fallback sur Bac.vagueId
    expect(bac.nom).toBe("Nom Legacy");
    expect(bac.volume).toBe(500);
  });

  it("UNION : inclut les bacs uniquement en AssignationBac + ceux uniquement via Bac.vagueId", async () => {
    const bacSansAssignation = {
      id: "bac-legacy-only",
      nom: "Bac Legacy Only",
      volume: 300,
      vagueId: VAGUE_ID,
      siteId: SITE_ID,
      nombrePoissons: 50,
      nombreInitial: 50,
      poidsMoyenInitial: 40,
    };
    const bacSansFk = {
      id: "bac-assignation-only",
      vagueId: null, // pas de FK directe
      nom: "Bac Sans FK",
      volume: 600,
      siteId: SITE_ID,
      nombrePoissons: 80,
      nombreInitial: 80,
      poidsMoyenInitial: 45,
    };
    const assignationOnly = {
      id: "assignation-only-001",
      bacId: bacSansFk.id,
      vagueId: VAGUE_ID,
      siteId: SITE_ID,
      dateAssignation: new Date("2025-01-01"),
      dateFin: null,
      nombrePoissons: 80,
      nombreInitial: 80,
      poidsMoyenInitial: 45,
      bac: { id: bacSansFk.id, nom: bacSansFk.nom, volume: bacSansFk.volume },
    };

    mockVagueFindFirst.mockResolvedValue({
      ...vagueAvecDeuxSources,
      bacs: [bacSansAssignation],
      assignations: [assignationOnly],
    });

    const result = await getVagueById(VAGUE_ID, SITE_ID);

    expect(result).not.toBeNull();
    expect(result!.bacs).toHaveLength(2);

    const ids = result!.bacs.map((b) => b.id).sort();
    expect(ids).toContain(bacSansAssignation.id);
    expect(ids).toContain(bacSansFk.id);
  });

  it("retourne null si la vague n'est pas trouvée", async () => {
    mockVagueFindFirst.mockResolvedValue(null);

    const result = await getVagueById("inexistant", SITE_ID);
    expect(result).toBeNull();
  });

  it("ne crée pas de doublon si un bac est dans les deux sources", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueAvecDeuxSources);

    const result = await getVagueById(VAGUE_ID, SITE_ID);

    expect(result).not.toBeNull();
    // Un seul bac dans le résultat (pas de doublon)
    expect(result!.bacs).toHaveLength(1);
    expect(result!.bacs[0].id).toBe(BAC_ID);
  });
});

// ---------------------------------------------------------------------------
// Tests — getVagueByIdWithReleves
// ---------------------------------------------------------------------------

describe("getVagueByIdWithReleves — Réserve 1 BUG-040 : priorité AssignationBac", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne les valeurs d'AssignationBac quand le bac est dans les deux sources avec valeurs différentes", async () => {
    // getVagueByIdWithReleves utilise Promise.all avec vague + releves + count
    // On mock vague.findFirst pour la vague et releve.findMany/count pour les relevés
    const vagueAvecAssignationsActives = {
      ...vagueAvecDeuxSources,
      // getVagueByIdWithReleves filtre assignations : where: { dateFin: null }
      assignations: [assignationBacActif],
    };

    mockVagueFindFirst.mockResolvedValue(vagueAvecAssignationsActives);
    mockRelevesFindMany.mockResolvedValue([]);
    mockRelevesCount.mockResolvedValue(0);

    const result = await getVagueByIdWithReleves(VAGUE_ID, SITE_ID);

    expect(result).not.toBeNull();
    expect(result!.vague.bacs).toHaveLength(1); // pas de doublon

    const bac = result!.vague.bacs[0];
    // AssignationBac doit primer dans getVagueByIdWithReleves aussi
    expect(bac.nom).toBe("Nom AssignationBac");
    expect(bac.volume).toBe(800);
    expect(bac.nom).not.toBe("Nom Legacy");
  });

  it("retourne les relevés et le total avec la vague", async () => {
    mockVagueFindFirst.mockResolvedValue(vagueAvecDeuxSources);
    mockRelevesFindMany.mockResolvedValue([{ id: "releve-001", typeReleve: "BIOMETRIE" }]);
    mockRelevesCount.mockResolvedValue(1);

    const result = await getVagueByIdWithReleves(VAGUE_ID, SITE_ID);

    expect(result).not.toBeNull();
    expect(result!.releves).toHaveLength(1);
    expect(result!.total).toBe(1);
  });
});
