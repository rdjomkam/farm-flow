// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatBonLivraisonMessage,
  shareBonLivraisonPDF,
  type ShareBonLivraisonData,
} from "@/lib/share-bon-livraison";

const baseData: ShareBonLivraisonData = {
  numero: "BL-2026-001",
  date: new Date("2026-07-15T00:00:00.000Z"),
  client: { nom: "Jean Mballa" },
  nombreLignes: 2,
  montantTotal: 150000,
  resteAPayer: 50000,
};

describe("formatBonLivraisonMessage", () => {
  it("inclut le numero, la date, le client, le nombre de lignes, le total et le reste a payer", () => {
    const message = formatBonLivraisonMessage(baseData);

    expect(message).toContain("BL-2026-001");
    expect(message).toContain("Jean Mballa");
    expect(message).toContain("2");
    expect(message.replace(/\s/g, " ")).toContain("150 000 FCFA");
    expect(message.replace(/\s/g, " ")).toContain("50 000 FCFA");
    expect(message).toContain("(Généré depuis FarmFlow)");
  });
});

describe("shareBonLivraisonPDF", () => {
  const fakeBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" });

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(fakeBlob),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retourne une erreur si la reponse fetch n'est pas ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const result = await shareBonLivraisonPDF("bl-1", "BL-2026-001", baseData);

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("utilise navigator.share avec le fichier PDF quand canShare est disponible", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);

    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      canShare: canShareMock,
      share: shareMock,
    });

    const result = await shareBonLivraisonPDF("bl-1", "BL-2026-001", baseData);

    expect(result.ok).toBe(true);
    expect(canShareMock).toHaveBeenCalled();
    expect(shareMock).toHaveBeenCalledTimes(1);
    const callArgs = shareMock.mock.calls[0][0];
    expect(callArgs.files).toHaveLength(1);
    expect(callArgs.files[0].name).toBe("BL-2026-001.pdf");
    expect(callArgs.title).toContain("BL-2026-001");
  });

  it("gere silencieusement AbortError (annulation utilisateur)", async () => {
    const abortError = new DOMException("annule", "AbortError");
    const shareMock = vi.fn().mockRejectedValue(abortError);
    const canShareMock = vi.fn().mockReturnValue(true);

    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      canShare: canShareMock,
      share: shareMock,
    });

    const result = await shareBonLivraisonPDF("bl-1", "BL-2026-001", baseData);

    expect(result.ok).toBe(true);
    expect(result.cancelled).toBe(true);
  });

  it("retourne une erreur si navigator.share echoue pour une autre raison", async () => {
    const shareMock = vi.fn().mockRejectedValue(new Error("boom"));
    const canShareMock = vi.fn().mockReturnValue(true);

    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      canShare: canShareMock,
      share: shareMock,
    });

    const result = await shareBonLivraisonPDF("bl-1", "BL-2026-001", baseData);

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("bascule sur le fallback telechargement + wa.me quand canShare est absent", async () => {
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      canShare: undefined,
      share: undefined,
    });

    const createObjectURLMock = vi.fn().mockReturnValue("blob:fake-url");
    const revokeObjectURLMock = vi.fn();
    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    const windowOpenMock = vi.fn();
    vi.stubGlobal("open", windowOpenMock);

    const clickMock = vi.fn();
    const appendChildSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node) => node as Node);
    const removeChildSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation((node) => node as Node);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        if (tag === "a") {
          return {
            click: clickMock,
            href: "",
            download: "",
          } as unknown as HTMLAnchorElement;
        }
        return document.createElement(tag);
      });

    const result = await shareBonLivraisonPDF("bl-1", "BL-2026-001", baseData);

    expect(result.ok).toBe(true);
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(windowOpenMock).toHaveBeenCalledTimes(1);
    expect(windowOpenMock.mock.calls[0][0]).toContain("wa.me");

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
