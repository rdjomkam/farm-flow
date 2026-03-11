import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifierAlertes,
  verifierAlertesMortalite,
  verifierAlertesQualiteEau,
  verifierAlertesStock,
  verifierRappelAlimentation,
  verifierRappelBiometrie,
} from "@/lib/alertes";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockNotificationCount = vi.fn();
const mockNotificationCreate = vi.fn();
const mockReleve = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
};
const mockProduit = {
  findMany: vi.fn(),
};
const mockConfigAlerte = {
  findMany: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: {
      count: (...args: unknown[]) => mockNotificationCount(...args),
      create: (...args: unknown[]) => mockNotificationCreate(...args),
    },
    releve: {
      findMany: (...args: unknown[]) => mockReleve.findMany(...args),
      findFirst: (...args: unknown[]) => mockReleve.findFirst(...args),
    },
    produit: {
      findMany: (...args: unknown[]) => mockProduit.findMany(...args),
    },
    configAlerte: {
      findMany: (...args: unknown[]) => mockConfigAlerte.findMany(...args),
    },
  },
}));

const SITE_ID = "site-1";
const USER_ID = "user-1";

const BASE_CONFIG = {
  id: "config-1",
  typeAlerte: "MORTALITE_ELEVEE",
  seuilValeur: 5,
  seuilPourcentage: null,
  enabled: true,
  userId: USER_ID,
  siteId: SITE_ID,
};

