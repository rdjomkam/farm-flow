/**
 * Test PUR (aucune I/O, aucune DB) — `previsions-mapping-orphelins.ts`
 * (Sprint PR3-ter, story A.1) et le format compose `cibleId` ALIMENT_PREVISION
 * (story A.3, `previsions-rapprochement.ts`).
 *
 * Reproduit le defaut EXACT prouve par la pre-analyse : un mapping cree
 * contre un scenario A puis lu depuis un scenario B accumule le montant reel
 * sous une cle morte, invisible dans RAPPROCHE/NON_RAPPROCHE/
 * SANS_SOURCE_REELLE (`src/lib/previsions/rapprochement.ts:310-322/343-344`).
 * Ce test prouve que la detection (A.1) et la resolution dynamique (A.3)
 * couvrent ce cas — jamais en reimplementant la logique testee (ERR-171),
 * uniquement en appelant le code de production.
 */
import { describe, it, expect } from "vitest";
import { Decimal } from "@/lib/previsions/decimal-config";
import {
  TailleGranule,
  CibleRapprochement,
  SourceRapprochement,
  StatutScenarioPrevision,
  TypePostePrevision,
} from "@/types";
import type { ScenarioPourCalcul } from "@/lib/queries/previsions-scenario-loader";
import {
  composeCibleAlimentPrevision,
  parseCibleAlimentPrevision,
} from "@/lib/queries/previsions-rapprochement";
import {
  construireClesCiblesValidesDuScenario,
  resoudreCibleCleDuScenarioCourant,
  detecterCiblesOrphelines,
  type LigneMappingPourDetectionOrpheline,
} from "@/lib/queries/previsions-mapping-orphelins";

const transportZero = { capacite: new Decimal(1), coutUnitaireFCFA: new Decimal(0) };

function scenarioFactice(overrides: Partial<ScenarioPourCalcul> = {}): ScenarioPourCalcul {
  return {
    id: "scenario-x",
    code: "SCN-X",
    nom: "Scenario factice",
    dureeCycleMois: 3,
    dateDebutPlan: new Date("2026-01-01"),
    statut: StatutScenarioPrevision.BROUILLON,
    parametres: {
      effectifAlevinsParVague: 1000,
      margeSecuriteAlevinsPct: new Decimal(5),
      tauxEpargnePct: new Decimal(0),
      poidsMoyenInitialG: new Decimal(5),
      poidsObjectifG: new Decimal(800),
      prixAlevinUnitaireFCFA: new Decimal(50),
      prixVenteKgFCFA: new Decimal(2000),
      nombreBacsSimultanesCible: 2,
      frequenceStockageMois: new Decimal(1),
      transportAliments: transportZero,
      transportPoissons: transportZero,
      transportAlevins: transportZero,
      tresorerieInitialeFCFA: new Decimal(0),
    },
    paliersRemise: [],
    aliments: [],
    vaguesPrevues: [],
    postes: [],
    journal: [],
    apports: [],
    ...overrides,
  };
}

function ligneMapping(
  overrides: Partial<LigneMappingPourDetectionOrpheline> = {}
): LigneMappingPourDetectionOrpheline {
  return {
    id: "map-1",
    sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
    sourceCle: "ALIMENT",
    cibleType: CibleRapprochement.POSTE_PREVISION,
    cibleId: null,
    ...overrides,
  };
}

describe("A.3 — composeCibleAlimentPrevision / parseCibleAlimentPrevision (format compose)", () => {
  it("compose puis decompose retourne exactement la tailleGranule et l'id d'origine", () => {
    const cibleId = composeCibleAlimentPrevision(TailleGranule.G1, "aliment-scenario-a-id");
    expect(cibleId).toBe("G1::aliment-scenario-a-id");

    const parsed = parseCibleAlimentPrevision(cibleId);
    expect(parsed.tailleGranule).toBe(TailleGranule.G1);
    expect(parsed.alimentPrevisionIdOrigine).toBe("aliment-scenario-a-id");
  });

  it("cibleId null retourne tailleGranule et idOrigine null (jamais une exception)", () => {
    expect(parseCibleAlimentPrevision(null)).toEqual({
      tailleGranule: null,
      alimentPrevisionIdOrigine: null,
    });
  });

  it("un cibleId au format PRE-A.3 (id brut, sans separateur) ne resout AUCUNE tailleGranule — format rejete, pas silencieusement accepte", () => {
    const parsed = parseCibleAlimentPrevision("aliment-id-brut-sans-format");
    expect(parsed.tailleGranule).toBeNull();
  });

  it("une tailleGranule inconnue dans le cibleId compose ne resout rien (jamais un cast silencieux)", () => {
    const parsed = parseCibleAlimentPrevision("PAS_UNE_TAILLE::abc123");
    expect(parsed.tailleGranule).toBeNull();
    expect(parsed.alimentPrevisionIdOrigine).toBe("abc123");
  });
});

