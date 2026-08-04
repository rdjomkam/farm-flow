/**
 * Recette PR2non.3 — la base de repartition (logistique + charges
 * d'exploitation) rapprochee du jeu d'or DIRECTEMENT sur la sortie de
 * `calculerProjectionScenario` (route-orchestration.ts), au niveau mois par
 * mois, cumul de scenario, et effet par vague.
 *
 * Contexte (rapport-story-PR2non.1.md) : `route-orchestration.recette.test.ts`
 * exerce bien le code de production, mais n'avait AUCUNE assertion sur
 * `.logistique.sousTotalFCFA`, `.baseRepartitionFCFA` ou `.depensesFCFA`
 * comparee au jeu d'or — sa seule assertion qui les touchait (Section C,
 * `resultatFCFA == revenusFCFA + apportsFCFA - depensesFCFA`) est une
 * IDENTITE INTERNE, vraie que la logistique soit incluse ou non dans
 * `depensesFCFA` (elle compare deux grandeurs qui sortent toutes deux de la
 * MEME execution du code teste). C'est la raison structurelle pour laquelle
 * le bug de logistique (baseRepartitionFCFA n'incluait jamais la logistique,
 * PR2non.2) a traverse 8977 tests sans etre detecte.
 *
 * Ce fichier comble ce trou en deux temps :
 *   1. Section F — serie MENSUELLE (21 mois x 2 scenarios) sur
 *      `.logistique.sousTotalFCFA`, `.baseRepartitionFCFA`, `.depensesFCFA`,
 *      comparee directement aux blocs `logistique.sousTotal`,
 *      `depenses.baseRepartition`, `resultats.depensesTotales` du jeu d'or.
 *      C'est cela qui aurait attrape le bug (consigne explicite de la story).
 *   2. Section G — CUMULS de scenario (le tableau A/B de la story), et effet
 *      par VAGUE (`quotePartChargesFCFA`, `coutProductionFCFA`,
 *      `budget.totalCoutsProductionFCFA`/`budgetTotalFCFA`) — pas seulement
 *      le cumul mensuel.
 *
 * REGLE SACREE (identique aux autres fichiers `*.recette.test.ts`) : aucune
 * valeur ATTENDUE n'est recalculee par une reimplementation de la formule de
 * production dans ce fichier. Les valeurs attendues viennent :
 *   - du JSON du jeu d'or (`fixture.logistique`, `fixture.depenses`,
 *     `fixture.resultats`, `fixture.cumuls`), ou
 *   - des CONSTANTES fournies par la story (tableau A/B, chiffres V1), qui
 *     ont ete revérifiées independamment (script Python hors moteur, hors
 *     ce fichier) avant d'etre encodees ici en dur — voir rapport-story-
 *     PR2non.3.md pour le detail de cette re-verification.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "../../decimal-config";
import { calculerProjectionScenario } from "../../route-orchestration";
import { loadGoldenFixture, expectMontantFCFA, type GoldenFixture } from "./helpers";
import { buildScenarioPourCalculDepuisFixture } from "./route-orchestration-builder";

/**
 * Section F — serie mensuelle, logistique / base de repartition / depenses.
 *
 * Angle mort exact identifie par rapport-story-PR2non.1.md : c'est cette
 * section qui aurait detecte le bug de logistique (voir la campagne de
 * falsification decrite dans rapport-story-PR2non.3.md).
 */
