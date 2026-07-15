// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SavedFiltersSection } from "@/components/filters/saved-filters-section";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mutateAsyncMock = vi.fn().mockResolvedValue({ id: "sf-1", page: "releves" });

vi.mock("@/hooks/queries/use-saved-filters-queries", () => ({
  useSavedFilters: () => ({
    data: [{ id: "sf-1", name: "Mon filtre", page: "releves", filters: { vagueId: "v1" } }],
    isLoading: false,
  }),
  useCreateSavedFilter: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSavedFilter: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
  useDeleteSavedFilter: () => ({ mutate: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Tests — Fix 2 : renommage d'un filtre sauvegarde
// ---------------------------------------------------------------------------

describe("SavedFiltersSection — renommage", () => {
  beforeEach(() => {
    mutateAsyncMock.mockClear();
  });

  it("affiche un champ pre-rempli avec le nom actuel quand un chip est actif", () => {
    render(
      <SavedFiltersSection
        page="releves"
        currentFilters={{ vagueId: "v1" }}
        onLoadFilter={vi.fn()}
        hasActiveFilters
      />
    );

    fireEvent.click(screen.getByText("Mon filtre"));

    const input = screen.getByPlaceholderText("renamePlaceholder") as HTMLInputElement;
    expect(input.value).toBe("Mon filtre");
  });

  it("appelle la mutation avec le nouveau nom lors du renommage", async () => {
    render(
      <SavedFiltersSection
        page="releves"
        currentFilters={{ vagueId: "v1" }}
        onLoadFilter={vi.fn()}
        hasActiveFilters
      />
    );

    fireEvent.click(screen.getByText("Mon filtre"));

    const input = screen.getByPlaceholderText("renamePlaceholder") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Nouveau nom" } });
    fireEvent.click(screen.getByText("update"));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        id: "sf-1",
        page: "releves",
        filters: { vagueId: "v1" },
        name: "Nouveau nom",
      })
    );
  });

  it("affiche une erreur si le nom est vide", () => {
    render(
      <SavedFiltersSection
        page="releves"
        currentFilters={{ vagueId: "v1" }}
        onLoadFilter={vi.fn()}
        hasActiveFilters
      />
    );

    fireEvent.click(screen.getByText("Mon filtre"));

    const input = screen.getByPlaceholderText("renamePlaceholder") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByText("update"));

    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(screen.getByText("nameRequired")).toBeInTheDocument();
  });
});
