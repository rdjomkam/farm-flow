/**
 * Tests unitaires — `evaluerEligibiliteProduitAlimentairePrevision`
 * (`src/types/api.ts`), ADR-053 §18.3 : l'UNIQUE definition de la regle
 * d'eligibilite d'un `Produit` ALIMENT pour la copie vers un scenario de
 * previsions. Reutilisee par `getProduitsAlimentairesEligibles`,
 * `validerProduitIdsEligibles` (`src/lib/queries/previsions-scenarios.ts`)
 * et l'UI (`scenario-form-dialog.tsx`) — jamais recalculee ailleurs.
 *
 * Couvre les QUATRE combinaisons `tailleGranule`/`contenance` x present/absent
 * exigees par ADR-053 §18.7 point 6, plus les cas limites de `contenance`
 * (zero, negative) qui font toute la difference avec la faute d'origine
 * (ERR-185 : zero silencieux sur `contenance`).
 */
import { describe, it, expect } from "vitest";
import {
  evaluerEligibiliteProduitAlimentairePrevision,
  type ProduitAlimentaireEligibiliteInput,
} from "@/types/api";
import { RaisonInvaliditeProduitPrevision, TailleGranule } from "@/types/models";

function input(
  overrides: Partial<ProduitAlimentaireEligibiliteInput>
): ProduitAlimentaireEligibiliteInput {
  return {
    tailleGranule: TailleGranule.G1,
    contenance: 25,
    ...overrides,
  };
}

describe("evaluerEligibiliteProduitAlimentairePrevision — les quatre combinaisons tailleGranule/contenance", () => {
  it("tailleGranule present ET contenance > 0 -> eligible, raisonsInvalidite vide", () => {
    const result = evaluerEligibiliteProduitAlimentairePrevision(
      input({ tailleGranule: TailleGranule.G1, contenance: 25 })
    );
    expect(result.eligible).toBe(true);
    expect(result.raisonsInvalidite).toEqual([]);
  });

  it("tailleGranule ABSENT (null) ET contenance > 0 -> non eligible, TAILLE_GRANULE_MANQUANTE seule", () => {
    const result = evaluerEligibiliteProduitAlimentairePrevision(
      input({ tailleGranule: null, contenance: 25 })
    );
    expect(result.eligible).toBe(false);
    expect(result.raisonsInvalidite).toEqual([
      RaisonInvaliditeProduitPrevision.TAILLE_GRANULE_MANQUANTE,
    ]);
  });

  it("tailleGranule present ET contenance ABSENTE (null) -> non eligible, CONTENANCE_MANQUANTE seule", () => {
    const result = evaluerEligibiliteProduitAlimentairePrevision(
      input({ tailleGranule: TailleGranule.G1, contenance: null })
    );
    expect(result.eligible).toBe(false);
    expect(result.raisonsInvalidite).toEqual([
      RaisonInvaliditeProduitPrevision.CONTENANCE_MANQUANTE,
    ]);
  });

  it("tailleGranule ABSENT ET contenance ABSENTE -> non eligible, LES DEUX raisons cumulees (jamais une seule)", () => {
    const result = evaluerEligibiliteProduitAlimentairePrevision(
      input({ tailleGranule: null, contenance: null })
    );
    expect(result.eligible).toBe(false);
    expect(result.raisonsInvalidite).toEqual([
      RaisonInvaliditeProduitPrevision.TAILLE_GRANULE_MANQUANTE,
      RaisonInvaliditeProduitPrevision.CONTENANCE_MANQUANTE,
    ]);
  });
});

describe("evaluerEligibiliteProduitAlimentairePrevision — cas limites de contenance (ERR-185, le zero qui ment)", () => {
  it("contenance === 0 -> non eligible (jamais confondu avec une valeur exploitable)", () => {
    const result = evaluerEligibiliteProduitAlimentairePrevision(
      input({ contenance: 0 })
    );
    expect(result.eligible).toBe(false);
    expect(result.raisonsInvalidite).toEqual([
      RaisonInvaliditeProduitPrevision.CONTENANCE_MANQUANTE,
    ]);
  });

  it("contenance negative -> non eligible (jamais une valeur negative silencieusement acceptee)", () => {
    const result = evaluerEligibiliteProduitAlimentairePrevision(
      input({ contenance: -5 })
    );
    expect(result.eligible).toBe(false);
    expect(result.raisonsInvalidite).toEqual([
      RaisonInvaliditeProduitPrevision.CONTENANCE_MANQUANTE,
    ]);
  });

  it("contenance tres petite mais strictement positive -> eligible (la seule borne est > 0, pas un seuil arbitraire)", () => {
    const result = evaluerEligibiliteProduitAlimentairePrevision(
      input({ contenance: 0.001 })
    );
    expect(result.eligible).toBe(true);
    expect(result.raisonsInvalidite).toEqual([]);
  });
});
