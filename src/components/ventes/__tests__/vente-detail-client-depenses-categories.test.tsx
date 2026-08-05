// @vitest-environment jsdom
/**
 * Tests (legers) — VenteDetailClient, libelle de categorie d'une depense
 * associee a une vente (ERR-176, story C.4 du sprint PR3-ter).
 *
 * Objectif : prouver que le libelle de categorie affiche dans la carte
 * "Depenses associees" vient bien du referentiel i18n partage `depenses.*`
 * (namespace "depenses", cle `categories.<CATEGORIE>`) et non d'une table
 * `CATEGORIE_DEPENSE_LABELS` codee en dur locale au composant.
 *
 * Discrimination (ERR-160) : le mock next-intl fournit, pour la cle
 * `depenses.categories.EQUIPEMENT`, une valeur volontairement DIFFERENTE
 * ("ÉQUIPEMENT-I18N-MARKER") de l'ancien libelle code en dur qui existait
 * avant le fix ("Equipements", sans accent). Si le composant lisait encore
 * une table locale au lieu d'appeler `useTranslations("depenses")`, ce test
 * echouerait : il ne trouverait jamais le marqueur, seulement "Equipements".
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VenteDetailClient } from "@/components/ventes/vente-detail-client";
import { StatutVente, Permission } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/services", () => ({
  useVenteService: () => ({
    createFacture: vi.fn(),
    updateVente: vi.fn(),
    cloturerDefinitivement: vi.fn(),
    deleteVente: vi.fn(),
    creerBonLivraisonRectificatif: vi.fn(),
  }),
}));

vi.mock("@/components/ventes/depense-vente-dialog", () => ({
  DepenseVenteDialog: () => null,
}));
vi.mock("@/components/ventes/delete-depense-confirm-dialog", () => ({
  DeleteDepenseConfirmDialog: () => null,
}));
vi.mock("@/components/ventes/bon-livraison-flow", () => ({
  BonLivraisonFlow: () => null,
}));

// ---------------------------------------------------------------------------
// Mock next-intl — deux namespaces distincts, valeurs volontairement
// divergentes du "faux" referentiel local historique pour discriminer.
// ---------------------------------------------------------------------------

const ventesDict: Record<string, string> = {
  "ventes.detail.back": "Ventes",
  "ventes.detail.menuAria": "Actions",
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
  "ventes.detail.factureApresLivraison": "La facture sera disponible.",
  "ventes.sansFature": "Sans facture",
  "depenses.title": "Depenses associees",
  "depenses.empty": "Aucune depense associee.",
  "depenses.closedSaleInfo": "Vente cloturee.",
  "depenses.editAria": "Modifier la depense",
  "depenses.recap.brut": "Montant brut",
  "depenses.recap.depenses": "Depenses",
  "depenses.recap.net": "Montant net",
};

// Referentiel partage `depenses.*` (namespace distinct de "ventes") — c'est
// celui que le composant DOIT consulter pour les libelles de categorie.
const depensesSharedDict: Record<string, string> = {
  "categories.EQUIPEMENT": "ÉQUIPEMENT-I18N-MARKER",
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
    if (namespace === "depenses") {
      return depensesSharedDict[key] ?? `MISSING:${key}`;
    }
    // namespace === "ventes" : les cles sont deja prefixees "ventes.xxx" ou
    // "depenses.xxx" (sous-namespace "ventes.depenses" en pratique) dans le
    // composant reel, on les retrouve donc telles quelles dans ventesDict.
    return interpolate(ventesDict[key] ?? key, values);
  },
  useLocale: () => "fr",
}));

// ---------------------------------------------------------------------------
// Donnees
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
  statut: StatutVente.EN_PREPARATION,
  dateLivraison: null,
  poidsCommandeKg: null,
  quantiteCommandee: null,
  poidsLivreKg: null,
  quantiteLivree: null,
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
  depenses: [
    {
      id: "dep-1",
      description: "Achat de bacs",
      categorieDepense: "EQUIPEMENT",
      date: "2026-01-05T00:00:00.000Z",
      montantTotal: 15000,
      statut: "PAYEE",
    },
  ],
};

describe("VenteDetailClient — libelle de categorie de depense (ERR-176)", () => {
  it(
    "affiche le libelle de categorie depuis le referentiel i18n partage `depenses.categories.*`, pas une table codee en dur",
    () => {
      const { container } = render(
        <VenteDetailClient
          vente={baseVente}
          permissions={[Permission.VENTES_MODIFIER, Permission.DEPENSES_CREER]}
        />
      );

      // Le libelle de categorie est un noeud texte parmi d'autres frères
      // (" · ", la date) dans la même div — pas un élément isolé — d'où la
      // vérification sur le texte du conteneur plutôt qu'un getByText exact.
      expect(container.textContent).toContain("ÉQUIPEMENT-I18N-MARKER");
      // L'ancien libelle code en dur ("Equipements", sans accent) ne doit
      // plus jamais apparaitre.
      expect(container.textContent).not.toContain("Equipements");
    }
  );
});
