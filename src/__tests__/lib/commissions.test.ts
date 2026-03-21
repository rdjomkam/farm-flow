/**
 * Tests unitaires — src/lib/services/commissions.ts (Sprint 34)
 *
 * Couvre :
 * - calculerEtCreerCommission() — site supervisé → commission 10%
 * - calculerEtCreerCommission() — site non supervisé → null
 * - calculerEtCreerCommission() — ingénieur COMMISSION_PREMIUM → 20%
 * - calculerEtCreerCommission() — idempotence (même paiementId = pas de doublon)
 * - calculerEtCreerCommission() — pas d'ingénieur membre → null
 * - rendreCommissionsDisponiblesCron() — délègue à rendreCommissionsDisponibles
 *
 * Story 34.5 — Sprint 34
 * R2 : enums importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculerEtCreerCommission, rendreCommissionsDisponiblesCron } from "@/lib/services/commissions";
import { Permission, Role, StatutCommissionIng } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaSiteFindUnique = vi.fn();
const mockPrismaSiteMemberFindFirst = vi.fn();
const mockPrismaCommissionFindFirst = vi.fn();
const mockPrismaPaiementFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    site: {
      findUnique: (...args: unknown[]) => mockPrismaSiteFindUnique(...args),
    },
    siteMember: {
      findFirst: (...args: unknown[]) => mockPrismaSiteMemberFindFirst(...args),
    },
    commissionIngenieur: {
      findFirst: (...args: unknown[]) => mockPrismaCommissionFindFirst(...args),
    },
    paiementAbonnement: {
      findUnique: (...args: unknown[]) => mockPrismaPaiementFindUnique(...args),
    },
  },
}));

const mockCreateCommission = vi.fn();
const mockRendreCommissionsDisponibles = vi.fn();

vi.mock("@/lib/queries/commissions", () => ({
  createCommission: (...args: unknown[]) => mockCreateCommission(...args),
  rendreCommissionsDisponibles: (...args: unknown[]) => mockRendreCommissionsDisponibles(...args),
}));

vi.mock("@/lib/queries/sites", () => ({
  getPlatformSite: vi.fn().mockResolvedValue({ id: "site-platform", name: "DKFarm", isPlatform: true }),
  isPlatformSite: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Données de test
// ---------------------------------------------------------------------------

const SITE_SUPERVISE = { id: "site-client-1", supervised: true };
const SITE_NON_SUPERVISE = { id: "site-client-2", supervised: false };

const MEMBRE_STANDARD = {
  user: { id: "ing-1", role: Role.INGENIEUR },
  siteRole: {
    id: "role-1",
    permissions: [Permission.COMMISSIONS_VOIR] as Permission[],
  },
};

const MEMBRE_PREMIUM = {
  user: { id: "ing-2", role: Role.INGENIEUR },
  siteRole: {
    id: "role-2",
    permissions: [Permission.COMMISSIONS_VOIR, Permission.COMMISSION_PREMIUM] as Permission[],
  },
};

const PAIEMENT = {
  id: "paiement-1",
  montant: "10000",
  siteId: "site-dkfarm-1",
  abonnement: {
    dateDebut: new Date("2026-03-01"),
    dateFin: new Date("2026-04-01"),
  },
};

const COMMISSION_CREEE = {
  id: "commission-1",
  montant: "1000",
  taux: "0.10",
  statut: StatutCommissionIng.EN_ATTENTE,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculerEtCreerCommission()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCommission.mockResolvedValue(COMMISSION_CREEE);
    mockRendreCommissionsDisponibles.mockResolvedValue({ count: 0 });
  });

  it("site supervisé + ingénieur standard → commission 10% créée", async () => {
    mockPrismaSiteFindUnique.mockResolvedValue(SITE_SUPERVISE);
    mockPrismaSiteMemberFindFirst.mockResolvedValue(MEMBRE_STANDARD);
    mockPrismaCommissionFindFirst.mockResolvedValue(null); // Pas de doublon
    mockPrismaPaiementFindUnique.mockResolvedValue(PAIEMENT);
    mockCreateCommission.mockResolvedValue({ ...COMMISSION_CREEE, montant: "1000", taux: "0.10" });

    const result = await calculerEtCreerCommission("abo-1", "paiement-1", "site-client-1");

    expect(result).not.toBeNull();
    expect(result?.taux).toBe(0.1); // 10%
    expect(result?.montant).toBe(1000); // 10000 * 0.10
    expect(result?.ingenieurId).toBe("ing-1");

    // Vérifier que createCommission a été appelé avec le bon taux
    expect(mockCreateCommission).toHaveBeenCalledWith(
      expect.objectContaining({ taux: 0.1, montant: 1000 })
    );
  });

  it("site non supervisé → null (pas de commission)", async () => {
    mockPrismaSiteFindUnique.mockResolvedValue(SITE_NON_SUPERVISE);

    const result = await calculerEtCreerCommission("abo-1", "paiement-1", "site-client-2");

    expect(result).toBeNull();
    expect(mockCreateCommission).not.toHaveBeenCalled();
  });

  it("site supervisé + ingénieur COMMISSION_PREMIUM → commission 20%", async () => {
    mockPrismaSiteFindUnique.mockResolvedValue(SITE_SUPERVISE);
    mockPrismaSiteMemberFindFirst.mockResolvedValue(MEMBRE_PREMIUM);
    mockPrismaCommissionFindFirst.mockResolvedValue(null);
    mockPrismaPaiementFindUnique.mockResolvedValue(PAIEMENT);
    mockCreateCommission.mockResolvedValue({ ...COMMISSION_CREEE, montant: "2000", taux: "0.20" });

    const result = await calculerEtCreerCommission("abo-1", "paiement-1", "site-client-1");

    expect(result).not.toBeNull();
    expect(result?.taux).toBe(0.2); // 20%
    expect(mockCreateCommission).toHaveBeenCalledWith(
      expect.objectContaining({ taux: 0.2 })
    );
  });

  it("idempotence — commission déjà créée pour ce paiementId → null (pas de doublon)", async () => {
    mockPrismaSiteFindUnique.mockResolvedValue(SITE_SUPERVISE);
    mockPrismaSiteMemberFindFirst.mockResolvedValue(MEMBRE_STANDARD);
    // Commission déjà existante pour ce paiement
    mockPrismaCommissionFindFirst.mockResolvedValue({ id: "commission-existante" });

    const result = await calculerEtCreerCommission("abo-1", "paiement-1", "site-client-1");

    expect(result).toBeNull();
    expect(mockCreateCommission).not.toHaveBeenCalled();
  });

  it("pas d'ingénieur membre actif → null", async () => {
    mockPrismaSiteFindUnique.mockResolvedValue(SITE_SUPERVISE);
    mockPrismaSiteMemberFindFirst.mockResolvedValue(null); // Pas d'ingénieur

    const result = await calculerEtCreerCommission("abo-1", "paiement-1", "site-client-1");

    expect(result).toBeNull();
    expect(mockCreateCommission).not.toHaveBeenCalled();
  });

  it("site inexistant → null (gestion d'erreur silencieuse)", async () => {
    mockPrismaSiteFindUnique.mockResolvedValue(null);

    const result = await calculerEtCreerCommission("abo-1", "paiement-1", "site-inexistant");

    expect(result).toBeNull();
  });

  it("erreur DB → retourne null sans propager (fire-and-forget)", async () => {
    mockPrismaSiteFindUnique.mockRejectedValue(new Error("DB connection error"));

    // Ne doit pas lancer d'exception
    await expect(
      calculerEtCreerCommission("abo-1", "paiement-1", "site-client-1")
    ).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// rendreCommissionsDisponiblesCron()
// ---------------------------------------------------------------------------

describe("rendreCommissionsDisponiblesCron()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("délègue à rendreCommissionsDisponibles avec date J-30", async () => {
    mockRendreCommissionsDisponibles.mockResolvedValue({ count: 3 });

    const result = await rendreCommissionsDisponiblesCron();

    expect(result).toBe(3);
    expect(mockRendreCommissionsDisponibles).toHaveBeenCalledOnce();

    // Vérifier que la date passée est approximativement J-30
    const callArgs = mockRendreCommissionsDisponibles.mock.calls[0] as [Date];
    const datePassee = callArgs[0];
    const now = new Date();
    const diff = now.getTime() - datePassee.getTime();
    const diffDays = diff / (1000 * 60 * 60 * 24);

    // La date doit être entre 29 et 31 jours dans le passé
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });

  it("retourne 0 si aucune commission à rendre disponible", async () => {
    mockRendreCommissionsDisponibles.mockResolvedValue({ count: 0 });

    const result = await rendreCommissionsDisponiblesCron();

    expect(result).toBe(0);
  });
});
