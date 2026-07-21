// @vitest-environment jsdom
/**
 * Tests — SignaturePad (Story BL.4)
 *
 * Composant : src/components/ui/signature-pad.tsx
 * Canvas de signature tactile natif (pointer events, pas de lib externe).
 *
 * Couverture :
 * 1. Rendu initial : canvas present, bouton "Effacer" desactive (vide)
 * 2. Dessin (pointerdown/move/up) -> devient "non vide", bouton "Effacer" actif,
 *    callback onChangeEmpty(false) declenche
 * 3. Effacer -> redevient vide, callback onChangeEmpty(true)
 * 4. toDataURL() via ref -> null quand vide, string quand rempli
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      ariaLabel: "Zone de signature tactile",
      emptyHint: "Signez avec le doigt ou la souris",
      filledHint: "Signature enregistree",
      clear: "Effacer",
    };
    return dict[key] ?? key;
  },
}));

// ---------------------------------------------------------------------------
// Mock canvas 2D context (jsdom ne l'implemente pas nativement)
// ---------------------------------------------------------------------------

function mockCanvasContext() {
  const ctx = {
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    lineJoin: "",
    lineCap: "",
    lineWidth: 0,
    strokeStyle: "",
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,fake");
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
  HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => false);
  return ctx;
}

beforeEach(() => {
  mockCanvasContext();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SignaturePad — rendu initial", () => {
  it("affiche le canvas et le bouton Effacer desactive (vide)", () => {
    render(<SignaturePad />);

    expect(screen.getByTestId("signature-pad-canvas")).toBeInTheDocument();
    expect(screen.getByText("Effacer").closest("button")).toBeDisabled();
    expect(screen.getByText("Signez avec le doigt ou la souris")).toBeInTheDocument();
  });
});

describe("SignaturePad — dessin", () => {
  it("devient non-vide apres un trait (pointerdown + move) et appelle onChangeEmpty(false)", () => {
    const onChangeEmpty = vi.fn();
    render(<SignaturePad onChangeEmpty={onChangeEmpty} />);

    const canvas = screen.getByTestId("signature-pad-canvas");
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1 });

    expect(onChangeEmpty).toHaveBeenCalledWith(false);
    expect(screen.getByText("Effacer").closest("button")).not.toBeDisabled();
    expect(screen.getByText("Signature enregistree")).toBeInTheDocument();
  });

  it("le bouton Effacer efface le trait et redevient vide", () => {
    const onChangeEmpty = vi.fn();
    render(<SignaturePad onChangeEmpty={onChangeEmpty} />);

    const canvas = screen.getByTestId("signature-pad-canvas");
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1 });

    fireEvent.click(screen.getByText("Effacer"));

    expect(onChangeEmpty).toHaveBeenLastCalledWith(true);
    expect(screen.getByText("Effacer").closest("button")).toBeDisabled();
    expect(screen.getByText("Signez avec le doigt ou la souris")).toBeInTheDocument();
  });
});

describe("SignaturePad — toDataURL via ref", () => {
  it("retourne null quand le canvas est vide", () => {
    const ref = createRef<SignaturePadHandle>();
    render(<SignaturePad ref={ref} />);

    expect(ref.current?.toDataURL()).toBeNull();
  });

  it("retourne une data URL apres un trait", () => {
    const ref = createRef<SignaturePadHandle>();
    render(<SignaturePad ref={ref} />);

    const canvas = screen.getByTestId("signature-pad-canvas");
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1 });

    expect(ref.current?.toDataURL()).toBe("data:image/png;base64,fake");
  });

  it("clear() via ref efface le trait", () => {
    const onChangeEmpty = vi.fn();
    const ref = createRef<SignaturePadHandle>();
    render(<SignaturePad ref={ref} onChangeEmpty={onChangeEmpty} />);

    const canvas = screen.getByTestId("signature-pad-canvas");
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1 });

    act(() => {
      ref.current?.clear();
    });

    expect(ref.current?.toDataURL()).toBeNull();
  });
});
