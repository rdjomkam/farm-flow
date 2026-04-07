/**
 * Tests unitaires — Alertes du module Reproduction (R3-S13 / R3-S14)
 *
 * Fichier source : src/lib/alertes/reproduction.ts
 *
 * Couvre :
 *   - checkIncubationEclosionAlerts : alerte eclosion imminente (fenetre 2h)
 *   - checkLotSurvieAlerts          : alerte taux de survie critique
 *
 * Prisma est integralement moque pour isoler la logique metier.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkIncubationEclosionAlerts,
  checkLotSurvieAlerts,
} from "@/lib/alertes/reproduction";

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockIncubationFindMany = vi.fn();
const mockLotAlevinsFindMany = vi.fn();
const mockSiteMemberFindMany = vi.fn();
const mockConfigAlerteFindMany = vi.fn();
const mockNotificationCount = vi.fn();
const mockNotificationCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    incubation: {
      findMany: (...args: unknown[]) => mockIncubationFindMany(...args),
    },
    lotAlevins: {
      findMany: (...args: unknown[]) => mockLotAlevinsFindMany(...args),
    },
    siteMember: {
      findMany: (...args: unknown[]) => mockSiteMemberFindMany(...args),
    },
    configAlerte: {
      findMany: (...args: unknown[]) => mockConfigAlerteFindMany(...args),
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

// Membres du site utilises dans la plupart des tests
const MEMBRES_SITE = [{ userId: USER_A }, { userId: USER_B }];

// ---------------------------------------------------------------------------
// checkIncubationEclosionAlerts
// ---------------------------------------------------------------------------

describe("checkIncubationEclosionAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cree une notification pour chaque membre quand une incubation approche de l'eclosion", async () => {
    const maintenant = new Date();
    const dans1h = new Date(maintenant.getTime() + 60 * 60 * 1000);

    mockIncubationFindMany.mockResolvedValue([
      {
        id: "incub-001",
        code: "INC-001",
        dateEclosionPrevue: dans1h,
        ponte: { code: "PONTE-001" },
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue(MEMBRES_SITE);
    // Aucune notification existante
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkIncubationEclosionAlerts(SITE_ID);

    // 2 membres → 2 notifications crees
    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
  });

  it("inclut le bon typeAlerte INCUBATION_ECLOSION dans la notification", async () => {
    const maintenant = new Date();
    const dans30min = new Date(maintenant.getTime() + 30 * 60 * 1000);

    mockIncubationFindMany.mockResolvedValue([
      {
        id: "incub-001",
        code: "INC-001",
        dateEclosionPrevue: dans30min,
        ponte: { code: "PONTE-001" },
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkIncubationEclosionAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.typeAlerte).toBe("INCUBATION_ECLOSION");
    expect(args.data.statut).toBe("ACTIVE");
    expect(args.data.siteId).toBe(SITE_ID);
  });

  it("inclut le code de l'incubation dans le titre de la notification", async () => {
    const maintenant = new Date();
    const dans45min = new Date(maintenant.getTime() + 45 * 60 * 1000);

    mockIncubationFindMany.mockResolvedValue([
      {
        id: "incub-002",
        code: "INC-002",
        dateEclosionPrevue: dans45min,
        ponte: null,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkIncubationEclosionAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.titre).toContain("INC-002");
  });

  it("inclut le code de la ponte dans le message quand presente", async () => {
    const maintenant = new Date();
    const dans1h = new Date(maintenant.getTime() + 60 * 60 * 1000);

    mockIncubationFindMany.mockResolvedValue([
      {
        id: "incub-003",
        code: "INC-003",
        dateEclosionPrevue: dans1h,
        ponte: { code: "PONTE-007" },
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkIncubationEclosionAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.message).toContain("PONTE-007");
  });

  it("inclut le lien vers la page de l'incubation", async () => {
    const maintenant = new Date();
    const dans1h = new Date(maintenant.getTime() + 60 * 60 * 1000);

    mockIncubationFindMany.mockResolvedValue([
      {
        id: "incub-004",
        code: "INC-004",
        dateEclosionPrevue: dans1h,
        ponte: null,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkIncubationEclosionAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.lien).toBe("/reproduction/incubations/incub-004");
  });

  it("ne cree aucune notification quand aucune incubation n'approche", async () => {
    mockIncubationFindMany.mockResolvedValue([]);

    await checkIncubationEclosionAlerts(SITE_ID);

    expect(mockSiteMemberFindMany).not.toHaveBeenCalled();
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("ne cree pas de doublon si une notification existe deja aujourd'hui pour ce membre", async () => {
    const maintenant = new Date();
    const dans1h = new Date(maintenant.getTime() + 60 * 60 * 1000);

    mockIncubationFindMany.mockResolvedValue([
      {
        id: "incub-005",
        code: "INC-005",
        dateEclosionPrevue: dans1h,
        ponte: null,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    // Notification existe deja
    mockNotificationCount.mockResolvedValue(1);

    await checkIncubationEclosionAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("cree la notification uniquement pour les membres sans doublon", async () => {
    const maintenant = new Date();
    const dans1h = new Date(maintenant.getTime() + 60 * 60 * 1000);

    mockIncubationFindMany.mockResolvedValue([
      {
        id: "incub-006",
        code: "INC-006",
        dateEclosionPrevue: dans1h,
        ponte: null,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue(MEMBRES_SITE);
    // Premier membre : doublon, second : pas de doublon
    mockNotificationCount
      .mockResolvedValueOnce(1)  // USER_A : existe deja
      .mockResolvedValueOnce(0); // USER_B : nouvelle notification
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkIncubationEclosionAlerts(SITE_ID);

    // Seulement USER_B recoit une nouvelle notification
    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.userId).toBe(USER_B);
  });

  it("gere plusieurs incubations simultanees approchant de l'eclosion", async () => {
    const maintenant = new Date();
    const dans30min = new Date(maintenant.getTime() + 30 * 60 * 1000);
    const dans90min = new Date(maintenant.getTime() + 90 * 60 * 1000);

    mockIncubationFindMany.mockResolvedValue([
      {
        id: "incub-A",
        code: "INC-A",
        dateEclosionPrevue: dans30min,
        ponte: null,
      },
      {
        id: "incub-B",
        code: "INC-B",
        dateEclosionPrevue: dans90min,
        ponte: { code: "PONTE-002" },
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkIncubationEclosionAlerts(SITE_ID);

    // 2 incubations × 1 membre = 2 notifications
    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
  });

  it("exprime le temps en heures si >= 1h restante", async () => {
    const maintenant = new Date();
    const dans1h30 = new Date(maintenant.getTime() + 90 * 60 * 1000);

    mockIncubationFindMany.mockResolvedValue([
      {
        id: "incub-007",
        code: "INC-007",
        dateEclosionPrevue: dans1h30,
        ponte: null,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkIncubationEclosionAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    // Le message doit exprimer le temps en heures (ex: "dans 2h")
    expect(args.data.message).toMatch(/dans \d+h/);
  });

  it("exprime le temps en minutes si < 1h restante (moins de 30 min)", async () => {
    const maintenant = new Date();
    // 20 minutes restantes : Math.round(20/60) = 0, donc heuresRestantes < 1 → format "X min"
    const dans20min = new Date(maintenant.getTime() + 20 * 60 * 1000);

    mockIncubationFindMany.mockResolvedValue([
      {
        id: "incub-008",
        code: "INC-008",
        dateEclosionPrevue: dans20min,
        ponte: null,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkIncubationEclosionAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    // Le message doit exprimer le temps en minutes (ex: "dans 20 min")
    expect(args.data.message).toMatch(/dans \d+ min/);
  });
});

// ---------------------------------------------------------------------------
// checkLotSurvieAlerts
// ---------------------------------------------------------------------------

describe("checkLotSurvieAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Avec configuration TAUX_SURVIE_CRITIQUE_LOT ---

  it("cree une notification quand taux de survie passe sous le seuil configure", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: 70,
        seuilValeur: null,
      },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-001",
        code: "LOT-001",
        nombreInitial: 1000,
        nombreActuel: 600, // taux = 60% < 70%
        ponte: { code: "PONTE-001" },
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkLotSurvieAlerts(SITE_ID);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.typeAlerte).toBe("TAUX_SURVIE_CRITIQUE_LOT");
    expect(args.data.statut).toBe("ACTIVE");
    expect(args.data.userId).toBe(USER_A);
    expect(args.data.siteId).toBe(SITE_ID);
  });

  it("inclut le code du lot et le taux de survie dans le message", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: 70,
        seuilValeur: null,
      },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-002",
        code: "LOT-002",
        nombreInitial: 500,
        nombreActuel: 300, // taux = 60%
        ponte: null,
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkLotSurvieAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.titre).toContain("LOT-002");
    expect(args.data.message).toContain("60.0%");
  });

  it("inclut le lien vers la page du lot", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: 70,
        seuilValeur: null,
      },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-003",
        code: "LOT-003",
        nombreInitial: 1000,
        nombreActuel: 500,
        ponte: null,
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkLotSurvieAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.lien).toBe("/reproduction/lots/lot-003");
  });

  it("ne cree pas de notification si taux de survie au dessus du seuil", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: 70,
        seuilValeur: null,
      },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-004",
        code: "LOT-004",
        nombreInitial: 1000,
        nombreActuel: 800, // taux = 80% > 70%
        ponte: null,
      },
    ]);

    await checkLotSurvieAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("ne cree pas de notification si taux de survie exactement au seuil (70%)", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: 70,
        seuilValeur: null,
      },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-005",
        code: "LOT-005",
        nombreInitial: 1000,
        nombreActuel: 700, // taux = 70% exactement — pas en dessous
        ponte: null,
      },
    ]);

    await checkLotSurvieAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("utilise seuilValeur si seuilPourcentage est null", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: null,
        seuilValeur: 80, // seuil plus strict
      },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-006",
        code: "LOT-006",
        nombreInitial: 1000,
        nombreActuel: 750, // taux = 75% < 80%
        ponte: null,
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkLotSurvieAlerts(SITE_ID);

    expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.message).toContain("80%");
  });

  it("ne cree pas de doublon si notification existe deja aujourd'hui", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: 70,
        seuilValeur: null,
      },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-007",
        code: "LOT-007",
        nombreInitial: 1000,
        nombreActuel: 500, // taux = 50%
        ponte: null,
      },
    ]);
    // Notification deja existante
    mockNotificationCount.mockResolvedValue(1);

    await checkLotSurvieAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  // --- Sans configuration : seuil par defaut 70% ---

  it("utilise le seuil par defaut de 70% quand aucune config n'existe", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([]); // pas de config
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-008",
        code: "LOT-008",
        nombreInitial: 1000,
        nombreActuel: 650, // taux = 65% < 70%
        ponte: null,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue(MEMBRES_SITE);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkLotSurvieAlerts(SITE_ID);

    // Notifier tous les membres du site (2 membres)
    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
  });

  it("inclut le seuil par defaut (70%) dans le message quand aucune config n'existe", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-009",
        code: "LOT-009",
        nombreInitial: 100,
        nombreActuel: 60, // taux = 60%
        ponte: null,
      },
    ]);
    mockSiteMemberFindMany.mockResolvedValue([{ userId: USER_A }]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkLotSurvieAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.message).toContain("70%");
  });

  it("ne cree pas de notification sans config si taux de survie >= 70%", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-010",
        code: "LOT-010",
        nombreInitial: 1000,
        nombreActuel: 750, // taux = 75% >= 70%
        ponte: null,
      },
    ]);

    await checkLotSurvieAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
    // siteMember ne doit pas etre interroge car taux ok
    expect(mockSiteMemberFindMany).not.toHaveBeenCalled();
  });

  it("ne cree aucune notification si aucun lot en elevage", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([]);
    mockLotAlevinsFindMany.mockResolvedValue([]);

    await checkLotSurvieAlerts(SITE_ID);

    expect(mockNotificationCreate).not.toHaveBeenCalled();
    expect(mockSiteMemberFindMany).not.toHaveBeenCalled();
  });

  it("gere plusieurs lots en meme temps avec des taux differents", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: 70,
        seuilValeur: null,
      },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-A",
        code: "LOT-A",
        nombreInitial: 1000,
        nombreActuel: 600, // 60% < 70% → alerte
        ponte: null,
      },
      {
        id: "lot-B",
        code: "LOT-B",
        nombreInitial: 1000,
        nombreActuel: 800, // 80% >= 70% → pas d'alerte
        ponte: null,
      },
      {
        id: "lot-C",
        code: "LOT-C",
        nombreInitial: 500,
        nombreActuel: 200, // 40% < 70% → alerte
        ponte: { code: "PONTE-003" },
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkLotSurvieAlerts(SITE_ID);

    // Seulement lot-A et lot-C declenchent une notification
    expect(mockNotificationCreate).toHaveBeenCalledTimes(2);
  });

  it("inclut le code de la ponte dans le message quand presente", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: 70,
        seuilValeur: null,
      },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-011",
        code: "LOT-011",
        nombreInitial: 1000,
        nombreActuel: 500, // 50%
        ponte: { code: "PONTE-099" },
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkLotSurvieAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.message).toContain("PONTE-099");
  });

  it("formule correctement le taux a 1 decimale dans le message", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: 70,
        seuilValeur: null,
      },
    ]);
    // taux = 333/500 = 66.6%
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-012",
        code: "LOT-012",
        nombreInitial: 500,
        nombreActuel: 333,
        ponte: null,
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkLotSurvieAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.message).toContain("66.6%");
  });

  it("inclut le detail nombreActuel/nombreInitial dans le message", async () => {
    mockConfigAlerteFindMany.mockResolvedValue([
      {
        userId: USER_A,
        seuilPourcentage: 70,
        seuilValeur: null,
      },
    ]);
    mockLotAlevinsFindMany.mockResolvedValue([
      {
        id: "lot-013",
        code: "LOT-013",
        nombreInitial: 2000,
        nombreActuel: 1200, // taux = 60%
        ponte: null,
      },
    ]);
    mockNotificationCount.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue({ id: "notif-new" });

    await checkLotSurvieAlerts(SITE_ID);

    const args = mockNotificationCreate.mock.calls[0][0];
    expect(args.data.message).toContain("1200/2000");
  });
});
