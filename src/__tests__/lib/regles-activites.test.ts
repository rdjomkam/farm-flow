/**
 * Tests unitaires — regles-activites
 *
 * Couvre :
 * - validateTemplatePlaceholders() : fonction pure, cas success et echec
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateTemplatePlaceholders } from "@/lib/regles-activites-constants";

// ---------------------------------------------------------------------------
// Mocks (Prisma — pour les fonctions de query)
// ---------------------------------------------------------------------------

const mockFindFirst = vi.fn();
const mockUpdateMany = vi.fn();
const mockDeleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    regleActivite: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// validateTemplatePlaceholders
// ---------------------------------------------------------------------------

describe("validateTemplatePlaceholders", () => {
  it("placeholder connu -> valid:true, unknown:[]", () => {
    const result = validateTemplatePlaceholders("Distribuer {quantite_calculee}kg en {bac}");
    expect(result.valid).toBe(true);
    expect(result.unknown).toEqual([]);
  });

  it("placeholder inconnu -> valid:false, unknown contient la cle", () => {
    const result = validateTemplatePlaceholders("Phase {phase_actuelle} — {poids_moyen}g");
    expect(result.valid).toBe(false);
    expect(result.unknown).toContain("phase_actuelle");
    // poids_moyen est connu, ne doit pas etre dans unknown
    expect(result.unknown).not.toContain("poids_moyen");
  });

  it("template sans placeholder -> valid:true, unknown:[]", () => {
    const result = validateTemplatePlaceholders("Effectuer la biometrie hebdomadaire");
    expect(result.valid).toBe(true);
    expect(result.unknown).toEqual([]);
  });

  it("chaine vide -> valid:true, unknown:[]", () => {
    const result = validateTemplatePlaceholders("");
    expect(result.valid).toBe(true);
    expect(result.unknown).toEqual([]);
  });

  it("mix connus et inconnus -> valid:false, unknown ne contient que les inconnus", () => {
    const result = validateTemplatePlaceholders(
      "Regle {vague} — phase {phase_actuelle} — poids {poids_moyen}g — inconnu {data_inconnue}"
    );
    expect(result.valid).toBe(false);
    // Inconnus
    expect(result.unknown).toContain("phase_actuelle");
    expect(result.unknown).toContain("data_inconnue");
    // Connus — ne doivent pas apparaitre dans unknown
    expect(result.unknown).not.toContain("vague");
    expect(result.unknown).not.toContain("poids_moyen");
  });

  it("placeholder en double -> deduplique dans unknown", () => {
    const result = validateTemplatePlaceholders(
      "{inconnu_placeholder} et {inconnu_placeholder} et {inconnu_placeholder}"
    );
    expect(result.valid).toBe(false);
    // Doit etre deduplique — exactement une occurrence
    expect(result.unknown).toHaveLength(1);
    expect(result.unknown[0]).toBe("inconnu_placeholder");
  });

  it("tous les 16 placeholders connus reconnus comme valides", () => {
    const allKnown = [
      "quantite_calculee",
      "taille",
      "poids_moyen",
      "stock",
      "taux",
      "valeur",
      "semaine",
      "produit",
      "seuil",
      "jours_restants",
      "quantite_recommandee",
      "bac",
      "biomasse",
      "vague",
      "jours_ecoules",
      "valeur_marchande",
    ];
    const template = allKnown.map((k) => `{${k}}`).join(" ");
    const result = validateTemplatePlaceholders(template);
    expect(result.valid).toBe(true);
    expect(result.unknown).toEqual([]);
  });

  it("ne traite pas les accolades incompletes comme des placeholders", () => {
    // {texte sans accolade fermante — doit etre ignore
    const result = validateTemplatePlaceholders("Distribuer quantite}kg aujourd{hui");
    expect(result.valid).toBe(true);
    expect(result.unknown).toEqual([]);
  });

  it("plusieurs placeholders inconnus uniques", () => {
    const result = validateTemplatePlaceholders("{foo} {bar} {baz}");
    expect(result.valid).toBe(false);
    expect(result.unknown).toHaveLength(3);
    expect(result.unknown).toContain("foo");
    expect(result.unknown).toContain("bar");
    expect(result.unknown).toContain("baz");
  });
});

// ---------------------------------------------------------------------------
// toggleRegleActivite — tests d'atomicite
// ---------------------------------------------------------------------------

describe("toggleRegleActivite (atomicite R4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise updateMany avec condition atomique (pas check-then-update)", async () => {
    const { toggleRegleActivite } = await import("@/lib/queries/regles-activites");

    mockFindFirst.mockResolvedValue({
      id: "regle-1",
      isActive: true,
      typeDeclencheur: "RECURRENT",
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await toggleRegleActivite("regle-1");

    // updateMany doit etre appele avec une condition sur isActive (atomique)
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "regle-1",
          isActive: true, // condition atomique sur l'etat courant
        }),
        data: expect.objectContaining({ isActive: false }),
      })
    );
  });

  it("remet firedOnce=false lors de la reactivation d'une regle SEUIL_POIDS", async () => {
    const { toggleRegleActivite } = await import("@/lib/queries/regles-activites");

    mockFindFirst.mockResolvedValue({
      id: "regle-seuil-1",
      isActive: false, // desactivee — toggle va reactiver
      typeDeclencheur: "SEUIL_POIDS",
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await toggleRegleActivite("regle-seuil-1");

    // Lors de la reactivation d'un SEUIL, firedOnce doit etre reset
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: true,
          firedOnce: false,
        }),
      })
    );
  });

  it("ne remet PAS firedOnce pour RECURRENT lors de la reactivation", async () => {
    const { toggleRegleActivite } = await import("@/lib/queries/regles-activites");

    mockFindFirst.mockResolvedValue({
      id: "regle-rec-1",
      isActive: false,
      typeDeclencheur: "RECURRENT",
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await toggleRegleActivite("regle-rec-1");

    const callData = mockUpdateMany.mock.calls[0][0].data;
    expect(callData.firedOnce).toBeUndefined();
  });

  it("lance une erreur si la regle est introuvable", async () => {
    const { toggleRegleActivite } = await import("@/lib/queries/regles-activites");

    mockFindFirst.mockResolvedValue(null);

    await expect(toggleRegleActivite("regle-unknown")).rejects.toThrow("introuvable");
  });

  it("retourne { id, isActive } avec le nouvel etat", async () => {
    const { toggleRegleActivite } = await import("@/lib/queries/regles-activites");

    mockFindFirst.mockResolvedValue({
      id: "regle-1",
      isActive: true,
      typeDeclencheur: "RECURRENT",
    });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await toggleRegleActivite("regle-1");

    expect(result).toEqual({ id: "regle-1", isActive: false });
  });
});

// ---------------------------------------------------------------------------
// resetFiredOnce — tests d'atomicite
// ---------------------------------------------------------------------------

describe("resetFiredOnce (atomicite R4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise updateMany avec condition atomique firedOnce=true", async () => {
    const { resetFiredOnce } = await import("@/lib/queries/regles-activites");

    mockUpdateMany.mockResolvedValue({ count: 1 });

    await resetFiredOnce("regle-seuil-1");

    // Condition atomique : ne met a jour que si firedOnce=true
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "regle-seuil-1",
          firedOnce: true,
        }),
        data: { firedOnce: false },
      })
    );
  });

  it("est idempotent si firedOnce est deja false (count=0 mais pas d'erreur)", async () => {
    const { resetFiredOnce } = await import("@/lib/queries/regles-activites");

    mockUpdateMany.mockResolvedValue({ count: 0 }); // firedOnce deja false
    mockFindFirst.mockResolvedValue({ id: "regle-seuil-1" }); // regle existe

    const result = await resetFiredOnce("regle-seuil-1");

    // Pas d'erreur — operation idempotente
    expect(result).toEqual({ id: "regle-seuil-1", firedOnce: false });
  });

  it("lance une erreur si la regle est introuvable (count=0 + findFirst null)", async () => {
    const { resetFiredOnce } = await import("@/lib/queries/regles-activites");

    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindFirst.mockResolvedValue(null); // regle inexistante

    await expect(resetFiredOnce("regle-unknown")).rejects.toThrow("introuvable");
  });

  it("retourne { id, firedOnce: false } apres reinitialisation", async () => {
    const { resetFiredOnce } = await import("@/lib/queries/regles-activites");

    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await resetFiredOnce("regle-seuil-1");

    expect(result.id).toBe("regle-seuil-1");
    expect(result.firedOnce).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deleteRegleActivite — regles de protection
// ---------------------------------------------------------------------------

describe("deleteRegleActivite (protection regles globales)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne { error: 'global' } si siteId=null (regle globale)", async () => {
    const { deleteRegleActivite } = await import("@/lib/queries/regles-activites");

    mockFindFirst.mockResolvedValue({
      id: "regle-global-1",
      siteId: null,
      _count: { activites: 0 },
    });

    const result = await deleteRegleActivite("regle-global-1", "site-1");

    expect(result).toEqual({ error: "global" });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("retourne { error: 'linked' } si _count.activites > 0", async () => {
    const { deleteRegleActivite } = await import("@/lib/queries/regles-activites");

    mockFindFirst.mockResolvedValue({
      id: "regle-1",
      siteId: "site-1",
      _count: { activites: 5 }, // activites liees
    });

    const result = await deleteRegleActivite("regle-1", "site-1");

    expect(result).toEqual({ error: "linked" });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("supprime si regle site-specifique sans activites -> { success: true }", async () => {
    const { deleteRegleActivite } = await import("@/lib/queries/regles-activites");

    mockFindFirst.mockResolvedValue({
      id: "regle-1",
      siteId: "site-1",
      _count: { activites: 0 },
    });
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const result = await deleteRegleActivite("regle-1", "site-1");

    expect(result).toEqual({ success: true });
    expect(mockDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "regle-1", siteId: "site-1" },
      })
    );
  });

  it("masque une regle d'un autre site comme introuvable (securite R8)", async () => {
    const { deleteRegleActivite } = await import("@/lib/queries/regles-activites");

    mockFindFirst.mockResolvedValue({
      id: "regle-autre-site",
      siteId: "site-autre", // siteId different
      _count: { activites: 0 },
    });

    await expect(
      deleteRegleActivite("regle-autre-site", "site-1")
    ).rejects.toThrow("introuvable");

    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("lance une erreur si la regle est introuvable (findFirst null)", async () => {
    const { deleteRegleActivite } = await import("@/lib/queries/regles-activites");

    mockFindFirst.mockResolvedValue(null);

    await expect(
      deleteRegleActivite("regle-unknown", "site-1")
    ).rejects.toThrow("introuvable");
  });
});
