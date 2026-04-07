/**
 * Tests Sprint 54.6 — Component Pattern Upgrades
 *
 * Couverture :
 * 1. Badge — shape prop (pill/square), variantes, valeur par défaut
 * 2. SlidePanel — exports, structure base sur Radix Dialog
 * 3. SilureLogo — props size et className, utilise currentColor, viewBox 32x32
 * 4. Icone Fish conservée pour Reproducteurs (line 120 farm-sidebar)
 * 5. SilureLogo présent dans les 6 emplacements de branding
 * 6. public/icons/silure.svg — existence et contenu
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Helper : lire un fichier source
// ---------------------------------------------------------------------------
function readSrc(relative: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../", relative), "utf-8");
}

// ---------------------------------------------------------------------------
// 1. Badge — shape prop
// ---------------------------------------------------------------------------
describe("Badge — shape prop (pill/square)", () => {
  const badgeSrc = readSrc("src/components/ui/badge.tsx");

  it("définit un objet shapes avec les variantes pill et square", () => {
    expect(badgeSrc).toContain("shapes");
    expect(badgeSrc).toContain("pill");
    expect(badgeSrc).toContain("square");
  });

  it("pill utilise rounded-full", () => {
    expect(badgeSrc).toContain('pill: "rounded-full"');
  });

  it("square utilise rounded-md", () => {
    expect(badgeSrc).toContain('square: "rounded-md"');
  });

  it("interface BadgeProps expose shape?: keyof typeof shapes", () => {
    expect(badgeSrc).toContain("shape?");
    // Shape est bien un keyof du dict shapes
    expect(badgeSrc).toContain("keyof typeof shapes");
  });

  it("default shape = pill", () => {
    // Dans la signature de la fonction, shape = "pill"
    expect(badgeSrc).toContain('shape = "pill"');
  });

  it("shapes[shape] est appliqué dans le className", () => {
    expect(badgeSrc).toContain("shapes[shape]");
  });

  it("exporte Badge et BadgeProps", () => {
    expect(badgeSrc).toContain("export { Badge");
    expect(badgeSrc).toContain("type BadgeProps");
  });
});

// ---------------------------------------------------------------------------
// 2. SlidePanel — structure et exports
// ---------------------------------------------------------------------------
describe("SlidePanel — composant basé sur Radix Dialog", () => {
  const panelSrc = readSrc("src/components/ui/slide-panel.tsx");

  it("est marqué 'use client'", () => {
    expect(panelSrc).toContain('"use client"');
  });

  it("importe Radix Dialog (@radix-ui/react-dialog)", () => {
    expect(panelSrc).toContain("@radix-ui/react-dialog");
  });

  it("SlidePanel = DialogPrimitive.Root", () => {
    expect(panelSrc).toContain("DialogPrimitive.Root");
  });

  it("SlidePanelTrigger = DialogPrimitive.Trigger", () => {
    expect(panelSrc).toContain("DialogPrimitive.Trigger");
  });

  it("SlidePanelClose = DialogPrimitive.Close", () => {
    expect(panelSrc).toContain("DialogPrimitive.Close");
  });

  it("SlidePanelTitle utilise DialogPrimitive.Title (accessible)", () => {
    expect(panelSrc).toContain("DialogPrimitive.Title");
  });

  it("SlidePanelDescription utilise DialogPrimitive.Description (accessible)", () => {
    expect(panelSrc).toContain("DialogPrimitive.Description");
  });

  it("desktop : droite avec w-[480px]", () => {
    expect(panelSrc).toContain("w-[480px]");
  });

  it("desktop : positionné à droite (md:right-0)", () => {
    expect(panelSrc).toContain("md:right-0");
  });

  it("mobile : plein écran (fixed inset-0)", () => {
    expect(panelSrc).toContain("fixed inset-0");
  });

  it("safe area top prise en compte (iOS)", () => {
    expect(panelSrc).toContain("safe-area-inset-top");
  });

  it("safe area bottom prise en compte (iOS)", () => {
    expect(panelSrc).toContain("safe-area-inset-bottom");
  });

  it("animation slide-in-from-right au desktop", () => {
    expect(panelSrc).toContain("slide-in-from-right");
  });

  it("animation slide-out-to-right au desktop", () => {
    expect(panelSrc).toContain("slide-out-to-right");
  });

  it("exporte tous les sous-composants requis", () => {
    const requiredExports = [
      "SlidePanel",
      "SlidePanelTrigger",
      "SlidePanelClose",
      "SlidePanelContent",
      "SlidePanelHeader",
      "SlidePanelBody",
      "SlidePanelFooter",
      "SlidePanelTitle",
      "SlidePanelDescription",
    ];
    for (const name of requiredExports) {
      expect(panelSrc, `Export manquant : ${name}`).toContain(name);
    }
  });

  it("SlidePanelBody est scrollable (overflow-y-auto)", () => {
    expect(panelSrc).toContain("overflow-y-auto");
  });

  it("prop hideCloseButton permet de masquer le bouton de fermeture", () => {
    expect(panelSrc).toContain("hideCloseButton");
  });
});

// ---------------------------------------------------------------------------
// 3. SilureLogo — composant SVG inline
// ---------------------------------------------------------------------------
describe("SilureLogo — composant SVG inline", () => {
  const logoSrc = readSrc("src/components/ui/silure-logo.tsx");

  it("exporte la fonction SilureLogo", () => {
    expect(logoSrc).toContain("export function SilureLogo");
  });

  it("prop size par défaut = 24", () => {
    expect(logoSrc).toContain("size = 24");
  });

  it("prop className est supportée", () => {
    expect(logoSrc).toContain("className");
  });

  it("width et height utilisent le prop size", () => {
    expect(logoSrc).toContain("width={size}");
    expect(logoSrc).toContain("height={size}");
  });

  it("viewBox est 0 0 32 32", () => {
    expect(logoSrc).toContain('viewBox="0 0 32 32"');
  });

  it("utilise currentColor pour s'adapter au thème", () => {
    expect(logoSrc).toContain("currentColor");
  });

  it("aria-hidden=true (icône décorative)", () => {
    expect(logoSrc).toContain('aria-hidden="true"');
  });

  it("shrink-0 pour éviter le redimensionnement en flex", () => {
    expect(logoSrc).toContain("shrink-0");
  });

  it("represente un silure (barbillons présents dans le SVG)", () => {
    // Le silure est reconnaissable par ses barbillons
    expect(logoSrc).toContain("Barbillon");
  });
});

// ---------------------------------------------------------------------------
// 4. public/icons/silure.svg — fichier statique
// ---------------------------------------------------------------------------
describe("public/icons/silure.svg — fichier SVG statique", () => {
  const svgPath = path.resolve(__dirname, "../../../public/icons/silure.svg");

  it("le fichier existe", () => {
    expect(fs.existsSync(svgPath)).toBe(true);
  });

  it("contient un élément SVG avec viewBox 0 0 32 32", () => {
    const svg = fs.readFileSync(svgPath, "utf-8");
    expect(svg).toContain('viewBox="0 0 32 32"');
  });

  it("utilise currentColor (pas de couleur codée en dur)", () => {
    const svg = fs.readFileSync(svgPath, "utf-8");
    expect(svg).toContain("currentColor");
    // Pas de couleur hex codée en dur
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("aria-hidden est présent", () => {
    const svg = fs.readFileSync(svgPath, "utf-8");
    expect(svg).toContain("aria-hidden");
  });
});

// ---------------------------------------------------------------------------
// 5. Icone Fish conservée UNIQUEMENT pour Reproducteurs (farm-sidebar line ~120)
//    et NE PAS utiliser Fish pour le branding
// ---------------------------------------------------------------------------
describe("farm-sidebar.tsx — Fish réservé à Reproducteurs, SilureLogo pour branding", () => {
  const sidebarSrc = readSrc("src/components/layout/farm-sidebar.tsx");

  it("importe encore Fish de lucide-react (nécessaire pour Reproducteurs)", () => {
    expect(sidebarSrc).toContain("Fish,");
  });

  it("Fish est utilisé pour le nav item geniteurs (ADR-045 — renommé de reproducteurs à geniteurs)", () => {
    expect(sidebarSrc).toContain('icon: Fish');
    expect(sidebarSrc).toContain("geniteurs");
  });

  it("SilureLogo est importé depuis ui/silure-logo", () => {
    expect(sidebarSrc).toContain('from "@/components/ui/silure-logo"');
    expect(sidebarSrc).toContain("SilureLogo");
  });

  it("SilureLogo est utilisé dans la zone branding (Logo header)", () => {
    // Le logo header utilise SilureLogo avec text-primary
    expect(sidebarSrc).toContain("SilureLogo");
    expect(sidebarSrc).toContain("text-primary");
  });

  it("Fish n'est pas utilisé dans la zone logo/branding", () => {
    // La section logo header ne doit pas contenir Fish
    // On vérifie que Fish n'apparaît que dans les items nav, pas dans le header logo
    const logoSection = sidebarSrc.match(/Logo header[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(logoSection).not.toContain("<Fish");
  });
});

// ---------------------------------------------------------------------------
// 6. SilureLogo présent dans les 6 fichiers de branding
// ---------------------------------------------------------------------------
describe("SilureLogo — présent dans les 6 emplacements de branding", () => {
  const brandingFiles = [
    "src/components/layout/farm-sidebar.tsx",
    "src/components/layout/farm-bottom-nav.tsx",
    "src/components/layout/farm-header.tsx",
    "src/components/layout/ingenieur-sidebar.tsx",
    "src/components/layout/ingenieur-header.tsx",
    "src/components/layout/ingenieur-bottom-nav.tsx",
  ];

  for (const file of brandingFiles) {
    it(`${file} — importe et utilise SilureLogo`, () => {
      const src = readSrc(file);
      expect(src, `SilureLogo manquant dans ${file}`).toContain("SilureLogo");
      expect(src, `Import silure-logo manquant dans ${file}`).toContain("silure-logo");
    });
  }

  it("farm-bottom-nav.tsx — SilureLogo dans la zone header du Sheet (branding mobile)", () => {
    const src = readSrc("src/components/layout/farm-bottom-nav.tsx");
    // Le SilureLogo est dans le header du sheet avec FarmFlow label
    expect(src).toContain("SilureLogo");
    expect(src).toContain("FarmFlow");
  });

  it("farm-header.tsx — SilureLogo dans le header mobile sticky", () => {
    const src = readSrc("src/components/layout/farm-header.tsx");
    expect(src).toContain("SilureLogo");
    expect(src).toContain("FarmFlow");
  });

  it("ingenieur-header.tsx — SilureLogo dans le header mobile ingénieur", () => {
    const src = readSrc("src/components/layout/ingenieur-header.tsx");
    expect(src).toContain("SilureLogo");
    expect(src).toContain("FarmFlow");
  });
});

// ---------------------------------------------------------------------------
// 7. Non-régression — Fish pas utilisé dans les layouts ingénieur pour branding
// ---------------------------------------------------------------------------
describe("Non-régression — Fish absent des emplacements de branding ingénieur", () => {
  it("ingenieur-header.tsx n'importe pas Fish", () => {
    const src = readSrc("src/components/layout/ingenieur-header.tsx");
    expect(src).not.toContain("Fish");
  });

  it("ingenieur-sidebar.tsx n'importe pas Fish", () => {
    const src = readSrc("src/components/layout/ingenieur-sidebar.tsx");
    // Fish n'est pas dans les imports ingénieur (pas de reproducteurs ici)
    expect(src).not.toContain("import.*Fish");
  });

  it("farm-header.tsx n'importe pas Fish", () => {
    const src = readSrc("src/components/layout/farm-header.tsx");
    expect(src).not.toContain("Fish");
  });
});
