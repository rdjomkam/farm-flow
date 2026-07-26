// @vitest-environment jsdom
/**
 * Tests (legers) — VenteDetailClient, action de rectification du bon de
 * livraison (Sprint BF phase 2, Story BF.7b).
 *
 * Composant : src/components/ventes/vente-detail-client.tsx
 *
 * Couverture :
 * 1. Action "Rectifier le bon de livraison" masquee sans la permission
 * 2. Masquee si la vente est CLOTUREE
 * 3. Masquee si le BL actif n'est pas SIGNE
 * 4. Visible quand toutes les conditions sont reunies
 * 5. Motif trop court -> bouton de confirmation desactive
 * 6. Appel de creerBonLivraisonRectificatif avec les bons arguments
 * 7. Toast d'erreur explicite en cas d'echec de l'appel
 *
 * Note perf (stabilisation, cf. BF.7b) : ces tests interagissent avec un
 * DropdownMenu Radix (ouverture au pointerdown) et des boutons/dialogues
 * simples. `@testing-library/user-event` simule un pointeur reel
 * (pointerover/move/down/up/click) et recalcule a chaque etape
 * l'accessibilite de tout l'arbre DOM avec jsdom — sur cette page (assez
 * riche : cartes, badges, historique...), cela mesurait ~2-3s PAR
 * interaction, au point de flirter avec le timeout par defaut de 5s en
 * suite complete. Comme Radix ouvre son DropdownMenu sur l'evenement
 * `pointerdown` (pas `click`) et que les items/boutons reagissent a
 * `click`, on utilise ici `fireEvent` (evenements DOM directs, sans la
 * simulation de trajectoire du pointeur) pour piloter le menu et les
 * dialogues, et `fireEvent.change` pour la saisie du textarea plutot que
 * `userEvent.type` (qui tape caractere par caractere). Le comportement
 * observe et les assertions restent strictement les memes ; seule la
 * mecanique d'interaction est plus directe.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { VenteDetailClient } from "@/components/ventes/vente-detail-client";
import { StatutBonLivraison, StatutVente, Permission } from "@/types";

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

const ventesDict: Record<string, string> = {
  "ventes.detail.back": "Ventes",
  "ventes.detail.menuAria": "Actions",
  "ventes.detail.modifier": "Modifier",
  "ventes.detail.cloturerDefinitivement": "Cloturer definitivement",
  "ventes.detail.genererFacture": "Generer la facture",
  "ventes.detail.deleteConfirm": "Supprimer la vente",
  "ventes.detail.detailVente": "Detail de la vente",
  "ventes.detail.poissons": "Poissons",
  "ventes.detail.poidsTotalKg": "Poids total",
  "ventes.detail.prixKg": "Prix/kg",
  "ventes.detail.client": "Client",
  "ventes.detail.dateCommande": "Date de commande",
  "ventes.detail.montantEstime": "Montant estime (commande)",
  "ventes.detail.montantFinal": "Montant final (livre)",
  "ventes.detail.creePar": "Cree par {name}",
  "ventes.detail.multipleBatches": "Lots multiples",
  "ventes.detail.factureApresLivraison":
    "La facture sera disponible apres la cloture de livraison.",
  "ventes.sansFature": "Sans facture",
  "bonLivraison.menuItem": "Bon de livraison",
  "bonLivraison.menuItemVoir": "Voir le bon de livraison",
  "bonLivraison.linkTitle": "Bon de livraison",
  "bonLivraison.statutSigne": "Signe",
  "bonLivraison.rectifier.menuItem": "Rectifier le bon de livraison",
  "bonLivraison.rectifier.title": "Rectification du bon de livraison",
  "bonLivraison.rectifier.description":
    "Un nouveau bon sera cree et devra etre signe a nouveau.",
  "bonLivraison.rectifier.warning":
    "Le bon d'origine reste consultable comme document historique.",
  "bonLivraison.rectifier.motifLabel": "Motif de la rectification",
  "bonLivraison.rectifier.motifPlaceholder": "Expliquez la raison...",
  "bonLivraison.rectifier.motifHint": "{count}/500 caracteres (5 minimum)",
  "bonLivraison.rectifier.confirmer": "Creer le rectificatif",
  "bonLivraison.rectifier.error":
    "Erreur lors de la creation du bon de livraison rectificatif.",
  "bonLivraison.historique.title": "Historique des bons de livraison",
  "bonLivraison.historique.remplace": "Annule et remplace",
  "bonLivraison.historique.remplacePar": "Remplace par {numero}",
  "bonLivraison.historique.motif": "Motif : {motif}",
  "bonLivraison.historique.pdf": "PDF",
  "paiements.cancel": "Annuler",
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
    if (namespace === "common.buttons") return key;
    const fullKey = key;
    return interpolate(ventesDict[fullKey] ?? fullKey, values);
  },
  useLocale: () => "fr",
}));

// Composants enfants non testes ici — stubs legers
vi.mock("@/components/ventes/depense-vente-dialog", () => ({
  DepenseVenteDialog: () => null,
}));
vi.mock("@/components/ventes/delete-depense-confirm-dialog", () => ({
  DeleteDepenseConfirmDialog: () => null,
}));
vi.mock("@/components/ventes/bon-livraison-flow", () => ({
  BonLivraisonFlow: ({ open }: { open: boolean }) =>
    open ? <div data-testid="bon-livraison-flow-open" /> : null,
}));

const mockCreerBonLivraisonRectificatif = vi.fn();

vi.mock("@/services", () => ({
  useVenteService: () => ({
    createFacture: vi.fn(),
    updateVente: vi.fn(),
    cloturerDefinitivement: vi.fn(),
    deleteVente: vi.fn(),
    creerBonLivraisonRectificatif: mockCreerBonLivraisonRectificatif,
  }),
}));

// ---------------------------------------------------------------------------
// Donnees de test
// ---------------------------------------------------------------------------

const baseVente = {
  id: "vente-1",
  numero: "V-2026-001",
  quantitePoissons: 100,
  poidsTotalKg: 40,
  prixUnitaireKg: 2000,
  montantTotal: 80000,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  dateCommande: "2026-01-01T00:00:00.000Z",
  statut: StatutVente.LIVREE,
  dateLivraison: "2026-01-02T00:00:00.000Z",
  poidsCommandeKg: 40,
  quantiteCommandee: 100,
  poidsLivreKg: 40,
  quantiteLivree: 100,
  client: {
    id: "client-1",
    nom: "Jean Mballa",
    telephone: null,
    email: null,
    adresse: null,
  },
  vague: { id: "vague-1", code: "V-01", statut: "EN_COURS" },
  user: { id: "user-1", name: "Admin" },
  facture: null,
  lignes: [],
  releves: [],
  depenses: [],
  bonLivraisonActif: {
    id: "bl-1",
    numero: "BL-2026-001",
    statut: StatutBonLivraison.SIGNE,
  },
};

const basePermissions = [
  Permission.VENTES_MODIFIER,
  Permission.BONS_LIVRAISON_RECTIFIER,
];

function renderComponent(overrides?: {
  vente?: Partial<typeof baseVente>;
  permissions?: Permission[];
}) {
  return render(
    <VenteDetailClient
      vente={{ ...baseVente, ...(overrides?.vente ?? {}) }}
      permissions={overrides?.permissions ?? basePermissions}
    />
  );
}

/**
 * Ouvre le DropdownMenu "Actions". Radix ouvre ce menu sur l'evenement
 * `pointerdown` (pas `click`, cf. DropdownMenuTrigger) — on le declenche
 * donc directement plutot que de passer par la sequence complete
 * hover+pointerdown+pointerup+click de `userEvent.click`.
 */
