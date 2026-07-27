/**
 * Test de non-régression du garde CI lui-même (ADR-052 §5.2, jamais écrit
 * avant ce sprint — voir docs/bugs H1).
 *
 * Ce que ce fichier protège : `src/test/ci-db-guard.setup.ts` (garde global,
 * exécuté par `test.setupFiles`) et `src/test/require-database-url.ts`
 * (helper partagé) sont le socle de toute la garantie « un test d'intégration
 * DB-gated ne peut plus skipper invisiblement en CI » (ADR-052). Sans un test
 * dédié, quelqu'un peut inverser une condition ou neutraliser le `throw` sans
 * rien casser d'apparent — la suite resterait verte en ayant perdu la
 * garantie. C'est exactement le motif du sprint CI, reproduit sur son propre
 * outil.
 *
 * Portée volontairement restreinte à une vérification unitaire pure : aucune
 * connexion réseau, aucune dépendance à une vraie base Postgres. Ce fichier
 * doit tourner partout, y compris sans DATABASE_URL et sans Docker — sinon il
 * deviendrait lui-même un test invisible (ERR-116). Il n'est donc PAS ajouté
 * à `db-gated-allowlist.ts` : il ne contient aucun `describe.runIf`/`*.skip`.
 *
 * Manipuler `process.env` est une source classique de fuite entre tests :
 * l'état initial de CI et DATABASE_URL est restauré dans `afterEach`, et les
 * modules sont réinitialisés (`vi.resetModules()`) pour que chaque import
 * dynamique de `ci-db-guard.setup.ts` réévalue son code de niveau supérieur
 * avec l'environnement du test courant (ce fichier a un effet de bord à
 * l'import, il ne peut pas être testé par un simple appel de fonction).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { requireDatabaseUrl } from "@/test/require-database-url";

const ORIGINAL_CI = process.env.CI;
const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

function setEnv(ci: string | undefined, databaseUrl: string | undefined) {
  if (ci === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = ci;
  }
  if (databaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = databaseUrl;
  }
}

/**
 * Importe une instance fraîche de `ci-db-guard.setup.ts` (module à effet de
 * bord au chargement) et rapporte si l'import a levé une exception, sans
 * jamais laisser une exception non attrapée remonter et faire échouer le
 * test lui-même par accident.
 */
async function importGuardFresh(): Promise<{ threw: boolean; error: unknown }> {
  vi.resetModules();
  try {
    await import("@/test/ci-db-guard.setup");
    return { threw: false, error: undefined };
  } catch (error) {
    return { threw: true, error };
  }
}

afterEach(() => {
  setEnv(ORIGINAL_CI, ORIGINAL_DATABASE_URL);
  vi.resetModules();
});

describe("Garde CI — matrice complète CI x DATABASE_URL (ADR-052 §3.1, §3.2)", () => {
  it("CI défini + DATABASE_URL absente → échec dur (le garde lance)", async () => {
    setEnv("1", undefined);

    const { threw, error } = await importGuardFresh();
    expect(threw).toBe(true);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("DATABASE_URL");

    // Défense en profondeur : le helper partagé lève aussi, indépendamment
    // du garde global (ADR-052 §3.2 — "si ci-db-guard.setup.ts était un jour
    // retiré de setupFiles par erreur, ce helper resterait le dernier filet").
    expect(() => requireDatabaseUrl()).toThrow();
  });

  it("CI défini + DATABASE_URL présente → passe, tests DB-gated exécutés", async () => {
    // Le helper ne se connecte jamais à la base (ADR-052 §3.2) : il vérifie
    // uniquement la présence de la variable. Une valeur non vide, sans forme
    // de chaîne de connexion avec identifiants, suffit et évite tout motif
    // que gitleaks pourrait confondre avec un vrai secret (R11).
    setEnv("1", "db-url-placeholder-non-empty");

    const { threw } = await importGuardFresh();
    expect(threw).toBe(false);
    expect(requireDatabaseUrl()).toBe(true);
  });

  it("CI non défini + DATABASE_URL absente → skip toléré (requireDatabaseUrl() renvoie faux)", async () => {
    setEnv(undefined, undefined);

    const { threw } = await importGuardFresh();
    expect(threw).toBe(false);
    expect(requireDatabaseUrl()).toBe(false);
  });

  it("CI non défini + DATABASE_URL présente → passe, tests exécutés", async () => {
    setEnv(undefined, "db-url-placeholder-non-empty");

    const { threw } = await importGuardFresh();
    expect(threw).toBe(false);
    expect(requireDatabaseUrl()).toBe(true);
  });
});

describe("Garde CI — le message d'erreur reste informatif (ADR-052)", () => {
  it("le message du garde global dit QUOI faire, pas seulement que c'est cassé", async () => {
    setEnv("1", undefined);

    const { error } = await importGuardFresh();
    const message = (error as Error).message;

    // Diagnostic : quelle variable manque et pourquoi c'est bloquant.
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("CI");
    expect(message.toLowerCase()).toContain("db-gated");

    // Prescription : où corriger — un futur développeur ne doit pas deviner.
    expect(message).toContain(".github/workflows/ci.yml");
    expect(message).toContain("ADR-052");
  });

  it("le message du helper partagé pointe vers le garde global à restaurer", () => {
    setEnv("1", undefined);

    let thrown: Error | undefined;
    try {
      requireDatabaseUrl();
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown!.message).toContain("DATABASE_URL");
    expect(thrown!.message).toContain("ci-db-guard.setup.ts");
  });
});

describe("Garde CI — non-effet hors des cas ciblés", () => {
  it("n'a aucun effet de bord observable hors CI, quelle que soit DATABASE_URL", async () => {
    setEnv(undefined, undefined);
    let result = await importGuardFresh();
    expect(result.threw).toBe(false);

    setEnv(undefined, "db-url-placeholder-non-empty");
    result = await importGuardFresh();
    expect(result.threw).toBe(false);
  });
});
