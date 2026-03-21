/**
 * Tests unitaires — src/lib/services/remises-automatiques.ts (Sprint 35)
 *
 * Couvre :
 * - Premier abonnement + remise EARLY_ADOPTER active → remise appliquée
 * - Deuxième abonnement → pas de remise automatique
 * - Pas de remise EARLY_ADOPTER active → null
 *
 * Story 35.4 — Sprint 35
 * R2 : enums importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifierEtAppliquerRemiseAutomatique } from "@/lib/services/remises-automatiques";
import { TypeRemise } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaAbonnementCount = vi.fn();
const mockPrismaRemiseFindMany = vi.fn();
const mockPrismaAbonnementFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    abonnement: {
      count: (...args: unknown[]) => mockPrismaAbonnementCount(...args),
      findUnique: (...args: unknown[]) => mockPrismaAbonnementFindUnique(...args),
    },
    remise: {
      findMany: (...args: unknown[]) => mockPrismaRemiseFindMany(...args),
    },
  },
}));

const mockAppliquerRemise = vi.fn();
vi.mock("@/lib/queries/remises", () => ({
  appliquerRemise: (...args: unknown[]) => mockAppliquerRemise(...args),
}));

// ---------------------------------------------------------------------------
// Données de test
// ---------------------------------------------------------------------------

const REMISE_EARLY = {
  id: "remise-early-1",
  nom: "Early Adopter 2026",
  code: "EARLY2026",
  type: TypeRemise.EARLY_ADOPTER,
  valeur: "2000",
  estPourcentage: false,
  dateDebut: new Date("2026-01-01"),
  dateFin: new Date("2026-12-31"),
  limiteUtilisations: null, // illimitée
  nombreUtilisations: 5,
  isActif: true,
  siteId: null,
};

const ABONNEMENT = {
  id: "abo-1",
  prixPaye: "3000",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("verifierEtAppliquerRemiseAutomatique", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applique la remise EARLY_ADOPTER lors du premier abonnement", async () => {
    // Pas d'abonnements précédents
    mockPrismaAbonnementCount.mockResolvedValue(0);
    // Une remise EARLY_ADOPTER active disponible
    mockPrismaRemiseFindMany.mockResolvedValue([REMISE_EARLY]);
    // L'abonnement existe avec un prix payé
    mockPrismaAbonnementFindUnique.mockResolvedValue(ABONNEMENT);
    mockAppliquerRemise.mockResolvedValue({ id: "application-1" });

    const result = await verifierEtAppliquerRemiseAutomatique("site-1", "abo-1", "user-1");

    expect(result).not.toBeNull();
    expect(result?.code).toBe("EARLY2026");
    // appliquerRemise a été appelé avec les bons arguments
    expect(mockAppliquerRemise).toHaveBeenCalledWith(
      "remise-early-1",
      "abo-1",
      "user-1",
      2000 // montant fixe, min(2000, 3000)
    );
  });

  it("ne pas appliquer la remise si ce n'est pas le premier abonnement", async () => {
    // Un abonnement précédent existe
    mockPrismaAbonnementCount.mockResolvedValue(1);

    const result = await verifierEtAppliquerRemiseAutomatique("site-1", "abo-2", "user-1");

    expect(result).toBeNull();
    expect(mockPrismaRemiseFindMany).not.toHaveBeenCalled();
    expect(mockAppliquerRemise).not.toHaveBeenCalled();
  });

  it("retourne null si aucune remise EARLY_ADOPTER active", async () => {
    // Premier abonnement
    mockPrismaAbonnementCount.mockResolvedValue(0);
    // Aucune remise active
    mockPrismaRemiseFindMany.mockResolvedValue([]);

    const result = await verifierEtAppliquerRemiseAutomatique("site-1", "abo-1", "user-1");

    expect(result).toBeNull();
    expect(mockAppliquerRemise).not.toHaveBeenCalled();
  });

  it("filtre les remises dont la limite d'utilisations est atteinte", async () => {
    mockPrismaAbonnementCount.mockResolvedValue(0);
    // Remise avec limite atteinte
    const remiseLimitAtteinte = {
      ...REMISE_EARLY,
      limiteUtilisations: 10,
      nombreUtilisations: 10, // limite atteinte
    };
    mockPrismaRemiseFindMany.mockResolvedValue([remiseLimitAtteinte]);

    const result = await verifierEtAppliquerRemiseAutomatique("site-1", "abo-1", "user-1");

    expect(result).toBeNull();
    expect(mockAppliquerRemise).not.toHaveBeenCalled();
  });

  it("applique la remise pourcentage correctement", async () => {
    mockPrismaAbonnementCount.mockResolvedValue(0);
    const remisePct = { ...REMISE_EARLY, valeur: "20", estPourcentage: true };
    mockPrismaRemiseFindMany.mockResolvedValue([remisePct]);
    mockPrismaAbonnementFindUnique.mockResolvedValue({ ...ABONNEMENT, prixPaye: "10000" });
    mockAppliquerRemise.mockResolvedValue({ id: "app-pct" });

    const result = await verifierEtAppliquerRemiseAutomatique("site-1", "abo-1", "user-1");

    expect(result).not.toBeNull();
    // 20% de 10000 = 2000
    expect(mockAppliquerRemise).toHaveBeenCalledWith(
      "remise-early-1",
      "abo-1",
      "user-1",
      2000
    );
  });

  it("retourne null sans lever d'exception en cas d'erreur (fire-and-forget)", async () => {
    mockPrismaAbonnementCount.mockRejectedValue(new Error("DB error"));

    // Ne doit pas lever d'exception
    const result = await verifierEtAppliquerRemiseAutomatique("site-1", "abo-1", "user-1");
    expect(result).toBeNull();
  });
});
