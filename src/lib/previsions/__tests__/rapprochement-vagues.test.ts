/**
 * src/lib/previsions/__tests__/rapprochement-vagues.test.ts
 *
 * Tests de `construireVueParVague` (ADR-053 section 15, Sprint PR3, story
 * PR3.7 — onglet Rapprochement, vue "par vague").
 *
 * DISCIPLINE OBLIGATOIRE (ADR-053 section 15.6, ERR-142/ERR-160/ERR-171) :
 * chaque test appelle EXCLUSIVEMENT `construireVueParVague` (production),
 * jamais une reimplementation locale du calcul cout/marge/cout-au-kg.
 *
 * Couvre :
 * - (a) une vague REALISEE : cout/marge/cout-au-kg prevu vs reel, signe et
 *   sens corrects (dans les deux sens : favorable ET defavorable).
 * - (b) une vague NON REALISEE : `realisee = false`, tous les `reel` valent
 *   `null` (JAMAIS 0), `sens = NON_APPLICABLE`.
 * - (c) biomasse prevue nulle -> `coutAuKg.prevu = null` (jamais
 *   Infinity/NaN), sans planter `calculerSensEcart`.
 * - (d) poids reel nul (vague realisee mais rien vendu) -> `coutAuKg.reel =
 *   null`, distinct du cas (b).
 * - (e) libelle de cohorte : `codePrevu` et `codeReel` co-existent quand la
 *   vague est rattachee.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../decimal-config";
import { construireVueParVague } from "../rapprochement-vagues";
import type { VaguePrevuePourVueInput, VagueReelleAgregat } from "../rapprochement-vagues";

const d = (n: number | string) => new Decimal(n);

function vaguePrevue(overrides: Partial<VaguePrevuePourVueInput> = {}): VaguePrevuePourVueInput {
  return {
    vaguePrevueId: "vp1",
    codePrevu: "V7",
    statut: "EN_COURS",
    vagueReelleId: null,
    coutProductionFCFA: d(1_000_000),
    revenuPrevuFCFA: d(1_500_000),
    biomasseKg: d(500),
    ...overrides,
  };
}

describe("construireVueParVague", () => {
  it("(a) vague realisee, cout reel > prevu (defavorable) et revenu reel > prevu (marge favorable)", () => {
    const prevue = vaguePrevue({ vagueReelleId: "v1" });
    const reel = new Map<string, VagueReelleAgregat>([
      [
        "v1",
        {
          vagueId: "v1",
          codeReel: "V7",
          coutReelFCFA: d(1_200_000), // > prevu 1_000_000 -> DEFAVORABLE (nature DEPENSE)
          revenuReelFCFA: d(2_000_000), // > prevu 1_500_000
          poidsReelKg: d(500),
        },
      ],
    ]);

    const [ligne] = construireVueParVague([prevue], reel);

    expect(ligne.realisee).toBe(true);
    expect(ligne.codePrevu).toBe("V7");
    expect(ligne.codeReel).toBe("V7");
    expect(ligne.vagueReelleId).toBe("v1");

    // Cout complet : reel (1_200_000) > prevu (1_000_000) -> DEFAVORABLE, ecart +200_000
    expect(ligne.coutComplet.prevu!.toNumber()).toBe(1_000_000);
    expect(ligne.coutComplet.reel!.toNumber()).toBe(1_200_000);
    expect(ligne.coutComplet.ecartAbsolu!.toNumber()).toBe(200_000);
    expect(ligne.coutComplet.sens).toBe("DEFAVORABLE");

    // Marge prevue = 1_500_000 - 1_000_000 = 500_000 ; marge reelle = 2_000_000 - 1_200_000 = 800_000
    // reel (800_000) > prevu (500_000) -> FAVORABLE (nature ENTREE)
    expect(ligne.marge.prevu!.toNumber()).toBe(500_000);
    expect(ligne.marge.reel!.toNumber()).toBe(800_000);
    expect(ligne.marge.ecartAbsolu!.toNumber()).toBe(300_000);
    expect(ligne.marge.sens).toBe("FAVORABLE");

    // Cout/kg prevu = 1_000_000 / 500 = 2000 ; reel = 1_200_000 / 500 = 2400 -> DEFAVORABLE
    expect(ligne.coutAuKg.prevu!.toNumber()).toBe(2000);
    expect(ligne.coutAuKg.reel!.toNumber()).toBe(2400);
    expect(ligne.coutAuKg.sens).toBe("DEFAVORABLE");
  });

  it("(a bis) vague realisee, cout reel < prevu (favorable) et marge reelle < prevue (defavorable)", () => {
    const prevue = vaguePrevue({ vagueReelleId: "v2" });
    const reel = new Map<string, VagueReelleAgregat>([
      [
        "v2",
        {
          vagueId: "v2",
          codeReel: "V7",
          coutReelFCFA: d(800_000), // < prevu -> FAVORABLE
          revenuReelFCFA: d(1_000_000), // marge reelle 200_000 < marge prevue 500_000 -> DEFAVORABLE
          poidsReelKg: d(500),
        },
      ],
    ]);

    const [ligne] = construireVueParVague([prevue], reel);

    expect(ligne.coutComplet.sens).toBe("FAVORABLE");
    expect(ligne.marge.prevu!.toNumber()).toBe(500_000);
    expect(ligne.marge.reel!.toNumber()).toBe(200_000);
    expect(ligne.marge.sens).toBe("DEFAVORABLE");
  });

  it("(b) vague NON realisee : realisee=false, tous les reel valent null (jamais 0), sens NON_APPLICABLE", () => {
    const prevue = vaguePrevue({ vagueReelleId: null, statut: "PLANIFIEE" });
    const [ligne] = construireVueParVague([prevue], new Map());

    expect(ligne.realisee).toBe(false);
    expect(ligne.codeReel).toBeNull();
    expect(ligne.vagueReelleId).toBeNull();

    expect(ligne.coutComplet.reel).toBeNull();
    expect(ligne.coutComplet.sens).toBe("NON_APPLICABLE");
    expect(ligne.coutComplet.couleur).toBe("neutre");

    expect(ligne.marge.reel).toBeNull();
    expect(ligne.marge.sens).toBe("NON_APPLICABLE");

    expect(ligne.coutAuKg.reel).toBeNull();
    expect(ligne.coutAuKg.sens).toBe("NON_APPLICABLE");

    // Le prevu, lui, reste bien calculable (une vague non realisee a quand
    // meme un plan prevu).
    expect(ligne.coutComplet.prevu!.toNumber()).toBe(1_000_000);
    expect(ligne.marge.prevu!.toNumber()).toBe(500_000);
  });

  it("(c) biomasse prevue nulle -> coutAuKg.prevu = null (jamais Infinity/NaN), calcul ne plante pas", () => {
    const prevue = vaguePrevue({ vagueReelleId: null, biomasseKg: d(0) });
    const [ligne] = construireVueParVague([prevue], new Map());

    expect(ligne.coutAuKg.prevu).toBeNull();
    expect(ligne.coutAuKg.sens).toBe("NON_APPLICABLE");
    expect(ligne.coutAuKg.couleur).toBe("neutre");
    // coutComplet et marge restent calculables independamment (biomasse
    // nulle n'affecte que le cout/kg).
    expect(ligne.coutComplet.prevu!.toNumber()).toBe(1_000_000);
  });

  it("(d) vague realisee, poids reel nul (rien vendu) -> coutAuKg.reel = null, distinct du cas non realise", () => {
    const prevue = vaguePrevue({ vagueReelleId: "v3" });
    const reel = new Map<string, VagueReelleAgregat>([
      [
        "v3",
        {
          vagueId: "v3",
          codeReel: "V7",
          coutReelFCFA: d(900_000),
          revenuReelFCFA: d(0),
          poidsReelKg: d(0), // rien vendu -> division protegee
        },
      ],
    ]);

    const [ligne] = construireVueParVague([prevue], reel);

    expect(ligne.realisee).toBe(true); // distinct du cas (b) : la vague EST realisee
    expect(ligne.coutComplet.reel!.toNumber()).toBe(900_000); // le cout complet, lui, reste calculable
    expect(ligne.coutAuKg.reel).toBeNull(); // mais le cout/kg est indisponible (division par 0 protegee)
    expect(ligne.coutAuKg.sens).toBe("NON_APPLICABLE");
  });

  it("(e) libelle de cohorte : vague sans agregat reel fourni pour un vagueReelleId non null -> repli defensif a 0, jamais un plantage", () => {
    // Cas defensif : le vagueReelleId est renseigne mais l'appelant n'a
    // fourni aucun agregat pour cet id (ne devrait jamais arriver en
    // production si la Map est construite par `getCoutsReelsParVagues`,
    // mais la fonction ne doit jamais planter pour autant).
    const prevue = vaguePrevue({ vagueReelleId: "v-manquant" });
    const [ligne] = construireVueParVague([prevue], new Map());

    expect(ligne.realisee).toBe(true);
    expect(ligne.codeReel).toBeNull();
    expect(ligne.coutComplet.reel!.toNumber()).toBe(0);
  });

  it("plusieurs vagues -> une ligne par vague, dans l'ordre d'entree", () => {
    const p1 = vaguePrevue({ vaguePrevueId: "vp1", codePrevu: "V1" });
    const p2 = vaguePrevue({ vaguePrevueId: "vp2", codePrevu: "V2" });
    const lignes = construireVueParVague([p1, p2], new Map());
    expect(lignes.map((l) => l.codePrevu)).toEqual(["V1", "V2"]);
  });
});

/* ==================================================================== *
 * Preuve par falsification chiffree (ADR-053 section 15.6 point 3)
 * ==================================================================== *
 * Documentee ici en commentaire (le protocole complet, avec les 3
 * mutations appliquees au code de PRODUCTION puis restaurees, est rapporte
 * dans le rapport de livraison de la story PR3.7 — cf.
 * `docs/tests/rapport-story-PR3.7.md` si present, ou le message de
 * livraison de l'agent). Resume :
 * - Mutation 1 (inversion du sens favorable/defavorable dans
 *   `construireComparaison`, `rapprochement-vagues.ts`, en passant
 *   `natureGrandeur` invers e pour `coutComplet`/`coutAuKg` : "ENTREE" au
 *   lieu de "DEPENSE") -> les assertions `.sens` de (a) et (a bis)
 *   tombent : 3 assertions cassees (coutComplet DEFAVORABLE->FAVORABLE,
 *   FAVORABLE->DEFAVORABLE, coutAuKg DEFAVORABLE->FAVORABLE).
 * - Mutation 2 (masquer le cas non realise : forcer `realisee = true`
 *   inconditionnellement) -> les assertions `.reel === null` du test (b)
 *   tombent (3 assertions : coutComplet.reel, marge.reel, coutAuKg.reel
 *   deviennent des Decimal(0) au lieu de null).
 * - Mutation 3 (rendre `SANS_SOURCE_REELLE`-like le cas poids nul comme un
 *   0 plutot qu'un null : supprimer le garde `diviserOuNull`) -> le test
 *   (d) `coutAuKg.reel` tombe (attend null, recoit Infinity ou NaN selon
 *   l'implementation de repli).
 */
