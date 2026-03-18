/**
 * Tests — generator.ts (Sprint 21, Story S15-10)
 *
 * Couvre :
 *   EC-3.1  Deduplication meme regle+vague+jour
 *   EC-3.2  firedOnce marque apres creation (SEUIL_*)
 *   EC-3.3  Priorite : plus basse gagne (traitee en premier)
 *
 * Note : generateActivities() depend de prisma.$transaction.
 * On mock prisma pour eviter une connexion DB reelle.
 */

import { TypeDeclencheur, TypeActivite, StatutActivite } from "@/types";
import type { RegleActivite } from "@/types";
import type { RuleMatch, RuleEvaluationContext } from "@/types/activity-engine";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockActiviteCreate = vi.fn();
const mockActiviteFindFirst = vi.fn();
const mockRegleActiviteUpdateMany = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    activite: {
      create: (...args: unknown[]) => mockActiviteCreate(...args),
      findFirst: (...args: unknown[]) => mockActiviteFindFirst(...args),
    },
    regleActivite: {
      updateMany: (...args: unknown[]) => mockRegleActiviteUpdateMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegle(overrides: Partial<RegleActivite> = {}): RegleActivite {
  return {
    id: "regle-1",
    nom: "Biometrie hebdo",
    description: null,
    typeActivite: TypeActivite.BIOMETRIE,
    typeDeclencheur: TypeDeclencheur.RECURRENT,
    conditionValeur: null,
    conditionValeur2: null,
    phaseMin: null,
    phaseMax: null,
    intervalleJours: 7,
    titreTemplate: "Biometrie semaine {semaine}",
    descriptionTemplate: null,
    instructionsTemplate: null,
    priorite: 5,
    isActive: true,
    firedOnce: false,
    siteId: "site-1",
    userId: "user-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeContext(vagueId = "vague-1"): RuleEvaluationContext {
  return {
    vague: {
      id: vagueId,
      code: `V2026-00${vagueId.slice(-1)}`,
      dateDebut: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      nombreInitial: 1000,
      poidsMoyenInitial: 5,
      siteId: "site-1",
    },
    joursEcoules: 14,
    semaine: 3,
    indicateurs: {
      fcr: null,
      sgr: null,
      tauxSurvie: 97,
      biomasse: null,
      poidsMoyen: 80,
      nombreVivants: 970,
      tauxMortaliteCumule: 3,
    },
    stock: [],
    configElevage: null,
    derniersReleves: [],
    phase: "JUVENILE",
    bac: null,
  };
}

function makeMatch(regle: RegleActivite, vagueId = "vague-1", score = 50): RuleMatch {
  const ctx = makeContext(vagueId);
  return { regle, vague: ctx.vague, context: ctx, score, bacId: null, bacNom: null };
}

// ---------------------------------------------------------------------------
// Tests generateActivities
// ---------------------------------------------------------------------------

import { generateActivities } from "@/lib/activity-engine/generator";

describe("generateActivities — EC-3.1 : deduplication meme jour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cree une activite si pas de doublon (hasDuplicateToday = false)", async () => {
    // Setup transaction : pas de doublon, creation reussit
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        activite: {
          findFirst: vi.fn().mockResolvedValue(null), // pas de doublon
          create: mockActiviteCreate.mockResolvedValue({ id: "act-new" }),
        },
        regleActivite: {
          updateMany: mockRegleActiviteUpdateMany.mockResolvedValue({ count: 0 }),
        },
      })
    );

    const regle = makeRegle();
    const matches = [makeMatch(regle)];

    const result = await generateActivities(matches, "site-1", "system-user");
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("skip si doublon existe deja aujourd'hui (EC-3.1)", async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        activite: {
          findFirst: vi.fn().mockResolvedValue({ id: "act-existing" }), // doublon
          create: mockActiviteCreate,
        },
        regleActivite: {
          updateMany: mockRegleActiviteUpdateMany,
        },
      })
    );

    const regle = makeRegle();
    const matches = [makeMatch(regle)];

    const result = await generateActivities(matches, "site-1", "system-user");
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockActiviteCreate).not.toHaveBeenCalled();
  });
});

describe("generateActivities — EC-3.2 : firedOnce apres creation SEUIL_*", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const seuilTypes = [
    TypeDeclencheur.SEUIL_POIDS,
    TypeDeclencheur.SEUIL_QUALITE,
    TypeDeclencheur.SEUIL_MORTALITE,
    TypeDeclencheur.FCR_ELEVE,
    TypeDeclencheur.STOCK_BAS,
  ];

  for (const type of seuilTypes) {
    it(`marque firedOnce=true apres creation pour ${type} (EC-3.2)`, async () => {
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
        fn({
          activite: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: "act-new" }),
          },
          regleActivite: { updateMany },
        })
      );

      const regle = makeRegle({ typeDeclencheur: type, conditionValeur: null });
      const matches = [makeMatch(regle)];

      await generateActivities(matches, "site-1", "system-user");
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "regle-1", firedOnce: false }),
          data: { firedOnce: true },
        })
      );
    });
  }

  it("ne marque pas firedOnce pour les types non-SEUIL (RECURRENT)", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        activite: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "act-new" }),
        },
        regleActivite: { updateMany },
      })
    );

    const regle = makeRegle({ typeDeclencheur: TypeDeclencheur.RECURRENT });
    const matches = [makeMatch(regle)];

    await generateActivities(matches, "site-1", "system-user");
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("generateActivities — EC-3.3 : priorite, ordre de traitement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("traite les matches de priorite basse en premier pour la meme vague", async () => {
    const order: number[] = [];

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      return fn({
        activite: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(async ({ data }: { data: { priorite: number } }) => {
            order.push(data.priorite);
            return { id: `act-${data.priorite}` };
          }),
        },
        regleActivite: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      });
    });

    const regleHaute = makeRegle({ id: "r-haute", priorite: 1 });
    const regleBasse = makeRegle({ id: "r-basse", priorite: 8 });

    // On passe la haute en premier dans la liste, mais la basse doit etre traitee en premier
    const matches = [
      makeMatch(regleHaute, "vague-1", 100),
      makeMatch(regleBasse, "vague-1", 30),
    ];

    await generateActivities(matches, "site-1", "system-user");
    // priorite 1 devrait etre traitee en premier (sort par priorite ASC)
    expect(order[0]).toBe(1);
    expect(order[1]).toBe(8);
  });
});

describe("generateActivities — gestion des erreurs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("capture les erreurs et les rapporte sans lever une exception globale", async () => {
    mockTransaction.mockRejectedValue(new Error("DB connection error"));

    const regle = makeRegle();
    const matches = [makeMatch(regle)];

    const result = await generateActivities(matches, "site-1", "system-user");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("regle-1");
    expect(result.created).toBe(0);
  });

  it("retourne un bilan vide si matches est vide", async () => {
    const result = await generateActivities([], "site-1", "system-user");
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe("generateActivities — multiple vagues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("traite les matches de deux vagues differentes independamment", async () => {
    const createdIds: string[] = [];
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        activite: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(async ({ data }: { data: { vagueId: string } }) => {
            createdIds.push(data.vagueId);
            return { id: `act-${data.vagueId}` };
          }),
        },
        regleActivite: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      })
    );

    const regle = makeRegle();
    const matches = [
      makeMatch(regle, "vague-1"),
      makeMatch(regle, "vague-2"),
    ];

    const result = await generateActivities(matches, "site-1", "system-user");
    expect(result.created).toBe(2);
    expect(createdIds).toContain("vague-1");
    expect(createdIds).toContain("vague-2");
  });
});
