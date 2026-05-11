/**
 * Tests unitaires — getCoutProductionVague
 *
 * Cas couverts :
 * 1. Vague inexistante → throw (findUniqueOrThrow)
 * 2. Vague sans aucune donnée → coutTotal = 0, tableaux vides
 * 3. Aliments avec uniteAchat/contenance (sac de 25 kg) → getPrixParUniteBase divise correctement
 * 4. Dépenses directes catégorie ALIMENT → exclues du total (anti double-comptage)
 * 5. Dépenses récurrentes avec 2 vagues simultanées → ratio ~50%
 * 6. Calcul coût/kg correct
 * 7. ROI correct
 * 8. Dépenses multi-vagues via ListeBesoins avec ratio
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCoutProductionVague } from "@/lib/queries/finances";
import { CategorieDepense, FrequenceRecurrence } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockVagueFindUniqueOrThrow = vi.fn();
const mockReleveConsommationFindMany = vi.fn();
const mockDepenseFindMany = vi.fn();
const mockDepenseRecurrenteFindMany = vi.fn();
const mockVagueFindMany = vi.fn();
const mockVenteFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vague: {
      findUniqueOrThrow: (...args: unknown[]) =>
        mockVagueFindUniqueOrThrow(...args),
      findMany: (...args: unknown[]) => mockVagueFindMany(...args),
    },
    releveConsommation: {
      findMany: (...args: unknown[]) => mockReleveConsommationFindMany(...args),
    },
    depense: {
      findMany: (...args: unknown[]) => mockDepenseFindMany(...args),
    },
    depenseRecurrente: {
      findMany: (...args: unknown[]) => mockDepenseRecurrenteFindMany(...args),
    },
    vente: {
      findMany: (...args: unknown[]) => mockVenteFindMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Constantes partagées
// ---------------------------------------------------------------------------

const SITE_ID = "site-test-001";
const VAGUE_ID = "vague-test-001";

/** Vague de base valide : EN_COURS sur 30 jours */
const vagueBase = {
  id: VAGUE_ID,
  code: "V-2026-001",
  statut: "EN_COURS",
  dateDebut: new Date("2026-01-01"),
  dateFin: new Date("2026-01-31"),
  nombreInitial: 1000,
};

/**
 * Réinitialise tous les mocks avec des retours vides (cas nominal sans données).
 */
