/**
 * Recette PR1.4 — scenario A : plan-v12-corrige.json.
 *
 * 19 vagues, aout 2026 -> avril 2028 (21 mois), avec apports en capital et
 * investissements. Tresorerie toujours positive, point bas +2 276 600 en
 * 2026-08 (mois 0).
 *
 * Comparaison LIGNE A LIGNE sur les 21 mois (pas seulement les cumuls), au
 * plus pres de ce que le moteur (src/lib/previsions/) sait reellement
 * produire — voir docs/tests/rapport-story-PR1.4.md pour la liste exacte
 * des series couvertes / non couvertes et pourquoi.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../../decimal-config";
import { calculerPointBasTresorerie } from "../../tresorerie";
import { loadGoldenFixture, expectEntierExact, expectMontantFCFA, expectKgApprox } from "./helpers";
import {
  buildBesoinsAlimentsCalendrier,
  buildCoutAlimentsParVague,
  buildLogistiqueCalendrier,
  buildCoutAlimentsParVagueEtMois,
  aggregerDepensesAlimentsParMoisCalendaire,
  aggregerCoutAlimentsParVagueEtMoisCycle,
  buildChaineFinanciereCalendrier,
} from "./orchestration";

const fixture = loadGoldenFixture("plan-v12-corrige.json");
const NB_MOIS = fixture.mois.length;

describe("Recette PR1.4 — plan-v12-corrige.json (scenario A)", () => {
  it("jeu d'or : 21 mois, 19 vagues (verification de forme, pas une valeur metier)", () => {
    expect(NB_MOIS).toBe(21);
    expect(fixture.entreesModele.planVagues).toHaveLength(19);
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

  describe("Gap 1 comble — logistique (calculerLogistiqueMensuelle), 21 mois", () => {
    // quantiteAlimentsSacs vient du moteur (sacsTotal calcule, PAS du jeu
    // d'or) — voir orchestration.ts, buildLogistiqueCalendrier.
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

  describe("Chaine renforcee — baseRepartition, depensesTotales, resultat, tresorerie et point bas, 21 mois", () => {
    // Aucune de ces series n'est plus lue depuis le jeu d'or comme entree :
    // sousTotal (Gap 1) et depenses.aliments (Gap 2) sont les sorties
    // deja verifiees ci-dessus, produites par le moteur reel — voir
    // orchestration.ts (buildChaineFinanciereCalendrier) pour le detail
    // exhaustif des entrees qui restent necessairement des donnees du jeu
    // d'or (chiffreAffaires, apportsCapital, investissements, ventesT).
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
      it(`mois ${i} (${moisLabel}) — tresorerie cumulee (tolerance <= 1 FCFA)`, () => {
        expectMontantFCFA(chaine.tresorerie[i].soldeFCFA, fixture.resultats.tresorerie[i], `resultats.tresorerie[${moisLabel}]`);
      });
    }

    it("cumuls.tresorerieFinale = solde du dernier mois", () => {
      expectMontantFCFA(chaine.tresorerie[NB_MOIS - 1].soldeFCFA, fixture.cumuls.tresorerieFinale, "cumuls.tresorerieFinale");
    });

    it("calculerPointBasTresorerie : point bas +2 276 600 en 2026-08 (mois 0) — cas nominal non negatif", () => {
      const pointBas = calculerPointBasTresorerie(chaine.tresorerie)!;
      expectMontantFCFA(pointBas.pointBasFCFA, fixture.cumuls.pointBasTresorerie, "cumuls.pointBasTresorerie");
      expect(fixture.mois[pointBas.moisAbsolu]).toBe(fixture.cumuls.moisPointBas);
      expect(pointBas.pointBasFCFA.gte(0)).toBe(true);
    });
  });
});
