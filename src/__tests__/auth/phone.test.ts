import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/auth";

describe("normalizePhone", () => {
  // --- Cas valides ---

  it("normalise un numero local mobile (9 chiffres)", () => {
    expect(normalizePhone("699999999")).toBe("+237699999999");
  });

  it("retourne tel quel un numero deja au format +237", () => {
    expect(normalizePhone("+237699999999")).toBe("+237699999999");
  });

  it("normalise un numero avec prefixe 237 sans +", () => {
    expect(normalizePhone("237699999999")).toBe("+237699999999");
  });

  it("normalise un numero avec prefixe 00237", () => {
    expect(normalizePhone("00237699999999")).toBe("+237699999999");
  });

  it("normalise un numero avec espaces", () => {
    expect(normalizePhone("6 99 99 99 99")).toBe("+237699999999");
  });

  it("normalise un numero fixe camerounais (commence par 2)", () => {
    expect(normalizePhone("299999999")).toBe("+237299999999");
  });

  it("normalise un numero avec tirets", () => {
    expect(normalizePhone("699-99-99-99")).toBe("+237699999999");
  });

  it("normalise un numero avec points", () => {
    expect(normalizePhone("6.99.99.99.99")).toBe("+237699999999");
  });

  it("normalise +237 avec espaces", () => {
    expect(normalizePhone("+237 6 99 99 99 99")).toBe("+237699999999");
  });

  // --- Cas invalides ---

  it("retourne null pour un numero trop court", () => {
    expect(normalizePhone("12345")).toBeNull();
  });

  it("retourne null pour une chaine vide", () => {
    expect(normalizePhone("")).toBeNull();
  });

  it("retourne null pour un numero qui ne commence pas par 6 ou 2", () => {
    expect(normalizePhone("399999999")).toBeNull();
  });

  it("retourne null pour un numero trop long (10 chiffres locaux)", () => {
    expect(normalizePhone("6999999990")).toBeNull();
  });

  it("retourne null pour un numero avec lettres", () => {
    expect(normalizePhone("69999abcd")).toBeNull();
  });

  it("retourne null pour un numero a 8 chiffres (trop court)", () => {
    expect(normalizePhone("69999999")).toBeNull();
  });
});
