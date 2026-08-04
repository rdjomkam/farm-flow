/**
 * Tests unitaires — story PR2.1, `src/lib/previsions/decimal-io.ts`.
 *
 * Prouve la regle de conversion tranchee par la pre-analyse PR2.1 (jamais a
 * contourner) : `Prisma.Decimal -> decimal.js moteur` passe TOUJOURS par
 * `.toString()` (jamais un detour par `.toNumber()`, qui reintroduirait le
 * binaire flottant que le choix Decimal visait a eviter).
 *
 * Ce module (`src/lib/previsions/`) est INTOUCHABLE pour cette story : ce
 * fichier ne teste QUE `decimal-io.ts`, sans modifier une seule ligne du
 * moteur.
 */
import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { Decimal as EngineDecimal } from "@/lib/previsions/decimal-config";
import { prismaDecimalToEngine, decimalToNumber } from "@/lib/previsions/decimal-io";

describe("prismaDecimalToEngine — via .toString(), jamais .toNumber()", () => {
  it("ne perd AUCUNE precision sur une valeur qui perdrait de la precision via .toNumber()", () => {
    // 18 chiffres apres la virgule : au-dela de ce que IEEE-754 double
    // (utilise par .toNumber()) peut representer exactement.
    const valeurExacte = "0.123456789012345678";
    const prismaDecimal = new Prisma.Decimal(valeurExacte);

    // Preuve que .toNumber() PERD reellement de la precision sur cette
    // valeur (sinon le test ne demontrerait rien) :
    const viaToNumber = new EngineDecimal(prismaDecimal.toNumber());
    expect(viaToNumber.toString()).not.toBe(valeurExacte);

    // prismaDecimalToEngine, lui, doit rester EXACT.
    const engineDecimal = prismaDecimalToEngine(prismaDecimal);
    expect(engineDecimal.toString()).toBe(valeurExacte);
  });

  it("passe bien par .toString() en interne (pas de perte sur une valeur a 20 chiffres significatifs)", () => {
    const valeur = "123456789012345678.9"; // 20 chiffres significatifs
    const prismaDecimal = new Prisma.Decimal(valeur);
    const result = prismaDecimalToEngine(prismaDecimal);
    expect(result.toString()).toBe(valeur);
  });

  it("retourne une instance du Decimal MOTEUR (decimal.js configure), pas Prisma.Decimal", () => {
    const prismaDecimal = new Prisma.Decimal("42.5");
    const result = prismaDecimalToEngine(prismaDecimal);
    expect(result).toBeInstanceOf(EngineDecimal);
    expect(result instanceof Prisma.Decimal).toBe(false);
  });

  it("propage null en null (surcharge explicite), jamais une exception", () => {
    expect(prismaDecimalToEngine(null)).toBeNull();
  });

  it("les deux representations ne sont jamais mélangées implicitement : une operation moteur sur le resultat fonctionne normalement", () => {
    const prismaDecimal = new Prisma.Decimal("10.5");
    const engineValue = prismaDecimalToEngine(prismaDecimal);
    // Une operation moteur (plus/times/etc.) doit fonctionner sans lever
    // d'exception de type — preuve indirecte que le retour est bien une
    // instance du decimal.js configure par decimal-config.ts, pas l'instance
    // Prisma.Decimal (qui n'a pas la meme precision configuree).
    const doubled = engineValue.times(2);
    expect(doubled.toString()).toBe("21");
  });
});

describe("decimalToNumber — reserve a la frontiere API/JSON", () => {
  it("convertit un Prisma.Decimal en number JS via .toNumber()", () => {
    const prismaDecimal = new Prisma.Decimal("42.5");
    expect(decimalToNumber(prismaDecimal)).toBe(42.5);
    expect(typeof decimalToNumber(prismaDecimal)).toBe("number");
  });

  it("propage null en null", () => {
    expect(decimalToNumber(null)).toBeNull();
  });
});
