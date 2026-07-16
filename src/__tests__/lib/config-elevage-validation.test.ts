/**
 * Tests de regression — C1 (review Sprint SC2) : poidsSacKg absent du schema Zod
 * de ConfigElevage, ce qui causait sa suppression silencieuse par safeParse().
 *
 * Adresse : docs/reviews (CHANGES_REQUESTED, bug C1)
 */

import { describe, it, expect } from "vitest";
import {
  createConfigElevageSchema,
  updateConfigElevageSchema,
} from "@/lib/validation/config-elevage";
import { PhaseElevage } from "@/types";

const alimentTailleConfig = [
  { poidsMin: 0, poidsMax: 5, tailleGranule: "0.5mm" },
  { poidsMin: 5, poidsMax: 1000, tailleGranule: "2mm" },
];

const alimentTauxConfig = Object.values(PhaseElevage).map((phase) => ({
  phase,
  tauxMin: 2,
  tauxMax: 5,
  frequence: 2,
}));

const validCreateInput = {
  nom: "Profil standard",
  poidsObjectif: 800,
  dureeEstimeeCycle: 180,
  tauxSurvieObjectif: 85,
  alimentTailleConfig,
  alimentTauxConfig,
  gompertzMinPoints: 5,
};

describe("config-elevage validation — poidsSacKg (C1)", () => {
  it("createConfigElevageSchema conserve poidsSacKg quand fourni", () => {
    const result = createConfigElevageSchema.parse({
      ...validCreateInput,
      poidsSacKg: 25,
    });
    expect(result.poidsSacKg).toBe(25);
  });

  it("createConfigElevageSchema accepte poidsSacKg null", () => {
    const result = createConfigElevageSchema.parse({
      ...validCreateInput,
      poidsSacKg: null,
    });
    expect(result.poidsSacKg).toBeNull();
  });

  it("createConfigElevageSchema accepte l'absence de poidsSacKg", () => {
    const result = createConfigElevageSchema.parse(validCreateInput);
    expect(result.poidsSacKg).toBeUndefined();
  });

  it("createConfigElevageSchema rejette poidsSacKg negatif ou nul", () => {
    expect(() =>
      createConfigElevageSchema.parse({ ...validCreateInput, poidsSacKg: -5 })
    ).toThrow();
    expect(() =>
      createConfigElevageSchema.parse({ ...validCreateInput, poidsSacKg: 0 })
    ).toThrow();
  });

  it("createConfigElevageSchema rejette poidsSacKg au-dessus de 100", () => {
    expect(() =>
      createConfigElevageSchema.parse({ ...validCreateInput, poidsSacKg: 250 })
    ).toThrow();
  });

  it("updateConfigElevageSchema conserve poidsSacKg en mise a jour partielle", () => {
    const result = updateConfigElevageSchema.parse({ poidsSacKg: 25 });
    expect(result.poidsSacKg).toBe(25);
  });

  it("updateConfigElevageSchema accepte poidsSacKg null", () => {
    const result = updateConfigElevageSchema.parse({ poidsSacKg: null });
    expect(result.poidsSacKg).toBeNull();
  });

  it("updateConfigElevageSchema rejette poidsSacKg hors bornes", () => {
    expect(() => updateConfigElevageSchema.parse({ poidsSacKg: -5 })).toThrow();
    expect(() => updateConfigElevageSchema.parse({ poidsSacKg: 250 })).toThrow();
  });
});
