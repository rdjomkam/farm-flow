// @vitest-environment jsdom
/**
 * Tests — PlansAdminList (Story 38.1)
 *
 * Composant : src/components/abonnements/plans-admin-list.tsx
 * Client Component avec filtres interactifs.
 *
 * Couverture :
 * 1. Rendu initial — tous les plans visibles
 * 2. Filtre par TypePlan
 * 3. Filtre par statut (actif / inactif)
 * 4. Filtres combines (TypePlan + statut)
 * 5. Reinitialisation des filtres
 * 6. Etat vide (aucun plan correspond)
 * 7. Prix — formatage XAF et "Gratuit" pour 0
 * 8. Limites — "Illimite" pour valeurs >= 999
 * 9. Badges — statut actif/inactif, public/prive, TypePlan
 * 10. Compteur d'abonnes
 * 11. Structure du tableau desktop et cartes mobiles
 * 12. Options du select TypePlan
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlansAdminList } from "@/components/abonnements/plans-admin-list";
import { TypePlan } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/plans",
}));

// Mock next-intl — retourne les traductions françaises réelles
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      "plans.DECOUVERTE": "Découverte",
      "plans.ELEVEUR": "Éleveur",
      "plans.PROFESSIONNEL": "Professionnel",
      "plans.ENTREPRISE": "Entreprise",
      "plans.INGENIEUR_STARTER": "Ingénieur Starter",
      "plans.INGENIEUR_PRO": "Ingénieur Pro",
      "plans.INGENIEUR_EXPERT": "Ingénieur Expert",
      "periods.MENSUEL": "Mensuel",
      "periods.TRIMESTRIEL": "Trimestriel",
      "periods.ANNUEL": "Annuel",
      "statuts.ACTIF": "Actif",
      "statuts.EN_GRACE": "Période de grâce",
      "statuts.SUSPENDU": "Suspendu",
      "statuts.EXPIRE": "Expiré",
      "statuts.ANNULE": "Annulé",
      "statuts.EN_ATTENTE_PAIEMENT": "En attente de paiement",
      "providers.SMOBILPAY": "Smobilpay / Maviance",
      "providers.MTN_MOMO": "MTN Mobile Money",
      "providers.ORANGE_MONEY": "Orange Money",
      "providers.MANUEL": "Paiement manuel",
      "admin.allTypes": "Tous les types",
      "admin.allStatuses": "Tous les statuts",
      "admin.active": "Actif",
      "admin.inactive": "Inactif",
      "admin.reset": "Réinitialiser",
      "admin.newPlan": "Nouveau plan",
      "admin.unlimited": "Illimité",
      "admin.onQuote": "Sur devis",
      "admin.noModules": "Aucun module",
      "admin.public": "Public",
      "admin.private": "Privé",
      "admin.columns.plan": "Plan",
      "admin.columns.type": "Type",
      "admin.columns.price": "Prix",
      "admin.columns.sites": "Sites",
      "admin.columns.tanks": "Bacs",
      "admin.columns.waves": "Vagues",
      "admin.columns.engineer": "Ingénieur",
      "admin.columns.subscribers": "Abonnés",
      "admin.columns.status": "Statut",
      "admin.columns.visibility": "Visibilité",
      "admin.columns.modules": "Modules",
      "admin.columns.actions": "Actions",
      "admin.modulesInclus": "Modules inclus",
      "admin.modulesHelp": "Modules disponibles",
    };
    return translations[key] ?? key;
  },
}));

// ---------------------------------------------------------------------------
// Donnees de test — noms sans accents pour eviter les problemes d'encodage
// mais on utilise les vrais labels du composant dans les assertions
// ---------------------------------------------------------------------------

const planDecouverteActifPublic = {
  id: "plan-1",
  nom: "Plan Decouverte",
  typePlan: TypePlan.DECOUVERTE,
  description: "Plan gratuit pour decouvrir la plateforme",
  prixMensuel: 0,
  prixTrimestriel: null,
  prixAnnuel: null,
  limitesSites: 1,
  limitesBacs: 3,
  limitesVagues: 1,
  limitesIngFermes: null,
  isActif: true,
  isPublic: true,
  modulesInclus: [],
  _count: { abonnements: 42 },
};

const planEleveurInactifPrive = {
  id: "plan-2",
  nom: "Plan Eleveur",
  typePlan: TypePlan.ELEVEUR,
  description: null,
  prixMensuel: 3000,
  prixTrimestriel: 7500,
  prixAnnuel: 25000,
  limitesSites: 1,
  limitesBacs: 10,
  limitesVagues: 3,
  limitesIngFermes: null,
  isActif: false,
  isPublic: false,
  modulesInclus: [],
  _count: { abonnements: 0 },
};

const planEntrepriseActifPublic = {
  id: "plan-3",
  nom: "Plan Entreprise",
  typePlan: TypePlan.ENTREPRISE,
  description: "Plan illimite pour grandes structures",
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
  _count: { abonnements: 5 },
};

const planIngenieurProActifPrive = {
  id: "plan-4",
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
  modulesInclus: [],
  _count: { abonnements: 8 },
};

const allPlans = [
  planDecouverteActifPublic,
  planEleveurInactifPrive,
  planEntrepriseActifPublic,
  planIngenieurProActifPrive,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTypeSelect(): HTMLSelectElement {
  return screen.getByRole("combobox", {
    name: /filtrer par type de plan/i,
  }) as HTMLSelectElement;
}

function getStatutSelect(): HTMLSelectElement {
  return screen.getByRole("combobox", {
    name: /filtrer par statut/i,
  }) as HTMLSelectElement;
}

// ---------------------------------------------------------------------------
// Suite 1 — Rendu initial
// ---------------------------------------------------------------------------

describe("PlansAdminList — Rendu initial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche tous les noms de plans fournis", () => {
    render(<PlansAdminList plans={allPlans} />);
    expect(screen.getAllByText("Plan Decouverte").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Eleveur").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Entreprise").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Ing Pro").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le select de filtre par type", () => {
    render(<PlansAdminList plans={allPlans} />);
    expect(getTypeSelect()).toBeInTheDocument();
  });

  it("affiche le select de filtre par statut", () => {
    render(<PlansAdminList plans={allPlans} />);
    expect(getStatutSelect()).toBeInTheDocument();
  });

  it("n'affiche pas le bouton Reinitialiser quand aucun filtre actif", () => {
    render(<PlansAdminList plans={allPlans} />);
    expect(screen.queryByText("Réinitialiser")).not.toBeInTheDocument();
  });

  it("affiche le bouton Nouveau plan", () => {
    render(<PlansAdminList plans={allPlans} />);
    const btn = screen.getByRole("button", {
      name: /nouveau plan/i,
    });
    expect(btn).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Filtre par TypePlan
// ---------------------------------------------------------------------------

describe("PlansAdminList — Filtre par TypePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtre sur DECOUVERTE : seul le plan Decouverte reste visible", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.DECOUVERTE } });

    expect(screen.getAllByText("Plan Decouverte").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Plan Eleveur")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan Entreprise")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan Ing Pro")).not.toBeInTheDocument();
  });

  it("filtre sur ENTREPRISE : seul le plan Entreprise reste visible", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.ENTREPRISE } });

    expect(screen.getAllByText("Plan Entreprise").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Plan Decouverte")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan Eleveur")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan Ing Pro")).not.toBeInTheDocument();
  });

  it("filtre sur INGENIEUR_PRO : seul le plan Ing Pro reste visible", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.INGENIEUR_PRO } });

    expect(screen.getAllByText("Plan Ing Pro").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Plan Decouverte")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan Eleveur")).not.toBeInTheDocument();
  });

  it("revenir sur 'Tous les types' re-affiche tous les plans", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.DECOUVERTE } });
    fireEvent.change(getTypeSelect(), { target: { value: "" } });

    expect(screen.getAllByText("Plan Decouverte").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Eleveur").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Entreprise").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le bouton Reinitialiser quand un filtre type est actif", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.ELEVEUR } });
    expect(screen.getByText("Réinitialiser")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Filtre par statut
// ---------------------------------------------------------------------------

describe("PlansAdminList — Filtre par statut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtre 'actif' : seuls les plans actifs sont visibles", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getStatutSelect(), { target: { value: "actif" } });

    // Plan Eleveur (inactif) doit disparaitre
    expect(screen.queryByText("Plan Eleveur")).not.toBeInTheDocument();
    // Plans actifs restent
    expect(screen.getAllByText("Plan Decouverte").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Entreprise").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Ing Pro").length).toBeGreaterThanOrEqual(1);
  });

  it("filtre 'inactif' : seul le plan inactif est visible", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getStatutSelect(), { target: { value: "inactif" } });

    expect(screen.getAllByText("Plan Eleveur").length).toBeGreaterThanOrEqual(1);
    // Plans actifs disparaissent
    expect(screen.queryByText("Plan Decouverte")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan Entreprise")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan Ing Pro")).not.toBeInTheDocument();
  });

  it("filtre 'inactif' sur liste sans inactif : etat vide", () => {
    const plansActifs = [planDecouverteActifPublic, planEntrepriseActifPublic];
    render(<PlansAdminList plans={plansActifs} />);
    fireEvent.change(getStatutSelect(), { target: { value: "inactif" } });

    expect(screen.getAllByText("Aucun plan trouvé.").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le bouton Reinitialiser quand filtre statut est actif", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getStatutSelect(), { target: { value: "actif" } });
    expect(screen.getByText("Réinitialiser")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Filtres combines
// ---------------------------------------------------------------------------

describe("PlansAdminList — Filtres combines TypePlan + statut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("DECOUVERTE + actif : plan Decouverte visible (actif et DECOUVERTE)", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.DECOUVERTE } });
    fireEvent.change(getStatutSelect(), { target: { value: "actif" } });

    expect(screen.getAllByText("Plan Decouverte").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Plan Eleveur")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan Entreprise")).not.toBeInTheDocument();
  });

  it("ELEVEUR + actif : etat vide (Plan Eleveur est inactif)", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.ELEVEUR } });
    fireEvent.change(getStatutSelect(), { target: { value: "actif" } });

    expect(screen.getAllByText("Aucun plan trouvé.").length).toBeGreaterThanOrEqual(1);
  });

  it("ELEVEUR + inactif : plan Eleveur visible", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.ELEVEUR } });
    fireEvent.change(getStatutSelect(), { target: { value: "inactif" } });

    expect(screen.getAllByText("Plan Eleveur").length).toBeGreaterThanOrEqual(1);
  });

  it("ENTREPRISE + inactif : etat vide (Plan Entreprise est actif)", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.ENTREPRISE } });
    fireEvent.change(getStatutSelect(), { target: { value: "inactif" } });

    expect(screen.getAllByText("Aucun plan trouvé.").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Reinitialisation des filtres
// ---------------------------------------------------------------------------

describe("PlansAdminList — Reinitialisation des filtres", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clic Reinitialiser apres filtre type efface le filtre et re-affiche tous les plans", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.DECOUVERTE } });
    expect(screen.queryByText("Plan Eleveur")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Réinitialiser"));

    expect(screen.queryByText("Réinitialiser")).not.toBeInTheDocument();
    expect(screen.getAllByText("Plan Eleveur").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Entreprise").length).toBeGreaterThanOrEqual(1);
  });

  it("clic Reinitialiser apres filtre statut efface le filtre et re-affiche tous les plans", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getStatutSelect(), { target: { value: "inactif" } });
    expect(screen.queryByText("Plan Decouverte")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Réinitialiser"));

    expect(screen.queryByText("Réinitialiser")).not.toBeInTheDocument();
    expect(screen.getAllByText("Plan Decouverte").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Eleveur").length).toBeGreaterThanOrEqual(1);
  });

  it("clic Reinitialiser apres filtres combines efface les deux filtres", () => {
    render(<PlansAdminList plans={allPlans} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.ELEVEUR } });
    fireEvent.change(getStatutSelect(), { target: { value: "inactif" } });

    fireEvent.click(screen.getByText("Réinitialiser"));

    expect(screen.queryByText("Réinitialiser")).not.toBeInTheDocument();
    expect(screen.getAllByText("Plan Decouverte").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Entreprise").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plan Ing Pro").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Etat vide
// ---------------------------------------------------------------------------

describe("PlansAdminList — Etat vide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le message vide quand plans est vide (tableau desktop)", () => {
    render(<PlansAdminList plans={[]} />);
    // Le tableau desktop a une cellule "Aucun plan trouvé."
    expect(screen.getAllByText("Aucun plan trouvé.").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le message vide quand aucun plan ne correspond au filtre", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    fireEvent.change(getTypeSelect(), { target: { value: TypePlan.ELEVEUR } });

    expect(screen.getAllByText("Aucun plan trouvé.").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — Formatage des prix
// ---------------------------------------------------------------------------

describe("PlansAdminList — Formatage des prix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche 'Gratuit' pour un plan avec prixMensuel = 0", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    expect(screen.getAllByText(/Gratuit/i).length).toBeGreaterThanOrEqual(1);
  });

  it("affiche 'FCFA' pour un plan payant", () => {
    render(<PlansAdminList plans={[planEleveurInactifPrive]} />);
    expect(screen.getAllByText(/FCFA/i).length).toBeGreaterThanOrEqual(1);
  });

  it("affiche 'Sur devis' quand tous les prix sont null", () => {
    const planSurDevis = {
      ...planEntrepriseActifPublic,
      id: "plan-devis",
      nom: "Plan Sur Devis",
      prixMensuel: null,
      prixTrimestriel: null,
      prixAnnuel: null,
    };
    render(<PlansAdminList plans={[planSurDevis]} />);
    expect(screen.getAllByText("Sur devis").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche plusieurs lignes de prix pour le plan Eleveur (mensuel + trimestriel + annuel)", () => {
    render(<PlansAdminList plans={[planEleveurInactifPrive]} />);
    // Le tableau resume affiche "FCFA" plusieurs fois, les cartes mobiles aussi
    const fcfaTexts = screen.getAllByText(/FCFA/i);
    // Au moins : mensuel, trimestriel, annuel dans les cartes mobiles
    expect(fcfaTexts.length).toBeGreaterThanOrEqual(3);
  });

  it("affiche le suffixe /mois dans le resume du tableau desktop", () => {
    render(<PlansAdminList plans={[planEleveurInactifPrive]} />);
    // Le tableau desktop affiche "3 000 FCFA/mois · ..."
    expect(screen.getByText(/mois/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 8 — Formatage des limites (Illimite)
// ---------------------------------------------------------------------------

describe("PlansAdminList — Formatage des limites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche 'Illimité' pour les limites >= 999 dans le tableau desktop (plan Entreprise)", () => {
    render(<PlansAdminList plans={[planEntrepriseActifPublic]} />);
    // Le tableau desktop a 3 colonnes a 999 : Sites, Bacs, Vagues
    const illimites = screen.getAllByText("Illimité");
    expect(illimites.length).toBeGreaterThanOrEqual(3);
  });

  it("affiche la valeur numerique 3 pour limitesBacs = 3", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    // limitesBacs=3 -> "3" apparait dans les cartes et le tableau
    const threes = screen.getAllByText("3");
    expect(threes.length).toBeGreaterThanOrEqual(1);
  });

  it("affiche '—' quand limitesIngFermes est null (carte mobile et tableau)", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    // La carte mobile et le tableau desktop affichent "—" pour limitesIngFermes null
    const tirets = screen.getAllByText("—");
    expect(tirets.length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le nombre de fermes (20) pour limitesIngFermes = 20 dans la carte mobile", () => {
    render(<PlansAdminList plans={[planIngenieurProActifPrive]} />);
    // Carte mobile : "20"
    const twenties = screen.getAllByText("20");
    expect(twenties.length).toBeGreaterThanOrEqual(1);
  });

  it("affiche '— fermes' dans le tableau desktop pour limitesIngFermes = 20", () => {
    render(<PlansAdminList plans={[planIngenieurProActifPrive]} />);
    // Tableau : "20 fermes"
    expect(screen.getByText("20 fermes")).toBeInTheDocument();
  });

  it("affiche '—' dans le tableau desktop et la carte mobile quand limitesIngFermes est null", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    // Tableau desktop : "—" dans la colonne Ingenieur; Carte mobile : "—" pour Fermes ingenieur
    const tirets = screen.getAllByText("—");
    expect(tirets.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Suite 9 — Badges (statut, visibilite, TypePlan)
// ---------------------------------------------------------------------------

describe("PlansAdminList — Badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le badge 'Actif' pour un plan actif", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    // Badge dans cartes mobile + tableau desktop
    expect(screen.getAllByText("Actif").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le badge 'Inactif' pour un plan inactif", () => {
    render(<PlansAdminList plans={[planEleveurInactifPrive]} />);
    expect(screen.getAllByText("Inactif").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le badge 'Public' pour un plan public", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    expect(screen.getAllByText("Public").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le badge 'Prive' pour un plan prive", () => {
    render(<PlansAdminList plans={[planEleveurInactifPrive]} />);
    expect(screen.getAllByText("Privé").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le label TypePlan correct pour DECOUVERTE via PLAN_LABELS", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    // PLAN_LABELS[TypePlan.DECOUVERTE] = "Decouverte" (avec accent)
    expect(screen.getAllByText("Découverte").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le label TypePlan correct pour ELEVEUR via PLAN_LABELS", () => {
    render(<PlansAdminList plans={[planEleveurInactifPrive]} />);
    // PLAN_LABELS[TypePlan.ELEVEUR] = "Eleveur" (avec accent)
    expect(screen.getAllByText("Éleveur").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le label TypePlan correct pour INGENIEUR_PRO via PLAN_LABELS", () => {
    render(<PlansAdminList plans={[planIngenieurProActifPrive]} />);
    // PLAN_LABELS[TypePlan.INGENIEUR_PRO] = "Ingenieur Pro" (avec accent)
    expect(screen.getAllByText("Ingénieur Pro").length).toBeGreaterThanOrEqual(1);
  });

  it("bouton toggle affiche 'Désactiver' pour un plan actif", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    expect(screen.getAllByText("Désactiver").length).toBeGreaterThanOrEqual(1);
  });

  it("bouton toggle affiche 'Activer' pour un plan inactif", () => {
    render(<PlansAdminList plans={[planEleveurInactifPrive]} />);
    expect(screen.getAllByText("Activer").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 10 — Compteur d'abonnes
// ---------------------------------------------------------------------------

describe("PlansAdminList — Compteur d'abonnes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le nombre 42 pour le plan avec 42 abonnes", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    // Tableau desktop affiche "42" dans la colonne Abonnes
    expect(screen.getAllByText("42").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche 0 abonne pour le plan Eleveur", () => {
    render(<PlansAdminList plans={[planEleveurInactifPrive]} />);
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le texte abonnes (pluriel pour 42) dans la carte mobile", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    // La carte mobile genere un <p> contenant <span>42</span> abonnés
    const paras = screen.getAllByText(/abonné/i);
    expect(paras.length).toBeGreaterThanOrEqual(1);
    // Et le chiffre 42 est bien affiche quelque part
    expect(screen.getAllByText("42").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le texte abonne au singulier pour 1 abonne dans la carte mobile", () => {
    const planWith1 = {
      ...planEntrepriseActifPublic,
      id: "plan-1abo",
      nom: "Plan 1 Abo",
      _count: { abonnements: 1 },
    };
    render(<PlansAdminList plans={[planWith1]} />);
    // La logique: 1 abonne -> pas de "s" -> "abonné" (sans s)
    const paras = screen.getAllByText(/abonné(?!s)/i);
    expect(paras.length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le compteur de 8 abonnes pour planIngenieurPro", () => {
    render(<PlansAdminList plans={[planIngenieurProActifPrive]} />);
    expect(screen.getAllByText("8").length).toBeGreaterThanOrEqual(1);
  });

  it("affiche le texte abonnes (pluriel pour 5) dans la carte mobile", () => {
    render(<PlansAdminList plans={[planEntrepriseActifPublic]} />);
    const paras = screen.getAllByText(/abonné/i);
    expect(paras.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 11 — Structure du tableau desktop et cartes mobiles
// ---------------------------------------------------------------------------

describe("PlansAdminList — Structure HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("le tableau desktop possede les en-tetes 'Plan', 'Type', 'Prix'", () => {
    render(<PlansAdminList plans={allPlans} />);
    // "Plan" et "Type" sont uniques comme en-tetes
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    // "Prix" peut apparaitre aussi dans les cartes mobiles
    expect(screen.getAllByText("Prix").length).toBeGreaterThanOrEqual(1);
  });

  it("le tableau desktop possede les en-tetes 'Sites', 'Bacs', 'Vagues'", () => {
    render(<PlansAdminList plans={allPlans} />);
    expect(screen.getByText("Sites")).toBeInTheDocument();
    expect(screen.getByText("Bacs")).toBeInTheDocument();
    expect(screen.getByText("Vagues")).toBeInTheDocument();
  });

  it("le tableau desktop possede les en-tetes 'Ingénieur', 'Abonnés', 'Statut'", () => {
    render(<PlansAdminList plans={allPlans} />);
    expect(screen.getByText("Ingénieur")).toBeInTheDocument();
    expect(screen.getByText("Abonnés")).toBeInTheDocument();
    expect(screen.getByText("Statut")).toBeInTheDocument();
  });

  it("le tableau desktop possede les en-tetes 'Visibilité', 'Actions'", () => {
    render(<PlansAdminList plans={allPlans} />);
    expect(screen.getByText("Visibilité")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("les cartes mobiles affichent les labels de limites", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    expect(screen.getAllByText(/Sites max/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Bacs max/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Vagues max/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Fermes ingénieur/i).length).toBeGreaterThanOrEqual(1);
  });

  it("les boutons Modifier sont presentes et actifs (Story 38.2)", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    const modifierBtns = screen.getAllByRole("button", {
      name: /modifier le plan/i,
    });
    expect(modifierBtns.length).toBeGreaterThanOrEqual(1);
    modifierBtns.forEach((btn) => expect(btn).not.toBeDisabled());
  });

  it("les boutons toggle Desactiver/Activer sont presents et actifs (Story 38.3)", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    const toggleBtns = screen.getAllByRole("button", {
      name: /désactiver le plan|activer le plan/i,
    });
    expect(toggleBtns.length).toBeGreaterThanOrEqual(1);
    toggleBtns.forEach((btn) => expect(btn).not.toBeDisabled());
  });

  it("la description du plan est affichee quand elle est presente", () => {
    render(<PlansAdminList plans={[planDecouverteActifPublic]} />);
    expect(
      screen.getAllByText("Plan gratuit pour decouvrir la plateforme").length
    ).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 12 — Options du select TypePlan
// ---------------------------------------------------------------------------

describe("PlansAdminList — Options du select TypePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("contient une option pour chaque valeur de TypePlan", () => {
    render(<PlansAdminList plans={[]} />);
    const select = getTypeSelect();
    const optionValues = Array.from(select.options)
      .map((o) => o.value)
      .filter((v) => v !== "");

    const expectedTypes = Object.values(TypePlan);
    expect(optionValues).toHaveLength(expectedTypes.length);
    for (const t of expectedTypes) {
      expect(optionValues).toContain(t);
    }
  });

  it("contient l'option 'Tous les types' par defaut et la valeur est vide", () => {
    render(<PlansAdminList plans={[]} />);
    const select = getTypeSelect();
    expect(select.options[0].text).toBe("Tous les types");
    expect(select.value).toBe("");
  });

  it("le select statut contient les options 'Tous les statuts', 'Actif', 'Inactif'", () => {
    render(<PlansAdminList plans={[]} />);
    const select = getStatutSelect();
    const optionTexts = Array.from(select.options).map((o) => o.text);
    expect(optionTexts).toContain("Tous les statuts");
    expect(optionTexts).toContain("Actif");
    expect(optionTexts).toContain("Inactif");
  });

  it("le select statut a la valeur vide par defaut", () => {
    render(<PlansAdminList plans={[]} />);
    expect(getStatutSelect().value).toBe("");
  });
});
