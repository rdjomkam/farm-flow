/**
 * Tests unitaires — `evaluerEligibiliteProduitAlimentairePrevision`
 * (`src/lib/previsions/eligibilite.ts`), ADR-053 §18.3 : l'UNIQUE definition
 * de la regle d'eligibilite d'un `Produit` ALIMENT pour la copie vers un
 * scenario de previsions. Reutilisee par `getProduitsAlimentairesEligibles`,
 * `validerProduitIdsEligibles` (`src/lib/queries/previsions-scenarios.ts`)
 * et l'UI (`scenario-form-dialog.tsx`) — jamais recalculee ailleurs.
 *
 * Couvre les QUATRE combinaisons `tailleGranule`/`contenance` x present/absent
 * exigees par ADR-053 §18.7 point 6, plus les cas limites de `contenance`
 * (zero, negative) qui font toute la difference avec la faute d'origine
 * (ERR-185 : zero silencieux sur `contenance`).
 *
 * Deplace depuis `src/types/__tests__/` (le fichier source a suivi la meme
 * migration, review post-implementation ADR-053 §18) — aucun changement de
 * comportement, seuls les chemins d'import sont ajustes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluerEligibiliteProduitAlimentairePrevision,
  type ProduitAlimentaireEligibiliteInput,
} from "@/lib/previsions/eligibilite";
import { RaisonInvaliditeProduitPrevision, TailleGranule } from "@/types/models";

describe("evaluerEligibiliteProduitAlimentairePrevision — purete, importable depuis un composant \"use client\"", () => {
  it("n'importe aucune dependance serveur (prisma, next/server, fs, lib/db) — directement ni transitivement via @/types/models", () => {
    const source = readFileSync(
      join(__dirname, "..", "eligibilite.ts"),
      "utf-8"
    );
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"));
    expect(importLines).toEqual([
      'import { RaisonInvaliditeProduitPrevision, type TailleGranule } from "@/types/models";',
    ]);

    // `@/types/models` est le seul import — il doit lui-meme n'avoir AUCUN
    // import (enums/interfaces pures), condition necessaire pour que la
    // chaine complete soit sans dependance serveur.
    const modelsSource = readFileSync(
      join(__dirname, "..", "..", "..", "types", "models.ts"),
      "utf-8"
    );
    const modelsImportLines = modelsSource
      .split("\n")
      .filter((line) => line.trim().startsWith("import"));
    expect(modelsImportLines).toEqual([]);
  });
});

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
