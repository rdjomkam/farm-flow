// @vitest-environment jsdom
/**
 * Tests (legers) — BonLivraisonFlow (Story BL.4, etendus Sprint BF — Story BF.3)
 *
 * Composant : src/components/ventes/bon-livraison-flow.tsx
 * Flux mobile multi-etapes : quantites -> recap -> signature client -> signature livreur -> signe.
 *
 * Couverture :
 * 1. Etape quantites affichee en premier, prereplie depuis les lignes du BL
 * 2. Appel de enregistrerQuantitesBonLivraison au clic "Suivant"
 * 3. Etape recap affichee apres, avec le poids LIVRE saisi (pas le commande)
 * 4. Navigation recap -> signature client (bouton "Faire signer")
 * 5. Etat "deja signe" -> saute directement a l'etape finale avec signatures
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

const bonLivraisonTranslations: Record<string, string> = {
  title: "Bon de livraison",
  loading: "Chargement du bon de livraison...",
  back: "Retour",
  next: "Suivant",
  validating: "Validation...",
  close: "Fermer",
  "quantites.instructions": "Saisissez les quantites reellement livrees.",
  "quantites.dateLivraisonLabel": "Date de livraison",
  "recap.client": "Client",
  "recap.date": "Date",
  "recap.lignesTitle": "Lignes livrees",
  "recap.poissons": "poissons",
  "recap.totalVente": "Total vente",
  "recap.paye": "Paye a ce jour",
  "recap.resteAPayer": "Reste a payer",
  "recap.fairesigner": "Faire signer",
  "recap.ecartLabel": "Commande : {kgCommande} kg (ecart {kg} kg)",
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

const livraisonAvarieTranslations: Record<string, string> = {
  poidsLivreLabel: "Poids livre (kg)",
  mortsTransportLabel: "Poissons morts en transport",
  motifLabel: "Motif d'avarie (optionnel)",
  motifPlaceholder: "Ex : chaleur, temps trajet, oxygene",
  pertePoidsLabel: "Perte poids : {kg} kg",
  totalLivreLabel: "Total livre : {kgLivre} / {kgCommande} kg",
  totalMortsLabel: "Morts transport : {nb}",
  totalPoissonsLivreLabel: "Poissons livres : {nb}",
};

function interpolate(template: string, values?: Record<string, unknown>) {
  let result = template;
  if (values) {
    for (const [k, v] of Object.entries(values)) {
      result = result.replace(`{${k}}`, String(v));
    }
  }
  return result;
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const dict =
      namespace === "ventes.livraisonAvarie"
        ? livraisonAvarieTranslations
        : bonLivraisonTranslations;
    return interpolate(dict[key] ?? key, values);
  },
  useLocale: () => "fr",
}));

const mockGetBonLivraison = vi.fn();
const mockCreateBonLivraison = vi.fn();
const mockSignerBonLivraison = vi.fn();
const mockEnregistrerQuantitesBonLivraison = vi.fn();

vi.mock("@/services", () => ({
  useVenteService: () => ({
    getBonLivraison: mockGetBonLivraison,
    createBonLivraison: mockCreateBonLivraison,
    signerBonLivraison: mockSignerBonLivraison,
    enregistrerQuantitesBonLivraison: mockEnregistrerQuantitesBonLivraison,
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
  dateLivraison: null,
  signatureClient: null,
  signataireClientNom: null,
  signatureLivreur: null,
  signeLe: null,
  userId: "user-1",
  siteId: "site-1",
  createdAt: new Date("2026-07-01").toISOString(),
  updatedAt: new Date("2026-07-01").toISOString(),
  lignes: [
    {
      id: "ligne-bl-1",
      bonLivraisonId: "bl-1",
      ligneVenteId: "ligne-1",
      poidsLivreKg: 40,
      nombreMortsTransport: 0,
      motifAvarie: null,
      siteId: "site-1",
      createdAt: new Date("2026-07-01").toISOString(),
      updatedAt: new Date("2026-07-01").toISOString(),
    },
  ],
};

const baseVente = {
  client: { id: "client-1", nom: "Restaurant Le Mboa" },
  prixUnitaireKg: 2500,
  poidsTotalKg: 40,
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
// Suite 1 — Etape quantites (premiere etape du flux)
// ---------------------------------------------------------------------------

describe("BonLivraisonFlow — Etape quantites", () => {
  it("affiche l'etape quantites en premier, prereplie depuis les lignes du BL", async () => {
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
      expect(screen.getByText("Date de livraison")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Poids livre (kg)")).toHaveValue(40);
    expect(screen.getByLabelText("Poissons morts en transport")).toHaveValue(0);
  });

  it("appelle enregistrerQuantitesBonLivraison au clic sur Suivant, puis affiche le recap", async () => {
    mockGetBonLivraison.mockResolvedValue({
      ok: true,
      data: { bonLivraison: baseBonLivraison, vente: baseVente, blocPaiement },
    });
    mockEnregistrerQuantitesBonLivraison.mockResolvedValue({
      ok: true,
      data: { ...baseBonLivraison, statut: "EN_ATTENTE_SIGNATURE" },
    });

    render(
      <BonLivraisonFlow
        open
        onOpenChange={() => {}}
        venteId="vente-1"
        currentUserName="Livreur Test"
      />
    );

    await waitFor(() => screen.getByText("Suivant"));
    fireEvent.click(screen.getByText("Suivant"));

    await waitFor(() => {
      expect(mockEnregistrerQuantitesBonLivraison).toHaveBeenCalledWith(
        "bl-1",
        expect.objectContaining({
          lignes: [
            expect.objectContaining({
              ligneVenteId: "ligne-1",
              poidsLivreKg: 40,
              nombreMortsTransport: 0,
            }),
          ],
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("BL-2026-001")).toBeInTheDocument();
    });
  });

  it("affiche le recap avec le poids reellement livre (pas le poids commande)", async () => {
    // 1er appel (chargement initial) : BL brouillon, poids commande = 40 kg
    // 2e appel (rechargement post-quantites) : ligne mise a jour a 35 kg livres
    mockGetBonLivraison
      .mockResolvedValueOnce({
        ok: true,
        data: { bonLivraison: baseBonLivraison, vente: baseVente, blocPaiement },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          bonLivraison: {
            ...baseBonLivraison,
            lignes: [{ ...baseBonLivraison.lignes[0], poidsLivreKg: 35 }],
          },
          vente: baseVente,
          blocPaiement,
        },
      });
    mockEnregistrerQuantitesBonLivraison.mockResolvedValue({
      ok: true,
      data: { ...baseBonLivraison, statut: "EN_ATTENTE_SIGNATURE" },
    });

    render(
      <BonLivraisonFlow
        open
        onOpenChange={() => {}}
        venteId="vente-1"
        currentUserName="Livreur Test"
      />
    );

    await waitFor(() => screen.getByLabelText("Poids livre (kg)"));
    fireEvent.change(screen.getByLabelText("Poids livre (kg)"), {
      target: { value: "35" },
    });

    fireEvent.click(screen.getByText("Suivant"));

    await waitFor(() => {
      expect(mockEnregistrerQuantitesBonLivraison).toHaveBeenCalledWith(
        "bl-1",
        expect.objectContaining({
          lignes: [expect.objectContaining({ poidsLivreKg: 35 })],
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("35 kg")).toBeInTheDocument();
    });
    expect(screen.queryByText("40 kg")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Navigation vers la signature client
// ---------------------------------------------------------------------------

describe("BonLivraisonFlow — Navigation signature", () => {
  async function goToRecap() {
    mockGetBonLivraison.mockResolvedValue({
      ok: true,
      data: { bonLivraison: baseBonLivraison, vente: baseVente, blocPaiement },
    });
    mockEnregistrerQuantitesBonLivraison.mockResolvedValue({
      ok: true,
      data: { ...baseBonLivraison, statut: "EN_ATTENTE_SIGNATURE" },
    });

    render(
      <BonLivraisonFlow
        open
        onOpenChange={() => {}}
        venteId="vente-1"
        currentUserName="Livreur Test"
      />
    );

    await waitFor(() => screen.getByText("Suivant"));
    fireEvent.click(screen.getByText("Suivant"));
    await waitFor(() => screen.getByText("Faire signer"));
  }

  it("passe a l'etape signature client au clic sur 'Faire signer'", async () => {
    await goToRecap();

    fireEvent.click(screen.getByText("Faire signer"));

    await waitFor(() => {
      expect(screen.getByText("Nom du signataire")).toBeInTheDocument();
    });
  });

  it("pre-remplit le nom du signataire avec le nom du client", async () => {
    await goToRecap();

    fireEvent.click(screen.getByText("Faire signer"));

    await waitFor(() => {
      expect(screen.getByLabelText("Nom du signataire")).toHaveValue(
        "Restaurant Le Mboa"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — BL deja signe (consultation lecture seule)
// ---------------------------------------------------------------------------

describe("BonLivraisonFlow — BL deja signe", () => {
  it("affiche directement l'etape finale avec les signatures (saute quantites/recap)", async () => {
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
    expect(mockEnregistrerQuantitesBonLivraison).not.toHaveBeenCalled();
  });
});
