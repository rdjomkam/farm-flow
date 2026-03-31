/**
 * Migration script: unify API error responses to use apiError() helper.
 *
 * Usage: node scripts/migrate-api-errors.mjs
 *
 * What it does:
 * 1. Finds all src/app/api/**\/route.ts files
 * 2. Adds `import { apiError } from "@/lib/api-utils";` if not already present
 * 3. Replaces all inline NextResponse.json error patterns with apiError()
 *
 * Patterns replaced:
 *   A) Single-field errors (no `errors` array):
 *      NextResponse.json({ status: N, message: "..." }, { status: N })
 *      => apiError(N, "...")
 *
 *      NextResponse.json({ status: N, message: "...", errorKey: X }, { status: N })
 *      => apiError(N, "...", { code: X })
 *
 *   B) With validation errors:
 *      NextResponse.json({ status: 400, message: "...", errors }, { status: 400 })
 *      => apiError(400, "...", { errors })
 *
 *   C) Quota errors:
 *      NextResponse.json({ status: 402, error: "QUOTA_DEPASSE", ..., message: "..." }, { status: 402 })
 *      => apiError(402, "...", { code: "QUOTA_DEPASSE" })
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

/**
 * Given file content, transform error NextResponse.json calls to apiError().
 * Returns { newContent, changed } where changed = true if modifications were made.
 */
function transformContent(content) {
  let changed = false;
  let result = content;

  // -------------------------------------------------------------------------
  // Pattern A: simple { status: N, message: "..." }
  // NextResponse.json({ status: N, message: ... }, { status: N })
  // -------------------------------------------------------------------------
  // We use a multiline-capable replacement.
  // Handle the inline single-line case first.

  // Pattern: NextResponse.json(\n? {\n? status: NNN,\n? message: ...,\n? errorKey: EXPR\n? },\n? { status: NNN }\n? )
  // This is tricky with regex; let's do targeted replacements for each status code.

  const STATUS_CODES = [400, 401, 402, 403, 404, 405, 409, 422, 500, 503];

  for (const code of STATUS_CODES) {
    // Pattern: single-line with errorKey
    // NextResponse.json({ status: 4xx, message: "...", errorKey: ErrorKeys.X }, { status: 4xx })
    const patternWithErrorKey = new RegExp(
      `NextResponse\\.json\\(\\s*\\{\\s*status:\\s*${code},\\s*message:\\s*([^,}]+),\\s*errorKey:\\s*([^}]+)\\},\\s*\\{\\s*status:\\s*${code}\\s*\\}\\s*\\)`,
      'g'
    );
    result = result.replace(patternWithErrorKey, (_, msg, key) => {
      changed = true;
      const trimMsg = msg.trim();
      const trimKey = key.trim();
      return `apiError(${code}, ${trimMsg}, { code: ${trimKey} })`;
    });

    // Pattern: single-line with `errors` variable
    // NextResponse.json({ status: 400, message: "...", errors }, { status: 400 })
    if (code === 400) {
      const patternWithErrors = new RegExp(
        `NextResponse\\.json\\(\\s*\\{\\s*status:\\s*400,\\s*message:\\s*([^,}]+),\\s*errors\\s*\\},\\s*\\{\\s*status:\\s*400\\s*\\}\\s*\\)`,
        'g'
      );
      result = result.replace(patternWithErrors, (_, msg) => {
        changed = true;
        const trimMsg = msg.trim();
        return `apiError(400, ${trimMsg}, { errors })`;
      });
    }

    // Pattern: simple { status: N, message: "..." } — no extra fields
    const patternSimple = new RegExp(
      `NextResponse\\.json\\(\\s*\\{\\s*status:\\s*${code},\\s*message:\\s*([^,}]+)\\s*\\},\\s*\\{\\s*status:\\s*${code}\\s*\\}\\s*\\)`,
      'g'
    );
    result = result.replace(patternSimple, (_, msg) => {
      changed = true;
      const trimMsg = msg.trim();
      return `apiError(${code}, ${trimMsg})`;
    });
  }

  // -------------------------------------------------------------------------
  // Pattern B: quota errors
  // NextResponse.json({ status: 402, error: "QUOTA_DEPASSE", ressource: ..., limite: ..., message: "..." }, { status: 402 })
  // -------------------------------------------------------------------------
  const quotaPattern = /NextResponse\.json\(\s*\{\s*status:\s*402,\s*error:\s*"QUOTA_DEPASSE",[^}]*message:\s*([^,}]+)\s*\},\s*\{\s*status:\s*402\s*\}\s*\)/gs;
  result = result.replace(quotaPattern, (_, msg) => {
    changed = true;
    const trimMsg = msg.trim();
    return `apiError(402, ${trimMsg}, { code: "QUOTA_DEPASSE" })`;
  });

  // -------------------------------------------------------------------------
  // Add import if needed and if content changed
  // -------------------------------------------------------------------------
  if (changed && !result.includes('@/lib/api-utils')) {
    // Add import after the last existing import line
    // Find last import statement
    const importMatch = result.match(/^(import .+;\n)+/m);
    if (importMatch) {
      // Find the position after the first block of consecutive imports
      const lines = result.split('\n');
      let lastImportLine = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          lastImportLine = i;
        } else if (lastImportLine >= 0 && lines[i].trim() !== '' && !lines[i].startsWith('import ')) {
          break;
        }
      }
      if (lastImportLine >= 0) {
        lines.splice(lastImportLine + 1, 0, 'import { apiError } from "@/lib/api-utils";');
        result = lines.join('\n');
      }
    } else {
      // Prepend import at top
      result = 'import { apiError } from "@/lib/api-utils";\n' + result;
    }
  }

  return { newContent: result, changed };
}

const files = findRouteFiles(API_DIR);
let migratedCount = 0;
let skippedCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const { newContent, changed } = transformContent(content);

  if (changed) {
    fs.writeFileSync(file, newContent, 'utf8');
    migratedCount++;
    const rel = path.relative(ROOT, file);
    console.log(`  Migrated: ${rel}`);
  } else {
    skippedCount++;
  }
}

console.log(`\nDone. Migrated: ${migratedCount}, Skipped (no changes): ${skippedCount}`);
