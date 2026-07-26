/**
 * Garde-fou de non-régression (Sprint SU, story SU.11 — ERR-104) : empêche
 * qu'un formatage de NOMBRE via `toLocaleString("fr-FR")` /
 * `Intl.NumberFormat("fr-FR")` ne réintroduise un caractère hors table
 * WinAnsi/Windows-1252 (typiquement U+202F, l'espace insécable étroite
 * utilisée comme séparateur de milliers par l'ICU de Node 22) dans un
 * template PDF `@react-pdf/renderer` sans police custom enregistrée.
 *
 * Contexte (voir docs/knowledge/ERRORS-AND-FIXES.md, ERR-104) : `(1234).
 * toLocaleString("fr-FR")` produit `"1 234"` où le séparateur est U+202F —
 * absent de la table WinAnsi utilisée par la police Helvetica standard
 * (`AFMFont` de `@react-pdf/pdfkit`). Un caractère hors table ne lève PAS
 * d'exception : il retombe silencieusement sur `.notdef` (glyphe manquant,
 * largeur 0). Résultat : pas de crash, un séparateur de milliers invisible
 * dans le PDF — bug visuel silencieux, indétectable sans extraction de texte
 * réelle du PDF (un test qui mocke `@react-pdf/renderer` ne l'attraperait
 * jamais, cf. ERR-103 leçon (e)).
 *
 * Ce garde a DEUX volets, dans l'esprit de
 * `pdf-image-predecode-guard.test.ts` :
 *
 * 1. Garde STRUCTUREL (convention "import/usage") : aucun fichier de
 *    `src/lib/export/**` ne doit appeler `.toLocaleString(` sur un nombre
 *    (seul `.toLocaleDateString(` — safe, vérifié empiriquement ci-dessous —
 *    est autorisé). Le formatage de nombres doit passer par
 *    `formatNumPDF`/`formatDecimalPDF` de `./pdf-format-utils`.
 * 2. Garde RUNTIME : les sorties réelles de `formatNumPDF`/`formatDecimalPDF`,
 *    sur une plage de valeurs incluant la zone à risque [1000, 10000)
 *    signalée par la pré-analyse Sprint SU, ne contiennent aucun caractère
 *    hors WinAnsi.
 *
 * Si le volet 1 échoue : un fichier de `src/lib/export/` utilise
 * `.toLocaleString(` pour formater un nombre. Remplacer par
 * `formatNumPDF(n)` (entier) ou `formatDecimalPDF(n, maxFractionDigits)`
 * (décimal) importés depuis `@/lib/export/pdf-format-utils`.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { formatNumPDF, formatDecimalPDF, NON_WINANSI_SEPARATORS } from "@/lib/export/pdf-format-utils";

const EXPORT_DIR = path.resolve(__dirname, "../../lib/export");

/**
 * Retire les commentaires JSDoc/bloc (`/* ... *\/`) et de ligne (`// ...`) du
 * code source avant l'analyse structurelle — sans cela, les commentaires qui
 * DOCUMENTENT ce garde (ex. ce fichier lui-même, ou les docstrings de
 * `pdf-format-utils.ts`) contiennent la sous-chaîne `.toLocaleString(` à
 * titre d'exemple et déclencheraient un faux positif.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function readExportSourceFiles(): { file: string; content: string }[] {
  return fs
    .readdirSync(EXPORT_DIR)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => ({
      file: f,
      content: stripComments(fs.readFileSync(path.join(EXPORT_DIR, f), "utf-8")),
    }));
}

/** Any character outside the printable WinAnsi/Windows-1252 range (0x20-0x7E, plus 0xA0-0xFF minus a few gaps is close enough for our purpose: we only care about catching the known offending separators). */
function containsNonWinAnsiSeparator(s: string): string | null {
  for (const ch of NON_WINANSI_SEPARATORS) {
    if (s.includes(ch)) return ch;
  }
  return null;
}

describe("Garde-fou : aucun toLocaleString('fr-FR') sur un nombre dans un template PDF (ERR-104)", () => {
  const files = readExportSourceFiles();

  it("trouve au moins un fichier dans src/lib/export (le test n'est pas silencieusement no-op)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.file, f.content] as const))(
    "%s : n'appelle pas .toLocaleString( (seul .toLocaleDateString( est autorisé pour les dates)",
    (file, content) => {
      // .toLocaleDateString( ne contient jamais la sous-chaîne .toLocaleString( car
      // "Date" est inséré au milieu de "toLocale" et "String" — pas de faux positif.
      const matches = content.match(/\.toLocaleString\(/g);
      expect(
        matches,
        `\n[Garde ERR-104] "${file}" appelle .toLocaleString( pour formater un nombre. ` +
          `Sur Node 22 (ICU courant), toLocaleString("fr-FR") insère U+202F (narrow no-break ` +
          `space) comme séparateur de milliers — caractère absent de la table WinAnsi utilisée ` +
          `par les polices standard @react-pdf/pdfkit (Helvetica, pas de Font.register). ` +
          `Remplacer par formatNumPDF(n) ou formatDecimalPDF(n, maxFractionDigits) ` +
          `importés depuis "@/lib/export/pdf-format-utils". ` +
          `(.toLocaleDateString( reste autorisé : vérifié empiriquement sans risque WinAnsi.)`
      ).toBeNull();
    }
  );
});

describe("Garde-fou : formatNumPDF / formatDecimalPDF ne produisent jamais de caractère hors WinAnsi (ERR-104)", () => {
  // Couvre explicitement la zone à risque [1000, 10000) FCFA signalée par la
  // pré-analyse Sprint SU (formatK ne passait pas par le formatage "k" au-delà
  // de 10 000), ainsi que des valeurs plus grandes, décimales, négatives et nulles.
  const sampleValues = [
    0, 1, 42, 999, 1000, 1234, 1999, 4567, 9999, 10000, 12345, 999999, 1234567,
    -1234, -9999,
  ];

  it.each(sampleValues)("formatNumPDF(%d) ne contient aucun séparateur hors WinAnsi", (n) => {
    const out = formatNumPDF(n);
    expect(containsNonWinAnsiSeparator(out)).toBeNull();
  });

  it.each(sampleValues)("formatDecimalPDF(%d, 1) ne contient aucun séparateur hors WinAnsi", (n) => {
    const out = formatDecimalPDF(n, 1);
    expect(containsNonWinAnsiSeparator(out)).toBeNull();
  });

  it.each([0, 1.5, 1234.56, 9999.99, 12345.678, -1234.5])(
    "formatDecimalPDF(%d, 2) ne contient aucun séparateur hors WinAnsi",
    (n) => {
      const out = formatDecimalPDF(n, 2);
      expect(containsNonWinAnsiSeparator(out)).toBeNull();
    }
  );

  it("formatNumPDF garde un comportement fonctionnel identique à l'ancien toLocaleString (espace ASCII simple)", () => {
    expect(formatNumPDF(1234)).toBe("1 234");
    expect(formatNumPDF(1234)).toMatch(/^1\x20234$/); // U+0020 explicite, pas U+202F
  });

  it("formatDecimalPDF garde un comportement fonctionnel identique à l'ancien toLocaleString (virgule décimale ASCII)", () => {
    expect(formatDecimalPDF(1234.5, 1)).toBe("1 234,5");
    expect(formatDecimalPDF(1234, 2)).toBe("1 234");
  });
});
