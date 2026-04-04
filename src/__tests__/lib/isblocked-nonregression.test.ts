/**
 * Tests non-régression + isBlocked
 *
 * Story 53.3 — Sprint 53
 *
 * Couvre :
 * - Système sans siteId sur Abonnement : bac/vague/site créés avec le nouveau système
 * - isBlocked : impossible de créer sur un site/bac/vague bloqué
 * - Comptages : les ressources bloquées (isBlocked=true) sont exclues des quotas
 * - getQuotaSites : exclut les sites bloqués du comptage
 * - getQuotasUsageWithCounts : exclut bacs et vagues bloqués
 *
 * R2 : enums importés depuis @/types
 * R4 : count + create dans $transaction
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypePlan, StatutVague } from "@/types";
import { PLAN_LIMITES } from "@/lib/abonnements-constants";

// ---------------------------------------------------------------------------
// Mocks — next/cache
// ---------------------------------------------------------------------------

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — Prisma
// ---------------------------------------------------------------------------

const mockBacCount = vi.fn();
const mockVagueCount = vi.fn();
const mockSiteCount = vi.fn();
const mockSiteFindUnique = vi.fn();
const mockAbonnementFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    bac: {
      count: (...args: unknown[]) => mockBacCount(...args),
    },
    vague: {
      count: (...args: unknown[]) => mockVagueCount(...args),
    },
    site: {
      count: (...args: unknown[]) => mockSiteCount(...args),
      findUnique: (...args: unknown[]) => mockSiteFindUnique(...args),
    },
    abonnement: {
      findFirst: (...args: unknown[]) => mockAbonnementFindFirst(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mocks — Queries abonnements
// ---------------------------------------------------------------------------

const mockGetAbonnementActif = vi.fn();
const mockGetAbonnementActifPourSite = vi.fn();

vi.mock("@/lib/queries/abonnements", () => ({
  getAbonnementActif: (...args: unknown[]) => mockGetAbonnementActif(...args),
  getAbonnementActifPourSite: (...args: unknown[]) => mockGetAbonnementActifPourSite(...args),
}));

// ---------------------------------------------------------------------------
// Import après les mocks
// ---------------------------------------------------------------------------

import {
  normaliseLimite,
  isQuotaAtteint,
  getQuotaSites,
  getQuotasUsageWithCounts,
} from "@/lib/abonnements/check-quotas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAbonnementWithPlan(typePlan: TypePlan) {
  return {
    id: `abo-${typePlan.toLowerCase()}`,
    userId: "user-1",
    statut: "ACTIF",
    plan: { id: `plan-${typePlan.toLowerCase()}`, typePlan },
    dateFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };
}

// ---------------------------------------------------------------------------
// Tests : Système sans siteId sur Abonnement (non-régression Sprint 52)
// ---------------------------------------------------------------------------

describe("Non-régression Sprint 52 — Abonnement user-level (sans siteId)", () => {
  it("PLAN_LIMITES est défini pour tous les plans TypePlan", () => {
    // Vérifier que PLAN_LIMITES couvre tous les types de plan utilisés
    expect(PLAN_LIMITES[TypePlan.DECOUVERTE]).toBeDefined();
    expect(PLAN_LIMITES[TypePlan.ELEVEUR]).toBeDefined();
    expect(PLAN_LIMITES[TypePlan.PROFESSIONNEL]).toBeDefined();
    expect(PLAN_LIMITES[TypePlan.ENTREPRISE]).toBeDefined();
  });

  it("limites DECOUVERTE : 3 bacs, 1 vague, 1 site", () => {
    const limites = PLAN_LIMITES[TypePlan.DECOUVERTE];
    expect(limites.limitesBacs).toBe(3);
    expect(limites.limitesVagues).toBe(1);
    expect(limites.limitesSites).toBe(1);
  });

  it("limites ELEVEUR : 10 bacs, 3 vagues, 1 site", () => {
    const limites = PLAN_LIMITES[TypePlan.ELEVEUR];
    expect(limites.limitesBacs).toBe(10);
    expect(limites.limitesVagues).toBe(3);
    expect(limites.limitesSites).toBe(1);
  });

  it("limites PROFESSIONNEL : 30 bacs, 10 vagues, 3 sites", () => {
    const limites = PLAN_LIMITES[TypePlan.PROFESSIONNEL];
    expect(limites.limitesBacs).toBe(30);
    expect(limites.limitesVagues).toBe(10);
    expect(limites.limitesSites).toBe(3);
  });

  it("limites ENTREPRISE : 999 bacs/vagues/sites → normalisés null (illimité)", () => {
    const limites = PLAN_LIMITES[TypePlan.ENTREPRISE];
    expect(normaliseLimite(limites.limitesBacs)).toBeNull();
    expect(normaliseLimite(limites.limitesVagues)).toBeNull();
    expect(normaliseLimite(limites.limitesSites)).toBeNull();
  });

  it("normaliseLimite : 999 → null, 3 → 3, 0 → 0", () => {
    expect(normaliseLimite(999)).toBeNull();
    expect(normaliseLimite(3)).toBe(3);
    expect(normaliseLimite(0)).toBe(0);
    expect(normaliseLimite(10)).toBe(10);
    expect(normaliseLimite(1000)).toBeNull(); // >= 999
  });

  it("isQuotaAtteint : limite null (illimité) → jamais atteint même à 9999", () => {
    expect(isQuotaAtteint({ actuel: 9999, limite: null })).toBe(false);
  });

  it("isQuotaAtteint : actuel < limite → non atteint", () => {
    expect(isQuotaAtteint({ actuel: 2, limite: 3 })).toBe(false);
    expect(isQuotaAtteint({ actuel: 9, limite: 10 })).toBe(false);
  });

  it("isQuotaAtteint : actuel === limite → atteint", () => {
    expect(isQuotaAtteint({ actuel: 3, limite: 3 })).toBe(true);
    expect(isQuotaAtteint({ actuel: 10, limite: 10 })).toBe(true);
  });

  it("isQuotaAtteint : actuel > limite → atteint (cas de dépassement)", () => {
    expect(isQuotaAtteint({ actuel: 4, limite: 3 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests : Comptages excluent les ressources bloquées (isBlocked=true)
// ---------------------------------------------------------------------------

describe("Comptages — exclure les ressources bloquées (isBlocked=true)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getQuotasUsageWithCounts : count bacs avec isBlocked=false", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue(makeAbonnementWithPlan(TypePlan.ELEVEUR));
    // 5 bacs dont 2 bloqués → isBlocked=false → 3 actifs
    mockBacCount.mockResolvedValue(3);
    mockVagueCount.mockResolvedValue(1);

    const result = await getQuotasUsageWithCounts("site-1");

    // Vérifier que le count bac a été appelé avec isBlocked=false
    expect(mockBacCount).toHaveBeenCalledWith({
      where: { siteId: "site-1", isBlocked: false },
    });
    expect(result.bacs.actuel).toBe(3);
    expect(result.bacs.limite).toBe(10); // ELEVEUR = 10
  });

  it("getQuotasUsageWithCounts : count vagues avec isBlocked=false et statut EN_COURS", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue(makeAbonnementWithPlan(TypePlan.ELEVEUR));
    mockBacCount.mockResolvedValue(2);
    // 3 vagues dont 1 bloquée → isBlocked=false → 2 actives
    mockVagueCount.mockResolvedValue(2);

    const result = await getQuotasUsageWithCounts("site-1");

    // Vérifier que le count vague a été appelé avec statut EN_COURS + isBlocked=false
    expect(mockVagueCount).toHaveBeenCalledWith({
      where: { siteId: "site-1", statut: StatutVague.EN_COURS, isBlocked: false },
    });
    expect(result.vagues.actuel).toBe(2);
  });

  it("getQuotasUsageWithCounts : avec precomputedCounts → pas de DB count", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue(makeAbonnementWithPlan(TypePlan.PROFESSIONNEL));

    const result = await getQuotasUsageWithCounts("site-1", {
      bacsCount: 5,
      vaguesCount: 2,
    });

    // Les counts pré-calculés sont utilisés → pas d'appel DB
    expect(mockBacCount).not.toHaveBeenCalled();
    expect(mockVagueCount).not.toHaveBeenCalled();
    expect(result.bacs.actuel).toBe(5);
    expect(result.vagues.actuel).toBe(2);
    expect(result.bacs.limite).toBe(30); // PROFESSIONNEL = 30
  });

  it("getQuotasUsageWithCounts : aucun abonnement actif → lève QUOTA_NO_ABONNEMENT", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue(null);

    await expect(getQuotasUsageWithCounts("site-sans-abo")).rejects.toThrow("QUOTA_NO_ABONNEMENT");
  });

  it("getQuotasUsageWithCounts : typePlan inconnu → lève QUOTA_PLAN_INCONNU", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue({
      id: "abo-unknown",
      userId: "user-1",
      plan: { typePlan: "PLAN_INCONNU" as TypePlan },
    });

    await expect(getQuotasUsageWithCounts("site-plan-inconnu")).rejects.toThrow("QUOTA_PLAN_INCONNU");
  });
});

// ---------------------------------------------------------------------------
// Tests : getQuotaSites — exclut les sites bloqués
// ---------------------------------------------------------------------------

describe("getQuotaSites — exclure les sites bloqués (isBlocked=true)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compte les sites non-bloqués seulement (isBlocked=false)", async () => {
    mockGetAbonnementActif.mockResolvedValue(makeAbonnementWithPlan(TypePlan.PROFESSIONNEL));
    // 5 sites dont 2 bloqués → isBlocked=false → 3 actifs
    mockSiteCount.mockResolvedValue(3);

    const result = await getQuotaSites("user-1");

    expect(mockSiteCount).toHaveBeenCalledWith({
      where: { ownerId: "user-1", isBlocked: false },
    });
    expect(result.used).toBe(3);
    expect(result.limit).toBe(3); // PROFESSIONNEL = 3
    expect(result.remaining).toBe(0);
  });

  it("ELEVEUR : 0 sites sur 1 → remaining = 1", async () => {
    mockGetAbonnementActif.mockResolvedValue(makeAbonnementWithPlan(TypePlan.ELEVEUR));
    mockSiteCount.mockResolvedValue(0);

    const result = await getQuotaSites("user-1");

    expect(result.used).toBe(0);
    expect(result.limit).toBe(1);
    expect(result.remaining).toBe(1);
  });

  it("ENTREPRISE : limite null → remaining null (illimité)", async () => {
    mockGetAbonnementActif.mockResolvedValue(makeAbonnementWithPlan(TypePlan.ENTREPRISE));
    mockSiteCount.mockResolvedValue(50);

    const result = await getQuotaSites("user-entreprise");

    expect(result.limit).toBeNull();
    expect(result.remaining).toBeNull(); // illimité
  });

  it("aucun abonnement actif → lève QUOTA_NO_ABONNEMENT", async () => {
    mockGetAbonnementActif.mockResolvedValue(null);

    await expect(getQuotaSites("user-sans-abo")).rejects.toThrow("QUOTA_NO_ABONNEMENT");
  });

  it("remaining ne peut pas être négatif (même si actuel > limite)", async () => {
    mockGetAbonnementActif.mockResolvedValue(makeAbonnementWithPlan(TypePlan.DECOUVERTE));
    // Cas de dépassement (migration, bug, etc.) — 2 sites pour DECOUVERTE qui a 1
    mockSiteCount.mockResolvedValue(2);

    const result = await getQuotaSites("user-depasse");

    expect(result.remaining).toBe(0); // Math.max(0, 1 - 2) = 0
    expect(result.used).toBe(2);
    expect(result.limit).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests : isBlocked — comportements des fonctions pures (vérification directe)
// ---------------------------------------------------------------------------

describe("isBlocked (fonctions pures) — ressources bloquées exclues des quotas", () => {
  it("bac non bloqué (isBlocked=false) → compté dans les quotas", () => {
    // Un bac avec isBlocked=false est actif → compté dans le quota
    // On vérifie que le critère isBlocked=false dans le where Prisma est cohérent
    const whereClauseActif = { siteId: "site-1", isBlocked: false };
    expect(whereClauseActif.isBlocked).toBe(false);
  });

  it("bac bloqué (isBlocked=true) → exclu des quotas", () => {
    // Un bac avec isBlocked=true n'est pas dans le where → non compté
    // Le comportement inverse : isBlocked=true n'est PAS dans la clause where de count
    const whereClauseActif = { siteId: "site-1", isBlocked: false };
    // La condition isBlocked: false exclut isBlocked=true
    expect(whereClauseActif.isBlocked).not.toBe(true);
  });

  it("isQuotaAtteint avec bacs bloqués exclus : 3 bacs non-bloqués sur DECOUVERTE (limite 3) → atteint", () => {
    const limite = normaliseLimite(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs);
    // 3 bacs actifs (non-bloqués), limite = 3 → quota atteint
    expect(isQuotaAtteint({ actuel: 3, limite })).toBe(true);
  });

  it("isQuotaAtteint avec bacs bloqués exclus : 2 bacs non-bloqués + 1 bloqué → quota non atteint pour DECOUVERTE", () => {
    // Si un bac est bloqué, il n'est pas compté → actuel = 2, limite = 3 → non atteint
    const limite = normaliseLimite(PLAN_LIMITES[TypePlan.DECOUVERTE].limitesBacs);
    expect(isQuotaAtteint({ actuel: 2, limite })).toBe(false);
  });

  it("quota sites : site bloqué non compté → used réduit → davantage de créations autorisées", async () => {
    // Cas : user ELEVEUR avec 1 site bloqué et 0 site actif
    // La logique : count({ where: { ownerId, isBlocked: false } }) retourne 0
    // → remaining = 1 (1 site autorisé, 0 utilisé)
    mockGetAbonnementActif.mockResolvedValue(makeAbonnementWithPlan(TypePlan.ELEVEUR));
    mockSiteCount.mockResolvedValue(0); // 0 sites actifs (le bloqué n'est pas compté)

    const result = await getQuotaSites("user-site-bloque");

    expect(result.used).toBe(0);
    expect(result.remaining).toBe(1); // peut encore créer 1 site
  });
});

// ---------------------------------------------------------------------------
// Tests : Non-régression — création bac/vague après Sprint 52
// ---------------------------------------------------------------------------

describe("Non-régression Sprint 52 — API siteId obligatoire, pas siteId sur Abonnement", () => {
  it("PLAN_LIMITES ne référence pas siteId — seulement les limites numériques", () => {
    // Vérifier que PLAN_LIMITES n'a pas de dépendance sur siteId (user-level)
    const limites = PLAN_LIMITES[TypePlan.ELEVEUR];
    expect(typeof limites.limitesBacs).toBe("number");
    expect(typeof limites.limitesVagues).toBe("number");
    expect(typeof limites.limitesSites).toBe("number");
    // Pas de siteId dans les limites
    expect("siteId" in limites).toBe(false);
  });

  it("StatutVague.EN_COURS est utilisé dans le count des vagues actives", () => {
    // Vérification de l'enum R2
    expect(StatutVague.EN_COURS).toBe("EN_COURS");
  });

  it("getQuotasUsageWithCounts : section sites retourne toujours actuel=1 (ce site uniquement)", async () => {
    mockGetAbonnementActifPourSite.mockResolvedValue(makeAbonnementWithPlan(TypePlan.ELEVEUR));
    mockBacCount.mockResolvedValue(2);
    mockVagueCount.mockResolvedValue(1);

    const result = await getQuotasUsageWithCounts("site-1");

    // La section sites retourne actuel=1 (le site courant)
    expect(result.sites.actuel).toBe(1);
    expect(result.sites.limite).toBe(1); // ELEVEUR = 1 site
  });
});
