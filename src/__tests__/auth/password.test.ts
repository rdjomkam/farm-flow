import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

// ---------------------------------------------------------------------------
// hashPassword
// ---------------------------------------------------------------------------
describe("hashPassword", () => {
  it("crée un hash bcrypt valide", async () => {
    const hash = await hashPassword("admin123");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("admin123");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("produit des hashes différents à chaque appel (salt unique)", async () => {
    const hash1 = await hashPassword("password");
    const hash2 = await hashPassword("password");
    expect(hash1).not.toBe(hash2);
  });
});

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------
describe("verifyPassword", () => {
  it("retourne true pour un mot de passe correct", async () => {
    const hash = await hashPassword("motdepasse123");
    const result = await verifyPassword("motdepasse123", hash);
    expect(result).toBe(true);
  });

  it("retourne false pour un mot de passe incorrect", async () => {
    const hash = await hashPassword("motdepasse123");
    const result = await verifyPassword("mauvais", hash);
    expect(result).toBe(false);
  });

  it("retourne false pour un hash invalide", async () => {
    const result = await verifyPassword("password", "hash-invalide");
    expect(result).toBe(false);
  });
});
