// @vitest-environment jsdom
/**
 * Tests (legers) — DepensesListClient, bandeau "N depense(s) recurrente(s)
 * configuree(s)" (ERR-176, story C.4 du sprint PR3-ter).
 *
 * Avant le fix, ce texte etait construit a la main dans le composant
 * (concatenation de chaines codees en dur "depense", "recurrente",
 * "configuree" + pluriel manuel), invisible a tout controle i18n — d'ou les
 * libelles non accentues signales sur l'ecran /depenses ("recurrentes
 * configurees"). Le fix route ce texte par la cle i18n
 * `depenses.list.recurringSummary` (pluriel ICU).
 *
 * Ce test utilise le vrai `NextIntlClientProvider` avec le vrai catalogue
 * `fr/depenses.json` (pas un mock de dictionnaire) : il discrimine donc
 * aussi une regression de la regle de pluriel ICU elle-meme dans le JSON,
 * pas seulement un retour a la concatenation codee en dur.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { DepensesListClient } from "@/components/depenses/depenses-list-client";
import frDepenses from "@/messages/fr/depenses.json";

vi.mock("@/components/filters/saved-filters-chips", () => ({
  SavedFiltersChips: () => null,
}));

function renderWithIntl(
  templatesActifsCount: number,
  depenses: Parameters<typeof DepensesListClient>[0]["depenses"] = []
) {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ depenses: frDepenses }}>
      <DepensesListClient
        depenses={depenses}
        canManage={false}
        canPay={false}
        templatesActifsCount={templatesActifsCount}
      />
    </NextIntlClientProvider>
  );
}

describe("DepensesListClient — bandeau recurrentes (ERR-176)", () => {
  it("affiche le pluriel accentue pour plusieurs templates actifs", () => {
    renderWithIntl(3);
    expect(
      screen.getByText("3 dépenses récurrentes configurées")
    ).toBeInTheDocument();
    // L'ancien texte non accentue ne doit plus jamais apparaitre.
    expect(
      screen.queryByText((content) => content.includes("recurrentes configurees"))
    ).not.toBeInTheDocument();
  });

  it("affiche le singulier accentue pour un seul template actif", () => {
    renderWithIntl(1);
    expect(
      screen.getByText("1 dépense récurrente configurée")
    ).toBeInTheDocument();
  });

  it("ne montre pas le bandeau quand aucun template n'est actif", () => {
    renderWithIntl(0);
    expect(screen.queryByText(/configurée/)).not.toBeInTheDocument();
  });

  it(
    "affiche le statut PAYEE accentue depuis le referentiel `depenses.statuts.*` (symptome ERR-176)",
    () => {
      renderWithIntl(0, [
        {
          id: "dep-1",
          numero: "D-2026-001",
          description: "Achat aliment",
          categorieDepense: "ALIMENT",
          montantTotal: 10000,
          montantPaye: 10000,
          statut: "PAYEE",
          date: "2026-01-05T00:00:00.000Z",
          dateEcheance: null,
          commande: null,
          vague: null,
          _count: { paiements: 1 },
        },
      ]);
      expect(screen.getByText("Payée")).toBeInTheDocument();
      expect(screen.queryByText("Payee")).not.toBeInTheDocument();
    }
  );
});
