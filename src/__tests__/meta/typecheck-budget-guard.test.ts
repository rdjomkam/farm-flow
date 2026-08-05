/**
 * Test de non-régression du garde-fou `scripts/typecheck-budget.sh`
 * (sprint de résorption des réserves du module Prévisions, réserve R6).
 *
 * Ne relance JAMAIS `npx tsc --noEmit` réellement (trop lent pour un test
 * unitaire, ~1-2 minutes) : la vraie commande `tsc` est remplacée par un
 * faux exécutable `npx` (injecté en tête de `PATH`) qui produit un nombre
 * contrôlé de lignes `error TS` sur stdout et sort en code non-nul — comme
 * le fait réellement `tsc --noEmit` dès qu'il y a au moins une erreur.
 * Cela exerce la logique RÉELLE du script (lecture du seuil, comptage
 * `grep -c "error TS"`, comparaison, code de sortie, message) sans jamais
 * dépendre du typage réel du dépôt à l'instant du test — un test qui
 * dépendrait du compte réel casserait à chaque variation légitime du
 * seuil.
 *
 * Trois scénarios prouvés :
 *  1. compte mesuré > seuil déclaré  → le script échoue (code 1), message
 *     de régression avec le delta exact ;
 *  2. compte mesuré < seuil déclaré  → le script échoue aussi (code 1),
 *     message invitant à abaisser le seuil ;
 *  3. compte mesuré == seuil déclaré → le script réussit (code 0).
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const REAL_SCRIPT = path.join(REPO_ROOT, "scripts", "typecheck-budget.sh");

/**
 * Construit un faux `npx` exécutable qui, quels que soient ses arguments
 * (`tsc --noEmit`), imprime `errorCount` lignes contenant `error TS` sur
 * stdout puis sort avec `exitCode` — reproduisant le comportement réel de
 * `tsc --noEmit` (sortie non-nulle dès qu'il y a des erreurs) sans jamais
 * l'exécuter.
 */
function makeFakeNpx(dir: string, errorCount: number): void {
  const lines = Array.from(
    { length: errorCount },
    (_, i) => `src/fake/file-${i}.ts(1,1): error TS9999: erreur simulée.`
  ).join("\n");
  const exitCode = errorCount > 0 ? 1 : 0;
  const script = `#!/usr/bin/env bash\ncat <<'EOF'\n${lines}\nEOF\nexit ${exitCode}\n`;
  const fakeNpxPath = path.join(dir, "npx");
  fs.writeFileSync(fakeNpxPath, script, { mode: 0o755 });
}

interface RunResult {
  exitCode: number;
  stdout: string;
}

function runGuard(errorCount: number, threshold: number): RunResult {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "typecheck-budget-guard-"));
  try {
    makeFakeNpx(tmpDir, errorCount);
    const budgetFile = path.join(tmpDir, "budget.txt");
    fs.writeFileSync(budgetFile, `${threshold}\n`);

    const fakePathPrefix = `${tmpDir}:${process.env.PATH ?? ""}`;
    try {
      const stdout = execFileSync("bash", [REAL_SCRIPT, budgetFile], {
        cwd: REPO_ROOT,
        env: { ...process.env, PATH: fakePathPrefix },
        encoding: "utf-8",
      });
      return { exitCode: 0, stdout };
    } catch (err) {
      const execErr = err as { status: number | null; stdout?: string; stderr?: string };
      return {
        exitCode: execErr.status ?? 1,
        stdout: (execErr.stdout ?? "") + (execErr.stderr ?? ""),
      };
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("Garde-fou anti-récidive — scripts/typecheck-budget.sh", () => {
  it("échoue (code 1) quand le compte mesuré dépasse le seuil déclaré", () => {
    const result = runGuard(200, 178);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("RÉGRESSION");
    expect(result.stdout).toContain("Seuil attendu  : 178");
    expect(result.stdout).toContain("Compte mesuré  : 200");
    expect(result.stdout).toContain("+22");
  });

  it("échoue (code 1) quand le compte mesuré est inférieur au seuil déclaré (seuil à abaisser)", () => {
    const result = runGuard(150, 178);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Seuil attendu  : 178");
    expect(result.stdout).toContain("Compte mesuré  : 150");
    expect(result.stdout).toContain("-28");
    expect(result.stdout.toLowerCase()).toContain("abaisse");
  });

  it("réussit (code 0) quand le compte mesuré est exactement égal au seuil déclaré", () => {
    const result = runGuard(178, 178);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Compte mesuré (178) == seuil déclaré (178)");
  });

  it("réussit (code 0) même quand le compte mesuré est 0 (cas limite : dette entièrement résorbée)", () => {
    const result = runGuard(0, 0);
    expect(result.exitCode).toBe(0);
  });

  it("le seuil réel versionné (typecheck-budget.txt) est un entier positif lisible", () => {
    const budgetFile = path.join(REPO_ROOT, "typecheck-budget.txt");
    const content = fs.readFileSync(budgetFile, "utf-8").trim();
    expect(content).toMatch(/^\d+$/);
    expect(Number(content)).toBeGreaterThanOrEqual(0);
  });
});