function openActionsMenu() {
  const trigger = screen.getByLabelText("Actions");
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Ouvrir le DropdownMenu Radix declenche le montage d'un Portal avec
// FocusScope (TreeWalker sur tout le conteneur) + positionnement Popper —
// un cout de rendu jsdom incompressible (~0.5-2.5s selon la charge CPU de la
// machine), qui n'est pas lie a la facon dont on simule le clic (confirme en
// comparant fireEvent vs userEvent : identique une fois le clic lui-meme
// accelere). En suite complete (5000+ tests en parallele), la charge CPU
// ambiante peut pousser ce cout au-dela du timeout par defaut de 5s — on
// l'augmente donc explicitement ici, comme pour le cout bcrypt dans
// src/__tests__/auth/password.test.ts.
const OPEN_MENU_TIMEOUT = 15000;

describe("VenteDetailClient — rectification du bon de livraison (BF.7b)", () => {
  it(
    "masque l'action de rectification sans la permission BONS_LIVRAISON_RECTIFIER",
    () => {
      renderComponent({ permissions: [Permission.VENTES_MODIFIER] });
      openActionsMenu();
      expect(
        screen.queryByText("Rectifier le bon de livraison")
      ).not.toBeInTheDocument();
    },
    OPEN_MENU_TIMEOUT
  );

  it("masque l'action si la vente est CLOTUREE", () => {
    // Une vente CLOTUREE masque l'ensemble du menu d'actions (canEdit),
    // ce qui masque de facto l'action de rectification.
    renderComponent({ vente: { statut: StatutVente.CLOTUREE } });
    expect(
      screen.queryByRole("button", { name: "Actions" })
    ).not.toBeInTheDocument();
  });

  it(
    "masque l'action si le bon de livraison actif n'est pas signe",
    () => {
      renderComponent({
        vente: {
          bonLivraisonActif: {
            id: "bl-1",
            numero: "BL-2026-001",
            statut: StatutBonLivraison.BROUILLON,
          },
        },
      });
      openActionsMenu();
      expect(
        screen.queryByText("Rectifier le bon de livraison")
      ).not.toBeInTheDocument();
    },
    OPEN_MENU_TIMEOUT
  );

  it(
    "affiche l'action quand toutes les conditions sont reunies",
    () => {
      renderComponent();
      openActionsMenu();
      expect(
        screen.getByText("Rectifier le bon de livraison")
      ).toBeInTheDocument();
    },
    OPEN_MENU_TIMEOUT
  );

  it(
    "desactive le bouton de confirmation tant que le motif est trop court",
    () => {
      renderComponent();
      openActionsMenu();
      fireEvent.click(screen.getByText("Rectifier le bon de livraison"));

      const confirmButton = screen.getByRole("button", {
        name: "Creer le rectificatif",
      });
      expect(confirmButton).toBeDisabled();

      const textarea = screen.getByPlaceholderText("Expliquez la raison...");
      fireEvent.change(textarea, { target: { value: "abc" } });
      expect(confirmButton).toBeDisabled();

      fireEvent.change(textarea, {
        target: { value: "abcde plus de 5 caracteres" },
      });
      expect(confirmButton).toBeEnabled();
    },
    OPEN_MENU_TIMEOUT
  );

  it(
    "appelle creerBonLivraisonRectificatif avec le bon id et le motif saisi",
    async () => {
      mockCreerBonLivraisonRectificatif.mockResolvedValue({
        ok: true,
        data: { id: "bl-2" },
        error: null,
      });
      renderComponent();
      openActionsMenu();
      fireEvent.click(screen.getByText("Rectifier le bon de livraison"));

      const textarea = screen.getByPlaceholderText("Expliquez la raison...");
      fireEvent.change(textarea, {
        target: { value: "Erreur de poids saisie a la livraison" },
      });

      const confirmButton = screen.getByRole("button", {
        name: "Creer le rectificatif",
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockCreerBonLivraisonRectificatif).toHaveBeenCalledWith("bl-1", {
          bonLivraisonOrigineId: "bl-1",
          motifRectification: "Erreur de poids saisie a la livraison",
        });
      });

      // Le flux BL existant est rouvert pour faire signer le rectificatif
      await waitFor(() => {
        expect(screen.getByTestId("bon-livraison-flow-open")).toBeInTheDocument();
      });
    },
    OPEN_MENU_TIMEOUT
  );

  it(
    "affiche un toast d'erreur si la creation du rectificatif echoue",
    async () => {
      mockCreerBonLivraisonRectificatif.mockResolvedValue({
        ok: false,
        data: null,
        error: "La vente n'est plus livree.",
      });
      renderComponent();
      openActionsMenu();
      fireEvent.click(screen.getByText("Rectifier le bon de livraison"));

      const textarea = screen.getByPlaceholderText("Expliquez la raison...");
      fireEvent.change(textarea, {
        target: { value: "Motif suffisamment long pour valider" },
      });

      const confirmButton = screen.getByRole("button", {
        name: "Creer le rectificatif",
      });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "La vente n'est plus livree.",
          variant: "error",
        });
      });

      // Le flux BL ne doit pas s'ouvrir en cas d'echec
      expect(
        screen.queryByTestId("bon-livraison-flow-open")
      ).not.toBeInTheDocument();
    },
    OPEN_MENU_TIMEOUT
  );
});
