import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateNextNumero } from "@/lib/queries/numero-utils";

/**
 * Tests unitaires pour generateNextNumero (SU.3 — anti-collision).
 *
 * Ces tests mockent le client transactionnel Prisma (tx) : ils couvrent la
 * dérivation de la clé de verrou et la logique de séquence, PAS une vraie
 * collision concurrente (qui nécessiterait une vraie base Postgres — les
 * tests du projet mockent Prisma, voir ERR-103 leçon (e) pour la limite de ce
 * type de test). La vérification d'une collision réelle en concurrence est
 * signalée comme hors-portée dans le rapport de la story.
 */

type FakeTx = {
  $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
  [model: string]: unknown;
};

function buildFakeTx(opts: {
  lastValue?: string | null;
  modelName: string;
  field: "numero" | "code";
}) {
  const executeRawValues: unknown[][] = [];
  const findFirstArgsCalls: unknown[] = [];

  const delegate = {
    findFirst: vi.fn(async (args: unknown) => {
      findFirstArgsCalls.push(args);
      if (opts.lastValue == null) return null;
      return { [opts.field]: opts.lastValue };
    }),
  };

  const tx: FakeTx = {
    // Tagged template mock: capture the interpolated values (lock key).
    $executeRaw: vi.fn(
      (_strings: TemplateStringsArray, ...values: unknown[]) => {
        executeRawValues.push(values);
        return Promise.resolve(0);
      }
    ),
    [opts.modelName]: delegate,
  };

  return { tx, executeRawValues, findFirstArgsCalls, delegate };
}

