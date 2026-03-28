/**
 * Tests FC.10 — Feed Analytics UI (Sprint FC)
 *
 * Couvre :
 *   1. Logique de rendu AlerteDLC (lots expirés vs lots à venir vs aucun)
 *   2. Validation des searchParams (valeurs invalides ignorées sans crash)
 *   3. Logique avertissement tailles différentes (hasMixedSizes)
 *   4. getMouvementsExpirables — séparation stricte expiré/bientôt (Guard E13)
 */

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlerteDLC } from "@/components/analytics/alerte-dlc";
import { TailleGranule, FormeAliment, PhaseElevage } from "@/types";
import type { MouvementExpirable, MouvementExpirableSoon } from "@/lib/queries/analytics";
import { getMouvementsExpirables } from "@/lib/queries/analytics";

// ---------------------------------------------------------------------------
// Mock Prisma — déclaré au niveau module
// ---------------------------------------------------------------------------

const mockMouvementStockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    mouvementStock: {
      findMany: (...args: unknown[]) => mockMouvementStockFindMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mocks globaux UI
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/analytics/aliments",
  useSearchParams: () => new URLSearchParams(),
}));

const analyticsTranslations: Record<string, string | ((params: Record<string, unknown>) => string)> = {
  "dlc.titre": "Alertes DLC",
  "dlc.aucune": "Aucun lot expiré ou proche de la date limite.",
  "dlc.expire": "EXPIRÉ",
  "dlc.bientot": (p: Record<string, unknown>) => `Expire dans ${p.jours} j`,
};

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, params?: Record<string, unknown>) => {
    if (namespace === "analytics") {
      const val = analyticsTranslations[key];
      if (typeof val === "function") return val(params ?? {});
      if (typeof val === "string") return val;
    }
    return key;
  },
}));

// ---------------------------------------------------------------------------
// Helpers de données test
// ---------------------------------------------------------------------------

function makeExpire(overrides: Partial<MouvementExpirable> = {}): MouvementExpirable {
  return {
    produitNom: "Aliment Croissance 3mm",
    lotFabrication: "LOT-2025-001",
    datePeremption: new Date("2025-01-01"),
    quantite: 25,
    ...overrides,
  };
}

