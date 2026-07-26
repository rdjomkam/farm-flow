/**
 * Tests unitaires — SU.12 : contrainte d'unicité numero/code globale → par site.
 *
 * Contexte : `@unique` sur `numero`/`code` était global dans Prisma alors que
 * `generateNextNumero` (SU.3) génère la séquence scopée par `siteId`. La
 * migration `20260726174843_numero_unique_par_site` remplace le `@unique`
 * global par `@@unique([siteId, numero])` / `@@unique([siteId, code])` pour
 * 9 modèles. 3 call-sites faisaient une vérification manuelle d'unicité
 * AVANT le create/update en interrogeant `numero`/`code` seul (sans siteId) :
 * `createLotGeniteurs`, `createIncubation`, `createPonte`, `updatePonte`. Ce
 * fichier couvre ces call-sites au niveau requête, avec un `tx`/`prisma`
 * mocké (pattern `src/__tests__/queries/transferts.test.ts`).
 *
 * SU.13 étend ce correctif à une 10e famille oubliée par SU.3/SU.12 :
 * `LotAlevins.code`, généré par `recordEclosion` (src/lib/queries/incubations.ts).
 * `recordEclosion` utilisait un `$transaction([...])` (forme array, sans
 * client `tx`) — converti en `$transaction(async (tx) => ...)` pour pouvoir
 * poser le verrou consultatif ET vérifier l'unicité (siteId, code) DANS la
 * transaction (voir docs/analysis/pre-analysis-sprint-SU-numero.md, item D).
 * La suite « recordEclosion » ci-dessous couvre ce call-site.
 *
 * Ces tests prouvent, au niveau de la couche requête :
 *   1. Le pré-check d'unicité utilise désormais la clé composite
 *      `siteId_<numero|code>` (jamais `numero`/`code` seul).
 *   2. Deux sites différents portant le même code/numero NE sont PAS en
 *      conflit (le mock ne renvoie une ligne existante que si `siteId`
 *      correspond aussi).
 *   3. Un doublon au sein du MÊME site est bien rejeté (l'erreur métier est
 *      levée avant le create()/update()).
 *
 * La preuve de la contrainte réelle au niveau PostgreSQL (le
 * `CREATE UNIQUE INDEX ... ("siteId", "numero")`) a été vérifiée manuellement
 * en base de dev (transaction ROLLBACK, aucune donnée persistée) — voir le
 * rapport de la story SU.12. Conformément au reste de la suite (ERR-103
 * leçon e), on ne mocke pas ici le moteur PostgreSQL lui-même : on teste la
 * logique applicative qui consomme la contrainte.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SexeReproducteur,
  SubstratIncubation,
  StatutPonte,
  StatutReproducteur,
  StatutIncubation,
} from "@/types";

// ---------------------------------------------------------------------------
// Magasins en mémoire (un par table simulée) + mocks Prisma
// ---------------------------------------------------------------------------

interface FakeRow {
  id: string;
  siteId: string;
  [key: string]: unknown;
}

const lotGeniteursRows: FakeRow[] = [];
const incubationRows: FakeRow[] = [];
const ponteRows: FakeRow[] = [];
const lotAlevinsRows: FakeRow[] = [];

function findByCompositeKey(
  rows: FakeRow[],
  field: "code" | "numero",
  where: Record<string, unknown>
): FakeRow | null {
  const compositeKey = `siteId_${field}`;
  const composite = where[compositeKey] as
    | { siteId: string; [k: string]: string }
    | undefined;
  if (!composite) return null;
  return (
    rows.find(
      (r) => r.siteId === composite.siteId && r[field] === composite[field]
    ) ?? null
  );
}

function findFirstByField(
  rows: FakeRow[],
  field: "code" | "numero",
  where: Record<string, unknown>
): FakeRow | null {
  const siteId = where.siteId as string | undefined;
  const value = where[field] as string | undefined;
  const excludeId = (where.NOT as { id?: string } | undefined)?.id;
  return (
    rows.find(
      (r) =>
        r[field] === value &&
        (siteId === undefined || r.siteId === siteId) &&
        r.id !== excludeId
    ) ?? null
  );
}

const mockGenerateNextNumero = vi.fn(async () => "AUTO-GEN");

// --- LotGeniteurs (créé via tx dans createLotGeniteurs) ---
const mockLotGeniteursFindUnique = vi.fn(
  async ({ where }: { where: Record<string, unknown> }) =>
    findByCompositeKey(lotGeniteursRows, "code", where)
);
const mockLotGeniteursCreate = vi.fn(async ({ data }: { data: FakeRow }) => {
  const row: FakeRow = { id: `lg-${lotGeniteursRows.length + 1}`, ...data };
  lotGeniteursRows.push(row);
  return row;
});
const mockLotGeniteursFindUniqueOrThrow = vi.fn(
  async ({ where }: { where: { id: string } }) => {
    const row = lotGeniteursRows.find((r) => r.id === where.id);
    if (!row) throw new Error("not found");
    return row;
  }
);

// --- Incubation (créé via tx dans createIncubation) ---
const mockIncubationFindUnique = vi.fn(
  async ({ where }: { where: Record<string, unknown> }) =>
    findByCompositeKey(incubationRows, "code", where)
);
const mockIncubationCreate = vi.fn(async ({ data }: { data: FakeRow }) => {
  const row: FakeRow = { id: `inc-${incubationRows.length + 1}`, ...data };
  incubationRows.push(row);
  return row;
});
const mockIncubationFindUniqueOrThrow = vi.fn(
  async ({ where }: { where: { id: string } }) => {
    const row = incubationRows.find((r) => r.id === where.id);
    if (!row) throw new Error("not found");
    return row;
  }
);

// `prisma.incubation.findFirst` HORS transaction — utilisé par `recordEclosion`
// pour lire l'incubation (ponteId, nombreOeufsPlaces, statut) avant d'entrer
// dans la transaction interactive (SU.13).
const mockIncubationFindFirstTopLevel = vi.fn(
  async ({ where }: { where: { id: string; siteId: string } }) =>
    incubationRows.find(
      (r) => r.id === where.id && r.siteId === where.siteId
    ) ?? null
);

// `tx.incubation.update` DANS la transaction interactive de `recordEclosion`
// (SU.13 : conversion depuis $transaction([...]) vers $transaction(async tx => ...)).
const mockIncubationUpdateTx = vi.fn(
  async ({ where, data }: { where: { id: string }; data: FakeRow }) => {
    const row = incubationRows.find((r) => r.id === where.id);
    if (!row) throw new Error("not found");
    Object.assign(row, data);
    return row;
  }
);

// --- LotAlevins (créé via tx dans recordEclosion — SU.13) ---
const mockLotAlevinsFindUnique = vi.fn(
  async ({ where }: { where: Record<string, unknown> }) =>
    findByCompositeKey(lotAlevinsRows, "code", where)
);
const mockLotAlevinsCreate = vi.fn(async ({ data }: { data: FakeRow }) => {
  const row: FakeRow = { id: `lot-${lotAlevinsRows.length + 1}`, ...data };
  lotAlevinsRows.push(row);
  return row;
});

// --- Ponte (createPonte legacy + updatePonte utilisent `prisma` directement,
// PAS de transaction — voir src/lib/queries/pontes.ts) ---
const mockPonteFindUnique = vi.fn(
  async ({ where }: { where: Record<string, unknown> }) =>
    findByCompositeKey(ponteRows, "code", where)
);
const mockPonteCreate = vi.fn(async ({ data }: { data: FakeRow }) => {
  const row: FakeRow = { id: `ponte-${ponteRows.length + 1}`, ...data };
  ponteRows.push(row);
  return row;
});
const mockPonteFindUniqueOrThrow = vi.fn(
  async ({ where }: { where: { id: string } }) => {
    const row = ponteRows.find((r) => r.id === where.id);
    if (!row) throw new Error("not found");
    return row;
  }
);
const mockPonteUpdateMany = vi.fn(
  async ({ where, data }: { where: Record<string, unknown>; data: FakeRow }) => {
    const row = ponteRows.find(
      (r) => r.id === where.id && r.siteId === where.siteId
    );
    if (!row) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  }
);
/**
 * `prisma.ponte.findFirst` (hors transaction) sert deux usages distincts dans
 * `updatePonte` : (1) pré-check d'unicité du code (where: siteId, code, NOT
 * id) et (2) relecture finale par id (where: id, siteId). On distingue les
 * deux via la présence de `code` dans le where.
 */
