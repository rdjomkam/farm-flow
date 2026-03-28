// @vitest-environment jsdom
/**
 * Tests — Toggle actif/inactif des plans (Story 38.3)
 *
 * Composant : src/components/abonnements/plans-admin-list.tsx
 * Route API : PATCH /api/plans/[id]/toggle
 *
 * Couverture :
 * 1. Toggle sans abonnes : bouton "Desactiver" clique -> PATCH appele, plan flip
 * 2. Toggle activation : bouton "Activer" clique -> PATCH appele, plan flip vers actif
 * 3. Mise a jour optimiste : le state local change avant la reponse API
 * 4. Rollback sur erreur 500 : le state local revient a l'original
 * 5. Rollback sur erreur reseau : le state local revient a l'original
 * 6. Dialog de confirmation : plan actif avec abonnes -> dialog avant toggle
 * 7. Annuler le dialog : plan ne change pas, API non appelee
 * 8. Confirmer le dialog : API appelee, plan desactive
 * 9. Erreur 409 : message d'erreur affiche dans la carte/ligne et state revient
 * 10. Indicateur visuel : plans inactifs ont opacity-60 / opacity-70
 * 11. Etat de chargement : bouton affiche "..." pendant la requete
 * 12. Erreur precedente effacee avant chaque nouveau toggle
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { PlansAdminList } from "@/components/abonnements/plans-admin-list";
import { TypePlan } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn();
const mockInvalidateQueries = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }),
  usePathname: () => "/admin/plans",
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const translations: Record<string, string> = {
  "admin.active": "Actif",
  "admin.inactive": "Inactif",
  "admin.unlimited": "Illimité",
  "admin.onQuote": "Sur devis",
  "admin.noModules": "Aucun",
  "admin.public": "Public",
  "admin.private": "Privé",
  "admin.newPlan": "Nouveau plan",
  "admin.allTypes": "Tous les types",
  "admin.allStatuses": "Tous les statuts",
  "admin.reset": "Réinitialiser",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => translations[key] ?? key,
}));

const mockFetch = vi.fn();

// ---------------------------------------------------------------------------
// Donnees de test
// ---------------------------------------------------------------------------

/** Plan actif sans abonnes — toggle direct sans confirmation */
const planActifSansAbonnes = {
  id: "plan-actif-sans-abo",
  nom: "Plan Actif Sans Abo",
  typePlan: TypePlan.ELEVEUR,
  description: null,
  prixMensuel: 3000,
  prixTrimestriel: null,
  prixAnnuel: null,
  limitesSites: 1,
  limitesBacs: 5,
  limitesVagues: 2,
  limitesIngFermes: null,
  isActif: true,
  isPublic: true,
  modulesInclus: [],
  _count: { abonnements: 0 },
};

/** Plan inactif sans abonnes — toggle direct vers activation */
const planInactifSansAbonnes = {
  id: "plan-inactif-sans-abo",
  nom: "Plan Inactif Sans Abo",
  typePlan: TypePlan.DECOUVERTE,
  description: null,
  prixMensuel: 0,
  prixTrimestriel: null,
  prixAnnuel: null,
  limitesSites: 1,
  limitesBacs: 3,
  limitesVagues: 1,
  limitesIngFermes: null,
  isActif: false,
  isPublic: true,
  modulesInclus: [],
  _count: { abonnements: 0 },
};

/** Plan actif AVEC abonnes — doit afficher le dialog de confirmation avant de desactiver */
const planActifAvecAbonnes = {
  id: "plan-actif-avec-abo",
  nom: "Plan Actif Avec Abo",
  typePlan: TypePlan.PROFESSIONNEL,
  description: "Plan avec abonnes actifs",
  prixMensuel: 10000,
  prixTrimestriel: null,
  prixAnnuel: null,
  limitesSites: 2,
  limitesBacs: 10,
  limitesVagues: 5,
  limitesIngFermes: null,
  isActif: true,
  isPublic: true,
  modulesInclus: [],
  _count: { abonnements: 3 },
};

/** Plan actif avec 1 seul abonne — teste le singulier dans le dialog */
const planActifAvec1Abonne = {
  id: "plan-actif-1-abo",
  nom: "Plan Actif 1 Abo",
  typePlan: TypePlan.ENTREPRISE,
  description: null,
  prixMensuel: 25000,
  prixTrimestriel: null,
  prixAnnuel: null,
  limitesSites: 999,
  limitesBacs: 999,
  limitesVagues: 999,
  limitesIngFermes: null,
  isActif: true,
  isPublic: true,
  modulesInclus: [],
  _count: { abonnements: 1 },
};

// ---------------------------------------------------------------------------
// Helpers fetch
// ---------------------------------------------------------------------------

