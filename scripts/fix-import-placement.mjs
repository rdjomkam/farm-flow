/**
 * Fix script: move misplaced `import { apiError } from "@/lib/api-utils";`
 * that was inserted inside a multi-line import block.
 *
 * Pattern to fix:
 *   import {
 *   import { apiError } from "@/lib/api-utils";
 *     foo,
 *   } from "somewhere";
 *
 * Should become:
 *   import {
 *     foo,
 *   } from "somewhere";
 *   import { apiError } from "@/lib/api-utils";
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'src', 'app', 'api');

function findRouteFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findRouteFiles(fullPath));
    else if (entry.name === 'route.ts') results.push(fullPath);
  }
  return results;
}

const API_UTILS_IMPORT = 'import { apiError } from "@/lib/api-utils";';

function fixFile(content) {
  if (!content.includes(API_UTILS_IMPORT)) return { newContent: content, changed: false };

  const lines = content.split('\n');
  let changed = false;

  // Find lines where API_UTILS_IMPORT is inside a multi-line import block
  // A multi-line import block is: line N ends with `import {` or starts with `import {`
  // and the previous non-empty line doesn't end with `;`

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === API_UTILS_IMPORT) {
      // Check if previous line starts or opens a multi-line import (line ends without ;)
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      const isInsideBlock = prevLine === 'import {' || prevLine.startsWith('import {') && !prevLine.endsWith(';');

      if (isInsideBlock) {
        // Remove this line from current position
        lines.splice(i, 1);
        i--; // adjust index

        // Find the end of the current multi-line import block (line with `} from "..."`)
        // Start from the current line (after removal)
        let j = i + 1;
        while (j < lines.length) {
          const trimmed = lines[j].trim();
          if (trimmed.startsWith('} from ') || trimmed.startsWith("} from '")) {
            // Insert apiError import after this closing line
            lines.splice(j + 1, 0, API_UTILS_IMPORT);
            changed = true;
            break;
          }
          j++;
        }
      }
    }
  }

  return { newContent: lines.join('\n'), changed };
}

// After fix, remove duplicate apiError imports
function dedup(content) {
  const lines = content.split('\n');
  let found = false;
  const result = [];
  for (const line of lines) {
    if (line.trim() === API_UTILS_IMPORT) {
      if (found) continue; // skip duplicate
      found = true;
    }
    result.push(line);
  }
  return result.join('\n');
}

const files = findRouteFiles(API_DIR);
let fixedCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const { newContent, changed } = fixFile(content);

  if (changed) {
    const deduped = dedup(newContent);
    fs.writeFileSync(file, deduped, 'utf8');
    fixedCount++;
    const rel = path.relative(ROOT, file);
    console.log(`  Fixed: ${rel}`);
  }
}

console.log(`\nDone. Fixed: ${fixedCount}`);
