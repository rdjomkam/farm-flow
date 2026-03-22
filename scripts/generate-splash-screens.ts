/**
 * generate-splash-screens.ts
 *
 * Génère les splash screens iOS PWA et les icônes Apple touch pour FarmFlow.
 *
 * Usage :
 *   npx tsx scripts/generate-splash-screens.ts
 *
 * Prérequis :
 *   - sharp est installé dans les node_modules du projet
 *   - public/icon-512.png existe (icône 512x512 de l'app)
 *   - Dossiers public/splash/ et public/screenshots/ créés (ou seront créés automatiquement)
 *
 * Sortie :
 *   - public/splash/apple-splash-*.png (10 fichiers, 1 par appareil Apple)
 *   - public/apple-touch-icon-180.png
 *   - public/apple-touch-icon-152.png
 *   - public/apple-touch-icon-120.png
 *   - public/screenshots/mobile-dashboard.png (placeholder 390x844)
 *   - public/screenshots/mobile-vagues.png (placeholder 390x844)
 *   - public/screenshots/desktop-dashboard.png (placeholder 1280x800)
 */

import * as path from "path";
import * as fs from "fs";
import sharp from "sharp";

// ─── Chemins ─────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const ICON_512 = path.join(PUBLIC, "icon-512.png");
const SPLASH_DIR = path.join(PUBLIC, "splash");
const SCREENSHOTS_DIR = path.join(PUBLIC, "screenshots");

// ─── Couleurs du thème ────────────────────────────────────────────────────────

const PRIMARY = "#0d9488"; // --primary (teal)
const BACKGROUND = "#ffffff"; // --background (blanc)

// ─── Définition des splash screens iOS ───────────────────────────────────────

interface SplashScreen {
  /** Largeur logique de l'écran en CSS px */
  width: number;
  /** Hauteur logique de l'écran en CSS px */
  height: number;
  /** Device pixel ratio */
  dpr: number;
  /** Nom du fichier de sortie */
  file: string;
  /** Appareil cible (documentation) */
  device: string;
}

const SPLASH_SCREENS: SplashScreen[] = [
  { width: 375, height: 667,  dpr: 2, file: "apple-splash-750-1334.png",   device: "iPhone SE (3rd gen)" },
  { width: 375, height: 812,  dpr: 3, file: "apple-splash-1125-2436.png",  device: "iPhone 13/14 mini" },
  { width: 390, height: 844,  dpr: 3, file: "apple-splash-1170-2532.png",  device: "iPhone 14/15" },
  { width: 393, height: 852,  dpr: 3, file: "apple-splash-1179-2556.png",  device: "iPhone 14/15 Pro" },
  { width: 428, height: 926,  dpr: 3, file: "apple-splash-1284-2778.png",  device: "iPhone 14/15 Plus" },
  { width: 430, height: 932,  dpr: 3, file: "apple-splash-1290-2796.png",  device: "iPhone 14/15 Pro Max" },
  { width: 744, height: 1133, dpr: 2, file: "apple-splash-1488-2266.png",  device: "iPad mini (6th gen)" },
  { width: 820, height: 1180, dpr: 2, file: "apple-splash-1640-2360.png",  device: "iPad Air (5th/M2)" },
  { width: 834, height: 1194, dpr: 2, file: "apple-splash-1668-2388.png",  device: "iPad Pro 11\"" },
  { width: 1024, height: 1366, dpr: 2, file: "apple-splash-2048-2732.png", device: "iPad Pro 13\"" },
];

// ─── Helpers SVG ──────────────────────────────────────────────────────────────

/**
 * Génère un SVG de splash screen avec le logo FarmFlow centré.
 * Le logo occupe ~20% de la largeur réelle de l'image.
 */
