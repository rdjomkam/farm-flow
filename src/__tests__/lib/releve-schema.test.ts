/**
 * Tests unitaires pour les schemas Zod de validation des releves.
 *
 * Verifie :
 * - Schemas de creation par type (biometrie, mortalite, alimentation, qualite_eau, comptage, observation, renouvellement)
 * - Schema de mise a jour (PUT/PATCH)
 * - Bornes numeriques : pH [0-14], temperature [0-50], oxygene [0-20], ammoniac [0-10]
 * - Limites de longueur : notes 2000, description 2000, raison 500
 * - Validation consommations
 * - Validation date (ISO 8601, pas future)
 */

import { describe, it, expect } from "vitest";
import {
  createBiometrieSchema,
  createMortaliteSchema,
  createAlimentationSchema,
  createQualiteEauSchema,
  createComptageSchema,
  createObservationSchema,
  createRenouvellementSchema,
  createReleveSchema,
  updateReleveSchema,
  patchReleveSchema,
  zodErrorToFieldErrors,
} from "@/lib/validation/releve.schema";
import {
  notesSchema,
  descriptionSchema,
  raisonSchema,
  consommationsSchema,
  releveDateSchema,
  updateDateSchema,
} from "@/lib/validation/common.schema";
import { TypeReleve, CauseMortalite, TypeAliment, MethodeComptage } from "@/types";
import type { ZodError } from "zod";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pastDate(daysAgo = 1): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function futureDate(daysAhead = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString();
}

/** Compatible Zod v3 (errors) and v4 (issues) */
function getIssues(error: ZodError): Array<{ path: (string | number)[]; message: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (error as any).issues ?? (error as any).errors ?? [];
}

const baseCreate = {
  vagueId: "vague-1",
  bacId: "bac-1",
};

// ---------------------------------------------------------------------------
// zodErrorToFieldErrors
// ---------------------------------------------------------------------------

