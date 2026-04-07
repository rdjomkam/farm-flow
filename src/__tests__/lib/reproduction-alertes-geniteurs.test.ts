/**
 * Tests unitaires — Alertes geniteurs du module Reproduction (R4)
 *
 * Fichier source : src/lib/alertes/reproduction.ts
 *
 * Couvre :
 *   - checkMalesStockBasAlerts     : alerte stock de males insuffisant
 *   - checkFemelleSurexploiteeAlerts : alerte femelle ponte trop recente (< 42j)
 *   - checkConsanguiniteRisqueAlerts : alerte couple utilise > 3 fois
 *
 * Prisma est integralement moque pour isoler la logique metier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkMalesStockBasAlerts,
  checkFemelleSurexploiteeAlerts,
  checkConsanguiniteRisqueAlerts,
} from "@/lib/alertes/reproduction";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockLotGeniteursFindMany = vi.fn();
const mockReproducteurFindMany = vi.fn();
const mockPonteFindMany = vi.fn();
const mockSiteMemberFindMany = vi.fn();
const mockNotificationCount = vi.fn();
const mockNotificationCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    lotGeniteurs: {
      findMany: (...args: unknown[]) => mockLotGeniteursFindMany(...args),
    },
    reproducteur: {
      findMany: (...args: unknown[]) => mockReproducteurFindMany(...args),
    },
    ponte: {
      findMany: (...args: unknown[]) => mockPonteFindMany(...args),
    },
    siteMember: {
      findMany: (...args: unknown[]) => mockSiteMemberFindMany(...args),
    },
    notification: {
      count: (...args: unknown[]) => mockNotificationCount(...args),
      create: (...args: unknown[]) => mockNotificationCreate(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Constantes de test
// ---------------------------------------------------------------------------

const SITE_ID = "site-test-001";
const USER_A = "user-admin-001";
const USER_B = "user-gerant-001";

const MEMBRES_SITE = [{ userId: USER_A }, { userId: USER_B }];

// ---------------------------------------------------------------------------
// checkMalesStockBasAlerts
// ---------------------------------------------------------------------------

describe("checkMalesStockBasAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cree une notification quand nombreMalesDisponibles <= seuilAlerteMales", async () => {
    mockLotGeniteursFindMany.mockResolvedValue([
      {
        id: "lot-gen-001",
        code: "LG-001",
        nom: "Lot Males A",
        nombreMalesDisponibles: 1,
        seuilAlerteMales: 2,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue(MEMBRES_SITE);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkMalesStockBasAlerts(SITE_ID);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.typeAlerte).toBe("MALES_STOCK_BAS");
    expect(args.data.statut).toBe("ACTIVE");
    expect(args.data.siteId).toBe(SITE_ID);
  });

  it("utilise le seuil par defaut de 2 quand seuilAlerteMales est null", async () => {
    mockLotGeniteursFindMany.mockResolvedValue([
      {
        id: "lot-gen-002",
        code: "LG-002",
        nom: "Lot Males B",
        nombreMalesDisponibles: 2, // exactement egal au seuil defaut (2) => alerte
        seuilAlerteMales: null,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkMalesStockBasAlerts(SITE_ID);

    // 2 <= 2 (seuil defaut) => alerte creee
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.message).toContain("seuil d'alerte de 2");
  });

  it("ne cree pas de notification quand nombreMalesDisponibles > seuilAlerteMales", async () => {
    mockLotGeniteursFindMany.mockResolvedValue([
      {
        id: "lot-gen-003",
        code: "LG-003",
        nom: "Lot Males C",
        nombreMalesDisponibles: 5,
        seuilAlerteMales: 3,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue(MEMBRES_SITE);

    await checkMalesStockBasAlerts(SITE_ID);

    // Pas d'alerte creee meme si les membres ont ete recuperes
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("ne cree pas de doublon si une notification ACTIVE existe deja aujourd'hui", async () => {
    mockLotGeniteursFindMany.mockResolvedValue([
      {
        id: "lot-gen-004",
        code: "LG-004",
        nom: "Lot Males D",
        nombreMalesDisponibles: 0,
        seuilAlerteMales: 2,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    // Notification existante
    mockNotificationCount.mockResolvedValue(1);

    await checkMalesStockBasAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("notifie tous les membres du site", async () => {
    mockLotGeniteursFindMany.mockResolvedValue([
      {
        id: "lot-gen-005",
        code: "LG-005",
        nom: "Lot Males E",
        nombreMalesDisponibles: 1,
        seuilAlerteMales: 3,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue(MEMBRES_SITE);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkMalesStockBasAlerts(SITE_ID);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
    const userIds = mockNotificationCreate.mock.calls.map(
      (call) => call[0].data.userId
    );
    expect(userIds).toContain(USER_A);
    expect(userIds).toContain(USER_B);
  });

  it("ne cree aucune notification si aucun lot geniteur en stock bas", async () => {
    mockLotGeniteursFindMany.mockResolvedValue([]);

    await checkMalesStockBasAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
    expect(mockSiteMemberFindMany).not.toHaveBeenCalled();
  });

  it("inclut le lien vers le lot de geniteurs dans la notification", async () => {
    mockLotGeniteursFindMany.mockResolvedValue([
      {
        id: "lot-gen-006",
        code: "LG-006",
        nom: "Lot Males F",
        nombreMalesDisponibles: 0,
        seuilAlerteMales: null,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkMalesStockBasAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.lien).toBe("/reproduction/geniteurs/lot-gen-006");
  });

  it("cree seulement pour les membres sans doublon (deduplication selective)", async () => {
    mockLotGeniteursFindMany.mockResolvedValue([
      {
        id: "lot-gen-007",
        code: "LG-007",
        nom: "Lot Males G",
        nombreMalesDisponibles: 1,
        seuilAlerteMales: 2,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue(MEMBRES_SITE);
    // USER_A a deja une notification, USER_B n'en a pas
    mockNotificationCount
      .mockResolvedValueOnce(1)  // USER_A : doublon
      .mockResolvedValueOnce(0); // USER_B : nouvelle
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkMalesStockBasAlerts(SITE_ID);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    expect(mockNotificationCreate.mock.calls[0][0].data.userId).toBe(USER_B);
  });
});

// ---------------------------------------------------------------------------
// checkFemelleSurexploiteeAlerts
// ---------------------------------------------------------------------------

describe("checkFemelleSurexploiteeAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cree une notification quand dernierePonte < 42 jours", async () => {
    const maintenant = new Date();
    const il_y_a_30_jours = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);

    mockReproducteurFindMany.mockResolvedValue([
      {
        id: "fem-001",
        code: "FEM-001",
        dernierePonte: il_y_a_30_jours,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue(MEMBRES_SITE);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkFemelleSurexploiteeAlerts(SITE_ID);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.typeAlerte).toBe("FEMELLE_SUREXPLOITEE");
    expect(args.data.statut).toBe("ACTIVE");
  });

  it("ne cree pas de notification quand dernierePonte >= 42 jours", async () => {
    // La femelle a ponte il y a exactement 42 jours : la requete Prisma
    // filtre deja en amont, donc findMany renvoie un tableau vide.
    mockReproducteurFindMany.mockResolvedValue([]);

    await checkFemelleSurexploiteeAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
    expect(mockSiteMemberFindMany).not.toHaveBeenCalled();
  });

  it("ne cree pas d'alerte pour les reproductrices non ACTIF", async () => {
    // La requete Prisma filtre statut = ACTIF, donc les non-ACTIF ne sont pas retournes.
    mockReproducteurFindMany.mockResolvedValue([]);

    await checkFemelleSurexploiteeAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("n'alerte que les FEMELLE (filtre sexe dans la requete Prisma)", async () => {
    // Si la requete Prisma filtre sexe = FEMELLE, les males ne sont jamais retournes.
    // On verifie que le filtre est bien passe en examinant le premier argument de findMany.
    const maintenant = new Date();
    const il_y_a_10_jours = new Date(maintenant.getTime() - 10 * 24 * 60 * 60 * 1000);

    mockReproducteurFindMany.mockResolvedValue([
      {
        id: "fem-002",
        code: "FEM-002",
        dernierePonte: il_y_a_10_jours,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkFemelleSurexploiteeAlerts(SITE_ID);

    // Verifier que la requete Prisma inclut le filtre sexe = FEMELLE
    const queryArgs = mockReproducteurFindMany.mock.calls[0][0];
    expect(queryArgs.where.sexe).toBe("FEMELLE");
    expect(queryArgs.where.statut).toBe("ACTIF");
  });

  it("ne cree pas de doublon si notification ACTIVE existe deja pour cette femelle", async () => {
    const maintenant = new Date();
    const il_y_a_20_jours = new Date(maintenant.getTime() - 20 * 24 * 60 * 60 * 1000);

    mockReproducteurFindMany.mockResolvedValue([
      {
        id: "fem-003",
        code: "FEM-003",
        dernierePonte: il_y_a_20_jours,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(1); // doublon

    await checkFemelleSurexploiteeAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("inclut le nombre de jours depuis la derniere ponte dans le message", async () => {
    const maintenant = new Date();
    const il_y_a_15_jours = new Date(maintenant.getTime() - 15 * 24 * 60 * 60 * 1000);

    mockReproducteurFindMany.mockResolvedValue([
      {
        id: "fem-004",
        code: "FEM-004",
        dernierePonte: il_y_a_15_jours,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkFemelleSurexploiteeAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.message).toContain("15 jour");
    expect(args.data.message).toContain("42 jours");
  });

  it("inclut le lien vers la page de la femelle", async () => {
    const maintenant = new Date();
    const il_y_a_5_jours = new Date(maintenant.getTime() - 5 * 24 * 60 * 60 * 1000);

    mockReproducteurFindMany.mockResolvedValue([
      {
        id: "fem-005",
        code: "FEM-005",
        dernierePonte: il_y_a_5_jours,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkFemelleSurexploiteeAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.lien).toBe("/reproduction/geniteurs/fem-005");
  });

  it("gere plusieurs femelles surexploitees simultanement", async () => {
    const maintenant = new Date();
    const il_y_a_10_jours = new Date(maintenant.getTime() - 10 * 24 * 60 * 60 * 1000);
    const il_y_a_25_jours = new Date(maintenant.getTime() - 25 * 24 * 60 * 60 * 1000);

    mockReproducteurFindMany.mockResolvedValue([
      { id: "fem-A", code: "FEM-A", dernierePonte: il_y_a_10_jours },
      { id: "fem-B", code: "FEM-B", dernierePonte: il_y_a_25_jours },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkFemelleSurexploiteeAlerts(SITE_ID);

    // 2 femelles x 1 membre = 2 notifications
    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
  });

  it("ne cree aucune notification si aucune femelle surexploitee", async () => {
    mockReproducteurFindMany.mockResolvedValue([]);

    await checkFemelleSurexploiteeAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
    expect(mockSiteMemberFindMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// checkConsanguiniteRisqueAlerts
// ---------------------------------------------------------------------------

describe("checkConsanguiniteRisqueAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cree une notification quand le meme couple est utilise > 3 fois", async () => {
    mockPonteFindMany.mockResolvedValue([
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" }, // 4 fois => alerte
    ]);
    mockSiteMemberFindMany.mockResolvedValue(MEMBRES_SITE);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkConsanguiniteRisqueAlerts(SITE_ID);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(2); // 2 membres
    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.typeAlerte).toBe("CONSANGUINITE_RISQUE");
    expect(args.data.statut).toBe("ACTIVE");
  });

  it("ne cree pas de notification quand le couple est utilise <= 3 fois", async () => {
    mockPonteFindMany.mockResolvedValue([
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" }, // exactement 3 fois => pas d'alerte
    ]);

    await checkConsanguiniteRisqueAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
    expect(mockSiteMemberFindMany).not.toHaveBeenCalled();
  });

  it("ne cree pas de notification quand le couple est utilise exactement 1 fois", async () => {
    mockPonteFindMany.mockResolvedValue([
      { femelleId: "fem-2", maleId: "male-2" },
    ]);

    await checkConsanguiniteRisqueAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("deduplique par cle couple dans le lien", async () => {
    mockPonteFindMany.mockResolvedValue([
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" }, // 4 fois
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    // Notification existe deja pour cette cle
    mockNotificationCount.mockResolvedValue(1);

    await checkConsanguiniteRisqueAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
    // Verifier que le lien passe a la deduplication contient bien la cle couple
    const countArgs = mockNotificationCount.mock.calls[0][0];
    expect(countArgs.where.lien).toContain("fem-1-male-1");
  });

  it("ignore les pontes avec maleId null", async () => {
    mockPonteFindMany.mockResolvedValue([
      { femelleId: "fem-1", maleId: null },
      { femelleId: "fem-1", maleId: null },
      { femelleId: "fem-1", maleId: null },
      { femelleId: "fem-1", maleId: null }, // null maleId => ignore
    ]);

    await checkConsanguiniteRisqueAlerts(SITE_ID);

    // Couples null ne sont pas comptes
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("gere correctement plusieurs couples differents avec des comptages differents", async () => {
    mockPonteFindMany.mockResolvedValue([
      // Couple A : 5 fois => alerte
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" },
      { femelleId: "fem-1", maleId: "male-1" },
      // Couple B : 2 fois => pas d'alerte
      { femelleId: "fem-2", maleId: "male-2" },
      { femelleId: "fem-2", maleId: "male-2" },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkConsanguiniteRisqueAlerts(SITE_ID);

    // Seulement le couple A declenche une alerte (1 couple x 1 membre = 1 notif)
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
  });

  it("inclut le nombre d'utilisations du couple dans le message", async () => {
    mockPonteFindMany.mockResolvedValue([
      { femelleId: "fem-3", maleId: "male-3" },
      { femelleId: "fem-3", maleId: "male-3" },
      { femelleId: "fem-3", maleId: "male-3" },
      { femelleId: "fem-3", maleId: "male-3" },
      { femelleId: "fem-3", maleId: "male-3" }, // 5 fois
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkConsanguiniteRisqueAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.message).toContain("5 fois");
  });

  it("ne cree aucune notification si aucune ponte", async () => {
    mockPonteFindMany.mockResolvedValue([]);

    await checkConsanguiniteRisqueAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
    expect(mockSiteMemberFindMany).not.toHaveBeenCalled();
  });

  it("notifie tous les membres du site pour un couple a risque", async () => {
    mockPonteFindMany.mockResolvedValue([
      { femelleId: "fem-4", maleId: "male-4" },
      { femelleId: "fem-4", maleId: "male-4" },
      { femelleId: "fem-4", maleId: "male-4" },
      { femelleId: "fem-4", maleId: "male-4" },
    ]);
    mockSiteMemberFindMany.mockResolvedValue(MEMBRES_SITE);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkConsanguiniteRisqueAlerts(SITE_ID);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
    const userIds = mockNotificationCreate.mock.calls.map(
      (call) => call[0].data.userId
    );
    expect(userIds).toContain(USER_A);
    expect(userIds).toContain(USER_B);
  });
});