function buildSplashSvg(realWidth: number, realHeight: number): string {
  // Taille du logo : 20% de la largeur, centré
  const logoSize = Math.round(realWidth * 0.2);
  const logoX = Math.round((realWidth - logoSize) / 2);
  // Le logo est positionné légèrement au-dessus du centre vertical
  const logoY = Math.round(realHeight * 0.35);

  // Texte "FarmFlow" sous le logo
  const fontSize = Math.round(logoSize * 0.35);
  const textX = Math.round(realWidth / 2);
  const textY = logoY + logoSize + Math.round(fontSize * 1.5);

  // Barre de couleur primary en bas (3% de la hauteur)
  const barHeight = Math.round(realHeight * 0.03);
  const barY = realHeight - barHeight;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${realWidth}" height="${realHeight}" viewBox="0 0 ${realWidth} ${realHeight}">
  <!-- Fond blanc -->
  <rect width="${realWidth}" height="${realHeight}" fill="${BACKGROUND}"/>

  <!-- Logo FarmFlow (poisson centré) -->
  <g transform="translate(${logoX + logoSize / 2}, ${logoY + logoSize / 2})">
    <rect
      x="${-logoSize / 2}" y="${-logoSize / 2}"
      width="${logoSize}" height="${logoSize}"
      rx="${Math.round(logoSize * 0.1875)}"
      fill="${PRIMARY}"
    />
    <!-- Corps du poisson -->
    <ellipse cx="0" cy="0" rx="${Math.round(logoSize * 0.273)}" ry="${Math.round(logoSize * 0.137)}" fill="${BACKGROUND}"/>
    <!-- Queue -->
    <polygon
      points="${Math.round(logoSize * 0.234)},${Math.round(-logoSize * 0.02)} ${Math.round(logoSize * 0.332)},${Math.round(-logoSize * 0.107)} ${Math.round(logoSize * 0.332)},${Math.round(logoSize * 0.107)} ${Math.round(logoSize * 0.234)},${Math.round(logoSize * 0.02)}"
      fill="${BACKGROUND}"
    />
    <!-- Oeil -->
    <circle cx="${Math.round(-logoSize * 0.117)}" cy="${Math.round(-logoSize * 0.029)}" r="${Math.round(logoSize * 0.027)}" fill="${PRIMARY}"/>
    <circle cx="${Math.round(-logoSize * 0.109)}" cy="${Math.round(-logoSize * 0.035)}" r="${Math.round(logoSize * 0.01)}" fill="${BACKGROUND}"/>
    <!-- Nageoire dorsale -->
    <path d="M${Math.round(-logoSize * 0.039)},${Math.round(-logoSize * 0.137)} Q${Math.round(logoSize * 0.039)},${Math.round(-logoSize * 0.215)} ${Math.round(logoSize * 0.117)},${Math.round(-logoSize * 0.137)}" fill="none" stroke="${BACKGROUND}" stroke-width="${Math.round(logoSize * 0.023)}" stroke-linecap="round"/>
    <!-- Nageoire ventrale -->
    <path d="M0,${Math.round(logoSize * 0.137)} Q${Math.round(logoSize * 0.039)},${Math.round(logoSize * 0.195)} ${Math.round(logoSize * 0.098)},${Math.round(logoSize * 0.156)}" fill="none" stroke="${BACKGROUND}" stroke-width="${Math.round(logoSize * 0.02)}" stroke-linecap="round"/>
  </g>

  <!-- Texte "FarmFlow" -->
  <text
    x="${textX}" y="${textY}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="${PRIMARY}"
    text-anchor="middle"
  >FarmFlow</text>

  <!-- Barre primary en bas -->
  <rect x="0" y="${barY}" width="${realWidth}" height="${barHeight}" fill="${PRIMARY}"/>
</svg>`;
}

/**
 * Génère un SVG de screenshot placeholder avec une mise en page simple.
 */
function buildScreenshotSvg(
  width: number,
  height: number,
  label: string,
  subtitle: string
): string {
  const titleFontSize = Math.round(Math.min(width, height) * 0.04);
  const subtitleFontSize = Math.round(titleFontSize * 0.65);
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2);
  const logoSize = Math.round(Math.min(width, height) * 0.12);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <!-- Fond -->
  <rect width="${width}" height="${height}" fill="#f8fafc"/>

  <!-- Header barre -->
  <rect x="0" y="0" width="${width}" height="${Math.round(height * 0.08)}" fill="${PRIMARY}"/>
  <text x="${Math.round(width / 2)}" y="${Math.round(height * 0.055)}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${Math.round(height * 0.03)}"
    font-weight="700"
    fill="#ffffff"
    text-anchor="middle"
  >FarmFlow</text>

  <!-- Logo centré -->
  <g transform="translate(${centerX - logoSize / 2}, ${centerY - logoSize * 0.8})">
    <rect width="${logoSize}" height="${logoSize}" rx="${Math.round(logoSize * 0.1875)}" fill="${PRIMARY}" opacity="0.15"/>
    <text x="${Math.round(logoSize / 2)}" y="${Math.round(logoSize * 0.65)}"
      font-family="system-ui, -apple-system, sans-serif"
      font-size="${Math.round(logoSize * 0.55)}"
      text-anchor="middle"
    >🐟</text>
  </g>

  <!-- Label -->
  <text x="${centerX}" y="${Math.round(centerY + logoSize * 0.5)}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${titleFontSize}"
    font-weight="700"
    fill="#0f172a"
    text-anchor="middle"
  >${label}</text>

  <text x="${centerX}" y="${Math.round(centerY + logoSize * 0.5 + titleFontSize * 1.6)}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${subtitleFontSize}"
    fill="#64748b"
    text-anchor="middle"
  >${subtitle}</text>

  <!-- Bottom bar -->
  <rect x="0" y="${height - Math.round(height * 0.01)}" width="${width}" height="${Math.round(height * 0.01)}" fill="${PRIMARY}"/>
</svg>`;
}

