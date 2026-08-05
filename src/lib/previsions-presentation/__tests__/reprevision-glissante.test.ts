/**
 * src/lib/previsions-presentation/__tests__/reprevision-glissante.test.ts
 *
 * Tests de la fusion « Reprevision glissante » (ADR-053 §6.5, amendement
 * §15.2, sprint PR3-ter, story B.2).
 *
 * DISCIPLINE OBLIGATOIRE (ERR-142/ERR-160/ERR-171/ERR-172, meme protocole
 * que `tresorerie-reelle-nette.test.ts` ci-a-cote) : aucun jeu d'or externe
 * pour ce sous-module de presentation. La fixture ci-dessous est concue
 * pour faire diverger deux pieges precis nommes par la story : (1) une
 * implementation qui ignorerait la clôture et resterait sur la Prevision
 * Actualisee partout ; (2) une implementation qui recopierait un cumul
 * deja calcule par l'une des deux series sources au lieu de recalculer le
 * cumul de la serie MIXTE — c'est le piege central de cette story.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../../previsions/decimal-config";
import {
  construireReprevisionGlissante,
  type MoisPrevisionActualiseePourFusion,
} from "../reprevision-glissante";
import type { SoldeReelNette } from "../tresorerie-reelle-nette";

const d = (n: number | string) => new Decimal(n);

/**
 * Horizon de 4 mois : mois 1 et 3 non clos (Prevision Actualisee), mois 2
 * et 4 clos (Reel). Le mois 4 est clos mais SANS AUCUNE ligne reelle
 * nettable ce mois-la (cas legitime : rien depense/vendu) — doit produire
 * un delta 0, jamais une absence de mois ni une chute sur la valeur PA.
 *
 * Les valeurs PA (mois 2 et 4) sont delibrement tres eloignees des valeurs
 * REEL correspondantes pour que toute confusion source (bascule ignoree,
 * fallback errone) soit immediatement visible sur les assertions.
 */
function construireHorizon(): {
  moisPA: MoisPrevisionActualiseePourFusion[];
  moisReel: SoldeReelNette[];
  moisClotures: ReadonlySet<number>;
} {
  const moisPA: MoisPrevisionActualiseePourFusion[] = [
    { moisAbsolu: 1, resultatFCFA: d(100_000) },
    { moisAbsolu: 2, resultatFCFA: d(500_000) }, // clos : NE DOIT PAS etre retenu
    { moisAbsolu: 3, resultatFCFA: d(50_000) },
    { moisAbsolu: 4, resultatFCFA: d(999_999) }, // clos, sans donnee reelle : NE DOIT PAS etre retenu non plus
  ];
  const moisReel: SoldeReelNette[] = [
    {
      moisAbsolu: 2,
      soldeNetFCFA: d(-200_000),
      caveatApportsReelsNonModelises: true,
    },
    // mois 4 : absent volontairement (aucune ligne reelle ce mois-la).
  ];
  const moisClotures = new Set<number>([2, 4]);

  return { moisPA, moisReel, moisClotures };
}

describe("construireReprevisionGlissante", () => {
  it("(a) bascule REEL/PREVISION_ACTUALISEE selon la cloture, un delta 0 pour un mois clos sans donnee reelle", () => {
    const { moisPA, moisReel, moisClotures } = construireHorizon();
    const resultat = construireReprevisionGlissante(moisPA, moisReel, moisClotures);

    expect(resultat.map((r) => r.moisAbsolu)).toEqual([1, 2, 3, 4]);
    expect(resultat.map((r) => r.source)).toEqual([
      "PREVISION_ACTUALISEE",
      "REEL",
      "PREVISION_ACTUALISEE",
      "REEL",
    ]);
    expect(resultat.map((r) => r.soldeMensuelFCFA.toNumber())).toEqual([
      100_000, // mois1 : PA
      -200_000, // mois2 : REEL (jamais 500 000, la valeur PA)
      50_000, // mois3 : PA
      0, // mois4 : REEL sans donnee -> 0, jamais 999 999 (la valeur PA)
    ]);
  });

  it("(b) le cumul de la serie mixte est RECALCULE — diverge du cumul de chaque serie source prise isolement", () => {
    const { moisPA, moisReel, moisClotures } = construireHorizon();
    const resultat = construireReprevisionGlissante(moisPA, moisReel, moisClotures);

    // Cumul attendu, MOIS PAR MOIS, de la serie MIXTE :
    // m1 : 100 000
    // m2 : 100 000 + (-200 000) = -100 000
    // m3 : -100 000 + 50 000 = -50 000
    // m4 : -50 000 + 0 = -50 000
    expect(resultat.map((r) => r.soldeCumuleFCFA.toNumber())).toEqual([
      100_000, -100_000, -50_000, -50_000,
    ]);

    // Piege explicite : le cumul NAIF de la seule serie Prevision
    // Actualisee (sans jamais substituer le reel) donnerait
    // 100 000 / 600 000 / 650 000 / 1 649 999 — DOIT diverger du resultat
    // ci-dessus des le mois 2 (point de bascule).
    const cumulNaifPA = [100_000, 600_000, 650_000, 1_649_999];
    expect(resultat.map((r) => r.soldeCumuleFCFA.toNumber())).not.toEqual(cumulNaifPA);
  });

  it("(c) porte le caveat de serie reelle incomplete sur TOUS les mois, y compris ceux restes en Prevision Actualisee", () => {
    const { moisPA, moisReel, moisClotures } = construireHorizon();
    const resultat = construireReprevisionGlissante(moisPA, moisReel, moisClotures);
    for (const ligne of resultat) {
      expect(ligne.caveatSerieReelleIncomplete).toBe(true);
    }
  });

  it("(d) horizon entierement non clos == exactement la Prevision Actualisee (aucune substitution)", () => {
    const moisPA: MoisPrevisionActualiseePourFusion[] = [
      { moisAbsolu: 1, resultatFCFA: d(10_000) },
      { moisAbsolu: 2, resultatFCFA: d(-5_000) },
    ];
    const resultat = construireReprevisionGlissante(moisPA, [], new Set());
    expect(resultat.map((r) => r.source)).toEqual(["PREVISION_ACTUALISEE", "PREVISION_ACTUALISEE"]);
    expect(resultat.map((r) => r.soldeCumuleFCFA.toNumber())).toEqual([10_000, 5_000]);
  });
});
