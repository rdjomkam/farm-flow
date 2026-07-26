/**
 * Tests de parse Zod pour `enregistrerQuantitesBonLivraisonSchema` (Sprint BF).
 *
 * R3 etendu (lecon ERR SC2) : Prisma = TypeScript = Zod, verifie par tests.
 */

import { describe, expect, it } from "vitest";
import {
  enregistrerQuantiteLigneBonLivraisonSchema,
  enregistrerQuantitesBonLivraisonSchema,
} from "@/lib/validation/bon-livraison";

describe("enregistrerQuantitesBonLivraisonSchema", () => {
  it("accepte des lignes valides avec valeurs par defaut", () => {
    const result = enregistrerQuantitesBonLivraisonSchema.safeParse({
      lignes: [{ ligneVenteId: "ligne-1", poidsLivreKg: 245.25 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lignes[0].nombreMortsTransport).toBe(0);
      expect(result.data.lignes[0].motifAvarie).toBeUndefined();
    }
  });

  it("accepte un poidsLivreKg de 0 (ligne integralement refusee)", () => {
    const result = enregistrerQuantiteLigneBonLivraisonSchema.safeParse({
      ligneVenteId: "ligne-1",
      poidsLivreKg: 0,
    });

    expect(result.success).toBe(true);
  });

  it("conserve dateLivraison et le detail des lignes multi-lignes", () => {
    const result = enregistrerQuantitesBonLivraisonSchema.safeParse({
      dateLivraison: "2026-07-26T10:00:00.000Z",
      lignes: [
        { ligneVenteId: "ligne-1", poidsLivreKg: 100, nombreMortsTransport: 2, motifAvarie: "chaleur" },
        { ligneVenteId: "ligne-2", poidsLivreKg: 50 },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateLivraison).toBe("2026-07-26T10:00:00.000Z");
      expect(result.data.lignes).toHaveLength(2);
      expect(result.data.lignes[0].nombreMortsTransport).toBe(2);
      expect(result.data.lignes[0].motifAvarie).toBe("chaleur");
    }
  });

  it("rejette un poidsLivreKg negatif", () => {
    const result = enregistrerQuantiteLigneBonLivraisonSchema.safeParse({
      ligneVenteId: "ligne-1",
      poidsLivreKg: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejette un nombreMortsTransport negatif", () => {
    const result = enregistrerQuantiteLigneBonLivraisonSchema.safeParse({
      ligneVenteId: "ligne-1",
      poidsLivreKg: 10,
      nombreMortsTransport: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejette un motifAvarie de plus de 500 caracteres", () => {
    const result = enregistrerQuantiteLigneBonLivraisonSchema.safeParse({
      ligneVenteId: "ligne-1",
      poidsLivreKg: 10,
      motifAvarie: "a".repeat(501),
    });

    expect(result.success).toBe(false);
  });

  it("rejette un tableau de lignes vide", () => {
    const result = enregistrerQuantitesBonLivraisonSchema.safeParse({
      lignes: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejette une ligne sans ligneVenteId", () => {
    const result = enregistrerQuantiteLigneBonLivraisonSchema.safeParse({
      ligneVenteId: "",
      poidsLivreKg: 10,
    });

    expect(result.success).toBe(false);
  });

  // BUG-BF-1 : l'etape "quantites" du flux BL utilise un <input type="date">,
  // qui produit un format date simple "YYYY-MM-DD" (pas un ISO datetime
  // complet). Le schema doit accepter ce format reel envoye par l'UI.
  describe("format de dateLivraison (BUG-BF-1)", () => {
    it("accepte le format date simple produit par <input type=\"date\">", () => {
      const result = enregistrerQuantitesBonLivraisonSchema.safeParse({
        dateLivraison: "2026-07-26",
        lignes: [{ ligneVenteId: "ligne-1", poidsLivreKg: 100 }],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dateLivraison).toBe("2026-07-26");
        // Pas de decalage de fuseau horaire : la journee interpretee reste le 26.
        expect(new Date(result.data.dateLivraison as string).getUTCDate()).toBe(26);
      }
    });

    it("accepte toujours le format ISO datetime complet", () => {
      const result = enregistrerQuantitesBonLivraisonSchema.safeParse({
        dateLivraison: "2026-07-26T10:00:00.000Z",
        lignes: [{ ligneVenteId: "ligne-1", poidsLivreKg: 100 }],
      });

      expect(result.success).toBe(true);
    });

    it("rejette une chaine qui n'est pas une date", () => {
      const result = enregistrerQuantitesBonLivraisonSchema.safeParse({
        dateLivraison: "pas-une-date",
        lignes: [{ ligneVenteId: "ligne-1", poidsLivreKg: 100 }],
      });

      expect(result.success).toBe(false);
    });
  });
});