function mockAllEmpty() {
  mockReleveConsommationFindMany.mockResolvedValue([]);
  // depense.findMany est appelé 2 fois : depenses directes + multi-vague
  mockDepenseFindMany.mockResolvedValue([]);
  mockDepenseRecurrenteFindMany.mockResolvedValue([]);
  mockVagueFindMany.mockResolvedValue([vagueBase]);
  mockVenteFindMany.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// 1. Vague inexistante
// ---------------------------------------------------------------------------

describe("getCoutProductionVague — vague inexistante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lève une erreur si la vague n'existe pas (findUniqueOrThrow)", async () => {
    mockVagueFindUniqueOrThrow.mockRejectedValue(
      new Error("No Vague found")
    );

    await expect(
      getCoutProductionVague("vague-inexistante", SITE_ID)
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. Vague sans aucune donnée
// ---------------------------------------------------------------------------

describe("getCoutProductionVague — vague sans données", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVagueFindUniqueOrThrow.mockResolvedValue(vagueBase);
    mockAllEmpty();
  });

  it("retourne coutTotal = 0", async () => {
    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);
    expect(result.resume.coutTotal).toBe(0);
  });

  it("retourne des tableaux vides pour aliments, dépenses, ventes", async () => {
    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);
    expect(result.detailAliments).toHaveLength(0);
    expect(result.depensesDirectes).toHaveLength(0);
    expect(result.depensesMultiVagues).toHaveLength(0);
    expect(result.depensesRecurrentes).toHaveLength(0);
    expect(result.ventes).toHaveLength(0);
  });

  it("retourne coutParKg = null quand aucune vente", async () => {
    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);
    expect(result.resume.coutParKg).toBeNull();
    expect(result.resume.prixMoyenVenteKg).toBeNull();
    expect(result.resume.roi).toBeNull();
  });

  it("retourne coutParCategorie vide quand aucune dépense", async () => {
    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);
    expect(result.coutParCategorie).toHaveLength(0);
  });

  it("retourne la durée de la vague en jours (30 jours)", async () => {
    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);
    // 2026-01-01 → 2026-01-31 = 30 jours
    expect(result.vague.dureeJours).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// 3. Aliments avec uniteAchat/contenance (sac de 25 kg)
// ---------------------------------------------------------------------------

describe("getCoutProductionVague — aliments avec contenance (sac de 25 kg)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVagueFindUniqueOrThrow.mockResolvedValue(vagueBase);
    mockAllEmpty();
  });

  it("divise le prix par la contenance pour obtenir le prix/kg (15000 CFA/sac ÷ 25 kg = 600 CFA/kg)", async () => {
    // 10 kg consommés, produit vendu en sacs de 25 kg à 15000 CFA/sac
    // → prix base = 15000/25 = 600 CFA/kg
    // → cout total aliments = 10 * 600 = 6000 CFA
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 10,
        produit: {
          nom: "Farine de poisson",
          prixUnitaire: 15000,
          uniteAchat: "SAC",
          contenance: 25,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.formule.coutAliments).toBe(6000);
    expect(result.detailAliments).toHaveLength(1);
    expect(result.detailAliments[0].produit).toBe("Farine de poisson");
    expect(result.detailAliments[0].prixUnitaire).toBeCloseTo(600, 2);
    expect(result.detailAliments[0].quantite).toBeCloseTo(10, 3);
    expect(result.detailAliments[0].total).toBe(6000);
  });

  it("utilise le prixUnitaire directement si pas d'uniteAchat (produit en vrac)", async () => {
    // 5 kg à 700 CFA/kg direct → cout = 3500 CFA
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 5,
        produit: {
          nom: "Granulé flottant",
          prixUnitaire: 700,
          uniteAchat: null,
          contenance: null,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.formule.coutAliments).toBe(3500);
    expect(result.detailAliments[0].prixUnitaire).toBeCloseTo(700, 2);
  });

  it("agrège plusieurs lignes du même produit dans detailAliments", async () => {
    // Deux relevés de consommation du même produit
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 5,
        produit: {
          nom: "Granulé 3mm",
          prixUnitaire: 800,
          uniteAchat: null,
          contenance: null,
        },
      },
      {
        quantite: 3,
        produit: {
          nom: "Granulé 3mm",
          prixUnitaire: 800,
          uniteAchat: null,
          contenance: null,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    // Un seul produit dans detailAliments (agrégé)
    expect(result.detailAliments).toHaveLength(1);
    expect(result.detailAliments[0].quantite).toBeCloseTo(8, 3);
    expect(result.detailAliments[0].total).toBe(6400); // 8 * 800
  });
});

// ---------------------------------------------------------------------------
// 4. Dépenses directes catégorie ALIMENT → exclues (anti double-comptage)
// ---------------------------------------------------------------------------

describe("getCoutProductionVague — anti double-comptage ALIMENT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVagueFindUniqueOrThrow.mockResolvedValue(vagueBase);
    mockAllEmpty();
  });

  it("n'inclut pas les dépenses directes catégorie ALIMENT dans coutDepensesDirectes", async () => {
    // La query SQL exclut catégorie ALIMENT dans la clause WHERE
    // Donc mockDepenseFindMany retourne [] (la DB a déjà filtré)
    // On vérifie que le résultat est cohérent (0 dépenses directes)
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 10,
        produit: {
          nom: "Aliment X",
          prixUnitaire: 500,
          uniteAchat: null,
          contenance: null,
        },
      },
    ]);
    // La dépense ALIMENT est filtrée côté DB (WHERE categorieDepense != ALIMENT)
    // mockDepenseFindMany reste [] grâce à mockAllEmpty()

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    // Seuls les aliments via ReleveConsommation sont comptés
    expect(result.formule.coutAliments).toBe(5000); // 10 * 500
    expect(result.formule.coutDepensesDirectes).toBe(0);
    expect(result.formule.coutTotal).toBe(5000);
    expect(result.depensesDirectes).toHaveLength(0);
  });

  it("comptabilise les dépenses directes non-ALIMENT correctement", async () => {
    // Une dépense VETERINAIRE de 20000 CFA
    mockDepenseFindMany
      .mockResolvedValueOnce([
        {
          date: new Date("2026-01-15"),
          categorieDepense: CategorieDepense.VETERINAIRE,
          description: "Traitement antibiotique",
          montantTotal: 20000,
        },
      ])
      .mockResolvedValueOnce([]); // dépenses multi-vague

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.formule.coutDepensesDirectes).toBe(20000);
    expect(result.depensesDirectes).toHaveLength(1);
    expect(result.depensesDirectes[0].categorie).toBe(CategorieDepense.VETERINAIRE);
    expect(result.depensesDirectes[0].montant).toBe(20000);
  });
});

