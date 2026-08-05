// @vitest-environment jsdom
/**
 * Tests (legers) — DepenseVenteDialog, libelles de categorie dans le select
 * du formulaire (ERR-176, story C.4 du sprint PR3-ter).
 *
 * Objectif : prouver que les options de categorie proposees viennent du
 * referentiel i18n partage `depenses.categories.*` (namespace "depenses")
 * et non d'une table `CATEGORIE_LABELS` codee en dur locale au composant.
 *
 * Discrimination (ERR-160) : le mock next-intl fournit, pour la cle
 * `depenses.categories.TRANSPORT`, une valeur volontairement DIFFERENTE
 * ("TRANSPORT-I18N-MARKER") du libelle code en dur qui existait avant le
 * fix ("Transport"). Si le composant lisait encore une table locale, ce
 * test echouerait : le marqueur ne serait jamais rendu.
 *
 * Le module "@/components/ui/select" est mocke par une version minimale qui
 * rend toujours ses enfants (sans passer par l'ouverture Radix reelle) —
 * seul le contenu texte des SelectItem nous interesse ici, pas le
 * comportement d'ouverture/fermeture du menu (deja hors perimetre de cette
 * story, et couvert ailleurs pour d'autres composants).
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DepenseVenteDialog } from "@/components/ventes/depense-vente-dialog";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children?: React.ReactNode; value?: string }) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
}));

const ventesDepensesFormDict: Record<string, string> = {
  "add": "Ajouter",
  "form.title": "Nouvelle depense de vente",
  "form.description": "Description",
  "form.descriptionPlaceholder": "Ex: Transport client...",
  "form.montantTotal": "Montant total (FCFA)",
  "form.categorie": "Categorie",
  "form.date": "Date",
  "form.cancel": "Annuler",
  "form.submit": "Ajouter",
  "empty": "Aucune depense.",
};

// Referentiel partage `depenses.*` — celui que le composant DOIT consulter.
const depensesSharedDict: Record<string, string> = {
  "categories.TRANSPORT": "TRANSPORT-I18N-MARKER",
  "categories.INTRANT": "Intrant",
  "categories.EQUIPEMENT": "Équipement",
  "categories.ELECTRICITE": "Électricité",
  "categories.EAU": "Eau",
  "categories.LOYER": "Loyer",
  "categories.SALAIRE": "Salaire",
  "categories.VETERINAIRE": "Vétérinaire",
  "categories.REPARATION": "Réparation",
  "categories.INVESTISSEMENT": "Investissement",
  "categories.AUTRE": "Autre",
};

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    if (namespace === "depenses") {
      return depensesSharedDict[key] ?? `MISSING:${key}`;
    }
    // namespace === "ventes.depenses"
    return ventesDepensesFormDict[key] ?? key;
  },
}));

describe("DepenseVenteDialog — libelles de categorie (ERR-176)", () => {
  it("affiche les options de categorie depuis le referentiel i18n partage `depenses.categories.*`, pas une table codee en dur", () => {
    render(<DepenseVenteDialog venteId="vente-1" />);

    // Le dialog n'a pas de trigger custom ici -> le trigger par defaut
    // rend le SelectContent (mocke pour toujours rendre ses enfants) dans
    // le DOM des que le Dialog Radix est ouvert. On ouvre le dialog en
    // cliquant sur le bouton "Ajouter" par defaut.
    fireEvent.click(screen.getByText("Ajouter"));

    expect(screen.getByTestId("select-item-TRANSPORT").textContent).toBe(
      "TRANSPORT-I18N-MARKER"
    );
    // L'ancien libelle code en dur ("Transport") coincide ici avec le
    // marqueur uniquement s'il n'a pas ete remplace — comme le marqueur
    // choisi est distinct, toute regression vers la table codee en dur
    // ferait echouer l'assertion ci-dessus (elle afficherait "Transport").
  });
});
