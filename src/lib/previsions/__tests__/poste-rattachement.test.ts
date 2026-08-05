/**
 * Tests — src/lib/previsions/poste-rattachement.ts (story A.5, ADR-053
 * §16.12). Fonctions pures : couverture exhaustive de la matrice
 * {coincident, divergent} x {actif, inactif}, plus casse/accents/espaces et
 * valeurs limites.
 */
import { describe, it, expect } from "vitest";
import { libelleDivergeDuReferentiel, calculerSignalRattachement } from "@/lib/previsions/poste-rattachement";

describe("libelleDivergeDuReferentiel", () => {
  it("retourne false pour deux libellés strictement identiques", () => {
    expect(libelleDivergeDuReferentiel("Electricite", "Electricite")).toBe(false);
  });

  it("retourne true pour deux libellés textuellement différents", () => {
    expect(libelleDivergeDuReferentiel("Transport équipe production", "Transport")).toBe(true);
  });

  it("ignore les espaces de bord (trim) — un espace de bord seul n'est pas une divergence", () => {
    expect(libelleDivergeDuReferentiel("  Electricite  ", "Electricite")).toBe(false);
  });

  it("ignore la casse — une différence de casse seule n'est pas une divergence (comportement documenté, comparaison insensible à la casse)", () => {
    expect(libelleDivergeDuReferentiel("ELECTRICITE", "electricite")).toBe(false);
    expect(libelleDivergeDuReferentiel("Salaires Équipe", "salaires équipe")).toBe(false);
  });

  it("NE normalise PAS les accents — une différence d'accentuation EST une divergence (comparaison texte simple, jamais sluggifiée, cf. commentaire du fichier)", () => {
    expect(libelleDivergeDuReferentiel("Electricite", "Électricité")).toBe(true);
  });

  it("un espace interne supplémentaire (pas seulement de bord) EST une divergence — seul le trim de bord est appliqué", () => {
    expect(libelleDivergeDuReferentiel("Salaires  équipe", "Salaires équipe")).toBe(true);
  });

  it("chaîne vide vs chaîne non vide est une divergence", () => {
    expect(libelleDivergeDuReferentiel("", "Electricite")).toBe(true);
  });

  it("deux chaînes vides (ou uniquement des espaces) ne divergent pas", () => {
    expect(libelleDivergeDuReferentiel("", "")).toBe(false);
    expect(libelleDivergeDuReferentiel("   ", "")).toBe(false);
  });
});

describe("calculerSignalRattachement", () => {
  it("cas majoritaire : libellé coïncident + référentiel actif → aucun signal", () => {
    expect(calculerSignalRattachement("Electricite", { libelle: "Electricite", actif: true })).toEqual({
      kind: "aucun",
    });
  });

  it("libellé coïncident (avec espaces/casse) + référentiel actif → aucun signal", () => {
    expect(calculerSignalRattachement("  ELECTRICITE  ", { libelle: "electricite", actif: true })).toEqual({
      kind: "aucun",
    });
  });

  it("libellé divergent + référentiel actif → signal 'divergent' avec le libellé référentiel", () => {
    expect(
      calculerSignalRattachement("Transport équipe production", { libelle: "Transport", actif: true })
    ).toEqual({ kind: "divergent", libelleReferentiel: "Transport" });
  });

  it("libellé coïncident + référentiel INACTIF → signal 'inactif', divergent=false (visible MÊME sans divergence — règle non négociable §16.12)", () => {
    expect(calculerSignalRattachement("Carburant", { libelle: "Carburant", actif: false })).toEqual({
      kind: "inactif",
      divergent: false,
      libelleReferentiel: "Carburant",
    });
  });

  it("libellé divergent + référentiel INACTIF → signal 'inactif', divergent=true (les deux informations coexistent, la désactivation prime dans le kind)", () => {
    expect(
      calculerSignalRattachement("Salaires terrain", { libelle: "Salaires équipe", actif: false })
    ).toEqual({ kind: "inactif", divergent: true, libelleReferentiel: "Salaires équipe" });
  });

  it("l'inactivité prime toujours sur la divergence dans le choix du 'kind' — jamais 'divergent' quand actif=false", () => {
    const signal = calculerSignalRattachement("X diverge", { libelle: "Y", actif: false });
    expect(signal.kind).toBe("inactif");
    expect(signal.kind).not.toBe("divergent");
  });
});
