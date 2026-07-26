/**
 * Tests de parse Zod pour `creerBonLivraisonRectificatifSchema` (Sprint BF phase 2).
 *
 * R3 etendu (lecon ERR SC2) : Prisma = TypeScript = Zod, verifie par tests.
 */

import { describe, expect, it } from "vitest";
import { creerBonLivraisonRectificatifSchema } from "@/lib/validation/bon-livraison";

describe("creerBonLivraisonRectificatifSchema", () => {
  it("accepte une requete valide avec motif suffisant", () => {
    const result = creerBonLivraisonRectificatifSchema.safeParse({
      bonLivraisonOrigineId: "bl-1",
      motifRectification: "Poids errone constate a la remise",
    });

    expect(result.success).toBe(true);
  });

  it("trim le motif de rectification", () => {
    const result = creerBonLivraisonRectificatifSchema.safeParse({
      bonLivraisonOrigineId: "bl-1",
      motifRectification: "  Erreur de saisie  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.motifRectification).toBe("Erreur de saisie");
    }
  });

  it("rejette un bonLivraisonOrigineId vide", () => {
    const result = creerBonLivraisonRectificatifSchema.safeParse({
      bonLivraisonOrigineId: "",
      motifRectification: "Motif suffisamment long",
    });

    expect(result.success).toBe(false);
  });

  it("rejette un motif trop court (< 5 caracteres)", () => {
    const result = creerBonLivraisonRectificatifSchema.safeParse({
      bonLivraisonOrigineId: "bl-1",
      motifRectification: "abc",
    });

    expect(result.success).toBe(false);
  });

  it("rejette un motif de rectification absent", () => {
    const result = creerBonLivraisonRectificatifSchema.safeParse({
      bonLivraisonOrigineId: "bl-1",
    });

    expect(result.success).toBe(false);
  });

  it("rejette un motif trop long (> 500 caracteres)", () => {
    const result = creerBonLivraisonRectificatifSchema.safeParse({
      bonLivraisonOrigineId: "bl-1",
      motifRectification: "a".repeat(501),
    });

    expect(result.success).toBe(false);
  });
});