function runSectionF(fixture: GoldenFixture, label: string) {
  describe(`Section F — logistique/baseRepartition/depenses au niveau mois[] (${label}), story PR2non.3`, () => {
    const scenario = buildScenarioPourCalculDepuisFixture(fixture);
    const resultat = calculerProjectionScenario(scenario);
    const nbMoisCompares = Math.min(resultat.mois.length, fixture.mois.length);

    it(`${label} — calculerProjectionScenario couvre bien les 21 mois de la fixture`, () => {
      expect(nbMoisCompares).toBe(fixture.mois.length);
      expect(nbMoisCompares).toBe(21);
    });

    for (let m = 0; m < nbMoisCompares; m++) {
      const moisCourant = resultat.mois[m];
      const libelleMois = fixture.mois[m];

      it(`${label} — mois ${libelleMois} — logistique.sousTotalFCFA == logistique.sousTotal du jeu d'or`, () => {
        expectMontantFCFA(
          moisCourant.logistique.sousTotalFCFA,
          fixture.logistique.sousTotal[m],
          `${label}.mois[${libelleMois}].logistique.sousTotalFCFA`
        );
      });

      it(`${label} — mois ${libelleMois} — baseRepartitionFCFA == depenses.baseRepartition du jeu d'or (== logistique + chargesExploitation)`, () => {
        expectMontantFCFA(
          moisCourant.baseRepartitionFCFA,
          fixture.depenses.baseRepartition[m],
          `${label}.mois[${libelleMois}].baseRepartitionFCFA`
        );
      });

      it(`${label} — mois ${libelleMois} — depensesFCFA == resultats.depensesTotales du jeu d'or`, () => {
        expectMontantFCFA(
          moisCourant.depensesFCFA,
          fixture.resultats.depensesTotales[m],
          `${label}.mois[${libelleMois}].depensesFCFA`
        );
      });

      it(`${label} — mois ${libelleMois} — baseRepartitionFCFA == logistique.sousTotalFCFA + Σ chargesExploitation du mois (identite ADR-053 §5.5, sur la sortie REELLE du moteur)`, () => {
        const chargesExpDuMois = fixture.entreesModele.chargesExploitation.reduce(
          (sum, poste) => sum.plus(poste.valeursParMoisFCFA[m]),
          new Decimal(0)
        );
        const attendu = moisCourant.logistique.sousTotalFCFA.plus(chargesExpDuMois);
        const ecart = moisCourant.baseRepartitionFCFA.minus(attendu).abs();
        expect(ecart.lte(1)).toBe(true);
      });
    }
  });
}

/**
 * Section G — cumuls de scenario (tableau A/B de la story) + effet par
 * vague. Les cumuls sont obtenus en sommant les series MENSUELLES deja
 * presentes dans le jeu d'or (agregation, pas une reimplementation de
 * formule) — memes valeurs que `fixture.cumuls` quand ce bloc les porte
 * deja, ou une somme directe d'un bloc de sortie du jeu d'or sinon
 * (`logistique.sousTotal`, `depenses.chargesExploitation`,
 * `depenses.alevins`) — jamais une valeur inventee.
 */
