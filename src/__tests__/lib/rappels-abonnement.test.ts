/**
 * Tests unitaires — src/lib/services/rappels-abonnement.ts (Sprint 36)
 *
 * Couvre :
 * - Abonnement expirant dans 7 jours → rappel créé
 * - Abonnement expirant dans 8 jours → pas de rappel (8 pas dans [14,7,3,1])
 * - Abonnement expirant dans 14 jours → rappel créé
 * - Abonnement expirant dans 1 jour → rappel créé
 * - Plan DECOUVERTE → pas de rappel (plan gratuit exclu)
 * - Rappel déjà envoyé aujourd'hui → pas de doublon (creerNotificationSiAbsente gère ça)
 * - Aucun abonnement expirant → { envoyes: 0 }
 *
 * Story 36.2 — Sprint 36
 * R2 : enums importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { envoyerRappelsRenouvellement } from "@/lib/services/rappels-abonnement";
import { TypePlan, StatutAbonnement } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaAbonnementFindMany = vi.fn();
const mockPrismaNotificationCount = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    abonnement: {
      findMany: (...args: unknown[]) => mockPrismaAbonnementFindMany(...args),
    },
    notification: {
      count: (...args: unknown[]) => mockPrismaNotificationCount(...args),
    },
  },
}));

const mockCreerNotificationSiAbsente = vi.fn();
vi.mock("@/lib/alertes", () => ({
  creerNotificationSiAbsente: (...args: unknown[]) =>
    mockCreerNotificationSiAbsente(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construit une date dans N jours à partir d'aujourd'hui (minuit).
 * Reproduit exactement la logique de calculerJoursRestants() du service.
 */
function dansNJours(n: number): Date {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n, 0, 0, 0);
  return date;
}

// ---------------------------------------------------------------------------
// Données de test
// ---------------------------------------------------------------------------