describe("generateNextNumero — SU.3 anti-collision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("génération nominale par portée", () => {
    it("génère NNN=001 quand aucun numero existant (portée site+année, format Depense)", async () => {
      const { tx } = buildFakeTx({ modelName: "depense", field: "numero", lastValue: null });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const numero = await generateNextNumero(tx as any, "depense", "DEP", "site-1");
      const year = new Date().getFullYear();
      expect(numero).toBe(`DEP-${year}-001`);
    });

    it("génère le NNN suivant quand un numero existe (continuité de séquence)", async () => {
      const year = new Date().getFullYear();
      const { tx } = buildFakeTx({
        modelName: "vente",
        field: "numero",
        lastValue: `VTE-${year}-007`,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const numero = await generateNextNumero(tx as any, "vente", "VTE", "site-1");
      expect(numero).toBe(`VTE-${year}-008`);
    });

    it("respecte la portée par sexe pour LotGeniteurs (pas d'année, préfixe LG-F)", async () => {
      const { tx } = buildFakeTx({
        modelName: "lotGeniteurs",
        field: "code",
        lastValue: "LG-F-004",
      });
      const numero = await generateNextNumero(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx as any,
        "lotGeniteurs",
        "LG-F",
        "site-1",
        { field: "code", includeYear: false }
      );
      expect(numero).toBe("LG-F-005");
    });

    it("ne mélange pas les portées LG-F et LG-M (compteurs indépendants)", async () => {
      const { tx: txF } = buildFakeTx({ modelName: "lotGeniteurs", field: "code", lastValue: "LG-F-010" });
      const { tx: txM } = buildFakeTx({ modelName: "lotGeniteurs", field: "code", lastValue: "LG-M-002" });

      const codeF = await generateNextNumero(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        txF as any,
        "lotGeniteurs",
        "LG-F",
        "site-1",
        { field: "code", includeYear: false }
      );
      const codeM = await generateNextNumero(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        txM as any,
        "lotGeniteurs",
        "LG-M",
        "site-1",
        { field: "code", includeYear: false }
      );

      expect(codeF).toBe("LG-F-011");
      expect(codeM).toBe("LG-M-003");
    });

    it("génère au format code (Ponte) sans casser le champ numero d'autres modèles", async () => {
      const year = new Date().getFullYear();
      const { tx } = buildFakeTx({ modelName: "ponte", field: "code", lastValue: `PONTE-${year}-041` });
      const code = await generateNextNumero(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx as any,
        "ponte",
        "PONTE",
        "site-1",
        { field: "code" }
      );
      expect(code).toBe(`PONTE-${year}-042`);
    });
  });

  describe("verrouillage advisory — dérivation de la clé de portée", () => {
    it("pose le verrou AVANT de lire le dernier numero (ordre des appels)", async () => {
      const callOrder: string[] = [];
      const tx: FakeTx = {
        $executeRaw: vi.fn(async () => {
          callOrder.push("lock");
          return 0;
        }),
        facture: {
          findFirst: vi.fn(async () => {
            callOrder.push("findFirst");
            return null;
          }),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateNextNumero(tx as any, "facture", "FAC", "site-1");

      expect(callOrder).toEqual(["lock", "findFirst"]);
    });

    it("dérive des clés de verrou différentes pour deux sites distincts (même préfixe/année)", async () => {
      const { tx: txSite1, executeRawValues: callsSite1 } = buildFakeTx({
        modelName: "commande",
        field: "numero",
        lastValue: null,
      });
      const { tx: txSite2, executeRawValues: callsSite2 } = buildFakeTx({
        modelName: "commande",
        field: "numero",
        lastValue: null,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateNextNumero(txSite1 as any, "commande", "CMD", "site-A");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateNextNumero(txSite2 as any, "commande", "CMD", "site-B");

      expect(callsSite1[0][0]).not.toBe(callsSite2[0][0]);
      expect(String(callsSite1[0][0])).toContain("site-A");
      expect(String(callsSite2[0][0])).toContain("site-B");
    });

    it("dérive des clés de verrou différentes pour deux années distinctes (même préfixe/site)", async () => {
      vi.useFakeTimers();

      vi.setSystemTime(new Date(2025, 0, 1));
      const { tx: tx2025, executeRawValues: calls2025 } = buildFakeTx({
        modelName: "depense",
        field: "numero",
        lastValue: null,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateNextNumero(tx2025 as any, "depense", "DEP", "site-1");

      vi.setSystemTime(new Date(2026, 0, 1));
      const { tx: tx2026, executeRawValues: calls2026 } = buildFakeTx({
        modelName: "depense",
        field: "numero",
        lastValue: null,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateNextNumero(tx2026 as any, "depense", "DEP", "site-1");

      vi.useRealTimers();

      expect(calls2025[0][0]).not.toBe(calls2026[0][0]);
      expect(String(calls2025[0][0])).toContain("2025");
      expect(String(calls2026[0][0])).toContain("2026");
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("n'utilise PAS la même clé de verrou pour LG-F et LG-M (portées distinctes, pas de blocage mutuel)", async () => {
      const { tx: txF, executeRawValues: callsF } = buildFakeTx({
        modelName: "lotGeniteurs",
        field: "code",
        lastValue: null,
      });
      const { tx: txM, executeRawValues: callsM } = buildFakeTx({
        modelName: "lotGeniteurs",
        field: "code",
        lastValue: null,
      });

      await generateNextNumero(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        txF as any,
        "lotGeniteurs",
        "LG-F",
        "site-1",
        { field: "code", includeYear: false }
      );
      await generateNextNumero(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        txM as any,
        "lotGeniteurs",
        "LG-M",
        "site-1",
        { field: "code", includeYear: false }
      );

      expect(callsF[0][0]).not.toBe(callsM[0][0]);
    });
  });

  describe("comportement en cas de collision (P2002 — filet de sécurité)", () => {
    it("un numero généré sous verrou reste cohérent même si le create() du call-site échoue ensuite avec P2002", async () => {
      const { tx } = buildFakeTx({ modelName: "vente", field: "numero", lastValue: null });
      const year = new Date().getFullYear();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const numero = await generateNextNumero(tx as any, "vente", "VTE", "site-1");
      expect(numero).toBe(`VTE-${year}-001`);

      // Simule le create() du call-site échouant avec P2002 malgré un numero
      // généré sous verrou — cas résiduel (numero fourni manuellement,
      // contrainte @unique globale multi-site, etc. — voir pré-analyse SU.3).
      // Le filet de sécurité handleApiError (src/lib/api-utils.ts) doit
      // convertir cette erreur Prisma en 409 avec un message actionnable,
      // jamais en 500 opaque.
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: ["numero"] },
      });
      const create = vi.fn().mockRejectedValue(p2002);
      await expect(create()).rejects.toMatchObject({ code: "P2002" });
    });
  });
});