function runSectionG(fixture: GoldenFixture, label: string, attendu: {
  tonnageVenduT: number;
  chiffreAffairesFCFA: number;
  coutAlimentsFCFA: number;
  coutAlevinsFCFA: number;
  chargesExploitationFCFA: number;
  logistiqueFCFA: number;
  apportsFCFA: number;
  investissementsFCFA: number;
  depensesTotalesFCFA: number;
  resultatCumuleFCFA: number;
  tresorerieFinaleFCFA: number;
  pointBasFCFA: number;
  moisPointBas: string;
  besoinMensuelMaxKg: number;
}) {
  describe(`Section G — cumuls de scenario (${label}), story PR2non.3`, () => {
    const scenario = buildScenarioPourCalculDepuisFixture(fixture);
    const resultat = calculerProjectionScenario(scenario);

    // Les constantes `attendu.*` sont celles de la story (tableau A/B),
    // reverifiees ici comme non-regression contre les blocs de sortie du
    // jeu d'or (agregation par somme, jamais une formule reimplementee).
    it(`${label} — les constantes de la story correspondent bien aux blocs de sortie du jeu d'or (garde-fou anti-faute-de-frappe)`, () => {
      expect(fixture.cumuls.tonnageVendu).toBe(attendu.tonnageVenduT);
      expect(fixture.cumuls.chiffreAffaires).toBe(attendu.chiffreAffairesFCFA);
      expect(fixture.cumuls.dontAliments).toBe(attendu.coutAlimentsFCFA);
      expect(fixture.cumuls.apportsCapital).toBe(attendu.apportsFCFA);
      expect(fixture.cumuls.dontInvestissements).toBe(attendu.investissementsFCFA);
      expect(fixture.cumuls.depensesTotales).toBe(attendu.depensesTotalesFCFA);
      expect(fixture.cumuls.resultatCumule).toBe(attendu.resultatCumuleFCFA);
      expect(fixture.cumuls.tresorerieFinale).toBe(attendu.tresorerieFinaleFCFA);
      expect(Math.abs(fixture.cumuls.pointBasTresorerie - attendu.pointBasFCFA)).toBeLessThanOrEqual(1);
      expect(fixture.cumuls.moisPointBas).toBe(attendu.moisPointBas);
      expect(fixture.cumuls.besoinMensuelMaxKg).toBe(attendu.besoinMensuelMaxKg);
      const sommeAlevins = fixture.depenses.alevins.reduce((s, v) => s + v, 0);
      const sommeChargesExp = fixture.depenses.chargesExploitation.reduce((s, v) => s + v, 0);
      const sommeLogistique = fixture.logistique.sousTotal.reduce((s, v) => s + v, 0);
      expect(sommeAlevins).toBe(attendu.coutAlevinsFCFA);
      expect(sommeChargesExp).toBe(attendu.chargesExploitationFCFA);
      expect(sommeLogistique).toBe(attendu.logistiqueFCFA);
    });

    it(`${label} — Σ coutAlimentFCFA (toutes vagues) == cumuls.dontAliments`, () => {
      const somme = resultat.vagues.reduce((s, v) => s.plus(v.coutAlimentFCFA), new Decimal(0));
      expectMontantFCFA(somme, attendu.coutAlimentsFCFA, `${label}.sommeCoutAlimentFCFA`);
    });

    it(`${label} — Σ coutAlevinsFCFA (toutes vagues) == cumuls dérivés (0 sur alevinsAchetes=NON)`, () => {
      const somme = resultat.vagues.reduce((s, v) => s.plus(v.coutAlevinsFCFA), new Decimal(0));
      expectMontantFCFA(somme, attendu.coutAlevinsFCFA, `${label}.sommeCoutAlevinsFCFA`);
    });

    it(`${label} — Σ logistique.sousTotalFCFA (tous les mois) == cumul dérivé du jeu d'or`, () => {
      const somme = resultat.mois.reduce((s, m) => s.plus(m.logistique.sousTotalFCFA), new Decimal(0));
      expectMontantFCFA(somme, attendu.logistiqueFCFA, `${label}.sommeLogistiqueFCFA`);
    });

    it(`${label} — Σ baseRepartitionFCFA (tous les mois) == logistique + charges d'exploitation cumulées`, () => {
      const somme = resultat.mois.reduce((s, m) => s.plus(m.baseRepartitionFCFA), new Decimal(0));
      expectMontantFCFA(
        somme,
        attendu.logistiqueFCFA + attendu.chargesExploitationFCFA,
        `${label}.sommeBaseRepartitionFCFA`
      );
    });

    it(`${label} — Σ investissementsFCFA (tous les mois) == cumuls.dontInvestissements`, () => {
      const somme = resultat.mois.reduce((s, m) => s.plus(m.investissementsFCFA), new Decimal(0));
      expectMontantFCFA(somme, attendu.investissementsFCFA, `${label}.sommeInvestissementsFCFA`);
    });

    it(`${label} — Σ apportsFCFA (tous les mois) == cumuls.apportsCapital`, () => {
      const somme = resultat.mois.reduce((s, m) => s.plus(m.apportsFCFA), new Decimal(0));
      expectMontantFCFA(somme, attendu.apportsFCFA, `${label}.sommeApportsFCFA`);
    });

    it(`${label} — Σ depensesFCFA (tous les mois) == cumuls.depensesTotales — LE CUMUL CLE DE LA STORY`, () => {
      const somme = resultat.mois.reduce((s, m) => s.plus(m.depensesFCFA), new Decimal(0));
      expectMontantFCFA(somme, attendu.depensesTotalesFCFA, `${label}.sommeDepensesFCFA`);
    });

    it(`${label} — Σ resultatFCFA (tous les mois) == cumuls.resultatCumule`, () => {
      const somme = resultat.mois.reduce((s, m) => s.plus(m.resultatFCFA), new Decimal(0));
      expectMontantFCFA(somme, attendu.resultatCumuleFCFA, `${label}.sommeResultatFCFA`);
    });

    it(`${label} — soldeFCFA du dernier mois == cumuls.tresorerieFinale`, () => {
      const dernier = resultat.mois[resultat.mois.length - 1];
      expectMontantFCFA(dernier.soldeFCFA, attendu.tresorerieFinaleFCFA, `${label}.tresorerieFinale`);
    });

    it(`${label} — pointBas n'est jamais null (horizon non vide)`, () => {
      expect(resultat.pointBas).not.toBeNull();
    });

    it(`${label} — pointBas.pointBasFCFA == cumuls.pointBasTresorerie`, () => {
      expectMontantFCFA(resultat.pointBas!.pointBasFCFA, attendu.pointBasFCFA, `${label}.pointBas.pointBasFCFA`);
    });

    it(`${label} — pointBas.moisAbsolu correspond au mois du jeu d'or (${attendu.moisPointBas})`, () => {
      const idxAttendu = fixture.mois.indexOf(attendu.moisPointBas);
      expect(resultat.pointBas!.moisAbsolu).toBe(idxAttendu);
    });

    it(`${label} — besoin mensuel max en aliments (max de besoinAlimentsTotalKg sur l'horizon) == cumuls.besoinMensuelMaxKg`, () => {
      const maxKg = resultat.mois.reduce(
        (max, m) => Decimal.max(max, m.besoinAlimentsTotalKg),
        new Decimal(0)
      );
      const ecart = maxKg.minus(attendu.besoinMensuelMaxKg).abs();
      expect(ecart.lte(1e-6)).toBe(true);
    });

    // --- Effet par vague (pas seulement le cumul mensuel) --------------
    it(`${label} — Σ quotePartChargesFCFA (toutes vagues) == Σ baseRepartitionFCFA (tous les mois) — pas de fuite (toutes les 19 vagues des deux fixtures couvrent les 21 mois, cf. rapport)`, () => {
      const sommeQuotePart = resultat.vagues.reduce((s, v) => s.plus(v.quotePartChargesFCFA), new Decimal(0));
      const sommeBaseRepartition = resultat.mois.reduce((s, m) => s.plus(m.baseRepartitionFCFA), new Decimal(0));
      const ecart = sommeQuotePart.minus(sommeBaseRepartition).abs();
      expect(ecart.lte(1)).toBe(true);
    });

    it(`${label} — budget.totalCoutsProductionFCFA == Σ coutAlimentFCFA + Σ coutAlevinsFCFA + Σ baseRepartitionFCFA (identite structurelle, cf. budget.ts)`, () => {
      const sommeAliment = resultat.vagues.reduce((s, v) => s.plus(v.coutAlimentFCFA), new Decimal(0));
      const sommeAlevins = resultat.vagues.reduce((s, v) => s.plus(v.coutAlevinsFCFA), new Decimal(0));
      const sommeBaseRepartition = resultat.mois.reduce((s, m) => s.plus(m.baseRepartitionFCFA), new Decimal(0));
      const attenduTotal = sommeAliment.plus(sommeAlevins).plus(sommeBaseRepartition);
      const ecart = resultat.budget.totalCoutsProductionFCFA.minus(attenduTotal).abs();
      expect(ecart.lte(1)).toBe(true);
    });

    it(`${label} — budget.totalCoutsProductionFCFA == dépenses totales − investissements (dérivé du jeu d'or, sans fuite de repartition)`, () => {
      // budgetTotalFCFA n'inclut JAMAIS les investissements (budget.ts,
      // calculerBudgetTotalPlan : chargesHorsProduction toujours [] cote
      // route-orchestration.ts) ni les apports (informatifs). Attendu ==
      // depensesTotalesFCFA - investissementsFCFA du jeu d'or — verifie vrai
      // pour A et B (308 159 600 dans les deux cas), CONDITIONNE par
      // l'absence de fuite verifiee ci-dessus (aucun mois a 0 vague active).
      const attenduBudget = attendu.depensesTotalesFCFA - attendu.investissementsFCFA;
      expectMontantFCFA(resultat.budget.totalCoutsProductionFCFA, attenduBudget, `${label}.budget.totalCoutsProductionFCFA`);
      expectMontantFCFA(resultat.budget.budgetTotalFCFA, attenduBudget, `${label}.budget.budgetTotalFCFA`);
    });

    it(`${label} — budget.totalApportsFCFA == cumuls.apportsCapital`, () => {
      expectMontantFCFA(resultat.budget.totalApportsFCFA, attendu.apportsFCFA, `${label}.budget.totalApportsFCFA`);
    });
  });
}