const mockPonteFindFirst = vi.fn(
  async ({ where }: { where: Record<string, unknown> }) => {
    if ("code" in where) {
      return findFirstByField(ponteRows, "code", where);
    }
    return (
      ponteRows.find((r) => r.id === where.id && r.siteId === where.siteId) ??
      null
    );
  }
);

const mockReproducteurFindFirst = vi.fn(async () => ({
  id: "fem-1",
  statut: StatutReproducteur.ACTIF,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        lotGeniteurs: {
          findUnique: mockLotGeniteursFindUnique,
          create: mockLotGeniteursCreate,
        },
        incubation: {
          findUnique: mockIncubationFindUnique,
          create: mockIncubationCreate,
          // recordEclosion (SU.13) : update DANS la transaction interactive.
          update: mockIncubationUpdateTx,
        },
        lotAlevins: {
          findUnique: mockLotAlevinsFindUnique,
          create: mockLotAlevinsCreate,
        },
      }),
    lotGeniteurs: {
      findUniqueOrThrow: mockLotGeniteursFindUniqueOrThrow,
    },
    incubation: {
      findUniqueOrThrow: mockIncubationFindUniqueOrThrow,
      // recordEclosion (SU.13) : lecture HORS transaction, avant le $transaction.
      findFirst: mockIncubationFindFirstTopLevel,
    },
    ponte: {
      findUnique: mockPonteFindUnique,
      create: mockPonteCreate,
      findUniqueOrThrow: mockPonteFindUniqueOrThrow,
      findFirst: mockPonteFindFirst,
      updateMany: mockPonteUpdateMany,
    },
    reproducteur: { findFirst: mockReproducteurFindFirst },
  },
}));

