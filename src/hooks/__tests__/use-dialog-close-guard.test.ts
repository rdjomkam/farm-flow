// @vitest-environment jsdom
/**
 * Tests — useDialogCloseGuard (Sprint PR2-ter, story PR2ter.2, Bug A)
 *
 * Hook : src/hooks/use-dialog-close-guard.ts
 *
 * Couverture, isolee du DOM Radix (pas de rendu de Dialog reel — voir
 * pre-analyse PR2ter.2 section 5, repli recommande : tester le handler
 * directement plutot que de dependre de la simulation d'evenement Radix) :
 * 1. `isDirty === false` : `preventDefault` n'est jamais appele (dialogue
 *    encore vierge, aucune friction).
 * 2. `isDirty === true` : `onInteractOutside` ET `onEscapeKeyDown` appellent
 *    tous les deux `preventDefault` (meme risque de perte silencieuse par
 *    les deux chemins, pre-analyse section 3).
 * 3. Les handlers sont stables (memoises via `useCallback`) tant que
 *    `isDirty` ne change pas, et se recreent quand il change.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";

function fakeEvent() {
  return { preventDefault: vi.fn() } as unknown as Parameters<
    ReturnType<typeof useDialogCloseGuard>["onInteractOutside"]
  >[0];
}

describe("useDialogCloseGuard — dialogue encore vierge (isDirty=false)", () => {
  it("n'appelle pas preventDefault sur onInteractOutside", () => {
    const { result } = renderHook(() => useDialogCloseGuard(false));
    const event = fakeEvent();

    result.current.onInteractOutside(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("n'appelle pas preventDefault sur onEscapeKeyDown", () => {
    const { result } = renderHook(() => useDialogCloseGuard(false));
    const event = fakeEvent();

    result.current.onEscapeKeyDown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe("useDialogCloseGuard — formulaire touche (isDirty=true)", () => {
  it("bloque la fermeture par clic exterieur (onInteractOutside appelle preventDefault)", () => {
    const { result } = renderHook(() => useDialogCloseGuard(true));
    const event = fakeEvent();

    result.current.onInteractOutside(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("bloque la fermeture par Echap (onEscapeKeyDown appelle preventDefault) — meme risque que le clic exterieur", () => {
    const { result } = renderHook(() => useDialogCloseGuard(true));
    const event = fakeEvent();

    result.current.onEscapeKeyDown(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});

describe("useDialogCloseGuard — stabilite des handlers", () => {
  it("conserve la meme reference de handler tant que isDirty ne change pas", () => {
    const { result, rerender } = renderHook(({ isDirty }) => useDialogCloseGuard(isDirty), {
      initialProps: { isDirty: false },
    });

    const first = result.current;
    rerender({ isDirty: false });

    expect(result.current.onInteractOutside).toBe(first.onInteractOutside);
    expect(result.current.onEscapeKeyDown).toBe(first.onEscapeKeyDown);
  });

  it("recree les handlers quand isDirty change", () => {
    const { result, rerender } = renderHook(({ isDirty }) => useDialogCloseGuard(isDirty), {
      initialProps: { isDirty: false },
    });

    const first = result.current;
    rerender({ isDirty: true });

    expect(result.current.onInteractOutside).not.toBe(first.onInteractOutside);
    expect(result.current.onEscapeKeyDown).not.toBe(first.onEscapeKeyDown);
  });
});
