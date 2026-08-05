/**
 * Tests — `ligneMappingRapprochementInputSchema` (Sprint PR3-bis, story
 * PR3bis.1, pre-analyse section 1 : gap signale par la review PR3 ; complete
 * Sprint PR3-ter, story A.3 : format compose `cibleId` ALIMENT_PREVISION).
 *
 * Verifie par falsification que `cibleId` est lie a `cibleType` :
 * - POSTE_PREVISION / ALIMENT_PREVISION exigent un `cibleId` reel.
 * - VENTE_PREVUE / NON_RAPPROCHE exigent l'ABSENCE de `cibleId`.
 * - ALIMENT_PREVISION exige en plus le FORMAT COMPOSE `tailleGranule::id`
 *   (A.3) — un `cibleId` PRE-A.3 (id brut, sans tailleGranule) est REJETE,
 *   pas seulement tolere (la NATURE du `cibleId` est validee).
 */
import { describe, it, expect } from "vitest";
import { ligneMappingRapprochementInputSchema } from "@/lib/validation/previsions.schema";
import { SourceRapprochement, CibleRapprochement, TailleGranule } from "@/types";
import { composeCibleAlimentPrevision } from "@/lib/queries/previsions-rapprochement";

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

  // Sprint PR3-ter, story A.3 — format compose tailleGranule::id.
  it("accepte ALIMENT_PREVISION avec un cibleId au format compose 'tailleGranule::id'", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.ALIMENT_PREVISION,
      cibleId: composeCibleAlimentPrevision(TailleGranule.G1, "aliment-xyz"),
    });
    expect(res.success).toBe(true);
  });

  it("rejette ALIMENT_PREVISION avec un cibleId PRE-A.3 (id brut, sans tailleGranule) — nature invalidee, pas seulement presence", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.ALIMENT_PREVISION,
      cibleId: "aliment-id-brut-sans-format",
    });
    expect(res.success).toBe(false);
  });

  it("rejette ALIMENT_PREVISION avec un cibleId compose mais une tailleGranule inconnue", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.ALIMENT_PREVISION,
      cibleId: "PAS_UNE_TAILLE::aliment-xyz",
    });
    expect(res.success).toBe(false);
  });

  it("rejette ALIMENT_PREVISION avec un cibleId compose sans id d'origine (tailleGranule seule, separateur final)", () => {
    const res = ligneMappingRapprochementInputSchema.safeParse({
      ...base,
      cibleType: CibleRapprochement.ALIMENT_PREVISION,
      cibleId: `${TailleGranule.G1}::`,
    });
    expect(res.success).toBe(false);
  });
});
