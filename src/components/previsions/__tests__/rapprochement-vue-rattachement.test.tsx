// @vitest-environment jsdom
/**
 * Tests — propagation du rattachement (ADR-053 §16.12, story A.5) jusqu'aux
 * 3 vues de rapprochement (mensuelle/cumulée/top-écarts). Ces trois
 * composants reçoivent `posteRattachementParId?: Record<string, {...}>`
 * — OPTIONNEL/défensif côté typage pour ne jamais casser un appelant qui
 * ne le fournirait pas encore, MAIS ce caractère défensif ne doit JAMAIS
 * se traduire par une absence réelle d'affichage quand la donnée EST
 * fournie : chaque test ici prouve le cas positif (donnée présente →
 * suffixe affiché), pas seulement le cas négatif (donnée absente →
 * no-op), pour ne pas rejouer ERR-185 sous une forme "le composant sait
 * afficher mais personne ne prouve qu'il le fait vraiment".
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RapprochementVueMensuelle } from "@/components/previsions/rapprochement-vue-mensuelle";
import { RapprochementVueCumulee } from "@/components/previsions/rapprochement-vue-cumulee";
import { RapprochementVueTopEcarts } from "@/components/previsions/rapprochement-vue-top-ecarts";
import type { LigneRapprochementDTO, AgregatPosteDTO } from "@/components/previsions/rapprochement-types";
import frPrevisions from "@/messages/fr/previsions.json";

function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce((cur, part) => {
    if (cur !== null && typeof cur === "object") return (cur as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

function interpolate(template: string, values?: Record<string, unknown>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const value = deepGet(namespace === "previsions" ? frPrevisions : {}, key);
    return typeof value === "string" ? interpolate(value, values) : key;
  },
}));

const dateDebutPlan = new Date("2026-09-01T00:00:00.000Z");

const posteRattachementParId = {
  "poste-divergent": { libelle: "Aliments", actif: true },
  "poste-inactif": { libelle: "Salaires équipe", actif: false },
  // Sous-cas "inactif + libellé COÏNCIDENT" (règle non négociable §16.12 —
  // le signal reste visible même sans divergence) : le libellé référentiel
  // est identique au libellé de ligne ci-dessous ("Carburant").
  "poste-inactif-coincident": { libelle: "Carburant", actif: false },
};

function ligne(overrides: Partial<LigneRapprochementDTO>): LigneRapprochementDTO {
  return {
    id: "ligne-1",
    moisAbsolu: 0,
    libelle: "Aliments élevage",
    natureGrandeur: "DEPENSE",
    prevu: 100000,
    reel: 90000,
    statutRapprochement: "RAPPROCHE",
    ecartAbsolu: 10000,
    ecartPct: 10,
    sens: "FAVORABLE",
    couleur: "favorable",
    ...overrides,
  };
}

describe("RapprochementVueMensuelle — propagation du rattachement", () => {
  it("SANS posteRattachementParId, le libellé brut est affiché tel quel (no-op défensif)", () => {
    render(
      <RapprochementVueMensuelle
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        lignes={[ligne({ id: "poste-divergent::0" })]}
        nonRapproche={[]}
        totalMonetaire={undefined}
        totalQuantite={undefined}
      />
    );
    expect(screen.getAllByText("Aliments élevage").length).toBeGreaterThan(0);
  });

  it("AVEC posteRattachementParId, une ligne dont l'id (avec suffixe mois) correspond à une entrée divergente affiche le suffixe compact", () => {
    render(
      <RapprochementVueMensuelle
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        lignes={[ligne({ id: "poste-divergent::0" })]}
        nonRapproche={[]}
        totalMonetaire={undefined}
        totalQuantite={undefined}
        posteRattachementParId={posteRattachementParId}
      />
    );
    expect(screen.getAllByText("Aliments élevage (réf. Aliments)").length).toBeGreaterThan(0);
    expect(screen.queryByText("Aliments élevage")).not.toBeInTheDocument();
  });

  it("une entrée référentiel désactivée produit le suffixe « (réf. désactivé) »", () => {
    render(
      <RapprochementVueMensuelle
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        lignes={[ligne({ id: "poste-inactif::0", libelle: "Salaires terrain" })]}
        nonRapproche={[]}
        totalMonetaire={undefined}
        totalQuantite={undefined}
        posteRattachementParId={posteRattachementParId}
      />
    );
    expect(screen.getAllByText("Salaires terrain (réf. désactivé)").length).toBeGreaterThan(0);
  });

  it("une entrée référentiel désactivée produit le suffixe MÊME quand le libellé COÏNCIDE (règle non négociable §16.12, sous-cas propagé jusqu'à cette vue)", () => {
    render(
      <RapprochementVueMensuelle
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        lignes={[ligne({ id: "poste-inactif-coincident::0", libelle: "Carburant" })]}
        nonRapproche={[]}
        totalMonetaire={undefined}
        totalQuantite={undefined}
        posteRattachementParId={posteRattachementParId}
      />
    );
    expect(screen.getAllByText("Carburant (réf. désactivé)").length).toBeGreaterThan(0);
  });

  it("les lignes NON_RAPPROCHE (sans PostePrevision) ne sont jamais enrichies, même si posteRattachementParId est fourni", () => {
    render(
      <RapprochementVueMensuelle
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        lignes={[ligne({ id: "poste-divergent::0", statutRapprochement: "NON_RAPPROCHE" })]}
        nonRapproche={[]}
        totalMonetaire={undefined}
        totalQuantite={undefined}
        posteRattachementParId={posteRattachementParId}
      />
    );
    // La ligne NON_RAPPROCHE est filtree de la liste principale (rendue par
    // RapprochementNonRapproche a la place) — elle ne doit jamais apparaitre
    // enrichie ici.
    expect(screen.queryByText(/réf\./)).not.toBeInTheDocument();
  });
});

describe("RapprochementVueCumulee — propagation du rattachement", () => {
  function agregat(overrides: Partial<AgregatPosteDTO>): AgregatPosteDTO {
    return {
      cle: "poste-divergent",
      libelle: "Aliments élevage",
      natureGrandeur: "DEPENSE",
      totalPrevu: 100000,
      totalReel: 90000,
      totalEcartAbsolu: 10000,
      nombreLignes: 3,
      nombreLignesSansSourceReelle: 0,
      nombreLignesNonRapprochees: 0,
      ecartPct: 10,
      sens: "FAVORABLE",
      couleur: "favorable",
      ...overrides,
    };
  }

  it("SANS posteRattachementParId, le libellé brut est affiché tel quel", () => {
    render(
      <RapprochementVueCumulee
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        totalGlobalMonetaire={undefined}
        totalGlobalQuantite={undefined}
        parPoste={[agregat({})]}
      />
    );
    expect(screen.getAllByText("Aliments élevage").length).toBeGreaterThan(0);
  });

  it("AVEC posteRattachementParId, un poste cumulé (clé SANS suffixe mois) divergent affiche le suffixe compact", () => {
    render(
      <RapprochementVueCumulee
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        totalGlobalMonetaire={undefined}
        totalGlobalQuantite={undefined}
        parPoste={[agregat({})]}
        posteRattachementParId={posteRattachementParId}
      />
    );
    expect(screen.getAllByText("Aliments élevage (réf. Aliments)").length).toBeGreaterThan(0);
  });

  it("une entrée référentiel désactivée produit le suffixe MÊME quand le libellé COÏNCIDE (règle non négociable §16.12)", () => {
    render(
      <RapprochementVueCumulee
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        totalGlobalMonetaire={undefined}
        totalGlobalQuantite={undefined}
        parPoste={[agregat({ cle: "poste-inactif-coincident", libelle: "Carburant" })]}
        posteRattachementParId={posteRattachementParId}
      />
    );
    expect(screen.getAllByText("Carburant (réf. désactivé)").length).toBeGreaterThan(0);
  });
});

describe("RapprochementVueTopEcarts — propagation du rattachement", () => {
  it("SANS posteRattachementParId, les libellés bruts sont affichés tels quels, pour les DEUX classements", () => {
    render(
      <RapprochementVueTopEcarts
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        lignesMonetaires={[ligne({ id: "poste-divergent::0" })]}
        lignesQuantite={[ligne({ id: "poste-inactif::0", libelle: "Salaires terrain", natureGrandeur: "QUANTITE" })]}
      />
    );
    expect(screen.getAllByText("Aliments élevage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Salaires terrain").length).toBeGreaterThan(0);
  });

  it("AVEC posteRattachementParId, le suffixe compact apparaît DANS LES DEUX classements (monétaire ET quantité)", () => {
    render(
      <RapprochementVueTopEcarts
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        lignesMonetaires={[ligne({ id: "poste-divergent::0" })]}
        lignesQuantite={[ligne({ id: "poste-inactif::0", libelle: "Salaires terrain", natureGrandeur: "QUANTITE" })]}
        posteRattachementParId={posteRattachementParId}
      />
    );
    expect(screen.getAllByText("Aliments élevage (réf. Aliments)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Salaires terrain (réf. désactivé)").length).toBeGreaterThan(0);
  });

  it("une entrée référentiel désactivée produit le suffixe MÊME quand le libellé COÏNCIDE, dans les DEUX classements", () => {
    render(
      <RapprochementVueTopEcarts
        dateDebutPlan={dateDebutPlan}
        moisAbsolu={0}
        lignesMonetaires={[ligne({ id: "poste-inactif-coincident::0", libelle: "Carburant" })]}
        lignesQuantite={[
          ligne({ id: "poste-inactif-coincident::0", libelle: "Carburant", natureGrandeur: "QUANTITE" }),
        ]}
        posteRattachementParId={posteRattachementParId}
      />
    );
    expect(screen.getAllByText("Carburant (réf. désactivé)").length).toBeGreaterThan(1);
  });
});
