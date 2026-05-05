/**
 * Tests de non-régression pour BUG-046.
 *
 * Vérifie que validateReleveForm accepte tous les types de relevé
 * en mode lot d'alevins (lotAlevinsId présent) sans exiger vagueId/bacId.
 */

import { describe, it, expect } from "vitest";
import { TypeReleve } from "@/types";
import { validateReleveForm } from "@/lib/releve-form-validation";

// ---------------------------------------------------------------------------
// Mock de la fonction de traduction
// ---------------------------------------------------------------------------

const t = (key: string) => key;

// ---------------------------------------------------------------------------
// Champs vides pour chaque type
// ---------------------------------------------------------------------------

const biometrieFields = {
  typeReleve: TypeReleve.BIOMETRIE,
  poidsMoyen: "150",
  tailleMoyenne: "",
  echantillonCount: "30",
};

const mortaliteFields = {
  typeReleve: TypeReleve.MORTALITE,
  nombreMorts: "2",
  causeMortalite: "MALADIE",
};

const alimentationFields = {
  typeReleve: TypeReleve.ALIMENTATION,
  quantiteAliment: "5",
  typeAliment: "COMMERCIAL",
  frequenceAliment: "3",
  tauxRefus: "",
  comportementAlim: "",
};

const qualiteEauFields = {
  typeReleve: TypeReleve.QUALITE_EAU,
  temperature: "28",
  ph: "7",
  oxygene: "6",
  ammoniac: "0",
};

const comptageFields = {
  typeReleve: TypeReleve.COMPTAGE,
  nombreCompte: "500",
  methodeComptage: "DIRECT",
};

const observationFields = {
  typeReleve: TypeReleve.OBSERVATION,
  description: "Les alevins nagent normalement.",
};

const triFields = {
  typeReleve: TypeReleve.TRI,
  description: "Tri réalisé, 3 catégories.",
};

const lotAlevinsId = "lot_02";

// ---------------------------------------------------------------------------
// Tests — mode lot d'alevins (BUG-046)
// ---------------------------------------------------------------------------

describe("validateReleveForm — mode lot d'alevins (BUG-046)", () => {
  it("accepte BIOMETRIE+lotAlevinsId sans vagueId ni bacId", () => {
    const errs = validateReleveForm("", "", TypeReleve.BIOMETRIE, biometrieFields, t, lotAlevinsId);
    expect(errs.vagueId).toBeUndefined();
    expect(errs.bacId).toBeUndefined();
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("accepte MORTALITE+lotAlevinsId sans vagueId ni bacId", () => {
    const errs = validateReleveForm("", "", TypeReleve.MORTALITE, mortaliteFields, t, lotAlevinsId);
    expect(errs.vagueId).toBeUndefined();
    expect(errs.bacId).toBeUndefined();
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("accepte ALIMENTATION+lotAlevinsId sans vagueId ni bacId", () => {
    const errs = validateReleveForm("", "", TypeReleve.ALIMENTATION, alimentationFields, t, lotAlevinsId);
    expect(errs.vagueId).toBeUndefined();
    expect(errs.bacId).toBeUndefined();
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("accepte QUALITE_EAU+lotAlevinsId sans vagueId ni bacId", () => {
    const errs = validateReleveForm("", "", TypeReleve.QUALITE_EAU, qualiteEauFields, t, lotAlevinsId);
    expect(errs.vagueId).toBeUndefined();
    expect(errs.bacId).toBeUndefined();
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("accepte COMPTAGE+lotAlevinsId sans vagueId ni bacId", () => {
    const errs = validateReleveForm("", "", TypeReleve.COMPTAGE, comptageFields, t, lotAlevinsId);
    expect(errs.vagueId).toBeUndefined();
    expect(errs.bacId).toBeUndefined();
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("accepte OBSERVATION+lotAlevinsId sans vagueId ni bacId", () => {
    const errs = validateReleveForm("", "", TypeReleve.OBSERVATION, observationFields, t, lotAlevinsId);
    expect(errs.vagueId).toBeUndefined();
    expect(errs.bacId).toBeUndefined();
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("accepte TRI+lotAlevinsId sans vagueId ni bacId", () => {
    const errs = validateReleveForm("", "", TypeReleve.TRI, triFields, t, lotAlevinsId);
    expect(errs.vagueId).toBeUndefined();
    expect(errs.bacId).toBeUndefined();
    expect(Object.keys(errs)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — mode normal (pas de lot) — non-régression
// ---------------------------------------------------------------------------

describe("validateReleveForm — mode normal sans lot (non-régression)", () => {
  it("exige vagueId si pas de lotAlevinsId", () => {
    const errs = validateReleveForm("", "bac-1", TypeReleve.BIOMETRIE, biometrieFields, t);
    expect(errs.vagueId).toBeTruthy();
  });

  it("exige bacId si pas de lotAlevinsId", () => {
    const errs = validateReleveForm("vague-1", "", TypeReleve.BIOMETRIE, biometrieFields, t);
    expect(errs.bacId).toBeTruthy();
  });

  it("valide correctement BIOMETRIE avec vagueId+bacId", () => {
    const errs = validateReleveForm("vague-1", "bac-1", TypeReleve.BIOMETRIE, biometrieFields, t);
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("valide correctement MORTALITE avec vagueId+bacId", () => {
    const errs = validateReleveForm("vague-1", "bac-1", TypeReleve.MORTALITE, mortaliteFields, t);
    expect(Object.keys(errs)).toHaveLength(0);
  });

  it("rejette lotAlevinsId vide comme mode normal", () => {
    const errs = validateReleveForm("", "", TypeReleve.BIOMETRIE, biometrieFields, t, "");
    expect(errs.vagueId).toBeTruthy();
  });
});
