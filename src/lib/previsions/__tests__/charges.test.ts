import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import { CategorieJournalPrevu } from "@/types";
import {
  calculerChargesMensuelles,
  calculerBaseRepartition,
  calculerQuotePartVague,
} from "../charges";
import type { ChargeMensuelleInput, ChargePourBaseInput, JournalEntryInput } from "../charges";

describe("calculerChargesMensuelles", () => {
  const lignes: ChargeMensuelleInput[] = [
    { posteId: "p1", moisAbsolu: 0, montantFCFA: new Decimal(100000) },
    { posteId: "p2", moisAbsolu: 0, montantFCFA: new Decimal(50000) },
    { posteId: "p1", moisAbsolu: 1, montantFCFA: new Decimal(120000) },
  ];

  it("filtre par moisAbsolu et totalise", () => {
    const result = calculerChargesMensuelles(lignes, 0);
    expect(result.totalFCFA.equals(150000)).toBe(true);
    expect(result.parPoste).toHaveLength(2);
  });

  it("mois sans charge -> total 0, parPoste vide", () => {
    const result = calculerChargesMensuelles(lignes, 5);
    expect(result.totalFCFA.equals(0)).toBe(true);
    expect(result.parPoste).toEqual([]);
  });
});

describe("calculerBaseRepartition — decision 6 de l'ADR-053 (correction du §5.7)", () => {
  const charges: ChargePourBaseInput[] = [
    { montantFCFA: new Decimal(200000), inclusBaseRepartition: true }, // logistique
    { montantFCFA: new Decimal(300000), inclusBaseRepartition: true }, // exploitation
    { montantFCFA: new Decimal(999999), inclusBaseRepartition: false }, // exclu explicitement
  ];

  it("TEST DEDIE OBLIGATOIRE (piege n°1) : exclut le journal OPERATIONNEL deja affecte a une vague", () => {
    const journal: JournalEntryInput[] = [
      {
        montantFCFA: new Decimal(50000),
        categorie: CategorieJournalPrevu.OPERATIONNEL,
        vaguePrevueId: null, // general -> inclus
      },
      {
        montantFCFA: new Decimal(1000000),
        categorie: CategorieJournalPrevu.OPERATIONNEL,
        vaguePrevueId: "vague-prevue-42", // deja affecte -> EXCLU
      },
    ];

    const base = calculerBaseRepartition(charges, journal);

    // Sans le fix (bug du §5.7) : 200000 + 300000 + 50000 + 1000000 = 1550000
    // Avec le fix (decision 6, correcte) : 200000 + 300000 + 50000 = 550000
    expect(base.equals(550000)).toBe(true);
    expect(base.equals(1550000)).toBe(false);
  });

  it("exclut toute ligne de journal categorie=INVESTISSEMENT", () => {
    const journal: JournalEntryInput[] = [
      {
        montantFCFA: new Decimal(2000000),
        categorie: CategorieJournalPrevu.INVESTISSEMENT,
        vaguePrevueId: null,
      },
    ];
    const base = calculerBaseRepartition(charges, journal);
    expect(base.equals(500000)).toBe(true); // seulement les 2 charges inclusBaseRepartition
  });

  it("exclut toute charge dont inclusBaseRepartition = false", () => {
    const base = calculerBaseRepartition(charges, []);
    expect(base.equals(500000)).toBe(true); // 200000 + 300000, le 999999 exclu
  });

  it("besoin_total_kg / base = 0 -> pas d'erreur (charges et journal vides)", () => {
    const base = calculerBaseRepartition([], []);
    expect(base.equals(0)).toBe(true);
  });
});

describe("calculerQuotePartVague", () => {
  it("deux vagues actives le meme mois -> chacune recoit une part egale (agregation native)", () => {
    const parts = calculerQuotePartVague(new Decimal(100000), ["v1", "v2"]);
    expect(parts.get("v1")!.equals(50000)).toBe(true);
    expect(parts.get("v2")!.equals(50000)).toBe(true);
  });

  it("aucune vague active -> map vide, pas de division par zero", () => {
    const parts = calculerQuotePartVague(new Decimal(100000), []);
    expect(parts.size).toBe(0);
  });

  it("base_repartition = 0 -> quote-part 0 pour chaque vague active", () => {
    const parts = calculerQuotePartVague(new Decimal(0), ["v1"]);
    expect(parts.get("v1")!.equals(0)).toBe(true);
  });
});
