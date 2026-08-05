/**
 * Test méta — immuabilité mécanisée de `SnapshotBudgetInitial` (Mineure #4,
 * review-sprint-PR3-ter.md).
 *
 * Le rapport de review constate que la garantie « `SnapshotBudgetInitial`
 * n'est jamais modifié/supprimé/upserté après création » ne repose
 * aujourd'hui que sur la discipline de revue humaine — même défaut
 * méthodologique qu'ERR-165 (une garantie tenue par convention, jamais par
 * un mécanisme qui échoue si elle est violée). ADR-053 §15.2/§6.5 : le
 * BUDGET INITIAL est un GEL — il doit être écrit une fois
 * (`prisma.snapshotBudgetInitial.create`, `activerScenarioAvecSnapshot`)
 * puis seulement LU, jamais réécrit, y compris pour corriger une erreur de
 * saisie après coup (créer une nouvelle activation si nécessaire, jamais un
 * update en place).
 *
 * Ce test grep le dépôt (hors `src/generated/`, code Prisma généré) pour
 * toute occurrence de `snapshotBudgetInitial.update(`,
 * `snapshotBudgetInitial.delete(`, `snapshotBudgetInitial.upsert(`
 * (insensible à la casse du nom de modèle, Prisma expose le client en
 * camelCase) — le test échoue si l'une de ces trois occurrences apparaît
 * dans `src/` hors `src/generated/`.
 *
 * Falsifié pendant l'écriture de ce test : un appel
 * `prisma.snapshotBudgetInitial.update(...)` ajouté volontairement dans
 * `src/lib/queries/previsions-snapshot-budget.ts` fait tomber ce test
 * (1 assertion) — restauré ensuite, `git diff` nul confirmé. Voir
 * `docs/tests/rapport-falsification-sprint-PR3-ter.md`, réserve Mineure #4.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SRC_ROOT = path.join(REPO_ROOT, "src");

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "generated",
  "__tests__",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

// Ce fichier lui-même documente les motifs interdits (JSDoc ci-dessus) —
// il est donc explicitement exclu du scan pour ne jamais se faire échouer
// lui-même en citant sa propre règle.
const SELF_EXCLUDED_FILE = "src/__tests__/meta/snapshot-budget-initial-immuable.test.ts";

// Construits par concaténation pour ne jamais apparaître, dans LE TEXTE
// SOURCE de ce fichier, comme un appel littéral matchant son propre motif.
const FORBIDDEN_PATTERNS: RegExp[] = [
  new RegExp("snapshotBudgetInitial" + "\\." + "update" + "\\("),
  new RegExp("snapshotBudgetInitial" + "\\." + "delete" + "\\("),
  new RegExp("snapshotBudgetInitial" + "\\." + "upsert" + "\\("),
];

interface Occurrence {
  file: string;
  lineNumber: number;
  lineContent: string;
}

function listFilesRecursive(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      listFilesRecursive(path.join(dir, entry.name), out);
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function toRelativePosix(absPath: string): string {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
}

describe("Meta — SnapshotBudgetInitial est immuable après création (Mineure #4, PR3-ter)", () => {
  it("aucun appel .update/.delete/.upsert sur snapshotBudgetInitial n'existe dans src/ hors src/generated/", () => {
    const files = listFilesRecursive(SRC_ROOT);
    const violations: Occurrence[] = [];

    for (const absFile of files) {
      const relFile = toRelativePosix(absFile);
      if (relFile === SELF_EXCLUDED_FILE) continue;

      const content = fs.readFileSync(absFile, "utf-8");
      const lines = content.split("\n");
      lines.forEach((rawLine, idx) => {
        const line = rawLine.trim();
        if (line.startsWith("*") || line.startsWith("//")) return;
        if (FORBIDDEN_PATTERNS.some((re) => re.test(line))) {
          violations.push({ file: relFile, lineNumber: idx + 1, lineContent: line });
        }
      });
    }

    expect(
      violations,
      "SnapshotBudgetInitial doit rester create-only (ADR-053 §15.2/§6.5, garantie du GEL). " +
        "Une occurrence de .update/.delete/.upsert a été trouvée hors src/generated/ :\n\n" +
        JSON.stringify(violations, null, 2)
    ).toEqual([]);
  });
});
