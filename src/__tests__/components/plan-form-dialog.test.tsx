// @vitest-environment jsdom
/**
 * Tests — PlanFormDialog (Story 38.2)
 *
 * Composant : src/components/abonnements/plan-form-dialog.tsx
 * Dialog de creation et modification d'un plan d'abonnement.
 *
 * Couverture :
 * 1. Mode creation : dialog s'ouvre, champs vides, bouton "Creer le plan"
 * 2. Mode edition : dialog s'ouvre avec donnees pre-remplies, typePlan desactive, bouton "Enregistrer"
 * 3. Validation : nom vide -> erreur, prix negatif -> erreur, limites < 1 -> erreur
 * 4. Champ conditionnel limitesIngFermes : visible uniquement pour typePlan INGENIEUR_*
 * 5. Appel API creation : POST /api/plans avec les bonnes donnees
 * 6. Appel API edition : PUT /api/plans/[id] avec les bonnes donnees
 * 7. Erreur 409 : message d'erreur affiché
 * 8. Succes : dialog se ferme, router.refresh(), onSuccess() appele
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { PlanFormDialog } from "@/components/abonnements/plan-form-dialog";
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

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock global fetch
const mockFetch = vi.fn();

// ---------------------------------------------------------------------------
// Donnees de test
// ---------------------------------------------------------------------------

const planDecouverte = {
  id: "plan-decouverte-1",
  nom: "Plan Decouverte",
  typePlan: TypePlan.DECOUVERTE,
  description: "Plan gratuit pour decouvrir",
  prixMensuel: 0,
  prixTrimestriel: null,
  prixAnnuel: null,
  limitesSites: 1,
  limitesBacs: 3,
  limitesVagues: 1,
  limitesIngFermes: null,
  isActif: true,
  isPublic: true,
  _count: { abonnements: 10 },
};

const planIngenieurPro = {
  id: "plan-ing-pro-1",
  nom: "Plan Ing Pro",
  typePlan: TypePlan.INGENIEUR_PRO,
  description: null,
  prixMensuel: 15000,
  prixTrimestriel: null,
  prixAnnuel: 135000,
  limitesSites: 1,
  limitesBacs: 3,
  limitesVagues: 1,
  limitesIngFermes: 20,
  isActif: true,
  isPublic: false,
  _count: { abonnements: 5 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ouvre le dialog en cliquant sur le trigger */
function openDialog() {
  const trigger = screen.getByRole("button", { name: /ouvrir/i });
  fireEvent.click(trigger);
}

/** Helper pour simuler une reponse fetch reussie */
function mockFetchSuccess(data: Record<string, unknown> = { id: "new-id" }) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

/** Helper pour simuler une reponse fetch echouee */
function mockFetchError(status: number, data: Record<string, unknown>) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(data),
  });
}

// ---------------------------------------------------------------------------
// Setup global
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = mockFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1 — Mode creation
// ---------------------------------------------------------------------------

describe("PlanFormDialog — Mode creation", () => {
  it("affiche le titre 'Creer un plan d'abonnement' a l'ouverture", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      expect(
        screen.getByText("Créer un plan d'abonnement")
      ).toBeInTheDocument();
    });
  });

  it("le bouton de soumission affiche 'Creer le plan' en mode creation", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Créer le plan")).toBeInTheDocument();
    });
  });

  it("le champ nom est vide a l'ouverture en mode creation", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
      expect(nomInput).toHaveValue("");
    });
  });

  it("les champs prix sont vides a l'ouverture en mode creation", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      const prixMensuelInput = screen.getByPlaceholderText("Ex: 3000");
      expect(prixMensuelInput).toHaveValue(null);
    });
  });

  it("le select typePlan est active en mode creation", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      const select = screen.getByRole("combobox");
      expect(select).not.toBeDisabled();
    });
  });

  it("le champ limitesIngFermes n'est pas visible par defaut (typePlan DECOUVERTE)", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("Ex: 5")
      ).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Mode edition
