// @vitest-environment jsdom
/**
 * Tests — ImageUploadField (Story SU.7)
 *
 * Composant : src/components/sites/image-upload-field.tsx
 *
 * Contexte : l'id de l'<input type="file"> etait derive du label traduit
 * (`upload-${label}`), instable entre locales et sujet a collision si
 * deux instances partagent un jour le meme label sur la meme page.
 * Fix : prop `id?` optionnelle + fallback `useId()`, meme pattern que
 * `src/components/ui/input.tsx`.
 *
 * Couverture :
 * 1. Un id est genere automatiquement quand aucune prop `id` n'est passee
 * 2. Cet id ne depend pas du texte du label (stable entre locales)
 * 3. Deux instances du composant avec le meme label ont des ids distincts
 * 4. La prop `id` explicite, quand fournie, est respectee
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";

import { ImageUploadField } from "@/components/sites/image-upload-field";

function baseProps(label: string) {
  return {
    label,
    value: null,
    onChange: vi.fn(),
    emptyLabel: "Aucune image",
    removeLabel: "Supprimer",
    uploadLabel: "Téléverser",
    errorTooLarge: "Image trop volumineuse",
    errorInvalidType: "Type d'image invalide",
  };
}

describe("ImageUploadField — id de l'input file (SU.7)", () => {
  it("genere un id sur l'input file quand aucune prop id n'est passee", () => {
    const { container } = render(<ImageUploadField {...baseProps("Cachet")} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input!.getAttribute("id")).toBeTruthy();
  });

  it("l'id genere ne contient pas le texte brut du label (stable entre locales)", () => {
    const { container } = render(
      <ImageUploadField {...baseProps("Signature du promoteur")} />
    );
    const input = container.querySelector('input[type="file"]');
    const id = input!.getAttribute("id")!;
    expect(id).not.toContain("Signature");
    expect(id.startsWith("upload-")).toBe(false);
  });

  it("deux instances avec le meme label ont des ids distincts (pas de collision)", () => {
    const { container: c1 } = render(<ImageUploadField {...baseProps("Cachet")} />);
    const { container: c2 } = render(<ImageUploadField {...baseProps("Cachet")} />);
    const id1 = c1.querySelector('input[type="file"]')!.getAttribute("id");
    const id2 = c2.querySelector('input[type="file"]')!.getAttribute("id");
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it("respecte la prop id explicite quand elle est fournie", () => {
    const { container } = render(
      <ImageUploadField {...baseProps("Cachet")} id="cachet-site-1" />
    );
    const input = container.querySelector('input[type="file"]');
    expect(input!.getAttribute("id")).toBe("cachet-site-1");
  });
});
