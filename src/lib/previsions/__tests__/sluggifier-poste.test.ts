/**
 * Tests unitaires — `sluggifierLibellePoste` (ADR-053 §16.11, §16.9 point 6).
 * Test pur, sans DB — table de verite reprise telle quelle de l'ADR.
 */
import { describe, it, expect } from "vitest";
import { sluggifierLibellePoste } from "@/lib/previsions/sluggifier-poste";
import { BusinessRuleError } from "@/lib/errors";

describe("sluggifierLibellePoste (ADR-053 §16.11)", () => {
  it.each([
    ["Salaires", "salaires"],
    ["salaires", "salaires"],
    ["  Salaires   ", "salaires"],
    ["Énergie et Carburant", "energie-et-carburant"],
    ["Énergie   et Carburant!!", "energie-et-carburant"],
    ["Loyer & redevances", "loyer-redevances"],
    ["Frais / Divers", "frais-divers"],
  ])("%s -> %s", (libelle, attendu) => {
    expect(sluggifierLibellePoste(libelle)).toBe(attendu);
  });

  it.each(["!!!", "", "   "])(
    "%s : chaine vide apres normalisation -> BusinessRuleError 400",
    (libelle) => {
      expect(() => sluggifierLibellePoste(libelle)).toThrow(BusinessRuleError);
      try {
        sluggifierLibellePoste(libelle);
      } catch (e) {
        expect((e as BusinessRuleError).status).toBe(400);
      }
    }
  );

  it("les 4 libelles reels du scenario EXCEL-V12 slugifient sans collision", () => {
    const libelles = [
      "Salaires",
      "Énergie et Carburant",
      "Produits vétérinaires et intrants",
      "Loyer et redevances",
    ];
    const slugs = libelles.map(sluggifierLibellePoste);
    expect(slugs).toEqual([
      "salaires",
      "energie-et-carburant",
      "produits-veterinaires-et-intrants",
      "loyer-et-redevances",
    ]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("troncature defensive a 100 caracteres, au dernier '-' avant la limite", () => {
    const libelleLong = "a".repeat(50) + " " + "b".repeat(60);
    const slug = sluggifierLibellePoste(libelleLong);
    expect(slug.length).toBeLessThanOrEqual(100);
    expect(slug.startsWith("-")).toBe(false);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("idempotence : sluggifier un slug deja normalise ne change rien", () => {
    const slug = sluggifierLibellePoste("Énergie et Carburant");
    expect(sluggifierLibellePoste(slug)).toBe(slug);
  });
});
