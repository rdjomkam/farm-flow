/**
 * Recette PR1.4 — scenario B : annexe-b-corrigee.json.
 *
 * Meme plan que le scenario A (meme `entreesModele`), SANS apports en
 * capital ni investissements. **Seul** scenario dont la tresorerie passe
 * sous zero — point bas -6 334 704 en novembre 2026 (mois 3) — donc le seul
 * qui exerce reellement `calculerPointBasTresorerie` sur son cas nominal
 * (ADR-053 section 7 / §7.2).
 *
 * `entreesModele` etant identique entre les deux fixtures (README), les
 * series besoinsAliments et coutAlimentsFCFA par vague sont IDENTIQUES entre
 * A et B — verifiees ici a nouveau pour la non-regression et parce que
 * "comparer contre le jeu d'or" doit valoir pour CHAQUE fixture livree, pas
 * seulement pour la premiere testee.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../../decimal-config";
import { calculerPointBasTresorerie } from "../../tresorerie";
import { loadGoldenFixture, expectEntierExact, expectMontantFCFA, expectKgApprox } from "./helpers";
import {
  buildBesoinsAlimentsCalendrier,
  buildCoutAlimentsParVague,
  buildRemisePctParVague,
  buildLogistiqueCalendrier,
  buildCoutAlimentsParVagueEtMois,
  aggregerDepensesAlimentsParMoisCalendaire,
  aggregerCoutAlimentsParVagueEtMoisCycle,
  buildChaineFinanciereCalendrier,
  buildAlevinsACommanderParVague,
} from "./orchestration";

const fixture = loadGoldenFixture("annexe-b-corrigee.json");
const NB_MOIS = fixture.mois.length;

describe("Recette PR1.4 — annexe-b-corrigee.json (scenario B)", () => {
  it("jeu d'or : 21 mois, 19 vagues, aucun apport ni investissement", () => {
    expect(NB_MOIS).toBe(21);
    expect(fixture.entreesModele.planVagues).toHaveLength(19);
    expect(fixture.resultats.apportsCapital.every((v) => v === 0)).toBe(true);
    expect(fixture.resultats.investissements.every((v) => v === 0)).toBe(true);
    expect(fixture.cumuls.apportsCapital).toBe(0);
    expect(fixture.cumuls.dontInvestissements).toBe(0);
  });

  describe("Etapes 2+ceil agrege — besoinsAliments (calculerBesoinAlimentMensuel), 21 mois", () => {
    const resultat = buildBesoinsAlimentsCalendrier(fixture, NB_MOIS);
    const granulometries = fixture.entreesModele.aliments.map((a) => a.granulometrie);

    for (let i = 0; i < NB_MOIS; i++) {
      const moisLabel = fixture.mois[i];

      it(`mois ${i} (${moisLabel}) — totalKg`, () => {
        expectKgApprox(resultat.totalKg[i], fixture.besoinsAliments.totalKg[i], `besoinsAliments.totalKg[${moisLabel}]`);
      });

      it(`mois ${i} (${moisLabel}) — sacsTotal (tolerance 0)`, () => {
        expectEntierExact(resultat.sacsTotal[i], fixture.besoinsAliments.sacsTotal[i], `besoinsAliments.sacsTotal[${moisLabel}]`);
      });

      for (const g of granulometries) {
        it(`mois ${i} (${moisLabel}) — kg ${g}`, () => {
          expectKgApprox(
            resultat.kgParGranulometrie[g][i],
            fixture.besoinsAliments.kgParGranulometrie[g][i],
            `besoinsAliments.kgParGranulometrie.${g}[${moisLabel}]`
          );
        });

        it(`mois ${i} (${moisLabel}) — sacs ${g} (tolerance 0)`, () => {
          expectEntierExact(
            resultat.sacsParGranulometrie[g][i],
            fixture.besoinsAliments.sacsParGranulometrie[g][i],
            `besoinsAliments.sacsParGranulometrie.${g}[${moisLabel}]`
          );
        });
      }
    }

    it("cumuls.besoinMensuelMaxKg = max(totalKg) sur les 21 mois", () => {
      const max = resultat.totalKg.reduce((m, v) => (v.gt(m) ? v : m), new Decimal(0));
      expectKgApprox(max, fixture.cumuls.besoinMensuelMaxKg, "cumuls.besoinMensuelMaxKg");
    });
  });

  describe("Etapes 3+4 — coutAlimentsFCFA par vague (appliquerPalierRemise + calculerCoutAlimentVague), 19 vagues", () => {
    const resultats = buildCoutAlimentsParVague(fixture);

    for (const vague of fixture.entreesModele.planVagues) {
      it(`${vague.vague} — coutAlimentsFCFA (tolerance <= 1 FCFA)`, () => {
        const obtenu = resultats.find((r) => r.vague === vague.vague)!;
        expectMontantFCFA(obtenu.coutFCFA, vague.coutAlimentsFCFA, `planVagues.${vague.vague}.coutAlimentsFCFA`);
      });
    }

    it("somme des 19 vagues = cumuls.dontAliments", () => {
      const total = resultats.reduce((s, r) => s.plus(r.coutFCFA), new Decimal(0));
      expectMontantFCFA(total, fixture.cumuls.dontAliments, "cumuls.dontAliments");
    });
  });

  /**
   * Story PR2sept.3 (ADR-053 §13.4) : recette du POURCENTAGE DE REMISE
   * RETENU lui-meme (`planVagues[].remisePct` du jeu d'or), pas seulement du
   * montant qui en decoule. Les quatre paliers du classeur sont passes TELS
   * QUELS (seuils en tonnes), et les quatre sont atteints par les 19 vagues :
   * 4 t -> 0 %, 8 t -> 2 %, 10 t (seuil EXACT) et 12 t -> 4 %, 15 t (seuil
   * EXACT) -> 6 %.
   */
  describe("Story PR2sept.3 — remisePct par vague (determinerPourcentageRemise), 19 vagues, decidee sur le tonnage vise", () => {
    const resultats = buildRemisePctParVague(fixture);

    for (const vague of fixture.entreesModele.planVagues) {
      it(`${vague.vague} — ${vague.objectifTonnes} t -> remisePct = ${vague.remisePct}`, () => {
        const obtenu = resultats.find((r) => r.vague === vague.vague)!;
        // Le jeu d'or exprime la remise en fraction 0..1, le moteur sur 0..100.
        expect(obtenu.pourcentageRemiseApplique.equals(new Decimal(vague.remisePct).times(100))).toBe(true);
      });
    }
  });

  describe("Story PR2bis.3 — alevinsACommanderNb (calculerAlevinsACommander), 19 vagues, tolerance 0", () => {
    const resultats = buildAlevinsACommanderParVague(fixture);

    for (const vague of fixture.entreesModele.planVagues) {
      it(`${vague.vague} — alevinsACommanderNb (tolerance 0)`, () => {
        const obtenu = resultats.find((r) => r.vague === vague.vague)!;
        expectEntierExact(
          obtenu.alevinsACommanderNb,
          vague.alevinsACommanderNb,
          `planVagues.${vague.vague}.alevinsACommanderNb`
        );
      });
    }
  });

  describe("Gap 1 comble — logistique (calculerLogistiqueMensuelle), 21 mois", () => {
    const besoins = buildBesoinsAlimentsCalendrier(fixture, NB_MOIS);
    const logistique = buildLogistiqueCalendrier(fixture, besoins.sacsTotal, NB_MOIS);

    for (let i = 0; i < NB_MOIS; i++) {
      const moisLabel = fixture.mois[i];

      it(`mois ${i} (${moisLabel}) — voyagesAliments (tolerance 0)`, () => {
        expectEntierExact(logistique.voyagesAliments[i], fixture.logistique.voyagesAliments[i], `logistique.voyagesAliments[${moisLabel}]`);
      });
      it(`mois ${i} (${moisLabel}) — voyagesPoissons (tolerance 0)`, () => {
        expectEntierExact(logistique.voyagesPoissons[i], fixture.logistique.voyagesPoissons[i], `logistique.voyagesPoissons[${moisLabel}]`);
      });
      it(`mois ${i} (${moisLabel}) — voyagesAlevins (tolerance 0)`, () => {
        expectEntierExact(logistique.voyagesAlevins[i], fixture.logistique.voyagesAlevins[i], `logistique.voyagesAlevins[${moisLabel}]`);
      });
      it(`mois ${i} (${moisLabel}) — transportAlevins (tolerance <= 1 FCFA)`, () => {
        expectMontantFCFA(logistique.transportAlevinsFCFA[i], fixture.logistique.transportAlevins[i], `logistique.transportAlevins[${moisLabel}]`);
      });
      it(`mois ${i} (${moisLabel}) — sousTotal (tolerance <= 1 FCFA)`, () => {
        expectMontantFCFA(logistique.sousTotalFCFA[i], fixture.logistique.sousTotal[i], `logistique.sousTotal[${moisLabel}]`);
      });
    }
  });

  describe("Gap 2 comble — apportionnement mensuel du cout aliment (apportionnerCoutAlimentMensuel / calculerCoutAlimentGranulometrieParMois)", () => {
    const lignes = buildCoutAlimentsParVagueEtMois(fixture);

    describe("depenses.aliments[mois] — serie calendaire, 21 mois", () => {
      const depensesAliments = aggregerDepensesAlimentsParMoisCalendaire(lignes, NB_MOIS);
      for (let i = 0; i < NB_MOIS; i++) {
        const moisLabel = fixture.mois[i];
        it(`mois ${i} (${moisLabel}) — depenses.aliments (tolerance <= 1 FCFA)`, () => {
          expectMontantFCFA(depensesAliments[i], fixture.depenses.aliments[i], `depenses.aliments[${moisLabel}]`);
        });
      }
    });

    describe("planVagues[].coutAlimentsMois{1,2,3}FCFA — grain vague x moisCycle, 19 vagues", () => {
      const parVague = aggregerCoutAlimentsParVagueEtMoisCycle(lignes);
      for (const vague of fixture.entreesModele.planVagues) {
        it(`${vague.vague} — coutAlimentsMois1/2/3FCFA (tolerance <= 1 FCFA)`, () => {
          const obtenu = parVague.find((r) => r.vague === vague.vague)!;
          expectMontantFCFA(obtenu.mois1FCFA, vague.coutAlimentsMois1FCFA, `planVagues.${vague.vague}.coutAlimentsMois1FCFA`);
          expectMontantFCFA(obtenu.mois2FCFA, vague.coutAlimentsMois2FCFA, `planVagues.${vague.vague}.coutAlimentsMois2FCFA`);
          expectMontantFCFA(obtenu.mois3FCFA, vague.coutAlimentsMois3FCFA, `planVagues.${vague.vague}.coutAlimentsMois3FCFA`);
        });
      }
    });
  });

  describe("Chaine renforcee — baseRepartition, depensesTotales, resultat, tresorerie et point bas NEGATIF, 21 mois", () => {
    const besoins = buildBesoinsAlimentsCalendrier(fixture, NB_MOIS);
    const logistique = buildLogistiqueCalendrier(fixture, besoins.sacsTotal, NB_MOIS);
    const lignes = buildCoutAlimentsParVagueEtMois(fixture);
    const depensesAliments = aggregerDepensesAlimentsParMoisCalendaire(lignes, NB_MOIS);
    const chaine = buildChaineFinanciereCalendrier(fixture, logistique.sousTotalFCFA, depensesAliments, NB_MOIS);

    for (let i = 0; i < NB_MOIS; i++) {
      const moisLabel = fixture.mois[i];

      it(`mois ${i} (${moisLabel}) — baseRepartition (tolerance <= 1 FCFA)`, () => {
        expectMontantFCFA(chaine.baseRepartitionFCFA[i], fixture.depenses.baseRepartition[i], `depenses.baseRepartition[${moisLabel}]`);
      });
      it(`mois ${i} (${moisLabel}) — depensesTotales (tolerance <= 1 FCFA)`, () => {
        expectMontantFCFA(chaine.depensesTotalesFCFA[i], fixture.resultats.depensesTotales[i], `resultats.depensesTotales[${moisLabel}]`);
      });
      it(`mois ${i} (${moisLabel}) — resultat (tolerance <= 1 FCFA)`, () => {
        expectMontantFCFA(chaine.resultatFCFA[i], fixture.resultats.resultat[i], `resultats.resultat[${moisLabel}]`);
      });
      it(`mois ${i} (${moisLabel}) — epargne (tolerance <= 1 FCFA, story PR2q.2)`, () => {
        expectMontantFCFA(chaine.epargneFCFA[i], fixture.resultats.epargne[i], `resultats.epargne[${moisLabel}]`);
      });
      it(`mois ${i} (${moisLabel}) — tresorerie cumulee (tolerance <= 1 FCFA)`, () => {
        expectMontantFCFA(chaine.tresorerie[i].soldeFCFA, fixture.resultats.tresorerie[i], `resultats.tresorerie[${moisLabel}]`);
      });
    }

    it("cumuls.tresorerieFinale = solde du dernier mois", () => {
      expectMontantFCFA(chaine.tresorerie[NB_MOIS - 1].soldeFCFA, fixture.cumuls.tresorerieFinale, "cumuls.tresorerieFinale");
    });

    it("calculerPointBasTresorerie : point bas NEGATIF -6 334 704 en 2026-11 (mois 3) — seul scenario a l'exercer", () => {
      const pointBas = calculerPointBasTresorerie(chaine.tresorerie)!;
      expectMontantFCFA(pointBas.pointBasFCFA, fixture.cumuls.pointBasTresorerie, "cumuls.pointBasTresorerie");
      expect(fixture.mois[pointBas.moisAbsolu]).toBe(fixture.cumuls.moisPointBas);
      expect(pointBas.pointBasFCFA.lt(0)).toBe(true);
    });
  });
});
