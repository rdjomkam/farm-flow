// @vitest-environment jsdom
/**
 * Tests — useApi, message d'erreur exploitable sur une validation 400.
 *
 * Bug signale (module Previsions, onglet Parametres) : un `400` de
 * validation (`{ status, message: "Erreurs de validation.", errors: [{
 * field, message }] }`, cf. `parseBody` dans
 * `src/app/api/previsions/_shared.ts`) n'affichait qu'un message generique
 * ("Erreurs de validation.") — sur un formulaire de 19 champs, l'utilisateur
 * ne peut pas deviner LEQUEL est refuse. `useApi.call` doit desormais
 * integrer le detail par champ dans le message affiche (toast + `error`
 * retourne) et exposer `errors` tel quel pour les appelants qui veulent
 * mapper l'erreur sur le champ precis (cf. `parametres-tab.tsx`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useApi } from "@/hooks/use-api";

const toastMock = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/contexts/global-loading.context", () => ({
  useGlobalLoading: () => ({
    increment: vi.fn(),
    decrement: vi.fn(),
    incrementMutation: vi.fn(),
    decrementMutation: vi.fn(),
  }),
}));

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  toastMock.mockClear();
  vi.restoreAllMocks();
});

describe("useApi — 400 de validation avec detail par champ", () => {
  it("integre le champ et le message de chaque erreur dans le message affiche (toast + error)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        status: 400,
        message: "Erreurs de validation.",
        errors: [{ field: "prixAlevinUnitaireFCFA", message: "Doit etre superieur ou egal a 0." }],
      })
    );

    const { result } = renderHook(() => useApi());
    const res = await result.current.call("/api/previsions/scenarios/x/parametres", { method: "PUT" });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    expect(res.error).toContain("prixAlevinUnitaireFCFA");
    expect(res.error).toContain("Doit etre superieur ou egal a 0.");
    expect(res.errors).toEqual([
      { field: "prixAlevinUnitaireFCFA", message: "Doit etre superieur ou egal a 0." },
    ]);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("prixAlevinUnitaireFCFA") })
    );
  });

  it("concatene plusieurs erreurs de champs distincts", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        status: 400,
        message: "Erreurs de validation.",
        errors: [
          { field: "prixAlevinUnitaireFCFA", message: "Doit etre superieur ou egal a 0." },
          { field: "tauxEpargnePct", message: "Doit etre inferieur ou egal a 100." },
        ],
      })
    );

    const { result } = renderHook(() => useApi());
    const res = await result.current.call("/api/previsions/scenarios/x/parametres", { method: "PUT" });

    expect(res.error).toContain("prixAlevinUnitaireFCFA");
    expect(res.error).toContain("tauxEpargnePct");
    expect(res.errors).toHaveLength(2);
  });

  it("reste sur le message generique quand l'API ne fournit aucun detail par champ", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(500, { status: 500, message: "Erreur serveur." })
    );

    const { result } = renderHook(() => useApi());
    const res = await result.current.call("/api/x");

    expect(res.error).toBe("Erreur serveur.");
    expect(res.errors).toBeUndefined();
  });
});