// ─── Génération des splash screens ───────────────────────────────────────────

async function generateSplashScreens(): Promise<void> {
  fs.mkdirSync(SPLASH_DIR, { recursive: true });

  console.log(`\nGeneration des splash screens iOS (${SPLASH_SCREENS.length} fichiers)...\n`);

  for (const screen of SPLASH_SCREENS) {
    const realWidth = screen.width * screen.dpr;
    const realHeight = screen.height * screen.dpr;
    const outputPath = path.join(SPLASH_DIR, screen.file);

    const svgBuffer = Buffer.from(buildSplashSvg(realWidth, realHeight));

    await sharp(svgBuffer)
      .resize(realWidth, realHeight)
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    console.log(`  OK  ${screen.file}  (${realWidth}x${realHeight}) — ${screen.device}`);
  }

  console.log(`\n${SPLASH_SCREENS.length} splash screens generes dans public/splash/\n`);
}

// ─── Génération des Apple touch icons ────────────────────────────────────────

async function generateAppleIcons(): Promise<void> {
  if (!fs.existsSync(ICON_512)) {
    console.error(`ERREUR : ${ICON_512} introuvable. Impossible de generer les icones Apple.`);
    process.exit(1);
  }

  console.log("Generation des Apple touch icons...\n");

  const sizes = [
    { size: 180, file: "apple-touch-icon-180.png" },
    { size: 152, file: "apple-touch-icon-152.png" },
    { size: 120, file: "apple-touch-icon-120.png" },
  ];

  for (const { size, file } of sizes) {
    const outputPath = path.join(PUBLIC, file);
    await sharp(ICON_512)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    console.log(`  OK  ${file}  (${size}x${size})`);
  }

  console.log("\n3 Apple touch icons generes dans public/\n");
}

// ─── Génération des screenshots placeholder ──────────────────────────────────

async function generateScreenshots(): Promise<void> {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  console.log("Generation des screenshots placeholders...\n");

  const screenshots = [
    {
      file: "mobile-dashboard.png",
      width: 390,
      height: 844,
      label: "Tableau de bord",
      subtitle: "Suivi de production piscicole",
    },
    {
      file: "mobile-vagues.png",
      width: 390,
      height: 844,
      label: "Gestion des vagues",
      subtitle: "Lots de poissons et biometrie",
    },
    {
      file: "desktop-dashboard.png",
      width: 1280,
      height: 800,
      label: "Dashboard FarmFlow",
      subtitle: "Vue d'ensemble desktop",
    },
  ];

  for (const s of screenshots) {
    const outputPath = path.join(SCREENSHOTS_DIR, s.file);
    const svgBuffer = Buffer.from(buildScreenshotSvg(s.width, s.height, s.label, s.subtitle));

    await sharp(svgBuffer)
      .resize(s.width, s.height)
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    console.log(`  OK  ${s.file}  (${s.width}x${s.height})`);
  }

  console.log("\n3 screenshots generes dans public/screenshots/\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== generate-splash-screens.ts ===");
  console.log(`Racine du projet : ${ROOT}`);
  console.log(`Icone source     : ${ICON_512}`);

  await generateAppleIcons();
  await generateSplashScreens();
  await generateScreenshots();

  console.log("=== Generation terminee ===\n");
}

main().catch((err) => {
  console.error("ERREUR fatale :", err);
  process.exit(1);
});
