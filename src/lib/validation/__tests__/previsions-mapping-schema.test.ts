/**
 * Tests — `ligneMappingRapprochementInputSchema` (Sprint PR3-bis, story
 * PR3bis.1, pre-analyse section 1 : gap signale par la review PR3).
 *
 * Verifie par falsification que `cibleId` est lie a `cibleType` :
 * - POSTE_PREVISION / ALIMENT_PREVISION exigent un `cibleId` reel.
 * - VENTE_PREVUE / NON_RAPPROCHE exigent l'ABSENCE de `cibleId`.
 */
import { describe, it, expect } from "vitest";
import { ligneMappingRapprochementInputSchema } from "@/lib/validation/previsions.schema";
import { SourceRapprochement, CibleRapprochement } from "@/types";

const base = {
  sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
  sourceCle: "ALIMENT",
};

describe("ligneMappingRapprochementInputSchema", () => {
  it("accepte POSTE_PREVISION avec cibleId renseigne", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.POSTE_PREVISION,
      cibleId: "poste-1",
    });
    expect(res.success).toBe(true);
  });

  it("rejette POSTE_PREVISION sans cibleId", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.POSTE_PREVISION,
      cibleId: null,
    });
    expect(res.success).toBe(false);
  });

  it("rejette ALIMENT_PREVISION sans cibleId (champ absent)", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.ALIMENT_PREVISION,
    });
    expect(res.success).toBe(false);
  });

  it("accepte NON_RAPPROCHE avec cibleId null", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.NON_RAPPROCHE,
      cibleId: null,
    });
    expect(res.success).toBe(true);
  });

  it("accepte NON_RAPPROCHE avec cibleId absent", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.NON_RAPPROCHE,
    });
    expect(res.success).toBe(true);
  });

  it("rejette NON_RAPPROCHE avec un cibleId renseigne", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.NON_RAPPROCHE,
      cibleId: "poste-1",
    });
    expect(res.success).toBe(false);
  });

  it("accepte VENTE_PREVUE sans cibleId", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.VENTE_PREVUE,
    });
    expect(res.success).toBe(true);
  });

  it("rejette VENTE_PREVUE avec un cibleId renseigne", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.VENTE_PREVUE,
      cibleId: "x",
    });
    expect(res.success).toBe(false);
  });
});