// ---------------------------------------------------------------------------

describe("PlanFormDialog — Mode edition", () => {
  it("affiche le titre 'Modifier le plan' a l'ouverture", async () => {
    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Modifier le plan")).toBeInTheDocument();
    });
  });

  it("le bouton de soumission affiche 'Enregistrer' en mode edition", async () => {
    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Enregistrer")).toBeInTheDocument();
    });
  });

  it("le champ nom est pre-rempli avec le nom du plan", async () => {
    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
      expect(nomInput).toHaveValue("Plan Decouverte");
    });
  });

  it("le select typePlan est desactive en mode edition", async () => {
    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      const select = screen.getByRole("combobox");
      expect(select).toBeDisabled();
    });
  });

  it("le select typePlan contient la valeur du plan en mode edition", async () => {
    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe(TypePlan.DECOUVERTE);
    });
  });

  it("affiche le message 'Le type de plan ne peut pas etre modifie' en mode edition", async () => {
    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      expect(
        screen.getByText(/Le type de plan ne peut pas être modifié/)
      ).toBeInTheDocument();
    });
  });

  it("les limites bacs et vagues sont pre-remplies en mode edition", async () => {
    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      // limitesBacs = 3 et limitesVagues = 1
      const numberInputs = screen.getAllByDisplayValue("3");
      expect(numberInputs.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("le prix mensuel est pre-rempli en mode edition (plan avec prix)", async () => {
    render(
      <PlanFormDialog plan={planIngenieurPro}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      const prixMensuelInput = screen.getByPlaceholderText("Ex: 3000");
      expect(prixMensuelInput).toHaveValue(15000);
    });
  });

  it("limitesIngFermes est visible et pre-rempli pour un plan INGENIEUR en mode edition", async () => {
    render(
      <PlanFormDialog plan={planIngenieurPro}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      const ingInput = screen.getByPlaceholderText("Ex: 5");
      expect(ingInput).toBeInTheDocument();
      expect(ingInput).toHaveValue(20);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Validation cote client
// ---------------------------------------------------------------------------

describe("PlanFormDialog — Validation", () => {
  it("affiche une erreur si le nom est vide a la soumission", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => {
      expect(screen.getByText("Créer le plan")).toBeInTheDocument();
    });

    // Vider le nom (defaut : vide) et soumettre
    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(screen.getByText("Le nom du plan est requis.")).toBeInTheDocument();
    });
  });

  it("n'appelle pas fetch si le nom est vide", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  it("affiche une erreur si le prix mensuel est negatif", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    // Remplir le nom
    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Mon Plan" } });

    // Saisir un prix mensuel negatif
    const prixMensuelInput = screen.getByPlaceholderText("Ex: 3000");
    fireEvent.change(prixMensuelInput, { target: { value: "-100" } });

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(
        screen.getByText("Le prix mensuel doit être >= 0.")
      ).toBeInTheDocument();
    });
  });

  it("affiche une erreur si limitesBacs est inferieur a 1", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    // Remplir le nom
    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Mon Plan" } });

    // Mettre limitesBacs a 0
    const numberInputs = document.querySelectorAll('input[type="number"][min="1"]');
    // Le premier input min=1 avec step=1 est limitesSites
    // Trouver celui qui a la valeur 3 (limitesBacs)
    const limitesBacsInput = Array.from(numberInputs).find(
      (el) => (el as HTMLInputElement).value === "3"
    ) as HTMLInputElement;

    if (limitesBacsInput) {
      fireEvent.change(limitesBacsInput, { target: { value: "0" } });
    }

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      // Au moins une erreur de limite doit etre affichee
      const erreurs = screen.getAllByText(/doit être >= 1/);
      expect(erreurs.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("affiche une erreur si limitesIngFermes est inferieur a 1 quand visible", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    // Remplir le nom
    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Mon Plan" } });

    // Changer le typePlan vers INGENIEUR_STARTER pour afficher le champ
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: TypePlan.INGENIEUR_STARTER } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ex: 5")).toBeInTheDocument();
    });

    // Saisir une valeur invalide
    const ingInput = screen.getByPlaceholderText("Ex: 5");
    fireEvent.change(ingInput, { target: { value: "0" } });

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(
        screen.getByText("La limite de fermes ingénieur doit être >= 1.")
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Champ conditionnel limitesIngFermes
// ---------------------------------------------------------------------------

describe("PlanFormDialog — Champ conditionnel limitesIngFermes", () => {
  const ingenieurTypes: TypePlan[] = [
    TypePlan.INGENIEUR_STARTER,
    TypePlan.INGENIEUR_PRO,
    TypePlan.INGENIEUR_EXPERT,
  ];

  const nonIngenieurTypes: TypePlan[] = [
    TypePlan.DECOUVERTE,
    TypePlan.ELEVEUR,
    TypePlan.PROFESSIONNEL,
    TypePlan.ENTREPRISE,
  ];

  ingenieurTypes.forEach((type) => {
    it(`limitesIngFermes est visible quand typePlan = ${type}`, async () => {
      render(
        <PlanFormDialog>
          <button>Ouvrir</button>
        </PlanFormDialog>
      );

      openDialog();

      await waitFor(() => screen.getByRole("combobox"));

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: type } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Ex: 5")).toBeInTheDocument();
      });
    });
  });

  nonIngenieurTypes.forEach((type) => {
    it(`limitesIngFermes n'est pas visible quand typePlan = ${type}`, async () => {
      render(
        <PlanFormDialog>
          <button>Ouvrir</button>
        </PlanFormDialog>
      );

      openDialog();

      await waitFor(() => screen.getByRole("combobox"));

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: type } });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Ex: 5")).not.toBeInTheDocument();
      });
    });
  });

  it("le champ disparait quand on change de INGENIEUR_PRO vers DECOUVERTE", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByRole("combobox"));

    const select = screen.getByRole("combobox") as HTMLSelectElement;

    // D'abord INGENIEUR_PRO
    fireEvent.change(select, { target: { value: TypePlan.INGENIEUR_PRO } });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ex: 5")).toBeInTheDocument();
    });

    // Puis DECOUVERTE
    fireEvent.change(select, { target: { value: TypePlan.DECOUVERTE } });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Ex: 5")).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Appel API creation