describe("A.3 — resoudreCibleCleDuScenarioCourant : resolution DYNAMIQUE par tailleGranule (jamais par id fige)", () => {
  it("ALIMENT_PREVISION : resout vers l'AlimentPrevision.id du scenario COURANT, PAS l'id d'origine porte par cibleId", () => {
    const scenarioB = scenarioFactice({
      id: "scenario-b",
      aliments: [
        {
          id: "aliment-scenario-b-id",
          tailleGranule: TailleGranule.G1,
          sacsParTonneStandard: new Decimal(2),
          ordre: 0,
          repartitions: [],
          articles: [],
        },
      ],
    });

    // Le mapping porte l'id de l'AlimentPrevision du scenario A (autre scenario).
    const mapping = ligneMapping({
      cibleType: CibleRapprochement.ALIMENT_PREVISION,
      cibleId: composeCibleAlimentPrevision(TailleGranule.G1, "aliment-scenario-a-id"),
    });

    const cibleResolue = resoudreCibleCleDuScenarioCourant(mapping, scenarioB);

    // Preuve du coeur de la story A.3 : la cle resolue est celle du scenario
    // COURANT (B), jamais celle figee dans cibleId (A).
    expect(cibleResolue).toBe("aliment-scenario-b-id");
    expect(cibleResolue).not.toBe("aliment-scenario-a-id");
  });

  it("ALIMENT_PREVISION : si le scenario courant n'a AUCUN AlimentPrevision pour cette tailleGranule, la resolution echoue explicitement (null, jamais un id invente)", () => {
    const scenarioSansG1 = scenarioFactice({ aliments: [] });
    const mapping = ligneMapping({
      cibleType: CibleRapprochement.ALIMENT_PREVISION,
      cibleId: composeCibleAlimentPrevision(TailleGranule.G1, "aliment-x"),
    });

    expect(resoudreCibleCleDuScenarioCourant(mapping, scenarioSansG1)).toBeNull();
  });

  it("POSTE_PREVISION : resolution DYNAMIQUE par posteReferentielId (A.4) — retourne le PostePrevision.id du scenario COURANT, jamais le cibleId (PosteReferentiel.id) litteral", () => {
    const scenario = scenarioFactice({
      postes: [
        {
          id: "poste-scenario-courant",
          libelle: "Salaires",
          type: TypePostePrevision.CHARGE_EXPLOITATION,
          inclusBaseRepartition: true,
          ordre: 0,
          actif: true,
          chargesMensuelles: [],
          posteReferentielId: "referentiel-salaires",
        },
      ],
    });
    const mapping = ligneMapping({
      cibleType: CibleRapprochement.POSTE_PREVISION,
      cibleId: "referentiel-salaires",
    });

    const cibleResolue = resoudreCibleCleDuScenarioCourant(mapping, scenario);

    // Preuve du coeur de la story A.4, symetrique d'A.3 : la cle resolue
    // est le PostePrevision.id du scenario COURANT, jamais le
    // PosteReferentiel.id litteral porte par cibleId.
    expect(cibleResolue).toBe("poste-scenario-courant");
    expect(cibleResolue).not.toBe("referentiel-salaires");
  });

  it("POSTE_PREVISION : si aucun PostePrevision du scenario courant n'est lie a cette entree referentiel, la resolution echoue explicitement (null, jamais un id invente)", () => {
    const scenarioSansCePoste = scenarioFactice({
      postes: [
        {
          id: "poste-autre",
          libelle: "Electricite",
          type: TypePostePrevision.CHARGE_EXPLOITATION,
          inclusBaseRepartition: true,
          ordre: 0,
          actif: true,
          chargesMensuelles: [],
          posteReferentielId: "referentiel-electricite",
        },
      ],
    });
    const mapping = ligneMapping({
      cibleType: CibleRapprochement.POSTE_PREVISION,
      cibleId: "referentiel-salaires",
    });

    expect(resoudreCibleCleDuScenarioCourant(mapping, scenarioSansCePoste)).toBeNull();
  });

  it("POSTE_PREVISION : PORTABILITE INTER-SCENARIOS — un meme posteReferentielId resout vers DEUX PostePrevision.id distincts selon le scenario courant (c'est la propriete que la story A.4 achete)", () => {
    const posteScenarioA = {
      id: "poste-scenario-a",
      libelle: "Salaires",
      type: TypePostePrevision.CHARGE_EXPLOITATION,
      inclusBaseRepartition: true,
      ordre: 0,
      actif: true,
      chargesMensuelles: [],
      posteReferentielId: "referentiel-salaires",
    };
    const posteScenarioB = {
      id: "poste-scenario-b",
      libelle: "Salaires (libelle renomme dans B)",
      type: TypePostePrevision.CHARGE_EXPLOITATION,
      inclusBaseRepartition: true,
      ordre: 0,
      actif: true,
      chargesMensuelles: [],
      posteReferentielId: "referentiel-salaires",
    };
    const mapping = ligneMapping({
      cibleType: CibleRapprochement.POSTE_PREVISION,
      cibleId: "referentiel-salaires",
    });

    const scenarioA = scenarioFactice({ id: "scenario-a", postes: [posteScenarioA] });
    const scenarioB = scenarioFactice({ id: "scenario-b", postes: [posteScenarioB] });

    expect(resoudreCibleCleDuScenarioCourant(mapping, scenarioA)).toBe("poste-scenario-a");
    expect(resoudreCibleCleDuScenarioCourant(mapping, scenarioB)).toBe("poste-scenario-b");
  });

  it("VENTE_PREVUE / NON_RAPPROCHE : aucune cible a resoudre, toujours null", () => {
    const scenario = scenarioFactice();
    expect(
      resoudreCibleCleDuScenarioCourant(
        ligneMapping({ cibleType: CibleRapprochement.VENTE_PREVUE, cibleId: null }),
        scenario
      )
    ).toBeNull();
    expect(
      resoudreCibleCleDuScenarioCourant(
        ligneMapping({ cibleType: CibleRapprochement.NON_RAPPROCHE, cibleId: null }),
        scenario
      )
    ).toBeNull();
  });
});

