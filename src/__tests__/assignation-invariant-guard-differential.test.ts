/**
 * Tests GT.1-GT.3 — Guard de conservation différentiel (tolérance aux écarts préexistants)
 *
 * Complète assignation-invariant-guard.test.ts (16 tests existants, non modifiés) avec
 * les scénarios de la story GT :
 * - captureEcartsAssignation capture l'écart avant écriture
 * - verifyAssignationInvariant(ecartsRef) tolère un écart préexistant identique avant/après
 * - rejette si l'écart est aggravé par l'opération
 * - accepte si l'écart est réduit (amélioration)
 * - reste strict (écart de référence = 0) pour un bac absent de ecartsRef
 *   (ex. AssignationBac créée dans la même transaction)
 * - le message d'erreur contient le nom du bac (pas le cuid)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculerEcartsParBac,
  captureEcartsAssignation,
  verifyAssignationInvariant,
} from "@/lib/guards/assignation-invariant";
import { ConservationError } from "@/lib/errors";

const mockAssignationBacFindMany = vi.fn();
const mockReleveFindMany = vi.fn();
const mockTransfertGroupeFindMany = vi.fn();

function buildTx() {
  return {
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
    },
  } as unknown as Parameters<typeof verifyAssignationInvariant>[0];
}

const SITE_ID = "site-gt";
const VAGUE_ID = "vague-gt";
const BAC_A = "bac-gt-a";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GT.1 — calculerEcartsParBac (fonction pure partagée)", () => {
  it("retourne une map vide si bacIds est vide", async () => {
    const result = await calculerEcartsParBac(buildTx(), SITE_ID, VAGUE_ID, []);
    expect(result.size).toBe(0);
    expect(mockAssignationBacFindMany).not.toHaveBeenCalled();
  });

  it("calcule l'écart (actual - expected) et inclut le nom du bac depuis la relation bac", async () => {
    // nombreInitial=1000, aucun relevé → expected=1000, actual=1003 (falsifié) → ecart=+3
    mockAssignationBacFindMany.mockResolvedValueOnce([
      {
        id: "ab-1",
        bacId: BAC_A,
        nombreActuel: 1003,
        nombreInitial: 1000,
        bac: { nom: "Bac 11" },
      },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const result = await calculerEcartsParBac(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]);

    expect(result.get(BAC_A)).toEqual({
      expected: 1000,
      actual: 1003,
      ecart: 3,
      bacNom: "Bac 11",
    });
  });

  it("fallback sur bacId si la relation bac est absente (mock minimal)", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1000, nombreInitial: 1000 },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const result = await calculerEcartsParBac(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]);

    expect(result.get(BAC_A)?.bacNom).toBe(BAC_A);
  });
});

describe("GT.1 — captureEcartsAssignation", () => {
  it("retourne une map bacId -> ecart (sans le detail expected/actual/bacNom)", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 998, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const result = await captureEcartsAssignation(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]);

    expect(result.get(BAC_A)).toBe(-2);
  });

  it("un bac sans AssignationBac active n'apparaît pas dans la map", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([]); // aucune assignation active

    const result = await captureEcartsAssignation(buildTx(), SITE_ID, VAGUE_ID, [BAC_A]);

    expect(result.has(BAC_A)).toBe(false);
  });
});

describe("GT.1/GT.3 — verifyAssignationInvariant en mode différentiel (ecartsRef)", () => {
  it("accepte un écart préexistant identique avant/après (toléré, journalisé)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Écart avant = +2 (capturé), écart après = +2 (inchangé) → accepté
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1002, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const ecartsRef = new Map([[BAC_A, 2]]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).resolves.toBeUndefined();

    // Écart préexistant non-nul → journalisé
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("rejette si l'opération aggrave l'écart préexistant", async () => {
    // Écart avant = +2, écart après = +5 (aggravé de 3) → rejet
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1005, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const ecartsRef = new Map([[BAC_A, 2]]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).rejects.toThrow(ConservationError);
  });

  it("accepte si l'opération réduit l'écart préexistant (amélioration)", async () => {
    // Écart avant = +5, écart après = +2 (réduit) → accepté (décision GT : amélioration tolérée)
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1002, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const ecartsRef = new Map([[BAC_A, 5]]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).resolves.toBeUndefined();
  });

  it("reste strict (écart de référence = 0) pour un bac absent de ecartsRef (assignation créée dans la transaction)", async () => {
    // ecartsRef ne contient pas BAC_A (créé pendant la transaction) → référence 0
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1003, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const ecartsRef = new Map<string, number>(); // vide : BAC_A absent

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).rejects.toThrow(ConservationError);
  });

  it("sans ecartsRef (undefined), comportement strict identique au guard historique", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1003, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A])
    ).rejects.toThrow(ConservationError);
  });

  it("rejette une inversion de signe à magnitude égale (+2 → −2)", async () => {
    // Écart avant = +2, écart après = -2 (inversion, magnitude inchangée) → rejet :
    // 4 poissons de dérive malgré une magnitude abs identique.
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 998, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const ecartsRef = new Map([[BAC_A, 2]]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).rejects.toThrow(ConservationError);
  });

  it("rejette une inversion de signe avec magnitude réduite (+5 → −3)", async () => {
    // Écart avant = +5, écart après = -3 (inversion, magnitude réduite) → rejet quand même.
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 997, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const ecartsRef = new Map([[BAC_A, 5]]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).rejects.toThrow(ConservationError);
  });

  it("accepte une réduction du même côté négatif (−2 → −1)", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 999, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const ecartsRef = new Map([[BAC_A, -2]]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).resolves.toBeUndefined();
  });

  it("rejette une inversion de signe côté négatif vers positif (−2 → +1)", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1001, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const ecartsRef = new Map([[BAC_A, -2]]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).rejects.toThrow(ConservationError);
  });

  it("accepte un écart 0 → 0 avec ecartsRef fourni", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1000, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const ecartsRef = new Map([[BAC_A, 0]]);

    await expect(
      verifyAssignationInvariant(buildTx(), SITE_ID, VAGUE_ID, [BAC_A], ecartsRef)
    ).resolves.toBeUndefined();
  });

  it("le message d'erreur contient le nom du bac (pas le cuid) et les valeurs avant/après", async () => {
    mockAssignationBacFindMany.mockResolvedValueOnce([
      { id: "ab-1", bacId: BAC_A, nombreActuel: 1003, nombreInitial: 1000, bac: { nom: "Bac 11" } },
    ]);
    mockReleveFindMany.mockResolvedValueOnce([]);

    const ecartsRef = new Map([[BAC_A, 0]]);

    const err = await verifyAssignationInvariant(
      buildTx(),
      SITE_ID,
      VAGUE_ID,
      [BAC_A],
      ecartsRef
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ConservationError);
    expect(err.message).toContain("Bac 11");
    expect(err.message).not.toContain(BAC_A);
    expect(err.message).toContain("+3");
    expect(err.message).toMatch(/avant : 0/);
    expect(err.message).toContain("Vérifiez les derniers relevés");
  });
});