vi.mock("@/lib/queries/numero-utils", () => ({
  generateNextNumero: (...args: unknown[]) => mockGenerateNextNumero(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  lotGeniteursRows.length = 0;
  incubationRows.length = 0;
  ponteRows.length = 0;
  lotAlevinsRows.length = 0;
  mockGenerateNextNumero.mockImplementation(async () => "AUTO-GEN");
  mockReproducteurFindFirst.mockImplementation(async () => ({
    id: "fem-1",
    statut: StatutReproducteur.ACTIF,
  }));
});

// ---------------------------------------------------------------------------
// Suite 1 — createLotGeniteurs (code, scope siteId + sexe)
// ---------------------------------------------------------------------------

describe("createLotGeniteurs — SU.12 unicité (siteId, code)", () => {
  it("deux sites différents peuvent porter le même code (pas de collision)", async () => {
    const { createLotGeniteurs } = await import("@/lib/queries/geniteurs");

    await createLotGeniteurs("site-A", {
      nom: "Lot A",
      sexe: SexeReproducteur.FEMELLE,
      nombrePoissons: 10,
      code: "LG-F-001",
    });

    await expect(
      createLotGeniteurs("site-B", {
        nom: "Lot B",
        sexe: SexeReproducteur.FEMELLE,
        nombrePoissons: 5,
        code: "LG-F-001",
      })
    ).resolves.toBeDefined();

    expect(lotGeniteursRows).toHaveLength(2);
    expect(lotGeniteursRows[0].siteId).toBe("site-A");
    expect(lotGeniteursRows[1].siteId).toBe("site-B");
  });

  it("rejette un doublon de code au sein du MÊME site", async () => {
    const { createLotGeniteurs } = await import("@/lib/queries/geniteurs");

    await createLotGeniteurs("site-A", {
      nom: "Lot A",
      sexe: SexeReproducteur.FEMELLE,
      nombrePoissons: 10,
      code: "LG-F-001",
    });

    await expect(
      createLotGeniteurs("site-A", {
        nom: "Lot A bis",
        sexe: SexeReproducteur.FEMELLE,
        nombrePoissons: 3,
        code: "LG-F-001",
      })
    ).rejects.toThrow('Le code "LG-F-001" est déjà utilisé');

    expect(lotGeniteursRows).toHaveLength(1);
  });

  it("interroge la clé composite siteId_code (jamais code seul)", async () => {
    const { createLotGeniteurs } = await import("@/lib/queries/geniteurs");

    await createLotGeniteurs("site-A", {
      nom: "Lot A",
      sexe: SexeReproducteur.FEMELLE,
      nombrePoissons: 10,
      code: "LG-F-042",
    });

    expect(mockLotGeniteursFindUnique).toHaveBeenCalledWith({
      where: { siteId_code: { siteId: "site-A", code: "LG-F-042" } },
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — createIncubation (code, scope siteId)
// ---------------------------------------------------------------------------

describe("createIncubation — SU.12 unicité (siteId, code)", () => {
  it("deux sites différents peuvent porter le même code (pas de collision)", async () => {
    const { createIncubation } = await import("@/lib/queries/incubations");

    await createIncubation("site-A", {
      ponteId: "ponte-1",
      substrat: SubstratIncubation.RACINES_PISTIA,
      code: "INC-2026-001",
    });

    await expect(
      createIncubation("site-B", {
        ponteId: "ponte-2",
        substrat: SubstratIncubation.RACINES_PISTIA,
        code: "INC-2026-001",
      })
    ).resolves.toBeDefined();

    expect(incubationRows).toHaveLength(2);
  });

  it("rejette un doublon de code au sein du MÊME site", async () => {
    const { createIncubation } = await import("@/lib/queries/incubations");

    await createIncubation("site-A", {
      ponteId: "ponte-1",
      substrat: SubstratIncubation.RACINES_PISTIA,
      code: "INC-2026-001",
    });

    await expect(
      createIncubation("site-A", {
        ponteId: "ponte-1",
        substrat: SubstratIncubation.RACINES_PISTIA,
        code: "INC-2026-001",
      })
    ).rejects.toThrow('Le code "INC-2026-001" est déjà utilisé');

    expect(incubationRows).toHaveLength(1);
  });

  it("interroge la clé composite siteId_code (jamais code seul)", async () => {
    const { createIncubation } = await import("@/lib/queries/incubations");

    await createIncubation("site-A", {
      ponteId: "ponte-1",
      substrat: SubstratIncubation.RACINES_PISTIA,
      code: "INC-2026-007",
    });

    expect(mockIncubationFindUnique).toHaveBeenCalledWith({
      where: { siteId_code: { siteId: "site-A", code: "INC-2026-007" } },
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — createPonte (legacy) : unicité (siteId, code)
// ---------------------------------------------------------------------------

describe("createPonte (API historique) — SU.12 unicité (siteId, code)", () => {
  it("deux sites différents peuvent porter le même code (pas de collision)", async () => {
    const { createPonte } = await import("@/lib/queries/pontes");

    await createPonte("site-A", {
      code: "PONTE-2026-001",
      femelleId: "fem-1",
      datePonte: new Date().toISOString(),
    });

    await expect(
      createPonte("site-B", {
        code: "PONTE-2026-001",
        femelleId: "fem-2",
        datePonte: new Date().toISOString(),
      })
    ).resolves.toBeDefined();

    expect(ponteRows).toHaveLength(2);
  });

  it("rejette un doublon de code au sein du MÊME site", async () => {
    const { createPonte } = await import("@/lib/queries/pontes");

    await createPonte("site-A", {
      code: "PONTE-2026-001",
      femelleId: "fem-1",
      datePonte: new Date().toISOString(),
    });

    await expect(
      createPonte("site-A", {
        code: "PONTE-2026-001",
        femelleId: "fem-1",
        datePonte: new Date().toISOString(),
      })
    ).rejects.toThrow('Le code "PONTE-2026-001" est deja utilise');

    expect(ponteRows).toHaveLength(1);
  });

  it("interroge la clé composite siteId_code (jamais code seul)", async () => {
    const { createPonte } = await import("@/lib/queries/pontes");

    await createPonte("site-A", {
      code: "PONTE-2026-009",
      femelleId: "fem-1",
      datePonte: new Date().toISOString(),
    });

    expect(mockPonteFindUnique).toHaveBeenCalledWith({
      where: { siteId_code: { siteId: "site-A", code: "PONTE-2026-009" } },
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — updatePonte : vérification d'unicité scopée par site
// ---------------------------------------------------------------------------

describe("updatePonte — SU.12 unicité (siteId, code) sur modification", () => {
  it("permet de renommer une ponte vers un code déjà utilisé sur un AUTRE site", async () => {
    const { updatePonte } = await import("@/lib/queries/pontes");

    ponteRows.push(
      { id: "ponte-x", siteId: "site-B", code: "PONTE-2026-001", statut: StatutPonte.EN_COURS },
      { id: "ponte-y", siteId: "site-A", code: "PONTE-2026-999", statut: StatutPonte.EN_COURS }
    );

    await expect(
      updatePonte("ponte-y", "site-A", { code: "PONTE-2026-001" })
    ).resolves.toBeDefined();
  });

  it("rejette le renommage vers un code déjà utilisé au sein du MÊME site", async () => {
    const { updatePonte } = await import("@/lib/queries/pontes");

    ponteRows.push(
      { id: "ponte-x", siteId: "site-A", code: "PONTE-2026-001", statut: StatutPonte.EN_COURS },
      { id: "ponte-y", siteId: "site-A", code: "PONTE-2026-999", statut: StatutPonte.EN_COURS }
    );

    await expect(
      updatePonte("ponte-y", "site-A", { code: "PONTE-2026-001" })
    ).rejects.toThrow('Le code "PONTE-2026-001" est deja utilise');
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — recordEclosion (SU.13) : LotAlevins.code, scope (siteId, code)
// ---------------------------------------------------------------------------

describe("recordEclosion — SU.13 unicité (siteId, code) sur LotAlevins", () => {
  function seedIncubation(id: string, siteId: string, ponteId = "ponte-1") {
    incubationRows.push({
      id,
      siteId,
      ponteId,
      nombreOeufsPlaces: 1000,
      statut: StatutIncubation.EN_COURS,
    });
  }

  it("deux sites différents peuvent porter le même code de lot d'alevins (pas de collision)", async () => {
    const { recordEclosion } = await import("@/lib/queries/incubations");

    seedIncubation("inc-A", "site-A");
    seedIncubation("inc-B", "site-B");

    await recordEclosion("inc-A", "site-A", {
      nombreLarvesEcloses: 800,
      dateEclosionReelle: new Date().toISOString(),
    });

    await expect(
      recordEclosion("inc-B", "site-B", {
        nombreLarvesEcloses: 500,
        dateEclosionReelle: new Date().toISOString(),
      })
    ).resolves.toBeDefined();

    // generateNextNumero est mocké pour retourner toujours "AUTO-GEN" : les
    // deux lots portent donc le même code, mais sur deux sites distincts.
    expect(lotAlevinsRows).toHaveLength(2);
    expect(lotAlevinsRows[0].siteId).toBe("site-A");
    expect(lotAlevinsRows[1].siteId).toBe("site-B");
    expect(lotAlevinsRows[0].code).toBe(lotAlevinsRows[1].code);
  });

  it("rejette un doublon de code au sein du MÊME site", async () => {
    const { recordEclosion } = await import("@/lib/queries/incubations");

    seedIncubation("inc-A", "site-A");
    seedIncubation("inc-A2", "site-A");

    await recordEclosion("inc-A", "site-A", {
      nombreLarvesEcloses: 800,
      dateEclosionReelle: new Date().toISOString(),
    });

    // generateNextNumero renvoie toujours "AUTO-GEN" (mock) : la seconde
    // éclosion du même site tente donc de créer un lot avec le même code.
    await expect(
      recordEclosion("inc-A2", "site-A", {
        nombreLarvesEcloses: 300,
        dateEclosionReelle: new Date().toISOString(),
      })
    ).rejects.toThrow('Le code "AUTO-GEN" est déjà utilisé');

    expect(lotAlevinsRows).toHaveLength(1);
  });

  it("interroge la clé composite siteId_code (jamais code seul) pour le pré-check d'unicité", async () => {
    const { recordEclosion } = await import("@/lib/queries/incubations");

    seedIncubation("inc-A", "site-A");

    await recordEclosion("inc-A", "site-A", {
      nombreLarvesEcloses: 800,
      dateEclosionReelle: new Date().toISOString(),
    });

    expect(mockLotAlevinsFindUnique).toHaveBeenCalledWith({
      where: { siteId_code: { siteId: "site-A", code: "AUTO-GEN" } },
      select: { id: true },
    });
  });

  it("pose le verrou consultatif (generateNextNumero) DANS la transaction interactive", async () => {
    const { recordEclosion } = await import("@/lib/queries/incubations");

    seedIncubation("inc-A", "site-A");

    await recordEclosion("inc-A", "site-A", {
      nombreLarvesEcloses: 800,
      dateEclosionReelle: new Date().toISOString(),
    });

    // generateNextNumero est appelé avec le client `tx` (le paramètre reçu
    // par le callback du $transaction), pas le client global `prisma` — la
    // transaction est bien de forme callback ($transaction(async (tx) => ...)),
    // condition nécessaire pour que le verrou pg_advisory_xact_lock protège
    // effectivement la fenêtre lecture-écriture (SU.13, cf. SU.3).
    expect(mockGenerateNextNumero).toHaveBeenCalledWith(
      expect.objectContaining({ lotAlevins: expect.anything() }),
      "lotAlevins",
      "LOT",
      "site-A",
      { field: "code" }
    );
  });
});