// ---------------------------------------------------------------------------
// Tests verifierAlertesMortalite
// ---------------------------------------------------------------------------
describe("verifierAlertesMortalite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cree une notification quand mortalite depasse le seuil", async () => {
    mockReleve.findMany.mockResolvedValue([
      {
        nombreMorts: 8,
        vague: { id: "vague-1", code: "V-001" },
        bac: { id: "bac-1", nom: "Bac 1" },
      },
    ]);
    // pas de notification existante
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });

    await verifierAlertesMortalite(SITE_ID, USER_ID, BASE_CONFIG);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const createArg = mockNotificationCreate.mock.calls[0][0];
    expect(createArg.data.typeAlerte).toBe("MORTALITE_ELEVEE");
    expect(createArg.data.statut).toBe("ACTIVE");
  });

  it("ne cree pas de notification si mortalite sous le seuil", async () => {
    mockReleve.findMany.mockResolvedValue([]);

    await verifierAlertesMortalite(SITE_ID, USER_ID, BASE_CONFIG);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("ne cree pas de doublon si notification existe deja aujourd'hui", async () => {
    mockReleve.findMany.mockResolvedValue([
      {
        nombreMorts: 8,
        vague: { id: "vague-1", code: "V-001" },
        bac: { id: "bac-1", nom: "Bac 1" },
      },
    ]);
    // notification deja existante
    mockNotificationCount.mockResolvedValue(1);

    await verifierAlertesMortalite(SITE_ID, USER_ID, BASE_CONFIG);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("utilise le seuil par defaut (5) si seuilValeur est null", async () => {
    const configSansSeuill = { ...BASE_CONFIG, seuilValeur: null };
    mockReleve.findMany.mockResolvedValue([]);

    await verifierAlertesMortalite(SITE_ID, USER_ID, configSansSeuill);

    // Verifie que findMany a ete appele avec nombreMorts: { gt: 5 }
    const callArgs = mockReleve.findMany.mock.calls[0][0];
    expect(callArgs.where.nombreMorts).toEqual({ gt: 5 });
  });
});

// ---------------------------------------------------------------------------
// Tests verifierAlertesQualiteEau
// ---------------------------------------------------------------------------
describe("verifierAlertesQualiteEau", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const configQE = { ...BASE_CONFIG, typeAlerte: "QUALITE_EAU" };

  it("cree une notification si pH trop bas (< 6.5)", async () => {
    mockReleve.findMany.mockResolvedValue([
      {
        ph: 5.0,
        temperature: 28,
        vague: { id: "vague-1", code: "V-001" },
        bac: { id: "bac-1", nom: "Bac 1" },
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });

    await verifierAlertesQualiteEau(SITE_ID, USER_ID, configQE);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const createArg = mockNotificationCreate.mock.calls[0][0];
    expect(createArg.data.message).toContain("pH trop bas");
  });

  it("cree une notification si pH trop eleve (> 8.5)", async () => {
    mockReleve.findMany.mockResolvedValue([
      {
        ph: 9.0,
        temperature: 28,
        vague: { id: "vague-1", code: "V-001" },
        bac: { id: "bac-1", nom: "Bac 1" },
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });

    await verifierAlertesQualiteEau(SITE_ID, USER_ID, configQE);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const createArg = mockNotificationCreate.mock.calls[0][0];
    expect(createArg.data.message).toContain("pH trop eleve");
  });

  it("cree une notification si temperature trop basse (< 25)", async () => {
    mockReleve.findMany.mockResolvedValue([
      {
        ph: 7.5,
        temperature: 20,
        vague: { id: "vague-1", code: "V-001" },
        bac: { id: "bac-1", nom: "Bac 1" },
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });

    await verifierAlertesQualiteEau(SITE_ID, USER_ID, configQE);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const createArg = mockNotificationCreate.mock.calls[0][0];
    expect(createArg.data.message).toContain("Temperature trop basse");
  });

  it("cree une notification si temperature trop elevee (> 32)", async () => {
    mockReleve.findMany.mockResolvedValue([
      {
        ph: 7.5,
        temperature: 35,
        vague: { id: "vague-1", code: "V-001" },
        bac: { id: "bac-1", nom: "Bac 1" },
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });

    await verifierAlertesQualiteEau(SITE_ID, USER_ID, configQE);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const createArg = mockNotificationCreate.mock.calls[0][0];
    expect(createArg.data.message).toContain("Temperature trop elevee");
  });

  it("ne cree pas de notification si pH et temperature dans les normes", async () => {
    mockReleve.findMany.mockResolvedValue([
      {
        ph: 7.0,
        temperature: 28,
        vague: { id: "vague-1", code: "V-001" },
        bac: { id: "bac-1", nom: "Bac 1" },
      },
    ]);

    await verifierAlertesQualiteEau(SITE_ID, USER_ID, configQE);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("ne cree pas de notification si aucun releve qualite eau", async () => {
    mockReleve.findMany.mockResolvedValue([]);

    await verifierAlertesQualiteEau(SITE_ID, USER_ID, configQE);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("combine plusieurs problemes dans le message", async () => {
    mockReleve.findMany.mockResolvedValue([
      {
        ph: 5.0,
        temperature: 35,
        vague: { id: "vague-1", code: "V-001" },
        bac: { id: "bac-1", nom: "Bac 1" },
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });

    await verifierAlertesQualiteEau(SITE_ID, USER_ID, configQE);

    const createArg = mockNotificationCreate.mock.calls[0][0];
    expect(createArg.data.message).toContain("pH trop bas");
    expect(createArg.data.message).toContain("Temperature trop elevee");
  });
});

// ---------------------------------------------------------------------------
// Tests verifierAlertesStock
// ---------------------------------------------------------------------------
describe("verifierAlertesStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const configStock = { ...BASE_CONFIG, typeAlerte: "STOCK_BAS" };

  it("cree une notification si des produits sont sous le seuil", async () => {
    mockProduit.findMany.mockResolvedValue([
      {
        id: "prod-1",
        nom: "Aliment 3mm",
        stockActuel: 10,
        seuilAlerte: 50,
        unite: "KG",
      },
      {
        id: "prod-2",
        nom: "Vitamines",
        stockActuel: 2,
        seuilAlerte: 5,
        unite: "LITRE",
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });

    await verifierAlertesStock(SITE_ID, USER_ID, configStock);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const createArg = mockNotificationCreate.mock.calls[0][0];
    expect(createArg.data.typeAlerte).toBe("STOCK_BAS");
    expect(createArg.data.message).toContain("2 produit(s) sous le seuil");
  });

  it("ne cree pas de notification si tous les stocks sont suffisants", async () => {
    mockProduit.findMany.mockResolvedValue([
      {
        id: "prod-1",
        nom: "Aliment 3mm",
        stockActuel: 100,
        seuilAlerte: 50,
        unite: "KG",
      },
    ]);

    await verifierAlertesStock(SITE_ID, USER_ID, configStock);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("ne cree pas de notification si aucun produit en alerte", async () => {
    mockProduit.findMany.mockResolvedValue([]);

    await verifierAlertesStock(SITE_ID, USER_ID, configStock);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests verifierRappelAlimentation
// ---------------------------------------------------------------------------
describe("verifierRappelAlimentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const configRappel = { ...BASE_CONFIG, typeAlerte: "RAPPEL_ALIMENTATION" };

  it("cree un rappel si aucun releve alimentation aujourd'hui", async () => {
    mockReleve.findFirst.mockResolvedValue(null);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });

    await verifierRappelAlimentation(SITE_ID, USER_ID, configRappel);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const createArg = mockNotificationCreate.mock.calls[0][0];
    expect(createArg.data.typeAlerte).toBe("RAPPEL_ALIMENTATION");
    expect(createArg.data.titre).toContain("alimentation");
  });

  it("ne cree pas de rappel si un releve alimentation existe aujourd'hui", async () => {
    mockReleve.findFirst.mockResolvedValue({ id: "releve-1" });

    await verifierRappelAlimentation(SITE_ID, USER_ID, configRappel);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests verifierRappelBiometrie
// ---------------------------------------------------------------------------
describe("verifierRappelBiometrie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const configBio = { ...BASE_CONFIG, typeAlerte: "RAPPEL_BIOMETRIE", seuilValeur: 7 };

  it("cree un rappel si aucun releve biometrie depuis N jours", async () => {
    mockReleve.findFirst.mockResolvedValue(null);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });

    await verifierRappelBiometrie(SITE_ID, USER_ID, configBio);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const createArg = mockNotificationCreate.mock.calls[0][0];
    expect(createArg.data.typeAlerte).toBe("RAPPEL_BIOMETRIE");
    expect(createArg.data.message).toContain("7 jours");
  });

  it("ne cree pas de rappel si un releve biometrie recent existe", async () => {
    mockReleve.findFirst.mockResolvedValue({ id: "releve-bio-1" });

    await verifierRappelBiometrie(SITE_ID, USER_ID, configBio);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("utilise le seuil par defaut (7 jours) si seuilValeur est null", async () => {
    const configSansSeuil = { ...configBio, seuilValeur: null };
    mockReleve.findFirst.mockResolvedValue(null);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-1" });

    await verifierRappelBiometrie(SITE_ID, USER_ID, configSansSeuil);

    const createArg = mockNotificationCreate.mock.calls[0][0];
    expect(createArg.data.message).toContain("7 jours");
  });
});

// ---------------------------------------------------------------------------
// Tests verifierAlertes (fonction principale)
// ---------------------------------------------------------------------------
describe("verifierAlertes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appelle les verificateurs pour chaque config active", async () => {
    mockConfigAlerte.findMany.mockResolvedValue([
      { ...BASE_CONFIG, typeAlerte: "MORTALITE_ELEVEE" },
      { ...BASE_CONFIG, id: "config-2", typeAlerte: "STOCK_BAS" },
    ]);
    // Pour MORTALITE_ELEVEE : aucun releve critique
    mockReleve.findMany.mockResolvedValue([]);
    // Pour STOCK_BAS : aucun produit en alerte
    mockProduit.findMany.mockResolvedValue([]);

    await verifierAlertes(SITE_ID, USER_ID);

    // Les deux verifications ont ete appelees
    expect(mockConfigAlerte.findMany).toHaveBeenCalledWith({
      where: { siteId: SITE_ID, userId: USER_ID, enabled: true },
    });
    expect(mockReleve.findMany).toHaveBeenCalled();
    expect(mockProduit.findMany).toHaveBeenCalled();
  });

  it("ne fait rien si aucune config active", async () => {
    mockConfigAlerte.findMany.mockResolvedValue([]);

    await verifierAlertes(SITE_ID, USER_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
    expect(mockReleve.findMany).not.toHaveBeenCalled();
  });

  it("ignore le type PERSONNALISEE", async () => {
    mockConfigAlerte.findMany.mockResolvedValue([
      { ...BASE_CONFIG, typeAlerte: "PERSONNALISEE" },
    ]);

    await verifierAlertes(SITE_ID, USER_ID);

    // Aucune requete de releve ou produit ne doit etre faite
    expect(mockReleve.findMany).not.toHaveBeenCalled();
    expect(mockProduit.findMany).not.toHaveBeenCalled();
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("continue les autres verifications si l'une echoue", async () => {
    mockConfigAlerte.findMany.mockResolvedValue([
      { ...BASE_CONFIG, typeAlerte: "MORTALITE_ELEVEE" },
      { ...BASE_CONFIG, id: "config-2", typeAlerte: "STOCK_BAS" },
    ]);

    // MORTALITE_ELEVEE echoue
    mockReleve.findMany.mockRejectedValue(new Error("Erreur DB temporaire"));
    // STOCK_BAS reussit
    mockProduit.findMany.mockResolvedValue([]);

    // Ne doit pas propager l'erreur
    await expect(verifierAlertes(SITE_ID, USER_ID)).resolves.not.toThrow();

    // STOCK_BAS a ete appele malgre l'echec de MORTALITE
    expect(mockProduit.findMany).toHaveBeenCalled();
  });

  it("traite le type QUALITE_EAU", async () => {
    mockConfigAlerte.findMany.mockResolvedValue([
      { ...BASE_CONFIG, typeAlerte: "QUALITE_EAU" },
    ]);
    mockReleve.findMany.mockResolvedValue([]);

    await verifierAlertes(SITE_ID, USER_ID);

    expect(mockReleve.findMany).toHaveBeenCalled();
  });

  it("traite les rappels RAPPEL_ALIMENTATION et RAPPEL_BIOMETRIE", async () => {
    mockConfigAlerte.findMany.mockResolvedValue([
      { ...BASE_CONFIG, typeAlerte: "RAPPEL_ALIMENTATION" },
      { ...BASE_CONFIG, id: "config-bio", typeAlerte: "RAPPEL_BIOMETRIE", seuilValeur: 7 },
    ]);
    // Releve alimentation existe — pas de rappel
    mockReleve.findFirst.mockResolvedValue({ id: "releve-1" });

    await verifierAlertes(SITE_ID, USER_ID);

    expect(mockReleve.findFirst).toHaveBeenCalledTimes(2);
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });
});
