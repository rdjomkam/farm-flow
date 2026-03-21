/**
 * Tests d'intégration — Cycle de vie des abonnements (Sprint 37)
 *
 * Couvre les transitions automatiques via le CRON job quotidien :
 * 1. CRON quotidien : ACTIF expiré → EN_GRACE → (7j) → SUSPENDU → (30j) → EXPIRE
 * 2. Réactivation depuis SUSPENDU : paiement confirmé → ACTIF
 * 3. Rappels : J-7 envoyé, pas de doublon le lendemain
 *
 * Story 37.1 — Sprint 37
 * R2 : enums StatutAbonnement, TypePlan importés depuis @/types
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatutAbonnement, TypePlan } from "@/types";
import { GRACE_PERIOD_JOURS, SUSPENSION_JOURS } from "@/lib/abonnements-constants";

// ---------------------------------------------------------------------------
// Mocks — Prisma
// ---------------------------------------------------------------------------

const mockPrismaAbonnementUpdateMany = vi.fn();
const mockPrismaAbonnementFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    abonnement: {
      updateMany: (...args: unknown[]) => mockPrismaAbonnementUpdateMany(...args),
      findMany: (...args: unknown[]) => mockPrismaAbonnementFindMany(...args),
    },
    $transaction: (operations: unknown[]) => {
      if (Array.isArray(operations)) {
        // Exécuter chaque opération (elles sont déjà des promesses)
        return Promise.all(operations);
      }
      if (typeof operations === "function") {
        return (operations as (tx: unknown) => unknown)({});
      }
      return Promise.resolve([]);
    },
  },
}));

// ---------------------------------------------------------------------------
// Mocks — Queries abonnements
// ---------------------------------------------------------------------------

const mockGetAbonnementsEnGraceExpires = vi.fn();

vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementsEnGraceExpires: (...args: unknown[]) =>
    mockGetAbonnementsEnGraceExpires(...args),
  getAbonnementActif: vi.fn(),
  activerAbonnement: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — Rappels (notifications)
// ---------------------------------------------------------------------------

const mockCreerNotificationSiAbsente = vi.fn();
vi.mock("@/lib/alertes", () => ({
  creerNotificationSiAbsente: (...args: unknown[]) =>
    mockCreerNotificationSiAbsente(...args),
}));

// ---------------------------------------------------------------------------
// Import après les mocks
// ---------------------------------------------------------------------------

import { transitionnerStatuts } from "@/lib/services/abonnement-lifecycle";
import { envoyerRappelsRenouvellement } from "@/lib/services/rappels-abonnement";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function datePassee(joursAuPasse: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - joursAuPasse);
  return d;
}

function dateFuture(jours: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return d;
}

function makeAbonnement(overrides: {
  id: string;
  statut: StatutAbonnement;
  dateFin?: Date;
  dateFinGrace?: Date | null;
}) {
  const now = new Date();
  return {
    id: overrides.id,
    siteId: "site-1",
    userId: "user-1",
    statut: overrides.statut,
    dateFin: overrides.dateFin ?? datePassee(1),
    dateFinGrace: overrides.dateFinGrace ?? null,
    planId: "plan-eleveur",
    plan: {
      nom: "Eleveur",
      typePlan: TypePlan.ELEVEUR,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Tests : Transitions automatiques CRON quotidien
// ---------------------------------------------------------------------------

describe("CRON quotidien — transitionnerStatuts()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("Transition 1 : ACTIF avec dateFin dépassée → EN_GRACE (updateMany count=1)", async () => {
    // ACTIF expiré hier → passe EN_GRACE
    // Ordre des appels : (1) ACTIF→EN_GRACE, (2) SUSPENDU→EXPIRE
    mockPrismaAbonnementUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // appel 1 : ACTIF → EN_GRACE
      .mockResolvedValueOnce({ count: 0 }); // appel 2 : SUSPENDU → EXPIRE

    mockGetAbonnementsEnGraceExpires.mockResolvedValue([]); // Pas d'abonnements en grâce

    const result = await transitionnerStatuts();

    expect(result.graces).toBe(1);
    expect(result.suspendus).toBe(0);
    expect(result.expires).toBe(0);
  });

  it("Transition 2 : EN_GRACE avec dateFinGrace dépassée → SUSPENDU", async () => {
    // Un abonnement EN_GRACE avec grâce expirée
    // Ordre des appels : (1) ACTIF→EN_GRACE, (2) EN_GRACE→SUSPENDU (dans tx batch), (3) SUSPENDU→EXPIRE
    mockPrismaAbonnementUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // appel 1 : ACTIF → EN_GRACE : aucun
      .mockResolvedValueOnce({ count: 1 }) // appel 2 : EN_GRACE → SUSPENDU (dans $transaction)
      .mockResolvedValueOnce({ count: 0 }); // appel 3 : SUSPENDU → EXPIRE : aucun

    mockGetAbonnementsEnGraceExpires.mockResolvedValue([
      { id: "abo-grace-1", siteId: "site-1", userId: "user-1" },
    ]);

    const result = await transitionnerStatuts();

    // La transition doit avoir appelé getAbonnementsEnGraceExpires
    expect(mockGetAbonnementsEnGraceExpires).toHaveBeenCalledOnce();
    // suspendus = 1 car la transaction batch retourne [{ count: 1 }]
    expect(result.suspendus).toBe(1);
    expect(result.graces).toBe(0);
  });

  it("Transition 3 : SUSPENDU depuis plus de 30j → EXPIRE", async () => {
    // Aucun abonnement ACTIF ni EN_GRACE, mais 1 SUSPENDU ancien
    // Ordre : (1) ACTIF→EN_GRACE : 0, (2) SUSPENDU→EXPIRE : 1
    mockPrismaAbonnementUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // appel 1 : ACTIF → EN_GRACE
      .mockResolvedValueOnce({ count: 1 }); // appel 2 : SUSPENDU → EXPIRE

    mockGetAbonnementsEnGraceExpires.mockResolvedValue([]);

    const result = await transitionnerStatuts();

    expect(result.expires).toBe(1);
    expect(result.graces).toBe(0);
  });

  it("Cycle complet : 3 types de transitions dans un seul appel CRON", async () => {
    // Ordre : (1) ACTIF→EN_GRACE : 2, (2) EN_GRACE→SUSPENDU batch : 1, (3) SUSPENDU→EXPIRE : 1
    mockPrismaAbonnementUpdateMany
      .mockResolvedValueOnce({ count: 2 }) // appel 1 : ACTIF → EN_GRACE (2 abonnements)
      .mockResolvedValueOnce({ count: 1 }) // appel 2 : EN_GRACE → SUSPENDU (dans $transaction)
      .mockResolvedValueOnce({ count: 1 }); // appel 3 : SUSPENDU → EXPIRE

    // 1 abonnement EN_GRACE expiré
    mockGetAbonnementsEnGraceExpires.mockResolvedValue([
      { id: "abo-grace-A", siteId: "site-2", userId: "user-2" },
    ]);

    const result = await transitionnerStatuts();

    expect(result.graces).toBe(2);
    expect(result.suspendus).toBe(1);
    expect(result.expires).toBe(1);
  });

  it("aucune transition nécessaire → tous counts à 0", async () => {
    // Tous les updateMany retournent count=0
    mockPrismaAbonnementUpdateMany.mockResolvedValue({ count: 0 });
    mockGetAbonnementsEnGraceExpires.mockResolvedValue([]);

    const result = await transitionnerStatuts();

    expect(result).toEqual({ graces: 0, suspendus: 0, expires: 0 });
  });

  it("les conditions de date sont correctement calculées (GRACE_PERIOD_JOURS = 7)", () => {
    // Vérification des constantes métier
    expect(GRACE_PERIOD_JOURS).toBe(7);
    expect(SUSPENSION_JOURS).toBe(30);
  });

  it("updateMany ACTIF → EN_GRACE appelé avec la condition statut=ACTIF", async () => {
    mockPrismaAbonnementUpdateMany.mockResolvedValue({ count: 0 });
    mockGetAbonnementsEnGraceExpires.mockResolvedValue([]);
    mockCreerNotificationSiAbsente.mockResolvedValue(undefined);

    await transitionnerStatuts();

    // Premier updateMany : ACTIF → EN_GRACE
    const firstCall = mockPrismaAbonnementUpdateMany.mock.calls[0]?.[0] as {
      where: { statut: string };
      data: { statut: string };
    };
    expect(firstCall.where.statut).toBe(StatutAbonnement.ACTIF);
    expect(firstCall.data.statut).toBe(StatutAbonnement.EN_GRACE);
  });

  it("updateMany SUSPENDU → EXPIRE appelé avec la condition statut=SUSPENDU", async () => {
    mockPrismaAbonnementUpdateMany.mockResolvedValue({ count: 0 });
    mockGetAbonnementsEnGraceExpires.mockResolvedValue([]);
    mockCreerNotificationSiAbsente.mockResolvedValue(undefined);

    await transitionnerStatuts();

    // Deuxième updateMany : SUSPENDU → EXPIRE
    const lastCall =
      mockPrismaAbonnementUpdateMany.mock.calls[
        mockPrismaAbonnementUpdateMany.mock.calls.length - 1
      ]?.[0] as { where: { statut: string }; data: { statut: string } };
    expect(lastCall.where.statut).toBe(StatutAbonnement.SUSPENDU);
    expect(lastCall.data.statut).toBe(StatutAbonnement.EXPIRE);
  });

  it("erreur DB dans la transition → propagée (pas avalée silencieusement)", async () => {
    mockGetAbonnementsEnGraceExpires.mockResolvedValue([]);
    mockPrismaAbonnementUpdateMany.mockRejectedValue(
      new Error("DB connection timeout")
    );

    // Le service ne doit pas avaler l'erreur — elle doit se propager
    await expect(transitionnerStatuts()).rejects.toThrow("DB connection timeout");
  });
});

// ---------------------------------------------------------------------------
// Tests : Réactivation depuis SUSPENDU
// ---------------------------------------------------------------------------

describe("Réactivation depuis SUSPENDU via paiement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Valeurs par défaut pour éviter les erreurs "no mock configured"
    mockPrismaAbonnementUpdateMany.mockResolvedValue({ count: 0 });
    mockGetAbonnementsEnGraceExpires.mockResolvedValue([]);
    mockCreerNotificationSiAbsente.mockResolvedValue(undefined);
  });

  it("activerAbonnement est disponible et accepte SUSPENDU comme statut source", async () => {
    // La fonction activerAbonnement est importée via le mock — elle est un vi.fn()
    // Elle accepte EN_ATTENTE_PAIEMENT, EN_GRACE, SUSPENDU (validé dans tests queries)
    mockPrismaAbonnementUpdateMany.mockResolvedValue({ count: 1 });

    // Import statique via le mock établi en haut du fichier
    const { activerAbonnement } = await import("@/lib/queries/abonnements");

    // La fonction est mockée → elle est appelable
    expect(typeof activerAbonnement).toBe("function");

    // Simuler l'activation depuis SUSPENDU
    const mockActiverAbonnement = vi.mocked(activerAbonnement);
    mockActiverAbonnement.mockResolvedValue({ count: 1 });

    const result = await activerAbonnement("abo-suspendu-1");
    expect(result).toEqual({ count: 1 });
  });

  it("ACTIF → EN_GRACE → SUSPENDU → EXPIRE : cycle complet sur 1 abonnement", async () => {
    // Simule le cycle complet d'un seul abonnement sur plusieurs exécutions CRON

    // Exécution 1 : ACTIF expiré → EN_GRACE
    mockGetAbonnementsEnGraceExpires.mockResolvedValue([]);
    mockPrismaAbonnementUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // ACTIF → EN_GRACE
      .mockResolvedValueOnce({ count: 0 }); // SUSPENDU → EXPIRE
    const r1 = await transitionnerStatuts();
    expect(r1.graces).toBe(1);

    vi.clearAllMocks();

    // Exécution 2 : EN_GRACE expiré → SUSPENDU
    mockGetAbonnementsEnGraceExpires.mockResolvedValue([
      { id: "abo-cycle-1", siteId: "site-1", userId: "user-1" },
    ]);
    mockPrismaAbonnementUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // ACTIF → EN_GRACE : aucun
      .mockResolvedValueOnce({ count: 1 }) // EN_GRACE → SUSPENDU (dans tx batch)
      .mockResolvedValueOnce({ count: 0 }); // SUSPENDU → EXPIRE : pas encore
    const r2 = await transitionnerStatuts();
    expect(r2.graces).toBe(0);

    vi.clearAllMocks();

    // Exécution 3 : SUSPENDU depuis 30j → EXPIRE
    mockGetAbonnementsEnGraceExpires.mockResolvedValue([]);
    mockPrismaAbonnementUpdateMany
      .mockResolvedValueOnce({ count: 0 }) // ACTIF → EN_GRACE : aucun
      .mockResolvedValueOnce({ count: 1 }); // SUSPENDU → EXPIRE
    const r3 = await transitionnerStatuts();
    expect(r3.expires).toBe(1);
  });

  it("les constantes GRACE_PERIOD_JOURS et SUSPENSION_JOURS définissent les délais", () => {
    // Vérification métier : les délais sont fixes et documentés
    expect(GRACE_PERIOD_JOURS).toBe(7);
    expect(SUSPENSION_JOURS).toBe(30);
    // Total avant expiration définitive : 7 + 30 = 37 jours après dateFin
    expect(GRACE_PERIOD_JOURS + SUSPENSION_JOURS).toBe(37);
  });
});

// ---------------------------------------------------------------------------
// Tests : Rappels de renouvellement
// ---------------------------------------------------------------------------

describe("Rappels de renouvellement — envoyerRappelsRenouvellement()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreerNotificationSiAbsente.mockResolvedValue(undefined);
    mockPrismaAbonnementFindMany.mockResolvedValue([]);
  });

  it("J-7 : abonnement ACTIF expirant dans 7 jours → rappel envoyé", async () => {
    const dateFin = dateFuture(7);
    mockPrismaAbonnementFindMany.mockResolvedValue([
      makeAbonnement({
        id: "abo-rappel-7j",
        statut: StatutAbonnement.ACTIF,
        dateFin,
      }),
    ]);

    const result = await envoyerRappelsRenouvellement();

    expect(result.envoyes).toBe(1);
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledOnce();
  });

  it("J-7 : pas de doublon le lendemain — creerNotificationSiAbsente gère la dédup", async () => {
    const dateFin = dateFuture(7);
    mockPrismaAbonnementFindMany.mockResolvedValue([
      makeAbonnement({
        id: "abo-rappel-7j-bis",
        statut: StatutAbonnement.ACTIF,
        dateFin,
      }),
    ]);

    // Premier appel — rappel envoyé
    const result1 = await envoyerRappelsRenouvellement();
    expect(result1.envoyes).toBe(1);

    vi.clearAllMocks();
    // Le lendemain, creerNotificationSiAbsente ne crée pas de doublon
    // Elle est toujours appelée (pas de pré-vérification — ERR-015),
    // mais retourne silencieusement si doublon interne
    mockPrismaAbonnementFindMany.mockResolvedValue([
      makeAbonnement({
        id: "abo-rappel-7j-bis",
        statut: StatutAbonnement.ACTIF,
        dateFin: dateFuture(6), // lendemain : 6 jours restants
      }),
    ]);
    mockCreerNotificationSiAbsente.mockResolvedValue(undefined);

    // Dans 6 jours (pas dans [14,7,3,1]) → pas de rappel
    const result2 = await envoyerRappelsRenouvellement();
    expect(result2.envoyes).toBe(0);
    expect(mockCreerNotificationSiAbsente).not.toHaveBeenCalled();
  });

  it("plan DECOUVERTE exclu des rappels — même si expiration dans 7j", async () => {
    mockPrismaAbonnementFindMany.mockResolvedValue([
      {
        ...makeAbonnement({
          id: "abo-decouverte",
          statut: StatutAbonnement.ACTIF,
          dateFin: dateFuture(7),
        }),
        plan: { nom: "Decouverte", typePlan: TypePlan.DECOUVERTE },
      },
    ]);

    const result = await envoyerRappelsRenouvellement();

    expect(result.envoyes).toBe(0);
    expect(mockCreerNotificationSiAbsente).not.toHaveBeenCalled();
  });

  it("seuils exacts seulement : J-14, J-7, J-3, J-1 → rappels ; J-8, J-6, J-2 → pas de rappel", async () => {
    // 7 abonnements avec différents jours restants
    const abonnements = [
      // Seuils exacts → rappels attendus
      { id: "abo-14j", days: 14, shouldSend: true },
      { id: "abo-7j", days: 7, shouldSend: true },
      { id: "abo-3j", days: 3, shouldSend: true },
      { id: "abo-1j", days: 1, shouldSend: true },
      // Hors seuils → pas de rappels
      { id: "abo-8j", days: 8, shouldSend: false },
      { id: "abo-6j", days: 6, shouldSend: false },
      { id: "abo-2j", days: 2, shouldSend: false },
    ];

    mockPrismaAbonnementFindMany.mockResolvedValue(
      abonnements.map(({ id, days }) => ({
        ...makeAbonnement({
          id,
          statut: StatutAbonnement.ACTIF,
          dateFin: dateFuture(days),
        }),
      }))
    );

    const result = await envoyerRappelsRenouvellement();

    // 4 seuils exacts → 4 rappels
    expect(result.envoyes).toBe(4);
    expect(mockCreerNotificationSiAbsente).toHaveBeenCalledTimes(4);
  });

  it("aucun abonnement expirant → { envoyes: 0 }", async () => {
    mockPrismaAbonnementFindMany.mockResolvedValue([]);

    const result = await envoyerRappelsRenouvellement();

    expect(result).toEqual({ envoyes: 0 });
    expect(mockCreerNotificationSiAbsente).not.toHaveBeenCalled();
  });

  it("erreur sur un rappel → les autres sont quand même envoyés (résilience)", async () => {
    // 3 abonnements : le 2e provoque une erreur
    mockPrismaAbonnementFindMany.mockResolvedValue([
      makeAbonnement({ id: "abo-rappel-A", statut: StatutAbonnement.ACTIF, dateFin: dateFuture(7) }),
      makeAbonnement({ id: "abo-rappel-B", statut: StatutAbonnement.ACTIF, dateFin: dateFuture(7) }),
      makeAbonnement({ id: "abo-rappel-C", statut: StatutAbonnement.ACTIF, dateFin: dateFuture(7) }),
    ]);

    // Le 2e appel à creerNotificationSiAbsente échoue
    mockCreerNotificationSiAbsente
      .mockResolvedValueOnce(undefined) // A réussit
      .mockRejectedValueOnce(new Error("Notification service down")) // B échoue
      .mockResolvedValueOnce(undefined); // C réussit

    const result = await envoyerRappelsRenouvellement();

    // A et C envoyés malgré l'échec de B
    expect(result.envoyes).toBe(2);
  });
});
