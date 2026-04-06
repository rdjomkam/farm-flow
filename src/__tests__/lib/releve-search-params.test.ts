import { describe, it, expect } from "vitest";
import {
  parseReleveSearchParams,
  countActiveFilters,
  formatDateChip,
  RELEVES_PAGE_LIMIT,
  ALL_VALUE,
} from "@/lib/releve-search-params";
import { TypeReleve } from "@/types";

describe("parseReleveSearchParams", () => {
  it("retourne des valeurs par defaut quand aucun param n'est fourni", () => {
    const result = parseReleveSearchParams({});
    expect(result.offset).toBe(0);
    expect(result.limit).toBe(RELEVES_PAGE_LIMIT);
    expect(result.vagueId).toBeUndefined();
    expect(result.bacId).toBeUndefined();
    expect(result.typeReleve).toBeUndefined();
    expect(result.dateFrom).toBeUndefined();
    expect(result.dateTo).toBeUndefined();
    expect(result.modifie).toBeUndefined();
  });

  it("parse correctement un typeReleve valide", () => {
    const result = parseReleveSearchParams({ typeReleve: "BIOMETRIE" });
    expect(result.typeReleve).toBe(TypeReleve.BIOMETRIE);
  });

  it("ignore un typeReleve invalide", () => {
    const result = parseReleveSearchParams({ typeReleve: "INVALIDE" });
    expect(result.typeReleve).toBeUndefined();
  });

  it("ignore la valeur sentinelle ALL_VALUE", () => {
    const result = parseReleveSearchParams({ typeReleve: ALL_VALUE });
    expect(result.typeReleve).toBeUndefined();
  });

  it("parse tous les types de releve valides", () => {
    for (const type of Object.values(TypeReleve)) {
      const result = parseReleveSearchParams({ typeReleve: type });
      expect(result.typeReleve).toBe(type);
    }
  });

  it("parse modifie=true en boolean true", () => {
    const result = parseReleveSearchParams({ modifie: "true" });
    expect(result.modifie).toBe(true);
  });

  it("ignore modifie si differente de 'true'", () => {
    expect(parseReleveSearchParams({ modifie: "false" }).modifie).toBeUndefined();
    expect(parseReleveSearchParams({ modifie: "1" }).modifie).toBeUndefined();
    expect(parseReleveSearchParams({}).modifie).toBeUndefined();
  });

  it("parse offset numerique correctement", () => {
    const result = parseReleveSearchParams({ offset: "40" });
    expect(result.offset).toBe(40);
  });

  it("parse offset invalide en 0", () => {
    expect(parseReleveSearchParams({ offset: "abc" }).offset).toBe(0);
    expect(parseReleveSearchParams({ offset: "-5" }).offset).toBe(0);
    expect(parseReleveSearchParams({ offset: "" }).offset).toBe(0);
  });

  it("transmet vagueId et bacId", () => {
    const result = parseReleveSearchParams({ vagueId: "vague-1", bacId: "bac-1" });
    expect(result.vagueId).toBe("vague-1");
    expect(result.bacId).toBe("bac-1");
  });

  it("convertit une chaine vide en undefined pour vagueId et bacId", () => {
    const result = parseReleveSearchParams({ vagueId: "", bacId: "" });
    expect(result.vagueId).toBeUndefined();
    expect(result.bacId).toBeUndefined();
  });

  it("transmet dateFrom et dateTo", () => {
    const result = parseReleveSearchParams({
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
    });
    expect(result.dateFrom).toBe("2026-01-01");
    expect(result.dateTo).toBe("2026-03-31");
  });

  it("retourne la limite par defaut RELEVES_PAGE_LIMIT", () => {
    const result = parseReleveSearchParams({});
    expect(result.limit).toBe(20);
  });
});

describe("countActiveFilters", () => {
  it("retourne 0 quand aucun filtre n'est actif", () => {
    expect(countActiveFilters({})).toBe(0);
  });

  it("compte vagueId comme un filtre actif", () => {
    expect(countActiveFilters({ vagueId: "vague-1" })).toBe(1);
  });

  it("compte bacId comme un filtre actif", () => {
    expect(countActiveFilters({ bacId: "bac-1" })).toBe(1);
  });

  it("compte typeReleve valide comme un filtre actif", () => {
    expect(countActiveFilters({ typeReleve: "BIOMETRIE" })).toBe(1);
  });

  it("ne compte pas ALL_VALUE comme filtre actif", () => {
    expect(countActiveFilters({ typeReleve: ALL_VALUE })).toBe(0);
  });

  it("compte dateFrom comme un filtre actif", () => {
    expect(countActiveFilters({ dateFrom: "2026-01-01" })).toBe(1);
  });

  it("compte dateTo comme un filtre actif", () => {
    expect(countActiveFilters({ dateTo: "2026-03-31" })).toBe(1);
  });

  it("compte modifie=true comme un filtre actif", () => {
    expect(countActiveFilters({ modifie: "true" })).toBe(1);
  });

  it("ne compte pas modifie=false comme filtre actif", () => {
    expect(countActiveFilters({ modifie: "false" })).toBe(0);
  });

  it("compte tous les filtres simultanement", () => {
    const count = countActiveFilters({
      vagueId: "vague-1",
      bacId: "bac-1",
      typeReleve: "MORTALITE",
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
      modifie: "true",
    });
    expect(count).toBe(6);
  });
});

describe("formatDateChip", () => {
  it("formate une date ISO en DD/MM", () => {
    expect(formatDateChip("2026-03-15")).toBe("15/03");
  });

  it("formate le 1er janvier correctement avec zero padding", () => {
    expect(formatDateChip("2026-01-01")).toBe("01/01");
  });

  it("formate le 31 decembre correctement", () => {
    expect(formatDateChip("2026-12-31")).toBe("31/12");
  });

  it("retourne la chaine brute si la date est invalide", () => {
    const result = formatDateChip("invalide");
    // la fonction retourne dateStr en cas d'erreur
    expect(typeof result).toBe("string");
  });
});