/**
 * V1 (vague #1 de la fixture plan-v12-corrige) — `quotePartChargesFCFA` et
 * `coutProductionFCFA` AVANT/APRES le correctif PR2non.2, mentionnes par la
 * story. AUCUNE colonne du classeur ne porte cette grandeur par vague (verifie :
 * `entreesModele.planVagues[].` ne contient aucune cle `quotePart`/
 * `coutProduction`, recherche exhaustive dans les deux fixtures JSON) — ces
 * deux nombres ne sont donc PAS un jeu d'or au sens strict de l'ADR-053 §7.
 *
 * Ils sont neanmoins verifiables INDEPENDAMMENT du code de production, par
 * une derivation arithmetique simple a partir de grandeurs qui, elles, SONT
 * dans le jeu d'or (`depenses.baseRepartition[m]` divise par le nombre de
 * vagues actives ce mois-la, somme sur les 3 mois de cycle de V1) — cette
 * derivation a ete effectuee HORS de ce fichier (script Python, documente
 * dans rapport-story-PR2non.3.md) et a confirme EXACTEMENT les deux
 * constantes de la story : 1 961 666,67 et 6 825 666,67 FCFA.
 *
 * Consigne de la story explicitement respectee : "sinon dis explicitement
 * qu'elles ne sont couvertes que par cohérence interne et pourquoi" — ce
 * test compare V1 aux CONSTANTES fournies par la story (autorisees par la
 * consigne comme source de valeur attendue), PAS a une reimplementation de
 * `calculerQuotePartVague` dans ce fichier.
 */
