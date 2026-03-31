/**
 * Migration script v3: handle { error: ... } patterns and other remaining cases.
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

function transformContent(content) {
  let changed = false;
  let result = content;

  const STATUS_CODES = [400, 401, 402, 403, 404, 405, 409, 422, 500, 503];

  for (const code of STATUS_CODES) {
    // Pattern: { error: "string literal" } or { error: 'string' }
    const patternErrorStringLiteral = new RegExp(
      'NextResponse\\.json\\(\\s*\\{\\s*error:\\s*("[^"]*")\\s*\\},\\s*\\{\\s*status:\\s*' + code + '\\s*\\}\\s*\\)',
      'g'
    );
    result = result.replace(patternErrorStringLiteral, (_, msg) => {
      changed = true;
      return `apiError(${code}, ${msg})`;
    });

    // Pattern: { error: singleQuoteString }
    const patternErrorSingleQuote = new RegExp(
      "NextResponse\\.json\\(\\s*\\{\\s*error:\\s*('[^']*')\\s*\\},\\s*\\{\\s*status:\\s*" + code + "\\s*\\}\\s*\\)",
      'g'
    );
    result = result.replace(patternErrorSingleQuote, (_, msg) => {
      changed = true;
      return `apiError(${code}, ${msg})`;
    });

    // Pattern: { error: variable }  (identifier or member expression)
    const patternErrorVar = new RegExp(
      'NextResponse\\.json\\(\\s*\\{\\s*error:\\s*([a-zA-Z_$][a-zA-Z0-9_$.]*(?:\\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\\s*\\},\\s*\\{\\s*status:\\s*' + code + '\\s*\\}\\s*\\)',
      'g'
    );
    result = result.replace(patternErrorVar, (_, varName) => {
      changed = true;
      return `apiError(${code}, ${varName.trim()})`;
    });
  }

  // Special case: auth/login genericError variable
  // NextResponse.json(genericError, { status: 401 })
  result = result.replace(
    /NextResponse\.json\(genericError,\s*\{\s*status:\s*(\d+)\s*\}\s*\)/g,
    (_, code) => {
      changed = true;
      return `apiError(${code}, genericError.message)`;
    }
  );

  // Add import if needed
  if (changed && !result.includes('@/lib/api-utils')) {
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
    } else {
      result = 'import { apiError } from "@/lib/api-utils";\n' + result;
    }
  }

  return { newContent: result, changed };
}

const files = findRouteFiles(API_DIR);
let migratedCount = 0;

for (const file of files) {
  // Skip health route (non-standard format)
  if (file.includes('/health/')) continue;

  const content = fs.readFileSync(file, 'utf8');
  const { newContent, changed } = transformContent(content);

  if (changed) {
    fs.writeFileSync(file, newContent, 'utf8');
    migratedCount++;
    const rel = path.relative(ROOT, file);
    console.log(`  Migrated: ${rel}`);
  }
}

console.log(`\nDone. Migrated: ${migratedCount}`);
