/**
 * Lion Engineering GmbH — Design Export to PDF (Playwright edition)
 * Renders all 10 canvas nodes (5 pages × desktop + mobile) into a single PDF.
 * Usage: node scripts/generate-lion-pdf.mjs
 */

import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Helpers ────────────────────────────────────────────────────────────────
function wrapHtml(body, width) {
  const eager = body
    .replace(/loading="lazy"/g, 'loading="eager"')
    .replace(/decoding="async"/g, 'decoding="sync"');
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${width}, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: ${width}px; background: white; }
    img { max-width: 100%; }
    input, textarea, button, select { font-family: inherit; }
  </style>
</head>
<body style="width:${width}px; overflow-x:hidden;">
${eager}
</body>
</html>`;
}

// ─── Pages ordered for the PDF ───────────────────────────────────────────────
const NODES = [
  { id: 'homepage-desktop',   label: 'Startseite — Desktop',            width: 1440 },
  { id: 'homepage-mobile',    label: 'Startseite — Mobil',              width: 375  },
  { id: 'aerospace-desktop',  label: 'Luft- und Raumfahrt — Desktop',   width: 1440 },
  { id: 'aerospace-mobile',   label: 'Luft- und Raumfahrt — Mobil',     width: 375  },
  { id: 'contact-desktop',    label: 'Kontakt — Desktop',               width: 1440 },
  { id: 'contact-mobile',     label: 'Kontakt — Mobil',                 width: 375  },
  { id: 'about-desktop',      label: 'Über uns — Desktop',              width: 1440 },
  { id: 'about-mobile',       label: 'Über uns — Mobil',                width: 375  },
  { id: 'careers-desktop',    label: 'Karriere — Desktop',              width: 1440 },
  { id: 'careers-mobile',     label: 'Karriere — Mobil',                width: 375  },
];

const HTML_DIR = path.join(__dirname, 'pdf-html');

async function run() {
  console.log('🚀 Starte PDF-Export für Lion Engineering GmbH…\n');

  const browser = await chromium.launch({ headless: true });
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle('Lion Engineering GmbH — Website Designs');
  pdfDoc.setAuthor('Lion Engineering GmbH');
  pdfDoc.setCreationDate(new Date());

  for (const node of NODES) {
    const htmlPath = path.join(HTML_DIR, `${node.id}.html`);
    if (!fs.existsSync(htmlPath)) {
      console.warn(`  ⚠️  HTML nicht gefunden: ${htmlPath} — übersprungen`);
      continue;
    }

    console.log(`  📄  Rendere: ${node.label} (${node.width}px)…`);

    const rawHtml = fs.readFileSync(htmlPath, 'utf-8');
    const fullHtml = wrapHtml(rawHtml, node.width);

    const context = await browser.newContext({
      viewport: { width: node.width, height: 900 },
      deviceScaleFactor: 1.5,
    });
    const page = await context.newPage();

    await page.setContent(fullHtml, { waitUntil: 'networkidle', timeout: 30000 });
    // Extra settle time for Google Fonts + remote images
    await page.waitForTimeout(3000);

    const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
    await context.close();

    const pngImage = await pdfDoc.embedPng(screenshot);
    const { width: imgW, height: imgH } = pngImage.scale(1);
    const pdfPage = pdfDoc.addPage([imgW, imgH]);
    pdfPage.drawImage(pngImage, { x: 0, y: 0, width: imgW, height: imgH });

    console.log(`     ✅  ${imgW} × ${imgH} px`);
  }

  await browser.close();

  const outPath = path.join(process.cwd(), 'public', 'lion-engineering.pdf');
  fs.writeFileSync(outPath, await pdfDoc.save());
  console.log(`\n✅  PDF gespeichert: ${outPath}`);
  const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
  console.log(`    Dateigröße: ${sizeMB} MB`);
}

run().catch(err => { console.error(err); process.exit(1); });
