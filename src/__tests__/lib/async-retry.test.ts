/**
 * Tests unitaires — async-retry.ts (Story CR4.1)
 *
 * Verifie le comportement du helper retryAsync :
 * - Reussite immediate (pas de retry)
 * - Reussite apres N tentatives
 * - Echec definitif apres maxRetries tentatives
 * - Log ERROR sur echec definitif
 * - Log WARN sur echec transitoire
 * - Pas de rejet de la promesse (fire-and-forget safe)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { retryAsync } from "@/lib/async-retry";

// Remplace setTimeout pour ne pas attendre reellement
vi.useFakeTimers();

describe("retryAsync", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resout immediatement si fn reussit du premier coup", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);

    const promise = retryAsync(fn, { maxRetries: 3, delayMs: 100 });
    await vi.runAllTimersAsync();
    await promise;

    expect(fn).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("reessaie apres un echec et reussit a la 2eme tentative", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue(undefined);

    const promise = retryAsync(fn, { maxRetries: 3, delayMs: 100, context: "test" });
    await vi.runAllTimersAsync();
    await promise;

    expect(fn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("reessaie 3 fois puis logue ERROR sur echec definitif", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("db error"));

    const promise = retryAsync(fn, { maxRetries: 3, delayMs: 100, context: "test-ctx" });
    await vi.runAllTimersAsync();
    await promise; // ne doit pas rejeter

    // 1 tentative initiale + 3 retries = 4 appels
    expect(fn).toHaveBeenCalledTimes(4);
    expect(console.warn).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledOnce();

    const errorCall = (console.error as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(errorCall[0]).toContain("[ERROR]");
    expect(errorCall[0]).toContain("test-ctx");
    expect(errorCall[0]).toContain("echec definitif");
    expect(errorCall[0]).toContain("3 retries");
  });

  it("ne rejette jamais la promesse meme apres echec definitif (fire-and-forget safe)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    const promise = retryAsync(fn, { maxRetries: 2, delayMs: 50 });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBeUndefined();
  });

  it("utilise un backoff exponentiel entre les retries", async () => {
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;

    // Spy sur setTimeout pour capturer les delais
    const setTimeoutSpy = vi
      .spyOn(global, "setTimeout")
      .mockImplementation((fn: TimerHandler, delay?: number) => {
        if (typeof delay === "number" && delay > 0) {
          delays.push(delay);
        }
        return originalSetTimeout(fn as () => void, 0);
      });

    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    const promise = retryAsync(fn, { maxRetries: 3, delayMs: 1000 });
    await vi.runAllTimersAsync();
    await promise;

    setTimeoutSpy.mockRestore();

    // delais attendus : 1000, 2000, 4000 (2^0, 2^1, 2^2 * 1000)
    expect(delays).toEqual(expect.arrayContaining([1000, 2000, 4000]));
  });

  it("fonctionne avec maxRetries=0 (pas de retry, echec definitif immedatement)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    const promise = retryAsync(fn, { maxRetries: 0, delayMs: 100, context: "no-retry" });
    await vi.runAllTimersAsync();
    await promise;

    expect(fn).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("utilise les valeurs par defaut (maxRetries=3, delayMs=1000) si options omises", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    const promise = retryAsync(fn);
    await vi.runAllTimersAsync();
    await promise;

    // 1 + 3 = 4 appels
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
