// @vitest-environment jsdom
/**
 * Tests (legers) — BonLivraisonFlow (Story BL.4)
 *
 * Composant : src/components/ventes/bon-livraison-flow.tsx
 * Flux mobile multi-etapes : recap -> signature client -> signature livreur -> signe.
 *
 * Couverture (legere, conforme au perimetre BL.4) :
 * 1. Etape recap affichee apres chargement (numero, lignes, bloc paiement)
 * 2. Navigation recap -> signature client (bouton "Faire signer")
 * 3. Etat "deja signe" -> saute directement a l'etape finale avec signatures
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BonLivraisonFlow } from "@/components/ventes/bon-livraison-flow";
import { StatutBonLivraison } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const mockToast = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const translations: Record<string, string> = {
  title: "Bon de livraison",
  loading: "Chargement du bon de livraison...",
  back: "Retour",
  next: "Suivant",
  validating: "Validation...",
  close: "Fermer",
  "recap.client": "Client",
  "recap.date": "Date",
  "recap.lignesTitle": "Lignes a livrer",
  "recap.poissons": "poissons",
  "recap.totalVente": "Total vente",
  "recap.paye": "Paye a ce jour",
  "recap.resteAPayer": "Reste a payer",
  "recap.fairesigner": "Faire signer",
  "signatureClient.instructions": "Faites signer le client.",
  "signatureClient.nomLabel": "Nom du signataire",
  "signatureClient.nomPlaceholder": "Ex: Jean Mballa",
  "signatureLivreur.instructions": "Signez pour confirmer.",
  "signatureLivreur.valider": "Valider le bon de livraison",
  "signed.title": "Bon de livraison signe",
  "signed.numero": "N° {numero}",
  "signed.signatureClientLabel": "Signature du client — {nom}",
  "signed.signatureClientAlt": "Signature du client",
  "signed.signatureLivreurLabel": "Signature du livreur",
  "signed.signatureLivreurAlt": "Signature du livreur",
  "signed.downloadPdf": "Telecharger le PDF",
  "signed.share": "Partager",
  "signed.partageEnCours": "Partage en cours...",
  "signed.shareError": "Erreur lors du partage du bon de livraison.",
  "signaturePad.ariaLabel": "Zone de signature tactile",
  "signaturePad.emptyHint": "Signez avec le doigt ou la souris",
  "signaturePad.filledHint": "Signature enregistree",
  "signaturePad.clear": "Effacer",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    let template = translations[key] ?? key;
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        template = template.replace(`{${k}}`, String(v));
      }
    }
    return template;
  },
  useLocale: () => "fr",
}));

const mockGetBonLivraison = vi.fn();
const mockCreateBonLivraison = vi.fn();
const mockSignerBonLivraison = vi.fn();

vi.mock("@/services", () => ({
  useVenteService: () => ({
    getBonLivraison: mockGetBonLivraison,
    createBonLivraison: mockCreateBonLivraison,
    signerBonLivraison: mockSignerBonLivraison,
  }),
}));

// ---------------------------------------------------------------------------
// Donnees de test
// ---------------------------------------------------------------------------

const baseBonLivraison = {
  id: "bl-1",
  numero: "BL-2026-001",
  venteId: "vente-1",
  statut: StatutBonLivraison.BROUILLON,
  signatureClient: null,
  signataireClientNom: null,
  signatureLivreur: null,
  signeLe: null,
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date("2026-07-01").toISOString(),
  updatedAt: new Date("2026-07-01").toISOString(),
};

const baseVente = {
  client: { id: "client-1", nom: "Restaurant Le Mboa" },
  lignes: [
    {
      id: "ligne-1",
      poidsTotalKg: 40,
      poidsMoyenG: 850,
      nombrePoissons: 47,
      vague: { code: "VAG-001" },
      bac: { nom: "Bac A" },
    },
  ],
};

const blocPaiement = { totalVente: 100000, paye: 20000, resteAPayer: 80000 };

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1 — Etape recap
// ---------------------------------------------------------------------------

describe("BonLivraisonFlow — Etape recap", () => {
  it("affiche le numero, les lignes et le bloc paiement apres chargement", async () => {
    mockGetBonLivraison.mockResolvedValue({
      ok: true,
      data: { bonLivraison: baseBonLivraison, vente: baseVente, blocPaiement },
    });

    render(
      <BonLivraisonFlow
        open
        onOpenChange={() => {}}
        venteId="vente-1"
        currentUserName="Livreur Test"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("BL-2026-001")).toBeInTheDocument();
    });

    expect(screen.getByText(/Restaurant Le Mboa/)).toBeInTheDocument();
    expect(screen.getByText(/VAG-001/)).toBeInTheDocument();
    expect(screen.getByText("Faire signer")).toBeInTheDocument();
  });

  it("cree le BL (idempotent) si aucun n'existe encore pour la vente", async () => {
    mockGetBonLivraison
      .mockResolvedValueOnce({ ok: false, error: "Aucun bon de livraison pour cette vente." })
      .mockResolvedValueOnce({
        ok: true,
        data: { bonLivraison: baseBonLivraison, vente: baseVente, blocPaiement },
      });
    mockCreateBonLivraison.mockResolvedValue({ ok: true, data: baseBonLivraison });

    render(
      <BonLivraisonFlow
        open
        onOpenChange={() => {}}
        venteId="vente-1"
        currentUserName="Livreur Test"
      />
    );

    await waitFor(() => {
      expect(mockCreateBonLivraison).toHaveBeenCalledWith("vente-1");
    });

    await waitFor(() => {
      expect(screen.getByText("BL-2026-001")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Navigation vers la signature client
// ---------------------------------------------------------------------------

describe("BonLivraisonFlow — Navigation signature", () => {
  it("passe a l'etape signature client au clic sur 'Faire signer'", async () => {
    mockGetBonLivraison.mockResolvedValue({
      ok: true,
      data: { bonLivraison: baseBonLivraison, vente: baseVente, blocPaiement },
    });

    render(
      <BonLivraisonFlow
        open
        onOpenChange={() => {}}
        venteId="vente-1"
        currentUserName="Livreur Test"
      />
    );

    await waitFor(() => screen.getByText("Faire signer"));
    fireEvent.click(screen.getByText("Faire signer"));

    await waitFor(() => {
      expect(screen.getByText("Nom du signataire")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — BL deja signe (consultation lecture seule)
// ---------------------------------------------------------------------------

describe("BonLivraisonFlow — BL deja signe", () => {
  it("affiche directement l'etape finale avec les signatures", async () => {
    mockGetBonLivraison.mockResolvedValue({
      ok: true,
      data: {
        bonLivraison: {
          ...baseBonLivraison,
          statut: StatutBonLivraison.SIGNE,
          signatureClient: "data:image/png;base64,client",
          signataireClientNom: "Jean Mballa",
          signatureLivreur: "data:image/png;base64,livreur",
          signeLe: new Date("2026-07-02").toISOString(),
        },
        vente: baseVente,
        blocPaiement,
      },
    });

    render(
      <BonLivraisonFlow
        open
        onOpenChange={() => {}}
        venteId="vente-1"
        currentUserName="Livreur Test"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Bon de livraison signe")).toBeInTheDocument();
    });

    expect(screen.getByText("Telecharger le PDF")).toBeInTheDocument();
    expect(screen.getByText("Partager").closest("button")).not.toBeDisabled();
  });
});
