/**
 * Garde-fou structurel (Sprint PX, correction non bloquante n°2 — review
 * Sprint PX) : empêche mécaniquement l'ajout d'un futur `<Image>` non
 * pré-validé dans un nouveau template PDF de `src/lib/export/`.
 *
 * Contexte (ADR-047) : le bug d'origine venait d'une image base64 injectée
 * directement dans un composant `<Image>` de `@react-pdf/renderer`, sans
 * jamais passer par un décodeur de validation — `@react-pdf/png-js` (lib
 * vendue par `@react-pdf/renderer`) plante alors sur un flux IDAT corrompu
 * (throw dans un callback async Node, cf. ADR-047 §Contexte). La protection
 * primaire (ADR-047 D3-a) est que TOUTE image passée à `<Image src={...}>`
 * ait d'abord transité par `decodeImageDataUrl()` (ou un helper qui l'appelle,
 * ex. `safeSignatureImage` dans `pdf-bon-livraison.tsx`). Rien n'empêche
 * aujourd'hui mécaniquement un développeur d'oublier cette étape dans un
 * nouveau template — cette protection reposait uniquement sur la discipline.
 *
 * Convention vérifiée par ce test (volontairement simple pour rester fiable,
 * plutôt qu'une analyse textuelle fragile de chaque JSX `<Image>`) :
 *
 *   Tout fichier `src/lib/export/*.tsx` qui IMPORTE `Image` depuis
 *   `@react-pdf/renderer` DOIT AUSSI importer `decodeImageDataUrl` depuis
 *   `@/lib/validation/image-decode` (directement, ou transitivement via un
 *   helper qui l'appelle — dans ce dernier cas le fichier doit quand même
 *   importer `decodeImageDataUrl` lui-même : la validation ne doit jamais se
 *   trouver "quelque part en amont dans un autre module" sans que le
 *   template lui-même en dépende explicitement).
 *
 * Cette convention "import co-présent" est robuste au reformatage, aux sauts
 * de ligne dans le JSX, et aux attributs multi-lignes — elle ne dépend pas
 * de la syntaxe exacte de la balise `<Image .../>`, seulement de la présence
 * des deux imports au niveau module. C'est un choix délibéré : une détection
 * par regex sur le JSX (ex. inspecter la prop `src` de chaque `<Image>`)
 * serait plus précise en théorie mais beaucoup plus fragile en pratique.
 *
 * LIMITE ASSUMÉE (delta-review Sprint PX, review-sprint-PX.md Delta 2) : ce
 * garde vérifie uniquement la CO-PRÉSENCE des deux imports au niveau
 * module — pas que chaque `<Image>` du JSX est effectivement passée par
 * `decodeImageDataUrl()` avant son rendu. Un import de `decodeImageDataUrl`
 * techniquement inutilisé (mort ou orphelin) suffirait à satisfaire ce
 * garde. Ce compromis est délibéré (cf. paragraphe ci-dessus sur la
 * fragilité d'une regex JSX) mais doit être connu de qui relit ce test.
 *
 * Si ce test échoue : un template dans `src/lib/export/*.tsx` utilise
 * `<Image>` de `@react-pdf/renderer` sans importer `decodeImageDataUrl`.
 * Toute image base64 injectée dans un `<Image>` DOIT d'abord être passée à
 * `decodeImageDataUrl()` (voir `safeSignatureImage()` dans
 * `pdf-bon-livraison.tsx` pour un exemple de wrapper), car `@react-pdf/png-js`
 * peut planter le process Node entier sur un PNG RGBA à IDAT corrompu — voir
 * ADR-047 (docs/decisions/ADR-047-robustesse-rendu-pdf.md) pour l'analyse
 * complète du bug d'origine et le détail de cette exigence.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const EXPORT_DIR = path.resolve(__dirname, "../../lib/export");

function readExportTsxFiles(): { file: string; content: string }[] {
  return fs
    .readdirSync(EXPORT_DIR)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => ({
      file: f,
      content: fs.readFileSync(path.join(EXPORT_DIR, f), "utf-8"),
    }));
}

/**
 * Détecte un import nommé `name` depuis le module `from` — tolérant au
 * multi-ligne, aux alias, et à l'ordre des imports nommés dans l'accolade.
 */
function importsNamedFrom(content: string, name: string, from: string): boolean {
  const importBlockPattern = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*["']${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
    "gs"
  );
  let match: RegExpExecArray | null;
  while ((match = importBlockPattern.exec(content)) !== null) {
    const names = match[1]
      .split(",")
      .map((n) => n.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    if (names.includes(name)) return true;
  }
  return false;
}

describe("Garde-fou : <Image> dans un template PDF doit importer decodeImageDataUrl (ADR-047)", () => {
  const files = readExportTsxFiles();

  it("trouve au moins un fichier .tsx dans src/lib/export (le test n'est pas silencieusement no-op)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.file, f.content] as const))(
    "%s : si `Image` est importé de @react-pdf/renderer, decodeImageDataUrl doit aussi être importé",
    (file, content) => {
      const usesImageComponent = importsNamedFrom(content, "Image", "@react-pdf/renderer");
      if (!usesImageComponent) {
        // Ce template n'utilise pas <Image> — hors périmètre de la garde.
        return;
      }

      const importsDecoder = importsNamedFrom(
        content,
        "decodeImageDataUrl",
        "@/lib/validation/image-decode"
      );

      expect(
        importsDecoder,
        `\n[Garde ADR-047] "${file}" importe \`Image\` de "@react-pdf/renderer" mais n'importe PAS ` +
          `\`decodeImageDataUrl\` depuis "@/lib/validation/image-decode".\n\n` +
          `Pourquoi c'est bloquant : @react-pdf/png-js (dépendance vendue de @react-pdf/renderer) ` +
          `plante le process Node entier sur un PNG RGBA dont le flux IDAT est corrompu (throw dans ` +
          `un callback asynchrone — aucune promesse à rejeter, aucun try/catch applicatif ne l'intercepte). ` +
          `C'est exactement le bug corrigé par le Sprint PX (voir ADR-047, ` +
          `docs/decisions/ADR-047-robustesse-rendu-pdf.md).\n\n` +
          `Comment corriger : avant d'injecter une donnée base64 dans <Image src={...}>, valider ` +
          `l'image avec decodeImageDataUrl() (voir l'exemple safeSignatureImage() dans pdf-bon-livraison.tsx) ` +
          `et remplacer par un placeholder si le résultat est { ok: false }.`
      ).toBe(true);
    }
  );
});