// ---------------------------------------------------------------------------
// 5. Dépenses récurrentes avec 2 vagues simultanées → ratio ~50%
// ---------------------------------------------------------------------------

describe("getCoutProductionVague — dépenses récurrentes prorata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVagueFindUniqueOrThrow.mockResolvedValue(vagueBase);
    mockAllEmpty();
  });

  it("alloue ~50% d'une dépense mensuelle si 2 vagues actives le même mois", async () => {
    // Vague cible : 2026-01-01 → 2026-01-31
    // Vague concurrente : 2026-01-01 → 2026-01-31 (exactement la même durée)
    // → chaque vague a 50% des jours → ratio = 0.5
    // Dépense récurrente : électricité 100 000 CFA/mois
    // → montant imputé à notre vague = 50 000 CFA

    const vagueConcurrente = {
      id: "vague-concurrent-001",
      dateDebut: new Date("2026-01-01"),
      dateFin: new Date("2026-01-31"),
    };

    // toutesVaguesSite inclut les 2 vagues
    mockVagueFindMany.mockResolvedValue([vagueBase, vagueConcurrente]);

    mockDepenseRecurrenteFindMany.mockResolvedValue([
      {
        description: "Électricité",
        categorieDepense: CategorieDepense.ELECTRICITE,
        montantEstime: 100000,
        frequence: FrequenceRecurrence.MENSUEL,
        createdAt: new Date("2025-12-01"),
        derniereGeneration: new Date("2026-01-31"),
        isActive: true,
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.depensesRecurrentes).toHaveLength(1);
    const dr = result.depensesRecurrentes[0];
    expect(dr.description).toBe("Électricité");
    expect(dr.coutMensuel).toBe(100000);
    expect(dr.moisImputes).toBe(1);
    // Ratio moyen ~0.5 (50%)
    expect(dr.ratioMoyen).toBeCloseTo(0.5, 2);
    // Montant imputé ~50 000 CFA
    expect(dr.montantImpute).toBeCloseTo(50000, -2); // tolérance 100 CFA
    expect(result.formule.coutRecurrents).toBeCloseTo(50000, -2);
  });

  it("alloue 100% si la vague cible est la seule active ce mois", async () => {
    // Une seule vague → ratio = 1.0 → 100% de la dépense
    mockVagueFindMany.mockResolvedValue([vagueBase]);

    mockDepenseRecurrenteFindMany.mockResolvedValue([
      {
        description: "Loyer pompe",
        categorieDepense: CategorieDepense.LOYER,
        montantEstime: 30000,
        frequence: FrequenceRecurrence.MENSUEL,
        createdAt: new Date("2025-12-01"),
        derniereGeneration: new Date("2026-01-31"),
        isActive: true,
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    const dr = result.depensesRecurrentes[0];
    expect(dr.ratioMoyen).toBeCloseTo(1.0, 2);
    expect(dr.montantImpute).toBe(30000);
  });

  it("convertit correctement TRIMESTRIEL en cout mensuel (÷3)", async () => {
    mockVagueFindMany.mockResolvedValue([vagueBase]);

    mockDepenseRecurrenteFindMany.mockResolvedValue([
      {
        description: "Maintenance trimestrielle",
        categorieDepense: CategorieDepense.REPARATION,
        montantEstime: 90000,
        frequence: FrequenceRecurrence.TRIMESTRIEL,
        createdAt: new Date("2025-12-01"),
        derniereGeneration: new Date("2026-01-31"),
        isActive: true,
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    const dr = result.depensesRecurrentes[0];
    // 90000 / 3 = 30000 CFA/mois
    expect(dr.coutMensuel).toBeCloseTo(30000, 2);
    // 1 mois × ratio 1.0 × 30000 = 30000
    expect(dr.montantImpute).toBeCloseTo(30000, -2);
  });

  it("convertit correctement ANNUEL en cout mensuel (÷12)", async () => {
    mockVagueFindMany.mockResolvedValue([vagueBase]);

    mockDepenseRecurrenteFindMany.mockResolvedValue([
      {
        description: "Assurance annuelle",
        categorieDepense: CategorieDepense.AUTRE,
        montantEstime: 120000,
        frequence: FrequenceRecurrence.ANNUEL,
        createdAt: new Date("2025-12-01"),
        derniereGeneration: new Date("2026-01-31"),
        isActive: true,
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    const dr = result.depensesRecurrentes[0];
    // 120000 / 12 = 10000 CFA/mois
    expect(dr.coutMensuel).toBeCloseTo(10000, 2);
    expect(dr.montantImpute).toBeCloseTo(10000, -2);
  });
});

// ---------------------------------------------------------------------------
// 6. Calcul coût/kg correct
// ---------------------------------------------------------------------------

describe("getCoutProductionVague — calcul coût/kg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVagueFindUniqueOrThrow.mockResolvedValue(vagueBase);
    mockAllEmpty();
  });

  it("calcule coutParKg = coutTotal / poidsTotalVendu", async () => {
    // Aliments : 100 kg × 600 CFA/kg = 60 000 CFA
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 100,
        produit: {
          nom: "Granulé",
          prixUnitaire: 600,
          uniteAchat: null,
          contenance: null,
        },
      },
    ]);

    // Vente : 50 kg à 2500 CFA/kg = 125 000 CFA
    mockVenteFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-01-28"),
        poidsTotalKg: 50,
        prixUnitaireKg: 2500,
        montantTotal: 125000,
        client: { nom: "Client A" },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    // coutTotal = 60 000, poidsVendu = 50 kg → coutParKg = 1200 CFA/kg
    expect(result.resume.coutTotal).toBe(60000);
    expect(result.resume.poidsTotalVendu).toBeCloseTo(50, 2);
    expect(result.resume.coutParKg).toBeCloseTo(1200, 2);
    expect(result.resume.prixMoyenVenteKg).toBeCloseTo(2500, 2);
    // margeParKg = 2500 - 1200 = 1300
    expect(result.resume.margeParKg).toBeCloseTo(1300, 2);
  });

  it("retourne coutParKg = null quand aucune vente (poids = 0)", async () => {
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 50,
        produit: {
          nom: "Granulé",
          prixUnitaire: 500,
          uniteAchat: null,
          contenance: null,
        },
      },
    ]);
    // pas de vente → mockVenteFindMany retourne [] (déjà mocké par mockAllEmpty)

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.resume.coutParKg).toBeNull();
    expect(result.resume.prixMoyenVenteKg).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. ROI correct
// ---------------------------------------------------------------------------

describe("getCoutProductionVague — calcul ROI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVagueFindUniqueOrThrow.mockResolvedValue(vagueBase);
    mockAllEmpty();
  });

  it("calcule ROI = (marge / coutTotal) * 100", async () => {
    // Coût aliments : 50 kg × 500 CFA/kg = 25 000 CFA
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 50,
        produit: {
          nom: "Granulé",
          prixUnitaire: 500,
          uniteAchat: null,
          contenance: null,
        },
      },
    ]);
    // Revenus : 50 000 CFA
    // marge = 50 000 - 25 000 = 25 000
    // roi = 25 000 / 25 000 * 100 = 100%
    mockVenteFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-01-28"),
        poidsTotalKg: 20,
        prixUnitaireKg: 2500,
        montantTotal: 50000,
        client: { nom: "Client B" },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.resume.revenus).toBe(50000);
    expect(result.resume.marge).toBe(25000);
    expect(result.resume.roi).toBeCloseTo(100, 1);
  });

  it("retourne ROI = null quand coutTotal = 0", async () => {
    // Pas d'aliments, pas de dépenses → coutTotal = 0 → ROI = null
    mockVenteFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-01-28"),
        poidsTotalKg: 10,
        prixUnitaireKg: 3000,
        montantTotal: 30000,
        client: { nom: "Client C" },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.resume.coutTotal).toBe(0);
    expect(result.resume.roi).toBeNull();
  });

  it("retourne ROI négatif pour une vague déficitaire", async () => {
    // Coûts : 80 000 CFA, revenus : 40 000 CFA
    // marge = -40 000, roi = -50%
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 160,
        produit: {
          nom: "Granulé premium",
          prixUnitaire: 500,
          uniteAchat: null,
          contenance: null,
        },
      },
    ]);
    mockVenteFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-01-28"),
        poidsTotalKg: 20,
        prixUnitaireKg: 2000,
        montantTotal: 40000,
        client: { nom: "Client D" },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.resume.marge).toBe(-40000);
    expect(result.resume.roi).toBeCloseTo(-50, 1);
  });
});