function makeExpiringSoon(overrides: Partial<MouvementExpirableSoon> = {}): MouvementExpirableSoon {
  return {
    produitNom: "Raanan 42%",
    lotFabrication: "LOT-2026-005",
    datePeremption: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    quantite: 50,
    joursRestants: 10,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Tests AlerteDLC — rendu conditionnel
// ---------------------------------------------------------------------------

describe("AlerteDLC — rendu sans alerte", () => {
  it("affiche le message 'aucun lot' quand expires=[] et expiringSoon=[]", () => {
    render(<AlerteDLC expires={[]} expiringSoon={[]} />);
    expect(
      screen.getByText("Aucun lot expiré ou proche de la date limite.")
    ).toBeInTheDocument();
  });

  it("affiche le titre 'Alertes DLC'", () => {
    render(<AlerteDLC expires={[]} expiringSoon={[]} />);
    expect(screen.getByText("Alertes DLC")).toBeInTheDocument();
  });
});

describe("AlerteDLC — rendu avec lots expirés", () => {
  it("affiche le nom du produit expiré", () => {
    const expire = makeExpire({ produitNom: "Coppens Catfish" });
    render(<AlerteDLC expires={[expire]} expiringSoon={[]} />);
    expect(screen.getByText("Coppens Catfish")).toBeInTheDocument();
  });

  it("affiche le badge EXPIRÉ", () => {
    const expire = makeExpire();
    render(<AlerteDLC expires={[expire]} expiringSoon={[]} />);
    expect(screen.getByText(/EXPIRÉ/)).toBeInTheDocument();
  });

  it("affiche le numéro de lot quand il est renseigné", () => {
    const expire = makeExpire({ lotFabrication: "LOT-2025-ABC" });
    render(<AlerteDLC expires={[expire]} expiringSoon={[]} />);
    expect(screen.getByText(/LOT-2025-ABC/)).toBeInTheDocument();
  });

  it("n'affiche pas la section lot quand lotFabrication est null", () => {
    const expire = makeExpire({ lotFabrication: null });
    render(<AlerteDLC expires={[expire]} expiringSoon={[]} />);
    expect(screen.queryByText(/Lot :/)).not.toBeInTheDocument();
  });

  it("affiche la quantité en kg", () => {
    const expire = makeExpire({ quantite: 30 });
    render(<AlerteDLC expires={[expire]} expiringSoon={[]} />);
    expect(screen.getByText("30 kg")).toBeInTheDocument();
  });

  it("affiche la date de péremption formatée", () => {
    const date = new Date("2025-01-15");
    const expire = makeExpire({ datePeremption: date });
    render(<AlerteDLC expires={[expire]} expiringSoon={[]} />);
    // La date est dans le badge "EXPIRÉ — 15/01/2025"
    expect(screen.getByText(/15\/01\/2025/)).toBeInTheDocument();
  });

  it("affiche plusieurs lots expirés", () => {
    const expire1 = makeExpire({ produitNom: "Aliment A" });
    const expire2 = makeExpire({ produitNom: "Aliment B" });
    render(<AlerteDLC expires={[expire1, expire2]} expiringSoon={[]} />);
    expect(screen.getByText("Aliment A")).toBeInTheDocument();
    expect(screen.getByText("Aliment B")).toBeInTheDocument();
  });

  it("n'affiche pas le message 'aucun lot' quand il y a des expirés", () => {
    const expire = makeExpire();
    render(<AlerteDLC expires={[expire]} expiringSoon={[]} />);
    expect(
      screen.queryByText("Aucun lot expiré ou proche de la date limite.")
    ).not.toBeInTheDocument();
  });
});

describe("AlerteDLC — rendu avec lots expirant bientôt", () => {
  it("affiche le nom du produit expirant bientôt", () => {
    const soon = makeExpiringSoon({ produitNom: "Raanan 42%" });
    render(<AlerteDLC expires={[]} expiringSoon={[soon]} />);
    expect(screen.getByText("Raanan 42%")).toBeInTheDocument();
  });

  it("affiche le badge 'Expire dans X j'", () => {
    const soon = makeExpiringSoon({ joursRestants: 7 });
    render(<AlerteDLC expires={[]} expiringSoon={[soon]} />);
    expect(screen.getByText("Expire dans 7 j")).toBeInTheDocument();
  });

  it("affiche le numéro de lot quand renseigné", () => {
    const soon = makeExpiringSoon({ lotFabrication: "LOT-SOON-001" });
    render(<AlerteDLC expires={[]} expiringSoon={[soon]} />);
    expect(screen.getByText(/LOT-SOON-001/)).toBeInTheDocument();
  });

  it("n'affiche pas la section lot quand lotFabrication est null", () => {
    const soon = makeExpiringSoon({ lotFabrication: null });
    render(<AlerteDLC expires={[]} expiringSoon={[soon]} />);
    expect(screen.queryByText(/Lot :/)).not.toBeInTheDocument();
  });

  it("affiche la quantité en kg pour les lots bientôt expirés", () => {
    const soon = makeExpiringSoon({ quantite: 80 });
    render(<AlerteDLC expires={[]} expiringSoon={[soon]} />);
    expect(screen.getByText("80 kg")).toBeInTheDocument();
  });

  it("affiche simultanément lots expirés et lots bientôt expirés", () => {
    const expire = makeExpire({ produitNom: "Aliment Expiré" });
    const soon = makeExpiringSoon({ produitNom: "Aliment Bientôt" });
    render(<AlerteDLC expires={[expire]} expiringSoon={[soon]} />);
    expect(screen.getByText("Aliment Expiré")).toBeInTheDocument();
    expect(screen.getByText("Aliment Bientôt")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Tests validation searchParams — fonctions de validation des filtres
// ---------------------------------------------------------------------------

describe("Validation searchParams — isValidTaille (Guard E6)", () => {
  /**
   * On teste les valeurs de l'enum TailleGranule pour s'assurer
   * qu'une valeur invalide ne correspond pas à un membre et qu'une valeur
   * valide y correspond bien.
   * La logique reproduit isValidTaille de feed-filters.tsx.
   */
  function isValidTaille(value: string): boolean {
    return Object.values(TailleGranule).includes(value as TailleGranule);
  }

  it("chaque valeur TailleGranule est une chaîne non vide", () => {
    const validTailles = Object.values(TailleGranule);
    expect(validTailles.length).toBeGreaterThan(0);
    validTailles.forEach((t) => {
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThan(0);
    });
  });

  it("'INVALID' n'est pas une TailleGranule valide — doit être ignoré", () => {
    expect(isValidTaille("INVALID")).toBe(false);
  });

  it("'GROS' n'est pas une TailleGranule valide", () => {
    expect(isValidTaille("GROS")).toBe(false);
  });

  it("'P1' est une TailleGranule valide", () => {
    expect(isValidTaille("P1")).toBe(true);
  });

  it("'G3' est une TailleGranule valide", () => {
    expect(isValidTaille("G3")).toBe(true);
  });

  it("chaine vide '' n'est pas valide", () => {
    expect(isValidTaille("")).toBe(false);
  });

  it("valeur en minuscules 'p1' n'est pas valide (enums MAJUSCULES)", () => {
    expect(isValidTaille("p1")).toBe(false);
  });
});

describe("Validation searchParams — isValidForme (Guard E6)", () => {
  function isValidForme(value: string): boolean {
    return Object.values(FormeAliment).includes(value as FormeAliment);
  }

  it("'INVALID' n'est pas une FormeAliment valide", () => {
    expect(isValidForme("INVALID")).toBe(false);
  });

  it("'LIQUIDE' n'est pas une FormeAliment valide", () => {
    expect(isValidForme("LIQUIDE")).toBe(false);
  });

  it("'FLOTTANT' est une FormeAliment valide", () => {
    expect(isValidForme("FLOTTANT")).toBe(true);
  });

  it("'COULANT' est une FormeAliment valide", () => {
    expect(isValidForme("COULANT")).toBe(true);
  });

  it("'SEMI_FLOTTANT' est une FormeAliment valide", () => {
    expect(isValidForme("SEMI_FLOTTANT")).toBe(true);
  });

  it("'POUDRE' est une FormeAliment valide", () => {
    expect(isValidForme("POUDRE")).toBe(true);
  });

  it("chaine vide n'est pas valide", () => {
    expect(isValidForme("")).toBe(false);
  });
});

describe("Validation searchParams — isValidPhase (Guard E6)", () => {
  function isValidPhase(value: string): boolean {
    return Object.values(PhaseElevage).includes(value as PhaseElevage);
  }

  it("'INVALID' n'est pas une PhaseElevage valide", () => {
    expect(isValidPhase("INVALID")).toBe(false);
  });

  it("'GROSSISSEMENT' est une PhaseElevage valide", () => {
    expect(isValidPhase("GROSSISSEMENT")).toBe(true);
  });

  it("'grossissement' en minuscules n'est pas valide", () => {
    expect(isValidPhase("grossissement")).toBe(false);
  });

  it("'FINITION' est une PhaseElevage valide", () => {
    expect(isValidPhase("FINITION")).toBe(true);
  });

  it("'JUVENILE' est une PhaseElevage valide", () => {
    expect(isValidPhase("JUVENILE")).toBe(true);
  });

  it("chaine vide n'est pas valide", () => {
    expect(isValidPhase("")).toBe(false);
  });
});

describe("Validation searchParams — isValidSaison", () => {
  function isValidSaison(value: string): boolean {
    return value === "SECHE" || value === "PLUIES";
  }

  it("'SECHE' est une saison valide", () => {
    expect(isValidSaison("SECHE")).toBe(true);
  });

  it("'PLUIES' est une saison valide", () => {
    expect(isValidSaison("PLUIES")).toBe(true);
  });

  it("'INVALID' n'est pas une saison valide", () => {
    expect(isValidSaison("INVALID")).toBe(false);
  });

  it("'seche' en minuscules n'est pas valide", () => {
    expect(isValidSaison("seche")).toBe(false);
  });

  it("chaine vide n'est pas valide", () => {
    expect(isValidSaison("")).toBe(false);
  });

  it("'PRINTEMPS' n'est pas valide (hors des deux saisons définies)", () => {
    expect(isValidSaison("PRINTEMPS")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Tests logique avertissement tailles différentes (hasMixedSizes)
// ---------------------------------------------------------------------------

describe("Logique hasMixedSizes — avertissement tailles différentes", () => {
  /**
   * Reproduit la logique de AnalyticsAlimentsPage :
   *   const tailles = new Set(aliments.map(a => a.tailleGranule).filter(t => t !== null))
   *   const hasMixedSizes = tailles.size > 1
   */
  function computeHasMixedSizes(
    aliments: Array<{ tailleGranule: TailleGranule | null }>
  ): boolean {
    const tailles = new Set(
      aliments
        .map((a) => a.tailleGranule)
        .filter((t): t is TailleGranule => t !== null)
    );
    return tailles.size > 1;
  }

  it("0 aliment → pas d'avertissement", () => {
    expect(computeHasMixedSizes([])).toBe(false);
  });

  it("1 aliment avec taille P1 → pas d'avertissement", () => {
    expect(computeHasMixedSizes([{ tailleGranule: TailleGranule.P1 }])).toBe(false);
  });

  it("2 aliments avec la même taille P1 → pas d'avertissement", () => {
    expect(
      computeHasMixedSizes([
        { tailleGranule: TailleGranule.P1 },
        { tailleGranule: TailleGranule.P1 },
      ])
    ).toBe(false);
  });

  it("2 aliments avec tailles différentes P1 et G2 → avertissement", () => {
    expect(
      computeHasMixedSizes([
        { tailleGranule: TailleGranule.P1 },
        { tailleGranule: TailleGranule.G2 },
      ])
    ).toBe(true);
  });

  it("3 aliments dont 2 tailles différentes → avertissement", () => {
    expect(
      computeHasMixedSizes([
        { tailleGranule: TailleGranule.P1 },
        { tailleGranule: TailleGranule.P1 },
        { tailleGranule: TailleGranule.G3 },
      ])
    ).toBe(true);
  });

  it("aliments tous avec tailleGranule null → pas d'avertissement (nulls ignorés)", () => {
    expect(
      computeHasMixedSizes([
        { tailleGranule: null },
        { tailleGranule: null },
      ])
    ).toBe(false);
  });

  it("mix null et une seule taille réelle → pas d'avertissement", () => {
    expect(
      computeHasMixedSizes([
        { tailleGranule: null },
        { tailleGranule: TailleGranule.G1 },
      ])
    ).toBe(false);
  });

  it("mix null et deux tailles réelles différentes → avertissement", () => {
    expect(
      computeHasMixedSizes([
        { tailleGranule: null },
        { tailleGranule: TailleGranule.P2 },
        { tailleGranule: TailleGranule.G4 },
      ])
    ).toBe(true);
  });

  it("boundary : Set.size === 1 → hasMixedSizes retourne false", () => {
    const set = new Set([TailleGranule.G2]);
    expect(set.size > 1).toBe(false);
  });

  it("boundary : Set.size === 2 → hasMixedSizes retourne true", () => {
    const set = new Set([TailleGranule.P1, TailleGranule.G2]);
    expect(set.size > 1).toBe(true);
  });

  it("5 aliments avec des tailles répétées mais 3 distinctes → avertissement", () => {
    expect(
      computeHasMixedSizes([
        { tailleGranule: TailleGranule.P0 },
        { tailleGranule: TailleGranule.P1 },
        { tailleGranule: TailleGranule.P0 },
        { tailleGranule: TailleGranule.G1 },
        { tailleGranule: TailleGranule.G1 },
      ])
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Tests getMouvementsExpirables — Guard E13 séparation stricte
// ---------------------------------------------------------------------------

describe("getMouvementsExpirables — Guard E13 : séparation expiré vs bientôt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne expires vide et expiringSoon vide quand aucun mouvement", async () => {
    mockMouvementStockFindMany.mockResolvedValue([]);

    const result = await getMouvementsExpirables("site-1");

    expect(result.expires).toEqual([]);
    expect(result.expiringSoon).toEqual([]);
  });

  it("retourne un lot expiré dans expires (datePeremption < now)", async () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // -5 jours

    mockMouvementStockFindMany
      .mockResolvedValueOnce([
        {
          quantite: 20,
          lotFabrication: "LOT-EXP-001",
          datePeremption: pastDate,
          produit: { nom: "Aliment Expiré" },
        },
      ])
      .mockResolvedValueOnce([]); // expiringSoon vide

    const result = await getMouvementsExpirables("site-1");

    expect(result.expires).toHaveLength(1);
    expect(result.expires[0].produitNom).toBe("Aliment Expiré");
    expect(result.expires[0].quantite).toBe(20);
    expect(result.expires[0].lotFabrication).toBe("LOT-EXP-001");
    expect(result.expiringSoon).toHaveLength(0);
  });

  it("retourne un lot bientôt expiré dans expiringSoon (now <= datePeremption <= now+30j)", async () => {
    const soonDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // +10 jours

    mockMouvementStockFindMany
      .mockResolvedValueOnce([]) // expires vide
      .mockResolvedValueOnce([
        {
          quantite: 50,
          lotFabrication: "LOT-SOON-001",
          datePeremption: soonDate,
          produit: { nom: "Aliment Bientôt" },
        },
      ]);

    const result = await getMouvementsExpirables("site-1");

    expect(result.expires).toHaveLength(0);
    expect(result.expiringSoon).toHaveLength(1);
    expect(result.expiringSoon[0].produitNom).toBe("Aliment Bientôt");
    expect(result.expiringSoon[0].joursRestants).toBeGreaterThan(0);
    expect(result.expiringSoon[0].joursRestants).toBeLessThanOrEqual(30);
  });

  it("Guard E13 : un lot expiré (passé) ne se retrouve PAS dans expiringSoon", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // -2 jours

    // La query expires cherche datePeremption < now,
    // la query expiringSoon cherche datePeremption ENTRE now et now+30j
    // Elles sont mutuellement exclusives (deux requêtes Prisma séparées)
    mockMouvementStockFindMany
      .mockResolvedValueOnce([
        {
          quantite: 10,
          lotFabrication: null,
          datePeremption: pastDate,
          produit: { nom: "Lot Expiré" },
        },
      ])
      .mockResolvedValueOnce([]); // expiringSoon ne contient pas ce lot

    const result = await getMouvementsExpirables("site-1");

    expect(result.expires).toHaveLength(1);
    expect(result.expiringSoon).toHaveLength(0);
    const nomsExpiringSoon = result.expiringSoon.map((m) => m.produitNom);
    expect(nomsExpiringSoon).not.toContain("Lot Expiré");
  });

  it("Guard E13 : un lot bientôt expiré ne se retrouve PAS dans expires", async () => {
    const soonDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // +15 jours

    mockMouvementStockFindMany
      .mockResolvedValueOnce([]) // expires ne contient pas ce lot
      .mockResolvedValueOnce([
        {
          quantite: 30,
          lotFabrication: "LOT-F",
          datePeremption: soonDate,
          produit: { nom: "Lot Bientôt" },
        },
      ]);

    const result = await getMouvementsExpirables("site-1");

    expect(result.expiringSoon).toHaveLength(1);
    expect(result.expires).toHaveLength(0);
    const nomsExpires = result.expires.map((m) => m.produitNom);
    expect(nomsExpires).not.toContain("Lot Bientôt");
  });

  it("joursRestants est calculé correctement pour un lot expirant dans ~10 jours", async () => {
    // On place la date à 10 jours + 1 minute dans le futur pour s'assurer que Math.ceil donne 10
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 60000);

    mockMouvementStockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          quantite: 40,
          lotFabrication: null,
          datePeremption: futureDate,
          produit: { nom: "Aliment J+10" },
        },
      ]);

    const result = await getMouvementsExpirables("site-1");

    expect(result.expiringSoon).toHaveLength(1);
    // Math.ceil : 10 ou 11 selon l'instant précis d'exécution
    expect(result.expiringSoon[0].joursRestants).toBeGreaterThanOrEqual(10);
    expect(result.expiringSoon[0].joursRestants).toBeLessThanOrEqual(11);
  });

  it("les mouvements avec datePeremption null sont filtrés par le .filter()", async () => {
    // Si un null passait le WHERE Prisma (cas défensif), le .filter() le retire
    mockMouvementStockFindMany
      .mockResolvedValueOnce([
        {
          quantite: 10,
          lotFabrication: null,
          datePeremption: null,
          produit: { nom: "Aliment Sans DLC" },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getMouvementsExpirables("site-1");

    expect(result.expires).toHaveLength(0);
  });

  it("getMouvementsExpirables appelle prisma.mouvementStock.findMany exactement deux fois", async () => {
    mockMouvementStockFindMany.mockResolvedValue([]);

    await getMouvementsExpirables("site-1");

    // Un appel pour expires (lt: now) + un appel pour expiringSoon (gte: now, lte: now+30j)
    expect(mockMouvementStockFindMany).toHaveBeenCalledTimes(2);
  });

  it("les appels Prisma filtrent sur siteId fourni", async () => {
    mockMouvementStockFindMany.mockResolvedValue([]);

    await getMouvementsExpirables("site-XYZ");

    const calls = mockMouvementStockFindMany.mock.calls as Array<[{ where: { siteId: string } }]>;
    calls.forEach((call) => {
      expect(call[0].where.siteId).toBe("site-XYZ");
    });
  });

  it("les appels Prisma filtrent sur type ENTREE uniquement", async () => {
    mockMouvementStockFindMany.mockResolvedValue([]);

    await getMouvementsExpirables("site-1");

    const calls = mockMouvementStockFindMany.mock.calls as Array<[{ where: { type: string } }]>;
    calls.forEach((call) => {
      expect(call[0].where.type).toBe("ENTREE");
    });
  });
});