describe("A.1 — construireClesCiblesValidesDuScenario : miroir des cle produites par le prevu", () => {
  it("contient les postes, les aliments, les cles ventes/apport fixes — rien de plus, rien de moins", () => {
    const scenario = scenarioFactice({
      postes: [
        { id: "poste-1", libelle: "Salaires", type: TypePostePrevision.CHARGE_EXPLOITATION, inclusBaseRepartition: true, ordre: 0, actif: true, chargesMensuelles: [], posteReferentielId: "referentiel-salaires" },
      ],
      aliments: [
        { id: "aliment-1", tailleGranule: TailleGranule.G1, sacsParTonneStandard: null, ordre: 0, repartitions: [], articles: [] },
      ],
    });

    const cles = construireClesCiblesValidesDuScenario(scenario);

    expect(cles.has("poste-1")).toBe(true);
    expect(cles.has("aliment-1")).toBe(true);
    expect(cles.has("VENTE_PREVUE:MONTANT")).toBe(true);
    expect(cles.has("VENTE_PREVUE:TONNAGE")).toBe(true);
    expect(cles.has("APPORT_CAPITAL")).toBe(true);
    expect(cles.size).toBe(5);
  });
});

describe("A.1 — detecterCiblesOrphelines : le filet de securite non negociable", () => {
  it("A.4 CORRIGE LE DEFAUT DE LA PRE-ANALYSE : un mapping POSTE_PREVISION dont le cibleId (PosteReferentiel.id) ne correspond a AUCUN PostePrevision du scenario B est signale ORPHELIN — jamais confondu avec NON_RAPPROCHE", () => {
    const scenarioB = scenarioFactice({
      id: "scenario-b",
      postes: [
        { id: "poste-scenario-b", libelle: "Electricite", type: TypePostePrevision.CHARGE_EXPLOITATION, inclusBaseRepartition: true, ordre: 0, actif: true, chargesMensuelles: [], posteReferentielId: "referentiel-electricite" },
      ],
    });

    const mapping = [
      ligneMapping({
        id: "map-poste-etranger",
        cibleType: CibleRapprochement.POSTE_PREVISION,
        cibleId: "referentiel-inexistant", // aucun PostePrevision de scenarioB n'a ce posteReferentielId
      }),
    ];

    const resultat = detecterCiblesOrphelines(mapping, scenarioB);

    expect(resultat).toHaveLength(1);
    expect(resultat[0].cibleOrpheline).toBe(true);
    expect(resultat[0].cibleCleResolue).toBeNull();
  });

  it("PORTABILITE INTER-SCENARIOS (le coeur de la story A.4) : un mapping cree contre le scenario A (cibleId = posteReferentielId) resout et n'est JAMAIS orphelin sous le scenario B qui partage la meme entree referentiel", () => {
    const mapping = [
      ligneMapping({
        id: "map-poste-partage",
        cibleType: CibleRapprochement.POSTE_PREVISION,
        cibleId: "referentiel-salaires", // PosteReferentiel.id, site-scope
      }),
    ];

    const scenarioA = scenarioFactice({
      id: "scenario-a",
      postes: [
        { id: "poste-id-dans-a", libelle: "Salaires", type: TypePostePrevision.CHARGE_EXPLOITATION, inclusBaseRepartition: true, ordre: 0, actif: true, chargesMensuelles: [], posteReferentielId: "referentiel-salaires" },
      ],
    });
    const scenarioB = scenarioFactice({
      id: "scenario-b",
      postes: [
        // PostePrevision.id DIFFERENT de celui du scenario A, mais MEME
        // posteReferentielId (get-or-create, §16.11) — c'est exactement la
        // propriete que la story achete : le mapping suit l'entree
        // referentiel, jamais l'id scenario-scope figé au moment de la
        // creation du mapping.
        { id: "poste-id-dans-b", libelle: "Salaires", type: TypePostePrevision.CHARGE_EXPLOITATION, inclusBaseRepartition: true, ordre: 0, actif: true, chargesMensuelles: [], posteReferentielId: "referentiel-salaires" },
      ],
    });

    const resultatA = detecterCiblesOrphelines(mapping, scenarioA);
    expect(resultatA[0].cibleOrpheline).toBe(false);
    expect(resultatA[0].cibleCleResolue).toBe("poste-id-dans-a");

    const resultatB = detecterCiblesOrphelines(mapping, scenarioB);
    expect(resultatB[0].cibleOrpheline).toBe(false);
    expect(resultatB[0].cibleCleResolue).toBe("poste-id-dans-b");
  });

  it("une cible qui EXISTE dans le scenario courant n'est jamais signalee orpheline", () => {
    const scenario = scenarioFactice({
      postes: [
        { id: "poste-ok", libelle: "Transport", type: TypePostePrevision.LOGISTIQUE, inclusBaseRepartition: true, ordre: 0, actif: true, chargesMensuelles: [], posteReferentielId: "referentiel-transport" },
      ],
    });
    const mapping = [ligneMapping({ cibleType: CibleRapprochement.POSTE_PREVISION, cibleId: "referentiel-transport" })];

    const resultat = detecterCiblesOrphelines(mapping, scenario);
    expect(resultat[0].cibleOrpheline).toBe(false);
    expect(resultat[0].cibleCleResolue).toBe("poste-ok");
  });

  it("ALIMENT_PREVISION : orphelin si le scenario courant ne porte plus cette tailleGranule (post-A.3, resolution echouee)", () => {
    const scenario = scenarioFactice({ aliments: [] });
    const mapping = [
      ligneMapping({
        cibleType: CibleRapprochement.ALIMENT_PREVISION,
        cibleId: composeCibleAlimentPrevision(TailleGranule.G2, "aliment-ailleurs"),
      }),
    ];

    const resultat = detecterCiblesOrphelines(mapping, scenario);
    expect(resultat[0].cibleOrpheline).toBe(true);
    expect(resultat[0].cibleCleResolue).toBeNull();
  });

  it("ALIMENT_PREVISION : jamais orphelin quand la tailleGranule existe dans le scenario courant, meme si l'id d'origine differe (A.3 resout dynamiquement)", () => {
    const scenario = scenarioFactice({
      aliments: [
        { id: "aliment-scenario-courant", tailleGranule: TailleGranule.G3, sacsParTonneStandard: null, ordre: 0, repartitions: [], articles: [] },
      ],
    });
    const mapping = [
      ligneMapping({
        cibleType: CibleRapprochement.ALIMENT_PREVISION,
        cibleId: composeCibleAlimentPrevision(TailleGranule.G3, "aliment-scenario-tout-autre"),
      }),
    ];

    const resultat = detecterCiblesOrphelines(mapping, scenario);
    expect(resultat[0].cibleOrpheline).toBe(false);
    expect(resultat[0].cibleCleResolue).toBe("aliment-scenario-courant");
  });

  it("VENTE_PREVUE / NON_RAPPROCHE ne sont JAMAIS marques orphelins (aucune cible a evaluer structurellement)", () => {
    const scenario = scenarioFactice();
    const lignes = [
      ligneMapping({ id: "m-vente", cibleType: CibleRapprochement.VENTE_PREVUE, cibleId: null }),
      ligneMapping({ id: "m-nonrapp", cibleType: CibleRapprochement.NON_RAPPROCHE, cibleId: null }),
    ];

    const resultat = detecterCiblesOrphelines(lignes, scenario);
    expect(resultat.every((l) => l.cibleOrpheline === false)).toBe(true);
  });

  it("FALSIFICATION : si la detection ignorait cibleType et evaluait TOUTE ligne comme exigeant une cible, VENTE_PREVUE/NON_RAPPROCHE remonteraient a tort en orphelin — preuve que le filtre par cibleType est actif", () => {
    const scenario = scenarioFactice();
    const ligneVentePrevue = ligneMapping({ cibleType: CibleRapprochement.VENTE_PREVUE, cibleId: null });

    // Comportement de PRODUCTION : jamais orphelin (cibleId=null pour ce type, structurellement hors perimetre).
    const [ligneProduction] = detecterCiblesOrphelines([ligneVentePrevue], scenario);
    expect(ligneProduction.cibleOrpheline).toBe(false);

    // Une implementation naive qui traiterait `cibleCle === null` comme
    // "orphelin" pour TOUT type produirait un faux positif ici — c'est
    // precisement le comportement que ce test interdit de laisser passer :
    // `cibleOrpheline` doit rester borne aux DEUX types qui exigent une
    // cible (POSTE_PREVISION/ALIMENT_PREVISION), jamais VENTE_PREVUE.
  });

  it("RENOMMAGE (ADR-053 §16.4, §16.9 point 2) : renommer PostePrevision.libelle ne casse JAMAIS la resolution — la cle est posteReferentielId, jamais libelle", () => {
    const mapping = [
      ligneMapping({ cibleType: CibleRapprochement.POSTE_PREVISION, cibleId: "referentiel-energie" }),
    ];
    const avantRenommage = scenarioFactice({
      postes: [
        { id: "poste-energie", libelle: "Energie", type: TypePostePrevision.CHARGE_EXPLOITATION, inclusBaseRepartition: true, ordre: 0, actif: true, chargesMensuelles: [], posteReferentielId: "referentiel-energie" },
      ],
    });
    const apresRenommage = scenarioFactice({
      // Seul `libelle` change (PostePrevision ET, hors de portee de ce test
      // pur, PosteReferentiel — le mecanisme de resolution ne lit jamais ce
      // champ) — `id`/`posteReferentielId` restent strictement identiques.
      postes: [
        { id: "poste-energie", libelle: "Energie et Carburant", type: TypePostePrevision.CHARGE_EXPLOITATION, inclusBaseRepartition: true, ordre: 0, actif: true, chargesMensuelles: [], posteReferentielId: "referentiel-energie" },
      ],
    });

    const resultatAvant = detecterCiblesOrphelines(mapping, avantRenommage);
    const resultatApres = detecterCiblesOrphelines(mapping, apresRenommage);

    expect(resultatAvant[0].cibleOrpheline).toBe(false);
    expect(resultatApres[0].cibleOrpheline).toBe(false);
    expect(resultatApres[0].cibleCleResolue).toBe(resultatAvant[0].cibleCleResolue);
    expect(resultatApres[0].cibleCleResolue).toBe("poste-energie");

    // Falsification manuelle documentee ici (executee et restauree separement,
    // cf. rapport de test) : une resolution qui matcherait par `libelle` au
    // lieu de `posteReferentielId` ferait echouer CE test precis des que le
    // libelle change — c'est la propriete que ce test protege.
  });
});
