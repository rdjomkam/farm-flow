// @vitest-environment jsdom
/**
 * Tests — src/components/previsions/poste-rattachement-badge.tsx (story
 * A.5, ADR-053 §16.12). Couvre les deux formes de présentation ("carte" et
 * "compacte") — ce fichier ne fait QUE traduire `calculerSignalRattachement`
 * en JSX/texte, donc les tests vérifient exactement les textes attendus par
 * la story : « Référentiel : {libellé} », « Référentiel : {libellé} ·
 * désactivé », « (réf. {libelle}) », « (réf. désactivé) ».
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PosteRattachementLigne,
  suffixeCompactRattachement,
  enrichirLibelleAvecRattachement,
  posteIdDepuisLigneId,
} from "@/components/previsions/poste-rattachement-badge";
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

const tPrevisions = (key: string, values?: Record<string, string>) => {
  const value = deepGet(frPrevisions, key);
  return typeof value === "string" ? interpolate(value, values) : key;
};

describe("PosteRattachementLigne (forme carte)", () => {
  it("n'affiche rien quand posteReferentiel est undefined (défense contre un DTO incomplet, jamais un crash)", () => {
    const { container } = render(
      <PosteRattachementLigne libelleScenario="Electricite" posteReferentiel={undefined} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("n'affiche rien quand le libellé coïncide et l'entrée est active (cas majoritaire, aucun signal)", () => {
    const { container } = render(
      <PosteRattachementLigne
        libelleScenario="Electricite"
        posteReferentiel={{ libelle: "Electricite", actif: true }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("affiche « Référentiel : {libellé} » quand le libellé diverge (entrée active)", () => {
    render(
      <PosteRattachementLigne
        libelleScenario="Transport équipe production"
        posteReferentiel={{ libelle: "Transport", actif: true }}
      />
    );
    expect(screen.getByText(/Référentiel :/)).toBeInTheDocument();
    expect(screen.getByText(/Référentiel :/).textContent).toBe("Référentiel : Transport");
    expect(screen.queryByText(/désactivé/)).not.toBeInTheDocument();
  });

  it("affiche « Référentiel : {libellé} · désactivé » quand l'entrée est désactivée et divergente", () => {
    render(
      <PosteRattachementLigne
        libelleScenario="Salaires terrain"
        posteReferentiel={{ libelle: "Salaires équipe", actif: false }}
      />
    );
    const p = screen.getByText(/Référentiel :/).closest("p")!;
    expect(p.textContent).toBe("Référentiel : Salaires équipe· désactivé");
  });

  it("affiche « Référentiel : {libellé} · désactivé » même quand le libellé COÏNCIDE (règle non négociable §16.12)", () => {
    render(
      <PosteRattachementLigne
        libelleScenario="Carburant"
        posteReferentiel={{ libelle: "Carburant", actif: false }}
      />
    );
    const p = screen.getByText(/Référentiel :/).closest("p")!;
    expect(p.textContent).toBe("Référentiel : Carburant· désactivé");
  });
});

describe("suffixeCompactRattachement (forme compacte)", () => {
  it("retourne null quand aucun signal (coïncident, actif)", () => {
    expect(suffixeCompactRattachement(tPrevisions, "Electricite", { libelle: "Electricite", actif: true })).toBeNull();
  });

  it("retourne « réf. {libelle} » quand divergent et actif", () => {
    expect(
      suffixeCompactRattachement(tPrevisions, "Transport équipe production", { libelle: "Transport", actif: true })
    ).toBe("réf. Transport");
  });

  it("retourne « réf. désactivé » quand l'entrée est désactivée — quel que soit l'état de divergence", () => {
    expect(
      suffixeCompactRattachement(tPrevisions, "Salaires terrain", { libelle: "Salaires équipe", actif: false })
    ).toBe("réf. désactivé");
    expect(
      suffixeCompactRattachement(tPrevisions, "Carburant", { libelle: "Carburant", actif: false })
    ).toBe("réf. désactivé");
  });
});

describe("posteIdDepuisLigneId", () => {
  it("retire le suffixe '::{moisAbsolu}' d'un id de ligne mensuelle", () => {
    expect(posteIdDepuisLigneId("poste-123::5")).toBe("poste-123");
  });

  it("laisse un id sans suffixe inchangé (ligne d'agrégat cumulé)", () => {
    expect(posteIdDepuisLigneId("poste-123")).toBe("poste-123");
  });
});

describe("enrichirLibelleAvecRattachement", () => {
  const table = { "poste-1": { libelle: "Transport", actif: true } };

  it("retourne le libellé tel quel quand la table est undefined (no-op défensif)", () => {
    expect(enrichirLibelleAvecRattachement(tPrevisions, "poste-1::0", "Transport équipe", undefined)).toBe(
      "Transport équipe"
    );
  });

  it("retourne le libellé tel quel quand la clé n'est pas trouvée dans la table (ligne non rattachée à un PostePrevision)", () => {
    expect(enrichirLibelleAvecRattachement(tPrevisions, "granulometrie-G1::0", "G1", table)).toBe("G1");
  });

  it("enrichit le libellé avec « (réf. {libelle}) » quand la clé (avec suffixe mois) correspond et diverge", () => {
    expect(enrichirLibelleAvecRattachement(tPrevisions, "poste-1::3", "Transport équipe", table)).toBe(
      "Transport équipe (réf. Transport)"
    );
  });

  it("enrichit le libellé avec « (réf. {libelle}) » quand la clé (sans suffixe, agrégat cumulé) correspond et diverge", () => {
    expect(enrichirLibelleAvecRattachement(tPrevisions, "poste-1", "Transport équipe", table)).toBe(
      "Transport équipe (réf. Transport)"
    );
  });

  it("n'enrichit PAS le libellé quand la clé correspond mais ne diverge pas (aucun signal)", () => {
    expect(enrichirLibelleAvecRattachement(tPrevisions, "poste-1::0", "Transport", table)).toBe("Transport");
  });

  it("enrichit avec « (réf. désactivé) » quand l'entrée référentiel liée est désactivée", () => {
    const tableInactif = { "poste-2": { libelle: "Salaires équipe", actif: false } };
    expect(enrichirLibelleAvecRattachement(tPrevisions, "poste-2::1", "Salaires terrain", tableInactif)).toBe(
      "Salaires terrain (réf. désactivé)"
    );
  });
});
