/**
 * Migration script v2: handle variable message patterns.
 *
 * Targets remaining patterns:
 *   NextResponse.json({ status: N, message }, { status: N })
 *   NextResponse.json({ status: N, message }, { status: N })
 *   NextResponse.json({ status: N, message, errorKey: X }, { status: N })
 *   NextResponse.json({ status: 400, errors }, { status: 400 })
 *   NextResponse.json({ status: 400, message: "...", field: "..." }, { status: 400 })
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
    // Pattern: { status: N, message, errorKey: X }
    const patternMsgVarWithKey = new RegExp(
      `NextResponse\\.json\\(\\s*\\{\\s*status:\\s*${code},\\s*message,\\s*errorKey:\\s*([^}]+)\\},\\s*\\{\\s*status:\\s*${code}\\s*\\}\\s*\\)`,
      'g'
    );
    result = result.replace(patternMsgVarWithKey, (_, key) => {
      changed = true;
      return `apiError(${code}, message, { code: ${key.trim()} })`;
    });

    // Pattern: { status: N, message } (variable shorthand)
    const patternMsgVar = new RegExp(
      `NextResponse\\.json\\(\\s*\\{\\s*status:\\s*${code},\\s*message\\s*\\},\\s*\\{\\s*status:\\s*${code}\\s*\\}\\s*\\)`,
      'g'
    );
    result = result.replace(patternMsgVar, () => {
      changed = true;
      return `apiError(${code}, message)`;
    });

    // Pattern: { status: N, message: someVar } (named variable, not string literal)
    // This catches cases where message is a variable like: message: msg
    const patternMsgNamedVar = new RegExp(
      `NextResponse\\.json\\(\\s*\\{\\s*status:\\s*${code},\\s*message:\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\},\\s*\\{\\s*status:\\s*${code}\\s*\\}\\s*\\)`,
      'g'
    );
    result = result.replace(patternMsgNamedVar, (_, varName) => {
      changed = true;
      return `apiError(${code}, ${varName})`;
    });
  }

  // Pattern: { status: 422, message, errorKey: "TRANSFER_REQUIRED" }
  const pattern422 = /NextResponse\.json\(\s*\{\s*status:\s*422,\s*message,\s*errorKey:\s*"([^"]+)"\s*\},\s*\{\s*status:\s*422\s*\}\s*\)/g;
  result = result.replace(pattern422, (_, key) => {
    changed = true;
    return `apiError(422, message, { code: "${key}" })`;
  });

  // Pattern: { status: 400, errors } — missing message field
  const patternErrorsOnly = /NextResponse\.json\(\s*\{\s*status:\s*400,\s*errors\s*\},\s*\{\s*status:\s*400\s*\}\s*\)/g;
  result = result.replace(patternErrorsOnly, () => {
    changed = true;
    return `apiError(400, "Erreurs de validation.", { errors })`;
  });

  // Pattern: { status: 400, message: "...", field: "..." } — with extra field property
  const patternWithField = /NextResponse\.json\(\s*\{\s*status:\s*400,\s*message:\s*("[^"]*"|`[^`]*`|'[^']*'),\s*field:\s*("[^"]*"|`[^`]*`|'[^']*')\s*\},\s*\{\s*status:\s*400\s*\}\s*\)/g;
  result = result.replace(patternWithField, (_, msg, field) => {
    changed = true;
    // Convert field to errors array entry
    return `apiError(400, ${msg}, { errors: [{ field: ${field}, message: ${msg} }] })`;
  });

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