function runV1QuotePartEtCoutProduction() {
  describe("V1 — quotePartChargesFCFA / coutProductionFCFA (plan-v12-corrige), story PR2non.3", () => {
    const fixture = loadGoldenFixture("plan-v12-corrige.json");
    const scenario = buildScenarioPourCalculDepuisFixture(fixture);
    const resultat = calculerProjectionScenario(scenario);
    const v1 = resultat.vagues.find((v) => v.code === "V1")!;

    it("V1.quotePartChargesFCFA == 1 961 666,67 FCFA (constante story PR2non.3, tolérance <= 1 FCFA)", () => {
      expectMontantFCFA(v1.quotePartChargesFCFA, 1961666.6666666667, "V1.quotePartChargesFCFA");
    });

    it("V1.coutProductionFCFA == 6 825 666,67 FCFA (constante story PR2non.3, tolérance <= 1 FCFA)", () => {
      expectMontantFCFA(v1.coutProductionFCFA, 6825666.666666667, "V1.coutProductionFCFA");
    });

    it("V1.coutProductionFCFA == coutAlimentFCFA + coutAlevinsFCFA + quotePartChargesFCFA (identité structurelle, cf. vague.ts::calculerCoutProductionVague)", () => {
      const attendu = v1.coutAlimentFCFA.plus(v1.coutAlevinsFCFA).plus(v1.quotePartChargesFCFA);
      const ecart = v1.coutProductionFCFA.minus(attendu).abs();
      expect(ecart.lte(1)).toBe(true);
    });
  });
}

describe("Recette PR2non.3 — base de repartition (logistique + charges d'exploitation) au niveau calculerProjectionScenario", () => {
  runSectionF(loadGoldenFixture("plan-v12-corrige.json"), "plan-v12-corrige (scenario A)");
  runSectionF(loadGoldenFixture("annexe-b-corrigee.json"), "annexe-b-corrigee (scenario B)");

  runSectionG(loadGoldenFixture("plan-v12-corrige.json"), "plan-v12-corrige (scenario A)", {
    tonnageVenduT: 241,
    chiffreAffairesFCFA: 457_900_000,
    coutAlimentsFCFA: 277_369_600,
    coutAlevinsFCFA: 0,
    chargesExploitationFCFA: 20_580_000,
    logistiqueFCFA: 10_210_000,
    apportsFCFA: 30_000_000,
    investissementsFCFA: 34_400_000,
    depensesTotalesFCFA: 342_559_600,
    resultatCumuleFCFA: 145_340_400,
    tresorerieFinaleFCFA: 145_340_400,
    pointBasFCFA: 2_276_600,
    moisPointBas: "2026-08",
    besoinMensuelMaxKg: 17_100,
  });

  runSectionG(loadGoldenFixture("annexe-b-corrigee.json"), "annexe-b-corrigee (scenario B)", {
    tonnageVenduT: 241,
    chiffreAffairesFCFA: 457_900_000,
    coutAlimentsFCFA: 277_369_600,
    coutAlevinsFCFA: 0,
    chargesExploitationFCFA: 20_580_000,
    logistiqueFCFA: 10_210_000,
    apportsFCFA: 0,
    investissementsFCFA: 0,
    depensesTotalesFCFA: 308_159_600,
    resultatCumuleFCFA: 149_740_400,
    tresorerieFinaleFCFA: 149_740_400,
    pointBasFCFA: -6_334_704,
    moisPointBas: "2026-11",
    besoinMensuelMaxKg: 17_100,
  });

  runV1QuotePartEtCoutProduction();
});
