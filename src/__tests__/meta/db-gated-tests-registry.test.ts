/**
 * Test méta — registre des tests DB-gated (ADR-052 §3.4).
 *
 * Grep le dépôt (hors node_modules, .next, .git, etc.) pour toute occurrence
 * de `describe.runIf(`, `describe.skipIf(`, `it.skip(`, `test.skip(`,
 * `describe.skip(`, `this.skip(` — et compare l'ensemble trouvé à
 * `src/test/db-gated-allowlist.ts`. `it.todo`/`test.todo` sont explicitement
 * hors périmètre (backlog de specs non implémentées, pas du DB-gating — cf.
 * `density-calculs.test.ts`, `density-integration.test.ts`).
 *
 * Deux directions de non-régression, comme spécifié par l'ADR :
 * - une occurrence trouvée mais non allowlistée échoue (empêche l'ajout non
 *   déclaré d'un nouveau gate) ;
 * - une entrée allowlistée mais introuvable dans le dépôt échoue aussi
 *   (empêche l'allowlist de pourrir avec des entrées obsolètes qui
 *   masqueraient un vrai audit).
 *
 * Implémentation en Node pur (`fs`/`path`), pas `grep`/`rg` du shell : le
 * comportement doit être garanti identique sur tout runner (y compris un
 * runner GitHub Actions minimal), sans dépendre d'un outil externe.
 *
 * Attention à l'auto-détection : ce fichier et `src/test/db-gated-allowlist.ts`
 * contiennent eux-mêmes les motifs recherchés (sous forme de chaînes de
 * documentation/de données, pas d'appels réels) — ils sont donc explicitement
 * exclus du périmètre du scan (voir SELF_EXCLUDED_FILES), et les regex de
 * détection sont construites par concaténation pour ne jamais apparaître,
 * dans CE fichier, comme un appel littéral matchant son propre motif.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { DB_GATED_ALLOWLIST } from "@/test/db-gated-allowlist";

const REPO_ROOT = path.resolve(__dirname, "../../..");

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  "test-results",
]);

// Fichiers volontairement exclus du scan : ils PARLENT des motifs surveillés
// (chaînes littérales de documentation/données) sans en être des occurrences
// réelles de gating.
const SELF_EXCLUDED_FILES = new Set([
  "src/test/db-gated-allowlist.ts",
  "src/__tests__/meta/db-gated-tests-registry.test.ts",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

// Construits par concaténation de fragments pour ne jamais apparaître, dans
// LE TEXTE SOURCE de ce fichier, comme une occurrence littérale du motif
// qu'ils recherchent (voir avertissement d'en-tête).
const GATE_PATTERNS: RegExp[] = [
  new RegExp("\\b" + "describe" + "\\." + "runIf" + "\\("),
  new RegExp("\\b" + "describe" + "\\." + "skipIf" + "\\("),
  new RegExp("\\b" + "it" + "\\." + "skip" + "\\("),
  new RegExp("\\b" + "test" + "\\." + "skip" + "\\("),
  new RegExp("\\b" + "describe" + "\\." + "skip" + "\\("),
  new RegExp("\\b" + "this" + "\\." + "skip" + "\\("),
];

interface Occurrence {
  file: string;
  lineContent: string;
  lineNumber: number;
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

function findOccurrences(): Occurrence[] {
  const files = listFilesRecursive(REPO_ROOT);
  const occurrences: Occurrence[] = [];

  for (const absFile of files) {
    const relFile = toRelativePosix(absFile);
    if (SELF_EXCLUDED_FILES.has(relFile)) continue;

    const content = fs.readFileSync(absFile, "utf-8");
    const lines = content.split("\n");
    lines.forEach((rawLine, idx) => {
      const line = rawLine.trim();
      // Ignore les lignes de commentaire (JSDoc `*`, `//`) : plusieurs
      // fichiers DOCUMENTENT ces motifs (ex. en-tête expliquant pourquoi un
      // fichier est DB-gated, citant `describe.runIf(...)` entre backticks)
      // sans en être une occurrence réelle de gating. Un grep naïf sur le
      // texte brut confondrait la documentation avec le code.
      if (line.startsWith("*") || line.startsWith("//")) return;
      if (GATE_PATTERNS.some((re) => re.test(line))) {
        occurrences.push({ file: relFile, lineContent: line, lineNumber: idx + 1 });
      }
    });
  }

  return occurrences;
}

function occurrenceKey(file: string, linePattern: string): string {
  return `${file}::${linePattern}`;
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

describe("Meta — registre des tests DB-gated (ADR-052)", () => {
  it("toute occurrence de describe.runIf/skipIf/*.skip trouvée dans le dépôt est déclarée dans l'allowlist", () => {
    const occurrences = findOccurrences();
    const occurrenceCounts = countBy(occurrences, (o) => occurrenceKey(o.file, o.lineContent));
    const allowlistCounts = countBy(DB_GATED_ALLOWLIST, (e) =>
      occurrenceKey(e.file, e.linePattern)
    );

    const unauthorized: string[] = [];
    for (const [key, count] of occurrenceCounts) {
      const allowedCount = allowlistCounts.get(key) ?? 0;
      if (count > allowedCount) {
        unauthorized.push(`${key} (trouvé ${count}x dans le dépôt, autorisé ${allowedCount}x)`);
      }
    }

    expect(
      unauthorized,
      "Occurrence(s) de gate (describe.runIf/skipIf/it.skip/test.skip/describe.skip/this.skip) " +
        "non déclarée(s) dans src/test/db-gated-allowlist.ts. Un test ne doit jamais être rendu " +
        "conditionnel/skippable sans être enregistré avec une justification substantielle " +
        "(voir ADR-052 §3.4). Préférez un mock si le test ne prouve pas un comportement réel " +
        "d'une ressource externe.\n\n" +
        unauthorized.join("\n")
    ).toEqual([]);
  });

  it("toute entrée de l'allowlist correspond à une occurrence réellement présente dans le dépôt", () => {
    const occurrences = findOccurrences();
    const occurrenceCounts = countBy(occurrences, (o) => occurrenceKey(o.file, o.lineContent));
    const allowlistCounts = countBy(DB_GATED_ALLOWLIST, (e) =>
      occurrenceKey(e.file, e.linePattern)
    );

    const obsolete: string[] = [];
    for (const [key, count] of allowlistCounts) {
      const foundCount = occurrenceCounts.get(key) ?? 0;
      if (count > foundCount) {
        obsolete.push(`${key} (${count} entrée(s) déclarée(s), ${foundCount} trouvée(s) dans le dépôt)`);
      }
    }

    expect(
      obsolete,
      "Entrée(s) de src/test/db-gated-allowlist.ts introuvable(s) dans le dépôt — " +
        "l'allowlist a pourri (entrée obsolète), à retirer.\n\n" +
        obsolete.join("\n")
    ).toEqual([]);
  });

  it("chaque entrée de l'allowlist porte une justification substantielle (> 20 caractères) et une référence ADR", () => {
    const invalid = DB_GATED_ALLOWLIST.filter(
      (entry) => entry.justification.trim().length <= 20 || entry.adr.trim().length === 0
    );

    expect(invalid, JSON.stringify(invalid, null, 2)).toEqual([]);
  });

  it("chaque fichier avec une occurrence allowlistée de describe.runIf importe requireDatabaseUrl depuis @/test/require-database-url", () => {
    const runIfEntries = DB_GATED_ALLOWLIST.filter((entry) =>
      entry.linePattern.includes("runIf")
    );
    const filesToCheck = Array.from(new Set(runIfEntries.map((entry) => entry.file)));

    const missingImport: string[] = [];
    for (const relFile of filesToCheck) {
      const absFile = path.join(REPO_ROOT, relFile);
      const content = fs.readFileSync(absFile, "utf-8");
      const importsHelper =
        /from\s+["']@\/test\/require-database-url["']/.test(content) &&
        content.includes("requireDatabaseUrl");
      if (!importsHelper) {
        missingImport.push(relFile);
      }
    }

    expect(missingImport).toEqual([]);
  });
});