function makeAbonnement(overrides: {
  id?: string;
  dateFin: Date;
  typePlan?: string;
  planNom?: string;
}) {
  return {
    id: overrides.id ?? "abo-1",
    siteId: "site-1",
    userId: "user-1",
    statut: StatutAbonnement.ACTIF,
    dateFin: overrides.dateFin,
    plan: {
      nom: overrides.planNom ?? "Pro Mensuel",
      typePlan: overrides.typePlan ?? TypePlan.PRO,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("envoyerRappelsRenouvellement()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Par défaut : pas de notification existante aujourd'hui
    mockPrismaNotificationCount.mockResolvedValue(0);
    // Par défaut : creerNotificationSiAbsente réussit silencieusement
    mockCreerNotificationSiAbsente.mockResolvedValue(undefined);
  });

  it("abonnement expirant dans 7 jours → rappel créé", async () => {
    const abonnement = makeAbonnement({ dateFin: dansNJours(7) });
    mockPrismaAbonnementFindMany.mockResolvedValue([abonnement]);

    const result = await envoyerRappelsRenouvellement();

    expect(result).toEqual({ envoyes: 1 });
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledOnce();
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.anything(), // TypeAlerte.ABONNEMENT_RAPPEL_RENOUVELLEMENT (enum Prisma)
      "Renouvellement dans 7 jours",
      expect.stringContaining("7 jours"),
      "/abonnement"
    );
  });

  it("abonnement expirant dans 8 jours → pas de rappel (8 hors seuils [14,7,3,1])", async () => {
    const abonnement = makeAbonnement({ dateFin: dansNJours(8) });
    mockPrismaAbonnementFindMany.mockResolvedValue([abonnement]);

    const result = await envoyerRappelsRenouvellement();

    expect(result).toEqual({ envoyes: 0 });
    expect(mockCreerNotificationSiAbsente).not.toHaveBeenCalled();
  });

  it("abonnement expirant dans 14 jours → rappel créé", async () => {
    const abonnement = makeAbonnement({ dateFin: dansNJours(14) });
    mockPrismaAbonnementFindMany.mockResolvedValue([abonnement]);

    const result = await envoyerRappelsRenouvellement();

    expect(result).toEqual({ envoyes: 1 });
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledOnce();
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.anything(),
      "Renouvellement dans 14 jours",
      expect.stringContaining("14 jours"),
      "/abonnement"
    );
  });

  it("abonnement expirant dans 1 jour → rappel créé avec texte singulier", async () => {
    const abonnement = makeAbonnement({ dateFin: dansNJours(1) });
    mockPrismaAbonnementFindMany.mockResolvedValue([abonnement]);

    const result = await envoyerRappelsRenouvellement();

    expect(result).toEqual({ envoyes: 1 });
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledOnce();
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledWith(
      "site-1",
      "user-1",
      expect.anything(),
      "Renouvellement dans 1 jour", // singulier "1 jour"
      expect.stringContaining("1 jour"),
      "/abonnement"
    );
  });

  it("abonnement expirant dans 3 jours → rappel créé", async () => {
    const abonnement = makeAbonnement({ dateFin: dansNJours(3) });
    mockPrismaAbonnementFindMany.mockResolvedValue([abonnement]);

    const result = await envoyerRappelsRenouvellement();

    expect(result).toEqual({ envoyes: 1 });
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledOnce();
  });

  it("plan DECOUVERTE → pas de rappel (plan gratuit exclu)", async () => {
    const abonnement = makeAbonnement({
      dateFin: dansNJours(7),
      typePlan: TypePlan.DECOUVERTE,
      planNom: "Découverte",
    });
    mockPrismaAbonnementFindMany.mockResolvedValue([abonnement]);

    const result = await envoyerRappelsRenouvellement();

    expect(result).toEqual({ envoyes: 0 });
    expect(mockCreerNotificationSiAbsente).not.toHaveBeenCalled();
  });

  it("rappel déjà envoyé aujourd'hui → pas de doublon (creerNotificationSiAbsente gère la déduplication)", async () => {
    // ERR-015 : la pré-vérification rappelExisteAujourdhui a été supprimée.
    // La déduplication est entièrement déléguée à creerNotificationSiAbsente
    // qui est idempotente (count + createIfNotExists atomique).
    // Dans ce test, creerNotificationSiAbsente est appelée (c'est elle qui décide),
    // et retourne undefined silencieusement. Le compteur envoyes s'incrémente.
    // Le test vérifie que creerNotificationSiAbsente est bien appelée (delegation OK).
    const abonnement = makeAbonnement({ dateFin: dansNJours(7) });
    mockPrismaAbonnementFindMany.mockResolvedValue([abonnement]);
    // mockPrismaNotificationCount non utilisé (plus de pré-vérification)
    mockCreerNotificationSiAbsente.mockResolvedValue(undefined);

    const result = await envoyerRappelsRenouvellement();

    // creerNotificationSiAbsente est appelée : elle gère la déduplication en interne
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledOnce();
    // envoyes = 1 car creerNotificationSiAbsente a réussi (mock retourne undefined = succès)
    expect(result).toEqual({ envoyes: 1 });
  });

  it("aucun abonnement expirant → { envoyes: 0 }", async () => {
    mockPrismaAbonnementFindMany.mockResolvedValue([]);

    const result = await envoyerRappelsRenouvellement();

    expect(result).toEqual({ envoyes: 0 });
    expect(mockCreerNotificationSiAbsente).not.toHaveBeenCalled();
  });

  it("plusieurs abonnements avec seuils différents → seuls les seuils exacts déclenchent", async () => {
    const abonnements = [
      makeAbonnement({ id: "abo-7", dateFin: dansNJours(7) }),    // seuil — rappel
      makeAbonnement({ id: "abo-8", dateFin: dansNJours(8) }),    // hors seuil — pas de rappel
      makeAbonnement({ id: "abo-14", dateFin: dansNJours(14) }),  // seuil — rappel
      makeAbonnement({ id: "abo-2", dateFin: dansNJours(2) }),    // hors seuil — pas de rappel
    ];
    mockPrismaAbonnementFindMany.mockResolvedValue(abonnements);

    const result = await envoyerRappelsRenouvellement();

    expect(result).toEqual({ envoyes: 2 });
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledTimes(2);
  });

  it("message contient le nom du plan", async () => {
    const abonnement = makeAbonnement({
      dateFin: dansNJours(7),
      planNom: "Pro Annuel",
    });
    mockPrismaAbonnementFindMany.mockResolvedValue([abonnement]);

    await envoyerRappelsRenouvellement();

    const [, , , , message] = mockCreerNotificationSiAbsente.mock.calls[0] as string[];
    expect(message).toContain("Pro Annuel");
  });

  it("la query findMany filtre bien par statut ACTIF (vérification des args Prisma)", async () => {
    mockPrismaAbonnementFindMany.mockResolvedValue([]);

    await envoyerRappelsRenouvellement();

    expect(mockPrismaAbonnementFindMany).toHaveBeenCalledOnce();
    const [args] = mockPrismaAbonnementFindMany.mock.calls[0] as [{ where: { statut: string } }][];
    expect(args.where.statut).toBe(StatutAbonnement.ACTIF);
  });
});