// ---------------------------------------------------------------------------
// 8. Dépenses multi-vagues via ListeBesoins avec ratio
// ---------------------------------------------------------------------------

describe("getCoutProductionVague — dépenses multi-vagues (ListeBesoins)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVagueFindUniqueOrThrow.mockResolvedValue(vagueBase);
    mockAllEmpty();
  });

  it("impute le montant au prorata du ratio défini dans ListeBesoinsVague", async () => {
    // Dépense multi-vague : 60 000 CFA, ratio 0.4 pour VAGUE_ID
    // → montant imputé = 60 000 * 0.4 = 24 000 CFA
    mockDepenseFindMany
      .mockResolvedValueOnce([]) // dépenses directes
      .mockResolvedValueOnce([
        {
          description: "Achat commun de matériel",
          montantTotal: 60000,
          listeBesoins: {
            vagues: [
              { vagueId: VAGUE_ID, ratio: 0.4 },
              { vagueId: "autre-vague-001", ratio: 0.6 },
            ],
          },
        },
      ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.depensesMultiVagues).toHaveLength(1);
    const dmv = result.depensesMultiVagues[0];
    expect(dmv.description).toBe("Achat commun de matériel");
    expect(dmv.montantTotal).toBe(60000);
    expect(dmv.ratio).toBeCloseTo(0.4, 4);
    expect(dmv.montantImpute).toBe(24000);
    expect(result.formule.coutMultiVagues).toBe(24000);
  });

  it("ignore les dépenses multi-vagues sans entrée pour notre vague", async () => {
    // La dépense n'a pas d'entrée pour VAGUE_ID dans listeBesoins.vagues
    mockDepenseFindMany
      .mockResolvedValueOnce([]) // dépenses directes
      .mockResolvedValueOnce([
        {
          description: "Dépense autre lot",
          montantTotal: 50000,
          listeBesoins: {
            vagues: [
              { vagueId: "autre-vague-001", ratio: 1.0 },
            ],
          },
        },
      ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.depensesMultiVagues).toHaveLength(0);
    expect(result.formule.coutMultiVagues).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Formule d'agrégation finale
// ---------------------------------------------------------------------------

describe("getCoutProductionVague — formule d'agrégation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVagueFindUniqueOrThrow.mockResolvedValue(vagueBase);
    mockAllEmpty();
  });

  it("coutTotal = coutAliments + coutDepensesDirectes + coutMultiVagues + coutRecurrents", async () => {
    // Aliments : 10 kg × 500 = 5 000
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 10,
        produit: {
          nom: "Granulé",
          prixUnitaire: 500,
          uniteAchat: null,
          contenance: null,
        },
      },
    ]);

    // Dépenses directes : 3 000 VETERINAIRE + multi 2 000
    mockDepenseFindMany
      .mockResolvedValueOnce([
        {
          date: new Date("2026-01-15"),
          categorieDepense: CategorieDepense.VETERINAIRE,
          description: "Antibiotique",
          montantTotal: 3000,
        },
      ])
      .mockResolvedValueOnce([
        {
          description: "Achat partagé",
          montantTotal: 4000,
          listeBesoins: {
            vagues: [{ vagueId: VAGUE_ID, ratio: 0.5 }],
          },
        },
      ]);

    // Récurrent : 1 000 CFA/mois, ratio 1.0 (seule vague)
    mockDepenseRecurrenteFindMany.mockResolvedValue([
      {
        description: "Eau",
        categorieDepense: CategorieDepense.EAU,
        montantEstime: 1000,
        frequence: FrequenceRecurrence.MENSUEL,
        createdAt: new Date("2025-12-01"),
        derniereGeneration: new Date("2026-01-31"),
        isActive: true,
      },
    ]);
    mockVagueFindMany.mockResolvedValue([vagueBase]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    const f = result.formule;
    expect(f.coutAliments).toBe(5000);
    expect(f.coutDepensesDirectes).toBe(3000);
    expect(f.coutMultiVagues).toBe(2000); // 4000 × 0.5
    // coutRecurrents ≈ 1000 (ratio 1.0, 1 mois)
    // coutTotal = 5000 + 3000 + 2000 + ~1000 = ~11000
    expect(f.coutTotal).toBe(f.coutAliments + f.coutDepensesDirectes + f.coutMultiVagues + f.coutRecurrents);
  });
});
