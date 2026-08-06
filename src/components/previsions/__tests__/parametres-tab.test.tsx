// @vitest-environment jsdom
/**
 * Tests — ParametresTab.
 *
 * `nombreBacsSimultanesCible` reste saisissable mais jamais lu par le moteur
 * de calcul (`src/lib/previsions/*`, purement indicatif, ADR-053 section 4) —
 * un utilisateur qui le renseigne doit en etre informe la ou il le saisit.
 *
 * `margeSecuriteAlevinsPct`, en revanche, EST desormais lu par le moteur
 * depuis la story PR2bis.3 (fix ERR-141/ERR-142) : le hint affirme
 * maintenant qu'elle est appliquee au cout des alevins et a la logistique
 * alevins, sans effet sur le besoin en aliment ni le revenu prevu.
 */
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParametresTab } from "@/components/previsions/parametres-tab";
import { Permission, StatutScenarioPrevision } from "@/types";
import type { ScenarioPrevisionDetailDTO } from "@/components/previsions/api-types";
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

const mockPut = vi.fn();
vi.mock("@/hooks/use-previsions-api", () => ({
  usePrevisionsApi: () => ({ post: vi.fn(), put: mockPut, get: vi.fn(), patch: vi.fn(), del: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockPut.mockResolvedValue({ ok: true });
});

const scenario: ScenarioPrevisionDetailDTO = {
  id: "scenario-1",
  code: "SC-1",
  nom: "Scenario test",
  description: null,
  dureeCycleMois: 7,
  dateDebutPlan: "2026-09-01T00:00:00.000Z",
  statut: StatutScenarioPrevision.BROUILLON,
  userId: "user-1",
  siteId: "site-1",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  parametres: {
    id: "param-1",
    scenarioId: "scenario-1",
    effectifAlevinsParVague: 5000,
    margeSecuriteAlevinsPct: 10,
    poidsMoyenInitialG: 5,
    poidsObjectifG: 800,
    prixAlevinUnitaireFCFA: 50,
    prixVenteKgFCFA: 1500,
    nombreBacsSimultanesCible: 4,
    frequenceStockageMois: 1,
    capaciteTransportAlimentsSacs: null,
    coutTransportAlimentsFCFA: null,
    capaciteTransportPoissonsKg: null,
    coutTransportPoissonsFCFA: null,
    capaciteTransportAlevinsNb: null,
    coutTransportAlevinsFCFA: null,
    tauxEpargnePct: 0,
    alevinsAchetesParDefaut: false,
  },
  paliersRemise: [],
  nombreCalibresAlimentsCrees: 0,
};

describe("ParametresTab — signalement des parametres (lus ou non par le moteur)", () => {
  it("signale que la marge de securite alevins est appliquee au cout des alevins et a la logistique, pas au besoin en aliment ni au revenu", () => {
    render(<ParametresTab scenario={scenario} permissions={[Permission.PREVISIONS_PARAMETRER]} />);
    expect(
      screen.getByText(/à la logistique alevins.*n'affecte ni le besoin en aliment ni le revenu prévu/i)
    ).toBeInTheDocument();
  });

  it("signale que le nombre de bacs simultanes cible n'est pas utilise par le calcul", () => {
    render(<ParametresTab scenario={scenario} permissions={[Permission.PREVISIONS_PARAMETRER]} />);
    expect(screen.getByText(/n'est pas utilisé par le calcul/i)).toBeInTheDocument();
  });
});

/**
 * Paliers de remise — le composant n'etait monte qu'avec `paliersRemise: []`
 * (trou de couverture releve par la pre-analyse PR2-septies) : le champ
 * "seuil", son libelle et son binding n'etaient rendus par AUCUN test, ce qui
 * a laisse survivre le libelle "Seuil (sacs)" au-dessus d'une colonne qui
 * contient des tonnes (ERR-143).
 *
 * ERR-157 : tout ce qui suit est de la STRUCTURE DE DOM (texte des libelles,
 * valeurs des champs). Aucune de ces assertions ne prouve quoi que ce soit sur
 * la mise en page rendue (largeur des colonnes a 360 px, debordement du texte
 * d'aide) — jsdom ne calcule aucune boite. La verification de presentation est
 * faite separement en navigateur reel.
 */
const scenarioAvecPaliers: ScenarioPrevisionDetailDTO = {
  ...scenario,
  paliersRemise: [
    { id: "pal-1", scenarioId: "scenario-1", seuilTonnes: 0, pourcentageRemise: 0, ordre: 1, siteId: "site-1" },
    { id: "pal-2", scenarioId: "scenario-1", seuilTonnes: 5, pourcentageRemise: 2, ordre: 2, siteId: "site-1" },
    { id: "pal-3", scenarioId: "scenario-1", seuilTonnes: 10, pourcentageRemise: 4, ordre: 3, siteId: "site-1" },
  ],
};

describe("ParametresTab — paliers de remise (unite et aide contextuelle)", () => {
  it("libelle le seuil en TONNES, jamais en sacs", () => {
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    const seuils = screen.getAllByLabelText("Seuil (tonnes)");
    expect(seuils).toHaveLength(3);
    expect(seuils.map((i) => (i as HTMLInputElement).value)).toEqual(["0", "5", "10"]);
    // Le seul autre champ de l'onglet libelle en sacs est la capacite de
    // transport, qui EST bien en sacs — c'est le seuil de palier, et lui seul,
    // qui ne doit plus l'etre.
    expect(screen.queryByLabelText(/^Seuil \(sacs\)$/i)).not.toBeInTheDocument();
  });

  it("explique que la remise est decidee par vague sur son tonnage vise, et non sur le volume d'aliment achete", () => {
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    expect(screen.getByText(/décidée une seule fois par vague.*tonnage de poisson visé/i)).toBeInTheDocument();
    expect(screen.getByText(/coût d'aliment de toute la vague, toutes granulométries confondues/i)).toBeInTheDocument();
    expect(screen.getByText(/seuil est le plus grand parmi ceux inférieurs ou égaux à ce tonnage/i)).toBeInTheDocument();
    expect(screen.queryByText(/volume d'aliment acheté/i)).not.toBeInTheDocument();
  });

  it("rappelle l'unite sous le premier palier uniquement (l'unite ne change pas d'un palier a l'autre)", () => {
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    const hints = screen.getAllByText(/En tonnes de poisson visées par vague/i);
    expect(hints).toHaveLength(1);
    // Le hint est bien rattache au champ du premier palier via aria-describedby.
    const premierSeuil = screen.getAllByLabelText("Seuil (tonnes)")[0];
    expect(premierSeuil.getAttribute("aria-describedby")).toBe(hints[0].id);
  });
});

/**
 * Story PR2oct.4 — drapeau `alevinsAchetesParDefaut` (ADR-053 §14 / ERR-170).
 *
 * Point de non-regression explicite (§14.4, pre-analyse PR2oct.4) :
 * `prixAlevinUnitaireFCFA` reste TOUJOURS saisi, affiche, editable, quel que
 * soit l'etat du drapeau — ni masque, ni `disabled`. C'est exactement le
 * raccourci qu'un futur developpeur pourrait etre tente de reprendre
 * ("le prix alevin ne sert que si les alevins sont achetes, autant le
 * desactiver quand ce n'est pas le cas") : ce test le rend explicitement
 * regressif.
 */
describe("ParametresTab — drapeau alevinsAchetesParDefaut (ADR-053 §14)", () => {
  it("la case a cocher est presente et refletee la valeur du scenario", () => {
    render(<ParametresTab scenario={scenario} permissions={[Permission.PREVISIONS_PARAMETRER]} />);
    const checkbox = screen.getByRole("checkbox", {
      name: /Alevins achetés par défaut/i,
    }) as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
  });

  it("reflete `true` quand `scenario.parametres.alevinsAchetesParDefaut` vaut true", () => {
    const scenarioAvecDefaut = {
      ...scenario,
      parametres: { ...scenario.parametres!, alevinsAchetesParDefaut: true },
    };
    render(<ParametresTab scenario={scenarioAvecDefaut} permissions={[Permission.PREVISIONS_PARAMETRER]} />);
    const checkbox = screen.getByRole("checkbox", {
      name: /Alevins achetés par défaut/i,
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("est cochable/decochable par l'utilisateur", async () => {
    const user = userEvent.setup();
    render(<ParametresTab scenario={scenario} permissions={[Permission.PREVISIONS_PARAMETRER]} />);
    const checkbox = screen.getByRole("checkbox", { name: /Alevins achetés par défaut/i });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("est inclus explicitement dans le corps du PUT lors de l'enregistrement des parametres", async () => {
    const user = userEvent.setup();
    render(<ParametresTab scenario={scenario} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    await user.click(screen.getByRole("checkbox", { name: /Alevins achetés par défaut/i }));
    await user.click(screen.getByText("Enregistrer les paramètres"));

    expect(mockPut).toHaveBeenCalledWith(
      "/api/previsions/scenarios/scenario-1/parametres",
      expect.objectContaining({ alevinsAchetesParDefaut: true })
    );
  });

  it("envoie explicitement `false` (pas absent) quand la case n'a jamais ete touchee et vaut false", async () => {
    const user = userEvent.setup();
    render(<ParametresTab scenario={scenario} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    await user.click(screen.getByText("Enregistrer les paramètres"));

    expect(mockPut).toHaveBeenCalledWith(
      "/api/previsions/scenarios/scenario-1/parametres",
      expect.objectContaining({ alevinsAchetesParDefaut: false })
    );
  });

  it("est desactivee (disabled) quand l'utilisateur n'a pas la permission PREVISIONS_PARAMETRER", () => {
    render(<ParametresTab scenario={scenario} permissions={[]} />);
    const checkbox = screen.getByRole("checkbox", { name: /Alevins achetés par défaut/i });
    expect(checkbox).toBeDisabled();
  });

  it("affiche le hint explicatif du drapeau (edite chaque nouvelle vague, modifiable ensuite)", () => {
    render(<ParametresTab scenario={scenario} permissions={[Permission.PREVISIONS_PARAMETRER]} />);
    expect(
      screen.getByText(/S'applique à chaque nouvelle vague planifiée.*modifiable ensuite vague par vague/i)
    ).toBeInTheDocument();
  });

  /**
   * Non-regression ADR-053 §14.4 — le champ le plus tentant a "optimiser" en
   * le desactivant quand `alevinsAchetesParDefaut` est false. Ce n'est PAS le
   * comportement attendu : `prixAlevinUnitaireFCFA` s'applique a chaque vague
   * qui choisit individuellement d'acheter ses alevins, independamment du
   * defaut du scenario — le desactiver romprait cette possibilite.
   */
  it.each([true, false])(
    "prixAlevinUnitaireFCFA reste visible ET editable (jamais disabled) quand alevinsAchetesParDefaut = %s",
    (valeur) => {
      const scenarioVariante = {
        ...scenario,
        parametres: { ...scenario.parametres!, alevinsAchetesParDefaut: valeur },
      };
      render(<ParametresTab scenario={scenarioVariante} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

      const champPrix = screen.getByLabelText(/Prix alevin unitaire/i) as HTMLInputElement;
      expect(champPrix).toBeInTheDocument();
      expect(champPrix).not.toBeDisabled();
      expect(champPrix.value).toBe("50");
    }
  );

  it("prixAlevinUnitaireFCFA porte le hint contextuel explicite, lie par aria-describedby", () => {
    render(<ParametresTab scenario={scenario} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    const champPrix = screen.getByLabelText(/Prix alevin unitaire/i);
    const hint = screen.getByText(/Appliqué uniquement aux vagues dont « Alevins achetés » est actif/i);
    expect(champPrix.getAttribute("aria-describedby")).toBe(hint.id);
  });
});

describe("ParametresTab — `ordre` d'un palier ajoute apres une suppression au milieu", () => {
  it("attribue max(ordres) + 1, jamais un ordre deja pris (409 sur @@unique([scenarioId, ordre]))", async () => {
    const user = userEvent.setup();
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    const ordres = () => screen.getAllByLabelText("Ordre").map((i) => (i as HTMLInputElement).value);
    expect(ordres()).toEqual(["1", "2", "3"]);

    // Suppression du palier du MILIEU (ordre 2) -> il reste les ordres 1 et 3.
    await user.click(screen.getAllByLabelText("Supprimer ce palier")[1]);
    expect(ordres()).toEqual(["1", "3"]);

    // Ancien calcul `prev.length + 1` = 3 -> doublon de l'ordre 3 deja present.
    await user.click(screen.getByText("Ajouter un palier"));
    expect(ordres()).toEqual(["1", "3", "4"]);

    // Les seuils suivent le meme ajout : le nouveau palier demarre a 0 tonne.
    expect(screen.getAllByLabelText("Seuil (tonnes)").map((i) => (i as HTMLInputElement).value)).toEqual([
      "0",
      "10",
      "0",
    ]);
  });

  it("les identifiants temporaires restent uniques apres suppression puis ajout (cle React)", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />
    );

    await user.click(screen.getByText("Ajouter un palier")); // -> nouveau-0
    await user.click(screen.getAllByLabelText("Supprimer ce palier")[0]); // supprime pal-1
    await user.click(screen.getByText("Ajouter un palier")); // -> nouveau-1, jamais nouveau-0 a nouveau

    // 4 cartes de palier distinctes rendues (aucune collision de cle React,
    // qui se traduirait par une carte manquante).
    expect(screen.getAllByLabelText("Seuil (tonnes)")).toHaveLength(4);
    expect(within(container).getAllByLabelText("Ordre").map((i) => (i as HTMLInputElement).value)).toEqual([
      "2",
      "3",
      "4",
      "5",
    ]);
  });
});

/**
 * Correctifs de la review PR2sept.4.
 *
 * ERR-157 : ces tests verifient de la STRUCTURE DE DOM et du COMPORTEMENT
 * d'etat (valeur du champ apres frappe, attributs `step`/`aria-describedby`,
 * texte d'erreur rendu). Ils ne prouvent RIEN sur la mise en page a 360 px
 * (largeur des colonnes, debordement du texte d'erreur sous le champ Ordre) :
 * jsdom ne calcule aucune boite. Cette partie est verifiee separement en
 * navigateur reel.
 */
describe("ParametresTab — paliers : saisie decimale du seuil (tonnes, pas sacs)", () => {
  it("accepte un seuil fractionnaire frappe caractere par caractere (etat chaine, pas Number a chaque frappe)", async () => {
    const user = userEvent.setup();
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    const seuil = screen.getAllByLabelText("Seuil (tonnes)")[1] as HTMLInputElement;
    await user.clear(seuil);
    // L'etat intermediaire "2." (et "" apres le clear) doit survivre : avec un
    // etat numerique, `Number("2.")` -> 2 puis `Number("")` -> 0 ecrasaient la
    // frappe et rendaient "2.5" litteralement impossible a saisir.
    await user.type(seuil, "2.5");
    expect(seuil.value).toBe("2.5");
  });

  it("declare step=\"any\" sur le seuil ET la remise (Decimal), step=1 sur l'ordre (Int)", () => {
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    // Sans step="any", le step=1 implicite du navigateur met "2.5" en :invalid.
    for (const input of screen.getAllByLabelText("Seuil (tonnes)")) {
      expect(input).toHaveAttribute("step", "any");
    }
    for (const input of screen.getAllByLabelText("Remise (%)")) {
      expect(input).toHaveAttribute("step", "any");
    }
    for (const input of screen.getAllByLabelText("Ordre")) {
      expect(input).toHaveAttribute("step", "1");
    }
  });

  it("transmet la valeur decimale a l'API sans arrondi", async () => {
    const user = userEvent.setup();
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    const seuil = screen.getAllByLabelText("Seuil (tonnes)")[1] as HTMLInputElement;
    await user.clear(seuil);
    await user.type(seuil, "2.5");
    await user.click(screen.getByText("Enregistrer les paliers"));

    expect(mockPut).toHaveBeenCalledWith(
      "/api/previsions/scenarios/scenario-1/paliers-remise",
      expect.objectContaining({
        paliers: [
          { seuilTonnes: 0, pourcentageRemise: 0, ordre: 1 },
          { seuilTonnes: 2.5, pourcentageRemise: 2, ordre: 2 },
          { seuilTonnes: 10, pourcentageRemise: 4, ordre: 3 },
        ],
      })
    );
  });
});

describe("ParametresTab — paliers : le refus d'un doublon d'ordre est restitue au champ fautif", () => {
  it("affiche le message de l'API sous le champ Ordre designe par `paliers.<i>.ordre`", async () => {
    const user = userEvent.setup();
    mockPut.mockResolvedValue({
      ok: false,
      errors: [
        {
          field: "paliers.1.ordre",
          message:
            "Deux paliers de remise ne peuvent pas avoir le meme ordre d'evaluation : l'ordre 1 est utilise par le palier 1 et le palier 2.",
        },
      ],
    });
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    await user.click(screen.getByText("Enregistrer les paliers"));

    const ordres = screen.getAllByLabelText("Ordre");
    const fautif = ordres[1];
    expect(fautif).toHaveAttribute("aria-invalid", "true");
    // Le message est lie au champ, pas seulement affiche quelque part.
    const describedBy = fautif.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(/meme ordre d'evaluation/i);
    // Les autres champs Ordre ne sont pas marques fautifs.
    expect(ordres[0]).not.toHaveAttribute("aria-invalid");
    expect(ordres[2]).not.toHaveAttribute("aria-invalid");
  });

  it("efface l'erreur du champ des que l'utilisateur corrige sa saisie", async () => {
    const user = userEvent.setup();
    mockPut.mockResolvedValue({
      ok: false,
      errors: [{ field: "paliers.1.ordre", message: "Doublon d'ordre." }],
    });
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    await user.click(screen.getByText("Enregistrer les paliers"));
    expect(screen.getByText("Doublon d'ordre.")).toBeInTheDocument();

    await user.type(screen.getAllByLabelText("Ordre")[1], "9");
    expect(screen.queryByText("Doublon d'ordre.")).not.toBeInTheDocument();
  });

  /**
   * Les cles de `paliersFieldErrors` sont POSITIONNELLES
   * (`paliers.<index>.<champ>`). Supprimer un palier situe AVANT le palier
   * fautif fait glisser les index restants : une erreur conservee telle quelle
   * designerait alors un AUTRE palier que celui que l'API a refuse — un champ
   * marque `aria-invalid` a tort, avec un message qui ne le concerne pas.
   * `removePalier` doit donc vider la table d'erreurs.
   */
  it("vide les erreurs de palier a la suppression (les cles sont positionnelles : sinon l'erreur glisse sur un autre palier)", async () => {
    const user = userEvent.setup();
    mockPut.mockResolvedValue({
      ok: false,
      // Palier d'index 1 (ordre 2) refuse.
      errors: [{ field: "paliers.1.ordre", message: "Doublon d'ordre." }],
    });
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    await user.click(screen.getByText("Enregistrer les paliers"));
    expect(screen.getAllByLabelText("Ordre")[1]).toHaveAttribute("aria-invalid", "true");

    // Suppression du palier d'index 0 : l'ancien index 2 (ordre 3, jamais
    // refuse) devient l'index 1. Une erreur conservee le marquerait a tort.
    await user.click(screen.getAllByLabelText("Supprimer ce palier")[0]);

    const ordres = screen.getAllByLabelText("Ordre");
    expect(ordres.map((i) => (i as HTMLInputElement).value)).toEqual(["2", "3"]);
    expect(screen.queryByText("Doublon d'ordre.")).not.toBeInTheDocument();
    for (const champ of ordres) {
      expect(champ).not.toHaveAttribute("aria-invalid");
    }
  });

  it("aria-describedby ne reference jamais un id non rendu quand un champ porte a la fois un hint et une erreur", async () => {
    const user = userEvent.setup();
    mockPut.mockResolvedValue({
      ok: false,
      // Le PREMIER palier est le seul a porter un hint d'unite : c'est
      // exactement la ou hint + error se rencontrent.
      errors: [{ field: "paliers.0.seuilTonnes", message: "Seuil refuse." }],
    });
    render(<ParametresTab scenario={scenarioAvecPaliers} permissions={[Permission.PREVISIONS_PARAMETRER]} />);

    await user.click(screen.getByText("Enregistrer les paliers"));

    const premierSeuil = screen.getAllByLabelText("Seuil (tonnes)")[0];
    const ids = (premierSeuil.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      // Un aria-describedby pointant un id absent du DOM n'annonce rien : le
      // lecteur d'ecran reste muet alors que l'attribut promet une description.
      expect(document.getElementById(id), `id orphelin: ${id}`).not.toBeNull();
    }
    expect(document.getElementById(ids[0])).toHaveTextContent("Seuil refuse.");
    // L'erreur remplace le hint (il n'est plus rendu) — donc plus reference.
    expect(screen.queryByText(/En tonnes de poisson visées par vague/i)).not.toBeInTheDocument();
  });
});
