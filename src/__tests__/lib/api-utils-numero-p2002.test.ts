import { describe, it, expect } from "vitest";
import { handleApiError } from "@/lib/api-utils";

/**
 * SU.3 — vérifie que handleApiError produit un message actionnable (pas un
 * 500 opaque) quand une collision de numero/code survient malgré le verrou
 * advisory de numero-utils.ts.
 */
describe("handleApiError — P2002 sur numero/code (SU.3)", () => {
  it("retourne 409 avec un message actionnable dédié quand le champ en collision est 'numero'", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["numero"] },
    });
    const res = handleApiError("POST /api/test", p2002, "Erreur serveur.");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toMatch(/réessayez/i);
  });

  it("retourne 409 avec un message actionnable dédié quand le champ en collision est 'code'", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["code"] },
    });
    const res = handleApiError("POST /api/test", p2002, "Erreur serveur.");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toMatch(/réessayez/i);
  });

  it("conserve le message générique pour une collision sur un autre champ (ex: name)", async () => {
    const p2002 = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["name"] },
    });
    const res = handleApiError("POST /api/test", p2002, "Erreur serveur.");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("Cette valeur existe déjà");
    expect(body.message).not.toMatch(/réessayez/i);
  });
});