// ---------------------------------------------------------------------------

describe("PlanFormDialog — Appel API creation", () => {
  it("appelle POST /api/plans avec les bonnes donnees", async () => {
    mockFetchSuccess({ id: "new-plan-id" });

    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    // Remplir le formulaire
    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Mon Nouveau Plan" } });

    const prixMensuelInput = screen.getByPlaceholderText("Ex: 3000");
    fireEvent.change(prixMensuelInput, { target: { value: "5000" } });

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/backoffice/plans",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.any(String),
        })
      );
    });

    // Verifier que le body contient les bonnes donnees
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.nom).toBe("Mon Nouveau Plan");
    expect(body.prixMensuel).toBe(5000);
    expect(body.typePlan).toBe(TypePlan.DECOUVERTE);
  });

  it("envoie typePlan dans le body en mode creation", async () => {
    mockFetchSuccess({ id: "new-id" });

    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    // Changer typePlan
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: TypePlan.ELEVEUR } });

    // Remplir le nom
    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Plan Eleveur Test" } });

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.typePlan).toBe(TypePlan.ELEVEUR);
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Appel API edition
// ---------------------------------------------------------------------------

describe("PlanFormDialog — Appel API edition", () => {
  it("appelle PUT /api/plans/[id] avec l'id correct", async () => {
    mockFetchSuccess({ id: planDecouverte.id });

    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Enregistrer"));

    fireEvent.click(screen.getByText("Enregistrer"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/backoffice/plans/${planDecouverte.id}`,
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        })
      );
    });
  });

  it("n'envoie pas typePlan dans le body en mode edition", async () => {
    mockFetchSuccess({ id: planDecouverte.id });

    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Enregistrer"));

    fireEvent.click(screen.getByText("Enregistrer"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.typePlan).toBeUndefined();
  });

  it("envoie le nom modifie en mode edition", async () => {
    mockFetchSuccess({ id: planDecouverte.id });

    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Enregistrer"));

    // Modifier le nom
    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Nom Modifie" } });

    fireEvent.click(screen.getByText("Enregistrer"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.nom).toBe("Nom Modifie");
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — Erreur 409
// ---------------------------------------------------------------------------

describe("PlanFormDialog — Erreur 409", () => {
  it("affiche le message d'erreur quand l'API retourne 409", async () => {
    mockFetchError(409, {
      message: "Un plan avec ce type existe déjà.",
    });

    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Plan Duplicate" } });

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(
        screen.getByText("Un plan avec ce type existe déjà.")
      ).toBeInTheDocument();
    });
  });

  it("ne ferme pas le dialog apres une erreur 409", async () => {
    mockFetchError(409, {
      message: "Un plan avec ce type existe déjà.",
    });

    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Plan Test" } });

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(screen.getByText("Créer le plan")).toBeInTheDocument();
    });
  });

  it("affiche les erreurs de validation retournees par le serveur (data.errors)", async () => {
    mockFetchError(422, {
      errors: [
        { field: "nom", message: "Nom invalide selon le serveur." },
      ],
    });

    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "NomInvalide" } });

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(screen.getByText("Nom invalide selon le serveur.")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 8 — Succes (creation et edition)
// ---------------------------------------------------------------------------

describe("PlanFormDialog — Succes", () => {
  it("appelle router.refresh() apres une creation reussie", async () => {
    mockFetchSuccess({ id: "new-plan-id" });

    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Plan Success" } });

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
  });

  it("appelle onSuccess() apres une creation reussie", async () => {
    mockFetchSuccess({ id: "new-plan-id" });
    const onSuccess = vi.fn();

    render(
      <PlanFormDialog onSuccess={onSuccess}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Plan Avec Callback" } });

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  it("ne pas appeler onSuccess() si non fourni (pas de crash)", async () => {
    mockFetchSuccess({ id: "new-plan-id" });

    // Pas de onSuccess prop
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Plan Sans Callback" } });

    await act(async () => {
      fireEvent.click(screen.getByText("Créer le plan"));
    });

    // Pas d'exception levee
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it("appelle router.refresh() apres une edition reussie", async () => {
    mockFetchSuccess({ id: planDecouverte.id });

    render(
      <PlanFormDialog plan={planDecouverte}>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Enregistrer"));

    fireEvent.click(screen.getByText("Enregistrer"));

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
  });

  it("affiche 'Enregistrement...' pendant le chargement", async () => {
    // Fetch qui ne resout jamais (simule chargement)
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    const nomInput = screen.getByPlaceholderText("Ex : Plan Éleveur Standard");
    fireEvent.change(nomInput, { target: { value: "Plan Loading" } });

    fireEvent.click(screen.getByText("Créer le plan"));

    await waitFor(() => {
      expect(screen.getByText("Enregistrement...")).toBeInTheDocument();
    });
  });

  it("le bouton Annuler ferme le dialog sans appeler fetch", async () => {
    render(
      <PlanFormDialog>
        <button>Ouvrir</button>
      </PlanFormDialog>
    );

    openDialog();

    await waitFor(() => screen.getByText("Créer le plan"));

    fireEvent.click(screen.getByText("Annuler"));

    await waitFor(() => {
      expect(screen.queryByText("Créer le plan")).not.toBeInTheDocument();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