describe("zodErrorToFieldErrors", () => {
  it("converts ZodError to field error array", () => {
    const result = createBiometrieSchema.safeParse({ typeReleve: TypeReleve.BIOMETRIE, vagueId: "v", bacId: "b" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodErrorToFieldErrors(result.error);
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toHaveProperty("field");
      expect(errors[0]).toHaveProperty("message");
    }
  });
});

// ---------------------------------------------------------------------------
// Schemas communs
// ---------------------------------------------------------------------------

describe("notesSchema", () => {
  it("accepts undefined", () => {
    expect(notesSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts null", () => {
    expect(notesSchema.safeParse(null).success).toBe(true);
  });

  it("accepts a short string", () => {
    expect(notesSchema.safeParse("quelques notes").success).toBe(true);
  });

  it("rejects strings over 2000 characters", () => {
    const result = notesSchema.safeParse("a".repeat(2001));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = getIssues(result.error);
      expect(issues[0]?.message).toContain("2000");
    }
  });
});

describe("descriptionSchema", () => {
  it("accepts a valid description", () => {
    expect(descriptionSchema.safeParse("Description valide").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(descriptionSchema.safeParse("").success).toBe(false);
  });

  it("rejects strings over 2000 characters", () => {
    expect(descriptionSchema.safeParse("a".repeat(2001)).success).toBe(false);
  });
});

describe("raisonSchema", () => {
  it("accepts a valid raison", () => {
    expect(raisonSchema.safeParse("Erreur de saisie du poids").success).toBe(true);
  });

  it("rejects raison shorter than 5 characters", () => {
    expect(raisonSchema.safeParse("abc").success).toBe(false);
  });

  it("rejects raison over 500 characters", () => {
    expect(raisonSchema.safeParse("a".repeat(501)).success).toBe(false);
  });

  it("trims whitespace", () => {
    const result = raisonSchema.safeParse("  Raison valide  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Raison valide");
    }
  });
});

describe("consommationsSchema", () => {
  it("accepts undefined", () => {
    expect(consommationsSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts a valid array", () => {
    expect(consommationsSchema.safeParse([{ produitId: "p-1", quantite: 5 }]).success).toBe(true);
  });

  it("rejects item with missing produitId", () => {
    expect(consommationsSchema.safeParse([{ quantite: 5 }]).success).toBe(false);
  });

  it("rejects item with quantite <= 0", () => {
    expect(consommationsSchema.safeParse([{ produitId: "p-1", quantite: 0 }]).success).toBe(false);
  });

  it("rejects item with negative quantite", () => {
    expect(consommationsSchema.safeParse([{ produitId: "p-1", quantite: -1 }]).success).toBe(false);
  });
});

describe("releveDateSchema", () => {
  it("accepts undefined", () => {
    expect(releveDateSchema.safeParse(undefined).success).toBe(true);
  });

  it("accepts a past date", () => {
    expect(releveDateSchema.safeParse(pastDate()).success).toBe(true);
  });

  it("rejects a future date", () => {
    const result = releveDateSchema.safeParse(futureDate());
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = getIssues(result.error);
      expect(issues[0]?.message).toContain("futur");
    }
  });

  it("rejects an invalid date string", () => {
    expect(releveDateSchema.safeParse("not-a-date").success).toBe(false);
  });
});

describe("updateDateSchema", () => {
  it("accepts undefined", () => {
    expect(updateDateSchema.safeParse(undefined).success).toBe(true);
  });

  it("rejects a future date", () => {
    expect(updateDateSchema.safeParse(futureDate()).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createBiometrieSchema
// ---------------------------------------------------------------------------

describe("createBiometrieSchema", () => {
  const valid = {
    ...baseCreate,
    typeReleve: TypeReleve.BIOMETRIE,
    poidsMoyen: 150,
    echantillonCount: 30,
  };

  it("accepts valid biometrie data", () => {
    expect(createBiometrieSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing poidsMoyen", () => {
    const result = createBiometrieSchema.safeParse({ ...valid, poidsMoyen: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects poidsMoyen <= 0", () => {
    expect(createBiometrieSchema.safeParse({ ...valid, poidsMoyen: 0 }).success).toBe(false);
    expect(createBiometrieSchema.safeParse({ ...valid, poidsMoyen: -1 }).success).toBe(false);
  });

  it("rejects missing echantillonCount", () => {
    const result = createBiometrieSchema.safeParse({ ...valid, echantillonCount: undefined });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer echantillonCount", () => {
    expect(createBiometrieSchema.safeParse({ ...valid, echantillonCount: 1.5 }).success).toBe(false);
  });

  it("rejects echantillonCount <= 0", () => {
    expect(createBiometrieSchema.safeParse({ ...valid, echantillonCount: 0 }).success).toBe(false);
  });

  it("accepts optional tailleMoyenne", () => {
    expect(createBiometrieSchema.safeParse({ ...valid, tailleMoyenne: 25.5 }).success).toBe(true);
  });

  it("rejects tailleMoyenne <= 0", () => {
    expect(createBiometrieSchema.safeParse({ ...valid, tailleMoyenne: 0 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createMortaliteSchema
// ---------------------------------------------------------------------------

describe("createMortaliteSchema", () => {
  const valid = {
    ...baseCreate,
    typeReleve: TypeReleve.MORTALITE,
    nombreMorts: 3,
    causeMortalite: CauseMortalite.MALADIE,
  };

  it("accepts valid mortalite data", () => {
    expect(createMortaliteSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts nombreMorts = 0", () => {
    expect(createMortaliteSchema.safeParse({ ...valid, nombreMorts: 0 }).success).toBe(true);
  });

  it("rejects nombreMorts < 0", () => {
    expect(createMortaliteSchema.safeParse({ ...valid, nombreMorts: -1 }).success).toBe(false);
  });

  it("rejects non-integer nombreMorts", () => {
    expect(createMortaliteSchema.safeParse({ ...valid, nombreMorts: 1.5 }).success).toBe(false);
  });

  it("rejects invalid causeMortalite", () => {
    expect(createMortaliteSchema.safeParse({ ...valid, causeMortalite: "INCONNU" }).success).toBe(false);
  });

  it("rejects missing causeMortalite", () => {
    const result = createMortaliteSchema.safeParse({ ...valid, causeMortalite: undefined });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createAlimentationSchema
// ---------------------------------------------------------------------------

describe("createAlimentationSchema", () => {
  const valid = {
    ...baseCreate,
    typeReleve: TypeReleve.ALIMENTATION,
    quantiteAliment: 5.5,
    typeAliment: TypeAliment.COMMERCIAL,
    frequenceAliment: 3,
  };

  it("accepts valid alimentation data", () => {
    expect(createAlimentationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects quantiteAliment <= 0", () => {
    expect(createAlimentationSchema.safeParse({ ...valid, quantiteAliment: 0 }).success).toBe(false);
  });

  it("rejects invalid typeAliment", () => {
    expect(createAlimentationSchema.safeParse({ ...valid, typeAliment: "NATUREL" }).success).toBe(false);
  });

  it("rejects non-integer frequenceAliment", () => {
    expect(createAlimentationSchema.safeParse({ ...valid, frequenceAliment: 1.5 }).success).toBe(false);
  });

  it("rejects frequenceAliment <= 0", () => {
    expect(createAlimentationSchema.safeParse({ ...valid, frequenceAliment: 0 }).success).toBe(false);
  });

  it("accepts valid tauxRefus values", () => {
    for (const taux of [0, 10, 25, 50]) {
      expect(createAlimentationSchema.safeParse({ ...valid, tauxRefus: taux }).success).toBe(true);
    }
  });

  it("rejects invalid tauxRefus value", () => {
    expect(createAlimentationSchema.safeParse({ ...valid, tauxRefus: 15 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createQualiteEauSchema — bornes numeriques
// ---------------------------------------------------------------------------

describe("createQualiteEauSchema — bornes numeriques", () => {
  const valid = {
    ...baseCreate,
    typeReleve: TypeReleve.QUALITE_EAU,
  };

  it("accepts valid qualite eau data", () => {
    expect(createQualiteEauSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts pH at bounds [0, 14]", () => {
    expect(createQualiteEauSchema.safeParse({ ...valid, ph: 0 }).success).toBe(true);
    expect(createQualiteEauSchema.safeParse({ ...valid, ph: 7 }).success).toBe(true);
    expect(createQualiteEauSchema.safeParse({ ...valid, ph: 14 }).success).toBe(true);
  });

  it("rejects pH < 0", () => {
    expect(createQualiteEauSchema.safeParse({ ...valid, ph: -0.1 }).success).toBe(false);
  });

  it("rejects pH > 14", () => {
    const result = createQualiteEauSchema.safeParse({ ...valid, ph: 14.1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = getIssues(result.error);
      expect(issues[0]?.message).toContain("14");
    }
  });

  it("accepts temperature at bounds [0, 50]", () => {
    expect(createQualiteEauSchema.safeParse({ ...valid, temperature: 0 }).success).toBe(true);
    expect(createQualiteEauSchema.safeParse({ ...valid, temperature: 25 }).success).toBe(true);
    expect(createQualiteEauSchema.safeParse({ ...valid, temperature: 50 }).success).toBe(true);
  });

  it("rejects temperature < 0", () => {
    expect(createQualiteEauSchema.safeParse({ ...valid, temperature: -1 }).success).toBe(false);
  });

  it("rejects temperature > 50", () => {
    const result = createQualiteEauSchema.safeParse({ ...valid, temperature: 51 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = getIssues(result.error);
      expect(issues[0]?.message).toContain("50");
    }
  });

  it("accepts oxygene at bounds [0, 20]", () => {
    expect(createQualiteEauSchema.safeParse({ ...valid, oxygene: 0 }).success).toBe(true);
    expect(createQualiteEauSchema.safeParse({ ...valid, oxygene: 8 }).success).toBe(true);
    expect(createQualiteEauSchema.safeParse({ ...valid, oxygene: 20 }).success).toBe(true);
  });

  it("rejects oxygene < 0", () => {
    expect(createQualiteEauSchema.safeParse({ ...valid, oxygene: -0.1 }).success).toBe(false);
  });

  it("rejects oxygene > 20", () => {
    const result = createQualiteEauSchema.safeParse({ ...valid, oxygene: 20.1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = getIssues(result.error);
      expect(issues[0]?.message).toContain("20");
    }
  });

  it("accepts ammoniac at bounds [0, 10]", () => {
    expect(createQualiteEauSchema.safeParse({ ...valid, ammoniac: 0 }).success).toBe(true);
    expect(createQualiteEauSchema.safeParse({ ...valid, ammoniac: 5 }).success).toBe(true);
    expect(createQualiteEauSchema.safeParse({ ...valid, ammoniac: 10 }).success).toBe(true);
  });

  it("rejects ammoniac < 0", () => {
    expect(createQualiteEauSchema.safeParse({ ...valid, ammoniac: -0.1 }).success).toBe(false);
  });

  it("rejects ammoniac > 10", () => {
    const result = createQualiteEauSchema.safeParse({ ...valid, ammoniac: 10.1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = getIssues(result.error);
      expect(issues[0]?.message).toContain("10");
    }
  });
});

// ---------------------------------------------------------------------------
// createComptageSchema
// ---------------------------------------------------------------------------

describe("createComptageSchema", () => {
  const valid = {
    ...baseCreate,
    typeReleve: TypeReleve.COMPTAGE,
    nombreCompte: 500,
    methodeComptage: MethodeComptage.DIRECT,
  };

  it("accepts valid comptage data", () => {
    expect(createComptageSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts nombreCompte = 0", () => {
    expect(createComptageSchema.safeParse({ ...valid, nombreCompte: 0 }).success).toBe(true);
  });

  it("rejects nombreCompte < 0", () => {
    expect(createComptageSchema.safeParse({ ...valid, nombreCompte: -1 }).success).toBe(false);
  });

  it("rejects non-integer nombreCompte", () => {
    expect(createComptageSchema.safeParse({ ...valid, nombreCompte: 1.5 }).success).toBe(false);
  });

  it("rejects invalid methodeComptage", () => {
    expect(createComptageSchema.safeParse({ ...valid, methodeComptage: "MANUELLE" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createObservationSchema
// ---------------------------------------------------------------------------

describe("createObservationSchema", () => {
  const valid = {
    ...baseCreate,
    typeReleve: TypeReleve.OBSERVATION,
    description: "Les poissons sont actifs",
  };

  it("accepts valid observation data", () => {
    expect(createObservationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty description", () => {
    expect(createObservationSchema.safeParse({ ...valid, description: "" }).success).toBe(false);
  });

  it("rejects description over 2000 characters", () => {
    const result = createObservationSchema.safeParse({ ...valid, description: "a".repeat(2001) });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = getIssues(result.error);
      expect(issues[0]?.message).toContain("2000");
    }
  });

  it("trims whitespace from description", () => {
    const result = createObservationSchema.safeParse({ ...valid, description: "  desc  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("desc");
    }
  });
});

// ---------------------------------------------------------------------------
// createRenouvellementSchema
// ---------------------------------------------------------------------------

describe("createRenouvellementSchema", () => {
  const validWithPct = {
    ...baseCreate,
    typeReleve: TypeReleve.RENOUVELLEMENT,
    pourcentageRenouvellement: 30,
  };

  const validWithVol = {
    ...baseCreate,
    typeReleve: TypeReleve.RENOUVELLEMENT,
    volumeRenouvele: 100,
  };

  it("accepts with pourcentageRenouvellement only", () => {
    expect(createRenouvellementSchema.safeParse(validWithPct).success).toBe(true);
  });

  it("accepts with volumeRenouvele only", () => {
    expect(createRenouvellementSchema.safeParse(validWithVol).success).toBe(true);
  });

  it("accepts with both fields", () => {
    expect(createRenouvellementSchema.safeParse({ ...validWithPct, volumeRenouvele: 50 }).success).toBe(true);
  });

  it("rejects when neither field is provided", () => {
    const result = createRenouvellementSchema.safeParse({ ...baseCreate, typeReleve: TypeReleve.RENOUVELLEMENT });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodErrorToFieldErrors(result.error);
      expect(errors.some((e) => e.message.includes("pourcentageRenouvellement") || e.message.includes("Au moins"))).toBe(true);
    }
  });

  it("rejects pourcentageRenouvellement > 100", () => {
    expect(createRenouvellementSchema.safeParse({ ...validWithPct, pourcentageRenouvellement: 101 }).success).toBe(false);
  });

  it("rejects pourcentageRenouvellement < 0", () => {
    expect(createRenouvellementSchema.safeParse({ ...validWithPct, pourcentageRenouvellement: -1 }).success).toBe(false);
  });

  it("rejects volumeRenouvele <= 0", () => {
    expect(createRenouvellementSchema.safeParse({ ...validWithVol, volumeRenouvele: 0 }).success).toBe(false);
  });

  it("accepts valid nombreRenouvellements", () => {
    expect(createRenouvellementSchema.safeParse({ ...validWithPct, nombreRenouvellements: 3 }).success).toBe(true);
  });

  it("rejects nombreRenouvellements < 1", () => {
    expect(createRenouvellementSchema.safeParse({ ...validWithPct, nombreRenouvellements: 0 }).success).toBe(false);
  });

  it("rejects nombreRenouvellements > 20", () => {
    expect(createRenouvellementSchema.safeParse({ ...validWithPct, nombreRenouvellements: 21 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createReleveSchema — discriminated union
// ---------------------------------------------------------------------------

describe("createReleveSchema (discriminated union)", () => {
  it("routes to biometrie schema for BIOMETRIE type", () => {
    const result = createReleveSchema.safeParse({
      ...baseCreate,
      typeReleve: TypeReleve.BIOMETRIE,
      poidsMoyen: 100,
      echantillonCount: 20,
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown typeReleve", () => {
    const result = createReleveSchema.safeParse({
      ...baseCreate,
      typeReleve: "INCONNU",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing vagueId", () => {
    const result = createReleveSchema.safeParse({
      bacId: "b",
      typeReleve: TypeReleve.BIOMETRIE,
      poidsMoyen: 100,
      echantillonCount: 20,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateReleveSchema — bornes numeriques (PUT/PATCH context)
// ---------------------------------------------------------------------------

describe("updateReleveSchema — bornes numeriques", () => {
  it("accepts empty object (no fields required)", () => {
    expect(updateReleveSchema.safeParse({}).success).toBe(true);
  });

  it("rejects pH > 14 on update", () => {
    expect(updateReleveSchema.safeParse({ ph: 15 }).success).toBe(false);
  });

  it("rejects pH < 0 on update", () => {
    expect(updateReleveSchema.safeParse({ ph: -1 }).success).toBe(false);
  });

  it("rejects temperature > 50 on update", () => {
    expect(updateReleveSchema.safeParse({ temperature: 51 }).success).toBe(false);
  });

  it("rejects oxygene > 20 on update", () => {
    expect(updateReleveSchema.safeParse({ oxygene: 21 }).success).toBe(false);
  });

  it("rejects ammoniac > 10 on update", () => {
    expect(updateReleveSchema.safeParse({ ammoniac: 11 }).success).toBe(false);
  });

  it("accepts valid update fields", () => {
    expect(
      updateReleveSchema.safeParse({
        ph: 7.5,
        temperature: 28,
        oxygene: 6.5,
        ammoniac: 0.5,
      }).success
    ).toBe(true);
  });

  it("rejects notes over 2000 characters", () => {
    expect(updateReleveSchema.safeParse({ notes: "a".repeat(2001) }).success).toBe(false);
  });

  it("rejects description over 2000 characters on update", () => {
    expect(updateReleveSchema.safeParse({ description: "a".repeat(2001) }).success).toBe(false);
  });

  it("rejects empty description on update", () => {
    expect(updateReleveSchema.safeParse({ description: "" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// patchReleveSchema
// ---------------------------------------------------------------------------

describe("patchReleveSchema", () => {
  it("accepts valid patch with raison and a field", () => {
    expect(
      patchReleveSchema.safeParse({
        raison: "Correction du poids moyen enregistre",
        poidsMoyen: 200,
      }).success
    ).toBe(true);
  });

  it("rejects missing raison", () => {
    const result = patchReleveSchema.safeParse({ poidsMoyen: 200 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodErrorToFieldErrors(result.error);
      expect(errors.some((e) => e.field === "raison")).toBe(true);
    }
  });

  it("rejects raison shorter than 5 characters", () => {
    const result = patchReleveSchema.safeParse({ raison: "abc", poidsMoyen: 200 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodErrorToFieldErrors(result.error);
      expect(errors.some((e) => e.field === "raison")).toBe(true);
    }
  });

  it("rejects raison over 500 characters", () => {
    const result = patchReleveSchema.safeParse({ raison: "a".repeat(501), poidsMoyen: 200 });
    expect(result.success).toBe(false);
  });

  it("trims raison", () => {
    const result = patchReleveSchema.safeParse({
      raison: "  Raison valide apres correction  ",
      poidsMoyen: 150,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.raison).toBe("Raison valide apres correction");
    }
  });

  it("also validates numeric bounds like updateReleveSchema", () => {
    const result = patchReleveSchema.safeParse({
      raison: "Correction de la mesure pH",
      ph: 20,
    });
    expect(result.success).toBe(false);
  });
});
