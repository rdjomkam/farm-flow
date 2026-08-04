// @vitest-environment jsdom
/**
 * Tests — Input (champs numeriques bornes).
 *
 * Bug signale (module Previsions, onglet Parametres) : `prix alevin
 * unitaire` mis a `0` (valide), puis le compteur natif du navigateur
 * (fleches/molette, aucun champ numerique du module ne portait `min`)
 * descend a `-2`, refuse par l'API. Deux garanties couvertes ici :
 * 1. Les attributs `min`/`max` fournis par l'appelant sont bien portes par
 *    le DOM (le compteur natif ne peut alors plus sortir de la borne).
 * 2. La molette au-dessus d'un champ `type="number"` retire le focus au
 *    premier evenement — elle ne doit plus jamais modifier la valeur
 *    silencieusement — sans affecter les champs non-numeriques.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "@/components/ui/input";

describe("Input — bornes numeriques (min/max)", () => {
  it("porte l'attribut min quand fourni (champ nonNegativeNumber, ex. prixAlevinUnitaireFCFA)", () => {
    render(<Input label="Prix alevin unitaire" type="number" min={0} value="0" onChange={() => {}} />);
    const input = screen.getByLabelText("Prix alevin unitaire") as HTMLInputElement;
    expect(input).toHaveAttribute("min", "0");
  });

  it("porte l'attribut max quand fourni (champ pourcentage borne 0..100, ex. tauxEpargnePct)", () => {
    render(<Input label="Taux d'epargne" type="number" min={0} max={100} value="30" onChange={() => {}} />);
    const input = screen.getByLabelText("Taux d'epargne") as HTMLInputElement;
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "100");
  });

  it("ne porte aucun min/max quand l'appelant n'en fournit pas (pas de faux positif sur un champ non contraint)", () => {
    render(<Input label="Libre" type="number" value="5" onChange={() => {}} />);
    const input = screen.getByLabelText("Libre") as HTMLInputElement;
    expect(input).not.toHaveAttribute("min");
    expect(input).not.toHaveAttribute("max");
  });
});

describe("Input — molette neutralisee sur les champs numeriques", () => {
  it("retire le focus au premier evenement de molette sur un champ type=\"number\"", () => {
    render(<Input label="Effectif" type="number" min={0} value="10" onChange={() => {}} />);
    const input = screen.getByLabelText("Effectif") as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.wheel(input);

    expect(document.activeElement).not.toBe(input);
  });

  it("ne retire pas le focus d'un champ texte (la neutralisation est reservee aux champs numeriques)", () => {
    render(<Input label="Nom" type="text" value="abc" onChange={() => {}} />);
    const input = screen.getByLabelText("Nom") as HTMLInputElement;
    input.focus();

    fireEvent.wheel(input);

    expect(document.activeElement).toBe(input);
  });

  it("appelle un onWheel fourni par l'appelant en plus de la neutralisation", () => {
    let called = false;
    render(
      <Input
        label="Effectif"
        type="number"
        value="10"
        onChange={() => {}}
        onWheel={() => {
          called = true;
        }}
      />
    );
    const input = screen.getByLabelText("Effectif") as HTMLInputElement;
    fireEvent.wheel(input);
    expect(called).toBe(true);
  });
});
