// @vitest-environment jsdom
/**
 * Tests — MappingOrphelineBanner (ADR-053 §16.7, story A.4).
 *
 * Couvre :
 * - 0 cible orpheline => rien affiche (pas de faux positif) ;
 * - N >= 1 cibles orphelines => bandeau danger affiche, avec le compte ;
 * - echec reseau => bandeau distinct "erreur de chargement", JAMAIS confondu
 *   avec "0 cible orpheline" (ERR-171/ERR-179 : un etat nomme, jamais un
 *   repli silencieux) ;
 * - le composant est rendu au niveau du SHELL (scenario-detail-client.tsx),
 *   hors de tout TabsContent — verifie separement par lecture de code
 *   (§16.7 derniere clause) : ce test-ci prouve seulement le comportement
 *   du composant lui-meme, independamment de l'onglet actif.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MappingOrphelineBanner } from "@/components/previsions/mapping-orpheline-banner";
import { CibleRapprochement, SourceRapprochement } from "@/types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === "cibleOrphelineBanner.message") {
      const count = Number(values?.count ?? 0);
      return `${count} cible(s) de mapping orpheline(s) active(s) pour ce site`;
    }
    if (key === "cibleOrphelineBanner.loadError") {
      return "Impossible de vérifier l'état du mapping de rapprochement pour ce scénario.";
    }
    return key;
  },
}));

const mockGet = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ get: mockGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

function ligne(cibleOrpheline: boolean, id: string) {
  return {
    id,
    siteId: "site-1",
    version: 1,
    sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
    sourceCle: "ELECTRICITE",
    cibleType: CibleRapprochement.POSTE_PREVISION,
    cibleId: "referentiel-1",
    actif: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    cibleOrpheline,
    cibleCleResolue: cibleOrpheline ? null : "poste-1",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MappingOrphelineBanner", () => {
  it("aucune cible orpheline => AUCUN bandeau affiche (pas de faux positif)", async () => {
    mockGet.mockResolvedValue({ ok: true, data: { data: [ligne(false, "m1"), ligne(false, "m2")] } });

    render(<MappingOrphelineBanner scenarioId="s1" />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("N cibles orphelines => bandeau danger avec le COMPTE EXACT, jamais un texte generique", async () => {
    mockGet.mockResolvedValue({
      ok: true,
      data: { data: [ligne(true, "m1"), ligne(false, "m2"), ligne(true, "m3")] },
    });

    render(<MappingOrphelineBanner scenarioId="s1" />);

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("2 cible(s)");
  });

  it("appelle la route site-scopee avec ?scenarioId= du scenario COURANT (meme detection que l'onglet Mapping, aucune logique dupliquee)", async () => {
    mockGet.mockResolvedValue({ ok: true, data: { data: [] } });

    render(<MappingOrphelineBanner scenarioId="scenario-xyz" />);

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        "/api/previsions/mapping-rapprochement?scenarioId=scenario-xyz",
        expect.anything()
      )
    );
  });

  it("echec reseau => bandeau DISTINCT 'erreur de chargement', jamais confondu avec 'aucune cible orpheline' (ERR-171/ERR-179 : etat nomme, jamais un repli silencieux)", async () => {
    mockGet.mockResolvedValue({ ok: false, data: null });

    render(<MappingOrphelineBanner scenarioId="s1" />);

    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("Impossible de vérifier l'état du mapping");
    // Jamais le message "0 cible" ni le message de compte generique.
    expect(screen.queryByText(/cible\(s\) de mapping orpheline/)).not.toBeInTheDocument();
  });
});
