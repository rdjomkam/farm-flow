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
import { CategorieDepense, UniteStock } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockVagueFindUniqueOrThrow = vi.fn();
const mockReleveConsommationFindMany = vi.fn();
const mockDepenseFindMany = vi.fn();
const mockDepenseRecurrenteFindMany = vi.fn();
const mockVagueFindMany = vi.fn();
// DV.0 : getCoutProductionVague utilise ligneVente.findMany (pas vente.findMany)
const mockLigneVenteFindMany = vi.fn();
// ADR-043 Phase 3: nouvelles dépendances de getCoutProductionVague
const mockAssignationBacFindMany = vi.fn();
const mockReleveFindMany = vi.fn();
// TransfertGroupe mock (pour biomasse transférée)
const mockTransfertGroupeFindMany = vi.fn();

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
    // DV.0 : ligneVente (pas vente) est la source de vérité pour les ventes dans getCoutProductionVague
    ligneVente: {
      findMany: (...args: unknown[]) => mockLigneVenteFindMany(...args),
    },
    // ADR-043 Phase 3: getCoutProductionVague lit les bacs depuis AssignationBac
    assignationBac: {
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
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
 * ADR-043 Phase 3: ajouter assignationBac et releve dans les mocks vides.
 */
function mockAllEmpty() {
  mockReleveConsommationFindMany.mockResolvedValue([]);
  // depense.findMany est appelé 3 fois : directes + multi-vague + récurrentes générées
  mockDepenseFindMany.mockResolvedValue([]);
  mockDepenseRecurrenteFindMany.mockResolvedValue([]);
  mockVagueFindMany.mockResolvedValue([vagueBase]);
  // DV.0 : ligneVente (pas vente) est la source de vérité pour les ventes
  mockLigneVenteFindMany.mockResolvedValue([]);
  // ADR-043 Phase 3: bacs via AssignationBac + releves pour biomasse
  mockAssignationBacFindMany.mockResolvedValue([]);
  mockReleveFindMany.mockResolvedValue([]);
  // Transferts sortants (biomasse transférée) — vide par défaut
  mockTransfertGroupeFindMany.mockResolvedValue([]);
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
          uniteAchat: UniteStock.SACS,
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
    // SC.1 : nombreSacs = quantite / contenance = 10 / 25 = 0.4
    expect(result.detailAliments[0].contenanceSac).toBe(25);
    expect(result.detailAliments[0].nombreSacs).toBeCloseTo(0.4, 1);
  });

  it("calcule nombreSacs = quantite / contenance (186 kg / 15 kg/sac = 12.4 sacs)", async () => {
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 186,
        produit: {
          nom: "Granulé 6mm",
          prixUnitaire: 18000,
          uniteAchat: UniteStock.SACS,
          contenance: 15,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.detailAliments).toHaveLength(1);
    expect(result.detailAliments[0].contenanceSac).toBe(15);
    expect(result.detailAliments[0].nombreSacs).toBeCloseTo(12.4, 1);
  });

  it("retourne nombreSacs = null quand contenance est null (même en SACS)", async () => {
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 50,
        produit: {
          nom: "Granulé sans contenance",
          prixUnitaire: 800,
          uniteAchat: UniteStock.SACS,
          contenance: null,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.detailAliments[0].nombreSacs).toBeNull();
    expect(result.detailAliments[0].contenanceSac).toBeNull();
  });

  it("retourne nombreSacs = null quand uniteAchat !== SACS (même avec contenance)", async () => {
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 20,
        produit: {
          nom: "Aliment en litres",
          prixUnitaire: 500,
          uniteAchat: UniteStock.LITRE,
          contenance: 10,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.detailAliments[0].nombreSacs).toBeNull();
    // contenanceSac reflete toujours la contenance du produit, independamment de l'unite
    expect(result.detailAliments[0].contenanceSac).toBe(10);
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
// 3bis. SC2.2 — Priorité poidsSacKg du profil (ConfigElevage) sur contenance produit
// ---------------------------------------------------------------------------

describe("getCoutProductionVague — priorité poidsSacKg profil > contenance produit (SC2.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAllEmpty();
  });

  it("utilise poidsSacKg du profil (25) même si le produit a une contenance différente (15)", async () => {
    mockVagueFindUniqueOrThrow.mockResolvedValue({
      ...vagueBase,
      configElevage: { poidsSacKg: 25 },
    });
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 50,
        produit: {
          nom: "Granulé 4mm",
          prixUnitaire: 18000,
          uniteAchat: UniteStock.SACS,
          contenance: 15,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    // Priorité profil : 25 kg/sac (pas 15)
    expect(result.detailAliments[0].contenanceSac).toBe(25);
    expect(result.detailAliments[0].nombreSacs).toBeCloseTo(2, 1); // 50 / 25 = 2
  });

  it("applique le poidsSacKg du profil même si uniteAchat !== SACS (décision explicite de l'éleveur)", async () => {
    mockVagueFindUniqueOrThrow.mockResolvedValue({
      ...vagueBase,
      configElevage: { poidsSacKg: 25 },
    });
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 50,
        produit: {
          nom: "Aliment en litres",
          prixUnitaire: 500,
          uniteAchat: UniteStock.LITRE,
          contenance: 10,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.detailAliments[0].contenanceSac).toBe(25);
    expect(result.detailAliments[0].nombreSacs).toBeCloseTo(2, 1); // 50 / 25 = 2
  });

  it("fallback sur la contenance du produit quand poidsSacKg du profil est null", async () => {
    mockVagueFindUniqueOrThrow.mockResolvedValue({
      ...vagueBase,
      configElevage: { poidsSacKg: null },
    });
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 30,
        produit: {
          nom: "Granulé 3mm",
          prixUnitaire: 15000,
          uniteAchat: UniteStock.SACS,
          contenance: 15,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.detailAliments[0].contenanceSac).toBe(15);
    expect(result.detailAliments[0].nombreSacs).toBeCloseTo(2, 1); // 30 / 15 = 2
  });

  it("fallback sur la contenance du produit quand la vague n'a pas de configElevage", async () => {
    mockVagueFindUniqueOrThrow.mockResolvedValue({
      ...vagueBase,
      configElevage: null,
    });
    mockReleveConsommationFindMany.mockResolvedValue([
      {
        quantite: 186,
        produit: {
          nom: "Granulé 6mm",
          prixUnitaire: 18000,
          uniteAchat: UniteStock.SACS,
          contenance: 15,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.detailAliments[0].contenanceSac).toBe(15);
    expect(result.detailAliments[0].nombreSacs).toBeCloseTo(12.4, 1);
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

  it("alloue ~50% d'une dépense payée si 2 vagues actives le même mois avec même poids", async () => {
    // ADR-043: getCoutProductionVague lit les Depense générées (depenseRecurrenteId != null)
    // avec montantPaye, et alloue proportionnellement via jours × nombreInitial des vagues.
    // Vague cible : 2026-01-01 → 2026-01-31, nombreInitial = 1000
    // Vague concurrente : 2026-01-01 → 2026-01-31, nombreInitial = 1000 (même poids)
    // → ratio = 0.5 → 50% du montant payé (100 000) = 50 000 CFA

    const vagueConcurrente = {
      id: "vague-concurrent-001",
      code: "V-CONCURRENT",
      dateDebut: new Date("2026-01-01"),
      dateFin: new Date("2026-01-31"),
      nombreInitial: 1000,
    };

    mockVagueFindMany.mockResolvedValue([{ ...vagueBase, code: "V-2026-001" }, vagueConcurrente]);

    // depense.findMany appelé 3 fois dans Promise.all :
    // 1ère (directes), 2ème (multi-vague), 3ème (récurrentes générées avec montantPaye)
    mockDepenseFindMany
      .mockResolvedValueOnce([]) // directes
      .mockResolvedValueOnce([]) // multi-vague
      .mockResolvedValueOnce([   // récurrentes générées
        {
          date: new Date("2026-01-31"),
          montantPaye: 100000,
          depenseRecurrente: {
            id: "template-elec-001",
            description: "Électricité",
            categorieDepense: CategorieDepense.ELECTRICITE,
          },
        },
      ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.depensesRecurrentes).toHaveLength(1);
    const dr = result.depensesRecurrentes[0];
    expect(dr.description).toBe("Électricité");
    expect(dr.montantPayeTotal).toBe(100000);
    expect(dr.moisCouverts).toBe(1);
    // Ratio moyen ~0.5 (50%) — 2 vagues avec même poids
    expect(dr.ratioMoyen).toBeCloseTo(0.5, 2);
    // Montant imputé ~50 000 CFA
    expect(dr.montantImpute).toBeCloseTo(50000, -2);
    expect(result.formule.coutRecurrents).toBeCloseTo(50000, -2);
  });

  it("alloue 100% si la vague cible est la seule active ce mois", async () => {
    // Une seule vague → ratio = 1.0 → 100% du montant payé
    mockVagueFindMany.mockResolvedValue([{ ...vagueBase, code: "V-2026-001" }]);

    mockDepenseFindMany
      .mockResolvedValueOnce([]) // directes
      .mockResolvedValueOnce([]) // multi-vague
      .mockResolvedValueOnce([   // récurrentes générées
        {
          date: new Date("2026-01-15"),
          montantPaye: 30000,
          depenseRecurrente: {
            id: "template-loyer-001",
            description: "Loyer pompe",
            categorieDepense: CategorieDepense.LOYER,
          },
        },
      ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.depensesRecurrentes).toHaveLength(1);
    const dr = result.depensesRecurrentes[0];
    expect(dr.ratioMoyen).toBeCloseTo(1.0, 2);
    expect(dr.montantImpute).toBeCloseTo(30000, -2);
  });

  it("cumule plusieurs paiements récurrents du même template sur un mois", async () => {
    // 2 paiements du même template en janvier : 15000 + 15000 = 30000
    // Seule vague → ratio 1.0 → montant imputé total = 30000
    mockVagueFindMany.mockResolvedValue([{ ...vagueBase, code: "V-2026-001" }]);

    mockDepenseFindMany
      .mockResolvedValueOnce([]) // directes
      .mockResolvedValueOnce([]) // multi-vague
      .mockResolvedValueOnce([   // récurrentes générées (2 paiements)
        {
          date: new Date("2026-01-15"),
          montantPaye: 15000,
          depenseRecurrente: {
            id: "template-rep-001",
            description: "Maintenance",
            categorieDepense: CategorieDepense.REPARATION,
          },
        },
        {
          date: new Date("2026-01-28"),
          montantPaye: 15000,
          depenseRecurrente: {
            id: "template-rep-001",
            description: "Maintenance",
            categorieDepense: CategorieDepense.REPARATION,
          },
        },
      ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.depensesRecurrentes).toHaveLength(1);
    const dr = result.depensesRecurrentes[0];
    // Les 2 paiements sont cumulés dans le même mois (montantPayeTotal = 30000)
    expect(dr.montantPayeTotal).toBeCloseTo(30000, -2);
    expect(dr.montantImpute).toBeCloseTo(30000, -2);
  });

  it("ignore les paiements récurrents avec montantPaye = 0", async () => {
    // montantPaye = 0 → ignoré dans le calcul
    mockVagueFindMany.mockResolvedValue([{ ...vagueBase, code: "V-2026-001" }]);

    mockDepenseFindMany
      .mockResolvedValueOnce([]) // directes
      .mockResolvedValueOnce([]) // multi-vague
      .mockResolvedValueOnce([   // récurrente générée mais non payée
        {
          date: new Date("2026-01-15"),
          montantPaye: 0,
          depenseRecurrente: {
            id: "template-001",
            description: "Dépense nulle",
            categorieDepense: CategorieDepense.AUTRE,
          },
        },
      ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    // Les paiements à 0 sont ignorés
    expect(result.depensesRecurrentes).toHaveLength(0);
    expect(result.formule.coutRecurrents).toBe(0);
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
    // DV.0 : format LigneVente (statut LIVREE → compte dans les stats)
    mockLigneVenteFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-01-28"),
        nombrePoissons: 20,
        poidsTotalKg: 50,
        vente: {
          prixUnitaireKg: 2500,
          createdAt: new Date("2026-01-28"),
          client: { nom: "Client A" },
          statut: "LIVREE",
          poidsLivreKg: null,
          poidsTotalKg: 50,
          quantiteLivree: null,
          quantitePoissons: 20,
        },
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
    // DV.0 : format LigneVente (statut LIVREE → compte dans les stats)
    mockLigneVenteFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-01-28"),
        nombrePoissons: 8,
        poidsTotalKg: 20,
        vente: {
          prixUnitaireKg: 2500,
          createdAt: new Date("2026-01-28"),
          client: { nom: "Client B" },
          statut: "LIVREE",
          poidsLivreKg: null,
          poidsTotalKg: 20,
          quantiteLivree: null,
          quantitePoissons: 8,
        },
      },
    ]);

    const result = await getCoutProductionVague(VAGUE_ID, SITE_ID);

    expect(result.resume.revenus).toBe(50000);
    expect(result.resume.marge).toBe(25000);
    expect(result.resume.roi).toBeCloseTo(100, 1);
  });

  it("retourne ROI = null quand coutTotal = 0", async () => {
    // Pas d'aliments, pas de dépenses → coutTotal = 0 → ROI = null
    // DV.0 : format LigneVente (statut LIVREE → compte dans les stats)
    mockLigneVenteFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-01-28"),
        nombrePoissons: 3,
        poidsTotalKg: 10,
        vente: {
          prixUnitaireKg: 3000,
          createdAt: new Date("2026-01-28"),
          client: { nom: "Client C" },
          statut: "LIVREE",
          poidsLivreKg: null,
          poidsTotalKg: 10,
          quantiteLivree: null,
          quantitePoissons: 3,
        },
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
    // DV.0 : format LigneVente (statut LIVREE → compte dans les stats)
    mockLigneVenteFindMany.mockResolvedValue([
      {
        createdAt: new Date("2026-01-28"),
        nombrePoissons: 8,
        poidsTotalKg: 20,
        vente: {
          prixUnitaireKg: 2000,
          createdAt: new Date("2026-01-28"),
          client: { nom: "Client D" },
          statut: "LIVREE",
          poidsLivreKg: null,
          poidsTotalKg: 20,
          quantiteLivree: null,
          quantitePoissons: 8,
        },
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

    // depense.findMany est appelé 3 fois (directes, multi-vague, récurrentes générées)
    mockDepenseFindMany
      .mockResolvedValueOnce([  // 1ère: directes
        {
          date: new Date("2026-01-15"),
          categorieDepense: CategorieDepense.VETERINAIRE,
          description: "Antibiotique",
          montantTotal: 3000,
        },
      ])
      .mockResolvedValueOnce([  // 2ème: multi-vague
        {
          description: "Achat partagé",
          montantTotal: 4000,
          listeBesoins: {
            vagues: [{ vagueId: VAGUE_ID, ratio: 0.5 }],
          },
        },
      ])
      .mockResolvedValueOnce([  // 3ème: récurrentes générées (ADR-043)
        {
          date: new Date("2026-01-15"),
          montantPaye: 1000,
          depenseRecurrente: {
            id: "template-eau-001",
            description: "Eau",
            categorieDepense: CategorieDepense.EAU,
          },
        },
      ]);

    mockVagueFindMany.mockResolvedValue([{ ...vagueBase, code: "V-2026-001" }]);

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