function mockFetchSuccess(data: Record<string, unknown> = { message: "OK" }) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

function mockFetchError(status: number, data: Record<string, unknown> = {}) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(data),
  });
}

function mockFetchNetworkError() {
  mockFetch.mockRejectedValueOnce(new Error("Network error"));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1 — Toggle direct sans abonnes (pas de dialog)
// ---------------------------------------------------------------------------

describe("Toggle — Desactivation directe sans abonnes", () => {
  it("appelle PATCH /api/plans/[id]/toggle au clic sur 'Desactiver'", async () => {
    mockFetchSuccess({ message: "Statut du plan mis a jour.", isActif: false });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Sans Abo/i,
    });
    expect(toggleBtns.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/backoffice/plans/${planActifSansAbonnes.id}/toggle`,
        { method: "PATCH" }
      );
    });
  });

  it("le badge passe de 'Actif' a 'Inactif' apres un toggle reussi", async () => {
    mockFetchSuccess({ message: "OK", isActif: false });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    // Verifier que le plan est initialement actif
    expect(screen.getAllByText("Actif").length).toBeGreaterThanOrEqual(1);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Inactif").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("appelle router.refresh() apres un toggle reussi", async () => {
    mockFetchSuccess({ message: "OK", isActif: false });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Toggle activation (plan inactif)
// ---------------------------------------------------------------------------

describe("Toggle — Activation d'un plan inactif", () => {
  it("appelle PATCH /api/plans/[id]/toggle au clic sur 'Activer'", async () => {
    mockFetchSuccess({ message: "OK", isActif: true });

    render(<PlansAdminList plans={[planInactifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /activer le plan Plan Inactif Sans Abo/i,
    });
    expect(toggleBtns.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/backoffice/plans/${planInactifSansAbonnes.id}/toggle`,
        { method: "PATCH" }
      );
    });
  });

  it("le badge passe de 'Inactif' a 'Actif' apres un toggle reussi", async () => {
    mockFetchSuccess({ message: "OK", isActif: true });

    render(<PlansAdminList plans={[planInactifSansAbonnes]} />);

    expect(screen.getAllByText("Inactif").length).toBeGreaterThanOrEqual(1);

    const toggleBtns = screen.getAllByRole("button", {
      name: /activer le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Actif").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("le libelle du bouton passe de 'Activer' a 'Desactiver' apres activation reussie", async () => {
    mockFetchSuccess({ message: "OK", isActif: true });

    render(<PlansAdminList plans={[planInactifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /activer le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      const desactiverBtns = screen.getAllByRole("button", {
        name: /désactiver le plan/i,
      });
      expect(desactiverBtns.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Mise a jour optimiste
// ---------------------------------------------------------------------------

describe("Toggle — Mise a jour optimiste", () => {
  it("le badge change immediatement apres le clic (avant la reponse API)", async () => {
    // Promise qui ne resout jamais — simule un appel API en attente
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    expect(screen.getAllByText("Actif").length).toBeGreaterThanOrEqual(1);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    // Clic sans attendre la reponse
    fireEvent.click(toggleBtns[0]);

    // Le badge doit changer immediatement (optimistic update)
    await waitFor(() => {
      expect(screen.getAllByText("Inactif").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("le bouton affiche '...' pendant le chargement", async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      const dotsEls = screen.getAllByText("...");
      expect(dotsEls.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Rollback sur erreur 500
// ---------------------------------------------------------------------------

describe("Toggle — Rollback sur erreur serveur (500)", () => {
  it("le badge revient a 'Actif' apres une erreur 500", async () => {
    mockFetchError(500, { message: "Erreur serveur." });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      // Apres rollback, le plan doit etre de nouveau Actif
      expect(screen.getAllByText("Actif").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("un message d'erreur est affiche apres une erreur 500", async () => {
    mockFetchError(500, { message: "Erreur serveur lors du changement." });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      // Le message apparait dans le tableau desktop ET la carte mobile -> getAllByText
      const errMsgs = screen.getAllByText(/Erreur serveur lors du changement\./);
      expect(errMsgs.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("un message d'erreur generique est affiche si le serveur ne fournit pas de message", async () => {
    mockFetchError(500, {});

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      const errMsgs = screen.getAllByText(/Erreur lors du changement de statut\./);
      expect(errMsgs.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Rollback sur erreur reseau
// ---------------------------------------------------------------------------

describe("Toggle — Rollback sur erreur reseau", () => {
  it("le badge revient a l'etat initial apres une erreur reseau", async () => {
    mockFetchNetworkError();

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Actif").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("un message 'Erreur reseau' est affiche apres une erreur reseau", async () => {
    mockFetchNetworkError();

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      const errMsgs = screen.getAllByText(/Erreur réseau\. Veuillez réessayer\./);
      expect(errMsgs.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Dialog de confirmation (plan actif avec abonnes)
// ---------------------------------------------------------------------------

describe("Toggle — Dialog de confirmation (plan avec abonnes actifs)", () => {
  it("affiche un dialog de confirmation au clic sur 'Desactiver' quand plan a des abonnes", async () => {
    render(<PlansAdminList plans={[planActifAvecAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Avec Abo/i,
    });
    expect(toggleBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Désactiver le plan ?")).toBeInTheDocument();
    });
  });

  it("le dialog affiche le nom du plan", async () => {
    render(<PlansAdminList plans={[planActifAvecAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Avec Abo/i,
    });

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent("Plan Actif Avec Abo");
    });
  });

  it("le dialog affiche le nombre d'abonnes (pluriel)", async () => {
    render(<PlansAdminList plans={[planActifAvecAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Avec Abo/i,
    });

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      // 3 abonnes -> "3" et "abonnés actifs"
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("3");
      expect(dialog).toHaveTextContent(/abonné/i);
    });
  });

  it("le dialog affiche le singulier pour 1 abonne", async () => {
    render(<PlansAdminList plans={[planActifAvec1Abonne]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif 1 Abo/i,
    });

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveTextContent("1");
      // Singulier : "abonné actif" (sans 's')
      expect(dialog).toHaveTextContent(/abonné actif/);
    });
  });

  it("ne pas appeler l'API si le dialog est ouvert mais pas encore confirme", async () => {
    render(<PlansAdminList plans={[planActifAvecAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Avec Abo/i,
    });

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Désactiver le plan ?")).toBeInTheDocument();
    });

    // L'API ne doit pas encore avoir ete appelee
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — Annuler le dialog
// ---------------------------------------------------------------------------

describe("Toggle — Annuler le dialog", () => {
  it("ferme le dialog et ne change pas le statut apres annulation", async () => {
    render(<PlansAdminList plans={[planActifAvecAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Avec Abo/i,
    });

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Désactiver le plan ?")).toBeInTheDocument();
    });

    // Cliquer sur Annuler
    fireEvent.click(screen.getByRole("button", { name: /^Annuler$/i }));

    await waitFor(() => {
      expect(screen.queryByText("Désactiver le plan ?")).not.toBeInTheDocument();
    });

    // L'API ne doit pas avoir ete appelee
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("le plan reste 'Actif' apres annulation du dialog", async () => {
    render(<PlansAdminList plans={[planActifAvecAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Avec Abo/i,
    });

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Désactiver le plan ?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^Annuler$/i }));

    await waitFor(() => {
      expect(screen.queryByText("Désactiver le plan ?")).not.toBeInTheDocument();
    });

    // Le badge Actif doit toujours etre present
    expect(screen.getAllByText("Actif").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 8 — Confirmer le dialog
// ---------------------------------------------------------------------------

describe("Toggle — Confirmer la desactivation via le dialog", () => {
  it("appelle PATCH /api/plans/[id]/toggle apres confirmation", async () => {
    mockFetchSuccess({ message: "OK", isActif: false });

    render(<PlansAdminList plans={[planActifAvecAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Avec Abo/i,
    });

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Désactiver le plan ?")).toBeInTheDocument();
    });

    // Confirmer
    const confirmBtn = screen.getByRole("button", {
      name: /confirmer la désactivation/i,
    });

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/backoffice/plans/${planActifAvecAbonnes.id}/toggle`,
        { method: "PATCH" }
      );
    });
  });

  it("le dialog se ferme apres confirmation reussie", async () => {
    mockFetchSuccess({ message: "OK", isActif: false });

    render(<PlansAdminList plans={[planActifAvecAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Avec Abo/i,
    });

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Désactiver le plan ?")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", {
      name: /confirmer la désactivation/i,
    });

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText("Désactiver le plan ?")).not.toBeInTheDocument();
    });
  });

  it("le badge passe a 'Inactif' apres confirmation reussie", async () => {
    mockFetchSuccess({ message: "OK", isActif: false });

    render(<PlansAdminList plans={[planActifAvecAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Avec Abo/i,
    });

    fireEvent.click(toggleBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Désactiver le plan ?")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", {
      name: /confirmer la désactivation/i,
    });

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Inactif").length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 9 — Erreur 409 (abonnes actifs bloquent la desactivation)
// ---------------------------------------------------------------------------

describe("Toggle — Erreur 409 (abonnes actifs)", () => {
  it("affiche un message d'erreur 409 avec le nombre d'abonnes", async () => {
    mockFetchError(409, {
      status: 409,
      message: "Impossible de desactiver un plan avec des abonnes actifs.",
      abonnesActifs: 5,
    });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      // Le composant formate: "Impossible de desactiver un plan avec 5 abonne(s) actif(s)."
      // Apparait dans tableau desktop ET carte mobile -> getAllByText
      const errMsgs = screen.getAllByText(/Impossible de désactiver un plan avec 5 abonné/);
      expect(errMsgs.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("le plan revient a 'Actif' apres une erreur 409", async () => {
    mockFetchError(409, {
      status: 409,
      message: "Impossible.",
      abonnesActifs: 2,
    });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      expect(screen.getAllByText("Actif").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("le message 409 utilise le singulier quand abonnesActifs = 1", async () => {
    mockFetchError(409, {
      status: 409,
      message: "Impossible.",
      abonnesActifs: 1,
    });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      // Singulier : "abonne actif" sans 's' — apparait dans tableau + carte
      const errMsgs = screen.getAllByText(/1 abonné actif/);
      expect(errMsgs.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("le message 409 utilise le pluriel quand abonnesActifs > 1", async () => {
    mockFetchError(409, {
      status: 409,
      message: "Impossible.",
      abonnesActifs: 7,
    });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      // Pluriel : "abonnes actifs" — apparait dans tableau + carte
      const errMsgs = screen.getAllByText(/7 abonnés actifs/);
      expect(errMsgs.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 10 — Indicateur visuel (opacite reduite pour plans inactifs)
// ---------------------------------------------------------------------------

describe("Toggle — Indicateur visuel opacite pour plans inactifs", () => {
  it("un plan inactif a la classe opacity-60 ou opacity-70 (tableau ou carte)", () => {
    render(<PlansAdminList plans={[planInactifSansAbonnes]} />);

    // Le tableau desktop utilise opacity-60, les cartes mobiles opacity-70
    const container = document.querySelector(".opacity-60, .opacity-70");
    expect(container).not.toBeNull();
  });

  it("un plan actif n'a pas de classe opacity reduite", () => {
    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const container = document.querySelector(".opacity-60, .opacity-70");
    expect(container).toBeNull();
  });

  it("apres desactivation reussie, le plan prend l'apparence inactive", async () => {
    mockFetchSuccess({ message: "OK", isActif: false });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    // Verifier qu'initialement pas d'opacite reduite
    expect(document.querySelector(".opacity-60, .opacity-70")).toBeNull();

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      // Apres desactivation, l'opacite reduite doit apparaitre
      const container = document.querySelector(".opacity-60, .opacity-70");
      expect(container).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 11 — Effacement de l'erreur precedente
// ---------------------------------------------------------------------------

describe("Toggle — Effacement de l'erreur precedente", () => {
  it("l'erreur precedente est effacee avant un nouveau toggle", async () => {
    // Premier toggle : echec
    mockFetchError(500, { message: "Premiere erreur." });

    render(<PlansAdminList plans={[planActifSansAbonnes]} />);

    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(toggleBtns[0]);
    });

    await waitFor(() => {
      // Le message apparait dans tableau + carte (double occurrence)
      const errMsgs = screen.getAllByText("Premiere erreur.");
      expect(errMsgs.length).toBeGreaterThanOrEqual(1);
    });

    // Deuxieme toggle : succes — le plan est toujours actif apres rollback
    mockFetchSuccess({ message: "OK", isActif: false });

    // Apres rollback le bouton est revenu a "Desactiver"
    const newToggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan/i,
    });

    await act(async () => {
      fireEvent.click(newToggleBtns[0]);
    });

    await waitFor(() => {
      // L'erreur precedente doit avoir disparu
      expect(screen.queryByText("Premiere erreur.")).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 12 — Plusieurs plans (independance des etats)
// ---------------------------------------------------------------------------

describe("Toggle — Independance entre plans multiples", () => {
  const twoPlans = [planActifSansAbonnes, planInactifSansAbonnes];

  it("toggler le plan actif n'affecte pas l'etat du plan inactif", async () => {
    mockFetchSuccess({ message: "OK", isActif: false });

    render(<PlansAdminList plans={twoPlans} />);

    // Toggler le plan actif
    const desactiverBtns = screen.getAllByRole("button", {
      name: /désactiver le plan Plan Actif Sans Abo/i,
    });

    await act(async () => {
      fireEvent.click(desactiverBtns[0]);
    });

    await waitFor(() => {
      // Les deux plans doivent maintenant etre inactifs (l'un par toggle, l'autre car initial)
      const inactifs = screen.getAllByText("Inactif");
      expect(inactifs.length).toBeGreaterThanOrEqual(2);
    });

    // Verifier que l'autre plan (inactif initial) est toujours inactif
    const activerBtns = screen.getAllByRole("button", {
      name: /activer le plan Plan Inactif Sans Abo/i,
    });
    expect(activerBtns.length).toBeGreaterThanOrEqual(1);
  });
});
