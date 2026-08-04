// @vitest-environment jsdom
/**
 * Tests — ValeurCalculee (Sprint PR2, story PR2.3, ADR-053 §7.4)
 *
 * Composant : src/components/previsions/valeur-calculee.tsx
 *
 * Couverture — l'exigence d'ergonomie la plus importante de la story :
 * 1. Valeur non éditable et visuellement neutre (pas de bordure `border-input`
 *    ni de `<input>`/`<select>` sous-jacent — distinct du style saisissable)
 * 2. Le déclencheur d'explication est accessible : rôle bouton, aria-label,
 *    navigation clavier (focus, activation au clavier ouvre le Popover)
 * 3. Le popover expose la formule ET les valeurs sources — une explication
 *    vide ou du type "calculé automatiquement" seul ne suffirait pas
 * 4. className additionnelle appliquée sans écraser le style neutre de base
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ValeurCalculee } from "@/components/previsions/valeur-calculee";
import frPrevisions from "@/messages/fr/previsions.json";

function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce((cur, part) => {
    if (cur !== null && typeof cur === "object") return (cur as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const value = deepGet(frPrevisions, key);
    return typeof value === "string" ? value : key;
  },
}));

// ---------------------------------------------------------------------------
// Suite 1 — Distinction visuelle saisie / calcul
// ---------------------------------------------------------------------------

describe("ValeurCalculee — distinction visuelle saisie/calcul", () => {
  it("ne rend aucun <input> ni <select> sous-jacent (rien n'est saisissable)", () => {
    render(
      <ValeurCalculee
        value="480 kg"
        formule="Besoin aliment = biomasse cible x coefficient standard"
        explication={[{ label: "Biomasse cible", valeur: "60 kg" }]}
      />
    );

    expect(document.querySelector("input")).toBeNull();
    expect(document.querySelector("select")).toBeNull();
  });

  it("le conteneur de la valeur n'utilise jamais la bordure `border-input` réservée aux champs saisissables", () => {
    const { container } = render(
      <ValeurCalculee
        value="480 kg"
        formule="Besoin aliment = biomasse cible x coefficient standard"
        explication={[{ label: "Biomasse cible", valeur: "60 kg" }]}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toMatch(/border-input/);
  });

  it("affiche la valeur avec un style de fond neutre (bg-muted), signal visuel de non-editabilité", () => {
    const { container } = render(
      <ValeurCalculee
        value="480 kg"
        formule="Besoin aliment = biomasse cible x coefficient standard"
        explication={[{ label: "Biomasse cible", valeur: "60 kg" }]}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/bg-muted/);
  });

  it("affiche bien la valeur passée en prop", () => {
    render(
      <ValeurCalculee
        value="480 kg"
        formule="Besoin aliment = biomasse cible x coefficient standard"
        explication={[{ label: "Biomasse cible", valeur: "60 kg" }]}
      />
    );

    expect(screen.getByText("480 kg")).toBeInTheDocument();
  });

  it("applique une className additionnelle (ex. text-danger pour un négatif) sans supprimer le style neutre", () => {
    const { container } = render(
      <ValeurCalculee
        value="-100 FCFA"
        formule="Solde = apports - depenses"
        explication={[{ label: "Apports", valeur: "0 FCFA" }]}
        className="text-danger"
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/text-danger/);
    expect(root.className).toMatch(/bg-muted/);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Accessibilité du déclencheur d'explication
// ---------------------------------------------------------------------------

describe("ValeurCalculee — accessibilité du bouton d'explication", () => {
  it("le déclencheur est un <button> avec un aria-label par défaut", () => {
    render(
      <ValeurCalculee
        value="480 kg"
        formule="Besoin aliment = biomasse cible x coefficient standard"
        explication={[{ label: "Biomasse cible", valeur: "60 kg" }]}
      />
    );

    const bouton = screen.getByRole("button", { name: "Voir le détail du calcul" });
    expect(bouton).toBeInTheDocument();
    expect(bouton.tagName).toBe("BUTTON");
  });

  it("accepte un aria-label personnalisé", () => {
    render(
      <ValeurCalculee
        value="480 kg"
        formule="Besoin aliment = biomasse cible x coefficient standard"
        explication={[{ label: "Biomasse cible", valeur: "60 kg" }]}
        ariaLabel="Expliquer le cout aliment total de V1"
      />
    );

    expect(
      screen.getByRole("button", { name: "Expliquer le cout aliment total de V1" })
    ).toBeInTheDocument();
  });

  it("le bouton est accessible au clavier (focusable, type=button)", () => {
    render(
      <ValeurCalculee
        value="480 kg"
        formule="Besoin aliment = biomasse cible x coefficient standard"
        explication={[{ label: "Biomasse cible", valeur: "60 kg" }]}
      />
    );

    const bouton = screen.getByRole("button", { name: "Voir le détail du calcul" });
    expect(bouton).toHaveAttribute("type", "button");
    bouton.focus();
    expect(bouton).toHaveFocus();
  });

  it("ouvre le popover au clic", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ValeurCalculee
        value="480 kg"
        formule="Besoin aliment = biomasse cible x coefficient standard multiplie par le poids par sac"
        explication={[{ label: "Biomasse cible", valeur: "60 kg" }]}
      />
    );

    const bouton = screen.getByRole("button", { name: "Voir le détail du calcul" });
    await user.click(bouton);

    expect(
      await screen.findByText(
        "Besoin aliment = biomasse cible x coefficient standard multiplie par le poids par sac"
      )
    ).toBeInTheDocument();
  });

  it("ouvre le popover au clavier (Entrée sur le bouton focus)", async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <ValeurCalculee
        value="480 kg"
        formule="Cout aliment = sacs x poids par sac x prix par kg"
        explication={[{ label: "Nombre de sacs", valeur: "285 sacs" }]}
      />
    );

    const bouton = screen.getByRole("button", { name: "Voir le détail du calcul" });
    bouton.focus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByText("Cout aliment = sacs x poids par sac x prix par kg")
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Explicabilité (formule + valeurs sources), le point non négociable
// ---------------------------------------------------------------------------

describe("ValeurCalculee — explicabilité du chiffre (§7.4)", () => {
  it("affiche la formule en langage courant dans le popover", async () => {
    render(
      <ValeurCalculee
        value="285 sacs"
        formule="Cout aliment = sacs x poids par sac x prix par kg, remise de palier 2 appliquee"
        explication={[{ label: "Nombre de sacs", valeur: "285 sacs" }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Voir le détail du calcul" }));

    expect(
      await screen.findByText(
        "Cout aliment = sacs x poids par sac x prix par kg, remise de palier 2 appliquee"
      )
    ).toBeInTheDocument();
  });

  it("affiche chaque valeur source (label + valeur) listée dans explication", async () => {
    render(
      <ValeurCalculee
        value="480 kg"
        formule="Besoin aliment = biomasse cible x coefficient standard"
        explication={[
          { label: "Biomasse cible", valeur: "60 kg" },
          { label: "Coefficient standard", valeur: "8" },
          { label: "Poids par sac", valeur: "15 kg" },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Voir le détail du calcul" }));

    expect(await screen.findByText("Biomasse cible")).toBeInTheDocument();
    expect(screen.getByText("60 kg")).toBeInTheDocument();
    expect(screen.getByText("Coefficient standard")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Poids par sac")).toBeInTheDocument();
    expect(screen.getByText("15 kg")).toBeInTheDocument();
  });

  it("le composant ne fournit AUCUN texte-passepartout du type 'calcule automatiquement' à la place de la formule", async () => {
    render(
      <ValeurCalculee
        value="480 kg"
        formule="Besoin aliment = biomasse cible x coefficient standard"
        explication={[{ label: "Biomasse cible", valeur: "60 kg" }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Voir le détail du calcul" }));

    await screen.findByText("Besoin aliment = biomasse cible x coefficient standard");
    expect(screen.queryByText(/calcul[ée]* automatiquement/i)).not.toBeInTheDocument();
  });

  it("une formule vide serait un manquement à l'exigence — le composant l'affiche telle quelle sans compenser (pas de garde-fou interne), documente le risque si un appelant l'omet", async () => {
    render(
      <ValeurCalculee
        value="480 kg"
        formule=""
        explication={[{ label: "Biomasse cible", valeur: "60 kg" }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Voir le détail du calcul" }));

    // Le popover s'ouvre bien (le composant ne bloque pas), mais rien ne
    // garantit une formule non vide au niveau du composant — c'est la
    // responsabilité de l'appelant. Documenté comme réserve dans le rapport.
    expect(await screen.findByText("Biomasse cible")).toBeInTheDocument();
  });

  it("gère une liste d'explication vide sans planter (mais c'est un cas à éviter en usage réel)", async () => {
    expect(() =>
      render(
        <ValeurCalculee
          value="480 kg"
          formule="Besoin aliment = biomasse cible x coefficient standard"
          explication={[]}
        />
      )
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Garde-fou dev contre une régression future silencieuse (finding
// review PR2.3 #3) : une `formule`/`explication` vide émet un avertissement
// en développement (jamais une exception qui casserait un écran en prod).
// ---------------------------------------------------------------------------

describe("ValeurCalculee — garde-fou dev pour formule/explication vide", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("émet un avertissement console en développement si `formule` est vide", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <ValeurCalculee value="480 kg" formule="" explication={[{ label: "Biomasse cible", valeur: "60 kg" }]} />
    );

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/formule.*vide/i));
  });

  it("émet un avertissement console en développement si `explication` est vide", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <ValeurCalculee value="480 kg" formule="Besoin aliment = biomasse cible x coefficient standard" explication={[]} />
    );

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/explication.*vide/i));
  });

  it("ne plante jamais en production, meme avec formule/explication vides — pas d'exception qui casserait l'ecran", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => render(<ValeurCalculee value="480 kg" formule="" explication={[]} />)).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
